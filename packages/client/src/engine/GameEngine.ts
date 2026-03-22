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
 *  'engine:tech_researched'   TechResearchedEvent
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
  establishColony,
  addBuildingToQueue,
  BUILDING_DEFINITIONS,
  HULL_TEMPLATE_BY_CLASS,
  startShipProduction,
  issueMovementOrder,
} from '@nova-imperia/shared';
import type { GameTickState } from '@nova-imperia/shared';
import type { GameSpeedName } from '@nova-imperia/shared';
import type { BuildingType, ShipDesign } from '@nova-imperia/shared';
import type {
  FleetMovedEvent,
  CombatResolvedEvent,
  TechResearchedEvent,
} from '@nova-imperia/shared';
import {
  createMigrationOrder,
  cancelMigration,
  getActiveMigrations as getMigrationOrders,
  tickMigrations,
} from './migration.js';
import type { MigrationOrder } from './migration.js';

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
    const prevShipIds = new Set(this.tickState.gameState.ships.map(s => s.id));
    const { newState, events } = processGameTick(this.tickState);
    this.tickState = newState;

    // ── Emit per-event notifications ────────────────────────────────────────
    for (const event of events) {
      switch (event.type) {
        case 'FleetMoved':
          this.game.events.emit('engine:fleet_moved', event as FleetMovedEvent);
          break;
        case 'CombatResolved':
          this.game.events.emit('engine:combat_resolved', event as CombatResolvedEvent);
          break;
        case 'TechResearched':
          this.game.events.emit('engine:tech_researched', event as TechResearchedEvent);
          break;
        default:
          break;
      }
    }

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

    // ── Emit galaxy snapshot so the minimap can refresh ─────────────────────
    this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);

    // ── Process active migrations and emit wave events ───────────────────────
    const waveEvents = tickMigrations();
    for (const evt of waveEvents) {
      this.game.events.emit('engine:migration_wave', {
        migration: evt.migration,
        waveNumber: evt.waveNumber,
        colonistsDispatched: evt.colonistsDispatched,
      });
      if (evt.migration.status === 'completed') {
        // Automatically establish the colony once the threshold is reached
        this.colonisePlanet(
          evt.migration.systemId,
          evt.migration.targetPlanetId,
          evt.migration.empireId,
        );
        this.game.events.emit('engine:migration_completed', evt.migration);
      }
    }
    // Broadcast updated migration list so React stays in sync
    this.game.events.emit('engine:migrations_updated', getMigrationOrders());

    // ── Game-over check ──────────────────────────────────────────────────────
    if (this.tickState.gameState.status === 'finished') {
      this._clearInterval();
      this.running = false;
      this.game.events.emit('engine:game_over', { reason: 'finished' });
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
  buildOnPlanet(systemId: string, planetId: string, buildingType: BuildingType): boolean {
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

    // Validate build is allowed
    const buildCheck = canBuildOnPlanet(planet, buildingType);
    if (!buildCheck.allowed) {
      console.warn(`[GameEngine.buildOnPlanet] Build not allowed: ${buildCheck.reason}`);
      return false;
    }

    // Check affordability against full resource stockpile
    const def = BUILDING_DEFINITIONS[buildingType];
    const currentResources = this.tickState.empireResourcesMap.get(empire.id);
    if (!currentResources) {
      console.warn(`[GameEngine.buildOnPlanet] No resource stockpile for empire "${empire.id}"`);
      return false;
    }
    for (const [resource, required] of Object.entries(def.baseCost)) {
      const available = currentResources[resource as keyof typeof currentResources] ?? 0;
      if (available < (required ?? 0)) {
        console.warn(`[GameEngine.buildOnPlanet] Cannot afford ${buildingType}: need ${required} ${resource}, have ${available}`);
        return false;
      }
    }

    // Deduct costs from resource stockpile
    const updatedResources = { ...currentResources };
    for (const [resource, required] of Object.entries(def.baseCost)) {
      const key = resource as keyof typeof updatedResources;
      updatedResources[key] = (updatedResources[key] ?? 0) - (required ?? 0);
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
    const updatedPlanet = addBuildingToQueue(planet, buildingType);

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
   * Colonise an unowned planet on behalf of an empire.
   *
   * Validates species compatibility and credits before applying the
   * establishColony transform.  Deducts BASE_COLONISE_COST credits and emits
   * `engine:planet_colonised` on success.
   *
   * @returns true if colonisation succeeded, false otherwise.
   */
  colonisePlanet(systemId: string, planetId: string, empireId: string): boolean {
    const BASE_COLONISE_COST = 200;
    const INITIAL_POPULATION = 100_000;

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

    // Affordability check
    if (empire.credits < BASE_COLONISE_COST) {
      console.warn(
        `[GameEngine.colonisePlanet] Insufficient credits (have ${empire.credits}, need ${BASE_COLONISE_COST})`,
      );
      return false;
    }

    // Establish colony (pure — returns a new Planet owned by species.id)
    const colonisedPlanet = establishColony(planet, empire.species, INITIAL_POPULATION);
    // Override ownerId so it matches the empire ID rather than the species ID
    const finalPlanet = { ...colonisedPlanet, ownerId: empireId };

    // Deduct cost
    const updatedEmpire = { ...empire, credits: empire.credits - BASE_COLONISE_COST };

    // Splice updated planet back into the galaxy
    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return {
        ...s,
        planets: s.planets.map(p => (p.id === planetId ? finalPlanet : p)),
        // Claim the system if previously unclaimed
        ownerId: s.ownerId ?? empireId,
      };
    });

    const updatedEmpires = this.tickState.gameState.empires.map(e =>
      e.id === empireId ? updatedEmpire : e,
    );

    this.tickState = {
      ...this.tickState,
      gameState: {
        ...this.tickState.gameState,
        galaxy: { ...galaxy, systems: updatedSystems },
        empires: updatedEmpires,
      },
    };

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
    const order = issueMovementOrder(fleet, galaxy, destinationSystemId);
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

    return true;
  }

  /** Return the current tick state snapshot. */
  getState(): GameTickState {
    return this.tickState;
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

// Re-export initializeTickState so callers can import from one place
export { initializeTickState };
