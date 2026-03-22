/**
 * Economy engine — pure functions for resource production and consumption.
 *
 * All functions are side-effect free. Game state must be updated by the caller
 * using the values returned from these functions.
 *
 * Energy deficit effects (applied when empire energy stockpile = 0):
 *   - Buildings that consume energy operate at 50 % efficiency.
 *   - Research speed is halved.
 *   - Ship production is slowed (50 % of normal construction rate).
 *
 * Food / organics consumption:
 *   - Population consumes 1 organic unit per 1 000 population per tick.
 *   - If organics reach zero, population declines (starvation).
 */

import type { Planet } from '../types/galaxy.js';
import type { Empire, Species } from '../types/species.js';
import type {
  EmpireResources,
  ResourceProduction,
  PlanetProduction,
  BuildingOutput,
} from '../types/resources.js';
import {
  BASE_TAX_RATE,
  PLANET_TYPE_RESOURCE_BONUSES,
  BUILDING_LEVEL_MULTIPLIER,
  FLEET_UPKEEP_PER_SHIP,
  BUILDING_MAINTENANCE_BASE,
} from '../constants/resources.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a zeroed ResourceProduction object. */
function zeroProduction(): ResourceProduction {
  return {
    credits: 0,
    minerals: 0,
    rareElements: 0,
    energy: 0,
    organics: 0,
    exoticMaterials: 0,
    faith: 0,
    researchPoints: 0,
  };
}

/**
 * Add a Partial<ResourceProduction> into an existing full ResourceProduction in-place.
 * Returns the mutated accumulator for chaining.
 */
function addPartial(acc: ResourceProduction, partial: Partial<ResourceProduction>): ResourceProduction {
  if (partial.credits !== undefined) acc.credits += partial.credits;
  if (partial.minerals !== undefined) acc.minerals += partial.minerals;
  if (partial.rareElements !== undefined) acc.rareElements += partial.rareElements;
  if (partial.energy !== undefined) acc.energy += partial.energy;
  if (partial.organics !== undefined) acc.organics += partial.organics;
  if (partial.exoticMaterials !== undefined) acc.exoticMaterials += partial.exoticMaterials;
  if (partial.faith !== undefined) acc.faith += partial.faith;
  if (partial.researchPoints !== undefined) acc.researchPoints += partial.researchPoints;
  return acc;
}

/**
 * Scale a Partial<ResourceProduction> by a numeric factor.
 * Produces a new Partial with each defined value multiplied by factor.
 */
function scalePartial(
  partial: Partial<ResourceProduction>,
  factor: number,
): Partial<ResourceProduction> {
  const result: Partial<ResourceProduction> = {};
  for (const key of Object.keys(partial) as Array<keyof ResourceProduction>) {
    const value = partial[key];
    if (value !== undefined) {
      result[key] = value * factor;
    }
  }
  return result;
}

/**
 * Compute the output multiplier for a building at the given level.
 * Level 1 → 1.0, Level 2 → BUILDING_LEVEL_MULTIPLIER, Level 3 → BUILDING_LEVEL_MULTIPLIER^2, …
 */
function levelMultiplier(level: number): number {
  return Math.pow(BUILDING_LEVEL_MULTIPLIER, level - 1);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the per-tick resource production for a single planet.
 *
 * Contributions:
 *  - Base tax income from population and species economy trait
 *  - Planet-type resource bonuses
 *  - Output from each building, scaled by level
 *  - Species trait bonuses applied to relevant building types
 */
export function calculatePlanetProduction(
  planet: Planet,
  species: Species,
  _empire: Empire,
): PlanetProduction {
  const production = zeroProduction();
  const buildingOutputs: BuildingOutput[] = [];

  // --- Tax income ---
  // Base formula: population * BASE_TAX_RATE * (economy_trait / 5)
  // Trait 5 = normal rate, 10 = double, 1 = fifth.
  const economyFactor = species.traits.economy / 5;
  const taxIncome = planet.currentPopulation * BASE_TAX_RATE * economyFactor;
  production.credits += taxIncome;

  // --- Planet type bonuses ---
  const typeBonuses = PLANET_TYPE_RESOURCE_BONUSES[planet.type] ?? {};
  addPartial(production, typeBonuses);

  // --- Building output ---
  for (const building of planet.buildings) {
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def) continue;

    // Start from the building's base production.
    let scaledOutput: Partial<ResourceProduction> = scalePartial(
      def.baseProduction,
      levelMultiplier(building.level),
    );

    // Apply species trait bonuses on top of the level scaling.
    switch (building.type) {
      case 'research_lab': {
        // Research trait (1-10): trait 5 = normal, linearly scaled
        const researchFactor = species.traits.research / 5;
        scaledOutput = scalePartial(scaledOutput, researchFactor);
        break;
      }
      case 'factory': {
        // Construction trait (1-10): scales mineral output
        const constructionFactor = species.traits.construction / 5;
        scaledOutput = scalePartial(scaledOutput, constructionFactor);
        break;
      }
      case 'mining_facility': {
        // Natural resources rating (0-100) scales mining output.
        // Rating 50 = normal, rating 100 = double, rating 0 = zero.
        const resourceFactor = planet.naturalResources / 50;
        scaledOutput = scalePartial(scaledOutput, resourceFactor);
        break;
      }
      case 'trade_hub':
      case 'spaceport': {
        // Economy trait scales credit-producing buildings.
        const tradeFactor = species.traits.economy / 5;
        scaledOutput = scalePartial(scaledOutput, tradeFactor);
        break;
      }
      // shipyard, defense_grid, population_center, temple — no trait bonus applied
      default:
        break;
    }

    addPartial(production, scaledOutput);

    buildingOutputs.push({
      buildingId: building.id,
      buildingType: building.type,
      resources: scaledOutput,
    });
  }

  return {
    planetId: planet.id,
    production,
    population: planet.currentPopulation,
    taxIncome,
    buildingOutputs,
  };
}

/**
 * Aggregate production across all empire-owned planets.
 *
 * @param planets - All planets belonging to the empire (pre-filtered by ownerId).
 */
export function calculateEmpireProduction(
  planets: Planet[],
  species: Species,
  empire: Empire,
): { total: ResourceProduction; perPlanet: PlanetProduction[] } {
  const total = zeroProduction();
  const perPlanet: PlanetProduction[] = [];

  for (const planet of planets) {
    const planetProduction = calculatePlanetProduction(planet, species, empire);
    perPlanet.push(planetProduction);
    addPartial(total, planetProduction.production);
  }

  return { total, perPlanet };
}

/**
 * Calculate the empire's per-tick upkeep costs.
 *
 * Ships consume credits and energy. Buildings consume credits (flat maintenance).
 * Returned values are negative, representing resource drain.
 *
 * @param _empire      - Empire (reserved for future trait-based upkeep modifiers).
 * @param fleetCount   - Total number of individual ships (not fleets).
 * @param buildingCount - Total number of buildings across all planets.
 */
export function calculateUpkeep(
  _empire: Empire,
  fleetCount: number,
  buildingCount: number,
): ResourceProduction {
  const upkeep = zeroProduction();

  // Ship upkeep
  const shipUpkeepCredits = (FLEET_UPKEEP_PER_SHIP.credits ?? 0) * fleetCount;
  const shipUpkeepEnergy = (FLEET_UPKEEP_PER_SHIP.energy ?? 0) * fleetCount;
  upkeep.credits -= shipUpkeepCredits;
  upkeep.energy -= shipUpkeepEnergy;

  // Building maintenance (flat per building, regardless of type or level)
  const buildingMaintenanceCredits = (BUILDING_MAINTENANCE_BASE.credits ?? 0) * buildingCount;
  upkeep.credits -= buildingMaintenanceCredits;

  return upkeep;
}

/**
 * Apply one resource tick: add production, add upkeep (which is already negative),
 * then clamp all resources to a minimum of zero.
 */
export function applyResourceTick(
  resources: EmpireResources,
  production: ResourceProduction,
  upkeep: ResourceProduction,
): EmpireResources {
  return {
    credits: Math.max(0, resources.credits + production.credits + upkeep.credits),
    minerals: Math.max(0, resources.minerals + production.minerals + upkeep.minerals),
    rareElements: Math.max(0, resources.rareElements + production.rareElements + upkeep.rareElements),
    energy: Math.max(0, resources.energy + production.energy + upkeep.energy),
    organics: Math.max(0, resources.organics + production.organics + upkeep.organics),
    exoticMaterials: Math.max(
      0,
      resources.exoticMaterials + production.exoticMaterials + upkeep.exoticMaterials,
    ),
    faith: Math.max(0, resources.faith + production.faith + upkeep.faith),
    researchPoints: Math.max(
      0,
      resources.researchPoints + production.researchPoints + upkeep.researchPoints,
    ),
  };
}

/**
 * Return true if the empire has enough of every resource listed in cost.
 */
export function canAfford(
  resources: EmpireResources,
  cost: Partial<EmpireResources>,
): boolean {
  for (const key of Object.keys(cost) as Array<keyof EmpireResources>) {
    const required = cost[key] ?? 0;
    if (resources[key] < required) {
      return false;
    }
  }
  return true;
}

/**
 * Deduct cost from resources. Does NOT check affordability — call canAfford first.
 * Values are clamped to 0 to guard against floating-point edge cases.
 */
export function subtractResources(
  resources: EmpireResources,
  cost: Partial<EmpireResources>,
): EmpireResources {
  return {
    credits: Math.max(0, resources.credits - (cost.credits ?? 0)),
    minerals: Math.max(0, resources.minerals - (cost.minerals ?? 0)),
    rareElements: Math.max(0, resources.rareElements - (cost.rareElements ?? 0)),
    energy: Math.max(0, resources.energy - (cost.energy ?? 0)),
    organics: Math.max(0, resources.organics - (cost.organics ?? 0)),
    exoticMaterials: Math.max(0, resources.exoticMaterials - (cost.exoticMaterials ?? 0)),
    faith: Math.max(0, resources.faith - (cost.faith ?? 0)),
    researchPoints: Math.max(0, resources.researchPoints - (cost.researchPoints ?? 0)),
  };
}

// ---------------------------------------------------------------------------
// Energy deficit effects
// ---------------------------------------------------------------------------

/**
 * The set of building types whose energy-consuming operation is disrupted by an
 * energy deficit.  Only buildings that list a negative energy value in their
 * baseProduction / maintenanceCost are meaningful to include here, but we
 * apply the penalty to ALL non-credit production when the empire has no energy
 * because lights-off affects everyone.
 *
 * The actual production scaling is handled by `applyEnergyDeficitPenalties`.
 */

/** Result describing the energy status for an empire this tick. */
export interface EnergyStatus {
  /** True when the empire's energy stockpile is zero (or would go negative). */
  isDeficit: boolean;
  /**
   * Production multiplier to apply to non-credit, non-energy resource production
   * (minerals, rareElements, organics, exoticMaterials, faith, researchPoints).
   * 1.0 = normal; 0.5 = deficit penalty.
   */
  productionMultiplier: number;
  /**
   * Research speed multiplier. 1.0 = normal; 0.5 = halved during energy deficit.
   * The game loop must apply this to the researchPoints value passed to
   * `processResearchTick`.
   */
  researchMultiplier: number;
  /**
   * Ship construction rate multiplier. 1.0 = normal; 0.5 = slowed during
   * energy deficit.  The game loop must apply this to the constructionRate
   * passed to `processConstructionQueue` for ship/building queues.
   */
  constructionMultiplier: number;
  /**
   * Human-readable tooltip message for the UI TopBar warning indicator.
   * Empty string when there is no deficit.
   */
  warningTooltip: string;
}

/**
 * Determine the energy status for an empire given its current resource stockpile
 * *after* this tick's production and upkeep have been applied.
 *
 * The caller should pass the resources value that has already gone through
 * `applyResourceTick` so that the clamp-to-zero behaviour is reflected.
 */
export function getEnergyStatus(resources: EmpireResources): EnergyStatus {
  const isDeficit = resources.energy <= 0;

  if (!isDeficit) {
    return {
      isDeficit: false,
      productionMultiplier: 1.0,
      researchMultiplier: 1.0,
      constructionMultiplier: 1.0,
      warningTooltip: '',
    };
  }

  return {
    isDeficit: true,
    productionMultiplier: 0.5,
    researchMultiplier: 0.5,
    constructionMultiplier: 0.5,
    warningTooltip:
      'Energy deficit — buildings are running at 50 % capacity, research is halved, ' +
      'and ship construction is slowed. Build Power Plants or Fusion Reactors to resolve.',
  };
}

// ---------------------------------------------------------------------------
// Food / organics consumption
// ---------------------------------------------------------------------------

/** Population units per organic consumed per tick. */
export const ORGANICS_PER_POPULATION = 5_000;

/**
 * Calculate how many organics an empire's total population consumes per tick.
 *
 * Formula: floor(totalPopulation / ORGANICS_PER_POPULATION)
 * Minimum 0 (an empire with < 1 000 population consumes 0).
 */
export function calculateOrganicsConsumption(totalPopulation: number): number {
  return Math.floor(Math.max(0, totalPopulation) / ORGANICS_PER_POPULATION);
}

/** Result of applying the food-consumption step to empire resources. */
export interface FoodConsumptionResult {
  /** Updated resource stockpile after organics have been deducted. */
  resources: EmpireResources;
  /**
   * True when the empire ran out of organics (starvation this tick).
   * The caller is responsible for applying population-decline penalties.
   */
  isStarving: boolean;
  /** Organics consumed this tick (may be 0). */
  consumed: number;
}

/**
 * Deduct organics consumption from the empire's stockpile and report whether
 * the empire is starving.
 *
 * This must be called *after* `applyResourceTick` so that this tick's food
 * production is already in the stockpile before consumption is deducted.
 *
 * @param resources       Current empire resources (post-production tick).
 * @param totalPopulation Sum of `currentPopulation` across all empire-owned planets.
 */
export function applyFoodConsumption(
  resources: EmpireResources,
  totalPopulation: number,
): FoodConsumptionResult {
  const consumed = calculateOrganicsConsumption(totalPopulation);

  if (consumed === 0) {
    return { resources, isStarving: false, consumed: 0 };
  }

  const remaining = resources.organics - consumed;
  const isStarving = remaining < 0;

  return {
    resources: {
      ...resources,
      organics: Math.max(0, remaining),
    },
    isStarving,
    consumed,
  };
}
