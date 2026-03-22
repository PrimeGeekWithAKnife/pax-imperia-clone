import { describe, it, expect } from 'vitest';
import { generateId, generateUUID } from '../utils/id.js';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns only lowercase hexadecimal characters', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it('returns exactly 8 characters', () => {
    const id = generateId();
    expect(id).toHaveLength(8);
  });

  it('generates unique IDs across many calls', () => {
    const ids = new Set<string>();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      ids.add(generateId());
    }
    // Allow at most 1 collision in 1000 (probability is astronomically low for 8 hex chars)
    expect(ids.size).toBeGreaterThan(iterations - 2);
  });

  it('IDs are different on consecutive calls', () => {
    const a = generateId();
    const b = generateId();
    // Not strictly guaranteed but near-certain with 8 hex chars
    expect(a).not.toBe(b);
  });
});

describe('generateUUID', () => {
  it('returns a string in standard UUID v4 format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('returns a 36-character string', () => {
    const uuid = generateUUID();
    expect(uuid).toHaveLength(36);
  });

  it('generates unique UUIDs across many calls', () => {
    const uuids = new Set<string>();
    const iterations = 500;
    for (let i = 0; i < iterations; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(iterations);
  });
});
