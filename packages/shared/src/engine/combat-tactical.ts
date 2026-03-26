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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeaponType =
  | 'beam'
  | 'projectile'
  | 'missile'
  | 'point_defense'
  | 'fighter_bay';

export interface TacticalWeapon {
  componentId: string;
  type: WeaponType;
  damage: number;
  range: number;        // battlefield units
  accuracy: number;     // 0-100
  cooldownMax: number;  // ticks between shots
  cooldownLeft: number; // ticks until next shot
  facing: number;       // radians, relative to ship facing (0 = forward)
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

export interface BeamEffect {
  sourceShipId: string;
  targetShipId: string;
  damage: number;
  ticksRemaining: number;
}

export interface TacticalState {
  tick: number;
  ships: TacticalShip[];
  projectiles: Projectile[];
  beamEffects: BeamEffect[];
  battlefieldWidth: number;
  battlefieldHeight: number;
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
    beamEffects: [],
    battlefieldWidth: BATTLEFIELD_WIDTH,
    battlefieldHeight: BATTLEFIELD_HEIGHT,
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
        weapons.push({
          componentId: comp.id,
          type: weaponType,
          damage: dmg,
          range: (comp.stats['range'] ?? 3) * RANGE_TO_BATTLEFIELD,
          accuracy: comp.stats['accuracy'] ?? 75,
          cooldownMax: computeCooldown(comp),
          cooldownLeft: 0,
          facing: 0, // forward-facing by default
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
// processTacticalTick
// ---------------------------------------------------------------------------

/**
 * Advance the tactical combat by one tick. Returns a new TacticalState.
 *
 * Steps:
 *  1. Decay beam effects (reduce ticksRemaining, remove expired)
 *  2. Move ships toward their targets based on orders
 *  3. Move projectiles toward their targets (consume on hit)
 *  4. Fire weapons (check cooldown, range, create beams/projectiles)
 *  5. Return new state
 */
export function processTacticalTick(state: TacticalState): TacticalState {
  // 1. Decay beam effects
  const beamEffects = state.beamEffects
    .map((b) => ({ ...b, ticksRemaining: b.ticksRemaining - 1 }))
    .filter((b) => b.ticksRemaining > 0);

  // 2. Move ships
  let ships = state.ships.map((ship) => moveShip(ship, state));

  // 3. Move projectiles and check for hits
  const hitRadius = 12;
  const survivingProjectiles: Projectile[] = [];

  for (const proj of state.projectiles) {
    const target = ships.find((s) => s.id === proj.targetShipId || s.sourceShipId === proj.targetShipId);
    if (target == null || target.destroyed || target.routed) {
      // Target gone — projectile dissipates
      continue;
    }

    // Move toward target
    const d = dist(proj.position, target.position);
    if (d <= hitRadius + proj.speed) {
      // Hit! Apply damage
      ships = ships.map((s) => {
        if (s !== target) return s;
        return applyDamage(s, proj.damage);
      });
    } else {
      // Advance projectile
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

  // 4. Fire weapons
  const newProjectiles: Projectile[] = [];
  const newBeamEffects: BeamEffect[] = [];

  ships = ships.map((ship) => {
    if (ship.destroyed || ship.routed) return ship;

    const target = findTarget(ship, ships);
    if (target == null) {
      // Tick down cooldowns even without targets
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
      if (weapon.cooldownLeft > 0) {
        updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownLeft - 1 });
        continue;
      }

      // Check range
      if (d > weapon.range) {
        updatedWeapons.push(weapon);
        continue;
      }

      // Fire!
      if (weapon.type === 'beam' || weapon.type === 'point_defense') {
        // Instant hit — apply damage now, create visual beam effect
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
      } else {
        // Projectile/missile/fighter — create a projectile
        newProjectiles.push({
          id: generateId(),
          position: { ...ship.position },
          speed: PROJECTILE_SPEED,
          damage: weapon.damage,
          sourceShipId: ship.id,
          targetShipId: target.id,
        });
      }

      // Reset cooldown
      updatedWeapons.push({ ...weapon, cooldownLeft: weapon.cooldownMax });
    }

    return { ...ship, weapons: updatedWeapons };
  });

  return {
    tick: state.tick + 1,
    ships,
    projectiles: [...survivingProjectiles, ...newProjectiles],
    beamEffects: [...beamEffects, ...newBeamEffects],
    battlefieldWidth: state.battlefieldWidth,
    battlefieldHeight: state.battlefieldHeight,
  };
}

// ---------------------------------------------------------------------------
// Damage application
// ---------------------------------------------------------------------------

/**
 * Apply raw damage to a ship, reducing shields first, then hull.
 * Armour reduces hull damage by a flat percentage (25%).
 */
function applyDamage(ship: TacticalShip, rawDamage: number): TacticalShip {
  let remaining = rawDamage;

  // Shields absorb first
  let newShields = ship.shields;
  if (newShields > 0) {
    const absorbed = Math.min(newShields, remaining);
    newShields -= absorbed;
    remaining -= absorbed;
  }

  // Armour reduces remaining damage
  if (remaining > 0 && ship.armour > 0) {
    const reduction = Math.min(ship.armour * 0.25, remaining * 0.5);
    remaining = Math.max(1, remaining - reduction);
  }

  // Hull damage
  const newHull = Math.max(0, ship.hull - remaining);
  const destroyed = newHull <= 0;

  return {
    ...ship,
    shields: newShields,
    hull: newHull,
    destroyed,
    position: { ...ship.position },
    weapons: ship.weapons.map((w) => ({ ...w })),
  };
}
