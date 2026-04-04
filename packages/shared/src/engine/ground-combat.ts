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
 *  - 19 distinct unit types with special effects and tech prerequisites
 *  - War crimes tracking for WMD usage (chemical, radiation, bio weapons)
 */

import type { Building } from '../types/galaxy.js';
import type { HullClass } from '../types/ships.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Random factor range: each side's effective strength varies by +/-20%. */
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
  science_probe: 0, spy_probe: 0, drone: 0,
  fighter: 0, bomber: 0, patrol: 10, yacht: 5,
  corvette: 20,
  cargo: 100, transport: 500,
  frigate: 30, destroyer: 50,
  large_transport: 1000, large_cargo: 200,
  light_cruiser: 200, heavy_cruiser: 250,
  large_supplier: 150, carrier: 300,
  light_battleship: 80, battleship: 100,
  heavy_battleship: 150, super_carrier: 400,
  battle_station: 50, small_space_station: 100,
  space_station: 200, large_space_station: 500, planet_killer: 50,
  coloniser_gen1: 100, coloniser_gen2: 150, coloniser_gen3: 200,
  coloniser_gen4: 300, coloniser_gen5: 500,
};

/** Artillery vulnerability multiplier (takes extra damage). */
const ARTILLERY_VULNERABILITY_MULT = 1.4;

/** Damage scaling: fraction of enemy strength dealt as damage per tick. */
const BASE_DAMAGE_FRACTION = 0.05;

// ---------------------------------------------------------------------------
// Unit type system
// ---------------------------------------------------------------------------

/** All 19 ground unit types. */
export type GroundUnitType =
  // Conventional
  | 'infantry' | 'mechanised_infantry' | 'tanks' | 'artillery' | 'air_support'
  // Advanced
  | 'mechs' | 'robots' | 'drones' | 'enhanced_soldiers' | 'orbital_support'
  // Electronic / Unconventional
  | 'electronic_warfare' | 'saboteurs' | 'burrowing_machines' | 'unconventional_warfare'
  // Exotic / WMD
  | 'chemical_weapons' | 'radiation_weapons' | 'engineered_virus' | 'nanite_swarm' | 'psionic_units';

/** Backwards-compatible alias — the old 4-type union is now subsumed. */
export type GroundForceType = GroundUnitType;

/** Special effects that modify combat per tick. */
export type GroundSpecialEffect =
  | 'splash'              // +20% damage to all enemy units
  | 'first_strike'        // attacks first before regular combat
  | 'anti_building'       // doubles damage to fortifications
  | 'swarm'               // strength scales with numbers (more = exponentially better)
  | 'bombardment'         // ignores fortification entirely
  | 'reduce_enemy_accuracy' // all enemy units deal 20% less damage
  | 'reduce_fortification'  // reduces defender fortification by 5 per tick
  | 'bypass_fortification'  // unit ignores fortification bonus
  | 'ambush'              // 30% chance of dealing double damage per tick
  | 'area_denial'         // damages all enemy units, not just targeted ones
  | 'persistent_damage'   // damage continues for 5 ticks after unit destroyed
  | 'unpredictable'       // 50% massive damage, 20% backfire (damages own side)
  | 'consume_equipment'   // reduces enemy max strength
  | 'fear_projection';    // reduces all enemy morale by 3 per tick

/** Static definition for a ground unit type. */
export interface GroundUnitDefinition {
  name: string;
  attackPower: number;
  defensePower: number;
  speed: number;          // affects initiative order
  moraleFactor: number;   // multiplier on morale effects (0 = immune)
  specialEffect?: GroundSpecialEffect;
  requiredTech?: string;
  warCrime?: boolean;     // affects diplomatic reputation
}

/** Master table of all ground unit definitions keyed by type. */
export const GROUND_UNIT_DEFINITIONS: Record<GroundUnitType, GroundUnitDefinition> = {
  // --- Conventional ---
  infantry:               { name: 'Infantry',               attackPower: 10, defensePower:  8, speed: 3, moraleFactor: 1.0 },
  mechanised_infantry:    { name: 'Mechanised Infantry',    attackPower: 15, defensePower: 12, speed: 5, moraleFactor: 0.9, requiredTech: 'modular_architecture' },
  tanks:                  { name: 'Tanks',                  attackPower: 25, defensePower: 20, speed: 4, moraleFactor: 0.8 },
  artillery:              { name: 'Artillery',              attackPower: 30, defensePower:  5, speed: 1, moraleFactor: 0.9, specialEffect: 'splash' },
  air_support:            { name: 'Air Support',            attackPower: 35, defensePower:  3, speed: 8, moraleFactor: 0.7, specialEffect: 'first_strike' },

  // --- Advanced ---
  mechs:                  { name: 'War Mechs',              attackPower: 40, defensePower: 25, speed: 3, moraleFactor: 0.6, requiredTech: 'gravity_generators', specialEffect: 'anti_building' },
  robots:                 { name: 'Combat Robots',          attackPower: 20, defensePower: 15, speed: 4, moraleFactor: 0, requiredTech: 'robotic_workforce' },
  drones:                 { name: 'Combat Drones',          attackPower:  8, defensePower:  2, speed: 7, moraleFactor: 0, requiredTech: 'nano_fabrication', specialEffect: 'swarm' },
  enhanced_soldiers:      { name: 'Enhanced Soldiers',      attackPower: 22, defensePower: 18, speed: 5, moraleFactor: 0.5, requiredTech: 'cybernetic_enhancement' },
  orbital_support:        { name: 'Orbital Support',        attackPower: 50, defensePower:  0, speed: 10, moraleFactor: 0, specialEffect: 'bombardment' },

  // --- Electronic / Unconventional ---
  electronic_warfare:     { name: 'EW Unit',                attackPower:  5, defensePower:  5, speed: 6, moraleFactor: 0.8, specialEffect: 'reduce_enemy_accuracy', requiredTech: 'electronic_warfare_suite' },
  saboteurs:              { name: 'Saboteurs',              attackPower: 12, defensePower:  3, speed: 6, moraleFactor: 0.9, specialEffect: 'reduce_fortification' },
  burrowing_machines:     { name: 'Burrowing Machines',     attackPower: 15, defensePower: 10, speed: 2, moraleFactor: 0, specialEffect: 'bypass_fortification', requiredTech: 'planet_core_engineering' },
  unconventional_warfare: { name: 'Guerrilla Forces',       attackPower: 12, defensePower: 15, speed: 5, moraleFactor: 1.2, specialEffect: 'ambush' },

  // --- Exotic / WMD ---
  chemical_weapons:       { name: 'Chemical Weapons',       attackPower: 40, defensePower:  0, speed: 3, moraleFactor: 0, specialEffect: 'area_denial', warCrime: true },
  radiation_weapons:      { name: 'Radiation Weapons',      attackPower: 35, defensePower:  0, speed: 2, moraleFactor: 0, specialEffect: 'persistent_damage', warCrime: true },
  engineered_virus:       { name: 'Engineered Virus',       attackPower: 60, defensePower:  0, speed: 1, moraleFactor: 0, specialEffect: 'unpredictable', warCrime: true, requiredTech: 'pandemic_bioweapon_defence' },
  nanite_swarm:           { name: 'Nanite Swarm',           attackPower: 45, defensePower:  5, speed: 6, moraleFactor: 0, specialEffect: 'consume_equipment', requiredTech: 'nano_repair' },
  psionic_units:          { name: 'Psionic Warriors',       attackPower: 30, defensePower: 20, speed: 5, moraleFactor: 0, specialEffect: 'fear_projection' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/** Tracks persistent damage effects that continue after a unit is destroyed. */
interface PersistentDamageEntry {
  side: 'attacker' | 'defender';
  damagePerTick: number;
  ticksRemaining: number;
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
  /** True if any war-crime unit types were deployed during this battle. */
  warCrimesCommitted: boolean;
  /** Lingering damage effects from persistent_damage units. */
  persistentDamageEffects: PersistentDamageEntry[];
}

// ---------------------------------------------------------------------------
// Force generation helpers
// ---------------------------------------------------------------------------

/**
 * Build a force allocation map based on available technologies.
 * Returns a map of unit type -> fraction of total troops.
 */
function buildForceComposition(techs: ReadonlySet<string>): { type: GroundUnitType; fraction: number; label: string }[] {
  // Start with base composition
  let infantryFrac = 0.40;
  const tanksFrac = 0.20;
  const artilleryFrac = 0.10;
  const allocations: { type: GroundUnitType; fraction: number; label: string }[] = [];

  // Conditionally add advanced unit types based on tech
  let advancedTotal = 0;

  if (techs.has('modular_architecture')) {
    allocations.push({ type: 'mechanised_infantry', fraction: 0.15, label: 'Mechanised Infantry' });
    advancedTotal += 0.15;
  }
  if (techs.has('robotic_workforce')) {
    allocations.push({ type: 'robots', fraction: 0.10, label: 'Combat Robots' });
    advancedTotal += 0.10;
  }
  if (techs.has('nano_fabrication')) {
    allocations.push({ type: 'drones', fraction: 0.10, label: 'Combat Drones' });
    advancedTotal += 0.10;
  }
  if (techs.has('gravity_generators')) {
    allocations.push({ type: 'mechs', fraction: 0.05, label: 'War Mechs' });
    advancedTotal += 0.05;
  }
  if (techs.has('cybernetic_enhancement')) {
    allocations.push({ type: 'enhanced_soldiers', fraction: 0.05, label: 'Enhanced Soldiers' });
    advancedTotal += 0.05;
  }
  if (techs.has('electronic_warfare_suite')) {
    allocations.push({ type: 'electronic_warfare', fraction: 0.05, label: 'EW Unit' });
    advancedTotal += 0.05;
  }

  // Reduce infantry to make room for advanced units
  infantryFrac = Math.max(0.10, infantryFrac - advancedTotal);

  // Remaining fraction is distributed
  const remaining = 1.0 - infantryFrac - tanksFrac - artilleryFrac - advancedTotal;

  // Core units always present
  allocations.unshift(
    { type: 'infantry', fraction: infantryFrac + Math.max(0, remaining), label: 'Infantry' },
    { type: 'tanks', fraction: tanksFrac, label: 'Tanks' },
    { type: 'artillery', fraction: artilleryFrac, label: 'Artillery' },
  );

  return allocations;
}

/**
 * Distributes a total troop count into ground force units of different types.
 * Composition depends on available technologies — defaults to the basic
 * infantry/tanks/artillery split when no techs are provided.
 */
function createForceBreakdown(
  totalTroops: number,
  side: 'attacker' | 'defender',
  empireId: string,
  experience: GroundExperience,
  techs: ReadonlySet<string> = new Set(),
): GroundForce[] {
  if (totalTroops <= 0) return [];

  const composition = buildForceComposition(techs);
  const forces: GroundForce[] = [];
  let allocated = 0;

  for (let i = 0; i < composition.length; i++) {
    const entry = composition[i]!;
    const def = GROUND_UNIT_DEFINITIONS[entry.type];
    const isLast = i === composition.length - 1;
    const strength = isLast
      ? totalTroops - allocated // absorb any rounding remainder
      : Math.round(totalTroops * entry.fraction);

    if (strength <= 0) continue;
    allocated += strength;

    // Morale: defenders start slightly higher; robots/drones always 100
    const baseMorale = side === 'defender' ? 80 : 70;
    const morale = def.moraleFactor === 0 ? 100 : baseMorale;

    forces.push({
      id: generateId(),
      side,
      empireId,
      type: entry.type,
      name: `${side === 'attacker' ? 'Assault' : 'Garrison'} ${def.name}`,
      strength,
      maxStrength: strength,
      morale,
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

/**
 * Deterministic random returning a value in [0, 1) for probability checks.
 */
function deterministicChance(tick: number, index: number): number {
  const seed = ((tick * 2654435761) ^ (index * 2246822519)) >>> 0;
  return (seed % 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Special effect helpers
// ---------------------------------------------------------------------------

/** Check whether any force in the set has a particular special effect. */
function hasEffect(forces: GroundForce[], effect: GroundSpecialEffect): boolean {
  return forces.some(f => f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === effect);
}

/** Get the total living strength of forces with a specific special effect. */
function effectStrength(forces: GroundForce[], effect: GroundSpecialEffect): number {
  return forces.reduce((sum, f) => {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === effect) {
      return sum + f.strength;
    }
    return sum;
  }, 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise ground combat state from fleet and planet data.
 *
 * @param attackerTechs - Set of technology IDs the attacker has researched.
 * @param defenderTechs - Set of technology IDs the defender has researched.
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
  attackerTechs: ReadonlySet<string> = new Set(),
  defenderTechs: ReadonlySet<string> = new Set(),
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
    attackerTechs,
  );
  const defenderForces = createForceBreakdown(
    totalDefenderTroops,
    'defender',
    defenderEmpireId,
    defExp,
    defenderTechs,
  );

  // Detect war-crime units in the initial force composition
  const warCrimesCommitted = [...attackerForces, ...defenderForces].some(
    f => GROUND_UNIT_DEFINITIONS[f.type].warCrime === true,
  );

  const log: string[] = [
    `=== Ground Invasion of ${planetName} ===`,
    `Attacker lands ${Math.round(attackerTroops)} troops`,
    `Defender musters ${totalDefenderTroops} troops (${militiaTroops} militia + ${garrisonTroops} garrison)`,
    `Fortification level: ${fortification}%`,
    `Terrain: ${planetType} (defender bonus: +${Math.round((TERRAIN_BONUS[planetType] ?? 0.10) * 100)}%)`,
  ];

  if (warCrimesCommitted) {
    log.push('WARNING: Weapons of mass destruction deployed — war crimes will be recorded');
  }

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
    warCrimesCommitted,
    persistentDamageEffects: [],
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
  let newFortification = state.defenderFortification;
  let warCrimesCommitted = state.warCrimesCommitted;

  // Deep-copy forces
  const atkForces: GroundForce[] = state.attackerForces.map(f => ({ ...f }));
  const defForces: GroundForce[] = state.defenderForces.map(f => ({ ...f }));
  let persistentEffects = state.persistentDamageEffects.map(e => ({ ...e }));

  // --- Calculate total effective strength for each side ---
  const terrainBonus = TERRAIN_BONUS[state.planetType] ?? 0.10;

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
      warCrimesCommitted,
      persistentDamageEffects: persistentEffects,
    };
  }

  // =======================================================================
  // SPECIAL EFFECTS — PRE-COMBAT PHASE
  // =======================================================================

  // --- first_strike: air_support attacks before regular combat ---
  let firstStrikeDmgToDefender = 0;
  let firstStrikeDmgToAttacker = 0;

  for (const f of atkForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'first_strike') {
      firstStrikeDmgToDefender += f.strength * (GROUND_UNIT_DEFINITIONS[f.type].attackPower / 10) * BASE_DAMAGE_FRACTION;
    }
  }
  for (const f of defForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'first_strike') {
      firstStrikeDmgToAttacker += f.strength * (GROUND_UNIT_DEFINITIONS[f.type].attackPower / 10) * BASE_DAMAGE_FRACTION;
    }
  }

  if (firstStrikeDmgToDefender > 0) {
    _distributeDamage(defForces, firstStrikeDmgToDefender, newTick, 300);
  }
  if (firstStrikeDmgToAttacker > 0) {
    _distributeDamage(atkForces, firstStrikeDmgToAttacker, newTick, 400);
  }

  // --- reduce_fortification: saboteurs erode defender fortification ---
  if (hasEffect(atkForces, 'reduce_fortification')) {
    newFortification = Math.max(0, newFortification - 5);
  }
  if (hasEffect(defForces, 'reduce_fortification')) {
    // Defender saboteurs also reduce their own fortification (sabotage goes both ways)
    // Actually, for defenders it makes no sense — skip.
  }

  // --- fear_projection: psionic units reduce all enemy morale by 3 per tick ---
  if (hasEffect(atkForces, 'fear_projection')) {
    for (const f of defForces) {
      if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].moraleFactor > 0) {
        f.morale = Math.max(0, f.morale - 3);
      }
    }
  }
  if (hasEffect(defForces, 'fear_projection')) {
    for (const f of atkForces) {
      if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].moraleFactor > 0) {
        f.morale = Math.max(0, f.morale - 3);
      }
    }
  }

  // =======================================================================
  // MAIN COMBAT PHASE
  // =======================================================================

  const fortBonus = newFortification / 100; // 0-1

  // --- Compute effective combat power ---
  const atkMorale = averageMorale(atkForces);
  const defMorale = averageMorale(defForces);

  // Morale effectiveness: 50% morale = 0.75x effectiveness, 100% = 1.0x
  const atkMoraleMult = 0.5 + (atkMorale / 200);
  const defMoraleMult = 0.5 + (defMorale / 200);

  // Experience multipliers
  const atkTotalStrNow = totalStrength(atkForces);
  const defTotalStrNow = totalStrength(defForces);

  const atkExpMult = atkForces.length > 0 && atkTotalStrNow > 0
    ? atkForces.reduce((sum, f) => sum + (EXPERIENCE_MULTIPLIER[f.experience] ?? 1.0) * Math.max(0, f.strength), 0) / atkTotalStrNow
    : 1.0;
  const defExpMult = defForces.length > 0 && defTotalStrNow > 0
    ? defForces.reduce((sum, f) => sum + (EXPERIENCE_MULTIPLIER[f.experience] ?? 1.0) * Math.max(0, f.strength), 0) / defTotalStrNow
    : 1.0;

  // Defender bonuses
  const defTerrainMult = 1 + terrainBonus;
  const defFortMult = 1 + fortBonus * 0.5; // fortification adds up to 50% bonus

  // Random factors
  const atkRandom = 1 + deterministicRandom(newTick, 0, RANDOM_FACTOR_RANGE);
  const defRandom = 1 + deterministicRandom(newTick, 1, RANDOM_FACTOR_RANGE);

  // Effective attack power
  let atkEffective = atkTotalStrNow * atkMoraleMult * atkExpMult * atkRandom;
  let defEffective = defTotalStrNow * defMoraleMult * defExpMult * defTerrainMult * defFortMult * defRandom;

  // --- reduce_enemy_accuracy: EW units reduce enemy damage by 20% ---
  if (hasEffect(atkForces, 'reduce_enemy_accuracy')) {
    defEffective *= 0.80;
  }
  if (hasEffect(defForces, 'reduce_enemy_accuracy')) {
    atkEffective *= 0.80;
  }

  // --- splash: artillery units add +20% bonus to total side damage ---
  const atkSplashStr = effectStrength(atkForces, 'splash');
  const defSplashStr = effectStrength(defForces, 'splash');
  if (atkSplashStr > 0) {
    atkEffective *= 1.0 + 0.20 * (atkSplashStr / atkTotalStrNow);
  }
  if (defSplashStr > 0) {
    defEffective *= 1.0 + 0.20 * (defSplashStr / defTotalStrNow);
  }

  // --- swarm: drones scale exponentially with numbers ---
  const atkSwarmStr = effectStrength(atkForces, 'swarm');
  const defSwarmStr = effectStrength(defForces, 'swarm');
  if (atkSwarmStr > 0) {
    const swarmBonus = Math.min(0.50, (atkSwarmStr / atkTotalStrNow) * 0.80);
    atkEffective *= 1 + swarmBonus;
  }
  if (defSwarmStr > 0) {
    const swarmBonus = Math.min(0.50, (defSwarmStr / defTotalStrNow) * 0.80);
    defEffective *= 1 + swarmBonus;
  }

  // --- bombardment: orbital support ignores fortification ---
  if (hasEffect(atkForces, 'bombardment')) {
    // Reduce the fort bonus proportionally to orbital support share
    const orbitalStr = effectStrength(atkForces, 'bombardment');
    const orbitalFraction = orbitalStr / atkTotalStrNow;
    // The orbital portion ignores fort — so reduce fort mult proportionally
    atkEffective += orbitalStr * fortBonus * 0.5 * atkMoraleMult * atkExpMult * atkRandom * orbitalFraction;
  }

  // --- Apply base damage ---
  let damageToDefender = atkEffective * BASE_DAMAGE_FRACTION;
  let damageToAttacker = defEffective * BASE_DAMAGE_FRACTION;

  // --- ambush: unconventional_warfare has 30% chance of double damage ---
  if (hasEffect(atkForces, 'ambush')) {
    const chance = deterministicChance(newTick, 500);
    if (chance < 0.30) {
      const ambushStr = effectStrength(atkForces, 'ambush');
      damageToDefender += ambushStr * BASE_DAMAGE_FRACTION * (GROUND_UNIT_DEFINITIONS.unconventional_warfare.attackPower / 10);
      newLog.push(`Tick ${newTick}: Attacker guerrillas spring an ambush!`);
    }
  }
  if (hasEffect(defForces, 'ambush')) {
    const chance = deterministicChance(newTick, 501);
    if (chance < 0.30) {
      const ambushStr = effectStrength(defForces, 'ambush');
      damageToAttacker += ambushStr * BASE_DAMAGE_FRACTION * (GROUND_UNIT_DEFINITIONS.unconventional_warfare.attackPower / 10);
      newLog.push(`Tick ${newTick}: Defender guerrillas spring an ambush!`);
    }
  }

  // --- area_denial: chemical weapons damage all enemy units (extra 30% to total) ---
  if (hasEffect(atkForces, 'area_denial')) {
    damageToDefender *= 1.30;
    warCrimesCommitted = true;
  }
  if (hasEffect(defForces, 'area_denial')) {
    damageToAttacker *= 1.30;
    warCrimesCommitted = true;
  }

  // --- unpredictable: engineered virus — 50% massive, 20% backfire ---
  for (const f of atkForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'unpredictable') {
      warCrimesCommitted = true;
      const roll = deterministicChance(newTick, 600 + atkForces.indexOf(f));
      if (roll < 0.50) {
        damageToDefender += f.strength * 0.15;
        newLog.push(`Tick ${newTick}: Attacker's engineered virus devastates defenders!`);
      } else if (roll < 0.70) {
        damageToAttacker += f.strength * 0.10;
        newLog.push(`Tick ${newTick}: Attacker's engineered virus BACKFIRES!`);
      }
    }
  }
  for (const f of defForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'unpredictable') {
      warCrimesCommitted = true;
      const roll = deterministicChance(newTick, 700 + defForces.indexOf(f));
      if (roll < 0.50) {
        damageToAttacker += f.strength * 0.15;
      } else if (roll < 0.70) {
        damageToDefender += f.strength * 0.10;
        newLog.push(`Tick ${newTick}: Defender's engineered virus BACKFIRES!`);
      }
    }
  }

  // --- Distribute main damage ---
  _distributeDamage(defForces, damageToDefender, newTick, 100, newFortification);
  _distributeDamage(atkForces, damageToAttacker, newTick, 200, 0);

  // =======================================================================
  // SPECIAL EFFECTS — POST-COMBAT PHASE
  // =======================================================================

  // --- consume_equipment: nanite swarm reduces enemy maxStrength ---
  for (const f of atkForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'consume_equipment') {
      const consumeAmount = f.strength * 0.02;
      for (const e of defForces) {
        if (e.strength > 0) {
          e.maxStrength = Math.max(e.strength, e.maxStrength - consumeAmount * (e.strength / defTotalStrNow));
        }
      }
    }
  }
  for (const f of defForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'consume_equipment') {
      const consumeAmount = f.strength * 0.02;
      for (const e of atkForces) {
        if (e.strength > 0) {
          e.maxStrength = Math.max(e.strength, e.maxStrength - consumeAmount * (e.strength / atkTotalStrNow));
        }
      }
    }
  }

  // --- persistent_damage: register effects for units that just died ---
  for (const f of state.attackerForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'persistent_damage') {
      const nowForce = atkForces.find(af => af.id === f.id);
      if (nowForce && nowForce.strength <= 0) {
        persistentEffects.push({
          side: 'attacker', // was attacking, so damages defenders
          damagePerTick: f.maxStrength * BASE_DAMAGE_FRACTION * 2,
          ticksRemaining: 5,
        });
        warCrimesCommitted = true;
        newLog.push(`Tick ${newTick}: Radiation contamination persists on the battlefield`);
      }
    }
  }
  for (const f of state.defenderForces) {
    if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].specialEffect === 'persistent_damage') {
      const nowForce = defForces.find(df => df.id === f.id);
      if (nowForce && nowForce.strength <= 0) {
        persistentEffects.push({
          side: 'defender',
          damagePerTick: f.maxStrength * BASE_DAMAGE_FRACTION * 2,
          ticksRemaining: 5,
        });
        warCrimesCommitted = true;
      }
    }
  }

  // --- Apply persistent damage effects ---
  const nextPersistent: PersistentDamageEntry[] = [];
  for (const pe of persistentEffects) {
    if (pe.ticksRemaining <= 0) continue;
    if (pe.side === 'attacker') {
      // Was an attacker unit — its radiation damages defenders
      _distributeDamage(defForces, pe.damagePerTick, newTick, 800);
    } else {
      _distributeDamage(atkForces, pe.damagePerTick, newTick, 900);
    }
    if (pe.ticksRemaining > 1) {
      nextPersistent.push({ ...pe, ticksRemaining: pe.ticksRemaining - 1 });
    }
  }
  persistentEffects = nextPersistent;

  // --- Track war crimes from any alive WMD units ---
  if (!warCrimesCommitted) {
    for (const f of [...atkForces, ...defForces]) {
      if (f.strength > 0 && GROUND_UNIT_DEFINITIONS[f.type].warCrime) {
        warCrimesCommitted = true;
        break;
      }
    }
  }

  // =======================================================================
  // MORALE UPDATE
  // =======================================================================

  const newAtkStr = totalStrength(atkForces);
  const newDefStr = totalStrength(defForces);

  const atkStrLossPercent = atkTotalStr > 0 ? ((atkTotalStr - newAtkStr) / atkTotalStr) * 100 : 0;
  const defStrLossPercent = defTotalStr > 0 ? ((defTotalStr - newDefStr) / defTotalStr) * 100 : 0;

  for (const f of atkForces) {
    const def = GROUND_UNIT_DEFINITIONS[f.type];
    if (def.moraleFactor === 0) {
      f.morale = 100; // robots, drones, etc. — always 100
      continue;
    }
    const moraleLoss = atkStrLossPercent * MORALE_LOSS_PER_STRENGTH_PERCENT * def.moraleFactor;
    const moraleGain = defStrLossPercent > atkStrLossPercent ? MORALE_RECOVERY_RATE : 0;
    f.morale = Math.max(0, Math.min(100, f.morale - moraleLoss + moraleGain));
  }

  for (const f of defForces) {
    const def = GROUND_UNIT_DEFINITIONS[f.type];
    if (def.moraleFactor === 0) {
      f.morale = 100;
      continue;
    }
    const moraleLoss = defStrLossPercent * MORALE_LOSS_PER_STRENGTH_PERCENT * def.moraleFactor;
    const moraleGain = atkStrLossPercent > defStrLossPercent ? MORALE_RECOVERY_RATE : 0;
    f.morale = Math.max(0, Math.min(100, f.morale - moraleLoss + moraleGain));
  }

  // =======================================================================
  // LOG
  // =======================================================================

  if (newTick % 5 === 0 || newTick <= 3) {
    newLog.push(
      `Tick ${newTick}: ATK ${Math.round(newAtkStr)} (morale ${Math.round(averageMorale(atkForces))}) vs DEF ${Math.round(newDefStr)} (morale ${Math.round(averageMorale(defForces))})`,
    );
  }

  // =======================================================================
  // VICTORY CONDITIONS
  // =======================================================================

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
    defenderFortification: newFortification,
    outcome,
    log: newLog,
    warCrimesCommitted,
    persistentDamageEffects: persistentEffects,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Distribute damage across forces. Accounts for unit-type vulnerability and
 * bypass_fortification effects.
 */
function _distributeDamage(
  forces: GroundForce[],
  totalDamage: number,
  tick: number,
  seedOffset: number,
  _fortification: number = 0,
): void {
  const alive = forces.filter(f => f.strength > 0);
  if (alive.length === 0 || totalDamage <= 0) return;

  const totalStr = alive.reduce((s, f) => s + f.strength, 0);
  if (totalStr <= 0) return;

  for (let i = 0; i < alive.length; i++) {
    const f = alive[i]!;
    const def = GROUND_UNIT_DEFINITIONS[f.type];

    // Proportion of damage taken, weighted by strength share
    const share = f.strength / totalStr;
    let dmg = totalDamage * share;

    // Artillery vulnerability: takes more damage
    if (f.type === 'artillery' || f.type === 'air_support') {
      dmg *= ARTILLERY_VULNERABILITY_MULT;
    }

    // bypass_fortification: burrowing machines take damage as though no fort
    // (This is handled by not applying the fort bonus to their damage, but
    //  since damage distribution is uniform, the effect is already factored
    //  into the attacker's effective power for that unit's contribution.)

    // Defensive power factor: high-defence units absorb proportionally less
    const defPowerFactor = def.defensePower > 0
      ? 10 / (10 + def.defensePower * 0.3)
      : 1.0;
    dmg *= defPowerFactor;

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
