/** Technology tree types */

import type { TechAge } from './species.js';
import type { HullClass } from './ships.js';

export type TechCategory =
  | 'weapons'
  | 'defense'
  | 'propulsion'
  | 'biology'
  | 'construction'
  | 'racial';

export type TechEffect =
  | { type: 'unlock_hull'; hullClass: HullClass }
  | { type: 'unlock_component'; componentId: string }
  | { type: 'unlock_building'; buildingType: string }
  | { type: 'stat_bonus'; stat: string; value: number }
  | { type: 'enable_ability'; ability: string }
  | { type: 'resource_bonus'; resource: string; multiplier: number }
  | { type: 'age_unlock'; age: TechAge };

export interface Technology {
  id: string;
  name: string;
  description: string;
  category: TechCategory;
  age: TechAge;
  cost: number;
  prerequisites: string[];
  effects: TechEffect[];
  icon?: string;
  /** If set, this tech is only available to empires whose species ID matches. */
  speciesId?: string;
}

export interface TechTree {
  technologies: Technology[];
  /** Tech IDs that must be researched to unlock each age transition. */
  ageGates: Partial<Record<TechAge, string[]>>;
}
