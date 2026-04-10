/**
 * CombatShips — Renders all combat ships as 3D meshes using procedural
 * geometry from ShipModels3D, with selection rings, health bars, damage
 * flash overlays, engine glow lights, running lights, and species colour
 * theme lighting.
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TacticalShip, HullClass } from '@nova-imperia/shared';
import { generateShipBuildResult, getShipMaterial } from '../../../game/rendering/ShipModels3D';
import { getSpeciesWeaponPalette } from '../../../assets/graphics/speciesWeaponVisuals';
import type { CombatStateAPI } from './useCombatState';
import { tacticalTo3D, shipScale, BF_SCALE, DAMAGE_FLASH_COLOR } from './constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAMAGE_FLASH_DURATION_MS = 120;
const SELECTION_RING_COLOR = 0xffffff;
const ENGINE_EMISSIVE_RADIUS = 0.15;

/** Shield flash duration in milliseconds. */
const SHIELD_FLASH_DURATION_MS = 150;

/** Scratch vector for per-ship positioning (avoid per-frame allocation). */
const _tmpShipPos = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Health bar colour helper
// ---------------------------------------------------------------------------

function hullBarColour(fraction: number): string {
  if (fraction > 0.6) return '#44cc44';
  if (fraction > 0.3) return '#cccc44';
  return '#cc4444';
}

// ---------------------------------------------------------------------------
// ShipMesh — individual 3D ship
// ---------------------------------------------------------------------------

interface ShipMeshProps {
  ship: TacticalShip;
  api: CombatStateAPI;
  bfWidth: number;
  bfHeight: number;
  hullClass: HullClass;
  speciesId: string | undefined;
  empireColor: string;
  tick: number;
}

const ShipMesh: React.FC<ShipMeshProps> = React.memo(function ShipMesh({
  ship,
  api,
  bfWidth,
  bfHeight,
  hullClass,
  speciesId,
  empireColor,
  tick: _tick,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const flashStartRef = useRef<number>(0);
  const shieldMeshRef = useRef<THREE.Mesh>(null);
  const shieldFlashStartRef = useRef<number>(0);

  // Memoise build result (geometry + hardpoint metadata) per species + hull class
  const buildResult = useMemo(
    () => {
      const result = generateShipBuildResult(speciesId ?? 'teranos', hullClass);
      // Debug: log hull class + bounds for large ships to verify correct geometry
      if (ship.maxHull > 500) {
        console.log(`[CombatShip] ${ship.name} hull=${hullClass} species=${speciesId} maxHull=${ship.maxHull} bounds=L${result.hardpoints.bounds.length.toFixed(1)}/W${result.hardpoints.bounds.width.toFixed(1)}/H${result.hardpoints.bounds.height.toFixed(1)} weapons=${result.hardpoints.weapons.length}`);
      }
      return result;
    },
    [speciesId, hullClass],
  );
  const geometry = buildResult.geometry;
  const hardpoints = buildResult.hardpoints;

  const material = useMemo(
    () => getShipMaterial(speciesId ?? 'teranos'),
    [speciesId],
  );

  // Flash overlay material
  const flashMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: DAMAGE_FLASH_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Scale the visual mesh to match the engine's collision extents.
  // This ensures the ship's visual size == its tactical collision volume.
  // Previously shipScale() used arbitrary tiers that made large ships appear
  // up to 6× bigger than their collision boundaries — enemies appeared to
  // orbit inside the hull because the visual hull was far larger than the
  // engine's weapon range / engagement distance calculations.
  const scale = useMemo(() => {
    const ext = (ship as any).collisionExtents as { halfWidth: number; halfHeight: number; halfLength: number } | undefined;
    if (ext && hardpoints.bounds.length > 0.1) {
      // Derive scale so that visual half-length = engine halfLength in 3D units
      const engineHalfLength = ext.halfLength * BF_SCALE;
      const geoHalfLength = hardpoints.bounds.length / 2;
      return engineHalfLength / geoHalfLength;
    }
    return shipScale(ship.maxHull);
  }, [ship.maxHull, (ship as any).collisionExtents, hardpoints.bounds.length]);

  // Shield bubble scale -- use engine collision extents when available (tuned per hull class),
  // with 30% margin. Falls back to geometry bounds if extents are absent.
  const shieldBubbleScale = useMemo((): [number, number, number] => {
    const ext = (ship as any).collisionExtents as { halfWidth: number; halfHeight: number; halfLength: number } | undefined;
    if (ext) {
      return [
        ext.halfWidth * BF_SCALE * 1.3,
        ext.halfHeight * BF_SCALE * 1.3,
        ext.halfLength * BF_SCALE * 1.3,
      ];
    }
    return [
      hardpoints.bounds.width * scale * 0.75,
      hardpoints.bounds.height * scale * 0.75,
      hardpoints.bounds.length * scale * 0.65,
    ];
  }, [ship, hardpoints.bounds, scale]);

  // Species-specific palette for engine glow colour
  const palette = useMemo(() => getSpeciesWeaponPalette(speciesId), [speciesId]);

  // Shield bubble material (shared across frames, mutated via ref)
  const shieldMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: palette.shieldColor,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [palette.shieldColor],
  );

  const isSelected = api.selectedShipIds.includes(ship.id);
  const isDamaged = api.damagedShipIds.has(ship.id);
  const isShieldHit = api.shieldHitShipIds.has(ship.id);
  const isPlayer = api.isPlayerShip(ship);

  // Update position and rotation each frame
  useFrame((_state, _delta) => {
    if (!groupRef.current) return;

    // Position the group (reuse scratch vector, avoid allocation)
    tacticalTo3D(ship.position.x, ship.position.y, bfWidth, bfHeight, _tmpShipPos, ship.position.z);
    groupRef.current.position.set(_tmpShipPos.x, _tmpShipPos.y, _tmpShipPos.z);

    // Rotate the ship mesh — yaw from facing, pitch from vertical velocity,
    // roll from turn rate (velocity vs facing difference).
    if (meshRef.current) {
      const yaw = -(ship.facing - Math.PI / 2);

      // Pitch from vertical velocity (tactical Z -> Three.js Y)
      const vx = ship.velocity?.x ?? 0;
      const vy = ship.velocity?.y ?? 0;
      const vz = ship.velocity?.z ?? 0;
      const horizSpeed = Math.sqrt(vx * vx + vy * vy);
      const rawPitch = ship.currentPitch != null
        ? ship.currentPitch
        : (horizSpeed > 0.1 ? Math.atan2(vz, horizSpeed) : 0);
      // Clamp pitch — smaller ships pitch more aggressively
      const maxPitch = ship.maxHull < 80 ? Math.PI / 3 : ship.maxHull < 200 ? Math.PI / 5 : Math.PI / 8;
      const pitch = Math.max(-maxPitch, Math.min(maxPitch, rawPitch));

      // Roll from turn rate (difference between velocity direction and facing)
      const velAngle = Math.atan2(vy, vx);
      let rollInput = velAngle - ship.facing;
      // Normalise to -PI..PI
      if (rollInput > Math.PI) rollInput -= Math.PI * 2;
      if (rollInput < -Math.PI) rollInput += Math.PI * 2;
      const maxRoll = ship.maxHull < 80 ? Math.PI / 3 : ship.maxHull < 200 ? Math.PI / 6 : Math.PI / 10;
      let roll = Math.max(-maxRoll, Math.min(maxRoll, rollInput * 0.5));

      // Fighter corkscrew effect — oscillating roll for small, fast ships
      if (ship.maxHull < 40 && horizSpeed > 1) {
        const corkscrewRoll = Math.sin(Date.now() * 0.005 + ship.id.charCodeAt(0)) * Math.PI / 4;
        roll += corkscrewRoll;
      }

      // Apply as Euler rotation: pitch around X, yaw around Y, roll around Z
      meshRef.current.rotation.set(pitch, yaw, roll);
    }
    if (outlineRef.current && meshRef.current) {
      outlineRef.current.rotation.copy(meshRef.current.rotation);
    }

    // Damage flash — driven entirely via ref, no React state setter
    if (isDamaged && flashStartRef.current === 0) {
      flashStartRef.current = performance.now();
    }

    if (flashStartRef.current > 0 && flashRef.current) {
      const elapsed = performance.now() - flashStartRef.current;
      if (elapsed < DAMAGE_FLASH_DURATION_MS) {
        const alpha = 1 - elapsed / DAMAGE_FLASH_DURATION_MS;
        flashMaterial.opacity = alpha * 0.6;
        flashRef.current.visible = true;
      } else {
        flashMaterial.opacity = 0;
        flashRef.current.visible = false;
        flashStartRef.current = 0;
      }
    }

    // Shield hit flash — pulse the shield bubble on shield damage
    if (isShieldHit && shieldFlashStartRef.current === 0) {
      shieldFlashStartRef.current = performance.now();
    }

    if (shieldFlashStartRef.current > 0 && shieldMeshRef.current) {
      const elapsed = performance.now() - shieldFlashStartRef.current;
      if (elapsed < SHIELD_FLASH_DURATION_MS) {
        const t = elapsed / SHIELD_FLASH_DURATION_MS;
        const pulseScale = 1.0 + 0.15 * Math.sin(t * Math.PI);
        shieldMeshRef.current.scale.setScalar(pulseScale);
        shieldMaterial.opacity = 0.5 * (1 - t);
      } else {
        shieldMeshRef.current.scale.setScalar(1.0);
        shieldMaterial.opacity = 0.04 + 0.06 * shieldFraction;
        shieldFlashStartRef.current = 0;
      }
    } else if (shieldMeshRef.current && shieldFlashStartRef.current === 0) {
      // Idle shield opacity — subtly visible
      shieldMaterial.opacity = 0.04 + 0.06 * shieldFraction;
    }

    // Rotate shield bubble with ship (all axes, not just yaw)
    if (shieldMeshRef.current && meshRef.current) {
      shieldMeshRef.current.rotation.copy(meshRef.current.rotation);
    }
  });

  // Click handler
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (isPlayer) {
        api.selectShip(ship.id);
      } else if (api.selectedShipIds.length > 0) {
        api.issueOrder({ type: 'attack', targetId: ship.id });
      }
    },
    [isPlayer, ship.id, api],
  );

  // Context menu (right-click) — attack order on enemy
  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (!isPlayer && api.selectedShipIds.length > 0) {
        api.issueOrder({ type: 'attack', targetId: ship.id });
      }
    },
    [isPlayer, ship.id, api],
  );

  // Don't render destroyed or routed ships
  if (ship.destroyed || ship.routed) return null;

  const hullFraction = ship.maxHull > 0 ? ship.hull / ship.maxHull : 0;
  const shieldFraction = ship.maxShields > 0 ? ship.shields / ship.maxShields : 0;

  return (
    <group ref={groupRef}>
      {/* Ship mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        scale={[scale, scale, scale]}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Empire colour outline — bright edge glow shows which side a ship is on */}
      <mesh
        ref={outlineRef}
        geometry={geometry}
        scale={[scale * 1.05, scale * 1.05, scale * 1.05]}
      >
        <meshBasicMaterial
          color={empireColor}
          side={THREE.BackSide}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[scale * 1.2, scale * 1.4, 32]} />
          <meshBasicMaterial
            color={SELECTION_RING_COLOR}
            transparent
            opacity={0.7}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Damage flash sphere overlay — always rendered, visibility toggled via ref */}
      <mesh ref={flashRef} scale={[scale * 1.3, scale * 1.3, scale * 1.3]} visible={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <primitive object={flashMaterial} attach="material" />
      </mesh>

      {/* Engine glow — positioned at stern using bounding box (always accurate) */}
      <mesh position={[0, 0, -hardpoints.bounds.length * scale * 0.48]}>
        <sphereGeometry args={[ENGINE_EMISSIVE_RADIUS * scale * 1.5, 6, 6]} />
        <meshBasicMaterial
          color={palette.engineGlow}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      {/* Shield bubble — semi-transparent ellipsoid sized from engine collision extents */}
      {ship.maxShields > 0 && (
        <mesh
          ref={shieldMeshRef}
          scale={shieldBubbleScale}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <primitive object={shieldMaterial} attach="material" />
        </mesh>
      )}

      {/* Health bar and name label (HTML overlay) */}
      <Html
        position={[0, scale * 1.8 + 0.3, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
          {/* Shield bar */}
          {ship.maxShields > 0 && (
            <div
              style={{
                width: '40px',
                height: '3px',
                background: '#222',
                borderRadius: '1px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${shieldFraction * 100}%`,
                  height: '100%',
                  background: '#4488ff',
                }}
              />
            </div>
          )}
          {/* Hull bar */}
          <div
            style={{
              width: '40px',
              height: '3px',
              background: '#222',
              borderRadius: '1px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${hullFraction * 100}%`,
                height: '100%',
                background: hullBarColour(hullFraction),
              }}
            />
          </div>
          {/* Ship name */}
          <div
            style={{
              color: '#ccddeeff',
              fontSize: '7px',
              fontFamily: 'monospace',
              textShadow: '0 0 2px #000',
              whiteSpace: 'nowrap',
              marginTop: '1px',
            }}
          >
            {ship.name}
          </div>
        </div>
      </Html>
    </group>
  );
});

// ---------------------------------------------------------------------------
// CombatShips — renders all ships
// ---------------------------------------------------------------------------

export interface CombatShipsProps {
  api: CombatStateAPI;
}

export const CombatShips: React.FC<CombatShipsProps> = React.memo(function CombatShips({ api }) {
  const { state, sceneData } = api;

  // Build hull class lookup: shipId -> HullClass
  const hullClassMap = useMemo(() => {
    const map = new Map<string, HullClass>();
    const allShips = [...sceneData.attackerShips, ...sceneData.defenderShips];

    for (const ship of state.ships) {
      // Look up the canonical ship to find its design
      const sourceShip = allShips.find(s => s.id === ship.sourceShipId);
      if (sourceShip) {
        const design = sceneData.designs.get(sourceShip.designId);
        if (design) {
          map.set(ship.id, design.hull);
          continue;
        }
      }
      // Fallback: guess hull class from max hull points
      let fallback: HullClass;
      if (ship.maxHull >= 10000) fallback = 'planet_killer';
      else if (ship.maxHull >= 5000) fallback = 'large_space_station';
      else if (ship.maxHull >= 3000) fallback = 'battle_station';
      else if (ship.maxHull >= 2000) fallback = 'space_station';
      else if (ship.maxHull >= 1500) fallback = 'heavy_battleship';
      else if (ship.maxHull >= 450) fallback = 'heavy_battleship';
      else if (ship.maxHull >= 250) fallback = 'battleship';
      else if (ship.maxHull >= 120) fallback = 'light_cruiser';
      else if (ship.maxHull >= 60) fallback = 'destroyer';
      else if (ship.maxHull >= 30) fallback = 'patrol';
      else fallback = 'science_probe';
      map.set(ship.id, fallback);
    }

    return map;
  }, [state.ships, sceneData]);

  return (
    <>
      {state.ships.map(ship => {
        const hullClass = hullClassMap.get(ship.id) ?? 'destroyer';
        const speciesId =
          ship.side === 'attacker'
            ? sceneData.attackerSpeciesId
            : sceneData.defenderSpeciesId;
        const empireColor =
          ship.side === 'attacker'
            ? sceneData.attackerColor
            : sceneData.defenderColor;

        return (
          <ShipMesh
            key={ship.id}
            ship={ship}
            api={api}
            bfWidth={api.state.battlefieldWidth}
            bfHeight={api.state.battlefieldHeight}
            hullClass={hullClass}
            speciesId={speciesId}
            empireColor={empireColor}
            tick={state.tick}
          />
        );
      })}
    </>
  );
});
