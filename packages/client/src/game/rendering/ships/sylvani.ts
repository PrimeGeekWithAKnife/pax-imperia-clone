import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

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

export function buildSylvani(len: number, cx: number): THREE.BufferGeometry {
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
