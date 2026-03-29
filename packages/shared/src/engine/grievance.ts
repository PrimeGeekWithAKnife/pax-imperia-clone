/**
 * Grievance engine — pure functions for creating, decaying, and evaluating
 * inter-empire grievances as casus belli.
 *
 * All functions are side-effect free. Callers must persist the returned state.
 *
 * Design goals:
 *  - Tiered decay: slights fade fast, offences slowly, existential betrayals NEVER
 *  - Casus belli requires accumulated grievance strength above a threshold
 *  - Grievances are poolable for coalition wars between allied empires
 *  - Fabricated grievances carry detection risk inversely proportional to spy skill
 *  - Government type affects casus belli flexibility (authoritarian = lower bar)
 */

import type { Grievance, GrievanceSeverity } from '../types/diplomacy.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Decay rate per tick for each grievance severity tier.
 *  - slight:      2.0 per tick — fades within ~25 ticks
 *  - offence:     0.5 per tick — lingers for ~100 ticks
 *  - major:       0.1 per tick — takes ~500 ticks to vanish
 *  - existential: 0.0 per tick — never forgotten
 */
export const GRIEVANCE_DECAY_RATES: Record<GrievanceSeverity, number> = {
  slight: 2.0,
  offence: 0.5,
  major: 0.1,
  existential: 0.0,
};

/**
 * Default initial attitude impact for each grievance severity tier.
 * These serve as sensible defaults when the caller does not supply a value.
 */
export const GRIEVANCE_DEFAULT_VALUES: Record<GrievanceSeverity, number> = {
  slight: 10,
  offence: 30,
  major: 60,
  existential: 100,
};

/**
 * Minimum cumulative grievance strength required to justify a war declaration.
 * Government type modifiers are applied on top of this base.
 */
export const CASUS_BELLI_THRESHOLD = 50;

/**
 * Government-type modifiers to the casus belli threshold.
 * Negative values make war easier to justify; positive values make it harder.
 * Authoritarian regimes need less justification; democracies need more.
 */
export const GOVERNMENT_CASUS_BELLI_MODIFIERS: Record<string, number> = {
  autocracy: -20,
  oligarchy: -10,
  theocracy: -15,
  military_junta: -25,
  democracy: 20,
  republic: 15,
  federation: 10,
  hive_mind: -30,
  corporate: -5,
  technocracy: 5,
};

/**
 * Minimum evidence strength to be taken seriously in diplomatic circles.
 * Below this, other empires may dismiss the grievance.
 */
export const MINIMUM_CREDIBLE_EVIDENCE = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Public API — grievance creation
// ---------------------------------------------------------------------------

/**
 * Create a new grievance between empires.
 *
 * The decay rate is automatically set based on severity tier:
 *  - slight:      2.0 per tick (fades quickly)
 *  - offence:     0.5 per tick (moderate persistence)
 *  - major:       0.1 per tick (very slow decay)
 *  - existential: 0.0 per tick (never decays)
 *
 * @param perpetratorId - Empire that committed the offence.
 * @param victimId      - Empire that was wronged.
 * @param severity      - Severity tier of the grievance.
 * @param description   - Human-readable description of the offence.
 * @param witnesses     - Empire IDs aware of this grievance.
 * @param tick          - Game tick when the grievance occurred.
 * @param initialValue  - Optional override for the initial attitude impact.
 * @returns A new Grievance record.
 */
export function createGrievance(
  perpetratorId: string,
  victimId: string,
  severity: GrievanceSeverity,
  description: string,
  witnesses: string[],
  tick: number,
  initialValue?: number,
): Grievance {
  const value = initialValue ?? GRIEVANCE_DEFAULT_VALUES[severity];
  return {
    id: generateId(),
    tick,
    severity,
    description,
    initialValue: value,
    currentValue: value,
    decayRate: GRIEVANCE_DECAY_RATES[severity],
    perpetratorEmpireId: perpetratorId,
    victimEmpireId: victimId,
    witnesses: [...witnesses],
    evidenceStrength: 100, // Legitimate grievances have full evidence
    fabricated: false,
  };
}

// ---------------------------------------------------------------------------
// Public API — per-tick processing
// ---------------------------------------------------------------------------

/**
 * Process one game tick for all grievances: apply decay, remove expired ones.
 *
 * Existential grievances (decayRate === 0) never expire.
 * All other grievances lose currentValue each tick; once they reach zero
 * they are moved to the expired list.
 *
 * @param grievances - Array of active grievances.
 * @param tick       - Current game tick (for logging/auditing).
 * @returns Object containing surviving grievances and those that expired this tick.
 */
export function processGrievanceTick(
  grievances: readonly Grievance[],
  tick: number,
): { grievances: Grievance[]; expired: Grievance[] } {
  const surviving: Grievance[] = [];
  const expired: Grievance[] = [];

  for (const g of grievances) {
    const decayed: Grievance = {
      ...g,
      witnesses: [...g.witnesses],
      currentValue: Math.max(0, g.currentValue - g.decayRate),
    };

    if (decayed.currentValue <= 0 && decayed.decayRate > 0) {
      expired.push(decayed);
    } else {
      surviving.push(decayed);
    }
  }

  return { grievances: surviving, expired };
}

// ---------------------------------------------------------------------------
// Public API — casus belli evaluation
// ---------------------------------------------------------------------------

/**
 * Determine whether an empire has sufficient grievances against a target
 * to justify a war declaration (casus belli).
 *
 * The justification considers:
 *  1. Sum of currentValue for all grievances held by empireId against targetId
 *  2. Government type modifier (authoritarian = lower threshold)
 *  3. Evidence strength weighting (weak evidence reduces effective value)
 *
 * @param grievances     - All grievances in the game.
 * @param empireId       - Empire considering war.
 * @param targetId       - Prospective war target.
 * @param governmentType - Government type of the empire considering war (optional).
 * @returns Justification result with strength score and contributing grievance IDs.
 */
export function calculateCasusBelli(
  grievances: readonly Grievance[],
  empireId: string,
  targetId: string,
  governmentType?: string,
): { justified: boolean; strength: number; grievanceIds: string[] } {
  const relevant = grievances.filter(
    (g) => g.victimEmpireId === empireId && g.perpetratorEmpireId === targetId,
  );

  // Weight each grievance's contribution by its evidence credibility
  let totalStrength = 0;
  const grievanceIds: string[] = [];

  for (const g of relevant) {
    const evidenceFactor = g.evidenceStrength >= MINIMUM_CREDIBLE_EVIDENCE
      ? g.evidenceStrength / 100
      : g.evidenceStrength / 200; // Weak evidence is discounted heavily
    totalStrength += g.currentValue * evidenceFactor;
    grievanceIds.push(g.id);
  }

  // Apply government type modifier to the threshold
  const govModifier = governmentType
    ? (GOVERNMENT_CASUS_BELLI_MODIFIERS[governmentType] ?? 0)
    : 0;
  const effectiveThreshold = Math.max(10, CASUS_BELLI_THRESHOLD + govModifier);

  return {
    justified: totalStrength >= effectiveThreshold,
    strength: Math.round(totalStrength * 100) / 100,
    grievanceIds,
  };
}

// ---------------------------------------------------------------------------
// Public API — coalition grievance pooling
// ---------------------------------------------------------------------------

/**
 * Pool grievances from two allied empires against a shared target for a
 * coalition war declaration.
 *
 * Only grievances where the target is the perpetrator are included.
 * Duplicate grievances (same ID present in both arrays) are deduplicated.
 *
 * @param empire1Grievances - Grievances held by the first ally.
 * @param empire2Grievances - Grievances held by the second ally.
 * @param targetId          - The shared enemy empire.
 * @returns Combined grievances and total pooled strength.
 */
export function poolGrievances(
  empire1Grievances: readonly Grievance[],
  empire2Grievances: readonly Grievance[],
  targetId: string,
): { combined: Grievance[]; totalStrength: number } {
  const seen = new Set<string>();
  const combined: Grievance[] = [];
  let totalStrength = 0;

  const addIfRelevant = (g: Grievance): void => {
    if (g.perpetratorEmpireId !== targetId) return;
    if (seen.has(g.id)) return;
    seen.add(g.id);
    const copy: Grievance = { ...g, witnesses: [...g.witnesses] };
    combined.push(copy);
    const evidenceFactor = g.evidenceStrength >= MINIMUM_CREDIBLE_EVIDENCE
      ? g.evidenceStrength / 100
      : g.evidenceStrength / 200;
    totalStrength += g.currentValue * evidenceFactor;
  };

  for (const g of empire1Grievances) addIfRelevant(g);
  for (const g of empire2Grievances) addIfRelevant(g);

  return {
    combined,
    totalStrength: Math.round(totalStrength * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Public API — fabricated grievances
// ---------------------------------------------------------------------------

/**
 * Fabricate a grievance through espionage.
 *
 * Creates a fake grievance with evidence strength and detection risk both
 * derived from the spy's skill level. High-skill spies produce more
 * convincing fabrications with lower risk of exposure.
 *
 * Detection risk formula:
 *   baseRisk = 0.8 - (spySkill / 12.5)
 *   → skill 1: ~72% risk, skill 5: ~40% risk, skill 10: ~0% risk
 *
 * Evidence strength formula:
 *   strength = clamp(spySkill * 10 + rng * 20, 10, 100)
 *   → skill 1: 10-30, skill 10: 100
 *
 * @param perpetratorId - Empire that will be blamed (the frame target).
 * @param victimId      - Empire that will receive the fabricated grievance.
 * @param severity      - Severity of the fabricated offence.
 * @param description   - Description of the alleged offence.
 * @param tick          - Current game tick.
 * @param spySkill      - Skill level of the spy performing the fabrication (1-10).
 * @param rng           - Random number generator returning values in [0, 1).
 * @returns The fabricated grievance and the detection risk (0-1).
 */
export function fabricateGrievance(
  perpetratorId: string,
  victimId: string,
  severity: GrievanceSeverity,
  description: string,
  tick: number,
  spySkill: number,
  rng: () => number,
): { grievance: Grievance; detectionRisk: number } {
  const skill = clamp(spySkill, 1, 10);

  // Evidence quality scales with skill — unskilled fabrications are flimsy
  const evidenceStrength = clamp(
    Math.round(skill * 10 + rng() * 20),
    10,
    100,
  );

  // Detection risk inversely proportional to skill
  const detectionRisk = clamp(0.8 - skill / 12.5, 0, 1);

  const value = GRIEVANCE_DEFAULT_VALUES[severity];

  const grievance: Grievance = {
    id: generateId(),
    tick,
    severity,
    description,
    initialValue: value,
    currentValue: value,
    decayRate: GRIEVANCE_DECAY_RATES[severity],
    perpetratorEmpireId: perpetratorId,
    victimEmpireId: victimId,
    witnesses: [victimId], // Only the victim "sees" the fabricated incident
    evidenceStrength,
    fabricated: true,
  };

  return { grievance, detectionRisk };
}

// ---------------------------------------------------------------------------
// Public API — grievance queries
// ---------------------------------------------------------------------------

/**
 * Retrieve all active grievances where a given empire is the victim.
 *
 * @param grievances - All grievances in the game.
 * @param empireId   - Empire to filter as victim.
 * @returns Grievances where the empire was wronged.
 */
export function getGrievancesAgainst(
  grievances: readonly Grievance[],
  empireId: string,
): Grievance[] {
  return grievances
    .filter((g) => g.victimEmpireId === empireId)
    .map((g) => ({ ...g, witnesses: [...g.witnesses] }));
}

/**
 * Retrieve all active grievances where a given empire is the perpetrator.
 *
 * @param grievances - All grievances in the game.
 * @param empireId   - Empire to filter as perpetrator.
 * @returns Grievances where the empire committed the offence.
 */
export function getGrievancesBy(
  grievances: readonly Grievance[],
  empireId: string,
): Grievance[] {
  return grievances
    .filter((g) => g.perpetratorEmpireId === empireId)
    .map((g) => ({ ...g, witnesses: [...g.witnesses] }));
}

/**
 * Calculate the total grievance burden between two empires.
 *
 * Returns the sum of currentValue for all grievances where victimId
 * holds grievances against perpetratorId.
 *
 * @param grievances    - All grievances in the game.
 * @param victimId      - Empire holding the grievances.
 * @param perpetratorId - Empire that committed the offences.
 * @returns Total grievance value.
 */
export function calculateGrievanceBurden(
  grievances: readonly Grievance[],
  victimId: string,
  perpetratorId: string,
): number {
  return grievances
    .filter((g) => g.victimEmpireId === victimId && g.perpetratorEmpireId === perpetratorId)
    .reduce((sum, g) => sum + g.currentValue, 0);
}
