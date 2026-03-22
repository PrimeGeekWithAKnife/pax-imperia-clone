/** Government types and their gameplay modifiers. */

export type GovernmentType =
  | 'forced_labour'
  | 'representative_democracy'
  | 'equality'
  | 'empire'
  | 'republic'
  | 'dictatorship';

export interface GovernmentModifiers {
  /** Multiplier applied to construction speed (1.0 = normal). */
  constructionSpeed: number;
  /** Multiplier applied to research output (1.0 = normal). */
  researchSpeed: number;
  /** Multiplier applied to trade / credit income (1.0 = normal). */
  tradeIncome: number;
  /** Multiplier applied to population growth rate (1.0 = normal). */
  populationGrowth: number;
  /** Flat bonus / penalty added to happiness score each tick. */
  happiness: number;
  /** Multiplier applied to fleet combat power calculations (1.0 = normal). */
  combatBonus: number;
  /** Multiplier applied to building costs (0.8 = 20 % cheaper). */
  buildingCost: number;
  /** Multiplier applied to production queue / decision speed (1.0 = normal). */
  decisionSpeed: number;
}

export interface GovernmentDefinition {
  type: GovernmentType;
  name: string;
  description: string;
  modifiers: GovernmentModifiers;
}

export const GOVERNMENTS: Record<GovernmentType, GovernmentDefinition> = {
  forced_labour: {
    type: 'forced_labour',
    name: 'Forced Labour',
    description:
      'The ruling class compels the workforce through coercion and fear. ' +
      'Construction is rapid and cheap but the population is miserable, ' +
      'growth is stunted, and research and trade barely function.',
    modifiers: {
      constructionSpeed: 1.5,
      researchSpeed:     0.3,
      tradeIncome:       0.3,
      populationGrowth:  0.4,
      happiness:         -30,
      combatBonus:       0.8,
      buildingCost:      0.6,
      decisionSpeed:     1.2,
    },
  },

  representative_democracy: {
    type: 'representative_democracy',
    name: 'Representative Democracy',
    description:
      'An elected government balances the interests of the citizenry. ' +
      'No single area excels dramatically, but research, trade, and growth ' +
      'all receive modest boosts. Not always fair, but reliably effective.',
    modifiers: {
      constructionSpeed: 1.0,
      researchSpeed:     1.1,
      tradeIncome:       1.2,
      populationGrowth:  1.1,
      happiness:         +10,
      combatBonus:       0.9,
      buildingCost:      1.0,
      decisionSpeed:     0.9,
    },
  },

  equality: {
    type: 'equality',
    name: 'Equality',
    description:
      'Every citizen has an equal vote on every decision. ' +
      'Morale is high and research flourishes, but the endless deliberation ' +
      'slows construction and fleet response times dramatically.',
    modifiers: {
      constructionSpeed: 0.8,
      researchSpeed:     1.2,
      tradeIncome:       1.0,
      populationGrowth:  1.0,
      happiness:         +20,
      combatBonus:       0.7,
      buildingCost:      1.0,
      decisionSpeed:     0.6,
    },
  },

  empire: {
    type: 'empire',
    name: 'Empire',
    description:
      'A dynastic monarchy where hereditary rulers command absolute loyalty. ' +
      'Military expansion and rapid construction are the empire\'s strengths, ' +
      'but research and trade suffer from the rigid hierarchy.',
    modifiers: {
      constructionSpeed: 1.2,
      researchSpeed:     0.7,
      tradeIncome:       0.8,
      populationGrowth:  1.0,
      happiness:         -10,
      combatBonus:       1.3,
      buildingCost:      0.9,
      decisionSpeed:     1.1,
    },
  },

  republic: {
    type: 'republic',
    name: 'Republic',
    description:
      'A system of law and property where most inhabitants are serfs rather ' +
      'than citizens. Production is strong and construction is efficient, ' +
      'but the disenfranchised majority keeps happiness and growth low.',
    modifiers: {
      constructionSpeed: 1.3,
      researchSpeed:     0.8,
      tradeIncome:       0.9,
      populationGrowth:  0.9,
      happiness:         -5,
      combatBonus:       1.0,
      buildingCost:      0.9,
      decisionSpeed:     1.0,
    },
  },

  dictatorship: {
    type: 'dictatorship',
    name: 'Dictatorship',
    description:
      'A single ruler or party controls every aspect of society by force. ' +
      'The military benefits enormously from centralised command, but ' +
      'productivity is crushed and trade partners are wary.',
    modifiers: {
      constructionSpeed: 1.1,
      researchSpeed:     0.5,
      tradeIncome:       0.5,
      populationGrowth:  0.7,
      happiness:         -25,
      combatBonus:       1.5,
      buildingCost:      0.8,
      decisionSpeed:     1.3,
    },
  },
};
