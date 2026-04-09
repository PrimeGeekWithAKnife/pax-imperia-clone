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
 *   - Population consumes 1 organic unit per 10 000 000 population per tick.
 *   - Planets naturally sustain population up to (fertility/100) * maxPopulation.
 *   - Below the natural ceiling consumption is fully covered; above it buildings
 *     must make up the difference.
 *   - Species reproduction trait modifies consumption (trait 5 = normal).
 *   - Special abilities modify consumption: synthetic/cybernetic/energy_form = 0,
 *     silicon_based/photosynthetic/dimensional = 0.5x,
 *     nanomorphic/subterranean = 0.75x, hive_mind = 0.8x.
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
import { GOVERNMENTS } from '../types/government.js';
import { ZONE_MAINTENANCE_MULTIPLIER } from './colony.js';
import { isBuildingFunctional } from './building-condition.js';

// ---------------------------------------------------------------------------
// Naval Capacity
// ---------------------------------------------------------------------------

/** Base naval capacity per colony + bonus from spaceports and military buildings. */
const BASE_NAVAL_CAP_PER_COLONY = 3;
const NAVAL_CAP_PER_SPACEPORT_LEVEL = 5;
const NAVAL_CAP_PER_MILITARY_BUILDING = 2;

const MILITARY_BUILDING_TYPES = new Set([
  'shipyard', 'planetary_defence', 'orbital_defence', 'military_academy',
  'fortress', 'ground_defence', 'missile_battery', 'starbase',
]);

export function calculateNavalCapacity(planets: Planet[]): number {
  let cap = 0;
  for (const planet of planets) {
    cap += BASE_NAVAL_CAP_PER_COLONY;
    for (const building of planet.buildings) {
      if (building.type === 'spaceport') {
        cap += NAVAL_CAP_PER_SPACEPORT_LEVEL * building.level;
      } else if (MILITARY_BUILDING_TYPES.has(building.type)) {
        cap += NAVAL_CAP_PER_MILITARY_BUILDING;
      }
    }
  }
  return Math.max(cap, 5); // Minimum 5 to avoid immediate over-cap at game start
}

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
 *  - Government tradeIncome multiplier applied to all credit production
 */
export function calculatePlanetProduction(
  planet: Planet,
  species: Species,
  empire: Empire,
): PlanetProduction {
  const production = zeroProduction();
  const buildingOutputs: BuildingOutput[] = [];

  // --- Government modifiers ---
  const govDef = GOVERNMENTS[empire.government];
  const govTradeMultiplier = govDef?.modifiers.tradeIncome ?? 1.0;

  // --- Tax income ---
  // Base formula: population * BASE_TAX_RATE * (economy_trait / 5)
  // Trait 5 = normal rate, 10 = double, 1 = fifth.
  // Government tradeIncome multiplier is also applied.
  const economyFactor = species.traits.economy / 5;
  const taxIncome = planet.currentPopulation * BASE_TAX_RATE * economyFactor * govTradeMultiplier;
  production.credits += taxIncome;

  // --- Planet type bonuses ---
  const typeBonuses = PLANET_TYPE_RESOURCE_BONUSES[planet.type] ?? {};
  addPartial(production, typeBonuses);

  // --- Natural food production from planet fertility ---
  // The land produces food based on its fertility and size, not based on
  // how many people are there. A fertile planet grows crops whether or not
  // anyone harvests them. Production is capped at the natural carrying
  // capacity: (fertility/100) × maxPop converted to organics units.
  //
  // Species metabolism doesn't change what the land produces — it changes
  // how much each person consumes. A 75% fertile, 8B planet always produces
  // 600 organics. Teranos (1.0x) can feed 6B, Sylvani (1.6x) can feed 3.75B.
  const naturalCap = getNaturalFoodCapacity(planet);
  const naturalFood = Math.ceil(naturalCap / ORGANICS_PER_POPULATION);
  production.organics += naturalFood;

  // --- Building output ---
  for (const building of planet.buildings) {
    const def = BUILDING_DEFINITIONS[building.type];
    if (!def) continue;

    // Non-functional buildings (condition <= 70%) produce nothing
    if (!isBuildingFunctional(building.condition ?? 100)) continue;

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
        // Economy trait scales credit-producing buildings; government tradeIncome
        // multiplier is applied on top.
        const tradeFactor = (species.traits.economy / 5) * govTradeMultiplier;
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

  // ── Special ability modifiers ─────────────────────────────────────────────
  const abilities = species.specialAbilities ?? [];

  // Photosynthetic: +30% organics production on planets with oxygen_nitrogen atmosphere
  if (abilities.includes('photosynthetic') && planet.atmosphere === 'oxygen_nitrogen') {
    production.organics *= 1.3;
  }

  // Devout: +2 faith per population_center building
  if (abilities.includes('devout')) {
    for (const building of planet.buildings) {
      if (building.type === 'population_center') {
        production.faith += 2;
      }
    }
  }

  // Cybernetic: +10% construction speed (mineral/factory output boost)
  if (abilities.includes('cybernetic')) {
    production.minerals *= 1.1;
  }

  // Dimensional: +10% exotic materials production
  if (abilities.includes('dimensional')) {
    production.exoticMaterials *= 1.1;
  }

  // Synthetic: +5% construction speed (mineral output boost)
  if (abilities.includes('synthetic')) {
    production.minerals *= 1.05;
  }

  // Nanomorphic: +5% construction speed (mineral output boost)
  if (abilities.includes('nanomorphic')) {
    production.minerals *= 1.05;
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

  // Apply tech-derived resource production multipliers (e.g. +50% energy from Dyson Collectors)
  const bonuses = empire.resourceBonuses;
  if (bonuses) {
    for (const [resource, multiplier] of Object.entries(bonuses)) {
      const key = resource as keyof ResourceProduction;
      if (key in total && multiplier !== 1) {
        total[key] = Math.round(total[key] * multiplier);
      }
    }
  }

  return { total, perPlanet };
}

/**
 * Calculate the empire's per-tick upkeep costs.
 *
 * Ships consume credits and energy. Buildings consume credits (flat maintenance).
 * Returned values are negative, representing resource drain.
 *
 * When `planets` are provided, building maintenance is zone-aware: orbital
 * buildings pay 3x and underground buildings pay 1x (surface = 1x baseline).
 *
 * @param _empire      - Empire (reserved for future trait-based upkeep modifiers).
 * @param fleetCount   - Total number of individual ships (not fleets).
 * @param buildingCount - Total number of buildings across all planets.
 * @param planets      - Optional list of empire-owned planets for zone-aware maintenance.
 * @param warWearinessMultiplier - War weariness fleet upkeep multiplier (default 1.0).
 */
export function calculateUpkeep(
  _empire: Empire,
  fleetCount: number,
  buildingCount: number,
  planets?: Planet[],
  warWearinessMultiplier = 1.0,
): ResourceProduction {
  const upkeep = zeroProduction();

  // Ship upkeep — scales when over naval capacity
  const navalCap = planets ? calculateNavalCapacity(planets) : fleetCount;
  const overCapRatio = fleetCount > navalCap ? fleetCount / navalCap : 1;
  const overCapPenalty = overCapRatio > 1 ? 1 + (overCapRatio - 1) * 2 : 1; // 2x penalty per 100% over cap
  const upkeepMultiplier = overCapPenalty * warWearinessMultiplier;
  const shipUpkeepCredits = (FLEET_UPKEEP_PER_SHIP.credits ?? 0) * fleetCount * upkeepMultiplier;
  const shipUpkeepEnergy = (FLEET_UPKEEP_PER_SHIP.energy ?? 0) * fleetCount * upkeepMultiplier;
  upkeep.credits -= shipUpkeepCredits;
  upkeep.energy -= shipUpkeepEnergy;

  // Building maintenance — zone-aware when planets are provided
  if (planets) {
    const baseCredits = BUILDING_MAINTENANCE_BASE.credits ?? 0;
    for (const planet of planets) {
      for (const building of planet.buildings) {
        const zone = building.slotZone ?? 'surface';
        const zoneMult = ZONE_MAINTENANCE_MULTIPLIER[zone] ?? 1;
        upkeep.credits -= baseCredits * zoneMult;
      }
    }
  } else {
    // Fallback: flat per building (no zone data available)
    const buildingMaintenanceCredits = (BUILDING_MAINTENANCE_BASE.credits ?? 0) * buildingCount;
    upkeep.credits -= buildingMaintenanceCredits;
  }

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

/** Population units per organic consumed per tick (1 food feeds 10 million). */
export const ORGANICS_PER_POPULATION = 10_000_000;

/**
 * Return the food-consumption modifier for a species based on its special
 * abilities.  Zero means the species consumes no organics at all.
 *
 * Abilities that eliminate food need:
 *   synthetic, cybernetic, energy_form → 0
 * Abilities that reduce food need:
 *   silicon_based, photosynthetic, dimensional → 0.5x
 *   nanomorphic, subterranean → 0.75x
 *   hive_mind → 0.8x
 *
 * When a species has multiple abilities the most beneficial (lowest) modifier
 * wins — they don't stack multiplicatively.
 */
export function getAbilityFoodModifier(
  specialAbilities?: string[],
): number {
  if (!specialAbilities || specialAbilities.length === 0) return 1;

  // Zero-consumption abilities — short-circuit
  const ZERO_FOOD: readonly string[] = ['synthetic', 'cybernetic', 'energy_form'];
  if (specialAbilities.some(a => ZERO_FOOD.includes(a))) return 0;

  let modifier = 1.0;
  if (specialAbilities.includes('silicon_based'))   modifier = Math.min(modifier, 0.5);
  if (specialAbilities.includes('photosynthetic'))  modifier = Math.min(modifier, 0.5);
  if (specialAbilities.includes('dimensional'))     modifier = Math.min(modifier, 0.5);
  if (specialAbilities.includes('nanomorphic'))     modifier = Math.min(modifier, 0.75);
  if (specialAbilities.includes('subterranean'))    modifier = Math.min(modifier, 0.75);
  if (specialAbilities.includes('hive_mind'))       modifier = Math.min(modifier, 0.8);

  return modifier;
}

/**
 * Calculate how many organics an empire's total population consumes per tick.
 *
 * Formula: ceil(totalPopulation / ORGANICS_PER_POPULATION) with a minimum of 1
 * for any non-zero population.  Two modifiers are applied:
 *   1. Reproduction trait:  trait / 5  (trait 5 = 1×, trait 10 = 2×).
 *   2. Ability modifier:   see {@link getAbilityFoodModifier}.
 *
 * @param totalPopulation Sum of currentPopulation across all empire-owned planets.
 * @param speciesReproductionTrait Species reproduction trait (1-10, default 5).
 * @param species Optional species object for checking special abilities.
 */
export function calculateOrganicsConsumption(
  totalPopulation: number,
  speciesReproductionTrait?: number,
  species?: { specialAbilities?: string[] },
): number {
  if (totalPopulation <= 0) return 0;

  const abilityMod = getAbilityFoodModifier(species?.specialAbilities);
  if (abilityMod === 0) return 0;

  const base = Math.max(1, Math.ceil(totalPopulation / ORGANICS_PER_POPULATION));
  const racialMod = speciesReproductionTrait ? (speciesReproductionTrait / 5) : 1;
  return Math.ceil(base * racialMod * abilityMod);
}

/**
 * Calculate how many people the planet's ecosystem can naturally sustain.
 * This is based on fertility and maxPopulation — it represents the carrying
 * capacity of the land before any artificial food infrastructure.
 */
export function getNaturalFoodCapacity(planet: { fertility?: number; maxPopulation: number }): number {
  const fertility = planet.fertility ?? 50;
  return Math.floor((fertility / 100) * planet.maxPopulation);
}

/**
 * Food shortage severity — a gradient, not a binary switch.
 *
 * - none:     Supply meets or exceeds demand. No effects.
 * - mild:     0-5% shortfall. Prices rise, slight unhappiness, no pop loss.
 * - moderate: 5-15% shortfall. Partial shortages, happiness penalty, growth slows.
 * - severe:   15-40% shortfall. Persistent shortages, slow population decline.
 * - critical: 40%+ shortfall. Actual starvation, significant population loss.
 * - famine:   No food at all. Catastrophic population loss.
 */
export type FoodShortageLevel = 'none' | 'mild' | 'moderate' | 'severe' | 'critical' | 'famine';

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
  /** Shortage severity level (gradient, not binary). */
  shortageLevel: FoodShortageLevel;
  /** Percentage shortfall (0 = fully fed, 100 = no food at all). */
  shortfallPercent: number;
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
 * @param speciesReproductionTrait Species reproduction trait (1-10, default 5).
 */
export function applyFoodConsumption(
  resources: EmpireResources,
  totalPopulation: number,
  speciesReproductionTrait?: number,
  species?: { specialAbilities?: string[] },
): FoodConsumptionResult {
  const consumed = calculateOrganicsConsumption(totalPopulation, speciesReproductionTrait, species);

  if (consumed === 0) {
    return { resources, isStarving: false, consumed: 0, shortageLevel: 'none', shortfallPercent: 0 };
  }

  const remaining = resources.organics - consumed;

  // Compute shortfall as a percentage of demand
  const shortfallPercent = remaining >= 0
    ? 0
    : Math.min(100, Math.round(Math.abs(remaining) / consumed * 100));

  // Map to severity level
  let shortageLevel: FoodShortageLevel;
  if (shortfallPercent === 0)       shortageLevel = 'none';
  else if (shortfallPercent <= 5)   shortageLevel = 'mild';
  else if (shortfallPercent <= 15)  shortageLevel = 'moderate';
  else if (shortfallPercent <= 40)  shortageLevel = 'severe';
  else if (shortfallPercent < 100)  shortageLevel = 'critical';
  else                              shortageLevel = 'famine';

  // Legacy compatibility: isStarving = true only at severe+ (actual pop loss)
  const isStarving = shortfallPercent > 15;

  return {
    resources: {
      ...resources,
      organics: Math.max(0, remaining),
    },
    isStarving,
    consumed,
    shortageLevel,
    shortfallPercent,
  };
}
