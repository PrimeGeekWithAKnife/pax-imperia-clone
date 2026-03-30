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

const HULL_SCALE: Record<HullClass, number> = {
  deep_space_probe: 1.5,
  scout:            2.0,
  destroyer:        4.0,
  transport:        5.0,
  coloniser:        6.0,
  cruiser:          8.0,
  carrier:         10.0,
  battleship:      14.0,
  dreadnought:     20.0,
  battle_station:  24.0,
};

/** Complexity tier — larger hulls get more detail parts. */
const HULL_COMPLEXITY: Record<HullClass, number> = {
  deep_space_probe: 0,
  scout:            1,
  destroyer:        2,
  transport:        2,
  coloniser:        2,
  cruiser:          3,
  carrier:          4,
  battleship:       5,
  dreadnought:      6,
  battle_station:   7,
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

// ── 1. TERANOS — Utilitarian, modular, boxy (The Expanse) ───────────────────

function buildTeranos(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.22;
  const h = len * 0.18;
  const parts: THREE.BufferGeometry[] = [];

  // Main hull — elongated box
  parts.push(place(new THREE.BoxGeometry(w, h, len * 0.7), 0, 0, len * 0.05));

  // Bridge module — smaller box at fore
  parts.push(place(
    new THREE.BoxGeometry(w * 0.5, h * 0.6, len * 0.15),
    0, h * 0.15, len * 0.45,
  ));

  // Engine block — wider box at aft
  parts.push(place(
    new THREE.BoxGeometry(w * 1.3, h * 0.9, len * 0.18),
    0, 0, -len * 0.42,
  ));

  // Engine nozzles — cylinders
  const nozzleCount = Math.min(2 + cx, 6);
  const nozzleSpacing = w * 1.2 / nozzleCount;
  for (let i = 0; i < nozzleCount; i++) {
    const nx = (i - (nozzleCount - 1) / 2) * nozzleSpacing;
    parts.push(place(
      new THREE.CylinderGeometry(h * 0.15, h * 0.2, len * 0.08, 6),
      nx, 0, -len * 0.54,
      HALF_PI, 0, 0,
    ));
  }

  // Side modules — boxes clamped to hull (more on bigger ships)
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.3, h * 0.5, len * 0.25),
      s * w * 0.65, 0, len * 0.1,
    )));
  }

  // Antenna / sensor mast
  if (cx >= 3) {
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, h * 0.8, 4),
      0, h * 0.6, len * 0.3,
    ));
  }

  // Cargo pods for larger ships
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.4, h * 0.4, len * 0.3),
      s * w * 0.7, -h * 0.3, -len * 0.1,
    )));
  }

  // Heavy armour plates for capital ships
  if (cx >= 5) {
    parts.push(place(
      new THREE.BoxGeometry(w * 1.5, h * 0.1, len * 0.5),
      0, h * 0.5, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 1.5, h * 0.1, len * 0.5),
      0, -h * 0.5, 0,
    ));
  }

  return merge(parts);
}

// ── 2. KHAZARI — Heavy, angular, forged (Klingon/industrial) ────────────────

function buildKhazari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.3;
  const h = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  // Heavy main hull — wedge shape via extruded triangle
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(0, h * 0.5);
  wedgeShape.lineTo(w * 0.5, -h * 0.4);
  wedgeShape.lineTo(-w * 0.5, -h * 0.4);
  wedgeShape.closePath();
  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    depth: len * 0.65,
    bevelEnabled: false,
  });
  parts.push(place(wedgeGeo, 0, 0, -len * 0.3, 0, 0, 0));

  // Ram prow — aggressive cone
  parts.push(place(
    new THREE.ConeGeometry(w * 0.35, len * 0.25, 4),
    0, 0, len * 0.5,
    HALF_PI, PI * 0.25, 0,
  ));

  // Armour plates — flat boxes along sides
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.15, h * 0.7, len * 0.5),
    s * w * 0.55, 0, 0,
  )));

  // Engine nacelles — heavy cylinders
  const nacCount = 1 + Math.floor(cx / 2);
  for (let i = 0; i < nacCount; i++) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(h * 0.2, h * 0.25, len * 0.2, 6),
      s * (w * 0.35 + i * w * 0.25), -h * 0.1, -len * 0.42,
      HALF_PI, 0, 0,
    )));
  }

  // Weapon mounts — blocky turret bases
  if (cx >= 2) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.3, h * 0.25, len * 0.12),
      0, h * 0.55, len * 0.15,
    ));
  }

  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.2, h * 0.3, len * 0.1),
      s * w * 0.4, h * 0.4, -len * 0.05,
    )));
  }

  // Heavy gun sponsons on capital ships
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.25, h * 0.35, len * 0.2),
      s * w * 0.7, 0, len * 0.1,
    )));
  }

  // Reinforced keel plate
  if (cx >= 4) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.8, h * 0.08, len * 0.7),
      0, -h * 0.5, 0,
    ));
  }

  return merge(parts);
}

// ── 3. VAELORI — Crystalline, elegant, translucent (Protoss) ────────────────

function buildVaelori(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.2;
  const h = len * 0.15;
  const parts: THREE.BufferGeometry[] = [];

  // Central crystal — octahedron stretched along Z
  const coreGeo = new THREE.OctahedronGeometry(w * 0.6, 0);
  parts.push(place(coreGeo, 0, 0, 0, 0, 0, 0, 0.8, 0.8, len * 0.04));

  // Forward crystal spire
  parts.push(place(
    new THREE.ConeGeometry(w * 0.2, len * 0.3, 4),
    0, 0, len * 0.4,
    HALF_PI, PI / 4, 0,
  ));

  // Wing crystals — swept cones
  parts.push(...mirrorX(s => place(
    new THREE.ConeGeometry(w * 0.15, len * 0.35, 4),
    s * w * 0.5, 0, -len * 0.05,
    0.3 * s, PI / 4, -s * 0.4,
    1, 1, 1,
  )));

  // Aft crystal cluster
  parts.push(place(
    new THREE.OctahedronGeometry(w * 0.3, 0),
    0, 0, -len * 0.35,
    0, PI / 6, 0,
    0.6, 0.6, 1.2,
  ));

  // Resonance fins — thin triangular prisms
  if (cx >= 2) {
    parts.push(...mirrorX(s => {
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(w * 0.6 * s, -h * 0.1);
      finShape.lineTo(w * 0.2 * s, -h * 0.3);
      finShape.closePath();
      return place(
        new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false }),
        0, h * 0.2, len * 0.1,
      );
    }));
  }

  // Psionic focus array (larger ships)
  if (cx >= 3) {
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.25, 0),
      0, h * 0.5, len * 0.2,
      0, PI / 3, 0,
    ));
  }

  // Secondary crystal spars
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.OctahedronGeometry(w * 0.2, 0),
      s * w * 0.8, h * 0.2, -len * 0.15,
      0, 0, 0,
      0.5, 0.5, 1.5,
    )));
  }

  // Capital ship: crown of crystals
  if (cx >= 5) {
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * PI * 2;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.08, len * 0.15, 4),
        Math.cos(angle) * w * 0.5,
        Math.sin(angle) * w * 0.5,
        len * 0.2,
        HALF_PI, PI / 4, 0,
      ));
    }
  }

  return merge(parts);
}

// ── 4. SYLVANI — Organic, grown, living ships (Wraith/Tyranid) ──────────────

function buildSylvani(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.22;
  const parts: THREE.BufferGeometry[] = [];

  // Main body — organic hull via lathe (teardrop profile)
  const bodyPoints: THREE.Vector2[] = [];
  const segments = 12;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = w * Math.sin(t * PI) * (1 - 0.3 * t);
    const z = (t - 0.5) * len * 0.8;
    bodyPoints.push(new THREE.Vector2(r, z));
  }
  parts.push(place(
    new THREE.LatheGeometry(bodyPoints, 8),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  // Tendril/vine growths radiating from body
  const tendrilCount = 2 + cx;
  for (let i = 0; i < tendrilCount; i++) {
    const angle = (i / tendrilCount) * PI * 2;
    const tendrilLen = len * (0.15 + 0.05 * cx);
    const tr = w * 0.8;
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.08, tendrilLen, 5),
      Math.cos(angle) * tr * 0.6,
      Math.sin(angle) * tr * 0.6,
      -len * 0.2,
      0.3 * Math.cos(angle), 0, 0.3 * Math.sin(angle),
    ));
  }

  // Photosynthetic sail membranes — thin stretched spheres
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.8, 6, 4),
      s * w * 0.6, 0, len * 0.05,
      0, 0, 0,
      0.08, 1.0, 1.2,
    )));
  }

  // Spore pods (weapon equivalents)
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.2, 6, 5),
      s * w * 0.5, w * 0.3, len * 0.15,
    )));
  }

  // Root-like engine tendrils at aft
  if (cx >= 4) {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.03, w * 0.1, len * 0.25, 4),
        Math.cos(angle) * w * 0.3,
        Math.sin(angle) * w * 0.3,
        -len * 0.5,
        HALF_PI + 0.2 * Math.cos(angle), 0, 0.2 * Math.sin(angle),
      ));
    }
  }

  // Massive shell carapace on capital ships
  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 1.2, 8, 6, 0, PI * 2, 0, HALF_PI),
      0, w * 0.1, 0,
      HALF_PI, 0, 0,
      1, 0.4, 1.2,
    ));
  }

  return merge(parts);
}

// ── 5. NEXARI — Geometric, Borg-like cubes/spheres ──────────────────────────

function buildNexari(len: number, cx: number): THREE.BufferGeometry {
  const s = len * 0.35; // cube side
  const parts: THREE.BufferGeometry[] = [];

  // Primary cube
  parts.push(place(new THREE.BoxGeometry(s, s, s), 0, 0, 0));

  // Secondary forward cube (offset)
  if (cx >= 1) {
    parts.push(place(
      new THREE.BoxGeometry(s * 0.5, s * 0.5, s * 0.5),
      0, 0, s * 0.6,
    ));
  }

  // Connector sphere
  parts.push(place(
    new THREE.SphereGeometry(s * 0.2, 6, 6),
    0, 0, s * 0.3,
  ));

  // Side processing nodes
  if (cx >= 2) {
    parts.push(...mirrorX(sign => place(
      new THREE.BoxGeometry(s * 0.4, s * 0.4, s * 0.4),
      sign * s * 0.65, 0, 0,
    )));
  }

  // Antenna grid
  if (cx >= 2) {
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        parts.push(place(
          new THREE.CylinderGeometry(s * 0.015, s * 0.015, s * 0.6, 3),
          i * s * 0.35, s * 0.7, j * s * 0.35,
        ));
      }
    }
  }

  // Upper/lower sub-cubes
  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(s * 0.35, s * 0.35, s * 0.35),
      0, s * 0.55, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(s * 0.35, s * 0.35, s * 0.35),
      0, -s * 0.55, 0,
    ));
  }

  // Aft engine sphere
  parts.push(place(
    new THREE.SphereGeometry(s * 0.25, 6, 6),
    0, 0, -s * 0.5,
  ));

  // Corner spheres for larger ships
  if (cx >= 4) {
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        parts.push(place(
          new THREE.SphereGeometry(s * 0.12, 5, 5),
          x * s * 0.5, y * s * 0.5, s * 0.5,
        ));
      }
    }
  }

  // Capital ship: fractal sub-cubes
  if (cx >= 5) {
    const offs = s * 0.45;
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        parts.push(place(
          new THREE.BoxGeometry(s * 0.25, s * 0.25, s * 0.25),
          x * offs, -s * 0.55, z * offs,
        ));
      }
    }
  }

  return merge(parts);
}

// ── 6. DRAKMARI — Sleek, hydrodynamic, ray/shark-like ───────────────────────

function buildDrakmari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.3;
  const h = len * 0.12;
  const parts: THREE.BufferGeometry[] = [];

  // Manta body — flattened sphere
  parts.push(place(
    new THREE.SphereGeometry(w * 0.7, 10, 8),
    0, 0, len * 0.05,
    0, 0, 0,
    1.0, 0.3, 1.4,
  ));

  // Nose — cone pointing forward
  parts.push(place(
    new THREE.ConeGeometry(w * 0.3, len * 0.3, 6),
    0, 0, len * 0.45,
    HALF_PI, 0, 0,
    1, 0.3, 1,
  ));

  // Wing fins — flattened cones
  parts.push(...mirrorX(s => place(
    new THREE.ConeGeometry(w * 0.1, len * 0.5, 4),
    s * w * 0.5, 0, -len * 0.05,
    0, 0, s * 0.6,
    1, 0.2, 1,
  )));

  // Tail — tapered cylinder
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.05, w * 0.15, len * 0.35, 6),
    0, 0, -len * 0.4,
    HALF_PI, 0, 0,
  ));

  // Dorsal fin
  if (cx >= 2) {
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(-h * 0.5, h * 0.8);
    finShape.lineTo(-h * 1.2, 0);
    finShape.closePath();
    parts.push(place(
      new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false }),
      0, h * 0.3, len * 0.1,
      0, HALF_PI, 0,
    ));
  }

  // Ventral slits (intake-like)
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.1, h * 0.15, len * 0.2),
      s * w * 0.2, -h * 0.4, len * 0.1,
    )));
  }

  // Pectoral barbs
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.05, len * 0.2, 4),
      s * w * 0.7, -h * 0.1, len * 0.15,
      HALF_PI, 0, s * 0.3,
    )));
  }

  // Capital: tail flukes
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.06, len * 0.15, 4),
      s * w * 0.15, 0, -len * 0.55,
      0, 0, s * 0.8,
      1, 0.3, 1,
    )));
  }

  return merge(parts);
}

// ── 7. ASHKARI — Cobbled together, salvaged, asymmetric ─────────────────────

function buildAshkari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.2;
  const h = len * 0.18;
  const parts: THREE.BufferGeometry[] = [];

  // Core hull — mismatched box, off-centre
  parts.push(place(
    new THREE.BoxGeometry(w * 0.8, h * 0.7, len * 0.5),
    w * 0.05, 0, 0,
  ));

  // Bolted-on cockpit — cylinder at an angle
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.2, w * 0.25, len * 0.2, 5),
    -w * 0.2, h * 0.3, len * 0.35,
    HALF_PI, 0, 0.15,
  ));

  // Salvaged engine — different on each side (asymmetric)
  parts.push(place(
    new THREE.CylinderGeometry(h * 0.2, h * 0.25, len * 0.15, 6),
    w * 0.4, -h * 0.1, -len * 0.38,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.BoxGeometry(w * 0.3, h * 0.35, len * 0.12),
    -w * 0.35, h * 0.1, -len * 0.4,
  ));

  // Scrap plating
  if (cx >= 1) {
    parts.push(place(
      new THREE.BoxGeometry(w * 1.1, h * 0.06, len * 0.35),
      0, h * 0.4, 0.05,
    ));
  }

  // Jury-rigged sensor dish
  if (cx >= 2) {
    parts.push(place(
      new THREE.ConeGeometry(w * 0.25, h * 0.3, 6),
      w * 0.5, h * 0.5, len * 0.1,
    ));
  }

  // Cargo container bolted to side
  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.35, h * 0.5, len * 0.3),
      -w * 0.65, -h * 0.1, -len * 0.05,
    ));
  }

  // Welded-on gun platform
  if (cx >= 4) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.4, h * 0.2, len * 0.15),
      w * 0.55, h * 0.35, len * 0.2,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.05, w * 0.05, len * 0.15, 4),
      w * 0.55, h * 0.5, len * 0.25,
      HALF_PI, 0, 0,
    ));
  }

  // Capital: multiple hull sections lashed together
  if (cx >= 5) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.6, h * 0.5, len * 0.3),
      w * 0.1, -h * 0.5, len * 0.15,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.15, w * 0.15, len * 0.4, 6),
      -w * 0.3, h * 0.4, -len * 0.1,
      HALF_PI, 0, 0.1,
    ));
  }

  return merge(parts);
}

// ── 8. LUMINARI — Ethereal, energy constructs, thin frames ──────────────────

function buildLuminari(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];

  // Central energy core — small bright sphere
  parts.push(place(
    new THREE.SphereGeometry(w * 0.2, 8, 8),
    0, 0, 0,
  ));

  // Structural frame — thin rods forming a cage
  const rodR = w * 0.02;
  // Longitudinal rods
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, len * 0.8, 4),
    0, w * 0.3, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, len * 0.8, 4),
    0, -w * 0.3, 0,
    HALF_PI, 0, 0,
  ));
  parts.push(...mirrorX(s => place(
    new THREE.CylinderGeometry(rodR, rodR, len * 0.8, 4),
    s * w * 0.3, 0, 0,
    HALF_PI, 0, 0,
  )));

  // Cross braces
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, w * 0.6, 4),
    0, 0, len * 0.35,
  ));
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, w * 0.6, 4),
    0, 0, -len * 0.35,
  ));
  // Horizontal cross
  parts.push(place(
    new THREE.CylinderGeometry(rodR, rodR, w * 0.6, 4),
    0, 0, len * 0.35,
    0, 0, HALF_PI,
  ));

  // Energy node at bow
  parts.push(place(
    new THREE.SphereGeometry(w * 0.1, 6, 6),
    0, 0, len * 0.4,
  ));

  // Additional energy nodes along frame
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.08, 5, 5),
      s * w * 0.3, 0, len * 0.2,
    )));
  }

  // Sail-like energy fields — very thin cylinders
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.01, w * 0.01, len * 0.5, 3),
      s * w * 0.5, 0, 0,
      HALF_PI, 0, s * 0.15,
    )));
  }

  // Capital: ring structure
  if (cx >= 4) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.4, w * 0.03, 6, 12),
      0, 0, len * 0.1,
      HALF_PI, 0, 0,
    ));
  }

  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.55, w * 0.025, 6, 16),
      0, 0, -len * 0.15,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}

// ── 9. ZORVATHI — Insectoid, chitinous, segmented ───────────────────────────

function buildZorvathi(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  // Segmented body — multiple spheroids connected
  const segCount = 3 + Math.min(cx, 4);
  const segLen = len * 0.8 / segCount;
  for (let i = 0; i < segCount; i++) {
    const t = i / (segCount - 1);
    const segR = w * (0.4 + 0.6 * Math.sin(t * PI));
    const z = (0.5 - t) * len * 0.8;
    parts.push(place(
      new THREE.SphereGeometry(segR, 7, 5),
      0, 0, z,
      0, 0, 0,
      0.8, 0.6, segLen / (segR * 2) * 1.1,
    ));
  }

  // Head — mandible shapes
  parts.push(place(
    new THREE.ConeGeometry(w * 0.15, len * 0.12, 4),
    w * 0.15, -w * 0.1, len * 0.45,
    HALF_PI, PI / 4, 0.2,
  ));
  parts.push(place(
    new THREE.ConeGeometry(w * 0.15, len * 0.12, 4),
    -w * 0.15, -w * 0.1, len * 0.45,
    HALF_PI, PI / 4, -0.2,
  ));

  // Leg-like struts
  if (cx >= 2) {
    for (let i = 0; i < 3; i++) {
      const z = len * (0.15 - i * 0.15);
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.03, w * 0.02, w * 0.6, 4),
        s * w * 0.5, -w * 0.25, z,
        0, 0, s * 0.6,
      )));
    }
  }

  // Carapace ridge
  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.1, w * 0.15, len * 0.5),
      0, w * 0.45, 0,
    ));
  }

  // Wing casings
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.5, 6, 4, 0, PI, 0, HALF_PI),
      s * w * 0.3, w * 0.15, 0,
      HALF_PI, s * 0.5, 0,
      0.15, 1, 1.5,
    )));
  }

  // Capital: tail stinger
  if (cx >= 5) {
    parts.push(place(
      new THREE.ConeGeometry(w * 0.1, len * 0.2, 4),
      0, w * 0.1, -len * 0.5,
      HALF_PI, PI / 4, 0,
    ));
  }

  return merge(parts);
}

// ── 10. ORIVANI — Temple-like, ornate, cathedral with spires ────────────────

function buildOrivani(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.22;
  const h = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  // Central nave — tall box
  parts.push(place(
    new THREE.BoxGeometry(w * 0.6, h * 1.0, len * 0.6),
    0, 0, 0,
  ));

  // Pointed prow — pyramid
  parts.push(place(
    new THREE.ConeGeometry(w * 0.35, len * 0.25, 4),
    0, 0, len * 0.42,
    HALF_PI, PI / 4, 0,
  ));

  // Central spire
  parts.push(place(
    new THREE.ConeGeometry(w * 0.08, h * 1.2, 4),
    0, h * 0.9, len * 0.05,
  ));

  // Side buttresses
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.15, h * 0.8, len * 0.45),
    s * w * 0.4, -h * 0.1, 0,
  )));

  // Fore towers
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.1, h * 0.8, 6),
      s * w * 0.35, h * 0.15, len * 0.2,
    )));
    // Tower caps
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.1, h * 0.3, 6),
      s * w * 0.35, h * 0.65, len * 0.2,
    )));
  }

  // Rose window (flattened torus at bow)
  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.2, w * 0.04, 6, 8),
      0, h * 0.1, len * 0.32,
      HALF_PI, 0, 0,
    ));
  }

  // Flying buttress arcs
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.5, w * 0.03, 5, 8, PI * 0.5),
      s * w * 0.5, h * 0.15, -len * 0.05,
      0, s * HALF_PI, HALF_PI,
    )));
  }

  // Capital: bell towers and aft shrine
  if (cx >= 5) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.08, h * 1.0, 6),
      s * w * 0.5, h * 0.2, -len * 0.2,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.09, h * 0.35, 6),
      s * w * 0.5, h * 0.8, -len * 0.2,
    )));
    parts.push(place(
      new THREE.ConeGeometry(w * 0.06, h * 0.6, 4),
      0, h * 0.6, -len * 0.28,
    ));
  }

  return merge(parts);
}

// ── 11. KAELENTH — Precise, machined, chrome (Apple in space) ───────────────

function buildKaelenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  // Main body — smooth capsule (rounded cylinder)
  parts.push(place(
    new THREE.CapsuleGeometry(w * 0.35, len * 0.5, 8, 12),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  // Engine ring — perfect torus at aft
  parts.push(place(
    new THREE.TorusGeometry(w * 0.3, w * 0.05, 8, 16),
    0, 0, -len * 0.35,
    HALF_PI, 0, 0,
  ));

  // Sensor dome — hemisphere at bow
  parts.push(place(
    new THREE.SphereGeometry(w * 0.2, 10, 8, 0, PI * 2, 0, HALF_PI),
    0, 0, len * 0.42,
    -HALF_PI, 0, 0,
  ));

  // Flush weapon blisters
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.06, len * 0.15, 4, 8),
      s * w * 0.35, 0, len * 0.1,
      HALF_PI, 0, 0,
    )));
  }

  // Secondary ring
  if (cx >= 3) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.35, w * 0.03, 6, 16),
      0, 0, len * 0.1,
      HALF_PI, 0, 0,
    ));
  }

  // Nacelle pods — smooth cylinders
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.1, len * 0.3, 6, 8),
      s * w * 0.5, 0, -len * 0.05,
      HALF_PI, 0, 0,
    )));
  }

  // Capital: tertiary precision ring + fin
  if (cx >= 5) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.025, 6, 20),
      0, 0, -len * 0.1,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.BoxGeometry(w * 0.02, w * 0.6, len * 0.4),
      0, w * 0.25, 0,
    ));
  }

  return merge(parts);
}

// ── 12. THYRIAQ — Amorphous, shifting surface, liquid metal ─────────────────

function buildThyriaq(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.28;
  const parts: THREE.BufferGeometry[] = [];

  // Primary blob — deformed sphere
  parts.push(place(
    new THREE.SphereGeometry(w * 0.6, 8, 6),
    0, 0, 0,
    0, 0, 0,
    1.0, 0.8, 1.5,
  ));

  // Secondary blob
  parts.push(place(
    new THREE.SphereGeometry(w * 0.4, 7, 5),
    w * 0.15, w * 0.1, len * 0.2,
    0, 0, 0,
    0.9, 0.7, 1.2,
  ));

  // Tendrils of nano-matter
  const tendrilCount = 2 + cx;
  for (let i = 0; i < tendrilCount; i++) {
    const angle = (i / tendrilCount) * PI * 2 + 0.3;
    const tLen = len * (0.1 + 0.03 * cx);
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.05, w * 0.02, tLen, 4),
      Math.cos(angle) * w * 0.5,
      Math.sin(angle) * w * 0.4,
      -len * 0.15,
      0.3 * Math.sin(angle), 0, 0.3 * Math.cos(angle),
    ));
  }

  // Sub-blobs
  if (cx >= 2) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.25, 6, 5),
      -w * 0.3, -w * 0.15, -len * 0.15,
    ));
  }

  // Flowing ridge
  if (cx >= 3) {
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.1, len * 0.4, 4, 6),
      w * 0.2, w * 0.3, 0,
      HALF_PI, 0, 0.2,
    ));
  }

  // Pseudo-pod weapons
  if (cx >= 4) {
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.08, len * 0.2, 5),
      s * w * 0.4, 0, len * 0.3,
      HALF_PI, 0, 0,
    )));
  }

  // Capital: massive amoeba form
  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.5, 8, 6),
      0, -w * 0.2, -len * 0.2,
      0, 0, 0,
      1.1, 0.6, 1.3,
    ));
  }

  return merge(parts);
}

// ── 13. AETHYN — Impossible geometry, Escher-like ───────────────────────────

function buildAethyn(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.22;
  const parts: THREE.BufferGeometry[] = [];

  // Central dodecahedron
  parts.push(place(
    new THREE.DodecahedronGeometry(w * 0.4, 0),
    0, 0, 0,
  ));

  // Phase-shifted tetrahedra at odd angles
  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.3, 0),
    0, 0, len * 0.3,
    0.5, 0.7, 0.3,
  ));
  parts.push(place(
    new THREE.TetrahedronGeometry(w * 0.25, 0),
    0, 0, -len * 0.25,
    0.8, 1.2, 0.5,
  ));

  // Twisted ring — torus at an impossible angle
  parts.push(place(
    new THREE.TorusGeometry(w * 0.35, w * 0.04, 6, 12),
    0, 0, 0,
    0.7, 0.3, 0,
  ));

  // Inter-dimensional struts — rods at non-orthogonal angles
  if (cx >= 2) {
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, len * 0.5, 4),
      0, 0, 0,
      0.3, 1.1, 0,
    ));
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.02, len * 0.5, 4),
      0, 0, 0,
      1.0, 0.4, 0.7,
    ));
  }

  // Floating satellite shapes
  if (cx >= 3) {
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.15, 0),
      w * 0.5, w * 0.3, len * 0.15,
    ));
    parts.push(place(
      new THREE.IcosahedronGeometry(w * 0.12, 0),
      -w * 0.4, -w * 0.25, -len * 0.1,
    ));
  }

  // Second intersecting torus
  if (cx >= 4) {
    parts.push(place(
      new THREE.TorusGeometry(w * 0.45, w * 0.03, 6, 14),
      0, 0, 0,
      HALF_PI + 0.4, 0.8, 0,
    ));
  }

  // Capital: nested dodecahedra
  if (cx >= 5) {
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.6, 0),
      0, 0, 0,
      0.5, 0.5, 0.5,
    ));
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.2, 0),
      w * 0.4, w * 0.4, len * 0.2,
      1.2, 0.4, 2.1,
    ));
  }

  return merge(parts);
}

// ── 14. VETHARA — Dual-natured, parasitic tendrils + host ───────────────────

function buildVethara(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  // Host hull — standard cylindrical body
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.3, w * 0.35, len * 0.65, 8),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  // Host prow
  parts.push(place(
    new THREE.SphereGeometry(w * 0.3, 8, 6),
    0, 0, len * 0.32,
    0, 0, 0,
    1, 1, 0.6,
  ));

  // Parasitic tendril wrapping around host — spiral of small cylinders
  const spiralSegments = 8 + cx * 3;
  for (let i = 0; i < spiralSegments; i++) {
    const t = i / spiralSegments;
    const angle = t * PI * 3; // 1.5 full wraps
    const z = (0.4 - t * 0.8) * len;
    const r = w * 0.35 + w * 0.05;
    parts.push(place(
      new THREE.SphereGeometry(w * 0.06, 4, 3),
      Math.cos(angle) * r,
      Math.sin(angle) * r,
      z,
    ));
  }

  // Tendril arms reaching forward
  if (cx >= 2) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * PI * 2;
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.03, w * 0.05, len * 0.2, 4),
        Math.cos(angle) * w * 0.35,
        Math.sin(angle) * w * 0.35,
        len * 0.4,
        HALF_PI + 0.3 * Math.sin(angle), 0, 0.3 * Math.cos(angle),
      ));
    }
  }

  // Symbiont organ pods
  if (cx >= 3) {
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.15, 6, 5),
      s * w * 0.45, 0, len * 0.1,
    )));
  }

  // Enveloping membrane
  if (cx >= 4) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.5, 8, 6, 0, PI * 2, 0, PI * 0.6),
      0, w * 0.1, 0,
      HALF_PI, 0, 0,
      1.0, 0.3, 1.5,
    ));
  }

  // Capital: fully enveloped host, tendril crown
  if (cx >= 5) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * PI * 2;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.04, len * 0.15, 4),
        Math.cos(angle) * w * 0.4,
        Math.sin(angle) * w * 0.4,
        len * 0.42,
        HALF_PI, 0, 0,
      ));
    }
  }

  return merge(parts);
}

// ── 15. PYRENTH — Volcanic, obsidian, magma-veined ──────────────────────────

function buildPyrenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.25;
  const h = len * 0.2;
  const parts: THREE.BufferGeometry[] = [];

  // Main hull — rough angular octahedron
  parts.push(place(
    new THREE.OctahedronGeometry(w * 0.5, 1), // detail=1 for rough facets
    0, 0, 0,
    0, 0, 0,
    0.9, 0.7, len * 0.035,
  ));

  // Obsidian prow blade
  parts.push(place(
    new THREE.ConeGeometry(w * 0.2, len * 0.3, 3),
    0, 0, len * 0.4,
    HALF_PI, 0, 0,
  ));

  // Magma vents — cylinders
  if (cx >= 1) {
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.12, h * 0.4, 5),
      s * w * 0.3, h * 0.2, -len * 0.1,
    )));
  }

  // Crag plating — angular boxes
  if (cx >= 2) {
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.2, h * 0.5, len * 0.3),
      s * w * 0.45, -h * 0.1, len * 0.05,
      0, 0, s * 0.15,
    )));
  }

  // Lava channelling troughs
  if (cx >= 3) {
    parts.push(place(
      new THREE.BoxGeometry(w * 0.08, h * 0.08, len * 0.6),
      0, h * 0.35, 0,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.06, h * 0.06, len * 0.4),
      s * w * 0.25, h * 0.3, len * 0.05,
    )));
  }

  // Engine crags — rough cones at aft
  if (cx >= 4) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * PI * 2;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.12, len * 0.15, 3),
        Math.cos(angle) * w * 0.2,
        Math.sin(angle) * w * 0.2,
        -len * 0.45,
        HALF_PI, 0, 0,
      ));
    }
  }

  // Capital: caldera command dome + extra volcanic mass
  if (cx >= 5) {
    parts.push(place(
      new THREE.SphereGeometry(w * 0.3, 6, 4, 0, PI * 2, 0, HALF_PI),
      0, h * 0.35, len * 0.15,
      0, 0, 0,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.35, 1),
      0, -h * 0.2, -len * 0.25,
      0.3, 0.5, 0.2,
      0.8, 0.6, 1.2,
    ));
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
    color: 0x8899aa,
    emissive: 0x112233,
    emissiveIntensity: 0.15,
    metalness: 0.6,
    roughness: 0.55,
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
    emissive: 0x8855ff,
    emissiveIntensity: 0.5,
    metalness: 0.3,
    roughness: 0.15,
    opacity: 0.85,
    transparent: true,
  },
  // Sylvani — deep green, bioluminescent
  sylvani: {
    color: 0x336633,
    emissive: 0x44ff44,
    emissiveIntensity: 0.3,
    metalness: 0.1,
    roughness: 0.8,
  },
  // Nexari — gunmetal with cool blue data-glow
  nexari: {
    color: 0x556677,
    emissive: 0x0088ff,
    emissiveIntensity: 0.35,
    metalness: 0.7,
    roughness: 0.3,
  },
  // Drakmari — deep ocean blue, bioluminescent teal
  drakmari: {
    color: 0x224466,
    emissive: 0x00ccbb,
    emissiveIntensity: 0.25,
    metalness: 0.4,
    roughness: 0.35,
  },
  // Ashkari — rusted brown, patchwork
  ashkari: {
    color: 0x886644,
    emissive: 0x553311,
    emissiveIntensity: 0.1,
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
    color: 0xaabbcc,
    emissive: 0x66aacc,
    emissiveIntensity: 0.35,
    metalness: 0.8,
    roughness: 0.1,
  },
  // Aethyn — deep purple, phase-shift glow
  aethyn: {
    color: 0x6633aa,
    emissive: 0xaa44ff,
    emissiveIntensity: 0.5,
    metalness: 0.4,
    roughness: 0.25,
    opacity: 0.8,
    transparent: true,
  },
  // Vethara — two-tone: pale host grey + organic red tendrils
  // (single material — average of the two tones)
  vethara: {
    color: 0x998877,
    emissive: 0xcc3333,
    emissiveIntensity: 0.25,
    metalness: 0.35,
    roughness: 0.55,
  },
  // Pyrenth — obsidian black with magma-orange glow
  pyrenth: {
    color: 0x222222,
    emissive: 0xff4400,
    emissiveIntensity: 0.45,
    metalness: 0.6,
    roughness: 0.7,
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
