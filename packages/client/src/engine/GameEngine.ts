/**
 * Client-side game engine.
 *
 * Bridges the shared game-loop (processGameTick / getTickRate) to the browser.
 * The engine owns the GameTickState, advances it on a setInterval, and emits
 * events on the Phaser game instance so both Phaser scenes and React hooks can
 * react to simulation updates.
 *
 * Lifecycle
 * ---------
 *  1. Construct with a Phaser.Game reference and an initial GameTickState.
 *  2. Call start() to begin ticking at the current speed.
 *  3. Call pause() / setSpeed() at any time.
 *  4. The engine is accessible globally via window.__GAME_ENGINE__.
 *
 * Events emitted on game.events
 * -----------------------------
 *  'engine:tick'              { tick: number }
 *  'engine:resources_updated' { empireId: string; credits: number; researchPoints: number }[]
 *  'engine:fleet_moved'       FleetMovedEvent
 *  'engine:combat_resolved'   CombatResolvedEvent
 *  'engine:battle_resolved'   BattleResultsData  (enriched; engine pauses until player continues)
 *  'engine:tech_researched'   TechResearchedEvent
 *  'engine:research_state'    ResearchState   (player empire's research state, emitted every tick)
 *  'engine:game_over'         { winnerId?: string; reason?: string }
 *  'engine:galaxy_updated'      Galaxy   (emitted every tick so minimap can refresh)
 *  'engine:planet_colonised'    { planetName: string; systemId: string; planetId: string }
 *  'engine:ship_produced'       { shipName: string; systemId: string }
 *  'engine:migration_started'   MigrationOrder
 *  'engine:migration_wave'      { migration: MigrationOrder; waveNumber: number; colonistsDispatched: number }
 *  'engine:migration_completed' MigrationOrder
 *  'engine:migration_cancelled' { targetPlanetId: string }
 */

import type Phaser from 'phaser';
import {
  processGameTick,
  initializeTickState,
  getTickRate,
  canBuildOnPlanet,
  canColonize,
  coloniseInSystem,
  COLONISATION_MINERAL_COST,
  COLONIST_TRANSFER_COUNT,
  addBuildingToQueue,
  demolishBuilding,
  canUpgradeBuilding,
  addUpgradeToQueue,
  getUpgradeCost,
  BUILDING_DEFINITIONS,
  HULL_TEMPLATE_BY_CLASS,
  startShipProduction,
  issueMovementOrder,
  startResearch as startResearchFn,
  queueResearch as queueResearchFn,
  dequeueResearch as dequeueResearchFn,
  redistributeAllocation,
  setResearchAllocation,
  calculateEmpireProduction,
  UNIVERSAL_TECHNOLOGIES,
  createNotification,
  ZONE_COST_MULTIPLIER,
  generateBattleReport,
  addAgentToState,
  splitFleet as splitFleetFn,
  assignMission as assignMissionFn,
  SPY_RECRUIT_COST,
} from '@nova-imperia/shared';
import type { GameTickState } from '@nova-imperia/shared';
import type { GameSpeedName } from '@nova-imperia/shared';
import type { BuildingType, ShipDesign } from '@nova-imperia/shared';
import type { Fleet, Ship } from '@nova-imperia/shared';
import type { ResearchState, Governor, SpyAgent, SpyMission } from '@nova-imperia/shared';
import type {
  FleetMovedEvent,
  CombatResolvedEvent,
  TechResearchedEvent,
  ColonyEstablishedEvent,
  GameEvent,
  TacticalState,
  BattleReport,
  EmpireResources,
} from '@nova-imperia/shared';
import type { BattleResultsData, BattleShipRecord } from '../ui/screens/BattleResultsScreen.js';
import {
  createMigrationOrder,
  cancelMigration,
  getActiveMigrations as getMigrationOrders,
  tickMigrations,
} from './migration.js';
import type { MigrationOrder } from './migration.js';
import { getSaveManager } from './SaveManager.js';

// ── Type helpers ─────────────────────────────────────────────────────────────

/** Minimal slice of Phaser.Game we actually use so we can avoid a hard Phaser import. */
interface PhaserGameBridge {
  events: {
    emit: (event: string, data?: unknown) => void;
  };
}

// ── GameEngine ────────────────────────────────────────────────────────────────

export class GameEngine {
  private tickState: GameTickState;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /**
   * @param game      The Phaser game instance (used for event emission).
   * @param tickState The initial GameTickState produced by initializeTickState().
   */
  constructor(
    private readonly game: PhaserGameBridge,
    tickState: GameTickState,
  ) {
    this.tickState = tickState;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Start the tick loop using the current game speed. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this._scheduleInterval();
  }

  /** Pause the tick loop.  State is preserved; call start() to resume. */
  pause(): void {
    this.running = false;
    this._clearInterval();
    // Keep the game-state status in sync
    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, status: 'paused', speed: 'paused' },
    };
  }

  /**
   * Change game speed.
   * If the engine is running, the interval is rescheduled immediately.
   * Pausing via setSpeed('paused') is equivalent to calling pause().
   */
  setSpeed(speed: GameSpeedName): void {
    // Update the canonical speed stored in the tick state
    this.tickState = {
      ...this.tickState,
      gameState: {
        ...this.tickState.gameState,
        speed,
        status: speed === 'paused' ? 'paused' : 'playing',
      },
    };

    if (speed === 'paused') {
      this.pause();
      return;
    }

    // If the engine was paused by a previous setSpeed('paused') call, resume it
    if (!this.running) {
      this.running = true;
    }

    // Reschedule at the new rate
    this._clearInterval();
    this._scheduleInterval();
  }

  /** Process exactly one tick and emit events.  Called by the interval. */
  tick(): void {
    // Snapshot ship list and fleet membership before the tick so we can look
    // up pre-battle data when building battle result details.
    const prevShipIds = new Set(this.tickState.gameState.ships.map(s => s.id));
    const prevShips = [...this.tickState.gameState.ships];
    const prevFleets = [...this.tickState.gameState.fleets];

    let newState: GameTickState;
    let events: GameEvent[];
    const playerEmpire = this.tickState.gameState.empires.find(e => !e.isAI);
    try {
      const result = processGameTick(this.tickState, UNIVERSAL_TECHNOLOGIES, playerEmpire?.id);
      newState = result.newState;
      events = result.events;
    } catch (err) {
      // CRITICAL: If processGameTick throws, the tick state must still
      // advance the tick counter so the game doesn't freeze.  Log the
      // error so it can be diagnosed, but keep the game running.
      console.error('[GameEngine.tick] processGameTick threw — tick skipped:', err);
      this.tickState = {
        ...this.tickState,
        gameState: {
          ...this.tickState.gameState,
          currentTick: this.tickState.gameState.currentTick + 1,
        },
      };
      // Still emit the tick event so the UI updates
      this.game.events.emit('engine:tick', { tick: this.tickState.gameState.currentTick });
      return;
    }
    this.tickState = newState;

    // ── Check for deferred player combats ────────────────────────────────────
    if (newState.pendingCombats.length > 0 && playerEmpire) {
      const combat = newState.pendingCombats[0]!;
      const attackerFleet = newState.gameState.fleets.find(f => f.id === combat.attackerFleetId);
      const defenderFleet = newState.gameState.fleets.find(f => f.id === combat.defenderFleetId);

      if (attackerFleet && defenderFleet) {
        this._clearInterval();
        this.running = false;

        const attackerShips = newState.gameState.ships.filter(s => attackerFleet.ships.includes(s.id));
        const defenderShips = newState.gameState.ships.filter(s => defenderFleet.ships.includes(s.id));

        const attackerEmpire = newState.gameState.empires.find(e => e.id === attackerFleet.empireId);
        const defenderEmpire = newState.gameState.empires.find(e => e.id === defenderFleet.empireId);

        // Determine combat layout — planetary assault if defender orbits a planet
        let layout: 'open_space' | 'planetary_assault' = 'open_space';
        let planetData: { name: string; type: string; defenceRating: number; shieldActive: boolean; orbitalGuns: number } | undefined;

        const defenderOrbitTarget = defenderFleet.orbitTarget;
        if (defenderOrbitTarget && defenderOrbitTarget !== 'star') {
          const system = newState.gameState.galaxy.systems.find(s => s.id === combat.systemId);
          const planet = system?.planets.find(p => p.id === defenderOrbitTarget);
          if (planet) {
            layout = 'planetary_assault';
            const defenseGrids = planet.buildings.filter(b => b.type === 'defense_grid');
            const orbitalGuns = defenseGrids.length;
            const defenceRating = defenseGrids.reduce((sum, b) => sum + b.level, 0);
            planetData = {
              name: planet.name,
              type: planet.type,
              defenceRating,
              shieldActive: false,
              orbitalGuns: Math.max(1, orbitalGuns),
            };
          }
        }

        this.game.events.emit('engine:combat_pending', {
          systemId: combat.systemId,
          attackerFleet,
          defenderFleet,
          attackerShips,
          defenderShips,
          designs: newState.shipDesigns ?? new Map(),
          components: newState.shipComponents ?? [],
          playerEmpireId: playerEmpire.id,
          attackerName: attackerEmpire?.name ?? 'Unknown',
          defenderName: defenderEmpire?.name ?? 'Unknown',
          attackerColor: attackerEmpire?.color ?? '#ff0000',
          defenderColor: defenderEmpire?.color ?? '#0000ff',
          isPlayerAttacker: attackerFleet.empireId === playerEmpire.id,
          enemyInitiated: defenderFleet.stance === 'aggressive' || attackerFleet.stance === 'aggressive',
          layout,
          planetData,
        });
        return; // Don't continue normal tick processing
      }
    }

    // ── Emit per-event notifications ────────────────────────────────────────
    for (const event of events) {
      switch (event.type) {
        case 'FleetMoved':
          this.game.events.emit('engine:fleet_moved', event as FleetMovedEvent);
          break;
        case 'CombatResolved': {
          const combatEvent = event as CombatResolvedEvent;
          this.game.events.emit('engine:combat_resolved', combatEvent);

          // Only pause and show battle results if the player was involved
          const playerInvolved = playerEmpire && (
            combatEvent.winnerEmpireId === playerEmpire.id ||
            combatEvent.casualties.some(c => {
              const fleet = prevFleets.find(f => f.id === c.fleetId);
              return fleet?.empireId === playerEmpire.id;
            })
          );
          if (playerInvolved) {
            this._clearInterval();
            this.running = false;
            const battleData = this._buildBattleResultData(combatEvent, prevShips, prevFleets);
            this.game.events.emit('engine:battle_resolved', battleData);
          }
          break;
        }
        case 'TechResearched':
          this.game.events.emit('engine:tech_researched', event as TechResearchedEvent);
          break;
        case 'ColonyEstablished': {
          const ce = event as ColonyEstablishedEvent;
          this.game.events.emit('engine:planet_colonised', {
            planetName: ce.planetName,
            systemId: ce.systemId,
            planetId: ce.planetId,
          });
          break;
        }
        default:
          break;
      }
    }

    // ── Emit espionage state so the UI stays in sync ─────────────────────
    this.game.events.emit('engine:espionage_updated', {
      espionageState: this.tickState.espionageState,
      espionageEventLog: this.tickState.espionageEventLog,
    });

    // ── Emit ship-produced notifications for each newly spawned ship ────────
    for (const ship of this.tickState.gameState.ships) {
      if (!prevShipIds.has(ship.id)) {
        const systemId = ship.position.systemId;
        this.game.events.emit('engine:ship_produced', {
          shipName: ship.name,
          systemId,
        });
      }
    }

    // ── Emit aggregate tick notification ────────────────────────────────────
    this.game.events.emit('engine:tick', { tick: this.tickState.gameState.currentTick });

    // ── Emit per-empire resource updates (full stockpile) ─────────────────
    const resourceUpdates = this.tickState.gameState.empires.map(e => {
      const full = this.tickState.empireResourcesMap.get(e.id);
      return {
        empireId: e.id,
        credits: full?.credits ?? e.credits,
        minerals: full?.minerals ?? 0,
        energy: full?.energy ?? 0,
        organics: full?.organics ?? 0,
        rareElements: full?.rareElements ?? 0,
        exoticMaterials: full?.exoticMaterials ?? 0,
        faith: full?.faith ?? 0,
        researchPoints: full?.researchPoints ?? e.researchPoints,
      };
    });
    this.game.events.emit('engine:resources_updated', resourceUpdates);

    // ── Emit player empire's research state so React screen stays in sync ───
    const playerEmpireForResearch = this.tickState.gameState.empires.find(e => !e.isAI);
    if (playerEmpireForResearch) {
      const playerResearchState = this.tickState.researchStates.get(playerEmpireForResearch.id);
      if (playerResearchState) {
        this.game.events.emit('engine:research_state', playerResearchState);

        // Check if a tech completed this tick and the queue is now empty
        const techCompleted = events.some(e => e.type === 'TechResearched');
        if (techCompleted
          && playerResearchState.activeResearch.length === 0
          && (playerResearchState.researchQueue ?? []).length === 0) {
          this.game.events.emit('engine:notification', createNotification(
            'no_active_research',
            'Research Queue Empty',
            'All research projects have been completed and the queue is empty. Select new technologies to research.',
            this.tickState.gameState.currentTick,
            [{ id: 'open_research', label: 'Open Research' }],
          ));
        }
      }
    }

    // ── Emit galaxy snapshot so the minimap can refresh ─────────────────────
    this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);

    // ── Process active migrations and emit wave events ───────────────────────
    // Each wave gradually moves population: source loses dispatched, target gains survivors.
    const waveEvents = tickMigrations();
    for (const evt of waveEvents) {
      const mig = evt.migration;
      const dispatched = evt.colonistsDispatched;
      const arrived = dispatched - Math.round(dispatched * 0.05); // approx — actual mortality tracked in migration

      // Deduct from source planet, add to target planet (gradual transfer)
      const systems = this.tickState.gameState.galaxy.systems;
      const sysIdx = systems.findIndex(s => s.id === mig.systemId);
      if (sysIdx >= 0) {
        const sys = systems[sysIdx]!;
        const updatedPlanets = sys.planets.map(p => {
          if (p.id === mig.sourcePlanetId) {
            // Source loses dispatched colonists
            return { ...p, currentPopulation: Math.max(0, p.currentPopulation - dispatched) };
          }
          if (p.id === mig.targetPlanetId && p.ownerId === mig.empireId) {
            // Target gains survivors (only if already colonised)
            return { ...p, currentPopulation: p.currentPopulation + arrived };
          }
          return p;
        });
        const updatedSystems = [...systems];
        updatedSystems[sysIdx] = { ...sys, planets: updatedPlanets };
        this.tickState = {
          ...this.tickState,
          gameState: {
            ...this.tickState.gameState,
            galaxy: { ...this.tickState.gameState.galaxy, systems: updatedSystems },
          },
        };
      }

      this.game.events.emit('engine:migration_wave', {
        migration: mig,
        waveNumber: evt.waveNumber,
        colonistsDispatched: dispatched,
      });
      if (mig.status === 'completed') {
        // If target planet isn't colonised yet (first migration), establish the colony.
        // We set ownerId and add a starter building directly rather than calling
        // colonisePlanet(), because that method's validation rejects planets that
        // already have population (which the migration waves have already transferred).
        const completedSystems = this.tickState.gameState.galaxy.systems;
        const targetSys = completedSystems.find(s => s.id === mig.systemId);
        const targetPlanet = targetSys?.planets.find(p => p.id === mig.targetPlanetId);
        if (targetPlanet && targetPlanet.ownerId === null && targetSys) {
          const starterBuilding = {
            id: `bld-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'population_center' as BuildingType,
            level: 1,
          };
          const colonisedPlanet = {
            ...targetPlanet,
            ownerId: mig.empireId,
            buildings: [...targetPlanet.buildings, starterBuilding],
          };
          const patchedPlanets = targetSys.planets.map(p =>
            p.id === mig.targetPlanetId ? colonisedPlanet : p,
          );
          const patchedSystem = {
            ...targetSys,
            planets: patchedPlanets,
            ownerId: targetSys.ownerId ?? mig.empireId,
          };
          const patchedSystems = completedSystems.map(s =>
            s.id === mig.systemId ? patchedSystem : s,
          );
          this.tickState = {
            ...this.tickState,
            gameState: {
              ...this.tickState.gameState,
              galaxy: { ...this.tickState.gameState.galaxy, systems: patchedSystems },
            },
          };

          // Emit colonisation events so the UI refreshes
          this.game.events.emit('engine:planet_updated', { systemId: mig.systemId, planet: colonisedPlanet });
          this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);
          this.game.events.emit('engine:planet_colonised', {
            planetName: colonisedPlanet.name,
            systemId: mig.systemId,
            planetId: mig.targetPlanetId,
          });
        }
        this.game.events.emit('engine:migration_completed', mig);
      }
    }
    // Broadcast updated migration list so React stays in sync
    this.game.events.emit('engine:migrations_updated', getMigrationOrders());

    // ── Auto-save (time-based, every 60 seconds of real time) ──────────────
    try {
      getSaveManager().autoSave(this.tickState);
    } catch {
      // Auto-save failures are non-fatal; silently swallow.
    }

    // ── Game-over check ──────────────────────────────────────────────────────
    if (this.tickState.gameState.status === 'finished') {
      this._clearInterval();
      this.running = false;
      // Extract winner info from the GameOver event emitted by the game loop
      const gameOverEvt = events.find(e => e.type === 'GameOver') as
        | { type: 'GameOver'; winnerEmpireId: string; victoryCriteria: string; tick: number }
        | undefined;
      this.game.events.emit('engine:game_over', {
        winnerId: gameOverEvt?.winnerEmpireId,
        reason: gameOverEvt?.victoryCriteria ?? 'finished',
      });
    }
  }

  /**
   * Attempt to queue a building on a planet.
   *
   * Validates that:
   *  - The system and planet exist in the current tick state.
   *  - The player's empire owns the planet.
   *  - The build is allowed (slots, prerequisites) via canBuildOnPlanet.
   *  - The empire can afford the building cost.
   *
   * If all checks pass, deducts resources from the empire and appends the
   * building to the planet's production queue.
   *
   * Emits `engine:planet_updated` with the updated Planet on success.
   *
   * @returns true if the build was queued, false otherwise.
   */
  buildOnPlanet(systemId: string, planetId: string, buildingType: BuildingType, targetZone: 'surface' | 'orbital' | 'underground' = 'surface'): boolean {
    const galaxy = this.tickState.gameState.galaxy;

    // Locate the system
    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.buildOnPlanet] System "${systemId}" not found`);
      return false;
    }

    // Locate the planet
    const planet = system.planets.find(p => p.id === planetId);
    if (!planet) {
      console.warn(`[GameEngine.buildOnPlanet] Planet "${planetId}" not found in system "${systemId}"`);
      return false;
    }

    // Locate the owning empire
    const empire = this.tickState.gameState.empires.find(e => e.id === planet.ownerId);
    if (!empire) {
      console.warn(`[GameEngine.buildOnPlanet] Planet "${planetId}" has no owning empire`);
      return false;
    }

    // Retrieve researched tech IDs so building tech gates are enforced.
    const empireResearchState = this.tickState.researchStates.get(empire.id);
    const empireTechs = empireResearchState?.completedTechs ?? [];

    // Validate build is allowed
    const buildCheck = canBuildOnPlanet(planet, buildingType, undefined, empireTechs, targetZone);
    if (!buildCheck.allowed) {
      console.warn(`[GameEngine.buildOnPlanet] Build not allowed: ${buildCheck.reason}`);
      return false;
    }

    // Check affordability against full resource stockpile (with zone cost multiplier)
    const def = BUILDING_DEFINITIONS[buildingType];
    const costMultiplier = ZONE_COST_MULTIPLIER[targetZone] ?? 1;
    const currentResources = this.tickState.empireResourcesMap.get(empire.id);
    if (!currentResources) {
      console.warn(`[GameEngine.buildOnPlanet] No resource stockpile for empire "${empire.id}"`);
      return false;
    }
    for (const [resource, required] of Object.entries(def.baseCost)) {
      const scaledCost = (required ?? 0) * costMultiplier;
      const available = currentResources[resource as keyof typeof currentResources] ?? 0;
      if (available < scaledCost) {
        console.warn(`[GameEngine.buildOnPlanet] Cannot afford ${buildingType}: need ${scaledCost} ${resource}, have ${available}`);
        return false;
      }
    }

    // Deduct costs from resource stockpile (with zone cost multiplier)
    const updatedResources = { ...currentResources };
    for (const [resource, required] of Object.entries(def.baseCost)) {
      const key = resource as keyof typeof updatedResources;
      updatedResources[key] = (updatedResources[key] ?? 0) - (required ?? 0) * costMultiplier;
    }
    const updatedResourcesMap = new Map(this.tickState.empireResourcesMap);
    updatedResourcesMap.set(empire.id, updatedResources);

    // Also update empire credits/researchPoints for consistency
    const updatedEmpire = {
      ...empire,
      credits: updatedResources.credits,
      researchPoints: updatedResources.researchPoints,
    };

    // Add building to the planet's production queue (pure — returns new Planet)
    const updatedPlanet = addBuildingToQueue(planet, buildingType, undefined, empireTechs, targetZone);

    // Splice the updated planet back into the galaxy
    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return {
        ...s,
        planets: s.planets.map(p => (p.id === planetId ? updatedPlanet : p)),
      };
    });

    // Splice the updated empire back
    const updatedEmpires = this.tickState.gameState.empires.map(e =>
      e.id === empire.id ? updatedEmpire : e,
    );

    // Commit new state
    this.tickState = {
      ...this.tickState,
      empireResourcesMap: updatedResourcesMap,
      gameState: {
        ...this.tickState.gameState,
        galaxy: { ...galaxy, systems: updatedSystems },
        empires: updatedEmpires,
      },
    };

    // Notify listeners
    this.game.events.emit('engine:planet_updated', { systemId, planet: updatedPlanet });

    return true;
  }

  /**
   * Queue a building upgrade on a planet.
   *
   * Validates that:
   *  - The system and planet exist.
   *  - The planet has an owning empire.
   *  - The building can be upgraded (canUpgradeBuilding).
   *  - The empire can afford the upgrade cost.
   *
   * Deducts the upgrade cost from the empire's resource stockpile, adds the
   * upgrade to the planet's construction queue, and commits new state.
   *
   * Emits `engine:planet_updated` with the updated Planet on success.
   *
   * @returns true if the upgrade was queued, false otherwise.
   */
  upgradeBuildingOnPlanet(systemId: string, planetId: string, buildingId: string): boolean {
    const galaxy = this.tickState.gameState.galaxy;

    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] System "${systemId}" not found`);
      return false;
    }

    const planet = system.planets.find(p => p.id === planetId);
    if (!planet) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] Planet "${planetId}" not found`);
      return false;
    }

    const empire = this.tickState.gameState.empires.find(e => e.id === planet.ownerId);
    if (!empire) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] Planet "${planetId}" has no owning empire`);
      return false;
    }

    const currentAge = empire.currentAge ?? 'nano_atomic';
    const upgradeCheck = canUpgradeBuilding(planet, buildingId, currentAge);
    if (!upgradeCheck.allowed) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] Upgrade not allowed: ${upgradeCheck.reason}`);
      return false;
    }

    const building = planet.buildings.find(b => b.id === buildingId)!;
    const upgradeCost = getUpgradeCost(building.type, building.level);

    const currentResources = this.tickState.empireResourcesMap.get(empire.id);
    if (!currentResources) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] No resource stockpile for empire "${empire.id}"`);
      return false;
    }
    for (const [resource, required] of Object.entries(upgradeCost)) {
      const available = currentResources[resource as keyof typeof currentResources] ?? 0;
      if (available < (required ?? 0)) {
        console.warn(`[GameEngine.upgradeBuildingOnPlanet] Cannot afford upgrade: need ${required} ${resource}, have ${available}`);
        return false;
      }
    }

    const updatedResources = { ...currentResources };
    for (const [resource, required] of Object.entries(upgradeCost)) {
      const key = resource as keyof typeof updatedResources;
      updatedResources[key] = (updatedResources[key] ?? 0) - (required ?? 0);
    }
    const updatedResourcesMap = new Map(this.tickState.empireResourcesMap);
    updatedResourcesMap.set(empire.id, updatedResources);

    const updatedEmpire = {
      ...empire,
      credits: updatedResources.credits,
      researchPoints: updatedResources.researchPoints,
    };

    const updatedPlanet = addUpgradeToQueue(planet, buildingId, currentAge);

    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return { ...s, planets: s.planets.map(p => (p.id === planetId ? updatedPlanet : p)) };
    });

    this.tickState = {
      ...this.tickState,
      empireResourcesMap: updatedResourcesMap,
      gameState: {
        ...this.tickState.gameState,
        empires: this.tickState.gameState.empires.map(e => (e.id === empire.id ? updatedEmpire : e)),
        galaxy: { ...galaxy, systems: updatedSystems },
      },
    };

    this.game.events.emit('engine:planet_updated', { systemId, planet: updatedPlanet });
    return true;
  }

  /**
   * Queue a ship for production on a planet that has a shipyard.
   *
   * Validates that:
   *  - The system and planet exist.
   *  - The planet has a shipyard building.
   *  - The provided design is known (passed in by the caller).
   *  - The empire can afford the hull's base cost in credits.
   *
   * Deducts the hull cost from the empire's resource stockpile and adds a
   * ShipProductionOrder to the tick state so the game loop can complete it.
   *
   * Build time = Math.max(1, Math.round(hull.baseCost / 100)) turns.
   *
   * Emits `engine:planet_updated` with the planet (unchanged, so the UI knows
   * the order was accepted).
   *
   * @returns true if the order was accepted, false otherwise.
   */
  produceShip(systemId: string, planetId: string, design: ShipDesign): boolean {
    const galaxy = this.tickState.gameState.galaxy;

    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.produceShip] System "${systemId}" not found`);
      return false;
    }

    const planet = system.planets.find(p => p.id === planetId);
    if (!planet) {
      console.warn(`[GameEngine.produceShip] Planet "${planetId}" not found in system "${systemId}"`);
      return false;
    }

    // Validate planet is owned
    const empire = this.tickState.gameState.empires.find(e => e.id === planet.ownerId);
    if (!empire) {
      console.warn(`[GameEngine.produceShip] Planet "${planetId}" has no owning empire`);
      return false;
    }

    // Validate shipyard exists
    const hasShipyard = planet.buildings.some(b => b.type === 'shipyard');
    if (!hasShipyard) {
      console.warn(`[GameEngine.produceShip] Planet "${planetId}" has no shipyard`);
      return false;
    }

    // Look up hull template
    const hull = HULL_TEMPLATE_BY_CLASS[design.hull];
    if (!hull) {
      console.warn(`[GameEngine.produceShip] Unknown hull class "${design.hull}"`);
      return false;
    }

    // Check affordability
    const currentResources = this.tickState.empireResourcesMap.get(empire.id);
    if (!currentResources) {
      console.warn(`[GameEngine.produceShip] No resource stockpile for empire "${empire.id}"`);
      return false;
    }
    if (currentResources.credits < hull.baseCost) {
      console.warn(
        `[GameEngine.produceShip] Cannot afford ship: need ${hull.baseCost} credits, have ${currentResources.credits}`,
      );
      return false;
    }

    // Deduct hull cost
    const updatedResources = { ...currentResources, credits: currentResources.credits - hull.baseCost };
    const updatedResourcesMap = new Map(this.tickState.empireResourcesMap);
    updatedResourcesMap.set(empire.id, updatedResources);

    const updatedEmpire = { ...empire, credits: updatedResources.credits };
    const updatedEmpires = this.tickState.gameState.empires.map(e =>
      e.id === empire.id ? updatedEmpire : e,
    );

    // Build time: baseCost / 100, minimum 1 turn
    const buildTime = Math.max(1, Math.round(hull.baseCost / 100));

    // Create production order (drives actual ship creation via the game loop)
    const order = startShipProduction(design.id, planetId, buildTime);

    // Also add a 'ship' entry to the planet's productionQueue so the
    // management screen can display progress alongside building items.
    const updatedPlanet = {
      ...planet,
      productionQueue: [
        ...planet.productionQueue,
        { type: 'ship' as const, templateId: design.id, turnsRemaining: buildTime },
      ],
    };

    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return {
        ...s,
        planets: s.planets.map(p => (p.id === planetId ? updatedPlanet : p)),
      };
    });

    // Register the design in the tick state's shipDesigns map so the game loop
    // can look up hull points when the ship completes
    const updatedDesigns = new Map(this.tickState.shipDesigns ?? []);
    updatedDesigns.set(design.id, design);

    // Commit new state
    this.tickState = {
      ...this.tickState,
      empireResourcesMap: updatedResourcesMap,
      productionOrders: [...this.tickState.productionOrders, order],
      shipDesigns: updatedDesigns,
      gameState: {
        ...this.tickState.gameState,
        empires: updatedEmpires,
        galaxy: { ...galaxy, systems: updatedSystems },
      },
    };

    // Notify listeners — emit resources update so TopBar refreshes
    const resourceUpdates = this.tickState.gameState.empires.map(e => {
      const full = this.tickState.empireResourcesMap.get(e.id);
      return {
        empireId: e.id,
        credits: full?.credits ?? e.credits,
        minerals: full?.minerals ?? 0,
        energy: full?.energy ?? 0,
        organics: full?.organics ?? 0,
        rareElements: full?.rareElements ?? 0,
        exoticMaterials: full?.exoticMaterials ?? 0,
        faith: full?.faith ?? 0,
        researchPoints: full?.researchPoints ?? e.researchPoints,
      };
    });
    this.game.events.emit('engine:resources_updated', resourceUpdates);
    this.game.events.emit('engine:planet_updated', { systemId, planet: updatedPlanet });

    return true;
  }

  /**
   * Cancel a queued construction item by index.
   *
   * The item is removed from the planet's productionQueue and the planet
   * updated in the tick state.
   *
   * Emits `engine:planet_updated` with the updated Planet on success.
   *
   * @returns true if the item was cancelled, false otherwise.
   */
  cancelConstruction(systemId: string, planetId: string, queueIndex: number): boolean {
    const galaxy = this.tickState.gameState.galaxy;

    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.cancelConstruction] System "${systemId}" not found`);
      return false;
    }

    const planet = system.planets.find(p => p.id === planetId);
    if (!planet) {
      console.warn(`[GameEngine.cancelConstruction] Planet "${planetId}" not found`);
      return false;
    }

    if (queueIndex < 0 || queueIndex >= planet.productionQueue.length) {
      console.warn(`[GameEngine.cancelConstruction] Queue index ${queueIndex} out of range`);
      return false;
    }

    const updatedQueue = planet.productionQueue.filter((_, i) => i !== queueIndex);
    const updatedPlanet = { ...planet, productionQueue: updatedQueue };

    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return {
        ...s,
        planets: s.planets.map(p => (p.id === planetId ? updatedPlanet : p)),
      };
    });

    this.tickState = {
      ...this.tickState,
      gameState: {
        ...this.tickState.gameState,
        galaxy: { ...galaxy, systems: updatedSystems },
      },
    };

    this.game.events.emit('engine:planet_updated', { systemId, planet: updatedPlanet });

    return true;
  }

  /**
   * Demolish (remove) a building from a planet.
   *
   * Validates that:
   *  - The system and planet exist in the current tick state.
   *  - The building exists on the planet.
   *
   * Uses the shared `demolishBuilding` pure function to produce the updated
   * planet, then splices it back into the galaxy.
   *
   * Emits `engine:planet_updated` with the updated Planet on success.
   *
   * @returns true if the building was demolished, false otherwise.
   */
  demolishBuildingOnPlanet(systemId: string, planetId: string, buildingId: string): boolean {
    const galaxy = this.tickState.gameState.galaxy;

    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.demolishBuildingOnPlanet] System "${systemId}" not found`);
      return false;
    }

    const planet = system.planets.find(p => p.id === planetId);
    if (!planet) {
      console.warn(`[GameEngine.demolishBuildingOnPlanet] Planet "${planetId}" not found in system "${systemId}"`);
      return false;
    }

    const buildingExists = planet.buildings.some(b => b.id === buildingId);
    if (!buildingExists) {
      console.warn(`[GameEngine.demolishBuildingOnPlanet] Building "${buildingId}" not found on planet "${planetId}"`);
      return false;
    }

    const updatedPlanet = demolishBuilding(planet, buildingId);

    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return {
        ...s,
        planets: s.planets.map(p => (p.id === planetId ? updatedPlanet : p)),
      };
    });

    this.tickState = {
      ...this.tickState,
      gameState: {
        ...this.tickState.gameState,
        galaxy: { ...galaxy, systems: updatedSystems },
      },
    };

    this.game.events.emit('engine:planet_updated', { systemId, planet: updatedPlanet });

    return true;
  }

  /**
   * Colonise an unowned planet on behalf of an empire.
   *
   * Validates species compatibility, credits, minerals, and source population
   * before executing colonisation.  Deducts costs and emits
   * `engine:planet_colonised` on success.
   *
   * @returns true if colonisation succeeded, false otherwise.
   */
  colonisePlanet(systemId: string, planetId: string, empireId: string): boolean {
    const BASE_COLONISE_COST = 10_000;

    const galaxy = this.tickState.gameState.galaxy;

    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.colonisePlanet] System "${systemId}" not found`);
      return false;
    }

    const planet = system.planets.find(p => p.id === planetId);
    if (!planet) {
      console.warn(`[GameEngine.colonisePlanet] Planet "${planetId}" not found`);
      return false;
    }

    const empire = this.tickState.gameState.empires.find(e => e.id === empireId);
    if (!empire) {
      console.warn(`[GameEngine.colonisePlanet] Empire "${empireId}" not found`);
      return false;
    }

    // Species compatibility check
    const colonizeCheck = canColonize(planet, empire.species);
    if (!colonizeCheck.allowed) {
      console.warn(`[GameEngine.colonisePlanet] Cannot colonise: ${colonizeCheck.reason}`);
      return false;
    }

    // Affordability check — credits
    if (empire.credits < BASE_COLONISE_COST) {
      console.warn(
        `[GameEngine.colonisePlanet] Insufficient credits (have ${empire.credits}, need ${BASE_COLONISE_COST})`,
      );
      return false;
    }

    // Affordability check — minerals
    const empRes = this.tickState.empireResourcesMap.get(empireId);
    const empireMinerals = empRes?.minerals ?? 0;
    if (empireMinerals < COLONISATION_MINERAL_COST) {
      console.warn(
        `[GameEngine.colonisePlanet] Insufficient minerals (have ${empireMinerals}, need ${COLONISATION_MINERAL_COST})`,
      );
      return false;
    }

    // Source planet population check
    const sourcePlanet = system.planets
      .filter(p => p.ownerId === empireId && p.id !== planetId)
      .sort((a, b) => b.currentPopulation - a.currentPopulation)[0];
    if (!sourcePlanet || sourcePlanet.currentPopulation < COLONIST_TRANSFER_COUNT) {
      console.warn(
        `[GameEngine.colonisePlanet] Source planet needs at least ${COLONIST_TRANSFER_COUNT} population`,
      );
      return false;
    }

    // Execute colonisation (transfers population, applies mortality, creates colony)
    const { system: updatedSystem, mortalityCount } = coloniseInSystem(system, planetId, empireId);

    const finalPlanet = updatedSystem.planets.find(p => p.id === planetId)!;

    // Deduct credits
    const updatedEmpire = { ...empire, credits: empire.credits - BASE_COLONISE_COST };

    // Splice updated system back into the galaxy
    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return {
        ...updatedSystem,
        // Claim the system if previously unclaimed
        ownerId: updatedSystem.ownerId ?? empireId,
      };
    });

    const updatedEmpires = this.tickState.gameState.empires.map(e =>
      e.id === empireId ? updatedEmpire : e,
    );

    // Deduct minerals from resource map
    const newResMap = new Map(this.tickState.empireResourcesMap);
    if (empRes) {
      newResMap.set(empireId, {
        ...empRes,
        credits: empRes.credits - BASE_COLONISE_COST,
        minerals: empRes.minerals - COLONISATION_MINERAL_COST,
      });
    }

    this.tickState = {
      ...this.tickState,
      empireResourcesMap: newResMap,
      gameState: {
        ...this.tickState.gameState,
        galaxy: { ...galaxy, systems: updatedSystems },
        empires: updatedEmpires,
      },
    };

    if (mortalityCount > 0) {
      console.log(`[GameEngine.colonisePlanet] ${mortalityCount} colonists lost during transfer to ${finalPlanet.name}`);
    }

    // Emit notifications
    this.game.events.emit('engine:planet_updated', { systemId, planet: finalPlanet });
    this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);
    this.game.events.emit('engine:planet_colonised', {
      planetName: finalPlanet.name,
      systemId,
      planetId,
    });
    // Refresh credits in the TopBar immediately
    const resourceUpdates = this.tickState.gameState.empires.map(e => ({
      empireId: e.id,
      credits: e.credits,
      researchPoints: e.researchPoints,
    }));
    this.game.events.emit('engine:resources_updated', resourceUpdates);

    return true;
  }

  /**
   * Dispatch a generic game action.
   *
   * Handles `ColonisePlanet` actions immediately.  Other action types may be
   * added here as the shared engine evolves.
   *
   * This is the canonical entry point for React/Phaser-driven game mutations
   * so that individual scenes don't need their own dispatch logic.
   */
  executeAction(action: { type: string; [key: string]: unknown }): void {
    switch (action.type) {
      case 'ColonisePlanet': {
        const { empireId, systemId, planetId } = action as {
          type: string;
          empireId: string;
          systemId: string;
          planetId: string;
        };
        this.colonisePlanet(systemId, planetId, empireId);
        break;
      }
      case 'ColonizePlanet': {
        // Fleet-based inter-system colonisation via colony ship.
        // Push onto pendingActions so the shared game loop processes it next tick.
        const fleetId = action.fleetId as string;
        const planetId = action.planetId as string;
        const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
        if (!fleet) {
          console.warn(`[GameEngine.executeAction] Fleet "${fleetId}" not found for ColonizePlanet`);
          break;
        }
        this.tickState = {
          ...this.tickState,
          pendingActions: [
            ...this.tickState.pendingActions,
            {
              empireId: fleet.empireId,
              action: { type: 'ColonizePlanet' as const, fleetId, planetId },
              tick: this.tickState.gameState.currentTick,
            },
          ],
        };
        break;
      }
      default:
        console.warn(`[GameEngine.executeAction] Unknown action type: ${action.type}`);
        break;
    }
  }

  /**
   * Start a multi-turn migration from sourcePlanetId to targetPlanetId.
   *
   * Validates that:
   *  - The system and both planets exist.
   *  - The source planet is owned by the empire.
   *  - The target planet is unowned.
   *  - No migration is already active for the target planet.
   *
   * Emits 'engine:migration_started' on success.
   *
   * @returns true if the migration was started, false otherwise.
   */
  startMigration(systemId: string, sourcePlanetId: string, targetPlanetId: string): boolean {
    const galaxy = this.tickState.gameState.galaxy;

    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.startMigration] System "${systemId}" not found`);
      return false;
    }

    const sourcePlanet = system.planets.find(p => p.id === sourcePlanetId);
    if (!sourcePlanet) {
      console.warn(`[GameEngine.startMigration] Source planet "${sourcePlanetId}" not found`);
      return false;
    }

    const targetPlanet = system.planets.find(p => p.id === targetPlanetId);
    if (!targetPlanet) {
      console.warn(`[GameEngine.startMigration] Target planet "${targetPlanetId}" not found`);
      return false;
    }

    if (!sourcePlanet.ownerId) {
      console.warn('[GameEngine.startMigration] Source planet has no owner');
      return false;
    }

    if (targetPlanet.ownerId !== null) {
      console.warn('[GameEngine.startMigration] Target planet is already owned');
      return false;
    }

    const order = createMigrationOrder(systemId, sourcePlanetId, targetPlanetId, sourcePlanet.ownerId);
    if (!order) {
      console.warn('[GameEngine.startMigration] Migration already active for target planet');
      return false;
    }

    this.game.events.emit('engine:migration_started', order);
    // Broadcast updated list
    this.game.events.emit('engine:migrations_updated', getMigrationOrders());
    return true;
  }

  /**
   * Cancel an active migration targeting the given planet.
   *
   * Emits 'engine:migration_cancelled' on success.
   *
   * @returns true if a migration was found and cancelled, false otherwise.
   */
  stopMigration(targetPlanetId: string): boolean {
    const cancelled = cancelMigration(targetPlanetId);
    if (cancelled) {
      this.game.events.emit('engine:migration_cancelled', { targetPlanetId });
      this.game.events.emit('engine:migrations_updated', getMigrationOrders());
    }
    return cancelled;
  }

  /**
   * Returns all active (in_progress) migration orders, optionally filtered by
   * system ID.
   *
   * This is used by SystemViewScene to determine which ship animations to show
   * and by React components to display migration status.
   */
  getActiveMigrations(systemId?: string): MigrationOrder[] {
    return getMigrationOrders(systemId);
  }

  /**
   * Issue a movement order to move a fleet from its current position to
   * destinationSystemId along the wormhole network.
   *
   * Uses issueMovementOrder from shared/engine/fleet.ts to plan the route via
   * A* pathfinding, then appends the order to tickState.movementOrders so the
   * game loop will process it each tick.
   *
   * Emits 'engine:fleet_moved' events as the fleet arrives at each hop.
   *
   * @returns true if the order was accepted, false if the fleet was not found,
   *          was already at the destination, or no path could be found.
   */
  moveFleet(fleetId: string, destinationSystemId: string): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) {
      console.warn(`[GameEngine.moveFleet] Fleet "${fleetId}" not found`);
      return false;
    }

    if (fleet.position.systemId === destinationSystemId) {
      console.warn(`[GameEngine.moveFleet] Fleet "${fleetId}" is already at "${destinationSystemId}"`);
      return false;
    }

    const galaxy = this.tickState.gameState.galaxy;

    // Determine travel mode from the empire's researched technologies
    const empire = this.tickState.gameState.empires.find(e => e.id === fleet.empireId);
    const empireTechs = empire?.technologies ?? [];

    const order = issueMovementOrder(fleet, galaxy, destinationSystemId, undefined, empireTechs);
    if (!order) {
      console.warn(`[GameEngine.moveFleet] No path from "${fleet.position.systemId}" to "${destinationSystemId}"`);
      return false;
    }

    // Remove any existing order for this fleet, then add the new one
    const filteredOrders = this.tickState.movementOrders.filter(o => o.fleetId !== fleetId);

    // Update the fleet's destination field so the UI can show it immediately
    const updatedFleet = { ...fleet, destination: destinationSystemId };
    const updatedFleets = this.tickState.gameState.fleets.map(f =>
      f.id === fleetId ? updatedFleet : f,
    );

    this.tickState = {
      ...this.tickState,
      movementOrders: [...filteredOrders, order],
      gameState: {
        ...this.tickState.gameState,
        fleets: updatedFleets,
      },
    };

    // Notify React so the fleet screen updates immediately
    this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);

    // Notify audio / SFX listeners that a movement order has been issued
    this.game.events.emit('engine:fleet_order_issued', { fleetId });

    return true;
  }

  /**
   * Queue an additional waypoint for a fleet without replacing its current
   * movement order.  If the fleet is idle, start moving to the new waypoint
   * immediately.
   *
   * @returns true if the waypoint was accepted.
   */
  addWaypoint(fleetId: string, systemId: string): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) return false;

    const updatedWaypoints = [...fleet.waypoints, systemId];
    const updatedFleet = { ...fleet, waypoints: updatedWaypoints };

    // If patrol mode is on, also update the stored patrol route
    if (fleet.patrolling) {
      updatedFleet.patrolRoute = [...updatedWaypoints];
    }

    const updatedFleets = this.tickState.gameState.fleets.map(f =>
      f.id === fleetId ? updatedFleet : f,
    );

    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, fleets: updatedFleets },
    };

    // If fleet isn't currently moving, start moving to the first waypoint
    if (!this.tickState.movementOrders.some(o => o.fleetId === fleetId)) {
      this.moveFleet(fleetId, systemId);
    }

    return true;
  }

  /**
   * Clear all waypoints for a fleet and cancel any patrol route.
   */
  clearWaypoints(fleetId: string): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) return false;

    const updatedFleets = this.tickState.gameState.fleets.map(f =>
      f.id === fleetId ? { ...f, waypoints: [], patrolling: false, patrolRoute: undefined } : f,
    );

    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, fleets: updatedFleets },
    };

    return true;
  }

  /**
   * Toggle patrol mode for a fleet.  When enabled, the fleet will cycle
   * through its waypoints repeatedly.  The current waypoints are stored
   * as the patrol route so they can be restored after each full cycle.
   */
  setPatrolling(fleetId: string, patrolling: boolean): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) return false;

    const patrolRoute = patrolling ? [...fleet.waypoints] : undefined;
    const updatedFleets = this.tickState.gameState.fleets.map(f =>
      f.id === fleetId ? { ...f, patrolling, patrolRoute } : f,
    );

    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, fleets: updatedFleets },
    };

    return true;
  }

  /**
   * Set a fleet's orbit target — 'star' for system patrol or a planet ID
   * for defending a specific planet.
   */
  setFleetOrbitTarget(fleetId: string, orbitTarget: string): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) return false;

    const updatedFleets = this.tickState.gameState.fleets.map(f =>
      f.id === fleetId ? { ...f, orbitTarget } : f,
    );

    this.tickState = {
      ...this.tickState,
      gameState: {
        ...this.tickState.gameState,
        fleets: updatedFleets,
      },
    };

    return true;
  }

  // ── Fleet splitting ─────────────────────────────────────────────────────────

  /**
   * Split selected ships from a fleet into a new fleet.
   * Returns the new fleet ID on success, or null on failure.
   */
  splitFleet(fleetId: string, shipIds: string[]): string | null {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) {
      console.warn(`[GameEngine.splitFleet] Fleet "${fleetId}" not found`);
      return null;
    }

    try {
      const { original, newFleet } = splitFleetFn(fleet, shipIds, `${fleet.name} Detachment`);

      // Update fleet list: replace original, add new fleet
      const updatedFleets = this.tickState.gameState.fleets.map(f =>
        f.id === fleetId ? original : f,
      );
      updatedFleets.push(newFleet);

      // Update ship records: reassign fleetId for split ships
      const splitSet = new Set(shipIds);
      const updatedShips = this.tickState.gameState.ships.map(s =>
        splitSet.has(s.id) ? { ...s, fleetId: newFleet.id } : s,
      );

      this.tickState = {
        ...this.tickState,
        gameState: {
          ...this.tickState.gameState,
          fleets: updatedFleets,
          ships: updatedShips,
        },
      };

      return newFleet.id;
    } catch (err) {
      console.warn('[GameEngine.splitFleet]', (err as Error).message);
      return null;
    }
  }

  /**
   * Rename a fleet.
   */
  renameFleet(fleetId: string, name: string): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) return false;
    const updatedFleets = this.tickState.gameState.fleets.map(f =>
      f.id === fleetId ? { ...f, name } : f,
    );
    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, fleets: updatedFleets },
    };
    return true;
  }

  /**
   * Set fleet combat stance.
   */
  setFleetStance(fleetId: string, stance: string): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) return false;
    const updatedFleets = this.tickState.gameState.fleets.map(f =>
      f.id === fleetId ? { ...f, stance: stance as Fleet['stance'] } : f,
    );
    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, fleets: updatedFleets },
    };
    return true;
  }

  /**
   * Disband a fleet — removes the fleet and unassigns all its ships.
   */
  disbandFleet(fleetId: string): boolean {
    const fleet = this.tickState.gameState.fleets.find(f => f.id === fleetId);
    if (!fleet) return false;
    const updatedFleets = this.tickState.gameState.fleets.filter(f => f.id !== fleetId);
    const updatedShips = this.tickState.gameState.ships.map(s =>
      s.fleetId === fleetId ? { ...s, fleetId: null } : s,
    );
    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, fleets: updatedFleets, ships: updatedShips },
    };
    return true;
  }

  // ── Research management ────────────────────────────────────────────────────

  /**
   * Start researching a technology for the given empire.
   *
   * Returns true on success, false if the engine state cannot be found or the
   * operation throws (e.g. prerequisites not met, allocation exceeded).
   */
  startResearch(empireId: string, techId: string, allocation: number): boolean {
    const researchState = this.tickState.researchStates.get(empireId);
    if (!researchState) {
      console.warn(`[GameEngine.startResearch] No research state for empire "${empireId}"`);
      return false;
    }
    try {
      // Count research labs across all empire-owned planets
      const ownedPlanets = this.tickState.gameState.galaxy.systems
        .flatMap(s => s.planets)
        .filter(p => p.ownerId === empireId);
      const labCount = ownedPlanets.reduce((count, p) =>
        count + p.buildings.filter(b => b.type === 'research_lab').length, 0);

      const newResearchState = startResearchFn(researchState, techId, UNIVERSAL_TECHNOLOGIES, allocation, undefined, labCount);
      const newResearchStates = new Map(this.tickState.researchStates);
      newResearchStates.set(empireId, newResearchState);
      this.tickState = { ...this.tickState, researchStates: newResearchStates };
      // Immediately notify React so the screen updates without waiting for the next tick
      this.game.events.emit('engine:research_state', newResearchState);
      return true;
    } catch (err) {
      console.warn(`[GameEngine.startResearch] Failed:`, err);
      return false;
    }
  }

  /**
   * Cancel active research on a technology for the given empire.
   *
   * Returns true on success.
   */
  cancelResearch(empireId: string, techId: string): boolean {
    const researchState = this.tickState.researchStates.get(empireId);
    if (!researchState) {
      console.warn(`[GameEngine.cancelResearch] No research state for empire "${empireId}"`);
      return false;
    }
    const remaining = redistributeAllocation(
      researchState.activeResearch.filter(r => r.techId !== techId),
    );
    // Also remove from queue if it was queued
    const queue = (researchState.researchQueue ?? []).filter(id => id !== techId);
    const newResearchState: ResearchState = { ...researchState, activeResearch: remaining, researchQueue: queue };
    const newResearchStates = new Map(this.tickState.researchStates);
    newResearchStates.set(empireId, newResearchState);
    this.tickState = { ...this.tickState, researchStates: newResearchStates };
    this.game.events.emit('engine:research_state', newResearchState);
    return true;
  }

  /**
   * Add a technology to the research queue.
   * Queued techs are promoted to active when a slot opens.
   */
  queueResearch(empireId: string, techId: string): boolean {
    const researchState = this.tickState.researchStates.get(empireId);
    if (!researchState) {
      console.warn(`[GameEngine.queueResearch] No research state for empire "${empireId}"`);
      return false;
    }
    try {
      const newResearchState = queueResearchFn(researchState, techId, UNIVERSAL_TECHNOLOGIES);
      const newResearchStates = new Map(this.tickState.researchStates);
      newResearchStates.set(empireId, newResearchState);
      this.tickState = { ...this.tickState, researchStates: newResearchStates };
      this.game.events.emit('engine:research_state', newResearchState);
      return true;
    } catch (err) {
      console.warn(`[GameEngine.queueResearch] Failed:`, err);
      return false;
    }
  }

  /**
   * Remove a technology from the research queue.
   */
  dequeueResearch(empireId: string, techId: string): boolean {
    const researchState = this.tickState.researchStates.get(empireId);
    if (!researchState) return false;
    const newResearchState = dequeueResearchFn(researchState, techId);
    const newResearchStates = new Map(this.tickState.researchStates);
    newResearchStates.set(empireId, newResearchState);
    this.tickState = { ...this.tickState, researchStates: newResearchStates };
    this.game.events.emit('engine:research_state', newResearchState);
    return true;
  }

  /**
   * Adjust the allocation percentage for a single active research project.
   *
   * Returns true on success.
   */
  adjustResearchAllocation(empireId: string, techId: string, allocation: number): boolean {
    const researchState = this.tickState.researchStates.get(empireId);
    if (!researchState) {
      console.warn(`[GameEngine.adjustResearchAllocation] No research state for empire "${empireId}"`);
      return false;
    }
    try {
      const updatedAllocations = researchState.activeResearch.map(r =>
        r.techId === techId ? { techId: r.techId, allocation } : { techId: r.techId, allocation: r.allocation },
      );
      const newResearchState = setResearchAllocation(researchState, updatedAllocations);
      const newResearchStates = new Map(this.tickState.researchStates);
      newResearchStates.set(empireId, newResearchState);
      this.tickState = { ...this.tickState, researchStates: newResearchStates };
      this.game.events.emit('engine:research_state', newResearchState);
      return true;
    } catch (err) {
      console.warn(`[GameEngine.adjustResearchAllocation] Failed:`, err);
      return false;
    }
  }

  /**
   * Return the research points produced per tick for the player empire.
   *
   * This is the base production value before any species bonus is applied —
   * the species bonus is factored in by the research engine itself during
   * processResearchTick.  The ResearchScreen uses this to compute ETA.
   *
   * Returns 0 if the engine has no player empire or the player owns no planets.
   */
  getPlayerResearchProductionPerTick(): number {
    const playerEmpire = this.tickState.gameState.empires.find(e => !e.isAI);
    if (!playerEmpire) return 0;
    const ownedPlanets = this.tickState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.ownerId === playerEmpire.id);
    if (ownedPlanets.length === 0) return 0;
    const { total } = calculateEmpireProduction(ownedPlanets, playerEmpire.species, playerEmpire);
    return total.researchPoints;
  }

  /** Return the number of research labs the player empire has (= max active research slots). */
  getPlayerResearchLabCount(): number {
    const playerEmpire = this.tickState.gameState.empires.find(e => !e.isAI);
    if (!playerEmpire) return 1;
    const ownedPlanets = this.tickState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.ownerId === playerEmpire.id);
    const labCount = ownedPlanets.reduce((count, p) =>
      count + p.buildings.filter(b => b.type === 'research_lab').length, 0);
    return Math.min(Math.max(labCount, 1), 5); // at least 1, at most 5
  }

  /** Return the current tick state snapshot. */
  getState(): GameTickState {
    return this.tickState;
  }

  // ── Espionage ────────────────────────────────────────────────────────────

  /**
   * Recruit a spy agent for the player empire.
   * Deducts SPY_RECRUIT_COST from the empire's credit stockpile.
   * Returns false if the empire cannot afford it.
   */
  recruitPlayerSpy(agent: SpyAgent): boolean {
    const playerEmpire = this.tickState.gameState.empires.find(e => !e.isAI);
    if (!playerEmpire) return false;

    const resources = this.tickState.empireResourcesMap.get(playerEmpire.id);
    if (!resources || resources.credits < SPY_RECRUIT_COST) return false;

    // Deduct cost
    const updatedResources = { ...resources, credits: resources.credits - SPY_RECRUIT_COST };
    const updatedResourcesMap = new Map(this.tickState.empireResourcesMap);
    updatedResourcesMap.set(playerEmpire.id, updatedResources);

    // Update empire credits for consistency
    const updatedEmpires = this.tickState.gameState.empires.map(e =>
      e.id === playerEmpire.id ? { ...e, credits: updatedResources.credits } : e,
    );

    this.tickState = {
      ...this.tickState,
      espionageState: addAgentToState(this.tickState.espionageState, agent),
      empireResourcesMap: updatedResourcesMap,
      gameState: {
        ...this.tickState.gameState,
        empires: updatedEmpires,
      },
    };

    // Emit updated resources and espionage state
    this.game.events.emit('engine:espionage_updated', {
      espionageState: this.tickState.espionageState,
      espionageEventLog: this.tickState.espionageEventLog,
    });
    this.game.events.emit('engine:resources_updated', this.tickState.gameState.empires.map(e => {
      const full = this.tickState.empireResourcesMap.get(e.id);
      return {
        empireId: e.id,
        credits: full?.credits ?? e.credits,
        minerals: full?.minerals ?? 0,
        energy: full?.energy ?? 0,
        organics: full?.organics ?? 0,
        rareElements: full?.rareElements ?? 0,
        exoticMaterials: full?.exoticMaterials ?? 0,
        faith: full?.faith ?? 0,
        researchPoints: full?.researchPoints ?? e.researchPoints,
      };
    }));

    return true;
  }

  /**
   * Assign (or reassign) a mission and target to an existing spy agent.
   */
  assignSpyMission(agentId: string, targetEmpireId: string, mission: SpyMission): void {
    const agent = this.tickState.espionageState.agents.find(a => a.id === agentId);
    if (!agent) return;

    const updated = assignMissionFn(agent, targetEmpireId, mission);
    this.tickState = {
      ...this.tickState,
      espionageState: {
        ...this.tickState.espionageState,
        agents: this.tickState.espionageState.agents.map(a => a.id === agentId ? updated : a),
        counterIntelLevel: new Map(this.tickState.espionageState.counterIntelLevel),
      },
    };

    this.game.events.emit('engine:espionage_updated', {
      espionageState: this.tickState.espionageState,
      espionageEventLog: this.tickState.espionageEventLog,
    });
  }

  /**
   * Replace the entire tick state with `newState`.
   *
   * Used by the save/load system to restore a previously saved game.  The
   * engine is paused after loading so the player can orient themselves before
   * resuming.
   *
   * Emits 'engine:state_loaded' with the new GameState so Phaser scenes and
   * React components can refresh their caches.
   */
  /** Replace the governors array in the tick state. */
  setGovernors(governors: Governor[]): void {
    this.tickState = { ...this.tickState, governors };
  }

  loadState(newState: GameTickState): void {
    this._clearInterval();
    this.running = false;
    this.tickState = {
      ...newState,
      gameState: { ...newState.gameState, status: 'paused', speed: 'paused' },
    };
    this.game.events.emit('engine:state_loaded', this.tickState.gameState);
    this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);
    this.game.events.emit('engine:tick', { tick: this.tickState.gameState.currentTick });
    // Push fresh resource data so the TopBar updates immediately
    const resourceUpdates = this.tickState.gameState.empires.map(e => {
      const full = this.tickState.empireResourcesMap.get(e.id);
      return {
        empireId: e.id,
        credits: full?.credits ?? e.credits,
        minerals: full?.minerals ?? 0,
        energy: full?.energy ?? 0,
        organics: full?.organics ?? 0,
        rareElements: full?.rareElements ?? 0,
        exoticMaterials: full?.exoticMaterials ?? 0,
        faith: full?.faith ?? 0,
        researchPoints: full?.researchPoints ?? e.researchPoints,
      };
    });
    this.game.events.emit('engine:resources_updated', resourceUpdates);
    // Push research state so the research screen refreshes after a load
    const playerEmpireForResearch = this.tickState.gameState.empires.find(e => !e.isAI);
    if (playerEmpireForResearch) {
      const playerResearchState = this.tickState.researchStates.get(playerEmpireForResearch.id);
      if (playerResearchState) {
        this.game.events.emit('engine:research_state', playerResearchState);
      }
    }
  }

  /**
   * Apply the results of a tactical combat to the game state.
   * Updates ship HP, removes destroyed ships and empty fleets, applies
   * crew experience to surviving ships, awards salvage resources to the
   * winner, and clears pending combats so the game loop can resume.
   *
   * Returns the generated BattleReport (or null if no ships were involved).
   */
  applyTacticalCombatResult(tacticalState: TacticalState): BattleReport | null {
    let ships = [...this.tickState.gameState.ships];
    let fleets = [...this.tickState.gameState.fleets];

    // Generate the battle report before modifying state
    const hasShips = tacticalState.ships.length > 0;
    const report = hasShips ? generateBattleReport(tacticalState) : null;

    const destroyedIds = new Set<string>();

    // Build a map of experience promotions from the report
    const expMap = new Map<string, string>();
    if (report) {
      for (const entry of report.attacker.experienceGained) {
        expMap.set(entry.shipId, entry.newExperience);
      }
      for (const entry of report.defender.experienceGained) {
        expMap.set(entry.shipId, entry.newExperience);
      }
    }

    for (const tShip of tacticalState.ships) {
      if (tShip.destroyed) {
        destroyedIds.add(tShip.sourceShipId);
      } else {
        // Update hull points and crew experience from tactical combat result
        const newExp = expMap.get(tShip.sourceShipId);
        ships = ships.map(s => s.id === tShip.sourceShipId
          ? {
              ...s,
              hullPoints: tShip.hull,
              ...(newExp ? { crewExperience: newExp as Ship['crewExperience'] } : {}),
            }
          : s
        );
      }
    }

    // Remove destroyed ships
    ships = ships.filter(s => !destroyedIds.has(s.id));
    fleets = fleets.map(f => ({
      ...f,
      ships: f.ships.filter(id => !destroyedIds.has(id)),
    })).filter(f => f.ships.length > 0);

    // Award salvage resources to the winning empire
    let updatedResourcesMap = new Map(this.tickState.empireResourcesMap);
    if (report && report.winner !== 'draw') {
      // Determine the winner's empire ID from their surviving fleet
      const winningSide = report.winner;
      const winnerTacticalShip = tacticalState.ships.find(
        s => s.side === winningSide && !s.destroyed,
      );
      if (winnerTacticalShip) {
        const winnerShip = ships.find(s => s.id === winnerTacticalShip.sourceShipId);
        const winnerFleet = winnerShip?.fleetId
          ? fleets.find(f => f.id === winnerShip.fleetId)
          : null;
        const winnerEmpireId = winnerFleet?.empireId;

        if (winnerEmpireId) {
          const currentRes = updatedResourcesMap.get(winnerEmpireId);
          if (currentRes) {
            const updatedRes: EmpireResources = {
              ...currentRes,
              credits: currentRes.credits + report.salvage.credits,
              minerals: currentRes.minerals + report.salvage.minerals,
            };
            updatedResourcesMap = new Map(updatedResourcesMap);
            updatedResourcesMap.set(winnerEmpireId, updatedRes);
          }
        }
      }
    }

    // Clear pending combats
    this.tickState = {
      ...this.tickState,
      pendingCombats: [],
      empireResourcesMap: updatedResourcesMap,
      gameState: {
        ...this.tickState.gameState,
        ships,
        fleets,
      },
    };

    return report;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _scheduleInterval(): void {
    const speed = this.tickState.gameState.speed;
    const ms = getTickRate(speed);
    if (ms <= 0) return; // paused — nothing to schedule
    this.intervalId = setInterval(() => this.tick(), ms);
  }

  private _clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Build a BattleResultsData payload from a raw CombatResolvedEvent.
   *
   * Uses pre-battle ship and fleet snapshots (captured before processGameTick
   * ran) so destroyed ships are still visible in the results panel.
   */
  private _buildBattleResultData(
    event: CombatResolvedEvent,
    prevShips: Ship[],
    prevFleets: Fleet[],
  ): BattleResultsData {
    const { systemId, winnerEmpireId, casualties, tick } = event;
    const empires = this.tickState.gameState.empires;

    // Resolve system name
    const system = this.tickState.gameState.galaxy.systems.find(s => s.id === systemId);
    const systemName = system?.name ?? systemId;

    // Determine which fleet was attacking vs defending by looking at the pre-tick
    // state.  The attacker is any fleet that just moved into this system (i.e. its
    // previous position was different), but since we don't have per-fleet combat
    // role metadata in CombatResolvedEvent we do a best-effort split: fleets whose
    // empire owns the system are the defender; others are the attacker.
    const systemOwnerId = system?.ownerId ?? null;

    // Build a casualties map: fleetId → shipsLost count
    const casualtyMap = new Map<string, number>();
    for (const c of casualties) {
      casualtyMap.set(c.fleetId, c.shipsLost);
    }

    // Partition pre-battle fleets in this system into attacker / defender sides.
    const fleetsInSystem = prevFleets.filter(f => f.position.systemId === systemId);

    let attackerFleet: Fleet | undefined;
    let defenderFleet: Fleet | undefined;

    for (const f of fleetsInSystem) {
      if (f.empireId === systemOwnerId) {
        defenderFleet = f;
      } else {
        attackerFleet = f;
      }
    }

    // Fallback: if we can't distinguish, treat first fleet as attacker
    if (!attackerFleet && fleetsInSystem.length >= 1) {
      attackerFleet = fleetsInSystem[0];
    }
    if (!defenderFleet && fleetsInSystem.length >= 2) {
      defenderFleet = fleetsInSystem[1];
    }

    const attackerEmpireId = attackerFleet?.empireId ?? '';
    const defenderEmpireId = defenderFleet?.empireId ?? '';

    const attackerEmpire = empires.find(e => e.id === attackerEmpireId);
    const defenderEmpire = empires.find(e => e.id === defenderEmpireId);

    // Build ship record lists using pre-battle ship snapshots
    const attackerShipIds = new Set(attackerFleet?.ships ?? []);
    const defenderShipIds = new Set(defenderFleet?.ships ?? []);
    const attackerCasualties = casualtyMap.get(attackerFleet?.id ?? '') ?? 0;
    const defenderCasualties = casualtyMap.get(defenderFleet?.id ?? '') ?? 0;

    // Resolve hull class from ship designs map for display icons
    const designs = this.tickState.shipDesigns ?? new Map();
    const buildShipRecords = (shipIds: Set<string>, shipsLost: number): BattleShipRecord[] => {
      const shipList = prevShips.filter(s => shipIds.has(s.id));
      return shipList.map((ship, i): BattleShipRecord => {
        const design = designs.get(ship.designId);
        const hull = design?.hull ?? 'destroyer';
        const isDestroyed = i < shipsLost;
        return {
          id: ship.id,
          name: ship.name,
          hull,
          status: isDestroyed ? 'destroyed' : 'survived',
        };
      });
    };

    // Determine winner side from empire IDs
    const winnerEmpire = empires.find(e => e.id === winnerEmpireId);
    const winner: BattleResultsData['winner'] =
      winnerEmpireId === attackerEmpireId
        ? 'attacker'
        : winnerEmpireId === defenderEmpireId
          ? 'defender'
          : 'draw';

    // System control changes hands when the attacker wins a previously-owned system
    const systemControlChanged = Boolean(
      winner !== 'draw' &&
      winnerEmpireId &&
      winnerEmpireId !== systemOwnerId,
    );

    return {
      systemName,
      attacker: {
        empireName: attackerEmpire?.name ?? 'Unknown Empire',
        empireColor: attackerEmpire?.color ?? '#aabbcc',
        ships: buildShipRecords(attackerShipIds, attackerCasualties),
      },
      defender: {
        empireName: defenderEmpire?.name ?? 'Unknown Empire',
        empireColor: defenderEmpire?.color ?? '#aabbcc',
        ships: buildShipRecords(defenderShipIds, defenderCasualties),
      },
      winner,
      systemControlChanged,
      newOwnerName: systemControlChanged ? winnerEmpire?.name : undefined,
      ticksElapsed: tick,
    };
  }
}

// ── Module-level factory and global accessor ──────────────────────────────────

/**
 * Create a GameEngine from a GameState, store it on window.__GAME_ENGINE__,
 * and return it.
 *
 * Convenience wrapper used from GalaxyMapScene after initializeGame().
 */
export function createGameEngine(
  game: Phaser.Game,
  tickState: GameTickState,
): GameEngine {
  const engine = new GameEngine(game as unknown as PhaserGameBridge, tickState);
  (window as unknown as Record<string, unknown>).__GAME_ENGINE__ = engine;
  return engine;
}

/** Retrieve the running GameEngine from the window global, if present. */
export function getGameEngine(): GameEngine | undefined {
  return (window as unknown as Record<string, unknown>).__GAME_ENGINE__ as GameEngine | undefined;
}

/**
 * Destroy the running GameEngine: pause the tick loop and clear the global
 * reference so a subsequent createGameEngine() call starts fresh.
 */
export function destroyGameEngine(): void {
  const engine = getGameEngine();
  if (engine) {
    engine.pause();
  }
  (window as unknown as Record<string, unknown>).__GAME_ENGINE__ = undefined;
}

// Re-export initializeTickState so callers can import from one place
export { initializeTickState };
