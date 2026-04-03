/**
 * SystemView3D -- React Three Fiber star system interior view.
 *
 * Renders a single star system in 3D: central star, orbiting planets with
 * procedural surface shaders, asteroid belt, orbit rings, planet labels,
 * and post-processing bloom/vignette.  Full-screen overlay matching the
 * GalaxyMap3D pattern.
 */
import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { StarSystem, Planet, PlanetType, PlanetSize, StarType } from '@nova-imperia/shared';

// ── Star visual properties (shared with GalaxyMap3D) ────────────────────────

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

// ── Planet size scale mapping ────────────────────────────────────────────────

const PLANET_SIZE_SCALE: Record<PlanetSize, number> = {
  tiny:          0.3,
  very_small:    0.45,
  small:         0.6,
  below_average: 0.75,
  average:       0.9,
  above_average: 1.05,
  large:         1.2,
  very_large:    1.5,
  gigantic:      1.75,
  colossal:      2.0,
};

/** Fallback scale by planet type when size tier is missing (old saves). */
const PLANET_TYPE_SCALE: Record<PlanetType, number> = {
  terran:    0.9,
  ocean:     0.85,
  desert:    0.8,
  ice:       0.75,
  volcanic:  0.8,
  gas_giant: 1.8,
  barren:    0.65,
  toxic:     0.7,
};

function getPlanetScale(planet: Planet): number {
  if (planet.size) return PLANET_SIZE_SCALE[planet.size] ?? 0.9;
  return PLANET_TYPE_SCALE[planet.type] ?? 0.9;
}

// ── Planet colour palettes (shader categories) ──────────────────────────────

type ShaderCategory = 'habitable' | 'arid' | 'frozen' | 'hostile' | 'gas_giant' | 'rocky' | 'water';

function getShaderCategory(type: PlanetType): ShaderCategory {
  switch (type) {
    case 'terran': return 'habitable';
    case 'ocean': return 'water';
    case 'desert': return 'arid';
    case 'ice': return 'frozen';
    case 'volcanic': return 'hostile';
    case 'gas_giant': return 'gas_giant';
    case 'barren': return 'rocky';
    case 'toxic': return 'hostile';
    default: return 'rocky';
  }
}

/** Primary and secondary colours for each shader category. */
const PLANET_PALETTES: Record<ShaderCategory, {
  primary: [number, number, number];
  secondary: [number, number, number];
  atmosphere: [number, number, number];
  atmosphereAlpha: number;
}> = {
  habitable: {
    primary:   [0.10, 0.38, 0.65],
    secondary: [0.23, 0.48, 0.23],
    atmosphere: [0.33, 0.60, 1.0],
    atmosphereAlpha: 0.35,
  },
  arid: {
    primary:   [0.78, 0.60, 0.31],
    secondary: [0.60, 0.41, 0.19],
    atmosphere: [0.87, 0.67, 0.40],
    atmosphereAlpha: 0.15,
  },
  frozen: {
    primary:   [0.78, 0.91, 0.97],
    secondary: [0.40, 0.60, 0.80],
    atmosphere: [0.55, 0.75, 1.0],
    atmosphereAlpha: 0.25,
  },
  hostile: {
    primary:   [0.10, 0.07, 0.03],
    secondary: [1.0, 0.27, 0.0],
    atmosphere: [1.0, 0.35, 0.10],
    atmosphereAlpha: 0.30,
  },
  gas_giant: {
    primary:   [0.72, 0.58, 0.38],
    secondary: [0.55, 0.35, 0.20],
    atmosphere: [0.65, 0.55, 0.40],
    atmosphereAlpha: 0.40,
  },
  rocky: {
    primary:   [0.45, 0.42, 0.40],
    secondary: [0.30, 0.28, 0.26],
    atmosphere: [0.50, 0.50, 0.50],
    atmosphereAlpha: 0.05,
  },
  water: {
    primary:   [0.05, 0.25, 0.48],
    secondary: [0.10, 0.42, 0.70],
    atmosphere: [0.30, 0.55, 1.0],
    atmosphereAlpha: 0.35,
  },
};

// ── Orbit layout constants ──────────────────────────────────────────────────

const ORBIT_BASE_RADIUS = 8;
const ORBIT_STEP = 5;
const ASTEROID_BELT_INNER_INDEX = 2;
const ASTEROID_BELT_OUTER_INDEX = 3;

// ── Planet type labels ──────────────────────────────────────────────────────

const PLANET_LABELS: Record<PlanetType, string> = {
  terran:    'Terran',
  ocean:     'Ocean',
  desert:    'Desert',
  ice:       'Ice',
  volcanic:  'Volcanic',
  gas_giant: 'Gas Giant',
  barren:    'Barren',
  toxic:     'Toxic',
};

// ── GLSL noise functions (shared) ───────────────────────────────────────────

const GLSL_NOISE = /* glsl */ `
  // Simplex-style 3D noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 5; i++) {
      val += amp * snoise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }
`;

// ── Background starfield (reused from GalaxyMap3D) ──────────────────────────

function BackgroundStarfield({ count = 4000 }: { count?: number }) {
  const { positions, sizes, colours } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 300 + Math.random() * 200;

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      siz[i] = 0.2 + Math.random() * 0.8;

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
            gl_PointSize = aSize * (200.0 / -mv.z);
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
            gl_FragColor = vec4(vColor, alpha * 0.4);
          }
        `}
      />
    </points>
  );
}

// ── Central Star ────────────────────────────────────────────────────────────

function CentralStar({ starType }: { starType: StarType }) {
  const coreRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  const [r, g, b] = STAR_COLOURS[starType];
  const emissiveStrength = STAR_EMISSIVE[starType];
  const scale = STAR_SCALE[starType];

  // Slow pulsing animation
  useFrame((state) => {
    if (coreRef.current) {
      const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
      coreRef.current.scale.setScalar(scale * pulse);
    }
    if (glowRef.current) {
      const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      glowRef.current.scale.setScalar(scale * 3.5 * pulse);
    }
  });

  const coronaUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Vector3(r, g, b) },
    uIntensity: { value: emissiveStrength },
  }), [r, g, b, emissiveStrength]);

  useFrame((state) => {
    coronaUniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      {/* Core sphere -- bright emissive */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={new THREE.Color(r * emissiveStrength, g * emissiveStrength, b * emissiveStrength)}
          toneMapped={false}
        />
      </mesh>

      {/* Outer glow -- Fresnel-based additive blend */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          uniforms={coronaUniforms}
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
            uniform vec3 uColor;
            uniform float uIntensity;
            uniform float uTime;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
              float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
              fresnel = pow(fresnel, 2.0);
              float flicker = 1.0 + sin(uTime * 2.0 + fresnel * 6.0) * 0.08;
              float alpha = fresnel * 0.6 * flicker;
              gl_FragColor = vec4(uColor * uIntensity * 0.5, alpha);
            }
          `}
        />
      </mesh>

      {/* Corona rays -- subtle animated ray effect */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 1.2, scale * 4.0, 64]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          uniforms={coronaUniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uIntensity;
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              float dist = length(vUv - 0.5) * 2.0;
              float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
              // Rotating ray pattern
              float rays = pow(abs(sin(angle * 6.0 + uTime * 0.3)), 8.0);
              rays += pow(abs(sin(angle * 10.0 - uTime * 0.2)), 12.0) * 0.5;
              float falloff = 1.0 - smoothstep(0.0, 0.5, dist);
              falloff = pow(falloff, 3.0);
              float alpha = rays * falloff * 0.12;
              gl_FragColor = vec4(uColor * uIntensity * 0.3, alpha);
            }
          `}
        />
      </mesh>

      {/* Point light illuminating planets */}
      <pointLight
        color={new THREE.Color(r, g, b)}
        intensity={emissiveStrength * 8}
        distance={100}
        decay={1.5}
      />
    </group>
  );
}

// ── Planet Surface Shader ───────────────────────────────────────────────────

function PlanetSphere({ planet, radius }: { planet: Planet; radius: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const category = getShaderCategory(planet.type);
  const palette = PLANET_PALETTES[category];

  // Hash planet ID to a stable seed for noise offset
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < planet.id.length; i++) {
      h = (h * 31 + planet.id.charCodeAt(i)) | 0;
    }
    return (h & 0x7fffffff) / 0x7fffffff;
  }, [planet.id]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSeed: { value: seed * 100.0 },
    uPrimary: { value: new THREE.Vector3(...palette.primary) },
    uSecondary: { value: new THREE.Vector3(...palette.secondary) },
    uCategory: { value: ['habitable', 'arid', 'frozen', 'hostile', 'gas_giant', 'rocky', 'water'].indexOf(category) },
  }), [seed, palette, category]);

  // Slow axial rotation
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
    }
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 48, 48]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vPosition;
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          ${GLSL_NOISE}

          uniform float uTime;
          uniform float uSeed;
          uniform vec3 uPrimary;
          uniform vec3 uSecondary;
          uniform int uCategory;
          varying vec3 vNormal;
          varying vec3 vPosition;
          varying vec2 vUv;
          varying vec3 vWorldNormal;

          void main() {
            vec3 p = vPosition * 2.0 + uSeed;
            float n = fbm(p);

            vec3 col;

            if (uCategory == 0) {
              // Habitable: ocean base + landmass noise
              float land = smoothstep(-0.05, 0.15, n);
              col = mix(uPrimary, uSecondary, land);
              // Cloud wisps
              float clouds = smoothstep(0.2, 0.5, fbm(p * 3.0 + uTime * 0.02));
              col = mix(col, vec3(1.0), clouds * 0.25);
            } else if (uCategory == 1) {
              // Arid: sandy with darker ridges
              float ridges = smoothstep(-0.1, 0.3, n);
              col = mix(uPrimary, uSecondary, ridges);
              // Dust variation
              float dust = fbm(p * 4.0) * 0.15;
              col += dust;
            } else if (uCategory == 2) {
              // Frozen: white-blue with crack patterns
              col = mix(uPrimary, uSecondary, smoothstep(-0.2, 0.2, n));
              // Ice fractures
              float crack = abs(snoise(p * 8.0));
              crack = smoothstep(0.0, 0.05, crack);
              col *= 0.85 + crack * 0.15;
            } else if (uCategory == 3) {
              // Hostile: dark base with glowing fissures
              float fissure = 1.0 - smoothstep(0.0, 0.08, abs(n));
              col = mix(uPrimary, uSecondary, fissure);
              // Emissive glow on fissures
              col += uSecondary * fissure * 1.5;
            } else if (uCategory == 4) {
              // Gas giant: horizontal banding
              float bands = sin(vUv.y * 30.0 + n * 3.0) * 0.5 + 0.5;
              col = mix(uPrimary, uSecondary, bands);
              // Storm spots
              float storm = smoothstep(0.6, 0.8, fbm(p * 2.0 + vec3(0.0, uTime * 0.01, 0.0)));
              col = mix(col, uSecondary * 0.6, storm * 0.4);
            } else if (uCategory == 5) {
              // Rocky: grey with craters
              col = mix(uPrimary, uSecondary, smoothstep(-0.3, 0.3, n));
              // Crater rims
              float crater = smoothstep(0.4, 0.5, fbm(p * 6.0));
              col = mix(col, uPrimary * 0.7, crater * 0.3);
            } else {
              // Water: deep blue with specular-like highlights
              float waves = fbm(p * 4.0 + uTime * 0.03);
              col = mix(uPrimary, uSecondary, smoothstep(-0.2, 0.2, waves));
              // Ice caps at poles
              float pole = abs(vUv.y - 0.5) * 2.0;
              float ice = smoothstep(0.85, 0.95, pole);
              col = mix(col, vec3(0.92, 0.95, 1.0), ice);
            }

            // Simple diffuse lighting from star at origin
            vec3 lightDir = normalize(-vPosition);
            float diff = max(dot(vWorldNormal, lightDir), 0.0);
            // Ambient + diffuse
            col *= 0.15 + diff * 0.85;

            // Terminator softening
            float terminator = smoothstep(-0.05, 0.15, diff);
            col *= terminator * 0.5 + 0.5;

            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// ── Planet Atmosphere Shell ──────────────────────────────────────────────────

function PlanetAtmosphere({ planet, radius }: { planet: Planet; radius: number }) {
  const category = getShaderCategory(planet.type);
  const palette = PLANET_PALETTES[category];
  if (palette.atmosphereAlpha < 0.05) return null;

  const uniforms = useMemo(() => ({
    uAtmColor: { value: new THREE.Vector3(...palette.atmosphere) },
    uAlpha: { value: palette.atmosphereAlpha },
  }), [palette]);

  return (
    <mesh>
      <sphereGeometry args={[radius * 1.08, 32, 32]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vViewDir;
          varying vec3 vWorldPos;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPos.xyz);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * mvPos;
          }
        `}
        fragmentShader={`
          uniform vec3 uAtmColor;
          uniform float uAlpha;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          varying vec3 vWorldPos;
          void main() {
            float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
            fresnel = pow(fresnel, 3.0);

            // Darken atmosphere on the shadow side
            vec3 lightDir = normalize(-vWorldPos);
            vec3 worldNormal = normalize(vWorldPos);
            float lit = max(dot(worldNormal, lightDir), 0.0);
            float shadow = smoothstep(-0.1, 0.3, lit);

            float alpha = fresnel * uAlpha * (0.3 + shadow * 0.7);
            gl_FragColor = vec4(uAtmColor, alpha);
          }
        `}
      />
    </mesh>
  );
}

// ── Orbit Ring ──────────────────────────────────────────────────────────────

function OrbitRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius + 0.02, 128]} />
      <meshBasicMaterial
        color="#334466"
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Single Orbiting Planet ──────────────────────────────────────────────────

interface OrbitingPlanetProps {
  planet: Planet;
  orbitIndex: number;
  totalPlanets: number;
  onSelect?: (planet: Planet) => void;
  isSelected: boolean;
}

function OrbitingPlanet({ planet, orbitIndex, totalPlanets, onSelect, isSelected }: OrbitingPlanetProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const orbitRadius = ORBIT_BASE_RADIUS + orbitIndex * ORBIT_STEP;
  const planetScale = getPlanetScale(planet);
  const planetRadius = planetScale * 0.6;

  // Deterministic start angle spread across orbits
  const startAngle = (orbitIndex / Math.max(totalPlanets, 1)) * Math.PI * 2;
  // Kepler-ish: further planets orbit slower
  const baseSpeed = 0.06;
  const speed = baseSpeed / Math.pow(orbitRadius / ORBIT_BASE_RADIUS, 1.2);

  useFrame((state) => {
    if (groupRef.current) {
      const angle = startAngle + state.clock.elapsedTime * speed;
      groupRef.current.position.x = Math.cos(angle) * orbitRadius;
      groupRef.current.position.z = Math.sin(angle) * orbitRadius;
    }
  });

  return (
    <>
      <OrbitRing radius={orbitRadius} />
      <group ref={groupRef}>
        {/* Planet body + atmosphere */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(planet);
          }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'default'; }}
        >
          <PlanetSphere planet={planet} radius={planetRadius} />
          <PlanetAtmosphere planet={planet} radius={planetRadius} />

          {/* Selection highlight ring */}
          {isSelected && (
            <SelectionRing radius={planetRadius} />
          )}

          {/* Colonised indicator ring */}
          {planet.ownerId && (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[planetRadius + 0.15, planetRadius + 0.22, 48]} />
              <meshBasicMaterial
                color={[2, 3, 4]}
                toneMapped={false}
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>

        {/* Planet label (HTML overlay) */}
        <Html
          position={[0, planetRadius + 0.6, 0]}
          center
          distanceFactor={15}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div style={{
            background: 'rgba(0, 8, 20, 0.8)',
            border: '1px solid rgba(68, 136, 255, 0.3)',
            borderRadius: 3,
            padding: '3px 8px',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#ccddff',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            userSelect: 'none',
          }}>
            <div style={{ fontWeight: 'bold', color: '#fff', fontSize: 11 }}>
              {planet.name}
            </div>
            <div style={{ color: '#8899bb', fontSize: 9 }}>
              {PLANET_LABELS[planet.type]}
              {planet.size ? ` \u00b7 ${planet.size.replace('_', ' ')}` : ''}
            </div>
            {planet.ownerId && (
              <div style={{ color: '#44cc88', fontSize: 9, marginTop: 1 }}>Colonised</div>
            )}
            {!planet.ownerId && planet.maxPopulation > 0 && (
              <div style={{ color: '#7799bb', fontSize: 9, marginTop: 1 }}>Uncolonised</div>
            )}
          </div>
        </Html>
      </group>
    </>
  );
}

// ── Selection ring for planets ──────────────────────────────────────────────

function SelectionRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (ref.current) {
      const s = 1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius + 0.3, radius + 0.45, 48]} />
      <meshBasicMaterial
        color={[3, 3, 3]}
        toneMapped={false}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Asteroid Belt (instanced) ───────────────────────────────────────────────

function AsteroidBelt({ innerOrbitIndex, outerOrbitIndex }: {
  innerOrbitIndex: number;
  outerOrbitIndex: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const count = 200;

  const innerR = ORBIT_BASE_RADIUS + innerOrbitIndex * ORBIT_STEP + 0.5;
  const outerR = ORBIT_BASE_RADIUS + outerOrbitIndex * ORBIT_STEP - 0.5;

  // Pre-compute asteroid transforms
  const { matrices, rotSpeeds } = useMemo(() => {
    const mats = new Float32Array(count * 16);
    const speeds = new Float32Array(count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = innerR + Math.random() * (outerR - innerR);
      const yOff = (Math.random() - 0.5) * 0.4;

      dummy.position.set(
        Math.cos(angle) * dist,
        yOff,
        Math.sin(angle) * dist,
      );

      const s = 0.05 + Math.random() * 0.12;
      dummy.scale.set(
        s * (0.6 + Math.random() * 0.8),
        s * (0.5 + Math.random() * 0.5),
        s * (0.6 + Math.random() * 0.8),
      );

      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );

      dummy.updateMatrix();
      dummy.matrix.toArray(mats, i * 16);

      // Orbital speed -- scaled inversely with distance
      speeds[i] = 0.01 + Math.random() * 0.015;
    }

    return { matrices: mats, rotSpeeds: speeds };
  }, [innerR, outerR, count]);

  // Store original angles for orbit animation
  const anglesRef = useRef<Float32Array>(null!);
  const distsRef = useRef<Float32Array>(null!);
  const yOffsRef = useRef<Float32Array>(null!);

  useEffect(() => {
    if (!meshRef.current) return;

    const angles = new Float32Array(count);
    const dists = new Float32Array(count);
    const yOffs = new Float32Array(count);
    const dummy = new THREE.Object3D();
    const mat = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      mat.fromArray(matrices, i * 16);
      dummy.matrix.copy(mat);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      angles[i] = Math.atan2(dummy.position.z, dummy.position.x);
      dists[i] = Math.sqrt(dummy.position.x ** 2 + dummy.position.z ** 2);
      yOffs[i] = dummy.position.y;

      meshRef.current.setMatrixAt(i, mat);
    }

    anglesRef.current = angles;
    distsRef.current = dists;
    yOffsRef.current = yOffs;

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices, count]);

  // Animate orbital drift
  useFrame((_, delta) => {
    if (!meshRef.current || !anglesRef.current) return;

    const dummy = new THREE.Object3D();
    const mat = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      anglesRef.current[i] += rotSpeeds[i] * delta;
      const a = anglesRef.current[i];
      const d = distsRef.current[i];

      meshRef.current.getMatrixAt(i, mat);
      dummy.matrix.copy(mat);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      dummy.position.x = Math.cos(a) * d;
      dummy.position.z = Math.sin(a) * d;
      dummy.position.y = yOffsRef.current[i];

      // Slow tumble
      dummy.rotation.x += delta * 0.3;
      dummy.rotation.z += delta * 0.2;

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} raycast={() => null}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#888888"
        roughness={0.9}
        metalness={0.1}
      />
    </instancedMesh>
  );
}

// ── Camera controller ───────────────────────────────────────────────────────

function SystemCamera({ focusTarget }: { focusTarget: [number, number, number] | null }) {
  const controlsRef = useRef<any>(null);

  // Initial setup -- look at the star from above and to the side
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.setLookAt(
      15, 25, 25,  // camera position
      0, 0, 0,     // look at star
      false,
    );
  }, []);

  // Smooth transition to focus target (planet)
  useEffect(() => {
    if (!controlsRef.current || !focusTarget) return;
    const [tx, ty, tz] = focusTarget;
    controlsRef.current.setLookAt(
      tx + 3, ty + 4, tz + 5,
      tx, ty, tz,
      true,
    );
  }, [focusTarget]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={3}
      maxDistance={80}
      smoothTime={0.35}
      draggingSmoothTime={0.15}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

// ── Post-processing ─────────────────────────────────────────────────────────

function PostFX() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.5}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  );
}

// ── Main SystemView3D component ─────────────────────────────────────────────

export interface SystemView3DProps {
  system: StarSystem;
  playerEmpireId?: string;
  /** Pre-select and focus on this planet when the view opens. */
  initialPlanetId?: string | null;
  onPlanetSelected?: (planet: Planet) => void;
  onClose?: () => void;
}

export function SystemView3D({ system, playerEmpireId, initialPlanetId, onPlanetSelected, onClose }: SystemView3DProps) {
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(initialPlanetId ?? null);

  const sortedPlanets = useMemo(
    () => [...system.planets].sort((a, b) => a.orbitalIndex - b.orbitalIndex),
    [system.planets],
  );

  // Compute the focus target when a planet is selected
  const focusTarget = useMemo<[number, number, number] | null>(() => {
    if (!selectedPlanetId) return null;
    const idx = sortedPlanets.findIndex(p => p.id === selectedPlanetId);
    if (idx < 0) return null;
    // Return a point on the orbit -- camera will track it
    const orbitRadius = ORBIT_BASE_RADIUS + idx * ORBIT_STEP;
    // Use a static angle for the camera target (planet moves, camera follows general area)
    return [orbitRadius * 0.7, 0, orbitRadius * 0.7];
  }, [selectedPlanetId, sortedPlanets]);

  const handlePlanetSelect = useCallback((planet: Planet) => {
    setSelectedPlanetId(planet.id);
    onPlanetSelected?.(planet);
  }, [onPlanetSelected]);

  // Determine whether to show the asteroid belt
  const showAsteroidBelt = sortedPlanets.length > ASTEROID_BELT_OUTER_INDEX;

  // Count habitable planets for the HUD
  const habitableTypes: PlanetType[] = ['terran', 'ocean', 'desert', 'ice'];
  const habitableCount = sortedPlanets.filter(p => habitableTypes.includes(p.type)).length;
  const colonisedCount = sortedPlanets.filter(p => p.ownerId != null).length;

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
          Back to Galaxy
        </button>
      )}

      {/* System name + star type header */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 1001,
        fontFamily: 'monospace', pointerEvents: 'none',
      }}>
        <div style={{ color: '#d4af6a', fontSize: 22, fontWeight: 'bold' }}>
          {system.name}
        </div>
        <div style={{ color: '#7799bb', fontSize: 12, letterSpacing: 2, marginTop: 2 }}>
          {system.starType.replace('_', ' ').toUpperCase()}
        </div>
        <div style={{ color: '#556688', fontSize: 11, marginTop: 6 }}>
          {sortedPlanets.length} planet{sortedPlanets.length !== 1 ? 's' : ''}
          {habitableCount > 0 && (
            <span style={{ color: '#44cc88' }}> &middot; {habitableCount} habitable</span>
          )}
          {colonisedCount > 0 && (
            <span style={{ color: '#00d4ff' }}> &middot; {colonisedCount} colonised</span>
          )}
        </div>
      </div>

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 1001,
        color: '#556688', fontFamily: 'monospace', fontSize: 11,
        pointerEvents: 'none',
      }}>
        Drag to orbit &middot; Scroll to zoom &middot; Click planet to select &middot; Right-drag to pan
      </div>

      {/* Selected planet info panel */}
      {selectedPlanetId && (() => {
        const planet = sortedPlanets.find(p => p.id === selectedPlanetId);
        if (!planet) return null;
        return (
          <div style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 1001,
            background: 'rgba(0, 8, 20, 0.85)',
            border: '1px solid rgba(68, 136, 255, 0.4)',
            borderRadius: 4,
            padding: '10px 14px',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#ccddff',
            minWidth: 180,
          }}>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
              {planet.name}
            </div>
            <div style={{ color: '#8899bb', fontSize: 11 }}>
              {PLANET_LABELS[planet.type]}
              {planet.size && ` \u00b7 ${planet.size.replace('_', ' ')}`}
            </div>
            <div style={{ color: '#667799', fontSize: 10, marginTop: 4 }}>
              Gravity: {planet.gravity.toFixed(1)}g
              &nbsp;&middot;&nbsp;
              Temp: {planet.temperature}K
            </div>
            <div style={{ color: '#667799', fontSize: 10, marginTop: 2 }}>
              Resources: {planet.naturalResources}
              {planet.fertility != null && ` \u00b7 Fertility: ${planet.fertility}`}
              {planet.beauty != null && ` \u00b7 Beauty: ${planet.beauty}`}
            </div>
            {planet.ownerId && (
              <div style={{ color: '#44cc88', fontSize: 11, marginTop: 4 }}>
                Colonised &middot; Pop: {planet.currentPopulation.toLocaleString()} / {planet.maxPopulation.toLocaleString()}
              </div>
            )}
            {!planet.ownerId && planet.maxPopulation > 0 && (
              <div style={{ color: '#7799bb', fontSize: 11, marginTop: 4 }}>
                Uncolonised &middot; Max pop: {planet.maxPopulation.toLocaleString()}
              </div>
            )}
            {planet.modifiers && planet.modifiers.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {planet.modifiers.map((mod, i) => (
                  <div key={i} style={{
                    fontSize: 10,
                    color: mod.effect === 'positive' ? '#44cc88'
                      : mod.effect === 'negative' ? '#cc4444'
                      : '#8899bb',
                  }}>
                    {mod.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [15, 25, 25], fov: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => setSelectedPlanetId(null)}
      >
        <color attach="background" args={['#020208']} />

        {/* Minimal ambient so shadowed sides aren't pure black */}
        <ambientLight intensity={0.04} />

        {/* Background stars */}
        <BackgroundStarfield count={4000} />

        {/* Central star */}
        <CentralStar starType={system.starType} />

        {/* Asteroid belt */}
        {showAsteroidBelt && (
          <AsteroidBelt
            innerOrbitIndex={ASTEROID_BELT_INNER_INDEX}
            outerOrbitIndex={ASTEROID_BELT_OUTER_INDEX}
          />
        )}

        {/* Orbiting planets */}
        {sortedPlanets.map((planet, idx) => (
          <OrbitingPlanet
            key={planet.id}
            planet={planet}
            orbitIndex={idx}
            totalPlanets={sortedPlanets.length}
            onSelect={handlePlanetSelect}
            isSelected={planet.id === selectedPlanetId}
          />
        ))}

        {/* Camera */}
        <SystemCamera focusTarget={focusTarget} />

        {/* Post-processing */}
        <PostFX />
      </Canvas>
    </div>
  );
}
