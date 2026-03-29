/**
 * Political factions system for Ex Nihilo.
 *
 * Hybrid model: 2-3 species-specific starter factions plus demographics-driven
 * emergent factions. Factions are active agents with an escalation ladder
 * (lobby -> fund -> strike -> protest -> coup). Elections can be manipulated
 * through legitimate, grey-area, or clandestine means.
 */

/** The seven policy domains that factions care about. */
export type PolicyDomain =
  | 'foreign'
  | 'domestic'
  | 'economic'
  | 'political'
  | 'education'
  | 'health'
  | 'security';

/**
 * A policy position on a single domain.
 * 0 = fully restrictive / authoritarian, 100 = fully liberal / permissive.
 */
export interface PolicyPosition {
  domain: PolicyDomain;
  /** Current enacted value (0-100). */
  value: number;
  /** How far through the legislative pipeline a pending change is (0-100). */
  transitionProgress?: number;
  /** Target value the policy is heading towards, if a transition is in progress. */
  transitionTarget?: number;
}

/** Escalation ladder for faction actions, from softest to hardest. */
export type FactionActionLevel =
  | 'lobbying'
  | 'funding'
  | 'strikes'
  | 'protests'
  | 'coup';

/**
 * A political faction within an empire.
 *
 * Empires have 2-5 active factions at any time. Factions form from species
 * culture (starter factions) or emerge dynamically from demographics shifts.
 * They are active agents that lobby, fund campaigns, organise strikes,
 * protest, and -- in extremis -- attempt coups.
 */
export interface PoliticalFaction {
  id: string;
  name: string;
  /** If set, this faction is a species-specific starter faction linked to this species ID. */
  speciesOrigin?: string;
  /** Percentage of the population that supports this faction (0-100). */
  supportBase: number;
  /** Political power / influence (0-100). */
  clout: number;
  /** How satisfied the faction is with the current government's policies (0-100). */
  satisfaction: number;
  /** The policy positions this faction demands. */
  demands: PolicyPosition[];
  /** The faction's current level of political action. */
  currentAction: FactionActionLevel;
  /** Whether this faction currently controls the government. */
  isRulingFaction: boolean;
  /** The game tick on which this faction was founded. */
  foundedTick: number;
  /** Whether the faction has been dissolved. */
  dissolved: boolean;
  /**
   * Demographics drivers -- which population segments feed support to this
   * faction. Maps to fields in the demographics system.
   */
  supportSources: {
    /** Vocation segment, e.g. 'military' feeds a Militarist faction. */
    vocation?: string;
    /** Faith segment, e.g. 'fanatics' feeds a Religious faction. */
    faith?: string;
    /** Loyalty segment, e.g. 'rebellious' feeds a Resistance faction. */
    loyalty?: string;
    /** Wealth level, e.g. 'wealthy_elite' feeds an Oligarch faction. */
    wealthLevel?: string;
  };
}

/** Election state for an empire. */
export interface ElectionState {
  /** Game tick of the next scheduled election. */
  nextElectionTick: number;
  /** Number of ticks between elections. */
  electionInterval: number;
  /** Results of the most recent election, if any. */
  lastResults?: ElectionResult;
  /** Rigging level: 0 = none, 1 = grey area, 2 = clandestine. */
  riggingLevel: number;
  /** Chance (0-100) that rigging will be detected by the population. */
  riggingDetectionRisk: number;
}

/** Results of a single election. */
export interface ElectionResult {
  /** Game tick when the election took place. */
  tick: number;
  /** Faction ID of the winner. */
  winner: string;
  /** Vote share per faction (factionId -> percentage 0-100). */
  voteShare: Record<string, number>;
  /** Whether the election was rigged by the player. */
  wasRigged: boolean;
  /** Whether the rigging was detected by the population. */
  riggingDetected: boolean;
  /** Voter turnout percentage (0-100). */
  turnout: number;
}

/** Tracks an active revolution or civil war. */
export interface RevolutionState {
  /** Whether a revolution is currently underway. */
  isActive: boolean;
  /** Faction ID of the revolting faction. */
  revoltingFaction?: string;
  /** Military strength of rebel forces (abstract units). */
  militaryStrength: number;
  /** Military strength of loyalist government forces (abstract units). */
  governmentStrength: number;
  /** Game tick when the revolution began. */
  startTick?: number;
  /** Human-readable reason for the revolution. */
  cause?: string;
}

/** The complete political state of an empire at a point in time. */
export interface EmpirePoliticalState {
  /** Active factions (2-5 typically). */
  factions: PoliticalFaction[];
  /** Current enacted policies across all domains. */
  policies: PolicyPosition[];
  /** Election system state, if the government holds elections. */
  election?: ElectionState;
  /** Revolution / civil war state, if one is in progress. */
  revolution?: RevolutionState;
  /** Government legitimacy (0-100). Low legitimacy increases faction unrest. */
  legitimacy: number;
  /** Empire-wide corruption level (0-100). High corruption reduces efficiency. */
  corruption: number;
}

// WealthDistribution is defined in demographics.ts
// SettlementTier is defined in ground-combat-expanded.ts

/**
 * Definition of a starter faction as stored in data JSON.
 * Runtime PoliticalFaction instances are created from these templates.
 */
export interface StarterFactionDefinition {
  /** Unique identifier for this starter faction template. */
  id: string;
  /** Display name of the faction. */
  name: string;
  /** Species ID this faction belongs to. */
  speciesId: string;
  /** Flavour description of the faction's ideology and culture. */
  description: string;
  /** Policy positions this faction will push for (domain -> preferred value 0-100). */
  defaultDemands: Partial<Record<PolicyDomain, number>>;
  /** Which demographic segments naturally feed support to this faction. */
  supportSources: PoliticalFaction['supportSources'];
  /** Approximate starting support base as a percentage (0-100). */
  defaultSupportBase: number;
}
