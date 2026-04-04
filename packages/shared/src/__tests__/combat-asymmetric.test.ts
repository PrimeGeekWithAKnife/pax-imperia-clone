/**
 * Asymmetric combat tests — same fleet composition, different tech ages.
 * Each ship is properly armed with 3 weapons + 1 shield + 1 engine (realistic loadout).
 */
import { describe, it, expect } from 'vitest';
import {
  initializeTacticalCombat,
  processTacticalTick,
} from '../engine/combat-tactical.js';
import type { Ship, ShipDesign, ShipComponent, Fleet, HullClass } from '../types/ships.js';
import COMPONENTS from '../../data/ships/components.json';

function makeShip(id: string, designId: string): Ship {
  return {
    id, designId, name: `Ship-${id}`,
    hullPoints: 100, maxHullPoints: 100,
    systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    position: { systemId: 's1' }, fleetId: 'f1',
  };
}

function makeDesign(id: string, hull: HullClass, compIds: string[]): ShipDesign {
  return {
    id, name: id, hull, empireId: 'e1', totalCost: 100,
    components: compIds.map((c, i) => ({ slotId: `s${i}`, componentId: c })),
    armourPlating: 0,
  };
}

function makeFleet(id: string, empireId: string, shipIds: string[]): Fleet {
  return {
    id, empireId, name: `Fleet-${id}`, ships: shipIds,
    position: { systemId: 's1' }, destination: null, waypoints: [], stance: 'aggressive',
  };
}

// Tech-age loadouts — 3 weapons + 1 shield + 1 engine each (properly armed)
const LOADOUTS: Record<string, { weapons: string[]; shield: string; engine: string; label: string }> = {
  nano_atomic: {
    weapons: ['pulse_laser', 'kinetic_cannon', 'basic_missile'],
    shield: 'deflector_shield',
    engine: 'fusion_reactor',
    label: 'Nano-Atomic',
  },
  fusion: {
    weapons: ['phased_array', 'mass_driver', 'guided_torpedo'],
    shield: 'shield_harmonics',
    engine: 'fusion_reactor',
    label: 'Fusion',
  },
  nano_fusion: {
    weapons: ['particle_beam_cannon', 'gauss_cannon', 'fusion_torpedo'],
    shield: 'neutronium_barrier',
    engine: 'fusion_reactor',
    label: 'Nano-Fusion',
  },
  anti_matter: {
    weapons: ['disruptor_beam', 'gauss_cannon', 'antimatter_torpedo'],
    shield: 'neutronium_barrier',
    engine: 'fusion_reactor',
    label: 'Anti-Matter',
  },
  singularity: {
    weapons: ['plasma_lance', 'gauss_cannon', 'singularity_torpedo'],
    shield: 'neutronium_barrier',
    engine: 'fusion_reactor',
    label: 'Singularity',
  },
};

function runAsymmetricBattle(
  ageA: string, ageB: string, hull: HullClass, countPerSide: number, maxTicks = 1500,
) {
  const loadoutA = LOADOUTS[ageA]!;
  const loadoutB = LOADOUTS[ageB]!;
  const compsA = [...loadoutA.weapons, loadoutA.shield, loadoutA.engine];
  const compsB = [...loadoutB.weapons, loadoutB.shield, loadoutB.engine];

  const attackerShips = Array.from({ length: countPerSide }, (_, i) => makeShip(`a${i}`, 'dA'));
  const defenderShips = Array.from({ length: countPerSide }, (_, i) => makeShip(`d${i}`, 'dB'));
  const designs = new Map<string, ShipDesign>([
    ['dA', makeDesign('dA', hull, compsA)],
    ['dB', makeDesign('dB', hull, compsB)],
  ]);

  let state = initializeTacticalCombat(
    makeFleet('f1', 'e1', attackerShips.map(s => s.id)),
    makeFleet('f2', 'e2', defenderShips.map(s => s.id)),
    attackerShips, defenderShips, designs,
    COMPONENTS as unknown as ShipComponent[],
  );

  while (!state.outcome && state.tick < maxTicks) {
    state = processTacticalTick(state);
  }

  const aAlive = state.ships.filter(s => s.side === 'attacker' && !s.destroyed && !s.routed).length;
  const dAlive = state.ships.filter(s => s.side === 'defender' && !s.destroyed && !s.routed).length;
  const aDestroyed = state.ships.filter(s => s.side === 'attacker' && s.destroyed).length;
  const dDestroyed = state.ships.filter(s => s.side === 'defender' && s.destroyed).length;
  const aRouted = state.ships.filter(s => s.side === 'attacker' && s.routed).length;
  const dRouted = state.ships.filter(s => s.side === 'defender' && s.routed).length;

  const result = {
    ticks: state.tick, outcome: state.outcome,
    aAlive, dAlive, aDestroyed, dDestroyed, aRouted, dRouted,
    winner: aAlive > 0 && dAlive === 0 ? loadoutA.label : dAlive > 0 && aAlive === 0 ? loadoutB.label : 'DRAW/TIMEOUT',
  };

  console.log(`    ${loadoutA.label} vs ${loadoutB.label} (${countPerSide}v${countPerSide} ${hull}):`);
  console.log(`      Duration: ${result.ticks} ticks | Winner: ${result.winner}`);
  console.log(`      ${loadoutA.label}: ${aAlive} alive, ${aDestroyed} destroyed, ${aRouted} routed`);
  console.log(`      ${loadoutB.label}: ${dAlive} alive, ${dDestroyed} destroyed, ${dRouted} routed`);

  return result;
}

describe('Asymmetric tech-age battles', () => {

  describe('Destroyer 3v3 — each age vs the next', () => {
    it('Nano-Atomic vs Fusion', () => {
      const r = runAsymmetricBattle('nano_atomic', 'fusion', 'destroyer', 3);
      // Fusion should win — better weapons and shields
      expect(r.ticks).toBeLessThanOrEqual(1500);
    });

    it('Fusion vs Nano-Fusion', () => {
      const r = runAsymmetricBattle('fusion', 'nano_fusion', 'destroyer', 3);
      expect(r.ticks).toBeLessThanOrEqual(1500);
    });

    it('Nano-Fusion vs Anti-Matter', () => {
      const r = runAsymmetricBattle('nano_fusion', 'anti_matter', 'destroyer', 3);
      expect(r.ticks).toBeLessThanOrEqual(1500);
    });

    it('Anti-Matter vs Singularity', () => {
      const r = runAsymmetricBattle('anti_matter', 'singularity', 'destroyer', 3);
      expect(r.ticks).toBeLessThanOrEqual(1500);
    });
  });

  describe('Cruiser 3v3 — age gap battles', () => {
    it('Nano-Atomic vs Nano-Fusion (2 age gap)', () => {
      const r = runAsymmetricBattle('nano_atomic', 'nano_fusion', 'light_cruiser', 3);
      expect(r.winner).not.toBe('DRAW/TIMEOUT');
      console.log(`      Expectation: Nano-Fusion should dominate`);
    });

    it('Fusion vs Singularity (3 age gap)', () => {
      const r = runAsymmetricBattle('fusion', 'singularity', 'light_cruiser', 3);
      expect(r.winner).not.toBe('DRAW/TIMEOUT');
      console.log(`      Expectation: Singularity should obliterate`);
    });

    it('Nano-Atomic vs Singularity (4 age gap — maximum)', () => {
      const r = runAsymmetricBattle('nano_atomic', 'singularity', 'light_cruiser', 3);
      expect(r.winner).not.toBe('DRAW/TIMEOUT');
      console.log(`      Expectation: Singularity should annihilate with no losses`);
    });
  });

  describe('Can numbers overcome tech?', () => {
    it('5 Nano-Atomic vs 3 Fusion', () => {
      const r = runAsymmetricBattle('nano_atomic', 'fusion', 'destroyer', 5);
      // Run as 5vX by using different counts
      const attackerShips = Array.from({ length: 5 }, (_, i) => makeShip(`a${i}`, 'dA'));
      const defenderShips = Array.from({ length: 3 }, (_, i) => makeShip(`d${i}`, 'dB'));
      const compsA = [...LOADOUTS.nano_atomic!.weapons, LOADOUTS.nano_atomic!.shield, LOADOUTS.nano_atomic!.engine];
      const compsB = [...LOADOUTS.fusion!.weapons, LOADOUTS.fusion!.shield, LOADOUTS.fusion!.engine];
      const designs = new Map<string, ShipDesign>([
        ['dA', makeDesign('dA', 'destroyer', compsA)],
        ['dB', makeDesign('dB', 'destroyer', compsB)],
      ]);

      let state = initializeTacticalCombat(
        makeFleet('f1', 'e1', attackerShips.map(s => s.id)),
        makeFleet('f2', 'e2', defenderShips.map(s => s.id)),
        attackerShips, defenderShips, designs,
        COMPONENTS as unknown as ShipComponent[],
      );

      while (!state.outcome && state.tick < 800) {
        state = processTacticalTick(state);
      }

      const aAlive = state.ships.filter(s => s.side === 'attacker' && !s.destroyed && !s.routed).length;
      const dAlive = state.ships.filter(s => s.side === 'defender' && !s.destroyed && !s.routed).length;
      console.log(`    5 Nano-Atomic vs 3 Fusion: ${state.tick} ticks`);
      console.log(`      Nano-Atomic: ${aAlive} alive | Fusion: ${dAlive} alive`);
      console.log(`      Can numbers beat tech? ${aAlive > 0 && dAlive === 0 ? 'YES' : dAlive > 0 && aAlive === 0 ? 'NO' : 'INCONCLUSIVE'}`);
    });

    it('8 Nano-Atomic vs 3 Nano-Fusion', () => {
      const attackerShips = Array.from({ length: 8 }, (_, i) => makeShip(`a${i}`, 'dA'));
      const defenderShips = Array.from({ length: 3 }, (_, i) => makeShip(`d${i}`, 'dB'));
      const compsA = [...LOADOUTS.nano_atomic!.weapons, LOADOUTS.nano_atomic!.shield, LOADOUTS.nano_atomic!.engine];
      const compsB = [...LOADOUTS.nano_fusion!.weapons, LOADOUTS.nano_fusion!.shield, LOADOUTS.nano_fusion!.engine];
      const designs = new Map<string, ShipDesign>([
        ['dA', makeDesign('dA', 'destroyer', compsA)],
        ['dB', makeDesign('dB', 'destroyer', compsB)],
      ]);

      let state = initializeTacticalCombat(
        makeFleet('f1', 'e1', attackerShips.map(s => s.id)),
        makeFleet('f2', 'e2', defenderShips.map(s => s.id)),
        attackerShips, defenderShips, designs,
        COMPONENTS as unknown as ShipComponent[],
      );

      while (!state.outcome && state.tick < 800) {
        state = processTacticalTick(state);
      }

      const aAlive = state.ships.filter(s => s.side === 'attacker' && !s.destroyed && !s.routed).length;
      const dAlive = state.ships.filter(s => s.side === 'defender' && !s.destroyed && !s.routed).length;
      console.log(`    8 Nano-Atomic vs 3 Nano-Fusion: ${state.tick} ticks`);
      console.log(`      Nano-Atomic: ${aAlive} alive | Nano-Fusion: ${dAlive} alive`);
      console.log(`      Can overwhelming numbers beat 2-age-gap tech? ${aAlive > 0 && dAlive === 0 ? 'YES' : dAlive > 0 && aAlive === 0 ? 'NO' : 'INCONCLUSIVE'}`);
    });
  });

  describe('Mirror matches — same tech, same count (baseline)', () => {
    it('3v3 Nano-Atomic mirror', () => {
      const r = runAsymmetricBattle('nano_atomic', 'nano_atomic', 'destroyer', 3);
      console.log(`      Mirror match — should be close/coin-flip`);
    });

    it('3v3 Fusion mirror', () => {
      const r = runAsymmetricBattle('fusion', 'fusion', 'destroyer', 3);
      console.log(`      Mirror match — should be close/coin-flip`);
    });

    it('3v3 Singularity mirror', () => {
      const r = runAsymmetricBattle('singularity', 'singularity', 'destroyer', 3);
      console.log(`      Mirror match — should be close/coin-flip`);
    });
  });
});
