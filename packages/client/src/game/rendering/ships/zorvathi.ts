import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../shipHardpoints';

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
 *  BODY PLAN: Arthropod architecture throughout.
 *    Head (cephalon) — mandible prow, compound eye domes, antennae
 *    Thorax — weapon blisters, leg-strut attachment points, elytra roots
 *    Abdomen — segmented aft hull, tapering to stinger on capitals
 *
 *  DISTINCTIVENESS: No other species has segmented hulls. The mandible
 *  prow is unique. The leg-struts are unique. The elytra are unique.
 *  A Zorvathi ship is immediately identifiable even as a silhouette.
 */

export function buildZorvathi(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.40;
  const h = len * 0.10;
  const parts: THREE.BufferGeometry[] = [];

  // ── 1. Flat beetle carapace — very wide, very flat disc ────────────────
  // A single dominant squashed sphere creates a beetle/disc silhouette
  // that is RADICALLY different from elongated shapes. Width dominates.
  const carapaceGeo = new THREE.SphereGeometry(w * 0.9, 12, 8);
  parts.push(place(
    carapaceGeo,
    0, 0, len * 0.05,
    0, 0, 0,
    1.0, 0.25, 0.7,  // wide, very flat, slightly shorter than wide
  ));

  // ── 2. Ventral plate — flat underside like real arthropods ────────────
  parts.push(place(
    new THREE.BoxGeometry(w * 1.4, w * 0.06, len * 0.55),
    0, -w * 0.20, len * 0.05,
  ));

  // ── 3. Cephalon (head) detailing ──────────────────────────────────────
  // Slightly flattened forward shield plate over the head
  parts.push(place(
    new THREE.SphereGeometry(w * 0.38, 8, 6, 0, PI * 2, 0, HALF_PI * 0.8),
    0, w * 0.08, len * 0.42,
    0.2, 0, 0,
    1.1, 0.45, 0.8,
  ));

  // ── 4. Mandible prow — always present ─────────────────────────────────
  // Primary mandibles: curved, pointed, slightly diverging
  const mandibleLen = len * (0.11 + 0.025 * Math.min(cx, 5));
  parts.push(...mirrorX(s => place(
    new THREE.ConeGeometry(w * 0.09, mandibleLen, 5),
    s * w * 0.17, -w * 0.07, len * 0.47,
    HALF_PI * 0.85, PI / 4, s * 0.25,
  )));

  // Mandible root bulge — muscular attachment point
  parts.push(...mirrorX(s => place(
    new THREE.SphereGeometry(w * 0.07, 5, 4),
    s * w * 0.15, -w * 0.03, len * 0.40,
    0, 0, 0,
    0.7, 0.6, 1.1,
  )));

  // Secondary inner mandibles (cx >= 2) — smaller, sharper
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.05, mandibleLen * 0.65, 3),
      s * w * 0.10, -w * 0.09, len * 0.46,
      HALF_PI * 0.9, PI / 3, s * 0.15,
    )));
  }

  // Tertiary feeding palps (cx >= 5) — fine manipulator appendages
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.015, w * 0.008, mandibleLen * 0.5, 3),
      s * w * 0.06, -w * 0.12, len * 0.48,
      HALF_PI * 0.95, 0, s * 0.1,
    )));
  }

  // ── 5. Sensory antennae ───────────────────────────────────────────────
  // Present from cx=0 — even scouts need to sense the hive-field
  const antennaLen = len * (0.16 + 0.02 * Math.min(cx, 4));
  parts.push(...mirrorX(s => place(
    new THREE.CylinderGeometry(w * 0.014, w * 0.005, antennaLen, 3),
    s * w * 0.12, w * 0.16, len * 0.44,
    HALF_PI * 0.7, 0, s * 0.35,
  )));

  // Antenna bulb tips (pheromone receptors)
  parts.push(...mirrorX(s => {
    const tipX = s * w * 0.12 + s * Math.sin(0.35) * antennaLen * 0.45;
    const tipY = w * 0.16 + Math.cos(0.35) * antennaLen * 0.12;
    const tipZ = len * 0.44 + antennaLen * 0.35;
    return place(
      new THREE.SphereGeometry(w * 0.02, 4, 3),
      tipX, tipY, tipZ,
    );
  }));

  // Secondary antennae on capitals (cx >= 6) — shorter, lateral
  if (cx >= 6) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.01, w * 0.004, antennaLen * 0.6, 3),
      s * w * 0.20, w * 0.12, len * 0.42,
      HALF_PI * 0.5, 0, s * 0.55,
    )));
  }

  // ── 6. Compound eye sensor domes ──────────────────────────────────────
  // Hemispherical faceted domes — always present, grow with cx
  parts.push(...mirrorX(s => place(
    new THREE.SphereGeometry(w * (0.07 + 0.01 * Math.min(cx, 4)), 6, 5,
      0, PI * 2, 0, HALF_PI),
    s * w * 0.26, w * 0.08, len * 0.38,
    0.3, s * 0.4, 0,
  )));

  // Secondary eye cluster (cx >= 4) — smaller lateral pair
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.05, 5, 4, 0, PI * 2, 0, HALF_PI),
      s * w * 0.32, w * 0.02, len * 0.36,
      0.15, s * 0.6, 0,
    )));
  }

  // Ventral ocelli (cx >= 7) — simple eye spots on the underside
  if (cx >= 7) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.03, 4, 3, 0, PI * 2, 0, HALF_PI),
      s * w * 0.18, -w * 0.18, len * 0.37,
      PI * 0.8, s * 0.3, 0,
    )));
  }

  // ── 7. Leg-struts — articulated hip + lower limb ──────────────────────
  if (cx >= 1) {
    const legPairs = Math.min(2 + Math.floor(cx / 2), 5);
    for (let i = 0; i < legPairs; i++) {
      const legT = (i + 0.5) / legPairs;
      const z = len * (0.28 - legT * 0.62);

      // Hip joint — spherical ball socket
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.04, 5, 4),
        s * w * 0.32, -w * 0.15, z,
      )));

      // Upper limb (coxa/trochanter) — angled outward and down
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.035, w * 0.028, w * 0.42, 5),
        s * w * 0.42, -w * 0.30, z,
        0, 0, s * 0.55,
      )));

      // Knee joint (cx >= 2)
      if (cx >= 2) {
        parts.push(...mirrorX(s => place(
          new THREE.SphereGeometry(w * 0.03, 4, 3),
          s * w * 0.58, -w * 0.46, z,
        )));
      }

      // Lower limb (tibia/tarsus) — thinner, angled further down (cx >= 2)
      if (cx >= 2) {
        parts.push(...mirrorX(s => place(
          new THREE.CylinderGeometry(w * 0.022, w * 0.014, w * 0.35, 4),
          s * w * 0.66, -w * 0.58, z,
          0, 0, s * 0.3,
        )));
      }

      // Foot pad / tarsus claw (cx >= 4)
      if (cx >= 4) {
        parts.push(...mirrorX(s => place(
          new THREE.ConeGeometry(w * 0.018, w * 0.08, 3),
          s * w * 0.72, -w * 0.72, z,
          0, 0, s * 0.15,
        )));
      }
    }
  }

  // ── 8. Dorsal carapace ridge — extruded triangular with nodules ───────
  if (cx >= 2) {
    const ridgeH = w * (0.13 + 0.035 * Math.min(cx - 2, 4));
    const ridgeLen = len * (0.50 + 0.04 * Math.min(cx, 4));
    const ridgeShape = new THREE.Shape();
    ridgeShape.moveTo(0, ridgeH);
    ridgeShape.lineTo(w * 0.065, 0);
    ridgeShape.lineTo(-w * 0.065, 0);
    ridgeShape.closePath();
    const ridgeGeo = new THREE.ExtrudeGeometry(ridgeShape, {
      depth: ridgeLen,
      bevelEnabled: false,
    });
    parts.push(place(ridgeGeo, 0, w * 0.40, -ridgeLen * 0.42));

    // Ridge nodules — bioite secretion bumps along the crest
    if (cx >= 3) {
      const nodeCount = 3 + Math.min(cx - 3, 4);
      for (let i = 0; i < nodeCount; i++) {
        const nt = i / (nodeCount - 1);
        const nz = (nt - 0.5) * ridgeLen * 0.85;
        const nodeSize = w * (0.04 + 0.005 * Math.sin(nt * PI));
        parts.push(place(
          new THREE.SphereGeometry(nodeSize, 5, 4),
          0, w * 0.40 + ridgeH * 0.75, nz,
        ));
      }
    }

    // Lateral ridge buttresses (cx >= 5) — flying-buttress supports
    if (cx >= 5) {
      const buttCount = Math.min(cx - 3, 4);
      for (let i = 0; i < buttCount; i++) {
        const bz = (i / Math.max(buttCount - 1, 1) - 0.5) * ridgeLen * 0.6;
        parts.push(...mirrorX(s => place(
          new THREE.CylinderGeometry(w * 0.015, w * 0.025, w * 0.22, 4),
          s * w * 0.08, w * 0.32, bz,
          0, 0, s * 0.6,
        )));
      }
    }
  }

  // ── 9. Elytra / wing casings ──────────────────────────────────────────
  if (cx >= 3) {
    // Main elytra — half-sphere shells over the thorax dorsal surface
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.58, 8, 6, 0, PI, 0, HALF_PI),
      s * w * 0.30, w * 0.14, len * 0.02,
      HALF_PI, s * 0.45, 0,
      0.18, 1, 1.55,
    )));

    // Elytra hinge line (cx >= 4) — ridge where elytra meets body
    if (cx >= 4) {
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.018, w * 0.018, len * 0.38, 4),
        s * w * 0.22, w * 0.28, len * 0.02,
        HALF_PI, 0, 0,
      )));
    }

    // Elytra vein ribs (cx >= 5) — structural lines on the wing casing
    if (cx >= 5) {
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.012, len * 0.32, 3),
        s * w * 0.40, w * 0.22, len * 0.02,
        HALF_PI, 0, s * 0.12,
      )));
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.010, len * 0.25, 3),
        s * w * 0.50, w * 0.18, len * -0.02,
        HALF_PI, 0, s * 0.18,
      )));
    }

    // Elytra trailing edge detail (cx >= 6)
    if (cx >= 6) {
      parts.push(...mirrorX(s => place(
        new THREE.BoxGeometry(w * 0.03, w * 0.02, len * 0.28),
        s * w * 0.56, w * 0.10, len * -0.04,
      )));
    }
  }

  // ── 10. Thorax weapon blisters ────────────────────────────────────────
  if (cx >= 2) {
    // Primary blisters — swollen turret mounts on thorax flanks
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.12, 6, 5),
      s * w * 0.30, w * 0.28, len * 0.15,
      0, 0, 0,
      0.8, 0.55, 1.2,
    )));

    // Blister barrel (cx >= 3) — stubby weapon tube protruding forward
    if (cx >= 3) {
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.025, w * 0.03, w * 0.18, 5),
        s * w * 0.30, w * 0.28, len * 0.22,
        HALF_PI, 0, 0,
      )));
    }

    // Secondary ventral blister pair (cx >= 5)
    if (cx >= 5) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.08, 5, 4),
        s * w * 0.25, -w * 0.15, len * 0.12,
        0, 0, 0,
        0.7, 0.5, 1.1,
      )));
    }

    // Dorsal spine turret (cx >= 6) — centreline weapon on the ridge
    if (cx >= 6) {
      parts.push(place(
        new THREE.SphereGeometry(w * 0.10, 6, 5),
        0, w * 0.55, len * 0.08,
        0, 0, 0,
        0.9, 0.6, 1.0,
      ));
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.025, w * 0.22, 4),
        0, w * 0.55, len * 0.18,
        HALF_PI, 0, 0,
      ));
    }
  }

  // ── 11. Spiracle vents — breathing ports along the hull ───────────────
  if (cx >= 2) {
    const ventCount = Math.min(2 + Math.floor(cx / 2), 5);
    for (let i = 0; i < ventCount; i++) {
      const vt = (i + 0.5) / ventCount;
      const vz = len * (0.25 - vt * 0.55);
      parts.push(...mirrorX(s => place(
        new THREE.TorusGeometry(w * 0.04, w * 0.012, 4, 6),
        s * w * 0.35, -w * 0.08, vz,
        0, 0, s * HALF_PI,
      )));
    }
  }

  // ── 12. Ventral vibration-drive plates ────────────────────────────────
  // Arthropod propulsion: vibrating plates at ventral aft
  if (cx >= 1) {
    // Primary drive plate — wide, flat, under the abdomen
    parts.push(place(
      new THREE.BoxGeometry(w * 0.55, w * 0.035, len * 0.18),
      0, -w * 0.36, -len * 0.28,
    ));

    // Drive plate ribbing (cx >= 3) — transverse stiffening ribs
    if (cx >= 3) {
      for (let i = 0; i < 3; i++) {
        const rz = -len * 0.22 - i * len * 0.05;
        parts.push(place(
          new THREE.BoxGeometry(w * 0.58, w * 0.05, w * 0.015),
          0, -w * 0.38, rz,
        ));
      }
    }

    // Lateral auxiliary plates (cx >= 4) — smaller flanking plates
    if (cx >= 4) {
      parts.push(...mirrorX(s => place(
        new THREE.BoxGeometry(w * 0.2, w * 0.03, len * 0.14),
        s * w * 0.48, -w * 0.33, -len * 0.24,
      )));
    }

    // Drive resonator nodes (cx >= 6) — spherical vibration amplifiers
    if (cx >= 6) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.035, 5, 4),
        s * w * 0.25, -w * 0.40, -len * 0.32,
      )));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.04, 5, 4),
        0, -w * 0.40, -len * 0.36,
      ));
    }
  }

  // ── 13. Tail stinger — capital ships only ─────────────────────────────
  if (cx >= 5) {
    // Stinger base — swollen venom sac
    parts.push(place(
      new THREE.SphereGeometry(w * 0.22, 7, 5),
      0, w * 0.05, -len * 0.44,
      0, 0, 0,
      0.8, 0.7, 1.4,
    ));

    // Primary stinger — long, sharp, upward-curving
    parts.push(place(
      new THREE.ConeGeometry(w * 0.08, len * 0.20, 5),
      0, w * 0.08, -len * 0.55,
      HALF_PI, PI / 4, 0,
    ));

    // Stinger barbs (cx >= 6) — lateral backward-facing hooks
    if (cx >= 6) {
      parts.push(...mirrorX(s => place(
        new THREE.ConeGeometry(w * 0.04, len * 0.09, 3),
        s * w * 0.10, w * 0.06, -len * 0.49,
        HALF_PI * 0.6, PI / 3, s * 0.5,
      )));
    }

    // Secondary barbs (cx >= 7) — smaller, further back
    if (cx >= 7) {
      parts.push(...mirrorX(s => place(
        new THREE.ConeGeometry(w * 0.03, len * 0.06, 3),
        s * w * 0.07, w * 0.04, -len * 0.52,
        HALF_PI * 0.5, PI / 4, s * 0.6,
      )));
    }

    // Stinger venom channel groove (cx >= 6) — ridge along the sting
    if (cx >= 6) {
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.008, len * 0.16, 3),
        0, w * 0.12, -len * 0.52,
        HALF_PI, 0, 0,
      ));
    }
  }

  // ── 14. Pheromone relay spines ────────────────────────────────────────
  if (cx >= 4) {
    const spineCount = Math.min(cx - 2, 5);
    for (let i = 0; i < spineCount; i++) {
      const sz = len * (0.15 - i * 0.11);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.01, w * 0.025, w * 0.48, 3),
        0, w * 0.62, sz,
      ));

      // Spine tip bead (cx >= 6)
      if (cx >= 6) {
        parts.push(place(
          new THREE.SphereGeometry(w * 0.018, 4, 3),
          0, w * 0.86, sz,
        ));
      }
    }
  }

  // ── 15. Lateral cerci (tail feelers) ──────────────────────────────────
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.006, len * 0.15, 3),
      s * w * 0.14, -w * 0.04, -len * 0.48,
      HALF_PI * 0.8, 0, s * 0.4,
    )));
  }

  // ── 16. Bioite hull plating — armour segments over the carapace ───────
  if (cx >= 5) {
    // Lateral hull plates — flat armour strips
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, w * 0.38, len * 0.38),
      s * w * 0.62, 0, len * 0.04,
    )));

    // Ventral plating — belly armour
    parts.push(place(
      new THREE.BoxGeometry(w * 0.50, w * 0.05, len * 0.50),
      0, -w * 0.44, len * 0.02,
    ));
  }

  // ── 17. Capital: thorax proleg graspers ───────────────────────────────
  if (cx >= 6) {
    // Short manipulator arms near the head — for docking and boarding
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.018, w * 0.25, 4),
      s * w * 0.24, -w * 0.22, len * 0.30,
      0.2, 0, s * 0.4,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.02, w * 0.12, 3),
      s * w * 0.30, -w * 0.38, len * 0.30,
      0, 0, s * 0.25,
    )));
  }

  // ── 18. Capital: ovipositor drone bay ─────────────────────────────────
  if (cx >= 7) {
    // Ventral aft tube — launches boarding drones
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.10, w * 0.06, len * 0.15, 6),
      0, -w * 0.30, -len * 0.36,
      HALF_PI, 0, 0,
    ));
    // Bay door ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.08, w * 0.015, 5, 8),
      0, -w * 0.30, -len * 0.44,
      HALF_PI, 0, 0,
    ));
  }

  // ── 19. Capital: geometric pheromone amplifier etching ────────────────
  if (cx >= 7) {
    // Represented as raised hexagonal ridges on the thorax
    const hexCount = 3;
    for (let i = 0; i < hexCount; i++) {
      const hz = len * (0.15 - i * 0.12);
      parts.push(...mirrorX(s => place(
        new THREE.TorusGeometry(w * 0.10, w * 0.008, 6, 6),
        s * w * 0.20, w * 0.18, hz,
        0, 0, s * 0.15,
      )));
    }
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getZorvathiHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.40;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Mandible prow weapons — always present ────────────────────────────────
  // Primary mandibles at the cephalon serve as close-range weapons.
  for (const s of [-1, 1]) {
    weapons.push({
      position: new THREE.Vector3(s * w * 0.17, -w * 0.07, len * 0.47),
      facing: 'fore',
      normal: new THREE.Vector3(s * 0.3, -0.2, 1).normalize(),
    });
  }

  // ── Ventral vibration-drive plate (cx >= 1) ───────────────────────────────
  // Arthropod propulsion: vibrating plates at ventral aft.
  if (cx >= 1) {
    engines.push({
      position: new THREE.Vector3(0, -w * 0.36, -len * 0.28),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.275,
    });
  }

  // ── Lateral auxiliary drive plates (cx >= 4) ──────────────────────────────
  if (cx >= 4) {
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.48, -w * 0.33, -len * 0.24),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.10,
      });
    }
  }

  // ── Thorax weapon blisters (cx >= 2) ──────────────────────────────────────
  // Primary blisters — swollen turret mounts on thorax flanks.
  if (cx >= 2) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.30, w * 0.28, len * 0.15),
        facing: 'turret',
        normal: new THREE.Vector3(s * 0.3, 0.7, 0.3).normalize(),
      });
    }
  }

  // ── Secondary ventral blister pair (cx >= 5) ──────────────────────────────
  if (cx >= 5) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.25, -w * 0.15, len * 0.12),
        facing: 'turret',
        normal: new THREE.Vector3(s * 0.2, -0.8, 0.2).normalize(),
      });
    }
  }

  // ── Tail stinger engine (cx >= 5) ─────────────────────────────────────────
  // On capitals, the tail stinger also functions as a rear-facing engine.
  if (cx >= 5) {
    engines.push({
      position: new THREE.Vector3(0, w * 0.08, -len * 0.55),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.08,
    });
  }

  // ── Dorsal spine turret (cx >= 6) ─────────────────────────────────────────
  if (cx >= 6) {
    weapons.push({
      position: new THREE.Vector3(0, w * 0.55, len * 0.08),
      facing: 'dorsal',
      normal: new THREE.Vector3(0, 1, 0),
    });
  }

  // ── Drive resonator node engines (cx >= 6) ────────────────────────────────
  if (cx >= 6) {
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.25, -w * 0.40, -len * 0.32),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.035,
      });
    }
    engines.push({
      position: new THREE.Vector3(0, -w * 0.40, -len * 0.36),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.04,
    });
  }

  return { engines, weapons };
}

registerHardpointProvider('zorvathi', getZorvathiHardpoints);
