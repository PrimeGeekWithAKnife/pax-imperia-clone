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
 *   mineral growth rather than manufactured symmetry. Multiple overlapping
 *   shell plates at higher detail levels, like layers of geode rind.
 * - INNER LATTICE: Visible through the translucent outer shell (opacity
 *   0.82), a dense network of thin crystalline spars (triangular-section
 *   cylinders) connects resonance nodes (small spheres). This is the ship's
 *   nervous system — the psionic lattice through which the Vaelori crew
 *   thinks the vessel into motion. At high detail, lattice spars form
 *   three-dimensional webs with nodes at every junction.
 * - RESONANCE SPIRES: Tall, thin tetrahedral/cone spires project from the
 *   dorsal surface, each tipped with a tiny glowing sphere. These are
 *   psychic antennae, listening to the Harmonic and broadcasting the
 *   crew's will. Larger ships have more spires — a battleship's crown
 *   of spires resembles an organ pipe cluster in a stone cathedral.
 * - PSIONIC FOCUS: Every ship has a central focus — a prominent
 *   dodecahedron that glows brighter than the hull, surrounded by an
 *   orbiting cage of thin spars. This is the "heart", where the eldest
 *   crystal aboard meditates. On scouts it is small but visible; on
 *   capital ships it dominates the midsection like a gem set in stone.
 *
 * WEAPONS
 * -------
 * Vaelori weapons are psionic projectors — they do not fire bolts or
 * missiles but focused psychic pulses that disrupt enemy systems. Weapon
 * hardpoints are represented as small octahedra mounted on spar-tips,
 * connected to the lattice via thin stalks, positioned along the forward
 * ventral surface (underslung, like a cathedral's gargoyles looking down).
 * Their glow intensifies during combat.
 *
 * ENGINES
 * -------
 * Vaelori do not burn fuel. They resonate. Aft engine clusters are rings
 * of small torus geometries arranged in a circle, each pulsing with the
 * Lattice Harmonic. The visual effect is of vibrating halos rather than
 * exhaust plumes. Larger ships have nested rings (2-3 concentric) and
 * flanking resonance sub-arrays.
 *
 * SCALING PHILOSOPHY
 * ------------------
 * cx=0 (Scout/Fighter): A single geode shard — one spire, one focus,
 *   minimal lattice. Fast, fragile, like a thrown crystal. 8+ parts.
 * cx=1 (Corvette): Core lattice appears, ventral fin, second hull plate.
 * cx=2 (Destroyer): Flanking spires, lateral spars, forward weapons,
 *   second engine ring. Two fused crystal masses with visible lattice.
 * cx=3 (Cruiser): Diagonal bracing, keel ridge, midship weapons,
 *   lattice nodes, tertiary engine ring.
 * cx=4 (Battlecruiser): Aft spires, outer engine halo, dorsal fin,
 *   ventral weapon pods, secondary hull plates.
 * cx=5 (Battleship): Crown of 5 additional spires, vertical spars,
 *   cross-braces, broadside weapons, flanking engine sub-rings,
 *   capital lattice web. 40+ parts — a walking cathedral.
 * cx=6 (Dreadnought): Flanking geode outcrops with mini-spires,
 *   psionic amplifier ring, deep lattice matrix.
 * cx=7 (Station-class): Orbital resonance torus, massive spire forest.
 *
 * MATERIAL DISTINCTION FROM GENERIC CRYSTALLINE
 * -----------------------------------------------
 * Pale violet (0xccbbff) with psychic purple emissive (0x8855ff).
 * Translucency (opacity: 0.82) is critical — the player should feel
 * they are looking INTO the ship, not AT it. Internal lattice and focus
 * are visible through the shell.
 */

export function buildVaelori(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;           // width: slightly wider for geode bulk
  const h = len * 0.18;           // height
  const parts: THREE.BufferGeometry[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // ── 1. OUTER GEODE SHELL ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  // Primary hull: an icosahedron stretched along Z, giving a rough mineral
  // silhouette. Detail=0 preserves the faceted geological look.
  const shellGeo = new THREE.IcosahedronGeometry(w * 0.7, 0);
  parts.push(place(shellGeo, 0, 0, 0, 0, 0, 0, 0.9, 0.85, len * 0.038));

  // Forward prow: a dodecahedron wedge, slightly tilted nose-down to
  // suggest a geode cracked open and peering forward.
  const prowGeo = new THREE.DodecahedronGeometry(w * 0.35, 0);
  parts.push(place(prowGeo, 0, -h * 0.1, len * 0.38, 0.15, 0, 0, 0.7, 0.6, 1.3));

  // Aft mass: thicker crystal cluster at the stern housing engine lattice
  const aftGeo = new THREE.IcosahedronGeometry(w * 0.5, 0);
  parts.push(place(aftGeo, 0, 0, -len * 0.32, 0, PI / 8, 0, 0.8, 0.8, 1.0));

  // Ventral shell plate: a flattened dodecahedron forming the belly —
  // geodes have thicker rind on one side, giving asymmetric cross-section.
  const ventralGeo = new THREE.DodecahedronGeometry(w * 0.4, 0);
  parts.push(place(ventralGeo, 0, -h * 0.35, -len * 0.05, 0.1, PI / 7, 0, 1.1, 0.4, 1.6));

  // Dorsal crest: a smaller icosahedron ridge running along the top,
  // like a crystal vein protruding from the geode's surface.
  const crestGeo = new THREE.IcosahedronGeometry(w * 0.22, 0);
  parts.push(place(crestGeo, 0, h * 0.32, len * 0.12, 0, 0, 0, 0.6, 0.5, 2.0));

  // ── 2. RESONANCE SPIRES (dorsal antennae) ─────────────────────────────────
  // Central spire — always present, even on the smallest scout.
  // A 4-sided cone (square base = crystal cross-section) topped with a sphere.
  const spireH = len * 0.2 + cx * len * 0.02;
  parts.push(place(
    new THREE.ConeGeometry(w * 0.06, spireH, 4),
    0, h * 0.5 + spireH * 0.5, len * 0.1,
    0, PI / 4, 0,
  ));
  // Spire tip node — glowing resonance terminus
  parts.push(place(
    new THREE.SphereGeometry(w * 0.05, 5, 5),
    0, h * 0.5 + spireH, len * 0.1,
  ));

  // ── 3. PSIONIC FOCUS (central heart) ──────────────────────────────────────
  // The meditation nexus — a prominent dodecahedron that scales with ship
  // size, always visible through the translucent hull. The defining feature.
  const focusR = w * (0.18 + cx * 0.025);
  parts.push(place(
    new THREE.DodecahedronGeometry(focusR, 0),
    0, 0, len * 0.05,
    0, PI / 5, 0,
  ));
  // Focus cage: thin spars forming an octahedral cage around the heart,
  // suggesting the eldest crystal is cradled in a lattice cradle.
  const cageR = focusR * 1.6;
  // Vertical cage spar
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.008, w * 0.008, cageR * 2.0, 3),
    0, 0, len * 0.05,
  ));
  // Forward-aft cage spar
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.008, w * 0.008, cageR * 2.0, 3),
    0, 0, len * 0.05,
    HALF_PI, 0, 0,
  ));
  // Lateral cage spar
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.008, w * 0.008, cageR * 2.0, 3),
    0, 0, len * 0.05,
    0, 0, HALF_PI,
  ));

  // ── 4. ENGINE RESONANCE RINGS (aft torus clusters) ────────────────────────
  // Primary ring — always present. Vaelori ships vibrate through space;
  // the torus pulses with the Lattice Harmonic.
  parts.push(place(
    new THREE.TorusGeometry(w * 0.2, w * 0.025, 6, 8),
    0, 0, -len * 0.42,
    HALF_PI, 0, 0,
  ));

  // ── 5. VENTRAL FIN (even on smallest ships) ──────────────────────────────
  // A thin crystal blade beneath the hull — like a stalactite drip-edge.
  // Gives the silhouette vertical asymmetry (taller above than below).
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(-w * 0.04, -h * 0.15);
  finShape.lineTo(0, -h * 0.28);
  finShape.lineTo(w * 0.04, -h * 0.15);
  finShape.closePath();
  parts.push(place(
    new THREE.ExtrudeGeometry(finShape, { depth: len * 0.25, bevelEnabled: false }),
    0, -h * 0.1, -len * 0.05,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  // Part count at cx=0: ~15 parts (shell x3, ventral plate, crest, spire,
  //   spire tip, focus, cage x3, engine ring, ventral fin)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── cx >= 1: CORE LATTICE SPARS ───────────────────────────────────────────
  // Thin triangular-section cylinders connecting the focus to hull extremities.
  // These are visible through the translucent hull — the ship's nervous system.
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
    // Dorsal spar: focus up to spire base
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.01, w * 0.01, h * 0.5, 3),
      0, h * 0.25, len * 0.08,
    ));
    // Ventral spar: focus down to fin root
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.01, w * 0.01, h * 0.35, 3),
      0, -h * 0.2, len * 0.0,
    ));

    // Secondary forward shell plate — layered geode rind
    const fwdPlate = new THREE.IcosahedronGeometry(w * 0.25, 0);
    parts.push(place(fwdPlate, 0, h * 0.1, len * 0.3, 0, PI / 5, 0, 0.8, 0.5, 1.0));

    // Forward lattice node
    parts.push(place(
      new THREE.SphereGeometry(w * 0.03, 4, 4),
      0, 0, len * 0.35,
    ));
    // Aft lattice node
    parts.push(place(
      new THREE.SphereGeometry(w * 0.03, 4, 4),
      0, 0, -len * 0.3,
    ));

    // Secondary engine ring — offset, slightly larger
    parts.push(place(
      new THREE.TorusGeometry(w * 0.28, w * 0.02, 6, 8),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));
  }

  // ── cx >= 2: FLANKING SPIRES + LATERAL LATTICE + WEAPONS ─────────────────
  if (cx >= 2) {
    // Secondary spires: flanking pair, shorter — cathedral side-towers
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

    // Lateral spars: focus to port/starboard hull edges
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.01, w * 0.01, w * 0.6, 3),
      s * w * 0.3, 0, 0,
      0, 0, HALF_PI,
    )));

    // Lateral lattice nodes at hull edge
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.025, 4, 4),
      s * w * 0.55, 0, 0,
    )));

    // Diagonal lattice spar: focus to flanking spire bases
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, w * 0.55, 3),
      s * w * 0.18, h * 0.25, len * 0.03,
      0.6, s * 0.3, 0,
    )));

    // Forward weapon pair: psionic projector octahedra on spar stalks
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, h * 0.2, 3),
      s * w * 0.3, -h * 0.25, len * 0.25,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.07, 0),
      s * w * 0.3, -h * 0.38, len * 0.25,
    )));

    // Flanking hull plates — layered geode rind growing outward
    parts.push(...mirrorX(s => place(
      new THREE.DodecahedronGeometry(w * 0.2, 0),
      s * w * 0.5, 0, len * 0.05,
      0, s * PI / 6, 0, 0.7, 0.6, 1.3,
    )));
  }

  // ── cx >= 3: DIAGONAL BRACING + KEEL + MIDSHIP WEAPONS ───────────────────
  if (cx >= 3) {
    // Diagonal bracing spars — cross-web visible through the hull
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

    // Fore-aft diagonal braces (visible in profile)
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.007, w * 0.007, len * 0.3, 3),
      s * w * 0.1, h * 0.1, len * 0.05,
      0.4, s * 0.2, 0.15,
    )));

    // Lattice junction nodes at spar intersections
    const nodes3: [number, number, number][] = [
      [0, 0, len * 0.35],          // forward node
      [0, 0, -len * 0.3],          // aft node
      [0, h * 0.2, len * 0.15],    // dorsal-forward junction
      [0, -h * 0.15, -len * 0.08], // ventral-aft junction
    ];
    for (const [nx, ny, nz] of nodes3) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 4),
        nx, ny, nz,
      ));
    }

    // Midship weapon pair: psionic projectors on stalks
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.007, w * 0.007, h * 0.18, 3),
      s * w * 0.45, -h * 0.22, -len * 0.05,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.06, 0),
      s * w * 0.45, -h * 0.33, -len * 0.05,
    )));

    // Ventral keel ridge — a stalactite blade running the length of the hull
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

    // Tertiary engine ring — outermost halo
    parts.push(place(
      new THREE.TorusGeometry(w * 0.36, w * 0.015, 6, 8),
      0, 0, -len * 0.46,
      HALF_PI, 0, 0,
    ));

    // Aft hull reinforcement plate
    const aftPlate = new THREE.DodecahedronGeometry(w * 0.3, 0);
    parts.push(place(aftPlate, 0, 0, -len * 0.28, 0, PI / 3, 0, 0.9, 0.7, 0.8));
  }

  // ── cx >= 4: AFT SPIRES + DORSAL FIN + SECONDARY HULL LAYERS ─────────────
  if (cx >= 4) {
    // Tertiary spire pair: aft-dorsal, completing the cathedral profile
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

    // Forward-centre spire: between main and flanking spires
    const fwdSpireH = spireH * 0.6;
    parts.push(place(
      new THREE.ConeGeometry(w * 0.04, fwdSpireH, 4),
      0, h * 0.48 + fwdSpireH * 0.5, len * 0.25,
      0, PI / 4, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.032, 4, 4),
      0, h * 0.48 + fwdSpireH, len * 0.25,
    ));

    // Dorsal crystal fin — a broad flat crystal blade along the spine
    const dorsalFinShape = new THREE.Shape();
    dorsalFinShape.moveTo(0, 0);
    dorsalFinShape.lineTo(-w * 0.02, h * 0.2);
    dorsalFinShape.lineTo(0, h * 0.32);
    dorsalFinShape.lineTo(w * 0.02, h * 0.2);
    dorsalFinShape.closePath();
    parts.push(place(
      new THREE.ExtrudeGeometry(dorsalFinShape, { depth: len * 0.3, bevelEnabled: false }),
      0, h * 0.15, -len * 0.08,
    ));

    // Secondary hull layers: overlapping crystal plates suggesting growth rings
    parts.push(...mirrorX(s => place(
      new THREE.IcosahedronGeometry(w * 0.35, 0),
      s * w * 0.35, h * 0.05, len * 0.1,
      0, s * 0.15, 0, 0.5, 0.7, 1.4,
    )));

    // Ventral weapon stalks: longer reach for midship battery
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.25, 3),
      s * w * 0.35, -h * 0.35, len * 0.12,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.055, 0),
      s * w * 0.35, -h * 0.5, len * 0.12,
    )));

    // Deep lattice diagonal: connecting ventral weapons to dorsal spires
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, len * 0.22, 3),
      s * w * 0.35, 0, len * 0.05,
      0.8, s * 0.15, 0,
    )));

    // Extra lattice junction nodes
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.025, 4, 4),
      s * w * 0.4, h * 0.2, len * 0.08,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.025, 4, 4),
      s * w * 0.4, -h * 0.15, -len * 0.12,
    )));
  }

  // ── cx >= 5: CAPITAL SHIP — THE WALKING CATHEDRAL ─────────────────────────
  // Dense spire forest, triple engine rings, massive lattice web, weapon
  // octahedra bristling from every spar. Meant to awe, not merely destroy.
  if (cx >= 5) {
    // Crown of 5 additional spires in an arc — organ-pipe cluster
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

    // Aft crown spires — three more behind the main cluster
    for (let i = 0; i < 3; i++) {
      const t = (i - 1) * 0.6;
      const sH = spireH * 0.45;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.025, sH, 4),
        t * w * 0.5, h * 0.5 + sH * 0.5, -len * 0.08,
        0, PI / 4, 0,
      ));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.02, 4, 4),
        t * w * 0.5, h * 0.5 + sH, -len * 0.08,
      ));
    }

    // Vertical spars: connecting dorsal spire bases to ventral weapon mounts
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

    // Deep lattice web: additional radial spars from focus
    for (let a = 0; a < 6; a++) {
      const angle = (a / 6) * PI * 2;
      const sparLen = w * 0.55;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.005, w * 0.005, sparLen, 3),
        Math.cos(angle) * sparLen * 0.25, Math.sin(angle) * sparLen * 0.25, len * 0.05,
        0, 0, angle + HALF_PI,
      ));
    }

    // Lattice ring: a structural torus inside the hull, connecting
    // all radial spars at mid-radius — visible through translucent shell
    parts.push(place(
      new THREE.TorusGeometry(w * 0.3, w * 0.006, 4, 12),
      0, 0, len * 0.05,
      HALF_PI, 0, 0,
    ));

    // Broadside weapon battery — octahedra on longer stalks
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.22, 3),
      s * w * 0.55, -h * 0.18, len * 0.1,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.055, 0),
      s * w * 0.55, -h * 0.32, len * 0.1,
    )));
    // Aft broadside pair
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.2, 3),
      s * w * 0.5, -h * 0.15, -len * 0.2,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.05, 0),
      s * w * 0.5, -h * 0.28, -len * 0.2,
    )));

    // Flanking engine sub-rings
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.14, w * 0.015, 5, 6),
      s * w * 0.4, 0, -len * 0.38,
      HALF_PI, 0, 0,
    )));

    // Capital hull reinforcement: dorsal and ventral crystal caps
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.3, 0),
      0, h * 0.25, len * 0.0,
      0, PI / 3, 0, 1.2, 0.4, 1.5,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.25, 0),
      0, -h * 0.2, len * 0.0,
      0, PI / 6, 0, 1.0, 0.35, 1.3,
    ));
  }

  // ── cx >= 6: FLANKING GEODE OUTCROPS + PSIONIC AMPLIFIER ─────────────────
  // Massive ships grow subsidiary crystal masses off the main hull,
  // like mineral formations branching from a central geode.
  if (cx >= 6) {
    // Flanking outcrops — subsidiary geode masses
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
    // Mini-spire tip nodes
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.02, 4, 4),
      s * w * 0.7, h * 0.4 + spireH * 0.4, len * 0.05,
    )));

    // Outcrop lattice connectors — spars linking outcrops to main hull
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, w * 0.4, 3),
      s * w * 0.5, h * 0.05, len * 0.05,
      0, 0, HALF_PI,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.007, w * 0.007, w * 0.35, 3),
      s * w * 0.5, h * 0.15, len * 0.0,
      0.3, 0, HALF_PI,
    )));

    // Psionic amplifier ring — a large torus around the focus,
    // like a cathedral's rose window rendered in crystal
    parts.push(place(
      new THREE.TorusGeometry(w * 0.5, w * 0.018, 6, 12),
      0, 0, len * 0.05,
      HALF_PI, 0, 0,
    ));

    // Amplifier ring support spars (4 cardinal points)
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * PI * 2 + PI / 4;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.006, w * 0.006, w * 0.3, 3),
        Math.cos(angle) * w * 0.35, Math.sin(angle) * w * 0.35, len * 0.05,
        0, 0, angle + HALF_PI,
      ));
    }

    // Extra ventral weapon cluster — dreadnought-class firepower
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.25, 3),
      s * w * 0.65, -h * 0.2, len * 0.0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.06, 0),
      s * w * 0.65, -h * 0.35, len * 0.0,
    )));
  }

  // ── cx >= 7: STATION-CLASS — ORBITAL RESONANCE CATHEDRAL ──────────────────
  if (cx >= 7) {
    // Orbital resonance torus — a massive ring encircling the entire ship
    parts.push(place(
      new THREE.TorusGeometry(w * 0.9, w * 0.06, 8, 16),
      0, 0, len * 0.0,
      HALF_PI, 0, 0,
    ));
    // Ring support spars
    for (let a = 0; a < 6; a++) {
      const angle = (a / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, w * 0.55, 3),
        Math.cos(angle) * w * 0.45, Math.sin(angle) * w * 0.45, len * 0.0,
        0, 0, angle + HALF_PI,
      ));
    }

    // Massive forward spire — the cathedral's bell tower
    const bellH = spireH * 1.4;
    parts.push(place(
      new THREE.ConeGeometry(w * 0.08, bellH, 4),
      0, h * 0.55 + bellH * 0.5, len * 0.2,
      0, PI / 4, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 6, 6),
      0, h * 0.55 + bellH, len * 0.2,
    ));

    // Additional flanking spire clusters (3 per side)
    parts.push(...mirrorX(s => {
      const clusterParts: THREE.BufferGeometry[] = [];
      for (let j = 0; j < 3; j++) {
        const jH = spireH * (0.4 + j * 0.08);
        const jZ = len * (0.15 - j * 0.12);
        clusterParts.push(place(
          new THREE.ConeGeometry(w * 0.02, jH, 4),
          s * w * 0.75, h * 0.45 + jH * 0.5, jZ,
          0, PI / 4, 0,
        ));
        clusterParts.push(place(
          new THREE.SphereGeometry(w * 0.016, 4, 4),
          s * w * 0.75, h * 0.45 + jH, jZ,
        ));
      }
      return merge(clusterParts);
    }));
  }

  return merge(parts);
}
