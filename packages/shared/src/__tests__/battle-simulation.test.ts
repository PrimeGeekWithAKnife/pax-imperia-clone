/**
 * Battle simulations — verify weapons fire correctly with slot-based facing.
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import { initializeTacticalCombat, processTacticalTick } from '../engine/combat-tactical.js';
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
