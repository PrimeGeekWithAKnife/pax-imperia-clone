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
 *  SCALING PHILOSOPHY: Ships grow by adding MORE NODES to the lattice,
 *  never by scaling hulls bigger. A dreadnought is a dense star-cluster of
 *  octahedral cores; a fighter is three nodes and two struts.
 *
 *  GEOMETRY KEY:
 *  - OctahedronGeometry  → processing cores (consciousness housing)
 *  - CylinderGeometry    → data-conduit struts (thin, angular)
 *  - IcosahedronGeometry → sensor relays (rounder, faceted)
 *  - TorusGeometry       → field-drive rings (propulsion, not exhaust)
 *  - ConeGeometry        → data-beam emitters (weapons — slim, needle-like)
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 0 — BASE LATTICE (always present, 7 parts)
  //  Even the smallest probe is a recognisable constellation.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Primary processing core (central octahedron) ─────────────────────────
  // The heart of the node — elongated along Z to suggest forward momentum.
  parts.push(place(
    new THREE.OctahedronGeometry(coreR * 1.2, 0),
    0, 0, len * 0.05,
    0, 0, 0,
    1.0, 1.0, 1.4,
  ));

  // ── Forward sensor relay (icosahedron — rounder, different read) ─────────
  parts.push(place(
    new THREE.IcosahedronGeometry(coreR * 0.4, 0),
    0, 0, len * 0.38,
  ));

  // ── Forward data conduit (core → sensor) ─────────────────────────────────
  parts.push(place(
    new THREE.CylinderGeometry(strutR, strutR, len * 0.28, strutSeg),
    0, 0, len * 0.22,
    HALF_PI, 0, 0,
  ));

  // ── Aft primary field-drive ring ─────────────────────────────────────────
  // Torus drive — the Nexari do not burn fuel; they distort local spacetime.
  parts.push(place(
    new THREE.TorusGeometry(coreR * 1.0, coreR * 0.15, 6, 12),
    0, 0, -len * 0.35,
    HALF_PI, 0, 0,
  ));

  // ── Aft data conduit (core → drive ring) ─────────────────────────────────
  parts.push(place(
    new THREE.CylinderGeometry(strutR, strutR, len * 0.32, strutSeg),
    0, 0, -len * 0.18,
    HALF_PI, 0, 0,
  ));

  // ── Dorsal micro-relay (tiny icosahedron above core) ─────────────────────
  parts.push(place(
    new THREE.IcosahedronGeometry(coreR * 0.2, 0),
    0, h * 0.35, len * 0.08,
  ));

  // ── Dorsal micro-strut (core → micro-relay) ─────────────────────────────
  parts.push(place(
    new THREE.CylinderGeometry(strutR * 0.7, strutR * 0.7, h * 0.25, strutSeg),
    0, h * 0.18, len * 0.065,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 1 — LATERAL EXPANSION (cx >= 1, +10 parts)
  //  First lateral nodes appear — the ship reads as a three-armed star.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 1) {
    // Lateral processing sub-cores
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.7, 0),
      sign * w * 0.7, 0, -len * 0.05,
    )));

    // Lateral struts (core → lateral sub-cores)
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR, strutR, w * 0.55, strutSeg),
      sign * w * 0.35, 0, 0,
      0, 0, HALF_PI,
    )));

    // Forward weapon emitters — slim data-beam cones
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.12, len * 0.14, 5),
      sign * w * 0.3, 0, len * 0.42,
      HALF_PI, 0, 0,
    )));

    // Forward diagonal struts (lateral nodes → sensor relay)
    parts.push(...mirrorX(sign => {
      const dx = sign * w * 0.7;
      const dz = len * 0.43;
      const dist = Math.sqrt(dx * dx + dz * dz) * 0.55;
      const angle = Math.atan2(dx, dz);
      return place(
        new THREE.CylinderGeometry(strutR * 0.7, strutR * 0.7, dist, strutSeg),
        sign * w * 0.35, 0, len * 0.2,
        HALF_PI, angle, 0,
      );
    }));

    // Ventral micro-relay beneath core
    parts.push(place(
      new THREE.IcosahedronGeometry(coreR * 0.18, 0),
      0, -h * 0.32, len * 0.0,
    ));

    // Ventral micro-strut
    parts.push(place(
      new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, h * 0.22, strutSeg),
      0, -h * 0.18, len * 0.0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 2 — VERTICAL LATTICE (cx >= 2, +10 parts)
  //  Dorsal/ventral nodes give the ship a 3D lattice presence.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 2) {
    // Dorsal processing node
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.55, 0),
      0, h * 0.7, -len * 0.05,
    ));

    // Ventral processing node
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.55, 0),
      0, -h * 0.7, -len * 0.05,
    ));

    // Vertical struts (core → dorsal/ventral nodes)
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, h * 0.55, strutSeg),
      0, h * 0.35, -len * 0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, h * 0.55, strutSeg),
      0, -h * 0.35, -len * 0.05,
    ));

    // Antenna spars — diagonal upward struts from lateral area
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, h * 1.2, 3),
      sign * w * 0.5, h * 0.6, len * 0.15,
    )));

    // Lateral sensor relays (small icosahedra at wing-tips)
    parts.push(...mirrorX(sign => place(
      new THREE.IcosahedronGeometry(coreR * 0.22, 0),
      sign * w * 0.95, 0, -len * 0.05,
    )));

    // Wing-tip struts (lateral cores → sensor relays)
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 0.5, strutR * 0.5, w * 0.22, strutSeg),
      sign * w * 0.82, 0, -len * 0.05,
      0, 0, HALF_PI,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 3 — FORWARD LATTICE + SECONDARY DRIVE (cx >= 3, +10 parts)
  //  The constellation extends forward; a second drive ring appears.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 3) {
    // Forward lateral sub-nodes
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.5, 0),
      sign * w * 0.45, 0, len * 0.28,
    )));

    // Diagonal struts (core → forward lateral sub-nodes)
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

    // Secondary aft drive ring (smaller)
    parts.push(place(
      new THREE.TorusGeometry(coreR * 0.65, coreR * 0.1, 6, 10),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));

    // Strut linking primary and secondary drive rings
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, len * 0.09, strutSeg),
      0, 0, -len * 0.395,
      HALF_PI, 0, 0,
    ));

    // Forward-dorsal micro-node
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.25, 0),
      0, h * 0.45, len * 0.25,
    ));

    // Strut (dorsal node → forward-dorsal micro-node)
    parts.push(place(
      new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, len * 0.28, strutSeg),
      0, h * 0.58, len * 0.1,
      HALF_PI * 0.85, 0, 0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 4 — AFT LATTICE CLUSTER (cx >= 4, +12 parts)
  //  Quad-cluster aft; cross-bracing struts; the lattice thickens.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 4) {
    const aftOff = len * 0.28;
    const aftSpread = w * 0.45;

    // Four aft processing nodes (2x2 grid)
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        parts.push(place(
          new THREE.OctahedronGeometry(coreR * 0.45, 0),
          x * aftSpread, y * aftSpread * 0.6, -aftOff,
        ));
      }
    }

    // Cross-bracing struts (X-pattern through aft cluster)
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

    // Aft cluster → primary core linking struts
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 0.8, strutR * 0.8, len * 0.22, strutSeg),
      sign * aftSpread * 0.5, 0, -len * 0.16,
      HALF_PI, Math.atan2(sign * aftSpread * 0.5, len * 0.22) * 0.5, 0,
    )));

    // Aft micro-sensor relay (icosahedron behind aft cluster)
    parts.push(place(
      new THREE.IcosahedronGeometry(coreR * 0.25, 0),
      0, 0, -len * 0.38,
    ));

    // Aft micro-relay strut
    parts.push(place(
      new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, len * 0.08, strutSeg),
      0, 0, -len * 0.34,
      HALF_PI, 0, 0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 5 — CAPITAL SHIP: GIFT BROADCAST + HEAVY LATTICE (cx >= 5, +22 parts)
  //  The Gift broadcast array crowns the ship; weapon density increases.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 5) {
    // ── Gift broadcast array (tilted torus atop the lattice) ───────────────
    parts.push(place(
      new THREE.TorusGeometry(coreR * 1.8, coreR * 0.12, 8, 16),
      0, h * 0.6, len * 0.05,
      HALF_PI * 0.15, 0, 0,
    ));

    // Broadcast array support struts (4 radial)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2 + PI * 0.25;
      parts.push(place(
        new THREE.CylinderGeometry(strutR * 1.2, strutR * 1.2, h * 0.5, strutSeg),
        Math.cos(angle) * coreR * 1.2, h * 0.3, Math.sin(angle) * coreR * 1.2 + len * 0.05,
        0.15, 0, angle,
      ));
    }

    // Broadcast relay nodes (4 icosahedra around the torus)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2;
      parts.push(place(
        new THREE.IcosahedronGeometry(coreR * 0.18, 0),
        Math.cos(angle) * coreR * 1.8, h * 0.6, Math.sin(angle) * coreR * 1.8 + len * 0.05,
      ));
    }

    // ── Heavy data-beam emitters (wider-mounted weapon cones) ──────────────
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.18, len * 0.18, 5),
      sign * w * 0.7, 0, len * 0.32,
      HALF_PI, 0, 0,
    )));

    // Dorsal weapon emitters
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.1, len * 0.1, 5),
      sign * w * 0.25, h * 0.5, len * 0.35,
      HALF_PI, 0, 0,
    )));

    // ── Tertiary drive ring (furthest aft) ─────────────────────────────────
    parts.push(place(
      new THREE.TorusGeometry(coreR * 0.5, coreR * 0.08, 6, 8),
      0, 0, -len * 0.5,
      HALF_PI, 0, 0,
    ));

    // Linking strut (secondary ring → tertiary ring)
    parts.push(place(
      new THREE.CylinderGeometry(strutR * 0.8, strutR * 0.8, len * 0.06, strutSeg),
      0, 0, -len * 0.47,
      HALF_PI, 0, 0,
    ));

    // ── Mid-lattice reinforcement nodes ────────────────────────────────────
    // Additional octahedral cores between existing nodes to thicken the mesh
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.35, 0),
      sign * w * 0.35, h * 0.35, len * 0.12,
    )));

    // Diagonal struts (lateral cores → dorsal node)
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, w * 0.6, strutSeg),
      sign * w * 0.35, h * 0.35, -len * 0.05,
      0.6, 0, sign * 0.8,
    )));

    // Ventral weapon bay emitter
    parts.push(place(
      new THREE.ConeGeometry(coreR * 0.14, len * 0.12, 5),
      0, -h * 0.6, len * 0.38,
      HALF_PI, 0, 0,
    ));

    // Ventral weapon strut
    parts.push(place(
      new THREE.CylinderGeometry(strutR * 0.7, strutR * 0.7, h * 0.35, strutSeg),
      0, -h * 0.42, len * 0.3,
      0.2, 0, 0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 6 — HEAVY CAPITAL: OUTER LATTICE RING + THE SILENCE (cx >= 6, +18 parts)
  //  A ring of outer nodes defines the warship silhouette.
  //  The Silence — an offset core that does not speak — appears.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 6) {
    // ── Outer lattice ring (6 nodes around the centreline) ─────────────────
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      const rx = Math.cos(angle) * w * 1.2;
      const ry = Math.sin(angle) * w * 0.8;

      // Outer node
      parts.push(place(
        new THREE.OctahedronGeometry(coreR * 0.4, 0),
        rx, ry, -len * 0.08,
      ));

      // Radial strut (centre → outer node)
      const dist = Math.sqrt(rx * rx + ry * ry);
      parts.push(place(
        new THREE.CylinderGeometry(strutR, strutR, dist * 0.75, strutSeg),
        rx * 0.5, ry * 0.5, -len * 0.04,
        0, 0, Math.atan2(ry, rx) + HALF_PI,
      ));
    }

    // ── The Silence ────────────────────────────────────────────────────────
    // A subtly offset octahedral core — the ancient uploads that do not
    // speak. Slightly rotated, slightly larger than a sub-node, positioned
    // just off-centre enough to feel wrong. It is not damage; it is grief.
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.85, 0),
      len * 0.012, -h * 0.3, -len * 0.08,
      0, PI * 0.12, PI * 0.04,
      1.0, 1.0, 1.1,
    ));

    // Silence isolation struts — thinner than normal, as if reluctant
    parts.push(place(
      new THREE.CylinderGeometry(strutR * 0.4, strutR * 0.4, h * 0.2, strutSeg),
      len * 0.006, -h * 0.15, -len * 0.065,
      0.08, 0, 0,
    ));

    // ── Inter-ring lattice struts (connecting adjacent outer nodes) ────────
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * PI * 2;
      const a2 = ((i + 1) / 6) * PI * 2;
      const x1 = Math.cos(a1) * w * 1.2;
      const y1 = Math.sin(a1) * w * 0.8;
      const x2 = Math.cos(a2) * w * 1.2;
      const y2 = Math.sin(a2) * w * 0.8;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const segLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      parts.push(place(
        new THREE.CylinderGeometry(strutR * 0.5, strutR * 0.5, segLen, strutSeg),
        mx, my, -len * 0.08,
        0, 0, Math.atan2(y2 - y1, x2 - x1) + HALF_PI,
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 7 — DREADNOUGHT: DEEP LATTICE SPARS + WEAPON BATTERIES (cx >= 7, +14 parts)
  //  Massive longitudinal spars; the constellation becomes a framework.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 7) {
    // ── Longitudinal lattice spars (dorsal pair + ventral pair) ────────────
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

    // ── Centreline weapon battery (dorsal, centre, ventral) ────────────────
    for (let y = -1; y <= 1; y++) {
      parts.push(place(
        new THREE.ConeGeometry(coreR * 0.14, len * 0.12, 5),
        0, y * h * 0.35, len * 0.48,
        HALF_PI, 0, 0,
      ));
    }

    // ── Spar junction nodes (where longitudinal spars cross tier 6 ring) ──
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.3, 0),
      sign * w * 0.85, h * 0.2, -len * 0.1,
    )));
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.3, 0),
      sign * w * 0.85, -h * 0.2, -len * 0.1,
    )));

    // ── Fourth drive ring (outermost aft) ──────────────────────────────────
    parts.push(place(
      new THREE.TorusGeometry(coreR * 1.3, coreR * 0.1, 6, 12),
      0, 0, -len * 0.56,
      HALF_PI, 0, 0,
    ));

    // Drive ring linking strut
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, len * 0.06, strutSeg),
      0, 0, -len * 0.53,
      HALF_PI, 0, 0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TIER 8 — STATION-CLASS: FULL LATTICE SPHERE (cx >= 8, +14 parts)
  //  A spherical lattice of nodes — a mobile city-mind.
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 8) {
    // Vertices of a truncated icosahedron (subset — 8 evenly-spaced points)
    const phi = (1 + Math.sqrt(5)) / 2;
    const icoVerts: [number, number, number][] = [
      [ 1,  phi, 0], [-1,  phi, 0], [ 1, -phi, 0], [-1, -phi, 0],
      [ 0,  1,  phi], [ 0, -1,  phi], [ 0,  1, -phi], [ 0, -1, -phi],
    ];
    const icoScale = w * 0.7;

    // Sphere lattice nodes
    for (const [vx, vy, vz] of icoVerts) {
      const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
      parts.push(place(
        new THREE.OctahedronGeometry(coreR * 0.3, 0),
        (vx / mag) * icoScale,
        (vy / mag) * icoScale,
        (vz / mag) * icoScale * 0.8,
      ));
    }

    // Grand outer containment ring
    parts.push(place(
      new THREE.TorusGeometry(w * 1.5, coreR * 0.08, 8, 24),
      0, 0, 0,
      HALF_PI, 0, 0,
    ));

    // Vertical containment ring (perpendicular to main ring)
    parts.push(place(
      new THREE.TorusGeometry(w * 1.3, coreR * 0.06, 8, 20),
      0, 0, 0,
      0, 0, 0,
    ));

    // Forward sensor cluster — 3 icosahedra in a triangle
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * PI * 2 + HALF_PI;
      parts.push(place(
        new THREE.IcosahedronGeometry(coreR * 0.22, 0),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.35,
        len * 0.45,
      ));
    }

    // Grand forward data-beam (station main weapon)
    parts.push(place(
      new THREE.ConeGeometry(coreR * 0.25, len * 0.2, 6),
      0, 0, len * 0.55,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}
