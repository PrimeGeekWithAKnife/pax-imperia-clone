/** A* pathfinding and graph analysis on the galaxy wormhole network */

import type { Galaxy, StarSystem } from '../types/galaxy.js';
import { distance2D } from '../utils/math.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PathResult {
  /** System IDs from start to end, inclusive. Empty when found=false. */
  path: string[];
  /** Sum of Euclidean distances along each edge in the path. */
  totalDistance: number;
  /** Whether a path was found. */
  found: boolean;
}

// ---------------------------------------------------------------------------
// Internal: min-heap priority queue
// ---------------------------------------------------------------------------

interface HeapNode {
  id: string;
  priority: number;
}

class MinHeap {
  private readonly heap: HeapNode[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(node: HeapNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0] as HeapNode;
    const last = this.heap.pop() as HeapNode;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if ((this.heap[parent] as HeapNode).priority <= (this.heap[index] as HeapNode).priority) break;
      this.swap(parent, index);
      index = parent;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    for (;;) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      if (left < length && (this.heap[left] as HeapNode).priority < (this.heap[smallest] as HeapNode).priority) {
        smallest = left;
      }
      if (right < length && (this.heap[right] as HeapNode).priority < (this.heap[smallest] as HeapNode).priority) {
        smallest = right;
      }
      if (smallest === index) break;
      this.swap(smallest, index);
      index = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.heap[a] as HeapNode;
    this.heap[a] = this.heap[b] as HeapNode;
    this.heap[b] = tmp;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a lookup map from system ID to StarSystem for O(1) access. */
function buildSystemMap(galaxy: Galaxy): Map<string, StarSystem> {
  const map = new Map<string, StarSystem>();
  for (const system of galaxy.systems) {
    map.set(system.id, system);
  }
  return map;
}

/** Reconstruct path array from the cameFrom map. */
function reconstructPath(cameFrom: Map<string, string>, startId: string, endId: string): string[] {
  const path: string[] = [];
  let current: string | undefined = endId;
  while (current !== undefined) {
    path.push(current);
    current = current === startId ? undefined : cameFrom.get(current);
  }
  path.reverse();
  return path;
}

// ---------------------------------------------------------------------------
// A* pathfinding
// ---------------------------------------------------------------------------

/**
 * Find the shortest-distance path between two star systems using A*.
 *
 * Edge cost:  Euclidean distance between adjacent systems.
 * Heuristic:  Euclidean distance to the goal (admissible because straight-line
 *             distance never overestimates the actual edge distance).
 */
export function findPath(galaxy: Galaxy, startSystemId: string, endSystemId: string): PathResult {
  const notFound: PathResult = { path: [], totalDistance: 0, found: false };

  const systemMap = buildSystemMap(galaxy);

  const startSystem = systemMap.get(startSystemId);
  const endSystem = systemMap.get(endSystemId);
  if (startSystem === undefined || endSystem === undefined) return notFound;

  // Trivial case: same system
  if (startSystemId === endSystemId) {
    return { path: [startSystemId], totalDistance: 0, found: true };
  }

  // g[id] = best known cost from start to id
  const g = new Map<string, number>();
  g.set(startSystemId, 0);

  const cameFrom = new Map<string, string>();

  const open = new MinHeap();
  open.push({ id: startSystemId, priority: distance2D(startSystem.position, endSystem.position) });

  // Track which nodes have been fully settled
  const closed = new Set<string>();

  while (open.size > 0) {
    const current = open.pop() as HeapNode;
    const currentId = current.id;

    if (closed.has(currentId)) continue;
    closed.add(currentId);

    if (currentId === endSystemId) {
      const path = reconstructPath(cameFrom, startSystemId, endSystemId);
      return { path, totalDistance: g.get(endSystemId) ?? 0, found: true };
    }

    const currentSystem = systemMap.get(currentId);
    if (currentSystem === undefined) continue;
    const gCurrent = g.get(currentId) ?? Infinity;

    for (const neighborId of currentSystem.wormholes) {
      if (closed.has(neighborId)) continue;
      const neighborSystem = systemMap.get(neighborId);
      if (neighborSystem === undefined) continue;

      const edgeCost = distance2D(currentSystem.position, neighborSystem.position);
      const tentativeG = gCurrent + edgeCost;

      if (tentativeG < (g.get(neighborId) ?? Infinity)) {
        g.set(neighborId, tentativeG);
        cameFrom.set(neighborId, currentId);
        const h = distance2D(neighborSystem.position, endSystem.position);
        open.push({ id: neighborId, priority: tentativeG + h });
      }
    }
  }

  return notFound;
}

// ---------------------------------------------------------------------------
// BFS: reachable systems within N hops
// ---------------------------------------------------------------------------

/**
 * Return the IDs of all star systems reachable from `systemId` within
 * `maxHops` wormhole jumps (not counting the starting system itself).
 */
export function findReachableSystems(galaxy: Galaxy, systemId: string, maxHops: number): string[] {
  const systemMap = buildSystemMap(galaxy);
  if (!systemMap.has(systemId)) return [];
  if (maxHops <= 0) return [];

  const visited = new Set<string>([systemId]);
  // frontier entries: [id, hopsUsed]
  let frontier: string[] = [systemId];

  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      const system = systemMap.get(id);
      if (system === undefined) continue;
      for (const neighborId of system.wormholes) {
        if (!visited.has(neighborId) && systemMap.has(neighborId)) {
          visited.add(neighborId);
          next.push(neighborId);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  // Exclude the starting system from the result
  visited.delete(systemId);
  return Array.from(visited);
}

// ---------------------------------------------------------------------------
// Connectivity check
// ---------------------------------------------------------------------------

/**
 * Return true if every star system in the galaxy is reachable from every
 * other star system via wormhole connections.
 */
export function isGalaxyConnected(galaxy: Galaxy): boolean {
  if (galaxy.systems.length === 0) return true;

  const systemMap = buildSystemMap(galaxy);
  const startId = (galaxy.systems[0] as StarSystem).id;

  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    const current = systemMap.get(currentId);
    if (current === undefined) continue;
    for (const neighborId of current.wormholes) {
      if (!visited.has(neighborId) && systemMap.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return visited.size === galaxy.systems.length;
}

// ---------------------------------------------------------------------------
// Articulation points (chokepoint systems)
// ---------------------------------------------------------------------------

/**
 * Find all articulation points in the galaxy wormhole graph — systems whose
 * removal would disconnect at least one other part of the galaxy.
 *
 * Uses Tarjan's iterative DFS-based algorithm to avoid stack overflow on
 * large galaxies.
 */
export function findChokepointSystems(galaxy: Galaxy): string[] {
  if (galaxy.systems.length === 0) return [];

  const systemMap = buildSystemMap(galaxy);
  const ids = galaxy.systems.map((s) => s.id);

  // Assign each node a numeric index for the algorithm
  const indexMap = new Map<string, number>();
  ids.forEach((id, i) => indexMap.set(id, i));

  const disc = new Array<number>(ids.length).fill(-1);
  const low = new Array<number>(ids.length).fill(0);
  const parent = new Array<number>(ids.length).fill(-1);
  const isAP = new Array<boolean>(ids.length).fill(false);
  let timer = 0;

  // Iterative DFS using an explicit stack to avoid recursion limits
  for (let startIdx = 0; startIdx < ids.length; startIdx++) {
    if (disc[startIdx] !== -1) continue;

    // Stack entries: [nodeIndex, iteratorIndex into neighbor list]
    const stack: Array<[number, number]> = [[startIdx, 0]];
    disc[startIdx] = low[startIdx] = timer++;

    while (stack.length > 0) {
      const top = stack[stack.length - 1] as [number, number];
      const [u, childPtr] = top;
      const uId = ids[u] as string;
      const uSystem = systemMap.get(uId);
      const neighbors = uSystem !== undefined ? uSystem.wormholes : [];

      if (childPtr < neighbors.length) {
        // Advance the iterator for u
        top[1]++;
        const vId = neighbors[childPtr] as string;
        const v = indexMap.get(vId);
        if (v === undefined) continue;

        if (disc[v] === -1) {
          // Tree edge: push v onto the DFS stack
          parent[v] = u;
          disc[v] = low[v] = timer++;
          stack.push([v, 0]);
        } else if (v !== parent[u]) {
          // Back edge: update low[u]
          if (disc[v] < low[u]) {
            low[u] = disc[v];
          }
        }
      } else {
        // All neighbors of u processed — pop and update parent
        stack.pop();
        const p = parent[u];
        if (p !== -1) {
          if (low[u] < low[p]) {
            low[p] = low[u];
          }
          // u is an articulation point if:
          //   a) p is root and has >1 DFS child, or
          //   b) p is non-root and low[u] >= disc[p]
          if (parent[p] === -1) {
            // p is root: count DFS children of p
            // We detect this by checking when we return to p for each child
            // Mark with a sentinel on last child processing below.
            // Actually handle the root case after the loop.
          } else {
            if (low[u] >= disc[p]) {
              isAP[p] = true;
            }
          }
        }
      }
    }

    // Root articulation point: root is AP if it has >1 DFS child
    // Count DFS children of startIdx
    const uId = ids[startIdx] as string;
    const uSystem = systemMap.get(uId);
    if (uSystem !== undefined) {
      let rootChildren = 0;
      for (const neighborId of uSystem.wormholes) {
        const v = indexMap.get(neighborId);
        if (v !== undefined && parent[v] === startIdx) {
          rootChildren++;
        }
      }
      if (rootChildren > 1) {
        isAP[startIdx] = true;
      }
    }
  }

  return ids.filter((_, i) => isAP[i]);
}
