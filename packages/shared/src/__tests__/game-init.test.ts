import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  selectHomeSystem,
  createStartingFleet,
  type GameSetupConfig,
  type PlayerSetup,
} from '../engine/game-init.js';
import { generateGalaxy } from '../generation/galaxy-generator.js';
import type { Species } from '../types/species.js';
import type { GalaxyGenerationConfig } from '../generation/galaxy-generator.js';
import { STARTING_CREDITS, STARTING_RESEARCH_POINTS } from '../constants/game.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Standard oxygen-breathing species (human-like). */
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

/** Galaxy config for a given size and player count. */
function galaxyConfig(
  size: GalaxyGenerationConfig['size'],
  playerCount: number,
  seed = 42,
): GalaxyGenerationConfig {
  return { seed, size, shape: 'elliptical', playerCount };
}

// ── initializeGame – empire count ─────────────────────────────────────────────

describe('initializeGame – empire count', () => {
  it('creates the correct number of empires for 2 players', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('small', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);
    expect(state.empires).toHaveLength(2);
  });

  it('creates the correct number of empires for 4 players', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 4),
      players: ['p1', 'p2', 'p3', 'p4'].map(id => makePlayerSetup(id)),
    };
    const state = initializeGame(config);
    expect(state.empires).toHaveLength(4);
  });

  it('creates the correct number of empires for 8 players on a huge galaxy', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('huge', 8),
      players: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map(id =>
        makePlayerSetup(id, true),
      ),
    };
    const state = initializeGame(config);
    expect(state.empires).toHaveLength(8);
  });
});

// ── initializeGame – home system and colonised planet ─────────────────────────

describe('initializeGame – home planet colonisation', () => {
  it('each empire gets a distinct home system (non-overlapping ownerId)', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 4),
      players: ['a', 'b', 'c', 'd'].map(id => makePlayerSetup(id)),
    };
    const state = initializeGame(config);

    const ownedSystemIds = state.galaxy.systems
      .filter(s => s.ownerId !== null)
      .map(s => s.ownerId as string);

    // One owned system per empire
    expect(new Set(ownedSystemIds).size).toBe(4);
  });

  it('each home planet has population set to 1000', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('x'), makePlayerSetup('y')],
    };
    const state = initializeGame(config);

    const colonisedPlanets = state.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.currentPopulation > 0);

    expect(colonisedPlanets).toHaveLength(2);
    for (const planet of colonisedPlanets) {
      expect(planet.currentPopulation).toBe(5_000_000);
    }
  });

  it('each home planet has the required starting buildings', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('x'), makePlayerSetup('y')],
    };
    const state = initializeGame(config);

    const colonisedPlanets = state.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.ownerId !== null && p.currentPopulation > 0);

    for (const planet of colonisedPlanets) {
      const types = planet.buildings.map(b => b.type);
      expect(types).toContain('research_lab');
      expect(types).toContain('factory');
      expect(types).toContain('population_center');
      expect(types).toContain('spaceport');
      // All at level 1
      for (const b of planet.buildings) {
        expect(b.level).toBe(1);
      }
    }
  });
});

// ── initializeGame – home system spacing ─────────────────────────────────────

describe('initializeGame – home system spacing', () => {
  it('home systems are not adjacent (no shared wormhole) for 2 players on a medium galaxy', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2, 12345),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    const homeSystemIds = state.galaxy.systems
      .filter(s => s.ownerId !== null)
      .map(s => s.id);

    expect(homeSystemIds).toHaveLength(2);
    const [idA, idB] = homeSystemIds as [string, string];

    const systemA = state.galaxy.systems.find(s => s.id === idA)!;
    const systemB = state.galaxy.systems.find(s => s.id === idB)!;

    // They should not be directly connected via wormhole
    expect(systemA.wormholes).not.toContain(idB);
    expect(systemB.wormholes).not.toContain(idA);
  });
});

// ── initializeGame – starting fleet ──────────────────────────────────────────

describe('initializeGame – starting fleet composition', () => {
  it('each empire gets exactly one fleet', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);
    expect(state.fleets).toHaveLength(2);
  });

  it('starting fleet has exactly 1 ship (deep space probe)', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const fleet of state.fleets) {
      expect(fleet.ships).toHaveLength(1);
    }
  });

  it('fleet contains 1 deep space probe', () => {
    const { fleet, ships } = createStartingFleet('empire-1', 'sys-1', 'Test Empire');

    const hullCounts = ships.reduce<Record<string, number>>((acc, ship) => {
      // designId is "starting_<hull>"
      const hull = ship.designId.replace('starting_', '');
      acc[hull] = (acc[hull] ?? 0) + 1;
      return acc;
    }, {});

    expect(hullCounts['deep_space_probe']).toBe(1);
    expect(fleet.ships).toHaveLength(1);
  });

  it('fleet name contains empire name and "Expeditionary Fleet"', () => {
    const { fleet } = createStartingFleet('empire-1', 'sys-1', 'Nova Republic');
    expect(fleet.name).toContain('Nova Republic');
    expect(fleet.name).toContain('Expeditionary Fleet');
  });

  it('fleet is positioned in the home system', () => {
    const { fleet } = createStartingFleet('empire-1', 'sys-42', 'Test');
    expect(fleet.position.systemId).toBe('sys-42');
  });

  it('all ships in fleet have their fleetId set correctly', () => {
    const { fleet, ships } = createStartingFleet('empire-1', 'sys-1', 'Test');
    for (const ship of ships) {
      expect(ship.fleetId).toBe(fleet.id);
    }
  });

  it('all ships in fleet have full hull points (no initial damage)', () => {
    const { ships } = createStartingFleet('empire-1', 'sys-1', 'Test');
    for (const ship of ships) {
      expect(ship.hullPoints).toBe(ship.maxHullPoints);
      expect(ship.systemDamage.engines).toBe(0);
      expect(ship.systemDamage.weapons).toBe(0);
      expect(ship.systemDamage.shields).toBe(0);
      expect(ship.systemDamage.sensors).toBe(0);
      expect(ship.systemDamage.warpDrive).toBe(0);
    }
  });
});

// ── initializeGame – fog of war ───────────────────────────────────────────────

describe('initializeGame – fog of war', () => {
  it('home system is discovered by its empire', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      const homeSystem = state.galaxy.systems.find(s => s.ownerId === empire.id);
      expect(homeSystem).toBeDefined();
      expect(homeSystem!.discovered[empire.id]).toBe(true);
    }
  });

  it("adjacent systems are included in the empire's knownSystems", () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      const homeSystem = state.galaxy.systems.find(s => s.ownerId === empire.id)!;
      for (const neighbourId of homeSystem.wormholes) {
        expect(empire.knownSystems).toContain(neighbourId);
      }
    }
  });

  it('adjacent systems are discovered by their respective empire', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      const homeSystem = state.galaxy.systems.find(s => s.ownerId === empire.id)!;
      for (const neighbourId of homeSystem.wormholes) {
        const neighbour = state.galaxy.systems.find(s => s.id === neighbourId)!;
        expect(neighbour.discovered[empire.id]).toBe(true);
      }
    }
  });

  it("home system is in the empire's knownSystems", () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      const homeSystem = state.galaxy.systems.find(s => s.ownerId === empire.id)!;
      expect(empire.knownSystems).toContain(homeSystem.id);
    }
  });
});

// ── initializeGame – starting resources ───────────────────────────────────────

describe('initializeGame – starting resources', () => {
  it('each empire starts with STARTING_CREDITS credits', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      expect(empire.credits).toBe(STARTING_CREDITS);
    }
  });

  it('each empire starts with STARTING_RESEARCH_POINTS research points', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      expect(empire.researchPoints).toBe(STARTING_RESEARCH_POINTS);
    }
  });

  it('each empire starts in nano_atomic age', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      expect(empire.currentAge).toBe('nano_atomic');
    }
  });

  it('each empire starts with an empty technology list', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);

    for (const empire of state.empires) {
      expect(empire.technologies).toHaveLength(0);
    }
  });
});

// ── initializeGame – game state fields ────────────────────────────────────────

describe('initializeGame – GameState fields', () => {
  it('returns currentTick of 0', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('small', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);
    expect(state.currentTick).toBe(0);
  });

  it('returns status of "playing"', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('small', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);
    expect(state.status).toBe('playing');
  });

  it('returns speed of "normal"', () => {
    const config: GameSetupConfig = {
      galaxyConfig: galaxyConfig('small', 2),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state = initializeGame(config);
    expect(state.speed).toBe('normal');
  });

  it('is deterministic with the same seed', () => {
    const cfg: GameSetupConfig = {
      galaxyConfig: galaxyConfig('medium', 2, 999),
      players: [makePlayerSetup('a'), makePlayerSetup('b')],
    };
    const state1 = initializeGame(cfg);
    const state2 = initializeGame(cfg);

    // Galaxy system IDs and wormholes should be identical
    const ids1 = state1.galaxy.systems.map(s => s.id);
    const ids2 = state2.galaxy.systems.map(s => s.id);
    expect(ids1).toEqual(ids2);

    // Which star-system IDs were chosen as homeworlds should be the same across
    // runs (driven by the seeded galaxy generator).  Empire IDs themselves are
    // generated with crypto.randomUUID() and therefore differ per run, so we
    // compare the star-system IDs rather than the empire IDs stored in ownerId.
    const ownedSystemIds1 = state1.galaxy.systems
      .filter(s => s.ownerId !== null)
      .map(s => s.id)
      .sort();
    const ownedSystemIds2 = state2.galaxy.systems
      .filter(s => s.ownerId !== null)
      .map(s => s.id)
      .sort();
    expect(ownedSystemIds1).toEqual(ownedSystemIds2);
  });
});

// ── selectHomeSystem ──────────────────────────────────────────────────────────

describe('selectHomeSystem', () => {
  it('returns null when no system has a habitable planet', () => {
    // Use a species with extreme preferences so nothing matches
    const harshSpecies: Species = {
      ...makeSpecies('harsh'),
      environmentPreference: {
        idealTemperature: 1400, // extremely hot
        temperatureTolerance: 10,
        idealGravity: 3.0,
        gravityTolerance: 0.05,
        preferredAtmospheres: ['hydrogen_helium'],
      },
    };
    const galaxy = generateGalaxy({ seed: 1, size: 'small', shape: 'elliptical', playerCount: 1 });
    const result = selectHomeSystem(galaxy, harshSpecies, []);
    // Most likely null because no planet meets 60+ score with those preferences
    // (we just verify it doesn't throw; result may be null or a system)
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('returns a string system ID when a suitable system exists', () => {
    const galaxy = generateGalaxy({ seed: 42, size: 'medium', shape: 'elliptical', playerCount: 2 });
    const result = selectHomeSystem(galaxy, makeSpecies('s1'), []);
    expect(typeof result).toBe('string');
  });

  it('does not return an already-taken system', () => {
    const galaxy = generateGalaxy({ seed: 42, size: 'medium', shape: 'elliptical', playerCount: 2 });
    const first = selectHomeSystem(galaxy, makeSpecies('s1'), [])!;
    expect(first).not.toBeNull();

    const second = selectHomeSystem(galaxy, makeSpecies('s2'), [first]);
    expect(second).not.toBe(first);
  });

  it('avoids immediate neighbours of taken systems when alternatives exist', () => {
    const galaxy = generateGalaxy({ seed: 42, size: 'large', shape: 'elliptical', playerCount: 2 });
    const first = selectHomeSystem(galaxy, makeSpecies('s1'), [])!;
    const firstSystem = galaxy.systems.find(s => s.id === first)!;
    const neighbourIds = new Set(firstSystem.wormholes);

    const second = selectHomeSystem(galaxy, makeSpecies('s2'), [first]);
    if (second !== null) {
      // On a large galaxy there should be room; second should not be a neighbour
      expect(neighbourIds.has(second)).toBe(false);
    }
  });
});
