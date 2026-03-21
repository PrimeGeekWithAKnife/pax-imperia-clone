/**
 * Colony mechanics — pure functions for habitability, population growth,
 * colony establishment, and building construction.
 *
 * All functions are side-effect-free and return new objects rather than
 * mutating their inputs.
 */

import type { Planet, Building, BuildingType } from '../types/galaxy.js';
import type { Species } from '../types/species.js';
import {
  PLANET_BUILDING_SLOTS,
  ATMOSPHERE_ADJACENCY,
  BASE_GROWTH_RATE,
  MIN_COLONIZE_HABITABILITY,
  HABITABLE_THRESHOLD,
  HABITABILITY_WEIGHTS,
} from '../constants/planets.js';
import { generateId } from '../utils/id.js';

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
  const temperatureScore = Math.round(
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

  const score = clamp(atmosphereScore + gravityScore + temperatureScore, 0, 100);

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
 * Calculates the number of population units to add this turn.
 *
 * Formula (logistic):
 *   baseGrowth = pop * BASE_GROWTH_RATE * (reproduction / 5)
 *   adjusted   = baseGrowth * (habitability / 100)
 *   logistic   = adjusted * (1 - currentPop / maxPop)
 *
 * Each population_center building at level L adds +10% * L to growth.
 * Returns at least 1 when the colony is alive and below the population cap.
 */
export function calculatePopulationGrowth(
  planet: Planet,
  species: Species,
  habitability: number,
): number {
  if (planet.currentPopulation <= 0) return 0;
  if (planet.currentPopulation >= planet.maxPopulation) return 0;

  const reproductionFactor = species.traits.reproduction / 5;
  let baseGrowth = planet.currentPopulation * BASE_GROWTH_RATE * reproductionFactor;

  // Habitability modifier
  baseGrowth *= habitability / 100;

  // Population center building bonus: +10% per level per building
  for (const building of planet.buildings) {
    if (building.type === 'population_center') {
      baseGrowth *= 1 + 0.1 * building.level;
    }
  }

  // Logistic curve — growth approaches zero as population nears max
  const logisticFactor = 1 - planet.currentPopulation / planet.maxPopulation;
  let growth = baseGrowth * logisticFactor;

  // Minimum growth guarantee
  if (growth < 1) growth = 1;

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

// ── Building slot management ────────────────────────────────────────────────

/**
 * Returns the number of used and total building slots for a planet.
 */
export function getBuildingSlots(planet: Planet): { used: number; total: number } {
  const total = PLANET_BUILDING_SLOTS[planet.type];
  const used = planet.buildings.length;
  return { used, total };
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
 * - Prerequisite buildings must already exist.
 */
export function canBuildOnPlanet(
  planet: Planet,
  buildingType: BuildingType,
): { allowed: boolean; reason?: string } {
  // Gas giant restriction
  if (planet.type === 'gas_giant' && buildingType !== 'spaceport') {
    return {
      allowed: false,
      reason: 'Gas giants can only host spaceport (orbital platform) buildings',
    };
  }

  // Slot check
  const slots = getBuildingSlots(planet);
  if (slots.used >= slots.total) {
    return {
      allowed: false,
      reason: `No building slots available (${slots.used}/${slots.total} used)`,
    };
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
 * Adds a building to the planet's production queue.
 * Returns a new Planet — does not mutate the original.
 */
export function addBuildingToQueue(planet: Planet, buildingType: BuildingType): Planet {
  const check = canBuildOnPlanet(planet, buildingType);
  if (!check.allowed) {
    throw new Error(`Cannot queue building: ${check.reason}`);
  }

  // Default construction time in turns (could later come from tech tree /
  // constants, but kept simple for now)
  const BASE_BUILD_TURNS: Record<BuildingType, number> = {
    population_center: 5,
    factory: 4,
    research_lab: 6,
    spaceport: 8,
    shipyard: 10,
    trade_hub: 6,
    defense_grid: 7,
    mining_facility: 4,
  };

  const turnsRemaining = BASE_BUILD_TURNS[buildingType];

  return {
    ...planet,
    productionQueue: [
      ...planet.productionQueue,
      {
        type: 'building',
        templateId: buildingType,
        turnsRemaining,
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

  if (item.type !== 'building') {
    // Non-building items (ships, defenses) are not handled by this function
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

  if (newTurns <= 0) {
    // Construction complete — add building to planet
    const newBuilding: Building = {
      id: generateId(),
      type: item.templateId as BuildingType,
      level: 1,
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
 * Computes a summary of a colony's current state in a single call.
 */
export function getColonyStats(planet: Planet, species: Species): ColonyStats {
  const habitability = calculateHabitability(planet, species);
  const populationGrowth = calculatePopulationGrowth(planet, species, habitability.score);
  const buildingSlots = getBuildingSlots(planet);

  const firstQueueItem = planet.productionQueue.find(item => item.type === 'building');
  const turnsToNextBuilding = firstQueueItem ? firstQueueItem.turnsRemaining : null;

  return {
    habitability,
    populationGrowth,
    buildingSlots,
    turnsToNextBuilding,
  };
}
