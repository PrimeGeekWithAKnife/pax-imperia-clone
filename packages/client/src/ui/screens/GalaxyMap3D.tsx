/**
 * GalaxyMap3D — React Three Fiber proof-of-concept galaxy map renderer.
 *
 * A standalone 3D replacement for the Phaser GalaxyMapScene.
 * Renders the galaxy as a navigable 3D scene with bloom, nebulae,
 * instanced stars, wormhole connections, and interactive selection.
 */
import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Galaxy, StarSystem, StarType, SpiralGalaxyMetadata } from '@nova-imperia/shared';

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

// ── Nebula clouds (sprite-based, placed along spiral arms) ──────────────────

const NEBULA_PALETTE = [
  '#1a2266', '#2244aa', '#6622aa', '#aa2255',
  '#223388', '#553399', '#882244', '#114466',
];

function NebulaClouds({ galaxy }: { galaxy: Galaxy }) {
  const clouds = useMemo(() => {
    const result: Array<{ x: number; z: number; colour: string; scale: number; rotSpeed: number }> = [];
    const meta = galaxy.shapeMetadata;

    if (meta?.shape === 'spiral') {
      const spiral = meta as SpiralGalaxyMetadata;
      const cx = spiral.centreX;
      const cy = spiral.centreY;
      // Place clouds along spiral arms
      for (let arm = 0; arm < spiral.armCount; arm++) {
        const baseAngle = spiral.armAngles[arm] ?? (arm * Math.PI * 2) / spiral.armCount;
        for (let t = 0.15; t < 1.0; t += 0.08 + Math.random() * 0.06) {
          const angle = baseAngle + t * spiral.spiralTightness;
          const radius = spiral.spiralA + t * (galaxy.width * 0.45);
          const jitter = (Math.random() - 0.5) * 60;
          const x = cx + Math.cos(angle) * radius + jitter;
          const z = cy + Math.sin(angle) * radius + jitter;
          result.push({
            x, z,
            colour: NEBULA_PALETTE[Math.floor(Math.random() * NEBULA_PALETTE.length)],
            scale: 40 + Math.random() * 80,
            rotSpeed: (Math.random() - 0.5) * 0.03,
          });
        }
      }
      // Central bulge cloud
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * galaxy.width * spiral.bulgeRadiusFraction * 0.3;
        result.push({
          x: cx + Math.cos(angle) * dist,
          z: cy + Math.sin(angle) * dist,
          colour: NEBULA_PALETTE[Math.floor(Math.random() * 3)],
          scale: 50 + Math.random() * 60,
          rotSpeed: (Math.random() - 0.5) * 0.02,
        });
      }
    } else {
      // Non-spiral: scatter clouds loosely around star systems
      const cx = galaxy.width / 2;
      const cy = galaxy.height / 2;
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * galaxy.width * 0.4;
        result.push({
          x: cx + Math.cos(angle) * dist,
          z: cy + Math.sin(angle) * dist,
          colour: NEBULA_PALETTE[Math.floor(Math.random() * NEBULA_PALETTE.length)],
          scale: 40 + Math.random() * 70,
          rotSpeed: (Math.random() - 0.5) * 0.02,
        });
      }
    }
    return result;
  }, [galaxy]);

  return (
    <group>
      {clouds.map((c, i) => (
        <NebulaSprite key={i} x={c.x} z={c.z} colour={c.colour} scale={c.scale} rotSpeed={c.rotSpeed} />
      ))}
    </group>
  );
}

function NebulaSprite({ x, z, colour, scale, rotSpeed }: {
  x: number; z: number; colour: string; scale: number; rotSpeed: number;
}) {
  const ref = useRef<THREE.Sprite>(null!);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.material.rotation += rotSpeed * delta;
    }
  });
  return (
    <sprite ref={ref} position={[x, -2, z]} scale={[scale, scale, 1]}>
      <spriteMaterial
        color={colour}
        transparent
        opacity={0.08}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

// ── Wormhole connections (single draw call for all lanes) ───────────────────

function Hyperlanes({ systems }: { systems: StarSystem[] }) {
  const geometry = useMemo(() => {
    const systemMap = new Map<string, StarSystem>();
    systems.forEach(s => systemMap.set(s.id, s));

    const verts: number[] = [];
    const seen = new Set<string>();

    for (const sys of systems) {
      for (const targetId of sys.wormholes) {
        const key = [sys.id, targetId].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const target = systemMap.get(targetId);
        if (!target) continue;
        verts.push(sys.position.x, 0, sys.position.y);
        verts.push(target.position.x, 0, target.position.y);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [systems]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3366cc" transparent opacity={0.12} />
    </lineSegments>
  );
}

// ── Star glow halos (additive blended quads, one per star) ──────────────────

function StarGlows({ systems }: { systems: StarSystem[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    systems.forEach((sys, i) => {
      const s = (STAR_SCALE[sys.starType] ?? 1.0) * 4;
      dummy.position.set(sys.position.x, 0, sys.position.y);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const [r, g, b] = STAR_COLOURS[sys.starType] ?? [1, 1, 1];
      const intensity = (STAR_EMISSIVE[sys.starType] ?? 2.0) * 0.4;
      colour.setRGB(r * intensity, g * intensity, b * intensity);
      meshRef.current.setColorAt(i, colour);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [systems, dummy, colour]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, systems.length]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        vertexShader={`
          varying vec3 vColor;
          varying vec2 vUv;
          void main() {
            vColor = instanceColor;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying vec2 vUv;
          void main() {
            vec2 centre = vUv - 0.5;
            float d = length(centre);
            float falloff = 1.0 - smoothstep(0.0, 0.5, d);
            falloff = pow(falloff, 1.5);
            gl_FragColor = vec4(vColor, falloff * 0.5);
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
      dummy.position.set(sys.position.x, 0, sys.position.y);
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

// ── System name labels (HTML overlays) ──────────────────────────────────────

function SystemLabels({ systems, playerEmpireId }: { systems: StarSystem[]; playerEmpireId?: string }) {
  const { camera } = useThree();
  const [visibleSystems, setVisibleSystems] = useState<StarSystem[]>([]);

  useFrame(() => {
    // Only show labels for nearby systems (distance-culled)
    const camPos = camera.position;
    const maxDist = 120; // world units
    const visible = systems.filter(sys => {
      const dx = sys.position.x - camPos.x;
      const dz = sys.position.y - camPos.z;
      return Math.sqrt(dx * dx + dz * dz) < maxDist;
    });
    // Only update if count changed to avoid re-renders
    if (visible.length !== visibleSystems.length) {
      setVisibleSystems(visible);
    }
  });

  return null; // Labels rendered as HTML overlay outside Canvas for performance
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
  const habitable = system.planets.filter(p =>
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
  onSystemSelected?: (system: StarSystem) => void;
  onClose?: () => void;
}

export function GalaxyMap3D({ galaxy, onSystemSelected, onClose }: GalaxyMap3DProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);

  const systemMap = useMemo(() => {
    const map = new Map<string, StarSystem>();
    galaxy.systems.forEach(s => map.set(s.id, s));
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
    return sys ? [sys.position.x, 0, sys.position.y] : null;
  }, [selectedId, systemMap]);

  const handleStarClick = useCallback((systemId: string) => {
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
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 900 }}>
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
        Ex Nihilo &mdash; Galaxy Map (R3F Proof of Concept)
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

        {/* Nebula clouds */}
        <NebulaClouds galaxy={galaxy} />

        {/* Wormhole connections */}
        <Hyperlanes systems={galaxy.systems} />

        {/* Star glow halos */}
        <StarGlows systems={galaxy.systems} />

        {/* Interactive star cores */}
        <StarCores
          systems={galaxy.systems}
          onStarClick={handleStarClick}
          onStarHover={handleStarHover}
        />

        {/* Selection ring */}
        {focusTarget && <SelectionRing position={focusTarget} />}

        {/* Camera controls */}
        <GalaxyCamera focusTarget={focusTarget} galaxyCentre={galaxyCentre} />

        {/* Post-processing */}
        <PostFX />
      </Canvas>

      {/* HTML tooltip overlay */}
      {tooltipInfo && <StarTooltip info={tooltipInfo} />}
    </div>
  );
}
