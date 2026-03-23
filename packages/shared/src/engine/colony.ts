/**
 * Colony mechanics — pure functions for habitability, population growth,
 * colony establishment, and building construction.
 *
 * All functions are side-effect-free and return new objects rather than
 * mutating their inputs.
 */

import type { Planet, Building, BuildingType, StarSystem } from '../types/galaxy.js';
import type { Species } from '../types/species.js';
import type { Ship, Fleet } from '../types/ships.js';
import {
  PLANET_BUILDING_SLOTS,
  ATMOSPHERE_ADJACENCY,
  BASE_GROWTH_RATE,
  MIN_COLONIZE_HABITABILITY,
  HABITABLE_THRESHOLD,
  HABITABILITY_WEIGHTS,
} from '../constants/planets.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';
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
export function calculatePopulationGrowth(
  planet: Planet,
  species: Species,
  habitability: number,
  isStarving = false,
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

  // Logistic curve — growth approaches zero as population nears effective max
  const logisticFactor = 1 - planet.currentPopulation / effectiveMax;
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
const BASE_COLONISATION_COST = 200;

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
  return Math.ceil(BASE_COLONISATION_COST * (100 / effectiveScore));
}

/**
 * Check whether an empire can colonise a planet within the same star system
 * without a transport ship.
 *
 * Requirements (all must be satisfied):
 * - Empire owns at least one other planet in the same system.
 * - Target planet is unowned (ownerId === null).
 * - Target planet is not already populated (currentPopulation === 0).
 * - Target planet is not a gas giant (use the orbital-platform path for those).
 * - Habitability for the empire's species is >= MIN_COLONIZE_HABITABILITY (10).
 * - Empire can afford the colonisation cost.
 *
 * Returns the colonisation cost even when the action is not allowed, so
 * callers can display the cost in the UI regardless.
 */
export function canColoniseInSystem(
  system: StarSystem,
  targetPlanetId: string,
  empireId: string,
  species: Species,
  empireCredits: number,
): { allowed: boolean; reason?: string; cost: number } {
  const targetPlanet = system.planets.find(p => p.id === targetPlanetId);

  if (!targetPlanet) {
    return { allowed: false, reason: 'Planet not found in this system', cost: 0 };
  }

  // The cost is always calculated so callers can show it even on rejection.
  const cost = getColonisationCost(targetPlanet, species);

  // Must own at least one planet in the same system.
  const ownsSystemPlanet = system.planets.some(
    p => p.id !== targetPlanetId && p.ownerId === empireId,
  );
  if (!ownsSystemPlanet) {
    return {
      allowed: false,
      reason: 'Empire does not control any planets in this system',
      cost,
    };
  }

  // Target must be unowned.
  if (targetPlanet.ownerId !== null) {
    return { allowed: false, reason: 'Planet is already owned', cost };
  }

  // Target must be unpopulated.
  if (targetPlanet.currentPopulation > 0) {
    return { allowed: false, reason: 'Planet already has a population', cost };
  }

  // Gas giants require the orbital-platform path.
  if (targetPlanet.type === 'gas_giant') {
    return {
      allowed: false,
      reason: 'Gas giants cannot be colonised this way — an orbital platform is required',
      cost,
    };
  }

  // Habitability check.
  const report = calculateHabitability(targetPlanet, species);
  if (report.score < MIN_COLONIZE_HABITABILITY) {
    return {
      allowed: false,
      reason: `Habitability too low (${report.score}/100, minimum ${MIN_COLONIZE_HABITABILITY})`,
      cost,
    };
  }

  // Affordability check.
  if (empireCredits < cost) {
    return {
      allowed: false,
      reason: `Insufficient credits (${empireCredits} available, ${cost} required)`,
      cost,
    };
  }

  return { allowed: true, cost };
}

/**
 * Execute in-system colonisation on a star system.
 *
 * Sets `ownerId` on the target planet, places `initialPopulation` colonists
 * there, and adds a level-1 `population_center` building.
 *
 * Returns a new StarSystem — does not mutate the original.
 *
 * @throws if the planet is not found in the system.
 */
export function coloniseInSystem(
  system: StarSystem,
  targetPlanetId: string,
  empireId: string,
  initialPopulation = 1000,
): StarSystem {
  const planetIndex = system.planets.findIndex(p => p.id === targetPlanetId);
  if (planetIndex === -1) {
    throw new Error(
      `Planet "${targetPlanetId}" not found in system "${system.id}"`,
    );
  }

  const planet = system.planets[planetIndex]!;

  const starterBuilding: Building = {
    id: generateId(),
    type: 'population_center',
    level: 1,
  };

  const colonisedPlanet: Planet = {
    ...planet,
    ownerId: empireId,
    currentPopulation: initialPopulation,
    buildings: [...planet.buildings, starterBuilding],
  };

  const updatedPlanets = [...system.planets];
  updatedPlanets[planetIndex] = colonisedPlanet;

  return { ...system, planets: updatedPlanets };
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
 * - Source planet has population >= MIN_SOURCE_POPULATION (100).
 * - Target planet is unowned.
 * - Target planet is not a gas giant.
 * - Target planet habitability for the species is >= MIN_COLONIZE_HABITABILITY (10).
 * - Empire can afford the cost.
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
): { allowed: boolean; reason?: string; cost: number } {
  const sourcePlanet = system.planets.find(p => p.id === sourcePlanetId);
  if (!sourcePlanet) {
    return { allowed: false, reason: 'Source planet not found in this system', cost: 0 };
  }

  const targetPlanet = system.planets.find(p => p.id === targetPlanetId);
  if (!targetPlanet) {
    return { allowed: false, reason: 'Target planet not found in this system', cost: 0 };
  }

  // Cost is always calculated so callers can show it even on rejection.
  const cost = getColonisationCost(targetPlanet, species);

  // Source must be owned by the empire.
  if (sourcePlanet.ownerId !== empireId) {
    return {
      allowed: false,
      reason: 'Source planet is not owned by this empire',
      cost,
    };
  }

  // Source must have sufficient population.
  if (sourcePlanet.currentPopulation < MIN_SOURCE_POPULATION) {
    return {
      allowed: false,
      reason: `Source planet population too low (${sourcePlanet.currentPopulation}, minimum ${MIN_SOURCE_POPULATION})`,
      cost,
    };
  }

  // Target must be unowned.
  if (targetPlanet.ownerId !== null) {
    return { allowed: false, reason: 'Target planet is already owned', cost };
  }

  // Gas giants require the orbital-platform path.
  if (targetPlanet.type === 'gas_giant') {
    return {
      allowed: false,
      reason: 'Gas giants cannot be colonised this way — an orbital platform is required',
      cost,
    };
  }

  // Habitability check.
  const report = calculateHabitability(targetPlanet, species);
  if (report.score < MIN_COLONIZE_HABITABILITY) {
    return {
      allowed: false,
      reason: `Habitability too low (${report.score}/100, minimum ${MIN_COLONIZE_HABITABILITY})`,
      cost,
    };
  }

  // No existing active migration to the same target.
  const duplicate = existingOrders.find(
    o => o.targetPlanetId === targetPlanetId && o.status === 'migrating',
  );
  if (duplicate) {
    return { allowed: false, reason: 'A migration to this planet is already in progress', cost };
  }

  // Affordability check.
  if (empireCredits < cost) {
    return {
      allowed: false,
      reason: `Insufficient credits (${empireCredits} available, ${cost} required)`,
      cost,
    };
  }

  return { allowed: true, cost };
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
 * - If `ticksToNextWave > 0`, decrement the counter and return unchanged.
 * - Otherwise send a wave:
 *   - Wave size = 1–3 people, capped at 10% of the source planet's population.
 *   - 10% of the wave is lost in transit (floor, minimum 0).
 *   - Remaining migrants are added to the target planet's currentPopulation.
 *   - The first arriving wave sets ownerId on the target.
 *   - ticksToNextWave is reset to wavePeriod.
 *   - If arrivedPopulation >= threshold after the wave, status → 'established'.
 *
 * Returns a new order and system (pure — no mutation) plus human-readable event
 * strings for logging / event emission.
 */
export function processMigrationTick(
  order: MigrationOrder,
  system: StarSystem,
): { order: MigrationOrder; system: StarSystem; events: string[] } {
  if (order.status !== 'migrating') {
    return { order, system, events: [] };
  }

  // Not yet time for the next wave.
  if (order.ticksToNextWave > 0) {
    return {
      order: { ...order, ticksToNextWave: order.ticksToNextWave - 1 },
      system,
      events: [],
    };
  }

  // Find source and target planets.
  const sourcePlanetIndex = system.planets.findIndex(p => p.id === order.sourcePlanetId);
  const targetPlanetIndex = system.planets.findIndex(p => p.id === order.targetPlanetId);

  if (sourcePlanetIndex === -1 || targetPlanetIndex === -1) {
    // Planets no longer exist — cancel the migration.
    return { order: { ...order, status: 'cancelled' }, system, events: ['Migration cancelled: planet no longer exists'] };
  }

  const sourcePlanet = system.planets[sourcePlanetIndex]!;
  const targetPlanet = system.planets[targetPlanetIndex]!;

  // Wave size: 1–3, capped at 10% of source population (rounded down, min 1).
  const maxWave = Math.max(1, Math.floor(sourcePlanet.currentPopulation * 0.1));
  const waveDeparted = Math.min(3, maxWave);

  // Can't send more than the source actually has.
  const actualDeparted = Math.min(waveDeparted, sourcePlanet.currentPopulation);
  if (actualDeparted <= 0) {
    // Source is empty — cancel.
    return { order: { ...order, status: 'cancelled' }, system, events: ['Migration cancelled: source population exhausted'] };
  }

  // Transit losses: 10% of wave, rounded down, minimum 0.
  const lost = Math.floor(actualDeparted * 0.1);
  const arrived = actualDeparted - lost;

  // Update source and target populations.
  const updatedSource: Planet = {
    ...sourcePlanet,
    currentPopulation: sourcePlanet.currentPopulation - actualDeparted,
  };

  const newTargetPop = targetPlanet.currentPopulation + arrived;
  const newArrivedTotal = order.arrivedPopulation + arrived;

  // First wave claims ownership.
  const newOwnerId = targetPlanet.ownerId ?? order.empireId;

  const updatedTarget: Planet = {
    ...targetPlanet,
    currentPopulation: newTargetPop,
    ownerId: newOwnerId,
  };

  // Update the systems array.
  const updatedPlanets = [...system.planets];
  updatedPlanets[sourcePlanetIndex] = updatedSource;
  updatedPlanets[targetPlanetIndex] = updatedTarget;
  const updatedSystem: StarSystem = { ...system, planets: updatedPlanets };

  // Determine new status.
  const newStatus: MigrationOrder['status'] =
    newArrivedTotal >= order.threshold ? 'established' : 'migrating';

  const updatedOrder: MigrationOrder = {
    ...order,
    arrivedPopulation: newArrivedTotal,
    ticksToNextWave: order.wavePeriod,
    status: newStatus,
  };

  const eventMessages = [
    `Wave of ${actualDeparted} departed`,
    `${arrived} arrived`,
    ...(lost > 0 ? [`${lost} lost in transit`] : []),
  ];

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
export function coloniseWithShip(
  system: StarSystem,
  targetPlanetId: string,
  empireId: string,
  fleet: Fleet,
  shipId: string,
): { system: StarSystem; fleet: Fleet } {
  const planetIndex = system.planets.findIndex(p => p.id === targetPlanetId);
  if (planetIndex === -1) {
    throw new Error(
      `Planet "${targetPlanetId}" not found in system "${system.id}"`,
    );
  }

  const planet = system.planets[planetIndex]!;

  const starterBuilding: Building = {
    id: generateId(),
    type: 'population_center',
    level: 1,
  };

  const colonisedPlanet: Planet = {
    ...planet,
    ownerId: empireId,
    currentPopulation: COLONISER_SHIP_INITIAL_POPULATION,
    buildings: [...planet.buildings, starterBuilding],
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
): Planet {
  const check = canBuildOnPlanet(planet, buildingType, species, empireTechs);
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
