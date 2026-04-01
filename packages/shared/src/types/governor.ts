/** Governor types — assigned to planets, providing production modifiers */

export interface Governor {
  id: string;
  name: string;
  planetId: string;
  empireId: string;
  /** Turns this governor has served */
  turnsServed: number;
  /** Total lifespan in turns (1000-3000) */
  lifespan: number;
  /** Stat modifiers — each is a percentage bonus/penalty (-20 to +20) */
  modifiers: GovernorModifiers;
  /** Personality flavour text */
  trait: string;
  /** Accumulated experience 0-100, grows with service */
  experience: number;
  /** Whether this governor auto-manages the construction queue */
  autoManage: boolean;
}

export interface GovernorModifiers {
  manufacturing: number;    // -10 to +20
  research: number;         // -10 to +20
  energyProduction: number; // -10 to +20
  populationGrowth: number; // -10 to +15
  happiness: number;        // -5 to +15
  construction: number;     // -10 to +20
  mining: number;           // -10 to +20
  trade: number;            // -10 to +15
}
