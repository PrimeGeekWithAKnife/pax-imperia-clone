/**
 * Governor personality system.
 * Governors are characters with traits that affect all aspects of planetary management.
 */

export interface GovernorPersonality {
  /** Governor's unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Species of the governor */
  speciesId: string;
  /** Personality traits affecting governance */
  traits: GovernorTraits;
  /** Loyalty to the empire (0-100). Can change over time. */
  loyalty: number;
  /** Corruption level (0-100). High corruption = resource skimming. */
  corruption: number;
  /** Competence (0-100). Affects all production modifiers. */
  competence: number;
  /** How the population feels about this governor (-100 to 100). */
  popularity: number;
}

export interface GovernorTraits {
  /** Boosts mineral and manufacturing output */
  industrialist: number;      // 0-10
  /** Boosts research output */
  intellectual: number;        // 0-10
  /** Boosts military recruitment and defence */
  militarist: number;          // 0-10
  /** Boosts trade and credit generation */
  merchant: number;            // 0-10
  /** Boosts happiness and loyalty */
  charismatic: number;         // 0-10
  /** Reduces corruption, improves efficiency */
  administrator: number;       // 0-10
  /** Harsh but effective — order at the cost of happiness */
  authoritarian: number;       // 0-10
  /** Kind but potentially soft — happiness at the cost of productivity */
  humanitarian: number;        // 0-10
}

/** Effects of a governor on planetary output */
export interface GovernorPersonalityModifiers {
  productionMultiplier: number;
  researchMultiplier: number;
  militaryMultiplier: number;
  tradeMultiplier: number;
  happinessBonus: number;
  corruptionDrain: number;        // Resources skimmed (0.0 - 0.15)
  unrestModifier: number;         // Positive = calms, negative = agitates
}
