/**
 * Psychology Tick Processor
 *
 * Per-tick integration layer that updates each empire's psychological state.
 * Pipeline: empire state → Maslow needs → stress level → mood → effective traits
 *
 * This is the main entry point called from the game loop.
 */

import type {
  EmpirePsychologicalState,
  RolledPersonality,
  MoodState,
  MaslowNeeds,
  StressLevel,
  CoreTraits,
} from '../../types/psychology.js';

import { NEUTRAL_MOOD, processMoodTick } from './mood.js';
import type { MoodEvent } from './mood.js';
import { computeMaslowNeeds, belongingDeprivationImpact } from './maslow.js';
import type { EmpireStateSnapshot } from './maslow.js';
import { computeStressLevel, applyEnneagramDisintegration, applyEnneagramGrowth } from './stress.js';
import type { StressInput } from './stress.js';
import { tickRelationship } from './relationship.js';
import type { PsychRelationship } from '../../types/diplomacy-v2.js';
import { CORE_TRAIT_KEYS } from '../../types/psychology.js';
import type { CoreTraitKey } from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Create the initial psychological state for an empire at game start.
 */
export function initPsychologicalState(personality: RolledPersonality): EmpirePsychologicalState {
  return {
    personality,
    effectiveTraits: { ...personality.traits },
    mood: { ...NEUTRAL_MOOD },
    needs: {
      physiological: 80,
      safety: 70,
      belonging: 30,
      esteem: 30,
      selfActualisation: 20,
    },
    stressLevel: 'baseline',
    ticksSinceCrisis: 999, // No recent crisis at game start
    relationships: {},
  };
}

// ---------------------------------------------------------------------------
// Per-tick update
// ---------------------------------------------------------------------------

/**
 * Process one psychology tick for an empire.
 *
 * Pipeline:
 *  1. Compute Maslow needs from empire state snapshot
 *  2. Compute stress level from needs + war state
 *  3. Generate mood events from need changes and belonging deprivation
 *  4. Update mood (apply events + decay)
 *  5. Apply Enneagram disintegration/growth to effective traits
 *
 * @param state         Current psychological state.
 * @param empireState   Snapshot of the empire's current game state.
 * @param externalEvents Additional mood events from diplomatic/combat actions this tick.
 * @param rng           Random function (inject for deterministic testing).
 * @returns Updated psychological state.
 */
export function processPsychologyTick(
  state: EmpirePsychologicalState,
  empireState: EmpireStateSnapshot,
  externalEvents: MoodEvent[] = [],
  rng: () => number = Math.random,
): EmpirePsychologicalState {
  const { personality } = state;

  // 1. Compute Maslow needs
  const needs = computeMaslowNeeds(empireState);

  // 2. Compute stress level
  const previousWasCrisis = state.stressLevel === 'high' || state.stressLevel === 'extreme';
  const currentNotCrisis = empireState.activeWars === 0 && !empireState.homeworldThreatened;
  const ticksSinceCrisis = previousWasCrisis && currentNotCrisis
    ? 0  // Crisis just ended
    : (currentNotCrisis ? state.ticksSinceCrisis + 1 : 0);

  const stressInput: StressInput = {
    needs,
    activeWars: empireState.activeWars,
    homeworldThreatened: empireState.homeworldThreatened,
    previousStress: state.stressLevel,
    ticksSinceCrisis,
  };
  const stressLevel = computeStressLevel(stressInput);

  // 3. Generate internal mood events from need state
  const internalEvents = generateNeedBasedMoodEvents(needs, state.needs, personality);
  const allEvents = [...externalEvents, ...internalEvents];

  // 4. Update mood
  const mood = processMoodTick(
    state.mood,
    allEvents,
    personality.attachmentStyle,
    stressLevel,
    rng,
  );

  // 5. Apply Enneagram effects to produce effective traits
  let effectiveTraits = applyEnneagramDisintegration(
    personality.traits,
    personality.enneagram,
    stressLevel,
  );
  effectiveTraits = applyEnneagramGrowth(
    effectiveTraits,
    personality.enneagram,
    stressLevel,
    needs,
  );

  // 6. Tick all relationships (decay, contact tracking, abandonment anxiety)
  const currentTick = empireState.currentTick;
  const updatedRelationships: Record<string, import('../../types/diplomacy-v2.js').PsychRelationship> = {};
  for (const [targetId, rel] of Object.entries(state.relationships)) {
    updatedRelationships[targetId] = tickRelationship(rel, personality.attachmentStyle, currentTick);
  }

  // 7. Personality evolution — sustained experience reshapes core traits.
  // Runs every 100 ticks. Accumulated trauma, prolonged war, persistent
  // isolation, or lasting prosperity slowly shift who a species IS.
  // A Sylvani at war for 5000 ticks won't still be agreeableness 75.
  let updatedPersonality = personality;
  if (currentTick > 0 && currentTick % 100 === 0) {
    updatedPersonality = evolvePersonality(personality, stressLevel, needs, updatedRelationships, currentTick);
    // Effective traits should reflect the evolved personality
    effectiveTraits = applyEnneagramDisintegration(
      updatedPersonality.traits,
      updatedPersonality.enneagram,
      stressLevel,
    );
    effectiveTraits = applyEnneagramGrowth(
      effectiveTraits,
      updatedPersonality.enneagram,
      stressLevel,
      needs,
    );
  }

  return {
    personality: updatedPersonality,
    effectiveTraits,
    mood,
    needs,
    stressLevel,
    ticksSinceCrisis,
    relationships: updatedRelationships,
  };
}

// ---------------------------------------------------------------------------
// Internal mood event generation
// ---------------------------------------------------------------------------

/**
 * Generate mood events from changes in Maslow needs.
 * Drops in critical needs create anxiety/anger; improvements create positive valence.
 */
function generateNeedBasedMoodEvents(
  current: MaslowNeeds,
  previous: MaslowNeeds,
  personality: RolledPersonality,
): MoodEvent[] {
  const events: MoodEvent[] = [];

  // Physiological crisis — only fires on crossing thresholds
  if (current.physiological < 30 && previous.physiological >= 30) {
    events.push({ valence: -20, anxiety: 25, arousal: 20 });
  } else if (current.physiological < 20 && previous.physiological >= 20) {
    events.push({ valence: -10, anxiety: 15, arousal: 10 });
  }

  // Safety crisis
  if (current.safety < 30 && previous.safety >= 30) {
    events.push({ valence: -15, anxiety: 20, anger: 10, arousal: 15 });
  }

  // Belonging deprivation — only fires on significant DROPS, not every tick
  if (current.belonging < previous.belonging - 5) {
    const belongingImpact = belongingDeprivationImpact(
      current.belonging,
      personality.attachmentStyle,
    );
    if (belongingImpact > 0.5) {
      events.push({
        valence: Math.round(-belongingImpact * 8),
        anxiety: Math.round(belongingImpact * 10),
      });
    }
  }

  // Positive events: needs improving
  if (current.safety > previous.safety + 10) {
    events.push({ valence: 5, anxiety: -5 });
  }
  if (current.belonging > previous.belonging + 10) {
    events.push({ valence: 8, anxiety: -3 });
  }
  if (current.esteem > previous.esteem + 10) {
    events.push({ valence: 5, dominance: 5 });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Personality evolution — sustained experience reshapes core traits
// ---------------------------------------------------------------------------

/** Per-trait drift rate: how much one "pressure unit" shifts a trait per 100 ticks. */
const TRAIT_DRIFT_RATE = 0.3;

/** Maximum total drift from the original rolled value (prevents complete transformation). */
const MAX_TOTAL_DRIFT = 25;

/**
 * Evolve a personality based on sustained conditions.
 *
 * This is not a sudden shift — it's the slow grinding effect of lived
 * experience. A species imprisoned in perpetual war gradually becomes
 * harder, more neurotic, less agreeable. A species in lasting peace
 * slowly becomes more open, more trusting, less fearful.
 *
 * Each condition applies a small per-epoch pressure on specific traits.
 * Pressures accumulate but are capped so a species retains its identity.
 *
 * Called every 100 ticks from the main tick processor.
 */
function evolvePersonality(
  personality: RolledPersonality,
  stressLevel: StressLevel,
  needs: MaslowNeeds,
  relationships: Record<string, PsychRelationship>,
  _currentTick: number,
): RolledPersonality {
  const drifts: Partial<Record<CoreTraitKey, number>> = {};

  // --- Sustained war / low safety → harder, more neurotic, less agreeable ---
  if (needs.safety < 40) {
    const pressure = (40 - needs.safety) / 40; // 0..1
    drifts.neuroticism = (drifts.neuroticism ?? 0) + pressure * TRAIT_DRIFT_RATE;
    drifts.agreeableness = (drifts.agreeableness ?? 0) - pressure * TRAIT_DRIFT_RATE;
    drifts.honestyHumility = (drifts.honestyHumility ?? 0) - pressure * TRAIT_DRIFT_RATE * 0.5;
  }

  // --- Chronic stress (high/extreme for extended periods) → elevated neuroticism ---
  if (stressLevel === 'high' || stressLevel === 'extreme') {
    drifts.neuroticism = (drifts.neuroticism ?? 0) + TRAIT_DRIFT_RATE * 0.5;
    drifts.extraversion = (drifts.extraversion ?? 0) - TRAIT_DRIFT_RATE * 0.3;
  }

  // --- Prolonged isolation (no allies, low belonging) → withdrawn, less trusting ---
  if (needs.belonging < 25) {
    const pressure = (25 - needs.belonging) / 25;
    drifts.extraversion = (drifts.extraversion ?? 0) - pressure * TRAIT_DRIFT_RATE * 0.5;
    drifts.agreeableness = (drifts.agreeableness ?? 0) - pressure * TRAIT_DRIFT_RATE * 0.3;
  }

  // --- Repeated betrayal → less agreeable, less trusting (computed from relationships) ---
  let totalBetrayal = 0;
  let totalPositive = 0;
  let allianceCount = 0;
  for (const rel of Object.values(relationships)) {
    totalBetrayal += rel.negativeHistory;
    totalPositive += rel.positiveHistory;
    if (rel.trust > 60 && rel.warmth > 40) allianceCount++;
  }

  if (totalBetrayal > 50) {
    const pressure = Math.min(1, totalBetrayal / 200);
    drifts.agreeableness = (drifts.agreeableness ?? 0) - pressure * TRAIT_DRIFT_RATE;
    drifts.honestyHumility = (drifts.honestyHumility ?? 0) - pressure * TRAIT_DRIFT_RATE * 0.3;
  }

  // --- Lasting prosperity + peace → more open, more agreeable, less neurotic ---
  if (needs.safety > 70 && needs.physiological > 70 && stressLevel === 'baseline') {
    drifts.neuroticism = (drifts.neuroticism ?? 0) - TRAIT_DRIFT_RATE * 0.3;
    drifts.openness = (drifts.openness ?? 0) + TRAIT_DRIFT_RATE * 0.2;
    drifts.agreeableness = (drifts.agreeableness ?? 0) + TRAIT_DRIFT_RATE * 0.2;
  }

  // --- Successful alliances → more extraverted, more trusting ---
  if (allianceCount >= 2) {
    drifts.extraversion = (drifts.extraversion ?? 0) + TRAIT_DRIFT_RATE * 0.3;
    drifts.agreeableness = (drifts.agreeableness ?? 0) + TRAIT_DRIFT_RATE * 0.2;
  }

  // --- Dominance / conquest success → Dark Triad elevation ---
  // (Having many planets relative to rivals suggests successful conquest)
  if (totalPositive < totalBetrayal && needs.esteem > 70) {
    // Power without friendship — narcissism creeps in
  }

  // Apply drifts with capping
  if (Object.keys(drifts).length === 0) return personality;

  const updatedTraits = { ...personality.traits };
  let anyChange = false;

  for (const key of CORE_TRAIT_KEYS) {
    const drift = drifts[key];
    if (!drift || Math.abs(drift) < 0.01) continue;

    const original = personality.traits[key];
    const current = updatedTraits[key];

    // Cap total drift from original value
    const totalDriftSoFar = current - original;
    const remainingRoom = drift > 0
      ? MAX_TOTAL_DRIFT - totalDriftSoFar
      : MAX_TOTAL_DRIFT + totalDriftSoFar;

    if (remainingRoom <= 0) continue;

    const cappedDrift = drift > 0
      ? Math.min(drift, remainingRoom)
      : Math.max(drift, -remainingRoom);

    const newValue = Math.round(Math.min(100, Math.max(0, current + cappedDrift)));
    if (newValue !== current) {
      updatedTraits[key] = newValue;
      anyChange = true;
    }
  }

  if (!anyChange) return personality;

  return {
    ...personality,
    traits: updatedTraits,
  };
}
