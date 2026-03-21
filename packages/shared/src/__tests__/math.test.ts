import { describe, it, expect } from 'vitest';
import { clamp, lerp, distance2D, randomInRange } from '../utils/math.js';

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when value is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('works with negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(0, -10, -1)).toBe(-1);
    expect(clamp(-20, -10, -1)).toBe(-10);
  });

  it('works with floating-point values', () => {
    expect(clamp(0.5, 0.0, 1.0)).toBeCloseTo(0.5);
    expect(clamp(1.5, 0.0, 1.0)).toBeCloseTo(1.0);
  });
});

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('interpolates correctly at t=0.25', () => {
    expect(lerp(0, 40, 0.25)).toBe(10);
  });

  it('extrapolates beyond range when t > 1', () => {
    expect(lerp(0, 10, 2)).toBe(20);
  });

  it('extrapolates behind range when t < 0', () => {
    expect(lerp(0, 10, -1)).toBe(-10);
  });

  it('works with negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});

describe('distance2D', () => {
  it('returns 0 for identical points', () => {
    expect(distance2D({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('calculates horizontal distance correctly', () => {
    expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });

  it('calculates vertical distance correctly', () => {
    expect(distance2D({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4);
  });

  it('calculates diagonal distance using Pythagorean theorem', () => {
    // 3-4-5 right triangle
    expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is commutative', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    expect(distance2D(a, b)).toBeCloseTo(distance2D(b, a));
  });

  it('works with negative coordinates', () => {
    expect(distance2D({ x: -3, y: 0 }, { x: 0, y: -4 })).toBe(5);
  });
});

describe('randomInRange', () => {
  it('returns a value within [min, max)', () => {
    for (let i = 0; i < 100; i++) {
      const result = randomInRange(5, 10);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThan(10);
    }
  });

  it('returns values that vary (not constant)', () => {
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(randomInRange(0, 1_000_000));
    }
    // Statistically near-impossible for all 20 to be identical
    expect(results.size).toBeGreaterThan(1);
  });

  it('works with negative ranges', () => {
    for (let i = 0; i < 50; i++) {
      const result = randomInRange(-10, -5);
      expect(result).toBeGreaterThanOrEqual(-10);
      expect(result).toBeLessThan(-5);
    }
  });

  it('works with fractional ranges', () => {
    for (let i = 0; i < 50; i++) {
      const result = randomInRange(0.0, 1.0);
      expect(result).toBeGreaterThanOrEqual(0.0);
      expect(result).toBeLessThan(1.0);
    }
  });
});
