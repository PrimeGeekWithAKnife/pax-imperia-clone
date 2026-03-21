/**
 * Galaxy generation algorithm for Ex Nihilo.
 *
 * Entry point: generateGalaxy(config)
 *
 * Pipeline:
 *   1. Place star positions (shape-aware Poisson-disk sampling)
 *   2. Assign star types & names
 *   3. Generate planets per system
 *   4. Build wormhole graph (relative-neighbourhood + connectivity pass)
 *
 * Everything is deterministic given the same config.seed.
 */

import type {
  Galaxy,
  StarSystem,
  StarType,
  Planet,
  PlanetType,
  AtmosphereType,
} from '../types/galaxy.js';
import {
  GALAXY_SIZES,
  type GalaxySize,
  PLANET_GRAVITY_MIN,
  PLANET_GRAVITY_MAX,
  PLANET_TEMPERATURE_MIN,
  PLANET_TEMPERATURE_MAX,
  PLANET_NATURAL_RESOURCES_MIN,
  PLANET_NATURAL_RESOURCES_MAX,
} from '../constants/game.js';
import { clamp } from '../utils/math.js';
import { NameGenerator } from './name-generator.js';

// ── public config & types ─────────────────────────────────────────────────────

export type GalaxyShape = 'spiral' | 'elliptical' | 'irregular' | 'ring';

export interface GalaxyGenerationConfig {
  /** Deterministic seed (integer). */
  seed: number;
  /** Size key from GALAXY_SIZES. */
  size: GalaxySize;
  /** Overall layout shape. */
  shape: GalaxyShape;
  /** Number of human/AI players; used to guarantee one starter system each. */
  playerCount: number;
}

// ── seeded PRNG (mulberry32) ──────────────────────────────────────────────────

/**
 * Mulberry32 — fast, good-quality 32-bit seeded PRNG.
 * Returns floats in [0, 1).
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Float in [min, max). */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Pick a random element from an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
}

// ── galaxy dimensions ─────────────────────────────────────────────────────────

const GALAXY_WIDTH = 1000;
const GALAXY_HEIGHT = 1000;

// ── star-type distribution ────────────────────────────────────────────────────

interface StarTypeEntry {
  type: StarType;
  /** Cumulative probability weight (0-1, summing to 1). */
  weight: number;
}

const STAR_TYPE_TABLE: StarTypeEntry[] = (() => {
  // Raw weights, rough astronomical distribution skewed for gameplay interest
  const raw: Array<[StarType, number]> = [
    ['red_dwarf', 30],
    ['orange', 22],
    ['yellow', 18],
    ['white', 12],
    ['red_giant', 8],
    ['blue_giant', 5],
    ['binary', 4],
    ['neutron', 1],
  ];
  const total = raw.reduce((s, [, w]) => s + w, 0);
  let cum = 0;
  return raw.map(([type, w]) => {
    cum += w / total;
    return { type, weight: cum };
  });
})();

function pickStarType(rng: SeededRng): StarType {
  const roll = rng.next();
  for (const entry of STAR_TYPE_TABLE) {
    if (roll < entry.weight) return entry.type;
  }
  return 'yellow';
}

// ── planet count range per star type ─────────────────────────────────────────

const PLANET_COUNT_BY_STAR: Record<StarType, [number, number]> = {
  blue_giant: [0, 4],
  white: [1, 5],
  yellow: [2, 8],
  orange: [2, 7],
  red_dwarf: [1, 5],
  red_giant: [0, 4],
  neutron: [0, 2],
  binary: [1, 6],
};

// ── planet-type probability tables ───────────────────────────────────────────
// Indexed by normalised orbital position (0 = innermost, 1 = outermost)

function pickPlanetType(rng: SeededRng, orbitFraction: number): PlanetType {
  // Inner zone (<0.4): hot rocky types
  // Mid zone (0.4-0.65): terran/ocean possible
  // Outer zone (>0.65): gas, ice
  const r = rng.next();
  if (orbitFraction < 0.4) {
    if (r < 0.35) return 'volcanic';
    if (r < 0.65) return 'barren';
    if (r < 0.80) return 'desert';
    if (r < 0.92) return 'toxic';
    return 'terran';
  } else if (orbitFraction < 0.65) {
    if (r < 0.25) return 'terran';
    if (r < 0.42) return 'ocean';
    if (r < 0.58) return 'desert';
    if (r < 0.72) return 'barren';
    if (r < 0.82) return 'toxic';
    if (r < 0.90) return 'volcanic';
    return 'gas_giant';
  } else {
    if (r < 0.40) return 'gas_giant';
    if (r < 0.70) return 'ice';
    if (r < 0.82) return 'barren';
    if (r < 0.90) return 'desert';
    return 'toxic';
  }
}

function pickAtmosphere(rng: SeededRng, planetType: PlanetType): AtmosphereType {
  switch (planetType) {
    case 'terran':
    case 'ocean':
      return rng.next() < 0.85 ? 'oxygen_nitrogen' : 'carbon_dioxide';
    case 'desert':
      return rng.next() < 0.6 ? 'carbon_dioxide' : (rng.next() < 0.5 ? 'oxygen_nitrogen' : 'none');
    case 'volcanic':
      return rng.next() < 0.7 ? 'carbon_dioxide' : (rng.next() < 0.6 ? 'toxic' : 'none');
    case 'toxic':
      return rng.next() < 0.7 ? 'toxic' : 'ammonia';
    case 'gas_giant':
      return 'hydrogen_helium';
    case 'ice':
      return rng.next() < 0.5 ? 'none' : (rng.next() < 0.5 ? 'methane' : 'ammonia');
    case 'barren':
      return rng.next() < 0.8 ? 'none' : 'carbon_dioxide';
  }
}

function pickGravity(rng: SeededRng, planetType: PlanetType): number {
  let min: number, max: number;
  switch (planetType) {
    case 'gas_giant': [min, max] = [1.5, 3.0]; break;
    case 'terran':    [min, max] = [0.6, 1.4]; break;
    case 'ocean':     [min, max] = [0.7, 1.3]; break;
    case 'barren':    [min, max] = [0.1, 0.5]; break;
    case 'ice':       [min, max] = [0.1, 0.6]; break;
    default:          [min, max] = [0.3, 1.6]; break;
  }
  return clamp(
    parseFloat(rng.nextFloat(min, max).toFixed(2)),
    PLANET_GRAVITY_MIN,
    PLANET_GRAVITY_MAX,
  );
}

function pickTemperature(
  rng: SeededRng,
  orbitFraction: number,
  starType: StarType,
): number {
  // Base temperature from orbit (inner = hot, outer = cold)
  const baseMin = PLANET_TEMPERATURE_MIN + (1 - orbitFraction) * 200;
  const baseMax = PLANET_TEMPERATURE_MAX * (1 - orbitFraction * 0.85);

  // Star luminosity modifiers
  const starMod: Record<StarType, number> = {
    blue_giant: 1.5,
    white: 1.2,
    yellow: 1.0,
    orange: 0.85,
    red_dwarf: 0.65,
    red_giant: 1.3,
    neutron: 0.5,
    binary: 1.1,
  };
  const mod = starMod[starType];
  const temp = rng.nextFloat(baseMin * mod, baseMax * mod);
  return clamp(Math.round(temp), PLANET_TEMPERATURE_MIN, PLANET_TEMPERATURE_MAX);
}

function pickMaxPopulation(planetType: PlanetType, gravity: number): number {
  const base: Record<PlanetType, number> = {
    terran: 8_000_000_000,
    ocean: 6_000_000_000,
    desert: 3_000_000_000,
    volcanic: 500_000_000,
    barren: 200_000_000,
    ice: 400_000_000,
    gas_giant: 0,
    toxic: 100_000_000,
  };
  const gravPenalty = gravity > 2.0 ? 0.3 : gravity > 1.5 ? 0.6 : 1.0;
  return Math.round((base[planetType] ?? 0) * gravPenalty);
}

// ── ID counter (seeded) ───────────────────────────────────────────────────────

function makeIdGenerator(rng: SeededRng) {
  let counter = 0;
  return (): string => {
    counter++;
    const part = Math.floor(rng.next() * 0xffffff).toString(16).padStart(6, '0');
    return `${part}${counter.toString(16).padStart(4, '0')}`;
  };
}

// ── planet generation ─────────────────────────────────────────────────────────

function generatePlanet(
  rng: SeededRng,
  nextId: () => string,
  systemName: string,
  nameGen: NameGenerator,
  orbitalIndex: number,
  totalPlanets: number,
  starType: StarType,
): Planet {
  const orbitFraction = totalPlanets > 1 ? orbitalIndex / (totalPlanets - 1) : 0.5;
  const type = pickPlanetType(rng, orbitFraction);
  const atmosphere = pickAtmosphere(rng, type);
  const gravity = pickGravity(rng, type);
  const temperature = pickTemperature(rng, orbitFraction, starType);
  const naturalResources = clamp(
    Math.round(rng.nextFloat(PLANET_NATURAL_RESOURCES_MIN, PLANET_NATURAL_RESOURCES_MAX)),
    PLANET_NATURAL_RESOURCES_MIN,
    PLANET_NATURAL_RESOURCES_MAX,
  );
  const maxPopulation = pickMaxPopulation(type, gravity);

  return {
    id: nextId(),
    name: nameGen.generatePlanetName(systemName, orbitalIndex),
    orbitalIndex,
    type,
    atmosphere,
    gravity,
    temperature,
    naturalResources,
    maxPopulation,
    currentPopulation: 0,
    ownerId: null,
    buildings: [],
    productionQueue: [],
  };
}

// ── position generators by shape ─────────────────────────────────────────────

interface CandidatePoint {
  x: number;
  y: number;
}

/**
 * Bridson's Poisson-disk sampling (simplified, grid-accelerated).
 * Returns up to `count` points with min spacing `minDist` in [0, width] x [0, height].
 */
function poissonDisk(
  rng: SeededRng,
  count: number,
  width: number,
  height: number,
  minDist: number,
  inBoundsFn: (x: number, y: number) => boolean,
): CandidatePoint[] {
  const cellSize = minDist / Math.SQRT2;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid: (CandidatePoint | null)[] = new Array(cols * rows).fill(null);
  const active: CandidatePoint[] = [];
  const result: CandidatePoint[] = [];

  const gridIdx = (p: CandidatePoint): number => {
    const c = Math.floor(p.x / cellSize);
    const r = Math.floor(p.y / cellSize);
    return r * cols + c;
  };

  const insert = (p: CandidatePoint): void => {
    grid[gridIdx(p)] = p;
    active.push(p);
    result.push(p);
  };

  const tooClose = (p: CandidatePoint): boolean => {
    const c = Math.floor(p.x / cellSize);
    const r = Math.floor(p.y / cellSize);
    const minC = Math.max(0, c - 2);
    const maxC = Math.min(cols - 1, c + 2);
    const minR = Math.max(0, r - 2);
    const maxR = Math.min(rows - 1, r + 2);
    for (let ri = minR; ri <= maxR; ri++) {
      for (let ci = minC; ci <= maxC; ci++) {
        const nb = grid[ri * cols + ci];
        if (!nb) continue;
        const dx = nb.x - p.x;
        const dy = nb.y - p.y;
        if (dx * dx + dy * dy < minDist * minDist) return true;
      }
    }
    return false;
  };

  // Find a valid starting point
  let tries = 0;
  while (tries < 500) {
    const px = rng.nextFloat(0, width);
    const py = rng.nextFloat(0, height);
    if (inBoundsFn(px, py)) {
      insert({ x: px, y: py });
      break;
    }
    tries++;
  }

  const MAX_ATTEMPTS = 30;
  while (active.length > 0 && result.length < count) {
    const idx = Math.floor(rng.next() * active.length);
    const base = active[idx]!;
    let found = false;

    for (let k = 0; k < MAX_ATTEMPTS; k++) {
      const angle = rng.next() * Math.PI * 2;
      const r = minDist * (1 + rng.next());
      const nx = base.x + Math.cos(angle) * r;
      const ny = base.y + Math.sin(angle) * r;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const cand = { x: nx, y: ny };
      if (!inBoundsFn(nx, ny) || tooClose(cand)) continue;
      insert(cand);
      found = true;
      if (result.length >= count) break;
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  return result;
}

// Aspect-ratio correction helpers
const CX = GALAXY_WIDTH / 2;
const CY = GALAXY_HEIGHT / 2;
const RX = GALAXY_WIDTH * 0.46;  // half-width radius
const RY = GALAXY_HEIGHT * 0.46; // half-height radius

function generatePositions(
  rng: SeededRng,
  count: number,
  shape: GalaxyShape,
): CandidatePoint[] {
  const minDist = Math.sqrt((GALAXY_WIDTH * GALAXY_HEIGHT) / (count * 4));

  switch (shape) {
    case 'elliptical':
      return generateElliptical(rng, count, minDist);
    case 'spiral':
      return generateSpiral(rng, count, minDist);
    case 'ring':
      return generateRing(rng, count, minDist);
    case 'irregular':
    default:
      return generateIrregular(rng, count, minDist);
  }
}

function generateElliptical(
  rng: SeededRng,
  count: number,
  minDist: number,
): CandidatePoint[] {
  // Density falls off from centre (Gaussian-like)
  const inBounds = (x: number, y: number): boolean => {
    const nx = (x - CX) / RX;
    const ny = (y - CY) / RY;
    const r2 = nx * nx + ny * ny;
    if (r2 > 1) return false;
    // Higher probability near centre
    const threshold = 0.15 + 0.85 * (1 - r2);
    return rng.next() < threshold;
  };
  const pts = poissonDisk(rng, count * 3, GALAXY_WIDTH, GALAXY_HEIGHT, minDist, inBounds);
  return pts.slice(0, count);
}

function generateSpiral(
  rng: SeededRng,
  count: number,
  minDist: number,
): CandidatePoint[] {
  const numArms = 2 + rng.nextInt(0, 2); // 2–4 arms
  const armSpread = 0.28;
  const armTwist = Math.PI * 2.5; // radians over full arm length

  const inBounds = (x: number, y: number): boolean => {
    const dx = x - CX;
    const dy = y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = Math.min(RX, RY);
    if (dist > maxR) return false;

    const angle = Math.atan2(dy, dx);
    const normDist = dist / maxR;

    // Check proximity to any arm
    for (let arm = 0; arm < numArms; arm++) {
      const armAngle = (arm / numArms) * Math.PI * 2;
      const expectedAngle = armAngle + normDist * armTwist;
      let diff = ((angle - expectedAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < armSpread * (1 + normDist)) return true;
    }

    // Core region: always accept within 15% of galaxy radius
    if (normDist < 0.15) return true;

    // Sparse inter-arm stars (10% chance)
    return rng.next() < 0.10;
  };

  const pts = poissonDisk(rng, count * 4, GALAXY_WIDTH, GALAXY_HEIGHT, minDist, inBounds);
  return pts.slice(0, count);
}

function generateRing(
  rng: SeededRng,
  count: number,
  minDist: number,
): CandidatePoint[] {
  const innerFrac = 0.35;
  const outerFrac = 0.90;
  const innerR = Math.min(RX, RY) * innerFrac;
  const outerR = Math.min(RX, RY) * outerFrac;

  const inBounds = (x: number, y: number): boolean => {
    const dx = x - CX;
    const dy = y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Thin ring with a small cluster in the centre
    if (dist < innerR * 0.35) return rng.next() < 0.6; // centre cluster
    return dist >= innerR && dist <= outerR;
  };

  const pts = poissonDisk(rng, count * 3, GALAXY_WIDTH, GALAXY_HEIGHT, minDist, inBounds);
  return pts.slice(0, count);
}

function generateIrregular(
  rng: SeededRng,
  count: number,
  minDist: number,
): CandidatePoint[] {
  // 3–5 density blobs anywhere in the field
  const numBlobs = 3 + rng.nextInt(0, 2);
  const blobs: Array<{ cx: number; cy: number; r: number }> = [];
  for (let i = 0; i < numBlobs; i++) {
    blobs.push({
      cx: rng.nextFloat(GALAXY_WIDTH * 0.15, GALAXY_WIDTH * 0.85),
      cy: rng.nextFloat(GALAXY_HEIGHT * 0.15, GALAXY_HEIGHT * 0.85),
      r: rng.nextFloat(GALAXY_WIDTH * 0.10, GALAXY_WIDTH * 0.32),
    });
  }

  const inBounds = (x: number, y: number): boolean => {
    for (const b of blobs) {
      const dx = x - b.cx;
      const dy = y - b.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.r) {
        const threshold = 0.3 + 0.7 * (1 - dist / b.r);
        if (rng.next() < threshold) return true;
      }
    }
    return false;
  };

  const pts = poissonDisk(rng, count * 4, GALAXY_WIDTH, GALAXY_HEIGHT, minDist, inBounds);
  return pts.slice(0, count);
}

// ── wormhole graph construction ───────────────────────────────────────────────

/**
 * Relative Neighbourhood Graph: edge (u,v) exists iff there is no point w
 * closer to both u and v than the distance |uv|.
 *
 * This gives a sparse, planar-like graph that naturally creates chokepoints.
 * We augment it with a connectivity pass to ensure the graph is fully connected.
 */
function buildWormholeGraph(
  systems: StarSystem[],
  rng: SeededRng,
): Map<string, Set<string>> {
  const n = systems.length;
  const adj = new Map<string, Set<string>>();
  for (const sys of systems) {
    adj.set(sys.id, new Set());
  }

  const dist = (i: number, j: number): number => {
    const a = systems[i]!;
    const b = systems[j]!;
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Build RNG
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dij = dist(i, j);
      let isRelativeNeighbour = true;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        if (dist(i, k) < dij && dist(j, k) < dij) {
          isRelativeNeighbour = false;
          break;
        }
      }
      if (isRelativeNeighbour) {
        adj.get(systems[i]!.id)!.add(systems[j]!.id);
        adj.get(systems[j]!.id)!.add(systems[i]!.id);
      }
    }
  }

  // Enforce connectivity with BFS
  ensureConnected(systems, adj, rng);

  // Enforce minimum degree of 1 (no isolated nodes after connectivity pass)
  for (const sys of systems) {
    if (adj.get(sys.id)!.size === 0) {
      // Find nearest system and connect
      let minD = Infinity;
      let nearestId = '';
      for (const other of systems) {
        if (other.id === sys.id) continue;
        const dx = sys.position.x - other.position.x;
        const dy = sys.position.y - other.position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) { minD = d; nearestId = other.id; }
      }
      if (nearestId) {
        adj.get(sys.id)!.add(nearestId);
        adj.get(nearestId)!.add(sys.id);
      }
    }
  }

  // Trim nodes with degree > 4 by removing longest edges
  for (const sys of systems) {
    const neighbours = adj.get(sys.id)!;
    if (neighbours.size > 4) {
      // Sort neighbours by distance, drop the farthest
      const sorted = Array.from(neighbours).sort((a, b) => {
        const sa = systems.find(s => s.id === a)!;
        const sb = systems.find(s => s.id === b)!;
        const dxa = sys.position.x - sa.position.x;
        const dya = sys.position.y - sa.position.y;
        const dxb = sys.position.x - sb.position.x;
        const dyb = sys.position.y - sb.position.y;
        return Math.sqrt(dxa * dxa + dya * dya) - Math.sqrt(dxb * dxb + dyb * dyb);
      });
      // Keep only the 4 nearest
      for (let k = 4; k < sorted.length; k++) {
        const removeId = sorted[k]!;
        adj.get(sys.id)!.delete(removeId);
        adj.get(removeId)!.delete(sys.id);
      }
    }
  }

  // Re-verify connectivity after degree trimming
  ensureConnected(systems, adj, rng);

  return adj;
}

/** BFS to find connected components; bridge disconnected pieces by shortest cross-edge. */
function ensureConnected(
  systems: StarSystem[],
  adj: Map<string, Set<string>>,
  _rng: SeededRng,
): void {
  if (systems.length === 0) return;

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const sys of systems) {
    if (visited.has(sys.id)) continue;
    const component: string[] = [];
    const queue: string[] = [sys.id];
    visited.add(sys.id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      component.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    components.push(component);
  }

  if (components.length <= 1) return;

  const idToSys = new Map<string, StarSystem>(systems.map(s => [s.id, s]));

  // Greedily merge each subsequent component into the first by shortest bridge
  for (let i = 1; i < components.length; i++) {
    let bestDist = Infinity;
    let bestA = '';
    let bestB = '';
    const mainSet = new Set(components.slice(0, i).flat());
    for (const a of mainSet) {
      const sa = idToSys.get(a)!;
      for (const b of components[i]!) {
        const sb = idToSys.get(b)!;
        const dx = sa.position.x - sb.position.x;
        const dy = sa.position.y - sb.position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; bestA = a; bestB = b; }
      }
    }
    if (bestA && bestB) {
      adj.get(bestA)!.add(bestB);
      adj.get(bestB)!.add(bestA);
      // Merge component i into components[0] for subsequent iterations
      components[0]!.push(...components[i]!);
    }
  }
}

// ── main entry point ──────────────────────────────────────────────────────────

export function generateGalaxy(config: GalaxyGenerationConfig): Galaxy {
  const rng = new SeededRng(config.seed);
  const nextId = makeIdGenerator(rng);
  const nameGen = new NameGenerator(new SeededRng(config.seed + 1));

  const targetCount = GALAXY_SIZES[config.size];

  // 1. Place star positions
  const positions = generatePositions(rng, targetCount, config.shape);

  // Fallback: if Poisson didn't produce enough points, fill randomly
  while (positions.length < targetCount) {
    positions.push({
      x: rng.nextFloat(50, GALAXY_WIDTH - 50),
      y: rng.nextFloat(50, GALAXY_HEIGHT - 50),
    });
  }

  // 2. Build star systems (no wormholes yet)
  const systems: StarSystem[] = positions.slice(0, targetCount).map(pos => {
    const starType = pickStarType(rng);
    const [minPlanets, maxPlanets] = PLANET_COUNT_BY_STAR[starType];
    const planetCount = rng.nextInt(minPlanets, maxPlanets);
    const systemName = nameGen.generateSystemName();

    const planets: Planet[] = [];
    for (let pi = 0; pi < planetCount; pi++) {
      planets.push(
        generatePlanet(rng, nextId, systemName, nameGen, pi, planetCount, starType),
      );
    }

    return {
      id: nextId(),
      name: systemName,
      position: { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 },
      starType,
      planets,
      wormholes: [],
      ownerId: null,
      discovered: {},
    };
  });

  // 3. Build wormhole graph
  const adjMap = buildWormholeGraph(systems, rng);

  // 4. Write wormholes back into each system
  for (const sys of systems) {
    sys.wormholes = Array.from(adjMap.get(sys.id) ?? []);
  }

  return {
    id: nextId(),
    systems,
    width: GALAXY_WIDTH,
    height: GALAXY_HEIGHT,
    seed: config.seed,
  };
}
