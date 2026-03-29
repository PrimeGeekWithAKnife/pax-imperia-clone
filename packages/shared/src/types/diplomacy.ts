/**
 * Advanced diplomacy type system.
 *
 * Extends the base diplomatic types in species.ts with:
 *  - Dual-channel diplomacy (public stance vs private position)
 *  - Grievance tracking with tiered decay
 *  - Diplomat characters with skills, personality, and personal agendas
 *  - Fully customisable treaty system with secret treaties
 *  - Galactic Council with voting, rival blocs, and resolutions
 *  - Galactic Bank with loans and interest rates
 *
 * All types here are data-only; engine logic lives in engine/diplomacy.ts.
 */

import type { DiplomaticStatus, TreatyType } from './species.js';

// ---------------------------------------------------------------------------
// Confidence & dual-channel diplomacy
// ---------------------------------------------------------------------------

/**
 * How reliable our intelligence assessment of another empire's true
 * diplomatic position is. Affected by espionage, diplomat skill, and
 * communication level.
 */
export type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

/**
 * Dual-channel diplomatic stance.
 *
 * Every empire-to-empire relationship has both a public face and a
 * private reality. The gap between the two is where espionage and
 * diplomat skill matter most.
 */
export interface DiplomaticStance {
  /** Public-facing position, -100 (hostile) to +100 (friendly). */
  publicPosition: number;
  /** True private intent, -100 (hostile) to +100 (friendly). */
  privatePosition: number;
  /** How well we can read THEIR private position. */
  confidenceInReading: ConfidenceLevel;
  /**
   * Our best estimate of their true position. May be wildly wrong at
   * low confidence levels. Undefined if no assessment has been made.
   */
  assessedPrivatePosition?: number;
}

// ---------------------------------------------------------------------------
// Grievance system
// ---------------------------------------------------------------------------

/**
 * Severity tiers for grievances. Determines decay behaviour:
 *  - slight:      fades quickly (high decay rate)
 *  - offence:     decays at a moderate pace
 *  - major:       decays very slowly
 *  - existential: NEVER decays — remembered for the entire game
 */
export type GrievanceSeverity = 'slight' | 'offence' | 'major' | 'existential';

/**
 * A recorded grievance between empires.
 *
 * Grievances feed into attitude calculations and provide casus belli.
 * They may be legitimate or fabricated via espionage.
 */
export interface Grievance {
  id: string;
  /** Game tick when the grievance was created. */
  tick: number;
  severity: GrievanceSeverity;
  /** Human-readable description of the offence. */
  description: string;
  /** Attitude impact when the grievance was first recorded. */
  initialValue: number;
  /** Current attitude impact (decreases over time for non-existential grievances). */
  currentValue: number;
  /**
   * How much the currentValue decreases per tick.
   * 0 = never decays (existential grievances).
   */
  decayRate: number;
  /** Empire that committed the offence. */
  perpetratorEmpireId: string;
  /** Empire that was wronged. */
  victimEmpireId: string;
  /** Empire IDs that are aware of this grievance. */
  witnesses: string[];
  /** Strength of evidence, 0-100. Affects diplomatic credibility. */
  evidenceStrength: number;
  /** Whether this grievance was fabricated through espionage. */
  fabricated: boolean;
}

// ---------------------------------------------------------------------------
// Diplomat characters
// ---------------------------------------------------------------------------

/**
 * Personality traits that affect a diplomat's behaviour and effectiveness.
 *
 *  - honest / deceptive: affects credibility and bluff detection
 *  - aggressive / conciliatory: affects negotiation style
 *  - xenophile / xenophobe: affects cross-species interactions
 *  - corrupt / incorruptible: vulnerability to being turned by enemies
 */
export type DiplomatTrait =
  | 'honest'
  | 'deceptive'
  | 'aggressive'
  | 'conciliatory'
  | 'xenophile'
  | 'xenophobe'
  | 'corrupt'
  | 'incorruptible';

/**
 * A diplomat character assigned to manage relations with another empire.
 *
 * Diplomats are trained through special buildings (e.g. Diplomatic Academy)
 * and gain experience through assignments. Their skills, traits, and
 * personal agendas all influence negotiation outcomes.
 */
export interface Diplomat {
  id: string;
  name: string;
  speciesId: string;
  empireId: string;

  // --- Skills (1-10 scale) ---
  /** Ability to secure favourable treaty terms. */
  negotiationSkill: number;
  /** Ability to read the other side's true intentions. */
  perceptionSkill: number;
  /** Ability to build rapport and shift attitudes. */
  charisma: number;

  /** Loyalty to their home empire, 0-100. */
  loyalty: number;
  /** Accumulated experience points from assignments. */
  experience: number;
  /** Personality traits that shape behaviour. */
  traits: DiplomatTrait[];

  /** Empire ID this diplomat is currently assigned to manage. */
  assignedRelationship?: string;
  /**
   * Personal agenda that may conflict with the player's goals.
   * E.g. "seeks personal wealth", "secretly sympathises with target empire".
   */
  personalAgenda?: string;

  /** Whether this diplomat has been turned by an enemy empire. */
  isCompromised: boolean;
  /** If compromised, which empire turned them. */
  compromisedBy?: string;
}

// ---------------------------------------------------------------------------
// Treaty system — fully customisable
// ---------------------------------------------------------------------------

/**
 * All possible clause types for customisable treaties.
 *
 * Extends the base TreatyType from species.ts with finer-grained
 * clauses that can be composed into complex agreements.
 */
export type TreatyClauseType =
  | 'non_aggression'
  | 'defensive_alliance'
  | 'mutual_defence'
  | 'trade_agreement'
  | 'research_sharing'
  | 'cultural_exchange'
  | 'vassalage'
  | 'federation'
  | 'resource_transfer'
  | 'military_access'
  | 'intelligence_sharing'
  | 'technology_transfer'
  | 'ship_transfer'
  | 'territory_transfer'
  | 'war_declaration'
  | 'custom';

/**
 * A single clause within a customisable treaty.
 *
 * Treaties are assembled from one or more clauses, allowing players
 * to craft bespoke agreements rather than picking from a fixed list.
 */
export interface TreatyClause {
  type: TreatyClauseType;
  /** Numeric value associated with the clause (e.g. credit amount, percentage). */
  value?: number;
  /** Target empire for clauses that reference a third party. */
  targetEmpireId?: string;
  /** Resource type for transfer clauses. */
  resourceType?: string;
  /** Duration of this specific clause in ticks. */
  duration?: number;
  /** Free-text condition that must hold for the clause to remain valid. */
  condition?: string;
}

/**
 * Status of a customisable treaty.
 */
export type CustomTreatyStatus = 'proposed' | 'active' | 'violated' | 'expired' | 'cancelled';

/**
 * A record of a treaty violation.
 */
export interface TreatyViolation {
  empireId: string;
  tick: number;
  description: string;
}

/**
 * A fully customisable treaty composed of arbitrary clauses.
 *
 * Unlike the simple Treaty in species.ts (which has a single TreatyType),
 * a CustomTreaty can combine multiple clause types and supports secret
 * agreements hidden from other empires.
 */
export interface CustomTreaty {
  id: string;
  name: string;
  /** Empire IDs that have signed this treaty. */
  signatories: string[];
  /** The individual terms of the agreement. */
  clauses: TreatyClause[];
  /** Whether this treaty is hidden from non-signatory empires. */
  isSecret: boolean;
  /** Game tick when the treaty was signed. */
  signedTick: number;
  /** Game tick when the treaty expires. Undefined = no expiry. */
  expirationTick?: number;
  status: CustomTreatyStatus;
  /** Log of violations committed against this treaty. */
  violations: TreatyViolation[];
}

// ---------------------------------------------------------------------------
// Galactic Council
// ---------------------------------------------------------------------------

/**
 * Whether a council resolution is merely advisory or legally binding
 * on member empires (with consequences for non-compliance).
 */
export type ResolutionType = 'advisory' | 'binding';

/**
 * How an empire voted on a council resolution.
 */
export type VoteChoice = 'for' | 'against' | 'abstain';

/**
 * A resolution put before the Galactic Council for a vote.
 */
export interface CouncilResolution {
  id: string;
  /** Empire that proposed this resolution. */
  proposedBy: string;
  title: string;
  description: string;
  type: ResolutionType;
  /** empireId -> vote cast */
  votes: Record<string, VoteChoice>;
  /** Whether the resolution passed after voting concluded. */
  passed: boolean;
  /** Game tick when the vote was held. */
  tick: number;
}

/**
 * A bloc of empires within the Galactic Council that coordinate
 * voting and may establish their own economic institutions.
 */
export interface GalacticBloc {
  id: string;
  name: string;
  /** Empire that leads the bloc and sets its agenda. */
  leaderEmpire: string;
  /** Empire IDs of all bloc members (including the leader). */
  members: string[];
  /** Game tick when the bloc was formed. */
  formedTick: number;
  /** Whether this bloc operates its own internal market. */
  hasOwnMarket: boolean;
  /** Whether this bloc has established its own reserve currency. */
  hasOwnCurrency: boolean;
}

/**
 * The Galactic Council — a multi-empire governing body formed when
 * enough empires have established diplomatic relations.
 *
 * Supports voting on resolutions, rival blocs, and an optional
 * reserve currency.
 */
export interface GalacticCouncil {
  /** Whether the council has been formally established. */
  formed: boolean;
  /** Game tick when the council was formed. Undefined if not yet formed. */
  formedTick?: number;
  /** Empire IDs of current council members. */
  memberEmpires: string[];
  /** Whether the council has established a reserve currency. */
  reserveCurrency: boolean;
  /** empireId -> voting weight (based on population, economy, etc.). */
  votingPower: Record<string, number>;
  /** All resolutions that have been proposed or voted on. */
  resolutions: CouncilResolution[];
  /** Rival blocs that have formed within the council. */
  rivalBlocs: GalacticBloc[];
}

// ---------------------------------------------------------------------------
// Galactic Bank
// ---------------------------------------------------------------------------

/**
 * A loan issued by the Galactic Bank to an empire.
 */
export interface BankLoan {
  id: string;
  /** Empire that borrowed the funds. */
  borrowerEmpireId: string;
  /** Original loan amount. */
  principal: number;
  /** Annual interest rate applied to this loan. */
  interestRate: number;
  /** Outstanding balance remaining. */
  remainingBalance: number;
  /** Number of ticks until the loan must be fully repaid. */
  ticksRemaining: number;
  /** Whether the borrower has defaulted on repayment. */
  defaulted: boolean;
}

/**
 * The Galactic Bank — an institution separate from the Council that
 * manages inter-empire lending and monetary policy.
 */
export interface GalacticBank {
  /** Whether the bank has been established. */
  active: boolean;
  /** Total reserves held by the bank. */
  totalReserves: number;
  /** Base interest rate for new loans. */
  interestRate: number;
  /** All outstanding and historical loans. */
  loans: BankLoan[];
}

// Note: DiplomaticStatus and TreatyType are defined in species.ts and
// re-exported from the barrel (index.ts). Import them from there or
// directly from species.ts when needed alongside these advanced types.
