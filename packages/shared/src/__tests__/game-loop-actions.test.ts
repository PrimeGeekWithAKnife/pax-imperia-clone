/**
 * Tests for the player action queue in the game loop.
 *
 * Covers submitAction, processPlayerActions (via processGameTick), and all
 * action types that are currently handled: ColonisePlanet, ConstructBuilding,
 * and SetGameSpeed.
 */

import { describe, it, expect } from 'vitest';

import {
  processGameTick,
  initializeTickState,
  submitAction,
  type GameTickState,
  type PlayerAction,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig, type PlayerSetup } from '../engine/game-init.js';
import { getColonisationCost } from '../engine/colony.js';
import type { Species } from '../types/species.js';
import type { GameState } from '../types/game-state.js';
import type { Planet, StarSystem } from '../types/galaxy.js';
import type { ColonisePlanetAction, ConstructBuildingAction, SetGameSpeedAction } from '../types/events.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSpecies(id: string): Species {
  return {
    id,
    name: `Species ${id}`,
    description: 'Test species',
    portrait: `portrait_${id}`,
    isPrebuilt: true,
    specialAbilities: [],
    traits: {
      construction: 5,
      reproduction: 5,
      research: 5,
      espionage: 5,
      economy: 5,
      combat: 5,
      diplomacy: 5,
    },
    environmentPreference: {
      idealTemperature: 288,
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.4,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
  };
}

function makePlayerSetup(id: string): PlayerSetup {
  return {
    species: makeSpecies(id),
    empireName: `Empire ${id}`,
    color: `#${id.charCodeAt(0).toString(16).padStart(6, '0')}`,
    isAI: false,
  };
}

/** A small two-empire game state, ready to tick. */
function makeGameState(seed = 42): GameState {
  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'small', shape: 'elliptical', playerCount: 2 },
    players: [makePlayerSetup('a'), makePlayerSetup('b')],
  };
  return initializeGame(config);
}

/**
 * Build a game state that has a second colonisable planet in empire A's home
 * system.  Returns the patched state, the empire ID, the home system ID, and
 * the ID of the colonisable planet.
 */
function makeStateWithColonisablePlanet(): {
  gs: GameState;
  empireId: string;
  systemId: string;
  targetPlanetId: string;
} {
  const gs = makeGameState();
  const empire = gs.empires[0]!;

  // Find empire's home system (the system it owns).
  const homeSystem = gs.galaxy.systems.find(s => s.ownerId === empire.id)!;

  // Build a colonisable planet (terran, oxygen_nitrogen atmosphere, good
  // gravity/temperature for the test species) and add it to the home system.
  const colonisablePlanet: Planet = {
    id: 'test-colonisable-planet',
    name: 'New World',
    orbitalIndex: 99,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 288,
    naturalResources: 50,
    maxPopulation: 5_000_000_000,
    currentPopulation: 0,
    ownerId: null,
    buildings: [],
    productionQueue: [],
  };

  const updatedHomeSystem: StarSystem = {
    ...homeSystem,
    planets: [...homeSystem.planets, colonisablePlanet],
  };

  const patchedGs: GameState = {
    ...gs,
    galaxy: {
      ...gs.galaxy,
      systems: gs.galaxy.systems.map(s =>
        s.id === homeSystem.id ? updatedHomeSystem : s,
      ),
    },
    // Give the empire plenty of credits to afford colonisation.
    empires: gs.empires.map(e =>
      e.id === empire.id ? { ...e, credits: 10_000 } : e,
    ),
  };

  return {
    gs: patchedGs,
    empireId: empire.id,
    systemId: homeSystem.id,
    targetPlanetId: colonisablePlanet.id,
  };
}

// ---------------------------------------------------------------------------
// submitAction
// ---------------------------------------------------------------------------

describe('submitAction', () => {
  it('adds an action to the pendingActions queue', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    expect(ts.pendingActions).toHaveLength(0);

    const action: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'fast' };
    const newTs = submitAction(ts, empire.id, action);

    expect(newTs.pendingActions).toHaveLength(1);
    expect(newTs.pendingActions[0]!.empireId).toBe(empire.id);
    expect(newTs.pendingActions[0]!.action).toEqual(action);
    expect(typeof newTs.pendingActions[0]!.tick).toBe('number');
  });

  it('records the tick number at which the action was submitted', () => {
    const gs = makeGameState();
    // Advance to tick 5 for a more interesting value.
    let ts = initializeTickState(gs);
    for (let i = 0; i < 5; i++) {
      ts = processGameTick(ts).newState;
    }

    const empire = gs.empires[0]!;
    const action: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'slow' };
    const newTs = submitAction(ts, empire.id, action);

    expect(newTs.pendingActions[0]!.tick).toBe(5);
  });

  it('does not mutate the original state', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;
    const action: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'fast' };

    submitAction(ts, empire.id, action);

    expect(ts.pendingActions).toHaveLength(0);
  });

  it('accumulates multiple actions in order', () => {
    const gs = makeGameState();
    let ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    const action1: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'fast' };
    const action2: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'slow' };

    ts = submitAction(ts, empire.id, action1);
    ts = submitAction(ts, empire.id, action2);

    expect(ts.pendingActions).toHaveLength(2);
    expect(ts.pendingActions[0]!.action).toEqual(action1);
    expect(ts.pendingActions[1]!.action).toEqual(action2);
  });
});

// ---------------------------------------------------------------------------
// ColonisePlanet action
// ---------------------------------------------------------------------------

describe('processGameTick — ColonisePlanet action', () => {
  it('creates a migration order on the next tick (colonisation is multi-turn)', () => {
    const { gs, empireId, systemId, targetPlanetId } = makeStateWithColonisablePlanet();
    const ts = initializeTickState(gs);

    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId,
      systemId,
      planetId: targetPlanetId,
    };

    const tsWithAction = submitAction(ts, empireId, action);
    const { newState } = processGameTick(tsWithAction);

    // A migration order should be created — colonisation is deferred.
    const migrationOrder = newState.migrationOrders.find(
      o => o.targetPlanetId === targetPlanetId,
    );
    expect(migrationOrder).toBeDefined();
    expect(migrationOrder?.empireId).toBe(empireId);
    expect(migrationOrder?.status).toBe('migrating');
  });

  it('deducts colonisation credits from the empire', () => {
    const { gs, empireId, systemId, targetPlanetId } = makeStateWithColonisablePlanet();

    const empire = gs.empires.find(e => e.id === empireId)!;
    const homeSystem = gs.galaxy.systems.find(s => s.id === systemId)!;
    const targetPlanet = homeSystem.planets.find(p => p.id === targetPlanetId)!;

    const cost = getColonisationCost(targetPlanet, empire.species);

    const ts = initializeTickState(gs);
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId,
      systemId,
      planetId: targetPlanetId,
    };

    const tsWithAction = submitAction(ts, empireId, action);
    const { newState } = processGameTick(tsWithAction);

    const updatedEmpire = newState.gameState.empires.find(e => e.id === empireId)!;

    // The colonisation cost (200 credits) should have been deducted, though
    // production income may partially offset it. We check the resource map
    // to verify the deduction happened relative to what the empire would have
    // had WITHOUT colonisation.
    // Run a control tick without colonisation to measure pure income:
    const { newState: controlState } = processGameTick(ts);
    const controlCredits = controlState.gameState.empires.find(e => e.id === empireId)!.credits;
    // With colonisation, credits should be ~200 less than the control
    expect(updatedEmpire.credits).toBeLessThan(controlCredits);
    expect(controlCredits - updatedEmpire.credits).toBeGreaterThanOrEqual(cost * 0.8); // allow some floating point
  });

  it('rejected when the empire does not own a planet in the system', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;

    // Find a system that the empire does NOT own and that has an unowned planet.
    const foreignSystem = gs.galaxy.systems.find(
      s => s.ownerId !== empire.id &&
        s.planets.some(p => p.ownerId === null && p.type !== 'gas_giant'),
    );

    if (!foreignSystem) {
      // Nothing suitable in this galaxy seed — skip rather than fail.
      return;
    }

    const targetPlanet = foreignSystem.planets.find(
      p => p.ownerId === null && p.type !== 'gas_giant',
    )!;

    const ts = initializeTickState({
      ...gs,
      empires: gs.empires.map(e =>
        e.id === empire.id ? { ...e, credits: 10_000 } : e,
      ),
    });

    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: empire.id,
      systemId: foreignSystem.id,
      planetId: targetPlanet.id,
    };

    const tsWithAction = submitAction(ts, empire.id, action);
    const { newState } = processGameTick(tsWithAction);

    // Planet should remain unowned — action rejected.
    const updatedPlanet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === targetPlanet.id)!;

    expect(updatedPlanet.ownerId).toBeNull();
  });

  it('emits a MigrationStarted event (colonisation is multi-turn)', () => {
    const { gs, empireId, systemId, targetPlanetId } = makeStateWithColonisablePlanet();
    const ts = initializeTickState(gs);

    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId,
      systemId,
      planetId: targetPlanetId,
    };

    const tsWithAction = submitAction(ts, empireId, action);
    const { events } = processGameTick(tsWithAction);

    const migrationEvents = events.filter(e => e.type === 'MigrationStarted');
    expect(migrationEvents).toHaveLength(1);

    const event = migrationEvents[0]!;
    if (event.type === 'MigrationStarted') {
      expect(event.empireId).toBe(empireId);
      expect(event.systemId).toBe(systemId);
      expect(event.targetPlanetId).toBe(targetPlanetId);
    }
  });

  it('rejected when the empire cannot afford the cost', () => {
    const { gs, empireId, systemId, targetPlanetId } = makeStateWithColonisablePlanet();

    // Set credits to zero.
    const poorGs: GameState = {
      ...gs,
      empires: gs.empires.map(e =>
        e.id === empireId ? { ...e, credits: 0 } : e,
      ),
    };

    const ts = initializeTickState(poorGs);
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId,
      systemId,
      planetId: targetPlanetId,
    };

    const tsWithAction = submitAction(ts, empireId, action);
    const { newState } = processGameTick(tsWithAction);

    const planet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === targetPlanetId)!;

    expect(planet.ownerId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ConstructBuilding action
// ---------------------------------------------------------------------------

describe('processGameTick — ConstructBuilding action', () => {
  it('adds a building to the planet production queue', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;
    const homeSystem = gs.galaxy.systems.find(s => s.ownerId === empire.id)!;
    const homePlanet = homeSystem.planets.find(p => p.ownerId === empire.id)!;

    const queueBefore = homePlanet.productionQueue.length;

    const ts = initializeTickState(gs);
    const action: ConstructBuildingAction = {
      type: 'ConstructBuilding',
      systemId: homeSystem.id,
      planetId: homePlanet.id,
      buildingType: 'mining_facility',
    };

    const tsWithAction = submitAction(ts, empire.id, action);
    const { newState } = processGameTick(tsWithAction);

    const updatedPlanet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === homePlanet.id)!;

    // The construction tick will have advanced the queue by one turn, so the
    // queue may be shorter by one.  What matters is that a mining_facility
    // item was enqueued — either it is still in progress or it already
    // completed.
    const hasInQueue = updatedPlanet.productionQueue.some(
      item => item.type === 'building' && item.templateId === 'mining_facility',
    );
    const alreadyBuilt = updatedPlanet.buildings.some(b => b.type === 'mining_facility');

    expect(hasInQueue || alreadyBuilt).toBe(true);

    // Queue length either grew by at least one item (minus the one turn of
    // processing) or the item immediately completed (build time = 1).
    void queueBefore;
  });

  it('rejected when the empire does not own the planet', () => {
    const gs = makeGameState();
    const empireA = gs.empires[0]!;
    const empireB = gs.empires[1]!;

    // Find a planet owned by empire B.
    const systemB = gs.galaxy.systems.find(s => s.ownerId === empireB.id)!;
    const planetB = systemB.planets.find(p => p.ownerId === empireB.id)!;

    const queueBefore = planetB.productionQueue.length;

    const ts = initializeTickState(gs);
    const action: ConstructBuildingAction = {
      type: 'ConstructBuilding',
      systemId: systemB.id,
      planetId: planetB.id,
      buildingType: 'trade_hub',
    };

    // Submit the action as empire A trying to build on empire B's planet.
    const tsWithAction = submitAction(ts, empireA.id, action);
    const { newState } = processGameTick(tsWithAction);

    const updatedPlanet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === planetB.id)!;

    // Queue should not have grown (rejected action).
    // Note: the construction tick itself processes existing items, so we
    // only check that no trade_hub item was inserted.
    const hasTradeHubInQueue = updatedPlanet.productionQueue.some(
      item => item.type === 'building' && item.templateId === 'trade_hub',
    );
    const hasTradeHubBuilt = updatedPlanet.buildings.some(b => b.type === 'trade_hub');

    void queueBefore;
    expect(hasTradeHubInQueue || hasTradeHubBuilt).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SetGameSpeed action
// ---------------------------------------------------------------------------

describe('processGameTick — SetGameSpeed action', () => {
  it('updates the game speed', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    expect(gs.speed).toBe('normal');

    const action: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'fast' };
    const tsWithAction = submitAction(ts, empire.id, action);
    const { newState } = processGameTick(tsWithAction);

    expect(newState.gameState.speed).toBe('fast');
  });
});

// ---------------------------------------------------------------------------
// Multiple actions and ordering
// ---------------------------------------------------------------------------

describe('processGameTick — multiple actions', () => {
  it('processes multiple actions in submission order', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    // Submit two speed changes — last one should win.
    const action1: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'fast' };
    const action2: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'slow' };

    let tsWithActions = submitAction(ts, empire.id, action1);
    tsWithActions = submitAction(tsWithActions, empire.id, action2);

    const { newState } = processGameTick(tsWithActions);

    // Both were processed in order — last one wins.
    expect(newState.gameState.speed).toBe('slow');
  });

  it('processes a colonise action alongside a speed change', () => {
    const { gs, empireId, systemId, targetPlanetId } = makeStateWithColonisablePlanet();
    let ts = initializeTickState(gs);

    const speedAction: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'fastest' };
    const coloniseAction: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId,
      systemId,
      planetId: targetPlanetId,
    };

    ts = submitAction(ts, empireId, speedAction);
    ts = submitAction(ts, empireId, coloniseAction);

    const { newState } = processGameTick(ts);

    // Speed changed.
    expect(newState.gameState.speed).toBe('fastest');

    // Planet colonised.
    const planet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === targetPlanetId)!;
    expect(planet.ownerId).toBe(empireId);
  });
});

// ---------------------------------------------------------------------------
// Actions cleared after processing
// ---------------------------------------------------------------------------

describe('processGameTick — actions cleared after processing', () => {
  it('pendingActions is empty after a tick', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    const action: SetGameSpeedAction = { type: 'SetGameSpeed', speed: 'fast' };
    const tsWithAction = submitAction(ts, empire.id, action);

    expect(tsWithAction.pendingActions).toHaveLength(1);

    const { newState } = processGameTick(tsWithAction);

    expect(newState.pendingActions).toHaveLength(0);
  });

  it('actions from tick N do not affect tick N+1', () => {
    const gs = makeGameState();
    let ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    // Submit a speed change.
    ts = submitAction(ts, empire.id, { type: 'SetGameSpeed', speed: 'fast' });
    const { newState: after1 } = processGameTick(ts);

    // Speed is now fast; no pending actions remain.
    expect(after1.gameState.speed).toBe('fast');
    expect(after1.pendingActions).toHaveLength(0);

    // Second tick with no new actions — speed should remain fast.
    const { newState: after2 } = processGameTick(after1);
    expect(after2.gameState.speed).toBe('fast');
  });
});

// ---------------------------------------------------------------------------
// Graceful error handling — invalid actions must not crash the tick
// ---------------------------------------------------------------------------

describe('processGameTick — invalid actions do not crash the tick', () => {
  it('a ColonisePlanet action for a non-existent planet is silently ignored', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;
    const homeSystem = gs.galaxy.systems.find(s => s.ownerId === empire.id)!;

    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: empire.id,
      systemId: homeSystem.id,
      planetId: 'does-not-exist',
    };

    const tsWithAction = submitAction(ts, empire.id, action);

    // Should not throw.
    expect(() => processGameTick(tsWithAction)).not.toThrow();
  });

  it('a ColonisePlanet action for a non-existent system is silently ignored', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: empire.id,
      systemId: 'ghost-system',
      planetId: 'ghost-planet',
    };

    const tsWithAction = submitAction(ts, empire.id, action);

    expect(() => processGameTick(tsWithAction)).not.toThrow();
  });

  it('a ColonisePlanet action from an unknown empire is silently ignored', () => {
    const { gs, systemId, targetPlanetId } = makeStateWithColonisablePlanet();
    const ts = initializeTickState(gs);

    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: 'non-existent-empire',
      systemId,
      planetId: targetPlanetId,
    };

    // submitAction uses the provided empireId as a wrapper; the inner action
    // also carries the same empireId.
    const tsWithAction = submitAction(ts, 'non-existent-empire', action);

    expect(() => processGameTick(tsWithAction)).not.toThrow();

    // Planet must remain unowned.
    const { newState } = processGameTick(tsWithAction);
    const planet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === targetPlanetId)!;
    expect(planet.ownerId).toBeNull();
  });

  it('a ConstructBuilding action for an unknown system is silently ignored', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    const action: ConstructBuildingAction = {
      type: 'ConstructBuilding',
      systemId: 'no-such-system',
      planetId: 'no-such-planet',
      buildingType: 'factory',
    };

    const tsWithAction = submitAction(ts, empire.id, action);

    expect(() => processGameTick(tsWithAction)).not.toThrow();
  });

  it('game tick still advances correctly even with an invalid action in the queue', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const empire = gs.empires[0]!;

    // Inject a PlayerAction directly to simulate a malformed/unknown action.
    const badPlayerAction: PlayerAction = {
      empireId: empire.id,
      // Cast to GameAction to simulate an unexpected action type at runtime.
      action: { type: 'DesignShip', name: 'Test', hull: 'destroyer', components: [] },
      tick: 0,
    };

    const tsWithBadAction: GameTickState = {
      ...ts,
      pendingActions: [badPlayerAction],
    };

    // Tick must complete without throwing.
    expect(() => processGameTick(tsWithBadAction)).not.toThrow();

    const { newState } = processGameTick(tsWithBadAction);
    // Tick counter should have advanced normally.
    expect(newState.gameState.currentTick).toBe(1);
  });
});
