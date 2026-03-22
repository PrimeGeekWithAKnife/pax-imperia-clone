/** Core galaxy and star system types */

import type { Anomaly } from './anomaly.js';
import type { MinorSpecies } from './minor-species.js';

export interface Position2D {
  x: number;
  y: number;
}

export interface StarSystem {
  id: string;
  name: string;
  position: Position2D;
  starType: StarType;
  planets: Planet[];
  wormholes: string[]; // IDs of connected star systems
  ownerId: string | null;
  discovered: Record<string, boolean>; // empireId -> discovered
}

export type StarType =
  | 'blue_giant'
  | 'white'
  | 'yellow'
  | 'orange'
  | 'red_dwarf'
  | 'red_giant'
  | 'neutron'
  | 'binary';

export interface Planet {
  id: string;
  name: string;
  orbitalIndex: number;
  type: PlanetType;
  atmosphere: AtmosphereType;
  gravity: number; // 0.1 to 3.0 (Earth = 1.0)
  temperature: number; // Kelvin
  naturalResources: number; // 0-100 wealth rating
  maxPopulation: number;
  currentPopulation: number;
  ownerId: string | null;
  buildings: Building[];
  productionQueue: ProductionItem[];
}

export type PlanetType =
  | 'terran'
  | 'ocean'
  | 'desert'
  | 'ice'
  | 'volcanic'
  | 'gas_giant'
  | 'barren'
  | 'toxic';

export type AtmosphereType =
  | 'oxygen_nitrogen'
  | 'nitrogen'
  | 'carbon_dioxide'
  | 'methane'
  | 'ammonia'
  | 'sulfur_dioxide'
  | 'hydrogen'
  | 'hydrogen_helium'
  | 'none'
  | 'toxic'
  | 'vacuum';

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
}

export type BuildingType =
  | 'research_lab'
  | 'factory'
  | 'shipyard'
  | 'trade_hub'
  | 'defense_grid'
  | 'population_center'
  | 'mining_facility'
  | 'spaceport'
  | 'power_plant'
  | 'entertainment_complex'
  | 'hydroponics_bay'
  | 'orbital_platform'
  | 'recycling_plant'
  | 'communications_hub'
  | 'terraforming_station'
  | 'military_academy'
  | 'fusion_reactor'
  | 'medical_bay'
  | 'advanced_medical_centre'
  // ── Vaelori unique buildings ──────────────────────────────────────────────
  | 'crystal_resonance_chamber'
  | 'psionic_amplifier'
  // ── Khazari unique buildings ──────────────────────────────────────────────
  | 'war_forge'
  | 'magma_tap'
  // ── Sylvani unique buildings ──────────────────────────────────────────────
  | 'living_archive'
  | 'growth_vat'
  // ── Nexari unique buildings ───────────────────────────────────────────────
  | 'neural_network_hub'
  | 'assimilation_node'
  // ── Drakmari unique buildings ─────────────────────────────────────────────
  | 'abyssal_processor'
  | 'predator_arena'
  // ── Teranos unique buildings ──────────────────────────────────────────────
  | 'diplomatic_quarter'
  | 'innovation_lab'
  // ── Zorvathi unique buildings ─────────────────────────────────────────────
  | 'deep_hive'
  | 'tunnel_network'
  // ── Ashkari unique buildings ──────────────────────────────────────────────
  | 'salvage_yard'
  | 'black_market'
  // ── Luminari unique buildings ─────────────────────────────────────────────
  | 'plasma_conduit'
  | 'dimensional_resonator'
  // ── Vethara unique buildings ──────────────────────────────────────────────
  | 'bonding_chamber'
  | 'neural_integration_centre'
  // ── Kaelenth unique buildings ─────────────────────────────────────────────
  | 'data_archive'
  | 'replication_forge'
  // ── Thyriaq unique buildings ──────────────────────────────────────────────
  | 'reconfiguration_matrix'
  | 'substrate_processor'
  // ── Aethyn unique buildings ───────────────────────────────────────────────
  | 'dimensional_anchor'
  | 'phase_laboratory'
  // ── Orivani unique buildings ──────────────────────────────────────────────
  | 'grand_cathedral'
  | 'reliquary_vault'
  // ── Pyrenth unique buildings ──────────────────────────────────────────────
  | 'elemental_forge'
  | 'seismic_resonator';

export interface ProductionItem {
  type: 'ship' | 'building' | 'defense';
  templateId: string;
  turnsRemaining: number;
}

export interface Galaxy {
  id: string;
  systems: StarSystem[];
  anomalies: Anomaly[];
  minorSpecies: MinorSpecies[];
  width: number;
  height: number;
  seed: number;
}
