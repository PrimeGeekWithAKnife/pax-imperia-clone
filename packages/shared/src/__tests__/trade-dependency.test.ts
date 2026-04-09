import { describe, it, expect } from 'vitest';
import { calculateTradeDependency } from '../engine/trade-dependency.js';
import type { BasicTradeRoute } from '../engine/trade.js';
import type { Galaxy, StarSystem } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSystem(id: string, ownerId: string | null): StarSystem {
  return {
    id,
    name: id,
    position: { x: 0, y: 0 },
    starType: 'yellow',
    planets: [],
    wormholes: [],
    ownerId,
    discovered: {},
  };
}

function makeRoute(
  overrides: Partial<BasicTradeRoute> & { id: string },
): BasicTradeRoute {
  return {
    empireId: 'empire-a',
    originSystemId: 'sys-a',
    destinationSystemId: 'sys-b',
    income: 10,
    established: 0,
    ...overrides,
  };
}

function makeGalaxy(systems: StarSystem[]): Galaxy {
  return {
    id: 'galaxy-1',
    systems,
    anomalies: [],
    minorSpecies: [],
    width: 1000,
    height: 1000,
    seed: 42,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateTradeDependency', () => {
  it('returns an empty record when there are no trade routes', () => {
    const galaxy = makeGalaxy([makeSystem('sys-a', 'empire-a')]);
    const result = calculateTradeDependency([], 'empire-a', galaxy);
    expect(result).toEqual({});
  });

  it('returns 100% dependency on a single partner', () => {
    const galaxy = makeGalaxy([
      makeSystem('sys-a', 'empire-a'),
      makeSystem('sys-b', 'empire-b'),
    ]);
    const routes: BasicTradeRoute[] = [
      makeRoute({ id: 'r1', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-b', income: 20 }),
    ];

    const result = calculateTradeDependency(routes, 'empire-a', galaxy);
    expect(result).toEqual({ 'empire-b': 1.0 });
  });

  it('returns 100% when two routes go to the same partner', () => {
    const galaxy = makeGalaxy([
      makeSystem('sys-a', 'empire-a'),
      makeSystem('sys-b', 'empire-b'),
      makeSystem('sys-c', 'empire-b'),
    ]);
    const routes: BasicTradeRoute[] = [
      makeRoute({ id: 'r1', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-b', income: 10 }),
      makeRoute({ id: 'r2', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-c', income: 10 }),
    ];

    const result = calculateTradeDependency(routes, 'empire-a', galaxy);
    expect(result).toEqual({ 'empire-b': 1.0 });
  });

  it('returns 50% each when two routes go to different partners with equal income', () => {
    const galaxy = makeGalaxy([
      makeSystem('sys-a', 'empire-a'),
      makeSystem('sys-b', 'empire-b'),
      makeSystem('sys-c', 'empire-c'),
    ]);
    const routes: BasicTradeRoute[] = [
      makeRoute({ id: 'r1', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-b', income: 15 }),
      makeRoute({ id: 'r2', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-c', income: 15 }),
    ];

    const result = calculateTradeDependency(routes, 'empire-a', galaxy);
    expect(result).toEqual({ 'empire-b': 0.5, 'empire-c': 0.5 });
  });

  it('excludes routes belonging to other empires', () => {
    const galaxy = makeGalaxy([
      makeSystem('sys-a', 'empire-a'),
      makeSystem('sys-b', 'empire-b'),
      makeSystem('sys-x', 'empire-x'),
      makeSystem('sys-y', 'empire-y'),
    ]);
    const routes: BasicTradeRoute[] = [
      makeRoute({ id: 'r1', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-b', income: 10 }),
      makeRoute({ id: 'r2', empireId: 'empire-x', originSystemId: 'sys-x', destinationSystemId: 'sys-y', income: 50 }),
    ];

    const result = calculateTradeDependency(routes, 'empire-a', galaxy);
    expect(result).toEqual({ 'empire-b': 1.0 });
  });

  it('ignores routes with zero income', () => {
    const galaxy = makeGalaxy([
      makeSystem('sys-a', 'empire-a'),
      makeSystem('sys-b', 'empire-b'),
      makeSystem('sys-c', 'empire-c'),
    ]);
    const routes: BasicTradeRoute[] = [
      makeRoute({ id: 'r1', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-b', income: 0 }),
      makeRoute({ id: 'r2', empireId: 'empire-a', originSystemId: 'sys-a', destinationSystemId: 'sys-c', income: 20 }),
    ];

    const result = calculateTradeDependency(routes, 'empire-a', galaxy);
    // Zero-income route contributes nothing; empire-c is 100%
    expect(result).toEqual({ 'empire-c': 1.0 });
  });
});
