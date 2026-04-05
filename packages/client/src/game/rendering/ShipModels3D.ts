/**
 * ShipModels3D — Procedural 3D ship geometry for all 15 species.
 *
 * Each species has a unique design language built from Three.js primitives,
 * merged via BufferGeometryUtils. Ships face along +Z (front), centred at
 * the origin, and scale from ~2 units (scout) to ~20 units (dreadnought).
 *
 * Usage:
 *   const geo = generateShipGeometry('teranos', 'destroyer');
 *   const mat = getShipMaterial('teranos');
 *   const mesh = new THREE.Mesh(geo, mat);
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { HullClass } from '@nova-imperia/shared';

// ─── Hull class scale factors ───────────────────────────────────────────────
// Length in world units for each hull class — from probe (~1.5) to battle
// station (~24). Width and height are derived per-species.

const HULL_SCALE: Partial<Record<HullClass, number>> = {
  science_probe: 1.5, spy_probe: 1.5, drone: 1.5,
  fighter: 1.8, bomber: 2.0, patrol: 2.0, yacht: 2.5,
  corvette: 3.0,
  cargo: 4.0, transport: 5.0,
  frigate: 3.5, destroyer: 4.0,
  large_transport: 6.0, large_cargo: 6.0,
  light_cruiser: 8.0, heavy_cruiser: 9.0,
  large_supplier: 7.0, carrier: 10.0,
  light_battleship: 12.0, battleship: 14.0,
  heavy_battleship: 20.0, super_carrier: 16.0,
  battle_station: 24.0, small_space_station: 18.0,
  space_station: 28.0, large_space_station: 36.0, planet_killer: 40.0,
  coloniser_gen1: 6.0, coloniser_gen2: 7.0, coloniser_gen3: 8.0,
  coloniser_gen4: 10.0, coloniser_gen5: 12.0,
};

/** Complexity tier — larger hulls get more detail parts. */
const HULL_COMPLEXITY: Partial<Record<HullClass, number>> = {
  science_probe: 0, spy_probe: 0, drone: 0,
  fighter: 1, bomber: 1, patrol: 1, yacht: 1,
  corvette: 2,
  cargo: 2, transport: 2,
  frigate: 2, destroyer: 2,
  large_transport: 3, large_cargo: 3,
  light_cruiser: 3, heavy_cruiser: 4,
  large_supplier: 3, carrier: 4,
  light_battleship: 5, battleship: 5,
  heavy_battleship: 6, super_carrier: 5,
  battle_station: 7, small_space_station: 6,
  space_station: 7, large_space_station: 8, planet_killer: 8,
  coloniser_gen1: 2, coloniser_gen2: 3, coloniser_gen3: 3,
  coloniser_gen4: 4, coloniser_gen5: 5,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Position and optionally rotate a geometry, returning it. */
function place(
  geo: THREE.BufferGeometry,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
  sx = 1, sy = 1, sz = 1,
): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Merge an array of geometries, disposing the originals. */
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const valid = geos.filter(Boolean);
  if (valid.length === 0) return new THREE.BoxGeometry(1, 1, 1);
  const merged = mergeGeometries(valid, false);
  if (!merged) return valid[0];
  for (const g of valid) g.dispose();
  return merged;
}

/** Create a mirrored pair (left/right along X). */
function mirrorX(
  factory: (sign: number) => THREE.BufferGeometry,
): THREE.BufferGeometry[] {
  return [factory(1), factory(-1)];
}

const PI = Math.PI;
const HALF_PI = PI / 2;

// ─── Species geometry builders ──────────────────────────────────────────────

// Each builder receives (length, complexity) and returns a BufferGeometry.

type ShipBuilder = (len: number, cx: number) => THREE.BufferGeometry;

// ═══════════════════════════════════════════════════════════════════════════════
//  TERANOS
// ═══════════════════════════════════════════════════════════════════════════════

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
function buildTeranos(len: number, cx: number): THREE.BufferGeometry {
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

// ═══════════════════════════════════════════════════════════════════════════════
//  KHAZARI
// ═══════════════════════════════════════════════════════════════════════════════

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
 *  - Fighters (cx 1): A single forged wedge with ram prow. Two engines. Minimal.
 *    The silhouette is an arrowhead — simple, brutal, fast. One piece of metal.
 *  - Corvettes/Destroyers (cx 2): The wedge gains side armour plates and a dorsal
 *    ridge. A single turret appears atop the hull. Two to four engines.
 *  - Cruisers (cx 3-4): Multiple turrets, visible sponsons, the dorsal crest
 *    becomes prominent. A reinforced keel plate appears underneath. The ram prow
 *    is heavier, with heat-channel grooves. Four to six engines on lateral struts.
 *  - Capitals (cx 5+): Full siege configuration. Massive dorsal crest. Heavy
 *    broadside sponsons. Multiple turret decks. The ram prow is enormous and
 *    flanked by auxiliary rams. Eight or more engines in a wide array. The hull
 *    has visible forge-glow seams between plate layers. Minimum 15+ parts.
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

function buildKhazari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.28;   // slightly narrower than before — more dagger-like
  const h = len * 0.22;   // taller profile for the dorsal crest
  const parts: THREE.BufferGeometry[] = [];

  // ── 1. MAIN HULL — Trapezoidal cross-section forged wedge ──────────────
  // The defining Khazari shape: wider at the keel, narrower at the dorsal
  // crest. Extruded as a trapezoid running 65% of total length.
  const hullShape = new THREE.Shape();
  // Trapezoid: wide bottom, narrow top (anvil cross-section)
  hullShape.moveTo(-w * 0.5,  -h * 0.4);   // bottom-left
  hullShape.lineTo( w * 0.5,  -h * 0.4);   // bottom-right
  hullShape.lineTo( w * 0.35,  h * 0.35);  // top-right (narrower)
  hullShape.lineTo(-w * 0.35,  h * 0.35);  // top-left (narrower)
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: len * 0.6,
    bevelEnabled: true,
    bevelThickness: len * 0.015,
    bevelSize: len * 0.01,
    bevelSegments: 1,
  });
  // Centre the extrusion along Z — hull runs from -0.3L to +0.3L
  parts.push(place(hullGeo, 0, 0, -len * 0.3));

  // ── 2. RAM PROW — Four-sided pyramid ───────────────────────────────────
  // The signature Khazari weapon-prow. A square-based cone rotated so the
  // point faces +Z. 4 radial segments give it the four-faced pyramid look.
  const ramLen = len * (0.2 + cx * 0.015);  // longer ram on bigger ships
  parts.push(place(
    new THREE.ConeGeometry(w * 0.32, ramLen, 4),
    0, 0, len * 0.3 + ramLen * 0.5,
    HALF_PI, PI * 0.25, 0,  // point faces +Z, rotated 45deg for diamond alignment
  ));

  // ── 3. DORSAL CREST — The spine ridge ──────────────────────────────────
  // A triangular prism running along the top of the hull. On small ships
  // it is a subtle ridge; on capitals it becomes a towering crest.
  const crestH = h * (0.15 + cx * 0.04);
  const crestShape = new THREE.Shape();
  crestShape.moveTo(0, 0);
  crestShape.lineTo(-w * 0.12, -crestH);
  crestShape.lineTo( w * 0.12, -crestH);
  crestShape.closePath();
  const crestGeo = new THREE.ExtrudeGeometry(crestShape, {
    depth: len * 0.5,
    bevelEnabled: false,
  });
  parts.push(place(crestGeo, 0, h * 0.35, -len * 0.25));

  // ── 4. SIDE ARMOUR PLATES — Overlapping forgework ──────────────────────
  // Trapezoidal plates bolted to each flank. More layers on bigger ships.
  const plateCount = Math.max(1, Math.floor(cx / 2));
  for (let i = 0; i < plateCount; i++) {
    const plateZ = -len * 0.15 + i * len * 0.12;
    const plateW = w * 0.12;
    const plateH = h * 0.65;
    const plateD = len * 0.18;
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(plateW, plateH, plateD),
      s * (w * 0.52 + i * w * 0.06), -h * 0.05, plateZ,
    )));
  }

  // ── 5. ENGINE NACELLES — Hexagonal forge-furnaces ──────────────────────
  // Fat hexagonal cylinders that flare at the exhaust. Always in pairs.
  const engineCount = 2 + Math.floor(cx / 2) * 2;  // 2, 4, 6, 8...
  const engineSpacing = w * 0.9 / Math.max(engineCount - 1, 1);
  for (let i = 0; i < engineCount; i++) {
    const ex = (i - (engineCount - 1) / 2) * engineSpacing;
    // Main engine bell — hexagonal cylinder, wider at exhaust (aft)
    parts.push(place(
      new THREE.CylinderGeometry(h * 0.12, h * 0.18, len * 0.14, 6),
      ex, -h * 0.15, -len * 0.45,
      HALF_PI, 0, 0,
    ));
    // Exhaust flare ring
    parts.push(place(
      new THREE.TorusGeometry(h * 0.16, h * 0.025, 6, 6),
      ex, -h * 0.15, -len * 0.52,
      HALF_PI, 0, 0,
    ));
  }

  // ── 6. ENGINE STRUTS — Lateral supports for outboard engines ───────────
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.5, h * 0.06, len * 0.06),
      s * w * 0.25, -h * 0.15, -len * 0.42,
    )));
  }

  // ── 7. FORWARD TURRET — Dorsal main battery ───────────────────────────
  if (cx >= 2) {
    // Octagonal turret base
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.14, w * 0.18, h * 0.15, 8),
      0, h * 0.35 + crestH * 0.3, len * 0.15,
    ));
    // Turret barrel
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.04, len * 0.12, 6),
      0, h * 0.35 + crestH * 0.3, len * 0.24,
      HALF_PI, 0, 0,
    ));
  }

  // ── 8. BROADSIDE TURRETS — Flanking weapon mounts ──────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(s => {
      const turretParts: THREE.BufferGeometry[] = [];
      // Turret base — wider than tall (anvil proportion)
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.1, w * 0.14, h * 0.12, 8),
        s * w * 0.45, h * 0.15, len * 0.05,
      ));
      // Barrel
      turretParts.push(place(
        new THREE.CylinderGeometry(w * 0.03, w * 0.03, len * 0.1, 6),
        s * w * 0.45, h * 0.15, len * 0.12,
        HALF_PI, 0, 0,
      ));
      return merge(turretParts);
    }));
  }

  // ── 9. REINFORCED KEEL PLATE — Ventral armour ─────────────────────────
  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.85, h * 0.06, len * 0.55),
      0, -h * 0.45, 0,
    ));
  }

  // ── 10. AFT TURRETS — Secondary batteries ─────────────────────────────
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.09, w * 0.12, h * 0.1, 8),
      s * w * 0.35, h * 0.3, -len * 0.15,
    )));
    // Aft dorsal turret
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.12, w * 0.16, h * 0.14, 8),
      0, h * 0.35 + crestH * 0.2, -len * 0.1,
    ));
    // Barrel for aft dorsal
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.035, w * 0.035, len * 0.1, 6),
      0, h * 0.35 + crestH * 0.2, -len * 0.02,
      HALF_PI, 0, 0,
    ));
  }

  // ── 11. HEAVY BROADSIDE SPONSONS — Capital ship gun platforms ─────────
  if (cx >= 5) {
    parts.push(...mirrorX(s => {
      const sponsonParts: THREE.BufferGeometry[] = [];
      // Sponson hull — armoured bulge
      const sponsonShape = new THREE.Shape();
      sponsonShape.moveTo(0, -h * 0.2);
      sponsonShape.lineTo(w * 0.15, -h * 0.15);
      sponsonShape.lineTo(w * 0.15, h * 0.1);
      sponsonShape.lineTo(0, h * 0.15);
      sponsonShape.closePath();
      const sponsonGeo = new THREE.ExtrudeGeometry(sponsonShape, {
        depth: len * 0.25,
        bevelEnabled: false,
      });
      sponsonParts.push(place(sponsonGeo, s * w * 0.5, 0, -len * 0.05));
      // Sponson turret
      sponsonParts.push(place(
        new THREE.CylinderGeometry(w * 0.08, w * 0.11, h * 0.1, 8),
        s * (w * 0.55 + w * 0.08), h * 0.12, len * 0.02,
      ));
      // Sponson barrel
      sponsonParts.push(place(
        new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.14, 6),
        s * (w * 0.55 + w * 0.08), h * 0.12, len * 0.1,
        HALF_PI, 0, 0,
      ));
      return merge(sponsonParts);
    }));
  }

  // ── 12. AUXILIARY RAMS — Flanking prow blades on capitals ─────────────
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.12, len * 0.15, 4),
      s * w * 0.35, -h * 0.1, len * 0.38,
      HALF_PI, PI * 0.25, 0,
    )));
  }

  // ── 13. FORGE-GLOW SEAM RIDGES — Visible heat channels ───────────────
  if (cx >= 5) {
    // Horizontal ridges along the hull — suggest forge seams
    for (let i = 0; i < 3; i++) {
      const seam_z = -len * 0.15 + i * len * 0.15;
      parts.push(place(
        new THREE.BoxGeometry(w * 0.95, h * 0.02, len * 0.01),
        0, h * 0.05, seam_z,
      ));
    }
  }

  // ── 14. COMMAND TOWER — Bridge structure on heavy ships ───────────────
  if (cx >= 4) {
    // Stepped trapezoidal bridge block behind the dorsal crest
    parts.push(place(
      new THREE.BoxGeometry(w * 0.3, h * 0.2, len * 0.08),
      0, h * 0.45 + crestH * 0.5, len * 0.0,
    ));
    // Bridge viewport slit
    parts.push(place(
      new THREE.BoxGeometry(w * 0.22, h * 0.04, len * 0.01),
      0, h * 0.5 + crestH * 0.5, len * 0.045,
    ));
  }

  // ── 15. VENTRAL GUN GALLERY — Underslung weapons on capitals ──────────
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.07, w * 0.1, h * 0.08, 8),
      s * w * 0.3, -h * 0.5, len * 0.1,
    )));
    // Centre ventral turret
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.1, w * 0.14, h * 0.1, 8),
      0, -h * 0.52, len * 0.0,
    ));
  }

  // ── 16. LATERAL MANOEUVRING FURNACES — Small thruster pods ────────────
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(h * 0.05, h * 0.07, len * 0.04, 6),
      s * w * 0.55, 0, len * 0.2,
      0, 0, s * PI * 0.15,  // angled outward slightly
    )));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VAELORI
// ═══════════════════════════════════════════════════════════════════════════════

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

function buildVaelori(len: number, cx: number): THREE.BufferGeometry {
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

// ═══════════════════════════════════════════════════════════════════════════════
//  SYLVANI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  SYLVANI SHIP DESIGNS — Living Vessels of the Mycelial Network
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

function buildSylvani(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const h = len * 0.18;
  const parts: THREE.BufferGeometry[] = [];

  // ── Primary trunk — lathe-profile seed shape ────────────────────────────
  // Tapered bow, swollen midsection, narrowing aft — the archetypal seed.
  // Uses a custom lathe profile with asymmetric bulge (wider aft of centre).
  const trunkPts: THREE.Vector2[] = [];
  const trunkSegs = 16;
  for (let i = 0; i <= trunkSegs; i++) {
    const t = i / trunkSegs; // 0 = bow, 1 = stern
    // Seed profile: sharp tip, rapid swell, long taper
    const swell = Math.sin(t * PI) * (1 - 0.25 * t * t);
    // Slight lateral flattening via sqrt to avoid perfect circle
    const r = w * swell * 0.9;
    const z = (0.5 - t) * len * 0.85;
    trunkPts.push(new THREE.Vector2(r, z));
  }
  parts.push(place(
    new THREE.LatheGeometry(trunkPts, 10),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  // ── Dorsal ridge — hardened bark spine, bow to stern ────────────────────
  // A flattened box extruded along the top of the hull, giving the ship
  // a visible "keel" that reads as protective bark plating.
  parts.push(place(
    new THREE.BoxGeometry(w * 0.08, h * 0.35, len * 0.7),
    0, h * 0.55, len * 0.02,
  ));

  // ── Sensory frond crown at bow ──────────────────────────────────────────
  // Small cone-like projections fanning forward from the nose — the ship's
  // equivalent of root-tip chemoreceptors, now sensing the void.
  const frondCount = 3 + Math.floor(cx * 0.5);
  for (let i = 0; i < frondCount; i++) {
    const angle = ((i / frondCount) - 0.5) * PI * 0.7;
    const frondLen = len * (0.08 + 0.02 * cx);
    parts.push(place(
      new THREE.ConeGeometry(w * 0.03, frondLen, 4),
      Math.sin(angle) * w * 0.15,
      Math.cos(angle) * w * 0.15,
      len * 0.48,
      -0.3 + 0.3 * Math.cos(angle), 0, 0.3 * Math.sin(angle),
    ));
  }

  // ── Root-cluster engine tendrils at aft ─────────────────────────────────
  // Primary roots — thick tapered cylinders splaying outward from the stern.
  // Even the smallest scout has at least 2 roots.
  const rootCount = 2 + cx;
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * PI * 2;
    const rootLen = len * (0.18 + 0.03 * cx);
    const splay = w * (0.2 + 0.05 * cx);
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.07, rootLen, 5),
      Math.cos(angle) * splay * 0.5,
      Math.sin(angle) * splay * 0.5,
      -len * 0.48,
      HALF_PI + 0.25 * Math.cos(angle), 0, 0.25 * Math.sin(angle),
    ));
  }

  // ── Secondary root filaments (finer trailing tendrils) ──────────────────
  if (cx >= 1) {
    for (let i = 0; i < rootCount; i++) {
      const angle = ((i + 0.5) / rootCount) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.035, len * 0.12, 3),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.35,
        -len * 0.52,
        HALF_PI + 0.35 * Math.cos(angle), 0, 0.35 * Math.sin(angle),
      ));
    }
  }

  // ── Photosynthetic membrane sails ───────────────────────────────────────
  // Thin, leaf-like extensions that spread laterally for solar collection.
  // Dramatically flattened spheres — wide and paper-thin.
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.9, 6, 4),
      s * w * 0.7, 0, len * 0.05,
      0, 0, s * 0.15,   // slight angle outward like unfurling leaves
      0.06, 1.0, 1.3,   // paper-thin, tall, stretched
    )));
  }

  // ── Spore pods (weapon hardpoints) ──────────────────────────────────────
  // Bulbous fruiting bodies swelling from the hull. Appear in mirrored pairs.
  if (cx >= 2) {
    // Forward pair — primary weapons
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.18, 6, 5),
      s * w * 0.45, w * 0.2, len * 0.25,
    )));
  }
  if (cx >= 3) {
    // Midship pair — broadside spore launchers
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.22, 6, 5),
      s * w * 0.6, w * 0.15, -len * 0.05,
    )));
  }
  if (cx >= 4) {
    // Aft pair — defensive spore clusters
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.16, 5, 4),
      s * w * 0.5, w * 0.18, -len * 0.25,
    )));
  }

  // ── Lateral branch-arms (capital ships) ─────────────────────────────────
  // On larger vessels, thick branch structures extend laterally, carrying
  // additional spore pod clusters — the ship's broadside battery.
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.12, w * 0.8, 5),
      s * w * 0.65, h * 0.1, len * 0.05,
      0, 0, s * HALF_PI,  // extend laterally
    )));
  }

  // ── Crown canopy (capital ships) ────────────────────────────────────────
  // A spreading hemisphere of interlocked frond-structures at the bow,
  // like the canopy of a great tree. Uses a half-sphere, heavily flattened.
  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 1.1, 8, 6, 0, PI * 2, 0, HALF_PI),
      0, h * 0.15, len * 0.3,
      HALF_PI, 0, 0,
      1.0, 0.3, 1.2,  // wide and flat, like a spreading canopy
    ));
  }

  // ── Sap-line veins (capital ships, geometric ridges) ────────────────────
  // Thin raised ridges tracing the hull like visible vascular channels.
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.015, h * 0.08, len * 0.6),
      s * w * 0.35, h * 0.35, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.015, h * 0.06, len * 0.5),
      s * w * 0.55, h * 0.2, -len * 0.05,
    )));
  }

  // ── Dorsal spine cluster (heavy capitals) ───────────────────────────────
  // Thorny protrusions along the dorsal ridge — mycelial lance conduits
  // that channel bio-electric energy for the ship's heaviest weapons.
  if (cx >= 6) {
    for (let i = 0; i < 5; i++) {
      const zPos = len * (0.2 - i * 0.1);
      const spineH = h * (0.3 + 0.06 * i);
      parts.push(place(
        new THREE.ConeGeometry(w * 0.04, spineH, 4),
        0, h * 0.55 + spineH * 0.35, zPos,
      ));
    }
  }

  // ── Tertiary root web (heavy capitals) ──────────────────────────────────
  // An enormous spreading root system at the stern — the signature of
  // ancient Sylvani capital ships, like the root ball of a world-tree.
  if (cx >= 6) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * PI * 2;
      const rootLen = len * 0.28;
      const splay = w * 0.8;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.05, rootLen, 4),
        Math.cos(angle) * splay,
        Math.sin(angle) * splay,
        -len * 0.55,
        HALF_PI + 0.4 * Math.cos(angle), 0, 0.4 * Math.sin(angle),
      ));
    }
  }

  // ── Bioluminescent sensor nodes (high detail) ───────────────────────────
  // Tiny glowing spheres at branch tips and along the dorsal ridge.
  if (cx >= 7) {
    const nodePositions: [number, number, number][] = [
      [0, h * 0.7, len * 0.25],
      [0, h * 0.7, len * 0.1],
      [0, h * 0.7, -len * 0.05],
      [w * 0.7, h * 0.15, len * 0.05],
      [-w * 0.7, h * 0.15, len * 0.05],
    ];
    for (const [nx, ny, nz] of nodePositions) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.06, 5, 4),
        nx, ny, nz,
      ));
    }
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NEXARI
// ═══════════════════════════════════════════════════════════════════════════════

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
 *  DISTINCTIVENESS: No other species uses the octahedron-and-strut lattice.
 *  Vaelori use crystals but they are singular elegant spires; Nexari are
 *  NETWORKS of crystals.
 */

function buildNexari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;          // lateral spread
  const h = len * 0.2;           // vertical spread
  const coreR = len * 0.09;      // processing core radius
  const strutR = len * 0.008;    // data conduit radius
  const strutSeg = 4;            // low-poly strut cross-section
  const parts: THREE.BufferGeometry[] = [];

  // ── Primary processing core (central octahedron) ─────────────────────────
  parts.push(place(
    new THREE.OctahedronGeometry(coreR * 1.2, 0),
    0, 0, len * 0.05,
    0, 0, 0,
    1.0, 1.0, 1.4,
  ));

  // ── Forward sensor node (small icosahedron) ──────────────────────────────
  parts.push(place(
    new THREE.IcosahedronGeometry(coreR * 0.4, 0),
    0, 0, len * 0.38,
  ));

  // Forward data conduit linking core to sensor
  parts.push(place(
    new THREE.CylinderGeometry(strutR, strutR, len * 0.28, strutSeg),
    0, 0, len * 0.22,
    HALF_PI, 0, 0,
  ));

  // ── Aft field-drive torus ────────────────────────────────────────────────
  parts.push(place(
    new THREE.TorusGeometry(coreR * 1.0, coreR * 0.15, 6, 12),
    0, 0, -len * 0.35,
    HALF_PI, 0, 0,
  ));

  // Aft data conduit linking core to drive ring
  parts.push(place(
    new THREE.CylinderGeometry(strutR, strutR, len * 0.32, strutSeg),
    0, 0, -len * 0.18,
    HALF_PI, 0, 0,
  ));

  // ── Lateral processing nodes (cx >= 1) ──────────────────────────────────
  if (cx >= 1) {
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.7, 0),
      sign * w * 0.7, 0, -len * 0.05,
    )));
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR, strutR, w * 0.55, strutSeg),
      sign * w * 0.35, 0, 0,
      0, 0, HALF_PI,
    )));
  }

  // ── Weapon emitters (cx >= 1) ────────────────────────────────────────────
  if (cx >= 1) {
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.15, len * 0.14, 5),
      sign * w * 0.3, 0, len * 0.42,
      HALF_PI, 0, 0,
    )));
  }

  // ── Dorsal/ventral relay nodes (cx >= 2) ─────────────────────────────────
  if (cx >= 2) {
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.55, 0),
      0, h * 0.7, -len * 0.05,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.55, 0),
      0, -h * 0.7, -len * 0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, h * 0.55, strutSeg),
      0, h * 0.35, -len * 0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, h * 0.55, strutSeg),
      0, -h * 0.35, -len * 0.05,
    ));
  }

  // ── Antenna spars (cx >= 2) ─────────────────────────────────────────────
  if (cx >= 2) {
    parts.push(...mirrorX(sign => place(
      new THREE.CylinderGeometry(strutR * 0.6, strutR * 0.6, h * 1.2, 3),
      sign * w * 0.5, h * 0.6, len * 0.15,
    )));
  }

  // ── Forward lattice expansion (cx >= 3) ──────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(sign => place(
      new THREE.OctahedronGeometry(coreR * 0.5, 0),
      sign * w * 0.45, 0, len * 0.28,
    )));
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
  }

  // ── Secondary drive ring (cx >= 3) ───────────────────────────────────────
  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(coreR * 0.65, coreR * 0.1, 6, 10),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(strutR, strutR, len * 0.09, strutSeg),
      0, 0, -len * 0.395,
      HALF_PI, 0, 0,
    ));
  }

  // ── Aft lattice cluster (cx >= 4) ────────────────────────────────────────
  if (cx >= 4) {
    const aftOff = len * 0.28;
    const aftSpread = w * 0.45;
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        parts.push(place(
          new THREE.OctahedronGeometry(coreR * 0.45, 0),
          x * aftSpread, y * aftSpread * 0.6, -aftOff,
        ));
      }
    }
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
  }

  // ── Capital ship: Gift broadcast array (cx >= 5) ─────────────────────────
  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(coreR * 1.8, coreR * 0.12, 8, 16),
      0, h * 0.6, len * 0.05,
      HALF_PI * 0.15, 0, 0,
    ));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2 + PI * 0.25;
      parts.push(place(
        new THREE.CylinderGeometry(strutR * 1.2, strutR * 1.2, h * 0.5, strutSeg),
        Math.cos(angle) * coreR * 1.2, h * 0.3, Math.sin(angle) * coreR * 1.2 + len * 0.05,
        0.15, 0, angle,
      ));
    }
  }

  // ── Capital ship: additional weapon hardpoints (cx >= 5) ─────────────────
  if (cx >= 5) {
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.2, len * 0.18, 5),
      sign * w * 0.7, 0, len * 0.32,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(sign => place(
      new THREE.ConeGeometry(coreR * 0.12, len * 0.1, 5),
      sign * w * 0.25, h * 0.5, len * 0.35,
      HALF_PI, 0, 0,
    )));
  }

  // ── Heavy capital: outer lattice ring (cx >= 6) ──────────────────────────
  if (cx >= 6) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      const rx = Math.cos(angle) * w * 1.2;
      const ry = Math.sin(angle) * w * 0.8;
      parts.push(place(
        new THREE.OctahedronGeometry(coreR * 0.4, 0),
        rx, ry, -len * 0.08,
      ));
      const dist = Math.sqrt(rx * rx + ry * ry);
      parts.push(place(
        new THREE.CylinderGeometry(strutR, strutR, dist * 0.75, strutSeg),
        rx * 0.5, ry * 0.5, -len * 0.04,
        0, 0, Math.atan2(ry, rx) + HALF_PI,
      ));
    }
  }

  // ── The Silence node (cx >= 6) ───────────────────────────────────────────
  if (cx >= 6) {
    parts.push(place(
      new THREE.OctahedronGeometry(coreR * 0.85, 0),
      0, -h * 0.3, -len * 0.08,
      0, PI * 0.12, 0,
      1.0, 1.0, 1.1,
    ));
  }

  // ── Dreadnought: tertiary lattice spars (cx >= 7) ───────────────────────
  if (cx >= 7) {
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
    for (let y = -1; y <= 1; y++) {
      parts.push(place(
        new THREE.ConeGeometry(coreR * 0.14, len * 0.12, 5),
        0, y * h * 0.35, len * 0.48,
        HALF_PI, 0, 0,
      ));
    }
  }

  // ── Station-class: full lattice sphere (cx >= 8) ─────────────────────────
  if (cx >= 8) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const icoVerts: [number, number, number][] = [
      [ 1,  phi, 0], [-1,  phi, 0], [ 1, -phi, 0], [-1, -phi, 0],
      [ 0,  1,  phi], [ 0, -1,  phi], [ 0,  1, -phi], [ 0, -1, -phi],
    ];
    const icoScale = w * 0.7;
    for (const [vx, vy, vz] of icoVerts) {
      const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
      parts.push(place(
        new THREE.OctahedronGeometry(coreR * 0.3, 0),
        (vx / mag) * icoScale,
        (vy / mag) * icoScale,
        (vz / mag) * icoScale * 0.8,
      ));
    }
    parts.push(place(
      new THREE.TorusGeometry(w * 1.5, coreR * 0.08, 8, 24),
      0, 0, 0,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DRAKMARI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ============================================================================
 * DRAKMARI SHIP DESIGNS — "The Abyssal Fleet"
 * ============================================================================
 *
 * The Drakmari evolved in the lightless abyssal trenches of Pelagis, a
 * high-gravity ocean world. Their ships are the architecture of deep-ocean
 * apex predators: anglerfish silhouettes with split jaw-prows, segmented
 * armour plates, lateral sensor spines, bioluminescent lure-nodes, and
 * tight caudal engine clusters.
 *
 * DISTINCTIVENESS FROM OTHER ORGANICS:
 * - Sylvani are plant/coral — soft, symmetrical, green, photosynthetic.
 * - Vethara are parasitic symbiotes — lumpy, two-toned, tendriled.
 * - Drakmari are deep-ocean predators — angular-organic, dark, with
 *   sharp teal photophore accents and segmented armour plates.
 */

function buildDrakmari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;           // beam (width) — narrower than manta, more eel-like
  const h = len * 0.14;           // draught (height) — slightly taller than wide
  const parts: THREE.BufferGeometry[] = [];

  // ── 1. Main hull: hunched predator body ──────────────────────────────────
  parts.push(place(
    new THREE.SphereGeometry(w * 0.65, 12, 8),
    0, h * 0.05, len * 0.05,
    0, 0, 0,
    0.85, 0.75, 1.6,       // narrow, squat, stretched along Z
  ));

  // ── 2. Jaw-prow: split forward hull ─────────────────────────────────────
  parts.push(...mirrorX(s => place(
    new THREE.ConeGeometry(w * 0.18, len * 0.3, 5),
    s * w * 0.14, -h * 0.08, len * 0.42,
    HALF_PI, 0, s * 0.12,   // slight outward splay
    1, 0.55, 1,              // flattened vertically
  )));

  // Jaw bridge — thin bar connecting the two jaw halves at their root
  parts.push(place(
    new THREE.BoxGeometry(w * 0.28, h * 0.12, len * 0.06),
    0, -h * 0.08, len * 0.28,
  ));

  // ── 3. Caudal tail: tapered aft section ─────────────────────────────────
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.04, w * 0.18, len * 0.38, 6),
    0, 0, -len * 0.42,
    HALF_PI, 0, 0,
  ));

  // ── 4. Dorsal ridge: segmented armour plates ────────────────────────────
  if (cx >= 1) {
    const ridgeCount = Math.min(2 + Math.floor(cx / 2), 5);
    for (let i = 0; i < ridgeCount; i++) {
      const t = i / Math.max(ridgeCount - 1, 1);      // 0..1 along spine
      const zPos = len * (0.25 - t * 0.55);           // fore to aft
      const ridgeH = h * (0.35 - t * 0.12);           // taller forward
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

  // ── 5. Lateral sensor spines (barbels) ──────────────────────────────────
  if (cx >= 1) {
    const spineCount = Math.min(1 + Math.floor(cx / 2), 4);
    for (let i = 0; i < spineCount; i++) {
      const zPos = len * (0.15 - i * 0.15);
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.025, w * 0.55, 4),
        s * w * 0.6, 0, zPos,
        0, 0, s * 0.35,
      )));
    }
  }

  // ── 6. Ventral keel ─────────────────────────────────────────────────────
  if (cx >= 2) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.12, h * 0.2, len * 0.5),
      0, -h * 0.42, len * 0.02,
    ));
  }

  // ── 7. Bioluminescent lure node (prow) ──────────────────────────────────
  if (cx >= 2) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 6, 6),
      0, -h * 0.12, len * 0.56,
    ));
  }

  // ── 8. Ventral intake slits ─────────────────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, h * 0.08, len * 0.18),
      s * w * 0.22, -h * 0.35, len * 0.08,
    )));
  }

  // ── 9. Pectoral fins ───────────────────────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.07, len * 0.22, 4),
      s * w * 0.52, -h * 0.05, len * 0.0,
      HALF_PI * 0.3, 0, s * 0.5,
      1, 0.25, 1,
    )));
  }

  // ── 10. Armour segments ────────────────────────────────────────────────
  if (cx >= 4) {
    for (let i = 0; i < 3; i++) {
      const zPos = len * (0.18 - i * 0.18);
      parts.push(place(
        new THREE.SphereGeometry(w * 0.4, 8, 4, 0, PI * 2, 0, PI * 0.4),
        0, h * 0.15, zPos,
        -0.1, 0, 0,
        1.1, 0.3, 0.6,
      ));
    }
  }

  // ── 11. Lateral weapon spines ──────────────────────────────────────────
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.06, w * 0.35, 4),
      s * w * 0.55, h * 0.08, len * 0.12,
      0, 0, s * 0.6,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.045, 5, 5),
      s * w * 0.72, h * 0.14, len * 0.12,
    )));
  }

  // ── 12. Engine cluster ─────────────────────────────────────────────────
  if (cx >= 3) {
    const engineCount = cx >= 5 ? 3 : 2;
    for (let i = 0; i < engineCount; i++) {
      const angle = (i - (engineCount - 1) / 2) * 0.4;
      const ex = Math.sin(angle) * w * 0.12;
      const ey = Math.cos(angle) * h * 0.08;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.06, len * 0.08, 6),
        ex, ey, -len * 0.58,
        -HALF_PI, 0, 0,
      ));
    }
  }

  // ── 13. Capital: secondary jaw mandibles ───────────────────────────────
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.08, len * 0.18, 4),
      s * w * 0.32, -h * 0.15, len * 0.35,
      HALF_PI, 0, s * 0.2,
      1, 0.4, 1,
    )));
  }

  // ── 14. Capital: lateral photophore arrays ─────────────────────────────
  if (cx >= 5) {
    const nodeCount = Math.min(cx - 2, 5);
    for (let i = 0; i < nodeCount; i++) {
      const zPos = len * (0.2 - i * 0.12);
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.03, 5, 5),
        s * w * 0.48, -h * 0.1, zPos,
      )));
    }
  }

  // ── 15. Capital: dorsal command blister ─────────────────────────────────
  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.18, 8, 6, 0, PI * 2, 0, HALF_PI),
      0, h * 0.38, len * 0.12,
      0, 0, 0,
      1.2, 0.6, 1.0,
    ));
  }

  // ── 16. Capital: ventral heavy weapon bay ──────────────────────────────
  if (cx >= 6) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.2, h * 0.25, len * 0.3),
      0, -h * 0.55, len * 0.05,
    ));
  }

  // ── 17. Capital: aft stabiliser fins ───────────────────────────────────
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.04, len * 0.14, 4),
      s * w * 0.14, h * 0.05, -len * 0.35,
      0, 0, s * 0.7,
      1, 0.2, 1,
    )));
  }

  // ── 18. Mega-capital: secondary dorsal crests ──────────────────────────
  if (cx >= 7) {
    parts.push(...mirrorX(s => {
      const crestShape = new THREE.Shape();
      crestShape.moveTo(0, 0);
      crestShape.lineTo(-h * 0.3, h * 0.5);
      crestShape.lineTo(-h * 0.7, h * 0.15);
      crestShape.lineTo(-h * 0.5, 0);
      crestShape.closePath();
      return place(
        new THREE.ExtrudeGeometry(crestShape, { depth: 0.02, bevelEnabled: false }),
        s * w * 0.25, h * 0.25, -len * 0.1,
        0, HALF_PI, s * 0.15,
      );
    }));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ASHKARI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  ASHKARI SHIP DESIGN — "THE NOMAD'S FORGE"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  The Ashkari are three-thousand-year refugees. Every ship they fly is a
 *  testament to survival. Their vessels are built from whatever was to hand:
 *  salvaged hull plate from alien derelicts, cannibalised engine blocks
 *  traded in backwater bazaars, sensor arrays reverse-engineered from wreckage.
 *  Nothing matches. Nothing was designed to fit together. Everything works anyway.
 *
 *  VISUAL LANGUAGE: ASYMMETRIC PATCHWORK
 *  The defining silhouette trait is deliberate asymmetry. The Ashkari have NONE
 *  of the bilateral symmetry every other species employs. This makes them
 *  unmistakable even as 10-pixel silhouettes.
 */

function buildAshkari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const h = len * 0.18;
  const parts: THREE.BufferGeometry[] = [];

  // ── Core hull — off-centre box, the ship's original salvaged frame ──
  parts.push(place(
    new THREE.BoxGeometry(w * 0.85, h * 0.7, len * 0.48),
    w * 0.06, 0, 0,
    0, 0.035, 0,
  ));

  // ── Cockpit — bolted-on cylinder, offset to port, tilted forward ──
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.2, w * 0.26, len * 0.18, 5),
    -w * 0.22, h * 0.32, len * 0.34,
    HALF_PI, 0, 0.15,
  ));

  // ── Mismatched engines — THE signature Ashkari trait ──
  // Starboard engine: cylindrical nacelle (Drakmari-style trawler unit)
  parts.push(place(
    new THREE.CylinderGeometry(h * 0.2, h * 0.28, len * 0.18, 6),
    w * 0.42, -h * 0.08, -len * 0.38,
    HALF_PI, 0, 0,
  ));
  // Port engine: boxy thrust block (Teranos surplus, retuned)
  parts.push(place(
    new THREE.BoxGeometry(w * 0.32, h * 0.38, len * 0.14),
    -w * 0.38, h * 0.08, -len * 0.40,
    0, 0, 0.06,
  ));

  // ── cx >= 1: Scrap plating ──
  if (cx >= 1) {
    parts.push(place(
      new THREE.BoxGeometry(w * 1.15, h * 0.06, len * 0.38),
      -w * 0.03, h * 0.40, 0.02,
      0.04, 0, -0.02,
    ));
  }

  // ── cx >= 2: Jury-rigged sensor array ──
  if (cx >= 2) {
    parts.push(place(
      new THREE.ConeGeometry(w * 0.22, h * 0.28, 6),
      w * 0.52, h * 0.48, len * 0.12,
      0, 0, 0.1,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, h * 0.5, 4),
      w * 0.52, h * 0.75, len * 0.12,
    ));
  }

  // ── cx >= 3: Cargo container bolted to port side ──
  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.38, h * 0.52, len * 0.28),
      -w * 0.68, -h * 0.06, -len * 0.04,
      0, 0.04, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.18, h * 0.08, len * 0.06),
      -w * 0.48, h * 0.04, len * 0.04,
    ));
  }

  // ── cx >= 4: Welded-on gun gantry ──
  if (cx >= 4) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.42, h * 0.18, len * 0.16),
      w * 0.56, h * 0.38, len * 0.22,
      0, 0, -0.05,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.04, len * 0.18, 4),
      w * 0.56, h * 0.50, len * 0.28,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.12, h * 0.12, len * 0.20),
      -w * 0.44, -h * 0.40, len * 0.16,
      0.08, 0, 0,
    ));
  }

  // ── cx >= 5: Capital ship — secondary hull section ──
  if (cx >= 5) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.65, h * 0.52, len * 0.32),
      w * 0.08, -h * 0.52, len * 0.14,
      0, -0.03, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.06, h * 0.5, 4),
      w * 0.12, -h * 0.24, len * 0.08,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.06, h * 0.5, 4),
      -w * 0.10, -h * 0.24, -len * 0.08,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.16, w * 0.16, len * 0.38, 6),
      -w * 0.35, h * 0.38, -len * 0.08,
      HALF_PI, 0, 0.08,
    ));
  }

  // ── cx >= 6: Antenna forest + additional weapon pods ──
  if (cx >= 6) {
    const masts: [number, number, number, number][] = [
      [w * 0.30, h * 0.65, len * 0.05, h * 0.55],
      [-w * 0.18, h * 0.60, -len * 0.12, h * 0.45],
      [w * 0.48, h * 0.58, -len * 0.20, h * 0.40],
      [-w * 0.42, h * 0.62, len * 0.18, h * 0.50],
    ];
    for (const [mx, my, mz, mh] of masts) {
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.015, mh, 3),
        mx, my, mz,
      ));
    }
    parts.push(place(
      new THREE.BoxGeometry(w * 0.50, h * 0.22, len * 0.18),
      -w * 0.15, h * 0.56, len * 0.26,
      0, 0.06, 0,
    ));
  }

  // ── cx >= 7: Third hull section + heavy weapons ──
  if (cx >= 7) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.55, h * 0.44, len * 0.28),
      -w * 0.55, -h * 0.48, -len * 0.18,
      0, 0.05, 0.03,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.14, h * 0.14, len * 0.55),
      w * 0.04, h * 0.52, len * 0.02,
      0, 0.02, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(h * 0.22, 5, 4),
      w * 0.65, h * 0.10, -len * 0.35,
    ));
  }

  // ── cx >= 8: Station/planet-killer ──
  if (cx >= 8) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.50, h * 0.40, len * 0.26),
      w * 0.58, -h * 0.46, len * 0.06,
      0, -0.04, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, h * 0.06, 4, 8),
      0, 0, 0,
      HALF_PI, 0, 0,
    ));
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, h * 0.65, 3),
        Math.cos(angle) * w * 0.40, h * 0.70, Math.sin(angle) * w * 0.40,
      ));
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.30, 6, 4, 0, PI * 2, 0, HALF_PI),
      -w * 0.02, h * 0.50, -len * 0.25,
      0, 0.3, 0,
    ));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LUMINARI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ============================================================================
 *  LUMINARI SHIP DESIGN — "Vessels of Structured Light"
 * ============================================================================
 *
 *  The Luminari are not organisms. They are self-sustaining electromagnetic
 *  topologies — structured light, organised charge, recursive resonance
 *  patterns that achieved consciousness inside the plasma maelstrom of the
 *  Cygnus Radiant. Their ships are magnetic containment lattices that prevent
 *  a Luminari from dispersing into vacuum. Open lattice geometry with nested
 *  concentric torus rings, energy node spheres, and sail-like antenna spars.
 *
 *  DISTINCTIVENESS: No other species uses open lattice — rods, rings, and
 *  point-nodes with empty space between them. You see through a Luminari ship.
 */

function buildLuminari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];
  const rodR = w * 0.018;                 // slender containment rods
  const nodeSegs = Math.max(6, cx + 4);   // sphere detail scales with cx

  // ── Central energy core ──────────────────────────────────────────────────
  parts.push(place(
    new THREE.SphereGeometry(w * 0.22, nodeSegs, nodeSegs),
    0, 0, 0,
  ));

  // ── Primary containment lattice — four longitudinal rods ─────────────────
  const cageOffset = w * 0.28;
  const cageLen = len * 0.82;
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    0, cageOffset, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    0, -cageOffset, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(...mirrorX(s => place(
    new THREE.CylinderGeometry(rodR, rodR, cageLen, 4),
    s * cageOffset, 0, 0,
    HALF_PI, 0, 0,
  )));

  // ── Transverse braces ────────────────────────────────────────────────────
  const bracePositions = [len * 0.32, -len * 0.32];
  for (const zPos of bracePositions) {
    parts.push(place(
      new THREE.CylinderGeometry(rodR, rodR, cageOffset * 2, 4),
      0, 0, zPos,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(rodR, rodR, cageOffset * 2, 4),
      0, 0, zPos,
      0, 0, HALF_PI,
    ));
  }

  // ── Bow convergence point ────────────────────────────────────────────────
  const bowZ = len * 0.46;
  parts.push(place(
    new THREE.SphereGeometry(w * 0.10, nodeSegs, nodeSegs),
    0, 0, bowZ,
  ));
  const corners: [number, number][] = [
    [cageOffset, 0], [-cageOffset, 0], [0, cageOffset], [0, -cageOffset],
  ];
  for (const [cx_, cy_] of corners) {
    const dx = -cx_;
    const dy = -cy_;
    const dz = bowZ - len * 0.32;
    const rodLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const pitch = -Math.asin(dz / rodLen);
    const yaw = Math.atan2(dx, dy);
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.7, rodR * 0.7, rodLen, 4),
      cx_ * 0.5, cy_ * 0.5, (len * 0.32 + bowZ) * 0.5,
      pitch, yaw, 0,
    ));
  }

  // ── cx >= 2: Side energy nodes ───────────────────────────────────────────
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.07, 5, 5),
      s * cageOffset, 0, len * 0.18,
    )));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 5, 5),
      0, cageOffset, -len * 0.18,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 5, 5),
      0, -cageOffset, -len * 0.18,
    ));
  }

  // ── cx >= 3: Antenna sail spars ──────────────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.45, 3),
      s * w * 0.55, 0, len * 0.05,
      HALF_PI, 0, s * 0.18,
    )));
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.3, 3),
      0, w * 0.5, len * 0.08,
      0.12, 0, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.04, 4, 4),
      s * w * 0.72, 0, len * 0.26,
    )));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.04, 4, 4),
      0, w * 0.63, len * 0.22,
    ));
  }

  // ── cx >= 4: Primary containment ring ────────────────────────────────────
  if (cx >= 4) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.028, 8, 16),
      0, 0, len * 0.08,
      HALF_PI, 0, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(rodR * 0.6, rodR * 0.6, w * 0.3, 4),
      s * w * 0.28, 0, len * 0.08,
      0, 0, HALF_PI,
    )));
  }

  // ── cx >= 5: Secondary aft containment ring ──────────────────────────────
  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.52, w * 0.025, 8, 18),
      0, 0, -len * 0.18,
      HALF_PI, 0, 0,
    ));
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
        new THREE.CylinderGeometry(rodR * 0.6, rodR * 0.6, strutLen, 4),
        (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2,
        Math.acos(dy / strutLen), 0, Math.atan2(dx, dy),
      ));
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.09, 6, 6),
      0, 0, -len * 0.38,
    ));
  }

  // ── cx >= 6: Tilted tertiary ring ────────────────────────────────────────
  if (cx >= 6) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.35, w * 0.022, 6, 14),
      0, 0, len * 0.25,
      HALF_PI + 0.44, 0.3, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.6, 4),
      0, 0, 0,
      HALF_PI, PI / 4, 0.2,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.5, rodR * 0.5, len * 0.6, 4),
      0, 0, 0,
      HALF_PI, -PI / 4, -0.2,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.05, 5, 5),
      s * w * 0.52, 0, len * 0.25,
    )));
  }

  // ── cx >= 7: Node corona and additional antenna spars ────────────────────
  if (cx >= 7) {
    const coronaCount = 6;
    for (let i = 0; i < coronaCount; i++) {
      const angle = (i / coronaCount) * PI * 2;
      const cr = w * 0.32;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.04, 4, 4),
        Math.cos(angle) * cr,
        Math.sin(angle) * cr,
        0,
      ));
    }
    parts.push(place(
      new THREE.CylinderGeometry(rodR * 0.4, rodR * 0.4, len * 0.35, 3),
      0, -w * 0.55, -len * 0.05,
      -0.15, 0, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.035, 4, 4),
      0, -w * 0.72, -len * 0.08,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(rodR * 0.4, rodR * 0.4, len * 0.3, 3),
      s * w * 0.45, 0, -len * 0.25,
      HALF_PI, 0, s * 0.25,
    )));
  }

  // ── cx >= 8: Full nebula capture ─────────────────────────────────────────
  if (cx >= 8) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.25, w * 0.02, 6, 12),
      0, 0, len * 0.36,
      HALF_PI, 0, 0,
    ));
    for (let i = -1; i <= 1; i++) {
      parts.push(place(
        new THREE.CylinderGeometry(rodR * 0.4, rodR * 0.4, len * 0.25, 3),
        0, i * w * 0.2, -len * 0.42,
        HALF_PI + i * 0.2, 0, 0,
      ));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.03, 4, 4),
        0, i * w * 0.25, -len * 0.54,
      ));
    }
    const aftCorona = 5;
    for (let i = 0; i < aftCorona; i++) {
      const angle = (i / aftCorona) * PI * 2 + 0.3;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 4),
        Math.cos(angle) * w * 0.48,
        Math.sin(angle) * w * 0.48,
        -len * 0.18,
      ));
    }
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ZORVATHI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ============================================================================
 *  ZORVATHI SHIP DESIGN — "THE HIVE TAKES FLIGHT"
 * ============================================================================
 *
 *  The Zorvathi are a distributed intelligence of billions of chitinous,
 *  multi-legged, subterranean creatures. Their ships are extensions of the
 *  hive architecture: segmented like the creatures themselves, coated in
 *  secreted bioite carapace, ribbed with geometric pheromone-amplifier
 *  patterns. Mandible prow, paired leg-struts, dorsal carapace ridge,
 *  elytra wing casings, and tail stinger on capitals.
 *
 *  DISTINCTIVENESS: No other species has segmented hulls. The mandible
 *  prow is unique. The leg-struts are unique. The elytra are unique.
 *  A Zorvathi ship is immediately identifiable even as a silhouette.
 */

function buildZorvathi(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const parts: THREE.BufferGeometry[] = [];

  // ── Body segments ─────────────────────────────────────────────────────
  const segCount = Math.min(3 + cx, 7);
  const segLen = len * 0.82 / segCount;

  for (let i = 0; i < segCount; i++) {
    const t = i / (segCount - 1);
    const envelope = Math.sin(Math.max(t, 0.08) * PI) *
                     (1.0 - 0.25 * t);
    const segR = w * (0.35 + 0.65 * envelope);
    const z = (0.5 - t) * len * 0.82;
    parts.push(place(
      new THREE.SphereGeometry(segR, 8, 6),
      0, 0, z,
      0, 0, 0,
      0.85, 0.65, segLen / (segR * 2) * 1.15,
    ));

    if (i > 0 && cx >= 1) {
      const jointZ = z + segLen * 0.5;
      const jointR = segR * 0.75;
      parts.push(place(
        new THREE.TorusGeometry(jointR * 0.5, jointR * 0.08, 4, 8),
        0, 0, jointZ,
        HALF_PI, 0, 0,
        1.3, 1, 0.6,
      ));
    }
  }

  // ── Mandibles (always present) ────────────────────────────────────────
  const mandibleLen = len * (0.10 + 0.02 * Math.min(cx, 4));
  parts.push(place(
    new THREE.ConeGeometry(w * 0.09, mandibleLen, 4),
    w * 0.17, -w * 0.06, len * 0.47,
    HALF_PI * 0.85, PI / 4, 0.25,
  ));
  parts.push(place(
    new THREE.ConeGeometry(w * 0.09, mandibleLen, 4),
    -w * 0.17, -w * 0.06, len * 0.47,
    HALF_PI * 0.85, PI / 4, -0.25,
  ));

  if (cx >= 2) {
    parts.push(place(
      new THREE.ConeGeometry(w * 0.05, mandibleLen * 0.7, 3),
      w * 0.10, -w * 0.08, len * 0.46,
      HALF_PI * 0.9, PI / 3, 0.15,
    ));
    parts.push(place(
      new THREE.ConeGeometry(w * 0.05, mandibleLen * 0.7, 3),
      -w * 0.10, -w * 0.08, len * 0.46,
      HALF_PI * 0.9, PI / 3, -0.15,
    ));
  }

  // ── Sensory antennae (cx >= 1) ────────────────────────────────────────
  if (cx >= 1) {
    const antennaLen = len * 0.18;
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.006, antennaLen, 3),
      s * w * 0.12, w * 0.15, len * 0.48,
      HALF_PI * 0.7, 0, s * 0.35,
    )));
  }

  // ── Leg-struts (cx >= 2) ──────────────────────────────────────────────
  if (cx >= 2) {
    const legPairs = Math.min(2 + Math.floor(cx / 2), 5);
    for (let i = 0; i < legPairs; i++) {
      const legT = (i + 0.5) / legPairs;
      const z = len * (0.3 - legT * 0.6);
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.035, w * 0.025, w * 0.45, 4),
        s * w * 0.38, -w * 0.28, z,
        0, 0, s * 0.55,
      )));
      if (cx >= 3) {
        parts.push(...mirrorX(s => place(
          new THREE.CylinderGeometry(w * 0.02, w * 0.015, w * 0.3, 3),
          s * w * 0.62, -w * 0.48, z,
          0, 0, s * 0.35,
        )));
      }
    }
  }

  // ── Dorsal carapace ridge (cx >= 3) ───────────────────────────────────
  if (cx >= 3) {
    const ridgeH = w * (0.12 + 0.03 * Math.min(cx - 3, 3));
    const ridgeLen = len * 0.55;
    const ridgeShape = new THREE.Shape();
    ridgeShape.moveTo(0, ridgeH);
    ridgeShape.lineTo(w * 0.06, 0);
    ridgeShape.lineTo(-w * 0.06, 0);
    ridgeShape.closePath();
    const ridgeGeo = new THREE.ExtrudeGeometry(ridgeShape, {
      depth: ridgeLen,
      bevelEnabled: false,
    });
    parts.push(place(ridgeGeo, 0, w * 0.42, -ridgeLen * 0.45));

    if (cx >= 4) {
      const nodeCount = 3 + Math.min(cx - 4, 3);
      for (let i = 0; i < nodeCount; i++) {
        const nz = (i / (nodeCount - 1) - 0.5) * ridgeLen * 0.8;
        parts.push(place(
          new THREE.SphereGeometry(w * 0.04, 4, 3),
          0, w * 0.42 + ridgeH * 0.7, nz,
        ));
      }
    }
  }

  // ── Elytra / wing casings (cx >= 4) ──────────────────────────────────
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.6, 7, 5, 0, PI, 0, HALF_PI),
      s * w * 0.32, w * 0.12, len * 0.02,
      HALF_PI, s * 0.45, 0,
      0.18, 1, 1.6,
    )));

    if (cx >= 5) {
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.015, len * 0.35, 3),
        s * w * 0.42, w * 0.22, len * 0.02,
        HALF_PI, 0, s * 0.12,
      )));
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.28, 3),
        s * w * 0.52, w * 0.18, len * -0.02,
        HALF_PI, 0, s * 0.18,
      )));
    }
  }

  // ── Thorax weapon mounts (cx >= 3) ────────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.12, 5, 4),
      s * w * 0.3, w * 0.32, len * 0.15,
      0, 0, 0,
      0.8, 0.6, 1.2,
    )));
  }

  // ── Tail stinger (cx >= 5) ────────────────────────────────────────────
  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.2, 5, 4),
      0, w * 0.05, -len * 0.44,
      0, 0, 0,
      0.8, 0.7, 1.4,
    ));
    parts.push(place(
      new THREE.ConeGeometry(w * 0.08, len * 0.18, 4),
      0, w * 0.08, -len * 0.54,
      HALF_PI, PI / 4, 0,
    ));
    if (cx >= 6) {
      parts.push(...mirrorX(s => place(
        new THREE.ConeGeometry(w * 0.04, len * 0.08, 3),
        s * w * 0.1, w * 0.06, -len * 0.48,
        HALF_PI * 0.6, PI / 3, s * 0.5,
      )));
    }
  }

  // ── Compound eye clusters (cx >= 4) ───────────────────────────────────
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.08, 5, 4, 0, PI * 2, 0, HALF_PI),
      s * w * 0.25, w * 0.1, len * 0.38,
      0.3, s * 0.4, 0,
    )));
  }

  // ── Ventral vibration-drive plates (cx >= 5) ──────────────────────────
  if (cx >= 5) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.6, w * 0.04, len * 0.2),
      0, -w * 0.38, -len * 0.3,
    ));
    if (cx >= 6) {
      parts.push(...mirrorX(s => place(
        new THREE.BoxGeometry(w * 0.2, w * 0.03, len * 0.14),
        s * w * 0.5, -w * 0.35, -len * 0.25,
      )));
    }
  }

  // ── Pheromone relay spines (cx >= 6) ──────────────────────────────────
  if (cx >= 6) {
    const spineCount = Math.min(cx - 4, 4);
    for (let i = 0; i < spineCount; i++) {
      const sz = len * (0.15 - i * 0.12);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.025, w * 0.5, 3),
        0, w * 0.65, sz,
      ));
    }
  }

  // ── Bioite hull plating (cx >= 7) ─────────────────────────────────────
  if (cx >= 7) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, w * 0.4, len * 0.4),
      s * w * 0.65, 0, len * 0.05,
    )));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.5, w * 0.05, len * 0.55),
      0, -w * 0.45, len * 0.02,
    ));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ORIVANI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ORIVANI SHIP DESIGNS — "Cathedrals of the Coming"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Orivani have spent twelve thousand years preparing for the Coming.
 * Every ship is an act of devotion. Vessels that look like flying temples:
 * central nave, spires, pointed prow, flying buttress arcs, rose windows,
 * bell towers. Ivory and sanctified gold material.
 *
 * DISTINCTIVENESS: SPIRES + BUTTRESS ARCS. No other species uses either.
 */

function buildOrivani(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.22;
  const h = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.BoxGeometry(w * 0.55, h * 1.1, len * 0.6),
    0, 0, 0,
  ));

  parts.push(place(
    new THREE.BoxGeometry(w * 0.9, h * 0.5, len * 0.15),
    0, h * 0.05, len * 0.05,
  ));

  parts.push(place(
    new THREE.ConeGeometry(w * 0.35, len * 0.28, 4),
    0, 0, len * 0.44,
    HALF_PI, PI / 4, 0,
  ));

  parts.push(place(
    new THREE.ConeGeometry(w * 0.07, h * 1.4, 4),
    0, h * 0.95, len * 0.05,
  ));

  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.18, h * 0.75, len * 0.42),
    s * w * 0.42, -h * 0.12, -len * 0.02,
  )));

  parts.push(place(
    new THREE.BoxGeometry(w * 0.12, h * 0.15, len * 0.7),
    0, -h * 0.6, 0,
  ));

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.1, h * 0.85, 6),
      s * w * 0.38, h * 0.18, len * 0.22,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.1, h * 0.35, 6),
      s * w * 0.38, h * 0.7, len * 0.22,
    )));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.04, 6, 8),
      0, h * 0.12, len * 0.34,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.25, w * 0.25, h * 0.6, 8, 1, false, 0, PI),
      0, -h * 0.05, -len * 0.32,
      0, PI, 0,
    ));
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.55, w * 0.03, 5, 8, PI * 0.5),
      s * w * 0.52, h * 0.18, len * 0.08,
      0, s * HALF_PI, HALF_PI,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.48, w * 0.025, 5, 8, PI * 0.45),
      s * w * 0.48, h * 0.15, -len * 0.18,
      0, s * HALF_PI, HALF_PI,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.14, h * 0.1, len * 0.1),
      s * w * 0.58, h * 0.52, len * 0.08,
    )));
  }

  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.07, w * 0.09, h * 1.1, 6),
      s * w * 0.52, h * 0.25, -len * 0.22,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.1, h * 0.4, 6),
      s * w * 0.52, h * 0.9, -len * 0.22,
    )));
    parts.push(place(
      new THREE.ConeGeometry(w * 0.055, h * 0.7, 4),
      0, h * 0.7, -len * 0.3,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.22, h * 0.12, len * 0.12),
      0, h * 0.58, len * 0.18,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.18, h * 0.1, len * 0.1),
      0, h * 0.56, -len * 0.08,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.04, h * 0.3, 4),
      s * w * 0.58, h * 0.65, len * 0.08,
    )));
  }

  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.3, w * 0.02, 5, 6, PI * 0.4),
      s * w * 0.3, h * 0.1, -len * 0.35,
      0, s * HALF_PI, HALF_PI,
    )));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.35, h * 0.08, len * 0.5),
      0, h * 0.58, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.05, h * 0.35, 4),
      s * w * 0.45, h * 0.55, len * 0.05,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.035, len * 0.08, 4),
      s * w * 0.3, h * 0.3, len * 0.35,
      HALF_PI * 0.7, s * 0.3, 0,
    )));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KAELENTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ============================================================================
 *  KAELENTH SHIP DESIGN — "The Inheritance of Dust"
 * ============================================================================
 *
 *  The Kaelenth are machines that outlived their gods. Forty-seven million
 *  years of purposeless maintenance. Their ships embody flawless engineering
 *  in service of an unresolvable ache. Mirror-polished chrome with precision
 *  torus rings (the "halo" motif), smooth capsule hulls, flush weapon
 *  blisters, and outrigged nacelle pods.
 *
 *  DISTINCTIVENESS: No other species uses torus rings as a primary motif.
 *  The silhouette is smooth, round, haloed — a constellation of chrome
 *  rosaries drifting through the void.
 */

function buildKaelenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.CapsuleGeometry(w * 0.38, len * 0.52, 10, 14),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  parts.push(place(
    new THREE.TorusGeometry(w * 0.34, w * 0.055, 10, 20),
    0, 0, -len * 0.36,
    HALF_PI, 0, 0,
  ));

  parts.push(place(
    new THREE.SphereGeometry(w * 0.22, 12, 10, 0, PI * 2, 0, HALF_PI),
    0, 0, len * 0.44,
    -HALF_PI, 0, 0,
  ));

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.065, len * 0.16, 5, 8),
      s * w * 0.38, 0, len * 0.12,
      HALF_PI, 0, 0,
    )));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.40, w * 0.035, 8, 20),
      0, 0, len * 0.08,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.12, len * 0.28, 7, 10),
      s * w * 0.58, 0, -len * 0.04,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.14, w * 0.025, 6, 14),
      s * w * 0.58, 0, -len * 0.22,
      HALF_PI, 0, 0,
    )));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.48, w * 0.028, 8, 24),
      0, 0, -len * 0.14,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.30, w * 0.025, 6, 18),
      0, 0, len * 0.30,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.022, w * 0.65, len * 0.38),
      0, w * 0.30, -len * 0.02,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.018, w * 0.35, len * 0.25),
      0, -w * 0.18, -len * 0.08,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.28, w * 0.015, len * 0.12),
      s * w * 0.14, w * 0.45, -len * 0.28,
      0, 0, s * 0.25,
    )));
  }

  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.09, len * 0.20, 6, 8),
      s * w * 0.36, -w * 0.15, -len * 0.10,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.05, len * 0.12, 4, 8),
      s * w * 0.42, 0, -len * 0.20,
      HALF_PI, 0, 0,
    )));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.018, w * 0.012, len * 0.30, 6),
      0, w * 0.42, len * 0.14,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.56, w * 0.022, 8, 28),
      0, 0, len * 0.0,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.040, 6, 20),
      0, 0, -len * 0.25,
      HALF_PI, 0, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.020, len * 0.35, 6),
      s * w * 0.22, 0, len * 0.28,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.015, w * 0.30, len * 0.10),
      s * w * 0.08, w * 0.48, -len * 0.22,
    )));
  }

  if (cx >= 8) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.18, 10, 10),
      0, w * 0.32, len * 0.16,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.20, w * 0.018, 6, 16),
      0, w * 0.32, len * 0.16,
      HALF_PI, 0, 0,
    ));
    for (let i = 0; i < 3; i++) {
      const zOff = len * (-0.10 + i * 0.12);
      parts.push(...mirrorX(s => place(
        new THREE.CapsuleGeometry(w * 0.045, len * 0.08, 4, 6),
        s * w * 0.44, w * 0.08, zOff,
        HALF_PI, 0, 0,
      )));
    }
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.030, 6, 16),
      0, 0, -len * 0.42,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.15, w * 0.025, 6, 12),
      0, 0, -len * 0.45,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  THYRIAQ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ============================================================================
 *  THYRIAQ SHIP DESIGN — "The Geometry That Thinks"
 * ============================================================================
 *
 *  The Thyriaq are the ships. Four billion nanoscale biological machines
 *  aggregate into a coherent volume of matter that reshapes itself for the
 *  task at hand. "Liquid mercury frozen mid-transformation." Amoeboid core
 *  bodies with pseudopod tendrils, toroidal accelerator rings, and no seams
 *  because the entire ship is one continuous material.
 *
 *  DISTINCTIVENESS: No other species uses this vocabulary. Thyriaq have no
 *  anatomy. Their ships are amorphous, mercurial, unsettling.
 */

function buildThyriaq(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.26;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.SphereGeometry(w * 0.55, 10, 8),
    0, 0, len * 0.05,
    0, 0, 0,
    0.85, 0.75, 1.6,
  ));

  parts.push(place(
    new THREE.SphereGeometry(w * 0.38, 8, 7),
    w * 0.06, w * 0.05, len * 0.28,
    0, 0, 0,
    0.8, 0.7, 1.3,
  ));

  parts.push(place(
    new THREE.SphereGeometry(w * 0.42, 8, 6),
    0, -w * 0.08, -len * 0.22,
    0, 0, 0,
    1.1, 0.65, 1.0,
  ));

  const thrusterCount = 3 + Math.floor(cx * 0.5);
  for (let i = 0; i < thrusterCount; i++) {
    const angle = (i / thrusterCount) * PI * 2 + 0.4;
    const tLen = len * (0.12 + 0.02 * cx);
    const spread = w * (0.28 + 0.04 * (i % 2));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.012, tLen, 5),
      Math.cos(angle) * spread,
      Math.sin(angle) * spread * 0.7,
      -len * 0.28 - tLen * 0.3,
      HALF_PI + 0.15 * Math.sin(angle),
      0.1 * Math.cos(angle),
      0,
    ));
  }

  if (cx >= 1) {
    const senseCount = 2 + Math.min(cx, 4);
    for (let i = 0; i < senseCount; i++) {
      const angle = (i / senseCount) * PI * 2;
      const tLen = len * (0.08 + 0.015 * cx);
      parts.push(place(
        new THREE.ConeGeometry(w * 0.06, tLen, 5),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.25,
        len * 0.20 + tLen * 0.2,
        HALF_PI * 0.85, 0, angle * 0.3,
      ));
    }
  }

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.28, 7, 6),
      s * w * 0.42, -w * 0.06, -len * 0.04,
      0, 0, 0,
      0.9, 0.8, 1.1,
    )));
  }

  if (cx >= 2) {
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.12, len * 0.35, 5, 8),
      0, w * 0.22, len * 0.02,
      HALF_PI, 0, 0.15,
    ));
  }

  if (cx >= 3) {
    parts.push(...mirrorX(s => {
      const wpnLen = len * 0.18;
      const stalk = place(
        new THREE.CylinderGeometry(w * 0.05, w * 0.03, wpnLen, 5),
        s * w * 0.48, w * 0.05, len * 0.15,
        HALF_PI * 0.7, s * 0.2, 0,
      );
      return stalk;
    }));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.09, len * 0.06, 6),
      s * w * 0.55, w * 0.08, len * 0.30,
      -HALF_PI, 0, 0,
    )));
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.10, w * 0.02, 6, 12),
      s * w * 0.50, w * 0.06, len * 0.22,
      0, 0, HALF_PI,
    )));
  }

  if (cx >= 4) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.32, 7, 6),
      w * 0.05, -w * 0.30, -len * 0.08,
      0, 0, 0,
      0.85, 0.9, 1.15,
    ));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.40, 9, 7),
      -w * 0.12, w * 0.10, len * 0.32,
      0, 0, 0,
      0.75, 0.70, 1.25,
    ));
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.07, len * 0.18, 4, 6),
      -w * 0.06, w * 0.07, len * 0.20,
      HALF_PI, 0, 0.1,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.02, len * 0.15, 5),
      s * w * 0.55, -w * 0.10, len * 0.05,
      HALF_PI * 0.6, s * 0.3, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.08, w * 0.015, 5, 10),
      s * w * 0.52, -w * 0.08, len * 0.12,
      0, 0, HALF_PI,
    )));
  }

  if (cx >= 6) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.35, 8, 6),
      w * 0.15, w * 0.18, -len * 0.30,
      0, 0, 0,
      0.95, 0.65, 1.1,
    ));
    const nodeAngles = [0, 1.2, 2.4, 3.6, 4.8];
    for (const a of nodeAngles) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.10, 5, 4),
        Math.cos(a) * w * 0.40,
        Math.sin(a) * w * 0.30,
        len * (0.05 + 0.08 * Math.sin(a * 2)),
      ));
    }
    for (let i = 0; i < 6; i++) {
      const fa = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.005, len * 0.10, 3),
        Math.cos(fa) * w * 0.20,
        Math.sin(fa) * w * 0.15,
        len * 0.38,
        HALF_PI * 0.9, fa * 0.1, 0,
      ));
    }
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.45, 9, 7),
      0, -w * 0.35, -len * 0.18,
      0, 0, 0,
      1.0, 0.70, 0.85,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.05, len * 0.12, 4, 6),
      s * w * 0.12, -w * 0.18, -len * 0.08,
      0.4, s * 0.2, 0,
    )));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, w * 0.03, 8, 16),
      0, 0, len * 0.02,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 8) {
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.30, 1),
      0, 0, len * 0.40,
    ));
    for (let r = 0; r < 3; r++) {
      parts.push(place(
        new THREE.TorusGeometry(w * (0.35 + r * 0.12), w * 0.02, 6, 14),
        0, 0, len * (0.10 - r * 0.08),
        HALF_PI, 0, r * 0.3,
      ));
    }
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.30, 7, 6),
      s * w * 0.60, w * 0.15, -len * 0.25,
      0, 0, 0,
      0.8, 0.7, 1.0,
    )));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AETHYN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  AETHYN SHIP DESIGN — "Not Entirely Here"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  The Aethyn are interdimensional pioneers. Their ships are projected into
 *  our 3D space — partial cross-sections of higher-dimensional objects.
 *  Intersecting tori at non-orthogonal angles, floating disconnected polyhedra,
 *  non-orthogonal struts, and nested Platonic solids.
 *
 *  DISTINCTIVENESS: No other species uses intersecting tori or disconnected
 *  floating geometry. This is uniquely Aethyn.
 */

function buildAethyn(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.DodecahedronGeometry(w * 0.42, 0),
    0, 0, 0,
  ));

  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.32, 0),
    0, 0, len * 0.32,
    0.62, 0.85, 0.4,
  ));

  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.24, 0),
    0, 0, -len * 0.28,
    1.05, 0.35, 0.72,
  ));

  parts.push(place(
    new THREE.TorusGeometry(w * 0.52, w * 0.035, 8, 16),
    0, 0, -len * 0.06,
    0.72, 0.38, 0,
  ));

  if (cx >= 1) {
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
  }

  if (cx >= 2) {
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.14, 0),
      w * 0.55, w * 0.3, len * 0.18,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.12, 0),
      -w * 0.5, -w * 0.28, -len * 0.12,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.10, 0),
      w * 0.15, w * 0.55, -len * 0.2,
    ));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.48, w * 0.03, 8, 14),
      0, 0, len * 0.04,
      HALF_PI + 0.42, 0.85, 0,
    ));
  }

  if (cx >= 4) {
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.28, 0),
      0, 0, 0,
      0.32, 0.55, 0.18,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.015, len * 0.42, 4),
      w * 0.15, w * 0.1, 0,
      0.7, 0.2, 1.3,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.015, len * 0.38, 4),
      -w * 0.12, -w * 0.08, len * 0.05,
      1.4, 0.9, 0.3,
    ));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.65, 0),
      0, 0, 0,
      0.5, 0.5, 0.5,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, w * 0.028, 8, 16),
      0, 0, -len * 0.02,
      0.25, HALF_PI + 0.3, 0,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.1, 0),
      w * 0.6, -w * 0.35, len * 0.25,
      0.4, 0.7, 1.1,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.09, 0),
      -w * 0.55, w * 0.4, len * 0.1,
      1.2, 0.3, 0.5,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.08, 0),
      -w * 0.2, -w * 0.5, -len * 0.3,
      0.8, 1.5, 0.2,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.04, 6, 12),
      0, 0, len * 0.42,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 6) {
    for (let i = 0; i < 3; i++) {
      const angle = (PI * 2 * i) / 3;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.6, 4),
        w * 0.3 * Math.cos(angle),
        w * 0.3 * Math.sin(angle),
        0,
        angle * 0.7, 0.5 + i * 0.4, angle * 0.3,
      ));
    }
    parts.push(place(
      new THREE.TorusGeometry(w * 0.62, w * 0.025, 8, 18),
      0, 0, 0,
      1.1, 0.2, HALF_PI,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.13, 0),
      s * w * 0.7, 0, len * 0.15,
      0.9, s * 0.6, 0.3,
    )));
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.8, w * 0.04, 10, 20),
      0, 0, 0,
      HALF_PI + 0.15, 0, 0,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.18, 0),
      w * 0.75, 0, len * 0.2,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.16, 0),
      -w * 0.7, 0, -len * 0.15,
    ));
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.14, 0),
      0, w * 0.7, 0,
    ));
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VETHARA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  VETHARA SHIP DESIGNS — "The Borrowed Fleet"
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  The Vethara are symbiotic neural filaments — eyeless, limbless parasites
 *  that bond with host organisms. Their ships express dual-nature: a pale,
 *  inert HOST HULL (capsule, bone-like) visibly colonised by living red
 *  FILAMENT NETWORKS (spiralling beads, tendril arms, organ pods, membrane).
 *
 *  DISTINCTIVENESS: "Something alive wrapped around something dead." The
 *  dual-layer visual is unique — no other species has this.
 */

function buildVethara(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.24;
  const h = len * 0.18;
  const parts: THREE.BufferGeometry[] = [];

  // Host hull
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.32, w * 0.38, len * 0.6, 10),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.SphereGeometry(w * 0.33, 10, 8),
    0, 0, len * 0.30,
    0, 0, 0,
    1.0, 0.85, 0.65,
  ));
  parts.push(place(
    new THREE.SphereGeometry(w * 0.39, 10, 8),
    0, 0, -len * 0.30,
    0, 0, 0,
    1.0, 0.9, 0.55,
  ));

  // Filament spiral
  const spiralCount = 10 + cx * 4;
  const spiralWraps = 1.5 + cx * 0.25;
  for (let i = 0; i < spiralCount; i++) {
    const t = i / spiralCount;
    const angle = t * PI * 2 * spiralWraps;
    const z = (0.35 - t * 0.7) * len;
    const hullR = w * (0.33 + t * 0.05);
    const filR = hullR + w * 0.06;
    const beadSize = w * (0.05 + cx * 0.003);
    parts.push(place(
      new THREE.SphereGeometry(beadSize, 4, 3),
      Math.cos(angle) * filR,
      Math.sin(angle) * filR,
      z,
    ));
  }

  // Tendril arms (cx >= 2)
  if (cx >= 2) {
    const armCount = Math.min(3 + Math.floor(cx / 2), 6);
    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * PI * 2;
      const armLen = len * (0.15 + cx * 0.01);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.05, armLen, 5),
        Math.cos(angle) * w * 0.34,
        Math.sin(angle) * w * 0.34,
        len * 0.38 + armLen * 0.4,
        HALF_PI + 0.25 * Math.sin(angle),
        0,
        0.25 * Math.cos(angle),
      ));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 3),
        Math.cos(angle) * w * 0.30,
        Math.sin(angle) * w * 0.30,
        len * 0.38 + armLen * 0.85,
      ));
    }
  }

  // Organ pods (cx >= 3)
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.16, 7, 5),
      s * w * 0.48, 0, len * 0.08,
      0, 0, 0,
      1.0, 0.8, 1.3,
    )));
    if (cx >= 4) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.12, 6, 4),
        s * w * 0.46, h * 0.15, -len * 0.12,
        0, 0, 0,
        1.0, 0.75, 1.2,
      )));
    }
  }

  // Enveloping membrane (cx >= 4)
  if (cx >= 4) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.52, 10, 7, 0, PI * 2, 0, PI * 0.5),
      0, w * 0.08, len * 0.02,
      HALF_PI, 0, 0,
      1.0, 0.25, 1.6,
    ));
    for (let i = 0; i < 3; i++) {
      const ridgeX = (i - 1) * w * 0.22;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.5, 4),
        ridgeX, h * 0.35, 0,
        HALF_PI, 0, 0,
      ));
    }
  }

  // Tendril crown (cx >= 5)
  if (cx >= 5) {
    const crownCount = 8;
    for (let i = 0; i < crownCount; i++) {
      const angle = (i / crownCount) * PI * 2;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.04, len * 0.14, 5),
        Math.cos(angle) * w * 0.38,
        Math.sin(angle) * w * 0.38,
        len * 0.44,
        HALF_PI - 0.2, angle, 0,
      ));
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.015, w * 0.5, 3),
        Math.cos(angle) * w * 0.55,
        Math.sin(angle) * w * 0.55,
        len * 0.05,
        0, 0, PI * 0.5 - angle,
      ));
    }
  }

  // Neural nexus dome (cx >= 6)
  if (cx >= 6) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.28, 10, 8, 0, PI * 2, 0, PI * 0.6),
      0, h * 0.45, len * 0.05,
    ));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.035, w * 0.05, h * 0.4, 5),
        Math.cos(angle) * w * 0.15,
        h * 0.25,
        len * 0.05 + Math.sin(angle) * w * 0.15,
      ));
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.22, 8, 6),
      0, -h * 0.4, -len * 0.05,
      0, 0, 0,
      1.2, 0.8, 1.0,
    ));
  }

  // Trailing reproductive filaments (cx >= 7)
  if (cx >= 7) {
    const trailCount = 8;
    for (let i = 0; i < trailCount; i++) {
      const angle = (i / trailCount) * PI * 2;
      const trailLen = len * 0.25;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.04, trailLen, 4),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.35,
        -len * 0.42 - trailLen * 0.4,
        HALF_PI + 0.1 * Math.sin(angle),
        0,
        0.1 * Math.cos(angle),
      ));
      for (let j = 1; j <= 3; j++) {
        const tz = -len * 0.42 - trailLen * (j / 4);
        parts.push(place(
          new THREE.SphereGeometry(w * 0.025, 3, 2),
          Math.cos(angle) * w * (0.35 - j * 0.02),
          Math.sin(angle) * w * (0.35 - j * 0.02),
          tz,
        ));
      }
    }
    parts.push(place(
      new THREE.SphereGeometry(w * 0.25, 8, 6),
      0, 0, -len * 0.38,
      0, 0, 0,
      1.3, 1.3, 0.8,
    ));
  }

  // Metabolic engine cluster
  const engineCount = 1 + Math.min(cx, 4);
  if (engineCount <= 2) {
    for (let i = 0; i < engineCount; i++) {
      const ex = engineCount === 1 ? 0 : (i === 0 ? -w * 0.15 : w * 0.15);
      parts.push(place(
        new THREE.SphereGeometry(w * 0.12, 6, 5),
        ex, 0, -len * 0.36,
      ));
    }
  } else {
    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.1, 6, 5),
        Math.cos(angle) * w * 0.2,
        Math.sin(angle) * w * 0.2,
        -len * 0.36,
      ));
    }
  }

  return merge(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PYRENTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ============================================================================
 *  PYRENTH SHIP DESIGN — "FORGED IN THE MANTLE"
 * ============================================================================
 *
 *  The Pyrenth are geological sculptors — beings who shaped their homeworld's
 *  mantle for four billion years. Their ships look GROWN from a planet's crust.
 *  Basalt monoliths and obsidian shards with magma veins, tectonic plate
 *  armour, caldera command structures, and basalt column engine clusters.
 *
 *  DISTINCTIVENESS: Pyrenth are STONE not metal. Rougher, darker, more
 *  geological. Uses octahedra and tetrahedra, not boxes and cones.
 */

function buildPyrenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const h = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  parts.push(place(
    new THREE.OctahedronGeometry(w * 0.52, 1),
    0, 0, len * 0.02,
    0, 0, 0,
    0.85, 0.6, len * 0.038,
  ));

  parts.push(place(
    new THREE.ConeGeometry(w * 0.18, len * 0.32, 3),
    0, 0, len * 0.42,
    HALF_PI, 0, 0,
  ));

  parts.push(place(
    new THREE.BoxGeometry(w * 0.04, h * 0.35, len * 0.22),
    0, h * 0.15, len * 0.34,
    0.05, 0, 0,
  ));

  if (cx >= 1) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.07, w * 0.12, h * 0.45, 5),
      s * w * 0.32, h * 0.22, -len * 0.08,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.08, 0),
      s * w * 0.32, h * 0.48, -len * 0.08,
      0, s * 0.3, 0,
    )));
  }

  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.18, h * 0.52, len * 0.28),
      s * w * 0.46, -h * 0.08, len * 0.04,
      0, 0, s * 0.18,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.12, h * 0.3, len * 0.18),
      s * w * 0.38, h * 0.22, len * 0.14,
      0.06, 0, s * 0.12,
    )));
  }

  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.06, h * 0.1, len * 0.65),
      0, h * 0.38, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.05, h * 0.06, len * 0.45),
      s * w * 0.2, h * 0.32, len * 0.06,
    )));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.07, h * 0.08, len * 0.4),
      0, -h * 0.35, -len * 0.05,
    ));
  }

  if (cx >= 4) {
    const engineCount = cx >= 6 ? 5 : 3;
    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      const radius = w * (engineCount > 3 ? 0.24 : 0.2);
      const ex = Math.cos(angle) * radius;
      const ey = Math.sin(angle) * radius;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.09, w * 0.11, len * 0.16, 6),
        ex, ey, -len * 0.44,
        HALF_PI, 0, 0,
      ));
      parts.push(place(
        new THREE.ConeGeometry(w * 0.07, len * 0.06, 6),
        ex, ey, -len * 0.50,
        -HALF_PI, 0, 0,
      ));
    }
  }

  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.12, 0),
      s * w * 0.35, h * 0.12, len * 0.22,
      0.2, s * 0.4, 0,
    )));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.04, 4, 6),
      0, h * 0.36, len * 0.15,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.18, 5, 3, 0, PI * 2, 0, HALF_PI),
      0, h * 0.38, len * 0.15,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.32, 1),
      0, -h * 0.22, -len * 0.26,
      0.25, 0.4, 0.15,
      0.75, 0.55, 1.15,
    ));
  }

  if (cx >= 6) {
    const ridgePositions = [-0.2, -0.05, 0.1, 0.25];
    for (let i = 0; i < ridgePositions.length; i++) {
      const zPos = len * ridgePositions[i];
      const yJitter = h * (0.42 + (i % 2) * 0.06);
      const size = w * (0.06 + (i % 3) * 0.02);
      parts.push(place(
        new THREE.IcosahedronGeometry(size, 0),
        w * ((i % 2) - 0.5) * 0.08, yJitter, zPos,
      ));
    }
  }

  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.1, h * 0.6, len * 0.2),
      s * w * 0.52, -h * 0.15, -len * 0.15,
      0, 0, s * 0.25,
    )));
  }

  if (cx >= 7) {
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.2, 0),
      0, 0, len * 0.0,
      0.2, 0.3, 0.1,
    ));
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.08, 0),
      0, h * 0.2, len * 0.36,
      0.3, 0, 0.15,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.06, 0),
      s * w * 0.12, h * 0.18, len * 0.34,
      0.2, s * 0.2, 0,
    )));
  }

  if (cx >= 8) {
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.28, 1),
      0, h * 0.45, len * 0.0,
      0.15, 0.2, 0.1,
      1.0, 0.7, 0.9,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.2, 1),
      w * 0.1, h * 0.42, len * 0.18,
      0.1, -0.15, 0.2,
      0.8, 0.6, 0.75,
    ));
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.06, w * 0.08, len * 0.1, 6),
        Math.cos(angle) * w * 0.5,
        Math.sin(angle) * w * 0.5,
        len * 0.05,
        HALF_PI, 0, 0,
      ));
    }
  }

  return merge(parts);
}

// ─── Builder registry ───────────────────────────────────────────────────────

const BUILDERS: Record<string, ShipBuilder> = {
  teranos:  buildTeranos,
  khazari:  buildKhazari,
  vaelori:  buildVaelori,
  sylvani:  buildSylvani,
  nexari:   buildNexari,
  drakmari: buildDrakmari,
  ashkari:  buildAshkari,
  luminari: buildLuminari,
  zorvathi: buildZorvathi,
  orivani:  buildOrivani,
  kaelenth: buildKaelenth,
  thyriaq:  buildThyriaq,
  aethyn:   buildAethyn,
  vethara:  buildVethara,
  pyrenth:  buildPyrenth,
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate procedural 3D geometry for a species + hull class combination.
 *
 * Ships face along +Z (bow), centred at origin.
 * Scale ranges from ~1.5 units (probe) to ~24 units (battle station).
 */
export function generateShipGeometry(
  speciesId: string,
  hullClass: HullClass,
): THREE.BufferGeometry {
  const builder = BUILDERS[speciesId] ?? BUILDERS.teranos;
  const len = HULL_SCALE[hullClass] ?? 4;
  const cx = HULL_COMPLEXITY[hullClass] ?? 2;
  const geo = builder(len, cx);
  geo.computeVertexNormals();
  return geo;
}

// ─── Materials ──────────────────────────────────────────────────────────────

interface SpeciesMaterialDef {
  color: number;
  emissive: number;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  opacity?: number;
  transparent?: boolean;
}

const SPECIES_MATERIALS: Record<string, SpeciesMaterialDef> = {
  // Teranos — grey-blue utilitarian steel
  teranos: {
    color: 0x7a8d9e,
    emissive: 0x1a2d44,
    emissiveIntensity: 0.18,
    metalness: 0.65,
    roughness: 0.50,
  },
  // Khazari — dark iron with amber forgelight
  khazari: {
    color: 0x554433,
    emissive: 0xff6600,
    emissiveIntensity: 0.25,
    metalness: 0.85,
    roughness: 0.65,
  },
  // Vaelori — pale violet crystal, psychic glow
  vaelori: {
    color: 0xccbbff,
    emissive: 0x7744ee,
    emissiveIntensity: 0.55,
    metalness: 0.25,
    roughness: 0.12,
    opacity: 0.82,
    transparent: true,
  },
  // Sylvani — deep heartwood green, bioluminescent
  sylvani: {
    color: 0x2a4a2a,
    emissive: 0x55cc44,
    emissiveIntensity: 0.35,
    metalness: 0.05,
    roughness: 0.85,
  },
  // Nexari — gunmetal with cool blue data-glow
  nexari: {
    color: 0x4a5565,
    emissive: 0x0099ff,
    emissiveIntensity: 0.4,
    metalness: 0.75,
    roughness: 0.2,
  },
  // Drakmari — deep ocean dark, bioluminescent teal
  drakmari: {
    color: 0x1a2d3d,
    emissive: 0x00ccbb,
    emissiveIntensity: 0.3,
    metalness: 0.25,
    roughness: 0.5,
  },
  // Ashkari — rusted brown, patchwork
  ashkari: {
    color: 0x886644,
    emissive: 0x664422,
    emissiveIntensity: 0.12,
    metalness: 0.5,
    roughness: 0.9,
  },
  // Luminari — near-white, intense golden glow
  luminari: {
    color: 0xffeedd,
    emissive: 0xffcc44,
    emissiveIntensity: 0.8,
    metalness: 0.2,
    roughness: 0.1,
    opacity: 0.7,
    transparent: true,
  },
  // Zorvathi — dark chitin brown, amber highlights
  zorvathi: {
    color: 0x443322,
    emissive: 0xcc8800,
    emissiveIntensity: 0.2,
    metalness: 0.3,
    roughness: 0.75,
  },
  // Orivani — ivory and gold, warm sanctified glow
  orivani: {
    color: 0xeeddcc,
    emissive: 0xffaa33,
    emissiveIntensity: 0.3,
    metalness: 0.45,
    roughness: 0.4,
  },
  // Kaelenth — polished chrome, cool white
  kaelenth: {
    color: 0xddddee,
    emissive: 0x4488cc,
    emissiveIntensity: 0.15,
    metalness: 0.95,
    roughness: 0.05,
  },
  // Thyriaq — liquid silver, shifting highlight
  thyriaq: {
    color: 0xb0c4d8,
    emissive: 0x44aacc,
    emissiveIntensity: 0.40,
    metalness: 0.85,
    roughness: 0.08,
  },
  // Aethyn — deep purple, phase-shift glow
  aethyn: {
    color: 0x5522aa,
    emissive: 0xbb44ff,
    emissiveIntensity: 0.55,
    metalness: 0.35,
    roughness: 0.2,
    opacity: 0.75,
    transparent: true,
  },
  // Vethara — pale bone-grey host hull, red biological glow
  vethara: {
    color: 0xbbaa99,
    emissive: 0xcc2222,
    emissiveIntensity: 0.3,
    metalness: 0.2,
    roughness: 0.6,
  },
  // Pyrenth — obsidian black with magma-orange glow
  pyrenth: {
    color: 0x1a1412,
    emissive: 0xff3300,
    emissiveIntensity: 0.5,
    metalness: 0.55,
    roughness: 0.75,
  },
};

/**
 * Get the standard MeshStandardMaterial for a species' ships.
 *
 * Returns a new material instance each call — the caller is responsible
 * for caching/sharing if desired.
 */
export function getShipMaterial(speciesId: string): THREE.Material {
  const def = SPECIES_MATERIALS[speciesId] ?? SPECIES_MATERIALS.teranos;
  return new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.emissive,
    emissiveIntensity: def.emissiveIntensity,
    metalness: def.metalness,
    roughness: def.roughness,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1.0,
    side: THREE.DoubleSide,
  });
}
