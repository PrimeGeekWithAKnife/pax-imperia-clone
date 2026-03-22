/**
 * BuildingGraphics.ts
 *
 * Canvas 2D renderer for building icons used in the planet management screen.
 * Each icon is drawn in a canonical 64×64 space and scaled to the requested
 * pixel size. Returns a PNG data URL suitable for <img src> or Phaser textures.
 *
 * Style: detailed industrial sci-fi with front/isometric perspective. Icons
 * include architectural shapes, structural detail, lighting effects, surface
 * texture, and atmospheric elements. Readable down to 32 px.
 *
 * All draw functions operate in canonical 64-px coordinates via the `sc()`
 * scale helper. Comments use UK English throughout.
 */

import type { BuildingType } from '@nova-imperia/shared';

// ── Cache ─────────────────────────────────────────────────────────────────────

/** key → data URL */
const iconCache = new Map<string, string>();

function cacheKey(type: BuildingType, size: number): string {
  return `${type}@${size}`;
}

function slotCacheKey(type: BuildingType, level: number, size: number): string {
  return `${type}:${level}@${size}`;
}

// ── Accent colours per building type ─────────────────────────────────────────

const ACCENT: Record<BuildingType, string> = {
  research_lab:      '#3ac8ff',
  factory:           '#ff9933',
  shipyard:          '#00e5ff',
  trade_hub:         '#44ff88',
  defense_grid:      '#ff3333',
  population_center: '#ffe066',
  mining_facility:   '#cc8844',
  spaceport:         '#4488ff',
  power_plant:       '#ffcc00',
};

// ── Canvas helpers ────────────────────────────────────────────────────────────

function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = size;
  c.height = size;
  return c;
}

/** Scale a canonical 64-px value to the requested canvas size. */
function sc(v: number, s: number): number {
  return (v / 64) * s;
}

/**
 * Draws a filled (or stroked) rounded-rectangle path.
 * Caller must call ctx.fill() / ctx.stroke() afterwards.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y,         x + rad, y);
  ctx.closePath();
}

/**
 * Applies a soft radial glow centred on (cx, cy).
 */
function drawGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  colour: string, alpha: number,
): void {
  const alphaHex = Math.round(Math.min(1, alpha) * 255)
    .toString(16).padStart(2, '0');
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, colour + alphaHex);
  grad.addColorStop(1, colour + '00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the shared deep-space background panel with corner rounding and a
 * subtle vignette darkening towards the edges.
 */
function drawBackground(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.clearRect(0, 0, size, size);

  // Deep space base
  ctx.fillStyle = '#080c14';
  roundRect(ctx, 0, 0, size, size, size * 0.12);
  ctx.fill();

  // Faint star scatter for atmosphere
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  const stars = [
    [4, 6], [58, 10], [14, 58], [52, 54], [8, 34], [56, 28],
    [20, 4], [46, 60], [60, 42], [2, 48], [36, 2], [62, 16],
  ] as const;
  for (const [sx, sy] of stars) {
    ctx.beginPath();
    ctx.arc(sc(sx, size), sc(sy, size), sc(0.4, size), 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle edge vignette
  const vig = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.22,
    size / 2, size / 2, size * 0.78,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  roundRect(ctx, 0, 0, size, size, size * 0.12);
  ctx.fillStyle = vig;
  ctx.fill();
}

/**
 * Draws a flat ground/platform foundation for buildings that rest on the
 * surface. Provides a consistent base line across all icon types.
 */
function drawGroundPlatform(
  ctx: CanvasRenderingContext2D, s: number,
  x: number, y: number, w: number, accent: string,
): void {
  // Shadow beneath platform
  const shadow = ctx.createLinearGradient(x, y, x, y + sc(4, s));
  shadow.addColorStop(0, 'rgba(0,0,0,0.5)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  roundRect(ctx, x + sc(1, s), y + sc(2, s), w - sc(2, s), sc(4, s), sc(1, s));
  ctx.fill();

  // Concrete slab
  ctx.fillStyle = '#1e2535';
  roundRect(ctx, x, y, w, sc(4, s), sc(1.5, s));
  ctx.fill();

  // Top edge highlight
  ctx.strokeStyle = '#2e3a50';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.moveTo(x + sc(2, s), y + sc(0.5, s));
  ctx.lineTo(x + w - sc(2, s), y + sc(0.5, s));
  ctx.stroke();

  // Accent marker lights along platform edge
  ctx.fillStyle = accent + '99';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + sc(3, s) + i * (w - sc(6, s)) / 2, y + sc(1.5, s), sc(0.8, s), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws a repeating panel-line grid to simulate hull plating on a rectangle.
 */
function drawPanelLines(
  ctx: CanvasRenderingContext2D, s: number,
  x: number, y: number, w: number, h: number,
  spacing: number, colour: string,
): void {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, sc(1, s));
  ctx.clip();
  ctx.strokeStyle = colour;
  ctx.lineWidth = sc(0.5, s);
  const step = sc(spacing, s);
  // Horizontal panel seams
  for (let py = y + step; py < y + h; py += step) {
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x + w, py);
    ctx.stroke();
  }
  // Vertical panel seams (wider spacing)
  for (let px = x + step * 1.5; px < x + w; px += step * 1.5) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws a small rivet dot at the given canonical coordinates.
 */
function drawRivet(ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.arc(sc(cx, s), sc(cy, s), sc(1.0, s), 0, Math.PI * 2);
  ctx.fillStyle = '#556070';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(sc(cx - 0.3, s), sc(cy - 0.3, s), sc(0.4, s), 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws a simple ventilation grille (parallel lines) inside a clipped rect.
 */
function drawVentGrille(
  ctx: CanvasRenderingContext2D, s: number,
  x: number, y: number, w: number, h: number,
): void {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, sc(0.5, s));
  ctx.clip();
  ctx.fillStyle = '#111820';
  roundRect(ctx, x, y, w, h, sc(0.5, s));
  ctx.fill();
  ctx.strokeStyle = '#2a3540';
  ctx.lineWidth = sc(0.5, s);
  const step = sc(2.5, s);
  for (let vy = y + step * 0.5; vy < y + h; vy += step) {
    ctx.beginPath();
    ctx.moveTo(x, vy);
    ctx.lineTo(x + w, vy);
    ctx.stroke();
  }
  ctx.restore();
}

type DrawFn = (ctx: CanvasRenderingContext2D, s: number, accent: string) => void;

// ── Research Lab ──────────────────────────────────────────────────────────────
// Geodesic dome with hexagonal panel pattern, large telescope array on top,
// blue holographic glow from windows, satellite dishes on sides.

const drawResearchLab: DrawFn = (ctx, s, accent) => {
  const cx = sc(32, s);
  const baseY = sc(52, s);

  // Foundation platform
  drawGroundPlatform(ctx, s, sc(8, s), baseY, sc(48, s), accent);

  // Outer dome body — lit from upper-left
  const domeGrad = ctx.createRadialGradient(
    sc(26, s), sc(26, s), sc(2, s),
    sc(32, s), sc(32, s), sc(22, s),
  );
  domeGrad.addColorStop(0, '#4a7ab0');
  domeGrad.addColorStop(0.6, '#1e3060');
  domeGrad.addColorStop(1, '#0e1830');
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.arc(cx, baseY, sc(20, s), Math.PI, 0);
  ctx.lineTo(cx + sc(20, s), baseY);
  ctx.closePath();
  ctx.fill();

  // Geodesic hexagonal panel lines on dome surface
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, baseY, sc(20, s), Math.PI, 0);
  ctx.lineTo(cx + sc(20, s), baseY);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(100,170,255,0.25)';
  ctx.lineWidth = sc(0.7, s);
  // Draw a hex-grid approximation using 3 families of parallel lines
  const hexStep = sc(8, s);
  for (let hx = cx - sc(24, s); hx < cx + sc(24, s); hx += hexStep) {
    ctx.beginPath(); ctx.moveTo(hx, baseY - sc(24, s)); ctx.lineTo(hx, baseY); ctx.stroke();
  }
  for (let hi = -4; hi <= 4; hi++) {
    const hox = cx + hi * hexStep * 0.5;
    const hoy = baseY - hi * hexStep * 0.866 * 0.5;
    ctx.beginPath(); ctx.moveTo(hox - sc(16, s), hoy + sc(16, s) * 0.577);
    ctx.lineTo(hox + sc(16, s), hoy - sc(16, s) * 0.577); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hox + sc(16, s), hoy + sc(16, s) * 0.577);
    ctx.lineTo(hox - sc(16, s), hoy - sc(16, s) * 0.577); ctx.stroke();
  }
  ctx.restore();

  // Dome glass specular highlight — upper left
  ctx.fillStyle = 'rgba(160,220,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(sc(24, s), sc(35, s), sc(8, s), sc(4.5, s), -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Blue holographic window glow through dome panels
  drawGlow(ctx, cx, sc(38, s), sc(16, s), accent, 0.28);

  // Dome equatorial ring
  ctx.strokeStyle = '#3a5888';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(cx - sc(20, s), baseY);
  ctx.lineTo(cx + sc(20, s), baseY);
  ctx.stroke();

  // Central telescope mast
  ctx.strokeStyle = '#8ab0d0';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(cx, baseY - sc(1, s));
  ctx.lineTo(cx, sc(12, s));
  ctx.stroke();

  // Mast cross-bracing
  ctx.strokeStyle = '#4a6a8a';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.moveTo(cx - sc(4, s), sc(24, s));
  ctx.lineTo(cx + sc(4, s), sc(18, s));
  ctx.moveTo(cx + sc(4, s), sc(24, s));
  ctx.lineTo(cx - sc(4, s), sc(18, s));
  ctx.stroke();

  // Telescope dish at top of mast
  ctx.strokeStyle = accent;
  ctx.lineWidth = sc(2, s);
  ctx.beginPath();
  ctx.arc(cx, sc(12, s), sc(7, s), Math.PI * 0.6, Math.PI * 2.4);
  ctx.stroke();

  // Dish feed horn
  ctx.fillStyle = '#aaccee';
  ctx.beginPath();
  ctx.arc(cx, sc(12, s), sc(1.5, s), 0, Math.PI * 2);
  ctx.fill();

  drawGlow(ctx, cx, sc(12, s), sc(12, s), accent, 0.6);

  // Left satellite dish
  ctx.strokeStyle = '#6090b8';
  ctx.lineWidth = sc(1.2, s);
  ctx.beginPath();
  ctx.moveTo(sc(13, s), baseY);
  ctx.lineTo(sc(10, s), sc(38, s));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sc(10, s), sc(34, s), sc(6, s), Math.PI * 0.7, Math.PI * 1.3);
  ctx.stroke();
  ctx.fillStyle = accent + '66';
  ctx.beginPath();
  ctx.arc(sc(10, s), sc(34, s), sc(1.5, s), 0, Math.PI * 2);
  ctx.fill();

  // Right satellite dish
  ctx.beginPath();
  ctx.moveTo(sc(51, s), baseY);
  ctx.lineTo(sc(54, s), sc(38, s));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sc(54, s), sc(34, s), sc(6, s), Math.PI * 1.7, Math.PI * 0.3);
  ctx.stroke();
  ctx.fillStyle = accent + '66';
  ctx.beginPath();
  ctx.arc(sc(54, s), sc(34, s), sc(1.5, s), 0, Math.PI * 2);
  ctx.fill();

  // Holographic porthole windows on dome base ring
  const windowAngles = [-0.55, -0.2, 0.2, 0.55];
  for (const wa of windowAngles) {
    const wx = cx + sc(18, s) * Math.sin(wa);
    const wy = baseY - sc(6, s) + sc(4, s) * Math.cos(wa);
    ctx.fillStyle = accent + 'aa';
    ctx.beginPath();
    ctx.ellipse(wx, wy, sc(2, s), sc(1.2, s), wa, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, wx, wy, sc(4, s), accent, 0.4);
  }

  // Data conduit pipe running up mast
  ctx.strokeStyle = '#2a4a6a';
  ctx.lineWidth = sc(1, s);
  ctx.beginPath();
  ctx.moveTo(cx + sc(1.5, s), baseY - sc(2, s));
  ctx.lineTo(cx + sc(1.5, s), sc(14, s));
  ctx.stroke();
};

// ── Factory ───────────────────────────────────────────────────────────────────
// Heavy industrial block, multiple smokestacks with orange exhaust glow,
// visible conveyor belts, crane arm, loading bay with amber lights,
// pipes running along walls, dirty industrial feel.

const drawFactory: DrawFn = (ctx, s, accent) => {
  // Foundation
  drawGroundPlatform(ctx, s, sc(7, s), sc(53, s), sc(50, s), accent);

  // Main industrial block — two-tone to suggest front/top faces
  const blockGrad = ctx.createLinearGradient(sc(10, s), sc(30, s), sc(10, s), sc(54, s));
  blockGrad.addColorStop(0, '#3c3020');
  blockGrad.addColorStop(1, '#1e1a10');
  ctx.fillStyle = blockGrad;
  roundRect(ctx, sc(10, s), sc(28, s), sc(44, s), sc(26, s), sc(2, s));
  ctx.fill();

  // Isometric top-face hint — lighter trapezoid
  ctx.fillStyle = '#4a3e24';
  ctx.beginPath();
  ctx.moveTo(sc(10, s), sc(28, s));
  ctx.lineTo(sc(54, s), sc(28, s));
  ctx.lineTo(sc(50, s), sc(23, s));
  ctx.lineTo(sc(14, s), sc(23, s));
  ctx.closePath();
  ctx.fill();

  // Panel lines on main block
  drawPanelLines(ctx, s, sc(10, s), sc(28, s), sc(44, s), sc(26, s), 6, 'rgba(80,60,20,0.5)');

  // Three heavy smokestacks with grime gradient
  const stacksX = [sc(18, s), sc(30, s), sc(42, s)];
  for (const sx of stacksX) {
    const stackGrad = ctx.createLinearGradient(sx - sc(4, s), 0, sx + sc(4, s), 0);
    stackGrad.addColorStop(0, '#1a1408');
    stackGrad.addColorStop(0.5, '#2e2410');
    stackGrad.addColorStop(1, '#1a1408');
    ctx.fillStyle = stackGrad;
    roundRect(ctx, sx - sc(4, s), sc(6, s), sc(8, s), sc(24, s), sc(1.5, s));
    ctx.fill();

    // Stack rim — flanged top
    ctx.fillStyle = '#3e3018';
    roundRect(ctx, sx - sc(5, s), sc(5, s), sc(10, s), sc(4, s), sc(1, s));
    ctx.fill();
    // Rivet on stack rim
    drawRivet(ctx, s, (sx / s) * 64 - 3, 5);
    drawRivet(ctx, s, (sx / s) * 64 + 3, 5);

    // Stack vent grilles
    drawVentGrille(ctx, s, sx - sc(3, s), sc(14, s), sc(6, s), sc(6, s));

    // Orange exhaust billow — layered glows
    drawGlow(ctx, sx, sc(6, s), sc(9, s), accent, 0.55);
    drawGlow(ctx, sx, sc(4, s), sc(5, s), '#ffcc44', 0.4);
    ctx.fillStyle = accent + '66';
    ctx.beginPath();
    ctx.ellipse(sx, sc(6, s), sc(4, s), sc(1.8, s), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Loading bay door — recessed panel
  ctx.fillStyle = '#141008';
  roundRect(ctx, sc(14, s), sc(38, s), sc(16, s), sc(16, s), sc(1, s));
  ctx.fill();
  ctx.strokeStyle = '#3a2c10';
  ctx.lineWidth = sc(0.75, s);
  // Horizontal bay door slats
  for (let sl = 0; sl < 3; sl++) {
    ctx.beginPath();
    ctx.moveTo(sc(15, s), sc(41 + sl * 4, s));
    ctx.lineTo(sc(29, s), sc(41 + sl * 4, s));
    ctx.stroke();
  }
  // Amber loading bay lights
  ctx.fillStyle = '#ffaa22ee';
  ctx.beginPath();
  ctx.arc(sc(17, s), sc(39, s), sc(1.2, s), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sc(27, s), sc(39, s), sc(1.2, s), 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, sc(17, s), sc(39, s), sc(4, s), '#ffaa22', 0.5);
  drawGlow(ctx, sc(27, s), sc(39, s), sc(4, s), '#ffaa22', 0.5);

  // Conveyor belt — striped horizontal band
  ctx.fillStyle = '#2a2010';
  roundRect(ctx, sc(32, s), sc(44, s), sc(20, s), sc(6, s), sc(1, s));
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, sc(32, s), sc(44, s), sc(20, s), sc(6, s), sc(1, s));
  ctx.clip();
  ctx.strokeStyle = '#3e3018';
  ctx.lineWidth = sc(1, s);
  for (let cv = 0; cv < 7; cv++) {
    ctx.beginPath();
    ctx.moveTo(sc(33 + cv * 3, s), sc(44, s));
    ctx.lineTo(sc(33 + cv * 3, s), sc(50, s));
    ctx.stroke();
  }
  ctx.restore();
  // Small cargo block on belt
  ctx.fillStyle = accent + '88';
  roundRect(ctx, sc(38, s), sc(44, s), sc(6, s), sc(5, s), sc(0.5, s));
  ctx.fill();

  // Crane arm extending from rooftop
  ctx.strokeStyle = '#6a5020';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(48, s), sc(23, s));
  ctx.lineTo(sc(56, s), sc(23, s));
  ctx.lineTo(sc(56, s), sc(30, s));
  ctx.stroke();
  // Crane cable
  ctx.strokeStyle = '#998060';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.moveTo(sc(56, s), sc(24, s));
  ctx.lineTo(sc(54, s), sc(34, s));
  ctx.stroke();
  // Hook
  ctx.beginPath();
  ctx.arc(sc(54, s), sc(35, s), sc(1.5, s), Math.PI * 0.5, Math.PI * 2.5);
  ctx.stroke();

  // Pipe network along the right wall
  ctx.strokeStyle = '#4a3818';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(54, s), sc(28, s));
  ctx.lineTo(sc(57, s), sc(28, s));
  ctx.lineTo(sc(57, s), sc(40, s));
  ctx.lineTo(sc(54, s), sc(40, s));
  ctx.stroke();
  // Pipe junction knobs
  ctx.fillStyle = '#5a4828';
  ctx.beginPath();
  ctx.arc(sc(57, s), sc(34, s), sc(1.5, s), 0, Math.PI * 2);
  ctx.fill();

  // Rivets along main block top edge
  for (let ri = 0; ri < 5; ri++) {
    drawRivet(ctx, s, 13 + ri * 9, 23.5);
  }

  // Industrial heat-haze glow above smokestacks
  drawGlow(ctx, sc(30, s), sc(4, s), sc(22, s), accent, 0.12);
};

// ── Shipyard ──────────────────────────────────────────────────────────────────
// Orbital construction frame with two large gantry arms forming a cradle,
// welding sparks, scaffolding, small ship hull visible, blue construction beam.

const drawShipyard: DrawFn = (ctx, s, accent) => {
  // Dock base platform
  drawGroundPlatform(ctx, s, sc(6, s), sc(55, s), sc(52, s), accent);

  // ── Left gantry arm ──
  ctx.strokeStyle = '#3a5878';
  ctx.lineWidth = sc(2.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(8,  s), sc(56, s));
  ctx.lineTo(sc(8,  s), sc(8,  s));
  ctx.lineTo(sc(32, s), sc(8,  s));
  ctx.stroke();

  // ── Right gantry arm ──
  ctx.beginPath();
  ctx.moveTo(sc(56, s), sc(56, s));
  ctx.lineTo(sc(56, s), sc(8,  s));
  ctx.lineTo(sc(32, s), sc(8,  s));
  ctx.stroke();

  // Gantry arm cross-section detail (I-beam flanges)
  ctx.strokeStyle = '#2a4060';
  ctx.lineWidth = sc(1, s);
  ctx.beginPath();
  ctx.moveTo(sc(6,  s), sc(56, s)); ctx.lineTo(sc(10, s), sc(56, s));
  ctx.moveTo(sc(6,  s), sc(8,  s)); ctx.lineTo(sc(10, s), sc(8,  s));
  ctx.moveTo(sc(54, s), sc(56, s)); ctx.lineTo(sc(58, s), sc(56, s));
  ctx.moveTo(sc(54, s), sc(8,  s)); ctx.lineTo(sc(58, s), sc(8,  s));
  ctx.moveTo(sc(30, s), sc(6,  s)); ctx.lineTo(sc(34, s), sc(6,  s));
  ctx.stroke();

  // Scaffolding horizontal rungs
  ctx.strokeStyle = '#284458';
  ctx.lineWidth = sc(1.2, s);
  for (let i = 1; i <= 4; i++) {
    const ry = sc(8 + i * 10, s);
    ctx.beginPath();
    ctx.moveTo(sc(8, s), ry);
    ctx.lineTo(sc(56, s), ry);
    ctx.stroke();
  }

  // Diagonal cross-bracing between rungs
  ctx.lineWidth = sc(0.75, s);
  ctx.strokeStyle = '#1e3348';
  for (let i = 0; i < 4; i++) {
    const y1 = sc(8 + i * 10, s);
    const y2 = sc(18 + i * 10, s);
    ctx.beginPath();
    ctx.moveTo(sc(8, s),  y1); ctx.lineTo(sc(32, s), y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sc(56, s), y1); ctx.lineTo(sc(32, s), y2); ctx.stroke();
  }

  // Ship hull under construction — elongated fuselage
  const hullGrad = ctx.createLinearGradient(sc(20, s), sc(32, s), sc(20, s), sc(50, s));
  hullGrad.addColorStop(0, '#243c54');
  hullGrad.addColorStop(1, '#111e2c');
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(32, s));   // nose
  ctx.bezierCurveTo(sc(46, s), sc(34, s), sc(50, s), sc(44, s), sc(46, s), sc(50, s));
  ctx.lineTo(sc(18, s), sc(50, s));
  ctx.bezierCurveTo(sc(14, s), sc(44, s), sc(18, s), sc(34, s), sc(32, s), sc(32, s));
  ctx.fill();

  // Hull panel lines
  drawPanelLines(ctx, s, sc(19, s), sc(34, s), sc(26, s), sc(16, s), 5, 'rgba(80,130,180,0.3)');

  // Engine nozzle outlines at hull rear
  ctx.strokeStyle = '#4a7090';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.ellipse(sc(24, s), sc(50, s), sc(3, s), sc(1.5, s), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(sc(32, s), sc(50, s), sc(3, s), sc(1.5, s), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(sc(40, s), sc(50, s), sc(3, s), sc(1.5, s), 0, 0, Math.PI * 2);
  ctx.stroke();

  // Blue construction energy beam down both gantry arms
  ctx.save();
  ctx.shadowBlur = sc(8, s);
  ctx.shadowColor = accent;
  ctx.strokeStyle = accent;
  ctx.lineWidth = sc(1.2, s);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(sc(8,  s), sc(8,  s));
  ctx.lineTo(sc(32, s), sc(50, s));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sc(56, s), sc(8,  s));
  ctx.lineTo(sc(32, s), sc(50, s));
  ctx.stroke();
  ctx.restore();

  // Welding sparks — bright scattered dots near construction hot-spots
  const sparkPositions = [
    [26, 42], [36, 40], [22, 48], [42, 46],
    [18, 44], [46, 42], [30, 36], [34, 44],
  ] as const;
  for (const [spx, spy] of sparkPositions) {
    const hash = (spx * 3 + spy * 7) % 3;
    const sparkColour = hash === 0 ? '#ffffff' : hash === 1 ? '#ffcc44' : accent;
    ctx.fillStyle = sparkColour;
    ctx.beginPath();
    ctx.arc(sc(spx, s), sc(spy, s), sc(0.6 + (hash * 0.4), s), 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, sc(spx, s), sc(spy, s), sc(2.5, s), sparkColour, 0.6);
  }

  // Glow at gantry tip and beam convergence
  drawGlow(ctx, sc(8,  s), sc(8,  s), sc(9,  s), accent, 0.65);
  drawGlow(ctx, sc(56, s), sc(8,  s), sc(9,  s), accent, 0.65);
  drawGlow(ctx, sc(32, s), sc(50, s), sc(12, s), accent, 0.50);
  drawGlow(ctx, sc(32, s), sc(8,  s), sc(8,  s), accent, 0.45);
};

// ── Trade Hub ─────────────────────────────────────────────────────────────────
// Multi-level commercial tower, holographic signage (green), stacked cargo
// containers, connecting walkways between sections, busy prosperous feel.

const drawTradeHub: DrawFn = (ctx, s, accent) => {
  drawGroundPlatform(ctx, s, sc(6, s), sc(54, s), sc(52, s), accent);

  // Stacked cargo containers at base — colourful freight crates
  const containerData = [
    { x: sc(6, s),  y: sc(49, s), w: sc(11, s), h: sc(6, s), c: '#1e3322' },
    { x: sc(18, s), y: sc(49, s), w: sc(11, s), h: sc(6, s), c: '#2a2010' },
    { x: sc(36, s), y: sc(49, s), w: sc(11, s), h: sc(6, s), c: '#101e2a' },
    { x: sc(48, s), y: sc(49, s), w: sc(10, s), h: sc(6, s), c: '#1e1022' },
    { x: sc(9, s),  y: sc(43, s), w: sc(10, s), h: sc(6, s), c: '#101e18' },
    { x: sc(45, s), y: sc(43, s), w: sc(11, s), h: sc(6, s), c: '#201020' },
  ];
  for (const cd of containerData) {
    ctx.fillStyle = cd.c;
    roundRect(ctx, cd.x, cd.y, cd.w, cd.h, sc(0.8, s));
    ctx.fill();
    // Container stripe
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = sc(0.5, s);
    ctx.beginPath();
    ctx.moveTo(cd.x + cd.w * 0.5, cd.y + sc(1, s));
    ctx.lineTo(cd.x + cd.w * 0.5, cd.y + cd.h - sc(1, s));
    ctx.stroke();
  }

  // Side wings — lower annex buildings
  const wingGrad = ctx.createLinearGradient(sc(8, s), sc(28, s), sc(8, s), sc(54, s));
  wingGrad.addColorStop(0, '#1e2e20');
  wingGrad.addColorStop(1, '#0e1810');
  ctx.fillStyle = wingGrad;
  roundRect(ctx, sc(7, s),  sc(28, s), sc(14, s), sc(22, s), sc(2, s));
  ctx.fill();
  roundRect(ctx, sc(43, s), sc(28, s), sc(14, s), sc(22, s), sc(2, s));
  ctx.fill();

  // Walkways connecting wings to main tower
  ctx.fillStyle = '#2a3c28';
  roundRect(ctx, sc(21, s), sc(34, s), sc(3, s), sc(4, s), 0);
  ctx.fill();
  roundRect(ctx, sc(40, s), sc(34, s), sc(3, s), sc(4, s), 0);
  ctx.fill();
  // Walkway railings
  ctx.strokeStyle = '#3a5030';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.moveTo(sc(21, s), sc(34, s)); ctx.lineTo(sc(24, s), sc(34, s));
  ctx.moveTo(sc(40, s), sc(34, s)); ctx.lineTo(sc(43, s), sc(34, s));
  ctx.stroke();

  // Main central tower — tapered for height perspective
  const towerGrad = ctx.createLinearGradient(sc(22, s), sc(10, s), sc(42, s), sc(42, s));
  towerGrad.addColorStop(0, '#2a4030');
  towerGrad.addColorStop(1, '#0e1c14');
  ctx.fillStyle = towerGrad;
  roundRect(ctx, sc(22, s), sc(10, s), sc(20, s), sc(34, s), sc(2, s));
  ctx.fill();

  // Panel lines on tower
  drawPanelLines(ctx, s, sc(22, s), sc(10, s), sc(20, s), sc(34, s), 6, 'rgba(40,80,50,0.5)');

  // Tower window lights — lit in a grid pattern
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      const hash = (row * 5 + col * 11) % 5;
      const litColour = hash < 3 ? accent + 'cc' : hash === 3 ? '#88ffbb99' : '#ddffcc55';
      ctx.fillStyle = litColour;
      roundRect(ctx, sc(26 + col * 8, s), sc(14 + row * 7, s), sc(4, s), sc(4, s), sc(0.5, s));
      ctx.fill();
      if (hash < 3) drawGlow(ctx, sc(28 + col * 8, s), sc(16 + row * 7, s), sc(4, s), accent, 0.3);
    }
  }

  // Wing windows — smaller
  for (let wr = 0; wr < 3; wr++) {
    const hash = (wr * 7) % 3;
    ctx.fillStyle = hash > 0 ? accent + '77' : '#336644aa';
    ctx.beginPath();
    ctx.arc(sc(14, s), sc(32 + wr * 5, s), sc(1.5, s), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sc(50, s), sc(32 + wr * 5, s), sc(1.5, s), 0, Math.PI * 2);
    ctx.fill();
  }

  // Rooftop spire with holographic emitter
  ctx.strokeStyle = '#3a6044';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(10, s));
  ctx.lineTo(sc(32, s), sc(3, s));
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(3, s), sc(2.5, s), 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, sc(32, s), sc(3, s), sc(12, s), accent, 0.65);

  // Holographic signage — green arc glowing above tower
  ctx.save();
  ctx.shadowBlur = sc(6, s);
  ctx.shadowColor = accent;
  ctx.strokeStyle = accent + 'dd';
  ctx.lineWidth = sc(1.2, s);
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(10, s), sc(14, s), Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.restore();

  // Ambient commerce glow
  drawGlow(ctx, sc(32, s), sc(30, s), sc(22, s), accent, 0.14);
};

// ── Defence Grid ──────────────────────────────────────────────────────────────
// Military bunker half-underground, radar dish, missile launcher tubes,
// red warning lights, reinforced walls with armour plating.

const drawDefenceGrid: DrawFn = (ctx, s, accent) => {
  // Underground portion — earth fill behind bunker
  ctx.fillStyle = '#18120a';
  ctx.beginPath();
  ctx.moveTo(sc(6,  s), sc(64, s));
  ctx.lineTo(sc(6,  s), sc(48, s));
  ctx.lineTo(sc(58, s), sc(48, s));
  ctx.lineTo(sc(58, s), sc(64, s));
  ctx.closePath();
  ctx.fill();

  // Earth texture line
  ctx.strokeStyle = '#2a1e0e';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.moveTo(sc(4, s), sc(48, s));
  ctx.lineTo(sc(60, s), sc(48, s));
  ctx.stroke();

  // Bunker base — heavy angular fortified silhouette
  const bunkerGrad = ctx.createLinearGradient(sc(10, s), sc(22, s), sc(10, s), sc(48, s));
  bunkerGrad.addColorStop(0, '#3c2828');
  bunkerGrad.addColorStop(1, '#1e1414');
  ctx.fillStyle = bunkerGrad;
  ctx.beginPath();
  ctx.moveTo(sc(6,  s), sc(48, s));
  ctx.lineTo(sc(6,  s), sc(36, s));
  ctx.lineTo(sc(16, s), sc(22, s));
  ctx.lineTo(sc(48, s), sc(22, s));
  ctx.lineTo(sc(58, s), sc(36, s));
  ctx.lineTo(sc(58, s), sc(48, s));
  ctx.closePath();
  ctx.fill();

  // Front armour plating layer — slightly lighter
  ctx.fillStyle = '#4a3030';
  ctx.beginPath();
  ctx.moveTo(sc(10, s), sc(48, s));
  ctx.lineTo(sc(10, s), sc(38, s));
  ctx.lineTo(sc(18, s), sc(28, s));
  ctx.lineTo(sc(46, s), sc(28, s));
  ctx.lineTo(sc(54, s), sc(38, s));
  ctx.lineTo(sc(54, s), sc(48, s));
  ctx.closePath();
  ctx.fill();

  // Armour plate weld seams and panel rivets
  ctx.strokeStyle = '#2a1e1e';
  ctx.lineWidth = sc(0.75, s);
  // Vertical seam lines on front armour
  ctx.beginPath();
  ctx.moveTo(sc(24, s), sc(28, s)); ctx.lineTo(sc(22, s), sc(48, s));
  ctx.moveTo(sc(32, s), sc(28, s)); ctx.lineTo(sc(32, s), sc(48, s));
  ctx.moveTo(sc(40, s), sc(28, s)); ctx.lineTo(sc(42, s), sc(48, s));
  ctx.stroke();
  // Horizontal seam
  ctx.beginPath();
  ctx.moveTo(sc(12, s), sc(38, s)); ctx.lineTo(sc(52, s), sc(38, s));
  ctx.stroke();

  // Armour bolt rivets — systematic grid
  const rivetCoords = [
    [20, 30], [32, 30], [44, 30],
    [16, 38], [26, 38], [38, 38], [48, 38],
    [20, 44], [32, 44], [44, 44],
  ] as const;
  for (const [rx, ry] of rivetCoords) {
    drawRivet(ctx, s, rx, ry);
  }

  // Vent grilles on lower armour panels
  drawVentGrille(ctx, s, sc(14, s), sc(40, s), sc(10, s), sc(5, s));
  drawVentGrille(ctx, s, sc(40, s), sc(40, s), sc(10, s), sc(5, s));

  // Left missile launcher tube cluster
  ctx.fillStyle = '#2c1c1c';
  roundRect(ctx, sc(10, s), sc(14, s), sc(8, s), sc(10, s), sc(1, s));
  ctx.fill();
  ctx.strokeStyle = '#3a2424';
  ctx.lineWidth = sc(1.5, s);
  // Two tubes per launcher
  ctx.beginPath();
  ctx.moveTo(sc(12, s), sc(14, s)); ctx.lineTo(sc(10, s), sc(4, s));
  ctx.moveTo(sc(16, s), sc(14, s)); ctx.lineTo(sc(15, s), sc(4, s));
  ctx.stroke();
  // Tube tips
  ctx.fillStyle = accent + 'cc';
  ctx.beginPath(); ctx.arc(sc(10, s), sc(4, s), sc(1.2, s), 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sc(15, s), sc(4, s), sc(1.2, s), 0, Math.PI * 2); ctx.fill();
  drawGlow(ctx, sc(12, s), sc(4, s), sc(8, s), accent, 0.45);

  // Right missile launcher tube cluster
  ctx.fillStyle = '#2c1c1c';
  roundRect(ctx, sc(46, s), sc(14, s), sc(8, s), sc(10, s), sc(1, s));
  ctx.fill();
  ctx.strokeStyle = '#3a2424';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(50, s), sc(14, s)); ctx.lineTo(sc(49, s), sc(4, s));
  ctx.moveTo(sc(54, s), sc(14, s)); ctx.lineTo(sc(54, s), sc(4, s));
  ctx.stroke();
  ctx.fillStyle = accent + 'cc';
  ctx.beginPath(); ctx.arc(sc(49, s), sc(4, s), sc(1.2, s), 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sc(54, s), sc(4, s), sc(1.2, s), 0, Math.PI * 2); ctx.fill();
  drawGlow(ctx, sc(52, s), sc(4, s), sc(8, s), accent, 0.45);

  // Central radar mast
  ctx.strokeStyle = '#6a4444';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(22, s));
  ctx.lineTo(sc(32, s), sc(10, s));
  ctx.stroke();

  // Radar dish — distinctive concave arc with motion-implied support
  ctx.strokeStyle = '#886060';
  ctx.lineWidth = sc(2, s);
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(10, s), sc(9, s), Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // Dish centre pivot
  ctx.fillStyle = '#aaaaaa';
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(10, s), sc(2, s), 0, Math.PI * 2);
  ctx.fill();
  // Motion-implied arc lines (sweeping radar)
  ctx.strokeStyle = accent + '44';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(10, s), sc(12, s), Math.PI * 0.9, Math.PI * 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(10, s), sc(15, s), Math.PI * 0.9, Math.PI * 1.1);
  ctx.stroke();

  // Red warning indicator lights on bunker face
  const warnLights = [sc(14, s), sc(32, s), sc(50, s)] as const;
  for (const wlx of warnLights) {
    ctx.fillStyle = '#ff2222ee';
    ctx.beginPath();
    ctx.arc(wlx, sc(36, s), sc(1.5, s), 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, wlx, sc(36, s), sc(5, s), '#ff2222', 0.55);
  }

  // Targeting laser from radar
  ctx.save();
  ctx.shadowBlur = sc(4, s);
  ctx.shadowColor = accent;
  ctx.strokeStyle = accent + '88';
  ctx.lineWidth = sc(0.8, s);
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(10, s));
  ctx.lineTo(sc(56, s), sc(2, s));
  ctx.stroke();
  ctx.restore();
};

// ── Population Centre ─────────────────────────────────────────────────────────
// Cluster of habitat domes connected by walkways, warm yellow-white window
// lights in a grid pattern, garden/park area on one dome, residential feel.

const drawPopulationCentre: DrawFn = (ctx, s, accent) => {
  drawGroundPlatform(ctx, s, sc(5, s), sc(54, s), sc(54, s), accent);

  // Ground-level garden/park on left — green patch between domes
  ctx.fillStyle = '#1a3010';
  ctx.beginPath();
  ctx.ellipse(sc(16, s), sc(54, s), sc(8, s), sc(3, s), 0, 0, Math.PI * 2);
  ctx.fill();
  // Garden greenery dots
  ctx.fillStyle = '#2a4818';
  for (const [gx, gy] of [[12, 52], [15, 50], [19, 53], [13, 54], [18, 51]] as const) {
    ctx.beginPath();
    ctx.arc(sc(gx, s), sc(gy, s), sc(1.5, s), 0, Math.PI * 2);
    ctx.fill();
  }
  drawGlow(ctx, sc(16, s), sc(52, s), sc(8, s), '#44aa22', 0.2);

  // Left habitat dome — shorter
  const leftDomeGrad = ctx.createRadialGradient(
    sc(15, s), sc(36, s), sc(1, s), sc(16, s), sc(38, s), sc(12, s),
  );
  leftDomeGrad.addColorStop(0, '#2a3a50');
  leftDomeGrad.addColorStop(1, '#121e30');
  ctx.fillStyle = leftDomeGrad;
  ctx.beginPath();
  ctx.arc(sc(16, s), sc(46, s), sc(11, s), Math.PI, 0);
  ctx.lineTo(sc(27, s), sc(46, s));
  ctx.lineTo(sc(5,  s), sc(46, s));
  ctx.closePath();
  ctx.fill();

  // Left dome garden dome cap — transparent green tint to show garden below
  ctx.fillStyle = 'rgba(40,120,20,0.12)';
  ctx.beginPath();
  ctx.arc(sc(16, s), sc(46, s), sc(11, s), Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Dome panel seams
  ctx.strokeStyle = 'rgba(80,130,200,0.2)';
  ctx.lineWidth = sc(0.6, s);
  for (let seg = 1; seg <= 4; seg++) {
    const angle = Math.PI + (seg / 5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(sc(16, s), sc(46, s));
    ctx.lineTo(sc(16, s) + sc(11, s) * Math.cos(angle), sc(46, s) + sc(11, s) * Math.sin(angle));
    ctx.stroke();
  }

  // Left dome glass highlight
  ctx.fillStyle = 'rgba(180,220,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(sc(12, s), sc(40, s), sc(5, s), sc(3, s), -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Right habitat dome — shorter
  const rightDomeGrad = ctx.createRadialGradient(
    sc(47, s), sc(38, s), sc(1, s), sc(48, s), sc(40, s), sc(12, s),
  );
  rightDomeGrad.addColorStop(0, '#2a3848');
  rightDomeGrad.addColorStop(1, '#111c28');
  ctx.fillStyle = rightDomeGrad;
  ctx.beginPath();
  ctx.arc(sc(48, s), sc(46, s), sc(11, s), Math.PI, 0);
  ctx.lineTo(sc(59, s), sc(46, s));
  ctx.lineTo(sc(37, s), sc(46, s));
  ctx.closePath();
  ctx.fill();

  // Right dome panel seams
  ctx.strokeStyle = 'rgba(80,130,200,0.2)';
  ctx.lineWidth = sc(0.6, s);
  for (let seg = 1; seg <= 4; seg++) {
    const angle = Math.PI + (seg / 5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(sc(48, s), sc(46, s));
    ctx.lineTo(sc(48, s) + sc(11, s) * Math.cos(angle), sc(46, s) + sc(11, s) * Math.sin(angle));
    ctx.stroke();
  }

  // Central tall habitat dome — largest
  const centDomeGrad = ctx.createRadialGradient(
    sc(28, s), sc(22, s), sc(2, s), sc(32, s), sc(26, s), sc(18, s),
  );
  centDomeGrad.addColorStop(0, '#304060');
  centDomeGrad.addColorStop(1, '#141e30');
  ctx.fillStyle = centDomeGrad;
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(42, s), sc(18, s), Math.PI, 0);
  ctx.lineTo(sc(50, s), sc(42, s));
  ctx.lineTo(sc(14, s), sc(42, s));
  ctx.closePath();
  ctx.fill();

  // Central dome panel lines
  ctx.strokeStyle = 'rgba(100,160,255,0.2)';
  ctx.lineWidth = sc(0.7, s);
  for (let seg = 1; seg <= 6; seg++) {
    const angle = Math.PI + (seg / 7) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(sc(32, s), sc(42, s));
    ctx.lineTo(sc(32, s) + sc(18, s) * Math.cos(angle), sc(42, s) + sc(18, s) * Math.sin(angle));
    ctx.stroke();
  }

  // Central dome glass highlight
  ctx.fillStyle = 'rgba(160,200,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(sc(26, s), sc(30, s), sc(8, s), sc(4.5, s), -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Connecting walkways between domes
  ctx.fillStyle = '#1e2c3a';
  roundRect(ctx, sc(26, s), sc(40, s), sc(6, s), sc(4, s), 0);
  ctx.fill();
  roundRect(ctx, sc(32, s), sc(40, s), sc(6, s), sc(4, s), 0);
  ctx.fill();
  // Walkway railing
  ctx.strokeStyle = '#2a3c50';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.moveTo(sc(26, s), sc(40, s)); ctx.lineTo(sc(38, s), sc(40, s));
  ctx.stroke();

  // Warm habitat window lights — systematic grid on central dome
  const windowGrid = [
    [26, 30], [30, 30], [34, 30], [38, 30],
    [24, 36], [28, 36], [32, 36], [36, 36], [40, 36],
    [26, 42], [30, 42], [34, 42], [38, 42],
  ] as const;
  for (const [wx, wy] of windowGrid) {
    const hash = (wx * 3 + wy * 7) % 4;
    if (hash === 0) continue; // ~25% dark windows
    ctx.fillStyle = accent + 'bb';
    roundRect(ctx, sc(wx, s), sc(wy, s), sc(2.5, s), sc(2.5, s), sc(0.4, s));
    ctx.fill();
  }

  // Small windows on side domes
  for (const [swx, swy] of [[12, 40], [16, 38], [20, 40], [44, 40], [48, 38], [52, 40]] as const) {
    ctx.fillStyle = accent + '99';
    ctx.beginPath();
    ctx.arc(sc(swx, s), sc(swy, s), sc(1.2, s), 0, Math.PI * 2);
    ctx.fill();
  }

  // Warm residential glow
  drawGlow(ctx, sc(32, s), sc(36, s), sc(28, s), accent, 0.18);

  // Antenna/beacon on top of central dome
  ctx.strokeStyle = '#4a6888';
  ctx.lineWidth = sc(1, s);
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(24, s));
  ctx.lineTo(sc(32, s), sc(18, s));
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(18, s), sc(1.5, s), 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, sc(32, s), sc(18, s), sc(6, s), accent, 0.5);
};

// ── Mining Facility ───────────────────────────────────────────────────────────
// Large drill rig descending into ground, rock debris piles, ore carts on
// tracks, industrial yellow/brown colour scheme, structural bracing, deep shaft.

const drawMiningFacility: DrawFn = (ctx, s, accent) => {
  // Deep shaft opening in the ground — dark pit
  const shaftGrad = ctx.createRadialGradient(
    sc(32, s), sc(56, s), sc(2, s),
    sc(32, s), sc(58, s), sc(12, s),
  );
  shaftGrad.addColorStop(0, '#100a04');
  shaftGrad.addColorStop(1, '#1e1408');
  ctx.fillStyle = shaftGrad;
  ctx.beginPath();
  ctx.ellipse(sc(32, s), sc(56, s), sc(10, s), sc(4, s), 0, 0, Math.PI * 2);
  ctx.fill();
  // Shaft rim edge highlight
  ctx.strokeStyle = '#2a1e0e';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.ellipse(sc(32, s), sc(56, s), sc(10, s), sc(4, s), 0, Math.PI, 0);
  ctx.stroke();

  // Rocky ground mound and debris
  ctx.fillStyle = '#2a1e10';
  ctx.beginPath();
  ctx.ellipse(sc(32, s), sc(55, s), sc(28, s), sc(7, s), 0, 0, Math.PI * 2);
  ctx.fill();

  // Ore/rock debris piles either side of rig
  const debrisPiles = [
    { cx: sc(12, s), cy: sc(52, s), rx: sc(8, s), ry: sc(4, s) },
    { cx: sc(52, s), cy: sc(52, s), rx: sc(7, s), ry: sc(3.5, s) },
  ];
  for (const dp of debrisPiles) {
    ctx.fillStyle = '#3a280a';
    ctx.beginPath();
    ctx.ellipse(dp.cx, dp.cy, dp.rx, dp.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ore glints — accent-coloured mineral veins
    ctx.fillStyle = accent + '88';
    ctx.beginPath();
    ctx.ellipse(dp.cx - dp.rx * 0.2, dp.cy - dp.ry * 0.3, dp.rx * 0.25, dp.ry * 0.25, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent + '55';
    ctx.beginPath();
    ctx.ellipse(dp.cx + dp.rx * 0.3, dp.cy - dp.ry * 0.1, dp.rx * 0.18, dp.ry * 0.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, dp.cx, dp.cy, dp.rx * 1.2, accent, 0.15);
  }

  // Rail tracks for ore carts — two parallel lines
  ctx.strokeStyle = '#3a2e18';
  ctx.lineWidth = sc(1, s);
  ctx.beginPath();
  ctx.moveTo(sc(6, s),  sc(54, s));
  ctx.lineTo(sc(26, s), sc(54, s));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sc(6, s),  sc(52, s));
  ctx.lineTo(sc(26, s), sc(52, s));
  ctx.stroke();
  // Rail sleepers (cross-ties)
  ctx.lineWidth = sc(0.75, s);
  ctx.strokeStyle = '#2a1e0e';
  for (let rs = 6; rs <= 26; rs += 4) {
    ctx.beginPath();
    ctx.moveTo(sc(rs, s), sc(51, s));
    ctx.lineTo(sc(rs, s), sc(55, s));
    ctx.stroke();
  }

  // Ore cart on tracks
  ctx.fillStyle = '#4a3820';
  roundRect(ctx, sc(8, s), sc(48, s), sc(10, s), sc(5, s), sc(0.8, s));
  ctx.fill();
  // Cart wheels
  ctx.fillStyle = '#2a2010';
  for (const wx of [sc(10, s), sc(16, s)] as const) {
    ctx.beginPath();
    ctx.arc(wx, sc(53, s), sc(1.5, s), 0, Math.PI * 2);
    ctx.fill();
  }
  // Cart ore contents — glowing mineral
  ctx.fillStyle = accent + '99';
  ctx.beginPath();
  ctx.ellipse(sc(13, s), sc(49, s), sc(3.5, s), sc(1.5, s), 0, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, sc(13, s), sc(49, s), sc(6, s), accent, 0.3);

  // Main drill tower body — central column
  const towerGrad = ctx.createLinearGradient(sc(26, s), 0, sc(38, s), 0);
  towerGrad.addColorStop(0, '#1e1808');
  towerGrad.addColorStop(0.5, '#4a3820');
  towerGrad.addColorStop(1, '#2a2010');
  ctx.fillStyle = towerGrad;
  roundRect(ctx, sc(27, s), sc(18, s), sc(10, s), sc(38, s), sc(1.5, s));
  ctx.fill();

  // Panel lines on drill tower
  drawPanelLines(ctx, s, sc(27, s), sc(18, s), sc(10, s), sc(38, s), 7, 'rgba(80,60,20,0.4)');

  // Structural brace legs (A-frame)
  ctx.strokeStyle = '#5a4820';
  ctx.lineWidth = sc(2.5, s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sc(27, s), sc(44, s));
  ctx.lineTo(sc(12, s), sc(56, s));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sc(37, s), sc(44, s));
  ctx.lineTo(sc(52, s), sc(56, s));
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Cross-brace between legs
  ctx.strokeStyle = '#3a3010';
  ctx.lineWidth = sc(1, s);
  ctx.beginPath();
  ctx.moveTo(sc(16, s), sc(54, s));
  ctx.lineTo(sc(37, s), sc(44, s));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sc(27, s), sc(44, s));
  ctx.lineTo(sc(48, s), sc(54, s));
  ctx.stroke();

  // Drill shaft — steel rod descending into pit
  const drillGrad = ctx.createLinearGradient(sc(30, s), 0, sc(34, s), 0);
  drillGrad.addColorStop(0, '#666660');
  drillGrad.addColorStop(0.5, '#cccccc');
  drillGrad.addColorStop(1, '#888880');
  ctx.fillStyle = drillGrad;
  roundRect(ctx, sc(30, s), sc(54, s), sc(4, s), sc(10, s), sc(0.5, s));
  ctx.fill();

  // Drill bit — spiralled cutting head
  ctx.fillStyle = '#999990';
  ctx.beginPath();
  ctx.moveTo(sc(28, s), sc(60, s));
  ctx.lineTo(sc(36, s), sc(60, s));
  ctx.lineTo(sc(33, s), sc(65, s));
  ctx.lineTo(sc(31, s), sc(65, s));
  ctx.closePath();
  ctx.fill();
  // Drill spiral flutes
  ctx.strokeStyle = '#777770';
  ctx.lineWidth = sc(0.5, s);
  for (let fl = 0; fl < 3; fl++) {
    ctx.beginPath();
    ctx.moveTo(sc(28, s), sc(60 + fl * 1.5, s));
    ctx.lineTo(sc(36, s), sc(61.5 + fl * 1.5, s));
    ctx.stroke();
  }

  drawGlow(ctx, sc(32, s), sc(60, s), sc(8, s), accent, 0.5);

  // Top cab / operator housing
  const cabGrad = ctx.createLinearGradient(sc(22, s), sc(10, s), sc(42, s), sc(10, s));
  cabGrad.addColorStop(0, '#3a2e14');
  cabGrad.addColorStop(0.5, '#5a4828');
  cabGrad.addColorStop(1, '#3a2e14');
  ctx.fillStyle = cabGrad;
  roundRect(ctx, sc(20, s), sc(10, s), sc(24, s), sc(11, s), sc(2, s));
  ctx.fill();

  // Cab windows
  ctx.fillStyle = accent + '66';
  roundRect(ctx, sc(22, s), sc(12, s), sc(7, s), sc(5, s), sc(0.8, s));
  ctx.fill();
  roundRect(ctx, sc(35, s), sc(12, s), sc(7, s), sc(5, s), sc(0.8, s));
  ctx.fill();
  drawGlow(ctx, sc(25, s), sc(14, s), sc(5, s), accent, 0.25);
  drawGlow(ctx, sc(38, s), sc(14, s), sc(5, s), accent, 0.25);

  // Exhaust stack on cab side
  ctx.fillStyle = '#1e1808';
  roundRect(ctx, sc(42, s), sc(5, s), sc(4, s), sc(12, s), sc(1, s));
  ctx.fill();
  drawGlow(ctx, sc(44, s), sc(6, s), sc(5, s), accent, 0.3);
  ctx.fillStyle = accent + '55';
  ctx.beginPath();
  ctx.ellipse(sc(44, s), sc(6, s), sc(2, s), sc(1, s), 0, 0, Math.PI * 2);
  ctx.fill();

  // Cable drum on tower side
  ctx.fillStyle = '#2a2010';
  ctx.beginPath();
  ctx.arc(sc(40, s), sc(28, s), sc(3.5, s), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a3818';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.arc(sc(40, s), sc(28, s), sc(3.5, s), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#555040';
  ctx.beginPath();
  ctx.arc(sc(40, s), sc(28, s), sc(1.5, s), 0, Math.PI * 2);
  ctx.fill();

  // Earthy ground-level glow
  drawGlow(ctx, sc(32, s), sc(52, s), sc(14, s), accent, 0.25);
};

// ── Spaceport ──────────────────────────────────────────────────────────────────
// Landing pad with guidance lights, control tower with antenna, small ship
// silhouette on pad, blast deflector walls, fuel lines running to pad.

const drawSpaceport: DrawFn = (ctx, s, accent) => {
  // Wide ground foundation
  drawGroundPlatform(ctx, s, sc(4, s), sc(56, s), sc(56, s), accent);

  // Blast deflector walls — angled reinforced barriers
  ctx.fillStyle = '#1e2838';
  ctx.beginPath();
  ctx.moveTo(sc(6, s),  sc(56, s));
  ctx.lineTo(sc(6, s),  sc(46, s));
  ctx.lineTo(sc(12, s), sc(42, s));
  ctx.lineTo(sc(12, s), sc(56, s));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sc(52, s), sc(42, s));
  ctx.lineTo(sc(46, s), sc(42, s));
  ctx.lineTo(sc(46, s), sc(56, s));
  ctx.lineTo(sc(52, s), sc(56, s));
  ctx.closePath();
  ctx.fill();
  // Deflector wall panel rivets
  drawRivet(ctx, s, 9, 46);
  drawRivet(ctx, s, 9, 50);
  drawRivet(ctx, s, 9, 54);
  drawRivet(ctx, s, 49, 46);
  drawRivet(ctx, s, 49, 50);
  drawRivet(ctx, s, 49, 54);

  // Landing pad — octagonal platform surface
  const padCx = sc(29, s);
  const padCy = sc(48, s);
  const padR  = sc(18, s);

  ctx.fillStyle = '#1a2434';
  ctx.beginPath();
  for (let vi = 0; vi < 8; vi++) {
    const angle = (vi / 8) * Math.PI * 2 - Math.PI / 8;
    const px = padCx + padR * Math.cos(angle);
    const py = padCy + padR * Math.sin(angle);
    if (vi === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Pad surface markings — concentric guide rings
  ctx.strokeStyle = '#2a3a52';
  ctx.lineWidth = sc(1, s);
  ctx.beginPath();
  ctx.arc(padCx, padCy, sc(12, s), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(padCx, padCy, sc(6,  s), 0, Math.PI * 2);
  ctx.stroke();

  // Cross-hair landing target
  ctx.strokeStyle = '#2e4060';
  ctx.lineWidth = sc(0.75, s);
  ctx.beginPath();
  ctx.moveTo(padCx - sc(16, s), padCy); ctx.lineTo(padCx + sc(16, s), padCy);
  ctx.moveTo(padCx, padCy - sc(16, s)); ctx.lineTo(padCx, padCy + sc(16, s));
  ctx.stroke();

  // Blue guidance lights along pad edge — cardinal points and diagonals
  ctx.save();
  ctx.shadowBlur = sc(5, s);
  ctx.shadowColor = accent;
  const lightAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5,
                       Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const la of lightAngles) {
    const lx = padCx + sc(16, s) * Math.cos(la);
    const ly = padCy + sc(16, s) * Math.sin(la);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(lx, ly, sc(1.2, s), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Approach guidance strips (two rows of dots)
  ctx.save();
  ctx.shadowBlur = sc(4, s);
  ctx.shadowColor = accent;
  ctx.fillStyle = accent;
  for (let gs = 0; gs < 4; gs++) {
    ctx.beginPath();
    ctx.arc(sc(14 + gs * 3, s), sc(34, s), sc(0.8, s), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sc(14 + gs * 3, s), sc(38, s), sc(0.8, s), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Ship silhouette on pad — sleek vessel shape
  const shipGrad = ctx.createLinearGradient(sc(16, s), sc(46, s), sc(16, s), sc(52, s));
  shipGrad.addColorStop(0, '#2e4460');
  shipGrad.addColorStop(1, '#162030');
  ctx.fillStyle = shipGrad;
  ctx.beginPath();
  ctx.ellipse(padCx, padCy - sc(1, s), sc(11, s), sc(3.5, s), 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose cone
  ctx.fillStyle = '#1e3050';
  ctx.beginPath();
  ctx.moveTo(padCx + sc(11, s), padCy - sc(1, s));
  ctx.lineTo(padCx + sc(18, s), padCy - sc(1, s));
  ctx.lineTo(padCx + sc(11, s), padCy + sc(2, s));
  ctx.closePath();
  ctx.fill();
  // Swept wings
  ctx.fillStyle = '#1a2840';
  ctx.beginPath();
  ctx.moveTo(padCx - sc(2, s),  padCy - sc(3, s));
  ctx.lineTo(padCx - sc(12, s), padCy - sc(8, s));
  ctx.lineTo(padCx - sc(14, s), padCy - sc(4, s));
  ctx.lineTo(padCx - sc(4, s),  padCy + sc(1, s));
  ctx.closePath();
  ctx.fill();
  // Engine glow at rear
  drawGlow(ctx, padCx - sc(10, s), padCy - sc(1, s), sc(5, s), accent, 0.35);
  ctx.fillStyle = accent + '88';
  ctx.beginPath();
  ctx.ellipse(padCx - sc(10, s), padCy - sc(1, s), sc(1.5, s), sc(2.5, s), 0, 0, Math.PI * 2);
  ctx.fill();

  // Fuel lines running from edge to pad
  ctx.strokeStyle = '#2a3a50';
  ctx.lineWidth = sc(1.2, s);
  ctx.beginPath();
  ctx.moveTo(sc(12, s), sc(54, s));
  ctx.bezierCurveTo(sc(12, s), sc(48, s), sc(18, s), sc(50, s), padCx - padR + sc(2, s), padCy);
  ctx.stroke();
  // Fuel coupling junction
  ctx.fillStyle = '#3a5070';
  ctx.beginPath();
  ctx.arc(sc(12, s), sc(54, s), sc(1.8, s), 0, Math.PI * 2);
  ctx.fill();

  // Control tower — right side, tall structure
  const towerGrad = ctx.createLinearGradient(sc(50, s), sc(14, s), sc(60, s), sc(14, s));
  towerGrad.addColorStop(0, '#1e2e42');
  towerGrad.addColorStop(1, '#14202e');
  ctx.fillStyle = towerGrad;
  roundRect(ctx, sc(51, s), sc(16, s), sc(11, s), sc(40, s), sc(2, s));
  ctx.fill();

  // Panel lines on control tower
  drawPanelLines(ctx, s, sc(51, s), sc(16, s), sc(11, s), sc(40, s), 7, 'rgba(40,70,110,0.4)');

  // Tower observation deck — wider box near top
  ctx.fillStyle = '#2a3e58';
  roundRect(ctx, sc(49, s), sc(14, s), sc(15, s), sc(10, s), sc(1.5, s));
  ctx.fill();
  // Observation glass wrap — blue tinted
  ctx.fillStyle = accent + '44';
  roundRect(ctx, sc(50, s), sc(15, s), sc(13, s), sc(8, s), sc(1, s));
  ctx.fill();
  drawGlow(ctx, sc(56, s), sc(19, s), sc(8, s), accent, 0.25);

  // Tower antenna mast
  ctx.strokeStyle = '#4a6080';
  ctx.lineWidth = sc(1.2, s);
  ctx.beginPath();
  ctx.moveTo(sc(56, s), sc(14, s));
  ctx.lineTo(sc(56, s), sc(6,  s));
  ctx.stroke();
  // Antenna crosspiece
  ctx.beginPath();
  ctx.moveTo(sc(52, s), sc(9, s));
  ctx.lineTo(sc(60, s), sc(9, s));
  ctx.stroke();

  // Blinking navigation light at antenna tip
  drawGlow(ctx, sc(56, s), sc(6, s), sc(8, s), accent, 0.7);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sc(56, s), sc(6, s), sc(2, s), 0, Math.PI * 2);
  ctx.fill();

  // Pad ambient glow
  drawGlow(ctx, padCx, padCy, sc(20, s), accent, 0.15);
};

// ── Power Plant ──────────────────────────────────────────────────────────────

const drawPowerPlant: DrawFn = (ctx, s) => {
  const accent = ACCENT.power_plant;
  drawGroundPlatform(ctx, s, sc(8, s), sc(40, s), sc(48, s), accent);

  // Main reactor dome
  const cx = sc(32, s);
  const cy = sc(28, s);
  const r = sc(14, s);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#2a3040';
  ctx.fill();
  ctx.strokeStyle = '#556';
  ctx.lineWidth = sc(1, s);
  ctx.stroke();

  // Energy glow inside dome
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.8);
  glow.addColorStop(0, 'rgba(255, 204, 0, 0.4)');
  glow.addColorStop(0.6, 'rgba(255, 150, 0, 0.15)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r, cy - r, r * 2, r);

  // Lightning bolt symbol
  ctx.beginPath();
  ctx.moveTo(sc(30, s), sc(20, s));
  ctx.lineTo(sc(34, s), sc(26, s));
  ctx.lineTo(sc(31, s), sc(26, s));
  ctx.lineTo(sc(34, s), sc(34, s));
  ctx.lineTo(sc(30, s), sc(27, s));
  ctx.lineTo(sc(33, s), sc(27, s));
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();

  // Power conduit lines
  ctx.strokeStyle = accent;
  ctx.lineWidth = sc(1.5, s);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(sc(18, s), sc(38, s));
  ctx.lineTo(sc(18, s), sc(28, s));
  ctx.moveTo(sc(46, s), sc(38, s));
  ctx.lineTo(sc(46, s), sc(28, s));
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Pylons on sides
  ctx.fillStyle = '#3a4050';
  ctx.fillRect(sc(15, s), sc(24, s), sc(6, s), sc(16, s));
  ctx.fillRect(sc(43, s), sc(24, s), sc(6, s), sc(16, s));

  // Pylon glow dots
  drawGlow(ctx, sc(18, s), sc(28, s), sc(3, s), accent, 0.3);
  drawGlow(ctx, sc(46, s), sc(28, s), sc(3, s), accent, 0.3);
};

// ── Dispatch table ────────────────────────────────────────────────────────────

const DRAW_FNS: Record<BuildingType, DrawFn> = {
  research_lab:      drawResearchLab,
  factory:           drawFactory,
  shipyard:          drawShipyard,
  trade_hub:         drawTradeHub,
  defense_grid:      drawDefenceGrid,
  population_center: drawPopulationCentre,
  mining_facility:   drawMiningFacility,
  spaceport:         drawSpaceport,
  power_plant:       drawPowerPlant,
};

// ── Roman numeral level badge ─────────────────────────────────────────────────

const ROMAN_NUMERALS: ReadonlyArray<string> = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
];

function toRoman(level: number): string {
  return (
    ROMAN_NUMERALS[Math.max(0, Math.min(level - 1, ROMAN_NUMERALS.length - 1))] ??
    String(level)
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renders a building icon for the given type at the requested pixel size.
 * Returns a PNG data URL. Results are cached by type + size.
 *
 * @param buildingType - One of the eight BuildingType values.
 * @param size         - Desired width/height in pixels (the icon is square).
 */
export function renderBuildingIcon(buildingType: BuildingType, size: number): string {
  const key    = cacheKey(buildingType, size);
  const cached = iconCache.get(key);
  if (cached !== undefined) return cached;

  const canvas = makeCanvas(size);
  const ctx    = canvas.getContext('2d');
  if (ctx === null) throw new Error('BuildingGraphics: could not obtain 2D context');

  const accent = ACCENT[buildingType];
  drawBackground(ctx, size);
  DRAW_FNS[buildingType](ctx, size, accent);

  const url = canvas.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}

/**
 * Renders a building icon with a level badge (I, II, III …) overlaid in the
 * bottom-right corner, on an accent-coloured pill background.
 * Results are cached by type + level + size.
 *
 * @param buildingType - One of the eight BuildingType values.
 * @param level        - Building level (1-based integer).
 * @param size         - Desired width/height in pixels.
 */
export function renderBuildingSlotIcon(
  buildingType: BuildingType,
  level: number,
  size: number,
): string {
  const key    = slotCacheKey(buildingType, level, size);
  const cached = iconCache.get(key);
  if (cached !== undefined) return cached;

  // Composite the level badge on top of the base icon.
  // The base is already cached as a data URL; new Image() with a data URL
  // resolves synchronously in browser environments.
  const base   = renderBuildingIcon(buildingType, size);
  const canvas = makeCanvas(size);
  const ctx    = canvas.getContext('2d');
  if (ctx === null) throw new Error('BuildingGraphics: could not obtain 2D context');

  const img = new Image();
  img.src = base;
  ctx.drawImage(img, 0, 0, size, size);

  // ── Badge geometry ─────────────────────────────────────────────────────────
  const accent    = ACCENT[buildingType];
  const badge     = toRoman(level);
  const badgeSize = Math.max(12, Math.round(size * 0.30));
  const badgeX    = size - badgeSize - 1;
  const badgeY    = size - badgeSize - 1;
  const badgeR    = Math.max(2, Math.round(badgeSize * 0.28));

  // Badge background — semi-transparent dark pill
  ctx.fillStyle = '#0a0e18ee';
  roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeR);
  ctx.fill();

  // Accent-coloured fill tint behind numeral
  ctx.fillStyle = accent + '22';
  roundRect(ctx, badgeX + 1, badgeY + 1, badgeSize - 2, badgeSize - 2, badgeR);
  ctx.fill();

  // Badge border
  ctx.strokeStyle = accent;
  ctx.lineWidth   = Math.max(1, Math.round(size * 0.028));
  roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeR);
  ctx.stroke();

  // Subtle glow behind badge
  ctx.save();
  ctx.shadowBlur  = Math.round(size * 0.12);
  ctx.shadowColor = accent;
  roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeR);
  ctx.strokeStyle = accent + '55';
  ctx.lineWidth   = Math.max(1, Math.round(size * 0.02));
  ctx.stroke();
  ctx.restore();

  // Roman numeral text
  const fontSize = Math.max(7, Math.round(badgeSize * 0.54));
  ctx.fillStyle     = accent;
  ctx.font          = `bold ${fontSize}px monospace`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(badge, badgeX + badgeSize / 2, badgeY + badgeSize / 2);

  const url = canvas.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}

/**
 * Clears the entire icon cache.
 * Useful after a canvas context loss event or during hot-module replacement.
 */
export function clearBuildingIconCache(): void {
  iconCache.clear();
}
