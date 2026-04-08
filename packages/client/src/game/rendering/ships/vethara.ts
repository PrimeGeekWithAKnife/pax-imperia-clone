import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../ShipModels3D';

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  VETHARA SHIP DESIGNS — "Symbiotic Colonisation Architecture"
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  The Vethara are symbiotic neural filaments — eyeless, limbless parasites
 *  that bond with host organisms. Their ships express dual-nature: a pale,
 *  inert HOST HULL (CapsuleGeometry, bone-grey) progressively colonised by
 *  living red FILAMENT NETWORKS (spiralling beads, tendril arms, organ pods,
 *  membrane webs).
 *
 *  LAYER 1 — HOST HULL: Bone-grey capsule forms — the "borrowed body".
 *  Smooth, inert, almost clinical. This is the dead architecture the Vethara
 *  needed before they could think.
 *
 *  LAYER 2 — FILAMENT NETWORK: Red emissive spirals of small SphereGeometry
 *  beads that wrap the hull like veins. At low cx they are sparse — a few
 *  tentative tendrils. At high cx the host is engulfed: tendril crowns,
 *  organ pods, membrane webs, a metabolic engine cluster.
 *
 *  DISTINCTIVENESS: "Something alive wrapped around something dead." The
 *  dual-layer visual is unique — no other species has this.
 *
 *  Part counts:  cx=0 ~7 parts | cx=5 ~45+ parts | cx=8 ~80+ parts
 */

export function buildVethara(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.42;
  const h = len * 0.12;
  const parts: THREE.BufferGeometry[] = [];

  // ── LAYER 1: HOST HULL — bone-grey capsule architecture ─────────────
  // Primary hull capsule — the "borrowed body"
  parts.push(place(
    new THREE.CapsuleGeometry(w * 0.34, len * 0.42, 8, 12),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  // Fore bulkhead — slightly flattened dome
  parts.push(place(
    new THREE.SphereGeometry(w * 0.36, 10, 8),
    0, 0, len * 0.32,
    0, 0, 0,
    1.0, 0.85, 0.65,
  ));

  // Aft bulkhead — wider to house engine bay
  parts.push(place(
    new THREE.SphereGeometry(w * 0.40, 10, 8),
    0, 0, -len * 0.32,
    0, 0, 0,
    1.0, 0.90, 0.55,
  ));

  // Ventral keel ridge — structural spine running below hull
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.04, w * 0.03, len * 0.50, 4),
    0, -w * 0.30, len * 0.02,
    HALF_PI, 0, 0,
  ));

  // Dorsal sensor blister — small dome atop the host hull
  parts.push(place(
    new THREE.SphereGeometry(w * 0.10, 6, 5, 0, PI * 2, 0, HALF_PI),
    0, w * 0.34, len * 0.18,
  ));

  // Hull reinforcement bands (2 rings around the capsule)
  parts.push(place(
    new THREE.TorusGeometry(w * 0.35, w * 0.025, 4, 10),
    0, 0, len * 0.12,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.TorusGeometry(w * 0.36, w * 0.025, 4, 10),
    0, 0, -len * 0.12,
    HALF_PI, 0, 0,
  ));

  // ── LAYER 2: FILAMENT NETWORK — red symbiont colonisation ───────────

  // ── Primary filament spiral (always present) ────────────────────────
  // At cx=0, sparse — a few beads winding tentatively around the hull.
  // Density and wrap count increase with complexity.
  const spiralCount = 12 + cx * 5;
  const spiralWraps = 1.5 + cx * 0.35;
  for (let i = 0; i < spiralCount; i++) {
    const t = i / spiralCount;
    const angle = t * PI * 2 * spiralWraps;
    const z = (0.36 - t * 0.72) * len;
    const hullR = w * (0.34 + t * 0.04);
    const filR = hullR + w * 0.07;
    const beadSize = w * (0.045 + cx * 0.004);
    parts.push(place(
      new THREE.SphereGeometry(beadSize, 4, 3),
      Math.cos(angle) * filR,
      Math.sin(angle) * filR,
      z,
    ));
  }

  // ── Secondary counter-spiral (cx >= 1) ──────────────────────────────
  // A second helix wrapping the opposite direction — early colonisation.
  if (cx >= 1) {
    const secCount = 6 + cx * 3;
    const secWraps = 1.2 + cx * 0.2;
    for (let i = 0; i < secCount; i++) {
      const t = i / secCount;
      const angle = -t * PI * 2 * secWraps + PI;  // counter-wound, offset
      const z = (0.30 - t * 0.60) * len;
      const hullR = w * (0.34 + t * 0.04);
      const filR = hullR + w * 0.08;
      const beadSize = w * (0.035 + cx * 0.003);
      parts.push(place(
        new THREE.SphereGeometry(beadSize, 4, 3),
        Math.cos(angle) * filR,
        Math.sin(angle) * filR,
        z,
      ));
    }
  }

  // ── Filament anchor nodes (cx >= 1) ─────────────────────────────────
  // Points where spirals grip the hull — slightly larger beads
  if (cx >= 1) {
    const anchorCount = 3 + Math.min(cx, 4);
    for (let i = 0; i < anchorCount; i++) {
      const angle = (i / anchorCount) * PI * 2;
      const z = (0.20 - i * 0.10) * len;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.06, 5, 4),
        Math.cos(angle) * w * 0.40,
        Math.sin(angle) * w * 0.40,
        z,
      ));
    }
  }

  // ── Tendril arms (cx >= 2) ──────────────────────────────────────────
  // Filaments reaching forward from the hull — grasping, sensing.
  if (cx >= 2) {
    const armCount = Math.min(3 + Math.floor(cx / 2), 7);
    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * PI * 2;
      const armLen = len * (0.14 + cx * 0.012);
      // Tendril stalk
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.018, w * 0.045, armLen, 5),
        Math.cos(angle) * w * 0.36,
        Math.sin(angle) * w * 0.36,
        len * 0.38 + armLen * 0.4,
        HALF_PI + 0.25 * Math.sin(angle),
        0,
        0.25 * Math.cos(angle),
      ));
      // Tendril tip bead
      parts.push(place(
        new THREE.SphereGeometry(w * 0.035, 4, 3),
        Math.cos(angle) * w * 0.32,
        Math.sin(angle) * w * 0.32,
        len * 0.38 + armLen * 0.85,
      ));
    }
  }

  // ── Lateral nerve bundles (cx >= 2) ─────────────────────────────────
  // Paired filament clusters along the host hull flanks
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.06, len * 0.14, 4, 6),
      s * w * 0.42, 0, len * 0.05,
      HALF_PI, 0, 0,
    )));
  }

  // ── Organ pods — bio-weapon launchers (cx >= 3) ─────────────────────
  // Elongated SphereGeometry organ sacs — pulsing weapon pods.
  if (cx >= 3) {
    // Primary dorsal weapon pods
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.16, 7, 5),
      s * w * 0.48, w * 0.08, len * 0.10,
      0, 0, 0,
      0.65, 0.55, 1.4,   // elongated along Z — launcher barrel shape
    )));
    // Pod nozzle tips
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.06, 5, 4),
      s * w * 0.48, w * 0.08, len * 0.22,
    )));

    if (cx >= 4) {
      // Secondary ventral weapon pods
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.13, 6, 4),
        s * w * 0.44, -w * 0.12, -len * 0.08,
        0, 0, 0,
        0.6, 0.5, 1.3,
      )));
      // Ventral pod nozzle tips
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.05, 4, 3),
        s * w * 0.44, -w * 0.12, len * 0.02,
      )));
    }
  }

  // ── Symbiont nerve web (cx >= 3) ────────────────────────────────────
  // Fine filament strands connecting organ pods to the spiral network
  if (cx >= 3) {
    const webCount = 4 + Math.min(cx - 3, 4);
    for (let i = 0; i < webCount; i++) {
      const angle = (i / webCount) * PI * 2 + 0.4;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.008, w * 0.30, 3),
        Math.cos(angle) * w * 0.50,
        Math.sin(angle) * w * 0.50,
        len * (0.12 - i * 0.04),
        0.15, angle, HALF_PI,
      ));
    }
  }

  // ── Enveloping membrane (cx >= 4) ───────────────────────────────────
  // Semi-transparent biological membrane — the symbiont claiming the hull
  if (cx >= 4) {
    // Dorsal membrane canopy
    parts.push(place(
      new THREE.SphereGeometry(w * 0.54, 10, 7, 0, PI * 2, 0, PI * 0.45),
      0, w * 0.10, len * 0.02,
      HALF_PI, 0, 0,
      1.0, 0.25, 1.5,
    ));
    // Membrane ridges — filament veins running through the membrane
    for (let i = 0; i < 4; i++) {
      const ridgeX = (i - 1.5) * w * 0.18;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.020, w * 0.020, len * 0.45, 4),
        ridgeX, h * 0.40, 0,
        HALF_PI, 0, 0,
      ));
    }
    // Ventral membrane web — the underside is colonised too
    parts.push(place(
      new THREE.SphereGeometry(w * 0.42, 8, 6, 0, PI * 2, HALF_PI, PI * 0.35),
      0, -w * 0.08, len * 0.0,
      HALF_PI, 0, 0,
      1.0, 0.20, 1.4,
    ));
  }

  // ── Tendril crown (cx >= 5) ─────────────────────────────────────────
  // Dense ring of tendrils erupting from the bow — the host is now claimed
  if (cx >= 5) {
    // Crown tendrils — upward-reaching filaments
    const crownCount = 10;
    for (let i = 0; i < crownCount; i++) {
      const angle = (i / crownCount) * PI * 2;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.035, len * 0.14, 5),
        Math.cos(angle) * w * 0.38,
        Math.sin(angle) * w * 0.38,
        len * 0.44,
        HALF_PI - 0.22, angle, 0,
      ));
    }
    // Crown nerve ring — connecting the crown tips
    parts.push(place(
      new THREE.TorusGeometry(w * 0.38, w * 0.018, 5, 12),
      0, 0, len * 0.44,
      HALF_PI, 0, 0,
    ));
    // Radial filament spokes linking crown to hull
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.014, w * 0.46, 3),
        Math.cos(angle) * w * 0.52,
        Math.sin(angle) * w * 0.52,
        len * 0.06,
        0, 0, HALF_PI - angle,
      ));
    }
    // Sensory nodules at crown base
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * PI * 2 + 0.3;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.04, 4, 3),
        Math.cos(angle) * w * 0.44,
        Math.sin(angle) * w * 0.44,
        len * 0.36,
      ));
    }
  }

  // ── Neural nexus dome (cx >= 6) ─────────────────────────────────────
  // The symbiont's brain — a pulsing dome rising above the host hull
  if (cx >= 6) {
    // Nexus dome — the central intelligence of the symbiont
    parts.push(place(
      new THREE.SphereGeometry(w * 0.30, 10, 8, 0, PI * 2, 0, PI * 0.55),
      0, h * 0.48, len * 0.05,
    ));
    // Nexus support stalks
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.030, w * 0.045, h * 0.42, 5),
        Math.cos(angle) * w * 0.16,
        h * 0.26,
        len * 0.05 + Math.sin(angle) * w * 0.16,
      ));
    }
    // Ventral counter-nexus — mirror intelligence node below hull
    parts.push(place(
      new THREE.SphereGeometry(w * 0.22, 8, 6),
      0, -h * 0.44, -len * 0.04,
      0, 0, 0,
      1.15, 0.80, 1.0,
    ));
    // Axial nerve trunk connecting dorsal and ventral nexuses
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, h * 0.82, 5),
      0, 0, len * 0.01,
    ));
    // Lateral sensing filaments from nexus dome
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.012, w * 0.008, w * 0.35, 3),
      s * w * 0.38, h * 0.45, len * 0.08,
      0, 0, s * 0.5,
    )));
  }

  // ── Reproductive spore clusters (cx >= 7) ───────────────────────────
  // Trailing clusters of spore pods — the symbiont is reproducing
  if (cx >= 7) {
    // Trailing reproductive filament stalks
    const trailCount = 10;
    for (let i = 0; i < trailCount; i++) {
      const angle = (i / trailCount) * PI * 2;
      const trailLen = len * 0.24;
      // Stalk
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.035, trailLen, 4),
        Math.cos(angle) * w * 0.36,
        Math.sin(angle) * w * 0.36,
        -len * 0.42 - trailLen * 0.4,
        HALF_PI + 0.12 * Math.sin(angle),
        0,
        0.10 * Math.cos(angle),
      ));
      // Spore beads along each stalk
      for (let j = 1; j <= 3; j++) {
        const tz = -len * 0.42 - trailLen * (j / 4);
        parts.push(place(
          new THREE.SphereGeometry(w * 0.028, 3, 2),
          Math.cos(angle) * w * (0.36 - j * 0.02),
          Math.sin(angle) * w * (0.36 - j * 0.02),
          tz,
        ));
      }
    }
    // Aft brood sac — enlarged reproductive organ
    parts.push(place(
      new THREE.SphereGeometry(w * 0.26, 8, 6),
      0, 0, -len * 0.40,
      0, 0, 0,
      1.3, 1.3, 0.85,
    ));
    // Lateral brood pods
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.12, 6, 5),
      s * w * 0.35, 0, -len * 0.34,
      0, 0, 0,
      0.8, 0.8, 1.2,
    )));
  }

  // ── Full engulfment (cx >= 8) ───────────────────────────────────────
  // The host hull is barely visible — the symbiont has completely claimed it
  if (cx >= 8) {
    // Outer engulfment web — a loose cage of filament strands
    const webStrands = 8;
    for (let i = 0; i < webStrands; i++) {
      const angle = (i / webStrands) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.010, len * 0.70, 3),
        Math.cos(angle) * w * 0.58,
        Math.sin(angle) * w * 0.58,
        0,
        HALF_PI, 0, 0,
      ));
    }
    // Engulfment ring fore
    parts.push(place(
      new THREE.TorusGeometry(w * 0.58, w * 0.018, 5, 14),
      0, 0, len * 0.28,
      HALF_PI, 0, 0,
    ));
    // Engulfment ring aft
    parts.push(place(
      new THREE.TorusGeometry(w * 0.56, w * 0.018, 5, 14),
      0, 0, -len * 0.25,
      HALF_PI, 0, 0,
    ));
    // Dorsal crest spines — symbiont dominance display
    for (let i = 0; i < 5; i++) {
      const sz = len * (0.20 - i * 0.10);
      const spineH = w * (0.30 - i * 0.03);
      parts.push(place(
        new THREE.ConeGeometry(w * 0.025, spineH, 4),
        0, w * 0.58 + spineH * 0.4, sz,
      ));
    }
    // Tertiary weapon pods — extra organ launchers on engulfed hull
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.10, 5, 4),
      s * w * 0.52, w * 0.15, len * 0.18,
      0, 0, 0,
      0.55, 0.50, 1.3,
    )));
  }

  // ── METABOLIC ENGINE CLUSTER — biological propulsion ────────────────
  // Glowing spheres, NOT nozzles — these are living metabolic organs.
  const engineCount = 1 + Math.min(cx, 5);
  const engineZ = -len * 0.38;
  if (engineCount <= 2) {
    for (let i = 0; i < engineCount; i++) {
      const ex = engineCount === 1 ? 0 : (i === 0 ? -w * 0.15 : w * 0.15);
      // Main engine orb
      parts.push(place(
        new THREE.SphereGeometry(w * 0.13, 7, 5),
        ex, 0, engineZ,
      ));
      // Engine glow halo
      parts.push(place(
        new THREE.TorusGeometry(w * 0.10, w * 0.015, 4, 8),
        ex, 0, engineZ - w * 0.08,
        HALF_PI, 0, 0,
      ));
    }
  } else {
    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      const eR = w * 0.20;
      // Main engine orb
      parts.push(place(
        new THREE.SphereGeometry(w * 0.10, 6, 5),
        Math.cos(angle) * eR,
        Math.sin(angle) * eR,
        engineZ,
      ));
      // Engine connector stalk to hull
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.020, w * 0.12, 4),
        Math.cos(angle) * eR * 0.55,
        Math.sin(angle) * eR * 0.55,
        engineZ,
        0, 0, HALF_PI - angle,
      ));
    }
    // Central engine cluster ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.20, w * 0.018, 5, 10),
      0, 0, engineZ - w * 0.06,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getVetharaHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.42;
  const h = len * 0.12;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Metabolic engine cluster — always present ─────────────────────────────
  // Biological propulsion orbs at the stern. Layout depends on engineCount.
  const engineCount = 1 + Math.min(cx, 5);
  const engineZ = -len * 0.38;

  if (engineCount <= 2) {
    // 1-2 engine orbs — inline layout
    for (let i = 0; i < engineCount; i++) {
      const ex = engineCount === 1 ? 0 : (i === 0 ? -w * 0.15 : w * 0.15);
      engines.push({
        position: new THREE.Vector3(ex, 0, engineZ),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.13,
      });
    }
  } else {
    // 3+ engine orbs — radial cluster layout
    const eR = w * 0.20;
    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      engines.push({
        position: new THREE.Vector3(
          Math.cos(angle) * eR,
          Math.sin(angle) * eR,
          engineZ,
        ),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.10,
      });
    }
  }

  // ── cx >= 3: Dorsal organ pod weapons ─────────────────────────────────────
  if (cx >= 3) {
    // Primary dorsal weapon pods — organ sac nozzle tips
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.48, w * 0.08, len * 0.22),
        facing: 'fore',
        normal: new THREE.Vector3(0, 0, 1),
      });
    }

    // ── cx >= 4: Secondary ventral weapon pods ──────────────────────────────
    if (cx >= 4) {
      for (const s of [-1, 1]) {
        weapons.push({
          position: new THREE.Vector3(s * w * 0.44, -w * 0.12, len * 0.02),
          facing: 'fore',
          normal: new THREE.Vector3(0, 0, 1),
        });
      }
    }
  }

  // ── cx >= 8: Tertiary weapon pods on engulfed hull ────────────────────────
  if (cx >= 8) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.52, w * 0.15, len * 0.18),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s * 0.4, 0.2, 0.9).normalize(),
      });
    }
  }

  return { engines, weapons };
}

registerHardpointProvider('vethara', getVetharaHardpoints);
