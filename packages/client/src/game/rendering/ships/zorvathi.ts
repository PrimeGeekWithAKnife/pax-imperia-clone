import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

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

export function buildZorvathi(len: number, cx: number): THREE.BufferGeometry {
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
