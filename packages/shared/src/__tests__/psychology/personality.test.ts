import { describe, it, expect } from 'vitest';
import {
  gaussian,
  rollTrait,
  rollCoreTraits,
  rollSubfacets,
  rollDarkTriad,
  rollFirstContactAttitude,
  rollPersonality,
  createDefaultPersonality,
} from '../../engine/psychology/personality.js';
import { clamp } from '../../engine/psychology/personality.js';
import { SPECIES_PERSONALITIES, SPECIES_PERSONALITIES_BY_ID } from '../../../data/species/personality/index.js';
import type { DifficultyLevel, CoreTraitKey } from '../../types/psychology.js';
import { CORE_TRAIT_KEYS, DIFFICULTY_MODIFIERS } from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Deterministic RNG for testing
// ---------------------------------------------------------------------------

/** Create a seeded pseudo-random function (simple LCG). */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// Gaussian
// ---------------------------------------------------------------------------

describe('gaussian', () => {
  it('should produce values centred around the mean', () => {
    const rng = seededRng(42);
    const samples = Array.from({ length: 1000 }, () => gaussian(50, 10, rng));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(45);
    expect(mean).toBeLessThan(55);
  });

  it('should produce values with appropriate spread', () => {
    const rng = seededRng(42);
    const samples = Array.from({ length: 1000 }, () => gaussian(50, 10, rng));
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    // Should spread beyond ±1 stddev at least
    expect(min).toBeLessThan(40);
    expect(max).toBeGreaterThan(60);
  });

  it('should respect a zero stddev', () => {
    const rng = seededRng(42);
    const samples = Array.from({ length: 10 }, () => gaussian(50, 0, rng));
    for (const s of samples) {
      expect(s).toBe(50);
    }
  });
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

describe('clamp', () => {
  it('should clamp values below minimum', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it('should clamp values above maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('should leave values in range unchanged', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// rollTrait
// ---------------------------------------------------------------------------

describe('rollTrait', () => {
  it('should produce values within 0-100', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 100; i++) {
      const val = rollTrait({ median: 50, stddev: 30 }, 0, 0, 100, rng);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it('should apply difficulty offset', () => {
    const rng1 = seededRng(42);
    const rng2 = seededRng(42);
    const base = rollTrait({ median: 50, stddev: 5 }, 0, 0, 100, rng1);
    const shifted = rollTrait({ median: 50, stddev: 5 }, 20, 0, 100, rng2);
    expect(shifted).toBeGreaterThan(base);
  });

  it('should return integers', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 50; i++) {
      const val = rollTrait({ median: 50, stddev: 15 }, 0, 0, 100, rng);
      expect(val).toBe(Math.round(val));
    }
  });
});

// ---------------------------------------------------------------------------
// rollCoreTraits
// ---------------------------------------------------------------------------

describe('rollCoreTraits', () => {
  it('should produce all six core traits', () => {
    const rng = seededRng(42);
    const data = SPECIES_PERSONALITIES_BY_ID['teranos'];
    const traits = rollCoreTraits(data.traits, 'normal', rng);

    for (const key of CORE_TRAIT_KEYS) {
      expect(traits[key]).toBeDefined();
      expect(traits[key]).toBeGreaterThanOrEqual(0);
      expect(traits[key]).toBeLessThanOrEqual(100);
    }
  });

  it('should shift traits on hard difficulty', () => {
    // Run many samples and compare means
    const normalMeans: Record<string, number> = {};
    const hardMeans: Record<string, number> = {};
    const data = SPECIES_PERSONALITIES_BY_ID['teranos'];

    for (const diff of ['normal', 'hard'] as DifficultyLevel[]) {
      const means: Record<string, number> = {};
      for (const key of CORE_TRAIT_KEYS) means[key] = 0;

      const N = 500;
      for (let i = 0; i < N; i++) {
        const rng = seededRng(i);
        const traits = rollCoreTraits(data.traits, diff, rng);
        for (const key of CORE_TRAIT_KEYS) means[key] += traits[key];
      }
      for (const key of CORE_TRAIT_KEYS) means[key] /= N;

      if (diff === 'normal') Object.assign(normalMeans, means);
      else Object.assign(hardMeans, means);
    }

    // Hard should be less agreeable and more neurotic on average
    expect(hardMeans['agreeableness']).toBeLessThan(normalMeans['agreeableness']);
    expect(hardMeans['neuroticism']).toBeGreaterThan(normalMeans['neuroticism']);
  });
});

// ---------------------------------------------------------------------------
// rollSubfacets
// ---------------------------------------------------------------------------

describe('rollSubfacets', () => {
  it('should roll all defined subfacets', () => {
    const rng = seededRng(42);
    const data = SPECIES_PERSONALITIES_BY_ID['teranos'];
    const subfacets = rollSubfacets(data.subfacets, rng);

    expect(Object.keys(subfacets).length).toBe(5); // Teranos has 5
    for (const val of Object.values(subfacets)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it('should handle species with fewer subfacets', () => {
    const rng = seededRng(42);
    const data = SPECIES_PERSONALITIES_BY_ID['pyrenth'];
    const subfacets = rollSubfacets(data.subfacets, rng);

    expect(Object.keys(subfacets).length).toBe(3); // Pyrenth has 3
  });
});

// ---------------------------------------------------------------------------
// rollDarkTriad
// ---------------------------------------------------------------------------

describe('rollDarkTriad', () => {
  it('should produce values in 0-100 range', () => {
    const rng = seededRng(42);
    const base = { narcissism: 50, machiavellianism: 50, psychopathy: 50, sadism: 50 };
    const rolled = rollDarkTriad(base, 'normal', rng);

    expect(rolled.narcissism).toBeGreaterThanOrEqual(0);
    expect(rolled.narcissism).toBeLessThanOrEqual(100);
    expect(rolled.machiavellianism).toBeGreaterThanOrEqual(0);
    expect(rolled.psychopathy).toBeGreaterThanOrEqual(0);
    expect(rolled.sadism).toBeGreaterThanOrEqual(0);
  });

  it('should amplify on hard difficulty', () => {
    const N = 500;
    let normalSum = 0;
    let hardSum = 0;
    const base = { narcissism: 30, machiavellianism: 30, psychopathy: 30, sadism: 30 };

    for (let i = 0; i < N; i++) {
      const rng1 = seededRng(i);
      const rng2 = seededRng(i + 10000);
      const normal = rollDarkTriad(base, 'normal', rng1);
      const hard = rollDarkTriad(base, 'hard', rng2);
      normalSum += normal.narcissism + normal.machiavellianism + normal.psychopathy + normal.sadism;
      hardSum += hard.narcissism + hard.machiavellianism + hard.psychopathy + hard.sadism;
    }

    expect(hardSum / N).toBeGreaterThan(normalSum / N);
  });
});

// ---------------------------------------------------------------------------
// rollFirstContactAttitude
// ---------------------------------------------------------------------------

describe('rollFirstContactAttitude', () => {
  it('should produce values within the given range', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 100; i++) {
      const val = rollFirstContactAttitude({ min: -10, max: 20 }, rng);
      expect(val).toBeGreaterThanOrEqual(-10);
      expect(val).toBeLessThanOrEqual(20);
    }
  });

  it('should return integers', () => {
    const rng = seededRng(42);
    const val = rollFirstContactAttitude({ min: 0, max: 10 }, rng);
    expect(val).toBe(Math.round(val));
  });
});

// ---------------------------------------------------------------------------
// rollPersonality (full integration)
// ---------------------------------------------------------------------------

describe('rollPersonality', () => {
  it('should produce a complete personality for every species', () => {
    for (const data of SPECIES_PERSONALITIES) {
      const rng = seededRng(42);
      const rolled = rollPersonality(data, 'normal', rng);

      expect(rolled.speciesId).toBe(data.speciesId);
      expect(rolled.attachmentStyle).toBe(data.attachmentStyle);
      expect(rolled.difficulty).toBe('normal');

      // Core traits present and valid
      for (const key of CORE_TRAIT_KEYS) {
        expect(rolled.traits[key]).toBeGreaterThanOrEqual(0);
        expect(rolled.traits[key]).toBeLessThanOrEqual(100);
      }

      // Subfacets present
      expect(Object.keys(rolled.subfacets).length).toBe(Object.keys(data.subfacets).length);

      // Enneagram inherited
      expect(rolled.enneagram.type).toBe(data.enneagram.type);
      expect(rolled.enneagram.wing).toBe(data.enneagram.wing);
    }
  });

  it('should produce different personalities with different seeds', () => {
    const data = SPECIES_PERSONALITIES_BY_ID['khazari'];
    const rng1 = seededRng(42);
    const rng2 = seededRng(999);

    const p1 = rollPersonality(data, 'normal', rng1);
    const p2 = rollPersonality(data, 'normal', rng2);

    // Extremely unlikely to be identical with different seeds
    const anyDiff = CORE_TRAIT_KEYS.some(k => p1.traits[k] !== p2.traits[k]);
    expect(anyDiff).toBe(true);
  });

  it('should produce the same personality with the same seed', () => {
    const data = SPECIES_PERSONALITIES_BY_ID['sylvani'];
    const rng1 = seededRng(42);
    const rng2 = seededRng(42);

    const p1 = rollPersonality(data, 'normal', rng1);
    const p2 = rollPersonality(data, 'normal', rng2);

    for (const key of CORE_TRAIT_KEYS) {
      expect(p1.traits[key]).toBe(p2.traits[key]);
    }
  });

  it('should respect difficulty levels', () => {
    const data = SPECIES_PERSONALITIES_BY_ID['drakmari'];
    const difficulties: DifficultyLevel[] = ['easy', 'normal', 'hard', 'brutal'];

    for (const diff of difficulties) {
      const rng = seededRng(42);
      const p = rollPersonality(data, diff, rng);
      expect(p.difficulty).toBe(diff);
    }
  });
});

// ---------------------------------------------------------------------------
// createDefaultPersonality (backward compat)
// ---------------------------------------------------------------------------

describe('createDefaultPersonality', () => {
  it('should produce a neutral personality for any species ID', () => {
    const p = createDefaultPersonality('unknown_species');
    expect(p.speciesId).toBe('unknown_species');
    expect(p.traits.neuroticism).toBe(50);
    expect(p.attachmentStyle).toBe('secure');
    expect(p.difficulty).toBe('normal');
  });
});

// ---------------------------------------------------------------------------
// Species personality data integrity
// ---------------------------------------------------------------------------

describe('species personality data', () => {
  const ALL_SPECIES = [
    'teranos', 'khazari', 'drakmari', 'sylvani', 'nexari', 'orivani',
    'pyrenth', 'luminari', 'vethara', 'ashkari', 'zorvathi', 'kaelenth',
    'thyriaq', 'aethyn', 'vaelori',
  ];

  it('should have personality data for all 15 species', () => {
    expect(SPECIES_PERSONALITIES.length).toBe(15);
    for (const id of ALL_SPECIES) {
      expect(SPECIES_PERSONALITIES_BY_ID[id]).toBeDefined();
    }
  });

  it('should have valid trait distributions (medians 0-100, positive stddev)', () => {
    for (const data of SPECIES_PERSONALITIES) {
      for (const key of CORE_TRAIT_KEYS) {
        const dist = data.traits[key];
        expect(dist.median).toBeGreaterThanOrEqual(0);
        expect(dist.median).toBeLessThanOrEqual(100);
        expect(dist.stddev).toBeGreaterThan(0);
      }
    }
  });

  it('should have valid attachment styles', () => {
    const valid = ['secure', 'anxious', 'avoidant', 'fearful_avoidant'];
    for (const data of SPECIES_PERSONALITIES) {
      expect(valid).toContain(data.attachmentStyle);
    }
  });

  it('should have valid Enneagram types (1-9)', () => {
    for (const data of SPECIES_PERSONALITIES) {
      expect(data.enneagram.type).toBeGreaterThanOrEqual(1);
      expect(data.enneagram.type).toBeLessThanOrEqual(9);
      expect(data.enneagram.wing).toBeGreaterThanOrEqual(1);
      expect(data.enneagram.wing).toBeLessThanOrEqual(9);
      expect(data.enneagram.stressDirection).toBeGreaterThanOrEqual(1);
      expect(data.enneagram.stressDirection).toBeLessThanOrEqual(9);
      expect(data.enneagram.growthDirection).toBeGreaterThanOrEqual(1);
      expect(data.enneagram.growthDirection).toBeLessThanOrEqual(9);
    }
  });

  it('should have Dark Triad scores in 0-100', () => {
    for (const data of SPECIES_PERSONALITIES) {
      for (const val of Object.values(data.darkTriad)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    }
  });

  it('should have moral foundations in 0-100', () => {
    for (const data of SPECIES_PERSONALITIES) {
      for (const val of Object.values(data.moralFoundations)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    }
  });

  it('should have first-contact attitude ranges where min <= max', () => {
    for (const data of SPECIES_PERSONALITIES) {
      expect(data.firstContactAttitude.min).toBeLessThanOrEqual(data.firstContactAttitude.max);
    }
  });

  it('should have at least 2 subfacets per species', () => {
    for (const data of SPECIES_PERSONALITIES) {
      expect(Object.keys(data.subfacets).length).toBeGreaterThanOrEqual(2);
    }
  });
});
