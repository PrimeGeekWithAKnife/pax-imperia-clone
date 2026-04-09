/**
 * Galactic reputation types.
 *
 * Each empire has a public reputation score visible to the galaxy.
 * Actions such as honouring treaties, betraying allies, or providing
 * aid shift the score and influence how other empires perceive you.
 */

/** Per-empire galactic reputation score. -100 (pariah) to +100 (revered). */
export interface ReputationState {
  /** Per-empire galactic reputation score. -100 (pariah) to +100 (revered). */
  scores: Record<string, number>;
  /** Recent reputation events for UI display and audit. Capped at 100. */
  events: ReputationEvent[];
}

export interface ReputationEvent {
  tick: number;
  empireId: string;
  type: ReputationEventType;
  value: number;
  description: string;
}

export type ReputationEventType =
  | 'treaty_honoured'
  | 'treaty_broken'
  | 'unjust_war'
  | 'just_war'
  | 'defended_ally'
  | 'peace_brokered'
  | 'council_condemnation'
  | 'council_sanction'
  | 'espionage_exposed'
  | 'aid_provided'
  | 'betrayal';

/** How reputation score affects gameplay mechanics. */
export interface ReputationModifiers {
  /** Added to treaty acceptance threshold (negative = easier to accept). */
  treatyAcceptanceBonus: number;
  /** Multiplier on trade route income. */
  tradeMultiplier: number;
  /** Attitude bonus applied at first contact. */
  firstContactBonus: number;
}
