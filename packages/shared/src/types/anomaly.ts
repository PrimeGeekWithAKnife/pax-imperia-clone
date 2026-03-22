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
