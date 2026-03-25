import { describe, it, expect } from 'vitest';
import {
  getDecayRate,
  tickBuildingCondition,
  isBuildingFunctional,
  isBuildingRepairable,
  calculateRepairCost,
  NON_FUNCTIONAL_THRESHOLD,
  UNREPAIRABLE_THRESHOLD,
  DEFAULT_CONDITION,
} from '../engine/building-condition.js';
import type { Building } from '../types/galaxy.js';
import type { BuildingDefinition } from '../constants/buildings.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeBuilding(
  type: Building['type'],
  overrides: Partial<Building> = {},
): Building {
  return {
    id: `building-${type}`,
    type,
    level: 1,
    ...overrides,
  };
}

function makeBuildingDef(overrides: Partial<BuildingDefinition> = {}): BuildingDefinition {
  return {
    name: 'Test Building',
    baseCost: { credits: 100 },
    baseProduction: {},
    buildTime: 10,
    maintenanceCost: { credits: 1 },
    energyConsumption: 2,
    wasteOutput: 0.2,
    happinessImpact: 0,
    maxLevel: 5,
    description: 'A test building.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDecayRate
// ---------------------------------------------------------------------------

describe('getDecayRate', () => {
  it('returns 30 for heavy industry (factory)', () => {
    expect(getDecayRate('factory')).toBe(30);
  });

  it('returns 30 for heavy industry (shipyard)', () => {
    expect(getDecayRate('shipyard')).toBe(30);
  });

  it('returns 30 for heavy industry (mining facility)', () => {
    expect(getDecayRate('mining_facility')).toBe(30);
  });

  it('returns 20 for infrastructure (spaceport)', () => {
    expect(getDecayRate('spaceport')).toBe(20);
  });

  it('returns 20 for infrastructure (trade hub)', () => {
    expect(getDecayRate('trade_hub')).toBe(20);
  });

  it('returns 15 for sensitive equipment (research lab)', () => {
    expect(getDecayRate('research_lab')).toBe(15);
  });

  it('returns 15 for sensitive equipment (medical bay)', () => {
    expect(getDecayRate('medical_bay')).toBe(15);
  });

  it('returns 10 for biological (hydroponics bay)', () => {
    expect(getDecayRate('hydroponics_bay')).toBe(10);
  });

  it('returns 10 for biological (population centre)', () => {
    expect(getDecayRate('population_center')).toBe(10);
  });

  it('returns 25 for military (defence grid)', () => {
    expect(getDecayRate('defense_grid')).toBe(25);
  });

  it('returns 25 for military (military academy)', () => {
    expect(getDecayRate('military_academy')).toBe(25);
  });

  it('returns 20 for power (power plant)', () => {
    expect(getDecayRate('power_plant')).toBe(20);
  });

  it('returns 20 for power (fusion reactor)', () => {
    expect(getDecayRate('fusion_reactor')).toBe(20);
  });

  it('returns default 20 for unknown building types', () => {
    // Racial buildings not explicitly listed should get the default
    expect(getDecayRate('crystal_resonance_chamber')).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// tickBuildingCondition
// ---------------------------------------------------------------------------

describe('tickBuildingCondition', () => {
  it('preserves condition when maintenance is paid', () => {
    const building = makeBuilding('factory', { condition: 85 });
    expect(tickBuildingCondition(building, true)).toBe(85);
  });

  it('defaults to 100 condition when not set', () => {
    const building = makeBuilding('factory');
    expect(tickBuildingCondition(building, true)).toBe(DEFAULT_CONDITION);
  });

  it('reduces condition when maintenance is not paid', () => {
    const building = makeBuilding('factory', { condition: 100 });
    const newCondition = tickBuildingCondition(building, false);
    expect(newCondition).toBeLessThan(100);
  });

  it('loses 1/30 per tick for factory (heavy industry)', () => {
    const building = makeBuilding('factory', { condition: 100 });
    const newCondition = tickBuildingCondition(building, false);
    expect(newCondition).toBeCloseTo(100 - 1 / 30);
  });

  it('loses 1/10 per tick for hydroponics (biological)', () => {
    const building = makeBuilding('hydroponics_bay', { condition: 100 });
    const newCondition = tickBuildingCondition(building, false);
    expect(newCondition).toBeCloseTo(100 - 1 / 10);
  });

  it('loses 1/15 per tick for research lab (sensitive)', () => {
    const building = makeBuilding('research_lab', { condition: 100 });
    const newCondition = tickBuildingCondition(building, false);
    expect(newCondition).toBeCloseTo(100 - 1 / 15);
  });

  it('does not go below 0', () => {
    const building = makeBuilding('hydroponics_bay', { condition: 0.05 });
    const newCondition = tickBuildingCondition(building, false);
    expect(newCondition).toBe(0);
  });

  it('factory reaches 70% after 900 ticks without maintenance', () => {
    // Factory decay rate: 30 ticks per 1%, so 30 * 30 = 900 ticks to lose 30%
    let condition = 100;
    const building = makeBuilding('factory');
    for (let i = 0; i < 900; i++) {
      building.condition = condition;
      condition = tickBuildingCondition(building, false);
    }
    expect(condition).toBeCloseTo(70, 0);
  });
});

// ---------------------------------------------------------------------------
// isBuildingFunctional
// ---------------------------------------------------------------------------

describe('isBuildingFunctional', () => {
  it('returns true at 100%', () => {
    expect(isBuildingFunctional(100)).toBe(true);
  });

  it('returns true at 71%', () => {
    expect(isBuildingFunctional(71)).toBe(true);
  });

  it('returns false at 70% (non-functional threshold)', () => {
    expect(isBuildingFunctional(NON_FUNCTIONAL_THRESHOLD)).toBe(false);
  });

  it('returns false at 50%', () => {
    expect(isBuildingFunctional(50)).toBe(false);
  });

  it('returns false at 0%', () => {
    expect(isBuildingFunctional(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBuildingRepairable
// ---------------------------------------------------------------------------

describe('isBuildingRepairable', () => {
  it('returns true at 100%', () => {
    expect(isBuildingRepairable(100)).toBe(true);
  });

  it('returns true at 30% (threshold)', () => {
    expect(isBuildingRepairable(UNREPAIRABLE_THRESHOLD)).toBe(true);
  });

  it('returns true at 50%', () => {
    expect(isBuildingRepairable(50)).toBe(true);
  });

  it('returns false at 29%', () => {
    expect(isBuildingRepairable(29)).toBe(false);
  });

  it('returns false at 0%', () => {
    expect(isBuildingRepairable(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateRepairCost
// ---------------------------------------------------------------------------

describe('calculateRepairCost', () => {
  it('calculates cost proportional to condition delta', () => {
    const def = makeBuildingDef({ baseCost: { credits: 200 }, buildTime: 10 });
    const { credits, ticks } = calculateRepairCost(def, 50, 100);
    // 50% to restore, 50% of build cost * 0.5 = 200 * 0.5 * 0.5 = 50
    expect(credits).toBe(50);
    // 50% of build time * 0.5 = 10 * 0.5 * 0.5 = 2.5 => ceil = 3
    expect(ticks).toBe(3);
  });

  it('returns 0 cost when already at target condition', () => {
    const def = makeBuildingDef({ baseCost: { credits: 200 }, buildTime: 10 });
    const { credits, ticks } = calculateRepairCost(def, 100, 100);
    expect(credits).toBe(0);
    expect(ticks).toBe(0);
  });

  it('defaults target condition to 100', () => {
    const def = makeBuildingDef({ baseCost: { credits: 100 }, buildTime: 10 });
    const { credits, ticks } = calculateRepairCost(def, 0);
    // 100% to restore: 100 * 0.5 * 1.0 = 50
    expect(credits).toBe(50);
    // 10 * 0.5 * 1.0 = 5
    expect(ticks).toBe(5);
  });

  it('returns 0 when current condition exceeds target', () => {
    const def = makeBuildingDef({ baseCost: { credits: 200 }, buildTime: 10 });
    const { credits, ticks } = calculateRepairCost(def, 80, 70);
    expect(credits).toBe(0);
    expect(ticks).toBe(0);
  });

  it('rounds credits up to nearest integer', () => {
    const def = makeBuildingDef({ baseCost: { credits: 70 }, buildTime: 6 });
    const { credits } = calculateRepairCost(def, 90, 100);
    // 10% to restore: 70 * 0.5 * 0.1 = 3.5 => ceil = 4
    expect(credits).toBe(4);
  });

  it('handles building with no credit cost', () => {
    const def = makeBuildingDef({ baseCost: {}, buildTime: 10 });
    const { credits } = calculateRepairCost(def, 50, 100);
    expect(credits).toBe(0);
  });
});
