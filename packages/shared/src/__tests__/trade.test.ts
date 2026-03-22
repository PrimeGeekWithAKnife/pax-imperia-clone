import { describe, it, expect } from 'vitest';
import {
  canEstablishTradeRoute,
  calculateTradeRouteIncome,
  processTradeRoutes,
  type TradeRoute,
} from '../engine/trade.js';
import type { Galaxy, StarSystem, Planet, Building } from '../types/galaxy.js';

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

/** Build a minimal two-system connected galaxy. */
function makeGalaxy(): Galaxy {
  const systemA: StarSystem = {
    id: 'sys-a',
    name: 'Alpha',
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [
      makePlanet({
        id: 'planet-a1',
        name: 'Alpha I',
        ownerId: 'empire-1',
        buildings: [makeBuilding('spaceport')],
      }),
    ],
    wormholes: ['sys-b'],
    ownerId: 'empire-1',
    discovered: { 'empire-1': true },
  };

  const systemB: StarSystem = {
    id: 'sys-b',
    name: 'Beta',
    position: { x: 100, y: 0 },
    starType: 'orange',
    planets: [
      makePlanet({
        id: 'planet-b1',
        name: 'Beta I',
        ownerId: 'empire-1',
        buildings: [makeBuilding('spaceport')],
      }),
    ],
    wormholes: ['sys-a'],
    ownerId: 'empire-1',
    discovered: { 'empire-1': true },
  };

  return {
    id: 'galaxy-1',
    systems: [systemA, systemB],
    width: 500,
    height: 500,
    seed: 42,
  };
}

function makeRoute(overrides: Partial<TradeRoute> = {}): TradeRoute {
  return {
    id: 'route-1',
    empireId: 'empire-1',
    originSystemId: 'sys-a',
    destinationSystemId: 'sys-b',
    income: 10,
    established: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// canEstablishTradeRoute
// ---------------------------------------------------------------------------

describe('canEstablishTradeRoute', () => {
  it('returns allowed when both systems have spaceports and are connected', () => {
    const galaxy = makeGalaxy();
    const result = canEstablishTradeRoute('empire-1', 'sys-a', 'sys-b', galaxy);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects when origin equals destination', () => {
    const galaxy = makeGalaxy();
    const result = canEstablishTradeRoute('empire-1', 'sys-a', 'sys-a', galaxy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/different/i);
  });

  it('rejects when origin system does not exist', () => {
    const galaxy = makeGalaxy();
    const result = canEstablishTradeRoute('empire-1', 'sys-missing', 'sys-b', galaxy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it('rejects when destination system does not exist', () => {
    const galaxy = makeGalaxy();
    const result = canEstablishTradeRoute('empire-1', 'sys-a', 'sys-missing', galaxy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it('rejects when origin system has no spaceport', () => {
    const galaxy = makeGalaxy();
    // Remove spaceport from sys-a's planet
    const sysA = galaxy.systems.find(s => s.id === 'sys-a')!;
    sysA.planets[0]!.buildings = [];

    const result = canEstablishTradeRoute('empire-1', 'sys-a', 'sys-b', galaxy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/spaceport/i);
  });

  it('rejects when destination system has no spaceport', () => {
    const galaxy = makeGalaxy();
    const sysB = galaxy.systems.find(s => s.id === 'sys-b')!;
    sysB.planets[0]!.buildings = [];

    const result = canEstablishTradeRoute('empire-1', 'sys-a', 'sys-b', galaxy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/spaceport/i);
  });

  it('rejects when systems are not connected via wormholes', () => {
    const galaxy = makeGalaxy();
    // Disconnect the wormholes
    const sysA = galaxy.systems.find(s => s.id === 'sys-a')!;
    const sysB = galaxy.systems.find(s => s.id === 'sys-b')!;
    sysA.wormholes = [];
    sysB.wormholes = [];

    const result = canEstablishTradeRoute('empire-1', 'sys-a', 'sys-b', galaxy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/wormhole/i);
  });

  it('rejects when the spaceport belongs to a different empire', () => {
    const galaxy = makeGalaxy();
    // Change spaceport planet owner to empire-2
    const sysA = galaxy.systems.find(s => s.id === 'sys-a')!;
    sysA.planets[0]!.ownerId = 'empire-2';

    const result = canEstablishTradeRoute('empire-1', 'sys-a', 'sys-b', galaxy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/spaceport/i);
  });
});

// ---------------------------------------------------------------------------
// calculateTradeIncome
// ---------------------------------------------------------------------------

describe('calculateTradeRouteIncome', () => {
  it('returns at least 1 credit/tick for distance 0', () => {
    const route = makeRoute();
    expect(calculateTradeRouteIncome(route, 0)).toBe(1);
  });

  it('returns 10 credits/tick for distance 100 (normalisation distance)', () => {
    const route = makeRoute();
    expect(calculateTradeRouteIncome(route, 100)).toBe(10);
  });

  it('doubles income for double the distance', () => {
    const route = makeRoute();
    const near = calculateTradeRouteIncome(route, 100);
    const far = calculateTradeRouteIncome(route, 200);
    expect(far).toBe(near * 2);
  });

  it('returns proportionally higher income for longer routes', () => {
    const route = makeRoute();
    const income50 = calculateTradeRouteIncome(route, 50);
    const income100 = calculateTradeRouteIncome(route, 100);
    expect(income100).toBeGreaterThan(income50);
  });

  it('rounds the result to the nearest integer', () => {
    const route = makeRoute();
    const result = calculateTradeRouteIncome(route, 33);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// processTradeRoutes
// ---------------------------------------------------------------------------

describe('processTradeRoutes', () => {
  it('returns empty income map when there are no routes', () => {
    const galaxy = makeGalaxy();
    const { income } = processTradeRoutes([], galaxy);
    expect(income.size).toBe(0);
  });

  it('credits the correct empire for a single route', () => {
    const galaxy = makeGalaxy();
    const route = makeRoute({ empireId: 'empire-1' });
    const { income } = processTradeRoutes([route], galaxy);
    expect(income.has('empire-1')).toBe(true);
    expect((income.get('empire-1') ?? 0)).toBeGreaterThan(0);
  });

  it('accumulates income from multiple routes belonging to the same empire', () => {
    const galaxy = makeGalaxy();
    // Add a third system for the second route
    galaxy.systems.push({
      id: 'sys-c',
      name: 'Gamma',
      position: { x: 200, y: 0 },
      starType: 'red_dwarf',
      planets: [
        makePlanet({
          id: 'planet-c1',
          name: 'Gamma I',
          ownerId: 'empire-1',
          buildings: [makeBuilding('spaceport')],
        }),
      ],
      wormholes: ['sys-b'],
      ownerId: 'empire-1',
      discovered: { 'empire-1': true },
    });
    galaxy.systems.find(s => s.id === 'sys-b')!.wormholes.push('sys-c');

    const route1 = makeRoute({ id: 'r1', originSystemId: 'sys-a', destinationSystemId: 'sys-b' });
    const route2 = makeRoute({ id: 'r2', originSystemId: 'sys-b', destinationSystemId: 'sys-c' });

    const { income } = processTradeRoutes([route1, route2], galaxy);
    const total = income.get('empire-1') ?? 0;

    // Each route earns at least 1 credit, so total should be >= 2
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('tracks income separately for different empires', () => {
    const galaxy = makeGalaxy();
    // Add empire-2 spaceport to sys-b's planet
    const sysB = galaxy.systems.find(s => s.id === 'sys-b')!;
    sysB.planets.push(
      makePlanet({
        id: 'planet-b2',
        name: 'Beta II',
        ownerId: 'empire-2',
        buildings: [makeBuilding('spaceport')],
      }),
    );

    // Add a third system owned by empire-2
    galaxy.systems.push({
      id: 'sys-d',
      name: 'Delta',
      position: { x: 150, y: 0 },
      starType: 'white',
      planets: [
        makePlanet({
          id: 'planet-d1',
          name: 'Delta I',
          ownerId: 'empire-2',
          buildings: [makeBuilding('spaceport')],
        }),
      ],
      wormholes: ['sys-b'],
      ownerId: 'empire-2',
      discovered: { 'empire-2': true },
    });
    sysB.wormholes.push('sys-d');

    const route1 = makeRoute({ id: 'r1', empireId: 'empire-1' });
    const route2: TradeRoute = {
      id: 'r2',
      empireId: 'empire-2',
      originSystemId: 'sys-b',
      destinationSystemId: 'sys-d',
      income: 5,
      established: 1,
    };

    const { income } = processTradeRoutes([route1, route2], galaxy);

    expect(income.has('empire-1')).toBe(true);
    expect(income.has('empire-2')).toBe(true);
    expect(income.get('empire-1')).not.toBe(income.get('empire-2'));
  });

  it('skips routes referencing systems that no longer exist', () => {
    const galaxy = makeGalaxy();
    const route: TradeRoute = {
      id: 'r-ghost',
      empireId: 'empire-1',
      originSystemId: 'sys-gone',
      destinationSystemId: 'sys-b',
      income: 10,
      established: 1,
    };

    // Should not throw
    const { income } = processTradeRoutes([route], galaxy);
    expect(income.get('empire-1') ?? 0).toBe(0);
  });

  it('income scales with physical distance between systems', () => {
    // Near galaxy: systems 50 apart; far galaxy: systems 200 apart
    function galaxyWithDistance(dist: number): Galaxy {
      return {
        id: 'g',
        systems: [
          {
            id: 'sys-a',
            name: 'A',
            position: { x: 0, y: 0 },
            starType: 'yellow',
            planets: [makePlanet({ id: 'pa', ownerId: 'empire-1', buildings: [makeBuilding('spaceport')] })],
            wormholes: ['sys-b'],
            ownerId: 'empire-1',
            discovered: {},
          },
          {
            id: 'sys-b',
            name: 'B',
            position: { x: dist, y: 0 },
            starType: 'orange',
            planets: [makePlanet({ id: 'pb', ownerId: 'empire-1', buildings: [makeBuilding('spaceport')] })],
            wormholes: ['sys-a'],
            ownerId: 'empire-1',
            discovered: {},
          },
        ],
        width: 1000,
        height: 1000,
        seed: 1,
      };
    }

    const route = makeRoute();
    const { income: nearIncome } = processTradeRoutes([route], galaxyWithDistance(50));
    const { income: farIncome } = processTradeRoutes([route], galaxyWithDistance(200));

    expect((farIncome.get('empire-1') ?? 0)).toBeGreaterThan((nearIncome.get('empire-1') ?? 0));
  });
});
