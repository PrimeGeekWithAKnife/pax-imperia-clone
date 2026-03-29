/** Narrative event chain types — multi-step exploration stories */

import type { AnomalyType } from './anomaly.js';

// ---------------------------------------------------------------------------
// Chain structure
// ---------------------------------------------------------------------------

/** A complete narrative event chain — a self-contained mini-story. */
export interface NarrativeChain {
  id: string;
  title: string;
  description: string;
  /** Anomaly types that can trigger this chain's first step. */
  triggerAnomalyTypes: AnomalyType[];
  /** If true, multiple empires can race to complete this chain. */
  competitive: boolean;
  /** Minimum number of anomalies the empire must have already investigated. */
  minDiscoveredAnomalies?: number;
  /** Tech IDs the empire must have researched before this chain can appear. */
  requiredTechs?: string[];
  /** Species-specific alternate step overrides keyed by species ID. */
  speciesBranches: Record<string, NarrativeStepOverride[]>;
  /** Ordered chain steps. */
  steps: NarrativeStep[];
  /** Tags for filtering and categorisation. */
  tags: NarrativeTag[];
}

export type NarrativeTag =
  | 'precursor'
  | 'devourer'
  | 'biological'
  | 'psionic'
  | 'military'
  | 'diplomatic'
  | 'exploration'
  | 'technology'
  | 'moral_dilemma'
  | 'competitive'
  | 'breadcrumb';

/** A single step within a narrative chain. */
export interface NarrativeStep {
  id: string;
  title: string;
  /** Flavour narration displayed to the player. */
  narration: string;
  /** Player choices available at this step. */
  choices: NarrativeChoice[];
}

/** A player choice within a narrative step. */
export interface NarrativeChoice {
  id: string;
  label: string;
  /** Tech or resource requirements to pick this option. */
  requirements?: NarrativeRequirement;
  /** If set, this choice is only available to empires of the given species. */
  speciesBranch?: string;
  /** Step ID to advance to. Null means this choice ends the chain. */
  nextStepId: string | null;
  /** Rewards granted when this choice is selected. */
  rewards?: NarrativeReward;
  /** Risks incurred when this choice is selected. */
  risks?: NarrativeRisk;
}

/** Requirements that must be met to select a choice. */
export interface NarrativeRequirement {
  techIds?: string[];
  minResearchPoints?: number;
  minMinerals?: number;
  specialAbility?: string;
}

/** Rewards for completing a chain step. */
export interface NarrativeReward {
  researchPoints?: number;
  minerals?: number;
  rareElements?: number;
  exoticMaterials?: number;
  energy?: number;
  credits?: number;
  techUnlock?: string;
  loreFragment?: string;
  /** Unlocks a unique ship design template. */
  shipDesignUnlock?: string;
  /** Reveals a sealed wormhole route on the galaxy map. */
  revealWormholeRoute?: string;
  /** Diplomatic attitude shift with a specific species or faction. */
  attitudeShift?: { targetSpecies: string; amount: number };
}

/** Risks that may be incurred by a choice. */
export interface NarrativeRisk {
  /** Damage to the investigating science ship (0-1 scale). */
  shipDamage?: number;
  /** Probability of losing the science ship entirely. */
  shipLossChance?: number;
  /** Negative attitude shift from a species or faction. */
  attitudeShift?: { targetSpecies: string; amount: number };
  /** Spawns hostile entities in the system. */
  spawnHostiles?: boolean;
  /** Biological contamination spreading to nearby colonies. */
  plagueRisk?: number;
  /** Empire-wide morale penalty. */
  moralePenalty?: number;
}

/** Override for a specific step when played by a particular species. */
export interface NarrativeStepOverride {
  /** The step ID being overridden. */
  stepId: string;
  /** Replacement narration text (if provided). */
  narration?: string;
  /** Additional choices available only to this species. */
  additionalChoices?: NarrativeChoice[];
  /** Choice IDs to remove for this species. */
  removedChoiceIds?: string[];
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

/** Tracks an empire's progress through a narrative chain. */
export interface NarrativeChainProgress {
  chainId: string;
  empireId: string;
  currentStepId: string;
  /** History of choices made so far. */
  choiceHistory: { stepId: string; choiceId: string; tick: number }[];
  /** Whether the chain has been completed (terminal choice reached). */
  complete: boolean;
  /** Summary outcome description when complete. */
  outcome?: string;
  /** Tick when the chain was started. */
  startedTick: number;
  /** Tick when the chain was completed (if complete). */
  completedTick?: number;
}

/** Event emitted when a narrative chain advances. */
export interface NarrativeChainEvent {
  type: 'narrative_chain_advance';
  chainId: string;
  empireId: string;
  stepId: string;
  choiceId: string;
  rewards?: NarrativeReward;
  risks?: NarrativeRisk;
}

/** Event emitted when a narrative chain completes. */
export interface NarrativeChainCompleteEvent {
  type: 'narrative_chain_complete';
  chainId: string;
  empireId: string;
  outcome: string;
  totalRewards: NarrativeReward;
}
