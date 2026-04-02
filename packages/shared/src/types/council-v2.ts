/**
 * Galactic Council V2 — Full Governance System
 *
 * Benefits of membership:
 *  - Non-aggression pact between all members
 *  - Intelligence sharing (map data, resource locations)
 *  - Trade market access at fixed rates (non-members pay 15% premium)
 *  - Piracy protection for trade routes
 *  - Tourism boost from standard immigration regulations
 *  - Voting rights on council bills
 *  - Eligibility for council leadership
 *
 * Graduated sanctions (each requires a bill + vote):
 *  1. Condemnation — reputational loss proportional to offence
 *  2. Financial penalties — trade revenue confiscation, intelligence cutoff, lump sum
 *  3. Sanctions — semi-permanent: lose trade routes, extra taxation, lose voting rights
 *  4. Suspension — all rights/benefits suspended pending review
 *  5. Expulsion — permanent removal, all members shun the expelled party
 *
 * Bill system:
 *  - Any member can propose a bill
 *  - Pre-vote canvassing (coalition sounding within council)
 *  - Weighted vote determines outcome
 *  - Council leader may veto (with popularity consequences)
 */

import type { VoteChoice } from './diplomacy.js';

// ---------------------------------------------------------------------------
// Council membership benefits
// ---------------------------------------------------------------------------

/** Benefits an empire receives from council membership. */
export interface CouncilBenefits {
  /** Non-aggression pact with all other members. */
  nonAggressionPact: boolean;
  /** Access to shared intelligence: maps, resource locations, fleet movements. */
  intelligenceAccess: boolean;
  /** Access to council trade market at standard rates (non-members pay 15% more). */
  tradeMarketAccess: boolean;
  /** Trade premium for non-members (percentage). */
  nonMemberTradePremium: number;
  /** Protection of trade routes from pirate raids. */
  piracyProtection: boolean;
  /** Tourism income boost from standard immigration rules (percentage). */
  tourismBoost: number;
  /** Right to vote on council bills. */
  votingRights: boolean;
  /** Eligible to stand for council leadership. */
  leadershipEligibility: boolean;
}

/** Default benefits for a full member in good standing. */
export const FULL_MEMBER_BENEFITS: CouncilBenefits = {
  nonAggressionPact: true,
  intelligenceAccess: true,
  tradeMarketAccess: true,
  nonMemberTradePremium: 15,
  piracyProtection: true,
  tourismBoost: 10,
  votingRights: true,
  leadershipEligibility: true,
};

/** Benefits for a suspended member (all stripped). */
export const SUSPENDED_BENEFITS: CouncilBenefits = {
  nonAggressionPact: false,
  intelligenceAccess: false,
  tradeMarketAccess: false,
  nonMemberTradePremium: 15,
  piracyProtection: false,
  tourismBoost: 0,
  votingRights: false,
  leadershipEligibility: false,
};

// ---------------------------------------------------------------------------
// Graduated sanctions
// ---------------------------------------------------------------------------

/** Severity levels of council sanctions, from mildest to most severe. */
export type SanctionLevel =
  | 'condemnation'
  | 'financial_penalty'
  | 'sanctions'
  | 'suspension'
  | 'expulsion';

/** Ordered from least to most severe. */
export const SANCTION_SEVERITY: readonly SanctionLevel[] = [
  'condemnation',
  'financial_penalty',
  'sanctions',
  'suspension',
  'expulsion',
] as const;

/** An active sanction against a member empire. */
export interface ActiveSanction {
  /** Unique ID. */
  id: string;
  /** Empire being sanctioned. */
  targetEmpireId: string;
  /** Severity level. */
  level: SanctionLevel;
  /** Tick when the sanction was imposed. */
  imposedTick: number;
  /** Duration in ticks (-1 = permanent until voted to lift). */
  duration: number;
  /** The specific penalties applied at this level. */
  penalties: SanctionPenalties;
  /** The bill ID that imposed this sanction. */
  billId: string;
  /** Reason text. */
  reason: string;
}

/** Specific penalties for a sanction. Varies by severity. */
export interface SanctionPenalties {
  /** Reputation penalty applied to all council member relationships. */
  reputationPenalty: number;
  /** Percentage of trade route revenue confiscated. */
  tradeRevenueConfiscation: number;
  /** Cut off from shared intelligence. */
  intelligenceCutoff: boolean;
  /** Lump sum credit penalty. */
  creditPenalty: number;
  /** Loss of voting rights. */
  loseVotingRights: boolean;
  /** Loss of trade routes with council members. */
  loseTradeRoutes: boolean;
  /** Additional taxation on trade (percentage). */
  additionalTaxation: number;
  /** All benefits suspended. */
  benefitsSuspended: boolean;
  /** Full expulsion — shunned by all members. */
  expelled: boolean;
  /** Duration of diplomatic relationship loss with members (ticks). */
  shunDuration: number;
}

/** Default penalties per sanction level. */
export const DEFAULT_SANCTION_PENALTIES: Record<SanctionLevel, SanctionPenalties> = {
  condemnation: {
    reputationPenalty: -10,
    tradeRevenueConfiscation: 0,
    intelligenceCutoff: false,
    creditPenalty: 0,
    loseVotingRights: false,
    loseTradeRoutes: false,
    additionalTaxation: 0,
    benefitsSuspended: false,
    expelled: false,
    shunDuration: 0,
  },
  financial_penalty: {
    reputationPenalty: -15,
    tradeRevenueConfiscation: 20,
    intelligenceCutoff: true,
    creditPenalty: 500,
    loseVotingRights: false,
    loseTradeRoutes: false,
    additionalTaxation: 5,
    benefitsSuspended: false,
    expelled: false,
    shunDuration: 0,
  },
  sanctions: {
    reputationPenalty: -25,
    tradeRevenueConfiscation: 40,
    intelligenceCutoff: true,
    creditPenalty: 1000,
    loseVotingRights: true,
    loseTradeRoutes: true,
    additionalTaxation: 15,
    benefitsSuspended: false,
    expelled: false,
    shunDuration: 200,
  },
  suspension: {
    reputationPenalty: -35,
    tradeRevenueConfiscation: 50,
    intelligenceCutoff: true,
    creditPenalty: 2000,
    loseVotingRights: true,
    loseTradeRoutes: true,
    additionalTaxation: 25,
    benefitsSuspended: true,
    expelled: false,
    shunDuration: 500,
  },
  expulsion: {
    reputationPenalty: -50,
    tradeRevenueConfiscation: 100,
    intelligenceCutoff: true,
    creditPenalty: 5000,
    loseVotingRights: true,
    loseTradeRoutes: true,
    additionalTaxation: 0,
    benefitsSuspended: true,
    expelled: true,
    shunDuration: 2000,
  },
};

// ---------------------------------------------------------------------------
// Bill / petition system
// ---------------------------------------------------------------------------

/** Types of bills that can be proposed to the council. */
export type BillType =
  | 'condemn'                // Condemn a member or non-member
  | 'financial_penalty'      // Impose financial penalties
  | 'impose_sanctions'       // Impose trade/political sanctions
  | 'suspend_member'         // Suspend membership
  | 'expel_member'           // Expel from council
  | 'lift_sanctions'         // Remove existing sanctions
  | 'reinstate_member'       // Reinstate a suspended member
  | 'authorise_war'          // Authorise council war against a target
  | 'declare_council_war'    // Declare war as the entire council
  | 'impose_trade_tax'       // Tax a specific trade route
  | 'share_resources'        // Mandate resource sharing with a member
  | 'admit_member'           // Vote to admit a new member
  | 'general_resolution';    // Generic advisory or binding resolution

/** A bill proposed to the council for a vote. */
export interface CouncilBill {
  /** Unique ID. */
  id: string;
  /** Empire that proposed this bill. */
  proposerEmpireId: string;
  /** Type of bill. */
  type: BillType;
  /** Human-readable title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Empire targeted by this bill (if applicable). */
  targetEmpireId?: string;
  /** Tick when the bill was proposed. */
  proposedTick: number;
  /** Current phase of the bill. */
  phase: BillPhase;
  /** Votes cast so far. empireId → vote. */
  votes: Record<string, VoteChoice>;
  /** Whether the council leader has vetoed this bill. */
  vetoed: boolean;
  /** Whether the bill has been resolved (passed or failed). */
  resolved: boolean;
  /** Whether the bill passed. */
  passed: boolean;
  /** Pre-vote canvassing results (who said what before the vote). */
  canvassingResults: Record<string, 'likely_for' | 'likely_against' | 'undecided'>;
}

/** Phases a bill goes through. */
export type BillPhase =
  | 'proposed'    // Just proposed, not yet open for canvassing
  | 'canvassing'  // Proposer is gathering support
  | 'voting'      // Open for formal votes
  | 'resolved';   // Vote concluded

// ---------------------------------------------------------------------------
// Council state (V2)
// ---------------------------------------------------------------------------

/** Full council state with governance features. */
export interface CouncilStateV2 {
  /** Whether the council has been formally established. */
  formed: boolean;
  /** Tick when formed. */
  formedTick: number;
  /** All current member empire IDs. */
  memberEmpires: string[];
  /** Empires that have been expelled (cannot rejoin easily). */
  expelledEmpires: string[];
  /** empireId → voting weight. */
  votingPower: Record<string, number>;

  /** Current council leader. */
  leaderEmpireId: string | null;
  /** Tick when current leader was elected. */
  leaderElectedTick: number;
  /** Term length in ticks. */
  leaderTermLength: number;

  /** Active bills (proposed, canvassing, or voting). */
  activeBills: CouncilBill[];
  /** Historical resolved bills. Capped at most recent 50. */
  billHistory: CouncilBill[];

  /** Active sanctions against members or non-members. */
  activeSanctions: ActiveSanction[];

  /** Per-member benefits (may be reduced by sanctions). */
  memberBenefits: Record<string, CouncilBenefits>;

  /** Council reputation scores: how each non-member views the council. empireId → score. */
  externalReputation: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Council events
// ---------------------------------------------------------------------------

/** Events emitted by council processing. */
export interface CouncilV2Event {
  type:
    | 'bill_proposed'
    | 'bill_canvassing'
    | 'bill_voting'
    | 'bill_passed'
    | 'bill_failed'
    | 'bill_vetoed'
    | 'sanction_imposed'
    | 'sanction_lifted'
    | 'member_expelled'
    | 'member_suspended'
    | 'member_admitted'
    | 'member_reinstated'
    | 'leader_elected'
    | 'leader_vetoed'
    | 'council_war_declared'
    | 'intelligence_shared'
    | 'leak_detected';
  tick: number;
  description: string;
  involvedEmpires: string[];
  billId?: string;
}
