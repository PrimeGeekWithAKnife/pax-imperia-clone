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
}
