import { describe, it, expect } from 'vitest';
import {
  computeStressLevel,
  applyEnneagramDisintegration,
  applyEnneagramGrowth,
  determineCopingStrategy,
} from '../../engine/psychology/stress.js';
import type { StressInput } from '../../engine/psychology/stress.js';
import type { CoreTraits, EnneagramProfile, MaslowNeeds } from '../../types/psychology.js';

function makeInput(overrides: Partial<StressInput> = {}): StressInput {
  return {
    needs: {
      physiological: 80,
      safety: 70,
      belonging: 50,
      esteem: 50,
      selfActualisation: 40,
    },
    activeWars: 0,
    homeworldThreatened: false,
    previousStress: 'baseline',
    ticksSinceCrisis: 999,
    ...overrides,
  };
}

const neutralTraits: CoreTraits = {
  neuroticism: 50,
  extraversion: 50,
  openness: 50,
  agreeableness: 50,
  conscientiousness: 50,
  honestyHumility: 50,
};

describe('computeStressLevel', () => {
  it('should return baseline when all needs met and no wars', () => {
    expect(computeStressLevel(makeInput())).toBe('baseline');
  });

  it('should return moderate when in a single war', () => {
    expect(computeStressLevel(makeInput({ activeWars: 1 }))).toBe('moderate');
  });

  it('should return moderate when safety is low', () => {
    expect(computeStressLevel(makeInput({
      needs: { physiological: 80, safety: 40, belonging: 50, esteem: 50, selfActualisation: 40 },
    }))).toBe('moderate');
  });

  it('should return high when at war and resources low', () => {
    expect(computeStressLevel(makeInput({
      activeWars: 1,
      needs: { physiological: 30, safety: 35, belonging: 50, esteem: 50, selfActualisation: 40 },
    }))).toBe('high');
  });

  it('should return high when physiological is critical', () => {
    expect(computeStressLevel(makeInput({
      needs: { physiological: 15, safety: 70, belonging: 50, esteem: 50, selfActualisation: 40 },
    }))).toBe('high');
  });

  it('should return extreme when homeworld threatened', () => {
    expect(computeStressLevel(makeInput({ homeworldThreatened: true }))).toBe('extreme');
  });

  it('should return extreme when multi-front war with low safety', () => {
    expect(computeStressLevel(makeInput({
      activeWars: 2,
      needs: { physiological: 80, safety: 15, belonging: 50, esteem: 50, selfActualisation: 40 },
    }))).toBe('extreme');
  });

  it('should return recovery after crisis resolves', () => {
    expect(computeStressLevel(makeInput({
      previousStress: 'high',
      ticksSinceCrisis: 50,
    }))).toBe('recovery');
  });

  it('should return baseline after recovery period ends', () => {
    expect(computeStressLevel(makeInput({
      previousStress: 'recovery',
      ticksSinceCrisis: 150,
    }))).toBe('baseline');
  });
});

describe('applyEnneagramDisintegration', () => {
  it('should not modify traits at baseline stress', () => {
    const enneagram: EnneagramProfile = { type: 9, wing: 1, stressDirection: 6, growthDirection: 3 };
    const result = applyEnneagramDisintegration(neutralTraits, enneagram, 'baseline');
    expect(result).toEqual(neutralTraits);
  });

  it('should not modify traits at moderate stress', () => {
    const enneagram: EnneagramProfile = { type: 9, wing: 1, stressDirection: 6, growthDirection: 3 };
    const result = applyEnneagramDisintegration(neutralTraits, enneagram, 'moderate');
    expect(result).toEqual(neutralTraits);
  });

  it('should shift traits at high stress', () => {
    // Type 9 → Type 6 (anxious/paranoid): +N, -A, -E
    const enneagram: EnneagramProfile = { type: 9, wing: 1, stressDirection: 6, growthDirection: 3 };
    const result = applyEnneagramDisintegration(neutralTraits, enneagram, 'high');
    expect(result.neuroticism).toBeGreaterThan(neutralTraits.neuroticism);
  });

  it('should shift traits more at extreme stress', () => {
    const enneagram: EnneagramProfile = { type: 8, wing: 7, stressDirection: 5, growthDirection: 2 };
    const high = applyEnneagramDisintegration(neutralTraits, enneagram, 'high');
    const extreme = applyEnneagramDisintegration(neutralTraits, enneagram, 'extreme');
    // Type 8 → Type 5: -E heavily
    const highShift = Math.abs(high.extraversion - neutralTraits.extraversion);
    const extremeShift = Math.abs(extreme.extraversion - neutralTraits.extraversion);
    expect(extremeShift).toBeGreaterThan(highShift);
  });

  it('should clamp shifted traits to 0-100', () => {
    const extreme: CoreTraits = {
      neuroticism: 95,
      extraversion: 5,
      openness: 95,
      agreeableness: 5,
      conscientiousness: 95,
      honestyHumility: 5,
    };
    const enneagram: EnneagramProfile = { type: 2, wing: 3, stressDirection: 8, growthDirection: 4 };
    const result = applyEnneagramDisintegration(extreme, enneagram, 'extreme');
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});

describe('applyEnneagramGrowth', () => {
  it('should not modify when stressed', () => {
    const enneagram: EnneagramProfile = { type: 5, wing: 4, stressDirection: 7, growthDirection: 8 };
    const needs: MaslowNeeds = { physiological: 80, safety: 70, belonging: 60, esteem: 70, selfActualisation: 80 };
    const result = applyEnneagramGrowth(neutralTraits, enneagram, 'high', needs);
    expect(result).toEqual(neutralTraits);
  });

  it('should not modify when needs are low', () => {
    const enneagram: EnneagramProfile = { type: 5, wing: 4, stressDirection: 7, growthDirection: 8 };
    const needs: MaslowNeeds = { physiological: 80, safety: 70, belonging: 60, esteem: 30, selfActualisation: 20 };
    const result = applyEnneagramGrowth(neutralTraits, enneagram, 'baseline', needs);
    expect(result).toEqual(neutralTraits);
  });

  it('should subtly shift traits when thriving', () => {
    const enneagram: EnneagramProfile = { type: 5, wing: 4, stressDirection: 7, growthDirection: 8 };
    const needs: MaslowNeeds = { physiological: 90, safety: 80, belonging: 70, esteem: 70, selfActualisation: 80 };
    const result = applyEnneagramGrowth(neutralTraits, enneagram, 'baseline', needs);
    // Type 5 grows toward 8: should see some trait changes
    const anyDiff = Object.keys(neutralTraits).some(
      k => result[k as keyof CoreTraits] !== neutralTraits[k as keyof CoreTraits],
    );
    expect(anyDiff).toBe(true);
  });
});

describe('determineCopingStrategy', () => {
  it('should return fawn for anxious under extreme stress', () => {
    expect(determineCopingStrategy('anxious', 'extreme', neutralTraits)).toBe('fawn_response');
  });

  it('should return withdrawal for avoidant under extreme stress', () => {
    expect(determineCopingStrategy('avoidant', 'extreme', neutralTraits)).toBe('withdrawal');
  });

  it('should return problem_focused for secure under extreme stress with low A', () => {
    const lowA = { ...neutralTraits, agreeableness: 30 };
    expect(determineCopingStrategy('secure', 'extreme', lowA)).toBe('problem_focused');
  });

  it('should return social_support for secure under extreme stress with high A', () => {
    const highA = { ...neutralTraits, agreeableness: 70 };
    expect(determineCopingStrategy('secure', 'extreme', highA)).toBe('social_support');
  });

  it('should return emotional_coping for anxious under high stress', () => {
    expect(determineCopingStrategy('anxious', 'high', neutralTraits)).toBe('emotional_coping');
  });

  it('should return problem_focused for high C+O at moderate stress', () => {
    const highCO = { ...neutralTraits, conscientiousness: 80, openness: 60 };
    expect(determineCopingStrategy('secure', 'moderate', highCO)).toBe('problem_focused');
  });
});
