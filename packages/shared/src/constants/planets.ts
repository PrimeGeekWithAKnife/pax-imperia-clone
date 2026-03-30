/** Planet-related game constants */

import type { PlanetType, PlanetSize, AtmosphereType } from '../types/galaxy.js';

// ── Building slot limits ────────────────────────────────────────────────────

/**
 * Legacy type-based slot limits — still used as a fallback when planet.size
 * is not set (e.g. old save files).
 */
export const PLANET_BUILDING_SLOTS: Record<PlanetType, number> = {
  terran: 20,
  ocean: 15,
  desert: 16,
  ice: 12,
  volcanic: 14,
  gas_giant: 8,
  barren: 10,
  toxic: 11,
};

/**
 * Planet size tiers and their base surface building slot counts.
 */
export const PLANET_SIZE_SLOTS: Record<PlanetSize, number> = {
  colossal: 21,
  gigantic: 19,
  very_large: 17,
  large: 15,
  above_average: 13,
  average: 11,
  below_average: 9,
  small: 7,
  very_small: 5,
  tiny: 3,
};

export const PLANET_SIZE_LABELS: Record<PlanetSize, string> = {
  colossal: 'Colossal',
  gigantic: 'Gigantic',
  very_large: 'Very Large',
  large: 'Large',
  above_average: 'Above Average',
  average: 'Average',
  below_average: 'Below Average',
  small: 'Small',
  very_small: 'Very Small',
  tiny: 'Tiny',
};

/** All sizes ordered largest to smallest for generation weighting. */
export const PLANET_SIZES: PlanetSize[] = [
  'colossal', 'gigantic', 'very_large', 'large', 'above_average',
  'average', 'below_average', 'small', 'very_small', 'tiny',
];

// ── Atmosphere compatibility ────────────────────────────────────────────────

/**
 * "Adjacent" atmospheres are partially compatible with each other, granting
 * half the atmosphere habitability score rather than zero.  Each entry lists
 * the atmospheres that are considered one step away from the key atmosphere.
 */
export const ATMOSPHERE_ADJACENCY: Partial<Record<AtmosphereType, AtmosphereType[]>> = {
  oxygen_nitrogen: ['carbon_dioxide'],
  carbon_dioxide: ['oxygen_nitrogen', 'methane'],
  methane: ['carbon_dioxide', 'ammonia'],
  ammonia: ['methane', 'toxic'],
  hydrogen_helium: [],
  none: [],
  toxic: ['ammonia'],
};

// ── Growth constants ────────────────────────────────────────────────────────

/** Base fractional growth per turn before trait and habitability modifiers. */
export const BASE_GROWTH_RATE = 0.005;

/** Minimum population at which a colony is considered active. */
export const MIN_COLONY_POPULATION = 1;

/** Minimum habitability score required to establish a colony. */
export const MIN_COLONIZE_HABITABILITY = 10;

/** Minimum habitability score for a world to be considered "habitable" by the
 *  species (used for the `isHabitable` flag in HabitabilityReport). */
export const HABITABLE_THRESHOLD = 20;

// ── Habitability scoring weights ────────────────────────────────────────────

/** Maximum score contribution from each environmental axis (must sum to 100). */
export const HABITABILITY_WEIGHTS = {
  atmosphere: 40,
  gravity: 30,
  temperature: 30,
} as const;
