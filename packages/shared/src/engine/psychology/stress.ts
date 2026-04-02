/**
 * Stress Escalation Engine
 *
 * Five-level stress model that drives Enneagram disintegration and
 * attachment-style coping patterns.
 *
 * Levels:
 *  1. Baseline — no threats, personality operates normally
 *  2. Moderate — border tension, resource pressure, coping strategies
 *  3. High — active war, starvation, personality shifts toward lower functioning
 *  4. Extreme — homeworld threatened, multiple wars, fight/flight/freeze/fawn
 *  5. Recovery — after crisis resolves, rebuild, post-traumatic growth possible
 *
 * Enneagram disintegration: at level 3+, species shift toward their stress type.
 * This creates dramatic, visible personality shifts under pressure.
 */

import type {
  StressLevel,
  MaslowNeeds,
  AttachmentStyle,
  EnneagramProfile,
  CoreTraits,
  RolledPersonality,
} from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Stress level computation
// ---------------------------------------------------------------------------

/**
 * State needed to compute stress level for an empire.
 */
export interface StressInput {
  /** Current Maslow needs. */
  needs: MaslowNeeds;
  /** Number of active wars. */
  activeWars: number;
  /** Is the homeworld directly threatened? */
  homeworldThreatened: boolean;
  /** Previous stress level (for hysteresis and recovery detection). */
  previousStress: StressLevel;
  /** Ticks since last crisis ended (for recovery tracking). */
  ticksSinceCrisis: number;
}

/**
 * Compute the current stress level from empire conditions.
 * Uses threshold-based escalation with hysteresis to prevent rapid oscillation.
 */
export function computeStressLevel(input: StressInput): StressLevel {
  const { needs, activeWars, homeworldThreatened, previousStress, ticksSinceCrisis } = input;

  // Check for extreme stress first
  if (homeworldThreatened || (activeWars >= 2 && needs.safety < 20)) {
    return 'extreme';
  }

  // High stress: active war + resource pressure
  if (activeWars >= 1 && (needs.physiological < 40 || needs.safety < 40)) {
    return 'high';
  }

  // High stress: severe resource crisis even without war
  if (needs.physiological < 20) {
    return 'high';
  }

  // Moderate stress: border tension, resource pressure, or low safety
  if (needs.safety < 50 || needs.physiological < 50 || activeWars >= 1) {
    return 'moderate';
  }

  // Recovery: previously stressed, now conditions improved
  if (previousStress === 'extreme' || previousStress === 'high') {
    if (ticksSinceCrisis < 100) {
      return 'recovery';
    }
  }
  if (previousStress === 'recovery' && ticksSinceCrisis < 100) {
    return 'recovery';
  }

  return 'baseline';
}

// ---------------------------------------------------------------------------
// Enneagram disintegration
// ---------------------------------------------------------------------------

/**
 * At stress level 3+ (high/extreme), the species shifts toward their
 * Enneagram stress direction. This creates observable personality changes:
 *
 * Type 1 → 4 (rigid → moody/withdrawn)
 * Type 2 → 8 (helpful → aggressive/controlling)
 * Type 3 → 9 (achieving → apathetic/disengaged)
 * Type 4 → 2 (individualistic → clingy/needy)
 * Type 5 → 7 (investigative → scattered/impulsive)
 * Type 6 → 3 (loyal → arrogant/image-conscious)
 * Type 7 → 1 (enthusiastic → rigid/critical)
 * Type 8 → 5 (confrontational → withdrawn/secretive)
 * Type 9 → 6 (peaceful → anxious/paranoid)
 *
 * Returns modified core traits reflecting the disintegration shift.
 * The shift is proportional to stress severity.
 */
export function applyEnneagramDisintegration(
  traits: CoreTraits,
  enneagram: EnneagramProfile,
  stressLevel: StressLevel,
): CoreTraits {
  if (stressLevel !== 'high' && stressLevel !== 'extreme') {
    return traits;
  }

  // How much to shift (0-1 scale)
  const intensity = stressLevel === 'extreme' ? 0.3 : 0.15;

  const shifted = { ...traits };
  const dir = enneagram.stressDirection;

  // Apply type-specific disintegration effects
  const effects = DISINTEGRATION_EFFECTS[dir];
  if (effects) {
    for (const [trait, delta] of Object.entries(effects)) {
      const key = trait as keyof CoreTraits;
      shifted[key] = Math.round(
        Math.min(100, Math.max(0, shifted[key] + delta * intensity * 100)),
      );
    }
  }

  return shifted;
}

/**
 * Enneagram growth integration — when thriving (baseline + good conditions),
 * species can shift toward their growth type. Returns modified traits.
 */
export function applyEnneagramGrowth(
  traits: CoreTraits,
  enneagram: EnneagramProfile,
  stressLevel: StressLevel,
  needs: MaslowNeeds,
): CoreTraits {
  // Growth only happens at baseline with good need satisfaction
  if (stressLevel !== 'baseline') return traits;
  if (needs.selfActualisation < 60 || needs.esteem < 50) return traits;

  const intensity = 0.05; // Growth is slow and subtle
  const shifted = { ...traits };
  const dir = enneagram.growthDirection;

  const effects = GROWTH_EFFECTS[dir];
  if (effects) {
    for (const [trait, delta] of Object.entries(effects)) {
      const key = trait as keyof CoreTraits;
      shifted[key] = Math.round(
        Math.min(100, Math.max(0, shifted[key] + delta * intensity * 100)),
      );
    }
  }

  return shifted;
}

// ---------------------------------------------------------------------------
// Attachment-style coping responses
// ---------------------------------------------------------------------------

/** Coping strategy type for stress-responsive AI behaviour. */
export type CopingStrategy =
  | 'problem_focused'     // High C/O: address the problem directly
  | 'social_support'      // High E/A: seek allies and help
  | 'emotional_coping'    // High N: ruminate, panic, emotional processing
  | 'withdrawal'          // Avoidant: retreat, minimise contact
  | 'fight_response'      // Low A, high assertiveness: lash out
  | 'freeze_response'     // Overwhelmed: do nothing, paralysis
  | 'fawn_response';      // Anxious under extreme stress: appease at any cost

/**
 * Determine primary coping strategy based on attachment style and stress level.
 * AI behaviour engine uses this to modify decision-making under stress.
 */
export function determineCopingStrategy(
  attachmentStyle: AttachmentStyle,
  stressLevel: StressLevel,
  traits: CoreTraits,
): CopingStrategy {
  // Extreme stress overrides personality-based coping
  if (stressLevel === 'extreme') {
    switch (attachmentStyle) {
      case 'anxious':          return 'fawn_response';
      case 'avoidant':         return 'withdrawal';
      case 'fearful_avoidant': return traits.neuroticism > 50 ? 'freeze_response' : 'fight_response';
      case 'secure':           return traits.agreeableness > 50 ? 'social_support' : 'problem_focused';
    }
  }

  // High stress: attachment style shapes coping
  if (stressLevel === 'high') {
    switch (attachmentStyle) {
      case 'anxious':          return 'emotional_coping';
      case 'avoidant':         return 'withdrawal';
      case 'fearful_avoidant': return 'emotional_coping';
      case 'secure':           return 'problem_focused';
    }
  }

  // Moderate: personality traits determine coping
  if (traits.conscientiousness > 60 && traits.openness > 50) return 'problem_focused';
  if (traits.extraversion > 60 && traits.agreeableness > 50) return 'social_support';
  if (traits.neuroticism > 60) return 'emotional_coping';

  return 'problem_focused';
}

// ---------------------------------------------------------------------------
// Disintegration / growth effect tables
// ---------------------------------------------------------------------------

/**
 * Trait effects when disintegrating TOWARD each type.
 * Values are normalised deltas (-1 to +1) applied with intensity scaling.
 */
const DISINTEGRATION_EFFECTS: Record<number, Partial<Record<keyof CoreTraits, number>>> = {
  1: { conscientiousness: 0.3, openness: -0.3, agreeableness: -0.2 }, // → rigid, critical
  2: { extraversion: 0.3, agreeableness: 0.2, neuroticism: 0.2 },     // → clingy, needy
  3: { extraversion: 0.2, honestyHumility: -0.3, neuroticism: -0.1 },  // → arrogant, image-focused
  4: { neuroticism: 0.4, extraversion: -0.2, openness: 0.1 },          // → moody, withdrawn
  5: { extraversion: -0.4, openness: -0.1, agreeableness: -0.2 },      // → withdrawn, secretive
  6: { neuroticism: 0.3, agreeableness: -0.2, extraversion: -0.1 },    // → anxious, paranoid
  7: { conscientiousness: -0.3, extraversion: 0.2, neuroticism: 0.1 }, // → scattered, impulsive
  8: { agreeableness: -0.3, extraversion: 0.2, neuroticism: -0.1 },    // → aggressive, controlling
  9: { conscientiousness: -0.2, extraversion: -0.2, agreeableness: 0.1 }, // → apathetic, disengaged
};

/**
 * Trait effects when growing TOWARD each type.
 * Values are normalised deltas applied with (smaller) intensity scaling.
 */
const GROWTH_EFFECTS: Record<number, Partial<Record<keyof CoreTraits, number>>> = {
  1: { conscientiousness: 0.2, honestyHumility: 0.2 },                 // → principled, disciplined
  2: { agreeableness: 0.3, extraversion: 0.1 },                        // → caring, generous
  3: { conscientiousness: 0.2, extraversion: 0.1 },                    // → effective, confident
  4: { openness: 0.3, neuroticism: -0.1 },                             // → creative, authentic
  5: { openness: 0.2, conscientiousness: 0.1 },                        // → insightful, perceptive
  6: { agreeableness: 0.2, neuroticism: -0.2 },                        // → trusting, courageous
  7: { extraversion: 0.1, openness: 0.2, agreeableness: 0.1 },        // → joyful, satisfied
  8: { agreeableness: -0.1, extraversion: 0.1, conscientiousness: 0.2 }, // → decisive, protective
  9: { agreeableness: 0.2, conscientiousness: -0.1, neuroticism: -0.2 }, // → peaceful, accepting
};
