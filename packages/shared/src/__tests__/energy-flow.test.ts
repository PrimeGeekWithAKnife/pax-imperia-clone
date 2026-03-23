import { describe, it, expect } from 'vitest';
import {
  calculateEnergyProduction,
  calculateEnergyDemand,
  calculateEnergyBalance,
  getEnergyHappinessModifier,
  getBuildingEfficiency,
  calculateStorageCapacity,
} from '../engine/energy-flow.js';
import type { Building } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let counter = 0;

function makeBuilding(
  type: Building['type'],
  overrides: Partial<Building> = {},
): Building {
  counter++;
  return {
    id: `building-${type}-${counter}`,
    type,
    level: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateEnergyProduction
// ---------------------------------------------------------------------------

describe('calculateEnergyProduction', () => {
  it('returns 20 for a single power plant', () => {
    const buildings = [makeBuilding('power_plant')];
    expect(calculateEnergyProduction(buildings)).toBe(20);
  });

  it('returns 35 for a single fusion reactor', () => {
    const buildings = [makeBuilding('fusion_reactor')];
    expect(calculateEnergyProduction(buildings)).toBe(35);
  });

  it('returns 5 for an orbital platform', () => {
    const buildings = [makeBuilding('orbital_platform')];
    expect(calculateEnergyProduction(buildings)).toBe(5);
  });

  it('returns 1 for a recycling plant', () => {
    const buildings = [makeBuilding('recycling_plant')];
    expect(calculateEnergyProduction(buildings)).toBe(1);
  });

  it('sums production from multiple power buildings', () => {
    const buildings = [
      makeBuilding('power_plant'),
      makeBuilding('fusion_reactor'),
      makeBuilding('orbital_platform'),
    ];
    // 20 + 35 + 5 = 60
    expect(calculateEnergyProduction(buildings)).toBe(60);
  });

  it('ignores non-power-producing buildings', () => {
    const buildings = [
      makeBuilding('power_plant'),
      makeBuilding('factory'),
      makeBuilding('research_lab'),
    ];
    expect(calculateEnergyProduction(buildings)).toBe(20);
  });

  it('excludes power buildings below 70% condition', () => {
    const buildings = [
      makeBuilding('power_plant', { condition: 69 }),
    ];
    expect(calculateEnergyProduction(buildings)).toBe(0);
  });

  it('includes power buildings at exactly 70% condition', () => {
    const buildings = [
      makeBuilding('power_plant', { condition: 70 }),
    ];
    expect(calculateEnergyProduction(buildings)).toBe(20);
  });

  it('includes power buildings with undefined condition (defaults to 100)', () => {
    const buildings = [
      makeBuilding('power_plant'),
    ];
    expect(calculateEnergyProduction(buildings)).toBe(20);
  });

  it('returns 0 for an empty building list', () => {
    expect(calculateEnergyProduction([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateEnergyDemand
// ---------------------------------------------------------------------------

describe('calculateEnergyDemand', () => {
  it('returns 3 for a single research lab', () => {
    const buildings = [makeBuilding('research_lab')];
    expect(calculateEnergyDemand(buildings)).toBe(3);
  });

  it('returns 2 for a single factory', () => {
    const buildings = [makeBuilding('factory')];
    expect(calculateEnergyDemand(buildings)).toBe(2);
  });

  it('returns 5 for a single shipyard', () => {
    const buildings = [makeBuilding('shipyard')];
    expect(calculateEnergyDemand(buildings)).toBe(5);
  });

  it('sums demand from multiple consumer buildings', () => {
    const buildings = [
      makeBuilding('research_lab'),  // 3
      makeBuilding('factory'),        // 2
      makeBuilding('shipyard'),       // 5
    ];
    expect(calculateEnergyDemand(buildings)).toBe(10);
  });

  it('excludes power-producing buildings from demand', () => {
    const buildings = [
      makeBuilding('power_plant'),
      makeBuilding('fusion_reactor'),
      makeBuilding('factory'),  // 2
    ];
    expect(calculateEnergyDemand(buildings)).toBe(2);
  });

  it('excludes disabled buildings from demand', () => {
    const lab = makeBuilding('research_lab');
    const factory = makeBuilding('factory');
    const buildings = [lab, factory];
    // Disable the research lab
    expect(calculateEnergyDemand(buildings, [lab.id])).toBe(2);
  });

  it('returns 0 when all buildings are disabled', () => {
    const lab = makeBuilding('research_lab');
    const factory = makeBuilding('factory');
    const buildings = [lab, factory];
    expect(calculateEnergyDemand(buildings, [lab.id, factory.id])).toBe(0);
  });

  it('returns 0 for an empty building list', () => {
    expect(calculateEnergyDemand([])).toBe(0);
  });

  it('returns correct demand for waste management buildings', () => {
    const buildings = [
      makeBuilding('waste_dump'),           // 0.5
      makeBuilding('atmosphere_cleanser'),  // 3
      makeBuilding('orbital_waste_ejector'),// 4
    ];
    expect(calculateEnergyDemand(buildings)).toBeCloseTo(7.5);
  });

  it('returns 1 for energy storage', () => {
    const buildings = [makeBuilding('energy_storage')];
    expect(calculateEnergyDemand(buildings)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateEnergyBalance
// ---------------------------------------------------------------------------

describe('calculateEnergyBalance', () => {
  it('returns positive balance when production exceeds demand', () => {
    const state = calculateEnergyBalance(30, 20, 0, 0);
    expect(state.balance).toBe(10);
    expect(state.ratio).toBeCloseTo(1.5);
  });

  it('returns negative balance when demand exceeds production', () => {
    const state = calculateEnergyBalance(10, 20, 0, 0);
    expect(state.balance).toBe(-10);
  });

  it('stores surplus energy up to storage capacity', () => {
    const state = calculateEnergyBalance(30, 20, 0, 100);
    // Surplus of 10, storage capacity 100 => store 10
    expect(state.storedEnergy).toBe(10);
  });

  it('caps stored energy at storage capacity', () => {
    const state = calculateEnergyBalance(30, 20, 95, 100);
    // Surplus of 10, but only 5 space available
    expect(state.storedEnergy).toBe(100);
  });

  it('draws from storage when production is insufficient', () => {
    const state = calculateEnergyBalance(10, 20, 50, 100);
    // Deficit of 10, draw from storage
    expect(state.storedEnergy).toBe(40);
  });

  it('does not draw more from storage than available', () => {
    const state = calculateEnergyBalance(10, 20, 5, 100);
    // Deficit of 10, but only 5 in storage
    expect(state.storedEnergy).toBe(0);
  });

  it('calculates ratio including storage draw', () => {
    // Production 10, demand 20, 10 in storage, 100 capacity
    // Effective supply = 10 (production) + 10 (drawn from storage) = 20
    const state = calculateEnergyBalance(10, 20, 10, 100);
    expect(state.ratio).toBeCloseTo(1.0);
  });

  it('returns ratio of 1.0 when supply equals demand with no buildings', () => {
    const state = calculateEnergyBalance(0, 0, 0, 0);
    expect(state.ratio).toBe(1.0);
  });

  it('returns high ratio when producing but no demand', () => {
    const state = calculateEnergyBalance(20, 0, 0, 0);
    expect(state.ratio).toBe(10); // Capped at 10
  });

  it('applies correct happiness modifier to the state', () => {
    // Ratio 2.0 => +5 happiness
    const state = calculateEnergyBalance(40, 20, 0, 0);
    expect(state.energyHappinessModifier).toBe(5);
  });

  it('copies disabled building IDs into the result', () => {
    const state = calculateEnergyBalance(20, 10, 0, 0, ['b1', 'b2']);
    expect(state.disabledBuildingIds).toEqual(['b1', 'b2']);
  });

  it('preserves storage capacity in the result', () => {
    const state = calculateEnergyBalance(20, 10, 0, 500);
    expect(state.storageCapacity).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// getEnergyHappinessModifier
// ---------------------------------------------------------------------------

describe('getEnergyHappinessModifier', () => {
  it('returns +5 when ratio > 1.5', () => {
    expect(getEnergyHappinessModifier(2.0)).toBe(5);
    expect(getEnergyHappinessModifier(1.51)).toBe(5);
  });

  it('returns 0 when ratio is 1.0 to 1.5', () => {
    expect(getEnergyHappinessModifier(1.5)).toBe(0);
    expect(getEnergyHappinessModifier(1.0)).toBe(0);
    expect(getEnergyHappinessModifier(1.25)).toBe(0);
  });

  it('returns -5 when ratio is 0.7 to 1.0', () => {
    expect(getEnergyHappinessModifier(0.99)).toBe(-5);
    expect(getEnergyHappinessModifier(0.7)).toBe(-5);
  });

  it('returns -15 when ratio is 0.3 to 0.7', () => {
    expect(getEnergyHappinessModifier(0.69)).toBe(-15);
    expect(getEnergyHappinessModifier(0.3)).toBe(-15);
    expect(getEnergyHappinessModifier(0.5)).toBe(-15);
  });

  it('returns -25 when ratio < 0.3', () => {
    expect(getEnergyHappinessModifier(0.29)).toBe(-25);
    expect(getEnergyHappinessModifier(0.0)).toBe(-25);
    expect(getEnergyHappinessModifier(0.1)).toBe(-25);
  });
});

// ---------------------------------------------------------------------------
// getBuildingEfficiency
// ---------------------------------------------------------------------------

describe('getBuildingEfficiency', () => {
  it('returns 1.0 when energy ratio is >= 1.0', () => {
    const building = makeBuilding('factory');
    expect(getBuildingEfficiency(building, 1.0)).toBe(1.0);
    expect(getBuildingEfficiency(building, 1.5)).toBe(1.0);
  });

  it('returns 0.0 when energy ratio is < 0.3', () => {
    const building = makeBuilding('factory');
    expect(getBuildingEfficiency(building, 0.29)).toBe(0.0);
    expect(getBuildingEfficiency(building, 0.0)).toBe(0.0);
  });

  it('scales linearly between 0.3 and 1.0 ratio', () => {
    const building = makeBuilding('factory');
    // At 0.3: 0% efficiency
    expect(getBuildingEfficiency(building, 0.3)).toBeCloseTo(0.0);
    // At 0.65: (0.65 - 0.3) / 0.7 = 0.5
    expect(getBuildingEfficiency(building, 0.65)).toBeCloseTo(0.5);
    // At 0.79: (0.79 - 0.3) / 0.7 = 0.7
    expect(getBuildingEfficiency(building, 0.79)).toBeCloseTo(0.7);
  });

  it('always returns 1.0 for power-producing buildings', () => {
    const powerPlant = makeBuilding('power_plant');
    expect(getBuildingEfficiency(powerPlant, 0.1)).toBe(1.0);
    expect(getBuildingEfficiency(powerPlant, 0.0)).toBe(1.0);
  });

  it('always returns 1.0 for fusion reactors regardless of ratio', () => {
    const reactor = makeBuilding('fusion_reactor');
    expect(getBuildingEfficiency(reactor, 0.0)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// calculateStorageCapacity
// ---------------------------------------------------------------------------

describe('calculateStorageCapacity', () => {
  it('returns 50 for a single L1 energy storage', () => {
    const buildings = [makeBuilding('energy_storage', { level: 1 })];
    expect(calculateStorageCapacity(buildings)).toBe(50);
  });

  it('returns 150 for an L2 energy storage', () => {
    const buildings = [makeBuilding('energy_storage', { level: 2 })];
    expect(calculateStorageCapacity(buildings)).toBe(150);
  });

  it('returns 500 for an L3 energy storage', () => {
    const buildings = [makeBuilding('energy_storage', { level: 3 })];
    expect(calculateStorageCapacity(buildings)).toBe(500);
  });

  it('returns 1500 for an L4 energy storage', () => {
    const buildings = [makeBuilding('energy_storage', { level: 4 })];
    expect(calculateStorageCapacity(buildings)).toBe(1_500);
  });

  it('returns 5000 for an L5 energy storage', () => {
    const buildings = [makeBuilding('energy_storage', { level: 5 })];
    expect(calculateStorageCapacity(buildings)).toBe(5_000);
  });

  it('sums capacity from multiple storage buildings', () => {
    const buildings = [
      makeBuilding('energy_storage', { level: 1 }),
      makeBuilding('energy_storage', { level: 2 }),
    ];
    expect(calculateStorageCapacity(buildings)).toBe(200); // 50 + 150
  });

  it('ignores non-storage buildings', () => {
    const buildings = [
      makeBuilding('power_plant'),
      makeBuilding('energy_storage', { level: 1 }),
      makeBuilding('factory'),
    ];
    expect(calculateStorageCapacity(buildings)).toBe(50);
  });

  it('returns 0 when no storage buildings exist', () => {
    const buildings = [makeBuilding('factory')];
    expect(calculateStorageCapacity(buildings)).toBe(0);
  });
});
