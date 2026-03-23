/**
 * Waste engine — pure functions for planetary waste accumulation,
 * reduction, and overflow effects.
 *
 * All functions are side-effect-free and return new values rather than
 * mutating their inputs.
 *
 * Waste is a planetary stat that accumulates from buildings and population.
 * When waste exceeds capacity, escalating happiness and health penalties apply.
 */

import type { Building, BuildingType, PlanetType } from '../types/galaxy.js';
import type { PlanetWasteState } from '../types/waste.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Waste capacity by planet type (surface area factor x 100) */
const WASTE_CAPACITY_BY_PLANET_TYPE: Record<string, number> = {
  terran: 10_000,
  ocean: 7_000,
  desert: 6_000,
  toxic: 5_000,
  ice: 4_000,
  volcanic: 3_500,
  barren: 3_000,
  gas_giant: 0,
};

/** Waste produced per 10,000 population per tick */
const WASTE_PER_10K_POPULATION = 0.1;

/** Waste eliminated per tick by an incinerator (L1) */
const INCINERATOR_WASTE_ELIMINATION = 3.0;

/** Waste eliminated per tick by an atmosphere cleanser (L1) */
const CLEANSER_WASTE_ELIMINATION = 2.0;

/** Waste eliminated per tick by an orbital waste ejector (L1) */
const EJECTOR_WASTE_ELIMINATION = 5.0;

/** Recycling plant reduces gross waste by this percentage */
const RECYCLING_PERCENTAGE = 0.25;

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Returns the maximum waste capacity for a given planet type.
 *
 * @param planetType  The type of planet.
 * @param _planetSize Optional size modifier (reserved for future use).
 * @returns Maximum waste the planet can hold before overflow.
 */
export function calculateWasteCapacity(
  planetType: PlanetType,
  _planetSize?: number,
): number {
  return WASTE_CAPACITY_BY_PLANET_TYPE[planetType] ?? 0;
}

/**
 * Calculates the gross waste produced by all buildings and population on a
 * planet in a single tick.
 *
 * Uses the `wasteOutput` field from each building's definition. Buildings
 * whose type is not found in BUILDING_DEFINITIONS default to 0.2 waste/tick.
 *
 * @param buildings  Array of buildings present on the planet.
 * @param population Current population count.
 * @returns Gross waste produced per tick (before any reductions).
 */
export function calculateWasteProduction(
  buildings: Building[],
  population: number,
): number {
  let total = 0;

  for (const building of buildings) {
    const def = BUILDING_DEFINITIONS[building.type as BuildingType];
    const wasteRate = def?.wasteOutput ?? 0.2;
    total += wasteRate;
  }

  // Population waste: 0.1 per 10,000 population
  total += (population / 10_000) * WASTE_PER_10K_POPULATION;

  return total;
}

/**
 * Calculates the total waste removed per tick by waste-management buildings.
 *
 * - Recycling plants reduce a percentage (25%) of gross waste.
 * - Incinerators eliminate a fixed amount (3/tick).
 * - Atmosphere cleansers eliminate a fixed amount (2/tick).
 * - Orbital waste ejectors eliminate a fixed amount (5/tick).
 *
 * @param buildings       Array of buildings on the planet.
 * @param grossProduction Gross waste produced this tick (needed for recycling %).
 * @returns Total waste removed per tick.
 */
export function calculateWasteReduction(
  buildings: Building[],
  grossProduction: number,
): number {
  let fixedReduction = 0;
  let recyclingCount = 0;

  for (const building of buildings) {
    switch (building.type) {
      case 'recycling_plant':
        recyclingCount++;
        break;
      case 'waste_incinerator':
        fixedReduction += INCINERATOR_WASTE_ELIMINATION;
        break;
      case 'atmosphere_cleanser':
        fixedReduction += CLEANSER_WASTE_ELIMINATION;
        break;
      case 'orbital_waste_ejector':
        fixedReduction += EJECTOR_WASTE_ELIMINATION;
        break;
    }
  }

  // Each recycling plant reduces 25% of gross waste (stacking multiplicatively would
  // be complex; for now, each plant reduces 25% of gross independently, capped at 100%).
  const recyclingFraction = Math.min(recyclingCount * RECYCLING_PERCENTAGE, 1.0);
  const recyclingReduction = grossProduction * recyclingFraction;

  return recyclingReduction + fixedReduction;
}

/**
 * Advances the waste state by one tick, applying production and reduction,
 * and calculating overflow penalties.
 *
 * @param currentWaste    Current accumulated waste on the planet.
 * @param wasteCapacity   Maximum waste the planet can hold.
 * @param grossProduction Gross waste produced this tick.
 * @param reduction       Waste removed this tick.
 * @returns A complete PlanetWasteState for this tick.
 */
export function tickWaste(
  currentWaste: number,
  wasteCapacity: number,
  grossProduction: number,
  reduction: number,
): PlanetWasteState {
  const netWaste = grossProduction - reduction;
  const newWaste = Math.max(0, currentWaste + netWaste);
  const isOverflowing = newWaste > wasteCapacity;

  let wasteHappinessPenalty = 0;
  let wasteHealthPenalty = 0;

  if (isOverflowing && wasteCapacity > 0) {
    // Calculate how far over capacity we are as a percentage
    const overflowAmount = newWaste - wasteCapacity;
    const overflowPercent = (overflowAmount / wasteCapacity) * 100;

    // -1 happiness per 10% over capacity
    wasteHappinessPenalty = Math.floor(overflowPercent / 10);

    // -1 health per 20% over capacity
    wasteHealthPenalty = Math.floor(overflowPercent / 20);
  }

  return {
    currentWaste: newWaste,
    wasteCapacity,
    grossWastePerTick: grossProduction,
    wasteRemovedPerTick: reduction,
    netWastePerTick: netWaste,
    isOverflowing,
    wasteHappinessPenalty,
    wasteHealthPenalty,
  };
}
