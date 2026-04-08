import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../ShipModels3D';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  TERANOS SHIP DESIGN THEORY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  The Teranos are the galaxy's generalists -- unremarkable in every
 *  individual metric, dangerous in aggregate. They evolved on a mild,
 *  comfortable world that barely tested them. They have no natural armour,
 *  no venom, no psionic gifts. They are soft-bodied, short-lived,
 *  emotionally volatile primates whose primary advantages are accurate
 *  throwing arms and the ability to cooperate in groups of about 150.
 *  Their culture is defined by contradiction: they build hospitals and
 *  concentration camps with equal engineering skill. They are unpredictable,
 *  adaptive, and fast.
 *
 *  VISUAL LANGUAGE: "Pragmatic Layering"
 *  Teranos ships are built the way humans build -- not from a single elegant
 *  design philosophy, but from COMMITTEES. There is no unified aesthetic
 *  because there is no unified culture. Instead, Teranos ships have a
 *  distinctive "evolved" look: a core hull that is sensible and boxy, with
 *  layers of later additions bolted, welded, and retrofitted on top. Antenna
 *  arrays that were clearly afterthoughts. Weapon hardpoints that look like
 *  they were designed by a different department than the hull. Armour plating
 *  that overlaps at odd angles because it was upgraded three times by three
 *  different contractors.
 *
 *  The result is ships that look BUSY -- not chaotic like Ashkari scrapheaps,
 *  not messy like battle damage, but layered with visible history. Every
 *  Teranos ship looks like it has been refitted at least twice. There are
 *  seam lines where new hull sections were welded to old ones. There are
 *  asymmetric sensor clusters because someone decided to add a better array
 *  on the port side and never got round to matching it on starboard.
 *
 *  HULL SHAPES: The core silhouette is a slightly tapered box -- wider at
 *  the stern (engine block) and narrowing towards the bow. Not a pure wedge
 *  like Khazari aggression, not a smooth capsule like Kaelenth precision.
 *  More like a naval destroyer: functional, competent, designed by engineers
 *  who had to satisfy both the admiral and the treasury. The bow features a
 *  distinctive "chin" -- a protruding sensor/deflector assembly that juts
 *  forward beneath the bridge, giving every Teranos ship a slight bulldog
 *  profile. This chin grows larger on bigger ships, becoming a full prow
 *  section on battleships.
 *
 *  WEAPONS: Teranos weapon mounts are MODULAR -- clearly designed to be
 *  swapped. Turret bases are hexagonal platforms (standardised mounting
 *  points) with cylindrical barrels. Smaller ships have flush-mounted
 *  weapon pods; larger ships have raised turret barbettes. Capital ships
 *  sport dorsal spine-mounted heavy weapons -- a long rail or spinal mount
 *  running along the top centreline, the one concession to elegance in an
 *  otherwise utilitarian design. Point-defence clusters appear as small
 *  bumps along the hull edges.
 *
 *  ENGINES: Teranos drives are conventional thrust bells -- conical exhaust
 *  nozzles clustered at the stern in rows. Small ships have 2-3 nozzles;
 *  capital ships have dense banks of 6+. The nozzle arrangement is wider
 *  than the main hull, giving ships a distinctive "broad stern" profile.
 *  Flanking the main engines, manoeuvring thruster housings (small boxes)
 *  are visible at the corners -- purely functional, clearly bolted on.
 *
 *  SCALING: Fighters and scouts are compact, almost stub-nosed -- all
 *  engine and cockpit with minimal extras. Destroyers and frigates begin
 *  showing the layered look with side modules and sensor masts. Cruisers
 *  add the dorsal spine weapon and ventral chin prow. Battleships and
 *  carriers are the full expression: bristling with add-ons, antenna farms,
 *  layered armour, multiple turret platforms, hangar bays -- ships that
 *  look like small cities bolted to an engine block.
 *
 *  RECOGNISABILITY: In combat, Teranos ships are identified by:
 *  1. The bulldog chin/prow jutting forward below the bridge
 *  2. The broad stern with clustered engine bells
 *  3. Visible seam lines and layered plating (asymmetric detail)
 *  4. Hexagonal turret bases (standardised weapon mounts)
 *  5. The dorsal spine weapon on cruiser+ hulls
 *  6. The "committee-designed" busy silhouette -- not sleek, not crude,
 *     but competently cluttered
 *
 *  MATERIALS: Grey-blue steel with a warm emissive undertone. Not chrome-
 *  bright like Kaelenth, not rusty like Ashkari. Think modern warship grey
 *  with subtle blue-steel tint. Moderate metalness, moderate roughness --
 *  the material of a civilisation that mass-produces competently but never
 *  obsesses over finish. The warm emissive (blue-tinged white from running
 *  lights and viewports) gives them a lived-in, operational feel -- these
 *  ships have crews, these ships have mess halls and watch rotations.
 *
 *  CONTRAST WITH OTHER SPECIES:
 *  - vs Khazari: Khazari are aggressive wedges; Teranos are functional boxes
 *  - vs Kaelenth: Kaelenth are polished perfection; Teranos are pragmatic layers
 *  - vs Ashkari: Ashkari are scrapyard chaos; Teranos are ORDERED complexity
 *  - vs Nexari: Nexari are sleek data-optimised; Teranos are human-scale messy
 *  - vs Vaelori: Vaelori are crystalline elegance; Teranos are bolted steel
 *
 *  The Teranos aesthetic says: "We are not the best at anything, but we
 *  are good enough at everything, and we will keep bolting on improvements
 *  until we win." It is the aesthetic of a species that generates thousands
 *  of competing ideas and lets them all leave marks on the hull.
 */

/**
 * Build Teranos ship geometry -- pragmatic layered steel, bulldog chin,
 * broad stern, hexagonal turret mounts, dorsal spine weapon.
 *
 * Part counts by complexity:
 *   cx 0 (probe/satellite)  ~8 parts   -- hull, chin, bridge nub, 2 nozzles, RCS, antenna
 *   cx 1 (fighter/scout)    ~12 parts  -- adds seam lines, dorsal fin, sensor dish
 *   cx 2 (destroyer)        ~18 parts  -- adds side pods, struts, hull plating
 *   cx 3 (frigate)          ~25 parts  -- adds hex turrets, PD clusters, ventral fin
 *   cx 4 (cruiser)          ~35 parts  -- adds antenna farm, weapon pods, comm arrays
 *   cx 5 (battleship)       ~48 parts  -- adds spine weapon, layered armour, hangar
 *   cx 6 (dreadnought)      ~60 parts  -- adds flanking nacelles, sensor dome, keel
 *   cx 7 (station-class)    ~70 parts  -- adds habitat ring, forward array, extra rings
 */
export function buildTeranos(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.28;   // Utilitarian width -- broad-shouldered, functional
  const h = len * 0.22;   // Moderate height -- not flat, not tall
  const parts: THREE.BufferGeometry[] = [];

  // Thin slab helper for panel seam lines
  const seam = (sx: number, sy: number, sz: number,
    px: number, py: number, pz: number,
    rx = 0, ry = 0, rz = 0) =>
    place(new THREE.BoxGeometry(sx, sy, sz), px, py, pz, rx, ry, rz);

  // ── CORE HULL ──────────────────────────────────────────────────────────────
  // Tapered main body: wider at stern, narrowing to bow. Trapezoidal cross-
  // section -- slightly narrower top gives a warship profile.

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-w * 0.50, -h * 0.45);
  hullShape.lineTo(-w * 0.42, h * 0.45);
  hullShape.lineTo(w * 0.42, h * 0.45);
  hullShape.lineTo(w * 0.50, -h * 0.45);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: len * 0.6,
    bevelEnabled: false,
  });
  parts.push(place(hullGeo, 0, 0, -len * 0.25));

  // Hull longitudinal seam lines -- thin raised slabs running bow-to-stern.
  // These are where hull plates were welded together during construction.
  parts.push(seam(w * 0.02, h * 0.02, len * 0.55,  0, h * 0.46, -len * 0.05));  // dorsal centreline
  parts.push(seam(w * 0.02, h * 0.02, len * 0.55,  0, -h * 0.46, -len * 0.05)); // ventral centreline
  parts.push(...mirrorX(s => seam(
    w * 0.015, h * 0.92, h * 0.02,
    s * w * 0.47, 0, len * 0.0,
  ))); // vertical side seams at midships

  // Transverse seam lines -- where hull sections were joined during refit
  for (let z = -0.2; z <= 0.25; z += 0.15) {
    parts.push(seam(w * 1.0, h * 0.015, h * 0.015, 0, h * 0.46, len * z));
  }

  // ── BOW / CHIN ASSEMBLY ────────────────────────────────────────────────────
  // The distinctive Teranos "bulldog chin" -- forward-jutting sensor and
  // deflector housing below the bridge.

  const chinLen = len * (0.12 + cx * 0.015);
  const chinW = w * 0.55;
  const chinH = h * 0.35;
  // Main chin block
  parts.push(place(
    new THREE.BoxGeometry(chinW, chinH, chinLen),
    0, -h * 0.22, len * 0.35 + chinLen * 0.4,
  ));
  // Chin tip -- tapered cone for the deflector array
  parts.push(place(
    new THREE.ConeGeometry(chinH * 0.5, chinLen * 0.5, 6),
    0, -h * 0.22, len * 0.35 + chinLen * 0.85,
    HALF_PI, 0, 0,
  ));
  // Chin underplate -- thin armoured slab beneath the chin
  parts.push(seam(
    chinW * 0.9, h * 0.03, chinLen * 0.85,
    0, -h * 0.22 - chinH * 0.52, len * 0.35 + chinLen * 0.3,
  ));
  // Chin side rails -- small strips along chin edges
  parts.push(...mirrorX(s => seam(
    w * 0.02, chinH * 0.6, chinLen * 0.7,
    s * chinW * 0.52, -h * 0.22, len * 0.35 + chinLen * 0.3,
  )));

  // ── BRIDGE / COMMAND MODULE ────────────────────────────────────────────────
  // Raised command section on top of the hull, slightly forward of centre.
  // Clearly a separate bolted-on module with its own seam lines.

  // Main bridge block
  parts.push(place(
    new THREE.BoxGeometry(w * 0.40, h * 0.32, len * 0.13),
    0, h * 0.41, len * 0.20,
  ));
  // Bridge viewport strip -- thin horizontal window band
  parts.push(seam(w * 0.44, h * 0.05, len * 0.015, 0, h * 0.52, len * 0.275));
  // Bridge roof plate -- slightly wider than the block (overhang)
  parts.push(seam(w * 0.46, h * 0.025, len * 0.14, 0, h * 0.58, len * 0.20));
  // Bridge base flange -- where it bolts to the hull
  parts.push(seam(w * 0.48, h * 0.02, len * 0.15, 0, h * 0.25, len * 0.20));
  // Comms antenna on bridge roof -- short vertical spike
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.008, w * 0.005, h * 0.25, 4),
    w * 0.12, h * 0.72, len * 0.22,
  ));

  // ── ENGINE BLOCK (BROAD STERN) ─────────────────────────────────────────────
  // Wider than the main hull -- the "broad stern" that defines the aft view.

  // Main engine housing
  parts.push(place(
    new THREE.BoxGeometry(w * 1.25, h * 0.85, len * 0.15),
    0, 0, -len * 0.38,
  ));
  // Engine housing top plate (heat shield)
  parts.push(seam(w * 1.3, h * 0.025, len * 0.16, 0, h * 0.44, -len * 0.38));
  // Engine housing seam -- where it attaches to main hull
  parts.push(seam(w * 1.28, h * 0.86, h * 0.02, 0, 0, -len * 0.305));

  // Engine thrust bells -- cylindrical nozzles with cone exhaust
  const nozzleCount = Math.min(2 + Math.floor(cx * 0.8), 7);
  const nozzleSpread = w * 1.1;
  for (let i = 0; i < nozzleCount; i++) {
    const nx = (i - (nozzleCount - 1) / 2) * (nozzleSpread / Math.max(nozzleCount - 1, 1));
    // Cylindrical bell housing
    parts.push(place(
      new THREE.CylinderGeometry(h * 0.10, h * 0.14, len * 0.06, 8),
      nx, 0, -len * 0.48,
      HALF_PI, 0, 0,
    ));
    // Cone exhaust nozzle protruding aft of the bell
    parts.push(place(
      new THREE.ConeGeometry(h * 0.16, len * 0.04, 8),
      nx, 0, -len * 0.525,
      HALF_PI, 0, 0,
    ));
    // Nozzle rim ring -- thin torus at the exhaust lip
    parts.push(place(
      new THREE.TorusGeometry(h * 0.145, h * 0.015, 4, 8),
      nx, 0, -len * 0.545,
      HALF_PI, 0, 0,
    ));
  }

  // ── MANOEUVRING THRUSTER HOUSINGS ──────────────────────────────────────────
  // Small boxes at the corners of the stern -- bolted-on RCS units.
  // Four corners: upper-port, upper-starboard, lower-port, lower-starboard.
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.12, h * 0.14, len * 0.06),
    s * w * 0.70, h * 0.35, -len * 0.42,
  )));
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.12, h * 0.14, len * 0.06),
    s * w * 0.70, -h * 0.35, -len * 0.42,
  )));
  // Forward RCS nubs (small cylinders near bow, for braking thrust)
  parts.push(...mirrorX(s => place(
    new THREE.CylinderGeometry(w * 0.025, w * 0.03, h * 0.06, 6),
    s * w * 0.40, h * 0.10, len * 0.30,
  )));

  // ── DORSAL FIN / HEAT RADIATOR ─────────────────────────────────────────────
  // Even the smallest Teranos ship has a small dorsal fin -- a heat radiator
  // slab that doubles as a recognition silhouette element.
  const finH = h * (0.15 + cx * 0.03);
  parts.push(seam(
    w * 0.03, finH, len * (0.10 + cx * 0.02),
    0, h * 0.46 + finH * 0.5, -len * 0.10,
  ));

  // ── SENSOR DISH (ALL SIZES) ────────────────────────────────────────────────
  // A small parabolic dish (approximated as a flattened hemisphere) mounted
  // asymmetrically -- Teranos always bolt sensors where there's room.
  parts.push(place(
    new THREE.SphereGeometry(w * 0.08, 6, 4, 0, PI * 2, 0, HALF_PI),
    -w * 0.38, h * 0.30, len * 0.10,
    0.3, 0, 0,  // tilted slightly forward
  ));
  // Dish support strut
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.01, w * 0.01, h * 0.15, 4),
    -w * 0.38, h * 0.20, len * 0.10,
  ));

  // ── RUNNING LIGHT BUMPS ────────────────────────────────────────────────────
  // Tiny spheres at wing-tips and keel -- navigation lights visible even on
  // probes. Adds visual interest to the silhouette.
  parts.push(...mirrorX(s => place(
    new THREE.SphereGeometry(w * 0.03, 4, 4),
    s * w * 0.52, 0, len * 0.32,
  )));
  parts.push(place(
    new THREE.SphereGeometry(w * 0.025, 4, 4),
    0, -h * 0.48, len * 0.30,
  )); // keel light

  // ═══════════════════════════════════════════════════════════════════════════
  //  COMPLEXITY-GATED ADDITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── cx >= 1: SCOUT/FIGHTER UPGRADES ────────────────────────────────────────
  // Even small combat ships get extra recognition detail: ventral fin,
  // wing-root fairings, and hull panel detail.
  if (cx >= 1) {
    // Ventral fin -- small stabiliser beneath the hull
    parts.push(seam(
      w * 0.025, h * 0.20, len * 0.12,
      0, -h * 0.55, -len * 0.08,
    ));
    // Wing-root fairings -- small wedges where the hull meets the engine block
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.18, h * 0.10, len * 0.10),
      s * w * 0.55, 0, -len * 0.28,
      0, 0, s * 0.15,
    )));
    // Additional hull panel lines (diagonal refit seams)
    parts.push(seam(w * 0.7, h * 0.015, h * 0.015, 0, h * 0.20, len * 0.15));
    parts.push(seam(w * 0.7, h * 0.015, h * 0.015, 0, -h * 0.20, len * 0.15));
    // Intake scoops -- small recessed boxes on the hull sides
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.04, h * 0.12, len * 0.06),
      s * w * 0.48, h * 0.15, len * 0.05,
    )));
  }

  // ── cx >= 2: DESTROYER-CLASS MODULES ───────────────────────────────────────
  // Bolted-on side pods, connecting struts, additional hull plating.
  // Asymmetric: port gets a sensor array, starboard gets a utility pod.
  if (cx >= 2) {
    // Starboard module -- standard rectangular utility pod
    parts.push(place(
      new THREE.BoxGeometry(w * 0.22, h * 0.38, len * 0.20),
      w * 0.60, 0, len * 0.08,
    ));
    // Starboard pod seam line
    parts.push(seam(w * 0.23, h * 0.015, len * 0.21, w * 0.60, h * 0.20, len * 0.08));
    // Port module -- longer sensor array housing (asymmetric)
    parts.push(place(
      new THREE.BoxGeometry(w * 0.20, h * 0.34, len * 0.26),
      -w * 0.60, h * 0.05, len * 0.04,
    ));
    // Port sensor array spine -- raised rail on top of the pod
    parts.push(seam(w * 0.04, h * 0.06, len * 0.22, -w * 0.60, h * 0.25, len * 0.04));
    // Connecting struts (small cylinders linking pods to hull)
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, w * 0.15, 4),
      s * w * 0.48, 0, len * 0.08,
      0, 0, HALF_PI,
    )));
    // Aft connecting struts (second attachment point per pod)
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, w * 0.12, 4),
      s * w * 0.48, -h * 0.12, len * -0.02,
      0, 0, HALF_PI,
    )));
    // Hull reinforcement plates -- overlapping slabs on the sides
    parts.push(...mirrorX(s => seam(
      w * 0.04, h * 0.50, len * 0.25,
      s * w * 0.50, 0, len * 0.05,
    )));
    // Dorsal cable conduit -- raised pipe running along the top
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.018, w * 0.018, len * 0.30, 6),
      w * 0.15, h * 0.47, len * 0.0,
      HALF_PI, 0, 0,
    ));
  }

  // ── cx >= 3: FRIGATE-CLASS WEAPONS ─────────────────────────────────────────
  // Hexagonal turret mounts, point-defence clusters, ventral keel fin,
  // and the beginning of the "busy warship" look.
  if (cx >= 3) {
    // Dorsal turrets (port and starboard) -- hex base + twin barrels
    parts.push(...mirrorX(s => {
      const turretParts: THREE.BufferGeometry[] = [];
      // Hex base platform
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.12, w * 0.13, h * 0.07, 6),
        s * w * 0.30, h * 0.50, len * 0.05,
      ));
      // Turret housing dome
      turretParts.push(place(
        new THREE.SphereGeometry(w * 0.08, 6, 4, 0, PI * 2, 0, HALF_PI),
        s * w * 0.30, h * 0.54, len * 0.05,
      ));
      // Twin barrel assembly
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.018, w * 0.018, len * 0.11, 4),
        s * w * 0.30 + w * 0.04, h * 0.56, len * 0.13,
        HALF_PI, 0, 0,
      ));
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.018, w * 0.018, len * 0.11, 4),
        s * w * 0.30 - w * 0.04, h * 0.56, len * 0.13,
        HALF_PI, 0, 0,
      ));
      return merge(turretParts);
    }));

    // Forward point-defence clusters (chin edges)
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.04, 4, 4),
      s * chinW * 0.50, -h * 0.10, len * 0.38,
    )));
    // Mid-hull point-defence bumps
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.035, 4, 4),
      s * w * 0.48, h * 0.30, len * 0.0,
    )));

    // Ventral keel fin -- larger stabiliser for frigate+
    parts.push(seam(
      w * 0.03, h * 0.28, len * 0.20,
      0, -h * 0.60, len * 0.0,
    ));
    // Keel fin cross-brace
    parts.push(seam(
      w * 0.10, h * 0.02, h * 0.02,
      0, -h * 0.70, len * 0.0,
    ));

    // Aft sensor pylon -- short mast behind the bridge
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.008, h * 0.30, 4),
      -w * 0.10, h * 0.72, len * 0.08,
    ));
    // Pylon crossbar
    parts.push(seam(w * 0.15, h * 0.015, h * 0.015, -w * 0.10, h * 0.88, len * 0.08));

    // Hull panel greebles -- small raised rectangles that break up flat surfaces
    for (let z = -0.15; z <= 0.20; z += 0.12) {
      parts.push(...mirrorX(s => seam(
        w * 0.06, h * 0.08, len * 0.05,
        s * w * 0.47, h * (0.10 + z * 0.3), len * z,
      )));
    }
  }

  // ── cx >= 4: CRUISER-CLASS SYSTEMS ─────────────────────────────────────────
  // Antenna farm, communication arrays, ventral weapon pods, dorsal sensor
  // mast. The ship begins to look "committee-designed" -- busy with add-ons.
  if (cx >= 4) {
    // PRIMARY SENSOR MAST -- tall, slightly off-centre (asymmetric)
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.010, h * 1.10, 4),
      w * 0.05, h * 0.95, len * 0.15,
    ));
    // Mast crossbar (antenna array)
    parts.push(seam(w * 0.32, h * 0.02, h * 0.02, w * 0.05, h * 1.45, len * 0.15));
    // Mast tip -- small sphere (radar dome)
    parts.push(place(
      new THREE.SphereGeometry(w * 0.025, 6, 4),
      w * 0.05, h * 1.50, len * 0.15,
    ));
    // Crossbar end dipoles
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.005, w * 0.005, h * 0.10, 4),
      w * 0.05 + w * 0.16, h * 1.50, len * 0.15,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.005, w * 0.005, h * 0.10, 4),
      w * 0.05 - w * 0.16, h * 1.50, len * 0.15,
    ));

    // SECONDARY ANTENNA (port side, shorter -- different department added it)
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.008, h * 0.65, 4),
      -w * 0.18, h * 0.75, -len * 0.10,
    ));
    // Secondary antenna dish
    parts.push(place(
      new THREE.SphereGeometry(w * 0.05, 6, 4, 0, PI * 2, 0, HALF_PI),
      -w * 0.18, h * 1.05, -len * 0.10,
      -0.4, 0, 0,
    ));

    // COMM ARRAY -- horizontal antenna spar near bridge
    parts.push(seam(
      w * 0.50, h * 0.012, h * 0.012,
      0, h * 0.62, len * 0.28,
    ));
    // Comm array vertical elements
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.12, 4),
      w * 0.25, h * 0.68, len * 0.28,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.12, 4),
      -w * 0.25, h * 0.68, len * 0.28,
    ));

    // VENTRAL WEAPON PODS -- underslung missile/torpedo racks
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.15, h * 0.18, len * 0.18),
      s * w * 0.35, -h * 0.52, len * 0.0,
    )));
    // Weapon pod mounting pylons
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.04, h * 0.14, len * 0.05),
      s * w * 0.35, -h * 0.38, len * 0.0,
    )));
    // Weapon pod barrel tips
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.025, len * 0.06, 6),
      s * w * 0.35, -h * 0.52, len * 0.12,
      HALF_PI, 0, 0,
    )));

    // MIDSHIPS TURRET -- single barrel on the centreline, aft of bridge
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.10, w * 0.11, h * 0.06, 6),
      0, h * 0.50, -len * 0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.022, w * 0.022, len * 0.10, 4),
      0, h * 0.54, len * 0.02,
      HALF_PI, 0, 0,
    ));

    // Additional hull greeble panels
    parts.push(...mirrorX(s => seam(
      w * 0.08, h * 0.12, len * 0.08,
      s * w * 0.46, -h * 0.20, len * 0.15,
    )));
    parts.push(...mirrorX(s => seam(
      w * 0.10, h * 0.10, len * 0.06,
      s * w * 0.46, h * 0.15, -len * 0.18,
    )));
  }

  // ── cx >= 5: CAPITAL SHIP FEATURES ─────────────────────────────────────────
  // Dorsal spine weapon, layered armour plates, expanded bridge tower,
  // hangar section, broadside turret platforms, and dense detail.
  if (cx >= 5) {
    // DORSAL SPINE WEAPON -- the signature capital ship feature.
    // A long rail/spinal mount running along the top centreline.
    const spineLen = len * 0.45;
    parts.push(place(
      new THREE.BoxGeometry(w * 0.08, h * 0.12, spineLen),
      0, h * 0.58, len * 0.05,
    ));
    // Spine weapon barrel/emitter at bow end
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.03, w * 0.05, len * 0.14, 6),
      0, h * 0.58, len * 0.34,
      HALF_PI, 0, 0,
    ));
    // Spine mounting brackets -- small vertical slabs along the spine
    for (let z = -0.12; z <= 0.20; z += 0.08) {
      parts.push(seam(
        w * 0.12, h * 0.04, h * 0.02,
        0, h * 0.52, len * z,
      ));
    }
    // Spine capacitor housings -- boxy lumps along the rail
    parts.push(seam(w * 0.10, h * 0.08, len * 0.06, 0, h * 0.62, len * -0.05));
    parts.push(seam(w * 0.10, h * 0.08, len * 0.06, 0, h * 0.62, len * 0.15));

    // LAYERED ARMOUR PLATES -- overlapping slabs welded to hull sides.
    // Primary layer
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.05, h * 0.75, len * 0.40),
      s * w * 0.55, 0, len * 0.0,
      0, 0, s * 0.08,
    )));
    // Secondary armour layer (shorter, further aft, different angle)
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.04, h * 0.60, len * 0.25),
      s * w * 0.62, 0, -len * 0.15,
      0, 0, s * 0.12,
    )));
    // Tertiary armour strip (thin, near bow)
    parts.push(...mirrorX(s => seam(
      w * 0.03, h * 0.50, len * 0.15,
      s * w * 0.52, h * 0.05, len * 0.20,
      0, 0, s * 0.06,
    )));
    // Armour bolt heads -- small cubes along the plate edges
    for (let z = -0.10; z <= 0.15; z += 0.08) {
      parts.push(...mirrorX(s => place(
        new THREE.BoxGeometry(w * 0.025, w * 0.025, w * 0.025),
        s * w * 0.58, h * 0.30, len * z,
      )));
    }

    // EXPANDED BRIDGE TOWER -- taller command structure for flagships
    parts.push(place(
      new THREE.BoxGeometry(w * 0.30, h * 0.22, len * 0.10),
      0, h * 0.68, len * 0.22,
    ));
    // Flag bridge viewport (second window band)
    parts.push(seam(w * 0.34, h * 0.04, len * 0.012, 0, h * 0.76, len * 0.28));
    // Bridge tower roof antenna cluster
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.15, 4),
      w * 0.08, h * 0.87, len * 0.22,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.006, w * 0.006, h * 0.12, 4),
      -w * 0.06, h * 0.85, len * 0.22,
    ));

    // BROADSIDE TURRET PLATFORMS
    parts.push(...mirrorX(s => {
      const bsideParts: THREE.BufferGeometry[] = [];
      // Hex base
      bsideParts.push(place(
        new THREE.CylinderGeometry(w * 0.10, w * 0.11, h * 0.06, 6),
        s * w * 0.55, h * 0.42, -len * 0.10,
      ));
      // Turret housing
      bsideParts.push(place(
        new THREE.SphereGeometry(w * 0.06, 6, 4, 0, PI * 2, 0, HALF_PI),
        s * w * 0.55, h * 0.46, -len * 0.10,
      ));
      // Barrel
      bsideParts.push(place(
        new THREE.CylinderGeometry(w * 0.016, w * 0.016, len * 0.09, 4),
        s * w * 0.55, h * 0.46, -len * 0.04,
        HALF_PI, 0, 0,
      ));
      return merge(bsideParts);
    }));

    // AFT HANGAR BAY -- recessed flight deck at stern dorsal
    parts.push(place(
      new THREE.BoxGeometry(w * 0.60, h * 0.28, len * 0.14),
      0, h * 0.16, -len * 0.28,
    ));
    // Hangar door frame
    parts.push(seam(w * 0.64, h * 0.30, h * 0.02, 0, h * 0.16, -len * 0.35));
    // Hangar internal deck (visible through opening)
    parts.push(seam(w * 0.55, h * 0.02, len * 0.12, 0, h * 0.03, -len * 0.28));

    // VENTRAL TORPEDO TUBES -- capital ships get fixed forward launchers
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.03, w * 0.035, len * 0.10, 6),
      s * w * 0.20, -h * 0.42, len * 0.30,
      HALF_PI, 0, 0,
    )));
  }

  // ── cx >= 6: DREADNOUGHT / SUPER-CAPITAL ───────────────────────────────────
  // Flanking engine nacelles, sensor dome, ventral keel plate, additional
  // point-defence, and the dense "bristling with add-ons" look.
  if (cx >= 6) {
    // FLANKING ENGINE NACELLE PODS
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.22, h * 0.38, len * 0.22),
      s * w * 0.85, 0, -len * 0.34,
    )));
    // Nacelle connecting pylons (struts to main hull)
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.10, h * 0.08, len * 0.08),
      s * w * 0.72, 0, -len * 0.30,
    )));
    // Nacelle nozzles
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(h * 0.08, h * 0.13, len * 0.06, 8),
      s * w * 0.85, 0, -len * 0.48,
      HALF_PI, 0, 0,
    )));
    // Nacelle exhaust cones
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(h * 0.12, len * 0.03, 8),
      s * w * 0.85, 0, -len * 0.52,
      HALF_PI, 0, 0,
    )));
    // Nacelle seam lines
    parts.push(...mirrorX(s => seam(
      w * 0.23, h * 0.015, h * 0.015,
      s * w * 0.85, h * 0.20, -len * 0.34,
    )));

    // DORSAL SENSOR DOME (large sphere -- radar installation)
    parts.push(place(
      new THREE.SphereGeometry(w * 0.12, 8, 6),
      0, h * 0.90, -len * 0.05,
    ));
    // Dome support pedestal
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.08, h * 0.10, 6),
      0, h * 0.82, -len * 0.05,
    ));

    // VENTRAL KEEL REINFORCEMENT -- heavy armour plate
    parts.push(place(
      new THREE.BoxGeometry(w * 0.80, h * 0.05, len * 0.55),
      0, -h * 0.53, 0,
    ));
    // Keel plate seam lines
    for (let z = -0.20; z <= 0.20; z += 0.10) {
      parts.push(seam(w * 0.82, h * 0.015, h * 0.015, 0, -h * 0.56, len * z));
    }

    // DENSE POINT-DEFENCE BUMPS along hull edges
    for (let z = -0.20; z <= 0.20; z += 0.10) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.032, 4, 3),
        s * w * 0.53, h * 0.44, len * z,
      )));
    }
    // Ventral PD turrets
    for (let z = -0.10; z <= 0.15; z += 0.12) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.028, 4, 3),
        s * w * 0.40, -h * 0.50, len * z,
      )));
    }

    // ASYMMETRIC REFIT MODULE -- port side gets a large comms blister
    // that starboard does not (committee added it in the last refit)
    parts.push(place(
      new THREE.BoxGeometry(w * 0.16, h * 0.20, len * 0.12),
      -w * 0.68, h * 0.20, len * 0.10,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.008, w * 0.008, h * 0.25, 4),
      -w * 0.68, h * 0.42, len * 0.10,
    ));
    // Starboard gets a different addition -- a small hangar extension
    parts.push(place(
      new THREE.BoxGeometry(w * 0.14, h * 0.22, len * 0.08),
      w * 0.68, -h * 0.10, -len * 0.15,
    ));

    // HULL GREEBLE DENSITY -- lots of small raised panels
    for (let z = -0.20; z <= 0.20; z += 0.08) {
      for (const yOff of [-0.25, 0.10, 0.30]) {
        parts.push(...mirrorX(s => seam(
          w * 0.04, h * 0.05, len * 0.03,
          s * w * 0.46, h * yOff, len * z,
        )));
      }
    }
  }

  // ── cx >= 7: STATION-CLASS / PLANET-KILLER ─────────────────────────────────
  // Habitat ring, massive forward weapon array, additional ring structures,
  // and the full "small city bolted to an engine block" look.
  if (cx >= 7) {
    // ROTATING HABITAT RING (torus)
    parts.push(place(
      new THREE.TorusGeometry(w * 0.85, w * 0.08, 6, 16),
      0, 0, -len * 0.05,
      HALF_PI, 0, 0,
    ));
    // Ring support struts (4 radial spokes)
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.022, w * 0.022, w * 0.70, 4),
        Math.cos(angle) * w * 0.42, Math.sin(angle) * w * 0.42, -len * 0.05,
        0, 0, angle + HALF_PI,
      ));
    }

    // SECONDARY RING (smaller, further forward)
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, w * 0.05, 6, 12),
      0, 0, len * 0.15,
      HALF_PI, 0, 0,
    ));
    // Secondary ring struts
    for (let a = 0; a < 3; a++) {
      const angle = (a / 3) * PI * 2 + 0.3;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.015, w * 0.42, 4),
        Math.cos(angle) * w * 0.27, Math.sin(angle) * w * 0.27, len * 0.15,
        0, 0, angle + HALF_PI,
      ));
    }

    // MASSIVE FORWARD WEAPON ARRAY
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.16, len * 0.22, 8),
      0, 0, len * 0.46,
      HALF_PI, 0, 0,
    ));
    // Weapon array focusing rings
    parts.push(place(
      new THREE.TorusGeometry(w * 0.13, w * 0.015, 4, 8),
      0, 0, len * 0.50,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.10, w * 0.012, 4, 8),
      0, 0, len * 0.54,
      HALF_PI, 0, 0,
    ));

    // ADDITIONAL BROADSIDE BATTERIES (multi-turret rows)
    for (let z = -0.15; z <= 0.10; z += 0.12) {
      parts.push(...mirrorX(s => {
        const tParts: THREE.BufferGeometry[] = [];
        tParts.push(place(
          new THREE.CylinderGeometry(w * 0.08, w * 0.09, h * 0.05, 6),
          s * w * 0.58, h * 0.44, len * z,
        ));
        tParts.push(place(
          new THREE.CylinderGeometry(w * 0.014, w * 0.014, len * 0.07, 4),
          s * w * 0.58, h * 0.47, len * z + len * 0.05,
          HALF_PI, 0, 0,
        ));
        return merge(tParts);
      }));
    }

    // DORSAL ANTENNA FOREST -- multiple masts of varying height
    for (let i = 0; i < 4; i++) {
      const xOff = (i - 1.5) * w * 0.15;
      const mH = h * (0.30 + Math.sin(i * 1.7) * 0.15);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.006, w * 0.004, mH, 4),
        xOff, h * 0.80 + mH * 0.5, -len * 0.15 + i * len * 0.04,
      ));
    }
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getTeranosHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.28;
  const h = len * 0.22;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Main engine thrust bells ──────────────────────────────────────────────
  // Clustered at stern, spread across the engine housing width.
  const nozzleCount = Math.min(2 + Math.floor(cx * 0.8), 7);
  const nozzleSpread = w * 1.1;
  for (let i = 0; i < nozzleCount; i++) {
    const nx = (i - (nozzleCount - 1) / 2) * (nozzleSpread / Math.max(nozzleCount - 1, 1));
    engines.push({
      position: new THREE.Vector3(nx, 0, -len * 0.545),
      direction: new THREE.Vector3(0, 0, -1),
      radius: h * 0.145,
    });
  }

  // ── Flanking nacelle engines (cx >= 6) ────────────────────────────────────
  if (cx >= 6) {
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.85, 0, -len * 0.52),
        direction: new THREE.Vector3(0, 0, -1),
        radius: h * 0.12,
      });
    }
  }

  // ── Dorsal turrets (cx >= 3) ──────────────────────────────────────────────
  if (cx >= 3) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.30, h * 0.54, len * 0.05),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
  }

  // ── Midships turret (cx >= 4) ─────────────────────────────────────────────
  if (cx >= 4) {
    weapons.push({
      position: new THREE.Vector3(0, h * 0.54, -len * 0.05),
      facing: 'dorsal',
      normal: new THREE.Vector3(0, 1, 0),
    });

    // Ventral weapon pods
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.35, -h * 0.52, len * 0.12),
        facing: 'fore',
        normal: new THREE.Vector3(0, 0, 1),
      });
    }
  }

  // ── Dorsal spine weapon (cx >= 5) ─────────────────────────────────────────
  if (cx >= 5) {
    weapons.push({
      position: new THREE.Vector3(0, h * 0.58, len * 0.34),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });

    // Ventral torpedo tubes
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.20, -h * 0.42, len * 0.30),
        facing: 'fore',
        normal: new THREE.Vector3(0, 0, 1),
      });
    }

    // Broadside turret platforms
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.55, h * 0.46, -len * 0.10),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }
  }

  // ── Massive forward weapon array (cx >= 7) ────────────────────────────────
  if (cx >= 7) {
    weapons.push({
      position: new THREE.Vector3(0, 0, len * 0.54),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });

    // Additional broadside battery rows
    for (let z = -0.15; z <= 0.10; z += 0.12) {
      for (const s of [-1, 1]) {
        weapons.push({
          position: new THREE.Vector3(s * w * 0.58, h * 0.47, len * z),
          facing: s === -1 ? 'port' : 'starboard',
          normal: new THREE.Vector3(s, 0, 0).normalize(),
        });
      }
    }
  }

  return { engines, weapons };
}

registerHardpointProvider('teranos', getTeranosHardpoints);
