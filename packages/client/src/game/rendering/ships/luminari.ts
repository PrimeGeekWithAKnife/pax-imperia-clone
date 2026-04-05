import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ============================================================================
 *  LUMINARI SHIP DESIGN — "Open Lattice Cage Architecture"
 * ============================================================================
 *
 *  The Luminari are not organisms. They are self-sustaining electromagnetic
 *  topologies — structured light, organised charge, recursive resonance
 *  patterns that achieved consciousness inside the plasma maelstrom of the
 *  Cygnus Radiant. Their ships are magnetic containment lattices that prevent
 *  a Luminari from dispersing into vacuum.
 *
 *  DESIGN LANGUAGE:
 *  - Open lattice cage: you can see THROUGH the ship. CylinderGeometry rods
 *    form the structural cage, SphereGeometry energy nodes sit at every
 *    intersection, TorusGeometry containment rings bind the structure.
 *  - Antenna sail spars: long thin rods radiating outward — espionage is
 *    a natural consequence of Luminari biology (espionage rating 9).
 *  - Engine: nested torus rings in a magnetic bottle configuration.
 *  - Capital ships: tilted asymmetric rings — the scatterbrained genius
 *    flourish of a species that finds solid matter faintly absurd.
 *
 *  MATERIAL NOTE: Luminari ships use transparent material (opacity 0.7).
 *  The cage structure IS the design — empty space between rods is intentional.
 *
 *  PART COUNTS: cx=0 yields ~12 parts; cx=5 yields ~55+ parts.
 */

export function buildLuminari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];
  const rodR = w * 0.018;                 // slender containment rods
  const thinR = rodR * 0.6;              // thinner bracing rods
  const hairR = rodR * 0.4;              // antenna-grade filaments
  const nodeSegs = Math.max(6, cx + 4);  // sphere detail scales with cx
  const ringSegs = Math.max(8, cx + 6);  // torus detail scales with cx

  // ============================================================================
  //  BASE GEOMETRY (cx = 0) — ~12 parts: core + cage rods + rings + nodes
  // ============================================================================

  // ── 1. Central energy core ─────────────────────────────────────────────────
  // The Luminari itself — a shimmering resonance pattern at the heart
  parts.push(place(
    new THREE.SphereGeometry(w * 0.20, nodeSegs, nodeSegs),
    0, 0, 0,
  ));

  // ── 2. Primary containment lattice — six longitudinal rods ─────────────────
  // Four cardinal rods plus two diagonal braces — the minimum cage
  const cageR = w * 0.28;                // cage radius from centreline
  const cageLen = len * 0.82;
  // Cardinal rods: top, bottom, left, right
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    0, cageR, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    0, -cageR, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(...mirrorX(s => place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    s * cageR, 0, 0,
    HALF_PI, 0, 0,
  )));
  // Diagonal rods: upper-left, upper-right (gives hex-cage feel)
  const diagR = cageR * 0.72;
  parts.push(...mirrorX(s => place(
    new THREE.CylinderGeometry(thinR, thinR, cageLen * 0.9, 4),
    s * diagR, diagR, 0,
    HALF_PI, 0, 0,
  )));

  // ── 3. Containment rings — two torus rings fore and aft ────────────────────
  // These bind the longitudinal rods into a coherent cage
  parts.push(place(
    new THREE.TorusGeometry(cageR, w * 0.022, 6, ringSegs),
    0, 0, len * 0.22,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.TorusGeometry(cageR, w * 0.022, 6, ringSegs),
    0, 0, -len * 0.22,
    HALF_PI, 0, 0,
  ));

  // ── 4. Intersection nodes — energy spheres where rods meet rings ───────────
  // Six nodes at the fore ring
  const cardinals: [number, number][] = [
    [0, cageR], [0, -cageR], [cageR, 0], [-cageR, 0],
    [diagR, diagR], [-diagR, diagR],
  ];
  for (const [nx, ny] of cardinals) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.045, 5, 5),
      nx, ny, len * 0.22,
    ));
  }

  // ── 5. Bow convergence — rods taper to a forward focus node ────────────────
  const bowZ = len * 0.46;
  parts.push(place(
    new THREE.SphereGeometry(w * 0.10, nodeSegs, nodeSegs),
    0, 0, bowZ,
  ));
  // Convergence rods from each cardinal rod to the bow node
  for (const [cx_, cy_] of cardinals.slice(0, 4)) {
    const dx = -cx_;
    const dy = -cy_;
    const dz = bowZ - len * 0.22;
    const rodLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const pitch = Math.atan2(Math.sqrt(dx * dx + dy * dy), dz);
    const yaw = Math.atan2(dx, dy);
    parts.push(place(
      new THREE.CylinderGeometry(thinR, thinR, rodLen, 4),
      cx_ * 0.5, cy_ * 0.5, len * 0.22 + dz * 0.5,
      pitch, yaw, 0,
    ));
  }

  // ============================================================================
  //  cx >= 1: Cross-bracing lattice
  // ============================================================================
  if (cx >= 1) {
    // Transverse cross-braces at midship — horizontal and vertical bars
    const braceZ = [len * 0.0, -len * 0.12];
    for (const zPos of braceZ) {
      parts.push(place(
        new THREE.CylinderGeometry(thinR, thinR, cageR * 2, 4),
        0, 0, zPos,
      ));
      parts.push(place(
        new THREE.CylinderGeometry(thinR, thinR, cageR * 2, 4),
        0, 0, zPos,
        0, 0, HALF_PI,
      ));
    }
    // Midship intersection nodes
    for (const [nx, ny] of cardinals.slice(0, 4)) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 5, 5),
        nx, ny, 0,
      ));
    }
  }

  // ============================================================================
  //  cx >= 2: Aft containment ring + engine magnetic bottle start
  // ============================================================================
  if (cx >= 2) {
    // Third containment ring — further aft
    parts.push(place(
      new THREE.TorusGeometry(cageR * 1.05, w * 0.020, 6, ringSegs),
      0, 0, -len * 0.35,
      HALF_PI, 0, 0,
    ));
    // Aft ring intersection nodes
    for (const [nx, ny] of cardinals.slice(0, 4)) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.04, 5, 5),
        nx * 1.05, ny * 1.05, -len * 0.35,
      ));
    }
    // Engine magnetic bottle — small torus at stern
    parts.push(place(
      new THREE.TorusGeometry(w * 0.15, w * 0.018, 6, 10),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));
    // Engine focus node
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 5, 5),
      0, 0, -len * 0.44,
    ));
  }

  // ============================================================================
  //  cx >= 3: Antenna sail spars (espionage signature)
  // ============================================================================
  if (cx >= 3) {
    // Long lateral antenna spars — the Luminari's sensor reach
    // These extend well beyond the cage, giving the ship a spindly,
    // ethereal silhouette. Espionage is their biology, not a profession.
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(hairR, hairR, len * 0.55, 3),
      s * w * 0.6, 0, len * 0.05,
      HALF_PI, 0, s * 0.15,
    )));
    // Dorsal antenna spar
    parts.push(place(
      new THREE.CylinderGeometry(hairR, hairR, len * 0.40, 3),
      0, w * 0.55, len * 0.06,
      -0.10, 0, 0,
    ));
    // Ventral antenna spar
    parts.push(place(
      new THREE.CylinderGeometry(hairR, hairR, len * 0.35, 3),
      0, -w * 0.50, len * 0.04,
      0.12, 0, 0,
    ));
    // Antenna tip nodes — faint energy concentrations at spar ends
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.03, 4, 4),
      s * w * 0.85, 0, len * 0.30,
    )));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.03, 4, 4),
      0, w * 0.73, len * 0.25,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.03, 4, 4),
      0, -w * 0.66, len * 0.21,
    ));
    // Diagonal cross-brace antenna spars (aft-angled)
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(hairR, hairR, len * 0.30, 3),
      s * w * 0.45, 0, -len * 0.20,
      HALF_PI, 0, s * 0.25,
    )));
    // Aft antenna tip nodes
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.025, 4, 4),
      s * w * 0.60, 0, -len * 0.34,
    )));
  }

  // ============================================================================
  //  cx >= 4: Primary containment ring + lattice densification
  // ============================================================================
  if (cx >= 4) {
    // Large midship containment ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.028, 8, 16),
      0, 0, len * 0.08,
      HALF_PI, 0, 0,
    ));
    // Ring-to-rod connecting struts (radial spokes)
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(thinR, thinR, w * 0.18, 4),
      s * w * 0.33, 0, len * 0.08,
      0, 0, HALF_PI,
    )));
    parts.push(place(
      new THREE.CylinderGeometry(thinR, thinR, w * 0.18, 4),
      0, w * 0.33, len * 0.08,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(thinR, thinR, w * 0.18, 4),
      0, -w * 0.33, len * 0.08,
    ));
    // Secondary lattice rods — angled bracing between fore and mid rings
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(thinR, thinR, len * 0.18, 4),
      s * cageR * 0.5, cageR * 0.5, len * 0.15,
      HALF_PI, s * 0.3, 0,
    )));
    // Extra intersection nodes at ring junctions
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.04, 5, 5),
      s * w * 0.42, 0, len * 0.08,
    )));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.04, 5, 5),
      0, w * 0.42, len * 0.08,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.04, 5, 5),
      0, -w * 0.42, len * 0.08,
    ));
    // Engine detail: second magnetic bottle ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.20, w * 0.016, 6, 10),
      0, 0, -len * 0.40,
      HALF_PI, 0, 0,
    ));
    // Engine struts connecting bottle rings
    for (const angle of [0, HALF_PI, PI, PI * 1.5]) {
      parts.push(place(
        new THREE.CylinderGeometry(hairR, hairR, len * 0.06, 3),
        Math.cos(angle) * w * 0.175, Math.sin(angle) * w * 0.175, -len * 0.42,
        HALF_PI, 0, 0,
      ));
    }
  }

  // ============================================================================
  //  cx >= 5: Full cage — aft expansion + engine magnetic bottle complete
  // ============================================================================
  if (cx >= 5) {
    // Large aft containment ring — the cage flares slightly
    parts.push(place(
      new THREE.TorusGeometry(w * 0.52, w * 0.025, 8, 18),
      0, 0, -len * 0.18,
      HALF_PI, 0, 0,
    ));
    // Struts connecting mid ring to aft ring
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
        new THREE.CylinderGeometry(thinR, thinR, strutLen, 4),
        (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2,
        Math.acos(dy / strutLen), 0, Math.atan2(dx, dy),
      ));
    }
    // Aft ring intersection nodes
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.04, 5, 5),
        ox * w * 0.52, oy * w * 0.52, -len * 0.18,
      ));
    }
    // Aft focus node
    parts.push(place(
      new THREE.SphereGeometry(w * 0.08, 6, 6),
      0, 0, -len * 0.38,
    ));
    // Engine magnetic bottle — three nested torus rings
    parts.push(place(
      new THREE.TorusGeometry(w * 0.12, w * 0.014, 6, 10),
      0, 0, -len * 0.48,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.012, 6, 10),
      0, 0, -len * 0.46,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.30, w * 0.010, 6, 12),
      0, 0, -len * 0.43,
      HALF_PI, 0, 0,
    ));
    // Bottle struts — connecting nested rings
    for (const angle of [0, PI * 0.5, PI, PI * 1.5]) {
      const r1 = w * 0.12;
      const r2 = w * 0.30;
      parts.push(place(
        new THREE.CylinderGeometry(hairR, hairR, (r2 - r1), 3),
        Math.cos(angle) * (r1 + r2) * 0.5,
        Math.sin(angle) * (r1 + r2) * 0.5,
        -len * 0.455,
        0, 0, angle + HALF_PI,
      ));
    }
    // Extra lattice cross-bracing at aft ring
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(thinR, thinR, w * 0.52, 4),
      s * w * 0.26, 0, -len * 0.18,
      0, 0, HALF_PI,
    )));
  }

  // ============================================================================
  //  cx >= 6: Capital — tilted asymmetric ring (genius flourish)
  // ============================================================================
  if (cx >= 6) {
    // The signature Luminari capital-ship ring: tilted off-axis, asymmetric.
    // A species that finds solid matter faintly absurd does not build symmetry.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.38, w * 0.024, 8, 16),
      w * 0.04, -w * 0.03, len * 0.20,
      HALF_PI + 0.44, 0.30, 0.15,
    ));
    // Asymmetric struts from tilted ring to cage
    parts.push(place(
      new THREE.CylinderGeometry(thinR, thinR, len * 0.50, 4),
      w * 0.02, w * 0.05, len * 0.05,
      HALF_PI, PI / 4, 0.20,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(thinR, thinR, len * 0.50, 4),
      -w * 0.02, -w * 0.03, len * 0.05,
      HALF_PI, -PI / 4, -0.20,
    ));
    // Ring junction nodes
    parts.push(place(
      new THREE.SphereGeometry(w * 0.045, 5, 5),
      w * 0.38, -w * 0.06, len * 0.24,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.045, 5, 5),
      -w * 0.30, w * 0.02, len * 0.16,
    ));
    // Additional capital antenna spars — longer reach
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(hairR, hairR, len * 0.45, 3),
      s * w * 0.70, 0, -len * 0.10,
      HALF_PI, 0, s * 0.20,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.025, 4, 4),
      s * w * 0.92, 0, -len * 0.32,
    )));
  }

  // ============================================================================
  //  cx >= 7: Node corona + dense lattice web
  // ============================================================================
  if (cx >= 7) {
    // Corona of energy nodes orbiting the core — the Luminari's full presence
    const coronaCount = 8;
    for (let i = 0; i < coronaCount; i++) {
      const angle = (i / coronaCount) * PI * 2;
      const cr = w * 0.34;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 4),
        Math.cos(angle) * cr,
        Math.sin(angle) * cr,
        0,
      ));
    }
    // Corona connecting filaments — ring of thin rods between nodes
    for (let i = 0; i < coronaCount; i++) {
      const a1 = (i / coronaCount) * PI * 2;
      const a2 = ((i + 1) / coronaCount) * PI * 2;
      const cr = w * 0.34;
      const x1 = Math.cos(a1) * cr;
      const y1 = Math.sin(a1) * cr;
      const x2 = Math.cos(a2) * cr;
      const y2 = Math.sin(a2) * cr;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      parts.push(place(
        new THREE.CylinderGeometry(hairR * 0.7, hairR * 0.7, segLen, 3),
        (x1 + x2) * 0.5, (y1 + y2) * 0.5, 0,
        0, 0, Math.atan2(dx, dy),
      ));
    }
    // Ventral deep antenna
    parts.push(place(
      new THREE.CylinderGeometry(hairR, hairR, len * 0.40, 3),
      0, -w * 0.60, -len * 0.05,
      -0.15, 0, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.03, 4, 4),
      0, -w * 0.78, -len * 0.10,
    ));
    // Aft lateral antenna spars
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(hairR, hairR, len * 0.35, 3),
      s * w * 0.50, 0, -len * 0.28,
      HALF_PI, 0, s * 0.22,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.025, 4, 4),
      s * w * 0.66, 0, -len * 0.44,
    )));
    // Extra lattice bracing between fore and aft sections
    for (const [ox, oy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as [number, number][]) {
      parts.push(place(
        new THREE.CylinderGeometry(hairR * 0.7, hairR * 0.7, len * 0.25, 3),
        ox * cageR * 0.5, oy * cageR * 0.5, -len * 0.05,
        HALF_PI, Math.atan2(ox, oy) * 0.15, 0,
      ));
    }
  }

  // ============================================================================
  //  cx >= 8: Full nebula capture — maximal lattice density
  // ============================================================================
  if (cx >= 8) {
    // Forward sensor ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.25, w * 0.018, 6, 12),
      0, 0, len * 0.36,
      HALF_PI, 0, 0,
    ));
    // Forward ring spokes
    for (const angle of [0, HALF_PI, PI, PI * 1.5]) {
      parts.push(place(
        new THREE.CylinderGeometry(hairR, hairR, w * 0.20, 3),
        Math.cos(angle) * w * 0.13, Math.sin(angle) * w * 0.13, len * 0.36,
        0, 0, angle + HALF_PI,
      ));
    }
    // Aft antenna array — three parallel spars with tip nodes
    for (let i = -1; i <= 1; i++) {
      parts.push(place(
        new THREE.CylinderGeometry(hairR, hairR, len * 0.28, 3),
        0, i * w * 0.18, -len * 0.45,
        HALF_PI + i * 0.18, 0, 0,
      ));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.025, 4, 4),
        0, i * w * 0.22, -len * 0.58,
      ));
    }
    // Aft corona — nodes orbiting the aft focus
    const aftCorona = 6;
    for (let i = 0; i < aftCorona; i++) {
      const angle = (i / aftCorona) * PI * 2 + 0.3;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.03, 4, 4),
        Math.cos(angle) * w * 0.48,
        Math.sin(angle) * w * 0.48,
        -len * 0.18,
      ));
    }
    // Second tilted asymmetric ring — smaller, different tilt axis
    parts.push(place(
      new THREE.TorusGeometry(w * 0.28, w * 0.016, 6, 12),
      -w * 0.06, w * 0.04, -len * 0.05,
      HALF_PI + 0.55, -0.35, 0.20,
    ));
    // Deep lattice web — additional cross-members for density
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2 + PI / 4;
      const r = cageR * 0.65;
      parts.push(place(
        new THREE.CylinderGeometry(hairR * 0.6, hairR * 0.6, len * 0.30, 3),
        Math.cos(angle) * r, Math.sin(angle) * r, -len * 0.02,
        HALF_PI, 0, 0,
      ));
    }
  }

  return merge(parts);
}
