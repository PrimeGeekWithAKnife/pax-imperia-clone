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
  GROUND_UNIT_DEFINITIONS,
} from '../engine/ground-combat.js';
import type { GroundCombatState, GroundForce, GroundUnitType } from '../engine/ground-combat.js';
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

    it('creates core force types: infantry, tanks, artillery', () => {
      const state = initializeGroundCombat(
        'Test Planet', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('infantry')).toBe(true);
      expect(types.has('tanks')).toBe(true);
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

    it('initialises warCrimesCommitted to false without WMD techs', () => {
      const state = initializeGroundCombat(
        'Clean Battle', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      expect(state.warCrimesCommitted).toBe(false);
    });

    it('initialises persistentDamageEffects as empty array', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      expect(state.persistentDamageEffects).toEqual([]);
    });
  });

  describe('tech-based force composition', () => {
    it('adds mechanised infantry when modular_architecture is researched', () => {
      const techs = new Set(['modular_architecture']);
      const state = initializeGroundCombat(
        'Tech World', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('mechanised_infantry')).toBe(true);
    });

    it('adds robots when robotic_workforce is researched', () => {
      const techs = new Set(['robotic_workforce']);
      const state = initializeGroundCombat(
        'Robot World', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('robots')).toBe(true);
    });

    it('adds drones when nano_fabrication is researched', () => {
      const techs = new Set(['nano_fabrication']);
      const state = initializeGroundCombat(
        'Drone World', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('drones')).toBe(true);
    });

    it('adds mechs when gravity_generators is researched', () => {
      const techs = new Set(['gravity_generators']);
      const state = initializeGroundCombat(
        'Mech World', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('mechs')).toBe(true);
    });

    it('adds enhanced soldiers when cybernetic_enhancement is researched', () => {
      const techs = new Set(['cybernetic_enhancement']);
      const state = initializeGroundCombat(
        'Cyber World', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('enhanced_soldiers')).toBe(true);
    });

    it('adds EW units when electronic_warfare_suite is researched', () => {
      const techs = new Set(['electronic_warfare_suite']);
      const state = initializeGroundCombat(
        'EW World', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('electronic_warfare')).toBe(true);
    });

    it('adds multiple advanced unit types with multiple techs', () => {
      const techs = new Set([
        'modular_architecture', 'robotic_workforce', 'nano_fabrication',
        'gravity_generators', 'cybernetic_enhancement', 'electronic_warfare_suite',
      ]);
      const state = initializeGroundCombat(
        'Full Tech', 'terran', 10000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      const types = new Set(state.attackerForces.map(f => f.type));
      expect(types.has('infantry')).toBe(true);
      expect(types.has('tanks')).toBe(true);
      expect(types.has('artillery')).toBe(true);
      expect(types.has('mechanised_infantry')).toBe(true);
      expect(types.has('robots')).toBe(true);
      expect(types.has('drones')).toBe(true);
      expect(types.has('mechs')).toBe(true);
      expect(types.has('enhanced_soldiers')).toBe(true);
      expect(types.has('electronic_warfare')).toBe(true);
      // Total strength should still match
      expect(totalStrength(state.attackerForces)).toBe(10000);
    });

    it('preserves total troop strength regardless of tech composition', () => {
      const techs = new Set(['modular_architecture', 'robotic_workforce', 'nano_fabrication']);
      const state = initializeGroundCombat(
        'Troop Check', 'terran', 5000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      expect(totalStrength(state.attackerForces)).toBe(5000);
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
        { id: '2', side: 'attacker', empireId: 'e1', type: 'tanks', name: 'Tnk', strength: 50, maxStrength: 50, morale: 80, experience: 'regular' },
      ];
      expect(totalStrength(forces)).toBe(150);
    });

    it('averageMorale computes weighted average', () => {
      const forces: GroundForce[] = [
        { id: '1', side: 'attacker', empireId: 'e1', type: 'infantry', name: 'Inf', strength: 100, maxStrength: 100, morale: 80, experience: 'regular' },
        { id: '2', side: 'attacker', empireId: 'e1', type: 'tanks', name: 'Tnk', strength: 100, maxStrength: 100, morale: 60, experience: 'regular' },
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

  describe('GROUND_UNIT_DEFINITIONS', () => {
    it('defines all 19 unit types', () => {
      const expectedTypes: GroundUnitType[] = [
        'infantry', 'mechanised_infantry', 'tanks', 'artillery', 'air_support',
        'mechs', 'robots', 'drones', 'enhanced_soldiers', 'orbital_support',
        'electronic_warfare', 'saboteurs', 'burrowing_machines', 'unconventional_warfare',
        'chemical_weapons', 'radiation_weapons', 'engineered_virus', 'nanite_swarm', 'psionic_units',
      ];
      for (const t of expectedTypes) {
        expect(GROUND_UNIT_DEFINITIONS[t]).toBeDefined();
        expect(GROUND_UNIT_DEFINITIONS[t].name).toBeTruthy();
      }
      expect(Object.keys(GROUND_UNIT_DEFINITIONS)).toHaveLength(19);
    });

    it('all units have non-negative attack and defence power', () => {
      for (const [, def] of Object.entries(GROUND_UNIT_DEFINITIONS)) {
        expect(def.attackPower).toBeGreaterThanOrEqual(0);
        expect(def.defensePower).toBeGreaterThanOrEqual(0);
      }
    });

    it('robots and drones have zero morale factor', () => {
      expect(GROUND_UNIT_DEFINITIONS.robots.moraleFactor).toBe(0);
      expect(GROUND_UNIT_DEFINITIONS.drones.moraleFactor).toBe(0);
    });

    it('war crime units are flagged correctly', () => {
      expect(GROUND_UNIT_DEFINITIONS.chemical_weapons.warCrime).toBe(true);
      expect(GROUND_UNIT_DEFINITIONS.radiation_weapons.warCrime).toBe(true);
      expect(GROUND_UNIT_DEFINITIONS.engineered_virus.warCrime).toBe(true);
      expect(GROUND_UNIT_DEFINITIONS.infantry.warCrime).toBeUndefined();
      expect(GROUND_UNIT_DEFINITIONS.tanks.warCrime).toBeUndefined();
    });

    it('orbital support has the highest attack power', () => {
      const maxAttack = Math.max(...Object.values(GROUND_UNIT_DEFINITIONS)
        .filter(d => !d.warCrime)
        .map(d => d.attackPower));
      expect(GROUND_UNIT_DEFINITIONS.orbital_support.attackPower).toBe(maxAttack);
    });

    it('each unit with a required tech has it defined', () => {
      for (const [, def] of Object.entries(GROUND_UNIT_DEFINITIONS)) {
        if (def.requiredTech) {
          expect(typeof def.requiredTech).toBe('string');
          expect(def.requiredTech.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('special effects', () => {
    it('robots maintain morale at 100 throughout combat', () => {
      const techs = new Set(['robotic_workforce']);
      let state = initializeGroundCombat(
        'Robot Test', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      // Run several ticks
      for (let i = 0; i < 20; i++) {
        if (state.outcome === null) state = processGroundTick(state);
      }
      // Robot forces should still have 100 morale
      const robotForce = state.attackerForces.find(f => f.type === 'robots');
      if (robotForce && robotForce.strength > 0) {
        expect(robotForce.morale).toBe(100);
      }
    });

    it('EW units reduce enemy accuracy (enemy deals less damage)', () => {
      const noEW = initializeGroundCombat(
        'No EW', 'barren', 1000, 100000, [], 'regular', 'regular',
      );
      const withEW = initializeGroundCombat(
        'With EW', 'barren', 1000, 100000, [], 'regular', 'regular',
        'atk', 'def', new Set(['electronic_warfare_suite']),
      );

      let s1 = noEW;
      let s2 = withEW;
      for (let i = 0; i < 15; i++) {
        if (s1.outcome === null) s1 = processGroundTick(s1);
        if (s2.outcome === null) s2 = processGroundTick(s2);
      }

      // With EW, attacker should retain more strength (enemy deals less damage)
      const noEWAtkStr = totalStrength(s1.attackerForces);
      const withEWAtkStr = totalStrength(s2.attackerForces);
      expect(withEWAtkStr).toBeGreaterThan(noEWAtkStr);
    });

    it('combat with tech-enhanced forces still terminates', () => {
      const techs = new Set([
        'modular_architecture', 'robotic_workforce', 'nano_fabrication',
        'gravity_generators', 'cybernetic_enhancement', 'electronic_warfare_suite',
      ]);
      const state = initializeGroundCombat(
        'Full Tech Battle', 'terran', 2000, 100000, [], 'regular', 'regular',
        'atk', 'def', techs, techs,
      );
      const result = runUntilDone(state, 500);
      expect(result.outcome).not.toBeNull();
    });
  });

  describe('war crimes tracking', () => {
    it('warCrimesCommitted is false for conventional forces', () => {
      const state = initializeGroundCombat(
        'Clean', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      const result = runUntilDone(state);
      expect(result.warCrimesCommitted).toBe(false);
    });

    it('warCrimesCommitted defaults to false with basic techs', () => {
      const techs = new Set(['modular_architecture', 'robotic_workforce']);
      const state = initializeGroundCombat(
        'Tech Battle', 'terran', 1000, 50000, [], 'regular', 'green',
        'atk', 'def', techs,
      );
      expect(state.warCrimesCommitted).toBe(false);
    });
  });

  describe('fortification reduction by saboteurs', () => {
    it('saboteurs reduce fortification over time', () => {
      // We cannot directly inject saboteurs via the tech-based composition
      // (saboteurs are not auto-included in buildForceComposition), but we
      // can verify the fortification field changes by simulating a state
      // that includes saboteurs.
      const buildings: Building[] = [
        { id: 'dg1', type: 'defense_grid', level: 5 },
        { id: 'dg2', type: 'defense_grid', level: 5 },
      ];
      const state = initializeGroundCombat(
        'Saboteur Test', 'terran', 1000, 50000, buildings, 'regular', 'green',
      );

      // Manually inject a saboteur unit into attacker forces
      const modifiedState: GroundCombatState = {
        ...state,
        attackerForces: [
          ...state.attackerForces,
          {
            id: 'sab-1',
            side: 'attacker' as const,
            empireId: 'atk',
            type: 'saboteurs' as const,
            name: 'Saboteurs',
            strength: 100,
            maxStrength: 100,
            morale: 80,
            experience: 'regular' as const,
          },
        ],
      };

      const initialFort = modifiedState.defenderFortification;
      let s = modifiedState;
      for (let i = 0; i < 5; i++) {
        if (s.outcome === null) s = processGroundTick(s);
      }

      // Fortification should have been reduced
      expect(s.defenderFortification).toBeLessThan(initialFort);
      // Should reduce by 5 per tick for 5 ticks = 25 reduction
      expect(s.defenderFortification).toBe(Math.max(0, initialFort - 25));
    });
  });

  describe('persistent damage effects', () => {
    it('persistent damage effects array starts empty', () => {
      const state = initializeGroundCombat(
        'Test', 'terran', 1000, 50000, [], 'regular', 'green',
      );
      expect(state.persistentDamageEffects).toEqual([]);
    });
  });
});
