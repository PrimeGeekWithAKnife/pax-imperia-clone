import { withAlpha } from '../shipWireframeHelpers';

function teranosFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#6a7a8a');  // lighter bow
  grad.addColorStop(0.4, '#4a5a6a');  // mid-hull
  grad.addColorStop(1,   '#2e3a46');  // darker stern
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Teranos engine glow: blue-white operational exhaust. */
function teranosEngineGlow(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(140,180,255,0.6)');
  bloom.addColorStop(0.5, 'rgba(60,100,200,0.25)');
  bloom.addColorStop(1,   'rgba(20,40,120,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(220,235,255,1)');
  core.addColorStop(0.4, 'rgba(120,165,255,0.85)');
  core.addColorStop(1,   'rgba(40,70,180,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Teranos viewport -- horizontal slit with warm interior light. */
function teranosViewport(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0,   'rgba(140,180,240,0.6)');
  g.addColorStop(0.5, 'rgba(180,210,255,0.8)');
  g.addColorStop(1,   'rgba(140,180,240,0.6)');
  ctx.fillStyle = g;
  ctx.fill();
}

/** Hexagonal turret mount -- the standardised Teranos weapon platform. */
function teranosTurret(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string,
): void {
  // Hex base
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.35);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.003;
  ctx.stroke();
  // Barrel dot (centre)
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,50,60,0.8)';
  ctx.fill();
}

/** Hull seam line -- the visible "refit line" that gives Teranos ships history. */
function teranosSeam(
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Highlight below the seam (simulates overlapping plate edge catching light)
  ctx.beginPath();
  ctx.moveTo(x1, y1 + 0.005);
  ctx.lineTo(x2, y2 + 0.005);
  ctx.strokeStyle = 'rgba(160,180,200,0.15)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
}


// ── Ship wireframe functions ─────────────────────────────────────────────────

/**
 * SCOUT -- Compact stub-nosed interceptor. All engine and cockpit.
 * Small chin sensor, twin engines, minimal extras. Fast and disposable.
 */
export function teranosScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull -- compact tapered body
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);   // nose tip
  ctx.lineTo(0.42, 0.18);   // upper hull taper
  ctx.lineTo(0.38, 0.40);
  ctx.lineTo(0.36, 0.68);
  ctx.lineTo(0.38, 0.78);   // engine block widens
  ctx.lineTo(0.62, 0.78);
  ctx.lineTo(0.64, 0.68);
  ctx.lineTo(0.62, 0.40);
  ctx.lineTo(0.58, 0.18);
  ctx.closePath();
  teranosFill(ctx, accent);

  // Chin sensor -- small protrusion below nose
  ctx.beginPath();
  ctx.moveTo(0.46, 0.16);
  ctx.lineTo(0.44, 0.08);   // chin juts forward (up in 2D)
  ctx.lineTo(0.48, 0.06);
  ctx.lineTo(0.52, 0.06);
  ctx.lineTo(0.56, 0.08);
  ctx.lineTo(0.54, 0.16);
  ctx.closePath();
  ctx.fillStyle = '#3a4a5a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Seam lines
  teranosSeam(ctx, 0.39, 0.42, 0.61, 0.42);
  teranosSeam(ctx, 0.37, 0.60, 0.63, 0.60);

  // Viewport
  teranosViewport(ctx, 0.45, 0.20, 0.10, 0.015);

  // Engines -- twin bells
  teranosEngineGlow(ctx, 0.44, 0.80, 0.028);
  teranosEngineGlow(ctx, 0.56, 0.80, 0.028);
}


/**
 * DESTROYER -- The workhorse. Side modules bolted on, first turret mounts
 * visible, wider stern. Bulldog chin is more pronounced.
 */
export function teranosDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.lineTo(0.40, 0.16);
  ctx.lineTo(0.34, 0.34);
  ctx.lineTo(0.32, 0.60);
  ctx.lineTo(0.30, 0.74);   // stern widens
  ctx.lineTo(0.28, 0.80);
  ctx.lineTo(0.72, 0.80);
  ctx.lineTo(0.70, 0.74);
  ctx.lineTo(0.68, 0.60);
  ctx.lineTo(0.66, 0.34);
  ctx.lineTo(0.60, 0.16);
  ctx.closePath();
  teranosFill(ctx, accent);

  // Chin assembly -- larger, more aggressive
  ctx.beginPath();
  ctx.moveTo(0.44, 0.14);
  ctx.lineTo(0.42, 0.07);
  ctx.lineTo(0.47, 0.04);
  ctx.lineTo(0.53, 0.04);
  ctx.lineTo(0.58, 0.07);
  ctx.lineTo(0.56, 0.14);
  ctx.closePath();
  ctx.fillStyle = '#3a4a5a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Side module blisters (asymmetric)
  // Starboard (right) -- rectangular pod
  ctx.beginPath();
  ctx.rect(0.66, 0.38, 0.10, 0.16);
  ctx.fillStyle = '#4a5a6a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Port (left) -- slightly different shape
  ctx.beginPath();
  ctx.rect(0.24, 0.36, 0.09, 0.20);
  ctx.fillStyle = '#4a5a6a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Seam lines
  teranosSeam(ctx, 0.34, 0.36, 0.66, 0.36);
  teranosSeam(ctx, 0.32, 0.52, 0.68, 0.52);
  teranosSeam(ctx, 0.31, 0.68, 0.69, 0.68);

  // Turret mounts
  teranosTurret(ctx, 0.42, 0.30, 0.025, accent);
  teranosTurret(ctx, 0.58, 0.30, 0.025, accent);

  // Viewport
  teranosViewport(ctx, 0.44, 0.12, 0.12, 0.015);

  // Engines -- three bells across the broad stern
  teranosEngineGlow(ctx, 0.38, 0.82, 0.026);
  teranosEngineGlow(ctx, 0.50, 0.83, 0.030);
  teranosEngineGlow(ctx, 0.62, 0.82, 0.026);
}


/**
 * TRANSPORT -- Wide, boxy cargo hauler. Visible cargo bay seam lines,
 * minimal weapons, prominent engine block. The pragmatic Teranos at
 * their most utilitarian.
 */
export function teranosTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull -- wider, boxier
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.38, 0.16);
  ctx.lineTo(0.28, 0.26);
  ctx.lineTo(0.26, 0.68);
  ctx.lineTo(0.28, 0.78);
  ctx.lineTo(0.72, 0.78);
  ctx.lineTo(0.74, 0.68);
  ctx.lineTo(0.72, 0.26);
  ctx.lineTo(0.62, 0.16);
  ctx.closePath();
  teranosFill(ctx, accent);

  // Chin sensor (small -- transports don't need much)
  ctx.beginPath();
  ctx.moveTo(0.46, 0.14);
  ctx.lineTo(0.45, 0.10);
  ctx.lineTo(0.50, 0.08);
  ctx.lineTo(0.55, 0.10);
  ctx.lineTo(0.54, 0.14);
  ctx.closePath();
  ctx.fillStyle = '#3a4a5a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Cargo bay seam lines -- horizontal divisions showing modular bays
  teranosSeam(ctx, 0.28, 0.30, 0.72, 0.30);
  teranosSeam(ctx, 0.27, 0.42, 0.73, 0.42);
  teranosSeam(ctx, 0.27, 0.54, 0.73, 0.54);
  teranosSeam(ctx, 0.27, 0.66, 0.73, 0.66);

  // Vertical cargo bay dividers
  ctx.beginPath();
  ctx.moveTo(0.50, 0.30); ctx.lineTo(0.50, 0.66);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Cargo bay accent (one bay highlighted -- partially loaded)
  ctx.beginPath();
  ctx.rect(0.29, 0.43, 0.20, 0.10);
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();

  // Viewport
  teranosViewport(ctx, 0.42, 0.18, 0.16, 0.015);

  // Engines
  teranosEngineGlow(ctx, 0.38, 0.80, 0.028);
  teranosEngineGlow(ctx, 0.62, 0.80, 0.028);
}


/**
 * CRUISER -- The first hull where the full Teranos language emerges.
 * Dorsal spine weapon visible, expanded bridge, pronounced chin prow,
 * multiple turret platforms, layered armour begins.
 */
export function teranosCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull -- tapered, narrower bow, broad stern
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.40, 0.16);
  ctx.lineTo(0.32, 0.30);
  ctx.lineTo(0.28, 0.50);
  ctx.lineTo(0.26, 0.70);
  ctx.lineTo(0.26, 0.80);
  ctx.lineTo(0.74, 0.80);
  ctx.lineTo(0.74, 0.70);
  ctx.lineTo(0.72, 0.50);
  ctx.lineTo(0.68, 0.30);
  ctx.lineTo(0.60, 0.16);
  ctx.closePath();
  teranosFill(ctx, accent);

  // Chin prow -- now a full wedge-shaped forward section
  ctx.beginPath();
  ctx.moveTo(0.43, 0.15);
  ctx.lineTo(0.40, 0.08);
  ctx.lineTo(0.46, 0.04);
  ctx.lineTo(0.54, 0.04);
  ctx.lineTo(0.60, 0.08);
  ctx.lineTo(0.57, 0.15);
  ctx.closePath();
  ctx.fillStyle = '#3a4a5a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Dorsal spine weapon -- centreline stripe running bow to midships
  ctx.beginPath();
  ctx.rect(0.48, 0.16, 0.04, 0.38);
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Side armour plates (slightly offset from hull -- visible layering)
  ctx.beginPath();
  ctx.moveTo(0.26, 0.36);
  ctx.lineTo(0.22, 0.38);
  ctx.lineTo(0.22, 0.66);
  ctx.lineTo(0.26, 0.68);
  ctx.closePath();
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.74, 0.36);
  ctx.lineTo(0.78, 0.38);
  ctx.lineTo(0.78, 0.66);
  ctx.lineTo(0.74, 0.68);
  ctx.closePath();
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Seam lines
  teranosSeam(ctx, 0.30, 0.32, 0.70, 0.32);
  teranosSeam(ctx, 0.28, 0.50, 0.72, 0.50);
  teranosSeam(ctx, 0.27, 0.68, 0.73, 0.68);

  // Turret mounts -- port and starboard
  teranosTurret(ctx, 0.34, 0.28, 0.028, accent);
  teranosTurret(ctx, 0.66, 0.28, 0.028, accent);
  teranosTurret(ctx, 0.32, 0.56, 0.025, accent);
  teranosTurret(ctx, 0.68, 0.56, 0.025, accent);

  // Bridge viewport
  teranosViewport(ctx, 0.42, 0.14, 0.16, 0.018);

  // Antenna mast (slightly off-centre)
  ctx.beginPath();
  ctx.moveTo(0.52, 0.22);
  ctx.lineTo(0.52, 0.14);
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Crossbar
  ctx.beginPath();
  ctx.moveTo(0.46, 0.14);
  ctx.lineTo(0.58, 0.14);
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Engines -- four bells across broad stern
  teranosEngineGlow(ctx, 0.34, 0.82, 0.026);
  teranosEngineGlow(ctx, 0.44, 0.83, 0.028);
  teranosEngineGlow(ctx, 0.56, 0.83, 0.028);
  teranosEngineGlow(ctx, 0.66, 0.82, 0.026);
}


/**
 * CARRIER -- Broad flat deck with visible launch bay openings. Bridge
 * tower offset to starboard (asymmetric, like a real aircraft carrier).
 * Multiple point-defence turrets along the edges.
 */
export function teranosCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull -- wide, flat-topped
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.lineTo(0.34, 0.14);
  ctx.lineTo(0.20, 0.26);
  ctx.lineTo(0.16, 0.52);
  ctx.lineTo(0.18, 0.74);
  ctx.lineTo(0.22, 0.84);
  ctx.lineTo(0.78, 0.84);
  ctx.lineTo(0.82, 0.74);
  ctx.lineTo(0.84, 0.52);
  ctx.lineTo(0.80, 0.26);
  ctx.lineTo(0.66, 0.14);
  ctx.closePath();
  teranosFill(ctx, accent);

  // Chin prow
  ctx.beginPath();
  ctx.moveTo(0.44, 0.12);
  ctx.lineTo(0.42, 0.06);
  ctx.lineTo(0.48, 0.04);
  ctx.lineTo(0.52, 0.04);
  ctx.lineTo(0.58, 0.06);
  ctx.lineTo(0.56, 0.12);
  ctx.closePath();
  ctx.fillStyle = '#3a4a5a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Launch bays -- dark recesses (port and starboard pairs)
  ctx.fillStyle = 'rgba(8,12,18,0.65)';
  ctx.fillRect(0.22, 0.30, 0.12, 0.05);
  ctx.fillRect(0.66, 0.30, 0.12, 0.05);
  ctx.fillRect(0.22, 0.42, 0.12, 0.05);
  ctx.fillRect(0.66, 0.42, 0.12, 0.05);
  ctx.fillRect(0.22, 0.54, 0.12, 0.05);
  ctx.fillRect(0.66, 0.54, 0.12, 0.05);
  ctx.fillRect(0.22, 0.66, 0.12, 0.05);
  ctx.fillRect(0.66, 0.66, 0.12, 0.05);

  // Flight deck centreline
  ctx.beginPath();
  ctx.rect(0.47, 0.22, 0.06, 0.52);
  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.20);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Bridge tower (offset to starboard -- asymmetric!)
  ctx.beginPath();
  ctx.rect(0.62, 0.16, 0.12, 0.14);
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Bridge viewport
  teranosViewport(ctx, 0.63, 0.18, 0.10, 0.012);

  // Seam lines
  teranosSeam(ctx, 0.20, 0.28, 0.80, 0.28);
  teranosSeam(ctx, 0.18, 0.48, 0.82, 0.48);
  teranosSeam(ctx, 0.19, 0.64, 0.81, 0.64);

  // Point-defence turrets along edges
  teranosTurret(ctx, 0.20, 0.36, 0.022, accent);
  teranosTurret(ctx, 0.80, 0.36, 0.022, accent);
  teranosTurret(ctx, 0.18, 0.58, 0.022, accent);
  teranosTurret(ctx, 0.82, 0.58, 0.022, accent);

  // Engines -- four bells
  teranosEngineGlow(ctx, 0.32, 0.86, 0.028);
  teranosEngineGlow(ctx, 0.44, 0.87, 0.032);
  teranosEngineGlow(ctx, 0.56, 0.87, 0.032);
  teranosEngineGlow(ctx, 0.68, 0.86, 0.028);
}


/**
 * BATTLESHIP -- The full Teranos warship. Massive chin prow, dorsal spine
 * weapon, layered armour plates, dense turret coverage, antenna farm,
 * expanded bridge tower, broad stern with six engine bells. Bristles with
 * visible history -- every refit leaves its mark.
 */
export function teranosBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull -- heavy, wide-sterned
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.38, 0.14);
  ctx.lineTo(0.28, 0.26);
  ctx.lineTo(0.22, 0.44);
  ctx.lineTo(0.18, 0.62);
  ctx.lineTo(0.18, 0.78);
  ctx.lineTo(0.20, 0.86);
  ctx.lineTo(0.80, 0.86);
  ctx.lineTo(0.82, 0.78);
  ctx.lineTo(0.82, 0.62);
  ctx.lineTo(0.78, 0.44);
  ctx.lineTo(0.72, 0.26);
  ctx.lineTo(0.62, 0.14);
  ctx.closePath();
  teranosFill(ctx, accent);

  // Chin prow -- now a full aggressive wedge
  ctx.beginPath();
  ctx.moveTo(0.42, 0.14);
  ctx.lineTo(0.38, 0.06);
  ctx.lineTo(0.44, 0.02);
  ctx.lineTo(0.56, 0.02);
  ctx.lineTo(0.62, 0.06);
  ctx.lineTo(0.58, 0.14);
  ctx.closePath();
  ctx.fillStyle = '#3a4a5a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Chin deflector glow
  const chinGlow = ctx.createRadialGradient(0.50, 0.04, 0, 0.50, 0.04, 0.04);
  chinGlow.addColorStop(0,   withAlpha(accent, 0.5));
  chinGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.04, 0.04, 0, Math.PI * 2);
  ctx.fillStyle = chinGlow;
  ctx.fill();

  // Dorsal spine weapon -- prominent centreline rail
  ctx.beginPath();
  ctx.rect(0.47, 0.14, 0.06, 0.46);
  ctx.fillStyle = withAlpha(accent, 0.22);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.40);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Spine weapon emitter at bow
  ctx.beginPath();
  ctx.arc(0.50, 0.14, 0.018, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.6);
  ctx.fill();

  // Layered armour plates (outboard hull extensions)
  ctx.beginPath();
  ctx.moveTo(0.22, 0.30);
  ctx.lineTo(0.16, 0.32);
  ctx.lineTo(0.14, 0.58);
  ctx.lineTo(0.16, 0.72);
  ctx.lineTo(0.22, 0.74);
  ctx.closePath();
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.78, 0.30);
  ctx.lineTo(0.84, 0.32);
  ctx.lineTo(0.86, 0.58);
  ctx.lineTo(0.84, 0.72);
  ctx.lineTo(0.78, 0.74);
  ctx.closePath();
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Seam lines -- dense, showing multiple refits
  teranosSeam(ctx, 0.26, 0.28, 0.74, 0.28);
  teranosSeam(ctx, 0.23, 0.40, 0.77, 0.40);
  teranosSeam(ctx, 0.20, 0.54, 0.80, 0.54);
  teranosSeam(ctx, 0.19, 0.68, 0.81, 0.68);
  teranosSeam(ctx, 0.20, 0.78, 0.80, 0.78);

  // Turret mounts -- full coverage
  teranosTurret(ctx, 0.34, 0.24, 0.030, accent);
  teranosTurret(ctx, 0.66, 0.24, 0.030, accent);
  teranosTurret(ctx, 0.28, 0.44, 0.028, accent);
  teranosTurret(ctx, 0.72, 0.44, 0.028, accent);
  teranosTurret(ctx, 0.24, 0.60, 0.028, accent);
  teranosTurret(ctx, 0.76, 0.60, 0.028, accent);

  // Bridge tower (expanded, with secondary viewport)
  ctx.beginPath();
  ctx.rect(0.40, 0.16, 0.20, 0.10);
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  teranosViewport(ctx, 0.42, 0.18, 0.16, 0.015);

  // Antenna farm (multiple masts, asymmetric)
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.004;
  // Main mast
  ctx.beginPath();
  ctx.moveTo(0.52, 0.20);
  ctx.lineTo(0.52, 0.10);
  ctx.stroke();
  // Crossbar
  ctx.beginPath();
  ctx.moveTo(0.46, 0.10);
  ctx.lineTo(0.58, 0.10);
  ctx.lineWidth = 0.003;
  ctx.stroke();
  // Secondary mast (shorter, port side)
  ctx.beginPath();
  ctx.moveTo(0.38, 0.34);
  ctx.lineTo(0.38, 0.26);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Engines -- six bells across the broad stern
  teranosEngineGlow(ctx, 0.28, 0.88, 0.024);
  teranosEngineGlow(ctx, 0.38, 0.89, 0.028);
  teranosEngineGlow(ctx, 0.48, 0.90, 0.030);
  teranosEngineGlow(ctx, 0.52, 0.90, 0.030);
  teranosEngineGlow(ctx, 0.62, 0.89, 0.028);
  teranosEngineGlow(ctx, 0.72, 0.88, 0.024);
}


/**
 * COLONISER -- The ark. Long, deep-hulled, with visible habitat window
 * strips and a protective chin deflector. Less weapons than a warship
 * but heavily armoured. Engine cluster is wide -- this ship needs to
 * move a LOT of mass.
 */
export function teranosColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull -- deep, elongated
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.lineTo(0.38, 0.14);
  ctx.lineTo(0.30, 0.26);
  ctx.lineTo(0.26, 0.46);
  ctx.lineTo(0.24, 0.66);
  ctx.lineTo(0.26, 0.78);
  ctx.lineTo(0.28, 0.84);
  ctx.lineTo(0.72, 0.84);
  ctx.lineTo(0.74, 0.78);
  ctx.lineTo(0.76, 0.66);
  ctx.lineTo(0.74, 0.46);
  ctx.lineTo(0.70, 0.26);
  ctx.lineTo(0.62, 0.14);
  ctx.closePath();
  teranosFill(ctx, accent);

  // Chin deflector -- protective prow for interstellar travel
  ctx.beginPath();
  ctx.moveTo(0.44, 0.12);
  ctx.lineTo(0.42, 0.06);
  ctx.lineTo(0.47, 0.03);
  ctx.lineTo(0.53, 0.03);
  ctx.lineTo(0.58, 0.06);
  ctx.lineTo(0.56, 0.12);
  ctx.closePath();
  ctx.fillStyle = '#3a4a5a';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Habitat window strips -- warm glowing bands where the colonists live
  for (let y = 0.30; y <= 0.66; y += 0.12) {
    const xMargin = 0.02 + (y - 0.30) * 0.03;
    ctx.beginPath();
    ctx.rect(0.30 - xMargin, y, 0.40 + xMargin * 2, 0.025);
    const wg = ctx.createLinearGradient(0.30, y, 0.70, y);
    wg.addColorStop(0,   withAlpha(accent, 0.2));
    wg.addColorStop(0.3, withAlpha(accent, 0.45));
    wg.addColorStop(0.7, withAlpha(accent, 0.45));
    wg.addColorStop(1,   withAlpha(accent, 0.2));
    ctx.fillStyle = wg;
    ctx.fill();
  }

  // Seam lines
  teranosSeam(ctx, 0.30, 0.28, 0.70, 0.28);
  teranosSeam(ctx, 0.26, 0.44, 0.74, 0.44);
  teranosSeam(ctx, 0.25, 0.60, 0.75, 0.60);
  teranosSeam(ctx, 0.26, 0.74, 0.74, 0.74);

  // Light armour plates (colonisers need protection, not weapons)
  ctx.beginPath();
  ctx.moveTo(0.26, 0.34);
  ctx.lineTo(0.22, 0.36);
  ctx.lineTo(0.22, 0.62);
  ctx.lineTo(0.26, 0.64);
  ctx.closePath();
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.74, 0.34);
  ctx.lineTo(0.78, 0.36);
  ctx.lineTo(0.78, 0.62);
  ctx.lineTo(0.74, 0.64);
  ctx.closePath();
  ctx.fillStyle = '#5a6a7a';
  ctx.fill();

  // Minimal turrets (defensive only)
  teranosTurret(ctx, 0.34, 0.22, 0.022, accent);
  teranosTurret(ctx, 0.66, 0.22, 0.022, accent);

  // Bridge viewport
  teranosViewport(ctx, 0.42, 0.14, 0.16, 0.015);

  // Interior habitat glow -- warm, alive, people inside
  const habGlow = ctx.createRadialGradient(0.50, 0.48, 0, 0.50, 0.48, 0.18);
  habGlow.addColorStop(0,   withAlpha(accent, 0.15));
  habGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.18, 0, Math.PI * 2);
  ctx.fillStyle = habGlow;
  ctx.fill();

  // Engines -- four wide-spread bells (need thrust for all that mass)
  teranosEngineGlow(ctx, 0.34, 0.86, 0.030);
  teranosEngineGlow(ctx, 0.44, 0.87, 0.032);
  teranosEngineGlow(ctx, 0.56, 0.87, 0.032);
  teranosEngineGlow(ctx, 0.66, 0.86, 0.030);
}
