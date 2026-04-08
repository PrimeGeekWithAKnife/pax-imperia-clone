import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../shipHardpoints';

/**
 * ============================================================================
 *  PYRENTH SHIP DESIGN — "VOLCANIC OBSIDIAN MONOLITH ARCHITECTURE"
 * ============================================================================
 *
 *  The Pyrenth are geological sculptors — silicon-crystal organisms who shaped
 *  their homeworld's mantle for four billion years. Their ships look GROWN
 *  from a planet's crust: obsidian monolith cores, basalt column engine
 *  clusters, tectonic crag plate armour, crystalline weapon spires, caldera
 *  command structures, and magma spine ridges running stern to bow.
 *
 *  DISTINCTIVENESS: Pyrenth ships are STONE, not metal. They use octahedra,
 *  tetrahedra, and rough polyhedra — never smooth curves. Faceted, angular,
 *  geological. Obsidian black with magma-orange emissive (0xff3300).
 *  A Pyrenth warship looks like a volcanic mountain that learned to fly.
 *
 *  SILHOUETTE: Triangular prow blade tapering to a dorsal keel, flanked by
 *  tectonic crag plates, with hexagonal basalt column engines at the stern.
 *  Capital ships gain a caldera command torus and crystalline spire batteries.
 */

export function buildPyrenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.35;
  const h = len * 0.25;
  const parts: THREE.BufferGeometry[] = [];

  // ── Monolith core (always present) ──────────────────────────────────
  // Primary hull: a rough-faceted octahedron stretched along z, the heart
  // of every Pyrenth vessel from scout to dreadnought.
  parts.push(place(
    new THREE.OctahedronGeometry(w * 0.55, 1),
    0, 0, len * 0.02,
    0, 0, 0,
    0.85, 0.6, len * 0.042,
  ));

  // Secondary monolith slab — offset slightly aft, gives depth to the hull
  parts.push(place(
    new THREE.OctahedronGeometry(w * 0.38, 1),
    0, -h * 0.08, -len * 0.12,
    0.08, 0.15, 0,
    0.7, 0.5, len * 0.028,
  ));

  // ── Triangular prow blade (always present) ──────────────────────────
  // Sharp obsidian spear point, triangular cross-section (3 segments)
  parts.push(place(
    new THREE.ConeGeometry(w * 0.2, len * 0.34, 3),
    0, 0, len * 0.42,
    HALF_PI, 0, 0,
  ));

  // Prow tip — narrower, sharper shard
  parts.push(place(
    new THREE.ConeGeometry(w * 0.08, len * 0.14, 3),
    0, h * 0.02, len * 0.56,
    HALF_PI, 0, 0,
  ));

  // ── Dorsal keel (always present) ────────────────────────────────────
  // Blade of obsidian running along the top — the ship's spine
  parts.push(place(
    new THREE.BoxGeometry(w * 0.04, h * 0.38, len * 0.26),
    0, h * 0.18, len * 0.34,
    0.05, 0, 0,
  ));

  // Keel tapers aft
  parts.push(place(
    new THREE.BoxGeometry(w * 0.035, h * 0.28, len * 0.18),
    0, h * 0.14, len * 0.12,
    0.03, 0, 0,
  ));

  // ── Ventral ridge (always present) ──────────────────────────────────
  // Keel underside — less pronounced than dorsal
  parts.push(place(
    new THREE.BoxGeometry(w * 0.05, h * 0.18, len * 0.3),
    0, -h * 0.22, len * 0.05,
  ));

  // ── cx >= 1: Tectonic crag plates + lateral shards ──────────────────
  if (cx >= 1) {
    // Paired tectonic plate slabs flanking the hull
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.2, h * 0.52, len * 0.3),
      s * w * 0.42, -h * 0.06, len * 0.04,
      0, 0, s * 0.15,
    )));

    // Smaller crag shards above the plates
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.1, 0),
      s * w * 0.38, h * 0.26, len * 0.12,
      0.2, s * 0.3, 0,
    )));

    // Obsidian splinter shards on the prow
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.06, 0),
      s * w * 0.14, h * 0.08, len * 0.48,
      0.15, s * 0.4, 0,
    )));
  }

  // ── cx >= 2: Extended plate armour + ventral crag ───────────────────
  if (cx >= 2) {
    // Thicker lateral armour plates
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.22, h * 0.56, len * 0.32),
      s * w * 0.48, -h * 0.1, len * 0.02,
      0, 0, s * 0.2,
    )));

    // Upper crag shelves
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.14, h * 0.14, len * 0.22),
      s * w * 0.4, h * 0.24, len * 0.16,
      0.06, 0, s * 0.12,
    )));

    // Ventral tectonic slab
    parts.push(place(
      new THREE.BoxGeometry(w * 0.36, h * 0.12, len * 0.24),
      0, -h * 0.34, -len * 0.08,
      0.04, 0, 0,
    ));

    // Aft ventral crag
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.09, 0),
      0, -h * 0.38, -len * 0.2,
      0.3, 0.2, 0,
    ));
  }

  // ── cx >= 3: Magma spine ridges + dorsal crest ──────────────────────
  if (cx >= 3) {
    // Main dorsal magma spine — runs most of the ship length
    parts.push(place(
      new THREE.BoxGeometry(w * 0.06, h * 0.12, len * 0.7),
      0, h * 0.4, 0,
    ));

    // Lateral magma ridges — paired spines flanking the dorsal
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.05, h * 0.07, len * 0.5),
      s * w * 0.2, h * 0.34, len * 0.06,
    )));

    // Ventral magma spine
    parts.push(place(
      new THREE.BoxGeometry(w * 0.07, h * 0.1, len * 0.45),
      0, -h * 0.38, -len * 0.05,
    ));

    // Spine nodes — tetrahedra along the dorsal ridge
    for (let i = 0; i < 4; i++) {
      const nz = len * (0.25 - i * 0.15);
      parts.push(place(
        new THREE.TetrahedronGeometry(w * 0.045, 0),
        0, h * 0.48, nz,
        0.3, i * 0.4, 0,
      ));
    }
  }

  // ── cx >= 4: Basalt column engine clusters ──────────────────────────
  if (cx >= 4) {
    // Hexagonal basalt columns (CylinderGeometry with 6 radial segments)
    // arranged in a cluster at the stern, each capped with an exhaust cone.
    const engineCount = cx >= 6 ? 7 : cx >= 5 ? 5 : 3;
    const clusterRadius = w * (engineCount > 5 ? 0.3 : engineCount > 3 ? 0.24 : 0.2);

    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      const ex = Math.cos(angle) * clusterRadius;
      const ey = Math.sin(angle) * clusterRadius;

      // Basalt column — hexagonal cross-section
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.09, w * 0.11, len * 0.18, 6),
        ex, ey, -len * 0.44,
        HALF_PI, 0, 0,
      ));

      // Exhaust cone cap
      parts.push(place(
        new THREE.ConeGeometry(w * 0.07, len * 0.07, 6),
        ex, ey, -len * 0.52,
        -HALF_PI, 0, 0,
      ));

      // Column collar ring
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.12, w * 0.12, len * 0.015, 6),
        ex, ey, -len * 0.36,
        HALF_PI, 0, 0,
      ));
    }

    // Central engine hub — larger hexagonal column
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.08, len * 0.22, 6),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));

    // Central exhaust cone
    parts.push(place(
      new THREE.ConeGeometry(w * 0.05, len * 0.06, 6),
      0, 0, -len * 0.54,
      -HALF_PI, 0, 0,
    ));
  }

  // ── cx >= 4: Crystalline weapon spires ──────────────────────────────
  if (cx >= 4) {
    // Weapon spires: ConeGeometry crystal atop CylinderGeometry pedestal
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.06, h * 0.2, 6),
      s * w * 0.35, h * 0.32, len * 0.18,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.035, h * 0.22, 4),
      s * w * 0.35, h * 0.54, len * 0.18,
    )));

    // Forward weapon spires — closer to the prow
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.03, w * 0.045, h * 0.15, 6),
      s * w * 0.22, h * 0.25, len * 0.32,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.028, h * 0.18, 4),
      s * w * 0.22, h * 0.44, len * 0.32,
    )));
  }

  // ── cx >= 5: Caldera command structure ──────────────────────────────
  if (cx >= 5) {
    // Caldera torus rim — the command bridge sits in a volcanic crater
    parts.push(place(
      new THREE.TorusGeometry(w * 0.24, w * 0.05, 4, 6),
      0, h * 0.38, len * 0.15,
      HALF_PI, 0, 0,
    ));

    // Half-sphere dome — command citadel rising from the caldera
    parts.push(place(
      new THREE.SphereGeometry(w * 0.2, 5, 3, 0, PI * 2, 0, HALF_PI),
      0, h * 0.4, len * 0.15,
    ));

    // Caldera floor plate
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.22, w * 0.22, h * 0.03, 6),
      0, h * 0.36, len * 0.15,
      HALF_PI, 0, 0,
      1, 1, 0.3,
    ));

    // Sensor obelisks around the caldera
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * PI * 2 + PI / 4;
      const ox = Math.cos(angle) * w * 0.28;
      const oz = Math.sin(angle) * w * 0.28;
      parts.push(place(
        new THREE.TetrahedronGeometry(w * 0.04, 0),
        ox, h * 0.52, len * 0.15 + oz,
        0.2, angle, 0,
      ));
    }

    // Aft secondary monolith — massive octahedron reactor housing
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.34, 1),
      0, -h * 0.2, -len * 0.26,
      0.25, 0.4, 0.15,
      0.75, 0.55, 1.15,
    ));

    // Ventral weapon spires — underside battery
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.03, w * 0.05, h * 0.16, 6),
      s * w * 0.3, -h * 0.38, len * 0.1,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.03, h * 0.16, 4),
      s * w * 0.3, -h * 0.54, len * 0.1,
      PI, 0, 0,
    )));
  }

  // ── cx >= 6: Tectonic fortification + magma vein ridges ─────────────
  if (cx >= 6) {
    // Dorsal magma vein nodes — icosahedra along the spine
    const ridgePositions = [-0.22, -0.08, 0.06, 0.2, 0.32];
    for (let i = 0; i < ridgePositions.length; i++) {
      const zPos = len * ridgePositions[i];
      const yJitter = h * (0.44 + (i % 2) * 0.06);
      const size = w * (0.055 + (i % 3) * 0.015);
      parts.push(place(
        new THREE.IcosahedronGeometry(size, 0),
        w * ((i % 2) - 0.5) * 0.08, yJitter, zPos,
      ));
    }

    // Heavy lateral tectonic slabs — outer armour plates
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.12, h * 0.65, len * 0.24),
      s * w * 0.56, -h * 0.12, -len * 0.14,
      0, 0, s * 0.22,
    )));

    // Forward tectonic crag plates
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.1, h * 0.4, len * 0.16),
      s * w * 0.52, h * 0.06, len * 0.2,
      0, 0, s * 0.18,
    )));

    // Obsidian shards — decorative jagged fragments on the hull
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.07, 0),
      s * w * 0.5, h * 0.3, len * 0.0,
      0.4, s * 0.6, 0.2,
    )));

    // Ventral basalt buttresses
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.06, h * 0.35, 6),
      s * w * 0.4, -h * 0.42, -len * 0.1,
      0, 0, s * 0.3,
    )));
  }

  // ── cx >= 7: Secondary caldera + weapon battery expansion ───────────
  if (cx >= 7) {
    // Central magma core — dodecahedron deep within the hull
    parts.push(place(
      new THREE.DodecahedronGeometry(w * 0.22, 0),
      0, 0, len * 0.0,
      0.2, 0.3, 0.1,
    ));

    // Prow crest spire cluster — tetrahedra crowning the prow
    parts.push(place(
      new THREE.TetrahedronGeometry(w * 0.09, 0),
      0, h * 0.22, len * 0.38,
      0.3, 0, 0.15,
    ));
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.065, 0),
      s * w * 0.12, h * 0.2, len * 0.36,
      0.2, s * 0.2, 0,
    )));

    // Broadside crystalline battery — additional weapon spires amidships
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.035, w * 0.05, h * 0.18, 6),
      s * w * 0.52, h * 0.16, len * 0.0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.032, h * 0.2, 4),
      s * w * 0.52, h * 0.36, len * 0.0,
    )));

    // Aft tectonic bracing — heavy stern reinforcement
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, h * 0.48, len * 0.14),
      s * w * 0.46, -h * 0.05, -len * 0.32,
      0, 0, s * 0.15,
    )));

    // Ventral observation obelisks
    parts.push(...mirrorX(s => place(
      new THREE.TetrahedronGeometry(w * 0.05, 0),
      s * w * 0.2, -h * 0.46, len * 0.12,
      PI, s * 0.3, 0,
    )));
  }

  // ── cx >= 8: Dreadnought — citadel fortress ────────────────────────
  if (cx >= 8) {
    // Grand dorsal citadel — stacked octahedra forming a mountain peak
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.3, 1),
      0, h * 0.48, len * 0.0,
      0.15, 0.2, 0.1,
      1.0, 0.7, 0.9,
    ));
    parts.push(place(
      new THREE.OctahedronGeometry(w * 0.22, 1),
      w * 0.08, h * 0.44, len * 0.18,
      0.1, -0.15, 0.2,
      0.8, 0.6, 0.75,
    ));

    // Ring of basalt column turret mounts around the citadel
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * PI * 2;
      const rx = Math.cos(angle) * w * 0.5;
      const ry = Math.sin(angle) * w * 0.5;
      // Basalt column mount
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.06, w * 0.08, len * 0.1, 6),
        rx, ry, len * 0.05,
        HALF_PI, 0, 0,
      ));
      // Crystalline spire atop each mount
      parts.push(place(
        new THREE.ConeGeometry(w * 0.04, h * 0.14, 4),
        rx, ry + h * 0.12, len * 0.05,
      ));
    }

    // Aft caldera — secondary command structure at stern
    parts.push(place(
      new THREE.TorusGeometry(w * 0.18, w * 0.04, 4, 6),
      0, h * 0.3, -len * 0.22,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.SphereGeometry(w * 0.15, 5, 3, 0, PI * 2, 0, HALF_PI),
      0, h * 0.32, -len * 0.22,
    ));

    // Ventral fortress plate — massive stone belly plate
    parts.push(place(
      new THREE.BoxGeometry(w * 0.7, h * 0.08, len * 0.5),
      0, -h * 0.48, 0,
    ));

    // Prow ram — heavy obsidian ram spear
    parts.push(place(
      new THREE.ConeGeometry(w * 0.12, len * 0.2, 3),
      0, -h * 0.06, len * 0.6,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getPyrenthHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.35;
  const h = len * 0.25;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── cx >= 4: Basalt column engine cluster ─────────────────────────────────
  // Hexagonal basalt columns at the stern with exhaust cones.
  if (cx >= 4) {
    const engineCount = cx >= 6 ? 7 : cx >= 5 ? 5 : 3;
    const clusterRadius = w * (engineCount > 5 ? 0.3 : engineCount > 3 ? 0.24 : 0.2);

    for (let i = 0; i < engineCount; i++) {
      const angle = (i / engineCount) * PI * 2;
      engines.push({
        position: new THREE.Vector3(
          Math.cos(angle) * clusterRadius,
          Math.sin(angle) * clusterRadius,
          -len * 0.52,
        ),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.07,
      });
    }

    // Central engine hub exhaust
    engines.push({
      position: new THREE.Vector3(0, 0, -len * 0.54),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.05,
    });
  }

  // ── cx >= 4: Crystalline weapon spires ────────────────────────────────────
  if (cx >= 4) {
    // Dorsal weapon spires — mid-hull
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.35, h * 0.54, len * 0.18),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
    // Forward weapon spires — closer to prow
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.22, h * 0.44, len * 0.32),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
  }

  // ── cx >= 5: Ventral weapon spires ────────────────────────────────────────
  if (cx >= 5) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.3, -h * 0.54, len * 0.1),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, -1, 0),
      });
    }
  }

  // ── cx >= 7: Broadside crystalline battery + prow crest spires ────────────
  if (cx >= 7) {
    // Broadside weapon spires amidships
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.52, h * 0.36, len * 0.0),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }

    // Prow crest spire cluster
    weapons.push({
      position: new THREE.Vector3(0, h * 0.22, len * 0.38),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });

    // Ventral observation obelisks
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.2, -h * 0.46, len * 0.12),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, -1, 0),
      });
    }
  }

  // ── cx >= 8: Citadel turret ring + aft caldera ────────────────────────────
  if (cx >= 8) {
    // Ring of crystalline spire turrets around the citadel
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * PI * 2;
      weapons.push({
        position: new THREE.Vector3(
          Math.cos(angle) * w * 0.5,
          Math.sin(angle) * w * 0.5 + h * 0.12,
          len * 0.05,
        ),
        facing: 'turret',
        normal: new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize(),
      });
    }
  }

  return { engines, weapons };
}

registerHardpointProvider('pyrenth', getPyrenthHardpoints);
