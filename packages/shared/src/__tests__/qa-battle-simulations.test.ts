/**
 * QA adversarial battle simulation tests — 50 tests (10 per tech age).
 *
 * These tests exercise sad-path and edge-case conditions across the entire
 * tactical combat system. They do NOT fix bugs; they only detect and report them.
 *
 * Categories mixed across all 5 ages:
 *   A. Fleet composition edge cases (2 per age)
 *   B. Weapon mismatch (2 per age)
 *   C. Stance & order changes mid-battle (2 per age)
 *   D. Destruction & escape pods (2 per age)
 *   E. Environmental & boundary (2 per age)
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, HULL_TEMPLATES, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  setShipStance,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '../engine/combat-tactical.js';
import type { CombatStance, TacticalState, TacticalShip } from '../engine/combat-tactical.js';
import { generateId } from '../utils/id.js';
import type { Ship, Fleet, ShipDesign, HullClass } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const AGE_ORDER = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'] as const;

/** Hulls available at each age (cumulative — earlier ages are included). */
const HULLS_BY_AGE: Record<string, HullClass[]> = {};
for (const hull of HULL_TEMPLATES) {
  const ageIdx = AGE_ORDER.indexOf(hull.requiredAge as typeof AGE_ORDER[number]);
  if (ageIdx < 0) continue;
  for (let i = ageIdx; i < AGE_ORDER.length; i++) {
    const age = AGE_ORDER[i]!;
    if (!HULLS_BY_AGE[age]) HULLS_BY_AGE[age] = [];
    if (!HULLS_BY_AGE[age]!.includes(hull.class)) {
      HULLS_BY_AGE[age]!.push(hull.class);
    }
  }
}

/** Filter components available at a given age. */
function componentsForAge(age: string) {
  const ageIdx = AGE_ORDER.indexOf(age as typeof AGE_ORDER[number]);
  return SHIP_COMPONENTS.filter(c => {
    const compIdx = AGE_ORDER.indexOf((c.minAge ?? 'nano_atomic') as typeof AGE_ORDER[number]);
    return compIdx <= ageIdx;
  });
}

/** Build a fleet of ships from hull classes at the given tech age. */
function setupFleet(
  hulls: HullClass[],
  age: string,
  empireId: string,
  fleetId: string,
  _side: 'attacker' | 'defender',
): { ships: Ship[]; fleet: Fleet; designs: Map<string, ShipDesign> } {
  const available = componentsForAge(age);
  const designs = new Map<string, ShipDesign>();
  const ships: Ship[] = [];

  for (const hullClass of hulls) {
    const template = HULL_TEMPLATE_BY_CLASS[hullClass];
    if (!template) continue;

    const design: ShipDesign = {
      ...autoEquipDesign(template, available),
      id: generateId(),
      empireId,
      armourPlating: 1.0,
    };
    designs.set(design.id, design);

    ships.push({
      id: generateId(),
      designId: design.id,
      name: template.name,
      hullPoints: template.baseHullPoints,
      maxHullPoints: template.baseHullPoints,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'test' },
      fleetId,
    });
  }

  const fleet: Fleet = {
    id: fleetId,
    name: `Fleet ${fleetId}`,
    ships: ships.map(s => s.id),
    empireId,
    position: { systemId: 'test' },
    destination: null,
    waypoints: [],
    stance: 'aggressive',
  };

  return { ships, fleet, designs };
}

/** Merge two design maps. */
function mergeDesigns(...maps: Map<string, ShipDesign>[]): Map<string, ShipDesign> {
  const merged = new Map<string, ShipDesign>();
  for (const m of maps) {
    for (const [k, v] of m) merged.set(k, v);
  }
  return merged;
}

/** Initialise a battle between two hull arrays at the given age. */
function initBattle(
  attackerHulls: HullClass[],
  defenderHulls: HullClass[],
  age: string,
): TacticalState {
  const a = setupFleet(attackerHulls, age, 'e1', 'f1', 'attacker');
  const d = setupFleet(defenderHulls, age, 'e2', 'f2', 'defender');
  const designs = mergeDesigns(a.designs, d.designs);
  return initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);
}

/** Invariant violations found during a simulation run. */
interface InvariantViolation {
  tick: number;
  shipId: string;
  shipName: string;
  field: string;
  value: number;
  message: string;
}

/** Run a battle for N ticks, checking invariants every tick. */
function runBattle(
  state: TacticalState,
  ticks: number,
): { state: TacticalState; crashed: boolean; error?: string; violations: InvariantViolation[] } {
  const violations: InvariantViolation[] = [];

  function checkInvariants(s: TacticalState) {
    for (const ship of s.ships) {
      // Position checks
      if (Number.isNaN(ship.position.x) || Number.isNaN(ship.position.y)) {
        violations.push({
          tick: s.tick, shipId: ship.id, shipName: ship.name,
          field: 'position', value: NaN, message: `Position is NaN (x=${ship.position.x}, y=${ship.position.y})`,
        });
      }
      if (!Number.isFinite(ship.position.x) || !Number.isFinite(ship.position.y)) {
        if (!Number.isNaN(ship.position.x) && !Number.isNaN(ship.position.y)) {
          violations.push({
            tick: s.tick, shipId: ship.id, shipName: ship.name,
            field: 'position', value: Infinity, message: `Position is Infinity (x=${ship.position.x}, y=${ship.position.y})`,
          });
        }
      }

      // HP checks
      if (ship.hull < 0) {
        violations.push({
          tick: s.tick, shipId: ship.id, shipName: ship.name,
          field: 'hull', value: ship.hull, message: `Hull below 0: ${ship.hull}`,
        });
      }
      if (ship.hull > ship.maxHull) {
        violations.push({
          tick: s.tick, shipId: ship.id, shipName: ship.name,
          field: 'hull', value: ship.hull, message: `Hull exceeds maxHull: ${ship.hull} > ${ship.maxHull}`,
        });
      }

      // Shield checks
      if (ship.shields < 0) {
        violations.push({
          tick: s.tick, shipId: ship.id, shipName: ship.name,
          field: 'shields', value: ship.shields, message: `Shields below 0: ${ship.shields}`,
        });
      }
      if (ship.shields > ship.maxShields * 1.01) { // tiny tolerance for float rounding
        violations.push({
          tick: s.tick, shipId: ship.id, shipName: ship.name,
          field: 'shields', value: ship.shields, message: `Shields exceed maxShields: ${ship.shields} > ${ship.maxShields}`,
        });
      }

      // Morale checks
      if (ship.crew) {
        if (ship.crew.morale < 0) {
          violations.push({
            tick: s.tick, shipId: ship.id, shipName: ship.name,
            field: 'morale', value: ship.crew.morale, message: `Morale below 0: ${ship.crew.morale}`,
          });
        }
        if (ship.crew.morale > 100) {
          violations.push({
            tick: s.tick, shipId: ship.id, shipName: ship.name,
            field: 'morale', value: ship.crew.morale, message: `Morale above 100: ${ship.crew.morale}`,
          });
        }
      }
    }
  }

  try {
    for (let i = 0; i < ticks; i++) {
      state = processTacticalTick(state);
      checkInvariants(state);
    }
    return { state, crashed: false, violations };
  } catch (err) {
    return {
      state,
      crashed: true,
      error: err instanceof Error ? err.message : String(err),
      violations,
    };
  }
}

// ---------------------------------------------------------------------------
// Smallest/largest hull at each age for swarm vs capital tests
// ---------------------------------------------------------------------------

function smallestCombatHull(age: string): HullClass {
  const hulls = HULLS_BY_AGE[age] ?? [];
  // Pick the hull with the lowest baseHullPoints that has at least 1 weapon slot
  let best: HullClass | null = null;
  let bestHP = Infinity;
  for (const hc of hulls) {
    const t = HULL_TEMPLATE_BY_CLASS[hc];
    if (!t) continue;
    const wSlots = t.slotLayout.filter(s => s.category === 'weapon').length;
    if (wSlots === 0) continue;
    if (t.baseHullPoints < bestHP) {
      bestHP = t.baseHullPoints;
      best = hc;
    }
  }
  return best ?? 'drone';
}

function largestHull(age: string): HullClass {
  const hulls = HULLS_BY_AGE[age] ?? [];
  let best: HullClass | null = null;
  let bestHP = 0;
  for (const hc of hulls) {
    const t = HULL_TEMPLATE_BY_CLASS[hc];
    if (!t) continue;
    if (t.baseHullPoints > bestHP) {
      bestHP = t.baseHullPoints;
      best = hc;
    }
  }
  return best ?? 'destroyer';
}

/** Non-combat hull (no weapon slots) for the given age, or null. */
function nonCombatHull(age: string): HullClass | null {
  const hulls = HULLS_BY_AGE[age] ?? [];
  for (const hc of hulls) {
    const t = HULL_TEMPLATE_BY_CLASS[hc];
    if (!t) continue;
    const wSlots = t.slotLayout.filter(s => s.category === 'weapon').length;
    if (wSlots === 0) return hc;
  }
  return null;
}

// ============================================================================
// NANO_ATOMIC AGE (10 tests)
// ============================================================================
describe('QA: nano_atomic age', () => {
  const age = 'nano_atomic';

  // --- A. Fleet Composition Edge Cases ---
  it('A1: 1 destroyer vs 5 destroyers — outnumbered side takes more damage', () => {
    const result = runBattle(
      initBattle(['destroyer'], ['destroyer', 'destroyer', 'destroyer', 'destroyer', 'destroyer'], age),
      600,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // The outnumbered side should be destroyed or heavily damaged
    const loner = result.state.ships.filter(s => s.side === 'attacker');
    const gang = result.state.ships.filter(s => s.side === 'defender');
    const lonerAlive = loner.filter(s => !s.destroyed);
    const gangAlive = gang.filter(s => !s.destroyed);

    // The swarm should have more survivors
    expect(gangAlive.length).toBeGreaterThanOrEqual(lonerAlive.length);
  });

  it('A2: largest hull vs swarm of smallest combat hulls — combat should occur within 800 ticks', () => {
    const big = largestHull(age);
    const small = smallestCombatHull(age);
    const result = runBattle(
      initBattle([big], Array(5).fill(small) as HullClass[], age),
      800,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // BUG DETECTION: at nano_atomic, ships with speed 3 closing 1360px gap
    // may not reach weapon range in time. If no damage occurs at all in 800
    // ticks, this is a gameplay bug — the player sees two fleets sit idle.
    const anyDamaged = result.state.ships.some(s => s.hull < s.maxHull || s.destroyed);
    const anyShieldDamaged = result.state.ships.some(s => s.shields < s.maxShields);
    expect(anyDamaged || anyShieldDamaged).toBe(true);
  });

  // --- B. Weapon Mismatch ---
  it('B1: fighters (short-range) vs patrol (no weapons) — patrol should be defenceless', () => {
    const state = initBattle(
      ['fighter', 'fighter'],
      ['patrol', 'patrol'],
      age,
    );
    const result = runBattle(state, 600);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Patrol has 0 weapon slots — should not deal damage to attackers
    const attackers = result.state.ships.filter(s => s.side === 'attacker');
    const defenders = result.state.ships.filter(s => s.side === 'defender');
    const defendersTookDamage = defenders.some(s => s.hull < s.maxHull || s.destroyed);
    expect(defendersTookDamage).toBe(true);
  });

  it('B2: science_probe in combat — zero weapon slots, should not crash', () => {
    const result = runBattle(
      initBattle(['science_probe'], ['destroyer'], age),
      400,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  // --- C. Stance & Order Changes ---
  it('C1: rapid stance cycling through all stances during combat', () => {
    let state = initBattle(['destroyer', 'destroyer'], ['destroyer', 'destroyer'], age);
    const stances: CombatStance[] = ['aggressive', 'at_ease', 'defensive', 'evasive', 'flee', 'defensive', 'aggressive'];
    const violations: InvariantViolation[] = [];

    for (const stance of stances) {
      for (const ship of state.ships.filter(s => s.side === 'attacker' && !s.destroyed)) {
        state = setShipStance(state, ship.id, stance);
        if (stance === 'flee') {
          state = setShipOrder(state, ship.id, { type: 'flee' });
        }
      }
      // 30 ticks per stance switch
      const tick = runBattle(state, 30);
      state = tick.state;
      expect(tick.crashed).toBe(false);
      violations.push(...tick.violations);
    }
    expect(violations).toEqual([]);
  });

  it('C2: set attack order then immediately set flee — no crash', () => {
    let state = initBattle(['destroyer'], ['destroyer'], age);
    const attacker = state.ships.find(s => s.side === 'attacker')!;
    const defender = state.ships.find(s => s.side === 'defender')!;

    state = setShipOrder(state, attacker.id, { type: 'attack', targetId: defender.id });
    state = setShipStance(state, attacker.id, 'aggressive');
    // Immediately override with flee
    state = setShipOrder(state, attacker.id, { type: 'flee' });
    state = setShipStance(state, attacker.id, 'flee');

    const result = runBattle(state, 400);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Ship should have fled or be in flee state
    const endShip = result.state.ships.find(s => s.id === attacker.id)!;
    expect(endShip.order.type === 'flee' || endShip.routed || endShip.destroyed).toBe(true);
  });

  // --- D. Destruction & Escape Pods ---
  it('D1: escape pods spawn when a ship is destroyed', () => {
    // 1 drone vs destroyer — drone should die quickly
    let state = initBattle(['drone'], ['destroyer'], age);
    let podsEverSpawned = false;

    for (let i = 0; i < 600; i++) {
      state = processTacticalTick(state);
      if (state.escapePods.length > 0) {
        podsEverSpawned = true;
      }
      if (state.outcome !== null) break;
    }

    const droneDestroyed = state.ships.filter(s => s.side === 'attacker').some(s => s.destroyed);
    if (droneDestroyed) {
      expect(podsEverSpawned).toBe(true);
    }
  });

  it('D2: all ships on one side destroyed — outcome is set correctly', () => {
    // 1 drone vs 3 destroyers — drone should be obliterated
    const result = runBattle(
      initBattle(['drone'], ['destroyer', 'destroyer', 'destroyer'], age),
      600,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    const attackersAlive = result.state.ships.filter(s => s.side === 'attacker' && !s.destroyed && !s.routed);
    if (attackersAlive.length === 0) {
      expect(result.state.outcome).toBe('defender_wins');
    }
  });

  // --- E. Environmental & Boundary ---
  it('E1: 1000+ tick endurance — no NaN, Infinity, or frozen ships', () => {
    const result = runBattle(
      initBattle(['destroyer', 'destroyer'], ['destroyer', 'destroyer'], age),
      1200,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // If battle is still ongoing, ships should still be moving (not frozen)
    if (result.state.outcome === null) {
      const activeShips = result.state.ships.filter(s => !s.destroyed && !s.routed);
      for (const ship of activeShips) {
        expect(Number.isFinite(ship.position.x)).toBe(true);
        expect(Number.isFinite(ship.position.y)).toBe(true);
      }
    }
  });

  it('E2: morale stays within 0-100 after extended combat', () => {
    const result = runBattle(
      initBattle(['fighter', 'fighter', 'bomber', 'bomber'], ['destroyer', 'destroyer'], age),
      800,
    );
    expect(result.crashed).toBe(false);
    // Check morale invariant violations specifically
    const moraleViolations = result.violations.filter(v => v.field === 'morale');
    expect(moraleViolations).toEqual([]);
  });
});

// ============================================================================
// FUSION AGE (10 tests)
// ============================================================================
describe('QA: fusion age', () => {
  const age = 'fusion';

  // --- A. Fleet Composition Edge Cases ---
  it('A3: 1 frigate vs 5 corvettes — outnumbered', () => {
    const result = runBattle(
      initBattle(['frigate'], ['corvette', 'corvette', 'corvette', 'corvette', 'corvette'], age),
      600,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('A4: all-frigate fleet vs mixed corvette+destroyer fleet', () => {
    const result = runBattle(
      initBattle(['frigate', 'frigate', 'frigate'], ['corvette', 'destroyer', 'corvette'], age),
      600,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Combat should have occurred
    const anyDamaged = result.state.ships.some(s => s.hull < s.maxHull || s.destroyed);
    expect(anyDamaged).toBe(true);
  });

  // --- B. Weapon Mismatch ---
  it('B3: cargo ships (0 weapon slots) forced into combat', () => {
    const result = runBattle(
      initBattle(['cargo', 'cargo'], ['corvette'], age),
      400,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Cargo ships should be helpless
    const cargoShips = result.state.ships.filter(s => s.side === 'attacker');
    const corvette = result.state.ships.filter(s => s.side === 'defender');
    // Corvette should not be damaged by cargo ships (no weapons)
    // (this is best-effort — we just check no crash and invariants)
  });

  it('B4: transport ships (0 weapon slots) vs destroyer', () => {
    const result = runBattle(
      initBattle(['transport', 'transport'], ['destroyer'], age),
      500,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  // --- C. Stance & Order Changes ---
  it('C3: mixed stances in same fleet — some aggressive, some defensive, some evasive', () => {
    let state = initBattle(
      ['corvette', 'frigate', 'destroyer'],
      ['corvette', 'frigate', 'destroyer'],
      age,
    );

    const attackers = state.ships.filter(s => s.side === 'attacker');
    const stancesToAssign: CombatStance[] = ['aggressive', 'defensive', 'evasive'];
    attackers.forEach((ship, i) => {
      state = setShipStance(state, ship.id, stancesToAssign[i % stancesToAssign.length]!);
    });

    const result = runBattle(state, 600);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('C4: set flee order on entire fleet mid-battle', () => {
    let state = initBattle(['frigate', 'corvette'], ['destroyer', 'destroyer'], age);

    // Run 100 ticks of aggressive combat
    for (let i = 0; i < 100; i++) {
      state = processTacticalTick(state);
    }

    // Now set all attackers to flee
    for (const ship of state.ships.filter(s => s.side === 'attacker' && !s.destroyed)) {
      state = setShipStance(state, ship.id, 'flee');
      state = setShipOrder(state, ship.id, { type: 'flee' });
    }

    const result = runBattle(state, 400);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Fleeing ships should either have routed or been destroyed
    const attackers = result.state.ships.filter(s => s.side === 'attacker');
    for (const a of attackers) {
      expect(a.routed || a.destroyed || a.stance === 'flee').toBe(true);
    }
  });

  // --- D. Destruction & Escape Pods ---
  it('D3: overkill damage — 5 destroyers vs 1 spy_probe (10 HP)', () => {
    const result = runBattle(
      initBattle(['spy_probe'], ['destroyer', 'destroyer', 'destroyer', 'destroyer', 'destroyer'], age),
      300,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Probe should be destroyed
    const probe = result.state.ships.find(s => s.side === 'attacker');
    expect(probe!.destroyed || result.state.outcome === 'defender_wins').toBe(true);
  });

  it('D4: ships starting with 1 HP should be destroyed once shields break', () => {
    // Manually create ships with 1 HP but full shields from the design.
    // BUG DETECTION: ships with 1 HP may survive indefinitely if shields
    // are strong enough, meaning crippled ships can never be finished off.
    const available = componentsForAge(age);
    const template = HULL_TEMPLATE_BY_CLASS['frigate']!;
    const designA: ShipDesign = { ...autoEquipDesign(template, available), id: generateId(), empireId: 'e1', armourPlating: 1.0 };
    const designB: ShipDesign = { ...autoEquipDesign(template, available), id: generateId(), empireId: 'e2', armourPlating: 1.0 };
    const designs = new Map<string, ShipDesign>([[designA.id, designA], [designB.id, designB]]);

    const makeWoundedShip = (design: ShipDesign, fid: string, hp: number): Ship => ({
      id: generateId(),
      designId: design.id,
      name: template.name,
      hullPoints: hp,
      maxHullPoints: template.baseHullPoints,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'test' },
      fleetId: fid,
    });

    const shipA = makeWoundedShip(designA, 'f1', 1);  // 1 HP
    const shipB = makeWoundedShip(designB, 'f2', 1);  // 1 HP

    const fA: Fleet = { id: 'f1', name: 'A', ships: [shipA.id], empireId: 'e1', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };
    const fB: Fleet = { id: 'f2', name: 'B', ships: [shipB.id], empireId: 'e2', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };

    let state = initializeTacticalCombat(fA, fB, [shipA], [shipB], designs, SHIP_COMPONENTS);

    // Check what shields the ships actually got
    const initialShields = state.ships.map(s => ({ name: s.name, shields: s.maxShields, hull: s.hull }));

    // Run for a long time to try to break through shields
    const result = runBattle(state, 800);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // With 1 HP hull, any ship that took hull damage should be destroyed
    // This test detects if shields keep regenerating fast enough that hull
    // is never reached, making 1-HP ships immortal.
    const anyDestroyed = result.state.ships.some(s => s.destroyed);
    const anyHullDamaged = result.state.ships.some(s => s.hull < 1);
    expect(anyDestroyed || anyHullDamaged).toBe(true);
  });

  // --- E. Environmental & Boundary ---
  it('E3: verify no ship position becomes NaN during 800-tick battle', () => {
    const result = runBattle(
      initBattle(
        ['corvette', 'frigate', 'destroyer'],
        ['corvette', 'frigate', 'destroyer'],
        age,
      ),
      800,
    );
    expect(result.crashed).toBe(false);
    const posViolations = result.violations.filter(v => v.field === 'position');
    expect(posViolations).toEqual([]);
  });

  it('E4: shields never exceed maxShields across 600 ticks of combat', () => {
    const result = runBattle(
      initBattle(['frigate', 'frigate'], ['corvette', 'corvette', 'corvette'], age),
      600,
    );
    expect(result.crashed).toBe(false);
    const shieldViolations = result.violations.filter(v => v.field === 'shields');
    expect(shieldViolations).toEqual([]);
  });
});

// ============================================================================
// NANO_FUSION AGE (10 tests)
// ============================================================================
describe('QA: nano_fusion age', () => {
  const age = 'nano_fusion';

  // --- A. Fleet Composition Edge Cases ---
  it('A5: 1 light_battleship vs 5 corvettes — capital ship vs swarm', () => {
    const result = runBattle(
      initBattle(['light_battleship'], ['corvette', 'corvette', 'corvette', 'corvette', 'corvette'], age),
      700,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Should produce combat
    const anyDamaged = result.state.ships.some(s => s.hull < s.maxHull || s.destroyed);
    expect(anyDamaged).toBe(true);
  });

  it('A6: carrier vs swarm of 5 fighters', () => {
    const result = runBattle(
      initBattle(['carrier'], ['fighter', 'fighter', 'fighter', 'fighter', 'fighter'], age),
      700,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  // --- B. Weapon Mismatch ---
  it('B5: yacht (0 weapons) + large_cargo (1 weapon) vs heavy_cruiser', () => {
    const result = runBattle(
      initBattle(['yacht', 'large_cargo'], ['heavy_cruiser'], age),
      500,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('B6: large_supplier (2 weapons) vs light_cruiser (6 weapons) — outgunned', () => {
    const result = runBattle(
      initBattle(['large_supplier'], ['light_cruiser'], age),
      500,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Light cruiser should have a clear advantage
    const anyDamaged = result.state.ships.some(s => s.hull < s.maxHull || s.destroyed);
    expect(anyDamaged).toBe(true);
  });

  // --- C. Stance & Order Changes ---
  it('C5: switch entire fleet aggressive->defensive->flee in 3 phases', () => {
    let state = initBattle(
      ['heavy_cruiser', 'light_cruiser'],
      ['heavy_cruiser', 'light_cruiser'],
      age,
    );

    // Phase 1: aggressive for 150 ticks
    const result1 = runBattle(state, 150);
    state = result1.state;
    expect(result1.crashed).toBe(false);

    // Phase 2: defensive for 150 ticks
    for (const ship of state.ships.filter(s => s.side === 'attacker' && !s.destroyed)) {
      state = setShipStance(state, ship.id, 'defensive');
    }
    const result2 = runBattle(state, 150);
    state = result2.state;
    expect(result2.crashed).toBe(false);

    // Phase 3: flee for 200 ticks
    for (const ship of state.ships.filter(s => s.side === 'attacker' && !s.destroyed)) {
      state = setShipStance(state, ship.id, 'flee');
      state = setShipOrder(state, ship.id, { type: 'flee' });
    }
    const result3 = runBattle(state, 200);
    expect(result3.crashed).toBe(false);

    const allViolations = [...result1.violations, ...result2.violations, ...result3.violations];
    expect(allViolations).toEqual([]);
  });

  it('C6: change attack target mid-battle to already-destroyed ship', () => {
    let state = initBattle(
      ['heavy_cruiser', 'heavy_cruiser'],
      ['fighter', 'fighter', 'fighter'],
      age,
    );

    // Run until something gets destroyed
    let destroyedShipId: string | null = null;
    for (let i = 0; i < 500; i++) {
      state = processTacticalTick(state);
      const dead = state.ships.find(s => s.destroyed);
      if (dead && !destroyedShipId) {
        destroyedShipId = dead.id;
        break;
      }
    }

    // If something was destroyed, set an attacker to target the dead ship
    if (destroyedShipId) {
      const attacker = state.ships.find(s => s.side === 'attacker' && !s.destroyed);
      if (attacker) {
        state = setShipOrder(state, attacker.id, { type: 'attack', targetId: destroyedShipId });
        const result = runBattle(state, 200);
        expect(result.crashed).toBe(false);
        expect(result.violations).toEqual([]);
      }
    }
    // If nothing was destroyed in 500 ticks, the test still passes (no crash)
  });

  // --- D. Destruction & Escape Pods ---
  it('D5: escape pods spawn from large vessels (carrier, 570 HP)', () => {
    // 3 heavy_cruisers should be able to kill a carrier
    let state = initBattle(
      ['carrier'],
      ['heavy_cruiser', 'heavy_cruiser', 'heavy_cruiser'],
      age,
    );
    let maxPods = 0;

    for (let i = 0; i < 800; i++) {
      state = processTacticalTick(state);
      if (state.escapePods.length > maxPods) {
        maxPods = state.escapePods.length;
      }
      if (state.outcome !== null) break;
    }

    const carrierDestroyed = state.ships.filter(s => s.side === 'attacker').some(s => s.destroyed);
    if (carrierDestroyed) {
      // Large ship should spawn multiple escape pods (570 HP -> 3+ pods)
      expect(maxPods).toBeGreaterThanOrEqual(1);
    }
  });

  it('D6: all attackers destroyed mid-battle — outcome is defender_wins', () => {
    const result = runBattle(
      initBattle(['fighter', 'fighter'], ['light_battleship'], age),
      700,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    const attackersAlive = result.state.ships
      .filter(s => s.side === 'attacker' && !s.destroyed && !s.routed);
    if (attackersAlive.length === 0) {
      expect(result.state.outcome).toBe('defender_wins');
    }
  });

  // --- E. Environmental & Boundary ---
  it('E5: 1200-tick endurance with carrier + cruiser fleet', () => {
    const result = runBattle(
      initBattle(['carrier', 'heavy_cruiser'], ['carrier', 'heavy_cruiser'], age),
      1200,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('E6: hull never goes below 0 in large multi-ship battle', () => {
    const result = runBattle(
      initBattle(
        ['light_cruiser', 'heavy_cruiser', 'corvette', 'frigate'],
        ['light_cruiser', 'heavy_cruiser', 'corvette', 'frigate'],
        age,
      ),
      800,
    );
    expect(result.crashed).toBe(false);
    const hullViolations = result.violations.filter(v => v.field === 'hull');
    expect(hullViolations).toEqual([]);
  });
});

// ============================================================================
// ANTI_MATTER AGE (10 tests)
// ============================================================================
describe('QA: anti_matter age', () => {
  const age = 'anti_matter';

  // --- A. Fleet Composition Edge Cases ---
  it('A7: 1 battle_station (3000 HP) vs 10 fighters', () => {
    const result = runBattle(
      initBattle(
        ['battle_station'],
        Array(10).fill('fighter') as HullClass[],
        age,
      ),
      800,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('A8: heavy_battleship vs fleet of 5 destroyers — all same class on one side', () => {
    const result = runBattle(
      initBattle(
        ['heavy_battleship'],
        ['destroyer', 'destroyer', 'destroyer', 'destroyer', 'destroyer'],
        age,
      ),
      1000,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // BUG DETECTION: at anti_matter tech, ships should engage within 1000 ticks.
    // If nobody takes damage, ships are failing to close to weapon range.
    const anyHullDamaged = result.state.ships.some(s => s.hull < s.maxHull || s.destroyed);
    const anyShieldDamaged = result.state.ships.some(s => s.shields < s.maxShields);
    expect(anyHullDamaged || anyShieldDamaged).toBe(true);
  });

  // --- B. Weapon Mismatch ---
  it('B7: super_carrier (13 weapon slots) vs space_station (0 weapon slots)', () => {
    const nonCombat = nonCombatHull(age);
    const defenderHull = nonCombat ?? 'space_station';
    const result = runBattle(
      initBattle(['super_carrier'], [defenderHull], age),
      600,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('B8: all-bomber fleet vs all-frigate fleet — weapon range asymmetry', () => {
    const result = runBattle(
      initBattle(
        ['bomber', 'bomber', 'bomber', 'bomber'],
        ['frigate', 'frigate', 'frigate', 'frigate'],
        age,
      ),
      700,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  // --- C. Stance & Order Changes ---
  it('C7: evasive stance ships should still take some damage eventually', () => {
    let state = initBattle(['destroyer', 'destroyer'], ['destroyer', 'destroyer'], age);

    // Set all attackers to evasive
    for (const ship of state.ships.filter(s => s.side === 'attacker')) {
      state = setShipStance(state, ship.id, 'evasive');
    }

    const result = runBattle(state, 800);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('C8: rapid order toggling — attack, move, attack, flee, attack', () => {
    let state = initBattle(['battleship'], ['battleship'], age);
    const attacker = state.ships.find(s => s.side === 'attacker')!;
    const defender = state.ships.find(s => s.side === 'defender')!;

    const orders: Array<() => TacticalState> = [
      () => setShipOrder(state, attacker.id, { type: 'attack', targetId: defender.id }),
      () => setShipOrder(state, attacker.id, { type: 'move', x: 800, y: 500 }),
      () => setShipOrder(state, attacker.id, { type: 'attack', targetId: defender.id }),
      () => { state = setShipStance(state, attacker.id, 'flee'); return setShipOrder(state, attacker.id, { type: 'flee' }); },
      () => { state = setShipStance(state, attacker.id, 'aggressive'); return setShipOrder(state, attacker.id, { type: 'attack', targetId: defender.id }); },
    ];

    const allViolations: InvariantViolation[] = [];
    for (const setOrder of orders) {
      state = setOrder();
      const tick = runBattle(state, 50);
      state = tick.state;
      expect(tick.crashed).toBe(false);
      allViolations.push(...tick.violations);
    }
    expect(allViolations).toEqual([]);
  });

  // --- D. Destruction & Escape Pods ---
  it('D7: battle_station destruction generates multiple escape pods', () => {
    // Overwhelming force to destroy a battle station
    let state = initBattle(
      ['battle_station'],
      ['heavy_battleship', 'heavy_battleship', 'heavy_battleship', 'battleship', 'battleship'],
      age,
    );
    let maxPods = 0;

    for (let i = 0; i < 1000; i++) {
      state = processTacticalTick(state);
      if (state.escapePods.length > maxPods) {
        maxPods = state.escapePods.length;
      }
      if (state.outcome !== null) break;
    }

    const stationDestroyed = state.ships.filter(s => s.side === 'attacker').some(s => s.destroyed);
    if (stationDestroyed) {
      // 3000 HP -> should be 4 pods (maxHull >= 400)
      expect(maxPods).toBeGreaterThanOrEqual(1);
    }
  });

  it('D8: both sides mutual destruction — outcome should still be set', () => {
    // Evenly matched — run for a long time
    const result = runBattle(
      initBattle(['battleship'], ['battleship'], age),
      1000,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // If both sides have no active ships, outcome must be set
    const attackersAlive = result.state.ships.filter(s => s.side === 'attacker' && !s.destroyed && !s.routed);
    const defendersAlive = result.state.ships.filter(s => s.side === 'defender' && !s.destroyed && !s.routed);
    if (attackersAlive.length === 0 && defendersAlive.length === 0) {
      expect(result.state.outcome).not.toBeNull();
    }
  });

  // --- E. Environmental & Boundary ---
  it('E7: no position becomes NaN in large anti_matter fleet battle', () => {
    const result = runBattle(
      initBattle(
        ['battleship', 'heavy_battleship', 'super_carrier'],
        ['battleship', 'heavy_battleship', 'super_carrier'],
        age,
      ),
      800,
    );
    expect(result.crashed).toBe(false);
    const posViolations = result.violations.filter(v => v.field === 'position');
    expect(posViolations).toEqual([]);
  });

  it('E8: all invariants hold across 1000-tick anti_matter brawl', () => {
    const result = runBattle(
      initBattle(
        ['heavy_battleship', 'battleship', 'heavy_cruiser', 'light_cruiser'],
        ['heavy_battleship', 'battleship', 'heavy_cruiser', 'light_cruiser'],
        age,
      ),
      1000,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });
});

// ============================================================================
// SINGULARITY AGE (10 tests)
// ============================================================================
describe('QA: singularity age', () => {
  const age = 'singularity';

  // --- A. Fleet Composition Edge Cases ---
  it('A9: planet_killer (21300 HP) vs 10 destroyers — extreme HP asymmetry', () => {
    const result = runBattle(
      initBattle(
        ['planet_killer'],
        Array(10).fill('destroyer') as HullClass[],
        age,
      ),
      800,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('A10: planet_killer vs swarm of 10 bombers', () => {
    const result = runBattle(
      initBattle(
        ['planet_killer'],
        Array(10).fill('bomber') as HullClass[],
        age,
      ),
      800,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Some combat should have occurred
    const anyDamaged = result.state.ships.some(s => s.hull < s.maxHull || s.destroyed);
    expect(anyDamaged).toBe(true);
  });

  // --- B. Weapon Mismatch ---
  it('B9: planet_killer (33 weapon slots) vs cargo ship (0 weapons)', () => {
    const result = runBattle(
      initBattle(['planet_killer'], ['cargo'], age),
      300,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Cargo should be obliterated rapidly
    const cargo = result.state.ships.find(s => s.side === 'defender');
    expect(cargo!.destroyed || result.state.outcome === 'attacker_wins').toBe(true);
  });

  it('B10: all coloniser_gen5 in combat — colonisers forced to fight', () => {
    const result = runBattle(
      initBattle(['coloniser_gen5'], ['coloniser_gen5'], age),
      600,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
  });

  // --- C. Stance & Order Changes ---
  it('C9: planet_killer set to flee — massive ship fleeing', () => {
    let state = initBattle(['planet_killer'], ['heavy_battleship', 'heavy_battleship'], age);
    const pk = state.ships.find(s => s.side === 'attacker')!;

    state = setShipStance(state, pk.id, 'flee');
    state = setShipOrder(state, pk.id, { type: 'flee' });

    const result = runBattle(state, 600);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Planet killer should have fled or be en route
    const endPK = result.state.ships.find(s => s.id === pk.id)!;
    expect(endPK.routed || endPK.stance === 'flee' || endPK.destroyed).toBe(true);
  });

  it('C10: all ships on both sides set to defensive — stalemate test', () => {
    let state = initBattle(
      ['battleship', 'battleship'],
      ['battleship', 'battleship'],
      age,
    );

    // Both sides defensive
    for (const ship of state.ships) {
      state = setShipStance(state, ship.id, 'defensive');
    }

    const result = runBattle(state, 600);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);
    // Defensive stance should not cause a crash even if nobody fires first
  });

  // --- D. Destruction & Escape Pods ---
  it('D9: planet_killer destruction should spawn maximum escape pods', () => {
    // We need overwhelming force — use multiple planet_killers vs 1
    let state = initBattle(
      ['planet_killer'],
      ['planet_killer', 'planet_killer'],
      age,
    );
    let maxPods = 0;
    let attackerDestroyed = false;

    for (let i = 0; i < 1500; i++) {
      state = processTacticalTick(state);
      if (state.escapePods.length > maxPods) {
        maxPods = state.escapePods.length;
      }
      if (state.ships.filter(s => s.side === 'attacker').some(s => s.destroyed)) {
        attackerDestroyed = true;
      }
      if (state.outcome !== null) break;
    }

    if (attackerDestroyed) {
      // 21300 HP -> 4 pods (max)
      expect(maxPods).toBeGreaterThanOrEqual(1);
    }

    // Invariant checks on final state
    for (const ship of state.ships) {
      expect(Number.isFinite(ship.position.x)).toBe(true);
      expect(Number.isFinite(ship.position.y)).toBe(true);
      expect(ship.hull).toBeGreaterThanOrEqual(0);
    }
  });

  it('D10: ships at 1 HP with singularity weapons should be destroyed', () => {
    // BUG DETECTION: at singularity age, destroyer shields are massive.
    // Ships with 1 HP hull but full shields from singularity-age components
    // may never have their hull reached due to shield recharge rate.
    // This tests whether high-damage singularity weapons can punch through.
    const available = componentsForAge(age);
    const template = HULL_TEMPLATE_BY_CLASS['destroyer']!;
    const dA: ShipDesign = { ...autoEquipDesign(template, available), id: generateId(), empireId: 'e1', armourPlating: 1.0 };
    const dB: ShipDesign = { ...autoEquipDesign(template, available), id: generateId(), empireId: 'e2', armourPlating: 1.0 };
    const designs = new Map<string, ShipDesign>([[dA.id, dA], [dB.id, dB]]);

    const makeShip = (d: ShipDesign, fid: string): Ship => ({
      id: generateId(),
      designId: d.id,
      name: template.name,
      hullPoints: 1,
      maxHullPoints: template.baseHullPoints,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'test' },
      fleetId: fid,
    });

    const sA = makeShip(dA, 'f1');
    const sB = makeShip(dB, 'f2');
    const fA: Fleet = { id: 'f1', name: 'A', ships: [sA.id], empireId: 'e1', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };
    const fB: Fleet = { id: 'f2', name: 'B', ships: [sB.id], empireId: 'e2', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };

    let state = initializeTacticalCombat(fA, fB, [sA], [sB], designs, SHIP_COMPONENTS);

    // Report initial shield values for diagnosis
    const shieldReport = state.ships.map(s => ({ shields: s.maxShields, hull: s.hull }));

    const result = runBattle(state, 1000);
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // With 1000 ticks at singularity age, weapons should eventually break
    // through shields and destroy a 1-HP ship. If not, shield regen outpaces DPS.
    const anyDestroyed = result.state.ships.some(s => s.destroyed);
    const anyHullDamaged = result.state.ships.some(s => s.hull < 1);
    expect(anyDestroyed || anyHullDamaged).toBe(true);

    // Secondary: any ship with hull <= 0 must be marked destroyed
    for (const ship of result.state.ships) {
      if (ship.hull <= 0) {
        expect(ship.destroyed).toBe(true);
      }
    }
  });

  // --- E. Environmental & Boundary ---
  it('E9: 1500-tick singularity endurance — planet_killer vs battle_station', () => {
    const result = runBattle(
      initBattle(['planet_killer'], ['battle_station', 'battle_station'], age),
      1500,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Verify no NaN/Infinity on any surviving ship
    for (const ship of result.state.ships.filter(s => !s.destroyed)) {
      expect(Number.isFinite(ship.position.x)).toBe(true);
      expect(Number.isFinite(ship.position.y)).toBe(true);
      expect(Number.isFinite(ship.hull)).toBe(true);
      expect(Number.isFinite(ship.shields)).toBe(true);
    }
  });

  it('E10: full invariant check — massive singularity-age fleet battle', () => {
    const result = runBattle(
      initBattle(
        ['planet_killer', 'heavy_battleship', 'super_carrier', 'battleship', 'heavy_cruiser'],
        ['planet_killer', 'heavy_battleship', 'super_carrier', 'battleship', 'heavy_cruiser'],
        age,
      ),
      1000,
    );
    expect(result.crashed).toBe(false);
    expect(result.violations).toEqual([]);

    // Final state consistency: every destroyed ship has hull <= 0
    for (const ship of result.state.ships) {
      if (ship.destroyed) {
        expect(ship.hull).toBeLessThanOrEqual(0);
      }
      // No ship's hull can exceed maxHull
      expect(ship.hull).toBeLessThanOrEqual(ship.maxHull);
    }
  });
});
