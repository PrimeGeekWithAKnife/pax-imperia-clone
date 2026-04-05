import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  AETHYN SHIP DESIGN — "Not Entirely Here"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  The Aethyn are interdimensional pioneers. Their ships are projected into
 *  our 3D space — partial cross-sections of higher-dimensional objects.
 *  Intersecting tori at non-orthogonal angles, floating disconnected polyhedra,
 *  non-orthogonal struts, and nested Platonic solids.
 *
 *  DISTINCTIVENESS: No other species uses intersecting tori or disconnected
 *  floating geometry. This is uniquely Aethyn.
 */

export function buildAethyn(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.DodecahedronGeometry(w * 0.42, 0),
    0, 0, 0,
  ));

  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.32, 0),
    0, 0, len * 0.32,
    0.62, 0.85, 0.4,
  ));

  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.24, 0),
    0, 0, -len * 0.28,
    1.05, 0.35, 0.72,
  ));

  parts.push(place(
    new THREE.TorusGeometry(w * 0.52, w * 0.035, 8, 16),
    0, 0, -len * 0.06,
    0.72, 0.38, 0,
  ));

  if (cx >= 1) {
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.018, w * 0.018, len * 0.55, 4),
      0, 0, 0,
      0.35, 1.15, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.018, w * 0.018, len * 0.48, 4),
      0, 0, 0,
      1.08, 0.42, 0.65,
    ));
  }

  if (cx >= 2) {
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.14, 0),
      w * 0.55, w * 0.3, len * 0.18,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.12, 0),
      -w * 0.5, -w * 0.28, -len * 0.12,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.10, 0),
      w * 0.15, w * 0.55, -len * 0.2,
    ));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.48, w * 0.03, 8, 14),
      0, 0, len * 0.04,
      HALF_PI + 0.42, 0.85, 0,
    ));
  }

  if (cx >= 4) {
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.28, 0),
      0, 0, 0,
      0.32, 0.55, 0.18,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.015, len * 0.42, 4),
      w * 0.15, w * 0.1, 0,
      0.7, 0.2, 1.3,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.015, len * 0.38, 4),
      -w * 0.12, -w * 0.08, len * 0.05,
      1.4, 0.9, 0.3,
    ));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.65, 0),
      0, 0, 0,
      0.5, 0.5, 0.5,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, w * 0.028, 8, 16),
      0, 0, -len * 0.02,
      0.25, HALF_PI + 0.3, 0,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.1, 0),
      w * 0.6, -w * 0.35, len * 0.25,
      0.4, 0.7, 1.1,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.09, 0),
      -w * 0.55, w * 0.4, len * 0.1,
      1.2, 0.3, 0.5,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.08, 0),
      -w * 0.2, -w * 0.5, -len * 0.3,
      0.8, 1.5, 0.2,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.04, 6, 12),
      0, 0, len * 0.42,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 6) {
    for (let i = 0; i < 3; i++) {
      const angle = (PI * 2 * i) / 3;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.6, 4),
        w * 0.3 * Math.cos(angle),
        w * 0.3 * Math.sin(angle),
        0,
        angle * 0.7, 0.5 + i * 0.4, angle * 0.3,
      ));
    }
    parts.push(place(
      new THREE.TorusGeometry(w * 0.62, w * 0.025, 8, 18),
      0, 0, 0,
      1.1, 0.2, HALF_PI,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.13, 0),
      s * w * 0.7, 0, len * 0.15,
      0.9, s * 0.6, 0.3,
    )));
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.8, w * 0.04, 10, 20),
      0, 0, 0,
      HALF_PI + 0.15, 0, 0,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.18, 0),
      w * 0.75, 0, len * 0.2,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.16, 0),
      -w * 0.7, 0, -len * 0.15,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.14, 0),
      0, w * 0.7, 0,
    ));
  }

  return merge(parts);
}
