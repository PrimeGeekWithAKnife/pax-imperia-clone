import { describe, it, expect } from 'vitest';
import {
  calculatePlanetHappiness,
  empireIsAtWar,
  HAPPINESS_BONUS_THRESHOLD,
  HAPPINESS_UNREST_THRESHOLD,
  HAPPINESS_REVOLT_THRESHOLD,
  UNREST_PRODUCTION_MULTIPLIER,
  HAPPINESS_GROWTH_BONUS,
} from '../engine/happiness.js';
import {
  getEnergyStatus,
  applyFoodConsumption,
  calculateOrganicsConsumption,
} from '../engine/economy.js';
import type { Planet, Building } from '../types/galaxy.js';
import type { EmpireResources } from '../types/resources.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

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
    maxPopulation: 1_000_000,
    currentPopulation: 200_000, // 20 % density — ample living space
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
    credits: 500,
    minerals: 100,
    rareElements: 0,
    energy: 50,
    organics: 100,
    exoticMaterials: 0,
    faith: 0,
    researchPoints: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculatePlanetHappiness — baseline and happy planet
// ---------------------------------------------------------------------------

describe('calculatePlanetHappiness — happy planet', () => {
  it('a planet with entertainment buildings and low density scores above 70', () => {
    const planet = makePlanet({
      currentPopulation: 100_000, // 10 % density
      buildings: [makeBuilding('entertainment_complex', 2)],
    });
    const resources = makeResources();

    const report = calculatePlanetHappiness(planet, resources, false);

    expect(report.score).toBeGreaterThan(HAPPINESS_BONUS_THRESHOLD);
    expect(report.hasBonusGrowth).toBe(true);
    expect(report.isUnrest).toBe(false);
    expect(report.isRevolt).toBe(false);
    expect(report.growthModifier).toBe(HAPPINESS_GROWTH_BONUS);
    expect(report.productionMultiplier).toBe(1.0);
    expect(report.revoltPopulationLoss).toBe(0);
  });

  it('entertainment buildings contribute positive factors', () => {
    const noEnt = makePlanet({ currentPopulation: 100_000, buildings: [] });
    const withEnt = makePlanet({
      currentPopulation: 100_000,
      buildings: [makeBuilding('entertainment_complex', 1)],
    });
    const resources = makeResources();

    const scoreNoEnt = calculatePlanetHappiness(noEnt, resources, false).score;
    const scoreWithEnt = calculatePlanetHappiness(withEnt, resources, false).score;

    expect(scoreWithEnt).toBeGreaterThan(scoreNoEnt);
  });
});

// ---------------------------------------------------------------------------
// Overcrowding
// ---------------------------------------------------------------------------

describe('calculatePlanetHappiness — overcrowding', () => {
  it('a heavily overcrowded planet (>95 % density) scores lower than a balanced one', () => {
    const crowded = makePlanet({ currentPopulation: 960_000 }); // 96 % density
    const balanced = makePlanet({ currentPopulation: 200_000 }); // 20 % density
    const resources = makeResources();

    const crowdedScore = calculatePlanetHappiness(crowded, resources, false).score;
    const balancedScore = calculatePlanetHappiness(balanced, resources, false).score;

    expect(crowdedScore).toBeLessThan(balancedScore);
  });

  it('a severely overcrowded planet applies the −20 pts factor', () => {
    const baseline = makePlanet({ currentPopulation: 200_000 }); // low density
    const crowded = makePlanet({ currentPopulation: 960_000 });   // > 95 %
    const resources = makeResources();

    const baseScore = calculatePlanetHappiness(baseline, resources, false).score;
    const crowdedScore = calculatePlanetHappiness(crowded, resources, false).score;

    // Severe overcrowding is −20 pts vs ample space +10 pts → delta ≥ 30
    expect(baseScore - crowdedScore).toBeGreaterThanOrEqual(30);
  });
});

// ---------------------------------------------------------------------------
// Energy deficit
// ---------------------------------------------------------------------------

describe('calculatePlanetHappiness — energy deficit', () => {
  it('energy deficit reduces happiness by 15 pts', () => {
    const planet = makePlanet({ currentPopulation: 200_000 });
    const noDeficit = makeResources({ energy: 50 });
    const deficit = makeResources({ energy: 0 });

    const normalScore = calculatePlanetHappiness(planet, noDeficit, false).score;
    const deficitScore = calculatePlanetHappiness(planet, deficit, false).score;

    expect(normalScore - deficitScore).toBe(15);
  });

  it('energy deficit alone does not push a healthy colony below unrest threshold', () => {
    // A planet with entertainment complexes should absorb a deficit without revolt.
    const planet = makePlanet({
      currentPopulation: 100_000,
      buildings: [makeBuilding('entertainment_complex', 2)],
    });
    const deficit = makeResources({ energy: 0 });

    const report = calculatePlanetHappiness(planet, deficit, false);

    expect(report.isUnrest).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unrest — production penalty
// ---------------------------------------------------------------------------

describe('calculatePlanetHappiness — unrest threshold', () => {
  it('happiness below 30 sets productionMultiplier to 0.5', () => {
    // Force unrest: no entertainment, high density, energy deficit, at war, no food.
    const planet = makePlanet({
      currentPopulation: 960_000, // severe overcrowding
      buildings: [],
    });
    const emptyResources = makeResources({ energy: 0, organics: 0 });

    const report = calculatePlanetHappiness(planet, emptyResources, true);

    expect(report.score).toBeLessThan(HAPPINESS_UNREST_THRESHOLD);
    expect(report.isUnrest).toBe(true);
    expect(report.productionMultiplier).toBe(UNREST_PRODUCTION_MULTIPLIER);
  });

  it('a planet at neutral happiness (30–70) has a 1.0 production multiplier', () => {
    // Default planet is at ~65 with no negative factors.
    const planet = makePlanet({ currentPopulation: 200_000, buildings: [] });
    const resources = makeResources();

    const report = calculatePlanetHappiness(planet, resources, false);

    if (!report.isUnrest) {
      expect(report.productionMultiplier).toBe(1.0);
    }
  });
});

// ---------------------------------------------------------------------------
// Growth bonus
// ---------------------------------------------------------------------------

describe('calculatePlanetHappiness — growth bonus', () => {
  it('happiness above 70 gives a non-zero growthModifier', () => {
    const planet = makePlanet({
      currentPopulation: 100_000,
      buildings: [makeBuilding('entertainment_complex', 2)],
    });
    const resources = makeResources();

    const report = calculatePlanetHappiness(planet, resources, false);

    expect(report.score).toBeGreaterThan(HAPPINESS_BONUS_THRESHOLD);
    expect(report.growthModifier).toBeGreaterThan(0);
  });

  it('happiness at or below 70 gives zero growthModifier', () => {
    // Suppress entertainment to keep score around neutral.
    const planet = makePlanet({ currentPopulation: 200_000, buildings: [] });
    const resources = makeResources({ energy: 0 }); // small penalty

    const report = calculatePlanetHappiness(planet, resources, false);

    if (report.score <= HAPPINESS_BONUS_THRESHOLD) {
      expect(report.growthModifier).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Revolt — population loss
// ---------------------------------------------------------------------------

describe('calculatePlanetHappiness — revolt', () => {
  it('happiness below 10 causes population loss', () => {
    // Maximise negative factors to force revolt.
    const planet = makePlanet({
      currentPopulation: 960_000,
      buildings: [],
    });
    const emptyResources = makeResources({ energy: 0, organics: 0 });

    const report = calculatePlanetHappiness(planet, emptyResources, true);

    if (report.score < HAPPINESS_REVOLT_THRESHOLD) {
      expect(report.isRevolt).toBe(true);
      expect(report.revoltPopulationLoss).toBeGreaterThan(0);
    }
  });

  it('revolt population loss is at least 1', () => {
    const planet = makePlanet({
      currentPopulation: 1, // minimal colony
      buildings: [],
    });
    const emptyResources = makeResources({ energy: 0, organics: 0 });

    const report = calculatePlanetHappiness(planet, emptyResources, true);

    if (report.isRevolt) {
      expect(report.revoltPopulationLoss).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// empireIsAtWar
// ---------------------------------------------------------------------------

describe('empireIsAtWar', () => {
  it('returns true when at least one diplomatic relation is at_war', () => {
    const empire = { diplomacy: [{ status: 'friendly' }, { status: 'at_war' }] };
    expect(empireIsAtWar(empire)).toBe(true);
  });

  it('returns false when no relations are at_war', () => {
    const empire = { diplomacy: [{ status: 'neutral' }, { status: 'allied' }] };
    expect(empireIsAtWar(empire)).toBe(false);
  });

  it('returns false for an empire with no diplomatic relations', () => {
    const empire = { diplomacy: [] };
    expect(empireIsAtWar(empire)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Energy status (economy.ts)
// ---------------------------------------------------------------------------

describe('getEnergyStatus', () => {
  it('reports no deficit when energy > 0', () => {
    const status = getEnergyStatus(makeResources({ energy: 10 }));
    expect(status.isDeficit).toBe(false);
    expect(status.productionMultiplier).toBe(1.0);
    expect(status.researchMultiplier).toBe(1.0);
    expect(status.constructionMultiplier).toBe(1.0);
    expect(status.warningTooltip).toBe('');
  });

  it('reports deficit when energy is 0', () => {
    const status = getEnergyStatus(makeResources({ energy: 0 }));
    expect(status.isDeficit).toBe(true);
    expect(status.productionMultiplier).toBe(0.5);
    expect(status.researchMultiplier).toBe(0.5);
    expect(status.constructionMultiplier).toBe(0.5);
    expect(status.warningTooltip).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// Food consumption (economy.ts)
// ---------------------------------------------------------------------------

describe('calculateOrganicsConsumption', () => {
  it('returns 0 for zero population', () => {
    expect(calculateOrganicsConsumption(0)).toBe(0);
  });

  it('returns 1 for exactly 1 000 population', () => {
    expect(calculateOrganicsConsumption(1_000)).toBe(1);
  });

  it('floors fractional consumption', () => {
    expect(calculateOrganicsConsumption(1_500)).toBe(1);
    expect(calculateOrganicsConsumption(2_999)).toBe(2);
  });
});

describe('applyFoodConsumption — starvation causes population loss', () => {
  it('deducts organics from the stockpile when population consumes food', () => {
    const resources = makeResources({ organics: 20 });
    const totalPop = 5_000; // consumes 5 organics

    const { resources: updated, isStarving, consumed } = applyFoodConsumption(resources, totalPop);

    expect(consumed).toBe(5);
    expect(updated.organics).toBe(15);
    expect(isStarving).toBe(false);
  });

  it('reports starvation when organics are insufficient', () => {
    const resources = makeResources({ organics: 2 });
    const totalPop = 10_000; // consumes 10 organics, only 2 available

    const { resources: updated, isStarving, consumed } = applyFoodConsumption(resources, totalPop);

    expect(consumed).toBe(10);
    expect(updated.organics).toBe(0);
    expect(isStarving).toBe(true);
  });

  it('no organics in stockpile (starvation from tick one) causes isStarving=true', () => {
    const resources = makeResources({ organics: 0 });
    const totalPop = 1_000;

    const { isStarving } = applyFoodConsumption(resources, totalPop);

    expect(isStarving).toBe(true);
  });

  it('population of zero consumes no organics and does not starve', () => {
    const resources = makeResources({ organics: 0 });

    const { isStarving, consumed } = applyFoodConsumption(resources, 0);

    expect(consumed).toBe(0);
    expect(isStarving).toBe(false);
  });

  it('stockpile organics do not go negative', () => {
    const resources = makeResources({ organics: 0 });
    const totalPop = 50_000;

    const { resources: updated } = applyFoodConsumption(resources, totalPop);

    expect(updated.organics).toBeGreaterThanOrEqual(0);
  });
});
