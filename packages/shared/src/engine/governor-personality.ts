/**
 * Governor personality engine — pure functions for generating governors with
 * personality traits, calculating their effect on planetary output, and
 * evolving their loyalty over time.
 *
 * This system supplements the existing governor engine (governors.ts) with a
 * richer personality model. Governors are not just modifier bonuses — they are
 * characters with traits that create meaningful gameplay consequences.
 *
 * All functions are pure / side-effect-free. Callers must persist state.
 */

import type {
  GovernorPersonality,
  GovernorPersonalityModifiers,
  GovernorTraits,
} from '../types/governor-personality.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Name generation word lists
// ---------------------------------------------------------------------------

const GIVEN_NAMES = [
  'Alder', 'Brant', 'Calder', 'Darek', 'Elsin', 'Farrow', 'Galen', 'Havel',
  'Ivor', 'Joran', 'Kael', 'Lorin', 'Maren', 'Navar', 'Oswyn', 'Praxis',
  'Quell', 'Roan', 'Soren', 'Teval', 'Uther', 'Vareth', 'Wren', 'Xael',
  'Yoran', 'Zephyr', 'Cassia', 'Delwyn', 'Eryn', 'Felan', 'Hessa', 'Idris',
  'Keran', 'Lyris', 'Meron', 'Naleth', 'Thera', 'Venna', 'Ayla', 'Brynn',
];

const FAMILY_SUFFIXES = [
  'an', 'ar', 'el', 'en', 'eth', 'ik', 'in', 'ion', 'is', 'ix',
  'on', 'or', 'os', 'ox', 'us', 'ael', 'arn', 'eld', 'eon', 'esh',
  'iel', 'ith', 'ius', 'nar', 'nel', 'nis', 'nor', 'oth', 'val', 'ven',
];

// ---------------------------------------------------------------------------
// Seeded pseudo-random helper (mulberry32)
// ---------------------------------------------------------------------------

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function randPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// ---------------------------------------------------------------------------
// Public: generateGovernor
// ---------------------------------------------------------------------------

/**
 * Generate a random governor with personality traits.
 *
 * @param speciesId  The species this governor belongs to.
 * @param seed       Seed for reproducible generation.
 * @returns A fully populated GovernorPersonality.
 */
export function generateGovernorPersonality(speciesId: string, seed: number): GovernorPersonality {
  const rng = makeRng(seed);

  // Generate name
  const given = randPick(rng, GIVEN_NAMES);
  const familyRoot = randPick(rng, GIVEN_NAMES);
  const familySuffix = randPick(rng, FAMILY_SUFFIXES);
  const name = `${given} ${familyRoot}${familySuffix}`;

  // Generate traits — each 0-10
  const traitKeys: (keyof GovernorTraits)[] = [
    'industrialist', 'intellectual', 'militarist', 'merchant',
    'charismatic', 'administrator', 'authoritarian', 'humanitarian',
  ];

  const traits: GovernorTraits = {
    industrialist: 0,
    intellectual: 0,
    militarist: 0,
    merchant: 0,
    charismatic: 0,
    administrator: 0,
    authoritarian: 0,
    humanitarian: 0,
  };

  // Base roll: 1-5 for each trait
  for (const key of traitKeys) {
    traits[key] = randInt(rng, 1, 5);
  }

  // Specialism: pick 2-3 traits to boost by 2-5 (representing strengths)
  const specialismCount = randInt(rng, 2, 3);
  const shuffled = [...traitKeys].sort(() => rng() - 0.5);
  for (let i = 0; i < specialismCount; i++) {
    const key = shuffled[i]!;
    traits[key] = Math.min(10, traits[key] + randInt(rng, 2, 5));
  }

  // Authoritarian and humanitarian are somewhat opposed — reduce one if the other is high
  if (traits.authoritarian > 6 && traits.humanitarian > 4) {
    traits.humanitarian = Math.max(1, traits.humanitarian - 3);
  } else if (traits.humanitarian > 6 && traits.authoritarian > 4) {
    traits.authoritarian = Math.max(1, traits.authoritarian - 3);
  }

  // Loyalty, corruption, competence, popularity
  const loyalty = randInt(rng, 40, 90);
  const corruption = randInt(rng, 0, 30);
  const competence = randInt(rng, 30, 90);
  const popularity = randInt(rng, -20, 50);

  // High administrator trait reduces corruption
  const adjustedCorruption = Math.max(0, corruption - traits.administrator * 2);

  return {
    id: generateId(),
    name,
    speciesId,
    traits,
    loyalty,
    corruption: adjustedCorruption,
    competence,
    popularity,
  };
}

// ---------------------------------------------------------------------------
// Public: calculateGovernorModifiers
// ---------------------------------------------------------------------------

/**
 * Derive gameplay modifiers from a governor's personality traits.
 *
 * @param governor  The governor to evaluate.
 * @returns Computed modifiers for use in production calculations.
 */
export function calculateGovernorModifiers(governor: GovernorPersonality): GovernorPersonalityModifiers {
  const t = governor.traits;
  const competenceFactor = governor.competence / 100; // 0.0 - 1.0

  // Production: driven by industrialist trait and competence
  const productionMultiplier = 1.0 + (t.industrialist * 0.03) * competenceFactor;

  // Research: driven by intellectual trait and competence
  const researchMultiplier = 1.0 + (t.intellectual * 0.03) * competenceFactor;

  // Military: driven by militarist trait and competence
  const militaryMultiplier = 1.0 + (t.militarist * 0.03) * competenceFactor;

  // Trade: driven by merchant trait and competence
  const tradeMultiplier = 1.0 + (t.merchant * 0.03) * competenceFactor;

  // Happiness: charismatic and humanitarian boost, authoritarian penalises
  const happinessBonus = Math.round(
    (t.charismatic * 2 + t.humanitarian * 1.5 - t.authoritarian * 1.5) * competenceFactor,
  );

  // Corruption drain: percentage of resources skimmed (0.0 - 0.15)
  // High administrator trait reduces corruption
  const corruptionDrain = Math.min(0.15, Math.max(0, governor.corruption / 100 * 0.15));

  // Unrest modifier: positive = calms, negative = agitates
  // Authoritarian governors maintain order but breed resentment
  // Charismatic/humanitarian governors calm through goodwill
  const unrestModifier = Math.round(
    (t.charismatic * 1.5 + t.humanitarian * 1.0 + t.authoritarian * 2.0
      - t.authoritarian * 0.5) * competenceFactor,
  );
  // Note: authoritarian contributes 1.5 net — effective but with side effects handled elsewhere

  return {
    productionMultiplier: roundTo(productionMultiplier, 3),
    researchMultiplier: roundTo(researchMultiplier, 3),
    militaryMultiplier: roundTo(militaryMultiplier, 3),
    tradeMultiplier: roundTo(tradeMultiplier, 3),
    happinessBonus,
    corruptionDrain: roundTo(corruptionDrain, 4),
    unrestModifier,
  };
}

// ---------------------------------------------------------------------------
// Public: tickGovernorLoyalty
// ---------------------------------------------------------------------------

/**
 * Evolve a governor's loyalty based on empire actions and conditions.
 *
 * @param governor        The governor to update.
 * @param empireHappiness Overall empire happiness score (-100 to 100).
 * @param atWar           Whether the empire is currently at war.
 * @param turnsSinceEvent Turns since the last major event affecting this governor.
 * @returns A new GovernorPersonality with updated loyalty and popularity.
 */
export function tickGovernorLoyalty(
  governor: GovernorPersonality,
  empireHappiness: number,
  atWar: boolean,
  turnsSinceEvent: number,
): GovernorPersonality {
  let loyaltyDelta = 0;
  let popularityDelta = 0;

  // Empire happiness affects governor loyalty
  if (empireHappiness > 30) {
    loyaltyDelta += 1;
  } else if (empireHappiness < -30) {
    loyaltyDelta -= 2;
  }

  // War affects militarist governors positively, others negatively
  if (atWar) {
    if (governor.traits.militarist >= 6) {
      loyaltyDelta += 1;
      popularityDelta += 1; // Militarists thrive in wartime
    } else if (governor.traits.humanitarian >= 6) {
      loyaltyDelta -= 1;
      popularityDelta -= 1; // Humanitarians suffer in wartime
    }
  }

  // Gradual loyalty recovery towards neutral (60) over time
  if (turnsSinceEvent > 10) {
    if (governor.loyalty < 60) loyaltyDelta += 1;
    if (governor.loyalty > 80) loyaltyDelta -= 0; // High loyalty is stable
  }

  // Corrupt governors slowly become less loyal
  if (governor.corruption > 20) {
    loyaltyDelta -= 1;
  }

  // Authoritarian governors with low popularity become increasingly disloyal
  if (governor.traits.authoritarian >= 7 && governor.popularity < -30) {
    loyaltyDelta -= 1;
  }

  // Charismatic governors gain popularity over time
  if (governor.traits.charismatic >= 5) {
    popularityDelta += 1;
  }

  return {
    ...governor,
    loyalty: clamp(governor.loyalty + loyaltyDelta, 0, 100),
    popularity: clamp(governor.popularity + popularityDelta, -100, 100),
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
