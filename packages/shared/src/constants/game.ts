/** Game balance constants */

import type { HullClass } from '../types/ships.js';

/** Number of star systems per galaxy size */
export const GALAXY_SIZES = {
  small: 20,
  medium: 40,
  large: 80,
  huge: 120,
} as const;

export type GalaxySize = keyof typeof GALAXY_SIZES;

/** Maximum number of players in a game */
export const MAX_PLAYERS = 8;

/** Starting economic resources for each empire */
export const STARTING_CREDITS = 1000;
export const STARTING_RESEARCH_POINTS = 0;

/** Game speed multipliers (relative to normal) */
export const GAME_SPEEDS = {
  paused: 0,
  slow: 0.5,
  normal: 1,
  fast: 2,
  fastest: 4,
} as const;

export type GameSpeedName = keyof typeof GAME_SPEEDS;

/** Technology ages, in progression order */
export interface TechAgeDefinition {
  name: string;
  combatBonus: number;      // Flat bonus to all combat rolls for empires in this age
  unlockedHulls: HullClass[];
}

export const TECH_AGES: TechAgeDefinition[] = [
  {
    name: 'nano_atomic',
    combatBonus: 0,
    unlockedHulls: ['scout', 'transport'],
  },
  {
    name: 'fusion',
    combatBonus: 5,
    unlockedHulls: ['scout', 'transport', 'destroyer'],
  },
  {
    name: 'nano_fusion',
    combatBonus: 10,
    unlockedHulls: ['scout', 'transport', 'destroyer', 'cruiser'],
  },
  {
    name: 'anti_matter',
    combatBonus: 20,
    unlockedHulls: ['scout', 'transport', 'destroyer', 'cruiser', 'carrier'],
  },
  {
    name: 'singularity',
    combatBonus: 35,
    unlockedHulls: ['scout', 'transport', 'destroyer', 'cruiser', 'carrier', 'battleship'],
  },
];

/** Planet attribute ranges */
export const PLANET_GRAVITY_MIN = 0.1;
export const PLANET_GRAVITY_MAX = 3.0;

export const PLANET_TEMPERATURE_MIN = 50;   // Kelvin (near-absolute-zero outer systems)
export const PLANET_TEMPERATURE_MAX = 1500; // Kelvin (volcanic/lava worlds)

export const PLANET_NATURAL_RESOURCES_MIN = 0;
export const PLANET_NATURAL_RESOURCES_MAX = 100;

export const PLANET_POPULATION_MIN = 0;
export const PLANET_POPULATION_MAX = 10_000_000_000; // 10 billion

/** Diplomatic attitude range */
export const ATTITUDE_MIN = -100;
export const ATTITUDE_MAX = 100;

/** Species trait range */
export const SPECIES_TRAIT_MIN = 1;
export const SPECIES_TRAIT_MAX = 10;
