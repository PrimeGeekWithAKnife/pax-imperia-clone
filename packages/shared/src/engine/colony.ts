/**
 * Colony mechanics — pure functions for habitability, population growth,
 * colony establishment, and building construction.
 *
 * All functions are side-effect-free and return new objects rather than
 * mutating their inputs.
 */

import type { Planet, Building, BuildingType, StarSystem } from '../types/galaxy.js';
import type { Species, TechAge } from '../types/species.js';
import type { Ship, Fleet } from '../types/ships.js';
import type { EmpireResources } from '../types/resources.js';
import { TECH_AGES } from '../constants/game.js';
import {
  PLANET_BUILDING_SLOTS,
  PLANET_SIZE_SLOTS,
  ATMOSPHERE_ADJACENCY,
  BASE_GROWTH_RATE,
  MIN_COLONIZE_HABITABILITY,
  HABITABLE_THRESHOLD,
  HABITABILITY_WEIGHTS,
} from '../constants/planets.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';
import {
  BASE_CONSTRUCTION_RATE,
  FACTORY_CONSTRUCTION_OUTPUT,
  BUILDING_LEVEL_MULTIPLIER,
} from '../constants/resources.js';
import { generateId } from '../utils/id.js';

// ── Migration interfaces ─────────────────────────────────────────────────────

/**
 * Represents an active migration from a source planet to an uncolonised target
 * planet within the same star system.
 *
 * Migration is the multi-turn process by which a colony is founded: waves of
 * migrants depart every `wavePeriod` ticks and a fraction are lost in transit.
 * The colony is officially established once `arrivedPopulation >= threshold`.
 */
/** Ticks a wave of colonists spends in transit before arriving at the target. */
export const TRANSIT_DURATION = 5;

/** Build cost multiplier per zone. */
export const ZONE_COST_MULTIPLIER: Record<string, number> = {
  surface: 1,
  orbital: 2,
  underground: 3,
};

/** Maintenance cost multiplier per zone. */
export const ZONE_MAINTENANCE_MULTIPLIER: Record<string, number> = {
  surface: 1,
  orbital: 3,
  underground: 1,
};

/** A wave of colonists currently in transit between source and target. */
export interface TransitWave {
  /** Population in this wave (after transit losses already deducted). */
  population: number;
  /** Ticks remaining until this wave arrives at the target. */
  ticksRemaining: number;
}

export interface MigrationOrder {
  id: string;
  empireId: string;
  systemId: string;
  sourcePlanetId: string;
  targetPlanetId: string;
  /** Population that has arrived at the target so far. */
  arrivedPopulation: number;
  /** Population needed to officially establish the colony. */
  threshold: number;
  /** Ticks remaining until the next wave departs (0 means send this tick). */
  ticksToNextWave: number;
  /** Ticks between waves. */
  wavePeriod: number;
  /** Current status of the migration. */
  status: 'migrating' | 'established' | 'cancelled';
  /** Credit cost paid upfront when the migration order was created. */
  totalCost: number;
  /** Waves currently in transit — arrive when ticksRemaining reaches 0. */
  transitWaves?: TransitWave[];
}

// ── Public interfaces ───────────────────────────────────────────────────────

export interface HabitabilityReport {
  /** Composite score 0–100. */
  score: number;
  /** Atmosphere compatibility contribution (0–40). */
  atmosphereScore: number;
  /** Gravity compatibility contribution (0–30). */
  gravityScore: number;
  /** Temperature compatibility contribution (0–30). */
  temperatureScore: number;
  /** True when score >= HABITABLE_THRESHOLD (20). */
  isHabitable: boolean;
  /** Human-readable warnings about environmental hazards. */
  warnings: string[];
}

export interface ColonyStats {
  habitability: HabitabilityReport;
  populationGrowth: number;
  buildingSlots: { used: number; total: number };
  /** Turns until the front-of-queue item completes, or null if queue empty. */
  turnsToNextBuilding: number | null;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Clamps a value to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates a linear compatibility score on a single axis.
 * Returns `maxScore` when the actual value falls within [ideal - tolerance,
 * ideal + tolerance], then falls off linearly to 0 at twice the tolerance.
 */
function linearCompatibility(
  actual: number,
  ideal: number,
  tolerance: number,
  maxScore: number,
): number {
  const distance = Math.abs(actual - ideal);
  if (distance <= tolerance) return maxScore;
  // Linear falloff over a second tolerance band
  const overTolerance = distance - tolerance;
  const score = maxScore * (1 - overTolerance / tolerance);
  return Math.max(0, score);
}

// ── Habitability calculation ────────────────────────────────────────────────

/**
 * Calculates how suitable a planet is for a given species.
 *
 * - Atmosphere: 40 pts max. Full if planet atmosphere is in species'
 *   preferredAtmospheres. 20 pts if it is an adjacent/neighbouring type.
 *   0 pts otherwise.
 * - Gravity: 30 pts max. Full within idealGravity ± gravityTolerance; linear
 *   falloff outside that band.
 * - Temperature: 30 pts max. Same linear falloff logic as gravity.
 */
export function calculateHabitability(planet: Planet, species: Species): HabitabilityReport {
  const env = species.environmentPreference;
  const warnings: string[] = [];

  // ── Atmosphere score ──────────────────────────────────────────────────────
  let atmosphereScore: number;
  if ((env.preferredAtmospheres as string[]).includes(planet.atmosphere)) {
    atmosphereScore = HABITABILITY_WEIGHTS.atmosphere; // 40
  } else {
    // Check adjacency — partial compatibility
    const adjacentAtmospheres = ATMOSPHERE_ADJACENCY[planet.atmosphere] ?? [];
    const isAdjacent = env.preferredAtmospheres.some(preferred =>
      (adjacentAtmospheres as string[]).includes(preferred),
    );
    atmosphereScore = isAdjacent ? HABITABILITY_WEIGHTS.atmosphere / 2 : 0;
  }

  if (atmosphereScore === 0) {
    if (planet.atmosphere === 'toxic') {
      warnings.push('Toxic atmosphere');
    } else if (planet.atmosphere === 'none') {
      warnings.push('No atmosphere — pressure suits required');
    } else {
      warnings.push('Incompatible atmosphere');
    }
  } else if (atmosphereScore < HABITABILITY_WEIGHTS.atmosphere) {
    warnings.push('Marginal atmosphere compatibility');
  }

  // ── Gravity score ─────────────────────────────────────────────────────────
  const gravityScore = Math.round(
    linearCompatibility(
      planet.gravity,
      env.idealGravity,
      env.gravityTolerance,
      HABITABILITY_WEIGHTS.gravity,
    ),
  );

  if (gravityScore === 0) {
    if (planet.gravity > env.idealGravity + env.gravityTolerance * 2) {
      warnings.push('Crushing gravity');
    } else {
      warnings.push('Negligible gravity');
    }
  } else if (gravityScore < HABITABILITY_WEIGHTS.gravity * 0.5) {
    warnings.push('Adverse gravity conditions');
  }

  // ── Temperature score ─────────────────────────────────────────────────────
  let temperatureScore = Math.round(
    linearCompatibility(
      planet.temperature,
      env.idealTemperature,
      env.temperatureTolerance,
      HABITABILITY_WEIGHTS.temperature,
    ),
  );

  if (temperatureScore === 0) {
    if (planet.temperature > env.idealTemperature + env.temperatureTolerance * 2) {
      warnings.push('Extreme heat');
    } else {
      warnings.push('Extreme cold');
    }
  } else if (temperatureScore < HABITABILITY_WEIGHTS.temperature * 0.5) {
    warnings.push('Harsh temperature');
  }

  let rawScore = atmosphereScore + gravityScore + temperatureScore;

  // ── Special ability modifiers ─────────────────────────────────────────────
  const abilities = species.specialAbilities ?? [];

  // Aquatic: +20 on ocean worlds, -10 on desert worlds
  if (abilities.includes('aquatic')) {
    if (planet.type === 'ocean') {
      rawScore += 20;
    } else if (planet.type === 'desert') {
      rawScore -= 10;
    }
  }

  // Silicon-based: +20 on volcanic worlds, double temperature tolerance
  // (temperature score is recalculated with 2x tolerance)
  if (abilities.includes('silicon_based')) {
    if (planet.type === 'volcanic') {
      rawScore += 20;
    }
    // Recalculate temperature with doubled tolerance
    const doubledTempScore = Math.round(
      linearCompatibility(
        planet.temperature,
        env.idealTemperature,
        env.temperatureTolerance * 2,
        HABITABILITY_WEIGHTS.temperature,
      ),
    );
    rawScore = rawScore - temperatureScore + doubledTempScore;
    // Update the component score for the report
    temperatureScore = doubledTempScore;
  }

  // Subterranean: +15 on barren/rocky worlds, +5 on all non-gas-giant worlds
  if (abilities.includes('subterranean')) {
    if (planet.type === 'barren') {
      rawScore += 15;
    }
    if (planet.type !== 'gas_giant') {
      rawScore += 5;
    }
  }

  const score = clamp(rawScore, 0, 100);

  return {
    score,
    atmosphereScore,
    gravityScore,
    temperatureScore,
    isHabitable: score >= HABITABLE_THRESHOLD,
    warnings,
  };
}

// ── Population growth ───────────────────────────────────────────────────────

/**
 * Calculate the effective maximum population for a planet, including
 * bonuses from population_center buildings.
 *
 * Each population_center adds its `populationCapacityBonus` (default 1.5M),
 * scaled by the compound level multiplier: L2 +20%, L3 +25%, L4 +30%, L5 +35%.
 */
export function getEffectiveMaxPopulation(planet: Planet): number {
  const LEVEL_MULTIPLIERS = [1.0, 1.0, 1.20, 1.50, 1.95, 2.63];
  let bonus = 0;
  for (const building of planet.buildings) {
    if (building.type === 'population_center') {
      const def = BUILDING_DEFINITIONS[building.type];
      const baseBonus = def?.populationCapacityBonus ?? 0;
      const levelMul = LEVEL_MULTIPLIERS[building.level] ?? 1.0;
      bonus += baseBonus * levelMul;
    }
  }
  return planet.maxPopulation + bonus;
}

/**
 * Calculates the number of population units to add this turn.
 *
 * Formula (logistic):
 *   baseGrowth = pop * BASE_GROWTH_RATE * (reproduction / 5)
 *   adjusted   = baseGrowth * (habitability / 100)
 *   logistic   = adjusted * (1 - currentPop / effectiveMaxPop)
 *
 * Each population_center building at level L adds +10% * L to growth rate.
 * Population centres also increase max capacity (see getEffectiveMaxPopulation).
 * Returns at least 1 when the colony is alive and below the population cap.
 *
 * If the empire is starving (isStarving = true), growth is always zero.
 */
/**
 * Calculate population growth for a planet.
 *
 * Growth is modulated by the empire's food reserves (organics stockpile):
 *   - Abundance (>200):    full growth
 *   - Adequate (50–200):   full growth
 *   - Food scarce (1–49):  50% growth — rationing slows reproduction
 *   - Depleted (≤0):       0% growth — all food sustains existing population
 *
 * Full starvation (population decline) is handled separately in
 * {@link stepFoodConsumption} in game-loop.ts.
 *
 * @param empireOrganics Current empire organics stockpile.  Defaults to 100
 *   (adequate) when not provided for backwards compatibility.
 */
export function calculatePopulationGrowth(
  planet: Planet,
  species: Species,
  habitability: number,
  isStarving = false,
  empireOrganics = 100,
): number {
  if (isStarving) return 0;
  if (planet.currentPopulation <= 0) return 0;

  const effectiveMax = getEffectiveMaxPopulation(planet);
  if (planet.currentPopulation >= effectiveMax) return 0;

  const reproductionFactor = species.traits.reproduction / 5;
  let baseGrowth = planet.currentPopulation * BASE_GROWTH_RATE * reproductionFactor;

  // Habitability modifier
  baseGrowth *= habitability / 100;

  // Population center building bonus: +10% per level per building (growth RATE boost)
  for (const building of planet.buildings) {
    if (building.type === 'population_center') {
      baseGrowth *= 1 + 0.1 * building.level;
    }
  }

  // ── Food availability modifier ────────────────────────────────────────────
  // A population with scarce food makes fewer babies.  This creates a natural
  // feedback loop: as population approaches the food ceiling, growth slows and
  // eventually stops before full starvation hits.
  if (empireOrganics <= 0) {
    return 0; // depleted — no growth, all food sustains existing pop
  } else if (empireOrganics < 50) {
    baseGrowth *= 0.5; // scarce — rationing, reduced reproduction
  }
  // >= 50: full growth rate (adequate or abundant)

  // Logistic curve — growth approaches zero as population nears effective max
  const logisticFactor = 1 - planet.currentPopulation / effectiveMax;
  let growth = baseGrowth * logisticFactor;

  // Minimum growth guarantee (only when food is adequate)
  if (growth < 1 && empireOrganics >= 50) growth = 1;

  return Math.floor(growth);
}

// ── Colony establishment ────────────────────────────────────────────────────

/**
 * Checks whether the species can colonise this planet.
 */
export function canColonize(
  planet: Planet,
  species: Species,
): { allowed: boolean; reason?: string } {
  if (planet.ownerId !== null) {
    return { allowed: false, reason: 'Planet is already owned' };
  }

  if (planet.currentPopulation > 0) {
    return { allowed: false, reason: 'Planet is already colonized' };
  }

  // Gas giants can only have orbital platforms established via a special
  // colonisation path, not standard surface colonisation.
  if (planet.type === 'gas_giant') {
    return {
      allowed: false,
      reason: 'Gas giants cannot be surface-colonized — orbital platform required',
    };
  }

  const report = calculateHabitability(planet, species);
  if (report.score < MIN_COLONIZE_HABITABILITY) {
    return {
      allowed: false,
      reason: `Habitability too low (${report.score}/100, minimum ${MIN_COLONIZE_HABITABILITY})`,
    };
  }

  return { allowed: true };
}

/**
 * Creates an initial colony on the planet.
 *
 * Returns a new Planet with:
 * - ownerId set to the species id
 * - currentPopulation set to initialPopulation
 * - a starter population_center building (level 1)
 */
export function establishColony(
  planet: Planet,
  species: Species,
  initialPopulation: number,
): Planet {
  const check = canColonize(planet, species);
  if (!check.allowed) {
    throw new Error(`Cannot establish colony: ${check.reason}`);
  }

  const starterBuilding: Building = {
    id: generateId(),
    type: 'population_center',
    level: 1,
  };

  return {
    ...planet,
    ownerId: species.id,
    currentPopulation: initialPopulation,
    buildings: [...planet.buildings, starterBuilding],
  };
}

// ── Demolish building ──────────────────────────────────────────────────────

/**
 * Removes a building from a planet by its ID.
 *
 * Returns a new Planet object with the building removed from the buildings
 * array. If no building with the given ID exists, the planet is returned
 * unchanged.
 *
 * This is a pure function — it does not mutate its inputs.
 */
export function demolishBuilding(planet: Planet, buildingId: string): Planet {
  const filtered = planet.buildings.filter(b => b.id !== buildingId);
  if (filtered.length === planet.buildings.length) {
    // No building matched — return unchanged
    return planet;
  }
  return {
    ...planet,
    buildings: filtered,
  };
}

// ── In-system colonisation ──────────────────────────────────────────────────

/**
 * Base credit cost for in-system colonisation.
 * Applies when habitability is at maximum (100).
 */
const BASE_COLONISATION_COST = 10_000;

/**
 * Mineral cost for in-system colonisation.
 * Paid upfront alongside the credit cost.
 */
export const COLONISATION_MINERAL_COST = 3_000;

/**
 * Number of colonists transferred from the source planet to the new colony.
 */
export const COLONIST_TRANSFER_COUNT = 100_000;

/**
 * Minimum mortality rate during colonist transfer (1%).
 */
const TRANSFER_MORTALITY_MIN = 0.01;

/**
 * Maximum mortality rate during colonist transfer (10%).
 */
const TRANSFER_MORTALITY_MAX = 0.10;

/**
 * Calculate the credit cost to colonise a planet based on its habitability.
 *
 * Lower habitability = higher cost.  The formula scales the base cost
 * inversely with habitability, clamped so that a score of 100 yields exactly
 * the base cost and a score approaching zero cannot exceed 10× the base cost.
 *
 *   cost = BASE_COLONISATION_COST * (100 / max(habitability, 10))
 *
 * Result is always a positive integer (rounded up).
 */
export function getColonisationCost(planet: Planet, species: Species): number {
  const report = calculateHabitability(planet, species);
  const effectiveScore = Math.max(report.score, 10);
  let cost = Math.ceil(BASE_COLONISATION_COST * (100 / effectiveScore));
  // Nomadic: -20% colony establishment cost
  if (species.specialAbilities?.includes('nomadic')) {
    cost = Math.ceil(cost * 0.8);
  }
  return cost;
}

/**
 * Check whether an empire can colonise a planet within the same star system
 * without a transport ship.
 *
 * Requirements (all must be satisfied):
 * - Empire owns at least one other planet in the same system.
 * - Source planet (most populous owned planet) has >= COLONIST_TRANSFER_COUNT population.
 * - Target planet is unowned (ownerId === null).
 * - Target planet is not already populated (currentPopulation === 0).
 * - Target planet is not a gas giant (use the orbital-platform path for those).
 * - Habitability for the empire's species is >= MIN_COLONIZE_HABITABILITY (10).
 * - Empire can afford the credit and mineral colonisation costs.
 *
 * Returns the colonisation cost and mineral cost even when the action is not
 * allowed, so callers can display them in the UI regardless.
 */
export function canColoniseInSystem(
  system: StarSystem,
  targetPlanetId: string,
  empireId: string,
  species: Species,
  empireCredits: number,
  empireMinerals = 0,
): { allowed: boolean; reason?: string; cost: number; mineralCost: number } {
  const targetPlanet = system.planets.find(p => p.id === targetPlanetId);
  const mineralCost = COLONISATION_MINERAL_COST;

  if (!targetPlanet) {
    return { allowed: false, reason: 'Planet not found in this system', cost: 0, mineralCost };
  }

  // The cost is always calculated so callers can show it even on rejection.
  const cost = getColonisationCost(targetPlanet, species);

  // Must own at least one planet in the same system.
  const ownedPlanets = system.planets.filter(
    p => p.id !== targetPlanetId && p.ownerId === empireId,
  );
  if (ownedPlanets.length === 0) {
    return {
      allowed: false,
      reason: 'Empire does not control any planets in this system',
      cost,
      mineralCost,
    };
  }

  // Check source planet has enough population for the transfer.
  const sourcePlanet = ownedPlanets.sort((a, b) => b.currentPopulation - a.currentPopulation)[0]!;
  if (sourcePlanet.currentPopulation < COLONIST_TRANSFER_COUNT) {
    return {
      allowed: false,
      reason: `Source planet needs at least ${(COLONIST_TRANSFER_COUNT / 1000).toFixed(0)}K population (${sourcePlanet.name} has ${(sourcePlanet.currentPopulation / 1000).toFixed(0)}K)`,
      cost,
      mineralCost,
    };
  }

  // Target must be unowned.
  if (targetPlanet.ownerId !== null) {
    return { allowed: false, reason: 'Planet is already owned', cost, mineralCost };
  }

  // Target must be unpopulated.
  if (targetPlanet.currentPopulation > 0) {
    return { allowed: false, reason: 'Planet already has a population', cost, mineralCost };
  }

  // Gas giants require the orbital-platform path.
  if (targetPlanet.type === 'gas_giant') {
    return {
      allowed: false,
      reason: 'Gas giants cannot be colonised this way — an orbital platform is required',
      cost,
      mineralCost,
    };
  }

  // Habitability check.
  const report = calculateHabitability(targetPlanet, species);
  if (report.score < MIN_COLONIZE_HABITABILITY) {
    return {
      allowed: false,
      reason: `Habitability too low (${report.score}/100, minimum ${MIN_COLONIZE_HABITABILITY})`,
      cost,
      mineralCost,
    };
  }

  // Credit affordability check.
  if (empireCredits < cost) {
    return {
      allowed: false,
      reason: `Insufficient credits (${empireCredits} available, ${cost} required)`,
      cost,
      mineralCost,
    };
  }

  // Mineral affordability check.
  if (empireMinerals < mineralCost) {
    return {
      allowed: false,
      reason: `Insufficient minerals (${empireMinerals} available, ${mineralCost} required)`,
      cost,
      mineralCost,
    };
  }

  return { allowed: true, cost, mineralCost };
}

/**
 * Execute in-system colonisation on a star system.
 *
 * Transfers `COLONIST_TRANSFER_COUNT` colonists from the source planet (most
 * populous empire planet in the system) to the target planet, applying random
 * mortality during transit (1-10% die from disease, accidents, and rocket
 * explosions). The survivors are placed on the target planet, which receives
 * a level-1 `population_center` building.
 *
 * Returns a new StarSystem and the number of colonists that died in transit.
 * Does not mutate the original.
 *
 * @throws if the target planet or a suitable source planet is not found.
 */
export function coloniseInSystem(
  system: StarSystem,
  targetPlanetId: string,
  empireId: string,
): { system: StarSystem; mortalityCount: number } {
  const targetIndex = system.planets.findIndex(p => p.id === targetPlanetId);
  if (targetIndex === -1) {
    throw new Error(
      `Planet "${targetPlanetId}" not found in system "${system.id}"`,
    );
  }

  // Find the most populous owned planet as the source.
  const sourcePlanets = system.planets
    .map((p, i) => ({ planet: p, index: i }))
    .filter(e => e.planet.ownerId === empireId && e.planet.id !== targetPlanetId)
    .sort((a, b) => b.planet.currentPopulation - a.planet.currentPopulation);

  if (sourcePlanets.length === 0) {
    throw new Error(
      `No owned source planet found for empire "${empireId}" in system "${system.id}"`,
    );
  }

  const { planet: sourcePlanet, index: sourceIndex } = sourcePlanets[0]!;
  const targetPlanet = system.planets[targetIndex]!;

  // Apply random mortality: 1-10% of colonists die during transfer.
  const mortalityRate = TRANSFER_MORTALITY_MIN +
    Math.random() * (TRANSFER_MORTALITY_MAX - TRANSFER_MORTALITY_MIN);
  const mortalityCount = Math.floor(COLONIST_TRANSFER_COUNT * mortalityRate);
  const survivors = COLONIST_TRANSFER_COUNT - mortalityCount;

  const starterBuilding: Building = {
    id: generateId(),
    type: 'population_center',
    level: 1,
  };

  // Deduct population from source.
  const updatedSource: Planet = {
    ...sourcePlanet,
    currentPopulation: sourcePlanet.currentPopulation - COLONIST_TRANSFER_COUNT,
  };

  // Place survivors on target.
  const colonisedTarget: Planet = {
    ...targetPlanet,
    ownerId: empireId,
    currentPopulation: survivors,
    buildings: [...targetPlanet.buildings, starterBuilding],
  };

  const updatedPlanets = [...system.planets];
  updatedPlanets[sourceIndex] = updatedSource;
  updatedPlanets[targetIndex] = colonisedTarget;

  return {
    system: { ...system, planets: updatedPlanets },
    mortalityCount,
  };
}

// ── Migration ────────────────────────────────────────────────────────────────

/**
 * The population threshold that must arrive at the target planet for a colony
 * to be officially established.
 */
const MIGRATION_THRESHOLD = 50;

/**
 * Number of ticks between successive migration waves.
 */
const MIGRATION_WAVE_PERIOD = 3;

/**
 * Minimum source population required before migration can begin.
 * Prevents small colonies from stripping themselves bare.
 */
const MIN_SOURCE_POPULATION = 100;

/**
 * Check whether an empire can start a migration to a target planet within the
 * same star system.
 *
 * Requirements (all must be satisfied):
 * - Source planet is owned by the empire.
 * - Source planet has population >= COLONIST_TRANSFER_COUNT (100K).
 * - Target planet is unowned.
 * - Target planet is not a gas giant.
 * - Target planet habitability for the species is >= MIN_COLONIZE_HABITABILITY (10).
 * - Empire can afford the credit and mineral costs.
 * - No existing active migration to this target planet.
 */
export function canStartMigration(
  system: StarSystem,
  sourcePlanetId: string,
  targetPlanetId: string,
  empireId: string,
  species: Species,
  empireCredits: number,
  existingOrders: MigrationOrder[] = [],
  empireMinerals = 0,
): { allowed: boolean; reason?: string; cost: number; mineralCost: number } {
  const mineralCost = COLONISATION_MINERAL_COST;

  const sourcePlanet = system.planets.find(p => p.id === sourcePlanetId);
  if (!sourcePlanet) {
    return { allowed: false, reason: 'Source planet not found in this system', cost: 0, mineralCost };
  }

  const targetPlanet = system.planets.find(p => p.id === targetPlanetId);
  if (!targetPlanet) {
    return { allowed: false, reason: 'Target planet not found in this system', cost: 0, mineralCost };
  }

  // Cost is always calculated so callers can show it even on rejection.
  const cost = getColonisationCost(targetPlanet, species);

  // Source must be owned by the empire.
  if (sourcePlanet.ownerId !== empireId) {
    return {
      allowed: false,
      reason: 'Source planet is not owned by this empire',
      cost,
      mineralCost,
    };
  }

  // Source must have sufficient population for the colonist transfer.
  if (sourcePlanet.currentPopulation < COLONIST_TRANSFER_COUNT) {
    return {
      allowed: false,
      reason: `Source planet needs at least ${(COLONIST_TRANSFER_COUNT / 1000).toFixed(0)}K population (has ${(sourcePlanet.currentPopulation / 1000).toFixed(0)}K)`,
      cost,
      mineralCost,
    };
  }

  // Target must be unowned.
  if (targetPlanet.ownerId !== null) {
    return { allowed: false, reason: 'Target planet is already owned', cost, mineralCost };
  }

  // Gas giants require the orbital-platform path.
  if (targetPlanet.type === 'gas_giant') {
    return {
      allowed: false,
      reason: 'Gas giants cannot be colonised this way — an orbital platform is required',
      cost,
      mineralCost,
    };
  }

  // Habitability check.
  const report = calculateHabitability(targetPlanet, species);
  if (report.score < MIN_COLONIZE_HABITABILITY) {
    return {
      allowed: false,
      reason: `Habitability too low (${report.score}/100, minimum ${MIN_COLONIZE_HABITABILITY})`,
      cost,
      mineralCost,
    };
  }

  // No existing active migration to the same target.
  const duplicate = existingOrders.find(
    o => o.targetPlanetId === targetPlanetId && o.status === 'migrating',
  );
  if (duplicate) {
    return { allowed: false, reason: 'A migration to this planet is already in progress', cost, mineralCost };
  }

  // Credit affordability check.
  if (empireCredits < cost) {
    return {
      allowed: false,
      reason: `Insufficient credits (${empireCredits} available, ${cost} required)`,
      cost,
      mineralCost,
    };
  }

  // Mineral affordability check.
  if (empireMinerals < mineralCost) {
    return {
      allowed: false,
      reason: `Insufficient minerals (${empireMinerals} available, ${mineralCost} required)`,
      cost,
      mineralCost,
    };
  }

  return { allowed: true, cost, mineralCost };
}

/**
 * Create a new MigrationOrder for an in-system migration.
 *
 * Does **not** validate prerequisites — call `canStartMigration` first.
 * Does **not** deduct credits — the caller is responsible for that.
 */
export function startMigration(
  system: StarSystem,
  sourcePlanetId: string,
  targetPlanetId: string,
  empireId: string,
  species: Species,
): MigrationOrder {
  const targetPlanet = system.planets.find(p => p.id === targetPlanetId);
  if (!targetPlanet) {
    throw new Error(`Planet "${targetPlanetId}" not found in system "${system.id}"`);
  }

  const cost = getColonisationCost(targetPlanet, species);

  return {
    id: generateId(),
    empireId,
    systemId: system.id,
    sourcePlanetId,
    targetPlanetId,
    arrivedPopulation: 0,
    threshold: MIGRATION_THRESHOLD,
    ticksToNextWave: 0, // first wave departs immediately on next tick
    wavePeriod: MIGRATION_WAVE_PERIOD,
    status: 'migrating',
    totalCost: cost,
  };
}

/**
 * Process one game tick of a migration order.
 *
 * Each tick:
 * 1. Advance all in-transit waves — any that arrive add population to the target.
 * 2. If `ticksToNextWave > 0`, decrement the departure counter.
 * 3. Otherwise dispatch a new wave from the source (enters transit, not instant arrival):
 *    - Wave size = 1–3 people, capped at 10% of source population.
 *    - 10% transit loss is applied upfront; survivors enter transitWaves.
 *    - Source population decreases immediately on departure.
 * 4. Colony is established once `arrivedPopulation >= threshold`.
 *
 * Returns a new order and system (pure — no mutation) plus event strings.
 */
export function processMigrationTick(
  order: MigrationOrder,
  system: StarSystem,
): { order: MigrationOrder; system: StarSystem; events: string[] } {
  if (order.status !== 'migrating') {
    return { order, system, events: [] };
  }

  const sourcePlanetIndex = system.planets.findIndex(p => p.id === order.sourcePlanetId);
  const targetPlanetIndex = system.planets.findIndex(p => p.id === order.targetPlanetId);

  if (sourcePlanetIndex === -1 || targetPlanetIndex === -1) {
    return { order: { ...order, status: 'cancelled' }, system, events: ['Migration cancelled: planet no longer exists'] };
  }

  let sourcePlanet = system.planets[sourcePlanetIndex]!;
  let targetPlanet = system.planets[targetPlanetIndex]!;
  const eventMessages: string[] = [];

  // Guard: if another empire has already colonised the target (e.g. via a
  // colony ship that landed between the migration being ordered and now),
  // cancel the migration to prevent depositing colonists on a rival's planet.
  if (targetPlanet.ownerId !== null && targetPlanet.ownerId !== order.empireId) {
    return {
      order: { ...order, status: 'cancelled', transitWaves: [] },
      system,
      events: ['Migration cancelled: planet was colonised by another empire'],
    };
  }

  // ── 1. Advance in-transit waves — deliver those that have arrived ──────
  let transitWaves = [...(order.transitWaves ?? [])];
  let newArrivedTotal = order.arrivedPopulation;
  let totalArrivingThisTick = 0;

  const stillInTransit: TransitWave[] = [];
  for (const wave of transitWaves) {
    const remaining = wave.ticksRemaining - 1;
    if (remaining <= 0) {
      // Wave arrives at target
      totalArrivingThisTick += wave.population;
      newArrivedTotal += wave.population;
    } else {
      stillInTransit.push({ ...wave, ticksRemaining: remaining });
    }
  }
  transitWaves = stillInTransit;

  if (totalArrivingThisTick > 0) {
    // First arriving wave claims ownership
    const newOwnerId = targetPlanet.ownerId ?? order.empireId;
    targetPlanet = {
      ...targetPlanet,
      currentPopulation: targetPlanet.currentPopulation + totalArrivingThisTick,
      ownerId: newOwnerId,
    };
    eventMessages.push(`${totalArrivingThisTick} colonists arrived`);
  }

  // ── 2. Dispatch a new wave if the departure timer has elapsed ─────────
  let ticksToNextWave = order.ticksToNextWave;
  if (ticksToNextWave > 0) {
    ticksToNextWave--;
  } else {
    // Wave departure
    const maxWave = Math.max(1, Math.floor(sourcePlanet.currentPopulation * 0.1));
    const waveDeparted = Math.min(3, maxWave);
    const actualDeparted = Math.min(waveDeparted, sourcePlanet.currentPopulation);

    if (actualDeparted > 0) {
      // Transit losses: 10% of wave
      const lost = Math.floor(actualDeparted * 0.1);
      const survivors = actualDeparted - lost;

      // Source loses population immediately on departure
      sourcePlanet = {
        ...sourcePlanet,
        currentPopulation: sourcePlanet.currentPopulation - actualDeparted,
      };

      // Survivors enter transit
      if (survivors > 0) {
        transitWaves.push({ population: survivors, ticksRemaining: TRANSIT_DURATION });
      }

      eventMessages.push(`Wave of ${actualDeparted} departed`);
      if (lost > 0) eventMessages.push(`${lost} lost in transit`);

      ticksToNextWave = order.wavePeriod;
    } else if (transitWaves.length === 0) {
      // Source exhausted and nothing in transit — cancel
      return {
        order: { ...order, status: 'cancelled', transitWaves: [] },
        system,
        events: ['Migration cancelled: source population exhausted'],
      };
    }
  }

  // ── 3. Update system planets ──────────────────────────────────────────
  const updatedPlanets = [...system.planets];
  updatedPlanets[sourcePlanetIndex] = sourcePlanet;
  updatedPlanets[targetPlanetIndex] = targetPlanet;
  const updatedSystem: StarSystem = { ...system, planets: updatedPlanets };

  // ── 4. Determine status ───────────────────────────────────────────────
  const newStatus: MigrationOrder['status'] =
    newArrivedTotal >= order.threshold ? 'established' : 'migrating';

  const updatedOrder: MigrationOrder = {
    ...order,
    arrivedPopulation: newArrivedTotal,
    ticksToNextWave,
    status: newStatus,
    transitWaves,
  };

  return { order: updatedOrder, system: updatedSystem, events: eventMessages };
}

// ── Inter-system colonisation via coloniser ship ────────────────────────────

/**
 * Starting population placed on a newly-founded colony when a coloniser ship
 * arrives.  Represents the colonists carried aboard the vessel.
 */
export const COLONISER_SHIP_INITIAL_POPULATION = 500;

/**
 * Check whether a coloniser ship in a fleet can colonise a planet in the target
 * star system.
 *
 * Requirements (all must be satisfied):
 * - `ship` must have a hull class of 'coloniser'.
 * - `fleet` must be located in `targetSystem`.
 * - Target planet must be unowned (ownerId === null).
 * - Target planet must be unpopulated (currentPopulation === 0).
 * - Target planet must not be a gas giant.
 * - Habitability for the given species must be >= MIN_COLONIZE_HABITABILITY (10).
 *
 * Unlike in-system colonisation this method does not require the empire to
 * already own a planet in the target system — the colony ship carries
 * everything needed to found a new settlement from scratch.
 *
 * @param ship         The specific coloniser ship that will be consumed.
 * @param fleet        The fleet the coloniser ship belongs to (determines location).
 * @param targetSystem The star system containing the target planet.
 * @param targetPlanetId  ID of the planet to colonise.
 * @param species      The empire's species (used for habitability calculation).
 */
export function canColoniseWithShip(
  ship: Ship,
  fleet: Fleet,
  targetSystem: StarSystem,
  targetPlanetId: string,
  species: Species,
  /** All fleets in the target system — used for stance-based colonisation blocking. */
  systemFleets?: Fleet[],
): { allowed: boolean; reason?: string } {
  // Ship must be a coloniser hull class.  We resolve the hull class via the
  // ship's design ID — the caller is responsible for passing the correct ship
  // object with hullClass resolved, or we check by checking if it's passed
  // correctly.  Since Ship does not store hullClass directly, the caller must
  // supply the ship from a coloniser design.  We verify via a convention:
  // coloniser ships carry a special marker in their designId prefix OR the
  // caller provides the already-looked-up hull class.  Because the Ship type
  // does not include hullClass, we accept an enriched parameter.
  //
  // NOTE: The actual hull class lookup happens at the call site (game engine /
  // UI).  This function trusts that the caller has verified the ship's hull is
  // 'coloniser' before invoking it.  The check below is a safety guard.
  //
  // We detect coloniser ships by checking whether the ship's designId contains
  // 'coloniser' (the auto-generated IDs do not), so callers should pass a
  // pre-validated ship.  The canonical approach is for the caller to look up
  // the ShipDesign → HullTemplate and confirm hull.class === 'coloniser'.
  // This function therefore only performs game-state validity checks.

  // Fleet must be in the target system.
  if (fleet.position.systemId !== targetSystem.id) {
    return {
      allowed: false,
      reason: 'Fleet is not in the target system',
    };
  }

  // Fleet must contain this ship.
  if (!fleet.ships.includes(ship.id)) {
    return {
      allowed: false,
      reason: 'Ship is not part of this fleet',
    };
  }

  // Find target planet.
  const targetPlanet = targetSystem.planets.find(p => p.id === targetPlanetId);
  if (!targetPlanet) {
    return {
      allowed: false,
      reason: 'Planet not found in this system',
    };
  }

  // Target must be unowned.
  if (targetPlanet.ownerId !== null) {
    return { allowed: false, reason: 'Planet is already owned' };
  }

  // Target must be unpopulated.
  if (targetPlanet.currentPopulation > 0) {
    return { allowed: false, reason: 'Planet already has a population' };
  }

  // Gas giants cannot be surface-colonised.
  if (targetPlanet.type === 'gas_giant') {
    return {
      allowed: false,
      reason: 'Gas giants cannot be colonised this way — an orbital platform is required',
    };
  }

  // Habitability check.
  const report = calculateHabitability(targetPlanet, species);
  if (report.score < MIN_COLONIZE_HABITABILITY) {
    return {
      allowed: false,
      reason: `Habitability too low (${report.score}/100, minimum ${MIN_COLONIZE_HABITABILITY})`,
    };
  }

  // Check if foreign fleets on patrol or aggressive stance are blocking colonisation.
  // Patrol stance actively prevents colonisation; aggressive stance also blocks
  // (they'd attack). Defensive and evasive stances permit colonisation.
  if (systemFleets) {
    const blockingFleet = systemFleets.find(f => {
      if (f.empireId === fleet.empireId) return false;    // Own fleets don't block
      if (f.ships.length === 0) return false;             // Empty fleets don't block
      return f.stance === 'patrol' || f.stance === 'aggressive';
    });
    if (blockingFleet) {
      return {
        allowed: false,
        reason: 'Foreign military forces are contesting this system — colonisation blocked',
      };
    }
  }

  return { allowed: true };
}

/**
 * Execute colonisation via a coloniser ship.
 *
 * The ship is consumed (removed from the fleet and destroyed) and becomes the
 * founding colony.  The target planet is updated with:
 * - ownerId set to `empireId`
 * - currentPopulation set to `COLONISER_SHIP_INITIAL_POPULATION` (500)
 * - a level-1 `population_center` building
 *
 * Returns a new StarSystem and the updated fleet — does not mutate the originals.
 *
 * @throws if the planet is not found in the system.
 */
/**
 * Determine founding buildings based on researched coloniser techs.
 * Each tech adds specific buildings to the founding package.
 * Always includes population_center as the base.
 */
export function getFoundingBuildings(researchedTechs: string[]): BuildingType[] {
  const buildings: BuildingType[] = ['population_center'];
  const has = (id: string) => researchedTechs.includes(id);

  // Universal techs
  if (has('colonial_engineering') || has('nexari_network_seeding') || has('teranos_manifest_destiny')) {
    buildings.push('factory');
  }
  if (has('colonial_agriculture') || has('sylvani_living_ships') || has('teranos_manifest_destiny')) {
    buildings.push('hydroponics_bay');
  }
  if (has('colonial_power_systems') || has('teranos_manifest_destiny')) {
    buildings.push('power_plant');
  }
  if (has('fortified_settlements') || has('drakmari_war_colonisation') || has('khazari_hive_seeding')) {
    buildings.push('military_bunker' as BuildingType);
  }

  // Species-specific extras
  if (has('nexari_network_seeding')) {
    buildings.push('research_lab');
  }
  if (has('drakmari_war_colonisation')) {
    buildings.push('shipyard');
  }

  return buildings;
}

/**
 * Determine founding population based on researched coloniser techs.
 */
export function getFoundingPopulation(researchedTechs: string[]): number {
  let pop = COLONISER_SHIP_INITIAL_POPULATION;
  const has = (id: string) => researchedTechs.includes(id);

  if (has('population_acceleration')) pop += 5000;
  if (has('khazari_hive_seeding')) pop += 3000;
  if (has('sylvani_living_ships')) pop += 1000;

  return pop;
}

export function coloniseWithShip(
  system: StarSystem,
  targetPlanetId: string,
  empireId: string,
  fleet: Fleet,
  shipId: string,
  _currentAge = 'nano_atomic',
  researchedTechs: string[] = [],
): { system: StarSystem; fleet: Fleet } {
  const planetIndex = system.planets.findIndex(p => p.id === targetPlanetId);
  if (planetIndex === -1) {
    throw new Error(
      `Planet "${targetPlanetId}" not found in system "${system.id}"`,
    );
  }

  const planet = system.planets[planetIndex]!;

  // Determine founding package from researched coloniser techs
  const buildingTypes = getFoundingBuildings(researchedTechs);
  const initialPop = getFoundingPopulation(researchedTechs);

  const starterBuildings: Building[] = buildingTypes.map(type => ({
    id: generateId(),
    type,
    level: 1,
  }));

  const colonisedPlanet: Planet = {
    ...planet,
    ownerId: empireId,
    currentPopulation: initialPop,
    buildings: [...planet.buildings, ...starterBuildings],
  };

  const updatedPlanets = [...system.planets];
  updatedPlanets[planetIndex] = colonisedPlanet;
  const updatedSystem: StarSystem = { ...system, planets: updatedPlanets };

  // Remove the consumed coloniser ship from the fleet.
  const updatedFleet: Fleet = {
    ...fleet,
    ships: fleet.ships.filter(id => id !== shipId),
  };

  return { system: updatedSystem, fleet: updatedFleet };
}

// ── Building slot management ────────────────────────────────────────────────

// ── Zone-aware building slots ──────────────────────────────────────────────

export interface SlotInfo { used: number; total: number; }
export interface ZonedSlots { surface: SlotInfo; orbital: SlotInfo; underground: SlotInfo; }

const ORBITAL_BASE_SLOTS = 3;
const UNDERGROUND_BASE_SLOTS = 3;

/**
 * Returns per-zone building slot counts for a planet.
 *
 * Surface slots come from the planet type constant.
 * Orbital slots come from orbital_platform buildings (3 + level each).
 * Underground slots come from underground_complex buildings (3 + level each).
 */
export function getBuildingSlots(planet: Planet): ZonedSlots {
  // Use size-based slots if available (new planets), fall back to type-based (old saves)
  const surfaceTotal = planet.size ? PLANET_SIZE_SLOTS[planet.size] : PLANET_BUILDING_SLOTS[planet.type];

  let orbitalTotal = 0;
  let undergroundTotal = 0;
  for (const b of planet.buildings) {
    if (b.type === 'orbital_platform') orbitalTotal += ORBITAL_BASE_SLOTS + b.level;
    if (b.type === 'underground_complex') undergroundTotal += UNDERGROUND_BASE_SLOTS + b.level;
  }

  let surfaceUsed = 0, orbitalUsed = 0, undergroundUsed = 0;
  for (const b of planet.buildings) {
    const zone = b.slotZone ?? 'surface';
    if (zone === 'orbital') orbitalUsed++;
    else if (zone === 'underground') undergroundUsed++;
    else surfaceUsed++;
  }

  return {
    surface: { used: surfaceUsed, total: surfaceTotal },
    orbital: { used: orbitalUsed, total: orbitalTotal },
    underground: { used: undergroundUsed, total: undergroundTotal },
  };
}

/**
 * Backward-compatible helper that returns flat used/total across all zones.
 */
export function getTotalSlots(planet: Planet): { used: number; total: number } {
  const z = getBuildingSlots(planet);
  return {
    used: z.surface.used + z.orbital.used + z.underground.used,
    total: z.surface.total + z.orbital.total + z.underground.total,
  };
}

/** Buildings that require another building to exist first (prerequisite → set of unlocked buildings). */
const BUILDING_PREREQUISITES: Partial<Record<BuildingType, BuildingType>> = {
  shipyard: 'spaceport',
  defense_grid: 'spaceport',
};

/**
 * Checks whether a building of the given type can be constructed on this planet.
 *
 * Rules checked:
 * - Gas giants may only host spaceport (orbital platform) buildings.
 * - Building slots must not be exhausted.
 * - Technology requirements must be met (if `empireTechs` is provided).
 * - Prerequisite buildings must already exist.
 * - Racial-unique buildings may only be built by the matching species.
 *
 * @param species - The empire's species. Required for racial building checks;
 *   if omitted, racial restrictions are not enforced (useful for server-side
 *   replay validation where species data may not be loaded).
 * @param empireTechs - Array of researched technology IDs. When provided and
 *   the building has a `requiredTech`, the check enforces that the required
 *   tech has been researched.
 */
export function canBuildOnPlanet(
  planet: Planet,
  buildingType: BuildingType,
  species?: Species,
  empireTechs?: string[],
  targetZone: 'surface' | 'orbital' | 'underground' = 'surface',
): { allowed: boolean; reason?: string } {
  // Infer zone from building type when caller passes default 'surface'
  if (targetZone === 'surface') {
    targetZone = inferBuildingZone(buildingType);
  }
  // Gas giant restriction
  if (planet.type === 'gas_giant' && buildingType !== 'spaceport') {
    return {
      allowed: false,
      reason: 'Gas giants can only host spaceport (orbital platform) buildings',
    };
  }

  // Slot check — zone-aware (includes items already queued for construction)
  const slots = getBuildingSlots(planet);
  const zoneSlots = slots[targetZone];
  const queuedInZone = planet.productionQueue.filter(
    q => q.type === 'building' && (q.targetZone ?? 'surface') === targetZone
  ).length;
  if (zoneSlots.used + queuedInZone >= zoneSlots.total) {
    return {
      allowed: false,
      reason: targetZone === 'surface'
        ? `No surface slots available (${zoneSlots.used + queuedInZone}/${zoneSlots.total})`
        : `No ${targetZone} slots available (${zoneSlots.used + queuedInZone}/${zoneSlots.total})`,
    };
  }

  // Technology requirement check — only enforce when empireTechs is supplied
  const def = BUILDING_DEFINITIONS[buildingType];
  if (def.requiredTech !== undefined && empireTechs !== undefined) {
    if (!empireTechs.includes(def.requiredTech)) {
      return {
        allowed: false,
        reason: `Requires technology: ${def.requiredTech}`,
      };
    }
  }

  // Racial species check — only enforce when a species is supplied
  if (def.racialSpeciesId !== undefined && species !== undefined) {
    if (species.id !== def.racialSpeciesId) {
      return {
        allowed: false,
        reason: `${def.name} can only be built by the ${def.racialSpeciesId} species`,
      };
    }
  }

  // Minimum fertility check — fertility-gated food buildings
  if (def.requiredMinFertility !== undefined) {
    const planetFertility = planet.fertility ?? 0;
    if (planetFertility < def.requiredMinFertility) {
      return {
        allowed: false,
        reason: `Requires planet fertility of at least ${def.requiredMinFertility} (current: ${planetFertility})`,
      };
    }
  }

  // Prerequisite check
  const prerequisite = BUILDING_PREREQUISITES[buildingType];
  if (prerequisite !== undefined) {
    const hasPrereq = planet.buildings.some(b => b.type === prerequisite);
    if (!hasPrereq) {
      return {
        allowed: false,
        reason: `Requires ${prerequisite} to be built first`,
      };
    }
  }

  return { allowed: true };
}

// ── Construction queue ──────────────────────────────────────────────────────

/**
 * Infer the correct building zone from the building type name.
 * - 'underground_complex' → 'underground'  (zone infrastructure)
 * - 'orbital_platform', 'orbital_waste_ejector' → 'orbital'  (orbital infrastructure)
 * - Everything else → 'surface'
 *
 * Note: Racial buildings like 'deep_hive' or 'tunnel_network' use surface slots
 * despite their underground theme — only the zone infrastructure buildings
 * (underground_complex, orbital_platform, orbital_waste_ejector) auto-route.
 */
export function inferBuildingZone(
  buildingType: string,
): 'surface' | 'orbital' | 'underground' {
  // Underground complex is built on the SURFACE (it's the excavation entrance).
  // Once built, it PROVIDES underground slots for other buildings.
  // It must NOT require underground slots to build — that's circular.
  if (buildingType === 'underground_complex') {
    return 'surface';
  }
  if (buildingType === 'orbital_platform' || buildingType === 'orbital_waste_ejector') {
    return 'orbital';
  }
  return 'surface';
}

/**
 * Adds a building to the planet's production queue.
 * Returns a new Planet — does not mutate the original.
 *
 * @param species - The empire's species. When provided, racial building
 *   restrictions are enforced before queuing.
 * @param empireTechs - Array of researched technology IDs. When provided,
 *   technology requirements are enforced before queuing.
 */
export function addBuildingToQueue(
  planet: Planet,
  buildingType: BuildingType,
  species?: Species,
  empireTechs?: string[],
  targetZone: 'surface' | 'orbital' | 'underground' = 'surface',
): Planet {
  // Infer the correct zone from the building type name when the caller passes
  // the default 'surface'.  underground_complex must go underground; orbital_platform
  // must go orbital.  This prevents save-corruption where zone-specific buildings
  // occupy the wrong slot.
  if (targetZone === 'surface') {
    targetZone = inferBuildingZone(buildingType);
  }

  const check = canBuildOnPlanet(planet, buildingType, species, empireTechs, targetZone);
  if (!check.allowed) {
    throw new Error(`Cannot queue building: ${check.reason}`);
  }

  // Use buildTime from BUILDING_DEFINITIONS (single source of truth)
  const def = BUILDING_DEFINITIONS[buildingType];
  const turnsRemaining = def?.buildTime ?? 10;

  return {
    ...planet,
    productionQueue: [
      ...planet.productionQueue,
      {
        type: 'building',
        templateId: buildingType,
        turnsRemaining,
        targetZone,
      },
    ],
  };
}

// ── Building upgrades ─────────────────────────────────────────────────────

/** Cost multiplier per level for building upgrades. */
const UPGRADE_COST_MULTIPLIER = 1.5;

function techAgeIndex(age: TechAge | string): number {
  return TECH_AGES.findIndex(a => a.name === age);
}

export function getMaxLevelForAge(
  buildingType: BuildingType,
  currentAge: TechAge,
): number {
  const def = BUILDING_DEFINITIONS[buildingType];
  const ageIdx = techAgeIndex(currentAge);
  const ageCap = ageIdx < 0 ? 1 : ageIdx + 1;
  return Math.min(ageCap, def.maxLevel);
}

export function getUpgradeCost(
  buildingType: BuildingType,
  currentLevel: number,
): Partial<EmpireResources> {
  const def = BUILDING_DEFINITIONS[buildingType];
  const result: Partial<EmpireResources> = {};
  for (const [key, base] of Object.entries(def.baseCost)) {
    if (base && base > 0) {
      result[key as keyof EmpireResources] = Math.ceil(base * currentLevel * UPGRADE_COST_MULTIPLIER);
    }
  }
  return result;
}

export function getUpgradeBuildTime(
  buildingType: BuildingType,
  currentLevel: number,
): number {
  const def = BUILDING_DEFINITIONS[buildingType];
  return Math.ceil(def.buildTime * currentLevel * UPGRADE_COST_MULTIPLIER);
}

export function canUpgradeBuilding(
  planet: Planet,
  buildingId: string,
  currentAge: TechAge,
): { allowed: boolean; reason?: string } {
  const building = planet.buildings.find(b => b.id === buildingId);
  if (!building) {
    return { allowed: false, reason: 'Building not found on this planet.' };
  }

  const def = BUILDING_DEFINITIONS[building.type];
  if (building.level >= def.maxLevel) {
    return { allowed: false, reason: `Already at maximum level (${def.maxLevel}).` };
  }

  const ageCap = getMaxLevelForAge(building.type, currentAge);
  if (building.level >= ageCap) {
    return {
      allowed: false,
      reason: `Current technology age limits this building to level ${ageCap}. Advance to the next age to unlock further upgrades.`,
    };
  }

  const alreadyQueued = planet.productionQueue.some(
    item => item.type === 'building_upgrade' && item.targetBuildingId === buildingId,
  );
  if (alreadyQueued) {
    return { allowed: false, reason: 'An upgrade for this building is already in the queue.' };
  }

  return { allowed: true };
}

export function addUpgradeToQueue(planet: Planet, buildingId: string, currentAge: TechAge): Planet {
  const check = canUpgradeBuilding(planet, buildingId, currentAge);
  if (!check.allowed) {
    throw new Error(`Cannot queue upgrade: ${check.reason}`);
  }

  const building = planet.buildings.find(b => b.id === buildingId)!;
  const turnsRemaining = getUpgradeBuildTime(building.type, building.level);

  return {
    ...planet,
    productionQueue: [
      ...planet.productionQueue,
      {
        type: 'building_upgrade' as const,
        templateId: building.type,
        turnsRemaining,
        totalTurns: turnsRemaining,
        targetBuildingId: building.id,
      },
    ],
  };
}

/**
 * Advances the construction queue by `constructionRate` turns.
 *
 * The front-of-queue item has its `turnsRemaining` decremented by
 * `constructionRate`.  When it reaches zero the building is added to
 * `planet.buildings` and removed from the queue.
 *
 * Returns a new Planet — does not mutate the original.
 */
export function processConstructionQueue(planet: Planet, constructionRate: number): Planet {
  if (planet.productionQueue.length === 0) return planet;

  const [first, ...rest] = planet.productionQueue;

  // first is always defined here because of the length check above
  const item = first!;

  if (item.type === 'ship') {
    // Ship items are synced by stepShipProduction in game-loop.ts.
    // Skip them so they don't block buildings behind them in the queue.
    // Process the next non-ship item instead.
    const nonShipIdx = planet.productionQueue.findIndex(q => q.type !== 'ship');
    if (nonShipIdx < 0) return planet; // all items are ships — nothing to process
    const target = planet.productionQueue[nonShipIdx]!;
    const newTurns = target.turnsRemaining - constructionRate;

    if (target.type === 'building_upgrade' && target.targetBuildingId && newTurns <= 0) {
      const upgradedBuildings = planet.buildings.map(b => {
        if (b.id === target.targetBuildingId) {
          return { ...b, level: b.level + 1, condition: 100 };
        }
        return b;
      });
      return {
        ...planet,
        buildings: upgradedBuildings,
        productionQueue: planet.productionQueue.filter((_, i) => i !== nonShipIdx),
      };
    }

    if (target.type === 'building' && newTurns <= 0) {
      const newBuilding: Building = {
        id: generateId(),
        type: target.templateId as BuildingType,
        level: 1,
        slotZone: target.targetZone ?? 'surface',
      };
      return {
        ...planet,
        buildings: [...planet.buildings, newBuilding],
        productionQueue: planet.productionQueue.filter((_, i) => i !== nonShipIdx),
      };
    }

    if (newTurns <= 0) {
      return {
        ...planet,
        productionQueue: planet.productionQueue.filter((_, i) => i !== nonShipIdx),
      };
    }

    return {
      ...planet,
      productionQueue: planet.productionQueue.map((q, i) =>
        i === nonShipIdx ? { ...q, turnsRemaining: newTurns } : q,
      ),
    };
  }

  if (item.type !== 'building' && item.type !== 'building_upgrade') {
    // Defense items: decrement and remove when done
    const newTurns = Math.max(0, item.turnsRemaining - constructionRate);
    if (newTurns === 0) {
      return {
        ...planet,
        productionQueue: rest,
      };
    }
    return {
      ...planet,
      productionQueue: [{ ...item, turnsRemaining: newTurns }, ...rest],
    };
  }

  const newTurns = item.turnsRemaining - constructionRate;

  if (item.type === 'building_upgrade' && item.targetBuildingId && newTurns <= 0) {
    // Upgrade complete — increment the existing building's level and reset condition
    const upgradedBuildings = planet.buildings.map(b => {
      if (b.id === item.targetBuildingId) {
        return { ...b, level: b.level + 1, condition: 100 };
      }
      return b;
    });
    return { ...planet, buildings: upgradedBuildings, productionQueue: rest };
  }

  if (newTurns <= 0) {
    // Construction complete — add building to planet
    const newBuilding: Building = {
      id: generateId(),
      type: item.templateId as BuildingType,
      level: 1,
      slotZone: item.targetZone ?? 'surface',
    };
    return {
      ...planet,
      buildings: [...planet.buildings, newBuilding],
      productionQueue: rest,
    };
  }

  return {
    ...planet,
    productionQueue: [{ ...item, turnsRemaining: newTurns }, ...rest],
  };
}

// ── Colony stats aggregation ────────────────────────────────────────────────

/**
 * Calculate the construction points generated per tick on a planet.
 * Base rate + factory output (scaled by level and species construction trait).
 */
export function getPlanetConstructionRate(
  planet: Planet,
  species: Species,
  governmentConstructionSpeed = 1.0,
): number {
  const speciesConstructionFactor = species.traits.construction / 5;
  let factoryOutput = 0;
  for (const building of planet.buildings) {
    if (building.type === 'factory') {
      factoryOutput += FACTORY_CONSTRUCTION_OUTPUT
        * Math.pow(BUILDING_LEVEL_MULTIPLIER, building.level - 1)
        * speciesConstructionFactor;
    }
  }
  return (BASE_CONSTRUCTION_RATE + factoryOutput) * governmentConstructionSpeed;
}

/**
 * Computes a summary of a colony's current state in a single call.
 */
export function getColonyStats(planet: Planet, species: Species): ColonyStats {
  const habitability = calculateHabitability(planet, species);
  const populationGrowth = calculatePopulationGrowth(planet, species, habitability.score);
  const buildingSlots = getTotalSlots(planet);

  const firstQueueItem = planet.productionQueue.find(item => item.type === 'building');
  const turnsToNextBuilding = firstQueueItem ? firstQueueItem.turnsRemaining : null;

  return {
    habitability,
    populationGrowth,
    buildingSlots,
    turnsToNextBuilding,
  };
}
