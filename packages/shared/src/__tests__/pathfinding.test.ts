import { describe, it, expect } from 'vitest';
import {
  findPath,
  findReachableSystems,
  isGalaxyConnected,
  findChokepointSystems,
} from '../pathfinding/astar.js';
import type { Galaxy, StarSystem } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Test galaxy builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal StarSystem with only the fields the pathfinding code uses.
 */
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
  return {
    id: 'test-galaxy',
    systems,
    width: 1000,
    height: 1000,
    seed: 0,
  };
}

/**
 * Linear chain:  A ─ B ─ C ─ D
 *
 *   A(0,0)  B(3,0)  C(6,0)  D(9,0)
 *   edge lengths all = 3
 */
function makeLinearGalaxy(): Galaxy {
  return makeGalaxy([
    makeSystem('A', 0, 0, ['B']),
    makeSystem('B', 3, 0, ['A', 'C']),
    makeSystem('C', 6, 0, ['B', 'D']),
    makeSystem('D', 9, 0, ['C']),
  ]);
}

/**
 * Diamond (two paths from A to D):
 *
 *       B (3,4)
 *      / \
 *  A(0,0)   D(6,0)
 *      \ /
 *       C (3,-4)
 *
 *  A-B = 5,  B-D = 5  → A-B-D = 10
 *  A-C = 5,  C-D = 5  → A-C-D = 10  (same length, both optimal)
 *  A-D direct = 6 (no direct edge)
 */
function makeDiamondGalaxy(): Galaxy {
  return makeGalaxy([
    makeSystem('A', 0, 0, ['B', 'C']),
    makeSystem('B', 3, 4, ['A', 'D']),
    makeSystem('C', 3, -4, ['A', 'D']),
    makeSystem('D', 6, 0, ['B', 'C']),
  ]);
}

/**
 * Disconnected: two separate components
 *   Component 1: A ─ B
 *   Component 2: C ─ D
 */
function makeDisconnectedGalaxy(): Galaxy {
  return makeGalaxy([
    makeSystem('A', 0, 0, ['B']),
    makeSystem('B', 1, 0, ['A']),
    makeSystem('C', 10, 0, ['D']),
    makeSystem('D', 11, 0, ['C']),
  ]);
}

/**
 * Star topology with a central hub:
 *
 *       L1
 *       |
 *  L2 - HUB - L3
 *       |
 *       L4
 *
 * HUB is an articulation point (removing it disconnects all leaves).
 * None of the leaf nodes are articulation points.
 */
function makeStarGalaxy(): Galaxy {
  return makeGalaxy([
    makeSystem('HUB', 5, 5, ['L1', 'L2', 'L3', 'L4']),
    makeSystem('L1', 5, 0, ['HUB']),
    makeSystem('L2', 0, 5, ['HUB']),
    makeSystem('L3', 10, 5, ['HUB']),
    makeSystem('L4', 5, 10, ['HUB']),
  ]);
}

/**
 * Bridge graph:  A ─ B ─ C ─ D ─ E
 *                    |       |
 *                    F       G
 *
 * B and D are articulation points (and C as the sole bridge between
 * the two "wings").  Actually in a simple chain every interior node is AP.
 *
 * Simpler version for clear assertion — the bridge node X connects two cliques:
 *
 *  (A ─ B)  ── X ──  (C ─ D)
 *   A-B-X-C-D with extra edge A-B and C-D forming two triangles around X.
 *
 * Here only X is an articulation point.
 */
function makeBridgeGalaxy(): Galaxy {
  // Left triangle: A-B-X
  // Right triangle: X-C-D
  // X is the only articulation point
  return makeGalaxy([
    makeSystem('A', 0, 1, ['B', 'X']),
    makeSystem('B', 0, -1, ['A', 'X']),
    makeSystem('X', 3, 0, ['A', 'B', 'C', 'D']),
    makeSystem('C', 6, 1, ['X', 'D']),
    makeSystem('D', 6, -1, ['X', 'C']),
  ]);
}

/**
 * Single-node galaxy (edge case).
 */
function makeSingleNodeGalaxy(): Galaxy {
  return makeGalaxy([makeSystem('SOLO', 0, 0, [])]);
}

// ---------------------------------------------------------------------------
// findPath
// ---------------------------------------------------------------------------

describe('findPath', () => {
  it('returns the direct edge when systems are directly connected', () => {
    const galaxy = makeLinearGalaxy();
    const result = findPath(galaxy, 'A', 'B');
    expect(result.found).toBe(true);
    expect(result.path).toEqual(['A', 'B']);
    expect(result.totalDistance).toBeCloseTo(3);
  });

  it('finds a multi-hop path through intermediate systems', () => {
    const galaxy = makeLinearGalaxy();
    const result = findPath(galaxy, 'A', 'D');
    expect(result.found).toBe(true);
    expect(result.path).toEqual(['A', 'B', 'C', 'D']);
    expect(result.totalDistance).toBeCloseTo(9);
  });

  it('returns found=false when systems are disconnected', () => {
    const galaxy = makeDisconnectedGalaxy();
    const result = findPath(galaxy, 'A', 'C');
    expect(result.found).toBe(false);
    expect(result.path).toHaveLength(0);
    expect(result.totalDistance).toBe(0);
  });

  it('returns found=false when start system ID is unknown', () => {
    const galaxy = makeLinearGalaxy();
    const result = findPath(galaxy, 'UNKNOWN', 'A');
    expect(result.found).toBe(false);
  });

  it('returns found=false when end system ID is unknown', () => {
    const galaxy = makeLinearGalaxy();
    const result = findPath(galaxy, 'A', 'UNKNOWN');
    expect(result.found).toBe(false);
  });

  it('handles start == end (trivial path)', () => {
    const galaxy = makeLinearGalaxy();
    const result = findPath(galaxy, 'B', 'B');
    expect(result.found).toBe(true);
    expect(result.path).toEqual(['B']);
    expect(result.totalDistance).toBe(0);
  });

  it('path is optimal — chooses the shortest distance route in the diamond', () => {
    const galaxy = makeDiamondGalaxy();
    const result = findPath(galaxy, 'A', 'D');
    expect(result.found).toBe(true);
    // Both routes A-B-D and A-C-D have length 10; path must have exactly 3 nodes
    expect(result.path).toHaveLength(3);
    expect(result.path[0]).toBe('A');
    expect(result.path[2]).toBe('D');
    expect(result.totalDistance).toBeCloseTo(10);
  });

  it('path includes start and end nodes', () => {
    const galaxy = makeLinearGalaxy();
    const result = findPath(galaxy, 'A', 'C');
    expect(result.path[0]).toBe('A');
    expect(result.path[result.path.length - 1]).toBe('C');
  });

  it('totalDistance matches sum of edge lengths along the returned path', () => {
    const galaxy = makeLinearGalaxy();
    const result = findPath(galaxy, 'A', 'D');
    expect(result.found).toBe(true);
    // Manually verify: A→B=3, B→C=3, C→D=3  → total = 9
    expect(result.totalDistance).toBeCloseTo(9, 5);
  });

  it('works on a single-node galaxy (start == end)', () => {
    const galaxy = makeSingleNodeGalaxy();
    const result = findPath(galaxy, 'SOLO', 'SOLO');
    expect(result.found).toBe(true);
    expect(result.path).toEqual(['SOLO']);
    expect(result.totalDistance).toBe(0);
  });

  it('returns found=false when seeking a path from a solo node to non-existent node', () => {
    const galaxy = makeSingleNodeGalaxy();
    const result = findPath(galaxy, 'SOLO', 'NOWHERE');
    expect(result.found).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findReachableSystems
// ---------------------------------------------------------------------------

describe('findReachableSystems', () => {
  it('returns direct neighbors within 1 hop', () => {
    const galaxy = makeLinearGalaxy();
    const reachable = findReachableSystems(galaxy, 'B', 1);
    expect(reachable.sort()).toEqual(['A', 'C']);
  });

  it('returns all systems within 2 hops', () => {
    const galaxy = makeLinearGalaxy();
    const reachable = findReachableSystems(galaxy, 'B', 2);
    expect(reachable.sort()).toEqual(['A', 'C', 'D']);
  });

  it('does not include the starting system itself', () => {
    const galaxy = makeLinearGalaxy();
    const reachable = findReachableSystems(galaxy, 'A', 3);
    expect(reachable).not.toContain('A');
  });

  it('returns empty array for maxHops=0', () => {
    const galaxy = makeLinearGalaxy();
    expect(findReachableSystems(galaxy, 'A', 0)).toHaveLength(0);
  });

  it('returns empty array for unknown system ID', () => {
    const galaxy = makeLinearGalaxy();
    expect(findReachableSystems(galaxy, 'UNKNOWN', 5)).toHaveLength(0);
  });

  it('does not cross into disconnected components', () => {
    const galaxy = makeDisconnectedGalaxy();
    const reachable = findReachableSystems(galaxy, 'A', 10);
    expect(reachable.sort()).toEqual(['B']);
    expect(reachable).not.toContain('C');
    expect(reachable).not.toContain('D');
  });

  it('reaches all connected nodes with large hop count', () => {
    const galaxy = makeLinearGalaxy();
    const reachable = findReachableSystems(galaxy, 'A', 100);
    expect(reachable.sort()).toEqual(['B', 'C', 'D']);
  });

  it('works on star topology — hub sees all leaves in 1 hop', () => {
    const galaxy = makeStarGalaxy();
    const reachable = findReachableSystems(galaxy, 'HUB', 1);
    expect(reachable.sort()).toEqual(['L1', 'L2', 'L3', 'L4']);
  });

  it('leaf sees other leaves within 2 hops via hub', () => {
    const galaxy = makeStarGalaxy();
    const reachable = findReachableSystems(galaxy, 'L1', 2);
    expect(reachable.sort()).toEqual(['HUB', 'L2', 'L3', 'L4']);
  });
});

// ---------------------------------------------------------------------------
// isGalaxyConnected
// ---------------------------------------------------------------------------

describe('isGalaxyConnected', () => {
  it('returns true for a fully connected linear chain', () => {
    expect(isGalaxyConnected(makeLinearGalaxy())).toBe(true);
  });

  it('returns true for the diamond galaxy', () => {
    expect(isGalaxyConnected(makeDiamondGalaxy())).toBe(true);
  });

  it('returns true for the star topology', () => {
    expect(isGalaxyConnected(makeStarGalaxy())).toBe(true);
  });

  it('returns false for a disconnected galaxy', () => {
    expect(isGalaxyConnected(makeDisconnectedGalaxy())).toBe(false);
  });

  it('returns true for a single-node galaxy', () => {
    expect(isGalaxyConnected(makeSingleNodeGalaxy())).toBe(true);
  });

  it('returns true for an empty galaxy', () => {
    expect(isGalaxyConnected(makeGalaxy([]))).toBe(true);
  });

  it('returns false when one node has no wormholes in an otherwise connected graph', () => {
    const galaxy = makeGalaxy([
      makeSystem('A', 0, 0, ['B']),
      makeSystem('B', 1, 0, ['A']),
      makeSystem('ISLAND', 5, 5, []), // isolated
    ]);
    expect(isGalaxyConnected(galaxy)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findChokepointSystems
// ---------------------------------------------------------------------------

describe('findChokepointSystems', () => {
  it('identifies the hub as the sole articulation point in a star topology', () => {
    const result = findChokepointSystems(makeStarGalaxy());
    expect(result).toEqual(['HUB']);
  });

  it('returns no articulation points for a triangle (fully redundant)', () => {
    const galaxy = makeGalaxy([
      makeSystem('A', 0, 0, ['B', 'C']),
      makeSystem('B', 1, 0, ['A', 'C']),
      makeSystem('C', 0.5, 1, ['A', 'B']),
    ]);
    expect(findChokepointSystems(galaxy)).toHaveLength(0);
  });

  it('identifies the bridge node X as the sole articulation point', () => {
    const result = findChokepointSystems(makeBridgeGalaxy());
    expect(result).toEqual(['X']);
  });

  it('returns all interior nodes as articulation points in a chain', () => {
    // A-B-C: removing B disconnects A and C
    const galaxy = makeGalaxy([
      makeSystem('A', 0, 0, ['B']),
      makeSystem('B', 1, 0, ['A', 'C']),
      makeSystem('C', 2, 0, ['B']),
    ]);
    const result = findChokepointSystems(galaxy);
    expect(result).toContain('B');
    expect(result).not.toContain('A');
    expect(result).not.toContain('C');
  });

  it('returns empty array for a single-node galaxy', () => {
    expect(findChokepointSystems(makeSingleNodeGalaxy())).toHaveLength(0);
  });

  it('returns empty array for an empty galaxy', () => {
    expect(findChokepointSystems(makeGalaxy([]))).toHaveLength(0);
  });

  it('returns empty array for a disconnected graph with no internal bridges', () => {
    // Two isolated edges: A-B and C-D; no node is an AP within its component
    // (each component is just an edge, no interior node)
    const result = findChokepointSystems(makeDisconnectedGalaxy());
    // A and C are endpoints; B and D are endpoints — none are APs
    expect(result).toHaveLength(0);
  });

  it('identifies multiple articulation points in a barbell graph', () => {
    // Left clique: A-B-C (triangle)
    // Bridge: B-X
    // Right clique: X-D-E (triangle)
    // Both B and X are articulation points
    const galaxy = makeGalaxy([
      makeSystem('A', 0, 1, ['B', 'C']),
      makeSystem('B', 0, -1, ['A', 'C', 'X']),
      makeSystem('C', -1, 0, ['A', 'B']),
      makeSystem('X', 3, 0, ['B', 'D', 'E']),
      makeSystem('D', 4, 1, ['X', 'E']),
      makeSystem('E', 4, -1, ['X', 'D']),
    ]);
    const result = findChokepointSystems(galaxy);
    expect(result).toContain('B');
    expect(result).toContain('X');
    expect(result).not.toContain('A');
    expect(result).not.toContain('C');
    expect(result).not.toContain('D');
    expect(result).not.toContain('E');
  });
});
