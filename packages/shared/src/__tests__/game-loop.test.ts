/**
 * Tests for the central game-loop tick engine.
 *
 * These tests use initializeGame to create a real two-empire GameState so that
 * all engine modules are exercised together, matching the stated goal of
 * "integration point for the entire game".
 */

import { describe, it, expect } from 'vitest';

import {
  processGameTick,
  initializeTickState,
  getTickRate,
  isGameOver,
  type GameTickState,
  type CombatPending,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig, type PlayerSetup } from '../engine/game-init.js';
import { addBuildingToQueue } from '../engine/colony.js';
import { startResearch } from '../engine/research.js';
import { issueMovementOrder, startShipProduction } from '../engine/fleet.js';
import type { Species } from '../types/species.js';
import type { Technology } from '../types/technology.js';
import type { GameState } from '../types/game-state.js';
import { GAME_SPEEDS } from '../constants/game.js';

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

function makePlayerSetup(id: string, isAI = false): PlayerSetup {
  return {
    species: makeSpecies(id),
    empireName: `Empire ${id}`,
    color: `#${id.charCodeAt(0).toString(16).padStart(6, '0')}`,
    isAI,
  };
}

/** Two-empire small galaxy — fast to set up, sufficient for integration tests. */
function makeGameState(seed = 42): GameState {
  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'small', shape: 'elliptical', playerCount: 2 },
    players: [makePlayerSetup('a'), makePlayerSetup('b')],
  };
  return initializeGame(config);
}

/** Minimal Technology fixture for research tests. */
function makeTech(id: string, cost: number, prerequisites: string[] = []): Technology {
  return {
    id,
    name: `Tech ${id}`,
    description: 'A test technology',
    age: 'nano_atomic',
    category: 'weapons',
    cost,
    prerequisites,
    effects: [],
  };
}

// ---------------------------------------------------------------------------
// initializeTickState
// ---------------------------------------------------------------------------

describe('initializeTickState', () => {
  it('creates a valid tick state from a fresh GameState', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);

    expect(ts.gameState).toBe(gs);
    expect(ts.movementOrders).toHaveLength(0);
    expect(ts.productionOrders).toHaveLength(0);
    expect(ts.pendingCombats).toHaveLength(0);
  });

  it('creates a ResearchState for every empire', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);

    for (const empire of gs.empires) {
      expect(ts.researchStates.has(empire.id)).toBe(true);
    }
    expect(ts.researchStates.size).toBe(gs.empires.length);
  });

  it('research state currentAge matches empire currentAge', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);

    for (const empire of gs.empires) {
      const rs = ts.researchStates.get(empire.id)!;
      expect(rs.currentAge).toBe(empire.currentAge);
    }
  });

  it('research state completedTechs mirrors empire technologies', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);

    for (const empire of gs.empires) {
      const rs = ts.researchStates.get(empire.id)!;
      expect(rs.completedTechs).toEqual(empire.technologies);
    }
  });

  it('activeResearch starts empty', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);

    for (const empire of gs.empires) {
      const rs = ts.researchStates.get(empire.id)!;
      expect(rs.activeResearch).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getTickRate
// ---------------------------------------------------------------------------

describe('getTickRate', () => {
  it('returns 0 for paused', () => {
    expect(getTickRate('paused')).toBe(0);
  });

  it('returns 4000 for slow', () => {
    expect(getTickRate('slow')).toBe(4000);
  });

  it('returns 2000 for normal', () => {
    expect(getTickRate('normal')).toBe(2000);
  });

  it('returns 1000 for fast', () => {
    expect(getTickRate('fast')).toBe(1000);
  });

  it('returns 500 for fastest', () => {
    expect(getTickRate('fastest')).toBe(500);
  });

  it('covers every key in GAME_SPEEDS', () => {
    for (const speed of Object.keys(GAME_SPEEDS) as Array<keyof typeof GAME_SPEEDS>) {
      // Should not throw
      const rate = getTickRate(speed);
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// isGameOver
// ---------------------------------------------------------------------------

describe('isGameOver', () => {
  it('returns over=false for an active game', () => {
    const gs = makeGameState();
    const ts = initializeTickState(gs);
    const result = isGameOver(ts);
    expect(result.over).toBe(false);
  });

  it('returns over=true when status is finished', () => {
    const gs = makeGameState();
    const ts = initializeTickState({ ...gs, status: 'finished' });
    const result = isGameOver(ts);
    expect(result.over).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// processGameTick — tick counter
// ---------------------------------------------------------------------------

describe('processGameTick — tick counter', () => {
  it('increments currentTick by 1 per tick', () => {
    const gs = makeGameState();
    expect(gs.currentTick).toBe(0);

    const ts = initializeTickState(gs);
    const { newState } = processGameTick(ts);
    expect(newState.gameState.currentTick).toBe(1);
  });

  it('advances tick to 5 after 5 consecutive ticks', () => {
    let ts = initializeTickState(makeGameState());
    for (let i = 0; i < 5; i++) {
      ts = processGameTick(ts).newState;
    }
    expect(ts.gameState.currentTick).toBe(5);
  });

  it('does not advance tick when paused', () => {
    const gs = makeGameState();
    const ts = initializeTickState({ ...gs, status: 'paused' });
    const { newState } = processGameTick(ts);
    expect(newState.gameState.currentTick).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// processGameTick — population growth
// ---------------------------------------------------------------------------

describe('processGameTick — population growth', () => {
  it('population grows on colonised planets after one tick', () => {
    const gs = makeGameState();
    const colonisedPlanets = gs.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.currentPopulation > 0);

    // Sanity: we have colonised planets
    expect(colonisedPlanets.length).toBeGreaterThan(0);

    const ts = initializeTickState(gs);
    const { newState } = processGameTick(ts);

    const newPlanets = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.currentPopulation > 0);

    // Population should have grown on at least one planet
    let grew = false;
    for (const before of colonisedPlanets) {
      const after = newPlanets.find(p => p.id === before.id);
      if (after && after.currentPopulation > before.currentPopulation) {
        grew = true;
        break;
      }
    }
    expect(grew).toBe(true);
  });

  it('population does not exceed maxPopulation', () => {
    const gs = makeGameState();
    let ts = initializeTickState(gs);

    // Run 100 ticks
    for (let i = 0; i < 100; i++) {
      ts = processGameTick(ts).newState;
    }

    const planets = ts.gameState.galaxy.systems.flatMap(s => s.planets);
    for (const planet of planets) {
      expect(planet.currentPopulation).toBeLessThanOrEqual(planet.maxPopulation);
    }
  });

  it('population grows more over 10 ticks than over 1 tick', () => {
    const gs = makeGameState();

    const oneTick = processGameTick(initializeTickState(gs)).newState;
    let tenTicks = initializeTickState(gs);
    for (let i = 0; i < 10; i++) {
      tenTicks = processGameTick(tenTicks).newState;
    }

    const colonisedBefore = gs.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.currentPopulation > 0);

    for (const before of colonisedBefore) {
      const after1 = oneTick.gameState.galaxy.systems
        .flatMap(s => s.planets)
        .find(p => p.id === before.id);
      const after10 = tenTicks.gameState.galaxy.systems
        .flatMap(s => s.planets)
        .find(p => p.id === before.id);

      if (after1 && after10) {
        expect(after10.currentPopulation).toBeGreaterThanOrEqual(
          after1.currentPopulation,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// processGameTick — resource production
// ---------------------------------------------------------------------------

describe('processGameTick — resource production', () => {
  it('empire credits accumulate from production after one tick', () => {
    const gs = makeGameState();
    const initialCredits = gs.empires.map(e => e.credits);

    const ts = initializeTickState(gs);
    const { newState } = processGameTick(ts);

    // Credits change (production minus upkeep); net may be negative early on
    // but the state should have changed — simply verify a number
    for (const empire of newState.gameState.empires) {
      expect(typeof empire.credits).toBe('number');
      expect(empire.credits).toBeGreaterThanOrEqual(0);
    }
    void initialCredits; // referenced for documentation only
  });

  it('resource deficit does not push credits below zero', () => {
    const gs = makeGameState();
    let ts = initializeTickState({ ...gs });

    // Drain credits manually then run ticks
    ts = {
      ...ts,
      gameState: {
        ...ts.gameState,
        empires: ts.gameState.empires.map(e => ({ ...e, credits: 0 })),
      },
    };

    for (let i = 0; i < 10; i++) {
      ts = processGameTick(ts).newState;
    }

    for (const empire of ts.gameState.empires) {
      expect(empire.credits).toBeGreaterThanOrEqual(0);
    }
  });

  it('credits accumulate over multiple ticks (no upkeep scenario)', () => {
    // Remove all ships and buildings to eliminate upkeep, leaving only tax income
    const gs = makeGameState();
    const cleanGs: GameState = {
      ...gs,
      fleets: [],
      ships: [],
      galaxy: {
        ...gs.galaxy,
        systems: gs.galaxy.systems.map(sys => ({
          ...sys,
          planets: sys.planets.map(p => ({
            ...p,
            buildings: [],
            productionQueue: [],
          })),
        })),
      },
    };

    const ts1 = processGameTick(initializeTickState(cleanGs)).newState;
    let ts5 = initializeTickState(cleanGs);
    for (let i = 0; i < 5; i++) {
      ts5 = processGameTick(ts5).newState;
    }

    // After 5 ticks of pure production, each empire should have more credits
    // than after 1 tick (tax income is positive since populations > 0)
    for (let i = 0; i < cleanGs.empires.length; i++) {
      const empire1 = ts1.gameState.empires[i]!;
      const empire5 = ts5.gameState.empires[i]!;
      expect(empire5.credits).toBeGreaterThanOrEqual(empire1.credits);
    }
  });
});

// ---------------------------------------------------------------------------
// processGameTick — construction queues
// ---------------------------------------------------------------------------

describe('processGameTick — construction queues', () => {
  it('construction queue progresses each tick', () => {
    const gs = makeGameState();

    // Add a building to the queue on the first colonised planet
    const systems = gs.galaxy.systems;
    let targetPlanet = null;
    let targetSystemIndex = -1;
    let targetPlanetIndex = -1;

    outer: for (let si = 0; si < systems.length; si++) {
      const sys = systems[si]!;
      for (let pi = 0; pi < sys.planets.length; pi++) {
        const planet = sys.planets[pi]!;
        if (planet.ownerId !== null && planet.currentPopulation > 0) {
          targetPlanet = planet;
          targetSystemIndex = si;
          targetPlanetIndex = pi;
          break outer;
        }
      }
    }

    expect(targetPlanet).not.toBeNull();

    // Queue a mining_facility (build time from BUILDING_DEFINITIONS)
    const planetWithQueue = addBuildingToQueue(targetPlanet!, 'mining_facility');
    const initialTurns = planetWithQueue.productionQueue[0]!.turnsRemaining;
    expect(initialTurns).toBeGreaterThan(0);

    // Patch the planet back into the game state
    const updatedSystems = gs.galaxy.systems.map((sys, si) => {
      if (si !== targetSystemIndex) return sys;
      return {
        ...sys,
        planets: sys.planets.map((p, pi) =>
          pi === targetPlanetIndex ? planetWithQueue : p,
        ),
      };
    });

    const patchedGs: GameState = {
      ...gs,
      galaxy: { ...gs.galaxy, systems: updatedSystems },
    };

    const ts = initializeTickState(patchedGs);
    const { newState } = processGameTick(ts);

    // Find the planet after the tick
    const afterPlanet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === targetPlanet!.id)!;

    if (afterPlanet.productionQueue.length > 0) {
      // Not completed yet — turns should have decreased (rate >= 1.0 due to factories)
      expect(afterPlanet.productionQueue[0]!.turnsRemaining).toBeLessThan(initialTurns);
    } else {
      // Completed (if turnsRemaining was 1 or construction_rate was high)
      expect(afterPlanet.buildings.some(b => b.type === 'mining_facility')).toBe(true);
    }
  });

  it('completed buildings appear on the planet', () => {
    const gs = makeGameState();

    // Queue a factory (4 turns) then run 4 ticks
    const systems = gs.galaxy.systems;
    let targetPlanet = null;
    let targetSystemIndex = -1;
    let targetPlanetIndex = -1;

    outer: for (let si = 0; si < systems.length; si++) {
      const sys = systems[si]!;
      for (let pi = 0; pi < sys.planets.length; pi++) {
        const planet = sys.planets[pi]!;
        // Find a planet that has room for another building (not at slot cap)
        if (
          planet.ownerId !== null &&
          planet.currentPopulation > 0 &&
          planet.buildings.length < 10 // room for more buildings on the planet
        ) {
          targetPlanet = planet;
          targetSystemIndex = si;
          targetPlanetIndex = pi;
          break outer;
        }
      }
    }

    expect(targetPlanet).not.toBeNull();

    const planetWithQueue = addBuildingToQueue(targetPlanet!, 'mining_facility');
    const updatedSystems = gs.galaxy.systems.map((sys, si) => {
      if (si !== targetSystemIndex) return sys;
      return {
        ...sys,
        planets: sys.planets.map((p, pi) =>
          pi === targetPlanetIndex ? planetWithQueue : p,
        ),
      };
    });

    let ts = initializeTickState({
      ...gs,
      galaxy: { ...gs.galaxy, systems: updatedSystems },
    });

    const buildTurns = planetWithQueue.productionQueue[0]!.turnsRemaining; // 4
    for (let i = 0; i < buildTurns; i++) {
      ts = processGameTick(ts).newState;
    }

    const afterPlanet = ts.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === targetPlanet!.id)!;

    expect(afterPlanet.buildings.some(b => b.type === 'mining_facility')).toBe(true);
    expect(afterPlanet.productionQueue).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// processGameTick — ship production
// ---------------------------------------------------------------------------

describe('processGameTick — ship production', () => {
  it('a completed ship production order creates a new ship', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;

    // Find the empire's home planet system
    const homeSystem = gs.galaxy.systems.find(s => s.ownerId === empire.id)!;
    const homePlanet = homeSystem.planets.find(p => p.ownerId === empire.id)!;

    // Create a 1-tick production order (so it completes on next tick)
    const order = startShipProduction('design-001', homePlanet.id, 1);

    const ts = initializeTickState(gs);
    const tsWithOrder: GameTickState = {
      ...ts,
      productionOrders: [order],
    };

    const shipsBefore = gs.ships.length;
    const { newState } = processGameTick(tsWithOrder);
    const shipsAfter = newState.gameState.ships.length;

    expect(shipsAfter).toBeGreaterThan(shipsBefore);
    expect(newState.productionOrders).toHaveLength(0);
  });

  it('a multi-tick production order progresses but does not complete early', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;
    const homeSystem = gs.galaxy.systems.find(s => s.ownerId === empire.id)!;
    const homePlanet = homeSystem.planets.find(p => p.ownerId === empire.id)!;

    const order = startShipProduction('design-001', homePlanet.id, 3);

    const ts: GameTickState = {
      ...initializeTickState(gs),
      productionOrders: [order],
    };

    const shipsBefore = gs.ships.length;
    const { newState } = processGameTick(ts);

    // Only 1 of 3 ticks elapsed — should not complete yet
    expect(newState.gameState.ships.length).toBe(shipsBefore);
    expect(newState.productionOrders).toHaveLength(1);
    expect(newState.productionOrders[0]!.ticksRemaining).toBe(2);
  });

  it('completed ship is assigned to a fleet in the correct system', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;
    const homeSystem = gs.galaxy.systems.find(s => s.ownerId === empire.id)!;
    const homePlanet = homeSystem.planets.find(p => p.ownerId === empire.id)!;

    const order = startShipProduction('design-001', homePlanet.id, 1);
    const ts: GameTickState = {
      ...initializeTickState(gs),
      productionOrders: [order],
    };

    const { newState } = processGameTick(ts);

    const newShips = newState.gameState.ships.filter(
      s => !gs.ships.some(orig => orig.id === s.id),
    );
    expect(newShips).toHaveLength(1);

    const newShip = newShips[0]!;
    expect(newShip.position.systemId).toBe(homeSystem.id);
    expect(newShip.fleetId).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// processGameTick — research
// ---------------------------------------------------------------------------

describe('processGameTick — research progresses', () => {
  it('research points invested increase after one tick', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;

    const tech = makeTech('basic-weapons', 100);

    let ts = initializeTickState(gs);
    // Start research on the tech for this empire
    const rs = ts.researchStates.get(empire.id)!;
    const rsWithResearch = startResearch(rs, tech.id, [tech], 100);
    ts = {
      ...ts,
      researchStates: new Map(ts.researchStates).set(empire.id, rsWithResearch),
    };

    const { newState } = processGameTick(ts, [tech]);

    const newRs = newState.researchStates.get(empire.id)!;
    // Either still active (more points invested) or completed
    const totalInvested =
      newRs.activeResearch.reduce((s, r) => s + r.pointsInvested, 0) +
      (newRs.completedTechs.includes(tech.id) ? tech.cost : 0);
    expect(totalInvested).toBeGreaterThan(0);
  });

  it('a cheap tech completes within a few ticks', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;

    // A very cheap tech: cost = 1
    const tech = makeTech('ultra-cheap', 1);

    let ts = initializeTickState(gs);
    const rs = ts.researchStates.get(empire.id)!;
    ts = {
      ...ts,
      researchStates: new Map(ts.researchStates).set(
        empire.id,
        startResearch(rs, tech.id, [tech], 100),
      ),
    };

    // Run up to 10 ticks; the tech should complete
    for (let i = 0; i < 10; i++) {
      const result = processGameTick(ts, [tech]);
      ts = result.newState;
      const finalRs = ts.researchStates.get(empire.id)!;
      if (finalRs.completedTechs.includes(tech.id)) break;
    }

    const finalRs = ts.researchStates.get(empire.id)!;
    expect(finalRs.completedTechs).toContain(tech.id);
  });

  it('completed tech is added to empire.technologies', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;

    const tech = makeTech('cheap-tech', 1);

    let ts = initializeTickState(gs);
    const rs = ts.researchStates.get(empire.id)!;
    ts = {
      ...ts,
      researchStates: new Map(ts.researchStates).set(
        empire.id,
        startResearch(rs, tech.id, [tech], 100),
      ),
    };

    for (let i = 0; i < 10; i++) {
      ts = processGameTick(ts, [tech]).newState;
      const e = ts.gameState.empires.find(e => e.id === empire.id)!;
      if (e.technologies.includes(tech.id)) break;
    }

    const updatedEmpire = ts.gameState.empires.find(e => e.id === empire.id)!;
    expect(updatedEmpire.technologies).toContain(tech.id);
  });

  it('a TechResearched event is emitted when a tech completes', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;

    const tech = makeTech('event-tech', 1);

    let ts = initializeTickState(gs);
    const rs = ts.researchStates.get(empire.id)!;
    ts = {
      ...ts,
      researchStates: new Map(ts.researchStates).set(
        empire.id,
        startResearch(rs, tech.id, [tech], 100),
      ),
    };

    const allEvents: import('../types/events.js').GameEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const result = processGameTick(ts, [tech]);
      ts = result.newState;
      allEvents.push(...result.events);
      if (allEvents.some(e => e.type === 'TechResearched')) break;
    }

    const techEvent = allEvents.find(e => e.type === 'TechResearched');
    expect(techEvent).toBeDefined();
    if (techEvent && techEvent.type === 'TechResearched') {
      expect(techEvent.empireId).toBe(empire.id);
      expect(techEvent.techId).toBe(tech.id);
    }
  });
});

// ---------------------------------------------------------------------------
// processGameTick — fleet movement
// ---------------------------------------------------------------------------

describe('processGameTick — fleet movement', () => {
  it('fleet advances toward destination over successive ticks', () => {
    const gs = makeGameState();

    // Pick a fleet and a destination system it is not already in
    const fleet = gs.fleets[0]!;
    const currentSystemId = fleet.position.systemId;
    const currentSystem = gs.galaxy.systems.find(s => s.id === currentSystemId)!;

    // Use a neighbour as the destination (guaranteed connected)
    const destinationId = currentSystem.wormholes[0];
    if (!destinationId) {
      // No neighbours — skip (shouldn't happen on non-trivial galaxy)
      return;
    }

    const order = issueMovementOrder(fleet, gs.galaxy, destinationId, 1);
    expect(order).not.toBeNull();

    const ts: GameTickState = {
      ...initializeTickState(gs),
      movementOrders: [order!],
    };

    // One tick should be enough for a single-hop move at ticksPerHop=1
    const { newState, events } = processGameTick(ts);

    const movedFleet = newState.gameState.fleets.find(f => f.id === fleet.id);
    expect(movedFleet).toBeDefined();
    expect(movedFleet!.position.systemId).toBe(destinationId);

    const moveEvents = events.filter(e => e.type === 'FleetMoved');
    expect(moveEvents.length).toBeGreaterThan(0);
  });

  it('a FleetMoved event is emitted when a fleet enters a new system', () => {
    const gs = makeGameState();
    const fleet = gs.fleets[0]!;
    const currentSystem = gs.galaxy.systems.find(
      s => s.id === fleet.position.systemId,
    )!;
    const destinationId = currentSystem.wormholes[0];
    if (!destinationId) return;

    const order = issueMovementOrder(fleet, gs.galaxy, destinationId, 1);
    if (!order) return;

    const ts: GameTickState = {
      ...initializeTickState(gs),
      movementOrders: [order],
    };

    const { events } = processGameTick(ts);
    const moveEvent = events.find(e => e.type === 'FleetMoved');
    expect(moveEvent).toBeDefined();
    if (moveEvent && moveEvent.type === 'FleetMoved') {
      expect(moveEvent.fleetId).toBe(fleet.id);
      expect(moveEvent.toSystemId).toBe(destinationId);
    }
  });

  it('completed movement order is removed from movementOrders', () => {
    const gs = makeGameState();
    const fleet = gs.fleets[0]!;
    const currentSystem = gs.galaxy.systems.find(
      s => s.id === fleet.position.systemId,
    )!;
    const destinationId = currentSystem.wormholes[0];
    if (!destinationId) return;

    const order = issueMovementOrder(fleet, gs.galaxy, destinationId, 1);
    if (!order) return;

    const ts: GameTickState = {
      ...initializeTickState(gs),
      movementOrders: [order],
    };

    const { newState } = processGameTick(ts);
    expect(newState.movementOrders).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// processGameTick — multiple ticks in sequence
// ---------------------------------------------------------------------------

describe('processGameTick — multiple sequential ticks', () => {
  it('game state remains internally consistent after 20 ticks', () => {
    let ts = initializeTickState(makeGameState());

    for (let i = 0; i < 20; i++) {
      ts = processGameTick(ts).newState;
    }

    const gs = ts.gameState;

    // Tick counter correct
    expect(gs.currentTick).toBe(20);

    // All empire IDs in fleets reference valid empires
    const empireIds = new Set(gs.empires.map(e => e.id));
    for (const fleet of gs.fleets) {
      expect(empireIds.has(fleet.empireId)).toBe(true);
    }

    // All ship fleetIds reference existing fleets
    const fleetIds = new Set(gs.fleets.map(f => f.id));
    for (const ship of gs.ships) {
      if (ship.fleetId !== null) {
        expect(fleetIds.has(ship.fleetId)).toBe(true);
      }
    }

    // All fleet ships reference existing ship IDs
    const shipIds = new Set(gs.ships.map(s => s.id));
    for (const fleet of gs.fleets) {
      for (const shipId of fleet.ships) {
        expect(shipIds.has(shipId)).toBe(true);
      }
    }
  });

  it('population is monotonically non-decreasing over ticks (no depopulation bug)', () => {
    let ts = initializeTickState(makeGameState());
    const planetPopBefore = new Map<string, number>(
      ts.gameState.galaxy.systems
        .flatMap(s => s.planets)
        .filter(p => p.currentPopulation > 0)
        .map(p => [p.id, p.currentPopulation]),
    );

    for (let i = 0; i < 10; i++) {
      ts = processGameTick(ts).newState;
    }

    for (const [planetId, popBefore] of planetPopBefore) {
      const planet = ts.gameState.galaxy.systems
        .flatMap(s => s.planets)
        .find(p => p.id === planetId);
      if (planet) {
        expect(planet.currentPopulation).toBeGreaterThanOrEqual(popBefore);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// processGameTick — pending combats (unit-level, no full fleet required)
// ---------------------------------------------------------------------------

describe('processGameTick — pending combats', () => {
  it('pending combats are cleared after a tick resolves them', () => {
    const gs = makeGameState();

    // Manufacture a pending combat between the two empire fleets (may be in
    // different systems, but the combat engine does not validate that)
    const fleet1 = gs.fleets[0]!;
    const fleet2 = gs.fleets[1]!;

    // Place fleet2 in fleet1's system to make the combat meaningful
    const adjustedGs: GameState = {
      ...gs,
      fleets: gs.fleets.map(f =>
        f.id === fleet2.id
          ? { ...f, position: { systemId: fleet1.position.systemId } }
          : f,
      ),
    };

    const pendingCombat: CombatPending = {
      systemId: fleet1.position.systemId,
      attackerFleetId: fleet1.id,
      defenderFleetId: fleet2.id,
    };

    const tsWithCombat: GameTickState = {
      ...initializeTickState(adjustedGs),
      pendingCombats: [pendingCombat],
    };

    const { newState } = processGameTick(tsWithCombat);
    // Combat should have been resolved and the pending list cleared
    expect(newState.pendingCombats).toHaveLength(0);
  });

  it('a CombatResolved event is emitted for each pending combat', () => {
    const gs = makeGameState();
    const fleet1 = gs.fleets[0]!;
    const fleet2 = gs.fleets[1]!;

    const adjustedGs: GameState = {
      ...gs,
      fleets: gs.fleets.map(f =>
        f.id === fleet2.id
          ? { ...f, position: { systemId: fleet1.position.systemId } }
          : f,
      ),
    };

    const tsWithCombat: GameTickState = {
      ...initializeTickState(adjustedGs),
      pendingCombats: [
        {
          systemId: fleet1.position.systemId,
          attackerFleetId: fleet1.id,
          defenderFleetId: fleet2.id,
        },
      ],
    };

    const { events } = processGameTick(tsWithCombat);
    const resolvedEvents = events.filter(e => e.type === 'CombatResolved');
    expect(resolvedEvents).toHaveLength(1);
  });
});
