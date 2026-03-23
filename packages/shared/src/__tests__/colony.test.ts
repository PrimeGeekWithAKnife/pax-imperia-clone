import { describe, it, expect } from 'vitest';
import {
  calculateHabitability,
  calculatePopulationGrowth,
  canColonize,
  establishColony,
  getBuildingSlots,
  canBuildOnPlanet,
  addBuildingToQueue,
  processConstructionQueue,
  getColonyStats,
} from '../engine/colony.js';
import { PLANET_BUILDING_SLOTS } from '../constants/planets.js';
import type { Planet } from '../types/galaxy.js';
import type { Species } from '../types/species.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A human-like species that prefers terran worlds. */
function makeHumanSpecies(overrides: Partial<Species> = {}): Species {
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
      idealTemperature: 293,       // ~20°C
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.3,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
    ...overrides,
  };
}

/** An ammonia-based species adapted to hostile environments. */
function makeAlienSpecies(overrides: Partial<Species> = {}): Species {
  return {
    id: 'kreth',
    name: 'Kreth',
    description: 'Ammonia-breathing alien species',
    portrait: 'kreth',
    isPrebuilt: true,
    specialAbilities: [],
    traits: {
      construction: 6,
      reproduction: 4,
      research: 7,
      espionage: 3,
      economy: 4,
      combat: 8,
      diplomacy: 2,
    },
    environmentPreference: {
      idealTemperature: 220,
      temperatureTolerance: 40,
      idealGravity: 1.4,
      gravityTolerance: 0.4,
      preferredAtmospheres: ['ammonia'],
    },
    ...overrides,
  };
}

/** Baseline empty planet (unowned, no buildings, no population). */
function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'New Earth',
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

// ── calculateHabitability ─────────────────────────────────────────────────────

describe('calculateHabitability – perfect match', () => {
  it('returns score near 100 for a perfectly compatible planet', () => {
    const planet = makePlanet();
    const species = makeHumanSpecies();
    const report = calculateHabitability(planet, species);

    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.atmosphereScore).toBe(40);
    expect(report.gravityScore).toBe(30);
    expect(report.temperatureScore).toBe(30);
    expect(report.isHabitable).toBe(true);
    expect(report.warnings).toHaveLength(0);
  });

  it('returns score of 100 when all attributes are exactly ideal', () => {
    const species = makeHumanSpecies();
    const env = species.environmentPreference;
    const planet = makePlanet({
      atmosphere: 'oxygen_nitrogen',
      gravity: env.idealGravity,
      temperature: env.idealTemperature,
    });
    const report = calculateHabitability(planet, species);

    expect(report.score).toBe(100);
  });
});

describe('calculateHabitability – atmosphere cases', () => {
  it('gives 20 atmosphere score for an adjacent atmosphere type', () => {
    // carbon_dioxide is adjacent to oxygen_nitrogen
    const planet = makePlanet({ atmosphere: 'carbon_dioxide' });
    const species = makeHumanSpecies();
    const report = calculateHabitability(planet, species);

    expect(report.atmosphereScore).toBe(20);
  });

  it('gives 0 atmosphere score for a completely incompatible atmosphere', () => {
    const planet = makePlanet({ atmosphere: 'hydrogen_helium' });
    const species = makeHumanSpecies();
    const report = calculateHabitability(planet, species);

    expect(report.atmosphereScore).toBe(0);
    expect(report.warnings.some(w => w.toLowerCase().includes('incompatible') || w.toLowerCase().includes('atmosphere'))).toBe(true);
  });

  it('adds a toxic atmosphere warning for toxic atmospheres', () => {
    const planet = makePlanet({ atmosphere: 'toxic' });
    const species = makeHumanSpecies();
    const report = calculateHabitability(planet, species);

    expect(report.warnings.some(w => w.toLowerCase().includes('toxic'))).toBe(true);
  });

  it('adds a no-atmosphere warning for vacuum worlds', () => {
    const planet = makePlanet({ atmosphere: 'none' });
    const species = makeHumanSpecies();
    const report = calculateHabitability(planet, species);

    expect(report.warnings.some(w => w.toLowerCase().includes('no atmosphere') || w.toLowerCase().includes('atmosphere'))).toBe(true);
  });

  it('partial atmosphere compatibility lowers overall score vs full compatibility', () => {
    const species = makeHumanSpecies();
    const env = species.environmentPreference;

    const perfectPlanet = makePlanet({
      atmosphere: 'oxygen_nitrogen',
      gravity: env.idealGravity,
      temperature: env.idealTemperature,
    });
    const adjacentPlanet = makePlanet({
      atmosphere: 'carbon_dioxide',
      gravity: env.idealGravity,
      temperature: env.idealTemperature,
    });

    const perfectReport = calculateHabitability(perfectPlanet, species);
    const adjacentReport = calculateHabitability(adjacentPlanet, species);

    expect(adjacentReport.score).toBeLessThan(perfectReport.score);
    // Adjacent atmosphere gives 20 instead of 40, so overall ~80
    expect(adjacentReport.score).toBeGreaterThanOrEqual(75);
    expect(adjacentReport.score).toBeLessThanOrEqual(85);
  });
});

describe('calculateHabitability – gravity cases', () => {
  it('gives full gravity score when gravity is exactly ideal', () => {
    const species = makeHumanSpecies();
    const planet = makePlanet({ gravity: species.environmentPreference.idealGravity });
    const report = calculateHabitability(planet, species);

    expect(report.gravityScore).toBe(30);
  });

  it('gives full gravity score when gravity is within tolerance', () => {
    const species = makeHumanSpecies();
    const env = species.environmentPreference;
    const planet = makePlanet({ gravity: env.idealGravity + env.gravityTolerance });
    const report = calculateHabitability(planet, species);

    expect(report.gravityScore).toBe(30);
  });

  it('reduces gravity score when gravity is outside tolerance', () => {
    const species = makeHumanSpecies();
    const env = species.environmentPreference;
    // Put gravity well outside the tolerance band
    const planet = makePlanet({ gravity: env.idealGravity + env.gravityTolerance * 1.5 });
    const report = calculateHabitability(planet, species);

    expect(report.gravityScore).toBeGreaterThanOrEqual(0);
    expect(report.gravityScore).toBeLessThan(30);
  });

  it('gives zero gravity score at extreme gravity', () => {
    const species = makeHumanSpecies();
    const planet = makePlanet({ gravity: 3.0 }); // far outside human tolerance
    const report = calculateHabitability(planet, species);

    expect(report.gravityScore).toBe(0);
    expect(report.warnings.some(w => w.toLowerCase().includes('gravity'))).toBe(true);
  });
});

describe('calculateHabitability – temperature cases', () => {
  it('gives full temperature score when temperature is exactly ideal', () => {
    const species = makeHumanSpecies();
    const planet = makePlanet({ temperature: species.environmentPreference.idealTemperature });
    const report = calculateHabitability(planet, species);

    expect(report.temperatureScore).toBe(30);
  });

  it('gives full temperature score when temperature is within tolerance', () => {
    const species = makeHumanSpecies();
    const env = species.environmentPreference;
    const planet = makePlanet({ temperature: env.idealTemperature - env.temperatureTolerance });
    const report = calculateHabitability(planet, species);

    expect(report.temperatureScore).toBe(30);
  });

  it('reduces temperature score outside tolerance band', () => {
    const species = makeHumanSpecies();
    const env = species.environmentPreference;
    const planet = makePlanet({ temperature: env.idealTemperature + env.temperatureTolerance * 1.5 });
    const report = calculateHabitability(planet, species);

    expect(report.temperatureScore).toBeGreaterThanOrEqual(0);
    expect(report.temperatureScore).toBeLessThan(30);
  });

  it('gives zero temperature score on a volcanic extreme-heat planet for humans', () => {
    const species = makeHumanSpecies();
    const planet = makePlanet({ temperature: 1500, type: 'volcanic' });
    const report = calculateHabitability(planet, species);

    expect(report.temperatureScore).toBe(0);
    expect(report.warnings.some(w => w.toLowerCase().includes('heat') || w.toLowerCase().includes('temperature'))).toBe(true);
  });
});

describe('calculateHabitability – completely alien environment', () => {
  it('gives a low score (10-20) for humans on an ammonia/high-gravity/freezing planet', () => {
    const species = makeHumanSpecies();
    const planet = makePlanet({
      atmosphere: 'ammonia',
      gravity: 2.8,
      temperature: 100,
    });
    const report = calculateHabitability(planet, species);

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(20);
    expect(report.isHabitable).toBe(false);
  });

  it('isHabitable is false when score is below 20', () => {
    const species = makeHumanSpecies();
    const planet = makePlanet({
      atmosphere: 'hydrogen_helium',
      gravity: 3.0,
      temperature: 50,
    });
    const report = calculateHabitability(planet, species);

    expect(report.score).toBeLessThan(20);
    expect(report.isHabitable).toBe(false);
  });

  it('different species have different habitability for the same planet', () => {
    const planet = makePlanet({ atmosphere: 'ammonia', gravity: 1.4, temperature: 220 });
    const humans = makeHumanSpecies();
    const aliens = makeAlienSpecies();

    const humanReport = calculateHabitability(planet, humans);
    const alienReport = calculateHabitability(planet, aliens);

    // Aliens prefer ammonia/high-gravity/cold; humans do not
    expect(alienReport.score).toBeGreaterThan(humanReport.score);
  });
});

// ── calculatePopulationGrowth ─────────────────────────────────────────────────

describe('calculatePopulationGrowth', () => {
  it('returns 0 for an empty planet', () => {
    const planet = makePlanet({ currentPopulation: 0 });
    const species = makeHumanSpecies();
    expect(calculatePopulationGrowth(planet, species, 80)).toBe(0);
  });

  it('returns 0 when population equals maxPopulation', () => {
    const planet = makePlanet({ currentPopulation: 10_000_000, maxPopulation: 10_000_000 });
    const species = makeHumanSpecies();
    expect(calculatePopulationGrowth(planet, species, 80)).toBe(0);
  });

  it('returns at least 1 when population > 0 and below max', () => {
    const planet = makePlanet({ currentPopulation: 1, maxPopulation: 10_000_000 });
    const species = makeHumanSpecies();
    const growth = calculatePopulationGrowth(planet, species, 80);
    expect(growth).toBeGreaterThanOrEqual(1);
  });

  it('growth is positive for a healthy colony at mid population', () => {
    const planet = makePlanet({ currentPopulation: 1_000_000, maxPopulation: 10_000_000 });
    const species = makeHumanSpecies();
    const growth = calculatePopulationGrowth(planet, species, 80);
    expect(growth).toBeGreaterThan(0);
  });

  it('higher reproduction trait produces faster growth', () => {
    const planet = makePlanet({ currentPopulation: 1_000_000, maxPopulation: 10_000_000 });
    const slowBreeder = makeHumanSpecies({ traits: { ...makeHumanSpecies().traits, reproduction: 2 } });
    const fastBreeder = makeHumanSpecies({ traits: { ...makeHumanSpecies().traits, reproduction: 9 } });

    const slowGrowth = calculatePopulationGrowth(planet, slowBreeder, 80);
    const fastGrowth = calculatePopulationGrowth(planet, fastBreeder, 80);

    expect(fastGrowth).toBeGreaterThan(slowGrowth);
  });

  it('logistic curve — growth slows as population approaches max', () => {
    const species = makeHumanSpecies();
    // Place both populations on the upper half of the curve where the
    // logistic drag dominates.  At 50% capacity growth is maximised;
    // at 95% it should be significantly lower.
    const maxPop = 1_000_000_000;
    const peakPlanet = makePlanet({ currentPopulation: 500_000_000, maxPopulation: maxPop });
    const nearFullPlanet = makePlanet({ currentPopulation: 950_000_000, maxPopulation: maxPop });

    const peakGrowth = calculatePopulationGrowth(peakPlanet, species, 80);
    const nearFullGrowth = calculatePopulationGrowth(nearFullPlanet, species, 80);

    // A planet at 50% capacity grows faster than one at 95% capacity
    expect(peakGrowth).toBeGreaterThan(nearFullGrowth);
  });

  it('higher habitability produces higher growth', () => {
    const planet = makePlanet({ currentPopulation: 1_000_000, maxPopulation: 10_000_000 });
    const species = makeHumanSpecies();

    const lowHabitGrowth = calculatePopulationGrowth(planet, species, 20);
    const highHabitGrowth = calculatePopulationGrowth(planet, species, 100);

    expect(highHabitGrowth).toBeGreaterThan(lowHabitGrowth);
  });

  it('population center building increases growth', () => {
    const basePlanet = makePlanet({ currentPopulation: 1_000_000, maxPopulation: 10_000_000 });
    const planetWithCenter = makePlanet({
      currentPopulation: 1_000_000,
      maxPopulation: 10_000_000,
      buildings: [{ id: 'b1', type: 'population_center', level: 1 }],
    });
    const species = makeHumanSpecies();

    const baseGrowth = calculatePopulationGrowth(basePlanet, species, 80);
    const boostedGrowth = calculatePopulationGrowth(planetWithCenter, species, 80);

    expect(boostedGrowth).toBeGreaterThan(baseGrowth);
  });

  it('returns 0 when empire is starving', () => {
    const planet = makePlanet({ currentPopulation: 1_000_000, maxPopulation: 10_000_000 });
    const species = makeHumanSpecies();
    const growth = calculatePopulationGrowth(planet, species, 80, true);
    expect(growth).toBe(0);
  });

  it('higher-level population center provides more growth than lower level', () => {
    const species = makeHumanSpecies();
    const planetLevel1 = makePlanet({
      currentPopulation: 1_000_000,
      maxPopulation: 10_000_000,
      buildings: [{ id: 'b1', type: 'population_center', level: 1 }],
    });
    const planetLevel3 = makePlanet({
      currentPopulation: 1_000_000,
      maxPopulation: 10_000_000,
      buildings: [{ id: 'b1', type: 'population_center', level: 3 }],
    });

    const growth1 = calculatePopulationGrowth(planetLevel1, species, 80);
    const growth3 = calculatePopulationGrowth(planetLevel3, species, 80);

    expect(growth3).toBeGreaterThan(growth1);
  });
});

// ── canColonize ───────────────────────────────────────────────────────────────

describe('canColonize', () => {
  it('allows colonisation of an empty unowned terran planet', () => {
    const planet = makePlanet();
    const species = makeHumanSpecies();
    const result = canColonize(planet, species);
    expect(result.allowed).toBe(true);
  });

  it('rejects colonisation of an already-owned planet', () => {
    const planet = makePlanet({ ownerId: 'empire-2' });
    const species = makeHumanSpecies();
    const result = canColonize(planet, species);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/owned/i);
  });

  it('rejects colonisation of a planet that already has population', () => {
    const planet = makePlanet({ currentPopulation: 1000 });
    const species = makeHumanSpecies();
    const result = canColonize(planet, species);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/colonized/i);
  });

  it('rejects surface colonisation of a gas giant', () => {
    const planet = makePlanet({ type: 'gas_giant', atmosphere: 'hydrogen_helium' });
    const species = makeHumanSpecies();
    const result = canColonize(planet, species);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/gas giant/i);
  });

  it('rejects colonisation when habitability is below minimum threshold', () => {
    // Create a planet with extreme conditions no species could reasonably tolerate
    const planet = makePlanet({
      atmosphere: 'hydrogen_helium',
      gravity: 3.0,
      temperature: 50,
    });
    const species = makeHumanSpecies();
    const result = canColonize(planet, species);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/habitability/i);
  });

  it('allows colonisation with habitability just at the minimum threshold', () => {
    // A planet with partial compatibility — methane is adjacent to carbon_dioxide
    // which is adjacent to oxygen_nitrogen, so no atmosphere bonus, but gravity/temp ok
    const species = makeHumanSpecies();
    // Give ideal gravity and temperature but incompatible atmosphere to get ~60 score
    const planet = makePlanet({
      atmosphere: 'carbon_dioxide', // adjacent to preferred — 20 pts
      gravity: species.environmentPreference.idealGravity,
      temperature: species.environmentPreference.idealTemperature,
    });
    const result = canColonize(planet, species);
    // Score should be ~80 (20 + 30 + 30), well above minimum
    expect(result.allowed).toBe(true);
  });
});

// ── establishColony ───────────────────────────────────────────────────────────

describe('establishColony', () => {
  it('sets ownerId to species id', () => {
    const planet = makePlanet();
    const species = makeHumanSpecies();
    const colony = establishColony(planet, species, 5000);
    expect(colony.ownerId).toBe(species.id);
  });

  it('sets the initial population', () => {
    const planet = makePlanet();
    const species = makeHumanSpecies();
    const colony = establishColony(planet, species, 5000);
    expect(colony.currentPopulation).toBe(5000);
  });

  it('adds a level-1 population_center building', () => {
    const planet = makePlanet();
    const species = makeHumanSpecies();
    const colony = establishColony(planet, species, 5000);

    const popCenter = colony.buildings.find(b => b.type === 'population_center');
    expect(popCenter).toBeDefined();
    expect(popCenter?.level).toBe(1);
  });

  it('does not mutate the original planet', () => {
    const planet = makePlanet();
    const species = makeHumanSpecies();
    establishColony(planet, species, 5000);
    expect(planet.ownerId).toBeNull();
    expect(planet.currentPopulation).toBe(0);
    expect(planet.buildings).toHaveLength(0);
  });

  it('throws when trying to colonize an owned planet', () => {
    const planet = makePlanet({ ownerId: 'other-empire' });
    const species = makeHumanSpecies();
    expect(() => establishColony(planet, species, 5000)).toThrow();
  });

  it('returns a planet with a valid building id', () => {
    const planet = makePlanet();
    const species = makeHumanSpecies();
    const colony = establishColony(planet, species, 5000);
    const building = colony.buildings.find(b => b.type === 'population_center');
    expect(building?.id).toBeTruthy();
    expect(typeof building?.id).toBe('string');
  });
});

// ── getBuildingSlots ───────────────────────────────────────────────────────────

describe('getBuildingSlots', () => {
  it('returns zero used slots for an empty planet', () => {
    const planet = makePlanet();
    const slots = getBuildingSlots(planet);
    expect(slots.used).toBe(0);
    expect(slots.total).toBe(PLANET_BUILDING_SLOTS.terran);
  });

  it('counts existing buildings as used slots', () => {
    const planet = makePlanet({
      buildings: [
        { id: 'b1', type: 'population_center', level: 1 },
        { id: 'b2', type: 'factory', level: 1 },
      ],
    });
    const slots = getBuildingSlots(planet);
    expect(slots.used).toBe(2);
  });

  it('returns correct total for each planet type', () => {
    const types: Array<[Planet['type'], number]> = [
      ['terran', 20],
      ['ocean', 15],
      ['desert', 16],
      ['ice', 12],
      ['volcanic', 14],
      ['gas_giant', 8],
      ['barren', 10],
      ['toxic', 11],
    ];

    for (const [type, expectedTotal] of types) {
      const planet = makePlanet({ type });
      const slots = getBuildingSlots(planet);
      expect(slots.total, `planet type ${type}`).toBe(expectedTotal);
    }
  });
});

// ── canBuildOnPlanet ──────────────────────────────────────────────────────────

describe('canBuildOnPlanet', () => {
  it('allows building a factory on a terran planet with free slots', () => {
    const planet = makePlanet();
    const result = canBuildOnPlanet(planet, 'factory');
    expect(result.allowed).toBe(true);
  });

  it('rejects building when all slots are used', () => {
    const slots = PLANET_BUILDING_SLOTS.terran;
    const buildings = Array.from({ length: slots }, (_, i) => ({
      id: `b${i}`,
      type: 'factory' as const,
      level: 1,
    }));
    const planet = makePlanet({ buildings });
    const result = canBuildOnPlanet(planet, 'research_lab');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/slots/i);
  });

  it('rejects building a shipyard without a spaceport prerequisite', () => {
    const planet = makePlanet();
    const result = canBuildOnPlanet(planet, 'shipyard');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/spaceport/i);
  });

  it('allows building a shipyard when spaceport already exists', () => {
    const planet = makePlanet({
      buildings: [{ id: 'sp1', type: 'spaceport', level: 1 }],
    });
    const result = canBuildOnPlanet(planet, 'shipyard');
    expect(result.allowed).toBe(true);
  });

  it('rejects building a defense_grid without a spaceport', () => {
    const planet = makePlanet();
    const result = canBuildOnPlanet(planet, 'defense_grid');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/spaceport/i);
  });

  it('restricts gas giants to spaceport-only buildings', () => {
    const planet = makePlanet({ type: 'gas_giant' });
    const result = canBuildOnPlanet(planet, 'factory');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/gas giant/i);
  });

  it('allows spaceport on a gas giant', () => {
    const planet = makePlanet({ type: 'gas_giant' });
    const result = canBuildOnPlanet(planet, 'spaceport');
    expect(result.allowed).toBe(true);
  });

  it('rejects building when required tech is not researched', () => {
    const planet = makePlanet();
    // trade_hub requires 'trade_protocols'
    const result = canBuildOnPlanet(planet, 'trade_hub', undefined, []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/requires technology/i);
  });

  it('allows building when required tech is researched', () => {
    const planet = makePlanet();
    const result = canBuildOnPlanet(planet, 'trade_hub', undefined, ['trade_protocols']);
    expect(result.allowed).toBe(true);
  });

  it('allows buildings without a tech requirement regardless of empireTechs', () => {
    const planet = makePlanet();
    // factory has no requiredTech
    const result = canBuildOnPlanet(planet, 'factory', undefined, []);
    expect(result.allowed).toBe(true);
  });

  it('does not enforce tech requirements when empireTechs is omitted', () => {
    const planet = makePlanet();
    // research_lab requires 'subspace_scanning', but no empireTechs provided
    const result = canBuildOnPlanet(planet, 'research_lab');
    expect(result.allowed).toBe(true);
  });
});

// ── addBuildingToQueue ────────────────────────────────────────────────────────

describe('addBuildingToQueue', () => {
  it('adds a building item to the production queue', () => {
    const planet = makePlanet();
    const updated = addBuildingToQueue(planet, 'factory');

    expect(updated.productionQueue).toHaveLength(1);
    expect(updated.productionQueue[0]?.type).toBe('building');
    expect(updated.productionQueue[0]?.templateId).toBe('factory');
  });

  it('does not mutate the original planet', () => {
    const planet = makePlanet();
    addBuildingToQueue(planet, 'factory');
    expect(planet.productionQueue).toHaveLength(0);
  });

  it('appends to an existing queue', () => {
    let planet = makePlanet();
    planet = addBuildingToQueue(planet, 'factory');
    planet = addBuildingToQueue(planet, 'research_lab');

    expect(planet.productionQueue).toHaveLength(2);
    expect(planet.productionQueue[0]?.templateId).toBe('factory');
    expect(planet.productionQueue[1]?.templateId).toBe('research_lab');
  });

  it('sets a positive turnsRemaining on the queued item', () => {
    const planet = makePlanet();
    const updated = addBuildingToQueue(planet, 'factory');
    expect(updated.productionQueue[0]?.turnsRemaining).toBeGreaterThan(0);
  });

  it('throws when trying to queue a shipyard without a spaceport', () => {
    const planet = makePlanet();
    expect(() => addBuildingToQueue(planet, 'shipyard')).toThrow();
  });
});

// ── processConstructionQueue ──────────────────────────────────────────────────

describe('processConstructionQueue', () => {
  it('returns the planet unchanged when the queue is empty', () => {
    const planet = makePlanet();
    const result = processConstructionQueue(planet, 1);
    expect(result.productionQueue).toHaveLength(0);
    expect(result.buildings).toHaveLength(0);
  });

  it('decrements turnsRemaining on the first queue item', () => {
    const planet = makePlanet({
      productionQueue: [{ type: 'building', templateId: 'factory', turnsRemaining: 4 }],
    });
    const result = processConstructionQueue(planet, 1);

    expect(result.productionQueue).toHaveLength(1);
    expect(result.productionQueue[0]?.turnsRemaining).toBe(3);
  });

  it('decrements by the construction rate when > 1', () => {
    const planet = makePlanet({
      productionQueue: [{ type: 'building', templateId: 'factory', turnsRemaining: 6 }],
    });
    const result = processConstructionQueue(planet, 3);
    expect(result.productionQueue[0]?.turnsRemaining).toBe(3);
  });

  it('completes a building when turnsRemaining reaches zero', () => {
    const planet = makePlanet({
      productionQueue: [{ type: 'building', templateId: 'factory', turnsRemaining: 1 }],
    });
    const result = processConstructionQueue(planet, 1);

    expect(result.productionQueue).toHaveLength(0);
    expect(result.buildings).toHaveLength(1);
    expect(result.buildings[0]?.type).toBe('factory');
    expect(result.buildings[0]?.level).toBe(1);
  });

  it('completes building when constructionRate overshoots remaining turns', () => {
    const planet = makePlanet({
      productionQueue: [{ type: 'building', templateId: 'research_lab', turnsRemaining: 2 }],
    });
    const result = processConstructionQueue(planet, 5);

    expect(result.productionQueue).toHaveLength(0);
    expect(result.buildings.some(b => b.type === 'research_lab')).toBe(true);
  });

  it('only processes the first item in the queue per call', () => {
    const planet = makePlanet({
      productionQueue: [
        { type: 'building', templateId: 'factory', turnsRemaining: 1 },
        { type: 'building', templateId: 'research_lab', turnsRemaining: 5 },
      ],
    });
    const result = processConstructionQueue(planet, 1);

    // First item completes; second item should still be in queue
    expect(result.buildings).toHaveLength(1);
    expect(result.buildings[0]?.type).toBe('factory');
    expect(result.productionQueue).toHaveLength(1);
    expect(result.productionQueue[0]?.templateId).toBe('research_lab');
    expect(result.productionQueue[0]?.turnsRemaining).toBe(5);
  });

  it('assigns a unique id to the newly completed building', () => {
    const planet = makePlanet({
      productionQueue: [{ type: 'building', templateId: 'factory', turnsRemaining: 1 }],
    });
    const result = processConstructionQueue(planet, 1);

    expect(result.buildings[0]?.id).toBeTruthy();
    expect(typeof result.buildings[0]?.id).toBe('string');
  });

  it('does not mutate the original planet', () => {
    const planet = makePlanet({
      productionQueue: [{ type: 'building', templateId: 'factory', turnsRemaining: 1 }],
    });
    processConstructionQueue(planet, 1);

    expect(planet.productionQueue).toHaveLength(1);
    expect(planet.buildings).toHaveLength(0);
  });
});

// ── getColonyStats ────────────────────────────────────────────────────────────

describe('getColonyStats', () => {
  it('returns a complete colony stats object', () => {
    const planet = makePlanet({
      currentPopulation: 500_000,
      maxPopulation: 10_000_000,
      buildings: [{ id: 'b1', type: 'population_center', level: 1 }],
      productionQueue: [{ type: 'building', templateId: 'factory', turnsRemaining: 4 }],
    });
    const species = makeHumanSpecies();
    const stats = getColonyStats(planet, species);

    expect(stats.habitability).toBeDefined();
    expect(typeof stats.habitability.score).toBe('number');
    expect(typeof stats.populationGrowth).toBe('number');
    expect(stats.buildingSlots.used).toBe(1);
    expect(stats.buildingSlots.total).toBe(PLANET_BUILDING_SLOTS.terran);
    expect(stats.turnsToNextBuilding).toBe(4);
  });

  it('returns null for turnsToNextBuilding when queue is empty', () => {
    const planet = makePlanet({ currentPopulation: 500_000 });
    const species = makeHumanSpecies();
    const stats = getColonyStats(planet, species);

    expect(stats.turnsToNextBuilding).toBeNull();
  });
});

// ── Gas giant special-case integration ───────────────────────────────────────

describe('Gas giant special cases', () => {
  it('canColonize returns false for gas giant with appropriate reason', () => {
    const planet = makePlanet({ type: 'gas_giant', atmosphere: 'hydrogen_helium' });
    const species = makeHumanSpecies();
    const result = canColonize(planet, species);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/gas giant/i);
  });

  it('getBuildingSlots returns 8 total slots for gas giant', () => {
    const planet = makePlanet({ type: 'gas_giant' });
    const slots = getBuildingSlots(planet);
    expect(slots.total).toBe(8);
  });

  it('canBuildOnPlanet only allows spaceport on gas giant', () => {
    const planet = makePlanet({ type: 'gas_giant' });

    expect(canBuildOnPlanet(planet, 'spaceport').allowed).toBe(true);
    expect(canBuildOnPlanet(planet, 'factory').allowed).toBe(false);
    expect(canBuildOnPlanet(planet, 'research_lab').allowed).toBe(false);
    expect(canBuildOnPlanet(planet, 'mining_facility').allowed).toBe(false);
  });
});
