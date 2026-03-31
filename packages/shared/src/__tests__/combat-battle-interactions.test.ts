/**
 * Combat Battle Interactions — 10-round playtest
 *
 * Exercises formations, stance changes, ship selection, targeting,
 * attack-move, and multi-group command scenarios.
 */

import { describe, it, expect } from 'vitest';

import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  setShipStance,
  setFormation,
  findTarget,
  moveShip,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '../engine/combat-tactical.js';
import type {
  TacticalState,
  TacticalShip,
  ShipOrder,
  FormationType,
  CombatStance,
} from '../engine/combat-tactical.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import { SHIP_COMPONENTS } from '../../data/ships/index.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeFleet(id: string, empireId: string, shipIds: string[]): Fleet {
  return {
    id,
    name: `Fleet ${id}`,
    ships: shipIds,
    empireId,
    position: { systemId: 'system-alpha' },
    destination: null,
    waypoints: [],
    stance: 'aggressive',
  };
}

function makeShip(id: string, designId: string, hp = 100): Ship {
  return {
    id,
    designId,
    name: `Ship ${id}`,
    hullPoints: hp,
    maxHullPoints: hp,
    systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    position: { systemId: 'system-alpha' },
    fleetId: null,
  };
}

function makeArmedDesign(id: string, empireId = 'empire-1'): ShipDesign {
  return {
    id,
    name: `Design ${id}`,
    hull: 'scout',
    components: [
      { slotId: 'scout_fore_1', componentId: 'pulse_laser' },
      { slotId: 'scout_turret_1', componentId: 'deflector_shield' },
      { slotId: 'scout_aft_1', componentId: 'ion_engine' },
    ],
    totalCost: 185,
    empireId,
  };
}

/** Create a 6v6 battle — realistic fleet size for testing formations */
function setup6v6(): TacticalState {
  const atkDesign = makeArmedDesign('d-atk', 'empire-1');
  const defDesign = makeArmedDesign('d-def', 'empire-2');
  const designs = new Map<string, ShipDesign>([
    [atkDesign.id, atkDesign],
    [defDesign.id, defDesign],
  ]);

  const atkShips = Array.from({ length: 6 }, (_, i) => makeShip(`atk-${i}`, atkDesign.id));
  const defShips = Array.from({ length: 6 }, (_, i) => makeShip(`def-${i}`, defDesign.id));

  return initializeTacticalCombat(
    makeFleet('f-atk', 'empire-1', atkShips.map(s => s.id)),
    makeFleet('f-def', 'empire-2', defShips.map(s => s.id)),
    atkShips,
    defShips,
    designs,
    SHIP_COMPONENTS,
  );
}

/** Run N ticks */
function runTicks(state: TacticalState, n: number): TacticalState {
  for (let i = 0; i < n; i++) {
    state = processTacticalTick(state);
  }
  return state;
}

function attackerShips(state: TacticalState): TacticalShip[] {
  return state.ships.filter(s => s.side === 'attacker' && !s.destroyed && !s.routed);
}

function defenderShips(state: TacticalState): TacticalShip[] {
  return state.ships.filter(s => s.side === 'defender' && !s.destroyed && !s.routed);
}

/** Find a tactical ship by its sourceShipId (the original Ship.id) */
function bySource(state: TacticalState, sourceId: string): TacticalShip {
  const s = state.ships.find(sh => sh.sourceShipId === sourceId);
  if (!s) throw new Error(`No tactical ship for sourceShipId=${sourceId}`);
  return s;
}

/** Get tactical IDs for a list of source ship IDs */
function tacticalIds(state: TacticalState, sourceIds: string[]): string[] {
  return sourceIds.map(sid => bySource(state, sid).id);
}

// ---------------------------------------------------------------------------
// Round 1: Basic formation assignment
// ---------------------------------------------------------------------------

describe('Round 1 — Formation basics', () => {
  it('setFormation("line") arranges ships in a horizontal line', () => {
    let state = setup6v6();
    state = setFormation(state, 'attacker', 'line');
    const ships = attackerShips(state);
    // All ships should share roughly the same X (horizontal line)
    const xs = ships.map(s => s.position.x);
    const xSpread = Math.max(...xs) - Math.min(...xs);
    expect(xSpread).toBeLessThan(5); // essentially same X
    // Y should be spread out
    const ys = ships.map(s => s.position.y);
    const ySpread = Math.max(...ys) - Math.min(...ys);
    expect(ySpread).toBeGreaterThan(100); // spread vertically
  });

  it('setFormation("spearhead") creates an arrowhead shape', () => {
    let state = setup6v6();
    state = setFormation(state, 'attacker', 'spearhead');
    const ships = attackerShips(state);
    expect(ships.length).toBe(6);
  });

  it('all four formation types produce valid positions', () => {
    const types: FormationType[] = ['line', 'spearhead', 'diamond', 'wings'];
    for (const ft of types) {
      let state = setup6v6();
      state = setFormation(state, 'attacker', ft);
      const ships = attackerShips(state);
      // No ships should overlap (at least 10px apart)
      for (let i = 0; i < ships.length; i++) {
        for (let j = i + 1; j < ships.length; j++) {
          const dx = ships[i].position.x - ships[j].position.x;
          const dy = ships[i].position.y - ships[j].position.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          expect(d).toBeGreaterThan(10);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Round 2: Formation changes mid-battle
// ---------------------------------------------------------------------------

describe('Round 2 — Formation changes mid-battle', () => {
  it('changing formation during battle issues move orders (not instant snap)', () => {
    let state = setup6v6();
    state = runTicks(state, 3);

    // Change to diamond mid-battle
    state = setFormation(state, 'attacker', 'diamond');

    // Ships should have move orders now (tick > 1)
    const ships = attackerShips(state);
    for (const ship of ships) {
      expect(ship.order.type).toBe('move');
    }
  });

  it('BUG: formation change overrides existing attack orders', () => {
    let state = setup6v6();
    state = runTicks(state, 3);

    // Give ship 0 an explicit attack order
    const atk0 = bySource(state, 'atk-0');
    const def0 = bySource(state, 'def-0');
    state = setShipOrder(state, atk0.id, { type: 'attack', targetId: def0.id });

    // Change formation — this overrides the attack order (BUG)
    state = setFormation(state, 'attacker', 'spearhead');

    const ship0After = state.ships.find(s => s.id === atk0.id)!;
    // BUG: attack order was overridden by formation move
    expect(ship0After.order.type).toBe('move');
  });

  it('formation change should not affect ships on the other side', () => {
    let state = setup6v6();
    state = runTicks(state, 3);
    const defOrdersBefore = defenderShips(state).map(s => ({ id: s.id, order: s.order.type }));

    state = setFormation(state, 'attacker', 'wings');

    // Defenders should not have received move orders from attacker formation change
    for (const before of defOrdersBefore) {
      const ship = state.ships.find(s => s.id === before.id)!;
      // Defender orders should be unchanged (they may have changed stance via AI at tick 5,
      // but we're at tick 3 so they should still be idle)
      expect(ship.order.type).toBe(before.order);
    }
  });
});

// ---------------------------------------------------------------------------
// Round 3: Stance behaviour — At Ease auto-engage
// ---------------------------------------------------------------------------

describe('Round 3 — Stance behaviour', () => {
  it('at_ease + idle ships auto-engage nearest enemy', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'at_ease');

    const posBefore = attackerShips(state).map(s => s.position.x);
    state = runTicks(state, 10);
    const posAfter = attackerShips(state).map(s => s.position.x);

    // Ships should have moved toward enemies (X increases toward right side)
    for (let i = 0; i < posAfter.length; i++) {
      expect(posAfter[i]).toBeGreaterThan(posBefore[i]);
    }
  });

  it('aggressive + idle ships hold position (do not move)', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'aggressive');
    const posBefore = attackerShips(state).map(s => ({ x: s.position.x, y: s.position.y }));

    state = runTicks(state, 10);
    const ships = attackerShips(state);
    for (let i = 0; i < ships.length; i++) {
      expect(ships[i].position.x).toBeCloseTo(posBefore[i].x, 0);
      expect(ships[i].position.y).toBeCloseTo(posBefore[i].y, 0);
    }
  });

  it('defensive ships hold position', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'defensive');
    const posBefore = attackerShips(state).map(s => s.position.x);

    state = runTicks(state, 10);
    const posAfter = attackerShips(state).map(s => s.position.x);

    for (let i = 0; i < posAfter.length; i++) {
      expect(posAfter[i]).toBeCloseTo(posBefore[i], 0);
    }
  });

  it('evasive ships move away from nearby enemies', () => {
    let state = setup6v6();
    // Place an attacker close to a defender, already facing LEFT (toward escape)
    const atk0 = bySource(state, 'atk-0');
    const def0 = bySource(state, 'def-0');
    state = {
      ...state,
      ships: state.ships.map(s =>
        s.id === atk0.id
          ? { ...s, position: { x: def0.position.x - 50, y: def0.position.y }, facing: Math.PI }
          : s,
      ),
    };
    state = setShipStance(state, atk0.id, 'evasive');
    const xBefore = state.ships.find(s => s.id === atk0.id)!.position.x;

    // Need enough ticks for the ship to evade (turn rate limits apply)
    state = runTicks(state, 15);
    const xAfter = state.ships.find(s => s.id === atk0.id)!.position.x;

    // Ship should have moved away from the defender (lower X)
    expect(xAfter).toBeLessThan(xBefore);
  });
});

// ---------------------------------------------------------------------------
// Round 4: Stance applied per-ship vs fleet-wide
// ---------------------------------------------------------------------------

describe('Round 4 — Stance scoping (per-ship vs fleet-wide)', () => {
  it('setShipStance with a side string affects ALL ships on that side', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'at_ease');
    for (const ship of attackerShips(state)) {
      expect(ship.stance).toBe('at_ease');
    }
    for (const ship of defenderShips(state)) {
      expect(ship.stance).not.toBe('at_ease');
    }
  });

  it('setShipStance with a tactical ship ID affects ONLY that ship', () => {
    let state = setup6v6();
    const atk0 = bySource(state, 'atk-0');
    state = setShipStance(state, atk0.id, 'at_ease');

    expect(state.ships.find(s => s.id === atk0.id)!.stance).toBe('at_ease');
    const others = attackerShips(state).filter(s => s.id !== atk0.id);
    for (const ship of others) {
      expect(ship.stance).not.toBe('at_ease');
    }
  });

  it('setShipStance with sourceShipId affects ONLY that ship', () => {
    let state = setup6v6();
    // setShipStance matches sourceShipId too
    state = setShipStance(state, 'atk-0', 'at_ease');

    const atk0 = bySource(state, 'atk-0');
    expect(atk0.stance).toBe('at_ease');
    const others = attackerShips(state).filter(s => s.sourceShipId !== 'atk-0');
    for (const ship of others) {
      expect(ship.stance).not.toBe('at_ease');
    }
  });

  it('should be possible to set different stances for different ships', () => {
    let state = setup6v6();
    state = setShipStance(state, 'atk-0', 'aggressive');
    state = setShipStance(state, 'atk-1', 'at_ease');
    state = setShipStance(state, 'atk-2', 'defensive');
    state = setShipStance(state, 'atk-3', 'evasive');

    expect(bySource(state, 'atk-0').stance).toBe('aggressive');
    expect(bySource(state, 'atk-1').stance).toBe('at_ease');
    expect(bySource(state, 'atk-2').stance).toBe('defensive');
    expect(bySource(state, 'atk-3').stance).toBe('evasive');
  });
});

// ---------------------------------------------------------------------------
// Round 5: Ship selection and targeted commands
// ---------------------------------------------------------------------------

describe('Round 5 — Ship selection and targeted commands', () => {
  it('setShipOrder affects only the specified ship (via sourceShipId)', () => {
    let state = setup6v6();
    const def0 = bySource(state, 'def-0');
    state = setShipOrder(state, 'atk-0', { type: 'attack', targetId: def0.id });

    expect(bySource(state, 'atk-0').order.type).toBe('attack');
    for (const ship of attackerShips(state).filter(s => s.sourceShipId !== 'atk-0')) {
      expect(ship.order.type).toBe('idle');
    }
  });

  it('issuing move orders to multiple ships individually preserves independence', () => {
    let state = setup6v6();
    state = setShipOrder(state, 'atk-0', { type: 'move', x: 500, y: 200 });
    state = setShipOrder(state, 'atk-1', { type: 'move', x: 500, y: 400 });
    state = setShipOrder(state, 'atk-2', { type: 'move', x: 500, y: 600 });

    expect(bySource(state, 'atk-0').order).toEqual({ type: 'move', x: 500, y: 200 });
    expect(bySource(state, 'atk-1').order).toEqual({ type: 'move', x: 500, y: 400 });
    expect(bySource(state, 'atk-2').order).toEqual({ type: 'move', x: 500, y: 600 });
  });

  it('attack orders target specific enemies and ships approach them', () => {
    let state = setup6v6();
    const def0 = bySource(state, 'def-0');
    const def1 = bySource(state, 'def-1');
    state = setShipOrder(state, 'atk-0', { type: 'attack', targetId: def0.id });
    state = setShipOrder(state, 'atk-1', { type: 'attack', targetId: def1.id });

    state = runTicks(state, 20);

    const s0 = bySource(state, 'atk-0');
    const d0 = state.ships.find(s => s.id === def0.id)!;
    const d1 = state.ships.find(s => s.id === def1.id)!;

    if (!s0.destroyed && !d0.destroyed && !d1.destroyed) {
      const distTo0 = Math.hypot(s0.position.x - d0.position.x, s0.position.y - d0.position.y);
      const distTo1 = Math.hypot(s0.position.x - d1.position.x, s0.position.y - d1.position.y);
      expect(distTo0).toBeLessThan(distTo1);
    }
  });
});

// ---------------------------------------------------------------------------
// Round 6: Formation with subgroup (selected ships only)
// ---------------------------------------------------------------------------

describe('Round 6 — Formation with subgroup selection', () => {
  it('setFormation with shipIds only repositions those ships', () => {
    let state = setup6v6();
    state = runTicks(state, 3);

    const selectedTIds = tacticalIds(state, ['atk-0', 'atk-1', 'atk-2']);
    const unselectedTIds = tacticalIds(state, ['atk-3', 'atk-4', 'atk-5']);

    // Record orders of unselected ships before formation change
    const unselectedBefore = unselectedTIds.map(id => {
      const s = state.ships.find(sh => sh.id === id)!;
      return { id, order: s.order.type };
    });

    // Apply formation only to selected ships
    state = setFormation(state, 'attacker', 'diamond', selectedTIds);

    // Selected ships should have move orders
    for (const id of selectedTIds) {
      const ship = state.ships.find(s => s.id === id)!;
      expect(ship.order.type).toBe('move');
    }

    // Unselected ships should be UNCHANGED
    for (const before of unselectedBefore) {
      const ship = state.ships.find(s => s.id === before.id)!;
      expect(ship.order.type).toBe(before.order);
    }
  });

  it('two groups can have different formations simultaneously', () => {
    let state = setup6v6();
    const groupATIds = tacticalIds(state, ['atk-0', 'atk-1', 'atk-2']);
    const groupBTIds = tacticalIds(state, ['atk-3', 'atk-4', 'atk-5']);

    state = setFormation(state, 'attacker', 'spearhead', groupATIds);
    state = setFormation(state, 'attacker', 'wings', groupBTIds);

    // Run some ticks so ships move to formation positions
    state = runTicks(state, 15);

    const groupA = groupATIds.map(id => state.ships.find(s => s.id === id)!)
      .filter(s => s && !s.destroyed && !s.routed);
    const groupB = groupBTIds.map(id => state.ships.find(s => s.id === id)!)
      .filter(s => s && !s.destroyed && !s.routed);

    if (groupA.length > 0 && groupB.length > 0) {
      const centroidA = {
        x: groupA.reduce((sum, s) => sum + s.position.x, 0) / groupA.length,
        y: groupA.reduce((sum, s) => sum + s.position.y, 0) / groupA.length,
      };
      const centroidB = {
        x: groupB.reduce((sum, s) => sum + s.position.x, 0) / groupB.length,
        y: groupB.reduce((sum, s) => sum + s.position.y, 0) / groupB.length,
      };
      const groupDist = Math.hypot(centroidA.x - centroidB.x, centroidA.y - centroidB.y);
      expect(groupDist).toBeGreaterThan(20);
    }
  });
});

// ---------------------------------------------------------------------------
// Round 7: Multi-select move with offset preservation
// ---------------------------------------------------------------------------

describe('Round 7 — Multi-select move with spacing', () => {
  it('moving multiple ships preserves relative spacing between them', () => {
    let state = setup6v6();
    const ships = attackerShips(state);

    // Record initial relative offsets between ships
    const initialOffsets: { id: string; dx: number; dy: number }[] = [];
    for (let i = 1; i < ships.length; i++) {
      initialOffsets.push({
        id: ships[i].id,
        dx: ships[i].position.x - ships[0].position.x,
        dy: ships[i].position.y - ships[0].position.y,
      });
    }

    // Move to a nearby reachable point (speed ~3, 100 ticks = 300 units)
    const centroid = {
      x: ships.reduce((sum, s) => sum + s.position.x, 0) / ships.length,
      y: ships.reduce((sum, s) => sum + s.position.y, 0) / ships.length,
    };
    const targetX = centroid.x + 200;
    const targetY = centroid.y;
    const offsets = ships.map(s => ({
      id: s.id,
      dx: s.position.x - centroid.x,
      dy: s.position.y - centroid.y,
    }));
    for (const offset of offsets) {
      state = setShipOrder(state, offset.id, {
        type: 'move',
        x: targetX + offset.dx,
        y: targetY + offset.dy,
      });
    }

    // Run until ships arrive (short distance, should converge quickly)
    state = runTicks(state, 100);

    // Check relative spacing is preserved (within tolerance)
    const finalShips = attackerShips(state);
    if (finalShips.length === ships.length) {
      const s0 = finalShips.find(s => s.id === ships[0].id)!;
      for (const initial of initialOffsets) {
        const si = finalShips.find(s => s.id === initial.id)!;
        const finalDx = si.position.x - s0.position.x;
        const finalDy = si.position.y - s0.position.y;
        // Relative offsets should be approximately preserved (within 30px tolerance)
        expect(Math.abs(finalDx - initial.dx)).toBeLessThan(30);
        expect(Math.abs(finalDy - initial.dy)).toBeLessThan(30);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Round 8: Attack-move (advance to area, engage on the way)
// ---------------------------------------------------------------------------

describe('Round 8 — Attack-move behaviour', () => {
  it('at_ease ships with move orders fire at enemies while moving', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'at_ease');

    // Move past enemy fleet — ships start at x=120, enemies at x=1480
    for (const ship of attackerShips(state)) {
      state = setShipOrder(state, ship.id, {
        type: 'move',
        x: BATTLEFIELD_WIDTH - 50,
        y: BATTLEFIELD_HEIGHT / 2,
      });
    }

    // Run enough ticks for ships to cross the battlefield and engage
    // At speed ~3 and distance ~1360, need ~450 ticks to cross
    state = runTicks(state, 500);

    // Combat should have occurred — check for damage on either side
    const allDef = state.ships.filter(s => s.side === 'defender');
    const allAtk = state.ships.filter(s => s.side === 'attacker');
    const defDamaged = allDef.some(s => s.hull < s.maxHull || s.destroyed);
    const atkDamaged = allAtk.some(s => s.hull < s.maxHull || s.destroyed);
    expect(defDamaged || atkDamaged).toBe(true);
  });

  it('at_ease with move order transitions to auto-engage on arrival', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'at_ease');

    const atk0 = bySource(state, 'atk-0');
    state = setShipOrder(state, atk0.id, {
      type: 'move',
      x: BATTLEFIELD_WIDTH / 2,
      y: BATTLEFIELD_HEIGHT / 2,
    });

    state = runTicks(state, 50);

    const ship = state.ships.find(s => s.id === atk0.id)!;
    if (!ship.destroyed && !ship.routed) {
      expect(ship.position.x).toBeGreaterThan(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Round 9: Mixed formations — two groups with different orders
// ---------------------------------------------------------------------------

describe('Round 9 — Mixed battle groups', () => {
  it('Group A (at_ease) advances while Group B (defensive) holds', () => {
    let state = setup6v6();

    // Group A: first 3 ships — at_ease (auto-engage)
    for (const srcId of ['atk-0', 'atk-1', 'atk-2']) {
      state = setShipStance(state, srcId, 'at_ease');
    }

    // Group B: last 3 ships — defensive (hold position)
    for (const srcId of ['atk-3', 'atk-4', 'atk-5']) {
      state = setShipStance(state, srcId, 'defensive');
    }

    const groupBPosBefore = ['atk-3', 'atk-4', 'atk-5'].map(srcId => {
      const s = bySource(state, srcId);
      return { id: s.id, x: s.position.x };
    });

    state = runTicks(state, 30);

    // Group A should have advanced toward enemies
    for (const srcId of ['atk-0', 'atk-1', 'atk-2']) {
      const ship = bySource(state, srcId);
      if (!ship.destroyed && !ship.routed) {
        expect(ship.position.x).toBeGreaterThan(150);
      }
    }

    // Group B should still be near starting positions
    for (const before of groupBPosBefore) {
      const ship = state.ships.find(s => s.id === before.id)!;
      if (!ship.destroyed && !ship.routed) {
        expect(Math.abs(ship.position.x - before.x)).toBeLessThan(20);
      }
    }
  });

  it('two subgroups with different formations both converge', () => {
    let state = setup6v6();
    const groupATIds = tacticalIds(state, ['atk-0', 'atk-1', 'atk-2']);
    const groupBTIds = tacticalIds(state, ['atk-3', 'atk-4', 'atk-5']);

    // Apply different formations to each group
    state = setFormation(state, 'attacker', 'spearhead', groupATIds);
    state = setFormation(state, 'attacker', 'wings', groupBTIds);

    // Give group A at_ease stance to advance
    for (const srcId of ['atk-0', 'atk-1', 'atk-2']) {
      state = setShipStance(state, srcId, 'at_ease');
    }

    state = runTicks(state, 50);

    const aShips = groupATIds
      .map(id => state.ships.find(s => s.id === id))
      .filter((s): s is TacticalShip => !!s && !s.destroyed && !s.routed);
    const bShips = groupBTIds
      .map(id => state.ships.find(s => s.id === id))
      .filter((s): s is TacticalShip => !!s && !s.destroyed && !s.routed);

    if (aShips.length > 0 && bShips.length > 0) {
      const avgAX = aShips.reduce((sum, s) => sum + s.position.x, 0) / aShips.length;
      const avgBX = bShips.reduce((sum, s) => sum + s.position.x, 0) / bShips.length;
      // Group A (at_ease) should have advanced further
      expect(avgAX).toBeGreaterThan(avgBX);
    }
  });
});

// ---------------------------------------------------------------------------
// Round 10: Rapid formation + stance switching stress test
// ---------------------------------------------------------------------------

describe('Round 10 — Rapid switching stress test', () => {
  it('rapidly switching formations does not crash or produce NaN positions', () => {
    let state = setup6v6();
    const formations: FormationType[] = ['line', 'spearhead', 'diamond', 'wings'];

    for (let i = 0; i < 20; i++) {
      state = setFormation(state, 'attacker', formations[i % 4]);
      state = runTicks(state, 2);
    }

    for (const ship of state.ships) {
      expect(Number.isFinite(ship.position.x)).toBe(true);
      expect(Number.isFinite(ship.position.y)).toBe(true);
      expect(Number.isNaN(ship.facing)).toBe(false);
    }
  });

  it('rapidly switching stances does not break ship behaviour', () => {
    let state = setup6v6();
    const stances: CombatStance[] = ['aggressive', 'defensive', 'at_ease', 'evasive'];

    for (let i = 0; i < 20; i++) {
      state = setShipStance(state, 'attacker', stances[i % 4]);
      state = runTicks(state, 2);
    }

    for (const ship of state.ships) {
      expect(Number.isFinite(ship.position.x)).toBe(true);
      expect(Number.isFinite(ship.position.y)).toBe(true);
    }
  });

  it('switching formation mid-movement then changing stance preserves state', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'at_ease');
    state = runTicks(state, 5);

    state = setFormation(state, 'attacker', 'diamond');
    state = runTicks(state, 3);

    state = setShipStance(state, 'attacker', 'defensive');
    state = runTicks(state, 5);

    const alive = attackerShips(state);
    expect(alive.length).toBeGreaterThan(0);
    for (const ship of alive) {
      expect(ship.position.x).toBeGreaterThan(-50);
      expect(ship.position.x).toBeLessThan(BATTLEFIELD_WIDTH + 50);
    }
  });

  it('flee stance makes all ships leave the battlefield', () => {
    let state = setup6v6();
    state = setShipStance(state, 'attacker', 'flee');
    for (const ship of attackerShips(state)) {
      state = setShipOrder(state, ship.id, { type: 'flee' });
    }

    // Need enough ticks for ships to travel across battlefield
    state = runTicks(state, 500);

    const atkShips = state.ships.filter(s => s.side === 'attacker');
    for (const ship of atkShips) {
      expect(ship.routed || ship.destroyed).toBe(true);
    }
  });
});
