/**
 * Physical trade route system.
 * Trade routes are real paths through space that can be raided, rerouted, and protected.
 */

import type { ResourceKey } from './resources.js';

export interface TradeRoute {
  id: string;
  /** Empire that owns/initiated this route */
  empireId: string;
  /** Trading partner empire */
  partnerEmpireId: string;
  /** Source system */
  sourceSystemId: string;
  /** Destination system */
  destinationSystemId: string;
  /** Ordered list of system IDs the trade ships traverse */
  path: string[];
  /** Current status */
  status: TradeRouteStatus;
  /** Resources exchanged per tick */
  goods: TradeGoods;
  /** Revenue generated per tick for the route owner */
  revenuePerTick: number;
  /** Revenue generated per tick for the partner */
  partnerRevenuePerTick: number;
  /** How many ticks this route has been active */
  age: number;
  /** Trade routes improve with age — maturity bonus (0.0 to 1.0) */
  maturityBonus: number;
}

export type TradeRouteStatus =
  | 'establishing'     // Being set up, not yet generating revenue
  | 'active'           // Fully operational
  | 'disrupted'        // Raided or blockaded — reduced revenue
  | 'blockaded'        // Completely blocked — zero revenue
  | 'rerouting'        // Finding a new path around disruption
  | 'cancelled';       // Terminated by either party

export interface TradeGoods {
  /** Resources flowing from source to destination */
  exports: Partial<Record<ResourceKey, number>>;
  /** Resources flowing from destination to source */
  imports: Partial<Record<ResourceKey, number>>;
}

/** A trade offer between empires — what each side puts on the table */
export interface TradeOffer {
  offeredBy: string;
  offeredTo: string;
  /** What the offerer is giving */
  offering: TradeOfferItems;
  /** What the offerer wants in return */
  requesting: TradeOfferItems;
}

export interface TradeOfferItems {
  resources?: Partial<Record<ResourceKey, number>>;
  /** Ship IDs offered in trade */
  ships?: string[];
  /** Planet IDs offered in trade */
  planets?: string[];
  /** Technology IDs offered for sharing */
  technologies?: string[];
  /** Intelligence/information */
  intelligence?: string[];
  /** Trade route access through your territory */
  routeAccess?: boolean;
  /** Population (willing migrants) */
  population?: number;
}

export interface BlackMarketOperation {
  id: string;
  empireId: string;
  type: BlackMarketType;
  targetSystemId: string;
  profitMultiplier: number;     // Black market pays 1.5-3x normal rates
  riskOfDiscovery: number;      // 0.0-1.0 chance of diplomatic incident per tick
  active: boolean;
}

export type BlackMarketType =
  | 'smuggling'           // Move contraband past blockades
  | 'arms_dealing'        // Sell weapons to embargoed parties
  | 'intelligence_trade'  // Buy/sell spy data
  | 'slave_trade'         // Population trafficking
  | 'contraband'          // Illegal goods (drugs, forbidden tech)
  | 'technology_theft';   // Sell stolen tech blueprints
