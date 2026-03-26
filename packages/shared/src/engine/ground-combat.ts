/**
 * Ground combat engine — pure functions for planetary invasion after orbital
 * defences are cleared.
 *
 * Ground combat is simpler than space combat: it models aggregate forces rather
 * than individual ship-to-ship engagements. The player watches an automated
 * battle with force bars, a scrolling log, and a final outcome.
 *
 * Design:
 *  - Pure / immutable-per-tick: processGroundTick returns a new state
 *  - Attacker troops come from transport capacity of the invading fleet
 *  - Defender troops come from planet population (militia) + military buildings
 *  - Terrain, fortification and experience affect combat effectiveness
 *  - Morale drops from losses; collapse below 10 triggers defeat
 */

import type { Building } from '../types/galaxy.js';
import type { HullClass } from '../types/ships.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Random factor range: each side's effective strength varies by ±20%. */
const RANDOM_FACTOR_RANGE = 0.20;

/** Morale threshold below which a side collapses and loses. */
export const MORALE_COLLAPSE_THRESHOLD = 10;

/** Base morale loss per % of strength lost in a tick. */
const MORALE_LOSS_PER_STRENGTH_PERCENT = 0.8;

/** Morale recovery per tick when winning (outperforming the enemy). */
const MORALE_RECOVERY_RATE = 0.5;

/** Home terrain bonus by planet type. */
export const TERRAIN_BONUS: Record<string, number> = {
  terran: 0.20,
  ocean: 0.25,
  desert: 0.30,
  ice: 0.40,
  volcanic: 0.40,
  gas_giant: 0.10,
  barren: 0.10,
  toxic: 0.35,
};

/** Defence bonus per defence_grid building level. */
const DEFENSE_GRID_BONUS_PER_LEVEL = 5;

/** Defence bonus per military_academy building level. */
const MILITARY_ACADEMY_BONUS_PER_LEVEL = 3;

/** Militia troops per unit of population (pop / 100). */
export const MILITIA_PER_POPULATION = 0.01;

/** Additional garrison troops per defence_grid level. */
const GARRISON_PER_DEFENSE_GRID_LEVEL = 50;

/** Additional trained troops per military_academy level. */
const GARRISON_PER_ACADEMY_LEVEL = 30;

/** Experience multipliers for combat effectiveness. */
export const EXPERIENCE_MULTIPLIER: Record<string, number> = {
  green: 0.8,
  regular: 1.0,
  veteran: 1.2,
  elite: 1.5,
};

/** Transport capacity by hull class — how many troops each ship can carry. */
export const TRANSPORT_CAPACITY: Record<HullClass, number> = {
  scout: 10,
  destroyer: 50,
  cruiser: 200,
  transport: 500,
  carrier: 300,
  battleship: 100,
  coloniser: 100,
  dreadnought: 150,
  battle_station: 50,
  deep_space_probe: 0,
};

/** Artillery splash damage multiplier (hits multiple units). */
const ARTILLERY_SPLASH_MULT = 1.5;

/** Artillery vulnerability multiplier (takes extra damage). */
const ARTILLERY_VULNERABILITY_MULT = 1.4;

/** Damage scaling: fraction of enemy strength dealt as damage per tick. */
const BASE_DAMAGE_FRACTION = 0.05;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GroundForceType = 'infantry' | 'armour' | 'artillery' | 'special';
export type GroundExperience = 'green' | 'regular' | 'veteran' | 'elite';

export interface GroundForce {
  id: string;
  side: 'attacker' | 'defender';
  empireId: string;
  type: GroundForceType;
  name: string;
  strength: number;
  maxStrength: number;
  morale: number; // 0-100
  experience: GroundExperience;
}

export interface GroundCombatState {
  tick: number;
  attackerForces: GroundForce[];
  defenderForces: GroundForce[];
  planetName: string;
  planetType: string;
  defenderFortification: number; // 0-100, from buildings
  outcome: 'attacker_wins' | 'defender_wins' | null;
  log: string[];
  /** Empire ID of the attacking side. */
  attackerEmpireId: string;
  /** Empire ID of the defending side. */
  defenderEmpireId: string;
}

// ---------------------------------------------------------------------------
// Force generation helpers
// ---------------------------------------------------------------------------

/**
 * Distributes a total troop count into ground force units of different types.
 * Composition: 60% infantry, 25% armour, 15% artillery.
 */
function createForceBreakdown(
  totalTroops: number,
  side: 'attacker' | 'defender',
  empireId: string,
  experience: GroundExperience,
): GroundForce[] {
  if (totalTroops <= 0) return [];

  const forces: GroundForce[] = [];

  const infantryStrength = Math.round(totalTroops * 0.60);
  const armourStrength = Math.round(totalTroops * 0.25);
  const artilleryStrength = totalTroops - infantryStrength - armourStrength;

  if (infantryStrength > 0) {
    forces.push({
      id: generateId(),
      side,
      empireId,
      type: 'infantry',
      name: side === 'attacker' ? 'Assault Infantry' : 'Garrison Infantry',
      strength: infantryStrength,
      maxStrength: infantryStrength,
      morale: side === 'defender' ? 80 : 70, // defenders start with slightly higher morale
      experience,
    });
  }

  if (armourStrength > 0) {
    forces.push({
      id: generateId(),
      side,
      empireId,
      type: 'armour',
      name: side === 'attacker' ? 'Assault Armour' : 'Defence Armour',
      strength: armourStrength,
      maxStrength: armourStrength,
      morale: side === 'defender' ? 85 : 75,
      experience,
    });
  }

  if (artilleryStrength > 0) {
    forces.push({
      id: generateId(),
      side,
      empireId,
      type: 'artillery',
      name: side === 'attacker' ? 'Siege Artillery' : 'Defence Artillery',
      strength: artilleryStrength,
      maxStrength: artilleryStrength,
      morale: side === 'defender' ? 75 : 65,
      experience,
    });
  }

  return forces;
}

/**
 * Calculate fortification level (0-100) from defender buildings.
 */
function calculateFortification(buildings: Building[]): number {
  let fort = 0;
  for (const b of buildings) {
    if (b.type === 'defense_grid') {
      fort += DEFENSE_GRID_BONUS_PER_LEVEL * b.level;
    }
    if (b.type === 'military_academy') {
      fort += MILITARY_ACADEMY_BONUS_PER_LEVEL * b.level;
    }
  }
  return Math.min(100, fort);
}

/**
 * Calculate additional garrison troops from military buildings.
 */
function calculateGarrison(buildings: Building[]): number {
  let garrison = 0;
  for (const b of buildings) {
    if (b.type === 'defense_grid') {
      garrison += GARRISON_PER_DEFENSE_GRID_LEVEL * b.level;
    }
    if (b.type === 'military_academy') {
      garrison += GARRISON_PER_ACADEMY_LEVEL * b.level;
    }
  }
  return garrison;
}

// ---------------------------------------------------------------------------
// Deterministic random (seeded by tick for reproducibility in tests)
// ---------------------------------------------------------------------------

/**
 * A simple deterministic random factor in [-range, +range] based on tick and
 * an index. Uses a basic hash to distribute values.
 */
function deterministicRandom(tick: number, index: number, range: number): number {
  // Simple hash-based pseudo-random
  const seed = ((tick * 2654435761) ^ (index * 2246822519)) >>> 0;
  const normalised = (seed % 10000) / 10000; // 0 to ~1
  return (normalised * 2 - 1) * range;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise ground combat state from fleet and planet data.
 */
export function initializeGroundCombat(
  planetName: string,
  planetType: string,
  attackerTroops: number,
  defenderPopulation: number,
  defenderBuildings: Building[],
  attackerExperience: string,
  defenderExperience: string,
  attackerEmpireId: string = 'attacker',
  defenderEmpireId: string = 'defender',
): GroundCombatState {
  const atkExp = (attackerExperience as GroundExperience) || 'regular';
  const defExp = (defenderExperience as GroundExperience) || 'green';

  // Defender troops: militia from population + garrison from buildings
  const militiaTroops = Math.round(defenderPopulation * MILITIA_PER_POPULATION);
  const garrisonTroops = calculateGarrison(defenderBuildings);
  const totalDefenderTroops = Math.max(1, militiaTroops + garrisonTroops);

  const fortification = calculateFortification(defenderBuildings);

  const attackerForces = createForceBreakdown(
    Math.max(1, Math.round(attackerTroops)),
    'attacker',
    attackerEmpireId,
    atkExp,
  );
  const defenderForces = createForceBreakdown(
    totalDefenderTroops,
    'defender',
    defenderEmpireId,
    defExp,
  );

  const log: string[] = [
    `=== Ground Invasion of ${planetName} ===`,
    `Attacker lands ${Math.round(attackerTroops)} troops`,
    `Defender musters ${totalDefenderTroops} troops (${militiaTroops} militia + ${garrisonTroops} garrison)`,
    `Fortification level: ${fortification}%`,
    `Terrain: ${planetType} (defender bonus: +${Math.round((TERRAIN_BONUS[planetType] ?? 0.10) * 100)}%)`,
  ];

  return {
    tick: 0,
    attackerForces,
    defenderForces,
    planetName,
    planetType,
    defenderFortification: fortification,
    outcome: null,
    log,
    attackerEmpireId,
    defenderEmpireId,
  };
}

/**
 * Calculate the total remaining strength of a set of forces.
 */
export function totalStrength(forces: GroundForce[]): number {
  return forces.reduce((sum, f) => sum + Math.max(0, f.strength), 0);
}

/**
 * Calculate the average morale of a set of forces, weighted by strength.
 */
export function averageMorale(forces: GroundForce[]): number {
  const total = totalStrength(forces);
  if (total <= 0) return 0;
  return forces.reduce((sum, f) => sum + f.morale * Math.max(0, f.strength), 0) / total;
}

/**
 * Process one tick of ground combat. Returns a new state object.
 */
export function processGroundTick(state: GroundCombatState): GroundCombatState {
  // If outcome already decided, return as-is
  if (state.outcome !== null) return state;

  const newTick = state.tick + 1;
  const newLog = [...state.log];

  // Deep-copy forces
  const atkForces: GroundForce[] = state.attackerForces.map(f => ({ ...f }));
  const defForces: GroundForce[] = state.defenderForces.map(f => ({ ...f }));

  // --- Calculate total effective strength for each side ---
  const terrainBonus = TERRAIN_BONUS[state.planetType] ?? 0.10;
  const fortBonus = state.defenderFortification / 100; // 0-1

  const atkTotalStr = totalStrength(atkForces);
  const defTotalStr = totalStrength(defForces);

  if (atkTotalStr <= 0 || defTotalStr <= 0) {
    // Immediate resolution
    const outcome: 'attacker_wins' | 'defender_wins' =
      atkTotalStr <= 0 ? 'defender_wins' : 'attacker_wins';
    newLog.push(
      outcome === 'attacker_wins'
        ? `Tick ${newTick}: Defender forces eliminated — PLANET CAPTURED`
        : `Tick ${newTick}: Attacker forces eliminated — INVASION REPELLED`,
    );
    return {
      ...state,
      tick: newTick,
      attackerForces: atkForces,
      defenderForces: defForces,
      outcome,
      log: newLog,
    };
  }

  // --- Compute effective combat power ---
  const atkMorale = averageMorale(atkForces);
  const defMorale = averageMorale(defForces);

  // Morale effectiveness: 50% morale = 0.75x effectiveness, 100% = 1.0x
  const atkMoraleMult = 0.5 + (atkMorale / 200);
  const defMoraleMult = 0.5 + (defMorale / 200);

  // Experience multipliers
  const atkExpMult = atkForces.length > 0
    ? atkForces.reduce((sum, f) => sum + (EXPERIENCE_MULTIPLIER[f.experience] ?? 1.0) * f.strength, 0) / atkTotalStr
    : 1.0;
  const defExpMult = defForces.length > 0
    ? defForces.reduce((sum, f) => sum + (EXPERIENCE_MULTIPLIER[f.experience] ?? 1.0) * f.strength, 0) / defTotalStr
    : 1.0;

  // Defender bonuses
  const defTerrainMult = 1 + terrainBonus;
  const defFortMult = 1 + fortBonus * 0.5; // fortification adds up to 50% bonus

  // Random factors
  const atkRandom = 1 + deterministicRandom(newTick, 0, RANDOM_FACTOR_RANGE);
  const defRandom = 1 + deterministicRandom(newTick, 1, RANDOM_FACTOR_RANGE);

  // Effective attack power
  const atkEffective = atkTotalStr * atkMoraleMult * atkExpMult * atkRandom;
  const defEffective = defTotalStr * defMoraleMult * defExpMult * defTerrainMult * defFortMult * defRandom;

  // --- Apply damage ---
  // Damage dealt is proportional to the *enemy's* effective power
  const damageToDefender = atkEffective * BASE_DAMAGE_FRACTION;
  const damageToAttacker = defEffective * BASE_DAMAGE_FRACTION;

  // Distribute damage across forces
  _distributeDamage(defForces, damageToDefender, newTick, 100);
  _distributeDamage(atkForces, damageToAttacker, newTick, 200);

  // --- Update morale ---
  const newAtkStr = totalStrength(atkForces);
  const newDefStr = totalStrength(defForces);

  const atkStrLossPercent = atkTotalStr > 0 ? ((atkTotalStr - newAtkStr) / atkTotalStr) * 100 : 0;
  const defStrLossPercent = defTotalStr > 0 ? ((defTotalStr - newDefStr) / defTotalStr) * 100 : 0;

  for (const f of atkForces) {
    const moraleLoss = atkStrLossPercent * MORALE_LOSS_PER_STRENGTH_PERCENT;
    const moraleGain = defStrLossPercent > atkStrLossPercent ? MORALE_RECOVERY_RATE : 0;
    f.morale = Math.max(0, Math.min(100, f.morale - moraleLoss + moraleGain));
  }

  for (const f of defForces) {
    const moraleLoss = defStrLossPercent * MORALE_LOSS_PER_STRENGTH_PERCENT;
    const moraleGain = atkStrLossPercent > defStrLossPercent ? MORALE_RECOVERY_RATE : 0;
    f.morale = Math.max(0, Math.min(100, f.morale - moraleLoss + moraleGain));
  }

  // --- Log entry ---
  if (newTick % 5 === 0 || newTick <= 3) {
    newLog.push(
      `Tick ${newTick}: ATK ${Math.round(newAtkStr)} (morale ${Math.round(averageMorale(atkForces))}) vs DEF ${Math.round(newDefStr)} (morale ${Math.round(averageMorale(defForces))})`,
    );
  }

  // --- Check victory conditions ---
  const atkAlive = atkForces.filter(f => f.strength > 0);
  const defAlive = defForces.filter(f => f.strength > 0);
  const finalAtkStr = totalStrength(atkAlive);
  const finalDefStr = totalStrength(defAlive);
  const finalAtkMorale = averageMorale(atkAlive);
  const finalDefMorale = averageMorale(defAlive);

  let outcome: 'attacker_wins' | 'defender_wins' | null = null;

  if (finalDefStr <= 0 || (finalDefMorale < MORALE_COLLAPSE_THRESHOLD && finalDefStr > 0)) {
    outcome = 'attacker_wins';
    newLog.push(
      finalDefStr <= 0
        ? `Tick ${newTick}: Defender forces destroyed — PLANET CAPTURED`
        : `Tick ${newTick}: Defender morale collapses — PLANET CAPTURED`,
    );
  } else if (finalAtkStr <= 0 || (finalAtkMorale < MORALE_COLLAPSE_THRESHOLD && finalAtkStr > 0)) {
    outcome = 'defender_wins';
    newLog.push(
      finalAtkStr <= 0
        ? `Tick ${newTick}: Attacker forces destroyed — INVASION REPELLED`
        : `Tick ${newTick}: Attacker morale collapses — INVASION REPELLED`,
    );
  }

  return {
    ...state,
    tick: newTick,
    attackerForces: atkForces,
    defenderForces: defForces,
    outcome,
    log: newLog,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Distribute damage across forces. Artillery takes extra damage,
 * artillery also deals splash (handled in the attacker calculation).
 */
function _distributeDamage(
  forces: GroundForce[],
  totalDamage: number,
  tick: number,
  seedOffset: number,
): void {
  const alive = forces.filter(f => f.strength > 0);
  if (alive.length === 0 || totalDamage <= 0) return;

  const totalStr = alive.reduce((s, f) => s + f.strength, 0);
  if (totalStr <= 0) return;

  for (let i = 0; i < alive.length; i++) {
    const f = alive[i]!;
    // Proportion of damage taken, weighted by strength share
    const share = f.strength / totalStr;
    let dmg = totalDamage * share;

    // Artillery vulnerability: takes more damage
    if (f.type === 'artillery') {
      dmg *= ARTILLERY_VULNERABILITY_MULT;
    }

    // Add slight randomness to per-unit damage
    const jitter = 1 + deterministicRandom(tick, seedOffset + i, 0.10);
    dmg *= jitter;

    f.strength = Math.max(0, f.strength - dmg);
  }
}

/**
 * Calculate total attacker troops from fleet ship hull classes.
 */
export function calculateTransportCapacity(hullClasses: HullClass[]): number {
  return hullClasses.reduce((sum, hc) => sum + (TRANSPORT_CAPACITY[hc] ?? 0), 0);
}
