/**
 * Personality Rolling Engine
 *
 * Rolls concrete per-game personality instances from species distribution data.
 * Applies difficulty scaling and ensures valid ranges.
 *
 * Design: pure functions, no side effects. Randomness is injected via a
 * gaussian helper that can be seeded for deterministic tests.
 */

import type {
  SpeciesPersonalityData,
  RolledPersonality,
  CoreTraits,
  CoreTraitKey,
  DifficultyLevel,
  DifficultyModifiers,
  TraitDistribution,
  DarkTriadScores,
} from '../../types/psychology.js';

import { CORE_TRAIT_KEYS, DIFFICULTY_MODIFIERS } from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Gaussian random number generation (Box-Muller transform)
// ---------------------------------------------------------------------------

/**
 * Generate a gaussian-distributed random number.
 * Uses Box-Muller transform for normal distribution.
 *
 * @param mean   Centre of the distribution.
 * @param stddev Standard deviation.
 * @param rng    Optional random function (default: Math.random). Inject for testing.
 * @returns A normally distributed random number.
 */
export function gaussian(mean: number, stddev: number, rng: () => number = Math.random): number {
  // Box-Muller transform
  let u1 = rng();
  let u2 = rng();
  // Avoid log(0)
  while (u1 === 0) u1 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

/** Clamp a value to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Trait rolling
// ---------------------------------------------------------------------------

/**
 * Roll a single trait value from a distribution, applying a difficulty offset.
 *
 * @param dist         The trait's { median, stddev } distribution.
 * @param offset       Difficulty-based offset to shift the median.
 * @param min          Minimum valid value (default 0).
 * @param max          Maximum valid value (default 100).
 * @param rng          Random function for injection.
 * @returns A clamped integer trait value.
 */
export function rollTrait(
  dist: TraitDistribution,
  offset: number = 0,
  min: number = 0,
  max: number = 100,
  rng: () => number = Math.random,
): number {
  const raw = gaussian(dist.median + offset, dist.stddev, rng);
  return Math.round(clamp(raw, min, max));
}

/**
 * Roll all six core traits from a species' distributions.
 */
export function rollCoreTraits(
  distributions: Record<CoreTraitKey, TraitDistribution>,
  difficulty: DifficultyLevel,
  rng: () => number = Math.random,
): CoreTraits {
  const mods = DIFFICULTY_MODIFIERS[difficulty];

  const traits = {} as CoreTraits;
  for (const key of CORE_TRAIT_KEYS) {
    const offset = getDifficultyOffset(key, mods);
    traits[key] = rollTrait(distributions[key], offset, 0, 100, rng);
  }
  return traits;
}

/**
 * Roll subfacet values from their distributions (no difficulty offset —
 * subfacets inherit indirectly from core trait shifts).
 */
export function rollSubfacets(
  distributions: Record<string, TraitDistribution>,
  rng: () => number = Math.random,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, dist] of Object.entries(distributions)) {
    result[key] = rollTrait(dist, 0, 0, 100, rng);
  }
  return result;
}

/**
 * Roll Dark Triad scores with difficulty scaling.
 * On harder difficulties, Dark Triad traits are amplified.
 */
export function rollDarkTriad(
  base: DarkTriadScores,
  difficulty: DifficultyLevel,
  rng: () => number = Math.random,
): DarkTriadScores {
  const multiplier = DIFFICULTY_MODIFIERS[difficulty].darkTriadMultiplier;
  // Add gaussian noise (stddev 5) then apply difficulty multiplier
  return {
    narcissism:       Math.round(clamp(gaussian(base.narcissism * multiplier, 5, rng), 0, 100)),
    machiavellianism: Math.round(clamp(gaussian(base.machiavellianism * multiplier, 5, rng), 0, 100)),
    psychopathy:      Math.round(clamp(gaussian(base.psychopathy * multiplier, 5, rng), 0, 100)),
    sadism:           Math.round(clamp(gaussian(base.sadism * multiplier, 5, rng), 0, 100)),
  };
}

/**
 * Roll a first-contact attitude value from a species' range.
 */
export function rollFirstContactAttitude(
  range: { min: number; max: number },
  rng: () => number = Math.random,
): number {
  return Math.round(range.min + rng() * (range.max - range.min));
}

// ---------------------------------------------------------------------------
// Complete personality rolling
// ---------------------------------------------------------------------------

/**
 * Roll a complete per-game personality from a species' personality data.
 * This is the main entry point for personality generation.
 *
 * @param data       Species personality template data.
 * @param difficulty Game difficulty level.
 * @param rng        Random function for deterministic testing.
 * @returns A concrete RolledPersonality for this game instance.
 */
export function rollPersonality(
  data: SpeciesPersonalityData,
  difficulty: DifficultyLevel = 'normal',
  rng: () => number = Math.random,
): RolledPersonality {
  return {
    speciesId: data.speciesId,
    traits: rollCoreTraits(data.traits, difficulty, rng),
    subfacets: rollSubfacets(data.subfacets, rng),
    attachmentStyle: data.attachmentStyle,
    enneagram: { ...data.enneagram },
    darkTriad: rollDarkTriad(data.darkTriad, difficulty, rng),
    moralFoundations: { ...data.moralFoundations },
    firstContactAttitude: rollFirstContactAttitude(data.firstContactAttitude, rng),
    difficulty,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the difficulty offset for a specific core trait.
 * Only agreeableness, honestyHumility, and neuroticism are shifted.
 */
function getDifficultyOffset(trait: CoreTraitKey, mods: DifficultyModifiers): number {
  switch (trait) {
    case 'agreeableness': return mods.agreeableness;
    case 'honestyHumility': return mods.honestyHumility;
    case 'neuroticism': return mods.neuroticism;
    default: return 0;
  }
}

/**
 * Create a default RolledPersonality for backward compatibility with
 * old saves that don't have psychology data. Uses species defaults
 * at normal difficulty with a fixed seed.
 */
export function createDefaultPersonality(speciesId: string): RolledPersonality {
  return {
    speciesId,
    traits: {
      neuroticism: 50,
      extraversion: 50,
      openness: 50,
      agreeableness: 50,
      conscientiousness: 50,
      honestyHumility: 50,
    },
    subfacets: {},
    attachmentStyle: 'secure',
    enneagram: { type: 9, wing: 1, stressDirection: 6, growthDirection: 3 },
    darkTriad: { narcissism: 15, machiavellianism: 15, psychopathy: 15, sadism: 5 },
    moralFoundations: {
      careHarm: 50,
      fairnessCheating: 50,
      loyaltyBetrayal: 50,
      authoritySubversion: 50,
      sanctityDegradation: 50,
      libertyOppression: 50,
    },
    firstContactAttitude: 0,
    difficulty: 'normal',
  };
}
