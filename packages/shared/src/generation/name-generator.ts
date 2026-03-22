/**
 * Procedural star system and planet naming.
 *
 * Produces three flavours of names:
 *   1. Greco-Latin sounding names  (Arcturus, Vexorin, …)
 *   2. Catalog numbers              (Kepler-442, HD-9182, …)
 *   3. Fantastical compound names   (Shadowveil, Ironreach, …)
 *
 * Planets are always "[System] I", "[System] II", … (Roman numerals).
 */

import type { SeededRng } from './galaxy-generator.js';

// ── syllable banks ───────────────────────────────────────────────────────────

const PREFIXES = [
  'Al', 'Arc', 'Ax', 'Bel', 'Cal', 'Cen', 'Cor', 'Del', 'Den', 'Dra',
  'Ep', 'Eri', 'For', 'Gem', 'Hel', 'Hyd', 'Igi', 'Ix', 'Jor', 'Kap',
  'Kel', 'Kor', 'Lam', 'Leo', 'Lyr', 'Mal', 'Men', 'Mir', 'Mor', 'Neb',
  'Niv', 'Nov', 'Orb', 'Ori', 'Peg', 'Per', 'Phe', 'Pol', 'Pro', 'Pyx',
  'Reg', 'Rig', 'Sar', 'Sco', 'Ser', 'Sib', 'Sig', 'Sol', 'Syl', 'Tau',
  'Tel', 'Tor', 'Tri', 'Umb', 'Ux', 'Veg', 'Vel', 'Vex', 'Vir', 'Vol',
  'Vor', 'Vul', 'Wyn', 'Xan', 'Xer', 'Yld', 'Zan', 'Zen', 'Zer', 'Zor',
];

const MIDDLES = [
  'a', 'al', 'an', 'ar', 'as', 'at', 'en', 'er', 'es', 'et',
  'ia', 'il', 'in', 'io', 'is', 'ix', 'on', 'or', 'ox', 'ul',
  'um', 'un', 'ur', 'us', 'ux',
];

const SUFFIXES = [
  'ae', 'ais', 'al', 'an', 'ar', 'ard', 'aris', 'ath', 'ax', 'bus',
  'dae', 'dar', 'das', 'den', 'dis', 'dor', 'dus', 'el', 'em', 'en',
  'eon', 'era', 'eus', 'ex', 'ian', 'iel', 'igh', 'il', 'im', 'ine',
  'ion', 'ior', 'ira', 'is', 'ix', 'kos', 'lis', 'lon', 'lor', 'lus',
  'mos', 'mus', 'nas', 'nis', 'nor', 'nus', 'on', 'or', 'orin', 'oris',
  'orn', 'os', 'oth', 'ous', 'ox', 'ran', 'ras', 'rin', 'ris', 'ron',
  'ros', 'run', 'rus', 'sar', 'sus', 'tar', 'tis', 'ton', 'tor', 'tus',
  'us', 'van', 'var', 'vax', 'ven', 'ver', 'vex', 'via', 'vir', 'vor',
  'vos', 'vox', 'yan', 'yon', 'yor', 'yos', 'zan', 'zen', 'zor', 'zus',
];

// ── fantastical compound names ────────────────────────────────────────────────

const FANTASY_PARTS_A = [
  'Shadow', 'Iron', 'Storm', 'Frost', 'Ember', 'Silver', 'Dark', 'Dawn',
  'Star', 'Void', 'Crimson', 'Hollow', 'Ashen', 'Bright', 'Cinder',
  'Crystal', 'Deep', 'Dusk', 'Eclipse', 'Fading', 'Flame', 'Gleam',
  'Gold', 'Grave', 'Haze', 'Horizon', 'Ice', 'Jade', 'Kael', 'Lament',
  'Light', 'Mist', 'Moon', 'Night', 'Obsidian', 'Pale', 'Phantom',
  'Prism', 'Ruin', 'Rust', 'Sable', 'Scarlet', 'Silent', 'Smoke',
  'Snow', 'Solar', 'Stone', 'Swift', 'Terra', 'Thunder', 'Twilight',
  'Veil', 'Violet', 'Warp', 'Winter', 'Wraith',
];

const FANTASY_PARTS_B = [
  'reach', 'veil', 'fall', 'forge', 'gate', 'haven', 'hold', 'mark',
  'peak', 'rift', 'rise', 'run', 'scape', 'sea', 'shore', 'spire',
  'tide', 'vale', 'watch', 'way', 'wind', 'wish', 'wood', 'world',
  'break', 'born', 'crest', 'drift', 'edge', 'end', 'field', 'flame',
  'flow', 'fold', 'gaze', 'glow', 'grove', 'heart', 'keep', 'light',
  'line', 'mantle', 'maw', 'mere', 'mind', 'mire', 'mouth', 'nest',
  'path', 'point', 'port', 'pulse', 'reach', 'rest', 'ring', 'rock',
];

// ── catalog prefixes ─────────────────────────────────────────────────────────

const CATALOG_PREFIXES = [
  'Kepler', 'HD', 'HIP', 'Gliese', 'Wolf', 'BD', 'LHS', 'TOI',
  'TrES', 'WASP', 'HAT', 'CoRoT', 'OGLE', 'KOI', 'Proxima',
];

// ── Roman numeral helper ──────────────────────────────────────────────────────

const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII',
];

export function toRomanNumeral(n: number): string {
  if (n >= 1 && n <= ROMAN_NUMERALS.length) {
    return ROMAN_NUMERALS[n - 1]!;
  }
  return String(n);
}

// ── name-generator class ──────────────────────────────────────────────────────

export class NameGenerator {
  private rng: SeededRng;
  private usedSystemNames = new Set<string>();

  constructor(rng: SeededRng) {
    this.rng = rng;
  }

  /** Returns the number of already-generated system names (for diagnostics). */
  get usedCount(): number {
    return this.usedSystemNames.size;
  }

  // ── public API ──────────────────────────────────────────────────────────────

  generateSystemName(): string {
    let name: string;
    let attempts = 0;
    do {
      name = this.nextSystemName();
      attempts++;
      // Safety valve: if the pool gets exhausted append a counter
      if (attempts > 200) {
        name = `${name}-${this.usedSystemNames.size}`;
        break;
      }
    } while (this.usedSystemNames.has(name));

    this.usedSystemNames.add(name);
    return name;
  }

  generatePlanetName(systemName: string, orbitalIndex: number): string {
    return `${systemName} ${toRomanNumeral(orbitalIndex + 1)}`;
  }

  // ── private helpers ─────────────────────────────────────────────────────────

  private nextSystemName(): string {
    const roll = this.rng.next();

    if (roll < 0.20) {
      return this.makeCatalogName();
    } else if (roll < 0.45) {
      return this.makeFantasyName();
    } else {
      return this.makeGrecoLatinName();
    }
  }

  private makeGrecoLatinName(): string {
    const prefix = this.pick(PREFIXES);
    const roll = this.rng.next();

    if (roll < 0.4) {
      // Short: prefix + suffix  (e.g. "Arcturis")
      const suffix = this.pick(SUFFIXES);
      return `${prefix}${suffix.toLowerCase()}`;
    } else {
      // Medium: prefix + middle + suffix  (e.g. "Arcanoris")
      const middle = this.pick(MIDDLES);
      const suffix = this.pick(SUFFIXES);
      return `${prefix}${middle}${suffix}`;
    }
  }

  private makeFantasyName(): string {
    const a = this.pick(FANTASY_PARTS_A);
    const b = this.pick(FANTASY_PARTS_B);
    return `${a}${b}`;
  }

  private makeCatalogName(): string {
    const prefix = this.pick(CATALOG_PREFIXES);
    // Number in range 100–9999
    const num = Math.floor(this.rng.next() * 9900) + 100;
    return `${prefix}-${num}`;
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rng.next() * arr.length)] as T;
  }
}
