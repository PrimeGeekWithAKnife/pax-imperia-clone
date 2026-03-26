/**
 * Governor engine — pure functions for generating, ageing, and applying
 * governor modifiers to planet production.
 *
 * Governors are assigned to planets and provide percentage-based bonuses
 * (and occasionally minor penalties) to various production categories.
 * They age each tick and die when turnsServed reaches lifespan.
 *
 * All functions are pure / side-effect-free.  Callers must persist state.
 */

import type { Governor, GovernorModifiers } from '../types/governor.js';
import type { ResourceProduction } from '../types/resources.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Name generation word lists
// ---------------------------------------------------------------------------

const NAME_PREFIXES = [
  'Alder', 'Brant', 'Calder', 'Darek', 'Elsin', 'Farrow', 'Galen', 'Havel',
  'Ivor', 'Joran', 'Kael', 'Lorin', 'Maren', 'Navar', 'Oswyn', 'Praxis',
  'Quell', 'Roan', 'Soren', 'Teval', 'Uther', 'Vareth', 'Wren', 'Xael',
  'Yoran', 'Zephyr', 'Aston', 'Belor', 'Cassia', 'Delwyn', 'Eryn', 'Felan',
  'Govaan', 'Hessa', 'Idris', 'Javel', 'Keran', 'Lyris', 'Meron', 'Naleth',
];

const NAME_SUFFIXES = [
  'an', 'ar', 'el', 'en', 'eth', 'ik', 'in', 'ion', 'is', 'ix',
  'on', 'or', 'os', 'ox', 'us', 'ael', 'arn', 'aux', 'eld', 'eon',
  'esh', 'iel', 'ith', 'ius', 'nar', 'nel', 'nis', 'nor', 'oth', 'val',
  'van', 'ven', 'von', 'wyn', 'zel', 'zor',
];

// ---------------------------------------------------------------------------
// Trait pool
// ---------------------------------------------------------------------------

const TRAIT_POOL = [
  'Ambitious administrator',
  'Cautious bureaucrat',
  'Visionary leader',
  'Corrupt but effective',
  'Methodical planner',
  'Charismatic orator',
  'Ruthless pragmatist',
  'Idealistic reformer',
  'Veteran colonial governor',
  'Former military commander',
  'Trade-focused economist',
  'Populist agitator',
  'Quiet efficiency',
  'Inspired industrialist',
  'Beloved by workers',
  'Scholar turned administrator',
  'Devout and disciplined',
  'Cunning diplomat',
  'Aggressive expansionist',
  'Calm in crisis',
];

// ---------------------------------------------------------------------------
// Seeded pseudo-random helper
// ---------------------------------------------------------------------------

/**
 * Simple seeded PRNG (mulberry32).
 * Returns a function that produces numbers in [0, 1).
 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random integer in [lo, hi] (inclusive) using the provided rng. */
function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Pick a random element from an array using the provided rng. */
function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// ---------------------------------------------------------------------------
// Public: generateGovernor
// ---------------------------------------------------------------------------

/**
 * Generate a random governor assigned to the given planet and empire.
 *
 * Governor modifier distribution is skewed positive — most governors are a
 * net benefit.  Two or three stats receive a "specialism" boost of +3 to +8
 * on top of the base roll, representing areas of expertise.
 *
 * @param empireId  The empire that owns this governor.
 * @param planetId  The planet this governor administers.
 * @param seed      Optional seed for reproducible generation (uses Math.random otherwise).
 */
export function generateGovernor(
  empireId: string,
  planetId: string,
  seed?: number,
): Governor {
  const rng = seed !== undefined ? makeRng(seed) : Math.random;
  const callRng: () => number = seed !== undefined ? rng as () => number : () => Math.random();

  // Generate a name: prefix + suffix (or prefix + space + suffix for two-word names)
  const useDoubleBarrel = callRng() < 0.3;
  let name: string;
  if (useDoubleBarrel) {
    name = `${randPick(callRng, NAME_PREFIXES)} ${randPick(callRng, NAME_PREFIXES)}${randPick(callRng, NAME_SUFFIXES)}`;
  } else {
    name = `${randPick(callRng, NAME_PREFIXES)}${randPick(callRng, NAME_SUFFIXES)}`;
  }

  // Lifespan: 1000–3000 turns
  const lifespan = randInt(callRng, 1000, 3000);

  // Trait
  const trait = randPick(callRng, TRAIT_POOL);

  // Base modifier roll: random(-5, +15) per stat
  const modifierKeys: (keyof GovernorModifiers)[] = [
    'manufacturing', 'research', 'energyProduction', 'populationGrowth',
    'happiness', 'construction', 'mining', 'trade',
  ];

  const modifiers: GovernorModifiers = {
    manufacturing: 0,
    research: 0,
    energyProduction: 0,
    populationGrowth: 0,
    happiness: 0,
    construction: 0,
    mining: 0,
    trade: 0,
  };

  for (const key of modifierKeys) {
    modifiers[key] = randInt(callRng, -5, 15);
  }

  // Specialism: pick 2–3 stats to receive an extra +3 to +8 bonus
  const specialismCount = randInt(callRng, 2, 3);
  const shuffled = [...modifierKeys].sort(() => callRng() - 0.5);
  for (let i = 0; i < specialismCount; i++) {
    const key = shuffled[i]!;
    modifiers[key] = Math.min(modifiers[key] + randInt(callRng, 3, 8), getStatCap(key));
  }

  // Clamp all stats to their valid ranges
  clampModifiers(modifiers);

  return {
    id: generateId(),
    name,
    planetId,
    empireId,
    turnsServed: 0,
    lifespan,
    modifiers,
    trait,
  };
}

// ---------------------------------------------------------------------------
// Public: generateCandidatePool
// ---------------------------------------------------------------------------

/**
 * Generate a pool of replacement governor candidates (1–10 governors).
 *
 * @param empireId  The owning empire.
 * @param planetId  The planet seeking a governor.
 * @param count     Number of candidates to generate (default 5, clamped 1–10).
 */
export function generateCandidatePool(
  empireId: string,
  planetId: string,
  count = 5,
): Governor[] {
  const n = Math.min(10, Math.max(1, count));
  const candidates: Governor[] = [];
  for (let i = 0; i < n; i++) {
    // Use a time-based seed offset so candidates differ even without an explicit seed
    candidates.push(generateGovernor(empireId, planetId, Date.now() + i * 1337));
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Public: processGovernorsTick
// ---------------------------------------------------------------------------

/**
 * Age every governor by one tick and identify those that have died.
 *
 * A governor dies when turnsServed reaches or exceeds their lifespan.
 *
 * @returns An object with:
 *   - `updated`: Governors still alive (with incremented turnsServed).
 *   - `died`:    Governors whose turnsServed reached lifespan this tick.
 */
export function processGovernorsTick(governors: Governor[]): {
  updated: Governor[];
  died: Governor[];
} {
  const updated: Governor[] = [];
  const died: Governor[] = [];

  for (const gov of governors) {
    const aged: Governor = { ...gov, turnsServed: gov.turnsServed + 1 };
    if (aged.turnsServed >= aged.lifespan) {
      died.push(aged);
    } else {
      updated.push(aged);
    }
  }

  return { updated, died };
}

// ---------------------------------------------------------------------------
// Public: applyGovernorModifiers
// ---------------------------------------------------------------------------

/**
 * Apply governor percentage modifiers to a planet's resource production.
 *
 * Each modifier is a percentage bonus (+5 means ×1.05 for the relevant
 * production type).  If no governor is provided, production is returned
 * unchanged.
 *
 * Modifier-to-production mapping:
 *   manufacturing    → minerals, exoticMaterials
 *   research         → researchPoints
 *   energyProduction → energy
 *   populationGrowth → (population growth — not a resource; ignored here)
 *   happiness        → (handled separately in happiness engine)
 *   construction     → (handled in construction step; not a resource output)
 *   mining           → minerals, rareElements
 *   trade            → credits
 */
export function applyGovernorModifiers(
  production: ResourceProduction,
  governor: Governor | undefined,
): ResourceProduction {
  if (!governor) return production;

  const m = governor.modifiers;

  const manufacturingFactor = 1 + m.manufacturing / 100;
  const researchFactor      = 1 + m.research / 100;
  const energyFactor        = 1 + m.energyProduction / 100;
  const miningFactor        = 1 + m.mining / 100;
  const tradeFactor         = 1 + m.trade / 100;

  return {
    credits:          Math.round(production.credits          * tradeFactor          * 100) / 100,
    minerals:         Math.round(production.minerals         * manufacturingFactor  * miningFactor * 100) / 100,
    rareElements:     Math.round(production.rareElements     * miningFactor         * 100) / 100,
    energy:           Math.round(production.energy           * energyFactor         * 100) / 100,
    organics:         production.organics,
    exoticMaterials:  Math.round(production.exoticMaterials  * manufacturingFactor  * 100) / 100,
    faith:            production.faith,
    researchPoints:   Math.round(production.researchPoints   * researchFactor       * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Per-stat upper caps matching the interface comments. */
function getStatCap(key: keyof GovernorModifiers): number {
  switch (key) {
    case 'manufacturing':    return 20;
    case 'research':         return 20;
    case 'energyProduction': return 20;
    case 'populationGrowth': return 15;
    case 'happiness':        return 15;
    case 'construction':     return 20;
    case 'mining':           return 20;
    case 'trade':            return 15;
  }
}

/** Per-stat lower caps. */
function getStatFloor(key: keyof GovernorModifiers): number {
  switch (key) {
    case 'happiness': return -5;
    default:          return -10;
  }
}

/** Clamp all modifiers to their valid ranges in-place. */
function clampModifiers(m: GovernorModifiers): void {
  const keys: (keyof GovernorModifiers)[] = [
    'manufacturing', 'research', 'energyProduction', 'populationGrowth',
    'happiness', 'construction', 'mining', 'trade',
  ];
  for (const key of keys) {
    m[key] = Math.min(getStatCap(key), Math.max(getStatFloor(key), Math.round(m[key])));
  }
}
