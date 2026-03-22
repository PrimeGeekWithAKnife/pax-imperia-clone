/**
 * AI Personality Engine — D&D-inspired trait profiles that drive AI behaviour.
 *
 * Each species has a default personality profile built from eight axes.
 * Individual AI empires can vary from the species baseline to create
 * unique opponents every game.
 *
 * Design principle: personality determines *what* the AI wants to do;
 * competence (difficulty level) determines *how well* it executes.
 */

import type { AIPersonalityProfile, AIBehaviourWeights } from '../../types/ai-personality.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value to the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalise a raw weighted sum into the 0–1 range.
 * The formula maps the weighted combination of 1–10 traits (which can
 * produce values anywhere in a wide range) into [0, 1].
 */
function normalise(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min), 0, 1);
}

/** Invert a 1–10 trait so that 1 becomes 10 and vice-versa. */
function invert(trait: number): number {
  return 11 - trait;
}

// ---------------------------------------------------------------------------
// Core: calculateBehaviourWeights
// ---------------------------------------------------------------------------

/**
 * Derive concrete behaviour weights from a personality profile.
 *
 * Each weight is a function of several personality traits, normalised to 0–1.
 * The formulae are designed so that species archetypes produce intuitively
 * correct results — e.g. high honesty and loyalty yield high treaty
 * reliability, while high ambition and low empathy yield high war propensity.
 */
export function calculateBehaviourWeights(profile: AIPersonalityProfile): AIBehaviourWeights {
  const {
    honesty,
    bravery,
    ambition,
    patience,
    empathy,
    openness,
    loyalty,
    pragmatism,
  } = profile;

  // warPropensity: brave, ambitious empires with low empathy and low patience
  // are the most war-prone. Weighted sum range: 4–40
  const warRaw = bravery * 0.3 + ambition * 0.3 + invert(empathy) * 0.25 + invert(patience) * 0.15;
  const warPropensity = normalise(warRaw, 1, 10);

  // treatyReliability: honest, loyal empires that are not overly pragmatic
  // honour their agreements. Weighted sum range: 3–30
  const treatyRaw = honesty * 0.4 + loyalty * 0.35 + invert(pragmatism) * 0.25;
  const treatyReliability = normalise(treatyRaw, 1, 10);

  // espionagePropensity: pragmatic, dishonest, ambitious empires spy more
  const espionageRaw = pragmatism * 0.35 + invert(honesty) * 0.35 + ambition * 0.3;
  const espionagePropensity = normalise(espionageRaw, 1, 10);

  // tradePropensity: open, empathetic empires with pragmatic streak trade more
  const tradeRaw = openness * 0.35 + pragmatism * 0.25 + empathy * 0.2 + invert(ambition) * 0.2;
  const tradePropensity = normalise(tradeRaw, 1, 10);

  // victoryDrive: ambitious, brave, impatient empires push for victory
  const victoryRaw = ambition * 0.45 + bravery * 0.2 + invert(patience) * 0.2 + pragmatism * 0.15;
  const victoryDrive = normalise(victoryRaw, 1, 10);

  // diplomaticOpenness: open, empathetic, honest empires are most receptive
  const diplomacyRaw = openness * 0.35 + empathy * 0.25 + honesty * 0.2 + patience * 0.2;
  const diplomaticOpenness = normalise(diplomacyRaw, 1, 10);

  // coldWarPropensity: ambitious, patient empires with low openness prefer
  // indirect conflict over open war
  const coldWarRaw = ambition * 0.25 + patience * 0.25 + invert(openness) * 0.25 + pragmatism * 0.25;
  const coldWarPropensity = normalise(coldWarRaw, 1, 10);

  // deceptionPropensity: dishonest, disloyal, pragmatic empires deceive
  const deceptionRaw = invert(honesty) * 0.4 + invert(loyalty) * 0.3 + pragmatism * 0.3;
  const deceptionPropensity = normalise(deceptionRaw, 1, 10);

  return {
    warPropensity,
    treatyReliability,
    espionagePropensity,
    tradePropensity,
    victoryDrive,
    diplomaticOpenness,
    coldWarPropensity,
    deceptionPropensity,
  };
}

// ---------------------------------------------------------------------------
// Species default profiles
// ---------------------------------------------------------------------------

/**
 * Pre-built personality profiles for each of the 15 playable species.
 * Keyed by species ID. These represent the species' cultural baseline;
 * individual AI empires may vary via randomisePersonality().
 */
export const SPECIES_DEFAULT_PROFILES: Record<string, AIPersonalityProfile> = {
  // Vaelori — ancient contemplatives, crystalline beings who value deliberation
  vaelori: {
    honesty: 8,
    bravery: 4,
    ambition: 3,
    patience: 9,
    empathy: 6,
    openness: 8,
    loyalty: 7,
    pragmatism: 3,
  },

  // Khazari — honour-bound warriors, direct and aggressive
  khazari: {
    honesty: 9,
    bravery: 10,
    ambition: 8,
    patience: 3,
    empathy: 2,
    openness: 3,
    loyalty: 8,
    pragmatism: 4,
  },

  // Sylvani — patient gardeners, long-term thinkers
  sylvani: {
    honesty: 7,
    bravery: 5,
    ambition: 4,
    patience: 10,
    empathy: 8,
    openness: 6,
    loyalty: 6,
    pragmatism: 5,
  },

  // Nexari — logical assimilators, polite but relentless
  nexari: {
    honesty: 6,
    bravery: 6,
    ambition: 7,
    patience: 8,
    empathy: 3,
    openness: 5,
    loyalty: 5,
    pragmatism: 9,
  },

  // Drakmari — predator honour, aggressive yet with a warrior code
  drakmari: {
    honesty: 5,
    bravery: 9,
    ambition: 7,
    patience: 4,
    empathy: 3,
    openness: 4,
    loyalty: 6,
    pragmatism: 6,
  },

  // Teranos — unpredictable humans, balanced but inconsistent
  teranos: {
    honesty: 5,
    bravery: 6,
    ambition: 7,
    patience: 5,
    empathy: 5,
    openness: 7,
    loyalty: 5,
    pragmatism: 7,
  },

  // Zorvathi — hive instinct, utterly loyal but without compassion
  zorvathi: {
    honesty: 7,
    bravery: 7,
    ambition: 6,
    patience: 6,
    empathy: 1,
    openness: 2,
    loyalty: 9,
    pragmatism: 8,
  },

  // Ashkari — survival traders, slippery and transactional
  ashkari: {
    honesty: 3,
    bravery: 5,
    ambition: 6,
    patience: 6,
    empathy: 4,
    openness: 8,
    loyalty: 4,
    pragmatism: 10,
  },

  // Luminari — curious energy beings, peaceful explorers
  luminari: {
    honesty: 8,
    bravery: 3,
    ambition: 4,
    patience: 7,
    empathy: 7,
    openness: 10,
    loyalty: 5,
    pragmatism: 4,
  },

  // Vethara — symbiotic need, charming but unsettling
  vethara: {
    honesty: 4,
    bravery: 5,
    ambition: 8,
    patience: 7,
    empathy: 5,
    openness: 6,
    loyalty: 6,
    pragmatism: 8,
  },

  // Kaelenth — machine search, patient and methodical
  kaelenth: {
    honesty: 9,
    bravery: 6,
    ambition: 5,
    patience: 10,
    empathy: 2,
    openness: 5,
    loyalty: 8,
    pragmatism: 6,
  },

  // Thyriaq — growth imperative, relentless expansion
  thyriaq: {
    honesty: 7,
    bravery: 4,
    ambition: 9,
    patience: 3,
    empathy: 1,
    openness: 3,
    loyalty: 7,
    pragmatism: 9,
  },

  // Aethyn — dimensional pioneers, curious and adventurous
  aethyn: {
    honesty: 6,
    bravery: 7,
    ambition: 5,
    patience: 6,
    empathy: 6,
    openness: 10,
    loyalty: 5,
    pragmatism: 5,
  },

  // Orivani — faith-driven zealots, rigidly principled
  orivani: {
    honesty: 10,
    bravery: 9,
    ambition: 8,
    patience: 5,
    empathy: 6,
    openness: 4,
    loyalty: 9,
    pragmatism: 1,
  },

  // Pyrenth — geological patience, ancient and immovable
  pyrenth: {
    honesty: 8,
    bravery: 7,
    ambition: 3,
    patience: 10,
    empathy: 3,
    openness: 2,
    loyalty: 7,
    pragmatism: 5,
  },
};

// ---------------------------------------------------------------------------
// Randomisation
// ---------------------------------------------------------------------------

/**
 * Create a unique personality by applying random variation to a base profile.
 *
 * Each trait is adjusted by a random amount in the range [-variance, +variance],
 * then clamped to [1, 10]. This ensures every AI empire of the same species
 * feels slightly different without straying too far from its cultural baseline.
 *
 * @param base     The species' default personality profile.
 * @param variance Maximum deviation per trait (e.g. 2 means ±2).
 * @returns A new profile with randomised trait values.
 */
export function randomisePersonality(
  base: AIPersonalityProfile,
  variance: number,
): AIPersonalityProfile {
  const traits: (keyof AIPersonalityProfile)[] = [
    'honesty',
    'bravery',
    'ambition',
    'patience',
    'empathy',
    'openness',
    'loyalty',
    'pragmatism',
  ];

  const result = { ...base };

  for (const trait of traits) {
    const delta = Math.round((Math.random() * 2 - 1) * variance);
    result[trait] = clamp(base[trait] + delta, 1, 10);
  }

  return result;
}
