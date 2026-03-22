/**
 * Combat resolution engine — pure functions for resolving space battles.
 *
 * All functions are side-effect free. Each tick returns a new CombatState
 * rather than mutating the existing one. Callers are responsible for
 * persisting any resulting Ship mutations.
 *
 * Design goals:
 *  - Pure / immutable-per-tick: processCombatTick returns a new state object
 *  - System damage on ships (engines, weapons, shields, sensors, warpDrive)
 *  - Shield pool that absorbs before hull damage; recharged each tick
 *  - Armor partially reduces damage after shields
 *  - Morale and routing mechanics
 *  - Auto-resolve for quick resolution of minor engagements
 *  - calculateFleetPower for AI threat assessment
 */

import type { Fleet, Ship, ShipDesign, ShipComponent, SystemDamage } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CombatSetup {
  attackerFleet: Fleet;
  defenderFleet: Fleet;
  attackerShips: Ship[];
  defenderShips: Ship[];
  attackerDesigns: Map<string, ShipDesign>;
  defenderDesigns: Map<string, ShipDesign>;
}

export interface CombatState {
  tick: number;
  attackerShips: CombatShip[];
  defenderShips: CombatShip[];
  events: CombatEvent[];
  outcome: CombatOutcome | null;
}

export interface CombatShip {
  ship: Ship;
  designId: string;
  side: 'attacker' | 'defender';
  morale: number;       // 0–100; ship routes when it drops below MORALE_ROUTE_THRESHOLD
  isRouted: boolean;
  isDestroyed: boolean;
  /** Current shield pool. Recharged slightly each tick. */
  currentShields: number;
  /** Max shield capacity derived from design stats, adjusted for system damage. */
  maxShields: number;
  /** Position on the 2-D tactical field (arbitrary units). */
  position: { x: number; y: number };
  /** Ship heading in radians (0 = facing +x direction). */
  facing: number;
}

export type CombatEvent =
  | { type: 'weapon_fired'; sourceId: string; targetId: string; damage: number; weapon: string }
  | { type: 'shield_absorbed'; shipId: string; amount: number }
  | { type: 'hull_damage'; shipId: string; amount: number; remaining: number }
  | { type: 'system_damaged'; shipId: string; system: keyof SystemDamage; newLevel: number }
  | { type: 'ship_destroyed'; shipId: string; name: string }
  | { type: 'ship_routed'; shipId: string }
  | { type: 'combat_end'; outcome: CombatOutcome };

export interface CombatOutcome {
  winner: 'attacker' | 'defender' | 'draw';
  attackerLosses: string[];   // destroyed ship IDs
  defenderLosses: string[];
  attackerRouted: string[];   // routed ship IDs
  defenderRouted: string[];
  ticksElapsed: number;
}

// ---------------------------------------------------------------------------
// Internal stat summary (mirrors DesignStats without needing a HullTemplate)
// ---------------------------------------------------------------------------

interface CombatStats {
  totalDamage: number;
  totalShields: number;
  totalArmor: number;
  repairRate: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TICKS = 100;
const MORALE_ROUTE_THRESHOLD = 20;
const MORALE_FRIENDLY_LOSS = -10;
const MORALE_HULL_HIT = -5;
const MORALE_OUTNUMBERED_PER_TICK = -2;
/** Fraction of max shields recharged per tick. */
const SHIELD_RECHARGE_FRACTION = 0.05;
/** Fraction of system-damage that reduces weapon/shield output. */
const SYSTEM_DAMAGE_REDUCTION = 0.8;
const SYSTEM_HIT_CHANCE = 0.1;
const SYSTEM_DAMAGE_PER_HIT_MIN = 0.1;
const SYSTEM_DAMAGE_PER_HIT_MAX = 0.3;
/** Armor absorbs up to this fraction of remaining damage per hit. */
const ARMOR_ABSORPTION_FRACTION = 0.25;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Return all active (not destroyed, not routed) ships from a list. */
function activeShips(ships: CombatShip[]): CombatShip[] {
  return ships.filter((s) => !s.isDestroyed && !s.isRouted);
}

function euclideanDist(a: CombatShip, b: CombatShip): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Shallow copy a CombatShip, deep-copying the nested Ship and SystemDamage. */
function copyCombatShip(cs: CombatShip): CombatShip {
  return {
    ...cs,
    ship: {
      ...cs.ship,
      systemDamage: { ...cs.ship.systemDamage },
    },
    position: { ...cs.position },
  };
}

// ---------------------------------------------------------------------------
// Combat stats derivation (no HullTemplate needed at combat time)
// ---------------------------------------------------------------------------

/**
 * Aggregate component stats for combat purposes.
 * Mirrors calculateDesignStats from ship-design.ts but without HullTemplate.
 */
function deriveDesignStats(
  design: ShipDesign,
  componentById: Map<string, ShipComponent>,
): CombatStats {
  let totalDamage = 0;
  let totalShields = 0;
  let totalArmor = 0;
  let repairRate = 0;

  for (const assignment of design.components) {
    const c = componentById.get(assignment.componentId);
    if (c == null) continue;

    switch (c.type) {
      case 'weapon_beam':
      case 'weapon_projectile':
      case 'weapon_missile':
      case 'weapon_point_defense':
        totalDamage += c.stats['damage'] ?? 0;
        break;

      case 'fighter_bay':
        totalDamage += (c.stats['fighterCount'] ?? 0) * (c.stats['damage'] ?? 0);
        break;

      case 'shield':
        totalShields += c.stats['shieldStrength'] ?? 0;
        break;

      case 'armor':
        totalArmor += c.stats['armorRating'] ?? 0;
        break;

      case 'repair_drone':
        repairRate += c.stats['repairRate'] ?? 0;
        break;

      default:
        break;
    }
  }

  return { totalDamage, totalShields, totalArmor, repairRate };
}

/** Effective weapon damage output accounting for weapons system damage. */
function effectiveWeaponDamage(stats: CombatStats, systemDamage: SystemDamage): number {
  const reduction = clamp(systemDamage.weapons, 0, 1);
  return Math.max(0, stats.totalDamage * (1 - reduction * SYSTEM_DAMAGE_REDUCTION));
}

/** Effective max shield pool accounting for shields system damage. */
function effectiveMaxShields(stats: CombatStats, systemDamage: SystemDamage): number {
  const reduction = clamp(systemDamage.shields, 0, 1);
  return Math.max(0, stats.totalShields * (1 - reduction * SYSTEM_DAMAGE_REDUCTION));
}

/** Return the name of the first weapon-type component found in the design. */
function firstWeaponName(
  design: ShipDesign,
  componentById: Map<string, ShipComponent>,
): string {
  const weaponTypes = new Set([
    'weapon_beam',
    'weapon_projectile',
    'weapon_missile',
    'weapon_point_defense',
    'fighter_bay',
  ]);
  for (const assignment of design.components) {
    const c = componentById.get(assignment.componentId);
    if (c != null && weaponTypes.has(c.type)) return c.name;
  }
  return 'weapons';
}

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

/**
 * Pick the best enemy target for the given attacker.
 *
 * Priority function:
 *   score = 0.6 * proximity + 0.3 * damageRatio + 0.1 * rng()
 *
 * This means the closest, most-damaged enemy is preferred with a small
 * random jitter to prevent perfectly identical targeting every tick.
 */
function selectTarget(
  attacker: CombatShip,
  enemies: CombatShip[],
  rng: () => number,
): CombatShip | null {
  const candidates = activeShips(enemies);
  if (candidates.length === 0) return null;

  let bestScore = -Infinity;
  let best: CombatShip | null = null;

  for (const enemy of candidates) {
    const dist = euclideanDist(attacker, enemy);
    const proximityScore = 1 / (1 + dist);
    const damageRatio =
      enemy.ship.maxHullPoints > 0
        ? 1 - enemy.ship.hullPoints / enemy.ship.maxHullPoints
        : 0;
    const score = proximityScore * 0.6 + damageRatio * 0.3 + rng() * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = enemy;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Victory check
// ---------------------------------------------------------------------------

function buildOutcome(
  winner: CombatOutcome['winner'],
  attackers: CombatShip[],
  defenders: CombatShip[],
  tick: number,
): CombatOutcome {
  return {
    winner,
    attackerLosses: attackers.filter((s) => s.isDestroyed).map((s) => s.ship.id),
    defenderLosses: defenders.filter((s) => s.isDestroyed).map((s) => s.ship.id),
    attackerRouted: attackers.filter((s) => s.isRouted).map((s) => s.ship.id),
    defenderRouted: defenders.filter((s) => s.isRouted).map((s) => s.ship.id),
    ticksElapsed: tick,
  };
}

/**
 * Check end-of-combat conditions.
 * Returns an outcome if combat should end, or null to continue.
 */
function checkVictory(
  attackers: CombatShip[],
  defenders: CombatShip[],
  tick: number,
): CombatOutcome | null {
  const aActive = activeShips(attackers).length;
  const dActive = activeShips(defenders).length;

  if (aActive === 0 && dActive === 0) return buildOutcome('draw', attackers, defenders, tick);
  if (aActive === 0) return buildOutcome('defender', attackers, defenders, tick);
  if (dActive === 0) return buildOutcome('attacker', attackers, defenders, tick);

  return null;
}

// ---------------------------------------------------------------------------
// initializeCombat
// ---------------------------------------------------------------------------

/**
 * Build the initial CombatState from a CombatSetup.
 *
 * - Attackers start on the left (x ≈ -40), defenders on the right (x ≈ +40).
 * - Ships are spread vertically to avoid stacking.
 * - All ships start with morale = 100, shields at full capacity.
 * - Attackers face right (facing = 0), defenders face left (facing = π).
 */
export function initializeCombat(
  setup: CombatSetup,
  allComponents: ShipComponent[],
): CombatState {
  const componentById = new Map(allComponents.map((c) => [c.id, c]));

  function buildSide(
    ships: Ship[],
    designs: Map<string, ShipDesign>,
    side: 'attacker' | 'defender',
  ): CombatShip[] {
    const xBase = side === 'attacker' ? -40 : 40;
    const facing = side === 'attacker' ? 0 : Math.PI;

    return ships.map((ship, index) => {
      const design = designs.get(ship.designId);
      const stats =
        design != null ? deriveDesignStats(design, componentById) : { totalDamage: 0, totalShields: 0, totalArmor: 0, repairRate: 0 };

      const maxShields = effectiveMaxShields(stats, ship.systemDamage);

      // Spread ships vertically: centred around y = 0
      const yOffset = (index - (ships.length - 1) / 2) * 12;

      return {
        ship: { ...ship, systemDamage: { ...ship.systemDamage } },
        designId: ship.designId,
        side,
        morale: 100,
        isRouted: false,
        isDestroyed: false,
        currentShields: maxShields,
        maxShields,
        position: { x: xBase, y: yOffset },
        facing,
      };
    });
  }

  return {
    tick: 0,
    attackerShips: buildSide(setup.attackerShips, setup.attackerDesigns, 'attacker'),
    defenderShips: buildSide(setup.defenderShips, setup.defenderDesigns, 'defender'),
    events: [],
    outcome: null,
  };
}

// ---------------------------------------------------------------------------
// processCombatTick
// ---------------------------------------------------------------------------

/**
 * Advance the combat by one tick. Returns a new CombatState.
 *
 * Steps per tick:
 *  1. Early return if already resolved.
 *  2. Recharge shields for all active ships.
 *  3. Weapon fire phase (both sides fire simultaneously).
 *     a. Each active ship selects the best target.
 *     b. Effective damage is computed (reduced by weapons system damage).
 *     c. Shields absorb first; armour partially absorbs remainder; hull hit.
 *     d. 10 % chance per hit of damaging a random system (+0.1–0.3).
 *     e. Ship is marked destroyed when hullPoints reaches 0.
 *  4. Morale updates (friendly loss penalty, outnumbered penalty).
 *  5. Routing: ships below morale threshold are marked routed.
 *  6. Victory check.
 *
 * The allComponents and designMaps parameters supply the design data needed to
 * compute effective damage and shield values.
 */
export function processCombatTick(
  state: CombatState,
  allComponents: ShipComponent[],
  attackerDesigns: Map<string, ShipDesign>,
  defenderDesigns: Map<string, ShipDesign>,
): CombatState {
  if (state.outcome !== null) return state;

  const rng = (): number => Math.random();
  const componentById = new Map(allComponents.map((c) => [c.id, c]));
  const events: CombatEvent[] = [];

  // Work on mutable copies of the ship arrays for this tick.
  const attackers: CombatShip[] = state.attackerShips.map(copyCombatShip);
  const defenders: CombatShip[] = state.defenderShips.map(copyCombatShip);

  // Combined design lookup.
  function getDesign(cs: CombatShip): ShipDesign | undefined {
    const map = cs.side === 'attacker' ? attackerDesigns : defenderDesigns;
    return map.get(cs.designId);
  }

  // -------------------------------------------------------------------------
  // Step 2: Shield recharge
  // -------------------------------------------------------------------------
  for (const cs of [...attackers, ...defenders]) {
    if (cs.isDestroyed || cs.isRouted) continue;
    const design = getDesign(cs);
    const stats = design != null ? deriveDesignStats(design, componentById) : { totalDamage: 0, totalShields: 0, totalArmor: 0, repairRate: 0 };
    const maxSh = effectiveMaxShields(stats, cs.ship.systemDamage);
    cs.maxShields = maxSh;
    cs.currentShields = Math.min(maxSh, cs.currentShields + maxSh * SHIELD_RECHARGE_FRACTION);
  }

  // -------------------------------------------------------------------------
  // Step 3: Weapon fire (both sides calculated against the SAME target state,
  // then damage is applied — avoids first-mover advantage within a single tick)
  // -------------------------------------------------------------------------
  const systemKeys: ReadonlyArray<keyof SystemDamage> = [
    'engines',
    'weapons',
    'shields',
    'sensors',
    'warpDrive',
  ];

  // Collect damage orders: { target CombatShip ref, rawDamage, weaponName, sourceId }
  interface DamageOrder {
    source: CombatShip;
    target: CombatShip;
    damage: number;
    weapon: string;
  }

  const damageOrders: DamageOrder[] = [];

  function collectFireOrders(firingShips: CombatShip[], enemyShips: CombatShip[]): void {
    for (const shooter of firingShips) {
      if (shooter.isDestroyed || shooter.isRouted) continue;
      const design = getDesign(shooter);
      if (design == null) continue;
      const stats = deriveDesignStats(design, componentById);
      const damage = effectiveWeaponDamage(stats, shooter.ship.systemDamage);
      if (damage <= 0) continue;
      const target = selectTarget(shooter, enemyShips, rng);
      if (target == null) continue;
      const weapon = firstWeaponName(design, componentById);
      damageOrders.push({ source: shooter, target, damage, weapon });
    }
  }

  collectFireOrders(attackers, defenders);
  collectFireOrders(defenders, attackers);

  // Now apply all damage orders.
  const destroyedThisTick = new Set<string>();

  for (const order of damageOrders) {
    const { source, target, damage, weapon } = order;

    // Target may have been destroyed earlier this same tick; skip it.
    if (target.isDestroyed) continue;

    events.push({
      type: 'weapon_fired',
      sourceId: source.ship.id,
      targetId: target.ship.id,
      damage,
      weapon,
    });

    let remaining = damage;

    // Shields absorb first.
    if (target.currentShields > 0) {
      const absorbed = Math.min(target.currentShields, remaining);
      target.currentShields = Math.max(0, target.currentShields - absorbed);
      remaining -= absorbed;
      events.push({ type: 'shield_absorbed', shipId: target.ship.id, amount: absorbed });
    }

    if (remaining <= 0) continue;

    // Armor partially absorbs remaining damage.
    const targetDesign = getDesign(target);
    const targetStats =
      targetDesign != null
        ? deriveDesignStats(targetDesign, componentById)
        : { totalDamage: 0, totalShields: 0, totalArmor: 0, repairRate: 0 };
    const armorAbsorb = Math.min(targetStats.totalArmor * ARMOR_ABSORPTION_FRACTION, remaining - 1);
    remaining -= Math.max(0, armorAbsorb);

    // Hull damage (minimum 1 to prevent stalemates).
    const hullDmg = Math.max(1, Math.round(remaining));
    const newHull = Math.max(0, target.ship.hullPoints - hullDmg);
    target.ship = { ...target.ship, hullPoints: newHull };

    events.push({
      type: 'hull_damage',
      shipId: target.ship.id,
      amount: hullDmg,
      remaining: newHull,
    });

    // Morale penalty for hull hits.
    target.morale = Math.max(0, target.morale + MORALE_HULL_HIT);

    // Random system damage check.
    if (rng() < SYSTEM_HIT_CHANCE) {
      const systemKey = systemKeys[Math.floor(rng() * systemKeys.length)] as keyof SystemDamage;
      const addedDmg =
        SYSTEM_DAMAGE_PER_HIT_MIN +
        rng() * (SYSTEM_DAMAGE_PER_HIT_MAX - SYSTEM_DAMAGE_PER_HIT_MIN);
      const currentLevel = target.ship.systemDamage[systemKey] ?? 0;
      const newLevel = clamp(currentLevel + addedDmg, 0, 1);
      target.ship = {
        ...target.ship,
        systemDamage: { ...target.ship.systemDamage, [systemKey]: newLevel },
      };
      events.push({
        type: 'system_damaged',
        shipId: target.ship.id,
        system: systemKey,
        newLevel,
      });
    }

    // Destruction check.
    if (target.ship.hullPoints <= 0) {
      target.isDestroyed = true;
      destroyedThisTick.add(target.ship.id);
      events.push({ type: 'ship_destroyed', shipId: target.ship.id, name: target.ship.name });
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Morale updates
  // -------------------------------------------------------------------------
  const attackerDestroyedCount = attackers.filter((s) =>
    destroyedThisTick.has(s.ship.id),
  ).length;
  const defenderDestroyedCount = defenders.filter((s) =>
    destroyedThisTick.has(s.ship.id),
  ).length;

  function applyMorale(
    ownShips: CombatShip[],
    enemyShips: CombatShip[],
    friendlyDestroyedCount: number,
  ): void {
    const ownActive = activeShips(ownShips).length;
    const enemyActive = activeShips(enemyShips).length;
    const outnumbered = enemyActive > ownActive * 1.5;

    for (const cs of ownShips) {
      if (cs.isDestroyed || cs.isRouted) continue;
      let delta = friendlyDestroyedCount * MORALE_FRIENDLY_LOSS;
      if (outnumbered) delta += MORALE_OUTNUMBERED_PER_TICK;
      cs.morale = clamp(cs.morale + delta, 0, 100);
    }
  }

  applyMorale(attackers, defenders, attackerDestroyedCount);
  applyMorale(defenders, attackers, defenderDestroyedCount);

  // -------------------------------------------------------------------------
  // Step 5: Routing
  // -------------------------------------------------------------------------
  for (const cs of [...attackers, ...defenders]) {
    if (cs.isDestroyed || cs.isRouted) continue;
    if (cs.morale < MORALE_ROUTE_THRESHOLD) {
      cs.isRouted = true;
      events.push({ type: 'ship_routed', shipId: cs.ship.id });
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Victory check
  // -------------------------------------------------------------------------
  const newTick = state.tick + 1;
  const outcome = checkVictory(attackers, defenders, newTick);
  if (outcome != null) {
    events.push({ type: 'combat_end', outcome });
  }

  return {
    tick: newTick,
    attackerShips: attackers,
    defenderShips: defenders,
    events,
    outcome,
  };
}

// ---------------------------------------------------------------------------
// autoResolveCombat
// ---------------------------------------------------------------------------

/**
 * Run combat to completion and return only the outcome.
 *
 * Iterates processCombatTick until an outcome is produced or MAX_TICKS is
 * reached, at which point a draw is declared.
 */
export function autoResolveCombat(
  setup: CombatSetup,
  allComponents: ShipComponent[],
): CombatOutcome {
  let state = initializeCombat(setup, allComponents);

  while (state.outcome === null && state.tick < MAX_TICKS) {
    state = processCombatTick(
      state,
      allComponents,
      setup.attackerDesigns,
      setup.defenderDesigns,
    );
  }

  if (state.outcome !== null) return state.outcome;

  // Tick limit reached — draw.
  return buildOutcome('draw', state.attackerShips, state.defenderShips, state.tick);
}

// ---------------------------------------------------------------------------
// applyCombatResults
// ---------------------------------------------------------------------------

/**
 * Write accumulated hull and system damage from a final CombatState back onto
 * the canonical Ship objects.
 *
 * - Destroyed ships get hullPoints = 0.
 * - All ships (surviving or routed) have their exact combat-state values
 *   written back, including partial hull damage and system damage.
 * - Ships not present in the combat state are returned unchanged.
 *
 * Returns a new array; the original is not mutated.
 */
export function applyCombatResults(ships: Ship[], state: CombatState): Ship[] {
  const combatById = new Map<string, CombatShip>();
  for (const cs of [...state.attackerShips, ...state.defenderShips]) {
    combatById.set(cs.ship.id, cs);
  }

  return ships.map((ship) => {
    const cs = combatById.get(ship.id);
    if (cs == null) return ship;
    if (cs.isDestroyed) return { ...cs.ship, hullPoints: 0 };
    return { ...cs.ship };
  });
}

// ---------------------------------------------------------------------------
// calculateFleetPower
// ---------------------------------------------------------------------------

/**
 * Estimate the combat power of a fleet.
 *
 * Power is the sum over all living ships of:
 *   effectiveDamage × hullFraction + effectiveShields + totalArmor
 *
 * An optional `combatMultiplier` (e.g. from government bonuses) scales the
 * final total.  Defaults to 1.0 (no bonus).
 *
 * This is useful for AI comparisons and auto-resolve balance checks but is
 * intentionally approximate.
 */
export function calculateFleetPower(
  ships: Ship[],
  designs: Map<string, ShipDesign>,
  allComponents: ShipComponent[],
  combatMultiplier = 1.0,
): number {
  const componentById = new Map(allComponents.map((c) => [c.id, c]));
  let total = 0;

  for (const ship of ships) {
    if (ship.hullPoints <= 0) continue;
    const design = designs.get(ship.designId);
    if (design == null) continue;

    const stats = deriveDesignStats(design, componentById);
    const hullFraction =
      ship.maxHullPoints > 0 ? ship.hullPoints / ship.maxHullPoints : 0;

    total +=
      effectiveWeaponDamage(stats, ship.systemDamage) * hullFraction +
      effectiveMaxShields(stats, ship.systemDamage) +
      stats.totalArmor;
  }

  return total * combatMultiplier;
}
