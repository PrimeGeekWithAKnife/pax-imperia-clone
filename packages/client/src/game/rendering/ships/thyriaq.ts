import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

/**
 * ============================================================================
 *  THYRIAQ SHIP DESIGN — "Liquid Mercury Nanoscale Architecture"
 * ============================================================================
 *
 *  The Thyriaq ARE the ships. Four billion nanoscale biological machines
 *  aggregate into a coherent volume of matter that reshapes itself for the
 *  task at hand. "Liquid mercury frozen mid-transformation." Amoeboid core
 *  bodies with pseudopod tendrils, toroidal accelerator rings, and no seams
 *  because the entire ship is one continuous material.
 *
 *  DESIGN VOCABULARY:
 *   - Stretched SphereGeometry for merged spheroid lobes (never cubes)
 *   - Tapered CylinderGeometry for pseudopod tendrils (thick->thin)
 *   - TorusGeometry accelerator rings on weapon pseudopods
 *   - CapsuleGeometry for connective tissue between lobes
 *   - Deliberate slight asymmetry — the swarm is never perfectly mirrored
 *   - Trailing propulsion tendrils — the ship IS the engine
 *   - No straight edges, no seams, no panels. One continuous material.
 *
 *  MATERIAL: metalness 0.85, roughness 0.08 — liquid mercury look
 */

export function buildThyriaq(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.26;
  const parts: THREE.BufferGeometry[] = [];

  // ── cx 0: Base hull — 7 parts ──────────────────────────────────────────
  // Every Thyriaq ship begins as merged spheroid lobes with trailing
  // propulsion tendrils. Even the smallest scout is unmistakably alien.

  // Primary mass lobe — slightly off-centre, elongated forward
  parts.push(place(
    new THREE.SphereGeometry(w * 0.55, 12, 10),
    w * 0.02, 0, len * 0.05,
    0, 0, 0,
    0.85, 0.75, 1.6,
  ));

  // Secondary mass lobe — forward, merging into the primary
  parts.push(place(
    new THREE.SphereGeometry(w * 0.38, 10, 8),
    w * 0.06, w * 0.05, len * 0.28,
    0, 0, 0,
    0.80, 0.70, 1.3,
  ));

  // Tertiary mass lobe — aft, asymmetric bulge downward-left
  parts.push(place(
    new THREE.SphereGeometry(w * 0.42, 10, 8),
    -w * 0.04, -w * 0.08, -len * 0.22,
    0, 0, 0,
    1.1, 0.65, 1.0,
  ));

  // Connective bridge — capsule linking primary to forward lobe
  parts.push(place(
    new THREE.CapsuleGeometry(w * 0.18, len * 0.20, 6, 8),
    w * 0.04, w * 0.02, len * 0.16,
    HALF_PI, 0, 0.08,
  ));

  // Ventral keel lobe — flattened, gives the hull a bottom
  parts.push(place(
    new THREE.SphereGeometry(w * 0.30, 8, 7),
    w * 0.01, -w * 0.18, len * 0.0,
    0, 0, 0,
    1.2, 0.50, 1.4,
  ));

  // ── Propulsion tendrils (base) — trailing pseudopods ───────────────────
  // The ship IS the engine. Nanites stream aft as propulsive tendrils.
  const thrusterCount = 3 + Math.floor(cx * 0.6);
  for (let i = 0; i < thrusterCount; i++) {
    const angle = (i / thrusterCount) * PI * 2 + 0.4;
    const tLen = len * (0.14 + 0.025 * cx);
    const spread = w * (0.28 + 0.04 * (i % 2));
    // Main tendril — tapered cylinder, thick at hull, thin at tip
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.045, w * 0.010, tLen, 6),
      Math.cos(angle) * spread,
      Math.sin(angle) * spread * 0.7,
      -len * 0.28 - tLen * 0.3,
      HALF_PI + 0.15 * Math.sin(angle),
      0.1 * Math.cos(angle),
      0,
    ));
  }

  // Central aft propulsion tendril — always present, slightly off-axis
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.06, w * 0.015, len * 0.18, 6),
    w * 0.02, -w * 0.03, -len * 0.36,
    HALF_PI + 0.05, 0.03, 0,
  ));

  // ── cx 1+: Sensory pseudopods — reaching forward ──────────────────────
  if (cx >= 1) {
    const senseCount = 2 + Math.min(cx, 4);
    for (let i = 0; i < senseCount; i++) {
      const angle = (i / senseCount) * PI * 2;
      const tLen = len * (0.09 + 0.018 * cx);
      // Sensory tendril — tapered, not conical (cone replaced with cylinder)
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.035, w * 0.008, tLen, 5),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.25,
        len * 0.22 + tLen * 0.2,
        HALF_PI * 0.85, 0, angle * 0.3,
      ));
    }
    // Sensory bulb at forward tip — flattened sphere
    parts.push(place(
      new THREE.SphereGeometry(w * 0.14, 7, 6),
      w * 0.03, w * 0.02, len * 0.38,
      0, 0, 0,
      0.9, 0.85, 1.3,
    ));
  }

  // ── cx 2+: Lateral absorption lobes + dorsal ridge ─────────────────────
  if (cx >= 2) {
    // Lateral lobes — slightly different sizes (asymmetry)
    parts.push(place(
      new THREE.SphereGeometry(w * 0.30, 8, 7),
      w * 0.43, -w * 0.04, -len * 0.04,
      0, 0, 0,
      0.9, 0.80, 1.1,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.27, 8, 7),
      -w * 0.44, -w * 0.07, -len * 0.02,
      0, 0, 0,
      0.95, 0.75, 1.05,
    ));
    // Connective tissue — capsules bridging lateral lobes to core
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.10, w * 0.25, 5, 6),
      w * 0.22, -w * 0.02, -len * 0.02,
      0, 0, HALF_PI + 0.1,
    ));
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.09, w * 0.24, 5, 6),
      -w * 0.23, -w * 0.04, -len * 0.01,
      0, 0, HALF_PI - 0.08,
    ));
    // Dorsal ridge — elongated lobe along the spine
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.12, len * 0.38, 5, 8),
      0, w * 0.22, len * 0.02,
      HALF_PI, 0, 0.15,
    ));
  }

  // ── cx 3+: Weapon pseudopods with accelerator rings ────────────────────
  if (cx >= 3) {
    // Weapon stalks — tapered tendrils reaching forward-outward
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.055, w * 0.025, len * 0.20, 6),
      s * w * 0.48, w * 0.05, len * 0.15,
      HALF_PI * 0.7, s * 0.2, 0,
    )));
    // Weapon tips — small spheroid concentrators
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.065, 6, 5),
      s * w * 0.56, w * 0.08, len * 0.30,
      0, 0, 0,
      0.8, 0.8, 1.2,
    )));
    // Weapon stalk bases — thickened lobe where stalk meets hull
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.12, 6, 5),
      s * w * 0.38, w * 0.03, len * 0.08,
      0, 0, 0,
      0.9, 0.85, 1.1,
    )));
    // Ventral weapon pair — lower, reaching downward
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.018, len * 0.16, 5),
      s * w * 0.35, -w * 0.18, len * 0.10,
      HALF_PI * 0.65, s * 0.15, 0,
    )));
  }

  // ── cx 4+: Accelerator rings + processing node ────────────────────────
  if (cx >= 4) {
    // Accelerator rings on dorsal weapon pseudopods
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.10, w * 0.022, 6, 14),
      s * w * 0.51, w * 0.06, len * 0.22,
      0, 0, HALF_PI,
    )));
    // Smaller inner rings — slightly offset for asymmetry
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.07, w * 0.015, 5, 12),
      s * w * 0.53 + w * 0.01, w * 0.07 + w * 0.01, len * 0.26,
      0.1, 0, HALF_PI,
    )));
    // Accelerator rings on ventral weapon pseudopods
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.065, w * 0.015, 5, 10),
      s * w * 0.38, -w * 0.20, len * 0.16,
      0, 0, HALF_PI,
    )));

    // Ventral processing node — large asymmetric lobe
    parts.push(place(
      new THREE.SphereGeometry(w * 0.34, 8, 7),
      w * 0.05, -w * 0.30, -len * 0.08,
      0, 0, 0,
      0.85, 0.90, 1.15,
    ));
    // Processing connective tissue
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.11, w * 0.18, 4, 6),
      w * 0.03, -w * 0.15, -len * 0.04,
      0.3, 0, 0.05,
    ));

    // Additional propulsion tendrils — longer, thinner
    for (let i = 0; i < 2; i++) {
      const angle = PI * 0.3 + i * PI * 1.4;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.03, w * 0.006, len * 0.22, 5),
        Math.cos(angle) * w * 0.20,
        Math.sin(angle) * w * 0.16,
        -len * 0.40,
        HALF_PI + 0.08, 0.06 * (i === 0 ? 1 : -1), 0,
      ));
    }
  }

  // ── cx 5+: Forward command lobe + lateral tendrils + more rings ────────
  // This tier brings the total to 20+ parts on its own.
  if (cx >= 5) {
    // Forward command lobe — large, off-centre
    parts.push(place(
      new THREE.SphereGeometry(w * 0.42, 10, 8),
      -w * 0.10, w * 0.08, len * 0.34,
      0, 0, 0,
      0.75, 0.72, 1.30,
    ));
    // Command lobe connective bridge
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.09, len * 0.14, 5, 7),
      -w * 0.04, w * 0.05, len * 0.24,
      HALF_PI, 0, 0.12,
    ));
    // Forward sensory cluster — three small spheroids in a triangle
    parts.push(place(
      new THREE.SphereGeometry(w * 0.10, 6, 5),
      -w * 0.05, w * 0.15, len * 0.42,
      0, 0, 0,
      0.85, 0.9, 1.1,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.08, 6, 5),
      -w * 0.14, w * 0.04, len * 0.40,
      0, 0, 0,
      0.9, 0.85, 1.05,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.07, 5, 4),
      -w * 0.02, -w * 0.02, len * 0.44,
      0, 0, 0,
      0.95, 0.8, 1.15,
    ));

    // Lateral manipulation tendrils — mid-ship
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.042, w * 0.014, len * 0.17, 6),
      s * w * 0.56, -w * 0.08, len * 0.05,
      HALF_PI * 0.6, s * 0.3, 0,
    )));
    // Tendril tip bulbs
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.04, 5, 4),
      s * w * 0.64, -w * 0.12, len * 0.15,
      0, 0, 0,
      1.1, 0.9, 1.0,
    )));

    // Mid-body accelerator ring — large torus around the core
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.025, 7, 16),
      0, 0, len * 0.08,
      HALF_PI, 0, 0,
    ));

    // Lateral manipulation tendril rings
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.08, w * 0.012, 5, 10),
      s * w * 0.58, -w * 0.09, len * 0.08,
      0, 0, HALF_PI,
    )));

    // Additional aft propulsion tendrils — longer and thinner
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.028, w * 0.005, len * 0.20, 5),
      s * w * 0.15, w * 0.08, -len * 0.42,
      HALF_PI + 0.06, s * 0.04, 0,
    )));
    // Dorsal fin tendril — single, asymmetric
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.035, w * 0.008, len * 0.14, 5),
      w * 0.03, w * 0.28, -len * 0.10,
      0.3, 0.05, 0,
    ));
    // Dorsal fin tip
    parts.push(place(
      new THREE.SphereGeometry(w * 0.04, 5, 4),
      w * 0.04, w * 0.35, -len * 0.14,
    ));
  }

  // ── cx 6+: Distributed processing nodes + filament web ────────────────
  if (cx >= 6) {
    // Aft processing lobe — merges into propulsion region
    parts.push(place(
      new THREE.SphereGeometry(w * 0.36, 9, 7),
      w * 0.12, w * 0.15, -len * 0.30,
      0, 0, 0,
      0.95, 0.65, 1.1,
    ));
    // Aft lobe connective tissue
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.10, len * 0.12, 5, 6),
      w * 0.08, w * 0.10, -len * 0.20,
      HALF_PI, 0, 0.2,
    ));

    // Distributed processing nodes — asymmetric ring around hull
    const nodeAngles = [0.0, 1.15, 2.35, 3.55, 4.85];
    for (const a of nodeAngles) {
      const nodeR = w * (0.38 + 0.04 * Math.sin(a * 3));
      parts.push(place(
        new THREE.SphereGeometry(w * 0.11, 6, 5),
        Math.cos(a) * nodeR,
        Math.sin(a) * nodeR * 0.75,
        len * (0.05 + 0.08 * Math.sin(a * 2)),
        0, 0, 0,
        0.9 + 0.1 * Math.sin(a), 0.85, 1.05,
      ));
    }
    // Filament web — fine tendrils connecting processing nodes
    for (let i = 0; i < nodeAngles.length; i++) {
      const a = nodeAngles[i];
      const nextA = nodeAngles[(i + 1) % nodeAngles.length];
      const midA = (a + nextA) * 0.5;
      const filR = w * 0.36;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.012, w * 0.006, len * 0.10, 4),
        Math.cos(midA) * filR,
        Math.sin(midA) * filR * 0.70,
        len * 0.06,
        HALF_PI * 0.9, midA * 0.12, 0,
      ));
    }

    // Forward filament feelers — very fine, probing
    for (let i = 0; i < 6; i++) {
      const fa = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.010, w * 0.003, len * 0.11, 4),
        Math.cos(fa) * w * 0.20,
        Math.sin(fa) * w * 0.15,
        len * 0.40,
        HALF_PI * 0.9, fa * 0.08, 0,
      ));
    }

    // Secondary mid-body ring — offset from the cx5 ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.35, w * 0.018, 6, 14),
      w * 0.03, -w * 0.02, -len * 0.10,
      HALF_PI, 0, 0.12,
    ));
  }

  // ── cx 7+: Massive ventral growth + structural torus + more tendrils ──
  if (cx >= 7) {
    // Ventral growth lobe — large, heavy, asymmetric
    parts.push(place(
      new THREE.SphereGeometry(w * 0.48, 10, 8),
      -w * 0.03, -w * 0.35, -len * 0.18,
      0, 0, 0,
      1.0, 0.72, 0.88,
    ));
    // Ventral growth connective capsules
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.06, len * 0.10, 4, 6),
      s * w * 0.10, -w * 0.18, -len * 0.10,
      0.35, s * 0.15, 0,
    )));
    // Ventral growth sub-lobes
    parts.push(place(
      new THREE.SphereGeometry(w * 0.18, 6, 5),
      w * 0.08, -w * 0.46, -len * 0.22,
      0, 0, 0,
      0.9, 0.8, 1.1,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.15, 6, 5),
      -w * 0.12, -w * 0.44, -len * 0.14,
      0, 0, 0,
      1.05, 0.75, 0.95,
    ));

    // Structural torus — encircling the main hull
    parts.push(place(
      new THREE.TorusGeometry(w * 0.58, w * 0.032, 8, 18),
      0, 0, len * 0.02,
      HALF_PI, 0, 0,
    ));

    // Additional propulsion tendrils — wide fan
    for (let i = 0; i < 4; i++) {
      const angle = PI * 0.8 + (i / 3) * PI * 0.4;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.025, w * 0.005, len * 0.24, 5),
        Math.cos(angle) * w * 0.32,
        Math.sin(angle) * w * 0.24,
        -len * 0.44,
        HALF_PI + 0.10 * Math.sin(angle),
        0.05 * Math.cos(angle), 0,
      ));
    }
    // Tendril tips — tiny spheroids
    for (let i = 0; i < 4; i++) {
      const angle = PI * 0.8 + (i / 3) * PI * 0.4;
      parts.push(place(
        new THREE.SphereGeometry(w * 0.02, 4, 3),
        Math.cos(angle) * w * 0.34,
        Math.sin(angle) * w * 0.26,
        -len * 0.56,
      ));
    }
  }

  // ── cx 8+: Command icosahedron + nested rings + wing lobes ─────────────
  if (cx >= 8) {
    // Forward command structure — icosahedral, the only hint of geometry
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.32, 1),
      w * 0.02, w * 0.03, len * 0.42,
    ));
    // Command structure shroud — flattened sphere wrapping the icosahedron
    parts.push(place(
      new THREE.SphereGeometry(w * 0.25, 8, 6),
      w * 0.02, w * 0.03, len * 0.42,
      0, 0, 0,
      1.15, 1.15, 0.70,
    ));

    // Nested accelerator rings — three concentric, tilted differently
    for (let r = 0; r < 3; r++) {
      parts.push(place(
        new THREE.TorusGeometry(w * (0.36 + r * 0.12), w * 0.022, 7, 16),
        0, 0, len * (0.12 - r * 0.08),
        HALF_PI, 0, r * 0.28,
      ));
    }

    // Wing lobes — laterally extended, asymmetric sizes
    parts.push(place(
      new THREE.SphereGeometry(w * 0.32, 8, 7),
      w * 0.62, w * 0.12, -len * 0.25,
      0, 0, 0,
      0.82, 0.72, 1.0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.28, 8, 7),
      -w * 0.64, w * 0.16, -len * 0.22,
      0, 0, 0,
      0.78, 0.68, 1.05,
    ));
    // Wing lobe connective stalks
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.06, w * 0.28, 4, 6),
      s * w * 0.48, w * 0.08, -len * 0.16,
      0, 0, HALF_PI + s * 0.15,
    )));

    // Dorsal crest lobe — riding on top of the structural torus
    parts.push(place(
      new THREE.SphereGeometry(w * 0.22, 7, 6),
      -w * 0.04, w * 0.40, len * 0.04,
      0, 0, 0,
      1.1, 0.65, 1.2,
    ));
    // Crest tendril — reaching up and back
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.03, w * 0.008, len * 0.16, 5),
      -w * 0.05, w * 0.48, -len * 0.04,
      0.25, 0.06, 0,
    ));

    // Final aft propulsion cluster — five tendrils fanning out
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.022, w * 0.004, len * 0.28, 5),
        Math.cos(angle) * w * 0.18,
        Math.sin(angle) * w * 0.14,
        -len * 0.52,
        HALF_PI + 0.12 * Math.sin(angle),
        0.08 * Math.cos(angle), 0,
      ));
    }
  }

  return merge(parts);
}
