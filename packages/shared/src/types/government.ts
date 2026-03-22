/** Government types and their gameplay modifiers. */

export type GovernmentType =
  | 'democracy'
  | 'republic'
  | 'federation'
  | 'autocracy'
  | 'empire'
  | 'theocracy'
  | 'oligarchy'
  | 'military_junta'
  | 'technocracy'
  | 'hive_mind'
  | 'forced_labour'
  | 'dictatorship'
  | 'equality'
  | 'tribal_council';

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
  democracy: {
    type: 'democracy',
    name: 'Democracy',
    description:
      'An elected government balances the interests of the citizenry. ' +
      'Research and trade receive modest boosts, and happiness is generally high, ' +
      'but military prowess suffers from endless debate and compromise.',
    modifiers: {
      constructionSpeed: 1.0,
      researchSpeed:     1.15,
      tradeIncome:       1.2,
      populationGrowth:  1.1,
      happiness:         +10,
      combatBonus:       0.85,
      buildingCost:      1.0,
      decisionSpeed:     0.9,
    },
  },

  republic: {
    type: 'republic',
    name: 'Republic',
    description:
      'A system of law and elected representatives where commerce and industry thrive. ' +
      'Construction and trade are strong, but the burdens of bureaucracy ' +
      'slow population growth slightly.',
    modifiers: {
      constructionSpeed: 1.2,
      researchSpeed:     1.0,
      tradeIncome:       1.15,
      populationGrowth:  0.9,
      happiness:         +5,
      combatBonus:       1.0,
      buildingCost:      0.9,
      decisionSpeed:     1.0,
    },
  },

  federation: {
    type: 'federation',
    name: 'Federation',
    description:
      'A voluntary union of diverse worlds cooperating for the common good. ' +
      'Well-balanced across all areas with small bonuses everywhere, ' +
      'though it never quite excels in any single discipline.',
    modifiers: {
      constructionSpeed: 1.05,
      researchSpeed:     1.05,
      tradeIncome:       1.05,
      populationGrowth:  1.05,
      happiness:         +5,
      combatBonus:       1.05,
      buildingCost:      0.95,
      decisionSpeed:     1.05,
    },
  },

  autocracy: {
    type: 'autocracy',
    name: 'Autocracy',
    description:
      'A single ruler commands the state with absolute authority. ' +
      'Military and construction projects benefit from centralised control, ' +
      'but innovation and commerce wither under the yoke of tyranny.',
    modifiers: {
      constructionSpeed: 1.25,
      researchSpeed:     0.8,
      tradeIncome:       0.8,
      populationGrowth:  1.0,
      happiness:         -10,
      combatBonus:       1.25,
      buildingCost:      0.85,
      decisionSpeed:     1.2,
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

  theocracy: {
    type: 'theocracy',
    name: 'Theocracy',
    description:
      'The clergy rules in the name of divine mandate. Citizens find solace in faith, ' +
      'driving high happiness and population growth, but scientific inquiry ' +
      'is hampered by dogma. Generates a significant faith bonus.',
    modifiers: {
      constructionSpeed: 1.0,
      researchSpeed:     0.7,
      tradeIncome:       0.9,
      populationGrowth:  1.2,
      happiness:         +20,
      combatBonus:       1.1,
      buildingCost:      1.0,
      decisionSpeed:     1.0,
    },
  },

  oligarchy: {
    type: 'oligarchy',
    name: 'Oligarchy',
    description:
      'A cabal of wealthy elites controls the levers of power. ' +
      'The economy and espionage networks are second to none, ' +
      'while military and scientific endeavours remain adequate but uninspired.',
    modifiers: {
      constructionSpeed: 1.0,
      researchSpeed:     1.0,
      tradeIncome:       1.3,
      populationGrowth:  1.0,
      happiness:         -5,
      combatBonus:       1.0,
      buildingCost:      0.85,
      decisionSpeed:     1.1,
    },
  },

  military_junta: {
    type: 'military_junta',
    name: 'Military Junta',
    description:
      'The armed forces have seized control of the state. ' +
      'Combat effectiveness and construction speed are maximised, ' +
      'but research, trade, and civilian happiness are utterly crushed.',
    modifiers: {
      constructionSpeed: 1.4,
      researchSpeed:     0.5,
      tradeIncome:       0.5,
      populationGrowth:  0.8,
      happiness:         -25,
      combatBonus:       1.5,
      buildingCost:      0.7,
      decisionSpeed:     1.3,
    },
  },

  technocracy: {
    type: 'technocracy',
    name: 'Technocracy',
    description:
      'Scientists and engineers govern through evidence and expertise. ' +
      'Research output is unmatched and the economy hums along efficiently, ' +
      'but the population grows slowly and the military is under-resourced.',
    modifiers: {
      constructionSpeed: 1.0,
      researchSpeed:     1.4,
      tradeIncome:       1.15,
      populationGrowth:  0.8,
      happiness:         +5,
      combatBonus:       0.85,
      buildingCost:      0.9,
      decisionSpeed:     1.1,
    },
  },

  hive_mind: {
    type: 'hive_mind',
    name: 'Hive Mind',
    description:
      'A single collective consciousness coordinates every individual. ' +
      'Construction and research benefit from perfect synchronisation, ' +
      'but trade and diplomacy are nearly impossible with outsiders, ' +
      'and the concept of happiness is meaningless.',
    modifiers: {
      constructionSpeed: 1.3,
      researchSpeed:     1.3,
      tradeIncome:       0.3,
      populationGrowth:  1.1,
      happiness:         0,
      combatBonus:       1.1,
      buildingCost:      0.8,
      decisionSpeed:     1.4,
    },
  },

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

  dictatorship: {
    type: 'dictatorship',
    name: 'Dictatorship',
    description:
      'A single ruler or party controls every aspect of society by force. ' +
      'The military benefits enormously from centralised command and decisions ' +
      'are swift, but productivity is crushed and trade partners are wary.',
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

  tribal_council: {
    type: 'tribal_council',
    name: 'Tribal Council',
    description:
      'A council of elders from the founding tribes governs by consensus. ' +
      'Population growth and diplomacy thrive under communal values, ' +
      'but the economy and industrial output lag behind more advanced forms of governance.',
    modifiers: {
      constructionSpeed: 0.8,
      researchSpeed:     0.9,
      tradeIncome:       0.8,
      populationGrowth:  1.3,
      happiness:         +10,
      combatBonus:       1.0,
      buildingCost:      1.1,
      decisionSpeed:     0.85,
    },
  },
};
