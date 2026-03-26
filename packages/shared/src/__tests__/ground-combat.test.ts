import { describe, it, expect } from 'vitest';

import {
  initializeGroundCombat,
  processGroundTick,
  totalStrength,
  averageMorale,
  calculateTransportCapacity,
  MORALE_COLLAPSE_THRESHOLD,
  TERRAIN_BONUS,
  EXPERIENCE_MULTIPLIER,
  TRANSPORT_CAPACITY,
  MILITIA_PER_POPULATION,
} from '../engine/ground-combat.js';
import type { GroundCombatState, GroundForce } from '../engine/ground-combat.js';
import type { Building } from '../types/galaxy.js';
import type { HullClass } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runUntilDone(state: GroundCombatState, maxTicks = 500): GroundCombatState {
  let s = state;
  while (s.outcome === null && s.tick < maxTicks) {
    s = processGroundTick(s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Ground combat engine', () => {
  describe('initializeGroundCombat', () => {
    it('creates attacker forces from troop count', () => {
      const state = initializeGroundCombat(
        'Terra Nova', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      expect(state.attackerForces.length).toBeGreaterThan(0);
      const atkStr = totalStrength(state.attackerForces);
      expect(atkStr).toBe(1000);
    });

    it('creates defender forces from population + buildings', () => {
      const buildings: Building[] = [
        { id: 'dg1', type: 'defense_grid', level: 2 },
        { id: 'ma1', type: 'military_academy', level: 1 },
      ];
      const state = initializeGroundCombat(
        'Fortified World', 'desert', 500, 100000, buildings, 'regular', 'regular',
      );
      // Militia: 100000 * 0.01 = 1000
      // Garrison: defense_grid lvl2 = 100, academy lvl1 = 30 => 130
      // Total: 1130
      const defStr = totalStrength(state.defenderForces);
      expect(defStr).toBe(1130);
    });

    it('creates three force types: infantry, armour, artillery', () => {
      const state = initializeGroundCombat(
        'Test Planet', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('infantry')).toBe(true);
      expect(types.has('armour')).toBe(true);
      expect(types.has('artillery')).toBe(true);
    });

    it('sets initial log entries', () => {
      const state = initializeGroundCombat(
        'Eden', 'terran', 500, 20000, [], 'regular', 'green',
      );
      expect(state.log.length).toBeGreaterThanOrEqual(3);
      expect(state.log[0]).toContain('Eden');
    });

    it('calculates fortification from buildings', () => {
      const buildings: Building[] = [
        { id: 'dg1', type: 'defense_grid', level: 5 },
        { id: 'dg2', type: 'defense_grid', level: 5 },
        { id: 'ma1', type: 'military_academy', level: 3 },
      ];
      const state = initializeGroundCombat(
        'Fortress', 'terran', 500, 10000, buildings, 'regular', 'regular',
      );
      // defense_grid: 5*5 + 5*5 = 50, academy: 3*3 = 9 => 59
      expect(state.defenderFortification).toBe(59);
    });

    it('caps fortification at 100', () => {
      const buildings: Building[] = [
        { id: 'dg1', type: 'defense_grid', level: 10 },
        { id: 'dg2', type: 'defense_grid', level: 10 },
        { id: 'dg3', type: 'defense_grid', level: 10 },
      ];
      const state = initializeGroundCombat(
        'Mega Fort', 'terran', 500, 10000, buildings, 'regular', 'regular',
      );
      expect(state.defenderFortification).toBe(100);
    });

    it('handles zero attacker troops gracefully', () => {
      const state = initializeGroundCombat(
        'Empty', 'barren', 0, 10000, [], 'regular', 'green',
      );
      // At minimum 1 troop
      expect(totalStrength(state.attackerForces)).toBeGreaterThanOrEqual(1);
    });

    it('stores empire IDs', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 100, 10000, [], 'regular', 'green', 'emp-a', 'emp-d',
      );
      expect(state.attackerEmpireId).toBe('emp-a');
      expect(state.defenderEmpireId).toBe('emp-d');
    });
  });

  describe('processGroundTick', () => {
    it('advances tick counter', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 500, 50000, [], 'regular', 'green',
      );
      const next = processGroundTick(state);
      expect(next.tick).toBe(1);
    });

    it('applies damage to both sides', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      const initialAtkStr = totalStrength(state.attackerForces);
      const initialDefStr = totalStrength(state.defenderForces);

      const next = processGroundTick(state);
      expect(totalStrength(next.attackerForces)).toBeLessThan(initialAtkStr);
      expect(totalStrength(next.defenderForces)).toBeLessThan(initialDefStr);
    });

    it('does not modify original state (immutability)', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      const originalStr = totalStrength(state.attackerForces);
      processGroundTick(state);
      expect(totalStrength(state.attackerForces)).toBe(originalStr);
    });

    it('returns same state if outcome already decided', () => {
      let state = initializeGroundCombat(
        'Test', 'terran', 10000, 100, [], 'elite', 'green',
      );
      state = runUntilDone(state);
      expect(state.outcome).not.toBeNull();
      const sameTick = state.tick;
      const next = processGroundTick(state);
      expect(next.tick).toBe(sameTick);
    });

    it('morale drops from losses', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      const initialMorale = averageMorale(state.defenderForces);

      // Run several ticks
      let s = state;
      for (let i = 0; i < 10; i++) s = processGroundTick(s);

      // Morale should have changed (likely dropped for both sides)
      const laterMorale = averageMorale(s.defenderForces);
      expect(laterMorale).not.toBe(initialMorale);
    });
  });

  describe('combat outcome', () => {
    it('attacker wins with overwhelming force', () => {
      const state = initializeGroundCombat(
        'Weak Planet', 'barren', 10000, 1000, [], 'elite', 'green',
      );
      const result = runUntilDone(state);
      expect(result.outcome).toBe('attacker_wins');
    });

    it('defender wins with overwhelming fortification and numbers', () => {
      const buildings: Building[] = [
        { id: 'dg1', type: 'defense_grid', level: 10 },
        { id: 'dg2', type: 'defense_grid', level: 10 },
        { id: 'ma1', type: 'military_academy', level: 10 },
      ];
      const state = initializeGroundCombat(
        'Fortress', 'volcanic', 100, 500000, buildings, 'green', 'elite',
      );
      const result = runUntilDone(state);
      expect(result.outcome).toBe('defender_wins');
    });

    it('fortification bonus helps defender', () => {
      // Same troops, but one has fortifications
      const noFort = initializeGroundCombat(
        'Flat', 'barren', 500, 50000, [], 'regular', 'regular',
      );
      const buildings: Building[] = [
        { id: 'dg1', type: 'defense_grid', level: 5 },
        { id: 'dg2', type: 'defense_grid', level: 5 },
      ];
      const withFort = initializeGroundCombat(
        'Fort', 'barren', 500, 50000, buildings, 'regular', 'regular',
      );

      // Run both 20 ticks
      let s1 = noFort;
      let s2 = withFort;
      for (let i = 0; i < 20; i++) {
        if (s1.outcome === null) s1 = processGroundTick(s1);
        if (s2.outcome === null) s2 = processGroundTick(s2);
      }

      // In the fortified scenario, attacker should have taken more damage
      // (or defender should have taken less)
      const noFortDefStr = totalStrength(s1.defenderForces);
      const withFortDefStr = totalStrength(s2.defenderForces);
      // Fortified defender should have more strength remaining
      // (also has more garrison troops, making it doubly advantageous)
      expect(withFortDefStr).toBeGreaterThan(noFortDefStr);
    });

    it('terrain bonus helps defender on harsh worlds', () => {
      // Volcanic gives +40% bonus vs barren +10%
      const easyTerrain = initializeGroundCombat(
        'Barren', 'barren', 500, 50000, [], 'regular', 'regular',
      );
      const hardTerrain = initializeGroundCombat(
        'Volcano', 'volcanic', 500, 50000, [], 'regular', 'regular',
      );

      let s1 = easyTerrain;
      let s2 = hardTerrain;
      for (let i = 0; i < 20; i++) {
        if (s1.outcome === null) s1 = processGroundTick(s1);
        if (s2.outcome === null) s2 = processGroundTick(s2);
      }

      // On harsh terrain, attacker takes relatively more damage
      const easyAtkStr = totalStrength(s1.attackerForces);
      const hardAtkStr = totalStrength(s2.attackerForces);
      expect(hardAtkStr).toBeLessThan(easyAtkStr);
    });

    it('combat always terminates within 500 ticks', () => {
      const state = initializeGroundCombat(
        'Long Battle', 'terran', 1000, 100000, [], 'regular', 'regular',
      );
      const result = runUntilDone(state, 500);
      expect(result.outcome).not.toBeNull();
    });

    it('log grows as battle progresses', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      const result = runUntilDone(state);
      expect(result.log.length).toBeGreaterThan(state.log.length);
    });
  });

  describe('transport capacity', () => {
    it('calculates troop count from hull classes', () => {
      const hulls: HullClass[] = ['scout', 'destroyer', 'transport', 'cruiser'];
      const capacity = calculateTransportCapacity(hulls);
      expect(capacity).toBe(10 + 50 + 500 + 200);
    });

    it('handles empty fleet', () => {
      expect(calculateTransportCapacity([])).toBe(0);
    });

    it('deep space probes carry no troops', () => {
      expect(calculateTransportCapacity(['deep_space_probe'])).toBe(0);
    });

    it('transport has the highest capacity', () => {
      expect(TRANSPORT_CAPACITY['transport']).toBeGreaterThan(TRANSPORT_CAPACITY['battleship']);
      expect(TRANSPORT_CAPACITY['transport']).toBeGreaterThan(TRANSPORT_CAPACITY['carrier']);
    });
  });

  describe('helper functions', () => {
    it('totalStrength sums force strength', () => {
      const forces: GroundForce[] = [
        { id: '1', side: 'attacker', empireId: 'e1', type: 'infantry', name: 'Inf', strength: 100, maxStrength: 100, morale: 80, experience: 'regular' },
        { id: '2', side: 'attacker', empireId: 'e1', type: 'armour', name: 'Arm', strength: 50, maxStrength: 50, morale: 80, experience: 'regular' },
      ];
      expect(totalStrength(forces)).toBe(150);
    });

    it('averageMorale computes weighted average', () => {
      const forces: GroundForce[] = [
        { id: '1', side: 'attacker', empireId: 'e1', type: 'infantry', name: 'Inf', strength: 100, maxStrength: 100, morale: 80, experience: 'regular' },
        { id: '2', side: 'attacker', empireId: 'e1', type: 'armour', name: 'Arm', strength: 100, maxStrength: 100, morale: 60, experience: 'regular' },
      ];
      expect(averageMorale(forces)).toBe(70);
    });

    it('averageMorale returns 0 for empty forces', () => {
      expect(averageMorale([])).toBe(0);
    });

    it('experience multipliers are ordered correctly', () => {
      expect(EXPERIENCE_MULTIPLIER['green']).toBeLessThan(EXPERIENCE_MULTIPLIER['regular']);
      expect(EXPERIENCE_MULTIPLIER['regular']).toBeLessThan(EXPERIENCE_MULTIPLIER['veteran']);
      expect(EXPERIENCE_MULTIPLIER['veteran']).toBeLessThan(EXPERIENCE_MULTIPLIER['elite']);
    });

    it('terrain bonuses exist for all common planet types', () => {
      const types = ['terran', 'ocean', 'desert', 'ice', 'volcanic', 'barren', 'toxic'];
      for (const t of types) {
        expect(TERRAIN_BONUS[t]).toBeDefined();
        expect(TERRAIN_BONUS[t]).toBeGreaterThan(0);
      }
    });

    it('morale collapse threshold is reasonable', () => {
      expect(MORALE_COLLAPSE_THRESHOLD).toBe(10);
    });
  });
});
