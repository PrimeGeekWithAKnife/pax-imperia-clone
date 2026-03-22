/**
 * Ethical audit trail system.
 *
 * The game watches how you play. Every major decision is recorded and scored
 * along ethical dimensions. This trail affects how other species perceive you,
 * the tone of victory/defeat epilogues, and whether species rally to your
 * banner when the Devourer arrives.
 *
 * A genocidal conqueror gets a very different post-victory experience than a
 * benevolent unifier.
 */

/**
 * The ethical dimensions tracked by the audit system.
 * Each ranges from -100 to +100.
 */
export type EthicalCategory = 'mercy' | 'honesty' | 'justice' | 'diplomacy' | 'ecology';

/**
 * A single recorded ethical decision with its impact.
 */
export interface EthicalDecision {
  /** The game tick when this decision was made */
  tick: number;
  /** Which ethical dimension this decision affects */
  category: EthicalCategory;
  /** Human-readable description of what happened */
  description: string;
  /** The score change applied to the relevant dimension */
  scoreChange: number;
}

/**
 * Running ethical scores and a log of all significant ethical decisions
 * made by an empire throughout the game.
 */
export interface EthicalAuditTrail {
  /** Ruthless (-100) to Merciful (+100) */
  mercy: number;
  /** Deceptive (-100) to Honest (+100) */
  honesty: number;
  /** Corrupt (-100) to Just (+100) */
  justice: number;
  /** Aggressive (-100) to Diplomatic (+100) */
  diplomacy: number;
  /** Exploitative (-100) to Ecological (+100) */
  ecology: number;

  /** Log of significant ethical decisions */
  decisions: EthicalDecision[];
}

/**
 * Create a fresh audit trail with neutral scores.
 * Implementation lives in `engine/first-contact.ts`.
 */
export type CreateAuditTrailFn = () => EthicalAuditTrail;

/**
 * Record a decision on an audit trail, returning an updated copy.
 * Implementation lives in `engine/first-contact.ts`.
 */
export type RecordDecisionFn = (
  trail: EthicalAuditTrail,
  decision: Omit<EthicalDecision, 'tick'>,
  tick: number,
) => EthicalAuditTrail;
