/**
 * First contact resolution engine — pure functions for determining what happens
 * when two species meet for the first time.
 *
 * Without Xenolinguistics on at least one side, outcomes are unpredictable.
 * Species personality traits (openness, bravery) modify the base probabilities.
 *
 * All functions are side-effect free and deterministic given the same random seed.
 */

import type {
  FirstContactApproach,
  FirstContactReaction,
  FirstContactOutcome,
} from '../types/first-contact.js';
import type { CommunicationLevel } from '../types/species.js';
import type { EthicalAuditTrail, EthicalDecision } from '../types/ethical-audit.js';
import { ATTITUDE_MIN, ATTITUDE_MAX } from '../constants/game.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Weighted random selection from a probability table.
 * Probabilities should sum to 1.0 (or close to it — they are normalised).
 */
function weightedRandom<T extends string>(
  table: Array<{ value: T; weight: number }>,
  roll?: number,
): T {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  const r = (roll ?? Math.random()) * totalWeight;

  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.weight;
    if (r <= cumulative) {
      return entry.value;
    }
  }

  // Fallback: return last entry (handles floating-point rounding)
  return table[table.length - 1].value;
}

// ---------------------------------------------------------------------------
// First contact resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the target species' reaction to a first contact approach.
 *
 * Probability tables vary based on:
 * - The chosen approach
 * - Whether either side has xenolinguistics
 * - The target's openness and bravery personality traits (1-10)
 *
 * @param approach - How the initiator approaches
 * @param _initiatorSpeciesId - Species ID of the initiator (reserved for future species-specific modifiers)
 * @param _targetSpeciesId - Species ID of the target (reserved for future species-specific modifiers)
 * @param initiatorHasXenolinguistics - Whether the initiator has researched xenolinguistics
 * @param targetHasXenolinguistics - Whether the target has researched xenolinguistics
 * @param targetPersonalityOpenness - Target's openness trait (1-10), where 10 is endlessly curious
 * @param targetPersonalityBravery - Target's bravery trait (1-10), where 10 is recklessly brave
 * @param roll - Optional fixed random value [0, 1) for deterministic testing
 */
export function resolveFirstContact(
  approach: FirstContactApproach,
  _initiatorSpeciesId: string,
  _targetSpeciesId: string,
  initiatorHasXenolinguistics: boolean,
  targetHasXenolinguistics: boolean,
  targetPersonalityOpenness: number,
  targetPersonalityBravery: number,
  roll?: number,
): FirstContactReaction {
  const hasLanguage = initiatorHasXenolinguistics || targetHasXenolinguistics;

  // Normalised personality modifiers: 5 is neutral, <5 shifts negative, >5 shifts positive
  const opennessModifier = (targetPersonalityOpenness - 5) / 10; // -0.4 to +0.5
  const braveryModifier = (targetPersonalityBravery - 5) / 10;   // -0.4 to +0.5

  switch (approach) {
    case 'send_greeting':
      return resolveGreeting(hasLanguage, opennessModifier, braveryModifier, roll);

    case 'observe_silently':
      return resolveObservation(opennessModifier, braveryModifier, roll);

    case 'display_strength':
      return resolveStrengthDisplay(braveryModifier, opennessModifier, roll);

    case 'open_fire':
      return 'hostile_response';

    case 'flee':
      return resolveFlee(braveryModifier, opennessModifier, roll);

    case 'broadcast_language':
      return resolveBroadcastLanguage(opennessModifier, braveryModifier, roll);
  }
}

/**
 * Resolve reaction to a greeting attempt.
 */
function resolveGreeting(
  hasLanguage: boolean,
  opennessModifier: number,
  braveryModifier: number,
  roll?: number,
): FirstContactReaction {
  if (hasLanguage) {
    // With xenolinguistics, outcomes are much more predictable
    const table: Array<{ value: FirstContactReaction; weight: number }> = [
      { value: 'friendly_response', weight: Math.max(0.05, 0.50 + opennessModifier * 0.3) },
      { value: 'cautious_interest', weight: Math.max(0.05, 0.30 - opennessModifier * 0.1) },
      { value: 'confusion', weight: Math.max(0.02, 0.10 - opennessModifier * 0.1) },
      { value: 'hostile_response', weight: Math.max(0.02, 0.10 - opennessModifier * 0.2 - braveryModifier * 0.1) },
    ];
    return weightedRandom(table, roll);
  }

  // Without xenolinguistics — anything can happen
  const table: Array<{ value: FirstContactReaction; weight: number }> = [
    { value: 'confusion', weight: Math.max(0.05, 0.30 - opennessModifier * 0.1) },
    { value: 'cautious_interest', weight: Math.max(0.05, 0.20 + opennessModifier * 0.15) },
    { value: 'fear_and_retreat', weight: Math.max(0.05, 0.20 - braveryModifier * 0.15) },
    { value: 'hostile_response', weight: Math.max(0.02, 0.15 - opennessModifier * 0.1) },
    { value: 'friendly_response', weight: Math.max(0.02, 0.10 + opennessModifier * 0.15) },
    { value: 'total_misunderstanding', weight: Math.max(0.02, 0.05 + (1 - opennessModifier) * 0.05) },
  ];
  return weightedRandom(table, roll);
}

/**
 * Resolve reaction to silent observation.
 */
function resolveObservation(
  opennessModifier: number,
  braveryModifier: number,
  roll?: number,
): FirstContactReaction {
  // 50% they don't notice (treated as confusion — nothing happens)
  // 30% cautious interest (they detect but are curious)
  // 20% reactive based on personality
  const table: Array<{ value: FirstContactReaction; weight: number }> = [
    { value: 'confusion', weight: Math.max(0.1, 0.50 - opennessModifier * 0.1) },
    { value: 'cautious_interest', weight: Math.max(0.05, 0.30 + opennessModifier * 0.1) },
    { value: 'fear_and_retreat', weight: Math.max(0.02, 0.10 - braveryModifier * 0.1) },
    { value: 'hostile_response', weight: Math.max(0.02, 0.10 + braveryModifier * 0.1 - opennessModifier * 0.05) },
  ];
  return weightedRandom(table, roll);
}

/**
 * Resolve reaction to a military strength display.
 * Brave species tend to respond with hostility; cowardly species flee.
 */
function resolveStrengthDisplay(
  braveryModifier: number,
  opennessModifier: number,
  roll?: number,
): FirstContactReaction {
  const table: Array<{ value: FirstContactReaction; weight: number }> = [
    { value: 'hostile_response', weight: Math.max(0.05, 0.35 + braveryModifier * 0.3) },
    { value: 'fear_and_retreat', weight: Math.max(0.05, 0.30 - braveryModifier * 0.25) },
    { value: 'cautious_interest', weight: Math.max(0.05, 0.15 + opennessModifier * 0.1) },
    { value: 'confusion', weight: Math.max(0.02, 0.10 - opennessModifier * 0.05) },
    { value: 'religious_awe', weight: Math.max(0.01, 0.05 - braveryModifier * 0.05) },
    { value: 'total_misunderstanding', weight: 0.05 },
  ];
  return weightedRandom(table, roll);
}

/**
 * Resolve reaction when the initiator flees.
 */
function resolveFlee(
  braveryModifier: number,
  opennessModifier: number,
  roll?: number,
): FirstContactReaction {
  const table: Array<{ value: FirstContactReaction; weight: number }> = [
    { value: 'confusion', weight: Math.max(0.1, 0.40 - opennessModifier * 0.1) },
    { value: 'cautious_interest', weight: Math.max(0.05, 0.30 + opennessModifier * 0.15) },
    { value: 'hostile_response', weight: Math.max(0.02, 0.10 + braveryModifier * 0.15) },
    { value: 'fear_and_retreat', weight: Math.max(0.05, 0.20 - braveryModifier * 0.1) },
  ];
  return weightedRandom(table, roll);
}

/**
 * Resolve reaction to broadcasting linguistic data.
 * This is the most diplomatically effective approach, but requires
 * the initiator to have xenolinguistics research.
 */
function resolveBroadcastLanguage(
  opennessModifier: number,
  braveryModifier: number,
  roll?: number,
): FirstContactReaction {
  const table: Array<{ value: FirstContactReaction; weight: number }> = [
    { value: 'friendly_response', weight: Math.max(0.1, 0.55 + opennessModifier * 0.3) },
    { value: 'cautious_interest', weight: Math.max(0.05, 0.25 - opennessModifier * 0.1) },
    { value: 'confusion', weight: Math.max(0.02, 0.10 - opennessModifier * 0.1) },
    { value: 'hostile_response', weight: Math.max(0.01, 0.05 - opennessModifier * 0.1 - braveryModifier * 0.05) },
    { value: 'religious_awe', weight: Math.max(0.01, 0.05 - braveryModifier * 0.05) },
  ];
  return weightedRandom(table, roll);
}

// ---------------------------------------------------------------------------
// First contact outcome resolution
// ---------------------------------------------------------------------------

/**
 * Convert a first contact reaction and approach into a concrete diplomatic outcome.
 *
 * @param approach - The approach the initiator chose
 * @param reaction - The reaction from the target species
 * @param initiatorHasXenolinguistics - Whether the initiator has xenolinguistics
 * @param targetHasXenolinguistics - Whether the target has xenolinguistics
 */
export function resolveFirstContactOutcome(
  approach: FirstContactApproach,
  reaction: FirstContactReaction,
  initiatorHasXenolinguistics: boolean,
  targetHasXenolinguistics: boolean,
): FirstContactOutcome {
  const hasLanguage = initiatorHasXenolinguistics || targetHasXenolinguistics;
  const bothHaveLanguage = initiatorHasXenolinguistics && targetHasXenolinguistics;

  // Determine communication level based on xenolinguistics state
  let communicationLevel: CommunicationLevel = 'none';
  if (bothHaveLanguage) {
    communicationLevel = 'scientific';
  } else if (hasLanguage) {
    communicationLevel = 'basic';
  }

  // Base outcome derived from the reaction
  switch (reaction) {
    case 'friendly_response':
      return {
        relationshipEstablished: true,
        initialAttitude: clamp(30 + (hasLanguage ? 10 : 0), ATTITUDE_MIN, ATTITUDE_MAX),
        warDeclared: false,
        tradeOpened: communicationLevel !== 'none',
        communicationLevel: communicationLevel === 'none' ? 'basic' : communicationLevel,
      };

    case 'cautious_interest':
      return {
        relationshipEstablished: true,
        initialAttitude: clamp(5 + (hasLanguage ? 5 : 0), ATTITUDE_MIN, ATTITUDE_MAX),
        warDeclared: false,
        tradeOpened: false,
        communicationLevel,
      };

    case 'confusion':
      return {
        relationshipEstablished: approach !== 'observe_silently',
        initialAttitude: 0,
        warDeclared: false,
        tradeOpened: false,
        communicationLevel: approach === 'observe_silently' ? 'none' : communicationLevel,
      };

    case 'fear_and_retreat':
      return {
        relationshipEstablished: true,
        initialAttitude: clamp(-10, ATTITUDE_MIN, ATTITUDE_MAX),
        warDeclared: false,
        tradeOpened: false,
        communicationLevel: 'none',
      };

    case 'hostile_response':
      return {
        relationshipEstablished: true,
        initialAttitude: clamp(-50, ATTITUDE_MIN, ATTITUDE_MAX),
        warDeclared: true,
        tradeOpened: false,
        communicationLevel: 'none',
      };

    case 'total_misunderstanding':
      return {
        relationshipEstablished: true,
        initialAttitude: clamp(-30, ATTITUDE_MIN, ATTITUDE_MAX),
        warDeclared: approach === 'display_strength',
        tradeOpened: false,
        communicationLevel: 'none',
      };

    case 'religious_awe':
      return {
        relationshipEstablished: true,
        initialAttitude: clamp(40, ATTITUDE_MIN, ATTITUDE_MAX),
        warDeclared: false,
        tradeOpened: true,
        communicationLevel: communicationLevel === 'none' ? 'basic' : communicationLevel,
      };

    case 'assimilation_offer':
      return {
        relationshipEstablished: true,
        initialAttitude: clamp(20, ATTITUDE_MIN, ATTITUDE_MAX),
        warDeclared: false,
        tradeOpened: true,
        communicationLevel: communicationLevel === 'none' ? 'basic' : communicationLevel,
      };
  }
}

// ---------------------------------------------------------------------------
// Ethical audit trail
// ---------------------------------------------------------------------------

/**
 * Create a fresh ethical audit trail with all dimensions at neutral (0).
 */
export function createAuditTrail(): EthicalAuditTrail {
  return {
    mercy: 0,
    honesty: 0,
    justice: 0,
    diplomacy: 0,
    ecology: 0,
    decisions: [],
  };
}

/**
 * Record an ethical decision on the audit trail, returning a new copy.
 *
 * The score for the relevant dimension is adjusted by `decision.scoreChange`
 * and clamped to [-100, +100]. The decision is appended to the log with its tick.
 */
export function recordDecision(
  trail: EthicalAuditTrail,
  decision: Omit<EthicalDecision, 'tick'>,
  tick: number,
): EthicalAuditTrail {
  const fullDecision: EthicalDecision = { ...decision, tick };
  const updated: EthicalAuditTrail = {
    mercy: trail.mercy,
    honesty: trail.honesty,
    justice: trail.justice,
    diplomacy: trail.diplomacy,
    ecology: trail.ecology,
    decisions: [...trail.decisions, fullDecision],
  };

  // Apply the score change to the relevant dimension
  updated[decision.category] = clamp(
    updated[decision.category] + decision.scoreChange,
    -100,
    100,
  );

  return updated;
}
