/** Ship design and fleet types */

export type HullClass =
  | 'scout'
  | 'destroyer'
  | 'transport'
  | 'cruiser'
  | 'carrier'
  | 'battleship'
  | 'coloniser'
  | 'dreadnought'
  | 'battle_station'
  | 'deep_space_probe';

export interface HullTemplate {
  class: HullClass;
  name: string;
  baseHullPoints: number;
  maxSlots: number;
  slotLayout: SlotPosition[];
  baseCost: number;
  /** Optional mineral cost — deducted alongside credits when production starts. */
  baseMineralCost?: number;
  baseSpeed: number;
  requiredAge: string; // TechAge required to build
}

export interface SlotPosition {
  id: string;
  x: number;
  y: number;
  facing: 'fore' | 'aft' | 'port' | 'starboard' | 'turret';
  size: 'small' | 'medium' | 'large';
  allowedTypes: ComponentType[];
}

export type ComponentType =
  | 'weapon_beam'
  | 'weapon_projectile'
  | 'weapon_missile'
  | 'weapon_point_defense'
  | 'fighter_bay'
  | 'shield'
  | 'armor'
  | 'engine'
  | 'warp_drive'
  | 'sensor'
  | 'repair_drone'
  | 'special';

export type WeaponCategory =
  | 'energy'
  | 'kinetic'
  | 'propulsion'
  | 'mechanical';

export interface ShipComponent {
  id: string;
  name: string;
  type: ComponentType;
  category?: WeaponCategory;
  description?: string;
  stats: Record<string, number>;
  cost: number;
  requiredTech: string | null;
}

export interface ShipDesign {
  id: string;
  name: string;
  hull: HullClass;
  components: { slotId: string; componentId: string }[];
  totalCost: number;
  empireId: string;
}

export type CrewExperienceLevel = 'green' | 'regular' | 'veteran' | 'elite';

export interface Ship {
  id: string;
  designId: string;
  name: string;
  hullPoints: number;
  maxHullPoints: number;
  systemDamage: SystemDamage;
  position: { systemId: string; orbitIndex?: number };
  fleetId: string | null;
  /** Crew experience level, gained through combat. Defaults to 'green' when absent. */
  crewExperience?: CrewExperienceLevel;
}

export interface SystemDamage {
  engines: number;    // 0-1 (0 = undamaged, 1 = destroyed)
  weapons: number;
  shields: number;
  sensors: number;
  warpDrive: number;
}

export interface Fleet {
  id: string;
  name: string;
  ships: string[];    // Ship IDs
  empireId: string;
  position: { systemId: string };
  destination: string | null; // Target system ID
  waypoints: string[];
  stance: FleetStance;
  /** What this fleet orbits in its current system. 'star' = system patrol, planet ID = defending that planet. */
  orbitTarget?: 'star' | string;
}

export type FleetStance =
  | 'aggressive'
  | 'defensive'
  | 'evasive'
  | 'patrol';
