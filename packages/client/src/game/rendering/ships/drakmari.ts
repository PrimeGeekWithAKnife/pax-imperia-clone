import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';

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

export function buildDrakmari(len: number, cx: number): THREE.BufferGeometry {
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
