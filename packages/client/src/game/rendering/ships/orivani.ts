import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ORIVANI SHIP DESIGNS — "Cathedrals of the Coming"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Orivani have spent twelve thousand years preparing for the Coming.
 * Every ship is an act of devotion. Vessels that look like flying temples:
 * central nave, spires, pointed prow, flying buttress arcs, rose windows,
 * bell towers. Ivory and sanctified gold material.
 *
 * DISTINCTIVENESS: SPIRES + BUTTRESS ARCS. No other species uses either.
 */

export function buildOrivani(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.22;
  const h = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.BoxGeometry(w * 0.55, h * 1.1, len * 0.6),
    0, 0, 0,
  ));

  parts.push(place(
    new THREE.BoxGeometry(w * 0.9, h * 0.5, len * 0.15),
    0, h * 0.05, len * 0.05,
  ));

  parts.push(place(
    new THREE.ConeGeometry(w * 0.35, len * 0.28, 4),
    0, 0, len * 0.44,
    HALF_PI, PI / 4, 0,
  ));

  parts.push(place(
    new THREE.ConeGeometry(w * 0.07, h * 1.4, 4),
    0, h * 0.95, len * 0.05,
  ));

  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.18, h * 0.75, len * 0.42),
    s * w * 0.42, -h * 0.12, -len * 0.02,
  )));

  parts.push(place(
    new THREE.BoxGeometry(w * 0.12, h * 0.15, len * 0.7),
    0, -h * 0.6, 0,
  ));

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.1, h * 0.85, 6),
      s * w * 0.38, h * 0.18, len * 0.22,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.1, h * 0.35, 6),
      s * w * 0.38, h * 0.7, len * 0.22,
    )));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.04, 6, 8),
      0, h * 0.12, len * 0.34,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.25, w * 0.25, h * 0.6, 8, 1, false, 0, PI),
      0, -h * 0.05, -len * 0.32,
      0, PI, 0,
    ));
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.55, w * 0.03, 5, 8, PI * 0.5),
      s * w * 0.52, h * 0.18, len * 0.08,
      0, s * HALF_PI, HALF_PI,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.48, w * 0.025, 5, 8, PI * 0.45),
      s * w * 0.48, h * 0.15, -len * 0.18,
      0, s * HALF_PI, HALF_PI,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.14, h * 0.1, len * 0.1),
      s * w * 0.58, h * 0.52, len * 0.08,
    )));
  }

  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.07, w * 0.09, h * 1.1, 6),
      s * w * 0.52, h * 0.25, -len * 0.22,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.1, h * 0.4, 6),
      s * w * 0.52, h * 0.9, -len * 0.22,
    )));
    parts.push(place(
      new THREE.ConeGeometry(w * 0.055, h * 0.7, 4),
      0, h * 0.7, -len * 0.3,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.22, h * 0.12, len * 0.12),
      0, h * 0.58, len * 0.18,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.18, h * 0.1, len * 0.1),
      0, h * 0.56, -len * 0.08,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.04, h * 0.3, 4),
      s * w * 0.58, h * 0.65, len * 0.08,
    )));
  }

  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.3, w * 0.02, 5, 6, PI * 0.4),
      s * w * 0.3, h * 0.1, -len * 0.35,
      0, s * HALF_PI, HALF_PI,
    )));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.35, h * 0.08, len * 0.5),
      0, h * 0.58, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.05, h * 0.35, 4),
      s * w * 0.45, h * 0.55, len * 0.05,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.035, len * 0.08, 4),
      s * w * 0.3, h * 0.3, len * 0.35,
      HALF_PI * 0.7, s * 0.3, 0,
    )));
  }

  return merge(parts);
}
