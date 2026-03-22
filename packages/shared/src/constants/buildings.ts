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
    buildTime: 8,
    maintenanceCost: { credits: 2 },
    maxLevel: 5,
    description: 'Banks of humming terminals and sealed clean rooms where the unknown becomes the understood. Generates research points each tick, amplified by the species research trait. For many colonists, the glow of the lab at night is a promise that tomorrow will be better than today.',
    requiredTech: 'subspace_scanning',
  },

  factory: {
    name: 'Factory',
    baseCost: { credits: 80 },
    baseProduction: { minerals: 4, energy: -1 },
    buildTime: 6,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Smoke stacks, conveyor belts, and the relentless clatter of automated assembly lines turning raw ore into something useful. Processes raw resources into refined minerals, amplified by the species construction trait. Cheap to build — the first factory on a new colony is often the difference between survival and stagnation.',
  },

  shipyard: {
    name: 'Shipyard',
    baseCost: { credits: 300, minerals: 200 },
    baseProduction: { energy: -2 },
    buildTime: 8,
    maintenanceCost: { credits: 3, energy: 2 },
    maxLevel: 3,
    description: 'A vast orbital cradle of gantries, welding arms, and pressurised assembly bays where starships take shape from raw metal and ambition. Enables ship construction on this planet; higher levels reduce build time. The shipyard is where an empire\'s reach is forged — quite literally.',
    requiredTech: 'nano_fabrication',
  },

  trade_hub: {
    name: 'Trade Hub',
    baseCost: { credits: 150 },
    baseProduction: { credits: 8 },
    buildTime: 8,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'A sprawling bazaar of warehouses, brokerage offices, and currency exchanges where goods from across the sector change hands. Generates credits each tick through interstellar commerce. Where trade hubs thrive, so does civilisation — and where they fall silent, empires soon follow.',
    requiredTech: 'trade_protocols',
  },

  defense_grid: {
    name: 'Defense Grid',
    baseCost: { credits: 250, minerals: 150 },
    baseProduction: { energy: -3 },
    buildTime: 6,
    maintenanceCost: { credits: 2, energy: 2 },
    maxLevel: 4,
    description: 'A network of orbital weapon platforms, ground-based interceptors, and early-warning sensor arrays that turns a colony into a fortress. Produces no resources and draws significant energy, but an invading fleet will pay dearly for every kilometre of atmosphere it crosses.',
    requiredTech: 'automated_defence',
  },

  population_center: {
    name: 'Population Centre',
    baseCost: { credits: 100 },
    baseProduction: { organics: 2 },
    buildTime: 8,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Habitation blocks, parks, schools, and the quiet infrastructure that turns a landing site into a home. Houses more colonists and increases organics output through expanded agriculture. Essential for population growth — an empire is only as strong as the people who believe in it.',
  },

  mining_facility: {
    name: 'Mining Facility',
    baseCost: { credits: 60 },
    baseProduction: { minerals: 6, rareElements: 1 },
    buildTime: 6,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'Deep-bore drilling rigs and open-cast excavations that crack the planet\'s crust for what lies beneath. Extracts minerals and rare elements, with output scaling to the world\'s natural resources rating. Cheap to build and the first step in any colony\'s economic development — you cannot build an empire without digging one up first.',
  },

  spaceport: {
    name: 'Spaceport',
    baseCost: { credits: 150, minerals: 50 },
    baseProduction: { credits: 4, energy: -1 },
    buildTime: 10,
    maintenanceCost: { credits: 2 },
    maxLevel: 3,
    description: 'A gleaming orbital dock ringed with cargo berths and refuelling pylons, where freighters from distant systems queue for landing clearance. Boosts credit income and enables trade routes to other systems. The spaceport is the face a colony shows the galaxy — busy, prosperous, and open for business.',
    requiredTech: 'nano_fabrication',
  },

  power_plant: {
    name: 'Power Plant',
    baseCost: { credits: 70 },
    baseProduction: { energy: 8 },
    buildTime: 6,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Cooling towers, turbine halls, and the deep thrum of generators that never stop. Produces the energy that powers every other structure on the colony. Higher levels deliver more output. Without power, nothing else functions — the power plant is not glamorous, but it is indispensable.',
  },

  entertainment_complex: {
    name: 'Entertainment Complex',
    baseCost: { credits: 90 },
    baseProduction: { faith: 2, organics: 1 },
    buildTime: 8,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Amphitheatres, holosuites, gardens, and gathering halls where colonists remember that life is more than work quotas and resource projections. Reduces unrest, generates cultural influence, and reminds a population stretched across the void that they still have something worth fighting for.',
    requiredTech: 'growth_stimulants',
  },

  hydroponics_bay: {
    name: 'Hydroponics Bay',
    baseCost: { credits: 75 },
    baseProduction: { organics: 8 },
    buildTime: 6,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Tiered racks of nutrient-rich tanks glow under artificial sunlight, growing food where no soil exists. Produces organics in controlled environments, making colonisation viable on barren or hostile worlds. The smell of green, growing things in a sealed bay on a lifeless rock is a small miracle that colonists never quite get used to.',
  },

  orbital_platform: {
    name: 'Orbital Platform',
    baseCost: { credits: 200, minerals: 80 },
    baseProduction: { energy: 3, credits: 3 },
    buildTime: 14,
    maintenanceCost: { credits: 2, energy: 1 },
    maxLevel: 3,
    description: 'A ring of pressurised modules and docking spars suspended in low orbit, extending the planet\'s industrial capacity beyond its surface. Generates modest energy and credits while providing additional building slots. When a world runs out of room to grow, it grows upward.',
    requiredTech: 'gravity_generators',
  },

  recycling_plant: {
    name: 'Recycling Plant',
    baseCost: { credits: 60 },
    baseProduction: { minerals: 2, energy: 1 },
    buildTime: 6,
    maintenanceCost: { credits: 0 },
    maxLevel: 5,
    description: 'Nothing is wasted. Broken hull plating becomes structural alloy; spent fuel cells yield trace minerals; organic refuse becomes fertiliser. Converts waste streams into usable materials at zero maintenance cost. On the frontier, the recycling plant is a quiet testament to the principle that civilisation means making the most of what you have.',
    requiredTech: 'genetic_optimisation',
  },

  communications_hub: {
    name: 'Communications Hub',
    baseCost: { credits: 100 },
    baseProduction: { researchPoints: 2, credits: 2 },
    buildTime: 8,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Antenna arrays and quantum-entangled relay stations that knit every facility on the planet into a single coordinated network. Boosts research output and trade efficiency by eliminating communication lag. When every laboratory and marketplace can share data in real time, the whole colony becomes greater than the sum of its parts.',
    requiredTech: 'quantum_ciphers',
  },

  terraforming_station: {
    name: 'Terraforming Station',
    baseCost: { credits: 300, minerals: 100 },
    baseProduction: {},
    buildTime: 10,
    maintenanceCost: { credits: 3, energy: 2 },
    maxLevel: 3,
    description: 'Massive atmospheric processors that pump tailored gas mixtures into alien skies, slowly bending a world\'s climate toward habitability over decades. Extremely expensive and energy-hungry, producing no immediate output — but the payoff is a planet reborn. Terraforming is the ultimate expression of patience: the belief that what you build today, your grandchildren will inherit.',
    requiredTech: 'terraforming',
  },

  military_academy: {
    name: 'Military Academy',
    baseCost: { credits: 150, minerals: 40 },
    baseProduction: {},
    buildTime: 6,
    maintenanceCost: { credits: 2 },
    maxLevel: 4,
    description: 'Drill yards, simulation chambers, and officer schools where raw recruits are shaped into soldiers capable of holding ground on alien worlds. Trains ground forces for both planetary defence and invasion operations. Required for troop deployment. The academy is where a colony transforms from a settlement worth attacking into a settlement capable of fighting back.',
    requiredTech: 'heavy_fighter_wings',
  },

  fusion_reactor: {
    name: 'Fusion Reactor',
    baseCost: { credits: 120, minerals: 30 },
    baseProduction: { energy: 12 },
    buildTime: 10,
    maintenanceCost: { credits: 2 },
    maxLevel: 5,
    description: 'A miniature star contained in magnetic fields, converting hydrogen into helium and helium into the raw power that drives an advanced colony. Produces significantly more energy than a conventional power plant. The fusion reactor is the point at which a colony stops merely surviving and begins to thrive.',
    requiredTech: 'plasma_physics',
  },

  medical_bay: {
    name: 'Medical Bay',
    baseCost: { credits: 80 },
    baseProduction: {},
    buildTime: 6,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Sterile wards, diagnostic arrays, and quarantine chambers staffed by specialists who have learned that alien biology is always full of surprises. Reduces population loss from disease and improves overall colony health. On frontier worlds, the medical bay is often the most visited building — and the most appreciated.',
  },

  advanced_medical_centre: {
    name: 'Advanced Medical Centre',
    baseCost: { credits: 150, minerals: 50 },
    baseProduction: {},
    buildTime: 10,
    maintenanceCost: { credits: 2, energy: 1 },
    maxLevel: 4,
    description: 'Where the medical bay treats symptoms, the advanced medical centre rewrites them. Gene therapy suites, xenobiological research wings, and regeneration pods push the boundaries of what medicine can achieve across species. Provides superior disease resistance and dramatically improved population recovery rates. The colonists who walk out of these doors are, in a very real sense, better than when they walked in.',
    requiredTech: 'xenobiology',
  },

  // ── Vaelori unique buildings ────────────────────────────────────────────────

  crystal_resonance_chamber: {
    name: 'Crystal Resonance Chamber',
    racialSpeciesId: 'vaelori',
    baseCost: { credits: 200, minerals: 80 },
    baseProduction: { researchPoints: 10 },
    buildTime: 14,
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
    buildTime: 10,
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
    buildTime: 18,
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
    buildTime: 8,
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
    buildTime: 14,
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
    buildTime: 10,
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
    buildTime: 10,
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
    buildTime: 10,
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
    buildTime: 14,
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
    buildTime: 8,
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
    buildTime: 8,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description:
      'An off-the-books trading network that funnels goods through the grey margins of interstellar commerce. Provides a substantial boost to trade income and generates a trickle of rare elements from contraband deals. Ashkari only.',
  },
};
