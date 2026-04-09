/**
 * Tactical combat engine — pure functions for the interactive combat scene.
 *
 * Unlike the auto-resolve combat engine (combat.ts), this module models
 * real-time ship movement, facing, weapon cooldowns, projectile travel, and
 * beam effects on a 2-D battlefield. All functions are side-effect free and
 * return new state objects.
 *
 * Design goals:
 *  - Pure / immutable-per-tick: processTacticalTick returns a new state
 *  - Ships have position, facing, speed and turn rate
 *  - Weapons fire beams (instant hit) or projectiles (travel time)
 *  - Explicit ship orders: attack, defend, move, flee, idle
 *  - Sensor range determines detection radius
 */

import type { Fleet, Ship, ShipDesign, ShipComponent, ComponentType, HullTemplate, HullClass } from '../types/ships.js';
import { generateId } from '../utils/id.js';
import { HULL_TEMPLATE_BY_CLASS } from '../../data/ships/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BATTLEFIELD_WIDTH = 1600;
export const BATTLEFIELD_HEIGHT = 1000;
export const PROJECTILE_SPEED = 16;

/** Default speed for ships without an engine component. */
const DEFAULT_SPEED = 3.0;
/** Default turn rate (radians per tick) for ships without specific data. */
const DEFAULT_TURN_RATE = 0.08;
/** Default sensor range in battlefield units. */
const DEFAULT_SENSOR_RANGE = 200;
/** Multiplier to convert component range stat to battlefield units. */
const RANGE_TO_BATTLEFIELD = 20;
/** Fraction of max weapon range at which ships stop approaching. */
const ENGAGE_RANGE_FRACTION = 0.8;
/** Duration in ticks that a beam effect persists (visual only). */
const BEAM_EFFECT_DURATION = 3;
/** Fraction of max shields recharged per tick. */
const SHIELD_RECHARGE_FRACTION = 0.005;
/** Armour absorbs up to this fraction of remaining damage per hit. */
const ARMOUR_ABSORPTION_FRACTION = 0.25;
/** Armour degrades by this fraction of the absorbed amount per hit. */
const ARMOUR_DEGRADATION_FACTOR = 0.5;
/** Maximum catastrophic failure probability (at 0% hull). */
const CATASTROPHIC_FAILURE_MAX = 0.1;

/** Missile initial speed (pixels per tick). */
const MISSILE_INITIAL_SPEED = 4;
/** Missile maximum speed (pixels per tick). */
const MISSILE_MAX_SPEED = 17;
/** Missile acceleration (pixels per tick^2). */
const MISSILE_ACCELERATION = 1.5;
/** Hit radius for missile collision detection. */
const MISSILE_HIT_RADIUS = 12;
/** Fuel ticks for missiles — go inert after this many ticks in flight. */
const MISSILE_FUEL_TICKS = 60;

/** Default ammo for missile weapons. */
const MISSILE_DEFAULT_AMMO = 8;
/** Default ammo for projectile weapons. */
const PROJECTILE_DEFAULT_AMMO = 400;
/** Default ammo for point defence weapons. */
const POINT_DEFENSE_DEFAULT_AMMO = 300;

// --- Ballistic projectile accuracy + burst constants -------------------------

/** Number of projectile rounds per weapon cooldown cycle (burst salvo). */
const PROJECTILE_BURST_COUNT: Record<string, number> = {
  kinetic_cannon: 8, battering_ram: 3, mass_driver: 5, gauss_cannon: 6,
  antimatter_accelerator: 5, singularity_driver: 4, fusion_autocannon: 12,
  scatter_cannon: 15, coilgun_array: 10, siege_cannon: 2,
  plasma_slugthrower: 8, hypermass_projector: 3, khazari_forge_breaker: 3,
};
/** Fallback burst count for weapon types not in PROJECTILE_BURST_COUNT. */
const DEFAULT_BURST_COUNT = 8;

/** Minimum spread half-angle (radians) at accuracy 100. */
const ACCURACY_TO_SPREAD_MIN = 0.02;
/** Maximum spread half-angle (radians) at accuracy 0. */
const ACCURACY_TO_SPREAD_MAX = 0.12;
/** Extra spread per (distance / maxRange) ratio. */
const RANGE_SPREAD_FACTOR = 0.04;
/** Extra spread per unit of target speed (battlefield units/tick). */
const TARGET_SPEED_SPREAD_FACTOR = 0.003;
/** Extra spread per unit of own movement speed. */
const OWN_MOVEMENT_SPREAD_FACTOR = 0.002;

/** Crew experience modifiers for accuracy cone spread (lower = tighter). */
const EXP_SPREAD_MOD: Record<string, number> = {
  recruit: 1.40, trained: 1.20, regular: 1.00, seasoned: 0.92,
  veteran: 0.85, hardened: 0.78, elite: 0.70, ace: 0.62, legendary: 0.55,
};

/** Crew experience quality for lead prediction (0 = no lead, 1 = perfect). */
const EXP_LEAD_QUALITY: Record<string, number> = {
  recruit: 0.0, trained: 0.2, regular: 0.4, seasoned: 0.55,
  veteran: 0.70, hardened: 0.82, elite: 0.90, ace: 0.95, legendary: 1.0,
};

/** Per-missile-type physics and ammo profiles.
 *  turnRate = max radians/tick. Early missiles fly wide arcs (~2°/tick),
 *  advanced missiles make sharp turns (~10°/tick). */
const MISSILE_PROFILES: Record<string, { initSpeed: number; maxSpeed: number; accel: number; ammo: number; cooldown: number; turnRate: number }> = {
  // nano_atomic age — crude guidance, wide arcs only
  basic_missile:       { initSpeed: 5,  maxSpeed: 17, accel: 1.8, ammo: 12, cooldown: 8,  turnRate: 0.04 },  // ~2.3°/tick
  hv_missile:          { initSpeed: 7,  maxSpeed: 18, accel: 2.2, ammo: 8,  cooldown: 10, turnRate: 0.03 },  // fast = less agile
  basic_torpedo:       { initSpeed: 4,  maxSpeed: 16, accel: 1.2, ammo: 6,  cooldown: 20, turnRate: 0.035 },
  torpedo_rack:        { initSpeed: 4,  maxSpeed: 16, accel: 1.2, ammo: 6,  cooldown: 20, turnRate: 0.035 },
  icbm_torpedo:        { initSpeed: 3,  maxSpeed: 15, accel: 0.8, ammo: 1,  cooldown: 40, turnRate: 0.02 },  // heavy, sluggish
  // fusion age — improved seekers, moderate turns
  guided_torpedo:      { initSpeed: 6,  maxSpeed: 20, accel: 2.2, ammo: 4,  cooldown: 20, turnRate: 0.07 },  // ~4°/tick
  cluster_missile:     { initSpeed: 6,  maxSpeed: 19, accel: 2.0, ammo: 4,  cooldown: 15, turnRate: 0.06 },
  emp_torpedo:         { initSpeed: 6,  maxSpeed: 21, accel: 1.8, ammo: 3,  cooldown: 20, turnRate: 0.065 },
  // nano_fusion age — advanced guidance, good agility
  fusion_torpedo:      { initSpeed: 8,  maxSpeed: 25, accel: 2.8, ammo: 3,  cooldown: 18, turnRate: 0.10 },  // ~5.7°/tick
  swarm_missiles:      { initSpeed: 10, maxSpeed: 26, accel: 3.0, ammo: 16, cooldown: 15, turnRate: 0.09 },
  bunker_buster:       { initSpeed: 5,  maxSpeed: 23, accel: 1.8, ammo: 2,  cooldown: 25, turnRate: 0.08 },  // heavy warhead
  // anti_matter age — near-perfect tracking
  antimatter_torpedo:  { initSpeed: 9,  maxSpeed: 27, accel: 3.5, ammo: 2,  cooldown: 18, turnRate: 0.13 },  // ~7.5°/tick
  void_seeker:         { initSpeed: 10, maxSpeed: 28, accel: 4.0, ammo: 2,  cooldown: 18, turnRate: 0.15 },  // designed to track
  // singularity age — near-impossible to evade
  singularity_torpedo: { initSpeed: 12, maxSpeed: 30, accel: 5.0, ammo: 1,  cooldown: 20, turnRate: 0.18 },  // ~10°/tick
  phase_torpedo:       { initSpeed: 14, maxSpeed: 30, accel: 5.0, ammo: 1,  cooldown: 20, turnRate: 0.20 },  // best guidance
};

/** Default salvo count per missile component (how many missiles per volley). */
const MISSILE_SALVO_DEFAULTS: Record<string, number> = {
  basic_missile:  3,  // missile battery fires a spread
  hv_missile:     2,  // high-velocity pair
  swarm_missiles: 8,  // swarm pod
  // Torpedoes / heavy ordnance default to 1 (handled by fallback)
};

/** Duration in ticks that a point defence effect persists (visual only). */
const PD_EFFECT_DURATION = 2;

/** Fighter speed in battlefield units per tick. */
const FIGHTER_SPEED = 6;
/** Default fighter HP. */
const FIGHTER_DEFAULT_HEALTH = 10;
/** Range at which fighters begin strafing runs (battlefield units). */
const FIGHTER_STRAFE_RANGE = 30;
/** Fraction of fighter damage dealt per tick during strafing. */
const FIGHTER_STRAFE_DAMAGE_FRACTION = 0.3;
/** Number of fighters launched per fire cycle. */
const FIGHTER_LAUNCH_BATCH = 2;
/** PD accuracy multiplier against fighters (harder to hit than missiles). */
const PD_VS_FIGHTER_ACCURACY_MULT = 0.5;
/** Distance at which a returning fighter docks with its carrier. */
const FIGHTER_DOCK_RANGE = 15;

// --- Friendly fire constants ------------------------------------------------
/** Radius within which a stray projectile can hit a bystander ship. */
export const FRIENDLY_FIRE_PROJECTILE_RADIUS = 15;
/** Radius within which a beam can clip a bystander ship. */
export const FRIENDLY_FIRE_BEAM_RADIUS = 10;
/** Probability of a beam hitting a ship it passes close to. */
export const BEAM_COLLATERAL_CHANCE = 0.15;

// --- Environment hazard constants -------------------------------------------
/** Minimum number of asteroids placed on the battlefield. */
const ASTEROID_MIN = 3;
/** Maximum number of asteroids placed on the battlefield. */
const ASTEROID_MAX = 8;
/** Minimum number of nebulae placed on the battlefield. */
const NEBULA_MIN = 0;
/** Maximum number of nebulae placed on the battlefield. */
const NEBULA_MAX = 2;
/** Asteroid radius range. */
const ASTEROID_RADIUS_MIN = 20;
const ASTEROID_RADIUS_MAX = 50;
/** Nebula radius range. */
const NEBULA_RADIUS_MIN = 80;
const NEBULA_RADIUS_MAX = 150;
/** Dodge bonus when inside an asteroid field. */
export const ASTEROID_DODGE_BONUS = 0.30;
/** Chance that a projectile/missile passing through an asteroid is absorbed. */
export const ASTEROID_INTERCEPT_CHANCE = 0.20;
/** Factor by which beam damage is reduced when firing through a nebula. */
export const NEBULA_BEAM_DAMAGE_FACTOR = 0.50;
/** Factor by which sensor range is reduced inside a nebula. */
export const NEBULA_SENSOR_FACTOR = 0.50;
/** Damage per tick dealt to ships inside a debris field. */
/** Base chance per tick of taking a debris hit while inside a debris field. */
const DEBRIS_HIT_CHANCE = 0.15;
/** Damage multiplier applied to the debris field's damage rating. */
const DEBRIS_DAMAGE_VARIANCE = 0.5; // ±50%
/** Safe distance from spawn areas where environment features are not placed. */
const ENVIRONMENT_SPAWN_MARGIN = 250;

// --- Ship collision radii (hard body, per hull class) ----------------------
// Collision half-extents in battlefield units per hull class.
// Three axes: halfWidth (port-starboard), halfHeight (vertical), halfLength (fore-aft).
// Derived from HULL_SCALE × max species proportion × shipScale / BF_SCALE / 2.
// Using the widest species proportions (w=0.45, h=0.35) as worst case so no
// species' geometry pokes through the collision boundary.
interface CollisionExtents { halfWidth: number; halfHeight: number; halfLength: number }
const COLLISION_EXTENTS: Partial<Record<HullClass, CollisionExtents>> = {
  science_probe:      { halfWidth: 2,   halfHeight: 2,   halfLength: 3   },
  spy_probe:          { halfWidth: 2,   halfHeight: 2,   halfLength: 3   },
  drone:              { halfWidth: 2,   halfHeight: 2,   halfLength: 3   },
  fighter:            { halfWidth: 3,   halfHeight: 2,   halfLength: 4   },
  bomber:             { halfWidth: 3,   halfHeight: 2,   halfLength: 5   },
  patrol:             { halfWidth: 3,   halfHeight: 2,   halfLength: 5   },
  yacht:              { halfWidth: 4,   halfHeight: 3,   halfLength: 6   },
  corvette:           { halfWidth: 5,   halfHeight: 3,   halfLength: 8   },
  cargo:              { halfWidth: 14,  halfHeight: 10,  halfLength: 24  },
  transport:          { halfWidth: 16,  halfHeight: 12,  halfLength: 30  },
  frigate:            { halfWidth: 12,  halfHeight: 8,   halfLength: 22  },
  destroyer:          { halfWidth: 14,  halfHeight: 10,  halfLength: 26  },
  large_transport:    { halfWidth: 22,  halfHeight: 16,  halfLength: 38  },
  large_cargo:        { halfWidth: 22,  halfHeight: 16,  halfLength: 38  },
  light_cruiser:      { halfWidth: 30,  halfHeight: 22,  halfLength: 52  },
  heavy_cruiser:      { halfWidth: 35,  halfHeight: 25,  halfLength: 60  },
  large_supplier:     { halfWidth: 26,  halfHeight: 18,  halfLength: 44  },
  carrier:            { halfWidth: 38,  halfHeight: 28,  halfLength: 65  },
  light_battleship:   { halfWidth: 48,  halfHeight: 35,  halfLength: 80  },
  battleship:         { halfWidth: 56,  halfHeight: 42,  halfLength: 95  },
  heavy_battleship:   { halfWidth: 80,  halfHeight: 58,  halfLength: 135 },
  super_carrier:      { halfWidth: 65,  halfHeight: 48,  halfLength: 110 },
  battle_station:     { halfWidth: 100, halfHeight: 72,  halfLength: 165 },
  small_space_station:{ halfWidth: 75,  halfHeight: 55,  halfLength: 125 },
  space_station:      { halfWidth: 115, halfHeight: 85,  halfLength: 195 },
  large_space_station:{ halfWidth: 150, halfHeight: 110, halfLength: 250 },
  planet_killer:      { halfWidth: 165, halfHeight: 120, halfLength: 275 },
  coloniser_gen1:     { halfWidth: 22,  halfHeight: 16,  halfLength: 38  },
  coloniser_gen2:     { halfWidth: 24,  halfHeight: 18,  halfLength: 42  },
  coloniser_gen3:     { halfWidth: 28,  halfHeight: 20,  halfLength: 48  },
  coloniser_gen4:     { halfWidth: 35,  halfHeight: 26,  halfLength: 60  },
  coloniser_gen5:     { halfWidth: 42,  halfHeight: 32,  halfLength: 72  },
};

const DEFAULT_COLLISION_EXTENTS: CollisionExtents = { halfWidth: 12, halfHeight: 8, halfLength: 20 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeaponType =
  | 'beam'
  | 'projectile'
  | 'missile'
  | 'point_defense'
  | 'fighter_bay';

export type WeaponFacing = 'fore' | 'aft' | 'port' | 'starboard' | 'turret';

export interface TacticalWeapon {
  componentId: string;
  type: WeaponType;
  damage: number;
  range: number;        // battlefield units
  accuracy: number;     // 0-100
  cooldownMax: number;  // ticks between shots
  cooldownLeft: number; // ticks until next shot
  facing: WeaponFacing; // weapon mount facing direction
  ammo?: number;        // remaining ammo (undefined = unlimited)
  maxAmmo?: number;     // starting ammo capacity
  interceptRate?: number; // PD intercept chance 0-100 (from component stats)
  salvoCount?: number;    // number of missiles fired per volley (missile weapons only)
}

export type ShipOrder =
  | { type: 'idle' }
  | { type: 'attack'; targetId: string }
  | { type: 'defend'; targetId: string }
  | { type: 'move'; x: number; y: number }
  | { type: 'flee' };

/**
 * Combat stance — determines autonomous behaviour.
 * - aggressive: hold position, fire at will at anything in range. Only move when commanded.
 * - defensive: hold position, fire only when taking damage.
 * - at_ease: ship captain decides autonomously (AI-controlled movement + targeting).
 * - evasive: maintain distance from enemies, fire if opportunity arises.
 * - flee: head for map edge, no firing.
 */
export type CombatStance = 'aggressive' | 'defensive' | 'at_ease' | 'evasive' | 'flee';

export type CrewExperience = 'recruit' | 'trained' | 'regular' | 'seasoned' | 'veteran' | 'hardened' | 'elite' | 'ace' | 'legendary';

export interface Crew {
  morale: number;        // 0-100
  health: number;        // 0-100
  experience: CrewExperience;
}

// ---------------------------------------------------------------------------
// Crew stations — bridge officers with quality-based effectiveness
// ---------------------------------------------------------------------------

export type CrewStationType = 'commander' | 'navigator' | 'weapons_officer' | 'shield_operator' | 'damage_control';

export interface CrewStation {
  type: CrewStationType;
  quality: number;       // 0-100
  effectiveness: number; // 0-1, degrades with morale + hull damage
}

export interface CrewStations {
  commander: CrewStation;
  navigator: CrewStation;
  weaponsOfficer?: CrewStation;
  shieldOperator?: CrewStation;
  damageControl?: CrewStation;
}

export interface ThreatAssessment {
  primaryThreatId: string | null;
  outnumbered: boolean;
  outgunned: boolean;
  hopeless: boolean;
  shouldRetreat: boolean;
  shouldIncreaseRange: boolean;
  incomingDpsEstimate: number;
  outgoingDpsEstimate: number;
  tickComputed: number;
}

/** Fleet coordination assessment — computed per side every 5 ticks. */
interface FleetCoordination {
  side: 'attacker' | 'defender';
  /** Target ID -> priority bonus (enemies that should be focus-fired). */
  focusTargets: Map<string, number>;
  /** Allied ship IDs that need help (under heavy fire from 3+ enemies). */
  supportRequests: Set<string>;
  /** Overall strategic assessment of this side's situation. */
  situation: 'outnumbered' | 'outgunned' | 'winning' | 'losing' | 'even';
}

/** Module-level fleet coordination state, updated each tick. */
let _currentCoordination: {
  attacker: FleetCoordination | null;
  defender: FleetCoordination | null;
} = { attacker: null, defender: null };

/** Experience level to numeric index (0-8) for quality calculations. */
const EXP_INDEX: Record<CrewExperience, number> = {
  recruit: 0, trained: 1, regular: 2, seasoned: 3, veteran: 4,
  hardened: 5, elite: 6, ace: 7, legendary: 8,
};

export interface TacticalShip {
  id: string;
  sourceShipId: string;  // links back to the canonical Ship
  name: string;
  side: 'attacker' | 'defender';
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number }; // current drift (Newtonian momentum)
  facing: number;        // radians (0 = +x direction)
  speed: number;         // max speed (pixels per tick)
  acceleration: number;  // main engine thrust per tick (lighter = faster accel)
  rcsThrust: number;     // RCS thruster force — direction-independent braking/strafing
  turnRate: number;      // radians per tick
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  armour: number;
  weapons: TacticalWeapon[];
  sensorRange: number;   // battlefield units
  order: ShipOrder;
  stance: CombatStance;
  destroyed: boolean;
  routed: boolean;
  /** Damage received this tick — used by defensive stance to trigger return fire. */
  damageTakenThisTick: number;
  crew: Crew;
  /** Unmanned craft (drones) — no morale, never flee, fight to destruction. */
  unmanned?: boolean;
  /** Tech age of the ship's shield system (determines weapon-type effectiveness). */
  shieldAge?: string;
  /** ECM evasion bonus — reduces incoming weapon accuracy. */
  evasionBonus: number;
  /** ECM missile deflection — chance per tick (0-100) that a tracking missile loses lock. */
  missileDeflection: number;
  /** ECM sensor jamming — reduces enemy sensor range within this ship's radius. */
  sensorJamming: number;
  /** Hull class from template (e.g. 'fighter', 'corvette', 'battleship'). */
  hullClass?: string;
  /** Collision radius — sphere approximation for simple distance checks. */
  collisionRadius: number;
  /** Axis-aligned collision half-extents (battlefield units): width=port-starboard, height=vertical, length=fore-aft. */
  collisionExtents?: CollisionExtents;
  /** Fighter AI phase — tracks attack-run state machine. */
  fighterPhase?: 'approach' | 'engage' | 'break' | 'regroup';
  /** Tick when fighter entered the current phase. */
  fighterPhaseTick?: number;
  /** Wing group ID — fighters in the same wing act as a unit. */
  wingId?: string;
  /** Crew stations — bridge officer simulation (populated for manned ships). */
  stations?: CrewStations;
  /** Commander's threat assessment — updated every 5 ticks. */
  threatAssessment?: ThreatAssessment;
  /** Hull repair rate from damage control components. */
  repairRate?: number;
  /** Morale recovery rate from morale-boosting components. */
  moraleRecovery?: number;
  /** Tick when ship last performed an evasive jink. */
  lastJinkTick?: number;
  /** Current orbit phase angle (radians) for capital ship orbiting. */
  orbitPhase?: number;
  /** Rolling window of damage dealt per tick (for target re-evaluation). */
  damageDealtWindow?: number[];
  /** ID of the target this ship is currently engaged with. */
  engagedTargetId?: string;
}

export interface Projectile {
  id: string;
  position: { x: number; y: number; z: number };
  speed: number;
  damage: number;
  sourceShipId: string;
  componentId?: string;
  /** Horizontal angle (radians) — fixed at creation, projectile flies straight. */
  angle: number;
  /** Vertical angle (radians) — 0 = level, positive = climbing. Fixed at creation. */
  pitch: number;
  /** Pre-computed velocity components (battlefield units per tick). Fixed at creation. */
  dx: number;
  dy: number;
  dz: number;
}

export interface Missile {
  id: string;
  sourceShipId: string;
  targetShipId: string;
  componentId: string;
  x: number;
  y: number;
  z: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  damage: number;
  damageType: string;
  /** Remaining fuel ticks — missile goes inert when exhausted. */
  fuel: number;
  /** Current heading in radians — missiles turn toward target, not teleport. */
  heading: number;
  /** Vertical angle — 0 = level, positive = climbing. */
  pitch: number;
  /** Max turn rate in radians/tick — limits how sharply the missile can steer. */
  turnRate: number;
}

export interface PointDefenceEffect {
  shipId: string;
  missileX: number;
  missileY: number;
  ticksRemaining: number;
}

export interface Fighter {
  id: string;
  carrierId: string;       // ship that launched it
  side: 'attacker' | 'defender';
  x: number;
  y: number;
  z: number;
  speed: number;           // fast — 6 units/tick
  damage: number;
  health: number;          // fighters are fragile — 5-15 HP
  maxHealth: number;
  targetId: string | null;  // ship they're targeting
  order: 'attack' | 'defend' | 'return';
}

export interface EnvironmentFeature {
  id: string;
  type: 'asteroid' | 'nebula' | 'debris';
  x: number;
  y: number;
  radius: number;
  vx?: number;      // velocity — debris drifts at the destroyed ship's velocity
  vy?: number;
  damage?: number;   // debris damage rating — larger wreckage hits harder
}

export interface BeamEffect {
  sourceShipId: string;
  targetShipId: string;
  damage: number;
  ticksRemaining: number;
  componentId?: string;
}

export type TacticalOutcome = 'attacker_wins' | 'defender_wins' | null;

export type CombatLayout = 'open_space' | 'planetary_assault';

export type BattlefieldSize = 'small' | 'medium' | 'large';

export const BATTLEFIELD_SIZE_CONFIG: Record<BattlefieldSize, {
  width: number; height: number; depth: number; maxShipsPerSide: number;
  asteroidMin: number; asteroidMax: number;
  nebulaMin: number; nebulaMax: number;
}> = {
  small:  { width: 1600, height: 1000, depth: 400, maxShipsPerSide: 9,  asteroidMin: 3,  asteroidMax: 8,  nebulaMin: 0, nebulaMax: 2 },
  medium: { width: 2800, height: 1750, depth: 600, maxShipsPerSide: 18, asteroidMin: 5,  asteroidMax: 12, nebulaMin: 1, nebulaMax: 3 },
  large:  { width: 4800, height: 3000, depth: 800, maxShipsPerSide: 36, asteroidMin: 8,  asteroidMax: 20, nebulaMin: 2, nebulaMax: 5 },
};

export interface PlanetData {
  name: string;
  type: string;
  defenceRating: number;  // from defense_grid buildings
  shieldActive: boolean;  // from planetary_shield building (future)
  orbitalGuns: number;    // from orbital weapon buildings
}

export type FormationType = 'line' | 'spearhead' | 'diamond' | 'wings';

export interface FormationPosition {
  offsetX: number;
  offsetY: number;
}

export type AdmiralTrait = 'aggressive' | 'cautious' | 'tactical' | 'inspiring';

export interface Admiral {
  name: string;
  side: 'attacker' | 'defender';
  trait: AdmiralTrait;
  experience: CrewExperience;
  pausesRemaining: number;
  rallyUsed: boolean;
  emergencyRepairUsed: boolean;
}

export interface EscapePod {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  side: 'attacker' | 'defender';
  ttl: number; // ticks remaining before pod exits map
}

export interface TacticalState {
  tick: number;
  ships: TacticalShip[];
  projectiles: Projectile[];
  missiles: Missile[];
  fighters: Fighter[];
  beamEffects: BeamEffect[];
  pointDefenceEffects: PointDefenceEffect[];
  escapePods: EscapePod[];
  environment: EnvironmentFeature[];
  battlefieldWidth: number;
  battlefieldHeight: number;
  battlefieldDepth: number;
  outcome: TacticalOutcome;
  attackerFormation: FormationType;
  defenderFormation: FormationType;
  admirals: Admiral[];
  layout: CombatLayout;
  planetData?: PlanetData;
}

// ---------------------------------------------------------------------------
// Crew station helpers
// ---------------------------------------------------------------------------

/**
 * Create crew stations from crew experience with random quality variation.
 * Quality = base (20) + experience factor (0-60) + random jitter (-10 to +10).
 * Optional stations only exist on ships with the relevant capabilities.
 */
function deriveCrewStations(
  experience: CrewExperience,
  hasWeapons: boolean,
  hasShields: boolean,
  isMediumPlus: boolean,
): CrewStations {
  const expIdx = EXP_INDEX[experience] ?? 2;
  const baseQuality = (): number => {
    const raw = 20 + (expIdx / 8) * 60 + (Math.random() * 20 - 10);
    return Math.max(0, Math.min(100, Math.round(raw)));
  };

  const stations: CrewStations = {
    commander: { type: 'commander', quality: baseQuality(), effectiveness: 1.0 },
    navigator: { type: 'navigator', quality: baseQuality(), effectiveness: 1.0 },
  };

  if (hasWeapons) {
    stations.weaponsOfficer = { type: 'weapons_officer', quality: baseQuality(), effectiveness: 1.0 };
  }
  if (hasShields && isMediumPlus) {
    stations.shieldOperator = { type: 'shield_operator', quality: baseQuality(), effectiveness: 1.0 };
  }
  if (isMediumPlus) {
    stations.damageControl = { type: 'damage_control', quality: baseQuality(), effectiveness: 1.0 };
  }

  return stations;
}

/**
 * Update all station effectiveness values based on current morale and hull.
 * moraleFactor: 1.0 above 50 morale, linear 0.5-1.0 below.
 * hullFactor: max(0.3, hull / maxHull).
 */
function updateStationEffectiveness(ship: TacticalShip): TacticalShip {
  if (!ship.stations || ship.destroyed || ship.routed) return ship;

  const moraleFactor = ship.crew.morale >= 50
    ? 1.0
    : 0.5 + (ship.crew.morale / 50) * 0.5;
  const hullFactor = Math.max(0.3, ship.hull / ship.maxHull);
  const eff = moraleFactor * hullFactor;

  const updateStation = (s: CrewStation): CrewStation =>
    s.effectiveness === eff ? s : { ...s, effectiveness: eff };

  const updated: CrewStations = {
    commander: updateStation(ship.stations.commander),
    navigator: updateStation(ship.stations.navigator),
  };
  if (ship.stations.weaponsOfficer) {
    updated.weaponsOfficer = updateStation(ship.stations.weaponsOfficer);
  }
  if (ship.stations.shieldOperator) {
    updated.shieldOperator = updateStation(ship.stations.shieldOperator);
  }
  if (ship.stations.damageControl) {
    updated.damageControl = updateStation(ship.stations.damageControl);
  }

  return { ...ship, stations: updated };
}

/**
 * Commander threat assessment — evaluates the tactical situation around a ship.
 * Computes incoming and outgoing DPS estimates, sets flags for outnumbered,
 * outgunned, hopeless, and retreat recommendations.
 */
function assessThreats(
  ship: TacticalShip,
  allShips: TacticalShip[],
  tick: number,
): ThreatAssessment {
  const enemies = allShips.filter(
    s => s.side !== ship.side && !s.destroyed && !s.routed,
  );
  const allies = allShips.filter(
    s => s.side === ship.side && !s.destroyed && !s.routed && s.id !== ship.id,
  );

  // Estimate incoming DPS: enemies targeting this ship or close enough to threaten.
  let incomingDps = 0;
  let primaryThreatId: string | null = null;
  let primaryThreatDps = 0;

  for (const enemy of enemies) {
    const edx = enemy.position.x - ship.position.x;
    const edy = enemy.position.y - ship.position.y;
    const edz = (enemy.position.z ?? 0) - (ship.position.z ?? 0);
    const dist = Math.sqrt(edx * edx + edy * edy + edz * edz);

    const isTargetingUs = enemy.order.type === 'attack'
      && (enemy.order as { targetId: string }).targetId === ship.id;

    let enemyDps = 0;
    for (const w of enemy.weapons) {
      if (dist <= w.range * 1.2) {
        enemyDps += w.damage / Math.max(1, w.cooldownMax);
      }
    }

    if (isTargetingUs || dist < 300) {
      incomingDps += enemyDps;
    }

    if (enemyDps > primaryThreatDps) {
      primaryThreatDps = enemyDps;
      primaryThreatId = enemy.id;
    }
  }

  // Estimate outgoing DPS against current target.
  let outgoingDps = 0;
  if (ship.order.type === 'attack') {
    const targetId = (ship.order as { targetId: string }).targetId;
    const target = allShips.find(s => s.id === targetId);
    if (target && !target.destroyed && !target.routed) {
      const tdx = target.position.x - ship.position.x;
      const tdy = target.position.y - ship.position.y;
      const tdz = (target.position.z ?? 0) - (ship.position.z ?? 0);
      const dist = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);

      for (const w of ship.weapons) {
        if (dist <= w.range) {
          let dps = w.damage / Math.max(1, w.cooldownMax);
          // Rough shield reduction: if target has shields, halve expected DPS
          if (target.shields > 0) dps *= 0.5;
          outgoingDps += dps;
        }
      }
    }
  }

  // Fleet power comparison
  const allyPower = allies.reduce((n, s) => n + s.maxHull, 0) + ship.maxHull;
  const enemyPower = enemies.reduce((n, s) => n + s.maxHull, 0);

  const outnumbered = enemies.length > (allies.length + 1) * 1.5;
  const outgunned = enemyPower > allyPower * 1.5;
  const hopeless = outgoingDps < 0.1 && incomingDps > 1.0;

  // Commander quality affects retreat threshold — inexperienced commanders
  // panic earlier, experienced ones hold their nerve.
  const cmdQuality = ship.stations?.commander?.quality ?? 50;
  const retreatThreshold = 0.15 + (cmdQuality / 100) * 0.35; // 0.15-0.50
  const hpFrac = ship.hull / ship.maxHull;
  const shouldRetreat = hopeless || (hpFrac < retreatThreshold && outgunned);
  const shouldIncreaseRange = incomingDps > outgoingDps * 2 && hpFrac < 0.6;

  return {
    primaryThreatId,
    outnumbered,
    outgunned,
    hopeless,
    shouldRetreat,
    shouldIncreaseRange,
    incomingDpsEstimate: incomingDps,
    outgoingDpsEstimate: outgoingDps,
    tickComputed: tick,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the interception point — where a pursuer at speed `pursuerSpeed`
 * starting from `pursuer` should aim to intercept a `target` moving at
 * `targetVelocity`.
 *
 * Uses the classic "closing triangle" (A² + B² = C²):
 *   - Target moves from T along its velocity vector
 *   - Pursuer moves from P at `pursuerSpeed` toward the intercept point I
 *   - Solve for the time t where |P→I| = pursuerSpeed × t and I = T + vel × t
 *
 * Returns the intercept point, or the target's current position if no
 * intercept is possible (e.g. target is faster and moving away).
 */
function computeInterceptPoint(
  pursuer: { x: number; y: number },
  target: { x: number; y: number },
  targetVelocity: { x: number; y: number },
  pursuerSpeed: number,
): { x: number; y: number } {
  const dx = target.x - pursuer.x;
  const dy = target.y - pursuer.y;
  const tvx = targetVelocity.x;
  const tvy = targetVelocity.y;

  // Quadratic coefficients: a*t² + b*t + c = 0
  // where t is the intercept time
  const a = tvx * tvx + tvy * tvy - pursuerSpeed * pursuerSpeed;
  const b = 2 * (dx * tvx + dy * tvy);
  const c = dx * dx + dy * dy;

  // If pursuer is much faster than target, `a` is negative → guaranteed solution
  const discriminant = b * b - 4 * a * c;

  if (Math.abs(a) < 0.001) {
    // Speeds are nearly equal — use linear approximation
    const t = c > 0.001 ? -c / (b || 0.001) : 0;
    if (t > 0 && t < 200) {
      return { x: target.x + tvx * t, y: target.y + tvy * t };
    }
    return { x: target.x, y: target.y };
  }

  if (discriminant < 0) {
    // No intercept possible — target is faster and moving away
    // Fall back to aiming at the target's predicted position in 10 ticks
    return { x: target.x + tvx * 10, y: target.y + tvy * 10 };
  }

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);

  // Pick the smallest positive time
  let t = -1;
  if (t1 > 0.1) t = t1;
  if (t2 > 0.1 && (t < 0 || t2 < t)) t = t2;

  if (t > 0 && t < 200) {
    return { x: target.x + tvx * t, y: target.y + tvy * t };
  }

  // Fallback — aim at current position
  return { x: target.x, y: target.y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dist(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Normalise an angle to the range (-PI, PI]. */
function normaliseAngle(a: number): number {
  let result = a % (2 * Math.PI);
  if (result > Math.PI) result -= 2 * Math.PI;
  if (result <= -Math.PI) result += 2 * Math.PI;
  return result;
}

/** Angle from point a to point b. */
function angleTo(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Compute the shortest distance from point (px, py, pz) to the line segment
 * from (ax, ay, az) to (bx, by, bz). Full 3D distance.
 */
export function pointToSegmentDistance(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 0.001) {
    // Degenerate segment (zero length)
    return Math.sqrt(apx * apx + apy * apy + apz * apz);
  }
  const t = clamp((apx * abx + apy * aby + apz * abz) / abLenSq, 0, 1);
  const cx = ax + t * abx - px;
  const cy = ay + t * aby - py;
  const cz = az + t * abz - pz;
  return Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/**
 * Compute the accuracy cone half-angle (radians) for a projectile weapon.
 *
 * Factors: base weapon accuracy, range to target, target speed and size,
 * own movement speed, crew experience, morale, and ECM sensor jamming.
 *
 * A smaller return value means a tighter cone (more accurate fire).
 */
function computeAccuracyCone(
  weapon: TacticalWeapon,
  rangeToTarget: number,
  targetSpeed: number,
  targetMaxHull: number,
  ownSpeed: number,
  crew: Crew,
  targetSensorJamming: number,
): number {
  // Base spread: linear interpolation between min (accuracy 100) and max (accuracy 0)
  const accuracyNorm = clamp(weapon.accuracy, 0, 100) / 100;
  const baseSpread = ACCURACY_TO_SPREAD_MAX - accuracyNorm * (ACCURACY_TO_SPREAD_MAX - ACCURACY_TO_SPREAD_MIN);

  // Range modifier: wider at distance
  const rangeFrac = weapon.range > 0 ? clamp(rangeToTarget / weapon.range, 0, 1.5) : 0;
  const rangeSpread = rangeFrac * RANGE_SPREAD_FACTOR;

  // Target speed modifier: faster targets are harder to hit
  const speedSpread = targetSpeed * TARGET_SPEED_SPREAD_FACTOR;

  // Target size modifier: smaller ships are harder to hit (hull < 60 = small)
  const sizeMod = targetMaxHull < 60 ? 1.3 : targetMaxHull < 200 ? 1.0 : targetMaxHull < 400 ? 0.85 : 0.70;

  // Own movement modifier: firing while manoeuvring widens cone
  const ownMoveSpread = ownSpeed * OWN_MOVEMENT_SPREAD_FACTOR;

  // Crew experience modifier
  const expMod = EXP_SPREAD_MOD[crew.experience] ?? 1.0;

  // Morale modifier: low morale degrades aim
  const moraleMod = crew.morale < 30 ? 1.4 : crew.morale < 50 ? 1.15 : 1.0;

  // ECM sensor jamming: target's jamming widens our cone
  const jammingMod = 1.0 + clamp(targetSensorJamming, 0, 100) / 200;

  return (baseSpread + rangeSpread + speedSpread + ownMoveSpread) * sizeMod * expMod * moraleMod * jammingMod;
}

/**
 * Compute the lead angle for firing at a moving target.
 *
 * Uses computeInterceptPoint() to predict where the target will be, then
 * interpolates between "no lead" (aim at current position) and "perfect lead"
 * based on crew experience (EXP_LEAD_QUALITY).
 *
 * Returns { angle, pitch } in radians.
 */
function computeLeadAngle(
  sourcePos: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number },
  targetVelocity: { x: number; y: number; z: number },
  projectileSpeed: number,
  crew: Crew,
): { angle: number; pitch: number } {
  const leadQuality = EXP_LEAD_QUALITY[crew.experience] ?? 0.4;

  // Compute the ideal intercept point (2D, using existing helper)
  const intercept = computeInterceptPoint(
    sourcePos,
    targetPos,
    { x: targetVelocity.x, y: targetVelocity.y },
    projectileSpeed,
  );

  // Interpolate between current target position and predicted intercept
  const aimX = targetPos.x + (intercept.x - targetPos.x) * leadQuality;
  const aimY = targetPos.y + (intercept.y - targetPos.y) * leadQuality;

  // Z-axis lead: predict target's Z movement
  const horizDist = Math.sqrt(
    (aimX - sourcePos.x) ** 2 + (aimY - sourcePos.y) ** 2,
  );
  const travelTime = horizDist > 1 ? horizDist / projectileSpeed : 1;
  const aimZ = targetPos.z + targetVelocity.z * travelTime * leadQuality;

  const angle = Math.atan2(aimY - sourcePos.y, aimX - sourcePos.x);
  const horizDistFinal = Math.sqrt(
    (aimX - sourcePos.x) ** 2 + (aimY - sourcePos.y) ** 2,
  );
  const pitch = horizDistFinal > 1
    ? Math.atan2(aimZ - sourcePos.z, horizDistFinal)
    : 0;

  return { angle, pitch };
}

/**
 * Check whether any bystander ship is within `radius` of the line segment
 * from (sourceX, sourceY) to (targetX, targetY). Ships in the `excludeIds`
 * set (source + intended target) are skipped.
 *
 * Returns the first eligible ship found, or null.
 */
export function checkCollateralDamage(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  allShips: TacticalShip[],
  excludeIds: Set<string>,
  radius: number,
  sourceZ: number = 0,
  targetZ: number = 0,
): TacticalShip | null {
  for (const ship of allShips) {
    if (excludeIds.has(ship.id) || ship.destroyed || ship.routed) continue;
    const d = pointToSegmentDistance(
      ship.position.x, ship.position.y, ship.position.z,
      sourceX, sourceY, sourceZ,
      targetX, targetY, targetZ,
    );
    if (d < radius) return ship;
  }
  return null;
}

/**
 * Check whether the line segment from (ax, ay) to (bx, by) passes through
 * any environment feature of the given type.
 */
export function segmentPassesThroughFeature(
  ax: number, ay: number,
  bx: number, by: number,
  features: EnvironmentFeature[],
  featureType: EnvironmentFeature['type'],
): EnvironmentFeature | null {
  for (const f of features) {
    if (f.type !== featureType) continue;
    // Environment features are on the z=0 plane
    const d = pointToSegmentDistance(f.x, f.y, 0, ax, ay, 0, bx, by, 0);
    if (d < f.radius) return f;
  }
  return null;
}

/** Check whether a point is inside any environment feature of a given type. */
export function isInsideFeature(
  x: number, y: number,
  features: EnvironmentFeature[],
  featureType: EnvironmentFeature['type'],
): boolean {
  for (const f of features) {
    if (f.type !== featureType) continue;
    const dx = x - f.x;
    const dy = y - f.y;
    if (dx * dx + dy * dy < f.radius * f.radius) return true;
  }
  return false;
}

function mapComponentType(ct: ComponentType): WeaponType | null {
  switch (ct) {
    case 'weapon_beam': return 'beam';
    case 'weapon_projectile': return 'projectile';
    case 'weapon_missile': return 'missile';
    case 'weapon_point_defense': return 'point_defense';
    case 'fighter_bay': return 'fighter_bay';
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Weapon arc checking
// ---------------------------------------------------------------------------

/** Full arc width in radians for each weapon facing.
 *  Port/starboard guns traverse from ahead to behind on their side (180°).
 *  Fore/aft cover a 120° cone. Turrets cover nearly everything. */
export const WEAPON_ARC: Record<WeaponFacing, number> = {
  fore: Math.PI * 2 / 3,       // 120 deg forward cone
  aft: Math.PI * 2 / 3,        // 120 deg rear cone
  port: Math.PI,                // 180 deg — full left hemisphere
  starboard: Math.PI,           // 180 deg — full right hemisphere
  turret: Math.PI * 5 / 3,     // 300 deg (only 60° blind spot at aft)
};

/**
 * Determine the default weapon facing based on component type.
 * Beams and projectiles mount forward; point defence and missiles are turrets.
 */
export function defaultWeaponFacing(compType: ComponentType): WeaponFacing {
  switch (compType) {
    case 'weapon_beam': return 'fore';
    case 'weapon_projectile': return 'fore';
    case 'weapon_point_defense': return 'turret';
    case 'weapon_missile': return 'turret';
    case 'fighter_bay': return 'turret';
    default: return 'turret';
  }
}

/**
 * Check whether a target is within a weapon's firing arc.
 *
 * The weapon's reference angle is computed from the ship's facing plus an
 * offset for the weapon mount direction. The angular difference to the
 * target must fall within half the arc width.
 */
export function isInWeaponArc(
  ship: TacticalShip,
  target: TacticalShip,
  weapon: TacticalWeapon,
): boolean {
  const dx = target.position.x - ship.position.x;
  const dy = target.position.y - ship.position.y;
  const angleToTarget = Math.atan2(dy, dx);

  // Compute the weapon's world-space reference angle
  let weaponAngle = ship.facing;
  switch (weapon.facing) {
    case 'aft': weaponAngle += Math.PI; break;
    case 'port': weaponAngle -= Math.PI / 2; break;
    case 'starboard': weaponAngle += Math.PI / 2; break;
    // 'fore' and 'turret' use ship.facing directly
  }

  let diff = angleToTarget - weaponAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const arc = WEAPON_ARC[weapon.facing] ?? Math.PI;
  return Math.abs(diff) <= arc / 2 + 0.01; // tiny epsilon for floating-point edge cases
}

// ---------------------------------------------------------------------------
// Threat-aware facing — anti-flank manoeuvring
// ---------------------------------------------------------------------------

/**
 * Compute the optimal facing angle considering all nearby threats.
 *
 * At lower ages engines only thrust forward, so facing = movement
 * direction. This function makes ships naturally circle to deny flanks
 * or punch through when surrounded.
 *
 * Algorithm:
 *  1. Score each nearby enemy by threat (distance, damage, targeting us)
 *  2. Compute a weighted threat centroid angle
 *  3. If threats are clustered on one side → face toward them (circle)
 *  4. If threats surround us → face the gap between them (punch through)
 *  5. Blend with the desired movement target for smooth transitions
 */
function computeThreatAwareFacing(
  ship: TacticalShip,
  moveTarget: { x: number; y: number },
  enemies: TacticalShip[],
): number {
  const moveAngle = angleTo(ship.position, moveTarget);
  const maxRange = ship.weapons.length > 0
    ? Math.max(...ship.weapons.map(w => w.range))
    : 200;

  // Only consider enemies within weapon range — while closing, face the
  // movement target so we thrust straight toward it, not sideways.
  const inRangeEnemies = enemies.filter(e => {
    return dist(ship.position, e.position) < maxRange && !e.destroyed && !e.routed;
  });
  if (inRangeEnemies.length === 0) return moveAngle;

  // Single enemy: face directly toward them. Threat-aware circling only
  // helps with multiple enemies — with one, it causes perpendicular deadlocks.
  if (inRangeEnemies.length === 1) {
    const enemy = inRangeEnemies[0]!;
    const angleToEnemy = angleTo(ship.position, enemy.position);
    // Slight blend with move target for smooth transitions
    return Math.atan2(
      Math.sin(angleToEnemy) * 0.85 + Math.sin(moveAngle) * 0.15,
      Math.cos(angleToEnemy) * 0.85 + Math.cos(moveAngle) * 0.15,
    );
  }

  // Compute threat-weighted centroid angle
  let threatSinSum = 0;
  let threatCosSum = 0;
  let totalWeight = 0;

  for (const enemy of inRangeEnemies) {
    const d = dist(ship.position, enemy.position);
    const angleToEnemy = angleTo(ship.position, enemy.position);

    let weight = 1 / Math.max(d, 1);
    const isTargetingUs = enemy.order.type === 'attack' &&
      (enemy.order.targetId === ship.id || enemy.order.targetId === ship.sourceShipId);
    if (isTargetingUs) weight *= 3;

    threatSinSum += Math.sin(angleToEnemy) * weight;
    threatCosSum += Math.cos(angleToEnemy) * weight;
    totalWeight += weight;
  }

  if (totalWeight < 0.001) return moveAngle;
  const threatAngle = Math.atan2(threatSinSum / totalWeight, threatCosSum / totalWeight);

  // Check angular spread — are we flanked from multiple sides?
  if (inRangeEnemies.length >= 2) {
    const enemyAngles = inRangeEnemies
      .map(e => angleTo(ship.position, e.position))
      .sort((a, b) => a - b);

    // Measure the largest gap between consecutive enemy angles
    let maxGap = 0;
    let maxGapAngle = moveAngle;
    for (let i = 0; i < enemyAngles.length; i++) {
      const next = i + 1 < enemyAngles.length
        ? enemyAngles[i + 1]!
        : enemyAngles[0]! + Math.PI * 2;
      const gap = next - enemyAngles[i]!;
      if (gap > maxGap) {
        maxGap = gap;
        maxGapAngle = enemyAngles[i]! + gap / 2;
      }
    }
    // If the smallest coverage is > 216° (gap < 144°), we're surrounded
    if (maxGap < Math.PI * 0.8) {
      return maxGapAngle; // punch through the largest gap
    }
  }

  // Enemies in range on one side — blend threat-facing with move-target.
  // Closer enemies get more facing weight (proximity ratio to maxRange).
  const closestDist = Math.min(...inRangeEnemies.map(e => dist(ship.position, e.position)));
  const proximityRatio = 1 - (closestDist / maxRange); // 0 at max range, 1 at point blank
  const threatWeight = proximityRatio * 0.6; // max 60% threat, scales with proximity
  const moveWeight = 1 - threatWeight;

  const blendedSin = Math.sin(threatAngle) * threatWeight + Math.sin(moveAngle) * moveWeight;
  const blendedCos = Math.cos(threatAngle) * threatWeight + Math.cos(moveAngle) * moveWeight;
  return Math.atan2(blendedSin, blendedCos);
}

// ---------------------------------------------------------------------------
// Small craft flanking AI
// ---------------------------------------------------------------------------

/**
 * Dynamic flanking for small craft (drones, fighters, bombers).
 *
 * Instead of charging head-on, small craft continuously orbit the target
 * staying in its blind spots. The algorithm:
 *
 *  1. Map the target's weapon arcs to find dangerous zones
 *  2. Compute the safest angle (biggest gap in weapon coverage)
 *  3. Assign each craft a unique orbit slot around that safe zone
 *  4. Continuously orbit — don't stop and hover
 *  5. Avoid debris in the orbit path
 *
 * The result: a squadron of drones spirals around a battleship,
 * staying behind it, firing into its aft while the battleship
 * struggles to turn fast enough to bring weapons to bear.
 */
function smallCraftFlank(
  updated: TacticalShip,
  ship: TacticalShip,
  target: TacticalShip,
  state: TacticalState,
  spreadX: number,
  spreadY: number,
  _spreadZ: number = 0,
): TacticalShip {
  const d = dist(ship.position, target.position);

  // Count same-side small craft to scale orbit for swarm density
  const swarmSize = state.ships.filter(
    s => s.side === ship.side && !s.destroyed && !s.routed && s.maxHull < 80,
  ).length;
  // Base orbit grows with swarm size — more drones need more room
  const baseOrbit = engageDistance(ship) * 0.7;
  const orbitRadius = baseOrbit * (1 + Math.max(0, swarmSize - 4) * 0.08);

  // ── Step 1: Map the target's weapon danger zones ────────────────────
  const ANGLE_STEPS = 12;
  const arcDanger: number[] = new Array(ANGLE_STEPS).fill(0);

  for (const weapon of target.weapons) {
    if (weapon.type === 'point_defense') continue;
    let weaponCentre = target.facing;
    switch (weapon.facing) {
      case 'aft': weaponCentre += Math.PI; break;
      case 'port': weaponCentre -= Math.PI / 2; break;
      case 'starboard': weaponCentre += Math.PI / 2; break;
    }
    const halfArc = (WEAPON_ARC[weapon.facing] ?? Math.PI) / 2;

    for (let i = 0; i < ANGLE_STEPS; i++) {
      const angle = (i / ANGLE_STEPS) * Math.PI * 2;
      const diff = Math.abs(normaliseAngle(angle - weaponCentre));
      if (diff <= halfArc) {
        arcDanger[i] += weapon.damage;
      }
    }
  }

  // ── Step 2: Find the safest sector ──────────────────────────────────
  let safestIdx = 0;
  let safestDanger = Infinity;
  for (let i = 0; i < ANGLE_STEPS; i++) {
    if (arcDanger[i]! < safestDanger) {
      safestDanger = arcDanger[i]!;
      safestIdx = i;
    }
  }
  const safestAngle = (safestIdx / ANGLE_STEPS) * Math.PI * 2;

  // ── Step 3: Swarm slots — full 360° spread biased toward safe zone ──
  // Each drone gets a stable angular position. Drones are expendable so
  // they spread across the full circle, with a bias pulling them toward
  // the safest sector. Large swarms NEED the full perimeter.
  const slotHash = ship.id.charCodeAt(0) + ship.id.charCodeAt(ship.id.length - 1);
  const idHash2 = ship.id.charCodeAt(Math.floor(ship.id.length / 2)) ?? 0;
  const slotFraction = ((slotHash * 137 + idHash2 * 31) % 1000) / 1000; // 0-1 pseudo-random
  // Full 360° base position
  const rawSlotAngle = slotFraction * Math.PI * 2;
  // Small swarms (≤4) cluster toward the safe zone; large swarms use the full circle
  const safeBias = swarmSize <= 4 ? 0.5 : Math.max(0.1, 0.5 - (swarmSize - 4) * 0.05);
  const slotAngle = Math.atan2(
    Math.sin(rawSlotAngle) * (1 - safeBias) + Math.sin(safestAngle) * safeBias,
    Math.cos(rawSlotAngle) * (1 - safeBias) + Math.cos(safestAngle) * safeBias,
  );
  // Vary orbit radius per drone — wide annulus prevents ring-stacking
  const radiusJitter = 0.6 + (((slotHash * 53 + idHash2) % 100) / 100) * 1.0; // 0.6–1.6x
  const myOrbitRadius = orbitRadius * radiusJitter;

  // ── Step 4: Three-phase approach + orbit ──
  const orbitDirection = slotHash % 2 === 0 ? 1 : -1; // CW or CCW
  const orbitSpeed = 0.06 + (ship.speed / 50);

  const currentAngle = angleTo(target.position, ship.position);
  const leadAngle = currentAngle + orbitDirection * orbitSpeed * 8;
  const orbitingSlotAngle = slotAngle + orbitDirection * state.tick * orbitSpeed;

  let goalAngle: number;
  let goalRadius: number;

  const angleToSlot = normaliseAngle(slotAngle - currentAngle);

  // Cap the fan-out phase so drones don't scatter on large maps.
  // Fan out only within 400 units of the target — beyond that, close in directly.
  const FAN_OUT_RANGE = Math.max(myOrbitRadius * 3, 400);

  if (d > FAN_OUT_RANGE) {
    // ── Phase 1: Fan out — spread to assigned approach vectors ──
    // Each drone steers laterally to its slot angle before closing in.
    // Capped so the swarm stays cohesive on larger battlefields.
    if (Math.abs(angleToSlot) > 0.4 && d < FAN_OUT_RANGE * 2) {
      // Not at assigned vector yet — move laterally (same distance, different angle)
      const turnRate = Math.min(Math.abs(angleToSlot), Math.PI / 4);
      goalAngle = currentAngle + Math.sign(angleToSlot) * turnRate;
      goalRadius = Math.max(d * 0.85, myOrbitRadius * 2); // close slowly while fanning
    } else {
      // Too far for fanning or already at assigned vector — close in directly
      goalAngle = slotAngle;
      goalRadius = Math.max(myOrbitRadius, d * 0.65);
    }
  } else if (d > myOrbitRadius * 1.5) {
    // ── Phase 2: Close spiral — approach orbit from assigned angle ──
    // Already roughly at our slot angle, spiral in toward orbit radius
    const spiralAngle = currentAngle + orbitDirection * 0.3; // gentle spiral
    const blendToSlot = 0.4;
    goalAngle = Math.atan2(
      Math.sin(spiralAngle) * (1 - blendToSlot) + Math.sin(orbitingSlotAngle) * blendToSlot,
      Math.cos(spiralAngle) * (1 - blendToSlot) + Math.cos(orbitingSlotAngle) * blendToSlot,
    );
    goalRadius = Math.max(myOrbitRadius, d * 0.7);
  } else {
    // ── Phase 3: Orbit — continuous orbit within safe zone ──
    const safeWeight = d < myOrbitRadius * 1.3 ? 0.4 : 0.6;
    goalAngle = Math.atan2(
      Math.sin(leadAngle) * (1 - safeWeight) + Math.sin(orbitingSlotAngle) * safeWeight,
      Math.cos(leadAngle) * (1 - safeWeight) + Math.cos(orbitingSlotAngle) * safeWeight,
    );
    goalRadius = myOrbitRadius;
  }

  // Enforce keep-out zone — goal must never be closer than 60% of orbit radius
  // to the target centre. Prevents drones from thrusting through the target.
  const keepOut = myOrbitRadius * 0.6;
  if (goalRadius < keepOut) goalRadius = keepOut;

  let goalX = target.position.x + Math.cos(goalAngle) * goalRadius + spreadX;
  let goalY = target.position.y + Math.sin(goalAngle) * goalRadius + spreadY;

  // ── Step 4b: Boids flocking — separation, alignment, cohesion ──
  // Drones behave as a coordinated flock: they maintain spacing, match
  // each other's headings, and steer toward the flock centre. The orbit
  // goal provides the "migration" direction; flocking keeps them flowing
  // together as a network.
  const SEPARATION_DIST = 45;
  const FLOCK_RADIUS = 120; // neighbourhood for alignment/cohesion
  const squadMates = state.ships.filter(
    s => s.side === ship.side && !s.destroyed && !s.routed && s.maxHull < 80 && s.id !== ship.id,
  );

  let sepX = 0, sepY = 0;   // separation: steer away from very close neighbours
  let alignX = 0, alignY = 0; // alignment: match velocity direction of nearby flock
  let cohX = 0, cohY = 0;   // cohesion: steer toward flock centre
  let alignCount = 0;
  let cohCount = 0;

  for (const mate of squadMates) {
    const mateDist = dist(ship.position, mate.position);

    // Separation — quadratic repulsion for very close neighbours
    if (mateDist < SEPARATION_DIST && mateDist > 1) {
      const t = (SEPARATION_DIST - mateDist) / SEPARATION_DIST;
      const strength = t * t * 18;
      sepX += (ship.position.x - mate.position.x) / mateDist * strength;
      sepY += (ship.position.y - mate.position.y) / mateDist * strength;
    }

    // Alignment + Cohesion — broader neighbourhood
    if (mateDist < FLOCK_RADIUS && mateDist > 1) {
      // Alignment: accumulate neighbour velocities
      alignX += mate.velocity?.x ?? 0;
      alignY += mate.velocity?.y ?? 0;
      alignCount++;
      // Cohesion: accumulate neighbour positions
      cohX += mate.position.x;
      cohY += mate.position.y;
      cohCount++;
    }
  }

  // Blend flock forces into the orbit goal
  // Separation: direct offset (strongest — avoid collision)
  // Alignment: nudge goal toward average flock heading
  // Cohesion: nudge goal toward flock centre (prevents scattering)

  // Clamp separation to avoid overshooting through the target
  const sepMag = Math.sqrt(sepX * sepX + sepY * sepY);
  if (sepMag > 20) { sepX = sepX / sepMag * 20; sepY = sepY / sepMag * 20; }
  goalX += sepX;
  goalY += sepY;

  if (alignCount > 0) {
    // Average flock velocity direction — steer goal to match
    const avgVx = alignX / alignCount;
    const avgVy = alignY / alignCount;
    const myVx = ship.velocity?.x ?? 0;
    const myVy = ship.velocity?.y ?? 0;
    // Difference between my velocity and flock average
    goalX += (avgVx - myVx) * 0.4;
    goalY += (avgVy - myVy) * 0.4;
  }

  if (cohCount > 0) {
    // Steer toward flock centre only when actually scattered — prevents
    // pulling already-close drones back into a clump
    const flockCX = cohX / cohCount;
    const flockCY = cohY / cohCount;
    const distToFlock = dist(ship.position, { x: flockCX, y: flockCY });
    if (distToFlock > FLOCK_RADIUS * 0.5) {
      const cohStrength = Math.min(0.04, (distToFlock - FLOCK_RADIUS * 0.5) / FLOCK_RADIUS * 0.06);
      goalX += (flockCX - ship.position.x) * cohStrength;
      goalY += (flockCY - ship.position.y) * cohStrength;
    }
  }

  // ── Step 4c: Target collision avoidance ──────────────────────────
  // If the drone is close to the target AND heading toward it, override
  // the goal to a tangent escape — prevents momentum from carrying it through.
  if (d < myOrbitRadius * 1.5) {
    const vx = ship.velocity?.x ?? 0;
    const vy = ship.velocity?.y ?? 0;
    const toTargetX = target.position.x - ship.position.x;
    const toTargetY = target.position.y - ship.position.y;
    // Dot product: positive = heading toward target
    const dot = vx * toTargetX + vy * toTargetY;
    if (dot > 0 && d < myOrbitRadius) {
      // Emergency tangent escape — steer perpendicular to the target
      const tangentAngle = currentAngle + orbitDirection * Math.PI / 2;
      goalX = ship.position.x + Math.cos(tangentAngle) * myOrbitRadius;
      goalY = ship.position.y + Math.sin(tangentAngle) * myOrbitRadius;
    }
  }

  // ── Step 5: Dodge incoming missiles ───────────────────────────────
  // Small craft with no PD must evade missiles by thrusting perpendicular
  const hasPD = ship.weapons.some(w => w.type === 'point_defense');
  if (!hasPD) {
    const incomingMissiles = (state.missiles ?? []).filter(
      m => m.targetShipId === ship.id &&
        dist(ship.position, { x: m.x, y: m.y, z: m.z }) < 150,
    );
    if (incomingMissiles.length > 0) {
      // Dodge perpendicular to the nearest incoming missile
      const nearest = incomingMissiles.reduce((best, m) => {
        const md = dist(ship.position, { x: m.x, y: m.y, z: m.z });
        const bd = dist(ship.position, { x: best.x, y: best.y, z: best.z });
        return md < bd ? m : best;
      });
      const missileAngle = angleTo({ x: nearest.x, y: nearest.y }, ship.position);
      // Dodge perpendicular — pick whichever side is closer to our current velocity
      const dodgeAngle1 = missileAngle + Math.PI / 2;
      const dodgeAngle2 = missileAngle - Math.PI / 2;
      const velAngle = Math.atan2(ship.velocity?.y ?? 0, ship.velocity?.x ?? 0);
      const dodge = Math.abs(normaliseAngle(velAngle - dodgeAngle1)) <
                    Math.abs(normaliseAngle(velAngle - dodgeAngle2))
                    ? dodgeAngle1 : dodgeAngle2;
      goalX = ship.position.x + Math.cos(dodge) * 80;
      goalY = ship.position.y + Math.sin(dodge) * 80;
    }
  }

  // ── Step 6: Avoid debris in the orbit path ────────────────────────
  if (state.environment) {
    for (const feature of state.environment) {
      if (feature.type !== 'debris' && feature.type !== 'asteroid') continue;
      const featureDist = dist({ x: goalX, y: goalY }, feature);
      if (featureDist < feature.radius * 1.5) {
        const pushAngle = angleTo(feature, { x: goalX, y: goalY });
        goalX = feature.x + Math.cos(pushAngle) * feature.radius * 2;
        goalY = feature.y + Math.sin(pushAngle) * feature.radius * 2;
      }
    }
  }

  // Always thrust toward the goal — minDist 0 means never stop
  return moveToward(updated, { x: goalX, y: goalY }, 0, state.environment, state.ships);
}

// ---------------------------------------------------------------------------
// Fighter combat AI — attack-pass dogfighting
// ---------------------------------------------------------------------------

// Fighters make attack passes, not orbits. The cycle:
//   approach → engage (fire during pass) → break (away) → regroup → repeat
// Wings (groups of 3) attack together: leader picks target, wingmen follow.

/** Ticks spent on the engage run before breaking. */
const FIGHTER_ENGAGE_TICKS = 25;
/** Ticks spent breaking (sweeping lateral arc). */
const FIGHTER_BREAK_TICKS = 8;
/** Radius of the pursuit curve offset behind the target. */
const FIGHTER_PURSUIT_OFFSET = 60;
/** Lateral sweep distance during break. */
const FIGHTER_BREAK_SWEEP = 120;
/** Wingman offset distance from leader. */
const WINGMAN_OFFSET = 35;

/**
 * Assign wing IDs to all fighters on the battlefield (called once at battle
 * start and when fighters are destroyed). Wings of 3, labelled by side.
 */
function assignWings(ships: TacticalShip[]): TacticalShip[] {
  const sides: Array<'attacker' | 'defender'> = ['attacker', 'defender'];
  const result = [...ships];
  for (const side of sides) {
    const fighters = result
      .filter(s => s.hullClass === 'fighter' && s.side === side && !s.destroyed && !s.routed)
      .sort((a, b) => a.id.localeCompare(b.id));
    let wingIdx = 0;
    for (let i = 0; i < fighters.length; i++) {
      const wingId = `${side}-wing-${Math.floor(wingIdx / 3)}`;
      const idx = result.findIndex(s => s.id === fighters[i]!.id);
      if (idx >= 0) {
        result[idx] = { ...result[idx]!, wingId };
      }
      wingIdx++;
    }
  }
  return result;
}

/**
 * Get the wing leader (first alive fighter in the wing).
 */
function getWingLeader(ship: TacticalShip, allShips: TacticalShip[]): TacticalShip {
  if (!ship.wingId) return ship;
  const wingMates = allShips
    .filter(s => s.wingId === ship.wingId && !s.destroyed && !s.routed)
    .sort((a, b) => a.id.localeCompare(b.id));
  return wingMates[0] ?? ship;
}

/**
 * Get wing position offset for a wingman (relative to leader facing).
 * Leader = centre, second = left, third = right (V formation).
 */
function getWingOffset(ship: TacticalShip, leader: TacticalShip, allShips: TacticalShip[]): { x: number; y: number } {
  if (ship.id === leader.id) return { x: 0, y: 0 };
  const wingMates = allShips
    .filter(s => s.wingId === ship.wingId && !s.destroyed && !s.routed)
    .sort((a, b) => a.id.localeCompare(b.id));
  const myIdx = wingMates.findIndex(s => s.id === ship.id);
  // V-formation: wingmen trail behind and to the sides
  const side = myIdx % 2 === 0 ? -1 : 1;
  const perpAngle = leader.facing + (Math.PI / 2) * side;
  const trailAngle = leader.facing + Math.PI; // behind leader
  return {
    x: Math.cos(perpAngle) * WINGMAN_OFFSET + Math.cos(trailAngle) * WINGMAN_OFFSET * 0.6,
    y: Math.sin(perpAngle) * WINGMAN_OFFSET + Math.sin(trailAngle) * WINGMAN_OFFSET * 0.6,
  };
}

/**
 * Fighter combat AI — stance-dependent dogfighting.
 *
 * Aggressive (default): orbit at weapon range — never fly through enemies.
 *   Uses the same orbit/flocking system as small craft vs large targets,
 *   adapted to work fighter-vs-fighter. Fires during orbit passes.
 *
 * At ease ("0 range"): pursuit-curve fly-through — captain's reckless call.
 *   Aims behind the target, flies through, sweeps laterally, repeats.
 *   Maximum damage but high risk. Good when outnumbering the enemy.
 *
 * Desperation (relative — outnumbered 2:1+): pure interception pursuit,
 *   no breaks, close and kill as fast as possible.
 */
function fighterCombatAI(
  updated: TacticalShip,
  ship: TacticalShip,
  target: TacticalShip,
  state: TacticalState,
  spreadX: number,
  spreadY: number,
  _spreadZ: number = 0,
): TacticalShip {
  // Set explicit attack order so wing target diversity in findTarget works
  if (updated.order.type !== 'attack' || updated.order.targetId !== target.id) {
    updated = { ...updated, order: { type: 'attack', targetId: target.id } };
  }

  // Fighters in the same wing stagger at different altitudes to prevent
  // same-plane clustering and mutual collisions during approach
  const _idHash = ship.id.charCodeAt(0) + ship.id.charCodeAt(ship.id.length - 1);
  const wingZOffset = ((_idHash % 5) - 2) * 25; // -50, -25, 0, +25, +50

  // ── Desperation check — relative, not absolute ──
  // Desperate when outnumbered 2:1 or more, OR when ≤2 allies remain total.
  const alliesAlive = state.ships.filter(
    s => s.side === ship.side && !s.destroyed && !s.routed,
  ).length;
  const enemiesAlive = state.ships.filter(
    s => s.side !== ship.side && !s.destroyed && !s.routed,
  ).length;
  const desperate = alliesAlive <= 2 || (enemiesAlive > 0 && alliesAlive / enemiesAlive < 0.5);

  if (desperate) {
    // Pure interception pursuit — close and kill, no manoeuvring
    const tvx = target.velocity?.x ?? 0;
    const tvy = target.velocity?.y ?? 0;
    const intercept = computeInterceptPoint(
      ship.position, target.position, { x: tvx, y: tvy }, ship.speed,
    );
    updated = { ...updated, fighterPhase: 'engage' as const, fighterPhaseTick: state.tick };
    return moveToward(updated, intercept, 0, state.environment, state.ships);
  }

  // ── AGGRESSIVE stance: tangent approach + orbit, never fly straight at ──
  // Fighters ALWAYS approach on a tangent (offset to one side). They never
  // aim directly at the target. Momentum from the tangent approach naturally
  // curves them into an orbit at weapon range. When too close, hard break.
  //
  // The goal point is ALWAYS perpendicular to the target — the fighter
  // flies PAST the target at weapon range, not TOWARD it.
  if (ship.stance === 'aggressive') {
    const d = dist(ship.position, target.position);
    const maxWeaponRange = ship.weapons.length > 0
      ? Math.max(...ship.weapons.filter(w => w.type !== 'point_defense').map(w => w.range))
      : 100;
    const hash = ship.id.charCodeAt(0) + ship.id.charCodeAt(ship.id.length - 1);
    const turnSign = hash % 2 === 0 ? 1 : -1;

    const tvx = target.velocity?.x ?? 0;
    const tvy = target.velocity?.y ?? 0;

    // Orbit radius — sweet spot for weapon range
    const orbitDist = maxWeaponRange * 0.7;
    let goalX: number;
    let goalY: number;

    // Current angle from target to fighter
    const currentAngle = angleTo(target.position, ship.position);

    // ── Separation impulse: hard velocity override when too close to ANY enemy ──
    // This is a Reynolds separation force applied directly to velocity, not
    // goal position. Guarantees minimum distance even with Newtonian momentum.
    const HARD_AVOID_RADIUS = orbitDist * 1.2; // start pushing when inside this
    const MIN_SAFE_DIST = 25; // emergency hard push at this range
    const vx = ship.velocity?.x ?? 0;
    const vy = ship.velocity?.y ?? 0;

    let sepForceX = 0;
    let sepForceY = 0;
    let closestEnemyDist = Infinity;
    let closestEnemyAngle = 0;
    let closingOnEnemy = false;

    const enemies = state.ships.filter(
      s => s.side !== ship.side && !s.destroyed && !s.routed,
    );
    for (const enemy of enemies) {
      const eDist = dist(ship.position, enemy.position);
      if (eDist >= HARD_AVOID_RADIUS || eDist < 0.1) continue;

      if (eDist < closestEnemyDist) {
        closestEnemyDist = eDist;
        closestEnemyAngle = angleTo(enemy.position, ship.position);
      }

      // Separation force — inverse-square, stronger when closer
      const pushAngle = angleTo(enemy.position, ship.position);
      const strength = ((HARD_AVOID_RADIUS - eDist) / HARD_AVOID_RADIUS) ** 2;
      sepForceX += Math.cos(pushAngle) * strength * 8;
      sepForceY += Math.sin(pushAngle) * strength * 8;

      // Check closing rate for break turn trigger
      const toEx = enemy.position.x - ship.position.x;
      const toEy = enemy.position.y - ship.position.y;
      const closingRate = eDist > 1 ? (vx * toEx + vy * toEy) / eDist : 0;
      if (closingRate > 3) closingOnEnemy = true;
    }

    // Apply separation directly to velocity (hard override, not goal-based)
    if (sepForceX !== 0 || sepForceY !== 0) {
      updated = {
        ...updated,
        velocity: {
          x: vx + sepForceX,
          y: vy + sepForceY,
          z: updated.velocity.z,
        },
      };
    }

    // Emergency: inside minimum safe distance — teleport velocity away
    if (closestEnemyDist < MIN_SAFE_DIST && closestEnemyDist > 0.1) {
      const escapeAngle = closestEnemyAngle;
      updated = {
        ...updated,
        velocity: {
          x: Math.cos(escapeAngle) * ship.speed * 0.8,
          y: Math.sin(escapeAngle) * ship.speed * 0.8,
          z: updated.velocity.z,
        },
      };
    }

    // ── Goal selection: orbit, close, or break turn ──
    if (closingOnEnemy && closestEnemyDist < HARD_AVOID_RADIUS) {
      // BREAK TURN: closing fast on an enemy — 90° beam turn away
      const breakAngle = closestEnemyAngle + turnSign * Math.PI * 0.5;
      goalX = ship.position.x + Math.cos(breakAngle) * maxWeaponRange;
      goalY = ship.position.y + Math.sin(breakAngle) * maxWeaponRange;
    } else if (d > maxWeaponRange * 2.0) {
      // VERY FAR: tangent approach — aim at a point ON THE ORBIT CIRCLE,
      // not at the target itself. This means the fighter curves in from the
      // side rather than charging head-on.
      const intercept = computeInterceptPoint(
        ship.position, target.position, { x: tvx, y: tvy }, ship.speed,
      );
      const angleToIntercept = angleTo(ship.position, intercept);
      // Offset 60° to the side — creates the tangent approach
      const tangentAngle = angleToIntercept + turnSign * Math.PI / 3;
      // Aim at a point on the orbit circle on the approach side
      goalX = target.position.x + Math.cos(currentAngle + turnSign * 0.8) * orbitDist;
      goalY = target.position.y + Math.sin(currentAngle + turnSign * 0.8) * orbitDist;
      // Blend with the tangent direction for the actual movement
      goalX = (goalX + ship.position.x + Math.cos(tangentAngle) * d * 0.3) / 2;
      goalY = (goalY + ship.position.y + Math.sin(tangentAngle) * d * 0.3) / 2;
    } else {
      // IN RANGE or CLOSING: orbit — fly to a point on the circle AHEAD of
      // current position. This creates continuous circular motion around the
      // target. Lead the target's movement so we don't fall behind.
      const orbitAdvance = turnSign * 0.35; // advance ~20° ahead on the circle
      const orbitGoalAngle = currentAngle + orbitAdvance;
      goalX = target.position.x + Math.cos(orbitGoalAngle) * orbitDist + tvx * 3;
      goalY = target.position.y + Math.sin(orbitGoalAngle) * orbitDist + tvy * 3;
    }

    // Per-fighter offset to prevent stacking
    const idOffset = ((hash % 7) - 3) * 10;
    goalX += Math.cos(currentAngle + Math.PI / 2) * idOffset;
    goalY += Math.sin(currentAngle + Math.PI / 2) * idOffset;

    goalX = clamp(goalX, 40, state.battlefieldWidth - 40);
    goalY = clamp(goalY, 40, state.battlefieldHeight - 40);

    updated = { ...updated, fighterPhase: 'engage' as const, fighterPhaseTick: state.tick };
    const result = moveToward(updated, { x: goalX, y: goalY, z: wingZOffset }, 0, state.environment, state.ships);
    result.position.x = clamp(result.position.x, -20, state.battlefieldWidth + 20);
    result.position.y = clamp(result.position.y, -20, state.battlefieldHeight + 20);

    // ── RCS facing override: face the TARGET, not the movement direction ──
    // In space, velocity and facing are independent. RCS thrusters rotate the
    // ship without changing trajectory. Fighters orbit while facing inward,
    // keeping fore weapons on target. Turn rate limits how fast they can track.
    const desiredFacing = angleTo(result.position, target.position);
    const facingDiff = normaliseAngle(desiredFacing - result.facing);
    const maxTurn = result.turnRate ?? 0.15;
    result.facing = normaliseAngle(result.facing + clamp(facingDiff, -maxTurn, maxTurn));

    return result;
  }

  // ── AT EASE stance ("0 range"): pursuit-curve fly-through pattern ──
  // Captain makes the reckless call — high risk, high reward.

  const d = dist(ship.position, target.position);
  const tick = state.tick;
  const maxWeaponRange = ship.weapons.length > 0
    ? Math.max(...ship.weapons.filter(w => w.type !== 'point_defense').map(w => w.range))
    : 100;

  const leader = getWingLeader(ship, state.ships);
  const isLeader = ship.id === leader.id;
  const wingOffset = getWingOffset(ship, leader, state.ships);

  let phase = ship.fighterPhase ?? 'approach';
  let phaseTick = ship.fighterPhaseTick ?? tick;
  const ticksInPhase = tick - phaseTick;
  const hash = ship.id.charCodeAt(0) + ship.id.charCodeAt(ship.id.length - 1);
  const turnSign = hash % 2 === 0 ? 1 : -1;

  switch (phase) {
    case 'approach':
      if (d <= maxWeaponRange * 1.2) { phase = 'engage'; phaseTick = tick; }
      break;
    case 'regroup':
      phase = 'approach'; phaseTick = tick;
      break;
    case 'engage': {
      const vx = ship.velocity?.x ?? 0;
      const vy = ship.velocity?.y ?? 0;
      const dot = vx * (target.position.x - ship.position.x) + vy * (target.position.y - ship.position.y);
      if (dot < 0 && d < maxWeaponRange * 0.4 && ticksInPhase > 5) { phase = 'break'; phaseTick = tick; }
      if (ticksInPhase >= FIGHTER_ENGAGE_TICKS) { phase = 'break'; phaseTick = tick; }
      break;
    }
    case 'break':
      if (ticksInPhase >= FIGHTER_BREAK_TICKS) { phase = 'engage'; phaseTick = tick; }
      break;
  }

  if (!isLeader && leader.fighterPhase === 'break' && phase === 'engage') {
    phase = 'break'; phaseTick = tick;
  }

  updated = { ...updated, fighterPhase: phase, fighterPhaseTick: phaseTick };

  let goalX: number;
  let goalY: number;
  const wingIdx = ship.wingId ? parseInt(ship.wingId.split('-').pop() ?? '0', 10) : 0;

  switch (phase) {
    case 'approach': {
      const tvx = target.velocity?.x ?? 0;
      const tvy = target.velocity?.y ?? 0;
      const intercept = computeInterceptPoint(
        ship.position, target.position, { x: tvx, y: tvy }, ship.speed,
      );
      const sectorOffset = ((wingIdx % 3) - 1) * 0.35;
      const interceptAngle = angleTo(ship.position, intercept);
      goalX = intercept.x + Math.cos(interceptAngle + Math.PI / 2) * sectorOffset * 40;
      goalY = intercept.y + Math.sin(interceptAngle + Math.PI / 2) * sectorOffset * 40;
      if (!isLeader && leader.fighterPhase === 'approach') {
        goalX = leader.position.x + wingOffset.x;
        goalY = leader.position.y + wingOffset.y;
      }
      break;
    }
    case 'engage': {
      const tvx = target.velocity?.x ?? 0;
      const tvy = target.velocity?.y ?? 0;
      const tSpeed = Math.sqrt(tvx * tvx + tvy * tvy);
      if (d > maxWeaponRange * 0.8 && tSpeed > 1) {
        const behindAngle = Math.atan2(-tvy, -tvx);
        goalX = target.position.x + Math.cos(behindAngle) * FIGHTER_PURSUIT_OFFSET;
        goalY = target.position.y + Math.sin(behindAngle) * FIGHTER_PURSUIT_OFFSET;
        goalX += tvx * 3; goalY += tvy * 3;
      } else if (d > maxWeaponRange * 0.8) {
        const flankerAngle = angleTo(ship.position, target.position) + turnSign * 0.5;
        goalX = target.position.x - Math.cos(flankerAngle) * FIGHTER_PURSUIT_OFFSET * 0.4;
        goalY = target.position.y - Math.sin(flankerAngle) * FIGHTER_PURSUIT_OFFSET * 0.4;
      } else {
        goalX = target.position.x + tvx * 4;
        goalY = target.position.y + tvy * 4;
      }
      const idOffset = ((hash % 7) - 3) * 8;
      goalX += Math.cos(angleTo(ship.position, target.position) + Math.PI / 2) * idOffset;
      goalY += Math.sin(angleTo(ship.position, target.position) + Math.PI / 2) * idOffset;
      if (!isLeader) { goalX += wingOffset.x * 0.3; goalY += wingOffset.y * 0.3; }
      break;
    }
    case 'break': {
      const awayAngle = angleTo(target.position, ship.position);
      const breakProgress = ticksInPhase / FIGHTER_BREAK_TICKS;
      const sweepAngle = awayAngle + turnSign * (Math.PI * 0.5 - breakProgress * 0.4);
      goalX = ship.position.x + Math.cos(sweepAngle) * FIGHTER_BREAK_SWEEP;
      goalY = ship.position.y + Math.sin(sweepAngle) * FIGHTER_BREAK_SWEEP;
      goalX = clamp(goalX, 80, state.battlefieldWidth - 80);
      goalY = clamp(goalY, 80, state.battlefieldHeight - 80);
      break;
    }
    default: { goalX = target.position.x; goalY = target.position.y; break; }
  }

  // ── Separation from nearby allies (prevent stacking) ──
  const FIGHTER_SEP_DIST = 30;
  const allies = state.ships.filter(
    s => s.side === ship.side && s.id !== ship.id && !s.destroyed && !s.routed && s.hullClass === 'fighter',
  );
  for (const ally of allies) {
    const ad = dist(ship.position, ally.position);
    if (ad < FIGHTER_SEP_DIST && ad > 1) {
      const t = (FIGHTER_SEP_DIST - ad) / FIGHTER_SEP_DIST;
      goalX += (ship.position.x - ally.position.x) / ad * t * 10;
      goalY += (ship.position.y - ally.position.y) / ad * t * 10;
    }
  }

  // ── Dodge incoming missiles (same as smallCraftFlank) ──
  const hasPD = ship.weapons.some(w => w.type === 'point_defense');
  if (!hasPD) {
    const incomingMissiles = (state.missiles ?? []).filter(
      m => m.targetShipId === ship.id &&
        dist(ship.position, { x: m.x, y: m.y, z: m.z }) < 150,
    );
    if (incomingMissiles.length > 0) {
      const nearest = incomingMissiles.reduce((best, m) => {
        const md = dist(ship.position, { x: m.x, y: m.y, z: m.z });
        const bd = dist(ship.position, { x: best.x, y: best.y, z: best.z });
        return md < bd ? m : best;
      });
      const missileAngle = angleTo({ x: nearest.x, y: nearest.y }, ship.position);
      const dodgeAngle1 = missileAngle + Math.PI / 2;
      const dodgeAngle2 = missileAngle - Math.PI / 2;
      const velAngle = Math.atan2(ship.velocity?.y ?? 0, ship.velocity?.x ?? 0);
      const dodge = Math.abs(normaliseAngle(velAngle - dodgeAngle1)) <
                    Math.abs(normaliseAngle(velAngle - dodgeAngle2))
                    ? dodgeAngle1 : dodgeAngle2;
      goalX = ship.position.x + Math.cos(dodge) * 80;
      goalY = ship.position.y + Math.sin(dodge) * 80;
    }
  }

  // Clamp goal to battlefield bounds — fighters must stay on the field
  goalX = clamp(goalX, 40, state.battlefieldWidth - 40);
  goalY = clamp(goalY, 40, state.battlefieldHeight - 40);

  // During engage phase, don't use minDist — fly through. Otherwise, stop near goal.
  const minDist = phase === 'engage' ? 0 : 5;
  const result = moveToward(updated, { x: goalX, y: goalY, z: wingZOffset }, minDist, state.environment, state.ships);

  // Hard clamp position — prevent drifting off the battlefield
  result.position.x = clamp(result.position.x, -20, state.battlefieldWidth + 20);
  result.position.y = clamp(result.position.y, -20, state.battlefieldHeight + 20);
  return result;
}

// ---------------------------------------------------------------------------
// Formation system
// ---------------------------------------------------------------------------

/** Spacing between ships in a formation (battlefield units). */
const FORMATION_SPACING = 40;

/**
 * Calculate formation positions for N ships.
 * Returns offsets from the formation centre point.
 */
export function getFormationPositions(
  formation: FormationType,
  count: number,
): FormationPosition[] {
  switch (formation) {
    case 'line': return lineFormation(count);
    case 'spearhead': return spearheadFormation(count);
    case 'diamond': return diamondFormation(count);
    case 'wings': return wingsFormation(count);
  }
}

/**
 * Line: ships in a single horizontal row, centred on origin.
 *   1 2 3 4 5
 */
function lineFormation(count: number): FormationPosition[] {
  const positions: FormationPosition[] = [];
  const totalWidth = (count - 1) * FORMATION_SPACING;
  for (let i = 0; i < count; i++) {
    positions.push({
      offsetX: 0,
      offsetY: -totalWidth / 2 + i * FORMATION_SPACING,
    });
  }
  return positions;
}

/**
 * Spearhead: 1 lead, then rows of 2, then 3, then trailing singles.
 *     1
 *    2 3
 *   4 5 6
 *     7
 *     8
 */
function spearheadFormation(count: number): FormationPosition[] {
  const positions: FormationPosition[] = [];
  let placed = 0;
  let row = 0;
  // Phase 1: expanding rows (1, 2, 3)
  const rowSizes = [1, 2, 3];
  for (const size of rowSizes) {
    if (placed >= count) break;
    const rowWidth = (size - 1) * FORMATION_SPACING;
    for (let col = 0; col < size && placed < count; col++) {
      positions.push({
        offsetX: -row * FORMATION_SPACING,
        offsetY: -rowWidth / 2 + col * FORMATION_SPACING,
      });
      placed++;
    }
    row++;
  }
  // Phase 2: trailing singles behind the formation
  while (placed < count) {
    positions.push({
      offsetX: -row * FORMATION_SPACING,
      offsetY: 0,
    });
    placed++;
    row++;
  }
  return positions;
}

/**
 * Diamond: 1, 2, 3, 2, 1 pattern, then overflow as trailing singles.
 *     1
 *    2 3
 *   4 5 6
 *    7 8
 *     9
 */
function diamondFormation(count: number): FormationPosition[] {
  const positions: FormationPosition[] = [];
  const rowSizes = [1, 2, 3, 2, 1];
  let placed = 0;
  let row = 0;
  for (const size of rowSizes) {
    if (placed >= count) break;
    const rowWidth = (size - 1) * FORMATION_SPACING;
    for (let col = 0; col < size && placed < count; col++) {
      positions.push({
        offsetX: -row * FORMATION_SPACING,
        offsetY: -rowWidth / 2 + col * FORMATION_SPACING,
      });
      placed++;
    }
    row++;
  }
  // Overflow: trailing singles
  while (placed < count) {
    positions.push({
      offsetX: -row * FORMATION_SPACING,
      offsetY: 0,
    });
    placed++;
    row++;
  }
  return positions;
}

/**
 * Wings: pairs flanking a lead, repeating in rows of 3.
 *   2 1 3
 *   5 4 6
 *   8 7 9
 */
function wingsFormation(count: number): FormationPosition[] {
  const positions: FormationPosition[] = [];
  let placed = 0;
  let row = 0;
  while (placed < count) {
    // Centre ship
    positions.push({
      offsetX: -row * FORMATION_SPACING,
      offsetY: 0,
    });
    placed++;
    // Left wing
    if (placed < count) {
      positions.push({
        offsetX: -row * FORMATION_SPACING,
        offsetY: -FORMATION_SPACING,
      });
      placed++;
    }
    // Right wing
    if (placed < count) {
      positions.push({
        offsetX: -row * FORMATION_SPACING,
        offsetY: FORMATION_SPACING,
      });
      placed++;
    }
    row++;
  }
  return positions;
}

// ---------------------------------------------------------------------------
// setFormation
// ---------------------------------------------------------------------------

/**
 * Change the formation for one side, repositioning surviving ships.
 * Ships receive move orders toward their new formation positions.
 *
 * When `shipIds` is provided, only those ships are repositioned and
 * the formation is centred on the centroid of the selected subset.
 * All other ships on the side keep their existing orders untouched.
 */
export function setFormation(
  state: TacticalState,
  side: 'attacker' | 'defender',
  formation: FormationType,
  shipIds?: string[],
): TacticalState {
  const allSideShips = state.ships.filter(
    (s) => s.side === side && !s.destroyed && !s.routed,
  );

  // Determine which ships to reposition
  const selectedSet = shipIds ? new Set(shipIds) : null;
  const targetShips = selectedSet
    ? allSideShips.filter((s) => selectedSet.has(s.id))
    : allSideShips;

  // Centre formation on the selected ships' current average position
  let avgX = 0, avgY = 0;
  for (const s of targetShips) { avgX += s.position.x; avgY += s.position.y; }
  avgX /= targetShips.length || 1;
  avgY /= targetShips.length || 1;
  const margin = 200;
  const centreX = Math.max(margin, Math.min(state.battlefieldWidth - margin, avgX));
  const centreY = Math.max(margin, Math.min(state.battlefieldHeight - margin, avgY));
  const positions = getFormationPositions(formation, targetShips.length);

  const targetShipIds = new Set(targetShips.map((s) => s.id));
  let targetIdx = 0;

  // Before battle starts (tick <= 1): set positions INSTANTLY
  // During battle: give move orders that timeout after 30 ticks
  const instant = state.tick <= 1;

  const updatedShips = state.ships.map((s) => {
    if (!targetShipIds.has(s.id)) return s;
    const pos = positions[targetIdx] ?? { offsetX: 0, offsetY: 0 };
    targetIdx++;
    const targetX = centreX + pos.offsetX;
    const targetY = centreY + pos.offsetY;

    if (instant) {
      // Snap to formation position immediately (pre-battle)
      // Ships hold position (idle) — player commands them when ready
      return {
        ...s,
        position: { x: targetX, y: targetY, z: s.position.z },
        order: { type: 'idle' as const },
      };
    }
    // During battle: move to position, then auto-attack on arrival
    return {
      ...s,
      order: { type: 'move' as const, x: targetX, y: targetY },
    };
  });

  return {
    ...state,
    ships: updatedShips,
    [side === 'attacker' ? 'attackerFormation' : 'defenderFormation']: formation,
  };
}

// ---------------------------------------------------------------------------
// Environment generation
// ---------------------------------------------------------------------------

/**
 * Returns true if the point (x, y) is too close to either spawn area.
 * Used to keep environment features away from ship starting positions.
 */
function isNearSpawn(x: number, y: number, bw: number, bh: number): boolean {
  const dAtk = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
  const dDef = Math.sqrt(
    (x - (bw - 100)) ** 2 + (y - (bh - 100)) ** 2,
  );
  return dAtk < ENVIRONMENT_SPAWN_MARGIN || dDef < ENVIRONMENT_SPAWN_MARGIN;
}

/**
 * Generate random environment features scaled to the battlefield size.
 */
export function generateEnvironment(
  rng: () => number = Math.random,
  bfSize: BattlefieldSize = 'small',
): EnvironmentFeature[] {
  const cfg = BATTLEFIELD_SIZE_CONFIG[bfSize];
  const bw = cfg.width;
  const bh = cfg.height;
  const features: EnvironmentFeature[] = [];

  // Scale feature radii with map size so they remain visually proportionate
  const scale = bw / BATTLEFIELD_WIDTH; // 1x for small, 3x medium, 9x large
  const astRadMin = ASTEROID_RADIUS_MIN * Math.sqrt(scale);
  const astRadMax = ASTEROID_RADIUS_MAX * Math.sqrt(scale);
  const nebRadMin = NEBULA_RADIUS_MIN * Math.sqrt(scale);
  const nebRadMax = NEBULA_RADIUS_MAX * Math.sqrt(scale);

  const asteroidCount = cfg.asteroidMin + Math.floor(rng() * (cfg.asteroidMax - cfg.asteroidMin + 1));
  for (let i = 0; i < asteroidCount; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = rng() * bw;
      const y = rng() * bh;
      if (isNearSpawn(x, y, bw, bh)) continue;
      features.push({
        id: `asteroid-${i}`,
        type: 'asteroid',
        x, y,
        radius: astRadMin + rng() * (astRadMax - astRadMin),
      });
      break;
    }
  }

  const nebulaCount = cfg.nebulaMin + Math.floor(rng() * (cfg.nebulaMax - cfg.nebulaMin + 1));
  for (let i = 0; i < nebulaCount; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = rng() * bw;
      const y = rng() * bh;
      if (isNearSpawn(x, y, bw, bh)) continue;
      features.push({
        id: `nebula-${i}`,
        type: 'nebula',
        x, y,
        radius: nebRadMin + rng() * (nebRadMax - nebRadMin),
      });
      break;
    }
  }

  return features;
}

// ---------------------------------------------------------------------------
// initializeTacticalCombat
// ---------------------------------------------------------------------------

/**
 * Build the initial TacticalState from fleet data and ship/design/component
 * lookups.
 *
 * Attackers are placed near (100, 100), defenders near the bottom-right.
 * Ships are arranged in a 3-column grid with 60px spacing.
 */
export function initializeTacticalCombat(
  attackerFleet: Fleet,
  defenderFleet: Fleet,
  attackerShips: Ship[],
  defenderShips: Ship[],
  designs: Map<string, ShipDesign>,
  components: ShipComponent[],
  layout: CombatLayout = 'open_space',
  planetData?: PlanetData,
  battlefieldSize: BattlefieldSize = 'small',
): TacticalState {
  const componentById = new Map(components.map((c) => [c.id, c]));

  // Expand ship arrays to include carried ships (carrier -> destroyer, battle station -> carrier -> destroyer)
  // This recursively deploys all nested ships for combat.
  const allProvidedShips = [...attackerShips, ...defenderShips];
  function expandCarriedShips(sideShips: Ship[]): Ship[] {
    const expanded: Ship[] = [];
    for (const ship of sideShips) {
      expanded.push(ship);
      // Find ships carried by this one
      const carried = allProvidedShips.filter(s => s.carriedBy === ship.id);
      if (carried.length > 0) {
        expanded.push(...expandCarriedShips(carried));
      }
    }
    return expanded;
  }
  // Only expand from top-level (non-carried) ships to avoid duplicates
  const topAttackers = attackerShips.filter(s => !s.carriedBy);
  const topDefenders = defenderShips.filter(s => !s.carriedBy);
  const expandedAttackers = expandCarriedShips(topAttackers);
  const expandedDefenders = expandCarriedShips(topDefenders);

  // Resolve battlefield dimensions from size config
  const bfCfg = BATTLEFIELD_SIZE_CONFIG[battlefieldSize];
  const BW = bfCfg.width;
  const BH = bfCfg.height;

  // Fleets start within engagement range so combat begins quickly.
  // Attackers on the left third, defenders on the right third.
  const defenderBaseX = layout === 'planetary_assault'
    ? BW - 250
    : BW - 120;
  const defenderBaseY = layout === 'planetary_assault'
    ? BH - 200
    : BH * 0.5;

  function buildSide(
    ships: Ship[],
    side: 'attacker' | 'defender',
  ): TacticalShip[] {
    // Ships start at opposite edges of the battlefield
    const baseX = side === 'attacker' ? 120 : defenderBaseX;
    const baseY = side === 'attacker' ? BH * 0.5 : defenderBaseY;
    const facing = side === 'attacker' ? 0 : Math.PI;

    return ships.map((ship, index) => {
      // Line formation: ships spread perpendicular to the enemy (vertical spread)
      // so all ships face the enemy and can fire simultaneously.
      // Row spacing scales with collision extent so large ships don't overlap.
      const design = designs.get(ship.designId);
      const hullTemplate = design ? HULL_TEMPLATE_BY_CLASS[design.hull] : undefined;
      const shipExtents = COLLISION_EXTENTS[hullTemplate?.class as HullClass] ?? DEFAULT_COLLISION_EXTENTS;
      const lineSpacing = Math.max(50, shipExtents.halfLength * 3);
      const colSpacing = Math.max(80, shipExtents.halfLength * 3);
      const totalHeight = (Math.min(ships.length, 8) - 1) * lineSpacing;
      const startY = baseY - totalHeight / 2;
      const col = Math.floor(index / 8); // stagger overflow into depth
      const row = index % 8;
      const x = baseX + col * colSpacing;
      const y = startY + row * lineSpacing;
      // Stagger spawn Z across 3 altitude layers to prevent same-plane clustering
      const zLayer = (index % 3 - 1) * 40; // -40, 0, +40

      const extracted = extractShipStats(design, componentById, ship.magazineLevel ?? 1.0, hullTemplate);

      return {
        id: generateId(),
        sourceShipId: ship.id,
        name: ship.name,
        side,
        position: { x, y, z: zLayer },
        velocity: { x: 0, y: 0, z: 0 },
        facing,
        // Max speed comes from the hull — engines don't make you faster,
        // they make you accelerate faster (more thrust).
        speed: hullTemplate?.baseSpeed ?? extracted.speed,
        // Acceleration = engine thrust / mass.
        acceleration: Math.max(extracted.speed, 1)
          / Math.max(1, Math.sqrt((ship.maxHullPoints + extracted.armour) / 50)),
        // RCS provides direction-independent thrust for braking without turning
        rcsThrust: extracted.rcsThrust ?? 0,
        // Turn rate: base rate / mass, boosted by RCS thruster quality.
        // Less mass = faster rotation. Better RCS = even faster.
        // rcsTurnBonus 0-5 maps to 1.0x-3.0x multiplier (huge impact).
        // Drones get a 2x base. Fighters with top RCS spin very fast.
        turnRate: ((hullTemplate?.manned === false ? 0.20 : 0.10)
          / Math.max(1, Math.sqrt((ship.maxHullPoints + extracted.armour) / 100)))
          * (1.0 + (extracted.rcsTurnBonus ?? 0) * 0.4),
        hull: ship.hullPoints,
        maxHull: ship.maxHullPoints,
        shields: extracted.maxShields,
        maxShields: extracted.maxShields,
        armour: extracted.armour,
        weapons: extracted.weapons,
        sensorRange: extracted.sensorRange,
        order: { type: 'idle' } as ShipOrder,
        stance: 'aggressive' as CombatStance,
        destroyed: false,
        routed: false,
        damageTakenThisTick: 0,
        crew: {
          morale: 80,
          health: 100,
          experience: (ship.crewExperience ?? 'regular') as CrewExperience,
        },
        unmanned: hullTemplate?.manned === false,
        shieldAge: extracted.shieldAge,
        evasionBonus: extracted.evasionBonus,
        missileDeflection: extracted.missileDeflection,
        sensorJamming: extracted.sensorJamming,
        hullClass: hullTemplate?.class as string | undefined,
        collisionRadius: (COLLISION_EXTENTS[hullTemplate?.class as HullClass] ?? DEFAULT_COLLISION_EXTENTS).halfLength,
        collisionExtents: COLLISION_EXTENTS[hullTemplate?.class as HullClass] ?? DEFAULT_COLLISION_EXTENTS,
        stations: hullTemplate?.manned === false
          ? undefined
          : deriveCrewStations(
            (ship.crewExperience ?? 'regular') as CrewExperience,
            extracted.weapons.length > 0,
            extracted.maxShields > 0,
            ship.maxHullPoints >= 150,
          ),
        repairRate: extracted.repairRate ?? 0,
        moraleRecovery: extracted.moraleRecovery ?? 0,
      };
    });
  }

  const ships: TacticalShip[] = [
    ...buildSide(expandedAttackers, 'attacker'),
    ...buildSide(expandedDefenders, 'defender'),
  ];

  // Add orbital defence platforms for planetary assault
  if (layout === 'planetary_assault' && planetData) {
    const planetCX = BW - 200;
    const planetCY = BH - 150;
    const gunCount = Math.max(1, planetData.orbitalGuns);

    for (let i = 0; i < gunCount; i++) {
      const angle = (i / gunCount) * Math.PI * 2;
      const maxHullValue = Math.round(200 * (1 + planetData.defenceRating * 0.5));
      const maxShieldsValue = Math.round(50 * planetData.defenceRating);
      const armourValue = Math.round(30 * planetData.defenceRating);

      ships.push({
        id: `orbital-defense-${i}`,
        sourceShipId: `orbital-defense-${i}`,
        name: `Orbital Defence ${i + 1}`,
        side: 'defender',
        position: {
          x: planetCX + Math.cos(angle) * 120,
          y: planetCY + Math.sin(angle) * 120,
          z: 0,
        },
        velocity: { x: 0, y: 0, z: 0 },
        facing: angle + Math.PI, // face outward
        speed: 0,
        acceleration: 0,
        rcsThrust: 0,
        turnRate: Math.PI, // can rotate freely to aim
        hull: maxHullValue,
        maxHull: maxHullValue,
        shields: maxShieldsValue,
        maxShields: maxShieldsValue,
        armour: armourValue,
        weapons: [{
          componentId: 'orbital_cannon',
          type: 'projectile',
          damage: 25,
          range: 500,
          accuracy: 80,
          cooldownMax: 8,
          cooldownLeft: 0,
          facing: 'turret',
          ammo: 200,
          maxAmmo: 200,
        }],
        sensorRange: 600,
        order: { type: 'idle' } as ShipOrder,
        stance: 'aggressive' as CombatStance,
        destroyed: false,
        routed: false,
        damageTakenThisTick: 0,
        evasionBonus: 0,
        missileDeflection: 0,
        sensorJamming: 0,
        collisionRadius: 30,
        crew: {
          morale: 90,
          health: 100,
          experience: 'veteran' as CrewExperience,
        },
      });
    }
  }

  return {
    tick: 0,
    ships,
    projectiles: [],
    missiles: [],
    fighters: [],
    beamEffects: [],
    pointDefenceEffects: [],
    escapePods: [],
    environment: generateEnvironment(Math.random, battlefieldSize),
    battlefieldWidth: BW,
    battlefieldHeight: BH,
    battlefieldDepth: bfCfg.depth,
    outcome: null,
    attackerFormation: 'line',
    defenderFormation: 'line',
    admirals: [],
    layout,
    planetData,
  };
}

// ---------------------------------------------------------------------------
// Stat extraction
// ---------------------------------------------------------------------------

interface ExtractedStats {
  speed: number;
  turnRate: number;
  rcsThrust: number;
  maxShields: number;
  armour: number;
  sensorRange: number;
  weapons: TacticalWeapon[];
  /** Accuracy bonus from targeting computers (applied to all weapons). */
  accuracyBonus: number;
  /** Evasion bonus from ECM suites (reduces incoming accuracy). */
  evasionBonus: number;
  /** RCS turn rate bonus from thruster components (0-5 scale). */
  rcsTurnBonus: number;
  /** Missile deflection from ECM (chance 0-100 per tick to break missile lock). */
  missileDeflection: number;
  /** Sensor jamming strength from ECM (reduces enemy sensor range). */
  sensorJamming: number;
  /** Best shield tech age on the ship (determines weapon-type effectiveness). */
  shieldAge: string;
  /** Hull repair rate per tick from damage control systems. */
  repairRate: number;
  /** Morale recovery bonus from life support systems. */
  moraleRecovery: number;
}

/**
 * Extract tactical stats from a ShipDesign + components lookup.
 * @param magazineLevel  Magazine fill level 0-1. Scales starting ammo for
 *                       all finite-ammo weapons. Defaults to 1.0 (full).
 */
function extractShipStats(
  design: ShipDesign | undefined,
  componentById: Map<string, ShipComponent>,
  magazineLevel = 1.0,
  hull?: HullTemplate,
): ExtractedStats {
  // Build slot facing lookup from hull template
  const slotFacing = new Map<string, 'fore' | 'aft' | 'port' | 'starboard' | 'turret'>();
  if (hull) {
    for (const slot of hull.slotLayout) {
      slotFacing.set(slot.id, slot.facing);
    }
  }
  const weapons: TacticalWeapon[] = [];
  let speed = 0;
  let maxShields = 0;
  let armour = 0;
  let sensorRange = 0;
  let accuracyBonus = 0;
  let evasionBonus = 0;
  let rcsTurnBonus = 0;
  let missileDeflection = 0;
  let sensorJamming = 0;
  let shieldAge = 'nano_atomic';
  let repairRate = 0;
  let moraleRecovery = 0;

  if (design != null) {
    for (const assignment of design.components) {
      const comp = componentById.get(assignment.componentId);
      if (comp == null) continue;

      const weaponType = mapComponentType(comp.type);
      if (weaponType != null) {
        // Use the actual slot facing from the hull template, fall back to default
        const facing = slotFacing.get(assignment.slotId) ?? defaultWeaponFacing(comp.type);

        if (comp.type === 'fighter_bay') {
          // Fighter bays use per-fighter damage; ammo = number of fighters
          const fighterCount = comp.stats['fighterCount'] ?? 4;
          const scaledFighters = Math.max(1, Math.round(fighterCount * magazineLevel));
          const fighterDmg = comp.stats['damage'] ?? 8;
          weapons.push({
            componentId: comp.id,
            type: weaponType,
            damage: fighterDmg,
            range: (comp.stats['range'] ?? 3) * RANGE_TO_BATTLEFIELD,
            accuracy: comp.stats['accuracy'] ?? 75,
            cooldownMax: computeCooldown(comp),
            cooldownLeft: 0,
            facing,
            ammo: scaledFighters,
            maxAmmo: fighterCount,
          });
        } else {
          const dmg = comp.stats['damage'] ?? 0;
          const baseAmmo = computeAmmo(weaponType, comp.id);
          // Scale finite ammo by magazine level (depleted ships start with less)
          const ammo = baseAmmo != null
            ? Math.max(1, Math.round(baseAmmo * magazineLevel))
            : undefined;

          // PD weapons: carry interceptRate from component stats
          const interceptRate = weaponType === 'point_defense'
            ? (comp.stats['interceptRate'] as number | undefined)
            : undefined;

          // Missile weapons: determine salvo count per volley
          let salvoCount: number | undefined;
          if (weaponType === 'missile') {
            if (comp.stats['missileCount'] != null) {
              salvoCount = comp.stats['missileCount'] as number;
            } else if (comp.stats['submunitionCount'] != null) {
              // Submunition missiles fire 1 (splits handled on impact)
              salvoCount = 1;
            } else {
              // Per-component salvo defaults
              salvoCount = MISSILE_SALVO_DEFAULTS[comp.id] ?? 1;
            }
          }

          weapons.push({
            componentId: comp.id,
            type: weaponType,
            damage: dmg,
            range: (comp.stats['range'] ?? 3) * RANGE_TO_BATTLEFIELD,
            accuracy: comp.stats['accuracy'] ?? 75,
            cooldownMax: computeCooldown(comp),
            cooldownLeft: 0,
            facing,
            ammo,
            maxAmmo: baseAmmo,
            interceptRate,
            salvoCount,
          });
        }
      }

      switch (comp.type) {
        case 'engine':
          speed = Math.max(speed, comp.stats['speed'] ?? 0);
          break;
        case 'rcs_thrusters':
          evasionBonus += comp.stats['evasionBonus'] ?? 0;
          rcsTurnBonus += comp.stats['turnRate'] ?? 0;
          break;
        case 'shield':
          maxShields += comp.stats['shieldStrength'] ?? 0;
          // Track the highest-tech shield age for effectiveness calculation
          if (comp.minAge) {
            const AGE_ORDER = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'];
            const compIdx = AGE_ORDER.indexOf(comp.minAge);
            const curIdx = AGE_ORDER.indexOf(shieldAge);
            if (compIdx > curIdx) shieldAge = comp.minAge;
          }
          break;
        case 'armor':
          armour += comp.stats['armorRating'] ?? 0;
          break;
        case 'sensor':
        case 'advanced_sensors':
        case 'scanner':
          sensorRange = Math.max(sensorRange, (comp.stats['sensorRange'] ?? 0) * RANGE_TO_BATTLEFIELD);
          if (comp.stats['sensorRangeBonus']) {
            sensorRange += comp.stats['sensorRangeBonus'] * RANGE_TO_BATTLEFIELD;
          }
          break;
        case 'targeting_computer':
          accuracyBonus += comp.stats['accuracyBonus'] ?? 0;
          break;
        case 'ecm_suite':
          evasionBonus += comp.stats['evasionBonus'] ?? 0;
          missileDeflection += comp.stats['missileDeflection'] ?? 0;
          sensorJamming += comp.stats['sensorJamming'] ?? 0;
          break;
        case 'damage_control':
        case 'repair_drone':
          repairRate += comp.stats['repairRate'] ?? 0;
          break;
        case 'life_support':
          moraleRecovery += comp.stats['moraleRecovery'] ?? 0;
          break;
        default:
          break;
      }
    }
  }

  // Apply accuracy bonus from targeting computers to all weapons
  if (accuracyBonus > 0) {
    for (const w of weapons) {
      w.accuracy = Math.min(100, w.accuracy + accuracyBonus);
    }
  }

  return {
    speed: speed > 0 ? speed : DEFAULT_SPEED,
    turnRate: DEFAULT_TURN_RATE,
    rcsThrust: evasionBonus * 0.1, // RCS evasion stat → small omnidirectional thrust
    maxShields,
    armour,
    sensorRange: sensorRange > 0 ? sensorRange : DEFAULT_SENSOR_RANGE,
    weapons,
    accuracyBonus,
    evasionBonus,
    rcsTurnBonus,
    missileDeflection: Math.min(missileDeflection, 80), // cap at 80%
    sensorJamming,
    shieldAge,
    repairRate,
    moraleRecovery,
  };
}

/**
 * Compute cooldown in ticks from component stats.
 * Beams fire faster, projectiles/missiles slower.
 * Missiles use per-type profiles (e.g. basic_missile fires rapidly).
 */
function computeCooldown(comp: ShipComponent): number {
  switch (comp.type) {
    case 'weapon_beam': return 10;
    case 'weapon_projectile': return 15;
    case 'weapon_missile': {
      const profile = MISSILE_PROFILES[comp.id];
      return profile?.cooldown ?? 25;
    }
    case 'weapon_point_defense': return 20;
    case 'fighter_bay': return 30;
    default: return 15;
  }
}

/**
 * Compute starting ammo for a weapon type.
 * Beams are energy-based (unlimited), everything else has finite ammo.
 * Missiles use per-type ammo from MISSILE_PROFILES when a componentId is provided.
 */
function computeAmmo(weaponType: WeaponType, componentId?: string): number | undefined {
  switch (weaponType) {
    case 'missile': {
      if (componentId) {
        const profile = MISSILE_PROFILES[componentId];
        if (profile) return profile.ammo;
      }
      return MISSILE_DEFAULT_AMMO;
    }
    case 'projectile': return PROJECTILE_DEFAULT_AMMO;
    case 'point_defense': return POINT_DEFENSE_DEFAULT_AMMO;
    case 'beam': return undefined; // unlimited
    case 'fighter_bay': return undefined; // ammo set from fighterCount in extractShipStats
    default: return undefined;
  }
}

// ---------------------------------------------------------------------------
// findTarget
// ---------------------------------------------------------------------------

/**
 * Find the best target for a ship.
 *
 * If the ship has an attack order with a specific target, prefer that target.
 * Otherwise, find the closest non-destroyed, non-routed enemy.
 */
/**
 * Captain-level target selection.
 *
 * Aggressive: prefer weakest target in range (finish kills).
 * Defensive:  prefer whoever is shooting at us (threat response).
 * At ease:    balanced scoring — threats, opportunity, range efficiency.
 * Evasive:    prefer targets already in range (don't close distance).
 *
 * An explicit attack order still biases toward the ordered target, but
 * the captain may override if the ordered target is unreachable or
 * destroyed and a better opportunity exists.
 */
export function findTarget(ship: TacticalShip, allShips: TacticalShip[]): TacticalShip | null {
  const enemies = allShips.filter(
    (s) => s.side !== ship.side && !s.destroyed && !s.routed,
  );
  if (enemies.length === 0) return null;

  // If we have a specific attack target and it's still alive, heavily prefer it
  if (ship.order.type === 'attack') {
    const tid = ship.order.targetId;
    const preferred = enemies.find((e) => e.id === tid || e.sourceShipId === tid);
    if (preferred != null) {
      // Aggressive ships always obey explicit orders
      if (ship.stance === 'aggressive') return preferred;
      // Other stances: prefer it but allow override if it's far and there's a close threat
      const prefDist = dist(ship.position, preferred.position);
      const maxRange = ship.weapons.length > 0 ? Math.max(...ship.weapons.map(w => w.range)) : 200;
      if (prefDist < maxRange * 1.5) return preferred;
      // Fall through to scoring if ordered target is far away
    }
  }

  // Wing cohesion: wingmen attack the same target as their wing leader
  if (ship.wingId && ship.hullClass === 'fighter') {
    const leader = getWingLeader(ship, allShips);
    if (leader.id !== ship.id && leader.order.type === 'attack') {
      const leaderTargetId = leader.order.targetId;
      const leaderTarget = enemies.find(
        e => e.id === leaderTargetId || e.sourceShipId === leaderTargetId,
      );
      if (leaderTarget) return leaderTarget;
    }
  }

  // Pre-compute how many allies are attacking each enemy (for focus fire scoring)
  const attackTargetCounts = new Map<string, number>();
  const allies = allShips.filter(
    s => s.side === ship.side && !s.destroyed && !s.routed && s.id !== ship.id,
  );
  for (const ally of allies) {
    if (ally.order.type === 'attack') {
      const tid = ally.order.targetId;
      attackTargetCounts.set(tid, (attackTargetCounts.get(tid) ?? 0) + 1);
    }
  }

  // Check if we have missile weapons (for PD ship targeting priority)
  const hasMissiles = ship.weapons.some(w => w.type === 'missile');

  // Get fleet coordination for our side
  const coord = _currentCoordination[ship.side];

  // Score each enemy
  const maxRange = ship.weapons.length > 0 ? Math.max(...ship.weapons.map(w => w.range)) : 200;
  let bestEnemy: TacticalShip | null = null;
  let bestScore = -Infinity;

  for (const enemy of enemies) {
    const d = dist(ship.position, enemy.position);
    let score = 0;

    // --- Damage potential gate: can we meaningfully damage this target? ---
    const dmgAssessment = canMeaningfullyDamage(ship, enemy);
    score += dmgAssessment.score;

    // --- Range factor: prefer enemies within weapon range ---
    if (d <= maxRange) {
      score += 40;
    } else {
      score -= (d - maxRange) * 0.05;
    }

    // --- Vulnerability: damaged targets with weakened defences ---
    const hpFraction = enemy.hull / enemy.maxHull;
    score += (1 - hpFraction) * 25; // low HP = high opportunity
    if (enemy.shields <= 0) score += 15; // shields down = vulnerable
    if (enemy.armour <= 0) score += 10; // armour gone = critical

    // --- Threat: is this enemy shooting at us or our carrier? ---
    const isTargetingUs = enemy.order.type === 'attack' &&
      (enemy.order.targetId === ship.id || enemy.order.targetId === ship.sourceShipId);
    if (isTargetingUs) score += 25;

    // Is the enemy targeting a carrier on our side?
    if (enemy.order.type === 'attack') {
      const enemyTargetId = enemy.order.targetId;
      const enemyTarget = allShips.find(s => s.id === enemyTargetId);
      if (enemyTarget && enemyTarget.side === ship.side &&
          enemyTarget.weapons.some(w => w.type === 'fighter_bay')) {
        score += 15; // defending our carrier
      }
    }

    // DPS threat estimate: how dangerous is this enemy to us?
    const enemyThreatDps = estimateDPS(enemy, ship);
    score += Math.min(20, enemyThreatDps * 3);

    // --- Strategic value: high-value targets ---
    // Carriers are priority targets (they spawn fighters)
    if (enemy.weapons.some(w => w.type === 'fighter_bay')) score += 15;
    // PD ships are priority IF we have missiles
    if (hasMissiles && enemy.weapons.some(w => w.type === 'point_defense')) score += 10;
    // ECM ships degrade our accuracy — worth focusing
    if ((enemy.sensorJamming ?? 0) > 10 || (enemy.evasionBonus ?? 0) > 10) score += 10;

    // --- Focus fire: coordinated attacks on the same target ---
    const alliesOnTarget = attackTargetCounts.get(enemy.id) ?? 0;
    if (alliesOnTarget >= 2 && alliesOnTarget <= 3) {
      score += 20; // good focus fire — pile on
    } else if (alliesOnTarget >= 4) {
      score -= 15; // overkill — spread out
    }

    // --- Fleet coordination bonus from assessFleetSituation ---
    if (coord) {
      const focusBonus = coord.focusTargets.get(enemy.id) ?? 0;
      score += focusBonus;
    }

    // --- Size matching: ships should fight appropriately-sized targets ---
    const sizeRatio = enemy.maxHull / Math.max(ship.maxHull, 1);
    if (sizeRatio > 0.5 && sizeRatio < 2.0) {
      score += 15; // similar size = ideal matchup
    } else if (ship.maxHull > 150 && enemy.maxHull > 150) {
      score += 10; // big ship vs big ship — good engagement
    } else if (ship.maxHull < 80 && enemy.maxHull < 80) {
      score += 10; // small craft dogfight — appropriate
    } else if (ship.maxHull > 150 && enemy.maxHull < 60) {
      score -= 15; // capital ship wasting firepower on a fighter
      if (!dmgAssessment.can) score -= 20; // and we can't even damage it efficiently
    } else if (ship.maxHull < 80 && enemy.maxHull > 300) {
      // Small ship vs capital — penalise if we cannot damage it
      if (!dmgAssessment.can) score -= 20;
    }

    // --- Stance-specific weighting ---
    switch (ship.stance) {
      case 'aggressive':
        // Aggressive: favour weakest targets (finish kills)
        score += (1 - hpFraction) * 20;
        break;
      case 'defensive':
        // Defensive: heavily favour threats shooting at us
        if (isTargetingUs) score += 40;
        // Ignore distant enemies
        if (d > maxRange) score -= 30;
        break;
      case 'at_ease':
        // Balanced — default scoring is fine
        break;
      case 'evasive':
        // Prefer targets already in range (don't chase)
        if (d > maxRange) score -= 50;
        break;
    }

    // --- Wing target diversity: fighters in different wings prefer different targets ---
    if (ship.wingId && ship.hullClass === 'fighter') {
      const otherWingsOnTarget = allShips.filter(
        s => s.side === ship.side && s.wingId && s.wingId !== ship.wingId &&
             !s.destroyed && !s.routed && s.hullClass === 'fighter' &&
             s.order.type === 'attack' &&
             (s.order.targetId === enemy.id || s.order.targetId === enemy.sourceShipId),
      ).length;
      if (otherWingsOnTarget >= 3) score -= 25;
      else if (otherWingsOnTarget >= 1) score -= 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  return bestEnemy;
}

// ---------------------------------------------------------------------------
// moveShip
// ---------------------------------------------------------------------------

/**
 * Compute the new position and facing for a single ship based on its
 * order AND stance. Stance is the primary behaviour driver — it
 * determines HOW the ship executes its order.
 *
 *  aggressive — close to engage distance, stay there
 *  defensive  — hold position, only reposition if threatened
 *  at_ease    — captain's judgement: engage, reposition, assist allies
 *  evasive    — maintain maximum weapon range, kite enemies
 *  flee       — head to map edge
 */
export function moveShip(ship: TacticalShip, state: TacticalState): TacticalShip {
  if (ship.destroyed || ship.routed) return ship;

  const updated = {
    ...ship,
    position: { ...ship.position },
  };

  // --- Unmanned craft (drones) never flee — they fight to destruction ---
  if (!ship.unmanned) {
    // --- Flee always runs first — no self-assessment re-entry risk ---
    if (ship.order.type === 'flee' || ship.stance === 'flee') {
      const fleeTarget = ship.side === 'attacker'
        ? { x: -50, y: -50 }
        : { x: state.battlefieldWidth + 50, y: state.battlefieldHeight + 50 };
      const result = moveToward(updated, fleeTarget, 2, state.environment, state.ships);
      const fleeHalfDepth = (state.battlefieldDepth ?? 400) / 2;
      if (
        result.position.x < -20 || result.position.x > state.battlefieldWidth + 20 ||
        result.position.y < -20 || result.position.y > state.battlefieldHeight + 20 ||
        result.position.z < -fleeHalfDepth - 20 || result.position.z > fleeHalfDepth + 20
      ) {
        result.routed = true;
      }
      return result;
    }

    // ── Captain self-assessment (runs AFTER flee handler to prevent recursion) ──
    // Only triggers under extreme conditions with active incoming damage.
    const hpFraction = ship.hull / ship.maxHull;
    const shieldFraction = ship.maxShields > 0 ? ship.shields / ship.maxShields : 1;
    const morale = ship.crew.morale;

    if (ship.stance !== 'aggressive') {
      // Critical hull damage while under fire and shields gone → flee
      if (hpFraction < 0.15 && shieldFraction < 0.1 && ship.damageTakenThisTick > 0) {
        updated.order = { type: 'flee' };
        updated.stance = 'flee';
        const fleeTarget = ship.side === 'attacker'
          ? { x: -50, y: -50 }
          : { x: state.battlefieldWidth + 50, y: state.battlefieldHeight + 50 };
        return moveToward(updated, fleeTarget, 2, state.environment, state.ships);
      }
      // Low morale AND actually taking hull damage → flee
      // (shields still up = not in mortal danger, hold the line)
      if (morale < 10 && hpFraction < 0.5) {
        updated.order = { type: 'flee' };
        updated.stance = 'flee';
        const fleeTarget = ship.side === 'attacker'
          ? { x: -50, y: -50 }
          : { x: state.battlefieldWidth + 50, y: state.battlefieldHeight + 50 };
        return moveToward(updated, fleeTarget, 2, state.environment, state.ships);
      }
      // Shields gone + badly hurt → tactical retreat
      if (shieldFraction < 0.05 && hpFraction < 0.3 && ship.maxShields > 0 && ship.damageTakenThisTick > 0) {
        const retreatX = ship.side === 'attacker' ? 80 : state.battlefieldWidth - 80;
        return moveToward(updated, { x: retreatX, y: ship.position.y }, 20, state.environment, state.ships);
      }
    }
  }

  // --- Move order: navigate to waypoint regardless of stance ---
  if (ship.order.type === 'move') {
    const waypoint = { x: ship.order.x, y: ship.order.y };
    const d = dist(updated.position, waypoint);
    if (d <= 5) {
      // Arrived — switch to idle, stance takes over
      return { ...updated, order: { type: 'idle' } };
    }
    // At ease / aggressive: divert to engage enemies near the path
    if (ship.stance === 'at_ease' || ship.stance === 'aggressive') {
      const enemy = findTarget(ship, state.ships);
      if (enemy != null) {
        const eDist = dist(ship.position, enemy.position);
        const detectionRange = engageDistance(ship) * 2.5;
        if (eDist < detectionRange) {
          return moveToward(updated, enemy.position, engageDistance(ship), state.environment, state.ships);
        }
      }
    }
    return moveToward(updated, waypoint, 2, state.environment, state.ships);
  }

  // --- Defend order: stay near ally, engage threats to that ally ---
  if (ship.order.type === 'defend') {
    const defendId = ship.order.targetId;
    const ally = state.ships.find(
      (s) => (s.id === defendId || s.sourceShipId === defendId) && !s.destroyed,
    );
    if (ally != null) {
      // Find enemies threatening our ward
      const threatToAlly = state.ships.find(
        (s) => s.side !== ship.side && !s.destroyed && !s.routed &&
          s.order.type === 'attack' &&
          (s.order.targetId === ally.id || s.order.targetId === ally.sourceShipId),
      );
      if (threatToAlly != null) {
        // Intercept the threat
        return moveToward(updated, threatToAlly.position, engageDistance(ship), state.environment, state.ships);
      }
      // No threat — stay near ally
      const allyDist = dist(ship.position, ally.position);
      if (allyDist > 60) {
        return moveToward(updated, ally.position, 40, state.environment, state.ships);
      }
    }
    // Fall through to stance-based idle behaviour
  }

  // --- Attack order or idle: stance determines movement ---
  const target = findTarget(ship, state.ships);
  if (target == null) return updated;

  const d = dist(ship.position, target.position);
  const maxRange = ship.weapons.length > 0 ? Math.max(...ship.weapons.map(w => w.range)) : 200;

  // Assess the enemy's threat range — don't close to within their best damage zone
  const enemyNonPD = target.weapons.filter(w => w.type !== 'point_defense');
  const enemyMaxRange = enemyNonPD.length > 0 ? Math.max(...enemyNonPD.map(w => w.range)) : 0;
  // If our range exceeds theirs, prefer to stay at OUR max range (kite advantage)
  const smartEngageDist = maxRange > enemyMaxRange * 1.2
    ? maxRange * 0.85  // stay near our max range — outside theirs
    : engageDistance(ship);

  // ── Anti-bunching: compute a spacing offset blended into movement ──
  // Ships steer away from nearby allies to avoid splash/AOE and overlap.
  // This is blended into the target position, NOT an early return,
  // so ships still advance while spreading.
  // Ally spacing must exceed collision radii so ships don't constantly bump
  const MINIMUM_ALLY_SPACING = ship.maxHull < 80 ? 40
    : ship.maxHull < 200 ? 70
    : ship.maxHull < 400 ? 120
    : 180;
  let spreadX = 0;
  let spreadY = 0;
  let spreadZ = 0;  // Vertical escape vector for 3D anti-bunching
  const allies = state.ships.filter(
    (s) => s.side === ship.side && s.id !== ship.id && !s.destroyed && !s.routed,
  );
  for (const ally of allies) {
    const allyDist = dist(ship.position, ally.position);
    if (allyDist < MINIMUM_ALLY_SPACING && allyDist > 1) {
      const t = (MINIMUM_ALLY_SPACING - allyDist) / MINIMUM_ALLY_SPACING;
      const pushStrength = t * t * 8;
      spreadX += (ship.position.x - ally.position.x) / allyDist * pushStrength;
      spreadY += (ship.position.y - ally.position.y) / allyDist * pushStrength;
      // Vertical escape: push up/down to avoid bunching in z-axis
      // Small ships get much stronger Z-push since they cluster tightly
      const zMultiplier = ship.maxHull < 80 ? 6.0 : ship.maxHull < 200 ? 3.5 : 2.0;
      const allyDz = ship.position.z - ally.position.z;
      if (Math.abs(allyDz) < 10) {
        // Same altitude — escape vertically based on deterministic ID comparison
        const zDir = ship.id > ally.id ? 1 : -1;
        spreadZ += zDir * pushStrength * zMultiplier;
      } else {
        spreadZ += (allyDz / Math.abs(allyDz)) * pushStrength * (zMultiplier * 0.5);
      }
    }
  }

  // ── Fighter-class ships use attack-pass dogfighting AI ──
  // This overrides ALL stances for fighters — they always make attack runs.
  // (Except flee, which is handled above.)
  const isFighter = ship.hullClass === 'fighter';
  if (isFighter) {
    return fighterCombatAI(updated, ship, target, state, spreadX, spreadY, spreadZ);
  }

  // Small craft threshold — drones, bombers flank instead of charging
  const isSmallCraft = ship.maxHull < 80;

  // Compute engagement range bands for regular ships
  const range = computeEngagementRange(ship, target);

  switch (ship.stance) {
    case 'aggressive': {
      if (isSmallCraft && target.maxHull > ship.maxHull * 2) {
        return smallCraftFlank(updated, ship, target, state, spreadX, spreadY, spreadZ);
      }
      // Regular ships: orbit at close range, press attack
      return orbitTarget(updated, target, range.optimal, state, spreadX, spreadY, spreadZ);
    }

    case 'defensive': {
      if (d <= maxRange) {
        // In range — slow orbit at current distance (maintain spacing, don't charge)
        const defOrbitRadius = Math.max(range.min, Math.min(d, range.max));
        return orbitTarget(updated, target, defOrbitRadius, state, 0, 0, 0);
      }
      // Out of range with explicit attack order — close to max range edge
      if (ship.order.type === 'attack') {
        return moveToward(updated, target.position, maxRange * 0.9, state.environment, state.ships);
      }
      return updated;
    }

    case 'at_ease': {
      // Captain's judgement — commander threat assessment drives overrides.
      //
      // Commander override: hopeless engagement — disengage
      if (ship.threatAssessment?.hopeless) {
        const fleeTarget = ship.side === 'attacker'
          ? { x: -50, y: -50 }
          : { x: state.battlefieldWidth + 50, y: state.battlefieldHeight + 50 };
        return moveToward(updated, fleeTarget, 0, state.environment, state.ships);
      }

      // Commander override: retreat to allies when situation is dire
      if (ship.threatAssessment?.shouldRetreat) {
        const allyForRetreat = state.ships
          .filter(s => s.side === ship.side && s.id !== ship.id && !s.destroyed && !s.routed)
          .reduce<TacticalShip | null>((best, s) => {
            const sd = dist(ship.position, s.position);
            return (!best || sd < dist(ship.position, best.position)) ? s : best;
          }, null);
        if (allyForRetreat) {
          return moveToward(updated, allyForRetreat.position, 40, state.environment, state.ships);
        }
      }

      // Check if any enemy is actively targeting us
      const threatToUs = state.ships.find(
        (s) => s.side !== ship.side && !s.destroyed && !s.routed &&
          s.order.type === 'attack' &&
          (s.order.targetId === ship.id || s.order.targetId === ship.sourceShipId),
      );

      if (threatToUs) {
        const threatDist = dist(ship.position, threatToUs.position);
        if (threatDist <= smartEngageDist * 1.1) {
          // Threat within engagement range — orbit them
          return orbitTarget(updated, threatToUs, range.optimal, state, spreadX, spreadY, spreadZ);
        }
        // Threat beyond engagement range — close
        return moveToward(updated, threatToUs.position, smartEngageDist, state.environment, state.ships);
      }

      // Cover a retreating or weakened ally — interpose between them and the enemy
      const weakAllies = state.ships.filter(
        (s) => s.side === ship.side && s.id !== ship.id && !s.destroyed && !s.routed &&
          (s.hull / s.maxHull < 0.4 || s.order.type === 'flee' || s.stance === 'flee'),
      );
      if (weakAllies.length > 0) {
        let wardAlly: TacticalShip | null = null;
        let wardDist = maxRange * 2;
        for (const ally of weakAllies) {
          const ad = dist(ship.position, ally.position);
          if (ad < wardDist) { wardAlly = ally; wardDist = ad; }
        }
        if (wardAlly) {
          const enemyToAlly = state.ships
            .filter(s => s.side !== ship.side && !s.destroyed && !s.routed)
            .reduce<TacticalShip | null>((best, e) => {
              const ed = dist(wardAlly!.position, e.position);
              return (!best || ed < dist(wardAlly!.position, best.position)) ? e : best;
            }, null);
          if (enemyToAlly) {
            const midX = (wardAlly.position.x + enemyToAlly.position.x) / 2;
            const midY = (wardAlly.position.y + enemyToAlly.position.y) / 2;
            return moveToward(updated, { x: midX, y: midY }, 20, state.environment, state.ships);
          }
        }
      }

      // Check if a nearby ally is under fire
      const alliesUnderFire = state.ships.filter(
        (s) => s.side === ship.side && s.id !== ship.id && !s.destroyed && !s.routed &&
          s.damageTakenThisTick > 0,
      );
      if (alliesUnderFire.length > 0) {
        let closestAlly = alliesUnderFire[0]!;
        let closestAllyDist = dist(ship.position, closestAlly.position);
        for (const ally of alliesUnderFire) {
          const ad = dist(ship.position, ally.position);
          if (ad < closestAllyDist) { closestAlly = ally; closestAllyDist = ad; }
        }
        if (closestAllyDist < maxRange * 2) {
          // Orbit near ally under fire to provide cover
          return orbitTarget(updated, closestAlly, range.optimal * 0.5, state, spreadX, spreadY, spreadZ);
        }
      }

      // Small craft always orbit — never hold position or do simple approach
      if (isSmallCraft && target.maxHull > ship.maxHull * 2) {
        return smallCraftFlank(updated, ship, target, state, spreadX, spreadY);
      }

      // Within engagement range — orbit at smart distance
      if (d <= smartEngageDist * 1.1) {
        return orbitTarget(updated, target, range.optimal, state, spreadX, spreadY, spreadZ);
      }

      // Out of range — close to engagement distance
      // With an explicit attack order: flank approach then orbit
      if (ship.order.type === 'attack') {
        const angleToTarget = angleTo(ship.position, target.position);
        const flankOffset = ship.id.charCodeAt(0) % 2 === 0 ? 0.4 : -0.4;
        const flankAngle = angleToTarget + flankOffset;
        const flankX = target.position.x - Math.cos(flankAngle) * smartEngageDist;
        const flankY = target.position.y - Math.sin(flankAngle) * smartEngageDist;
        return moveToward(updated, { x: flankX, y: flankY }, 10, state.environment, state.ships);
      }
      return orbitTarget(updated, target, range.optimal, state, spreadX, spreadY, spreadZ);
    }

    case 'evasive': {
      // Kite — orbit at near-max range, retreat if enemies close inside 70%
      if (d < maxRange * 0.7) {
        // Too close — retreat away from target
        const awayX = ship.position.x + (ship.position.x - target.position.x);
        const awayY = ship.position.y + (ship.position.y - target.position.y);
        return moveToward(updated, { x: awayX, y: awayY }, 0, state.environment, state.ships);
      }
      if (d > maxRange * 1.1) {
        // Too far — close to max range edge
        return moveToward(updated, target.position, maxRange * 0.9, state.environment, state.ships);
      }
      // In firing band — orbit at near-max range
      return orbitTarget(updated, target, maxRange * 0.9, state, spreadX, spreadY, spreadZ);
    }

    default:
      return updated;
  }
}

/** No drag in space — momentum is conserved. Ships drift at constant
 *  velocity until they thrust in another direction. The only way to
 *  stop is to turn around and burn retrograde. */
const SPACE_DRAG = 1.0;
/** Max velocity magnitude (prevents runaway speeds). */
const MAX_VELOCITY = 12;

/**
 * Crew imprecision — less experienced helmsmen introduce small random
 * errors in thrust, rotation, and braking. Elite crews are precise but
 * not robotic. This creates natural-looking variance in ship movement.
 *
 * Returns a multiplier in the range [1 - jitter, 1 + jitter].
 */
const CREW_JITTER: Record<CrewExperience, number> = {
  recruit: 0.08,    // ±8% — noticeably wobbly
  trained: 0.06,    // ±6%
  regular: 0.04,    // ±4% — baseline competence
  seasoned: 0.03,   // ±3%
  veteran: 0.02,    // ±2%
  hardened: 0.015,  // ±1.5%
  elite: 0.01,      // ±1% — very precise
  ace: 0.008,       // ±0.8%
  legendary: 0.005, // ±0.5% — near-perfect but still human
};

function crewJitterMul(experience: CrewExperience): number {
  const jitter = CREW_JITTER[experience] ?? 0.04;
  return 1 + (Math.random() * 2 - 1) * jitter;
}

/**
 * Hold position: face a direction while applying drift + retrograde braking.
 * Ships don't stop instantly — they decelerate over several ticks.
 */
function holdAndFace(ship: TacticalShip, faceAngle: number): TacticalShip {
  const exp = ship.crew.experience;
  const angleDiff = normaliseAngle(faceAngle - ship.facing);
  // Helmsman jitter on rotation — slight over/under-steer
  const turnAmount = clamp(angleDiff, -ship.turnRate, ship.turnRate) * crewJitterMul(exp);
  const newFacing = normaliseAngle(ship.facing + turnAmount);

  let vx = (ship.velocity?.x ?? 0) * SPACE_DRAG;
  let vy = (ship.velocity?.y ?? 0) * SPACE_DRAG;
  let nvz = (ship.velocity?.z ?? 0) * SPACE_DRAG;
  const currentSpeed = Math.sqrt(vx * vx + vy * vy + nvz * nvz);

  // Braking in space — two options:
  // 1. Main engine: effective only when facing roughly retrograde
  // 2. RCS thrusters: always apply retrograde regardless of facing (weaker)
  if (currentSpeed > 0.2) {
    const retroAngle = Math.atan2(-vy, -vx);

    // Main engine braking — depends on facing
    const facingDelta = Math.abs(normaliseAngle(newFacing - retroAngle));
    const mainBrakeEfficiency = Math.max(0, Math.cos(facingDelta));
    const mainBrake = (ship.acceleration ?? ship.speed) * 0.3 * mainBrakeEfficiency * crewJitterMul(exp);
    vx += Math.cos(newFacing) * mainBrake;
    vy += Math.sin(newFacing) * mainBrake;

    // RCS braking — always retrograde, regardless of facing (weaker)
    const rcsBrake = (ship.rcsThrust ?? 0) * crewJitterMul(exp);
    if (rcsBrake > 0) {
      vx += Math.cos(retroAngle) * rcsBrake;
      vy += Math.sin(retroAngle) * rcsBrake;
    }

    // RCS z-axis braking — brake vertical drift via omnidirectional thrusters
    if (Math.abs(nvz) > 0.01) {
      const rcsThrust = (ship.rcsThrust ?? 0) * crewJitterMul(exp);
      const zBrake = Math.min(Math.abs(nvz), rcsThrust > 0 ? rcsThrust : (ship.acceleration ?? ship.speed) * 0.1);
      nvz -= Math.sign(nvz) * zBrake;
    }
  }

  return {
    ...ship,
    facing: newFacing,
    velocity: { x: vx, y: vy, z: nvz },
    position: {
      x: ship.position.x + vx,
      y: ship.position.y + vy,
      z: ship.position.z + nvz,
    },
  };
}

/**
 * Newtonian movement: thrust toward target, accumulate velocity, drift.
 * Ships have inertia — they accelerate toward a target but can't stop
 * instantly. Heavier ships (lower speed stat) have less thrust.
 * Helmsmen steer around debris fields and asteroid clusters.
 */
function moveToward(
  ship: TacticalShip,
  target: { x: number; y: number; z?: number },
  minDist: number,
  environment?: EnvironmentFeature[],
  allShips?: TacticalShip[],
): TacticalShip {
  const d = dist(ship.position, target);
  const vx = ship.velocity?.x ?? 0;
  const vy = ship.velocity?.y ?? 0;
  const vz = ship.velocity?.z ?? 0;
  const currentSpeed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // Threat-aware facing: if enemies are nearby, factor them into our
  // facing decision so we naturally circle to deny flanks
  const enemies = allShips
    ? allShips.filter(s => s.side !== ship.side && !s.destroyed && !s.routed)
    : [];
  let desiredAngle = enemies.length > 0
    ? computeThreatAwareFacing(ship, target, enemies)
    : angleTo(ship.position, target);

  // ── Debris / asteroid avoidance ────────────────────────────────────
  if (environment && environment.length > 0) {
    for (const feature of environment) {
      if (feature.type !== 'debris' && feature.type !== 'asteroid') continue;
      const featureDist = dist(ship.position, feature);
      if (featureDist > d) continue;
      if (featureDist < feature.radius * 0.5) continue;
      const angleToFeature = angleTo(ship.position, feature);
      const angleDelta = Math.abs(normaliseAngle(desiredAngle - angleToFeature));
      const angularSize = Math.atan2(feature.radius * 1.3, featureDist);
      if (angleDelta < angularSize) {
        const steerSign = normaliseAngle(desiredAngle - angleToFeature) >= 0 ? 1 : -1;
        desiredAngle = angleToFeature + angularSize * 1.2 * steerSign;
      }
    }
  }

  // Turn toward desired angle — helmsman jitter on rotation
  const exp = ship.crew.experience;
  const angleDiff = normaliseAngle(desiredAngle - ship.facing);
  const turnAmount = clamp(angleDiff, -ship.turnRate, ship.turnRate) * crewJitterMul(exp);
  const newFacing = normaliseAngle(ship.facing + turnAmount);

  // ── Thrust calculation ─────────────────────────────────────────────
  // ship.acceleration = thrust per tick (lighter ships accelerate faster)
  // ship.speed = max velocity cap
  const thrustJitter = crewJitterMul(exp);
  const accel = (ship.acceleration ?? ship.speed) * thrustJitter;
  let newVx = vx;
  let newVy = vy;
  let newVz = vz;

  // ── 3D pitch: compute desired vertical angle to target ──
  const targetZ = (target as { z?: number }).z ?? 0;
  const dz = targetZ - ship.position.z;
  const horizDist = Math.sqrt(
    (target.x - ship.position.x) ** 2 + (target.y - ship.position.y) ** 2,
  );
  const desiredPitch = horizDist > 1 ? Math.atan2(dz, horizDist) : 0;

  // Anticipatory braking: start slowing down when stopping distance
  // exceeds remaining distance. Prevents overshoot at engagement range.
  const closingSpeed = d > 0.1
    ? -(vx * (target.x - ship.position.x) + vy * (target.y - ship.position.y) + vz * dz) / d
    : 0; // negative = closing
  const brakeAccel = accel * 0.3 + (ship.rcsThrust ?? 0);
  const stoppingDist = brakeAccel > 0.01 ? (Math.max(0, -closingSpeed) ** 2) / (2 * brakeAccel) : 0;
  const needsBraking = d > minDist && (d - minDist) < stoppingDist * 1.2;

  if (d > minDist && !needsBraking) {
    // Thrust toward target — project main engine in 3D (yaw + pitch)
    const jitterAngle = (CREW_JITTER[exp] ?? 0.04) * (Math.random() * 2 - 1);
    const thrustAngle = newFacing + jitterAngle;
    const cosPitch = Math.cos(desiredPitch);
    newVx += Math.cos(thrustAngle) * cosPitch * accel * 0.3;
    newVy += Math.sin(thrustAngle) * cosPitch * accel * 0.3;
    newVz += Math.sin(desiredPitch) * accel * 0.3;
  } else if (currentSpeed > 0.3) {
    // Within minDist — need to slow down.
    const retroAngle = Math.atan2(-vy, -vx);

    // Main engine braking — only effective when facing retrograde
    const facingDelta = Math.abs(normaliseAngle(newFacing - retroAngle));
    const mainBrakeEfficiency = Math.max(0, Math.cos(facingDelta));
    const mainBrake = accel * 0.3 * mainBrakeEfficiency * crewJitterMul(exp);
    newVx += Math.cos(newFacing) * mainBrake;
    newVy += Math.sin(newFacing) * mainBrake;

    // RCS braking — always retrograde regardless of facing
    const rcsBrake = (ship.rcsThrust ?? 0) * crewJitterMul(exp);
    if (rcsBrake > 0) {
      newVx += Math.cos(retroAngle) * rcsBrake;
      newVy += Math.sin(retroAngle) * rcsBrake;
    }

    // RCS z-axis braking — slow vertical drift when stopping
    if (Math.abs(newVz) > 0.01) {
      const zBrake = Math.min(Math.abs(newVz), rcsBrake > 0 ? rcsBrake : accel * 0.1);
      newVz -= Math.sign(newVz) * zBrake;
    }
  }

  // ── Forward collision prediction: steer to avoid ships in our path ──
  if (allShips) {
    const velMag = Math.sqrt(newVx * newVx + newVy * newVy + newVz * newVz);
    const lookAheadDist = Math.max(40, velMag * 12);
    if (velMag > 0.1) {
      for (const other of allShips) {
        if (other.id === ship.id || other.destroyed || other.routed) continue;
        const otherDist = dist(ship.position, other.position);
        if (otherDist > lookAheadDist || otherDist < 1) continue;

        // Are we heading toward this ship?
        const toX = other.position.x - ship.position.x;
        const toY = other.position.y - ship.position.y;
        const toZ = other.position.z - ship.position.z;
        const dotVel = (newVx * toX + newVy * toY + newVz * toZ) / (otherDist * velMag);
        if (dotVel < 0.3) continue; // not heading toward them

        // Check perpendicular clearance
        const minSep = (ship.collisionRadius + (other.collisionRadius ?? 10)) * 2.5;
        const perpDistSq = otherDist * otherDist * (1 - dotVel * dotVel);
        if (perpDistSq < minSep * minSep) {
          // Collision course — apply evasive Z-thrust
          const urgency = (1 - otherDist / lookAheadDist) * 3.0;
          const escapeDir = toZ >= 0 ? -1 : 1; // go opposite vertical direction
          // Same-side ships get full vertical escape; enemies get softer avoidance
          if (other.side === ship.side) {
            newVz += escapeDir * urgency * (ship.acceleration ?? ship.speed);
          } else {
            newVz += escapeDir * urgency * (ship.acceleration ?? ship.speed) * 0.5;
          }
        }
      }
    }
  }

  // ── Altitude damping: gentle return toward z=0, weakened when under fire ──
  // Ships taking damage maintain altitude for evasion; undamaged ships settle.
  const isUnderFire = ship.damageTakenThisTick > 0;
  const zDampStrength = isUnderFire ? 0.02 : 0.1;
  const zThreshold = isUnderFire ? 120 : 50;
  if (Math.abs(ship.position.z) > zThreshold) {
    newVz -= Math.sign(ship.position.z) * (ship.acceleration ?? ship.speed) * zDampStrength;
  }

  // Apply drag (simulates micro-thruster corrections / space friction lite)
  newVx *= SPACE_DRAG;
  newVy *= SPACE_DRAG;
  newVz *= SPACE_DRAG;

  // Clamp to max velocity — includes z component (ship.speed is the speed cap)
  const maxV = ship.speed ?? MAX_VELOCITY;
  const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy + newVz * newVz);
  if (newSpeed > maxV) {
    const scale = maxV / newSpeed;
    newVx *= scale;
    newVy *= scale;
    newVz *= scale;
  }

  // Apply velocity to position
  const nx = ship.position.x + newVx;
  const ny = ship.position.y + newVy;
  const nz = ship.position.z + newVz;

  return {
    ...ship,
    facing: newFacing,
    velocity: { x: newVx, y: newVy, z: newVz },
    position: { x: nx, y: ny, z: nz },
  };
}

// ---------------------------------------------------------------------------
// Engagement range bands — replaces single-distance engage logic
// ---------------------------------------------------------------------------

interface EngagementRange {
  /** Absolute minimum — never orbit closer than this. */
  min: number;
  /** Stance-adjusted sweet spot for orbiting. */
  optimal: number;
  /** Longest weapon range — furthest the ship can meaningfully fire. */
  max: number;
}

/**
 * Compute min / optimal / max engagement ranges for a ship against a target.
 * Stance determines the optimal fraction:
 *   aggressive=0.6x, defensive=0.85x, at_ease=0.75x, evasive=0.95x.
 * If the ship outranges the enemy by 20%+, optimal is pushed outside enemy range.
 */
function computeEngagementRange(ship: TacticalShip, target: TacticalShip): EngagementRange {
  const nonPD = ship.weapons.filter(w => w.type !== 'point_defense');
  if (nonPD.length === 0) return { min: 60, optimal: 100, max: 200 };

  const shortestRange = Math.min(...nonPD.map(w => w.range));
  const longestRange = Math.max(...nonPD.map(w => w.range));

  const min = Math.max(30, shortestRange * 0.3);

  // Stance-based optimal fraction of shortest weapon range
  const stanceFraction: Record<CombatStance, number> = {
    aggressive: 0.6,
    defensive: 0.85,
    at_ease: 0.75,
    evasive: 0.95,
    flee: 0.95,
  };
  const fraction = stanceFraction[ship.stance] ?? 0.75;
  let optimal = shortestRange * fraction;

  // Kite advantage: if we outrange the enemy by 20%+, stay outside their range
  const enemyNonPD = target.weapons.filter(w => w.type !== 'point_defense');
  const enemyMaxRange = enemyNonPD.length > 0 ? Math.max(...enemyNonPD.map(w => w.range)) : 0;
  if (longestRange > enemyMaxRange * 1.2 && enemyMaxRange > 0) {
    optimal = Math.max(min * fraction, enemyMaxRange * 1.1);
  }

  // Clamp optimal within [min, longestRange]
  optimal = Math.max(min, Math.min(longestRange, optimal));

  return { min, optimal, max: longestRange };
}

/**
 * The distance at which a ship stops approaching its target.
 * Backward-compatible wrapper — returns the optimal engagement distance.
 */
function engageDistance(ship: TacticalShip): number {
  if (ship.weapons.length === 0) return 100;
  const nonPD = ship.weapons.filter(w => w.type !== 'point_defense');
  if (nonPD.length === 0) return 100;
  const minRange = Math.min(...nonPD.map((w) => w.range));
  return minRange * ENGAGE_RANGE_FRACTION;
}

// ---------------------------------------------------------------------------
// Orbit direction — biased toward allies, away from flankers
// ---------------------------------------------------------------------------

/**
 * Returns +1 (counter-clockwise) or -1 (clockwise) orbit direction.
 * Biases toward allies (orbit brings the ship closer to friendlies) and
 * away from flanking enemies. Deterministic tiebreak from ship ID.
 */
function computeOrbitDirection(
  ship: TacticalShip,
  target: TacticalShip,
  allShips: TacticalShip[],
): number {
  const currentAngle = angleTo(target.position, ship.position);
  let ccwScore = 0; // positive = counter-clockwise is better

  // Bias toward allies: check which direction brings us closer to friendlies
  const allies = allShips.filter(
    s => s.side === ship.side && s.id !== ship.id && !s.destroyed && !s.routed,
  );
  for (const ally of allies) {
    const allyAngle = angleTo(target.position, ally.position);
    const delta = normaliseAngle(allyAngle - currentAngle);
    // Positive delta = ally is in the CCW direction
    ccwScore += delta > 0 ? 1 : -1;
  }

  // Bias away from flanking enemies: enemies in our orbit direction are dangerous
  const enemies = allShips.filter(
    s => s.side !== ship.side && s.id !== target.id && !s.destroyed && !s.routed,
  );
  for (const enemy of enemies) {
    const enemyAngle = angleTo(target.position, enemy.position);
    const delta = normaliseAngle(enemyAngle - currentAngle);
    // If enemy is CCW from us, orbiting CCW takes us toward them — penalty
    ccwScore -= delta > 0 ? 1.5 : -1.5;
  }

  // Deterministic tiebreak from ship ID
  if (Math.abs(ccwScore) < 0.5) {
    const idByte = ship.id.charCodeAt(0) + ship.id.charCodeAt(ship.id.length - 1);
    return idByte % 2 === 0 ? 1 : -1;
  }

  return ccwScore > 0 ? 1 : -1;
}

// ---------------------------------------------------------------------------
// Evasive jink — lateral + vertical displacement under fire
// ---------------------------------------------------------------------------

/**
 * Apply evasive jink displacement when a ship is taking damage.
 * Intensity scales with navigator quality, ship size (smaller = more agile),
 * and morale. Uses tick-based deterministic seed for consistent per-tick behaviour.
 *
 * Returns adjusted goal position offsets { jinkX, jinkY, jinkZ }.
 */
function applyJink(
  ship: TacticalShip,
  tick: number,
): { jinkX: number; jinkY: number; jinkZ: number } {
  if (ship.damageTakenThisTick <= 0) return { jinkX: 0, jinkY: 0, jinkZ: 0 };

  // Navigator quality determines jink effectiveness (0-1 range)
  const navQuality = ship.stations?.navigator?.quality ?? 50;
  const navEff = ship.stations?.navigator?.effectiveness ?? 1.0;
  const navFactor = (navQuality / 100) * navEff;

  // Ship size factor: smaller ships jink more aggressively
  // maxHull < 80 = small, < 300 = medium, >= 300 = capital
  const sizeFactor = ship.maxHull < 80
    ? 1.5
    : ship.maxHull < 300
      ? 1.0
      : Math.max(0.3, 1.0 - (ship.maxHull - 300) / 1000);

  // Morale factor: panicking crews jink erratically (less effective)
  const moraleFactor = ship.crew.morale > 50
    ? 1.0
    : 0.5 + (ship.crew.morale / 50) * 0.5;

  // Base intensity: 15-40 units of displacement
  const intensity = (15 + navFactor * 25) * sizeFactor * moraleFactor;

  // Deterministic per-tick seed from ship ID + tick
  // Changes every 3-5 ticks for smoother jinking, not per-frame
  const jinkPeriod = 3 + (ship.id.charCodeAt(0) % 3); // 3, 4, or 5 ticks per jink
  const jinkSeed = Math.floor(tick / jinkPeriod);
  const idHash = ship.id.charCodeAt(0) * 31 + ship.id.charCodeAt(ship.id.length - 1) * 17;

  // Pseudo-random from seed (deterministic, not Math.random)
  const hash1 = ((jinkSeed * 1103515245 + idHash + 12345) & 0x7fffffff) / 0x7fffffff;
  const hash2 = ((jinkSeed * 214013 + idHash + 2531011) & 0x7fffffff) / 0x7fffffff;
  const hash3 = ((jinkSeed * 16807 + idHash + 127773) & 0x7fffffff) / 0x7fffffff;

  const jinkX = (hash1 * 2 - 1) * intensity;
  const jinkY = (hash2 * 2 - 1) * intensity;
  // Z-axis jink is smaller but still meaningful for vertical escape
  const jinkZ = (hash3 * 2 - 1) * intensity * 0.6;

  return { jinkX, jinkY, jinkZ };
}

// ---------------------------------------------------------------------------
// orbitTarget — capital ship orbiting manoeuvre (ships NEVER stop)
// ---------------------------------------------------------------------------

/**
 * Core manoeuvring function: ships orbit their target at engagement distance.
 * Capital ships never stop — they maintain 30-50% speed while circling.
 *
 * Behaviour:
 * - Computes orbit point ahead on a circle around the target
 * - Orbit direction biased toward allies, away from flankers
 * - Navigator quality affects orbit smoothness
 * - Too far (> 1.5x radius): spiral approach inward
 * - Too close (< 0.6x radius): push outward
 * - Taking damage: apply jink (random lateral + vertical perturbation)
 */
function orbitTarget(
  ship: TacticalShip,
  target: TacticalShip,
  orbitRadius: number,
  state: TacticalState,
  spreadX: number,
  spreadY: number,
  spreadZ: number,
): TacticalShip {
  const d = dist(ship.position, target.position);

  // Navigator quality affects orbit smoothness
  const navQuality = ship.stations?.navigator?.quality ?? 50;
  const navEff = ship.stations?.navigator?.effectiveness ?? 1.0;
  const navSmooth = 0.5 + (navQuality / 100) * navEff * 0.5; // 0.5-1.0

  // Current angle from target to ship
  const currentAngle = angleTo(target.position, ship.position);

  // Orbit direction: toward allies, away from flankers
  const orbitDir = computeOrbitDirection(ship, target, state.ships);

  // Advance rate: base + speed-scaled + navigator effectiveness
  const advanceRate = 0.03 + (ship.speed / 80) * navEff;

  // Store / update orbit phase for continuity between ticks
  const prevPhase = ship.orbitPhase ?? currentAngle;
  const newPhase = prevPhase + orbitDir * advanceRate;

  // Lead angle: look ahead on the orbit circle
  const leadTicks = 8 * navSmooth;
  const leadAngle = newPhase + orbitDir * advanceRate * leadTicks;

  let goalX: number;
  let goalY: number;
  let goalZ: number;

  if (d > orbitRadius * 1.5) {
    // ── Spiral approach: closing + orbiting simultaneously ──
    // Blend between direct approach and orbit lead angle
    const directAngle = angleTo(ship.position, target.position);
    // Higher blend toward orbit as we get closer
    const orbitBlend = Math.max(0.2, 1 - (d - orbitRadius) / (orbitRadius * 2));
    const blendedAngle = Math.atan2(
      Math.sin(directAngle) * (1 - orbitBlend) + Math.sin(leadAngle + Math.PI) * orbitBlend,
      Math.cos(directAngle) * (1 - orbitBlend) + Math.cos(leadAngle + Math.PI) * orbitBlend,
    );
    // Goal is partway between current position and orbit point
    const closingRadius = d * 0.7; // close 30% of remaining distance per cycle
    goalX = ship.position.x + Math.cos(blendedAngle) * Math.min(closingRadius, ship.speed * 3);
    goalY = ship.position.y + Math.sin(blendedAngle) * Math.min(closingRadius, ship.speed * 3);
    goalZ = target.position.z;
  } else if (d < orbitRadius * 0.6) {
    // ── Too close: push outward ──
    // Move away from target to reach orbit band
    const awayAngle = angleTo(target.position, ship.position);
    const pushAngle = awayAngle + orbitDir * 0.3; // slight orbit while pushing out
    goalX = target.position.x + Math.cos(pushAngle) * orbitRadius;
    goalY = target.position.y + Math.sin(pushAngle) * orbitRadius;
    goalZ = target.position.z;
  } else {
    // ── In orbit band: continue circling ──
    goalX = target.position.x + Math.cos(leadAngle) * orbitRadius;
    goalY = target.position.y + Math.sin(leadAngle) * orbitRadius;
    goalZ = target.position.z;
  }

  // Apply anti-bunching spread
  goalX += spreadX;
  goalY += spreadY;
  goalZ += spreadZ;

  // Apply jink if taking damage
  const jink = applyJink(ship, state.tick);
  goalX += jink.jinkX;
  goalY += jink.jinkY;
  goalZ += jink.jinkZ;

  // Move toward the orbit goal — minDist=0 so the ship never stops
  const moved = moveToward(
    { ...ship, orbitPhase: newPhase },
    { x: goalX, y: goalY, z: goalZ },
    0,
    state.environment,
    state.ships,
  );

  return { ...moved, orbitPhase: newPhase };
}

// ---------------------------------------------------------------------------
// setShipOrder
// ---------------------------------------------------------------------------

/**
 * Update a ship's order. Returns a new TacticalState with the updated ship.
 */
export function setShipOrder(
  state: TacticalState,
  shipId: string,
  order: ShipOrder,
): TacticalState {
  return {
    ...state,
    ships: state.ships.map((s) =>
      (s.id === shipId || s.sourceShipId === shipId)
        ? { ...s, order }
        : s,
    ),
  };
}

/** Set the combat stance for a ship or all ships on a side. */
export function setShipStance(
  state: TacticalState,
  shipIdOrSide: string,
  stance: CombatStance,
): TacticalState {
  return {
    ...state,
    ships: state.ships.map((s) => {
      if (s.id === shipIdOrSide || s.sourceShipId === shipIdOrSide || s.side === shipIdOrSide) {
        return { ...s, stance };
      }
      return s;
    }),
  };
}

// ---------------------------------------------------------------------------
// findNearestMissile
// ---------------------------------------------------------------------------

/**
 * Find the nearest missile targeting a given ship or its nearby allies.
 */
export function findNearestMissile(
  ship: TacticalShip,
  missiles: Missile[],
  allShips: TacticalShip[],
): Missile | null {
  const alliedRange = 200;
  const allies = allShips.filter(
    (s) => s.side === ship.side && !s.destroyed && !s.routed,
  );

  let best: Missile | null = null;
  let bestDist = Infinity;

  for (const missile of missiles) {
    const isTargetingSelf = missile.targetShipId === ship.id;
    const isTargetingNearbyAlly = !isTargetingSelf && allies.some(
      (a) => a.id === missile.targetShipId && dist(ship.position, a.position) < alliedRange,
    );

    if (!isTargetingSelf && !isTargetingNearbyAlly) continue;

    const d = dist(ship.position, { x: missile.x, y: missile.y, z: missile.z });
    if (d < bestDist) {
      bestDist = d;
      best = missile;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Fighter helpers
// ---------------------------------------------------------------------------

/**
 * Find the nearest enemy fighter within range of a ship.
 * Used by point defence to target fighters when no missiles are nearby.
 */
export function findNearestEnemyFighter(
  ship: TacticalShip,
  fighters: Fighter[],
): Fighter | null {
  let best: Fighter | null = null;
  let bestDist = Infinity;

  for (const fighter of fighters) {
    if (fighter.side === ship.side) continue;
    if (fighter.health <= 0) continue;
    const d = dist(ship.position, { x: fighter.x, y: fighter.y, z: fighter.z });
    if (d < bestDist) {
      bestDist = d;
      best = fighter;
    }
  }

  return best;
}

/**
 * Find the closest enemy ship for a fighter to target.
 */
function findClosestEnemyForFighter(
  fighter: Fighter,
  ships: TacticalShip[],
): TacticalShip | null {
  let best: TacticalShip | null = null;
  let bestDist = Infinity;

  for (const ship of ships) {
    if (ship.side === fighter.side || ship.destroyed || ship.routed) continue;
    const d = dist({ x: fighter.x, y: fighter.y, z: fighter.z }, ship.position);
    if (d < bestDist) {
      bestDist = d;
      best = ship;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// processTacticalTick
// ---------------------------------------------------------------------------

/**
 * Advance the tactical combat by one tick. Returns a new TacticalState.
 *
 * Steps:
 *  1. Decay beam/point-defence effects
 *  2. Move ships toward their targets based on orders
 *  3. Move projectiles toward their targets (consume on hit)
 *  3b. Move missiles (accelerate, track, hit detection)
 *  3c. Point defence intercepts missiles and fighters
 *  3d. Move fighters, deal strafing damage
 *  4. Fire weapons (check cooldown, range, ammo; create beams/projectiles/missiles/fighters)
 *  5. Return new state
 */
export function processTacticalTick(state: TacticalState): TacticalState {
  // 0. Early return if already resolved
  if (state.outcome !== null) return state;

  const env = state.environment ?? [];
  // Move drifting debris — debris inherits the destroyed ship's velocity
  const newEnvironment = env.map(f => {
    if (f.type === 'debris' && (f.vx || f.vy)) {
      return { ...f, x: f.x + (f.vx ?? 0), y: f.y + (f.vy ?? 0) };
    }
    return f;
  }).filter(f => {
    // Remove debris that drifted off the battlefield
    if (f.type !== 'debris') return true;
    return f.x > -200 && f.x < state.battlefieldWidth + 200 &&
           f.y > -200 && f.y < state.battlefieldHeight + 200;
  });

  // 0b. Assign fighter wings at battle start (tick 0) and when a fighter dies
  if (state.tick === 0 || state.ships.some(s => s.hullClass === 'fighter' && !s.wingId && !s.destroyed && !s.routed)) {
    state = { ...state, ships: assignWings(state.ships) };
  }

  // 0c. AI ships: switch to at_ease stance after tick 5
  // (gives the player a few seconds to set up before AI engages autonomously)
  // Fighters stay aggressive — they use their own AI, not stance-based movement.
  if (state.tick === 5) {
    state = {
      ...state,
      ships: state.ships.map(s => {
        if (s.side === 'defender' && s.order.type === 'idle' && !s.destroyed && !s.routed
            && s.hullClass !== 'fighter') {
          return { ...s, stance: 'at_ease' as CombatStance };
        }
        return s;
      }),
    };
  }

  // 1. Decay beam effects
  const beamEffects = state.beamEffects
    .map((b) => ({ ...b, ticksRemaining: b.ticksRemaining - 1 }))
    .filter((b) => b.ticksRemaining > 0);

  // 1b. Decay point defence effects
  const pointDefenceEffects = (state.pointDefenceEffects ?? [])
    .map((e) => ({ ...e, ticksRemaining: e.ticksRemaining - 1 }))
    .filter((e) => e.ticksRemaining > 0);

  // 1c. Shield recharge for all active ships + reset damage tracking
  let ships = state.ships.map((ship) => {
    // Reset per-tick damage counter (used by defensive stance)
    const reset = { ...ship, damageTakenThisTick: 0 };
    if (reset.destroyed || reset.routed || reset.maxShields <= 0) return reset;
    // Shield operator quality modulates recharge rate (0.8x-1.2x).
    const soQuality = ship.stations?.shieldOperator?.quality ?? 50;
    const soEff = ship.stations?.shieldOperator?.effectiveness ?? 1.0;
    const rechargeBonus = (0.8 + (soQuality / 100) * 0.4) * soEff;
    const recharged = Math.min(
      ship.maxShields,
      ship.shields + ship.maxShields * SHIELD_RECHARGE_FRACTION * rechargeBonus,
    );
    return recharged !== ship.shields ? { ...ship, shields: recharged, damageTakenThisTick: 0 } : reset;
  });

  // 1c2. Update crew station effectiveness
  ships = ships.map(s => updateStationEffectiveness(s));

  // 1c3. Damage control — passive hull repair from DC station
  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed || !ship.stations?.damageControl) return ship;
    const dc = ship.stations.damageControl;
    const repairAmount = ((ship.repairRate ?? 0) + (dc.quality / 100) * 2) * dc.effectiveness;
    if (repairAmount <= 0 || ship.hull >= ship.maxHull) return ship;
    return { ...ship, hull: Math.min(ship.maxHull, ship.hull + repairAmount) };
  });

  // 1c4. Commander threat assessment (every 5 ticks)
  if (state.tick % 5 === 0) {
    ships = ships.map((ship) => {
      if (ship.destroyed || ship.routed || ship.unmanned) return ship;
      return { ...ship, threatAssessment: assessThreats(ship, ships, state.tick) };
    });
  }

  // 1c5. Fleet coordination assessment (once per side, every 5 ticks)
  if (state.tick % 5 === 0) {
    _currentCoordination = {
      attacker: assessFleetSituation(ships, 'attacker'),
      defender: assessFleetSituation(ships, 'defender'),
    };
  }

  // 1c6. Target re-evaluation (every 10 ticks)
  if (state.tick % 10 === 0 && state.tick > 0) {
    ships = ships.map(ship => {
      if (ship.destroyed || ship.routed || !ship.engagedTargetId) return ship;
      const window = ship.damageDealtWindow ?? [];
      const totalDealt = window.reduce((s, v) => s + v, 0);
      const target = ships.find(s => s.id === ship.engagedTargetId && !s.destroyed);
      if (!target) return { ...ship, engagedTargetId: undefined, damageDealtWindow: [] };
      const targetHP = target.hull + target.shields + target.armour;
      // If dealing less than 2% of the target's HP over a 20-tick window, disengage
      if (targetHP > 0 && totalDealt / targetHP < 0.02 && window.length >= 20) {
        return { ...ship, engagedTargetId: undefined, damageDealtWindow: [], order: { type: 'idle' as const } };
      }
      return ship;
    });
  }

  // 1d. Debris damage — ships inside debris fields take tick damage
  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;
    // Debris damage is probabilistic — you might dodge chunks each tick.
    // Damage scales with the debris field's damage rating (from hull size).
    for (const feature of newEnvironment) {
      if (feature.type !== 'debris') continue;
      const dx = ship.position.x - feature.x;
      const dy = ship.position.y - feature.y;
      if (dx * dx + dy * dy < feature.radius * feature.radius) {
        if (Math.random() < DEBRIS_HIT_CHANCE) {
          const baseDmg = feature.damage ?? 1;
          const variance = 1 + (Math.random() * 2 - 1) * DEBRIS_DAMAGE_VARIANCE;
          const dmg = Math.max(1, Math.round(baseDmg * variance));
          return applyDamage(ship, dmg, 'kinetic');
        }
        break; // only check one debris field per tick
      }
    }
    return ship;
  });

  // 2. Move ships
  ships = ships.map((ship) => moveShip(ship, state));

  // 2b. RCS facing pass: all ships rotate to face their primary target.
  // In space, velocity and facing are independent — RCS thrusters rotate
  // the ship without changing trajectory. This keeps weapons on target.
  // Fighters already handle this in fighterCombatAI; this covers capital ships.
  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed || ship.stance === 'flee') return ship;
    // Fighters in aggressive stance already have facing override
    if (ship.hullClass === 'fighter' && ship.stance === 'aggressive') return ship;

    const target = findTarget(ship, ships);
    if (!target) return ship;

    const desiredFacing = angleTo(ship.position, target.position);
    const facingDiff = normaliseAngle(desiredFacing - ship.facing);
    const maxTurn = ship.turnRate ?? 0.08;
    // Blend: mostly face target, slight bias toward velocity for visual smoothness
    const newFacing = normaliseAngle(ship.facing + clamp(facingDiff, -maxTurn, maxTurn));
    return newFacing !== ship.facing ? { ...ship, facing: newFacing } : ship;
  });

  // 2c. Hard collision resolution — prevent ships from overlapping.
  // Run 2 iterations for stability (resolving one pair can push into another).
  // Also applies collision damage based on closing speed and mass ratio.
  {
    const COLLISION_ITERATIONS = 2;
    const collisionDamage: Array<{ shipIdx: number; damage: number }> = [];
    // Work on mutable position copies, then produce new immutable ship objects.
    const positions = ships.map(s => ({ x: s.position.x, y: s.position.y, z: s.position.z }));
    for (let iter = 0; iter < COLLISION_ITERATIONS; iter++) {
      for (let i = 0; i < ships.length; i++) {
        const a = ships[i];
        if (a.destroyed || a.routed) continue;
        for (let j = i + 1; j < ships.length; j++) {
          const b = ships[j];
          if (b.destroyed || b.routed) continue;

          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const cdz = positions[j].z - positions[i].z;

          // Ellipsoid collision: check per-axis overlap using hull extents.
          // Ships are not spheres — a flat disc has wide X but thin Z.
          const ae = a.collisionExtents ?? DEFAULT_COLLISION_EXTENTS;
          const be = b.collisionExtents ?? DEFAULT_COLLISION_EXTENTS;

          // Sum of half-extents per axis (horizontal uses max of width/length
          // since ships rotate — we approximate with the larger horizontal axis)
          const horizA = Math.max(ae.halfWidth, ae.halfLength);
          const horizB = Math.max(be.halfWidth, be.halfLength);
          const minDistH = horizA + horizB;  // horizontal collision threshold
          const minDistV = ae.halfHeight + be.halfHeight;  // vertical collision threshold

          // Horizontal distance (XY plane in tactical coords)
          const horizDistSq = dx * dx + dy * dy;
          // Check both horizontal AND vertical overlap for a true collision
          const horizOverlap = horizDistSq < minDistH * minDistH;
          const vertOverlap = Math.abs(cdz) < minDistV;

          const distSq = dx * dx + dy * dy + cdz * cdz;
          if (horizOverlap && vertOverlap && distSq > 0.01) {
            const d = Math.sqrt(distSq);
            const minDist = Math.sqrt(minDistH * minDistH + minDistV * minDistV);  // for overlap calc
            const overlap = minDist - d;
            const nx = dx / d;
            const ny = dy / d;
            const nz = cdz / d;

            // Collision damage — based on closing speed and mass ratio (first iteration only)
            if (iter === 0) {
              const relVx = b.velocity.x - a.velocity.x;
              const relVy = b.velocity.y - a.velocity.y;
              const relVz = b.velocity.z - a.velocity.z;
              const closingSpd = Math.abs(relVx * nx + relVy * ny + relVz * nz);
              // Only significant collisions deal damage (not gentle bumps)
              if (closingSpd > 2.0) {
                const totalMassForDmg = a.maxHull + b.maxHull;
                // Reduced multiplier — collisions hurt but shouldn't instakill small ships
                const impactEnergy = closingSpd * closingSpd * 0.15;
                const aDmg = Math.floor(impactEnergy * (b.maxHull / totalMassForDmg));
                const bDmg = Math.floor(impactEnergy * (a.maxHull / totalMassForDmg));
                if (aDmg > 0) collisionDamage.push({ shipIdx: i, damage: aDmg });
                if (bDmg > 0) collisionDamage.push({ shipIdx: j, damage: bDmg });
              }
            }

            // Mass-weighted push — heavier ships move less
            const totalMass = a.maxHull + b.maxHull;
            const aFrac = b.maxHull / totalMass;
            const bFrac = a.maxHull / totalMass;
            const pushEach = overlap * 0.5;

            positions[i].x -= nx * pushEach * aFrac;
            positions[i].y -= ny * pushEach * aFrac;
            positions[i].z -= nz * pushEach * aFrac;
            positions[j].x += nx * pushEach * bFrac;
            positions[j].y += ny * pushEach * bFrac;
            positions[j].z += nz * pushEach * bFrac;
          }
        }
      }
    }
    // Apply collision damage
    for (const cd of collisionDamage) {
      const s = ships[cd.shipIdx];
      if (!s || s.destroyed) continue;
      const newHull = Math.max(0, s.hull - cd.damage);
      ships[cd.shipIdx] = {
        ...s,
        hull: newHull,
        destroyed: newHull <= 0 ? true : s.destroyed,
        damageTakenThisTick: s.damageTakenThisTick + cd.damage,
      };
    }
    // Apply adjusted positions back as new immutable ship objects
    ships = ships.map((s, idx) => {
      if (s.position.x !== positions[idx].x || s.position.y !== positions[idx].y || s.position.z !== positions[idx].z) {
        return { ...s, position: { x: positions[idx].x, y: positions[idx].y, z: positions[idx].z } };
      }
      return s;
    });
  }

  // 3. Move projectiles — ballistic flight (straight line, no tracking)
  //    Hit detection checks ALL non-source ships along the flight path.
  const hitRadius = 12;
  const survivingProjectiles: Projectile[] = [];
  const halfDepth = (state.battlefieldDepth ?? 400) / 2;

  for (const proj of state.projectiles) {
    // All projectiles fly straight using pre-computed dx/dy/dz — no target tracking
    const newPos = {
      x: proj.position.x + proj.dx,
      y: proj.position.y + proj.dy,
      z: proj.position.z + proj.dz,
    };

    // Off-battlefield check (all 3 axes) — discard if out of bounds
    if (newPos.x < -50 || newPos.x > state.battlefieldWidth + 50 ||
        newPos.y < -50 || newPos.y > state.battlefieldHeight + 50 ||
        newPos.z < -halfDepth - 50 || newPos.z > halfDepth + 50) {
      continue;
    }

    // Hit detection: check ALL non-source ships using segment distance
    let hitShip = false;
    for (const s of ships) {
      if (s.id === proj.sourceShipId || s.destroyed || s.routed) continue;
      const perpDist = pointToSegmentDistance(
        s.position.x, s.position.y, s.position.z,
        proj.position.x, proj.position.y, proj.position.z,
        newPos.x, newPos.y, newPos.z,
      );
      if (perpDist < hitRadius) {
        // Asteroid cover: target inside asteroid gets dodge bonus
        const inAsteroid = isInsideFeature(
          s.position.x, s.position.y, newEnvironment, 'asteroid',
        );
        if (inAsteroid && Math.random() < ASTEROID_DODGE_BONUS) {
          continue; // dodged — projectile still consumed
        }
        ships = ships.map((sh) => (sh.id === s.id ? applyDamage(sh, proj.damage, 'kinetic') : sh));
        hitShip = true;
        break; // projectile consumed by hit
      }
    }
    if (hitShip) continue;

    // Asteroid intercept: projectile passing through asteroid field
    const asteroidHit = segmentPassesThroughFeature(
      proj.position.x, proj.position.y,
      newPos.x, newPos.y,
      newEnvironment, 'asteroid',
    );
    if (asteroidHit != null && Math.random() < ASTEROID_INTERCEPT_CHANCE) {
      continue; // absorbed by asteroid
    }

    survivingProjectiles.push({ ...proj, position: newPos });
  }

  // 3b. Move missiles — accelerate, track target, check hits, friendly fire
  let survivingMissiles: Missile[] = [];
  const newPdEffects: PointDefenceEffect[] = [];

  for (const missile of (state.missiles ?? [])) {
    // Burn fuel — inert missiles drift harmlessly and disappear
    const remainingFuel = (missile.fuel ?? MISSILE_FUEL_TICKS) - 1;
    if (remainingFuel <= 0) continue; // fuel exhausted, missile goes inert

    const target = ships.find((s) => s.id === missile.targetShipId && !s.destroyed);

    // ECM missile deflection — target's ECM has a chance to break missile lock.
    // A deflected missile loses guidance and drifts inert (removed next tick).
    if (target && (target.missileDeflection ?? 0) > 0) {
      if (Math.random() * 100 < target.missileDeflection) {
        // Lock broken — missile continues on current heading but loses tracking (3D)
        const driftCosPitch = Math.cos(missile.pitch);
        const driftMX = missile.x + Math.cos(missile.heading ?? 0) * driftCosPitch * (missile.speed ?? 10);
        const driftMY = missile.y + Math.sin(missile.heading ?? 0) * driftCosPitch * (missile.speed ?? 10);
        const driftMZ = missile.z + Math.sin(missile.pitch) * (missile.speed ?? 10);
        const mHalfDepth = (state.battlefieldDepth ?? 400) / 2;
        if (driftMX > -50 && driftMX < state.battlefieldWidth + 50 &&
            driftMY > -50 && driftMY < state.battlefieldHeight + 50 &&
            driftMZ > -mHalfDepth - 50 && driftMZ < mHalfDepth + 50) {
          survivingMissiles.push({
            ...missile, x: driftMX, y: driftMY, z: driftMZ, fuel: 0, // will be removed next tick
          });
        }
        continue;
      }
    }

    // If target destroyed mid-flight, retarget nearest enemy
    if (target == null) {
      const sourceSide = ships.find(s => s.id === missile.sourceShipId)?.side;
      const newTarget = ships
        .filter(s => s.side !== sourceSide && !s.destroyed && !s.routed)
        .sort((a, b) => dist({ x: missile.x, y: missile.y, z: missile.z }, a.position) - dist({ x: missile.x, y: missile.y, z: missile.z }, b.position))[0];
      if (newTarget) {
        const retargetSpeed = Math.min(missile.speed + missile.acceleration, missile.maxSpeed);
        survivingMissiles.push({ ...missile, targetShipId: newTarget.id, speed: retargetSpeed, fuel: remainingFuel });
      }
      continue;
    }

    // Accelerate
    const speed = Math.min(missile.speed + missile.acceleration, missile.maxSpeed);

    // Track target using interception trajectory — predict where the target
    // will be and aim there instead of chasing its current position.
    const interceptPt = computeInterceptPoint(
      { x: missile.x, y: missile.y },
      target.position,
      target.velocity ?? { x: 0, y: 0 },
      speed,
    );

    // ── Turn-rate-limited steering ──────────────────────────────────────
    // Missiles can't instantly reorient. They steer toward the intercept
    // point at their turnRate. Early missiles fly wide arcs; advanced
    // missiles can make sharper corrections.
    const desiredHeading = Math.atan2(
      interceptPt.y - missile.y,
      interceptPt.x - missile.x,
    );
    const currentHeading = missile.heading ?? desiredHeading;
    const headingDiff = normaliseAngle(desiredHeading - currentHeading);
    const maxTurn = missile.turnRate ?? 0.06;
    const newHeading = currentHeading + clamp(headingDiff, -maxTurn, maxTurn);

    // ── Pitch tracking toward target (3D) ──────────────────────────────
    const mHorizDist = Math.sqrt(
      (target.position.x - missile.x) ** 2 + (target.position.y - missile.y) ** 2,
    );
    const desiredMPitch = Math.atan2(target.position.z - missile.z, Math.max(mHorizDist, 1));
    const pitchDiff = desiredMPitch - missile.pitch;
    const newMPitch = missile.pitch + clamp(pitchDiff, -maxTurn, maxTurn);

    // Movement is along the missile's ACTUAL heading and pitch (3D)
    const mCosPitch = Math.cos(newMPitch);
    const dx = Math.cos(newHeading) * mCosPitch;
    const dy = Math.sin(newHeading) * mCosPitch;
    const mdz = Math.sin(newMPitch);
    const d = dist({ x: missile.x, y: missile.y, z: missile.z }, target.position);

    if (d < MISSILE_HIT_RADIUS + speed) {
      // Asteroid cover: dodge bonus
      const inAsteroid = isInsideFeature(
        target.position.x, target.position.y, newEnvironment, 'asteroid',
      );
      if (inAsteroid && Math.random() < ASTEROID_DODGE_BONUS) {
        continue; // dodged
      }

      // Hit! Apply direct damage to target
      const targetIdx = ships.findIndex((s) => s.id === missile.targetShipId);
      if (targetIdx >= 0) {
        ships[targetIdx] = applyDamage(ships[targetIdx]!, missile.damage, 'explosive');
      }
      // AOE splash: nearby ships take 30% damage (within 40px radius)
      const MISSILE_AOE_RADIUS = 40;
      const MISSILE_AOE_FRACTION = 0.30;
      for (let si = 0; si < ships.length; si++) {
        const s = ships[si]!;
        if (s.id === missile.targetShipId || s.id === missile.sourceShipId) continue;
        if (s.destroyed || s.routed) continue;
        const splashD = dist({ x: missile.x, y: missile.y, z: missile.z }, s.position);
        if (splashD < MISSILE_AOE_RADIUS) {
          ships[si] = applyDamage(s, missile.damage * MISSILE_AOE_FRACTION, 'explosive');
        }
      }
      continue; // missile consumed
    }

    // Move along the missile's current heading and pitch (3D, turn-rate limited)
    const newMX = missile.x + dx * speed;
    const newMY = missile.y + dy * speed;
    const newMZ = missile.z + mdz * speed;

    // Asteroid intercept for missiles in flight
    const asteroidHit = segmentPassesThroughFeature(
      missile.x, missile.y, newMX, newMY,
      newEnvironment, 'asteroid',
    );
    if (asteroidHit != null && Math.random() < ASTEROID_INTERCEPT_CHANCE) {
      continue; // absorbed by asteroid
    }

    // Boundary check — including z-axis
    const missileHalfDepth = (state.battlefieldDepth ?? 400) / 2;
    if (newMX < -50 || newMX > state.battlefieldWidth + 50 ||
        newMY < -50 || newMY > state.battlefieldHeight + 50 ||
        newMZ < -missileHalfDepth - 50 || newMZ > missileHalfDepth + 50) {
      continue; // out of bounds
    }

    survivingMissiles.push({
      ...missile,
      speed,
      x: newMX,
      y: newMY,
      z: newMZ,
      fuel: remainingFuel,
      heading: newHeading,
      pitch: newMPitch,
    });
  }

  // 3c. Point defence intercepts missiles and fighters
  let fighters: Fighter[] = (state.fighters ?? [])
    .filter((f) => f.health > 0);

  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;

    let weaponsChanged = false;
    const updatedWeapons = ship.weapons.map((weapon) => {
      if (weapon.type !== 'point_defense') return weapon;
      if (weapon.cooldownLeft > 0) return weapon;
      if (weapon.ammo !== undefined && weapon.ammo <= 0) return weapon;

      // Prefer targeting missiles over fighters
      const nearestMissile = findNearestMissile(ship, survivingMissiles, ships);
      if (nearestMissile != null) {
        const d = dist(ship.position, { x: nearestMissile.x, y: nearestMissile.y, z: nearestMissile.z });
        if (d <= weapon.range) {
          weaponsChanged = true;
          const updated = {
            ...weapon,
            cooldownLeft: weapon.cooldownMax,
            ammo: weapon.ammo !== undefined ? weapon.ammo - 1 : undefined,
          };

          // Use interceptRate from component stats; fall back to accuracy
          if (Math.random() * 100 < (weapon.interceptRate ?? weapon.accuracy)) {
            survivingMissiles = survivingMissiles.filter((m) => m.id !== nearestMissile.id);
            newPdEffects.push({
              shipId: ship.id,
              missileX: nearestMissile.x,
              missileY: nearestMissile.y,
              ticksRemaining: PD_EFFECT_DURATION,
            });
          }

          return updated;
        }
      }

      // No missile in range — try targeting enemy fighters
      const nearestFighter = findNearestEnemyFighter(ship, fighters);
      if (nearestFighter != null) {
        const d = dist(ship.position, { x: nearestFighter.x, y: nearestFighter.y, z: nearestFighter.z });
        if (d <= weapon.range) {
          weaponsChanged = true;
          const updated = {
            ...weapon,
            cooldownLeft: weapon.cooldownMax,
            ammo: weapon.ammo !== undefined ? weapon.ammo - 1 : undefined,
          };

          // Use interceptRate from component stats; fall back to accuracy
          if (Math.random() * 100 < (weapon.interceptRate ?? weapon.accuracy) * PD_VS_FIGHTER_ACCURACY_MULT) {
            nearestFighter.health = 0; // destroyed
            newPdEffects.push({
              shipId: ship.id,
              missileX: nearestFighter.x,
              missileY: nearestFighter.y,
              ticksRemaining: PD_EFFECT_DURATION,
            });
          }

          return updated;
        }
      }

      return weapon;
    });

    return weaponsChanged ? { ...ship, weapons: updatedWeapons } : ship;
  });

  // Remove dead fighters after PD phase
  fighters = fighters.filter((f) => f.health > 0);

  // 3d. Move fighters, deal strafing damage (3D-aware)
  for (const fighter of fighters) {
    if (fighter.order === 'return') {
      // Move back to carrier
      const carrier = ships.find((s) => s.id === fighter.carrierId);
      if (!carrier || carrier.destroyed) {
        fighter.order = 'attack'; // carrier gone, keep fighting
      } else {
        const dx = carrier.position.x - fighter.x;
        const dy = carrier.position.y - fighter.y;
        const fdz = carrier.position.z - fighter.z;
        const d = Math.sqrt(dx * dx + dy * dy + fdz * fdz);
        if (d < FIGHTER_DOCK_RANGE) {
          // Docked — heal and remove from battlefield
          fighter.health = 0; // will be filtered out; ammo is not restored
          continue;
        }
        if (d > fighter.speed) {
          fighter.x += (dx / d) * fighter.speed;
          fighter.y += (dy / d) * fighter.speed;
          fighter.z += (fdz / d) * fighter.speed;
        }
        continue;
      }
    }

    // Find or re-acquire target
    const target = ships.find((s) => s.id === fighter.targetId && !s.destroyed && !s.routed);
    if (!target) {
      const newTarget = findClosestEnemyForFighter(fighter, ships);
      fighter.targetId = newTarget?.id ?? null;
      if (!newTarget) continue;
    }

    const currentTarget = ships.find((s) => s.id === fighter.targetId && !s.destroyed && !s.routed);
    if (!currentTarget) continue;

    // Move toward target (3D)
    const dx = currentTarget.position.x - fighter.x;
    const dy = currentTarget.position.y - fighter.y;
    const fdz = currentTarget.position.z - fighter.z;
    const d = Math.sqrt(dx * dx + dy * dy + fdz * fdz);

    if (d < FIGHTER_STRAFE_RANGE) {
      // Strafing run — deal damage
      const targetIdx = ships.findIndex((s) => s.id === currentTarget.id);
      if (targetIdx >= 0) {
        ships[targetIdx] = applyDamage(ships[targetIdx]!, fighter.damage * FIGHTER_STRAFE_DAMAGE_FRACTION, 'energy');
      }
    }

    if (d > fighter.speed) {
      fighter.x += (dx / d) * fighter.speed;
      fighter.y += (dy / d) * fighter.speed;
      fighter.z += (fdz / d) * fighter.speed;
    }
  }

  // Remove dead fighters after strafing
  fighters = fighters.filter((f) => f.health > 0);

  // 4. Fire weapons
  const newProjectiles: Projectile[] = [];
  const newBeamEffects: BeamEffect[] = [];
  const newMissiles: Missile[] = [];
  const newFighters: Fighter[] = [];

  // Collect beam damage to apply AFTER the weapon-firing map, because
  // .map() returns new ship objects — mutating ships[idx] inside the
  // callback is lost when .map() overwrites the array.
  const pendingBeamDamage: Array<{ targetIdx: number; damage: number; damageType: DamageType }> = [];

  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;

    // Stance-based firing restrictions
    if (ship.stance === 'flee') {
      // Flee stance: no firing, just tick cooldowns
      return { ...ship, weapons: ship.weapons.map(w => ({ ...w, cooldownLeft: Math.max(0, w.cooldownLeft - 1) })) };
    }
    if (ship.stance === 'defensive') {
      // Defensive stance: fire when fired upon OR enemies within 60% of weapon range
      const closestEnemy = findTarget(ship, ships);
      const closestDist = closestEnemy ? dist(ship.position, closestEnemy.position) : Infinity;
      const minWeaponRange = ship.weapons.length > 0 ? Math.min(...ship.weapons.map(w => w.range)) : 200;
      const closeEnough = closestDist < minWeaponRange * 0.6;
      if (ship.damageTakenThisTick <= 0 && !closeEnough) {
        return { ...ship, weapons: ship.weapons.map(w => ({ ...w, cooldownLeft: Math.max(0, w.cooldownLeft - 1) })) };
      }
    }

    const target = findTarget(ship, ships);
    if (target == null) {
      return {
        ...ship,
        weapons: ship.weapons.map((w) => ({
          ...w,
          cooldownLeft: Math.max(0, w.cooldownLeft - 1),
        })),
      };
    }

    const d = dist(ship.position, target.position);
    const updatedWeapons: TacticalWeapon[] = [];

    for (const weapon of ship.weapons) {
      // Point defence fires independently in step 3c — just tick cooldown here
      if (weapon.type === 'point_defense') {
        updatedWeapons.push({
          ...weapon,
          cooldownLeft: Math.max(0, weapon.cooldownLeft - 1),
        });
        continue;
      }

      if (weapon.cooldownLeft > 0) {
        updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownLeft - 1 });
        continue;
      }

      // Each weapon independently picks the best available target in its
      // arc and range, using weapon-type-specific scoring.
      let weaponTarget: TacticalShip | null = null;
      let weaponD = Infinity;
      let bestWeaponScore = -Infinity;
      const wDmgType = weaponDamageType(weapon.type);
      const ammoFraction = (weapon.ammo !== undefined && weapon.maxAmmo !== undefined && weapon.maxAmmo > 0)
        ? weapon.ammo / weapon.maxAmmo
        : 1.0;

      for (const enemy of ships) {
        if (enemy.side === ship.side || enemy.destroyed || enemy.routed) continue;
        const ed = dist(ship.position, enemy.position);
        if (ed > weapon.range) continue;
        if (!isInWeaponArc(ship, enemy, weapon)) continue;

        let wScore = 0;

        // Proximity: closer targets are more attractive
        wScore += ((weapon.range - ed) / weapon.range) * 15;

        // Opportunity: damaged targets are easier to finish
        wScore += (1 - enemy.hull / enemy.maxHull) * 20;

        // Primary target bonus
        if (enemy.id === target.id) wScore += 15;

        // Weapon type effectiveness vs shield — prefer targets our weapon is good against
        const enemyShieldAge = enemy.shieldAge ?? 'nano_atomic';
        const shieldEff = SHIELD_EFFECTIVENESS[enemyShieldAge]?.[wDmgType] ?? 0.5;
        // Lower shield effectiveness = our damage type is stronger vs this shield
        if (enemy.shields > 0) {
          wScore += (1 - shieldEff) * 15; // up to +15 for shields weak to our type
        }

        // Overkill avoidance: if target is nearly dead and taking heavy fire, don't waste shots
        if (enemy.damageTakenThisTick > 0 && enemy.id !== target.id) {
          const projectedHP = enemy.hull - enemy.damageTakenThisTick * weapon.cooldownMax;
          if (projectedHP <= 0) wScore -= 20;
        }

        // Missile-specific: PD ships and high missile deflection are bad targets
        if (weapon.type === 'missile') {
          const targetHasPD = enemy.weapons.some(w => w.type === 'point_defense');
          if (targetHasPD) wScore -= 15;
          if ((enemy.missileDeflection ?? 0) > 30) wScore -= 10;
        }

        // Ammo conservation: save scarce ammo for the primary target
        if (ammoFraction < 0.2 && enemy.id !== target.id) {
          wScore -= 15;
        }

        if (wScore > bestWeaponScore) {
          bestWeaponScore = wScore;
          weaponTarget = enemy;
          weaponD = ed;
        }
      }

      // Hold fire: if best score is poor and ammo is limited, save it
      if (bestWeaponScore < -10 && ammoFraction < 0.5) {
        updatedWeapons.push({ ...weapon, cooldownLeft: Math.max(0, weapon.cooldownLeft - 1) });
        continue;
      }

      if (weaponTarget == null) {
        updatedWeapons.push(weapon);
        continue;
      }

      // Check ammo
      if (weapon.ammo !== undefined && weapon.ammo <= 0) {
        updatedWeapons.push(weapon);
        continue;
      }

      // Fire! Weapon type determines firing behaviour.
      if (weapon.type === 'fighter_bay') {
        // Launch fighters — ammo is fighter count
        const fighterCount = weapon.ammo ?? 0;
        if (fighterCount <= 0) {
          updatedWeapons.push(weapon);
          continue;
        }
        const launchCount = Math.min(FIGHTER_LAUNCH_BATCH, fighterCount);
        for (let i = 0; i < launchCount; i++) {
          newFighters.push({
            id: `fighter-${state.tick}-${ship.id}-${i}`,
            carrierId: ship.id,
            side: ship.side,
            x: ship.position.x + (Math.random() - 0.5) * 20,
            y: ship.position.y + (Math.random() - 0.5) * 20,
            z: 0,
            speed: FIGHTER_SPEED,
            damage: weapon.damage,
            health: FIGHTER_DEFAULT_HEALTH,
            maxHealth: FIGHTER_DEFAULT_HEALTH,
            targetId: weaponTarget.id,
            order: 'attack',
          });
        }
        updatedWeapons.push({
          ...weapon,
          cooldownLeft: weapon.cooldownMax,
          ammo: fighterCount - launchCount,
        });
        continue;
      }

      const newAmmo = weapon.ammo !== undefined ? weapon.ammo - 1 : undefined;

      if (weapon.type === 'beam') {
        // --- Beam accuracy: dice-roll hit/miss (kept for beams only) ---
        let shotHits = true;
        // Fix: use actual velocity magnitude instead of stance/order check
        const tv = weaponTarget.velocity;
        const targetSpeed = Math.sqrt(tv.x * tv.x + tv.y * tv.y + tv.z * tv.z);
        const isMoving = targetSpeed > 0.5;
        if (isMoving) {
          const speedFactor = targetSpeed / 5;
          const sizeFactor = weaponTarget.maxHull < 60 ? 0.3 : weaponTarget.maxHull < 200 ? 0.15 : weaponTarget.maxHull < 400 ? 0.05 : 0;
          // ECM evasionBonus adds directly to evasion chance (10 bonus = +10%)
          const ecmFactor = (weaponTarget.evasionBonus ?? 0) / 100;
          // Lateral movement bonus: perpendicular motion to attacker is harder to hit
          const toTargetAngle = angleTo(ship.position, weaponTarget.position);
          const targetMoveAngle = Math.atan2(tv.y, tv.x);
          const angleDiff = Math.abs(normaliseAngle(targetMoveAngle - toTargetAngle));
          const lateralFraction = Math.sin(angleDiff); // 0 = head-on, 1 = perpendicular
          const lateralBonus = lateralFraction * 0.10;
          // Z-axis evasion bonus: vertical displacement is harder to track
          const zSpeed = Math.abs(tv.z);
          const zBonus = Math.min(0.08, zSpeed * 0.02);
          const evasionChance = Math.min(0.6, speedFactor * 0.1 + sizeFactor + ecmFactor + lateralBonus + zBonus);
          if (Math.random() < evasionChance) shotHits = false;
        }
        // Accuracy roll — ECM sensorJamming reduces effective accuracy
        if (shotHits) {
          const EXP_ACCURACY: Record<CrewExperience, number> = {
            recruit: 0.80, trained: 0.90, regular: 1.0, seasoned: 1.05,
            veteran: 1.10, hardened: 1.15, elite: 1.20, ace: 1.25, legendary: 1.30,
          };
          const expAccuracyMod = EXP_ACCURACY[ship.crew.experience] ?? 1.0;
          const moraleMod = ship.crew.morale < 30 ? 0.7 : 1.0;
          // Target's sensor jamming degrades the attacker's targeting solution
          const jammingPenalty = Math.max(0, 1 - (weaponTarget.sensorJamming ?? 0) / 200);
          const effectiveAccuracy = weapon.accuracy * expAccuracyMod * moraleMod * jammingPenalty;
          if (Math.random() * 100 > effectiveAccuracy) shotHits = false;
        }

        let beamDamage = weapon.damage;

        // Range falloff: damage reduces linearly past 60% of max range (down to 30% at max range)
        const rangeFraction = weaponD / weapon.range;
        if (rangeFraction > 0.6) {
          const falloff = 1.0 - (rangeFraction - 0.6) / 0.4 * 0.7; // 1.0 at 60%, 0.3 at 100%
          beamDamage *= Math.max(0.3, falloff);
        }

        // Nebula attenuation: reduce beam damage when firing through nebula
        const nebula = segmentPassesThroughFeature(
          ship.position.x, ship.position.y,
          weaponTarget.position.x, weaponTarget.position.y,
          newEnvironment, 'nebula',
        );
        if (nebula != null) {
          beamDamage *= NEBULA_BEAM_DAMAGE_FACTOR;
        }

        // Beams hit precisely — no collateral. Misses still show the beam visually.
        if (shotHits) {
          const idx = ships.indexOf(weaponTarget);
          if (idx >= 0) {
            pendingBeamDamage.push({ targetIdx: idx, damage: beamDamage, damageType: 'beam' });
          }
        }
        newBeamEffects.push({
          sourceShipId: ship.id,
          targetShipId: weaponTarget.id,
          damage: beamDamage,
          ticksRemaining: BEAM_EFFECT_DURATION,
          componentId: weapon.componentId,
        });
      } else if (weapon.type === 'missile') {
        // Use per-type physics from MISSILE_PROFILES; fall back to defaults
        const mProfile = MISSILE_PROFILES[weapon.componentId];
        const salvo = weapon.salvoCount ?? 1;
        const perMissileDamage = weapon.damage / salvo;
        for (let si = 0; si < salvo; si++) {
          // Spread salvo missiles slightly so they separate visually
          const angleOffset = salvo > 1
            ? ((si / (salvo - 1)) - 0.5) * 10 * (Math.PI / 180)  // ±5° spread
            : 0;
          const posOffset = salvo > 1
            ? (Math.random() - 0.5) * 10  // ±5px random offset
            : 0;
          // Launch heading = ship facing + salvo spread angle
          const launchHeading = ship.facing + angleOffset;
          newMissiles.push({
            id: `missile-${state.tick}-${ship.id}-${weapon.componentId}-${si}`,
            sourceShipId: ship.id,
            targetShipId: weaponTarget.id,
            componentId: weapon.componentId,
            x: ship.position.x + posOffset * Math.cos(angleOffset),
            y: ship.position.y + posOffset * Math.sin(angleOffset),
            z: 0,
            pitch: 0,
            speed: mProfile?.initSpeed ?? MISSILE_INITIAL_SPEED,
            maxSpeed: mProfile?.maxSpeed ?? MISSILE_MAX_SPEED,
            acceleration: mProfile?.accel ?? MISSILE_ACCELERATION,
            damage: perMissileDamage,
            damageType: 'explosive',
            fuel: MISSILE_FUEL_TICKS,
            heading: launchHeading,
            turnRate: mProfile?.turnRate ?? 0.06,
          });
        }
      } else {
        // --- Ballistic projectile burst fire ---
        // Compute accuracy cone and lead angle, then fire a burst of projectiles
        // with spread. Whether they hit is determined by physics (proximity during
        // flight), not a dice roll.
        const burstCount = PROJECTILE_BURST_COUNT[weapon.componentId] ?? DEFAULT_BURST_COUNT;
        const perRoundDamage = weapon.damage / burstCount;

        // Target velocity for lead calculation
        const tgtVel = weaponTarget.velocity;
        const targetSpeed = Math.sqrt(tgtVel.x * tgtVel.x + tgtVel.y * tgtVel.y + tgtVel.z * tgtVel.z);

        // Own movement speed
        const ownVel = ship.velocity;
        const ownSpeed = Math.sqrt(ownVel.x * ownVel.x + ownVel.y * ownVel.y + ownVel.z * ownVel.z);

        // Compute accuracy cone half-angle
        const coneHalfAngle = computeAccuracyCone(
          weapon, weaponD, targetSpeed, weaponTarget.maxHull,
          ownSpeed, ship.crew, weaponTarget.sensorJamming ?? 0,
        );

        // Compute lead angle (where the target will be)
        const lead = computeLeadAngle(
          ship.position, weaponTarget.position, tgtVel,
          PROJECTILE_SPEED, ship.crew,
        );

        for (let bi = 0; bi < burstCount; bi++) {
          // Random spread within the accuracy cone (2D angle + pitch)
          const spreadAngle = lead.angle + (Math.random() - 0.5) * 2 * coneHalfAngle;
          const spreadPitch = lead.pitch + (Math.random() - 0.5) * 2 * coneHalfAngle;

          // Pre-compute velocity components (fixed for the lifetime of the projectile)
          const cosPitch = Math.cos(spreadPitch);
          const pdx = Math.cos(spreadAngle) * cosPitch * PROJECTILE_SPEED;
          const pdy = Math.sin(spreadAngle) * cosPitch * PROJECTILE_SPEED;
          const pdz = Math.sin(spreadPitch) * PROJECTILE_SPEED;

          newProjectiles.push({
            id: generateId(),
            position: { ...ship.position },
            speed: PROJECTILE_SPEED,
            damage: perRoundDamage,
            sourceShipId: ship.id,
            componentId: weapon.componentId,
            angle: spreadAngle,
            pitch: spreadPitch,
            dx: pdx,
            dy: pdy,
            dz: pdz,
          });
        }
      }

      // Reset cooldown and decrement ammo
      updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownMax, ammo: newAmmo });
    }

    return { ...ship, weapons: updatedWeapons };
  });

  // 4b. Apply deferred beam damage (must happen AFTER .map() so changes aren't lost)
  for (const { targetIdx, damage, damageType: dmgType } of pendingBeamDamage) {
    if (targetIdx >= 0 && targetIdx < ships.length) {
      ships[targetIdx] = applyDamage(ships[targetIdx]!, damage, dmgType);
    }
  }

  // 5. Create debris from newly destroyed ships + morale drop from ally loss
  const prevDestroyedIds = new Set(
    state.ships.filter((s) => s.destroyed).map((s) => s.id),
  );
  for (const ship of ships) {
    if (ship.destroyed && !prevDestroyedIds.has(ship.id)) {
      // Debris: number of pieces and size scale with hull mass.
      // Small craft leave 0-1 tiny pieces, capital ships leave 3-5 large chunks.
      const sv = ship.velocity ?? { x: 0, y: 0 };
      let pieceCount: number;
      let baseRadius: number;
      let baseDamage: number;

      if (ship.maxHull < 30) {
        // Drones, probes — maybe 1 tiny scrap
        pieceCount = Math.random() < 0.3 ? 1 : 0;
        baseRadius = 3 + Math.random() * 3;
        baseDamage = 0.5;
      } else if (ship.maxHull < 100) {
        // Fighters, bombers, patrol
        pieceCount = 1 + Math.floor(Math.random() * 2); // 1-2
        baseRadius = 5 + Math.random() * 5;
        baseDamage = 1;
      } else if (ship.maxHull < 250) {
        // Corvettes, frigates, destroyers
        pieceCount = 2 + Math.floor(Math.random() * 2); // 2-3
        baseRadius = 8 + Math.random() * 8;
        baseDamage = 2;
      } else if (ship.maxHull < 600) {
        // Cruisers, light battleships
        pieceCount = 3 + Math.floor(Math.random() * 2); // 3-4
        baseRadius = 12 + Math.random() * 10;
        baseDamage = 3;
      } else {
        // Battleships, carriers, stations
        pieceCount = 4 + Math.floor(Math.random() * 3); // 4-6
        baseRadius = 15 + Math.random() * 15;
        baseDamage = 5;
      }

      for (let p = 0; p < pieceCount; p++) {
        // Each piece gets random size variance (50-150% of base)
        const sizeVar = 0.5 + Math.random();
        const r = Math.max(3, baseRadius * sizeVar);
        // Scatter outward from explosion centre
        const scatterAngle = Math.random() * Math.PI * 2;
        const scatterDist = Math.random() * 15;
        // Inherit ship velocity + explosion scatter
        const explodeSpeed = 0.3 + Math.random() * 0.8;
        newEnvironment.push({
          id: `debris-${ship.id}-${p}`,
          type: 'debris',
          x: ship.position.x + Math.cos(scatterAngle) * scatterDist,
          y: ship.position.y + Math.sin(scatterAngle) * scatterDist,
          radius: r,
          vx: sv.x * 0.8 + Math.cos(scatterAngle) * explodeSpeed,
          vy: sv.y * 0.8 + Math.sin(scatterAngle) * explodeSpeed,
          damage: Math.max(0.5, baseDamage * sizeVar),
        });
      }

      // Allied ships suffer morale drop when a comrade is destroyed (not drones).
      // Impact is proportional — losing 1 of 12 battleships is routine,
      // losing 1 of 2 is terrifying. Based on % of remaining fleet tonnage lost.
      const alliedShips = ships.filter(s => s.side === ship.side && !s.destroyed && !s.unmanned);
      const allyTotalHull = alliedShips.reduce((sum, s) => sum + s.maxHull, 0);
      // What fraction of the fleet just died? Scale to a 2-10 morale hit.
      const fractionLost = allyTotalHull > 0 ? ship.maxHull / (allyTotalHull + ship.maxHull) : 0.5;
      const deathImpact = 2 + fractionLost * 16; // 1 of 2 = ~10, 1 of 12 = ~3
      ships = ships.map((s) => {
        if (s.side === ship.side && s.id !== ship.id && !s.destroyed && !s.unmanned) {
          return {
            ...s,
            crew: { ...s.crew, morale: Math.max(0, s.crew.morale - deathImpact) },
          };
        }
        return s;
      });

      // Enemy ships get a morale BOOST from killing an opponent.
      // Smaller boost than the death impact — killing is encouraging but
      // not as dramatic as losing a comrade.
      const enemySide = ship.side === 'attacker' ? 'defender' : 'attacker';
      const killBoost = 1 + fractionLost * 6; // 1-4 morale gain
      ships = ships.map((s) => {
        if (s.side === enemySide && !s.destroyed && !s.routed && !s.unmanned) {
          return {
            ...s,
            crew: { ...s.crew, morale: Math.min(100, s.crew.morale + killBoost) },
          };
        }
        return s;
      });
    }
  }

  // 5b. Crew morale tick — fatigue, outnumbered, low hull, experience resilience
  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;
    // Unmanned craft have no crew — skip morale entirely
    if (ship.unmanned) return ship;
    let morale = ship.crew.morale;

    // Prolonged combat fatigue: -0.1 per tick after tick 200
    // (battles should be decided by combat, not by waiting)
    if (state.tick > 200) morale -= 0.1;

    // Outnumbered penalty: weighted by hull tonnage so the crew reacts
    // proportionally to how outgunned they are. 9 drones vs a cruiser
    // is pressure but not panic; 9 battleships vs a cruiser is terror.
    const allyPower = ships.filter(
      (s) => s.side === ship.side && !s.destroyed && !s.routed,
    ).reduce((n, s) => n + s.maxHull, 0);
    const enemyPower = ships.filter(
      (s) => s.side !== ship.side && !s.destroyed && !s.routed,
    ).reduce((n, s) => n + s.maxHull, 0);
    if (enemyPower > allyPower * 2) morale -= 0.5;
    else if (enemyPower > allyPower * 1.2) morale -= 0.15;

    // Low hull penalty
    if (ship.hull < ship.maxHull * 0.3) morale -= 0.3;

    // Experience resilience bonus (partially offsets losses)
    const EXP_RESILIENCE: Record<CrewExperience, number> = {
      recruit: 0, trained: 0.02, regular: 0.05, seasoned: 0.08, veteran: 0.10,
      hardened: 0.13, elite: 0.15, ace: 0.18, legendary: 0.20,
    };
    const resilienceBonus = EXP_RESILIENCE[ship.crew.experience] ?? 0;
    morale += resilienceBonus;

    // Commander leadership bonus — quality above 50 boosts morale, below 50 drains it.
    const cmdStation = ship.stations?.commander;
    if (cmdStation) {
      const leadershipMod = (cmdStation.quality - 50) / 500;
      morale += leadershipMod * cmdStation.effectiveness;
    }

    // Morale recovery from crew support components (chaplain, counsellor, etc.)
    if (ship.moraleRecovery && ship.moraleRecovery > 0) {
      morale += ship.moraleRecovery * 0.01;
    }

    // Fighter pilot courage — small manned craft pilots are the bravest.
    // They volunteered for this; they don't break as easily as capital ship crews.
    if (ship.maxHull < 80 && !ship.unmanned) morale += 0.25;

    // Defending home planet — crews fight harder when their world is at stake.
    if (state.layout === 'planetary_assault' && ship.side === 'defender') morale += 0.2;

    // Winning momentum: when we outnumber the enemy, morale recovers slightly.
    // Crews fight harder when they sense victory.
    if (allyPower > enemyPower * 1.5) morale += 0.2;
    else if (allyPower > enemyPower * 1.1) morale += 0.08;

    // Undamaged ships in a large fleet slowly recover morale (safety in numbers).
    if (ship.hull > ship.maxHull * 0.8 && allyPower > enemyPower * 0.8) morale += 0.05;

    morale = Math.max(0, Math.min(100, morale));

    // Check morale thresholds — crew breaks and flees toward the map edge.
    // Aggressive stance raises the bar: crews fight harder.
    // Hull health guard: undamaged ships NEVER flee from morale alone.
    // A ship must be both demoralised AND wounded to break.
    const hpFrac = ship.hull / ship.maxHull;
    const fleeThreshold = ship.stance === 'aggressive' ? 5 : 15;
    const fleeChance = ship.stance === 'aggressive' ? 0.05 : 0.15;
    // Hull health multiplier: intact ships NEVER flee from morale alone.
    // The ship is still fighting — scared crew can't abandon a working vessel.
    // Only when the ship is significantly damaged does morale-based flee activate.
    const hullGuard = hpFrac >= 0.7 ? 0 : hpFrac >= 0.5 ? 0.3 : hpFrac >= 0.3 ? 1.0 : 1.5;
    const effectiveThreshold = fleeThreshold * hullGuard;

    if (morale < effectiveThreshold && !ship.routed && ship.stance !== 'flee') {
      if (Math.random() < fleeChance) {
        return {
          ...ship,
          order: { type: 'flee' as const },
          stance: 'flee' as CombatStance,
          crew: { ...ship.crew, morale },
        };
      }
    }

    return { ...ship, crew: { ...ship.crew, morale } };
  });

  // 6. Combat end detection
  const attackersAlive = ships.filter(
    (s) => s.side === 'attacker' && !s.destroyed && !s.routed,
  );
  const defendersAlive = ships.filter(
    (s) => s.side === 'defender' && !s.destroyed && !s.routed,
  );

  let outcome: TacticalOutcome = null;
  if (attackersAlive.length === 0 && defendersAlive.length === 0) {
    // Both sides eliminated — check who has more surviving (routed) ships
    const attackerRouted = ships.filter(s => s.side === 'attacker' && s.routed && !s.destroyed).length;
    const defenderRouted = ships.filter(s => s.side === 'defender' && s.routed && !s.destroyed).length;
    // Side with more surviving routed ships "won" by having more retreat
    outcome = attackerRouted >= defenderRouted ? 'attacker_wins' : 'defender_wins';
  } else if (attackersAlive.length === 0) {
    outcome = 'defender_wins';
  } else if (defendersAlive.length === 0) {
    outcome = 'attacker_wins';
  }

  // ── Escape pods ─────────────────────────────────────────────────────────
  // Spawn pods from newly destroyed ships; update existing pod positions.
  let activePods: EscapePod[] = [];
  try {
    const newPods: EscapePod[] = [];
    const alreadyDestroyedIds = new Set(
      (state.ships ?? []).filter(s => s.destroyed).map(s => s.id),
    );
    for (const ship of ships) {
      if (ship.destroyed && !alreadyDestroyedIds.has(ship.id) && ship.position) {
        const podCount = ship.maxHull < 80 ? 1 : ship.maxHull < 200 ? 2 : ship.maxHull < 400 ? 3 : 4;
        for (let i = 0; i < podCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 2;
          const podPitch = (Math.random() - 0.5) * Math.PI * 0.3; // slight z scatter
          newPods.push({
            id: generateId(),
            x: ship.position.x + (Math.random() - 0.5) * 10,
            y: ship.position.y + (Math.random() - 0.5) * 10,
            z: ship.position.z,
            vx: Math.cos(angle) * Math.cos(podPitch) * speed,
            vy: Math.sin(angle) * Math.cos(podPitch) * speed,
            vz: Math.sin(podPitch) * speed,
            side: ship.side,
            ttl: 80 + Math.floor(Math.random() * 40),
          });
        }
      }
    }
    const podHalfDepth = (state.battlefieldDepth ?? 400) / 2;
    activePods = [...(state.escapePods ?? []), ...newPods]
      .map(pod => ({ ...pod, x: pod.x + pod.vx, y: pod.y + pod.vy, z: pod.z + pod.vz, ttl: pod.ttl - 1 }))
      .filter(pod => pod.ttl > 0 &&
        pod.x > -50 && pod.x < state.battlefieldWidth + 50 &&
        pod.y > -50 && pod.y < state.battlefieldHeight + 50 &&
        pod.z > -podHalfDepth - 50 && pod.z < podHalfDepth + 50);
  } catch {
    // Escape pods are cosmetic — never crash the simulation
    activePods = (state.escapePods ?? [])
      .map(pod => ({ ...pod, x: pod.x + pod.vx, y: pod.y + pod.vy, z: pod.z + pod.vz, ttl: pod.ttl - 1 }))
      .filter(pod => pod.ttl > 0);
  }

  return {
    tick: state.tick + 1,
    ships,
    projectiles: [...survivingProjectiles, ...newProjectiles],
    missiles: [...survivingMissiles, ...newMissiles],
    fighters: [...fighters, ...newFighters],
    beamEffects: [...beamEffects, ...newBeamEffects],
    pointDefenceEffects: [...pointDefenceEffects, ...newPdEffects],
    escapePods: activePods,
    environment: newEnvironment,
    battlefieldWidth: state.battlefieldWidth,
    battlefieldHeight: state.battlefieldHeight,
    battlefieldDepth: state.battlefieldDepth,
    outcome,
    attackerFormation: state.attackerFormation,
    defenderFormation: state.defenderFormation,
    admirals: state.admirals ?? [],
    layout: state.layout ?? 'open_space',
    planetData: state.planetData,
  };
}

// ---------------------------------------------------------------------------
// Damage application
// ---------------------------------------------------------------------------

/**
 * Shield effectiveness by weapon type and tech age.
 *
 * Low-tech shields (nano_atomic) are good against beams/radiation but struggle
 * with kinetic projectiles and missiles. As tech advances, shields become
 * effective against all damage types.
 *
 * Values are multipliers on shield absorption (1.0 = full, 0.3 = 30% effective).
 */
export type DamageType = 'beam' | 'kinetic' | 'explosive' | 'energy' | 'unknown';

const SHIELD_EFFECTIVENESS: Record<string, Record<DamageType, number>> = {
  // nano_atomic: good vs beams, poor vs kinetic/explosive
  nano_atomic:  { beam: 1.0, energy: 0.9, kinetic: 0.3, explosive: 0.25, unknown: 1.0 },
  // fusion: improving across the board
  fusion:       { beam: 1.0, energy: 1.0, kinetic: 0.5, explosive: 0.4,  unknown: 1.0 },
  // nano_fusion: solid all-round protection
  nano_fusion:  { beam: 1.0, energy: 1.0, kinetic: 0.7, explosive: 0.6,  unknown: 1.0 },
  // anti_matter: very effective against everything
  anti_matter:  { beam: 1.0, energy: 1.0, kinetic: 0.85, explosive: 0.8, unknown: 1.0 },
  // singularity: near-perfect against all types
  singularity:  { beam: 1.0, energy: 1.0, kinetic: 0.95, explosive: 0.9, unknown: 1.0 },
};

/**
 * Apply raw damage to a ship through the shield -> armour -> hull pipeline.
 *
 * 1. Shields absorb damage first — effectiveness depends on shield tech age
 *    vs weapon type. Low-tech shields barely stop kinetics; advanced shields
 *    handle everything.
 * 2. Armour reduces remaining damage by 25%, but degrades by half the
 *    absorbed amount each hit.
 * 3. Hull takes the rest (minimum 1 if any damage got past shields).
 * 4. Ship is destroyed at 0 hull. Below 50% hull, a catastrophic failure
 *    roll (up to 10% chance) may destroy the ship outright.
 *
 * Exported for testing — not part of the public API contract.
 */
export function applyDamage(
  ship: TacticalShip,
  rawDamage: number,
  damageType: DamageType = 'unknown',
  shieldAge?: string,
): TacticalShip {
  let remaining = rawDamage;

  // 1. Shields absorb first — effectiveness depends on tech age vs damage type
  let newShields = ship.shields;
  if (newShields > 0) {
    const age = shieldAge ?? ship.shieldAge ?? 'nano_atomic';
    const eff = SHIELD_EFFECTIVENESS[age]?.[damageType] ?? 0.5;
    // Shield absorbs (raw * effectiveness) but depletes by the full amount
    const effectiveAbsorb = remaining * eff;
    const shieldDrain = Math.min(newShields, effectiveAbsorb);
    newShields -= shieldDrain;
    // Damage reduced by what the shield actually blocked
    remaining -= shieldDrain / (eff || 1); // convert back to raw damage blocked
    if (remaining < 0) remaining = 0;
  }

  // 2. Armour reduces remaining damage by 25% (but armour degrades)
  let newArmour = ship.armour;
  if (remaining > 0 && newArmour > 0) {
    const armourAbsorb = Math.min(remaining * ARMOUR_ABSORPTION_FRACTION, newArmour);
    remaining -= armourAbsorb;
    newArmour -= armourAbsorb * ARMOUR_DEGRADATION_FACTOR; // armour degrades
  }

  // 3. Hull takes remaining damage (minimum 1 if any damage got past shields)
  let newHull = ship.hull;
  let destroyed = false;
  if (remaining > 0) {
    const hullDamage = Math.max(1, remaining);
    newHull = Math.max(0, newHull - hullDamage);

    if (newHull <= 0) {
      destroyed = true;
    } else if (newHull < ship.maxHull * 0.5) {
      // Catastrophic failure chance scales with damage: up to 10% at 0% hull
      const failChance = (1 - newHull / ship.maxHull) * CATASTROPHIC_FAILURE_MAX;
      if (Math.random() < failChance) {
        destroyed = true;
        newHull = 0;
      }
    }
  }

  return {
    ...ship,
    shields: newShields,
    armour: newArmour,
    hull: newHull,
    destroyed,
    damageTakenThisTick: (ship.damageTakenThisTick ?? 0) + rawDamage,
    position: { ...ship.position },
    weapons: ship.weapons.map((w) => ({ ...w })),
  };
}

// ---------------------------------------------------------------------------
// Targeting AI utilities — damage estimation and fleet coordination
// ---------------------------------------------------------------------------

/**
 * Map weapon type to damage category for shield effectiveness lookup.
 */
function weaponDamageType(wType: string): DamageType {
  switch (wType) {
    case 'beam': return 'beam';
    case 'projectile': return 'kinetic';
    case 'missile': return 'explosive';
    case 'fighter_bay': return 'energy';
    default: return 'kinetic';
  }
}

/**
 * Estimate DPS that `ship` can deal to `target`, accounting for
 * shield effectiveness, accuracy, and armour absorption.
 */
function estimateDPS(ship: TacticalShip, target: TacticalShip): number {
  let totalDps = 0;
  const maxRange = ship.weapons.length > 0
    ? Math.max(...ship.weapons.map(w => w.range))
    : 200;
  const d = dist(ship.position, target.position);

  for (const w of ship.weapons) {
    // Skip point defence — it does not contribute to target damage
    if (w.type === 'point_defense') continue;
    // Only count weapons that can reach the target (with 20% leeway for closure)
    if (d > w.range * 1.2) continue;

    const baseDps = w.damage / Math.max(1, w.cooldownMax);

    // Shield effectiveness reduction
    const dmgType = weaponDamageType(w.type);
    const shieldAge = target.shieldAge ?? 'nano_atomic';
    const shieldEff = SHIELD_EFFECTIVENESS[shieldAge]?.[dmgType] ?? 0.5;
    const shieldFactor = target.shields > 0 ? (1 - shieldEff * 0.6) : 1.0;

    // Accuracy factor — rough estimate based on weapon accuracy
    const accFactor = Math.max(0.2, w.accuracy / 100);

    // Armour absorption reduction (25% absorbed if armour remains)
    const armourFactor = target.armour > 0 ? (1 - ARMOUR_ABSORPTION_FRACTION) : 1.0;

    totalDps += baseDps * shieldFactor * accFactor * armourFactor;
  }

  return totalDps;
}

/**
 * Estimate whether `ship` can meaningfully damage `target` over 30 ticks.
 * Returns a graduated score: -100 (hopeless) to +10 (highly effective).
 */
function canMeaningfullyDamage(
  ship: TacticalShip,
  target: TacticalShip,
): { can: boolean; score: number } {
  const dps = estimateDPS(ship, target);
  const estimatedDamage = dps * 30;
  const targetTotalHP = target.hull + target.shields + target.armour;

  if (targetTotalHP <= 0) return { can: true, score: 10 };

  const damageFraction = estimatedDamage / targetTotalHP;

  if (damageFraction < 0.05) {
    // Cannot meaningfully damage this target — graduated penalty
    // 0% => -100, 2.5% => -50, 4.9% => ~-2
    const penalty = -100 + (damageFraction / 0.05) * 100;
    return { can: false, score: Math.min(-2, penalty) };
  }

  // Graduated positive score: 5% => 0, 50%+ => +10
  const bonus = Math.min(10, (damageFraction - 0.05) / 0.45 * 10);
  return { can: true, score: bonus };
}

/**
 * Assess the overall fleet situation for one side. Computes power ratios,
 * identifies focus fire targets, and flags allies that need support.
 */
function assessFleetSituation(
  allShips: TacticalShip[],
  side: 'attacker' | 'defender',
): FleetCoordination {
  const allies = allShips.filter(
    s => s.side === side && !s.destroyed && !s.routed,
  );
  const enemies = allShips.filter(
    s => s.side !== side && !s.destroyed && !s.routed,
  );

  // Power ratio (hull-based)
  const allyPower = allies.reduce((n, s) => n + s.maxHull, 0);
  const enemyPower = enemies.reduce((n, s) => n + s.maxHull, 0);
  const powerRatio = enemyPower > 0 ? allyPower / enemyPower : 10;

  // DPS ratio
  const allyDps = allies.reduce((n, s) => {
    return n + s.weapons
      .filter(w => w.type !== 'point_defense')
      .reduce((d, w) => d + w.damage / Math.max(1, w.cooldownMax), 0);
  }, 0);
  const enemyDps = enemies.reduce((n, s) => {
    return n + s.weapons
      .filter(w => w.type !== 'point_defense')
      .reduce((d, w) => d + w.damage / Math.max(1, w.cooldownMax), 0);
  }, 0);
  const dpsRatio = enemyDps > 0 ? allyDps / enemyDps : 10;

  // Determine situation
  let situation: FleetCoordination['situation'];
  if (powerRatio < 0.5 && dpsRatio < 0.5) situation = 'losing';
  else if (enemies.length > allies.length * 1.5) situation = 'outnumbered';
  else if (dpsRatio < 0.6) situation = 'outgunned';
  else if (powerRatio > 1.5 && dpsRatio > 1.2) situation = 'winning';
  else situation = 'even';

  // Focus fire targets: count how many allies are attacking each enemy
  const attackCounts = new Map<string, number>();
  for (const ally of allies) {
    if (ally.order.type === 'attack') {
      const tid = ally.order.targetId;
      attackCounts.set(tid, (attackCounts.get(tid) ?? 0) + 1);
    }
  }

  // The most-attacked enemies get a coordination bonus — encourage focus fire
  const focusTargets = new Map<string, number>();
  for (const [targetId, count] of attackCounts) {
    if (count >= 2) {
      // Bonus scales: 2 attackers = +10, 3 = +20, 4+ = +25 (cap)
      const bonus = Math.min(25, (count - 1) * 10);
      focusTargets.set(targetId, bonus);
    }
  }

  // Enemies with lowest HP fraction also get focus fire priority
  for (const enemy of enemies) {
    const hpFrac = enemy.hull / enemy.maxHull;
    if (hpFrac < 0.3 && !focusTargets.has(enemy.id)) {
      focusTargets.set(enemy.id, 15); // low HP target — finish it off
    }
  }

  // Support requests: allies that are under fire from 3+ enemies
  const supportRequests = new Set<string>();
  for (const ally of allies) {
    const attackersOnAlly = enemies.filter(
      e => e.order.type === 'attack' &&
           (e.order.targetId === ally.id || e.order.targetId === ally.sourceShipId),
    ).length;
    if (attackersOnAlly >= 3) {
      supportRequests.add(ally.id);
    }
  }

  return { side, focusTargets, supportRequests, situation };
}

// ---------------------------------------------------------------------------
// Admiral commands
// ---------------------------------------------------------------------------

/**
 * Compute the number of tactical pauses an admiral gets based on experience.
 */
export function admiralPauseCount(experience: CrewExperience): number {
  const idx = EXP_LEVELS.indexOf(experience);
  if (idx < 0) return 1;
  // 1 pause at recruit, scaling to 5 at legendary
  return 1 + Math.floor(idx / 2);
}

/**
 * Create an admiral with default ability charges.
 */
export function createAdmiral(
  name: string,
  side: 'attacker' | 'defender',
  trait: AdmiralTrait,
  experience: CrewExperience,
): Admiral {
  return {
    name,
    side,
    trait,
    experience,
    pausesRemaining: admiralPauseCount(experience),
    rallyUsed: false,
    emergencyRepairUsed: false,
  };
}

/**
 * Admiral rally command — boosts all friendly ships' morale by 20.
 * One-time use per battle.
 */
export function admiralRally(
  state: TacticalState,
  side: 'attacker' | 'defender',
): TacticalState {
  const admiral = state.admirals.find((a) => a.side === side);
  if (!admiral || admiral.rallyUsed) return state;

  return {
    ...state,
    admirals: state.admirals.map((a) =>
      a.side === side ? { ...a, rallyUsed: true } : a,
    ),
    ships: state.ships.map((s) => {
      if (s.side !== side || s.destroyed || s.routed) return s;
      return {
        ...s,
        crew: { ...s.crew, morale: Math.min(100, s.crew.morale + 20) },
      };
    }),
  };
}

/**
 * Admiral emergency repair — target ship receives 15% max hull repair.
 * One-time use per battle.
 */
export function admiralEmergencyRepair(
  state: TacticalState,
  side: 'attacker' | 'defender',
  shipId: string,
): TacticalState {
  const admiral = state.admirals.find((a) => a.side === side);
  if (!admiral || admiral.emergencyRepairUsed) return state;

  return {
    ...state,
    admirals: state.admirals.map((a) =>
      a.side === side ? { ...a, emergencyRepairUsed: true } : a,
    ),
    ships: state.ships.map((s) => {
      if (s.id !== shipId || s.destroyed || s.routed) return s;
      return {
        ...s,
        order: { type: 'idle' as const },
        hull: Math.min(s.maxHull, s.hull + s.maxHull * 0.15),
      };
    }),
  };
}

/**
 * Admiral pause — decrement the admiral's remaining pauses.
 * Returns null if the admiral has no pauses remaining.
 */
export function admiralPause(
  state: TacticalState,
  side: 'attacker' | 'defender',
): TacticalState | null {
  const admiral = state.admirals.find((a) => a.side === side);
  if (!admiral || admiral.pausesRemaining <= 0) return null;

  return {
    ...state,
    admirals: state.admirals.map((a) =>
      a.side === side ? { ...a, pausesRemaining: a.pausesRemaining - 1 } : a,
    ),
  };
}

// ---------------------------------------------------------------------------
// Experience gain
// ---------------------------------------------------------------------------

const EXP_LEVELS: readonly CrewExperience[] = [
  'recruit', 'trained', 'regular', 'seasoned', 'veteran',
  'hardened', 'elite', 'ace', 'legendary',
];

/**
 * Calculate post-combat experience promotion for a ship's crew.
 *
 * A crew may advance one level if they won the battle or were significantly
 * outnumbered. Losing while equally matched or having superior numbers does
 * not grant a promotion.
 */
export function calculateExperienceGain(
  ship: TacticalShip,
  wasVictorious: boolean,
  enemyShipCount: number,
  allyShipCount: number,
): CrewExperience {
  const currentIdx = EXP_LEVELS.indexOf(ship.crew.experience);

  // Difficult battles (outnumbered) give bonus
  const outnumberedRatio = allyShipCount > 0 ? enemyShipCount / allyShipCount : 0;
  const difficultyBonus = outnumberedRatio >= 1.5 ? 2 : 0;
  const victoryBonus = wasVictorious ? 2 : 0;

  const totalGain = victoryBonus + difficultyBonus;

  // Determine the cap based on how outnumbered and whether victorious:
  //   - Normal victories cap at elite (index 6)
  //   - Outnumbered victories (1.5x+) can reach ace (index 7)
  //   - Extremely outnumbered victories (2x+) can reach legendary (index 8)
  const ELITE_IDX = EXP_LEVELS.indexOf('elite');
  const ACE_IDX = EXP_LEVELS.indexOf('ace');
  const LEGENDARY_IDX = EXP_LEVELS.indexOf('legendary');

  let cap = ELITE_IDX;
  if (wasVictorious && outnumberedRatio >= 2.0) {
    cap = LEGENDARY_IDX;
  } else if (wasVictorious && outnumberedRatio >= 1.5) {
    cap = ACE_IDX;
  }

  const newIdx = Math.min(cap, currentIdx + totalGain);

  return EXP_LEVELS[newIdx]!;
}

// ---------------------------------------------------------------------------
// Battle report generation
// ---------------------------------------------------------------------------

export interface BattleReport {
  winner: 'attacker' | 'defender' | 'draw';
  ticksElapsed: number;
  attacker: BattleSideReport;
  defender: BattleSideReport;
  salvage: SalvageResult;
}

export interface BattleSideReport {
  shipsEngaged: number;
  shipsDestroyed: number;
  shipsRouted: number;
  shipsSurvived: number;
  totalDamageDealt: number;
  experienceGained: Array<{ shipId: string; newExperience: CrewExperience }>;
}

export interface SalvageResult {
  credits: number;
  minerals: number;
  /** Tech IDs that might be discovered from enemy wreckage. */
  techFragments: string[];
}

/** Base salvage credits per destroyed ship. */
const SALVAGE_CREDITS_PER_SHIP = 50;
/** Base salvage minerals per destroyed ship. */
const SALVAGE_MINERALS_PER_SHIP = 20;

/**
 * Generate a detailed post-combat battle report from the final TacticalState.
 *
 * The report contains per-side statistics (ships engaged/destroyed/routed/survived),
 * experience promotions for surviving crews, and salvage quantities derived from
 * the number of destroyed ships.
 */
export function generateBattleReport(state: TacticalState): BattleReport {
  const attackerShips = state.ships.filter(s => s.side === 'attacker');
  const defenderShips = state.ships.filter(s => s.side === 'defender');

  const winner: BattleReport['winner'] =
    state.outcome === 'attacker_wins' ? 'attacker'
    : state.outcome === 'defender_wins' ? 'defender'
    : 'draw';

  const buildSideReport = (
    ships: TacticalShip[],
    enemyShips: TacticalShip[],
    isWinningSide: boolean,
  ): BattleSideReport => {
    const survived = ships.filter(s => !s.destroyed && !s.routed);
    const destroyed = ships.filter(s => s.destroyed);
    const routed = ships.filter(s => s.routed);

    // Estimate total damage dealt: sum of (maxHull - hull) for enemy ships
    const totalDamageDealt = enemyShips.reduce((sum, es) => {
      const hullDmg = es.maxHull - Math.max(0, es.hull);
      const shieldDmg = es.maxShields - Math.max(0, es.shields);
      return sum + hullDmg + shieldDmg;
    }, 0);

    return {
      shipsEngaged: ships.length,
      shipsDestroyed: destroyed.length,
      shipsRouted: routed.length,
      shipsSurvived: survived.length,
      totalDamageDealt: Math.round(totalDamageDealt),
      experienceGained: survived.map(s => ({
        shipId: s.sourceShipId,
        newExperience: calculateExperienceGain(
          s,
          isWinningSide,
          enemyShips.length,
          ships.length,
        ),
      })),
    };
  };

  // Salvage: based on destroyed ships from both sides
  const allDestroyed = [...attackerShips, ...defenderShips].filter(s => s.destroyed);
  const salvageCredits = allDestroyed.length * SALVAGE_CREDITS_PER_SHIP;
  const salvageMinerals = allDestroyed.length * SALVAGE_MINERALS_PER_SHIP;

  return {
    winner,
    ticksElapsed: state.tick,
    attacker: buildSideReport(
      attackerShips,
      defenderShips,
      winner === 'attacker',
    ),
    defender: buildSideReport(
      defenderShips,
      attackerShips,
      winner === 'defender',
    ),
    salvage: {
      credits: salvageCredits,
      minerals: salvageMinerals,
      techFragments: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Occupation policies
// ---------------------------------------------------------------------------

export type OccupationPolicy =
  | 'peaceful_occupation'
  | 'forced_labour'
  | 're_education'
  | 'decapitate_leadership'
  | 'raze_and_loot'
  | 'enslavement'
  | 'mass_genocide';

/**
 * Determine which occupation policies are available based on the species'
 * combat trait value (1-10).
 *
 * Peaceful species (combat <= 3) cannot commit genocide or enslave;
 * moderate species (4-6) unlock forced labour;
 * aggressive species (7-8) unlock enslavement;
 * only the most violent (9-10) may commit genocide.
 */
export function getAllowedPolicies(combatTrait: number): OccupationPolicy[] {
  const policies: OccupationPolicy[] = [
    'peaceful_occupation',
    're_education',
    'decapitate_leadership',
    'raze_and_loot',
  ];

  if (combatTrait >= 4) {
    policies.push('forced_labour');
  }

  if (combatTrait >= 7) {
    policies.push('enslavement');
  }

  if (combatTrait >= 9) {
    policies.push('mass_genocide');
  }

  return policies;
}
