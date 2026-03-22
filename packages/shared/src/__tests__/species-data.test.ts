import { describe, it, expect } from 'vitest';
import { PREBUILT_SPECIES, PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import { SpeciesSchema, totalTraitPoints } from '../validation/species.js';

const EXPECTED_SPECIES_COUNT = 15;
const TRAIT_POINTS_MIN = 36;
const TRAIT_POINTS_MAX = 50;
const EXPECTED_IDS = [
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

describe('Prebuilt species data', () => {
  it(`exports exactly ${EXPECTED_SPECIES_COUNT} species`, () => {
    expect(PREBUILT_SPECIES).toHaveLength(EXPECTED_SPECIES_COUNT);
  });

  it('contains all expected species IDs', () => {
    const ids = PREBUILT_SPECIES.map((s) => s.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
  });

  it('has unique IDs across all species', () => {
    const ids = PREBUILT_SPECIES.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has unique names across all species', () => {
    const names = PREBUILT_SPECIES.map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('PREBUILT_SPECIES_BY_ID map contains all species', () => {
    for (const species of PREBUILT_SPECIES) {
      expect(PREBUILT_SPECIES_BY_ID[species.id]).toBe(species);
    }
  });

  it('PREBUILT_SPECIES_BY_ID has no extra keys', () => {
    expect(Object.keys(PREBUILT_SPECIES_BY_ID)).toHaveLength(EXPECTED_SPECIES_COUNT);
  });

  describe.each(PREBUILT_SPECIES.map((s) => [s.id, s] as [string, typeof s]))(
    'species "%s"',
    (id, species) => {
      it('passes Zod schema validation', () => {
        const result = SpeciesSchema.safeParse(species);
        if (!result.success) {
          // Surface readable errors on failure
          throw new Error(
            `Validation failed for "${id}":\n${result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n')}`,
          );
        }
        expect(result.success).toBe(true);
      });

      it('has isPrebuilt === true', () => {
        expect(species.isPrebuilt).toBe(true);
      });

      it('has a non-empty description', () => {
        expect(species.description.trim().length).toBeGreaterThan(20);
      });

      it('has a non-empty portrait key', () => {
        expect(species.portrait.trim().length).toBeGreaterThan(0);
      });

      it(`has total trait points between ${TRAIT_POINTS_MIN} and ${TRAIT_POINTS_MAX}`, () => {
        const total = totalTraitPoints(species.traits);
        expect(total).toBeGreaterThanOrEqual(TRAIT_POINTS_MIN);
        expect(total).toBeLessThanOrEqual(TRAIT_POINTS_MAX);
      });

      it('has all trait values in range 1–10', () => {
        for (const [traitName, value] of Object.entries(species.traits)) {
          expect(value, `trait "${traitName}" on species "${id}"`).toBeGreaterThanOrEqual(1);
          expect(value, `trait "${traitName}" on species "${id}"`).toBeLessThanOrEqual(10);
        }
      });

      it('has at least one preferred atmosphere', () => {
        expect(species.environmentPreference.preferredAtmospheres.length).toBeGreaterThan(0);
      });

      it('has at least one special ability', () => {
        expect(species.specialAbilities.length).toBeGreaterThan(0);
      });

      it('has positive gravity and temperature preferences', () => {
        expect(species.environmentPreference.idealGravity).toBeGreaterThan(0);
        expect(species.environmentPreference.idealTemperature).toBeGreaterThan(0);
      });
    },
  );
});
