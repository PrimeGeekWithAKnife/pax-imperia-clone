/**
 * Empire leader engine — pure functions for generating, ageing, and rating
 * empire-wide leaders (Head of Research, Spy Master, Admiral, General).
 *
 * Follows the same pattern as governors.ts: seeded PRNG, name generation,
 * trait pool, modifier rolls, lifespan and experience tracking.
 *
 * All functions are pure / side-effect-free. Callers must persist state.
 */

import type { EmpireLeader, LeaderRole } from '../types/leaders.js';
import { LEADER_MODIFIER_KEYS } from '../types/leaders.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Name generation word lists
// ---------------------------------------------------------------------------

const NAME_PREFIXES = [
  'Aldric', 'Brenna', 'Corvin', 'Darian', 'Elara', 'Faelan', 'Gavric',
  'Helion', 'Isara', 'Joreth', 'Kaelin', 'Lorath', 'Maelis', 'Nyreth',
  'Orvaan', 'Pyrell', 'Questin', 'Raevan', 'Sylara', 'Tavion', 'Ulric',
  'Verath', 'Wystan', 'Xevian', 'Ysolde', 'Zareth', 'Ashwyn', 'Belvir',
  'Cassian', 'Draven', 'Esmera', 'Fenric', 'Gareth', 'Halvard', 'Idara',
  'Jareth', 'Kestral', 'Lyndara', 'Mordain', 'Nethris',
];

const NAME_SUFFIXES = [
  'an', 'ar', 'el', 'en', 'eth', 'ik', 'in', 'ion', 'is', 'ix',
  'on', 'or', 'os', 'us', 'ael', 'arn', 'eld', 'eon', 'esh', 'iel',
  'ith', 'ius', 'nar', 'nel', 'nis', 'nor', 'oth', 'val', 'ven', 'zel',
];

// ---------------------------------------------------------------------------
// Trait pools — one per role for thematic flavour
// ---------------------------------------------------------------------------

const TRAIT_POOLS: Record<LeaderRole, string[]> = {
  head_of_research: [
    'Brilliant theoretician',
    'Methodical experimentalist',
    'Obsessive perfectionist',
    'Visionary polymath',
    'Cautious peer reviewer',
    'Radical innovator',
    'Cross-disciplinary thinker',
    'Quiet genius',
    'Inspiring mentor',
    'Data-driven empiricist',
    'Eccentric but effective',
    'Former field researcher',
    'Published in every journal',
    'Prototype enthusiast',
    'Grants whisperer',
  ],
  spy_master: [
    'Shadow operative',
    'Former double agent',
    'Paranoid but perceptive',
    'Master of disguise',
    'Cold-blooded analyst',
    'Network builder',
    'Ruthless interrogator',
    'Charm offensive specialist',
    'Counter-espionage veteran',
    'Signals intelligence expert',
    'Loyal to the empire alone',
    'Blackmail connoisseur',
    'Patient web spinner',
    'Ghost protocol',
    'Never seen in person',
  ],
  admiral: [
    'Bold fleet tactician',
    'Defensive strategist',
    'Cavalry charge specialist',
    'Siege warfare expert',
    'Hit-and-run raider',
    'Logistics mastermind',
    'Morale-boosting commander',
    'Cold and calculating',
    'Former pirate hunter',
    'Academy top graduate',
    'Battle-scarred veteran',
    'Carrier doctrine champion',
    'Torpedo alley veteran',
    'Flanking manoeuvre expert',
    'Cautious but undefeated',
  ],
  general: [
    'Frontline commander',
    'Fortification specialist',
    'Shock and awe tactician',
    'Hearts and minds operator',
    'Urban warfare expert',
    'Scorched earth pragmatist',
    'Elite forces commander',
    'Guerrilla warfare veteran',
    'Planetary siege engineer',
    'Garrison optimiser',
    'Drop-pod assault pioneer',
    'Occupation administrator',
    'Defensive line architect',
    'Morale-first officer',
    'Decorated war hero',
  ],
};

// ---------------------------------------------------------------------------
// Seeded pseudo-random helper (same as governors.ts)
// ---------------------------------------------------------------------------

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// ---------------------------------------------------------------------------
// Public: generateLeader
// ---------------------------------------------------------------------------

/**
 * Generate a random empire leader for the given role.
 * Modifier distribution is skewed positive — one stat gets a specialism boost.
 */
export function generateLeader(
  empireId: string,
  role: LeaderRole,
  seed?: number,
): EmpireLeader {
  const callRng = seed !== undefined ? makeRng(seed) : () => Math.random();

  // Name
  const useDoubleBarrel = callRng() < 0.3;
  const name = useDoubleBarrel
    ? `${randPick(callRng, NAME_PREFIXES)} ${randPick(callRng, NAME_PREFIXES)}${randPick(callRng, NAME_SUFFIXES)}`
    : `${randPick(callRng, NAME_PREFIXES)}${randPick(callRng, NAME_SUFFIXES)}`;

  // Lifespan: 1000-3000 turns
  const lifespan = randInt(callRng, 1000, 3000);

  // Trait
  const trait = randPick(callRng, TRAIT_POOLS[role]);

  // Modifiers: base roll -5 to +15, then one specialism +3 to +8
  const keys = LEADER_MODIFIER_KEYS[role];
  const modifiers: Record<string, number> = {};
  for (const key of keys) {
    modifiers[key] = randInt(callRng, -5, 15);
  }
  // Specialism: boost one random stat
  const specialKey = randPick(callRng, keys);
  modifiers[specialKey] = Math.min((modifiers[specialKey] ?? 0) + randInt(callRng, 3, 8), 20);
  // Clamp all to [-10, 20]
  for (const key of keys) {
    modifiers[key] = Math.max(-10, Math.min(20, modifiers[key] ?? 0));
  }

  return {
    id: generateId(),
    empireId,
    role,
    name,
    trait,
    experience: 0,
    turnsServed: 0,
    lifespan,
    modifiers,
  };
}

// ---------------------------------------------------------------------------
// Public: generateLeaderCandidates
// ---------------------------------------------------------------------------

/**
 * Generate a pool of replacement candidates for a given role.
 */
export function generateLeaderCandidates(
  empireId: string,
  role: LeaderRole,
  count = 5,
): EmpireLeader[] {
  const n = Math.min(10, Math.max(1, count));
  const candidates: EmpireLeader[] = [];
  for (let i = 0; i < n; i++) {
    candidates.push(generateLeader(empireId, role, Date.now() + i * 1337));
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Public: processLeadersTick
// ---------------------------------------------------------------------------

/**
 * Age every leader by one tick and identify those that have died.
 */
export function processLeadersTick(leaders: EmpireLeader[]): {
  updated: EmpireLeader[];
  died: EmpireLeader[];
} {
  const updated: EmpireLeader[] = [];
  const died: EmpireLeader[] = [];

  for (const leader of leaders) {
    const aged: EmpireLeader = { ...leader, turnsServed: leader.turnsServed + 1 };
    if (aged.turnsServed >= aged.lifespan) {
      died.push(aged);
    } else {
      updated.push(aged);
    }
  }

  return { updated, died };
}

// ---------------------------------------------------------------------------
// Public: tickLeaderExperience
// ---------------------------------------------------------------------------

/**
 * Increment a leader's experience by 1 (capped at 100).
 * Call once per tick for each active leader.
 */
export function tickLeaderExperience(leader: EmpireLeader): EmpireLeader {
  if (leader.experience >= 100) return leader;
  // Faster gain in early career, tapering off
  const gain = leader.experience < 50 ? 0.05 : 0.02;
  return { ...leader, experience: Math.min(100, leader.experience + gain) };
}

// ---------------------------------------------------------------------------
// Public: calculateLeaderRating
// ---------------------------------------------------------------------------

/**
 * Overall leader rating 0-100 (60% modifiers, 40% experience).
 */
export function calculateLeaderRating(leader: EmpireLeader): number {
  const keys = LEADER_MODIFIER_KEYS[leader.role];
  // Modifier score: average of all modifiers, normalised to 0-100
  // Range is -10 to +20, so shift by 10 and divide by 30
  let modTotal = 0;
  for (const key of keys) {
    modTotal += (leader.modifiers[key] ?? 0) + 10; // shift to 0-30
  }
  const modScore = (modTotal / (keys.length * 30)) * 100;
  return Math.round(modScore * 0.6 + leader.experience * 0.4);
}

// ---------------------------------------------------------------------------
// Public: generateStartingLeaders
// ---------------------------------------------------------------------------

/**
 * Generate one leader per role for a new empire.
 */
export function generateStartingLeaders(empireId: string, seed?: number): EmpireLeader[] {
  const roles: LeaderRole[] = ['head_of_research', 'spy_master', 'admiral', 'general'];
  return roles.map((role, i) =>
    generateLeader(empireId, role, seed !== undefined ? seed + i * 7919 : undefined),
  );
}
