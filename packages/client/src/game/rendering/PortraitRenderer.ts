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
  | 'amorphous';

export interface PortraitOptions {
  baseShape: BaseShape;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  features: string[];
}

// ── Per-species portrait definitions ─────────────────────────────────────────

const SPECIES_PORTRAITS: Record<string, PortraitOptions> = {
  vaelori: {
    baseShape: 'crystalline',
    primaryColor: '#9b6fc8',
    secondaryColor: '#c8a8f0',
    accentColor: '#00f0ff',
    features: ['eyes_crystal', 'psionic_aura', 'facets'],
  },
  khazari: {
    baseShape: 'reptilian',
    primaryColor: '#8b3a2a',
    secondaryColor: '#c04a30',
    accentColor: '#d4a800',
    features: ['slit_eyes', 'scales', 'brow_ridges', 'metal_plates'],
  },
  sylvani: {
    baseShape: 'botanical',
    primaryColor: '#2a7a4a',
    secondaryColor: '#3aaa6a',
    accentColor: '#c8ff44',
    features: ['bioluminescent_spots', 'fronds', 'tendrils'],
  },
  nexari: {
    baseShape: 'cybernetic',
    primaryColor: '#8090a0',
    secondaryColor: '#c0d8f0',
    accentColor: '#00aaff',
    features: ['circuit_lines', 'single_eye', 'data_display', 'half_mechanical'],
  },
  drakmari: {
    baseShape: 'aquatic',
    primaryColor: '#1a4a7a',
    secondaryColor: '#2a8aaa',
    accentColor: '#00f0c0',
    features: ['gill_slits', 'shark_jaw', 'bioluminescent_spots', 'sharp_teeth'],
  },
  teranos: {
    baseShape: 'humanoid',
    primaryColor: '#c08060',
    secondaryColor: '#e0a880',
    accentColor: '#60b0ff',
    features: ['warm_eyes', 'tech_visor'],
  },
  zorvathi: {
    baseShape: 'insectoid',
    primaryColor: '#3a2a18',
    secondaryColor: '#6a4a28',
    accentColor: '#d4820a',
    features: ['compound_eyes', 'mandibles', 'antennae', 'chitin_segments'],
  },
  ashkari: {
    baseShape: 'humanoid',
    primaryColor: '#6a5a48',
    secondaryColor: '#8a7a68',
    accentColor: '#d4920a',
    features: ['glowing_amber_eyes', 'hood_suggestion', 'salvaged_tech', 'scars'],
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

    this.drawBackground(ctx, size, options.primaryColor);

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
    }

    return canvas.toDataURL('image/png');
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(ctx: CanvasRenderingContext2D, size: number, primaryColor: string): void {
    // Deep space background
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, size, size);

    // Subtle radial vignette from top-left (light source)
    const bg = ctx.createRadialGradient(
      size * 0.35, size * 0.3, size * 0.05,
      size * 0.5, size * 0.5, size * 0.85,
    );
    bg.addColorStop(0, rgba(primaryColor, 0.12));
    bg.addColorStop(0.6, rgba(primaryColor, 0.04));
    bg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Corner stars/sparkles (very faint)
    ctx.fillStyle = 'rgba(200,220,255,0.3)';
    const starPositions = [
      [0.08, 0.06], [0.92, 0.09], [0.04, 0.88], [0.96, 0.85],
      [0.15, 0.92], [0.88, 0.14], [0.02, 0.45], [0.97, 0.55],
    ];
    for (const [sx, sy] of starPositions) {
      ctx.beginPath();
      ctx.arc(sx! * size, sy! * size, size * 0.004, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Crystalline (Vaelori) ──────────────────────────────────────────────────

  private drawCrystalline(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s = size / 128;

    // Psionic aura glow behind the head
    if (opts.features.includes('psionic_aura')) {
      const aura = ctx.createRadialGradient(cx, cy - 8 * s, 4 * s, cx, cy - 8 * s, 52 * s);
      aura.addColorStop(0, rgba(opts.accentColor, 0.18));
      aura.addColorStop(0.5, rgba(opts.accentColor, 0.08));
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, size, size);
    }

    // Main crystalline head — a tall hexagonal/faceted shape
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur = 10 * s;

    // Outer crystal face gradient
    const faceGrad = ctx.createLinearGradient(cx - 28 * s, cy - 40 * s, cx + 28 * s, cy + 32 * s);
    faceGrad.addColorStop(0, lighten(opts.primaryColor, 50));
    faceGrad.addColorStop(0.4, opts.primaryColor);
    faceGrad.addColorStop(1, rgba(opts.primaryColor, 0.6));
    ctx.fillStyle = faceGrad;

    // Hexagonal crystal face path
    ctx.beginPath();
    ctx.moveTo(cx, cy - 44 * s);           // top
    ctx.lineTo(cx + 30 * s, cy - 24 * s);  // top-right
    ctx.lineTo(cx + 26 * s, cy + 16 * s);  // right
    ctx.lineTo(cx + 14 * s, cy + 32 * s);  // bottom-right
    ctx.lineTo(cx - 14 * s, cy + 32 * s);  // bottom-left
    ctx.lineTo(cx - 26 * s, cy + 16 * s);  // left
    ctx.lineTo(cx - 30 * s, cy - 24 * s);  // top-left
    ctx.closePath();
    ctx.fill();

    // Crystal edge highlight lines (facets)
    ctx.strokeStyle = rgba(opts.accentColor, 0.6);
    ctx.lineWidth = 0.8 * s;
    // Vertical center crease
    ctx.beginPath();
    ctx.moveTo(cx, cy - 44 * s);
    ctx.lineTo(cx - 4 * s, cy + 32 * s);
    ctx.stroke();
    // Left facet crease
    ctx.beginPath();
    ctx.moveTo(cx - 30 * s, cy - 24 * s);
    ctx.lineTo(cx - 8 * s, cy + 10 * s);
    ctx.stroke();
    // Right facet crease
    ctx.beginPath();
    ctx.moveTo(cx + 30 * s, cy - 24 * s);
    ctx.lineTo(cx + 8 * s, cy + 10 * s);
    ctx.stroke();

    ctx.restore();

    // Crystal "crown" spikes on top
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur = 6 * s;
    ctx.fillStyle = lighten(opts.secondaryColor, 20);
    const spikes = [
      { x: cx - 16 * s, y: cy - 42 * s, h: 14 * s },
      { x: cx, y: cy - 46 * s, h: 18 * s },
      { x: cx + 16 * s, y: cy - 42 * s, h: 14 * s },
    ];
    for (const sp of spikes) {
      ctx.beginPath();
      ctx.moveTo(sp.x - 5 * s, sp.y);
      ctx.lineTo(sp.x, sp.y - sp.h);
      ctx.lineTo(sp.x + 5 * s, sp.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Multiple crystal eyes — glowing dots arranged in a subtle pattern
    const eyePositions = [
      { x: cx - 14 * s, y: cy - 10 * s, r: 4.5 * s },
      { x: cx + 14 * s, y: cy - 10 * s, r: 4.5 * s },
      { x: cx - 22 * s, y: cy - 2 * s, r: 2.5 * s },
      { x: cx + 22 * s, y: cy - 2 * s, r: 2.5 * s },
      { x: cx, y: cy - 18 * s, r: 3 * s },
    ];

    for (const eye of eyePositions) {
      // Outer glow
      const eyeGlow = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eye.r * 2.5);
      eyeGlow.addColorStop(0, rgba(opts.accentColor, 0.5));
      eyeGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, eye.r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 8 * s;
      ctx.fillStyle = opts.accentColor;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bottom neck/base — tapered crystal
    const neckGrad = ctx.createLinearGradient(cx, cy + 32 * s, cx, cy + 56 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.8));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy + 32 * s);
    ctx.lineTo(cx + 14 * s, cy + 32 * s);
    ctx.lineTo(cx + 8 * s, cy + 56 * s);
    ctx.lineTo(cx - 8 * s, cy + 56 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ── Reptilian (Khazari) ────────────────────────────────────────────────────

  private drawReptilian(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s = size / 128;

    // Heavy reptilian head — wide, angular, low brow
    const headGrad = ctx.createRadialGradient(cx - 8 * s, cy - 16 * s, 4 * s, cx, cy, 40 * s);
    headGrad.addColorStop(0, lighten(opts.primaryColor, 30));
    headGrad.addColorStop(0.5, opts.primaryColor);
    headGrad.addColorStop(1, rgba(opts.primaryColor, 0.5));
    ctx.fillStyle = headGrad;

    // Angular head shape: wide jaw, heavy brow ridge
    ctx.beginPath();
    ctx.moveTo(cx - 10 * s, cy - 44 * s);   // top-left crown
    ctx.lineTo(cx + 10 * s, cy - 44 * s);   // top-right crown
    ctx.lineTo(cx + 36 * s, cy - 28 * s);   // brow right
    ctx.lineTo(cx + 38 * s, cy - 8 * s);    // cheek right
    ctx.lineTo(cx + 34 * s, cy + 14 * s);   // jaw right
    ctx.lineTo(cx + 24 * s, cy + 32 * s);   // chin right
    ctx.lineTo(cx - 24 * s, cy + 32 * s);   // chin left
    ctx.lineTo(cx - 34 * s, cy + 14 * s);   // jaw left
    ctx.lineTo(cx - 38 * s, cy - 8 * s);    // cheek left
    ctx.lineTo(cx - 36 * s, cy - 28 * s);   // brow left
    ctx.closePath();
    ctx.fill();

    // Brow ridge (darker, protruding)
    ctx.fillStyle = rgba('#000000', 0.35);
    ctx.beginPath();
    ctx.moveTo(cx - 36 * s, cy - 28 * s);
    ctx.lineTo(cx + 36 * s, cy - 28 * s);
    ctx.lineTo(cx + 34 * s, cy - 18 * s);
    ctx.lineTo(cx - 34 * s, cy - 18 * s);
    ctx.closePath();
    ctx.fill();

    // Scale pattern — overlapping arc texture
    if (opts.features.includes('scales')) {
      ctx.strokeStyle = rgba('#000000', 0.18);
      ctx.lineWidth = 0.7 * s;
      for (let row = 0; row < 6; row++) {
        for (let col = -4; col <= 4; col++) {
          const sx = cx + col * 9 * s + (row % 2 === 0 ? 0 : 4.5 * s);
          const sy = cy - 20 * s + row * 8 * s;
          ctx.beginPath();
          ctx.arc(sx, sy, 5 * s, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Slit eyes
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur = 6 * s;
    const eyeY = cy - 8 * s;
    for (const ex of [cx - 16 * s, cx + 16 * s]) {
      // Eye white / iris
      ctx.fillStyle = opts.accentColor;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 7 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Vertical pupil
      ctx.fillStyle = '#080808';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 2 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Metal plate accent (right side — industrial)
    if (opts.features.includes('metal_plates')) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4 * s;
      const platex = cx + 18 * s;
      const platey = cy - 30 * s;
      ctx.fillStyle = '#505058';
      ctx.fillRect(platex, platey, 16 * s, 8 * s);
      ctx.fillRect(platex + 2 * s, platey + 10 * s, 14 * s, 6 * s);
      // Bolt details
      ctx.fillStyle = '#808090';
      for (const [bx, by] of [
        [platex + 2 * s, platey + 2 * s],
        [platex + 12 * s, platey + 2 * s],
        [platex + 2 * s, platey + 12 * s],
        [platex + 12 * s, platey + 12 * s],
      ]) {
        ctx.beginPath();
        ctx.arc(bx!, by!, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Jaw — prominent, slightly lighter
    const jawGrad = ctx.createLinearGradient(cx, cy + 10 * s, cx, cy + 38 * s);
    jawGrad.addColorStop(0, rgba(opts.primaryColor, 0.9));
    jawGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = jawGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 24 * s, cy + 32 * s);
    ctx.lineTo(cx + 24 * s, cy + 32 * s);
    ctx.lineTo(cx + 16 * s, cy + 54 * s);
    ctx.lineTo(cx - 16 * s, cy + 54 * s);
    ctx.closePath();
    ctx.fill();

    // Neck ridge
    ctx.strokeStyle = rgba(opts.secondaryColor, 0.5);
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 32 * s);
    ctx.lineTo(cx, cy + 54 * s);
    ctx.stroke();
  }

  // ── Botanical (Sylvani) ────────────────────────────────────────────────────

  private drawBotanical(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s = size / 128;

    // Vine tendrils framing the face (behind everything)
    if (opts.features.includes('tendrils')) {
      ctx.save();
      ctx.strokeStyle = rgba(opts.primaryColor, 0.55);
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      const tendrilPaths = [
        { pts: [{ x: cx - 28 * s, y: cy + 10 * s }, { x: cx - 40 * s, y: cy - 20 * s }, { x: cx - 48 * s, y: cy - 44 * s }] },
        { pts: [{ x: cx + 28 * s, y: cy + 10 * s }, { x: cx + 42 * s, y: cy - 15 * s }, { x: cx + 52 * s, y: cy - 42 * s }] },
        { pts: [{ x: cx - 24 * s, y: cy + 20 * s }, { x: cx - 50 * s, y: cy + 10 * s }, { x: cx - 54 * s, y: cy - 10 * s }] },
        { pts: [{ x: cx + 24 * s, y: cy + 20 * s }, { x: cx + 50 * s, y: cy + 10 * s }, { x: cx + 52 * s, y: cy - 10 * s }] },
      ];
      for (const tp of tendrilPaths) {
        ctx.beginPath();
        ctx.moveTo(tp.pts[0]!.x, tp.pts[0]!.y);
        ctx.quadraticCurveTo(tp.pts[1]!.x, tp.pts[1]!.y, tp.pts[2]!.x, tp.pts[2]!.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Leaf fronds on top
    if (opts.features.includes('fronds')) {
      ctx.save();
      ctx.shadowColor = rgba(opts.accentColor, 0.4);
      ctx.shadowBlur = 6 * s;
      const fronds = [
        { x: cx - 20 * s, y: cy - 48 * s, angle: -0.4 },
        { x: cx, y: cy - 52 * s, angle: 0 },
        { x: cx + 20 * s, y: cy - 48 * s, angle: 0.4 },
        { x: cx - 36 * s, y: cy - 38 * s, angle: -0.8 },
        { x: cx + 36 * s, y: cy - 38 * s, angle: 0.8 },
      ];
      for (const fr of fronds) {
        ctx.save();
        ctx.translate(fr.x, fr.y);
        ctx.rotate(fr.angle);
        const lg = ctx.createLinearGradient(0, 0, 0, -18 * s);
        lg.addColorStop(0, opts.secondaryColor);
        lg.addColorStop(1, opts.accentColor);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-6 * s, -6 * s, -8 * s, -14 * s, 0, -20 * s);
        ctx.bezierCurveTo(8 * s, -14 * s, 6 * s, -6 * s, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Main organic head — flowing, rounded
    const headGrad = ctx.createRadialGradient(cx - 8 * s, cy - 18 * s, 4 * s, cx, cy, 36 * s);
    headGrad.addColorStop(0, lighten(opts.primaryColor, 40));
    headGrad.addColorStop(0.5, opts.primaryColor);
    headGrad.addColorStop(1, rgba(opts.primaryColor, 0.55));
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(cx, cy - 38 * s);
    ctx.bezierCurveTo(cx + 22 * s, cy - 42 * s, cx + 34 * s, cy - 20 * s, cx + 30 * s, cy + 4 * s);
    ctx.bezierCurveTo(cx + 26 * s, cy + 28 * s, cx + 16 * s, cy + 36 * s, cx, cy + 36 * s);
    ctx.bezierCurveTo(cx - 16 * s, cy + 36 * s, cx - 26 * s, cy + 28 * s, cx - 30 * s, cy + 4 * s);
    ctx.bezierCurveTo(cx - 34 * s, cy - 20 * s, cx - 22 * s, cy - 42 * s, cx, cy - 38 * s);
    ctx.fill();

    // Bioluminescent spots
    if (opts.features.includes('bioluminescent_spots')) {
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 8 * s;
      const spotPositions = [
        { x: cx - 14 * s, y: cy - 8 * s, r: 3 * s },
        { x: cx + 14 * s, y: cy - 8 * s, r: 3 * s },
        { x: cx, y: cy - 22 * s, r: 2.5 * s },
        { x: cx - 20 * s, y: cy + 8 * s, r: 2 * s },
        { x: cx + 20 * s, y: cy + 8 * s, r: 2 * s },
        { x: cx - 8 * s, y: cy + 18 * s, r: 1.5 * s },
        { x: cx + 8 * s, y: cy + 18 * s, r: 1.5 * s },
        { x: cx, y: cy + 26 * s, r: 1.8 * s },
      ];
      for (const sp of spotPositions) {
        const glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r * 2.5);
        glow.addColorStop(0, rgba(opts.accentColor, 0.6));
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = opts.accentColor;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Eyes (bioluminescent spots serve as eyes too — large center pair emphasized)
    // Add leaf-like eye highlights
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur = 10 * s;
    for (const ex of [cx - 14 * s, cx + 14 * s]) {
      ctx.strokeStyle = rgba(opts.accentColor, 0.7);
      ctx.lineWidth = s;
      ctx.beginPath();
      ctx.ellipse(ex, cy - 8 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Neck/stem
    const neckGrad = ctx.createLinearGradient(cx, cy + 36 * s, cx, cy + 58 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.7));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 47 * s, 10 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Cybernetic (Nexari) ────────────────────────────────────────────────────

  private drawCybernetic(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s = size / 128;

    // Half and half: left organic / right mechanical
    const midX = cx + 2 * s;

    // Organic left half (pale, soft)
    const organicGrad = ctx.createRadialGradient(cx - 16 * s, cy - 12 * s, 4 * s, cx, cy, 38 * s);
    organicGrad.addColorStop(0, '#d0d8e0');
    organicGrad.addColorStop(0.6, '#8090a0');
    organicGrad.addColorStop(1, rgba('#5a6a7a', 0.5));
    ctx.fillStyle = organicGrad;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(midX, cy - 42 * s);
    ctx.bezierCurveTo(midX - 10 * s, cy - 45 * s, midX - 28 * s, cy - 32 * s, midX - 32 * s, cy - 4 * s);
    ctx.bezierCurveTo(midX - 32 * s, cy + 22 * s, midX - 18 * s, cy + 36 * s, midX, cy + 36 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Mechanical right half
    const mechGrad = ctx.createLinearGradient(midX, cy - 42 * s, midX + 36 * s, cy + 36 * s);
    mechGrad.addColorStop(0, '#c0c8d0');
    mechGrad.addColorStop(0.4, opts.secondaryColor);
    mechGrad.addColorStop(1, '#304050');
    ctx.fillStyle = mechGrad;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(midX, cy - 42 * s);
    ctx.lineTo(midX + 28 * s, cy - 30 * s);
    ctx.lineTo(midX + 34 * s, cy - 6 * s);
    ctx.lineTo(midX + 30 * s, cy + 16 * s);
    ctx.lineTo(midX + 20 * s, cy + 36 * s);
    ctx.lineTo(midX, cy + 36 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Mechanical panel lines and plating
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8 * s;
    // Horizontal plate seams
    for (let i = 0; i < 4; i++) {
      const y = cy - 28 * s + i * 16 * s;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(midX + 32 * s, y);
      ctx.stroke();
    }
    // Vertical seam
    ctx.beginPath();
    ctx.moveTo(midX + 16 * s, cy - 28 * s);
    ctx.lineTo(midX + 18 * s, cy + 36 * s);
    ctx.stroke();
    ctx.restore();

    // Circuit lines on mechanical side
    if (opts.features.includes('circuit_lines')) {
      ctx.save();
      ctx.strokeStyle = rgba(opts.accentColor, 0.65);
      ctx.lineWidth = 0.7 * s;
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 4 * s;
      // Main trunk
      ctx.beginPath();
      ctx.moveTo(midX + 8 * s, cy - 26 * s);
      ctx.lineTo(midX + 8 * s, cy + 10 * s);
      ctx.stroke();
      // Branches
      const branches = [
        [midX + 8 * s, cy - 16 * s, midX + 24 * s, cy - 16 * s],
        [midX + 8 * s, cy - 4 * s, midX + 22 * s, cy - 4 * s],
        [midX + 8 * s, cy + 8 * s, midX + 20 * s, cy + 8 * s],
        [midX + 24 * s, cy - 16 * s, midX + 24 * s, cy - 8 * s],
      ] as const;
      for (const [x1, y1, x2, y2] of branches) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // Node dots
        ctx.fillStyle = rgba(opts.accentColor, 0.9);
        ctx.beginPath();
        ctx.arc(x2, y2, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Organic eye (left side)
    ctx.save();
    ctx.shadowColor = '#6090b0';
    ctx.shadowBlur = 6 * s;
    const orgEyeX = cx - 12 * s;
    const orgEyeY = cy - 8 * s;
    ctx.fillStyle = '#3a5a70';
    ctx.beginPath();
    ctx.ellipse(orgEyeX, orgEyeY, 8 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a3a50';
    ctx.beginPath();
    ctx.arc(orgEyeX, orgEyeY, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(orgEyeX - 2 * s, orgEyeY - 2 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Data readout display (mechanical side)
    if (opts.features.includes('data_display')) {
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 8 * s;
      const dispX = midX + 6 * s;
      const dispY = cy - 18 * s;
      ctx.strokeStyle = rgba(opts.accentColor, 0.7);
      ctx.lineWidth = 0.6 * s;
      ctx.strokeRect(dispX, dispY, 20 * s, 12 * s);
      // Scan lines in display
      ctx.strokeStyle = rgba(opts.accentColor, 0.3);
      ctx.lineWidth = 0.4 * s;
      for (let ln = 0; ln < 4; ln++) {
        ctx.beginPath();
        ctx.moveTo(dispX + 2 * s, dispY + 2.5 * s + ln * 2.5 * s);
        ctx.lineTo(dispX + 18 * s, dispY + 2.5 * s + ln * 2.5 * s);
        ctx.stroke();
      }
      // Active scan dot
      ctx.fillStyle = opts.accentColor;
      ctx.beginPath();
      ctx.arc(dispX + 16 * s, dispY + 2 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dividing seam between organic / mechanical
    ctx.save();
    ctx.strokeStyle = rgba('#a0b8d0', 0.7);
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(midX, cy - 42 * s);
    ctx.lineTo(midX + 2 * s, cy + 36 * s);
    ctx.stroke();
    ctx.restore();

    // Neck
    const neckGrad = ctx.createLinearGradient(cx, cy + 36 * s, cx, cy + 56 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.8));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 46 * s, 12 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Aquatic (Drakmari) ────────────────────────────────────────────────────

  private drawAquatic(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s = size / 128;

    // Main head — shark-like angular shape
    const headGrad = ctx.createRadialGradient(cx - 6 * s, cy - 18 * s, 4 * s, cx, cy, 42 * s);
    headGrad.addColorStop(0, lighten(opts.secondaryColor, 20));
    headGrad.addColorStop(0.5, opts.primaryColor);
    headGrad.addColorStop(1, rgba(opts.primaryColor, 0.4));
    ctx.fillStyle = headGrad;

    // Streamlined angular head
    ctx.beginPath();
    ctx.moveTo(cx, cy - 46 * s);            // top
    ctx.lineTo(cx + 28 * s, cy - 28 * s);  // upper right
    ctx.lineTo(cx + 34 * s, cy - 2 * s);   // mid right
    ctx.lineTo(cx + 30 * s, cy + 18 * s);  // lower right
    ctx.lineTo(cx + 20 * s, cy + 36 * s);  // jaw right
    ctx.lineTo(cx, cy + 38 * s);            // chin
    ctx.lineTo(cx - 20 * s, cy + 36 * s);  // jaw left
    ctx.lineTo(cx - 30 * s, cy + 18 * s);  // lower left
    ctx.lineTo(cx - 34 * s, cy - 2 * s);   // mid left
    ctx.lineTo(cx - 28 * s, cy - 28 * s);  // upper left
    ctx.closePath();
    ctx.fill();

    // Lighter underbelly — lower face gradient
    const bellyGrad = ctx.createLinearGradient(cx, cy + 4 * s, cx, cy + 38 * s);
    bellyGrad.addColorStop(0, 'transparent');
    bellyGrad.addColorStop(1, rgba(lighten(opts.secondaryColor, 40), 0.45));
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 30 * s, cy + 18 * s);
    ctx.lineTo(cx + 30 * s, cy + 18 * s);
    ctx.lineTo(cx + 20 * s, cy + 36 * s);
    ctx.lineTo(cx, cy + 38 * s);
    ctx.lineTo(cx - 20 * s, cy + 36 * s);
    ctx.closePath();
    ctx.fill();

    // Gill slits on sides
    if (opts.features.includes('gill_slits')) {
      ctx.save();
      ctx.strokeStyle = rgba('#000000', 0.5);
      ctx.lineWidth = 1.2 * s;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const gy = cy - 4 * s + i * 10 * s;
        // Left gills
        ctx.beginPath();
        ctx.moveTo(cx - 28 * s, gy);
        ctx.quadraticCurveTo(cx - 34 * s, gy + 4 * s, cx - 28 * s, gy + 8 * s);
        ctx.stroke();
        // Right gills
        ctx.beginPath();
        ctx.moveTo(cx + 28 * s, gy);
        ctx.quadraticCurveTo(cx + 34 * s, gy + 4 * s, cx + 28 * s, gy + 8 * s);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Eyes — forward-facing predator eyes
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur = 8 * s;
    const eyeY = cy - 14 * s;
    for (const ex of [cx - 16 * s, cx + 16 * s]) {
      // Outer sclera
      ctx.fillStyle = '#e8e8d0';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 8 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Iris
      ctx.fillStyle = '#1a6a4a';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#060606';
      ctx.beginPath();
      ctx.arc(ex, eyeY, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      // Glint
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(ex - 2 * s, eyeY - 1.5 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Multiple rows of sharp teeth — small white triangles along jaw
    if (opts.features.includes('sharp_teeth')) {
      ctx.save();
      ctx.fillStyle = '#f0ede0';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2 * s;
      const jawY = cy + 30 * s;
      const numTeeth = 10;
      const jawWidth = 32 * s;
      for (let t = 0; t < numTeeth; t++) {
        const tx = cx - jawWidth / 2 + (t + 0.5) * (jawWidth / numTeeth);
        const toothH = t % 2 === 0 ? 5 * s : 3.5 * s;
        ctx.beginPath();
        ctx.moveTo(tx - 2 * s, jawY);
        ctx.lineTo(tx, jawY - toothH);
        ctx.lineTo(tx + 2 * s, jawY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Bioluminescent markings along jaw
    if (opts.features.includes('bioluminescent_spots')) {
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 8 * s;
      const markY = cy + 22 * s;
      for (let i = 0; i < 6; i++) {
        const mx = cx - 20 * s + i * 8 * s;
        ctx.fillStyle = rgba(opts.accentColor, 0.85);
        ctx.beginPath();
        ctx.arc(mx, markY, 2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cheek marks
      for (const sx of [cx - 26 * s, cx + 26 * s]) {
        ctx.fillStyle = rgba(opts.accentColor, 0.7);
        ctx.beginPath();
        ctx.arc(sx, cy, 1.8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, cy + 10 * s, 1.4 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Neck
    const neckGrad = ctx.createLinearGradient(cx, cy + 38 * s, cx, cy + 58 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.7));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 16 * s, cy + 38 * s);
    ctx.lineTo(cx + 16 * s, cy + 38 * s);
    ctx.lineTo(cx + 12 * s, cy + 58 * s);
    ctx.lineTo(cx - 12 * s, cy + 58 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ── Humanoid (Teranos / Ashkari) ──────────────────────────────────────────

  private drawHumanoid(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s = size / 128;

    const isAshkari = opts.features.includes('hood_suggestion');

    // Hood / cloak shadow for Ashkari
    if (isAshkari) {
      ctx.save();
      const hoodGrad = ctx.createRadialGradient(cx, cy - 48 * s, 8 * s, cx, cy - 12 * s, 56 * s);
      hoodGrad.addColorStop(0, rgba('#2a2018', 0.7));
      hoodGrad.addColorStop(0.6, rgba('#1a1208', 0.5));
      hoodGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = hoodGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 20 * s, 50 * s, 46 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Head shape
    const headGrad = ctx.createRadialGradient(cx - 8 * s, cy - 16 * s, 2 * s, cx, cy, 34 * s);
    headGrad.addColorStop(0, lighten(opts.primaryColor, 30));
    headGrad.addColorStop(0.5, opts.primaryColor);
    headGrad.addColorStop(1, rgba(opts.primaryColor, 0.45));
    ctx.fillStyle = headGrad;

    ctx.beginPath();
    ctx.moveTo(cx, cy - 38 * s);
    ctx.bezierCurveTo(cx + 18 * s, cy - 40 * s, cx + 28 * s, cy - 22 * s, cx + 26 * s, cy + 2 * s);
    ctx.bezierCurveTo(cx + 24 * s, cy + 26 * s, cx + 14 * s, cy + 36 * s, cx, cy + 36 * s);
    ctx.bezierCurveTo(cx - 14 * s, cy + 36 * s, cx - 24 * s, cy + 26 * s, cx - 26 * s, cy + 2 * s);
    ctx.bezierCurveTo(cx - 28 * s, cy - 22 * s, cx - 18 * s, cy - 40 * s, cx, cy - 38 * s);
    ctx.fill();

    // Scars for Ashkari
    if (opts.features.includes('scars')) {
      ctx.save();
      ctx.strokeStyle = rgba('#40281a', 0.7);
      ctx.lineWidth = 1.2 * s;
      ctx.lineCap = 'round';
      // Diagonal scar across left cheek
      ctx.beginPath();
      ctx.moveTo(cx - 18 * s, cy - 8 * s);
      ctx.lineTo(cx - 6 * s, cy + 4 * s);
      ctx.stroke();
      // Small horizontal scar on forehead
      ctx.beginPath();
      ctx.moveTo(cx + 4 * s, cy - 26 * s);
      ctx.lineTo(cx + 14 * s, cy - 22 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Eyes
    ctx.save();
    if (opts.features.includes('glowing_amber_eyes') || opts.features.includes('warm_eyes')) {
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 10 * s;
    }
    const eyeY = cy - 8 * s;
    const eyeColor = opts.features.includes('glowing_amber_eyes') ? opts.accentColor : '#3a6080';

    // Eyelid area (darker)
    ctx.fillStyle = rgba('#000000', 0.25);
    ctx.beginPath();
    ctx.ellipse(cx - 12 * s, eyeY, 9 * s, 5.5 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 12 * s, eyeY, 9 * s, 5.5 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(cx - 12 * s, eyeY, 5.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 12 * s, eyeY, 5.5 * s, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#080808';
    ctx.beginPath();
    ctx.arc(cx - 12 * s, eyeY, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 12 * s, eyeY, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    // Glint
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(cx - 14 * s, eyeY - 2 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 10 * s, eyeY - 2 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Nose bridge — subtle shading
    ctx.fillStyle = rgba('#000000', 0.12);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4 * s, 4 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth — thin line
    ctx.strokeStyle = rgba('#000000', 0.3);
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8 * s, cy + 18 * s);
    ctx.quadraticCurveTo(cx, cy + 20 * s, cx + 8 * s, cy + 18 * s);
    ctx.stroke();

    // Tech visor for Teranos
    if (opts.features.includes('tech_visor')) {
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 8 * s;
      // Right-eye visor band
      ctx.strokeStyle = rgba(opts.accentColor, 0.75);
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.moveTo(cx + 2 * s, eyeY - 4 * s);
      ctx.lineTo(cx + 28 * s, eyeY - 6 * s);
      ctx.stroke();
      // Visor detail lines
      ctx.lineWidth = 0.8 * s;
      ctx.strokeStyle = rgba(opts.accentColor, 0.4);
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + 2 * s, eyeY - 4 * s + i * 2 * s);
        ctx.lineTo(cx + 24 * s, eyeY - 4 * s + i * 2 * s);
        ctx.stroke();
      }
      // Lens glow
      const lensGlow = ctx.createRadialGradient(cx + 14 * s, eyeY, 0, cx + 14 * s, eyeY, 7 * s);
      lensGlow.addColorStop(0, rgba(opts.accentColor, 0.25));
      lensGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = lensGlow;
      ctx.beginPath();
      ctx.arc(cx + 14 * s, eyeY, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Salvaged tech pieces for Ashkari
    if (opts.features.includes('salvaged_tech')) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4 * s;
      // Metal patch on left cheek
      ctx.fillStyle = '#404848';
      ctx.fillRect(cx - 24 * s, cy - 2 * s, 12 * s, 8 * s);
      // Rivets
      ctx.fillStyle = '#707878';
      for (const [px, py] of [
        [cx - 22 * s, cy], [cx - 14 * s, cy],
        [cx - 22 * s, cy + 6 * s], [cx - 14 * s, cy + 6 * s],
      ]) {
        ctx.beginPath();
        ctx.arc(px!, py!, 1 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // Small LED on patch
      ctx.fillStyle = opts.accentColor;
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 5 * s;
      ctx.beginPath();
      ctx.arc(cx - 18 * s, cy + 3 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Neck
    const neckGrad = ctx.createLinearGradient(cx, cy + 36 * s, cx, cy + 58 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.8));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 47 * s, 11 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Insectoid (Zorvathi) ──────────────────────────────────────────────────

  private drawInsectoid(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.52;
    const s = size / 128;

    // Antennae
    if (opts.features.includes('antennae')) {
      ctx.save();
      ctx.strokeStyle = opts.primaryColor;
      ctx.lineWidth = 1.5 * s;
      ctx.lineCap = 'round';
      // Left antenna
      ctx.beginPath();
      ctx.moveTo(cx - 10 * s, cy - 42 * s);
      ctx.quadraticCurveTo(cx - 24 * s, cy - 64 * s, cx - 18 * s, cy - 72 * s);
      ctx.stroke();
      // Right antenna
      ctx.beginPath();
      ctx.moveTo(cx + 10 * s, cy - 42 * s);
      ctx.quadraticCurveTo(cx + 24 * s, cy - 64 * s, cx + 18 * s, cy - 72 * s);
      ctx.stroke();
      // Antenna tips
      ctx.fillStyle = opts.accentColor;
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 6 * s;
      ctx.beginPath();
      ctx.arc(cx - 18 * s, cy - 72 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 18 * s, cy - 72 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Main insect head — segmented, angular
    const headGrad = ctx.createRadialGradient(cx - 6 * s, cy - 14 * s, 3 * s, cx, cy, 36 * s);
    headGrad.addColorStop(0, lighten(opts.primaryColor, 25));
    headGrad.addColorStop(0.5, opts.primaryColor);
    headGrad.addColorStop(1, rgba(opts.primaryColor, 0.4));
    ctx.fillStyle = headGrad;

    // Upper cranium — rounded rectangular
    ctx.beginPath();
    ctx.moveTo(cx - 16 * s, cy - 42 * s);
    ctx.lineTo(cx + 16 * s, cy - 42 * s);
    ctx.lineTo(cx + 28 * s, cy - 28 * s);
    ctx.lineTo(cx + 28 * s, cy - 8 * s);
    ctx.lineTo(cx + 22 * s, cy + 8 * s);
    ctx.lineTo(cx + 22 * s, cy + 20 * s);  // jaw attachment
    ctx.lineTo(cx - 22 * s, cy + 20 * s);
    ctx.lineTo(cx - 22 * s, cy + 8 * s);
    ctx.lineTo(cx - 28 * s, cy - 8 * s);
    ctx.lineTo(cx - 28 * s, cy - 28 * s);
    ctx.closePath();
    ctx.fill();

    // Chitin segment line across mid-head
    if (opts.features.includes('chitin_segments')) {
      ctx.save();
      ctx.strokeStyle = rgba('#000000', 0.4);
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 28 * s, cy - 8 * s);
      ctx.lineTo(cx + 28 * s, cy - 8 * s);
      ctx.stroke();
      // Lighter highlight above segment line
      ctx.strokeStyle = rgba(opts.secondaryColor, 0.3);
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 26 * s, cy - 10 * s);
      ctx.lineTo(cx + 26 * s, cy - 10 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Compound eyes — clusters of small circles
    if (opts.features.includes('compound_eyes')) {
      ctx.save();
      ctx.shadowColor = opts.accentColor;
      ctx.shadowBlur = 8 * s;
      const eyeCenters = [
        { x: cx - 16 * s, y: cy - 18 * s, facets: 7 },
        { x: cx + 16 * s, y: cy - 18 * s, facets: 7 },
      ];
      for (const ec of eyeCenters) {
        // Outer eye shape (amber)
        const eyeGrad = ctx.createRadialGradient(ec.x, ec.y, 2 * s, ec.x, ec.y, 10 * s);
        eyeGrad.addColorStop(0, opts.accentColor);
        eyeGrad.addColorStop(1, rgba(opts.accentColor, 0.3));
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.ellipse(ec.x, ec.y, 10 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        // Facet grid overlay
        ctx.strokeStyle = rgba('#000000', 0.25);
        ctx.lineWidth = 0.5 * s;
        for (let f = 0; f < ec.facets; f++) {
          const fa = (f / ec.facets) * Math.PI * 2;
          const fr = 6 * s;
          ctx.beginPath();
          ctx.moveTo(ec.x, ec.y);
          ctx.lineTo(ec.x + Math.cos(fa) * fr, ec.y + Math.sin(fa) * fr);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(ec.x, ec.y, 3 * s, 0, Math.PI * 2);
        ctx.fillStyle = rgba('#000000', 0.4);
        ctx.fill();
      }
      ctx.restore();
    }

    // Mandibles — lower jaw appendages
    if (opts.features.includes('mandibles')) {
      ctx.save();
      ctx.fillStyle = opts.secondaryColor;
      ctx.strokeStyle = rgba('#000000', 0.4);
      ctx.lineWidth = 0.8 * s;
      // Left mandible
      ctx.beginPath();
      ctx.moveTo(cx - 14 * s, cy + 20 * s);
      ctx.lineTo(cx - 28 * s, cy + 36 * s);
      ctx.lineTo(cx - 10 * s, cy + 32 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right mandible
      ctx.beginPath();
      ctx.moveTo(cx + 14 * s, cy + 20 * s);
      ctx.lineTo(cx + 28 * s, cy + 36 * s);
      ctx.lineTo(cx + 10 * s, cy + 32 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Center mouthpiece
    ctx.fillStyle = rgba('#000000', 0.45);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 22 * s, 10 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck segment
    const neckGrad = ctx.createLinearGradient(cx, cy + 30 * s, cx, cy + 54 * s);
    neckGrad.addColorStop(0, rgba(opts.primaryColor, 0.8));
    neckGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, cy + 32 * s);
    ctx.lineTo(cx + 14 * s, cy + 32 * s);
    ctx.lineTo(cx + 10 * s, cy + 54 * s);
    ctx.lineTo(cx - 10 * s, cy + 54 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ── Amorphous (generic / custom) ──────────────────────────────────────────

  private drawAmorphous(ctx: CanvasRenderingContext2D, size: number, opts: PortraitOptions): void {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const s = size / 128;

    // Shifting blob shape
    const grad = ctx.createRadialGradient(cx - 8 * s, cy - 12 * s, 4 * s, cx, cy, 44 * s);
    grad.addColorStop(0, lighten(opts.primaryColor, 60));
    grad.addColorStop(0.4, opts.primaryColor);
    grad.addColorStop(0.8, rgba(opts.secondaryColor, 0.6));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;

    // Irregular blob via bezier
    ctx.beginPath();
    ctx.moveTo(cx, cy - 44 * s);
    ctx.bezierCurveTo(cx + 26 * s, cy - 44 * s, cx + 44 * s, cy - 12 * s, cx + 38 * s, cy + 14 * s);
    ctx.bezierCurveTo(cx + 32 * s, cy + 40 * s, cx + 14 * s, cy + 46 * s, cx - 4 * s, cy + 40 * s);
    ctx.bezierCurveTo(cx - 22 * s, cy + 34 * s, cx - 44 * s, cy + 20 * s, cx - 40 * s, cy - 8 * s);
    ctx.bezierCurveTo(cx - 36 * s, cy - 36 * s, cx - 26 * s, cy - 44 * s, cx, cy - 44 * s);
    ctx.fill();

    // Internal luminous core
    const core = ctx.createRadialGradient(cx + 4 * s, cy - 4 * s, 0, cx, cy, 28 * s);
    core.addColorStop(0, rgba(opts.accentColor, 0.5));
    core.addColorStop(0.5, rgba(opts.accentColor, 0.15));
    core.addColorStop(1, 'transparent');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 40 * s, 0, Math.PI * 2);
    ctx.fill();

    // Floating eye shapes — random-ish positions
    ctx.save();
    ctx.shadowColor = opts.accentColor;
    ctx.shadowBlur = 10 * s;
    const eyeData = [
      { x: cx - 12 * s, y: cy - 10 * s, r: 5 * s },
      { x: cx + 14 * s, y: cy - 6 * s, r: 4 * s },
      { x: cx - 4 * s, y: cy + 12 * s, r: 3 * s },
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

  // ── Fallback portrait ─────────────────────────────────────────────────────

  private renderFallback(speciesId: string, size: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, size, size);

    const hue = Array.from(speciesId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
    const color = `hsl(${hue},60%,55%)`;

    const grad = ctx.createRadialGradient(size * 0.4, size * 0.38, size * 0.04, size * 0.5, size * 0.5, size * 0.5);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `bold ${size * 0.36}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(speciesId.charAt(0).toUpperCase(), size * 0.5, size * 0.52);

    return canvas.toDataURL('image/png');
  }
}
