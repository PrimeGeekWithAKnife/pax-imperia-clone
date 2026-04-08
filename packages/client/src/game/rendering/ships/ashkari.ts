import * as THREE from 'three';
import { place, merge, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../shipHardpoints';

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
 *
 *  DESIGN DETAILS:
 *  - Off-centre cockpit, mismatched port/starboard engines
 *  - Patchwork hull plates bolted at angles with visible weld-seam ridges
 *  - Bolted-on gantry turrets with visible barrel cylinders
 *  - External cargo container racks on higher-complexity ships
 *  - No mirrorX calls — every placement is hand-positioned for asymmetry
 */

export function buildAshkari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.32;
  const h = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  //  BASE HULL — cx=0 (5 parts minimum)
  //  The original salvaged frame: an off-centre box with patchwork plating
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Primary hull block — offset to starboard, slightly yawed ──
  parts.push(place(
    new THREE.BoxGeometry(w * 0.85, h * 0.7, len * 0.48),
    w * 0.06, 0, 0,
    0, 0.035, 0,
  ));

  // ── Cockpit — bolted-on cylinder, offset to port, tilted forward ──
  //    Pentagonal cross-section (5 segments) — salvaged Luminari escape pod
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.18, w * 0.24, len * 0.16, 5),
    -w * 0.24, h * 0.30, len * 0.36,
    HALF_PI, 0, 0.15,
  ));

  // ── Cockpit weld collar — ring where cockpit meets hull ──
  parts.push(place(
    new THREE.TorusGeometry(w * 0.21, w * 0.035, 4, 5),
    -w * 0.24, h * 0.30, len * 0.28,
    HALF_PI, 0, 0.15,
  ));

  // ── Mismatched engines — THE signature Ashkari trait ──
  // Starboard engine: cylindrical nacelle (Drakmari-style trawler unit)
  parts.push(place(
    new THREE.CylinderGeometry(h * 0.20, h * 0.30, len * 0.20, 6),
    w * 0.44, -h * 0.08, -len * 0.38,
    HALF_PI, 0, 0,
  ));
  // Port engine: boxy thrust block (Teranos surplus, retuned)
  parts.push(place(
    new THREE.BoxGeometry(w * 0.34, h * 0.40, len * 0.16),
    -w * 0.40, h * 0.10, -len * 0.40,
    0, 0, 0.06,
  ));

  // ── Starboard engine exhaust bell — cone flared backwards ──
  parts.push(place(
    new THREE.ConeGeometry(h * 0.34, len * 0.10, 6),
    w * 0.44, -h * 0.08, -len * 0.50,
    HALF_PI + PI, 0, 0,
  ));

  // ── Port engine heat fins — thin slab venting sideways ──
  parts.push(place(
    new THREE.BoxGeometry(w * 0.06, h * 0.55, len * 0.10),
    -w * 0.58, h * 0.10, -len * 0.40,
    0, 0, 0.08,
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 1: Scrap-plated hull reinforcement
  //  Salvaged panels bolted on at angles — each one from a different wreck
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 1) {
    // Top armour plate — wide, slightly canted
    parts.push(place(
      new THREE.BoxGeometry(w * 1.15, h * 0.06, len * 0.38),
      -w * 0.03, h * 0.40, 0.02,
      0.04, 0, -0.02,
    ));
    // Starboard weld seam — thin ridge along joint
    parts.push(place(
      new THREE.BoxGeometry(w * 0.03, h * 0.08, len * 0.36),
      w * 0.44, h * 0.38, 0.02,
      0.04, 0, 0,
    ));
    // Belly patch plate — smaller, offset to port
    parts.push(place(
      new THREE.BoxGeometry(w * 0.60, h * 0.05, len * 0.28),
      -w * 0.14, -h * 0.38, len * 0.06,
      -0.03, 0.02, 0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 2: Jury-rigged sensor array + secondary hull patch
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 2) {
    // Sensor dish — hexagonal cone, starboard-upper
    parts.push(place(
      new THREE.ConeGeometry(w * 0.22, h * 0.28, 6),
      w * 0.52, h * 0.48, len * 0.12,
      0, 0, 0.1,
    ));
    // Sensor mast
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, h * 0.50, 4),
      w * 0.52, h * 0.75, len * 0.12,
    ));
    // Hull gusset plate — triangular reinforcement (wedge via cone)
    parts.push(place(
      new THREE.ConeGeometry(w * 0.16, h * 0.10, 3),
      w * 0.30, -h * 0.36, len * 0.18,
      0, 0, PI,
    ));
    // Weld seam along gusset
    parts.push(place(
      new THREE.BoxGeometry(w * 0.02, h * 0.04, len * 0.22),
      w * 0.30, -h * 0.32, len * 0.10,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 3: Cargo container + structural bracing
  //  External container bolted to port — Ashkari never waste internal space
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 3) {
    // Port cargo container
    parts.push(place(
      new THREE.BoxGeometry(w * 0.38, h * 0.52, len * 0.28),
      -w * 0.68, -h * 0.06, -len * 0.04,
      0, 0.04, 0,
    ));
    // Container mounting bracket — upper
    parts.push(place(
      new THREE.BoxGeometry(w * 0.18, h * 0.08, len * 0.06),
      -w * 0.48, h * 0.04, len * 0.04,
    ));
    // Container mounting bracket — lower
    parts.push(place(
      new THREE.BoxGeometry(w * 0.16, h * 0.07, len * 0.06),
      -w * 0.48, -h * 0.28, -len * 0.08,
    ));
    // Weld seam strip along container join
    parts.push(place(
      new THREE.BoxGeometry(w * 0.03, h * 0.54, len * 0.03),
      -w * 0.49, -h * 0.06, -len * 0.04,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 4: Weapons gantry — bolted-on turrets with visible barrels
  //  Each turret is a different salvaged weapon system
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 4) {
    // Starboard dorsal gantry platform
    parts.push(place(
      new THREE.BoxGeometry(w * 0.42, h * 0.10, len * 0.18),
      w * 0.56, h * 0.36, len * 0.22,
      0, 0, -0.05,
    ));
    // Gantry turret base — hexagonal
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.10, w * 0.12, h * 0.10, 6),
      w * 0.56, h * 0.44, len * 0.24,
    ));
    // Main gun barrel — cylinder extending forward
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.035, w * 0.035, len * 0.22, 4),
      w * 0.56, h * 0.48, len * 0.34,
      HALF_PI, 0, 0,
    ));
    // Ventral weapons pod — port side, different from dorsal
    parts.push(place(
      new THREE.BoxGeometry(w * 0.14, h * 0.12, len * 0.22),
      -w * 0.44, -h * 0.42, len * 0.16,
      0.08, 0, 0,
    ));
    // Ventral barrel — thinner, longer
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.18, 4),
      -w * 0.44, -h * 0.42, len * 0.30,
      HALF_PI, 0, 0,
    ));
    // Gantry support strut
    parts.push(place(
      new THREE.BoxGeometry(w * 0.04, h * 0.28, len * 0.04),
      w * 0.56, h * 0.22, len * 0.22,
      0, 0, -0.05,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 5: Capital ship — secondary hull + patchwork expansion
  //  A second hull section welded underneath, connected by struts
  //  20+ parts total by this point
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 5) {
    // Secondary hull — ventral, offset starboard
    parts.push(place(
      new THREE.BoxGeometry(w * 0.65, h * 0.52, len * 0.32),
      w * 0.08, -h * 0.54, len * 0.14,
      0, -0.03, 0,
    ));
    // Connecting strut — fore
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.06, h * 0.50, 4),
      w * 0.14, -h * 0.26, len * 0.22,
    ));
    // Connecting strut — aft
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.06, h * 0.50, 4),
      -w * 0.10, -h * 0.26, len * 0.04,
    ));
    // Third engine — cone style, underslung on secondary hull
    //   Different from both main engines — truly mismatched trio
    parts.push(place(
      new THREE.ConeGeometry(h * 0.22, len * 0.16, 5),
      w * 0.20, -h * 0.58, -len * 0.32,
      HALF_PI + PI, 0, 0.12,
    ));
    // Weld seam — long ridge where secondary hull meets primary
    parts.push(place(
      new THREE.BoxGeometry(w * 0.60, h * 0.04, len * 0.03),
      w * 0.08, -h * 0.28, len * 0.14,
      0, -0.03, 0,
    ));
    // Secondary hull patch plate — angle-welded
    parts.push(place(
      new THREE.BoxGeometry(w * 0.50, h * 0.05, len * 0.20),
      w * 0.12, -h * 0.80, len * 0.10,
      0.05, 0, 0.02,
    ));
    // Dorsal spine — salvaged structural beam
    parts.push(place(
      new THREE.BoxGeometry(w * 0.06, h * 0.06, len * 0.45),
      w * 0.04, h * 0.44, -len * 0.04,
      0, 0.02, 0,
    ));
    // Port-side sensor blister — asymmetric bump
    parts.push(place(
      new THREE.SphereGeometry(w * 0.10, 4, 3),
      -w * 0.48, h * 0.20, len * 0.18,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 6: External cargo racks + antenna forest
  //  Containers lashed to the hull in asymmetric clusters
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 6) {
    // Starboard cargo rack frame
    parts.push(place(
      new THREE.BoxGeometry(w * 0.08, h * 0.60, len * 0.04),
      w * 0.62, -h * 0.06, len * 0.10,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.08, h * 0.60, len * 0.04),
      w * 0.62, -h * 0.06, -len * 0.14,
    ));
    // Cargo containers — 3 stacked, different sizes
    parts.push(place(
      new THREE.BoxGeometry(w * 0.24, h * 0.18, len * 0.22),
      w * 0.72, h * 0.16, -len * 0.02,
      0, 0.03, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.20, h * 0.16, len * 0.18),
      w * 0.70, -h * 0.02, -len * 0.04,
      0, -0.02, 0.02,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.26, h * 0.20, len * 0.20),
      w * 0.74, -h * 0.22, 0,
      0, 0.01, -0.03,
    ));
    // Antenna masts — irregular spacing and heights
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
    // Antenna cross-bar — links two masts
    parts.push(place(
      new THREE.BoxGeometry(w * 0.48, h * 0.02, len * 0.02),
      w * 0.06, h * 0.88, -len * 0.04,
      0, 0, 0.04,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 7: Third hull section + heavy weapons + more patchwork
  //  Ship is now a proper Ashkari dreadnought — bolted-together monster
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 7) {
    // Third hull section — port-ventral, angled differently from secondary
    parts.push(place(
      new THREE.BoxGeometry(w * 0.55, h * 0.44, len * 0.28),
      -w * 0.55, -h * 0.48, -len * 0.18,
      0, 0.05, 0.03,
    ));
    // Heavy weapon spine — long rail gun
    parts.push(place(
      new THREE.BoxGeometry(w * 0.14, h * 0.14, len * 0.55),
      w * 0.04, h * 0.52, len * 0.02,
      0, 0.02, 0,
    ));
    // Rail gun barrel tip — tapered cylinder
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.08, len * 0.12, 4),
      w * 0.04, h * 0.52, len * 0.32,
      HALF_PI, 0, 0,
    ));
    // Salvaged turret dome — starboard aft
    parts.push(place(
      new THREE.SphereGeometry(h * 0.22, 5, 4),
      w * 0.65, h * 0.10, -len * 0.35,
    ));
    // Turret barrel pair
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.16, 4),
      w * 0.68, h * 0.14, -len * 0.22,
      HALF_PI, 0, 0.06,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.14, 4),
      w * 0.62, h * 0.06, -len * 0.22,
      HALF_PI, 0, -0.04,
    ));
    // Weld seams on third hull
    parts.push(place(
      new THREE.BoxGeometry(w * 0.03, h * 0.46, len * 0.03),
      -w * 0.30, -h * 0.48, -len * 0.18,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.55, h * 0.03, len * 0.03),
      -w * 0.55, -h * 0.26, -len * 0.18,
      0, 0.05, 0,
    ));
    // Ventral heat radiator — port only (asymmetric)
    parts.push(place(
      new THREE.BoxGeometry(w * 0.04, h * 0.35, len * 0.18),
      -w * 0.78, -h * 0.40, -len * 0.10,
      0.06, 0, 0,
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  cx >= 8: Station/dreadnought — the full Ashkari junkyard cathedral
  //  Salvage ring, antenna forest, additional weapon pods
  // ═══════════════════════════════════════════════════════════════════════════
  if (cx >= 8) {
    // Starboard expansion module — bolted on at an angle
    parts.push(place(
      new THREE.BoxGeometry(w * 0.50, h * 0.40, len * 0.26),
      w * 0.58, -h * 0.46, len * 0.06,
      0, -0.04, 0,
    ));
    // Salvage grapple ring — torus around midships
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, h * 0.06, 4, 8),
      0, 0, 0,
      HALF_PI, 0, 0,
    ));
    // Ring support pylons — irregular spacing (NOT evenly distributed)
    const pylonAngles = [0.3, 1.2, 2.5, 3.6, 4.8, 5.7];
    for (const angle of pylonAngles) {
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, h * 0.65, 3),
        Math.cos(angle) * w * 0.40, h * 0.70, Math.sin(angle) * w * 0.40,
      ));
    }
    // Salvaged habitat dome — half-sphere, port-dorsal
    parts.push(place(
      new THREE.SphereGeometry(w * 0.30, 6, 4, 0, PI * 2, 0, HALF_PI),
      -w * 0.02, h * 0.50, -len * 0.25,
      0, 0.3, 0,
    ));
    // Extra bolted plate across expansion module
    parts.push(place(
      new THREE.BoxGeometry(w * 0.48, h * 0.04, len * 0.22),
      w * 0.58, -h * 0.26, len * 0.06,
      0.03, -0.04, 0,
    ));
    // Dorsal point-defence turret
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.08, h * 0.08, 5),
      -w * 0.20, h * 0.58, -len * 0.12,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, len * 0.10, 3),
      -w * 0.20, h * 0.62, -len * 0.06,
      HALF_PI, 0, 0.08,
    ));
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getAshkariHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.32;
  const h = len * 0.25;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── ASYMMETRIC ENGINE PLACEMENT ───────────────────────────────────────────
  // Ashkari deliberately avoid mirrorX — every position is hand-placed.

  // Starboard engine — cylindrical nacelle with exhaust bell at z = -len * 0.50
  engines.push({
    position: new THREE.Vector3(w * 0.44, -h * 0.08, -len * 0.50),
    direction: new THREE.Vector3(0, 0, -1),
    radius: h * 0.34,
  });

  // Port engine — boxy thrust block, exhaust at rear face of box
  engines.push({
    position: new THREE.Vector3(-w * 0.40, h * 0.10, -len * 0.48),
    direction: new THREE.Vector3(0, 0, -1),
    radius: h * 0.20,
  });

  // ── Third engine — underslung on secondary hull (cx >= 5) ─────────────────
  if (cx >= 5) {
    engines.push({
      position: new THREE.Vector3(w * 0.20, -h * 0.58, -len * 0.40),
      direction: new THREE.Vector3(0, 0, -1),
      radius: h * 0.22,
    });
  }

  // ── Starboard dorsal gantry turret (cx >= 4) ─────────────────────────────
  if (cx >= 4) {
    weapons.push({
      position: new THREE.Vector3(w * 0.56, h * 0.48, len * 0.34),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });

    // Ventral weapons pod — port side
    weapons.push({
      position: new THREE.Vector3(-w * 0.44, -h * 0.42, len * 0.30),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });
  }

  // ── Heavy weapon spine — dorsal rail gun (cx >= 7) ────────────────────────
  if (cx >= 7) {
    weapons.push({
      position: new THREE.Vector3(w * 0.04, h * 0.52, len * 0.32),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });

    // Salvaged turret dome — starboard aft
    weapons.push({
      position: new THREE.Vector3(w * 0.65, h * 0.10, -len * 0.35),
      facing: 'turret',
      normal: new THREE.Vector3(0, 1, 0),
    });
  }

  // ── Dorsal point-defence turret (cx >= 8) ─────────────────────────────────
  if (cx >= 8) {
    weapons.push({
      position: new THREE.Vector3(-w * 0.20, h * 0.62, -len * 0.06),
      facing: 'dorsal',
      normal: new THREE.Vector3(0, 1, 0),
    });
  }

  return { engines, weapons };
}

registerHardpointProvider('ashkari', getAshkariHardpoints);
