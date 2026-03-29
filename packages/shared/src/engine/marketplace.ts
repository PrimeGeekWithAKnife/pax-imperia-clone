/**
 * Commodity marketplace engine — pure functions for local and galactic markets,
 * price discovery, trade orders, sanctions, and economic warfare.
 *
 * All functions are side-effect free. Callers must persist any state changes
 * returned from these functions.
 *
 * Two-tier market system:
 *  - Local markets exist per empire from game start (domestic prices only).
 *  - The galactic market opens via the council; member empires share a unified
 *    marketplace with a reserve currency. Non-members trade at an exchange rate
 *    penalty.
 *
 * Price model:
 *  - price = basePrice * (demand / supply) * volatilityFactor
 *  - Prices respond gradually (5–10 tick lag) to supply/demand shocks.
 *  - Blockaded empires genuinely cannot access affected market segments.
 *
 * Design intent: the galactic market is not a magic shop — it reflects real
 * production and consumption across member economies. Market manipulation
 * (flooding, hoarding, dumping) is intended gameplay.
 */

import { generateId } from '../utils/id.js';
import { clamp } from '../utils/math.js';

// ---------------------------------------------------------------------------
// Local types — self-contained so we do not depend on timing of other agents
// ---------------------------------------------------------------------------

/** Trend direction for a commodity's price movement. */
export type PriceTrend = 'rising' | 'stable' | 'falling';

/** Type of market manipulation action. */
export type ManipulationAction = 'flood' | 'hoard' | 'dump';

/** A single commodity listing on a market. */
export interface MarketListing {
  commodityId: string;
  currentPrice: number;
  basePrice: number;
  supply: number;
  demand: number;
  trend: PriceTrend;
  /** Price volatility multiplier (0.0 = perfectly stable, 1.0 = highly volatile). */
  volatility: number;
  /** Rolling price history for the last N ticks, used for trend calculation. */
  priceHistory: number[];
}

/** Per-empire local market. */
export interface LocalMarket {
  empireId: string;
  listings: MarketListing[];
  lastUpdatedTick: number;
  /** Commodity IDs this empire is blocked from accessing (via sanctions/blockade). */
  blockedCommodities: Set<string>;
  /** Empire IDs that have sanctioned this empire. */
  sanctionedBy: string[];
}

/** Unified galactic market shared by council member empires. */
export interface GalacticMarket {
  /** Whether the galactic market is open (requires council vote). */
  open: boolean;
  /** Empire IDs that are members of the galactic market. */
  memberEmpires: string[];
  listings: MarketListing[];
  /** Exchange rate between each empire's local currency and the reserve currency. */
  reserveCurrencyRate: Record<string, number>;
  lastUpdatedTick: number;
}

/** Top-level state container for the entire marketplace system. */
export interface MarketState {
  localMarkets: Map<string, LocalMarket>;
  galacticMarket: GalacticMarket;
}

/** A buy or sell order placed by an empire. */
export interface TradeOrder {
  id: string;
  empireId: string;
  commodityId: string;
  type: 'buy' | 'sell';
  quantity: number;
  /** Maximum price the buyer will pay (buy orders only). */
  maxPrice?: number;
  /** Minimum price the seller will accept (sell orders only). */
  minPrice?: number;
  fulfilled: boolean;
  /** Tick when the order was placed. */
  placedTick: number;
}

/** Events emitted by marketplace operations. */
export type MarketEvent =
  | PriceShiftEvent
  | TradeExecutedEvent
  | SanctionAppliedEvent
  | ManipulationEvent
  | MarketShockEvent;

export interface PriceShiftEvent {
  type: 'price_shift';
  commodityId: string;
  marketId: string;
  oldPrice: number;
  newPrice: number;
  trend: PriceTrend;
  tick: number;
}

export interface TradeExecutedEvent {
  type: 'trade_executed';
  buyerEmpireId: string;
  sellerEmpireId: string;
  commodityId: string;
  quantity: number;
  pricePerUnit: number;
  totalCost: number;
  tick: number;
}

export interface SanctionAppliedEvent {
  type: 'sanction_applied';
  sanctionedEmpireId: string;
  sanctioningEmpires: string[];
  tick: number;
}

export interface ManipulationEvent {
  type: 'manipulation';
  empireId: string;
  commodityId: string;
  action: ManipulationAction;
  quantity: number;
  priceImpact: number;
  tick: number;
}

export interface MarketShockEvent {
  type: 'market_shock';
  commodityId: string;
  reason: string;
  supplyDelta: number;
  demandDelta: number;
  tick: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of ticks of price history kept for trend calculation. */
const TREND_WINDOW = 5;

/** Maximum price change per tick as a fraction of current price (10%). */
const MAX_PRICE_CHANGE_RATE = 0.10;

/** Minimum price floor — commodities cannot drop below this fraction of base. */
const MIN_PRICE_RATIO = 0.1;

/** Maximum price ceiling — commodities cannot rise above this multiple of base. */
const MAX_PRICE_RATIO = 10.0;

/** Minimum supply floor so we never divide by zero. */
const MIN_SUPPLY = 0.01;

/** Fraction of supply removed per sanctioning empire (Cuba model). */
const SANCTION_SUPPLY_PENALTY = 0.15;

/** Maximum total sanction penalty — sanctions weaken but cannot alone defeat. */
const MAX_SANCTION_PENALTY = 0.60;

/**
 * How many ticks before a supply/demand shock fully propagates to price.
 * This creates the gradual 5–10 tick price response described in the spec.
 */
const PRICE_INERTIA_FACTOR = 0.15;

/** Base exchange rate for non-member empires (penalty for not joining council). */
const NON_MEMBER_EXCHANGE_PENALTY = 1.25;

/** Exchange rate floor — local currency cannot become completely worthless. */
const MIN_EXCHANGE_RATE = 0.2;

/** Exchange rate ceiling. */
const MAX_EXCHANGE_RATE = 5.0;

/** Inflation floor. */
const MIN_INFLATION = 0.9;

/** Inflation ceiling. */
const MAX_INFLATION = 1.3;

/** Order expiry — unfulfilled orders are removed after this many ticks. */
const ORDER_EXPIRY_TICKS = 20;

// ---------------------------------------------------------------------------
// Default commodity definitions (35 commodities: 20 common, 10 rare, 5 ultra-rare)
// ---------------------------------------------------------------------------

export interface CommodityDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'ultra_rare';
  basePrice: number;
  baseVolatility: number;
}

/**
 * Default commodity catalogue.
 * Another agent may provide a richer set; this is the fallback baseline.
 */
export const DEFAULT_COMMODITIES: CommodityDef[] = [
  // ── Common (20) ──────────────────────────────────────────────────────────
  { id: 'raw_ore',          name: 'Raw Ore',          rarity: 'common', basePrice: 5,   baseVolatility: 0.1 },
  { id: 'refined_metals',   name: 'Refined Metals',   rarity: 'common', basePrice: 12,  baseVolatility: 0.15 },
  { id: 'food_stocks',      name: 'Food Stocks',      rarity: 'common', basePrice: 8,   baseVolatility: 0.2 },
  { id: 'water',            name: 'Water',            rarity: 'common', basePrice: 4,   baseVolatility: 0.1 },
  { id: 'textiles',         name: 'Textiles',         rarity: 'common', basePrice: 6,   baseVolatility: 0.1 },
  { id: 'chemicals',        name: 'Chemicals',        rarity: 'common', basePrice: 10,  baseVolatility: 0.15 },
  { id: 'polymers',         name: 'Polymers',         rarity: 'common', basePrice: 9,   baseVolatility: 0.12 },
  { id: 'construction_mat', name: 'Construction Materials', rarity: 'common', basePrice: 11, baseVolatility: 0.15 },
  { id: 'electronics',      name: 'Electronics',      rarity: 'common', basePrice: 15,  baseVolatility: 0.18 },
  { id: 'medical_supplies', name: 'Medical Supplies',  rarity: 'common', basePrice: 14,  baseVolatility: 0.2 },
  { id: 'fuel_cells',       name: 'Fuel Cells',       rarity: 'common', basePrice: 10,  baseVolatility: 0.15 },
  { id: 'luxury_goods',     name: 'Luxury Goods',     rarity: 'common', basePrice: 20,  baseVolatility: 0.25 },
  { id: 'machinery',        name: 'Machinery',        rarity: 'common', basePrice: 18,  baseVolatility: 0.15 },
  { id: 'fertiliser',       name: 'Fertiliser',       rarity: 'common', basePrice: 7,   baseVolatility: 0.12 },
  { id: 'consumer_goods',   name: 'Consumer Goods',   rarity: 'common', basePrice: 12,  baseVolatility: 0.18 },
  { id: 'munitions',        name: 'Munitions',        rarity: 'common', basePrice: 16,  baseVolatility: 0.2 },
  { id: 'ceramics',         name: 'Ceramics',         rarity: 'common', basePrice: 8,   baseVolatility: 0.1 },
  { id: 'alloys',           name: 'Alloys',           rarity: 'common', basePrice: 14,  baseVolatility: 0.15 },
  { id: 'composites',       name: 'Composites',       rarity: 'common', basePrice: 13,  baseVolatility: 0.14 },
  { id: 'energy_crystals',  name: 'Energy Crystals',  rarity: 'common', basePrice: 17,  baseVolatility: 0.2 },

  // ── Rare (10) ────────────────────────────────────────────────────────────
  { id: 'quantum_processors', name: 'Quantum Processors', rarity: 'rare', basePrice: 50,  baseVolatility: 0.3 },
  { id: 'antimatter',         name: 'Antimatter',         rarity: 'rare', basePrice: 65,  baseVolatility: 0.35 },
  { id: 'dark_matter_residue', name: 'Dark Matter Residue', rarity: 'rare', basePrice: 80, baseVolatility: 0.4 },
  { id: 'neural_implants',    name: 'Neural Implants',    rarity: 'rare', basePrice: 55,  baseVolatility: 0.3 },
  { id: 'bioweapons',         name: 'Bioweapons',         rarity: 'rare', basePrice: 70,  baseVolatility: 0.35 },
  { id: 'graviton_lenses',    name: 'Graviton Lenses',    rarity: 'rare', basePrice: 60,  baseVolatility: 0.32 },
  { id: 'psionic_crystals',   name: 'Psionic Crystals',   rarity: 'rare', basePrice: 75,  baseVolatility: 0.38 },
  { id: 'nanofibre',          name: 'Nanofibre',          rarity: 'rare', basePrice: 45,  baseVolatility: 0.28 },
  { id: 'terraforming_agents', name: 'Terraforming Agents', rarity: 'rare', basePrice: 58, baseVolatility: 0.3 },
  { id: 'cloaking_material',  name: 'Cloaking Material',  rarity: 'rare', basePrice: 72,  baseVolatility: 0.36 },

  // ── Ultra-rare (5) ──────────────────────────────────────────────────────
  { id: 'singularity_cores',  name: 'Singularity Cores',  rarity: 'ultra_rare', basePrice: 200, baseVolatility: 0.5 },
  { id: 'temporal_shards',    name: 'Temporal Shards',    rarity: 'ultra_rare', basePrice: 250, baseVolatility: 0.55 },
  { id: 'void_essence',       name: 'Void Essence',       rarity: 'ultra_rare', basePrice: 300, baseVolatility: 0.6 },
  { id: 'precursor_artefacts', name: 'Precursor Artefacts', rarity: 'ultra_rare', basePrice: 275, baseVolatility: 0.5 },
  { id: 'dyson_components',   name: 'Dyson Components',   rarity: 'ultra_rare', basePrice: 350, baseVolatility: 0.45 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-copy a MarketState so mutations do not escape pure functions.
 * Maps and Sets are cloned manually; listing arrays are shallow-copied.
 */
function copyState(state: MarketState): MarketState {
  const localMarkets = new Map<string, LocalMarket>();
  for (const [empireId, market] of state.localMarkets) {
    localMarkets.set(empireId, {
      ...market,
      listings: market.listings.map((l) => ({
        ...l,
        priceHistory: [...l.priceHistory],
      })),
      blockedCommodities: new Set(market.blockedCommodities),
      sanctionedBy: [...market.sanctionedBy],
    });
  }

  const galacticMarket: GalacticMarket = {
    ...state.galacticMarket,
    memberEmpires: [...state.galacticMarket.memberEmpires],
    listings: state.galacticMarket.listings.map((l) => ({
      ...l,
      priceHistory: [...l.priceHistory],
    })),
    reserveCurrencyRate: { ...state.galacticMarket.reserveCurrencyRate },
  };

  return { localMarkets, galacticMarket };
}

/**
 * Create a default MarketListing for a commodity definition.
 * Supply and demand start at equilibrium (1:1) so initial price = basePrice.
 */
function createListing(def: CommodityDef): MarketListing {
  return {
    commodityId: def.id,
    currentPrice: def.basePrice,
    basePrice: def.basePrice,
    supply: 100,
    demand: 100,
    trend: 'stable',
    volatility: def.baseVolatility,
    priceHistory: [def.basePrice],
  };
}

/**
 * Calculate a new price from supply, demand, base price, and volatility.
 * Applies inertia so that prices move gradually rather than snapping.
 */
function calculatePrice(
  listing: MarketListing,
  rng: () => number,
): number {
  const effectiveSupply = Math.max(listing.supply, MIN_SUPPLY);
  const ratio = listing.demand / effectiveSupply;

  // Target price before volatility noise
  const targetPrice = listing.basePrice * ratio;

  // Volatility adds a small random perturbation
  const noise = 1.0 + (rng() - 0.5) * listing.volatility * 0.1;
  const noisyTarget = targetPrice * noise;

  // Inertia: move only a fraction toward the noisy target each tick
  const delta = (noisyTarget - listing.currentPrice) * PRICE_INERTIA_FACTOR;

  // Clamp the per-tick change to MAX_PRICE_CHANGE_RATE of current price
  const maxDelta = listing.currentPrice * MAX_PRICE_CHANGE_RATE;
  const clampedDelta = clamp(delta, -maxDelta, maxDelta);

  const newPrice = listing.currentPrice + clampedDelta;

  // Enforce absolute price bounds
  const minPrice = listing.basePrice * MIN_PRICE_RATIO;
  const maxPrice = listing.basePrice * MAX_PRICE_RATIO;
  return clamp(newPrice, minPrice, maxPrice);
}

/**
 * Determine the trend direction based on price history.
 * Compares the average of the most recent half of the window against the
 * older half. A >2% difference triggers a trend change.
 */
function determineTrend(history: number[]): PriceTrend {
  if (history.length < 3) return 'stable';

  const mid = Math.floor(history.length / 2);
  const recentSlice = history.slice(mid);
  const olderSlice = history.slice(0, mid);

  const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;
  const olderAvg = olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length;

  const changePct = (recentAvg - olderAvg) / (olderAvg || 1);

  if (changePct > 0.02) return 'rising';
  if (changePct < -0.02) return 'falling';
  return 'stable';
}

/**
 * Push a price onto the history ring buffer, keeping at most TREND_WINDOW entries.
 */
function pushHistory(history: number[], price: number): number[] {
  const next = [...history, price];
  if (next.length > TREND_WINDOW) {
    return next.slice(next.length - TREND_WINDOW);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Public API — state initialisation
// ---------------------------------------------------------------------------

/**
 * Create the initial MarketState for a new game.
 *
 * Each empire receives a local market with listings for all 35 default
 * commodities at their base prices. The galactic market starts closed.
 *
 * @param empireIds - IDs of all empires in the game.
 * @param commodities - Optional commodity catalogue override. Defaults to
 *   the built-in 35-commodity set.
 * @returns A fresh MarketState.
 */
export function initialiseMarketState(
  empireIds: string[],
  commodities: CommodityDef[] = DEFAULT_COMMODITIES,
): MarketState {
  const localMarkets = new Map<string, LocalMarket>();

  for (const empireId of empireIds) {
    localMarkets.set(empireId, {
      empireId,
      listings: commodities.map(createListing),
      lastUpdatedTick: 0,
      blockedCommodities: new Set(),
      sanctionedBy: [],
    });
  }

  const galacticMarket: GalacticMarket = {
    open: false,
    memberEmpires: [],
    listings: commodities.map(createListing),
    reserveCurrencyRate: {},
    lastUpdatedTick: 0,
  };

  return { localMarkets, galacticMarket };
}

// ---------------------------------------------------------------------------
// Public API — per-tick processing
// ---------------------------------------------------------------------------

/**
 * Minimal empire snapshot needed by the marketplace engine.
 * We accept a simple interface rather than importing the full Empire type,
 * keeping the engine decoupled.
 */
export interface MarketEmpireView {
  id: string;
  /** Total credits in the empire treasury. */
  credits: number;
  /** Population across all colonies. */
  totalPopulation: number;
  /** Number of active trade hubs. */
  tradeHubCount: number;
  /** Number of factories — drives demand for raw materials. */
  factoryCount: number;
  /** Number of mining facilities — drives commodity supply. */
  miningFacilityCount: number;
  /** Number of research labs — drives demand for rare commodities. */
  researchLabCount: number;
  /** Number of shipyards — drives demand for alloys, composites, etc. */
  shipyardCount: number;
  /** Whether the empire is currently blockaded (any system). */
  isBlockaded: boolean;
}

/**
 * Minimal trade route snapshot for supply/demand effects.
 */
export interface MarketTradeRouteView {
  empireId: string;
  partnerEmpireId: string;
  status: 'active' | 'disrupted' | 'blockaded' | 'establishing' | 'rerouting' | 'cancelled';
}

/**
 * Process one game tick for the entire marketplace.
 *
 * Steps:
 *  1. Update supply based on empire production (mining, factories).
 *  2. Update demand based on consumption (population, buildings, ships).
 *  3. Apply disruption modifiers (blockades reduce supply, sanctions block access).
 *  4. Calculate new prices from supply/demand with inertia.
 *  5. Update trends from price history.
 *  6. If galactic market is open, aggregate member local markets.
 *  7. Update exchange rates for all empires.
 *
 * @param state - Current market state.
 * @param empires - Snapshot of all empires' economic data.
 * @param tradeRoutes - Current trade routes for disruption checking.
 * @param tick - Current game tick number.
 * @param rng - Seeded PRNG for testability.
 * @returns Updated state and any events generated this tick.
 */
export function processMarketTick(
  state: MarketState,
  empires: MarketEmpireView[],
  tradeRoutes: MarketTradeRouteView[],
  tick: number,
  rng: () => number = Math.random,
): { state: MarketState; events: MarketEvent[] } {
  const next = copyState(state);
  const events: MarketEvent[] = [];

  // Build lookup for empire data
  const empireMap = new Map<string, MarketEmpireView>();
  for (const empire of empires) {
    empireMap.set(empire.id, empire);
  }

  // Count blockaded routes per empire
  const blockadedRouteCount = new Map<string, number>();
  const activeRouteCount = new Map<string, number>();
  for (const route of tradeRoutes) {
    if (route.status === 'blockaded') {
      blockadedRouteCount.set(route.empireId, (blockadedRouteCount.get(route.empireId) ?? 0) + 1);
      blockadedRouteCount.set(route.partnerEmpireId, (blockadedRouteCount.get(route.partnerEmpireId) ?? 0) + 1);
    }
    if (route.status === 'active') {
      activeRouteCount.set(route.empireId, (activeRouteCount.get(route.empireId) ?? 0) + 1);
      activeRouteCount.set(route.partnerEmpireId, (activeRouteCount.get(route.partnerEmpireId) ?? 0) + 1);
    }
  }

  // ── Step 1–5: Update each local market ──────────────────────────────────
  for (const [empireId, market] of next.localMarkets) {
    const empire = empireMap.get(empireId);
    if (!empire) continue;

    const blocked = blockadedRouteCount.get(empireId) ?? 0;
    const active = activeRouteCount.get(empireId) ?? 0;
    const totalRoutes = blocked + active;
    // Blockade factor: fraction of routes that are blockaded (0 = none, 1 = all)
    const blockadeFactor = totalRoutes > 0 ? blocked / totalRoutes : 0;

    // Sanction penalty: each sanctioning empire reduces access by SANCTION_SUPPLY_PENALTY
    const sanctionPenalty = Math.min(
      market.sanctionedBy.length * SANCTION_SUPPLY_PENALTY,
      MAX_SANCTION_PENALTY,
    );

    for (const listing of market.listings) {
      // Skip blocked commodities entirely
      if (market.blockedCommodities.has(listing.commodityId)) continue;

      // ── Supply ──────────────────────────────────────────────────────
      // Base supply from mining and factories
      const miningSupply = empire.miningFacilityCount * 2.0;
      const factorySupply = empire.factoryCount * 1.5;
      // Trade hub bonus: each hub adds a small passive supply boost
      const tradeBoost = empire.tradeHubCount * 0.5;
      // Active routes provide supply from off-world
      const routeSupply = active * 1.0;

      let totalSupply = 10 + miningSupply + factorySupply + tradeBoost + routeSupply;

      // Rare and ultra-rare commodities have naturally lower supply
      const commodityDef = DEFAULT_COMMODITIES.find((c) => c.id === listing.commodityId);
      if (commodityDef) {
        if (commodityDef.rarity === 'rare') totalSupply *= 0.3;
        if (commodityDef.rarity === 'ultra_rare') totalSupply *= 0.1;
      }

      // Blockade reduces supply
      totalSupply *= (1 - blockadeFactor * 0.8);

      // Sanctions reduce supply
      totalSupply *= (1 - sanctionPenalty);

      // ── Demand ─────────────────────────────────────────────────────
      // Population drives base demand
      const populationDemand = Math.max(1, empire.totalPopulation / 10_000);
      // Factories consume raw materials
      const factoryDemand = empire.factoryCount * 2.0;
      // Research labs consume rare commodities
      const labDemand = empire.researchLabCount * 1.0;
      // Shipyards consume construction-grade commodities
      const shipyardDemand = empire.shipyardCount * 1.5;

      let totalDemand = 5 + populationDemand + factoryDemand + labDemand + shipyardDemand;

      // Rare commodities have higher demand relative to supply (scarcity premium)
      if (commodityDef) {
        if (commodityDef.rarity === 'rare') totalDemand *= 1.2;
        if (commodityDef.rarity === 'ultra_rare') totalDemand *= 1.5;
      }

      // ── Apply supply/demand gradually ──────────────────────────────
      // Move existing supply/demand toward target values with inertia
      listing.supply += (totalSupply - listing.supply) * PRICE_INERTIA_FACTOR;
      listing.demand += (totalDemand - listing.demand) * PRICE_INERTIA_FACTOR;
      listing.supply = Math.max(listing.supply, MIN_SUPPLY);

      // ── Price calculation ──────────────────────────────────────────
      const oldPrice = listing.currentPrice;
      listing.currentPrice = calculatePrice(listing, rng);

      // ── History and trend ──────────────────────────────────────────
      listing.priceHistory = pushHistory(listing.priceHistory, listing.currentPrice);
      listing.trend = determineTrend(listing.priceHistory);

      // Emit event for significant price shifts (>2%)
      const pctChange = Math.abs(listing.currentPrice - oldPrice) / (oldPrice || 1);
      if (pctChange > 0.02) {
        events.push({
          type: 'price_shift',
          commodityId: listing.commodityId,
          marketId: empireId,
          oldPrice,
          newPrice: listing.currentPrice,
          trend: listing.trend,
          tick,
        });
      }
    }

    market.lastUpdatedTick = tick;
  }

  // ── Step 6: Galactic market aggregation ─────────────────────────────────
  if (next.galacticMarket.open && next.galacticMarket.memberEmpires.length > 0) {
    aggregateGalacticMarket(next, rng);
    next.galacticMarket.lastUpdatedTick = tick;
  }

  // ── Step 7: Exchange rates ──────────────────────────────────────────────
  for (const empire of empires) {
    next.galacticMarket.reserveCurrencyRate[empire.id] = computeExchangeRate(
      empire,
      next.galacticMarket,
      empires,
    );
  }

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// Public API — trade orders
// ---------------------------------------------------------------------------

/**
 * Place a new buy or sell order on the market.
 *
 * The order is validated against market access rules:
 *  - Sanctioned empires cannot buy from sanctioning empires' markets.
 *  - Blockaded empires cannot place orders for blocked commodities.
 *
 * @param state - Current market state.
 * @param order - The trade order to place (id will be generated if empty).
 * @param tick - Current game tick.
 * @returns Updated state and events, or an error event if the order is rejected.
 */
export function placeTradeOrder(
  state: MarketState,
  order: Omit<TradeOrder, 'id' | 'fulfilled' | 'placedTick'> & { id?: string },
  tick: number,
): { state: MarketState; events: MarketEvent[]; order: TradeOrder | null; error?: string } {
  const next = copyState(state);
  const events: MarketEvent[] = [];

  const localMarket = next.localMarkets.get(order.empireId);
  if (!localMarket) {
    return { state: next, events, order: null, error: 'Empire has no local market' };
  }

  // Check commodity access
  if (localMarket.blockedCommodities.has(order.commodityId)) {
    return {
      state: next,
      events,
      order: null,
      error: `Empire ${order.empireId} is blocked from accessing ${order.commodityId}`,
    };
  }

  const fullOrder: TradeOrder = {
    id: order.id ?? generateId(),
    empireId: order.empireId,
    commodityId: order.commodityId,
    type: order.type,
    quantity: Math.max(0, order.quantity),
    maxPrice: order.maxPrice,
    minPrice: order.minPrice,
    fulfilled: false,
    placedTick: tick,
  };

  return { state: next, events, order: fullOrder };
}

/**
 * Match and execute pending buy/sell orders.
 *
 * Matching algorithm:
 *  1. Group orders by commodity.
 *  2. Sort buy orders by maxPrice descending (highest bidder first).
 *  3. Sort sell orders by minPrice ascending (cheapest seller first).
 *  4. Match pairs where buyer maxPrice >= seller minPrice.
 *  5. Execution price = midpoint of buyer maxPrice and seller minPrice.
 *  6. Update market supply/demand based on executed trades.
 *
 * Only orders between empires with physical trade routes can be fulfilled.
 *
 * @param state - Current market state.
 * @param orders - Pending trade orders to process.
 * @param tradeRoutes - Current trade routes (orders need a route to be fulfilled).
 * @param tick - Current game tick.
 * @returns Updated state, fulfilled orders, and trade events.
 */
export function fulfillOrders(
  state: MarketState,
  orders: TradeOrder[],
  tradeRoutes: MarketTradeRouteView[],
  tick: number,
): { state: MarketState; events: MarketEvent[]; orders: TradeOrder[] } {
  const next = copyState(state);
  const events: MarketEvent[] = [];
  const updatedOrders = orders.map((o) => ({ ...o }));

  // Build route connectivity lookup: can empireA trade with empireB?
  const canTrade = new Set<string>();
  for (const route of tradeRoutes) {
    if (route.status === 'active') {
      canTrade.add(`${route.empireId}:${route.partnerEmpireId}`);
      canTrade.add(`${route.partnerEmpireId}:${route.empireId}`);
    }
  }

  // Also allow internal market trades (same empire)
  const allEmpireIds = new Set(updatedOrders.map((o) => o.empireId));
  for (const id of allEmpireIds) {
    canTrade.add(`${id}:${id}`);
  }

  // Group by commodity
  const byCommodity = new Map<string, { buys: TradeOrder[]; sells: TradeOrder[] }>();
  for (const order of updatedOrders) {
    if (order.fulfilled) continue;

    // Expire stale orders
    if (tick - order.placedTick > ORDER_EXPIRY_TICKS) {
      order.fulfilled = true;
      continue;
    }

    let group = byCommodity.get(order.commodityId);
    if (!group) {
      group = { buys: [], sells: [] };
      byCommodity.set(order.commodityId, group);
    }

    if (order.type === 'buy') {
      group.buys.push(order);
    } else {
      group.sells.push(order);
    }
  }

  // Match orders for each commodity
  for (const [commodityId, group] of byCommodity) {
    // Sort: best buyers first, cheapest sellers first
    group.buys.sort((a, b) => (b.maxPrice ?? Infinity) - (a.maxPrice ?? Infinity));
    group.sells.sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0));

    let sellIdx = 0;
    for (const buyOrder of group.buys) {
      if (buyOrder.fulfilled) continue;

      let remainingQty = buyOrder.quantity;

      while (remainingQty > 0 && sellIdx < group.sells.length) {
        const sellOrder = group.sells[sellIdx];
        if (sellOrder.fulfilled) {
          sellIdx++;
          continue;
        }

        // Check price compatibility
        const buyMax = buyOrder.maxPrice ?? Infinity;
        const sellMin = sellOrder.minPrice ?? 0;
        if (buyMax < sellMin) break; // No more compatible sellers

        // Check route connectivity
        if (!canTrade.has(`${buyOrder.empireId}:${sellOrder.empireId}`)) {
          sellIdx++;
          continue;
        }

        // Calculate fill quantity and execution price
        const fillQty = Math.min(remainingQty, sellOrder.quantity);
        const execPrice = (buyMax === Infinity && sellMin === 0)
          ? getMarketPrice(next, commodityId, buyOrder.empireId)
          : ((Math.min(buyMax, Infinity) + sellMin) / 2);

        // Execute the trade
        remainingQty -= fillQty;
        sellOrder.quantity -= fillQty;
        if (sellOrder.quantity <= 0) {
          sellOrder.fulfilled = true;
          sellIdx++;
        }

        // Update market supply/demand
        adjustMarketFromTrade(next, buyOrder.empireId, commodityId, fillQty, 'buy');
        adjustMarketFromTrade(next, sellOrder.empireId, commodityId, fillQty, 'sell');

        events.push({
          type: 'trade_executed',
          buyerEmpireId: buyOrder.empireId,
          sellerEmpireId: sellOrder.empireId,
          commodityId,
          quantity: fillQty,
          pricePerUnit: execPrice,
          totalCost: execPrice * fillQty,
          tick,
        });
      }

      if (remainingQty <= 0) {
        buyOrder.fulfilled = true;
      } else {
        buyOrder.quantity = remainingQty;
      }
    }
  }

  return { state: next, events, orders: updatedOrders };
}

// ---------------------------------------------------------------------------
// Public API — sanctions
// ---------------------------------------------------------------------------

/**
 * Apply sanctions against an empire from one or more sanctioning empires.
 *
 * Sanctions reduce the targeted empire's supply access by
 * SANCTION_SUPPLY_PENALTY per sanctioning empire, up to MAX_SANCTION_PENALTY.
 *
 * Cuba model: sanctions weaken but cannot alone defeat. The sanctioned empire
 * retains at least (1 - MAX_SANCTION_PENALTY) = 40% market access.
 *
 * @param state - Current market state.
 * @param sanctionedEmpireId - The empire being sanctioned.
 * @param sanctioningEmpires - Empire IDs imposing sanctions.
 * @param tick - Current game tick.
 * @returns Updated state with sanctions applied.
 */
export function applySanctions(
  state: MarketState,
  sanctionedEmpireId: string,
  sanctioningEmpires: string[],
  tick: number,
): { state: MarketState; events: MarketEvent[] } {
  const next = copyState(state);
  const events: MarketEvent[] = [];

  const sanctionedMarket = next.localMarkets.get(sanctionedEmpireId);
  if (!sanctionedMarket) return { state: next, events };

  // Merge new sanctioning empires with existing ones (no duplicates)
  const existingSanctions = new Set(sanctionedMarket.sanctionedBy);
  for (const empireId of sanctioningEmpires) {
    existingSanctions.add(empireId);
  }
  sanctionedMarket.sanctionedBy = [...existingSanctions];

  // Block specific rare/ultra-rare commodities from sanctioning empires
  // Each sanctioning empire blocks a few more commodity types
  const rareCommodities = DEFAULT_COMMODITIES.filter(
    (c) => c.rarity === 'rare' || c.rarity === 'ultra_rare',
  );
  const blockCount = Math.min(
    sanctionedMarket.sanctionedBy.length * 2,
    rareCommodities.length,
  );
  sanctionedMarket.blockedCommodities = new Set(
    rareCommodities.slice(0, blockCount).map((c) => c.id),
  );

  events.push({
    type: 'sanction_applied',
    sanctionedEmpireId,
    sanctioningEmpires: sanctionedMarket.sanctionedBy,
    tick,
  });

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// Public API — market manipulation (economic warfare)
// ---------------------------------------------------------------------------

/**
 * Perform a market manipulation action.
 *
 * Actions:
 *  - **flood**: Dump large quantities onto the market to crash prices.
 *    Increases supply sharply; price will fall over 5–10 ticks.
 *  - **hoard**: Remove supply from circulation to create artificial scarcity.
 *    Decreases supply; price will rise over 5–10 ticks.
 *  - **dump**: Sell at below-market rates to devalue the commodity and harm
 *    producers. Increases supply and pushes price down aggressively.
 *
 * @param state - Current market state.
 * @param empireId - The empire performing the manipulation.
 * @param commodityId - Target commodity.
 * @param action - Type of manipulation.
 * @param quantity - Scale of the manipulation (higher = more impact).
 * @param tick - Current game tick.
 * @param rng - Seeded PRNG for testability.
 * @returns Updated state and events describing the manipulation.
 */
export function manipulateMarket(
  state: MarketState,
  empireId: string,
  commodityId: string,
  action: ManipulationAction,
  quantity: number,
  tick: number,
  rng: () => number = Math.random,
): { state: MarketState; events: MarketEvent[] } {
  const next = copyState(state);
  const events: MarketEvent[] = [];

  // Apply to the manipulator's local market
  const market = next.localMarkets.get(empireId);
  if (!market) return { state: next, events };

  const listing = market.listings.find((l) => l.commodityId === commodityId);
  if (!listing) return { state: next, events };

  const absQuantity = Math.abs(quantity);
  let priceImpact = 0;

  switch (action) {
    case 'flood': {
      // Massive supply increase — price will drop gradually via inertia
      listing.supply += absQuantity;
      priceImpact = -(absQuantity / listing.supply) * listing.currentPrice * 0.5;
      break;
    }
    case 'hoard': {
      // Supply withdrawal — price will rise as scarcity hits
      listing.supply = Math.max(MIN_SUPPLY, listing.supply - absQuantity);
      priceImpact = (absQuantity / (listing.supply + absQuantity)) * listing.currentPrice * 0.5;
      break;
    }
    case 'dump': {
      // Aggressive below-market selling — supply spike plus direct price depression
      listing.supply += absQuantity * 1.5; // 50% more effective at flooding than normal
      listing.demand *= 0.9; // Buyer confidence drops slightly
      priceImpact = -(absQuantity / listing.supply) * listing.currentPrice * 0.8;
      break;
    }
  }

  // Also ripple the manipulation to the galactic market if empire is a member
  if (next.galacticMarket.open && next.galacticMarket.memberEmpires.includes(empireId)) {
    const galacticListing = next.galacticMarket.listings.find(
      (l) => l.commodityId === commodityId,
    );
    if (galacticListing) {
      // Galactic market absorbs impact at reduced rate (shared across all members)
      const dampening = 1 / Math.max(1, next.galacticMarket.memberEmpires.length);
      switch (action) {
        case 'flood':
          galacticListing.supply += absQuantity * dampening;
          break;
        case 'hoard':
          galacticListing.supply = Math.max(
            MIN_SUPPLY,
            galacticListing.supply - absQuantity * dampening,
          );
          break;
        case 'dump':
          galacticListing.supply += absQuantity * 1.5 * dampening;
          galacticListing.demand *= (1 - 0.1 * dampening);
          break;
      }
    }
  }

  // Subtle randomisation so manipulation is not perfectly predictable
  const noise = 1.0 + (rng() - 0.5) * 0.2;
  priceImpact *= noise;

  events.push({
    type: 'manipulation',
    empireId,
    commodityId,
    action,
    quantity: absQuantity,
    priceImpact,
    tick,
  });

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// Public API — inflation
// ---------------------------------------------------------------------------

/**
 * Calculate the inflation multiplier for an empire.
 *
 * Inflation is driven by:
 *  - Deficit spending (credits < 0 trend).
 *  - Money supply relative to production.
 *  - Trade hub activity (more hubs = more economic activity = slight inflation).
 *  - Sanctions (sanctioned empires face higher inflation).
 *
 * Returns a multiplier in the range [0.9, 1.3]:
 *  - 0.9 = slight deflation (strong economy, high production).
 *  - 1.0 = neutral.
 *  - 1.3 = severe inflation (deficit, sanctions, trade collapse).
 *
 * @param empire - Economic snapshot of the empire.
 * @param marketState - Current market state.
 * @returns Inflation multiplier.
 */
export function calculateInflation(
  empire: MarketEmpireView,
  marketState: MarketState,
): number {
  const localMarket = marketState.localMarkets.get(empire.id);
  if (!localMarket) return 1.0;

  let inflation = 1.0;

  // Deficit pressure: negative credits push inflation up
  if (empire.credits < 0) {
    const deficitSeverity = Math.min(1.0, Math.abs(empire.credits) / 1000);
    inflation += deficitSeverity * 0.15;
  }

  // Sanction pressure
  const sanctionPressure = Math.min(
    localMarket.sanctionedBy.length * 0.03,
    0.12,
  );
  inflation += sanctionPressure;

  // Trade hub activity — mild inflationary pressure from economic activity
  if (empire.tradeHubCount > 3) {
    inflation += (empire.tradeHubCount - 3) * 0.01;
  }

  // Production surplus creates deflationary pressure
  const productionStrength = empire.miningFacilityCount + empire.factoryCount;
  const consumptionPressure = empire.totalPopulation / 50_000;
  if (productionStrength > consumptionPressure) {
    inflation -= Math.min(0.08, (productionStrength - consumptionPressure) * 0.01);
  }

  // Blockade pressure — supply shortages cause inflation
  if (empire.isBlockaded) {
    inflation += 0.08;
  }

  return clamp(inflation, MIN_INFLATION, MAX_INFLATION);
}

// ---------------------------------------------------------------------------
// Public API — exchange rates
// ---------------------------------------------------------------------------

/**
 * Calculate the exchange rate between an empire's local currency and the
 * galactic reserve currency.
 *
 * Factors:
 *  - Council membership grants a favourable rate (1.0 baseline).
 *  - Non-members pay a penalty (NON_MEMBER_EXCHANGE_PENALTY).
 *  - Economic strength (production, trade activity) improves the rate.
 *  - Sanctions and blockades worsen the rate.
 *  - More council members → local currencies devalue slightly.
 *
 * Lower rate = stronger local currency (1 local unit buys more reserve).
 * Higher rate = weaker local currency.
 *
 * @param empireId - The empire to calculate the rate for.
 * @param galacticMarket - Current galactic market state.
 * @returns Exchange rate multiplier.
 */
export function calculateExchangeRate(
  empireId: string,
  galacticMarket: GalacticMarket,
): number {
  return galacticMarket.reserveCurrencyRate[empireId] ?? NON_MEMBER_EXCHANGE_PENALTY;
}

// ---------------------------------------------------------------------------
// Internal — galactic market aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate member empires' local markets into the galactic market.
 *
 * The galactic market's supply and demand for each commodity is the weighted
 * sum of all member local markets. This is not a magic shop — it reflects
 * real production and consumption.
 */
function aggregateGalacticMarket(
  state: MarketState,
  rng: () => number,
): void {
  const members = state.galacticMarket.memberEmpires;
  if (members.length === 0) return;

  for (const galacticListing of state.galacticMarket.listings) {
    let totalSupply = 0;
    let totalDemand = 0;
    let memberCount = 0;

    for (const memberId of members) {
      const localMarket = state.localMarkets.get(memberId);
      if (!localMarket) continue;

      const localListing = localMarket.listings.find(
        (l) => l.commodityId === galacticListing.commodityId,
      );
      if (!localListing) continue;
      if (localMarket.blockedCommodities.has(galacticListing.commodityId)) continue;

      totalSupply += localListing.supply;
      totalDemand += localListing.demand;
      memberCount++;
    }

    if (memberCount === 0) continue;

    // Galactic supply/demand is the sum, not the average — larger market = more volume
    galacticListing.supply += (totalSupply - galacticListing.supply) * PRICE_INERTIA_FACTOR;
    galacticListing.demand += (totalDemand - galacticListing.demand) * PRICE_INERTIA_FACTOR;
    galacticListing.supply = Math.max(galacticListing.supply, MIN_SUPPLY);

    // Recalculate galactic price
    const oldPrice = galacticListing.currentPrice;
    galacticListing.currentPrice = calculatePrice(galacticListing, rng);
    galacticListing.priceHistory = pushHistory(
      galacticListing.priceHistory,
      galacticListing.currentPrice,
    );
    galacticListing.trend = determineTrend(galacticListing.priceHistory);
  }
}

/**
 * Compute exchange rate for a single empire against the galactic reserve currency.
 *
 * Internal implementation used by processMarketTick.
 */
function computeExchangeRate(
  empire: MarketEmpireView,
  galacticMarket: GalacticMarket,
  allEmpires: MarketEmpireView[],
): number {
  const isMember = galacticMarket.memberEmpires.includes(empire.id);

  // Start from baseline
  let rate = isMember ? 1.0 : NON_MEMBER_EXCHANGE_PENALTY;

  // Economic strength factor: based on relative production
  const totalGlobalProduction = allEmpires.reduce(
    (sum, e) => sum + e.factoryCount + e.miningFacilityCount + e.tradeHubCount,
    0,
  );
  const empireProduction = empire.factoryCount + empire.miningFacilityCount + empire.tradeHubCount;
  const productionShare = totalGlobalProduction > 0
    ? empireProduction / totalGlobalProduction
    : 1 / Math.max(1, allEmpires.length);

  // Higher production share = stronger currency
  rate *= (1.0 - (productionShare - (1 / Math.max(1, allEmpires.length))) * 2);

  // More council members → local currencies devalue slightly
  if (isMember && galacticMarket.memberEmpires.length > 2) {
    rate *= 1.0 + (galacticMarket.memberEmpires.length - 2) * 0.02;
  }

  // Blockade weakens currency
  if (empire.isBlockaded) {
    rate *= 1.15;
  }

  return clamp(rate, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE);
}

// ---------------------------------------------------------------------------
// Internal — trade adjustment
// ---------------------------------------------------------------------------

/**
 * Adjust a market's supply and demand after a trade execution.
 * Buy orders increase demand (goods leaving market), sell orders increase supply.
 */
function adjustMarketFromTrade(
  state: MarketState,
  empireId: string,
  commodityId: string,
  quantity: number,
  orderType: 'buy' | 'sell',
): void {
  const market = state.localMarkets.get(empireId);
  if (!market) return;

  const listing = market.listings.find((l) => l.commodityId === commodityId);
  if (!listing) return;

  if (orderType === 'buy') {
    // Buying removes from supply and increases demand
    listing.supply = Math.max(MIN_SUPPLY, listing.supply - quantity * 0.1);
    listing.demand += quantity * 0.05;
  } else {
    // Selling adds to supply and reduces demand
    listing.supply += quantity * 0.1;
    listing.demand = Math.max(1, listing.demand - quantity * 0.05);
  }
}

/**
 * Look up the current market price for a commodity on an empire's local market.
 * Falls back to base price if not found.
 */
function getMarketPrice(
  state: MarketState,
  commodityId: string,
  empireId: string,
): number {
  const market = state.localMarkets.get(empireId);
  if (!market) {
    const def = DEFAULT_COMMODITIES.find((c) => c.id === commodityId);
    return def?.basePrice ?? 10;
  }

  const listing = market.listings.find((l) => l.commodityId === commodityId);
  return listing?.currentPrice ?? DEFAULT_COMMODITIES.find((c) => c.id === commodityId)?.basePrice ?? 10;
}
