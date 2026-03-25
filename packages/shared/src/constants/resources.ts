/** Resource-related game constants */

import type { PlanetType } from '../types/galaxy.js';
import type { ResourceProduction } from '../types/resources.js';

/** Base credits gained per population unit per tick before species economy trait */
export const BASE_TAX_RATE = 0.01;

/**
 * Additional resource production granted by each planet type on top of building output.
 * Values are added to the planet's per-tick production totals.
 */
export const PLANET_TYPE_RESOURCE_BONUSES: Record<PlanetType, Partial<ResourceProduction>> = {
  terran: {
    organics: 2,
    energy: 1,
  },
  ocean: {
    organics: 6,
    energy: 1,
  },
  desert: {
    minerals: 2,
    energy: 2,
  },
  ice: {
    exoticMaterials: 2,
    minerals: 1,
  },
  volcanic: {
    minerals: 5,
    rareElements: 3,
    energy: 2,
  },
  gas_giant: {
    exoticMaterials: 4,
    energy: 3,
  },
  barren: {
    minerals: 3,
  },
  toxic: {
    exoticMaterials: 3,
    rareElements: 2,
  },
};

/**
 * Per-level multiplier for building output.
 * A level-3 building produces BUILDING_LEVEL_MULTIPLIER^2 times the base output.
 * Applied as: baseOutput * (BUILDING_LEVEL_MULTIPLIER ^ (level - 1))
 */
export const BUILDING_LEVEL_MULTIPLIER = 1.5;

/**
 * Construction points generated per tick without any factories.
 * Ensures a colony can slowly build its first factory.
 */
export const BASE_CONSTRUCTION_RATE = 5;

/**
 * Construction points generated per factory at level 1 per tick.
 * Scaled by BUILDING_LEVEL_MULTIPLIER per level and species construction trait.
 */
export const FACTORY_CONSTRUCTION_OUTPUT = 10;

/** Credits and energy consumed per ship per tick */
export const FLEET_UPKEEP_PER_SHIP: Partial<ResourceProduction> = {
  credits: 2,
  energy: 1,
};

/** Credits and minerals consumed per building per tick (base maintenance before level scaling) */
export const BUILDING_MAINTENANCE_BASE: Partial<ResourceProduction> = {
  credits: 1,
  minerals: 0,
};
