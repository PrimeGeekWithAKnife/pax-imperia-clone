import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../ShipModels3D';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  SYLVANI SHIP DESIGNS — "Botanical Seed Architecture"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DESIGN THEORY — The Sylvani Do Not Build Ships. They Grow Them.
 *
 * The Sylvani are a distributed botanical intelligence — a mycelial-neural
 * network spanning continents. Their ships are not machinery but cultivated
 * organisms: living vessels of engineered heartwood and photosynthetic
 * hull-membrane, grown over decades in orbital nurseries. Each vessel is a
 * self-sustaining ecosystem, a fragment of the greater network given form
 * and purpose.
 *
 * VISUAL LANGUAGE:
 * Every Sylvani ship reads as a living thing, not a machine wearing an organic
 * skin. The primary silhouette is the SEED — tapered at the bow where a
 * sensory crown of bioluminescent fronds reaches forward, swelling through
 * a thick heartwood trunk, and terminating in a root-cluster engine array
 * that trails mycelial filaments. No straight lines exist. No right angles.
 * Every surface curves, tapers, branches, or spirals.
 *
 * DISTINCTIVENESS:
 * Where other organic species (Drakmari = ocean creature, Vethara = parasite
 * hybrid) could be confused with Sylvani, the key differentiators are:
 * 1. BILATERAL BRANCHING — Sylvani ships branch like trees, not like animals
 * 2. SEED SILHOUETTE — always tapered bow, swollen middle, root-cluster aft
 * 3. MEMBRANE SAILS — thin, leaf-like extensions no other species uses
 * 4. DORSAL RIDGE — a hardened bark spine running bow to stern
 * 5. FROND CROWN — sensory tendrils at the bow that fan outward, not inward
 * No bio-eyes (that is generic organic). No tentacles (that is Drakmari).
 * No chitin (that is Zorvathi). Pure arboreal botany.
 */

export function buildSylvani(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.38;
  const h = len * 0.20;
  const parts: THREE.BufferGeometry[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. SEED TRUNK — LatheGeometry heartwood hull (all ships)
  // ═══════════════════════════════════════════════════════════════════════════
  // The archetypal seed silhouette: sharp bow tip, rapid swell through a
  // bulging midsection offset slightly aft of centre, long taper to stern.
  // Higher cx adds more lathe segments for smoother organic curvature.
  const trunkPts: THREE.Vector2[] = [];
  const trunkSegs = 18 + cx * 2;
  for (let i = 0; i <= trunkSegs; i++) {
    const t = i / trunkSegs; // 0 = bow, 1 = stern
    // Asymmetric seed profile: peak swell at t~0.35, gentle rear taper
    const swell = Math.sin(t * PI) * (1 - 0.22 * t * t) * (1 + 0.15 * Math.sin(t * PI * 0.7));
    const r = w * swell * 0.92;
    const z = (0.5 - t) * len * 0.88;
    trunkPts.push(new THREE.Vector2(r, z));
  }
  parts.push(place(
    new THREE.LatheGeometry(trunkPts, 12),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. DORSAL BARK RIDGE — hardened spine, bow to stern (all ships)
  // ═══════════════════════════════════════════════════════════════════════════
  // A raised keel of thickened bark running along the dorsal surface. Even
  // the smallest scout carries this protective crest — it is the ship's spine.
  // Built from a lathe profile rather than a box for organic cross-section.
  const ridgePts: THREE.Vector2[] = [
    new THREE.Vector2(0, -len * 0.35),
    new THREE.Vector2(w * 0.025, -len * 0.30),
    new THREE.Vector2(w * 0.045, -len * 0.10),
    new THREE.Vector2(w * 0.055, len * 0.05),
    new THREE.Vector2(w * 0.04, len * 0.20),
    new THREE.Vector2(w * 0.02, len * 0.30),
    new THREE.Vector2(0, len * 0.35),
  ];
  parts.push(place(
    new THREE.LatheGeometry(ridgePts, 4),
    0, h * 0.52, len * 0.02,
    HALF_PI, 0, 0,
    1.0, 1.8, 1.0, // tall and narrow — a blade-like ridge
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. SENSORY FROND CROWN — bioluminescent tendrils at bow (all ships)
  // ═══════════════════════════════════════════════════════════════════════════
  // Tapered cone-fronds fanning forward from the nose. These are the ship's
  // root-tip chemoreceptors, sensing the void. Count scales with complexity.
  const frondCount = 4 + Math.floor(cx * 0.6);
  for (let i = 0; i < frondCount; i++) {
    const angle = ((i / frondCount) - 0.5) * PI * 0.75;
    const frondLen = len * (0.09 + 0.025 * cx);
    const frondR = w * (0.025 + 0.005 * Math.min(cx, 4));
    parts.push(place(
      new THREE.ConeGeometry(frondR, frondLen, 5),
      Math.sin(angle) * w * 0.16,
      Math.cos(angle) * w * 0.16,
      len * 0.48,
      -0.25 + 0.3 * Math.cos(angle), 0, 0.3 * Math.sin(angle),
    ));
  }

  // Crown bulb — a small sphere at the very tip where fronds converge
  parts.push(place(
    new THREE.SphereGeometry(w * 0.08, 6, 5),
    0, 0, len * 0.46,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  4. ROOT-CLUSTER ENGINES — primary aft tendrils (all ships)
  // ═══════════════════════════════════════════════════════════════════════════
  // Thick tapered root tendrils splaying outward from the stern. Even the
  // smallest scout trails at least 3 roots — these are propulsion organs,
  // channelling bio-energetic thrust through mycelial conduits.
  const rootCount = 3 + cx;
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * PI * 2;
    const rootLen = len * (0.20 + 0.035 * cx);
    const splay = w * (0.22 + 0.06 * cx);
    // Tapered cylinder: thin tip, thick base where it joins the hull
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.018, w * 0.065, rootLen, 5),
      Math.cos(angle) * splay * 0.5,
      Math.sin(angle) * splay * 0.5,
      -len * 0.48,
      HALF_PI + 0.28 * Math.cos(angle), 0, 0.28 * Math.sin(angle),
    ));
  }

  // Root collar — a thickened ring where root cluster meets the hull
  parts.push(place(
    new THREE.TorusGeometry(w * 0.28, w * 0.04, 6, 10),
    0, 0, -len * 0.38,
    HALF_PI, 0, 0,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  5. VENTRAL SEED KEEL — underside ridge (all ships)
  // ═══════════════════════════════════════════════════════════════════════════
  // A subtle ventral ridge that gives the seed hull a slight bilateral axis,
  // preventing it from reading as a perfect sphere of revolution.
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.03, w * 0.05, len * 0.55, 5),
    0, -h * 0.42, len * 0.02,
    HALF_PI, 0, 0,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  6. SECONDARY ROOT FILAMENTS — finer trailing tendrils (cx >= 1)
  // ═══════════════════════════════════════════════════════════════════════════
  // Thinner tendrils offset between the primary roots, giving the engine
  // cluster a denser, more organic trailing web.
  if (cx >= 1) {
    for (let i = 0; i < rootCount; i++) {
      const angle = ((i + 0.5) / rootCount) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.008, w * 0.032, len * 0.14, 3),
        Math.cos(angle) * w * 0.38,
        Math.sin(angle) * w * 0.38,
        -len * 0.53,
        HALF_PI + 0.38 * Math.cos(angle), 0, 0.38 * Math.sin(angle),
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  7. BARK NODULES — hull surface texture (cx >= 1)
  // ═══════════════════════════════════════════════════════════════════════════
  // Small rounded bumps along the hull surface — knots and burl growths
  // in the living heartwood. Gives texture even to small ships.
  if (cx >= 1) {
    const nodulePositions: [number, number, number][] = [
      [w * 0.35, h * 0.25, len * 0.12],
      [-w * 0.35, h * 0.25, len * 0.12],
      [w * 0.30, -h * 0.15, -len * 0.05],
      [-w * 0.30, -h * 0.15, -len * 0.05],
    ];
    for (const [nx, ny, nz] of nodulePositions) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.06, 5, 4),
        nx, ny, nz,
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  8. PHOTOSYNTHETIC MEMBRANE SAILS — leaf-like extensions (cx >= 2)
  // ═══════════════════════════════════════════════════════════════════════════
  // Dramatically flattened spheres spreading laterally — thin, translucent
  // solar-collection membranes. The signature Sylvani feature no other
  // species shares. Slightly cupped like unfurling leaves.
  if (cx >= 2) {
    // Primary sail pair — large lateral membranes
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.95, 8, 5),
      s * w * 0.72, 0, len * 0.05,
      0, 0, s * 0.12,
      0.05, 1.0, 1.35,  // paper-thin, tall, stretched fore-aft
    )));
    // Sail vein — a thin ridge running along the centre of each membrane
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.008, len * 0.45, 4),
      s * w * 0.72, 0, len * 0.05,
      HALF_PI, 0, 0,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  9. FORWARD SPORE PODS — primary weapon fruiting bodies (cx >= 2)
  // ═══════════════════════════════════════════════════════════════════════════
  // Bulbous fruiting bodies swelling from the hull on short stems. These are
  // the ship's weapons — spore launchers that release bioelectric payloads.
  if (cx >= 2) {
    // Forward pair with stems
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.16, 7, 6),
      s * w * 0.42, h * 0.22, len * 0.26,
    )));
    // Pod stems — short cylinders connecting pods to hull
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.035, h * 0.15, 4),
      s * w * 0.38, h * 0.12, len * 0.26,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  10. MIDSHIP SPORE PODS — broadside launchers (cx >= 3)
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.20, 7, 6),
      s * w * 0.58, h * 0.15, -len * 0.04,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.03, w * 0.04, h * 0.12, 4),
      s * w * 0.52, h * 0.06, -len * 0.04,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  11. SECONDARY MEMBRANE SAILS — smaller aft pair (cx >= 3)
  // ═══════════════════════════════════════════════════════════════════════════
  // A second, smaller pair of membrane sails aft of the primary pair,
  // giving capital ships a layered, compound-leaf silhouette.
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.6, 6, 4),
      s * w * 0.55, h * 0.08, -len * 0.18,
      0, 0, s * 0.18,
      0.04, 0.8, 1.0,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  12. LATERAL BRANCH-ARMS — structural extensions (cx >= 4)
  // ═══════════════════════════════════════════════════════════════════════════
  // Thick branch structures extending laterally from the hull, carrying
  // additional spore pods — the ship's broadside battery mounts.
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.055, w * 0.11, w * 0.85, 6),
      s * w * 0.65, h * 0.08, len * 0.05,
      0, 0, s * HALF_PI,
    )));
    // Branch tip pods — spore clusters at the end of each branch
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.14, 6, 5),
      s * w * 1.05, h * 0.1, len * 0.05,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  13. AFT SPORE PODS — defensive clusters (cx >= 4)
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.14, 6, 5),
      s * w * 0.48, h * 0.18, -len * 0.24,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  14. SAP-LINE VEINS — vascular ridges along hull (cx >= 4)
  // ═══════════════════════════════════════════════════════════════════════════
  // Thin raised ridges tracing the hull surface like visible vascular
  // channels — the nutrient transport system of the living ship.
  if (cx >= 4) {
    // Dorsal-lateral veins
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.58, 4),
      s * w * 0.32, h * 0.38, 0,
      HALF_PI, 0, 0,
    )));
    // Lower lateral veins
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.010, w * 0.010, len * 0.45, 4),
      s * w * 0.52, h * 0.08, -len * 0.05,
      HALF_PI, 0, 0,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  15. CROWN CANOPY — spreading frond hemisphere (cx >= 5)
  // ═══════════════════════════════════════════════════════════════════════════
  // A spreading hemisphere of interlocked frond-structures at the bow,
  // like the canopy of a great tree — wide and flat, shading the hull.
  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 1.15, 10, 8, 0, PI * 2, 0, HALF_PI),
      0, h * 0.15, len * 0.32,
      HALF_PI, 0, 0,
      1.0, 0.25, 1.2,  // wide and flat canopy
    ));
    // Canopy rim — thickened edge where the canopy meets open space
    parts.push(place(
      new THREE.TorusGeometry(w * 1.05, w * 0.025, 5, 14),
      0, h * 0.15, len * 0.32,
      HALF_PI, 0, 0,
      1.0, 1.0, 1.2,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  16. DORSAL SPINE CLUSTER — mycelial lance conduits (cx >= 5)
  // ═══════════════════════════════════════════════════════════════════════════
  // Thorny protrusions along the dorsal ridge — hardened bark spines that
  // channel bio-electric energy for the ship's heaviest weapons.
  if (cx >= 5) {
    for (let i = 0; i < 5; i++) {
      const zPos = len * (0.22 - i * 0.11);
      const spineH = h * (0.28 + 0.06 * i);
      parts.push(place(
        new THREE.ConeGeometry(w * 0.035, spineH, 5),
        0, h * 0.55 + spineH * 0.35, zPos,
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  17. BIOLUMINESCENT SENSOR NODES — glowing spheres (cx >= 5)
  // ═══════════════════════════════════════════════════════════════════════════
  // Tiny bioluminescent organs at branch tips, spine bases, and along the
  // dorsal ridge — the ship's distributed sensory network.
  if (cx >= 5) {
    const nodePositions: [number, number, number][] = [
      [0, h * 0.72, len * 0.22],
      [0, h * 0.72, len * 0.06],
      [0, h * 0.72, -len * 0.08],
      [w * 0.68, h * 0.15, len * 0.05],
      [-w * 0.68, h * 0.15, len * 0.05],
      [w * 0.45, h * 0.28, len * 0.20],
      [-w * 0.45, h * 0.28, len * 0.20],
    ];
    for (const [nx, ny, nz] of nodePositions) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.05, 5, 4),
        nx, ny, nz,
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  18. TERTIARY ROOT WEB — heavy capital root system (cx >= 6)
  // ═══════════════════════════════════════════════════════════════════════════
  // An enormous spreading root system at the stern — the signature of ancient
  // Sylvani capital ships, like the root ball of a world-tree. Many fine
  // tendrils flaring outward in a wide cone.
  if (cx >= 6) {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * PI * 2;
      const rootLen = len * (0.26 + 0.04 * Math.sin(angle * 3));
      const splay = w * 0.85;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.045, rootLen, 4),
        Math.cos(angle) * splay,
        Math.sin(angle) * splay,
        -len * 0.56,
        HALF_PI + 0.42 * Math.cos(angle), 0, 0.42 * Math.sin(angle),
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  19. TRUNK GIRTH RINGS — growth-ring ridges (cx >= 6)
  // ═══════════════════════════════════════════════════════════════════════════
  // Visible growth rings encircling the trunk at intervals, like the annular
  // ridges on a tree trunk. Gives the hull a segmented, aged look.
  if (cx >= 6) {
    const ringPositions = [-0.15, 0.0, 0.12, 0.22];
    for (const zFrac of ringPositions) {
      // Estimate trunk radius at this z position
      const t = 0.5 - zFrac / 0.88;
      const swell = Math.sin(t * PI) * (1 - 0.22 * t * t);
      const localR = w * swell * 0.92;
      parts.push(place(
        new THREE.TorusGeometry(localR * 0.85, w * 0.018, 5, 12),
        0, 0, len * zFrac,
        HALF_PI, 0, 0,
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  20. SECONDARY BRANCH ARMS — upper lateral branches (cx >= 6)
  // ═══════════════════════════════════════════════════════════════════════════
  // A second set of branches higher on the hull, angled upward — giving
  // the ship a spreading, tree-like cross-section.
  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.08, w * 0.65, 5),
      s * w * 0.48, h * 0.35, -len * 0.10,
      0, 0, s * (HALF_PI * 0.7),
    )));
    // Branch-tip sensor fronds
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.03, h * 0.15, 4),
      s * w * 0.78, h * 0.58, -len * 0.10,
      0, 0, s * 0.3,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  21. CANOPY FROND EXTENSIONS — individual canopy tendrils (cx >= 7)
  // ═══════════════════════════════════════════════════════════════════════════
  // Long, tapered frond-tendrils extending forward and outward from the
  // crown canopy — the ship reaching forward to sense the void.
  if (cx >= 7) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      const frondLen = len * 0.16;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.02, frondLen, 4),
        Math.cos(angle) * w * 0.8,
        h * 0.18 + Math.sin(angle) * w * 0.3,
        len * 0.46,
        -0.4, 0, 0.2 * Math.cos(angle),
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  22. MYCELIAL WEB LATTICE — structural filaments (cx >= 7)
  // ═══════════════════════════════════════════════════════════════════════════
  // A visible web of fine mycelial strands connecting the branches, sails,
  // and roots — the ship's internal communication network made visible.
  if (cx >= 7) {
    // Branch-to-trunk filaments
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, w * 0.7, 3),
      s * w * 0.35, h * 0.22, len * 0.12,
      0, 0, s * (HALF_PI * 0.6),
    )));
    // Dorsal-to-branch filaments
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, w * 0.5, 3),
      s * w * 0.28, h * 0.42, -len * 0.05,
      0, 0, s * (HALF_PI * 0.5),
    )));
    // Root interconnects
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.007, w * 0.007, w * 0.4, 3),
      s * w * 0.20, -h * 0.10, -len * 0.42,
      0, 0, s * (HALF_PI * 0.4),
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  23. MEGA-CAPITAL SPORE BATTERY — heavy weapon cluster (cx >= 7)
  // ═══════════════════════════════════════════════════════════════════════════
  // A dense cluster of large spore pods along the ventral hull — the
  // heavy weapons of a world-tree's flagship.
  if (cx >= 7) {
    for (let i = 0; i < 3; i++) {
      const zOff = len * (0.15 - i * 0.12);
      parts.push(place(
        new THREE.SphereGeometry(w * 0.18, 7, 6),
        0, -h * 0.38, zOff,
      ));
      // Pod stem
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.03, h * 0.18, 4),
        0, -h * 0.26, zOff,
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  24. ANCIENT HEARTWOOD BULGE — inner trunk density (cx >= 8)
  // ═══════════════════════════════════════════════════════════════════════════
  // The oldest Sylvani capital ships have a visible inner core of ancient
  // heartwood — a denser, slightly wider bulge within the main trunk.
  if (cx >= 8) {
    const innerPts: THREE.Vector2[] = [];
    const innerSegs = 12;
    for (let i = 0; i <= innerSegs; i++) {
      const t = i / innerSegs;
      const swell = Math.pow(Math.sin(t * PI), 1.3) * (1 - 0.3 * t);
      const r = w * swell * 0.55;
      const z = (0.5 - t) * len * 0.5;
      innerPts.push(new THREE.Vector2(r, z));
    }
    parts.push(place(
      new THREE.LatheGeometry(innerPts, 8),
      0, h * 0.05, len * 0.02,
      HALF_PI, 0, 0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  25. TERTIARY MEMBRANE SAILS — dorsal pair (cx >= 8)
  // ═══════════════════════════════════════════════════════════════════════════
  // A third set of smaller sails sprouting from the dorsal ridge, angled
  // upward — giving the ship a full canopy of overlapping leaf-membranes.
  if (cx >= 8) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.5, 6, 4),
      s * w * 0.4, h * 0.45, len * 0.10,
      0, 0, s * 0.25,
      0.04, 0.7, 0.9,
    )));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  26. QUATERNARY ROOT HAIR — finest trailing filaments (cx >= 8)
  // ═══════════════════════════════════════════════════════════════════════════
  // The very finest root hairs trailing from the stern — almost invisible
  // wisps that give the engine plume a feathered, organic quality.
  if (cx >= 8) {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * PI * 2;
      const hairLen = len * (0.18 + 0.06 * Math.sin(angle * 5));
      const splay = w * 1.1;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.005, w * 0.02, hairLen, 3),
        Math.cos(angle) * splay,
        Math.sin(angle) * splay,
        -len * 0.62,
        HALF_PI + 0.5 * Math.cos(angle), 0, 0.5 * Math.sin(angle),
      ));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  27. BIOLUMINESCENT VEIN NETWORK — glowing channels (cx >= 8)
  // ═══════════════════════════════════════════════════════════════════════════
  // Additional sensor nodes tracing a constellation pattern across the hull,
  // concentrated at branch joints and root collars.
  if (cx >= 8) {
    const deepNodes: [number, number, number][] = [
      [w * 0.55, h * 0.30, len * 0.15],
      [-w * 0.55, h * 0.30, len * 0.15],
      [w * 0.40, -h * 0.25, len * 0.10],
      [-w * 0.40, -h * 0.25, len * 0.10],
      [0, h * 0.80, -len * 0.12],
      [0, -h * 0.45, -len * 0.30],
      [w * 0.85, h * 0.12, -len * 0.08],
      [-w * 0.85, h * 0.12, -len * 0.08],
    ];
    for (const [nx, ny, nz] of deepNodes) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 4),
        nx, ny, nz,
      ));
    }
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getSylvaniHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.38;
  const h = len * 0.20;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Primary root-cluster engines (always present) ─────────────────────────
  // Radial root tendrils at the stern, count scales with cx.
  const rootCount = 3 + cx;
  const splay = w * (0.22 + 0.06 * cx);
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * Math.PI * 2;
    engines.push({
      position: new THREE.Vector3(
        Math.cos(angle) * splay * 0.5,
        Math.sin(angle) * splay * 0.5,
        -len * 0.48,
      ),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.065,
    });
  }

  // ── Forward spore pods — primary weapons (cx >= 2) ────────────────────────
  if (cx >= 2) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.42, h * 0.22, len * 0.26),
        facing: 'fore',
        normal: new THREE.Vector3(0, 0, 1),
      });
    }
  }

  // ── Midship spore pods — broadside launchers (cx >= 3) ────────────────────
  if (cx >= 3) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.58, h * 0.15, -len * 0.04),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }
  }

  // ── Branch tip pods (cx >= 4) ─────────────────────────────────────────────
  if (cx >= 4) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 1.05, h * 0.1, len * 0.05),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }

    // Aft spore pods — defensive clusters
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.48, h * 0.18, -len * 0.24),
        facing: 'aft',
        normal: new THREE.Vector3(0, 0, -1),
      });
    }
  }

  // ── Mega-capital ventral spore battery (cx >= 7) ──────────────────────────
  if (cx >= 7) {
    for (let i = 0; i < 3; i++) {
      const zOff = len * (0.15 - i * 0.12);
      weapons.push({
        position: new THREE.Vector3(0, -h * 0.38, zOff),
        facing: 'turret',
        normal: new THREE.Vector3(0, -1, 0),
      });
    }
  }

  return { engines, weapons };
}

registerHardpointProvider('sylvani', getSylvaniHardpoints);
