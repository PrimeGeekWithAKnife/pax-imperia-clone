import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

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

export function buildKhazari(len: number, cx: number): THREE.BufferGeometry {
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
