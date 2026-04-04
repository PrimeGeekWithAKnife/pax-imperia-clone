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
const RANGE_TO_BATTLEFIELD = 50;
/** Fraction of max weapon range at which ships stop approaching. */
const ENGAGE_RANGE_FRACTION = 0.8;
/** Duration in ticks that a beam effect persists (visual only). */
const BEAM_EFFECT_DURATION = 3;
/** Fraction of max shields recharged per tick. */
const SHIELD_RECHARGE_FRACTION = 0.01;
/** Armour absorbs up to this fraction of remaining damage per hit. */
const ARMOUR_ABSORPTION_FRACTION = 0.25;
/** Armour degrades by this fraction of the absorbed amount per hit. */
const ARMOUR_DEGRADATION_FACTOR = 0.5;
/** Maximum catastrophic failure probability (at 0% hull). */
const CATASTROPHIC_FAILURE_MAX = 0.1;

/** Missile initial speed (pixels per tick). */
const MISSILE_INITIAL_SPEED = 2;
/** Missile maximum speed (pixels per tick). */
const MISSILE_MAX_SPEED = 12;
/** Missile acceleration (pixels per tick^2). */
const MISSILE_ACCELERATION = 0.5;
/** Hit radius for missile collision detection. */
const MISSILE_HIT_RADIUS = 12;

/** Default ammo for missile weapons. */
const MISSILE_DEFAULT_AMMO = 6;
/** Default ammo for projectile weapons. */
const PROJECTILE_DEFAULT_AMMO = 50;
/** Default ammo for point defence weapons. */
const POINT_DEFENSE_DEFAULT_AMMO = 100;

/** Per-missile-type physics and ammo profiles. */
const MISSILE_PROFILES: Record<string, { initSpeed: number; maxSpeed: number; accel: number; ammo: number; cooldown: number }> = {
  basic_missile:       { initSpeed: 4, maxSpeed: 10, accel: 1.0, ammo: 12, cooldown: 8 },   // rapid salvo
  basic_torpedo:       { initSpeed: 2, maxSpeed: 12, accel: 0.5, ammo: 6, cooldown: 25 },   // standard
  guided_torpedo:      { initSpeed: 2, maxSpeed: 14, accel: 0.6, ammo: 4, cooldown: 25 },   // precise tracker
  fusion_torpedo:      { initSpeed: 1, maxSpeed: 10, accel: 0.3, ammo: 3, cooldown: 25 },   // slow heavy
  antimatter_torpedo:  { initSpeed: 1, maxSpeed: 8, accel: 0.2, ammo: 2, cooldown: 25 },    // very slow, devastating
  singularity_torpedo: { initSpeed: 0.5, maxSpeed: 6, accel: 0.15, ammo: 1, cooldown: 25 }, // crawls then locks
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
export const DEBRIS_TICK_DAMAGE = 2;
/** Radius of debris left when a ship is destroyed. */
export const DEBRIS_RADIUS = 30;
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
  facing: number;        // radians (0 = +x direction)
  speed: number;         // pixels per tick
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

export interface TacticalState {
  tick: number;
  ships: TacticalShip[];
  projectiles: Projectile[];
  missiles: Missile[];
  fighters: Fighter[];
  beamEffects: BeamEffect[];
  pointDefenceEffects: PointDefenceEffect[];
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
function isNearSpawn(x: number, y: number): boolean {
  // Attacker spawn: around (100, 100)
  const dAtk = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
  // Defender spawn: around (BW-100, BH-100)
  const dDef = Math.sqrt(
    (x - (BATTLEFIELD_WIDTH - 100)) ** 2 + (y - (BATTLEFIELD_HEIGHT - 100)) ** 2,
  );
  return dAtk < ENVIRONMENT_SPAWN_MARGIN || dDef < ENVIRONMENT_SPAWN_MARGIN;
}

/**
 * Generate random environment features for the battlefield.
 * An optional `rng` function (returning 0..1) can be supplied for testing.
 */
export function generateEnvironment(
  rng: () => number = Math.random,
): EnvironmentFeature[] {
  const features: EnvironmentFeature[] = [];

  const asteroidCount = ASTEROID_MIN + Math.floor(rng() * (ASTEROID_MAX - ASTEROID_MIN + 1));
  for (let i = 0; i < asteroidCount; i++) {
    // Try a few placements to avoid spawn areas
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = rng() * BATTLEFIELD_WIDTH;
      const y = rng() * BATTLEFIELD_HEIGHT;
      if (isNearSpawn(x, y)) continue;
      features.push({
        id: `asteroid-${i}`,
        type: 'asteroid',
        x,
        y,
        radius: ASTEROID_RADIUS_MIN + rng() * (ASTEROID_RADIUS_MAX - ASTEROID_RADIUS_MIN),
      });
      break;
    }
  }

  const nebulaCount = NEBULA_MIN + Math.floor(rng() * (NEBULA_MAX - NEBULA_MIN + 1));
  for (let i = 0; i < nebulaCount; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = rng() * BATTLEFIELD_WIDTH;
      const y = rng() * BATTLEFIELD_HEIGHT;
      if (isNearSpawn(x, y)) continue;
      features.push({
        id: `nebula-${i}`,
        type: 'nebula',
        x,
        y,
        radius: NEBULA_RADIUS_MIN + rng() * (NEBULA_RADIUS_MAX - NEBULA_RADIUS_MIN),
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

  // Fleets start within engagement range so combat begins quickly.
  // Attackers on the left third, defenders on the right third.
  const defenderBaseX = layout === 'planetary_assault'
    ? BATTLEFIELD_WIDTH - 250
    : BATTLEFIELD_WIDTH - 120;
  const defenderBaseY = layout === 'planetary_assault'
    ? BATTLEFIELD_HEIGHT - 200
    : BATTLEFIELD_HEIGHT * 0.5;

  function buildSide(
    ships: Ship[],
    side: 'attacker' | 'defender',
  ): TacticalShip[] {
    // Ships start at opposite edges of the battlefield
    const baseX = side === 'attacker' ? 120 : defenderBaseX;
    const baseY = side === 'attacker' ? BATTLEFIELD_HEIGHT * 0.5 : defenderBaseY;
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
        facing,
        speed: extracted.speed,
        turnRate: extracted.turnRate,
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
      };
    });
  }

  const ships: TacticalShip[] = [
    ...buildSide(expandedAttackers, 'attacker'),
    ...buildSide(expandedDefenders, 'defender'),
  ];

  // Add orbital defence platforms for planetary assault
  if (layout === 'planetary_assault' && planetData) {
    const planetCX = BATTLEFIELD_WIDTH - 200;
    const planetCY = BATTLEFIELD_HEIGHT - 150;
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
        facing: angle + Math.PI, // face outward
        speed: 0,
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
    environment: generateEnvironment(),
    battlefieldWidth: BATTLEFIELD_WIDTH,
    battlefieldHeight: BATTLEFIELD_HEIGHT,
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
          });
        }
      }

      switch (comp.type) {
        case 'engine':
          speed = Math.max(speed, comp.stats['speed'] ?? 0);
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
    case 'weapon_point_defense': return 8;
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
export function findTarget(ship: TacticalShip, allShips: TacticalShip[]): TacticalShip | null {
  const enemies = allShips.filter(
    (s) => s.side !== ship.side && !s.destroyed && !s.routed,
  );
  if (enemies.length === 0) return null;

  // Prefer explicit attack target
  if (ship.order.type === 'attack') {
    const tid = ship.order.targetId;
    const preferred = enemies.find((e) => e.id === tid || e.sourceShipId === tid);
    if (preferred != null) return preferred;
  }

  // Closest enemy
  let best: TacticalShip | null = null;
  let bestDist = Infinity;
  for (const enemy of enemies) {
    const d = dist(ship.position, enemy.position);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// moveShip
// ---------------------------------------------------------------------------

/**
 * Compute the new position and facing for a single ship based on its order.
 * Returns a shallow copy with updated position/facing/routed.
 */
export function moveShip(ship: TacticalShip, state: TacticalState): TacticalShip {
  if (ship.destroyed || ship.routed) return ship;

  const updated = {
    ...ship,
    position: { ...ship.position },
  };

  switch (ship.order.type) {
    case 'idle': {
      // At ease stance: ship captain acts autonomously — find and engage enemies
      if (ship.stance === 'at_ease') {
        const target = findTarget(ship, state.ships);
        if (target != null) {
          return moveToward(updated, target.position, engageDistance(ship));
        }
      }
      // Evasive stance: move away from nearest enemy
      if (ship.stance === 'evasive') {
        const nearest = findTarget(ship, state.ships);
        if (nearest != null) {
          const d = dist(ship.position, nearest.position);
          const maxWeaponRange = ship.weapons.length > 0 ? Math.max(...ship.weapons.map(w => w.range)) : 200;
          if (d < maxWeaponRange * 1.2) {
            // Too close — move away
            const awayX = ship.position.x + (ship.position.x - nearest.position.x);
            const awayY = ship.position.y + (ship.position.y - nearest.position.y);
            return moveToward(updated, { x: awayX, y: awayY }, 0);
          }
        }
      }
      // Aggressive and defensive: hold position on idle
      return updated;
    }

    case 'attack': {
      const target = findTarget(ship, state.ships);
      if (target == null) return updated;
      return moveToward(updated, target.position, engageDistance(ship));
    }

    case 'defend': {
      // Stay near the defend target; engage enemies that get close
      const defendId = ship.order.targetId;
      const ally = state.ships.find(
        (s) => (s.id === defendId || s.sourceShipId === defendId) && !s.destroyed,
      );
      if (ally != null) {
        return moveToward(updated, ally.position, 30);
      }
      return updated;
    }

    case 'move': {
      const target = { x: ship.order.x, y: ship.order.y };
      const d = dist(updated.position, target);
      if (d <= 5) {
        // Arrived at destination — go idle (hold position)
        // Stance determines what happens next (at_ease will auto-engage)
        return { ...updated, order: { type: 'idle' } };
      }
      // Attack-move: at_ease ships engage nearby enemies along the way while
      // keeping their move order. Only divert if enemy is within detection
      // range (2x max weapon range). Once nearby enemies are dead, resume
      // course to the original destination.
      if (ship.stance === 'at_ease') {
        const enemy = findTarget(ship, state.ships);
        if (enemy != null) {
          const eDist = dist(ship.position, enemy.position);
          const detectionRange = engageDistance(ship) * 2.5;
          if (eDist < detectionRange) {
            // Divert to engage — approach to weapon range, keep move order
            return moveToward(updated, enemy.position, engageDistance(ship));
          }
        }
      }
      // Timeout: if ship has been trying to reach position for >30 ticks, give up
      // (Does not apply to at_ease — they use attack-move above)
      if (state.tick > 30 && ship.order.type === 'move') {
        const enemies = state.ships.filter(s => s.side !== ship.side && !s.destroyed && !s.routed);
        if (enemies.length > 0 && ship.stance !== 'at_ease') {
          return { ...updated, order: { type: 'idle' } };
        }
      }
      return moveToward(updated, target, 2);
    }

    case 'flee': {
      const fleeTarget = ship.side === 'attacker'
        ? { x: -50, y: -50 }
        : { x: BATTLEFIELD_WIDTH + 50, y: BATTLEFIELD_HEIGHT + 50 };
      const result = moveToward(updated, fleeTarget, 2);
      // Mark routed when off the map
      if (
        result.position.x < -20 || result.position.x > BATTLEFIELD_WIDTH + 20 ||
        result.position.y < -20 || result.position.y > BATTLEFIELD_HEIGHT + 20
      ) {
        result.routed = true;
      }
      return result;
    }
  }
}

/**
 * Turn toward a target position and move forward. Stop when within minDist.
 */
function moveToward(
  ship: TacticalShip,
  target: { x: number; y: number },
  minDist: number,
): TacticalShip {
  const d = dist(ship.position, target);
  if (d <= minDist) return ship;

  // Turn toward target
  const desiredAngle = angleTo(ship.position, target);
  const angleDiff = normaliseAngle(desiredAngle - ship.facing);
  const turnAmount = clamp(angleDiff, -ship.turnRate, ship.turnRate);
  const newFacing = normaliseAngle(ship.facing + turnAmount);

  // Move forward in facing direction
  const moveSpeed = ship.speed;
  const actualMove = Math.min(moveSpeed, d - minDist);
  const nx = ship.position.x + Math.cos(newFacing) * actualMove;
  const ny = ship.position.y + Math.sin(newFacing) * actualMove;

  return {
    ...ship,
    facing: newFacing,
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
  const newEnvironment = [...env];

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
    if (isInsideFeature(ship.position.x, ship.position.y, newEnvironment, 'debris')) {
      return applyDamage(ship, DEBRIS_TICK_DAMAGE);
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
      if (!hitSomeone && newX >= -50 && newX <= BATTLEFIELD_WIDTH + 50 && newY >= -50 && newY <= BATTLEFIELD_HEIGHT + 50) {
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
    const target = ships.find((s) => s.id === missile.targetShipId && !s.destroyed);

    // If target destroyed mid-flight, retarget nearest enemy
    if (target == null) {
      const sourceSide = ships.find(s => s.id === missile.sourceShipId)?.side;
      const newTarget = ships
        .filter(s => s.side !== sourceSide && !s.destroyed && !s.routed)
        .sort((a, b) => dist({ x: missile.x, y: missile.y }, a.position) - dist({ x: missile.x, y: missile.y }, b.position))[0];
      if (newTarget) {
        // Retarget — missile continues flying toward new target
        const retargetSpeed = Math.min(missile.speed + missile.acceleration, missile.maxSpeed);
        survivingMissiles.push({ ...missile, targetShipId: newTarget.id, speed: retargetSpeed });
      }
      // If no enemies left, missile dissipates
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

          if (Math.random() * 100 < weapon.accuracy) {
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

          if (Math.random() * 100 < weapon.accuracy * PD_VS_FIGHTER_ACCURACY_MULT) {
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
    if (ship.stance === 'defensive' && ship.damageTakenThisTick <= 0) {
      // Defensive stance: only fire when fired upon — skip if no damage taken this tick
      return { ...ship, weapons: ship.weapons.map(w => ({ ...w, cooldownLeft: Math.max(0, w.cooldownLeft - 1) })) };
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

      // Check range
      if (d > weapon.range) {
        updatedWeapons.push(weapon);
        continue;
      }

      // Check weapon arc
      if (!isInWeaponArc(ship, target, weapon)) {
        updatedWeapons.push(weapon);
        continue;
      }

      // Check ammo
      if (weapon.ammo !== undefined && weapon.ammo <= 0) {
        updatedWeapons.push(weapon);
        continue;
      }

      // Evasion check — moving ships are harder to hit, especially small fast ones
      // Stationary ships get no evasion bonus
      if (weapon.type !== 'fighter_bay') {
        const isMoving = target.order.type !== 'idle' || target.stance === 'at_ease' || target.stance === 'evasive';
        if (isMoving) {
          const speedFactor = target.speed / 5; // normalise to baseline speed of 5
          const sizeFactor = target.maxHull < 60 ? 0.3 : target.maxHull < 200 ? 0.15 : target.maxHull < 400 ? 0.05 : 0;
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
            targetId: target.id,
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
        const rangeFraction = d / weapon.range;
        if (rangeFraction > 0.6) {
          const falloff = 1.0 - (rangeFraction - 0.6) / 0.4 * 0.7; // 1.0 at 60%, 0.3 at 100%
          beamDamage *= Math.max(0.3, falloff);
        }

        // Nebula attenuation: reduce beam damage when firing through nebula
        const nebula = segmentPassesThroughFeature(
          ship.position.x, ship.position.y,
          target.position.x, target.position.y,
          newEnvironment, 'nebula',
        );
        if (nebula != null) {
          beamDamage *= NEBULA_BEAM_DAMAGE_FACTOR;
        }

        // Beams have NO splash/collateral damage — they hit their target precisely

        // Queue damage for the intended target (applied after .map() completes)
        const idx = ships.indexOf(target);
        if (idx >= 0) {
          pendingBeamDamage.push({ targetIdx: idx, damage: beamDamage });
        }
        newBeamEffects.push({
          sourceShipId: ship.id,
          targetShipId: target.id,
          damage: beamDamage,
          ticksRemaining: BEAM_EFFECT_DURATION,
          componentId: weapon.componentId,
        });
      } else if (weapon.type === 'missile') {
        // Use per-type physics from MISSILE_PROFILES; fall back to defaults
        const mProfile = MISSILE_PROFILES[weapon.componentId];
        newMissiles.push({
          id: `missile-${state.tick}-${ship.id}-${weapon.componentId}`,
          sourceShipId: ship.id,
          targetShipId: target.id,
          componentId: weapon.componentId,
          x: ship.position.x,
          y: ship.position.y,
          speed: mProfile?.initSpeed ?? MISSILE_INITIAL_SPEED,
          maxSpeed: mProfile?.maxSpeed ?? MISSILE_MAX_SPEED,
          acceleration: mProfile?.accel ?? MISSILE_ACCELERATION,
          damage: weapon.damage,
          damageType: 'explosive',
        });
      } else {
        // Projectile
        newProjectiles.push({
          id: generateId(),
          position: { ...ship.position },
          speed: PROJECTILE_SPEED,
          damage: weapon.damage,
          sourceShipId: ship.id,
          targetShipId: target.id,
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
      newEnvironment.push({
        id: `debris-${ship.id}`,
        type: 'debris',
        x: ship.position.x,
        y: ship.position.y,
        radius: DEBRIS_RADIUS,
      });

      // Allied ships suffer morale drop when a comrade is destroyed
      ships = ships.map((s) => {
        if (s.side === ship.side && s.id !== ship.id && !s.destroyed) {
          return {
            ...s,
            crew: { ...s.crew, morale: Math.max(0, s.crew.morale - 5) },
          };
        }
        return s;
      });
    }
  }

  // 5b. Crew morale tick — fatigue, outnumbered, low hull, experience resilience
  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;
    let morale = ship.crew.morale;

    // Prolonged combat fatigue: -0.1 per tick after tick 200
    // (battles should be decided by combat, not by waiting)
    if (state.tick > 200) morale -= 0.1;

    // Outnumbered penalty: -0.5 per tick if enemy has 2x more ships
    const allies = ships.filter(
      (s) => s.side === ship.side && !s.destroyed && !s.routed,
    ).length;
    const enemies = ships.filter(
      (s) => s.side !== ship.side && !s.destroyed && !s.routed,
    ).length;
    if (enemies > allies * 2) morale -= 0.5;

    // Low hull penalty
    if (ship.hull < ship.maxHull * 0.3) morale -= 0.3;

    // Experience resilience bonus (partially offsets losses)
    const EXP_RESILIENCE: Record<CrewExperience, number> = {
      recruit: 0, trained: 0.02, regular: 0.05, seasoned: 0.08, veteran: 0.10,
      hardened: 0.13, elite: 0.15, ace: 0.18, legendary: 0.20,
    };
    const resilienceBonus = EXP_RESILIENCE[ship.crew.experience] ?? 0;
    morale += resilienceBonus;

    morale = Math.max(0, Math.min(100, morale));

    // Check morale thresholds — crew may flee or surrender
    if (morale < 15 && !ship.routed) {
      if (Math.random() < 0.15) {
        return {
          ...ship,
          routed: true,
          order: { type: 'flee' as const },
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
    outcome = 'attacker_wins'; // draw goes to attacker
  } else if (attackersAlive.length === 0) {
    outcome = 'defender_wins';
  } else if (defendersAlive.length === 0) {
    outcome = 'attacker_wins';
  }

  return {
    tick: state.tick + 1,
    ships,
    projectiles: [...survivingProjectiles, ...newProjectiles],
    missiles: [...survivingMissiles, ...newMissiles],
    fighters: [...fighters, ...newFighters],
    beamEffects: [...beamEffects, ...newBeamEffects],
    pointDefenceEffects: [...pointDefenceEffects, ...newPdEffects],
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
