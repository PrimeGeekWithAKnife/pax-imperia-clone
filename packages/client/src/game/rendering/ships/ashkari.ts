import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  ASHKARI SHIP DESIGN — "THE NOMAD'S FORGE"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  The Ashkari are three-thousand-year refugees. Every ship they fly is a
 *  testament to survival. Their vessels are built from whatever was to hand:
 *  salvaged hull plate from alien derelicts, cannibalised engine blocks
 *  traded in backwater bazaars, sensor arrays reverse-engineered from wreckage.
 *  Nothing matches. Nothing was designed to fit together. Everything works anyway.
 *
 *  VISUAL LANGUAGE: ASYMMETRIC PATCHWORK
 *  The defining silhouette trait is deliberate asymmetry. The Ashkari have NONE
 *  of the bilateral symmetry every other species employs. This makes them
 *  unmistakable even as 10-pixel silhouettes.
 */

export function buildAshkari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const h = len * 0.18;
  const parts: THREE.BufferGeometry[] = [];

  // ── Core hull — off-centre box, the ship's original salvaged frame ──
  parts.push(place(
    new THREE.BoxGeometry(w * 0.85, h * 0.7, len * 0.48),
    w * 0.06, 0, 0,
    0, 0.035, 0,
  ));

  // ── Cockpit — bolted-on cylinder, offset to port, tilted forward ──
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.2, w * 0.26, len * 0.18, 5),
    -w * 0.22, h * 0.32, len * 0.34,
    HALF_PI, 0, 0.15,
  ));

  // ── Mismatched engines — THE signature Ashkari trait ──
  // Starboard engine: cylindrical nacelle (Drakmari-style trawler unit)
  parts.push(place(
    new THREE.CylinderGeometry(h * 0.2, h * 0.28, len * 0.18, 6),
    w * 0.42, -h * 0.08, -len * 0.38,
    HALF_PI, 0, 0,
  ));
  // Port engine: boxy thrust block (Teranos surplus, retuned)
  parts.push(place(
    new THREE.BoxGeometry(w * 0.32, h * 0.38, len * 0.14),
    -w * 0.38, h * 0.08, -len * 0.40,
    0, 0, 0.06,
  ));

  // ── cx >= 1: Scrap plating ──
  if (cx >= 1) {
    parts.push(place(
      new THREE.BoxGeometry(w * 1.15, h * 0.06, len * 0.38),
      -w * 0.03, h * 0.40, 0.02,
      0.04, 0, -0.02,
    ));
  }

  // ── cx >= 2: Jury-rigged sensor array ──
  if (cx >= 2) {
    parts.push(place(
      new THREE.ConeGeometry(w * 0.22, h * 0.28, 6),
      w * 0.52, h * 0.48, len * 0.12,
      0, 0, 0.1,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, h * 0.5, 4),
      w * 0.52, h * 0.75, len * 0.12,
    ));
  }

  // ── cx >= 3: Cargo container bolted to port side ──
  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.38, h * 0.52, len * 0.28),
      -w * 0.68, -h * 0.06, -len * 0.04,
      0, 0.04, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.18, h * 0.08, len * 0.06),
      -w * 0.48, h * 0.04, len * 0.04,
    ));
  }

  // ── cx >= 4: Welded-on gun gantry ──
  if (cx >= 4) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.42, h * 0.18, len * 0.16),
      w * 0.56, h * 0.38, len * 0.22,
      0, 0, -0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.04, len * 0.18, 4),
      w * 0.56, h * 0.50, len * 0.28,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.12, h * 0.12, len * 0.20),
      -w * 0.44, -h * 0.40, len * 0.16,
      0.08, 0, 0,
    ));
  }

  // ── cx >= 5: Capital ship — secondary hull section ──
  if (cx >= 5) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.65, h * 0.52, len * 0.32),
      w * 0.08, -h * 0.52, len * 0.14,
      0, -0.03, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.06, h * 0.5, 4),
      w * 0.12, -h * 0.24, len * 0.08,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.06, h * 0.5, 4),
      -w * 0.10, -h * 0.24, -len * 0.08,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.16, w * 0.16, len * 0.38, 6),
      -w * 0.35, h * 0.38, -len * 0.08,
      HALF_PI, 0, 0.08,
    ));
  }

  // ── cx >= 6: Antenna forest + additional weapon pods ──
  if (cx >= 6) {
    const masts: [number, number, number, number][] = [
      [w * 0.30, h * 0.65, len * 0.05, h * 0.55],
      [-w * 0.18, h * 0.60, -len * 0.12, h * 0.45],
      [w * 0.48, h * 0.58, -len * 0.20, h * 0.40],
      [-w * 0.42, h * 0.62, len * 0.18, h * 0.50],
    ];
    for (const [mx, my, mz, mh] of masts) {
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.015, mh, 3),
        mx, my, mz,
      ));
    }
    parts.push(place(
      new THREE.BoxGeometry(w * 0.50, h * 0.22, len * 0.18),
      -w * 0.15, h * 0.56, len * 0.26,
      0, 0.06, 0,
    ));
  }

  // ── cx >= 7: Third hull section + heavy weapons ──
  if (cx >= 7) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.55, h * 0.44, len * 0.28),
      -w * 0.55, -h * 0.48, -len * 0.18,
      0, 0.05, 0.03,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.14, h * 0.14, len * 0.55),
      w * 0.04, h * 0.52, len * 0.02,
      0, 0.02, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(h * 0.22, 5, 4),
      w * 0.65, h * 0.10, -len * 0.35,
    ));
  }

  // ── cx >= 8: Station/planet-killer ──
  if (cx >= 8) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.50, h * 0.40, len * 0.26),
      w * 0.58, -h * 0.46, len * 0.06,
      0, -0.04, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, h * 0.06, 4, 8),
      0, 0, 0,
      HALF_PI, 0, 0,
    ));
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, h * 0.65, 3),
        Math.cos(angle) * w * 0.40, h * 0.70, Math.sin(angle) * w * 0.40,
      ));
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.30, 6, 4, 0, PI * 2, 0, HALF_PI),
      -w * 0.02, h * 0.50, -len * 0.25,
      0, 0.3, 0,
    ));
  }

  return merge(parts);
}
