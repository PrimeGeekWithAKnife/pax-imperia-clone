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

  return {
    personality,
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
