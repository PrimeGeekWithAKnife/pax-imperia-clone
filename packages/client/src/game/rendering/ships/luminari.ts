import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ============================================================================
 *  LUMINARI SHIP DESIGN — "Vessels of Structured Light"
 * ============================================================================
 *
 *  The Luminari are not organisms. They are self-sustaining electromagnetic
 *  topologies — structured light, organised charge, recursive resonance
 *  patterns that achieved consciousness inside the plasma maelstrom of the
 *  Cygnus Radiant. Their ships are magnetic containment lattices that prevent
 *  a Luminari from dispersing into vacuum. Open lattice geometry with nested
 *  concentric torus rings, energy node spheres, and sail-like antenna spars.
 *
 *  DISTINCTIVENESS: No other species uses open lattice — rods, rings, and
 *  point-nodes with empty space between them. You see through a Luminari ship.
 */

export function buildLuminari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];
  const rodR = w * 0.018;                 // slender containment rods
  const nodeSegs = Math.max(6, cx + 4);   // sphere detail scales with cx

  // ── Central energy core ──────────────────────────────────────────────────
  parts.push(place(
    new THREE.SphereGeometry(w * 0.22, nodeSegs, nodeSegs),
    0, 0, 0,
  ));

  // ── Primary containment lattice — four longitudinal rods ─────────────────
  const cageOffset = w * 0.28;
  const cageLen = len * 0.82;
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    0, cageOffset, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    0, -cageOffset, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(...mirrorX(s => place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    s * cageOffset, 0, 0,
    HALF_PI, 0, 0,
  )));

  // ── Transverse braces ────────────────────────────────────────────────────
  const bracePositions = [len * 0.32, -len * 0.32];
  for (const zPos of bracePositions) {
    parts.push(place(
      new THREE.CylinderGeometry(rodR, rodR, cageOffset * 2, 4),
      0, 0, zPos,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(rodR, rodR, cageOffset * 2, 4),
      0, 0, zPos,
      0, 0, HALF_PI,
    ));
  }

  // ── Bow convergence point ────────────────────────────────────────────────
  const bowZ = len * 0.46;
  parts.push(place(
    new THREE.SphereGeometry(w * 0.10, nodeSegs, nodeSegs),
    0, 0, bowZ,
  ));
  const corners: [number, number][] = [
    [cageOffset, 0], [-cageOffset, 0], [0, cageOffset], [0, -cageOffset],
  ];
  for (const [cx_, cy_] of corners) {
    const dx = -cx_;
    const dy = -cy_;
    const dz = bowZ - len * 0.32;
    const rodLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const pitch = -Math.asin(dz / rodLen);
    const yaw = Math.atan2(dx, dy);
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.7, rodR * 0.7, rodLen, 4),
      cx_ * 0.5, cy_ * 0.5, (len * 0.32 + bowZ) * 0.5,
      pitch, yaw, 0,
    ));
  }

  // ── cx >= 2: Side energy nodes ───────────────────────────────────────────
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.07, 5, 5),
      s * cageOffset, 0, len * 0.18,
    )));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 5, 5),
      0, cageOffset, -len * 0.18,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 5, 5),
      0, -cageOffset, -len * 0.18,
    ));
  }

  // ── cx >= 3: Antenna sail spars ──────────────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.45, 3),
      s * w * 0.55, 0, len * 0.05,
      HALF_PI, 0, s * 0.18,
    )));
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.3, 3),
      0, w * 0.5, len * 0.08,
      0.12, 0, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.04, 4, 4),
      s * w * 0.72, 0, len * 0.26,
    )));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.04, 4, 4),
      0, w * 0.63, len * 0.22,
    ));
  }

  // ── cx >= 4: Primary containment ring ────────────────────────────────────
  if (cx >= 4) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.028, 8, 16),
      0, 0, len * 0.08,
      HALF_PI, 0, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(rodR * 0.6, rodR * 0.6, w * 0.3, 4),
      s * w * 0.28, 0, len * 0.08,
      0, 0, HALF_PI,
    )));
  }

  // ── cx >= 5: Secondary aft containment ring ──────────────────────────────
  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.52, w * 0.025, 8, 18),
      0, 0, -len * 0.18,
      HALF_PI, 0, 0,
    ));
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const x1 = ox * w * 0.42;
      const y1 = oy * w * 0.42;
      const z1 = len * 0.08;
      const x2 = ox * w * 0.52;
      const y2 = oy * w * 0.52;
      const z2 = -len * 0.18;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;
      const strutLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
      parts.push(place(
        new THREE.CylinderGeometry(rodR * 0.6, rodR * 0.6, strutLen, 4),
        (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2,
        Math.acos(dy / strutLen), 0, Math.atan2(dx, dy),
      ));
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.09, 6, 6),
      0, 0, -len * 0.38,
    ));
  }

  // ── cx >= 6: Tilted tertiary ring ────────────────────────────────────────
  if (cx >= 6) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.35, w * 0.022, 6, 14),
      0, 0, len * 0.25,
      HALF_PI + 0.44, 0.3, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.6, 4),
      0, 0, 0,
      HALF_PI, PI / 4, 0.2,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.6, 4),
      0, 0, 0,
      HALF_PI, -PI / 4, -0.2,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.05, 5, 5),
      s * w * 0.52, 0, len * 0.25,
    )));
  }

  // ── cx >= 7: Node corona and additional antenna spars ────────────────────
  if (cx >= 7) {
    const coronaCount = 6;
    for (let i = 0; i < coronaCount; i++) {
      const angle = (i / coronaCount) * PI * 2;
      const cr = w * 0.32;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.04, 4, 4),
        Math.cos(angle) * cr,
        Math.sin(angle) * cr,
        0,
      ));
    }
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.4, rodR * 0.4, len * 0.35, 3),
      0, -w * 0.55, -len * 0.05,
      -0.15, 0, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.035, 4, 4),
      0, -w * 0.72, -len * 0.08,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(rodR * 0.4, rodR * 0.4, len * 0.3, 3),
      s * w * 0.45, 0, -len * 0.25,
      HALF_PI, 0, s * 0.25,
    )));
  }

  // ── cx >= 8: Full nebula capture ─────────────────────────────────────────
  if (cx >= 8) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.25, w * 0.02, 6, 12),
      0, 0, len * 0.36,
      HALF_PI, 0, 0,
    ));
    for (let i = -1; i <= 1; i++) {
      parts.push(place(
        new THREE.CylinderGeometry(rodR * 0.4, rodR * 0.4, len * 0.25, 3),
        0, i * w * 0.2, -len * 0.42,
        HALF_PI + i * 0.2, 0, 0,
      ));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.03, 4, 4),
        0, i * w * 0.25, -len * 0.54,
      ));
    }
    const aftCorona = 5;
    for (let i = 0; i < aftCorona; i++) {
      const angle = (i / aftCorona) * PI * 2 + 0.3;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 4),
        Math.cos(angle) * w * 0.48,
        Math.sin(angle) * w * 0.48,
        -len * 0.18,
      ));
    }
  }

  return merge(parts);
}
