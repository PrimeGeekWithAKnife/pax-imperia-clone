/**
 * War Declaration Ethics & Pre-War Coalition Sounding
 *
 * Species have different attitudes toward formal war declaration vs
 * surprise attack, derived from their psychology:
 *  - honestyHumility → formal declaration vs pragmatic ambush
 *  - moralFoundations.fairnessCheating → rules of war matter
 *  - moralFoundations.loyaltyBetrayal → betrayal of peace is shameful
 *  - darkTriad.machiavellianism → surprise is just good strategy
 *
 * The Galactic Council frowns on undeclared war. Members who attack
 * without formal declaration face condemnation and reputation loss.
 *
 * Pre-war coalition sounding: AI asks allies "would you support this war?"
 * Responses are probabilistic based on honesty — some lie strategically.
 */

import type {
  RolledPersonality,
  EmpirePsychologicalState,
  AttachmentStyle,
} from '../../types/psychology.js';
import type { PsychRelationship } from '../../types/diplomacy-v2.js';

// ---------------------------------------------------------------------------
// War declaration styles
// ---------------------------------------------------------------------------

/** How a species prefers to initiate war. */
export type WarDeclarationStyle =
  | 'formal_declaration'    // Honourable, public, advance notice
  | 'ritual_challenge'      // Ceremonial challenge to combat
  | 'holy_crusade'          // Religious proclamation of righteous war
  | 'polite_ultimatum'      // "Join us or face consequences"
  | 'diplomatic_withdrawal' // Recall ambassadors, then strike
  | 'surprise_attack'       // Strike first, explain never
  | 'calculated_strike'     // Surgical first strike, pragmatic
  | 'glacial_escalation';   // Decades of increasing hostility, war by degrees

/**
 * Determine how a species prefers to declare war based on their psychology.
 * This is the PREFERRED style — under extreme stress, even honourable
 * species may resort to surprise attack (Maslow override).
 */
export function determineWarDeclarationStyle(personality: RolledPersonality): WarDeclarationStyle {
  const h = personality.traits.honestyHumility;
  const mach = personality.darkTriad.machiavellianism;
  const psych = personality.darkTriad.psychopathy;
  const fairness = personality.moralFoundations.fairnessCheating;
  const loyalty = personality.moralFoundations.loyaltyBetrayal;
  const sanctity = personality.moralFoundations.sanctityDegradation;
  const authority = personality.moralFoundations.authoritySubversion;
  const e = personality.traits.extraversion;

  // Holy crusade: high sanctity + low openness (zealots)
  if (sanctity > 70 && personality.traits.openness < 30) {
    return 'holy_crusade';
  }

  // Ritual challenge: high loyalty + high authority + moderate-high honesty (warrior code)
  if (loyalty > 65 && authority > 65 && h > 35) {
    return 'ritual_challenge';
  }

  // Glacial escalation: very low extraversion + very high conscientiousness + low Mach (patient, not scheming)
  if (e < 20 && personality.traits.conscientiousness > 80 && mach < 30) {
    return 'glacial_escalation';
  }

  // Polite ultimatum: moderate honesty + high Machiavellianism (strategic charm)
  if (h > 25 && h < 50 && mach > 40) {
    return 'polite_ultimatum';
  }

  // Surprise attack: low honesty + high Machiavellianism or psychopathy
  if (h < 30 && (mach > 50 || psych > 40)) {
    return 'surprise_attack';
  }

  // Calculated strike: moderate honesty + high conscientiousness + moderate Mach
  if (h >= 30 && h < 50 && personality.traits.conscientiousness > 60 && mach > 30) {
    return 'calculated_strike';
  }

  // Diplomatic withdrawal: moderate-high honesty, formal but not showy
  if (h >= 50 && h < 70 && e < 50) {
    return 'diplomatic_withdrawal';
  }

  // Formal declaration: high honesty + high fairness (default for honourable species)
  if (h >= 50 || fairness > 60) {
    return 'formal_declaration';
  }

  // Fallback: surprise if dishonest, formal if honest
  return h >= 40 ? 'formal_declaration' : 'surprise_attack';
}

/**
 * Whether this declaration style is considered "undeclared war" by the
 * galactic community. Undeclared wars attract condemnation.
 */
export function isUndeclaredWar(style: WarDeclarationStyle): boolean {
  return style === 'surprise_attack' || style === 'calculated_strike';
}

/**
 * Reputation penalty for the given war declaration style.
 * Formal declarations have no penalty; ambushes are heavily penalised.
 * Applied to all relationships with empires that learn of the attack.
 */
export function declarationReputationPenalty(style: WarDeclarationStyle): number {
  switch (style) {
    case 'formal_declaration':    return 0;
    case 'ritual_challenge':      return 0;   // Respected even by enemies
    case 'holy_crusade':          return -5;  // Zealotry is unsettling
    case 'polite_ultimatum':      return -3;  // At least they warned
    case 'diplomatic_withdrawal': return -2;  // Professional but cold
    case 'glacial_escalation':    return -5;  // Creepy long-game hostility
    case 'calculated_strike':     return -15; // Premeditated surprise
    case 'surprise_attack':       return -25; // Maximum dishonour
  }
}

/**
 * Whether a species under extreme stress might abandon their preferred
 * style and resort to surprise attack. Even honourable species may
 * ambush when survival is at stake (Maslow physiological/safety override).
 */
export function wouldAbandonHonour(
  personality: RolledPersonality,
  stressLevel: import('../../types/psychology.js').StressLevel,
  safetyNeed: number,
): boolean {
  if (stressLevel !== 'extreme') return false;
  if (safetyNeed > 30) return false;

  // Even under extreme stress, very high honesty resists
  if (personality.traits.honestyHumility > 80) return false;

  // Moderate honesty buckles under existential threat
  if (personality.traits.honestyHumility > 60 && safetyNeed > 15) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Pre-war coalition sounding
// ---------------------------------------------------------------------------

/** Response to a coalition sounding request. */
export interface CoalitionResponse {
  /** Empire ID of the respondent. */
  respondentEmpireId: string;
  /** What they SAID (may be a lie). */
  statedSupport: 'support' | 'oppose' | 'neutral';
  /** What they actually INTEND (hidden from the asker). */
  trueIntent: 'support' | 'oppose' | 'neutral' | 'betray';
  /** Confidence in their stated position (0-1). */
  confidence: number;
  /** Whether they intend to leak this conversation to the target. */
  willLeak: boolean;
}

/**
 * Ask an AI empire whether they would support a war against a target.
 * The response depends on their psychology, relationship with both
 * the asker and the target, and their strategic situation.
 *
 * High honestyHumility → truthful answer
 * High Machiavellianism → may lie strategically
 * Low agreeableness → more likely to oppose
 * Self-interest → may encourage war to weaken both parties
 */
export function soundCoalitionSupport(
  respondentState: EmpirePsychologicalState,
  askerEmpireId: string,
  targetEmpireId: string,
  rng: () => number = Math.random,
): CoalitionResponse {
  const { personality, relationships, needs, mood } = respondentState;
  const askerRel = relationships[askerEmpireId];
  const targetRel = relationships[targetEmpireId];

  // Determine TRUE intent first
  let trueIntent: CoalitionResponse['trueIntent'] = 'neutral';

  if (!askerRel && !targetRel) {
    // Don't know either party
    trueIntent = 'neutral';
  } else {
    const askerWarmth = askerRel?.warmth ?? 0;
    const targetWarmth = targetRel?.warmth ?? 0;
    const askerTrust = askerRel?.trust ?? 20;
    const targetTrust = targetRel?.trust ?? 20;

    // Strong preference toward the asker → support
    if (askerWarmth > targetWarmth + 20 && askerTrust > 40) {
      trueIntent = 'support';
    }
    // Strong preference toward the target → oppose
    else if (targetWarmth > askerWarmth + 20 && targetTrust > 40) {
      trueIntent = 'oppose';
    }
    // Machiavellian play: encourage war to weaken both parties
    else if (personality.darkTriad.machiavellianism > 50 && needs.esteem < 60) {
      trueIntent = 'betray'; // Say support, plan to profit from the chaos
    }
    // Safety need: support if the target threatens us too
    else if (targetRel && targetRel.fear > 30 && needs.safety < 50) {
      trueIntent = 'support';
    }
    // Default: neutral
    else {
      trueIntent = 'neutral';
    }
  }

  // Determine STATED support (may differ from true intent)
  let statedSupport: CoalitionResponse['statedSupport'];
  const h = personality.traits.honestyHumility;
  const mach = personality.darkTriad.machiavellianism;
  const agreeableness = personality.traits.agreeableness;

  if (trueIntent === 'betray') {
    // Machiavellians always SAY support when planning betrayal
    statedSupport = 'support';
  } else if (h > 60) {
    // Honest species state their true position
    statedSupport = trueIntent;
  } else if (h < 30 && mach > 40) {
    // Dishonest + Machiavellian: say whatever benefits them
    if (trueIntent === 'oppose') {
      // Might say neutral to avoid antagonising the asker
      statedSupport = rng() < 0.6 ? 'neutral' : 'oppose';
    } else {
      statedSupport = trueIntent;
    }
  } else if (agreeableness > 60 && trueIntent === 'oppose') {
    // Agreeable species soften opposition to neutral (avoid conflict)
    statedSupport = rng() < 0.5 ? 'neutral' : 'oppose';
  } else {
    statedSupport = trueIntent;
  }

  // Confidence: how firmly they commit to their stated position
  const confidence = Math.min(1, Math.max(0.1,
    (h / 100) * 0.3 +
    (personality.traits.conscientiousness / 100) * 0.3 +
    (mood.dominance / 100) * 0.2 +
    (statedSupport === 'support' ? 0.2 : 0),
  ));

  // Will they leak this conversation to the target?
  // High Mach + good relationship with target → leak to curry favour
  // Low loyalty → leak for personal gain
  let willLeak = false;
  if (targetRel && targetRel.warmth > 30) {
    if (mach > 50 && rng() < 0.4) willLeak = true;
    if (personality.moralFoundations.loyaltyBetrayal < 40 && rng() < 0.3) willLeak = true;
  }
  // Intelligence-focused species leak more
  if (personality.traits.openness > 70 && personality.darkTriad.machiavellianism > 30) {
    if (rng() < 0.2) willLeak = true;
  }

  return {
    respondentEmpireId: '', // Set by caller
    statedSupport,
    trueIntent,
    confidence,
    willLeak,
  };
}

/**
 * Process coalition sounding for an AI considering war.
 * Returns a summary of all responses plus intelligence assessment.
 */
export interface CoalitionAssessment {
  /** All individual responses. */
  responses: CoalitionResponse[];
  /** Estimated support count (based on stated positions). */
  statedSupportCount: number;
  /** Estimated opposition count. */
  statedOppositionCount: number;
  /** Whether any respondent will leak the inquiry to the target. */
  leakDetected: boolean;
  /** Overall recommendation: safe to proceed, risky, or inadvisable. */
  recommendation: 'proceed' | 'risky' | 'inadvisable';
}

/**
 * Sound all known empires about support for a potential war.
 */
export function assessCoalitionSupport(
  askerState: EmpirePsychologicalState,
  askerEmpireId: string,
  targetEmpireId: string,
  allPsychStates: Map<string, EmpirePsychologicalState>,
  rng: () => number = Math.random,
): CoalitionAssessment {
  const responses: CoalitionResponse[] = [];
  let leakDetected = false;

  for (const [empireId, state] of allPsychStates) {
    if (empireId === askerEmpireId || empireId === targetEmpireId) continue;

    // Only sound empires we have a relationship with
    if (!askerState.relationships[empireId]) continue;

    const response = soundCoalitionSupport(state, askerEmpireId, targetEmpireId, rng);
    response.respondentEmpireId = empireId;
    responses.push(response);

    if (response.willLeak) leakDetected = true;
  }

  const statedSupportCount = responses.filter(r => r.statedSupport === 'support').length;
  const statedOppositionCount = responses.filter(r => r.statedSupport === 'oppose').length;

  let recommendation: CoalitionAssessment['recommendation'];
  if (statedSupportCount > statedOppositionCount && statedSupportCount >= 2) {
    recommendation = 'proceed';
  } else if (statedOppositionCount > statedSupportCount) {
    recommendation = 'inadvisable';
  } else {
    recommendation = 'risky';
  }

  return {
    responses,
    statedSupportCount,
    statedOppositionCount,
    leakDetected,
    recommendation,
  };
}
