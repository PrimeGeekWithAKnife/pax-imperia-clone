/**
 * ShipModels3D — Per-species 3D ship geometry registry.
 *
 * Each species has a unique design language built from Three.js primitives,
 * merged via BufferGeometryUtils. Ships face along +Z (front), centred at
 * the origin, and scale from ~2 units (scout) to ~20 units (dreadnought).
 *
 * Individual species builders are in ./ships/{species}.ts
 *
 * Usage:
 *   const geo = generateShipGeometry('teranos', 'destroyer');
 *   const mat = getShipMaterial('teranos');
 *   const mesh = new THREE.Mesh(geo, mat);
 */

import * as THREE from 'three';
import type { HullClass } from '@nova-imperia/shared';

// Import all species builders
import { buildTeranos } from './ships/teranos';
import { buildKhazari } from './ships/khazari';
import { buildVaelori } from './ships/vaelori';
import { buildSylvani } from './ships/sylvani';
import { buildNexari } from './ships/nexari';
import { buildDrakmari } from './ships/drakmari';
import { buildAshkari } from './ships/ashkari';
import { buildLuminari } from './ships/luminari';
import { buildZorvathi } from './ships/zorvathi';
import { buildOrivani } from './ships/orivani';
import { buildKaelenth } from './ships/kaelenth';
import { buildThyriaq } from './ships/thyriaq';
import { buildAethyn } from './ships/aethyn';
import { buildVethara } from './ships/vethara';
import { buildPyrenth } from './ships/pyrenth';

// Re-export helpers for any external use
export { place, merge, mirrorX } from './shipModelHelpers';

// Re-export hardpoint types and registry for consumers
export type {
  EngineHardpoint, WeaponHardpoint, ShipBounds,
  ShipHardpoints, ShipBuildResult, HardpointProvider,
} from './shipHardpoints';
export { registerHardpointProvider, getHardpointProvider } from './shipHardpoints';

// ─── Hull class scale factors ───────────────────────────────────────────────
// Length in world units for each hull class — from probe (~1.5) to battle
// station (~24). Width and height are derived per-species.

const HULL_SCALE: Partial<Record<HullClass, number>> = {
  science_probe: 1.5, spy_probe: 1.5, drone: 1.5,
  fighter: 1.8, bomber: 2.0, patrol: 2.0, yacht: 2.5,
  corvette: 3.0,
  cargo: 4.0, transport: 5.0,
  frigate: 3.5, destroyer: 4.0,
  large_transport: 6.0, large_cargo: 6.0,
  light_cruiser: 8.0, heavy_cruiser: 9.0,
  large_supplier: 7.0, carrier: 10.0,
  light_battleship: 12.0, battleship: 14.0,
  heavy_battleship: 20.0, super_carrier: 16.0,
  battle_station: 24.0, small_space_station: 18.0,
  space_station: 28.0, large_space_station: 36.0, planet_killer: 40.0,
  coloniser_gen1: 6.0, coloniser_gen2: 7.0, coloniser_gen3: 8.0,
  coloniser_gen4: 10.0, coloniser_gen5: 12.0,
};

/** Complexity tier — larger hulls get more detail parts. */
const HULL_COMPLEXITY: Partial<Record<HullClass, number>> = {
  science_probe: 0, spy_probe: 0, drone: 0,
  fighter: 1, bomber: 1, patrol: 1, yacht: 1,
  corvette: 2,
  cargo: 2, transport: 2,
  frigate: 2, destroyer: 2,
  large_transport: 3, large_cargo: 3,
  light_cruiser: 3, heavy_cruiser: 4,
  large_supplier: 3, carrier: 4,
  light_battleship: 5, battleship: 5,
  heavy_battleship: 6, super_carrier: 5,
  battle_station: 7, small_space_station: 6,
  space_station: 7, large_space_station: 8, planet_killer: 8,
  coloniser_gen1: 2, coloniser_gen2: 3, coloniser_gen3: 3,
  coloniser_gen4: 4, coloniser_gen5: 5,
};

// ─── Builder registry ───────────────────────────────────────────────────────

type ShipBuilder = (len: number, cx: number) => THREE.BufferGeometry;

import type {
  EngineHardpoint, WeaponHardpoint, ShipBounds,
  ShipHardpoints, ShipBuildResult, HardpointProvider,
} from './shipHardpoints';
import { getHardpointProvider } from './shipHardpoints';

const BUILDERS: Record<string, ShipBuilder> = {
  teranos:  buildTeranos,
  khazari:  buildKhazari,
  vaelori:  buildVaelori,
  sylvani:  buildSylvani,
  nexari:   buildNexari,
  drakmari: buildDrakmari,
  ashkari:  buildAshkari,
  luminari: buildLuminari,
  zorvathi: buildZorvathi,
  orivani:  buildOrivani,
  kaelenth: buildKaelenth,
  thyriaq:  buildThyriaq,
  aethyn:   buildAethyn,
  vethara:  buildVethara,
  pyrenth:  buildPyrenth,
};

// ─── Geometry cache ─────────────────────────────────────────────────────────
// Key: "speciesId:hullClass". Callers receive a .clone() which is cheap —
// it shares the underlying typed-array data via copy-on-write semantics
// in most JS engines, and avoids the expensive merge/toNonIndexed rebuild.

const _geometryCache = new Map<string, THREE.BufferGeometry>();

/** Clear the geometry cache (useful on scene teardown to free GPU memory). */
export function clearShipGeometryCache(): void {
  for (const geo of _geometryCache.values()) geo.dispose();
  _geometryCache.clear();
  _buildResultCache.clear();
}

// ─── Build result cache ───────────────────────────────────────────────────
// Stores geometry + hardpoint metadata together. The old _geometryCache is
// populated as a side-effect for backward compatibility.

const _buildResultCache = new Map<string, ShipBuildResult>();

// ─── Default hardpoint generator ──────────────────────────────────────────

function generateDefaultHardpoints(
  len: number,
  cx: number,
  bounds: ShipBounds,
): Omit<ShipHardpoints, 'bounds'> {
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // Default engines: 2-5 nozzles spread across stern
  const nozzleCount = Math.min(2 + Math.floor(cx * 0.6), 5);
  const spread = bounds.width * 0.4;
  for (let i = 0; i < nozzleCount; i++) {
    const nx = nozzleCount === 1
      ? 0
      : (i - (nozzleCount - 1) / 2) * (spread / Math.max(nozzleCount - 1, 1));
    engines.push({
      position: new THREE.Vector3(nx, 0, -len * 0.48),
      direction: new THREE.Vector3(0, 0, -1),
      radius: len * 0.04,
    });
  }

  // Default weapons: dorsal turrets at hull edges, count scales with complexity
  if (cx >= 1) {
    // Fore weapon
    weapons.push({
      position: new THREE.Vector3(0, bounds.height * 0.4, len * 0.3),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });
  }
  if (cx >= 2) {
    // Port/starboard turrets
    weapons.push(
      {
        position: new THREE.Vector3(-bounds.width * 0.4, bounds.height * 0.3, len * 0.05),
        facing: 'port',
        normal: new THREE.Vector3(-1, 0.3, 0).normalize(),
      },
      {
        position: new THREE.Vector3(bounds.width * 0.4, bounds.height * 0.3, len * 0.05),
        facing: 'starboard',
        normal: new THREE.Vector3(1, 0.3, 0).normalize(),
      },
    );
  }
  if (cx >= 3) {
    // Dorsal turrets
    weapons.push(
      {
        position: new THREE.Vector3(-bounds.width * 0.25, bounds.height * 0.45, -len * 0.1),
        facing: 'turret',
        normal: new THREE.Vector3(0, 1, 0),
      },
      {
        position: new THREE.Vector3(bounds.width * 0.25, bounds.height * 0.45, -len * 0.1),
        facing: 'turret',
        normal: new THREE.Vector3(0, 1, 0),
      },
    );
  }
  if (cx >= 5) {
    // Aft weapons
    weapons.push({
      position: new THREE.Vector3(0, bounds.height * 0.3, -len * 0.35),
      facing: 'aft',
      normal: new THREE.Vector3(0, 0, -1),
    });
  }

  return { engines, weapons };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate procedural 3D geometry + hardpoint metadata for a species + hull
 * class combination.
 *
 * Ships face along +Z (bow), centred at origin.
 * Scale ranges from ~1.5 units (probe) to ~40 units (planet killer).
 *
 * Results are cached by speciesId:hullClass:maxComplexity — subsequent calls
 * for the same key return the cached result directly.
 */
export function generateShipBuildResult(
  speciesId: string,
  hullClass: HullClass,
  maxComplexity?: number,
): ShipBuildResult {
  const cx = Math.min(HULL_COMPLEXITY[hullClass] ?? 2, maxComplexity ?? 8);
  const key = `${speciesId}:${hullClass}:${cx}`;

  const cached = _buildResultCache.get(key);
  if (cached) return cached;

  const builder = BUILDERS[speciesId] ?? BUILDERS.teranos;
  const len = HULL_SCALE[hullClass] ?? 4;
  const geo = builder(len, cx);
  geo.computeVertexNormals();

  // Compute bounding dimensions from the geometry
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const bounds: ShipBounds = {
    width:  box.max.x - box.min.x,
    height: box.max.y - box.min.y,
    length: box.max.z - box.min.z,
    radius: Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) / 2,
  };

  // Get species-specific hardpoints or generate defaults
  const provider = getHardpointProvider(speciesId);
  const partial = provider
    ? provider(len, cx)
    : generateDefaultHardpoints(len, cx, bounds);

  const hardpoints: ShipHardpoints = { ...partial, bounds };
  const result: ShipBuildResult = { geometry: geo, hardpoints };

  _buildResultCache.set(key, result);
  _geometryCache.set(key, geo);

  return result;
}

/**
 * Generate procedural 3D geometry for a species + hull class combination.
 *
 * Convenience wrapper around generateShipBuildResult() for consumers that
 * only need geometry. Returns the cached geometry directly.
 *
 * @param maxComplexity - Optional cap on the complexity tier. Pass 6 for
 *   combat rendering to balance detail vs. performance.
 */
export function generateShipGeometry(
  speciesId: string,
  hullClass: HullClass,
  maxComplexity?: number,
): THREE.BufferGeometry {
  return generateShipBuildResult(speciesId, hullClass, maxComplexity).geometry;
}

// ─── Materials ──────────────────────────────────────────────────────────────

interface SpeciesMaterialDef {
  color: number;
  emissive: number;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  opacity?: number;
  transparent?: boolean;
}

const SPECIES_MATERIALS: Record<string, SpeciesMaterialDef> = {
  // Teranos — grey-blue utilitarian steel
  teranos: {
    color: 0x7a8d9e,
    emissive: 0x1a2d44,
    emissiveIntensity: 0.18,
    metalness: 0.65,
    roughness: 0.50,
  },
  // Khazari — dark iron with amber forgelight
  khazari: {
    color: 0x554433,
    emissive: 0xff6600,
    emissiveIntensity: 0.25,
    metalness: 0.85,
    roughness: 0.65,
  },
  // Vaelori — pale violet crystal, psychic glow
  vaelori: {
    color: 0xccbbff,
    emissive: 0x7744ee,
    emissiveIntensity: 0.55,
    metalness: 0.25,
    roughness: 0.12,
    opacity: 0.82,
    transparent: true,
  },
  // Sylvani — deep heartwood green, bioluminescent
  sylvani: {
    color: 0x2a4a2a,
    emissive: 0x55cc44,
    emissiveIntensity: 0.35,
    metalness: 0.05,
    roughness: 0.85,
  },
  // Nexari — gunmetal with cool blue data-glow
  nexari: {
    color: 0x4a5565,
    emissive: 0x0099ff,
    emissiveIntensity: 0.4,
    metalness: 0.75,
    roughness: 0.2,
  },
  // Drakmari — deep ocean dark, bioluminescent teal
  drakmari: {
    color: 0x1a2d3d,
    emissive: 0x00ccbb,
    emissiveIntensity: 0.3,
    metalness: 0.25,
    roughness: 0.5,
  },
  // Ashkari — rusted brown, patchwork
  ashkari: {
    color: 0x886644,
    emissive: 0x664422,
    emissiveIntensity: 0.12,
    metalness: 0.5,
    roughness: 0.9,
  },
  // Luminari — near-white, intense golden glow
  luminari: {
    color: 0xffeedd,
    emissive: 0xffcc44,
    emissiveIntensity: 0.8,
    metalness: 0.2,
    roughness: 0.1,
    opacity: 0.7,
    transparent: true,
  },
  // Zorvathi — dark chitin brown, amber highlights
  zorvathi: {
    color: 0x443322,
    emissive: 0xcc8800,
    emissiveIntensity: 0.2,
    metalness: 0.3,
    roughness: 0.75,
  },
  // Orivani — ivory and gold, warm sanctified glow
  orivani: {
    color: 0xeeddcc,
    emissive: 0xffaa33,
    emissiveIntensity: 0.3,
    metalness: 0.45,
    roughness: 0.4,
  },
  // Kaelenth — polished chrome, cool white
  kaelenth: {
    color: 0xddddee,
    emissive: 0x4488cc,
    emissiveIntensity: 0.15,
    metalness: 0.95,
    roughness: 0.05,
  },
  // Thyriaq — liquid silver, shifting highlight
  thyriaq: {
    color: 0xb0c4d8,
    emissive: 0x44aacc,
    emissiveIntensity: 0.40,
    metalness: 0.85,
    roughness: 0.08,
  },
  // Aethyn — deep purple, phase-shift glow
  aethyn: {
    color: 0x5522aa,
    emissive: 0xbb44ff,
    emissiveIntensity: 0.55,
    metalness: 0.35,
    roughness: 0.2,
    opacity: 0.75,
    transparent: true,
  },
  // Vethara — pale bone-grey host hull, red biological glow
  vethara: {
    color: 0xbbaa99,
    emissive: 0xcc2222,
    emissiveIntensity: 0.3,
    metalness: 0.2,
    roughness: 0.6,
  },
  // Pyrenth — obsidian black with magma-orange glow
  pyrenth: {
    color: 0x1a1412,
    emissive: 0xff3300,
    emissiveIntensity: 0.5,
    metalness: 0.55,
    roughness: 0.75,
  },
};

// ─── Material cache ────────────────────────────────────────────────────────
// Keyed by speciesId. All ships of the same species share a single material
// instance — safe because the properties are read-only constants. This
// reduces draw calls from N (per ship) to numSpecies (typically 2).

const _materialCache = new Map<string, THREE.Material>();

/** Clear the material cache (call alongside clearShipGeometryCache). */
export function clearShipMaterialCache(): void {
  for (const mat of _materialCache.values()) mat.dispose();
  _materialCache.clear();
}

/**
 * Get the standard MeshStandardMaterial for a species' ships.
 *
 * Returns a cached material shared across all ships of the same species.
 */
export function getShipMaterial(speciesId: string): THREE.Material {
  const cached = _materialCache.get(speciesId);
  if (cached) return cached;

  const def = SPECIES_MATERIALS[speciesId] ?? SPECIES_MATERIALS.teranos;
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.emissive,
    emissiveIntensity: def.emissiveIntensity,
    metalness: def.metalness,
    roughness: def.roughness,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1.0,
    side: THREE.DoubleSide,
  });

  _materialCache.set(speciesId, mat);
  return mat;
}
