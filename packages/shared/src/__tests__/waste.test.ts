import { describe, it, expect } from 'vitest';
import {
  calculateWasteCapacity,
  calculateWasteProduction,
  calculateWasteReduction,
  tickWaste,
} from '../engine/waste.js';
import type { Building, PlanetType } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeBuilding(
  type: Building['type'],
  overrides: Partial<Building> = {},
): Building {
  return {
    id: `building-${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    level: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateWasteCapacity
// ---------------------------------------------------------------------------

describe('calculateWasteCapacity', () => {
  it('returns 10000 for terran worlds', () => {
    expect(calculateWasteCapacity('terran')).toBe(10_000);
  });

  it('returns 7000 for ocean worlds', () => {
    expect(calculateWasteCapacity('ocean')).toBe(7_000);
  });

  it('returns 6000 for desert worlds', () => {
    expect(calculateWasteCapacity('desert')).toBe(6_000);
  });

  it('returns 5000 for toxic worlds', () => {
    expect(calculateWasteCapacity('toxic')).toBe(5_000);
  });

  it('returns 4000 for ice worlds', () => {
    expect(calculateWasteCapacity('ice')).toBe(4_000);
  });

  it('returns 3500 for volcanic worlds', () => {
    expect(calculateWasteCapacity('volcanic')).toBe(3_500);
  });

  it('returns 3000 for barren worlds', () => {
    expect(calculateWasteCapacity('barren')).toBe(3_000);
  });

  it('returns 0 for gas giants', () => {
    expect(calculateWasteCapacity('gas_giant')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateWasteProduction
// ---------------------------------------------------------------------------

describe('calculateWasteProduction', () => {
  it('returns 3.0 for a single mining facility', () => {
    const buildings = [makeBuilding('mining_facility')];
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(3.0);
  });

  it('returns 2.0 for a single factory', () => {
    const buildings = [makeBuilding('factory')];
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(2.0);
  });

  it('returns 1.5 for a single power plant', () => {
    const buildings = [makeBuilding('power_plant')];
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(1.5);
  });

  it('returns 0.5 for a population centre', () => {
    const buildings = [makeBuilding('population_center')];
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(0.5);
  });

  it('returns 1.0 for a shipyard', () => {
    const buildings = [makeBuilding('shipyard')];
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(1.0);
  });

  it('returns 0.5 for a spaceport', () => {
    const buildings = [makeBuilding('spaceport')];
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(0.5);
  });

  it('returns 0.2 for a building with no explicit waste', () => {
    const buildings = [makeBuilding('research_lab')];
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(0.2);
  });

  it('sums waste from multiple buildings', () => {
    const buildings = [
      makeBuilding('mining_facility'),
      makeBuilding('factory'),
      makeBuilding('power_plant'),
    ];
    // 3.0 + 2.0 + 1.5 = 6.5
    expect(calculateWasteProduction(buildings, 0)).toBeCloseTo(6.5);
  });

  it('adds population waste (0.1 per 10000 population)', () => {
    const buildings: Building[] = [];
    // 100,000 pop = 10 * 0.1 = 1.0
    expect(calculateWasteProduction(buildings, 100_000)).toBeCloseTo(1.0);
  });

  it('combines building and population waste', () => {
    const buildings = [makeBuilding('factory')];
    // Factory 2.0 + 50,000 pop (5 * 0.1 = 0.5) = 2.5
    expect(calculateWasteProduction(buildings, 50_000)).toBeCloseTo(2.5);
  });

  it('returns 0 with no buildings and no population', () => {
    expect(calculateWasteProduction([], 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateWasteReduction
// ---------------------------------------------------------------------------

describe('calculateWasteReduction', () => {
  it('recycling plant removes 25% of gross waste', () => {
    const buildings = [makeBuilding('recycling_plant')];
    const gross = 10.0;
    expect(calculateWasteReduction(buildings, gross)).toBeCloseTo(2.5);
  });

  it('two recycling plants remove 50% of gross waste', () => {
    const buildings = [
      makeBuilding('recycling_plant'),
      makeBuilding('recycling_plant'),
    ];
    const gross = 10.0;
    expect(calculateWasteReduction(buildings, gross)).toBeCloseTo(5.0);
  });

  it('four recycling plants cap at 100% reduction', () => {
    const buildings = Array.from({ length: 4 }, () =>
      makeBuilding('recycling_plant'),
    );
    const gross = 10.0;
    // 4 * 25% = 100%
    expect(calculateWasteReduction(buildings, gross)).toBeCloseTo(10.0);
  });

  it('five recycling plants still cap at 100% of gross', () => {
    const buildings = Array.from({ length: 5 }, () =>
      makeBuilding('recycling_plant'),
    );
    const gross = 10.0;
    // Capped at 100%: recycling removes 10.0, no fixed reduction
    expect(calculateWasteReduction(buildings, gross)).toBeCloseTo(10.0);
  });

  it('incinerator eliminates 3 waste per tick', () => {
    const buildings = [makeBuilding('waste_incinerator')];
    expect(calculateWasteReduction(buildings, 0)).toBeCloseTo(3.0);
  });

  it('atmosphere cleanser eliminates 2 waste per tick', () => {
    const buildings = [makeBuilding('atmosphere_cleanser')];
    expect(calculateWasteReduction(buildings, 0)).toBeCloseTo(2.0);
  });

  it('orbital waste ejector eliminates 5 waste per tick', () => {
    const buildings = [makeBuilding('orbital_waste_ejector')];
    expect(calculateWasteReduction(buildings, 0)).toBeCloseTo(5.0);
  });

  it('combines recycling percentage with fixed reductions', () => {
    const buildings = [
      makeBuilding('recycling_plant'),
      makeBuilding('waste_incinerator'),
      makeBuilding('atmosphere_cleanser'),
    ];
    const gross = 20.0;
    // Recycling: 25% * 20 = 5.0
    // Incinerator: 3.0
    // Cleanser: 2.0
    // Total: 10.0
    expect(calculateWasteReduction(buildings, gross)).toBeCloseTo(10.0);
  });

  it('returns 0 when no waste management buildings exist', () => {
    const buildings = [makeBuilding('factory')];
    expect(calculateWasteReduction(buildings, 10.0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tickWaste
// ---------------------------------------------------------------------------

describe('tickWaste', () => {
  it('accumulates net waste when production exceeds reduction', () => {
    const state = tickWaste(100, 10_000, 5.0, 2.0);
    expect(state.currentWaste).toBeCloseTo(103);
    expect(state.netWastePerTick).toBeCloseTo(3.0);
  });

  it('reduces waste when reduction exceeds production', () => {
    const state = tickWaste(100, 10_000, 2.0, 5.0);
    expect(state.currentWaste).toBeCloseTo(97);
    expect(state.netWastePerTick).toBeCloseTo(-3.0);
  });

  it('does not go below zero waste', () => {
    const state = tickWaste(2, 10_000, 0, 10.0);
    expect(state.currentWaste).toBe(0);
  });

  it('is not overflowing when under capacity', () => {
    const state = tickWaste(5_000, 10_000, 1.0, 0);
    expect(state.isOverflowing).toBe(false);
    expect(state.wasteHappinessPenalty).toBe(0);
    expect(state.wasteHealthPenalty).toBe(0);
  });

  it('is overflowing when waste exceeds capacity', () => {
    const state = tickWaste(10_000, 10_000, 100, 0);
    expect(state.isOverflowing).toBe(true);
  });

  it('applies -1 happiness per 10% over capacity', () => {
    // 11,000 waste on 10,000 capacity = 10% over = -1 happiness
    const state = tickWaste(10_500, 10_000, 500, 0);
    // New waste = 11,000, overflow = 1,000 = 10%
    expect(state.wasteHappinessPenalty).toBe(1);
  });

  it('applies -1 health per 20% over capacity', () => {
    // 12,000 waste on 10,000 capacity = 20% over = -1 health
    const state = tickWaste(11_500, 10_000, 500, 0);
    // New waste = 12,000, overflow = 2,000 = 20%
    expect(state.wasteHealthPenalty).toBe(1);
  });

  it('applies escalating penalties at high overflow', () => {
    // 15,000 waste on 10,000 capacity = 50% over
    const state = tickWaste(15_000, 10_000, 0, 0);
    // 50% over => -5 happiness, -2 health
    expect(state.wasteHappinessPenalty).toBe(5);
    expect(state.wasteHealthPenalty).toBe(2);
  });

  it('preserves waste capacity and gross production in output', () => {
    const state = tickWaste(100, 7_000, 8.5, 3.0);
    expect(state.wasteCapacity).toBe(7_000);
    expect(state.grossWastePerTick).toBeCloseTo(8.5);
    expect(state.wasteRemovedPerTick).toBeCloseTo(3.0);
  });

  it('returns no penalty when waste equals capacity exactly', () => {
    const state = tickWaste(10_000, 10_000, 0, 0);
    expect(state.isOverflowing).toBe(false);
    expect(state.wasteHappinessPenalty).toBe(0);
    expect(state.wasteHealthPenalty).toBe(0);
  });

  it('handles zero capacity (gas giant) without crashing', () => {
    const state = tickWaste(0, 0, 0, 0);
    expect(state.currentWaste).toBe(0);
    expect(state.isOverflowing).toBe(false);
  });
});
