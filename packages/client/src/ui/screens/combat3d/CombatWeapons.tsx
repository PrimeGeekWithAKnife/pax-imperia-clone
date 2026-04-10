/**
 * CombatWeapons -- renders all weapon effects (beams, projectiles, missiles)
 * in the 3D combat scene using React Three Fiber.
 *
 * PERFORMANCE: All geometry and materials are pre-allocated once via useRef /
 * useMemo. Per-frame updates write into existing Float32Array buffers and
 * adjust drawRange / instance count -- no new THREE.BufferGeometry or
 * THREE.Material is ever created inside useFrame.
 *
 * Race-specific weapon colours are sourced from speciesWeaponVisuals.ts,
 * looked up via the source ship's side and the attacker/defender species IDs.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TacticalState, TacticalShip } from '@nova-imperia/shared';
import {
  BF_SCALE,
  tacticalTo3D,
  shipScale,
  BEAM_STYLE_MAP,
  MISSILE_STYLE_MAP,
  MISSILE_VISUALS,
} from './constants';
import type { BeamStyle, MissileStyle } from './constants';
import { getSpeciesWeaponPalette } from '../../../assets/graphics/speciesWeaponVisuals';
import type { SpeciesWeaponPalette } from '../../../assets/graphics/speciesWeaponVisuals';
import { generateShipBuildResult } from '../../../game/rendering/ShipModels3D';
import type { WeaponHardpoint } from '../../../game/rendering/shipHardpoints';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Scratch vector for shipPos3D output — callers must consume before the next call. */
const _shipPosOut = new THREE.Vector3();

/** Resolve a ship's 3D world position (or null if not found / destroyed). */
function shipPos3D(
  shipId: string,
  shipMap: Map<string, TacticalShip>,
  bfW: number,
  bfH: number,
): THREE.Vector3 | null {
  const ship = shipMap.get(shipId);
  if (!ship) return null;
  tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH, _shipPosOut, ship.position.z);
  return _shipPosOut;
}

/** Resolve the species palette for a ship based on its side. */
function shipPalette(
  shipId: string,
  shipMap: Map<string, TacticalShip>,
  attackerSpeciesId?: string,
  defenderSpeciesId?: string,
): SpeciesWeaponPalette {
  const ship = shipMap.get(shipId);
  const speciesId =
    ship?.side === 'attacker' ? attackerSpeciesId : defenderSpeciesId;
  return getSpeciesWeaponPalette(speciesId);
}

// ---------------------------------------------------------------------------
// Weapon hardpoint origin resolution
// ---------------------------------------------------------------------------

const _hpWorld = new THREE.Vector3();
const _hpBest = new THREE.Vector3();

/**
 * Offset a ship's centre position to the nearest weapon hardpoint facing the
 * target. Returns the ship's 3D world position adjusted to the hardpoint.
 * Falls back to ship centre if no hardpoints are available.
 */
function resolveWeaponOrigin(
  ship: TacticalShip,
  targetPos3D: THREE.Vector3,
  shipPos: THREE.Vector3,
  speciesId: string | undefined,
  hullClass: string,
): THREE.Vector3 {
  const result = generateShipBuildResult(speciesId ?? 'teranos', hullClass as any, 6);
  const hardpoints = result.hardpoints.weapons;
  if (hardpoints.length === 0) return shipPos;

  const scale = shipScale(ship.maxHull);
  const rotAngle = -(ship.facing - Math.PI / 2);
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // Pitch from engine state -- matches CombatShips.tsx visual rotation
  const pitch = (ship as any).currentPitch ?? 0;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  let bestDistSq = Infinity;
  _hpBest.copy(shipPos);

  for (const hp of hardpoints) {
    // Step 1: Rotate hardpoint position by yaw (Y-axis rotation)
    const yawX = hp.position.x * cosR - hp.position.z * sinR;
    const yawY = hp.position.y;  // vertical -- unchanged by yaw
    const yawZ = hp.position.x * sinR + hp.position.z * cosR;

    // Step 2: Apply pitch rotation around the ship's local right-axis.
    // The ship's forward direction in 3D (after yaw) is (cosR, 0, sinR).
    // Decompose the yaw-rotated position into forward and right components,
    // rotate forward/up by pitch, then recompose.
    const facingX = cosR;   // ship's forward direction X
    const facingZ = sinR;   // ship's forward direction Z
    const fwd = yawX * facingX + yawZ * facingZ;     // component along facing
    const right = -yawX * facingZ + yawZ * facingX;   // component perpendicular to facing
    const pitchedFwd = fwd * cosP - yawY * sinP;
    const pitchedY = fwd * sinP + yawY * cosP;
    const finalX = pitchedFwd * facingX - right * facingZ;
    const finalZ = pitchedFwd * facingZ + right * facingX;

    _hpWorld.set(
      shipPos.x + finalX * scale,
      shipPos.y + pitchedY * scale,
      shipPos.z + finalZ * scale,
    );
    const dSq = _hpWorld.distanceToSquared(targetPos3D);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      _hpBest.copy(_hpWorld);
    }
  }

  return _hpBest;
}

// ---------------------------------------------------------------------------
// Reusable scratch objects (avoid per-frame allocations)
// ---------------------------------------------------------------------------

const _tmpColor = new THREE.Color();
const _tmpMatrix = new THREE.Matrix4();
const _tmpMatrix2 = new THREE.Matrix4();
const _tmpDir = new THREE.Vector3();
const _tmpSrc = new THREE.Vector3();
const _tmpTgt = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpQuat2 = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();
const _perpA = new THREE.Vector3();
const _perpB = new THREE.Vector3();
const _tmpUp = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _yAxis = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// BeamEffects — pre-allocated LineSegments + InstancedMesh for flashes
// ---------------------------------------------------------------------------

/**
 * Maximum line segments across all beam layers (glow + core + mid layers).
 * Each beam style uses 2-3 line segments, plus disruptors use many more for
 * zigzag points. 200 segments covers ~40 simultaneous beams comfortably.
 */
const MAX_BEAM_SEGMENTS = 600;

/** Maximum impact flash instances (one per beam). */
const MAX_IMPACT_FLASHES = 100;

/** Maximum points per disruptor zigzag path. */
const MAX_ZIGZAG_POINTS = 40;

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
  // Pre-allocate line segments geometry (pairs of points = LineSegments)
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Each segment = 2 vertices, each vertex = 3 floats (position) + 3 floats (colour)
    const positions = new Float32Array(MAX_BEAM_SEGMENTS * 2 * 3);
    const colors = new Float32Array(MAX_BEAM_SEGMENTS * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
      }),
    [],
  );

  // Pre-allocate impact flash instanced mesh
  const flashGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const flashMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const flashMeshRef = useRef<THREE.InstancedMesh>(null!);

  useFrame(() => {
    const posAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = lineGeo.getAttribute('color') as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    let segIdx = 0; // current line segment index
    let flashIdx = 0; // current impact flash index
    const flashMesh = flashMeshRef.current;

    const { ships, beamEffects, tick, battlefieldWidth, battlefieldHeight } =
      state;

    // Build O(1) lookup map for ships (avoids O(n) .find per beam)
    const shipMap = new Map<string, TacticalShip>();
    for (const s of ships) shipMap.set(s.id, s);

    /** Write one line segment (2 vertices) into the pre-allocated buffer. */
    const addSegment = (
      sx: number, sy: number, sz: number,
      tx: number, ty: number, tz: number,
      r: number, g: number, b: number,
      opacity: number,
    ) => {
      if (segIdx >= MAX_BEAM_SEGMENTS) return;
      const base = segIdx * 6; // 2 verts * 3 floats
      // Apply opacity by scaling colour (LineBasicMaterial with vertexColors)
      const ro = r * opacity;
      const go = g * opacity;
      const bo = b * opacity;

      posArr[base] = sx; posArr[base + 1] = sy; posArr[base + 2] = sz;
      posArr[base + 3] = tx; posArr[base + 4] = ty; posArr[base + 5] = tz;
      colArr[base] = ro; colArr[base + 1] = go; colArr[base + 2] = bo;
      colArr[base + 3] = ro; colArr[base + 4] = go; colArr[base + 5] = bo;
      segIdx++;
    };

    /** Write one impact flash into the instanced mesh buffer. */
    const addFlash = (
      x: number, y: number, z: number,
      color: THREE.Color,
      opacity: number,
      radius: number,
    ) => {
      if (!flashMesh || flashIdx >= MAX_IMPACT_FLASHES) return;
      _tmpMatrix.makeScale(radius, radius, radius);
      _tmpMatrix.setPosition(x, y, z);
      flashMesh.setMatrixAt(flashIdx, _tmpMatrix);
      _tmpColor.copy(color).multiplyScalar(Math.min(1, opacity));
      flashMesh.setColorAt(flashIdx, _tmpColor);
      flashIdx++;
    };

    for (const beam of beamEffects) {
      // Resolve target position first (needed for hardpoint selection)
      const tgtPosRaw = shipPos3D(beam.targetShipId, shipMap, battlefieldWidth, battlefieldHeight);
      if (!tgtPosRaw) continue;
      _tmpTgt.copy(tgtPosRaw);
      const tgtPos = _tmpTgt;

      // Resolve source position, then offset to nearest weapon hardpoint
      const srcPosRaw = shipPos3D(beam.sourceShipId, shipMap, battlefieldWidth, battlefieldHeight);
      if (!srcPosRaw) continue;
      _tmpSrc.copy(srcPosRaw);
      const srcShip = shipMap.get(beam.sourceShipId);
      if (srcShip?.hullClass) {
        const speciesId = srcShip.side === 'attacker' ? attackerSpeciesId : defenderSpeciesId;
        const hpOrigin = resolveWeaponOrigin(srcShip, tgtPos, _tmpSrc, speciesId, srcShip.hullClass);
        _tmpSrc.copy(hpOrigin);
      }
      const srcPos = _tmpSrc;

      const style: BeamStyle =
        BEAM_STYLE_MAP[beam.componentId ?? ''] ?? 'pulse';
      const fadeAlpha = Math.max(0.3, beam.ticksRemaining / 3);
      const intensity = Math.min(1, beam.damage / 55);

      // Species-specific palette
      const palette = shipPalette(
        beam.sourceShipId, shipMap, attackerSpeciesId, defenderSpeciesId,
      );
      _tmpColor.set(palette.beamCore);
      const coreR = _tmpColor.r, coreG = _tmpColor.g, coreB = _tmpColor.b;
      _tmpColor.set(palette.beamGlow);
      const glowR = _tmpColor.r, glowG = _tmpColor.g, glowB = _tmpColor.b;
      const beamBrightness = palette.beamIntensity;

      const sx = srcPos.x, sy = srcPos.y, sz = srcPos.z;
      const tx = tgtPos.x, ty = tgtPos.y, tz = tgtPos.z;

      switch (style) {
        case 'pulse': {
          const pulseOn = tick % 3 < 2;
          if (!pulseOn) break;
          // Outer glow
          addSegment(sx, sy, sz, tx, ty, tz, glowR, glowG, glowB, fadeAlpha * 0.2 * beamBrightness);
          // Core
          addSegment(sx, sy, sz, tx, ty, tz, coreR, coreG, coreB, fadeAlpha * 0.9 * beamBrightness);
          // Impact flash
          _tmpColor.set(palette.beamCore);
          addFlash(tx, ty, tz, _tmpColor, fadeAlpha * 0.7, 0.15 + intensity * 0.1);
          break;
        }

        case 'particle':
        case 'radiation': {
          // Three layers: outer glow, middle glow, core
          addSegment(sx, sy, sz, tx, ty, tz, glowR, glowG, glowB, fadeAlpha * 0.12 * beamBrightness);
          addSegment(sx, sy, sz, tx, ty, tz, glowR, glowG, glowB, fadeAlpha * 0.3 * beamBrightness);
          addSegment(sx, sy, sz, tx, ty, tz, coreR, coreG, coreB, fadeAlpha * 0.9 * beamBrightness);
          _tmpColor.set(palette.beamCore);
          addFlash(tx, ty, tz, _tmpColor, fadeAlpha * 0.8, 0.2 + intensity * 0.15);
          break;
        }

        case 'disruptor': {
          const dx = tx - sx;
          const dy = ty - sy;
          const dz = tz - sz;
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const segments = Math.min(
            MAX_ZIGZAG_POINTS - 1,
            Math.max(4, Math.floor(length / (2 * BF_SCALE))),
          );

          _tmpDir.set(dx, dy, dz).normalize();
          _tmpUp.set(0, 1, 0);
          _perpA.crossVectors(_tmpDir, _tmpUp);
          if (_perpA.lengthSq() < 0.001) {
            _tmpUp.set(1, 0, 0);
            _perpA.crossVectors(_tmpDir, _tmpUp);
          }
          _perpA.normalize();
          _perpB.crossVectors(_tmpDir, _perpA).normalize();

          // Build zigzag points, writing consecutive segments
          let prevX = sx, prevY = sy, prevZ = sz;
          for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            let px: number, py: number, pz: number;
            if (i === segments) {
              px = tx; py = ty; pz = tz;
            } else {
              const jitterA =
                (Math.sin(tick * 7 + i * 13) + Math.sin(tick * 11 + i * 7)) *
                0.5 * (0.8 + intensity * 0.8) * BF_SCALE;
              const jitterB =
                (Math.cos(tick * 5 + i * 11) + Math.cos(tick * 13 + i * 3)) *
                0.5 * (0.4 + intensity * 0.4) * BF_SCALE;
              px = sx + dx * t + _perpA.x * jitterA + _perpB.x * jitterB;
              py = sy + dy * t + _perpA.y * jitterA + _perpB.y * jitterB;
              pz = sz + dz * t + _perpA.z * jitterA + _perpB.z * jitterB;
            }
            // Outer glow segment
            addSegment(prevX, prevY, prevZ, px, py, pz, glowR, glowG, glowB, fadeAlpha * 0.3 * beamBrightness);
            // Inner core segment
            addSegment(prevX, prevY, prevZ, px, py, pz, coreR, coreG, coreB, fadeAlpha * 0.85 * beamBrightness);
            prevX = px; prevY = py; prevZ = pz;
          }

          _tmpColor.set(palette.beamCore);
          addFlash(tx, ty, tz, _tmpColor, fadeAlpha * 0.9, 0.25 + intensity * 0.2);
          break;
        }

        case 'plasma': {
          // Three layers + impact
          addSegment(sx, sy, sz, tx, ty, tz, glowR, glowG, glowB, fadeAlpha * 0.12 * beamBrightness);
          // Middle glow (lerp glow toward core)
          const midR = glowR + (coreR - glowR) * 0.4;
          const midG = glowG + (coreG - glowG) * 0.4;
          const midB = glowB + (coreB - glowB) * 0.4;
          addSegment(sx, sy, sz, tx, ty, tz, midR, midG, midB, fadeAlpha * 0.35 * beamBrightness);
          addSegment(sx, sy, sz, tx, ty, tz, coreR, coreG, coreB, fadeAlpha * 0.9 * beamBrightness);
          _tmpColor.set(palette.beamCore);
          addFlash(tx, ty, tz, _tmpColor, fadeAlpha * 0.85, 0.3 + intensity * 0.25);
          break;
        }

        case 'spinal': {
          // Wide multi-segment beam -- fills beamWidth with parallel line segments.
          // The engine produces one BeamEffect per hit ship; all share the same
          // source, so render a thick beam from source to THIS target.
          const bw = ((beam as any).beamWidth ?? 80) * BF_SCALE; // battlefield units -> 3D
          const halfBW = bw / 2;
          const numStrands = 10; // parallel line segments filling the beam width

          // Beam direction and perpendicular axes
          const sdx = tx - sx, sdy = ty - sy, sdz = tz - sz;
          _tmpDir.set(sdx, sdy, sdz).normalize();
          _tmpUp.set(0, 1, 0);
          _perpA.crossVectors(_tmpDir, _tmpUp);
          if (_perpA.lengthSq() < 0.001) {
            _tmpUp.set(1, 0, 0);
            _perpA.crossVectors(_tmpDir, _tmpUp);
          }
          _perpA.normalize();
          _perpB.crossVectors(_tmpDir, _perpA).normalize();

          // Dramatic pulsing opacity
          const pulsePhase = Math.sin(tick * 0.8) * 0.3 + 0.7;
          const flickerPhase = Math.sin(tick * 3.7) * 0.1 + 0.9;
          const spinalAlpha = fadeAlpha * pulsePhase * flickerPhase * beamBrightness;

          for (let s = 0; s < numStrands; s++) {
            // Distribute strands across the beam width in a grid pattern
            const tA = ((s % 4) / 3 - 0.5) * 2 * halfBW;
            const tB = ((Math.floor(s / 4) % 3) / 2 - 0.5) * 2 * halfBW * 0.5;
            const offX = _perpA.x * tA + _perpB.x * tB;
            const offY = _perpA.y * tA + _perpB.y * tB;
            const offZ = _perpA.z * tA + _perpB.z * tB;

            // Core white-hot strand
            addSegment(
              sx + offX, sy + offY, sz + offZ,
              tx + offX, ty + offY, tz + offZ,
              coreR, coreG, coreB, spinalAlpha * 0.9,
            );
            // Outer glow strand
            addSegment(
              sx + offX * 1.3, sy + offY * 1.3, sz + offZ * 1.3,
              tx + offX * 1.3, ty + offY * 1.3, tz + offZ * 1.3,
              glowR, glowG, glowB, spinalAlpha * 0.25,
            );
          }

          // Large impact flash at the target
          _tmpColor.set(palette.beamCore);
          addFlash(tx, ty, tz, _tmpColor, fadeAlpha * 1.0, 0.5 + intensity * 0.4);
          break;
        }
      }
    }

    // Update draw range for lines
    lineGeo.setDrawRange(0, segIdx * 2); // 2 vertices per segment
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // Update impact flash instances
    if (flashMesh) {
      // Hide unused flash instances
      for (let i = flashIdx; i < MAX_IMPACT_FLASHES; i++) {
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -1000, 0);
        flashMesh.setMatrixAt(i, _tmpMatrix);
      }
      flashMesh.count = flashIdx;
      flashMesh.instanceMatrix.needsUpdate = true;
      if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <lineSegments geometry={lineGeo} material={lineMat} />
      <instancedMesh
        ref={flashMeshRef}
        args={[flashGeo, flashMat, MAX_IMPACT_FLASHES]}
        frustumCulled={false}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// ProjectileEffects — instanced mesh for bodies + pre-allocated trails
// ---------------------------------------------------------------------------

const MAX_PROJECTILES = 800;
const MAX_PROJ_INSTANCES = 1600;
/** Maximum trail line segments (one per projectile). */
const MAX_PROJ_TRAIL_SEGMENTS = MAX_PROJECTILES;

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

  // Pre-allocated trail geometry
  const trailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PROJ_TRAIL_SEGMENTS * 2 * 3);
    const colors = new Float32Array(MAX_PROJ_TRAIL_SEGMENTS * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const trailMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { projectiles, ships, battlefieldWidth, battlefieldHeight } = state;

    // Build O(1) lookup map for ships
    const shipMap = new Map<string, TacticalShip>();
    for (const s of ships) shipMap.set(s.id, s);

    const trailPosAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
    const trailColAttr = trailGeo.getAttribute('color') as THREE.BufferAttribute;
    const trailPosArr = trailPosAttr.array as Float32Array;
    const trailColArr = trailColAttr.array as Float32Array;

    let instanceIdx = 0;
    let trailSegIdx = 0;

    for (
      let i = 0;
      i < projectiles.length && instanceIdx < MAX_PROJ_INSTANCES - 1;
      i++
    ) {
      const proj = projectiles[i];
      const dmgFrac = Math.min(1, proj.damage / 65);

      const palette = shipPalette(
        proj.sourceShipId, shipMap, attackerSpeciesId, defenderSpeciesId,
      );

      tacticalTo3D(
        proj.position.x, proj.position.y, battlefieldWidth, battlefieldHeight, _tmpPos, proj.position.z,
      );
      const pos = _tmpPos;

      // Compute travel direction from pre-computed dx/dy/dz velocity components
      // Engine coordinate mapping to Three.js: engine dx → Three.js x, engine dy → Three.js z, engine dz → Three.js y
      const pdx = (proj as any).dx as number | undefined;
      const pdy = (proj as any).dy as number | undefined;
      const pdz = (proj as any).dz as number | undefined;
      if (pdx != null && pdy != null && pdz != null) {
        // Map engine coords to Three.js: engine (x,y,z) → Three.js (x,z,y)
        _tmpDir.set(pdx, pdz, pdy).normalize();
      } else {
        _tmpDir.set(1, 0, 0);
      }

      // Core: elongated streak along travel direction
      const coreLen = 0.08 + dmgFrac * 0.18;
      const coreWidth = 0.06 + dmgFrac * 0.08;

      _tmpMatrix.identity();
      _tmpMatrix.makeScale(coreLen, coreWidth, coreWidth);

      _tmpQuat.setFromUnitVectors(_xAxis, _tmpDir);
      _tmpMatrix2.makeRotationFromQuaternion(_tmpQuat);
      _tmpMatrix.premultiply(_tmpMatrix2);
      _tmpMatrix.setPosition(pos);
      mesh.setMatrixAt(instanceIdx, _tmpMatrix);

      _tmpColor.set(palette.projectileCore);
      mesh.setColorAt(instanceIdx, _tmpColor);
      instanceIdx++;

      // Glow halo
      const haloScale = coreWidth * 2.5;
      _tmpMatrix.identity();
      _tmpMatrix.makeScale(haloScale, haloScale, haloScale);
      _tmpMatrix.setPosition(pos);
      mesh.setMatrixAt(instanceIdx, _tmpMatrix);

      _tmpColor.set(palette.projectileTrail);
      mesh.setColorAt(instanceIdx, _tmpColor);
      instanceIdx++;

      // Trail segment (pre-allocated buffer)
      if (trailSegIdx < MAX_PROJ_TRAIL_SEGMENTS) {
        // Tail direction: opposite of travel direction
        // Scale trail length by muzzle velocity relative to the old default (16).
        // Fast projectiles (gauss, singularity driver) get longer streaks;
        // slow ones (siege cannon, battering ram) get stubbier trails.
        const speedFactor = (proj.speed ?? 16) / 16;
        const trailLen = (0.15 + dmgFrac * 0.25) * BF_SCALE * 10 * speedFactor;
        const tailX = pos.x - _tmpDir.x * trailLen;
        const tailY = pos.y - _tmpDir.y * trailLen;
        const tailZ = pos.z - _tmpDir.z * trailLen;

        _tmpColor.set(palette.projectileTrail);
        const base = trailSegIdx * 6;
        trailPosArr[base] = tailX; trailPosArr[base + 1] = tailY; trailPosArr[base + 2] = tailZ;
        trailPosArr[base + 3] = pos.x; trailPosArr[base + 4] = pos.y; trailPosArr[base + 5] = pos.z;
        trailColArr[base] = _tmpColor.r; trailColArr[base + 1] = _tmpColor.g; trailColArr[base + 2] = _tmpColor.b;
        trailColArr[base + 3] = _tmpColor.r; trailColArr[base + 4] = _tmpColor.g; trailColArr[base + 5] = _tmpColor.b;
        trailSegIdx++;
      }
    }

    // Hide remaining unused projectile instances
    for (let i = instanceIdx; i < MAX_PROJ_INSTANCES; i++) {
      _tmpMatrix.makeScale(0, 0, 0);
      _tmpMatrix.setPosition(0, -1000, 0);
      mesh.setMatrixAt(i, _tmpMatrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Update trail draw range
    trailGeo.setDrawRange(0, trailSegIdx * 2);
    trailPosAttr.needsUpdate = true;
    trailColAttr.needsUpdate = true;
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
      <lineSegments geometry={trailGeo} material={trailMat} />
    </>
  );
}

// ---------------------------------------------------------------------------
// MissileEffects — instanced mesh bodies + pre-allocated trail lines + glow
// ---------------------------------------------------------------------------

const MAX_MISSILES = 100;
/** Maximum exhaust trail segments across all missiles. */
const MAX_MISSILE_TRAIL_SEGMENTS = 600;
/** Maximum missile exhaust glow dots. */
const MAX_MISSILE_GLOWS = MAX_MISSILES;

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
  const glowMeshRef = useRef<THREE.InstancedMesh>(null!);

  // Pre-allocated trail geometry
  const trailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_MISSILE_TRAIL_SEGMENTS * 2 * 3);
    const colors = new Float32Array(MAX_MISSILE_TRAIL_SEGMENTS * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const trailMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    [],
  );

  // Pre-allocated glow geometry (shared icosahedron)
  const glowGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    const glowMesh = glowMeshRef.current;
    if (!mesh) return;

    const { missiles, ships, battlefieldWidth, battlefieldHeight, tick } = state;
    const missileList = missiles ?? [];

    // Build O(1) lookup map for ships
    const shipMap = new Map<string, TacticalShip>();
    for (const s of ships) shipMap.set(s.id, s);

    const trailPosAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
    const trailColAttr = trailGeo.getAttribute('color') as THREE.BufferAttribute;
    const trailPosArr = trailPosAttr.array as Float32Array;
    const trailColArr = trailColAttr.array as Float32Array;

    let trailSegIdx = 0;
    let glowIdx = 0;

    // Update instanced missile bodies
    for (let i = 0; i < MAX_MISSILES; i++) {
      if (i < missileList.length) {
        const m = missileList[i];
        const mStyle: MissileStyle =
          MISSILE_STYLE_MAP[m.componentId ?? ''] ?? 'torpedo';
        const vis = MISSILE_VISUALS[mStyle];
        const baseScale = vis.size * BF_SCALE * 10;

        const palette = shipPalette(
          m.sourceShipId, shipMap, attackerSpeciesId, defenderSpeciesId,
        );

        tacticalTo3D(m.x, m.y, battlefieldWidth, battlefieldHeight, _tmpPos, m.z);
        const pos = _tmpPos;

        const heading = m.heading;
        // Capsule body along Y. After tilting -90° around X, tip points +Z.
        // Y-rotation maps (0,0,1) to (sinθ, 0, cosθ). We need tip at
        // (cos(heading), 0, sin(heading)) in 3D, so θ = PI/2 - heading.
        _tmpQuat.setFromAxisAngle(_xAxis, -Math.PI / 2);
        _tmpQuat2.setFromAxisAngle(_yAxis, Math.PI / 2 - heading);
        _tmpQuat2.multiply(_tmpQuat);
        _tmpScale.set(baseScale, baseScale * 2.2, baseScale);
        _tmpMatrix.compose(pos, _tmpQuat2, _tmpScale);
        mesh.setMatrixAt(i, _tmpMatrix);

        _tmpColor.set(palette.missileBody);
        mesh.setColorAt(i, _tmpColor);

        // Exhaust trails (write into pre-allocated buffer)
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        const trailLen3D = vis.trailLen * BF_SCALE * 10;
        const segments = vis.exhaustSegments;

        _tmpColor.set(palette.missileExhaust);
        for (let seg = 0; seg < segments && trailSegIdx < MAX_MISSILE_TRAIL_SEGMENTS; seg++) {
          const t0 = seg / segments;
          const t1 = (seg + 1) / segments;
          const fadeT = 1 - (t0 + t1) * 0.5;

          const p0x = pos.x - cos * trailLen3D * BF_SCALE * t0;
          const p0z = pos.z - sin * trailLen3D * BF_SCALE * t0;
          const p1x = pos.x - cos * trailLen3D * BF_SCALE * t1;
          const p1z = pos.z - sin * trailLen3D * BF_SCALE * t1;

          const base = trailSegIdx * 6;
          trailPosArr[base] = p0x; trailPosArr[base + 1] = pos.y; trailPosArr[base + 2] = p0z;
          trailPosArr[base + 3] = p1x; trailPosArr[base + 4] = pos.y; trailPosArr[base + 5] = p1z;
          // Apply fade to colour
          const fr = _tmpColor.r * fadeT;
          const fg = _tmpColor.g * fadeT;
          const fb = _tmpColor.b * fadeT;
          trailColArr[base] = fr; trailColArr[base + 1] = fg; trailColArr[base + 2] = fb;
          trailColArr[base + 3] = fr; trailColArr[base + 4] = fg; trailColArr[base + 5] = fb;
          trailSegIdx++;
        }

        // Exhaust glow dot at the nozzle (instanced mesh)
        if (vis.glowAlpha > 0 && glowMesh && glowIdx < MAX_MISSILE_GLOWS) {
          const glowSize = vis.size * BF_SCALE * 6;
          const glowOpacity = vis.glowAlpha * (0.8 + 0.2 * Math.sin(tick * 0.5));
          _tmpMatrix.makeScale(glowSize, glowSize, glowSize);
          _tmpMatrix.setPosition(
            pos.x - cos * vis.size * BF_SCALE * 4,
            pos.y,
            pos.z - sin * vis.size * BF_SCALE * 4,
          );
          glowMesh.setMatrixAt(glowIdx, _tmpMatrix);
          _tmpColor.set(palette.missileGlow).multiplyScalar(glowOpacity);
          glowMesh.setColorAt(glowIdx, _tmpColor);
          glowIdx++;
        }
      } else {
        // Hide unused missile body instances
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -1000, 0);
        mesh.setMatrixAt(i, _tmpMatrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Update trail draw range
    trailGeo.setDrawRange(0, trailSegIdx * 2);
    trailPosAttr.needsUpdate = true;
    trailColAttr.needsUpdate = true;

    // Update glow instances
    if (glowMesh) {
      for (let i = glowIdx; i < MAX_MISSILE_GLOWS; i++) {
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -1000, 0);
        glowMesh.setMatrixAt(i, _tmpMatrix);
      }
      glowMesh.count = glowIdx;
      glowMesh.instanceMatrix.needsUpdate = true;
      if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
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
      <lineSegments geometry={trailGeo} material={trailMat} />
      <instancedMesh
        ref={glowMeshRef}
        args={[glowGeo, glowMat, MAX_MISSILE_GLOWS]}
        frustumCulled={false}
      />
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
