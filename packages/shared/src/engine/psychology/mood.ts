/**
 * Mood Engine
 *
 * Multi-dimensional mood state machine driven by attachment style.
 * Mood is NOT a single axis — valence, arousal, dominance, anxiety, and
 * anger are tracked independently and decay at different rates.
 *
 * Attachment style governs:
 *  - Shift rate: how quickly mood responds to events
 *  - Decay rate: how quickly mood returns to baseline
 *  - Trigger threshold: how large an event must be to register
 *  - Pattern: smooth, spiky, glacial, or turbulent
 */

import type { MoodState, AttachmentStyle, StressLevel } from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default (neutral) mood state. */
export const NEUTRAL_MOOD: Readonly<MoodState> = {
  valence: 0,
  arousal: 20,
  dominance: 50,
  anxiety: 20,
  anger: 0,
};

/** Mood dimension keys for iteration. */
type MoodKey = keyof MoodState;
const MOOD_KEYS: readonly MoodKey[] = ['valence', 'arousal', 'dominance', 'anxiety', 'anger'];

/**
 * Attachment-style parameters governing mood dynamics.
 *
 * - shiftMultiplier: how much events affect mood (1.0 = baseline)
 * - decayRate: per-tick decay factor toward baseline (0 = no decay, 1 = instant)
 * - triggerThreshold: minimum event magnitude to register at all
 * - randomJitter: per-tick random mood noise (for fearful-avoidant turbulence)
 */
interface AttachmentMoodParams {
  shiftMultiplier: number;
  decayRate: number;
  triggerThreshold: number;
  randomJitter: number;
}

const ATTACHMENT_MOOD_PARAMS: Record<AttachmentStyle, AttachmentMoodParams> = {
  secure:           { shiftMultiplier: 1.0, decayRate: 0.03,  triggerThreshold: 5,  randomJitter: 0 },
  anxious:          { shiftMultiplier: 2.0, decayRate: 0.01,  triggerThreshold: 2,  randomJitter: 0 },
  avoidant:         { shiftMultiplier: 0.4, decayRate: 0.005, triggerThreshold: 10, randomJitter: 0 },
  fearful_avoidant: { shiftMultiplier: 1.5, decayRate: 0.02,  triggerThreshold: 3,  randomJitter: 3 },
};

// ---------------------------------------------------------------------------
// Mood events
// ---------------------------------------------------------------------------

/**
 * A mood-affecting event. Events are processed each tick to shift mood.
 * Multiple events can fire per tick.
 */
export interface MoodEvent {
  /** Change to valence (-100..+100 input, scaled by attachment). */
  valence?: number;
  /** Change to arousal (0-100 scale). */
  arousal?: number;
  /** Change to dominance (0-100 scale). */
  dominance?: number;
  /** Change to anxiety (0-100 scale). */
  anxiety?: number;
  /** Change to anger (0-100 scale). */
  anger?: number;
}

// ---------------------------------------------------------------------------
// Core mood functions
// ---------------------------------------------------------------------------

/**
 * Apply a mood event to the current mood state, respecting attachment style.
 * Events below the trigger threshold are ignored entirely.
 */
export function applyMoodEvent(
  mood: MoodState,
  event: MoodEvent,
  attachmentStyle: AttachmentStyle,
): MoodState {
  const params = ATTACHMENT_MOOD_PARAMS[attachmentStyle];

  // Check if event magnitude exceeds trigger threshold
  const magnitude = Math.max(
    Math.abs(event.valence ?? 0),
    Math.abs(event.arousal ?? 0),
    Math.abs(event.dominance ?? 0),
    Math.abs(event.anxiety ?? 0),
    Math.abs(event.anger ?? 0),
  );

  if (magnitude < params.triggerThreshold) {
    return mood;
  }

  const result = { ...mood };
  const m = params.shiftMultiplier;

  if (event.valence !== undefined)   result.valence   = clampMood(result.valence + event.valence * m, -100, 100);
  if (event.arousal !== undefined)   result.arousal   = clampMood(result.arousal + event.arousal * m, 0, 100);
  if (event.dominance !== undefined) result.dominance = clampMood(result.dominance + event.dominance * m, 0, 100);
  if (event.anxiety !== undefined)   result.anxiety   = clampMood(result.anxiety + event.anxiety * m, 0, 100);
  if (event.anger !== undefined)     result.anger     = clampMood(result.anger + event.anger * m, 0, 100);

  return result;
}

/**
 * Decay mood toward baseline each tick. Attachment style determines decay rate.
 * Also applies random jitter for fearful-avoidant types.
 *
 * @param mood            Current mood state.
 * @param attachmentStyle Species' attachment style.
 * @param stressLevel     Current stress level — higher stress slows positive decay.
 * @param rng             Random function for jitter.
 */
export function decayMood(
  mood: MoodState,
  attachmentStyle: AttachmentStyle,
  stressLevel: StressLevel = 'baseline',
  rng: () => number = Math.random,
): MoodState {
  const params = ATTACHMENT_MOOD_PARAMS[attachmentStyle];
  const stressMod = stressDecayModifier(stressLevel);

  const result = { ...mood };

  // Decay each dimension toward its baseline
  result.valence   = decayToward(result.valence, NEUTRAL_MOOD.valence, params.decayRate * stressMod);
  result.arousal   = decayToward(result.arousal, NEUTRAL_MOOD.arousal, params.decayRate * stressMod);
  result.dominance = decayToward(result.dominance, NEUTRAL_MOOD.dominance, params.decayRate * 0.5); // Dominance is more stable
  result.anxiety   = decayToward(result.anxiety, NEUTRAL_MOOD.anxiety, params.decayRate * stressMod);
  result.anger     = decayToward(result.anger, NEUTRAL_MOOD.anger, params.decayRate * 0.7); // Anger decays slower than valence

  // Fearful-avoidant turbulence: random jitter
  if (params.randomJitter > 0) {
    result.valence   = clampMood(result.valence + (rng() * 2 - 1) * params.randomJitter, -100, 100);
    result.arousal   = clampMood(result.arousal + (rng() * 2 - 1) * params.randomJitter, 0, 100);
    result.anxiety   = clampMood(result.anxiety + (rng() * 2 - 1) * params.randomJitter, 0, 100);
  }

  return result;
}

/**
 * Process a full mood tick: apply all events, then decay toward baseline.
 * This is the main per-tick entry point for mood updates.
 */
export function processMoodTick(
  mood: MoodState,
  events: MoodEvent[],
  attachmentStyle: AttachmentStyle,
  stressLevel: StressLevel = 'baseline',
  rng: () => number = Math.random,
): MoodState {
  let current = mood;

  // Apply all events
  for (const event of events) {
    current = applyMoodEvent(current, event, attachmentStyle);
  }

  // Decay toward baseline
  current = decayMood(current, attachmentStyle, stressLevel, rng);

  return current;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a mood value to a range. */
function clampMood(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** Decay a value toward a target by a rate (0-1). */
function decayToward(current: number, target: number, rate: number): number {
  const diff = target - current;
  if (Math.abs(diff) < 0.5) return target;
  return Math.round(current + diff * rate);
}

/**
 * Stress level modifier on mood decay.
 * Higher stress slows positive mood recovery (harder to feel better).
 */
function stressDecayModifier(level: StressLevel): number {
  switch (level) {
    case 'baseline': return 1.0;
    case 'moderate': return 0.8;
    case 'high':     return 0.5;
    case 'extreme':  return 0.3;
    case 'recovery': return 1.2;
  }
}
