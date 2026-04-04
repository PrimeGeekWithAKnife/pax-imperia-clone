import { z } from 'zod';

// ── Enums matching the TypeScript union types ─────────────────────────────────

export const TechAgeSchema = z.enum([
  'nano_atomic',
  'fusion',
  'nano_fusion',
  'anti_matter',
  'singularity',
]);

export const TechCategorySchema = z.enum([
  'weapons',
  'defense',
  'propulsion',
  'biology',
  'construction',
  'racial',
]);

export const HullClassSchema = z.enum([
  'science_probe', 'spy_probe', 'drone',
  'fighter', 'bomber', 'patrol', 'yacht',
  'corvette',
  'cargo', 'transport',
  'frigate', 'destroyer',
  'large_transport', 'large_cargo',
  'light_cruiser', 'heavy_cruiser',
  'large_supplier', 'carrier',
  'light_battleship', 'battleship',
  'heavy_battleship', 'super_carrier',
  'battle_station', 'small_space_station',
  'space_station', 'large_space_station', 'planet_killer',
  'coloniser_gen1', 'coloniser_gen2', 'coloniser_gen3', 'coloniser_gen4', 'coloniser_gen5',
]);

// ── TechEffect discriminated union ────────────────────────────────────────────

export const TechEffectSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('unlock_hull'),
    hullClass: HullClassSchema,
  }),
  z.object({
    type: z.literal('unlock_component'),
    componentId: z.string().min(1),
  }),
  z.object({
    type: z.literal('unlock_building'),
    buildingType: z.string().min(1),
  }),
  z.object({
    type: z.literal('stat_bonus'),
    stat: z.string().min(1),
    value: z.number(),
  }),
  z.object({
    type: z.literal('enable_ability'),
    ability: z.string().min(1),
  }),
  z.object({
    type: z.literal('resource_bonus'),
    resource: z.string().min(1),
    multiplier: z.number().positive(),
  }),
  z.object({
    type: z.literal('age_unlock'),
    age: TechAgeSchema,
  }),
]);

// ── Technology ────────────────────────────────────────────────────────────────

export const TechnologySchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'ID must be lowercase snake_case'),
  name: z.string().min(1),
  description: z.string().min(20),
  category: TechCategorySchema,
  age: TechAgeSchema,
  cost: z.number().int().positive(),
  prerequisites: z.array(z.string()),
  effects: z.array(TechEffectSchema).min(1),
  icon: z.string().optional(),
  speciesId: z.string().min(1).optional(),
});

// ── TechTree ──────────────────────────────────────────────────────────────────

export const TechTreeSchema = z.object({
  technologies: z.array(TechnologySchema).min(1),
  ageGates: z.record(TechAgeSchema, z.array(z.string())),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type ValidatedTechEffect = z.infer<typeof TechEffectSchema>;
export type ValidatedTechnology = z.infer<typeof TechnologySchema>;
export type ValidatedTechTree = z.infer<typeof TechTreeSchema>;
