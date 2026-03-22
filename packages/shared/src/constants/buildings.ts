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
  },

  trade_hub: {
    name: 'Trade Hub',
    baseCost: { credits: 150 },
    baseProduction: { credits: 8 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Generates credits each tick through interstellar commerce.',
  },

  defense_grid: {
    name: 'Defense Grid',
    baseCost: { credits: 250, minerals: 150 },
    baseProduction: { energy: -3 },
    buildTime: 6,
    maintenanceCost: { credits: 2, energy: 2 },
    maxLevel: 4,
    description: 'Provides planetary defenses. Does not produce resources but consumes energy.',
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
  },

  hydroponics_bay: {
    name: 'Hydroponics Bay',
    baseCost: { credits: 75 },
    baseProduction: { organics: 5 },
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
  },

  recycling_plant: {
    name: 'Recycling Plant',
    baseCost: { credits: 60 },
    baseProduction: { minerals: 2, energy: 1 },
    buildTime: 3,
    maintenanceCost: { credits: 0 },
    maxLevel: 5,
    description: 'Converts waste into usable materials. Reduces environmental impact and building maintenance.',
  },

  communications_hub: {
    name: 'Communications Hub',
    baseCost: { credits: 100 },
    baseProduction: { researchPoints: 2, credits: 2 },
    buildTime: 4,
    maintenanceCost: { credits: 1 },
    maxLevel: 5,
    description: 'Planetary network connecting all buildings for improved coordination. Boosts research and trade.',
  },

  terraforming_station: {
    name: 'Terraforming Station',
    baseCost: { credits: 300, minerals: 100 },
    baseProduction: {},
    buildTime: 10,
    maintenanceCost: { credits: 3, energy: 2 },
    maxLevel: 3,
    description: 'Slowly modifies planetary atmosphere and conditions. Very expensive but can make hostile worlds habitable.',
  },

  military_academy: {
    name: 'Military Academy',
    baseCost: { credits: 150, minerals: 40 },
    baseProduction: {},
    buildTime: 6,
    maintenanceCost: { credits: 2 },
    maxLevel: 4,
    description: 'Trains ground forces for planetary defence and invasion. Required for troop deployment.',
  },

  fusion_reactor: {
    name: 'Fusion Reactor',
    baseCost: { credits: 120, minerals: 30 },
    baseProduction: { energy: 12 },
    buildTime: 5,
    maintenanceCost: { credits: 2 },
    maxLevel: 5,
    description: 'Advanced power generation using nuclear fusion. Produces significantly more energy than a basic power plant.',
  },
};
