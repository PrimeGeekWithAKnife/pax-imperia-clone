import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  AETHYN SHIP DESIGN — "Not Entirely Here"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  The Aethyn are interdimensional pioneers. Their ships are projected into
 *  our 3D space — partial cross-sections of higher-dimensional objects.
 *  What we see is what intersects our three spatial dimensions; the rest
 *  extends into compactified dimensions our instruments cannot detect.
 *
 *  DESIGN LANGUAGE:
 *  - Borromean rings: three interlocking tori at non-orthogonal angles
 *  - Nested Platonic solids: dodecahedra cradling icosahedra cradling octahedra
 *  - Disconnected geometry: parts float with no visible connection (the
 *    connecting structure exists in dimensions we cannot perceive)
 *  - No engines: they phase-shift through space; pulsing torus rings mark
 *    the dimensional aperture where phase-shift energy bleeds through
 *  - Weapons obey laws of physics that are not ours: tetrahedra and octahedra
 *    arranged in focus arrays channel forces from adjacent dimensions
 *
 *  PALETTE: Deep purple, semi-transparent (opacity 0.75), magenta emissive.
 *
 *  DISTINCTIVENESS: No other species uses intersecting tori, disconnected
 *  floating geometry, or nested Platonic solids. This is uniquely Aethyn.
 */

export function buildAethyn(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const parts: THREE.BufferGeometry[] = [];

  // ── Core cross-section: nested Platonic solids ────────────────────────────
  // A dodecahedron containing an icosahedron — the innermost projection of
  // their hyperdimensional core. Even the smallest scout carries this sigil.
  parts.push(place(
    new THREE.DodecahedronGeometry(w * 0.42, 0),
    0, 0, 0,
  ));
  parts.push(place(
    new THREE.IcosahedronGeometry(w * 0.26, 0),
    0, 0, 0,
    0.32, 0.55, 0.18,
  ));

  // ── Borromean ring alpha — primary dimensional aperture ───────────────────
  // The first of three interlocking tori. Each ring exists mostly in a
  // different dimensional plane; we see only their 3D cross-sections.
  parts.push(place(
    new THREE.TorusGeometry(w * 0.52, w * 0.035, 8, 16),
    0, 0, -len * 0.06,
    0.72, 0.38, 0,
  ));

  // ── Forward projection tetrahedron — primary sensor focus ─────────────────
  // Disconnected; floats ahead of the hull. The strut connecting it passes
  // through the fourth spatial dimension.
  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.32, 0),
    0, 0, len * 0.34,
    0.62, 0.85, 0.4,
  ));

  // ── Aft projection tetrahedron — phase-shift resonator ────────────────────
  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.24, 0),
    0, 0, -len * 0.30,
    1.05, 0.35, 0.72,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 1: Non-orthogonal struts — dimensional bleed-through
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 1) {
    // Struts at irrational angles — they connect to structures in adjacent
    // dimensions, so they appear to start and end in empty space.
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
    // Small floating octahedron — tip of a larger structure mostly elsewhere
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.10, 0),
      w * 0.38, w * 0.22, len * 0.12,
      0.4, 0.7, 1.1,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 2: Disconnected satellite polyhedra
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 2) {
    // Floating icosahedra — each is a cross-section of a hypersphere node
    // that connects to the main hull through unseen dimensions.
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.14, 0),
      w * 0.58, w * 0.30, len * 0.18,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.12, 0),
      -w * 0.52, -w * 0.28, -len * 0.14,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.10, 0),
      w * 0.15, w * 0.55, -len * 0.22,
    ));
    // Additional floating tetrahedron — weapon focus node
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.11, 0),
      -w * 0.42, w * 0.18, len * 0.26,
      0.9, 0.3, 1.4,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 3: Borromean ring beta — second interlocking torus
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 3) {
    // The second ring of the Borromean triplet. Tilted at a non-orthogonal
    // angle to the first, creating the signature interlocked silhouette.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.50, w * 0.032, 8, 16),
      0, 0, len * 0.02,
      HALF_PI + 0.42, 0.85, 0,
    ));
    // Small octahedra at the ring intersections — dimensional friction nodes
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.07, 0),
      w * 0.42, -w * 0.15, -len * 0.08,
      0.5, 1.2, 0.3,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.06, 0),
      -w * 0.35, w * 0.32, len * 0.10,
      1.1, 0.4, 0.8,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 4: Phase-shift pulse rings (no engines — they fold space)
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 4) {
    // Aft pulsing torus — the dimensional aperture where phase-shift energy
    // bleeds into our space. Not a drive; the ship is always already moving
    // through adjacent dimensions. This ring marks the boundary.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.28, w * 0.042, 8, 14),
      0, 0, -len * 0.38,
      HALF_PI + 0.12, 0.08, 0,
    ));
    // Secondary pulse ring — slightly offset in space and angle
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.035, 6, 12),
      0, 0, -len * 0.44,
      HALF_PI - 0.15, 0.22, 0.10,
    ));
    // Dimensional filament struts connecting rings to the core
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.015, len * 0.42, 4),
      w * 0.15, w * 0.1, -len * 0.08,
      0.7, 0.2, 1.3,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.015, len * 0.38, 4),
      -w * 0.12, -w * 0.08, -len * 0.04,
      1.4, 0.9, 0.3,
    ));
    // Nested octahedron within the core — third layer of Platonic nesting
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.15, 0),
      0, 0, 0,
      0.42, 0.78, 0.15,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 5: Full Borromean triplet + weapon focus arrays + satellite field
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 5) {
    // Borromean ring gamma — completes the triplet. Three interlocked rings
    // that cannot be separated without breaking one — a topological statement
    // about the inseparability of dimensions.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, w * 0.030, 8, 18),
      0, 0, -len * 0.01,
      0.25, HALF_PI + 0.30, 0,
    ));

    // Outer dodecahedron shell — the nested-solid motif at capital scale.
    // Dodecahedron (outer) > icosahedron (mid, from cx=0) > octahedron (inner, from cx=4)
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.65, 0),
      0, 0, 0,
      0.5, 0.5, 0.5,
    ));

    // Forward weapon focus array — tetrahedra arranged in a triangular pattern.
    // Each focuses dimensional energy from adjacent realities.
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.14, 0),
      w * 0.18, w * 0.10, len * 0.44,
      0.3, 0.8, 0.5,
    ));
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.13, 0),
      -w * 0.16, w * 0.12, len * 0.42,
      1.1, 0.4, 0.9,
    ));
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.12, 0),
      0, -w * 0.18, len * 0.46,
      0.7, 1.3, 0.2,
    ));

    // Floating octahedra weapon focus nodes — disconnected, hovering at
    // cardinal-ish offsets. They channel forces from adjacent dimensions.
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.10, 0),
      w * 0.62, -w * 0.35, len * 0.22,
      0.4, 0.7, 1.1,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.09, 0),
      -w * 0.58, w * 0.40, len * 0.08,
      1.2, 0.3, 0.5,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.08, 0),
      -w * 0.22, -w * 0.52, -len * 0.28,
      0.8, 1.5, 0.2,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.09, 0),
      w * 0.48, w * 0.38, -len * 0.20,
      0.6, 0.9, 1.4,
    ));

    // Dimensional satellite icosahedra — further out, more disconnected
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.08, 0),
      w * 0.72, 0, len * 0.05,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.07, 0),
      -w * 0.68, -w * 0.15, -len * 0.10,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.06, 0),
      0, w * 0.70, len * 0.15,
    ));

    // Forward aperture ring — marks the bow phase-shift boundary
    parts.push(place(
      new THREE.TorusGeometry(w * 0.24, w * 0.038, 6, 12),
      0, 0, len * 0.44,
      HALF_PI + 0.08, 0.12, 0,
    ));

    // Additional non-orthogonal struts phasing through the hull
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.62, 4),
      w * 0.08, -w * 0.06, 0,
      0.55, 0.92, 0.28,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.50, 4),
      -w * 0.10, w * 0.05, len * 0.04,
      1.22, 0.38, 0.75,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 6: Dimensional bleed-through lattice + expanded weapon arrays
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 6) {
    // Radial struts at irrational angles — dimensional bleed-through lattice.
    // Each rod connects to a structure in an adjacent dimension; where they
    // intersect our space, they appear as free-floating lines.
    for (let i = 0; i < 3; i++) {
      const angle = (PI * 2 * i) / 3;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.62, 4),
        w * 0.30 * Math.cos(angle),
        w * 0.30 * Math.sin(angle),
        0,
        angle * 0.7, 0.5 + i * 0.4, angle * 0.3,
      ));
    }

    // Fourth torus — not part of the Borromean triplet but a containment
    // ring for the dimensional lattice. Tilted to avoid orthogonality.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.62, w * 0.025, 8, 18),
      0, 0, 0,
      1.1, 0.2, HALF_PI,
    ));

    // Flanking tetrahedra — weapon focus extensions
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.13, 0),
      s * w * 0.72, 0, len * 0.15,
      0.9, s * 0.6, 0.3,
    )));

    // Dorsal and ventral floating dodecahedra — cross-sections of
    // higher-dimensional sensor arrays
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.10, 0),
      0, w * 0.62, len * 0.05,
      0.3, 0.8, 0.1,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.09, 0),
      0, -w * 0.58, -len * 0.08,
      0.7, 0.2, 1.1,
    ));

    // Additional disconnected octahedra — the weapon array grows
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.07, 0),
      s * w * 0.55, w * 0.25, -len * 0.32,
      s * 0.4, 1.0, 0.6,
    )));

    // Aft third pulse ring — slightly larger, marking expanded phase aperture
    parts.push(place(
      new THREE.TorusGeometry(w * 0.34, w * 0.030, 6, 14),
      0, 0, -len * 0.50,
      HALF_PI - 0.08, 0.15, 0.06,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 7: Capital-class dimensional projection — full hypersphere echo
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 7) {
    // Grand outer torus — the ship's dimensional footprint is now so large
    // that the outermost Borromean ring is visible as a distinct halo.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.82, w * 0.038, 10, 22),
      0, 0, 0,
      HALF_PI + 0.15, 0, 0,
    ));

    // Distant floating dodecahedra — these appear further from the hull
    // as the ship's higher-dimensional projection grows.
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.18, 0),
      w * 0.78, 0, len * 0.22,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.16, 0),
      -w * 0.74, 0, -len * 0.18,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.14, 0),
      0, w * 0.75, 0,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.12, 0),
      w * 0.20, -w * 0.72, len * 0.10,
      0.4, 0.9, 0.2,
    ));

    // Pentagonal ring of tetrahedra around the bow — the full weapon
    // focus array for a capital ship. Five tetrahedra arranged in a
    // pentagon, each at a unique non-orthogonal rotation.
    for (let i = 0; i < 5; i++) {
      const angle = (PI * 2 * i) / 5;
      const r = w * 0.35;
      parts.push(place(
        new THREE.TetrahedronGeometry(w * 0.09, 0),
        Math.cos(angle) * r,
        Math.sin(angle) * r,
        len * 0.48,
        angle * 0.8 + 0.3, angle * 0.5 + 0.7, angle * 0.3,
      ));
    }

    // Additional non-orthogonal struts — the lattice thickens
    for (let i = 0; i < 4; i++) {
      const angle = (PI * 2 * i) / 4 + 0.4;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.010, len * 0.55, 4),
        w * 0.20 * Math.cos(angle),
        w * 0.20 * Math.sin(angle),
        len * 0.05,
        angle * 0.6 + 0.2, 0.8 + i * 0.3, angle * 0.4,
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 8: Flagship — full dimensional manifestation
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 8) {
    // Outermost icosahedron shell — the fourth layer of nested Platonic solids.
    // At flagship scale: icosahedron > dodecahedron > icosahedron > octahedron
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.82, 0),
      0, 0, 0,
      0.18, 0.35, 0.62,
    ));

    // Fifth and sixth tori — the Borromean structure is now doubled,
    // creating a six-ring dimensional cage.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.72, w * 0.028, 8, 20),
      0, 0, len * 0.08,
      0.55, HALF_PI - 0.20, 0.35,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.68, w * 0.025, 8, 18),
      0, 0, -len * 0.10,
      HALF_PI + 0.35, 0.65, HALF_PI,
    ));

    // Orbital ring of octahedra — a halo of weapon nodes encircling the hull
    for (let i = 0; i < 6; i++) {
      const angle = (PI * 2 * i) / 6 + 0.25;
      const r = w * 0.90;
      parts.push(place(
        new THREE.OctahedronGeometry(w * 0.06, 0),
        Math.cos(angle) * r,
        Math.sin(angle) * r,
        len * (-0.05 + 0.08 * Math.sin(angle * 2)),
        angle * 0.9, angle * 0.4 + 0.5, 0.3,
      ));
    }

    // Deep aft phase-shift cluster — four nested pulse rings
    parts.push(place(
      new THREE.TorusGeometry(w * 0.40, w * 0.032, 8, 16),
      0, 0, -len * 0.52,
      HALF_PI + 0.06, -0.10, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.32, w * 0.028, 6, 14),
      0, 0, -len * 0.56,
      HALF_PI - 0.10, 0.18, 0.05,
    ));

    // Floating icosahedra corona — distant satellite nodes
    for (let i = 0; i < 4; i++) {
      const angle = (PI * 2 * i) / 4 + 0.6;
      parts.push(place(
        new THREE.IcosahedronGeometry(w * 0.07, 0),
        Math.cos(angle) * w * 0.95,
        Math.sin(angle) * w * 0.95,
        len * 0.15 * Math.cos(angle),
      ));
    }
  }

  return merge(parts);
}
