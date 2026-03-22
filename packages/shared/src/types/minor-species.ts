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
