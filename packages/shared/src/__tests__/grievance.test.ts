import { describe, it, expect } from 'vitest';
import {
  createGrievance,
  processGrievanceTick,
  calculateCasusBelli,
  fabricateGrievance,
  GRIEVANCE_DECAY_RATES,
  GRIEVANCE_DEFAULT_VALUES,
  CASUS_BELLI_THRESHOLD,
  GOVERNMENT_CASUS_BELLI_MODIFIERS,
} from '../engine/grievance.js';
import type { Grievance, GrievanceSeverity } from '../types/diplomacy.js';

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------

function makeRng(initialSeed = 42) {
  let seed = initialSeed;
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGrievance(
  severity: GrievanceSeverity,
  overrides: Partial<Grievance> = {},
): Grievance {
  return {
    id: `grievance_${severity}`,
    tick: 0,
    severity,
    description: `A ${severity} grievance`,
    initialValue: GRIEVANCE_DEFAULT_VALUES[severity],
    currentValue: GRIEVANCE_DEFAULT_VALUES[severity],
    decayRate: GRIEVANCE_DECAY_RATES[severity],
    perpetratorEmpireId: 'emp_aggressor',
    victimEmpireId: 'emp_victim',
    witnesses: ['emp_victim'],
    evidenceStrength: 100,
    fabricated: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Grievance system', () => {

  // ── createGrievance ──────────────────────────────────────────────────────

  describe('createGrievance', () => {
    it('sets correct decay rates by severity', () => {
      const severities: GrievanceSeverity[] = ['slight', 'offence', 'major', 'existential'];

      for (const severity of severities) {
        const grievance = createGrievance(
          'emp_a', 'emp_b', severity, `Test ${severity}`, ['emp_b'], 10,
        );

        expect(grievance.decayRate).toBe(GRIEVANCE_DECAY_RATES[severity]);
        expect(grievance.currentValue).toBe(GRIEVANCE_DEFAULT_VALUES[severity]);
        expect(grievance.severity).toBe(severity);
        expect(grievance.fabricated).toBe(false);
        expect(grievance.evidenceStrength).toBe(100);
      }
    });

    it('uses a custom initial value when provided', () => {
      const grievance = createGrievance(
        'emp_a', 'emp_b', 'offence', 'Custom value test', ['emp_b'], 10, 42,
      );
      expect(grievance.initialValue).toBe(42);
      expect(grievance.currentValue).toBe(42);
    });

    it('assigns unique IDs to each grievance', () => {
      const g1 = createGrievance('emp_a', 'emp_b', 'slight', 'First', [], 0);
      const g2 = createGrievance('emp_a', 'emp_b', 'slight', 'Second', [], 0);
      expect(g1.id).not.toBe(g2.id);
    });
  });

  // ── processGrievanceTick ─────────────────────────────────────────────────

  describe('processGrievanceTick', () => {
    it('applies decay correctly — slight grievances lose 2.0 per tick', () => {
      const slight = makeGrievance('slight');
      const initialValue = slight.currentValue;

      const result = processGrievanceTick([slight], 1);

      expect(result.grievances.length + result.expired.length).toBe(1);
      if (result.grievances.length > 0) {
        expect(result.grievances[0].currentValue).toBe(initialValue - 2.0);
      }
    });

    it('removes expired grievances when currentValue reaches zero', () => {
      const almostDead = makeGrievance('slight', { currentValue: 1.0 });

      const result = processGrievanceTick([almostDead], 1);

      // 1.0 - 2.0 decay = -1.0, clamped to 0 => expired
      expect(result.expired.length).toBe(1);
      expect(result.grievances.length).toBe(0);
      expect(result.expired[0].currentValue).toBe(0);
    });

    it('processes multiple grievances in a single tick', () => {
      const grievances = [
        makeGrievance('slight', { id: 'g1', currentValue: 10 }),
        makeGrievance('offence', { id: 'g2', currentValue: 30 }),
        makeGrievance('existential', { id: 'g3', currentValue: 100 }),
      ];

      const result = processGrievanceTick(grievances, 1);

      // All should survive — slight has 8, offence has 29.5, existential has 100
      expect(result.grievances.length).toBe(3);
    });
  });

  // ── Existential grievances never decay ───────────────────────────────────

  describe('Existential grievances', () => {
    it('never decay — currentValue remains unchanged after many ticks', () => {
      const existential = makeGrievance('existential');
      const originalValue = existential.currentValue;

      // Run 1000 ticks
      let current = [existential];
      for (let tick = 1; tick <= 1000; tick++) {
        const result = processGrievanceTick(current, tick);
        current = result.grievances;
        expect(result.expired.length).toBe(0);
      }

      expect(current.length).toBe(1);
      expect(current[0].currentValue).toBe(originalValue);
    });

    it('has decayRate of exactly 0', () => {
      expect(GRIEVANCE_DECAY_RATES.existential).toBe(0);

      const grievance = createGrievance(
        'emp_a', 'emp_b', 'existential', 'Genocide', ['emp_b', 'emp_c'], 0,
      );
      expect(grievance.decayRate).toBe(0);
    });
  });

  // ── calculateCasusBelli ──────────────────────────────────────────────────

  describe('calculateCasusBelli', () => {
    it('returns justified when sufficient grievances exist', () => {
      // Create enough grievances to exceed the threshold
      const grievances = [
        makeGrievance('major', { currentValue: 60, evidenceStrength: 100 }),
      ];

      const result = calculateCasusBelli(grievances, 'emp_victim', 'emp_aggressor');

      // 60 * (100/100) = 60, threshold is 50
      expect(result.justified).toBe(true);
      expect(result.strength).toBeGreaterThanOrEqual(CASUS_BELLI_THRESHOLD);
    });

    it('returns not justified when grievances are insufficient', () => {
      const grievances = [
        makeGrievance('slight', { currentValue: 5, evidenceStrength: 100 }),
      ];

      const result = calculateCasusBelli(grievances, 'emp_victim', 'emp_aggressor');

      expect(result.justified).toBe(false);
      expect(result.strength).toBeLessThan(CASUS_BELLI_THRESHOLD);
    });

    it('accounts for government type — autocracy needs less justification', () => {
      const grievances = [
        makeGrievance('offence', { currentValue: 35, evidenceStrength: 100 }),
      ];

      // Democracy has a +20 modifier (harder), autocracy has -20 (easier)
      const democracyResult = calculateCasusBelli(
        grievances, 'emp_victim', 'emp_aggressor', 'democracy',
      );
      const autocracyResult = calculateCasusBelli(
        grievances, 'emp_victim', 'emp_aggressor', 'autocracy',
      );

      // Same grievance strength but different thresholds
      // Democracy threshold: 50 + 20 = 70, autocracy: 50 - 20 = 30
      // Strength: 35 * 1.0 = 35
      expect(autocracyResult.justified).toBe(true);
      expect(democracyResult.justified).toBe(false);
    });

    it('discounts weak evidence when calculating strength', () => {
      const strongEvidence = [
        makeGrievance('major', { currentValue: 60, evidenceStrength: 100 }),
      ];
      const weakEvidence = [
        makeGrievance('major', { currentValue: 60, evidenceStrength: 20 }),
      ];

      const strongResult = calculateCasusBelli(strongEvidence, 'emp_victim', 'emp_aggressor');
      const weakResult = calculateCasusBelli(weakEvidence, 'emp_victim', 'emp_aggressor');

      expect(strongResult.strength).toBeGreaterThan(weakResult.strength);
    });

    it('returns the IDs of contributing grievances', () => {
      const grievances = [
        makeGrievance('offence', { id: 'g1', victimEmpireId: 'emp_a', perpetratorEmpireId: 'emp_b' }),
        makeGrievance('major', { id: 'g2', victimEmpireId: 'emp_a', perpetratorEmpireId: 'emp_b' }),
        makeGrievance('slight', { id: 'g3', victimEmpireId: 'emp_c', perpetratorEmpireId: 'emp_b' }),
      ];

      const result = calculateCasusBelli(grievances, 'emp_a', 'emp_b');

      // Only g1 and g2 are relevant (emp_a as victim, emp_b as perpetrator)
      expect(result.grievanceIds).toContain('g1');
      expect(result.grievanceIds).toContain('g2');
      expect(result.grievanceIds).not.toContain('g3');
    });
  });

  // ── fabricateGrievance ───────────────────────────────────────────────────

  describe('fabricateGrievance', () => {
    it('creates a fabricated grievance with detection risk', () => {
      const rng = makeRng();
      const result = fabricateGrievance(
        'emp_target', 'emp_spy', 'offence', 'Alleged border incursion', 10, 5, rng,
      );

      expect(result.grievance.fabricated).toBe(true);
      expect(result.grievance.severity).toBe('offence');
      expect(result.detectionRisk).toBeGreaterThan(0);
      expect(result.detectionRisk).toBeLessThan(1);
    });

    it('high-skill spies have lower detection risk', () => {
      const rng1 = makeRng(42);
      const rng2 = makeRng(42);

      const lowSkill = fabricateGrievance(
        'emp_target', 'emp_spy', 'offence', 'Test', 10, 2, rng1,
      );
      const highSkill = fabricateGrievance(
        'emp_target', 'emp_spy', 'offence', 'Test', 10, 9, rng2,
      );

      expect(highSkill.detectionRisk).toBeLessThan(lowSkill.detectionRisk);
    });

    it('high-skill spies produce higher evidence strength', () => {
      const rng1 = makeRng(42);
      const rng2 = makeRng(42);

      const lowSkill = fabricateGrievance(
        'emp_target', 'emp_spy', 'major', 'Test', 10, 1, rng1,
      );
      const highSkill = fabricateGrievance(
        'emp_target', 'emp_spy', 'major', 'Test', 10, 10, rng2,
      );

      expect(highSkill.grievance.evidenceStrength).toBeGreaterThan(
        lowSkill.grievance.evidenceStrength,
      );
    });

    it('evidence strength is clamped between 10 and 100', () => {
      // Run with multiple seeds to check range
      for (let seed = 1; seed <= 50; seed++) {
        const rng = makeRng(seed);
        const result = fabricateGrievance(
          'emp_target', 'emp_spy', 'slight', 'Test', 10,
          Math.ceil(seed / 5), // Skill 1-10
          rng,
        );
        expect(result.grievance.evidenceStrength).toBeGreaterThanOrEqual(10);
        expect(result.grievance.evidenceStrength).toBeLessThanOrEqual(100);
      }
    });
  });
});
