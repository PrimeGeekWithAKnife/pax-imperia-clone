/**
 * Ship hardpoint metadata types.
 *
 * Ship builders produce merged geometry with no metadata about where engines,
 * weapons, or other features are. These types define the companion metadata
 * that hardpoint provider functions export alongside geometry, enabling
 * accurate engine thrust placement, weapon fire origins, shield bubble sizing,
 * and collision detection.
 *
 * Coordinate convention: local space, origin at ship centre, +Z = bow (fore).
 */

import type * as THREE from 'three';

/** A single engine emitter position on the hull. */
export interface EngineHardpoint {
  /** Local-space position of the engine nozzle/emitter centre. */
  position: THREE.Vector3;
  /** Normalised thrust direction (typically [0, 0, -1] for stern engines). */
  direction: THREE.Vector3;
  /** Radius of the emitter aperture (for sizing glow/plume effects). */
  radius: number;
}

/** A single weapon mount position on the hull surface. */
export interface WeaponHardpoint {
  /** Local-space position of the mount point. */
  position: THREE.Vector3;
  /** Firing arc facing category. */
  facing: 'fore' | 'aft' | 'port' | 'starboard' | 'dorsal' | 'turret';
  /** Surface normal at the mount point (barrel/muzzle flash direction). */
  normal: THREE.Vector3;
}

/** Bounding dimensions computed from the ship geometry. */
export interface ShipBounds {
  /** Bounding sphere radius (half the largest axis extent). */
  radius: number;
  /** Extent along X axis (port-to-starboard). */
  width: number;
  /** Extent along Y axis (ventral-to-dorsal). */
  height: number;
  /** Extent along Z axis (aft-to-bow). */
  length: number;
}

/** Complete metadata for a species ship at a given size/complexity. */
export interface ShipHardpoints {
  engines: EngineHardpoint[];
  weapons: WeaponHardpoint[];
  bounds: ShipBounds;
}

/** Combined build result: geometry + metadata. */
export interface ShipBuildResult {
  geometry: THREE.BufferGeometry;
  hardpoints: ShipHardpoints;
}

/**
 * Signature for a species hardpoint provider function.
 * Returns engines and weapons only — bounds are computed automatically
 * from the geometry's bounding box by the registry.
 */
export type HardpointProvider = (len: number, cx: number) => Omit<ShipHardpoints, 'bounds'>;

// ─── Hardpoint provider registry ──────────────────────────────────────────
// Lives here (not in ShipModels3D) to avoid circular imports — species
// builder files import registerHardpointProvider from here, and
// ShipModels3D imports the builders. If the registry lived in ShipModels3D,
// the circular dependency would cause undefined exports at module init time.

const HARDPOINT_PROVIDERS: Record<string, HardpointProvider> = {};

/** Register a species hardpoint provider. Called at module level by species builders. */
export function registerHardpointProvider(speciesId: string, provider: HardpointProvider): void {
  HARDPOINT_PROVIDERS[speciesId] = provider;
}

/** Look up a registered hardpoint provider (or undefined if none). */
export function getHardpointProvider(speciesId: string): HardpointProvider | undefined {
  return HARDPOINT_PROVIDERS[speciesId];
}
