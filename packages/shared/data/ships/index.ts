import type { HullTemplate, ShipComponent } from '../../src/types/ships.js';

import hullTemplatesData from './hull-templates.json' with { type: 'json' };
import componentsData from './components.json' with { type: 'json' };

/** All hull templates as a typed array. */
export const HULL_TEMPLATES: HullTemplate[] = hullTemplatesData as HullTemplate[];

/** Lookup map from hull class to HullTemplate. */
export const HULL_TEMPLATE_BY_CLASS: Readonly<Record<string, HullTemplate>> =
  Object.fromEntries(HULL_TEMPLATES.map((h) => [h.class, h]));

/** All ship components as a typed array. */
export const SHIP_COMPONENTS: ShipComponent[] = componentsData as unknown as ShipComponent[];

/** Lookup map from component ID to ShipComponent. */
export const SHIP_COMPONENT_BY_ID: Readonly<Record<string, ShipComponent>> =
  Object.fromEntries(SHIP_COMPONENTS.map((c) => [c.id, c]));

/** Components that require no technology (available at game start). */
export const STARTING_COMPONENTS: ShipComponent[] = SHIP_COMPONENTS.filter(
  (c) => c.requiredTech === null,
);
