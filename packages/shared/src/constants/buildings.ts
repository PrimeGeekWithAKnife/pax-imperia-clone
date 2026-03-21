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
};
