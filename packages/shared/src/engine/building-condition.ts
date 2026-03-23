/**
 * Building condition engine — pure functions for building decay, repair,
 * and functionality checks.
 *
 * All functions are side-effect-free and return new values rather than
 * mutating their inputs.
 *
 * Condition is a 0–100% value that degrades when maintenance is unpaid.
 * Buildings become non-functional at 70% and unrepairable below 30%.
 */

import type { Building, BuildingType } from '../types/galaxy.js';
import type { BuildingDefinition } from '../constants/buildings.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Condition threshold at or below which a building stops producing. */
export const NON_FUNCTIONAL_THRESHOLD = 70;

/** Condition threshold below which a building cannot be repaired (must demolish + rebuild). */
export const UNREPAIRABLE_THRESHOLD = 30;

/** Default condition for a newly constructed building. */
export const DEFAULT_CONDITION = 100;

/**
 * Building decay categories and their decay rates.
 * Values represent ticks per 1% condition loss when maintenance is unpaid.
 */
export type DecayCategory =
  | 'heavy_industry'
  | 'infrastructure'
  | 'sensitive'
  | 'biological'
  | 'military'
  | 'power';

const DECAY_RATES: Record<DecayCategory, number> = {
  heavy_industry: 30,
  infrastructure: 20,
  sensitive: 15,
  biological: 10,
  military: 25,
  power: 20,
};

/** Maps building types to their decay category. */
const BUILDING_DECAY_CATEGORY: Record<string, DecayCategory> = {
  // Heavy industry
  factory: 'heavy_industry',
  shipyard: 'heavy_industry',
  mining_facility: 'heavy_industry',

  // Infrastructure
  spaceport: 'infrastructure',
  trade_hub: 'infrastructure',
  communications_hub: 'infrastructure',
  waste_dump: 'infrastructure',
  waste_incinerator: 'infrastructure',
  atmosphere_cleanser: 'infrastructure',
  orbital_waste_ejector: 'infrastructure',
  energy_storage: 'infrastructure',
  entertainment_complex: 'infrastructure',
  orbital_platform: 'infrastructure',
  terraforming_station: 'infrastructure',

  // Sensitive
  research_lab: 'sensitive',
  medical_bay: 'sensitive',
  advanced_medical_centre: 'sensitive',
  recycling_plant: 'sensitive',

  // Biological
  hydroponics_bay: 'biological',
  population_center: 'biological',

  // Military
  defense_grid: 'military',
  military_academy: 'military',

  // Power
  power_plant: 'power',
  fusion_reactor: 'power',
};

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Returns the number of ticks per 1% condition loss for a given building type.
 * Higher values mean slower decay (building is more durable).
 *
 * @param buildingType The type of building.
 * @returns Ticks per 1% condition loss.
 */
export function getDecayRate(buildingType: BuildingType): number {
  const category = BUILDING_DECAY_CATEGORY[buildingType];
  if (category) {
    return DECAY_RATES[category];
  }
  // Default to infrastructure rate for unknown types
  return DECAY_RATES.infrastructure;
}

/**
 * Advances a building's condition by one tick. If maintenance was not paid,
 * condition degrades according to the building's decay rate.
 *
 * The decay model works as follows: each building type has a "ticks per 1%
 * loss" rate. On each tick without maintenance, the building accumulates
 * 1/rate condition loss. This means a factory (rate 30) loses 1% every 30
 * ticks without maintenance.
 *
 * @param building       The building to update.
 * @param maintenancePaid Whether maintenance was paid this tick.
 * @param _buildingDef   The building definition (reserved for future use).
 * @returns New condition value (0–100).
 */
export function tickBuildingCondition(
  building: Building,
  maintenancePaid: boolean,
  _buildingDef?: BuildingDefinition,
): number {
  const currentCondition = building.condition ?? DEFAULT_CONDITION;

  if (maintenancePaid) {
    // Condition doesn't improve from maintenance — it just stops decaying
    return currentCondition;
  }

  const rate = getDecayRate(building.type);
  // Each tick without maintenance: lose 1/rate percent
  const conditionLoss = 1 / rate;
  const newCondition = Math.max(0, currentCondition - conditionLoss);

  return newCondition;
}

/**
 * Returns whether a building is functional (condition above the
 * non-functional threshold).
 *
 * @param condition The building's current condition (0–100).
 * @returns True if the building can still produce output.
 */
export function isBuildingFunctional(condition: number): boolean {
  return condition > NON_FUNCTIONAL_THRESHOLD;
}

/**
 * Returns whether a building can be repaired. Buildings below 30%
 * condition must be demolished and rebuilt.
 *
 * @param condition The building's current condition (0–100).
 * @returns True if the building can be repaired in-place.
 */
export function isBuildingRepairable(condition: number): boolean {
  return condition >= UNREPAIRABLE_THRESHOLD;
}

/**
 * Calculates the cost in credits and time (ticks) to repair a building
 * from its current condition to a target condition.
 *
 * Repair cost is proportional to the building's original construction cost
 * and the percentage of condition to restore.
 *
 * @param buildingDef      The building definition.
 * @param currentCondition Current condition (0–100).
 * @param targetCondition  Target condition (0–100, defaults to 100).
 * @returns Object with credits cost and repair time in ticks.
 */
export function calculateRepairCost(
  buildingDef: BuildingDefinition,
  currentCondition: number,
  targetCondition: number = 100,
): { credits: number; ticks: number } {
  const conditionDelta = Math.max(0, targetCondition - currentCondition);
  const fraction = conditionDelta / 100;

  // Repair cost is 50% of original build cost per 100% restoration
  const baseCreditCost = buildingDef.baseCost.credits ?? 0;
  const credits = Math.ceil(baseCreditCost * 0.5 * fraction);

  // Repair time is 50% of original build time per 100% restoration
  const ticks = Math.ceil(buildingDef.buildTime * 0.5 * fraction);

  return { credits, ticks };
}
