import { z } from 'zod';

// HullClassSchema is already exported from technology.ts; import it here for
// internal use only to avoid a duplicate export through the barrel.
import { HullClassSchema } from './technology.js';

// ── Enums matching the TypeScript union types ─────────────────────────────────

export const ComponentTypeSchema = z.enum([
  'weapon_beam',
  'weapon_projectile',
  'weapon_missile',
  'weapon_point_defense',
  'fighter_bay',
  'shield',
  'armor',
  'engine',
  'warp_drive',
  'sensor',
  'repair_drone',
  'special',
  'life_support',
  'targeting_computer',
  'advanced_sensors',
  'damage_control',
  'ecm_suite',
]);

export const SlotCategorySchema = z.enum([
  'weapon',
  'defence',
  'engine',
  'warp_drive',
  'internal',
]);

export const SlotFacingSchema = z.enum([
  'fore',
  'aft',
  'port',
  'starboard',
  'turret',
]);

export const SlotSizeSchema = z.enum(['small', 'medium', 'large']);

// ── SlotPosition ──────────────────────────────────────────────────────────────

export const SlotPositionSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  facing: SlotFacingSchema,
  size: SlotSizeSchema,
  allowedTypes: z.array(ComponentTypeSchema).min(1),
  category: SlotCategorySchema.optional(),
});

// ── HullTemplate ──────────────────────────────────────────────────────────────

export const HullTemplateSchema = z.object({
  class: HullClassSchema,
  name: z.string().min(1),
  baseHullPoints: z.number().int().positive(),
  maxSlots: z.number().int().positive(),
  slotLayout: z.array(SlotPositionSchema).min(1),
  baseCost: z.number().int().positive(),
  baseSpeed: z.number().int().positive(),
  requiredAge: z.string().min(1),
  hangarSlots: z.object({
    count: z.number().int().positive(),
    carriesHull: HullClassSchema,
  }).optional(),
});

// ── ShipComponent ─────────────────────────────────────────────────────────────

export const WeaponCategorySchema = z.enum([
  'energy',
  'kinetic',
  'propulsion',
  'mechanical',
]);

export const ShipComponentSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'ID must be lowercase snake_case'),
  name: z.string().min(1),
  type: ComponentTypeSchema,
  category: WeaponCategorySchema.optional(),
  description: z.string().optional(),
  stats: z.record(z.string(), z.number()),
  cost: z.number().int().positive(),
  requiredTech: z.string().nullable(),
});

// ── ShipDesign ────────────────────────────────────────────────────────────────

export const ShipDesignComponentAssignmentSchema = z.object({
  slotId: z.string().min(1),
  componentId: z.string().min(1),
});

export const ShipDesignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hull: HullClassSchema,
  components: z.array(ShipDesignComponentAssignmentSchema),
  totalCost: z.number().nonnegative(),
  empireId: z.string(),
  armourPlating: z.number().min(0).max(1).optional(),
});

// ── Ship ──────────────────────────────────────────────────────────────────────

export const SystemDamageSchema = z.object({
  engines: z.number().min(0).max(1),
  weapons: z.number().min(0).max(1),
  shields: z.number().min(0).max(1),
  sensors: z.number().min(0).max(1),
  warpDrive: z.number().min(0).max(1),
});

export const ShipSchema = z.object({
  id: z.string().min(1),
  designId: z.string().min(1),
  name: z.string().min(1),
  hullPoints: z.number().int().nonnegative(),
  maxHullPoints: z.number().int().positive(),
  systemDamage: SystemDamageSchema,
  position: z.object({
    systemId: z.string().min(1),
    orbitIndex: z.number().int().nonnegative().optional(),
  }),
  fleetId: z.string().nullable(),
});

// ── Fleet ─────────────────────────────────────────────────────────────────────

export const FleetStanceSchema = z.enum([
  'aggressive',
  'defensive',
  'evasive',
  'patrol',
]);

export const FleetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ships: z.array(z.string()),
  empireId: z.string().min(1),
  position: z.object({ systemId: z.string().min(1) }),
  destination: z.string().nullable(),
  waypoints: z.array(z.string()),
  stance: FleetStanceSchema,
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type ValidatedHullClass = z.infer<typeof HullClassSchema>;
export type ValidatedComponentType = z.infer<typeof ComponentTypeSchema>;
export type ValidatedSlotPosition = z.infer<typeof SlotPositionSchema>;
export type ValidatedHullTemplate = z.infer<typeof HullTemplateSchema>;
export type ValidatedShipComponent = z.infer<typeof ShipComponentSchema>;
export type ValidatedShipDesign = z.infer<typeof ShipDesignSchema>;
export type ValidatedShip = z.infer<typeof ShipSchema>;
export type ValidatedFleet = z.infer<typeof FleetSchema>;

// ── Convenience validators ────────────────────────────────────────────────────

/**
 * Validate a HullTemplate and throw a descriptive error on failure.
 * Returns the validated template unchanged.
 */
export function validateHullTemplate(data: unknown): ValidatedHullTemplate {
  const result = HullTemplateSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid hull template:\n${messages}`);
  }
  return result.data;
}

/**
 * Validate a ShipComponent and throw a descriptive error on failure.
 */
export function validateShipComponent(data: unknown): ValidatedShipComponent {
  const result = ShipComponentSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid ship component:\n${messages}`);
  }
  return result.data;
}

/**
 * Assert that the slot count in slotLayout matches maxSlots.
 */
export function assertSlotCountConsistent(hull: ValidatedHullTemplate): void {
  if (hull.slotLayout.length !== hull.maxSlots) {
    throw new Error(
      `Hull "${hull.class}" declares maxSlots=${hull.maxSlots} but slotLayout has ${hull.slotLayout.length} entries.`,
    );
  }
}
