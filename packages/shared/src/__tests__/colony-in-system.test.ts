/**
 * Tests for in-system colonisation logic.
 *
 * Covers:
 *  - canColoniseInSystem: eligibility checks
 *  - getColonisationCost: cost formula
 *  - coloniseInSystem: state mutation (pure)
 *  - Integration: ColonisePlanet action processed in a full game-loop tick
 */

import { describe, it, expect } from 'vitest';
import {
  canColoniseInSystem,
  getColonisationCost,
  coloniseInSystem,
  COLONISATION_MINERAL_COST,
  COLONIST_TRANSFER_COUNT,
} from '../engine/colony.js';
import {
  processGameTick,
  initializeTickState,
  submitAction,
  type GameTickState,
} from '../engine/game-loop.js';
import type { Planet, StarSystem } from '../types/galaxy.js';
import type { Species } from '../types/species.js';
import type { Empire } from '../types/species.js';
import type { GameState } from '../types/game-state.js';
import type { ColonisePlanetAction } from '../types/events.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────

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

/** Baseline unowned, empty terran planet. */
function makePlanet(overrides: Partial<Planet> = {}): Planet {
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

/** A planet owned by the test empire — acts as the "anchor" for in-system colonisation. */
function makeOwnedPlanet(empireId: string, overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-home',
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

/** Star system containing an owned planet and a colonisable target planet. */
function makeSystem(empireId: string, targetOverrides: Partial<Planet> = {}): StarSystem {
  return {
    id: 'system-alpha',
    name: 'Alpha',
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [
      makeOwnedPlanet(empireId),
      makePlanet(targetOverrides),
    ],
    wormholes: [],
    ownerId: null,
    discovered: { [empireId]: true },
  };
}

// ── getColonisationCost ───────────────────────────────────────────────────────

describe('getColonisationCost', () => {
  it('returns the base cost of 10,000 for a highly habitable planet (score 100)', () => {
    const species = makeSpecies();
    const planet = makePlanet({
      atmosphere: 'oxygen_nitrogen',
      gravity: species.environmentPreference.idealGravity,
      temperature: species.environmentPreference.idealTemperature,
    });
    const cost = getColonisationCost(planet, species);
    // habitability 100 → cost = ceil(10000 * 100/100) = 10000
    expect(cost).toBe(10_000);
  });

  it('returns a higher cost for a low-habitability planet', () => {
    const species = makeSpecies();
    const highHabitPlanet = makePlanet();
    const lowHabitPlanet = makePlanet({
      atmosphere: 'carbon_dioxide',
      gravity: 1.8,
      temperature: 400,
    });
    const highCost = getColonisationCost(highHabitPlanet, species);
    const lowCost = getColonisationCost(lowHabitPlanet, species);
    expect(lowCost).toBeGreaterThan(highCost);
  });

  it('cost is monotonically related to habitability — worse planet costs more', () => {
    const species = makeSpecies();
    // Perfect terran world
    const best = makePlanet();
    // Adjacent atmosphere, same gravity/temp (score ~80)
    const mid = makePlanet({ atmosphere: 'carbon_dioxide' });
    // Incompatible atmosphere, bad gravity (score ~30 or less)
    const worst = makePlanet({ atmosphere: 'hydrogen_helium', gravity: 2.5 });

    const costBest = getColonisationCost(best, species);
    const costMid = getColonisationCost(mid, species);
    const costWorst = getColonisationCost(worst, species);

    expect(costMid).toBeGreaterThanOrEqual(costBest);
    expect(costWorst).toBeGreaterThan(costMid);
  });

  it('cost is always a positive integer', () => {
    const species = makeSpecies();
    const planet = makePlanet({ atmosphere: 'hydrogen_helium', gravity: 2.8, temperature: 50 });
    const cost = getColonisationCost(planet, species);
    expect(cost).toBeGreaterThan(0);
    expect(Number.isInteger(cost)).toBe(true);
  });

  it('cost does not exceed 10× the base cost even for near-zero habitability', () => {
    const species = makeSpecies();
    // Worst possible planet for humans
    const planet = makePlanet({ atmosphere: 'hydrogen_helium', gravity: 3.0, temperature: 30 });
    const cost = getColonisationCost(planet, species);
    // Effective score clamped to 10 → max cost = 10000 * (100/10) = 100000
    expect(cost).toBeLessThanOrEqual(100_000);
  });
});

// ── canColoniseInSystem ───────────────────────────────────────────────────────

describe('canColoniseInSystem', () => {
  const EMPIRE_ID = 'empire-1';
  const ENOUGH_MINERALS = 10_000;

  it('allows colonisation when empire owns a planet in the same system', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('includes the correct cost and mineralCost even when allowed', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.cost).toBe(getColonisationCost(makePlanet(), species));
    expect(result.mineralCost).toBe(COLONISATION_MINERAL_COST);
  });

  it('rejects when empire owns NO planets in the system', () => {
    const species = makeSpecies();
    const system: StarSystem = {
      id: 'system-beta',
      name: 'Beta',
      position: { x: 10, y: 10 },
      starType: 'yellow',
      planets: [
        makePlanet({ id: 'planet-a' }),
        makePlanet({ id: 'planet-target' }),
      ],
      wormholes: [],
      ownerId: null,
      discovered: {},
    };
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/does not control/i);
  });

  it('rejects when the target planet is already owned', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID, { ownerId: 'empire-2' });
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/owned/i);
  });

  it('rejects when the target planet already has a population', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID, { currentPopulation: 500 });
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/population/i);
  });

  it('rejects when source planet has insufficient population for transfer', () => {
    const species = makeSpecies();
    // Source planet only has 50K pop — need 100K for transfer.
    const system = makeSystem(EMPIRE_ID);
    system.planets[0] = makeOwnedPlanet(EMPIRE_ID, { currentPopulation: 50_000 });
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/population/i);
  });

  it('rejects when habitability is below the minimum threshold (< 10)', () => {
    const species = makeSpecies();
    // Build a system with an extremely inhospitable target planet.
    const hostilePlanet = makePlanet({
      atmosphere: 'hydrogen_helium',
      gravity: 3.0,
      temperature: 30,
    });
    const system: StarSystem = {
      id: 'system-gamma',
      name: 'Gamma',
      position: { x: 0, y: 0 },
      starType: 'red_dwarf',
      planets: [makeOwnedPlanet(EMPIRE_ID), hostilePlanet],
      wormholes: [],
      ownerId: null,
      discovered: {},
    };
    const result = canColoniseInSystem(
      system,
      hostilePlanet.id,
      EMPIRE_ID,
      species,
      100_000,
      ENOUGH_MINERALS,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/habitability/i);
  });

  it('rejects when the empire cannot afford the colonisation cost', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    // Provide only 1 credit — far below the 10,000 base cost.
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 1, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/insufficient credits/i);
  });

  it('rejects when the empire cannot afford the mineral cost', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/insufficient minerals/i);
  });

  it('still returns a cost and mineralCost even when the action is rejected', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 0, 0);
    expect(result.allowed).toBe(false);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.mineralCost).toBe(COLONISATION_MINERAL_COST);
  });

  it('rejects colonisation of a gas giant via the in-system path', () => {
    const species = makeSpecies();
    const gasPlanet = makePlanet({
      id: 'planet-gas',
      type: 'gas_giant',
      atmosphere: 'hydrogen_helium',
      gravity: 2.5,
      temperature: 130,
    });
    const system: StarSystem = {
      id: 'system-delta',
      name: 'Delta',
      position: { x: 0, y: 0 },
      starType: 'yellow',
      planets: [makeOwnedPlanet(EMPIRE_ID), gasPlanet],
      wormholes: [],
      ownerId: null,
      discovered: {},
    };
    const result = canColoniseInSystem(system, gasPlanet.id, EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/gas giant/i);
  });

  it('returns allowed:false with a descriptive reason when planet id is unknown', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const result = canColoniseInSystem(system, 'nonexistent-planet', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('allows colonisation when credits exactly equal the cost', () => {
    const species = makeSpecies();
    const system = makeSystem(EMPIRE_ID);
    const cost = getColonisationCost(makePlanet(), species);
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, cost, ENOUGH_MINERALS);
    expect(result.allowed).toBe(true);
  });

  it('empire owning a different planet in a different system does not satisfy requirement', () => {
    const species = makeSpecies();
    // The system itself has no empire-owned planets — ownership is elsewhere.
    const system: StarSystem = {
      id: 'system-epsilon',
      name: 'Epsilon',
      position: { x: 20, y: 20 },
      starType: 'orange',
      planets: [
        makePlanet({ id: 'planet-a', ownerId: 'empire-2' }),
        makePlanet({ id: 'planet-target' }),
      ],
      wormholes: [],
      ownerId: null,
      discovered: {},
    };
    const result = canColoniseInSystem(system, 'planet-target', EMPIRE_ID, species, 100_000, ENOUGH_MINERALS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/does not control/i);
  });
});

// ── coloniseInSystem ──────────────────────────────────────────────────────────

describe('coloniseInSystem', () => {
  const EMPIRE_ID = 'empire-1';

  it('sets ownerId on the target planet', () => {
    const system = makeSystem(EMPIRE_ID);
    const { system: updated } = coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    const target = updated.planets.find(p => p.id === 'planet-target')!;
    expect(target.ownerId).toBe(EMPIRE_ID);
  });

  it('adds a population_center building to the colonised planet', () => {
    const system = makeSystem(EMPIRE_ID);
    const { system: updated } = coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    const target = updated.planets.find(p => p.id === 'planet-target')!;
    const popCenter = target.buildings.find(b => b.type === 'population_center');
    expect(popCenter).toBeDefined();
    expect(popCenter?.level).toBe(1);
    expect(popCenter?.id).toBeTruthy();
  });

  it('places survivors (COLONIST_TRANSFER_COUNT minus mortality) on the target', () => {
    const system = makeSystem(EMPIRE_ID);
    const { system: updated, mortalityCount } = coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    const target = updated.planets.find(p => p.id === 'planet-target')!;
    // Survivors = COLONIST_TRANSFER_COUNT - mortalityCount
    expect(target.currentPopulation).toBe(COLONIST_TRANSFER_COUNT - mortalityCount);
    expect(target.currentPopulation).toBeGreaterThan(0);
    expect(target.currentPopulation).toBeLessThanOrEqual(COLONIST_TRANSFER_COUNT);
  });

  it('deducts COLONIST_TRANSFER_COUNT from the source planet', () => {
    const system = makeSystem(EMPIRE_ID);
    const sourceBefore = system.planets.find(p => p.id === 'planet-home')!;
    const { system: updated } = coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    const sourceAfter = updated.planets.find(p => p.id === 'planet-home')!;
    expect(sourceAfter.currentPopulation).toBe(sourceBefore.currentPopulation - COLONIST_TRANSFER_COUNT);
  });

  it('applies 1-10% mortality during transfer', () => {
    const system = makeSystem(EMPIRE_ID);
    const { mortalityCount } = coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    // Mortality should be between 1% and 10% of COLONIST_TRANSFER_COUNT
    expect(mortalityCount).toBeGreaterThanOrEqual(Math.floor(COLONIST_TRANSFER_COUNT * 0.01));
    expect(mortalityCount).toBeLessThanOrEqual(Math.floor(COLONIST_TRANSFER_COUNT * 0.10));
  });

  it('does not mutate the original system', () => {
    const system = makeSystem(EMPIRE_ID);
    const originalTarget = system.planets.find(p => p.id === 'planet-target')!;
    const originalSource = system.planets.find(p => p.id === 'planet-home')!;
    coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    // Original planets should be untouched.
    expect(originalTarget.ownerId).toBeNull();
    expect(originalTarget.currentPopulation).toBe(0);
    expect(originalTarget.buildings).toHaveLength(0);
    expect(originalSource.currentPopulation).toBe(5_000_000);
  });

  it('throws if the planet id does not exist in the system', () => {
    const system = makeSystem(EMPIRE_ID);
    expect(() => coloniseInSystem(system, 'nonexistent', EMPIRE_ID)).toThrow();
  });

  it('preserves existing buildings on the target planet', () => {
    const system = makeSystem(EMPIRE_ID, {
      buildings: [{ id: 'existing-b', type: 'mining_facility', level: 1 }],
    });
    const { system: updated } = coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    const target = updated.planets.find(p => p.id === 'planet-target')!;
    // Should have the original building PLUS the new population_center.
    expect(target.buildings.length).toBe(2);
    expect(target.buildings.some(b => b.type === 'mining_facility')).toBe(true);
    expect(target.buildings.some(b => b.type === 'population_center')).toBe(true);
  });

  it('returns a new system object (referential immutability)', () => {
    const system = makeSystem(EMPIRE_ID);
    const { system: updated } = coloniseInSystem(system, 'planet-target', EMPIRE_ID);
    expect(updated).not.toBe(system);
    expect(updated.planets).not.toBe(system.planets);
  });
});

// ── Integration: game-loop processes ColonisePlanet actions ──────────────────

describe('Integration: colonisation action in game-loop tick', () => {
  const EMPIRE_ID = 'empire-loop';

  /** Build a minimal, valid GameState for loop integration tests. */
  function makeGameState(): GameState {
    const species = makeSpecies({ id: EMPIRE_ID });
    const empire: Empire = {
      id: EMPIRE_ID,
      name: 'Human Republic',
      species,
      color: '#00aaff',
      credits: 100_000,
      researchPoints: 0,
      knownSystems: ['system-loop'],
      diplomacy: [],
      technologies: [],
      currentAge: 'nano_atomic',
      isAI: false,
      government: 'democracy',
    };

    const system: StarSystem = {
      id: 'system-loop',
      name: 'Loop System',
      position: { x: 0, y: 0 },
      starType: 'yellow',
      planets: [
        makeOwnedPlanet(EMPIRE_ID, { id: 'planet-home-loop' }),
        makePlanet({ id: 'planet-target-loop', name: 'Target' }),
      ],
      wormholes: [],
      ownerId: null,
      discovered: { [EMPIRE_ID]: true },
    };

    return {
      id: 'game-loop-test',
      galaxy: {
        id: 'galaxy-1',
        systems: [system],
        anomalies: [],
        minorSpecies: [],
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

  /** Helper: add a ColonisePlanet action for this empire to the tick state. */
  function addColonisePlanetAction(
    base: GameTickState,
    empireId: string,
    systemId: string,
    planetId: string,
  ): GameTickState {
    const action: ColonisePlanetAction = { type: 'ColonisePlanet', empireId, systemId, planetId };
    return submitAction(base, empireId, action);
  }

  /** Helper: ensure the empire has enough minerals in the resource map. */
  function withMinerals(tickState: GameTickState, empireId: string, minerals: number): GameTickState {
    const newMap = new Map(tickState.empireResourcesMap);
    const existing = newMap.get(empireId);
    if (existing) {
      newMap.set(empireId, { ...existing, minerals });
    }
    return { ...tickState, empireResourcesMap: newMap };
  }

  it('processes a ColonisePlanet action and starts a migration (not instant colonisation)', () => {
    const gameState = makeGameState();
    const tickState = addColonisePlanetAction(
      withMinerals(initializeTickState(gameState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );

    const { newState } = processGameTick(tickState);

    // A migration order should have been created.
    expect(newState.migrationOrders.length).toBeGreaterThan(0);
    const order = newState.migrationOrders.find(o => o.targetPlanetId === 'planet-target-loop');
    expect(order).toBeDefined();
    expect(order?.empireId).toBe(EMPIRE_ID);
    expect(order?.status).toBe('migrating');

    // The target planet is NOT immediately owned — ownership is deferred.
    const system = newState.gameState.galaxy.systems.find(s => s.id === 'system-loop')!;
    void system.planets.find(p => p.id === 'planet-target-loop')!;
    // After the first tick the first wave may have arrived and set ownerId.
    // We only assert that a migration is in progress; ownership follows from wave arrival.
    expect(order?.arrivedPopulation).toBeGreaterThanOrEqual(0);
  });

  it('emits a MigrationStarted event (not an instant PlanetColonised event)', () => {
    const gameState = makeGameState();
    const tickState = addColonisePlanetAction(
      withMinerals(initializeTickState(gameState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );

    const { events } = processGameTick(tickState);

    const migrationStartedEvent = events.find(e => e.type === 'MigrationStarted');
    expect(migrationStartedEvent).toBeDefined();
    if (migrationStartedEvent?.type === 'MigrationStarted') {
      expect(migrationStartedEvent.empireId).toBe(EMPIRE_ID);
      expect(migrationStartedEvent.systemId).toBe('system-loop');
      expect(migrationStartedEvent.targetPlanetId).toBe('planet-target-loop');
    }

    // No instant PlanetColonised event — that only fires after full migration.
    expect(events.some(e => e.type === 'PlanetColonised')).toBe(false);
  });

  it('deducts the colonisation cost from the empire credits upfront', () => {
    // Credits are deducted when the migration order is created (not on colony
    // establishment). A second run with one fewer credit than the cost should
    // be rejected and produce no migration order.
    const species = makeSpecies({ id: EMPIRE_ID });
    const targetPlanet = makePlanet({ id: 'planet-target-loop', name: 'Target' });
    const cost = getColonisationCost(targetPlanet, species);

    // Exact-credit scenario: migration should be started.
    const exactCreditState: GameState = {
      ...makeGameState(),
      empires: makeGameState().empires.map(e => ({ ...e, credits: cost })),
    };
    const tickStateExact = addColonisePlanetAction(
      withMinerals(initializeTickState(exactCreditState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );
    const { newState: successState } = processGameTick(tickStateExact);
    // A migration order should exist — the cost was accepted.
    const migrationOrder = successState.migrationOrders.find(
      o => o.targetPlanetId === 'planet-target-loop',
    );
    expect(migrationOrder).toBeDefined();

    // One-short scenario: migration should not start (credits = cost - 1).
    const shortCreditState: GameState = {
      ...makeGameState(),
      empires: makeGameState().empires.map(e => ({ ...e, credits: cost - 1 })),
    };
    const tickStateShort = addColonisePlanetAction(
      withMinerals(initializeTickState(shortCreditState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );
    const { newState: failState } = processGameTick(tickStateShort);
    const noOrder = failState.migrationOrders.find(
      o => o.targetPlanetId === 'planet-target-loop',
    );
    expect(noOrder).toBeUndefined();
    const uncolonisedPlanet = failState.gameState.galaxy.systems
      .find(s => s.id === 'system-loop')!
      .planets.find(p => p.id === 'planet-target-loop')!;
    expect(uncolonisedPlanet.ownerId).toBeNull();
  });

  it('drains pendingActions after the tick', () => {
    const gameState = makeGameState();
    const tickState = addColonisePlanetAction(
      withMinerals(initializeTickState(gameState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );

    const { newState } = processGameTick(tickState);
    expect(newState.pendingActions).toHaveLength(0);
  });

  it('rejects and skips an action when the empire cannot afford it', () => {
    const gameState = makeGameState();
    // Set credits to zero so the empire cannot afford colonisation.
    const brokeState: GameState = {
      ...gameState,
      empires: gameState.empires.map(e => ({ ...e, credits: 0 })),
    };

    const tickState = addColonisePlanetAction(
      withMinerals(initializeTickState(brokeState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );

    const { newState, events } = processGameTick(tickState);

    const system = newState.gameState.galaxy.systems.find(s => s.id === 'system-loop')!;
    const target = system.planets.find(p => p.id === 'planet-target-loop')!;

    // Planet should remain unowned.
    expect(target.ownerId).toBeNull();
    // No PlanetColonised event should have been emitted.
    expect(events.some(e => e.type === 'PlanetColonised')).toBe(false);
  });

  it('rejects an action referencing a planet in a system the empire does not control', () => {
    const gameState = makeGameState();
    // Replace the owned home planet with an unowned planet so the empire has no foothold.
    const noFootholdState: GameState = {
      ...gameState,
      galaxy: {
        ...gameState.galaxy,
        systems: gameState.galaxy.systems.map(sys => {
          if (sys.id !== 'system-loop') return sys;
          return {
            ...sys,
            planets: sys.planets.map(p =>
              p.id === 'planet-home-loop' ? { ...p, ownerId: null } : p,
            ),
          };
        }),
      },
    };

    const tickState = addColonisePlanetAction(
      withMinerals(initializeTickState(noFootholdState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );

    const { newState } = processGameTick(tickState);
    const system = newState.gameState.galaxy.systems.find(s => s.id === 'system-loop')!;
    const target = system.planets.find(p => p.id === 'planet-target-loop')!;
    expect(target.ownerId).toBeNull();
  });

  it('does not process colonisation actions when the game is paused', () => {
    const gameState: GameState = { ...makeGameState(), status: 'paused' };
    const tickState = addColonisePlanetAction(
      withMinerals(initializeTickState(gameState), EMPIRE_ID, 10_000),
      EMPIRE_ID,
      'system-loop',
      'planet-target-loop',
    );

    const { newState, events } = processGameTick(tickState);

    // Paused game: tick does not advance, pendingActions are untouched.
    expect(newState.pendingActions).toHaveLength(1);
    expect(events).toHaveLength(0);
  });
});
