/** Building definitions — costs, output, maintenance and metadata for all building types */

import type { BuildingType } from '../types/galaxy.js';
import type { EmpireResources, ResourceProduction } from '../types/resources.js';

export interface BuildingDefinition {
  name: string;
  baseCost: Partial<EmpireResources>;
  baseProduction: Partial<ResourceProduction>;
  /** Number of ticks to complete construction */
  buildTime: number;
  maintenanceCost: Partial<ResourceProduction>;
  maxLevel: number;
  description: string;
  /**
   * If set, only empires whose species id matches this value may construct the
   * building. Leave undefined for buildings available to all species.
   */
  racialSpeciesId?: string;
  /**
   * If set, the empire must have researched this technology before the building
   * can be constructed. Leave undefined for buildings available from the start.
   */
  requiredTech?: string;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  research_lab: {
    name: 'Research Lab',
    baseCost: { credits: 120 },
    baseProduction: { researchPoints: 5 },
    buildTime: 4,
    maintenanceCost: { credits: 2 },
    maxLevel: 5,
    description: 'Generates research points each tick. Output is amplified by the species research trait.',
    requiredTech: 'subspace_scanning',
  },

  factory: {
    name: 'Factory',
    baseCost: { credits: 80 },
    baseProduction: { minerals: 4, energy: -1 },
    buildTime: 3,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Processes raw resources into refined minerals. Amplified by the species construction trait. Credit-only cost to allow early construction.',
  },

  shipyard: {
    name: 'Shipyard',
    baseCost: { credits: 300, minerals: 200 },
    baseProduction: { energy: -2 },
    buildTime: 8,
    maintenanceCost: { credits: 3, energy: 2 },
    maxLevel: 3,
    description: 'Enables ship construction on this planet. Higher levels reduce ship build time.',
    requiredTech: 'cruiser_architecture',
  },

  trade_hub: {
    name: 'Trade Hub',
    baseCost: { credits: 150 },
    baseProduction: { credits: 8 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Generates credits each tick through interstellar commerce.',
    requiredTech: 'trade_protocols',
  },

  defense_grid: {
    name: 'Defense Grid',
    baseCost: { credits: 250, minerals: 150 },
    baseProduction: { energy: -3 },
    buildTime: 6,
    maintenanceCost: { credits: 2, energy: 2 },
    maxLevel: 4,
    description: 'Provides planetary defences. Does not produce resources but consumes energy.',
    requiredTech: 'automated_defence',
  },

  population_center: {
    name: 'Population Centre',
    baseCost: { credits: 100 },
    baseProduction: { organics: 2 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Increases the tax base and organics output by housing more colonists. Essential for population growth.',
  },

  mining_facility: {
    name: 'Mining Facility',
    baseCost: { credits: 60 },
    baseProduction: { minerals: 6, rareElements: 1 },
    buildTime: 3,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'Extracts minerals and rare elements. Output scales with the planet natural resources rating. Cheap to build — essential for bootstrapping your economy.',
  },

  spaceport: {
    name: 'Spaceport',
    baseCost: { credits: 150, minerals: 50 },
    baseProduction: { credits: 4, energy: -1 },
    buildTime: 5,
    maintenanceCost: { credits: 2 },
    maxLevel: 3,
    description: 'Facilitates trade and logistics, boosting credit income and enabling trade routes. Requires minerals.',
    requiredTech: 'nano_fabrication',
  },

  power_plant: {
    name: 'Power Plant',
    baseCost: { credits: 70 },
    baseProduction: { energy: 8 },
    buildTime: 3,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Generates energy to power other buildings. Essential for any growing colony. Higher levels produce more energy.',
  },

  entertainment_complex: {
    name: 'Entertainment Complex',
    baseCost: { credits: 90 },
    baseProduction: { faith: 2, organics: 1 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Keeps colonists happy and productive. Reduces unrest and generates cultural influence.',
    requiredTech: 'growth_stimulants',
  },

  hydroponics_bay: {
    name: 'Hydroponics Bay',
    baseCost: { credits: 75 },
    baseProduction: { organics: 8 },
    buildTime: 3,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Grows food in controlled environments. Essential for colonies on barren or hostile worlds.',
  },

  orbital_platform: {
    name: 'Orbital Platform',
    baseCost: { credits: 200, minerals: 80 },
    baseProduction: { energy: 3, credits: 3 },
    buildTime: 7,
    maintenanceCost: { credits: 2, energy: 1 },
    maxLevel: 3,
    description: 'An orbital structure extending the planet\'s capabilities. Provides additional building capacity.',
    requiredTech: 'gravity_generators',
  },

  recycling_plant: {
    name: 'Recycling Plant',
    baseCost: { credits: 60 },
    baseProduction: { minerals: 2, energy: 1 },
    buildTime: 3,
    maintenanceCost: { credits: 0 },
    maxLevel: 5,
    description: 'Converts waste into usable materials. Reduces environmental impact and building maintenance.',
    requiredTech: 'genetic_optimisation',
  },

  communications_hub: {
    name: 'Communications Hub',
    baseCost: { credits: 100 },
    baseProduction: { researchPoints: 2, credits: 2 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Planetary network connecting all buildings for improved coordination. Boosts research and trade.',
    requiredTech: 'quantum_ciphers',
  },

  terraforming_station: {
    name: 'Terraforming Station',
    baseCost: { credits: 300, minerals: 100 },
    baseProduction: {},
    buildTime: 10,
    maintenanceCost: { credits: 3, energy: 2 },
    maxLevel: 3,
    description: 'Slowly modifies planetary atmosphere and conditions. Very expensive but can make hostile worlds habitable.',
    requiredTech: 'terraforming',
  },

  military_academy: {
    name: 'Military Academy',
    baseCost: { credits: 150, minerals: 40 },
    baseProduction: {},
    buildTime: 6,
    maintenanceCost: { credits: 2 },
    maxLevel: 4,
    description: 'Trains ground forces for planetary defence and invasion. Required for troop deployment.',
    requiredTech: 'heavy_fighter_wings',
  },

  fusion_reactor: {
    name: 'Fusion Reactor',
    baseCost: { credits: 120, minerals: 30 },
    baseProduction: { energy: 12 },
    buildTime: 5,
    maintenanceCost: { credits: 2 },
    maxLevel: 5,
    description: 'Advanced power generation using nuclear fusion. Produces significantly more energy than a basic power plant.',
    requiredTech: 'plasma_physics',
  },

  medical_bay: {
    name: 'Medical Bay',
    baseCost: { credits: 80 },
    baseProduction: {},
    buildTime: 3,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'A well-equipped medical facility that reduces population loss from disease and improves overall colony health.',
  },

  advanced_medical_centre: {
    name: 'Advanced Medical Centre',
    baseCost: { credits: 150, minerals: 50 },
    baseProduction: {},
    buildTime: 5,
    maintenanceCost: { credits: 2, energy: 1 },
    maxLevel: 4,
    description: 'A state-of-the-art xenobiological healthcare facility providing superior disease resistance and population recovery rates.',
    requiredTech: 'xenobiology',
  },

  // ── Vaelori unique buildings ────────────────────────────────────────────────

  crystal_resonance_chamber: {
    name: 'Crystal Resonance Chamber',
    racialSpeciesId: 'vaelori',
    baseCost: { credits: 200, minerals: 80 },
    baseProduction: { researchPoints: 10 },
    buildTime: 7,
    maintenanceCost: { credits: 3, energy: 2 },
    maxLevel: 4,
    description:
      'A lattice of piezoelectric crystal spires tuned to the Vaelori collective resonance frequency. Dramatically amplifies research output by synchronising the minds of every researcher on the planet. Vaelori only.',
  },

  psionic_amplifier: {
    name: 'Psionic Amplifier',
    racialSpeciesId: 'vaelori',
    baseCost: { credits: 180, minerals: 40 },
    baseProduction: { researchPoints: 2 },
    buildTime: 6,
    maintenanceCost: { credits: 2, energy: 3 },
    maxLevel: 4,
    description:
      'A deep-space relay array that boosts the range and acuity of Vaelori psionic projection. Provides a significant bonus to espionage operations launched from this planet and passively detects cloaked vessels in the system. Vaelori only.',
  },

  // ── Khazari unique buildings ────────────────────────────────────────────────

  war_forge: {
    name: 'War Forge',
    racialSpeciesId: 'khazari',
    baseCost: { credits: 250, minerals: 200 },
    baseProduction: { minerals: 3, energy: -3 },
    buildTime: 8,
    maintenanceCost: { credits: 3, energy: 3 },
    maxLevel: 3,
    description:
      'A Khazari mega-foundry that integrates smelting, hull fabrication, and weapons assembly in a single volcanic-heat-powered facility. Reduces ship construction time on this planet significantly. Performs best on volcanic worlds. Khazari only.',
  },

  magma_tap: {
    name: 'Magma Tap',
    racialSpeciesId: 'khazari',
    baseCost: { credits: 100, minerals: 60 },
    baseProduction: { energy: 15, minerals: 2 },
    buildTime: 5,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'Geothermal bore sunk directly into a volcanic world\'s mantle, extracting enormous quantities of thermal energy and trace exotic minerals from magma-proximal ore veins. Functions only on volcanic planets. Khazari only.',
  },

  // ── Sylvani unique buildings ────────────────────────────────────────────────

  living_archive: {
    name: 'Living Archive',
    racialSpeciesId: 'sylvani',
    baseCost: { credits: 160, organics: 80 },
    baseProduction: { researchPoints: 8, organics: 2 },
    buildTime: 9,
    maintenanceCost: { credits: 2, energy: 1 },
    maxLevel: 4,
    description:
      'A vast biological library encoded in living crystal-fungal chemistry, drawing research output from the accumulated ecological memory of the planet\'s biosphere. Output scales with planetary biodiversity. Sylvani only.',
  },

  growth_vat: {
    name: 'Growth Vat',
    racialSpeciesId: 'sylvani',
    baseCost: { credits: 90, organics: 60 },
    baseProduction: { organics: 8 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'Accelerated-growth biological chambers that cultivate new Sylvani node-clusters from spore stock. Provides a substantial bonus to population growth each tick. Sylvani only.',
  },

  // ── Nexari unique buildings ─────────────────────────────────────────────────

  neural_network_hub: {
    name: 'Neural Network Hub',
    racialSpeciesId: 'nexari',
    baseCost: { credits: 300, minerals: 100 },
    baseProduction: { researchPoints: 4, credits: 4 },
    buildTime: 8,
    maintenanceCost: { credits: 4, energy: 4 },
    maxLevel: 3,
    description:
      'A planet-spanning cybernetic coordination layer that links every building\'s operational processes into a single optimised network. All other buildings on this planet operate at +10% efficiency per hub level. Nexari only.',
  },

  assimilation_node: {
    name: 'Assimilation Node',
    racialSpeciesId: 'nexari',
    baseCost: { credits: 220, minerals: 80 },
    baseProduction: { energy: -2, researchPoints: 3 },
    buildTime: 7,
    maintenanceCost: { credits: 3, energy: 2 },
    maxLevel: 3,
    description:
      'A cybernetic integration facility that steadily converts alien population units on this planet into Nexari-substrate citizens, absorbing their cultural knowledge into the collective. Reduces unrest among assimilated groups. Nexari only.',
  },

  // ── Drakmari unique buildings ───────────────────────────────────────────────

  abyssal_processor: {
    name: 'Abyssal Processor',
    racialSpeciesId: 'drakmari',
    baseCost: { credits: 110, minerals: 50 },
    baseProduction: { minerals: 8, rareElements: 2 },
    buildTime: 5,
    maintenanceCost: { credits: 1, energy: 1 },
    maxLevel: 5,
    description:
      'Pressure-adapted extraction rigs anchored to ocean world sea floors. Harvests mineral-rich sediment and hydrothermal vent deposits at yields impossible for surface-based facilities. Performs at maximum output on ocean worlds only. Drakmari only.',
  },

  predator_arena: {
    name: 'Predator Arena',
    racialSpeciesId: 'drakmari',
    baseCost: { credits: 130, minerals: 40 },
    baseProduction: { organics: 1 },
    buildTime: 5,
    maintenanceCost: { credits: 2 },
    maxLevel: 4,
    description:
      'A ritual combat facility where Drakmari warriors hone ambush tactics and deep-pressure combat reflexes against live prey. Provides a combat training bonus to ground forces and ship crews recruited on this planet. Drakmari only.',
  },

  // ── Teranos unique buildings ────────────────────────────────────────────────

  diplomatic_quarter: {
    name: 'Diplomatic Quarter',
    racialSpeciesId: 'teranos',
    baseCost: { credits: 200, minerals: 30 },
    baseProduction: { credits: 6, faith: 2 },
    buildTime: 6,
    maintenanceCost: { credits: 2 },
    maxLevel: 4,
    description:
      'A dedicated embassy district that hosts foreign trade missions and facilitates treaty negotiations. Improves diplomatic attitude with all known empires and boosts the success chance of trade and alliance proposals initiated from this planet. Teranos only.',
  },

  innovation_lab: {
    name: 'Innovation Lab',
    racialSpeciesId: 'teranos',
    baseCost: { credits: 150, minerals: 20 },
    baseProduction: { researchPoints: 6, credits: 2 },
    buildTime: 5,
    maintenanceCost: { credits: 2, energy: 1 },
    maxLevel: 5,
    description:
      'A rapid-iteration research facility staffed by Teranos generalist engineers. Reduces the number of turns required to unlock the next technology in the queue. Output benefits from the Teranos adaptability trait. Teranos only.',
  },

  // ── Zorvathi unique buildings ───────────────────────────────────────────────

  deep_hive: {
    name: 'Deep Hive',
    racialSpeciesId: 'zorvathi',
    baseCost: { credits: 120, minerals: 80 },
    baseProduction: { organics: 4 },
    buildTime: 6,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'An extensive underground population chamber bored deep beneath the surface, adding pressurised living galleries insulated from hostile surface conditions. Increases the planet\'s maximum population capacity significantly. Zorvathi only.',
  },

  tunnel_network: {
    name: 'Tunnel Network',
    racialSpeciesId: 'zorvathi',
    baseCost: { credits: 160, minerals: 120 },
    baseProduction: { energy: -1 },
    buildTime: 7,
    maintenanceCost: { credits: 2, energy: 1 },
    maxLevel: 4,
    description:
      'A planet-spanning subterranean logistics and fortification grid. Ground defenders using Zorvathi tunnel doctrine gain a substantial defence bonus, and the network provides advance warning of landing operations. Zorvathi only.',
  },

  // ── Ashkari unique buildings ────────────────────────────────────────────────

  salvage_yard: {
    name: 'Salvage Yard',
    racialSpeciesId: 'ashkari',
    baseCost: { credits: 80, minerals: 30 },
    baseProduction: { minerals: 5, rareElements: 2, credits: 2 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'A specialist disassembly and reclamation facility operated by Ashkari reverse-engineers. Converts destroyed or derelict ships in the system into usable minerals and rare elements each turn. Ashkari only.',
  },

  black_market: {
    name: 'Black Market',
    racialSpeciesId: 'ashkari',
    baseCost: { credits: 100 },
    baseProduction: { credits: 10, rareElements: 1 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'An off-the-books trading network that funnels goods through the grey margins of interstellar commerce. Provides a substantial boost to trade income and generates a trickle of rare elements from contraband deals. Ashkari only.',
  },
};
