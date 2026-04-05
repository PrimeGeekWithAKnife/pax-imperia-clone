/**
 * CombatShips — Renders all combat ships as 3D meshes using procedural
 * geometry from ShipModels3D, with selection rings, health bars, damage
 * flash overlays, engine glow lights, running lights, and species colour
 * theme lighting.
 */

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TacticalShip, HullClass } from '@nova-imperia/shared';
import { generateShipGeometry, getShipMaterial } from '../../../game/rendering/ShipModels3D';
import { getSpeciesWeaponPalette } from '../../../assets/graphics/speciesWeaponVisuals';
import type { CombatStateAPI } from './useCombatState';
import { tacticalTo3D, shipYOffset, shipScale, DAMAGE_FLASH_COLOR } from './constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAMAGE_FLASH_DURATION_MS = 120;
const SELECTION_RING_COLOR = 0xffffff;
const ENGINE_GLOW_INTENSITY = 0.8;
const ENGINE_GLOW_DISTANCE = 5;
const ENGINE_EMISSIVE_RADIUS = 0.15;

/** Running lights blink period in ticks (alternates every 17 ticks). */
const RUNNING_LIGHT_BLINK_TICKS = 17;
const RUNNING_LIGHT_INTENSITY = 0.5;
const RUNNING_LIGHT_DISTANCE = 2.5;
const PORT_LIGHT_COLOR = 0xff2222;       // red — port (left)
const STARBOARD_LIGHT_COLOR = 0x22ff44;  // green — starboard (right)

/** Species ambient light to tint the hull with faction colour. */
const SPECIES_AMBIENT_INTENSITY = 0.4;
const SPECIES_AMBIENT_DISTANCE = 6;

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
  tick,
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const flashStartRef = useRef<number>(0);

  // Memoise geometry and material per species + hull class
  const geometry = useMemo(
    () => generateShipGeometry(speciesId ?? 'teranos', hullClass),
    [speciesId, hullClass],
  );

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

  const scale = useMemo(() => shipScale(ship.maxHull), [ship.maxHull]);
  const yOff = useMemo(() => shipYOffset(ship.maxHull), [ship.maxHull]);

  // Species-specific palette for engine glow colour
  const palette = useMemo(() => getSpeciesWeaponPalette(speciesId), [speciesId]);

  // Running lights blink state — alternates port/starboard visibility every N ticks
  const runningLightsOn = Math.floor(tick / RUNNING_LIGHT_BLINK_TICKS) % 2 === 0;

  // Refs for running light objects (animated in useFrame)
  const portLightRef = useRef<THREE.PointLight>(null);
  const starboardLightRef = useRef<THREE.PointLight>(null);

  const isSelected = api.selectedShipIds.includes(ship.id);
  const isDamaged = api.damagedShipIds.has(ship.id);
  const isPlayer = api.isPlayerShip(ship);

  // Update position and rotation each frame
  useFrame((_state, _delta) => {
    if (!groupRef.current) return;

    // Position the group
    const pos = tacticalTo3D(ship.position.x, ship.position.y, bfWidth, bfHeight);
    groupRef.current.position.set(pos.x, yOff, pos.z);

    // Rotate the ship mesh (ShipModels3D faces +Z, engine uses 0 = +x)
    if (meshRef.current) {
      meshRef.current.rotation.y = -(ship.facing - Math.PI / 2);
    }

    // Damage flash
    if (isDamaged && flashStartRef.current === 0) {
      flashStartRef.current = performance.now();
    }

    if (flashStartRef.current > 0) {
      const elapsed = performance.now() - flashStartRef.current;
      if (elapsed < DAMAGE_FLASH_DURATION_MS) {
        const alpha = 1 - elapsed / DAMAGE_FLASH_DURATION_MS;
        flashMaterial.opacity = alpha * 0.6;
        setFlashOpacity(alpha * 0.6);
      } else {
        flashMaterial.opacity = 0;
        flashStartRef.current = 0;
        setFlashOpacity(0);
      }
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

      {/* Damage flash sphere overlay */}
      {flashOpacity > 0 && (
        <mesh ref={flashRef} scale={[scale * 1.3, scale * 1.3, scale * 1.3]}>
          <sphereGeometry args={[1, 8, 8]} />
          <primitive object={flashMaterial} attach="material" />
        </mesh>
      )}

      {/* Engine glow — emissive sphere + point light at the aft using species engine colour */}
      <group position={[0, 0, -scale * 1.5]}>
        <mesh>
          <sphereGeometry args={[ENGINE_EMISSIVE_RADIUS * scale, 6, 6]} />
          <meshStandardMaterial
            color={palette.engineGlow}
            emissive={palette.engineGlow}
            emissiveIntensity={3}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
        <pointLight
          color={palette.engineGlow}
          intensity={ENGINE_GLOW_INTENSITY}
          distance={ENGINE_GLOW_DISTANCE}
        />
      </group>

      {/* Running lights — red port (left), green starboard (right) */}
      <pointLight
        ref={portLightRef}
        color={PORT_LIGHT_COLOR}
        intensity={runningLightsOn ? RUNNING_LIGHT_INTENSITY : 0}
        distance={RUNNING_LIGHT_DISTANCE}
        position={[-scale * 0.9, 0.1, 0]}
      />
      <pointLight
        ref={starboardLightRef}
        color={STARBOARD_LIGHT_COLOR}
        intensity={runningLightsOn ? 0 : RUNNING_LIGHT_INTENSITY}
        distance={RUNNING_LIGHT_DISTANCE}
        position={[scale * 0.9, 0.1, 0]}
      />

      {/* Species faction ambient glow — tints the ship with its faction colour */}
      <pointLight
        color={empireColor}
        intensity={SPECIES_AMBIENT_INTENSITY}
        distance={SPECIES_AMBIENT_DISTANCE}
        position={[0, scale * 0.8, 0]}
      />

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
      if (ship.maxHull < 30) fallback = 'science_probe';
      else if (ship.maxHull < 60) fallback = 'patrol';
      else if (ship.maxHull < 120) fallback = 'destroyer';
      else if (ship.maxHull < 250) fallback = 'light_cruiser';
      else if (ship.maxHull < 450) fallback = 'battleship';
      else fallback = 'heavy_battleship';
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
