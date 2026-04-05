/**
 * Shared helper utilities for per-species ship geometry builders.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PI = Math.PI;
export const HALF_PI = PI / 2;

/** Position and optionally rotate a geometry, returning it. */
export function place(
  geo: THREE.BufferGeometry,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
  sx = 1, sy = 1, sz = 1,
): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Merge an array of geometries, disposing the originals. */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const valid = geos.filter(Boolean);
  if (valid.length === 0) return new THREE.BoxGeometry(1, 1, 1);
  // Ensure all geometries are non-indexed so mergeGeometries doesn't fail
  // when mixing indexed (ExtrudeGeometry, LatheGeometry) with non-indexed.
  const normalised = valid.map(g => g.index ? g.toNonIndexed() : g);
  const merged = mergeGeometries(normalised, false);
  if (!merged) return normalised[0];
  for (const g of valid) g.dispose();
  for (const g of normalised) { if (!valid.includes(g)) g.dispose(); }
  return merged;
}

/** Create a mirrored pair (left/right along X). */
export function mirrorX(
  factory: (sign: number) => THREE.BufferGeometry,
): THREE.BufferGeometry[] {
  return [factory(1), factory(-1)];
}
