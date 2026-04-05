/**
 * CombatWeapons — renders all weapon effects (beams, projectiles, missiles)
 * in the 3D combat scene using React Three Fiber.
 *
 * Each sub-component reads the TacticalState every frame and rebuilds
 * ephemeral geometry (lines, instanced meshes) accordingly.
 *
 * Race-specific weapon colours are sourced from speciesWeaponVisuals.ts,
 * looked up via the source ship's side and the attacker/defender species IDs.
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
  MISSILE_STYLE_MAP,
  MISSILE_VISUALS,
} from './constants';
import type { BeamStyle, MissileStyle } from './constants';
import { getSpeciesWeaponPalette } from '../../../assets/graphics/speciesWeaponVisuals';
import type { SpeciesWeaponPalette } from '../../../assets/graphics/speciesWeaponVisuals';

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
  const ship = ships.find((s) => s.id === shipId);
  if (!ship) return null;
  const pos = tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH);
  pos.y = shipYOffset(ship.maxHull);
  return pos;
}

/** Resolve the species palette for a ship based on its side. */
function shipPalette(
  shipId: string,
  ships: TacticalShip[],
  attackerSpeciesId?: string,
  defenderSpeciesId?: string,
): SpeciesWeaponPalette {
  const ship = ships.find((s) => s.id === shipId);
  const speciesId =
    ship?.side === 'attacker' ? attackerSpeciesId : defenderSpeciesId;
  return getSpeciesWeaponPalette(speciesId);
}

// ---------------------------------------------------------------------------
// Reusable scratch objects (avoid per-frame allocations)
// ---------------------------------------------------------------------------

const _tmpColor = new THREE.Color();
const _tmpMatrix = new THREE.Matrix4();
const _tmpDir = new THREE.Vector3();

// ---------------------------------------------------------------------------
// BeamEffects
// ---------------------------------------------------------------------------

interface BeamEffectsProps {
  state: TacticalState;
  playerSide: 'attacker' | 'defender';
  attackerSpeciesId?: string;
  defenderSpeciesId?: string;
}

function BeamEffects({
  state,
  playerSide,
  attackerSpeciesId,
  defenderSpeciesId,
}: BeamEffectsProps) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clean up previous frame's children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments ||
        child instanceof THREE.Mesh
      ) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
        if (Array.isArray(child.material))
          child.material.forEach((m) => m.dispose());
      }
    }

    const { ships, beamEffects, tick, battlefieldWidth, battlefieldHeight } =
      state;

    for (const beam of beamEffects) {
      const srcPos = shipPos3D(
        beam.sourceShipId,
        ships,
        battlefieldWidth,
        battlefieldHeight,
      );
      const tgtPos = shipPos3D(
        beam.targetShipId,
        ships,
        battlefieldWidth,
        battlefieldHeight,
      );
      if (!srcPos || !tgtPos) continue;

      const style: BeamStyle =
        BEAM_STYLE_MAP[beam.componentId ?? ''] ?? 'pulse';
      const fadeAlpha = Math.max(0.3, beam.ticksRemaining / 3);
      const intensity = Math.min(1, beam.damage / 55);

      // Species-specific palette for source ship
      const palette = shipPalette(
        beam.sourceShipId,
        ships,
        attackerSpeciesId,
        defenderSpeciesId,
      );
      const beamCore = new THREE.Color(palette.beamCore);
      const beamGlow = new THREE.Color(palette.beamGlow);
      const beamBrightness = palette.beamIntensity;

      switch (style) {
        // -- Pulse laser / phased array: thin pulsing line with impact flash --
        case 'pulse': {
          const pulseOn = tick % 3 < 2;
          if (!pulseOn) break;

          // Outer glow layer (wider visual presence)
          const glowGeom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const glowMat = new THREE.LineBasicMaterial({
            color: beamGlow,
            transparent: true,
            opacity: fadeAlpha * 0.2 * beamBrightness,
          });
          group.add(new THREE.Line(glowGeom, glowMat));

          // Bright core
          const coreGeom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const coreMat = new THREE.LineBasicMaterial({
            color: beamCore,
            transparent: true,
            opacity: fadeAlpha * 0.9 * beamBrightness,
          });
          group.add(new THREE.Line(coreGeom, coreMat));

          // Impact starburst at target point
          addImpactFlash(
            group,
            tgtPos,
            beamCore,
            fadeAlpha * 0.7,
            0.15 + intensity * 0.1,
          );
          break;
        }

        // -- Particle beam / radiation ray: glow line + bright core + impact --
        case 'particle':
        case 'radiation': {
          // Widest outer glow
          const glow1Geom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const glow1Mat = new THREE.LineBasicMaterial({
            color: beamGlow,
            transparent: true,
            opacity: fadeAlpha * 0.12 * beamBrightness,
          });
          group.add(new THREE.Line(glow1Geom, glow1Mat));

          // Middle glow layer
          const glow2Geom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const glow2Mat = new THREE.LineBasicMaterial({
            color: beamGlow,
            transparent: true,
            opacity: fadeAlpha * 0.3 * beamBrightness,
          });
          group.add(new THREE.Line(glow2Geom, glow2Mat));

          // Thin bright core
          const coreGeom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const coreMat = new THREE.LineBasicMaterial({
            color: beamCore,
            transparent: true,
            opacity: fadeAlpha * 0.9 * beamBrightness,
          });
          group.add(new THREE.Line(coreGeom, coreMat));

          // Impact starburst
          addImpactFlash(
            group,
            tgtPos,
            beamCore,
            fadeAlpha * 0.8,
            0.2 + intensity * 0.15,
          );
          break;
        }

        // -- Disruptor beam: zigzag lightning bolt with impact ---
        case 'disruptor': {
          const dx = tgtPos.x - srcPos.x;
          const dy = tgtPos.y - srcPos.y;
          const dz = tgtPos.z - srcPos.z;
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const segments = Math.max(4, Math.floor(length / (2 * BF_SCALE)));

          // Build a perpendicular vector for jitter (cross with world-up)
          const dir = new THREE.Vector3(dx, dy, dz).normalize();
          const perpA = new THREE.Vector3().crossVectors(
            dir,
            new THREE.Vector3(0, 1, 0),
          );
          if (perpA.lengthSq() < 0.001)
            perpA.crossVectors(dir, new THREE.Vector3(1, 0, 0));
          perpA.normalize();
          const perpB = new THREE.Vector3()
            .crossVectors(dir, perpA)
            .normalize();

          const points: THREE.Vector3[] = [srcPos.clone()];
          for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const jitterA =
              (Math.sin(tick * 7 + i * 13) + Math.sin(tick * 11 + i * 7)) *
              0.5 *
              (0.8 + intensity * 0.8) *
              BF_SCALE;
            const jitterB =
              (Math.cos(tick * 5 + i * 11) + Math.cos(tick * 13 + i * 3)) *
              0.5 *
              (0.4 + intensity * 0.4) *
              BF_SCALE;
            points.push(
              new THREE.Vector3(
                srcPos.x + dx * t + perpA.x * jitterA + perpB.x * jitterB,
                srcPos.y + dy * t + perpA.y * jitterA + perpB.y * jitterB,
                srcPos.z + dz * t + perpA.z * jitterA + perpB.z * jitterB,
              ),
            );
          }
          points.push(tgtPos.clone());

          // Outer glow — species-coloured
          const outerGeom = new THREE.BufferGeometry().setFromPoints(points);
          const outerMat = new THREE.LineBasicMaterial({
            color: beamGlow,
            transparent: true,
            opacity: fadeAlpha * 0.3 * beamBrightness,
          });
          group.add(new THREE.Line(outerGeom, outerMat));

          // Inner bright path — species core
          const innerGeom = new THREE.BufferGeometry().setFromPoints(points);
          const innerMat = new THREE.LineBasicMaterial({
            color: beamCore,
            transparent: true,
            opacity: fadeAlpha * 0.85 * beamBrightness,
          });
          group.add(new THREE.Line(innerGeom, innerMat));

          // Impact starburst
          addImpactFlash(
            group,
            tgtPos,
            beamCore,
            fadeAlpha * 0.9,
            0.25 + intensity * 0.2,
          );
          break;
        }

        // -- Plasma lance: multi-layer beam (species glow + core) + impact --
        case 'plasma': {
          // Outermost glow
          const glow1Geom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const glow1Mat = new THREE.LineBasicMaterial({
            color: beamGlow,
            transparent: true,
            opacity: fadeAlpha * 0.12 * beamBrightness,
          });
          group.add(new THREE.Line(glow1Geom, glow1Mat));

          // Middle glow
          const glow2Geom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const glow2Col = beamGlow.clone().lerp(beamCore, 0.4);
          const glow2Mat = new THREE.LineBasicMaterial({
            color: glow2Col,
            transparent: true,
            opacity: fadeAlpha * 0.35 * beamBrightness,
          });
          group.add(new THREE.Line(glow2Geom, glow2Mat));

          // Inner white-hot core
          const coreGeom = new THREE.BufferGeometry().setFromPoints([
            srcPos,
            tgtPos,
          ]);
          const coreMat = new THREE.LineBasicMaterial({
            color: beamCore,
            transparent: true,
            opacity: fadeAlpha * 0.9 * beamBrightness,
          });
          group.add(new THREE.Line(coreGeom, coreMat));

          // Impact starburst — larger for plasma
          addImpactFlash(
            group,
            tgtPos,
            beamCore,
            fadeAlpha * 0.85,
            0.3 + intensity * 0.25,
          );
          break;
        }
      }
    }
  });

  return <group ref={groupRef} />;
}

/**
 * Add a starburst/flash sprite at a beam impact point.
 * Uses a small additive-blended icosahedron for a quick sparkle effect.
 */
function addImpactFlash(
  group: THREE.Group,
  position: THREE.Vector3,
  color: THREE.Color,
  opacity: number,
  radius: number,
): void {
  const geom = new THREE.IcosahedronGeometry(radius, 0);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: Math.min(1, opacity),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(position);
  group.add(mesh);
}

// ---------------------------------------------------------------------------
// ProjectileEffects
// ---------------------------------------------------------------------------

const MAX_PROJECTILES = 200;
// Each projectile needs 2 instances: core + glow halo
const MAX_PROJ_INSTANCES = MAX_PROJECTILES * 2;

interface ProjectileEffectsProps {
  state: TacticalState;
  attackerSpeciesId?: string;
  defenderSpeciesId?: string;
}

function ProjectileEffects({
  state,
  attackerSpeciesId,
  defenderSpeciesId,
}: ProjectileEffectsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const trailGroupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const mesh = meshRef.current;
    const trailGroup = trailGroupRef.current;
    if (!mesh) return;

    const { projectiles, ships, battlefieldWidth, battlefieldHeight } = state;

    let instanceIdx = 0;

    for (
      let i = 0;
      i < projectiles.length && instanceIdx < MAX_PROJ_INSTANCES - 1;
      i++
    ) {
      const proj = projectiles[i];
      const dmgFrac = Math.min(1, proj.damage / 65);

      // Species-specific colours
      const palette = shipPalette(
        proj.sourceShipId,
        ships,
        attackerSpeciesId,
        defenderSpeciesId,
      );

      const pos = tacticalTo3D(
        proj.position.x,
        proj.position.y,
        battlefieldWidth,
        battlefieldHeight,
      );
      pos.y = 0.1;

      // Compute travel direction for elongated streak
      const tgtPos = shipPos3D(
        proj.targetShipId,
        ships,
        battlefieldWidth,
        battlefieldHeight,
      );
      _tmpDir.set(1, 0, 0); // default if no target
      if (tgtPos) {
        _tmpDir.subVectors(tgtPos, pos).normalize();
      }

      // -- Core: elongated streak along travel direction --
      const coreLen = 0.08 + dmgFrac * 0.18; // elongation
      const coreWidth = 0.06 + dmgFrac * 0.08;

      _tmpMatrix.identity();
      // Scale: elongated along local X (travel direction), thin on Y and Z
      _tmpMatrix.makeScale(coreLen, coreWidth, coreWidth);

      // Rotate to align X axis with travel direction
      const rotMat = new THREE.Matrix4();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        _tmpDir,
      );
      rotMat.makeRotationFromQuaternion(quat);
      _tmpMatrix.premultiply(rotMat);

      _tmpMatrix.setPosition(pos);
      mesh.setMatrixAt(instanceIdx, _tmpMatrix);

      _tmpColor.set(palette.projectileCore);
      mesh.setColorAt(instanceIdx, _tmpColor);
      instanceIdx++;

      // -- Glow halo: larger, semi-transparent sphere around the core --
      const haloScale = coreWidth * 2.5;
      _tmpMatrix.identity();
      _tmpMatrix.makeScale(haloScale, haloScale, haloScale);
      _tmpMatrix.setPosition(pos);
      mesh.setMatrixAt(instanceIdx, _tmpMatrix);

      _tmpColor.set(palette.projectileTrail);
      mesh.setColorAt(instanceIdx, _tmpColor);
      instanceIdx++;
    }

    // Hide remaining unused instances
    for (let i = instanceIdx; i < MAX_PROJ_INSTANCES; i++) {
      _tmpMatrix.makeScale(0, 0, 0);
      _tmpMatrix.setPosition(0, -1000, 0);
      mesh.setMatrixAt(i, _tmpMatrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // -- Rebuild trail streaks for each projectile --
    if (!trailGroup) return;

    while (trailGroup.children.length > 0) {
      const child = trailGroup.children[0];
      trailGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    for (const proj of projectiles) {
      const palette = shipPalette(
        proj.sourceShipId,
        ships,
        attackerSpeciesId,
        defenderSpeciesId,
      );
      const dmgFrac = Math.min(1, proj.damage / 65);

      const pos = tacticalTo3D(
        proj.position.x,
        proj.position.y,
        battlefieldWidth,
        battlefieldHeight,
      );
      pos.y = 0.1;

      const tgtPos = shipPos3D(
        proj.targetShipId,
        ships,
        battlefieldWidth,
        battlefieldHeight,
      );
      _tmpDir.set(-1, 0, 0);
      if (tgtPos) {
        _tmpDir.subVectors(pos, tgtPos).normalize(); // tail direction (away from target)
      }

      const trailLen = (0.15 + dmgFrac * 0.25) * BF_SCALE * 10;
      const tailPos = pos.clone().addScaledVector(_tmpDir, trailLen);

      const trailGeom = new THREE.BufferGeometry().setFromPoints([
        tailPos,
        pos,
      ]);
      const trailMat = new THREE.LineBasicMaterial({
        color: palette.projectileTrail,
        transparent: true,
        opacity: 0.3,
      });
      trailGroup.add(new THREE.Line(trailGeom, trailMat));
    }
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_PROJ_INSTANCES]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <group ref={trailGroupRef} />
    </>
  );
}

// ---------------------------------------------------------------------------
// MissileEffects
// ---------------------------------------------------------------------------

const MAX_MISSILES = 100;

interface MissileEffectsProps {
  state: TacticalState;
  attackerSpeciesId?: string;
  defenderSpeciesId?: string;
}

function MissileEffects({
  state,
  attackerSpeciesId,
  defenderSpeciesId,
}: MissileEffectsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const trailGroupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const mesh = meshRef.current;
    const trailGroup = trailGroupRef.current;
    if (!mesh) return;

    const { missiles, ships, battlefieldWidth, battlefieldHeight, tick } =
      state;
    const missileList = missiles ?? [];

    // -- Update instanced missile bodies (elongated shape via non-uniform scale) --
    for (let i = 0; i < MAX_MISSILES; i++) {
      if (i < missileList.length) {
        const m = missileList[i];
        const mStyle: MissileStyle =
          MISSILE_STYLE_MAP[m.componentId ?? ''] ?? 'torpedo';
        const vis = MISSILE_VISUALS[mStyle];
        const baseScale = vis.size * BF_SCALE * 10;

        // Species-specific colours
        const palette = shipPalette(
          m.sourceShipId,
          ships,
          attackerSpeciesId,
          defenderSpeciesId,
        );

        const pos = tacticalTo3D(m.x, m.y, battlefieldWidth, battlefieldHeight);
        pos.y = 0.15;

        // Elongated missile: stretch along the axis (2.2x longer than wide)
        const heading = m.heading;
        _tmpMatrix.identity();
        _tmpMatrix.makeScale(baseScale, baseScale, baseScale * 2.2);

        // Rotate cone from +Y to horizontal, then rotate around Y to heading
        const rotMat = new THREE.Matrix4();
        rotMat.makeRotationZ(-Math.PI / 2); // tip from +Y to +X
        _tmpMatrix.premultiply(rotMat);
        const headingMat = new THREE.Matrix4();
        headingMat.makeRotationY(-heading);
        _tmpMatrix.premultiply(headingMat);
        _tmpMatrix.setPosition(pos);
        mesh.setMatrixAt(i, _tmpMatrix);

        _tmpColor.set(palette.missileBody);
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

    // -- Rebuild exhaust trails with fading particle segments --
    if (!trailGroup) return;

    while (trailGroup.children.length > 0) {
      const child = trailGroup.children[0];
      trailGroup.remove(child);
      if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    }

    for (const m of missileList) {
      const mStyle: MissileStyle =
        MISSILE_STYLE_MAP[m.componentId ?? ''] ?? 'torpedo';
      const vis = MISSILE_VISUALS[mStyle];
      const palette = shipPalette(
        m.sourceShipId,
        ships,
        attackerSpeciesId,
        defenderSpeciesId,
      );

      const headPos = tacticalTo3D(
        m.x,
        m.y,
        battlefieldWidth,
        battlefieldHeight,
      );
      headPos.y = 0.15;

      const cos = Math.cos(m.heading);
      const sin = Math.sin(m.heading);
      const trailLen3D = vis.trailLen * BF_SCALE * 10;

      // Multi-segment fading exhaust trail
      const segments = vis.exhaustSegments;
      for (let seg = 0; seg < segments; seg++) {
        const t0 = seg / segments;
        const t1 = (seg + 1) / segments;
        const fadeT = 1 - (t0 + t1) * 0.5; // brighter near head, fades toward tail

        const p0 = new THREE.Vector3(
          headPos.x - cos * trailLen3D * BF_SCALE * t0,
          headPos.y,
          headPos.z + sin * trailLen3D * BF_SCALE * t0,
        );
        const p1 = new THREE.Vector3(
          headPos.x - cos * trailLen3D * BF_SCALE * t1,
          headPos.y,
          headPos.z + sin * trailLen3D * BF_SCALE * t1,
        );

        const segGeom = new THREE.BufferGeometry().setFromPoints([p0, p1]);
        const segMat = new THREE.LineBasicMaterial({
          color: palette.missileExhaust,
          transparent: true,
          opacity: fadeT * 0.5,
        });
        trailGroup.add(new THREE.Line(segGeom, segMat));
      }

      // Exhaust glow dot at the nozzle
      if (vis.glowAlpha > 0) {
        const glowSize = vis.size * BF_SCALE * 6;
        const glowGeom = new THREE.IcosahedronGeometry(glowSize, 0);
        const glowMat = new THREE.MeshBasicMaterial({
          color: palette.missileGlow,
          transparent: true,
          opacity: vis.glowAlpha * (0.8 + 0.2 * Math.sin(tick * 0.5)),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowMesh = new THREE.Mesh(glowGeom, glowMat);
        // Position glow slightly behind the missile head
        glowMesh.position.set(
          headPos.x - cos * vis.size * BF_SCALE * 4,
          headPos.y,
          headPos.z + sin * vis.size * BF_SCALE * 4,
        );
        trailGroup.add(glowMesh);
      }
    }
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_MISSILES]}
        frustumCulled={false}
      >
        <capsuleGeometry args={[0.08, 0.35, 3, 6]} />
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
  attackerSpeciesId?: string;
  defenderSpeciesId?: string;
}

export function CombatWeapons({
  state,
  playerSide,
  attackerSpeciesId,
  defenderSpeciesId,
}: CombatWeaponsProps) {
  return (
    <>
      <BeamEffects
        state={state}
        playerSide={playerSide}
        attackerSpeciesId={attackerSpeciesId}
        defenderSpeciesId={defenderSpeciesId}
      />
      <ProjectileEffects
        state={state}
        attackerSpeciesId={attackerSpeciesId}
        defenderSpeciesId={defenderSpeciesId}
      />
      <MissileEffects
        state={state}
        attackerSpeciesId={attackerSpeciesId}
        defenderSpeciesId={defenderSpeciesId}
      />
    </>
  );
}
