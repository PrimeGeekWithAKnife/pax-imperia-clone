/** Core galaxy and star system types */

import type { Anomaly } from './anomaly.js';
import type { MinorSpecies } from './minor-species.js';

export interface Position2D {
  x: number;
  y: number;
}

/** Persistent orbital debris field — created by combat, decays over time. */
export interface OrbitalDebris {
  /** Debris density: 0 = clean, 100 = Kessler locked */
  density: number;
  /** Tick when debris was last added (for decay calculation) */
  lastEventTick: number;
  /** Source of debris: 'combat' | 'asat' | 'breakup' */
  sources: Array<{ type: 'combat' | 'asat' | 'breakup'; tick: number; amount: number }>;
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
  /** Orbital debris field — absent or undefined means clean space. */
  debris?: OrbitalDebris;
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

export type PlanetSize =
  | 'colossal'      // 21 slots
  | 'gigantic'      // 19 slots
  | 'very_large'    // 17 slots
  | 'large'         // 15 slots
  | 'above_average' // 13 slots
  | 'average'       // 11 slots
  | 'below_average' // 9 slots
  | 'small'         // 7 slots
  | 'very_small'    // 5 slots
  | 'tiny';         // 3 slots

export type PlanetModifierType =
  | 'xenoarchaeology'       // research boost from ancient alien ruins
  | 'minor_race'            // indigenous sentient species on the planet
  | 'vicious_storms'        // negative: happiness and construction penalty
  | 'earthquakes'           // negative: building condition degrades faster
  | 'beneficial_radiation'  // positive: research and population growth boost
  | 'unique_bacteria'       // positive: science and organics boost
  | 'ancient_ruins'         // positive: one-time research windfall on colonisation
  | 'rich_deposits'         // positive: mineral and resource extraction boost
  | 'unstable_tectonics'    // negative: random building damage
  | 'paradise_flora';       // positive: beauty, happiness, and food boost

export interface PlanetModifier {
  type: PlanetModifierType;
  effect: 'positive' | 'negative' | 'neutral';
  label: string;
  description: string;
}

export interface Planet {
  id: string;
  name: string;
  orbitalIndex: number;
  type: PlanetType;
  atmosphere: AtmosphereType;
  gravity: number; // 0.1 to 3.0 (Earth = 1.0)
  temperature: number; // Kelvin
  naturalResources: number; // 0-100 wealth rating
  /** Planet size tier — determines base surface building slots. Absent in old saves. */
  size?: PlanetSize;
  /** Fertility rating 0-100. Low fertility requires hydroponics for food. Absent in old saves. */
  fertility?: number;
  /** Beauty rating 0-100. Higher = happier population, economic building bonus. Absent in old saves. */
  beauty?: number;
  /** Special modifiers giving unique positive or negative effects. Absent in old saves. */
  modifiers?: PlanetModifier[];
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
  /** Building condition 0–100%. Defaults to 100 when constructed. */
  condition?: number;
  /** Where this building is located. Defaults to 'surface' if omitted. */
  slotZone?: 'surface' | 'orbital' | 'underground';
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
  | 'waste_dump'
  | 'waste_incinerator'
  | 'atmosphere_cleanser'
  | 'orbital_waste_ejector'
  | 'energy_storage'
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
  | 'seismic_resonator'
  // ── Tiered food buildings ────────────────────────────────────────────────
  | 'concentrated_farming'
  | 'greenhouse_farming'
  // ── Zone infrastructure ─────────────────────────────────────────────────
  | 'underground_complex';

export interface ProductionItem {
  type: 'ship' | 'building' | 'defense' | 'building_upgrade';
  templateId: string;
  turnsRemaining: number;
  /** For building_upgrade items: the ID of the building being upgraded. */
  targetBuildingId?: string;
  /** Total construction points when queued — used by the UI for progress display. */
  totalTurns?: number;
  /** The zone this building will be placed in when complete. */
  targetZone?: 'surface' | 'orbital' | 'underground';
}

// ── Galaxy shape metadata (rendering hints from generation) ─────────────────

export interface SpiralGalaxyMetadata {
  shape: 'spiral';
  armCount: number;
  /** Starting angle offset for each arm (radians). Length === armCount. */
  armAngles: number[];
  /** Logarithmic spiral tightness parameter (higher = tighter winding). */
  spiralTightness: number;
  /** Arm angular half-width at the galaxy edge (radians). */
  armSpread: number;
  /** Galactic bulge radius as fraction of max radius (0–1). */
  bulgeRadiusFraction: number;
  /** Spiral 'a' parameter — radius at which arms begin. */
  spiralA: number;
  centreX: number;
  centreY: number;
}

export interface EllipticalGalaxyMetadata {
  shape: 'elliptical';
  centreX: number;
  centreY: number;
}

export interface RingGalaxyMetadata {
  shape: 'ring';
  centreX: number;
  centreY: number;
  innerRadiusFraction: number;
  outerRadiusFraction: number;
}

export interface IrregularGalaxyMetadata {
  shape: 'irregular';
  clusterCentres: Array<{ x: number; y: number }>;
}

export type GalaxyShapeMetadata =
  | SpiralGalaxyMetadata
  | EllipticalGalaxyMetadata
  | RingGalaxyMetadata
  | IrregularGalaxyMetadata;

export interface Galaxy {
  id: string;
  systems: StarSystem[];
  anomalies: Anomaly[];
  minorSpecies: MinorSpecies[];
  width: number;
  height: number;
  seed: number;
  /** Shape-specific rendering hints computed at generation time. */
  shapeMetadata?: GalaxyShapeMetadata;
}
