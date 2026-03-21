/** Species and empire types */

export interface Species {
  id: string;
  name: string;
  description: string;
  portrait: string; // Asset key for species portrait
  traits: SpeciesTraits;
  environmentPreference: EnvironmentPreference;
  specialAbilities: SpecialAbility[];
  isPrebuilt: boolean;
}

export interface SpeciesTraits {
  construction: number; // 1-10: Building and ship production speed
  reproduction: number; // 1-10: Population growth rate
  research: number; // 1-10: Technology research speed
  espionage: number; // 1-10: Spy effectiveness
  economy: number; // 1-10: Credit generation multiplier
  combat: number; // 1-10: Ship combat effectiveness
  diplomacy: number; // 1-10: Diplomatic relationship bonuses
}

export interface EnvironmentPreference {
  idealTemperature: number; // Kelvin
  temperatureTolerance: number; // +/- range
  idealGravity: number; // Earth = 1.0
  gravityTolerance: number; // +/- range
  preferredAtmospheres: string[]; // AtmosphereType[]
}

export type SpecialAbility =
  | 'psychic'
  | 'aquatic'
  | 'silicon_based'
  | 'hive_mind'
  | 'cybernetic'
  | 'nomadic'
  | 'subterranean'
  | 'photosynthetic';

export interface Empire {
  id: string;
  name: string;
  species: Species;
  color: string; // Hex color for map display
  credits: number;
  researchPoints: number;
  knownSystems: string[];
  diplomacy: DiplomaticRelation[];
  technologies: string[]; // IDs of researched techs
  currentAge: TechAge;
  isAI: boolean;
  aiPersonality?: AIPersonality;
}

export type TechAge =
  | 'diamond_age'
  | 'spatial_dark_age'
  | 'neo_renaissance'
  | 'fusion_age'
  | 'age_of_star_empires';

export type AIPersonality =
  | 'aggressive'
  | 'defensive'
  | 'economic'
  | 'diplomatic'
  | 'expansionist'
  | 'researcher';

export interface DiplomaticRelation {
  empireId: string;
  status: DiplomaticStatus;
  treaties: Treaty[];
  attitude: number; // -100 to 100
  tradeRoutes: number;
}

export type DiplomaticStatus = 'unknown' | 'neutral' | 'friendly' | 'allied' | 'hostile' | 'at_war';

export interface Treaty {
  type: TreatyType;
  startTurn: number;
  duration: number; // -1 for permanent until broken
}

export type TreatyType =
  | 'non_aggression'
  | 'trade'
  | 'research_sharing'
  | 'mutual_defense'
  | 'alliance';
