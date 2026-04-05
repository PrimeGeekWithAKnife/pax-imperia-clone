/**
 * CombatEffects -- React Three Fiber components for combat visual effects:
 * fighters, point defence tracers, escape pods, explosions, and debris.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TacticalState } from '@nova-imperia/shared';
import type { CombatStateAPI } from './useCombatState';
import {
  BF_SCALE,
  tacticalTo3D,
  EXPLOSION_COLOR,
  EXPLOSION_DURATION,
  EXPLOSION_RADIUS,
  DEBRIS_COLOR,
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

interface DebrisEffectsProps {
  state: TacticalState;
}

/**
 * Renders debris environment features as dodecahedron meshes.
 * Only shows features of type 'debris' (asteroids/nebulae are handled by
 * CombatEnvironment).
 */
export function DebrisEffects({ state }: DebrisEffectsProps): JSX.Element {
  const bfW = state.battlefieldWidth;
  const bfH = state.battlefieldHeight;

  const debrisFeatures = useMemo(
    () => (state.environment ?? []).filter(f => f.type === 'debris'),
    [state.environment],
  );

  return (
    <group>
      {debrisFeatures.map(feat => {
        const pos = tacticalTo3D(feat.x, feat.y, bfW, bfH);
        return (
          <mesh key={feat.id} position={[pos.x, 0, pos.z]}>
            <dodecahedronGeometry args={[feat.radius * BF_SCALE]} />
            <meshStandardMaterial
              color={DEBRIS_COLOR}
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
