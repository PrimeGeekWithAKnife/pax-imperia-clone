import type { CommodityDefinition, CommodityCategory } from '../../src/types/commodities.js';

import commoditiesData from './commodities.json' with { type: 'json' };

/** All 35 trade commodities as a typed array. */
export const COMMODITIES: CommodityDefinition[] = commoditiesData as CommodityDefinition[];

/** Lookup map from commodity ID to CommodityDefinition. */
export const COMMODITY_BY_ID: Readonly<Record<string, CommodityDefinition>> =
  Object.fromEntries(COMMODITIES.map((c) => [c.id, c]));

/** Commodities filtered by category. */
export const COMMON_COMMODITIES: CommodityDefinition[] =
  COMMODITIES.filter((c) => c.category === 'common');

export const RARE_COMMODITIES: CommodityDefinition[] =
  COMMODITIES.filter((c) => c.category === 'rare');

export const ULTRA_RARE_COMMODITIES: CommodityDefinition[] =
  COMMODITIES.filter((c) => c.category === 'ultra_rare');

/** Commodities grouped by category for convenience. */
export const COMMODITIES_BY_CATEGORY: Readonly<Record<CommodityCategory, CommodityDefinition[]>> = {
  common: COMMON_COMMODITIES,
  rare: RARE_COMMODITIES,
  ultra_rare: ULTRA_RARE_COMMODITIES,
};
