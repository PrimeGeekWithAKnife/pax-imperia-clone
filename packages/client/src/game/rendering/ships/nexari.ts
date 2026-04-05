import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ============================================================================
 *  NEXARI SHIP DESIGN — "The Architecture of Solved Death"
 * ============================================================================
 *
 *  The Nexari were once soft, fragile prey animals terrified of mortality.
 *  They solved death by uploading their entire species into crystalline
 *  processing cores. Their ships are mobile nodes of the collective —
 *  self-contained sub-networks. Every ship is a cluster of processing cores
 *  (octahedra) linked by data conduits (thin cylindrical struts).
 *
 *  VISUAL LANGUAGE: "Distributed Lattice Architecture"
 *  Core motif: interconnected NODES and LATTICE STRUTS. The silhouette
 *  should always read as "constellation" or "molecular diagram", never as a
 *  solid slab.
 *
 *  DISTINCTIVENESS: No other species uses the octahedron-and-strut lattice.
 *  Vaelori use crystals but they are singular elegant spires; Nexari are
 *  NETWORKS of crystals.
 */

export function buildNexari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;          // lateral spread
  const h = len * 0.2;           // vertical spread
  const coreR = len * 0.09;      // processing core radius
  const strutR = len * 0.008;    // data conduit radius
  const strutSeg = 4;            // low-poly strut cross-section
  const parts: THREE.BufferGeometry[] = [];

  // ── Primary processing core (central octahedron) ─────────────────────────
  parts.push(place(
    new THREE.OctahedronGeometry(coreR * 1.2, 0),
    0, 0, len * 0.05,
    0, 0, 0,
    1.0, 1.0, 1.4,
  ));

  // ── Forward sensor node (small icosahedron) ──────────────────────────────
  parts.push(place(
    new THREE.IcosahedronGeometry(coreR * 0.4, 0),
    0, 0, len * 0.38,
  ));

  // Forward data conduit linking core to sensor
  parts.push(place(
    new THREE.CylinderGeometry(strutR, strutR, len * 0.28, strutSeg),
    0, 0, len * 0.22,
    HALF_PI, 0, 0,
  ));

  // ── Aft field-drive torus ────────────────────────────────────────────────
  parts.push(place(
    new THREE.TorusGeometry(coreR * 1.0, coreR * 0.15, 6, 12),
    0, 0, -len * 0.35,
    HALF_PI, 0, 0,
  ));

  // Aft data conduit linking core to drive ring
  parts.push(place(
    new THREE.CylinderGeometry(strutR, strutR, len * 0.32, strutSeg),
    0, 0, -len * 0.18,
    HALF_PI, 0, 0,
  ));

  // ── Lateral processing nodes (cx >= 1) ──────────────────────────────────
  if (cx >= 1) {
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.7, 0),
      sign * w * 0.7, 0, -len * 0.05,
    )));
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR, strutR, w * 0.55, strutSeg),
      sign * w * 0.35, 0, 0,
      0, 0, HALF_PI,
    )));
  }

  // ── Weapon emitters (cx >= 1) ────────────────────────────────────────────
  if (cx >= 1) {
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.15, len * 0.14, 5),
      sign * w * 0.3, 0, len * 0.42,
      HALF_PI, 0, 0,
    )));
  }

  // ── Dorsal/ventral relay nodes (cx >= 2) ─────────────────────────────────
  if (cx >= 2) {
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.55, 0),
      0, h * 0.7, -len * 0.05,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.55, 0),
      0, -h * 0.7, -len * 0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, h * 0.55, strutSeg),
      0, h * 0.35, -len * 0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, h * 0.55, strutSeg),
      0, -h * 0.35, -len * 0.05,
    ));
  }

  // ── Antenna spars (cx >= 2) ─────────────────────────────────────────────
  if (cx >= 2) {
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, h * 1.2, 3),
      sign * w * 0.5, h * 0.6, len * 0.15,
    )));
  }

  // ── Forward lattice expansion (cx >= 3) ──────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.5, 0),
      sign * w * 0.45, 0, len * 0.28,
    )));
    parts.push(...mirrorX(sign => {
      const dx = sign * w * 0.45;
      const dz = len * 0.23;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      return place(
        new THREE.CylinderGeometry(strutR, strutR, dist, strutSeg),
        sign * w * 0.225, 0, len * 0.165,
        HALF_PI, angle, 0,
      );
    }));
  }

  // ── Secondary drive ring (cx >= 3) ───────────────────────────────────────
  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(coreR * 0.65, coreR * 0.1, 6, 10),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, len * 0.09, strutSeg),
      0, 0, -len * 0.395,
      HALF_PI, 0, 0,
    ));
  }

  // ── Aft lattice cluster (cx >= 4) ────────────────────────────────────────
  if (cx >= 4) {
    const aftOff = len * 0.28;
    const aftSpread = w * 0.45;
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        parts.push(place(
          new THREE.OctahedronGeometry(coreR * 0.45, 0),
          x * aftSpread, y * aftSpread * 0.6, -aftOff,
        ));
      }
    }
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, aftSpread * 2.2, strutSeg),
      0, 0, -aftOff,
      0, 0, PI * 0.25,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, aftSpread * 2.2, strutSeg),
      0, 0, -aftOff,
      0, 0, -PI * 0.25,
    ));
  }

  // ── Capital ship: Gift broadcast array (cx >= 5) ─────────────────────────
  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(coreR * 1.8, coreR * 0.12, 8, 16),
      0, h * 0.6, len * 0.05,
      HALF_PI * 0.15, 0, 0,
    ));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2 + PI * 0.25;
      parts.push(place(
        new THREE.CylinderGeometry(strutR * 1.2, strutR * 1.2, h * 0.5, strutSeg),
        Math.cos(angle) * coreR * 1.2, h * 0.3, Math.sin(angle) * coreR * 1.2 + len * 0.05,
        0.15, 0, angle,
      ));
    }
  }

  // ── Capital ship: additional weapon hardpoints (cx >= 5) ─────────────────
  if (cx >= 5) {
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.2, len * 0.18, 5),
      sign * w * 0.7, 0, len * 0.32,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.12, len * 0.1, 5),
      sign * w * 0.25, h * 0.5, len * 0.35,
      HALF_PI, 0, 0,
    )));
  }

  // ── Heavy capital: outer lattice ring (cx >= 6) ──────────────────────────
  if (cx >= 6) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      const rx = Math.cos(angle) * w * 1.2;
      const ry = Math.sin(angle) * w * 0.8;
      parts.push(place(
        new THREE.OctahedronGeometry(coreR * 0.4, 0),
        rx, ry, -len * 0.08,
      ));
      const dist = Math.sqrt(rx * rx + ry * ry);
      parts.push(place(
        new THREE.CylinderGeometry(strutR, strutR, dist * 0.75, strutSeg),
        rx * 0.5, ry * 0.5, -len * 0.04,
        0, 0, Math.atan2(ry, rx) + HALF_PI,
      ));
    }
  }

  // ── The Silence node (cx >= 6) ───────────────────────────────────────────
  if (cx >= 6) {
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.85, 0),
      0, -h * 0.3, -len * 0.08,
      0, PI * 0.12, 0,
      1.0, 1.0, 1.1,
    ));
  }

  // ── Dreadnought: tertiary lattice spars (cx >= 7) ───────────────────────
  if (cx >= 7) {
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 1.5, strutR * 1.5, len * 0.6, strutSeg),
      sign * w * 0.8, h * 0.3, 0,
      0.25, sign * 0.15, 0,
    )));
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 1.5, strutR * 1.5, len * 0.6, strutSeg),
      sign * w * 0.8, -h * 0.3, 0,
      -0.25, sign * 0.15, 0,
    )));
    for (let y = -1; y <= 1; y++) {
      parts.push(place(
        new THREE.ConeGeometry(coreR * 0.14, len * 0.12, 5),
        0, y * h * 0.35, len * 0.48,
        HALF_PI, 0, 0,
      ));
    }
  }

  // ── Station-class: full lattice sphere (cx >= 8) ─────────────────────────
  if (cx >= 8) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const icoVerts: [number, number, number][] = [
      [ 1,  phi, 0], [-1,  phi, 0], [ 1, -phi, 0], [-1, -phi, 0],
      [ 0,  1,  phi], [ 0, -1,  phi], [ 0,  1, -phi], [ 0, -1, -phi],
    ];
    const icoScale = w * 0.7;
    for (const [vx, vy, vz] of icoVerts) {
      const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
      parts.push(place(
        new THREE.OctahedronGeometry(coreR * 0.3, 0),
        (vx / mag) * icoScale,
        (vy / mag) * icoScale,
        (vz / mag) * icoScale * 0.8,
      ));
    }
    parts.push(place(
      new THREE.TorusGeometry(w * 1.5, coreR * 0.08, 8, 24),
      0, 0, 0,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}
