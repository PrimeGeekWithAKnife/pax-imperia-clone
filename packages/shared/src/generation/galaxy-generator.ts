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
 *   5. Scatter anomalies across systems
 *   6. Seed minor species on habitable planets
 *
 * Everything is deterministic given the same config.seed.
 */

import type {
  Galaxy,
  GalaxyShapeMetadata,
  StarSystem,
  StarType,
  Planet,
  PlanetType,
  PlanetSize,
  PlanetModifier,
  PlanetModifierType,
  AtmosphereType,
} from '../types/galaxy.js';
import type { Anomaly, AnomalyType } from '../types/anomaly.js';
import type {
  MinorSpecies,
  MinorSpeciesBiology,
  MinorSpeciesTechLevel,
} from '../types/minor-species.js';
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

/** Weighted size distribution — bell-curved toward average. */
const SIZE_WEIGHTS: { size: PlanetSize; weight: number }[] = [
  { size: 'colossal', weight: 2 },
  { size: 'gigantic', weight: 4 },
  { size: 'very_large', weight: 8 },
  { size: 'large', weight: 14 },
  { size: 'above_average', weight: 18 },
  { size: 'average', weight: 20 },
  { size: 'below_average', weight: 16 },
  { size: 'small', weight: 10 },
  { size: 'very_small', weight: 5 },
  { size: 'tiny', weight: 3 },
];

function pickPlanetSize(rng: SeededRng, planetType: PlanetType): PlanetSize {
  // Gas giants are always large+; barren/toxic tend smaller
  if (planetType === 'gas_giant') {
    const bigSizes: PlanetSize[] = ['colossal', 'gigantic', 'very_large', 'large'];
    return bigSizes[Math.floor(rng.nextFloat(0, bigSizes.length))]!;
  }
  if (planetType === 'barren') {
    const smallBias = rng.nextFloat(0, 1);
    if (smallBias < 0.4) return 'tiny';
    if (smallBias < 0.7) return 'very_small';
    if (smallBias < 0.9) return 'small';
    return 'below_average';
  }
  // Weighted random for habitable types
  const totalWeight = SIZE_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let roll = rng.nextFloat(0, totalWeight);
  for (const entry of SIZE_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.size;
  }
  return 'average';
}

/** Fertility depends on planet type — terran/ocean are fertile, barren/volcanic are not. */
function pickFertility(rng: SeededRng, planetType: PlanetType): number {
  switch (planetType) {
    case 'terran': return Math.round(rng.nextFloat(55, 100));
    case 'ocean': return Math.round(rng.nextFloat(45, 90));
    case 'desert': return Math.round(rng.nextFloat(5, 35));
    case 'ice': return Math.round(rng.nextFloat(0, 20));
    case 'volcanic': return Math.round(rng.nextFloat(0, 10));
    case 'barren': return Math.round(rng.nextFloat(0, 5));
    case 'toxic': return Math.round(rng.nextFloat(0, 8));
    case 'gas_giant': return 0;
    default: return Math.round(rng.nextFloat(10, 50));
  }
}

/** Beauty depends on planet type with wide variance. */
function pickBeauty(rng: SeededRng, planetType: PlanetType): number {
  switch (planetType) {
    case 'terran': return Math.round(rng.nextFloat(40, 100));
    case 'ocean': return Math.round(rng.nextFloat(50, 95));
    case 'desert': return Math.round(rng.nextFloat(15, 60));
    case 'ice': return Math.round(rng.nextFloat(30, 80));
    case 'volcanic': return Math.round(rng.nextFloat(10, 45));
    case 'barren': return Math.round(rng.nextFloat(0, 20));
    case 'toxic': return Math.round(rng.nextFloat(0, 15));
    case 'gas_giant': return Math.round(rng.nextFloat(20, 70));
    default: return Math.round(rng.nextFloat(20, 60));
  }
}

const MODIFIER_DEFS: { type: PlanetModifierType; effect: 'positive' | 'negative' | 'neutral'; label: string; description: string; weight: number }[] = [
  { type: 'xenoarchaeology', effect: 'positive', label: 'Xenoarchaeological Site', description: 'Ancient alien artefacts provide a research boost.', weight: 3 },
  { type: 'minor_race', effect: 'neutral', label: 'Indigenous Species', description: 'A sentient minor race inhabits this world.', weight: 2 },
  { type: 'vicious_storms', effect: 'negative', label: 'Vicious Storms', description: 'Extreme weather reduces happiness and slows construction.', weight: 5 },
  { type: 'earthquakes', effect: 'negative', label: 'Seismic Activity', description: 'Frequent earthquakes degrade building condition faster.', weight: 4 },
  { type: 'beneficial_radiation', effect: 'positive', label: 'Beneficial Radiation', description: 'Unusual radiation accelerates research and population growth.', weight: 3 },
  { type: 'unique_bacteria', effect: 'positive', label: 'Unique Bacteria', description: 'Exotic micro-organisms boost science and organics output.', weight: 3 },
  { type: 'ancient_ruins', effect: 'positive', label: 'Ancient Ruins', description: 'Mysterious ruins yield a one-time research windfall on colonisation.', weight: 4 },
  { type: 'rich_deposits', effect: 'positive', label: 'Rich Mineral Deposits', description: 'Abundant veins boost mineral and resource extraction.', weight: 5 },
  { type: 'unstable_tectonics', effect: 'negative', label: 'Unstable Tectonics', description: 'Tectonic instability causes random building damage.', weight: 3 },
  { type: 'paradise_flora', effect: 'positive', label: 'Paradise Flora', description: 'Lush alien vegetation enhances beauty, happiness, and food.', weight: 2 },
];

function pickModifiers(rng: SeededRng, planetType: PlanetType): PlanetModifier[] {
  if (planetType === 'gas_giant') return [];
  const mods: PlanetModifier[] = [];

  // ~30% chance of having any modifier, ~8% chance of two
  if (rng.nextFloat(0, 1) > 0.30) return mods;

  // Pick one weighted modifier
  const totalWeight = MODIFIER_DEFS.reduce((s, d) => s + d.weight, 0);
  let roll = rng.nextFloat(0, totalWeight);
  for (const def of MODIFIER_DEFS) {
    roll -= def.weight;
    if (roll <= 0) {
      mods.push({ type: def.type, effect: def.effect, label: def.label, description: def.description });
      break;
    }
  }

  // 25% chance of a second modifier (different from the first)
  if (mods.length > 0 && rng.nextFloat(0, 1) < 0.25) {
    const remaining = MODIFIER_DEFS.filter(d => !mods.some(m => m.type === d.type));
    const remWeight = remaining.reduce((s, d) => s + d.weight, 0);
    let roll2 = rng.nextFloat(0, remWeight);
    for (const def of remaining) {
      roll2 -= def.weight;
      if (roll2 <= 0) {
        mods.push({ type: def.type, effect: def.effect, label: def.label, description: def.description });
        break;
      }
    }
  }

  return mods;
}

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
  const size = pickPlanetSize(rng, type);
  const fertility = pickFertility(rng, type);
  const beauty = pickBeauty(rng, type);
  const modifiers = pickModifiers(rng, type);

  return {
    id: nextId(),
    name: nameGen.generatePlanetName(systemName, orbitalIndex),
    orbitalIndex,
    type,
    atmosphere,
    gravity,
    temperature,
    naturalResources,
    size,
    fertility,
    beauty,
    modifiers,
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

/**
 * Minimum distance from galactic centre where systems can spawn.
 * Represents the supermassive black hole exclusion zone — no star systems
 * survive this close to the SMBH's gravitational influence.
 */
const SMBH_EXCLUSION_RADIUS = Math.min(RX, RY) * 0.06;

/** Returns true if a point is too close to the supermassive black hole at galaxy centre. */
function isInSMBHZone(x: number, y: number): boolean {
  const dx = x - CX;
  const dy = y - CY;
  return Math.sqrt(dx * dx + dy * dy) < SMBH_EXCLUSION_RADIUS;
}

interface PositionResult {
  points: CandidatePoint[];
  shapeMetadata?: GalaxyShapeMetadata;
}

function generatePositions(
  rng: SeededRng,
  count: number,
  shape: GalaxyShape,
): PositionResult {
  const minDist = Math.sqrt((GALAXY_WIDTH * GALAXY_HEIGHT) / (count * 4));

  switch (shape) {
    case 'elliptical':
      return {
        points: generateElliptical(rng, count, minDist),
        shapeMetadata: { shape: 'elliptical', centreX: CX, centreY: CY },
      };
    case 'spiral':
      return generateSpiral(rng, count, minDist);
    case 'ring':
      return {
        points: generateRing(rng, count, minDist),
        shapeMetadata: {
          shape: 'ring', centreX: CX, centreY: CY,
          innerRadiusFraction: 0.35, outerRadiusFraction: 0.90,
        },
      };
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
    if (isInSMBHZone(x, y)) return false;
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
): PositionResult {
  const numArms = 4 + rng.nextInt(0, 4); // 4–8 arms
  const spiralB = rng.nextFloat(0.15, 0.28); // tighter winding for more dramatic spiral
  const armBaseSpread = 0.10; // narrow arms — clear dark gaps between fins
  const bulgeRadius = 0.10; // small central bulge so arms dominate
  const maxR = Math.min(RX, RY);
  const spiralA = bulgeRadius * maxR * 0.9; // arms emerge from bulge edge

  // Pre-compute arm starting angles (evenly spaced + slight jitter)
  const armAngles: number[] = [];
  for (let i = 0; i < numArms; i++) {
    const base = (i / numArms) * Math.PI * 2;
    const jitter = rng.nextFloat(-0.08, 0.08);
    armAngles.push(base + jitter);
  }

  const inBounds = (x: number, y: number): boolean => {
    if (isInSMBHZone(x, y)) return false;
    const dx = x - CX;
    const dy = y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxR) return false;

    const normDist = dist / maxR;
    const angle = Math.atan2(dy, dx);

    // Central bulge: small, dense core
    if (normDist < bulgeRadius) {
      const bulgeProb = 0.6 + 0.4 * (1 - normDist / bulgeRadius);
      return rng.next() < bulgeProb;
    }

    // Logarithmic spiral arm check
    if (dist < spiralA) return rng.next() < 0.04;

    const thetaAtR = Math.log(dist / spiralA) / spiralB;

    let bestArmDist = Infinity;
    for (let arm = 0; arm < numArms; arm++) {
      const expectedAngle = armAngles[arm]! + thetaAtR;
      // Normalise angular difference to [-PI, PI]
      let diff = ((angle - expectedAngle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      diff = Math.abs(diff);
      if (diff < bestArmDist) bestArmDist = diff;
    }

    // Arm spread widens slightly with distance but stays tight
    const effectiveSpread = armBaseSpread * (1 + 0.3 * normDist);

    if (bestArmDist < effectiveSpread) {
      // Inside an arm: steep Gaussian — dense core, sharp edges
      const armProb = Math.exp(-4 * (bestArmDist / effectiveSpread) ** 2);
      return rng.next() < (0.15 + 0.85 * armProb);
    }

    // Almost no inter-arm stars — dark voids between fins
    return rng.next() < 0.01;
  };

  // Higher oversampling — tight arms reject many candidates
  const pts = poissonDisk(rng, count * 6, GALAXY_WIDTH, GALAXY_HEIGHT, minDist, inBounds);
  return {
    points: pts.slice(0, count),
    shapeMetadata: {
      shape: 'spiral',
      armCount: numArms,
      armAngles,
      spiralTightness: spiralB,
      armSpread: armBaseSpread,
      bulgeRadiusFraction: bulgeRadius,
      spiralA,
      centreX: CX,
      centreY: CY,
    },
  };
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
    if (isInSMBHZone(x, y)) return false;
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
): PositionResult {
  // Cosmic web: dense clusters connected by thin chains of stars (filaments).
  const numClusters = 3 + rng.nextInt(0, 3); // 3-6 clusters

  interface Cluster {
    cx: number;
    cy: number;
    rx: number; // half-width (may differ from ry for elongated clusters)
    ry: number; // half-height
    angle: number; // rotation angle for elongation
  }

  const clusters: Cluster[] = [];
  for (let i = 0; i < numClusters; i++) {
    const isElongated = rng.next() < 0.5;
    const baseR = rng.nextFloat(GALAXY_WIDTH * 0.08, GALAXY_WIDTH * 0.18);
    clusters.push({
      cx: rng.nextFloat(GALAXY_WIDTH * 0.12, GALAXY_WIDTH * 0.88),
      cy: rng.nextFloat(GALAXY_HEIGHT * 0.12, GALAXY_HEIGHT * 0.88),
      rx: isElongated ? baseR * rng.nextFloat(1.5, 2.5) : baseR,
      ry: isElongated ? baseR * rng.nextFloat(0.5, 0.8) : baseR,
      angle: rng.nextFloat(0, Math.PI),
    });
  }

  // Build filament corridors between clusters (connect each to its nearest
  // unconnected neighbour, then add 1-2 extra links for variety).
  interface Filament {
    ax: number; ay: number;
    bx: number; by: number;
    width: number;
  }

  const filaments: Filament[] = [];
  const connected = new Set<number>([0]);
  const unconnected = new Set<number>();
  for (let i = 1; i < numClusters; i++) unconnected.add(i);

  // Minimum spanning tree-style connectivity
  while (unconnected.size > 0) {
    let bestDist = Infinity;
    let bestFrom = 0;
    let bestTo = 0;
    for (const ci of connected) {
      for (const ui of unconnected) {
        const dx = clusters[ci]!.cx - clusters[ui]!.cx;
        const dy = clusters[ci]!.cy - clusters[ui]!.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          bestFrom = ci;
          bestTo = ui;
        }
      }
    }
    connected.add(bestTo);
    unconnected.delete(bestTo);
    filaments.push({
      ax: clusters[bestFrom]!.cx,
      ay: clusters[bestFrom]!.cy,
      bx: clusters[bestTo]!.cx,
      by: clusters[bestTo]!.cy,
      width: rng.nextFloat(minDist * 1.5, minDist * 3),
    });
  }

  // Add 1-2 extra filaments for a more web-like feel
  const extraLinks = rng.nextInt(1, 2);
  for (let e = 0; e < extraLinks && numClusters > 2; e++) {
    const a = rng.nextInt(0, numClusters - 1);
    let b = rng.nextInt(0, numClusters - 1);
    if (b === a) b = (b + 1) % numClusters;
    filaments.push({
      ax: clusters[a]!.cx,
      ay: clusters[a]!.cy,
      bx: clusters[b]!.cx,
      by: clusters[b]!.cy,
      width: rng.nextFloat(minDist * 1.2, minDist * 2.5),
    });
  }

  const inBounds = (x: number, y: number): boolean => {
    if (isInSMBHZone(x, y)) return false;
    // Check if point is inside any cluster (rotated ellipse test)
    for (const c of clusters) {
      const dx = x - c.cx;
      const dy = y - c.cy;
      // Rotate point into cluster's local frame
      const cos = Math.cos(-c.angle);
      const sin = Math.sin(-c.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const normDist = (lx * lx) / (c.rx * c.rx) + (ly * ly) / (c.ry * c.ry);
      if (normDist < 1) {
        // Density falls off from centre
        const threshold = 0.25 + 0.75 * (1 - normDist);
        if (rng.next() < threshold) return true;
      }
    }

    // Check if point is inside any filament corridor
    for (const f of filaments) {
      const fx = f.bx - f.ax;
      const fy = f.by - f.ay;
      const lenSq = fx * fx + fy * fy;
      if (lenSq === 0) continue;
      // Project point onto filament line segment
      const t = Math.max(0, Math.min(1, ((x - f.ax) * fx + (y - f.ay) * fy) / lenSq));
      const px = f.ax + t * fx;
      const py = f.ay + t * fy;
      const distToLine = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
      if (distToLine < f.width) {
        // Sparser in filaments than clusters
        if (rng.next() < 0.4) return true;
      }
    }

    return false;
  };

  const pts = poissonDisk(rng, count * 5, GALAXY_WIDTH, GALAXY_HEIGHT, minDist, inBounds);
  return {
    points: pts.slice(0, count),
    shapeMetadata: {
      shape: 'irregular',
      clusterCentres: clusters.map(c => ({ x: c.cx, y: c.cy })),
    },
  };
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

  const distSq = (i: number, j: number): number => {
    const a = systems[i]!;
    const b = systems[j]!;
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    return dx * dx + dy * dy;
  };

  const dist = (i: number, j: number): number => Math.sqrt(distSq(i, j));

  // -- Spatial grid for O(n * k) RNG instead of O(n^3) --
  // Estimate cell size from median nearest-neighbour distance.
  // For the inner loop we only need to check systems within distance dij of
  // both endpoints (i,j), so the grid lets us skip distant candidates entirely.

  // 1. Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sys of systems) {
    if (sys.position.x < minX) minX = sys.position.x;
    if (sys.position.y < minY) minY = sys.position.y;
    if (sys.position.x > maxX) maxX = sys.position.x;
    if (sys.position.y > maxY) maxY = sys.position.y;
  }

  // 2. Estimate cell size: sample nearest-neighbour distances then take the median
  const sampleSize = Math.min(n, 50);
  const sampleDists: number[] = [];
  for (let i = 0; i < sampleSize; i++) {
    let nearest = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = distSq(i, j);
      if (d < nearest) nearest = d;
    }
    sampleDists.push(Math.sqrt(nearest));
  }
  sampleDists.sort((a, b) => a - b);
  const medianDist = sampleDists[Math.floor(sampleDists.length / 2)] ?? 1;
  // Cell size is 2x the median so that nearby systems share cells/neighbours
  const cellSize = Math.max(medianDist * 2, 1);

  // 3. Build spatial hash: cell key -> array of system indices
  const grid = new Map<string, number[]>();
  const cellKey = (x: number, y: number): string =>
    `${Math.floor((x - minX) / cellSize)},${Math.floor((y - minY) / cellSize)}`;

  for (let idx = 0; idx < n; idx++) {
    const key = cellKey(systems[idx]!.position.x, systems[idx]!.position.y);
    const bucket = grid.get(key);
    if (bucket) bucket.push(idx);
    else grid.set(key, [idx]);
  }

  // Helper: collect system indices in all cells within a radius of a point
  const indicesNear = (cx: number, cy: number, radius: number): number[] => {
    const result: number[] = [];
    const rCells = Math.ceil(radius / cellSize);
    const baseCx = Math.floor((cx - minX) / cellSize);
    const baseCy = Math.floor((cy - minY) / cellSize);
    for (let dx = -rCells; dx <= rCells; dx++) {
      for (let dy = -rCells; dy <= rCells; dy++) {
        const bucket = grid.get(`${baseCx + dx},${baseCy + dy}`);
        if (bucket) {
          for (const idx of bucket) result.push(idx);
        }
      }
    }
    return result;
  };

  // 4. Build RNG using spatial grid to limit the inner k loop
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dij = dist(i, j);

      // Only check systems k that could possibly be closer to both i and j
      // than dij. Such a k must lie within dij of the midpoint of (i,j).
      const midX = (systems[i]!.position.x + systems[j]!.position.x) / 2;
      const midY = (systems[i]!.position.y + systems[j]!.position.y) / 2;
      const candidates = indicesNear(midX, midY, dij);

      let isRelativeNeighbour = true;
      for (const k of candidates) {
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

// ── anomaly generation ─────────────────────────────────────────────────────────

/** Habitable planet types that can host precursor ruins or minor species. */
const HABITABLE_PLANET_TYPES: ReadonlySet<PlanetType> = new Set([
  'terran', 'ocean', 'desert',
]);

/**
 * Anomaly descriptors keyed by type. Evocative text the player sees on
 * discovery — written in British English.
 */
const ANOMALY_DESCRIPTORS: Record<AnomalyType, { namePrefix: string; description: string }> = {
  precursor_ruins: {
    namePrefix: 'Precursor Ruins',
    description:
      'Weathered structures of impossible geometry protrude from the earth, their surfaces etched with symbols that predate every known civilisation. Whatever built this was ancient when the stars were young.',
  },
  derelict_vessel: {
    namePrefix: 'Derelict Vessel',
    description:
      'A vast hull drifts in the void, its superstructure buckled and cold. Power signatures flicker deep within — dormant, not dead. Salvage teams report unusual alloy compositions unlike anything on record.',
  },
  spatial_rift: {
    namePrefix: 'Spatial Rift',
    description:
      'Space itself is wounded here. Sensors return contradictory readings — distances that change between measurements, light bending along paths that shouldn\'t exist. Approach with extreme caution.',
  },
  mineral_deposit: {
    namePrefix: 'Mineral Deposit',
    description:
      'Extraordinarily dense concentrations of rare minerals, far exceeding natural geological processes. Spectral analysis reveals elements that would take aeons to accumulate under normal conditions.',
  },
  energy_signature: {
    namePrefix: 'Energy Signature',
    description:
      'An anomalous energy pattern pulses at the edge of sensor range — rhythmic, deliberate, and utterly alien. It originates from beyond the galaxy\'s rim. Something out there is broadcasting.',
  },
  sealed_wormhole: {
    namePrefix: 'Sealed Wormhole',
    description:
      'A wormhole terminus, collapsed with surgical precision. The surrounding spacetime bears scorch-marks of unimaginable energies. Someone sealed this passage deliberately. The question is: to keep something out, or something in?',
  },
  debris_field: {
    namePrefix: 'Debris Field',
    description:
      'A vast cloud of shattered metal and crystalline fragments stretches across the system. Carbon dating places the wreckage at millions of years old. Whatever battle occurred here involved fleets of staggering scale.',
  },
  living_nebula: {
    namePrefix: 'Living Nebula',
    description:
      'This nebula defies classification. Its gas clouds shift in patterns too regular for stellar winds, and energy readings suggest a distributed consciousness. The Luminari would find this place deeply significant.',
  },
  gravity_anomaly: {
    namePrefix: 'Gravity Anomaly',
    description:
      'A region where gravitational constants appear to be locally different. Objects orbit in paths that defy conventional physics. Research teams report feelings of temporal displacement near the epicentre.',
  },
  ancient_beacon: {
    namePrefix: 'Ancient Beacon',
    description:
      'A faint, repeating signal emanates from a structure of unknown origin. The transmission is encoded in mathematical constants — prime sequences, geometric ratios — a universal language. Someone left a message for whoever came next.',
  },
};

/**
 * General anomaly types that can appear in any system. Used when
 * no placement rule applies.
 */
const GENERAL_ANOMALY_TYPES: readonly AnomalyType[] = [
  'derelict_vessel',
  'spatial_rift',
  'living_nebula',
  'gravity_anomaly',
  'ancient_beacon',
  'debris_field',
  'mineral_deposit',
];

/**
 * Generate anomalies scattered across the galaxy.
 *
 * Rules:
 * - ~15-25% of systems receive an anomaly
 * - `precursor_ruins` placed on habitable planets (rare)
 * - `energy_signature` at galaxy edge systems (Devourer foreshadowing)
 * - `sealed_wormhole` on 1-3 edge systems
 * - `mineral_deposit` and `debris_field` scattered throughout
 * - Other types distributed randomly
 */
function generateAnomalies(
  rng: SeededRng,
  nextId: () => string,
  systems: StarSystem[],
  galaxyWidth: number,
  galaxyHeight: number,
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Identify edge systems (outer 15% of the galaxy radius from centre)
  const cx = galaxyWidth / 2;
  const cy = galaxyHeight / 2;
  const maxRadius = Math.min(galaxyWidth, galaxyHeight) * 0.5;
  const edgeThreshold = maxRadius * 0.85;

  const edgeSystems: StarSystem[] = [];
  const interiorSystems: StarSystem[] = [];

  for (const sys of systems) {
    const dx = sys.position.x - cx;
    const dy = sys.position.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= edgeThreshold) {
      edgeSystems.push(sys);
    } else {
      interiorSystems.push(sys);
    }
  }

  const createAnomaly = (
    type: AnomalyType,
    systemId: string,
    suffix: string,
  ): Anomaly => {
    const desc = ANOMALY_DESCRIPTORS[type];
    return {
      id: nextId(),
      type,
      name: `${desc.namePrefix} — ${suffix}`,
      description: desc.description,
      systemId,
      discovered: false,
      investigated: false,
    };
  };

  // Track which systems already have an anomaly to avoid clustering
  const systemsWithAnomaly = new Set<string>();

  // 1. Place 1-3 sealed wormholes at galaxy edge
  const sealedCount = rng.nextInt(1, 3);
  const shuffledEdge = [...edgeSystems].sort(() => rng.next() - 0.5);
  for (let i = 0; i < sealedCount && i < shuffledEdge.length; i++) {
    const sys = shuffledEdge[i]!;
    anomalies.push(createAnomaly('sealed_wormhole', sys.id, sys.name));
    systemsWithAnomaly.add(sys.id);
  }

  // 2. Place 2-4 energy signatures at galaxy edge (Devourer foreshadowing)
  const energyCount = rng.nextInt(2, 4);
  let energyPlaced = 0;
  for (const sys of shuffledEdge) {
    if (energyPlaced >= energyCount) break;
    if (systemsWithAnomaly.has(sys.id)) continue;
    anomalies.push(createAnomaly('energy_signature', sys.id, sys.name));
    systemsWithAnomaly.add(sys.id);
    energyPlaced++;
  }

  // 3. Place precursor ruins on habitable planets (rare — ~3-5% of systems with habitable worlds)
  const habitableSystems = systems.filter(sys =>
    sys.planets.some(p => HABITABLE_PLANET_TYPES.has(p.type)),
  );
  for (const sys of habitableSystems) {
    if (systemsWithAnomaly.has(sys.id)) continue;
    if (rng.next() < 0.05) {
      anomalies.push(createAnomaly('precursor_ruins', sys.id, sys.name));
      systemsWithAnomaly.add(sys.id);
    }
  }

  // 4. Fill remaining systems to reach ~15-25% total anomaly coverage
  const targetMin = Math.floor(systems.length * 0.15);
  const targetMax = Math.floor(systems.length * 0.25);
  const targetCount = rng.nextInt(targetMin, targetMax);

  // Shuffle all systems for random placement
  const shuffledAll = [...systems].sort(() => rng.next() - 0.5);

  for (const sys of shuffledAll) {
    if (anomalies.length >= targetCount) break;
    if (systemsWithAnomaly.has(sys.id)) continue;

    const type = rng.pick(GENERAL_ANOMALY_TYPES);
    anomalies.push(createAnomaly(type, sys.id, sys.name));
    systemsWithAnomaly.add(sys.id);
  }

  return anomalies;
}

// ── minor species generation ───────────────────────────────────────────────────

/**
 * Biology type weights — carbon terrestrial is most common, exotic forms rarer.
 */
const BIOLOGY_TABLE: Array<[MinorSpeciesBiology, number]> = [
  ['carbon_terrestrial', 35],
  ['carbon_aquatic', 18],
  ['carbon_aerial', 8],
  ['insectoid_swarm', 15],
  ['fungal_network', 10],
  ['silicon_based', 8],
  ['megafauna', 6],
];

/**
 * Tech level weights — lower levels far more common than advanced ones.
 */
const TECH_LEVEL_TABLE: Array<[MinorSpeciesTechLevel, number]> = [
  ['stone_age', 30],
  ['bronze_age', 25],
  ['iron_age', 18],
  ['medieval', 12],
  ['renaissance', 8],
  ['industrial', 5],
  ['early_modern', 2],
];

/** Pick from a weighted table using cumulative probability. */
function pickWeighted<T>(rng: SeededRng, table: Array<[T, number]>): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [value, weight] of table) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return table[table.length - 1]![0];
}

/**
 * Minor species description templates keyed by biology type.
 * Evocative flavour text in British English.
 */
const BIOLOGY_DESCRIPTIONS: Record<MinorSpeciesBiology, string> = {
  carbon_terrestrial:
    'A bipedal species that has adapted remarkably to the temperate zones of their homeworld. Their tool use and social structures suggest nascent civilisational potential.',
  carbon_aquatic:
    'Graceful aquatic beings dwelling in vast undersea settlements. Their bioluminescent communication and coral architecture hint at a rich, alien culture beneath the waves.',
  carbon_aerial:
    'Winged creatures that build elaborate nesting spires in the upper atmosphere. Their hollow bones and keen senses have driven a unique evolutionary path toward cooperative flight-based societies.',
  silicon_based:
    'Crystalline organisms that draw sustenance from mineral deposits and geothermal energy. Their thoughts move slowly by organic standards, but their patience and resilience are extraordinary.',
  fungal_network:
    'A vast mycelial network spanning kilometres of subterranean terrain. Individual fruiting bodies serve as sensory organs, whilst the true intelligence resides in the distributed root system below.',
  insectoid_swarm:
    'A highly organised collective of chitinous beings, each caste specialised for a distinct role. Their hive-mind coordination allows feats of construction and warfare that belie their diminutive individual size.',
  megafauna:
    'Colossal organisms of staggering proportions, each individual a self-contained ecosystem. Despite their size, they demonstrate surprising cognitive sophistication and rudimentary tool use.',
};

/**
 * Population range by tech level — more advanced civilisations support larger numbers.
 */
const POPULATION_BY_TECH: Record<MinorSpeciesTechLevel, [number, number]> = {
  stone_age:     [10_000,        500_000],
  bronze_age:    [100_000,       5_000_000],
  iron_age:      [500_000,       20_000_000],
  medieval:      [5_000_000,     100_000_000],
  renaissance:   [20_000_000,    500_000_000],
  industrial:    [100_000_000,   2_000_000_000],
  early_modern:  [500_000_000,   5_000_000_000],
};

/**
 * Generate minor species on habitable planets.
 *
 * Rules:
 * - ~10-20% of habitable planets host a minor species
 * - Biology type is weighted (carbon terrestrial most common)
 * - Tech level is weighted (lower levels more common)
 * - Random traits (1-10 each)
 * - A system can have multiple minor species (on different planets)
 * - Names generated procedurally
 */
function generateMinorSpecies(
  rng: SeededRng,
  nextId: () => string,
  nameGen: NameGenerator,
  systems: StarSystem[],
): MinorSpecies[] {
  const species: MinorSpecies[] = [];

  // Gather all habitable planets across all systems
  const habitablePlanets: Array<{ planet: Planet; systemId: string }> = [];
  for (const sys of systems) {
    for (const planet of sys.planets) {
      if (HABITABLE_PLANET_TYPES.has(planet.type) && planet.maxPopulation > 0) {
        habitablePlanets.push({ planet, systemId: sys.id });
      }
    }
  }

  // Each habitable planet has a 10-20% chance of hosting a minor species
  // We decide the overall rate once, then apply it per-planet
  const placementRate = rng.nextFloat(0.10, 0.20);

  for (const { planet, systemId } of habitablePlanets) {
    if (rng.next() >= placementRate) continue;

    const biology = pickWeighted(rng, BIOLOGY_TABLE);
    const techLevel = pickWeighted(rng, TECH_LEVEL_TABLE);
    const [popMin, popMax] = POPULATION_BY_TECH[techLevel];
    const population = rng.nextInt(popMin, popMax);

    const name = nameGen.generateSystemName(); // Reuse system name generator for alien species names

    species.push({
      id: nextId(),
      name,
      description: BIOLOGY_DESCRIPTIONS[biology],
      planetId: planet.id,
      systemId,
      population,
      techLevel,
      biology,
      traits: {
        aggression: rng.nextInt(1, 10),
        curiosity: rng.nextInt(1, 10),
        industriousness: rng.nextInt(1, 10),
        adaptability: rng.nextInt(1, 10),
      },
      attitude: 0,
      status: 'undiscovered',
      properties: [],
      integration: null,
      uplift: null,
      revolt: null,
      interactingEmpireId: null,
      currentInteraction: null,
    });
  }

  return species;
}

// ── main entry point ──────────────────────────────────────────────────────────

export function generateGalaxy(config: GalaxyGenerationConfig): Galaxy {
  const rng = new SeededRng(config.seed);
  const nextId = makeIdGenerator(rng);
  const nameGen = new NameGenerator(new SeededRng(config.seed + 1));

  const targetCount = GALAXY_SIZES[config.size];

  // 1. Place star positions
  const { points: positions, shapeMetadata } = generatePositions(rng, targetCount, config.shape);

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

  // 5. Generate anomalies
  const anomalies = generateAnomalies(rng, nextId, systems, GALAXY_WIDTH, GALAXY_HEIGHT);

  // 6. Generate minor species
  const minorSpecies = generateMinorSpecies(rng, nextId, nameGen, systems);

  return {
    id: nextId(),
    systems,
    anomalies,
    minorSpecies,
    width: GALAXY_WIDTH,
    height: GALAXY_HEIGHT,
    seed: config.seed,
    shapeMetadata,
  };
}
