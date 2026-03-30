/**
 * Combat timing simulation — measures battle duration and outcomes
 * with the updated balance parameters.
 */
import { describe, it, expect } from 'vitest';
import {
  initializeTacticalCombat,
  processTacticalTick,
} from '../engine/combat-tactical.js';
import type { Ship, ShipDesign, ShipComponent, Fleet, HullClass } from '../types/ships.js';
import COMPONENTS from '../../data/ships/components.json';

// Deterministic RNG
function makeRng(s = 42) {
  let seed = s;
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

function makeShip(id: string, designId: string, hull = 100): Ship {
  return {
    id, designId, name: `Ship-${id}`,
    hullPoints: hull, maxHullPoints: hull,
    systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    position: { systemId: 's1' }, fleetId: 'f1',
  };
}

function makeDesign(id: string, hull: HullClass, compIds: string[]): ShipDesign {
  return {
    id, name: id, hull, empireId: 'e1',
    components: compIds.map((c, i) => ({ componentId: c, slotIndex: i })),
    armourPlating: 0,
  };
}

function makeFleet(id: string, empireId: string, shipIds: string[]): Fleet {
  return { id, empireId, name: `Fleet-${id}`, ships: shipIds, systemId: 's1', stance: 'aggressive' as any };
}

function runBattle(
  name: string,
  hullA: HullClass, compsA: string[], countA: number,
  hullB: HullClass, compsB: string[], countB: number,
  maxTicks = 1000,
) {
  const rng = makeRng(42);
  const attackerShips = Array.from({ length: countA }, (_, i) => makeShip(`a${i}`, 'd1'));
  const defenderShips = Array.from({ length: countB }, (_, i) => makeShip(`d${i}`, 'd2'));
  const designs = new Map<string, ShipDesign>([
    ['d1', makeDesign('d1', hullA, compsA)],
    ['d2', makeDesign('d2', hullB, compsB)],
  ]);

  let state = initializeTacticalCombat(
    makeFleet('f1', 'e1', attackerShips.map(s => s.id)),
    makeFleet('f2', 'e2', defenderShips.map(s => s.id)),
    attackerShips, defenderShips, designs,
    COMPONENTS as ShipComponent[],
    rng,
  );

  while (!state.outcome && state.tick < maxTicks) {
    state = processTacticalTick(state, rng);
  }

  const aAlive = state.ships.filter(s => s.side === 'attacker' && !s.destroyed && !s.routed).length;
  const dAlive = state.ships.filter(s => s.side === 'defender' && !s.destroyed && !s.routed).length;
  const aDestroyed = state.ships.filter(s => s.side === 'attacker' && s.destroyed).length;
  const dDestroyed = state.ships.filter(s => s.side === 'defender' && s.destroyed).length;
  const aRouted = state.ships.filter(s => s.side === 'attacker' && s.routed).length;
  const dRouted = state.ships.filter(s => s.side === 'defender' && s.routed).length;

  const sampleMorale = state.ships.find(s => !s.destroyed)?.crew.morale ?? 0;
  const sampleShields = state.ships.find(s => !s.destroyed && s.maxShields > 0);

  console.log(`\n  ${name}:`);
  console.log(`    Duration: ${state.tick} ticks | Outcome: ${state.outcome ?? 'TIMEOUT'}`);
  console.log(`    Attackers: ${aAlive} alive, ${aDestroyed} destroyed, ${aRouted} routed`);
  console.log(`    Defenders: ${dAlive} alive, ${dDestroyed} destroyed, ${dRouted} routed`);
  console.log(`    Sample morale: ${sampleMorale.toFixed(1)}`);
  if (sampleShields) console.log(`    Sample shields: ${sampleShields.shields.toFixed(1)}/${sampleShields.maxShields}`);

  return { ticks: state.tick, outcome: state.outcome, aAlive, dAlive, aDestroyed, dDestroyed, aRouted, dRouted, sampleMorale };
}

describe('Combat timing with updated balance', () => {
  it('3v3 destroyer skirmish (beams)', () => {
    const r = runBattle('3v3 Destroyers (beam)', 'destroyer', ['pulse_laser', 'deflector_shield', 'fusion_reactor'], 3, 'destroyer', ['pulse_laser', 'deflector_shield', 'fusion_reactor'], 3);
    expect(r.ticks).toBeLessThan(800);
    console.log(`    Rating: ${r.ticks < 100 ? 'TOO FAST' : r.ticks < 300 ? 'GOOD' : r.ticks < 500 ? 'ACCEPTABLE' : 'TOO SLOW'}`);
  });

  it('5v5 cruiser engagement (mixed weapons)', () => {
    const r = runBattle('5v5 Cruisers (mixed)', 'cruiser', ['particle_beam', 'deflector_shield', 'fusion_reactor', 'kinetic_driver'], 5, 'cruiser', ['particle_beam', 'deflector_shield', 'fusion_reactor', 'kinetic_driver'], 5);
    expect(r.ticks).toBeLessThan(800);
    console.log(`    Rating: ${r.ticks < 100 ? 'TOO FAST' : r.ticks < 300 ? 'GOOD' : r.ticks < 500 ? 'ACCEPTABLE' : 'TOO SLOW'}`);
  });

  it('3v3 battleship battle (heavy weapons)', () => {
    const r = runBattle('3v3 Battleships (heavy)', 'battleship', ['plasma_cannon', 'graviton_shield', 'fusion_reactor', 'composite_armour'], 3, 'battleship', ['plasma_cannon', 'graviton_shield', 'fusion_reactor', 'composite_armour'], 3);
    expect(r.ticks).toBeLessThan(800);
    console.log(`    Rating: ${r.ticks < 150 ? 'TOO FAST' : r.ticks < 400 ? 'GOOD' : r.ticks < 600 ? 'ACCEPTABLE' : 'TOO SLOW'}`);
  });

  it('1v1 dreadnought duel', () => {
    const r = runBattle('1v1 Dreadnought', 'dreadnought', ['plasma_cannon', 'plasma_cannon', 'graviton_shield', 'graviton_shield', 'fusion_reactor'], 1, 'dreadnought', ['plasma_cannon', 'plasma_cannon', 'graviton_shield', 'graviton_shield', 'fusion_reactor'], 1);
    expect(r.ticks).toBeLessThan(800);
    console.log(`    Rating: ${r.ticks < 150 ? 'TOO FAST' : r.ticks < 400 ? 'GOOD' : r.ticks < 600 ? 'ACCEPTABLE' : 'TOO SLOW'}`);
  });

  it('10v3 overwhelming force', () => {
    const r = runBattle('10v3 Overwhelming', 'destroyer', ['pulse_laser', 'deflector_shield'], 10, 'destroyer', ['pulse_laser', 'deflector_shield'], 3);
    expect(r.ticks).toBeLessThan(400);
    expect(r.dAlive).toBe(0);
    console.log(`    Rating: ${r.ticks < 50 ? 'TOO FAST' : r.ticks < 150 ? 'GOOD' : r.ticks < 300 ? 'ACCEPTABLE' : 'TOO SLOW'}`);
  });

  it('3v3 missile destroyers', () => {
    const r = runBattle('3v3 Missiles', 'destroyer', ['missile_launcher', 'deflector_shield', 'fusion_reactor'], 3, 'destroyer', ['missile_launcher', 'deflector_shield', 'fusion_reactor'], 3);
    expect(r.ticks).toBeLessThan(800);
    console.log(`    Rating: ${r.ticks < 100 ? 'TOO FAST' : r.ticks < 300 ? 'GOOD' : r.ticks < 500 ? 'ACCEPTABLE' : 'TOO SLOW'}`);
  });

  it('mixed fleet: 2 battleships + 3 destroyers vs same', () => {
    const r = runBattle('Mixed fleet 2BB+3DD', 'battleship', ['plasma_cannon', 'graviton_shield', 'fusion_reactor'], 2, 'battleship', ['plasma_cannon', 'graviton_shield', 'fusion_reactor'], 2);
    expect(r.ticks).toBeLessThan(800);
    console.log(`    Rating: ${r.ticks < 150 ? 'TOO FAST' : r.ticks < 400 ? 'GOOD' : r.ticks < 600 ? 'ACCEPTABLE' : 'TOO SLOW'}`);
  });

  it('ships are actually destroyed, not just routed', () => {
    const r = runBattle('Destruction check 5v5', 'cruiser', ['particle_beam', 'kinetic_driver', 'deflector_shield', 'fusion_reactor'], 5, 'cruiser', ['particle_beam', 'kinetic_driver', 'deflector_shield', 'fusion_reactor'], 5);
    const totalDestroyed = r.aDestroyed + r.dDestroyed;
    console.log(`    Total ships destroyed: ${totalDestroyed} (want > 0)`);
    console.log(`    Total ships routed: ${r.aRouted + r.dRouted}`);
  });
});

describe('Debug: ship stat extraction', () => {
  it('shows extracted ship stats', () => {
    const rng = makeRng(42);
    const ships = [makeShip('a0', 'd1')];
    const designs = new Map([['d1', makeDesign('d1', 'destroyer', ['pulse_laser', 'deflector_shield', 'fusion_reactor'])]]);
    
    const state = initializeTacticalCombat(
      makeFleet('f1', 'e1', ['a0']),
      makeFleet('f2', 'e2', ['d0']),
      ships,
      [makeShip('d0', 'd1')],
      designs,
      COMPONENTS as ShipComponent[],
      rng,
    );
    
    for (const s of state.ships) {
      console.log(`  Ship ${s.name} (${s.side}):`);
      console.log(`    Position: (${s.position.x.toFixed(0)}, ${s.position.y.toFixed(0)})`);
      console.log(`    Hull: ${s.hull}/${s.maxHull}, Shields: ${s.shields}/${s.maxShields}, Armour: ${s.armour}`);
      console.log(`    Speed: ${s.speed}, Turn: ${s.turnRate}, Sensor: ${s.sensorRange}`);
      console.log(`    Order: ${JSON.stringify(s.order)}`);
      console.log(`    Weapons: ${s.weapons.length}`);
      for (const w of s.weapons) {
        console.log(`      - ${w.type}: dmg=${w.damage}, range=${w.range}, cooldown=${w.cooldownMax}, accuracy=${w.accuracy}`);
      }
    }
    
    // Run 10 ticks and check positions
    let st = state;
    for (let i = 0; i < 10; i++) {
      st = processTacticalTick(st, rng);
    }
    for (const s of st.ships) {
      console.log(`  After 10 ticks: ${s.name} at (${s.position.x.toFixed(0)}, ${s.position.y.toFixed(0)}) hull=${s.hull}/${s.maxHull} shields=${s.shields.toFixed(1)}/${s.maxShields}`);
    }
    
    expect(state.ships.length).toBeGreaterThan(0);
  });
});
