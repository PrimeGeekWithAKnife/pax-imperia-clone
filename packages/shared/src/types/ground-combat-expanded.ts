/**
 * Expanded ground combat types — XCOM-style tactical grid, unit designer,
 * settlement progression, POWs, insurgency, and auto-resolve eligibility.
 *
 * These types extend the base ground-combat engine (ground-combat.ts) without
 * duplicating its existing GroundUnitType, GroundForce, or GroundExperience.
 * Import those from the engine module when needed alongside these types.
 */

// ---------------------------------------------------------------------------
// Ground unit designer — chassis + weapon + armour + specials
// ---------------------------------------------------------------------------

/** Chassis determines mobility, base HP, and available slot count. */
export type GroundChassis =
  | 'infantry'
  | 'mech'
  | 'drone'
  | 'heavy_walker'
  | 'combat_engineer'
  | 'special_ops'
  | 'orbital_drop'
  | 'nanite_swarm'
  | 'wmd_platform'
  | 'artillery';

/** Weapon system fitted to a ground unit. */
export type GroundWeaponType =
  | 'rifle'
  | 'heavy_machinegun'
  | 'plasma_cannon'
  | 'missile_launcher'
  | 'railgun'
  | 'flamethrower'
  | 'gauss_rifle'
  | 'sonic_disruptor'
  | 'antimatter_charge'
  | 'psionic_amplifier';

/** Armour class fitted to a ground unit. */
export type GroundArmourType =
  | 'none'
  | 'light_composite'
  | 'medium_ceramic'
  | 'heavy_alloy'
  | 'reactive_plating'
  | 'energy_shield'
  | 'nanite_weave';

/** Special module that can be fitted into a ground unit's spare slots. */
export type GroundSpecialModule =
  | 'medkit'                // Heals adjacent friendly units
  | 'cloaking_device'       // Unit is invisible until it fires
  | 'jump_jets'             // Can leap over obstacles and elevation changes
  | 'breaching_charge'      // Destroys cover and fortifications
  | 'emp_grenade'           // Disables mechanical / drone enemies for 2 turns
  | 'sensor_suite'          // Reveals hidden enemies in adjacent cells
  | 'shield_projector'      // Extends personal shield to adjacent friendlies
  | 'combat_stim'           // Temporary boost to movement and accuracy
  | 'repair_kit'            // Restores HP to mechanical chassis
  | 'hacking_module';       // Can turn enemy drones to your side

/** Chassis base statistics. */
export interface GroundChassisStats {
  chassis: GroundChassis;
  name: string;
  baseHitPoints: number;
  baseMovement: number;       // Grid cells per turn
  specialSlots: number;       // How many GroundSpecialModules can be fitted
  baseCost: number;           // Production cost
  requiredTech: string | null;
}

/** Full ground unit design — analogous to ShipDesign for space vessels. */
export interface GroundUnitDesign {
  id: string;
  name: string;
  empireId: string;
  chassis: GroundChassis;
  weapon: GroundWeaponType;
  armour: GroundArmourType;
  specials: GroundSpecialModule[];
  /** Computed effective stats (derived from chassis + weapon + armour). */
  effectiveStats: {
    hitPoints: number;
    attack: number;
    defence: number;
    movement: number;
    accuracy: number;           // 0-1
    range: number;              // Grid cells
  };
  totalCost: number;
  requiredTech: string | null;  // Highest tech prerequisite from components
}

/** Master table of chassis base statistics. */
export const GROUND_CHASSIS_STATS: Record<GroundChassis, GroundChassisStats> = {
  infantry:        { chassis: 'infantry',        name: 'Infantry',        baseHitPoints: 50,  baseMovement: 3, specialSlots: 1, baseCost: 10,  requiredTech: null },
  mech:            { chassis: 'mech',            name: 'War Mech',        baseHitPoints: 120, baseMovement: 2, specialSlots: 2, baseCost: 60,  requiredTech: 'gravity_generators' },
  drone:           { chassis: 'drone',           name: 'Combat Drone',    baseHitPoints: 25,  baseMovement: 5, specialSlots: 1, baseCost: 15,  requiredTech: 'nano_fabrication' },
  heavy_walker:    { chassis: 'heavy_walker',    name: 'Heavy Walker',    baseHitPoints: 200, baseMovement: 1, specialSlots: 3, baseCost: 100, requiredTech: 'gravity_generators' },
  combat_engineer: { chassis: 'combat_engineer', name: 'Combat Engineer', baseHitPoints: 40,  baseMovement: 3, specialSlots: 2, baseCost: 20,  requiredTech: null },
  special_ops:     { chassis: 'special_ops',     name: 'Special Ops',     baseHitPoints: 35,  baseMovement: 4, specialSlots: 2, baseCost: 30,  requiredTech: 'cybernetic_enhancement' },
  orbital_drop:    { chassis: 'orbital_drop',    name: 'Orbital Drop',    baseHitPoints: 60,  baseMovement: 2, specialSlots: 1, baseCost: 45,  requiredTech: 'modular_architecture' },
  nanite_swarm:    { chassis: 'nanite_swarm',    name: 'Nanite Swarm',    baseHitPoints: 15,  baseMovement: 6, specialSlots: 0, baseCost: 50,  requiredTech: 'nano_repair' },
  wmd_platform:    { chassis: 'wmd_platform',    name: 'WMD Platform',    baseHitPoints: 80,  baseMovement: 1, specialSlots: 1, baseCost: 150, requiredTech: 'planet_core_engineering' },
  artillery:       { chassis: 'artillery',       name: 'Artillery',       baseHitPoints: 45,  baseMovement: 1, specialSlots: 1, baseCost: 35,  requiredTech: null },
};

// ---------------------------------------------------------------------------
// Tactical grid — XCOM-style battlefield
// ---------------------------------------------------------------------------

/** Type of terrain in a grid cell. */
export type TerrainType =
  | 'open'
  | 'forest'
  | 'rubble'
  | 'building'
  | 'water'
  | 'cliff'
  | 'crater'
  | 'fortification'
  | 'lava'
  | 'ice';

/** Hazard that may be present in a terrain cell. */
export type TerrainHazard =
  | 'none'
  | 'fire'
  | 'toxic_gas'
  | 'radiation'
  | 'explosive'
  | 'electrified'
  | 'unstable_ground';

/** A single cell on the tactical grid. */
export interface TerrainCell {
  /** Grid coordinates. */
  x: number;
  y: number;
  /** Cover value (0 = none, 0.5 = half cover, 1.0 = full cover). */
  coverValue: number;
  /** Elevation level (0 = ground, positive = raised, negative = subterranean). */
  elevation: number;
  /** Whether ground units can move through this cell. */
  passable: boolean;
  /** Terrain type for visual rendering and gameplay effects. */
  terrain: TerrainType;
  /** Environmental hazard present in this cell (if any). */
  hazard: TerrainHazard;
  /** Damage per turn dealt to units standing in this cell (from hazards). */
  hazardDamagePerTurn: number;
  /** Whether this cell blocks line of sight. */
  blocksLineOfSight: boolean;
  /** Whether the cell is currently visible to the active side. */
  visible: boolean;
  /** Whether the cell has been explored (fog of war). */
  explored: boolean;
}

/** The full tactical grid for a ground battle. */
export interface TacticalGrid {
  /** Grid width in cells. */
  width: number;
  /** Grid height in cells. */
  height: number;
  /** Flat array of cells, indexed as [y * width + x]. */
  cells: TerrainCell[];
  /** Planet type this grid was generated for (affects terrain distribution). */
  planetType: string;
}

// ---------------------------------------------------------------------------
// Weather conditions
// ---------------------------------------------------------------------------

/** Weather conditions that affect the entire battlefield. */
export type WeatherCondition =
  | 'clear'
  | 'sandstorm'
  | 'blizzard'
  | 'volcanic_eruption'
  | 'lightning_storm'
  | 'toxic_cloud'
  | 'seismic_event';

/** Weather modifiers applied to all units on the battlefield. */
export interface WeatherEffect {
  condition: WeatherCondition;
  /** Accuracy penalty applied to all ranged attacks (0-1, 0 = no penalty). */
  accuracyPenalty: number;
  /** Movement speed multiplier (1.0 = normal, 0.5 = half speed). */
  movementMultiplier: number;
  /** Passive damage per turn to all exposed units (0 = none). */
  passiveDamage: number;
  /** Sensor/visibility range reduction in grid cells. */
  visibilityReduction: number;
  /** Duration in turns (0 = permanent for the battle). */
  durationTurns: number;
}

/** Default weather effects for each condition. */
export const WEATHER_EFFECTS: Record<WeatherCondition, Omit<WeatherEffect, 'condition'>> = {
  clear:              { accuracyPenalty: 0,    movementMultiplier: 1.0,  passiveDamage: 0,  visibilityReduction: 0, durationTurns: 0 },
  sandstorm:          { accuracyPenalty: 0.3,  movementMultiplier: 0.7,  passiveDamage: 1,  visibilityReduction: 3, durationTurns: 5 },
  blizzard:           { accuracyPenalty: 0.25, movementMultiplier: 0.6,  passiveDamage: 2,  visibilityReduction: 4, durationTurns: 6 },
  volcanic_eruption:  { accuracyPenalty: 0.2,  movementMultiplier: 0.5,  passiveDamage: 5,  visibilityReduction: 5, durationTurns: 3 },
  lightning_storm:    { accuracyPenalty: 0.15, movementMultiplier: 0.9,  passiveDamage: 3,  visibilityReduction: 2, durationTurns: 4 },
  toxic_cloud:        { accuracyPenalty: 0.1,  movementMultiplier: 0.8,  passiveDamage: 4,  visibilityReduction: 3, durationTurns: 5 },
  seismic_event:      { accuracyPenalty: 0.35, movementMultiplier: 0.4,  passiveDamage: 2,  visibilityReduction: 1, durationTurns: 2 },
};

// ---------------------------------------------------------------------------
// Prisoners of war
// ---------------------------------------------------------------------------

/** What the captor chooses to do with prisoners. */
export type PowDisposition =
  | 'release'           // Free immediately — improves diplomatic standing
  | 'forced_labour'     // Put to work — boosts production, hurts diplomacy
  | 'imprison'          // Hold for future prisoner exchange
  | 'recruit'           // Attempt to turn them into loyal soldiers (risky)
  | 'exchange';         // Trade for own captured soldiers

/** A captured group of prisoners of war. */
export interface PrisonerOfWar {
  id: string;
  /** Empire that captured these prisoners. */
  captorEmpireId: string;
  /** Empire the prisoners originally belonged to. */
  originEmpireId: string;
  /** Number of captured personnel. */
  count: number;
  /** Current disposition. */
  disposition: PowDisposition;
  /** Planet ID where the prisoners are held (if imprisoned). */
  heldAtPlanetId?: string;
  /** Turn they were captured. */
  capturedOnTurn: number;
  /** Morale of the prisoners (0-100). Low morale = escape attempts. */
  morale: number;
  /** If 'recruit' disposition, probability of successful conversion (0-1). */
  recruitSuccessChance?: number;
  /** Diplomatic opinion modifier applied while prisoners are held. */
  diplomaticPenalty: number;
}

// ---------------------------------------------------------------------------
// Insurgency — post-conquest guerrilla resistance
// ---------------------------------------------------------------------------

/** State of an insurgency on a conquered planet. */
export interface InsurgencyState {
  /** Planet ID where the insurgency is active. */
  planetId: string;
  /** Empire ID of the occupying power. */
  occupierEmpireId: string;
  /** Empire ID of the insurgent (original owner) population. */
  insurgentEmpireId: string;
  /** Guerrilla strength as a fraction of original military strength (0-1). */
  guerrillaStrength: number;
  /** Average number of sabotage events per 10 turns. */
  sabotageFrequency: number;
  /** Support from the local population (0-1). Higher = more recruits. */
  populationSupport: number;
  /** Whether the insurgency is receiving covert aid from another empire. */
  foreignBacking: boolean;
  /** Empire IDs providing covert support (if any). */
  foreignBackers: string[];
  /** Production penalty applied to the planet due to insurgent activity (0-1). */
  productionPenalty: number;
  /** Number of turns since the planet was conquered. */
  turnsSinceConquest: number;
  /** Whether the insurgency has been fully suppressed. */
  suppressed: boolean;
}

// ---------------------------------------------------------------------------
// Settlement progression
// ---------------------------------------------------------------------------

/** Settlement tier — determines available buildings and population capacity. */
export type SettlementTier =
  | 'habitat'
  | 'settlement'
  | 'colony'
  | 'small_city'
  | 'city'
  | 'metropolis'
  | 'megatropolis'
  | 'planetary';

/** Thresholds and capabilities unlocked at each settlement tier. */
export interface SettlementTierDefinition {
  tier: SettlementTier;
  /** Display name for the UI. */
  name: string;
  /** Minimum population to reach this tier. */
  minPopulation: number;
  /** Maximum population this tier can support. */
  maxPopulation: number;
  /** Maximum number of building slots available. */
  maxBuildingSlots: number;
  /** Whether orbital structures can be built at this tier. */
  orbitalStructuresAllowed: boolean;
  /** Whether underground expansion is available. */
  undergroundExpansionAllowed: boolean;
  /** Base production output multiplier. */
  productionMultiplier: number;
  /** Base research output multiplier. */
  researchMultiplier: number;
  /** Defence bonus from settlement infrastructure. */
  defenceBonus: number;
}

/** Master table of settlement tier thresholds and capabilities. */
export const SETTLEMENT_TIER_THRESHOLDS: Record<SettlementTier, SettlementTierDefinition> = {
  habitat:       { tier: 'habitat',       name: 'Habitat',       minPopulation: 0,          maxPopulation: 500,         maxBuildingSlots: 2,  orbitalStructuresAllowed: false, undergroundExpansionAllowed: false, productionMultiplier: 0.5, researchMultiplier: 0.3, defenceBonus: 0 },
  settlement:    { tier: 'settlement',    name: 'Settlement',    minPopulation: 500,        maxPopulation: 5_000,       maxBuildingSlots: 4,  orbitalStructuresAllowed: false, undergroundExpansionAllowed: false, productionMultiplier: 0.7, researchMultiplier: 0.5, defenceBonus: 5 },
  colony:        { tier: 'colony',        name: 'Colony',        minPopulation: 5_000,      maxPopulation: 50_000,      maxBuildingSlots: 6,  orbitalStructuresAllowed: true,  undergroundExpansionAllowed: false, productionMultiplier: 1.0, researchMultiplier: 0.8, defenceBonus: 10 },
  small_city:    { tier: 'small_city',    name: 'Small City',    minPopulation: 50_000,     maxPopulation: 500_000,     maxBuildingSlots: 8,  orbitalStructuresAllowed: true,  undergroundExpansionAllowed: true,  productionMultiplier: 1.2, researchMultiplier: 1.0, defenceBonus: 15 },
  city:          { tier: 'city',          name: 'City',          minPopulation: 500_000,    maxPopulation: 5_000_000,   maxBuildingSlots: 10, orbitalStructuresAllowed: true,  undergroundExpansionAllowed: true,  productionMultiplier: 1.4, researchMultiplier: 1.2, defenceBonus: 20 },
  metropolis:    { tier: 'metropolis',    name: 'Metropolis',    minPopulation: 5_000_000,  maxPopulation: 50_000_000,  maxBuildingSlots: 14, orbitalStructuresAllowed: true,  undergroundExpansionAllowed: true,  productionMultiplier: 1.6, researchMultiplier: 1.5, defenceBonus: 30 },
  megatropolis:  { tier: 'megatropolis',  name: 'Megatropolis',  minPopulation: 50_000_000, maxPopulation: 500_000_000, maxBuildingSlots: 18, orbitalStructuresAllowed: true,  undergroundExpansionAllowed: true,  productionMultiplier: 1.8, researchMultiplier: 1.8, defenceBonus: 40 },
  planetary:     { tier: 'planetary',     name: 'Planetary',     minPopulation: 500_000_000, maxPopulation: Infinity,   maxBuildingSlots: 24, orbitalStructuresAllowed: true,  undergroundExpansionAllowed: true,  productionMultiplier: 2.0, researchMultiplier: 2.0, defenceBonus: 50 },
};

/** Ordered list of settlement tiers for progression logic. */
export const SETTLEMENT_TIER_ORDER: readonly SettlementTier[] = [
  'habitat', 'settlement', 'colony', 'small_city', 'city',
  'metropolis', 'megatropolis', 'planetary',
];

/** Determine the settlement tier for a given population. */
export function getSettlementTier(population: number): SettlementTier {
  for (let i = SETTLEMENT_TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = SETTLEMENT_TIER_ORDER[i];
    if (population >= SETTLEMENT_TIER_THRESHOLDS[tier].minPopulation) {
      return tier;
    }
  }
  return 'habitat';
}

// ---------------------------------------------------------------------------
// Auto-resolve eligibility
// ---------------------------------------------------------------------------

/** Tracks how many times a particular battle configuration has been fought,
 *  allowing the player to auto-resolve after meeting the threshold. */
export interface AutoResolveEligibility {
  /** Hash of the battle configuration (attacker composition + defender composition + terrain). */
  battleTypeHash: string;
  /** Human-readable description of the battle type (e.g. "3x Infantry vs 2x Mech on Terran"). */
  description: string;
  /** Number of times this battle type has been fought manually. */
  timesFought: number;
  /** Minimum manual fights required before auto-resolve is unlocked. */
  minimumForAutoResolve: number;
  /** Whether auto-resolve is currently available. */
  eligible: boolean;
  /** Average outcome from manual fights (for auto-resolve prediction). */
  averageOutcome: {
    attackerWinRate: number;         // 0-1
    averageAttackerLossFraction: number;  // 0-1
    averageDefenderLossFraction: number;  // 0-1
    averageTurnsToResolve: number;
  };
}

/** Default minimum manual battles before auto-resolve unlocks. */
export const AUTO_RESOLVE_MINIMUM_FIGHTS = 10;

/** Create an initial auto-resolve tracking entry for a new battle type. */
export function createAutoResolveEntry(battleTypeHash: string, description: string): AutoResolveEligibility {
  return {
    battleTypeHash,
    description,
    timesFought: 0,
    minimumForAutoResolve: AUTO_RESOLVE_MINIMUM_FIGHTS,
    eligible: false,
    averageOutcome: {
      attackerWinRate: 0,
      averageAttackerLossFraction: 0,
      averageDefenderLossFraction: 0,
      averageTurnsToResolve: 0,
    },
  };
}

/** Update auto-resolve tracking after a manual battle is completed. */
export function updateAutoResolveEntry(
  entry: AutoResolveEligibility,
  result: { attackerWon: boolean; attackerLossFraction: number; defenderLossFraction: number; turnsElapsed: number },
): AutoResolveEligibility {
  const n = entry.timesFought;
  const newN = n + 1;
  const prev = entry.averageOutcome;

  return {
    ...entry,
    timesFought: newN,
    eligible: newN >= entry.minimumForAutoResolve,
    averageOutcome: {
      attackerWinRate: (prev.attackerWinRate * n + (result.attackerWon ? 1 : 0)) / newN,
      averageAttackerLossFraction: (prev.averageAttackerLossFraction * n + result.attackerLossFraction) / newN,
      averageDefenderLossFraction: (prev.averageDefenderLossFraction * n + result.defenderLossFraction) / newN,
      averageTurnsToResolve: (prev.averageTurnsToResolve * n + result.turnsElapsed) / newN,
    },
  };
}
