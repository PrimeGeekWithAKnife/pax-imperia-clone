/**
 * GalaxyMap3D — React Three Fiber galaxy map renderer.
 *
 * A standalone 3D replacement for the Phaser GalaxyMapScene.
 * Renders the galaxy as a navigable 3D scene with bloom, nebulae,
 * instanced stars, wormhole connections, and interactive selection.
 */
import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Galaxy, StarSystem, StarType, SpiralGalaxyMetadata, Planet } from '@nova-imperia/shared';
import { SystemView3D } from './SystemView3D';

// ── Star visual properties ──────────────────────────────────────────────────

const STAR_COLOURS: Record<StarType, [number, number, number]> = {
  blue_giant: [0.55, 0.65, 1.0],
  white:      [0.97, 0.97, 1.0],
  yellow:     [1.0, 0.93, 0.67],
  orange:     [1.0, 0.73, 0.47],
  red_dwarf:  [1.0, 0.47, 0.33],
  red_giant:  [1.0, 0.40, 0.27],
  neutron:    [0.8, 0.93, 1.0],
  binary:     [1.0, 0.91, 0.80],
};

const STAR_EMISSIVE: Record<StarType, number> = {
  blue_giant: 5.0,
  white:      3.5,
  yellow:     2.8,
  orange:     2.2,
  red_dwarf:  1.8,
  red_giant:  4.0,
  neutron:    6.0,
  binary:     3.0,
};

const STAR_SCALE: Record<StarType, number> = {
  blue_giant: 2.0,
  white:      1.3,
  yellow:     1.1,
  orange:     1.0,
  red_dwarf:  0.7,
  red_giant:  2.2,
  neutron:    0.5,
  binary:     1.4,
};

// ── Empire ownership colours ────────────────────────────────────────────────

const PLAYER_COLOUR = '#00d4ff';
const AI_EMPIRE_COLOURS = [
  '#ff6d00', '#e91e63', '#9c27b0', '#4caf50',
  '#ffc107', '#00bcd4', '#795548', '#ff5722',
];

/** Return a consistent colour for a given ownerId. */
function getEmpireColour(ownerId: string, playerEmpireId?: string): string {
  if (ownerId === playerEmpireId) return PLAYER_COLOUR;
  // Hash the ownerId to pick a colour deterministically
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) {
    hash = ((hash << 5) - hash + ownerId.charCodeAt(i)) | 0;
  }
  return AI_EMPIRE_COLOURS[Math.abs(hash) % AI_EMPIRE_COLOURS.length];
}

// ── Utility: Y offset for system (consistent across components) ─────────────

function systemYOffset(sys: StarSystem): number {
  return (Math.sin(sys.position.x * 0.1) * Math.cos(sys.position.y * 0.1)) * 3;
}

// ── Background starfield (decorative, thousands of dim stars) ───────────────

function BackgroundStarfield({ count = 6000 }: { count?: number }) {
  const { positions, sizes, colours } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 400 + Math.random() * 300;

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      siz[i] = 0.3 + Math.random() * 1.2;

      const temp = Math.random();
      col[i * 3]     = 0.7 + temp * 0.3;
      col[i * 3 + 1] = 0.7 + temp * 0.2;
      col[i * 3 + 2] = 0.8 + temp * 0.2;
    }
    return { positions: pos, sizes: siz, colours: col };
  }, [count]);

  return (
    <points raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-color" count={count} array={colours} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        vertexShader={`
          attribute float aSize;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * (250.0 / -mv.z);
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float alpha = 1.0 - smoothstep(0.0, 0.5, d);
            alpha = pow(alpha, 2.5);
            gl_FragColor = vec4(vColor, alpha * 0.5);
          }
        `}
      />
    </points>
  );
}

// ── Ambient particles (slowly drifting cosmic dust) ─────────────────────────

function AmbientParticles({ galaxy }: { galaxy: Galaxy }) {
  const count = 800;
  const { positions, velocities, sizes } = useMemo(() => {
    const cx = galaxy.width / 2;
    const cy = galaxy.height / 2;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const siz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * galaxy.width * 0.45;
      pos[i * 3]     = cx + Math.cos(angle) * dist;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = cy + Math.sin(angle) * dist;

      vel[i * 3]     = (Math.random() - 0.5) * 0.15;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;

      siz[i] = 0.2 + Math.random() * 0.6;
    }
    return { positions: pos, velocities: vel, sizes: siz };
  }, [galaxy, count]);

  const posRef = useRef(positions);
  posRef.current = positions;

  const geoRef = useRef<THREE.BufferGeometry>(null!);

  useFrame((_, delta) => {
    if (!geoRef.current) return;
    const posArr = geoRef.current.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArr[i * 3]     += velocities[i * 3] * delta;
      posArr[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      posArr[i * 3 + 2] += velocities[i * 3 + 2] * delta;
    }
    geoRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <points raycast={() => null}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" count={count} array={new Float32Array(positions)} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float aSize;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * (150.0 / -mv.z);
          }
        `}
        fragmentShader={`
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float alpha = 1.0 - smoothstep(0.0, 0.5, d);
            alpha = pow(alpha, 3.0);
            gl_FragColor = vec4(0.4, 0.5, 0.7, alpha * 0.12);
          }
        `}
      />
    </points>
  );
}

// ── Nebula clouds (multi-layered, sprite-based, along spiral arms) ──────────

const NEBULA_PALETTE = [
  '#1a2266', '#2244aa', '#6622aa', '#aa2255',
  '#223388', '#553399', '#882244', '#114466',
];

/** Create a soft radial gradient texture for nebula sprites with organic variation. */
function createNebulaTexture(variant: number): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Offset centre for non-uniform look
  const ox = size / 2 + (variant % 3 - 1) * 15;
  const oy = size / 2 + (variant % 5 - 2) * 10;

  const gradient = ctx.createRadialGradient(ox, oy, 0, size / 2, size / 2, size / 2);
  // Vary the stops per variant
  const inner = 0.4 + (variant % 7) * 0.04;
  gradient.addColorStop(0, `rgba(255, 255, 255, ${inner})`);
  gradient.addColorStop(0.2, `rgba(255, 255, 255, ${inner * 0.55})`);
  gradient.addColorStop(0.5, `rgba(255, 255, 255, ${inner * 0.15})`);
  gradient.addColorStop(0.75, `rgba(255, 255, 255, ${inner * 0.04})`);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add a secondary off-centre blob for organic variation
  const g2 = ctx.createRadialGradient(
    ox + 30 * Math.cos(variant), oy + 30 * Math.sin(variant),
    0, size / 2, size / 2, size * 0.35
  );
  g2.addColorStop(0, `rgba(255, 255, 255, ${inner * 0.3})`);
  g2.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Pre-create a few texture variants for visual variety
const nebulaTextures = [0, 1, 2, 3, 4].map(i => createNebulaTexture(i));

interface NebulaCloudData {
  x: number;
  z: number;
  y: number;
  colour: string;
  scale: number;
  rotSpeed: number;
  texIdx: number;
  opacity: number;
}

function NebulaClouds({ galaxy }: { galaxy: Galaxy }) {
  const clouds = useMemo(() => {
    const result: NebulaCloudData[] = [];
    const meta = galaxy.shapeMetadata;

    if (meta?.shape === 'spiral') {
      const spiral = meta as SpiralGalaxyMetadata;
      const cx = spiral.centreX;
      const cy = spiral.centreY;

      // Place clouds along spiral arms — multiple depth layers per cloud
      for (let arm = 0; arm < spiral.armCount; arm++) {
        const baseAngle = spiral.armAngles[arm] ?? (arm * Math.PI * 2) / spiral.armCount;
        for (let t = 0.12; t < 1.0; t += 0.1 + Math.random() * 0.08) {
          const angle = baseAngle + t * spiral.spiralTightness;
          const radius = spiral.spiralA + t * (galaxy.width * 0.45);
          const jitter = (Math.random() - 0.5) * 70;
          const x = cx + Math.cos(angle) * radius + jitter;
          const z = cy + Math.sin(angle) * radius + jitter;

          // Main cloud layer
          result.push({
            x, z, y: -2 + (Math.random() - 0.5) * 4,
            colour: NEBULA_PALETTE[Math.floor(Math.random() * NEBULA_PALETTE.length)],
            scale: 50 + Math.random() * 90,
            rotSpeed: (Math.random() - 0.5) * 0.025,
            texIdx: Math.floor(Math.random() * nebulaTextures.length),
            opacity: 0.08 + Math.random() * 0.1,
          });

          // Sub-layer at slightly different depth and colour for volume
          if (Math.random() > 0.4) {
            result.push({
              x: x + (Math.random() - 0.5) * 30,
              z: z + (Math.random() - 0.5) * 30,
              y: -2 + (Math.random() - 0.5) * 8,
              colour: NEBULA_PALETTE[Math.floor(Math.random() * NEBULA_PALETTE.length)],
              scale: 30 + Math.random() * 60,
              rotSpeed: (Math.random() - 0.5) * 0.03,
              texIdx: Math.floor(Math.random() * nebulaTextures.length),
              opacity: 0.05 + Math.random() * 0.08,
            });
          }
        }
      }

      // Central bulge clouds
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * galaxy.width * spiral.bulgeRadiusFraction * 0.35;
        result.push({
          x: cx + Math.cos(angle) * dist,
          z: cy + Math.sin(angle) * dist,
          y: -1 + (Math.random() - 0.5) * 4,
          colour: NEBULA_PALETTE[Math.floor(Math.random() * 3)],
          scale: 45 + Math.random() * 55,
          rotSpeed: (Math.random() - 0.5) * 0.02,
          texIdx: Math.floor(Math.random() * nebulaTextures.length),
          opacity: 0.06 + Math.random() * 0.08,
        });
      }
    } else {
      // Non-spiral: scatter clouds loosely
      const cx = galaxy.width / 2;
      const cy = galaxy.height / 2;
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * galaxy.width * 0.4;
        result.push({
          x: cx + Math.cos(angle) * dist,
          z: cy + Math.sin(angle) * dist,
          y: -2 + (Math.random() - 0.5) * 6,
          colour: NEBULA_PALETTE[Math.floor(Math.random() * NEBULA_PALETTE.length)],
          scale: 40 + Math.random() * 70,
          rotSpeed: (Math.random() - 0.5) * 0.02,
          texIdx: Math.floor(Math.random() * nebulaTextures.length),
          opacity: 0.07 + Math.random() * 0.1,
        });
      }
    }
    return result;
  }, [galaxy]);

  return (
    <group>
      {clouds.map((c, i) => (
        <NebulaSprite key={i} cloud={c} />
      ))}
    </group>
  );
}

function NebulaSprite({ cloud }: { cloud: NebulaCloudData }) {
  const ref = useRef<THREE.Sprite>(null!);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.material.rotation += cloud.rotSpeed * delta;
    }
  });
  return (
    <sprite ref={ref} position={[cloud.x, cloud.y, cloud.z]} scale={[cloud.scale, cloud.scale, 1]}>
      <spriteMaterial
        map={nebulaTextures[cloud.texIdx]}
        color={cloud.colour}
        transparent
        opacity={cloud.opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

// ── Dust lanes along spiral arms ────────────────────────────────────────────

function DustLanes({ galaxy }: { galaxy: Galaxy }) {
  const { positions, sizes, opacities } = useMemo(() => {
    const meta = galaxy.shapeMetadata;
    if (meta?.shape !== 'spiral') return { positions: new Float32Array(0), sizes: new Float32Array(0), opacities: new Float32Array(0) };

    const spiral = meta as SpiralGalaxyMetadata;
    const cx = spiral.centreX;
    const cy = spiral.centreY;

    const pts: number[] = [];
    const szs: number[] = [];
    const ops: number[] = [];

    // Place fine particles tracing each spiral arm
    for (let arm = 0; arm < spiral.armCount; arm++) {
      const baseAngle = spiral.armAngles[arm] ?? (arm * Math.PI * 2) / spiral.armCount;

      for (let t = 0.05; t < 1.0; t += 0.003 + Math.random() * 0.003) {
        const angle = baseAngle + t * spiral.spiralTightness;
        const radius = spiral.spiralA + t * (galaxy.width * 0.45);

        // Tight jitter perpendicular to arm for thin lane
        const perpAngle = angle + Math.PI / 2;
        const spread = 6 + t * 12; // widens slightly outward
        const offset = (Math.random() - 0.5) * spread;

        const x = cx + Math.cos(angle) * radius + Math.cos(perpAngle) * offset;
        const z = cy + Math.sin(angle) * radius + Math.sin(perpAngle) * offset;
        const y = (Math.random() - 0.5) * 2;

        pts.push(x, y, z);
        szs.push(0.3 + Math.random() * 0.8);

        // Fade at edges: particles at the fringe are dimmer
        const edgeFade = 1.0 - Math.abs(offset) / (spread * 0.5);
        ops.push(Math.max(0.05, edgeFade * (0.15 + Math.random() * 0.15)));
      }
    }

    return {
      positions: new Float32Array(pts),
      sizes: new Float32Array(szs),
      opacities: new Float32Array(ops),
    };
  }, [galaxy]);

  const count = sizes.length;
  if (count === 0) return null;

  return (
    <points raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aOpacity" count={count} array={opacities} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float aSize;
          attribute float aOpacity;
          varying float vOpacity;
          void main() {
            vOpacity = aOpacity;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * (200.0 / -mv.z);
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float alpha = 1.0 - smoothstep(0.0, 0.5, d);
            alpha = pow(alpha, 2.0);
            gl_FragColor = vec4(0.35, 0.4, 0.6, alpha * vOpacity);
          }
        `}
      />
    </points>
  );
}

// ── Galactic centre glow ────────────────────────────────────────────────────

function GalacticCentreGlow({ galaxy }: { galaxy: Galaxy }) {
  const centre = useMemo<[number, number, number]>(() => {
    const meta = galaxy.shapeMetadata;
    if (meta && 'centreX' in meta) {
      return [meta.centreX, 0, meta.centreY];
    }
    return [galaxy.width / 2, 0, galaxy.height / 2];
  }, [galaxy]);

  const bulgeRadius = useMemo(() => {
    const meta = galaxy.shapeMetadata;
    if (meta?.shape === 'spiral') {
      return galaxy.width * (meta as SpiralGalaxyMetadata).bulgeRadiusFraction * 0.8;
    }
    return galaxy.width * 0.15;
  }, [galaxy]);

  return (
    <group position={centre}>
      {/* Large soft outer glow */}
      <mesh>
        <sphereGeometry args={[bulgeRadius, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
              vViewDir = normalize(-mvPos.xyz);
              gl_Position = projectionMatrix * mvPos;
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              float rim = dot(vViewDir, vNormal);
              float glow = pow(max(rim, 0.0), 1.5);
              vec3 col = vec3(0.6, 0.55, 0.9) * glow * 0.12;
              gl_FragColor = vec4(col, glow * 0.15);
            }
          `}
        />
      </mesh>

      {/* Bright inner core */}
      <mesh>
        <sphereGeometry args={[bulgeRadius * 0.25, 24, 24]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
              vViewDir = normalize(-mvPos.xyz);
              gl_Position = projectionMatrix * mvPos;
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              float fresnel = 1.0 - abs(dot(vViewDir, vNormal));
              float core = pow(1.0 - fresnel, 2.0);
              vec3 col = mix(vec3(0.7, 0.6, 1.0), vec3(1.0, 0.95, 0.8), core);
              float alpha = (core * 0.4 + 0.05) * 0.6;
              // Push colour above 1.0 to trigger bloom
              gl_FragColor = vec4(col * 1.8, alpha);
            }
          `}
        />
      </mesh>
    </group>
  );
}

// ── Wormhole connections (animated energy pulse shader) ──────────────────────

function Hyperlanes({ systems }: { systems: StarSystem[] }) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const { geometry, laneCount } = useMemo(() => {
    const systemMap = new Map<string, StarSystem>();
    systems.forEach(s => systemMap.set(s.id, s));

    const verts: number[] = [];
    const progress: number[] = []; // 0 at start, 1 at end per lane segment
    const seen = new Set<string>();

    for (const sys of systems) {
      for (const targetId of sys.wormholes) {
        const key = [sys.id, targetId].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const target = systemMap.get(targetId);
        if (!target) continue;
        const y1 = systemYOffset(sys);
        const y2 = systemYOffset(target);

        // Subdivide the line into segments for smoother pulse
        const segments = 12;
        for (let s = 0; s < segments; s++) {
          const t0 = s / segments;
          const t1 = (s + 1) / segments;
          verts.push(
            THREE.MathUtils.lerp(sys.position.x, target.position.x, t0),
            THREE.MathUtils.lerp(y1, y2, t0),
            THREE.MathUtils.lerp(sys.position.y, target.position.y, t0),
          );
          verts.push(
            THREE.MathUtils.lerp(sys.position.x, target.position.x, t1),
            THREE.MathUtils.lerp(y1, y2, t1),
            THREE.MathUtils.lerp(sys.position.y, target.position.y, t1),
          );
          progress.push(t0, t1);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('aProgress', new THREE.Float32BufferAttribute(progress, 1));
    return { geometry: geo, laneCount: seen.size };
  }, [systems]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <lineSegments geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uBaseColor: { value: new THREE.Color('#3366cc') },
          uPulseColor: { value: new THREE.Color('#66aaff') },
        }}
        vertexShader={`
          attribute float aProgress;
          varying float vProgress;
          void main() {
            vProgress = aProgress;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uBaseColor;
          uniform vec3 uPulseColor;
          varying float vProgress;
          void main() {
            // Base lane colour
            float baseAlpha = 0.18;

            // Animated pulse travelling along the lane
            float pulsePos = fract(uTime * 0.3);
            float pulseDist = abs(vProgress - pulsePos);
            // Wrap around
            pulseDist = min(pulseDist, 1.0 - pulseDist);
            float pulse = smoothstep(0.12, 0.0, pulseDist);

            vec3 col = mix(uBaseColor, uPulseColor, pulse * 0.6);
            float alpha = baseAlpha + pulse * 0.35;
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </lineSegments>
  );
}

// ── Star glow spheres (Fresnel-based 3D volumetric glow) ────────────────────

function StarGlows({ systems }: { systems: StarSystem[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    systems.forEach((sys, i) => {
      const s = (STAR_SCALE[sys.starType] ?? 1.0) * 5;
      const yOffset = systemYOffset(sys);
      dummy.position.set(sys.position.x, yOffset, sys.position.y);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const [r, g, b] = STAR_COLOURS[sys.starType] ?? [1, 1, 1];
      const intensity = (STAR_EMISSIVE[sys.starType] ?? 2.0) * 0.5;
      colour.setRGB(r * intensity, g * intensity, b * intensity);
      meshRef.current.setColorAt(i, colour);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [systems, dummy, colour]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, systems.length]} raycast={() => null}>
      <sphereGeometry args={[1, 24, 24]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vViewDir;
          varying vec3 vColor;
          void main() {
            vColor = instanceColor;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPos.xyz);
            gl_Position = projectionMatrix * mvPos;
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          varying vec3 vViewDir;
          varying vec3 vColor;
          void main() {
            float fresnel = 1.0 - abs(dot(vViewDir, vNormal));
            // Outer glow: strong at edges (Fresnel rim), fading inward
            float outerGlow = pow(fresnel, 1.8) * 0.6;
            // Inner core brightening
            float innerCore = pow(1.0 - fresnel, 4.0) * 0.3;
            float alpha = outerGlow + innerCore;
            // Colour stays consistent across the sphere
            gl_FragColor = vec4(vColor * (1.0 + innerCore * 2.0), alpha);
          }
        `}
      />
    </instancedMesh>
  );
}

// ── Interactive star cores (instanced mesh with click/hover) ────────────────

interface StarFieldProps {
  systems: StarSystem[];
  onStarClick: (systemId: string) => void;
  onStarHover: (systemId: string | null, screenPos?: { x: number; y: number }) => void;
}

function StarCores({ systems, onStarClick, onStarHover }: StarFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    systems.forEach((sys, i) => {
      const s = STAR_SCALE[sys.starType] ?? 1.0;
      const yOffset = systemYOffset(sys);
      dummy.position.set(sys.position.x, yOffset, sys.position.y);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const [r, g, b] = STAR_COLOURS[sys.starType] ?? [1, 1, 1];
      const intensity = STAR_EMISSIVE[sys.starType] ?? 2.0;
      colour.setRGB(r * intensity, g * intensity, b * intensity);
      meshRef.current.setColorAt(i, colour);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [systems, dummy, colour]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, systems.length]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          onStarClick(systems[e.instanceId].id);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          const pt = e.point.clone().project(e.camera);
          onStarHover(systems[e.instanceId].id, {
            x: (pt.x * 0.5 + 0.5) * window.innerWidth,
            y: (-pt.y * 0.5 + 0.5) * window.innerHeight,
          });
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        onStarHover(null);
        document.body.style.cursor = 'default';
      }}
    >
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshBasicMaterial toneMapped={false} vertexColors />
    </instancedMesh>
  );
}

// ── Empire ownership rings ──────────────────────────────────────────────────

function EmpireRings({ systems, playerEmpireId }: { systems: StarSystem[]; playerEmpireId?: string }) {
  const ownedSystems = useMemo(
    () => systems.filter(s => s.ownerId != null),
    [systems],
  );

  if (ownedSystems.length === 0) return null;

  return (
    <group>
      {ownedSystems.map(sys => {
        const yOffset = systemYOffset(sys);
        const empireCol = getEmpireColour(sys.ownerId!, playerEmpireId);
        return (
          <mesh
            key={`empire-ring-${sys.id}`}
            position={[sys.position.x, yOffset - 0.3, sys.position.y]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[2.0, 2.6, 48]} />
            <meshBasicMaterial
              color={empireCol}
              transparent
              opacity={0.5}
              toneMapped={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Selection ring ──────────────────────────────────────────────────────────

function SelectionRing({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = -Math.PI / 2;
      // Gentle pulse
      const s = 1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[2.5, 3.0, 48]} />
      <meshBasicMaterial
        color={[3, 3, 3]}
        toneMapped={false}
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── System name labels (drei Html, distance-culled) ─────────────────────────

function SystemLabels({ systems, playerEmpireId }: { systems: StarSystem[]; playerEmpireId?: string }) {
  const { camera } = useThree();
  const [visibleSystems, setVisibleSystems] = useState<StarSystem[]>([]);
  const prevCountRef = useRef(0);

  useFrame(() => {
    const camPos = camera.position;
    const maxDist = 100;
    const visible = systems.filter(sys => {
      const dx = sys.position.x - camPos.x;
      const dz = sys.position.y - camPos.z;
      const dy = systemYOffset(sys) - camPos.y;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) < maxDist;
    });
    // Only update state when visible set changes
    if (visible.length !== prevCountRef.current) {
      prevCountRef.current = visible.length;
      setVisibleSystems(visible);
    }
  });

  return (
    <group>
      {visibleSystems.map(sys => {
        const yOffset = systemYOffset(sys);
        const scale = (STAR_SCALE[sys.starType] ?? 1.0);
        return (
          <Html
            key={`label-${sys.id}`}
            position={[sys.position.x, yOffset + scale * 2.5 + 1.5, sys.position.y]}
            center
            distanceFactor={30}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: sys.ownerId
                ? getEmpireColour(sys.ownerId, playerEmpireId)
                : '#8899bb',
              textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              opacity: 0.85,
              userSelect: 'none',
            }}>
              {sys.name}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

// ── Camera controller with focus-on-star support ────────────────────────────

function GalaxyCamera({ focusTarget, galaxyCentre }: {
  focusTarget: [number, number, number] | null;
  galaxyCentre: [number, number, number];
}) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    // Initial camera position: above and slightly behind the galaxy centre
    controlsRef.current.setLookAt(
      galaxyCentre[0], 120, galaxyCentre[2] + 60,
      galaxyCentre[0], 0, galaxyCentre[2],
      false // no transition for initial setup
    );
  }, [galaxyCentre]);

  useEffect(() => {
    if (!controlsRef.current || !focusTarget) return;
    controlsRef.current.setLookAt(
      focusTarget[0], 30, focusTarget[2] + 15,
      focusTarget[0], 0, focusTarget[2],
      true // smooth transition
    );
  }, [focusTarget]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={8}
      maxDistance={250}
      smoothTime={0.35}
      draggingSmoothTime={0.15}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
}

// ── Post-processing stack ───────────────────────────────────────────────────

function PostFX() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.2}
        luminanceThreshold={1}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  );
}

// ── Tooltip overlay (HTML, positioned outside Canvas) ───────────────────────

interface TooltipInfo {
  system: StarSystem;
  screenX: number;
  screenY: number;
}

function StarTooltip({ info }: { info: TooltipInfo }) {
  const { system, screenX, screenY } = info;
  const planets = system.planets.length;
  const habitable = system.planets.filter((p: Planet) =>
    ['terran', 'ocean', 'desert', 'tundra', 'jungle', 'savanna', 'steppe', 'alpine', 'continental', 'tropical', 'arid', 'arctic', 'swamp', 'mesa'].includes(p.type)
  ).length;

  return (
    <div style={{
      position: 'absolute',
      left: screenX,
      top: screenY - 60,
      transform: 'translateX(-50%)',
      pointerEvents: 'none',
      background: 'rgba(0, 8, 20, 0.85)',
      border: '1px solid rgba(68, 136, 255, 0.4)',
      borderRadius: 4,
      padding: '6px 10px',
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#ccddff',
      whiteSpace: 'nowrap',
      zIndex: 1000,
    }}>
      <div style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: 2 }}>{system.name}</div>
      <div style={{ color: '#8899bb', fontSize: 11 }}>
        {system.starType.replace('_', ' ')} &middot; {planets} planet{planets !== 1 ? 's' : ''}
        {habitable > 0 && <span style={{ color: '#44cc88' }}> &middot; {habitable} habitable</span>}
      </div>
      {system.ownerId && (
        <div style={{ color: '#ffaa44', fontSize: 11, marginTop: 2 }}>Colonised</div>
      )}
    </div>
  );
}

// ── Main GalaxyMap3D component ──────────────────────────────────────────────

interface GalaxyMap3DProps {
  galaxy: Galaxy;
  playerEmpireId?: string;
  onSystemSelected?: (system: StarSystem) => void;
  onClose?: () => void;
}

export function GalaxyMap3D({ galaxy, playerEmpireId, onSystemSelected, onClose }: GalaxyMap3DProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [viewingSystem, setViewingSystem] = useState<StarSystem | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const lastClickIdRef = useRef<string | null>(null);

  const systemMap = useMemo(() => {
    const map = new Map<string, StarSystem>();
    galaxy.systems.forEach((s: StarSystem) => map.set(s.id, s));
    return map;
  }, [galaxy]);

  const galaxyCentre = useMemo<[number, number, number]>(() => {
    const meta = galaxy.shapeMetadata;
    if (meta && 'centreX' in meta) {
      return [meta.centreX, 0, meta.centreY];
    }
    return [galaxy.width / 2, 0, galaxy.height / 2];
  }, [galaxy]);

  const focusTarget = useMemo<[number, number, number] | null>(() => {
    if (!selectedId) return null;
    const sys = systemMap.get(selectedId);
    if (!sys) return null;
    const yOffset = systemYOffset(sys);
    return [sys.position.x, yOffset, sys.position.y];
  }, [selectedId, systemMap]);

  const handleStarClick = useCallback((systemId: string) => {
    const now = Date.now();
    const isDoubleClick = (now - lastClickTimeRef.current < 400) && (lastClickIdRef.current === systemId);
    lastClickTimeRef.current = now;
    lastClickIdRef.current = systemId;

    if (isDoubleClick) {
      // Double-click: enter system view
      const sys = systemMap.get(systemId);
      if (sys) setViewingSystem(sys);
      return;
    }

    setSelectedId(systemId);
    const sys = systemMap.get(systemId);
    if (sys && onSystemSelected) {
      onSystemSelected(sys);
    }
  }, [systemMap, onSystemSelected]);

  const handleStarHover = useCallback((systemId: string | null, screenPos?: { x: number; y: number }) => {
    if (!systemId || !screenPos) {
      setTooltipInfo(null);
      return;
    }
    const sys = systemMap.get(systemId);
    if (sys) {
      setTooltipInfo({ system: sys, screenX: screenPos.x, screenY: screenPos.y });
    }
  }, [systemMap]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 900, pointerEvents: 'auto' }}>
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 1001,
            background: 'rgba(0, 8, 20, 0.8)', border: '1px solid #4488ff',
            color: '#ccddff', fontFamily: 'monospace', fontSize: 13,
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
          }}
        >
          Close 3D View
        </button>
      )}

      {/* Title */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 1001,
        color: '#4488ff', fontFamily: 'monospace', fontSize: 14, opacity: 0.7,
      }}>
        Ex Nihilo &mdash; Galaxy Map
      </div>

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 1001,
        color: '#556688', fontFamily: 'monospace', fontSize: 11,
      }}>
        Drag to orbit &middot; Scroll to zoom &middot; Click star to select &middot; Right-drag to pan
      </div>

      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [500, 120, 560], fov: 50, near: 0.5, far: 2000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#020208']} />

        {/* Ambient light for non-emissive elements */}
        <ambientLight intensity={0.05} />

        {/* Background starfield */}
        <BackgroundStarfield count={6000} />

        {/* Ambient cosmic dust particles */}
        <AmbientParticles galaxy={galaxy} />

        {/* Nebula clouds */}
        <NebulaClouds galaxy={galaxy} />

        {/* Dust lanes along spiral arms */}
        <DustLanes galaxy={galaxy} />

        {/* Galactic centre glow */}
        <GalacticCentreGlow galaxy={galaxy} />

        {/* Wormhole connections with energy pulse */}
        <Hyperlanes systems={galaxy.systems} />

        {/* Empire ownership rings */}
        <EmpireRings systems={galaxy.systems} playerEmpireId={playerEmpireId} />

        {/* Star glow spheres (Fresnel volumetric) */}
        <StarGlows systems={galaxy.systems} />

        {/* Interactive star cores */}
        <StarCores
          systems={galaxy.systems}
          onStarClick={handleStarClick}
          onStarHover={handleStarHover}
        />

        {/* Selection ring */}
        {focusTarget && <SelectionRing position={focusTarget} />}

        {/* System name labels (distance-culled) */}
        <SystemLabels systems={galaxy.systems} playerEmpireId={playerEmpireId} />

        {/* Camera controls */}
        <GalaxyCamera focusTarget={focusTarget} galaxyCentre={galaxyCentre} />

        {/* Post-processing */}
        <PostFX />
      </Canvas>

      {/* HTML tooltip overlay */}
      {tooltipInfo && <StarTooltip info={tooltipInfo} />}

      {/* 3D System View overlay (entered via double-click on a star) */}
      {viewingSystem && (
        <SystemView3D
          system={viewingSystem}
          playerEmpireId={playerEmpireId}
          onPlanetSelected={(planet) => {
            const game = (window as any).__EX_NIHILO_GAME__;
            if (game?.events) game.events.emit('planet:selected', planet);
          }}
          onClose={() => setViewingSystem(null)}
        />
      )}
    </div>
  );
}
