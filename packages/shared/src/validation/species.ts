import { z } from 'zod';
import { SPECIES_TRAIT_MIN, SPECIES_TRAIT_MAX } from '../constants/game.js';

/** Zod schema matching the AtmosphereType union defined in types/galaxy.ts */
export const AtmosphereTypeSchema = z.enum([
  'oxygen_nitrogen',
  'nitrogen',
  'carbon_dioxide',
  'methane',
  'ammonia',
  'sulfur_dioxide',
  'hydrogen',
  'hydrogen_helium',
  'none',
  'toxic',
  'vacuum',
]);

/** 1–10 trait value */
const TraitValueSchema = z
  .number()
  .int()
  .min(SPECIES_TRAIT_MIN)
  .max(SPECIES_TRAIT_MAX);

export const SpeciesTraitsSchema = z.object({
  construction: TraitValueSchema,
  reproduction: TraitValueSchema,
  research: TraitValueSchema,
  espionage: TraitValueSchema,
  economy: TraitValueSchema,
  combat: TraitValueSchema,
  diplomacy: TraitValueSchema,
});

export const EnvironmentPreferenceSchema = z.object({
  idealTemperature: z.number().positive(),
  temperatureTolerance: z.number().nonnegative(),
  idealGravity: z.number().positive(),
  gravityTolerance: z.number().nonnegative(),
  preferredAtmospheres: z.array(AtmosphereTypeSchema).min(1),
});

export const SpecialAbilitySchema = z.enum([
  'psychic',
  'aquatic',
  'silicon_based',
  'hive_mind',
  'cybernetic',
  'nomadic',
  'subterranean',
  'photosynthetic',
]);

export const SpeciesSchema = z.object({
  id: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'ID must be lowercase snake_case'),
  name: z.string().min(1),
  description: z.string().min(1),
  portrait: z.string().min(1),
  traits: SpeciesTraitsSchema,
  environmentPreference: EnvironmentPreferenceSchema,
  specialAbilities: z.array(SpecialAbilitySchema),
  isPrebuilt: z.boolean(),
});

export type ValidatedSpeciesTraits = z.infer<typeof SpeciesTraitsSchema>;
export type ValidatedEnvironmentPreference = z.infer<typeof EnvironmentPreferenceSchema>;
export type ValidatedSpecies = z.infer<typeof SpeciesSchema>;

/** Sum of all seven trait values */
export function totalTraitPoints(traits: ValidatedSpeciesTraits): number {
  return (
    traits.construction +
    traits.reproduction +
    traits.research +
    traits.espionage +
    traits.economy +
    traits.combat +
    traits.diplomacy
  );
}
