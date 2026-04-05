/**
 * CombatWeapons — renders all weapon effects (beams, projectiles, missiles)
 * in the 3D combat scene using React Three Fiber.
 *
 * Each sub-component reads the TacticalState every frame and rebuilds
 * ephemeral geometry (lines, instanced meshes) accordingly.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TacticalState, TacticalShip } from '@nova-imperia/shared';
import {
  BF_SCALE,
  tacticalTo3D,
  shipYOffset,
  BEAM_STYLE_MAP,
  BEAM_COLOURS,
  PROJECTILE_STYLE_MAP,
  PROJECTILE_COLOURS,
  MISSILE_STYLE_MAP,
  MISSILE_VISUALS,
} from './constants';
import type { BeamStyle, ProjectileStyle, MissileStyle } from './constants';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Resolve a ship's 3D world position (or null if not found / destroyed). */
function shipPos3D(
  shipId: string,
  ships: TacticalShip[],
  bfW: number,
  bfH: number,
): THREE.Vector3 | null {
  const ship = ships.find(s => s.id === shipId);
  if (!ship) return null;
  const pos = tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH);
  pos.y = shipYOffset(ship.maxHull);
  return pos;
}

// ---------------------------------------------------------------------------
// Reusable scratch objects (avoid per-frame allocations)
// ---------------------------------------------------------------------------

const _tmpColor = new THREE.Color();
const _tmpMatrix = new THREE.Matrix4();
const _tmpVec = new THREE.Vector3();
const _zeroScale = new THREE.Vector3(0, 0, 0);

// ---------------------------------------------------------------------------
// BeamEffects
// ---------------------------------------------------------------------------

interface BeamEffectsProps {
  state: TacticalState;
  playerSide: 'attacker' | 'defender';
}

function BeamEffects({ state, playerSide }: BeamEffectsProps) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clean up previous frame's children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      }
    }

    const { ships, beamEffects, tick, battlefieldWidth, battlefieldHeight } = state;

    for (const beam of beamEffects) {
      const srcPos = shipPos3D(beam.sourceShipId, ships, battlefieldWidth, battlefieldHeight);
      const tgtPos = shipPos3D(beam.targetShipId, ships, battlefieldWidth, battlefieldHeight);
      if (!srcPos || !tgtPos) continue;

      const style: BeamStyle = BEAM_STYLE_MAP[beam.componentId ?? ''] ?? 'pulse';
      const fadeAlpha = Math.max(0.3, beam.ticksRemaining / 3);
      const intensity = Math.min(1, beam.damage / 55);

      // Determine friendly/enemy
      const sourceShip = ships.find(s => s.id === beam.sourceShipId);
      const friendly = sourceShip ? sourceShip.side === playerSide : false;

      switch (style) {
        // ── Pulse laser / phased array: thin pulsing line ─────────────────
        case 'pulse': {
          const pulseOn = (tick % 3) < 2;
          if (!pulseOn) break;
          const col = friendly ? BEAM_COLOURS.pulse.friendly : BEAM_COLOURS.pulse.enemy;
          const geom = new THREE.BufferGeometry().setFromPoints([srcPos, tgtPos]);
          const mat = new THREE.LineBasicMaterial({
            color: col,
            transparent: true,
            opacity: fadeAlpha * 0.9,
            linewidth: 1, // WebGL always 1px; width conveyed by glow
          });
          group.add(new THREE.Line(geom, mat));
          break;
        }

        // ── Particle beam / radiation ray: glow line + bright core ────────
        case 'particle':
        case 'radiation': {
          const isRad = style === 'radiation';
          const outerCol = isRad ? BEAM_COLOURS.radiation.friendly : (friendly ? BEAM_COLOURS.particle.friendly : BEAM_COLOURS.particle.enemy);
          const innerCol = isRad ? new THREE.Color(0xccffaa) : new THREE.Color(0xffffff);

          // Wider glow line
          const glowGeom = new THREE.BufferGeometry().setFromPoints([srcPos, tgtPos]);
          const glowMat = new THREE.LineBasicMaterial({
            color: outerCol,
            transparent: true,
            opacity: fadeAlpha * 0.25,
          });
          group.add(new THREE.Line(glowGeom, glowMat));

          // Thin bright core
          const coreGeom = new THREE.BufferGeometry().setFromPoints([srcPos, tgtPos]);
          const coreMat = new THREE.LineBasicMaterial({
            color: innerCol,
            transparent: true,
            opacity: fadeAlpha * 0.9,
          });
          group.add(new THREE.Line(coreGeom, coreMat));
          break;
        }

        // ── Disruptor beam: zigzag lightning bolt ─────────────────────────
        case 'disruptor': {
          const dx = tgtPos.x - srcPos.x;
          const dy = tgtPos.y - srcPos.y;
          const dz = tgtPos.z - srcPos.z;
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const segments = Math.max(4, Math.floor(length / (2 * BF_SCALE)));

          // Build a perpendicular vector for jitter (cross with world-up)
          const dir = new THREE.Vector3(dx, dy, dz).normalize();
          const perpA = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
          if (perpA.lengthSq() < 0.001) perpA.crossVectors(dir, new THREE.Vector3(1, 0, 0));
          perpA.normalize();
          const perpB = new THREE.Vector3().crossVectors(dir, perpA).normalize();

          const points: THREE.Vector3[] = [srcPos.clone()];
          for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const jitterA = ((Math.sin(tick * 7 + i * 13) + Math.sin(tick * 11 + i * 7)) * 0.5) * (0.8 + intensity * 0.8) * BF_SCALE;
            const jitterB = ((Math.cos(tick * 5 + i * 11) + Math.cos(tick * 13 + i * 3)) * 0.5) * (0.4 + intensity * 0.4) * BF_SCALE;
            points.push(new THREE.Vector3(
              srcPos.x + dx * t + perpA.x * jitterA + perpB.x * jitterB,
              srcPos.y + dy * t + perpA.y * jitterA + perpB.y * jitterB,
              srcPos.z + dz * t + perpA.z * jitterA + perpB.z * jitterB,
            ));
          }
          points.push(tgtPos.clone());

          // Outer glow
          const outerGeom = new THREE.BufferGeometry().setFromPoints(points);
          const outerMat = new THREE.LineBasicMaterial({
            color: BEAM_COLOURS.disruptor.friendly, // purple regardless of side
            transparent: true,
            opacity: fadeAlpha * 0.3,
          });
          group.add(new THREE.Line(outerGeom, outerMat));

          // Inner bright path
          const innerGeom = new THREE.BufferGeometry().setFromPoints(points);
          const innerMat = new THREE.LineBasicMaterial({
            color: 0xddaaff,
            transparent: true,
            opacity: fadeAlpha * 0.85,
          });
          group.add(new THREE.Line(innerGeom, innerMat));
          break;
        }

        // ── Plasma lance: multi-layer beam (orange glow + white core) ─────
        case 'plasma': {
          // Outermost orange glow
          const glow1Geom = new THREE.BufferGeometry().setFromPoints([srcPos, tgtPos]);
          const glow1Mat = new THREE.LineBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: fadeAlpha * 0.15,
          });
          group.add(new THREE.Line(glow1Geom, glow1Mat));

          // Middle orange-yellow
          const glow2Geom = new THREE.BufferGeometry().setFromPoints([srcPos, tgtPos]);
          const glow2Mat = new THREE.LineBasicMaterial({
            color: 0xff9933,
            transparent: true,
            opacity: fadeAlpha * 0.35,
          });
          group.add(new THREE.Line(glow2Geom, glow2Mat));

          // Inner white-hot core
          const coreGeom = new THREE.BufferGeometry().setFromPoints([srcPos, tgtPos]);
          const coreMat = new THREE.LineBasicMaterial({
            color: 0xffffdd,
            transparent: true,
            opacity: fadeAlpha * 0.9,
          });
          group.add(new THREE.Line(coreGeom, coreMat));
          break;
        }
      }
    }
  });

  return <group ref={groupRef} />;
}

// ---------------------------------------------------------------------------
// ProjectileEffects
// ---------------------------------------------------------------------------

const MAX_PROJECTILES = 200;

interface ProjectileEffectsProps {
  state: TacticalState;
}

function ProjectileEffects({ state }: ProjectileEffectsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { projectiles, battlefieldWidth, battlefieldHeight } = state;

    for (let i = 0; i < MAX_PROJECTILES; i++) {
      if (i < projectiles.length) {
        const proj = projectiles[i];
        const style: ProjectileStyle = PROJECTILE_STYLE_MAP[proj.componentId ?? ''] ?? 'kinetic';
        const dmgFrac = Math.min(1, proj.damage / 65);
        const scale = 0.1 + dmgFrac * 0.2;

        const pos = tacticalTo3D(proj.position.x, proj.position.y, battlefieldWidth, battlefieldHeight);
        pos.y = 0.1; // slight lift so they don't clip the ground plane

        _tmpMatrix.makeScale(scale, scale, scale);
        _tmpMatrix.setPosition(pos);
        mesh.setMatrixAt(i, _tmpMatrix);

        _tmpColor.set(PROJECTILE_COLOURS[style].core);
        mesh.setColorAt(i, _tmpColor);
      } else {
        // Hide unused instances by scaling to zero
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -1000, 0);
        mesh.setMatrixAt(i, _tmpMatrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PROJECTILES]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// MissileEffects
// ---------------------------------------------------------------------------

const MAX_MISSILES = 100;

interface MissileEffectsProps {
  state: TacticalState;
}

function MissileEffects({ state }: MissileEffectsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const trailGroupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const mesh = meshRef.current;
    const trailGroup = trailGroupRef.current;
    if (!mesh) return;

    const { missiles, battlefieldWidth, battlefieldHeight } = state;
    const missileList = missiles ?? [];

    // ── Update instanced missile bodies ──────────────────────────────────
    for (let i = 0; i < MAX_MISSILES; i++) {
      if (i < missileList.length) {
        const m = missileList[i];
        const mStyle: MissileStyle = MISSILE_STYLE_MAP[m.componentId ?? ''] ?? 'torpedo';
        const vis = MISSILE_VISUALS[mStyle];
        const scale = vis.size * BF_SCALE * 10;

        const pos = tacticalTo3D(m.x, m.y, battlefieldWidth, battlefieldHeight);
        pos.y = 0.15; // slight lift

        // Orient cone along heading: cone points up (+Y) by default,
        // we rotate so it points along the XZ heading direction.
        const heading = m.heading;
        _tmpMatrix.identity();
        _tmpMatrix.makeScale(scale, scale, scale);
        // Rotate cone from +Y to horizontal, then rotate around Y to heading
        const rotMat = new THREE.Matrix4();
        rotMat.makeRotationZ(-Math.PI / 2); // tip from +Y to +X
        _tmpMatrix.premultiply(rotMat);
        const headingMat = new THREE.Matrix4();
        headingMat.makeRotationY(-heading); // engine Y rotation maps to XZ heading
        _tmpMatrix.premultiply(headingMat);
        _tmpMatrix.setPosition(pos);
        mesh.setMatrixAt(i, _tmpMatrix);

        _tmpColor.set(vis.bodyColor);
        mesh.setColorAt(i, _tmpColor);
      } else {
        // Hide unused
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -1000, 0);
        mesh.setMatrixAt(i, _tmpMatrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // ── Rebuild exhaust trail lines ──────────────────────────────────────
    if (!trailGroup) return;

    // Clean up old trail children
    while (trailGroup.children.length > 0) {
      const child = trailGroup.children[0];
      trailGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    for (const m of missileList) {
      const mStyle: MissileStyle = MISSILE_STYLE_MAP[m.componentId ?? ''] ?? 'torpedo';
      const vis = MISSILE_VISUALS[mStyle];

      const headPos = tacticalTo3D(m.x, m.y, battlefieldWidth, battlefieldHeight);
      headPos.y = 0.15;

      const cos = Math.cos(m.heading);
      const sin = Math.sin(m.heading);
      const trailLen3D = vis.trailLen * BF_SCALE * 10;

      // Trail goes from tail to head
      const tailPos = new THREE.Vector3(
        headPos.x - cos * trailLen3D * BF_SCALE,
        headPos.y,
        headPos.z + sin * trailLen3D * BF_SCALE,
      );

      const trailGeom = new THREE.BufferGeometry().setFromPoints([tailPos, headPos]);
      const trailMat = new THREE.LineBasicMaterial({
        color: vis.exhaustColor,
        transparent: true,
        opacity: 0.35,
      });
      trailGroup.add(new THREE.Line(trailGeom, trailMat));
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_MISSILES]} frustumCulled={false}>
        <coneGeometry args={[0.5, 1.5, 4]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <group ref={trailGroupRef} />
    </>
  );
}

// ---------------------------------------------------------------------------
// CombatWeapons (exported composite)
// ---------------------------------------------------------------------------

interface CombatWeaponsProps {
  state: TacticalState;
  playerSide: 'attacker' | 'defender';
}

export function CombatWeapons({ state, playerSide }: CombatWeaponsProps) {
  return (
    <>
      <BeamEffects state={state} playerSide={playerSide} />
      <ProjectileEffects state={state} />
      <MissileEffects state={state} />
    </>
  );
}
