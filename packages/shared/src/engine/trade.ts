/**
 * Trade route engine — pure functions for establishing and processing
 * inter-system trade routes.
 *
 * All functions are side-effect free. Game state must be updated by the caller
 * using the values returned from these functions.
 *
 * Trade routes require spaceports at both ends and a wormhole connection
 * between the two systems.  Income scales with the Euclidean distance between
 * the systems so that longer routes are more rewarding.
 */

import type { Galaxy, StarSystem } from '../types/galaxy.js';
import { findPath } from '../pathfinding/astar.js';
import { distance2D } from '../utils/math.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BasicTradeRoute {
  id: string;
  empireId: string;
  originSystemId: string;
  destinationSystemId: string;
  /** Credits generated per tick. */
  income: number;
  /** Tick counter at which the route was established. */
  established: number;
}

export interface CanEstablishResult {
  allowed: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Base credits per tick for a trade route of distance 1.
 * Income scales linearly: income = BASE_TRADE_INCOME * distance / DISTANCE_SCALE.
 */
const BASE_TRADE_INCOME = 40;

/**
 * Normalisation divisor for distance → income scaling.
 * A route spanning 100 map units produces BASE_TRADE_INCOME credits/tick.
 */
const DISTANCE_SCALE = 100;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return true if the given system has at least one planet with a spaceport
 *  owned by `empireId`. */
function systemHasSpaceport(system: StarSystem, empireId: string): boolean {
  for (const planet of system.planets) {
    if (planet.ownerId !== empireId) continue;
    for (const building of planet.buildings) {
      if (building.type === 'spaceport') return true;
    }
  }
  return false;
}

/** Build a lookup from system ID → StarSystem for O(1) access. */
function buildSystemMap(galaxy: Galaxy): Map<string, StarSystem> {
  const map = new Map<string, StarSystem>();
  for (const system of galaxy.systems) {
    map.set(system.id, system);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine whether a new trade route can be established between two systems.
 *
 * Conditions:
 * 1. Both systems must exist in the galaxy.
 * 2. Both systems must have at least one planet with a spaceport owned by the empire.
 * 3. The two systems must be connected via wormholes (reachable from each other).
 * 4. The origin and destination must differ.
 */
export function canEstablishTradeRoute(
  empireId: string,
  originSystemId: string,
  destinationSystemId: string,
  galaxy: Galaxy,
): CanEstablishResult {
  if (originSystemId === destinationSystemId) {
    return { allowed: false, reason: 'Origin and destination must be different systems.' };
  }

  const systemMap = buildSystemMap(galaxy);

  const originSystem = systemMap.get(originSystemId);
  if (!originSystem) {
    return { allowed: false, reason: `Origin system "${originSystemId}" not found.` };
  }

  const destSystem = systemMap.get(destinationSystemId);
  if (!destSystem) {
    return { allowed: false, reason: `Destination system "${destinationSystemId}" not found.` };
  }

  if (!systemHasSpaceport(originSystem, empireId)) {
    return {
      allowed: false,
      reason: `${originSystem.name} requires a spaceport to establish a trade route.`,
    };
  }

  if (!systemHasSpaceport(destSystem, empireId)) {
    return {
      allowed: false,
      reason: `${destSystem.name} requires a spaceport to establish a trade route.`,
    };
  }

  const pathResult = findPath(galaxy, originSystemId, destinationSystemId);
  if (!pathResult.found) {
    return {
      allowed: false,
      reason: `${originSystem.name} and ${destSystem.name} are not connected via wormholes.`,
    };
  }

  return { allowed: true };
}

/**
 * Calculate the per-tick credit income for a trade route given the straight-line
 * distance between the two systems.
 *
 * Formula:  income = max(1, round(BASE_TRADE_INCOME * distance / DISTANCE_SCALE))
 *
 * Minimum income is 1 credit/tick so even adjacent systems produce some revenue.
 */
export function calculateTradeRouteIncome(route: BasicTradeRoute, distance: number): number {
  return Math.max(1, Math.round(BASE_TRADE_INCOME * distance / DISTANCE_SCALE));
}

/**
 * Process all trade routes for one tick, returning the total credits earned
 * per empire (keyed by empireId).
 *
 * Routes referencing systems that no longer exist are silently skipped so that
 * a missing system never crashes the game loop.
 */
export function processTradeRoutes(
  routes: BasicTradeRoute[],
  galaxy: Galaxy,
): { income: Map<string, number> } {
  const income = new Map<string, number>();
  const systemMap = buildSystemMap(galaxy);

  for (const route of routes) {
    const originSystem = systemMap.get(route.originSystemId);
    const destSystem = systemMap.get(route.destinationSystemId);

    if (!originSystem || !destSystem) {
      // System no longer exists — skip without error.
      continue;
    }

    const dist = distance2D(originSystem.position, destSystem.position);
    const routeIncome = calculateTradeRouteIncome(route, dist);

    const existing = income.get(route.empireId) ?? 0;
    income.set(route.empireId, existing + routeIncome);
  }

  return { income };
}
