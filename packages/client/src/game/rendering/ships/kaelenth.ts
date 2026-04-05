import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ============================================================================
 *  KAELENTH SHIP DESIGN — "The Inheritance of Dust"
 * ============================================================================
 *
 *  The Kaelenth are machines that outlived their gods. Forty-seven million
 *  years of purposeless maintenance. Their ships embody flawless engineering
 *  in service of an unresolvable ache. Mirror-polished chrome with precision
 *  torus rings (the "halo" motif), smooth capsule hulls, flush weapon
 *  blisters, and outrigged nacelle pods.
 *
 *  DISTINCTIVENESS: No other species uses torus rings as a primary motif.
 *  The silhouette is smooth, round, haloed — a constellation of chrome
 *  rosaries drifting through the void.
 */

export function buildKaelenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.CapsuleGeometry(w * 0.38, len * 0.52, 10, 14),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  parts.push(place(
    new THREE.TorusGeometry(w * 0.34, w * 0.055, 10, 20),
    0, 0, -len * 0.36,
    HALF_PI, 0, 0,
  ));

  parts.push(place(
    new THREE.SphereGeometry(w * 0.22, 12, 10, 0, PI * 2, 0, HALF_PI),
    0, 0, len * 0.44,
    -HALF_PI, 0, 0,
  ));

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.065, len * 0.16, 5, 8),
      s * w * 0.38, 0, len * 0.12,
      HALF_PI, 0, 0,
    )));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.40, w * 0.035, 8, 20),
      0, 0, len * 0.08,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.12, len * 0.28, 7, 10),
      s * w * 0.58, 0, -len * 0.04,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.14, w * 0.025, 6, 14),
      s * w * 0.58, 0, -len * 0.22,
      HALF_PI, 0, 0,
    )));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.48, w * 0.028, 8, 24),
      0, 0, -len * 0.14,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.30, w * 0.025, 6, 18),
      0, 0, len * 0.30,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.022, w * 0.65, len * 0.38),
      0, w * 0.30, -len * 0.02,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.018, w * 0.35, len * 0.25),
      0, -w * 0.18, -len * 0.08,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.28, w * 0.015, len * 0.12),
      s * w * 0.14, w * 0.45, -len * 0.28,
      0, 0, s * 0.25,
    )));
  }

  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.09, len * 0.20, 6, 8),
      s * w * 0.36, -w * 0.15, -len * 0.10,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.05, len * 0.12, 4, 8),
      s * w * 0.42, 0, -len * 0.20,
      HALF_PI, 0, 0,
    )));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.018, w * 0.012, len * 0.30, 6),
      0, w * 0.42, len * 0.14,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.56, w * 0.022, 8, 28),
      0, 0, len * 0.0,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.040, 6, 20),
      0, 0, -len * 0.25,
      HALF_PI, 0, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.020, len * 0.35, 6),
      s * w * 0.22, 0, len * 0.28,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.015, w * 0.30, len * 0.10),
      s * w * 0.08, w * 0.48, -len * 0.22,
    )));
  }

  if (cx >= 8) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.18, 10, 10),
      0, w * 0.32, len * 0.16,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.20, w * 0.018, 6, 16),
      0, w * 0.32, len * 0.16,
      HALF_PI, 0, 0,
    ));
    for (let i = 0; i < 3; i++) {
      const zOff = len * (-0.10 + i * 0.12);
      parts.push(...mirrorX(s => place(
        new THREE.CapsuleGeometry(w * 0.045, len * 0.08, 4, 6),
        s * w * 0.44, w * 0.08, zOff,
        HALF_PI, 0, 0,
      )));
    }
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.030, 6, 16),
      0, 0, -len * 0.42,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.15, w * 0.025, 6, 12),
      0, 0, -len * 0.45,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}
