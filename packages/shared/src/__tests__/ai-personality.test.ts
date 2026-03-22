import { describe, it, expect } from 'vitest';
import {
  calculateBehaviourWeights,
  SPECIES_DEFAULT_PROFILES,
  randomisePersonality,
} from '../engine/ai/personality.js';
import type { AIPersonalityProfile, AIBehaviourWeights } from '../types/ai-personality.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_SPECIES_IDS = [
  'vaelori',
  'khazari',
  'sylvani',
  'nexari',
  'drakmari',
  'teranos',
  'zorvathi',
  'ashkari',
  'luminari',
  'vethara',
  'kaelenth',
  'thyriaq',
  'aethyn',
  'orivani',
  'pyrenth',
];

const TRAIT_KEYS: (keyof AIPersonalityProfile)[] = [
  'honesty',
  'bravery',
  'ambition',
  'patience',
  'empathy',
  'openness',
  'loyalty',
  'pragmatism',
];

const WEIGHT_KEYS: (keyof AIBehaviourWeights)[] = [
  'warPropensity',
  'treatyReliability',
  'espionagePropensity',
  'tradePropensity',
  'victoryDrive',
  'diplomaticOpenness',
  'coldWarPropensity',
  'deceptionPropensity',
];

// ---------------------------------------------------------------------------
// Species default profiles
// ---------------------------------------------------------------------------

describe('SPECIES_DEFAULT_PROFILES', () => {
  it('should have profiles for all 15 species', () => {
    for (const id of ALL_SPECIES_IDS) {
      expect(SPECIES_DEFAULT_PROFILES[id]).toBeDefined();
    }
    expect(Object.keys(SPECIES_DEFAULT_PROFILES)).toHaveLength(15);
  });

  it('should have all eight traits on every profile', () => {
    for (const id of ALL_SPECIES_IDS) {
      const profile = SPECIES_DEFAULT_PROFILES[id]!;
      for (const trait of TRAIT_KEYS) {
        expect(profile[trait]).toBeDefined();
      }
    }
  });

  it('should have all trait values within 1–10', () => {
    for (const id of ALL_SPECIES_IDS) {
      const profile = SPECIES_DEFAULT_PROFILES[id]!;
      for (const trait of TRAIT_KEYS) {
        expect(profile[trait]).toBeGreaterThanOrEqual(1);
        expect(profile[trait]).toBeLessThanOrEqual(10);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// calculateBehaviourWeights
// ---------------------------------------------------------------------------

describe('calculateBehaviourWeights', () => {
  it('should return all eight behaviour weights', () => {
    const profile = SPECIES_DEFAULT_PROFILES['teranos']!;
    const weights = calculateBehaviourWeights(profile);

    for (const key of WEIGHT_KEYS) {
      expect(weights[key]).toBeDefined();
    }
  });

  it('should return weights in the 0–1 range', () => {
    for (const id of ALL_SPECIES_IDS) {
      const profile = SPECIES_DEFAULT_PROFILES[id]!;
      const weights = calculateBehaviourWeights(profile);

      for (const key of WEIGHT_KEYS) {
        expect(weights[key]).toBeGreaterThanOrEqual(0);
        expect(weights[key]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should give honest species high treaty reliability', () => {
    const honest: AIPersonalityProfile = {
      honesty: 10,
      bravery: 5,
      ambition: 5,
      patience: 5,
      empathy: 5,
      openness: 5,
      loyalty: 10,
      pragmatism: 1,
    };
    const dishonest: AIPersonalityProfile = {
      honesty: 1,
      bravery: 5,
      ambition: 5,
      patience: 5,
      empathy: 5,
      openness: 5,
      loyalty: 1,
      pragmatism: 10,
    };

    const honestWeights = calculateBehaviourWeights(honest);
    const dishonestWeights = calculateBehaviourWeights(dishonest);

    expect(honestWeights.treatyReliability).toBeGreaterThan(dishonestWeights.treatyReliability);
    expect(honestWeights.treatyReliability).toBeGreaterThan(0.7);
    expect(dishonestWeights.treatyReliability).toBeLessThan(0.3);
  });

  it('should give brave, ambitious species high war propensity', () => {
    const warlike: AIPersonalityProfile = {
      honesty: 5,
      bravery: 10,
      ambition: 10,
      patience: 1,
      empathy: 1,
      openness: 5,
      loyalty: 5,
      pragmatism: 5,
    };
    const peaceful: AIPersonalityProfile = {
      honesty: 5,
      bravery: 1,
      ambition: 1,
      patience: 10,
      empathy: 10,
      openness: 5,
      loyalty: 5,
      pragmatism: 5,
    };

    const warlikeWeights = calculateBehaviourWeights(warlike);
    const peacefulWeights = calculateBehaviourWeights(peaceful);

    expect(warlikeWeights.warPropensity).toBeGreaterThan(peacefulWeights.warPropensity);
    expect(warlikeWeights.warPropensity).toBeGreaterThan(0.7);
    expect(peacefulWeights.warPropensity).toBeLessThan(0.3);
  });

  it('should give pragmatic, dishonest species high espionage propensity', () => {
    const spymaster: AIPersonalityProfile = {
      honesty: 1,
      bravery: 5,
      ambition: 10,
      patience: 5,
      empathy: 5,
      openness: 5,
      loyalty: 5,
      pragmatism: 10,
    };
    const transparent: AIPersonalityProfile = {
      honesty: 10,
      bravery: 5,
      ambition: 1,
      patience: 5,
      empathy: 5,
      openness: 5,
      loyalty: 5,
      pragmatism: 1,
    };

    const spyWeights = calculateBehaviourWeights(spymaster);
    const transparentWeights = calculateBehaviourWeights(transparent);

    expect(spyWeights.espionagePropensity).toBeGreaterThan(transparentWeights.espionagePropensity);
  });

  it('should give dishonest, disloyal species high deception propensity', () => {
    const deceitful: AIPersonalityProfile = {
      honesty: 1,
      bravery: 5,
      ambition: 5,
      patience: 5,
      empathy: 5,
      openness: 5,
      loyalty: 1,
      pragmatism: 10,
    };
    const honourable: AIPersonalityProfile = {
      honesty: 10,
      bravery: 5,
      ambition: 5,
      patience: 5,
      empathy: 5,
      openness: 5,
      loyalty: 10,
      pragmatism: 1,
    };

    const deceitfulWeights = calculateBehaviourWeights(deceitful);
    const honourableWeights = calculateBehaviourWeights(honourable);

    expect(deceitfulWeights.deceptionPropensity).toBeGreaterThan(honourableWeights.deceptionPropensity);
    expect(deceitfulWeights.deceptionPropensity).toBeGreaterThan(0.7);
    expect(honourableWeights.deceptionPropensity).toBeLessThan(0.3);
  });

  it('should give open, empathetic species high diplomatic openness', () => {
    const open: AIPersonalityProfile = {
      honesty: 8,
      bravery: 5,
      ambition: 5,
      patience: 8,
      empathy: 9,
      openness: 10,
      loyalty: 5,
      pragmatism: 5,
    };
    const xenophobic: AIPersonalityProfile = {
      honesty: 3,
      bravery: 5,
      ambition: 5,
      patience: 2,
      empathy: 1,
      openness: 1,
      loyalty: 5,
      pragmatism: 5,
    };

    const openWeights = calculateBehaviourWeights(open);
    const xenophobicWeights = calculateBehaviourWeights(xenophobic);

    expect(openWeights.diplomaticOpenness).toBeGreaterThan(xenophobicWeights.diplomaticOpenness);
  });

  // Species-specific sanity checks
  it('should make Khazari highly war-prone but treaty-reliable', () => {
    const weights = calculateBehaviourWeights(SPECIES_DEFAULT_PROFILES['khazari']!);
    expect(weights.warPropensity).toBeGreaterThan(0.5);
    expect(weights.treatyReliability).toBeGreaterThan(0.5);
    // Khazari are honest warriors — they tell you they will attack, then do
    expect(weights.deceptionPropensity).toBeLessThan(0.5);
  });

  it('should make Ashkari highly deceptive and espionage-prone', () => {
    const weights = calculateBehaviourWeights(SPECIES_DEFAULT_PROFILES['ashkari']!);
    expect(weights.espionagePropensity).toBeGreaterThan(0.5);
    expect(weights.deceptionPropensity).toBeGreaterThan(0.5);
    expect(weights.tradePropensity).toBeGreaterThan(0.3);
  });

  it('should make Sylvani peaceful with high diplomatic openness', () => {
    const weights = calculateBehaviourWeights(SPECIES_DEFAULT_PROFILES['sylvani']!);
    expect(weights.warPropensity).toBeLessThan(0.5);
    expect(weights.diplomaticOpenness).toBeGreaterThan(0.5);
  });

  it('should make Orivani zealously principled — low pragmatism means low deception', () => {
    const weights = calculateBehaviourWeights(SPECIES_DEFAULT_PROFILES['orivani']!);
    expect(weights.treatyReliability).toBeGreaterThan(0.7);
    expect(weights.deceptionPropensity).toBeLessThan(0.3);
    // Faith-driven zealots are highly ambitious and brave
    expect(weights.warPropensity).toBeGreaterThan(0.4);
  });
});

// ---------------------------------------------------------------------------
// Edge cases — extreme profiles
// ---------------------------------------------------------------------------

describe('calculateBehaviourWeights edge cases', () => {
  it('should handle all-minimum profile (all traits at 1)', () => {
    const allMin: AIPersonalityProfile = {
      honesty: 1,
      bravery: 1,
      ambition: 1,
      patience: 1,
      empathy: 1,
      openness: 1,
      loyalty: 1,
      pragmatism: 1,
    };
    const weights = calculateBehaviourWeights(allMin);

    for (const key of WEIGHT_KEYS) {
      expect(weights[key]).toBeGreaterThanOrEqual(0);
      expect(weights[key]).toBeLessThanOrEqual(1);
    }
  });

  it('should handle all-maximum profile (all traits at 10)', () => {
    const allMax: AIPersonalityProfile = {
      honesty: 10,
      bravery: 10,
      ambition: 10,
      patience: 10,
      empathy: 10,
      openness: 10,
      loyalty: 10,
      pragmatism: 10,
    };
    const weights = calculateBehaviourWeights(allMax);

    for (const key of WEIGHT_KEYS) {
      expect(weights[key]).toBeGreaterThanOrEqual(0);
      expect(weights[key]).toBeLessThanOrEqual(1);
    }
  });

  it('should handle neutral profile (all traits at 5)', () => {
    const neutral: AIPersonalityProfile = {
      honesty: 5,
      bravery: 5,
      ambition: 5,
      patience: 5,
      empathy: 5,
      openness: 5,
      loyalty: 5,
      pragmatism: 5,
    };
    const weights = calculateBehaviourWeights(neutral);

    // A perfectly neutral profile should produce mid-range weights
    for (const key of WEIGHT_KEYS) {
      expect(weights[key]).toBeGreaterThan(0.2);
      expect(weights[key]).toBeLessThan(0.8);
    }
  });
});

// ---------------------------------------------------------------------------
// randomisePersonality
// ---------------------------------------------------------------------------

describe('randomisePersonality', () => {
  it('should return a profile with all traits within 1–10', () => {
    const base = SPECIES_DEFAULT_PROFILES['khazari']!;
    // Run many iterations to test bounds
    for (let i = 0; i < 100; i++) {
      const randomised = randomisePersonality(base, 3);
      for (const trait of TRAIT_KEYS) {
        expect(randomised[trait]).toBeGreaterThanOrEqual(1);
        expect(randomised[trait]).toBeLessThanOrEqual(10);
      }
    }
  });

  it('should return integer trait values', () => {
    const base = SPECIES_DEFAULT_PROFILES['sylvani']!;
    for (let i = 0; i < 50; i++) {
      const randomised = randomisePersonality(base, 2);
      for (const trait of TRAIT_KEYS) {
        expect(Number.isInteger(randomised[trait])).toBe(true);
      }
    }
  });

  it('should not modify the original profile', () => {
    const base = SPECIES_DEFAULT_PROFILES['nexari']!;
    const originalValues = { ...base };
    randomisePersonality(base, 5);

    for (const trait of TRAIT_KEYS) {
      expect(base[trait]).toBe(originalValues[trait]);
    }
  });

  it('should return the base profile unchanged with zero variance', () => {
    const base = SPECIES_DEFAULT_PROFILES['luminari']!;
    const result = randomisePersonality(base, 0);

    for (const trait of TRAIT_KEYS) {
      expect(result[trait]).toBe(base[trait]);
    }
  });

  it('should clamp traits at the boundary even with large variance', () => {
    // Khazari bravery is 10 — even with variance 5, should not exceed 10
    const base = SPECIES_DEFAULT_PROFILES['khazari']!;
    for (let i = 0; i < 100; i++) {
      const randomised = randomisePersonality(base, 5);
      expect(randomised.bravery).toBeLessThanOrEqual(10);
      expect(randomised.bravery).toBeGreaterThanOrEqual(1);
    }
  });

  it('should produce variation from the base (statistical check)', () => {
    const base = SPECIES_DEFAULT_PROFILES['teranos']!;
    let anyDifference = false;
    for (let i = 0; i < 50; i++) {
      const randomised = randomisePersonality(base, 3);
      for (const trait of TRAIT_KEYS) {
        if (randomised[trait] !== base[trait]) {
          anyDifference = true;
          break;
        }
      }
      if (anyDifference) break;
    }
    // With variance 3 and 8 traits over 50 iterations, at least one should differ
    expect(anyDifference).toBe(true);
  });
});
