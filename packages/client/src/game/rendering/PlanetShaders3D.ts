/**
 * PlanetShaders3D — React Three Fiber procedural planet rendering components.
 *
 * Exports GPU-driven planet components with per-type surface shaders,
 * atmospheric rim glow, animated cloud layers, and gas giant ring systems.
 * All visuals are noise-based and seed-deterministic, requiring zero textures.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlanetType, AtmosphereType } from '@nova-imperia/shared';

// ── Shared GLSL noise library ────────────────────────────────────────────────

/**
 * Ashima-Arts 3D simplex noise (MIT licence).
 * Included verbatim so every shader can call snoise(vec3).
 */
const SIMPLEX_NOISE_GLSL = /* glsl */ `
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
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

/* Fractal Brownian Motion — layered noise for natural-looking terrain. */
float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
`;

// ── Common vertex shader ─────────────────────────────────────────────────────

const PLANET_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ── Per-type fragment shaders ────────────────────────────────────────────────

const TERRAN_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 2.5 + uSeed * 13.37;

  // Multi-octave terrain elevation
  float elevation = fbm(p, 5);
  elevation = elevation * 0.5 + 0.5; // remap to 0..1

  // Continental shapes — large-scale noise
  float continent = snoise(p * 0.8 + uSeed * 7.13) * 0.5 + 0.5;
  elevation = mix(elevation, continent, 0.6);

  // Sea level
  float seaLevel = 0.42;

  // Colour based on elevation
  vec3 deepOcean   = vec3(0.04, 0.12, 0.35);
  vec3 shallowSea  = vec3(0.08, 0.28, 0.52);
  vec3 beach       = vec3(0.76, 0.70, 0.50);
  vec3 lowland     = vec3(0.22, 0.48, 0.18);
  vec3 highland    = vec3(0.35, 0.32, 0.20);
  vec3 mountain    = vec3(0.55, 0.50, 0.45);
  vec3 snow        = vec3(0.92, 0.94, 0.96);

  vec3 colour;
  if (elevation < seaLevel - 0.08) {
    colour = deepOcean;
  } else if (elevation < seaLevel) {
    float t = (elevation - (seaLevel - 0.08)) / 0.08;
    colour = mix(deepOcean, shallowSea, t);
  } else if (elevation < seaLevel + 0.03) {
    float t = (elevation - seaLevel) / 0.03;
    colour = mix(shallowSea, beach, t);
  } else if (elevation < 0.58) {
    float t = (elevation - (seaLevel + 0.03)) / (0.58 - seaLevel - 0.03);
    colour = mix(lowland, highland, t);
  } else if (elevation < 0.75) {
    float t = (elevation - 0.58) / 0.17;
    colour = mix(highland, mountain, t);
  } else {
    float t = (elevation - 0.75) / 0.25;
    colour = mix(mountain, snow, clamp(t, 0.0, 1.0));
  }

  // Polar ice caps
  float latitude = abs(vPosition.y / length(vPosition));
  float iceLine = 0.78 - snoise(p * 3.0 + uSeed * 2.1) * 0.08;
  if (latitude > iceLine) {
    float iceBlend = smoothstep(iceLine, iceLine + 0.08, latitude);
    colour = mix(colour, snow, iceBlend);
  }

  // Simple diffuse lighting (sun at +z roughly)
  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.15;
  colour *= ambient + diff * 0.85;

  gl_FragColor = vec4(colour, 1.0);
}
`;

const OCEAN_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.0 + uSeed * 11.31;

  // Animated wave motion
  float wave1 = snoise(p * 2.0 + vec3(uTime * 0.05, 0.0, uTime * 0.03));
  float wave2 = snoise(p * 4.5 + vec3(0.0, uTime * 0.04, uTime * 0.06));
  float waves = wave1 * 0.5 + wave2 * 0.3;

  // Depth variation — shallow areas near noise peaks
  float depth = fbm(p * 0.8, 4) * 0.5 + 0.5;

  vec3 deepBlue   = vec3(0.02, 0.06, 0.22);
  vec3 midBlue    = vec3(0.05, 0.18, 0.45);
  vec3 shallow    = vec3(0.10, 0.42, 0.58);
  vec3 highlight  = vec3(0.35, 0.60, 0.75);

  vec3 colour = mix(deepBlue, midBlue, depth);
  colour = mix(colour, shallow, smoothstep(0.6, 0.8, depth));
  colour += highlight * smoothstep(0.3, 0.6, waves) * 0.15;

  // Small rocky islands
  float island = snoise(p * 1.2 + uSeed * 5.7) * 0.5 + 0.5;
  if (island > 0.82) {
    float t = (island - 0.82) / 0.18;
    vec3 rock = vec3(0.45, 0.40, 0.30);
    colour = mix(colour, rock, t * 0.8);
  }

  // Specular highlight
  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  vec3 viewDir = normalize(-vPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(vNormal, halfDir), 0.0), 64.0);

  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.12;
  colour *= ambient + diff * 0.88;
  colour += vec3(0.8, 0.9, 1.0) * spec * 0.4;

  gl_FragColor = vec4(colour, 1.0);
}
`;

const DESERT_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.0 + uSeed * 9.73;

  // Sand dune ridges — directional noise
  float dunes = snoise(vec3(p.x * 4.0, p.y * 1.5, p.z * 4.0) + uSeed * 3.1);
  dunes = abs(dunes); // ridge-like pattern
  dunes = pow(dunes, 0.6);

  // Large-scale terrain
  float terrain = fbm(p * 1.5, 4) * 0.5 + 0.5;

  // Canyon formations
  float canyon = snoise(p * 2.0 + uSeed * 17.3);
  canyon = 1.0 - abs(canyon);
  canyon = pow(canyon, 3.0); // sharp canyon lines

  vec3 sand       = vec3(0.82, 0.72, 0.48);
  vec3 darkSand   = vec3(0.65, 0.52, 0.32);
  vec3 redRock    = vec3(0.58, 0.30, 0.18);
  vec3 canyonCol  = vec3(0.35, 0.20, 0.12);

  vec3 colour = mix(darkSand, sand, terrain);
  colour = mix(colour, redRock, dunes * 0.4);
  colour = mix(colour, canyonCol, canyon * 0.5);

  // Occasional dry lake beds
  float lake = snoise(p * 0.6 + uSeed * 23.1) * 0.5 + 0.5;
  if (lake > 0.75) {
    float t = (lake - 0.75) / 0.25;
    vec3 dryLake = vec3(0.78, 0.76, 0.68);
    colour = mix(colour, dryLake, t * 0.6);
  }

  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.18;
  colour *= ambient + diff * 0.82;

  gl_FragColor = vec4(colour, 1.0);
}
`;

const ICE_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.0 + uSeed * 7.19;

  // Glacier patterns — stretched noise
  float glacier = fbm(vec3(p.x * 2.0, p.y * 0.8, p.z * 2.0) + uSeed * 5.3, 5);
  glacier = glacier * 0.5 + 0.5;

  // Crevasse lines
  float crevasse = snoise(p * 6.0 + uSeed * 11.7);
  crevasse = 1.0 - abs(crevasse);
  crevasse = pow(crevasse, 5.0);

  // Subsurface scattering effect — blue tint at glancing angles
  vec3 viewDir = normalize(-vPosition);
  float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
  fresnel = pow(fresnel, 2.0);

  vec3 iceWhite   = vec3(0.88, 0.92, 0.96);
  vec3 iceBlue    = vec3(0.65, 0.80, 0.92);
  vec3 deepIce    = vec3(0.35, 0.55, 0.75);
  vec3 crevCol    = vec3(0.20, 0.40, 0.65);

  vec3 colour = mix(iceWhite, iceBlue, glacier);
  colour = mix(colour, deepIce, fresnel * 0.4);
  colour = mix(colour, crevCol, crevasse * 0.6);

  // Subtle frozen ocean patches
  float frozenSea = snoise(p * 0.7 + uSeed * 19.3) * 0.5 + 0.5;
  if (frozenSea > 0.65) {
    float t = (frozenSea - 0.65) / 0.35;
    colour = mix(colour, deepIce, t * 0.3);
  }

  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);

  // Specular for icy sheen
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(vNormal, halfDir), 0.0), 48.0);

  float ambient = 0.20;
  colour *= ambient + diff * 0.80;
  colour += vec3(0.85, 0.92, 1.0) * spec * 0.35;

  gl_FragColor = vec4(colour, 1.0);
}
`;

const VOLCANIC_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.0 + uSeed * 14.51;

  // Lava crack pattern — sharp ridges from absolute noise
  float cracks = snoise(p * 4.0 + uSeed * 3.7);
  cracks = 1.0 - abs(cracks);
  cracks = pow(cracks, 4.0);

  // Pulsing magma rivers
  float pulse = sin(uTime * 1.5 + snoise(p * 2.0) * 3.0) * 0.5 + 0.5;
  cracks *= 0.6 + pulse * 0.4;

  // Secondary larger cracks
  float bigCracks = snoise(p * 1.5 + uSeed * 21.1);
  bigCracks = 1.0 - abs(bigCracks);
  bigCracks = pow(bigCracks, 3.0);

  // Terrain roughness
  float terrain = fbm(p * 2.0, 4) * 0.5 + 0.5;

  vec3 darkRock  = vec3(0.08, 0.06, 0.05);
  vec3 midRock   = vec3(0.18, 0.12, 0.10);
  vec3 hotLava   = vec3(3.5, 1.2, 0.2);  // HDR emissive
  vec3 warmLava  = vec3(2.0, 0.4, 0.05);
  vec3 cooledLava = vec3(0.30, 0.08, 0.02);

  vec3 colour = mix(darkRock, midRock, terrain);

  // Large lava flows
  float lavaGlow = bigCracks * 0.5 + cracks * 0.8;
  lavaGlow = clamp(lavaGlow, 0.0, 1.0);
  vec3 lavaCol = mix(warmLava, hotLava, lavaGlow);
  colour = mix(colour, lavaCol, lavaGlow);

  // Cooled lava ridges
  float cooled = snoise(p * 5.0 + uSeed * 8.3) * 0.5 + 0.5;
  colour = mix(colour, cooledLava, cooled * 0.2 * (1.0 - lavaGlow));

  // Simple lighting (but lava is emissive — only shade the dark rock)
  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.08;

  // Rock is shaded, lava emits its own light
  vec3 litRock = mix(darkRock, midRock, terrain) * (ambient + diff * 0.92);
  colour = mix(litRock, colour, lavaGlow);

  gl_FragColor = vec4(colour, 1.0);
}
`;

const GAS_GIANT_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vec3 p = vPosition * 2.0 + uSeed * 8.17;

  // Latitude-based banding — horizontal stripes
  float lat = vPosition.y * 8.0 + uSeed * 3.0;
  float band = sin(lat) * 0.5 + 0.5;

  // Turbulence distortion along the bands
  float turb = snoise(vec3(vPosition.x * 3.0, lat * 0.5, vPosition.z * 3.0 + uTime * 0.02)) * 0.3;
  band = band + turb;
  band = clamp(band, 0.0, 1.0);

  // Secondary finer bands
  float fineBand = sin(lat * 3.5 + snoise(p * 1.5) * 2.0) * 0.5 + 0.5;

  // Seed-dependent colour palette
  float hueShift = fract(uSeed * 0.0137);
  vec3 bandLight, bandDark, stormCol;

  if (hueShift < 0.25) {
    // Jupiter-like: tan and brown
    bandLight = vec3(0.82, 0.72, 0.55);
    bandDark  = vec3(0.55, 0.35, 0.20);
    stormCol  = vec3(0.75, 0.30, 0.15);
  } else if (hueShift < 0.5) {
    // Saturn-like: gold and cream
    bandLight = vec3(0.88, 0.80, 0.58);
    bandDark  = vec3(0.68, 0.58, 0.38);
    stormCol  = vec3(0.90, 0.75, 0.40);
  } else if (hueShift < 0.75) {
    // Neptune-like: blue tones
    bandLight = vec3(0.35, 0.55, 0.78);
    bandDark  = vec3(0.15, 0.28, 0.55);
    stormCol  = vec3(0.20, 0.40, 0.70);
  } else {
    // Purple gas giant
    bandLight = vec3(0.55, 0.40, 0.65);
    bandDark  = vec3(0.30, 0.18, 0.42);
    stormCol  = vec3(0.65, 0.25, 0.55);
  }

  vec3 colour = mix(bandDark, bandLight, band);
  colour = mix(colour, mix(bandDark, bandLight, 0.7), fineBand * 0.3);

  // Great Storm feature (like Jupiter's Red Spot)
  vec2 stormCentre = vec2(
    sin(uSeed * 2.71) * 0.4,
    cos(uSeed * 1.93) * 0.3
  );
  float stormDist = length(vec2(vPosition.x - stormCentre.x, (vPosition.y - stormCentre.y) * 2.0));
  float storm = 1.0 - smoothstep(0.0, 0.25, stormDist);

  // Swirling storm detail
  float swirl = snoise(vec3(
    vPosition.x * 8.0 + sin(stormDist * 12.0 + uTime * 0.3) * 0.5,
    vPosition.y * 8.0 + cos(stormDist * 12.0 - uTime * 0.2) * 0.5,
    vPosition.z * 8.0 + uSeed
  )) * 0.5 + 0.5;
  storm *= swirl;
  colour = mix(colour, stormCol, storm * 0.7);

  // Lighting
  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.15;
  colour *= ambient + diff * 0.85;

  gl_FragColor = vec4(colour, 1.0);
}
`;

const BARREN_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.0 + uSeed * 12.43;

  // Base rocky terrain
  float terrain = fbm(p * 1.5, 5) * 0.5 + 0.5;

  // Impact craters — inverted noise peaks
  float crater1 = snoise(p * 2.5 + uSeed * 7.1);
  crater1 = max(0.0, crater1);
  crater1 = pow(crater1, 2.0);

  float crater2 = snoise(p * 5.0 + uSeed * 13.7);
  crater2 = max(0.0, crater2);
  crater2 = pow(crater2, 3.0);

  // Crater rims — bright edges around dark centres
  float rim1 = snoise(p * 2.5 + uSeed * 7.1 + 0.05);
  rim1 = max(0.0, rim1);
  rim1 = pow(rim1, 1.5);
  float craterRim = max(0.0, rim1 - crater1) * 3.0;

  vec3 greyRock  = vec3(0.42, 0.40, 0.38);
  vec3 darkRock  = vec3(0.22, 0.20, 0.18);
  vec3 lightDust = vec3(0.55, 0.52, 0.48);
  vec3 rimCol    = vec3(0.58, 0.55, 0.50);

  vec3 colour = mix(darkRock, greyRock, terrain);
  colour = mix(colour, lightDust, terrain * 0.3);

  // Darken crater interiors
  float craterDepth = crater1 * 0.6 + crater2 * 0.3;
  colour = mix(colour, darkRock * 0.6, craterDepth);

  // Brighten crater rims
  colour = mix(colour, rimCol, clamp(craterRim, 0.0, 1.0) * 0.5);

  // Regolith variation
  float regolith = snoise(p * 8.0 + uSeed * 31.1) * 0.5 + 0.5;
  colour = mix(colour, lightDust, regolith * 0.1);

  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.12;
  colour *= ambient + diff * 0.88;

  gl_FragColor = vec4(colour, 1.0);
}
`;

const TOXIC_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 2.5 + uSeed * 16.89;

  // Swirling toxic clouds
  float swirl1 = snoise(vec3(
    p.x * 2.0 + sin(uTime * 0.08 + p.y * 2.0) * 0.3,
    p.y * 2.0,
    p.z * 2.0 + cos(uTime * 0.06 + p.x * 2.0) * 0.3
  ));
  float swirl2 = snoise(p * 3.5 + vec3(uTime * 0.04, uTime * 0.03, 0.0));
  float clouds = (swirl1 + swirl2) * 0.5;

  // Terrain underneath
  float terrain = fbm(p * 1.8, 4) * 0.5 + 0.5;

  // Acid pools
  float pool = snoise(p * 0.8 + uSeed * 29.3) * 0.5 + 0.5;
  pool = smoothstep(0.5, 0.7, pool);

  vec3 sickGreen  = vec3(0.35, 0.50, 0.15);
  vec3 darkGreen  = vec3(0.15, 0.25, 0.08);
  vec3 yellowTox  = vec3(0.65, 0.60, 0.12);
  vec3 acidGreen  = vec3(0.30, 0.70, 0.10);
  vec3 cloudCol   = vec3(0.45, 0.48, 0.18);

  vec3 colour = mix(darkGreen, sickGreen, terrain);
  colour = mix(colour, yellowTox, clouds * 0.3 + 0.1);
  colour = mix(colour, acidGreen, pool * 0.5);
  colour = mix(colour, cloudCol, max(0.0, swirl1) * 0.3);

  // Slight emissive glow from toxic reactions
  float glow = max(0.0, clouds) * 0.15;
  colour += vec3(0.15, 0.25, 0.05) * glow;

  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.15;
  colour *= ambient + diff * 0.85;

  // Emissive addition (not affected by lighting)
  colour += vec3(0.08, 0.12, 0.03);

  gl_FragColor = vec4(colour, 1.0);
}
`;

// ── Crystalline and Metallic shaders (extended planet types) ─────────────────

const CRYSTALLINE_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.5 + uSeed * 10.31;

  // Faceted appearance — quantise the noise to create sharp edges
  float facet = snoise(p * 2.0 + uSeed * 4.7);
  facet = floor(facet * 6.0) / 6.0;

  // Crystal vein patterns
  float vein = snoise(p * 5.0 + uSeed * 17.1);
  vein = 1.0 - abs(vein);
  vein = pow(vein, 6.0);

  // Large crystal formations
  float formation = snoise(p * 1.0 + uSeed * 23.9) * 0.5 + 0.5;
  formation = floor(formation * 4.0) / 4.0;

  vec3 crystalBase   = vec3(0.55, 0.65, 0.80);
  vec3 crystalBright = vec3(0.80, 0.88, 0.95);
  vec3 crystalDeep   = vec3(0.25, 0.35, 0.55);
  vec3 veinCol       = vec3(0.90, 0.95, 1.00);

  vec3 colour = mix(crystalDeep, crystalBase, formation);
  colour = mix(colour, crystalBright, facet * 0.3 + 0.2);
  colour = mix(colour, veinCol, vein * 0.6);

  // High specular — crystalline sheen
  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  vec3 viewDir = normalize(-vPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(vNormal, halfDir), 0.0), 128.0);

  // Fresnel for semi-transparency look
  float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
  fresnel = pow(fresnel, 3.0);

  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.18;
  colour *= ambient + diff * 0.82;
  colour += vec3(0.9, 0.95, 1.0) * spec * 0.6;
  colour += crystalBright * fresnel * 0.25;

  gl_FragColor = vec4(colour, 1.0);
}
`;

const METALLIC_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.0 + uSeed * 15.67;

  // Ore vein patterns — thin bright lines
  float vein1 = snoise(p * 3.0 + uSeed * 9.3);
  vein1 = 1.0 - abs(vein1);
  vein1 = pow(vein1, 5.0);

  float vein2 = snoise(p * 5.0 + uSeed * 22.7);
  vein2 = 1.0 - abs(vein2);
  vein2 = pow(vein2, 6.0);

  // Surface variation
  float terrain = fbm(p * 1.5, 4) * 0.5 + 0.5;

  // Polished vs rough areas
  float polish = snoise(p * 1.0 + uSeed * 31.9) * 0.5 + 0.5;

  vec3 darkMetal   = vec3(0.25, 0.25, 0.28);
  vec3 lightMetal  = vec3(0.55, 0.55, 0.60);
  vec3 goldVein    = vec3(0.75, 0.60, 0.25);
  vec3 silverVein  = vec3(0.80, 0.82, 0.85);

  vec3 colour = mix(darkMetal, lightMetal, terrain);

  // Ore veins — gold and silver
  colour = mix(colour, goldVein, vein1 * 0.7);
  colour = mix(colour, silverVein, vein2 * 0.5);

  // High metallic reflections
  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  vec3 viewDir = normalize(-vPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(vNormal, halfDir), 0.0), 96.0);

  // Environment-map-like broad reflection
  vec3 reflDir = reflect(-viewDir, vNormal);
  float envRefl = snoise(reflDir * 2.0) * 0.5 + 0.5;

  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.10;

  // Metallic workflow: diffuse is low, specular is high
  colour *= ambient + diff * 0.40;
  colour += lightMetal * spec * 0.7;
  colour += lightMetal * envRefl * polish * 0.15;

  gl_FragColor = vec4(colour, 1.0);
}
`;

// ── Shader lookup by planet type ─────────────────────────────────────────────

const PLANET_FRAGMENT_SHADERS: Record<string, string> = {
  terran:     TERRAN_FRAGMENT,
  ocean:      OCEAN_FRAGMENT,
  desert:     DESERT_FRAGMENT,
  ice:        ICE_FRAGMENT,
  frozen:     ICE_FRAGMENT,
  volcanic:   VOLCANIC_FRAGMENT,
  molten:     VOLCANIC_FRAGMENT,
  gas_giant:  GAS_GIANT_FRAGMENT,
  barren:     BARREN_FRAGMENT,
  rocky:      BARREN_FRAGMENT,
  toxic:      TOXIC_FRAGMENT,
  crystalline: CRYSTALLINE_FRAGMENT,
  metallic:   METALLIC_FRAGMENT,
};

// ── Atmosphere configuration ─────────────────────────────────────────────────

interface AtmosphereConfig {
  colour: [number, number, number];
  intensity: number;
  thickness: number;
}

const ATMOSPHERE_BY_PLANET_TYPE: Record<string, AtmosphereConfig> = {
  terran:    { colour: [0.3, 0.6, 1.0],  intensity: 1.0,  thickness: 1.08 },
  ocean:     { colour: [0.25, 0.55, 1.0], intensity: 1.1,  thickness: 1.10 },
  desert:    { colour: [0.8, 0.55, 0.3],  intensity: 0.7,  thickness: 1.06 },
  ice:       { colour: [0.5, 0.7, 0.95],  intensity: 0.6,  thickness: 1.05 },
  frozen:    { colour: [0.5, 0.7, 0.95],  intensity: 0.6,  thickness: 1.05 },
  volcanic:  { colour: [0.8, 0.3, 0.1],   intensity: 0.5,  thickness: 1.06 },
  molten:    { colour: [0.8, 0.3, 0.1],   intensity: 0.5,  thickness: 1.06 },
  gas_giant: { colour: [0.5, 0.5, 0.6],   intensity: 0.8,  thickness: 1.12 },
  barren:    { colour: [0.5, 0.45, 0.4],  intensity: 0.2,  thickness: 1.03 },
  rocky:     { colour: [0.5, 0.45, 0.4],  intensity: 0.2,  thickness: 1.03 },
  toxic:     { colour: [0.3, 0.6, 0.15],  intensity: 0.9,  thickness: 1.10 },
  crystalline: { colour: [0.6, 0.7, 0.9], intensity: 0.3,  thickness: 1.04 },
  metallic:  { colour: [0.4, 0.4, 0.45],  intensity: 0.15, thickness: 1.03 },
};

// Types that should display clouds
const CLOUD_TYPES = new Set<string>([
  'terran', 'ocean', 'toxic', 'gas_giant',
]);

// Types that should display rings
const RING_TYPES = new Set<string>([
  'gas_giant',
]);

// ── Atmosphere glow component ────────────────────────────────────────────────

const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uAtmosphereColour;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Fresnel rim glow — strongest at edges, transparent at centre
  vec3 viewDir = normalize(-vPosition);
  float fresnel = 1.0 - max(dot(vNormal, viewDir), 0.0);
  fresnel = pow(fresnel, 2.5);

  float alpha = fresnel * uIntensity * 0.75;
  vec3 colour = uAtmosphereColour * (1.0 + fresnel * 0.5);

  gl_FragColor = vec4(colour, alpha);
}
`;

interface AtmosphereGlowProps {
  radius: number;
  atmosphereConfig?: AtmosphereConfig;
  /** Override colour — [r, g, b] in 0..1 range */
  colour?: [number, number, number];
  intensity?: number;
  thickness?: number;
}

export function AtmosphereGlow({
  radius,
  atmosphereConfig,
  colour,
  intensity,
  thickness,
}: AtmosphereGlowProps) {
  const uniforms = useMemo(() => ({
    uAtmosphereColour: { value: new THREE.Vector3(
      ...(colour ?? atmosphereConfig?.colour ?? [0.3, 0.6, 1.0]),
    ) },
    uIntensity: { value: intensity ?? atmosphereConfig?.intensity ?? 1.0 },
  }), [colour, intensity, atmosphereConfig]);

  const scale = thickness ?? atmosphereConfig?.thickness ?? 1.08;

  return React.createElement('mesh', {
    scale: [scale, scale, scale],
  },
    React.createElement('sphereGeometry', { args: [radius, 48, 48] }),
    React.createElement('shaderMaterial', {
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  );
}

// ── Cloud layer component ────────────────────────────────────────────────────

const CLOUD_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CLOUD_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 p = vPosition * 3.0 + uSeed * 5.71;

  // Cloud coverage from layered noise
  float cloud1 = snoise(p * 1.5 + vec3(uTime * 0.02, 0.0, uTime * 0.015));
  float cloud2 = snoise(p * 3.0 + vec3(0.0, uTime * 0.03, uTime * 0.01));
  float cloud3 = snoise(p * 6.0 + vec3(uTime * 0.01, uTime * 0.02, 0.0));

  float coverage = cloud1 * 0.5 + cloud2 * 0.3 + cloud3 * 0.2;
  coverage = coverage * 0.5 + 0.5; // remap to 0..1

  // Threshold to create cloud patches with clear gaps
  float cloudMask = smoothstep(0.42, 0.65, coverage);

  // Cloud brightness variation
  float brightness = 0.85 + coverage * 0.15;

  // Simple lighting
  vec3 lightDir = normalize(vec3(0.6, 0.4, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.35;
  brightness *= ambient + diff * 0.65;

  vec3 colour = vec3(brightness);

  // Alpha: clouds are semi-transparent
  float alpha = cloudMask * 0.55;

  gl_FragColor = vec4(colour, alpha);
}
`;

interface CloudLayerProps {
  radius: number;
  seed: number;
  rotationSpeed?: number;
}

export function CloudLayer({ radius, seed, rotationSpeed = 0.03 }: CloudLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniformsRef = useRef({
    uSeed: { value: seed },
    uTime: { value: 0 },
  });

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed * delta;
    }
    uniformsRef.current.uTime.value += delta;
  });

  return React.createElement('mesh', {
    ref: meshRef,
    scale: [1.02, 1.02, 1.02],
  },
    React.createElement('sphereGeometry', { args: [radius, 48, 48] }),
    React.createElement('shaderMaterial', {
      vertexShader: CLOUD_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
      uniforms: uniformsRef.current,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  );
}

// ── Planet ring system ───────────────────────────────────────────────────────

const RING_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RING_FRAGMENT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}

uniform float uSeed;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform vec3 uRingColour;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
  // Distance from centre in the xz plane
  float dist = length(vPosition.xz);

  // Normalised position within ring band
  float ringPos = (dist - uInnerRadius) / (uOuterRadius - uInnerRadius);
  ringPos = clamp(ringPos, 0.0, 1.0);

  // Discard fragments outside the ring band
  if (ringPos <= 0.0 || ringPos >= 1.0) discard;

  // Concentric ring pattern from noise
  float angle = atan(vPosition.z, vPosition.x);
  float ringNoise = snoise(vec3(ringPos * 15.0 + uSeed * 3.1, angle * 0.5, uSeed * 7.3));

  // Multiple ring gaps
  float gap1 = smoothstep(0.28, 0.30, ringPos) * (1.0 - smoothstep(0.32, 0.34, ringPos));
  float gap2 = smoothstep(0.58, 0.60, ringPos) * (1.0 - smoothstep(0.62, 0.64, ringPos));
  float gap3 = smoothstep(0.78, 0.80, ringPos) * (1.0 - smoothstep(0.82, 0.84, ringPos));
  float gapMask = 1.0 - (gap1 + gap2 + gap3) * 0.8;

  // Density varies with noise
  float density = 0.5 + ringNoise * 0.3;
  density *= gapMask;

  // Fade at inner and outer edges
  float edgeFade = smoothstep(0.0, 0.08, ringPos) * (1.0 - smoothstep(0.92, 1.0, ringPos));
  density *= edgeFade;

  // Colour variation across the ring
  vec3 colour = uRingColour;
  colour = mix(colour * 0.7, colour * 1.2, ringPos);
  colour += ringNoise * 0.05;

  float alpha = density * 0.55;

  gl_FragColor = vec4(colour, alpha);
}
`;

interface PlanetRingsProps {
  innerRadius: number;
  outerRadius: number;
  seed: number;
  colour?: [number, number, number];
  tilt?: number;
}

export function PlanetRings({
  innerRadius,
  outerRadius,
  seed,
  colour = [0.75, 0.68, 0.55],
  tilt = 0.3,
}: PlanetRingsProps) {
  const uniforms = useMemo(() => ({
    uSeed: { value: seed },
    uInnerRadius: { value: innerRadius },
    uOuterRadius: { value: outerRadius },
    uRingColour: { value: new THREE.Vector3(...colour) },
  }), [seed, innerRadius, outerRadius, colour]);

  return React.createElement('mesh', {
    rotation: [tilt, 0, 0],
  },
    React.createElement('ringGeometry', { args: [innerRadius, outerRadius, 128, 1] }),
    React.createElement('shaderMaterial', {
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
}

// ── Colonised indicator (small orbiting light) ───────────────────────────────

function ColonyIndicator({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.8;
    }
  });

  const orbitR = radius * 1.25;

  return React.createElement('group', { ref: groupRef },
    // Orbiting light dot
    React.createElement('mesh', { position: [orbitR, 0, 0] },
      React.createElement('sphereGeometry', { args: [radius * 0.06, 8, 8] }),
      React.createElement('meshBasicMaterial', {
        color: new THREE.Color(0.2, 1.0, 0.3),
        toneMapped: false,
      }),
    ),
    // Orbit ring line
    React.createElement('mesh', { rotation: [Math.PI / 2, 0, 0] },
      React.createElement('ringGeometry', { args: [orbitR - 0.01, orbitR + 0.01, 64] }),
      React.createElement('meshBasicMaterial', {
        color: new THREE.Color(0.15, 0.6, 0.2),
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      }),
    ),
  );
}

// ── Main ProceduralPlanet component ──────────────────────────────────────────

export interface ProceduralPlanetProps {
  /** Planet classification. Maps to a unique surface shader. */
  planetType: string;
  /** World-space radius of the planet sphere. */
  radius: number;
  /** Deterministic seed for noise — same seed = same planet every time. */
  seed: number;
  /** Position in parent coordinate system. */
  position?: [number, number, number];
  /** Surface rotation speed in radians per second. Default 0.1. */
  rotationSpeed?: number;
  /** Whether to render the atmospheric rim glow. Default true. */
  showAtmosphere?: boolean;
  /** Whether to render a cloud layer (only on applicable types). Default true. */
  showClouds?: boolean;
  /** Whether this planet is colonised (shows orbital indicator). Default false. */
  colonised?: boolean;
}

export function ProceduralPlanet({
  planetType,
  radius,
  seed,
  position = [0, 0, 0],
  rotationSpeed = 0.1,
  showAtmosphere = true,
  showClouds = true,
  colonised = false,
}: ProceduralPlanetProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Resolve fragment shader for the given type
  const fragmentShader = PLANET_FRAGMENT_SHADERS[planetType] ?? BARREN_FRAGMENT;

  // Determine whether this type is emissive (needs toneMapped=false)
  const isEmissive = planetType === 'volcanic' || planetType === 'molten' || planetType === 'toxic';

  // Uniforms — stable reference, mutated each frame for uTime
  const uniformsRef = useRef({
    uSeed: { value: seed },
    uTime: { value: 0 },
  });

  // Update seed if it changes
  uniformsRef.current.uSeed.value = seed;

  // Animate surface rotation and time uniform
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed * delta;
    }
    uniformsRef.current.uTime.value += delta;
  });

  // Atmosphere config
  const atmoConfig = ATMOSPHERE_BY_PLANET_TYPE[planetType] ?? ATMOSPHERE_BY_PLANET_TYPE.barren;

  // Ring colour derived from seed
  const ringColour: [number, number, number] = useMemo(() => {
    const h = ((seed * 0.618033) % 1);
    if (h < 0.25) return [0.75, 0.68, 0.55]; // tan
    if (h < 0.5) return [0.60, 0.65, 0.72];  // blue-grey
    if (h < 0.75) return [0.72, 0.62, 0.48];  // warm brown
    return [0.65, 0.70, 0.60];                 // sage
  }, [seed]);

  const children: React.ReactNode[] = [];

  // Planet surface sphere
  children.push(
    React.createElement('mesh', { ref: meshRef, key: 'surface' },
      React.createElement('sphereGeometry', { args: [radius, 64, 64] }),
      React.createElement('shaderMaterial', {
        vertexShader: PLANET_VERTEX,
        fragmentShader,
        uniforms: uniformsRef.current,
        toneMapped: !isEmissive,
      }),
    ),
  );

  // Atmosphere glow
  if (showAtmosphere && atmoConfig.intensity > 0.1) {
    children.push(
      React.createElement(AtmosphereGlow, {
        key: 'atmo',
        radius,
        atmosphereConfig: atmoConfig,
      }),
    );
  }

  // Cloud layer (only on applicable types)
  if (showClouds && CLOUD_TYPES.has(planetType)) {
    children.push(
      React.createElement(CloudLayer, {
        key: 'clouds',
        radius,
        seed,
        rotationSpeed: rotationSpeed * 0.4,
      }),
    );
  }

  // Ring system for gas giants
  if (RING_TYPES.has(planetType)) {
    children.push(
      React.createElement(PlanetRings, {
        key: 'rings',
        innerRadius: radius * 1.4,
        outerRadius: radius * 2.2,
        seed,
        colour: ringColour,
        tilt: 0.25 + (seed % 7) * 0.05,
      }),
    );
  }

  // Colony indicator
  if (colonised) {
    children.push(
      React.createElement(ColonyIndicator, { key: 'colony', radius }),
    );
  }

  return React.createElement('group', { position }, ...children);
}

// ── Utility: map AtmosphereType to glow colour ──────────────────────────────

/**
 * Returns a suitable atmosphere rim-glow colour for a given AtmosphereType.
 * Useful when you have the atmosphere type directly rather than the planet type.
 */
export function atmosphereColourFromType(
  atmosphereType: AtmosphereType,
): [number, number, number] {
  switch (atmosphereType) {
    case 'oxygen_nitrogen': return [0.30, 0.60, 1.00];
    case 'nitrogen':        return [0.28, 0.52, 0.80];
    case 'carbon_dioxide':  return [0.80, 0.50, 0.25];
    case 'methane':         return [0.30, 0.60, 0.20];
    case 'ammonia':         return [0.70, 0.65, 0.20];
    case 'sulfur_dioxide':  return [0.75, 0.70, 0.15];
    case 'hydrogen':        return [0.50, 0.65, 0.85];
    case 'hydrogen_helium': return [0.45, 0.60, 0.80];
    case 'toxic':           return [0.30, 0.65, 0.15];
    case 'none':
    case 'vacuum':
    default:                return [0.40, 0.40, 0.40];
  }
}

// ── Utility: get recommended sphere segments for LOD ─────────────────────────

/**
 * Returns [widthSegments, heightSegments] for the planet sphere geometry
 * based on distance from camera. Call from your scene to switch LOD.
 */
export function planetLodSegments(distanceFromCamera: number): [number, number] {
  if (distanceFromCamera > 100) return [16, 16];
  if (distanceFromCamera > 40)  return [32, 32];
  return [64, 64];
}

// ── Utility: list of all supported planet type keys ──────────────────────────

export const SUPPORTED_PLANET_TYPES = Object.keys(PLANET_FRAGMENT_SHADERS);
