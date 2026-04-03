/** Empire-wide leadership roles — singular characters with production modifiers */

export type LeaderRole = 'head_of_research' | 'spy_master' | 'admiral' | 'general';

export interface EmpireLeader {
  id: string;
  empireId: string;
  role: LeaderRole;
  name: string;
  /** Personality flavour text */
  trait: string;
  /** Accumulated experience 0-100, grows with service */
  experience: number;
  /** Turns this leader has served */
  turnsServed: number;
  /** Total lifespan in turns (1000-3000) */
  lifespan: number;
  /** Role-specific percentage modifiers (-10 to +20) */
  modifiers: Record<string, number>;
}

/** Human-readable labels for each role */
export const LEADER_ROLE_LABELS: Record<LeaderRole, string> = {
  head_of_research: 'Head of Research',
  spy_master: 'Spy Master',
  admiral: 'Admiral',
  general: 'General',
};

/** Modifier keys used by each role */
export const LEADER_MODIFIER_KEYS: Record<LeaderRole, string[]> = {
  head_of_research: ['researchSpeed', 'breakthroughChance', 'techCostReduction'],
  spy_master: ['agentSkill', 'counterIntel', 'missionSuccess'],
  admiral: ['fleetSpeed', 'combatPower', 'retreatEfficiency'],
  general: ['groundCombat', 'siegeEfficiency', 'garrisonStrength'],
};

/** Human-readable labels for modifier keys */
export const LEADER_MODIFIER_LABELS: Record<string, string> = {
  researchSpeed: 'Research Speed',
  breakthroughChance: 'Breakthrough Chance',
  techCostReduction: 'Tech Cost Reduction',
  agentSkill: 'Agent Skill',
  counterIntel: 'Counter-Intelligence',
  missionSuccess: 'Mission Success',
  fleetSpeed: 'Fleet Speed',
  combatPower: 'Combat Power',
  retreatEfficiency: 'Retreat Efficiency',
  groundCombat: 'Ground Combat',
  siegeEfficiency: 'Siege Efficiency',
  garrisonStrength: 'Garrison Strength',
};

/** All four empire-wide leader roles */
export const ALL_LEADER_ROLES: LeaderRole[] = [
  'head_of_research', 'spy_master', 'admiral', 'general',
];
