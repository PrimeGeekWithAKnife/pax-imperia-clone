/**
 * Fleet management and movement engine — pure functions.
 *
 * All functions are side-effect free. Callers are responsible for persisting
 * any state changes returned from these functions.
 */

import type { Fleet, Ship, ShipDesign, ShipComponent, FleetStance } from '../types/ships.js';
import type { Galaxy } from '../types/galaxy.js';
import { findPath } from '../pathfinding/astar.js';
import { generateId } from '../utils/id.js';
import { designHasWarpDrive } from './ship-design.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Travel mode determines how a fleet traverses the galaxy.
 *
 * - `slow_ftl`: Sub-light FTL drives; no wormhole tech required. Very slow.
 * - `wormhole`: Standard wormhole traversal; requires `wormhole_stabilisation`.
 * - `advanced_wormhole`: Enhanced wormhole tech; requires `artificial_wormholes`.
 */
export type TravelMode = 'slow_ftl' | 'wormhole' | 'advanced_wormhole';

/**
 * An active movement order for a fleet navigating the wormhole network.
 *
 * path[0] is always the system the fleet departed from; path[path.length-1]
 * is the destination.  currentSegment is the index of the system the fleet
 * is currently in transit TOWARD (i.e. the fleet is between
 * path[currentSegment-1] and path[currentSegment] while in transit).
 */
export interface FleetMovementOrder {
  fleetId: string;
  /** System IDs from origin to destination, inclusive at both ends. */
  path: string[];
  /** Index of the next system the fleet is heading toward (1-based into path). */
  currentSegment: number;
  /** Number of game ticks required to traverse one wormhole hop. */
  ticksPerHop: number;
  /** Ticks already spent on the current hop. */
  ticksInTransit: number;
  /** How the fleet is travelling — determines speed and visual style. */
  travelMode: TravelMode;
}

export interface FleetStrength {
  totalHullPoints: number;
  totalDamage: number;
  shipCount: number;
  averageSpeed: number;
}

export interface ShipProductionOrder {
  designId: string;
  planetId: string;
  ticksRemaining: number;
  totalTicks: number;
}

// ---------------------------------------------------------------------------
// Fleet creation / management
// ---------------------------------------------------------------------------

/**
 * Create a new Fleet.  The ships listed in shipIds are assumed to be
 * physically present in systemId — callers must validate this before
 * persisting.
 */
export function createFleet(
  name: string,
  empireId: string,
  systemId: string,
  shipIds: string[],
): Fleet {
  return {
    id: generateId(),
    name,
    ships: [...shipIds],
    empireId,
    position: { systemId },
    destination: null,
    waypoints: [],
    stance: 'defensive',
  };
}

/**
 * Merge fleetB into fleetA.  Both fleets must be in the same star system.
 * Returns the combined fleet (using fleetA's id, name, stance, and waypoints)
 * or throws if they occupy different systems.
 */
export function mergeFleets(fleetA: Fleet, fleetB: Fleet): Fleet {
  if (fleetA.position.systemId !== fleetB.position.systemId) {
    throw new Error(
      `Cannot merge fleets in different systems: "${fleetA.position.systemId}" vs "${fleetB.position.systemId}"`,
    );
  }

  return {
    ...fleetA,
    ships: [...fleetA.ships, ...fleetB.ships],
  };
}

/**
 * Split a fleet by moving the selected ship IDs into a newly created fleet.
 * Ships not listed in shipIdsToSplit remain in the original fleet.
 *
 * Throws if any of the split IDs are not present in the original fleet, or
 * if the split would leave the original fleet empty.
 */
export function splitFleet(
  fleet: Fleet,
  shipIdsToSplit: string[],
  newFleetName: string,
): { original: Fleet; newFleet: Fleet } {
  const splitSet = new Set(shipIdsToSplit);

  for (const id of splitSet) {
    if (!fleet.ships.includes(id)) {
      throw new Error(`Ship "${id}" is not in fleet "${fleet.id}"`);
    }
  }

  const remainingShips = fleet.ships.filter((id) => !splitSet.has(id));
  if (remainingShips.length === 0) {
    throw new Error('splitFleet would leave the original fleet with no ships');
  }
  if (shipIdsToSplit.length === 0) {
    throw new Error('splitFleet requires at least one ship to split off');
  }

  const original: Fleet = { ...fleet, ships: remainingShips };

  const newFleet: Fleet = {
    id: generateId(),
    name: newFleetName,
    ships: [...shipIdsToSplit],
    empireId: fleet.empireId,
    position: { systemId: fleet.position.systemId },
    destination: null,
    waypoints: [],
    stance: fleet.stance,
    orbitTarget: fleet.orbitTarget ?? 'star',
  };

  return { original, newFleet };
}

/**
 * Add a ship to a fleet.  The caller is responsible for ensuring the ship
 * is co-located with the fleet and for updating the ship's fleetId.
 */
export function addShipToFleet(fleet: Fleet, shipId: string): Fleet {
  if (fleet.ships.includes(shipId)) {
    return fleet; // idempotent
  }
  return { ...fleet, ships: [...fleet.ships, shipId] };
}

/**
 * Remove a ship from a fleet.  Returns the updated fleet (with the ship
 * removed).  The caller is responsible for updating the ship's fleetId to
 * null and handling the case where the fleet is now empty.
 */
export function removeShipFromFleet(fleet: Fleet, shipId: string): Fleet {
  return { ...fleet, ships: fleet.ships.filter((id) => id !== shipId) };
}

// ---------------------------------------------------------------------------
// Carrier mechanics — ships carrying ships
// ---------------------------------------------------------------------------

/**
 * Load a ship into a carrier's hangar. Returns updated copies of both ships.
 * Returns null if the carrier cannot carry this ship (wrong hull class, full,
 * or cargo is already carried).
 */
export function loadShipIntoCarrier(
  carrier: Ship,
  cargo: Ship,
  carrierDesign: ShipDesign,
  cargoDesign: ShipDesign,
  hullTemplates: Map<string, { hangarSlots?: { count: number; carries: Array<{ hull: string; quantity: number }> } }>,
  allShips: Ship[],
): { carrier: Ship; cargo: Ship } | null {
  const carrierHull = hullTemplates.get(carrierDesign.hull);
  if (!carrierHull?.hangarSlots) return null;

  // Check if this hull class is one of the carriable options
  const carryOption = carrierHull.hangarSlots.carries.find(c => c.hull === cargoDesign.hull);
  if (!carryOption) return null;

  // Check cargo isn't already carried
  if (cargo.carriedBy) return null;

  // Count total bay capacity used. Each bay holds one option's full quantity.
  // For simplicity: count carried ships of each type and check against bay limits.
  const carried = allShips.filter(s => s.carriedBy === carrier.id);
  const totalBaysUsed = Math.ceil(carried.length / Math.max(1, carryOption.quantity));
  if (totalBaysUsed >= carrierHull.hangarSlots.count) return null;

  return {
    carrier,
    cargo: { ...cargo, carriedBy: carrier.id },
  };
}

/**
 * Unload a ship from its carrier. Returns the updated cargo ship with
 * carriedBy cleared. The fleet must be stationary (not in transit).
 */
export function unloadShipFromCarrier(cargo: Ship): Ship {
  return { ...cargo, carriedBy: undefined };
}

/**
 * Get all ships carried by a given carrier (direct children only).
 */
export function getCarriedShips(carrierId: string, allShips: Ship[]): Ship[] {
  return allShips.filter(s => s.carriedBy === carrierId);
}

/**
 * Recursively get all ships carried by a carrier, including ships carried by
 * sub-carriers (e.g. battle station -> carriers -> destroyers).
 */
export function getAllCarriedShipsRecursive(carrierId: string, allShips: Ship[]): Ship[] {
  const result: Ship[] = [];
  const directChildren = allShips.filter(s => s.carriedBy === carrierId);
  for (const child of directChildren) {
    result.push(child);
    // Recursively get ships carried by this child
    result.push(...getAllCarriedShipsRecursive(child.id, allShips));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fleet movement
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Travel mode helpers
// ---------------------------------------------------------------------------

/** Ticks per hop for each travel mode. */
const TICKS_PER_HOP: Record<TravelMode, number> = {
  slow_ftl: 20,
  wormhole: 10,
  advanced_wormhole: 5,
};

/**
 * Determine the best travel mode available to an empire based on its
 * researched technologies.
 *
 * - `artificial_wormholes` → `advanced_wormhole` (ticksPerHop = 5)
 * - `wormhole_stabilisation` → `wormhole` (ticksPerHop = 10)
 * - Neither → `slow_ftl` (ticksPerHop = 20)
 */
export function determineTravelMode(empireTechnologies: string[]): TravelMode {
  const techs = new Set(empireTechnologies);
  if (techs.has('artificial_wormholes')) return 'advanced_wormhole';
  if (techs.has('wormhole_stabilisation')) return 'wormhole';
  return 'slow_ftl';
}

/**
 * Check which ships in a fleet can travel between star systems (have warp drives)
 * and which cannot (must be carried).
 *
 * Ships with `carriedBy` set are exempt — they travel inside their carrier.
 */
export function getFleetWarpStatus(
  fleet: Fleet,
  ships: Ship[],
  designs: Map<string, ShipDesign>,
  components: ShipComponent[],
): { warpCapable: string[]; notWarpCapable: string[] } {
  const fleetShips = ships.filter(s => fleet.ships.includes(s.id));
  const warpCapable: string[] = [];
  const notWarpCapable: string[] = [];

  for (const ship of fleetShips) {
    // Carried ships are exempt — they travel with their carrier
    if (ship.carriedBy) {
      warpCapable.push(ship.id);
      continue;
    }
    const design = designs.get(ship.designId);
    if (design && designHasWarpDrive(design, components)) {
      warpCapable.push(ship.id);
    } else {
      notWarpCapable.push(ship.id);
    }
  }

  return { warpCapable, notWarpCapable };
}

/**
 * Returns true if the fleet can travel between star systems.
 * All non-carried ships must have a warp drive.
 */
export function fleetCanWarp(
  fleet: Fleet,
  ships: Ship[],
  designs: Map<string, ShipDesign>,
  components: ShipComponent[],
): boolean {
  const { notWarpCapable } = getFleetWarpStatus(fleet, ships, designs, components);
  return notWarpCapable.length === 0;
}

/**
 * Plan a route from the fleet's current position to destinationId using A*
 * pathfinding.  Returns a FleetMovementOrder ready to pass to
 * processFleetMovement, or null if no path exists.
 *
 * ticksPerHop defaults to 10 (ten ticks per wormhole hop).  Pass a different
 * value to model faster/slower travel speeds (e.g. via propulsion tech).
 *
 * When empireTechnologies is provided, the travel mode and ticksPerHop are
 * derived automatically from the empire's researched techs.  An explicit
 * ticksPerHop still overrides the tech-derived value.
 */
export function issueMovementOrder(
  fleet: Fleet,
  galaxy: Galaxy,
  destinationId: string,
  ticksPerHop?: number,
  empireTechnologies?: string[],
): FleetMovementOrder | null {
  const startId = fleet.position.systemId;

  // Already there — no order needed.
  if (startId === destinationId) return null;

  const result = findPath(galaxy, startId, destinationId);
  if (!result.found || result.path.length < 2) return null;

  const travelMode: TravelMode = empireTechnologies
    ? determineTravelMode(empireTechnologies)
    : ticksPerHop !== undefined
      ? (ticksPerHop <= 5 ? 'advanced_wormhole' : ticksPerHop <= 10 ? 'wormhole' : 'slow_ftl')
      : 'wormhole';

  const resolvedTicksPerHop = ticksPerHop ?? TICKS_PER_HOP[travelMode];

  return {
    fleetId: fleet.id,
    path: result.path,
    currentSegment: 1, // heading toward path[1]
    ticksPerHop: resolvedTicksPerHop,
    ticksInTransit: 0,
    travelMode,
  };
}

/**
 * Advance a movement order by one game tick.
 *
 * When a hop completes the fleet moves to the next system.  When the final
 * hop completes the fleet arrives at its destination and the order is
 * cleared (returns null).
 *
 * Returns updated copies of the order, fleet, and ships.
 * arrivedAtSystem is set to the system ID each time the fleet enters a new
 * system (including the final destination); otherwise null.
 */
export function processFleetMovement(
  order: FleetMovementOrder,
  fleet: Fleet,
  ships: Ship[],
): {
  order: FleetMovementOrder | null;
  fleet: Fleet;
  ships: Ship[];
  arrivedAtSystem: string | null;
} {
  const newTicksInTransit = order.ticksInTransit + 1;

  // Not yet finished with this hop.
  if (newTicksInTransit < order.ticksPerHop) {
    return {
      order: { ...order, ticksInTransit: newTicksInTransit },
      fleet,
      ships,
      arrivedAtSystem: null,
    };
  }

  // Hop complete — arrive at path[currentSegment].
  const arrivedSystemId = order.path[order.currentSegment] as string;

  const updatedFleet: Fleet = {
    ...fleet,
    position: { systemId: arrivedSystemId },
    destination:
      order.currentSegment < order.path.length - 1
        ? (order.path[order.path.length - 1] ?? null)
        : null,
  };

  const updatedShips: Ship[] = ships.map((ship) =>
    fleet.ships.includes(ship.id)
      ? { ...ship, position: { ...ship.position, systemId: arrivedSystemId } }
      : ship,
  );

  // Check if we have reached the final destination.
  const isDestination = order.currentSegment >= order.path.length - 1;

  if (isDestination) {
    return {
      order: null,
      fleet: updatedFleet,
      ships: updatedShips,
      arrivedAtSystem: arrivedSystemId,
    };
  }

  // More hops to go — advance the segment pointer.
  const nextOrder: FleetMovementOrder = {
    ...order,
    currentSegment: order.currentSegment + 1,
    ticksInTransit: 0,
  };

  return {
    order: nextOrder,
    fleet: updatedFleet,
    ships: updatedShips,
    arrivedAtSystem: arrivedSystemId,
  };
}

/**
 * Set the fleet's patrol waypoints (replaces any existing list).
 * Pass an empty array to clear waypoints.
 */
export function setWaypoints(fleet: Fleet, waypointSystemIds: string[]): Fleet {
  return { ...fleet, waypoints: [...waypointSystemIds] };
}

/**
 * If the fleet has waypoints and is not currently moving, issue an order to
 * the next waypoint in the cycle.  The fleet progresses through waypoints
 * in order, looping back to the first after reaching the last.
 *
 * Returns null if there are no waypoints, the fleet is already at the next
 * waypoint, or no path can be found.
 *
 * The caller is responsible for tracking which waypoint index is current;
 * this function derives the next waypoint by comparing the fleet's current
 * position against the waypoints list.
 */
export function processWaypoints(
  fleet: Fleet,
  galaxy: Galaxy,
  ticksPerHop = 10,
  empireTechnologies?: string[],
): FleetMovementOrder | null {
  if (fleet.waypoints.length === 0) return null;

  const currentSystemId = fleet.position.systemId;
  const currentWaypointIndex = fleet.waypoints.indexOf(currentSystemId);

  let nextIndex: number;
  if (currentWaypointIndex === -1) {
    // Fleet is not on any waypoint — head to the first one.
    nextIndex = 0;
  } else {
    // Cycle: advance to the next waypoint, wrapping around.
    nextIndex = (currentWaypointIndex + 1) % fleet.waypoints.length;
  }

  const nextWaypointId = fleet.waypoints[nextIndex] as string;

  // Already at the next waypoint (e.g., single-element waypoint list).
  if (nextWaypointId === currentSystemId) return null;

  return issueMovementOrder(fleet, galaxy, nextWaypointId, ticksPerHop, empireTechnologies);
}

// ---------------------------------------------------------------------------
// Fleet combat readiness
// ---------------------------------------------------------------------------

/**
 * Compute aggregate combat statistics for a fleet from its constituent ships.
 *
 * Only ships whose IDs appear in fleet.ships are considered.
 * totalDamage is computed as the inverse of average system weapon damage
 * (so a fully damaged weapons system reduces contribution to 0).
 * averageSpeed accounts for engine damage (a ship with engines=1 has speed 0).
 * Hull points are summed directly.
 */
export function getFleetStrength(fleet: Fleet, ships: Ship[]): FleetStrength {
  const fleetShipSet = new Set(fleet.ships);
  const fleetShips = ships.filter((s) => fleetShipSet.has(s.id));

  if (fleetShips.length === 0) {
    return { totalHullPoints: 0, totalDamage: 0, shipCount: 0, averageSpeed: 0 };
  }

  let totalHullPoints = 0;
  let totalDamage = 0;
  let totalEffectiveSpeed = 0;

  for (const ship of fleetShips) {
    totalHullPoints += ship.hullPoints;

    // Weapon effectiveness is inversely proportional to weapon system damage.
    const weaponEffectiveness = 1 - ship.systemDamage.weapons;
    // Use hullPoints as a proxy for base damage contribution (no design lookup
    // needed; callers with richer data can compute this themselves).
    totalDamage += ship.hullPoints * weaponEffectiveness;

    // Engine damage reduces speed proportionally.
    const engineEffectiveness = 1 - ship.systemDamage.engines;
    totalEffectiveSpeed += engineEffectiveness;
  }

  return {
    totalHullPoints,
    totalDamage,
    shipCount: fleetShips.length,
    averageSpeed: totalEffectiveSpeed / fleetShips.length,
  };
}

/**
 * Update the fleet's combat stance.
 */
export function setFleetStance(fleet: Fleet, stance: FleetStance): Fleet {
  return { ...fleet, stance };
}

// ---------------------------------------------------------------------------
// Ship production
// ---------------------------------------------------------------------------

/**
 * Create a new ship production order.
 */
export function startShipProduction(
  designId: string,
  planetId: string,
  buildTime: number,
): ShipProductionOrder {
  return {
    designId,
    planetId,
    ticksRemaining: buildTime,
    totalTicks: buildTime,
  };
}

/**
 * Advance a ship production order by one tick.
 *
 * Returns the updated order (null if complete) and a completed flag.
 */
export function processShipProduction(order: ShipProductionOrder): {
  order: ShipProductionOrder | null;
  completed: boolean;
} {
  const newTicksRemaining = order.ticksRemaining - 1;

  if (newTicksRemaining <= 0) {
    return { order: null, completed: true };
  }

  return {
    order: { ...order, ticksRemaining: newTicksRemaining },
    completed: false,
  };
}
