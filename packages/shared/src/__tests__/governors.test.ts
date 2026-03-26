/**
 * Tests for the governor engine.
 *
 * Covers:
 *  - Generated governors have valid modifier ranges
 *  - Governors age each tick
 *  - Governors die when turnsServed >= lifespan
 *  - Candidate pool generates the correct count
 *  - Governor modifiers apply correctly to production
 *  - Governor names are non-empty strings
 */

import { describe, it, expect } from 'vitest';
import {
  generateGovernor,
  generateCandidatePool,
  processGovernorsTick,
  applyGovernorModifiers,
} from '../engine/governors.js';
import type { Governor, GovernorModifiers } from '../types/governor.js';
import type { ResourceProduction } from '../types/resources.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProduction(overrides: Partial<ResourceProduction> = {}): ResourceProduction {
  return {
    credits: 100,
    minerals: 80,
    rareElements: 20,
    energy: 60,
    organics: 30,
    exoticMaterials: 10,
    faith: 5,
    researchPoints: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateGovernor
// ---------------------------------------------------------------------------

describe('generateGovernor', () => {
  it('returns a non-empty name', () => {
    const gov = generateGovernor('empire-1', 'planet-1', 1234);
    expect(typeof gov.name).toBe('string');
    expect(gov.name.trim().length).toBeGreaterThan(0);
  });

  it('sets planetId and empireId correctly', () => {
    const gov = generateGovernor('emp-42', 'planet-99', 9999);
    expect(gov.planetId).toBe('planet-99');
    expect(gov.empireId).toBe('emp-42');
  });

  it('starts with turnsServed === 0', () => {
    const gov = generateGovernor('e', 'p', 1);
    expect(gov.turnsServed).toBe(0);
  });

  it('has a lifespan between 1000 and 3000', () => {
    for (let seed = 0; seed < 50; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.lifespan).toBeGreaterThanOrEqual(1000);
      expect(gov.lifespan).toBeLessThanOrEqual(3000);
    }
  });

  it('has a non-empty trait', () => {
    const gov = generateGovernor('e', 'p', 7);
    expect(typeof gov.trait).toBe('string');
    expect(gov.trait.trim().length).toBeGreaterThan(0);
  });

  it('has all required modifier keys', () => {
    const gov = generateGovernor('e', 'p', 42);
    const keys: (keyof GovernorModifiers)[] = [
      'manufacturing', 'research', 'energyProduction', 'populationGrowth',
      'happiness', 'construction', 'mining', 'trade',
    ];
    for (const key of keys) {
      expect(gov.modifiers).toHaveProperty(key);
      expect(typeof gov.modifiers[key]).toBe('number');
    }
  });

  it('manufacturing modifier is within -10 to +20', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.manufacturing).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.manufacturing).toBeLessThanOrEqual(20);
    }
  });

  it('research modifier is within -10 to +20', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.research).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.research).toBeLessThanOrEqual(20);
    }
  });

  it('energyProduction modifier is within -10 to +20', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.energyProduction).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.energyProduction).toBeLessThanOrEqual(20);
    }
  });

  it('populationGrowth modifier is within -10 to +15', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.populationGrowth).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.populationGrowth).toBeLessThanOrEqual(15);
    }
  });

  it('happiness modifier is within -5 to +15', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.happiness).toBeGreaterThanOrEqual(-5);
      expect(gov.modifiers.happiness).toBeLessThanOrEqual(15);
    }
  });

  it('construction modifier is within -10 to +20', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.construction).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.construction).toBeLessThanOrEqual(20);
    }
  });

  it('mining modifier is within -10 to +20', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.mining).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.mining).toBeLessThanOrEqual(20);
    }
  });

  it('trade modifier is within -10 to +15', () => {
    for (let seed = 0; seed < 100; seed++) {
      const gov = generateGovernor('e', 'p', seed);
      expect(gov.modifiers.trade).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.trade).toBeLessThanOrEqual(15);
    }
  });

  it('produces different results with different seeds', () => {
    const gov1 = generateGovernor('e', 'p', 1);
    const gov2 = generateGovernor('e', 'p', 2);
    // Names or modifiers should differ (with overwhelming probability across seeds)
    const same = gov1.name === gov2.name
      && JSON.stringify(gov1.modifiers) === JSON.stringify(gov2.modifiers);
    expect(same).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateCandidatePool
// ---------------------------------------------------------------------------

describe('generateCandidatePool', () => {
  it('returns the requested number of candidates (default 5)', () => {
    const pool = generateCandidatePool('e', 'p');
    expect(pool.length).toBe(5);
  });

  it('returns 1 candidate when count is 1', () => {
    const pool = generateCandidatePool('e', 'p', 1);
    expect(pool.length).toBe(1);
  });

  it('returns 10 candidates when count is 10', () => {
    const pool = generateCandidatePool('e', 'p', 10);
    expect(pool.length).toBe(10);
  });

  it('clamps count to maximum 10', () => {
    const pool = generateCandidatePool('e', 'p', 99);
    expect(pool.length).toBe(10);
  });

  it('clamps count to minimum 1', () => {
    const pool = generateCandidatePool('e', 'p', 0);
    expect(pool.length).toBe(1);
  });

  it('all candidates have valid modifier ranges', () => {
    const pool = generateCandidatePool('e', 'p', 8);
    for (const gov of pool) {
      expect(gov.modifiers.manufacturing).toBeGreaterThanOrEqual(-10);
      expect(gov.modifiers.manufacturing).toBeLessThanOrEqual(20);
      expect(gov.modifiers.happiness).toBeGreaterThanOrEqual(-5);
      expect(gov.modifiers.happiness).toBeLessThanOrEqual(15);
    }
  });
});

// ---------------------------------------------------------------------------
// processGovernorsTick
// ---------------------------------------------------------------------------

describe('processGovernorsTick', () => {
  function makeGovernor(turnsServed: number, lifespan: number): Governor {
    return {
      id: `gov-${turnsServed}-${lifespan}`,
      name: 'Test Governor',
      planetId: 'p1',
      empireId: 'e1',
      turnsServed,
      lifespan,
      modifiers: {
        manufacturing: 5,
        research: 3,
        energyProduction: 2,
        populationGrowth: 1,
        happiness: 4,
        construction: 6,
        mining: 7,
        trade: 2,
      },
      trait: 'Methodical planner',
    };
  }

  it('increments turnsServed by 1 for surviving governors', () => {
    const gov = makeGovernor(10, 200);
    const { updated } = processGovernorsTick([gov]);
    expect(updated[0]!.turnsServed).toBe(11);
  });

  it('moves governors to died when turnsServed reaches lifespan', () => {
    const gov = makeGovernor(199, 200);
    const { updated, died } = processGovernorsTick([gov]);
    // turnsServed becomes 200, which equals lifespan 200 — should die
    expect(updated.length).toBe(0);
    expect(died.length).toBe(1);
    expect(died[0]!.turnsServed).toBe(200);
  });

  it('moves governors to died when turnsServed exceeds lifespan (already over)', () => {
    const gov = makeGovernor(300, 200);
    const { updated, died } = processGovernorsTick([gov]);
    expect(updated.length).toBe(0);
    expect(died.length).toBe(1);
  });

  it('separates dying and surviving governors in the same tick', () => {
    const nearDeath = makeGovernor(149, 150);
    const young = makeGovernor(10, 200);
    const { updated, died } = processGovernorsTick([nearDeath, young]);
    expect(died.length).toBe(1);
    expect(died[0]!.id).toBe(nearDeath.id);
    expect(updated.length).toBe(1);
    expect(updated[0]!.id).toBe(young.id);
  });

  it('returns empty arrays when given an empty list', () => {
    const { updated, died } = processGovernorsTick([]);
    expect(updated.length).toBe(0);
    expect(died.length).toBe(0);
  });

  it('does not mutate the original governor object', () => {
    const gov = makeGovernor(5, 100);
    const originalTurns = gov.turnsServed;
    processGovernorsTick([gov]);
    expect(gov.turnsServed).toBe(originalTurns);
  });
});

// ---------------------------------------------------------------------------
// applyGovernorModifiers
// ---------------------------------------------------------------------------

describe('applyGovernorModifiers', () => {
  function makeGovernorWithMods(mods: Partial<GovernorModifiers>): Governor {
    return {
      id: 'g1',
      name: 'Test',
      planetId: 'p1',
      empireId: 'e1',
      turnsServed: 0,
      lifespan: 200,
      modifiers: {
        manufacturing: 0,
        research: 0,
        energyProduction: 0,
        populationGrowth: 0,
        happiness: 0,
        construction: 0,
        mining: 0,
        trade: 0,
        ...mods,
      },
      trait: 'Test',
    };
  }

  it('returns production unchanged when governor is undefined', () => {
    const prod = makeProduction();
    const result = applyGovernorModifiers(prod, undefined);
    expect(result).toEqual(prod);
  });

  it('applies a positive trade modifier to credits', () => {
    const gov = makeGovernorWithMods({ trade: 10 }); // +10%
    const prod = makeProduction({ credits: 100 });
    const result = applyGovernorModifiers(prod, gov);
    expect(result.credits).toBeCloseTo(110, 1);
  });

  it('applies a negative trade modifier to credits', () => {
    const gov = makeGovernorWithMods({ trade: -10 }); // -10%
    const prod = makeProduction({ credits: 100 });
    const result = applyGovernorModifiers(prod, gov);
    expect(result.credits).toBeCloseTo(90, 1);
  });

  it('applies a research modifier to researchPoints', () => {
    const gov = makeGovernorWithMods({ research: 20 }); // +20%
    const prod = makeProduction({ researchPoints: 50 });
    const result = applyGovernorModifiers(prod, gov);
    expect(result.researchPoints).toBeCloseTo(60, 1);
  });

  it('applies an energyProduction modifier to energy', () => {
    const gov = makeGovernorWithMods({ energyProduction: 15 }); // +15%
    const prod = makeProduction({ energy: 60 });
    const result = applyGovernorModifiers(prod, gov);
    expect(result.energy).toBeCloseTo(69, 1);
  });

  it('applies a mining modifier to rareElements', () => {
    const gov = makeGovernorWithMods({ mining: 10 }); // +10%
    const prod = makeProduction({ rareElements: 20 });
    const result = applyGovernorModifiers(prod, gov);
    expect(result.rareElements).toBeCloseTo(22, 1);
  });

  it('applies manufacturing modifier to exoticMaterials', () => {
    const gov = makeGovernorWithMods({ manufacturing: 10 }); // +10%
    const prod = makeProduction({ exoticMaterials: 10 });
    const result = applyGovernorModifiers(prod, gov);
    expect(result.exoticMaterials).toBeCloseTo(11, 1);
  });

  it('does not affect organics or faith', () => {
    const gov = makeGovernorWithMods({ manufacturing: 20, research: 20, trade: 15 });
    const prod = makeProduction({ organics: 30, faith: 5 });
    const result = applyGovernorModifiers(prod, gov);
    expect(result.organics).toBe(30);
    expect(result.faith).toBe(5);
  });

  it('zero modifiers produce no change', () => {
    const gov = makeGovernorWithMods({});
    const prod = makeProduction();
    const result = applyGovernorModifiers(prod, gov);
    expect(result.credits).toBe(prod.credits);
    expect(result.minerals).toBe(prod.minerals);
    expect(result.researchPoints).toBe(prod.researchPoints);
    expect(result.energy).toBe(prod.energy);
  });
});
