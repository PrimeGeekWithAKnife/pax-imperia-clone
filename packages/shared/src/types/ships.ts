/** Ship design and fleet types */

export type HullClass =
  | 'science_probe' | 'spy_probe' | 'drone'
  | 'fighter' | 'bomber' | 'patrol' | 'yacht'
  | 'corvette'
  | 'cargo' | 'transport'
  | 'frigate' | 'destroyer'
  | 'large_transport' | 'large_cargo'
  | 'light_cruiser' | 'heavy_cruiser'
  | 'large_supplier' | 'carrier'
  | 'light_battleship' | 'battleship'
  | 'heavy_battleship' | 'super_carrier'
  | 'battle_station' | 'small_space_station'
  | 'space_station' | 'large_space_station' | 'planet_killer'
  | 'coloniser_gen1' | 'coloniser_gen2' | 'coloniser_gen3' | 'coloniser_gen4' | 'coloniser_gen5';

/** Slot categories — each slot belongs to exactly one category. */
export type SlotCategory =
  | 'weapon'
  | 'defence'
  | 'engine'
  | 'warp_drive'
  | 'internal';

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
  /** Hangar configuration — defines bay count and what each bay can hold.
   *  Each bay can hold ONE option from the carries array (e.g. 1 carrier OR 5 destroyers). */
  hangarSlots?: { count: number; carries: Array<{ hull: HullClass; quantity: number }> };
  /** Hull type determines the wireframe model used. Multiple vessel classes can share a hull type. */
  hullType?: string;
  /** Ship length in metres. */
  lengthMetres?: number;
  /** Required shipyard size to build. */
  requiredShipyard?: string;
  /** Whether the player can build this vessel. */
  playerBuildable?: boolean;
  /** Intended role/purpose description. */
  purpose?: string;
  /** Build time in ticks. */
  buildTime?: number;
  /** Whether this hull requires crew. Probes/drones are unmanned. Defaults to true. */
  manned?: boolean;
  /** Base supply capacity in turns for manned hulls. Defaults to 15. */
  baseSupplyCapacity?: number;
  /** Base crew complement for this hull class. */
  baseCrew?: number;
}

export interface SlotPosition {
  id: string;
  x: number;
  y: number;
  facing: 'fore' | 'aft' | 'port' | 'starboard' | 'turret';
  size: 'small' | 'medium' | 'large' | 'huge' | 'colossal' | 'gargantuan';
  allowedTypes: ComponentType[];
  /** Slot category — determines which section this slot appears in. */
  category?: SlotCategory;
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
  | 'special'
  | 'life_support'
  | 'targeting_computer'
  | 'advanced_sensors'
  | 'damage_control'
  | 'ecm_suite'
  | 'scanner'
  | 'power_reactor'
  | 'rcs_thrusters'
  | 'temperature_control'
  | 'comms_array'
  | 'bio_reclamation'
  | 'computer_core';

/** Core system roles — every manned ship has one of each at baseline Mk I. */
export type CoreSystemRole =
  | 'computer_core'
  | 'life_support'
  | 'sensor_suite'
  | 'power_reactor'
  | 'rcs_thrusters'
  | 'main_engine'
  | 'temperature_control'
  | 'comms_array'
  | 'bio_reclamation';

export const ALL_CORE_SYSTEM_ROLES: CoreSystemRole[] = [
  'computer_core', 'life_support', 'sensor_suite', 'power_reactor',
  'rcs_thrusters', 'main_engine', 'temperature_control', 'comms_array', 'bio_reclamation',
];

export const CORE_SYSTEM_LABELS: Record<CoreSystemRole, string> = {
  computer_core: 'Computer Core',
  life_support: 'Life Support',
  sensor_suite: 'Sensor Suite',
  power_reactor: 'Power Reactor',
  rcs_thrusters: 'RCS Thrusters',
  main_engine: 'Main Engine',
  temperature_control: 'Temperature Control',
  comms_array: 'Comms Array',
  bio_reclamation: 'Bio Reclamation',
};

/** Component types that belong to each slot category. */
export const SLOT_CATEGORY_TYPES: Record<SlotCategory, ComponentType[]> = {
  weapon: ['weapon_beam', 'weapon_projectile', 'weapon_missile', 'weapon_point_defense', 'fighter_bay'],
  defence: ['shield', 'armor'],
  engine: ['engine'],
  warp_drive: ['warp_drive'],
  internal: ['sensor', 'repair_drone', 'special', 'life_support', 'targeting_computer', 'advanced_sensors', 'damage_control', 'ecm_suite', 'scanner', 'power_reactor', 'rcs_thrusters', 'temperature_control', 'comms_array', 'bio_reclamation', 'computer_core'],
};

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
  /** Minimum tech age required for this component (for skirmish/design filtering). */
  minAge?: string;
  /** If set, this component serves as a tier upgrade for the named core system. */
  coreSystemRole?: CoreSystemRole;
}

export interface ShipDesign {
  id: string;
  name: string;
  hull: HullClass;
  components: { slotId: string; componentId: string }[];
  totalCost: number;
  empireId: string;
  /** Armour plating fraction (0 = none, 1 = maximum). Affects HP and cost. */
  armourPlating?: number;
  /** Core system tier overrides. Missing entries use Mk I baseline. */
  coreSystemOverrides?: Array<{ role: CoreSystemRole; componentId: string }>;
}

export type CrewExperienceLevel =
  | 'recruit'     // Level 1 — I
  | 'trained'     // Level 2 — II
  | 'regular'     // Level 3 — III
  | 'seasoned'    // Level 4 — ‹
  | 'veteran'     // Level 5 — ‹‹
  | 'hardened'    // Level 6 — ‹‹‹
  | 'elite'       // Level 7 — ★
  | 'ace'         // Level 8 — ★★
  | 'legendary';  // Level 9 — ★★★

/** Ordered list of experience levels for promotion logic. */
export const EXPERIENCE_LEVELS: readonly CrewExperienceLevel[] = [
  'recruit', 'trained', 'regular', 'seasoned', 'veteran',
  'hardened', 'elite', 'ace', 'legendary',
];

/** Visual indicator for each experience level. */
export const EXPERIENCE_INSIGNIA: Record<CrewExperienceLevel, string> = {
  recruit:   'I',
  trained:   'II',
  regular:   'III',
  seasoned:  '\u2039',       // ‹
  veteran:   '\u2039\u2039', // ‹‹
  hardened:  '\u2039\u2039\u2039', // ‹‹‹
  elite:     '\u2605',       // ★
  ace:       '\u2605\u2605', // ★★
  legendary: '\u2605\u2605\u2605', // ★★★
};

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
  /** If set, this ship is carried inside another ship (carrier/battle station). */
  carriedBy?: string;
  /** Turns of supply remaining. Omit for backward compat (treated as full). */
  suppliesRemaining?: number;
  /** Maximum supply capacity derived from hull + bio reclamation tier. */
  maxSupplies?: number;
  /** Magazine fill level 0-1. Omit for backward compat (treated as 1.0). */
  magazineLevel?: number;
  /** Crew count derived from hull class. */
  crewCount?: number;
}

export interface SystemDamage {
  engines: number;    // 0-1 (0 = undamaged, 1 = destroyed)
  weapons: number;
  shields: number;
  sensors: number;
  warpDrive: number;
  computerCore?: number;
  lifeSupport?: number;
  rcsThrusters?: number;
  temperatureControl?: number;
  commsArray?: number;
  bioReclamation?: number;
  powerReactor?: number;
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
  /** When true, fleet cycles through waypoints repeatedly. */
  patrolling?: boolean;
  /** Original patrol route waypoints — restored when patrol cycle completes. */
  patrolRoute?: string[];
  /** Name of the admiral commanding this fleet (if assigned). */
  admiralName?: string;
}

export type FleetStance =
  | 'aggressive'
  | 'defensive'
  | 'evasive'
  | 'patrol';

// ---------------------------------------------------------------------------
// Armour plating helpers
// ---------------------------------------------------------------------------

/** Calculate effective hull points with armour plating applied. */
export function getEffectiveHullPoints(baseHP: number, armourPlating: number): number {
  const ap = Math.max(0, Math.min(1, armourPlating));
  return Math.round(baseHP * (1 + 2 * ap));
}

/** Calculate effective cost with armour plating applied. */
export function getEffectiveCost(baseCost: number, armourPlating: number): number {
  const ap = Math.max(0, Math.min(1, armourPlating));
  return Math.round(baseCost * (1 + 3 * ap));
}
