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

import type { Fleet, Ship, ShipDesign, ShipComponent, ComponentType } from '../types/ships.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BATTLEFIELD_WIDTH = 1600;
export const BATTLEFIELD_HEIGHT = 1000;
export const PROJECTILE_SPEED = 8;

/** Default speed for ships without an engine component. */
const DEFAULT_SPEED = 1.5;
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
const SHIELD_RECHARGE_FRACTION = 0.05;
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

/** Duration in ticks that a point defence effect persists (visual only). */
const PD_EFFECT_DURATION = 2;

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
  destroyed: boolean;
  routed: boolean;
}

export interface Projectile {
  id: string;
  position: { x: number; y: number };
  speed: number;
  damage: number;
  sourceShipId: string;
  targetShipId: string;
}

export interface Missile {
  id: string;
  sourceShipId: string;
  targetShipId: string;
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

export interface BeamEffect {
  sourceShipId: string;
  targetShipId: string;
  damage: number;
  ticksRemaining: number;
}

export type TacticalOutcome = 'attacker_wins' | 'defender_wins' | null;

export type FormationType = 'line' | 'spearhead' | 'diamond' | 'wings';

export interface FormationPosition {
  offsetX: number;
  offsetY: number;
}

export interface TacticalState {
  tick: number;
  ships: TacticalShip[];
  projectiles: Projectile[];
  missiles: Missile[];
  beamEffects: BeamEffect[];
  pointDefenceEffects: PointDefenceEffect[];
  battlefieldWidth: number;
  battlefieldHeight: number;
  outcome: TacticalOutcome;
  attackerFormation: FormationType;
  defenderFormation: FormationType;
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
 */
export function setFormation(
  state: TacticalState,
  side: 'attacker' | 'defender',
  formation: FormationType,
): TacticalState {
  const sideShips = state.ships.filter(
    (s) => s.side === side && !s.destroyed && !s.routed,
  );
  const centreX = side === 'attacker' ? 200 : state.battlefieldWidth - 200;
  const centreY = state.battlefieldHeight / 2;
  const positions = getFormationPositions(formation, sideShips.length);

  const sideShipIds = new Set(sideShips.map((s) => s.id));
  let sideIdx = 0;

  const updatedShips = state.ships.map((s) => {
    if (!sideShipIds.has(s.id)) return s;
    const pos = positions[sideIdx] ?? { offsetX: 0, offsetY: 0 };
    sideIdx++;
    const targetX = centreX + pos.offsetX;
    const targetY = centreY + pos.offsetY;
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
): TacticalState {
  const componentById = new Map(components.map((c) => [c.id, c]));

  function buildSide(
    ships: Ship[],
    side: 'attacker' | 'defender',
  ): TacticalShip[] {
    const baseX = side === 'attacker' ? 100 : BATTLEFIELD_WIDTH - 100;
    const baseY = side === 'attacker' ? 100 : BATTLEFIELD_HEIGHT - 100;
    const facing = side === 'attacker' ? 0 : Math.PI;

    return ships.map((ship, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = baseX + col * 60;
      const y = baseY + row * 60;

      const design = designs.get(ship.designId);
      const extracted = extractShipStats(design, componentById);

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
        destroyed: false,
        routed: false,
      };
    });
  }

  return {
    tick: 0,
    ships: [...buildSide(attackerShips, 'attacker'), ...buildSide(defenderShips, 'defender')],
    projectiles: [],
    missiles: [],
    beamEffects: [],
    pointDefenceEffects: [],
    battlefieldWidth: BATTLEFIELD_WIDTH,
    battlefieldHeight: BATTLEFIELD_HEIGHT,
    outcome: null,
    attackerFormation: 'line',
    defenderFormation: 'line',
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
}

/**
 * Extract tactical stats from a ShipDesign + components lookup.
 */
function extractShipStats(
  design: ShipDesign | undefined,
  componentById: Map<string, ShipComponent>,
): ExtractedStats {
  const weapons: TacticalWeapon[] = [];
  let speed = 0;
  let maxShields = 0;
  let armour = 0;
  let sensorRange = 0;

  if (design != null) {
    for (const assignment of design.components) {
      const comp = componentById.get(assignment.componentId);
      if (comp == null) continue;

      const weaponType = mapComponentType(comp.type);
      if (weaponType != null) {
        const dmg = comp.type === 'fighter_bay'
          ? (comp.stats['fighterCount'] ?? 0) * (comp.stats['damage'] ?? 0)
          : (comp.stats['damage'] ?? 0);
        const ammo = computeAmmo(weaponType);
        weapons.push({
          componentId: comp.id,
          type: weaponType,
          damage: dmg,
          range: (comp.stats['range'] ?? 3) * RANGE_TO_BATTLEFIELD,
          accuracy: comp.stats['accuracy'] ?? 75,
          cooldownMax: computeCooldown(comp),
          cooldownLeft: 0,
          facing: defaultWeaponFacing(comp.type),
          ammo,
          maxAmmo: ammo,
        });
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
          sensorRange = Math.max(sensorRange, (comp.stats['sensorRange'] ?? 0) * RANGE_TO_BATTLEFIELD);
          break;
        default:
          break;
      }
    }
  }

  return {
    speed: speed > 0 ? speed : DEFAULT_SPEED,
    turnRate: DEFAULT_TURN_RATE,
    maxShields,
    armour,
    sensorRange: sensorRange > 0 ? sensorRange : DEFAULT_SENSOR_RANGE,
    weapons,
  };
}

/**
 * Compute cooldown in ticks from component stats.
 * Beams fire faster, projectiles/missiles slower.
 */
function computeCooldown(comp: ShipComponent): number {
  switch (comp.type) {
    case 'weapon_beam': return 10;
    case 'weapon_projectile': return 15;
    case 'weapon_missile': return 25;
    case 'weapon_point_defense': return 8;
    case 'fighter_bay': return 30;
    default: return 15;
  }
}

/**
 * Compute starting ammo for a weapon type.
 * Beams are energy-based (unlimited), everything else has finite ammo.
 */
function computeAmmo(weaponType: WeaponType): number | undefined {
  switch (weaponType) {
    case 'missile': return MISSILE_DEFAULT_AMMO;
    case 'projectile': return PROJECTILE_DEFAULT_AMMO;
    case 'point_defense': return POINT_DEFENSE_DEFAULT_AMMO;
    case 'beam': return undefined; // unlimited
    case 'fighter_bay': return undefined; // fighters, not ammo-based
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
    case 'idle':
      return updated;

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
  const maxRange = Math.max(...ship.weapons.map((w) => w.range));
  return maxRange * ENGAGE_RANGE_FRACTION;
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
 *  3c. Point defence intercepts missiles
 *  4. Fire weapons (check cooldown, range, ammo; create beams/projectiles/missiles)
 *  5. Return new state
 */
export function processTacticalTick(state: TacticalState): TacticalState {
  // 0. Early return if already resolved
  if (state.outcome !== null) return state;

  // 1. Decay beam effects
  const beamEffects = state.beamEffects
    .map((b) => ({ ...b, ticksRemaining: b.ticksRemaining - 1 }))
    .filter((b) => b.ticksRemaining > 0);

  // 1b. Decay point defence effects
  const pointDefenceEffects = (state.pointDefenceEffects ?? [])
    .map((e) => ({ ...e, ticksRemaining: e.ticksRemaining - 1 }))
    .filter((e) => e.ticksRemaining > 0);

  // 1c. Shield recharge for all active ships
  let ships = state.ships.map((ship) => {
    if (ship.destroyed || ship.routed || ship.maxShields <= 0) return ship;
    const recharged = Math.min(
      ship.maxShields,
      ship.shields + ship.maxShields * SHIELD_RECHARGE_FRACTION,
    );
    return recharged !== ship.shields ? { ...ship, shields: recharged } : ship;
  });

  // 2. Move ships
  ships = ships.map((ship) => moveShip(ship, state));

  // 3. Move projectiles and check for hits
  const hitRadius = 12;
  const survivingProjectiles: Projectile[] = [];

  for (const proj of state.projectiles) {
    const target = ships.find((s) => s.id === proj.targetShipId || s.sourceShipId === proj.targetShipId);
    if (target == null || target.destroyed || target.routed) {
      continue;
    }

    const d = dist(proj.position, target.position);
    if (d <= hitRadius + proj.speed) {
      ships = ships.map((s) => {
        if (s !== target) return s;
        return applyDamage(s, proj.damage);
      });
    } else {
      const angle = angleTo(proj.position, target.position);
      survivingProjectiles.push({
        ...proj,
        position: {
          x: proj.position.x + Math.cos(angle) * proj.speed,
          y: proj.position.y + Math.sin(angle) * proj.speed,
        },
      });
    }
  }

  // 3b. Move missiles — accelerate, track target, check hits
  let survivingMissiles: Missile[] = [];
  const newPdEffects: PointDefenceEffect[] = [];

  for (const missile of (state.missiles ?? [])) {
    const target = ships.find((s) => s.id === missile.targetShipId && !s.destroyed);
    if (target == null) continue; // missile lost target, dissipates

    // Accelerate
    const speed = Math.min(missile.speed + missile.acceleration, missile.maxSpeed);

    // Track target
    const dx = target.position.x - missile.x;
    const dy = target.position.y - missile.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < MISSILE_HIT_RADIUS + speed) {
      // Hit!
      const targetIdx = ships.findIndex((s) => s.id === missile.targetShipId);
      if (targetIdx >= 0) {
        ships[targetIdx] = applyDamage(ships[targetIdx]!, missile.damage);
      }
      continue; // missile consumed
    }

    survivingMissiles.push({
      ...missile,
      speed,
      x: missile.x + (dx / d) * speed,
      y: missile.y + (dy / d) * speed,
    });
  }

  // 3c. Point defence intercepts missiles
  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;

    let weaponsChanged = false;
    const updatedWeapons = ship.weapons.map((weapon) => {
      if (weapon.type !== 'point_defense') return weapon;
      if (weapon.cooldownLeft > 0) return weapon;
      if (weapon.ammo !== undefined && weapon.ammo <= 0) return weapon;

      const nearestMissile = findNearestMissile(ship, survivingMissiles, ships);
      if (nearestMissile == null) return weapon;

      const d = dist(ship.position, { x: nearestMissile.x, y: nearestMissile.y });
      if (d > weapon.range) return weapon;

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
    });

    return weaponsChanged ? { ...ship, weapons: updatedWeapons } : ship;
  });

  // 4. Fire weapons
  const newProjectiles: Projectile[] = [];
  const newBeamEffects: BeamEffect[] = [];
  const newMissiles: Missile[] = [];

  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;

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

      // Fire!
      const newAmmo = weapon.ammo !== undefined ? weapon.ammo - 1 : undefined;

      if (weapon.type === 'beam') {
        const idx = ships.indexOf(target);
        if (idx >= 0) {
          ships[idx] = applyDamage(ships[idx], weapon.damage);
        }
        newBeamEffects.push({
          sourceShipId: ship.id,
          targetShipId: target.id,
          damage: weapon.damage,
          ticksRemaining: BEAM_EFFECT_DURATION,
        });
      } else if (weapon.type === 'missile') {
        newMissiles.push({
          id: `missile-${state.tick}-${ship.id}-${weapon.componentId}`,
          sourceShipId: ship.id,
          targetShipId: target.id,
          x: ship.position.x,
          y: ship.position.y,
          speed: MISSILE_INITIAL_SPEED,
          maxSpeed: MISSILE_MAX_SPEED,
          acceleration: MISSILE_ACCELERATION,
          damage: weapon.damage,
          damageType: 'explosive',
        });
      } else {
        // Projectile/fighter
        newProjectiles.push({
          id: generateId(),
          position: { ...ship.position },
          speed: PROJECTILE_SPEED,
          damage: weapon.damage,
          sourceShipId: ship.id,
          targetShipId: target.id,
        });
      }

      // Reset cooldown and decrement ammo
      updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownMax, ammo: newAmmo });
    }

    return { ...ship, weapons: updatedWeapons };
  });

  // 5. Combat end detection
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
    beamEffects: [...beamEffects, ...newBeamEffects],
    pointDefenceEffects: [...pointDefenceEffects, ...newPdEffects],
    battlefieldWidth: state.battlefieldWidth,
    battlefieldHeight: state.battlefieldHeight,
    outcome,
    attackerFormation: state.attackerFormation,
    defenderFormation: state.defenderFormation,
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
    position: { ...ship.position },
    weapons: ship.weapons.map((w) => ({ ...w })),
  };
}
