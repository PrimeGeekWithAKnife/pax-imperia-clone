import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../shipHardpoints';

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  DRAKMARI SHIP DESIGNS — "Abyssal Predator Architecture"
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  The Drakmari evolved in the lightless abyssal trenches of Pelagis, a
 *  high-gravity ocean world with no continents and no sunlight below the
 *  first kilometre of water. Their ships are the architecture of deep-ocean
 *  apex predators: anglerfish silhouettes with split jaw-prows, segmented
 *  armour plates, lateral sensor spines, bioluminescent lure-nodes, and
 *  tight caudal engine clusters.
 *
 *  VISUAL LANGUAGE: ANGULAR-ORGANIC PREDATION
 *
 *  Drakmari hulls are neither purely mechanical nor purely biological. They
 *  are grown in orbital pressurised dockyards from cartilaginous bioceramics
 *  — the same layered, pressure-resistant material as their own skeletal
 *  plates. The result is ships that look like the deep-ocean predators the
 *  Drakmari once hunted: hunched, angular, segmented, with sharp edges
 *  where plates overlap and soft curves where the living hull flexes.
 *
 *  HULL CONSTRUCTION: ABYSSAL PREDATOR ANATOMY
 *
 *  Every Drakmari ship follows the body plan of a deep-ocean apex predator:
 *  - SPLIT JAW-PROW: The bow is a pair of mandibles that splay outward,
 *    connected by a thin jaw bridge. On fighters this is a simple V-fork;
 *    on capitals it becomes a massive articulated maw with secondary inner
 *    mandibles and sensory barbels.
 *  - DORSAL RIDGE: Overlapping plates of bioceramic armour run along the
 *    top of the hull, each angled backward like the scales of a pangolin
 *    or the dorsal plates of a deep-sea fish. Taller forward, tapering aft.
 *  - LATERAL SENSOR BARBELS: Long, thin spines projecting sideways from
 *    the hull — the Drakmari equivalent of the lateral line in fish. These
 *    detect vibration, EM fields, and gravitational ripples.
 *  - PHOTOPHORE ARRAYS: Lines of small glowing nodes running along the hull
 *    flanks. Teal bioluminescence — functional countershading, friend-or-foe
 *    identification, and predator intimidation display.
 *  - ANGLERFISH LURE: A glowing node on a thin stalk extending forward from
 *    the jaw-prow. On small ships it is a single bead; on capitals it is a
 *    pulsing cluster that serves as the primary sensor suite.
 *
 *  WEAPONS: SPINE-MOUNTED PROJECTORS
 *
 *  Drakmari weapons are grown from the hull, not bolted on. Spine-mounted
 *  bio-electric projectors emerge from the dorsal ridge — crackling teal
 *  energy channelled through bioceramic crystalline arrays. Ventral launch
 *  bays are recessed slits in the belly — torpedo analogues ejected like
 *  a hagfish expelling slime bolts. On capitals, the jaw mandibles
 *  themselves carry weapon emitters at their tips.
 *
 *  ENGINES: CAUDAL TAIL CLUSTER
 *
 *  Drakmari propulsion is a tight cluster of bio-jets at the aft end of a
 *  tapered tail — NOT conventional nozzles. The tail narrows to a point,
 *  then flares into a caudal fin-cluster of jet orifices. Small ships have
 *  2-3 jets in a vertical fan; capitals have dense radial clusters of 6+.
 *  The propulsive glow is deep teal, not blue-white.
 *
 *  SCALING: FIGHTER TO LEVIATHAN
 *
 *  - Fighters (cx 0): A darting predator — jaw-prow, main body, caudal
 *    tail. 5+ parts. Angular, fast, lethal silhouette.
 *  - Corvettes (cx 1-2): Dorsal ridge plates appear. Sensor barbels extend.
 *    Pectoral fins emerge. The anglerfish lure node extends forward.
 *  - Cruisers (cx 3-4): Full armour segmentation. Spine-mounted weapons.
 *    Lateral photophore arrays glow along the flanks. Ventral weapon bays.
 *  - Capitals (cx 5-6): Secondary jaw mandibles. Command blister. Heavy
 *    ventral launch bays. Dense caudal engine cluster. 20+ parts.
 *  - Leviathans (cx 7+): Abyssal terror. Full predator display — extended
 *    dorsal crests, abyssal sensor web, trailing tail tendrils, massive
 *    jaw assembly. 35+ parts.
 *
 *  INSTANT RECOGNITION
 *
 *  You know it is Drakmari from across the battlefield because of:
 *  1. The SPLIT JAW-PROW — no other species has the open mandible bow
 *  2. The DORSAL RIDGE — overlapping backward-angled plates
 *  3. The CAUDAL TAIL — tapered stern ending in a fan engine cluster
 *  4. The TEAL PHOTOPHORE LINES — strips of glowing nodes along the flanks
 *  5. The ANGLERFISH LURE — a forward-projecting glowing sensor stalk
 *  6. The overall PREDATOR HUNCH — high shoulders, low jaw, tapered tail
 *
 *  MATERIAL: ABYSSAL BIOCERAMIC
 *
 *  Near-black hull (0x1a1a2e) with teal bioluminescent accents (0x00ffe0).
 *  The hull absorbs light like the deep ocean absorbs everything. The only
 *  colour is the cold teal of photophores — functional, not decorative.
 *  High metalness from bioceramic plating, moderate roughness from the
 *  segmented, scaled surface texture.
 *
 *  DISTINCTIVENESS FROM OTHER ORGANICS:
 *  - Sylvani are plant/coral — soft, symmetrical, green, photosynthetic.
 *  - Vethara are parasitic symbiotes — lumpy, two-toned, tendriled.
 *  - Drakmari are deep-ocean predators — angular-organic, near-black,
 *    with sharp teal photophore accents and segmented armour plates.
 *
 *  Part counts:  cx=0 ~7 parts | cx=5 ~25+ parts | cx=8 ~50+ parts
 */

export function buildDrakmari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.18;           // beam (width) — narrower than manta, eel-like
  const h = len * 0.16;           // draught (height) — slightly taller than wide
  const parts: THREE.BufferGeometry[] = [];

  // ── 1. MAIN HULL — Hunched predator body ───────────────────────────────
  // Elongated, slightly dorsally-humped ellipsoid — the body of a deep-sea
  // ambush predator. Not round like Vethara; angular-organic, pinched at
  // the flanks, swelling at the dorsal hump.
  parts.push(place(
    new THREE.SphereGeometry(w * 0.65, 12, 8),
    0, h * 0.05, len * 0.05,
    0, 0, 0,
    0.85, 0.75, 1.6,       // narrow, squat, stretched along Z
  ));

  // ── 2. SPLIT JAW-PROW — Primary mandibles ─────────────────────────────
  // The signature Drakmari feature: two forward-reaching jaw halves that
  // splay outward, forming an open maw. On fighters this is a simple V-fork.
  parts.push(...mirrorX(s => place(
    new THREE.ConeGeometry(w * 0.18, len * 0.3, 5),
    s * w * 0.14, -h * 0.08, len * 0.42,
    HALF_PI, 0, s * 0.12,   // slight outward splay
    1, 0.55, 1,              // flattened vertically — blade-like mandibles
  )));

  // Jaw bridge — thin bioceramic bar connecting the two jaw halves at root
  parts.push(place(
    new THREE.BoxGeometry(w * 0.28, h * 0.12, len * 0.06),
    0, -h * 0.08, len * 0.28,
  ));

  // Jaw inner ridges — serrated interior edges along each mandible
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.03, h * 0.06, len * 0.18),
    s * w * 0.06, -h * 0.04, len * 0.38,
    0, 0, s * 0.08,
  )));

  // ── 3. CAUDAL TAIL — Tapered aft section ──────────────────────────────
  // The tail narrows from the main hull to a thin stalk, then flares into
  // the caudal engine cluster. This is the deep-sea predator's propulsive
  // anatomy — not a boxy stern but a tapering organic tail.
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.04, w * 0.18, len * 0.38, 6),
    0, 0, -len * 0.42,
    HALF_PI, 0, 0,
  ));

  // Tail vertebrae — segmented ridges along the tail stalk
  for (let i = 0; i < 3; i++) {
    const tz = -len * (0.28 + i * 0.08);
    const segW = w * (0.16 - i * 0.03);
    parts.push(place(
      new THREE.TorusGeometry(segW, w * 0.018, 4, 6),
      0, 0, tz,
      HALF_PI, 0, 0,
    ));
  }

  // ── 4. DORSAL RIDGE — Segmented armour plates ─────────────────────────
  // Overlapping bioceramic plates along the dorsal spine — the Drakmari
  // equivalent of a deep-sea fish's dorsal fin crossed with pangolin scales.
  // Always present. On fighters a modest 2-plate ridge; on capitals a
  // towering crest of 7+ overlapping plates.
  {
    const ridgeCount = Math.max(2, Math.min(2 + Math.floor(cx / 1.5), 7));
    for (let i = 0; i < ridgeCount; i++) {
      const t = i / Math.max(ridgeCount - 1, 1);      // 0..1 along spine
      const zPos = len * (0.25 - t * 0.55);           // fore to aft
      const ridgeH = h * (0.38 - t * 0.14);           // taller forward
      const ridgeShape = new THREE.Shape();
      ridgeShape.moveTo(0, 0);
      ridgeShape.lineTo(-ridgeH * 0.4, ridgeH);
      ridgeShape.lineTo(-ridgeH * 1.0, ridgeH * 0.3);
      ridgeShape.lineTo(-ridgeH * 0.8, 0);
      ridgeShape.closePath();
      parts.push(place(
        new THREE.ExtrudeGeometry(ridgeShape, { depth: 0.03, bevelEnabled: false }),
        0, h * 0.28, zPos,
        0, HALF_PI, 0,
      ));
    }
  }

  // ── 5. LATERAL SENSOR BARBELS — Primary spines ────────────────────────
  // Long thin spines projecting sideways — the deep-ocean lateral line
  // sensor array. Always present on every hull. More spines on bigger ships.
  {
    const spineCount = Math.max(2, Math.min(2 + Math.floor(cx / 1.5), 6));
    for (let i = 0; i < spineCount; i++) {
      const zPos = len * (0.18 - i * 0.12);
      const spineLen = w * (0.55 + cx * 0.02);
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.028, spineLen, 4),
        s * w * 0.6, 0, zPos,
        0, 0, s * 0.35,
      )));
    }
  }

  // ── 6. ANGLERFISH LURE NODE — Forward sensor stalk ────────────────────
  // A glowing node on a thin stalk projecting forward and slightly downward
  // from the jaw bridge. The primary active sensor — a bioluminescent
  // hunting organ repurposed as a sensor array.
  {
    const stalkLen = len * 0.08;
    // Lure stalk
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.008, stalkLen, 4),
      0, -h * 0.14, len * 0.52,
      HALF_PI - 0.15, 0, 0,
    ));
    // Lure node — glowing bead
    parts.push(place(
      new THREE.SphereGeometry(w * 0.05, 6, 6),
      0, -h * 0.18, len * 0.58,
    ));
  }

  // ── 7. VENTRAL KEEL — Abyssal pressure spine ──────────────────────────
  // A structural ridge running below the hull — the keel of a creature
  // built for crushing pressure. Appears at cx >= 1.
  if (cx >= 1) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.10, h * 0.22, len * 0.55),
      0, -h * 0.42, len * 0.02,
    ));
    // Ventral keel blade — thin leading edge
    parts.push(place(
      new THREE.ConeGeometry(h * 0.10, len * 0.12, 4),
      0, -h * 0.50, len * 0.30,
      HALF_PI, PI * 0.25, 0,
    ));
  }

  // ── 8. PHOTOPHORE LINES — Lateral bioluminescent nodes ────────────────
  // Rows of small glowing beads along the hull flanks — the teal-glow
  // signature of every Drakmari ship. Sparse at low cx, dense at high cx.
  if (cx >= 1) {
    const nodeCount = 3 + Math.min(cx * 2, 10);
    for (let i = 0; i < nodeCount; i++) {
      const t = i / Math.max(nodeCount - 1, 1);
      const zPos = len * (0.30 - t * 0.65);
      const hullW = w * (0.52 + 0.06 * Math.sin(t * PI));  // follow hull curvature
      const beadR = w * 0.022;
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(beadR, 4, 3),
        s * hullW, -h * 0.12, zPos,
      )));
    }
  }

  // ── 9. PECTORAL FINS — Lateral stabiliser blades ──────────────────────
  // Swept-back fin blades extending from the hull flanks — like the
  // pectoral fins of a deep-sea ray. Flat, angular, pressure-hardened.
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.08, len * 0.24, 4),
      s * w * 0.52, -h * 0.05, len * 0.0,
      HALF_PI * 0.3, 0, s * 0.5,
      1, 0.22, 1,            // very flat — blade-like
    )));
    // Fin trailing edge — thin extension
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.03, len * 0.10, 3),
      s * w * 0.62, -h * 0.05, -len * 0.10,
      HALF_PI * 0.2, 0, s * 0.6,
      1, 0.15, 1,
    )));
  }

  // ── 10. VENTRAL INTAKE SLITS — Pressure-regulation vents ──────────────
  // Recessed slits in the belly — the ship's equivalent of gill openings.
  // On combat ships these double as torpedo launch rails.
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, h * 0.08, len * 0.20),
      s * w * 0.22, -h * 0.38, len * 0.08,
    )));
    // Slit recesses — darker gaps suggesting depth
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.05, h * 0.04, len * 0.16),
      s * w * 0.22, -h * 0.42, len * 0.08,
    )));
  }

  // ── 11. ARMOUR SEGMENTS — Overlapping hull plates ─────────────────────
  // Bioceramic carapace plates covering the dorsal surface — layered like
  // scales, each overlapping the one behind it. More plates on bigger ships.
  if (cx >= 2) {
    const plateCount = Math.min(2 + Math.floor(cx / 2), 5);
    for (let i = 0; i < plateCount; i++) {
      const zPos = len * (0.18 - i * 0.15);
      parts.push(place(
        new THREE.SphereGeometry(w * 0.42, 8, 4, 0, PI * 2, 0, PI * 0.4),
        0, h * 0.15, zPos,
        -0.1, 0, 0,
        1.1, 0.28, 0.55,
      ));
    }
  }

  // ── 12. BARBEL SENSORY TIPS — Bead nodes at spine ends ────────────────
  // Small spherical sensor nodes at the tips of the lateral barbels —
  // the actual sensing organs that detect vibration and EM fields.
  if (cx >= 2) {
    const tipCount = Math.min(2 + Math.floor(cx / 2), 5);
    for (let i = 0; i < tipCount; i++) {
      const zPos = len * (0.18 - i * 0.12);
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.028, 5, 4),
        s * w * 0.82, h * 0.02, zPos,
      )));
    }
  }

  // ── 13. SPINE-MOUNTED WEAPON PROJECTORS — Dorsal armament ─────────────
  // Bio-electric projectors emerging from between the dorsal ridge plates.
  // Crystalline bioceramic emitter spines — the primary weapon system.
  if (cx >= 3) {
    const weaponCount = Math.min(1 + Math.floor(cx / 2), 4);
    for (let i = 0; i < weaponCount; i++) {
      const zPos = len * (0.15 - i * 0.14);
      // Emitter spine — angular cone
      parts.push(place(
        new THREE.ConeGeometry(w * 0.05, h * 0.35, 4),
        0, h * 0.55, zPos,
      ));
      // Emitter tip node — glowing projector bead
      parts.push(place(
        new THREE.SphereGeometry(w * 0.03, 5, 4),
        0, h * 0.72, zPos,
      ));
    }
  }

  // ── 14. LATERAL WEAPON SPINES — Flanking armament ─────────────────────
  // Shorter weapon spines emerging from the hull flanks — secondary
  // projectors for broadside engagement.
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.06, w * 0.35, 4),
      s * w * 0.55, h * 0.08, len * 0.12,
      0, 0, s * 0.6,
    )));
    // Spine tip emitter nodes
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.038, 5, 5),
      s * w * 0.74, h * 0.16, len * 0.12,
    )));
  }

  // ── 15. VENTRAL LAUNCH BAYS — Torpedo slits ───────────────────────────
  // Recessed launch slits on the belly — bio-torpedoes ejected like a
  // hagfish expelling slime bolts. Not turrets — flush organic slits.
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.12, h * 0.06, len * 0.22),
      s * w * 0.18, -h * 0.48, len * 0.04,
    )));
    // Bay doors — thin plates that flex open
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.14, h * 0.02, len * 0.24),
      s * w * 0.18, -h * 0.44, len * 0.04,
    )));
  }

  // ── 16. CAUDAL ENGINE CLUSTER — Bio-jet fan ───────────────────────────
  // The deep-sea predator's propulsive anatomy: a tight cluster of bio-jet
  // orifices at the tail terminus, arranged in a radial fan. NOT nozzles.
  {
    const engineCount = Math.min(2 + Math.floor(cx * 0.8), 7);
    const fanSpread = cx >= 5 ? PI * 1.6 : PI * 1.2;
    for (let i = 0; i < engineCount; i++) {
      const angle = (i - (engineCount - 1) / 2) * (fanSpread / Math.max(engineCount - 1, 1));
      const ex = Math.sin(angle) * w * 0.14;
      const ey = Math.cos(angle) * h * 0.10;
      // Bio-jet orifice — tapered organic cone
      parts.push(place(
        new THREE.ConeGeometry(w * 0.05, len * 0.07, 6),
        ex, ey, -len * 0.58,
        -HALF_PI, 0, 0,
      ));
      // Jet exhaust rim — torus ring at each orifice
      if (cx >= 2) {
        parts.push(place(
          new THREE.TorusGeometry(w * 0.04, w * 0.008, 4, 6),
          ex, ey, -len * 0.615,
          HALF_PI, 0, 0,
        ));
      }
    }
    // Central tail spine — extends past the engine cluster
    parts.push(place(
      new THREE.ConeGeometry(w * 0.02, len * 0.06, 4),
      0, 0, -len * 0.64,
      -HALF_PI, 0, 0,
    ));
  }

  // ── 17. SECONDARY JAW MANDIBLES — Inner mouth parts ───────────────────
  // On cruiser+ hulls, a second pair of smaller mandibles nestles inside
  // the primary jaw — like the pharyngeal jaws of a moray eel.
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.08, len * 0.16, 4),
      s * w * 0.08, -h * 0.04, len * 0.34,
      HALF_PI, 0, s * 0.08,
      1, 0.4, 1,
    )));
    // Inner mandible serrations — small tooth-like bumps
    parts.push(...mirrorX(s => {
      const toothParts: THREE.BufferGeometry[] = [];
      for (let t = 0; t < 3; t++) {
        toothParts.push(place(
          new THREE.ConeGeometry(w * 0.015, h * 0.08, 3),
          s * w * (0.06 + t * 0.01), -h * 0.10, len * (0.38 + t * 0.03),
          0, 0, s * 0.2,
        ));
      }
      return merge(toothParts);
    }));
  }

  // ── 18. MANDIBLE TIP EMITTERS — Jaw weapon nodes ──────────────────────
  // Glowing weapon emitters at the tips of the primary mandibles.
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.04, 5, 5),
      s * w * 0.18, -h * 0.12, len * 0.55,
    )));
    // Emitter connecting ridges — run along mandible inner face
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.010, w * 0.015, len * 0.15, 4),
      s * w * 0.12, -h * 0.10, len * 0.46,
      HALF_PI, 0, 0,
    )));
  }

  // ── 19. DORSAL COMMAND BLISTER — Hunched bridge structure ─────────────
  // A raised bioceramic dome — the predator's "head" hump. Houses the
  // bridge crew behind thick pressure-resistant layered armour.
  if (cx >= 4) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.18, 8, 6, 0, PI * 2, 0, HALF_PI),
      0, h * 0.38, len * 0.12,
      0, 0, 0,
      1.2, 0.6, 1.0,
    ));
    // Bridge viewport slit — a thin horizontal gap in the blister
    parts.push(place(
      new THREE.BoxGeometry(w * 0.28, h * 0.03, len * 0.01),
      0, h * 0.44, len * 0.18,
    ));
  }

  // ── 20. AFT STABILISER FINS — Tail control surfaces ───────────────────
  // Small paired fins flanking the tail section — roll and yaw control.
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.04, len * 0.16, 4),
      s * w * 0.14, h * 0.04, -len * 0.35,
      0, 0, s * 0.7,
      1, 0.18, 1,           // very flat — blade fins
    )));
    // Ventral stabiliser pair
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.035, len * 0.12, 4),
      s * w * 0.12, -h * 0.15, -len * 0.38,
      0, 0, s * 0.8,
      1, 0.15, 1,
    )));
  }

  // ── 21. EXTENDED LURE ARRAY — Capital sensor cluster ──────────────────
  // On capital ships the simple lure node grows into a multi-node sensor
  // cluster on an articulated stalk — the anglerfish's evolved hunting organ.
  if (cx >= 5) {
    // Extended stalk
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.015, len * 0.10, 4),
      0, -h * 0.16, len * 0.62,
      HALF_PI - 0.10, 0, 0,
    ));
    // Secondary lure nodes — flanking the primary
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.035, 5, 5),
      s * w * 0.04, -h * 0.20, len * 0.65,
    )));
    // Lure tendril whiskers — fine sensory filaments
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.005, w * 0.003, len * 0.04, 3),
        Math.cos(angle) * w * 0.03, -h * 0.18 + Math.sin(angle) * w * 0.03, len * 0.66,
        HALF_PI - 0.2, angle * 0.3, 0,
      ));
    }
  }

  // ── 22. HEAVY VENTRAL WEAPON BAY — Capital launch systems ─────────────
  // A large recessed bay on the belly — heavy bio-torpedo launch array.
  // The Drakmari equivalent of a bomb bay, grown from the hull itself.
  if (cx >= 5) {
    // Bay housing
    parts.push(place(
      new THREE.BoxGeometry(w * 0.24, h * 0.26, len * 0.30),
      0, -h * 0.55, len * 0.05,
    ));
    // Bay doors — paired plates that flex open
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.13, h * 0.03, len * 0.32),
      s * w * 0.06, -h * 0.42, len * 0.05,
    )));
    // Internal launch rails — visible when bay is open
    for (let i = 0; i < 3; i++) {
      const rz = len * (0.12 - i * 0.08);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.010, h * 0.18, 4),
        0, -h * 0.52, rz,
      ));
    }
  }

  // ── 23. LATERAL PHOTOPHORE ARRAYS — Dense bioluminescent strips ───────
  // On capital ships the sparse photophore lines become dense illuminated
  // strips running fore-to-aft — a full predator intimidation display.
  if (cx >= 5) {
    // Upper photophore strip
    const upperCount = 6 + Math.min(cx - 5, 4) * 2;
    for (let i = 0; i < upperCount; i++) {
      const t = i / Math.max(upperCount - 1, 1);
      const zPos = len * (0.24 - t * 0.58);
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.018, 4, 3),
        s * w * 0.50, h * 0.12, zPos,
      )));
    }
    // Ventral photophore strip
    const lowerCount = 4 + Math.min(cx - 5, 3);
    for (let i = 0; i < lowerCount; i++) {
      const t = i / Math.max(lowerCount - 1, 1);
      const zPos = len * (0.20 - t * 0.50);
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.015, 4, 3),
        s * w * 0.38, -h * 0.30, zPos,
      )));
    }
  }

  // ── 24. SECONDARY DORSAL CRESTS — Flanking ridge extensions ───────────
  // On capital ships, secondary ridge lines emerge along the hull flanks —
  // the predator's full threat display. Angled outward and backward.
  if (cx >= 5) {
    parts.push(...mirrorX(s => {
      const crestShape = new THREE.Shape();
      crestShape.moveTo(0, 0);
      crestShape.lineTo(-h * 0.3, h * 0.45);
      crestShape.lineTo(-h * 0.7, h * 0.15);
      crestShape.lineTo(-h * 0.5, 0);
      crestShape.closePath();
      return place(
        new THREE.ExtrudeGeometry(crestShape, { depth: 0.02, bevelEnabled: false }),
        s * w * 0.30, h * 0.22, len * 0.05,
        0, HALF_PI, s * 0.18,
      );
    }));
    // Aft secondary crests — smaller, further back
    parts.push(...mirrorX(s => {
      const crestShape = new THREE.Shape();
      crestShape.moveTo(0, 0);
      crestShape.lineTo(-h * 0.2, h * 0.30);
      crestShape.lineTo(-h * 0.5, h * 0.10);
      crestShape.lineTo(-h * 0.35, 0);
      crestShape.closePath();
      return place(
        new THREE.ExtrudeGeometry(crestShape, { depth: 0.02, bevelEnabled: false }),
        s * w * 0.28, h * 0.20, -len * 0.15,
        0, HALF_PI, s * 0.15,
      );
    }));
  }

  // ── 25. ABYSSAL SENSOR WEB — Capital detection array ──────────────────
  // A web of fine bioceramic filaments stretching between the barbel spines
  // — a vast passive sensor net, like a spider's web made of nerve tissue.
  if (cx >= 6) {
    // Cross-filaments connecting lateral barbels
    const webCount = Math.min(cx - 3, 5);
    for (let i = 0; i < webCount; i++) {
      const zPos = len * (0.15 - i * 0.12);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.006, w * 0.006, w * 1.2, 3),
        0, h * 0.02, zPos,
        0, 0, HALF_PI,
      ));
    }
    // Diagonal web strands
    for (let i = 0; i < 3; i++) {
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.005, w * 0.005, w * 0.65, 3),
        s * w * 0.35, h * 0.01, len * (0.12 - i * 0.12),
        0.25, 0, s * 0.45,
      )));
    }
  }

  // ── 26. TAIL TENDRILS — Trailing sensory filaments ────────────────────
  // Fine tendrils trailing from the caudal section — passive sensor
  // streamers that detect wake turbulence from nearby ships.
  if (cx >= 6) {
    const tendrilCount = 4 + Math.min(cx - 6, 4);
    for (let i = 0; i < tendrilCount; i++) {
      const angle = (i / tendrilCount) * PI * 2;
      const tR = w * 0.10;
      const tendrilLen = len * 0.16;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.005, w * 0.018, tendrilLen, 4),
        Math.cos(angle) * tR,
        Math.sin(angle) * tR,
        -len * 0.62 - tendrilLen * 0.4,
        HALF_PI + 0.08 * Math.sin(angle),
        0,
        0.08 * Math.cos(angle),
      ));
      // Tendril tip sensor bead
      parts.push(place(
        new THREE.SphereGeometry(w * 0.012, 3, 3),
        Math.cos(angle) * tR * 0.85,
        Math.sin(angle) * tR * 0.85,
        -len * 0.62 - tendrilLen * 0.85,
      ));
    }
  }

  // ── 27. EXPANDED JAW ASSEMBLY — Leviathan maw ─────────────────────────
  // On the largest ships the jaw-prow becomes a massive articulated maw
  // with tertiary mandible elements and sensory barbels at the jaw tips.
  if (cx >= 7) {
    // Tertiary outer mandibles — wider V flanking the primary jaw
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.12, len * 0.22, 4),
      s * w * 0.28, -h * 0.02, len * 0.38,
      HALF_PI, 0, s * 0.18,
      1, 0.45, 1,
    )));
    // Jaw-tip barbels — sensory whiskers at mandible ends
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.003, len * 0.08, 3),
      s * w * 0.22, -h * 0.14, len * 0.56,
      HALF_PI - 0.1, 0, s * 0.15,
    )));
    // Jaw-tip barbel beads
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.015, 4, 3),
      s * w * 0.24, -h * 0.16, len * 0.62,
    )));
    // Jaw inner membrane — thin plate filling the gap between mandibles
    parts.push(place(
      new THREE.BoxGeometry(w * 0.20, h * 0.02, len * 0.15),
      0, -h * 0.06, len * 0.36,
    ));
  }

  // ── 28. DORSAL THREAT DISPLAY — Full crest extension ──────────────────
  // The largest ships deploy the full predator threat display: the dorsal
  // ridge plates extend to maximum height and secondary spines emerge
  // between them, creating a towering jagged silhouette.
  if (cx >= 7) {
    // Inter-ridge spines — sharp spikes between the main dorsal plates
    for (let i = 0; i < 5; i++) {
      const zPos = len * (0.22 - i * 0.12);
      const spineH = h * (0.50 - i * 0.05);
      parts.push(place(
        new THREE.ConeGeometry(w * 0.020, spineH, 3),
        0, h * 0.30 + spineH * 0.5, zPos,
      ));
    }
    // Lateral threat spines — shorter spines angled outward
    parts.push(...mirrorX(s => {
      const threatParts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const zPos = len * (0.15 - i * 0.15);
        threatParts.push(place(
          new THREE.ConeGeometry(w * 0.015, h * 0.30, 3),
          s * w * 0.35, h * 0.30, zPos,
          0, 0, s * 0.4,
        ));
      }
      return merge(threatParts);
    }));
  }

  // ── 29. LEVIATHAN ENGINE ARRAY — Dense caudal cluster ─────────────────
  // At maximum scale the caudal cluster becomes a dense radial array of
  // bio-jets — a full ring plus central orifice.
  if (cx >= 7) {
    // Outer engine ring
    const outerCount = 8;
    for (let i = 0; i < outerCount; i++) {
      const angle = (i / outerCount) * PI * 2;
      const ringR = w * 0.20;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.03, len * 0.05, 5),
        Math.cos(angle) * ringR,
        Math.sin(angle) * ringR,
        -len * 0.60,
        -HALF_PI, 0, 0,
      ));
    }
    // Ring connecting band
    parts.push(place(
      new THREE.TorusGeometry(w * 0.20, w * 0.012, 4, 10),
      0, 0, -len * 0.58,
      HALF_PI, 0, 0,
    ));
    // Tail fin extensions — paired vertical and horizontal blades
    parts.push(place(
      new THREE.ConeGeometry(w * 0.015, len * 0.10, 4),
      0, h * 0.12, -len * 0.55,
      0, 0, 0,
      1, 0.12, 1,
    ));
    parts.push(place(
      new THREE.ConeGeometry(w * 0.015, len * 0.10, 4),
      0, -h * 0.12, -len * 0.55,
      0, 0, PI,
      1, 0.12, 1,
    ));
  }

  // ── 30. ABYSSAL DEPTH-CALLER GLYPHS — Hull ornamentation ─────────────
  // On the very largest ships, raised bioceramic ridges trace patterns on
  // the hull surface — old trench glyphs, pressure-forged cultural markers.
  if (cx >= 8) {
    // Lateral glyph ridges — raised lines on hull flanks
    for (let i = 0; i < 4; i++) {
      const zPos = len * (0.18 - i * 0.12);
      parts.push(...mirrorX(s => place(
        new THREE.BoxGeometry(w * 0.25, h * 0.015, len * 0.015),
        s * w * 0.46, h * 0.06, zPos,
        0, 0, s * 0.10,
      )));
    }
    // Dorsal glyph spirals — small ridges curving around the command blister
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      const glyphR = w * 0.22;
      parts.push(place(
        new THREE.BoxGeometry(w * 0.015, h * 0.015, len * 0.04),
        Math.cos(angle) * glyphR, h * 0.36 + Math.sin(angle) * glyphR * 0.5, len * 0.12,
        0, angle * 0.5, 0,
      ));
    }
    // Ventral ritual scarring — parallel lines on the belly
    for (let i = 0; i < 3; i++) {
      parts.push(place(
        new THREE.BoxGeometry(w * 0.35, h * 0.01, len * 0.01),
        0, -h * 0.50, len * (0.10 - i * 0.12),
      ));
    }
    // Extended photophore clusters at glyph intersections
    for (let i = 0; i < 3; i++) {
      const zPos = len * (0.15 - i * 0.14);
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.025, 5, 4),
        s * w * 0.48, h * 0.08, zPos,
      )));
    }
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getDrakmariHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.18;
  const h = len * 0.16;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Caudal engine cluster — bio-jet fan (always present) ──────────────────
  // Radial fan of bio-jets at the tail terminus.
  const engineCount = Math.min(2 + Math.floor(cx * 0.8), 7);
  const fanSpread = cx >= 5 ? Math.PI * 1.6 : Math.PI * 1.2;
  for (let i = 0; i < engineCount; i++) {
    const angle = (i - (engineCount - 1) / 2) * (fanSpread / Math.max(engineCount - 1, 1));
    const ex = Math.sin(angle) * w * 0.14;
    const ey = Math.cos(angle) * h * 0.10;
    engines.push({
      position: new THREE.Vector3(ex, ey, -len * 0.615),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.04,
    });
  }

  // ── Leviathan outer engine ring (cx >= 7) ─────────────────────────────────
  if (cx >= 7) {
    const outerCount = 8;
    const ringR = w * 0.20;
    for (let i = 0; i < outerCount; i++) {
      const angle = (i / outerCount) * Math.PI * 2;
      engines.push({
        position: new THREE.Vector3(
          Math.cos(angle) * ringR,
          Math.sin(angle) * ringR,
          -len * 0.60,
        ),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.03,
      });
    }
  }

  // ── Mandible tip emitters — jaw weapons (cx >= 4) ─────────────────────────
  if (cx >= 4) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.18, -h * 0.12, len * 0.55),
        facing: 'fore',
        normal: new THREE.Vector3(0, 0, 1),
      });
    }
  }

  // ── Spine-mounted weapon projectors — dorsal armament (cx >= 3) ───────────
  if (cx >= 3) {
    const weaponCount = Math.min(1 + Math.floor(cx / 2), 4);
    for (let i = 0; i < weaponCount; i++) {
      const zPos = len * (0.15 - i * 0.14);
      weapons.push({
        position: new THREE.Vector3(0, h * 0.72, zPos),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }

    // Lateral weapon spines — flanking broadside
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.74, h * 0.16, len * 0.12),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }
  }

  // ── Ventral launch bays — torpedo slits (cx >= 3) ─────────────────────────
  if (cx >= 3) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.18, -h * 0.48, len * 0.04),
        facing: 'fore',
        normal: new THREE.Vector3(0, 0, 1),
      });
    }
  }

  // ── Heavy ventral weapon bay (cx >= 5) ────────────────────────────────────
  if (cx >= 5) {
    weapons.push({
      position: new THREE.Vector3(0, -h * 0.55, len * 0.05),
      facing: 'fore',
      normal: new THREE.Vector3(0, -1, 0),
    });
  }

  return { engines, weapons };
}

registerHardpointProvider('drakmari', getDrakmariHardpoints);
