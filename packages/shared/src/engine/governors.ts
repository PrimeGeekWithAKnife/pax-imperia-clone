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
import type { Planet, BuildingType } from '../types/galaxy.js';
import type { ResourceProduction } from '../types/resources.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';
import { PLANET_SIZE_SLOTS, PLANET_BUILDING_SLOTS } from '../constants/planets.js';
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
    experience: 0,
    autoManage: false,
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
// Public: tickGovernorExperience
// ---------------------------------------------------------------------------

/**
 * Tick governor experience: +0.1 per tick, capped at 100.
 * Returns a new Governor object (does not mutate the original).
 */
export function tickGovernorExperience(gov: Governor): Governor {
  return {
    ...gov,
    experience: Math.min(100, gov.experience + 0.1),
  };
}

// ---------------------------------------------------------------------------
// Public: calculateOverallRating
// ---------------------------------------------------------------------------

/**
 * Overall rating 0-100: 60% from modifier average, 40% from experience.
 *
 * Modifier values range from -10 to +20.  We normalise each to 0-100 by
 * mapping the [-10, +20] range linearly: `(value + 10) / 30 * 100`.
 * The average of all 8 normalised values is then blended with experience.
 */
export function calculateOverallRating(gov: Governor): number {
  const m = gov.modifiers;
  const keys: (keyof GovernorModifiers)[] = [
    'manufacturing', 'research', 'energyProduction', 'populationGrowth',
    'happiness', 'construction', 'mining', 'trade',
  ];
  let sum = 0;
  for (const key of keys) {
    // Normalise from [-10, +20] → [0, 100]
    sum += ((m[key] + 10) / 30) * 100;
  }
  const normalisedModifiers = sum / keys.length;
  return Math.round((0.6 * normalisedModifiers + 0.4 * gov.experience) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public: governorAutoBuildDecision
// ---------------------------------------------------------------------------

/**
 * Governor auto-build AI — decides what to build on a planet based on the
 * governor's overall rating tier.
 *
 * Returns a build or upgrade recommendation, or null if nothing is needed
 * or affordable.
 */
export function governorAutoBuildDecision(
  planet: Planet,
  governor: Governor,
  empireTechs: string[],
  availableCredits: number,
  availableMinerals: number,
): { action: 'build'; type: BuildingType } | { action: 'upgrade'; buildingId: string } | null {
  const rating = calculateOverallRating(governor);
  const maxSlots = getMaxBuildingSlots(planet);

  if (rating < 30) {
    return noviceDecision(planet, empireTechs, availableCredits, availableMinerals, maxSlots);
  } else if (rating < 60) {
    return competentDecision(planet, governor, empireTechs, availableCredits, availableMinerals, maxSlots);
  } else {
    return expertDecision(planet, governor, empireTechs, availableCredits, availableMinerals, maxSlots);
  }
}

// ---------------------------------------------------------------------------
// Auto-build: tier helpers
// ---------------------------------------------------------------------------

/** Count how many buildings of a given type exist on the planet. */
function countBuildings(planet: Planet, type: BuildingType): number {
  return planet.buildings.filter(b => b.type === type).length;
}

/** Check whether the planet has room for a new building. */
function hasSlots(planet: Planet, maxSlots: number): boolean {
  return planet.buildings.length < maxSlots;
}

/** Check that a building's requiredTech (if any) is researched. */
function techAvailable(type: BuildingType, empireTechs: string[]): boolean {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return false;
  if (def.requiredTech && !empireTechs.includes(def.requiredTech)) return false;
  // Skip race-specific buildings — governors do not know the species
  if (def.racialSpeciesId) return false;
  return true;
}

/** Check the empire can afford a building's base cost. */
function canAfford(type: BuildingType, credits: number, minerals: number): boolean {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return false;
  const costCredits = def.baseCost.credits ?? 0;
  const costMinerals = def.baseCost.minerals ?? 0;
  return credits >= costCredits && minerals >= costMinerals;
}

/** Attempt to recommend a specific building type, returning the action or null. */
function tryBuild(
  type: BuildingType,
  planet: Planet,
  empireTechs: string[],
  credits: number,
  minerals: number,
  maxSlots: number,
): { action: 'build'; type: BuildingType } | null {
  if (!hasSlots(planet, maxSlots)) return null;
  if (!techAvailable(type, empireTechs)) return null;
  if (!canAfford(type, credits, minerals)) return null;
  return { action: 'build' as const, type };
}

/** Find a level-1 building eligible for upgrade, returning an upgrade action or null. */
function tryUpgradeLevel1(
  planet: Planet,
  credits: number,
  minerals: number,
): { action: 'upgrade'; buildingId: string } | null {
  for (const b of planet.buildings) {
    if (b.level === 1) {
      const def = BUILDING_DEFINITIONS[b.type];
      if (!def) continue;
      if (b.level >= def.maxLevel) continue;
      // Upgrade costs are roughly the base cost (simplified assumption)
      const costCredits = def.baseCost.credits ?? 0;
      const costMinerals = def.baseCost.minerals ?? 0;
      if (credits >= costCredits && minerals >= costMinerals) {
        return { action: 'upgrade' as const, buildingId: b.id };
      }
    }
  }
  return null;
}

/** Find a building below max level, preferring higher-level buildings. */
function tryUpgradeAny(
  planet: Planet,
  credits: number,
  minerals: number,
): { action: 'upgrade'; buildingId: string } | null {
  // Sort by level descending — prefer upgrading already-levelled buildings
  const sorted = [...planet.buildings].sort((a, b) => b.level - a.level);
  for (const b of sorted) {
    const def = BUILDING_DEFINITIONS[b.type];
    if (!def) continue;
    if (b.level >= def.maxLevel) continue;
    const costCredits = def.baseCost.credits ?? 0;
    const costMinerals = def.baseCost.minerals ?? 0;
    if (credits >= costCredits && minerals >= costMinerals) {
      return { action: 'upgrade' as const, buildingId: b.id };
    }
  }
  return null;
}

/** Estimate energy balance: power_plant output vs consumers. */
function hasEnergyDeficit(planet: Planet): boolean {
  let produced = 0;
  let consumed = 0;
  for (const b of planet.buildings) {
    const def = BUILDING_DEFINITIONS[b.type];
    if (!def) continue;
    produced += (def.baseProduction.energy ?? 0) * b.level;
    consumed += def.energyConsumption * b.level;
  }
  return consumed > produced;
}

/** Check if there are many industrial buildings producing waste. */
function hasWasteProblem(planet: Planet): boolean {
  let totalWaste = 0;
  for (const b of planet.buildings) {
    const def = BUILDING_DEFINITIONS[b.type];
    if (!def) continue;
    totalWaste += def.wasteOutput * b.level;
  }
  return totalWaste > 8;
}

/** Estimate happiness from buildings. */
function estimateHappiness(planet: Planet): number {
  let happiness = 50; // base
  for (const b of planet.buildings) {
    const def = BUILDING_DEFINITIONS[b.type];
    if (!def) continue;
    happiness += def.happinessImpact * b.level;
  }
  return happiness;
}

/** Get maximum building slots for a planet. */
function getMaxBuildingSlots(planet: Planet): number {
  if (planet.size) {
    return PLANET_SIZE_SLOTS[planet.size] ?? 12;
  }
  return PLANET_BUILDING_SLOTS[planet.type] ?? 12;
}

// ---------------------------------------------------------------------------
// Auto-build: Novice tier (rating 0-30)
// ---------------------------------------------------------------------------

function noviceDecision(
  planet: Planet,
  empireTechs: string[],
  credits: number,
  minerals: number,
  maxSlots: number,
): { action: 'build'; type: BuildingType } | null {
  // Priority: power_plant → factory → hydroponics_bay → random from basic set
  if (countBuildings(planet, 'power_plant') === 0) {
    const r = tryBuild('power_plant', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }
  if (countBuildings(planet, 'factory') === 0) {
    const r = tryBuild('factory', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }
  if (countBuildings(planet, 'hydroponics_bay') === 0) {
    const r = tryBuild('hydroponics_bay', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Random pick from basic buildings that don't need unavailable tech
  const basicTypes: BuildingType[] = ['population_center', 'mining_facility', 'research_lab'];
  // Shuffle deterministically using planet id hash
  const shuffled = [...basicTypes].sort(() => {
    return planet.id.length % 2 === 0 ? -1 : 1;
  });
  for (const type of shuffled) {
    const r = tryBuild(type, planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auto-build: Competent tier (rating 30-60)
// ---------------------------------------------------------------------------

function competentDecision(
  planet: Planet,
  governor: Governor,
  empireTechs: string[],
  credits: number,
  minerals: number,
  maxSlots: number,
): { action: 'build'; type: BuildingType } | { action: 'upgrade'; buildingId: string } | null {
  // Energy deficit — build power_plant first
  if (hasEnergyDeficit(planet)) {
    const r = tryBuild('power_plant', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Fewer hydroponics than population_centers
  if (countBuildings(planet, 'hydroponics_bay') < countBuildings(planet, 'population_center')) {
    const r = tryBuild('hydroponics_bay', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Need at least 2 factories
  if (countBuildings(planet, 'factory') < 2) {
    const r = tryBuild('factory', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Need at least 1 research_lab
  if (countBuildings(planet, 'research_lab') === 0) {
    const r = tryBuild('research_lab', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Personality-driven choices
  const m = governor.modifiers;
  if (m.manufacturing > 10) {
    const r = tryBuild('factory', planet, empireTechs, credits, minerals, maxSlots)
           ?? tryBuild('mining_facility', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }
  if (m.research > 10) {
    const r = tryBuild('research_lab', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }
  if (m.trade > 10) {
    const r = tryBuild('trade_hub', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Consider upgrading a level-1 building before building new
  const upgrade = tryUpgradeLevel1(planet, credits, minerals);
  if (upgrade) return upgrade;

  // Fallback: try basic buildings
  const fallbacks: BuildingType[] = ['mining_facility', 'population_center', 'power_plant'];
  for (const type of fallbacks) {
    const r = tryBuild(type, planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auto-build: Expert tier (rating 60-100)
// ---------------------------------------------------------------------------

function expertDecision(
  planet: Planet,
  governor: Governor,
  empireTechs: string[],
  credits: number,
  minerals: number,
  maxSlots: number,
): { action: 'build'; type: BuildingType } | { action: 'upgrade'; buildingId: string } | null {
  // Prefer upgrades over new builds
  const upgrade = tryUpgradeAny(planet, credits, minerals);

  // Happiness check — if below 50 and no entertainment_complex, build one
  if (estimateHappiness(planet) < 50 && countBuildings(planet, 'entertainment_complex') === 0) {
    const r = tryBuild('entertainment_complex', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Waste check — if accumulating and no recycling_plant, build one
  if (hasWasteProblem(planet) && countBuildings(planet, 'recycling_plant') === 0) {
    const r = tryBuild('recycling_plant', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Energy balance — don't build consumers if in deficit
  if (hasEnergyDeficit(planet)) {
    const r = tryBuild('power_plant', planet, empireTechs, credits, minerals, maxSlots)
           ?? tryBuild('fusion_reactor', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Prefer upgrades over new builds for experts
  if (upgrade) return upgrade;

  // After basics, prioritise trade_hub for income
  if (countBuildings(planet, 'trade_hub') === 0) {
    const r = tryBuild('trade_hub', planet, empireTechs, credits, minerals, maxSlots);
    if (r) return r;
  }

  // Run through competent logic as fallback
  return competentDecision(planet, governor, empireTechs, credits, minerals, maxSlots);
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
