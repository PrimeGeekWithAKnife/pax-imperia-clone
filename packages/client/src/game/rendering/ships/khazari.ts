import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../shipHardpoints';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  KHAZARI SHIP DESIGN — "The Anvil Fleet"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  DESIGN THEORY
 *  ─────────────
 *
 *  The Khazari evolved on Drakenforge, a volcanic world of crushing 1.8G gravity,
 *  rivers of molten basalt, and sulphur dioxide atmospheres. They are silicon-based
 *  forge-smiths who regard shipbuilding as the highest art. Every vessel is a signed
 *  masterwork. Their word for colonisation — vrekash — means "to claim a forge."
 *  This is not a civilisation that builds ships. This is a civilisation of ships.
 *
 *  VISUAL LANGUAGE: THE FORGED AESTHETIC
 *
 *  Khazari ships look FORGED, not assembled. Where Teranos hulls are welded plates
 *  and Nexari ships are printed circuits, Khazari vessels appear to have been beaten
 *  into shape on a planetary anvil. The key visual motif is the TRAPEZOID — every
 *  cross-section is wider at the base than the top, like an anvil or an ingot still
 *  cooling from the forge. Nothing is perfectly rectangular. Edges are chamfered as
 *  if struck by a hammer. The hull tapers forward into a brutal RAM PROW — a
 *  four-sided pyramid point that serves as both a weapon and a cultural statement:
 *  "We will walk through you."
 *
 *  HULL CONSTRUCTION: LAYERED FORGEWORK
 *
 *  Hulls are built from overlapping trapezoidal plates, each slightly offset, giving
 *  the ship a layered, laminated appearance — like damascus steel viewed edge-on.
 *  Larger ships have more visible plate layers. The central spine is always the
 *  thickest, heaviest element, running bow to stern like a ship's keel — except this
 *  keel is on TOP, a dorsal ridge that doubles as a structural backbone and a
 *  radiator for the forge-reactors within. On capital ships, this dorsal ridge
 *  becomes a pronounced CREST, like the spine of a dragon or the comb of a helm.
 *
 *  WEAPONS: SIEGE MENTALITY
 *
 *  Khazari weapons reflect their forge heritage. Turrets are heavy, blocky octagonal
 *  platforms topped with short thick barrels — these are not elegant railguns but
 *  brutal mass-drivers that hurl molten slugs. The turret bases are wider than they
 *  are tall (anvil proportions again). On capital ships, the main batteries are
 *  mounted in SPONSONS — armoured bulges that project from the hull sides, giving
 *  broadside capability. The prow itself is always weaponised: fighters have a simple
 *  battering ram, while battleships carry a reinforced siege ram with visible heat
 *  channels etched along its surface. Weapon colour is amber-orange: the glow of
 *  molten metal being worked.
 *
 *  ENGINES: FORGE-FURNACE DRIVES
 *
 *  Khazari engines are visually heavy — fat hexagonal cylinders that flare wider at
 *  the exhaust, like crucibles tipped on their side. They are always paired or
 *  clustered in even numbers (forge-symmetry is sacred). The exhaust glow is deep
 *  amber-orange, not the blue-white of efficient drives — Khazari propulsion runs
 *  hot and dirty, burning through fuel like a blast furnace. Larger ships have
 *  additional smaller manoeuvring furnaces mounted on lateral struts.
 *
 *  SCALING: FIGHTER TO CAPITAL
 *
 *  - Fighters (cx 0-1): A single forged wedge with ram prow, dorsal fin, keel plate,
 *    and paired forge-furnace engines. Minimum 6 distinct parts — even the smallest
 *    Khazari craft is unmistakably forged. The silhouette is a heavy arrowhead.
 *  - Corvettes/Destroyers (cx 2): The wedge gains overlapping side armour plates and
 *    a pronounced dorsal ridge. A forward turret appears. Four engines on struts.
 *    Forge seam lines become visible along the hull flanks.
 *  - Cruisers (cx 3-4): Multiple turrets on octagonal bases, visible sponson bulges,
 *    the dorsal crest becomes a towering spine. Reinforced keel plate underneath.
 *    Heavy ram prow with heat-channel grooves. Six engines on lateral struts.
 *    A command tower rises behind the crest. 12+ parts minimum.
 *  - Capitals (cx 5+): Full siege configuration. Massive dorsal crest with buttress
 *    ribs. Heavy broadside sponsons with their own turrets and barrels. Multiple
 *    turret decks dorsal and ventral. Auxiliary flanking rams. The hull has visible
 *    forge-glow seam ridges between plate layers. Eight or more engines with torus
 *    flare rings. Ventral gun galleries, lateral manoeuvring furnaces, heavy keel
 *    reinforcement. 20+ parts minimum.
 *  - Super-capitals (cx 7+): Forge-ring reactor torus, additional engine nacelle
 *    pods, point-defence batteries, and a massive forward siege lance. 30+ parts.
 *
 *  INSTANT RECOGNITION
 *
 *  You know it is Khazari from across the battlefield because of three things:
 *  1. The TRAPEZOIDAL cross-section — wider base, narrower top, anvil-shaped.
 *  2. The DORSAL CREST — no other species has that aggressive spine ridge.
 *  3. The RAM PROW — a pointed, four-faced pyramid leading every ship.
 *  The overall impression is of a flying anvil that has been sharpened to a point.
 *
 *  MATERIAL: FORGE-DARKENED IRON
 *
 *  The hull material is dark iron-brown (0x554433) with high metalness (0.85) and
 *  moderate roughness (0.65) — this is not polished chrome but heat-treated alloy,
 *  the colour of a blade fresh from quenching. The emissive glow is amber forge-
 *  light (0xff6600) at 0.25 intensity, visible along plate seams and weapon ports.
 *  In motion, Khazari ships look like they are still cooling from the forge.
 */

export function buildKhazari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.45;   // wide, heavy — built for 1.8G gravity
  const h = len * 0.32;   // tall profile to carry the dorsal crest
  const parts: THREE.BufferGeometry[] = [];

  // ════════════════════════════════════════════════════════════════════════════
  //  ALWAYS PRESENT — even the smallest Khazari fighter has these (cx >= 0)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 1. MAIN HULL — Trapezoidal forged cross-section ────────────────────
  // The defining Khazari shape: wide base, narrow top, chamfered edges.
  // Extruded as a trapezoid running 60% of total length.
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-w * 0.50, -h * 0.42);   // bottom-left
  hullShape.lineTo( w * 0.50, -h * 0.42);   // bottom-right
  hullShape.lineTo( w * 0.34,  h * 0.32);   // top-right (narrower)
  hullShape.lineTo(-w * 0.34,  h * 0.32);   // top-left (narrower)
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: len * 0.58,
    bevelEnabled: true,
    bevelThickness: len * 0.018,
    bevelSize: len * 0.012,
    bevelSegments: 1,
  });
  parts.push(place(hullGeo, 0, 0, -len * 0.28));

  // ── 2. RAM PROW — Four-sided siege pyramid ─────────────────────────────
  // Every Khazari ship, even a fighter, has a ram. The point faces +Z.
  // 4 radial segments give the diamond-faced pyramid look.
  const ramLen = len * (0.22 + cx * 0.018);
  parts.push(place(
    new THREE.ConeGeometry(w * 0.34, ramLen, 4),
    0, -h * 0.05, len * 0.30 + ramLen * 0.50,
    HALF_PI, PI * 0.25, 0,
  ));
  // Ram collar — trapezoidal ring where the prow meets the hull
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.28, w * 0.38, len * 0.04, 4),
    0, -h * 0.05, len * 0.30,
    HALF_PI, PI * 0.25, 0,
  ));

  // ── 3. DORSAL CREST — The signature spine ridge ────────────────────────
  // A triangular prism running bow-to-stern on the dorsal surface.
  // Even on fighters this is a visible fin; on capitals it towers.
  const crestH = h * (0.18 + cx * 0.045);
  const crestLen = len * (0.45 + cx * 0.015);
  const crestShape = new THREE.Shape();
  crestShape.moveTo(0, 0);
  crestShape.lineTo(-w * 0.10, -crestH);
  crestShape.lineTo( w * 0.10, -crestH);
  crestShape.closePath();
  const crestGeo = new THREE.ExtrudeGeometry(crestShape, {
    depth: crestLen,
    bevelEnabled: false,
  });
  parts.push(place(crestGeo, 0, h * 0.32, -len * 0.22));

  // ── 4. VENTRAL KEEL PLATE — Heavy underside reinforcement ─────────────
  // The keel is the structural backbone underneath — present on all ships.
  // Wider than the dorsal crest, it gives that bottom-heavy anvil look.
  parts.push(place(
    new THREE.BoxGeometry(w * 0.70, h * 0.07, len * 0.50),
    0, -h * 0.46, 0,
  ));

  // ── 5. ENGINE NACELLES — Hexagonal forge-furnaces ─────────────────────
  // Fat hexagonal cylinders flaring at the exhaust. Always in pairs.
  const engineCount = 2 + Math.floor(cx / 2) * 2;  // 2, 4, 6, 8...
  const engineSpacing = w * 0.95 / Math.max(engineCount - 1, 1);
  for (let i = 0; i < engineCount; i++) {
    const ex = (i - (engineCount - 1) / 2) * engineSpacing;
    // Main engine bell — hexagonal, wider at exhaust
    parts.push(place(
      new THREE.CylinderGeometry(h * 0.13, h * 0.20, len * 0.15, 6),
      ex, -h * 0.12, -len * 0.46,
      HALF_PI, 0, 0,
    ));
    // Exhaust torus flare ring — glowing rim at the aft
    parts.push(place(
      new THREE.TorusGeometry(h * 0.18, h * 0.028, 6, 6),
      ex, -h * 0.12, -len * 0.535,
      HALF_PI, 0, 0,
    ));
  }

  // ── 6. HULL CHEEK PLATES — Flanking armour on every ship ──────────────
  // Even the smallest fighter has a pair of trapezoidal cheek plates
  // along the lower hull, giving the distinctive layered silhouette.
  parts.push(...mirrorX(s => {
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(0, -h * 0.30);
    cheekShape.lineTo(w * 0.10, -h * 0.25);
    cheekShape.lineTo(w * 0.10,  h * 0.05);
    cheekShape.lineTo(0,  h * 0.10);
    cheekShape.closePath();
    const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
      depth: len * 0.35,
      bevelEnabled: false,
    });
    return place(cheekGeo, s * w * 0.48, 0, -len * 0.15);
  }));

  // ════════════════════════════════════════════════════════════════════════════
  //  cx >= 1: ENHANCED FIGHTER / CORVETTE DETAIL
  // ════════════════════════════════════════════════════════════════════════════

  if (cx >= 1) {
    // ── 7. PROW HEAT CHANNELS — Grooves etched into the ram ────────────
    // Two ridges running along the ram sides, suggesting forge heat lines.
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.03, h * 0.04, ramLen * 0.70),
      s * w * 0.15, -h * 0.05, len * 0.30 + ramLen * 0.25,
    )));

    // ── 8. AFT HULL TAPER — Stepped rear section ──────────────────────
    // A narrower trapezoidal block behind the main hull, giving the stern
    // a stepped-down profile before the engines.
    parts.push(place(
      new THREE.BoxGeometry(w * 0.75, h * 0.55, len * 0.10),
      0, -h * 0.08, -len * 0.35,
    ));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  cx >= 2: DESTROYER — Armour layers, struts, forward turret
  // ════════════════════════════════════════════════════════════════════════════

  if (cx >= 2) {
    // ── 9. OVERLAPPING SIDE ARMOUR — Damascus steel layering ──────────
    // Trapezoidal plates bolted to each flank. More layers on bigger ships.
    const plateCount = Math.max(1, Math.floor(cx / 2));
    for (let i = 0; i < plateCount; i++) {
      const plateZ = -len * 0.12 + i * len * 0.13;
      const plateW = w * 0.10;
      const plateH = h * 0.60;
      const plateD = len * 0.16;
      parts.push(...mirrorX(s => place(
        new THREE.BoxGeometry(plateW, plateH, plateD),
        s * (w * 0.54 + i * w * 0.05), -h * 0.06, plateZ,
      )));
    }

    // ── 10. ENGINE LATERAL STRUTS — Heavy support beams ──────────────
    // Trapezoidal cross-section connecting outboard engines to hull.
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.55, h * 0.08, len * 0.07),
      s * w * 0.22, -h * 0.12, -len * 0.43,
    )));

    // ── 11. FORWARD DORSAL TURRET — Primary weapon ───────────────────
    // Octagonal turret base (wider than tall) with a single heavy barrel.
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.15, w * 0.20, h * 0.14, 8),
      0, h * 0.32 + crestH * 0.35, len * 0.14,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.05, w * 0.05, len * 0.14, 6),
      0, h * 0.32 + crestH * 0.35, len * 0.24,
      HALF_PI, 0, 0,
    ));

    // ── 12. FORGE SEAM LINES — Horizontal hull ridges ────────────────
    // Subtle raised lines running along the flanks, suggesting plate joins.
    for (let i = 0; i < 2; i++) {
      const seamZ = -len * 0.10 + i * len * 0.20;
      parts.push(place(
        new THREE.BoxGeometry(w * 0.90, h * 0.025, len * 0.012),
        0, h * 0.02, seamZ,
      ));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  cx >= 3: CRUISER — Broadside turrets, reinforced keel, command tower
  // ════════════════════════════════════════════════════════════════════════════

  if (cx >= 3) {
    // ── 13. BROADSIDE TURRETS — Flanking weapon mounts ───────────────
    // Octagonal bases wider than tall, each with a stubby barrel.
    parts.push(...mirrorX(s => {
      const tParts: THREE.BufferGeometry[] = [];
      tParts.push(place(
        new THREE.CylinderGeometry(w * 0.11, w * 0.15, h * 0.12, 8),
        s * w * 0.48, h * 0.18, len * 0.04,
      ));
      tParts.push(place(
        new THREE.CylinderGeometry(w * 0.035, w * 0.035, len * 0.12, 6),
        s * w * 0.48, h * 0.18, len * 0.12,
        HALF_PI, 0, 0,
      ));
      return merge(tParts);
    }));

    // ── 14. REINFORCED KEEL ARMOUR — Heavy ventral slab ──────────────
    // The thick keel plate extends further than the baseline one.
    parts.push(place(
      new THREE.BoxGeometry(w * 0.88, h * 0.08, len * 0.58),
      0, -h * 0.50, -len * 0.02,
    ));

    // ── 15. COMMAND TOWER — Stepped bridge behind dorsal crest ───────
    // A squat trapezoidal block rising from behind the crest.
    parts.push(place(
      new THREE.BoxGeometry(w * 0.28, h * 0.22, len * 0.09),
      0, h * 0.44 + crestH * 0.55, -len * 0.02,
    ));
    // Bridge viewport slit
    parts.push(place(
      new THREE.BoxGeometry(w * 0.22, h * 0.04, len * 0.012),
      0, h * 0.50 + crestH * 0.55, len * 0.035,
    ));

    // ── 16. LATERAL FORGE SEAMS — Additional heat channel ridges ─────
    for (let i = 0; i < 3; i++) {
      const seamZ = -len * 0.15 + i * len * 0.15;
      parts.push(place(
        new THREE.BoxGeometry(w * 0.98, h * 0.022, len * 0.010),
        0, h * 0.06, seamZ,
      ));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  cx >= 4: HEAVY CRUISER — Aft turrets, manoeuvring furnaces, heavier prow
  // ════════════════════════════════════════════════════════════════════════════

  if (cx >= 4) {
    // ── 17. AFT TURRET PAIR — Secondary batteries ────────────────────
    parts.push(...mirrorX(s => {
      const aftParts: THREE.BufferGeometry[] = [];
      aftParts.push(place(
        new THREE.CylinderGeometry(w * 0.10, w * 0.14, h * 0.11, 8),
        s * w * 0.36, h * 0.30, -len * 0.16,
      ));
      aftParts.push(place(
        new THREE.CylinderGeometry(w * 0.032, w * 0.032, len * 0.10, 6),
        s * w * 0.36, h * 0.30, -len * 0.08,
        HALF_PI, 0, 0,
      ));
      return merge(aftParts);
    }));

    // ── 18. AFT DORSAL TURRET — Heavy centreline battery ─────────────
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.13, w * 0.17, h * 0.15, 8),
      0, h * 0.34 + crestH * 0.25, -len * 0.12,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.04, len * 0.12, 6),
      0, h * 0.34 + crestH * 0.25, -len * 0.03,
      HALF_PI, 0, 0,
    ));

    // ── 19. LATERAL MANOEUVRING FURNACES — Small thruster pods ───────
    // Hexagonal mini-engines angled outward on bow and stern.
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(h * 0.055, h * 0.08, len * 0.045, 6),
      s * w * 0.58, 0, len * 0.18,
      0, 0, s * PI * 0.12,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(h * 0.055, h * 0.08, len * 0.045, 6),
      s * w * 0.58, 0, -len * 0.22,
      0, 0, s * PI * 0.12,
    )));

    // ── 20. PROW REINFORCEMENT — Heavier ram collar on bigger ships ──
    // An additional trapezoidal ring giving the prow extra bulk.
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.32, w * 0.42, len * 0.05, 4),
      0, -h * 0.05, len * 0.28,
      HALF_PI, PI * 0.25, 0,
    ));

    // ── 21. DORSAL CREST BUTTRESSES — Structural ribs along the spine ─
    // Short fins angled outward from the crest, like hammer-forged ribs.
    for (let i = 0; i < 3; i++) {
      const bz = -len * 0.10 + i * len * 0.12;
      parts.push(...mirrorX(s => place(
        new THREE.BoxGeometry(w * 0.06, crestH * 0.60, len * 0.02),
        s * w * 0.14, h * 0.32 + crestH * 0.30, bz,
        0, 0, s * 0.25,
      )));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  cx >= 5: CAPITAL SHIP — Full siege configuration, 20+ parts
  // ════════════════════════════════════════════════════════════════════════════

  if (cx >= 5) {
    // ── 22. HEAVY BROADSIDE SPONSONS — Armoured gun platforms ────────
    // Projecting bulges on each flank with their own turrets and barrels.
    parts.push(...mirrorX(s => {
      const sponsonParts: THREE.BufferGeometry[] = [];
      // Sponson hull — trapezoidal armoured bulge
      const spShape = new THREE.Shape();
      spShape.moveTo(0, -h * 0.22);
      spShape.lineTo(w * 0.16, -h * 0.17);
      spShape.lineTo(w * 0.16,  h * 0.08);
      spShape.lineTo(0,  h * 0.13);
      spShape.closePath();
      const spGeo = new THREE.ExtrudeGeometry(spShape, {
        depth: len * 0.28,
        bevelEnabled: false,
      });
      sponsonParts.push(place(spGeo, s * w * 0.50, 0, -len * 0.06));
      // Sponson turret — octagonal, wider base
      sponsonParts.push(place(
        new THREE.CylinderGeometry(w * 0.09, w * 0.12, h * 0.10, 8),
        s * (w * 0.56 + w * 0.09), h * 0.10, len * 0.02,
      ));
      // Sponson barrel
      sponsonParts.push(place(
        new THREE.CylinderGeometry(w * 0.028, w * 0.028, len * 0.15, 6),
        s * (w * 0.56 + w * 0.09), h * 0.10, len * 0.10,
        HALF_PI, 0, 0,
      ));
      return merge(sponsonParts);
    }));

    // ── 23. AUXILIARY RAMS — Flanking prow blades ────────────────────
    // Smaller ram pyramids flanking the main prow on capital ships.
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.14, len * 0.16, 4),
      s * w * 0.32, -h * 0.12, len * 0.38,
      HALF_PI, PI * 0.25, 0,
    )));

    // ── 24. VENTRAL GUN GALLERY — Underslung turret array ────────────
    // Three turrets along the ship's belly for anti-fighter work.
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.11, h * 0.09, 8),
      s * w * 0.28, -h * 0.54, len * 0.08,
    )));
    // Centre ventral heavy turret
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.11, w * 0.15, h * 0.11, 8),
      0, -h * 0.56, -len * 0.02,
    ));
    // Centre ventral barrel
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.035, w * 0.035, len * 0.12, 6),
      0, -h * 0.56, len * 0.05,
      HALF_PI, 0, 0,
    ));

    // ── 25. FORGE-GLOW SEAM RIDGES — Visible heat channels ──────────
    // Prominent horizontal ridges across the hull suggesting plate joins.
    for (let i = 0; i < 4; i++) {
      const seamZ = -len * 0.20 + i * len * 0.13;
      parts.push(place(
        new THREE.BoxGeometry(w * 1.02, h * 0.025, len * 0.012),
        0, h * 0.04, seamZ,
      ));
    }

    // ── 26. DORSAL CREST SERRATIONS — Saw-tooth caps on the spine ────
    // Small triangular teeth along the crest peak, giving a serrated look.
    for (let i = 0; i < 5; i++) {
      const sz = -len * 0.18 + i * len * 0.09;
      const toothH = crestH * 0.30;
      const toothShape = new THREE.Shape();
      toothShape.moveTo(0, 0);
      toothShape.lineTo(-w * 0.03, -toothH);
      toothShape.lineTo( w * 0.03, -toothH);
      toothShape.closePath();
      const toothGeo = new THREE.ExtrudeGeometry(toothShape, {
        depth: len * 0.025,
        bevelEnabled: false,
      });
      parts.push(place(toothGeo, 0, h * 0.32 + crestH, sz));
    }

    // ── 27. HEAVY KEEL REINFORCEMENT — Double-thick ventral armour ───
    parts.push(place(
      new THREE.BoxGeometry(w * 0.95, h * 0.10, len * 0.62),
      0, -h * 0.52, -len * 0.02,
    ));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  cx >= 6: BATTLESHIP — Additional turret decks, heavier everything
  // ════════════════════════════════════════════════════════════════════════════

  if (cx >= 6) {
    // ── 28. SECONDARY BROADSIDE TURRETS — Lower tier flanking guns ───
    parts.push(...mirrorX(s => {
      const t2Parts: THREE.BufferGeometry[] = [];
      t2Parts.push(place(
        new THREE.CylinderGeometry(w * 0.09, w * 0.12, h * 0.10, 8),
        s * w * 0.52, -h * 0.15, -len * 0.10,
      ));
      t2Parts.push(place(
        new THREE.CylinderGeometry(w * 0.030, w * 0.030, len * 0.10, 6),
        s * w * 0.52, -h * 0.15, -len * 0.02,
        HALF_PI, 0, 0,
      ));
      return merge(t2Parts);
    }));

    // ── 29. ADDITIONAL ENGINE NACELLE PODS — Outboard thrust ─────────
    // Extra engine pods on outrigger struts for super-heavy ships.
    parts.push(...mirrorX(s => {
      const nacParts: THREE.BufferGeometry[] = [];
      // Outrigger strut
      nacParts.push(place(
        new THREE.BoxGeometry(w * 0.18, h * 0.06, len * 0.06),
        s * w * 0.62, -h * 0.08, -len * 0.44,
      ));
      // Outboard engine bell
      nacParts.push(place(
        new THREE.CylinderGeometry(h * 0.10, h * 0.16, len * 0.12, 6),
        s * w * 0.72, -h * 0.08, -len * 0.48,
        HALF_PI, 0, 0,
      ));
      // Outboard flare ring
      nacParts.push(place(
        new THREE.TorusGeometry(h * 0.14, h * 0.024, 6, 6),
        s * w * 0.72, -h * 0.08, -len * 0.54,
        HALF_PI, 0, 0,
      ));
      return merge(nacParts);
    }));

    // ── 30. DORSAL SENSOR MOUND — Armoured observation blister ───────
    // A flattened dome behind the command tower.
    parts.push(place(
      new THREE.SphereGeometry(w * 0.10, 6, 4),
      0, h * 0.55 + crestH * 0.50, -len * 0.10,
      0, 0, 0,
      1.0, 0.5, 1.0,  // squashed vertically — heavy, not delicate
    ));

    // ── 31. VENTRAL MISSILE RACKS — Heavy ordnance bays ─────────────
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.18, h * 0.14, len * 0.20),
      s * w * 0.38, -h * 0.60, len * 0.00,
    )));

    // ── 32. POINT DEFENCE BUMPS — Small domes along hull edges ───────
    for (let z = -0.15; z <= 0.15; z += 0.15) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.04, 4, 3),
        s * w * 0.56, h * 0.28, len * z,
      )));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  cx >= 7: SUPER-CAPITAL / STATION — Forge ring, siege lance, max detail
  // ════════════════════════════════════════════════════════════════════════════

  if (cx >= 7) {
    // ── 33. FORGE-REACTOR RING — Torus around the midsection ─────────
    // A massive glowing ring encircling the hull like a forge crucible.
    parts.push(place(
      new THREE.TorusGeometry(w * 0.85, w * 0.09, 6, 8),
      0, 0, -len * 0.05,
      HALF_PI, 0, 0,
    ));
    // Ring support spars — four heavy struts connecting ring to hull
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * PI * 2 + PI * 0.25;
      const rx = Math.cos(angle) * w * 0.42;
      const ry = Math.sin(angle) * w * 0.42;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.025, w * 0.025, w * 0.70, 4),
        rx, ry, -len * 0.05,
        0, 0, angle + HALF_PI,
      ));
    }

    // ── 34. FORWARD SIEGE LANCE — Massive spinal weapon ──────────────
    // A long heavy barrel emerging from the prow, for planet bombardment.
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.07, w * 0.12, len * 0.25, 8),
      0, -h * 0.05, len * 0.42 + ramLen * 0.30,
      HALF_PI, 0, 0,
    ));
    // Siege lance muzzle ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.10, w * 0.02, 6, 8),
      0, -h * 0.05, len * 0.42 + ramLen * 0.30 + len * 0.125,
      HALF_PI, 0, 0,
    ));

    // ── 35. TERTIARY DORSAL TURRETS — Additional gun platforms ───────
    parts.push(...mirrorX(s => {
      const t3Parts: THREE.BufferGeometry[] = [];
      t3Parts.push(place(
        new THREE.CylinderGeometry(w * 0.08, w * 0.10, h * 0.08, 8),
        s * w * 0.25, h * 0.38, len * 0.20,
      ));
      t3Parts.push(place(
        new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.08, 6),
        s * w * 0.25, h * 0.38, len * 0.26,
        HALF_PI, 0, 0,
      ));
      return merge(t3Parts);
    }));

    // ── 36. HULL ARMOURING BANDS — Extra plate layers for siege work ─
    // Thick trapezoidal bands girdling the hull at intervals.
    for (let i = 0; i < 3; i++) {
      const bz = -len * 0.18 + i * len * 0.16;
      const bandShape = new THREE.Shape();
      bandShape.moveTo(-w * 0.54, -h * 0.44);
      bandShape.lineTo( w * 0.54, -h * 0.44);
      bandShape.lineTo( w * 0.38,  h * 0.34);
      bandShape.lineTo(-w * 0.38,  h * 0.34);
      bandShape.closePath();
      const bandGeo = new THREE.ExtrudeGeometry(bandShape, {
        depth: len * 0.025,
        bevelEnabled: false,
      });
      parts.push(place(bandGeo, 0, 0, bz));
    }

    // ── 37. LATERAL HANGAR BAYS — Recessed launch openings ──────────
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.14, h * 0.30, len * 0.16),
      s * w * 0.58, -h * 0.10, -len * 0.22,
    )));
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getKhazariHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.45;
  const h = len * 0.32;
  const crestH = h * (0.18 + cx * 0.045);
  const ramLen = len * (0.22 + cx * 0.018);
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Main forge-furnace engines ────────────────────────────────────────────
  // Paired hexagonal nacelles at stern, matching builder section 5.
  const engineCount = 2 + Math.floor(cx / 2) * 2;
  const engineSpacing = w * 0.95 / Math.max(engineCount - 1, 1);
  for (let i = 0; i < engineCount; i++) {
    const ex = (i - (engineCount - 1) / 2) * engineSpacing;
    engines.push({
      position: new THREE.Vector3(ex, -h * 0.12, -len * 0.535),
      direction: new THREE.Vector3(0, 0, -1),
      radius: h * 0.18,
    });
  }

  // ── Outboard engine nacelle pods (cx >= 6) ────────────────────────────────
  if (cx >= 6) {
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.72, -h * 0.08, -len * 0.54),
        direction: new THREE.Vector3(0, 0, -1),
        radius: h * 0.14,
      });
    }
  }

  // ── Forward dorsal turret (cx >= 2) ───────────────────────────────────────
  if (cx >= 2) {
    weapons.push({
      position: new THREE.Vector3(0, h * 0.32 + crestH * 0.35, len * 0.14),
      facing: 'dorsal',
      normal: new THREE.Vector3(0, 1, 0),
    });
  }

  // ── Broadside turrets (cx >= 3) ──────────────────────────────────────────
  if (cx >= 3) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.48, h * 0.18, len * 0.04),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }
  }

  // ── Aft turret pair + aft dorsal turret (cx >= 4) ─────────────────────────
  if (cx >= 4) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.36, h * 0.30, -len * 0.16),
        facing: 'turret',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
    weapons.push({
      position: new THREE.Vector3(0, h * 0.34 + crestH * 0.25, -len * 0.12),
      facing: 'dorsal',
      normal: new THREE.Vector3(0, 1, 0),
    });
  }

  // ── Heavy broadside sponson turrets (cx >= 5) ────────────────────────────
  if (cx >= 5) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * (w * 0.56 + w * 0.09), h * 0.10, len * 0.02),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }
    // Ventral gun gallery turrets
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.28, -h * 0.54, len * 0.08),
        facing: 'turret',
        normal: new THREE.Vector3(0, -1, 0),
      });
    }
    // Centre ventral heavy turret
    weapons.push({
      position: new THREE.Vector3(0, -h * 0.56, -len * 0.02),
      facing: 'turret',
      normal: new THREE.Vector3(0, -1, 0),
    });
  }

  // ── Secondary broadside turrets (cx >= 6) ────────────────────────────────
  if (cx >= 6) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.52, -h * 0.15, -len * 0.10),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }
  }

  // ── Forward siege lance + tertiary dorsal turrets (cx >= 7) ───────────────
  if (cx >= 7) {
    weapons.push({
      position: new THREE.Vector3(0, -h * 0.05, len * 0.42 + ramLen * 0.30 + len * 0.125),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.25, h * 0.38, len * 0.20),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
  }

  return { engines, weapons };
}

registerHardpointProvider('khazari', getKhazariHardpoints);
