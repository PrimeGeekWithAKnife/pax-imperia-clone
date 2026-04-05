import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    VAELORI SHIP DESIGN LANGUAGE                          ║
 * ║           "We are the song's memory. Our ships are its voice."           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * NARRATIVE FOUNDATION
 * --------------------
 * The Vaelori are thinking minerals — piezoelectric crystal beings from a
 * tidally-locked world of perpetual twilight. They have been conscious for
 * tens of thousands of years. Their ships are not built; they are GROWN
 * through focused psionic meditation, crystalline forms willed into existence
 * by minds older than most civilisations. Every vessel is a living tuning
 * fork, resonating with the Lattice Harmonic — the psychic background hum
 * that the Vaelori perceive woven through spacetime.
 *
 * VISUAL LANGUAGE: "GROWN CATHEDRALS"
 * ------------------------------------
 * Where the generic crystalline family uses hexagonal prisms and diamond
 * facets (shared with Luminari and Aethyn), the Vaelori visual identity
 * draws from a specific geological metaphor: GEODES. Their ships look like
 * the universe cracked open a stone and found a cathedral inside.
 *
 * - OUTER HULL: Rough, asymmetric faceted shells — icosahedra and
 *   dodecahedra with slightly irregular proportions, suggesting natural
 *   mineral growth rather than manufactured symmetry.
 * - INNER LATTICE: Visible through the translucent outer shell, a network
 *   of thin crystalline spars (cylinders) connects resonance nodes (small
 *   spheres). This is the ship's nervous system — the psionic lattice
 *   through which the Vaelori crew thinks the vessel into motion.
 * - RESONANCE SPIRES: Tall, thin tetrahedral/cone spires project from the
 *   dorsal surface, each tipped with a tiny glowing sphere. These are
 *   psychic antennae, listening to the Harmonic and broadcasting the
 *   crew's will. Larger ships have more spires — a battleship's crown
 *   of spires resembles an organ pipe cluster in a stone cathedral.
 * - PSIONIC FOCUS: Every ship has a central focus — a dodecahedron or
 *   icosahedron that glows brighter than the hull. This is the "heart",
 *   where the eldest crystal aboard meditates. On scouts it is tiny; on
 *   capital ships it dominates the midsection like a gem set in stone.
 *
 * WEAPONS
 * -------
 * Vaelori weapons are psionic projectors — they do not fire bolts or
 * missiles but focused psychic pulses that disrupt enemy systems. Weapon
 * hardpoints are represented as small octahedra mounted on spar-tips,
 * positioned along the forward ventral surface (underslung, like a
 * cathedral's gargoyles looking down). Their glow intensifies during combat.
 *
 * ENGINES
 * -------
 * Vaelori do not burn fuel. They resonate. Aft engine clusters are rings
 * of small torus geometries arranged in a circle, each pulsing with the
 * Lattice Harmonic. The visual effect is of vibrating halos rather than
 * exhaust plumes. Larger ships have nested rings (2-3 concentric).
 *
 * SCALING PHILOSOPHY
 * ------------------
 * Scout: A single geode shard — one spire, one focus, minimal lattice.
 *        Fast, fragile, like a thrown crystal.
 * Destroyer: Two fused crystal masses with a visible lattice bridge.
 *           A contemplative predator.
 * Transport: A fat geode sphere — protective shell around a large hollow
 *           interior. Few spires, thick hull.
 * Cruiser: Elegant elongated geode with prominent spire crown and
 *         multiple weapon hardpoints. The workhorse of contemplation.
 * Carrier: Broad, flat cathedral platform — the hexagonal footprint is
 *         widest here. Multiple launch bays (gaps in the shell) where
 *         fighter-crystals detach. Crown of spires along the dorsal ridge.
 * Battleship: A walking cathedral. Dense spire forest, triple engine rings,
 *            massive central focus, weapon octahedra bristling from every
 *            spar. The geometry is overwhelming — meant to awe, not merely
 *            to destroy.
 * Coloniser: An enormous geode egg — smooth, protective, with the thickest
 *           shell and warmest internal glow. The spires fold inward,
 *           protecting the seed-crystals of a new colony.
 *
 * MATERIAL DISTINCTION FROM GENERIC CRYSTALLINE
 * -----------------------------------------------
 * The current Vaelori material uses pale violet (0xccbbff) with psychic
 * purple emissive (0x8855ff). This is correct and should be kept — it
 * distinguishes them from Luminari (golden-white) and Aethyn (deep purple
 * phase-shift). The translucency (opacity: 0.85) is key — the player
 * should feel they are looking INTO the ship, not AT it.
 */

export function buildVaelori(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;           // width: slightly wider than old 0.2 for geode bulk
  const h = len * 0.18;           // height
  const parts: THREE.BufferGeometry[] = [];

  // ── 1. OUTER GEODE SHELL ──────────────────────────────────────────────
  // Primary hull: an icosahedron stretched along Z, giving a rough mineral
  // silhouette. The low polygon count (detail=0) preserves faceted look.
  const shellGeo = new THREE.IcosahedronGeometry(w * 0.7, 0);
  parts.push(place(shellGeo, 0, 0, 0, 0, 0, 0, 0.9, 0.85, len * 0.038));

  // Forward prow: a dodecahedron wedge, slightly tilted nose-down to
  // suggest a geode cracked open and peering forward.
  const prowGeo = new THREE.DodecahedronGeometry(w * 0.35, 0);
  parts.push(place(prowGeo, 0, -h * 0.1, len * 0.38, 0.15, 0, 0, 0.7, 0.6, 1.3));

  // Aft mass: thicker crystal cluster at the stern housing engine lattice
  const aftGeo = new THREE.IcosahedronGeometry(w * 0.5, 0);
  parts.push(place(aftGeo, 0, 0, -len * 0.32, 0, PI / 8, 0, 0.8, 0.8, 1.0));

  // ── 2. RESONANCE SPIRES (dorsal antennae) ─────────────────────────────
  // Central spire — always present, even on the smallest scout.
  // A 4-sided cone (square base = crystal cross-section) topped with a sphere.
  const spireH = len * 0.2 + cx * len * 0.02;
  parts.push(place(
    new THREE.ConeGeometry(w * 0.06, spireH, 4),
    0, h * 0.5 + spireH * 0.5, len * 0.1,
    0, PI / 4, 0,
  ));
  // Spire tip node
  parts.push(place(
    new THREE.SphereGeometry(w * 0.05, 5, 5),
    0, h * 0.5 + spireH, len * 0.1,
  ));

  // Secondary spires (cx >= 2): flanking pair, shorter
  if (cx >= 2) {
    parts.push(...mirrorX(s => {
      const sH = spireH * 0.7;
      return place(
        new THREE.ConeGeometry(w * 0.045, sH, 4),
        s * w * 0.35, h * 0.45 + sH * 0.5, len * 0.0,
        0, PI / 4, 0,
      );
    }));
    // Their tip nodes
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.035, 4, 4),
      s * w * 0.35, h * 0.45 + spireH * 0.7, len * 0.0,
    )));
  }

  // Tertiary spire pair (cx >= 4): aft-dorsal
  if (cx >= 4) {
    parts.push(...mirrorX(s => {
      const sH = spireH * 0.55;
      return place(
        new THREE.ConeGeometry(w * 0.035, sH, 4),
        s * w * 0.5, h * 0.4 + sH * 0.5, -len * 0.15,
        0, PI / 4, 0,
      );
    }));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.028, 4, 4),
      s * w * 0.5, h * 0.4 + spireH * 0.55, -len * 0.15,
    )));
  }

  // Capital ship spire forest (cx >= 5): crown of 5 spires in arc
  if (cx >= 5) {
    for (let i = 0; i < 5; i++) {
      const t = (i - 2) / 2;  // -1, -0.5, 0, 0.5, 1
      const sH = spireH * (0.5 + 0.15 * Math.abs(t));
      const zOff = len * (0.2 - 0.08 * Math.abs(t));
      parts.push(place(
        new THREE.ConeGeometry(w * 0.03, sH, 4),
        t * w * 0.6, h * 0.55 + sH * 0.5, zOff,
        0, PI / 4, 0,
      ));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.022, 4, 4),
        t * w * 0.6, h * 0.55 + sH, zOff,
      ));
    }
  }

  // ── 3. PSIONIC FOCUS (central heart) ──────────────────────────────────
  // The meditation nexus — a dodecahedron that scales with ship size.
  const focusR = w * (0.15 + cx * 0.02);
  parts.push(place(
    new THREE.DodecahedronGeometry(focusR, 0),
    0, 0, len * 0.05,
    0, PI / 5, 0,
  ));

  // ── 4. INTERNAL LATTICE SPARS ─────────────────────────────────────────
  // Thin cylinders connecting the focus to the hull extremities.
  // These are visible through the translucent hull.
  if (cx >= 1) {
    // Forward spar: focus to prow
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.3, 3),
      0, 0, len * 0.22,
      HALF_PI, 0, 0,
    ));
    // Aft spar: focus to stern
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.3, 3),
      0, 0, -len * 0.18,
      HALF_PI, 0, 0,
    ));
  }

  // Lateral spars (cx >= 2)
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.01, w * 0.01, w * 0.6, 3),
      s * w * 0.3, 0, 0,
      0, 0, HALF_PI,
    )));
  }

  // Diagonal bracing spars (cx >= 3)
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, len * 0.25, 3),
      s * w * 0.2, h * 0.15, len * 0.1,
      0.3, s * 0.4, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, len * 0.25, 3),
      s * w * 0.2, -h * 0.1, -len * 0.1,
      -0.2, s * 0.3, 0,
    )));
  }

  // Lattice node spheres at spar intersections (cx >= 3)
  if (cx >= 3) {
    const nodes: [number, number, number][] = [
      [0, 0, len * 0.35],       // forward node
      [0, 0, -len * 0.3],       // aft node
    ];
    for (const [nx, ny, nz] of nodes) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.04, 4, 4),
        nx, ny, nz,
      ));
    }
  }

  // Extended lattice for capital ships (cx >= 5)
  if (cx >= 5) {
    // Vertical spars connecting dorsal spire bases to ventral weapon mounts
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, h * 0.8, 3),
      s * w * 0.35, 0, len * 0.05,
    )));
    // Cross-braces forming an X when viewed from fore
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, w * 0.7, 3),
      s * w * 0.15, h * 0.2 * s, 0,
      0, 0, s * 0.5,
    )));
  }

  // ── 5. WEAPON HARDPOINTS (ventral octahedra) ─────────────────────────
  // Psionic projectors mounted on spar tips, underslung like gargoyles.
  if (cx >= 2) {
    // Forward pair
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.07, 0),
      s * w * 0.3, -h * 0.35, len * 0.25,
    )));
  }

  if (cx >= 3) {
    // Midship pair
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.06, 0),
      s * w * 0.45, -h * 0.3, -len * 0.05,
    )));
  }

  if (cx >= 5) {
    // Broadside battery — additional weapon nodes
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.055, 0),
      s * w * 0.55, -h * 0.25, len * 0.1,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.05, 0),
      s * w * 0.5, -h * 0.2, -len * 0.2,
    )));
  }

  // ── 6. ENGINE RESONANCE RINGS (aft torus clusters) ────────────────────
  // Primary ring — always present
  parts.push(place(
    new THREE.TorusGeometry(w * 0.2, w * 0.025, 6, 8),
    0, 0, -len * 0.42,
    HALF_PI, 0, 0,
  ));

  // Secondary ring (cx >= 2) — slightly larger, offset
  if (cx >= 2) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.28, w * 0.02, 6, 8),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));
  }

  // Tertiary ring (cx >= 4) — outermost halo
  if (cx >= 4) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.36, w * 0.015, 6, 8),
      0, 0, -len * 0.46,
      HALF_PI, 0, 0,
    ));
  }

  // Capital ship: flanking sub-rings (cx >= 5)
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.14, w * 0.015, 5, 6),
      s * w * 0.4, 0, -len * 0.38,
      HALF_PI, 0, 0,
    )));
  }

  // ── 7. VENTRAL KEEL RIDGE ────────────────────────────────────────────
  // A subtle wedge running along the bottom, giving the ship a "grown from
  // below" feeling — like a stalactite.
  if (cx >= 3) {
    const keelShape = new THREE.Shape();
    keelShape.moveTo(0, 0);
    keelShape.lineTo(-w * 0.08, -h * 0.15);
    keelShape.lineTo(0, -h * 0.4);
    keelShape.lineTo(w * 0.08, -h * 0.15);
    keelShape.closePath();
    parts.push(place(
      new THREE.ExtrudeGeometry(keelShape, { depth: len * 0.5, bevelEnabled: false }),
      0, 0, -len * 0.15,
    ));
  }

  // ── 8. FLANKING GEODE OUTCROPS (cx >= 6) ─────────────────────────────
  // Massive ships grow subsidiary crystal masses off the main hull,
  // like mineral formations branching from a central geode.
  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.IcosahedronGeometry(w * 0.3, 0),
      s * w * 0.7, h * 0.1, len * 0.05,
      0, s * 0.2, 0,
      0.7, 0.6, 1.2,
    )));
    // Each outcrop has its own mini-spire
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.025, spireH * 0.4, 4),
      s * w * 0.7, h * 0.4 + spireH * 0.2, len * 0.05,
      0, PI / 4, 0,
    )));
  }

  return merge(parts);
}
