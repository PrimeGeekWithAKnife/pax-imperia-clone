import { describe, it, expect } from 'vitest';
import {
  establishTradeRoute,
  tickTradeRoutes,
  rerouteTradeRoute,
  calculateTradeRevenue,
} from '../engine/trade-routes.js';
import type { TradeRoute } from '../types/trade-routes.js';
import type { Galaxy, StarSystem, Planet, Building } from '../types/galaxy.js';
import type { Fleet } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeBuilding(type: Building['type']): Building {
  return { id: `bld-${type}`, type, level: 1 };
}

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'Home',
    orbitalIndex: 3,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 295,
    naturalResources: 50,
    maxPopulation: 1_000_000_000,
    currentPopulation: 500_000,
    ownerId: 'empire-1',
    buildings: [],
    productionQueue: [],
    ...overrides,
  };
}

function makeSystem(overrides: Partial<StarSystem>): StarSystem {
  return {
    id: 'sys-default',
    name: 'Default',
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [],
    wormholes: [],
    ownerId: null,
    discovered: {},
    ...overrides,
  };
}

/**
 * Build a linear chain galaxy: A -- B -- C -- D
 * Each system has a planet with naturalResources = 50.
 */
function makeLinearGalaxy(): Galaxy {
  return {
    id: 'galaxy-1',
    systems: [
      makeSystem({
        id: 'sys-a',
        name: 'Alpha',
        position: { x: 0, y: 0 },
        planets: [makePlanet({ id: 'p-a', name: 'Alpha I', naturalResources: 50 })],
        wormholes: ['sys-b'],
        ownerId: 'empire-1',
      }),
      makeSystem({
        id: 'sys-b',
        name: 'Beta',
        position: { x: 100, y: 0 },
        planets: [makePlanet({ id: 'p-b', name: 'Beta I', naturalResources: 50 })],
        wormholes: ['sys-a', 'sys-c'],
        ownerId: null,
      }),
      makeSystem({
        id: 'sys-c',
        name: 'Gamma',
        position: { x: 200, y: 0 },
        planets: [makePlanet({ id: 'p-c', name: 'Gamma I', naturalResources: 50 })],
        wormholes: ['sys-b', 'sys-d'],
        ownerId: null,
      }),
      makeSystem({
        id: 'sys-d',
        name: 'Delta',
        position: { x: 300, y: 0 },
        planets: [makePlanet({ id: 'p-d', name: 'Delta I', naturalResources: 50 })],
        wormholes: ['sys-c'],
        ownerId: 'empire-2',
      }),
    ],
    anomalies: [],
    minorSpecies: [],
    width: 500,
    height: 500,
    seed: 42,
  };
}

/**
 * Build a diamond galaxy with an alternative path:
 *
 *       B
 *      / \
 *     A   D
 *      \ /
 *       C
 */
function makeDiamondGalaxy(): Galaxy {
  return {
    id: 'galaxy-2',
    systems: [
      makeSystem({
        id: 'sys-a',
        name: 'Alpha',
        position: { x: 0, y: 50 },
        planets: [makePlanet({ id: 'p-a', name: 'Alpha I', naturalResources: 60 })],
        wormholes: ['sys-b', 'sys-c'],
        ownerId: 'empire-1',
      }),
      makeSystem({
        id: 'sys-b',
        name: 'Beta',
        position: { x: 100, y: 0 },
        planets: [makePlanet({ id: 'p-b', name: 'Beta I', naturalResources: 40 })],
        wormholes: ['sys-a', 'sys-d'],
        ownerId: null,
      }),
      makeSystem({
        id: 'sys-c',
        name: 'Gamma',
        position: { x: 100, y: 100 },
        planets: [makePlanet({ id: 'p-c', name: 'Gamma I', naturalResources: 40 })],
        wormholes: ['sys-a', 'sys-d'],
        ownerId: null,
      }),
      makeSystem({
        id: 'sys-d',
        name: 'Delta',
        position: { x: 200, y: 50 },
        planets: [makePlanet({ id: 'p-d', name: 'Delta I', naturalResources: 60 })],
        wormholes: ['sys-b', 'sys-c'],
        ownerId: 'empire-2',
      }),
    ],
    anomalies: [],
    minorSpecies: [],
    width: 500,
    height: 500,
    seed: 42,
  };
}

function makeFleet(overrides: Partial<Fleet>): Fleet {
  return {
    id: 'fleet-1',
    name: 'Fleet Alpha',
    ships: ['ship-1'],
    empireId: 'empire-3',
    position: { systemId: 'sys-b' },
    destination: null,
    waypoints: [],
    stance: 'aggressive',
    ...overrides,
  };
}

function makeRoute(overrides: Partial<TradeRoute> = {}): TradeRoute {
  return {
    id: 'route-1',
    empireId: 'empire-1',
    partnerEmpireId: 'empire-2',
    sourceSystemId: 'sys-a',
    destinationSystemId: 'sys-d',
    path: ['sys-a', 'sys-b', 'sys-c', 'sys-d'],
    status: 'active',
    goods: { exports: {}, imports: {} },
    revenuePerTick: 10,
    partnerRevenuePerTick: 8,
    age: 0,
    maturityBonus: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// establishTradeRoute
// ---------------------------------------------------------------------------

describe('establishTradeRoute', () => {
  it('calculates the shortest path between source and destination', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', galaxy);

    expect(route).not.toBeNull();
    expect(route!.path).toEqual(['sys-a', 'sys-b', 'sys-c', 'sys-d']);
  });

  it('sets initial status to establishing', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', galaxy);

    expect(route!.status).toBe('establishing');
  });

  it('sets age and maturity to zero', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', galaxy);

    expect(route!.age).toBe(0);
    expect(route!.maturityBonus).toBe(0);
  });

  it('assigns empire and partner IDs correctly', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', galaxy);

    expect(route!.empireId).toBe('empire-1');
    expect(route!.partnerEmpireId).toBe('empire-2');
  });

  it('calculates base revenue from system resource production', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', galaxy);

    expect(route!.revenuePerTick).toBeGreaterThan(0);
    expect(route!.partnerRevenuePerTick).toBeGreaterThan(0);
    expect(route!.partnerRevenuePerTick).toBeLessThanOrEqual(route!.revenuePerTick);
  });

  it('returns null when no path exists', () => {
    const galaxy = makeLinearGalaxy();
    // Disconnect sys-c from sys-d
    const sysC = galaxy.systems.find((s) => s.id === 'sys-c')!;
    sysC.wormholes = ['sys-b'];
    const sysD = galaxy.systems.find((s) => s.id === 'sys-d')!;
    sysD.wormholes = [];

    const route = establishTradeRoute('sys-a', 'sys-d', 'empire-1', 'empire-2', galaxy);
    expect(route).toBeNull();
  });

  it('returns null when source system does not exist', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-missing', 'sys-d', 'empire-1', 'empire-2', galaxy);
    expect(route).toBeNull();
  });

  it('returns null when destination system does not exist', () => {
    const galaxy = makeLinearGalaxy();
    const route = establishTradeRoute('sys-a', 'sys-missing', 'empire-1', 'empire-2', galaxy);
    expect(route).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tickTradeRoutes — maturity
// ---------------------------------------------------------------------------

describe('tickTradeRoutes — maturity', () => {
  it('increments age by 1 each tick', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ age: 5 });

    const [updated] = tickTradeRoutes([route], galaxy, []);
    expect(updated!.age).toBe(6);
  });

  it('increases maturity bonus over time, capping at 1.0', () => {
    const galaxy = makeLinearGalaxy();
    let routes = [makeRoute({ age: 0, maturityBonus: 0 })];

    // Tick 50 times to reach max maturity
    for (let i = 0; i < 50; i++) {
      routes = tickTradeRoutes(routes, galaxy, []);
    }

    expect(routes[0]!.maturityBonus).toBe(1.0);
  });

  it('maturity bonus does not exceed 1.0 after many ticks', () => {
    const galaxy = makeLinearGalaxy();
    let routes = [makeRoute({ age: 100, maturityBonus: 1.0 })];

    routes = tickTradeRoutes(routes, galaxy, []);
    expect(routes[0]!.maturityBonus).toBe(1.0);
  });

  it('transitions establishing to active after 5 ticks', () => {
    const galaxy = makeLinearGalaxy();
    let routes = [makeRoute({ status: 'establishing', age: 0 })];

    // Tick 4 times — should still be establishing
    for (let i = 0; i < 4; i++) {
      routes = tickTradeRoutes(routes, galaxy, []);
    }
    expect(routes[0]!.status).toBe('establishing');

    // Tick once more — should become active
    routes = tickTradeRoutes(routes, galaxy, []);
    expect(routes[0]!.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// tickTradeRoutes — disruption
// ---------------------------------------------------------------------------

describe('tickTradeRoutes — disruption', () => {
  it('sets status to disrupted when hostile fleets are on intermediate path systems', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'active' });
    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-b' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [hostileFleet]);
    expect(updated!.status).toBe('disrupted');
  });

  it('sets status to blockaded when hostile fleets are at the source system', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'active' });
    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-a' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [hostileFleet]);
    expect(updated!.status).toBe('blockaded');
  });

  it('sets status to blockaded when hostile fleets are at the destination system', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'active' });
    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-d' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [hostileFleet]);
    expect(updated!.status).toBe('blockaded');
  });

  it('does not disrupt when fleets belong to the route owner', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'active' });
    const ownFleet = makeFleet({
      empireId: 'empire-1',
      position: { systemId: 'sys-b' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [ownFleet]);
    expect(updated!.status).toBe('active');
  });

  it('does not disrupt when fleets belong to the trade partner', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'active' });
    const partnerFleet = makeFleet({
      empireId: 'empire-2',
      position: { systemId: 'sys-c' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [partnerFleet]);
    expect(updated!.status).toBe('active');
  });

  it('restores disrupted route to active when threat is cleared', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'disrupted' });

    // No hostile fleets present
    const [updated] = tickTradeRoutes([route], galaxy, []);
    expect(updated!.status).toBe('active');
  });

  it('does not check for hostiles on establishing routes', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'establishing', age: 0 });
    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-b' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [hostileFleet]);
    expect(updated!.status).toBe('establishing');
  });

  it('leaves cancelled routes unchanged', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'cancelled', age: 10 });

    const [updated] = tickTradeRoutes([route], galaxy, []);
    expect(updated!.status).toBe('cancelled');
    expect(updated!.age).toBe(10); // Should not increment
  });
});

// ---------------------------------------------------------------------------
// tickTradeRoutes — revenue
// ---------------------------------------------------------------------------

describe('tickTradeRoutes — revenue', () => {
  it('revenue increases with maturity', () => {
    const galaxy = makeLinearGalaxy();
    const youngRoute = makeRoute({ status: 'active', age: 1, maturityBonus: 0.0 });
    const matureRoute = makeRoute({ status: 'active', age: 50, maturityBonus: 1.0 });

    const [young] = tickTradeRoutes([youngRoute], galaxy, []);
    const [mature] = tickTradeRoutes([matureRoute], galaxy, []);

    expect(mature!.revenuePerTick).toBeGreaterThan(young!.revenuePerTick);
  });

  it('disrupted route earns reduced revenue', () => {
    const galaxy = makeLinearGalaxy();
    const activeRoute = makeRoute({ status: 'active', maturityBonus: 0.5 });
    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-b' },
    });

    const [active] = tickTradeRoutes([activeRoute], galaxy, []);
    const [disrupted] = tickTradeRoutes([activeRoute], galaxy, [hostileFleet]);

    expect(disrupted!.revenuePerTick).toBeLessThan(active!.revenuePerTick);
    expect(disrupted!.revenuePerTick).toBeGreaterThan(0);
  });

  it('blockaded route earns zero revenue', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'active' });
    const hostileFleet = makeFleet({
      empireId: 'empire-3',
      position: { systemId: 'sys-a' },
    });

    const [updated] = tickTradeRoutes([route], galaxy, [hostileFleet]);
    expect(updated!.revenuePerTick).toBe(0);
    expect(updated!.partnerRevenuePerTick).toBe(0);
  });

  it('establishing route earns zero revenue', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'establishing', age: 0 });

    const [updated] = tickTradeRoutes([route], galaxy, []);
    expect(updated!.revenuePerTick).toBe(0);
  });

  it('partner revenue is less than owner revenue', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({ status: 'active', maturityBonus: 0.5 });

    const [updated] = tickTradeRoutes([route], galaxy, []);
    expect(updated!.partnerRevenuePerTick).toBeLessThanOrEqual(updated!.revenuePerTick);
  });
});

// ---------------------------------------------------------------------------
// rerouteTradeRoute
// ---------------------------------------------------------------------------

describe('rerouteTradeRoute', () => {
  it('finds an alternative path avoiding blocked systems', () => {
    const galaxy = makeDiamondGalaxy();
    const route = makeRoute({
      sourceSystemId: 'sys-a',
      destinationSystemId: 'sys-d',
      path: ['sys-a', 'sys-b', 'sys-d'],
    });

    const rerouted = rerouteTradeRoute(route, galaxy, ['sys-b']);

    expect(rerouted.status).toBe('rerouting');
    expect(rerouted.path).not.toContain('sys-b');
    expect(rerouted.path[0]).toBe('sys-a');
    expect(rerouted.path[rerouted.path.length - 1]).toBe('sys-d');
  });

  it('cancels the route when no alternative path exists', () => {
    const galaxy = makeLinearGalaxy();
    const route = makeRoute({
      sourceSystemId: 'sys-a',
      destinationSystemId: 'sys-d',
      path: ['sys-a', 'sys-b', 'sys-c', 'sys-d'],
    });

    // Block both intermediate systems — no path possible
    const rerouted = rerouteTradeRoute(route, galaxy, ['sys-b', 'sys-c']);

    expect(rerouted.status).toBe('cancelled');
  });

  it('preserves source and destination even if they appear in blocked list', () => {
    const galaxy = makeDiamondGalaxy();
    const route = makeRoute({
      sourceSystemId: 'sys-a',
      destinationSystemId: 'sys-d',
      path: ['sys-a', 'sys-b', 'sys-d'],
    });

    // Block the source system — should still find a path because source is preserved
    const rerouted = rerouteTradeRoute(route, galaxy, ['sys-a', 'sys-b']);

    // Source is preserved so path through sys-c should work
    expect(rerouted.status).toBe('rerouting');
    expect(rerouted.path).toContain('sys-a');
    expect(rerouted.path).toContain('sys-d');
  });

  it('sets status to rerouting on successful reroute', () => {
    const galaxy = makeDiamondGalaxy();
    const route = makeRoute({
      sourceSystemId: 'sys-a',
      destinationSystemId: 'sys-d',
      path: ['sys-a', 'sys-b', 'sys-d'],
    });

    const rerouted = rerouteTradeRoute(route, galaxy, ['sys-b']);
    expect(rerouted.status).toBe('rerouting');
  });
});

// ---------------------------------------------------------------------------
// calculateTradeRevenue
// ---------------------------------------------------------------------------

describe('calculateTradeRevenue', () => {
  it('returns owner and partner revenue for an active route', () => {
    const route = makeRoute({
      status: 'active',
      revenuePerTick: 10,
      maturityBonus: 0.5,
    });

    const { ownerRevenue, partnerRevenue } = calculateTradeRevenue(route);

    expect(ownerRevenue).toBeGreaterThan(0);
    expect(partnerRevenue).toBeGreaterThan(0);
    expect(partnerRevenue).toBeLessThanOrEqual(ownerRevenue);
  });

  it('returns zero revenue for cancelled routes', () => {
    const route = makeRoute({
      status: 'cancelled',
      revenuePerTick: 10,
      maturityBonus: 0.5,
    });

    const { ownerRevenue, partnerRevenue } = calculateTradeRevenue(route);
    expect(ownerRevenue).toBe(0);
    expect(partnerRevenue).toBe(0);
  });

  it('returns zero revenue for blockaded routes', () => {
    const route = makeRoute({
      status: 'blockaded',
      revenuePerTick: 10,
      maturityBonus: 0.5,
    });

    const { ownerRevenue, partnerRevenue } = calculateTradeRevenue(route);
    expect(ownerRevenue).toBe(0);
    expect(partnerRevenue).toBe(0);
  });

  it('returns reduced revenue for disrupted routes', () => {
    const activeRoute = makeRoute({
      status: 'active',
      revenuePerTick: 10,
      maturityBonus: 0.5,
    });
    const disruptedRoute = makeRoute({
      status: 'disrupted',
      revenuePerTick: 10,
      maturityBonus: 0.5,
    });

    const active = calculateTradeRevenue(activeRoute);
    const disrupted = calculateTradeRevenue(disruptedRoute);

    expect(disrupted.ownerRevenue).toBeLessThan(active.ownerRevenue);
    expect(disrupted.ownerRevenue).toBeGreaterThan(0);
  });

  it('revenue scales with maturity bonus', () => {
    const immature = makeRoute({
      status: 'active',
      revenuePerTick: 10,
      maturityBonus: 0.0,
    });
    const mature = makeRoute({
      status: 'active',
      revenuePerTick: 10,
      maturityBonus: 1.0,
    });

    const immatureRevenue = calculateTradeRevenue(immature);
    const matureRevenue = calculateTradeRevenue(mature);

    expect(matureRevenue.ownerRevenue).toBeGreaterThan(immatureRevenue.ownerRevenue);
  });
});
