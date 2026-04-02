/**
 * Probabilistic Diplomacy Evaluation Engine
 *
 * Replaces threshold-gated treaty evaluation with sigmoid-based probability.
 * Every diplomatic decision includes a random component weighted by personality,
 * creating variation without feeling random.
 *
 * P(accept) = sigmoid(
 *   relationship.warmth * 0.3 +
 *   relationship.trust * 0.3 +
 *   need_alignment * 0.2 +
 *   personality_modifier * 0.1 +
 *   mood.valence * 0.1 +
 *   noise(attachment_volatility)
 * )
 */

import type { PsychRelationship, RelationshipEventType } from '../../types/diplomacy-v2.js';
import type {
  RolledPersonality,
  MoodState,
  MaslowNeeds,
  AttachmentStyle,
} from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Sigmoid
// ---------------------------------------------------------------------------

/**
 * Sigmoid function mapping any real number to (0, 1).
 * Steepness controls how sharp the transition is around x=0.
 */
export function sigmoid(x: number, steepness: number = 0.05): number {
  return 1 / (1 + Math.exp(-steepness * x));
}

// ---------------------------------------------------------------------------
// Treaty acceptance probability
// ---------------------------------------------------------------------------

/** Treaty types that can be evaluated. */
export type EvaluableTreatyType =
  | 'non_aggression'
  | 'trade'
  | 'research_sharing'
  | 'mutual_defence'
  | 'alliance';

/**
 * Context for evaluating a diplomatic proposal.
 */
export interface ProposalContext {
  /** The relationship with the proposing empire. */
  relationship: PsychRelationship;
  /** Our current personality (rolled for this game). */
  personality: RolledPersonality;
  /** Our current mood. */
  mood: MoodState;
  /** Our current Maslow needs. */
  needs: MaslowNeeds;
  /** What type of treaty is being proposed. */
  treatyType: EvaluableTreatyType;
  /** How much this treaty aligns with our needs (computed externally). -100 to +100. */
  needAlignment: number;
}

/**
 * Compute the probability of accepting a diplomatic proposal.
 * Returns 0-1 probability, NOT a yes/no answer. The caller rolls against it.
 *
 * A species with warmth 80, trust 70, and good need alignment has ~90% chance.
 * A species with warmth 20, trust 30, and poor alignment has ~15% chance.
 * Even a hostile species might accept on a lucky day.
 */
export function computeAcceptanceProbability(ctx: ProposalContext): number {
  const { relationship, personality, mood, needs, treatyType, needAlignment } = ctx;

  // Base score from relationship dimensions
  const relationshipScore =
    relationship.warmth * 0.30 +
    relationship.trust * 0.30 +
    relationship.respect * 0.10;

  // Need alignment contribution
  const needScore = needAlignment * 0.20;

  // Personality modifier — high agreeableness and extraversion increase acceptance
  const personalityScore =
    (personality.traits.agreeableness - 50) * 0.15 +
    (personality.traits.extraversion - 50) * 0.05 +
    (personality.traits.honestyHumility - 50) * 0.05;

  // Mood contribution — positive mood increases acceptance
  const moodScore = mood.valence * 0.10;

  // Treaty-type difficulty scaling
  const difficultyPenalty = TREATY_DIFFICULTY[treatyType] ?? 0;

  // Attachment noise — fearful-avoidant is more unpredictable
  const noiseScale = ATTACHMENT_NOISE[personality.attachmentStyle];

  // Combine all factors
  const rawScore = relationshipScore + needScore + personalityScore + moodScore - difficultyPenalty;

  // Apply sigmoid to convert raw score to probability
  return sigmoid(rawScore, 0.04 + noiseScale * 0.02);
}

/**
 * Roll a probabilistic decision. Returns true with the given probability.
 */
export function probabilisticDecision(probability: number, rng: () => number = Math.random): boolean {
  return rng() < probability;
}

/**
 * Evaluate and decide on a treaty proposal. Returns acceptance decision and probability.
 */
export function evaluateProposal(
  ctx: ProposalContext,
  rng: () => number = Math.random,
): { accepted: boolean; probability: number } {
  const probability = computeAcceptanceProbability(ctx);
  return {
    accepted: probabilisticDecision(probability, rng),
    probability,
  };
}

// ---------------------------------------------------------------------------
// Need alignment scoring
// ---------------------------------------------------------------------------

/**
 * Compute how well a treaty type aligns with an empire's current needs.
 * Returns -100 to +100 where positive = aligned, negative = misaligned.
 */
export function computeNeedAlignment(
  treatyType: EvaluableTreatyType,
  needs: MaslowNeeds,
  personality: RolledPersonality,
): number {
  let score = 0;

  switch (treatyType) {
    case 'trade':
      // Trade helps physiological and esteem
      score += (100 - needs.physiological) * 0.3;
      score += (100 - needs.esteem) * 0.2;
      break;

    case 'non_aggression':
      // Safety need alignment
      score += (100 - needs.safety) * 0.5;
      break;

    case 'research_sharing':
      // Self-actualisation and esteem
      score += (100 - needs.selfActualisation) * 0.3;
      score += (100 - needs.esteem) * 0.2;
      // High-O personalities value this more
      score += (personality.traits.openness - 50) * 0.3;
      break;

    case 'mutual_defence':
      // Safety and belonging
      score += (100 - needs.safety) * 0.4;
      score += (100 - needs.belonging) * 0.3;
      break;

    case 'alliance':
      // Belonging is the primary driver
      score += (100 - needs.belonging) * 0.4;
      score += (100 - needs.safety) * 0.2;
      score += (100 - needs.esteem) * 0.1;
      // Avoidant types resist deep bonds
      if (personality.attachmentStyle === 'avoidant') score -= 20;
      if (personality.attachmentStyle === 'anxious') score += 15;
      break;
  }

  return Math.round(Math.min(100, Math.max(-100, score)));
}

// ---------------------------------------------------------------------------
// Diplomatic action selection
// ---------------------------------------------------------------------------

/** A diplomatic action the AI can take. */
export interface DiplomaticAction {
  type: RelationshipEventType;
  /** Priority score (higher = more likely to be chosen). */
  priority: number;
  /** Target empire ID. */
  targetEmpireId: string;
}

/**
 * Generate diplomatic actions an AI empire should consider based on
 * personality, mood, needs, and relationships.
 *
 * Returns a sorted list of potential actions (highest priority first).
 */
export function generateDiplomaticActions(
  personality: RolledPersonality,
  mood: MoodState,
  needs: MaslowNeeds,
  relationships: Record<string, PsychRelationship>,
): DiplomaticAction[] {
  const actions: DiplomaticAction[] = [];

  for (const [targetId, rel] of Object.entries(relationships)) {
    // Praise — high-E personalities initiate, targets with low respect
    if (personality.traits.extraversion > 40 && rel.respect < 50) {
      actions.push({
        type: 'praise_given',
        priority: (personality.traits.extraversion - 40) * 0.5 + (50 - rel.respect) * 0.3,
        targetEmpireId: targetId,
      });
    }

    // Gift — when we want to improve warmth, driven by belonging need
    if (needs.belonging < 60 && rel.warmth < 40) {
      actions.push({
        type: 'gift_received', // From their perspective
        priority: (60 - needs.belonging) * 0.4 + (40 - rel.warmth) * 0.3,
        targetEmpireId: targetId,
      });
    }

    // Grand gesture — anxious types under belonging deprivation
    if (personality.attachmentStyle === 'anxious' && needs.belonging < 40 && rel.warmth < 20) {
      actions.push({
        type: 'grand_gesture',
        priority: 40 + (40 - needs.belonging) * 0.5,
        targetEmpireId: targetId,
      });
    }

    // Cultural exchange — high-O personalities seeking understanding
    if (personality.traits.openness > 60 && rel.trust < 60) {
      actions.push({
        type: 'cultural_exchange',
        priority: (personality.traits.openness - 60) * 0.4 + (60 - rel.trust) * 0.2,
        targetEmpireId: targetId,
      });
    }

    // Threat — low-A, high dominance mood, when fear in target is low
    if (personality.traits.agreeableness < 35 && mood.dominance > 60 && rel.fear < 20) {
      actions.push({
        type: 'threat',
        priority: (35 - personality.traits.agreeableness) * 0.4 + (mood.dominance - 60) * 0.3,
        targetEmpireId: targetId,
      });
    }

    // Insult — triggered by anger + low respect for target
    if (mood.anger > 40 && rel.respect < 0) {
      actions.push({
        type: 'insult',
        priority: (mood.anger - 40) * 0.3 + Math.abs(rel.respect) * 0.2,
        targetEmpireId: targetId,
      });
    }

    // Diplomatic contact — routine maintenance, driven by attachment style
    const ticksSinceContact = rel.abandonmentAnxiety > 20 ? 999 : 0; // Proxy
    if (personality.attachmentStyle === 'anxious' && rel.abandonmentAnxiety > 10) {
      actions.push({
        type: 'diplomatic_contact',
        priority: rel.abandonmentAnxiety * 0.5,
        targetEmpireId: targetId,
      });
    }

    // Recognition — narcissistic species give recognition to feel important
    if (personality.darkTriad.narcissism > 30 && rel.respect < 60) {
      actions.push({
        type: 'recognition_given',
        priority: (personality.darkTriad.narcissism - 30) * 0.3,
        targetEmpireId: targetId,
      });
    }
  }

  // Sort by priority descending
  actions.sort((a, b) => b.priority - a.priority);
  return actions;
}

// ---------------------------------------------------------------------------
// Proposal frequency by attachment style
// ---------------------------------------------------------------------------

/**
 * How many diplomatic actions per epoch (100 ticks) this personality initiates.
 * Anxious types propose more, avoidant types propose less.
 */
export function proposalFrequency(attachmentStyle: AttachmentStyle, extraversion: number): number {
  const base = Math.max(1, Math.round(extraversion / 20));
  switch (attachmentStyle) {
    case 'anxious':          return base * 3;  // Constant proposals
    case 'secure':           return base * 2;  // Regular but measured
    case 'fearful_avoidant': return base * 2;  // Approach-avoidance means bursts
    case 'avoidant':         return base;      // Minimal contact
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Extra difficulty penalty for more advanced treaty types. */
const TREATY_DIFFICULTY: Record<EvaluableTreatyType, number> = {
  trade: 0,
  non_aggression: 5,
  research_sharing: 10,
  mutual_defence: 20,
  alliance: 35,
};

/** Noise scale per attachment style (affects sigmoid steepness). */
const ATTACHMENT_NOISE: Record<AttachmentStyle, number> = {
  secure: 0,
  anxious: 1,
  avoidant: 0.5,
  fearful_avoidant: 2,
};
