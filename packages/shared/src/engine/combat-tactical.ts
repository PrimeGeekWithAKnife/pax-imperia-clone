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

import type { Fleet, Ship, ShipDesign, ShipComponent, ComponentType, HullTemplate } from '../types/ships.js';
import { generateId } from '../utils/id.js';
import { HULL_TEMPLATE_BY_CLASS } from '../../data/ships/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BATTLEFIELD_WIDTH = 1600;
export const BATTLEFIELD_HEIGHT = 1000;
export const PROJECTILE_SPEED = 8;

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
const MISSILE_MAX_SPEED = 16;
/** Missile acceleration (pixels per tick^2). */
const MISSILE_ACCELERATION = 1.5;
/** Hit radius for missile collision detection. */
const MISSILE_HIT_RADIUS = 12;
/** Fuel ticks for missiles — go inert after this many ticks in flight. */
const MISSILE_FUEL_TICKS = 60;

/** Default ammo for missile weapons. */
const MISSILE_DEFAULT_AMMO = 6;
/** Default ammo for projectile weapons. */
const PROJECTILE_DEFAULT_AMMO = 50;
/** Default ammo for point defence weapons. */
const POINT_DEFENSE_DEFAULT_AMMO = 100;

/** Per-missile-type physics and ammo profiles. */
const MISSILE_PROFILES: Record<string, { initSpeed: number; maxSpeed: number; accel: number; ammo: number; cooldown: number }> = {
  // All missiles outrun ships (fastest ship = 14). Slowest missile maxSpeed 12,
  // fastest 30. Higher tech = faster, harder to intercept.
  // nano_atomic age
  basic_missile:       { initSpeed: 4,  maxSpeed: 12, accel: 1.5, ammo: 12, cooldown: 8 },   // cheap salvo
  hv_missile:          { initSpeed: 6,  maxSpeed: 14, accel: 2.0, ammo: 8,  cooldown: 10 },  // high-velocity
  basic_torpedo:       { initSpeed: 3,  maxSpeed: 12, accel: 1.0, ammo: 6,  cooldown: 20 },  // standard torpedo
  torpedo_rack:        { initSpeed: 3,  maxSpeed: 12, accel: 1.0, ammo: 6,  cooldown: 20 },  // multi-tube
  icbm_torpedo:        { initSpeed: 2,  maxSpeed: 10, accel: 0.5, ammo: 1,  cooldown: 40 },  // crude nuke — slowest
  // fusion age
  guided_torpedo:      { initSpeed: 5,  maxSpeed: 16, accel: 2.0, ammo: 4,  cooldown: 20 },  // smart tracking
  cluster_missile:     { initSpeed: 5,  maxSpeed: 15, accel: 1.8, ammo: 4,  cooldown: 15 },  // splits near target
  emp_torpedo:         { initSpeed: 5,  maxSpeed: 16, accel: 1.5, ammo: 3,  cooldown: 20 },  // EMP warhead
  // nano_fusion age
  fusion_torpedo:      { initSpeed: 6,  maxSpeed: 20, accel: 2.5, ammo: 3,  cooldown: 18 },  // fast heavy
  swarm_missiles:      { initSpeed: 8,  maxSpeed: 22, accel: 3.0, ammo: 16, cooldown: 15 },  // overwhelming swarm
  bunker_buster:       { initSpeed: 4,  maxSpeed: 18, accel: 1.5, ammo: 2,  cooldown: 25 },  // heavy penetrator
  // anti_matter age
  antimatter_torpedo:  { initSpeed: 8,  maxSpeed: 25, accel: 3.5, ammo: 2,  cooldown: 18 },  // fast and devastating
  void_seeker:         { initSpeed: 10, maxSpeed: 28, accel: 4.0, ammo: 2,  cooldown: 18 },  // stealthy and fast
  // singularity age
  singularity_torpedo: { initSpeed: 12, maxSpeed: 30, accel: 5.0, ammo: 1,  cooldown: 20 },  // near-impossible to intercept
  phase_torpedo:       { initSpeed: 14, maxSpeed: 30, accel: 5.0, ammo: 1,  cooldown: 20 },  // phases through shields
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

export interface TacticalShip {
  id: string;
  sourceShipId: string;  // links back to the canonical Ship
  name: string;
  side: 'attacker' | 'defender';
  position: { x: number; y: number };
  velocity: { x: number; y: number }; // current drift (Newtonian momentum)
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
}

export interface Projectile {
  id: string;
  position: { x: number; y: number };
  speed: number;
  damage: number;
  sourceShipId: string;
  targetShipId: string;
  componentId?: string;
}

export interface Missile {
  id: string;
  sourceShipId: string;
  targetShipId: string;
  componentId: string;
  x: number;
  y: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  damage: number;
  damageType: string;
  /** Remaining fuel ticks — missile goes inert when exhausted. */
  fuel: number;
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
  width: number; height: number; maxShipsPerSide: number;
  asteroidMin: number; asteroidMax: number;
  nebulaMin: number; nebulaMax: number;
}> = {
  small:  { width: 1600, height: 1000, maxShipsPerSide: 9,  asteroidMin: 3,  asteroidMax: 8,  nebulaMin: 0, nebulaMax: 2 },
  medium: { width: 2800, height: 1750, maxShipsPerSide: 18, asteroidMin: 5,  asteroidMax: 12, nebulaMin: 1, nebulaMax: 3 },
  large:  { width: 4800, height: 3000, maxShipsPerSide: 36, asteroidMin: 8,  asteroidMax: 20, nebulaMin: 2, nebulaMax: 5 },
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
  vx: number;
  vy: number;
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
  outcome: TacticalOutcome;
  attackerFormation: FormationType;
  defenderFormation: FormationType;
  admirals: Admiral[];
  layout: CombatLayout;
  planetData?: PlanetData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
 * Compute the shortest distance from point (px, py) to the line segment
 * from (ax, ay) to (bx, by).
 */
export function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    // Degenerate segment (zero length)
    return Math.sqrt(apx * apx + apy * apy);
  }
  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  const closestX = ax + t * abx;
  const closestY = ay + t * aby;
  const dx = px - closestX;
  const dy = py - closestY;
  return Math.sqrt(dx * dx + dy * dy);
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
): TacticalShip | null {
  for (const ship of allShips) {
    if (excludeIds.has(ship.id) || ship.destroyed || ship.routed) continue;
    const d = pointToSegmentDistance(
      ship.position.x, ship.position.y,
      sourceX, sourceY,
      targetX, targetY,
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
    const d = pointToSegmentDistance(f.x, f.y, ax, ay, bx, by);
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

/** Half-arc width in radians for each weapon facing. */
export const WEAPON_ARC: Record<WeaponFacing, number> = {
  fore: Math.PI / 2,        // 90 deg forward arc
  aft: Math.PI / 2,         // 90 deg rear arc
  port: Math.PI / 2,        // 90 deg left arc
  starboard: Math.PI / 2,   // 90 deg right arc
  turret: Math.PI * 1.5,    // 270 deg (everything except directly behind)
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
  return Math.abs(diff) <= arc / 2;
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
        dist(ship.position, { x: m.x, y: m.y }) < 150,
    );
    if (incomingMissiles.length > 0) {
      // Dodge perpendicular to the nearest incoming missile
      const nearest = incomingMissiles.reduce((best, m) => {
        const md = dist(ship.position, { x: m.x, y: m.y });
        const bd = dist(ship.position, { x: best.x, y: best.y });
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
        position: { x: targetX, y: targetY },
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
      // so all ships face the enemy and can fire simultaneously
      const lineSpacing = 50;
      const totalHeight = (ships.length - 1) * lineSpacing;
      const startY = baseY - totalHeight / 2;
      const col = Math.floor(index / 8); // stagger overflow into depth
      const row = index % 8;
      const x = baseX + col * 60;
      const y = startY + row * lineSpacing;

      const design = designs.get(ship.designId);
      const hullTemplate = design ? HULL_TEMPLATE_BY_CLASS[design.hull] : undefined;
      const extracted = extractShipStats(design, componentById, ship.magazineLevel ?? 1.0, hullTemplate);

      return {
        id: generateId(),
        sourceShipId: ship.id,
        name: ship.name,
        side,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        facing,
        // Max speed comes from the hull — engines don't make you faster,
        // they make you accelerate faster (more thrust).
        speed: hullTemplate?.baseSpeed ?? extracted.speed,
        // Acceleration = engine thrust / mass.
        acceleration: Math.max(extracted.speed, 1)
          / Math.max(1, Math.sqrt((ship.maxHullPoints + extracted.armour) / 50)),
        // RCS provides direction-independent thrust for braking without turning
        rcsThrust: extracted.rcsThrust ?? 0,
        // Turn rate scales inversely with mass. Drones turn on a pin,
        // battleships lumber. Unmanned craft (drones) get a 2x bonus.
        turnRate: (hullTemplate?.manned === false ? 0.20 : 0.10)
          / Math.max(1, Math.sqrt((ship.maxHullPoints + extracted.armour) / 100)),
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
        },
        velocity: { x: 0, y: 0 },
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
          break;
        case 'shield':
          maxShields += comp.stats['shieldStrength'] ?? 0;
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

  // Score each enemy
  const maxRange = ship.weapons.length > 0 ? Math.max(...ship.weapons.map(w => w.range)) : 200;
  let bestEnemy: TacticalShip | null = null;
  let bestScore = -Infinity;

  for (const enemy of enemies) {
    const d = dist(ship.position, enemy.position);
    let score = 0;

    // --- Range factor: prefer enemies within weapon range ---
    if (d <= maxRange) {
      score += 40; // in range bonus
    } else {
      score -= (d - maxRange) * 0.05; // distance penalty
    }

    // --- Opportunity: damaged targets are tempting ---
    const hpFraction = enemy.hull / enemy.maxHull;
    score += (1 - hpFraction) * 30; // low HP = high opportunity
    if (enemy.shields <= 0) score += 15; // shields down = vulnerable

    // --- Threat: is this enemy shooting at us? ---
    const isTargetingUs = enemy.order.type === 'attack' &&
      (enemy.order.targetId === ship.id || enemy.order.targetId === ship.sourceShipId);
    if (isTargetingUs) score += 25;

    // --- Size factor: prefer engaging similar or smaller targets ---
    if (enemy.maxHull <= ship.maxHull) {
      score += 10; // smaller or equal target
    } else {
      score -= 5; // larger target penalty (unless we're aggressive)
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
      if (
        result.position.x < -20 || result.position.x > state.battlefieldWidth + 20 ||
        result.position.y < -20 || result.position.y > state.battlefieldHeight + 20
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
  const MINIMUM_ALLY_SPACING = ship.maxHull < 80 ? 60 : 50;
  let spreadX = 0;
  let spreadY = 0;
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
    }
  }

  // Small craft threshold — fighters, drones, bombers flank instead of charging
  const isSmallCraft = ship.maxHull < 80;

  switch (ship.stance) {
    case 'aggressive': {
      if (isSmallCraft && target.maxHull > ship.maxHull * 2) {
        return smallCraftFlank(updated, ship, target, state, spreadX, spreadY);
      }
      // Regular ships: close to engagement distance with spread
      return moveToward(updated, {
        x: target.position.x + spreadX,
        y: target.position.y + spreadY,
      }, engageDistance(ship), state.environment, state.ships);
    }

    case 'defensive': {
      // Hold position — only advance if no enemies are in range
      if (d <= maxRange) {
        // In range — hold and face target
        return holdAndFace(updated, angleTo(ship.position, target.position));
      }
      // Out of range with explicit attack order — slowly close
      if (ship.order.type === 'attack') {
        return moveToward(updated, target.position, maxRange * 0.9, state.environment, state.ships);
      }
      return updated;
    }

    case 'at_ease': {
      // Captain's judgement — assess the situation before acting.
      //
      // Priority 1: Is someone shooting at us? Engage the threat.
      // Priority 2: Is an ally nearby under fire? Move to assist.
      // Priority 3: Enemy closing into our range? Face them, weapons ready.
      // Priority 4: Nothing pressing? Hold position, face nearest enemy.

      // Check if any enemy is actively targeting us
      const threatToUs = state.ships.find(
        (s) => s.side !== ship.side && !s.destroyed && !s.routed &&
          s.order.type === 'attack' &&
          (s.order.targetId === ship.id || s.order.targetId === ship.sourceShipId),
      );

      if (threatToUs) {
        const threatDist = dist(ship.position, threatToUs.position);
        if (threatDist <= smartEngageDist * 1.1) {
          // Threat within engagement range — hold and face them
          return holdAndFace(updated, angleTo(ship.position, threatToUs.position));
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
        // Find the closest weak ally within 2x weapon range
        let wardAlly: TacticalShip | null = null;
        let wardDist = maxRange * 2;
        for (const ally of weakAllies) {
          const ad = dist(ship.position, ally.position);
          if (ad < wardDist) { wardAlly = ally; wardDist = ad; }
        }
        if (wardAlly) {
          // Find the nearest enemy to that ally
          const enemyToAlly = state.ships
            .filter(s => s.side !== ship.side && !s.destroyed && !s.routed)
            .reduce<TacticalShip | null>((best, e) => {
              const ed = dist(wardAlly!.position, e.position);
              return (!best || ed < dist(wardAlly!.position, best.position)) ? e : best;
            }, null);
          if (enemyToAlly) {
            // Position ourselves between the ally and the enemy
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
          return moveToward(updated, closestAlly.position, engageDistance(ship), state.environment, state.ships);
        }
      }

      // Small craft always orbit — never hold position or do simple approach
      if (isSmallCraft && target.maxHull > ship.maxHull * 2) {
        return smallCraftFlank(updated, ship, target, state, spreadX, spreadY);
      }

      // No immediate threats — if within comfortable engagement range, hold and face
      // Use smartEngageDist (not maxRange) so we close to where MOST weapons fire
      if (d <= smartEngageDist * 1.1) {
        return holdAndFace(updated, angleTo(ship.position, target.position));
      }

      // Out of comfortable range — close to engagement distance
      // With an explicit attack order: flank approach
      if (ship.order.type === 'attack') {
        const angleToTarget = angleTo(ship.position, target.position);
        const flankOffset = ship.id.charCodeAt(0) % 2 === 0 ? 0.4 : -0.4;
        const flankAngle = angleToTarget + flankOffset;
        const flankX = target.position.x - Math.cos(flankAngle) * smartEngageDist;
        const flankY = target.position.y - Math.sin(flankAngle) * smartEngageDist;
        return moveToward(updated, { x: flankX, y: flankY }, 10, state.environment, state.ships);
      }
      return moveToward(updated, {
        x: target.position.x + spreadX,
        y: target.position.y + spreadY,
      }, smartEngageDist, state.environment, state.ships);
    }

    case 'evasive': {
      // Kite — maintain maximum weapon range, stay as far as possible while firing
      if (d < maxRange * 0.7) {
        // Too close — retreat
        const awayX = ship.position.x + (ship.position.x - target.position.x);
        const awayY = ship.position.y + (ship.position.y - target.position.y);
        return moveToward(updated, { x: awayX, y: awayY }, 0, state.environment, state.ships);
      }
      if (d > maxRange * 1.1) {
        // Too far — close to max range edge
        return moveToward(updated, target.position, maxRange * 0.9, state.environment, state.ships);
      }
      // In the sweet spot — face target
      return holdAndFace(updated, angleTo(ship.position, target.position));
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
  const currentSpeed = Math.sqrt(vx * vx + vy * vy);

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
  }

  return {
    ...ship,
    facing: newFacing,
    velocity: { x: vx, y: vy },
    position: {
      x: ship.position.x + vx,
      y: ship.position.y + vy,
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
  target: { x: number; y: number },
  minDist: number,
  environment?: EnvironmentFeature[],
  allShips?: TacticalShip[],
): TacticalShip {
  const d = dist(ship.position, target);
  const vx = ship.velocity?.x ?? 0;
  const vy = ship.velocity?.y ?? 0;
  const currentSpeed = Math.sqrt(vx * vx + vy * vy);

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

  if (d > minDist) {
    // Thrust toward target — small random angle deviation from helmsman
    const jitterAngle = (CREW_JITTER[exp] ?? 0.04) * (Math.random() * 2 - 1);
    const thrustAngle = newFacing + jitterAngle;
    newVx += Math.cos(thrustAngle) * accel * 0.3;
    newVy += Math.sin(thrustAngle) * accel * 0.3;
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
  }

  // Apply drag (simulates micro-thruster corrections / space friction lite)
  newVx *= SPACE_DRAG;
  newVy *= SPACE_DRAG;

  // Clamp to max velocity (ship.speed is the speed cap)
  const maxV = ship.speed ?? MAX_VELOCITY;
  const newSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
  if (newSpeed > maxV) {
    const scale = maxV / newSpeed;
    newVx *= scale;
    newVy *= scale;
  }

  // Apply velocity to position
  const nx = ship.position.x + newVx;
  const ny = ship.position.y + newVy;

  return {
    ...ship,
    facing: newFacing,
    velocity: { x: newVx, y: newVy },
    position: { x: nx, y: ny },
  };
}

/**
 * The distance at which a ship stops approaching its target.
 * 80% of max weapon range, or 100 if the ship has no weapons.
 */
function engageDistance(ship: TacticalShip): number {
  if (ship.weapons.length === 0) return 100;
  // Use the SHORTEST weapon range so ALL weapons can fire, not just the longest-ranged
  const nonPD = ship.weapons.filter(w => w.type !== 'point_defense');
  if (nonPD.length === 0) return 100;
  const minRange = Math.min(...nonPD.map((w) => w.range));
  return minRange * ENGAGE_RANGE_FRACTION;
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

    const d = dist(ship.position, { x: missile.x, y: missile.y });
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
    const d = dist(ship.position, { x: fighter.x, y: fighter.y });
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
    const d = dist({ x: fighter.x, y: fighter.y }, ship.position);
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

  // 0b. AI ships: switch to at_ease stance after tick 5
  // (gives the player a few seconds to set up before AI engages autonomously)
  if (state.tick === 5) {
    state = {
      ...state,
      ships: state.ships.map(s => {
        if (s.side === 'defender' && s.order.type === 'idle' && !s.destroyed && !s.routed) {
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
    const recharged = Math.min(
      ship.maxShields,
      ship.shields + ship.maxShields * SHIELD_RECHARGE_FRACTION,
    );
    return recharged !== ship.shields ? { ...ship, shields: recharged } : ship;
  });

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
          return applyDamage(ship, dmg);
        }
        break; // only check one debris field per tick
      }
    }
    return ship;
  });

  // 2. Move ships
  ships = ships.map((ship) => moveShip(ship, state));

  // 3. Move projectiles and check for hits (with friendly fire + asteroid intercept)
  const hitRadius = 12;
  const survivingProjectiles: Projectile[] = [];

  for (const proj of state.projectiles) {
    const target = ships.find((s) => s.id === proj.targetShipId || s.sourceShipId === proj.targetShipId);

    // If target is gone, projectile continues in its direction (pool ball)
    // and hits the first ship in its path
    if (target == null || target.destroyed || target.routed) {
      // Continue moving in current direction
      const facing = Math.atan2(
        (proj as unknown as Record<string, number>).prevDy ?? 0,
        (proj as unknown as Record<string, number>).prevDx ?? 1,
      );
      const newX = proj.position.x + Math.cos(facing) * proj.speed;
      const newY = proj.position.y + Math.sin(facing) * proj.speed;

      // Check if it hits any ship in its path
      let hitSomeone = false;
      for (const s of ships) {
        if (s.id === proj.sourceShipId || s.destroyed || s.routed) continue;
        const d = dist({ x: newX, y: newY }, s.position);
        if (d < hitRadius + proj.speed) {
          ships = ships.map((sh) => (sh.id === s.id ? applyDamage(sh, proj.damage) : sh));
          hitSomeone = true;
          break;
        }
      }

      // If off the battlefield, discard
      if (!hitSomeone && newX >= -50 && newX <= state.battlefieldWidth + 50 && newY >= -50 && newY <= state.battlefieldHeight + 50) {
        survivingProjectiles.push({ ...proj, position: { x: newX, y: newY } });
      }
      continue;
    }

    const d = dist(proj.position, target.position);
    if (d <= hitRadius + proj.speed) {
      // Asteroid cover: target inside asteroid gets dodge bonus
      const inAsteroid = isInsideFeature(
        target.position.x, target.position.y, newEnvironment, 'asteroid',
      );
      if (inAsteroid && Math.random() < ASTEROID_DODGE_BONUS) {
        continue; // dodged — projectile consumed but no damage
      }

      ships = ships.map((s) => {
        if (s !== target) return s;
        return applyDamage(s, proj.damage);
      });
    } else {
      const angle = angleTo(proj.position, target.position);
      const newPos = {
        x: proj.position.x + Math.cos(angle) * proj.speed,
        y: proj.position.y + Math.sin(angle) * proj.speed,
      };

      // Asteroid intercept: projectile passes through asteroid field
      const asteroidHit = segmentPassesThroughFeature(
        proj.position.x, proj.position.y,
        newPos.x, newPos.y,
        newEnvironment, 'asteroid',
      );
      if (asteroidHit != null && Math.random() < ASTEROID_INTERCEPT_CHANCE) {
        continue; // absorbed by asteroid
      }

      survivingProjectiles.push({
        ...proj,
        position: newPos,
      });
    }
  }

  // 3b. Move missiles — accelerate, track target, check hits, friendly fire
  let survivingMissiles: Missile[] = [];
  const newPdEffects: PointDefenceEffect[] = [];

  for (const missile of (state.missiles ?? [])) {
    // Burn fuel — inert missiles drift harmlessly and disappear
    const remainingFuel = (missile.fuel ?? MISSILE_FUEL_TICKS) - 1;
    if (remainingFuel <= 0) continue; // fuel exhausted, missile goes inert

    const target = ships.find((s) => s.id === missile.targetShipId && !s.destroyed);

    // If target destroyed mid-flight, retarget nearest enemy
    if (target == null) {
      const sourceSide = ships.find(s => s.id === missile.sourceShipId)?.side;
      const newTarget = ships
        .filter(s => s.side !== sourceSide && !s.destroyed && !s.routed)
        .sort((a, b) => dist({ x: missile.x, y: missile.y }, a.position) - dist({ x: missile.x, y: missile.y }, b.position))[0];
      if (newTarget) {
        const retargetSpeed = Math.min(missile.speed + missile.acceleration, missile.maxSpeed);
        survivingMissiles.push({ ...missile, targetShipId: newTarget.id, speed: retargetSpeed, fuel: remainingFuel });
      }
      continue;
    }

    // Accelerate
    const speed = Math.min(missile.speed + missile.acceleration, missile.maxSpeed);

    // Track target
    const dx = target.position.x - missile.x;
    const dy = target.position.y - missile.y;
    const d = Math.sqrt(dx * dx + dy * dy);

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
        ships[targetIdx] = applyDamage(ships[targetIdx]!, missile.damage);
      }
      // AOE splash: nearby ships take 30% damage (within 40px radius)
      const MISSILE_AOE_RADIUS = 40;
      const MISSILE_AOE_FRACTION = 0.30;
      for (let si = 0; si < ships.length; si++) {
        const s = ships[si]!;
        if (s.id === missile.targetShipId || s.id === missile.sourceShipId) continue;
        if (s.destroyed || s.routed) continue;
        const splashD = dist({ x: missile.x, y: missile.y }, s.position);
        if (splashD < MISSILE_AOE_RADIUS) {
          ships[si] = applyDamage(s, missile.damage * MISSILE_AOE_FRACTION);
        }
      }
      continue; // missile consumed
    }

    const newMX = missile.x + (dx / d) * speed;
    const newMY = missile.y + (dy / d) * speed;

    // Asteroid intercept for missiles in flight
    const asteroidHit = segmentPassesThroughFeature(
      missile.x, missile.y, newMX, newMY,
      newEnvironment, 'asteroid',
    );
    if (asteroidHit != null && Math.random() < ASTEROID_INTERCEPT_CHANCE) {
      continue; // absorbed by asteroid
    }

    survivingMissiles.push({
      ...missile,
      speed,
      x: newMX,
      y: newMY,
      fuel: remainingFuel,
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
        const d = dist(ship.position, { x: nearestMissile.x, y: nearestMissile.y });
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
        const d = dist(ship.position, { x: nearestFighter.x, y: nearestFighter.y });
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

  // 3d. Move fighters, deal strafing damage
  for (const fighter of fighters) {
    if (fighter.order === 'return') {
      // Move back to carrier
      const carrier = ships.find((s) => s.id === fighter.carrierId);
      if (!carrier || carrier.destroyed) {
        fighter.order = 'attack'; // carrier gone, keep fighting
      } else {
        const dx = carrier.position.x - fighter.x;
        const dy = carrier.position.y - fighter.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < FIGHTER_DOCK_RANGE) {
          // Docked — heal and remove from battlefield
          fighter.health = 0; // will be filtered out; ammo is not restored
          continue;
        }
        if (d > fighter.speed) {
          fighter.x += (dx / d) * fighter.speed;
          fighter.y += (dy / d) * fighter.speed;
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

    // Move toward target
    const dx = currentTarget.position.x - fighter.x;
    const dy = currentTarget.position.y - fighter.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < FIGHTER_STRAFE_RANGE) {
      // Strafing run — deal damage
      const targetIdx = ships.findIndex((s) => s.id === currentTarget.id);
      if (targetIdx >= 0) {
        ships[targetIdx] = applyDamage(ships[targetIdx]!, fighter.damage * FIGHTER_STRAFE_DAMAGE_FRACTION);
      }
    }

    if (d > fighter.speed) {
      fighter.x += (dx / d) * fighter.speed;
      fighter.y += (dy / d) * fighter.speed;
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
  const pendingBeamDamage: Array<{ targetIdx: number; damage: number }> = [];

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

      // Check range and arc — if the primary target isn't viable for
      // this weapon, look for the best alternative that IS in arc and range.
      // A target that's available is better than one that isn't.
      let weaponTarget = target;
      let weaponD = d;
      if (weaponD > weapon.range || !isInWeaponArc(ship, weaponTarget, weapon)) {
        // Find the best in-arc, in-range enemy for this weapon
        let bestAlt: TacticalShip | null = null;
        let bestAltScore = -Infinity;
        for (const enemy of ships) {
          if (enemy.side === ship.side || enemy.destroyed || enemy.routed) continue;
          const ed = dist(ship.position, enemy.position);
          if (ed > weapon.range) continue;
          if (!isInWeaponArc(ship, enemy, weapon)) continue;
          // Score: prefer closer, lower-HP targets
          const score = (weapon.range - ed) + (1 - enemy.hull / enemy.maxHull) * 20;
          if (score > bestAltScore) { bestAlt = enemy; bestAltScore = score; }
        }
        if (bestAlt == null) {
          updatedWeapons.push(weapon);
          continue;
        }
        weaponTarget = bestAlt;
        weaponD = dist(ship.position, bestAlt.position);
      }

      // Check ammo
      if (weapon.ammo !== undefined && weapon.ammo <= 0) {
        updatedWeapons.push(weapon);
        continue;
      }

      // Evasion check — moving ships are harder to hit, especially small fast ones
      // Stationary ships get no evasion bonus
      if (weapon.type !== 'fighter_bay') {
        const isMoving = weaponTarget.order.type !== 'idle' || weaponTarget.stance === 'at_ease' || weaponTarget.stance === 'evasive';
        if (isMoving) {
          const speedFactor = weaponTarget.speed / 5; // normalise to baseline speed of 5
          const sizeFactor = weaponTarget.maxHull < 60 ? 0.3 : weaponTarget.maxHull < 200 ? 0.15 : weaponTarget.maxHull < 400 ? 0.05 : 0;
          const evasionChance = Math.min(0.4, speedFactor * 0.1 + sizeFactor);
          if (Math.random() < evasionChance) {
            // Evaded — weapon missed
            updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownMax });
            continue;
          }
        }
      }

      // Accuracy roll — experience and morale affect hit chance
      // Fighter bays always launch (accuracy is per-fighter, handled elsewhere)
      if (weapon.type !== 'fighter_bay') {
        const EXP_ACCURACY: Record<CrewExperience, number> = {
          recruit: 0.80, trained: 0.90, regular: 1.0, seasoned: 1.05,
          veteran: 1.10, hardened: 1.15, elite: 1.20, ace: 1.25, legendary: 1.30,
        };
        const expAccuracyMod = EXP_ACCURACY[ship.crew.experience] ?? 1.0;
        const moraleMod = ship.crew.morale < 30 ? 0.7 : 1.0;
        const effectiveAccuracy = weapon.accuracy * expAccuracyMod * moraleMod;
        if (Math.random() * 100 > effectiveAccuracy) {
          // Miss — consume cooldown and ammo but no projectile/beam created
          const missAmmo = weapon.ammo !== undefined ? weapon.ammo - 1 : undefined;
          updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownMax, ammo: missAmmo });
          continue;
        }
      }

      // Fire!
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

        // Beams have NO splash/collateral damage — they hit their target precisely

        // Queue damage for the intended target (applied after .map() completes)
        const idx = ships.indexOf(weaponTarget);
        if (idx >= 0) {
          pendingBeamDamage.push({ targetIdx: idx, damage: beamDamage });
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
          newMissiles.push({
            id: `missile-${state.tick}-${ship.id}-${weapon.componentId}-${si}`,
            sourceShipId: ship.id,
            targetShipId: weaponTarget.id,
            componentId: weapon.componentId,
            x: ship.position.x + posOffset * Math.cos(angleOffset),
            y: ship.position.y + posOffset * Math.sin(angleOffset),
            speed: mProfile?.initSpeed ?? MISSILE_INITIAL_SPEED,
            maxSpeed: mProfile?.maxSpeed ?? MISSILE_MAX_SPEED,
            acceleration: mProfile?.accel ?? MISSILE_ACCELERATION,
            damage: perMissileDamage,
            damageType: 'explosive',
            fuel: MISSILE_FUEL_TICKS,
          });
        }
      } else {
        // Projectile
        newProjectiles.push({
          id: generateId(),
          position: { ...ship.position },
          speed: PROJECTILE_SPEED,
          damage: weapon.damage,
          sourceShipId: ship.id,
          targetShipId: weaponTarget.id,
          componentId: weapon.componentId,
        });
      }

      // Reset cooldown and decrement ammo
      updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownMax, ammo: newAmmo });
    }

    return { ...ship, weapons: updatedWeapons };
  });

  // 4b. Apply deferred beam damage (must happen AFTER .map() so changes aren't lost)
  for (const { targetIdx, damage } of pendingBeamDamage) {
    if (targetIdx >= 0 && targetIdx < ships.length) {
      ships[targetIdx] = applyDamage(ships[targetIdx]!, damage);
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

    // Fighter pilot courage — small manned craft pilots are the bravest.
    // They volunteered for this; they don't break as easily as capital ship crews.
    if (ship.maxHull < 80 && !ship.unmanned) morale += 0.25;

    // Defending home planet — crews fight harder when their world is at stake.
    if (state.layout === 'planetary_assault' && ship.side === 'defender') morale += 0.2;

    morale = Math.max(0, Math.min(100, morale));

    // Check morale thresholds — crew breaks and flees toward the map edge.
    // They are NOT routed until they physically leave the battlefield —
    // they can still be targeted and destroyed while fleeing.
    if (morale < 15 && !ship.routed && ship.stance !== 'flee') {
      if (Math.random() < 0.15) {
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
          newPods.push({
            id: generateId(),
            x: ship.position.x + (Math.random() - 0.5) * 10,
            y: ship.position.y + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            side: ship.side,
            ttl: 80 + Math.floor(Math.random() * 40),
          });
        }
      }
    }
    activePods = [...(state.escapePods ?? []), ...newPods]
      .map(pod => ({ ...pod, x: pod.x + pod.vx, y: pod.y + pod.vy, ttl: pod.ttl - 1 }))
      .filter(pod => pod.ttl > 0 &&
        pod.x > -50 && pod.x < state.battlefieldWidth + 50 &&
        pod.y > -50 && pod.y < state.battlefieldHeight + 50);
  } catch {
    // Escape pods are cosmetic — never crash the simulation
    activePods = (state.escapePods ?? [])
      .map(pod => ({ ...pod, x: pod.x + pod.vx, y: pod.y + pod.vy, ttl: pod.ttl - 1 }))
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
 * Apply raw damage to a ship through the shield -> armour -> hull pipeline.
 *
 * 1. Shields absorb damage first (point-for-point).
 * 2. Armour reduces remaining damage by 25%, but degrades by half the
 *    absorbed amount each hit.
 * 3. Hull takes the rest (minimum 1 if any damage got past shields).
 * 4. Ship is destroyed at 0 hull. Below 50% hull, a catastrophic failure
 *    roll (up to 10% chance) may destroy the ship outright.
 *
 * Exported for testing — not part of the public API contract.
 */
export function applyDamage(ship: TacticalShip, rawDamage: number): TacticalShip {
  let remaining = rawDamage;

  // 1. Shields absorb first
  let newShields = ship.shields;
  if (newShields > 0) {
    const absorbed = Math.min(newShields, remaining);
    newShields -= absorbed;
    remaining -= absorbed;
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
