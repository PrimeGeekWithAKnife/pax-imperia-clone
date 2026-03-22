/**
 * Physical trade route engine — pure functions for establishing, processing,
 * rerouting, and disrupting inter-empire trade routes.
 *
 * Trade routes are physical paths through space. Ships traverse a sequence of
 * star systems connected by wormholes. Routes can be raided, blockaded, and
 * rerouted — making chokepoint control a meaningful strategic choice.
 *
 * All functions are side-effect free. Callers must persist any state changes
 * returned from these functions.
 */

import type { Galaxy, StarSystem } from '../types/galaxy.js';
import type { Fleet } from '../types/ships.js';
import type {
  TradeRoute,
  TradeRouteStatus,
  TradeGoods,
} from '../types/trade-routes.js';
import { findPath } from '../pathfinding/astar.js';
import { generateId } from '../utils/id.js';
import { clamp } from '../utils/math.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ticks required for a new route to become fully active. */
const ESTABLISHMENT_TICKS = 5;

/** Ticks over which maturity bonus grows from 0.0 to 1.0. */
const MATURITY_CAP_TICKS = 50;

/** Maximum maturity bonus. */
const MAX_MATURITY_BONUS = 1.0;

/** Base revenue per tick for a trade route before maturity/disruption. */
const BASE_REVENUE_PER_TICK = 10;

/** Revenue multiplier when a route is disrupted (enemy fleet nearby). */
const DISRUPTED_REVENUE_FACTOR = 0.25;

/** Revenue multiplier when a route is blockaded (zero traffic). */
const BLOCKADED_REVENUE_FACTOR = 0.0;

/** Revenue multiplier when a route is rerouting (reduced but not zero). */
const REROUTING_REVENUE_FACTOR = 0.1;

/** Revenue multiplier when a route is establishing (no revenue yet). */
const ESTABLISHING_REVENUE_FACTOR = 0.0;

/**
 * Fraction of the owner's revenue that the partner receives.
 * Partners earn slightly less since they did not initiate the route.
 */
const PARTNER_REVENUE_RATIO = 0.75;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a lookup from system ID to StarSystem for O(1) access. */
function buildSystemMap(galaxy: Galaxy): Map<string, StarSystem> {
  const map = new Map<string, StarSystem>();
  for (const system of galaxy.systems) {
    map.set(system.id, system);
  }
  return map;
}

/**
 * Calculate a base revenue figure derived from the natural resource wealth
 * of the source and destination systems.  Higher-wealth endpoints produce
 * more lucrative routes.
 */
function calculateBaseRevenue(
  sourceSystem: StarSystem,
  destSystem: StarSystem,
): number {
  let sourceWealth = 0;
  for (const planet of sourceSystem.planets) {
    sourceWealth += planet.naturalResources;
  }

  let destWealth = 0;
  for (const planet of destSystem.planets) {
    destWealth += planet.naturalResources;
  }

  // Average wealth of both endpoints, normalised to a 0-1 scale (resources are 0-100).
  const averageWealth = (sourceWealth + destWealth) / 2;
  const wealthFactor = Math.max(0.1, averageWealth / 100);

  return Math.max(1, Math.round(BASE_REVENUE_PER_TICK * wealthFactor));
}

/**
 * Return the revenue multiplier for a given route status.
 */
function disruptionFactor(status: TradeRouteStatus): number {
  switch (status) {
    case 'establishing':
      return ESTABLISHING_REVENUE_FACTOR;
    case 'active':
      return 1.0;
    case 'disrupted':
      return DISRUPTED_REVENUE_FACTOR;
    case 'blockaded':
      return BLOCKADED_REVENUE_FACTOR;
    case 'rerouting':
      return REROUTING_REVENUE_FACTOR;
    case 'cancelled':
      return 0.0;
  }
}

/**
 * Create a Galaxy view with certain systems removed, for rerouting
 * pathfinding. The source and destination systems are never removed
 * even if they appear in the blocked list.
 */
function galaxyWithout(
  galaxy: Galaxy,
  blockedSystemIds: Set<string>,
  preserveIds: string[],
): Galaxy {
  const preserveSet = new Set(preserveIds);
  const filteredSystems = galaxy.systems
    .filter((s) => !blockedSystemIds.has(s.id) || preserveSet.has(s.id))
    .map((s) => ({
      ...s,
      wormholes: s.wormholes.filter(
        (wId) => !blockedSystemIds.has(wId) || preserveSet.has(wId),
      ),
    }));

  return {
    ...galaxy,
    systems: filteredSystems,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Establish a new trade route between two systems owned by different empires.
 *
 * Calculates the shortest safe path using A* pathfinding and sets the initial
 * status to 'establishing'.  Revenue begins after ESTABLISHMENT_TICKS ticks.
 *
 * Returns null if no path can be found between the systems.
 */
export function establishTradeRoute(
  sourceSystemId: string,
  destinationSystemId: string,
  empireId: string,
  partnerEmpireId: string,
  galaxy: Galaxy,
): TradeRoute | null {
  const systemMap = buildSystemMap(galaxy);
  const sourceSystem = systemMap.get(sourceSystemId);
  const destSystem = systemMap.get(destinationSystemId);

  if (!sourceSystem || !destSystem) return null;

  const pathResult = findPath(galaxy, sourceSystemId, destinationSystemId);
  if (!pathResult.found || pathResult.path.length < 2) return null;

  const baseRevenue = calculateBaseRevenue(sourceSystem, destSystem);

  const emptyGoods: TradeGoods = {
    exports: {},
    imports: {},
  };

  return {
    id: generateId(),
    empireId,
    partnerEmpireId,
    sourceSystemId,
    destinationSystemId,
    path: pathResult.path,
    status: 'establishing',
    goods: emptyGoods,
    revenuePerTick: baseRevenue,
    partnerRevenuePerTick: Math.round(baseRevenue * PARTNER_REVENUE_RATIO),
    age: 0,
    maturityBonus: 0,
  };
}

/**
 * Advance all trade routes by one game tick.
 *
 * - Ages each route and updates the maturity bonus (capped at 1.0 over 50 ticks).
 * - Transitions 'establishing' routes to 'active' after ESTABLISHMENT_TICKS.
 * - Checks each route's path for hostile fleets — sets status to 'disrupted'
 *   or 'blockaded' accordingly.
 * - Recalculates revenue factoring in maturity bonus and disruption.
 * - Cancelled routes are passed through unchanged.
 */
export function tickTradeRoutes(
  routes: TradeRoute[],
  galaxy: Galaxy,
  fleets: Fleet[],
): TradeRoute[] {
  const systemMap = buildSystemMap(galaxy);

  // Build a lookup: systemId -> set of empireIds with fleets present
  const fleetPresence = new Map<string, Set<string>>();
  for (const fleet of fleets) {
    const systemId = fleet.position.systemId;
    let empires = fleetPresence.get(systemId);
    if (!empires) {
      empires = new Set<string>();
      fleetPresence.set(systemId, empires);
    }
    empires.add(fleet.empireId);
  }

  return routes.map((route) => {
    // Cancelled routes are immutable
    if (route.status === 'cancelled') return route;

    // Age the route
    const newAge = route.age + 1;
    const newMaturity = clamp(newAge / MATURITY_CAP_TICKS, 0, MAX_MATURITY_BONUS);

    // Transition establishing -> active
    let newStatus: TradeRouteStatus = route.status;
    if (route.status === 'establishing' && newAge >= ESTABLISHMENT_TICKS) {
      newStatus = 'active';
    }

    // Check path for hostile fleets (only for non-establishing routes)
    if (newStatus !== 'establishing') {
      const hostilePresence = checkPathForHostiles(
        route.path,
        route.empireId,
        route.partnerEmpireId,
        fleetPresence,
      );

      if (hostilePresence === 'blockaded') {
        newStatus = 'blockaded';
      } else if (hostilePresence === 'disrupted') {
        newStatus = 'disrupted';
      } else if (route.status === 'disrupted' || route.status === 'blockaded') {
        // Threat cleared — restore to active
        newStatus = 'active';
      }
    }

    // Calculate revenue
    const sourceSystem = systemMap.get(route.sourceSystemId);
    const destSystem = systemMap.get(route.destinationSystemId);
    const baseRevenue = sourceSystem && destSystem
      ? calculateBaseRevenue(sourceSystem, destSystem)
      : route.revenuePerTick;

    const factor = disruptionFactor(newStatus);
    const maturityMultiplier = 1 + newMaturity;
    const ownerRevenue = Math.round(baseRevenue * maturityMultiplier * factor);
    const partnerRevenue = Math.round(ownerRevenue * PARTNER_REVENUE_RATIO);

    return {
      ...route,
      age: newAge,
      maturityBonus: newMaturity,
      status: newStatus,
      revenuePerTick: ownerRevenue,
      partnerRevenuePerTick: partnerRevenue,
    };
  });
}

/**
 * Check whether hostile fleets are present along a trade route's path.
 *
 * Returns:
 * - 'blockaded' if hostiles are present at the source or destination
 * - 'disrupted' if hostiles are present at any intermediate system
 * - 'clear' if no hostile fleets are found along the route
 *
 * A fleet is hostile if it belongs to neither the route owner nor the partner.
 */
function checkPathForHostiles(
  path: string[],
  empireId: string,
  partnerEmpireId: string,
  fleetPresence: Map<string, Set<string>>,
): 'blockaded' | 'disrupted' | 'clear' {
  let disrupted = false;

  for (let i = 0; i < path.length; i++) {
    const systemId = path[i] as string;
    const empires = fleetPresence.get(systemId);
    if (!empires) continue;

    // Check for hostile presence (neither owner nor partner)
    let hasHostile = false;
    for (const fleetEmpireId of empires) {
      if (fleetEmpireId !== empireId && fleetEmpireId !== partnerEmpireId) {
        hasHostile = true;
        break;
      }
    }

    if (!hasHostile) continue;

    // Hostiles at endpoints = blockade
    if (i === 0 || i === path.length - 1) {
      return 'blockaded';
    }

    // Hostiles at intermediate systems = disruption
    disrupted = true;
  }

  return disrupted ? 'disrupted' : 'clear';
}

/**
 * Attempt to reroute a trade route around blocked systems.
 *
 * If an alternative path exists, the route's path is updated and its status
 * is set to 'rerouting' (it will transition back to 'active' on the next
 * tick if the new path is clear).
 *
 * If no alternative path can be found, the route is cancelled.
 */
export function rerouteTradeRoute(
  route: TradeRoute,
  galaxy: Galaxy,
  blockedSystemIds: string[],
): TradeRoute {
  const blockedSet = new Set(blockedSystemIds);

  // Create a galaxy view without the blocked systems (but keep source/dest)
  const filteredGalaxy = galaxyWithout(
    galaxy,
    blockedSet,
    [route.sourceSystemId, route.destinationSystemId],
  );

  const pathResult = findPath(
    filteredGalaxy,
    route.sourceSystemId,
    route.destinationSystemId,
  );

  if (!pathResult.found || pathResult.path.length < 2) {
    return { ...route, status: 'cancelled' };
  }

  return {
    ...route,
    path: pathResult.path,
    status: 'rerouting',
  };
}

/**
 * Calculate the revenue generated by a trade route for both the owner
 * and the partner empire, accounting for maturity bonus and disruption.
 */
export function calculateTradeRevenue(route: TradeRoute): {
  ownerRevenue: number;
  partnerRevenue: number;
} {
  const factor = disruptionFactor(route.status);
  const maturityMultiplier = 1 + route.maturityBonus;
  const ownerRevenue = Math.round(route.revenuePerTick * maturityMultiplier * factor);
  const partnerRevenue = Math.round(ownerRevenue * PARTNER_REVENUE_RATIO);

  return { ownerRevenue, partnerRevenue };
}
