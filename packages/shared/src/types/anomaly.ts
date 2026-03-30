/** Space anomaly types discovered during galaxy exploration */

export type AnomalyType =
  | 'precursor_ruins'      // Ancient dig site — xeno-archaeology target
  | 'derelict_vessel'      // Abandoned ship — salvageable tech/resources
  | 'spatial_rift'         // Subspace anomaly — dangerous but researchable
  | 'mineral_deposit'      // Rare concentrated minerals — mining bonanza
  | 'energy_signature'     // Strange energy readings — Devourer foreshadowing
  | 'sealed_wormhole'      // Deliberately closed wormhole — researchable
  | 'debris_field'         // Ancient battle wreckage — salvage
  | 'living_nebula'        // Nebula with unusual properties — Luminari affinity
  | 'gravity_anomaly'      // Physics-defying zone — research opportunity
  | 'ancient_beacon';      // Signal source — lore/foreshadowing

export interface Anomaly {
  id: string;
  type: AnomalyType;
  name: string;
  description: string;
  systemId: string;
  discovered: boolean;
  investigated: boolean;
  /** The empire that investigated this anomaly (null if not yet investigated). */
  investigatedBy?: string | null;
  rewards?: AnomalyReward;
}

export interface AnomalyReward {
  researchPoints?: number;
  credits?: number;
  minerals?: number;
  rareElements?: number;
  exoticMaterials?: number;
  energy?: number;
  techUnlock?: string;
  loreFragment?: string;
}

// ---------------------------------------------------------------------------
// Investigation orders — tracked in GameTickState
// ---------------------------------------------------------------------------

/** An active investigation order: a fleet is studying an anomaly. */
export interface ExplorationOrder {
  /** Unique ID for this order. */
  id: string;
  /** The anomaly being investigated. */
  anomalyId: string;
  /** The fleet performing the investigation. */
  fleetId: string;
  /** The empire that owns the investigating fleet. */
  empireId: string;
  /** System the anomaly is in (cached for fast lookup). */
  systemId: string;
  /** Total ticks required to complete investigation. */
  totalTicks: number;
  /** Ticks of investigation already completed. */
  ticksCompleted: number;
}

/** Template defining rewards for each anomaly type. */
export interface AnomalyRewardTemplate {
  type: AnomalyType;
  /** Base number of ticks to investigate. */
  baseTicks: number;
  /** Difficulty rating 1-5 — affects tick count scaling. */
  difficulty: number;
  /** Base rewards (scaled by species research trait). */
  baseRewards: AnomalyReward;
  /** Species that get a bonus investigating this type (species name -> multiplier). */
  speciesAffinity?: Record<string, number>;
}
