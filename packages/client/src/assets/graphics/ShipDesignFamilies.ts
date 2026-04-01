/**
 * ShipDesignFamilies.ts
 *
 * Race-specific ship graphics organised into five visual design families.
 * Each family defines draw functions for 7 hull classes (scout, destroyer,
 * transport, cruiser, carrier, battleship, coloniser).  The 'practical'
 * family uses the default ShipGraphics renderers and has no override here.
 *
 * All draw functions operate in a normalised 1x1 coordinate space (the
 * caller applies ctx.scale beforehand), matching the convention in
 * ShipGraphics.ts.  Ships face nose-up (fore = top of canvas).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DesignFamily = 'organic' | 'angular' | 'crystalline' | 'mechanical' | 'practical';

/** Signature compatible with the DrawFn in ShipGraphics.ts (minus `detailed`). */
type FamilyDrawFn = (ctx: CanvasRenderingContext2D, accent: string) => void;

// ── Species → family mapping ──────────────────────────────────────────────────

export const SPECIES_DESIGN_FAMILY: Record<string, DesignFamily> = {
  sylvani:  'organic',      drakmari: 'organic',      vethara:  'organic',
  khazari:  'angular',      orivani:  'angular',      pyrenth:  'angular',
  vaelori:  'crystalline',  luminari: 'crystalline',   aethyn:   'crystalline',
  nexari:   'mechanical',   kaelenth: 'mechanical',    thyriaq:  'mechanical',
  teranos:  'practical',    ashkari:  'practical',     zorvathi: 'practical',
};

/** Look up the design family for a species.  Falls back to 'practical'. */
export function getDesignFamily(speciesId?: string): DesignFamily {
  if (!speciesId) return 'practical';
  return SPECIES_DESIGN_FAMILY[speciesId] ?? 'practical';
}

// ── Colour helpers (local) ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const e = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
  const n = parseInt(e, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ORGANIC FAMILY — all curves, teardrop hulls, green engine glow, bio-eyes
// ═══════════════════════════════════════════════════════════════════════════════

function organicEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(100,255,130,0.6)');
  bloom.addColorStop(0.5, 'rgba(40,200,80,0.25)');
  bloom.addColorStop(1,   'rgba(10,120,30,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(220,255,230,1)');
  core.addColorStop(0.4, 'rgba(80,255,120,0.85)');
  core.addColorStop(1,   'rgba(20,140,50,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

function organicFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#4a6e4a');
  grad.addColorStop(0.4, '#2e4a2e');
  grad.addColorStop(1,   '#1a321a');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

function bioEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const grad = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, 0, cx, cy, r);
  grad.addColorStop(0,   'rgba(255,240,180,1)');
  grad.addColorStop(0.4, 'rgba(200,220,80,0.9)');
  grad.addColorStop(1,   'rgba(80,120,30,0.3)');
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

function organicScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Small teardrop with trailing filaments
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.38, 0.18, 0.32, 0.35, 0.34, 0.55);
  ctx.bezierCurveTo(0.36, 0.68, 0.42, 0.78, 0.50, 0.82);
  ctx.bezierCurveTo(0.58, 0.78, 0.64, 0.68, 0.66, 0.55);
  ctx.bezierCurveTo(0.68, 0.35, 0.62, 0.18, 0.50, 0.10);
  ctx.closePath();
  organicFill(ctx, accent);
  // Filaments
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.42, 0.78); ctx.bezierCurveTo(0.38, 0.88, 0.35, 0.94, 0.32, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.58, 0.78); ctx.bezierCurveTo(0.62, 0.88, 0.65, 0.94, 0.68, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.82); ctx.bezierCurveTo(0.50, 0.90, 0.50, 0.95, 0.50, 0.99);
  ctx.stroke();
  bioEye(ctx, 0.50, 0.22, 0.035);
  organicEngineGlow(ctx, 0.50, 0.80, 0.035);
}

function organicDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Elongated pod with side tendrils
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.40, 0.12, 0.34, 0.28, 0.33, 0.45);
  ctx.bezierCurveTo(0.32, 0.60, 0.36, 0.74, 0.44, 0.82);
  ctx.bezierCurveTo(0.47, 0.85, 0.50, 0.86, 0.50, 0.86);
  ctx.bezierCurveTo(0.50, 0.86, 0.53, 0.85, 0.56, 0.82);
  ctx.bezierCurveTo(0.64, 0.74, 0.68, 0.60, 0.67, 0.45);
  ctx.bezierCurveTo(0.66, 0.28, 0.60, 0.12, 0.50, 0.06);
  ctx.closePath();
  organicFill(ctx, accent);
  // Side tendrils
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(0.33, 0.40); ctx.bezierCurveTo(0.22, 0.38, 0.16, 0.44, 0.14, 0.52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.67, 0.40); ctx.bezierCurveTo(0.78, 0.38, 0.84, 0.44, 0.86, 0.52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.34, 0.55); ctx.bezierCurveTo(0.24, 0.56, 0.18, 0.62, 0.16, 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.66, 0.55); ctx.bezierCurveTo(0.76, 0.56, 0.82, 0.62, 0.84, 0.68);
  ctx.stroke();
  // Accent patches
  ctx.beginPath();
  ctx.ellipse(0.44, 0.35, 0.04, 0.08, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.25);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.56, 0.35, 0.04, 0.08, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.25);
  ctx.fill();
  bioEye(ctx, 0.50, 0.16, 0.030);
  organicEngineGlow(ctx, 0.50, 0.84, 0.040);
}

function organicTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Fat ovoid with membrane fins
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.bezierCurveTo(0.36, 0.16, 0.24, 0.32, 0.22, 0.50);
  ctx.bezierCurveTo(0.24, 0.68, 0.36, 0.80, 0.50, 0.84);
  ctx.bezierCurveTo(0.64, 0.80, 0.76, 0.68, 0.78, 0.50);
  ctx.bezierCurveTo(0.76, 0.32, 0.64, 0.16, 0.50, 0.12);
  ctx.closePath();
  organicFill(ctx, accent);
  // Membrane fins
  ctx.fillStyle = withAlpha(accent, 0.15);
  ctx.beginPath();
  ctx.moveTo(0.22, 0.45);
  ctx.bezierCurveTo(0.14, 0.42, 0.10, 0.50, 0.12, 0.60);
  ctx.bezierCurveTo(0.16, 0.68, 0.22, 0.65, 0.24, 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.78, 0.45);
  ctx.bezierCurveTo(0.86, 0.42, 0.90, 0.50, 0.88, 0.60);
  ctx.bezierCurveTo(0.84, 0.68, 0.78, 0.65, 0.76, 0.58);
  ctx.closePath();
  ctx.fill();
  bioEye(ctx, 0.50, 0.24, 0.032);
  organicEngineGlow(ctx, 0.42, 0.82, 0.030);
  organicEngineGlow(ctx, 0.58, 0.82, 0.030);
}

function organicCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Whale-shape with bioluminescent patches
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.38, 0.10, 0.26, 0.24, 0.22, 0.42);
  ctx.bezierCurveTo(0.20, 0.56, 0.24, 0.70, 0.32, 0.78);
  ctx.bezierCurveTo(0.38, 0.84, 0.44, 0.88, 0.50, 0.90);
  ctx.bezierCurveTo(0.56, 0.88, 0.62, 0.84, 0.68, 0.78);
  ctx.bezierCurveTo(0.76, 0.70, 0.80, 0.56, 0.78, 0.42);
  ctx.bezierCurveTo(0.74, 0.24, 0.62, 0.10, 0.50, 0.06);
  ctx.closePath();
  organicFill(ctx, accent);
  // Bioluminescent patches
  const patches = [[0.38, 0.36], [0.62, 0.36], [0.34, 0.54], [0.66, 0.54], [0.50, 0.68]];
  for (const [px, py] of patches) {
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 0.04);
    glow.addColorStop(0,   withAlpha(accent, 0.55));
    glow.addColorStop(1,   withAlpha(accent, 0));
    ctx.beginPath();
    ctx.arc(px, py, 0.04, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }
  bioEye(ctx, 0.44, 0.16, 0.028);
  bioEye(ctx, 0.56, 0.16, 0.028);
  organicEngineGlow(ctx, 0.42, 0.88, 0.035);
  organicEngineGlow(ctx, 0.58, 0.88, 0.035);
}

function organicCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Broad jellyfish dome with dangling launch tentacles
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.30, 0.10, 0.14, 0.24, 0.12, 0.40);
  ctx.bezierCurveTo(0.14, 0.52, 0.26, 0.58, 0.50, 0.60);
  ctx.bezierCurveTo(0.74, 0.58, 0.86, 0.52, 0.88, 0.40);
  ctx.bezierCurveTo(0.86, 0.24, 0.70, 0.10, 0.50, 0.10);
  ctx.closePath();
  organicFill(ctx, accent);
  // Launch tentacles
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.008;
  const tentX = [0.26, 0.38, 0.50, 0.62, 0.74];
  for (const tx of tentX) {
    ctx.beginPath();
    ctx.moveTo(tx, 0.58);
    ctx.bezierCurveTo(tx - 0.02, 0.70, tx + 0.02, 0.80, tx - 0.01, 0.92);
    ctx.stroke();
  }
  // Dome accent
  ctx.beginPath();
  ctx.ellipse(0.50, 0.34, 0.22, 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.15);
  ctx.fill();
  bioEye(ctx, 0.50, 0.28, 0.035);
  organicEngineGlow(ctx, 0.34, 0.56, 0.028);
  organicEngineGlow(ctx, 0.66, 0.56, 0.028);
}

function organicBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Massive reef creature with multiple bio-weapon pods
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);
  ctx.bezierCurveTo(0.34, 0.08, 0.18, 0.22, 0.14, 0.42);
  ctx.bezierCurveTo(0.12, 0.58, 0.18, 0.72, 0.28, 0.80);
  ctx.bezierCurveTo(0.36, 0.86, 0.44, 0.90, 0.50, 0.92);
  ctx.bezierCurveTo(0.56, 0.90, 0.64, 0.86, 0.72, 0.80);
  ctx.bezierCurveTo(0.82, 0.72, 0.88, 0.58, 0.86, 0.42);
  ctx.bezierCurveTo(0.82, 0.22, 0.66, 0.08, 0.50, 0.04);
  ctx.closePath();
  organicFill(ctx, accent);
  // Bio-weapon pods (small bulges)
  const pods: [number, number][] = [[0.22, 0.38], [0.78, 0.38], [0.18, 0.56], [0.82, 0.56], [0.26, 0.72], [0.74, 0.72]];
  for (const [px, py] of pods) {
    ctx.beginPath();
    ctx.arc(px, py, 0.04, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.35);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.004;
    ctx.stroke();
  }
  // Bioluminescent patches
  const glows: [number, number][] = [[0.40, 0.30], [0.60, 0.30], [0.35, 0.50], [0.65, 0.50], [0.50, 0.65]];
  for (const [gx, gy] of glows) {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 0.035);
    g.addColorStop(0,   withAlpha(accent, 0.5));
    g.addColorStop(1,   withAlpha(accent, 0));
    ctx.beginPath();
    ctx.arc(gx, gy, 0.035, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  bioEye(ctx, 0.44, 0.14, 0.030);
  bioEye(ctx, 0.56, 0.14, 0.030);
  organicEngineGlow(ctx, 0.38, 0.90, 0.038);
  organicEngineGlow(ctx, 0.50, 0.92, 0.032);
  organicEngineGlow(ctx, 0.62, 0.90, 0.038);
}

function organicColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Seed pod shape with root-like extensions
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.38, 0.12, 0.28, 0.26, 0.26, 0.44);
  ctx.bezierCurveTo(0.24, 0.58, 0.28, 0.70, 0.36, 0.78);
  ctx.bezierCurveTo(0.42, 0.84, 0.46, 0.86, 0.50, 0.86);
  ctx.bezierCurveTo(0.54, 0.86, 0.58, 0.84, 0.64, 0.78);
  ctx.bezierCurveTo(0.72, 0.70, 0.76, 0.58, 0.74, 0.44);
  ctx.bezierCurveTo(0.72, 0.26, 0.62, 0.12, 0.50, 0.08);
  ctx.closePath();
  organicFill(ctx, accent);
  // Root-like extensions
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.beginPath();
  ctx.moveTo(0.36, 0.78); ctx.bezierCurveTo(0.30, 0.86, 0.26, 0.92, 0.22, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.64, 0.78); ctx.bezierCurveTo(0.70, 0.86, 0.74, 0.92, 0.78, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.86); ctx.bezierCurveTo(0.48, 0.92, 0.46, 0.96, 0.44, 0.99);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.86); ctx.bezierCurveTo(0.52, 0.92, 0.54, 0.96, 0.56, 0.99);
  ctx.stroke();
  // Seed interior glow
  const sg = ctx.createRadialGradient(0.50, 0.45, 0, 0.50, 0.45, 0.18);
  sg.addColorStop(0,   withAlpha(accent, 0.35));
  sg.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.45, 0.18, 0, Math.PI * 2);
  ctx.fillStyle = sg;
  ctx.fill();
  bioEye(ctx, 0.50, 0.22, 0.028);
  organicEngineGlow(ctx, 0.50, 0.84, 0.035);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANGULAR FAMILY — all straight lines, sharp wedges, orange-red engine
// ═══════════════════════════════════════════════════════════════════════════════

function angularEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(255,180,80,0.6)');
  bloom.addColorStop(0.5, 'rgba(220,100,30,0.25)');
  bloom.addColorStop(1,   'rgba(160,40,10,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,240,200,1)');
  core.addColorStop(0.4, 'rgba(255,160,60,0.85)');
  core.addColorStop(1,   'rgba(200,60,10,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

function angularFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#5a5040');
  grad.addColorStop(0.4, '#3e3830');
  grad.addColorStop(1,   '#26221c');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

function viewportSlit(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0,   'rgba(255,200,120,0.8)');
  g.addColorStop(0.5, 'rgba(255,160,60,0.9)');
  g.addColorStop(1,   'rgba(200,100,30,0.6)');
  ctx.fillStyle = g;
  ctx.fill();
}

function angularScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Narrow blade dart
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.lineTo(0.42, 0.30);
  ctx.lineTo(0.38, 0.75);
  ctx.lineTo(0.44, 0.84);
  ctx.lineTo(0.56, 0.84);
  ctx.lineTo(0.62, 0.75);
  ctx.lineTo(0.58, 0.30);
  ctx.closePath();
  angularFill(ctx, accent);
  // Accent stripe
  ctx.beginPath();
  ctx.moveTo(0.46, 0.32); ctx.lineTo(0.46, 0.72);
  ctx.lineTo(0.54, 0.72); ctx.lineTo(0.54, 0.32);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  viewportSlit(ctx, 0.46, 0.18, 0.08, 0.02);
  angularEngineGlow(ctx, 0.50, 0.82, 0.030);
}

function angularDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Hammerhead wedge with side strakes
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.lineTo(0.36, 0.16);
  ctx.lineTo(0.22, 0.18);
  ctx.lineTo(0.22, 0.26);
  ctx.lineTo(0.36, 0.28);
  ctx.lineTo(0.34, 0.72);
  ctx.lineTo(0.38, 0.84);
  ctx.lineTo(0.62, 0.84);
  ctx.lineTo(0.66, 0.72);
  ctx.lineTo(0.64, 0.28);
  ctx.lineTo(0.78, 0.26);
  ctx.lineTo(0.78, 0.18);
  ctx.lineTo(0.64, 0.16);
  ctx.closePath();
  angularFill(ctx, accent);
  // Accent panels
  ctx.beginPath();
  ctx.moveTo(0.40, 0.30); ctx.lineTo(0.40, 0.70);
  ctx.lineTo(0.48, 0.70); ctx.lineTo(0.48, 0.30);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.52, 0.30); ctx.lineTo(0.52, 0.70);
  ctx.lineTo(0.60, 0.70); ctx.lineTo(0.60, 0.30);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();
  viewportSlit(ctx, 0.44, 0.12, 0.12, 0.02);
  angularEngineGlow(ctx, 0.44, 0.82, 0.028);
  angularEngineGlow(ctx, 0.56, 0.82, 0.028);
}

function angularTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Armoured box with angular cockpit
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.lineTo(0.36, 0.18);
  ctx.lineTo(0.26, 0.26);
  ctx.lineTo(0.26, 0.78);
  ctx.lineTo(0.34, 0.86);
  ctx.lineTo(0.66, 0.86);
  ctx.lineTo(0.74, 0.78);
  ctx.lineTo(0.74, 0.26);
  ctx.lineTo(0.64, 0.18);
  ctx.closePath();
  angularFill(ctx, accent);
  // Cargo bay lines
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.005;
  for (let y = 0.34; y <= 0.74; y += 0.10) {
    ctx.beginPath();
    ctx.moveTo(0.28, y); ctx.lineTo(0.72, y);
    ctx.stroke();
  }
  viewportSlit(ctx, 0.42, 0.14, 0.16, 0.02);
  angularEngineGlow(ctx, 0.40, 0.84, 0.028);
  angularEngineGlow(ctx, 0.60, 0.84, 0.028);
}

function angularCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Thick diamond wedge with plate segments
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.lineTo(0.32, 0.20);
  ctx.lineTo(0.22, 0.44);
  ctx.lineTo(0.24, 0.70);
  ctx.lineTo(0.34, 0.84);
  ctx.lineTo(0.50, 0.90);
  ctx.lineTo(0.66, 0.84);
  ctx.lineTo(0.76, 0.70);
  ctx.lineTo(0.78, 0.44);
  ctx.lineTo(0.68, 0.20);
  ctx.closePath();
  angularFill(ctx, accent);
  // Plate segment lines
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.005;
  ctx.beginPath(); ctx.moveTo(0.30, 0.35); ctx.lineTo(0.70, 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.55); ctx.lineTo(0.74, 0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.30, 0.72); ctx.lineTo(0.70, 0.72); ctx.stroke();
  // Accent panels
  ctx.beginPath();
  ctx.moveTo(0.38, 0.36); ctx.lineTo(0.38, 0.54);
  ctx.lineTo(0.50, 0.54); ctx.lineTo(0.50, 0.36);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.36); ctx.lineTo(0.50, 0.54);
  ctx.lineTo(0.62, 0.54); ctx.lineTo(0.62, 0.36);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  viewportSlit(ctx, 0.42, 0.12, 0.16, 0.02);
  angularEngineGlow(ctx, 0.40, 0.88, 0.032);
  angularEngineGlow(ctx, 0.60, 0.88, 0.032);
}

function angularCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Flat angular deck with intake bays
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.lineTo(0.28, 0.16);
  ctx.lineTo(0.16, 0.30);
  ctx.lineTo(0.14, 0.60);
  ctx.lineTo(0.18, 0.78);
  ctx.lineTo(0.30, 0.88);
  ctx.lineTo(0.70, 0.88);
  ctx.lineTo(0.82, 0.78);
  ctx.lineTo(0.86, 0.60);
  ctx.lineTo(0.84, 0.30);
  ctx.lineTo(0.72, 0.16);
  ctx.closePath();
  angularFill(ctx, accent);
  // Launch bays (dark rectangles)
  ctx.fillStyle = 'rgba(10,10,10,0.6)';
  ctx.fillRect(0.24, 0.36, 0.14, 0.06);
  ctx.fillRect(0.62, 0.36, 0.14, 0.06);
  ctx.fillRect(0.24, 0.50, 0.14, 0.06);
  ctx.fillRect(0.62, 0.50, 0.14, 0.06);
  ctx.fillRect(0.24, 0.64, 0.14, 0.06);
  ctx.fillRect(0.62, 0.64, 0.14, 0.06);
  // Centre stripe accent
  ctx.beginPath();
  ctx.moveTo(0.46, 0.20); ctx.lineTo(0.46, 0.82);
  ctx.lineTo(0.54, 0.82); ctx.lineTo(0.54, 0.20);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();
  viewportSlit(ctx, 0.40, 0.12, 0.20, 0.02);
  angularEngineGlow(ctx, 0.36, 0.86, 0.030);
  angularEngineGlow(ctx, 0.50, 0.88, 0.026);
  angularEngineGlow(ctx, 0.64, 0.86, 0.030);
}

function angularBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Massive angular fortress, layered plates
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);
  ctx.lineTo(0.30, 0.14);
  ctx.lineTo(0.16, 0.30);
  ctx.lineTo(0.12, 0.52);
  ctx.lineTo(0.16, 0.72);
  ctx.lineTo(0.26, 0.84);
  ctx.lineTo(0.38, 0.92);
  ctx.lineTo(0.62, 0.92);
  ctx.lineTo(0.74, 0.84);
  ctx.lineTo(0.84, 0.72);
  ctx.lineTo(0.88, 0.52);
  ctx.lineTo(0.84, 0.30);
  ctx.lineTo(0.70, 0.14);
  ctx.closePath();
  angularFill(ctx, accent);
  // Layered plate lines
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.005;
  ctx.beginPath(); ctx.moveTo(0.24, 0.28); ctx.lineTo(0.76, 0.28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.44); ctx.lineTo(0.82, 0.44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.60); ctx.lineTo(0.82, 0.60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.76); ctx.lineTo(0.76, 0.76); ctx.stroke();
  // Weapon turret positions (accent squares)
  const turrets: [number, number][] = [[0.26, 0.34], [0.74, 0.34], [0.20, 0.52], [0.80, 0.52], [0.26, 0.68], [0.74, 0.68]];
  for (const [tx, ty] of turrets) {
    ctx.beginPath();
    ctx.rect(tx - 0.03, ty - 0.03, 0.06, 0.06);
    ctx.fillStyle = withAlpha(accent, 0.30);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }
  viewportSlit(ctx, 0.38, 0.10, 0.24, 0.025);
  angularEngineGlow(ctx, 0.36, 0.90, 0.034);
  angularEngineGlow(ctx, 0.50, 0.92, 0.030);
  angularEngineGlow(ctx, 0.64, 0.90, 0.034);
}

function angularColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Angular ark with protective armour shell
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.lineTo(0.34, 0.16);
  ctx.lineTo(0.24, 0.30);
  ctx.lineTo(0.22, 0.56);
  ctx.lineTo(0.26, 0.74);
  ctx.lineTo(0.34, 0.84);
  ctx.lineTo(0.42, 0.90);
  ctx.lineTo(0.58, 0.90);
  ctx.lineTo(0.66, 0.84);
  ctx.lineTo(0.74, 0.74);
  ctx.lineTo(0.78, 0.56);
  ctx.lineTo(0.76, 0.30);
  ctx.lineTo(0.66, 0.16);
  ctx.closePath();
  angularFill(ctx, accent);
  // Armour shell plating
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.005;
  ctx.beginPath(); ctx.moveTo(0.30, 0.26); ctx.lineTo(0.70, 0.26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.44); ctx.lineTo(0.74, 0.44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.62); ctx.lineTo(0.74, 0.62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.30, 0.78); ctx.lineTo(0.70, 0.78); ctx.stroke();
  // Habitat window strip
  viewportSlit(ctx, 0.34, 0.32, 0.32, 0.02);
  viewportSlit(ctx, 0.34, 0.50, 0.32, 0.02);
  // Top viewport
  viewportSlit(ctx, 0.42, 0.12, 0.16, 0.02);
  angularEngineGlow(ctx, 0.42, 0.88, 0.030);
  angularEngineGlow(ctx, 0.58, 0.88, 0.030);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CRYSTALLINE FAMILY — hexagonal/diamond facets, violet-white glow, nexus
// ═══════════════════════════════════════════════════════════════════════════════

function crystallineEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(200,160,255,0.6)');
  bloom.addColorStop(0.5, 'rgba(140,80,220,0.25)');
  bloom.addColorStop(1,   'rgba(80,30,160,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(240,230,255,1)');
  core.addColorStop(0.4, 'rgba(180,140,255,0.85)');
  core.addColorStop(1,   'rgba(100,50,200,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

function crystallineFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#5a4a6e');
  grad.addColorStop(0.4, '#3e2e5a');
  grad.addColorStop(1,   '#221a3a');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

function energyNexus(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string): void {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0,   'rgba(220,200,255,1)');
  glow.addColorStop(0.3, withAlpha(accent, 0.7));
  glow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  // Inner diamond
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.5);
  ctx.lineTo(cx + r * 0.4, cy);
  ctx.lineTo(cx, cy + r * 0.5);
  ctx.lineTo(cx - r * 0.4, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(240,230,255,0.8)';
  ctx.fill();
}

/** Draw a regular hexagon at (cx, cy) with circumradius r, rotated by angle (radians). */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = angle + (Math.PI / 3) * i;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function crystallineScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Small diamond shape with glowing edges
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.lineTo(0.36, 0.45);
  ctx.lineTo(0.50, 0.82);
  ctx.lineTo(0.64, 0.45);
  ctx.closePath();
  crystallineFill(ctx, accent);
  // Glowing edge highlights
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10); ctx.lineTo(0.36, 0.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10); ctx.lineTo(0.64, 0.45);
  ctx.stroke();
  energyNexus(ctx, 0.50, 0.38, 0.04, accent);
  crystallineEngineGlow(ctx, 0.50, 0.78, 0.030);
}

function crystallineDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Elongated hexagonal prism
  hexPath(ctx, 0.50, 0.20, 0.14, Math.PI / 6);
  crystallineFill(ctx, accent);
  // Lower prism section
  ctx.beginPath();
  ctx.moveTo(0.36, 0.20);
  ctx.lineTo(0.34, 0.65);
  ctx.lineTo(0.42, 0.82);
  ctx.lineTo(0.58, 0.82);
  ctx.lineTo(0.66, 0.65);
  ctx.lineTo(0.64, 0.20);
  ctx.closePath();
  crystallineFill(ctx, accent);
  // Facet lines
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.50, 0.20); ctx.lineTo(0.50, 0.82); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.36, 0.40); ctx.lineTo(0.64, 0.40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.35, 0.60); ctx.lineTo(0.65, 0.60); ctx.stroke();
  energyNexus(ctx, 0.50, 0.30, 0.035, accent);
  crystallineEngineGlow(ctx, 0.46, 0.80, 0.025);
  crystallineEngineGlow(ctx, 0.54, 0.80, 0.025);
}

function crystallineTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Multi-faceted crystal cluster
  hexPath(ctx, 0.50, 0.40, 0.22, 0);
  crystallineFill(ctx, accent);
  hexPath(ctx, 0.38, 0.28, 0.10, Math.PI / 6);
  crystallineFill(ctx, accent);
  hexPath(ctx, 0.62, 0.28, 0.10, Math.PI / 6);
  crystallineFill(ctx, accent);
  hexPath(ctx, 0.50, 0.60, 0.12, Math.PI / 6);
  crystallineFill(ctx, accent);
  // Accent panels
  ctx.fillStyle = withAlpha(accent, 0.15);
  hexPath(ctx, 0.50, 0.40, 0.10, 0);
  ctx.fill();
  energyNexus(ctx, 0.50, 0.40, 0.045, accent);
  crystallineEngineGlow(ctx, 0.42, 0.72, 0.025);
  crystallineEngineGlow(ctx, 0.58, 0.72, 0.025);
}

function crystallineCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Large faceted gem shape
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.lineTo(0.30, 0.24);
  ctx.lineTo(0.22, 0.50);
  ctx.lineTo(0.30, 0.76);
  ctx.lineTo(0.50, 0.90);
  ctx.lineTo(0.70, 0.76);
  ctx.lineTo(0.78, 0.50);
  ctx.lineTo(0.70, 0.24);
  ctx.closePath();
  crystallineFill(ctx, accent);
  // Internal facet lines
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.50, 0.06); ctx.lineTo(0.22, 0.50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.06); ctx.lineTo(0.78, 0.50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.90); ctx.lineTo(0.22, 0.50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.90); ctx.lineTo(0.78, 0.50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.30, 0.24); ctx.lineTo(0.70, 0.76); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.70, 0.24); ctx.lineTo(0.30, 0.76); ctx.stroke();
  energyNexus(ctx, 0.50, 0.46, 0.050, accent);
  crystallineEngineGlow(ctx, 0.40, 0.84, 0.030);
  crystallineEngineGlow(ctx, 0.60, 0.84, 0.030);
}

function crystallineCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Flat hexagonal platform with crystal spires
  hexPath(ctx, 0.50, 0.48, 0.34, Math.PI / 6);
  crystallineFill(ctx, accent);
  // Spires (triangular protrusions)
  const spires: [number, number, number][] = [
    [0.50, 0.08, 0.06],
    [0.22, 0.30, 0.05],
    [0.78, 0.30, 0.05],
    [0.22, 0.66, 0.05],
    [0.78, 0.66, 0.05],
  ];
  for (const [sx, sy, sr] of spires) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - sr * 2);
    ctx.lineTo(sx - sr, sy + sr);
    ctx.lineTo(sx + sr, sy + sr);
    ctx.closePath();
    crystallineFill(ctx, accent);
    // Spire glow
    const sg = ctx.createRadialGradient(sx, sy - sr, 0, sx, sy, sr * 2);
    sg.addColorStop(0,   withAlpha(accent, 0.4));
    sg.addColorStop(1,   withAlpha(accent, 0));
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.fill();
  }
  // Centre platform accent
  hexPath(ctx, 0.50, 0.48, 0.16, Math.PI / 6);
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();
  energyNexus(ctx, 0.50, 0.48, 0.045, accent);
  crystallineEngineGlow(ctx, 0.50, 0.82, 0.032);
}

function crystallineBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Massive multi-crystal formation
  // Central large crystal
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);
  ctx.lineTo(0.28, 0.28);
  ctx.lineTo(0.20, 0.54);
  ctx.lineTo(0.28, 0.78);
  ctx.lineTo(0.50, 0.94);
  ctx.lineTo(0.72, 0.78);
  ctx.lineTo(0.80, 0.54);
  ctx.lineTo(0.72, 0.28);
  ctx.closePath();
  crystallineFill(ctx, accent);
  // Side crystal outcrops
  ctx.beginPath();
  ctx.moveTo(0.20, 0.40); ctx.lineTo(0.08, 0.48);
  ctx.lineTo(0.10, 0.60); ctx.lineTo(0.20, 0.58);
  ctx.closePath();
  crystallineFill(ctx, accent);
  ctx.beginPath();
  ctx.moveTo(0.80, 0.40); ctx.lineTo(0.92, 0.48);
  ctx.lineTo(0.90, 0.60); ctx.lineTo(0.80, 0.58);
  ctx.closePath();
  crystallineFill(ctx, accent);
  // Internal fracture lines
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.50, 0.04); ctx.lineTo(0.20, 0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.04); ctx.lineTo(0.80, 0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.94); ctx.lineTo(0.20, 0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.94); ctx.lineTo(0.80, 0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.28, 0.28); ctx.lineTo(0.72, 0.78); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.72, 0.28); ctx.lineTo(0.28, 0.78); ctx.stroke();
  // Crystal glow nodes
  const nodes: [number, number][] = [[0.36, 0.36], [0.64, 0.36], [0.30, 0.56], [0.70, 0.56], [0.36, 0.72], [0.64, 0.72]];
  for (const [nx, ny] of nodes) {
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 0.03);
    ng.addColorStop(0,   withAlpha(accent, 0.50));
    ng.addColorStop(1,   withAlpha(accent, 0));
    ctx.beginPath();
    ctx.arc(nx, ny, 0.03, 0, Math.PI * 2);
    ctx.fillStyle = ng;
    ctx.fill();
  }
  energyNexus(ctx, 0.50, 0.48, 0.06, accent);
  crystallineEngineGlow(ctx, 0.38, 0.90, 0.034);
  crystallineEngineGlow(ctx, 0.50, 0.92, 0.028);
  crystallineEngineGlow(ctx, 0.62, 0.90, 0.034);
}

function crystallineColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Rounded crystal sphere with facets (approximated with many segments)
  ctx.beginPath();
  const segments = 12;
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * 2 * i) / segments - Math.PI / 2;
    const r = 0.30 + 0.02 * Math.cos(a * 3); // slightly irregular
    const px = 0.50 + r * Math.cos(a);
    const py = 0.48 + r * 0.9 * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  crystallineFill(ctx, accent);
  // Facet cross-lines through centre
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * i) / 6;
    ctx.beginPath();
    ctx.moveTo(0.50 + 0.28 * Math.cos(a), 0.48 + 0.25 * Math.sin(a));
    ctx.lineTo(0.50 - 0.28 * Math.cos(a), 0.48 - 0.25 * Math.sin(a));
    ctx.stroke();
  }
  // Habitat glow ring
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.16, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.008;
  ctx.stroke();
  energyNexus(ctx, 0.50, 0.48, 0.055, accent);
  crystallineEngineGlow(ctx, 0.50, 0.80, 0.035);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MECHANICAL FAMILY — rectangles, modular blocks, blue-white electric engine
// ═══════════════════════════════════════════════════════════════════════════════

function mechanicalEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(160,200,255,0.6)');
  bloom.addColorStop(0.5, 'rgba(80,140,255,0.25)');
  bloom.addColorStop(1,   'rgba(30,60,200,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(240,245,255,1)');
  core.addColorStop(0.4, 'rgba(140,180,255,0.85)');
  core.addColorStop(1,   'rgba(50,80,220,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

function mechanicalFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#4a4e5a');
  grad.addColorStop(0.4, '#34383e');
  grad.addColorStop(1,   '#202228');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

function gridSensor(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, accent: string): void {
  const half = size / 2;
  // Background square
  ctx.beginPath();
  ctx.rect(cx - half, cy - half, size, size);
  ctx.fillStyle = 'rgba(20,25,35,0.8)';
  ctx.fill();
  // Grid lines
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.003;
  const step = size / 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - half + step * i, cy - half);
    ctx.lineTo(cx - half + step * i, cy + half);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - half + step * i);
    ctx.lineTo(cx + half, cy - half + step * i);
    ctx.stroke();
  }
  // Centre dot
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.8);
  ctx.fill();
}

function mechanicalScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Small cube/rectangular block
  ctx.beginPath();
  ctx.rect(0.36, 0.20, 0.28, 0.56);
  mechanicalFill(ctx, accent);
  // Module joint line
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.005;
  ctx.beginPath(); ctx.moveTo(0.36, 0.48); ctx.lineTo(0.64, 0.48); ctx.stroke();
  // Accent panel
  ctx.beginPath();
  ctx.rect(0.40, 0.24, 0.20, 0.20);
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();
  gridSensor(ctx, 0.50, 0.28, 0.08, accent);
  mechanicalEngineGlow(ctx, 0.50, 0.74, 0.030);
}

function mechanicalDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Two connected rectangular modules
  // Forward module
  ctx.beginPath();
  ctx.rect(0.34, 0.12, 0.32, 0.34);
  mechanicalFill(ctx, accent);
  // Connector
  ctx.beginPath();
  ctx.rect(0.40, 0.46, 0.20, 0.08);
  mechanicalFill(ctx, accent);
  // Aft module
  ctx.beginPath();
  ctx.rect(0.30, 0.54, 0.40, 0.30);
  mechanicalFill(ctx, accent);
  // Accent panels
  ctx.beginPath();
  ctx.rect(0.38, 0.16, 0.10, 0.12);
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(0.52, 0.16, 0.10, 0.12);
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  gridSensor(ctx, 0.50, 0.20, 0.07, accent);
  mechanicalEngineGlow(ctx, 0.40, 0.82, 0.026);
  mechanicalEngineGlow(ctx, 0.60, 0.82, 0.026);
}

function mechanicalTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wide rectangular cargo platform
  ctx.beginPath();
  ctx.rect(0.18, 0.20, 0.64, 0.60);
  mechanicalFill(ctx, accent);
  // Cargo bay grid
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.005;
  ctx.beginPath(); ctx.moveTo(0.18, 0.40); ctx.lineTo(0.82, 0.40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.60); ctx.lineTo(0.82, 0.60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.42, 0.20); ctx.lineTo(0.42, 0.80); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.58, 0.20); ctx.lineTo(0.58, 0.80); ctx.stroke();
  // Accent strip
  ctx.beginPath();
  ctx.rect(0.20, 0.22, 0.60, 0.04);
  ctx.fillStyle = withAlpha(accent, 0.22);
  ctx.fill();
  gridSensor(ctx, 0.50, 0.26, 0.06, accent);
  mechanicalEngineGlow(ctx, 0.34, 0.78, 0.025);
  mechanicalEngineGlow(ctx, 0.66, 0.78, 0.025);
}

function mechanicalCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Stacked rectangular modules
  // Top module
  ctx.beginPath();
  ctx.rect(0.32, 0.10, 0.36, 0.22);
  mechanicalFill(ctx, accent);
  // Middle module (wider)
  ctx.beginPath();
  ctx.rect(0.24, 0.34, 0.52, 0.24);
  mechanicalFill(ctx, accent);
  // Bottom module
  ctx.beginPath();
  ctx.rect(0.28, 0.60, 0.44, 0.26);
  mechanicalFill(ctx, accent);
  // Module joint lines
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.005;
  ctx.beginPath(); ctx.moveTo(0.24, 0.34); ctx.lineTo(0.76, 0.34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.58); ctx.lineTo(0.76, 0.58); ctx.stroke();
  // Accent panels
  ctx.beginPath();
  ctx.rect(0.36, 0.14, 0.12, 0.08);
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(0.52, 0.14, 0.12, 0.08);
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  gridSensor(ctx, 0.50, 0.18, 0.07, accent);
  mechanicalEngineGlow(ctx, 0.38, 0.84, 0.030);
  mechanicalEngineGlow(ctx, 0.62, 0.84, 0.030);
}

function mechanicalCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Flat rectangular platform with module bays
  ctx.beginPath();
  ctx.rect(0.12, 0.16, 0.76, 0.66);
  mechanicalFill(ctx, accent);
  // Module bays (dark insets)
  ctx.fillStyle = 'rgba(10,12,18,0.6)';
  ctx.fillRect(0.18, 0.24, 0.16, 0.12);
  ctx.fillRect(0.66, 0.24, 0.16, 0.12);
  ctx.fillRect(0.18, 0.42, 0.16, 0.12);
  ctx.fillRect(0.66, 0.42, 0.16, 0.12);
  ctx.fillRect(0.18, 0.60, 0.16, 0.12);
  ctx.fillRect(0.66, 0.60, 0.16, 0.12);
  // Centre spine
  ctx.beginPath();
  ctx.rect(0.44, 0.18, 0.12, 0.60);
  ctx.fillStyle = withAlpha(accent, 0.15);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.004;
  ctx.strokeRect(0.44, 0.18, 0.12, 0.60);
  gridSensor(ctx, 0.50, 0.22, 0.07, accent);
  mechanicalEngineGlow(ctx, 0.28, 0.80, 0.028);
  mechanicalEngineGlow(ctx, 0.50, 0.82, 0.024);
  mechanicalEngineGlow(ctx, 0.72, 0.80, 0.028);
}

function mechanicalBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Massive cube/monolith
  ctx.beginPath();
  ctx.rect(0.14, 0.08, 0.72, 0.82);
  mechanicalFill(ctx, accent);
  // Structural grid
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.005;
  for (let y = 0.24; y <= 0.74; y += 0.16) {
    ctx.beginPath(); ctx.moveTo(0.14, y); ctx.lineTo(0.86, y); ctx.stroke();
  }
  for (let x = 0.32; x <= 0.68; x += 0.18) {
    ctx.beginPath(); ctx.moveTo(x, 0.08); ctx.lineTo(x, 0.90); ctx.stroke();
  }
  // Weapon module squares
  const weps: [number, number][] = [[0.22, 0.16], [0.78, 0.16], [0.22, 0.48], [0.78, 0.48], [0.22, 0.72], [0.78, 0.72]];
  for (const [wx, wy] of weps) {
    ctx.beginPath();
    ctx.rect(wx - 0.04, wy - 0.04, 0.08, 0.08);
    ctx.fillStyle = withAlpha(accent, 0.28);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }
  // Centre accent block
  ctx.beginPath();
  ctx.rect(0.38, 0.30, 0.24, 0.36);
  ctx.fillStyle = withAlpha(accent, 0.14);
  ctx.fill();
  gridSensor(ctx, 0.50, 0.14, 0.08, accent);
  mechanicalEngineGlow(ctx, 0.30, 0.88, 0.032);
  mechanicalEngineGlow(ctx, 0.50, 0.90, 0.028);
  mechanicalEngineGlow(ctx, 0.70, 0.88, 0.032);
}

function mechanicalColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Cylindrical habitat module (approximated with rectangular segments)
  // Main body
  ctx.beginPath();
  ctx.rect(0.28, 0.14, 0.44, 0.70);
  mechanicalFill(ctx, accent);
  // Top and bottom caps (wider)
  ctx.beginPath();
  ctx.rect(0.24, 0.12, 0.52, 0.06);
  mechanicalFill(ctx, accent);
  ctx.beginPath();
  ctx.rect(0.24, 0.80, 0.52, 0.06);
  mechanicalFill(ctx, accent);
  // Ring segments to simulate cylindrical shape
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.005;
  for (let y = 0.26; y <= 0.76; y += 0.10) {
    ctx.beginPath(); ctx.moveTo(0.28, y); ctx.lineTo(0.72, y); ctx.stroke();
  }
  // Habitat window strips
  for (let y = 0.22; y <= 0.72; y += 0.20) {
    ctx.beginPath();
    ctx.rect(0.34, y, 0.32, 0.03);
    const wg = ctx.createLinearGradient(0.34, y, 0.66, y);
    wg.addColorStop(0,   withAlpha(accent, 0.3));
    wg.addColorStop(0.5, withAlpha(accent, 0.5));
    wg.addColorStop(1,   withAlpha(accent, 0.3));
    ctx.fillStyle = wg;
    ctx.fill();
  }
  gridSensor(ctx, 0.50, 0.18, 0.07, accent);
  mechanicalEngineGlow(ctx, 0.40, 0.84, 0.030);
  mechanicalEngineGlow(ctx, 0.60, 0.84, 0.030);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DISPATCH — hull class + family → draw function
// ═══════════════════════════════════════════════════════════════════════════════

const FAMILY_DRAW_FNS: Record<Exclude<DesignFamily, 'practical'>, Record<string, FamilyDrawFn>> = {
  organic: {
    scout:     organicScout,
    destroyer: organicDestroyer,
    transport: organicTransport,
    cruiser:   organicCruiser,
    carrier:   organicCarrier,
    battleship: organicBattleship,
    coloniser: organicColoniser,
  },
  angular: {
    scout:     angularScout,
    destroyer: angularDestroyer,
    transport: angularTransport,
    cruiser:   angularCruiser,
    carrier:   angularCarrier,
    battleship: angularBattleship,
    coloniser: angularColoniser,
  },
  crystalline: {
    scout:     crystallineScout,
    destroyer: crystallineDestroyer,
    transport: crystallineTransport,
    cruiser:   crystallineCruiser,
    carrier:   crystallineCarrier,
    battleship: crystallineBattleship,
    coloniser: crystallineColoniser,
  },
  mechanical: {
    scout:     mechanicalScout,
    destroyer: mechanicalDestroyer,
    transport: mechanicalTransport,
    cruiser:   mechanicalCruiser,
    carrier:   mechanicalCarrier,
    battleship: mechanicalBattleship,
    coloniser: mechanicalColoniser,
  },
};

/**
 * Look up a family-specific draw function for a given hull class.
 * Returns `null` for the 'practical' family (which uses the default
 * ShipGraphics renderers) or if no override exists for that hull class.
 */
export function getFamilyDrawFn(
  hullClass: string,
  family: DesignFamily,
): ((ctx: CanvasRenderingContext2D, accent: string) => void) | null {
  if (family === 'practical') return null;
  const fns = FAMILY_DRAW_FNS[family];
  return fns[hullClass] ?? null;
}
