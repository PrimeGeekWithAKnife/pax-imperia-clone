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
      'To live in a democracy is to live in perpetual negotiation. Every voice counts, ' +
      'every grievance is heard, and the machinery of state moves at the speed of consensus. ' +
      'Citizens are free to pursue knowledge and commerce, and the resulting society is ' +
      'prosperous and content — but when the warships of a rival appear on the horizon, ' +
      'committees must convene, votes must be taken, and by the time a response is authorised, ' +
      'the moment for decisive action has often passed. The price of freedom is indecision.',
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
      'The republic is the art of pragmatism elevated to governance. Elected representatives ' +
      'speak for the people, but the true power lies in the legal frameworks they build — ' +
      'contract law, trade regulation, property rights. Industry flourishes because builders ' +
      'know their work will be protected. Construction is swift and costs are kept low by ' +
      'competitive markets. Yet the machinery of representation grinds slowly; families grow ' +
      'cautious in a society that measures worth in productivity, and population expansion ' +
      'lags behind less structured civilisations.',
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
      'A federation is an act of faith — the belief that many voices, freely joined, produce ' +
      'something stronger than any single world could achieve alone. Member systems retain ' +
      'their autonomy while pooling resources, knowledge, and defence. The result is a ' +
      'civilisation that does everything reasonably well and nothing brilliantly. It is the ' +
      'government of compromise, of shared burdens and shared rewards. Critics call it ' +
      'mediocrity by committee. Advocates call it the only form of governance that ' +
      'survives contact with genuine diversity.',
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
      'One voice. One will. One vision imposed upon an entire civilisation. The autocrat ' +
      'commands and the state obeys — warships are built on schedule, infrastructure projects ' +
      'complete without delays, and decisions arrive with terrifying speed. But the cost ' +
      'is measured in silence: laboratories grow quiet when free inquiry is dangerous, ' +
      'merchants avoid markets where the rules change on a whim, and the populace endures ' +
      'rather than thrives. Autocracy is efficient. It is also, in some deep and irreversible ' +
      'way, a civilisation holding its breath.',
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
      'The empire is dynasty made manifest — bloodlines stretching back centuries, ' +
      'each heir inheriting not just power but an entire mythology of divine right and manifest ' +
      'destiny. The war machine is magnificent: disciplined, loyal, relentless. Construction ' +
      'projects bear the sovereign\'s name and are completed as acts of devotion. Yet the same ' +
      'rigid hierarchy that makes the legions so formidable strangles innovation and trade. ' +
      'Why would a merchant risk a bold venture when the crown could seize it on a whim? ' +
      'Why would a scientist publish a finding that contradicts imperial doctrine? The empire ' +
      'endures through strength, but strength alone has never been enough.',
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
      'In a theocracy, the state and the sacred are one. Every law is a commandment, ' +
      'every public work an offering, every war a crusade. The faithful find profound meaning ' +
      'in their labour, and morale soars — families are large, communities are tight-knit, ' +
      'and dissent is rare because doubt itself is heresy. Population grows quickly in a ' +
      'society that views children as blessings. But the laboratories suffer: when the answer ' +
      'to every question is already written in scripture, curiosity becomes an act of ' +
      'rebellion. Trade partners, too, grow wary of a civilisation that measures value ' +
      'in devotion rather than credits.',
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
      'Behind every elected official, behind every public institution, the same families ' +
      'pull the strings. The oligarchy does not advertise itself — it wears the mask of ' +
      'whatever system the public finds palatable — but the wealth always flows upward, and ' +
      'with it, power. Trade income is extraordinary because the ruling class has perfected ' +
      'the machinery of profit. Buildings are cheap because the oligarchs own the supply ' +
      'chains. But for the ordinary citizen, life is a treadmill: comfortable enough to ' +
      'prevent revolt, constrained enough to prevent competition. Science and the military ' +
      'function, but never threaten the established order.',
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
      'The generals took power because they could, and they keep it because no one is ' +
      'permitted to challenge them. Every resource is channelled into the war machine — ' +
      'shipyards operate around the clock, military academies churn out officers, and ' +
      'construction projects serve strategic objectives first and civilian needs never. ' +
      'The result is a formidable fighting force backed by rapid industrial output, but ' +
      'the society behind it is hollowed out. Scientists flee or are conscripted. Merchants ' +
      'are taxed into irrelevance. The population lives under curfew, under surveillance, ' +
      'under the boot. Morale is abysmal. But the junta does not need happy citizens. ' +
      'It needs obedient ones.',
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
      'In a technocracy, competence is the only qualification for power. Leaders are selected ' +
      'by examination, policy is determined by data, and resources flow to wherever the models ' +
      'say they will produce the greatest return. Research output is extraordinary — the best ' +
      'minds govern and the best minds innovate, often simultaneously. The economy runs with ' +
      'clockwork efficiency. But there is a coldness to a society that reduces every question ' +
      'to an optimisation problem. Population growth is low because children are a statistically ' +
      'suboptimal investment. The military is functional but uninspired, because warfare is ' +
      'irrational and irrational things receive minimal funding.',
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
      'There is no dissent in a hive mind because there is no one to dissent. Every ' +
      'individual is a limb of the same organism, every thought shared, every action ' +
      'coordinated without friction or delay. Construction and research proceed with ' +
      'inhuman efficiency — a million workers moving as one, a million researchers thinking ' +
      'as one. But the hive cannot trade, because trade requires two parties, and the hive ' +
      'recognises only itself and everything else. Diplomacy is an alien concept — not ' +
      'difficult, but genuinely incomprehensible. Happiness, sadness, individual desire: ' +
      'these words have no translation. The hive simply is.',
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
      'This is governance stripped of all pretence. The many toil so the few may rule. ' +
      'Construction is breathtakingly fast and staggeringly cheap because the workers ' +
      'are not paid — they are compelled, under threat of punishment, to build until they ' +
      'break. The monuments are impressive. The cost in suffering is incalculable. Population ' +
      'growth collapses because families cannot sustain themselves, and what research exists ' +
      'serves only the apparatus of control. Trade is nearly impossible — few civilisations ' +
      'will deal openly with slavers. This is a government that builds empires on the backs ' +
      'of the desperate. It is efficient. It is also an atrocity.',
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
      'The dictator rules not through tradition or divine right but through naked force ' +
      'of will. The secret police ensure loyalty. The propaganda machine ensures belief. ' +
      'The military is lavishly funded and fanatically loyal, and decisions are made with ' +
      'a speed that democracies can only envy. But the society beneath the dictator\'s boot ' +
      'is brittle: scientists are watched, merchants are extorted, and population growth ' +
      'withers as citizens flee or simply stop hoping. Other civilisations trade reluctantly ' +
      'with dictatorships, always aware that contracts are worth less than the dictator\'s mood.',
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
      'True equality is beautiful and maddening in equal measure. Every citizen votes on ' +
      'every decision — not through representatives, but directly, on everything from fleet ' +
      'deployments to park bench placement. The result is a society of extraordinary morale ' +
      'where every individual feels genuinely heard, and research thrives because ideas are ' +
      'judged on merit alone. But the cost is paralysis: construction crawls because every ' +
      'blueprint requires a referendum, and fleets respond to threats at the speed of public ' +
      'debate. In peacetime, equality is paradise. In wartime, it is a liability that idealists ' +
      'must defend with something other than speed.',
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
      'Before there were nations, there were tribes. The tribal council preserves that ' +
      'ancient covenant: elders from each founding lineage sit together, debate, and reach ' +
      'consensus before any action is taken. The bonds of kinship run deep, and population ' +
      'growth is strong because community raises every child. Diplomacy comes naturally to ' +
      'a people who have practised negotiation since before they had cities. But the modern ' +
      'galaxy demands industries and economies that tribal structures struggle to support — ' +
      'construction is slow, trade is informal, and the tools of war are built with ' +
      'determination rather than industrial might.',
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
