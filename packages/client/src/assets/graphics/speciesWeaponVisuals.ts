/**
 * speciesWeaponVisuals.ts — Race-specific weapon colour palettes.
 *
 * Each species has a distinctive visual language for their weapon effects:
 * beams, projectiles, missiles, and point defence. These colours are derived
 * from each race's narrative and material design language.
 */

export interface SpeciesWeaponPalette {
  /** Primary beam colour (inner core). */
  beamCore: number;
  /** Secondary beam colour (outer glow). */
  beamGlow: number;
  /** Beam brightness multiplier (0.5–1.5). */
  beamIntensity: number;

  /** Projectile core colour. */
  projectileCore: number;
  /** Projectile trail/glow colour. */
  projectileTrail: number;

  /** Missile body colour. */
  missileBody: number;
  /** Missile exhaust colour. */
  missileExhaust: number;
  /** Missile glow colour. */
  missileGlow: number;

  /** Point defence tracer colour. */
  pdTracer: number;

  /** Engine glow colour (used for fighter swarm dots). */
  engineGlow: number;
}

const SPECIES_WEAPON_PALETTES: Record<string, SpeciesWeaponPalette> = {
  // ── Teranos — blue-white utilitarian military ─────────────────────────────
  teranos: {
    beamCore: 0xccddff,
    beamGlow: 0x4488cc,
    beamIntensity: 1.0,
    projectileCore: 0xddeeff,
    projectileTrail: 0x6699cc,
    missileBody: 0x889aaa,
    missileExhaust: 0x4488cc,
    missileGlow: 0x3366aa,
    pdTracer: 0xffdd44,
    engineGlow: 0x4488cc,
  },

  // ── Khazari — amber forge-fire, hot metal sparks ──────────────────────────
  khazari: {
    beamCore: 0xffeedd,
    beamGlow: 0xff6600,
    beamIntensity: 1.2,
    projectileCore: 0xffcc88,
    projectileTrail: 0xff8800,
    missileBody: 0x886644,
    missileExhaust: 0xff6600,
    missileGlow: 0xff4400,
    pdTracer: 0xff9933,
    engineGlow: 0xff6600,
  },

  // ── Vaelori — violet psionic crystal resonance ────────────────────────────
  vaelori: {
    beamCore: 0xeeddff,
    beamGlow: 0x8855ff,
    beamIntensity: 1.1,
    projectileCore: 0xccaaff,
    projectileTrail: 0x7744dd,
    missileBody: 0x9977cc,
    missileExhaust: 0x8855ff,
    missileGlow: 0x6633cc,
    pdTracer: 0xbb88ff,
    engineGlow: 0x8855ff,
  },

  // ── Sylvani — green bioluminescent spore glow ─────────────────────────────
  sylvani: {
    beamCore: 0xddffdd,
    beamGlow: 0x44cc44,
    beamIntensity: 0.9,
    projectileCore: 0xbbffbb,
    projectileTrail: 0x44aa44,
    missileBody: 0x448844,
    missileExhaust: 0x66dd66,
    missileGlow: 0x33aa33,
    pdTracer: 0x88ff88,
    engineGlow: 0x44ff44,
  },

  // ── Nexari — cyan data-stream precision ───────────────────────────────────
  nexari: {
    beamCore: 0xddeeff,
    beamGlow: 0x0099ff,
    beamIntensity: 1.1,
    projectileCore: 0xaaddff,
    projectileTrail: 0x0077dd,
    missileBody: 0x556677,
    missileExhaust: 0x0099ff,
    missileGlow: 0x0066cc,
    pdTracer: 0x44bbff,
    engineGlow: 0x0099ff,
  },

  // ── Drakmari — teal abyssal bioluminescence ──────────────────────────────
  drakmari: {
    beamCore: 0xccffee,
    beamGlow: 0x00ccbb,
    beamIntensity: 1.0,
    projectileCore: 0xaaffdd,
    projectileTrail: 0x009988,
    missileBody: 0x336655,
    missileExhaust: 0x00ccbb,
    missileGlow: 0x008877,
    pdTracer: 0x44ddcc,
    engineGlow: 0x00ccbb,
  },

  // ── Ashkari — warm amber workshop sparks, improvised ─────────────────────
  ashkari: {
    beamCore: 0xffddaa,
    beamGlow: 0xcc8833,
    beamIntensity: 0.9,
    projectileCore: 0xffcc88,
    projectileTrail: 0xaa7722,
    missileBody: 0x887755,
    missileExhaust: 0xddaa44,
    missileGlow: 0xaa7722,
    pdTracer: 0xffbb44,
    engineGlow: 0xddaa44,
  },

  // ── Luminari — intense golden-white radiance ─────────────────────────────
  luminari: {
    beamCore: 0xffffff,
    beamGlow: 0xffcc44,
    beamIntensity: 1.4,
    projectileCore: 0xffffff,
    projectileTrail: 0xffdd66,
    missileBody: 0xeeddaa,
    missileExhaust: 0xffcc44,
    missileGlow: 0xffaa22,
    pdTracer: 0xffeedd,
    engineGlow: 0xffcc44,
  },

  // ── Zorvathi — amber chitin acid, bioluminescent ─────────────────────────
  zorvathi: {
    beamCore: 0xffeebb,
    beamGlow: 0xcc8800,
    beamIntensity: 1.0,
    projectileCore: 0xffdd88,
    projectileTrail: 0xbb7700,
    missileBody: 0x665533,
    missileExhaust: 0xcc8800,
    missileGlow: 0x996600,
    pdTracer: 0xffaa44,
    engineGlow: 0xcc8800,
  },

  // ── Orivani — sanctified gold-ivory glow ─────────────────────────────────
  orivani: {
    beamCore: 0xfff8ee,
    beamGlow: 0xffaa33,
    beamIntensity: 1.1,
    projectileCore: 0xffeedd,
    projectileTrail: 0xdd8822,
    missileBody: 0xccbb99,
    missileExhaust: 0xffaa33,
    missileGlow: 0xdd8822,
    pdTracer: 0xffcc66,
    engineGlow: 0xffaa33,
  },

  // ── Kaelenth — cool blue-white precision ─────────────────────────────────
  kaelenth: {
    beamCore: 0xeeeeff,
    beamGlow: 0x4488cc,
    beamIntensity: 1.0,
    projectileCore: 0xddeeff,
    projectileTrail: 0x3377bb,
    missileBody: 0xaabbcc,
    missileExhaust: 0x4488cc,
    missileGlow: 0x336699,
    pdTracer: 0x88bbdd,
    engineGlow: 0x4488cc,
  },

  // ── Thyriaq — liquid silver-cyan nanoscale shimmer ────────────────────────
  thyriaq: {
    beamCore: 0xeeffff,
    beamGlow: 0x66aacc,
    beamIntensity: 1.0,
    projectileCore: 0xcceeee,
    projectileTrail: 0x5599bb,
    missileBody: 0x99aabb,
    missileExhaust: 0x66aacc,
    missileGlow: 0x448899,
    pdTracer: 0x88ccdd,
    engineGlow: 0x66aacc,
  },

  // ── Aethyn — deep purple/magenta phase-shifting ──────────────────────────
  aethyn: {
    beamCore: 0xeebbff,
    beamGlow: 0xaa44ff,
    beamIntensity: 1.2,
    projectileCore: 0xddaaff,
    projectileTrail: 0x8833dd,
    missileBody: 0x7744aa,
    missileExhaust: 0xaa44ff,
    missileGlow: 0x8822cc,
    pdTracer: 0xcc88ff,
    engineGlow: 0xaa44ff,
  },

  // ── Vethara — crimson parasitic filament glow ────────────────────────────
  vethara: {
    beamCore: 0xffcccc,
    beamGlow: 0xcc2222,
    beamIntensity: 1.0,
    projectileCore: 0xffaaaa,
    projectileTrail: 0xaa1111,
    missileBody: 0x884444,
    missileExhaust: 0xcc2222,
    missileGlow: 0x991111,
    pdTracer: 0xff6666,
    engineGlow: 0xcc2222,
  },

  // ── Pyrenth — magma-orange volcanic fury ─────────────────────────────────
  pyrenth: {
    beamCore: 0xffddaa,
    beamGlow: 0xff4400,
    beamIntensity: 1.3,
    projectileCore: 0xffcc88,
    projectileTrail: 0xff3300,
    missileBody: 0x443322,
    missileExhaust: 0xff4400,
    missileGlow: 0xcc2200,
    pdTracer: 0xff6633,
    engineGlow: 0xff4400,
  },
};

/** Look up weapon visuals for a species. Falls back to teranos. */
export function getSpeciesWeaponPalette(speciesId?: string): SpeciesWeaponPalette {
  if (!speciesId) return SPECIES_WEAPON_PALETTES.teranos;
  return SPECIES_WEAPON_PALETTES[speciesId] ?? SPECIES_WEAPON_PALETTES.teranos;
}
