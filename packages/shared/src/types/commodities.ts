/**
 * Trade commodity types for the galactic marketplace.
 *
 * Commodities are distinct from empire-level strategic resources (credits,
 * minerals, etc.).  They are physical goods produced on planets, traded
 * between empires, and consumed by buildings, ship-yards, and populations.
 */

import type { TechAge } from './species.js';

// ── Category ──────────────────────────────────────────────────────────
export type CommodityCategory = 'common' | 'rare' | 'ultra_rare';

// ── Use tags ──────────────────────────────────────────────────────────
export type CommodityUse =
  | 'weapons'
  | 'armour'
  | 'shields'
  | 'buildings'
  | 'ships'
  | 'research'
  | 'medicine'
  | 'food'
  | 'luxury'
  | 'energy';

// ── Static definition (matches commodities.json) ─────────────────────
export interface CommodityDefinition {
  /** Unique snake_case identifier. */
  id: string;
  /** Human-readable display name (British English). */
  name: string;
  /** Rarity tier. */
  category: CommodityCategory;
  /** Flavour description (1-2 sentences). */
  description: string;
  /** Baseline price in credits on a neutral market. */
  basePrice: number;
  /** Price volatility factor (0.0 = stable, 1.0 = wildly volatile). */
  volatility: number;
  /** Tech age at which demand for this commodity first appears. */
  techAge: TechAge;
  /** Categories of use that consume this commodity. */
  usedFor: CommodityUse[];
}

// ── Market price direction ────────────────────────────────────────────
export type MarketTrend = 'rising' | 'falling' | 'stable';

// ── Runtime market state ──────────────────────────────────────────────
export interface MarketListing {
  /** References CommodityDefinition.id. */
  commodityId: string;
  /** Current per-unit price (may differ from basePrice). */
  currentPrice: number;
  /** Available units on the galactic market. */
  supply: number;
  /** Aggregate demand from member empires. */
  demand: number;
  /** Recent price direction. */
  trend: MarketTrend;
}

export interface MarketState {
  /** One listing per tradeable commodity. */
  listings: MarketListing[];
  /** Whether the galactic market is open (requires trade treaty). */
  galacticMarketOpen: boolean;
  /** Empire IDs that are members of the galactic market. */
  memberEmpires: string[];
}
