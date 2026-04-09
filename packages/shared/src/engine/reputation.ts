/**
 * Galactic reputation engine.
 *
 * Pure functions for tracking how the galaxy perceives each empire.
 * Reputation influences diplomacy, trade, and first-contact reactions.
 *
 * All functions are side-effect-free and return new state objects.
 */

import type {
  ReputationEvent,
  ReputationEventType,
  ReputationModifiers,
  ReputationState,
} from '../types/reputation.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of events retained in the reputation log. */
const MAX_EVENTS = 100;

/** Per-tick decay multiplier. Half-life ~230 ticks. */
const DECAY_FACTOR = 0.997;

/** Scores with absolute value below this threshold snap to zero. */
const SNAP_THRESHOLD = 0.5;

/** Default reputation deltas for each event type. */
export const REPUTATION_EVENT_VALUES: Record<ReputationEventType, number> = {
  treaty_honoured: 2,
  treaty_broken: -10,
  unjust_war: -15,
  just_war: -3,
  defended_ally: 10,
  peace_brokered: 3,
  council_condemnation: -10,
  council_sanction: -20,
  espionage_exposed: -5,
  aid_provided: 5,
  betrayal: -25,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a fresh reputation state with all empires at 0.
 */
export function initReputationState(empireIds: string[]): ReputationState {
  const scores: Record<string, number> = {};
  for (const id of empireIds) {
    scores[id] = 0;
  }
  return { scores, events: [] };
}

/**
 * Record a reputation event, adjusting the empire's score and appending
 * to the event log (capped at {@link MAX_EVENTS} entries, oldest dropped).
 *
 * Returns a new state — the original is not mutated.
 */
export function recordReputationEvent(
  state: ReputationState,
  event: ReputationEvent,
): ReputationState {
  const prevScore = state.scores[event.empireId] ?? 0;
  const newScore = clamp(prevScore + event.value, -100, 100);

  const newEvents = [...state.events, event];
  if (newEvents.length > MAX_EVENTS) {
    newEvents.splice(0, newEvents.length - MAX_EVENTS);
  }

  return {
    scores: { ...state.scores, [event.empireId]: newScore },
    events: newEvents,
  };
}

/**
 * Apply per-tick decay to all reputation scores, pulling them toward 0.
 *
 * Scores with |value| < {@link SNAP_THRESHOLD} after decay are snapped to 0
 * to avoid lingering near-zero noise.
 */
export function processReputationTick(
  state: ReputationState,
  _tick: number,
): ReputationState {
  const scores: Record<string, number> = {};
  for (const [id, score] of Object.entries(state.scores)) {
    let decayed = score * DECAY_FACTOR;
    if (Math.abs(decayed) < SNAP_THRESHOLD) {
      decayed = 0;
    }
    scores[id] = decayed;
  }
  return { ...state, scores };
}

/**
 * Derive gameplay modifiers from a reputation score.
 *
 * - treatyAcceptanceBonus: score * 0.2  (+100 rep => +20 threshold shift)
 * - tradeMultiplier:       1 + score * 0.002  (+100 => 1.2x, -100 => 0.8x)
 * - firstContactBonus:     round(score * 0.15)  (+100 => +15 attitude)
 */
export function getReputationModifier(score: number): ReputationModifiers {
  return {
    treatyAcceptanceBonus: score * 0.2,
    tradeMultiplier: 1 + score * 0.002,
    firstContactBonus: Math.round(score * 0.15),
  };
}
