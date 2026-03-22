import { describe, it, expect } from 'vitest';

import type { Fleet, Ship } from '../types/ships.js';
import type { Galaxy, StarSystem } from '../types/galaxy.js';
import {
  createFleet,
  mergeFleets,
  splitFleet,
  addShipToFleet,
  removeShipFromFleet,
  issueMovementOrder,
  processFleetMovement,
  setWaypoints,
  processWaypoints,
  getFleetStrength,
  setFleetStance,
  startShipProduction,
  processShipProduction,
} from '../engine/fleet.js';
import type { FleetMovementOrder } from '../engine/fleet.js';

// ---------------------------------------------------------------------------
// Minimal test builders
// ---------------------------------------------------------------------------

function makeSystem(id: string, x: number, y: number, wormholes: string[]): StarSystem {
  return {
    id,
    name: id,
    position: { x, y },
    starType: 'yellow',
    planets: [],
    wormholes,
    ownerId: null,
    discovered: {},
  };
}

function makeGalaxy(systems: StarSystem[]): Galaxy {
  return { id: 'test-galaxy', systems, width: 1000, height: 1000, seed: 0 };
}

/**
 * Linear chain:  A ─ B ─ C ─ D
 * Each hop is exactly 1 distance unit.
 */
function makeLinearGalaxy(): Galaxy {
  return makeGalaxy([
    makeSystem('A', 0, 0, ['B']),
    makeSystem('B', 1, 0, ['A', 'C']),
    makeSystem('C', 2, 0, ['B', 'D']),
    makeSystem('D', 3, 0, ['C']),
  ]);
}

/**
 * Diamond:  A ─ B ─ D  and  A ─ C ─ D
 */
function makeDiamondGalaxy(): Galaxy {
  return makeGalaxy([
    makeSystem('A', 0, 0, ['B', 'C']),
    makeSystem('B', 1, 1, ['A', 'D']),
    makeSystem('C', 1, -1, ['A', 'D']),
    makeSystem('D', 2, 0, ['B', 'C']),
  ]);
}

/**
 * Two disconnected components:  A ─ B   and   C ─ D
 */
function makeDisconnectedGalaxy(): Galaxy {
  return makeGalaxy([
    makeSystem('A', 0, 0, ['B']),
    makeSystem('B', 1, 0, ['A']),
    makeSystem('C', 10, 0, ['D']),
    makeSystem('D', 11, 0, ['C']),
  ]);
}

function makeFleet(overrides: Partial<Fleet> = {}): Fleet {
  return {
    id: 'fleet-1',
    name: 'First Fleet',
    ships: ['ship-1', 'ship-2'],
    empireId: 'empire-1',
    position: { systemId: 'A' },
    destination: null,
    waypoints: [],
    stance: 'defensive',
    ...overrides,
  };
}

function makeShip(id: string, systemId: string, overrides: Partial<Ship> = {}): Ship {
  return {
    id,
    designId: 'design-scout',
    name: `Ship ${id}`,
    hullPoints: 100,
    maxHullPoints: 100,
    systemDamage: {
      engines: 0,
      weapons: 0,
      shields: 0,
      sensors: 0,
      warpDrive: 0,
    },
    position: { systemId },
    fleetId: 'fleet-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createFleet
// ---------------------------------------------------------------------------

describe('createFleet', () => {
  it('creates a fleet with the given name, empireId, systemId, and ships', () => {
    const fleet = createFleet('Alpha Squadron', 'empire-1', 'sol', ['ship-1', 'ship-2']);

    expect(fleet.name).toBe('Alpha Squadron');
    expect(fleet.empireId).toBe('empire-1');
    expect(fleet.position.systemId).toBe('sol');
    expect(fleet.ships).toEqual(['ship-1', 'ship-2']);
  });

  it('assigns a unique id each call', () => {
    const a = createFleet('A', 'empire-1', 'sol', []);
    const b = createFleet('B', 'empire-1', 'sol', []);
    expect(a.id).not.toBe(b.id);
  });

  it('starts with defensive stance, no destination, and no waypoints', () => {
    const fleet = createFleet('Beta', 'empire-1', 'sol', []);
    expect(fleet.stance).toBe('defensive');
    expect(fleet.destination).toBeNull();
    expect(fleet.waypoints).toHaveLength(0);
  });

  it('creates a copy of the shipIds array so the original is not shared', () => {
    const ids = ['ship-1', 'ship-2'];
    const fleet = createFleet('Gamma', 'empire-1', 'sol', ids);
    ids.push('ship-3');
    expect(fleet.ships).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// mergeFleets
// ---------------------------------------------------------------------------

describe('mergeFleets', () => {
  it('combines the ship lists of two fleets in the same system', () => {
    const a = makeFleet({ id: 'fleet-a', ships: ['ship-1', 'ship-2'], position: { systemId: 'A' } });
    const b = makeFleet({ id: 'fleet-b', ships: ['ship-3', 'ship-4'], position: { systemId: 'A' } });

    const merged = mergeFleets(a, b);

    expect(merged.ships).toContain('ship-1');
    expect(merged.ships).toContain('ship-2');
    expect(merged.ships).toContain('ship-3');
    expect(merged.ships).toContain('ship-4');
    expect(merged.ships).toHaveLength(4);
  });

  it('keeps fleetA as the base (id, name, stance, waypoints)', () => {
    const a = makeFleet({ id: 'fleet-a', name: 'Fleet A', stance: 'aggressive', waypoints: ['B'] });
    const b = makeFleet({ id: 'fleet-b', name: 'Fleet B', stance: 'evasive' });

    const merged = mergeFleets(a, b);

    expect(merged.id).toBe('fleet-a');
    expect(merged.name).toBe('Fleet A');
    expect(merged.stance).toBe('aggressive');
    expect(merged.waypoints).toEqual(['B']);
  });

  it('throws when the fleets are in different systems', () => {
    const a = makeFleet({ id: 'fleet-a', position: { systemId: 'A' } });
    const b = makeFleet({ id: 'fleet-b', position: { systemId: 'B' } });

    expect(() => mergeFleets(a, b)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// splitFleet
// ---------------------------------------------------------------------------

describe('splitFleet', () => {
  it('moves the selected ships to a new fleet', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2', 'ship-3'] });
    const { original, newFleet } = splitFleet(fleet, ['ship-3'], 'Detachment');

    expect(original.ships).toEqual(['ship-1', 'ship-2']);
    expect(newFleet.ships).toEqual(['ship-3']);
  });

  it('new fleet has the correct name and is in the same system', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'], position: { systemId: 'C' } });
    const { newFleet } = splitFleet(fleet, ['ship-2'], 'Scouts');

    expect(newFleet.name).toBe('Scouts');
    expect(newFleet.position.systemId).toBe('C');
  });

  it('new fleet starts with no waypoints, no destination, same stance', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'], stance: 'aggressive', waypoints: ['B'] });
    const { newFleet } = splitFleet(fleet, ['ship-2'], 'Detach');

    expect(newFleet.waypoints).toHaveLength(0);
    expect(newFleet.destination).toBeNull();
    expect(newFleet.stance).toBe('aggressive');
  });

  it('original fleet keeps its remaining ships', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2', 'ship-3', 'ship-4'] });
    const { original } = splitFleet(fleet, ['ship-2', 'ship-4'], 'Even Ships');

    expect(original.ships).toEqual(['ship-1', 'ship-3']);
  });

  it('throws if a split ship is not in the fleet', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    expect(() => splitFleet(fleet, ['ship-99'], 'Bad')).toThrow();
  });

  it('throws if the split would leave the original fleet empty', () => {
    const fleet = makeFleet({ ships: ['ship-1'] });
    expect(() => splitFleet(fleet, ['ship-1'], 'Solo')).toThrow();
  });

  it('throws if the split list is empty', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    expect(() => splitFleet(fleet, [], 'Empty')).toThrow();
  });

  it('produces fleets with different IDs', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    const { original, newFleet } = splitFleet(fleet, ['ship-2'], 'New');
    expect(original.id).toBe(fleet.id);
    expect(newFleet.id).not.toBe(fleet.id);
  });
});

// ---------------------------------------------------------------------------
// addShipToFleet / removeShipFromFleet
// ---------------------------------------------------------------------------

describe('addShipToFleet', () => {
  it('adds a ship to the fleet', () => {
    const fleet = makeFleet({ ships: ['ship-1'] });
    const updated = addShipToFleet(fleet, 'ship-2');
    expect(updated.ships).toContain('ship-2');
    expect(updated.ships).toHaveLength(2);
  });

  it('is idempotent — adding an already-present ship is a no-op', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    const updated = addShipToFleet(fleet, 'ship-1');
    expect(updated.ships).toHaveLength(2);
  });

  it('does not mutate the original fleet', () => {
    const fleet = makeFleet({ ships: ['ship-1'] });
    addShipToFleet(fleet, 'ship-2');
    expect(fleet.ships).toHaveLength(1);
  });
});

describe('removeShipFromFleet', () => {
  it('removes the specified ship', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2', 'ship-3'] });
    const updated = removeShipFromFleet(fleet, 'ship-2');
    expect(updated.ships).toEqual(['ship-1', 'ship-3']);
  });

  it('is a no-op if the ship is not in the fleet', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    const updated = removeShipFromFleet(fleet, 'ship-99');
    expect(updated.ships).toHaveLength(2);
  });

  it('does not mutate the original fleet', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    removeShipFromFleet(fleet, 'ship-1');
    expect(fleet.ships).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// issueMovementOrder
// ---------------------------------------------------------------------------

describe('issueMovementOrder', () => {
  it('returns a valid order for a reachable destination', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const order = issueMovementOrder(fleet, galaxy, 'D');

    expect(order).not.toBeNull();
    expect(order!.path).toEqual(['A', 'B', 'C', 'D']);
    expect(order!.currentSegment).toBe(1);
    expect(order!.ticksInTransit).toBe(0);
  });

  it('returns null for an unreachable destination (disconnected galaxy)', () => {
    const galaxy = makeDisconnectedGalaxy();
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const order = issueMovementOrder(fleet, galaxy, 'C');

    expect(order).toBeNull();
  });

  it('returns null when destination equals current position', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ position: { systemId: 'B' } });
    const order = issueMovementOrder(fleet, galaxy, 'B');

    expect(order).toBeNull();
  });

  it('returns null for an unknown destination system', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const order = issueMovementOrder(fleet, galaxy, 'UNKNOWN');

    expect(order).toBeNull();
  });

  it('stores the fleet id in the order', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ id: 'fleet-xyz', position: { systemId: 'A' } });
    const order = issueMovementOrder(fleet, galaxy, 'C');

    expect(order!.fleetId).toBe('fleet-xyz');
  });

  it('respects a custom ticksPerHop value', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const order = issueMovementOrder(fleet, galaxy, 'B', 5);

    expect(order!.ticksPerHop).toBe(5);
  });

  it('finds an alternate route in a diamond galaxy', () => {
    const galaxy = makeDiamondGalaxy();
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const order = issueMovementOrder(fleet, galaxy, 'D');

    expect(order).not.toBeNull();
    expect(order!.path[0]).toBe('A');
    expect(order!.path[order!.path.length - 1]).toBe('D');
  });
});

// ---------------------------------------------------------------------------
// processFleetMovement
// ---------------------------------------------------------------------------

describe('processFleetMovement', () => {
  /**
   * Helper: build a movement order for the linear galaxy A→D (3 hops).
   */
  function makeLinearOrder(overrides: Partial<FleetMovementOrder> = {}): FleetMovementOrder {
    return {
      fleetId: 'fleet-1',
      path: ['A', 'B', 'C', 'D'],
      currentSegment: 1,
      ticksPerHop: 1,
      ticksInTransit: 0,
      ...overrides,
    };
  }

  it('increments ticksInTransit when not yet at hop threshold', () => {
    const order = makeLinearOrder({ ticksPerHop: 3, ticksInTransit: 0 });
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const ships = [makeShip('ship-1', 'A'), makeShip('ship-2', 'A')];

    const result = processFleetMovement(order, fleet, ships);

    expect(result.order?.ticksInTransit).toBe(1);
    expect(result.arrivedAtSystem).toBeNull();
    expect(result.fleet.position.systemId).toBe('A');
  });

  it('moves fleet to next system when hop threshold is reached', () => {
    const order = makeLinearOrder({ ticksPerHop: 1, ticksInTransit: 0, currentSegment: 1 });
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const ships = [makeShip('ship-1', 'A'), makeShip('ship-2', 'A')];

    const result = processFleetMovement(order, fleet, ships);

    expect(result.fleet.position.systemId).toBe('B');
    expect(result.arrivedAtSystem).toBe('B');
    expect(result.order).not.toBeNull();
    expect(result.order!.currentSegment).toBe(2);
  });

  it('updates ship positions when the fleet moves', () => {
    const order = makeLinearOrder({ ticksPerHop: 1, ticksInTransit: 0, currentSegment: 1 });
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const ships = [makeShip('ship-1', 'A'), makeShip('ship-2', 'A')];

    const result = processFleetMovement(order, fleet, ships);

    for (const ship of result.ships) {
      if (fleet.ships.includes(ship.id)) {
        expect(ship.position.systemId).toBe('B');
      }
    }
  });

  it('does not move ships not in the fleet', () => {
    const order = makeLinearOrder({ ticksPerHop: 1, ticksInTransit: 0 });
    const fleet = makeFleet({ ships: ['ship-1'] });
    const ships = [
      makeShip('ship-1', 'A'),
      makeShip('outsider', 'A', { fleetId: null }), // different fleet
    ];

    const result = processFleetMovement(order, fleet, ships);

    const outsider = result.ships.find((s) => s.id === 'outsider')!;
    expect(outsider.position.systemId).toBe('A'); // unchanged
  });

  it('arrives at destination after the correct total number of ticks (ticksPerHop=1)', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const ships = [makeShip('ship-1', 'A')];

    let order = issueMovementOrder(fleet, galaxy, 'D', 1)!;
    let currentFleet = fleet;
    let currentShips = ships;
    let tickCount = 0;
    let arrived: string | null = null;

    // A→B→C→D requires 3 hops at ticksPerHop=1 → exactly 3 ticks
    while (order !== null) {
      const result = processFleetMovement(order, currentFleet, currentShips);
      order = result.order!;
      currentFleet = result.fleet;
      currentShips = result.ships;
      tickCount++;
      if (result.arrivedAtSystem !== null) {
        arrived = result.arrivedAtSystem;
      }
      if (tickCount > 20) throw new Error('Infinite movement loop detected');
    }

    expect(tickCount).toBe(3);
    expect(arrived).toBe('D');
    expect(currentFleet.position.systemId).toBe('D');
  });

  it('arrives at destination after the correct total number of ticks (ticksPerHop=3)', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const ships = [makeShip('ship-1', 'A')];

    let order = issueMovementOrder(fleet, galaxy, 'B', 3)!;
    let currentFleet = fleet;
    let currentShips = ships;
    let tickCount = 0;

    // A→B is 1 hop at ticksPerHop=3 → exactly 3 ticks
    while (order !== null) {
      const result = processFleetMovement(order, currentFleet, currentShips);
      order = result.order!;
      currentFleet = result.fleet;
      currentShips = result.ships;
      tickCount++;
      if (tickCount > 20) throw new Error('Infinite movement loop detected');
    }

    expect(tickCount).toBe(3);
    expect(currentFleet.position.systemId).toBe('B');
  });

  it('returns order=null on arrival at final destination', () => {
    const order = makeLinearOrder({ path: ['A', 'B'], currentSegment: 1, ticksPerHop: 1 });
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const ships = [makeShip('ship-1', 'A')];

    const result = processFleetMovement(order, fleet, ships);

    expect(result.order).toBeNull();
    expect(result.arrivedAtSystem).toBe('B');
    expect(result.fleet.position.systemId).toBe('B');
  });

  it('clears destination when the fleet arrives', () => {
    const order = makeLinearOrder({ path: ['A', 'B'], currentSegment: 1, ticksPerHop: 1 });
    const fleet = makeFleet({ position: { systemId: 'A' }, destination: 'B' });
    const ships: Ship[] = [];

    const result = processFleetMovement(order, fleet, ships);
    expect(result.fleet.destination).toBeNull();
  });

  it('sets fleet.destination to final system while in transit', () => {
    const order = makeLinearOrder({ path: ['A', 'B', 'C'], currentSegment: 1, ticksPerHop: 1 });
    const fleet = makeFleet({ position: { systemId: 'A' } });
    const ships: Ship[] = [];

    const result = processFleetMovement(order, fleet, ships);
    // After first hop fleet is at B; destination is still C
    expect(result.fleet.destination).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// setWaypoints / processWaypoints
// ---------------------------------------------------------------------------

describe('setWaypoints', () => {
  it('sets the waypoints list', () => {
    const fleet = makeFleet({ waypoints: [] });
    const updated = setWaypoints(fleet, ['B', 'C', 'D']);
    expect(updated.waypoints).toEqual(['B', 'C', 'D']);
  });

  it('clears waypoints when passed an empty array', () => {
    const fleet = makeFleet({ waypoints: ['B', 'C'] });
    const updated = setWaypoints(fleet, []);
    expect(updated.waypoints).toHaveLength(0);
  });

  it('does not mutate the original fleet', () => {
    const fleet = makeFleet({ waypoints: [] });
    setWaypoints(fleet, ['B']);
    expect(fleet.waypoints).toHaveLength(0);
  });
});

describe('processWaypoints', () => {
  it('issues a movement order to the first waypoint when fleet has no waypoint position', () => {
    const galaxy = makeLinearGalaxy();
    // Fleet at A, waypoints are B and C; A is not a waypoint so it goes to index 0
    const fleet = makeFleet({ position: { systemId: 'A' }, waypoints: ['B', 'C'] });
    const order = processWaypoints(fleet, galaxy);

    expect(order).not.toBeNull();
    expect(order!.path[order!.path.length - 1]).toBe('B');
  });

  it('advances to the next waypoint when fleet is on an intermediate waypoint', () => {
    const galaxy = makeLinearGalaxy();
    // Fleet is at waypoint B; next should be C
    const fleet = makeFleet({ position: { systemId: 'B' }, waypoints: ['B', 'C'] });
    const order = processWaypoints(fleet, galaxy);

    expect(order).not.toBeNull();
    expect(order!.path[order!.path.length - 1]).toBe('C');
  });

  it('cycles back to the first waypoint after reaching the last', () => {
    const galaxy = makeLinearGalaxy();
    // Fleet is at last waypoint C; next should wrap to A
    const fleet = makeFleet({
      position: { systemId: 'C' },
      waypoints: ['A', 'B', 'C'],
    });
    const order = processWaypoints(fleet, galaxy);

    expect(order).not.toBeNull();
    expect(order!.path[order!.path.length - 1]).toBe('A');
  });

  it('returns null when there are no waypoints', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ waypoints: [] });
    expect(processWaypoints(fleet, galaxy)).toBeNull();
  });

  it('returns null when fleet is already at the only waypoint (single-element list)', () => {
    const galaxy = makeLinearGalaxy();
    const fleet = makeFleet({ position: { systemId: 'B' }, waypoints: ['B'] });
    expect(processWaypoints(fleet, galaxy)).toBeNull();
  });

  it('returns null when the next waypoint is unreachable', () => {
    const galaxy = makeDisconnectedGalaxy();
    // Fleet at A, waypoint is C (unreachable)
    const fleet = makeFleet({ position: { systemId: 'A' }, waypoints: ['A', 'C'] });
    const order = processWaypoints(fleet, galaxy);
    expect(order).toBeNull();
  });

  it('full cycle: fleet visits all 3 waypoints and loops back', () => {
    const galaxy = makeLinearGalaxy();
    const waypoints = ['A', 'B', 'C'];

    let fleet = makeFleet({ position: { systemId: 'A' }, waypoints });
    const visited: string[] = [fleet.position.systemId];
    let ships = [makeShip('ship-1', 'A')];
    let tickCount = 0;

    // Run enough ticks to complete two full loops (6 hops: A→B→C→A→B→C)
    // With ticksPerHop=10, each hop takes 10 ticks, so 6 hops = 60 ticks per loop.
    const maxTicks = 500;
    for (let loop = 0; loop < 2; loop++) {
      for (let targetIdx = 1; targetIdx < waypoints.length; targetIdx++) {
        // Issue order to next waypoint
        const fleetWithWaypoints = setWaypoints(fleet, waypoints);
        let order = processWaypoints(fleetWithWaypoints, galaxy)!;
        expect(order).not.toBeNull();

        while (order !== null) {
          const result = processFleetMovement(order, fleet, ships);
          order = result.order!;
          fleet = result.fleet;
          ships = result.ships;
          tickCount++;
          if (result.arrivedAtSystem !== null) {
            visited.push(result.arrivedAtSystem);
          }
          if (tickCount > maxTicks) throw new Error('Loop did not terminate');
        }
      }
      // Cycle back: issue order from C back to A
      const fleetWithWaypoints = setWaypoints(fleet, waypoints);
      let order = processWaypoints(fleetWithWaypoints, galaxy)!;
      while (order !== null) {
        const result = processFleetMovement(order, fleet, ships);
        order = result.order!;
        fleet = result.fleet;
        ships = result.ships;
        tickCount++;
        if (result.arrivedAtSystem !== null) {
          visited.push(result.arrivedAtSystem);
        }
        if (tickCount > maxTicks) throw new Error('Loop did not terminate');
      }
    }

    // Should have passed through B, C, A, B, C, A (from starting at A)
    expect(visited).toContain('B');
    expect(visited).toContain('C');
    expect(visited).toContain('A');
  });
});

// ---------------------------------------------------------------------------
// getFleetStrength
// ---------------------------------------------------------------------------

describe('getFleetStrength', () => {
  it('returns zero strength for a fleet with no matching ships', () => {
    const fleet = makeFleet({ ships: ['ship-x'] });
    const ships: Ship[] = []; // no ships provided
    const strength = getFleetStrength(fleet, ships);

    expect(strength.shipCount).toBe(0);
    expect(strength.totalHullPoints).toBe(0);
    expect(strength.totalDamage).toBe(0);
    expect(strength.averageSpeed).toBe(0);
  });

  it('sums hull points across all fleet ships', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    const ships = [
      makeShip('ship-1', 'A', { hullPoints: 80 }),
      makeShip('ship-2', 'A', { hullPoints: 60 }),
    ];

    const strength = getFleetStrength(fleet, ships);
    expect(strength.totalHullPoints).toBe(140);
  });

  it('reflects full damage when weapons are intact', () => {
    const fleet = makeFleet({ ships: ['ship-1'] });
    const ships = [makeShip('ship-1', 'A', { hullPoints: 100 })];

    const strength = getFleetStrength(fleet, ships);
    // weapons=0 → effectiveness=1 → totalDamage = hullPoints * 1 = 100
    expect(strength.totalDamage).toBe(100);
  });

  it('reduces totalDamage when weapons are damaged', () => {
    const fleet = makeFleet({ ships: ['ship-1'] });
    const ships = [
      makeShip('ship-1', 'A', {
        hullPoints: 100,
        systemDamage: { engines: 0, weapons: 0.5, shields: 0, sensors: 0, warpDrive: 0 },
      }),
    ];

    const strength = getFleetStrength(fleet, ships);
    // weapons=0.5 → effectiveness=0.5 → totalDamage = 100 * 0.5 = 50
    expect(strength.totalDamage).toBe(50);
  });

  it('reports averageSpeed=0 when all engines are destroyed', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    const ships = [
      makeShip('ship-1', 'A', {
        systemDamage: { engines: 1, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      }),
      makeShip('ship-2', 'A', {
        systemDamage: { engines: 1, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      }),
    ];

    const strength = getFleetStrength(fleet, ships);
    expect(strength.averageSpeed).toBe(0);
  });

  it('averageSpeed is 1 for undamaged fleet (engine effectiveness=1 per ship)', () => {
    const fleet = makeFleet({ ships: ['ship-1', 'ship-2'] });
    const ships = [makeShip('ship-1', 'A'), makeShip('ship-2', 'A')];

    const strength = getFleetStrength(fleet, ships);
    expect(strength.averageSpeed).toBe(1);
  });

  it('only counts ships belonging to the fleet', () => {
    const fleet = makeFleet({ ships: ['ship-1'] });
    const ships = [
      makeShip('ship-1', 'A', { hullPoints: 100 }),
      makeShip('ship-2', 'A', { hullPoints: 200 }), // not in fleet
    ];

    const strength = getFleetStrength(fleet, ships);
    expect(strength.shipCount).toBe(1);
    expect(strength.totalHullPoints).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// setFleetStance
// ---------------------------------------------------------------------------

describe('setFleetStance', () => {
  it('updates the fleet stance', () => {
    const fleet = makeFleet({ stance: 'defensive' });
    const updated = setFleetStance(fleet, 'aggressive');
    expect(updated.stance).toBe('aggressive');
  });

  it('does not mutate the original fleet', () => {
    const fleet = makeFleet({ stance: 'defensive' });
    setFleetStance(fleet, 'evasive');
    expect(fleet.stance).toBe('defensive');
  });

  it('can set all valid stance values', () => {
    const fleet = makeFleet();
    expect(setFleetStance(fleet, 'aggressive').stance).toBe('aggressive');
    expect(setFleetStance(fleet, 'defensive').stance).toBe('defensive');
    expect(setFleetStance(fleet, 'evasive').stance).toBe('evasive');
    expect(setFleetStance(fleet, 'patrol').stance).toBe('patrol');
  });
});

// ---------------------------------------------------------------------------
// startShipProduction / processShipProduction
// ---------------------------------------------------------------------------

describe('startShipProduction', () => {
  it('creates a production order with the correct fields', () => {
    const order = startShipProduction('design-scout', 'planet-1', 5);

    expect(order.designId).toBe('design-scout');
    expect(order.planetId).toBe('planet-1');
    expect(order.totalTicks).toBe(5);
    expect(order.ticksRemaining).toBe(5);
  });
});

describe('processShipProduction', () => {
  it('decrements ticksRemaining each tick', () => {
    const order = startShipProduction('design-scout', 'planet-1', 3);
    const result = processShipProduction(order);

    expect(result.completed).toBe(false);
    expect(result.order).not.toBeNull();
    expect(result.order!.ticksRemaining).toBe(2);
  });

  it('completes (order=null, completed=true) when ticksRemaining reaches zero', () => {
    const order = startShipProduction('design-scout', 'planet-1', 1);
    const result = processShipProduction(order);

    expect(result.completed).toBe(true);
    expect(result.order).toBeNull();
  });

  it('takes exactly buildTime ticks to complete', () => {
    const buildTime = 4;
    let order = startShipProduction('design-cruiser', 'planet-2', buildTime);
    let tickCount = 0;
    let completed = false;

    while (!completed) {
      const result = processShipProduction(order);
      tickCount++;
      if (result.completed) {
        completed = true;
      } else {
        order = result.order!;
      }
      if (tickCount > buildTime + 5) throw new Error('Production loop did not terminate');
    }

    expect(tickCount).toBe(buildTime);
  });

  it('does not mutate the input order', () => {
    const order = startShipProduction('design-scout', 'planet-1', 3);
    const original = order.ticksRemaining;
    processShipProduction(order);
    expect(order.ticksRemaining).toBe(original);
  });

  it('preserves designId and planetId across ticks', () => {
    let order = startShipProduction('design-battleship', 'planet-5', 3);
    for (let i = 0; i < 2; i++) {
      const result = processShipProduction(order);
      if (result.order !== null) {
        expect(result.order.designId).toBe('design-battleship');
        expect(result.order.planetId).toBe('planet-5');
        order = result.order;
      }
    }
  });
});
