import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ============================================================================
 *  PYRENTH SHIP DESIGN — "FORGED IN THE MANTLE"
 * ============================================================================
 *
 *  The Pyrenth are geological sculptors — beings who shaped their homeworld's
 *  mantle for four billion years. Their ships look GROWN from a planet's crust.
 *  Basalt monoliths and obsidian shards with magma veins, tectonic plate
 *  armour, caldera command structures, and basalt column engine clusters.
 *
 *  DISTINCTIVENESS: Pyrenth are STONE not metal. Rougher, darker, more
 *  geological. Uses octahedra and tetrahedra, not boxes and cones.
 */

export function buildPyrenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const h = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.OctahedronGeometry(w * 0.52, 1),
    0, 0, len * 0.02,
    0, 0, 0,
    0.85, 0.6, len * 0.038,
  ));

  parts.push(place(
    new THREE.ConeGeometry(w * 0.18, len * 0.32, 3),
    0, 0, len * 0.42,
    HALF_PI, 0, 0,
  ));

  parts.push(place(
    new THREE.BoxGeometry(w * 0.04, h * 0.35, len * 0.22),
    0, h * 0.15, len * 0.34,
    0.05, 0, 0,
  ));

  if (cx >= 1) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.07, w * 0.12, h * 0.45, 5),
      s * w * 0.32, h * 0.22, -len * 0.08,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.08, 0),
      s * w * 0.32, h * 0.48, -len * 0.08,
      0, s * 0.3, 0,
    )));
  }

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.18, h * 0.52, len * 0.28),
      s * w * 0.46, -h * 0.08, len * 0.04,
      0, 0, s * 0.18,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.12, h * 0.3, len * 0.18),
      s * w * 0.38, h * 0.22, len * 0.14,
      0.06, 0, s * 0.12,
    )));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.06, h * 0.1, len * 0.65),
      0, h * 0.38, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.05, h * 0.06, len * 0.45),
      s * w * 0.2, h * 0.32, len * 0.06,
    )));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.07, h * 0.08, len * 0.4),
      0, -h * 0.35, -len * 0.05,
    ));
  }

  if (cx >= 4) {
    const engineCount = cx >= 6 ? 5 : 3;
    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      const radius = w * (engineCount > 3 ? 0.24 : 0.2);
      const ex = Math.cos(angle) * radius;
      const ey = Math.sin(angle) * radius;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.09, w * 0.11, len * 0.16, 6),
        ex, ey, -len * 0.44,
        HALF_PI, 0, 0,
      ));
      parts.push(place(
        new THREE.ConeGeometry(w * 0.07, len * 0.06, 6),
        ex, ey, -len * 0.50,
        -HALF_PI, 0, 0,
      ));
    }
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.12, 0),
      s * w * 0.35, h * 0.12, len * 0.22,
      0.2, s * 0.4, 0,
    )));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.04, 4, 6),
      0, h * 0.36, len * 0.15,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.18, 5, 3, 0, PI * 2, 0, HALF_PI),
      0, h * 0.38, len * 0.15,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.32, 1),
      0, -h * 0.22, -len * 0.26,
      0.25, 0.4, 0.15,
      0.75, 0.55, 1.15,
    ));
  }

  if (cx >= 6) {
    const ridgePositions = [-0.2, -0.05, 0.1, 0.25];
    for (let i = 0; i < ridgePositions.length; i++) {
      const zPos = len * ridgePositions[i];
      const yJitter = h * (0.42 + (i % 2) * 0.06);
      const size = w * (0.06 + (i % 3) * 0.02);
      parts.push(place(
        new THREE.IcosahedronGeometry(size, 0),
        w * ((i % 2) - 0.5) * 0.08, yJitter, zPos,
      ));
    }
  }

  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.1, h * 0.6, len * 0.2),
      s * w * 0.52, -h * 0.15, -len * 0.15,
      0, 0, s * 0.25,
    )));
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.2, 0),
      0, 0, len * 0.0,
      0.2, 0.3, 0.1,
    ));
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.08, 0),
      0, h * 0.2, len * 0.36,
      0.3, 0, 0.15,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.06, 0),
      s * w * 0.12, h * 0.18, len * 0.34,
      0.2, s * 0.2, 0,
    )));
  }

  if (cx >= 8) {
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.28, 1),
      0, h * 0.45, len * 0.0,
      0.15, 0.2, 0.1,
      1.0, 0.7, 0.9,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.2, 1),
      w * 0.1, h * 0.42, len * 0.18,
      0.1, -0.15, 0.2,
      0.8, 0.6, 0.75,
    ));
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.06, w * 0.08, len * 0.1, 6),
        Math.cos(angle) * w * 0.5,
        Math.sin(angle) * w * 0.5,
        len * 0.05,
        HALF_PI, 0, 0,
      ));
    }
  }

  return merge(parts);
}
