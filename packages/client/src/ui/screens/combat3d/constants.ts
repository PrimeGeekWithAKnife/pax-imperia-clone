/**
 * Visual constants for the 3D combat renderer.
 *
 * Extracted from CombatScene.ts so both the legacy Phaser 2D renderer and the
 * new React Three Fiber renderer share a single source of truth.
 */

import * as THREE from 'three';
import { BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Coordinate mapping
// ---------------------------------------------------------------------------

/** Scale factor to convert engine (pixel-like) coordinates to 3D world units. */
export const BF_SCALE = 0.1;

/**
 * Convert engine tactical coordinates (x, y) to Three.js world space.
 *
 * Engine x -> 3D x, engine y -> 3D z (Three.js Y is up).
 * The battlefield is centred at the origin so (0,0) in 3D corresponds to the
 * middle of the engine's (BATTLEFIELD_WIDTH/2, BATTLEFIELD_HEIGHT/2).
 */
export function tacticalTo3D(
  engineX: number,
  engineY: number,
  bfWidth: number = BATTLEFIELD_WIDTH,
  bfHeight: number = BATTLEFIELD_HEIGHT,
  out?: THREE.Vector3,
  engineZ: number = 0,
): THREE.Vector3 {
  const v = out ?? new THREE.Vector3();
  v.x = (engineX - bfWidth / 2) * BF_SCALE;
  v.y = engineZ * BF_SCALE;  // tactical Z -> Three.js Y (up)
  v.z = (engineY - bfHeight / 2) * BF_SCALE;
  return v;
}

// ---------------------------------------------------------------------------
// Ship visual helpers
// ---------------------------------------------------------------------------

/**
 * Uniform scale multiplier for a ship mesh based on its hull class.
 * Matches the 2D size categories (tiny / small / medium / large).
 */
export function shipScale(maxHull: number): number {
  if (maxHull < 60) return 1.0;   // probes, scouts
  if (maxHull < 200) return 1.3;  // frigates, destroyers
  if (maxHull < 400) return 1.6;  // cruisers
  return 2.0;                      // battleships, dreadnoughts
}

// ---------------------------------------------------------------------------
// Beam styles
// ---------------------------------------------------------------------------

export type BeamStyle = 'pulse' | 'particle' | 'disruptor' | 'plasma' | 'radiation' | 'spinal';

/** Map weapon componentId to a beam visual style. */
export const BEAM_STYLE_MAP: Record<string, BeamStyle> = {
  pulse_laser: 'pulse',
  phased_array: 'pulse',
  particle_beam_cannon: 'particle',
  radiation_ray: 'radiation',
  disruptor_beam: 'disruptor',
  plasma_lance: 'plasma',
  spinal_annihilator: 'spinal',
};

/** Per-style beam colours for friendly and enemy sides. */
export const BEAM_COLOURS: Record<BeamStyle, { friendly: THREE.Color; enemy: THREE.Color }> = {
  pulse: {
    friendly: new THREE.Color(0x44ff88),
    enemy: new THREE.Color(0xff4444),
  },
  particle: {
    friendly: new THREE.Color(0x44ff88),
    enemy: new THREE.Color(0xff4444),
  },
  radiation: {
    friendly: new THREE.Color(0x88ff44),
    enemy: new THREE.Color(0x88ff44), // sickly green regardless of side
  },
  disruptor: {
    friendly: new THREE.Color(0x9944ff),
    enemy: new THREE.Color(0x9944ff), // purple regardless of side
  },
  plasma: {
    friendly: new THREE.Color(0xff6600),
    enemy: new THREE.Color(0xff6600), // orange regardless of side
  },
  spinal: {
    friendly: new THREE.Color(0xffffff),  // blinding white core
    enemy: new THREE.Color(0xff2200),     // angry red-white
  },
};

// ---------------------------------------------------------------------------
// Projectile styles
// ---------------------------------------------------------------------------

export type ProjectileStyle =
  | 'kinetic'
  | 'mass_driver'
  | 'gauss'
  | 'battering_ram'
  | 'antimatter'
  | 'singularity'
  | 'fusion';

/** Map weapon componentId to a projectile visual style. */
export const PROJECTILE_STYLE_MAP: Record<string, ProjectileStyle> = {
  kinetic_cannon: 'kinetic',
  mass_driver: 'mass_driver',
  gauss_cannon: 'gauss',
  battering_ram: 'battering_ram',
  antimatter_accelerator: 'antimatter',
  singularity_driver: 'singularity',
  fusion_autocannon: 'fusion',
};

/** Projectile colours per style: core, glow, and trail. */
export const PROJECTILE_COLOURS: Record<ProjectileStyle, { core: number; glow: number; trail: number }> = {
  kinetic:       { core: 0xffffff, glow: 0xffffcc, trail: 0xffffcc },
  fusion:        { core: 0xffeedd, glow: 0xff8833, trail: 0xffcc66 },
  mass_driver:   { core: 0xaaccff, glow: 0x88bbff, trail: 0x88bbff },
  gauss:         { core: 0xccddff, glow: 0x4488ff, trail: 0x88ccff },
  battering_ram: { core: 0x999999, glow: 0xbbbbbb, trail: 0x999999 },
  antimatter:    { core: 0xddaaff, glow: 0x8844cc, trail: 0xaa66ff },
  singularity:   { core: 0x110022, glow: 0x9955ff, trail: 0x6622aa },
};

// ---------------------------------------------------------------------------
// Missile styles
// ---------------------------------------------------------------------------

export type MissileStyle = 'basic' | 'torpedo' | 'guided' | 'fusion' | 'antimatter' | 'singularity';

/** Map weapon componentId to a missile visual style. */
export const MISSILE_STYLE_MAP: Record<string, MissileStyle> = {
  basic_missile: 'basic',
  basic_torpedo: 'torpedo',
  guided_torpedo: 'guided',
  fusion_torpedo: 'fusion',
  antimatter_torpedo: 'antimatter',
  singularity_torpedo: 'singularity',
  hv_missile: 'basic',
  torpedo_rack: 'torpedo',
  cluster_missile: 'guided',
  emp_torpedo: 'guided',
  swarm_missiles: 'basic',
  bunker_buster: 'fusion',
  void_seeker: 'antimatter',
  phase_torpedo: 'singularity',
  icbm_torpedo: 'fusion',
};

/** Per-missile-type visual properties. Sizes are scaled for 3D (2D px / 10). */
export const MISSILE_VISUALS: Record<MissileStyle, {
  size: number;
  trailLen: number;
  bodyColor: number;
  exhaustColor: number;
  glowColor: number;
  glowAlpha: number;
  exhaustSegments: number;
}> = {
  basic:       { size: 0.4,  trailLen: 0.8,  bodyColor: 0xcccccc, exhaustColor: 0x999999, glowColor: 0xdddddd, glowAlpha: 0,    exhaustSegments: 2 },
  torpedo:     { size: 0.6,  trailLen: 1.2,  bodyColor: 0xcc5533, exhaustColor: 0x993322, glowColor: 0xdd6644, glowAlpha: 0,    exhaustSegments: 3 },
  guided:      { size: 0.6,  trailLen: 1.4,  bodyColor: 0xffcc33, exhaustColor: 0xddaa11, glowColor: 0xffee66, glowAlpha: 0.12, exhaustSegments: 4 },
  fusion:      { size: 0.8,  trailLen: 1.8,  bodyColor: 0xffaa33, exhaustColor: 0xff7711, glowColor: 0xffcc44, glowAlpha: 0.18, exhaustSegments: 4 },
  antimatter:  { size: 0.8,  trailLen: 1.6,  bodyColor: 0xffccee, exhaustColor: 0xff66aa, glowColor: 0xff88cc, glowAlpha: 0.22, exhaustSegments: 4 },
  singularity: { size: 1.0,  trailLen: 2.2,  bodyColor: 0xbb88ff, exhaustColor: 0x8844cc, glowColor: 0x9955ff, glowAlpha: 0.28, exhaustSegments: 5 },
};

// ---------------------------------------------------------------------------
// Environment colours
// ---------------------------------------------------------------------------

export const ASTEROID_COLOR = 0x333340;
export const ASTEROID_HIGHLIGHT_COLOR = 0x555560;
export const NEBULA_COLOR = 0x6644aa;
export const DEBRIS_COLOR = 0xcc6622;
export const DEBRIS_METALLIC_COLORS = [0x556677, 0x667788, 0x445566];
export const DEBRIS_HOT_EDGE_COLOR = 0xff6633;

/** Planet surface colour by type (fallback to grey). */
export const PLANET_SURFACE_COLOURS: Record<string, number> = {
  terran: 0x1a3a2a,
  ocean: 0x0a2a4a,
  desert: 0x4a3a1a,
  volcanic: 0x3a1a0a,
  arctic: 0x2a3a4a,
  barren: 0x2a2a2a,
  gas_giant: 0x2a2a3a,
  toxic: 0x2a3a1a,
};

/** Atmospheric glow colour by planet type. */
export const PLANET_ATMOSPHERE_COLOURS: Record<string, number> = {
  terran: 0x4488cc,
  ocean: 0x3388ee,
  desert: 0xcc8844,
  volcanic: 0xcc4422,
  arctic: 0x88ccee,
  barren: 0x666666,
  gas_giant: 0xaa88cc,
  toxic: 0x88cc44,
};

// ---------------------------------------------------------------------------
// Effect constants
// ---------------------------------------------------------------------------

/** Damage flash colour (red) overlaid briefly when a ship takes damage. */
export const DAMAGE_FLASH_COLOR = new THREE.Color(0xff2222);
export const DAMAGE_FLASH_DURATION = 120; // ms

/** Explosion expand + fade. */
export const EXPLOSION_COLOR = new THREE.Color(0xff8800);
export const EXPLOSION_DURATION = 500; // ms
export const EXPLOSION_RADIUS = 36 * BF_SCALE; // scaled to 3D units

// ---------------------------------------------------------------------------
// Speed presets
// ---------------------------------------------------------------------------

/** Speed multiplier presets (ms per tick). */
export const SPEED_PRESETS: { label: string; msPerTick: number }[] = [
  { label: '1x', msPerTick: 100 },
  { label: '2x', msPerTick: 50 },
  { label: '4x', msPerTick: 25 },
];

// ---------------------------------------------------------------------------
// Boundary zones
// ---------------------------------------------------------------------------

/** Amber zone: ships approaching the edge get a warning. */
export const BOUNDARY_WARNING_MARGIN = 120;

/** Red zone: ships past this margin are considered fleeing. */
export const BOUNDARY_FLEE_MARGIN = 40;
