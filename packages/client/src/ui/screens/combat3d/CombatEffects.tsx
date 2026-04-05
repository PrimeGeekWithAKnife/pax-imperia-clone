/**
 * CombatEffects -- React Three Fiber components for combat visual effects:
 * fighters, point defence tracers, escape pods, explosions, debris,
 * engine thrust plumes, and RCS puffs.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TacticalState } from '@nova-imperia/shared';
import { getSpeciesWeaponPalette } from '../../../assets/graphics/speciesWeaponVisuals';
import type { CombatStateAPI } from './useCombatState';
import {
  BF_SCALE,
  tacticalTo3D,
  shipScale,
  EXPLOSION_COLOR,
  EXPLOSION_DURATION,
  EXPLOSION_RADIUS,
  DEBRIS_METALLIC_COLORS,
  DEBRIS_HOT_EDGE_COLOR,
} from './constants';

// ---------------------------------------------------------------------------
// Shared scratch objects (avoid per-frame allocations)
// ---------------------------------------------------------------------------

const _tmpMatrix = new THREE.Matrix4();
const _tmpColor = new THREE.Color();
const _tmpQuat = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// 1. FighterEffects
// ---------------------------------------------------------------------------

const MAX_FIGHTERS = 200;

interface FighterEffectsProps {
  state: TacticalState;
  attackerColor: string;
  defenderColor: string;
}

/**
 * Renders fighters as instanced cone meshes coloured by side.
 * Position includes random jitter for a swarming effect;
 * cones orient toward their target (or carrier if returning).
 */
export function FighterEffects({ state, attackerColor, defenderColor }: FighterEffectsProps): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const attackerCol = useMemo(() => new THREE.Color(attackerColor), [attackerColor]);
  const defenderCol = useMemo(() => new THREE.Color(defenderColor), [defenderColor]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const fighters = state.fighters ?? [];
    const bfW = state.battlefieldWidth;
    const bfH = state.battlefieldHeight;
    let visibleCount = 0;

    for (let i = 0; i < fighters.length && i < MAX_FIGHTERS; i++) {
      const f = fighters[i]!;
      if (f.health <= 0) continue;

      // Position with jitter
      const jitterX = (Math.random() - 0.5) * 0.4 * BF_SCALE;
      const jitterZ = (Math.random() - 0.5) * 0.4 * BF_SCALE;
      const pos = tacticalTo3D(f.x, f.y, bfW, bfH);
      pos.x += jitterX;
      pos.z += jitterZ;

      // Compute heading toward target or carrier
      let heading = 0;
      if (f.targetId) {
        const tgt = state.ships.find(s => s.id === f.targetId);
        if (tgt) heading = Math.atan2(tgt.position.y - f.y, tgt.position.x - f.x);
      } else if (f.carrierId) {
        const carrier = state.ships.find(s => s.id === f.carrierId);
        if (carrier) heading = Math.atan2(carrier.position.y - f.y, carrier.position.x - f.x);
      }

      // Build transform: scale 0.3, rotate cone to point toward heading
      // Cone default orientation is along +Y; we rotate it to lie flat (along -Z)
      // then yaw toward heading.
      _tmpQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); // tip cone forward
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(_upAxis, -heading);
      _tmpQuat.premultiply(yawQuat);

      _tmpMatrix.compose(pos, _tmpQuat, new THREE.Vector3(0.3, 0.3, 0.3));
      mesh.setMatrixAt(visibleCount, _tmpMatrix);

      // Colour by side
      _tmpColor.copy(f.side === 'attacker' ? attackerCol : defenderCol);
      mesh.setColorAt(visibleCount, _tmpColor);

      visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_FIGHTERS]} frustumCulled={false}>
      <coneGeometry args={[0.3, 0.8, 3]} />
      <meshStandardMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// 2. PointDefenceEffects
// ---------------------------------------------------------------------------

interface PointDefenceEffectsProps {
  state: TacticalState;
}

/**
 * Renders point defence intercept lines from the firing ship to the target
 * missile position. Lines are rebuilt each frame and fade based on remaining
 * ticks.
 */
export function PointDefenceEffects({ state }: PointDefenceEffectsProps): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear previous frame's children
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    const pdEffects = state.pointDefenceEffects ?? [];
    const bfW = state.battlefieldWidth;
    const bfH = state.battlefieldHeight;

    for (const pd of pdEffects) {
      const ship = state.ships.find(s => s.id === pd.shipId);
      if (!ship) continue;

      const shipPos = tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH);
      const interceptPos = tacticalTo3D(pd.missileX, pd.missileY, bfW, bfH);

      const opacity = (pd.ticksRemaining / 2) * 0.85 * 0.5;
      if (opacity <= 0) continue;

      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(shipPos.x, 0.1, shipPos.z),
        new THREE.Vector3(interceptPos.x, 0.1, interceptPos.z),
      ]);

      const material = new THREE.LineBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity,
        depthWrite: false,
      });

      const line = new THREE.Line(geometry, material);
      group.add(line);
    }
  });

  return <group ref={groupRef} />;
}

// ---------------------------------------------------------------------------
// 3. EscapePodEffects
// ---------------------------------------------------------------------------

const MAX_ESCAPE_PODS = 50;

interface EscapePodEffectsProps {
  state: TacticalState;
}

/**
 * Renders escape pods as instanced octahedron meshes with a blinking
 * distress effect (scale alternates between 0.15 and 0.1 based on tick).
 */
export function EscapePodEffects({ state }: EscapePodEffectsProps): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const pods = state.escapePods ?? [];
    const bfW = state.battlefieldWidth;
    const bfH = state.battlefieldHeight;
    const blinkLarge = Math.floor(state.tick / 8) % 2 === 0;
    const scale = blinkLarge ? 0.15 : 0.1;
    let visibleCount = 0;

    for (let i = 0; i < pods.length && i < MAX_ESCAPE_PODS; i++) {
      const pod = pods[i]!;
      const pos = tacticalTo3D(pod.x, pod.y, bfW, bfH);

      _tmpMatrix.compose(
        pos,
        new THREE.Quaternion(), // identity rotation
        new THREE.Vector3(scale, scale, scale),
      );
      mesh.setMatrixAt(visibleCount, _tmpMatrix);

      // All pods are the same pale yellow
      _tmpColor.set(0xffffcc);
      mesh.setColorAt(visibleCount, _tmpColor);

      visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_ESCAPE_PODS]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// 4. ExplosionEffects
// ---------------------------------------------------------------------------

interface ExplosionEntry {
  id: string;
  x: number;
  z: number;
  startTime: number;
}

interface ExplosionEffectsProps {
  api: CombatStateAPI;
}

/**
 * Tracks newly destroyed ships and renders expanding + fading explosion
 * spheres at their last known position.
 */
export function ExplosionEffects({ api }: ExplosionEffectsProps): JSX.Element {
  const [explosions, setExplosions] = useState<ExplosionEntry[]>([]);
  const nextIdRef = useRef(0);

  // Watch for newly destroyed ships each tick
  useEffect(() => {
    if (api.newlyDestroyed.size === 0) return;

    const now = performance.now();
    const bfW = api.state.battlefieldWidth;
    const bfH = api.state.battlefieldHeight;
    const newExplosions: ExplosionEntry[] = [];

    for (const shipId of api.newlyDestroyed) {
      const ship = api.state.ships.find(s => s.id === shipId);
      if (!ship) continue;

      const pos = tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH);
      newExplosions.push({
        id: `explosion-${nextIdRef.current++}`,
        x: pos.x,
        z: pos.z,
        startTime: now,
      });
    }

    if (newExplosions.length > 0) {
      setExplosions(prev => [...prev, ...newExplosions]);
    }
  }, [api.state.tick, api.newlyDestroyed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remove expired explosions and animate active ones via useFrame
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const now = performance.now();
    let hasExpired = false;

    const group = groupRef.current;
    if (!group) return;

    // Iterate explosion meshes (children correspond to active explosions)
    for (let i = 0; i < group.children.length; i++) {
      const mesh = group.children[i] as THREE.Mesh;
      const explosion = explosions[i];
      if (!explosion || !mesh) continue;

      const elapsed = now - explosion.startTime;
      const t = Math.min(elapsed / EXPLOSION_DURATION, 1.0);

      if (t >= 1.0) {
        hasExpired = true;
        mesh.visible = false;
        continue;
      }

      // Expand from small to EXPLOSION_RADIUS
      const radius = 0.2 + t * (EXPLOSION_RADIUS - 0.2);
      mesh.scale.setScalar(radius);

      // Fade out
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1.0 - t;
      mesh.visible = true;
    }

    // Clean up expired explosions (batched outside the render loop)
    if (hasExpired) {
      setExplosions(prev =>
        prev.filter(e => (now - e.startTime) < EXPLOSION_DURATION),
      );
    }
  });

  return (
    <group ref={groupRef}>
      {explosions.map(exp => (
        <mesh key={exp.id} position={[exp.x, 0, exp.z]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial
            color={EXPLOSION_COLOR}
            emissive={EXPLOSION_COLOR}
            emissiveIntensity={2}
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 5. DebrisEffects
// ---------------------------------------------------------------------------

/**
 * Create a jagged, irregular fragment geometry by heavily displacing an
 * icosahedron's vertices. Debris should look like torn metal shards, not
 * smooth rocks — so we use higher displacement variance than asteroids.
 */
function createDebrisGeometry(radius: number, seed: number): THREE.BufferGeometry {
  // Detail 1 keeps the poly count low (42 verts) — debris is small.
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const posAttr = geo.getAttribute('position');
  const normalAttr = geo.getAttribute('normal');

  let s = seed;
  const rand = (): number => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };

  // Heavy displacement (40% of radius) for jagged, shard-like shapes.
  // Some vertices get pushed inward aggressively to create concavities.
  const amplitude = radius * 0.4;
  for (let i = 0; i < posAttr.count; i++) {
    const nx = normalAttr.getX(i);
    const ny = normalAttr.getY(i);
    const nz = normalAttr.getZ(i);
    // Bias toward inward displacement for sharper edges
    const displacement = (rand() * 2 - 1.2) * amplitude;

    posAttr.setX(i, posAttr.getX(i) + nx * displacement);
    posAttr.setY(i, posAttr.getY(i) + ny * displacement);
    posAttr.setZ(i, posAttr.getZ(i) + nz * displacement);
  }

  // Flatten one axis randomly to make the fragment look like a plate/shard
  // rather than a rough sphere.
  const flatAxis = Math.floor(rand() * 3);
  const flatScale = 0.3 + rand() * 0.4; // squash to 30-70% along one axis
  for (let i = 0; i < posAttr.count; i++) {
    if (flatAxis === 0) posAttr.setX(i, posAttr.getX(i) * flatScale);
    else if (flatAxis === 1) posAttr.setY(i, posAttr.getY(i) * flatScale);
    else posAttr.setZ(i, posAttr.getZ(i) * flatScale);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Derive a stable integer seed from a feature id string.
 */
function debrisIdToSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 1;
}

interface DebrisEffectsProps {
  state: TacticalState;
}

/**
 * Renders debris environment features as jagged metallic fragments.
 * Each debris piece is an irregular shard with a metallic colour and optional
 * hot-edge glow for recently destroyed ships. Larger debris (from capital
 * ships) is composed of multiple overlapping fragments.
 */
export function DebrisEffects({ state }: DebrisEffectsProps): JSX.Element {
  const bfW = state.battlefieldWidth;
  const bfH = state.battlefieldHeight;

  // Build debris fragment data. Each feature may produce 1-3 fragment meshes
  // depending on size. Geometry is memoised by the environment array identity.
  const debrisData = useMemo(() => {
    const features = (state.environment ?? []).filter(f => f.type === 'debris');

    return features.map(feat => {
      const seed = debrisIdToSeed(feat.id);
      const r = feat.radius * BF_SCALE;

      // Determine metallic colour from the palette (deterministic per piece)
      const colorIdx = seed % DEBRIS_METALLIC_COLORS.length;
      const color = DEBRIS_METALLIC_COLORS[colorIdx]!;

      // Primary fragment
      const primary = createDebrisGeometry(r, seed);

      // Larger debris gets a secondary fragment for visual complexity
      const hasSecondary = r > 0.8;
      const secondary = hasSecondary ? createDebrisGeometry(r * 0.6, seed + 53) : null;
      const secColor = DEBRIS_METALLIC_COLORS[(colorIdx + 1) % DEBRIS_METALLIC_COLORS.length]!;

      // Deterministic rotation
      let s = seed;
      const rand = (): number => {
        s = (s * 16807 + 0) % 2147483647;
        return (s & 0x7fffffff) / 0x7fffffff;
      };
      const rotation: [number, number, number] = [
        rand() * Math.PI * 2,
        rand() * Math.PI * 2,
        rand() * Math.PI * 2,
      ];
      const secOffset: [number, number, number] = hasSecondary
        ? [(rand() - 0.5) * r * 0.5, (rand() - 0.5) * r * 0.3, (rand() - 0.5) * r * 0.5]
        : [0, 0, 0];

      // Hot-edge glow: debris with high damage rating (from large ships)
      // recently destroyed still has glowing torn edges.
      const hotEdge = (feat.damage ?? 0) >= 2;

      return { feat, primary, secondary, color, secColor, rotation, secOffset, hasSecondary, hotEdge, r };
    });
  }, [state.environment]);

  return (
    <group>
      {debrisData.map(({ feat, primary, secondary, color, secColor, rotation, secOffset, hasSecondary, hotEdge, r }) => {
        const pos = tacticalTo3D(feat.x, feat.y, bfW, bfH);

        return (
          <group key={feat.id} position={[pos.x, 0, pos.z]} rotation={rotation}>
            {/* Primary jagged shard */}
            <mesh geometry={primary}>
              <meshStandardMaterial
                color={color}
                roughness={0.4}
                metalness={0.7}
                flatShading
                transparent
                opacity={0.85}
              />
            </mesh>

            {/* Secondary fragment for larger debris */}
            {hasSecondary && secondary && (
              <mesh geometry={secondary} position={secOffset}>
                <meshStandardMaterial
                  color={secColor}
                  roughness={0.35}
                  metalness={0.75}
                  flatShading
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}

            {/* Hot-edge glow — faint emissive overlay on large fresh debris */}
            {hotEdge && (
              <mesh geometry={primary} scale={[1.05, 1.05, 1.05]}>
                <meshStandardMaterial
                  color={DEBRIS_HOT_EDGE_COLOR}
                  emissive={DEBRIS_HOT_EDGE_COLOR}
                  emissiveIntensity={0.6}
                  transparent
                  opacity={0.2}
                  depthWrite={false}
                  side={THREE.BackSide}
                  flatShading
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 6. EngineThrustPlumes
// ---------------------------------------------------------------------------

/** Maximum number of instanced thrust plume cones. */
const MAX_THRUST_PLUMES = 200;

/** Minimum velocity magnitude (squared) to show a plume. */
const PLUME_MIN_SPEED_SQ = 0.1;

/** How far behind the ship the plume cone extends at max speed. */
const PLUME_MAX_LENGTH = 2.0;

/** Base radius of the plume cone at the hull. */
const PLUME_BASE_RADIUS = 0.12;

interface EngineThrustPlumesProps {
  state: TacticalState;
  attackerSpeciesId?: string;
  defenderSpeciesId?: string;
}

/**
 * Renders engine thrust plumes as instanced cones behind moving ships.
 * The cone points opposite to the ship's facing direction; its length
 * and opacity scale with the ship's speed. Colour uses the species
 * engine glow from the weapon palette.
 */
export function EngineThrustPlumes({
  state,
  attackerSpeciesId,
  defenderSpeciesId,
}: EngineThrustPlumesProps): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const attackerCol = useMemo(
    () => new THREE.Color(getSpeciesWeaponPalette(attackerSpeciesId).engineGlow),
    [attackerSpeciesId],
  );
  const defenderCol = useMemo(
    () => new THREE.Color(getSpeciesWeaponPalette(defenderSpeciesId).engineGlow),
    [defenderSpeciesId],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const ships = state.ships;
    const bfW = state.battlefieldWidth;
    const bfH = state.battlefieldHeight;
    let count = 0;

    for (let i = 0; i < ships.length && count < MAX_THRUST_PLUMES; i++) {
      const ship = ships[i]!;
      if (ship.destroyed || ship.routed) continue;

      // Compute velocity magnitude
      const vx = ship.velocity.x;
      const vy = ship.velocity.y;
      const speedSq = vx * vx + vy * vy;
      if (speedSq < PLUME_MIN_SPEED_SQ) continue;

      const speed = Math.sqrt(speedSq);
      const maxSpeed = ship.speed > 0 ? ship.speed : 1;
      const t = Math.min(speed / maxSpeed, 1.0);

      // Plume length proportional to speed
      const scale = shipScale(ship.maxHull);
      const plumeLen = PLUME_MAX_LENGTH * t * scale;
      const plumeRadius = PLUME_BASE_RADIUS * scale;

      // Position: behind the ship (opposite facing)
      const pos = tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH);
      const aftX = pos.x + Math.cos(ship.facing + Math.PI) * scale * 1.5 * BF_SCALE * 10;
      const aftZ = pos.z - Math.sin(ship.facing + Math.PI) * scale * 1.5 * BF_SCALE * 10;

      // The cone geometry has its tip at top (+Y) and base at bottom (-Y).
      // We rotate it to point opposite to facing direction (engine exhaust).
      // First lay the cone flat (tip along -Z), then yaw to face the exhaust direction.
      const tipQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      );
      const yawAngle = -(ship.facing - Math.PI / 2) + Math.PI;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(_upAxis, yawAngle);
      tipQuat.premultiply(yawQuat);

      _tmpMatrix.compose(
        new THREE.Vector3(aftX, 0.05, aftZ),
        tipQuat,
        new THREE.Vector3(plumeRadius, plumeLen, plumeRadius),
      );
      mesh.setMatrixAt(count, _tmpMatrix);

      // Species engine colour with brightness scaled by speed
      const baseCol = ship.side === 'attacker' ? attackerCol : defenderCol;
      _tmpColor.copy(baseCol).multiplyScalar(0.6 + t * 0.4);
      mesh.setColorAt(count, _tmpColor);

      count++;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_THRUST_PLUMES]} frustumCulled={false}>
      <coneGeometry args={[1, 1, 6]} />
      <meshStandardMaterial
        vertexColors
        toneMapped={false}
        transparent
        opacity={0.6}
        depthWrite={false}
        emissive={new THREE.Color(0xffffff)}
        emissiveIntensity={0.5}
      />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// 7. RcsPuffEffects
// ---------------------------------------------------------------------------

/** Maximum number of RCS puff instances. */
const MAX_RCS_PUFFS = 300;

/** How long a puff lives in ms before it fades completely. */
const RCS_PUFF_LIFETIME_MS = 200;

/** Minimum absolute turn rate (radians) to trigger puffs. */
const RCS_TURN_THRESHOLD = 0.01;

interface RcsPuffEntry {
  x: number;
  y: number;
  z: number;
  startTime: number;
  color: THREE.Color;
}

interface RcsPuffEffectsProps {
  state: TacticalState;
  attackerSpeciesId?: string;
  defenderSpeciesId?: string;
}

/**
 * When ships turn (facing angle changes between ticks), spawn small flash
 * puffs at the hull edges perpendicular to the turn direction. Puffs expand
 * and fade over a short lifetime.
 */
export function RcsPuffEffects({
  state,
  attackerSpeciesId,
  defenderSpeciesId,
}: RcsPuffEffectsProps): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const puffsRef = useRef<RcsPuffEntry[]>([]);
  const prevFacingRef = useRef<Map<string, number>>(new Map());

  const attackerPalette = useMemo(
    () => getSpeciesWeaponPalette(attackerSpeciesId),
    [attackerSpeciesId],
  );
  const defenderPalette = useMemo(
    () => getSpeciesWeaponPalette(defenderSpeciesId),
    [defenderSpeciesId],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const now = performance.now();
    const bfW = state.battlefieldWidth;
    const bfH = state.battlefieldHeight;
    const prevFacings = prevFacingRef.current;

    // Spawn new puffs for turning ships
    for (const ship of state.ships) {
      if (ship.destroyed || ship.routed) continue;

      const prevFacing = prevFacings.get(ship.id);
      prevFacings.set(ship.id, ship.facing);

      if (prevFacing === undefined) continue;

      // Calculate angular difference (handling wrap-around)
      let dFacing = ship.facing - prevFacing;
      if (dFacing > Math.PI) dFacing -= Math.PI * 2;
      if (dFacing < -Math.PI) dFacing += Math.PI * 2;

      if (Math.abs(dFacing) < RCS_TURN_THRESHOLD) continue;

      const pos = tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH);
      const scale = shipScale(ship.maxHull);
      const palette = ship.side === 'attacker' ? attackerPalette : defenderPalette;

      // Perpendicular to facing: port and starboard hull edges
      // Turning left (positive dFacing) fires starboard RCS, turning right fires port
      const perpAngle = ship.facing + (dFacing > 0 ? -Math.PI / 2 : Math.PI / 2);
      const offset = scale * 0.8;

      const puffX = pos.x + Math.cos(perpAngle) * offset * BF_SCALE * 10;
      const puffZ = pos.z - Math.sin(perpAngle) * offset * BF_SCALE * 10;

      puffsRef.current.push({
        x: puffX,
        y: 0.1,
        z: puffZ,
        startTime: now,
        color: new THREE.Color(palette.engineGlow),
      });

      // Also fire from the opposite side at the aft for realism
      const aftPerpAngle = ship.facing + Math.PI + (dFacing > 0 ? Math.PI / 2 : -Math.PI / 2);
      const aftPuffX = pos.x + Math.cos(aftPerpAngle) * offset * 0.6 * BF_SCALE * 10;
      const aftPuffZ = pos.z - Math.sin(aftPerpAngle) * offset * 0.6 * BF_SCALE * 10;

      puffsRef.current.push({
        x: aftPuffX,
        y: 0.1,
        z: aftPuffZ,
        startTime: now,
        color: new THREE.Color(palette.engineGlow),
      });
    }

    // Remove expired puffs
    puffsRef.current = puffsRef.current.filter(
      p => (now - p.startTime) < RCS_PUFF_LIFETIME_MS,
    );

    // Update instanced mesh
    const puffs = puffsRef.current;
    const visibleCount = Math.min(puffs.length, MAX_RCS_PUFFS);

    for (let i = 0; i < visibleCount; i++) {
      const puff = puffs[i]!;
      const elapsed = now - puff.startTime;
      const t = elapsed / RCS_PUFF_LIFETIME_MS; // 0..1

      // Expand from small to medium, fade out
      const puffScale = 0.05 + t * 0.15;

      _tmpMatrix.compose(
        new THREE.Vector3(puff.x, puff.y, puff.z),
        new THREE.Quaternion(),
        new THREE.Vector3(puffScale, puffScale, puffScale),
      );
      mesh.setMatrixAt(i, _tmpMatrix);

      // Fade colour brightness as puff ages
      _tmpColor.copy(puff.color).multiplyScalar(1.0 - t * 0.7);
      mesh.setColorAt(i, _tmpColor);
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_RCS_PUFFS]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        vertexColors
        toneMapped={false}
        transparent
        opacity={0.5}
        depthWrite={false}
        emissive={new THREE.Color(0xffffff)}
        emissiveIntensity={0.8}
      />
    </instancedMesh>
  );
}
