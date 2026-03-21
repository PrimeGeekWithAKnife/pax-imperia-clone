import { describe, it, expect } from 'vitest';
import { NameGenerator, toRomanNumeral } from '../generation/name-generator.js';
import { SeededRng } from '../generation/galaxy-generator.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeGen(seed = 42): NameGenerator {
  return new NameGenerator(new SeededRng(seed));
}

// ── Roman numerals ────────────────────────────────────────────────────────────

describe('toRomanNumeral', () => {
  it('converts 1 through 8 correctly', () => {
    const expected = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    for (let i = 1; i <= 8; i++) {
      expect(toRomanNumeral(i)).toBe(expected[i - 1]);
    }
  });

  it('falls back to decimal string for numbers > 8', () => {
    expect(toRomanNumeral(9)).toBe('9');
    expect(toRomanNumeral(100)).toBe('100');
  });
});

// ── system name uniqueness ────────────────────────────────────────────────────

describe('NameGenerator.generateSystemName', () => {
  it('returns non-empty strings', () => {
    const gen = makeGen(1);
    for (let i = 0; i < 20; i++) {
      expect(gen.generateSystemName().length).toBeGreaterThan(0);
    }
  });

  it('generates unique names across many calls', () => {
    const gen = makeGen(100);
    const names = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const name = gen.generateSystemName();
      expect(names.has(name), `duplicate name: "${name}"`).toBe(false);
      names.add(name);
    }
  });

  it('starts each name with an uppercase letter', () => {
    const gen = makeGen(7);
    for (let i = 0; i < 40; i++) {
      const name = gen.generateSystemName();
      expect(name[0]).toMatch(/[A-Z]/);
    }
  });

  it('usedCount tracks the number of generated names', () => {
    const gen = makeGen(42);
    expect(gen.usedCount).toBe(0);
    gen.generateSystemName();
    expect(gen.usedCount).toBe(1);
    gen.generateSystemName();
    expect(gen.usedCount).toBe(2);
  });

  it('same seed produces the same name sequence', () => {
    const a = makeGen(555);
    const b = makeGen(555);
    const namesA = Array.from({ length: 20 }, () => a.generateSystemName());
    const namesB = Array.from({ length: 20 }, () => b.generateSystemName());
    expect(namesA).toEqual(namesB);
  });

  it('different seeds produce different name sequences', () => {
    const a = makeGen(1);
    const b = makeGen(2);
    const namesA = Array.from({ length: 10 }, () => a.generateSystemName()).join(',');
    const namesB = Array.from({ length: 10 }, () => b.generateSystemName()).join(',');
    expect(namesA).not.toBe(namesB);
  });
});

// ── planet naming ─────────────────────────────────────────────────────────────

describe('NameGenerator.generatePlanetName', () => {
  it('includes the system name as a prefix', () => {
    const gen = makeGen(42);
    const systemName = 'Arcturus';
    const planetName = gen.generatePlanetName(systemName, 0);
    expect(planetName).toContain(systemName);
  });

  it('uses Roman numerals I through VIII for orbitalIndex 0-7', () => {
    const gen = makeGen(42);
    const sys = 'Sol';
    const expected = [
      'Sol I', 'Sol II', 'Sol III', 'Sol IV',
      'Sol V', 'Sol VI', 'Sol VII', 'Sol VIII',
    ];
    for (let i = 0; i < 8; i++) {
      expect(gen.generatePlanetName(sys, i)).toBe(expected[i]);
    }
  });

  it('produces different planet names for different orbital indices', () => {
    const gen = makeGen(42);
    const names = new Set(
      Array.from({ length: 8 }, (_, i) => gen.generatePlanetName('Tau', i)),
    );
    expect(names.size).toBe(8);
  });

  it('produces different planet names for different system names', () => {
    const gen = makeGen(42);
    const p1 = gen.generatePlanetName('Alpha', 0);
    const p2 = gen.generatePlanetName('Beta', 0);
    expect(p1).not.toBe(p2);
  });
});

// ── name variety ──────────────────────────────────────────────────────────────

describe('NameGenerator – name variety', () => {
  it('produces catalog-style names (contains a hyphen with digits)', () => {
    // With enough samples we should see at least one catalog name
    const gen = makeGen(300);
    const catalogPattern = /^[A-Za-z]+-\d+$/;
    const names = Array.from({ length: 80 }, () => gen.generateSystemName());
    const hasCatalog = names.some(n => catalogPattern.test(n));
    expect(hasCatalog).toBe(true);
  });

  it('produces fantastical compound names', () => {
    // Compound names end with a known suffix fragment (lowercase)
    const gen = makeGen(200);
    const names = Array.from({ length: 80 }, () => gen.generateSystemName());
    // At least one name should be purely alphabetical and camelCase-ish
    const hasCompound = names.some(n => /^[A-Z][a-z]+[a-z]{3,}$/.test(n) && !/\d/.test(n));
    expect(hasCompound).toBe(true);
  });
});
