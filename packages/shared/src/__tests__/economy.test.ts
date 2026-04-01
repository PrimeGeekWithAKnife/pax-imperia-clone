import { describe, it, expect } from 'vitest';
import {
  calculatePlanetProduction,
  calculateEmpireProduction,
  calculateUpkeep,
  applyResourceTick,
  canAfford,
  subtractResources,
} from '../engine/economy.js';
import type { Planet, Building } from '../types/galaxy.js';
import type { Empire, Species } from '../types/species.js';
import type { EmpireResources, ResourceProduction } from '../types/resources.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSpecies(overrides: Partial<Species['traits']> = {}): Species {
  return {
    id: 'human',
    name: 'Humans',
    description: 'Test species',
    portrait: 'human',
    isPrebuilt: true,
    specialAbilities: [],
    environmentPreference: {
      idealTemperature: 295,
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.5,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
    traits: {
      construction: 5,
      reproduction: 5,
      research: 5,
      espionage: 5,
      economy: 5,
      combat: 5,
      diplomacy: 5,
      ...overrides,
    },
  };
}

function makeEmpire(species: Species): Empire {
  return {
    id: 'empire-1',
    name: 'Test Empire',
    species,
    color: '#0000ff',
    credits: 1000,
    researchPoints: 0,
    knownSystems: [],
    diplomacy: [],
    technologies: [],
    currentAge: 'nano_atomic',
    isAI: false,
    government: 'democracy',
  };
}

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'Terra',
    orbitalIndex: 3,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 295,
    naturalResources: 50,
    maxPopulation: 1_000_000_000,
    currentPopulation: 0,
    ownerId: 'empire-1',
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

function makeBuilding(type: Building['type'], level = 1): Building {
  return { id: `bld-${type}-${level}`, type, level };
}

function makeResources(overrides: Partial<EmpireResources> = {}): EmpireResources {
  return {
    credits: 0,
    minerals: 0,
    rareElements: 0,
    energy: 0,
    organics: 0,
    exoticMaterials: 0,
    faith: 0,
    researchPoints: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculatePlanetProduction
// ---------------------------------------------------------------------------

describe('calculatePlanetProduction', () => {
  it('empty planet with zero population produces only zeroed totals (no buildings, no pop)', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);
    const planet = makePlanet({ currentPopulation: 0 });

    const result = calculatePlanetProduction(planet, species, empire);

    expect(result.planetId).toBe('planet-1');
    expect(result.population).toBe(0);
    expect(result.taxIncome).toBe(0);
    expect(result.buildingOutputs).toHaveLength(0);
    // terran planet bonus: organics +5, energy +1
    expect(result.production.organics).toBe(5);
    expect(result.production.energy).toBe(1);
    expect(result.production.minerals).toBe(0);
    expect(result.production.researchPoints).toBe(0);
  });

  it('base tax income scales with population and economy trait', () => {
    const species = makeSpecies({ economy: 5 }); // factor = 1.0
    const empire = makeEmpire(species);
    const planet = makePlanet({ currentPopulation: 1_000_000 });

    const result = calculatePlanetProduction(planet, species, empire);

    // 1_000_000 * 0.01 * (5/5) * 1.2 (Democracy tradeIncome) = 12_000
    expect(result.taxIncome).toBeCloseTo(12_000);
    expect(result.production.credits).toBeCloseTo(12_000);
  });

  it('economy trait doubles tax income at trait 10 vs trait 5', () => {
    const speciesNormal = makeSpecies({ economy: 5 });
    const speciesRich = makeSpecies({ economy: 10 });
    const planet = makePlanet({ currentPopulation: 500_000 });

    const normal = calculatePlanetProduction(planet, speciesNormal, makeEmpire(speciesNormal));
    const rich = calculatePlanetProduction(planet, speciesRich, makeEmpire(speciesRich));

    expect(rich.taxIncome).toBeCloseTo(normal.taxIncome * 2);
  });

  it('planet with research lab produces research points', () => {
    const species = makeSpecies({ research: 5 }); // factor = 1.0
    const empire = makeEmpire(species);
    const planet = makePlanet({
      buildings: [makeBuilding('research_lab', 1)],
      currentPopulation: 0,
    });

    const result = calculatePlanetProduction(planet, species, empire);

    // base production for research_lab level 1 = 50 researchPoints, research trait 5 → factor 1
    expect(result.production.researchPoints).toBeCloseTo(50);
    expect(result.buildingOutputs).toHaveLength(1);
    expect(result.buildingOutputs[0].buildingType).toBe('research_lab');
    expect(result.buildingOutputs[0].resources.researchPoints).toBeCloseTo(50);
  });

  it('research trait amplifies research lab output', () => {
    const speciesNormal = makeSpecies({ research: 5 });
    const speciesGenius = makeSpecies({ research: 10 });
    const planet = makePlanet({ buildings: [makeBuilding('research_lab', 1)] });

    const normal = calculatePlanetProduction(planet, speciesNormal, makeEmpire(speciesNormal));
    const genius = calculatePlanetProduction(planet, speciesGenius, makeEmpire(speciesGenius));

    expect(genius.production.researchPoints).toBeCloseTo(normal.production.researchPoints * 2);
  });

  it('planet with factory produces minerals', () => {
    const species = makeSpecies({ construction: 5 }); // factor = 1.0
    const empire = makeEmpire(species);
    const planet = makePlanet({
      type: 'barren', // no organic/energy type bonus to keep test focused
      buildings: [makeBuilding('factory', 1)],
      currentPopulation: 0,
    });

    const result = calculatePlanetProduction(planet, species, empire);

    // factory base: minerals +4; construction trait 5 → factor 1
    // Energy consumption is now tracked via energyConsumption field, not baseProduction
    expect(result.production.minerals).toBeCloseTo(4 + 3); // factory 4 + barren bonus 3
    expect(result.production.energy).toBeCloseTo(0);
  });

  it('construction trait amplifies factory mineral output', () => {
    const speciesNormal = makeSpecies({ construction: 5 });
    const speciesBuilder = makeSpecies({ construction: 10 });
    // Use barren planet to isolate factory output
    const planet = makePlanet({
      type: 'barren',
      buildings: [makeBuilding('factory', 1)],
      currentPopulation: 0,
    });

    const normal = calculatePlanetProduction(planet, speciesNormal, makeEmpire(speciesNormal));
    const builder = calculatePlanetProduction(planet, speciesBuilder, makeEmpire(speciesBuilder));

    // minerals from factory only differ by construction factor; barren bonus is fixed
    const BARREN_MINERAL_BONUS = 3;
    const normalFactoryMinerals = normal.production.minerals - BARREN_MINERAL_BONUS;
    const builderFactoryMinerals = builder.production.minerals - BARREN_MINERAL_BONUS;
    expect(builderFactoryMinerals).toBeCloseTo(normalFactoryMinerals * 2);
  });

  it('ocean planet applies organics bonus', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);
    const planet = makePlanet({ type: 'ocean', currentPopulation: 0, buildings: [] });

    const result = calculatePlanetProduction(planet, species, empire);

    // ocean bonus: organics +10, energy +1
    expect(result.production.organics).toBeCloseTo(10);
    expect(result.production.energy).toBeCloseTo(1);
  });

  it('volcanic planet applies minerals and rare elements bonus', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);
    const planet = makePlanet({ type: 'volcanic', currentPopulation: 0, buildings: [] });

    const result = calculatePlanetProduction(planet, species, empire);

    // volcanic bonus: minerals +5, rareElements +3, energy +2
    expect(result.production.minerals).toBeCloseTo(5);
    expect(result.production.rareElements).toBeCloseTo(3);
    expect(result.production.energy).toBeCloseTo(2);
  });

  it('gas_giant planet applies exotic materials bonus', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);
    const planet = makePlanet({ type: 'gas_giant', currentPopulation: 0, buildings: [] });

    const result = calculatePlanetProduction(planet, species, empire);

    expect(result.production.exoticMaterials).toBeCloseTo(4);
    expect(result.production.energy).toBeCloseTo(3);
  });

  it('multiple buildings on same planet stack correctly', () => {
    const species = makeSpecies({ research: 5, construction: 5 });
    const empire = makeEmpire(species);
    const planet = makePlanet({
      type: 'barren',
      currentPopulation: 0,
      buildings: [makeBuilding('research_lab', 1), makeBuilding('factory', 1)],
    });

    const result = calculatePlanetProduction(planet, species, empire);

    // research_lab: +50 RP, factory: +4 minerals, barren: +3 minerals
    // Energy consumption is now tracked via energyConsumption field, not baseProduction
    expect(result.production.researchPoints).toBeCloseTo(50);
    expect(result.production.minerals).toBeCloseTo(4 + 3); // factory + barren
    expect(result.production.energy).toBeCloseTo(0);
    expect(result.buildingOutputs).toHaveLength(2);
  });

  it('level 2 research lab produces more than level 1', () => {
    const species = makeSpecies({ research: 5 });
    const planet1 = makePlanet({ buildings: [makeBuilding('research_lab', 1)] });
    const planet2 = makePlanet({ buildings: [makeBuilding('research_lab', 2)] });

    const result1 = calculatePlanetProduction(planet1, species, makeEmpire(species));
    const result2 = calculatePlanetProduction(planet2, species, makeEmpire(species));

    // Level 2 multiplier = BUILDING_LEVEL_MULTIPLIER^1 = 1.5
    expect(result2.production.researchPoints).toBeCloseTo(result1.production.researchPoints * 1.5);
  });

  it('mining facility output scales with planet natural resources rating', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);
    const richPlanet = makePlanet({ naturalResources: 100, buildings: [makeBuilding('mining_facility', 1)] });
    const poorPlanet = makePlanet({ naturalResources: 25, buildings: [makeBuilding('mining_facility', 1)] });

    const richResult = calculatePlanetProduction(richPlanet, species, empire);
    const poorResult = calculatePlanetProduction(poorPlanet, species, empire);

    // rich = factor 2.0, poor = factor 0.5 → rich produces 4x minerals from mining
    // (planet type bonuses are the same for both since both are 'terran')
    const richMiningMinerals = richResult.buildingOutputs[0].resources.minerals ?? 0;
    const poorMiningMinerals = poorResult.buildingOutputs[0].resources.minerals ?? 0;
    expect(richMiningMinerals).toBeCloseTo(poorMiningMinerals * 4);
  });
});

// ---------------------------------------------------------------------------
// calculateEmpireProduction
// ---------------------------------------------------------------------------

describe('calculateEmpireProduction', () => {
  it('totals production across multiple planets', () => {
    const species = makeSpecies({ research: 5 });
    const empire = makeEmpire(species);
    const planets: Planet[] = [
      makePlanet({ id: 'p1', buildings: [makeBuilding('research_lab', 1)], currentPopulation: 0 }),
      makePlanet({ id: 'p2', buildings: [makeBuilding('research_lab', 1)], currentPopulation: 0 }),
    ];

    const { total, perPlanet } = calculateEmpireProduction(planets, species, empire);

    expect(perPlanet).toHaveLength(2);
    // Each terran planet: RP from lab + type bonuses; two planets → double
    const singleRP = perPlanet[0].production.researchPoints;
    expect(total.researchPoints).toBeCloseTo(singleRP * 2);
  });

  it('returns zero totals for an empire with no planets', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);

    const { total, perPlanet } = calculateEmpireProduction([], species, empire);

    expect(perPlanet).toHaveLength(0);
    expect(total.credits).toBe(0);
    expect(total.minerals).toBe(0);
    expect(total.researchPoints).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateUpkeep
// ---------------------------------------------------------------------------

describe('calculateUpkeep', () => {
  it('calculates ship upkeep correctly', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);

    const upkeep = calculateUpkeep(empire, 3, 0);

    // 3 ships × 2 credits + 3 ships × 1 energy
    expect(upkeep.credits).toBe(-6);
    expect(upkeep.energy).toBe(-3);
    expect(upkeep.minerals).toBe(0);
  });

  it('calculates building maintenance correctly', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);

    const upkeep = calculateUpkeep(empire, 0, 5);

    // 5 buildings × 1 credit = -5
    expect(upkeep.credits).toBe(-5);
    expect(upkeep.energy).toBe(0);
  });

  it('combines ship and building upkeep', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);

    const upkeep = calculateUpkeep(empire, 2, 4);

    // ships: -4 credits, -2 energy; buildings: -4 credits
    expect(upkeep.credits).toBe(-8);
    expect(upkeep.energy).toBe(-2);
  });

  it('zero ships and zero buildings produce zero upkeep', () => {
    const species = makeSpecies();
    const empire = makeEmpire(species);

    const upkeep = calculateUpkeep(empire, 0, 0);

    expect(upkeep.credits).toBe(0);
    expect(upkeep.energy).toBe(0);
    expect(upkeep.minerals).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyResourceTick
// ---------------------------------------------------------------------------

describe('applyResourceTick', () => {
  it('adds production to existing resources', () => {
    const resources = makeResources({ credits: 100, minerals: 50 });
    const production: ResourceProduction = {
      credits: 20, minerals: 5, rareElements: 0, energy: 0,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    };
    const upkeep: ResourceProduction = {
      credits: 0, minerals: 0, rareElements: 0, energy: 0,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    };

    const result = applyResourceTick(resources, production, upkeep);

    expect(result.credits).toBe(120);
    expect(result.minerals).toBe(55);
  });

  it('subtracts upkeep from resources', () => {
    const resources = makeResources({ credits: 100, energy: 10 });
    const production: ResourceProduction = {
      credits: 0, minerals: 0, rareElements: 0, energy: 0,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    };
    const upkeep: ResourceProduction = {
      credits: -30, minerals: 0, rareElements: 0, energy: -5,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    };

    const result = applyResourceTick(resources, production, upkeep);

    expect(result.credits).toBe(70);
    expect(result.energy).toBe(5);
  });

  it('clamps resources to 0 minimum when upkeep exceeds available resources', () => {
    const resources = makeResources({ credits: 5 });
    const production: ResourceProduction = {
      credits: 0, minerals: 0, rareElements: 0, energy: 0,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    };
    const upkeep: ResourceProduction = {
      credits: -100, minerals: 0, rareElements: 0, energy: 0,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    };

    const result = applyResourceTick(resources, production, upkeep);

    expect(result.credits).toBe(0);
  });

  it('applies both production and upkeep in a single tick', () => {
    const resources = makeResources({ credits: 500, minerals: 100 });
    const production: ResourceProduction = {
      credits: 50, minerals: 10, rareElements: 0, energy: 5,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 3,
    };
    const upkeep: ResourceProduction = {
      credits: -20, minerals: 0, rareElements: 0, energy: -3,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    };

    const result = applyResourceTick(resources, production, upkeep);

    expect(result.credits).toBe(530);
    expect(result.minerals).toBe(110);
    expect(result.energy).toBe(2);
    expect(result.researchPoints).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// canAfford
// ---------------------------------------------------------------------------

describe('canAfford', () => {
  it('returns true when empire has exactly enough of each resource', () => {
    const resources = makeResources({ credits: 100, minerals: 50 });
    expect(canAfford(resources, { credits: 100, minerals: 50 })).toBe(true);
  });

  it('returns true when empire has more than enough', () => {
    const resources = makeResources({ credits: 500, minerals: 200 });
    expect(canAfford(resources, { credits: 100 })).toBe(true);
  });

  it('returns false when one resource is insufficient', () => {
    const resources = makeResources({ credits: 50, minerals: 200 });
    expect(canAfford(resources, { credits: 100, minerals: 50 })).toBe(false);
  });

  it('returns false when multiple resources are insufficient', () => {
    const resources = makeResources({ credits: 10, minerals: 10 });
    expect(canAfford(resources, { credits: 100, minerals: 100 })).toBe(false);
  });

  it('returns true for an empty cost object', () => {
    const resources = makeResources();
    expect(canAfford(resources, {})).toBe(true);
  });

  it('returns false when resource is exactly zero and cost is positive', () => {
    const resources = makeResources({ credits: 0 });
    expect(canAfford(resources, { credits: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// subtractResources
// ---------------------------------------------------------------------------

describe('subtractResources', () => {
  it('deducts specified resources from stockpile', () => {
    const resources = makeResources({ credits: 200, minerals: 80 });
    const result = subtractResources(resources, { credits: 150, minerals: 40 });

    expect(result.credits).toBe(50);
    expect(result.minerals).toBe(40);
  });

  it('leaves unspecified resources unchanged', () => {
    const resources = makeResources({ credits: 100, rareElements: 30, faith: 5 });
    const result = subtractResources(resources, { credits: 50 });

    expect(result.rareElements).toBe(30);
    expect(result.faith).toBe(5);
  });

  it('clamps to zero when cost exceeds available (no negative stockpiles)', () => {
    const resources = makeResources({ credits: 10 });
    const result = subtractResources(resources, { credits: 50 });

    expect(result.credits).toBe(0);
  });

  it('handles empty cost gracefully', () => {
    const resources = makeResources({ credits: 100, minerals: 50 });
    const result = subtractResources(resources, {});

    expect(result.credits).toBe(100);
    expect(result.minerals).toBe(50);
  });
});
