/** Minor (pre-spaceflight) species found on habitable planets */

export type MinorSpeciesTechLevel =
  | 'stone_age'
  | 'bronze_age'
  | 'iron_age'
  | 'medieval'
  | 'renaissance'
  | 'industrial'
  | 'early_modern';    // Cap at roughly WW1 level

export type MinorSpeciesBiology =
  | 'carbon_terrestrial'
  | 'carbon_aquatic'
  | 'carbon_aerial'
  | 'silicon_based'
  | 'fungal_network'
  | 'insectoid_swarm'
  | 'megafauna';

export interface MinorSpecies {
  id: string;
  name: string;
  description: string;
  planetId: string;
  systemId: string;
  population: number;
  techLevel: MinorSpeciesTechLevel;
  biology: MinorSpeciesBiology;
  traits: MinorSpeciesTraits;
  attitude: number;          // -100 to 100 toward the discovering empire
  status: MinorSpeciesStatus;
  /** Unique properties derived from biology type */
  properties: MinorSpeciesProperty[];
  /** Integration progress (null if not being integrated) */
  integration: IntegrationProgress | null;
  /** Uplift progress (null if not being uplifted) */
  uplift: UpliftProgress | null;
  /** Active revolt state (null if no revolt) */
  revolt: RevoltState | null;
  /** ID of the empire currently interacting with this species (null if none) */
  interactingEmpireId: string | null;
  /** Current interaction type (null if no active interaction) */
  currentInteraction: MinorSpeciesInteraction | null;
}

export interface MinorSpeciesTraits {
  aggression: number;        // 1-10
  curiosity: number;         // 1-10
  industriousness: number;   // 1-10
  adaptability: number;      // 1-10
}

export type MinorSpeciesStatus =
  | 'undiscovered'
  | 'observed'
  | 'contacted'
  | 'integrated'
  | 'uplifted'
  | 'exploited'
  | 'enslaved'
  | 'revolting'
  | 'independent';    // Evolved to spacefaring

/** Available interaction types for engaging with a minor species */
export type MinorSpeciesInteraction =
  | 'observe'
  | 'integrate'
  | 'uplift'
  | 'exploit'
  | 'enslave'
  | 'ignore'
  | 'research'
  | 'liberate';

/** A unique property derived from a minor species' biology */
export interface MinorSpeciesProperty {
  id: string;
  label: string;
  description: string;
  category: 'construction' | 'happiness' | 'economy' | 'espionage' | 'research' | 'military';
  magnitude: number;
}

/** Progress state for integrating a minor species into an empire */
export interface IntegrationProgress {
  empireId: string;
  ticksIntegrated: number;
  loyalty: number;
  revoltRisk: number;
  culturalExchange: number;
  stage: 'early' | 'developing' | 'established' | 'harmonious';
}

/** Progress state for uplifting a minor species' technology */
export interface UpliftProgress {
  empireId: string;
  startingTechLevel: MinorSpeciesTechLevel;
  targetTechLevel: MinorSpeciesTechLevel;
  ticksRemaining: number;
  stability: number;
}

/** State of an active or resolved revolt */
export interface RevoltState {
  active: boolean;
  strength: number;
  cause: string;
  allies: string[];
}
