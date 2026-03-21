/**
 * BuildingGraphics.ts
 *
 * Canvas 2D renderer for building icons used in the planet management screen.
 * Each icon is 64×64 (canonical size) and is cached by type + requested size.
 * Returns a PNG data URL suitable for use in <img src> or Phaser textures.
 *
 * Icon style: isometric-inspired sci-fi, dark background, type-specific accent
 * colour with subtle glow, readable down to 32 px.
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
};

// ── Canvas helpers ────────────────────────────────────────────────────────────

function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/**
 * Draws a filled (or stroked) rounded rectangle path.
 * Caller must call ctx.fill() / ctx.stroke() afterwards.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Applies a soft radial glow centred on (cx, cy).
 */
function drawGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  colour: string,
  alpha: number,
): void {
  const alphaHex = Math.round(Math.min(1, alpha) * 255)
    .toString(16)
    .padStart(2, '0');
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, colour + alphaHex);
  grad.addColorStop(1, colour + '00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the shared dark background panel with a subtle vignette.
 */
function drawBackground(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.clearRect(0, 0, size, size);

  // Deep space background
  ctx.fillStyle = '#080c14';
  roundRect(ctx, 0, 0, size, size, size * 0.12);
  ctx.fill();

  // Subtle vignette
  const vig = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.25,
    size / 2, size / 2, size * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  roundRect(ctx, 0, 0, size, size, size * 0.12);
  ctx.fillStyle = vig;
  ctx.fill();
}

// ── Per-building draw functions ───────────────────────────────────────────────
// All coordinates are expressed in the canonical 64-px space and scaled to `s`.

type DrawFn = (ctx: CanvasRenderingContext2D, s: number, accent: string) => void;

/** Scale a canonical 64-px coordinate to the requested canvas size. */
function sc(v: number, s: number): number {
  return (v / 64) * s;
}

// ── Research Lab ──────────────────────────────────────────────────────────────

const drawResearchLab: DrawFn = (ctx, s, accent) => {
  // Base slab
  ctx.fillStyle = '#2a3550';
  roundRect(ctx, sc(12, s), sc(42, s), sc(40, s), sc(10, s), sc(3, s));
  ctx.fill();

  // Dome body
  const domeGrad = ctx.createRadialGradient(
    sc(32, s), sc(30, s), sc(2, s),
    sc(32, s), sc(28, s), sc(18, s),
  );
  domeGrad.addColorStop(0, '#4a6a9a');
  domeGrad.addColorStop(1, '#1e2e48');
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.ellipse(sc(32, s), sc(42, s), sc(18, s), sc(14, s), 0, Math.PI, 0);
  ctx.fill();

  // Dome glass highlight
  ctx.fillStyle = 'rgba(160,210,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(sc(27, s), sc(34, s), sc(7, s), sc(4, s), -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Central antenna mast
  ctx.strokeStyle = '#8aaccc';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(42, s));
  ctx.lineTo(sc(32, s), sc(16, s));
  ctx.stroke();

  // Antenna crossbar
  ctx.beginPath();
  ctx.moveTo(sc(24, s), sc(22, s));
  ctx.lineTo(sc(40, s), sc(22, s));
  ctx.stroke();

  // Satellite dish arc
  ctx.strokeStyle = accent;
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(16, s), sc(6, s), Math.PI * 0.65, Math.PI * 2.35);
  ctx.stroke();

  // Dish glow
  drawGlow(ctx, sc(32, s), sc(16, s), sc(11, s), accent, 0.55);

  // Accent portholes on dome
  ctx.fillStyle = accent;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(sc(21 + i * 6, s), sc(42, s), sc(1.5, s), 0, Math.PI * 2);
    ctx.fill();
  }
};

// ── Factory ───────────────────────────────────────────────────────────────────

const drawFactory: DrawFn = (ctx, s, accent) => {
  // Main block
  ctx.fillStyle = '#3a3020';
  roundRect(ctx, sc(10, s), sc(30, s), sc(44, s), sc(24, s), sc(2, s));
  ctx.fill();

  // Lower wall shading
  ctx.fillStyle = '#282018';
  roundRect(ctx, sc(10, s), sc(40, s), sc(44, s), sc(14, s), sc(2, s));
  ctx.fill();

  // Roof plate
  ctx.fillStyle = '#4a4030';
  roundRect(ctx, sc(8, s), sc(27, s), sc(48, s), sc(6, s), sc(2, s));
  ctx.fill();

  // Three smokestacks
  const stacksX = [sc(18, s), sc(30, s), sc(42, s)];
  stacksX.forEach((x) => {
    ctx.fillStyle = '#2a2018';
    roundRect(ctx, x - sc(3.5, s), sc(10, s), sc(7, s), sc(19, s), sc(1.5, s));
    ctx.fill();
    // Stack rim
    ctx.fillStyle = '#3e3020';
    roundRect(ctx, x - sc(4.5, s), sc(10, s), sc(9, s), sc(3, s), sc(1, s));
    ctx.fill();
    // Exhaust glow
    drawGlow(ctx, x, sc(11, s), sc(8, s), accent, 0.38);
    ctx.fillStyle = accent + '88';
    ctx.beginPath();
    ctx.ellipse(x, sc(11, s), sc(3.5, s), sc(1.5, s), 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Conveyor belt lines on front face
  ctx.strokeStyle = '#5a4830';
  ctx.lineWidth = sc(1, s);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(sc(12, s), sc(34 + i * 4, s));
    ctx.lineTo(sc(52, s), sc(34 + i * 4, s));
    ctx.stroke();
  }

  // Accent panel
  ctx.fillStyle = accent;
  roundRect(ctx, sc(14, s), sc(44, s), sc(8, s), sc(4, s), sc(1, s));
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, sc(14, s), sc(44, s), sc(8, s), sc(2, s), sc(1, s));
  ctx.fill();
};

// ── Shipyard ──────────────────────────────────────────────────────────────────

const drawShipyard: DrawFn = (ctx, s, accent) => {
  // Outer dock frame — struts
  ctx.strokeStyle = '#446688';
  ctx.lineWidth = sc(2.5, s);

  ctx.beginPath();
  ctx.moveTo(sc(10, s), sc(8, s));
  ctx.lineTo(sc(10, s), sc(56, s));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(sc(54, s), sc(8, s));
  ctx.lineTo(sc(54, s), sc(56, s));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(sc(10, s), sc(8, s));
  ctx.lineTo(sc(54, s), sc(8, s));
  ctx.stroke();

  // Cross-braces
  ctx.lineWidth = sc(1, s);
  ctx.strokeStyle = '#335577';
  ctx.beginPath();
  ctx.moveTo(sc(10, s), sc(8, s));
  ctx.lineTo(sc(32, s), sc(20, s));
  ctx.moveTo(sc(54, s), sc(8, s));
  ctx.lineTo(sc(32, s), sc(20, s));
  ctx.stroke();

  // Horizontal scaffolding rungs
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(sc(10, s), sc(20 + i * 10, s));
    ctx.lineTo(sc(54, s), sc(20 + i * 10, s));
    ctx.stroke();
  }

  // Ship hull under construction
  ctx.fillStyle = '#1e3040';
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(28, s));
  ctx.lineTo(sc(50, s), sc(46, s));
  ctx.lineTo(sc(14, s), sc(46, s));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#253850';
  roundRect(ctx, sc(26, s), sc(38, s), sc(12, s), sc(8, s), sc(1, s));
  ctx.fill();

  // Construction laser beams
  ctx.save();
  ctx.shadowBlur = sc(6, s);
  ctx.shadowColor = accent;
  ctx.strokeStyle = accent;
  ctx.lineWidth = sc(1, s);
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(sc(10, s), sc(8, s));
  ctx.lineTo(sc(32, s), sc(46, s));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sc(54, s), sc(8, s));
  ctx.lineTo(sc(32, s), sc(46, s));
  ctx.stroke();
  ctx.restore();

  // Glow at beam intersections
  drawGlow(ctx, sc(10, s), sc(8, s), sc(8, s), accent, 0.6);
  drawGlow(ctx, sc(54, s), sc(8, s), sc(8, s), accent, 0.6);
  drawGlow(ctx, sc(32, s), sc(46, s), sc(10, s), accent, 0.45);

  // Dock base
  ctx.fillStyle = '#2a3a50';
  roundRect(ctx, sc(8, s), sc(54, s), sc(48, s), sc(5, s), sc(1.5, s));
  ctx.fill();
};

// ── Trade Hub ─────────────────────────────────────────────────────────────────

const drawTradeHub: DrawFn = (ctx, s, accent) => {
  // Side wings
  ctx.fillStyle = '#162218';
  roundRect(ctx, sc(8, s), sc(30, s), sc(14, s), sc(26, s), sc(2, s));
  ctx.fill();
  roundRect(ctx, sc(42, s), sc(30, s), sc(14, s), sc(26, s), sc(2, s));
  ctx.fill();

  // Main central tower
  ctx.fillStyle = '#1e3028';
  roundRect(ctx, sc(22, s), sc(12, s), sc(20, s), sc(44, s), sc(2, s));
  ctx.fill();

  // Rooftop spire
  ctx.strokeStyle = '#446655';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(12, s));
  ctx.lineTo(sc(32, s), sc(4, s));
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(4, s), sc(2, s), 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, sc(32, s), sc(4, s), sc(9, s), accent, 0.55);

  // Walkways connecting tower to wings
  ctx.fillStyle = '#2a4030';
  roundRect(ctx, sc(22, s) - sc(14, s), sc(36, s), sc(14, s), sc(3, s), 0);
  ctx.fill();
  roundRect(ctx, sc(42, s), sc(36, s), sc(14, s), sc(3, s), 0);
  ctx.fill();

  // Window lights on main tower (2 columns × 4 rows)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = accent + 'bb';
      roundRect(ctx, sc(25 + col * 9, s), sc(16 + row * 8, s), sc(4, s), sc(4, s), sc(0.5, s));
      ctx.fill();
    }
  }

  // Cargo containers at base
  const containerColours = ['#334422', '#443322', '#224433', '#332244'];
  containerColours.forEach((c, i) => {
    ctx.fillStyle = c;
    roundRect(ctx, sc(8 + i * 12, s), sc(54, s), sc(10, s), sc(6, s), sc(1, s));
    ctx.fill();
  });

  // Ambient commerce glow
  drawGlow(ctx, sc(32, s), sc(32, s), sc(18, s), accent, 0.18);
};

// ── Defence Grid ──────────────────────────────────────────────────────────────

const drawDefenceGrid: DrawFn = (ctx, s, accent) => {
  // Bunker base — angular fortified silhouette
  ctx.fillStyle = '#2a2020';
  ctx.beginPath();
  ctx.moveTo(sc(8, s),  sc(58, s));
  ctx.lineTo(sc(8, s),  sc(38, s));
  ctx.lineTo(sc(18, s), sc(30, s));
  ctx.lineTo(sc(46, s), sc(30, s));
  ctx.lineTo(sc(56, s), sc(38, s));
  ctx.lineTo(sc(56, s), sc(58, s));
  ctx.closePath();
  ctx.fill();

  // Front armour plating
  ctx.fillStyle = '#3a2828';
  ctx.beginPath();
  ctx.moveTo(sc(12, s), sc(58, s));
  ctx.lineTo(sc(12, s), sc(42, s));
  ctx.lineTo(sc(20, s), sc(36, s));
  ctx.lineTo(sc(44, s), sc(36, s));
  ctx.lineTo(sc(52, s), sc(42, s));
  ctx.lineTo(sc(52, s), sc(58, s));
  ctx.closePath();
  ctx.fill();

  // Radar dish mast
  ctx.strokeStyle = '#665050';
  ctx.lineWidth = sc(1.5, s);
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(30, s));
  ctx.lineTo(sc(32, s), sc(18, s));
  ctx.stroke();

  // Dish arc
  ctx.strokeStyle = '#887070';
  ctx.lineWidth = sc(2, s);
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(18, s), sc(8, s), Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  ctx.fillStyle = '#aaaaaa';
  ctx.beginPath();
  ctx.arc(sc(32, s), sc(18, s), sc(2, s), 0, Math.PI * 2);
  ctx.fill();

  // Missile turrets (left and right)
  const turretX = [sc(16, s), sc(48, s)];
  turretX.forEach((tx) => {
    ctx.fillStyle = '#442222';
    roundRect(ctx, tx - sc(4, s), sc(28, s), sc(8, s), sc(6, s), sc(1, s));
    ctx.fill();
    ctx.strokeStyle = '#664444';
    ctx.lineWidth = sc(2, s);
    ctx.beginPath();
    ctx.moveTo(tx, sc(28, s));
    ctx.lineTo(tx, sc(12, s));
    ctx.stroke();
    drawGlow(ctx, tx, sc(12, s), sc(7, s), accent, 0.55);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(tx, sc(12, s), sc(2, s), 0, Math.PI * 2);
    ctx.fill();
  });

  // Central targeting laser
  ctx.save();
  ctx.shadowBlur = sc(5, s);
  ctx.shadowColor = accent;
  ctx.strokeStyle = accent;
  ctx.lineWidth = sc(1, s);
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(sc(32, s), sc(18, s));
  ctx.lineTo(sc(52, s), sc(4, s));
  ctx.stroke();
  ctx.restore();

  drawGlow(ctx, sc(32, s), sc(18, s), sc(12, s), accent, 0.35);

  // Armour bolt rivets
  ctx.fillStyle = '#554040';
  [[20, 46], [32, 46], [44, 46], [20, 54], [44, 54]].forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(sc(bx, s), sc(by, s), sc(1.5, s), 0, Math.PI * 2);
    ctx.fill();
  });
};

// ── Population Centre ─────────────────────────────────────────────────────────

const drawPopulationCentre: DrawFn = (ctx, s, accent) => {
  // Three habitat towers at different heights
  // [x, y, width, height]
  const towers: [number, number, number, number][] = [
    [sc(8,  s), sc(28, s), sc(14, s), sc(28, s)],
    [sc(25, s), sc(16, s), sc(14, s), sc(40, s)],
    [sc(42, s), sc(22, s), sc(14, s), sc(34, s)],
  ];

  const towerColours = ['#1e2838', '#1a2230', '#1c2534'] as const;

  towers.forEach(([tx, ty, tw, th], i) => {
    ctx.fillStyle = towerColours[i]!;
    roundRect(ctx, tx, ty, tw, th, sc(2, s));
    ctx.fill();
    // Rooftop band
    ctx.fillStyle = '#2a3a50';
    roundRect(ctx, tx - sc(1, s), ty - sc(2, s), tw + sc(2, s), sc(4, s), sc(1, s));
    ctx.fill();
  });

  // Habitat dome on central tower
  ctx.fillStyle = '#243050';
  ctx.beginPath();
  ctx.ellipse(sc(32, s), sc(16, s), sc(8, s), sc(6, s), 0, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = 'rgba(150,200,255,0.14)';
  ctx.beginPath();
  ctx.ellipse(sc(29, s), sc(13, s), sc(3, s), sc(2, s), -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Window lights — warm yellow, semi-random but stable at 64 px
  towers.forEach(([tx, ty, tw, th]) => {
    const cols = Math.max(1, Math.floor(tw / sc(5, s)));
    const rows = Math.max(1, Math.floor(th / sc(7, s)));
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Stable "random" using position hash
        const hash = (r * 7 + c * 3 + Math.round(tx) * 11) % 4;
        if (hash === 0) continue; // ~25% dark
        ctx.fillStyle = accent + 'cc';
        roundRect(ctx, tx + sc(2, s) + c * sc(5, s), ty + r * sc(6.5, s), sc(3, s), sc(3, s), sc(0.5, s));
        ctx.fill();
      }
    }
  });

  // Warm ambient glow
  drawGlow(ctx, sc(32, s), sc(40, s), sc(26, s), accent, 0.15);

  // Ground base
  ctx.fillStyle = '#1a2030';
  roundRect(ctx, sc(6, s), sc(55, s), sc(52, s), sc(4, s), sc(1, s));
  ctx.fill();
};

// ── Mining Facility ───────────────────────────────────────────────────────────

const drawMiningFacility: DrawFn = (ctx, s, accent) => {
  // Rocky ground mound
  ctx.fillStyle = '#2a1e10';
  ctx.beginPath();
  ctx.ellipse(sc(32, s), sc(54, s), sc(26, s), sc(8, s), 0, 0, Math.PI * 2);
  ctx.fill();

  // Mineral/ore piles
  [sc(14, s), sc(50, s)].forEach((px, i) => {
    const pr = i === 0 ? sc(8, s) : sc(7, s);
    ctx.fillStyle = '#3a280a';
    ctx.beginPath();
    ctx.ellipse(px, sc(52, s), pr, pr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ore glints
    ctx.fillStyle = accent + '99';
    ctx.beginPath();
    ctx.arc(px - pr * 0.2, sc(52, s) - pr * 0.2, pr * 0.22, 0, Math.PI * 2);
    ctx.fill();
  });

  // Main drill tower body
  ctx.fillStyle = '#3a3020';
  roundRect(ctx, sc(26, s), sc(20, s), sc(12, s), sc(34, s), sc(2, s));
  ctx.fill();

  // Brace legs
  ctx.strokeStyle = '#555030';
  ctx.lineWidth = sc(2, s);
  ctx.beginPath();
  ctx.moveTo(sc(26, s), sc(44, s));
  ctx.lineTo(sc(14, s), sc(54, s));
  ctx.moveTo(sc(38, s), sc(44, s));
  ctx.lineTo(sc(50, s), sc(54, s));
  ctx.stroke();

  // Drill bit
  ctx.fillStyle = '#888880';
  ctx.beginPath();
  ctx.moveTo(sc(29, s), sc(54, s));
  ctx.lineTo(sc(35, s), sc(54, s));
  ctx.lineTo(sc(32, s), sc(62, s));
  ctx.closePath();
  ctx.fill();

  // Drill shaft highlight
  ctx.strokeStyle = '#aaaaaa';
  ctx.lineWidth = sc(1, s);
  ctx.beginPath();
  ctx.moveTo(sc(31, s), sc(20, s));
  ctx.lineTo(sc(31, s), sc(54, s));
  ctx.stroke();

  // Top cab
  ctx.fillStyle = '#4a3a20';
  roundRect(ctx, sc(22, s), sc(13, s), sc(20, s), sc(10, s), sc(2, s));
  ctx.fill();

  // Exhaust pipe on cab
  ctx.fillStyle = '#2a2010';
  roundRect(ctx, sc(40, s), sc(8, s), sc(4, s), sc(10, s), sc(1, s));
  ctx.fill();

  // Earthy metallic glow at drill point and exhaust
  drawGlow(ctx, sc(32, s), sc(54, s), sc(14, s), accent, 0.45);
  drawGlow(ctx, sc(42, s), sc(10, s), sc(6, s), accent, 0.35);
};

// ── Spaceport ─────────────────────────────────────────────────────────────────

const drawSpaceport: DrawFn = (ctx, s, accent) => {
  const padCx = sc(28, s);
  const padCy = sc(48, s);
  const padR  = sc(20, s);

  // Landing pad — octagonal platform
  ctx.fillStyle = '#1e2838';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
    const px = padCx + padR * Math.cos(angle);
    const py = padCy + padR * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Concentric guide rings
  ctx.strokeStyle = '#2a3a52';
  ctx.lineWidth = sc(1, s);
  [sc(13, s), sc(7, s)].forEach((r) => {
    ctx.beginPath();
    ctx.arc(padCx, padCy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Runway lighting strips
  ctx.save();
  ctx.shadowBlur = sc(4, s);
  ctx.shadowColor = accent;
  ctx.strokeStyle = accent;
  ctx.lineWidth = sc(1.5, s);
  [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((angle) => {
    const x1 = padCx + sc(7, s) * Math.cos(angle);
    const y1 = padCy + sc(7, s) * Math.sin(angle);
    const x2 = padCx + sc(18, s) * Math.cos(angle);
    const y2 = padCy + sc(18, s) * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  ctx.restore();

  // Ship silhouette on pad
  ctx.fillStyle = '#263848';
  ctx.beginPath();
  ctx.ellipse(padCx, padCy, sc(10, s), sc(4, s), 0, 0, Math.PI * 2);
  ctx.fill();
  // Cockpit/nose
  ctx.fillStyle = '#1e3050';
  ctx.beginPath();
  ctx.moveTo(padCx, padCy - sc(4, s));
  ctx.lineTo(padCx + sc(12, s), padCy);
  ctx.lineTo(padCx, padCy + sc(4, s));
  ctx.closePath();
  ctx.fill();
  // Wing
  ctx.fillStyle = '#1a2838';
  ctx.beginPath();
  ctx.moveTo(padCx - sc(2, s), padCy - sc(2, s));
  ctx.lineTo(padCx - sc(12, s), padCy - sc(6, s));
  ctx.lineTo(padCx - sc(12, s), padCy + sc(6, s));
  ctx.lineTo(padCx - sc(2, s), padCy + sc(2, s));
  ctx.closePath();
  ctx.fill();

  // Control tower (right side)
  ctx.fillStyle = '#2a3848';
  roundRect(ctx, sc(50, s), sc(18, s), sc(10, s), sc(30, s), sc(2, s));
  ctx.fill();
  // Tower glass
  ctx.fillStyle = accent + '55';
  roundRect(ctx, sc(51, s), sc(20, s), sc(8, s), sc(8, s), sc(1, s));
  ctx.fill();

  // Tower blinking light
  drawGlow(ctx, sc(55, s), sc(16, s), sc(7, s), accent, 0.6);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sc(55, s), sc(16, s), sc(2, s), 0, Math.PI * 2);
  ctx.fill();

  // Pad ambient glow
  drawGlow(ctx, padCx, padCy, sc(18, s), accent, 0.18);
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
};

// ── Roman numeral badge labels ────────────────────────────────────────────────

const ROMAN_NUMERALS: ReadonlyArray<string> = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
];

function toRoman(level: number): string {
  return ROMAN_NUMERALS[Math.max(0, Math.min(level - 1, ROMAN_NUMERALS.length - 1))] ?? String(level);
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
  const key = cacheKey(buildingType, size);
  const cached = iconCache.get(key);
  if (cached !== undefined) return cached;

  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
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
 * bottom-right corner. Results are cached by type + level + size.
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
  const key = slotCacheKey(buildingType, level, size);
  const cached = iconCache.get(key);
  if (cached !== undefined) return cached;

  // Composite on top of the base icon. The base is already cached as a data URL
  // and `new Image()` with a data URL is synchronous in browsers.
  const base = renderBuildingIcon(buildingType, size);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('BuildingGraphics: could not obtain 2D context');

  const img = new Image();
  img.src = base;
  ctx.drawImage(img, 0, 0, size, size);

  // Badge geometry
  const accent    = ACCENT[buildingType];
  const badge     = toRoman(level);
  const badgeSize = Math.max(12, Math.round(size * 0.28));
  const badgeX    = size - badgeSize - 1;
  const badgeY    = size - badgeSize - 1;
  const badgeR    = Math.max(2, Math.round(badgeSize * 0.25));

  // Badge background pill
  ctx.fillStyle = '#0a0e18ee';
  roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeR);
  ctx.fill();

  // Badge border
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, Math.round(size * 0.025));
  roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeR);
  ctx.stroke();

  // Badge numeral
  const fontSize = Math.max(7, Math.round(badgeSize * 0.52));
  ctx.fillStyle = accent;
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
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
