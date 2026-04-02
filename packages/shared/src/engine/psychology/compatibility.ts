/**
 * Compatibility Computation Engine
 *
 * Computes trait similarity between two personality vectors using empirically
 * weighted dimensions. Combines with species-pair static affinity and applies
 * Dark Triad penalties.
 *
 * Formula from personality psychology meta-analyses:
 *   N-similarity = 0.29 (most important for interpersonal dynamics)
 *   A-similarity = 0.29
 *   C-similarity = 0.25
 *   E-similarity = 0.17
 *   O-similarity = 0.10
 *   minus Dark Triad penalty
 *
 * Output: -100 to +100 compatibility score.
 */

import type {
  RolledPersonality,
  CoreTraits,
  DarkTriadScores,
  AffinityMatrix,
} from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Weights (from Heller, Watson & Ilies 2004 meta-analysis)
// ---------------------------------------------------------------------------

/** Empirical weights for trait similarity. N and A predict most interpersonal dynamics. */
const TRAIT_WEIGHTS: Record<string, number> = {
  neuroticism: 0.29,
  agreeableness: 0.29,
  conscientiousness: 0.25,
  extraversion: 0.17,
  openness: 0.10,
};

/** Weight for Dark Triad penalty in compatibility calculation. */
const DARK_TRIAD_PENALTY_WEIGHT = 0.15;

// ---------------------------------------------------------------------------
// Core compatibility
// ---------------------------------------------------------------------------

/**
 * Compute raw trait similarity between two personality vectors.
 * Returns a value from 0 to 1 where 1 = identical traits.
 */
export function traitSimilarity(a: CoreTraits, b: CoreTraits): number {
  let weighted = 0;
  let totalWeight = 0;

  for (const [trait, weight] of Object.entries(TRAIT_WEIGHTS)) {
    const aVal = a[trait as keyof CoreTraits];
    const bVal = b[trait as keyof CoreTraits];
    const similarity = 1 - Math.abs(aVal - bVal) / 100;
    weighted += similarity * weight;
    totalWeight += weight;
  }

  return weighted / totalWeight;
}

/**
 * Compute Dark Triad penalty for a pair of personalities.
 * High DT traits in either party reduce compatibility.
 * Returns 0-1 where 0 = no penalty, 1 = maximum penalty.
 */
export function darkTriadPenalty(a: DarkTriadScores, b: DarkTriadScores): number {
  // Take the maximum Dark Triad score from either party
  const maxDT = Math.max(
    a.narcissism, a.machiavellianism, a.psychopathy, a.sadism,
    b.narcissism, b.machiavellianism, b.psychopathy, b.sadism,
  );
  return maxDT / 100;
}

/**
 * Compute compatibility between two rolled personalities.
 * Returns -100 to +100.
 *
 * The formula: trait_similarity * (1 - DT_weight) - DT_penalty * DT_weight,
 * then scaled to [-100, +100] range.
 */
export function computeCompatibility(a: RolledPersonality, b: RolledPersonality): number {
  const sim = traitSimilarity(a.traits, b.traits);
  const dtPenalty = darkTriadPenalty(a.darkTriad, b.darkTriad);

  // Raw score: 0-1 range
  const raw = sim * (1 - DARK_TRIAD_PENALTY_WEIGHT) - dtPenalty * DARK_TRIAD_PENALTY_WEIGHT;

  // Scale to -100..+100 (0.5 raw = 0 compatibility, i.e. average similarity)
  return Math.round((raw - 0.5) * 200);
}

// ---------------------------------------------------------------------------
// Species-pair affinity lookup
// ---------------------------------------------------------------------------

/**
 * Look up the base affinity between two species from the affinity matrix.
 * Handles symmetry (A→B = B→A).
 */
export function lookupBaseAffinity(
  matrix: AffinityMatrix,
  speciesA: string,
  speciesB: string,
): number {
  if (speciesA === speciesB) return 0;

  const pair = matrix.pairs.find(
    p => (p.speciesA === speciesA && p.speciesB === speciesB)
      || (p.speciesA === speciesB && p.speciesB === speciesA),
  );

  return pair ? pair.baseAffinity : matrix.defaultAffinity;
}

/**
 * Compute the total initial compatibility between two empires.
 * Combines trait-based compatibility with species-pair base affinity.
 *
 * @param a          Rolled personality of empire A.
 * @param b          Rolled personality of empire B.
 * @param matrix     The species-pair affinity matrix.
 * @returns Combined compatibility score, clamped to -100..+100.
 */
export function computeTotalCompatibility(
  a: RolledPersonality,
  b: RolledPersonality,
  matrix: AffinityMatrix,
): number {
  const traitCompat = computeCompatibility(a, b);
  const baseAffinity = lookupBaseAffinity(matrix, a.speciesId, b.speciesId);

  return Math.round(
    Math.min(100, Math.max(-100, traitCompat + baseAffinity)),
  );
}
