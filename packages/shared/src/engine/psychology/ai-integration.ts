/**
 * AI Behaviour Integration — Phase 5
 *
 * Wires the psychology system into AI decision-making. When an empire
 * has psychology data, this module provides psychology-driven evaluations.
 * Falls back gracefully when psychology data is absent (backward compat).
 *
 * Key integration points:
 *  - Treaty evaluation: uses probabilistic model instead of threshold gates
 *  - Diplomatic action generation: personality-driven action selection
 *  - War propensity: filtered through mood, stress, and Maslow needs
 *  - Building priorities: driven by Maslow need hierarchy
 */

import type {
  EmpirePsychologicalState,
  RolledPersonality,
  MaslowNeeds,
  MoodState,
} from '../../types/psychology.js';
import type { PsychRelationship } from '../../types/diplomacy-v2.js';
import {
  computeAcceptanceProbability,
  computeNeedAlignment,
  evaluateProposal,
  generateDiplomaticActions,
  proposalFrequency,
} from './evaluation.js';
import type { ProposalContext, EvaluableTreatyType, DiplomaticAction } from './evaluation.js';
import { createRelationship, applyRelationshipEvent, computeOverallSentiment } from './relationship.js';
import type { AffinityMatrix } from '../../types/psychology.js';
import { determineCopingStrategy } from './stress.js';
import { criticalNeedOverride, lowestUnmetNeed } from './maslow.js';
import { getReputationModifier } from '../reputation.js';

// ---------------------------------------------------------------------------
// Treaty evaluation (replaces evaluateTreatyProposal for AI-to-AI)
// ---------------------------------------------------------------------------

/**
 * Evaluate a treaty proposal using psychology-driven probabilistic model.
 * Returns acceptance decision with probability transparency.
 *
 * Falls back to basic acceptance (50% chance) if psychology data is missing.
 */
export function evaluateTreatyWithPsychology(
  targetPsychState: EmpirePsychologicalState,
  proposerEmpireId: string,
  treatyType: string,
  rng: () => number = Math.random,
  proposerReputation?: number,
): { accept: boolean; probability: number; reason: string } {
  const { personality, mood, needs, relationships } = targetPsychState;
  const relationship = relationships[proposerEmpireId];

  if (!relationship) {
    return { accept: false, probability: 0, reason: 'no_relationship' };
  }

  // Check critical need override — survival trumps everything
  const override = criticalNeedOverride(needs);
  if (override === 'physiological' && treatyType === 'trade') {
    return { accept: true, probability: 0.95, reason: 'survival_trade' };
  }
  if (override === 'safety' && (treatyType === 'mutual_defence' || treatyType === 'alliance')) {
    return { accept: true, probability: 0.9, reason: 'survival_defence' };
  }

  // Map treaty type to evaluable type
  const evalType = mapTreatyType(treatyType);
  if (!evalType) {
    return { accept: false, probability: 0, reason: 'unknown_treaty_type' };
  }

  // Compute need alignment
  const needAlignment = computeNeedAlignment(evalType, needs, personality);

  // Build proposal context
  const ctx: ProposalContext = {
    relationship,
    personality,
    mood,
    needs,
    treatyType: evalType,
    needAlignment,
  };

  const { accepted, probability } = evaluateProposal(ctx, rng);

  // Reputation modifier: shift probability by reputation bonus
  let finalProbability = probability;
  let finalAccepted = accepted;
  if (proposerReputation !== undefined) {
    const repMod = getReputationModifier(proposerReputation);
    // Shift probability by reputation bonus (scaled to 0-1 range)
    finalProbability = Math.max(0, Math.min(1, probability + repMod.treatyAcceptanceBonus / 100));
    // Re-evaluate acceptance with adjusted probability
    finalAccepted = rng() < finalProbability;
  }

  return {
    accept: finalAccepted,
    probability: finalProbability,
    reason: finalAccepted ? 'psychology_accept' : 'psychology_reject',
  };
}

// ---------------------------------------------------------------------------
// War propensity
// ---------------------------------------------------------------------------

/**
 * Compute war propensity filtered through current psychological state.
 * Returns a multiplier (0 = no war, 1 = baseline, >1 = eager for war).
 */
export function psychologyWarPropensity(state: EmpirePsychologicalState): number {
  const { personality, mood, needs, stressLevel, effectiveTraits } = state;

  let propensity = 1.0;

  // Personality base: low A + high assertiveness = more warlike
  propensity *= 1 + (50 - effectiveTraits.agreeableness) * 0.01;
  propensity *= 1 + (effectiveTraits.neuroticism - 50) * 0.005; // High N = reactive aggression

  // Dark Triad boost
  propensity *= 1 + (personality.darkTriad.psychopathy / 200);
  propensity *= 1 + (personality.darkTriad.narcissism / 300); // Narcissistic injury triggers war

  // Mood: anger and dominance increase war propensity
  propensity *= 1 + (mood.anger / 200);
  propensity *= 1 + ((mood.dominance - 50) / 200);

  // Stress: extreme stress can trigger fight response
  if (stressLevel === 'extreme') {
    const coping = determineCopingStrategy(personality.attachmentStyle, stressLevel, effectiveTraits);
    if (coping === 'fight_response') propensity *= 1.5;
    if (coping === 'freeze_response') propensity *= 0.2;
    if (coping === 'fawn_response') propensity *= 0.1;
  }

  // Critical safety need: desperate defence
  if (needs.safety < 30) propensity *= 0.5; // Too weak to start wars
  if (needs.physiological < 20) propensity *= 1.3; // Desperate resource grab

  // Moral foundations: low care/harm = fewer reservations about war
  propensity *= 1 + (50 - personality.moralFoundations.careHarm) * 0.005;

  return Math.max(0, propensity);
}

// ---------------------------------------------------------------------------
// Building priority from Maslow
// ---------------------------------------------------------------------------

/** Building priority categories aligned with Maslow hierarchy. */
export type BuildingPriority =
  | 'food_production'
  | 'resource_production'
  | 'military_defence'
  | 'diplomatic_buildings'
  | 'research_buildings'
  | 'prestige_buildings';

/**
 * Determine building priorities based on Maslow needs.
 * Returns ordered list of priorities (most urgent first).
 */
export function determineBuildingPriorities(needs: MaslowNeeds): BuildingPriority[] {
  const priorities: [BuildingPriority, number][] = [
    ['food_production', 100 - needs.physiological],
    ['resource_production', Math.max(0, 80 - needs.physiological)],
    ['military_defence', 100 - needs.safety],
    ['diplomatic_buildings', Math.max(0, 80 - needs.belonging)],
    ['research_buildings', Math.max(0, 70 - needs.selfActualisation)],
    ['prestige_buildings', Math.max(0, 60 - needs.esteem)],
  ];

  return priorities
    .sort((a, b) => b[1] - a[1])
    .map(p => p[0]);
}

// ---------------------------------------------------------------------------
// Diplomatic action generation for AI
// ---------------------------------------------------------------------------

/**
 * Generate psychology-driven diplomatic actions for an AI empire this tick.
 * Uses personality, mood, needs, and relationship state to decide what to do.
 *
 * Returns at most `maxActions` actions to execute.
 */
export function generatePsychDiplomaticActions(
  state: EmpirePsychologicalState,
  currentTick: number,
  maxActions: number = 2,
): DiplomaticAction[] {
  const { personality, mood, needs, relationships } = state;

  // Check if this tick should generate proposals (frequency limit)
  const freq = proposalFrequency(personality.attachmentStyle, personality.traits.extraversion);
  const ticksPerProposal = Math.round(100 / freq);
  if (currentTick % ticksPerProposal !== 0 && Object.keys(relationships).length > 0) {
    return [];
  }

  const actions = generateDiplomaticActions(personality, mood, needs, relationships);
  return actions.slice(0, maxActions);
}

// ---------------------------------------------------------------------------
// Personality evolution (slow trait drift from experiences)
// ---------------------------------------------------------------------------

/**
 * Apply slow personality drift based on accumulated relationship experiences.
 * Called periodically (e.g., every 100 ticks) rather than every tick.
 *
 * A species repeatedly betrayed becomes less agreeable.
 * A species that forms successful alliances becomes more extraverted.
 */
export function computePersonalityDrift(
  state: EmpirePsychologicalState,
): Partial<Record<keyof import('../../types/psychology.js').CoreTraits, number>> {
  const drift: Partial<Record<string, number>> = {};
  const { relationships } = state;

  let totalBetrayal = 0;
  let totalPositive = 0;
  let allianceCount = 0;

  for (const rel of Object.values(relationships)) {
    totalBetrayal += rel.negativeHistory;
    totalPositive += rel.positiveHistory;
    if (rel.trust > 60 && rel.warmth > 40) allianceCount++;
  }

  // Betrayal → less agreeable (capped at -5 per computation)
  if (totalBetrayal > 100) {
    drift.agreeableness = Math.max(-5, Math.round(-totalBetrayal * 0.01));
  }

  // Successful alliances → more extraverted
  if (allianceCount >= 2) {
    drift.extraversion = Math.min(3, allianceCount);
  }

  // Consistent positive history → lower neuroticism (emotional stability)
  if (totalPositive > 200 && totalBetrayal < 50) {
    drift.neuroticism = Math.max(-3, Math.round(-totalPositive * 0.005));
  }

  return drift;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapTreatyType(type: string): EvaluableTreatyType | null {
  switch (type) {
    case 'trade':
    case 'trade_agreement': return 'trade';
    case 'non_aggression': return 'non_aggression';
    case 'research_sharing': return 'research_sharing';
    case 'mutual_defence':
    case 'mutual_defense': return 'mutual_defence';
    case 'alliance':
    case 'military_alliance': return 'alliance';
    default: return null;
  }
}
