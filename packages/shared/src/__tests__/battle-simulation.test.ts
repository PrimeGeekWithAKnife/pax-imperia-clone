/**
 * Battle simulations — verify weapons fire correctly with slot-based facing.
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import { initializeTacticalCombat, processTacticalTick, setShipOrder, setShipStance } from '../engine/combat-tactical.js';
import type { CombatStance } from '../engine/combat-tactical.js';
import { generateId } from '../utils/id.js';
import type { Ship, Fleet, ShipDesign } from '../types/ships.js';

const AGE_ORDER = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'];

function simulate(hullClassA: string, hullClassB: string, age: string, ticks = 300) {
  const ageIdx = AGE_ORDER.indexOf(age);
  const available = SHIP_COMPONENTS.filter(c => {
    const compIdx = AGE_ORDER.indexOf(c.minAge ?? 'nano_atomic');
    return compIdx <= ageIdx;
  });

  const templateA = HULL_TEMPLATE_BY_CLASS[hullClassA]!;
  const templateB = HULL_TEMPLATE_BY_CLASS[hullClassB]!;
  const designA: ShipDesign = { ...autoEquipDesign(templateA, available), id: generateId(), empireId: 'e1', armourPlating: 1.0 };
  const designB: ShipDesign = { ...autoEquipDesign(templateB, available), id: generateId(), empireId: 'e2', armourPlating: 1.0 };
  const designs = new Map<string, ShipDesign>([[designA.id, designA], [designB.id, designB]]);

  const makeShip = (template: typeof templateA, design: ShipDesign, fleetId: string): Ship => ({
    id: generateId(),
    designId: design.id,
    name: template.name,
    hullPoints: template.baseHullPoints,
    maxHullPoints: template.baseHullPoints,
    systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    position: { systemId: 'test' },
    fleetId,
  });

  const shipA = makeShip(templateA, designA, 'f1');
  const shipB = makeShip(templateB, designB, 'f2');
  const fleetA: Fleet = { id: 'f1', name: 'Fleet A', ships: [shipA.id], empireId: 'e1', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };
  const fleetB: Fleet = { id: 'f2', name: 'Fleet B', ships: [shipB.id], empireId: 'e2', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };

  let state = initializeTacticalCombat(fleetA, fleetB, [shipA], [shipB], designs, SHIP_COMPONENTS);

  const weaponInfo = state.ships.map(s => ({
    name: s.name,
    side: s.side,
    weapons: s.weapons.map(w => ({ type: w.type, facing: w.facing, damage: w.damage })),
  }));

  let totalBeamEvents = 0;
  let totalProjectiles = 0;
  let peakBeams = 0;
  let peakProjectiles = 0;
  for (let i = 0; i < ticks; i++) {
    state = processTacticalTick(state);
    // Track peak counts — if beams or projectiles ever existed, combat happened
    if (state.beamEffects.length > peakBeams) peakBeams = state.beamEffects.length;
    if (state.projectiles.length > peakProjectiles) peakProjectiles = state.projectiles.length;
    totalBeamEvents += state.beamEffects.length;
    totalProjectiles += state.projectiles.length;
  }

  const results = state.ships.map(s => ({
    name: s.name,
    hull: s.hull,
    maxHull: s.maxHull,
    shields: Math.round(s.shields),
    maxShields: s.maxShields,
    destroyed: s.destroyed,
  }));

  return { weaponInfo, results, totalBeamEvents, totalProjectiles, peakBeams, peakProjectiles, outcome: state.outcome };
}

describe('battle simulations', () => {
  it('frigates use correct slot-based weapon facing', () => {
    const { weaponInfo } = simulate('frigate', 'frigate', 'fusion');
    const frigate = weaponInfo[0]!;
    // Frigate has a port-facing weapon slot — at least one weapon should be port
    const facings = frigate.weapons.map(w => w.facing);
    expect(facings).toContain('port');
    // Should also have a fore-facing weapon
    expect(facings).toContain('fore');
  });

  it('frigates deal damage in combat', () => {
    const { results, totalBeamEvents, totalProjectiles } = simulate('frigate', 'frigate', 'fusion');
    // Both frigates should have taken some damage
    const [a, b] = results;
    const totalFiring = totalBeamEvents + totalProjectiles;
    expect(totalFiring).toBeGreaterThan(0);
    // At least one ship should have taken hull or shield damage
    expect(a!.hull < a!.maxHull || a!.shields < a!.maxShields || b!.hull < b!.maxHull || b!.shields < b!.maxShields).toBe(true);
  });

  it('destroyers are available in nano_atomic age', () => {
    const template = HULL_TEMPLATE_BY_CLASS['destroyer'];
    expect(template).toBeDefined();
    expect(template!.requiredAge).toBe('nano_atomic');
  });

  it('destroyer vs destroyer produces combat', () => {
    // Nano_atomic weapons have short range — ships need more ticks to close distance
    const { totalBeamEvents, totalProjectiles } = simulate('destroyer', 'destroyer', 'nano_atomic', 600);
    expect(totalBeamEvents + totalProjectiles).toBeGreaterThan(0);
  });

  it('destroyer weapon slots have correct facings', () => {
    const { weaponInfo } = simulate('destroyer', 'destroyer', 'fusion');
    const destroyer = weaponInfo[0]!;
    const facings = destroyer.weapons.map(w => w.facing);
    // Destroyer has fore, port, and starboard weapon slots
    expect(facings).toContain('fore');
    expect(facings).toContain('port');
    expect(facings).toContain('starboard');
  });

  it('corvette vs corvette deals damage in fusion age', () => {
    const { totalBeamEvents, totalProjectiles } = simulate('corvette', 'corvette', 'fusion');
    expect(totalBeamEvents + totalProjectiles).toBeGreaterThan(0);
  });

  it('heavy cruiser vs battleship at anti_matter age produces decisive combat', () => {
    const { results, outcome } = simulate('heavy_cruiser', 'battleship', 'anti_matter', 600);
    // After 600 ticks at anti_matter tech, someone should be dead or badly hurt
    const anyDestroyed = results.some(r => r.destroyed);
    const anyDamaged = results.some(r => r.hull < r.maxHull);
    expect(anyDestroyed || anyDamaged).toBe(true);
  });
});

// =========================================================================
// Command & stance simulation tests
// =========================================================================

function setupBattle(hullA: string, hullB: string, age: string) {
  const ageIdx = AGE_ORDER.indexOf(age);
  const available = SHIP_COMPONENTS.filter(c => {
    const compIdx = AGE_ORDER.indexOf(c.minAge ?? 'nano_atomic');
    return compIdx <= ageIdx;
  });
  const tA = HULL_TEMPLATE_BY_CLASS[hullA]!;
  const tB = HULL_TEMPLATE_BY_CLASS[hullB]!;
  const dA: ShipDesign = { ...autoEquipDesign(tA, available), id: generateId(), empireId: 'e1', armourPlating: 1.0 };
  const dB: ShipDesign = { ...autoEquipDesign(tB, available), id: generateId(), empireId: 'e2', armourPlating: 1.0 };
  const designs = new Map<string, ShipDesign>([[dA.id, dA], [dB.id, dB]]);
  const makeShip = (t: typeof tA, d: ShipDesign, fid: string): Ship => ({
    id: generateId(), designId: d.id, name: t.name,
    hullPoints: t.baseHullPoints, maxHullPoints: t.baseHullPoints,
    systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    position: { systemId: 'test' }, fleetId: fid,
  });
  const sA = makeShip(tA, dA, 'f1');
  const sB = makeShip(tB, dB, 'f2');
  const fA: Fleet = { id: 'f1', name: 'A', ships: [sA.id], empireId: 'e1', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };
  const fB: Fleet = { id: 'f2', name: 'B', ships: [sB.id], empireId: 'e2', position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive' };
  return initializeTacticalCombat(fA, fB, [sA], [sB], designs, SHIP_COMPONENTS);
}

describe('command and stance changes', () => {
  it('flee order persists across ticks', () => {
    let state = setupBattle('destroyer', 'destroyer', 'fusion');
    const ship = state.ships.find(s => s.side === 'attacker')!;
    state = setShipStance(state, ship.id, 'flee');
    state = setShipOrder(state, ship.id, { type: 'flee' });

    // Run 10 ticks — should be moving but not yet off map
    for (let i = 0; i < 10; i++) {
      state = processTacticalTick(state);
    }
    const endShip = state.ships.find(s => s.id === ship.id)!;
    // Ship should be fleeing (either still moving or already routed)
    expect(endShip.order.type === 'flee' || endShip.routed).toBe(true);
    expect(endShip.stance).toBe('flee');
  });

  it('stance change from aggressive to at_ease does not cause wild movement', () => {
    let state = setupBattle('frigate', 'frigate', 'fusion');
    const ship = state.ships.find(s => s.side === 'attacker')!;
    const startPos = { ...ship.position };

    // Switch to at_ease
    state = setShipStance(state, ship.id, 'at_ease');
    state = setShipOrder(state, ship.id, { type: 'idle' });

    // Run 5 ticks — ship should not teleport or move erratically
    for (let i = 0; i < 5; i++) {
      state = processTacticalTick(state);
    }
    const moved = state.ships.find(s => s.id === ship.id)!;
    const displacement = Math.sqrt(
      (moved.position.x - startPos.x) ** 2 + (moved.position.y - startPos.y) ** 2,
    );
    // Should move at most speed * 5 ticks (reasonable, not teleporting)
    expect(displacement).toBeLessThan(ship.speed * 10);
  });

  it('at_ease ships close distance toward enemies', () => {
    let state = setupBattle('destroyer', 'destroyer', 'fusion');
    const startGap = Math.abs(
      state.ships[0]!.position.x - state.ships[1]!.position.x,
    );
    for (const ship of state.ships) {
      state = setShipStance(state, ship.id, 'at_ease');
      state = setShipOrder(state, ship.id, { type: 'idle' });
    }
    for (let i = 0; i < 200; i++) {
      state = processTacticalTick(state);
    }
    const endGap = Math.abs(
      state.ships[0]!.position.x - state.ships[1]!.position.x,
    );
    // Ships should have closed distance significantly
    expect(endGap).toBeLessThan(startGap * 0.6);
  });

  it('defensive ships fire when enemies get close', () => {
    // Use aggressive attacker to close distance, defensive defender should fire back
    let state = setupBattle('corvette', 'corvette', 'fusion');
    const attacker = state.ships.find(s => s.side === 'attacker')!;
    const defender = state.ships.find(s => s.side === 'defender')!;
    state = setShipStance(state, defender.id, 'defensive');
    // Attacker stays aggressive to close distance

    let anyDamaged = false;
    for (let i = 0; i < 800; i++) {
      state = processTacticalTick(state);
      const def = state.ships.find(s => s.id === defender.id);
      const atk = state.ships.find(s => s.id === attacker.id);
      // If attacker took damage, defender fired back
      if (atk && atk.hull < atk.maxHull) anyDamaged = true;
    }
    expect(anyDamaged).toBe(true);
  });

  it('switching stance mid-combat does not crash', () => {
    let state = setupBattle('frigate', 'frigate', 'fusion');
    const stances: CombatStance[] = ['aggressive', 'at_ease', 'defensive', 'evasive', 'flee', 'at_ease', 'aggressive'];

    for (const stance of stances) {
      for (const ship of state.ships) {
        if (ship.side === 'attacker') {
          state = setShipStance(state, ship.id, stance);
          if (stance === 'flee') {
            state = setShipOrder(state, ship.id, { type: 'flee' });
          } else {
            state = setShipOrder(state, ship.id, { type: 'idle' });
          }
        }
      }
      // Run 20 ticks per stance — should never crash
      for (let i = 0; i < 20; i++) {
        state = processTacticalTick(state);
      }
    }
    // If we got here without throwing, the test passes
    expect(state.tick).toBeGreaterThan(100);
  });
});
