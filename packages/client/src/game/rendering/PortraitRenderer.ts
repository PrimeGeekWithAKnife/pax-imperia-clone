// ── PortraitRenderer ──────────────────────────────────────────────────────────
//
// Renders procedural alien race portraits to an offscreen canvas and returns
// a data URL for use in <img> tags inside React UI components.
// Uses Canvas 2D API only — no Phaser dependency.

export type BaseShape =
  | 'humanoid'
  | 'insectoid'
  | 'crystalline'
  | 'aquatic'
  | 'botanical'
  | 'reptilian'
  | 'cybernetic'
  | 'amorphous'
  | 'energy_form'
  | 'symbiotic'
  | 'synthetic'
  | 'nano_swarm'
  | 'dimensional'
  | 'devout'
  | 'volcanic';

export interface PortraitOptions {
  baseShape: BaseShape;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  features: string[];
  /** Optional background colour override (deep-space tint). */
  bgColor?: string;
}

// ── Per-species portrait definitions ─────────────────────────────────────────
//
// Each race has a completely distinct colour palette:
//
//  Vaelori  – deep violet / crystal cyan / translucent white
//  Khazari  – dark crimson / rust orange / gunmetal gray
//  Sylvani  – forest green / bioluminescent teal / warm amber
//  Nexari   – chrome silver / electric blue / circuit green
//  Drakmari – deep ocean blue / bioluminescent purple / pale underbelly
//  Teranos  – warm tan / steel blue / golden accent
//  Zorvathi – chitin brown / amber / dark exoskeleton
//  Ashkari  – weathered gray / salvaged copper / dim amber eyes

const SPECIES_PORTRAITS: Record<string, PortraitOptions> = {
  vaelori: {
    baseShape: 'crystalline',
    primaryColor: '#6B21A8',   // deep violet
    secondaryColor: '#22D3EE', // crystal cyan
    accentColor: '#E0E7FF',    // translucent white
    bgColor: '#120822',        // dark violet space
    features: ['eyes_crystal', 'psionic_aura', 'facets'],
  },
  khazari: {
    baseShape: 'reptilian',
    primaryColor: '#991B1B',   // dark crimson
    secondaryColor: '#C2410C', // rust orange
    accentColor: '#374151',    // gunmetal gray
    bgColor: '#180808',        // volcanic dark red
    features: ['slit_eyes', 'scales', 'brow_ridges', 'metal_plates'],
  },
  sylvani: {
    baseShape: 'botanical',
    primaryColor: '#166534',   // forest green
    secondaryColor: '#14B8A6', // bioluminescent teal
    accentColor: '#F59E0B',    // warm amber
    bgColor: '#051a0d',        // deep forest dark
    features: ['bioluminescent_spots', 'fronds', 'tendrils'],
  },
  nexari: {
    baseShape: 'cybernetic',
    primaryColor: '#94A3B8',   // chrome silver
    secondaryColor: '#3B82F6', // electric blue
    accentColor: '#22C55E',    // circuit green
    bgColor: '#060c18',        // dark circuit void
    features: ['circuit_lines', 'single_eye', 'data_display', 'half_mechanical'],
  },
  drakmari: {
    baseShape: 'aquatic',
    primaryColor: '#1E3A5F',   // deep ocean blue
    secondaryColor: '#A855F7', // bioluminescent purple
    accentColor: '#E2E8F0',    // pale underbelly
    bgColor: '#060d18',        // abyssal dark
    features: ['gill_slits', 'shark_jaw', 'bioluminescent_spots', 'sharp_teeth'],
  },
  teranos: {
    baseShape: 'humanoid',
    primaryColor: '#D4A76A',   // warm tan
    secondaryColor: '#475569', // steel blue
    accentColor: '#EAB308',    // golden accent
    bgColor: '#0c1018',        // cool dark space
    features: ['warm_eyes', 'tech_visor'],
  },
  zorvathi: {
    baseShape: 'insectoid',
    primaryColor: '#78350F',   // chitin brown
    secondaryColor: '#D97706', // amber
    accentColor: '#1C1917',    // dark exoskeleton (used as deep shadow)
    bgColor: '#100a04',        // subterranean black
    features: ['compound_eyes', 'mandibles', 'antennae', 'chitin_segments'],
  },
  ashkari: {
    baseShape: 'humanoid',
    primaryColor: '#6B7280',   // weathered gray
    secondaryColor: '#B45309', // salvaged copper
    accentColor: '#FDE68A',    // dim amber eyes
    bgColor: '#0a0a0c',        // nomad void
    features: ['glowing_amber_eyes', 'hood_suggestion', 'salvaged_tech', 'scars'],
  },
  // ── Seven newer species ──────────────────────────────────────────────────
  luminari: {
    baseShape: 'energy_form',
    primaryColor: '#FDE68A',   // radiant gold
    secondaryColor: '#F59E0B', // bright amber
    accentColor: '#FFFFFF',    // pure white core
    bgColor: '#0c0800',        // warm dark nebula
    features: ['glow_corona', 'shifting_form', 'energy_tendrils'],
  },
  vethara: {
    baseShape: 'symbiotic',
    primaryColor: '#8B5CF6',   // neural purple
    secondaryColor: '#EC4899', // symbiotic pink
    accentColor: '#C4B5FD',    // pale lavender filaments
    bgColor: '#0c0618',        // bio-dark purple
    features: ['shifting_form', 'tendrils', 'glow_corona'],
  },
  kaelenth: {
    baseShape: 'synthetic',
    primaryColor: '#D4D4D8',   // polished titanium
    secondaryColor: '#F97316', // forge orange
    accentColor: '#71717A',    // worn steel
    bgColor: '#08080c',        // factory void
    features: ['panel_seams', 'visor_eye', 'rivets', 'circuit_etch'],
  },
  thyriaq: {
    baseShape: 'nano_swarm',
    primaryColor: '#A3A3A3',   // nano-silver
    secondaryColor: '#06B6D4', // process cyan
    accentColor: '#E5E5E5',    // bright particle
    bgColor: '#060a10',        // nano-dark
    features: ['swarm_cloud', 'eye_clusters', 'drift_particles'],
  },
  aethyn: {
    baseShape: 'dimensional',
    primaryColor: '#7C3AED',   // dimensional violet
    secondaryColor: '#A78BFA', // phase lavender
    accentColor: '#DDD6FE',    // rift white
    bgColor: '#0a0418',        // void purple
    features: ['impossible_geometry', 'vortex_eye', 'rift_lines'],
  },
  orivani: {
    baseShape: 'devout',
    primaryColor: '#B45309',   // sacred gold
    secondaryColor: '#78350F', // temple bronze
    accentColor: '#FCD34D',    // divine light
    bgColor: '#100800',        // cathedral dark
    features: ['headdress', 'halo', 'gorget', 'holy_symbol'],
  },
  pyrenth: {
    baseShape: 'volcanic',
    primaryColor: '#7C2D12',   // magma brown
    secondaryColor: '#EA580C', // lava orange
    accentColor: '#451A03',    // obsidian
    bgColor: '#120400',        // volcanic void
    features: ['magma_veins', 'ember_eyes', 'cracked_surface', 'brow_ridge'],
  },
};

// ── Origin → base shape mapping (for species creator) ────────────────────────

export const ORIGIN_TO_BASE_SHAPE: Record<string, BaseShape> = {
  Balanced: 'humanoid',
  Bioengineering: 'botanical',
  Industrial: 'reptilian',
  Psionic: 'crystalline',
  Cybernetic: 'cybernetic',
  Nomadic: 'humanoid',
  Aquatic: 'aquatic',
  Subterranean: 'insectoid',
};

// ── Origin → default colour palette (for species creator) ────────────────────
//
// Custom species get an appropriate colour hint based on their origin story.
// All three values are [primaryColor, secondaryColor, accentColor].

export const ORIGIN_TO_COLORS: Record<string, [string, string, string]> = {
  Balanced: ['#D4A76A', '#475569', '#EAB308'],
  Bioengineering: ['#166534', '#14B8A6', '#F59E0B'],
  Industrial: ['#991B1B', '#C2410C', '#374151'],
  Psionic: ['#6B21A8', '#22D3EE', '#E0E7FF'],
  Cybernetic: ['#94A3B8', '#3B82F6', '#22C55E'],
  Nomadic: ['#6B7280', '#B45309', '#FDE68A'],
  Aquatic: ['#1E3A5F', '#A855F7', '#E2E8F0'],
  Subterranean: ['#78350F', '#D97706', '#FCD34D'],
};

// ── Hex to RGB helper ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return { r: isNaN(r) ? 100 : r, g: isNaN(g) ? 100 : g, b: isNaN(b) ? 100 : b };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

// ── Main renderer class ───────────────────────────────────────────────────────

export class PortraitRenderer {
  /**
   * Render a portrait for a known pre-built species by ID.
   * Returns a data URL (png).
   */
  renderPortrait(speciesId: string, size: number): string {
    const opts = SPECIES_PORTRAITS[speciesId];
    if (!opts) {
      return this.renderFallback(speciesId, size);
    }
    return this.renderCustomPortrait(opts, size);
  }

  /**
   * Render a fully custom portrait from PortraitOptions.
   * Returns a data URL (png).
   */
  renderCustomPortrait(options: PortraitOptions, size: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    this.drawBackground(ctx, size, options);

    switch (options.baseShape) {
      case 'crystalline':
        this.drawCrystalline(ctx, size, options);
        break;
      case 'reptilian':
        this.drawReptilian(ctx, size, options);
        break;
      case 'botanical':
        this.drawBotanical(ctx, size, options);
        break;
      case 'cybernetic':
        this.drawCybernetic(ctx, size, options);
        break;
      case 'aquatic':
        this.drawAquatic(ctx, size, options);
        break;
      case 'humanoid':
        this.drawHumanoid(ctx, size, options);
        break;
      case 'insectoid':
        this.drawInsectoid(ctx, size, options);
        break;
      case 'amorphous':
        this.drawAmorphous(ctx, size, options);
        break;
      case 'energy_form':
        this.drawEnergyForm(ctx, size, options);
        break;
      case 'symbiotic':
        this.drawSymbiotic(ctx, size, options);
        break;
      case 'synthetic':
        this.drawSynthetic(ctx, size, options);
        break;
      case 'nano_swarm':
        this.drawNanoSwarm(ctx, size, options);
        break;
      case 'dimensional':
        this.drawDimensional(ctx, size, options);
        break;
      case 'devout':
        this.drawDevout(ctx, size, options);
        break;
      case 'volcanic':
        this.drawVolcanic(ctx, size, options);
        break;
    }

    return canvas.toDataURL('image/png');
  }

  // ── Background ─────────────────────────────────────────────────────────────
  //
  // Each race has a distinctive background tint. The radial gradient centre
  // acts as a soft "light source" that complements the face colours.

  private drawBackground(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const bgBase = opts.bgColor ?? '#05050f';

    // Base fill — race-specific deep dark colour
    ctx.fillStyle = bgBase;
    ctx.fillRect(0, 0, size, size);

    // Radial ambient glow — primary colour tints the background from the upper-left
    const ambient = ctx.createRadialGradient(
      size * 0.35, size * 0.28, size * 0.02,
      size * 0.5,  size * 0.5,  size * 0.9,
    );
    ambient.addColorStop(0,   rgba(opts.primaryColor, 0.18));
    ambient.addColorStop(0.45, rgba(opts.primaryColor, 0.07));
    ambient.addColorStop(0.75, rgba(opts.secondaryColor, 0.04));
    ambient.addColorStop(1,   'rgba(0,0,0,0.55)');
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, size, size);

    // Bottom vignette — draws the figure forward
    const vignette = ctx.createLinearGradient(0, size * 0.6, 0, size);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    // Accent rim along top edge — subtle race-colour halo
    const rim = ctx.createLinearGradient(0, 0, 0, size * 0.15);
    rim.addColorStop(0, rgba(opts.accentColor, 0.12));
    rim.addColorStop(1, 'transparent');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, size, size);

    // Sparse background stars — very small, race-tinted
    ctx.fillStyle = rgba(opts.accentColor, 0.25);
    const starPositions: [number, number][] = [
      [0.08, 0.06], [0.92, 0.09], [0.04, 0.88], [0.96, 0.85],
      [0.15, 0.92], [0.88, 0.14], [0.02, 0.45], [0.97, 0.55],
      [0.78, 0.04], [0.22, 0.96], [0.6, 0.03],
    ];
    for (const [sx, sy] of starPositions) {
      ctx.beginPath();
      ctx.arc(sx * size, sy * size, size * 0.004, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Crystalline (Vaelori) ─────────────────────────────────────────────────
  //
  // Geometric faceted crystal being. Deep violet body, cyan glow-points,
  // white translucent highlights. Multiple eye-point cluster. Crown spikes.

  private drawCrystalline(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Psionic aura — large soft glow behind the entire head
    if (opts.features.includes('psionic_aura')) {
      const aura = ctx.createRadialGradient(cx, cy - 10 * s, 6 * s, cx, cy - 4 * s, 62 * s);
      aura.addColorStop(0,   rgba(opts.secondaryColor, 0.22));
      aura.addColorStop(0.4, rgba(opts.primaryColor,   0.14));
      aura.addColorStop(0.7, rgba(opts.secondaryColor, 0.05));
      aura.addColorStop(1,   'transparent');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, size, size);
    }

    // Deep radial depth shading on body
    const bodyDepth = ctx.createRadialGradient(cx - 12 * s, cy - 20 * s, 2 * s, cx, cy, 50 * s);
    bodyDepth.addColorStop(0,   lighten(opts.primaryColor, 60));
    bodyDepth.addColorStop(0.3, lighten(opts.primaryColor, 20));
    bodyDepth.addColorStop(0.65, opts.primaryColor);
    bodyDepth.addColorStop(1,   darken(opts.primaryColor, 30));
    ctx.fillStyle = bodyDepth;

    // Hexagonal crystal face
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 12 * s;
    ctx.beginPath();
    ctx.moveTo(cx,           cy - 44 * s);   // apex
    ctx.lineTo(cx + 30 * s, cy - 24 * s);   // upper-right
    ctx.lineTo(cx + 27 * s, cy + 12 * s);   // lower-right
    ctx.lineTo(cx + 14 * s, cy + 34 * s);   // bottom-right
    ctx.lineTo(cx - 14 * s, cy + 34 * s);   // bottom-left
    ctx.lineTo(cx - 27 * s, cy + 12 * s);   // lower-left
    ctx.lineTo(cx - 30 * s, cy - 24 * s);   // upper-left
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Translucent white facet overlay — right-side highlight
    const facetHL = ctx.createLinearGradient(cx + 4 * s, cy - 44 * s, cx + 30 * s, cy + 12 * s);
    facetHL.addColorStop(0, rgba(opts.accentColor, 0.20));
    facetHL.addColorStop(0.5, rgba(opts.accentColor, 0.08));
    facetHL.addColorStop(1, 'transparent');
    ctx.fillStyle = facetHL;
    ctx.beginPath();
    ctx.moveTo(cx,           cy - 44 * s);
    ctx.lineTo(cx + 30 * s, cy - 24 * s);
    ctx.lineTo(cx + 27 * s, cy + 12 * s);
    ctx.lineTo(cx + 14 * s, cy + 34 * s);
    ctx.lineTo(cx,           cy + 12 * s);
    ctx.closePath();
    ctx.fill();

    // Facet crease lines (glowing cyan)
    ctx.save();
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.55);
    ctx.lineWidth   = 0.9 * s;
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 4 * s;
    // Centre vertical crease
    ctx.beginPath(); ctx.moveTo(cx, cy - 44 * s); ctx.lineTo(cx - 3 * s, cy + 34 * s); ctx.stroke();
    // Left facet
    ctx.beginPath(); ctx.moveTo(cx - 30 * s, cy - 24 * s); ctx.lineTo(cx - 6 * s, cy + 12 * s); ctx.stroke();
    // Right facet
    ctx.beginPath(); ctx.moveTo(cx + 30 * s, cy - 24 * s); ctx.lineTo(cx + 6 * s, cy + 12 * s); ctx.stroke();
    // Horizontal cross-facet
    ctx.beginPath(); ctx.moveTo(cx - 28 * s, cy - 10 * s); ctx.lineTo(cx + 28 * s, cy - 10 * s); ctx.stroke();
    ctx.restore();

    // Crystal crown spikes — three upward points
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 8 * s;
    const spikes: { x: number; y: number; h: number; w: number }[] = [
      { x: cx - 18 * s, y: cy - 42 * s, h: 16 * s, w: 5 * s },
      { x: cx,          y: cy - 46 * s, h: 22 * s, w: 6 * s },
      { x: cx + 18 * s, y: cy - 42 * s, h: 16 * s, w: 5 * s },
    ];
    for (const sp of spikes) {
      const spGrad = ctx.createLinearGradient(sp.x - sp.w, sp.y, sp.x + sp.w, sp.y - sp.h);
      spGrad.addColorStop(0,   lighten(opts.secondaryColor, 30));
      spGrad.addColorStop(0.5, opts.secondaryColor);
      spGrad.addColorStop(1,   rgba(opts.accentColor, 0.6));
      ctx.fillStyle = spGrad;
      ctx.beginPath();
      ctx.moveTo(sp.x - sp.w, sp.y);
      ctx.lineTo(sp.x,        sp.y - sp.h);
      ctx.lineTo(sp.x + sp.w, sp.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Multiple crystal eye-points — arranged in pentagon-ish cluster
    const eyePositions: { x: number; y: number; r: number }[] = [
      { x: cx - 13 * s, y: cy - 12 * s, r: 4.5 * s },
      { x: cx + 13 * s, y: cy - 12 * s, r: 4.5 * s },
      { x: cx - 22 * s, y: cy - 2 * s,  r: 3.0 * s },
      { x: cx + 22 * s, y: cy - 2 * s,  r: 3.0 * s },
      { x: cx,          y: cy - 22 * s, r: 3.5 * s },
    ];
    for (const eye of eyePositions) {
      // Outer glow
      const eyeGlow = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eye.r * 3);
      eyeGlow.addColorStop(0, rgba(opts.secondaryColor, 0.55));
      eyeGlow.addColorStop(0.5, rgba(opts.secondaryColor, 0.18));
      eyeGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, eye.r * 3, 0, Math.PI * 2);
      ctx.fill();
      // Inner bright core
      ctx.save();
      ctx.shadowColor = opts.secondaryColor;
      ctx.shadowBlur  = 10 * s;
      // White centre
      ctx.fillStyle = opts.accentColor;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
      ctx.fill();
      // Cyan ring
      ctx.strokeStyle = opts.secondaryColor;
      ctx.lineWidth   = 0.8 * s;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, eye.r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Translucent neck/base
    const neckGrad = ctx.createLinearGradient(cx, cy + 34 * s, cx, cy + 60 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.75));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy + 34 * s);
    ctx.lineTo(cx + 14 * s, cy + 34 * s);
    ctx.lineTo(cx + 7 * s,  cy + 60 * s);
    ctx.lineTo(cx - 7 * s,  cy + 60 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ── Reptilian (Khazari) ───────────────────────────────────────────────────
  //
  // Heavy brutish head. Crimson/rust scales, gunmetal industrial plates.
  // Prominent brow ridge, slit amber eyes, riveted metal accents.

  private drawReptilian(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Deep radial head shading — upper-left light source
    const headGrad = ctx.createRadialGradient(cx - 10 * s, cy - 18 * s, 3 * s, cx + 4 * s, cy + 4 * s, 48 * s);
    headGrad.addColorStop(0,   lighten(opts.primaryColor, 45));
    headGrad.addColorStop(0.3, lighten(opts.primaryColor, 15));
    headGrad.addColorStop(0.65, opts.primaryColor);
    headGrad.addColorStop(1,   darken(opts.primaryColor, 20));
    ctx.fillStyle = headGrad;

    // Wide angular reptilian head — heavy jaw, wide brow
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s, cy - 44 * s);   // crown left
    ctx.lineTo(cx + 12 * s, cy - 44 * s);   // crown right
    ctx.lineTo(cx + 38 * s, cy - 26 * s);   // brow far right
    ctx.lineTo(cx + 40 * s, cy - 6 * s);    // cheek right
    ctx.lineTo(cx + 36 * s, cy + 16 * s);   // jaw right
    ctx.lineTo(cx + 26 * s, cy + 36 * s);   // chin right
    ctx.lineTo(cx - 26 * s, cy + 36 * s);   // chin left
    ctx.lineTo(cx - 36 * s, cy + 16 * s);   // jaw left
    ctx.lineTo(cx - 40 * s, cy - 6 * s);    // cheek left
    ctx.lineTo(cx - 38 * s, cy - 26 * s);   // brow far left
    ctx.closePath();
    ctx.fill();

    // Secondary rust orange highlight — centre face
    const rustHL = ctx.createRadialGradient(cx, cy - 4 * s, 2 * s, cx, cy, 30 * s);
    rustHL.addColorStop(0, rgba(opts.secondaryColor, 0.22));
    rustHL.addColorStop(1, 'transparent');
    ctx.fillStyle = rustHL;
    ctx.beginPath();
    ctx.moveTo(cx - 38 * s, cy - 26 * s);
    ctx.lineTo(cx + 38 * s, cy - 26 * s);
    ctx.lineTo(cx + 26 * s, cy + 36 * s);
    ctx.lineTo(cx - 26 * s, cy + 36 * s);
    ctx.closePath();
    ctx.fill();

    // Heavy overhanging brow ridge (darker)
    ctx.fillStyle = darken(opts.primaryColor, 35);
    ctx.beginPath();
    ctx.moveTo(cx - 38 * s, cy - 26 * s);
    ctx.lineTo(cx + 38 * s, cy - 26 * s);
    ctx.lineTo(cx + 36 * s, cy - 16 * s);
    ctx.lineTo(cx - 36 * s, cy - 16 * s);
    ctx.closePath();
    ctx.fill();

    // Scale texture — staggered semicircle arcs
    if (opts.features.includes('scales')) {
      ctx.save();
      ctx.strokeStyle = rgba('#000000', 0.20);
      ctx.lineWidth   = 0.6 * s;
      for (let row = 0; row < 7; row++) {
        for (let col = -5; col <= 5; col++) {
          const sx = cx + col * 9 * s + (row % 2 === 0 ? 0 : 4.5 * s);
          const sy = cy - 22 * s + row * 8 * s;
          ctx.beginPath();
          ctx.arc(sx, sy, 5 * s, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
      }
      // Rust-orange scale highlight (top scales catch light)
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.12);
      ctx.lineWidth   = 0.4 * s;
      for (let row = 0; row < 2; row++) {
        for (let col = -5; col <= 5; col++) {
          const sx = cx + col * 9 * s + (row % 2 === 0 ? 0 : 4.5 * s);
          const sy = cy - 22 * s + row * 8 * s;
          ctx.beginPath();
          ctx.arc(sx, sy - 1 * s, 4 * s, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Slit eyes — amber/gold irises with vertical pupils
    ctx.save();
    ctx.shadowColor = lighten(opts.secondaryColor, 40);
    ctx.shadowBlur  = 8 * s;
    const eyeY = cy - 8 * s;
    for (const ex of [cx - 16 * s, cx + 16 * s]) {
      // Socket depth
      ctx.fillStyle = darken(opts.primaryColor, 30);
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 9 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Iris — rust orange to amber gradient
      const irisGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, 7 * s);
      irisGrad.addColorStop(0,   lighten(opts.secondaryColor, 50));
      irisGrad.addColorStop(0.5, opts.secondaryColor);
      irisGrad.addColorStop(1,   darken(opts.secondaryColor, 30));
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 7 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Vertical slit pupil
      ctx.fillStyle = '#080808';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 2 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eye glint
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(ex - 2 * s, eyeY - 1.5 * s, 1.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Gunmetal industrial armour plates — left and right temple
    if (opts.features.includes('metal_plates')) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur  = 4 * s;
      // Right temple plate
      const rPlateX = cx + 18 * s;
      const rPlateY = cy - 32 * s;
      const plateGrad = ctx.createLinearGradient(rPlateX, rPlateY, rPlateX + 16 * s, rPlateY + 18 * s);
      plateGrad.addColorStop(0, lighten(opts.accentColor, 40));
      plateGrad.addColorStop(0.5, opts.accentColor);
      plateGrad.addColorStop(1, darken(opts.accentColor, 20));
      ctx.fillStyle = plateGrad;
      ctx.fillRect(rPlateX, rPlateY, 17 * s, 8 * s);
      ctx.fillRect(rPlateX + 2 * s, rPlateY + 10 * s, 14 * s, 6 * s);
      // Left shoulder plate (partial)
      ctx.fillRect(cx - 36 * s, cy - 24 * s, 14 * s, 6 * s);
      // Bolt / rivet details
      ctx.fillStyle = lighten(opts.accentColor, 50);
      for (const [bx, by] of [
        [rPlateX + 2 * s, rPlateY + 2 * s], [rPlateX + 13 * s, rPlateY + 2 * s],
        [rPlateX + 2 * s, rPlateY + 5.5 * s], [rPlateX + 13 * s, rPlateY + 5.5 * s],
        [rPlateX + 4 * s, rPlateY + 12 * s], [rPlateX + 12 * s, rPlateY + 12 * s],
      ]) {
        ctx.beginPath();
        ctx.arc(bx!, by!, 1.2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // Horizontal seam on left plate
      ctx.strokeStyle = darken(opts.accentColor, 30);
      ctx.lineWidth   = 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 35 * s, cy - 21 * s);
      ctx.lineTo(cx - 23 * s, cy - 21 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Jaw continuation — slightly lighter than main head
    const jawGrad = ctx.createLinearGradient(cx, cy + 14 * s, cx, cy + 44 * s);
    jawGrad.addColorStop(0, rgba(lighten(opts.primaryColor, 8), 0.9));
    jawGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = jawGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 26 * s, cy + 36 * s);
    ctx.lineTo(cx + 26 * s, cy + 36 * s);
    ctx.lineTo(cx + 16 * s, cy + 58 * s);
    ctx.lineTo(cx - 16 * s, cy + 58 * s);
    ctx.closePath();
    ctx.fill();

    // Neck ridge line — rust orange spine
    ctx.save();
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.45);
    ctx.lineWidth   = 1.5 * s;
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 4 * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 36 * s);
    ctx.lineTo(cx, cy + 58 * s);
    ctx.stroke();
    ctx.restore();
  }

  // ── Botanical (Sylvani) ───────────────────────────────────────────────────
  //
  // Organic flowing head, forest green body, teal bioluminescence, amber glow.
  // Leaf fronds, vine tendrils, glowing spot array.

  private drawBotanical(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Background ambient bioluminescence — soft teal glow from face
    const bioAura = ctx.createRadialGradient(cx, cy - 6 * s, 4 * s, cx, cy, 58 * s);
    bioAura.addColorStop(0,   rgba(opts.secondaryColor, 0.12));
    bioAura.addColorStop(0.5, rgba(opts.secondaryColor, 0.04));
    bioAura.addColorStop(1,   'transparent');
    ctx.fillStyle = bioAura;
    ctx.fillRect(0, 0, size, size);

    // Vine tendrils — organic curves framing the face
    if (opts.features.includes('tendrils')) {
      ctx.save();
      ctx.lineCap = 'round';
      const tendrilDefs: { pts: { x: number; y: number }[]; w: number }[] = [
        { pts: [{ x: cx - 28 * s, y: cy + 8 * s }, { x: cx - 42 * s, y: cy - 18 * s }, { x: cx - 52 * s, y: cy - 44 * s }], w: 2.0 * s },
        { pts: [{ x: cx + 28 * s, y: cy + 8 * s }, { x: cx + 44 * s, y: cy - 14 * s }, { x: cx + 54 * s, y: cy - 42 * s }], w: 2.0 * s },
        { pts: [{ x: cx - 24 * s, y: cy + 18 * s }, { x: cx - 52 * s, y: cy + 8 * s }, { x: cx - 58 * s, y: cy - 12 * s }], w: 1.4 * s },
        { pts: [{ x: cx + 24 * s, y: cy + 18 * s }, { x: cx + 52 * s, y: cy + 8 * s }, { x: cx + 56 * s, y: cy - 12 * s }], w: 1.4 * s },
      ];
      for (const td of tendrilDefs) {
        ctx.strokeStyle = rgba(opts.primaryColor, 0.60);
        ctx.lineWidth   = td.w;
        ctx.beginPath();
        ctx.moveTo(td.pts[0]!.x, td.pts[0]!.y);
        ctx.quadraticCurveTo(td.pts[1]!.x, td.pts[1]!.y, td.pts[2]!.x, td.pts[2]!.y);
        ctx.stroke();
        // Teal highlight on tendrils
        ctx.strokeStyle = rgba(opts.secondaryColor, 0.25);
        ctx.lineWidth   = td.w * 0.4;
        ctx.beginPath();
        ctx.moveTo(td.pts[0]!.x, td.pts[0]!.y);
        ctx.quadraticCurveTo(td.pts[1]!.x, td.pts[1]!.y, td.pts[2]!.x, td.pts[2]!.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Leaf fronds on top — petal-shaped leaves radiating upward
    if (opts.features.includes('fronds')) {
      ctx.save();
      ctx.shadowColor = rgba(opts.accentColor, 0.5);
      ctx.shadowBlur  = 8 * s;
      const fronds: { x: number; y: number; angle: number; len: number }[] = [
        { x: cx - 20 * s, y: cy - 48 * s, angle: -0.38, len: 22 * s },
        { x: cx,          y: cy - 52 * s, angle:  0,    len: 26 * s },
        { x: cx + 20 * s, y: cy - 48 * s, angle:  0.38, len: 22 * s },
        { x: cx - 36 * s, y: cy - 38 * s, angle: -0.82, len: 18 * s },
        { x: cx + 36 * s, y: cy - 38 * s, angle:  0.82, len: 18 * s },
      ];
      for (const fr of fronds) {
        ctx.save();
        ctx.translate(fr.x, fr.y);
        ctx.rotate(fr.angle);
        const lg = ctx.createLinearGradient(0, 0, 0, -fr.len);
        lg.addColorStop(0,   opts.primaryColor);
        lg.addColorStop(0.5, lighten(opts.secondaryColor, 10));
        lg.addColorStop(1,   opts.accentColor);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-7 * s, -8 * s, -9 * s, -fr.len * 0.7, 0, -fr.len);
        ctx.bezierCurveTo( 9 * s, -fr.len * 0.7,  7 * s, -8 * s, 0, 0);
        ctx.fill();
        // Centre vein
        ctx.strokeStyle = rgba(opts.primaryColor, 0.6);
        ctx.lineWidth   = 0.5 * s;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -fr.len);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Main organic head — flowing, rounded
    const headGrad = ctx.createRadialGradient(cx - 10 * s, cy - 20 * s, 3 * s, cx, cy, 40 * s);
    headGrad.addColorStop(0,   lighten(opts.primaryColor, 50));
    headGrad.addColorStop(0.35, lighten(opts.primaryColor, 18));
    headGrad.addColorStop(0.65, opts.primaryColor);
    headGrad.addColorStop(1,   darken(opts.primaryColor, 15));
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(cx,           cy - 38 * s);
    ctx.bezierCurveTo(cx + 24 * s, cy - 42 * s, cx + 36 * s, cy - 20 * s, cx + 32 * s, cy + 4 * s);
    ctx.bezierCurveTo(cx + 28 * s, cy + 28 * s, cx + 18 * s, cy + 38 * s, cx,          cy + 38 * s);
    ctx.bezierCurveTo(cx - 18 * s, cy + 38 * s, cx - 28 * s, cy + 28 * s, cx - 32 * s, cy + 4 * s);
    ctx.bezierCurveTo(cx - 36 * s, cy - 20 * s, cx - 24 * s, cy - 42 * s, cx,          cy - 38 * s);
    ctx.fill();

    // Teal surface sheen — centre face reflection
    const sheen = ctx.createLinearGradient(cx - 10 * s, cy - 28 * s, cx + 16 * s, cy + 10 * s);
    sheen.addColorStop(0, rgba(opts.secondaryColor, 0.16));
    sheen.addColorStop(1, 'transparent');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 38 * s);
    ctx.bezierCurveTo(cx + 24 * s, cy - 42 * s, cx + 36 * s, cy - 20 * s, cx + 32 * s, cy + 4 * s);
    ctx.bezierCurveTo(cx + 28 * s, cy + 28 * s, cx + 18 * s, cy + 38 * s, cx,          cy + 38 * s);
    ctx.closePath();
    ctx.fill();

    // Bioluminescent spots (serve as face highlights AND eyes)
    if (opts.features.includes('bioluminescent_spots')) {
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur  = 10 * s;
      const spots: { x: number; y: number; r: number }[] = [
        { x: cx - 14 * s, y: cy - 9 * s,  r: 3.2 * s },
        { x: cx + 14 * s, y: cy - 9 * s,  r: 3.2 * s },
        { x: cx,          y: cy - 22 * s,  r: 2.8 * s },
        { x: cx - 22 * s, y: cy + 6 * s,  r: 2.2 * s },
        { x: cx + 22 * s, y: cy + 6 * s,  r: 2.2 * s },
        { x: cx - 9 * s,  y: cy + 18 * s, r: 1.8 * s },
        { x: cx + 9 * s,  y: cy + 18 * s, r: 1.8 * s },
        { x: cx,          y: cy + 28 * s, r: 2.0 * s },
        { x: cx - 28 * s, y: cy - 12 * s, r: 1.5 * s },
        { x: cx + 28 * s, y: cy - 12 * s, r: 1.5 * s },
      ];
      for (const sp of spots) {
        // Outer glow halo
        const glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r * 3);
        glow.addColorStop(0,   rgba(opts.accentColor, 0.55));
        glow.addColorStop(0.5, rgba(opts.accentColor, 0.18));
        glow.addColorStop(1,   'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * 3, 0, Math.PI * 2);
        ctx.fill();
        // Core dot
        ctx.fillStyle = opts.accentColor;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
        // White centre glint
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(sp.x - sp.r * 0.3, sp.y - sp.r * 0.3, sp.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Eye surrounds — leaf-shaped oval highlights around main eyes
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 12 * s;
    for (const ex of [cx - 14 * s, cx + 14 * s]) {
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.75);
      ctx.lineWidth   = 1.2 * s;
      ctx.beginPath();
      ctx.ellipse(ex, cy - 9 * s, 7 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Neck/stem — tapered
    const neckGrad = ctx.createLinearGradient(cx, cy + 38 * s, cx, cy + 62 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.75));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 50 * s, 10 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Cybernetic (Nexari) ───────────────────────────────────────────────────
  //
  // Half organic (silver/pale), half mechanical (chrome + panels).
  // Electric blue circuits, circuit green node dots, single organic eye.

  private drawCybernetic(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx   = size * 0.5;
    const cy   = size * 0.52;
    const s    = size / 128;
    const midX = cx + 2 * s;  // dividing line (slightly right of centre)

    // ── Organic left half ──────────────────────────────────────────────────
    const organicGrad = ctx.createRadialGradient(midX - 18 * s, cy - 14 * s, 3 * s, midX - 4 * s, cy + 2 * s, 40 * s);
    organicGrad.addColorStop(0,   '#dde4ee');
    organicGrad.addColorStop(0.4, '#b0bfcc');
    organicGrad.addColorStop(0.75, '#8090a0');
    organicGrad.addColorStop(1,   rgba('#5a6a7a', 0.5));
    ctx.fillStyle = organicGrad;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(midX, cy - 42 * s);
    ctx.bezierCurveTo(midX - 8 * s, cy - 46 * s, midX - 28 * s, cy - 34 * s, midX - 33 * s, cy - 4 * s);
    ctx.bezierCurveTo(midX - 33 * s, cy + 22 * s, midX - 20 * s, cy + 38 * s, midX, cy + 38 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── Mechanical right half ──────────────────────────────────────────────
    const mechGrad = ctx.createLinearGradient(midX, cy - 42 * s, midX + 38 * s, cy + 38 * s);
    mechGrad.addColorStop(0,   '#d0d8e4');
    mechGrad.addColorStop(0.25, lighten(opts.primaryColor, 20));
    mechGrad.addColorStop(0.6,  opts.primaryColor);
    mechGrad.addColorStop(1,   '#283440');
    ctx.fillStyle = mechGrad;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(midX, cy - 42 * s);
    ctx.lineTo(midX + 26 * s, cy - 30 * s);
    ctx.lineTo(midX + 34 * s, cy - 4 * s);
    ctx.lineTo(midX + 30 * s, cy + 18 * s);
    ctx.lineTo(midX + 20 * s, cy + 38 * s);
    ctx.lineTo(midX, cy + 38 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Mechanical plate seams
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = 0.7 * s;
    for (let i = 0; i < 4; i++) {
      const y = cy - 28 * s + i * 17 * s;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(midX + 32 * s, y);
      ctx.stroke();
    }
    // Vertical panel seam
    ctx.beginPath();
    ctx.moveTo(midX + 17 * s, cy - 28 * s);
    ctx.lineTo(midX + 19 * s, cy + 38 * s);
    ctx.stroke();
    ctx.restore();

    // Electric blue circuit lines on mechanical side
    if (opts.features.includes('circuit_lines')) {
      ctx.save();
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.70);
      ctx.lineWidth   = 0.8 * s;
      ctx.shadowColor = opts.secondaryColor;
      ctx.shadowBlur  = 6 * s;
      // Main trunk line
      ctx.beginPath();
      ctx.moveTo(midX + 9 * s, cy - 26 * s);
      ctx.lineTo(midX + 9 * s, cy + 12 * s);
      ctx.stroke();
      // Horizontal branches
      const branches: [number, number, number, number][] = [
        [midX + 9 * s, cy - 18 * s, midX + 26 * s, cy - 18 * s],
        [midX + 9 * s, cy - 6 * s,  midX + 24 * s, cy - 6 * s],
        [midX + 9 * s, cy + 6 * s,  midX + 22 * s, cy + 6 * s],
        [midX + 26 * s, cy - 18 * s, midX + 26 * s, cy - 8 * s],
        [midX + 24 * s, cy - 6 * s,  midX + 24 * s, cy + 2 * s],
      ];
      for (const [x1, y1, x2, y2] of branches) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      // Circuit green node dots at branch ends
      ctx.shadowColor = opts.accentColor;
      ctx.fillStyle   = opts.accentColor;
      for (const [,, x2, y2] of branches) {
        ctx.beginPath();
        ctx.arc(x2, y2, 1.8 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Organic left eye — grey/blue with specular glint
    ctx.save();
    ctx.shadowColor = '#a0c0d8';
    ctx.shadowBlur  = 6 * s;
    const orgEyeX = midX - 14 * s;
    const orgEyeY = cy - 9 * s;
    // Socket
    ctx.fillStyle = darken('#8090a0', 20);
    ctx.beginPath();
    ctx.ellipse(orgEyeX, orgEyeY, 9 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris
    const irisGrad = ctx.createRadialGradient(orgEyeX, orgEyeY, 0, orgEyeX, orgEyeY, 7 * s);
    irisGrad.addColorStop(0,   '#88aac0');
    irisGrad.addColorStop(0.5, '#3a6080');
    irisGrad.addColorStop(1,   '#1a2838');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(orgEyeX, orgEyeY, 7 * s, 5.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#050810';
    ctx.beginPath();
    ctx.arc(orgEyeX, orgEyeY, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    // White glint
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(orgEyeX - 2.5 * s, orgEyeY - 2 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mechanical scanning eye / data display on right side
    if (opts.features.includes('data_display')) {
      ctx.save();
      ctx.shadowColor = opts.secondaryColor;
      ctx.shadowBlur  = 10 * s;
      const dispX = midX + 6 * s;
      const dispY = cy - 20 * s;
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.8);
      ctx.lineWidth   = 0.7 * s;
      ctx.strokeRect(dispX, dispY, 22 * s, 14 * s);
      // Scan lines
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.35);
      ctx.lineWidth   = 0.4 * s;
      for (let ln = 0; ln < 5; ln++) {
        ctx.beginPath();
        ctx.moveTo(dispX + 2 * s, dispY + 2 * s + ln * 2.4 * s);
        ctx.lineTo(dispX + 20 * s, dispY + 2 * s + ln * 2.4 * s);
        ctx.stroke();
      }
      // Active scan indicator — circuit green dot
      ctx.fillStyle   = opts.accentColor;
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur  = 6 * s;
      ctx.beginPath();
      ctx.arc(dispX + 18 * s, dispY + 2.5 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Organic/mechanical dividing seam line
    ctx.save();
    ctx.strokeStyle = rgba('#b0c8d8', 0.75);
    ctx.lineWidth   = 1.4 * s;
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 4 * s;
    ctx.beginPath();
    ctx.moveTo(midX, cy - 42 * s);
    ctx.lineTo(midX + 2 * s, cy + 38 * s);
    ctx.stroke();
    ctx.restore();

    // Neck
    const neckGrad = ctx.createLinearGradient(cx, cy + 38 * s, cx, cy + 58 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.85));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 48 * s, 12 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Aquatic (Drakmari) ────────────────────────────────────────────────────
  //
  // Shark-like streamlined head. Deep ocean blue body, bioluminescent purple
  // jaw/cheek markings, pale underbelly gradient, rows of sharp teeth.

  private drawAquatic(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Bioluminescent background aura (purple glow)
    const bioAura = ctx.createRadialGradient(cx, cy + 12 * s, 4 * s, cx, cy, 60 * s);
    bioAura.addColorStop(0,   rgba(opts.secondaryColor, 0.14));
    bioAura.addColorStop(0.5, rgba(opts.secondaryColor, 0.05));
    bioAura.addColorStop(1,   'transparent');
    ctx.fillStyle = bioAura;
    ctx.fillRect(0, 0, size, size);

    // Main head — shark-like, streamlined
    const headGrad = ctx.createRadialGradient(cx - 8 * s, cy - 20 * s, 3 * s, cx + 4 * s, cy, 48 * s);
    headGrad.addColorStop(0,   lighten(opts.primaryColor, 35));
    headGrad.addColorStop(0.35, lighten(opts.primaryColor, 12));
    headGrad.addColorStop(0.65, opts.primaryColor);
    headGrad.addColorStop(1,   darken(opts.primaryColor, 20));
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(cx,           cy - 46 * s);   // top point
    ctx.lineTo(cx + 28 * s, cy - 28 * s);   // upper right
    ctx.lineTo(cx + 36 * s, cy - 2 * s);    // mid right
    ctx.lineTo(cx + 32 * s, cy + 20 * s);   // lower right
    ctx.lineTo(cx + 22 * s, cy + 38 * s);   // jaw right
    ctx.lineTo(cx,           cy + 40 * s);   // chin point
    ctx.lineTo(cx - 22 * s, cy + 38 * s);   // jaw left
    ctx.lineTo(cx - 32 * s, cy + 20 * s);   // lower left
    ctx.lineTo(cx - 36 * s, cy - 2 * s);    // mid left
    ctx.lineTo(cx - 28 * s, cy - 28 * s);   // upper left
    ctx.closePath();
    ctx.fill();

    // Pale underbelly — lower face gradient
    const bellyGrad = ctx.createLinearGradient(cx, cy + 4 * s, cx, cy + 40 * s);
    bellyGrad.addColorStop(0, 'transparent');
    bellyGrad.addColorStop(1, rgba(opts.accentColor, 0.40));
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 32 * s, cy + 20 * s);
    ctx.lineTo(cx + 32 * s, cy + 20 * s);
    ctx.lineTo(cx + 22 * s, cy + 38 * s);
    ctx.lineTo(cx,           cy + 40 * s);
    ctx.lineTo(cx - 22 * s, cy + 38 * s);
    ctx.closePath();
    ctx.fill();

    // Dorsal streak — darker lateral line along top
    ctx.save();
    ctx.strokeStyle = darken(opts.primaryColor, 25);
    ctx.lineWidth   = 3 * s;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 46 * s);
    ctx.quadraticCurveTo(cx + 2 * s, cy - 20 * s, cx + 2 * s, cy + 6 * s);
    ctx.stroke();
    ctx.restore();

    // Gill slits on both sides
    if (opts.features.includes('gill_slits')) {
      ctx.save();
      ctx.strokeStyle = rgba('#000000', 0.55);
      ctx.lineWidth   = 1.4 * s;
      ctx.lineCap     = 'round';
      for (let i = 0; i < 3; i++) {
        const gy = cy - 2 * s + i * 10 * s;
        ctx.beginPath();
        ctx.moveTo(cx - 28 * s, gy);
        ctx.quadraticCurveTo(cx - 36 * s, gy + 4 * s, cx - 28 * s, gy + 8 * s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 28 * s, gy);
        ctx.quadraticCurveTo(cx + 36 * s, gy + 4 * s, cx + 28 * s, gy + 8 * s);
        ctx.stroke();
      }
      // Purple gill interior glow
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.3);
      ctx.lineWidth   = 0.6 * s;
      for (let i = 0; i < 3; i++) {
        const gy = cy - 2 * s + i * 10 * s;
        ctx.beginPath();
        ctx.moveTo(cx - 29 * s, gy + 1 * s);
        ctx.quadraticCurveTo(cx - 35 * s, gy + 4 * s, cx - 29 * s, gy + 7 * s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 29 * s, gy + 1 * s);
        ctx.quadraticCurveTo(cx + 35 * s, gy + 4 * s, ctx.canvas.width - (cx - 29 * s), gy + 7 * s);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Forward-facing predator eyes
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 10 * s;
    const eyeY = cy - 15 * s;
    for (const ex of [cx - 16 * s, cx + 16 * s]) {
      // Sclera
      ctx.fillStyle = '#dde8e0';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 9 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Iris — deep green
      const irisGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, 6 * s);
      irisGrad.addColorStop(0,   '#50c080');
      irisGrad.addColorStop(0.5, '#186840');
      irisGrad.addColorStop(1,   '#042814');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(ex, eyeY, 5.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#040808';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Glint
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(ex - 2 * s, eyeY - 1.5 * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Rows of sharp teeth along the jaw line
    if (opts.features.includes('sharp_teeth')) {
      ctx.save();
      ctx.fillStyle   = '#f0eddc';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur  = 2 * s;
      const jawY    = cy + 32 * s;
      const numTeeth = 12;
      const jawWidth = 34 * s;
      for (let t = 0; t < numTeeth; t++) {
        const tx     = cx - jawWidth / 2 + (t + 0.5) * (jawWidth / numTeeth);
        const toothH = t % 2 === 0 ? 6 * s : 4 * s;
        ctx.beginPath();
        ctx.moveTo(tx - 2 * s, jawY);
        ctx.lineTo(tx,         jawY - toothH);
        ctx.lineTo(tx + 2 * s, jawY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Bioluminescent purple jaw markings
    if (opts.features.includes('bioluminescent_spots')) {
      ctx.save();
      ctx.shadowColor = opts.secondaryColor;
      ctx.shadowBlur  = 10 * s;
      // Jaw stripe dots
      for (let i = 0; i < 7; i++) {
        const mx  = cx - 24 * s + i * 8 * s;
        const mGl = ctx.createRadialGradient(mx, cy + 24 * s, 0, mx, cy + 24 * s, 4 * s);
        mGl.addColorStop(0, rgba(opts.secondaryColor, 0.90));
        mGl.addColorStop(1, 'transparent');
        ctx.fillStyle = mGl;
        ctx.beginPath();
        ctx.arc(mx, cy + 24 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = opts.secondaryColor;
        ctx.beginPath();
        ctx.arc(mx, cy + 24 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cheek trace marks
      for (const sx of [cx - 28 * s, cx + 28 * s]) {
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = rgba(opts.secondaryColor, 0.7 - i * 0.15);
          ctx.beginPath();
          ctx.arc(sx, cy - 2 * s + i * 9 * s, 1.8 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Neck
    const neckGrad = ctx.createLinearGradient(cx, cy + 40 * s, cx, cy + 62 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.75));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 16 * s, cy + 40 * s);
    ctx.lineTo(cx + 16 * s, cy + 40 * s);
    ctx.lineTo(cx + 10 * s, cy + 62 * s);
    ctx.lineTo(cx - 10 * s, cy + 62 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ── Humanoid (Teranos / Ashkari) ──────────────────────────────────────────
  //
  // Most human-like proportions, but with race-specific accessories.
  // Teranos: warm tan skin, golden tech visor, steel-blue collar.
  // Ashkari: weathered gray, hooded shadow, amber eyes, salvaged tech patches.

  private drawHumanoid(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    const isAshkari = opts.features.includes('hood_suggestion');

    // Ashkari hood — radial dark shadow enveloping from above
    if (isAshkari) {
      ctx.save();
      const hoodGrad = ctx.createRadialGradient(cx, cy - 52 * s, 6 * s, cx, cy - 8 * s, 62 * s);
      hoodGrad.addColorStop(0,   rgba('#1a1410', 0.80));
      hoodGrad.addColorStop(0.4, rgba('#130e08', 0.55));
      hoodGrad.addColorStop(0.7, rgba('#0d0908', 0.25));
      hoodGrad.addColorStop(1,   'transparent');
      ctx.fillStyle = hoodGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 20 * s, 54 * s, 50 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Head shape — rounded, slightly taller than wide
    const headGrad = ctx.createRadialGradient(cx - 9 * s, cy - 18 * s, 2 * s, cx + 4 * s, cy + 6 * s, 38 * s);
    headGrad.addColorStop(0,   lighten(opts.primaryColor, 38));
    headGrad.addColorStop(0.3, lighten(opts.primaryColor, 14));
    headGrad.addColorStop(0.6, opts.primaryColor);
    headGrad.addColorStop(1,   darken(opts.primaryColor, 22));
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(cx,           cy - 38 * s);
    ctx.bezierCurveTo(cx + 18 * s, cy - 40 * s, cx + 28 * s, cy - 22 * s, cx + 26 * s, cy + 2 * s);
    ctx.bezierCurveTo(cx + 24 * s, cy + 28 * s, cx + 14 * s, cy + 38 * s, cx,           cy + 38 * s);
    ctx.bezierCurveTo(cx - 14 * s, cy + 38 * s, cx - 24 * s, cy + 28 * s, cx - 26 * s, cy + 2 * s);
    ctx.bezierCurveTo(cx - 28 * s, cy - 22 * s, cx - 18 * s, cy - 40 * s, cx,           cy - 38 * s);
    ctx.fill();

    // Subtle cheekbone / jaw highlight on right (light source from upper-left)
    const cheekHL = ctx.createRadialGradient(cx + 8 * s, cy - 2 * s, 2 * s, cx + 10 * s, cy + 4 * s, 18 * s);
    cheekHL.addColorStop(0, rgba(lighten(opts.primaryColor, 30), 0.25));
    cheekHL.addColorStop(1, 'transparent');
    ctx.fillStyle = cheekHL;
    ctx.beginPath();
    ctx.ellipse(cx + 10 * s, cy + 2 * s, 18 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scars for Ashkari (visible weathering)
    if (opts.features.includes('scars')) {
      ctx.save();
      ctx.strokeStyle = darken(opts.primaryColor, 30);
      ctx.lineWidth   = 1.4 * s;
      ctx.lineCap     = 'round';
      ctx.globalAlpha = 0.75;
      // Diagonal scar across left cheek
      ctx.beginPath();
      ctx.moveTo(cx - 20 * s, cy - 8 * s);
      ctx.lineTo(cx - 7 * s,  cy + 6 * s);
      ctx.stroke();
      // Short forehead scar
      ctx.beginPath();
      ctx.moveTo(cx + 4 * s,  cy - 26 * s);
      ctx.lineTo(cx + 15 * s, cy - 21 * s);
      ctx.stroke();
      // Minor cut near right brow
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(cx + 8 * s, cy - 16 * s);
      ctx.lineTo(cx + 14 * s, cy - 14 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Eyes
    ctx.save();
    const isAmber = opts.features.includes('glowing_amber_eyes');
    if (isAmber) {
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur  = 12 * s;
    }
    const eyeY     = cy - 9 * s;
    const eyeIris  = isAmber ? opts.accentColor : '#4a80a8';

    // Eye socket shadow
    ctx.fillStyle = rgba('#000000', 0.28);
    ctx.beginPath();
    ctx.ellipse(cx - 12 * s, eyeY, 9.5 * s, 6 * s, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 12 * s, eyeY, 9.5 * s, 6 * s,  0.08, 0, Math.PI * 2);
    ctx.fill();

    // Iris gradient
    for (const ex of [cx - 12 * s, cx + 12 * s]) {
      const irisGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, 5.5 * s);
      irisGrad.addColorStop(0,   lighten(eyeIris, 40));
      irisGrad.addColorStop(0.5, eyeIris);
      irisGrad.addColorStop(1,   darken(eyeIris, 25));
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(ex, eyeY, 5.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#040608';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glints
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    ctx.beginPath();
    ctx.arc(cx - 14 * s, eyeY - 2 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 10 * s, eyeY - 2 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Nose — subtle shading only
    ctx.fillStyle = rgba('#000000', 0.10);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5 * s, 4 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth line
    ctx.strokeStyle = rgba('#000000', 0.28);
    ctx.lineWidth   = 1.5 * s;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8 * s, cy + 19 * s);
    ctx.quadraticCurveTo(cx, cy + 22 * s, cx + 8 * s, cy + 19 * s);
    ctx.stroke();

    // Teranos tech visor — golden/blue HUD overlay on right eye
    if (opts.features.includes('tech_visor')) {
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur  = 10 * s;
      // Main visor band
      ctx.strokeStyle = rgba(opts.accentColor, 0.82);
      ctx.lineWidth   = 3 * s;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 2 * s,  eyeY - 4 * s);
      ctx.lineTo(cx + 29 * s, eyeY - 7 * s);
      ctx.stroke();
      // Sub-detail lines
      ctx.lineWidth   = 0.8 * s;
      ctx.strokeStyle = rgba(opts.accentColor, 0.45);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + 2 * s,  eyeY - 4 * s + i * 2 * s);
        ctx.lineTo(cx + 25 * s, eyeY - 4 * s + i * 2 * s);
        ctx.stroke();
      }
      // Lens glow oval
      const lensGlow = ctx.createRadialGradient(cx + 14 * s, eyeY, 0, cx + 14 * s, eyeY, 8 * s);
      lensGlow.addColorStop(0, rgba(opts.accentColor, 0.30));
      lensGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = lensGlow;
      ctx.beginPath();
      ctx.ellipse(cx + 14 * s, eyeY, 8 * s, 5.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Steel blue collar strip at bottom
      ctx.shadowBlur  = 4 * s;
      ctx.shadowColor = opts.secondaryColor;
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.55);
      ctx.lineWidth   = 2 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 18 * s, cy + 38 * s);
      ctx.lineTo(cx + 18 * s, cy + 38 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Ashkari salvaged tech patches
    if (opts.features.includes('salvaged_tech')) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur  = 5 * s;
      // Left cheek metal patch
      const patchGrad = ctx.createLinearGradient(cx - 26 * s, cy - 2 * s, cx - 12 * s, cy + 8 * s);
      patchGrad.addColorStop(0, lighten(opts.secondaryColor, 20));
      patchGrad.addColorStop(1, darken(opts.secondaryColor, 30));
      ctx.fillStyle = patchGrad;
      ctx.fillRect(cx - 26 * s, cy - 2 * s, 14 * s, 9 * s);
      // Rivets
      ctx.fillStyle = lighten(opts.secondaryColor, 40);
      for (const [px, py] of [
        [cx - 24 * s, cy], [cx - 15 * s, cy],
        [cx - 24 * s, cy + 7 * s], [cx - 15 * s, cy + 7 * s],
      ]) {
        ctx.beginPath();
        ctx.arc(px!, py!, 1.1 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // Amber LED indicator
      ctx.fillStyle   = opts.accentColor;
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur  = 6 * s;
      ctx.beginPath();
      ctx.arc(cx - 19.5 * s, cy + 3.5 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
      // Right temple: small asymmetric wire loop
      ctx.shadowBlur  = 3 * s;
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.65);
      ctx.lineWidth   = 0.9 * s;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 18 * s, cy - 22 * s);
      ctx.quadraticCurveTo(cx + 28 * s, cy - 18 * s, cx + 25 * s, cy - 8 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Neck
    const neckGrad = ctx.createLinearGradient(cx, cy + 38 * s, cx, cy + 62 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.82));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 49 * s, 11 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Insectoid (Zorvathi) ──────────────────────────────────────────────────
  //
  // Segmented carapace, chitin brown with amber compound eyes, dark exo-plates.
  // Antennae with glowing tips, large mandibles, heavy armoured cranium.

  private drawInsectoid(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Antennae — curved upward with glowing tips
    if (opts.features.includes('antennae')) {
      ctx.save();
      ctx.lineCap = 'round';
      // Antenna shafts
      ctx.strokeStyle = opts.primaryColor;
      ctx.lineWidth   = 1.8 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 10 * s,  cy - 42 * s);
      ctx.quadraticCurveTo(cx - 26 * s, cy - 66 * s, cx - 20 * s, cy - 74 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 10 * s,  cy - 42 * s);
      ctx.quadraticCurveTo(cx + 26 * s, cy - 66 * s, cx + 20 * s, cy - 74 * s);
      ctx.stroke();
      // Glowing amber tips
      ctx.shadowColor = opts.secondaryColor;
      ctx.shadowBlur  = 8 * s;
      ctx.fillStyle   = opts.secondaryColor;
      ctx.beginPath();
      ctx.arc(cx - 20 * s, cy - 74 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 20 * s, cy - 74 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      // Tip glow halos
      for (const tipX of [cx - 20 * s, cx + 20 * s]) {
        const tipGlow = ctx.createRadialGradient(tipX, cy - 74 * s, 0, tipX, cy - 74 * s, 7 * s);
        tipGlow.addColorStop(0, rgba(opts.secondaryColor, 0.50));
        tipGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = tipGlow;
        ctx.beginPath();
        ctx.arc(tipX, cy - 74 * s, 7 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Main insect head — angular, box-like cranium
    const headGrad = ctx.createRadialGradient(cx - 8 * s, cy - 16 * s, 3 * s, cx, cy, 38 * s);
    headGrad.addColorStop(0,   lighten(opts.primaryColor, 30));
    headGrad.addColorStop(0.35, lighten(opts.primaryColor, 10));
    headGrad.addColorStop(0.65, opts.primaryColor);
    headGrad.addColorStop(1,   darken(opts.primaryColor, 25));
    ctx.fillStyle = headGrad;

    // Upper cranium — rounded rectangular block
    ctx.beginPath();
    ctx.moveTo(cx - 18 * s, cy - 42 * s);
    ctx.lineTo(cx + 18 * s, cy - 42 * s);
    ctx.lineTo(cx + 28 * s, cy - 28 * s);
    ctx.lineTo(cx + 28 * s, cy - 8 * s);
    ctx.lineTo(cx + 22 * s, cy + 8 * s);
    ctx.lineTo(cx + 22 * s, cy + 22 * s);
    ctx.lineTo(cx - 22 * s, cy + 22 * s);
    ctx.lineTo(cx - 22 * s, cy + 8 * s);
    ctx.lineTo(cx - 28 * s, cy - 8 * s);
    ctx.lineTo(cx - 28 * s, cy - 28 * s);
    ctx.closePath();
    ctx.fill();

    // Dark exoskeleton overlay — top plate
    ctx.fillStyle = rgba(opts.accentColor, 0.45);
    ctx.beginPath();
    ctx.moveTo(cx - 18 * s, cy - 42 * s);
    ctx.lineTo(cx + 18 * s, cy - 42 * s);
    ctx.lineTo(cx + 28 * s, cy - 28 * s);
    ctx.lineTo(cx - 28 * s, cy - 28 * s);
    ctx.closePath();
    ctx.fill();

    // Amber highlight edge on top plate
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.35);
    ctx.lineWidth   = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 18 * s, cy - 41 * s);
    ctx.lineTo(cx + 18 * s, cy - 41 * s);
    ctx.stroke();

    // Chitin segment line — horizontal division across mid-head
    if (opts.features.includes('chitin_segments')) {
      ctx.save();
      // Main seam shadow
      ctx.strokeStyle = rgba('#000000', 0.55);
      ctx.lineWidth   = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 28 * s, cy - 8 * s);
      ctx.lineTo(cx + 28 * s, cy - 8 * s);
      ctx.stroke();
      // Lighter highlight above seam
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.28);
      ctx.lineWidth   = 0.7 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 26 * s, cy - 10 * s);
      ctx.lineTo(cx + 26 * s, cy - 10 * s);
      ctx.stroke();
      // Vertical mid-plate ridge
      ctx.strokeStyle = rgba('#000000', 0.30);
      ctx.lineWidth   = 1 * s;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 42 * s);
      ctx.lineTo(cx, cy - 8 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Compound eyes — large amber faceted ovals
    if (opts.features.includes('compound_eyes')) {
      ctx.save();
      ctx.shadowColor = opts.secondaryColor;
      ctx.shadowBlur  = 10 * s;
      const eyeCenters = [
        { x: cx - 16 * s, y: cy - 20 * s },
        { x: cx + 16 * s, y: cy - 20 * s },
      ];
      for (const ec of eyeCenters) {
        // Outer eye shape
        const eyeGrad = ctx.createRadialGradient(ec.x - 2 * s, ec.y - 2 * s, 1 * s, ec.x, ec.y, 11 * s);
        eyeGrad.addColorStop(0,   lighten(opts.secondaryColor, 50));
        eyeGrad.addColorStop(0.4, opts.secondaryColor);
        eyeGrad.addColorStop(1,   rgba(opts.secondaryColor, 0.25));
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.ellipse(ec.x, ec.y, 11 * s, 8.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        // Facet honeycomb grid overlay
        ctx.strokeStyle = rgba('#000000', 0.22);
        ctx.lineWidth   = 0.5 * s;
        for (let f = 0; f < 8; f++) {
          const fa = (f / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(ec.x, ec.y);
          ctx.lineTo(ec.x + Math.cos(fa) * 7 * s, ec.y + Math.sin(fa) * 6 * s);
          ctx.stroke();
        }
        // Dark centre
        ctx.fillStyle = rgba('#000000', 0.50);
        ctx.beginPath();
        ctx.arc(ec.x, ec.y, 3.5 * s, 0, Math.PI * 2);
        ctx.fill();
        // Specular highlight
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(ec.x - 3 * s, ec.y - 2.5 * s, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Mandibles — paired lower-jaw appendages
    if (opts.features.includes('mandibles')) {
      ctx.save();
      const mandGrad = ctx.createLinearGradient(cx - 14 * s, cy + 22 * s, cx - 28 * s, cy + 40 * s);
      mandGrad.addColorStop(0, lighten(opts.primaryColor, 15));
      mandGrad.addColorStop(1, darken(opts.primaryColor, 20));
      ctx.fillStyle   = mandGrad;
      ctx.strokeStyle = rgba('#000000', 0.50);
      ctx.lineWidth   = 0.8 * s;
      // Left mandible
      ctx.beginPath();
      ctx.moveTo(cx - 14 * s, cy + 22 * s);
      ctx.lineTo(cx - 30 * s, cy + 38 * s);
      ctx.lineTo(cx - 12 * s, cy + 34 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right mandible (mirrored gradient)
      const mandGradR = ctx.createLinearGradient(cx + 14 * s, cy + 22 * s, cx + 28 * s, cy + 40 * s);
      mandGradR.addColorStop(0, lighten(opts.primaryColor, 15));
      mandGradR.addColorStop(1, darken(opts.primaryColor, 20));
      ctx.fillStyle = mandGradR;
      ctx.beginPath();
      ctx.moveTo(cx + 14 * s, cy + 22 * s);
      ctx.lineTo(cx + 30 * s, cy + 38 * s);
      ctx.lineTo(cx + 12 * s, cy + 34 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Amber inner ridge on mandibles
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.4);
      ctx.lineWidth   = 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 14 * s, cy + 22 * s);
      ctx.lineTo(cx - 26 * s, cy + 36 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 14 * s, cy + 22 * s);
      ctx.lineTo(cx + 26 * s, cy + 36 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Centre mouthpiece — dark oval
    ctx.fillStyle = rgba('#000000', 0.50);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 24 * s, 11 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Amber mandible-tip inner glow
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 6 * s;
    ctx.fillStyle   = rgba(opts.secondaryColor, 0.5);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 24 * s, 4 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Neck segment
    const neckGrad = ctx.createLinearGradient(cx, cy + 32 * s, cx, cy + 56 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.85));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy + 34 * s);
    ctx.lineTo(cx + 14 * s, cy + 34 * s);
    ctx.lineTo(cx + 10 * s, cy + 56 * s);
    ctx.lineTo(cx - 10 * s, cy + 56 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ── Amorphous (generic / custom) ──────────────────────────────────────────

  private drawAmorphous(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const s  = size / 128;

    // Shifting blob shape with radial depth shading
    const grad = ctx.createRadialGradient(cx - 10 * s, cy - 14 * s, 4 * s, cx, cy, 44 * s);
    grad.addColorStop(0,   lighten(opts.primaryColor, 60));
    grad.addColorStop(0.3, lighten(opts.primaryColor, 20));
    grad.addColorStop(0.65, opts.primaryColor);
    grad.addColorStop(1,   rgba(opts.secondaryColor, 0.5));
    ctx.fillStyle = grad;

    // Irregular blob
    ctx.beginPath();
    ctx.moveTo(cx,          cy - 44 * s);
    ctx.bezierCurveTo(cx + 26 * s, cy - 44 * s, cx + 44 * s, cy - 12 * s, cx + 38 * s, cy + 14 * s);
    ctx.bezierCurveTo(cx + 32 * s, cy + 40 * s, cx + 14 * s, cy + 46 * s, cx - 4 * s,  cy + 40 * s);
    ctx.bezierCurveTo(cx - 22 * s, cy + 34 * s, cx - 44 * s, cy + 20 * s, cx - 40 * s, cy - 8 * s);
    ctx.bezierCurveTo(cx - 36 * s, cy - 36 * s, cx - 26 * s, cy - 44 * s, cx,          cy - 44 * s);
    ctx.fill();

    // Internal luminous core
    const core = ctx.createRadialGradient(cx + 4 * s, cy - 4 * s, 0, cx, cy, 28 * s);
    core.addColorStop(0,   rgba(opts.accentColor, 0.55));
    core.addColorStop(0.5, rgba(opts.accentColor, 0.18));
    core.addColorStop(1,   'transparent');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 40 * s, 0, Math.PI * 2);
    ctx.fill();

    // Floating eye shapes
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 10 * s;
    const eyeData: { x: number; y: number; r: number }[] = [
      { x: cx - 12 * s, y: cy - 10 * s, r: 5 * s },
      { x: cx + 14 * s, y: cy - 6 * s,  r: 4 * s },
      { x: cx - 4 * s,  y: cy + 12 * s, r: 3 * s },
    ];
    for (const e of eyeData) {
      ctx.fillStyle = opts.accentColor;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Energy Form (Luminari) ────────────────────────────────────────────────
  //
  // Radiant aurora/plasma being. No face — just a sentient light source
  // with flowing energy tendrils and a bright white/gold core.

  private drawEnergyForm(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.50;
    const s  = size / 128;

    // Warm nebula glow behind the being
    const nebulaGlow = ctx.createRadialGradient(cx, cy, 4 * s, cx, cy, 60 * s);
    nebulaGlow.addColorStop(0,   rgba(opts.accentColor, 0.25));
    nebulaGlow.addColorStop(0.3, rgba(opts.primaryColor, 0.18));
    nebulaGlow.addColorStop(0.6, rgba(opts.secondaryColor, 0.08));
    nebulaGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = nebulaGlow;
    ctx.fillRect(0, 0, size, size);

    // Outer corona — large diffuse glow
    ctx.save();
    ctx.globalAlpha = 0.35;
    const corona = ctx.createRadialGradient(cx, cy - 4 * s, 8 * s, cx, cy, 52 * s);
    corona.addColorStop(0,   opts.primaryColor);
    corona.addColorStop(0.4, rgba(opts.secondaryColor, 0.5));
    corona.addColorStop(0.8, rgba(opts.secondaryColor, 0.15));
    corona.addColorStop(1,   'transparent');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, 52 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Concentric irregular aurora ellipses — the body
    const ellipses: { rx: number; ry: number; offX: number; offY: number; rot: number; alpha: number }[] = [
      { rx: 38, ry: 44, offX: -2, offY:  0, rot: -0.05, alpha: 0.20 },
      { rx: 32, ry: 38, offX:  1, offY: -2, rot:  0.08, alpha: 0.28 },
      { rx: 26, ry: 30, offX: -1, offY: -3, rot: -0.12, alpha: 0.35 },
      { rx: 18, ry: 22, offX:  0, offY: -4, rot:  0.06, alpha: 0.45 },
      { rx: 11, ry: 14, offX:  1, offY: -5, rot: -0.03, alpha: 0.55 },
    ];
    for (const el of ellipses) {
      const grad = ctx.createRadialGradient(
        cx + el.offX * s, cy + el.offY * s, 0,
        cx + el.offX * s, cy + el.offY * s, el.rx * s,
      );
      grad.addColorStop(0,   rgba(opts.accentColor, el.alpha));
      grad.addColorStop(0.5, rgba(opts.primaryColor, el.alpha * 0.7));
      grad.addColorStop(1,   rgba(opts.secondaryColor, el.alpha * 0.3));
      ctx.save();
      ctx.fillStyle = grad;
      ctx.translate(cx + el.offX * s, cy + el.offY * s);
      ctx.rotate(el.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, el.rx * s, el.ry * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bright white/gold core at centre
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 20 * s;
    const coreGrad = ctx.createRadialGradient(cx, cy - 5 * s, 0, cx, cy - 5 * s, 10 * s);
    coreGrad.addColorStop(0,   '#FFFFFF');
    coreGrad.addColorStop(0.3, rgba(opts.accentColor, 0.95));
    coreGrad.addColorStop(0.6, rgba(opts.primaryColor, 0.6));
    coreGrad.addColorStop(1,   'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy - 5 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Energy tendrils curving outward (4-6 flowing wisps)
    const tendrils: { startAngle: number; curve: number; length: number; width: number }[] = [
      { startAngle: -0.9,  curve:  0.4,  length: 48, width: 2.5 },
      { startAngle: -0.3,  curve: -0.3,  length: 52, width: 2.0 },
      { startAngle:  0.5,  curve:  0.5,  length: 46, width: 2.2 },
      { startAngle:  1.2,  curve: -0.4,  length: 44, width: 1.8 },
      { startAngle:  2.2,  curve:  0.3,  length: 50, width: 2.0 },
      { startAngle:  3.0,  curve: -0.5,  length: 42, width: 1.6 },
    ];
    ctx.save();
    ctx.lineCap = 'round';
    for (const t of tendrils) {
      const sx = cx + Math.cos(t.startAngle) * 14 * s;
      const sy = cy - 5 * s + Math.sin(t.startAngle) * 14 * s;
      const ex = cx + Math.cos(t.startAngle + t.curve) * t.length * s;
      const ey = cy - 5 * s + Math.sin(t.startAngle + t.curve) * t.length * s;
      const cpx = cx + Math.cos(t.startAngle + t.curve * 0.5) * t.length * 0.65 * s;
      const cpy = cy - 5 * s + Math.sin(t.startAngle + t.curve * 0.5) * t.length * 0.65 * s;

      // Outer glow stroke
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.20);
      ctx.lineWidth   = t.width * 3 * s;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      ctx.stroke();

      // Inner bright stroke
      ctx.strokeStyle = rgba(opts.primaryColor, 0.55);
      ctx.lineWidth   = t.width * s;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      ctx.stroke();

      // Core white highlight
      ctx.strokeStyle = rgba(opts.accentColor, 0.35);
      ctx.lineWidth   = t.width * 0.4 * s;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cpx, cpy, ex, ey);
      ctx.stroke();
    }
    ctx.restore();

    // Tiny sparkle motes scattered through the form
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 4 * s;
    const motes: [number, number, number][] = [
      [0.38, 0.32, 1.2], [0.62, 0.35, 1.0], [0.35, 0.60, 0.8],
      [0.58, 0.65, 1.1], [0.45, 0.28, 0.7], [0.55, 0.72, 0.9],
      [0.30, 0.48, 0.6], [0.68, 0.50, 0.8],
    ];
    for (const [mx, my, mr] of motes) {
      ctx.fillStyle = rgba(opts.accentColor, 0.65);
      ctx.beginPath();
      ctx.arc(mx * size, my * size, mr * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Symbiotic (Vethara) ──────────────────────────────────────────────────
  //
  // Translucent organic mass with visible neural filaments inside.
  // Branching neuron-like lines in pink/purple with bright junction nodes.
  // Faint translucent membrane shell, two subtle eye-spots.

  private drawSymbiotic(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.50;
    const s  = size / 128;

    // Bio-purple ambient glow
    const bioGlow = ctx.createRadialGradient(cx, cy, 6 * s, cx, cy, 56 * s);
    bioGlow.addColorStop(0,   rgba(opts.primaryColor, 0.14));
    bioGlow.addColorStop(0.5, rgba(opts.secondaryColor, 0.06));
    bioGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = bioGlow;
    ctx.fillRect(0, 0, size, size);

    // Outer translucent membrane — faint blob shell
    ctx.save();
    ctx.globalAlpha = 0.18;
    const memGrad = ctx.createRadialGradient(cx - 6 * s, cy - 10 * s, 4 * s, cx, cy, 48 * s);
    memGrad.addColorStop(0,   lighten(opts.accentColor, 30));
    memGrad.addColorStop(0.5, opts.primaryColor);
    memGrad.addColorStop(1,   rgba(opts.primaryColor, 0.1));
    ctx.fillStyle = memGrad;
    ctx.beginPath();
    ctx.moveTo(cx,           cy - 46 * s);
    ctx.bezierCurveTo(cx + 30 * s, cy - 44 * s, cx + 46 * s, cy - 10 * s, cx + 40 * s, cy + 16 * s);
    ctx.bezierCurveTo(cx + 34 * s, cy + 42 * s, cx + 12 * s, cy + 48 * s, cx - 4 * s,  cy + 44 * s);
    ctx.bezierCurveTo(cx - 24 * s, cy + 38 * s, cx - 46 * s, cy + 22 * s, cx - 42 * s, cy - 6 * s);
    ctx.bezierCurveTo(cx - 38 * s, cy - 38 * s, cx - 28 * s, cy - 46 * s, cx,          cy - 46 * s);
    ctx.fill();
    ctx.restore();

    // Membrane edge highlight
    ctx.save();
    ctx.strokeStyle = rgba(opts.accentColor, 0.22);
    ctx.lineWidth   = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(cx,           cy - 46 * s);
    ctx.bezierCurveTo(cx + 30 * s, cy - 44 * s, cx + 46 * s, cy - 10 * s, cx + 40 * s, cy + 16 * s);
    ctx.bezierCurveTo(cx + 34 * s, cy + 42 * s, cx + 12 * s, cy + 48 * s, cx - 4 * s,  cy + 44 * s);
    ctx.bezierCurveTo(cx - 24 * s, cy + 38 * s, cx - 46 * s, cy + 22 * s, cx - 42 * s, cy - 6 * s);
    ctx.bezierCurveTo(cx - 38 * s, cy - 38 * s, cx - 28 * s, cy - 46 * s, cx,          cy - 46 * s);
    ctx.stroke();
    ctx.restore();

    // Internal translucent body mass — slightly denser fill
    ctx.save();
    ctx.globalAlpha = 0.12;
    const innerGrad = ctx.createRadialGradient(cx, cy - 4 * s, 2 * s, cx, cy, 36 * s);
    innerGrad.addColorStop(0,   opts.secondaryColor);
    innerGrad.addColorStop(0.6, opts.primaryColor);
    innerGrad.addColorStop(1,   'transparent');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 36 * s, 40 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Neural filaments — branching neuron-like network
    interface FilamentNode { x: number; y: number; }
    interface Filament { from: FilamentNode; via: FilamentNode; to: FilamentNode; w: number; }
    const filaments: Filament[] = [
      // Main trunk — vertical spine
      { from: { x: cx, y: cy - 34 * s }, via: { x: cx + 2 * s, y: cy - 10 * s }, to: { x: cx - 1 * s, y: cy + 28 * s }, w: 1.8 },
      // Left branches
      { from: { x: cx, y: cy - 20 * s }, via: { x: cx - 18 * s, y: cy - 24 * s }, to: { x: cx - 32 * s, y: cy - 16 * s }, w: 1.2 },
      { from: { x: cx - 18 * s, y: cy - 24 * s }, via: { x: cx - 28 * s, y: cy - 34 * s }, to: { x: cx - 22 * s, y: cy - 42 * s }, w: 0.8 },
      { from: { x: cx, y: cy - 4 * s }, via: { x: cx - 22 * s, y: cy + 2 * s }, to: { x: cx - 34 * s, y: cy + 10 * s }, w: 1.0 },
      { from: { x: cx - 1 * s, y: cy + 14 * s }, via: { x: cx - 16 * s, y: cy + 20 * s }, to: { x: cx - 28 * s, y: cy + 30 * s }, w: 0.9 },
      // Right branches
      { from: { x: cx, y: cy - 14 * s }, via: { x: cx + 20 * s, y: cy - 18 * s }, to: { x: cx + 34 * s, y: cy - 8 * s }, w: 1.2 },
      { from: { x: cx + 20 * s, y: cy - 18 * s }, via: { x: cx + 30 * s, y: cy - 30 * s }, to: { x: cx + 24 * s, y: cy - 40 * s }, w: 0.8 },
      { from: { x: cx, y: cy + 6 * s }, via: { x: cx + 18 * s, y: cy + 14 * s }, to: { x: cx + 30 * s, y: cy + 24 * s }, w: 1.0 },
      { from: { x: cx - 1 * s, y: cy + 20 * s }, via: { x: cx + 14 * s, y: cy + 30 * s }, to: { x: cx + 20 * s, y: cy + 38 * s }, w: 0.7 },
    ];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 6 * s;
    for (const f of filaments) {
      // Outer glow
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.25);
      ctx.lineWidth   = (f.w + 2) * s;
      ctx.beginPath();
      ctx.moveTo(f.from.x, f.from.y);
      ctx.quadraticCurveTo(f.via.x, f.via.y, f.to.x, f.to.y);
      ctx.stroke();
      // Inner bright line
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.70);
      ctx.lineWidth   = f.w * s;
      ctx.beginPath();
      ctx.moveTo(f.from.x, f.from.y);
      ctx.quadraticCurveTo(f.via.x, f.via.y, f.to.x, f.to.y);
      ctx.stroke();
    }
    ctx.restore();

    // Junction nodes — bright spots at branch points
    const nodes: { x: number; y: number; r: number }[] = [
      { x: cx,            y: cy - 34 * s, r: 2.5 },
      { x: cx,            y: cy - 20 * s, r: 3.0 },
      { x: cx - 18 * s,  y: cy - 24 * s, r: 2.5 },
      { x: cx,            y: cy - 4 * s,  r: 2.8 },
      { x: cx + 20 * s,  y: cy - 18 * s, r: 2.5 },
      { x: cx,            y: cy + 6 * s,  r: 2.2 },
      { x: cx,            y: cy + 14 * s, r: 2.0 },
      { x: cx - 1 * s,   y: cy + 28 * s, r: 2.5 },
      { x: cx - 32 * s,  y: cy - 16 * s, r: 1.8 },
      { x: cx + 34 * s,  y: cy - 8 * s,  r: 1.8 },
      { x: cx - 34 * s,  y: cy + 10 * s, r: 1.6 },
      { x: cx + 30 * s,  y: cy + 24 * s, r: 1.6 },
      { x: cx - 22 * s,  y: cy - 42 * s, r: 1.4 },
      { x: cx + 24 * s,  y: cy - 40 * s, r: 1.4 },
    ];
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 8 * s;
    for (const n of nodes) {
      // Glow halo
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3 * s);
      glow.addColorStop(0,   rgba(opts.accentColor, 0.55));
      glow.addColorStop(0.5, rgba(opts.secondaryColor, 0.20));
      glow.addColorStop(1,   'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 3 * s, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.fillStyle = opts.accentColor;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Two faint eye-spots — awareness glow
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 12 * s;
    for (const ex of [cx - 12 * s, cx + 14 * s]) {
      const eyeGlow = ctx.createRadialGradient(ex, cy - 12 * s, 0, ex, cy - 12 * s, 8 * s);
      eyeGlow.addColorStop(0,   rgba(opts.accentColor, 0.50));
      eyeGlow.addColorStop(0.4, rgba(opts.secondaryColor, 0.25));
      eyeGlow.addColorStop(1,   'transparent');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(ex, cy - 12 * s, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      // Bright centre pupil
      ctx.fillStyle = rgba(opts.accentColor, 0.75);
      ctx.beginPath();
      ctx.arc(ex, cy - 12 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Synthetic (Kaelenth) ─────────────────────────────────────────────────
  //
  // Fully machine — angular geometric head (hexagonal/octagonal), polished
  // metal surface with panel seams, rivets, circuit etching. Single narrow
  // horizontal light bar visor. No organic parts.

  private drawSynthetic(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Faint forge-glow ambience
    const ambient = ctx.createRadialGradient(cx, cy - 10 * s, 4 * s, cx, cy, 52 * s);
    ambient.addColorStop(0,   rgba(opts.secondaryColor, 0.08));
    ambient.addColorStop(0.6, rgba(opts.secondaryColor, 0.03));
    ambient.addColorStop(1,   'transparent');
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, size, size);

    // Main head shape — angular octagonal form
    const headGrad = ctx.createLinearGradient(cx - 30 * s, cy - 44 * s, cx + 30 * s, cy + 36 * s);
    headGrad.addColorStop(0,    lighten(opts.primaryColor, 30));
    headGrad.addColorStop(0.3,  opts.primaryColor);
    headGrad.addColorStop(0.7,  darken(opts.primaryColor, 15));
    headGrad.addColorStop(1,    darken(opts.primaryColor, 35));
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy - 44 * s);  // top-left flat
    ctx.lineTo(cx + 14 * s, cy - 44 * s);  // top-right flat
    ctx.lineTo(cx + 30 * s, cy - 30 * s);  // upper-right bevel
    ctx.lineTo(cx + 32 * s, cy - 4 * s);   // mid-right
    ctx.lineTo(cx + 28 * s, cy + 20 * s);  // lower-right
    ctx.lineTo(cx + 16 * s, cy + 36 * s);  // chin-right
    ctx.lineTo(cx - 16 * s, cy + 36 * s);  // chin-left
    ctx.lineTo(cx - 28 * s, cy + 20 * s);  // lower-left
    ctx.lineTo(cx - 32 * s, cy - 4 * s);   // mid-left
    ctx.lineTo(cx - 30 * s, cy - 30 * s);  // upper-left bevel
    ctx.closePath();
    ctx.fill();

    // Specular highlight — upper-left metal reflection
    const specHL = ctx.createLinearGradient(cx - 30 * s, cy - 44 * s, cx + 10 * s, cy - 10 * s);
    specHL.addColorStop(0,   rgba('#FFFFFF', 0.12));
    specHL.addColorStop(0.5, rgba('#FFFFFF', 0.04));
    specHL.addColorStop(1,   'transparent');
    ctx.fillStyle = specHL;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy - 44 * s);
    ctx.lineTo(cx + 14 * s, cy - 44 * s);
    ctx.lineTo(cx + 30 * s, cy - 30 * s);
    ctx.lineTo(cx + 32 * s, cy - 4 * s);
    ctx.lineTo(cx - 32 * s, cy - 4 * s);
    ctx.lineTo(cx - 30 * s, cy - 30 * s);
    ctx.closePath();
    ctx.fill();

    // Panel seam lines
    ctx.save();
    ctx.strokeStyle = rgba('#000000', 0.40);
    ctx.lineWidth   = 0.8 * s;
    // Horizontal seams
    const seamYs = [cy - 30 * s, cy - 4 * s, cy + 20 * s];
    for (const sy of seamYs) {
      const halfW = sy < cy ? 30 : 28;
      ctx.beginPath();
      ctx.moveTo(cx - halfW * s, sy);
      ctx.lineTo(cx + halfW * s, sy);
      ctx.stroke();
    }
    // Centre vertical seam
    ctx.beginPath();
    ctx.moveTo(cx, cy - 44 * s);
    ctx.lineTo(cx, cy + 36 * s);
    ctx.stroke();
    // Diagonal panel lines from top corners
    ctx.lineWidth = 0.6 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy - 44 * s);
    ctx.lineTo(cx - 22 * s, cy - 30 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 14 * s, cy - 44 * s);
    ctx.lineTo(cx + 22 * s, cy - 30 * s);
    ctx.stroke();
    ctx.restore();

    // Highlight line below each seam (metallic sheen)
    ctx.save();
    ctx.strokeStyle = rgba(opts.primaryColor, 0.25);
    ctx.lineWidth   = 0.5 * s;
    for (const sy of seamYs) {
      const halfW = sy < cy ? 29 : 27;
      ctx.beginPath();
      ctx.moveTo(cx - halfW * s, sy + 1 * s);
      ctx.lineTo(cx + halfW * s, sy + 1 * s);
      ctx.stroke();
    }
    ctx.restore();

    // Rivets / bolts at panel corners
    const rivets: [number, number][] = [
      [cx - 14 * s, cy - 43 * s], [cx + 14 * s, cy - 43 * s],
      [cx - 29 * s, cy - 29 * s], [cx + 29 * s, cy - 29 * s],
      [cx - 31 * s, cy - 3 * s],  [cx + 31 * s, cy - 3 * s],
      [cx - 27 * s, cy + 19 * s], [cx + 27 * s, cy + 19 * s],
      [cx - 15 * s, cy + 35 * s], [cx + 15 * s, cy + 35 * s],
    ];
    ctx.save();
    for (const [rx, ry] of rivets) {
      // Dark outer ring
      ctx.fillStyle = darken(opts.accentColor, 20);
      ctx.beginPath();
      ctx.arc(rx, ry, 2.0 * s, 0, Math.PI * 2);
      ctx.fill();
      // Bright centre
      ctx.fillStyle = lighten(opts.primaryColor, 40);
      ctx.beginPath();
      ctx.arc(rx, ry, 1.0 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Circuit etching — faint technical lines in panel areas
    ctx.save();
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.12);
    ctx.lineWidth   = 0.4 * s;
    // Left panel circuit
    const circuits: [number, number, number, number][] = [
      [cx - 24 * s, cy - 22 * s, cx - 10 * s, cy - 22 * s],
      [cx - 10 * s, cy - 22 * s, cx - 10 * s, cy - 14 * s],
      [cx - 10 * s, cy - 14 * s, cx - 20 * s, cy - 14 * s],
      [cx - 20 * s, cy - 14 * s, cx - 20 * s, cy - 8 * s],
      // Right panel circuit
      [cx + 8 * s,  cy + 4 * s,  cx + 22 * s, cy + 4 * s],
      [cx + 22 * s, cy + 4 * s,  cx + 22 * s, cy + 12 * s],
      [cx + 22 * s, cy + 12 * s, cx + 12 * s, cy + 12 * s],
    ];
    for (const [x1, y1, x2, y2] of circuits) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Visor eye — single narrow horizontal light bar
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 14 * s;
    // Visor recess (dark)
    ctx.fillStyle = darken(opts.accentColor, 40);
    ctx.beginPath();
    ctx.moveTo(cx - 26 * s, cy - 16 * s);
    ctx.lineTo(cx + 26 * s, cy - 16 * s);
    ctx.lineTo(cx + 24 * s, cy - 8 * s);
    ctx.lineTo(cx - 24 * s, cy - 8 * s);
    ctx.closePath();
    ctx.fill();
    // Glowing visor bar
    const visorGrad = ctx.createLinearGradient(cx - 24 * s, cy - 14 * s, cx + 24 * s, cy - 10 * s);
    visorGrad.addColorStop(0,   rgba(opts.secondaryColor, 0.4));
    visorGrad.addColorStop(0.3, opts.secondaryColor);
    visorGrad.addColorStop(0.5, lighten(opts.secondaryColor, 40));
    visorGrad.addColorStop(0.7, opts.secondaryColor);
    visorGrad.addColorStop(1,   rgba(opts.secondaryColor, 0.4));
    ctx.fillStyle = visorGrad;
    ctx.fillRect(cx - 22 * s, cy - 14 * s, 44 * s, 5 * s);
    // Bright centre point in visor
    ctx.fillStyle = lighten(opts.secondaryColor, 60);
    ctx.beginPath();
    ctx.arc(cx, cy - 11.5 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Wear marks / scratches
    ctx.save();
    ctx.strokeStyle = rgba('#000000', 0.15);
    ctx.lineWidth   = 0.5 * s;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 8 * s, cy - 36 * s); ctx.lineTo(cx + 18 * s, cy - 28 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 16 * s, cy + 8 * s); ctx.lineTo(cx - 8 * s, cy + 14 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 4 * s, cy + 24 * s); ctx.lineTo(cx + 12 * s, cy + 28 * s); ctx.stroke();
    ctx.restore();

    // Neck / chassis connector
    const neckGrad = ctx.createLinearGradient(cx, cy + 36 * s, cx, cy + 58 * s);
    neckGrad.addColorStop(0, rgba(opts.accentColor, 0.80));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s, cy + 36 * s);
    ctx.lineTo(cx + 12 * s, cy + 36 * s);
    ctx.lineTo(cx + 8 * s,  cy + 58 * s);
    ctx.lineTo(cx - 8 * s,  cy + 58 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ── Nano Swarm (Thyriaq) ─────────────────────────────────────────────────
  //
  // Cloud of hundreds of tiny particles forming a roughly humanoid silhouette.
  // Denser at centre, sparser at edges. Two brighter clusters for "eyes".
  // Occasional particle drifting away from the main mass.

  private drawNanoSwarm(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.50;
    const s  = size / 128;

    // Faint cyan processing glow behind swarm
    const procGlow = ctx.createRadialGradient(cx, cy, 6 * s, cx, cy, 50 * s);
    procGlow.addColorStop(0,   rgba(opts.secondaryColor, 0.10));
    procGlow.addColorStop(0.6, rgba(opts.secondaryColor, 0.03));
    procGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = procGlow;
    ctx.fillRect(0, 0, size, size);

    // Deterministic pseudo-random number generator (seeded)
    let seed = 42;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    // Define the humanoid silhouette as an implicit density field.
    // Points inside the silhouette ellipses get higher density.
    const inSilhouette = (px: number, py: number): number => {
      // Head ellipse
      const hdx = (px - cx) / (22 * s);
      const hdy = (py - (cy - 18 * s)) / (28 * s);
      const headDist = hdx * hdx + hdy * hdy;
      // Torso ellipse
      const tdx = (px - cx) / (18 * s);
      const tdy = (py - (cy + 20 * s)) / (24 * s);
      const torsoDist = tdx * tdx + tdy * tdy;
      // Return best (smallest) distance — lower = more dense
      return Math.min(headDist, torsoDist);
    };

    // Draw hundreds of particles
    const particleCount = 420;
    ctx.save();
    for (let i = 0; i < particleCount; i++) {
      // Generate candidate position biased toward centre
      const angle = rand() * Math.PI * 2;
      const radius = rand() * rand() * 50 * s;  // squared for centre bias
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;

      const density = inSilhouette(px, py);

      // Skip particles too far outside the silhouette (keep some for sparser edges)
      if (density > 2.5) continue;

      // Size: larger near centre, smaller at edges
      const baseSize = density < 0.5 ? 1.8 : density < 1.0 ? 1.4 : density < 1.5 ? 1.0 : 0.7;
      const pSize = baseSize * s;

      // Alpha: denser near centre, fainter at edges
      const alpha = density < 0.3 ? 0.80 : density < 0.7 ? 0.60 : density < 1.2 ? 0.40 : 0.22;

      // Colour: mix between primary (silver) and secondary (cyan)
      const colour = density < 0.6 ? opts.accentColor : density < 1.2 ? opts.primaryColor : darken(opts.primaryColor, 20);
      ctx.fillStyle = rgba(colour, alpha);
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Eye clusters — two denser bright regions
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 8 * s;
    const eyePositions: [number, number][] = [
      [cx - 10 * s, cy - 20 * s],
      [cx + 10 * s, cy - 20 * s],
    ];
    for (const [ex, ey] of eyePositions) {
      // Bright cluster of particles forming an "eye"
      for (let j = 0; j < 16; j++) {
        const ox = (rand() - 0.5) * 8 * s;
        const oy = (rand() - 0.5) * 5 * s;
        ctx.fillStyle = rgba(opts.secondaryColor, 0.65 + rand() * 0.25);
        ctx.beginPath();
        ctx.arc(ex + ox, ey + oy, (0.8 + rand() * 1.2) * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // Central bright dot
      ctx.fillStyle = opts.accentColor;
      ctx.beginPath();
      ctx.arc(ex, ey, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      // Glow halo around eye
      const eyeGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 8 * s);
      eyeGlow.addColorStop(0,   rgba(opts.secondaryColor, 0.35));
      eyeGlow.addColorStop(1,   'transparent');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(ex, ey, 8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Drifting particles — a few strays beyond the main mass
    ctx.save();
    const strays: [number, number, number][] = [
      [0.22, 0.28, 0.8], [0.78, 0.32, 0.9], [0.18, 0.62, 0.7],
      [0.82, 0.58, 0.8], [0.25, 0.78, 0.6], [0.75, 0.74, 0.7],
      [0.15, 0.42, 0.5], [0.85, 0.48, 0.6], [0.30, 0.14, 0.5],
      [0.70, 0.12, 0.4], [0.12, 0.80, 0.4], [0.88, 0.82, 0.5],
    ];
    for (const [sx, sy, sr] of strays) {
      ctx.fillStyle = rgba(opts.primaryColor, 0.25);
      ctx.beginPath();
      ctx.arc(sx * size, sy * size, sr * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Dimensional (Aethyn) ─────────────────────────────────────────────────
  //
  // Impossible geometry — overlapping transparent polygons that seem to shift.
  // Colours phase between violet and white. Central spiral/vortex "eye".
  // Geometric lines extending beyond the body. Unsettling and alien.

  private drawDimensional(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.50;
    const s  = size / 128;

    // Void purple ambient glow
    const voidGlow = ctx.createRadialGradient(cx, cy, 4 * s, cx, cy, 60 * s);
    voidGlow.addColorStop(0,   rgba(opts.primaryColor, 0.12));
    voidGlow.addColorStop(0.5, rgba(opts.secondaryColor, 0.05));
    voidGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = voidGlow;
    ctx.fillRect(0, 0, size, size);

    // Extra-dimensional projection lines extending outward from body
    ctx.save();
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.12);
    ctx.lineWidth   = 0.6 * s;
    const projections: [number, number, number, number][] = [
      [cx - 8 * s, cy - 30 * s, cx - 40 * s, cy - 58 * s],
      [cx + 12 * s, cy - 28 * s, cx + 50 * s, cy - 52 * s],
      [cx - 28 * s, cy + 4 * s, cx - 56 * s, cy - 8 * s],
      [cx + 30 * s, cy + 8 * s, cx + 58 * s, cy + 2 * s],
      [cx - 16 * s, cy + 28 * s, cx - 44 * s, cy + 52 * s],
      [cx + 18 * s, cy + 30 * s, cx + 48 * s, cy + 56 * s],
      [cx, cy - 36 * s, cx + 8 * s, cy - 62 * s],
      [cx - 4 * s, cy + 36 * s, cx - 12 * s, cy + 62 * s],
    ];
    for (const [x1, y1, x2, y2] of projections) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Overlapping impossible triangles — transparent, layered
    interface TriDef { pts: [number, number][]; color: string; alpha: number; }
    const triangles: TriDef[] = [
      { pts: [[cx, cy - 38 * s], [cx - 32 * s, cy + 18 * s], [cx + 32 * s, cy + 18 * s]], color: opts.primaryColor, alpha: 0.22 },
      { pts: [[cx, cy + 32 * s], [cx - 30 * s, cy - 20 * s], [cx + 30 * s, cy - 20 * s]], color: opts.secondaryColor, alpha: 0.18 },
      { pts: [[cx - 28 * s, cy - 24 * s], [cx + 28 * s, cy - 24 * s], [cx, cy + 28 * s]], color: opts.accentColor, alpha: 0.14 },
      // Rotated / offset impossible shapes
      { pts: [[cx - 6 * s, cy - 34 * s], [cx - 36 * s, cy + 8 * s], [cx + 24 * s, cy + 14 * s]], color: opts.primaryColor, alpha: 0.16 },
      { pts: [[cx + 8 * s, cy - 32 * s], [cx + 38 * s, cy + 12 * s], [cx - 22 * s, cy + 16 * s]], color: opts.secondaryColor, alpha: 0.14 },
    ];

    for (const tri of triangles) {
      // Filled triangle
      ctx.save();
      ctx.fillStyle = rgba(tri.color, tri.alpha);
      ctx.beginPath();
      ctx.moveTo(tri.pts[0]![0]!, tri.pts[0]![1]!);
      ctx.lineTo(tri.pts[1]![0]!, tri.pts[1]![1]!);
      ctx.lineTo(tri.pts[2]![0]!, tri.pts[2]![1]!);
      ctx.closePath();
      ctx.fill();
      // Edge lines
      ctx.strokeStyle = rgba(tri.color, tri.alpha + 0.15);
      ctx.lineWidth   = 1.0 * s;
      ctx.beginPath();
      ctx.moveTo(tri.pts[0]![0]!, tri.pts[0]![1]!);
      ctx.lineTo(tri.pts[1]![0]!, tri.pts[1]![1]!);
      ctx.lineTo(tri.pts[2]![0]!, tri.pts[2]![1]!);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Additional overlapping rectangles / quadrilaterals for impossible feel
    ctx.save();
    ctx.fillStyle   = rgba(opts.accentColor, 0.08);
    ctx.strokeStyle = rgba(opts.accentColor, 0.18);
    ctx.lineWidth   = 0.7 * s;
    // Tilted rectangle
    ctx.beginPath();
    ctx.moveTo(cx - 18 * s, cy - 28 * s);
    ctx.lineTo(cx + 22 * s, cy - 32 * s);
    ctx.lineTo(cx + 20 * s, cy + 8 * s);
    ctx.lineTo(cx - 24 * s, cy + 12 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Another offset parallelogram
    ctx.fillStyle = rgba(opts.primaryColor, 0.06);
    ctx.strokeStyle = rgba(opts.primaryColor, 0.14);
    ctx.beginPath();
    ctx.moveTo(cx - 10 * s, cy - 16 * s);
    ctx.lineTo(cx + 26 * s, cy - 10 * s);
    ctx.lineTo(cx + 16 * s, cy + 26 * s);
    ctx.lineTo(cx - 20 * s, cy + 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Central vortex / spiral eye
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 12 * s;
    // Spiral rings
    for (let ring = 0; ring < 6; ring++) {
      const radius = (4 + ring * 3.5) * s;
      const alpha = 0.6 - ring * 0.08;
      const colour = ring % 2 === 0 ? opts.accentColor : opts.secondaryColor;
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.lineWidth   = (1.6 - ring * 0.15) * s;
      ctx.beginPath();
      // Draw partial arc for spiral effect — each ring starts at a different angle
      const startAngle = ring * 0.9;
      ctx.arc(cx, cy - 2 * s, radius, startAngle, startAngle + Math.PI * 1.5);
      ctx.stroke();
    }
    // Bright vortex centre
    const vortexCore = ctx.createRadialGradient(cx, cy - 2 * s, 0, cx, cy - 2 * s, 6 * s);
    vortexCore.addColorStop(0,   '#FFFFFF');
    vortexCore.addColorStop(0.3, rgba(opts.accentColor, 0.85));
    vortexCore.addColorStop(0.7, rgba(opts.primaryColor, 0.4));
    vortexCore.addColorStop(1,   'transparent');
    ctx.fillStyle = vortexCore;
    ctx.beginPath();
    ctx.arc(cx, cy - 2 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Corner intersection dots — where geometry meets
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 4 * s;
    const intersections: [number, number][] = [
      [cx, cy - 38 * s], [cx - 32 * s, cy + 18 * s], [cx + 32 * s, cy + 18 * s],
      [cx, cy + 32 * s], [cx - 30 * s, cy - 20 * s], [cx + 30 * s, cy - 20 * s],
    ];
    for (const [ix, iy] of intersections) {
      ctx.fillStyle = rgba(opts.accentColor, 0.50);
      ctx.beginPath();
      ctx.arc(ix, iy, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Devout (Orivani) ─────────────────────────────────────────────────────
  //
  // Humanoid with elaborate headdress/crown, warm-toned skin, ornate
  // gorget/collar, subtle halo, and a religious symbol on the forehead.
  // Stern but serene expression. Temple/crusader aesthetic.

  private drawDevout(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Warm cathedral ambient glow
    const warmGlow = ctx.createRadialGradient(cx, cy - 20 * s, 6 * s, cx, cy, 58 * s);
    warmGlow.addColorStop(0,   rgba(opts.accentColor, 0.10));
    warmGlow.addColorStop(0.5, rgba(opts.primaryColor, 0.05));
    warmGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = warmGlow;
    ctx.fillRect(0, 0, size, size);

    // Divine halo behind the head — soft golden ring
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 16 * s;
    const haloGrad = ctx.createRadialGradient(cx, cy - 18 * s, 28 * s, cx, cy - 18 * s, 42 * s);
    haloGrad.addColorStop(0,   'transparent');
    haloGrad.addColorStop(0.4, rgba(opts.accentColor, 0.15));
    haloGrad.addColorStop(0.7, rgba(opts.accentColor, 0.25));
    haloGrad.addColorStop(0.85, rgba(opts.accentColor, 0.10));
    haloGrad.addColorStop(1,   'transparent');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy - 18 * s, 42 * s, 0, Math.PI * 2);
    ctx.fill();
    // Halo ring line
    ctx.strokeStyle = rgba(opts.accentColor, 0.30);
    ctx.lineWidth   = 1.5 * s;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 18 * s, 36 * s, 36 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Elaborate headdress / crown — three pointed spires with ornamentation
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 6 * s;
    // Headdress base band
    const bandGrad = ctx.createLinearGradient(cx - 28 * s, cy - 38 * s, cx + 28 * s, cy - 38 * s);
    bandGrad.addColorStop(0,   darken(opts.secondaryColor, 10));
    bandGrad.addColorStop(0.5, lighten(opts.primaryColor, 20));
    bandGrad.addColorStop(1,   darken(opts.secondaryColor, 10));
    ctx.fillStyle = bandGrad;
    ctx.fillRect(cx - 28 * s, cy - 42 * s, 56 * s, 8 * s);
    // Ornamental line on band
    ctx.strokeStyle = rgba(opts.accentColor, 0.55);
    ctx.lineWidth   = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 26 * s, cy - 38 * s);
    ctx.lineTo(cx + 26 * s, cy - 38 * s);
    ctx.stroke();
    // Crown spires
    const spires: { x: number; h: number; w: number }[] = [
      { x: cx - 18 * s, h: 20 * s, w: 7 * s },
      { x: cx,          h: 28 * s, w: 8 * s },
      { x: cx + 18 * s, h: 20 * s, w: 7 * s },
    ];
    for (const sp of spires) {
      const spGrad = ctx.createLinearGradient(sp.x, cy - 42 * s, sp.x, cy - 42 * s - sp.h);
      spGrad.addColorStop(0,   opts.primaryColor);
      spGrad.addColorStop(0.6, lighten(opts.primaryColor, 25));
      spGrad.addColorStop(1,   opts.accentColor);
      ctx.fillStyle = spGrad;
      ctx.beginPath();
      ctx.moveTo(sp.x - sp.w, cy - 42 * s);
      ctx.lineTo(sp.x,        cy - 42 * s - sp.h);
      ctx.lineTo(sp.x + sp.w, cy - 42 * s);
      ctx.closePath();
      ctx.fill();
    }
    // Jewel on centre spire tip
    ctx.fillStyle   = opts.accentColor;
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 8 * s;
    ctx.beginPath();
    ctx.arc(cx, cy - 68 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Head shape — humanoid, slightly broader for authoritative look
    const headGrad = ctx.createRadialGradient(cx - 8 * s, cy - 16 * s, 2 * s, cx + 4 * s, cy + 6 * s, 40 * s);
    headGrad.addColorStop(0,    lighten(opts.primaryColor, 42));
    headGrad.addColorStop(0.3,  lighten(opts.primaryColor, 18));
    headGrad.addColorStop(0.6,  opts.primaryColor);
    headGrad.addColorStop(1,    darken(opts.primaryColor, 20));
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(cx,           cy - 38 * s);
    ctx.bezierCurveTo(cx + 20 * s, cy - 40 * s, cx + 30 * s, cy - 20 * s, cx + 28 * s, cy + 2 * s);
    ctx.bezierCurveTo(cx + 26 * s, cy + 26 * s, cx + 16 * s, cy + 36 * s, cx,           cy + 36 * s);
    ctx.bezierCurveTo(cx - 16 * s, cy + 36 * s, cx - 26 * s, cy + 26 * s, cx - 28 * s, cy + 2 * s);
    ctx.bezierCurveTo(cx - 30 * s, cy - 20 * s, cx - 20 * s, cy - 40 * s, cx,           cy - 38 * s);
    ctx.fill();

    // Cheekbone highlight
    const cheekHL = ctx.createRadialGradient(cx + 10 * s, cy - 2 * s, 2 * s, cx + 10 * s, cy + 4 * s, 16 * s);
    cheekHL.addColorStop(0, rgba(lighten(opts.primaryColor, 30), 0.22));
    cheekHL.addColorStop(1, 'transparent');
    ctx.fillStyle = cheekHL;
    ctx.beginPath();
    ctx.ellipse(cx + 10 * s, cy + 2 * s, 16 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Holy symbol on forehead — small radiant cross/star
    ctx.save();
    ctx.strokeStyle = rgba(opts.accentColor, 0.70);
    ctx.lineWidth   = 1.2 * s;
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 6 * s;
    const symX = cx;
    const symY = cy - 28 * s;
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(symX, symY - 5 * s);
    ctx.lineTo(symX, symY + 5 * s);
    ctx.stroke();
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(symX - 4 * s, symY);
    ctx.lineTo(symX + 4 * s, symY);
    ctx.stroke();
    // Diagonal lines (making it a star)
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(symX - 3 * s, symY - 3 * s);
    ctx.lineTo(symX + 3 * s, symY + 3 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(symX + 3 * s, symY - 3 * s);
    ctx.lineTo(symX - 3 * s, symY + 3 * s);
    ctx.stroke();
    // Centre jewel dot
    ctx.fillStyle = opts.accentColor;
    ctx.beginPath();
    ctx.arc(symX, symY, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Eyes — stern, warm-toned with golden irises
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 6 * s;
    const eyeY = cy - 9 * s;
    for (const ex of [cx - 13 * s, cx + 13 * s]) {
      // Socket shadow
      ctx.fillStyle = rgba('#000000', 0.25);
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 9 * s, 5.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Iris — golden
      const irisGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, 5.5 * s);
      irisGrad.addColorStop(0,   lighten(opts.accentColor, 30));
      irisGrad.addColorStop(0.5, opts.accentColor);
      irisGrad.addColorStop(1,   darken(opts.primaryColor, 10));
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(ex, eyeY, 5.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#060404';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Glint
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(ex - 2 * s, eyeY - 1.5 * s, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Nose — subtle
    ctx.fillStyle = rgba('#000000', 0.08);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5 * s, 3.5 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth — closed, stern
    ctx.strokeStyle = rgba('#000000', 0.22);
    ctx.lineWidth   = 1.3 * s;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 7 * s, cy + 18 * s);
    ctx.lineTo(cx + 7 * s, cy + 18 * s);
    ctx.stroke();

    // Ornate gorget / collar — armoured vestment below chin
    ctx.save();
    const gorgetGrad = ctx.createLinearGradient(cx - 30 * s, cy + 36 * s, cx + 30 * s, cy + 60 * s);
    gorgetGrad.addColorStop(0,   lighten(opts.secondaryColor, 15));
    gorgetGrad.addColorStop(0.5, opts.secondaryColor);
    gorgetGrad.addColorStop(1,   darken(opts.secondaryColor, 20));
    ctx.fillStyle = gorgetGrad;
    // Collar shape — wider than neck, curved
    ctx.beginPath();
    ctx.moveTo(cx - 30 * s, cy + 36 * s);
    ctx.lineTo(cx + 30 * s, cy + 36 * s);
    ctx.lineTo(cx + 26 * s, cy + 56 * s);
    ctx.bezierCurveTo(cx + 16 * s, cy + 62 * s, cx - 16 * s, cy + 62 * s, cx - 26 * s, cy + 56 * s);
    ctx.closePath();
    ctx.fill();
    // Gorget ornamental lines
    ctx.strokeStyle = rgba(opts.accentColor, 0.50);
    ctx.lineWidth   = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 28 * s, cy + 40 * s);
    ctx.lineTo(cx + 28 * s, cy + 40 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 26 * s, cy + 46 * s);
    ctx.lineTo(cx + 26 * s, cy + 46 * s);
    ctx.stroke();
    // Centre gorget jewel
    ctx.fillStyle   = opts.accentColor;
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur  = 6 * s;
    ctx.beginPath();
    ctx.arc(cx, cy + 43 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Volcanic (Pyrenth) ───────────────────────────────────────────────────
  //
  // Living mountain face — rough, rocky, angular cracked obsidian. Bright
  // orange/red magma veins running through the surface. Deep-set glowing
  // orange eyes. Heavy brow ridge, no visible mouth (sealed rock).

  private drawVolcanic(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s  = size / 128;

    // Volcanic ambient glow — warm red/orange from below
    const lavaGlow = ctx.createRadialGradient(cx, cy + 20 * s, 8 * s, cx, cy, 56 * s);
    lavaGlow.addColorStop(0,   rgba(opts.secondaryColor, 0.12));
    lavaGlow.addColorStop(0.5, rgba(opts.secondaryColor, 0.04));
    lavaGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = lavaGlow;
    ctx.fillRect(0, 0, size, size);

    // Main rocky head shape — angular, irregular, heavy
    const rockGrad = ctx.createRadialGradient(cx - 10 * s, cy - 18 * s, 3 * s, cx + 4 * s, cy + 4 * s, 48 * s);
    rockGrad.addColorStop(0,    lighten(opts.accentColor, 30));
    rockGrad.addColorStop(0.25, lighten(opts.accentColor, 12));
    rockGrad.addColorStop(0.55, opts.accentColor);
    rockGrad.addColorStop(0.8,  darken(opts.accentColor, 15));
    rockGrad.addColorStop(1,    darken(opts.accentColor, 30));
    ctx.fillStyle = rockGrad;

    ctx.beginPath();
    ctx.moveTo(cx - 16 * s, cy - 46 * s);   // crown left
    ctx.lineTo(cx + 8 * s,  cy - 48 * s);   // crown right (asymmetric)
    ctx.lineTo(cx + 22 * s, cy - 40 * s);   // upper brow right
    ctx.lineTo(cx + 38 * s, cy - 22 * s);   // brow far right
    ctx.lineTo(cx + 40 * s, cy - 4 * s);    // cheek right
    ctx.lineTo(cx + 36 * s, cy + 18 * s);   // jaw right
    ctx.lineTo(cx + 22 * s, cy + 38 * s);   // chin right
    ctx.lineTo(cx - 4 * s,  cy + 40 * s);   // chin centre (off-centre)
    ctx.lineTo(cx - 24 * s, cy + 34 * s);   // chin left
    ctx.lineTo(cx - 36 * s, cy + 14 * s);   // jaw left
    ctx.lineTo(cx - 40 * s, cy - 6 * s);    // cheek left
    ctx.lineTo(cx - 36 * s, cy - 26 * s);   // brow far left
    ctx.closePath();
    ctx.fill();

    // Rock surface texture — tiny crack lines creating a faceted surface
    ctx.save();
    ctx.strokeStyle = rgba('#000000', 0.30);
    ctx.lineWidth   = 0.6 * s;
    const cracks: [number, number, number, number][] = [
      // Large structural cracks
      [cx - 4 * s,  cy - 46 * s, cx - 8 * s,  cy + 4 * s],
      [cx + 12 * s, cy - 44 * s, cx + 6 * s,  cy + 10 * s],
      [cx - 30 * s, cy - 18 * s, cx + 4 * s,  cy + 4 * s],
      [cx + 30 * s, cy - 14 * s, cx + 2 * s,  cy + 10 * s],
      // Medium cracks
      [cx - 20 * s, cy - 32 * s, cx - 28 * s, cy - 10 * s],
      [cx + 24 * s, cy - 30 * s, cx + 32 * s, cy - 4 * s],
      [cx - 18 * s, cy + 10 * s, cx - 30 * s, cy + 28 * s],
      [cx + 16 * s, cy + 14 * s, cx + 28 * s, cy + 32 * s],
      // Small detail cracks
      [cx - 12 * s, cy - 14 * s, cx - 22 * s, cy - 4 * s],
      [cx + 14 * s, cy - 10 * s, cx + 24 * s, cy + 2 * s],
      [cx - 6 * s,  cy + 18 * s, cx - 16 * s, cy + 30 * s],
      [cx + 8 * s,  cy + 20 * s, cx + 18 * s, cy + 34 * s],
      [cx - 34 * s, cy + 2 * s,  cx - 20 * s, cy + 18 * s],
      [cx + 34 * s, cy + 4 * s,  cx + 20 * s, cy + 20 * s],
    ];
    for (const [x1, y1, x2, y2] of cracks) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Glowing magma veins — bright orange/red lines in the cracks
    ctx.save();
    ctx.lineCap     = 'round';
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 8 * s;

    const magmaVeins: { pts: [number, number][]; w: number }[] = [
      // Main vertical vein
      { pts: [[cx - 4 * s, cy - 40 * s], [cx - 6 * s, cy - 14 * s], [cx - 8 * s, cy + 4 * s]], w: 1.8 },
      // Cross veins
      { pts: [[cx - 28 * s, cy - 14 * s], [cx - 16 * s, cy - 6 * s], [cx + 2 * s, cy + 4 * s]], w: 1.4 },
      { pts: [[cx + 28 * s, cy - 10 * s], [cx + 16 * s, cy - 2 * s], [cx + 4 * s, cy + 8 * s]], w: 1.4 },
      // Lower veins
      { pts: [[cx - 16 * s, cy + 12 * s], [cx - 24 * s, cy + 22 * s], [cx - 28 * s, cy + 30 * s]], w: 1.2 },
      { pts: [[cx + 14 * s, cy + 16 * s], [cx + 22 * s, cy + 26 * s], [cx + 26 * s, cy + 34 * s]], w: 1.2 },
      // Small branch veins
      { pts: [[cx - 20 * s, cy - 28 * s], [cx - 26 * s, cy - 16 * s]], w: 1.0 },
      { pts: [[cx + 22 * s, cy - 26 * s], [cx + 30 * s, cy - 10 * s]], w: 1.0 },
    ];

    for (const vein of magmaVeins) {
      // Outer wide glow
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.25);
      ctx.lineWidth   = (vein.w + 3) * s;
      ctx.beginPath();
      ctx.moveTo(vein.pts[0]![0]!, vein.pts[0]![1]!);
      for (let i = 1; i < vein.pts.length; i++) {
        ctx.lineTo(vein.pts[i]![0]!, vein.pts[i]![1]!);
      }
      ctx.stroke();

      // Inner bright vein
      const veinGrad = ctx.createLinearGradient(
        vein.pts[0]![0]!, vein.pts[0]![1]!,
        vein.pts[vein.pts.length - 1]![0]!, vein.pts[vein.pts.length - 1]![1]!,
      );
      veinGrad.addColorStop(0,   lighten(opts.secondaryColor, 40));
      veinGrad.addColorStop(0.5, opts.secondaryColor);
      veinGrad.addColorStop(1,   darken(opts.secondaryColor, 20));
      ctx.strokeStyle = veinGrad;
      ctx.lineWidth   = vein.w * s;
      ctx.beginPath();
      ctx.moveTo(vein.pts[0]![0]!, vein.pts[0]![1]!);
      for (let i = 1; i < vein.pts.length; i++) {
        ctx.lineTo(vein.pts[i]![0]!, vein.pts[i]![1]!);
      }
      ctx.stroke();

      // White-hot core (thin)
      ctx.strokeStyle = rgba('#FFDD88', 0.30);
      ctx.lineWidth   = vein.w * 0.35 * s;
      ctx.beginPath();
      ctx.moveTo(vein.pts[0]![0]!, vein.pts[0]![1]!);
      for (let i = 1; i < vein.pts.length; i++) {
        ctx.lineTo(vein.pts[i]![0]!, vein.pts[i]![1]!);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Heavy overhanging brow ridge — dark and massive
    ctx.fillStyle = darken(opts.accentColor, 40);
    ctx.beginPath();
    ctx.moveTo(cx - 36 * s, cy - 26 * s);
    ctx.lineTo(cx + 38 * s, cy - 22 * s);
    ctx.lineTo(cx + 36 * s, cy - 14 * s);
    ctx.lineTo(cx - 34 * s, cy - 18 * s);
    ctx.closePath();
    ctx.fill();
    // Brow ridge highlight edge
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.15);
    ctx.lineWidth   = 0.6 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 35 * s, cy - 25 * s);
    ctx.lineTo(cx + 37 * s, cy - 21 * s);
    ctx.stroke();

    // Deep-set glowing eyes — recessed in darkness, orange/red from within
    ctx.save();
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 14 * s;
    const eyeY = cy - 8 * s;
    for (const ex of [cx - 16 * s, cx + 16 * s]) {
      // Deep socket recess
      ctx.fillStyle = '#080402';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 10 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Inner glow
      const eyeGlow = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, 8 * s);
      eyeGlow.addColorStop(0,   lighten(opts.secondaryColor, 50));
      eyeGlow.addColorStop(0.3, opts.secondaryColor);
      eyeGlow.addColorStop(0.6, rgba(opts.secondaryColor, 0.5));
      eyeGlow.addColorStop(1,   'transparent');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 8 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      ctx.fillStyle = '#FFCC44';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // No mouth — sealed rock. Just a dark line suggestion.
    ctx.strokeStyle = rgba('#000000', 0.40);
    ctx.lineWidth   = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy + 22 * s);
    ctx.lineTo(cx + 10 * s, cy + 24 * s);
    ctx.stroke();

    // Crystalline sparkle — tiny reflective points on the rock surface
    ctx.save();
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur  = 2 * s;
    ctx.fillStyle   = 'rgba(255,255,255,0.35)';
    const sparkles: [number, number][] = [
      [cx - 22 * s, cy - 32 * s], [cx + 18 * s, cy - 36 * s],
      [cx - 30 * s, cy + 4 * s],  [cx + 32 * s, cy + 2 * s],
      [cx - 8 * s,  cy + 28 * s], [cx + 12 * s, cy + 30 * s],
      [cx + 26 * s, cy - 18 * s], [cx - 28 * s, cy - 8 * s],
      [cx + 6 * s,  cy - 28 * s], [cx - 14 * s, cy + 16 * s],
    ];
    for (const [spx, spy] of sparkles) {
      ctx.beginPath();
      ctx.arc(spx, spy, 0.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Neck / rock column — rough continuation
    const neckGrad = ctx.createLinearGradient(cx, cy + 38 * s, cx, cy + 62 * s);
    neckGrad.addColorStop(0, rgba(opts.accentColor, 0.80));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 20 * s, cy + 38 * s);
    ctx.lineTo(cx + 20 * s, cy + 38 * s);
    ctx.lineTo(cx + 14 * s, cy + 62 * s);
    ctx.lineTo(cx - 14 * s, cy + 62 * s);
    ctx.closePath();
    ctx.fill();
    // Magma vein continuing into neck
    ctx.save();
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.45);
    ctx.lineWidth   = 1.2 * s;
    ctx.shadowColor = opts.secondaryColor;
    ctx.shadowBlur  = 6 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 2 * s, cy + 38 * s);
    ctx.lineTo(cx,          cy + 60 * s);
    ctx.stroke();
    ctx.restore();
  }

  // ── Fallback portrait ─────────────────────────────────────────────────────

  private renderFallback(speciesId: string, size: number): string {
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, size, size);

    const hue   = Array.from(speciesId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
    const color = `hsl(${hue},60%,55%)`;

    const grad = ctx.createRadialGradient(
      size * 0.4, size * 0.38, size * 0.04,
      size * 0.5, size * 0.5,  size * 0.5,
    );
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle     = 'rgba(255,255,255,0.8)';
    ctx.font          = `bold ${size * 0.36}px monospace`;
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(speciesId.charAt(0).toUpperCase(), size * 0.5, size * 0.52);

    return canvas.toDataURL('image/png');
  }
}
