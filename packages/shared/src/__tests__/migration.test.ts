/**
 * Tests for the multi-turn migration / colonisation system.
 *
 * Covers:
 *  - canStartMigration: eligibility checks
 *  - startMigration: order creation
 *  - processMigrationTick: wave logic, population transfer, status transitions
 *  - Integration: migration completes over multiple game ticks via processGameTick
 */

import { describe, it, expect } from 'vitest';
import {
  canStartMigration,
  startMigration,
  processMigrationTick,
  type MigrationOrder,
} from '../engine/colony.js';
import {
  processGameTick,
  initializeTickState,
  submitAction,
} from '../engine/game-loop.js';
import type { Planet, StarSystem } from '../types/galaxy.js';
import type { Species } from '../types/species.js';
import type { Empire } from '../types/species.js';
import type { GameState } from '../types/game-state.js';
import type { ColonisePlanetAction } from '../types/events.js';

// ── Shared fixtures ────────────────────────────────────────────────────────────

/** Human-like species compatible with terran worlds. */
function makeSpecies(overrides: Partial<Species> = {}): Species {
  return {
    id: 'humans',
    name: 'Humans',
    description: 'Standard bipedal species',
    portrait: 'human',
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
      idealTemperature: 293,
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.3,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
    ...overrides,
  };
}

/** Habitable, unowned target planet. */
function makeTargetPlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-target',
    name: 'New Hope',
    orbitalIndex: 2,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 293,
    naturalResources: 50,
    maxPopulation: 10_000_000,
    currentPopulation: 0,
    ownerId: null,
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

/** Populous source planet owned by the empire. */
function makeSourcePlanet(empireId: string, overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-source',
    name: 'Home World',
    orbitalIndex: 1,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 293,
    naturalResources: 60,
    maxPopulation: 20_000_000,
    currentPopulation: 5_000_000,
    ownerId: empireId,
    buildings: [{ id: 'b1', type: 'population_center', level: 1 }],
    productionQueue: [],
    ...overrides,
  };
}

/** Star system with a source and a target planet. */
function makeSystem(empireId: string, targetOverrides: Partial<Planet> = {}): StarSystem {
  return {
    id: 'system-alpha',
    name: 'Alpha',
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [makeSourcePlanet(empireId), makeTargetPlanet(targetOverrides)],
    wormholes: [],
    ownerId: null,
    discovered: { [empireId]: true },
  };
}

const EMPIRE_ID = 'empire-1';

// ── canStartMigration ──────────────────────────────────────────────────────────

describe('canStartMigration', () => {
  it('is allowed when source has sufficient population and target is unowned', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canStartMigration(
      system, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns a positive cost even when allowed', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canStartMigration(
      system, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.cost).toBeGreaterThan(0);
  });

  it('is rejected when source planet has too little population (< 100)', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID, {});
    // Override source planet to have only 50 population.
    const lowPopSystem: StarSystem = {
      ...system,
      planets: system.planets.map(p =>
        p.id === 'planet-source' ? { ...p, currentPopulation: 50 } : p,
      ),
    };
    const result = canStartMigration(
      lowPopSystem, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/too low/i);
  });

  it('is rejected when source planet has exactly 99 population', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const tooSmallSystem: StarSystem = {
      ...system,
      planets: system.planets.map(p =>
        p.id === 'planet-source' ? { ...p, currentPopulation: 99 } : p,
      ),
    };
    const result = canStartMigration(
      tooSmallSystem, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.allowed).toBe(false);
  });

  it('is allowed when source planet has exactly 100 population', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const exactSystem: StarSystem = {
      ...system,
      planets: system.planets.map(p =>
        p.id === 'planet-source' ? { ...p, currentPopulation: 100 } : p,
      ),
    };
    const result = canStartMigration(
      exactSystem, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.allowed).toBe(true);
  });

  it('is rejected when target planet is already owned', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID, { ownerId: 'empire-2' });
    const result = canStartMigration(
      system, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already owned/i);
  });

  it('is rejected when target is a gas giant', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID, {
      type: 'gas_giant',
      atmosphere: 'hydrogen_helium',
      gravity: 2.5,
      temperature: 130,
    });
    const result = canStartMigration(
      system, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/gas giant/i);
  });

  it('is rejected when target habitability is below minimum threshold', () => {
    const species = makeSpecies();
    const hostileTarget = makeTargetPlanet({
      atmosphere: 'hydrogen_helium',
      gravity: 3.0,
      temperature: 30,
    });
    const system: StarSystem = {
      id: 'system-gamma',
      name: 'Gamma',
      position: { x: 0, y: 0 },
      starType: 'red_dwarf',
      planets: [makeSourcePlanet(EMPIRE_ID), hostileTarget],
      wormholes: [],
      ownerId: null,
      discovered: {},
    };
    const result = canStartMigration(
      system, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/habitability/i);
  });

  it('is rejected when the empire cannot afford the cost', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canStartMigration(
      system, 'planet-source', 'planet-target', EMPIRE_ID, species, 0,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/insufficient credits/i);
  });

  it('is rejected when a migration to that target is already active', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const existingOrder: MigrationOrder = {
      id: 'order-existing',
      empireId: EMPIRE_ID,
      systemId: 'system-alpha',
      sourcePlanetId: 'planet-source',
      targetPlanetId: 'planet-target',
      arrivedPopulation: 10,
      threshold: 50,
      ticksToNextWave: 2,
      wavePeriod: 3,
      status: 'migrating',
      totalCost: 200,
    };
    const result = canStartMigration(
      system, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
      [existingOrder],
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already in progress/i);
  });

  it('allows a second migration to the same target if the first is completed', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const completedOrder: MigrationOrder = {
      id: 'order-done',
      empireId: EMPIRE_ID,
      systemId: 'system-alpha',
      sourcePlanetId: 'planet-source',
      targetPlanetId: 'planet-target',
      arrivedPopulation: 50,
      threshold: 50,
      ticksToNextWave: 0,
      wavePeriod: 3,
      status: 'established',
      totalCost: 200,
    };
    // Target must also be unowned for this to proceed — reset it.
    const unownedSystem: StarSystem = {
      ...system,
      planets: system.planets.map(p =>
        p.id === 'planet-target' ? { ...p, ownerId: null, currentPopulation: 0 } : p,
      ),
    };
    const result = canStartMigration(
      unownedSystem, 'planet-source', 'planet-target', EMPIRE_ID, species, 10_000,
      [completedOrder],
    );
    expect(result.allowed).toBe(true);
  });
});

// ── startMigration ─────────────────────────────────────────────────────────────

describe('startMigration', () => {
  it('creates a valid MigrationOrder with correct fields', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const order = startMigration(system, 'planet-source', 'planet-target', EMPIRE_ID, species);

    expect(order.id).toBeTruthy();
    expect(order.empireId).toBe(EMPIRE_ID);
    expect(order.systemId).toBe('system-alpha');
    expect(order.sourcePlanetId).toBe('planet-source');
    expect(order.targetPlanetId).toBe('planet-target');
    expect(order.arrivedPopulation).toBe(0);
    expect(order.threshold).toBe(50);
    expect(order.wavePeriod).toBe(3);
    expect(order.status).toBe('migrating');
    expect(order.totalCost).toBeGreaterThan(0);
  });

  it('sets ticksToNextWave to 0 so first wave departs on the very next tick', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const order = startMigration(system, 'planet-source', 'planet-target', EMPIRE_ID, species);
    expect(order.ticksToNextWave).toBe(0);
  });

  it('throws if the target planet does not exist in the system', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    expect(() =>
      startMigration(system, 'planet-source', 'nonexistent', EMPIRE_ID, species),
    ).toThrow();
  });
});

// ── processMigrationTick ───────────────────────────────────────────────────────

describe('processMigrationTick', () => {
  function makeOrder(overrides: Partial<MigrationOrder> = {}): MigrationOrder {
    return {
      id: 'order-1',
      empireId: EMPIRE_ID,
      systemId: 'system-alpha',
      sourcePlanetId: 'planet-source',
      targetPlanetId: 'planet-target',
      arrivedPopulation: 0,
      threshold: 50,
      ticksToNextWave: 0,
      wavePeriod: 3,
      status: 'migrating',
      totalCost: 200,
      ...overrides,
    };
  }

  it('decrements ticksToNextWave when > 0 without sending a wave', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 2 });
    const { order: updated, system: updatedSystem, events } = processMigrationTick(order, system);

    expect(updated.ticksToNextWave).toBe(1);
    expect(events).toHaveLength(0);
    // Population unchanged.
    const source = updatedSystem.planets.find(p => p.id === 'planet-source')!;
    expect(source.currentPopulation).toBe(5_000_000);
  });

  it('sends a wave when ticksToNextWave is 0', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 0 });
    const { events } = processMigrationTick(order, system);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatch(/departed/i);
  });

  it('decreases source planet population after a wave', () => {
    const system = makeSystem(EMPIRE_ID);
    const originalPop = system.planets.find(p => p.id === 'planet-source')!.currentPopulation;
    const order = makeOrder({ ticksToNextWave: 0 });
    const { system: updated } = processMigrationTick(order, system);

    const sourcePop = updated.planets.find(p => p.id === 'planet-source')!.currentPopulation;
    expect(sourcePop).toBeLessThan(originalPop);
  });

  it('increases target planet population after a wave (minus 10% transit loss)', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 0 });
    const { order: updatedOrder, system: updatedSystem } = processMigrationTick(order, system);

    const targetPop = updatedSystem.planets.find(p => p.id === 'planet-target')!.currentPopulation;
    expect(targetPop).toBeGreaterThan(0);
    // arrived = departed - floor(departed * 0.1)
    expect(updatedOrder.arrivedPopulation).toBeGreaterThan(0);
  });

  it('applies a 10% transit loss (rounded down)', () => {
    // Use a small source population to get a deterministic wave size.
    const smallSourcePop = 100;
    const system: StarSystem = {
      ...makeSystem(EMPIRE_ID),
      planets: makeSystem(EMPIRE_ID).planets.map(p =>
        p.id === 'planet-source' ? { ...p, currentPopulation: smallSourcePop } : p,
      ),
    };
    const order = makeOrder({ ticksToNextWave: 0 });
    const { order: updated, system: updatedSystem } = processMigrationTick(order, system);

    const targetPop = updatedSystem.planets.find(p => p.id === 'planet-target')!.currentPopulation;
    const sourcePop = updatedSystem.planets.find(p => p.id === 'planet-source')!.currentPopulation;
    const departed = smallSourcePop - sourcePop;

    // Transit loss = floor(departed * 0.1)
    const expectedLost = Math.floor(departed * 0.1);
    const expectedArrived = departed - expectedLost;
    expect(targetPop).toBe(expectedArrived);
    expect(updated.arrivedPopulation).toBe(expectedArrived);
  });

  it('resets ticksToNextWave to wavePeriod after a wave', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 0, wavePeriod: 3 });
    const { order: updated } = processMigrationTick(order, system);
    expect(updated.ticksToNextWave).toBe(3);
  });

  it('sets ownerId on the target planet when the first wave arrives', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 0 });
    const { system: updated } = processMigrationTick(order, system);

    const target = updated.planets.find(p => p.id === 'planet-target')!;
    expect(target.ownerId).toBe(EMPIRE_ID);
  });

  it('does not change ownerId if it was already set by an earlier wave', () => {
    // Simulate target already having an ownerId from a previous wave.
    const system: StarSystem = {
      ...makeSystem(EMPIRE_ID),
      planets: makeSystem(EMPIRE_ID).planets.map(p =>
        p.id === 'planet-target' ? { ...p, ownerId: EMPIRE_ID, currentPopulation: 5 } : p,
      ),
    };
    const order = makeOrder({ ticksToNextWave: 0, arrivedPopulation: 5 });
    const { system: updated } = processMigrationTick(order, system);

    const target = updated.planets.find(p => p.id === 'planet-target')!;
    expect(target.ownerId).toBe(EMPIRE_ID);
  });

  it('changes status to "established" when arrivedPopulation reaches threshold', () => {
    const system = makeSystem(EMPIRE_ID);
    // Pre-set arrivedPopulation just below threshold so the next wave pushes it over.
    // With a 5M source, wave size is capped at 3 (max wave) → arrived ≈ 2–3.
    // Set arrivedPopulation = threshold - 1 to guarantee establishment.
    const order = makeOrder({ ticksToNextWave: 0, arrivedPopulation: 49 });
    const { order: updated } = processMigrationTick(order, system);

    expect(updated.status).toBe('established');
  });

  it('stays "migrating" when arrivedPopulation is below threshold', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 0, arrivedPopulation: 0 });
    const { order: updated } = processMigrationTick(order, system);

    // With threshold 50 and max wave 3, one tick will not reach 50.
    expect(updated.status).toBe('migrating');
  });

  it('wave size is capped at 10% of source population', () => {
    // Source has exactly 10 people → 10% = 1, so at most 1 migrant per wave.
    const tinySourcePop = 10;
    const system: StarSystem = {
      ...makeSystem(EMPIRE_ID),
      planets: makeSystem(EMPIRE_ID).planets.map(p =>
        p.id === 'planet-source' ? { ...p, currentPopulation: tinySourcePop } : p,
      ),
    };
    const order = makeOrder({ ticksToNextWave: 0 });
    const { system: updated } = processMigrationTick(order, system);

    const sourcePop = updated.planets.find(p => p.id === 'planet-source')!.currentPopulation;
    const departed = tinySourcePop - sourcePop;
    // 10% of 10 = 1 → max 1 person can depart.
    expect(departed).toBe(1);
  });

  it('does not mutate the original order or system', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 0 });
    const originalSourcePop = system.planets.find(p => p.id === 'planet-source')!.currentPopulation;
    processMigrationTick(order, system);

    expect(order.arrivedPopulation).toBe(0);
    expect(order.ticksToNextWave).toBe(0);
    expect(system.planets.find(p => p.id === 'planet-source')!.currentPopulation).toBe(originalSourcePop);
  });

  it('returns no events when not yet time for a wave', () => {
    const system = makeSystem(EMPIRE_ID);
    const order = makeOrder({ ticksToNextWave: 1 });
    const { events } = processMigrationTick(order, system);
    expect(events).toHaveLength(0);
  });
});

// ── Integration: migration completes over multiple game ticks ──────────────────

describe('Integration: migration completes over multiple game ticks', () => {
  const INT_EMPIRE_ID = 'empire-int';

  function makeIntSpecies(): Species {
    return makeSpecies({ id: INT_EMPIRE_ID });
  }

  function makeIntGameState(): GameState {
    const species = makeIntSpecies();
    const empire: Empire = {
      id: INT_EMPIRE_ID,
      name: 'Terran Union',
      species,
      color: '#00aaff',
      credits: 10_000,
      researchPoints: 0,
      knownSystems: ['system-int'],
      diplomacy: [],
      technologies: [],
      currentAge: 'nano_atomic',
      isAI: false,
      government: 'democracy',
    };

    const system: StarSystem = {
      id: 'system-int',
      name: 'Integration System',
      position: { x: 0, y: 0 },
      starType: 'yellow',
      planets: [
        makeSourcePlanet(INT_EMPIRE_ID, { id: 'planet-source-int' }),
        makeTargetPlanet({ id: 'planet-target-int', name: 'New World' }),
      ],
      wormholes: [],
      ownerId: null,
      discovered: { [INT_EMPIRE_ID]: true },
    };

    return {
      id: 'game-int-test',
      galaxy: {
        id: 'galaxy-int',
        systems: [system],
        width: 100,
        height: 100,
        seed: 1,
      },
      empires: [empire],
      fleets: [],
      ships: [],
      currentTick: 1,
      speed: 'normal',
      status: 'playing',
    };
  }

  it('MigrationStarted event is emitted on the first tick', () => {
    const gameState = makeIntGameState();
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: INT_EMPIRE_ID,
      systemId: 'system-int',
      planetId: 'planet-target-int',
    };
    const tickState = submitAction(initializeTickState(gameState), INT_EMPIRE_ID, action);
    const { events } = processGameTick(tickState);

    expect(events.some(e => e.type === 'MigrationStarted')).toBe(true);
  });

  it('migration completes and ColonyEstablished event is emitted after enough ticks', () => {
    const gameState = makeIntGameState();
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: INT_EMPIRE_ID,
      systemId: 'system-int',
      planetId: 'planet-target-int',
    };
    let tickState = submitAction(initializeTickState(gameState), INT_EMPIRE_ID, action);

    let establishedEventSeen = false;
    // Run up to 1000 ticks to ensure we eventually reach the threshold.
    for (let i = 0; i < 1000; i++) {
      const { newState, events } = processGameTick(tickState);
      tickState = newState;

      if (events.some(e => e.type === 'ColonyEstablished')) {
        establishedEventSeen = true;
        break;
      }
    }

    expect(establishedEventSeen).toBe(true);
  });

  it('target planet is owned by the empire once the colony is established', () => {
    const gameState = makeIntGameState();
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: INT_EMPIRE_ID,
      systemId: 'system-int',
      planetId: 'planet-target-int',
    };
    let tickState = submitAction(initializeTickState(gameState), INT_EMPIRE_ID, action);

    for (let i = 0; i < 1000; i++) {
      const { newState, events } = processGameTick(tickState);
      tickState = newState;

      if (events.some(e => e.type === 'ColonyEstablished')) {
        break;
      }
    }

    const system = tickState.gameState.galaxy.systems.find(s => s.id === 'system-int')!;
    const target = system.planets.find(p => p.id === 'planet-target-int')!;
    expect(target.ownerId).toBe(INT_EMPIRE_ID);
  });

  it('migration order is removed from state after establishment', () => {
    const gameState = makeIntGameState();
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: INT_EMPIRE_ID,
      systemId: 'system-int',
      planetId: 'planet-target-int',
    };
    let tickState = submitAction(initializeTickState(gameState), INT_EMPIRE_ID, action);

    for (let i = 0; i < 1000; i++) {
      const { newState, events } = processGameTick(tickState);
      tickState = newState;

      if (events.some(e => e.type === 'ColonyEstablished')) {
        break;
      }
    }

    const activeOrders = tickState.migrationOrders.filter(o => o.status === 'migrating');
    expect(activeOrders).toHaveLength(0);
  });

  it('ColonyEstablished event carries the correct planet name', () => {
    const gameState = makeIntGameState();
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: INT_EMPIRE_ID,
      systemId: 'system-int',
      planetId: 'planet-target-int',
    };
    let tickState = submitAction(initializeTickState(gameState), INT_EMPIRE_ID, action);

    let establishedEvent: import('../types/events.js').ColonyEstablishedEvent | undefined;
    for (let i = 0; i < 1000; i++) {
      const { newState, events } = processGameTick(tickState);
      tickState = newState;

      const ev = events.find(e => e.type === 'ColonyEstablished');
      if (ev?.type === 'ColonyEstablished') {
        establishedEvent = ev;
        break;
      }
    }

    expect(establishedEvent).toBeDefined();
    expect(establishedEvent?.planetName).toBe('New World');
    expect(establishedEvent?.empireId).toBe(INT_EMPIRE_ID);
    expect(establishedEvent?.planetId).toBe('planet-target-int');
  });

  it('MigrationWave events are emitted during migration', () => {
    const gameState = makeIntGameState();
    const action: ColonisePlanetAction = {
      type: 'ColonisePlanet',
      empireId: INT_EMPIRE_ID,
      systemId: 'system-int',
      planetId: 'planet-target-int',
    };
    let tickState = submitAction(initializeTickState(gameState), INT_EMPIRE_ID, action);

    const waveEvents: import('../types/events.js').MigrationWaveEvent[] = [];
    for (let i = 0; i < 1000; i++) {
      const { newState, events } = processGameTick(tickState);
      tickState = newState;

      for (const ev of events) {
        if (ev.type === 'MigrationWave') waveEvents.push(ev);
      }

      if (events.some(e => e.type === 'ColonyEstablished')) break;
    }

    expect(waveEvents.length).toBeGreaterThan(0);
    // Each wave event should have sensible values.
    for (const wv of waveEvents) {
      expect(wv.departed).toBeGreaterThan(0);
      expect(wv.arrived).toBeGreaterThanOrEqual(0);
      expect(wv.lost).toBeGreaterThanOrEqual(0);
      expect(wv.departed).toBe(wv.arrived + wv.lost);
    }
  });
});
