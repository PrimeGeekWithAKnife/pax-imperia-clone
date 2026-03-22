/** Resource types and production tracking */

import type { BuildingType } from './galaxy.js';

export interface EmpireResources {
  credits: number;
  minerals: number;
  rareElements: number;
  energy: number;
  organics: number;
  exoticMaterials: number;
  faith: number;
  researchPoints: number;
}

/** Union of all resource property names in EmpireResources. */
export type ResourceKey = keyof EmpireResources;

/** Same shape as EmpireResources but represents per-tick production. Values can be negative (upkeep costs). */
export interface ResourceProduction {
  credits: number;
  minerals: number;
  rareElements: number;
  energy: number;
  organics: number;
  exoticMaterials: number;
  faith: number;
  researchPoints: number;
}

export interface BuildingOutput {
  buildingId: string;
  buildingType: BuildingType;
  resources: Partial<ResourceProduction>;
}

export interface PlanetProduction {
  planetId: string;
  production: ResourceProduction;
  population: number;
  taxIncome: number;
  buildingOutputs: BuildingOutput[];
}
