/**
 * Energy flow engine — pure functions for planetary energy production,
 * demand, storage, and balance calculations.
 *
 * All functions are side-effect-free and return new values rather than
 * mutating their inputs.
 *
 * Energy is a flow, not a stockpile: produced and consumed each tick,
 * with surplus wasted unless energy storage buildings are present.
 */

import type { Building, BuildingType } from '../types/galaxy.js';
import type { PlanetEnergyState } from '../types/waste.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Building types that produce energy (their baseProduction.energy > 0) */
const ENERGY_PRODUCING_TYPES = new Set<string>([
  'power_plant',
  'fusion_reactor',
  'orbital_platform',
  'recycling_plant',
]);

/** Energy storage capacity by level (L1 through L5) */
const STORAGE_CAPACITY_BY_LEVEL: Record<number, number> = {
  1: 50,
  2: 150,
  3: 500,
  4: 1_500,
  5: 5_000,
};

/** Minimum condition percentage for a building to produce energy */
const MIN_PRODUCING_CONDITION = 70;

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Calculates total energy production from all power-producing buildings.
 * Only counts buildings that are powered on and above 70% condition.
 *
 * Uses the `energy` field from each building's `baseProduction` in the
 * building definitions.
 *
 * @param buildings Array of buildings on the planet.
 * @returns Total energy produced per tick.
 */
export function calculateEnergyProduction(buildings: Building[]): number {
  let total = 0;

  for (const building of buildings) {
    if (!ENERGY_PRODUCING_TYPES.has(building.type)) continue;

    // Skip buildings below 70% condition
    const condition = building.condition ?? 100;
    if (condition < MIN_PRODUCING_CONDITION) continue;

    const def = BUILDING_DEFINITIONS[building.type as BuildingType];
    const baseProduction = def?.baseProduction?.energy ?? 0;
    if (baseProduction > 0) {
      total += baseProduction;
    }
  }

  return total;
}

/**
 * Calculates total energy demand from all non-power-producing buildings,
 * excluding those in the disabled list.
 *
 * Uses the `energyConsumption` field from each building's definition.
 *
 * @param buildings   Array of buildings on the planet.
 * @param disabledIds Building IDs that are powered off by player choice.
 * @returns Total energy demanded per tick.
 */
export function calculateEnergyDemand(
  buildings: Building[],
  disabledIds: string[] = [],
): number {
  const disabledSet = new Set(disabledIds);
  let total = 0;

  for (const building of buildings) {
    // Skip disabled buildings
    if (disabledSet.has(building.id)) continue;

    // Skip power-producing buildings (they don't consume from the grid)
    if (ENERGY_PRODUCING_TYPES.has(building.type)) continue;

    const def = BUILDING_DEFINITIONS[building.type as BuildingType];
    const consumption = def?.energyConsumption ?? 0;
    total += consumption;
  }

  return total;
}

/**
 * Calculates the full energy balance for a planet, including storage
 * interactions and happiness effects.
 *
 * If production > demand, excess goes to storage (up to capacity), and
 * the rest is wasted. If demand > production, stored energy is drawn
 * first, then a brownout occurs.
 *
 * @param production      Total energy produced this tick.
 * @param demand          Total energy demanded this tick.
 * @param storedEnergy    Current energy in storage.
 * @param storageCapacity Maximum storage capacity.
 * @param disabledIds     Building IDs powered off by player choice.
 * @returns A complete PlanetEnergyState.
 */
export function calculateEnergyBalance(
  production: number,
  demand: number,
  storedEnergy: number,
  storageCapacity: number,
  disabledIds: string[] = [],
): PlanetEnergyState {
  let newStoredEnergy = storedEnergy;
  const balance = production - demand;

  // Effective supply: production + whatever we can draw from storage
  let effectiveSupply = production;

  if (balance >= 0) {
    // Surplus: store excess up to capacity
    const excess = balance;
    const spaceAvailable = storageCapacity - newStoredEnergy;
    const toStore = Math.min(excess, spaceAvailable);
    newStoredEnergy += toStore;
  } else {
    // Deficit: draw from storage
    const deficit = -balance;
    const drawFromStorage = Math.min(deficit, newStoredEnergy);
    newStoredEnergy -= drawFromStorage;
    effectiveSupply += drawFromStorage;
  }

  // Calculate ratio based on effective supply vs demand
  const ratio = demand > 0 ? effectiveSupply / demand : (production > 0 ? Infinity : 1.0);
  const clampedRatio = Math.min(ratio, 10); // Cap for sanity

  const energyHappinessModifier = getEnergyHappinessModifier(clampedRatio);

  return {
    totalProduction: production,
    totalDemand: demand,
    balance,
    ratio: clampedRatio,
    disabledBuildingIds: [...disabledIds],
    energyHappinessModifier,
    storedEnergy: newStoredEnergy,
    storageCapacity,
  };
}

/**
 * Returns the happiness modifier based on the energy production-to-demand ratio.
 *
 * - > 1.5 ratio: +5 happiness (abundant energy)
 * - 1.0–1.5: 0 (balanced)
 * - 0.7–1.0: -5 (tight supply)
 * - 0.3–0.7: -15 (shortage)
 * - < 0.3: -25 (critical)
 *
 * @param ratio Production-to-demand ratio.
 * @returns Happiness modifier (positive = bonus, negative = penalty).
 */
export function getEnergyHappinessModifier(ratio: number): number {
  if (ratio > 1.5) return 5;
  if (ratio >= 1.0) return 0;
  if (ratio >= 0.7) return -5;
  if (ratio >= 0.3) return -15;
  return -25;
}

/**
 * Returns the effective efficiency of a building given the current energy ratio.
 *
 * - Below 30% energy ratio: building produces nothing (0% efficiency).
 * - Between 30% and 100%: output scales linearly from 0% to 100%.
 * - At or above 100%: full efficiency.
 *
 * @param building    The building to evaluate.
 * @param energyRatio Current energy production-to-demand ratio.
 * @returns Efficiency multiplier between 0.0 and 1.0.
 */
export function getBuildingEfficiency(
  building: Building,
  energyRatio: number,
): number {
  // Power producers always run at full efficiency
  if (ENERGY_PRODUCING_TYPES.has(building.type)) return 1.0;

  if (energyRatio >= 1.0) return 1.0;
  if (energyRatio < 0.3) return 0.0;

  // Linear interpolation from 0% at ratio=0.3 to 100% at ratio=1.0
  return (energyRatio - 0.3) / 0.7;
}

/**
 * Calculates the total energy storage capacity from all energy storage
 * buildings on a planet.
 *
 * @param buildings Array of buildings on the planet.
 * @returns Total storage capacity.
 */
export function calculateStorageCapacity(buildings: Building[]): number {
  let total = 0;
  for (const building of buildings) {
    if (building.type === 'energy_storage') {
      const level = building.level ?? 1;
      total += STORAGE_CAPACITY_BY_LEVEL[level] ?? STORAGE_CAPACITY_BY_LEVEL[1]!;
    }
  }
  return total;
}
