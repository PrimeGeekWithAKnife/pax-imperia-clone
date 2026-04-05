import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  VETHARA SHIP DESIGNS — "The Borrowed Fleet"
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  The Vethara are symbiotic neural filaments — eyeless, limbless parasites
 *  that bond with host organisms. Their ships express dual-nature: a pale,
 *  inert HOST HULL (capsule, bone-like) visibly colonised by living red
 *  FILAMENT NETWORKS (spiralling beads, tendril arms, organ pods, membrane).
 *
 *  DISTINCTIVENESS: "Something alive wrapped around something dead." The
 *  dual-layer visual is unique — no other species has this.
 */

export function buildVethara(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const h = len * 0.18;
  const parts: THREE.BufferGeometry[] = [];

  // Host hull
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.32, w * 0.38, len * 0.6, 10),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.SphereGeometry(w * 0.33, 10, 8),
    0, 0, len * 0.30,
    0, 0, 0,
    1.0, 0.85, 0.65,
  ));
  parts.push(place(
    new THREE.SphereGeometry(w * 0.39, 10, 8),
    0, 0, -len * 0.30,
    0, 0, 0,
    1.0, 0.9, 0.55,
  ));

  // Filament spiral
  const spiralCount = 10 + cx * 4;
  const spiralWraps = 1.5 + cx * 0.25;
  for (let i = 0; i < spiralCount; i++) {
    const t = i / spiralCount;
    const angle = t * PI * 2 * spiralWraps;
    const z = (0.35 - t * 0.7) * len;
    const hullR = w * (0.33 + t * 0.05);
    const filR = hullR + w * 0.06;
    const beadSize = w * (0.05 + cx * 0.003);
    parts.push(place(
      new THREE.SphereGeometry(beadSize, 4, 3),
      Math.cos(angle) * filR,
      Math.sin(angle) * filR,
      z,
    ));
  }

  // Tendril arms (cx >= 2)
  if (cx >= 2) {
    const armCount = Math.min(3 + Math.floor(cx / 2), 6);
    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * PI * 2;
      const armLen = len * (0.15 + cx * 0.01);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.05, armLen, 5),
        Math.cos(angle) * w * 0.34,
        Math.sin(angle) * w * 0.34,
        len * 0.38 + armLen * 0.4,
        HALF_PI + 0.25 * Math.sin(angle),
        0,
        0.25 * Math.cos(angle),
      ));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 3),
        Math.cos(angle) * w * 0.30,
        Math.sin(angle) * w * 0.30,
        len * 0.38 + armLen * 0.85,
      ));
    }
  }

  // Organ pods (cx >= 3)
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.16, 7, 5),
      s * w * 0.48, 0, len * 0.08,
      0, 0, 0,
      1.0, 0.8, 1.3,
    )));
    if (cx >= 4) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.12, 6, 4),
        s * w * 0.46, h * 0.15, -len * 0.12,
        0, 0, 0,
        1.0, 0.75, 1.2,
      )));
    }
  }

  // Enveloping membrane (cx >= 4)
  if (cx >= 4) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.52, 10, 7, 0, PI * 2, 0, PI * 0.5),
      0, w * 0.08, len * 0.02,
      HALF_PI, 0, 0,
      1.0, 0.25, 1.6,
    ));
    for (let i = 0; i < 3; i++) {
      const ridgeX = (i - 1) * w * 0.22;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.5, 4),
        ridgeX, h * 0.35, 0,
        HALF_PI, 0, 0,
      ));
    }
  }

  // Tendril crown (cx >= 5)
  if (cx >= 5) {
    const crownCount = 8;
    for (let i = 0; i < crownCount; i++) {
      const angle = (i / crownCount) * PI * 2;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.04, len * 0.14, 5),
        Math.cos(angle) * w * 0.38,
        Math.sin(angle) * w * 0.38,
        len * 0.44,
        HALF_PI - 0.2, angle, 0,
      ));
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.015, w * 0.5, 3),
        Math.cos(angle) * w * 0.55,
        Math.sin(angle) * w * 0.55,
        len * 0.05,
        0, 0, PI * 0.5 - angle,
      ));
    }
  }

  // Neural nexus dome (cx >= 6)
  if (cx >= 6) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.28, 10, 8, 0, PI * 2, 0, PI * 0.6),
      0, h * 0.45, len * 0.05,
    ));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.035, w * 0.05, h * 0.4, 5),
        Math.cos(angle) * w * 0.15,
        h * 0.25,
        len * 0.05 + Math.sin(angle) * w * 0.15,
      ));
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.22, 8, 6),
      0, -h * 0.4, -len * 0.05,
      0, 0, 0,
      1.2, 0.8, 1.0,
    ));
  }

  // Trailing reproductive filaments (cx >= 7)
  if (cx >= 7) {
    const trailCount = 8;
    for (let i = 0; i < trailCount; i++) {
      const angle = (i / trailCount) * PI * 2;
      const trailLen = len * 0.25;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.04, trailLen, 4),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.35,
        -len * 0.42 - trailLen * 0.4,
        HALF_PI + 0.1 * Math.sin(angle),
        0,
        0.1 * Math.cos(angle),
      ));
      for (let j = 1; j <= 3; j++) {
        const tz = -len * 0.42 - trailLen * (j / 4);
        parts.push(place(
          new THREE.SphereGeometry(w * 0.025, 3, 2),
          Math.cos(angle) * w * (0.35 - j * 0.02),
          Math.sin(angle) * w * (0.35 - j * 0.02),
          tz,
        ));
      }
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.25, 8, 6),
      0, 0, -len * 0.38,
      0, 0, 0,
      1.3, 1.3, 0.8,
    ));
  }

  // Metabolic engine cluster
  const engineCount = 1 + Math.min(cx, 4);
  if (engineCount <= 2) {
    for (let i = 0; i < engineCount; i++) {
      const ex = engineCount === 1 ? 0 : (i === 0 ? -w * 0.15 : w * 0.15);
      parts.push(place(
        new THREE.SphereGeometry(w * 0.12, 6, 5),
        ex, 0, -len * 0.36,
      ));
    }
  } else {
    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.1, 6, 5),
        Math.cos(angle) * w * 0.2,
        Math.sin(angle) * w * 0.2,
        -len * 0.36,
      ));
    }
  }

  return merge(parts);
}
