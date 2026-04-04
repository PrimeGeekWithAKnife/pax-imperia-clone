/**
 * ShipModel3D -- React Three Fiber 3D ship preview for the ship designer.
 *
 * Renders a procedural hull from cross-section profiles with green wireframe
 * aesthetic, weapon mount points, firing arc wedges, and internal subsystem
 * compartments.  Drag to rotate with smooth interpolation; auto-rotates when
 * idle.
 */
import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type {
  HullClass,
  SlotPosition,
  ShipComponent,
  ComponentType,
  CoreSystemRole,
} from '@nova-imperia/shared';
import { ALL_CORE_SYSTEM_ROLES } from '@nova-imperia/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ShipModel3DProps {
  hullClass: HullClass;
  components: Array<{ slot: SlotPosition; component: ShipComponent | null }>;
  /** When set, highlight this weapon's firing arcs */
  highlightWeaponSlotId?: string | null;
  /** Show/hide all weapon arcs */
  showArcs?: boolean;
  /** Width/height of the viewport */
  width?: number;
  height?: number;
  /** Core system tier overrides — upgraded systems shown brighter/larger. */
  coreSystemOverrides?: Array<{ role: CoreSystemRole; componentId: string }>;
}

// ── Hull cross-section profiles ──────────────────────────────────────────────
// Each entry defines { z, rx, ry } — position along the spine and the
// horizontal/vertical radii of the oval cross-section at that point.

interface HullSection {
  z: number;
  rx: number;
  ry: number;
}

const HULL_PROFILES: Record<HullClass, HullSection[]> = {
  // Scout: small, sleek, elongated needle
  scout: [
    { z: -2.4, rx: 0.04, ry: 0.04 },
    { z: -2.0, rx: 0.18, ry: 0.14 },
    { z: -1.4, rx: 0.34, ry: 0.26 },
    { z: -0.6, rx: 0.44, ry: 0.32 },
    { z: 0.2,  rx: 0.40, ry: 0.30 },
    { z: 0.8,  rx: 0.34, ry: 0.26 },
    { z: 1.4,  rx: 0.26, ry: 0.20 },
    { z: 1.8,  rx: 0.20, ry: 0.16 },
  ],

  // Destroyer: medium, angular, broader mid-section
  destroyer: [
    { z: -3.0, rx: 0.06, ry: 0.06 },
    { z: -2.6, rx: 0.28, ry: 0.22 },
    { z: -2.0, rx: 0.52, ry: 0.42 },
    { z: -1.2, rx: 0.72, ry: 0.55 },
    { z: -0.2, rx: 0.82, ry: 0.62 },
    { z: 0.6,  rx: 0.78, ry: 0.58 },
    { z: 1.4,  rx: 0.68, ry: 0.52 },
    { z: 2.0,  rx: 0.58, ry: 0.46 },
    { z: 2.5,  rx: 0.48, ry: 0.40 },
    { z: 2.9,  rx: 0.40, ry: 0.35 },
  ],

  // Transport: boxy mid-section cargo hold, narrower at ends
  transport: [
    { z: -2.2, rx: 0.06, ry: 0.06 },
    { z: -1.8, rx: 0.30, ry: 0.30 },
    { z: -1.0, rx: 0.50, ry: 0.48 },
    { z: -0.2, rx: 0.55, ry: 0.50 },
    { z: 0.6,  rx: 0.55, ry: 0.50 },
    { z: 1.2,  rx: 0.48, ry: 0.46 },
    { z: 1.8,  rx: 0.36, ry: 0.34 },
    { z: 2.2,  rx: 0.24, ry: 0.22 },
  ],

  // Cruiser: larger, wider, imposing wedge
  cruiser: [
    { z: -3.6, rx: 0.06, ry: 0.06 },
    { z: -3.0, rx: 0.30, ry: 0.22 },
    { z: -2.2, rx: 0.60, ry: 0.44 },
    { z: -1.2, rx: 0.88, ry: 0.64 },
    { z: -0.2, rx: 1.00, ry: 0.72 },
    { z: 0.8,  rx: 0.96, ry: 0.68 },
    { z: 1.6,  rx: 0.84, ry: 0.60 },
    { z: 2.2,  rx: 0.72, ry: 0.54 },
    { z: 2.8,  rx: 0.60, ry: 0.46 },
    { z: 3.2,  rx: 0.50, ry: 0.40 },
  ],

  // Carrier: wide flat deck silhouette
  carrier: [
    { z: -3.4, rx: 0.10, ry: 0.06 },
    { z: -2.8, rx: 0.50, ry: 0.20 },
    { z: -2.0, rx: 0.90, ry: 0.34 },
    { z: -1.0, rx: 1.20, ry: 0.42 },
    { z: 0.0,  rx: 1.30, ry: 0.44 },
    { z: 1.0,  rx: 1.24, ry: 0.42 },
    { z: 2.0,  rx: 1.10, ry: 0.38 },
    { z: 2.8,  rx: 0.90, ry: 0.34 },
    { z: 3.4,  rx: 0.70, ry: 0.28 },
    { z: 3.8,  rx: 0.50, ry: 0.24 },
  ],

  // Battleship: massive, imposing, thick hull
  battleship: [
    { z: -4.0, rx: 0.08, ry: 0.08 },
    { z: -3.4, rx: 0.36, ry: 0.28 },
    { z: -2.6, rx: 0.72, ry: 0.56 },
    { z: -1.6, rx: 1.04, ry: 0.78 },
    { z: -0.4, rx: 1.16, ry: 0.86 },
    { z: 0.6,  rx: 1.12, ry: 0.82 },
    { z: 1.6,  rx: 1.00, ry: 0.74 },
    { z: 2.4,  rx: 0.86, ry: 0.64 },
    { z: 3.0,  rx: 0.72, ry: 0.54 },
    { z: 3.6,  rx: 0.58, ry: 0.44 },
    { z: 4.0,  rx: 0.44, ry: 0.36 },
  ],

  // Coloniser: bulky, round cargo section
  coloniser: [
    { z: -2.8, rx: 0.06, ry: 0.06 },
    { z: -2.2, rx: 0.24, ry: 0.24 },
    { z: -1.4, rx: 0.60, ry: 0.60 },
    { z: -0.4, rx: 0.80, ry: 0.80 },
    { z: 0.4,  rx: 0.82, ry: 0.82 },
    { z: 1.2,  rx: 0.74, ry: 0.74 },
    { z: 1.8,  rx: 0.56, ry: 0.56 },
    { z: 2.2,  rx: 0.36, ry: 0.36 },
    { z: 2.6,  rx: 0.22, ry: 0.22 },
  ],

  // Dreadnought: enormous, angular, fortress-like
  dreadnought: [
    { z: -4.6, rx: 0.08, ry: 0.08 },
    { z: -4.0, rx: 0.40, ry: 0.30 },
    { z: -3.0, rx: 0.82, ry: 0.62 },
    { z: -2.0, rx: 1.14, ry: 0.84 },
    { z: -0.8, rx: 1.30, ry: 0.94 },
    { z: 0.4,  rx: 1.26, ry: 0.90 },
    { z: 1.6,  rx: 1.14, ry: 0.82 },
    { z: 2.6,  rx: 0.98, ry: 0.72 },
    { z: 3.4,  rx: 0.82, ry: 0.62 },
    { z: 4.0,  rx: 0.66, ry: 0.50 },
    { z: 4.4,  rx: 0.50, ry: 0.40 },
  ],

  // Battle station: massive orbital platform with wide central hub
  // and docking ring — 1800m, dwarfs every ship class
  battle_station: [
    { z: -4.0, rx: 0.30, ry: 0.30 },
    { z: -3.2, rx: 1.00, ry: 0.90 },
    { z: -2.0, rx: 1.80, ry: 1.50 },
    { z: -0.8, rx: 2.20, ry: 1.80 },
    { z: 0.0,  rx: 2.40, ry: 2.00 },
    { z: 0.8,  rx: 2.20, ry: 1.80 },
    { z: 2.0,  rx: 1.80, ry: 1.50 },
    { z: 3.0,  rx: 1.20, ry: 1.00 },
    { z: 3.8,  rx: 0.60, ry: 0.50 },
    { z: 4.2,  rx: 0.30, ry: 0.30 },
  ],

  // Deep space probe: tiny cylinder with antenna
  deep_space_probe: [
    { z: -1.6, rx: 0.03, ry: 0.03 },
    { z: -1.2, rx: 0.12, ry: 0.12 },
    { z: -0.6, rx: 0.18, ry: 0.18 },
    { z: 0.0,  rx: 0.20, ry: 0.20 },
    { z: 0.6,  rx: 0.18, ry: 0.18 },
    { z: 1.0,  rx: 0.14, ry: 0.14 },
    { z: 1.4,  rx: 0.10, ry: 0.10 },
  ],
};

// ── Colour constants ─────────────────────────────────────────────────────────

const HULL_FILL_COLOUR = 0x1d9e75;
const HULL_WIREFRAME_COLOUR = 0x5dcaa5;

/** Weapon mount colours by component type */
const WEAPON_MOUNT_COLOUR: Partial<Record<ComponentType, number>> = {
  weapon_beam: 0x378add,
  weapon_projectile: 0xd85a30,
  weapon_missile: 0xe24b4a,
  weapon_point_defense: 0xd85a30,
  fighter_bay: 0x9966cc,
};

/** Internal compartment colours by component type */
const INTERNAL_COMPARTMENT_COLOUR: Partial<Record<ComponentType, number>> = {
  shield: 0x378add,
  armor: 0x888780,
  engine: 0xd85a30,
  warp_drive: 0xafa9ec,
  sensor: 0x378add,
  advanced_sensors: 0x378add,
  scanner: 0x378add,
  repair_drone: 0x1d9e75,
  life_support: 0x1d9e75,
  targeting_computer: 0x7f77dd,
  damage_control: 0x888780,
  ecm_suite: 0x7f77dd,
  special: 0xef9f27,
  power_reactor: 0xef9f27,
  rcs_thrusters: 0xd85a30,
  temperature_control: 0xe24b4a,
  comms_array: 0x5dcaa5,
  bio_reclamation: 0x1d9e75,
  computer_core: 0x7f77dd,
};

/** Base teal-grey colour for core system wireframe boxes */
const CORE_SYSTEM_BASE_COLOUR = 0x6b8a7a;

/** Component types that count as weapons (get mount spheres and arcs) */
const WEAPON_TYPES: ComponentType[] = [
  'weapon_beam',
  'weapon_projectile',
  'weapon_missile',
  'weapon_point_defense',
  'fighter_bay',
];

// ── Ship lengths in metres (inspired by historical ocean-going vessels) ──────
// Deep space probe ≈ fishing trawler, scout ≈ WW2 corvette (HMS Flower),
// destroyer ≈ WW2 destroyer (Fletcher-class), transport ≈ cargo freighter,
// cruiser ≈ WW2 light cruiser (Cleveland-class), carrier ≈ WW2 fleet carrier,
// battleship ≈ WW2 battleship (Iowa-class), coloniser ≈ ocean liner,
// dreadnought ≈ supercarrier (USS Nimitz), battle station ≈ orbital platform.

const SHIP_LENGTH_METRES: Record<HullClass, number> = {
  deep_space_probe: 15,
  scout: 65,
  destroyer: 120,
  transport: 95,
  cruiser: 185,
  carrier: 260,
  battleship: 270,
  coloniser: 155,
  dreadnought: 350,
  battle_station: 1800,
};

// ── Compass labels ───────────────────────────────────────────────────────────

const COMPASS_LABELS = ['STBD', 'FWD', 'PORT', 'AFT'] as const;

// ── Preset camera views ──────────────────────────────────────────────────────

type ViewPreset = 'side' | 'front' | 'top' | 'iso';

const VIEW_PRESETS: Record<ViewPreset, { x: number; y: number }> = {
  side: { x: 0, y: Math.PI / 2 },
  front: { x: 0, y: Math.PI },
  top: { x: Math.PI / 2 - 0.01, y: 0 },
  iso: { x: -0.3, y: 0.6 },
};

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Number of segments around each cross-section ring */
const RING_SEGMENTS = 12;

/**
 * Build hull geometry from cross-section profiles.
 * Connects adjacent rings of vertices to form a smooth hull surface.
 */
function buildHullGeometry(sections: HullSection[]): THREE.BufferGeometry {
  const seg = RING_SEGMENTS;
  const vertices: number[] = [];
  const indices: number[] = [];

  sections.forEach((s, si) => {
    for (let i = 0; i < seg; i++) {
      const angle = (i / seg) * Math.PI * 2;
      vertices.push(Math.cos(angle) * s.rx, Math.sin(angle) * s.ry, s.z);
    }
    if (si > 0) {
      const base = si * seg;
      const prev = (si - 1) * seg;
      for (let i = 0; i < seg; i++) {
        const next = (i + 1) % seg;
        indices.push(prev + i, base + i, base + next);
        indices.push(prev + i, base + next, prev + next);
      }
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create a fan/wedge geometry for firing arcs.
 * Produces a cone-like sector from the origin outward.
 */
function buildFanGeometry(
  center: THREE.Vector3,
  right: THREE.Vector3,
  halfAngle: number,
  range: number,
  segments: number,
): THREE.BufferGeometry {
  const positions: number[] = [0, 0, 0];

  for (let i = 0; i <= segments; i++) {
    const t = -halfAngle + (2 * halfAngle * i) / segments;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    positions.push(
      (center.x * ct + right.x * st) * range,
      (center.y * ct + right.y * st) * range,
      (center.z * ct + right.z * st) * range,
    );
  }

  const idx: number[] = [];
  for (let i = 1; i <= segments; i++) {
    idx.push(0, i, i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create edge line points for a firing arc outline.
 */
function buildFanEdgePoints(
  center: THREE.Vector3,
  right: THREE.Vector3,
  halfAngle: number,
  range: number,
  segments: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];

  // Line from origin to first edge
  const ct0 = Math.cos(-halfAngle);
  const st0 = Math.sin(-halfAngle);
  pts.push(new THREE.Vector3(0, 0, 0));
  pts.push(
    new THREE.Vector3(
      (center.x * ct0 + right.x * st0) * range,
      (center.y * ct0 + right.y * st0) * range,
      (center.z * ct0 + right.z * st0) * range,
    ),
  );

  // Arc edge
  for (let i = 0; i <= segments; i++) {
    const t = -halfAngle + (2 * halfAngle * i) / segments;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    pts.push(
      new THREE.Vector3(
        (center.x * ct + right.x * st) * range,
        (center.y * ct + right.y * st) * range,
        (center.z * ct + right.z * st) * range,
      ),
    );
  }

  // Line from last edge back to origin
  const ct1 = Math.cos(halfAngle);
  const st1 = Math.sin(halfAngle);
  pts.push(
    new THREE.Vector3(
      (center.x * ct1 + right.x * st1) * range,
      (center.y * ct1 + right.y * st1) * range,
      (center.z * ct1 + right.z * st1) * range,
    ),
  );
  pts.push(new THREE.Vector3(0, 0, 0));

  return pts;
}

// ── Slot position mapping ────────────────────────────────────────────────────

/**
 * Map a 2D slot grid position (x, y) and hull sections into a 3D position
 * on the hull surface.  The hull spine runs along Z; we distribute slots
 * along Z proportionally, then use facing to position them on the surface.
 */
function slotTo3DPosition(
  slot: SlotPosition,
  allSlots: SlotPosition[],
  sections: HullSection[],
): THREE.Vector3 {
  // Determine Z extents of the hull
  const zMin = sections[0]!.z;
  const zMax = sections[sections.length - 1]!.z;
  const zRange = zMax - zMin;

  // Determine slot grid extents
  const xs = allSlots.map((s) => s.x);
  const ys = allSlots.map((s) => s.y);
  const minSX = Math.min(...xs);
  const maxSX = Math.max(...xs);
  const minSY = Math.min(...ys);
  const maxSY = Math.max(...ys);

  // Map slot.x to Z along the hull (lower x = fore = more negative Z)
  const xRange = maxSX - minSX || 1;
  const tX = (slot.x - minSX) / xRange;
  // Invert so that x=0 (fore) maps to zMin (nose) and high x maps to zMax (aft)
  const z = zMin + tX * zRange;

  // Find the cross-section radii at this Z by linear interpolation
  let rx = 0.3;
  let ry = 0.3;
  for (let i = 0; i < sections.length - 1; i++) {
    const s0 = sections[i]!;
    const s1 = sections[i + 1]!;
    if (z >= s0.z && z <= s1.z) {
      const t = (z - s0.z) / (s1.z - s0.z);
      rx = s0.rx + (s1.rx - s0.rx) * t;
      ry = s0.ry + (s1.ry - s0.ry) * t;
      break;
    }
  }
  // If Z is before first section or after last, use endpoint radii
  if (z <= sections[0]!.z) {
    rx = sections[0]!.rx;
    ry = sections[0]!.ry;
  }
  if (z >= sections[sections.length - 1]!.z) {
    rx = sections[sections.length - 1]!.rx;
    ry = sections[sections.length - 1]!.ry;
  }

  // Map slot.y to a vertical offset within the hull cross-section
  const yRange = maxSY - minSY || 1;
  const tY = (slot.y - minSY) / yRange;

  // Use facing to determine where on the surface this slot sits
  let x = 0;
  let y = 0;

  switch (slot.facing) {
    case 'fore':
      // Fore weapons sit on the dorsal surface towards the front
      x = (tY - 0.5) * rx * 0.6;
      y = ry * 0.8;
      break;
    case 'aft':
      // Aft slots sit on the dorsal surface
      x = (tY - 0.5) * rx * 0.6;
      y = -ry * 0.6;
      break;
    case 'port':
      // Port-side slots
      x = -rx * 0.9;
      y = (0.5 - tY) * ry * 0.5;
      break;
    case 'starboard':
      // Starboard-side slots
      x = rx * 0.9;
      y = (0.5 - tY) * ry * 0.5;
      break;
    case 'turret':
      // Turret slots sit atop the hull
      x = (tY - 0.5) * rx * 0.4;
      y = ry * 0.95;
      break;
  }

  return new THREE.Vector3(x, y, z);
}

/**
 * Determine the forward direction vector for a facing type.
 */
function facingDirection(facing: SlotPosition['facing']): THREE.Vector3 {
  switch (facing) {
    case 'fore': return new THREE.Vector3(0, 0, -1);
    case 'aft': return new THREE.Vector3(0, 0, 1);
    case 'port': return new THREE.Vector3(-1, 0, 0);
    case 'starboard': return new THREE.Vector3(1, 0, 0);
    case 'turret': return new THREE.Vector3(0, 1, 0);
  }
}

// ── Arc data for weapon slots ────────────────────────────────────────────────

interface ArcDefinition {
  center: THREE.Vector3;
  right: THREE.Vector3;
  halfAngle: number;
  range: number;
}

/**
 * Generate firing arc fan definitions for a weapon slot based on its facing.
 * Each weapon gets two perpendicular fan planes for a 3D arc coverage.
 */
function getWeaponArcs(slot: SlotPosition): ArcDefinition[] {
  const dir = facingDirection(slot.facing);

  // Size determines range and arc width
  const rangeLookup = { small: 2.5, medium: 4.0, large: 5.5 };
  const arcLookup = { small: 0.8, medium: 0.6, large: 0.4 };
  const range = rangeLookup[slot.size];
  const halfAngle = arcLookup[slot.size];

  // Build two perpendicular fans
  const arcs: ArcDefinition[] = [];

  // Horizontal sweep
  const rightH = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  if (rightH.length() < 0.01) {
    // dir is (0,1,0) — use an alternative right vector
    rightH.set(1, 0, 0);
  }
  arcs.push({ center: dir.clone(), right: rightH, halfAngle, range });

  // Vertical sweep
  const rightV = dir.clone().cross(rightH).normalize();
  if (rightV.length() > 0.01) {
    arcs.push({ center: dir.clone(), right: rightV, halfAngle: halfAngle * 0.7, range });
  }

  return arcs;
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Hull mesh: semi-transparent fill + wireframe overlay */
function HullMesh({ sections }: { sections: HullSection[] }): React.ReactElement {
  const geometry = useMemo(() => buildHullGeometry(sections), [sections]);

  return (
    <>
      <mesh geometry={geometry}>
        <meshPhongMaterial
          color={HULL_FILL_COLOUR}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={HULL_WIREFRAME_COLOUR}
          wireframe
          transparent
          opacity={0.22}
        />
      </mesh>
    </>
  );
}

/** Engine exhaust nozzles at the aft end */
function EngineNozzles({ sections }: { sections: HullSection[] }): React.ReactElement {
  const aftSection = sections[sections.length - 1]!;
  const prevSection = sections[sections.length - 2] ?? aftSection;
  const maxRy = Math.max(...sections.map((s) => s.ry));

  // Place 2 nozzles at the aft, offset horizontally
  const nozzleRadius = maxRy * 0.22;
  const spacing = aftSection.rx * 0.6;

  return (
    <>
      {[-spacing, spacing].map((xOff, i) => (
        <mesh
          key={i}
          position={[xOff, 0, aftSection.z + 0.1]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[nozzleRadius * 0.7, nozzleRadius, 0.2, 8]} />
          <meshBasicMaterial color={0xd85a30} transparent opacity={0.3} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Hangar bay docking cradles — visible external structures on the hull
 * where carried ships attach. Carriers show destroyer bays along the
 * flight deck; battle stations show large carrier-sized docking arms.
 */
function HangarBays({
  hullClass,
  sections,
}: {
  hullClass: HullClass;
  sections: HullSection[];
}): React.ReactElement | null {
  const bays = useMemo(() => {
    const minZ = sections[0]?.z ?? -2;
    const maxZ = sections[sections.length - 1]?.z ?? 2;
    const midZ = (minZ + maxZ) / 2;
    const maxRx = Math.max(...sections.map(s => s.rx));
    const maxRy = Math.max(...sections.map(s => s.ry));

    if (hullClass === 'carrier') {
      // 3 destroyer bays — external cradles along the port side flight deck
      const bayLength = 0.8; // relative to hull
      const bayWidth = 0.12;
      const bayHeight = 0.08;
      return [0, 1, 2].map(i => {
        const t = (i + 0.5) / 3;
        const z = minZ + (maxZ - minZ) * 0.2 + t * (maxZ - minZ) * 0.6;
        return {
          position: [maxRx * 1.15, -maxRy * 0.2, z] as [number, number, number],
          size: [bayWidth, bayHeight, bayLength] as [number, number, number],
          armOffset: maxRx * 0.15,
          label: `Bay ${i + 1}`,
        };
      });
    }

    if (hullClass === 'battle_station') {
      // 3 carrier-sized docking arms — massive external cradles at 120° intervals
      const armLength = 1.6;
      const armWidth = 0.3;
      const armHeight = 0.25;
      return [0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const radius = maxRx * 1.1;
        return {
          position: [
            Math.cos(angle) * radius,
            Math.sin(angle) * radius * (maxRy / maxRx),
            midZ,
          ] as [number, number, number],
          size: [armWidth, armHeight, armLength] as [number, number, number],
          armOffset: radius - maxRx * 0.9,
          label: `Dock ${i + 1}`,
        };
      });
    }

    return null;
  }, [hullClass, sections]);

  if (!bays) return null;

  const isBattleStation = hullClass === 'battle_station';
  const bayColour = isBattleStation ? 0xef9f27 : 0x5dcaa5;
  const strutColour = 0x5dcaa5;

  return (
    <group>
      {bays.map((bay, i) => (
        <group key={i}>
          {/* Docking cradle — wireframe box */}
          <mesh position={bay.position}>
            <boxGeometry args={bay.size} />
            <meshBasicMaterial color={bayColour} transparent opacity={0.08} />
          </mesh>
          <mesh position={bay.position}>
            <boxGeometry args={bay.size} />
            <meshBasicMaterial color={bayColour} wireframe transparent opacity={0.25} />
          </mesh>

          {/* Docking arm strut connecting cradle to hull */}
          <mesh position={[
            bay.position[0] * 0.5,
            bay.position[1] * 0.5,
            bay.position[2],
          ]}>
            <boxGeometry args={[bay.armOffset, 0.03, 0.03]} />
            <meshBasicMaterial color={strutColour} wireframe transparent opacity={0.18} />
          </mesh>

          {/* Small indicator light at cradle centre */}
          <mesh position={bay.position}>
            <sphereGeometry args={[isBattleStation ? 0.06 : 0.03, 6, 4]} />
            <meshBasicMaterial color={bayColour} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Weapon mount point: coloured sphere + direction ring */
function WeaponMount({
  position,
  colour,
  direction,
}: {
  position: THREE.Vector3;
  colour: number;
  direction: THREE.Vector3;
}): React.ReactElement {
  // Compute the quaternion to orient the ring towards the firing direction
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const target = position.clone().add(direction);
    const mat = new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0));
    q.setFromRotationMatrix(mat);
    return q;
  }, [position, direction]);

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Mount sphere */}
      <mesh>
        <sphereGeometry args={[0.06, 6, 4]} />
        <meshBasicMaterial color={colour} transparent opacity={0.85} />
      </mesh>
      {/* Direction ring */}
      <mesh quaternion={quaternion}>
        <ringGeometry args={[0.09, 0.13, 12]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Firing arc wedge for a weapon slot */
function FiringArc({
  position,
  arcs,
  colour,
  highlighted,
  dimmed,
}: {
  position: THREE.Vector3;
  arcs: ArcDefinition[];
  colour: number;
  highlighted: boolean;
  dimmed: boolean;
}): React.ReactElement {
  const fillOpacity = dimmed ? 0.015 : highlighted ? 0.08 : 0.05;
  const lineOpacity = dimmed ? 0.08 : highlighted ? 0.5 : 0.35;

  // Build Three.js Line objects for edge outlines (JSX <line> is SVG, not Three.js)
  const edgeLines = useMemo(() => {
    return arcs.map((arc) => {
      const edgePts = buildFanEdgePoints(arc.center, arc.right, arc.halfAngle, arc.range, 20);
      const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
      const edgeMat = new THREE.LineBasicMaterial({
        color: colour,
        transparent: true,
        opacity: lineOpacity,
        depthWrite: false,
      });
      return new THREE.Line(edgeGeo, edgeMat);
    });
  }, [arcs, colour, lineOpacity]);

  // Update edge line opacity when it changes
  useEffect(() => {
    edgeLines.forEach((line) => {
      (line.material as THREE.LineBasicMaterial).opacity = lineOpacity;
    });
  }, [edgeLines, lineOpacity]);

  return (
    <group position={[position.x, position.y, position.z]}>
      {arcs.map((arc, i) => {
        const fanGeo = buildFanGeometry(arc.center, arc.right, arc.halfAngle, arc.range, 20);

        return (
          <group key={i}>
            {/* Filled fan surface */}
            <mesh geometry={fanGeo}>
              <meshBasicMaterial
                color={colour}
                transparent
                opacity={fillOpacity}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {/* Outline edges (using primitive to avoid SVG <line> conflict) */}
            <primitive object={edgeLines[i]!} />
          </group>
        );
      })}
    </group>
  );
}

/** Internal subsystem compartment: wireframe box */
function InternalCompartment({
  position,
  colour,
  size,
}: {
  position: THREE.Vector3;
  colour: number;
  size: SlotPosition['size'];
}): React.ReactElement {
  const dims = { small: [0.24, 0.18, 0.24], medium: [0.36, 0.26, 0.36], large: [0.48, 0.34, 0.48] } as const;
  const [w, h, d] = dims[size];

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Faint fill */}
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color={colour} transparent opacity={0.08} />
      </mesh>
      {/* Wireframe */}
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color={colour} wireframe transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

/** Core system spine: 9 small wireframe boxes along the ship centreline. */
function CoreSystemSpine({
  sections,
  overrides,
}: {
  sections: HullSection[];
  overrides?: Array<{ role: CoreSystemRole; componentId: string }>;
}): React.ReactElement {
  const overrideSet = useMemo(
    () => new Set((overrides ?? []).map(o => o.role)),
    [overrides],
  );

  // Compute evenly spaced z-positions along the hull spine
  const positions = useMemo(() => {
    const minZ = sections[0]?.z ?? -2;
    const maxZ = sections[sections.length - 1]?.z ?? 2;
    const span = maxZ - minZ;
    const margin = span * 0.1;
    const usableMin = minZ + margin;
    const usableMax = maxZ - margin;
    const count = ALL_CORE_SYSTEM_ROLES.length;

    return ALL_CORE_SYSTEM_ROLES.map((role, i) => {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const z = usableMin + t * (usableMax - usableMin);
      const upgraded = overrideSet.has(role);
      return { role, z, upgraded };
    });
  }, [sections, overrideSet]);

  return (
    <group>
      {positions.map(({ role, z, upgraded }) => {
        const size = upgraded ? 0.16 : 0.11;
        const fillOpacity = upgraded ? 0.12 : 0.06;
        const wireOpacity = upgraded ? 0.35 : 0.18;
        const colour = CORE_SYSTEM_BASE_COLOUR;

        return (
          <group key={role} position={[0, 0, z]}>
            {/* Faint fill */}
            <mesh>
              <boxGeometry args={[size, size, size]} />
              <meshBasicMaterial color={colour} transparent opacity={fillOpacity} />
            </mesh>
            {/* Wireframe */}
            <mesh>
              <boxGeometry args={[size, size, size]} />
              <meshBasicMaterial color={colour} wireframe transparent opacity={wireOpacity} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Internal structural frame: keel line, deck planes, and bulkhead ribs. */
function InternalStructure({ sections }: { sections: HullSection[] }): React.ReactElement {
  const { keelPoints, deckPoints, bulkheadRings } = useMemo(() => {
    const minZ = sections[0]?.z ?? -2;
    const maxZ = sections[sections.length - 1]?.z ?? 2;

    // Keel line — runs along the bottom of the hull (centreline, y = -ry * 0.5)
    const keel: THREE.Vector3[] = [];
    for (const s of sections) {
      keel.push(new THREE.Vector3(0, -s.ry * 0.5, s.z));
    }

    // Deck planes — two horizontal lines at ~30% and ~60% height through each section
    const deck: THREE.Vector3[] = [];
    for (const deckFraction of [0.3, 0.6]) {
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i]!;
        const yPos = -s.ry * 0.5 + s.ry * deckFraction;
        // Half-width at this height
        const hw = s.rx * Math.sqrt(1 - Math.pow((yPos / s.ry), 2));
        if (isNaN(hw) || hw < 0.05) continue;
        deck.push(new THREE.Vector3(-hw * 0.85, yPos, s.z));
        deck.push(new THREE.Vector3(hw * 0.85, yPos, s.z));
      }
    }

    // Bulkhead ribs — vertical cross-section rings at regular intervals
    const bulkheads: THREE.Vector3[][] = [];
    const span = maxZ - minZ;
    const ribCount = Math.max(3, Math.round(span / 1.2));
    for (let r = 0; r < ribCount; r++) {
      const t = (r + 0.5) / ribCount;
      const z = minZ + t * span;
      // Interpolate hull radii at this z
      let rx = 0.2, ry = 0.2;
      for (let i = 0; i < sections.length - 1; i++) {
        if (z >= sections[i]!.z && z <= sections[i + 1]!.z) {
          const lt = (z - sections[i]!.z) / (sections[i + 1]!.z - sections[i]!.z);
          rx = sections[i]!.rx + (sections[i + 1]!.rx - sections[i]!.rx) * lt;
          ry = sections[i]!.ry + (sections[i + 1]!.ry - sections[i]!.ry) * lt;
          break;
        }
      }
      // Draw an elliptical ring (8 segments, scaled down to 70%)
      const ring: THREE.Vector3[] = [];
      const segs = 8;
      const scale = 0.7;
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        ring.push(new THREE.Vector3(
          Math.cos(a) * rx * scale,
          Math.sin(a) * ry * scale,
          z,
        ));
      }
      bulkheads.push(ring);
    }

    return { keelPoints: keel, deckPoints: deck, bulkheadRings: bulkheads };
  }, [sections]);

  return (
    <group>
      {/* Keel line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={keelPoints.length}
            array={new Float32Array(keelPoints.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0x5dcaa5} transparent opacity={0.12} />
      </line>

      {/* Deck planes (drawn as line pairs per section) */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={deckPoints.length}
            array={new Float32Array(deckPoints.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0x5dcaa5} transparent opacity={0.08} />
      </lineSegments>

      {/* Bulkhead ribs */}
      {bulkheadRings.map((ring, i) => (
        <line key={`bh-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={ring.length}
              array={new Float32Array(ring.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={0x5dcaa5} transparent opacity={0.10} />
        </line>
      ))}
    </group>
  );
}

// ── Scene rotation controller ────────────────────────────────────────────────

interface RotationState {
  rotX: number;
  rotY: number;
  targetX: number;
  targetY: number;
  dragging: boolean;
  lastMouseX: number;
  lastMouseY: number;
  zoom: number;
  targetZoom: number;
}

/**
 * Manages smooth rotation interpolation and auto-rotation.
 * Attaches drag handlers to the canvas DOM element.
 */
function useRotationControls(): {
  state: React.MutableRefObject<RotationState>;
  setView: (preset: ViewPreset) => void;
  compassLabel: string;
} {
  const state = useRef<RotationState>({
    rotX: -0.25,
    rotY: 0.6,
    targetX: -0.25,
    targetY: 0.6,
    dragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    zoom: 9,
    targetZoom: 9,
  });

  const [compassLabel, setCompassLabel] = useState('FWD');
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      state.current.dragging = true;
      state.current.lastMouseX = e.clientX;
      state.current.lastMouseY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!state.current.dragging) return;
      const dx = e.clientX - state.current.lastMouseX;
      const dy = e.clientY - state.current.lastMouseY;
      state.current.targetY += dx * 0.008;
      state.current.targetX += dy * 0.006;
      state.current.targetX = Math.max(-1.2, Math.min(1.2, state.current.targetX));
      state.current.lastMouseX = e.clientX;
      state.current.lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      state.current.dragging = false;
      canvas.style.cursor = 'grab';
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        state.current.dragging = true;
        state.current.lastMouseX = e.touches[0]!.clientX;
        state.current.lastMouseY = e.touches[0]!.clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!state.current.dragging || !e.touches.length) return;
      const dx = e.touches[0]!.clientX - state.current.lastMouseX;
      const dy = e.touches[0]!.clientY - state.current.lastMouseY;
      state.current.targetY += dx * 0.008;
      state.current.targetX += dy * 0.006;
      state.current.targetX = Math.max(-1.2, Math.min(1.2, state.current.targetX));
      state.current.lastMouseX = e.touches[0]!.clientX;
      state.current.lastMouseY = e.touches[0]!.clientY;
    };

    const onTouchEnd = () => {
      state.current.dragging = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = state.current;
      s.targetZoom += e.deltaY * 0.005;
      s.targetZoom = Math.max(3, Math.min(20, s.targetZoom));
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  const { camera } = useThree();

  // Update compass label and zoom each frame
  useFrame(() => {
    const s = state.current;

    // Auto-rotate when not dragging
    if (!s.dragging) {
      s.targetY += 0.0015;
    }

    // Smooth interpolation
    s.rotX += (s.targetX - s.rotX) * 0.08;
    s.rotY += (s.targetY - s.rotY) * 0.08;
    s.zoom += (s.targetZoom - s.zoom) * 0.08;

    // Apply zoom to camera position
    camera.position.set(0, s.zoom * 0.28, s.zoom);
    camera.lookAt(0, 0, 0);

    // Update compass label
    const yNorm = ((s.rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.round(yNorm / (Math.PI / 2)) % 4;
    const label = COMPASS_LABELS[idx] ?? 'FWD';
    setCompassLabel(label);
  });

  const setView = useCallback((preset: ViewPreset) => {
    const v = VIEW_PRESETS[preset];
    state.current.targetX = v.x;
    state.current.targetY = v.y;
  }, []);

  return { state, setView, compassLabel };
}

// ── Ship group (rotated by drag controls) ────────────────────────────────────

function ShipGroup({
  hullClass,
  components,
  highlightWeaponSlotId,
  showArcs,
  rotationState,
  coreSystemOverrides,
}: {
  hullClass: HullClass;
  components: Array<{ slot: SlotPosition; component: ShipComponent | null }>;
  highlightWeaponSlotId?: string | null;
  showArcs?: boolean;
  rotationState: React.MutableRefObject<RotationState>;
  coreSystemOverrides?: Array<{ role: CoreSystemRole; componentId: string }>;
}): React.ReactElement {
  const groupRef = useRef<THREE.Group>(null);
  const sections = HULL_PROFILES[hullClass] ?? HULL_PROFILES.destroyer;
  const allSlots = components.map((c) => c.slot);

  // Apply rotation each frame
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = rotationState.current.rotX;
      groupRef.current.rotation.y = rotationState.current.rotY;
    }
  });

  // Compute 3D positions for all slots
  const slotPositions = useMemo(() => {
    return components.map(({ slot }) => ({
      slot,
      pos: slotTo3DPosition(slot, allSlots, sections),
    }));
  }, [components, sections]);

  // Separate weapon slots and internal slots.
  // Show ALL weapon-category slots (even empty) as mount points on the hull.
  const weaponSlots = useMemo(() => {
    return components
      .map(({ slot, component }, i) => ({
        slot,
        component,
        pos: slotPositions[i]!.pos,
      }))
      .filter(
        ({ slot, component }) =>
          slot.category === 'weapon' ||
          (component && WEAPON_TYPES.includes(component.type)),
      );
  }, [components, slotPositions]);

  // Show ALL non-weapon slots — empty ones render as dim outlines
  const internalSlots = useMemo(() => {
    return components
      .map(({ slot, component }, i) => ({
        slot,
        component,
        pos: slotPositions[i]!.pos,
      }))
      .filter(
        ({ slot, component }) =>
          slot.category !== 'weapon' &&
          !(component && WEAPON_TYPES.includes(component.type)),
      );
  }, [components, slotPositions]);

  return (
    <group ref={groupRef}>
      {/* Hull mesh */}
      <HullMesh sections={sections} />

      {/* Engine nozzles */}
      <EngineNozzles sections={sections} />

      {/* Hangar bay docking cradles (carrier + battle station) */}
      <HangarBays hullClass={hullClass} sections={sections} />

      {/* Weapon mount points — shown for ALL weapon slots, dim grey when empty */}
      {weaponSlots.map(({ slot, component, pos }) => {
        const hasWeapon = component && WEAPON_TYPES.includes(component.type);
        const colour = hasWeapon
          ? (WEAPON_MOUNT_COLOUR[component!.type] ?? 0x5dcaa5)
          : 0x445566; // dim grey placeholder for empty mount
        const dir = facingDirection(slot.facing);

        return (
          <React.Fragment key={slot.id}>
            <WeaponMount position={pos} colour={colour} direction={dir} />

            {/* Firing arcs — always show the slot's arc coverage area;
                equipped weapons are bright, empty mounts show dim outlines */}
            {showArcs && (
              <FiringArc
                position={pos}
                arcs={getWeaponArcs(slot)}
                colour={hasWeapon ? colour : 0x556677}
                highlighted={highlightWeaponSlotId === slot.id}
                dimmed={
                  highlightWeaponSlotId != null &&
                  highlightWeaponSlotId !== slot.id
                }
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Internal compartments — shown for all slots, dim when empty */}
      {internalSlots.map(({ slot, component, pos }) => {
        const hasComponent = component != null;
        const colour = hasComponent
          ? (INTERNAL_COMPARTMENT_COLOUR[component!.type] ?? 0x888780)
          : 0x334455; // dim outline for empty internal slot

        return (
          <InternalCompartment
            key={slot.id}
            position={pos}
            colour={colour}
            size={slot.size}
          />
        );
      })}

      {/* Core system spine (teal-grey boxes along centreline) */}
      <CoreSystemSpine sections={sections} overrides={coreSystemOverrides} />

      {/* Internal structural frame (keel, decks, bulkheads) */}
      <InternalStructure sections={sections} />
    </group>
  );
}

// ── Grid helper underneath the ship ──────────────────────────────────────────

function FloorGrid(): React.ReactElement {
  const ref = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    if (ref.current) {
      const mat = ref.current.material as THREE.Material;
      mat.transparent = true;
      mat.opacity = 0.05;
    }
  }, []);

  return (
    <gridHelper
      ref={ref}
      args={[16, 32, 0x9fe1cb, 0x9fe1cb]}
      position={[0, -2.2, 0]}
    />
  );
}

// ── Inner scene (must be inside Canvas) ──────────────────────────────────────

function ShipModelScene({
  hullClass,
  components,
  highlightWeaponSlotId,
  showArcs,
  onCompassChange,
  onSetViewRef,
  coreSystemOverrides,
}: {
  hullClass: HullClass;
  components: Array<{ slot: SlotPosition; component: ShipComponent | null }>;
  highlightWeaponSlotId?: string | null;
  showArcs?: boolean;
  onCompassChange: (label: string) => void;
  onSetViewRef: (fn: (preset: ViewPreset) => void) => void;
  coreSystemOverrides?: Array<{ role: CoreSystemRole; componentId: string }>;
}): React.ReactElement {
  const { state, setView, compassLabel } = useRotationControls();

  // Expose setView to the parent
  useEffect(() => {
    onSetViewRef(setView);
  }, [setView, onSetViewRef]);

  // Report compass changes to the parent
  const lastCompass = useRef('');
  useFrame(() => {
    if (compassLabel !== lastCompass.current) {
      lastCompass.current = compassLabel;
      onCompassChange(compassLabel);
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={0.5} />

      {/* Grid */}
      <FloorGrid />

      {/* Ship */}
      <ShipGroup
        hullClass={hullClass}
        components={components}
        highlightWeaponSlotId={highlightWeaponSlotId}
        showArcs={showArcs}
        rotationState={state}
        coreSystemOverrides={coreSystemOverrides}
      />
    </>
  );
}

// ── Main exported component ──────────────────────────────────────────────────

export function ShipModel3D({
  hullClass,
  components,
  highlightWeaponSlotId,
  showArcs = false,
  width,
  height,
  coreSystemOverrides,
}: ShipModel3DProps): React.ReactElement {
  const [compassLabel, setCompassLabel] = useState('FWD');
  const setViewRef = useRef<((preset: ViewPreset) => void) | null>(null);

  const handleSetViewRef = useCallback(
    (fn: (preset: ViewPreset) => void) => {
      setViewRef.current = fn;
    },
    [],
  );

  const handleViewClick = useCallback((preset: ViewPreset) => {
    setViewRef.current?.(preset);
  }, []);

  return (
    <div
      className="ship-model-3d"
      style={{
        width: width ?? '100%',
        height: height ?? 320,
        position: 'relative',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid rgba(0, 180, 220, 0.15)',
      }}
    >
      {/* View preset buttons */}
      <div
        className="ship-model-3d__views"
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          zIndex: 10,
          display: 'flex',
          gap: 4,
        }}
      >
        {(['side', 'front', 'top', 'iso'] as ViewPreset[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => handleViewClick(v)}
            style={{
              fontSize: 9,
              padding: '2px 6px',
              background: 'rgba(10, 10, 26, 0.8)',
              border: '1px solid rgba(0, 180, 220, 0.3)',
              borderRadius: 4,
              color: '#6688aa',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              textTransform: 'capitalize',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Compass indicator */}
      <div
        className="ship-model-3d__compass"
        style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          zIndex: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: '#6688aa',
          letterSpacing: '0.06em',
        }}
      >
        {compassLabel}
      </div>

      {/* Ship length dimension */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          left: 10,
          zIndex: 10,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'rgba(93, 202, 165, 0.7)',
          pointerEvents: 'none',
        }}
      >
        {SHIP_LENGTH_METRES[hullClass]}m
      </div>

      {/* Drag hint */}
      <div
        className="ship-model-3d__hint"
        style={{
          position: 'absolute',
          bottom: 6,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          fontSize: 9,
          color: 'rgba(102, 136, 170, 0.6)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Drag to rotate · Scroll to zoom
      </div>

      {/* R3F Canvas */}
      <Canvas
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 2.5, 9], fov: 40, near: 0.1, far: 200 }}
      >
        <ShipModelScene
          hullClass={hullClass}
          components={components}
          highlightWeaponSlotId={highlightWeaponSlotId}
          showArcs={showArcs}
          onCompassChange={setCompassLabel}
          onSetViewRef={handleSetViewRef}
          coreSystemOverrides={coreSystemOverrides}
        />
      </Canvas>
    </div>
  );
}

export default ShipModel3D;
