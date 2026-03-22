/**
 * D&D-inspired personality trait system for AI empires.
 * Each trait is a spectrum from 1-10, where 5 is neutral.
 * The combination of traits creates unique AI behaviour profiles.
 */

/**
 * Eight-axis personality profile for an AI empire. Each trait ranges from 1–10
 * and shapes how the AI makes strategic and diplomatic decisions.
 */
export interface AIPersonalityProfile {
  /** 1=pathologically honest, 10=compulsive liar */
  honesty: number;
  /** 1=cowardly, 10=recklessly brave */
  bravery: number;
  /** 1=content with what they have, 10=relentlessly expansionist */
  ambition: number;
  /** 1=impulsive/reactive, 10=patient/long-game planner */
  patience: number;
  /** 1=psychopathically cruel, 10=selflessly compassionate */
  empathy: number;
  /** 1=deeply xenophobic, 10=endlessly curious about others */
  openness: number;
  /** 1=will betray anyone, 10=will die for an ally */
  loyalty: number;
  /** 1=rigid principles even to their detriment, 10=pure opportunist */
  pragmatism: number;
}

/**
 * Derived behaviour weights that drive concrete AI decisions. These are
 * calculated from the underlying personality profile — not set directly.
 * All values are normalised to 0–1.
 */
export interface AIBehaviourWeights {
  /** How likely to declare war vs. negotiate */
  warPropensity: number;
  /** How likely to honour treaties */
  treatyReliability: number;
  /** How likely to engage in espionage */
  espionagePropensity: number;
  /** How likely to trade vs. hoard resources */
  tradePropensity: number;
  /** How quickly they pursue victory conditions */
  victoryDrive: number;
  /** How likely to accept diplomatic proposals */
  diplomaticOpenness: number;
  /** How likely to engage in cold war tactics */
  coldWarPropensity: number;
  /** How likely to use false flag operations */
  deceptionPropensity: number;
}

/** All valid trait names on an AIPersonalityProfile. */
export type PersonalityTrait = keyof AIPersonalityProfile;
