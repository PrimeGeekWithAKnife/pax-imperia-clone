/**
 * Diplomacy-Psychology Bridge
 *
 * Translates events between the legacy diplomacy system (DiplomacyState
 * with attitude/trust) and the psychology system (PsychRelationship
 * with warmth/respect/trust/fear/dependency).
 *
 * This module is the glue layer that allows both systems to coexist
 * during the transition period. Psychology is the source of truth;
 * legacy diplomacy receives synced attitude values.
 */

import type { DiplomacyState } from './diplomacy.js';
import type { TreatyType } from '../types/species.js';
import type { RelationshipEventType, PsychRelationship } from '../types/diplomacy-v2.js';
import type { EmpirePsychologicalState } from '../types/psychology.js';
import { applyRelationshipEvent, computeOverallSentiment } from './psychology/relationship.js';
import { modifyAttitude } from './diplomacy.js';

// ---------------------------------------------------------------------------
// Treaty → Relationship event mapping
// ---------------------------------------------------------------------------

/** Lookup table from legacy TreatyType strings to psychology RelationshipEventType. */
const TREATY_EVENT_MAP: Record<string, RelationshipEventType> = {
  trade:              'trade_treaty',
  trade_agreement:    'trade_treaty',
  non_aggression:     'non_aggression_treaty',
  research_sharing:   'research_treaty',
  mutual_defense:     'mutual_defence_treaty',
  mutual_defence:     'mutual_defence_treaty',
  military_alliance:  'alliance_treaty',
  alliance:           'alliance_treaty',
};

/**
 * Map a legacy TreatyType string to a psychology RelationshipEventType.
 * Returns undefined for treaty types that have no psychology equivalent
 * (e.g. vassalism, federation_membership).
 */
export function mapTreatyToRelationshipEvent(
  treatyType: string,
): RelationshipEventType | undefined {
  return TREATY_EVENT_MAP[treatyType];
}

// ---------------------------------------------------------------------------
// Sentiment → Attitude conversion
// ---------------------------------------------------------------------------

/**
 * Compute an integer attitude value from a psychology relationship.
 * Delegates to computeOverallSentiment, which returns a weighted
 * combination of warmth, respect, trust, fear, compatibility, and affinity.
 */
export function syncSentimentToAttitude(rel: PsychRelationship): number {
  return computeOverallSentiment(rel);
}

// ---------------------------------------------------------------------------
// Diplomatic event recording
// ---------------------------------------------------------------------------

/**
 * Fire a psychology relationship event and compute the resulting attitude delta.
 *
 * Updates the relationship in-place on the psychStateMap (intentional mutation
 * for performance — the Map is the owning container).
 *
 * @param psychStateMap - Map of empire ID → EmpirePsychologicalState
 * @param empireId - The empire whose relationship is being updated
 * @param targetEmpireId - The empire the event is about
 * @param eventType - Psychology RelationshipEventType to fire
 * @param tick - Current game tick
 * @returns The (potentially mutated) psychStateMap and the attitude delta
 */
export function recordDiplomaticEvent(
  psychStateMap: Map<string, EmpirePsychologicalState>,
  empireId: string,
  targetEmpireId: string,
  eventType: RelationshipEventType,
  tick: number,
): { psychStateMap: Map<string, EmpirePsychologicalState>; attitudeDelta: number } {
  const psychState = psychStateMap.get(empireId);
  if (!psychState) {
    return { psychStateMap, attitudeDelta: 0 };
  }

  const rel = psychState.relationships[targetEmpireId];
  if (!rel) {
    return { psychStateMap, attitudeDelta: 0 };
  }

  // Compute sentiment before the event
  const sentimentBefore = computeOverallSentiment(rel);

  // Apply the event, modified by the empire's attachment style
  const updatedRel = applyRelationshipEvent(
    rel,
    eventType,
    psychState.personality.attachmentStyle,
    tick,
    psychState.effectiveTraits.agreeableness,
  );

  // Compute sentiment after the event
  const sentimentAfter = computeOverallSentiment(updatedRel);
  const attitudeDelta = sentimentAfter - sentimentBefore;

  // Update in-place on the Map
  psychState.relationships[targetEmpireId] = updatedRel;

  return { psychStateMap, attitudeDelta };
}

// ---------------------------------------------------------------------------
// Full psychology → diplomacy sync
// ---------------------------------------------------------------------------

/**
 * Iterate all psychology relationships and sync their sentiment
 * to legacy diplomacy attitude values.
 *
 * For each relationship, computes the current sentiment and applies
 * the delta (sentiment - current attitude) to the legacy system via
 * modifyAttitude. This keeps legacy diplomacy in step with psychology
 * without replacing it wholesale.
 *
 * @param psychStateMap - Map of empire ID → EmpirePsychologicalState
 * @param diplomacyState - The legacy DiplomacyState to update
 * @param tick - Current game tick
 * @returns Updated DiplomacyState with attitudes synced from psychology
 */
export function syncPsychologyToDiplomacy(
  psychStateMap: Map<string, EmpirePsychologicalState>,
  diplomacyState: DiplomacyState,
  tick: number,
): DiplomacyState {
  let state = diplomacyState;

  for (const [empireId, psychState] of psychStateMap) {
    for (const [targetId, rel] of Object.entries(psychState.relationships)) {
      // Only sync if the legacy system knows about this pair
      const legacyRelMap = state.relations.get(empireId);
      if (!legacyRelMap || !legacyRelMap.has(targetId)) continue;

      const legacyRel = legacyRelMap.get(targetId)!;
      const sentiment = computeOverallSentiment(rel);
      const delta = sentiment - legacyRel.attitude;

      if (delta !== 0) {
        state = modifyAttitude(state, empireId, targetId, delta, 'psychology_sync', tick);
      }
    }
  }

  return state;
}
