/**
 * Population demographics model for Ex Nihilo.
 * Population is not a single number — it's a living society.
 */

/** Age distribution of a planet's population */
export interface AgeDistribution {
  /** Children and adolescents. Need education and resources. Cannot work or fight. */
  young: number;
  /** Productive adults. Distributed across vocations. */
  workingAge: number;
  /** Elderly. Can contribute to research and economy, cannot fight. */
  elderly: number;
}

/** How the working-age population is distributed across roles */
export interface VocationDistribution {
  /** Scientists and researchers — fill research labs */
  scientists: number;
  /** Industrial workers — fill factories, mines, power plants */
  workers: number;
  /** Military personnel — available for recruitment and defence */
  military: number;
  /** Merchants and traders — fill trade hubs, spaceports */
  merchants: number;
  /** Administrators and bureaucrats — fill government buildings */
  administrators: number;
  /** Educators — needed to train new specialists */
  educators: number;
  /** Medical staff — fill hospitals, respond to crises */
  medical: number;
  /** Unspecialised — general labour pool, can be trained */
  general: number;
}

/** Faith distribution within the population */
export interface FaithDistribution {
  /** Will die for their faith. Powerful if channelled, dangerous if directed. */
  fanatics: number;
  /** Regular worshippers. Follow the rules, attend services. */
  observant: number;
  /** Culturally religious. Observe holidays, don't think too hard. */
  casual: number;
  /** Registered as faith-leaning but don't really care. */
  indifferent: number;
  /** No faith. May be actively hostile to religion. */
  secular: number;
}

/** Loyalty/satisfaction segments */
export interface LoyaltyDistribution {
  /** Enthusiastic supporters of the current government */
  loyal: number;
  /** Content enough not to cause problems */
  content: number;
  /** Unhappy but not yet acting on it */
  disgruntled: number;
  /** Actively hostile — prone to protest, sabotage, revolt */
  rebellious: number;
}

/** Full demographic snapshot of a planet's population */
export interface PlanetDemographics {
  totalPopulation: number;
  age: AgeDistribution;
  vocations: VocationDistribution;
  faith: FaithDistribution;
  loyalty: LoyaltyDistribution;
  /** Education level (0-100). Determines vocation training capacity. */
  educationLevel: number;
  /** Health level (0-100). Affects growth, mortality, productivity. */
  healthLevel: number;
  /** Cultural identity of the majority species on this planet */
  primarySpeciesId: string;
  /** Additional species populations if multi-species colony */
  secondarySpecies?: Array<{
    speciesId: string;
    population: number;
    loyalty: LoyaltyDistribution;
  }>;
  /** Wealth distribution across the population */
  wealth?: WealthDistribution;
  /** Current employment state */
  employment?: EmploymentState;
  /** Current crime state */
  crime?: CrimeState;
}

/** Distribution of wealth across four population bands */
export interface WealthDistribution {
  /** Fraction of population in the wealthy elite (0.0–1.0) */
  wealthyElite: number;
  /** Fraction of population in the middle class (0.0–1.0) */
  middleClass: number;
  /** Fraction of population in the working class (0.0–1.0) */
  workingClass: number;
  /** Fraction of population that is destitute (0.0–1.0) */
  destitute: number;
}

/** Snapshot of a planet's employment situation */
export interface EmploymentState {
  /** Total jobs available from buildings */
  totalJobs: number;
  /** Number of jobs currently filled */
  filledJobs: number;
  /** Unemployment rate as a fraction (0.0–1.0) */
  unemploymentRate: number;
  /** Whether demand for labour exceeds the working-age population */
  labourShortage: boolean;
  /** Per-vocation gaps where demand exceeds supply (vocation → deficit) */
  skillGaps: Record<string, number>;
}

/** Snapshot of a planet's crime situation */
export interface CrimeState {
  /** Overall crime rate (0.0–1.0) */
  crimeRate: number;
  /** Organised crime presence (0.0–1.0) */
  organisedCrimePresence: number;
  /** Black market activity level (0.0–1.0) */
  blackMarketActivity: number;
  /** Effectiveness of law enforcement after corruption degradation (0.0–1.0) */
  lawEnforcementEffectiveness: number;
}
