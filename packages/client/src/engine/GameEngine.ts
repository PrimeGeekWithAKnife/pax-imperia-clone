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
 *  'engine:galaxy_updated'    Galaxy   (emitted every tick so minimap can refresh)
 *  'engine:planet_colonised'  { planetName: string; systemId: string; planetId: string }
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
} from '@nova-imperia/shared';
import type { GameTickState } from '@nova-imperia/shared';
import type { GameSpeedName } from '@nova-imperia/shared';
import type { BuildingType } from '@nova-imperia/shared';
import type {
  FleetMovedEvent,
  CombatResolvedEvent,
  TechResearchedEvent,
} from '@nova-imperia/shared';

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

    // ── Emit aggregate tick notification ────────────────────────────────────
    this.game.events.emit('engine:tick', { tick: this.tickState.gameState.currentTick });

    // ── Emit per-empire resource updates ────────────────────────────────────
    const resourceUpdates = this.tickState.gameState.empires.map(e => ({
      empireId: e.id,
      credits: e.credits,
      researchPoints: e.researchPoints,
    }));
    this.game.events.emit('engine:resources_updated', resourceUpdates);

    // ── Emit galaxy snapshot so the minimap can refresh ─────────────────────
    this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);

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

    // Check affordability
    const def = BUILDING_DEFINITIONS[buildingType];
    for (const [resource, required] of Object.entries(def.baseCost)) {
      const key = resource as keyof typeof empire;
      const available = (empire[key] as number | undefined) ?? 0;
      if (available < (required ?? 0)) {
        console.warn(`[GameEngine.buildOnPlanet] Cannot afford ${buildingType}: insufficient ${resource}`);
        return false;
      }
    }

    // Deduct costs from empire
    let updatedEmpire = { ...empire };
    for (const [resource, required] of Object.entries(def.baseCost)) {
      if (resource === 'credits') {
        updatedEmpire = { ...updatedEmpire, credits: updatedEmpire.credits - (required ?? 0) };
      } else if (resource === 'researchPoints') {
        updatedEmpire = { ...updatedEmpire, researchPoints: updatedEmpire.researchPoints - (required ?? 0) };
      }
      // Other resources (minerals, energy, etc.) are not yet tracked on the Empire
      // object directly — this is an acknowledged limitation of the current
      // game-state model where only credits and researchPoints persist on Empire.
    }

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
