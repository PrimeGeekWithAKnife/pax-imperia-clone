/**
 * CombatEnvironment — React Three Fiber components for the combat arena
 * background and environment features.
 *
 * Provides: CombatStarfield, BattlefieldGrid, EnvironmentFeatures, PlanetEdge.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TacticalState } from '@nova-imperia/shared';
import {
  BF_SCALE,
  PLANET_SURFACE_COLOURS,
  PLANET_ATMOSPHERE_COLOURS,
  BOUNDARY_WARNING_MARGIN,
  BOUNDARY_FLEE_MARGIN,
  ASTEROID_COLOR,
  NEBULA_COLOR,
  tacticalTo3D,
} from './constants';

// ---------------------------------------------------------------------------
// 1. CombatStarfield — decorative background star sphere
// ---------------------------------------------------------------------------

const STAR_COUNT = 4000;
const STAR_INNER_RADIUS = 300;
const STAR_OUTER_RADIUS = 500;

/**
 * Decorative background starfield rendered as point sprites scattered on a
 * spherical shell surrounding the battlefield.
 */
export function CombatStarfield(): JSX.Element {
  const { positions, sizes } = useMemo(() => {
    const posArr = new Float32Array(STAR_COUNT * 3);
    const sizeArr = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Random point on a sphere between inner and outer radius
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = STAR_INNER_RADIUS + Math.random() * (STAR_OUTER_RADIUS - STAR_INNER_RADIUS);

      posArr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      posArr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      posArr[i * 3 + 2] = r * Math.cos(phi);

      sizeArr[i] = 0.5;
    }

    return { positions: posArr, sizes: sizeArr };
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={0xffffff}
        size={0.5}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// 2. BattlefieldGrid — tactical grid, warning and flee boundaries
// ---------------------------------------------------------------------------

interface BattlefieldGridProps {
  width: number;
  height: number;
}

/**
 * Renders the tactical grid lines plus warning (amber) and flee (red)
 * boundary rectangles.
 */
export function BattlefieldGrid({ width, height }: BattlefieldGridProps): JSX.Element {
  // All geometry is built in useMemo so it only recalculates when dimensions change.
  const gridGeometry = useMemo(() => {
    const w = width * BF_SCALE;
    const h = height * BF_SCALE;
    const step = 200 * BF_SCALE; // grid every 200 tactical units
    const y = -0.1;

    const verts: number[] = [];

    // Vertical lines
    for (let x = -w / 2; x <= w / 2 + 0.001; x += step) {
      verts.push(x, y, -h / 2, x, y, h / 2);
    }
    // Horizontal lines
    for (let z = -h / 2; z <= h / 2 + 0.001; z += step) {
      verts.push(-w / 2, y, z, w / 2, y, z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [width, height]);

  const warningGeometry = useMemo(() => {
    const wm = BOUNDARY_WARNING_MARGIN * BF_SCALE;
    const w = width * BF_SCALE;
    const h = height * BF_SCALE;
    const y = -0.05;

    // Inner edge of the warning zone — rectangle offset from the battlefield edge
    const x0 = -w / 2 + wm;
    const x1 = w / 2 - wm;
    const z0 = -h / 2 + wm;
    const z1 = h / 2 - wm;

    const verts = [
      // Top edge
      x0, y, z0, x1, y, z0,
      // Right edge
      x1, y, z0, x1, y, z1,
      // Bottom edge
      x1, y, z1, x0, y, z1,
      // Left edge
      x0, y, z1, x0, y, z0,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [width, height]);

  const fleeGeometry = useMemo(() => {
    const fm = BOUNDARY_FLEE_MARGIN * BF_SCALE;
    const w = width * BF_SCALE;
    const h = height * BF_SCALE;
    const y = -0.05;

    const x0 = -w / 2 + fm;
    const x1 = w / 2 - fm;
    const z0 = -h / 2 + fm;
    const z1 = h / 2 - fm;

    const verts = [
      x0, y, z0, x1, y, z0,
      x1, y, z0, x1, y, z1,
      x1, y, z1, x0, y, z1,
      x0, y, z1, x0, y, z0,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [width, height]);

  return (
    <group>
      {/* Subtle grid */}
      <lineSegments geometry={gridGeometry}>
        <lineBasicMaterial color={0x1a1a3a} transparent opacity={0.25} depthWrite={false} />
      </lineSegments>

      {/* Amber warning boundary */}
      <lineSegments geometry={warningGeometry}>
        <lineBasicMaterial color={0xf59e0b} transparent opacity={0.35} depthWrite={false} />
      </lineSegments>

      {/* Red flee boundary */}
      <lineSegments geometry={fleeGeometry}>
        <lineBasicMaterial color={0xef4444} transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 3. EnvironmentFeatures — asteroids & nebulae from TacticalState
// ---------------------------------------------------------------------------

interface EnvironmentFeaturesProps {
  state: TacticalState;
}

/**
 * Renders asteroids (dodecahedrons) and nebulae (translucent spheres) from
 * the tactical state's environment array.
 */
export function EnvironmentFeatures({ state }: EnvironmentFeaturesProps): JSX.Element {
  const { bfWidth, bfHeight } = useMemo(
    () => ({ bfWidth: state.battlefieldWidth, bfHeight: state.battlefieldHeight }),
    [state.battlefieldWidth, state.battlefieldHeight],
  );

  return (
    <group>
      {state.environment.map((feat) => {
        const pos = tacticalTo3D(feat.x, feat.y, bfWidth, bfHeight);

        if (feat.type === 'asteroid') {
          return (
            <mesh key={feat.id} position={[pos.x, 0, pos.z]}>
              <dodecahedronGeometry args={[feat.radius * BF_SCALE]} />
              <meshStandardMaterial color={ASTEROID_COLOR} roughness={0.9} />
            </mesh>
          );
        }

        if (feat.type === 'nebula') {
          return (
            <mesh key={feat.id} position={[pos.x, 0, pos.z]}>
              <sphereGeometry args={[feat.radius * BF_SCALE, 16, 16]} />
              <meshStandardMaterial
                color={NEBULA_COLOR}
                transparent
                opacity={0.15}
                depthWrite={false}
              />
            </mesh>
          );
        }

        // Debris — skip for now (handled by effects layer)
        return null;
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 4. PlanetEdge — large planet sphere for planetary assault layout
// ---------------------------------------------------------------------------

/** Planet radius in tactical units (matches 2D CombatScene). */
const PLANET_RADIUS = 400;
/** Number of atmospheric glow layers. */
const PLANET_GLOW_LAYERS = 8;
/** Width of the atmospheric glow band in tactical units. */
const PLANET_GLOW_WIDTH = 40;

interface PlanetEdgeProps {
  state: TacticalState;
}

/**
 * Renders a large planet sphere at the bottom-right of the battlefield,
 * visible only during planetary assault battles.
 */
export function PlanetEdge({ state }: PlanetEdgeProps): JSX.Element | null {
  if (state.layout !== 'planetary_assault') return null;

  const bfWidth = state.battlefieldWidth;
  const bfHeight = state.battlefieldHeight;
  const planetType = state.planetData?.type ?? 'terran';

  const surfaceColour = PLANET_SURFACE_COLOURS[planetType] ?? 0x2a2a2a;
  const atmosphereColour = PLANET_ATMOSPHERE_COLOURS[planetType] ?? 0x4488cc;

  // Tactical position: bottom-right of the battlefield
  const planetPos = tacticalTo3D(bfWidth - 200, bfHeight - 150, bfWidth, bfHeight);
  const planetY = -5; // below the battlefield plane

  const planetRadius3D = PLANET_RADIUS * BF_SCALE;

  // Atmospheric glow — concentric transparent spheres
  const glowLayers = useMemo(() => {
    const layers: { radius: number; opacity: number }[] = [];
    for (let i = 0; i < PLANET_GLOW_LAYERS; i++) {
      const r =
        (PLANET_RADIUS + PLANET_GLOW_WIDTH - i * (PLANET_GLOW_WIDTH / PLANET_GLOW_LAYERS)) *
        BF_SCALE;
      const opacity =
        ((PLANET_GLOW_LAYERS - i) / PLANET_GLOW_LAYERS) * 0.15;
      layers.push({ radius: r, opacity });
    }
    return layers;
  }, []);

  return (
    <group position={[planetPos.x, planetY, planetPos.z]}>
      {/* Planet surface */}
      <mesh>
        <sphereGeometry args={[planetRadius3D, 32, 32]} />
        <meshStandardMaterial color={surfaceColour} roughness={0.8} />
      </mesh>

      {/* Atmospheric glow layers */}
      {glowLayers.map((layer, i) => (
        <mesh key={i}>
          <sphereGeometry args={[layer.radius, 32, 32]} />
          <meshStandardMaterial
            color={atmosphereColour}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      ))}
    </group>
  );
}
