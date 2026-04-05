import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

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
 */
export function buildTeranos(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;   // Slightly wider than average -- sturdy, broad-shouldered
  const h = len * 0.18;   // Moderate height -- not flat, not tall
  const parts: THREE.BufferGeometry[] = [];

  // ── CORE HULL ──────────────────────────────────────────────────────────────
  // Tapered main body: wider at stern, narrowing to bow. Not a pure box --
  // slight trapezoidal cross-section using an extruded shape.

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-w * 0.5, -h * 0.45);   // bottom-left
  hullShape.lineTo(-w * 0.42, h * 0.45);   // top-left (narrower top = slight wedge)
  hullShape.lineTo(w * 0.42, h * 0.45);    // top-right
  hullShape.lineTo(w * 0.5, -h * 0.45);    // bottom-right
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: len * 0.6,
    bevelEnabled: false,
  });
  // Extrude goes along local +Z, so position to centre it
  parts.push(place(hullGeo, 0, 0, -len * 0.25));

  // ── BOW / CHIN ASSEMBLY ────────────────────────────────────────────────────
  // The distinctive Teranos "bulldog chin" -- a forward-jutting sensor and
  // deflector housing below the bridge. This is the single most recognisable
  // feature. On small ships it's a small wedge; on capitals it's a full prow.

  const chinLen = len * (0.12 + cx * 0.015);
  const chinW = w * 0.55;
  const chinH = h * 0.35;
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

  // ── BRIDGE BLOCK ───────────────────────────────────────────────────────────
  // Raised command section on top of the hull, slightly forward of centre.
  // Boxy, pragmatic -- a box on a box, clearly a separate module.

  parts.push(place(
    new THREE.BoxGeometry(w * 0.4, h * 0.35, len * 0.12),
    0, h * 0.4, len * 0.2,
  ));
  // Bridge viewport strip -- thin horizontal cylinder
  parts.push(place(
    new THREE.BoxGeometry(w * 0.44, h * 0.06, len * 0.02),
    0, h * 0.52, len * 0.27,
  ));

  // ── ENGINE BLOCK (BROAD STERN) ─────────────────────────────────────────────
  // Wider than the main hull -- the "broad stern" that defines the aft view.
  // Engine housing is a boxy nacelle block.

  parts.push(place(
    new THREE.BoxGeometry(w * 1.25, h * 0.85, len * 0.15),
    0, 0, -len * 0.38,
  ));

  // Engine thrust bells -- conical nozzles clustered at the stern
  const nozzleCount = Math.min(2 + Math.floor(cx * 0.8), 6);
  const nozzleSpread = w * 1.1;
  for (let i = 0; i < nozzleCount; i++) {
    const nx = (i - (nozzleCount - 1) / 2) * (nozzleSpread / Math.max(nozzleCount - 1, 1));
    // Conical bell: wider at exhaust end (aft), narrower at housing
    parts.push(place(
      new THREE.CylinderGeometry(h * 0.1, h * 0.18, len * 0.08, 8),
      nx, 0, -len * 0.49,
      HALF_PI, 0, 0,
    ));
  }

  // ── MANOEUVRING THRUSTER HOUSINGS ──────────────────────────────────────────
  // Small boxes at the corners of the stern -- clearly bolted-on RCS units.
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.12, h * 0.15, len * 0.06),
    s * w * 0.7, h * 0.35, -len * 0.42,
  )));
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.12, h * 0.15, len * 0.06),
    s * w * 0.7, -h * 0.35, -len * 0.42,
  )));

  // ── cx >= 2: SIDE MODULE BLISTERS ──────────────────────────────────────────
  // Bolted-on side pods -- sensor arrays, auxiliary systems, extra fuel.
  // Asymmetric detail: port side gets a slightly different pod than starboard.
  if (cx >= 2) {
    // Starboard module -- standard rectangular pod
    parts.push(place(
      new THREE.BoxGeometry(w * 0.22, h * 0.4, len * 0.2),
      w * 0.6, 0, len * 0.08,
    ));
    // Port module -- slightly longer, different purpose (sensor array)
    parts.push(place(
      new THREE.BoxGeometry(w * 0.2, h * 0.35, len * 0.25),
      -w * 0.6, h * 0.05, len * 0.05,
    ));
    // Connecting struts (small cylinders linking pods to hull)
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, w * 0.15, 4),
      s * w * 0.48, 0, len * 0.08,
      0, 0, HALF_PI,
    )));
  }

  // ── cx >= 3: HEXAGONAL TURRET MOUNTS ───────────────────────────────────────
  // Standardised modular weapon platforms -- hexagonal bases with cylindrical
  // barrel assemblies. This is the Teranos way: one mounting standard, many
  // weapon types slotted in.
  if (cx >= 3) {
    // Dorsal turrets (port and starboard)
    parts.push(...mirrorX(s => {
      const turretParts: THREE.BufferGeometry[] = [];
      // Hex base (approximated with 6-sided cylinder, very flat)
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.12, w * 0.13, h * 0.08, 6),
        s * w * 0.3, h * 0.5, len * 0.05,
      ));
      // Twin barrel assembly
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.02, len * 0.1, 4),
        s * w * 0.3 + w * 0.04, h * 0.55, len * 0.12,
        HALF_PI, 0, 0,
      ));
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.02, len * 0.1, 4),
        s * w * 0.3 - w * 0.04, h * 0.55, len * 0.12,
        HALF_PI, 0, 0,
      ));
      return merge(turretParts);
    }));

    // Forward point-defence cluster (small bumps along chin edges)
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.04, 4, 4),
      s * chinW * 0.45, -h * 0.1, len * 0.38,
    )));
  }

  // ── cx >= 4: ANTENNA FARM + VENTRAL HARDPOINTS ─────────────────────────────
  // The "committee additions" -- sensor masts, communication arrays, and
  // ventral weapon pods that were clearly added in the last refit.
  if (cx >= 4) {
    // Tall sensor mast (slightly off-centre -- asymmetric, realistic)
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.012, h * 1.0, 4),
      w * 0.05, h * 0.9, len * 0.15,
    ));
    // Antenna crossbar at top of mast
    parts.push(place(
      new THREE.BoxGeometry(w * 0.3, h * 0.02, h * 0.02),
      w * 0.05, h * 1.35, len * 0.15,
    ));
    // Secondary antenna (shorter, other side)
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.01, h * 0.6, 4),
      -w * 0.15, h * 0.7, -len * 0.1,
    ));

    // Ventral weapon pods -- underslung missile/torpedo racks
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.15, h * 0.2, len * 0.18),
      s * w * 0.35, -h * 0.5, len * 0.0,
    )));
    // Ventral pod mounting pylons
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.04, h * 0.15, len * 0.05),
      s * w * 0.35, -h * 0.35, len * 0.0,
    )));
  }

  // ── cx >= 5: CAPITAL SHIP FEATURES ─────────────────────────────────────────
  // The full expression: dorsal spine weapon, layered armour plates,
  // expanded bridge tower, hangar section, and dense turret coverage.
  if (cx >= 5) {
    // DORSAL SPINE WEAPON -- the signature capital ship feature.
    // A long rail/spinal mount running along the top centreline.
    const spineLen = len * 0.45;
    parts.push(place(
      new THREE.BoxGeometry(w * 0.08, h * 0.12, spineLen),
      0, h * 0.56, len * 0.05,
    ));
    // Spine weapon barrel/emitter at bow end
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.03, w * 0.05, len * 0.12, 6),
      0, h * 0.56, len * 0.33,
      HALF_PI, 0, 0,
    ));

    // LAYERED ARMOUR PLATES -- overlapping slabs welded to hull sides.
    // These are visibly separate from the hull, at slight angles.
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.06, h * 0.75, len * 0.4),
      s * w * 0.55, 0, len * 0.0,
      0, 0, s * 0.08,  // slight outward cant
    )));
    // Secondary armour layer (shorter, further aft)
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.05, h * 0.6, len * 0.25),
      s * w * 0.62, 0, -len * 0.15,
      0, 0, s * 0.12,
    )));

    // EXPANDED BRIDGE TOWER -- taller command structure for flagships
    parts.push(place(
      new THREE.BoxGeometry(w * 0.3, h * 0.25, len * 0.1),
      0, h * 0.65, len * 0.22,
    ));

    // ADDITIONAL TURRET PLATFORMS (broadside mounts)
    parts.push(...mirrorX(s => {
      const bsideParts: THREE.BufferGeometry[] = [];
      bsideParts.push(place(
        new THREE.CylinderGeometry(w * 0.1, w * 0.11, h * 0.06, 6),
        s * w * 0.55, h * 0.4, -len * 0.1,
      ));
      bsideParts.push(place(
        new THREE.CylinderGeometry(w * 0.018, w * 0.018, len * 0.08, 4),
        s * w * 0.55, h * 0.44, -len * 0.04,
        HALF_PI, 0, 0,
      ));
      return merge(bsideParts);
    }));

    // AFT HANGAR BAY (recessed area at stern top)
    parts.push(place(
      new THREE.BoxGeometry(w * 0.6, h * 0.3, len * 0.12),
      0, h * 0.15, -len * 0.28,
    ));
  }

  // ── cx >= 6: SUPER-CAPITAL EXTRAS ──────────────────────────────────────────
  if (cx >= 6) {
    // Extra engine nacelle pods flanking the main stern
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.2, h * 0.4, len * 0.2),
      s * w * 0.85, 0, -len * 0.35,
    )));
    // Extra nozzles on flanking nacelles
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(h * 0.08, h * 0.14, len * 0.06, 8),
      s * w * 0.85, 0, -len * 0.48,
      HALF_PI, 0, 0,
    )));

    // Dorsal sensor dome (large sphere, looks like a radar installation)
    parts.push(place(
      new THREE.SphereGeometry(w * 0.12, 8, 6),
      0, h * 0.85, -len * 0.05,
    ));

    // Ventral keel reinforcement -- heavy armour plate
    parts.push(place(
      new THREE.BoxGeometry(w * 0.8, h * 0.06, len * 0.55),
      0, -h * 0.52, 0,
    ));

    // More point-defence bumps along hull edges
    for (let z = -0.2; z <= 0.2; z += 0.2) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.035, 4, 3),
        s * w * 0.52, h * 0.46, len * z,
      )));
    }
  }

  // ── cx >= 7: STATION-CLASS ADDITIONS ───────────────────────────────────────
  if (cx >= 7) {
    // Rotating habitat ring (torus) -- stations and planet killers
    parts.push(place(
      new THREE.TorusGeometry(w * 0.8, w * 0.08, 6, 16),
      0, 0, -len * 0.05,
      HALF_PI, 0, 0,
    ));
    // Ring support struts
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * Math.PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.02, w * 0.65, 4),
        Math.cos(angle) * w * 0.4, Math.sin(angle) * w * 0.4, -len * 0.05,
        0, 0, angle + HALF_PI,
      ));
    }

    // Massive forward weapon array
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.15, len * 0.2, 8),
      0, 0, len * 0.45,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}
