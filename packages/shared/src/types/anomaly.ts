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
  rewards?: AnomalyReward;
}

export interface AnomalyReward {
  researchPoints?: number;
  minerals?: number;
  rareElements?: number;
  exoticMaterials?: number;
  techUnlock?: string;
  loreFragment?: string;
}

/** Types of danger that can be encountered during excavation */
export type AnomalyDanger =
  | 'automated_defences'
  | 'precursor_trap'
  | 'radiation'
  | 'pathogen'
  | 'spatial_instability'
  | 'hostile_fauna';

/** Ordered stages of an excavation — from undiscovered through to complete */
export type ExcavationStage =
  | 'undiscovered'
  | 'detected'
  | 'surface_survey'
  | 'initial_dig'
  | 'deep_excavation'
  | 'artefact_recovery'
  | 'complete';

/** Depth of a planetary scan */
export type ScanLevel =
  | 'basic'
  | 'geological'
  | 'biological'
  | 'anomaly';

/** Player risk choice when danger is encountered during excavation */
export type RiskChoice =
  | 'proceed'     // Accept the danger and continue
  | 'withdraw'    // Abandon the excavation (partial rewards only)
  | 'mitigate';   // Spend extra time to reduce danger, then proceed

/** Data returned from a planetary scan — may contain misinformation */
export interface ScanData {
  summary: string;
  mineralRichness?: number;
  bioSignatures?: number;
  detectedAnomalies?: AnomalyType[];
  energyReadings?: number;
}

/** Result of scanning a planet */
export interface ScanResult {
  planetId: string;
  scanLevel: ScanLevel;
  accuracy: number;
  data: ScanData;
}

/** An active excavation site — extends Anomaly with excavation state */
export interface ExcavationSite extends Anomaly {
  currentStage: ExcavationStage;
  progressPerStage: Record<ExcavationStage, number>;
  dangerLevel: number;
  dangerType?: AnomalyDanger;
  assignedScienceShipId: string;
  discoveredByEmpireId: string;
  loreFragments: string[];
  rewards?: AnomalyReward;
  riskChoice?: RiskChoice;
}
