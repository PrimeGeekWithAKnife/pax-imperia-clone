import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ============================================================================
 *  THYRIAQ SHIP DESIGN — "The Geometry That Thinks"
 * ============================================================================
 *
 *  The Thyriaq are the ships. Four billion nanoscale biological machines
 *  aggregate into a coherent volume of matter that reshapes itself for the
 *  task at hand. "Liquid mercury frozen mid-transformation." Amoeboid core
 *  bodies with pseudopod tendrils, toroidal accelerator rings, and no seams
 *  because the entire ship is one continuous material.
 *
 *  DISTINCTIVENESS: No other species uses this vocabulary. Thyriaq have no
 *  anatomy. Their ships are amorphous, mercurial, unsettling.
 */

export function buildThyriaq(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.26;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.SphereGeometry(w * 0.55, 10, 8),
    0, 0, len * 0.05,
    0, 0, 0,
    0.85, 0.75, 1.6,
  ));

  parts.push(place(
    new THREE.SphereGeometry(w * 0.38, 8, 7),
    w * 0.06, w * 0.05, len * 0.28,
    0, 0, 0,
    0.8, 0.7, 1.3,
  ));

  parts.push(place(
    new THREE.SphereGeometry(w * 0.42, 8, 6),
    0, -w * 0.08, -len * 0.22,
    0, 0, 0,
    1.1, 0.65, 1.0,
  ));

  const thrusterCount = 3 + Math.floor(cx * 0.5);
  for (let i = 0; i < thrusterCount; i++) {
    const angle = (i / thrusterCount) * PI * 2 + 0.4;
    const tLen = len * (0.12 + 0.02 * cx);
    const spread = w * (0.28 + 0.04 * (i % 2));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.012, tLen, 5),
      Math.cos(angle) * spread,
      Math.sin(angle) * spread * 0.7,
      -len * 0.28 - tLen * 0.3,
      HALF_PI + 0.15 * Math.sin(angle),
      0.1 * Math.cos(angle),
      0,
    ));
  }

  if (cx >= 1) {
    const senseCount = 2 + Math.min(cx, 4);
    for (let i = 0; i < senseCount; i++) {
      const angle = (i / senseCount) * PI * 2;
      const tLen = len * (0.08 + 0.015 * cx);
      parts.push(place(
        new THREE.ConeGeometry(w * 0.06, tLen, 5),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.25,
        len * 0.20 + tLen * 0.2,
        HALF_PI * 0.85, 0, angle * 0.3,
      ));
    }
  }

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.28, 7, 6),
      s * w * 0.42, -w * 0.06, -len * 0.04,
      0, 0, 0,
      0.9, 0.8, 1.1,
    )));
  }

  if (cx >= 2) {
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.12, len * 0.35, 5, 8),
      0, w * 0.22, len * 0.02,
      HALF_PI, 0, 0.15,
    ));
  }

  if (cx >= 3) {
    parts.push(...mirrorX(s => {
      const wpnLen = len * 0.18;
      const stalk = place(
        new THREE.CylinderGeometry(w * 0.05, w * 0.03, wpnLen, 5),
        s * w * 0.48, w * 0.05, len * 0.15,
        HALF_PI * 0.7, s * 0.2, 0,
      );
      return stalk;
    }));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.09, len * 0.06, 6),
      s * w * 0.55, w * 0.08, len * 0.30,
      -HALF_PI, 0, 0,
    )));
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.10, w * 0.02, 6, 12),
      s * w * 0.50, w * 0.06, len * 0.22,
      0, 0, HALF_PI,
    )));
  }

  if (cx >= 4) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.32, 7, 6),
      w * 0.05, -w * 0.30, -len * 0.08,
      0, 0, 0,
      0.85, 0.9, 1.15,
    ));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.40, 9, 7),
      -w * 0.12, w * 0.10, len * 0.32,
      0, 0, 0,
      0.75, 0.70, 1.25,
    ));
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.07, len * 0.18, 4, 6),
      -w * 0.06, w * 0.07, len * 0.20,
      HALF_PI, 0, 0.1,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.02, len * 0.15, 5),
      s * w * 0.55, -w * 0.10, len * 0.05,
      HALF_PI * 0.6, s * 0.3, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.08, w * 0.015, 5, 10),
      s * w * 0.52, -w * 0.08, len * 0.12,
      0, 0, HALF_PI,
    )));
  }

  if (cx >= 6) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.35, 8, 6),
      w * 0.15, w * 0.18, -len * 0.30,
      0, 0, 0,
      0.95, 0.65, 1.1,
    ));
    const nodeAngles = [0, 1.2, 2.4, 3.6, 4.8];
    for (const a of nodeAngles) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.10, 5, 4),
        Math.cos(a) * w * 0.40,
        Math.sin(a) * w * 0.30,
        len * (0.05 + 0.08 * Math.sin(a * 2)),
      ));
    }
    for (let i = 0; i < 6; i++) {
      const fa = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.005, len * 0.10, 3),
        Math.cos(fa) * w * 0.20,
        Math.sin(fa) * w * 0.15,
        len * 0.38,
        HALF_PI * 0.9, fa * 0.1, 0,
      ));
    }
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.45, 9, 7),
      0, -w * 0.35, -len * 0.18,
      0, 0, 0,
      1.0, 0.70, 0.85,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.05, len * 0.12, 4, 6),
      s * w * 0.12, -w * 0.18, -len * 0.08,
      0.4, s * 0.2, 0,
    )));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, w * 0.03, 8, 16),
      0, 0, len * 0.02,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 8) {
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.30, 1),
      0, 0, len * 0.40,
    ));
    for (let r = 0; r < 3; r++) {
      parts.push(place(
        new THREE.TorusGeometry(w * (0.35 + r * 0.12), w * 0.02, 6, 14),
        0, 0, len * (0.10 - r * 0.08),
        HALF_PI, 0, r * 0.3,
      ));
    }
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.30, 7, 6),
      s * w * 0.60, w * 0.15, -len * 0.25,
      0, 0, 0,
      0.8, 0.7, 1.0,
    )));
  }

  return merge(parts);
}
