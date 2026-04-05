/**
 * ShipDesignFamilies.ts
 *
 * Per-species ship wireframe renderers for the ship designer UI.
 * Each species has 7 hull-class draw functions (scout through coloniser)
 * plus species-specific visual helper functions.
 *
 * All draw functions operate in a normalised 1x1 coordinate space.
 * Ships face nose-up (fore = top of canvas).
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type DesignFamily = 'organic' | 'angular' | 'crystalline' | 'mechanical' | 'practical';

type FamilyDrawFn = (ctx: CanvasRenderingContext2D, accent: string) => void;

// ── Species -> family mapping (kept for backwards compat) ────────────────────

export const SPECIES_DESIGN_FAMILY: Record<string, DesignFamily> = {
  sylvani:  'organic',      drakmari: 'organic',      vethara:  'organic',
  khazari:  'angular',      orivani:  'angular',      pyrenth:  'angular',
  vaelori:  'crystalline',  luminari: 'crystalline',   aethyn:   'crystalline',
  nexari:   'mechanical',   kaelenth: 'mechanical',    thyriaq:  'mechanical',
  teranos:  'practical',    ashkari:  'practical',     zorvathi: 'practical',
};

export function getDesignFamily(speciesId?: string): DesignFamily {
  if (!speciesId) return 'practical';
  return SPECIES_DESIGN_FAMILY[speciesId] ?? 'practical';
}

// ── Colour helpers ──────────────────────────────────────────────────────────

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

// ── Maths constants ─────────────────────────────────────────────────────────

const HALF_PI = Math.PI / 2;

// ===========================================================================
//  PER-SPECIES WIREFRAME RENDERERS
// ===========================================================================

// ===========================================================================
//  TERANOS
// ===========================================================================

//  SECTION 4: 2D WIREFRAME DRAW FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Colour helpers ───────────────────────────────────────────────────────────


// ── Shared Teranos helpers ───────────────────────────────────────────────────

/** Teranos hull fill: blue-grey steel gradient, darker at stern. */
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
function teranosScout(ctx: CanvasRenderingContext2D, accent: string): void {
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
function teranosDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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
function teranosTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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
function teranosCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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
function teranosCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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
function teranosBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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
function teranosColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS (for integration reference)

// ===========================================================================
//  KHAZARI
// ===========================================================================

//  SECTION 4: 2D WIREFRAME DRAW FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Colour helpers (defined locally per spec) ────────────────────────────────


// ── Shared Khazari drawing helpers ───────────────────────────────────────────

/** Forge-furnace engine glow — deep amber-orange, hotter and dirtier than generic angular. */
function khazariEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Outer bloom — wide, smoky orange
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  bloom.addColorStop(0,   'rgba(255,160,50,0.65)');
  bloom.addColorStop(0.3, 'rgba(255,120,20,0.4)');
  bloom.addColorStop(0.6, 'rgba(200,60,10,0.15)');
  bloom.addColorStop(1,   'rgba(120,20,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-hot centre
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,245,210,1)');
  core.addColorStop(0.3, 'rgba(255,180,60,0.9)');
  core.addColorStop(0.7, 'rgba(255,100,20,0.5)');
  core.addColorStop(1,   'rgba(180,40,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Dark iron hull fill with forge-brown gradient — distinctly different from generic angular. */
function khazariFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.05, 0.7, 0.95);
  grad.addColorStop(0,   '#5a4a38');  // lighter iron-brown at fore
  grad.addColorStop(0.3, '#443828');  // mid-tone forged iron
  grad.addColorStop(0.7, '#352a1e');  // darker towards engines
  grad.addColorStop(1,   '#2a2018');  // near-black at stern
  ctx.fillStyle = grad;
  ctx.fill();
  // Accent edge line — amber forge glow at hull boundaries
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Forge-seam panel line — horizontal heat channel across the hull. */
function forgeSeam(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, accent: string): void {
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Subtle amber glow along seam
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.strokeStyle = 'rgba(255,140,40,0.08)';
  ctx.lineWidth = 0.012;
  ctx.stroke();
}

/** Dorsal crest line — the signature Khazari spine ridge. */
function dorsalCrest(ctx: CanvasRenderingContext2D, yStart: number, yEnd: number, accent: string): void {
  ctx.beginPath();
  ctx.moveTo(0.50, yStart);
  ctx.lineTo(0.50, yEnd);
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.012;
  ctx.stroke();
  // Fainter glow alongside
  ctx.beginPath();
  ctx.moveTo(0.50, yStart);
  ctx.lineTo(0.50, yEnd);
  ctx.strokeStyle = 'rgba(255,140,40,0.12)';
  ctx.lineWidth = 0.025;
  ctx.stroke();
}

/** Weapon turret — octagonal platform with stubby barrel. */
function turretMount(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  size: number, barrelLen: number, accent: string,
): void {
  // Octagonal base
  ctx.beginPath();
  const sides = 8;
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fillStyle = withAlpha(accent, 0.3);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.003;
  ctx.stroke();
  // Barrel — stubby line pointing fore (upward)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - barrelLen);
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.006;
  ctx.stroke();
}

/** Ram prow tip — the pointed diamond at the nose of every Khazari ship. */
function ramProw(
  ctx: CanvasRenderingContext2D,
  tipX: number, tipY: number,
  leftX: number, rightX: number, baseY: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(rightX, baseY);
  ctx.lineTo(leftX, baseY);
  ctx.closePath();
  // Darker iron for the ram
  const ramGrad = ctx.createLinearGradient(tipX, tipY, tipX, baseY);
  ramGrad.addColorStop(0, '#6a5840');
  ramGrad.addColorStop(1, '#443828');
  ctx.fillStyle = ramGrad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Heat channels on the ram
  ctx.beginPath();
  ctx.moveTo(tipX, tipY + 0.01);
  ctx.lineTo(tipX, baseY - 0.01);
  ctx.strokeStyle = 'rgba(255,120,30,0.15)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
}


// ── Ship wireframe functions ─────────────────────────────────────────────────

/**
 * SCOUT — "Forge Dart"
 * The smallest Khazari hull: a single forged blade with ram prow.
 * Narrow, fast, aggressive. A thrown dagger from the forge.
 */
function khazariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ram prow — sharp diamond point
  ramProw(ctx, 0.50, 0.06, 0.44, 0.56, 0.18, accent);

  // Main hull — narrow trapezoid (wider at stern)
  ctx.beginPath();
  ctx.moveTo(0.44, 0.18);    // fore-left (narrower)
  ctx.lineTo(0.40, 0.38);    // mid-left widens
  ctx.lineTo(0.38, 0.72);    // aft section
  ctx.lineTo(0.42, 0.82);    // engine housing left
  ctx.lineTo(0.58, 0.82);    // engine housing right
  ctx.lineTo(0.62, 0.72);    // aft section
  ctx.lineTo(0.60, 0.38);    // mid-right
  ctx.lineTo(0.56, 0.18);    // fore-right (narrower)
  ctx.closePath();
  khazariFill(ctx, accent);

  // Dorsal crest
  dorsalCrest(ctx, 0.20, 0.70, accent);

  // Forge seams
  forgeSeam(ctx, 0.40, 0.40, 0.60, accent);
  forgeSeam(ctx, 0.39, 0.58, 0.61, accent);

  // Viewport slit — amber glow
  ctx.beginPath();
  ctx.rect(0.46, 0.20, 0.08, 0.015);
  const vpGrad = ctx.createLinearGradient(0.46, 0.20, 0.54, 0.20);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Twin engines
  khazariEngineGlow(ctx, 0.46, 0.81, 0.025);
  khazariEngineGlow(ctx, 0.54, 0.81, 0.025);
}


/**
 * DESTROYER — "Forge Hammer"
 * The workhorse warship. Heavier than the scout with visible side armour
 * plates, a pronounced dorsal crest, and a forward turret. The hammerhead
 * cross-strakes give it a broader, more threatening profile.
 */
function khazariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ram prow
  ramProw(ctx, 0.50, 0.06, 0.42, 0.58, 0.16, accent);

  // Main hull — wider trapezoid
  ctx.beginPath();
  ctx.moveTo(0.42, 0.16);
  ctx.lineTo(0.36, 0.24);
  ctx.lineTo(0.32, 0.50);
  ctx.lineTo(0.34, 0.72);
  ctx.lineTo(0.38, 0.82);
  ctx.lineTo(0.62, 0.82);
  ctx.lineTo(0.66, 0.72);
  ctx.lineTo(0.68, 0.50);
  ctx.lineTo(0.64, 0.24);
  ctx.lineTo(0.58, 0.16);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Side armour plates — overlapping strakes
  ctx.beginPath();
  ctx.moveTo(0.32, 0.28);
  ctx.lineTo(0.24, 0.30);
  ctx.lineTo(0.22, 0.44);
  ctx.lineTo(0.30, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.68, 0.28);
  ctx.lineTo(0.76, 0.30);
  ctx.lineTo(0.78, 0.44);
  ctx.lineTo(0.70, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest
  dorsalCrest(ctx, 0.18, 0.72, accent);

  // Forge seams
  forgeSeam(ctx, 0.34, 0.35, 0.66, accent);
  forgeSeam(ctx, 0.33, 0.52, 0.67, accent);
  forgeSeam(ctx, 0.35, 0.68, 0.65, accent);

  // Forward turret
  turretMount(ctx, 0.50, 0.28, 0.025, 0.06, accent);

  // Viewport slit
  ctx.beginPath();
  ctx.rect(0.44, 0.12, 0.12, 0.018);
  const vpGrad = ctx.createLinearGradient(0.44, 0.12, 0.56, 0.12);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Quad engines
  khazariEngineGlow(ctx, 0.42, 0.81, 0.024);
  khazariEngineGlow(ctx, 0.50, 0.82, 0.020);
  khazariEngineGlow(ctx, 0.58, 0.81, 0.024);
}


/**
 * TRANSPORT — "Forge Barge"
 * Heavy cargo hauler. Wide, squat, and armoured like a mobile vault.
 * The trapezoidal cross-section is most pronounced here — a flying
 * strongbox with visible cargo bay seams and reinforced hull plates.
 */
function khazariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Blunt prow — transports have a shorter, stubbier ram
  ramProw(ctx, 0.50, 0.10, 0.40, 0.60, 0.18, accent);

  // Main hull — wide, blocky trapezoid
  ctx.beginPath();
  ctx.moveTo(0.40, 0.18);
  ctx.lineTo(0.28, 0.24);
  ctx.lineTo(0.24, 0.44);
  ctx.lineTo(0.24, 0.72);
  ctx.lineTo(0.30, 0.84);
  ctx.lineTo(0.70, 0.84);
  ctx.lineTo(0.76, 0.72);
  ctx.lineTo(0.76, 0.44);
  ctx.lineTo(0.72, 0.24);
  ctx.lineTo(0.60, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Cargo bay dividers — heavy horizontal seams
  for (let y = 0.32; y <= 0.68; y += 0.09) {
    forgeSeam(ctx, 0.26, y, 0.74, accent);
  }

  // Side armour strakes
  ctx.beginPath();
  ctx.moveTo(0.24, 0.30);
  ctx.lineTo(0.18, 0.34);
  ctx.lineTo(0.18, 0.68);
  ctx.lineTo(0.24, 0.70);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.1);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.76, 0.30);
  ctx.lineTo(0.82, 0.34);
  ctx.lineTo(0.82, 0.68);
  ctx.lineTo(0.76, 0.70);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.1);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest (shorter on transports — less aggressive)
  dorsalCrest(ctx, 0.22, 0.55, accent);

  // Viewport slit
  ctx.beginPath();
  ctx.rect(0.42, 0.14, 0.16, 0.018);
  const vpGrad = ctx.createLinearGradient(0.42, 0.14, 0.58, 0.14);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Twin wide engines
  khazariEngineGlow(ctx, 0.40, 0.83, 0.030);
  khazariEngineGlow(ctx, 0.60, 0.83, 0.030);
}


/**
 * CRUISER — "Forge Anvil"
 * The backbone of the Khazari fleet. Heavily armed with multiple turrets,
 * pronounced dorsal crest, reinforced keel, and visible sponson bulges.
 * The silhouette is a broad, angular diamond tapering to the ram prow.
 */
function khazariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Heavy ram prow
  ramProw(ctx, 0.50, 0.06, 0.38, 0.62, 0.18, accent);

  // Main hull — broad angular diamond
  ctx.beginPath();
  ctx.moveTo(0.38, 0.18);
  ctx.lineTo(0.28, 0.28);
  ctx.lineTo(0.22, 0.46);
  ctx.lineTo(0.24, 0.66);
  ctx.lineTo(0.32, 0.80);
  ctx.lineTo(0.50, 0.88);
  ctx.lineTo(0.68, 0.80);
  ctx.lineTo(0.76, 0.66);
  ctx.lineTo(0.78, 0.46);
  ctx.lineTo(0.72, 0.28);
  ctx.lineTo(0.62, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Sponson bulges — armoured weapon platforms on flanks
  ctx.beginPath();
  ctx.moveTo(0.22, 0.38);
  ctx.lineTo(0.14, 0.42);
  ctx.lineTo(0.14, 0.56);
  ctx.lineTo(0.22, 0.58);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.78, 0.38);
  ctx.lineTo(0.86, 0.42);
  ctx.lineTo(0.86, 0.56);
  ctx.lineTo(0.78, 0.58);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest — prominent
  dorsalCrest(ctx, 0.20, 0.76, accent);

  // Forge seams
  forgeSeam(ctx, 0.26, 0.34, 0.74, accent);
  forgeSeam(ctx, 0.24, 0.50, 0.76, accent);
  forgeSeam(ctx, 0.26, 0.66, 0.74, accent);

  // Keel plate indicator — darker band at bottom
  ctx.beginPath();
  ctx.moveTo(0.30, 0.78);
  ctx.lineTo(0.70, 0.78);
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.015;
  ctx.stroke();

  // Turrets — dorsal main battery and broadside mounts
  turretMount(ctx, 0.50, 0.30, 0.028, 0.065, accent);
  turretMount(ctx, 0.50, 0.55, 0.025, 0.055, accent);
  turretMount(ctx, 0.16, 0.48, 0.020, 0.045, accent);
  turretMount(ctx, 0.84, 0.48, 0.020, 0.045, accent);

  // Viewport
  ctx.beginPath();
  ctx.rect(0.42, 0.12, 0.16, 0.02);
  const vpGrad = ctx.createLinearGradient(0.42, 0.12, 0.58, 0.12);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Quad engines
  khazariEngineGlow(ctx, 0.38, 0.86, 0.028);
  khazariEngineGlow(ctx, 0.46, 0.87, 0.024);
  khazariEngineGlow(ctx, 0.54, 0.87, 0.024);
  khazariEngineGlow(ctx, 0.62, 0.86, 0.028);
}


/**
 * CARRIER — "Forge Citadel"
 * A massive flat-decked vessel with recessed launch bays on each flank.
 * Unlike generic angular carriers with side-by-side rectangles, the Khazari
 * carrier has its bays recessed into armoured sponson structures. The launch
 * openings glow amber from internal forge-light. The dorsal crest runs the
 * full length, making it look like a fortified ridge.
 */
function khazariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ram prow — even carriers are armed
  ramProw(ctx, 0.50, 0.08, 0.36, 0.64, 0.18, accent);

  // Main hull — broad, flat deck
  ctx.beginPath();
  ctx.moveTo(0.36, 0.18);
  ctx.lineTo(0.22, 0.24);
  ctx.lineTo(0.16, 0.36);
  ctx.lineTo(0.14, 0.58);
  ctx.lineTo(0.16, 0.74);
  ctx.lineTo(0.24, 0.84);
  ctx.lineTo(0.76, 0.84);
  ctx.lineTo(0.84, 0.74);
  ctx.lineTo(0.86, 0.58);
  ctx.lineTo(0.84, 0.36);
  ctx.lineTo(0.78, 0.24);
  ctx.lineTo(0.64, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Launch bay recesses — dark amber-lit openings in sponson armour
  const bayPositions = [0.34, 0.48, 0.62];
  for (const by of bayPositions) {
    // Left bay
    ctx.beginPath();
    ctx.rect(0.17, by, 0.10, 0.05);
    const leftGlow = ctx.createLinearGradient(0.17, by, 0.27, by);
    leftGlow.addColorStop(0, 'rgba(255,120,30,0.15)');
    leftGlow.addColorStop(0.5, 'rgba(10,8,6,0.7)');
    leftGlow.addColorStop(1, 'rgba(255,120,30,0.15)');
    ctx.fillStyle = leftGlow;
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.2);
    ctx.lineWidth = 0.003;
    ctx.stroke();

    // Right bay
    ctx.beginPath();
    ctx.rect(0.73, by, 0.10, 0.05);
    const rightGlow = ctx.createLinearGradient(0.73, by, 0.83, by);
    rightGlow.addColorStop(0, 'rgba(255,120,30,0.15)');
    rightGlow.addColorStop(0.5, 'rgba(10,8,6,0.7)');
    rightGlow.addColorStop(1, 'rgba(255,120,30,0.15)');
    ctx.fillStyle = rightGlow;
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.2);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Dorsal crest — full length
  dorsalCrest(ctx, 0.20, 0.80, accent);

  // Forge seams
  forgeSeam(ctx, 0.18, 0.30, 0.82, accent);
  forgeSeam(ctx, 0.16, 0.46, 0.84, accent);
  forgeSeam(ctx, 0.16, 0.60, 0.84, accent);
  forgeSeam(ctx, 0.18, 0.74, 0.82, accent);

  // Centre command section — accent stripe
  ctx.beginPath();
  ctx.moveTo(0.46, 0.22);
  ctx.lineTo(0.46, 0.78);
  ctx.lineTo(0.54, 0.78);
  ctx.lineTo(0.54, 0.22);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();

  // Viewport
  ctx.beginPath();
  ctx.rect(0.40, 0.13, 0.20, 0.02);
  const vpGrad = ctx.createLinearGradient(0.40, 0.13, 0.60, 0.13);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Triple engines
  khazariEngineGlow(ctx, 0.36, 0.83, 0.032);
  khazariEngineGlow(ctx, 0.50, 0.84, 0.028);
  khazariEngineGlow(ctx, 0.64, 0.83, 0.032);
}


/**
 * BATTLESHIP — "Forge Leviathan"
 * The pride of the Khazari fleet. A massive, layered fortress bristling
 * with turrets on every surface. The dorsal crest towers above the hull.
 * Heavy broadside sponsons project from each flank. Multiple forge-seam
 * layers give the hull a laminated, damascus-steel appearance. The ram
 * prow is flanked by auxiliary rams. This ship is a declaration of war.
 */
function khazariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Auxiliary rams — flanking the main prow
  ctx.beginPath();
  ctx.moveTo(0.32, 0.18);
  ctx.lineTo(0.28, 0.12);
  ctx.lineTo(0.24, 0.18);
  ctx.closePath();
  ctx.fillStyle = '#5a4a38';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.68, 0.18);
  ctx.lineTo(0.72, 0.12);
  ctx.lineTo(0.76, 0.18);
  ctx.closePath();
  ctx.fillStyle = '#5a4a38';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Main ram prow — massive
  ramProw(ctx, 0.50, 0.04, 0.36, 0.64, 0.18, accent);

  // Main hull — massive layered fortress
  ctx.beginPath();
  ctx.moveTo(0.36, 0.18);
  ctx.lineTo(0.24, 0.26);
  ctx.lineTo(0.16, 0.40);
  ctx.lineTo(0.14, 0.56);
  ctx.lineTo(0.16, 0.72);
  ctx.lineTo(0.24, 0.82);
  ctx.lineTo(0.36, 0.90);
  ctx.lineTo(0.64, 0.90);
  ctx.lineTo(0.76, 0.82);
  ctx.lineTo(0.84, 0.72);
  ctx.lineTo(0.86, 0.56);
  ctx.lineTo(0.84, 0.40);
  ctx.lineTo(0.76, 0.26);
  ctx.lineTo(0.64, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Heavy broadside sponsons
  ctx.beginPath();
  ctx.moveTo(0.14, 0.34);
  ctx.lineTo(0.08, 0.38);
  ctx.lineTo(0.06, 0.50);
  ctx.lineTo(0.08, 0.62);
  ctx.lineTo(0.14, 0.66);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.86, 0.34);
  ctx.lineTo(0.92, 0.38);
  ctx.lineTo(0.94, 0.50);
  ctx.lineTo(0.92, 0.62);
  ctx.lineTo(0.86, 0.66);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest — towering
  dorsalCrest(ctx, 0.20, 0.82, accent);

  // Forge seams — multiple layers (damascus effect)
  forgeSeam(ctx, 0.22, 0.28, 0.78, accent);
  forgeSeam(ctx, 0.18, 0.38, 0.82, accent);
  forgeSeam(ctx, 0.16, 0.48, 0.84, accent);
  forgeSeam(ctx, 0.16, 0.58, 0.84, accent);
  forgeSeam(ctx, 0.18, 0.68, 0.82, accent);
  forgeSeam(ctx, 0.22, 0.78, 0.78, accent);

  // Keel plate
  ctx.beginPath();
  ctx.moveTo(0.30, 0.84);
  ctx.lineTo(0.70, 0.84);
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.018;
  ctx.stroke();

  // Turrets — full arsenal
  // Dorsal main batteries
  turretMount(ctx, 0.50, 0.30, 0.032, 0.075, accent);
  turretMount(ctx, 0.50, 0.50, 0.030, 0.065, accent);
  turretMount(ctx, 0.50, 0.68, 0.028, 0.060, accent);
  // Broadside sponson turrets
  turretMount(ctx, 0.09, 0.48, 0.022, 0.050, accent);
  turretMount(ctx, 0.91, 0.48, 0.022, 0.050, accent);
  turretMount(ctx, 0.09, 0.56, 0.022, 0.050, accent);
  turretMount(ctx, 0.91, 0.56, 0.022, 0.050, accent);
  // Flanking turrets on hull
  turretMount(ctx, 0.22, 0.36, 0.020, 0.045, accent);
  turretMount(ctx, 0.78, 0.36, 0.020, 0.045, accent);

  // Viewport
  ctx.beginPath();
  ctx.rect(0.38, 0.10, 0.24, 0.022);
  const vpGrad = ctx.createLinearGradient(0.38, 0.10, 0.62, 0.10);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Eight engines in wide array
  khazariEngineGlow(ctx, 0.32, 0.89, 0.026);
  khazariEngineGlow(ctx, 0.40, 0.90, 0.030);
  khazariEngineGlow(ctx, 0.48, 0.91, 0.026);
  khazariEngineGlow(ctx, 0.52, 0.91, 0.026);
  khazariEngineGlow(ctx, 0.60, 0.90, 0.030);
  khazariEngineGlow(ctx, 0.68, 0.89, 0.026);
}


/**
 * COLONISER — "Forge Ark"
 * A protected vessel carrying the sacred forge-equipment to claim a new
 * world. Heavily armoured but not heavily armed — the Khazari protect
 * their colonisers with escorts, not with the coloniser's own guns.
 * The silhouette is rounded and enclosed compared to warships, with a
 * visible habitat section (the "crucible") amidships. The dorsal crest
 * is broader, almost a fin — acting as a thermal radiator for the
 * population within.
 */
function khazariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Blunt prow — protective, not aggressive
  ramProw(ctx, 0.50, 0.08, 0.38, 0.62, 0.18, accent);

  // Main hull — rounded trapezoid ark shape
  ctx.beginPath();
  ctx.moveTo(0.38, 0.18);
  ctx.lineTo(0.28, 0.26);
  ctx.lineTo(0.22, 0.40);
  ctx.lineTo(0.20, 0.56);
  ctx.lineTo(0.22, 0.70);
  ctx.lineTo(0.30, 0.80);
  ctx.lineTo(0.40, 0.88);
  ctx.lineTo(0.60, 0.88);
  ctx.lineTo(0.70, 0.80);
  ctx.lineTo(0.78, 0.70);
  ctx.lineTo(0.80, 0.56);
  ctx.lineTo(0.78, 0.40);
  ctx.lineTo(0.72, 0.26);
  ctx.lineTo(0.62, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Habitat "crucible" section — glowing amber band amidships
  ctx.beginPath();
  ctx.moveTo(0.24, 0.42);
  ctx.lineTo(0.76, 0.42);
  ctx.lineTo(0.78, 0.54);
  ctx.lineTo(0.76, 0.66);
  ctx.lineTo(0.24, 0.66);
  ctx.lineTo(0.22, 0.54);
  ctx.closePath();
  const habitatGrad = ctx.createLinearGradient(0.24, 0.42, 0.76, 0.66);
  habitatGrad.addColorStop(0,   'rgba(255,140,40,0.08)');
  habitatGrad.addColorStop(0.5, 'rgba(255,120,30,0.15)');
  habitatGrad.addColorStop(1,   'rgba(255,140,40,0.08)');
  ctx.fillStyle = habitatGrad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Habitat viewport strips — amber glow windows
  ctx.beginPath();
  ctx.rect(0.30, 0.46, 0.40, 0.015);
  ctx.fillStyle = 'rgba(255,160,60,0.4)';
  ctx.fill();
  ctx.beginPath();
  ctx.rect(0.30, 0.58, 0.40, 0.015);
  ctx.fillStyle = 'rgba(255,160,60,0.4)';
  ctx.fill();

  // Dorsal crest — broad radiator fin
  ctx.beginPath();
  ctx.moveTo(0.50, 0.22);
  ctx.lineTo(0.50, 0.76);
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.020;  // wider than warship crests
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.22);
  ctx.lineTo(0.50, 0.76);
  ctx.strokeStyle = 'rgba(255,140,40,0.10)';
  ctx.lineWidth = 0.035;
  ctx.stroke();

  // Armour shell plate seams
  forgeSeam(ctx, 0.26, 0.30, 0.74, accent);
  forgeSeam(ctx, 0.24, 0.42, 0.76, accent);
  forgeSeam(ctx, 0.24, 0.66, 0.76, accent);
  forgeSeam(ctx, 0.26, 0.76, 0.74, accent);

  // Top viewport
  ctx.beginPath();
  ctx.rect(0.42, 0.14, 0.16, 0.02);
  const vpGrad = ctx.createLinearGradient(0.42, 0.14, 0.58, 0.14);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Twin heavy engines
  khazariEngineGlow(ctx, 0.42, 0.87, 0.032);
  khazariEngineGlow(ctx, 0.58, 0.87, 0.032);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS (for integration reference)

// ===========================================================================
//  VAELORI
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — VAELORI-SPECIFIC DESIGN FAMILY
// ═══════════════════════════════════════════════════════════════════════════════


// ── Vaelori visual primitives ────────────────────────────────────────────────

/** Vaelori hull fill — geode gradient from deep amethyst edge to pale core. */
function vaeloriFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#6b5a8e');    // pale amethyst highlight
  grad.addColorStop(0.3, '#4a3870');    // mid geode violet
  grad.addColorStop(0.7, '#2e1d52');    // deep interior
  grad.addColorStop(1,   '#1a0f38');    // shadow edge
  ctx.fillStyle = grad;
  ctx.fill();
  // Hull edge — psionic shimmer line
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Draw the internal lattice spars — thin lines representing the psionic
 *  nervous system visible through the translucent hull. */
function vaeloriLattice(
  ctx: CanvasRenderingContext2D,
  accent: string,
  lines: [number, number, number, number][],
): void {
  ctx.strokeStyle = withAlpha(accent, 0.22);
  ctx.lineWidth = 0.003;
  for (const [x1, y1, x2, y2] of lines) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

/** Resonance node — small glowing sphere at lattice intersections. */
function vaeloriNode(
  ctx: CanvasRenderingContext2D,
  accent: string,
  cx: number, cy: number, r: number,
): void {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
  glow.addColorStop(0,   withAlpha(accent, 0.5));
  glow.addColorStop(0.5, withAlpha(accent, 0.15));
  glow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  // Hard bright core
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(230,220,255,0.9)';
  ctx.fill();
}

/** Psionic focus heart — the central dodecahedral meditation nexus. */
function vaeloriFocus(
  ctx: CanvasRenderingContext2D,
  accent: string,
  cx: number, cy: number, r: number,
): void {
  // Outer glow halo
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
  halo.addColorStop(0,   'rgba(220,210,255,0.95)');
  halo.addColorStop(0.25, withAlpha(accent, 0.65));
  halo.addColorStop(0.6, withAlpha(accent, 0.2));
  halo.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();
  // Inner diamond — rotated square representing the dodecahedral focus
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.6);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.lineTo(cx, cy + r * 0.6);
  ctx.lineTo(cx - r * 0.5, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(240,235,255,0.85)';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/** Engine resonance ring — torus cross-section viewed from behind. */
function vaeloriEngine(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  bloom.addColorStop(0,   'rgba(180,160,255,0.55)');
  bloom.addColorStop(0.4, 'rgba(120,80,200,0.2)');
  bloom.addColorStop(1,   'rgba(70,30,150,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Ring outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,180,255,0.7)';
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Bright core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.5);
  core.addColorStop(0,   'rgba(240,230,255,1)');
  core.addColorStop(0.5, 'rgba(170,140,255,0.8)');
  core.addColorStop(1,   'rgba(100,60,200,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Resonance spire — a thin triangle pointing up from the hull. */
function vaeloriSpire(
  ctx: CanvasRenderingContext2D,
  accent: string,
  baseX: number, baseY: number,
  tipX: number, tipY: number,
  halfW: number,
): void {
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX - halfW, baseY);
  ctx.lineTo(baseX + halfW, baseY);
  ctx.closePath();
  const grad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
  grad.addColorStop(0,   '#3a2860');
  grad.addColorStop(0.6, '#5a4a80');
  grad.addColorStop(1,   '#8070aa');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Tip glow
  vaeloriNode(ctx, accent, tipX, tipY, 0.012);
}

/** Weapon hardpoint — small octahedral marker. */
function vaeloriWeapon(
  ctx: CanvasRenderingContext2D,
  accent: string,
  cx: number, cy: number, r: number,
): void {
  // Diamond shape (octahedron from above)
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.75, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.75, cy);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.35);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

// ── Irregular geode hull path helper ─────────────────────────────────────────

/** Generate a geode-like polygon path — slightly irregular to look grown. */
function geodePath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  segments: number,
  irregularity: number,
  rotation = 0,
): void {
  ctx.beginPath();
  for (let i = 0; i < segments; i++) {
    const a = rotation + (Math.PI * 2 * i) / segments;
    // Slight radial wobble for organic mineral look
    const wobble = 1 + irregularity * Math.sin(i * 3.7 + 1.2);
    const px = cx + rx * wobble * Math.cos(a);
    const py = cy + ry * wobble * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}


// ═══════════════════════════════════════════════════════════════════════════════
//  VAELORI SHIP WIREFRAMES — 7 hull classes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SCOUT — A single geode shard, flung like a crystal dart.
 * Elongated diamond silhouette with one spire and minimal lattice.
 */
function vaeloriScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — elongated diamond (geode shard)
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);        // nose
  ctx.lineTo(0.38, 0.38);        // port shoulder
  ctx.lineTo(0.42, 0.72);        // port aft
  ctx.lineTo(0.50, 0.80);        // stern point
  ctx.lineTo(0.58, 0.72);        // starboard aft
  ctx.lineTo(0.62, 0.38);        // starboard shoulder
  ctx.closePath();
  vaeloriFill(ctx, accent);

  // Internal lattice — simple fore-aft spar
  vaeloriLattice(ctx, accent, [
    [0.50, 0.18, 0.50, 0.72],    // spine
    [0.42, 0.40, 0.58, 0.40],    // cross-brace
  ]);

  // Single dorsal spire (centre-forward)
  vaeloriSpire(ctx, accent, 0.50, 0.30, 0.50, 0.08, 0.025);

  // Psionic focus (small)
  vaeloriFocus(ctx, accent, 0.50, 0.38, 0.03);

  // Single engine ring
  vaeloriEngine(ctx, 0.50, 0.76, 0.025);
}


/**
 * DESTROYER — Two fused crystal masses joined by a visible lattice bridge.
 * The forward mass is angular, the aft mass rounder. A contemplative predator.
 */
function vaeloriDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Forward hull — angular geode wedge
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);        // nose
  ctx.lineTo(0.34, 0.24);        // port bow
  ctx.lineTo(0.32, 0.42);        // port mid
  ctx.lineTo(0.38, 0.50);        // port bridge junction
  ctx.lineTo(0.62, 0.50);        // starboard bridge junction
  ctx.lineTo(0.68, 0.42);        // starboard mid
  ctx.lineTo(0.66, 0.24);        // starboard bow
  ctx.closePath();
  vaeloriFill(ctx, accent);

  // Aft hull — rounder geode cluster
  geodePath(ctx, 0.50, 0.68, 0.16, 0.14, 7, 0.06, -HALF_PI);
  vaeloriFill(ctx, accent);

  // Bridge lattice spars connecting fore and aft masses
  vaeloriLattice(ctx, accent, [
    [0.44, 0.50, 0.44, 0.58],    // port bridge spar
    [0.56, 0.50, 0.56, 0.58],    // starboard bridge spar
    [0.50, 0.15, 0.50, 0.75],    // central spine
    [0.34, 0.34, 0.66, 0.34],    // forward cross-brace
    [0.38, 0.62, 0.62, 0.62],    // aft cross-brace
  ]);

  // Lattice nodes at intersections
  vaeloriNode(ctx, accent, 0.50, 0.50, 0.010);
  vaeloriNode(ctx, accent, 0.50, 0.34, 0.008);

  // Two spires — one on each mass
  vaeloriSpire(ctx, accent, 0.50, 0.20, 0.50, 0.06, 0.022);
  vaeloriSpire(ctx, accent, 0.50, 0.62, 0.50, 0.54, 0.018);

  // Focus (medium)
  vaeloriFocus(ctx, accent, 0.50, 0.30, 0.035);

  // Weapon hardpoints — underslung forward
  vaeloriWeapon(ctx, accent, 0.38, 0.36, 0.018);
  vaeloriWeapon(ctx, accent, 0.62, 0.36, 0.018);

  // Twin engines
  vaeloriEngine(ctx, 0.44, 0.80, 0.022);
  vaeloriEngine(ctx, 0.56, 0.80, 0.022);
}


/**
 * TRANSPORT — A fat protective geode egg. Thick shell, warm interior glow,
 * minimal armament. Designed to cradle cargo in crystalline safety.
 */
function vaeloriTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — wide irregular oval (geode egg)
  geodePath(ctx, 0.50, 0.44, 0.24, 0.30, 9, 0.04, -HALF_PI);
  vaeloriFill(ctx, accent);

  // Inner cargo chamber glow — a warm oval visible through the shell
  const chamberGlow = ctx.createRadialGradient(0.50, 0.44, 0, 0.50, 0.44, 0.16);
  chamberGlow.addColorStop(0,   withAlpha(accent, 0.25));
  chamberGlow.addColorStop(0.6, withAlpha(accent, 0.08));
  chamberGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.ellipse(0.50, 0.44, 0.14, 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = chamberGlow;
  ctx.fill();

  // Shell facet lines — suggesting thick mineral layers
  vaeloriLattice(ctx, accent, [
    [0.50, 0.14, 0.50, 0.74],    // vertical spine
    [0.30, 0.44, 0.70, 0.44],    // horizontal equator
    [0.36, 0.24, 0.64, 0.64],    // diagonal 1
    [0.64, 0.24, 0.36, 0.64],    // diagonal 2
  ]);

  // Short protective spire (single, stubby)
  vaeloriSpire(ctx, accent, 0.50, 0.18, 0.50, 0.08, 0.030);

  // Focus — set deep inside the egg
  vaeloriFocus(ctx, accent, 0.50, 0.42, 0.04);

  // Twin engines (modest)
  vaeloriEngine(ctx, 0.44, 0.74, 0.022);
  vaeloriEngine(ctx, 0.56, 0.74, 0.022);
}


/**
 * CRUISER — Elegant elongated geode with prominent spire crown and
 * multiple weapon hardpoints. The backbone of a Vaelori fleet:
 * contemplative, lethal, beautiful.
 */
function vaeloriCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — tall faceted gem silhouette
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);        // nose apex
  ctx.lineTo(0.32, 0.20);        // port bow facet
  ctx.lineTo(0.24, 0.42);        // port beam
  ctx.lineTo(0.28, 0.64);        // port quarter
  ctx.lineTo(0.38, 0.82);        // port stern
  ctx.lineTo(0.50, 0.88);        // stern centre
  ctx.lineTo(0.62, 0.82);        // starboard stern
  ctx.lineTo(0.72, 0.64);        // starboard quarter
  ctx.lineTo(0.76, 0.42);        // starboard beam
  ctx.lineTo(0.68, 0.20);        // starboard bow facet
  ctx.closePath();
  vaeloriFill(ctx, accent);

  // Internal lattice — complex web
  vaeloriLattice(ctx, accent, [
    [0.50, 0.10, 0.50, 0.82],    // central spine
    [0.28, 0.42, 0.72, 0.42],    // beam cross-brace
    [0.32, 0.60, 0.68, 0.60],    // quarter cross-brace
    [0.50, 0.04, 0.24, 0.42],    // port bow diagonal
    [0.50, 0.04, 0.76, 0.42],    // starboard bow diagonal
    [0.50, 0.88, 0.24, 0.42],    // port keel diagonal
    [0.50, 0.88, 0.76, 0.42],    // starboard keel diagonal
    [0.32, 0.20, 0.68, 0.64],    // long diagonal 1
    [0.68, 0.20, 0.32, 0.64],    // long diagonal 2
  ]);

  // Lattice nodes at key intersections
  vaeloriNode(ctx, accent, 0.50, 0.42, 0.010);
  vaeloriNode(ctx, accent, 0.38, 0.30, 0.007);
  vaeloriNode(ctx, accent, 0.62, 0.30, 0.007);
  vaeloriNode(ctx, accent, 0.38, 0.56, 0.007);
  vaeloriNode(ctx, accent, 0.62, 0.56, 0.007);

  // Three spires — crown formation
  vaeloriSpire(ctx, accent, 0.50, 0.14, 0.50, 0.04, 0.020);
  vaeloriSpire(ctx, accent, 0.38, 0.22, 0.36, 0.12, 0.016);
  vaeloriSpire(ctx, accent, 0.62, 0.22, 0.64, 0.12, 0.016);

  // Psionic focus (prominent)
  vaeloriFocus(ctx, accent, 0.50, 0.40, 0.048);

  // Four weapon hardpoints — two forward, two midship
  vaeloriWeapon(ctx, accent, 0.32, 0.32, 0.020);
  vaeloriWeapon(ctx, accent, 0.68, 0.32, 0.020);
  vaeloriWeapon(ctx, accent, 0.28, 0.52, 0.016);
  vaeloriWeapon(ctx, accent, 0.72, 0.52, 0.016);

  // Twin engines with outer halo ring
  vaeloriEngine(ctx, 0.42, 0.84, 0.028);
  vaeloriEngine(ctx, 0.58, 0.84, 0.028);
  // Outer resonance ring
  ctx.beginPath();
  ctx.arc(0.50, 0.84, 0.12, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.003;
  ctx.stroke();
}


/**
 * CARRIER — A broad, flat cathedral platform. The hexagonal footprint is
 * widest here, with gaps in the shell where fighter-crystals launch.
 * Spires run along the dorsal ridge like organ pipes.
 */
function vaeloriCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — wide hexagonal platform with flattened aspect
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);        // bow point
  ctx.lineTo(0.22, 0.22);        // port bow
  ctx.lineTo(0.14, 0.48);        // port beam
  ctx.lineTo(0.20, 0.72);        // port quarter
  ctx.lineTo(0.50, 0.84);        // stern centre
  ctx.lineTo(0.80, 0.72);        // starboard quarter
  ctx.lineTo(0.86, 0.48);        // starboard beam
  ctx.lineTo(0.78, 0.22);        // starboard bow
  ctx.closePath();
  vaeloriFill(ctx, accent);

  // Flight deck bays — two dark gaps in the hull where fighters emerge
  ctx.fillStyle = 'rgba(10,5,25,0.7)';
  // Port bay
  ctx.beginPath();
  ctx.moveTo(0.22, 0.36);
  ctx.lineTo(0.18, 0.44);
  ctx.lineTo(0.18, 0.56);
  ctx.lineTo(0.22, 0.62);
  ctx.closePath();
  ctx.fill();
  // Starboard bay
  ctx.beginPath();
  ctx.moveTo(0.78, 0.36);
  ctx.lineTo(0.82, 0.44);
  ctx.lineTo(0.82, 0.56);
  ctx.lineTo(0.78, 0.62);
  ctx.closePath();
  ctx.fill();

  // Bay edge glow
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.22, 0.36); ctx.lineTo(0.18, 0.44); ctx.lineTo(0.18, 0.56); ctx.lineTo(0.22, 0.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.78, 0.36); ctx.lineTo(0.82, 0.44); ctx.lineTo(0.82, 0.56); ctx.lineTo(0.78, 0.62);
  ctx.stroke();

  // Internal lattice — cathedral ribbing
  vaeloriLattice(ctx, accent, [
    [0.50, 0.10, 0.50, 0.80],    // central nave
    [0.22, 0.48, 0.78, 0.48],    // transept
    [0.30, 0.28, 0.70, 0.68],    // diagonal rib 1
    [0.70, 0.28, 0.30, 0.68],    // diagonal rib 2
    [0.50, 0.06, 0.14, 0.48],    // port buttress
    [0.50, 0.06, 0.86, 0.48],    // starboard buttress
  ]);

  // Lattice nodes
  vaeloriNode(ctx, accent, 0.50, 0.48, 0.010);
  vaeloriNode(ctx, accent, 0.36, 0.34, 0.007);
  vaeloriNode(ctx, accent, 0.64, 0.34, 0.007);

  // Spire ridge — five spires in an arc across the dorsal bow
  vaeloriSpire(ctx, accent, 0.50, 0.14, 0.50, 0.04, 0.020);
  vaeloriSpire(ctx, accent, 0.38, 0.20, 0.36, 0.10, 0.016);
  vaeloriSpire(ctx, accent, 0.62, 0.20, 0.64, 0.10, 0.016);
  vaeloriSpire(ctx, accent, 0.28, 0.28, 0.26, 0.18, 0.014);
  vaeloriSpire(ctx, accent, 0.72, 0.28, 0.74, 0.18, 0.014);

  // Focus (large — carrier acts as mobile meditation temple)
  vaeloriFocus(ctx, accent, 0.50, 0.44, 0.052);

  // Weapon hardpoints — bow and quarter positions
  vaeloriWeapon(ctx, accent, 0.36, 0.18, 0.016);
  vaeloriWeapon(ctx, accent, 0.64, 0.18, 0.016);
  vaeloriWeapon(ctx, accent, 0.24, 0.58, 0.016);
  vaeloriWeapon(ctx, accent, 0.76, 0.58, 0.016);

  // Single large engine
  vaeloriEngine(ctx, 0.50, 0.80, 0.035);
}


/**
 * BATTLESHIP — A walking cathedral. Dense spire forest, triple engine rings,
 * massive central focus, weapon octahedra bristling from every spar.
 * Geometry is overwhelming — meant to awe, not merely destroy.
 */
function vaeloriBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — massive faceted octagonal geode
  ctx.beginPath();
  ctx.moveTo(0.50, 0.02);        // bow apex
  ctx.lineTo(0.30, 0.14);        // port bow
  ctx.lineTo(0.18, 0.32);        // upper port beam
  ctx.lineTo(0.16, 0.52);        // lower port beam
  ctx.lineTo(0.22, 0.72);        // port quarter
  ctx.lineTo(0.38, 0.88);        // port stern
  ctx.lineTo(0.50, 0.94);        // stern apex
  ctx.lineTo(0.62, 0.88);        // starboard stern
  ctx.lineTo(0.78, 0.72);        // starboard quarter
  ctx.lineTo(0.84, 0.52);        // lower starboard beam
  ctx.lineTo(0.82, 0.32);        // upper starboard beam
  ctx.lineTo(0.70, 0.14);        // starboard bow
  ctx.closePath();
  vaeloriFill(ctx, accent);

  // Flanking geode outcrops — subsidiary crystal masses
  ctx.beginPath();
  ctx.moveTo(0.18, 0.38); ctx.lineTo(0.08, 0.44);
  ctx.lineTo(0.06, 0.54); ctx.lineTo(0.10, 0.62);
  ctx.lineTo(0.16, 0.58);
  ctx.closePath();
  vaeloriFill(ctx, accent);
  ctx.beginPath();
  ctx.moveTo(0.82, 0.38); ctx.lineTo(0.92, 0.44);
  ctx.lineTo(0.94, 0.54); ctx.lineTo(0.90, 0.62);
  ctx.lineTo(0.84, 0.58);
  ctx.closePath();
  vaeloriFill(ctx, accent);

  // Dense internal lattice — cathedral ribbing
  vaeloriLattice(ctx, accent, [
    [0.50, 0.08, 0.50, 0.88],    // central nave
    [0.20, 0.42, 0.80, 0.42],    // upper transept
    [0.22, 0.62, 0.78, 0.62],    // lower transept
    [0.50, 0.02, 0.16, 0.52],    // port buttress
    [0.50, 0.02, 0.84, 0.52],    // starboard buttress
    [0.50, 0.94, 0.16, 0.52],    // port keel buttress
    [0.50, 0.94, 0.84, 0.52],    // starboard keel buttress
    [0.30, 0.14, 0.78, 0.72],    // long diagonal 1
    [0.70, 0.14, 0.22, 0.72],    // long diagonal 2
    [0.30, 0.42, 0.50, 0.20],    // inner rib port bow
    [0.70, 0.42, 0.50, 0.20],    // inner rib starboard bow
    [0.30, 0.62, 0.50, 0.80],    // inner rib port stern
    [0.70, 0.62, 0.50, 0.80],    // inner rib starboard stern
  ]);

  // Many lattice nodes
  vaeloriNode(ctx, accent, 0.50, 0.42, 0.010);
  vaeloriNode(ctx, accent, 0.50, 0.62, 0.008);
  vaeloriNode(ctx, accent, 0.36, 0.28, 0.007);
  vaeloriNode(ctx, accent, 0.64, 0.28, 0.007);
  vaeloriNode(ctx, accent, 0.34, 0.52, 0.007);
  vaeloriNode(ctx, accent, 0.66, 0.52, 0.007);
  vaeloriNode(ctx, accent, 0.38, 0.72, 0.006);
  vaeloriNode(ctx, accent, 0.62, 0.72, 0.006);
  // Outcrop nodes
  vaeloriNode(ctx, accent, 0.10, 0.50, 0.006);
  vaeloriNode(ctx, accent, 0.90, 0.50, 0.006);

  // Spire forest — seven spires in cathedral crown
  vaeloriSpire(ctx, accent, 0.50, 0.12, 0.50, 0.02, 0.022);
  vaeloriSpire(ctx, accent, 0.38, 0.18, 0.36, 0.06, 0.018);
  vaeloriSpire(ctx, accent, 0.62, 0.18, 0.64, 0.06, 0.018);
  vaeloriSpire(ctx, accent, 0.28, 0.26, 0.26, 0.14, 0.015);
  vaeloriSpire(ctx, accent, 0.72, 0.26, 0.74, 0.14, 0.015);
  vaeloriSpire(ctx, accent, 0.22, 0.36, 0.20, 0.26, 0.012);
  vaeloriSpire(ctx, accent, 0.78, 0.36, 0.80, 0.26, 0.012);

  // Massive psionic focus
  vaeloriFocus(ctx, accent, 0.50, 0.48, 0.065);

  // Six weapon hardpoints — bristling from spar tips
  vaeloriWeapon(ctx, accent, 0.30, 0.24, 0.020);
  vaeloriWeapon(ctx, accent, 0.70, 0.24, 0.020);
  vaeloriWeapon(ctx, accent, 0.20, 0.48, 0.018);
  vaeloriWeapon(ctx, accent, 0.80, 0.48, 0.018);
  vaeloriWeapon(ctx, accent, 0.26, 0.66, 0.016);
  vaeloriWeapon(ctx, accent, 0.74, 0.66, 0.016);

  // Triple engine rings
  vaeloriEngine(ctx, 0.38, 0.90, 0.030);
  vaeloriEngine(ctx, 0.50, 0.92, 0.025);
  vaeloriEngine(ctx, 0.62, 0.90, 0.030);
  // Outer resonance halos
  ctx.beginPath();
  ctx.arc(0.50, 0.90, 0.16, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.15);
  ctx.lineWidth = 0.003;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.50, 0.90, 0.20, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.08);
  ctx.lineWidth = 0.002;
  ctx.stroke();
}


/**
 * COLONISER — An enormous geode egg: smooth, protective, thickest shell
 * and warmest internal glow. Spires fold inward, sheltering the seed-
 * crystals of a new colony. The interior glows with nursery warmth.
 */
function vaeloriColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Outer shell — large, smooth geode egg (many segments for roundness)
  geodePath(ctx, 0.50, 0.46, 0.30, 0.36, 14, 0.025, -HALF_PI);
  vaeloriFill(ctx, accent);

  // Thick shell indicator — second slightly smaller shell outline
  geodePath(ctx, 0.50, 0.46, 0.26, 0.32, 14, 0.025, -HALF_PI);
  ctx.strokeStyle = withAlpha(accent, 0.20);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Inner nursery glow — warm, suffusing the interior
  const nursery = ctx.createRadialGradient(0.50, 0.44, 0, 0.50, 0.44, 0.22);
  nursery.addColorStop(0,   'rgba(220,200,255,0.35)');
  nursery.addColorStop(0.3, withAlpha(accent, 0.20));
  nursery.addColorStop(0.7, withAlpha(accent, 0.06));
  nursery.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.ellipse(0.50, 0.44, 0.20, 0.26, 0, 0, Math.PI * 2);
  ctx.fillStyle = nursery;
  ctx.fill();

  // Shell facet lines — thick mineral layers visible
  vaeloriLattice(ctx, accent, [
    [0.50, 0.10, 0.50, 0.82],    // vertical spine
    [0.24, 0.46, 0.76, 0.46],    // horizontal equator
    [0.32, 0.22, 0.68, 0.70],    // diagonal 1
    [0.68, 0.22, 0.32, 0.70],    // diagonal 2
    [0.50, 0.10, 0.24, 0.46],    // port upper rib
    [0.50, 0.10, 0.76, 0.46],    // starboard upper rib
  ]);

  // Inward-folded spires — three short spires pointing INTO the egg
  // (drawn as downward-pointing triangles from the shell inward)
  vaeloriSpire(ctx, accent, 0.50, 0.20, 0.50, 0.12, 0.024);
  vaeloriSpire(ctx, accent, 0.38, 0.28, 0.40, 0.20, 0.018);
  vaeloriSpire(ctx, accent, 0.62, 0.28, 0.60, 0.20, 0.018);

  // Focus — large and warm, the colony seed
  vaeloriFocus(ctx, accent, 0.50, 0.44, 0.055);

  // Habitat ring — the crystalline cradle for seed-crystals
  ctx.beginPath();
  ctx.ellipse(0.50, 0.44, 0.16, 0.20, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.006;
  ctx.stroke();

  // Single large engine ring
  vaeloriEngine(ctx, 0.50, 0.80, 0.035);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS — for integration into ShipDesignFamilies.ts

// ===========================================================================
//  SYLVANI
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — Ship Designer Profiles
// ═══════════════════════════════════════════════════════════════════════════════
//
// All functions operate in 1x1 normalised space. Nose faces UP.
// Fore y ~ 0.06-0.10, engines y ~ 0.80-0.92.
// Each ship has a distinct silhouette derived from the Sylvani arboreal theme.


// ── Sylvani-specific drawing helpers ──────────────────────────────────────────

/** Chlorophyll engine glow — warm green with white-hot core. */
function sylvaniEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Outer bloom — diffuse spore-dust haze
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  bloom.addColorStop(0,   'rgba(120,255,100,0.55)');
  bloom.addColorStop(0.4, 'rgba(60,200,50,0.25)');
  bloom.addColorStop(0.7, 'rgba(30,120,20,0.08)');
  bloom.addColorStop(1,   'rgba(10,80,10,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-hot metabolic reaction
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(240,255,230,1)');
  core.addColorStop(0.3, 'rgba(140,255,100,0.9)');
  core.addColorStop(0.7, 'rgba(50,180,40,0.4)');
  core.addColorStop(1,   'rgba(20,100,20,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Heartwood hull fill — dark green-brown gradient with bark texture lines. */
function sylvaniFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.08, 0.7, 0.92);
  grad.addColorStop(0,   '#3a5a32');  // lighter heartwood at bow
  grad.addColorStop(0.3, '#2a4a28');  // mid trunk
  grad.addColorStop(0.7, '#1e3a1c');  // denser heartwood aft
  grad.addColorStop(1,   '#142a12');  // dark root-zone
  ctx.fillStyle = grad;
  ctx.fill();
  // Bark edge — accent-tinted outline
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

/** Growth-ring panel lines — concentric arcs suggesting annual growth. */
function growthRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, maxR: number, count: number): void {
  ctx.strokeStyle = 'rgba(80,120,60,0.18)';
  ctx.lineWidth = 0.003;
  for (let i = 1; i <= count; i++) {
    const r = maxR * (i / count);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Spore pod — bioluminescent weapon nodule. */
function sporePod(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string): void {
  // Pod body
  const podGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
  podGrad.addColorStop(0,   withAlpha(accent, 0.7));
  podGrad.addColorStop(0.5, withAlpha(accent, 0.4));
  podGrad.addColorStop(1,   'rgba(30,60,20,0.3)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = podGrad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

/** Sensory frond — small forward-pointing tendril at the bow. */
function sensoryFrond(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, accent: string): void {
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const midX = (x1 + x2) * 0.5;
  const midY = (y1 + y2) * 0.5 - 0.02;
  ctx.quadraticCurveTo(midX, midY, x2, y2);
  ctx.stroke();
  // Tiny glow at tip
  const tipGlow = ctx.createRadialGradient(x2, y2, 0, x2, y2, 0.012);
  tipGlow.addColorStop(0, withAlpha(accent, 0.6));
  tipGlow.addColorStop(1, withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(x2, y2, 0.012, 0, Math.PI * 2);
  ctx.fillStyle = tipGlow;
  ctx.fill();
}

/** Root tendril — tapered line trailing aftward. */
function rootTendril(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, thickness: number): void {
  ctx.strokeStyle = 'rgba(50,90,35,0.5)';
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const ctrlX = (x1 + x2) * 0.5 + (x2 - x1) * 0.3;
  const ctrlY = (y1 + y2) * 0.5;
  ctx.quadraticCurveTo(ctrlX, ctrlY, x2, y2);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Sap-line vein — thin luminous trace along the hull. */
function sapVein(ctx: CanvasRenderingContext2D, points: [number, number][], accent: string): void {
  if (points.length < 2) return;
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCOUT — Wind-blown seed
// ═══════════════════════════════════════════════════════════════════════════════
// Silhouette: slender teardrop with two trailing root-filaments.
// Minimal mass, darting movement. A single sensory frond at the bow.

function sylvaniScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — narrow seed shape
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.42, 0.14, 0.37, 0.28, 0.36, 0.42);
  ctx.bezierCurveTo(0.35, 0.55, 0.38, 0.66, 0.43, 0.74);
  ctx.bezierCurveTo(0.46, 0.78, 0.50, 0.80, 0.50, 0.80);
  ctx.bezierCurveTo(0.50, 0.80, 0.54, 0.78, 0.57, 0.74);
  ctx.bezierCurveTo(0.62, 0.66, 0.65, 0.55, 0.64, 0.42);
  ctx.bezierCurveTo(0.63, 0.28, 0.58, 0.14, 0.50, 0.08);
  ctx.closePath();
  sylvaniFill(ctx, accent);

  // Growth rings — subtle internal texture
  growthRings(ctx, 0.50, 0.44, 0.10, 3);

  // Dorsal ridge — central spine
  ctx.strokeStyle = 'rgba(60,100,45,0.35)';
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.lineTo(0.50, 0.76);
  ctx.stroke();

  // Sensory fronds at bow
  sensoryFrond(ctx, 0.47, 0.12, 0.42, 0.04, accent);
  sensoryFrond(ctx, 0.50, 0.10, 0.50, 0.02, accent);
  sensoryFrond(ctx, 0.53, 0.12, 0.58, 0.04, accent);

  // Root-tendril engines — two trailing filaments
  rootTendril(ctx, 0.44, 0.76, 0.38, 0.96, 0.006);
  rootTendril(ctx, 0.56, 0.76, 0.62, 0.96, 0.006);
  rootTendril(ctx, 0.50, 0.80, 0.50, 0.98, 0.005);

  // Engine glow
  sylvaniEngineGlow(ctx, 0.50, 0.79, 0.030);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DESTROYER — Germinated seedling
// ═══════════════════════════════════════════════════════════════════════════════
// Silhouette: longer seed with lateral membrane fins and paired spore pods.
// The first ship class that looks like it has truly taken root.

function sylvaniDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — elongated seed
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.41, 0.11, 0.34, 0.24, 0.32, 0.40);
  ctx.bezierCurveTo(0.31, 0.54, 0.34, 0.66, 0.40, 0.76);
  ctx.bezierCurveTo(0.44, 0.82, 0.48, 0.84, 0.50, 0.85);
  ctx.bezierCurveTo(0.52, 0.84, 0.56, 0.82, 0.60, 0.76);
  ctx.bezierCurveTo(0.66, 0.66, 0.69, 0.54, 0.68, 0.40);
  ctx.bezierCurveTo(0.66, 0.24, 0.59, 0.11, 0.50, 0.06);
  ctx.closePath();
  sylvaniFill(ctx, accent);

  // Growth rings
  growthRings(ctx, 0.50, 0.42, 0.13, 4);

  // Dorsal ridge
  ctx.strokeStyle = 'rgba(60,100,45,0.35)';
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.50, 0.80);
  ctx.stroke();

  // Lateral membrane sails — thin leaf-like fins
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.beginPath();
  ctx.moveTo(0.32, 0.36);
  ctx.bezierCurveTo(0.22, 0.34, 0.16, 0.42, 0.18, 0.54);
  ctx.bezierCurveTo(0.20, 0.62, 0.28, 0.64, 0.32, 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.beginPath();
  ctx.moveTo(0.68, 0.36);
  ctx.bezierCurveTo(0.78, 0.34, 0.84, 0.42, 0.82, 0.54);
  ctx.bezierCurveTo(0.80, 0.62, 0.72, 0.64, 0.68, 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Membrane vein lines
  sapVein(ctx, [[0.30, 0.42], [0.22, 0.46], [0.19, 0.52]], accent);
  sapVein(ctx, [[0.70, 0.42], [0.78, 0.46], [0.81, 0.52]], accent);

  // Spore pods — paired forward weapons
  sporePod(ctx, 0.39, 0.24, 0.025, accent);
  sporePod(ctx, 0.61, 0.24, 0.025, accent);

  // Sensory fronds
  sensoryFrond(ctx, 0.46, 0.10, 0.40, 0.02, accent);
  sensoryFrond(ctx, 0.50, 0.08, 0.50, 0.00, accent);
  sensoryFrond(ctx, 0.54, 0.10, 0.60, 0.02, accent);

  // Root-tendril engines — four trailing roots
  rootTendril(ctx, 0.42, 0.80, 0.34, 0.96, 0.007);
  rootTendril(ctx, 0.48, 0.84, 0.44, 0.98, 0.005);
  rootTendril(ctx, 0.52, 0.84, 0.56, 0.98, 0.005);
  rootTendril(ctx, 0.58, 0.80, 0.66, 0.96, 0.007);

  // Engine glows
  sylvaniEngineGlow(ctx, 0.44, 0.83, 0.030);
  sylvaniEngineGlow(ctx, 0.56, 0.83, 0.030);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSPORT — Bloated seed pod
// ═══════════════════════════════════════════════════════════════════════════════
// Silhouette: wide, round hull — a seed swollen with nutrients for a new
// colony. Broad membrane fins for passive solar absorption during long
// interstellar voyages. Minimal weaponry.

function sylvaniTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — fat ovoid seed pod
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.38, 0.14, 0.26, 0.28, 0.24, 0.46);
  ctx.bezierCurveTo(0.22, 0.60, 0.28, 0.72, 0.38, 0.80);
  ctx.bezierCurveTo(0.44, 0.84, 0.48, 0.86, 0.50, 0.86);
  ctx.bezierCurveTo(0.52, 0.86, 0.56, 0.84, 0.62, 0.80);
  ctx.bezierCurveTo(0.72, 0.72, 0.78, 0.60, 0.76, 0.46);
  ctx.bezierCurveTo(0.74, 0.28, 0.62, 0.14, 0.50, 0.10);
  ctx.closePath();
  sylvaniFill(ctx, accent);

  // Growth rings — large, showing age and capacity
  growthRings(ctx, 0.50, 0.48, 0.18, 5);

  // Dorsal ridge
  ctx.strokeStyle = 'rgba(60,100,45,0.3)';
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.16);
  ctx.lineTo(0.50, 0.82);
  ctx.stroke();

  // Broad membrane sails — wide leaves for long voyages
  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.beginPath();
  ctx.moveTo(0.24, 0.38);
  ctx.bezierCurveTo(0.12, 0.36, 0.06, 0.46, 0.08, 0.58);
  ctx.bezierCurveTo(0.10, 0.68, 0.18, 0.72, 0.24, 0.64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.beginPath();
  ctx.moveTo(0.76, 0.38);
  ctx.bezierCurveTo(0.88, 0.36, 0.94, 0.46, 0.92, 0.58);
  ctx.bezierCurveTo(0.90, 0.68, 0.82, 0.72, 0.76, 0.64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Membrane vein networks
  sapVein(ctx, [[0.24, 0.44], [0.16, 0.48], [0.10, 0.54]], accent);
  sapVein(ctx, [[0.24, 0.52], [0.14, 0.58], [0.10, 0.62]], accent);
  sapVein(ctx, [[0.76, 0.44], [0.84, 0.48], [0.90, 0.54]], accent);
  sapVein(ctx, [[0.76, 0.52], [0.86, 0.58], [0.90, 0.62]], accent);

  // Nutrient glow — warm interior showing the cargo of biological material
  const nutrientGlow = ctx.createRadialGradient(0.50, 0.48, 0, 0.50, 0.48, 0.16);
  nutrientGlow.addColorStop(0, withAlpha(accent, 0.30));
  nutrientGlow.addColorStop(0.6, withAlpha(accent, 0.10));
  nutrientGlow.addColorStop(1, withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.16, 0, Math.PI * 2);
  ctx.fillStyle = nutrientGlow;
  ctx.fill();

  // Sensory fronds — minimal, transport does not need acute senses
  sensoryFrond(ctx, 0.48, 0.13, 0.44, 0.05, accent);
  sensoryFrond(ctx, 0.52, 0.13, 0.56, 0.05, accent);

  // Root-tendril engines — spread wide for stability
  rootTendril(ctx, 0.40, 0.82, 0.30, 0.96, 0.008);
  rootTendril(ctx, 0.48, 0.85, 0.44, 0.98, 0.006);
  rootTendril(ctx, 0.52, 0.85, 0.56, 0.98, 0.006);
  rootTendril(ctx, 0.60, 0.82, 0.70, 0.96, 0.008);

  // Engine glows
  sylvaniEngineGlow(ctx, 0.44, 0.84, 0.032);
  sylvaniEngineGlow(ctx, 0.56, 0.84, 0.032);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CRUISER — Young tree
// ═══════════════════════════════════════════════════════════════════════════════
// Silhouette: the seed has grown into something that reads as a tree in space.
// Thick trunk, visible dorsal ridge, lateral branch stubs carrying spore pod
// clusters, and a proper root engine array. Multiple growth-ring panel lines.

function sylvaniCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — thick trunk shape
  ctx.beginPath();
  ctx.moveTo(0.50, 0.07);
  ctx.bezierCurveTo(0.40, 0.12, 0.30, 0.26, 0.28, 0.42);
  ctx.bezierCurveTo(0.26, 0.56, 0.30, 0.68, 0.38, 0.78);
  ctx.bezierCurveTo(0.42, 0.84, 0.46, 0.87, 0.50, 0.88);
  ctx.bezierCurveTo(0.54, 0.87, 0.58, 0.84, 0.62, 0.78);
  ctx.bezierCurveTo(0.70, 0.68, 0.74, 0.56, 0.72, 0.42);
  ctx.bezierCurveTo(0.70, 0.26, 0.60, 0.12, 0.50, 0.07);
  ctx.closePath();
  sylvaniFill(ctx, accent);

  // Growth rings — many, showing maturity
  growthRings(ctx, 0.50, 0.44, 0.16, 6);

  // Dorsal ridge — prominent bark spine
  ctx.strokeStyle = 'rgba(50,90,40,0.4)';
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.50, 0.84);
  ctx.stroke();

  // Sap-line veins along hull
  sapVein(ctx, [[0.36, 0.20], [0.32, 0.36], [0.30, 0.52], [0.34, 0.66]], accent);
  sapVein(ctx, [[0.64, 0.20], [0.68, 0.36], [0.70, 0.52], [0.66, 0.66]], accent);

  // Lateral branch stubs — short thick extensions
  ctx.strokeStyle = 'rgba(50,90,35,0.45)';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0.28, 0.42); ctx.lineTo(0.18, 0.40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.72, 0.42); ctx.lineTo(0.82, 0.40);
  ctx.stroke();
  ctx.lineWidth = 0.009;
  ctx.beginPath();
  ctx.moveTo(0.30, 0.56); ctx.lineTo(0.20, 0.58);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.70, 0.56); ctx.lineTo(0.80, 0.58);
  ctx.stroke();

  // Spore pods on branch tips
  sporePod(ctx, 0.17, 0.40, 0.028, accent);
  sporePod(ctx, 0.83, 0.40, 0.028, accent);
  sporePod(ctx, 0.19, 0.58, 0.024, accent);
  sporePod(ctx, 0.81, 0.58, 0.024, accent);

  // Forward spore pods
  sporePod(ctx, 0.40, 0.18, 0.022, accent);
  sporePod(ctx, 0.60, 0.18, 0.022, accent);

  // Photosynthetic membrane patches
  ctx.fillStyle = withAlpha(accent, 0.08);
  ctx.beginPath();
  ctx.ellipse(0.28, 0.48, 0.04, 0.10, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.72, 0.48, 0.04, 0.10, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Sensory fronds
  sensoryFrond(ctx, 0.45, 0.11, 0.38, 0.02, accent);
  sensoryFrond(ctx, 0.50, 0.09, 0.50, 0.00, accent);
  sensoryFrond(ctx, 0.55, 0.11, 0.62, 0.02, accent);
  sensoryFrond(ctx, 0.42, 0.13, 0.34, 0.06, accent);
  sensoryFrond(ctx, 0.58, 0.13, 0.66, 0.06, accent);

  // Root-tendril engine array — five roots
  rootTendril(ctx, 0.40, 0.84, 0.30, 0.96, 0.008);
  rootTendril(ctx, 0.46, 0.87, 0.40, 0.98, 0.006);
  rootTendril(ctx, 0.50, 0.88, 0.50, 0.99, 0.006);
  rootTendril(ctx, 0.54, 0.87, 0.60, 0.98, 0.006);
  rootTendril(ctx, 0.60, 0.84, 0.70, 0.96, 0.008);

  // Engine glows
  sylvaniEngineGlow(ctx, 0.42, 0.86, 0.032);
  sylvaniEngineGlow(ctx, 0.50, 0.88, 0.028);
  sylvaniEngineGlow(ctx, 0.58, 0.86, 0.032);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CARRIER — Spreading canopy
// ═══════════════════════════════════════════════════════════════════════════════
// Silhouette: broad, dome-shaped upper canopy over a thinner trunk.
// The canopy houses launch bays — seed-pods that deploy fighters.
// Trailing root-stalks hang below like aerial roots from a banyan tree.

function sylvaniCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Canopy dome — broad flattened upper hull
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.30, 0.10, 0.14, 0.22, 0.12, 0.36);
  ctx.bezierCurveTo(0.12, 0.44, 0.20, 0.50, 0.34, 0.52);
  ctx.lineTo(0.34, 0.54);
  // Trunk narrows below canopy
  ctx.bezierCurveTo(0.34, 0.64, 0.38, 0.74, 0.44, 0.80);
  ctx.bezierCurveTo(0.47, 0.83, 0.50, 0.84, 0.50, 0.84);
  ctx.bezierCurveTo(0.50, 0.84, 0.53, 0.83, 0.56, 0.80);
  ctx.bezierCurveTo(0.62, 0.74, 0.66, 0.64, 0.66, 0.54);
  ctx.lineTo(0.66, 0.52);
  ctx.bezierCurveTo(0.80, 0.50, 0.88, 0.44, 0.88, 0.36);
  ctx.bezierCurveTo(0.86, 0.22, 0.70, 0.10, 0.50, 0.10);
  ctx.closePath();
  sylvaniFill(ctx, accent);

  // Canopy texture — radial growth rings
  growthRings(ctx, 0.50, 0.32, 0.22, 5);

  // Canopy underside — launch bay slots (horizontal dark lines)
  ctx.strokeStyle = 'rgba(20,50,15,0.4)';
  ctx.lineWidth = 0.004;
  const bayY = [0.46, 0.49, 0.52];
  for (const by of bayY) {
    ctx.beginPath();
    ctx.moveTo(0.22, by);
    ctx.lineTo(0.36, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.64, by);
    ctx.lineTo(0.78, by);
    ctx.stroke();
  }

  // Launch pod glows — seed-fighters emerging
  const podGlow = ctx.createRadialGradient(0.24, 0.49, 0, 0.24, 0.49, 0.018);
  podGlow.addColorStop(0, withAlpha(accent, 0.5));
  podGlow.addColorStop(1, withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.24, 0.49, 0.018, 0, Math.PI * 2);
  ctx.fillStyle = podGlow;
  ctx.fill();

  const podGlow2 = ctx.createRadialGradient(0.76, 0.49, 0, 0.76, 0.49, 0.018);
  podGlow2.addColorStop(0, withAlpha(accent, 0.5));
  podGlow2.addColorStop(1, withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.76, 0.49, 0.018, 0, Math.PI * 2);
  ctx.fillStyle = podGlow2;
  ctx.fill();

  // Dorsal ridge through canopy
  ctx.strokeStyle = 'rgba(50,90,40,0.35)';
  ctx.lineWidth = 0.007;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.lineTo(0.50, 0.80);
  ctx.stroke();

  // Sap veins along canopy
  sapVein(ctx, [[0.50, 0.16], [0.36, 0.24], [0.22, 0.34]], accent);
  sapVein(ctx, [[0.50, 0.16], [0.64, 0.24], [0.78, 0.34]], accent);
  sapVein(ctx, [[0.50, 0.20], [0.40, 0.30], [0.28, 0.42]], accent);
  sapVein(ctx, [[0.50, 0.20], [0.60, 0.30], [0.72, 0.42]], accent);

  // Spore pods — defensive, on canopy edge
  sporePod(ctx, 0.18, 0.34, 0.022, accent);
  sporePod(ctx, 0.82, 0.34, 0.022, accent);
  sporePod(ctx, 0.50, 0.14, 0.020, accent);

  // Sensory fronds — forward-facing from canopy apex
  sensoryFrond(ctx, 0.46, 0.12, 0.38, 0.04, accent);
  sensoryFrond(ctx, 0.50, 0.11, 0.50, 0.02, accent);
  sensoryFrond(ctx, 0.54, 0.12, 0.62, 0.04, accent);

  // Aerial root stalks hanging from canopy — distinctive carrier feature
  ctx.strokeStyle = 'rgba(50,85,35,0.35)';
  ctx.lineWidth = 0.006;
  const rootX = [0.22, 0.32, 0.42, 0.58, 0.68, 0.78];
  for (const rx of rootX) {
    ctx.beginPath();
    ctx.moveTo(rx, 0.52);
    ctx.bezierCurveTo(rx - 0.01, 0.62, rx + 0.01, 0.72, rx - 0.02, 0.80);
    ctx.stroke();
  }

  // Main root-tendril engines
  rootTendril(ctx, 0.42, 0.82, 0.34, 0.96, 0.008);
  rootTendril(ctx, 0.50, 0.84, 0.50, 0.98, 0.007);
  rootTendril(ctx, 0.58, 0.82, 0.66, 0.96, 0.008);

  // Engine glows
  sylvaniEngineGlow(ctx, 0.42, 0.82, 0.028);
  sylvaniEngineGlow(ctx, 0.58, 0.82, 0.028);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BATTLESHIP — Ancient world-tree
// ═══════════════════════════════════════════════════════════════════════════════
// Silhouette: massive, gnarled trunk with thick lateral branch-arms carrying
// weapon clusters. A crown of sensory fronds at the bow. An enormous root
// engine array at the stern spreading wide. Visible sap-line veins trace the
// hull. Dorsal spine-thorns suggest mycelial lance conduits. This is what
// happens when the Sylvani network gets angry — and when a Sylvani gets angry,
// it is catastrophic and surprising.

function sylvaniBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — massive gnarled trunk
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.38, 0.10, 0.24, 0.22, 0.20, 0.38);
  ctx.bezierCurveTo(0.18, 0.52, 0.22, 0.66, 0.30, 0.76);
  ctx.bezierCurveTo(0.36, 0.84, 0.42, 0.88, 0.50, 0.90);
  ctx.bezierCurveTo(0.58, 0.88, 0.64, 0.84, 0.70, 0.76);
  ctx.bezierCurveTo(0.78, 0.66, 0.82, 0.52, 0.80, 0.38);
  ctx.bezierCurveTo(0.76, 0.22, 0.62, 0.10, 0.50, 0.06);
  ctx.closePath();
  sylvaniFill(ctx, accent);

  // Growth rings — ancient, many layers
  growthRings(ctx, 0.50, 0.44, 0.22, 8);

  // Dorsal ridge — heavy bark spine
  ctx.strokeStyle = 'rgba(45,80,35,0.5)';
  ctx.lineWidth = 0.010;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.50, 0.86);
  ctx.stroke();

  // Dorsal spine-thorns — mycelial lance conduits
  ctx.fillStyle = 'rgba(60,100,45,0.5)';
  const spineY = [0.20, 0.30, 0.40, 0.50, 0.60];
  for (const sy of spineY) {
    ctx.beginPath();
    ctx.moveTo(0.50, sy - 0.04);
    ctx.lineTo(0.475, sy + 0.02);
    ctx.lineTo(0.525, sy + 0.02);
    ctx.closePath();
    ctx.fill();
  }

  // Sap-line veins — extensive vascular network
  sapVein(ctx, [[0.36, 0.16], [0.28, 0.28], [0.24, 0.42], [0.26, 0.58], [0.32, 0.72]], accent);
  sapVein(ctx, [[0.64, 0.16], [0.72, 0.28], [0.76, 0.42], [0.74, 0.58], [0.68, 0.72]], accent);
  sapVein(ctx, [[0.42, 0.14], [0.34, 0.30], [0.32, 0.50]], accent);
  sapVein(ctx, [[0.58, 0.14], [0.66, 0.30], [0.68, 0.50]], accent);

  // Lateral branch-arms — thick, weapon-bearing
  ctx.strokeStyle = 'rgba(45,80,30,0.5)';
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(0.22, 0.36);
  ctx.bezierCurveTo(0.14, 0.34, 0.10, 0.36, 0.08, 0.38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.78, 0.36);
  ctx.bezierCurveTo(0.86, 0.34, 0.90, 0.36, 0.92, 0.38);
  ctx.stroke();
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0.22, 0.54);
  ctx.bezierCurveTo(0.14, 0.52, 0.10, 0.54, 0.08, 0.56);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.78, 0.54);
  ctx.bezierCurveTo(0.86, 0.52, 0.90, 0.54, 0.92, 0.56);
  ctx.stroke();
  ctx.lineWidth = 0.010;
  ctx.beginPath();
  ctx.moveTo(0.26, 0.68);
  ctx.bezierCurveTo(0.18, 0.68, 0.14, 0.70, 0.12, 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.74, 0.68);
  ctx.bezierCurveTo(0.82, 0.68, 0.86, 0.70, 0.88, 0.72);
  ctx.stroke();

  // Spore pods — many, on branch tips and hull
  sporePod(ctx, 0.07, 0.38, 0.030, accent);
  sporePod(ctx, 0.93, 0.38, 0.030, accent);
  sporePod(ctx, 0.07, 0.56, 0.026, accent);
  sporePod(ctx, 0.93, 0.56, 0.026, accent);
  sporePod(ctx, 0.11, 0.72, 0.024, accent);
  sporePod(ctx, 0.89, 0.72, 0.024, accent);
  // Forward spore pods
  sporePod(ctx, 0.36, 0.16, 0.024, accent);
  sporePod(ctx, 0.64, 0.16, 0.024, accent);

  // Bioluminescent patches — sap pools along the hull
  const glowSpots: [number, number][] = [
    [0.38, 0.32], [0.62, 0.32],
    [0.34, 0.50], [0.66, 0.50],
    [0.40, 0.66], [0.60, 0.66],
    [0.50, 0.76],
  ];
  for (const [gx, gy] of glowSpots) {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 0.025);
    g.addColorStop(0, withAlpha(accent, 0.45));
    g.addColorStop(1, withAlpha(accent, 0));
    ctx.beginPath();
    ctx.arc(gx, gy, 0.025, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Crown of sensory fronds — wide fan
  sensoryFrond(ctx, 0.42, 0.10, 0.30, 0.02, accent);
  sensoryFrond(ctx, 0.46, 0.09, 0.36, 0.00, accent);
  sensoryFrond(ctx, 0.50, 0.08, 0.50, -0.01, accent);
  sensoryFrond(ctx, 0.54, 0.09, 0.64, 0.00, accent);
  sensoryFrond(ctx, 0.58, 0.10, 0.70, 0.02, accent);

  // Massive root-tendril engine array — world-tree roots
  rootTendril(ctx, 0.34, 0.84, 0.20, 0.96, 0.010);
  rootTendril(ctx, 0.40, 0.87, 0.30, 0.98, 0.008);
  rootTendril(ctx, 0.46, 0.89, 0.40, 0.99, 0.006);
  rootTendril(ctx, 0.50, 0.90, 0.50, 1.00, 0.006);
  rootTendril(ctx, 0.54, 0.89, 0.60, 0.99, 0.006);
  rootTendril(ctx, 0.60, 0.87, 0.70, 0.98, 0.008);
  rootTendril(ctx, 0.66, 0.84, 0.80, 0.96, 0.010);

  // Engine glows — multiple reaction cores
  sylvaniEngineGlow(ctx, 0.38, 0.87, 0.035);
  sylvaniEngineGlow(ctx, 0.50, 0.90, 0.030);
  sylvaniEngineGlow(ctx, 0.62, 0.87, 0.035);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COLONISER — Great seed of the network
// ═══════════════════════════════════════════════════════════════════════════════
// Silhouette: elongated, elegant seed shape — this is the Sylvani's most
// sacred vessel type. It carries a fragment of the mycelial network itself,
// destined to root on a new world. The hull is visibly pregnant with life:
// a warm interior glow, thick bark plating, and trailing root-umbilicals
// that will become the new colony's first anchors.

function sylvaniColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — large elongated seed
  ctx.beginPath();
  ctx.moveTo(0.50, 0.07);
  ctx.bezierCurveTo(0.40, 0.12, 0.30, 0.24, 0.28, 0.40);
  ctx.bezierCurveTo(0.26, 0.54, 0.28, 0.66, 0.34, 0.76);
  ctx.bezierCurveTo(0.38, 0.82, 0.44, 0.86, 0.50, 0.88);
  ctx.bezierCurveTo(0.56, 0.86, 0.62, 0.82, 0.66, 0.76);
  ctx.bezierCurveTo(0.72, 0.66, 0.74, 0.54, 0.72, 0.40);
  ctx.bezierCurveTo(0.70, 0.24, 0.60, 0.12, 0.50, 0.07);
  ctx.closePath();
  sylvaniFill(ctx, accent);

  // Growth rings — extensive, ancient vessel
  growthRings(ctx, 0.50, 0.46, 0.18, 7);

  // Dorsal ridge
  ctx.strokeStyle = 'rgba(50,90,40,0.4)';
  ctx.lineWidth = 0.007;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.lineTo(0.50, 0.84);
  ctx.stroke();

  // Living interior glow — the network fragment within
  const lifeGlow = ctx.createRadialGradient(0.50, 0.46, 0, 0.50, 0.46, 0.20);
  lifeGlow.addColorStop(0,   withAlpha(accent, 0.50));
  lifeGlow.addColorStop(0.3, withAlpha(accent, 0.30));
  lifeGlow.addColorStop(0.6, withAlpha(accent, 0.12));
  lifeGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.46, 0.20, 0, Math.PI * 2);
  ctx.fillStyle = lifeGlow;
  ctx.fill();

  // Internal mycelial network — visible thread-lines within the glow
  ctx.strokeStyle = withAlpha(accent, 0.20);
  ctx.lineWidth = 0.002;
  // Branching pattern from centre
  const branches: [number, number, number, number][] = [
    [0.50, 0.46, 0.38, 0.34], [0.50, 0.46, 0.62, 0.34],
    [0.50, 0.46, 0.36, 0.54], [0.50, 0.46, 0.64, 0.54],
    [0.50, 0.46, 0.42, 0.62], [0.50, 0.46, 0.58, 0.62],
    [0.50, 0.46, 0.50, 0.30], [0.50, 0.46, 0.50, 0.62],
  ];
  for (const [x1, y1, x2, y2] of branches) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 0.02;
    const my = (y1 + y2) / 2;
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.stroke();
  }

  // Sap veins along hull
  sapVein(ctx, [[0.38, 0.18], [0.32, 0.34], [0.30, 0.50], [0.34, 0.66]], accent);
  sapVein(ctx, [[0.62, 0.18], [0.68, 0.34], [0.70, 0.50], [0.66, 0.66]], accent);

  // Bark plating — thick protective patches
  ctx.strokeStyle = 'rgba(45,75,30,0.3)';
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.ellipse(0.36, 0.38, 0.04, 0.08, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.64, 0.38, 0.04, 0.08, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.34, 0.56, 0.035, 0.07, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.66, 0.56, 0.035, 0.07, 0.15, 0, Math.PI * 2);
  ctx.stroke();

  // Sensory fronds — gentle, navigational
  sensoryFrond(ctx, 0.46, 0.11, 0.40, 0.03, accent);
  sensoryFrond(ctx, 0.50, 0.09, 0.50, 0.01, accent);
  sensoryFrond(ctx, 0.54, 0.11, 0.60, 0.03, accent);

  // Root-umbilical engines — these will become the colony's first roots
  rootTendril(ctx, 0.38, 0.84, 0.26, 0.96, 0.009);
  rootTendril(ctx, 0.44, 0.86, 0.36, 0.98, 0.007);
  rootTendril(ctx, 0.50, 0.88, 0.50, 1.00, 0.007);
  rootTendril(ctx, 0.56, 0.86, 0.64, 0.98, 0.007);
  rootTendril(ctx, 0.62, 0.84, 0.74, 0.96, 0.009);

  // Engine glows — warm, steady, patient
  sylvaniEngineGlow(ctx, 0.40, 0.85, 0.032);
  sylvaniEngineGlow(ctx, 0.50, 0.88, 0.028);
  sylvaniEngineGlow(ctx, 0.60, 0.85, 0.032);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS — for integration into ShipModels3D.ts and ShipDesignFamilies.ts

// ===========================================================================
//  NEXARI
// ===========================================================================

//  SECTION 4: 2D WIREFRAME FUNCTIONS (Ship Designer)
// ============================================================================

/**
 * Nexari 2D ship wireframes for the ship designer.
 *
 * All functions operate in normalised 1x1 coordinate space, nose-UP.
 * The visual language mirrors the 3D: octahedral nodes (drawn as diamonds),
 * linking struts (thin lines), torus drive rings (ellipses), and cone
 * weapon emitters (narrow triangles pointing up).
 *
 * Colour palette: dark gunmetal body, cool blue (#0099ff) accent for data
 * conduits and node highlights, white-blue engine glow.
 */


// ── Nexari-specific drawing primitives ─────────────────────────────────────

/** Draw a diamond (octahedron cross-section) — the processing core motif. */
function nexariNode(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  halfW: number, halfH: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);          // top
  ctx.lineTo(cx + halfW, cy);           // right
  ctx.lineTo(cx, cy + halfH);           // bottom
  ctx.lineTo(cx - halfW, cy);           // left
  ctx.closePath();
  nexariFill(ctx, accent);
  // Inner glow dot — data activity
  ctx.beginPath();
  ctx.arc(cx, cy, halfW * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.6);
  ctx.fill();
}

/** Dark gunmetal fill with accent edge highlight. */
function nexariFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#3e4450');
  grad.addColorStop(0.5, '#2a2e38');
  grad.addColorStop(1,   '#1a1d24');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.006;
  ctx.stroke();
}

/** Data conduit — thin glowing line between two points. */
function nexariStrut(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.stroke();
  // Brighter core line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = withAlpha(accent, 0.7);
  ctx.lineWidth = 0.002;
  ctx.stroke();
}

/** Field-drive ring — ellipse at the aft. */
function nexariDriveRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.008;
  ctx.stroke();
  // Inner glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  glow.addColorStop(0,   'rgba(0,153,255,0.3)');
  glow.addColorStop(0.6, 'rgba(0,100,220,0.1)');
  glow.addColorStop(1,   'rgba(0,60,150,0)');
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
}

/** Engine glow — cool blue-white radial bloom. */
function nexariEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  r: number,
): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(140,200,255,0.65)');
  bloom.addColorStop(0.5, 'rgba(60,130,255,0.25)');
  bloom.addColorStop(1,   'rgba(20,50,200,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(230,240,255,1)');
  core.addColorStop(0.4, 'rgba(120,170,255,0.85)');
  core.addColorStop(1,   'rgba(40,70,220,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Weapon emitter — narrow upward-pointing triangle. */
function nexariWeaponCone(
  ctx: CanvasRenderingContext2D,
  cx: number, tipY: number,
  halfW: number, height: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.lineTo(cx + halfW, tipY + height);
  ctx.lineTo(cx - halfW, tipY + height);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.3);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}


// ── The Seven Hull Classes ─────────────────────────────────────────────────

/**
 * SCOUT — "A lone thought sent into the void."
 *
 * Single central core, one forward sensor node, minimal struts.
 * The smallest expression of the lattice — a single mind on a mission.
 */
function nexariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Central processing core
  nexariNode(ctx, 0.50, 0.42, 0.10, 0.14, accent);
  // Forward sensor node (small)
  nexariNode(ctx, 0.50, 0.18, 0.04, 0.06, accent);
  // Linking strut
  nexariStrut(ctx, 0.50, 0.28, 0.50, 0.36, accent);
  // Aft drive ring
  nexariDriveRing(ctx, 0.50, 0.72, 0.08, 0.03, accent);
  // Aft strut
  nexariStrut(ctx, 0.50, 0.56, 0.50, 0.69, accent);
  // Engine glow
  nexariEngineGlow(ctx, 0.50, 0.75, 0.025);
}

/**
 * DESTROYER — "Two minds arguing strategy."
 *
 * Central core with two flanking lateral cores. Forward weapon emitters.
 * The lattice begins to show its distributed nature.
 */
function nexariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Central processing core
  nexariNode(ctx, 0.50, 0.38, 0.09, 0.12, accent);
  // Forward sensor node
  nexariNode(ctx, 0.50, 0.14, 0.04, 0.06, accent);
  nexariStrut(ctx, 0.50, 0.20, 0.50, 0.26, accent);
  // Lateral cores
  nexariNode(ctx, 0.28, 0.42, 0.06, 0.08, accent);
  nexariNode(ctx, 0.72, 0.42, 0.06, 0.08, accent);
  // Lateral struts
  nexariStrut(ctx, 0.41, 0.38, 0.34, 0.42, accent);
  nexariStrut(ctx, 0.59, 0.38, 0.66, 0.42, accent);
  // Weapon emitters (pair)
  nexariWeaponCone(ctx, 0.38, 0.10, 0.015, 0.06, accent);
  nexariWeaponCone(ctx, 0.62, 0.10, 0.015, 0.06, accent);
  // Aft drive ring
  nexariDriveRing(ctx, 0.50, 0.72, 0.10, 0.035, accent);
  nexariStrut(ctx, 0.50, 0.50, 0.50, 0.685, accent);
  // Engine glows
  nexariEngineGlow(ctx, 0.42, 0.78, 0.022);
  nexariEngineGlow(ctx, 0.58, 0.78, 0.022);
}

/**
 * TRANSPORT — "The Gift, carefully packaged."
 *
 * Wide lattice with four cargo/habitat cores arranged in a grid.
 * Broader than it is tall — a platform for carrying minds between stars.
 */
function nexariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Four cargo cores in a 2x2 grid
  nexariNode(ctx, 0.32, 0.30, 0.08, 0.10, accent);
  nexariNode(ctx, 0.68, 0.30, 0.08, 0.10, accent);
  nexariNode(ctx, 0.32, 0.54, 0.08, 0.10, accent);
  nexariNode(ctx, 0.68, 0.54, 0.08, 0.10, accent);
  // Grid struts — horizontal
  nexariStrut(ctx, 0.40, 0.30, 0.60, 0.30, accent);
  nexariStrut(ctx, 0.40, 0.54, 0.60, 0.54, accent);
  // Grid struts — vertical
  nexariStrut(ctx, 0.32, 0.40, 0.32, 0.44, accent);
  nexariStrut(ctx, 0.68, 0.40, 0.68, 0.44, accent);
  // Forward sensor (small, centred)
  nexariNode(ctx, 0.50, 0.14, 0.035, 0.05, accent);
  nexariStrut(ctx, 0.50, 0.19, 0.50, 0.24, accent);
  // Cross-struts to sensor
  nexariStrut(ctx, 0.40, 0.25, 0.50, 0.19, accent);
  nexariStrut(ctx, 0.60, 0.25, 0.50, 0.19, accent);
  // Aft drive ring (wider)
  nexariDriveRing(ctx, 0.50, 0.76, 0.14, 0.04, accent);
  nexariStrut(ctx, 0.42, 0.64, 0.42, 0.72, accent);
  nexariStrut(ctx, 0.58, 0.64, 0.58, 0.72, accent);
  // Engine glows
  nexariEngineGlow(ctx, 0.38, 0.80, 0.024);
  nexariEngineGlow(ctx, 0.62, 0.80, 0.024);
}

/**
 * CRUISER — "A council of minds reaching consensus."
 *
 * Central core with dorsal, ventral, and lateral cores plus forward
 * weapon cluster. The lattice forms a clear cross pattern.
 */
function nexariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Central processing core (larger)
  nexariNode(ctx, 0.50, 0.40, 0.10, 0.13, accent);
  // Dorsal core
  nexariNode(ctx, 0.50, 0.22, 0.06, 0.08, accent);
  nexariStrut(ctx, 0.50, 0.27, 0.50, 0.30, accent);
  // Lateral cores
  nexariNode(ctx, 0.24, 0.40, 0.06, 0.08, accent);
  nexariNode(ctx, 0.76, 0.40, 0.06, 0.08, accent);
  nexariStrut(ctx, 0.40, 0.40, 0.30, 0.40, accent);
  nexariStrut(ctx, 0.60, 0.40, 0.70, 0.40, accent);
  // Ventral core
  nexariNode(ctx, 0.50, 0.58, 0.06, 0.08, accent);
  nexariStrut(ctx, 0.50, 0.53, 0.50, 0.50, accent);
  // Forward weapon emitters (three)
  nexariWeaponCone(ctx, 0.36, 0.08, 0.014, 0.05, accent);
  nexariWeaponCone(ctx, 0.50, 0.06, 0.016, 0.06, accent);
  nexariWeaponCone(ctx, 0.64, 0.08, 0.014, 0.05, accent);
  // Forward sensor
  nexariNode(ctx, 0.50, 0.12, 0.04, 0.05, accent);
  nexariStrut(ctx, 0.50, 0.17, 0.50, 0.22, accent);
  // Aft drive ring
  nexariDriveRing(ctx, 0.50, 0.76, 0.12, 0.04, accent);
  nexariStrut(ctx, 0.50, 0.66, 0.50, 0.72, accent);
  // Aft secondary ring
  nexariDriveRing(ctx, 0.50, 0.82, 0.08, 0.025, accent);
  // Engine glows
  nexariEngineGlow(ctx, 0.40, 0.84, 0.028);
  nexariEngineGlow(ctx, 0.60, 0.84, 0.028);
}

/**
 * CARRIER — "A constellation that births smaller constellations."
 *
 * Wide lattice platform with six docking bays (dark insets where fighter
 * lattices nest). Central spine with broadcast array ring.
 */
function nexariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Central spine — three cores vertically
  nexariNode(ctx, 0.50, 0.18, 0.07, 0.09, accent);
  nexariNode(ctx, 0.50, 0.44, 0.09, 0.12, accent);
  nexariNode(ctx, 0.50, 0.66, 0.07, 0.09, accent);
  nexariStrut(ctx, 0.50, 0.27, 0.50, 0.32, accent);
  nexariStrut(ctx, 0.50, 0.56, 0.50, 0.57, accent);
  // Lateral launch bay cores (3 per side)
  const bays: [number, number][] = [[0.24, 0.22], [0.24, 0.44], [0.24, 0.64]];
  for (const [bx, by] of bays) {
    // Port side
    nexariNode(ctx, bx, by, 0.05, 0.06, accent);
    nexariStrut(ctx, bx + 0.05, by, 0.43, by + (0.44 - by) * 0.3, accent);
    // Launch bay inset
    ctx.beginPath();
    ctx.rect(bx - 0.04, by + 0.06, 0.08, 0.04);
    ctx.fillStyle = 'rgba(0,20,40,0.5)';
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.3);
    ctx.lineWidth = 0.003;
    ctx.stroke();
    // Starboard mirror
    const mx = 1.0 - bx;
    nexariNode(ctx, mx, by, 0.05, 0.06, accent);
    nexariStrut(ctx, mx - 0.05, by, 0.57, by + (0.44 - by) * 0.3, accent);
    ctx.beginPath();
    ctx.rect(mx - 0.04, by + 0.06, 0.08, 0.04);
    ctx.fillStyle = 'rgba(0,20,40,0.5)';
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.3);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }
  // Broadcast array ring (dorsal)
  nexariDriveRing(ctx, 0.50, 0.14, 0.16, 0.03, accent);
  // Aft drive rings
  nexariDriveRing(ctx, 0.50, 0.80, 0.12, 0.04, accent);
  nexariDriveRing(ctx, 0.50, 0.85, 0.08, 0.025, accent);
  // Engine glows
  nexariEngineGlow(ctx, 0.36, 0.86, 0.026);
  nexariEngineGlow(ctx, 0.50, 0.88, 0.022);
  nexariEngineGlow(ctx, 0.64, 0.86, 0.026);
}

/**
 * BATTLESHIP — "A city of minds at war."
 *
 * Massive lattice: central core surrounded by an outer ring of six cores,
 * heavy weapon arrays, multiple drive rings, the Gift broadcast array
 * prominently visible. The Silence node is subtly present — a slightly
 * larger diamond below centre, offset from the grid.
 */
function nexariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Central primary core (large)
  nexariNode(ctx, 0.50, 0.40, 0.11, 0.14, accent);
  // Outer ring — 6 cores in hexagonal arrangement
  const ringR = 0.22;
  const ringCores: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const nx = 0.50 + Math.cos(angle) * ringR;
    const ny = 0.40 + Math.sin(angle) * ringR * 0.85;
    ringCores.push([nx, ny]);
    nexariNode(ctx, nx, ny, 0.05, 0.065, accent);
    // Radial struts from centre
    nexariStrut(ctx, 0.50 + Math.cos(angle) * 0.10, 0.40 + Math.sin(angle) * 0.085,
                     nx - Math.cos(angle) * 0.045, ny - Math.sin(angle) * 0.045, accent);
  }
  // Circumferential struts connecting ring cores
  for (let i = 0; i < 6; i++) {
    const [ax, ay] = ringCores[i];
    const [bx, by] = ringCores[(i + 1) % 6];
    nexariStrut(ctx, ax, ay, bx, by, accent);
  }
  // The Silence node — offset below centre, slightly larger, slightly wrong
  nexariNode(ctx, 0.48, 0.52, 0.055, 0.07, accent);
  // (No strut connects it cleanly — it floats between connections)
  // Forward weapon array (five emitters)
  for (let i = 0; i < 5; i++) {
    const wx = 0.34 + i * 0.08;
    nexariWeaponCone(ctx, wx, 0.06, 0.012, 0.05, accent);
  }
  // Forward sensor
  nexariNode(ctx, 0.50, 0.10, 0.04, 0.05, accent);
  nexariStrut(ctx, 0.50, 0.15, 0.50, 0.26, accent);
  // Gift broadcast array ring (prominent dorsal)
  nexariDriveRing(ctx, 0.50, 0.20, 0.20, 0.04, accent);
  // Aft drive rings (triple)
  nexariDriveRing(ctx, 0.50, 0.76, 0.14, 0.045, accent);
  nexariDriveRing(ctx, 0.50, 0.82, 0.10, 0.03, accent);
  nexariDriveRing(ctx, 0.50, 0.87, 0.06, 0.02, accent);
  // Engine glows
  nexariEngineGlow(ctx, 0.34, 0.86, 0.030);
  nexariEngineGlow(ctx, 0.50, 0.88, 0.025);
  nexariEngineGlow(ctx, 0.66, 0.86, 0.030);
}

/**
 * COLONISER — "The Gift, made mobile."
 *
 * Tall cylindrical lattice — a vertical stack of processing cores encased
 * in ring structures, purpose-built to house newly uploaded minds during
 * transit. The most overtly "hive-like" of Nexari designs.
 */
function nexariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Central spine — stack of 5 cores
  const spineY = [0.16, 0.30, 0.44, 0.58, 0.72];
  for (let i = 0; i < spineY.length; i++) {
    const sz = i === 2 ? 1.2 : 0.9; // middle core is largest
    nexariNode(ctx, 0.50, spineY[i], 0.07 * sz, 0.09 * sz, accent);
    // Link to next core
    if (i < spineY.length - 1) {
      nexariStrut(ctx, 0.50, spineY[i] + 0.09 * sz,
                       0.50, spineY[i + 1] - 0.09 * (i + 1 === 2 ? 1.2 : 0.9), accent);
    }
  }
  // Containment rings at each level (habitat rings for uploaded minds)
  const ringWidths = [0.10, 0.13, 0.16, 0.13, 0.10];
  for (let i = 0; i < spineY.length; i++) {
    nexariDriveRing(ctx, 0.50, spineY[i], ringWidths[i], 0.015, accent);
  }
  // Lateral habitat pods (flanking the central stack)
  nexariNode(ctx, 0.26, 0.36, 0.05, 0.06, accent);
  nexariNode(ctx, 0.74, 0.36, 0.05, 0.06, accent);
  nexariStrut(ctx, 0.34, 0.36, 0.31, 0.36, accent);
  nexariStrut(ctx, 0.66, 0.36, 0.69, 0.36, accent);
  nexariNode(ctx, 0.26, 0.52, 0.05, 0.06, accent);
  nexariNode(ctx, 0.74, 0.52, 0.05, 0.06, accent);
  nexariStrut(ctx, 0.34, 0.52, 0.31, 0.52, accent);
  nexariStrut(ctx, 0.66, 0.52, 0.69, 0.52, accent);
  // Forward sensor
  nexariNode(ctx, 0.50, 0.06, 0.035, 0.045, accent);
  nexariStrut(ctx, 0.50, 0.105, 0.50, 0.12, accent);
  // Aft drive ring (large — needs serious propulsion)
  nexariDriveRing(ctx, 0.50, 0.84, 0.14, 0.04, accent);
  nexariStrut(ctx, 0.50, 0.81, 0.50, 0.80, accent);
  // Engine glows
  nexariEngineGlow(ctx, 0.40, 0.88, 0.030);
  nexariEngineGlow(ctx, 0.60, 0.88, 0.030);
}


// ============================================================================
//  EXPORTS (for integration into ShipModels3D.ts and ShipDesignFamilies.ts)

// ===========================================================================
//  DRAKMARI
// ===========================================================================

// SECTION 4: 2D WIREFRAMES — Ship Designer Canvas Renderers
// ============================================================================
//
// Seven functions for the ship designer's top-down wireframe view.
// All operate in a normalised 1x1 coordinate space. Nose = UP (toward y=0).
// Accent colour is passed as a hex string (e.g. '#00ccbb').
//
// These replace the generic 'organic' family for Drakmari, giving them a
// unique deep-ocean predator silhouette distinct from Sylvani (plant) and
// Vethara (parasite).
//
// Visual signature:
// - Split jaw-prow (the "maw") on all combat ships
// - Lateral sensor barbels (thin lines projecting outward)
// - Teal photophore dots along the ventral centreline
// - Narrow whip-tail aft section
// - Dark gradient fill: near-black to deep ocean blue
// - Teal engine glow (not green like organic, not orange like angular)
// ============================================================================


// ── Shared Drakmari drawing primitives ──────────────────────────────────────

/** Drakmari hull fill: dark abyss gradient, cold blue-black. */
function drakmariFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#1a2d3d');  // cold near-black
  grad.addColorStop(0.4, '#0f1e2a');  // deep abyss
  grad.addColorStop(1,   '#080e14');  // void
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

/** Drakmari engine glow: teal bioluminescent, colder than organic green. */
function drakmariEngineGlow(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(0,220,200,0.65)');
  bloom.addColorStop(0.5, 'rgba(0,160,150,0.25)');
  bloom.addColorStop(1,   'rgba(0,80,70,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(200,255,250,1)');
  core.addColorStop(0.4, 'rgba(0,220,200,0.85)');
  core.addColorStop(1,   'rgba(0,100,90,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Bioluminescent photophore node — small teal glow spot. */
function photophore(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  accent: string,
): void {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0,   withAlpha(accent, 0.7));
  glow.addColorStop(0.5, withAlpha(accent, 0.3));
  glow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
}

/** Lateral sensor barbel — thin line projecting outward from hull. */
function barbel(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  accent: string,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Tiny photophore at tip
  photophore(ctx, x2, y2, 0.008, accent);
}

// ── 1. Scout ────────────────────────────────────────────────────────────────

function drakmariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Barracuda-form: narrow, fast, no jaw split. Pure speed predator.
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);                                       // nose tip
  ctx.bezierCurveTo(0.44, 0.14, 0.40, 0.24, 0.39, 0.38);       // port curve
  ctx.bezierCurveTo(0.38, 0.52, 0.40, 0.64, 0.43, 0.74);
  ctx.bezierCurveTo(0.44, 0.78, 0.46, 0.82, 0.48, 0.84);
  ctx.lineTo(0.50, 0.88);                                       // tail point
  ctx.lineTo(0.52, 0.84);
  ctx.bezierCurveTo(0.54, 0.82, 0.56, 0.78, 0.57, 0.74);       // starboard
  ctx.bezierCurveTo(0.60, 0.64, 0.62, 0.52, 0.61, 0.38);
  ctx.bezierCurveTo(0.60, 0.24, 0.56, 0.14, 0.50, 0.08);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Single pair of sensor barbels
  barbel(ctx, 0.39, 0.40, 0.28, 0.36, accent);
  barbel(ctx, 0.61, 0.40, 0.72, 0.36, accent);

  // Centreline photophores
  photophore(ctx, 0.50, 0.18, 0.015, accent);
  photophore(ctx, 0.50, 0.50, 0.012, accent);

  // Tail engine
  drakmariEngineGlow(ctx, 0.50, 0.86, 0.030);
}

// ── 2. Destroyer ────────────────────────────────────────────────────────────

function drakmariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // First ship with the split jaw-prow. Hunting wolf of the fleet.
  // Port jaw
  ctx.beginPath();
  ctx.moveTo(0.44, 0.06);
  ctx.bezierCurveTo(0.40, 0.10, 0.36, 0.18, 0.34, 0.28);
  ctx.bezierCurveTo(0.33, 0.36, 0.34, 0.42, 0.38, 0.44);
  ctx.lineTo(0.46, 0.44);
  ctx.lineTo(0.46, 0.28);
  ctx.bezierCurveTo(0.46, 0.18, 0.45, 0.12, 0.44, 0.06);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Starboard jaw
  ctx.beginPath();
  ctx.moveTo(0.56, 0.06);
  ctx.bezierCurveTo(0.60, 0.10, 0.64, 0.18, 0.66, 0.28);
  ctx.bezierCurveTo(0.67, 0.36, 0.66, 0.42, 0.62, 0.44);
  ctx.lineTo(0.54, 0.44);
  ctx.lineTo(0.54, 0.28);
  ctx.bezierCurveTo(0.54, 0.18, 0.55, 0.12, 0.56, 0.06);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Main body behind the jaw
  ctx.beginPath();
  ctx.moveTo(0.38, 0.44);
  ctx.bezierCurveTo(0.34, 0.48, 0.32, 0.56, 0.33, 0.64);
  ctx.bezierCurveTo(0.34, 0.72, 0.38, 0.80, 0.44, 0.84);
  ctx.lineTo(0.50, 0.90);
  ctx.lineTo(0.56, 0.84);
  ctx.bezierCurveTo(0.62, 0.80, 0.66, 0.72, 0.67, 0.64);
  ctx.bezierCurveTo(0.68, 0.56, 0.66, 0.48, 0.62, 0.44);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Sensor barbels
  barbel(ctx, 0.33, 0.50, 0.20, 0.46, accent);
  barbel(ctx, 0.67, 0.50, 0.80, 0.46, accent);
  barbel(ctx, 0.34, 0.64, 0.22, 0.66, accent);
  barbel(ctx, 0.66, 0.64, 0.78, 0.66, accent);

  // Jaw-gap lure
  photophore(ctx, 0.50, 0.20, 0.018, accent);

  // Centreline photophores
  photophore(ctx, 0.50, 0.56, 0.012, accent);
  photophore(ctx, 0.50, 0.70, 0.012, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.46, 0.88, 0.028);
  drakmariEngineGlow(ctx, 0.54, 0.88, 0.028);
}

// ── 3. Transport ────────────────────────────────────────────────────────────

function drakmariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Gulper-form: wide mid-body for cargo, narrow fore and aft.
  // No jaw split — transports are not hunters. Smooth whale-shark profile.
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);                                      // nose
  ctx.bezierCurveTo(0.42, 0.14, 0.30, 0.26, 0.24, 0.42);      // port bulge
  ctx.bezierCurveTo(0.22, 0.54, 0.24, 0.66, 0.30, 0.74);
  ctx.bezierCurveTo(0.36, 0.80, 0.42, 0.84, 0.48, 0.86);
  ctx.lineTo(0.50, 0.88);
  ctx.lineTo(0.52, 0.86);
  ctx.bezierCurveTo(0.58, 0.84, 0.64, 0.80, 0.70, 0.74);      // starboard
  ctx.bezierCurveTo(0.76, 0.66, 0.78, 0.54, 0.76, 0.42);
  ctx.bezierCurveTo(0.70, 0.26, 0.58, 0.14, 0.50, 0.10);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Cargo hold segments — internal lines suggesting compartments
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.005;
  for (const y of [0.38, 0.50, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(0.30, y);
    ctx.lineTo(0.70, y);
    ctx.stroke();
  }

  // Stubby sensor barbels (shorter than combat ships)
  barbel(ctx, 0.24, 0.44, 0.16, 0.40, accent);
  barbel(ctx, 0.76, 0.44, 0.84, 0.40, accent);

  // Forward photophore
  photophore(ctx, 0.50, 0.18, 0.016, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.44, 0.86, 0.032);
  drakmariEngineGlow(ctx, 0.56, 0.86, 0.032);
}

// ── 4. Cruiser ──────────────────────────────────────────────────────────────

function drakmariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Full predator form: prominent jaw, dorsal hump, bristling barbels.
  // The workhorse of the Drakmari fleet — an apex hunter.

  // Port jaw prong
  ctx.beginPath();
  ctx.moveTo(0.42, 0.04);
  ctx.bezierCurveTo(0.38, 0.08, 0.34, 0.16, 0.32, 0.24);
  ctx.bezierCurveTo(0.31, 0.30, 0.32, 0.34, 0.36, 0.36);
  ctx.lineTo(0.46, 0.36);
  ctx.lineTo(0.46, 0.20);
  ctx.bezierCurveTo(0.46, 0.12, 0.44, 0.08, 0.42, 0.04);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Starboard jaw prong
  ctx.beginPath();
  ctx.moveTo(0.58, 0.04);
  ctx.bezierCurveTo(0.62, 0.08, 0.66, 0.16, 0.68, 0.24);
  ctx.bezierCurveTo(0.69, 0.30, 0.68, 0.34, 0.64, 0.36);
  ctx.lineTo(0.54, 0.36);
  ctx.lineTo(0.54, 0.20);
  ctx.bezierCurveTo(0.54, 0.12, 0.56, 0.08, 0.58, 0.04);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Main hull — dorsal hump silhouette
  ctx.beginPath();
  ctx.moveTo(0.36, 0.36);
  ctx.bezierCurveTo(0.28, 0.40, 0.24, 0.50, 0.24, 0.58);
  ctx.bezierCurveTo(0.24, 0.68, 0.30, 0.76, 0.38, 0.82);
  ctx.bezierCurveTo(0.42, 0.86, 0.46, 0.88, 0.50, 0.90);
  ctx.bezierCurveTo(0.54, 0.88, 0.58, 0.86, 0.62, 0.82);
  ctx.bezierCurveTo(0.70, 0.76, 0.76, 0.68, 0.76, 0.58);
  ctx.bezierCurveTo(0.76, 0.50, 0.72, 0.40, 0.64, 0.36);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Armour segment lines on hull
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.30, 0.52); ctx.lineTo(0.70, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.32, 0.64); ctx.lineTo(0.68, 0.64); ctx.stroke();

  // Sensor barbels — three pairs
  barbel(ctx, 0.24, 0.48, 0.12, 0.42, accent);
  barbel(ctx, 0.76, 0.48, 0.88, 0.42, accent);
  barbel(ctx, 0.25, 0.60, 0.14, 0.58, accent);
  barbel(ctx, 0.75, 0.60, 0.86, 0.58, accent);
  barbel(ctx, 0.28, 0.72, 0.18, 0.74, accent);
  barbel(ctx, 0.72, 0.72, 0.82, 0.74, accent);

  // Jaw-gap lure
  photophore(ctx, 0.50, 0.16, 0.020, accent);

  // Lateral photophore arrays
  photophore(ctx, 0.32, 0.54, 0.010, accent);
  photophore(ctx, 0.68, 0.54, 0.010, accent);
  photophore(ctx, 0.50, 0.72, 0.012, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.44, 0.88, 0.032);
  drakmariEngineGlow(ctx, 0.56, 0.88, 0.032);
}

// ── 5. Carrier ──────────────────────────────────────────────────────────────

function drakmariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Gulper eel form: massive gaping front section with ventral launch bays.
  // The "mouth" is the flight deck — fighters launch from the throat.

  // Broad forward hull — the gaping maw
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.36, 0.10, 0.18, 0.18, 0.14, 0.32);
  ctx.bezierCurveTo(0.12, 0.42, 0.16, 0.50, 0.24, 0.54);
  ctx.lineTo(0.76, 0.54);
  ctx.bezierCurveTo(0.84, 0.50, 0.88, 0.42, 0.86, 0.32);
  ctx.bezierCurveTo(0.82, 0.18, 0.64, 0.10, 0.50, 0.08);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Ventral launch bay — darker inner "throat"
  ctx.beginPath();
  ctx.moveTo(0.30, 0.34);
  ctx.bezierCurveTo(0.34, 0.28, 0.42, 0.24, 0.50, 0.24);
  ctx.bezierCurveTo(0.58, 0.24, 0.66, 0.28, 0.70, 0.34);
  ctx.bezierCurveTo(0.68, 0.42, 0.60, 0.48, 0.50, 0.48);
  ctx.bezierCurveTo(0.40, 0.48, 0.32, 0.42, 0.30, 0.34);
  ctx.closePath();
  ctx.fillStyle = withAlpha('#050a0e', 0.8);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Aft body — tapers to tail
  ctx.beginPath();
  ctx.moveTo(0.24, 0.54);
  ctx.bezierCurveTo(0.28, 0.60, 0.34, 0.68, 0.40, 0.76);
  ctx.bezierCurveTo(0.44, 0.82, 0.48, 0.86, 0.50, 0.90);
  ctx.bezierCurveTo(0.52, 0.86, 0.56, 0.82, 0.60, 0.76);
  ctx.bezierCurveTo(0.66, 0.68, 0.72, 0.60, 0.76, 0.54);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Launch bay guide lines (fighter slots)
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.003;
  for (const x of [0.38, 0.44, 0.50, 0.56, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(x, 0.28);
    ctx.lineTo(x, 0.46);
    ctx.stroke();
  }

  // Sensor barbels
  barbel(ctx, 0.14, 0.34, 0.06, 0.28, accent);
  barbel(ctx, 0.86, 0.34, 0.94, 0.28, accent);
  barbel(ctx, 0.22, 0.52, 0.12, 0.56, accent);
  barbel(ctx, 0.78, 0.52, 0.88, 0.56, accent);

  // Forward lure
  photophore(ctx, 0.50, 0.12, 0.020, accent);

  // Throat glow — deep within the bay
  photophore(ctx, 0.50, 0.38, 0.025, accent);

  // Triple engines
  drakmariEngineGlow(ctx, 0.42, 0.88, 0.028);
  drakmariEngineGlow(ctx, 0.50, 0.90, 0.024);
  drakmariEngineGlow(ctx, 0.58, 0.88, 0.028);
}

// ── 6. Battleship ───────────────────────────────────────────────────────────

function drakmariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Full anglerfish nightmare. Massive split jaw, bristling spines,
  // bioluminescent nodes everywhere, dorsal hump, heavy ventral keel.
  // The apex predator of the deep, rendered as a warship.

  // Port jaw — heavy, armoured
  ctx.beginPath();
  ctx.moveTo(0.40, 0.02);
  ctx.bezierCurveTo(0.34, 0.06, 0.28, 0.14, 0.24, 0.24);
  ctx.bezierCurveTo(0.22, 0.30, 0.22, 0.34, 0.26, 0.36);
  ctx.lineTo(0.46, 0.36);
  ctx.lineTo(0.46, 0.16);
  ctx.bezierCurveTo(0.46, 0.10, 0.44, 0.06, 0.40, 0.02);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Starboard jaw
  ctx.beginPath();
  ctx.moveTo(0.60, 0.02);
  ctx.bezierCurveTo(0.66, 0.06, 0.72, 0.14, 0.76, 0.24);
  ctx.bezierCurveTo(0.78, 0.30, 0.78, 0.34, 0.74, 0.36);
  ctx.lineTo(0.54, 0.36);
  ctx.lineTo(0.54, 0.16);
  ctx.bezierCurveTo(0.54, 0.10, 0.56, 0.06, 0.60, 0.02);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Main hull — massive dorsal hump
  ctx.beginPath();
  ctx.moveTo(0.26, 0.36);
  ctx.bezierCurveTo(0.18, 0.42, 0.14, 0.52, 0.14, 0.60);
  ctx.bezierCurveTo(0.14, 0.70, 0.20, 0.78, 0.30, 0.84);
  ctx.bezierCurveTo(0.36, 0.88, 0.42, 0.90, 0.50, 0.92);
  ctx.bezierCurveTo(0.58, 0.90, 0.64, 0.88, 0.70, 0.84);
  ctx.bezierCurveTo(0.80, 0.78, 0.86, 0.70, 0.86, 0.60);
  ctx.bezierCurveTo(0.86, 0.52, 0.82, 0.42, 0.74, 0.36);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Armour segment lines
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.20, 0.48); ctx.lineTo(0.80, 0.48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.60); ctx.lineTo(0.82, 0.60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.72); ctx.lineTo(0.76, 0.72); ctx.stroke();

  // Ventral keel ridge
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.36);
  ctx.lineTo(0.50, 0.90);
  ctx.stroke();

  // Sensor barbels — four pairs, bristling
  barbel(ctx, 0.14, 0.50, 0.04, 0.44, accent);
  barbel(ctx, 0.86, 0.50, 0.96, 0.44, accent);
  barbel(ctx, 0.16, 0.60, 0.06, 0.56, accent);
  barbel(ctx, 0.84, 0.60, 0.94, 0.56, accent);
  barbel(ctx, 0.18, 0.70, 0.08, 0.68, accent);
  barbel(ctx, 0.82, 0.70, 0.92, 0.68, accent);
  barbel(ctx, 0.24, 0.78, 0.14, 0.80, accent);
  barbel(ctx, 0.76, 0.78, 0.86, 0.80, accent);

  // Weapon hardpoint glows on barbel roots
  photophore(ctx, 0.16, 0.50, 0.012, accent);
  photophore(ctx, 0.84, 0.50, 0.012, accent);
  photophore(ctx, 0.18, 0.60, 0.012, accent);
  photophore(ctx, 0.82, 0.60, 0.012, accent);

  // Jaw-gap lure — large, commanding
  photophore(ctx, 0.50, 0.14, 0.024, accent);

  // Lateral photophore arrays
  photophore(ctx, 0.24, 0.54, 0.010, accent);
  photophore(ctx, 0.76, 0.54, 0.010, accent);
  photophore(ctx, 0.22, 0.66, 0.010, accent);
  photophore(ctx, 0.78, 0.66, 0.010, accent);
  photophore(ctx, 0.50, 0.78, 0.014, accent);

  // Triple engine cluster
  drakmariEngineGlow(ctx, 0.40, 0.90, 0.034);
  drakmariEngineGlow(ctx, 0.50, 0.92, 0.030);
  drakmariEngineGlow(ctx, 0.60, 0.90, 0.034);
}

// ── 7. Coloniser ────────────────────────────────────────────────────────────

function drakmariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ark-form: swollen egg-sac silhouette. This is the desperate hope of a
  // dying ocean. A pregnant deep-sea fish carrying the future of the species.
  // No jaw (colonisers are not hunters). Broad, round, protective.

  // Main hull — swollen ovoid
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.38, 0.14, 0.26, 0.28, 0.22, 0.44);
  ctx.bezierCurveTo(0.20, 0.56, 0.22, 0.68, 0.28, 0.76);
  ctx.bezierCurveTo(0.34, 0.82, 0.40, 0.86, 0.50, 0.88);
  ctx.bezierCurveTo(0.60, 0.86, 0.66, 0.82, 0.72, 0.76);
  ctx.bezierCurveTo(0.78, 0.68, 0.80, 0.56, 0.78, 0.44);
  ctx.bezierCurveTo(0.74, 0.28, 0.62, 0.14, 0.50, 0.10);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Internal egg-chamber glow — the precious cargo
  const eggGlow = ctx.createRadialGradient(0.50, 0.48, 0, 0.50, 0.48, 0.20);
  eggGlow.addColorStop(0,   withAlpha(accent, 0.25));
  eggGlow.addColorStop(0.6, withAlpha(accent, 0.10));
  eggGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.20, 0, Math.PI * 2);
  ctx.fillStyle = eggGlow;
  ctx.fill();

  // Protective membrane arcs around the egg chamber
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.14, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.14, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  // Stubby protective barbels
  barbel(ctx, 0.24, 0.44, 0.16, 0.38, accent);
  barbel(ctx, 0.76, 0.44, 0.84, 0.38, accent);
  barbel(ctx, 0.24, 0.60, 0.16, 0.62, accent);
  barbel(ctx, 0.76, 0.60, 0.84, 0.62, accent);

  // Tail tendrils — trailing behind the ark
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.42, 0.84); ctx.bezierCurveTo(0.38, 0.90, 0.34, 0.95, 0.30, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.58, 0.84); ctx.bezierCurveTo(0.62, 0.90, 0.66, 0.95, 0.70, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.88); ctx.bezierCurveTo(0.50, 0.93, 0.49, 0.96, 0.48, 0.99);
  ctx.stroke();

  // Forward photophore
  photophore(ctx, 0.50, 0.18, 0.018, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.44, 0.86, 0.030);
  drakmariEngineGlow(ctx, 0.56, 0.86, 0.030);
}


// ============================================================================
// EXPORTS — for integration into ShipModels3D.ts and ShipDesignFamilies.ts

// ===========================================================================
//  ASHKARI
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — "SCRAPYARD" FAMILY
// ═══════════════════════════════════════════════════════════════════════════════
//
//  All draw functions operate in normalised 1x1 coordinate space.
//  Ships face nose-UP (fore = top of canvas).
//  Every ship is deliberately asymmetric — left and right halves differ.
//  Panel seam lines, rivet dots, and mismatched plating patches tell the
//  story of a vessel assembled from salvage across centuries of exile.
// ═══════════════════════════════════════════════════════════════════════════════


// ── Shared Ashkari drawing primitives ────────────────────────────────────────

/** Dark brown-grey gradient fill with warm undertone — scrapyard metal. */
function scrapFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.15, 0.75, 0.85);
  grad.addColorStop(0,   '#5a4e3e');
  grad.addColorStop(0.35, '#3e352a');
  grad.addColorStop(0.7,  '#2e2820');
  grad.addColorStop(1,    '#221e18');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Amber engine glow — warm, functional, not dramatic. */
function scrapEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.0);
  bloom.addColorStop(0,   'rgba(255,200,120,0.55)');
  bloom.addColorStop(0.4, 'rgba(200,140,60,0.25)');
  bloom.addColorStop(1,   'rgba(140,80,20,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.0, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,235,200,1)');
  core.addColorStop(0.4, 'rgba(240,180,80,0.85)');
  core.addColorStop(1,   'rgba(180,100,30,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Weld seam line — slightly uneven, darker than hull. */
function weldSeam(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  // Slight mid-point deviation to look hand-welded
  const mx = (x1 + x2) / 2 + 0.005;
  const my = (y1 + y2) / 2 + 0.003;
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.strokeStyle = 'rgba(0,0,0,0.40)';
  ctx.lineWidth = 0.005;
  ctx.stroke();
}

/** Rivet cluster — small dots along a line. */
function rivets(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, count: number, accent: string): void {
  for (let i = 0; i <= count; i++) {
    const t = count === 0 ? 0.5 : i / count;
    const rx = x1 + (x2 - x1) * t;
    const ry = y1 + (y2 - y1) * t;
    ctx.beginPath();
    ctx.arc(rx, ry, 0.006, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.45);
    ctx.fill();
  }
}

/** Mismatched panel patch — a rectangle of slightly different shade. */
function patchPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

// ── SCOUT — lean scavenger dart ──────────────────────────────────────────────
// Fast, minimal: an off-centre cockpit bolted to a narrow frame with
// two different-sized engines. The Ashkari rat-rod.

function ashkariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main body — narrow, slightly wider on starboard
  ctx.beginPath();
  ctx.moveTo(0.48, 0.10);             // Nose (offset port of centre)
  ctx.lineTo(0.40, 0.22);
  ctx.lineTo(0.36, 0.50);
  ctx.lineTo(0.37, 0.74);
  ctx.lineTo(0.42, 0.82);
  ctx.lineTo(0.58, 0.82);
  ctx.lineTo(0.63, 0.72);
  ctx.lineTo(0.62, 0.48);
  ctx.lineTo(0.58, 0.20);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Cockpit blister — offset to port
  ctx.beginPath();
  ctx.ellipse(0.43, 0.20, 0.06, 0.04, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.30);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.50);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Weld seams
  weldSeam(ctx, 0.37, 0.40, 0.62, 0.42);
  weldSeam(ctx, 0.38, 0.62, 0.61, 0.60);

  // Rivet line along port seam
  rivets(ctx, 0.38, 0.30, 0.37, 0.65, 4, accent);

  // Mismatched engines (starboard larger)
  scrapEngineGlow(ctx, 0.45, 0.80, 0.024);
  scrapEngineGlow(ctx, 0.56, 0.79, 0.032);
}

// ── DESTROYER — asymmetric gunboat ───────────────────────────────────────────
// Wider than the scout with a bolted-on weapon gantry on the starboard
// side and a cargo pod on the port. Clearly a workhorse.

function ashkariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — wider body, still off-centre
  ctx.beginPath();
  ctx.moveTo(0.47, 0.08);
  ctx.lineTo(0.36, 0.18);
  ctx.lineTo(0.32, 0.36);
  ctx.lineTo(0.31, 0.60);
  ctx.lineTo(0.34, 0.76);
  ctx.lineTo(0.40, 0.84);
  ctx.lineTo(0.60, 0.84);
  ctx.lineTo(0.66, 0.74);
  ctx.lineTo(0.67, 0.58);
  ctx.lineTo(0.66, 0.34);
  ctx.lineTo(0.62, 0.16);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Bolted-on gun gantry (starboard dorsal)
  ctx.beginPath();
  ctx.moveTo(0.66, 0.30);
  ctx.lineTo(0.78, 0.28);
  ctx.lineTo(0.80, 0.36);
  ctx.lineTo(0.78, 0.44);
  ctx.lineTo(0.66, 0.42);
  ctx.closePath();
  scrapFill(ctx, accent);
  // Gun barrel
  ctx.beginPath();
  ctx.moveTo(0.76, 0.32);
  ctx.lineTo(0.76, 0.16);
  ctx.strokeStyle = withAlpha(accent, 0.50);
  ctx.lineWidth = 0.008;
  ctx.stroke();

  // Cargo pod (port side)
  ctx.beginPath();
  ctx.rect(0.18, 0.46, 0.13, 0.20);
  scrapFill(ctx, accent);
  // Mounting strut
  ctx.beginPath();
  ctx.moveTo(0.31, 0.54);
  ctx.lineTo(0.24, 0.52);
  ctx.strokeStyle = 'rgba(0,0,0,0.40)';
  ctx.lineWidth = 0.006;
  ctx.stroke();

  // Cockpit blister
  ctx.beginPath();
  ctx.ellipse(0.44, 0.16, 0.07, 0.035, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.28);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Weld seams and panel patches
  weldSeam(ctx, 0.33, 0.44, 0.66, 0.46);
  weldSeam(ctx, 0.35, 0.66, 0.64, 0.64);
  patchPanel(ctx, 0.40, 0.50, 0.12, 0.14, accent);
  rivets(ctx, 0.34, 0.28, 0.34, 0.68, 5, accent);

  // Mismatched engines
  scrapEngineGlow(ctx, 0.44, 0.82, 0.030);
  scrapEngineGlow(ctx, 0.56, 0.82, 0.026);
}

// ── TRANSPORT — wide cargo hauler ────────────────────────────────────────────
// Fat-bodied, practical. Multiple cargo bays with visible seam lines.
// The ship equivalent of a transit van held together by determination.

function ashkariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wide hull body
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.36, 0.18);
  ctx.lineTo(0.24, 0.28);
  ctx.lineTo(0.22, 0.54);
  ctx.lineTo(0.24, 0.72);
  ctx.lineTo(0.32, 0.82);
  ctx.lineTo(0.68, 0.84);
  ctx.lineTo(0.76, 0.74);
  ctx.lineTo(0.78, 0.56);
  ctx.lineTo(0.76, 0.30);
  ctx.lineTo(0.64, 0.18);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Cargo bay seam lines (horizontal)
  weldSeam(ctx, 0.24, 0.38, 0.76, 0.40);
  weldSeam(ctx, 0.23, 0.54, 0.77, 0.56);
  weldSeam(ctx, 0.25, 0.68, 0.75, 0.70);

  // Cargo bay vertical dividers
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.42, 0.28); ctx.lineTo(0.40, 0.78); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.60, 0.30); ctx.lineTo(0.62, 0.76); ctx.stroke();

  // Mismatched panel patches (different shading = different source hulls)
  patchPanel(ctx, 0.26, 0.42, 0.14, 0.12, accent);
  patchPanel(ctx, 0.62, 0.44, 0.13, 0.10, accent);
  patchPanel(ctx, 0.44, 0.58, 0.16, 0.10, accent);

  // Cockpit — offset starboard this time (variety)
  ctx.beginPath();
  ctx.ellipse(0.56, 0.18, 0.065, 0.032, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.28);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Rivet lines
  rivets(ctx, 0.26, 0.30, 0.26, 0.70, 6, accent);
  rivets(ctx, 0.74, 0.32, 0.74, 0.72, 5, accent);

  // Engines (port larger — it is a cargo ship, heavy on one side)
  scrapEngineGlow(ctx, 0.40, 0.82, 0.034);
  scrapEngineGlow(ctx, 0.60, 0.82, 0.026);
}

// ── CRUISER — heavy patchwork warship ────────────────────────────────────────
// Multiple hull sections visibly welded together. Weapon platforms on
// both sides but at different heights. The Ashkari's main fighting ship.

function ashkariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Primary hull — broad diamond-ish shape, slightly wider starboard
  ctx.beginPath();
  ctx.moveTo(0.48, 0.06);
  ctx.lineTo(0.34, 0.16);
  ctx.lineTo(0.24, 0.34);
  ctx.lineTo(0.22, 0.56);
  ctx.lineTo(0.26, 0.74);
  ctx.lineTo(0.36, 0.86);
  ctx.lineTo(0.64, 0.88);
  ctx.lineTo(0.74, 0.76);
  ctx.lineTo(0.78, 0.58);
  ctx.lineTo(0.76, 0.36);
  ctx.lineTo(0.66, 0.18);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Weapon gantry — starboard, high
  ctx.beginPath();
  ctx.moveTo(0.76, 0.28);
  ctx.lineTo(0.86, 0.26);
  ctx.lineTo(0.88, 0.34);
  ctx.lineTo(0.86, 0.42);
  ctx.lineTo(0.76, 0.40);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Weapon gantry — port, lower (asymmetric)
  ctx.beginPath();
  ctx.moveTo(0.24, 0.44);
  ctx.lineTo(0.14, 0.46);
  ctx.lineTo(0.12, 0.54);
  ctx.lineTo(0.14, 0.60);
  ctx.lineTo(0.24, 0.58);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Gun barrels
  ctx.strokeStyle = withAlpha(accent, 0.50);
  ctx.lineWidth = 0.007;
  ctx.beginPath(); ctx.moveTo(0.84, 0.30); ctx.lineTo(0.84, 0.14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.14, 0.50); ctx.lineTo(0.14, 0.38); ctx.stroke();

  // Hull seam lines (these sections were separate ships once)
  weldSeam(ctx, 0.26, 0.36, 0.76, 0.38);
  weldSeam(ctx, 0.24, 0.56, 0.78, 0.58);
  weldSeam(ctx, 0.28, 0.72, 0.72, 0.74);

  // Mismatched panel patches
  patchPanel(ctx, 0.36, 0.40, 0.14, 0.14, accent);
  patchPanel(ctx, 0.54, 0.42, 0.16, 0.12, accent);
  patchPanel(ctx, 0.30, 0.60, 0.12, 0.10, accent);

  // Cockpit — offset port
  ctx.beginPath();
  ctx.ellipse(0.42, 0.14, 0.075, 0.035, -0.12, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.30);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.48);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Rivet lines along seams
  rivets(ctx, 0.26, 0.24, 0.26, 0.70, 6, accent);
  rivets(ctx, 0.74, 0.26, 0.74, 0.72, 5, accent);

  // Triple mismatched engines
  scrapEngineGlow(ctx, 0.42, 0.86, 0.030);
  scrapEngineGlow(ctx, 0.56, 0.86, 0.026);
  scrapEngineGlow(ctx, 0.64, 0.84, 0.020);
}

// ── CARRIER — wide bazaar-platform ───────────────────────────────────────────
// A broad, flat deck made from welded hull sections. Launch bays are
// just converted cargo holds with the doors permanently open.

function ashkariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Broad platform hull
  ctx.beginPath();
  ctx.moveTo(0.48, 0.10);
  ctx.lineTo(0.30, 0.16);
  ctx.lineTo(0.16, 0.28);
  ctx.lineTo(0.12, 0.52);
  ctx.lineTo(0.14, 0.70);
  ctx.lineTo(0.24, 0.84);
  ctx.lineTo(0.76, 0.86);
  ctx.lineTo(0.86, 0.72);
  ctx.lineTo(0.88, 0.54);
  ctx.lineTo(0.84, 0.30);
  ctx.lineTo(0.70, 0.16);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Launch bays — dark rectangles, asymmetric placement
  ctx.fillStyle = 'rgba(8,6,4,0.65)';
  ctx.fillRect(0.18, 0.32, 0.16, 0.08);
  ctx.fillRect(0.66, 0.34, 0.16, 0.08);
  ctx.fillRect(0.20, 0.48, 0.14, 0.08);
  ctx.fillRect(0.64, 0.52, 0.18, 0.08);
  ctx.fillRect(0.18, 0.64, 0.16, 0.08);
  ctx.fillRect(0.68, 0.66, 0.14, 0.08);

  // Weld seams between sections
  weldSeam(ctx, 0.14, 0.42, 0.86, 0.44);
  weldSeam(ctx, 0.16, 0.60, 0.84, 0.62);

  // Centre spine (structural truss)
  ctx.beginPath();
  ctx.rect(0.44, 0.18, 0.12, 0.64);
  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Rivet clusters along spine
  rivets(ctx, 0.44, 0.22, 0.44, 0.78, 7, accent);
  rivets(ctx, 0.56, 0.22, 0.56, 0.78, 7, accent);

  // Panel patches
  patchPanel(ctx, 0.38, 0.32, 0.08, 0.10, accent);
  patchPanel(ctx, 0.54, 0.48, 0.10, 0.08, accent);

  // Cockpit — port forward (carrier bridge, set back from bow)
  ctx.beginPath();
  ctx.ellipse(0.38, 0.18, 0.06, 0.032, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.30);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.48);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Three mismatched engines (different sizes and offsets)
  scrapEngineGlow(ctx, 0.36, 0.84, 0.032);
  scrapEngineGlow(ctx, 0.54, 0.85, 0.026);
  scrapEngineGlow(ctx, 0.72, 0.83, 0.030);
}

// ── BATTLESHIP — the great bazaar-ship ───────────────────────────────────────
// The biggest fighting vessel the Ashkari field. It is visibly three or
// four separate hull sections welded into one massive, ugly, terrifyingly
// effective warship. Weapon platforms sprout from every surface.

function ashkariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Primary hull — massive central mass
  ctx.beginPath();
  ctx.moveTo(0.46, 0.04);
  ctx.lineTo(0.30, 0.12);
  ctx.lineTo(0.18, 0.28);
  ctx.lineTo(0.14, 0.50);
  ctx.lineTo(0.16, 0.70);
  ctx.lineTo(0.26, 0.84);
  ctx.lineTo(0.40, 0.92);
  ctx.lineTo(0.62, 0.92);
  ctx.lineTo(0.76, 0.82);
  ctx.lineTo(0.86, 0.68);
  ctx.lineTo(0.88, 0.48);
  ctx.lineTo(0.84, 0.26);
  ctx.lineTo(0.72, 0.10);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Secondary hull section — welded to port (visible seam)
  ctx.beginPath();
  ctx.moveTo(0.18, 0.36);
  ctx.lineTo(0.08, 0.40);
  ctx.lineTo(0.06, 0.56);
  ctx.lineTo(0.08, 0.68);
  ctx.lineTo(0.16, 0.72);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Tertiary hull section — welded to starboard upper
  ctx.beginPath();
  ctx.moveTo(0.84, 0.22);
  ctx.lineTo(0.92, 0.28);
  ctx.lineTo(0.94, 0.42);
  ctx.lineTo(0.90, 0.50);
  ctx.lineTo(0.84, 0.46);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Weapon platforms (six positions, asymmetric)
  const weapons: [number, number, number, number][] = [
    [0.08, 0.44, 0.08, 0.30],    // Port forward gun
    [0.10, 0.62, 0.10, 0.50],    // Port aft gun
    [0.92, 0.32, 0.92, 0.18],    // Starboard forward gun
    [0.88, 0.54, 0.88, 0.42],    // Starboard aft gun
    [0.36, 0.08, 0.36, -0.02],   // Dorsal bow gun
    [0.68, 0.08, 0.68, -0.02],   // Dorsal bow gun 2
  ];
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.008;
  for (const [x1, y1, x2, y2] of weapons) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // Turret base
    ctx.beginPath();
    ctx.arc(x1, y1, 0.018, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.35);
    ctx.fill();
  }

  // Major weld seams
  weldSeam(ctx, 0.16, 0.30, 0.84, 0.28);
  weldSeam(ctx, 0.14, 0.50, 0.86, 0.48);
  weldSeam(ctx, 0.18, 0.68, 0.84, 0.66);
  weldSeam(ctx, 0.20, 0.82, 0.74, 0.80);

  // Multiple panel patches
  patchPanel(ctx, 0.30, 0.32, 0.16, 0.14, accent);
  patchPanel(ctx, 0.56, 0.34, 0.18, 0.12, accent);
  patchPanel(ctx, 0.24, 0.54, 0.14, 0.12, accent);
  patchPanel(ctx, 0.60, 0.56, 0.16, 0.10, accent);
  patchPanel(ctx, 0.42, 0.70, 0.18, 0.10, accent);

  // Rivet lines along major seams
  rivets(ctx, 0.20, 0.18, 0.20, 0.78, 8, accent);
  rivets(ctx, 0.80, 0.16, 0.80, 0.76, 7, accent);

  // Cockpit — port forward, recessed
  ctx.beginPath();
  ctx.ellipse(0.38, 0.12, 0.08, 0.035, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.30);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.50);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Four mismatched engines (the ultimate signature)
  scrapEngineGlow(ctx, 0.34, 0.90, 0.034);
  scrapEngineGlow(ctx, 0.48, 0.92, 0.028);
  scrapEngineGlow(ctx, 0.58, 0.91, 0.032);
  scrapEngineGlow(ctx, 0.70, 0.88, 0.024);
}

// ── COLONISER — the generation ark ───────────────────────────────────────────
// The most sacred vessel in the Ashkari fleet. Built from the best salvage
// available, festooned with sensor arrays and shield generators. Somewhere
// in its hull is a sealed chamber containing a fragment of Ashkar Prime.

function ashkariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — rounded rectangular, more carefully built than warships
  ctx.beginPath();
  ctx.moveTo(0.48, 0.08);
  ctx.lineTo(0.36, 0.14);
  ctx.lineTo(0.26, 0.26);
  ctx.lineTo(0.22, 0.46);
  ctx.lineTo(0.24, 0.64);
  ctx.lineTo(0.30, 0.76);
  ctx.lineTo(0.40, 0.84);
  ctx.lineTo(0.62, 0.86);
  ctx.lineTo(0.72, 0.78);
  ctx.lineTo(0.78, 0.66);
  ctx.lineTo(0.80, 0.48);
  ctx.lineTo(0.76, 0.28);
  ctx.lineTo(0.66, 0.16);
  ctx.closePath();
  scrapFill(ctx, accent);

  // Habitat window strips (warmly lit — people live here)
  for (let y = 0.32; y <= 0.68; y += 0.12) {
    const xOff = y * 0.02;  // Slight stagger — hand-placed
    ctx.beginPath();
    ctx.rect(0.30 + xOff, y, 0.40 - xOff * 2, 0.025);
    const wg = ctx.createLinearGradient(0.30 + xOff, y, 0.70 - xOff, y);
    wg.addColorStop(0,   withAlpha(accent, 0.25));
    wg.addColorStop(0.5, withAlpha(accent, 0.50));
    wg.addColorStop(1,   withAlpha(accent, 0.25));
    ctx.fillStyle = wg;
    ctx.fill();
  }

  // Weld seams
  weldSeam(ctx, 0.24, 0.38, 0.78, 0.40);
  weldSeam(ctx, 0.24, 0.56, 0.78, 0.58);

  // Sacred chamber glow — the fragment of Ashkar Prime
  const sacredGlow = ctx.createRadialGradient(0.50, 0.50, 0, 0.50, 0.50, 0.12);
  sacredGlow.addColorStop(0,   'rgba(255,180,80,0.35)');
  sacredGlow.addColorStop(0.6, 'rgba(200,120,40,0.15)');
  sacredGlow.addColorStop(1,   'rgba(140,80,20,0)');
  ctx.beginPath();
  ctx.arc(0.50, 0.50, 0.12, 0, Math.PI * 2);
  ctx.fillStyle = sacredGlow;
  ctx.fill();
  // Inner diamond — the reliquary
  ctx.beginPath();
  ctx.moveTo(0.50, 0.44);
  ctx.lineTo(0.54, 0.50);
  ctx.lineTo(0.50, 0.56);
  ctx.lineTo(0.46, 0.50);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,220,160,0.6)';
  ctx.fill();

  // Sensor arrays (this ship must survive — it carries the future)
  ctx.strokeStyle = withAlpha(accent, 0.40);
  ctx.lineWidth = 0.005;
  // Port sensor boom
  ctx.beginPath();
  ctx.moveTo(0.26, 0.30);
  ctx.lineTo(0.16, 0.24);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.14, 0.22, 0.02, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.50);
  ctx.fill();
  // Starboard sensor boom
  ctx.beginPath();
  ctx.moveTo(0.76, 0.32);
  ctx.lineTo(0.84, 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.86, 0.26, 0.02, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.50);
  ctx.fill();

  // Panel patches and rivets
  patchPanel(ctx, 0.30, 0.28, 0.14, 0.08, accent);
  patchPanel(ctx, 0.58, 0.62, 0.12, 0.10, accent);
  rivets(ctx, 0.26, 0.22, 0.26, 0.72, 7, accent);
  rivets(ctx, 0.76, 0.24, 0.76, 0.74, 6, accent);

  // Cockpit
  ctx.beginPath();
  ctx.ellipse(0.44, 0.14, 0.07, 0.032, -0.06, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.28);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Twin engines (more evenly matched than warships — reliability matters)
  scrapEngineGlow(ctx, 0.44, 0.84, 0.032);
  scrapEngineGlow(ctx, 0.60, 0.84, 0.030);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS

// ===========================================================================
//  LUMINARI
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — Ship Designer Canvas Drawings
// ============================================================================
//
//  Seven hull classes, each drawn in a normalised 1x1 space, nose-UP.
//  The Luminari 2D language mirrors the 3D: open lattice lines, ring arcs,
//  glowing node dots, and antenna whiskers. No solid fills — only stroked
//  paths and radial gradient nodes. The background of each ship should feel
//  like looking at a constellation diagram or a magnetic field schematic.
//
//  Colour palette:
//  - Lattice strokes: warm gold at low alpha (accent-based)
//  - Node glows: white-gold core fading to transparent
//  - Ring arcs: accent colour at moderate alpha
//  - Background: none (transparent canvas)


// ── Shared Luminari drawing primitives ──────────────────────────────────────

/** Draw a glowing energy node — radial gradient circle with bright core. */
function luminariNode(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, accent: string,
): void {
  // Outer bloom
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  bloom.addColorStop(0,   withAlpha(accent, 0.5));
  bloom.addColorStop(0.4, withAlpha(accent, 0.2));
  bloom.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Bright core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,248,230,1)');
  core.addColorStop(0.5, withAlpha(accent, 0.85));
  core.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Draw a containment ring — an arc or full ellipse with glowing stroke. */
function luminariRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number, accent: string,
  startAngle = 0, endAngle = Math.PI * 2,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle);
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Inner glow line
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, startAngle, endAngle);
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.012;
  ctx.stroke();
}

/** Draw a lattice rod — a thin stroked line with faint glow. */
function luminariRod(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number, accent: string,
  alpha = 0.45,
): void {
  // Glow pass (wider, lower alpha)
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = withAlpha(accent, alpha * 0.4);
  ctx.lineWidth = 0.008;
  ctx.stroke();
  // Core pass (thin, brighter)
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = withAlpha(accent, alpha);
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

/** Draw an antenna spar — a thinner rod with a tiny node at the tip. */
function luminariAntenna(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number, accent: string,
): void {
  luminariRod(ctx, x1, y1, x2, y2, accent, 0.3);
  luminariNode(ctx, x2, y2, 0.012, accent);
}

// ── Hull class wireframes ───────────────────────────────────────────────────

function luminariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Minimal containment lattice: four rods converging to bow node, core sphere.
  // The smallest possible cage — barely enough to hold a Luminari in vacuum.

  // Longitudinal rods (two pairs, converging at bow)
  luminariRod(ctx, 0.38, 0.80, 0.50, 0.14, accent);
  luminariRod(ctx, 0.62, 0.80, 0.50, 0.14, accent);
  luminariRod(ctx, 0.42, 0.78, 0.50, 0.14, accent, 0.25);
  luminariRod(ctx, 0.58, 0.78, 0.50, 0.14, accent, 0.25);

  // Single transverse brace
  luminariRod(ctx, 0.38, 0.55, 0.62, 0.55, accent, 0.35);

  // Aft crossbar
  luminariRod(ctx, 0.38, 0.78, 0.62, 0.78, accent, 0.3);

  // Core energy node (the Luminari)
  luminariNode(ctx, 0.50, 0.48, 0.032, accent);

  // Bow focus node
  luminariNode(ctx, 0.50, 0.14, 0.018, accent);

  // Aft resonance glow (engine equivalent)
  luminariNode(ctx, 0.50, 0.82, 0.022, accent);
}

function luminariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Elongated cage with single containment ring. More rods than the scout,
  // giving a denser lattice feel. Antenna spars begin to appear.

  // Primary longitudinal rods
  luminariRod(ctx, 0.36, 0.84, 0.42, 0.12, accent);
  luminariRod(ctx, 0.64, 0.84, 0.58, 0.12, accent);
  // Inner longitudinal pair
  luminariRod(ctx, 0.44, 0.82, 0.48, 0.14, accent, 0.3);
  luminariRod(ctx, 0.56, 0.82, 0.52, 0.14, accent, 0.3);

  // Transverse braces
  luminariRod(ctx, 0.36, 0.36, 0.64, 0.36, accent, 0.35);
  luminariRod(ctx, 0.35, 0.60, 0.65, 0.60, accent, 0.35);
  luminariRod(ctx, 0.37, 0.80, 0.63, 0.80, accent, 0.3);

  // Containment ring
  luminariRing(ctx, 0.50, 0.42, 0.17, 0.06, accent);

  // Antenna spars — short whiskers
  luminariAntenna(ctx, 0.36, 0.40, 0.22, 0.30, accent);
  luminariAntenna(ctx, 0.64, 0.40, 0.78, 0.30, accent);

  // Core node
  luminariNode(ctx, 0.50, 0.46, 0.030, accent);

  // Bow node
  luminariNode(ctx, 0.50, 0.12, 0.016, accent);

  // Side junction nodes
  luminariNode(ctx, 0.36, 0.60, 0.012, accent);
  luminariNode(ctx, 0.64, 0.60, 0.012, accent);

  // Aft glow
  luminariNode(ctx, 0.44, 0.84, 0.018, accent);
  luminariNode(ctx, 0.56, 0.84, 0.018, accent);
}

function luminariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wider lattice with a large central containment ring — the ring is the
  // "cargo hold", a magnetic bottle that can carry other energy patterns
  // or field-suspended material. Broader and rounder than combat vessels.

  // Wide outer cage rods
  luminariRod(ctx, 0.28, 0.78, 0.40, 0.16, accent);
  luminariRod(ctx, 0.72, 0.78, 0.60, 0.16, accent);
  // Inner structural rods
  luminariRod(ctx, 0.40, 0.80, 0.46, 0.18, accent, 0.3);
  luminariRod(ctx, 0.60, 0.80, 0.54, 0.18, accent, 0.3);

  // Transverse braces
  luminariRod(ctx, 0.28, 0.35, 0.72, 0.35, accent, 0.3);
  luminariRod(ctx, 0.26, 0.55, 0.74, 0.55, accent, 0.3);
  luminariRod(ctx, 0.30, 0.75, 0.70, 0.75, accent, 0.3);

  // Large containment ring — the cargo bottle
  luminariRing(ctx, 0.50, 0.48, 0.24, 0.10, accent);
  // Inner ring glow
  luminariRing(ctx, 0.50, 0.48, 0.14, 0.06, accent);

  // Core node (larger — more energy to hold the cargo field)
  luminariNode(ctx, 0.50, 0.48, 0.035, accent);

  // Junction nodes at brace intersections
  luminariNode(ctx, 0.28, 0.55, 0.010, accent);
  luminariNode(ctx, 0.72, 0.55, 0.010, accent);
  luminariNode(ctx, 0.34, 0.35, 0.010, accent);
  luminariNode(ctx, 0.66, 0.35, 0.010, accent);

  // Bow node
  luminariNode(ctx, 0.50, 0.16, 0.015, accent);

  // Aft glow (wider spread — twin engines)
  luminariNode(ctx, 0.40, 0.82, 0.020, accent);
  luminariNode(ctx, 0.60, 0.82, 0.020, accent);
}

function luminariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Two containment rings — the iconic magnetic bottle silhouette.
  // Longer and more angular than the transport. Multiple antenna spars
  // give it an aggressive sensor profile despite the Luminari's peaceful
  // nature — they observe, they listen, they intercept.

  // Primary lattice rods — six for density
  luminariRod(ctx, 0.34, 0.86, 0.44, 0.10, accent);
  luminariRod(ctx, 0.66, 0.86, 0.56, 0.10, accent);
  luminariRod(ctx, 0.38, 0.84, 0.47, 0.12, accent, 0.3);
  luminariRod(ctx, 0.62, 0.84, 0.53, 0.12, accent, 0.3);
  // Central spine
  luminariRod(ctx, 0.50, 0.10, 0.50, 0.86, accent, 0.2);

  // Transverse braces
  luminariRod(ctx, 0.32, 0.30, 0.68, 0.30, accent, 0.3);
  luminariRod(ctx, 0.30, 0.50, 0.70, 0.50, accent, 0.35);
  luminariRod(ctx, 0.32, 0.68, 0.68, 0.68, accent, 0.3);
  luminariRod(ctx, 0.36, 0.82, 0.64, 0.82, accent, 0.25);

  // Forward containment ring
  luminariRing(ctx, 0.50, 0.34, 0.20, 0.07, accent);
  // Aft containment ring (slightly larger)
  luminariRing(ctx, 0.50, 0.62, 0.22, 0.08, accent);

  // Antenna spars — four whiskers, longer than destroyer
  luminariAntenna(ctx, 0.34, 0.34, 0.16, 0.20, accent);
  luminariAntenna(ctx, 0.66, 0.34, 0.84, 0.20, accent);
  luminariAntenna(ctx, 0.32, 0.62, 0.14, 0.56, accent);
  luminariAntenna(ctx, 0.68, 0.62, 0.86, 0.56, accent);

  // Core node
  luminariNode(ctx, 0.50, 0.46, 0.034, accent);

  // Bow focus node
  luminariNode(ctx, 0.50, 0.10, 0.018, accent);

  // Ring junction nodes
  luminariNode(ctx, 0.34, 0.34, 0.010, accent);
  luminariNode(ctx, 0.66, 0.34, 0.010, accent);
  luminariNode(ctx, 0.32, 0.62, 0.010, accent);
  luminariNode(ctx, 0.68, 0.62, 0.010, accent);

  // Aft triple glow
  luminariNode(ctx, 0.42, 0.86, 0.020, accent);
  luminariNode(ctx, 0.50, 0.88, 0.016, accent);
  luminariNode(ctx, 0.58, 0.86, 0.020, accent);
}

function luminariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wide lattice platform with three containment rings — one central and
  // two flanking. The flanking rings are "launch bays" where smaller
  // Luminari field-forms (fighters) are held before deployment. The widest
  // silhouette of any Luminari hull.

  // Outer cage — broad trapezoid
  luminariRod(ctx, 0.20, 0.76, 0.38, 0.12, accent);
  luminariRod(ctx, 0.80, 0.76, 0.62, 0.12, accent);
  // Inner cage rods
  luminariRod(ctx, 0.36, 0.80, 0.44, 0.14, accent, 0.25);
  luminariRod(ctx, 0.64, 0.80, 0.56, 0.14, accent, 0.25);

  // Transverse braces — broad
  luminariRod(ctx, 0.18, 0.30, 0.82, 0.30, accent, 0.3);
  luminariRod(ctx, 0.16, 0.50, 0.84, 0.50, accent, 0.35);
  luminariRod(ctx, 0.18, 0.68, 0.82, 0.68, accent, 0.3);
  luminariRod(ctx, 0.24, 0.78, 0.76, 0.78, accent, 0.25);

  // Cross-braces (diagonal lattice)
  luminariRod(ctx, 0.30, 0.30, 0.20, 0.50, accent, 0.2);
  luminariRod(ctx, 0.70, 0.30, 0.80, 0.50, accent, 0.2);

  // Central containment ring
  luminariRing(ctx, 0.50, 0.44, 0.16, 0.07, accent);

  // Flanking launch bay rings
  luminariRing(ctx, 0.28, 0.50, 0.10, 0.06, accent);
  luminariRing(ctx, 0.72, 0.50, 0.10, 0.06, accent);

  // Antenna spars — wide sweep
  luminariAntenna(ctx, 0.18, 0.30, 0.06, 0.18, accent);
  luminariAntenna(ctx, 0.82, 0.30, 0.94, 0.18, accent);
  // Dorsal spar
  luminariAntenna(ctx, 0.50, 0.30, 0.50, 0.06, accent);

  // Core node
  luminariNode(ctx, 0.50, 0.44, 0.032, accent);

  // Launch bay nodes
  luminariNode(ctx, 0.28, 0.50, 0.020, accent);
  luminariNode(ctx, 0.72, 0.50, 0.020, accent);

  // Junction nodes along braces
  luminariNode(ctx, 0.18, 0.50, 0.008, accent);
  luminariNode(ctx, 0.82, 0.50, 0.008, accent);
  luminariNode(ctx, 0.38, 0.30, 0.008, accent);
  luminariNode(ctx, 0.62, 0.30, 0.008, accent);

  // Bow node
  luminariNode(ctx, 0.50, 0.12, 0.016, accent);

  // Aft glow — spread wide
  luminariNode(ctx, 0.34, 0.82, 0.018, accent);
  luminariNode(ctx, 0.50, 0.84, 0.014, accent);
  luminariNode(ctx, 0.66, 0.82, 0.018, accent);
}

function luminariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // The largest combat lattice — three stacked containment rings, a dense
  // web of rods and braces, a corona of energy nodes around the core, and
  // the signature tilted ring (the asymmetric flourish). This ship looks
  // like a captured piece of the Cygnus Radiant held in a cage of light.

  // Dense longitudinal lattice — eight rods
  luminariRod(ctx, 0.30, 0.90, 0.42, 0.06, accent);
  luminariRod(ctx, 0.70, 0.90, 0.58, 0.06, accent);
  luminariRod(ctx, 0.34, 0.88, 0.44, 0.08, accent, 0.3);
  luminariRod(ctx, 0.66, 0.88, 0.56, 0.08, accent, 0.3);
  luminariRod(ctx, 0.38, 0.88, 0.46, 0.10, accent, 0.2);
  luminariRod(ctx, 0.62, 0.88, 0.54, 0.10, accent, 0.2);
  // Central spine and dorsal line
  luminariRod(ctx, 0.50, 0.06, 0.50, 0.90, accent, 0.18);
  luminariRod(ctx, 0.48, 0.08, 0.48, 0.88, accent, 0.12);

  // Transverse braces — five layers
  luminariRod(ctx, 0.26, 0.22, 0.74, 0.22, accent, 0.3);
  luminariRod(ctx, 0.24, 0.38, 0.76, 0.38, accent, 0.35);
  luminariRod(ctx, 0.24, 0.54, 0.76, 0.54, accent, 0.35);
  luminariRod(ctx, 0.26, 0.70, 0.74, 0.70, accent, 0.3);
  luminariRod(ctx, 0.30, 0.86, 0.70, 0.86, accent, 0.25);

  // Diagonal cross-braces (the lattice thickens)
  luminariRod(ctx, 0.32, 0.22, 0.24, 0.38, accent, 0.18);
  luminariRod(ctx, 0.68, 0.22, 0.76, 0.38, accent, 0.18);
  luminariRod(ctx, 0.24, 0.54, 0.30, 0.70, accent, 0.18);
  luminariRod(ctx, 0.76, 0.54, 0.70, 0.70, accent, 0.18);

  // Forward containment ring
  luminariRing(ctx, 0.50, 0.26, 0.22, 0.07, accent);
  // Mid containment ring (largest)
  luminariRing(ctx, 0.50, 0.48, 0.26, 0.09, accent);
  // Aft containment ring
  luminariRing(ctx, 0.50, 0.72, 0.24, 0.08, accent);

  // Tilted asymmetric ring — the scatterbrained genius flourish
  ctx.save();
  ctx.translate(0.50, 0.36);
  ctx.rotate(0.35);  // ~20 degrees — jaunty, not sloppy
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.15, 0.05, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  ctx.restore();

  // Antenna spars — full array, six whiskers
  luminariAntenna(ctx, 0.28, 0.26, 0.10, 0.14, accent);
  luminariAntenna(ctx, 0.72, 0.26, 0.90, 0.14, accent);
  luminariAntenna(ctx, 0.24, 0.48, 0.06, 0.42, accent);
  luminariAntenna(ctx, 0.76, 0.48, 0.94, 0.42, accent);
  luminariAntenna(ctx, 0.26, 0.70, 0.12, 0.68, accent);
  luminariAntenna(ctx, 0.74, 0.70, 0.88, 0.68, accent);

  // Core node — large, brilliant
  luminariNode(ctx, 0.50, 0.46, 0.040, accent);

  // Corona nodes around the core
  const coronaNodes: [number, number][] = [
    [0.40, 0.40], [0.60, 0.40], [0.38, 0.52], [0.62, 0.52],
    [0.44, 0.36], [0.56, 0.36],
  ];
  for (const [nx, ny] of coronaNodes) {
    luminariNode(ctx, nx, ny, 0.010, accent);
  }

  // Ring junction nodes
  luminariNode(ctx, 0.28, 0.26, 0.010, accent);
  luminariNode(ctx, 0.72, 0.26, 0.010, accent);
  luminariNode(ctx, 0.24, 0.48, 0.010, accent);
  luminariNode(ctx, 0.76, 0.48, 0.010, accent);

  // Bow focus node
  luminariNode(ctx, 0.50, 0.06, 0.020, accent);

  // Aft glow — four exhaust nodes
  luminariNode(ctx, 0.38, 0.90, 0.022, accent);
  luminariNode(ctx, 0.50, 0.92, 0.018, accent);
  luminariNode(ctx, 0.62, 0.90, 0.022, accent);
  luminariNode(ctx, 0.44, 0.88, 0.014, accent);
}

function luminariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // A spherical containment lattice — fundamentally different silhouette from
  // all other Luminari hulls. The coloniser must carry the field-pattern of
  // a Luminari across interstellar distances, maintaining it for years. The
  // design is a geodesic cage: six great-circle arcs forming a sphere, with
  // a brilliant core and habitat ring. It looks like a Dyson cage in miniature.

  // Geodesic cage arcs — three great circles at different orientations
  // Equatorial ring
  luminariRing(ctx, 0.50, 0.48, 0.30, 0.30, accent);
  // Meridian ring (vertical)
  luminariRing(ctx, 0.50, 0.48, 0.08, 0.30, accent);
  // Tilted meridian
  luminariRing(ctx, 0.50, 0.48, 0.22, 0.28, accent);

  // Lattice rods connecting ring intersections
  luminariRod(ctx, 0.50, 0.18, 0.50, 0.78, accent, 0.25);
  luminariRod(ctx, 0.20, 0.48, 0.80, 0.48, accent, 0.25);
  // Diagonal rods
  luminariRod(ctx, 0.28, 0.24, 0.72, 0.72, accent, 0.18);
  luminariRod(ctx, 0.72, 0.24, 0.28, 0.72, accent, 0.18);

  // Habitat containment ring — smaller, centred, glowing more intensely
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.15, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.008;
  ctx.stroke();
  // Inner glow of habitat ring
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.13, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.015;
  ctx.stroke();

  // Core node — the brightest, carrying the colonist field-pattern
  luminariNode(ctx, 0.50, 0.48, 0.042, accent);

  // Cage intersection nodes (where great circles cross)
  const intersections: [number, number][] = [
    [0.50, 0.18], [0.50, 0.78],  // poles
    [0.20, 0.48], [0.80, 0.48],  // equatorial extremes
    [0.30, 0.28], [0.70, 0.28],  // upper hemisphere
    [0.30, 0.68], [0.70, 0.68],  // lower hemisphere
  ];
  for (const [nx, ny] of intersections) {
    luminariNode(ctx, nx, ny, 0.012, accent);
  }

  // Aft propulsion glow — broader, gentle
  luminariNode(ctx, 0.50, 0.82, 0.025, accent);
  luminariNode(ctx, 0.40, 0.78, 0.014, accent);
  luminariNode(ctx, 0.60, 0.78, 0.014, accent);
}


// ============================================================================
//  EXPORTS (for integration reference)
// ============================================================================
//
//  3D:
//    - Replace buildLuminari in ShipModels3D.ts (lines 674-760)
//    - Material already correct in SPECIES_MATERIALS (lines 1427-1435)
//
//  2D:
//    - Add 'luminari' design family to DesignFamily type
//    - Add luminari: 'luminari' to SPECIES_DESIGN_FAMILY mapping
//    - Register all seven draw functions in the family lookup
//
//  Function exports for ShipDesignFamilies.ts integration:

// ===========================================================================
//  ZORVATHI
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — ZORVATHI "CHITIN" FAMILY
// =============================================================================
//
// All functions operate in a normalised 1x1 coordinate space.
// Ships face nose-UP (fore = top of canvas). accent = hex colour string.
// Each hull class has a distinct silhouette rooted in the arthropod body plan.


// ── Shared drawing primitives ───────────────────────────────────────────────

/** Amber engine glow — vibration-drive emission. */
function chitinEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(255,190,80,0.55)');
  bloom.addColorStop(0.5, 'rgba(200,130,30,0.20)');
  bloom.addColorStop(1,   'rgba(120,60,10,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,230,180,1)');
  core.addColorStop(0.4, 'rgba(220,160,50,0.85)');
  core.addColorStop(1,   'rgba(140,70,10,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Dark chitin fill gradient with amber accent outline. */
function chitinFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.1, 0.7, 0.9);
  grad.addColorStop(0,   '#4a3828');
  grad.addColorStop(0.35, '#3a2a1a');
  grad.addColorStop(0.7,  '#2a1e12');
  grad.addColorStop(1,   '#1c140c');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

/** Draw a body segment outline (horizontal ellipse). */
function segmentOutline(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number, accent: string,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/** Compound eye sensor dome. */
function compoundEye(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
  grad.addColorStop(0,   'rgba(255,220,120,1)');
  grad.addColorStop(0.4, 'rgba(200,160,40,0.9)');
  grad.addColorStop(1,   'rgba(100,70,10,0.3)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/** Pheromone amplifier pattern — geometric lines scored into hull. */
function bioitePattern(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number, accent: string,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.003;
  // Chevron pattern (tunnel-wall motif)
  const h = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy + h * 0.3);
  ctx.lineTo(cx, cy - h * 0.3);
  ctx.lineTo(cx + size * 0.4, cy + h * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.25, cy + h * 0.5);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + size * 0.25, cy + h * 0.5);
  ctx.stroke();
}


// ── SCOUT — 3-segment grub with mandibles ───────────────────────────────────

function zorvathiScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Small, fast — a young larval form. Three segments, stubby mandibles,
  // single pair of antennae. The simplest Zorvathi silhouette.

  // Body: three overlapping ellipses, head smallest
  // Head segment
  ctx.beginPath();
  ctx.ellipse(0.50, 0.24, 0.10, 0.08, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Thorax segment (widest)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.40, 0.13, 0.11, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Abdomen segment
  ctx.beginPath();
  ctx.ellipse(0.50, 0.58, 0.11, 0.12, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);

  // Segment seam lines (amber glow between segments)
  segmentOutline(ctx, 0.50, 0.32, 0.09, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.49, 0.10, 0.03, accent);

  // Mandibles — two forward-swept lines
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.010;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.20);
  ctx.bezierCurveTo(0.40, 0.14, 0.38, 0.10, 0.40, 0.06);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.20);
  ctx.bezierCurveTo(0.60, 0.14, 0.62, 0.10, 0.60, 0.06);
  ctx.stroke();

  // Antennae — thin sensory whips
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0.46, 0.18);
  ctx.bezierCurveTo(0.42, 0.10, 0.36, 0.06, 0.32, 0.03);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.54, 0.18);
  ctx.bezierCurveTo(0.58, 0.10, 0.64, 0.06, 0.68, 0.03);
  ctx.stroke();

  // Compound eye
  compoundEye(ctx, 0.50, 0.20, 0.025);

  // Vibration-drive glow at tail
  chitinEngineGlow(ctx, 0.50, 0.68, 0.030);
}


// ── DESTROYER — 4 segments, legs, dorsal ridge ──────────────────────────────

function zorvathiDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // A proper arthropod warship. Four body segments, two pairs of
  // leg-struts, visible dorsal ridge, and heavier mandibles.

  // Head
  ctx.beginPath();
  ctx.ellipse(0.50, 0.18, 0.10, 0.07, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Prothorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.32, 0.14, 0.09, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Mesothorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.50, 0.15, 0.11, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Abdomen
  ctx.beginPath();
  ctx.ellipse(0.50, 0.68, 0.12, 0.12, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);

  // Segment seam lines
  segmentOutline(ctx, 0.50, 0.25, 0.10, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.41, 0.12, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.59, 0.11, 0.03, accent);

  // Dorsal ridge line (centre spine)
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.22);
  ctx.lineTo(0.50, 0.74);
  ctx.stroke();

  // Mandibles — heavier, with inner serrations
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.15);
  ctx.bezierCurveTo(0.38, 0.08, 0.35, 0.04, 0.38, 0.01);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.15);
  ctx.bezierCurveTo(0.62, 0.08, 0.65, 0.04, 0.62, 0.01);
  ctx.stroke();
  // Inner mandible edges
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.46, 0.14);
  ctx.bezierCurveTo(0.44, 0.09, 0.42, 0.06, 0.44, 0.03);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.54, 0.14);
  ctx.bezierCurveTo(0.56, 0.09, 0.58, 0.06, 0.56, 0.03);
  ctx.stroke();

  // Leg-struts — 2 pairs
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.008;
  const legYs = [0.36, 0.54];
  for (const ly of legYs) {
    // Left leg
    ctx.beginPath();
    ctx.moveTo(0.36, ly);
    ctx.lineTo(0.22, ly + 0.04);
    ctx.lineTo(0.18, ly + 0.08);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(0.64, ly);
    ctx.lineTo(0.78, ly + 0.04);
    ctx.lineTo(0.82, ly + 0.08);
    ctx.stroke();
  }

  // Antennae
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.45, 0.14);
  ctx.bezierCurveTo(0.38, 0.06, 0.30, 0.02, 0.24, 0.00);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.55, 0.14);
  ctx.bezierCurveTo(0.62, 0.06, 0.70, 0.02, 0.76, 0.00);
  ctx.stroke();

  // Bioite pattern on thorax
  bioitePattern(ctx, 0.50, 0.42, 0.18, accent);

  // Compound eyes
  compoundEye(ctx, 0.44, 0.16, 0.020);
  compoundEye(ctx, 0.56, 0.16, 0.020);

  // Engine glow
  chitinEngineGlow(ctx, 0.50, 0.78, 0.035);
}


// ── TRANSPORT — fat grub, wide thorax, stubby legs ──────────────────────────

function zorvathiTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // A cargo grub — swollen middle segments for hauling material.
  // Wide, slow, unmistakably a beast of burden.

  // Head (small)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.16, 0.10, 0.06, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Prothorax (widening)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.28, 0.16, 0.08, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Cargo thorax 1 (very wide)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.44, 0.22, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Cargo thorax 2 (very wide)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.60, 0.22, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Abdomen (tapering)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.74, 0.14, 0.08, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);

  // Segment seams
  segmentOutline(ctx, 0.50, 0.22, 0.11, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.36, 0.16, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.52, 0.19, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.67, 0.15, 0.03, accent);

  // Cargo segment markings — horizontal bands
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.004;
  for (let y = 0.38; y <= 0.66; y += 0.07) {
    ctx.beginPath();
    ctx.moveTo(0.30, y); ctx.lineTo(0.70, y);
    ctx.stroke();
  }

  // Short mandibles (non-combat)
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.13);
  ctx.bezierCurveTo(0.42, 0.09, 0.41, 0.06, 0.43, 0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.13);
  ctx.bezierCurveTo(0.58, 0.09, 0.59, 0.06, 0.57, 0.04);
  ctx.stroke();

  // Stubby leg-struts — 3 pairs (load-bearing)
  ctx.strokeStyle = withAlpha(accent, 0.40);
  ctx.lineWidth = 0.010;
  const tlegYs = [0.32, 0.48, 0.64];
  for (const ly of tlegYs) {
    ctx.beginPath();
    ctx.moveTo(0.30, ly); ctx.lineTo(0.20, ly + 0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.70, ly); ctx.lineTo(0.80, ly + 0.02);
    ctx.stroke();
  }

  // Internal cargo glow (amber warmth through chitin)
  const cargoGlow = ctx.createRadialGradient(0.50, 0.52, 0, 0.50, 0.52, 0.18);
  cargoGlow.addColorStop(0,   withAlpha(accent, 0.20));
  cargoGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.52, 0.18, 0, Math.PI * 2);
  ctx.fillStyle = cargoGlow;
  ctx.fill();

  compoundEye(ctx, 0.50, 0.13, 0.022);
  chitinEngineGlow(ctx, 0.44, 0.80, 0.028);
  chitinEngineGlow(ctx, 0.56, 0.80, 0.028);
}


// ── CRUISER — 5 segments, elytra, weapon blisters ──────────────────────────

function zorvathiCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // The cruiser is where the Zorvathi body plan reaches maturity.
  // Five segments, full elytra wing cases, weapon blisters, and the
  // classic trilobite profile.

  // Head
  ctx.beginPath();
  ctx.ellipse(0.50, 0.12, 0.10, 0.06, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Prothorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.24, 0.14, 0.07, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Mesothorax (widest — elytra base)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.40, 0.17, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Metathorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.58, 0.16, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Abdomen
  ctx.beginPath();
  ctx.ellipse(0.50, 0.74, 0.12, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);

  // Segment seams
  segmentOutline(ctx, 0.50, 0.18, 0.10, 0.02, accent);
  segmentOutline(ctx, 0.50, 0.32, 0.13, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.49, 0.14, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.66, 0.12, 0.03, accent);

  // Elytra wing casings — elongated arcs flanking the body
  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  // Left elytron
  ctx.beginPath();
  ctx.moveTo(0.34, 0.30);
  ctx.bezierCurveTo(0.18, 0.34, 0.14, 0.50, 0.16, 0.64);
  ctx.bezierCurveTo(0.18, 0.72, 0.26, 0.76, 0.34, 0.72);
  ctx.bezierCurveTo(0.36, 0.60, 0.35, 0.42, 0.34, 0.30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Right elytron
  ctx.beginPath();
  ctx.moveTo(0.66, 0.30);
  ctx.bezierCurveTo(0.82, 0.34, 0.86, 0.50, 0.84, 0.64);
  ctx.bezierCurveTo(0.82, 0.72, 0.74, 0.76, 0.66, 0.72);
  ctx.bezierCurveTo(0.64, 0.60, 0.65, 0.42, 0.66, 0.30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Elytra vein lines
  ctx.strokeStyle = withAlpha(accent, 0.20);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.moveTo(0.28, 0.38); ctx.bezierCurveTo(0.22, 0.48, 0.22, 0.58, 0.26, 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.72, 0.38); ctx.bezierCurveTo(0.78, 0.48, 0.78, 0.58, 0.74, 0.68);
  ctx.stroke();

  // Mandibles — combat grade
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0.43, 0.10);
  ctx.bezierCurveTo(0.36, 0.04, 0.32, 0.00, 0.35, -0.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.57, 0.10);
  ctx.bezierCurveTo(0.64, 0.04, 0.68, 0.00, 0.65, -0.02);
  ctx.stroke();

  // Leg-struts — 3 pairs
  ctx.strokeStyle = withAlpha(accent, 0.40);
  ctx.lineWidth = 0.007;
  const clegYs = [0.28, 0.44, 0.62];
  for (const ly of clegYs) {
    ctx.beginPath();
    ctx.moveTo(0.35, ly); ctx.lineTo(0.22, ly + 0.03); ctx.lineTo(0.18, ly + 0.07);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.65, ly); ctx.lineTo(0.78, ly + 0.03); ctx.lineTo(0.82, ly + 0.07);
    ctx.stroke();
  }

  // Weapon blisters on thorax
  const blisters: [number, number][] = [[0.38, 0.34], [0.62, 0.34], [0.36, 0.52], [0.64, 0.52]];
  for (const [bx, by] of blisters) {
    ctx.beginPath();
    ctx.arc(bx, by, 0.025, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.30);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Dorsal ridge
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.16); ctx.lineTo(0.50, 0.78);
  ctx.stroke();

  // Bioite patterns
  bioitePattern(ctx, 0.50, 0.36, 0.16, accent);
  bioitePattern(ctx, 0.50, 0.56, 0.14, accent);

  // Antennae
  ctx.strokeStyle = withAlpha(accent, 0.28);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.10);
  ctx.bezierCurveTo(0.36, 0.02, 0.26, -0.02, 0.20, -0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.10);
  ctx.bezierCurveTo(0.64, 0.02, 0.74, -0.02, 0.80, -0.04);
  ctx.stroke();

  compoundEye(ctx, 0.44, 0.10, 0.018);
  compoundEye(ctx, 0.56, 0.10, 0.018);
  chitinEngineGlow(ctx, 0.44, 0.82, 0.032);
  chitinEngineGlow(ctx, 0.56, 0.82, 0.032);
}


// ── CARRIER — broad flat carapace, launch bays in elytra ────────────────────

function zorvathiCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // A massive beetle-form with oversized elytra containing launch bays.
  // The widest Zorvathi silhouette — a flying fortress of chitin.

  // Head (proportionally small)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.12, 0.10, 0.05, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Prothorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.22, 0.15, 0.06, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Main thorax (wide, flat platform)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.42, 0.18, 0.12, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Metathorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.62, 0.16, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Abdomen
  ctx.beginPath();
  ctx.ellipse(0.50, 0.78, 0.12, 0.08, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);

  // Segment seams
  segmentOutline(ctx, 0.50, 0.17, 0.11, 0.02, accent);
  segmentOutline(ctx, 0.50, 0.32, 0.14, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.52, 0.15, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.70, 0.12, 0.03, accent);

  // Oversized elytra with launch bay openings
  ctx.fillStyle = withAlpha(accent, 0.08);
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.006;
  // Left elytron (huge)
  ctx.beginPath();
  ctx.moveTo(0.33, 0.22);
  ctx.bezierCurveTo(0.10, 0.28, 0.06, 0.48, 0.08, 0.66);
  ctx.bezierCurveTo(0.10, 0.78, 0.22, 0.82, 0.33, 0.76);
  ctx.bezierCurveTo(0.34, 0.58, 0.34, 0.38, 0.33, 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Right elytron (huge)
  ctx.beginPath();
  ctx.moveTo(0.67, 0.22);
  ctx.bezierCurveTo(0.90, 0.28, 0.94, 0.48, 0.92, 0.66);
  ctx.bezierCurveTo(0.90, 0.78, 0.78, 0.82, 0.67, 0.76);
  ctx.bezierCurveTo(0.66, 0.58, 0.66, 0.38, 0.67, 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Launch bays (dark openings in elytra)
  ctx.fillStyle = 'rgba(10,8,4,0.6)';
  // Left bays
  ctx.beginPath();
  ctx.ellipse(0.20, 0.38, 0.06, 0.03, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.18, 0.52, 0.06, 0.03, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.20, 0.66, 0.06, 0.03, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Right bays
  ctx.beginPath();
  ctx.ellipse(0.80, 0.38, 0.06, 0.03, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.82, 0.52, 0.06, 0.03, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.80, 0.66, 0.06, 0.03, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Mandibles (shortened — carrier is not a brawler)
  ctx.strokeStyle = withAlpha(accent, 0.50);
  ctx.lineWidth = 0.010;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.10);
  ctx.bezierCurveTo(0.40, 0.06, 0.39, 0.03, 0.41, 0.01);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.10);
  ctx.bezierCurveTo(0.60, 0.06, 0.61, 0.03, 0.59, 0.01);
  ctx.stroke();

  // Legs — 4 pairs (heavy load)
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  const klegYs = [0.26, 0.38, 0.54, 0.68];
  for (const ly of klegYs) {
    ctx.beginPath();
    ctx.moveTo(0.34, ly); ctx.lineTo(0.24, ly + 0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.66, ly); ctx.lineTo(0.76, ly + 0.02);
    ctx.stroke();
  }

  // Dorsal ridge
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.16); ctx.lineTo(0.50, 0.82);
  ctx.stroke();

  // Elytra vein pattern
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.moveTo(0.24, 0.32); ctx.bezierCurveTo(0.16, 0.44, 0.14, 0.56, 0.18, 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.76, 0.32); ctx.bezierCurveTo(0.84, 0.44, 0.86, 0.56, 0.82, 0.72);
  ctx.stroke();

  // Antennae
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.10);
  ctx.bezierCurveTo(0.34, 0.02, 0.24, -0.02, 0.18, -0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.10);
  ctx.bezierCurveTo(0.66, 0.02, 0.76, -0.02, 0.82, -0.04);
  ctx.stroke();

  compoundEye(ctx, 0.44, 0.10, 0.018);
  compoundEye(ctx, 0.56, 0.10, 0.018);
  chitinEngineGlow(ctx, 0.42, 0.84, 0.030);
  chitinEngineGlow(ctx, 0.50, 0.86, 0.025);
  chitinEngineGlow(ctx, 0.58, 0.84, 0.030);
}


// ── BATTLESHIP — massive trilobite, 6 segments, full armament ───────────────

function zorvathiBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // The apex predator of the hive fleet. Six body segments forming a
  // massive trilobite profile: broad, heavily armoured, bristling with
  // weapon blisters, crowned with pheromone relay spines, and bearing
  // a lethal tail stinger.

  // Head
  ctx.beginPath();
  ctx.ellipse(0.50, 0.08, 0.12, 0.05, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Prothorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.18, 0.16, 0.06, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Mesothorax (widest)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.32, 0.20, 0.09, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Metathorax
  ctx.beginPath();
  ctx.ellipse(0.50, 0.48, 0.19, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Abdomen
  ctx.beginPath();
  ctx.ellipse(0.50, 0.64, 0.16, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Tail segment
  ctx.beginPath();
  ctx.ellipse(0.50, 0.78, 0.12, 0.08, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);

  // Segment seams
  segmentOutline(ctx, 0.50, 0.13, 0.12, 0.02, accent);
  segmentOutline(ctx, 0.50, 0.25, 0.15, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.40, 0.17, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.56, 0.15, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.71, 0.12, 0.03, accent);

  // Elytra — large, armoured
  ctx.fillStyle = withAlpha(accent, 0.08);
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.32, 0.20);
  ctx.bezierCurveTo(0.12, 0.26, 0.08, 0.44, 0.10, 0.60);
  ctx.bezierCurveTo(0.12, 0.72, 0.22, 0.76, 0.32, 0.70);
  ctx.bezierCurveTo(0.33, 0.52, 0.33, 0.36, 0.32, 0.20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.68, 0.20);
  ctx.bezierCurveTo(0.88, 0.26, 0.92, 0.44, 0.90, 0.60);
  ctx.bezierCurveTo(0.88, 0.72, 0.78, 0.76, 0.68, 0.70);
  ctx.bezierCurveTo(0.67, 0.52, 0.67, 0.36, 0.68, 0.20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Heavy mandibles
  ctx.strokeStyle = withAlpha(accent, 0.65);
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0.42, 0.07);
  ctx.bezierCurveTo(0.34, 0.00, 0.30, -0.04, 0.34, -0.06);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.58, 0.07);
  ctx.bezierCurveTo(0.66, 0.00, 0.70, -0.04, 0.66, -0.06);
  ctx.stroke();
  // Inner mandibles
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(0.45, 0.06);
  ctx.bezierCurveTo(0.40, 0.00, 0.38, -0.03, 0.40, -0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.55, 0.06);
  ctx.bezierCurveTo(0.60, 0.00, 0.62, -0.03, 0.60, -0.04);
  ctx.stroke();

  // Tail stinger
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.010;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.84);
  ctx.bezierCurveTo(0.50, 0.88, 0.50, 0.92, 0.50, 0.96);
  ctx.stroke();
  // Stinger barbs
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.48, 0.90); ctx.lineTo(0.44, 0.94);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.52, 0.90); ctx.lineTo(0.56, 0.94);
  ctx.stroke();

  // Weapon blisters — 6 positions
  const bsPosns: [number, number][] = [
    [0.36, 0.24], [0.64, 0.24],
    [0.32, 0.40], [0.68, 0.40],
    [0.34, 0.56], [0.66, 0.56],
  ];
  for (const [bx, by] of bsPosns) {
    ctx.beginPath();
    ctx.arc(bx, by, 0.022, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.35);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.55);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Legs — 5 pairs
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  const blegYs = [0.22, 0.34, 0.46, 0.58, 0.68];
  for (const ly of blegYs) {
    ctx.beginPath();
    ctx.moveTo(0.32, ly); ctx.lineTo(0.20, ly + 0.02); ctx.lineTo(0.16, ly + 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.68, ly); ctx.lineTo(0.80, ly + 0.02); ctx.lineTo(0.84, ly + 0.06);
    ctx.stroke();
  }

  // Dorsal ridge with pheromone relay spines
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12); ctx.lineTo(0.50, 0.82);
  ctx.stroke();
  // Relay spines
  ctx.lineWidth = 0.004;
  const spineZs = [0.26, 0.38, 0.52];
  for (const sy of spineZs) {
    ctx.beginPath();
    ctx.moveTo(0.50, sy); ctx.lineTo(0.48, sy - 0.04);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.50, sy); ctx.lineTo(0.52, sy - 0.04);
    ctx.stroke();
  }

  // Bioite patterns
  bioitePattern(ctx, 0.50, 0.30, 0.18, accent);
  bioitePattern(ctx, 0.50, 0.48, 0.16, accent);
  bioitePattern(ctx, 0.50, 0.64, 0.14, accent);

  // Elytra veins
  ctx.strokeStyle = withAlpha(accent, 0.16);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.moveTo(0.24, 0.30); ctx.bezierCurveTo(0.16, 0.42, 0.14, 0.54, 0.18, 0.66);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.76, 0.30); ctx.bezierCurveTo(0.84, 0.42, 0.86, 0.54, 0.82, 0.66);
  ctx.stroke();

  // Antennae (compound — split tips)
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.43, 0.06);
  ctx.bezierCurveTo(0.32, -0.02, 0.20, -0.06, 0.14, -0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.57, 0.06);
  ctx.bezierCurveTo(0.68, -0.02, 0.80, -0.06, 0.86, -0.08);
  ctx.stroke();
  // Split tips
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.moveTo(0.16, -0.07); ctx.lineTo(0.12, -0.10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.16, -0.07); ctx.lineTo(0.18, -0.10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.84, -0.07); ctx.lineTo(0.88, -0.10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.84, -0.07); ctx.lineTo(0.82, -0.10);
  ctx.stroke();

  compoundEye(ctx, 0.44, 0.06, 0.018);
  compoundEye(ctx, 0.56, 0.06, 0.018);
  chitinEngineGlow(ctx, 0.40, 0.86, 0.034);
  chitinEngineGlow(ctx, 0.50, 0.88, 0.028);
  chitinEngineGlow(ctx, 0.60, 0.86, 0.034);
}


// ── COLONISER — seed pod / queen's chamber ──────────────────────────────────

function zorvathiColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // The coloniser is not a warship but a queen's migration vessel.
  // It resembles a massive egg case or chrysalis: swollen central
  // segments housing millions of dormant hive nodes, wrapped in
  // protective chitin plating, with minimal weaponry and robust
  // vibration-drive emitters.

  // Head (navigation cluster)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.12, 0.10, 0.05, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Protective cowl
  ctx.beginPath();
  ctx.ellipse(0.50, 0.22, 0.15, 0.06, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Brood chamber 1 (swelling)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.38, 0.20, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Brood chamber 2 (largest — the queen's chamber)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.56, 0.22, 0.12, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);
  // Abdomen (tapering to drives)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.72, 0.16, 0.10, 0, 0, Math.PI * 2);
  chitinFill(ctx, accent);

  // Segment seams
  segmentOutline(ctx, 0.50, 0.17, 0.11, 0.02, accent);
  segmentOutline(ctx, 0.50, 0.30, 0.15, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.47, 0.18, 0.03, accent);
  segmentOutline(ctx, 0.50, 0.64, 0.17, 0.03, accent);

  // Queen's chamber internal glow — amber warmth of millions of nodes
  const queenGlow = ctx.createRadialGradient(0.50, 0.50, 0, 0.50, 0.50, 0.22);
  queenGlow.addColorStop(0,   withAlpha(accent, 0.35));
  queenGlow.addColorStop(0.5, withAlpha(accent, 0.15));
  queenGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.50, 0.22, 0, Math.PI * 2);
  ctx.fillStyle = queenGlow;
  ctx.fill();

  // Protective carapace ribs arching over brood chambers
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.30, 0.30);
  ctx.bezierCurveTo(0.28, 0.44, 0.28, 0.58, 0.34, 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.70, 0.30);
  ctx.bezierCurveTo(0.72, 0.44, 0.72, 0.58, 0.66, 0.68);
  ctx.stroke();
  // Central rib
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.16); ctx.lineTo(0.50, 0.78);
  ctx.stroke();

  // Brood chamber membrane patterns (hexagonal, like honeycomb)
  ctx.strokeStyle = withAlpha(accent, 0.15);
  ctx.lineWidth = 0.003;
  const hexCentres: [number, number][] = [
    [0.42, 0.42], [0.58, 0.42], [0.50, 0.50],
    [0.42, 0.58], [0.58, 0.58],
  ];
  for (const [hx, hy] of hexCentres) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = hx + 0.04 * Math.cos(a);
      const py = hy + 0.04 * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Short mandibles (defensive only)
  ctx.strokeStyle = withAlpha(accent, 0.40);
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.10);
  ctx.bezierCurveTo(0.42, 0.06, 0.41, 0.04, 0.43, 0.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.10);
  ctx.bezierCurveTo(0.58, 0.06, 0.59, 0.04, 0.57, 0.02);
  ctx.stroke();

  // Stubby legs — 2 pairs (minimal, this is not a combat vessel)
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.beginPath();
  ctx.moveTo(0.30, 0.40); ctx.lineTo(0.22, 0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.70, 0.40); ctx.lineTo(0.78, 0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.30, 0.60); ctx.lineTo(0.22, 0.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.70, 0.60); ctx.lineTo(0.78, 0.62);
  ctx.stroke();

  // Antennae (short — navigation only)
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.44, 0.10);
  ctx.bezierCurveTo(0.38, 0.04, 0.32, 0.01, 0.28, 0.00);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.56, 0.10);
  ctx.bezierCurveTo(0.62, 0.04, 0.68, 0.01, 0.72, 0.00);
  ctx.stroke();

  compoundEye(ctx, 0.50, 0.10, 0.020);
  chitinEngineGlow(ctx, 0.42, 0.80, 0.032);
  chitinEngineGlow(ctx, 0.58, 0.80, 0.032);
}


// =============================================================================
//  EXPORTS — for integration into ShipModels3D.ts and ShipDesignFamilies.ts

// ===========================================================================
//  ORIVANI
// ===========================================================================

// Section 4: 2D Wireframes — Orivani "Theocratic" Family
// ════════════════════════════════════════════════════════════════════════════


// ── Shared Orivani drawing helpers ───────────────────────────────────────

/** Sanctified engine glow — amber-gold core, warm liturgical bloom. */
function orivaniEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom — warm gold haze
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(255,200,100,0.55)');
  bloom.addColorStop(0.4, 'rgba(255,170,50,0.3)');
  bloom.addColorStop(1,   'rgba(200,120,20,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-hot liturgical fire
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,245,220,1)');
  core.addColorStop(0.35, 'rgba(255,190,80,0.9)');
  core.addColorStop(1,   'rgba(220,140,40,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Ivory-gold hull fill with accent trim — theocratic temple stone. */
function orivaniFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.1, 0.7, 0.9);
  grad.addColorStop(0,   '#e8dcc8');   // warm ivory highlight
  grad.addColorStop(0.3, '#d4c4a8');   // temple stone midtone
  grad.addColorStop(0.7, '#bfad8e');   // aged sanctified stone
  grad.addColorStop(1,   '#a89470');   // shadowed base
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

/** Stained-glass viewport — warm golden light strip. */
function orivaniViewport(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0,   'rgba(255,210,120,0.75)');
  g.addColorStop(0.5, 'rgba(255,180,60,0.9)');
  g.addColorStop(1,   'rgba(220,150,40,0.7)');
  ctx.fillStyle = g;
  ctx.fill();
}

/** Dorsal spire accent — small upward-pointing triangle on the hull. */
function orivaniSpire(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number,
  halfW: number, tipH: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, baseY - tipH);
  ctx.lineTo(cx - halfW, baseY);
  ctx.lineTo(cx + halfW, baseY);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.45);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.65);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/** Buttress arc — curved line from hull edge outward. */
function orivaniButtress(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  cpx: number, cpy: number,
  x2: number, y2: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

// ── The seven wireframe functions ────────────────────────────────────────

/**
 * SCOUT — "Pilgrim Lance"
 * Narrow blade with a single dorsal spire. The smallest expression of
 * faith: a single devotee racing ahead to scan for signs of the Coming.
 * Silhouette: narrow vertical dart with pointed nose, one spire accent.
 */
function orivaniScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — narrow devotional blade, pointed nose
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // pointed bow tip — the lance
  ctx.lineTo(0.43, 0.22);   // shoulder taper
  ctx.lineTo(0.40, 0.48);   // narrowing mid
  ctx.lineTo(0.38, 0.72);   // wider aft
  ctx.lineTo(0.42, 0.82);   // engine housing
  ctx.lineTo(0.58, 0.82);
  ctx.lineTo(0.62, 0.72);
  ctx.lineTo(0.60, 0.48);
  ctx.lineTo(0.57, 0.22);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Dorsal spire — the prayer tower
  orivaniSpire(ctx, 0.50, 0.30, 0.025, 0.12, accent);

  // Nave accent stripe — central devotional marking
  ctx.beginPath();
  ctx.moveTo(0.47, 0.28); ctx.lineTo(0.47, 0.70);
  ctx.lineTo(0.53, 0.70); ctx.lineTo(0.53, 0.28);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();

  // Stained-glass viewport
  orivaniViewport(ctx, 0.45, 0.14, 0.10, 0.02);

  // Sanctified engine
  orivaniEngineGlow(ctx, 0.50, 0.80, 0.028);
}

/**
 * DESTROYER — "Crusader's Hammer"
 * Wider hammerhead prow (the transept) with twin fore towers visible
 * as raised bumps. First ship where the cruciform shape is legible.
 * Silhouette: cross-shaped top, narrow stern with twin engines.
 */
function orivaniDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — cruciform nave with transept wings
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // pointed prow
  ctx.lineTo(0.38, 0.16);   // shoulder
  ctx.lineTo(0.24, 0.20);   // transept wing left
  ctx.lineTo(0.22, 0.28);   // transept base left
  ctx.lineTo(0.36, 0.30);   // rejoin nave
  ctx.lineTo(0.34, 0.70);   // long nave
  ctx.lineTo(0.38, 0.84);   // engine housing
  ctx.lineTo(0.62, 0.84);
  ctx.lineTo(0.66, 0.70);
  ctx.lineTo(0.64, 0.30);
  ctx.lineTo(0.78, 0.28);
  ctx.lineTo(0.76, 0.20);
  ctx.lineTo(0.62, 0.16);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Fore tower accents (paired spires flanking the prow)
  orivaniSpire(ctx, 0.32, 0.22, 0.020, 0.08, accent);
  orivaniSpire(ctx, 0.68, 0.22, 0.020, 0.08, accent);

  // Central spire
  orivaniSpire(ctx, 0.50, 0.36, 0.022, 0.10, accent);

  // Nave panels — devotional markings
  ctx.beginPath();
  ctx.moveTo(0.41, 0.32); ctx.lineTo(0.41, 0.68);
  ctx.lineTo(0.49, 0.68); ctx.lineTo(0.49, 0.32);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.16);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.51, 0.32); ctx.lineTo(0.51, 0.68);
  ctx.lineTo(0.59, 0.68); ctx.lineTo(0.59, 0.32);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.16);
  ctx.fill();

  // Viewport
  orivaniViewport(ctx, 0.43, 0.10, 0.14, 0.02);

  // Twin sanctified engines
  orivaniEngineGlow(ctx, 0.44, 0.82, 0.026);
  orivaniEngineGlow(ctx, 0.56, 0.82, 0.026);
}

/**
 * TRANSPORT — "Covenant Ark"
 * Wide-bodied nave with heavy buttressed flanks. Cargo bay hatches
 * visible as horizontal lines. Gothic arch cockpit. Carries the
 * resources of the faithful to where they are needed most.
 * Silhouette: broad rounded rectangle with Gothic pointed top.
 */
function orivaniTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — wide ark with Gothic pointed bow
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // Gothic arch peak
  ctx.lineTo(0.38, 0.15);   // arch shoulder left
  ctx.lineTo(0.28, 0.24);   // buttressed flank
  ctx.lineTo(0.24, 0.40);   // wide mid
  ctx.lineTo(0.24, 0.74);   // cargo hold
  ctx.lineTo(0.30, 0.84);   // engine taper
  ctx.lineTo(0.70, 0.84);
  ctx.lineTo(0.76, 0.74);
  ctx.lineTo(0.76, 0.40);
  ctx.lineTo(0.72, 0.24);
  ctx.lineTo(0.62, 0.15);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Cargo bay hatches — horizontal blessing-lines
  ctx.strokeStyle = 'rgba(80,60,30,0.3)';
  ctx.lineWidth = 0.005;
  for (let y = 0.34; y <= 0.72; y += 0.095) {
    ctx.beginPath();
    ctx.moveTo(0.27, y); ctx.lineTo(0.73, y);
    ctx.stroke();
  }

  // Buttress accents on flanks
  orivaniButtress(ctx, 0.28, 0.36, 0.20, 0.42, 0.28, 0.48, accent);
  orivaniButtress(ctx, 0.72, 0.36, 0.80, 0.42, 0.72, 0.48, accent);

  // Central spire
  orivaniSpire(ctx, 0.50, 0.26, 0.024, 0.10, accent);

  // Viewport
  orivaniViewport(ctx, 0.40, 0.12, 0.20, 0.02);

  // Twin engines
  orivaniEngineGlow(ctx, 0.40, 0.82, 0.028);
  orivaniEngineGlow(ctx, 0.60, 0.82, 0.028);
}

/**
 * CRUISER — "Temple Militant"
 * Full cruciform profile with flying buttress arcs visible. The first
 * ship class that truly reads as a "cathedral in space" from above.
 * Dorsal weapon turret platforms sit atop the buttress joints.
 * Silhouette: diamond hull with visible arch details and multiple spires.
 */
function orivaniCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — diamond nave with pronounced transept
  ctx.beginPath();
  ctx.moveTo(0.50, 0.05);   // sharp prow
  ctx.lineTo(0.36, 0.16);   // shoulder
  ctx.lineTo(0.24, 0.32);   // transept emergence
  ctx.lineTo(0.20, 0.48);   // widest — cathedral breadth
  ctx.lineTo(0.22, 0.68);   // aft taper
  ctx.lineTo(0.30, 0.80);   // engine housing
  ctx.lineTo(0.50, 0.88);   // stern point
  ctx.lineTo(0.70, 0.80);
  ctx.lineTo(0.78, 0.68);
  ctx.lineTo(0.80, 0.48);
  ctx.lineTo(0.76, 0.32);
  ctx.lineTo(0.64, 0.16);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Flying buttress arcs — THE signature visual element
  orivaniButtress(ctx, 0.36, 0.30, 0.18, 0.36, 0.24, 0.42, accent);
  orivaniButtress(ctx, 0.64, 0.30, 0.82, 0.36, 0.76, 0.42, accent);
  orivaniButtress(ctx, 0.34, 0.52, 0.16, 0.58, 0.24, 0.64, accent);
  orivaniButtress(ctx, 0.66, 0.52, 0.84, 0.58, 0.76, 0.64, accent);

  // Plate segment lines
  ctx.strokeStyle = 'rgba(80,60,30,0.25)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.28, 0.35); ctx.lineTo(0.72, 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.52); ctx.lineTo(0.76, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.28, 0.68); ctx.lineTo(0.72, 0.68); ctx.stroke();

  // Weapon turret platforms on buttress joints
  ctx.fillStyle = withAlpha(accent, 0.28);
  ctx.fillRect(0.24, 0.38, 0.06, 0.06);
  ctx.fillRect(0.70, 0.38, 0.06, 0.06);

  // Triple spires — central tall, flanking shorter
  orivaniSpire(ctx, 0.50, 0.28, 0.026, 0.14, accent);
  orivaniSpire(ctx, 0.38, 0.34, 0.018, 0.08, accent);
  orivaniSpire(ctx, 0.62, 0.34, 0.018, 0.08, accent);

  // Rose window at bow
  ctx.beginPath();
  ctx.arc(0.50, 0.14, 0.035, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.50, 0.14, 0.018, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,200,80,0.5)';
  ctx.fill();

  // Viewport
  orivaniViewport(ctx, 0.42, 0.09, 0.16, 0.02);

  // Twin engines
  orivaniEngineGlow(ctx, 0.40, 0.86, 0.030);
  orivaniEngineGlow(ctx, 0.60, 0.86, 0.030);
}

/**
 * CARRIER — "Reliquary Bastion"
 * Massive flat-decked cathedral with launch bays arrayed like chapel
 * niches along the flanks. Central command spire rises high. Launch bays
 * are dark recesses flanking a central nave corridor lit with gold.
 * Silhouette: broad rectangle with Gothic top, bay recesses, tall spire.
 */
function orivaniCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad basilica
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // Gothic arch peak
  ctx.lineTo(0.32, 0.14);   // arch shoulder
  ctx.lineTo(0.18, 0.26);   // wide flank
  ctx.lineTo(0.14, 0.48);   // broadest
  ctx.lineTo(0.16, 0.72);   // aft
  ctx.lineTo(0.24, 0.84);   // engine housing
  ctx.lineTo(0.76, 0.84);
  ctx.lineTo(0.84, 0.72);
  ctx.lineTo(0.86, 0.48);
  ctx.lineTo(0.82, 0.26);
  ctx.lineTo(0.68, 0.14);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Launch bays — dark chapel niches along the flanks
  ctx.fillStyle = 'rgba(15,10,5,0.55)';
  ctx.fillRect(0.20, 0.34, 0.14, 0.055);
  ctx.fillRect(0.66, 0.34, 0.14, 0.055);
  ctx.fillRect(0.20, 0.46, 0.14, 0.055);
  ctx.fillRect(0.66, 0.46, 0.14, 0.055);
  ctx.fillRect(0.20, 0.58, 0.14, 0.055);
  ctx.fillRect(0.66, 0.58, 0.14, 0.055);

  // Central nave corridor — lit with devotional gold
  ctx.beginPath();
  ctx.moveTo(0.45, 0.20); ctx.lineTo(0.45, 0.78);
  ctx.lineTo(0.55, 0.78); ctx.lineTo(0.55, 0.20);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.16);
  ctx.fill();

  // Flying buttress arcs connecting flanks to nave
  orivaniButtress(ctx, 0.38, 0.36, 0.24, 0.40, 0.20, 0.44, accent);
  orivaniButtress(ctx, 0.62, 0.36, 0.76, 0.40, 0.80, 0.44, accent);
  orivaniButtress(ctx, 0.38, 0.56, 0.24, 0.60, 0.20, 0.64, accent);
  orivaniButtress(ctx, 0.62, 0.56, 0.76, 0.60, 0.80, 0.64, accent);

  // Command spire — tall central tower
  orivaniSpire(ctx, 0.50, 0.24, 0.030, 0.16, accent);

  // Flanking pinnacles
  orivaniSpire(ctx, 0.30, 0.30, 0.016, 0.06, accent);
  orivaniSpire(ctx, 0.70, 0.30, 0.016, 0.06, accent);

  // Viewport
  orivaniViewport(ctx, 0.40, 0.10, 0.20, 0.02);

  // Triple sanctified engines
  orivaniEngineGlow(ctx, 0.34, 0.82, 0.028);
  orivaniEngineGlow(ctx, 0.50, 0.84, 0.024);
  orivaniEngineGlow(ctx, 0.66, 0.82, 0.028);
}

/**
 * BATTLESHIP — "Grand Cathedral"
 * The full expression of Orivani faith in warship form. Massive layered
 * hull with multiple buttress tiers, bell tower silhouettes, six weapon
 * turret platforms, and a forest of spires. When this arrives in battle,
 * every species knows who sent it.
 * Silhouette: enormous diamond with layered plates, arches, and spires.
 */
function orivaniBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — grand cathedral fortress
  ctx.beginPath();
  ctx.moveTo(0.50, 0.03);   // sharp sacred prow
  ctx.lineTo(0.34, 0.12);   // arch shoulder
  ctx.lineTo(0.20, 0.26);   // transept breadth
  ctx.lineTo(0.14, 0.46);   // widest — full cathedral span
  ctx.lineTo(0.16, 0.66);   // aft narrowing
  ctx.lineTo(0.24, 0.80);   // engine housing
  ctx.lineTo(0.36, 0.90);   // stern
  ctx.lineTo(0.64, 0.90);
  ctx.lineTo(0.76, 0.80);
  ctx.lineTo(0.84, 0.66);
  ctx.lineTo(0.86, 0.46);
  ctx.lineTo(0.80, 0.26);
  ctx.lineTo(0.66, 0.12);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Layered plate lines — cathedral stonework courses
  ctx.strokeStyle = 'rgba(80,60,30,0.25)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.26, 0.24); ctx.lineTo(0.74, 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.20, 0.38); ctx.lineTo(0.80, 0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.52); ctx.lineTo(0.82, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.20, 0.66); ctx.lineTo(0.80, 0.66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.78); ctx.lineTo(0.74, 0.78); ctx.stroke();

  // Flying buttress arcs — two tiers
  orivaniButtress(ctx, 0.38, 0.28, 0.18, 0.34, 0.20, 0.40, accent);
  orivaniButtress(ctx, 0.62, 0.28, 0.82, 0.34, 0.80, 0.40, accent);
  orivaniButtress(ctx, 0.36, 0.50, 0.14, 0.56, 0.18, 0.62, accent);
  orivaniButtress(ctx, 0.64, 0.50, 0.86, 0.56, 0.82, 0.62, accent);

  // Weapon turret platforms — six positions, integrated into architecture
  const turrets: [number, number][] = [
    [0.26, 0.30], [0.74, 0.30],  // forward turrets
    [0.18, 0.48], [0.82, 0.48],  // midship turrets
    [0.24, 0.64], [0.76, 0.64],  // aft turrets
  ];
  for (const [tx, ty] of turrets) {
    ctx.beginPath();
    ctx.rect(tx - 0.03, ty - 0.03, 0.06, 0.06);
    ctx.fillStyle = withAlpha(accent, 0.28);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Forest of spires — central grand spire + flanking minor spires
  orivaniSpire(ctx, 0.50, 0.22, 0.032, 0.18, accent);
  orivaniSpire(ctx, 0.40, 0.28, 0.020, 0.10, accent);
  orivaniSpire(ctx, 0.60, 0.28, 0.020, 0.10, accent);
  // Bell tower spires at stern
  orivaniSpire(ctx, 0.34, 0.74, 0.018, 0.08, accent);
  orivaniSpire(ctx, 0.66, 0.74, 0.018, 0.08, accent);

  // Rose window at bow — larger than cruiser
  ctx.beginPath();
  ctx.arc(0.50, 0.11, 0.042, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.006;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.50, 0.11, 0.022, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,200,80,0.55)';
  ctx.fill();

  // Grand viewport
  orivaniViewport(ctx, 0.38, 0.07, 0.24, 0.02);

  // Triple sanctified engines
  orivaniEngineGlow(ctx, 0.36, 0.88, 0.032);
  orivaniEngineGlow(ctx, 0.50, 0.90, 0.028);
  orivaniEngineGlow(ctx, 0.64, 0.88, 0.032);
}

/**
 * COLONISER — "Ark of the Covenant"
 * Sacred vessel bearing the faithful to new worlds. Heavy protective hull
 * with habitat window strips glowing with the warmth of settlements within.
 * Multiple buttress arcs and a prominent command spire. The most precious
 * ship in the fleet — to lose a coloniser is to betray the Coming.
 * Silhouette: rounded Gothic arch hull with window strips, buttresses, spires.
 */
function orivaniColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — protective ark, Gothic arch shape
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // Gothic arch peak
  ctx.lineTo(0.36, 0.14);   // arch shoulder
  ctx.lineTo(0.26, 0.26);   // protective flank
  ctx.lineTo(0.22, 0.46);   // widest — sanctuary breadth
  ctx.lineTo(0.24, 0.66);   // aft taper
  ctx.lineTo(0.30, 0.78);   // engine housing
  ctx.lineTo(0.40, 0.88);   // stern
  ctx.lineTo(0.60, 0.88);
  ctx.lineTo(0.70, 0.78);
  ctx.lineTo(0.76, 0.66);
  ctx.lineTo(0.78, 0.46);
  ctx.lineTo(0.74, 0.26);
  ctx.lineTo(0.64, 0.14);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Armour shell plating — protective courses
  ctx.strokeStyle = 'rgba(80,60,30,0.22)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.30, 0.24); ctx.lineTo(0.70, 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.38); ctx.lineTo(0.74, 0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.52); ctx.lineTo(0.76, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.66); ctx.lineTo(0.74, 0.66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.30, 0.78); ctx.lineTo(0.70, 0.78); ctx.stroke();

  // Habitat window strips — warm light of the faithful within
  orivaniViewport(ctx, 0.32, 0.30, 0.36, 0.018);
  orivaniViewport(ctx, 0.30, 0.44, 0.40, 0.018);
  orivaniViewport(ctx, 0.32, 0.58, 0.36, 0.018);

  // Flying buttress arcs — protecting the sacred cargo
  orivaniButtress(ctx, 0.36, 0.30, 0.20, 0.36, 0.26, 0.42, accent);
  orivaniButtress(ctx, 0.64, 0.30, 0.80, 0.36, 0.74, 0.42, accent);
  orivaniButtress(ctx, 0.34, 0.54, 0.18, 0.60, 0.26, 0.66, accent);
  orivaniButtress(ctx, 0.66, 0.54, 0.82, 0.60, 0.74, 0.66, accent);

  // Command spire — the shepherd's tower
  orivaniSpire(ctx, 0.50, 0.22, 0.028, 0.14, accent);
  // Flanking devotional spires
  orivaniSpire(ctx, 0.38, 0.28, 0.016, 0.07, accent);
  orivaniSpire(ctx, 0.62, 0.28, 0.016, 0.07, accent);

  // Top viewport
  orivaniViewport(ctx, 0.40, 0.10, 0.20, 0.02);

  // Twin sanctified engines
  orivaniEngineGlow(ctx, 0.44, 0.86, 0.030);
  orivaniEngineGlow(ctx, 0.56, 0.86, 0.030);
}

// ===========================================================================
//  KAELENTH
// ===========================================================================

// ── Section 4: 2D Wireframes ───────────────────────────────────────────────

/**
 * Kaelenth ship wireframes for the 2D ship designer.
 *
 * Visual language: elliptical hulls, arc rings, chrome gradient fill,
 * cool cyan accent colour, white-core engine glow. Every hull class
 * carries at least one ring to maintain family identity.
 *
 * All functions operate in normalised 1x1 space, nose-up (fore = top).
 */


// ── Kaelenth shared drawing primitives ──

/** Chrome gradient fill — light silver to gunmetal, unique to Kaelenth. */
function kaelenthFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.05, 0.7, 0.95);
  grad.addColorStop(0,   '#c8ccd4');
  grad.addColorStop(0.3, '#9098a8');
  grad.addColorStop(0.6, '#606878');
  grad.addColorStop(1,   '#383c48');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.stroke();
}

/** Engine glow — cool white core fading to cyan, distinct from mechanical blue. */
function kaelenthEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(200,220,255,0.65)');
  bloom.addColorStop(0.4, 'rgba(100,160,220,0.30)');
  bloom.addColorStop(1,   'rgba(40,80,160,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(245,248,255,1)');
  core.addColorStop(0.35, 'rgba(160,200,240,0.9)');
  core.addColorStop(1,   'rgba(60,100,200,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Precision ring — the Kaelenth halo motif rendered as an elliptical arc. */
function kaelenthRing(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  rx: number, ry: number, accent: string, alpha = 0.55,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, alpha);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Inner highlight — thinner, brighter
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, alpha * 0.4);
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

/** Sensor dome — smooth gradient circle at the bow. */
function kaelenthSensor(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string): void {
  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
  grad.addColorStop(0,   'rgba(220,230,245,0.9)');
  grad.addColorStop(0.5, withAlpha(accent, 0.5));
  grad.addColorStop(1,   'rgba(40,60,100,0.2)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ── Hull class wireframes ──

function kaelenthScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Small, clean capsule — a single seamless hull with one ring.
  // The simplest expression of Kaelenth design philosophy.
  ctx.beginPath();
  ctx.ellipse(0.50, 0.48, 0.12, 0.30, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Single precision ring — amidships
  kaelenthRing(ctx, 0.50, 0.54, 0.14, 0.035, accent, 0.50);

  // Sensor dome at bow
  kaelenthSensor(ctx, 0.50, 0.20, 0.040, accent);

  // Engine glow — single, centred
  kaelenthEngineGlow(ctx, 0.50, 0.76, 0.028);
}

function kaelenthDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Elongated capsule hull with two rings and flush weapon blisters.
  // The workhorse — elegant but purposeful.

  // Main hull
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.14, 0.34, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Forward weapon blisters — flush ellipses on the hull shoulders
  ctx.beginPath();
  ctx.ellipse(0.36, 0.36, 0.030, 0.07, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.64, 0.36, 0.030, 0.07, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();

  // Midship ring
  kaelenthRing(ctx, 0.50, 0.48, 0.16, 0.038, accent, 0.50);
  // Aft ring — engine halo
  kaelenthRing(ctx, 0.50, 0.68, 0.13, 0.032, accent, 0.45);

  // Sensor dome
  kaelenthSensor(ctx, 0.50, 0.16, 0.035, accent);

  // Twin engines
  kaelenthEngineGlow(ctx, 0.44, 0.78, 0.024);
  kaelenthEngineGlow(ctx, 0.56, 0.78, 0.024);
}

function kaelenthTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wide, rounded cargo hull — a flattened capsule with ring reinforcement.
  // Broader than combat vessels, suggesting internal volume.

  // Main hull — wider ellipse
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.22, 0.30, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Cargo division lines — subtle internal structure
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.50, 0.18); ctx.lineTo(0.50, 0.74); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.30, 0.46); ctx.lineTo(0.70, 0.46); ctx.stroke();

  // Cargo bay accent panels
  ctx.beginPath();
  ctx.ellipse(0.40, 0.36, 0.06, 0.07, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.60, 0.36, 0.06, 0.07, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();

  // Single wide ring — structural reinforcement
  kaelenthRing(ctx, 0.50, 0.52, 0.24, 0.040, accent, 0.45);

  // Sensor dome
  kaelenthSensor(ctx, 0.50, 0.18, 0.035, accent);

  // Twin engines — wider spacing
  kaelenthEngineGlow(ctx, 0.38, 0.76, 0.026);
  kaelenthEngineGlow(ctx, 0.62, 0.76, 0.026);
}

function kaelenthCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // The cruiser reveals the cathedral architecture: main hull with nacelle
  // pods and three rings. The Seekers' unconscious temple motif emerging.

  // Main hull — tall, tapered
  ctx.beginPath();
  ctx.ellipse(0.50, 0.44, 0.14, 0.34, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Nacelle pods — outrigged capsules
  ctx.beginPath();
  ctx.ellipse(0.28, 0.50, 0.05, 0.14, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);
  ctx.beginPath();
  ctx.ellipse(0.72, 0.50, 0.05, 0.14, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Weapon blisters — forward pair
  ctx.beginPath();
  ctx.ellipse(0.37, 0.30, 0.025, 0.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.63, 0.30, 0.025, 0.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.20);
  ctx.fill();

  // Three rings: forward, midship, aft
  kaelenthRing(ctx, 0.50, 0.26, 0.12, 0.028, accent, 0.40);
  kaelenthRing(ctx, 0.50, 0.46, 0.17, 0.038, accent, 0.55);
  kaelenthRing(ctx, 0.50, 0.66, 0.15, 0.034, accent, 0.45);

  // Nacelle rings
  kaelenthRing(ctx, 0.28, 0.60, 0.055, 0.018, accent, 0.40);
  kaelenthRing(ctx, 0.72, 0.60, 0.055, 0.018, accent, 0.40);

  // Sensor dome
  kaelenthSensor(ctx, 0.50, 0.14, 0.038, accent);

  // Triple engines — main + nacelle pairs
  kaelenthEngineGlow(ctx, 0.50, 0.76, 0.026);
  kaelenthEngineGlow(ctx, 0.28, 0.64, 0.018);
  kaelenthEngineGlow(ctx, 0.72, 0.64, 0.018);
}

function kaelenthCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Broad hull with multiple launch bays — the fabrication directive made
  // manifest. This ship does not just carry fighters; it manufactures them.

  // Main hull — wide, imposing
  ctx.beginPath();
  ctx.ellipse(0.50, 0.44, 0.20, 0.32, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Launch bays — dark inset ellipses, 3 per side
  const bayAlpha = 0.55;
  const bays: [number, number][] = [
    [0.34, 0.30], [0.66, 0.30],
    [0.32, 0.44], [0.68, 0.44],
    [0.34, 0.58], [0.66, 0.58],
  ];
  for (const [bx, by] of bays) {
    ctx.beginPath();
    ctx.ellipse(bx, by, 0.04, 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(15,20,35,${bayAlpha})`;
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.30);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Centre spine — production corridor
  ctx.beginPath();
  ctx.rect(0.47, 0.18, 0.06, 0.52);
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();

  // Nacelle pods — flanking
  ctx.beginPath();
  ctx.ellipse(0.22, 0.52, 0.04, 0.12, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);
  ctx.beginPath();
  ctx.ellipse(0.78, 0.52, 0.04, 0.12, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Two rings — forward and aft
  kaelenthRing(ctx, 0.50, 0.28, 0.22, 0.040, accent, 0.48);
  kaelenthRing(ctx, 0.50, 0.62, 0.20, 0.036, accent, 0.42);

  // Sensor dome
  kaelenthSensor(ctx, 0.50, 0.16, 0.040, accent);

  // Quad engines
  kaelenthEngineGlow(ctx, 0.36, 0.76, 0.024);
  kaelenthEngineGlow(ctx, 0.50, 0.78, 0.020);
  kaelenthEngineGlow(ctx, 0.64, 0.76, 0.024);
}

function kaelenthBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // The full cathedral: dorsal fin, multiple ring halos, nacelle pods,
  // broadside blisters, command dome. This is forty-seven million years
  // of engineering refinement made visible.

  // Main hull — long, imposing capsule
  ctx.beginPath();
  ctx.ellipse(0.50, 0.44, 0.16, 0.36, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Dorsal fin — the cathedral spire
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.lineTo(0.485, 0.32);
  ctx.lineTo(0.515, 0.32);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.22);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Nacelle pods — heavy, with their own rings
  ctx.beginPath();
  ctx.ellipse(0.24, 0.48, 0.06, 0.16, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);
  ctx.beginPath();
  ctx.ellipse(0.76, 0.48, 0.06, 0.16, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Broadside weapon blisters — 3 per side
  const broadsides: [number, number][] = [
    [0.35, 0.30], [0.65, 0.30],
    [0.34, 0.44], [0.66, 0.44],
    [0.35, 0.58], [0.65, 0.58],
  ];
  for (const [bx, by] of broadsides) {
    ctx.beginPath();
    ctx.ellipse(bx, by, 0.020, 0.035, 0, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.24);
    ctx.fill();
  }

  // Four rings: crown, forward, midship, aft
  kaelenthRing(ctx, 0.50, 0.16, 0.10, 0.024, accent, 0.38);
  kaelenthRing(ctx, 0.50, 0.30, 0.15, 0.032, accent, 0.48);
  kaelenthRing(ctx, 0.50, 0.48, 0.19, 0.040, accent, 0.55);
  kaelenthRing(ctx, 0.50, 0.66, 0.17, 0.036, accent, 0.45);

  // Nacelle rings
  kaelenthRing(ctx, 0.24, 0.58, 0.065, 0.020, accent, 0.40);
  kaelenthRing(ctx, 0.76, 0.58, 0.065, 0.020, accent, 0.40);

  // Command dome — raised sphere at bow
  kaelenthSensor(ctx, 0.50, 0.12, 0.042, accent);

  // Quad engines — heavy array
  kaelenthEngineGlow(ctx, 0.38, 0.78, 0.028);
  kaelenthEngineGlow(ctx, 0.50, 0.80, 0.024);
  kaelenthEngineGlow(ctx, 0.62, 0.78, 0.028);
}

function kaelenthColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // The coloniser is the purest expression of the Kaelenth directive: BUILD.
  // A fabrication bay wrapped in a hull, surrounded by rings — it carries
  // not passengers but manufacturing templates, raw materials, and the
  // accumulated knowledge of forty-seven million years.

  // Main hull — tall, cylindrical suggestion (elongated ellipse)
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.16, 0.34, 0, 0, Math.PI * 2);
  kaelenthFill(ctx, accent);

  // Fabrication bay windows — horizontal strips of light
  for (let y = 0.26; y <= 0.62; y += 0.12) {
    ctx.beginPath();
    const halfW = 0.10 - Math.abs(y - 0.44) * 0.08;
    ctx.ellipse(0.50, y, halfW, 0.012, 0, 0, Math.PI * 2);
    const wg = ctx.createLinearGradient(0.50 - halfW, y, 0.50 + halfW, y);
    wg.addColorStop(0,   withAlpha(accent, 0.20));
    wg.addColorStop(0.5, withAlpha(accent, 0.45));
    wg.addColorStop(1,   withAlpha(accent, 0.20));
    ctx.fillStyle = wg;
    ctx.fill();
  }

  // Structural ring caps — wider bands at top and bottom
  kaelenthRing(ctx, 0.50, 0.18, 0.14, 0.028, accent, 0.42);
  kaelenthRing(ctx, 0.50, 0.74, 0.14, 0.028, accent, 0.42);

  // Central ring — the primary halo
  kaelenthRing(ctx, 0.50, 0.46, 0.19, 0.042, accent, 0.55);

  // Habitat/fabrication module accent — faint glow around centre
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.10, 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.06);
  ctx.fill();

  // Sensor dome
  kaelenthSensor(ctx, 0.50, 0.14, 0.036, accent);

  // Twin engines
  kaelenthEngineGlow(ctx, 0.42, 0.80, 0.028);
  kaelenthEngineGlow(ctx, 0.58, 0.80, 0.028);
}

// ===========================================================================
//  THYRIAQ
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — Ship Designer
// =============================================================================

/**
 * Thyriaq 2D wireframes for the ship designer overlay.
 *
 * All Thyriaq wireframes use the same visual grammar:
 * - Exclusively bezier curves, never straight edges
 * - Asymmetric amoeboid outlines (slightly off-centre masses)
 * - Tapered pseudopod tendrils trailing from the hull
 * - Internal glow spots for processing nodes (accent colour)
 * - Diffuse, non-directional engine glow (cyan wash at stern)
 * - Nose UP (fore at y ~ 0.06-0.10, engines at y ~ 0.80-0.90)
 * - 1x1 normalised coordinate space
 */


// ── Shared drawing helpers ──────────────────────────────────────────────────

/** Thyriaq engine glow — diffuse cyan wash, not a focused thruster. */
function thyriaqEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Outer bloom — wide and diffuse
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  bloom.addColorStop(0,   'rgba(100,200,220,0.5)');
  bloom.addColorStop(0.4, 'rgba(60,160,200,0.2)');
  bloom.addColorStop(1,   'rgba(30,100,140,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — bright cyan-white
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(220,245,255,0.9)');
  core.addColorStop(0.3, 'rgba(100,200,230,0.7)');
  core.addColorStop(1,   'rgba(40,120,160,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Thyriaq hull fill — liquid silver gradient with no hard edges. */
function thyriaqFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.1, 0.7, 0.9);
  grad.addColorStop(0,   '#8a9aaa');
  grad.addColorStop(0.3, '#6a7a8a');
  grad.addColorStop(0.6, '#4a5a6a');
  grad.addColorStop(1,   '#3a4a5a');
  ctx.fillStyle = grad;
  ctx.fill();
  // Soft edge glow instead of hard stroke — the surface is continuous
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.010;
  ctx.stroke();
}

/** Processing node — a soft glowing dot inside the hull. */
function processingNode(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0,   withAlpha(accent, 0.8));
  grad.addColorStop(0.5, withAlpha(accent, 0.3));
  grad.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/** Pseudopod tendril — a bezier curve tapering to nothing. */
function tendril(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x1: number, y1: number,
  startWidth: number,
  accent: string,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = startWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
  ctx.stroke();
  // Thinner inner line for the "core" of the tendril
  ctx.strokeStyle = withAlpha(accent, 0.15);
  ctx.lineWidth = startWidth * 0.4;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
  ctx.stroke();
}

// ── SCOUT ───────────────────────────────────────────────────────────────────
// A single mercury droplet with a few fine whiskers. The smallest
// autonomous unit of swarm — barely a person, more an instinct.

function thyriaqScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main droplet body — teardrop pointing forward (nose up)
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.40, 0.14, 0.34, 0.28, 0.35, 0.44);
  ctx.bezierCurveTo(0.36, 0.58, 0.40, 0.68, 0.45, 0.74);
  ctx.bezierCurveTo(0.47, 0.77, 0.50, 0.78, 0.50, 0.78);
  ctx.bezierCurveTo(0.50, 0.78, 0.53, 0.77, 0.55, 0.74);
  ctx.bezierCurveTo(0.60, 0.68, 0.64, 0.58, 0.65, 0.44);
  ctx.bezierCurveTo(0.66, 0.28, 0.60, 0.14, 0.50, 0.08);
  ctx.closePath();
  thyriaqFill(ctx, accent);

  // Slight surface highlight — mercury sheen
  const sheen = ctx.createRadialGradient(0.46, 0.32, 0, 0.50, 0.40, 0.18);
  sheen.addColorStop(0,   'rgba(200,220,240,0.25)');
  sheen.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.48, 0.35, 0.14, 0, Math.PI * 2);
  ctx.fillStyle = sheen;
  ctx.fill();

  // Sensor whiskers — fine trailing tendrils
  tendril(ctx, 0.42, 0.72, 0.38, 0.80, 0.34, 0.88, 0.30, 0.94, 0.005, accent);
  tendril(ctx, 0.58, 0.72, 0.62, 0.80, 0.66, 0.88, 0.70, 0.94, 0.005, accent);
  tendril(ctx, 0.50, 0.78, 0.50, 0.86, 0.50, 0.92, 0.50, 0.98, 0.004, accent);

  // Processing node
  processingNode(ctx, 0.50, 0.28, 0.035, accent);

  // Engine glow
  thyriaqEngineGlow(ctx, 0.50, 0.76, 0.030);
}

// ── DESTROYER ───────────────────────────────────────────────────────────────
// Two merging droplets — the classic Thyriaq "binary configuration."
// A forward sensory lobe and a larger aft combat/propulsion lobe
// connected by a pinched waist.

function thyriaqDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Forward sensory lobe
  ctx.beginPath();
  ctx.moveTo(0.50, 0.07);
  ctx.bezierCurveTo(0.40, 0.12, 0.36, 0.20, 0.37, 0.30);
  ctx.bezierCurveTo(0.38, 0.38, 0.42, 0.42, 0.46, 0.44);
  // Pinched waist
  ctx.bezierCurveTo(0.44, 0.46, 0.43, 0.48, 0.43, 0.50);
  // Aft combat lobe
  ctx.bezierCurveTo(0.38, 0.52, 0.32, 0.58, 0.31, 0.66);
  ctx.bezierCurveTo(0.30, 0.74, 0.36, 0.82, 0.44, 0.85);
  ctx.bezierCurveTo(0.47, 0.86, 0.50, 0.86, 0.50, 0.86);
  // Mirror right side
  ctx.bezierCurveTo(0.50, 0.86, 0.53, 0.86, 0.56, 0.85);
  ctx.bezierCurveTo(0.64, 0.82, 0.70, 0.74, 0.69, 0.66);
  ctx.bezierCurveTo(0.68, 0.58, 0.62, 0.52, 0.57, 0.50);
  ctx.bezierCurveTo(0.57, 0.48, 0.56, 0.46, 0.54, 0.44);
  ctx.bezierCurveTo(0.58, 0.42, 0.62, 0.38, 0.63, 0.30);
  ctx.bezierCurveTo(0.64, 0.20, 0.60, 0.12, 0.50, 0.07);
  ctx.closePath();
  thyriaqFill(ctx, accent);

  // Sheen on forward lobe
  const sheen = ctx.createRadialGradient(0.47, 0.22, 0, 0.50, 0.26, 0.10);
  sheen.addColorStop(0,   'rgba(200,220,240,0.25)');
  sheen.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.48, 0.24, 0.09, 0, Math.PI * 2);
  ctx.fillStyle = sheen;
  ctx.fill();

  // Weapon pseudopods — two reaching forward
  tendril(ctx, 0.36, 0.28, 0.26, 0.22, 0.20, 0.16, 0.18, 0.12, 0.007, accent);
  tendril(ctx, 0.64, 0.28, 0.74, 0.22, 0.80, 0.16, 0.82, 0.12, 0.007, accent);

  // Propulsion tendrils
  tendril(ctx, 0.40, 0.84, 0.36, 0.90, 0.32, 0.94, 0.28, 0.98, 0.005, accent);
  tendril(ctx, 0.60, 0.84, 0.64, 0.90, 0.68, 0.94, 0.72, 0.98, 0.005, accent);
  tendril(ctx, 0.50, 0.86, 0.50, 0.92, 0.50, 0.96, 0.50, 0.99, 0.004, accent);

  // Processing nodes — one per lobe
  processingNode(ctx, 0.50, 0.22, 0.030, accent);
  processingNode(ctx, 0.50, 0.68, 0.035, accent);

  // Engine glow
  thyriaqEngineGlow(ctx, 0.42, 0.84, 0.025);
  thyriaqEngineGlow(ctx, 0.58, 0.84, 0.025);
}

// ── TRANSPORT ───────────────────────────────────────────────────────────────
// A wide, flat amoeboid slab — the swarm spreading thin to maximise
// cargo volume. The broadest Thyriaq silhouette, almost disc-like,
// with few pseudopods (this is a hauler, not a fighter).

function thyriaqTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wide flattened disc body
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.36, 0.14, 0.22, 0.24, 0.18, 0.40);
  ctx.bezierCurveTo(0.16, 0.52, 0.18, 0.64, 0.24, 0.72);
  ctx.bezierCurveTo(0.30, 0.80, 0.40, 0.84, 0.50, 0.85);
  ctx.bezierCurveTo(0.60, 0.84, 0.70, 0.80, 0.76, 0.72);
  ctx.bezierCurveTo(0.82, 0.64, 0.84, 0.52, 0.82, 0.40);
  ctx.bezierCurveTo(0.78, 0.24, 0.64, 0.14, 0.50, 0.10);
  ctx.closePath();
  thyriaqFill(ctx, accent);

  // Internal cargo regions — faint outline blobs within the mass
  ctx.strokeStyle = withAlpha(accent, 0.12);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.ellipse(0.38, 0.48, 0.10, 0.14, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.62, 0.48, 0.10, 0.14, 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.50, 0.55, 0.08, 0.10, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Sheen
  const sheen = ctx.createRadialGradient(0.44, 0.36, 0, 0.50, 0.42, 0.20);
  sheen.addColorStop(0,   'rgba(200,220,240,0.20)');
  sheen.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.46, 0.38, 0.18, 0, Math.PI * 2);
  ctx.fillStyle = sheen;
  ctx.fill();

  // Short trailing tendrils
  tendril(ctx, 0.36, 0.82, 0.30, 0.88, 0.26, 0.92, 0.24, 0.96, 0.005, accent);
  tendril(ctx, 0.64, 0.82, 0.70, 0.88, 0.74, 0.92, 0.76, 0.96, 0.005, accent);

  // Processing nodes
  processingNode(ctx, 0.50, 0.30, 0.030, accent);
  processingNode(ctx, 0.38, 0.48, 0.020, accent);
  processingNode(ctx, 0.62, 0.48, 0.020, accent);

  // Engine glow — spread wide
  thyriaqEngineGlow(ctx, 0.36, 0.82, 0.025);
  thyriaqEngineGlow(ctx, 0.50, 0.84, 0.020);
  thyriaqEngineGlow(ctx, 0.64, 0.82, 0.025);
}

// ── CRUISER ─────────────────────────────────────────────────────────────────
// Three merging lobes in a triangular arrangement — fore, port-aft,
// starboard-aft. The first ship large enough to show distinct weapon
// pseudopods with visible flared tips.

function thyriaqCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Forward lobe — elongated, reaching
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.42, 0.10, 0.38, 0.18, 0.38, 0.28);
  ctx.bezierCurveTo(0.38, 0.36, 0.40, 0.42, 0.44, 0.46);
  // Merge zone into aft lobes
  ctx.bezierCurveTo(0.40, 0.48, 0.34, 0.52, 0.30, 0.56);
  ctx.bezierCurveTo(0.24, 0.62, 0.22, 0.70, 0.24, 0.76);
  ctx.bezierCurveTo(0.27, 0.82, 0.34, 0.86, 0.42, 0.86);
  // Port-aft lobe merges to centre
  ctx.bezierCurveTo(0.46, 0.86, 0.48, 0.84, 0.50, 0.82);
  // Starboard-aft lobe (mirrored)
  ctx.bezierCurveTo(0.52, 0.84, 0.54, 0.86, 0.58, 0.86);
  ctx.bezierCurveTo(0.66, 0.86, 0.73, 0.82, 0.76, 0.76);
  ctx.bezierCurveTo(0.78, 0.70, 0.76, 0.62, 0.70, 0.56);
  ctx.bezierCurveTo(0.66, 0.52, 0.60, 0.48, 0.56, 0.46);
  ctx.bezierCurveTo(0.60, 0.42, 0.62, 0.36, 0.62, 0.28);
  ctx.bezierCurveTo(0.62, 0.18, 0.58, 0.10, 0.50, 0.06);
  ctx.closePath();
  thyriaqFill(ctx, accent);

  // Sheen highlight on forward lobe
  const sheen = ctx.createRadialGradient(0.47, 0.20, 0, 0.50, 0.24, 0.10);
  sheen.addColorStop(0,   'rgba(200,220,240,0.25)');
  sheen.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.48, 0.22, 0.09, 0, Math.PI * 2);
  ctx.fillStyle = sheen;
  ctx.fill();

  // Weapon pseudopods — thick, with flared tips
  tendril(ctx, 0.30, 0.56, 0.20, 0.48, 0.14, 0.40, 0.10, 0.34, 0.008, accent);
  tendril(ctx, 0.70, 0.56, 0.80, 0.48, 0.86, 0.40, 0.90, 0.34, 0.008, accent);
  // Flared emitter tips (small circles at tendril ends)
  ctx.beginPath();
  ctx.arc(0.10, 0.34, 0.015, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0.90, 0.34, 0.015, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, 0.6);
  ctx.fill();

  // Forward sensory whiskers
  tendril(ctx, 0.44, 0.12, 0.38, 0.06, 0.34, 0.04, 0.30, 0.02, 0.004, accent);
  tendril(ctx, 0.56, 0.12, 0.62, 0.06, 0.66, 0.04, 0.70, 0.02, 0.004, accent);

  // Propulsion tendrils from aft lobes
  tendril(ctx, 0.34, 0.86, 0.28, 0.92, 0.24, 0.96, 0.22, 0.99, 0.005, accent);
  tendril(ctx, 0.66, 0.86, 0.72, 0.92, 0.76, 0.96, 0.78, 0.99, 0.005, accent);
  tendril(ctx, 0.50, 0.82, 0.50, 0.90, 0.50, 0.95, 0.50, 0.99, 0.004, accent);

  // Processing nodes — three lobes
  processingNode(ctx, 0.50, 0.20, 0.030, accent);
  processingNode(ctx, 0.34, 0.70, 0.028, accent);
  processingNode(ctx, 0.66, 0.70, 0.028, accent);

  // Engine glow
  thyriaqEngineGlow(ctx, 0.36, 0.85, 0.026);
  thyriaqEngineGlow(ctx, 0.64, 0.85, 0.026);
}

// ── CARRIER ─────────────────────────────────────────────────────────────────
// A massive central mass with four distinct pseudopod bays — openings
// in the hull where fighter-swarms detach and re-attach. The outline
// has characteristic concavities where the bays indent the hull.

function thyriaqCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main body — a wide amoeboid mass with bay indentations
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.38, 0.12, 0.26, 0.20, 0.22, 0.32);
  // Port upper bay indent
  ctx.bezierCurveTo(0.20, 0.38, 0.22, 0.42, 0.20, 0.44);
  ctx.bezierCurveTo(0.18, 0.46, 0.16, 0.48, 0.18, 0.52);
  // Port lower bay indent
  ctx.bezierCurveTo(0.20, 0.56, 0.18, 0.60, 0.16, 0.62);
  ctx.bezierCurveTo(0.15, 0.66, 0.16, 0.70, 0.20, 0.74);
  ctx.bezierCurveTo(0.26, 0.80, 0.36, 0.86, 0.44, 0.88);
  ctx.bezierCurveTo(0.47, 0.89, 0.50, 0.89, 0.50, 0.89);
  // Starboard side (mirrored)
  ctx.bezierCurveTo(0.50, 0.89, 0.53, 0.89, 0.56, 0.88);
  ctx.bezierCurveTo(0.64, 0.86, 0.74, 0.80, 0.80, 0.74);
  ctx.bezierCurveTo(0.84, 0.70, 0.85, 0.66, 0.84, 0.62);
  ctx.bezierCurveTo(0.82, 0.60, 0.80, 0.56, 0.82, 0.52);
  ctx.bezierCurveTo(0.84, 0.48, 0.82, 0.46, 0.80, 0.44);
  ctx.bezierCurveTo(0.78, 0.42, 0.80, 0.38, 0.78, 0.32);
  ctx.bezierCurveTo(0.74, 0.20, 0.62, 0.12, 0.50, 0.08);
  ctx.closePath();
  thyriaqFill(ctx, accent);

  // Bay glow — dark cavities where sub-swarms nest
  const bayPositions: [number, number][] = [[0.22, 0.44], [0.17, 0.62], [0.78, 0.44], [0.83, 0.62]];
  for (const [bx, by] of bayPositions) {
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, 0.04);
    bg.addColorStop(0,   withAlpha(accent, 0.4));
    bg.addColorStop(0.6, withAlpha(accent, 0.15));
    bg.addColorStop(1,   withAlpha(accent, 0));
    ctx.beginPath();
    ctx.arc(bx, by, 0.04, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  }

  // Sheen
  const sheen = ctx.createRadialGradient(0.44, 0.34, 0, 0.50, 0.40, 0.18);
  sheen.addColorStop(0,   'rgba(200,220,240,0.20)');
  sheen.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.46, 0.36, 0.16, 0, Math.PI * 2);
  ctx.fillStyle = sheen;
  ctx.fill();

  // Forward sensory pseudopods
  tendril(ctx, 0.38, 0.14, 0.30, 0.08, 0.24, 0.04, 0.20, 0.02, 0.006, accent);
  tendril(ctx, 0.62, 0.14, 0.70, 0.08, 0.76, 0.04, 0.80, 0.02, 0.006, accent);

  // Lateral weapon pseudopods
  tendril(ctx, 0.20, 0.36, 0.12, 0.30, 0.08, 0.24, 0.04, 0.20, 0.007, accent);
  tendril(ctx, 0.80, 0.36, 0.88, 0.30, 0.92, 0.24, 0.96, 0.20, 0.007, accent);

  // Aft propulsion tendrils
  tendril(ctx, 0.38, 0.88, 0.32, 0.92, 0.28, 0.96, 0.24, 0.99, 0.005, accent);
  tendril(ctx, 0.62, 0.88, 0.68, 0.92, 0.72, 0.96, 0.76, 0.99, 0.005, accent);
  tendril(ctx, 0.50, 0.89, 0.50, 0.94, 0.50, 0.97, 0.50, 0.99, 0.004, accent);

  // Processing nodes
  processingNode(ctx, 0.50, 0.26, 0.032, accent);
  processingNode(ctx, 0.36, 0.52, 0.024, accent);
  processingNode(ctx, 0.64, 0.52, 0.024, accent);
  processingNode(ctx, 0.50, 0.72, 0.028, accent);

  // Engine glow
  thyriaqEngineGlow(ctx, 0.36, 0.87, 0.026);
  thyriaqEngineGlow(ctx, 0.50, 0.89, 0.022);
  thyriaqEngineGlow(ctx, 0.64, 0.87, 0.026);
}

// ── BATTLESHIP ──────────────────────────────────────────────────────────────
// The largest combat configuration — a sprawling multi-lobed amoeba
// bristling with weapon pseudopods and accelerator ring structures.
// Five distinct lobes connected by visible pinch-points, with a
// central processing cluster radiating internal glow.

function thyriaqBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main body — massive asymmetric amoeboid outline
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  // Forward lobe
  ctx.bezierCurveTo(0.40, 0.08, 0.34, 0.14, 0.32, 0.22);
  ctx.bezierCurveTo(0.30, 0.30, 0.32, 0.36, 0.36, 0.40);
  // Port upper mass
  ctx.bezierCurveTo(0.30, 0.42, 0.22, 0.44, 0.18, 0.48);
  ctx.bezierCurveTo(0.14, 0.54, 0.12, 0.60, 0.14, 0.66);
  // Port lower mass
  ctx.bezierCurveTo(0.16, 0.72, 0.20, 0.76, 0.24, 0.78);
  ctx.bezierCurveTo(0.20, 0.80, 0.18, 0.84, 0.22, 0.88);
  ctx.bezierCurveTo(0.28, 0.92, 0.38, 0.93, 0.44, 0.92);
  // Central aft
  ctx.bezierCurveTo(0.47, 0.91, 0.50, 0.90, 0.50, 0.90);
  // Starboard mirror
  ctx.bezierCurveTo(0.50, 0.90, 0.53, 0.91, 0.56, 0.92);
  ctx.bezierCurveTo(0.62, 0.93, 0.72, 0.92, 0.78, 0.88);
  ctx.bezierCurveTo(0.82, 0.84, 0.80, 0.80, 0.76, 0.78);
  ctx.bezierCurveTo(0.80, 0.76, 0.84, 0.72, 0.86, 0.66);
  ctx.bezierCurveTo(0.88, 0.60, 0.86, 0.54, 0.82, 0.48);
  ctx.bezierCurveTo(0.78, 0.44, 0.70, 0.42, 0.64, 0.40);
  ctx.bezierCurveTo(0.68, 0.36, 0.70, 0.30, 0.68, 0.22);
  ctx.bezierCurveTo(0.66, 0.14, 0.60, 0.08, 0.50, 0.06);
  ctx.closePath();
  thyriaqFill(ctx, accent);

  // Internal lobe boundaries — faint dividing lines showing the merge zones
  ctx.strokeStyle = withAlpha(accent, 0.10);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.36, 0.40); ctx.bezierCurveTo(0.42, 0.44, 0.48, 0.50, 0.50, 0.58);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.64, 0.40); ctx.bezierCurveTo(0.58, 0.44, 0.52, 0.50, 0.50, 0.58);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.58); ctx.bezierCurveTo(0.50, 0.68, 0.46, 0.78, 0.44, 0.86);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.58); ctx.bezierCurveTo(0.50, 0.68, 0.54, 0.78, 0.56, 0.86);
  ctx.stroke();

  // Sheen highlights on two main lobes
  const sheen1 = ctx.createRadialGradient(0.46, 0.20, 0, 0.48, 0.24, 0.10);
  sheen1.addColorStop(0,   'rgba(200,220,240,0.22)');
  sheen1.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.47, 0.22, 0.09, 0, Math.PI * 2);
  ctx.fillStyle = sheen1;
  ctx.fill();
  const sheen2 = ctx.createRadialGradient(0.46, 0.62, 0, 0.50, 0.66, 0.14);
  sheen2.addColorStop(0,   'rgba(200,220,240,0.15)');
  sheen2.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.48, 0.64, 0.12, 0, Math.PI * 2);
  ctx.fillStyle = sheen2;
  ctx.fill();

  // Weapon pseudopods — heavy, with flared emitter tips
  tendril(ctx, 0.18, 0.48, 0.10, 0.40, 0.06, 0.32, 0.02, 0.26, 0.009, accent);
  tendril(ctx, 0.82, 0.48, 0.90, 0.40, 0.94, 0.32, 0.98, 0.26, 0.009, accent);
  tendril(ctx, 0.14, 0.66, 0.06, 0.62, 0.02, 0.56, 0.00, 0.50, 0.008, accent);
  tendril(ctx, 0.86, 0.66, 0.94, 0.62, 0.98, 0.56, 1.00, 0.50, 0.008, accent);

  // Flared emitter tips
  const emitters: [number, number][] = [[0.02, 0.26], [0.98, 0.26], [0.00, 0.50], [1.00, 0.50]];
  for (const [ex, ey] of emitters) {
    ctx.beginPath();
    ctx.arc(ex, ey, 0.018, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(accent, 0.55);
    ctx.fill();
  }

  // Accelerator ring hint — ellipses partway along weapon pseudopods
  ctx.strokeStyle = withAlpha(accent, 0.30);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.ellipse(0.12, 0.44, 0.025, 0.012, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.88, 0.44, 0.025, 0.012, 0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Forward sensor whiskers
  tendril(ctx, 0.40, 0.10, 0.34, 0.04, 0.28, 0.02, 0.24, 0.00, 0.004, accent);
  tendril(ctx, 0.60, 0.10, 0.66, 0.04, 0.72, 0.02, 0.76, 0.00, 0.004, accent);
  tendril(ctx, 0.50, 0.06, 0.50, 0.02, 0.50, 0.00, 0.50, 0.00, 0.003, accent);

  // Propulsion tendrils — many and spread wide
  tendril(ctx, 0.30, 0.90, 0.24, 0.94, 0.20, 0.97, 0.16, 0.99, 0.005, accent);
  tendril(ctx, 0.44, 0.92, 0.40, 0.96, 0.36, 0.98, 0.32, 1.00, 0.005, accent);
  tendril(ctx, 0.56, 0.92, 0.60, 0.96, 0.64, 0.98, 0.68, 1.00, 0.005, accent);
  tendril(ctx, 0.70, 0.90, 0.76, 0.94, 0.80, 0.97, 0.84, 0.99, 0.005, accent);
  tendril(ctx, 0.50, 0.90, 0.50, 0.94, 0.50, 0.97, 0.50, 1.00, 0.004, accent);

  // Processing nodes — five, one per lobe
  processingNode(ctx, 0.50, 0.20, 0.032, accent);
  processingNode(ctx, 0.26, 0.56, 0.026, accent);
  processingNode(ctx, 0.74, 0.56, 0.026, accent);
  processingNode(ctx, 0.36, 0.82, 0.024, accent);
  processingNode(ctx, 0.64, 0.82, 0.024, accent);

  // Central processing cluster glow — the swarm's brain
  const brain = ctx.createRadialGradient(0.50, 0.54, 0, 0.50, 0.54, 0.10);
  brain.addColorStop(0,   withAlpha(accent, 0.30));
  brain.addColorStop(0.5, withAlpha(accent, 0.10));
  brain.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.54, 0.10, 0, Math.PI * 2);
  ctx.fillStyle = brain;
  ctx.fill();

  // Engine glow
  thyriaqEngineGlow(ctx, 0.32, 0.90, 0.028);
  thyriaqEngineGlow(ctx, 0.50, 0.90, 0.024);
  thyriaqEngineGlow(ctx, 0.68, 0.90, 0.028);
}

// ── COLONISER ───────────────────────────────────────────────────────────────
// The Thyriaq coloniser is unique: it is not a ship carrying colonists,
// it IS the colonists. A vast, dense, egg-shaped mass of swarm-matter
// — the maximum-density configuration for transporting billions of
// nanites to a new world. Fewer pseudopods than a warship; the focus
// is on density and self-containment, with a thick "shell" layer
// visible as a bright outer ring.

function thyriaqColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Dense egg-shaped body — more symmetrical than warships
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.38, 0.12, 0.28, 0.24, 0.26, 0.40);
  ctx.bezierCurveTo(0.24, 0.54, 0.26, 0.66, 0.30, 0.74);
  ctx.bezierCurveTo(0.34, 0.82, 0.42, 0.88, 0.50, 0.90);
  ctx.bezierCurveTo(0.58, 0.88, 0.66, 0.82, 0.70, 0.74);
  ctx.bezierCurveTo(0.74, 0.66, 0.76, 0.54, 0.74, 0.40);
  ctx.bezierCurveTo(0.72, 0.24, 0.62, 0.12, 0.50, 0.08);
  ctx.closePath();
  thyriaqFill(ctx, accent);

  // Protective shell layer — a bright inner outline showing the dense
  // outer crust the swarm forms for long-distance travel
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.bezierCurveTo(0.40, 0.18, 0.32, 0.28, 0.30, 0.42);
  ctx.bezierCurveTo(0.28, 0.54, 0.30, 0.64, 0.34, 0.72);
  ctx.bezierCurveTo(0.38, 0.78, 0.44, 0.82, 0.50, 0.84);
  ctx.bezierCurveTo(0.56, 0.82, 0.62, 0.78, 0.66, 0.72);
  ctx.bezierCurveTo(0.70, 0.64, 0.72, 0.54, 0.70, 0.42);
  ctx.bezierCurveTo(0.68, 0.28, 0.60, 0.18, 0.50, 0.14);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(accent, 0.20);
  ctx.lineWidth = 0.006;
  ctx.stroke();

  // Internal density bands — concentric ellipses showing compression layers
  ctx.strokeStyle = withAlpha(accent, 0.08);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.ellipse(0.50, 0.48, 0.14, 0.20, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.50, 0.48, 0.08, 0.12, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Sheen — large and central
  const sheen = ctx.createRadialGradient(0.45, 0.34, 0, 0.50, 0.40, 0.18);
  sheen.addColorStop(0,   'rgba(200,220,240,0.28)');
  sheen.addColorStop(1,   'rgba(200,220,240,0)');
  ctx.beginPath();
  ctx.arc(0.47, 0.36, 0.16, 0, Math.PI * 2);
  ctx.fillStyle = sheen;
  ctx.fill();

  // Minimal pseudopods — navigation only, not combat
  tendril(ctx, 0.36, 0.86, 0.30, 0.92, 0.26, 0.96, 0.22, 0.99, 0.005, accent);
  tendril(ctx, 0.64, 0.86, 0.70, 0.92, 0.74, 0.96, 0.78, 0.99, 0.005, accent);
  tendril(ctx, 0.50, 0.90, 0.50, 0.94, 0.50, 0.97, 0.50, 1.00, 0.004, accent);

  // Forward sensor whisker — just one, central
  tendril(ctx, 0.50, 0.08, 0.50, 0.04, 0.50, 0.02, 0.50, 0.00, 0.004, accent);

  // Processing nodes — arranged in a vertical line (maximum density packing)
  processingNode(ctx, 0.50, 0.28, 0.034, accent);
  processingNode(ctx, 0.50, 0.46, 0.038, accent);
  processingNode(ctx, 0.50, 0.64, 0.034, accent);

  // Central core glow — the densest region, the seed of a new colony
  const core = ctx.createRadialGradient(0.50, 0.46, 0, 0.50, 0.46, 0.08);
  core.addColorStop(0,   withAlpha(accent, 0.40));
  core.addColorStop(0.5, withAlpha(accent, 0.15));
  core.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.46, 0.08, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();

  // Engine glow
  thyriaqEngineGlow(ctx, 0.40, 0.88, 0.028);
  thyriaqEngineGlow(ctx, 0.60, 0.88, 0.028);
}


// =============================================================================
//  EXPORTS (for integration reference)

// ===========================================================================
//  AETHYN
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — Ship Designer
// ═══════════════════════════════════════════════════════════════════════════════
//
//  All functions operate in a normalised 1x1 coordinate space.
//  Ships face nose-UP (fore = top of canvas).
//  accent = hex colour string from the species palette.
//
//  Aethyn visual language in 2D:
//  - Dark indigo-violet fills with phase-glow gradients
//  - Dashed outlines where hull sections "fade" into other dimensions
//  - Floating geometric nodes at slight offsets (low opacity)
//  - Engine glow is soft magenta-violet radial — no flame, no exhaust
//  - Intersecting ring arcs suggest torus cross-sections
//  - All silhouettes are non-bilateral: slightly asymmetric because the
//    ship extends differently into other dimensions on each side


// ── Shared sub-renderers ─────────────────────────────────────────────────────

/** Phase-fold engine glow — soft magenta-violet radial, no flame. */
function aethynEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(180,100,255,0.55)');
  bloom.addColorStop(0.4, 'rgba(120,50,200,0.25)');
  bloom.addColorStop(1,   'rgba(60,20,140,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-violet
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(230,210,255,0.95)');
  core.addColorStop(0.4, 'rgba(170,120,255,0.7)');
  core.addColorStop(1,   'rgba(90,40,180,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Phase-shifted hull fill — deep indigo gradient with faint inner glow. */
function aethynFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.1, 0.7, 0.9);
  grad.addColorStop(0,   '#3a1a6e');
  grad.addColorStop(0.35, '#2a1055');
  grad.addColorStop(0.7,  '#1c0a40');
  grad.addColorStop(1,   '#120830');
  ctx.fillStyle = grad;
  ctx.fill();
  // Faint phase-boundary edge
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Dashed "fade" outline — hull section phasing out of our dimension. */
function aethynPhaseEdge(
  ctx: CanvasRenderingContext2D,
  accent: string,
  points: [number, number][],
): void {
  ctx.save();
  ctx.setLineDash([0.015, 0.01]);
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Floating satellite node — a disconnected geometric shape at low opacity. */
function aethynSatelliteNode(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  accent: string,
  sides = 5,
): void {
  // Glow halo
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
  glow.addColorStop(0,   withAlpha(accent, 0.45));
  glow.addColorStop(0.5, withAlpha(accent, 0.15));
  glow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  // Polygon
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / sides;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha('#3a1a6e', 0.6);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/** Dimensional ring arc — partial ellipse suggesting a torus cross-section. */
function aethynRingArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  startAngle: number, endAngle: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle);
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.stroke();
}

/** Phase nexus — central energy point where dimensions converge. */
function aethynNexus(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  accent: string,
): void {
  // Outer glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0,   'rgba(220,200,255,0.9)');
  glow.addColorStop(0.3, withAlpha(accent, 0.6));
  glow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  // Inner pentagon — 5-sided to distinguish from crystalline diamond
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
    const px = cx + r * 0.4 * Math.cos(a);
    const py = cy + r * 0.4 * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(230,215,255,0.8)';
  ctx.fill();
}


// ═══════════════════════════════════════════════════════════════════════════════
//  HULL-CLASS WIREFRAMES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SCOUT — Minimal dimensional footprint.
 * A narrow diamond-like hull with one tilted ring arc and a single
 * floating satellite node. The simplest projection into our space.
 */
function aethynScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — narrow irregular pentagon (not perfectly symmetric)
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // bow tip
  ctx.lineTo(0.38, 0.32);
  ctx.lineTo(0.36, 0.62);
  ctx.lineTo(0.50, 0.80);
  ctx.lineTo(0.64, 0.60);
  ctx.lineTo(0.62, 0.30);
  ctx.closePath();
  aethynFill(ctx, accent);

  // Phase-fade edge — starboard hull fading into another dimension
  aethynPhaseEdge(ctx, accent, [
    [0.64, 0.60], [0.68, 0.48], [0.66, 0.36],
  ]);

  // Tilted ring arc — partial torus cross-section
  aethynRingArc(ctx, 0.50, 0.44, 0.22, 0.12,
    -Math.PI * 0.7, Math.PI * 0.5, accent);

  // Single floating satellite node — disconnected sensor
  aethynSatelliteNode(ctx, 0.72, 0.28, 0.025, accent, 5);

  // Phase nexus — small
  aethynNexus(ctx, 0.50, 0.36, 0.035, accent);

  // Engine fold glow
  aethynEngineGlow(ctx, 0.50, 0.76, 0.028);
}

/**
 * DESTROYER — Elongated projection with dual ring arcs.
 * The hull is a stretched irregular hexagon with two intersecting
 * ring arcs and a pair of floating nodes.
 */
function aethynDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — elongated with slight asymmetry
  ctx.beginPath();
  ctx.moveTo(0.50, 0.05);   // bow
  ctx.lineTo(0.37, 0.20);
  ctx.lineTo(0.34, 0.48);
  ctx.lineTo(0.36, 0.70);
  ctx.lineTo(0.50, 0.84);
  ctx.lineTo(0.64, 0.68);
  ctx.lineTo(0.66, 0.46);
  ctx.lineTo(0.63, 0.18);
  ctx.closePath();
  aethynFill(ctx, accent);

  // Interior facet lines — dimensional stress fractures
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.003;
  ctx.beginPath(); ctx.moveTo(0.50, 0.05); ctx.lineTo(0.42, 0.48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.05); ctx.lineTo(0.58, 0.50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.38, 0.34); ctx.lineTo(0.62, 0.36); ctx.stroke();

  // Phase-fade edges — port side fading
  aethynPhaseEdge(ctx, accent, [
    [0.34, 0.48], [0.30, 0.38], [0.33, 0.28],
  ]);

  // Primary ring arc
  aethynRingArc(ctx, 0.50, 0.40, 0.24, 0.14,
    -Math.PI * 0.6, Math.PI * 0.55, accent);

  // Secondary ring arc — crossing the first at a different tilt
  aethynRingArc(ctx, 0.50, 0.46, 0.18, 0.20,
    -Math.PI * 0.3, Math.PI * 0.8, accent);

  // Floating satellite nodes
  aethynSatelliteNode(ctx, 0.74, 0.24, 0.022, accent, 5);
  aethynSatelliteNode(ctx, 0.26, 0.62, 0.020, accent, 4);

  // Phase nexus
  aethynNexus(ctx, 0.50, 0.34, 0.038, accent);

  // Dual engine folds
  aethynEngineGlow(ctx, 0.46, 0.82, 0.025);
  aethynEngineGlow(ctx, 0.54, 0.82, 0.025);
}

/**
 * TRANSPORT — Broader projection for cargo displacement.
 * A rounded pentagonal hull with a wide ring arc and multiple
 * floating nodes — the cargo modules exist mostly in other dimensions,
 * so the visible hull is deceptively compact.
 */
function aethynTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — wide pentagonal shape
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.lineTo(0.30, 0.28);
  ctx.lineTo(0.24, 0.54);
  ctx.lineTo(0.38, 0.76);
  ctx.lineTo(0.62, 0.76);
  ctx.lineTo(0.76, 0.54);
  ctx.lineTo(0.70, 0.28);
  ctx.closePath();
  aethynFill(ctx, accent);

  // Cargo hold indicator — inner pentagonal outline
  ctx.beginPath();
  ctx.moveTo(0.50, 0.24);
  ctx.lineTo(0.38, 0.34);
  ctx.lineTo(0.36, 0.54);
  ctx.lineTo(0.50, 0.64);
  ctx.lineTo(0.64, 0.54);
  ctx.lineTo(0.62, 0.34);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Phase-fade edges — both sides fading (cargo extends into other dims)
  aethynPhaseEdge(ctx, accent, [
    [0.24, 0.54], [0.18, 0.44], [0.22, 0.32],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.76, 0.54], [0.80, 0.46], [0.76, 0.34],
  ]);

  // Wide ring arc — dimensional cargo frame
  aethynRingArc(ctx, 0.50, 0.48, 0.30, 0.16,
    -Math.PI * 0.7, Math.PI * 0.7, accent);

  // Multiple floating nodes — extradimensional cargo pods
  aethynSatelliteNode(ctx, 0.16, 0.42, 0.020, accent, 6);
  aethynSatelliteNode(ctx, 0.84, 0.42, 0.018, accent, 6);
  aethynSatelliteNode(ctx, 0.50, 0.84, 0.016, accent, 5);

  // Phase nexus
  aethynNexus(ctx, 0.50, 0.44, 0.042, accent);

  // Dual engine folds
  aethynEngineGlow(ctx, 0.44, 0.74, 0.026);
  aethynEngineGlow(ctx, 0.56, 0.74, 0.026);
}

/**
 * CRUISER — Full Borromean ring structure with nested hull.
 * The cruiser is where the Aethyn visual language fully emerges:
 * multiple intersecting ring arcs, nested hull outlines suggesting
 * inner polyhedra, and a corona of floating nodes.
 */
function aethynCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Outer hull — large irregular octagon
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);
  ctx.lineTo(0.32, 0.16);
  ctx.lineTo(0.22, 0.38);
  ctx.lineTo(0.24, 0.62);
  ctx.lineTo(0.36, 0.80);
  ctx.lineTo(0.50, 0.88);
  ctx.lineTo(0.64, 0.80);
  ctx.lineTo(0.76, 0.62);
  ctx.lineTo(0.78, 0.38);
  ctx.lineTo(0.68, 0.16);
  ctx.closePath();
  aethynFill(ctx, accent);

  // Inner nested hull — the dual polyhedron shadow
  ctx.beginPath();
  ctx.moveTo(0.50, 0.18);
  ctx.lineTo(0.38, 0.28);
  ctx.lineTo(0.34, 0.46);
  ctx.lineTo(0.38, 0.64);
  ctx.lineTo(0.50, 0.72);
  ctx.lineTo(0.62, 0.64);
  ctx.lineTo(0.66, 0.46);
  ctx.lineTo(0.62, 0.28);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dimensional stress fracture lines
  ctx.strokeStyle = withAlpha(accent, 0.15);
  ctx.lineWidth = 0.003;
  ctx.beginPath(); ctx.moveTo(0.50, 0.04); ctx.lineTo(0.24, 0.62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.04); ctx.lineTo(0.76, 0.62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.88); ctx.lineTo(0.22, 0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.50, 0.88); ctx.lineTo(0.78, 0.38); ctx.stroke();

  // Phase-fade edges
  aethynPhaseEdge(ctx, accent, [
    [0.22, 0.38], [0.16, 0.30], [0.20, 0.20],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.78, 0.38], [0.82, 0.32], [0.78, 0.22],
  ]);

  // Triple intersecting ring arcs — the Borromean structure
  aethynRingArc(ctx, 0.50, 0.44, 0.30, 0.16,
    -Math.PI * 0.65, Math.PI * 0.55, accent);
  aethynRingArc(ctx, 0.50, 0.50, 0.22, 0.24,
    -Math.PI * 0.35, Math.PI * 0.75, accent);
  aethynRingArc(ctx, 0.46, 0.46, 0.26, 0.14,
    -Math.PI * 0.8, Math.PI * 0.2, accent);

  // Floating satellite nodes — sensor corona
  aethynSatelliteNode(ctx, 0.14, 0.30, 0.022, accent, 5);
  aethynSatelliteNode(ctx, 0.86, 0.30, 0.020, accent, 5);
  aethynSatelliteNode(ctx, 0.14, 0.68, 0.018, accent, 4);
  aethynSatelliteNode(ctx, 0.86, 0.68, 0.018, accent, 4);

  // Phase nexus — larger for cruiser
  aethynNexus(ctx, 0.50, 0.42, 0.048, accent);

  // Dual engine folds
  aethynEngineGlow(ctx, 0.42, 0.86, 0.030);
  aethynEngineGlow(ctx, 0.58, 0.86, 0.030);
}

/**
 * CARRIER — Broad dimensional platform with launch apertures.
 * The carrier projects a wide, flat cross-section into our space.
 * Fighters launch through dimensional apertures (ring structures)
 * rather than conventional hangars.
 */
function aethynCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — wide hexagonal platform
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.lineTo(0.22, 0.22);
  ctx.lineTo(0.12, 0.48);
  ctx.lineTo(0.22, 0.72);
  ctx.lineTo(0.50, 0.86);
  ctx.lineTo(0.78, 0.72);
  ctx.lineTo(0.88, 0.48);
  ctx.lineTo(0.78, 0.22);
  ctx.closePath();
  aethynFill(ctx, accent);

  // Inner deck outline
  ctx.beginPath();
  ctx.moveTo(0.50, 0.20);
  ctx.lineTo(0.32, 0.30);
  ctx.lineTo(0.26, 0.48);
  ctx.lineTo(0.32, 0.66);
  ctx.lineTo(0.50, 0.74);
  ctx.lineTo(0.68, 0.66);
  ctx.lineTo(0.74, 0.48);
  ctx.lineTo(0.68, 0.30);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Launch aperture rings — dimensional gates for fighters
  // Port aperture
  ctx.beginPath();
  ctx.ellipse(0.30, 0.42, 0.08, 0.06, -0.3, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Fill with glow
  const portGlow = ctx.createRadialGradient(0.30, 0.42, 0, 0.30, 0.42, 0.06);
  portGlow.addColorStop(0, withAlpha(accent, 0.25));
  portGlow.addColorStop(1, withAlpha(accent, 0));
  ctx.beginPath();
  ctx.ellipse(0.30, 0.42, 0.06, 0.04, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = portGlow;
  ctx.fill();

  // Starboard aperture
  ctx.beginPath();
  ctx.ellipse(0.70, 0.42, 0.08, 0.06, 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  const starGlow = ctx.createRadialGradient(0.70, 0.42, 0, 0.70, 0.42, 0.06);
  starGlow.addColorStop(0, withAlpha(accent, 0.25));
  starGlow.addColorStop(1, withAlpha(accent, 0));
  ctx.beginPath();
  ctx.ellipse(0.70, 0.42, 0.06, 0.04, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = starGlow;
  ctx.fill();

  // Fore aperture — primary launch gate
  ctx.beginPath();
  ctx.ellipse(0.50, 0.24, 0.10, 0.06, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  const foreGlow = ctx.createRadialGradient(0.50, 0.24, 0, 0.50, 0.24, 0.08);
  foreGlow.addColorStop(0, withAlpha(accent, 0.3));
  foreGlow.addColorStop(1, withAlpha(accent, 0));
  ctx.beginPath();
  ctx.ellipse(0.50, 0.24, 0.08, 0.04, 0, 0, Math.PI * 2);
  ctx.fillStyle = foreGlow;
  ctx.fill();

  // Phase-fade edges
  aethynPhaseEdge(ctx, accent, [
    [0.12, 0.48], [0.06, 0.38], [0.10, 0.26],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.88, 0.48], [0.92, 0.40], [0.88, 0.28],
  ]);

  // Partial ring arcs — structural, not propulsion
  aethynRingArc(ctx, 0.50, 0.48, 0.36, 0.18,
    -Math.PI * 0.6, Math.PI * 0.6, accent);
  aethynRingArc(ctx, 0.50, 0.48, 0.28, 0.28,
    -Math.PI * 0.4, Math.PI * 0.7, accent);

  // Floating satellite nodes — outrider escorts
  aethynSatelliteNode(ctx, 0.08, 0.36, 0.018, accent, 5);
  aethynSatelliteNode(ctx, 0.92, 0.36, 0.018, accent, 5);
  aethynSatelliteNode(ctx, 0.08, 0.60, 0.016, accent, 4);
  aethynSatelliteNode(ctx, 0.92, 0.60, 0.016, accent, 4);
  aethynSatelliteNode(ctx, 0.50, 0.92, 0.020, accent, 6);

  // Phase nexus
  aethynNexus(ctx, 0.50, 0.48, 0.045, accent);

  // Engine fold — single central
  aethynEngineGlow(ctx, 0.50, 0.82, 0.032);
}

/**
 * BATTLESHIP — Maximum dimensional projection. The most complex
 * Aethyn silhouette: a massive multi-layered hull with quadruple
 * ring arcs, dense nested geometry, a corona of floating nodes,
 * and phase-fade effects on multiple edges. Unmistakably alien.
 */
function aethynBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Outer hull — large irregular decagon
  ctx.beginPath();
  ctx.moveTo(0.50, 0.02);
  ctx.lineTo(0.30, 0.10);
  ctx.lineTo(0.18, 0.28);
  ctx.lineTo(0.14, 0.48);
  ctx.lineTo(0.18, 0.68);
  ctx.lineTo(0.32, 0.82);
  ctx.lineTo(0.50, 0.92);
  ctx.lineTo(0.68, 0.82);
  ctx.lineTo(0.82, 0.68);
  ctx.lineTo(0.86, 0.48);
  ctx.lineTo(0.82, 0.28);
  ctx.lineTo(0.70, 0.10);
  ctx.closePath();
  aethynFill(ctx, accent);

  // Mid hull layer — nested octagon
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.lineTo(0.34, 0.22);
  ctx.lineTo(0.26, 0.40);
  ctx.lineTo(0.28, 0.60);
  ctx.lineTo(0.38, 0.74);
  ctx.lineTo(0.50, 0.80);
  ctx.lineTo(0.62, 0.74);
  ctx.lineTo(0.72, 0.60);
  ctx.lineTo(0.74, 0.40);
  ctx.lineTo(0.66, 0.22);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(accent, 0.22);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Inner core layer — nested hexagon
  ctx.beginPath();
  ctx.moveTo(0.50, 0.26);
  ctx.lineTo(0.40, 0.34);
  ctx.lineTo(0.38, 0.50);
  ctx.lineTo(0.42, 0.64);
  ctx.lineTo(0.50, 0.68);
  ctx.lineTo(0.58, 0.64);
  ctx.lineTo(0.62, 0.50);
  ctx.lineTo(0.60, 0.34);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Dimensional stress fractures — radiating from centre
  ctx.strokeStyle = withAlpha(accent, 0.12);
  ctx.lineWidth = 0.003;
  const fractures: [number, number, number, number][] = [
    [0.50, 0.02, 0.14, 0.48],
    [0.50, 0.02, 0.86, 0.48],
    [0.50, 0.92, 0.14, 0.48],
    [0.50, 0.92, 0.86, 0.48],
    [0.18, 0.28, 0.82, 0.68],
    [0.82, 0.28, 0.18, 0.68],
  ];
  for (const [x1, y1, x2, y2] of fractures) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  // Phase-fade edges — multiple hull sections phasing out
  aethynPhaseEdge(ctx, accent, [
    [0.14, 0.48], [0.08, 0.38], [0.12, 0.24],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.86, 0.48], [0.90, 0.40], [0.86, 0.26],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.18, 0.68], [0.10, 0.72], [0.12, 0.80],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.82, 0.68], [0.88, 0.74], [0.86, 0.82],
  ]);

  // Quadruple intersecting ring arcs — the full gyroscope
  aethynRingArc(ctx, 0.50, 0.46, 0.36, 0.18,
    -Math.PI * 0.7, Math.PI * 0.6, accent);
  aethynRingArc(ctx, 0.50, 0.50, 0.28, 0.28,
    -Math.PI * 0.4, Math.PI * 0.8, accent);
  aethynRingArc(ctx, 0.46, 0.46, 0.32, 0.14,
    -Math.PI * 0.85, Math.PI * 0.15, accent);
  aethynRingArc(ctx, 0.54, 0.50, 0.24, 0.22,
    -Math.PI * 0.2, Math.PI * 0.9, accent);

  // Floating satellite node corona — weapons and sensors
  aethynSatelliteNode(ctx, 0.06, 0.32, 0.020, accent, 5);
  aethynSatelliteNode(ctx, 0.94, 0.32, 0.020, accent, 5);
  aethynSatelliteNode(ctx, 0.06, 0.64, 0.018, accent, 4);
  aethynSatelliteNode(ctx, 0.94, 0.64, 0.018, accent, 4);
  aethynSatelliteNode(ctx, 0.24, 0.92, 0.016, accent, 5);
  aethynSatelliteNode(ctx, 0.76, 0.92, 0.016, accent, 5);
  aethynSatelliteNode(ctx, 0.50, 0.96, 0.014, accent, 3);

  // Phase glow nodes — energy accumulation points
  const glowNodes: [number, number][] = [
    [0.36, 0.36], [0.64, 0.36], [0.30, 0.54],
    [0.70, 0.54], [0.36, 0.70], [0.64, 0.70],
  ];
  for (const [nx, ny] of glowNodes) {
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 0.025);
    ng.addColorStop(0, withAlpha(accent, 0.45));
    ng.addColorStop(1, withAlpha(accent, 0));
    ctx.beginPath();
    ctx.arc(nx, ny, 0.025, 0, Math.PI * 2);
    ctx.fillStyle = ng;
    ctx.fill();
  }

  // Phase nexus — large, central
  aethynNexus(ctx, 0.50, 0.46, 0.055, accent);

  // Triple engine folds
  aethynEngineGlow(ctx, 0.38, 0.90, 0.032);
  aethynEngineGlow(ctx, 0.50, 0.92, 0.026);
  aethynEngineGlow(ctx, 0.62, 0.90, 0.032);
}

/**
 * COLONISER — Dimensional ark. A rounded hull enclosing a large
 * habitat space that exists mostly in other dimensions. The visible
 * hull is a protective shell around the dimensional aperture through
 * which the colonists and their settlement equipment are stored in
 * a pocket of stabilised extradimensional space.
 */
function aethynColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Outer hull — rounded irregular polygon (faceted sphere)
  ctx.beginPath();
  const segments = 14;
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * 2 * i) / segments - Math.PI / 2;
    // Slightly irregular radius — not a perfect circle
    const r = 0.32 + 0.015 * Math.cos(a * 5) + 0.01 * Math.sin(a * 3);
    const px = 0.50 + r * Math.cos(a);
    const py = 0.48 + r * 0.92 * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  aethynFill(ctx, accent);

  // Inner habitat ring — the dimensional pocket boundary
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.18, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.008;
  ctx.stroke();

  // Second inner ring — stabilisation field
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.12, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Facet cross-lines through centre — dimensional anchors
  ctx.strokeStyle = withAlpha(accent, 0.15);
  ctx.lineWidth = 0.003;
  for (let i = 0; i < 7; i++) {
    const a = (Math.PI * i) / 7;
    ctx.beginPath();
    ctx.moveTo(0.50 + 0.30 * Math.cos(a), 0.48 + 0.28 * Math.sin(a));
    ctx.lineTo(0.50 - 0.30 * Math.cos(a), 0.48 - 0.28 * Math.sin(a));
    ctx.stroke();
  }

  // Phase-fade edges — multiple sections fading
  aethynPhaseEdge(ctx, accent, [
    [0.18, 0.46], [0.12, 0.36], [0.16, 0.26],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.82, 0.50], [0.86, 0.40], [0.82, 0.30],
  ]);
  aethynPhaseEdge(ctx, accent, [
    [0.42, 0.80], [0.36, 0.84], [0.32, 0.78],
  ]);

  // Ring arcs — structural, encircling the habitat
  aethynRingArc(ctx, 0.50, 0.48, 0.34, 0.18,
    -Math.PI * 0.6, Math.PI * 0.6, accent);
  aethynRingArc(ctx, 0.50, 0.48, 0.26, 0.26,
    -Math.PI * 0.3, Math.PI * 0.8, accent);

  // Floating satellite nodes — dimensional stabilisers
  aethynSatelliteNode(ctx, 0.12, 0.36, 0.018, accent, 6);
  aethynSatelliteNode(ctx, 0.88, 0.36, 0.018, accent, 6);
  aethynSatelliteNode(ctx, 0.12, 0.60, 0.016, accent, 5);
  aethynSatelliteNode(ctx, 0.88, 0.60, 0.016, accent, 5);
  aethynSatelliteNode(ctx, 0.50, 0.88, 0.020, accent, 5);

  // Habitat glow — the dimensional pocket itself, visible as warmth
  const habitatGlow = ctx.createRadialGradient(
    0.50, 0.48, 0, 0.50, 0.48, 0.14,
  );
  habitatGlow.addColorStop(0,   withAlpha(accent, 0.25));
  habitatGlow.addColorStop(0.5, withAlpha(accent, 0.1));
  habitatGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.14, 0, Math.PI * 2);
  ctx.fillStyle = habitatGlow;
  ctx.fill();

  // Phase nexus — the core anchor
  aethynNexus(ctx, 0.50, 0.48, 0.050, accent);

  // Engine fold
  aethynEngineGlow(ctx, 0.50, 0.80, 0.034);
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS — Integration notes

// ===========================================================================
//  VETHARA
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — Ship Designer Canvas Drawings
// ════════════════════════════════════════════════════════════════════════════
//
// All functions operate in a normalised 1x1 coordinate space.
// Ships face nose-UP (fore = top of canvas).
// Each function defines withAlpha/hexToRgb locally as required.
// Accent colour is passed as a hex string (e.g. '#cc2222').
//
// Visual language: pale grey host hull + red filament overlay.
// Host hull is drawn first as the base shape, then filaments and
// organ details are layered on top. Every ship class has a distinct
// silhouette, scaling from a small bonded capsule (scout) to a
// massive fully-colonised leviathan (battleship).


/** Host hull fill — bone-grey gradient with subtle accent outline */
function vetharaHostFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.1, 0.7, 0.9);
  grad.addColorStop(0,   '#b0a494');  // Warm bone-white
  grad.addColorStop(0.4, '#9a8e80');  // Mid grey-brown
  grad.addColorStop(1,   '#7a7068');  // Darker cartilage shadow
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.006;
  ctx.stroke();
}

/** Filament bead — small red-glowing dot */
function vetharaFilamentBead(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  accent: string,
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0,   withAlpha(accent, 0.9));
  grad.addColorStop(0.6, withAlpha(accent, 0.5));
  grad.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/** Organ pod — a larger glowing bulge */
function vetharaOrganPod(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  accent: string,
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0,   withAlpha(accent, 0.6));
  grad.addColorStop(0.5, withAlpha(accent, 0.3));
  grad.addColorStop(1,   withAlpha(accent, 0.05));
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/** Metabolic engine glow — red-orange biological pulse */
function vetharaEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom — deep red
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(220,60,40,0.6)');
  bloom.addColorStop(0.5, 'rgba(160,30,20,0.25)');
  bloom.addColorStop(1,   'rgba(100,15,10,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — bright orange-white
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,200,170,1)');
  core.addColorStop(0.4, 'rgba(230,80,50,0.85)');
  core.addColorStop(1,   'rgba(160,30,15,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Draw a spiral of filament beads around a hull path */
function vetharaFilamentSpiral(
  ctx: CanvasRenderingContext2D,
  centreX: number,
  topY: number, bottomY: number,
  hullHalfWidth: number,
  beadCount: number,
  accent: string,
): void {
  for (let i = 0; i < beadCount; i++) {
    const t = i / beadCount;
    const angle = t * Math.PI * 3;  // 1.5 full wraps
    const y = topY + t * (bottomY - topY);
    // Oscillate left-right to create spiral illusion in 2D
    const xOff = Math.sin(angle) * hullHalfWidth * 0.95;
    vetharaFilamentBead(ctx, centreX + xOff, y, 0.012, accent);
  }
}

/** Tendril line — a curved filament arm */
function vetharaTendril(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  cpx1: number, cpy1: number,
  cpx2: number, cpy2: number,
  x1: number, y1: number,
  accent: string,
  width = 0.006,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x1, y1);
  ctx.stroke();
}


// ── SCOUT — Fresh bonding, minimal filaments ─────────────────────────────
// Small capsule with a sparse filament spiral. The symbiont has just
// taken hold — the ship still looks almost normal.

function vetharaScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — small rounded capsule
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.bezierCurveTo(0.42, 0.16, 0.38, 0.28, 0.37, 0.42);
  ctx.bezierCurveTo(0.36, 0.56, 0.38, 0.68, 0.42, 0.76);
  ctx.bezierCurveTo(0.45, 0.80, 0.48, 0.82, 0.50, 0.83);
  ctx.bezierCurveTo(0.52, 0.82, 0.55, 0.80, 0.58, 0.76);
  ctx.bezierCurveTo(0.62, 0.68, 0.64, 0.56, 0.63, 0.42);
  ctx.bezierCurveTo(0.62, 0.28, 0.58, 0.16, 0.50, 0.12);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Sparse filament spiral — only 6 beads, tentative bonding
  vetharaFilamentSpiral(ctx, 0.50, 0.20, 0.74, 0.12, 6, accent);

  // Two thin tendril tips reaching past the bow
  vetharaTendril(ctx, 0.46, 0.18, 0.44, 0.12, 0.43, 0.08, 0.44, 0.04, accent, 0.004);
  vetharaTendril(ctx, 0.54, 0.18, 0.56, 0.12, 0.57, 0.08, 0.56, 0.04, accent, 0.004);

  // Single metabolic engine
  vetharaEngineGlow(ctx, 0.50, 0.81, 0.028);
}


// ── DESTROYER — Tendrils establishing control ────────────────────────────
// Elongated capsule with prominent tendril arms reaching forward from
// the bow and visible organ buds starting to form on the flanks.

function vetharaDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — elongated capsule, slightly wider
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.42, 0.12, 0.35, 0.24, 0.33, 0.40);
  ctx.bezierCurveTo(0.32, 0.55, 0.34, 0.68, 0.38, 0.78);
  ctx.bezierCurveTo(0.42, 0.84, 0.46, 0.87, 0.50, 0.88);
  ctx.bezierCurveTo(0.54, 0.87, 0.58, 0.84, 0.62, 0.78);
  ctx.bezierCurveTo(0.66, 0.68, 0.68, 0.55, 0.67, 0.40);
  ctx.bezierCurveTo(0.65, 0.24, 0.58, 0.12, 0.50, 0.08);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Filament spiral — denser, 10 beads
  vetharaFilamentSpiral(ctx, 0.50, 0.16, 0.80, 0.15, 10, accent);

  // Three tendril arms reaching forward — the symbiont grasps
  vetharaTendril(ctx, 0.44, 0.18, 0.40, 0.10, 0.38, 0.05, 0.36, 0.02, accent, 0.006);
  vetharaTendril(ctx, 0.50, 0.14, 0.50, 0.08, 0.50, 0.04, 0.50, 0.01, accent, 0.005);
  vetharaTendril(ctx, 0.56, 0.18, 0.60, 0.10, 0.62, 0.05, 0.64, 0.02, accent, 0.006);

  // Tendril tip beads — sensory nodes
  vetharaFilamentBead(ctx, 0.36, 0.02, 0.010, accent);
  vetharaFilamentBead(ctx, 0.50, 0.01, 0.008, accent);
  vetharaFilamentBead(ctx, 0.64, 0.02, 0.010, accent);

  // Small organ buds on flanks — weapons growing
  vetharaOrganPod(ctx, 0.30, 0.44, 0.030, 0.020, accent);
  vetharaOrganPod(ctx, 0.70, 0.44, 0.030, 0.020, accent);

  // Side tendrils connecting organ buds to hull
  vetharaTendril(ctx, 0.34, 0.38, 0.30, 0.40, 0.28, 0.44, 0.30, 0.44, accent, 0.004);
  vetharaTendril(ctx, 0.66, 0.38, 0.70, 0.40, 0.72, 0.44, 0.70, 0.44, accent, 0.004);

  // Twin metabolic engines
  vetharaEngineGlow(ctx, 0.45, 0.86, 0.032);
  vetharaEngineGlow(ctx, 0.55, 0.86, 0.032);
}


// ── TRANSPORT — Swollen pod, the carrier of unbonded filaments ───────────
// Wide ovoid hull (it carries stasis tanks full of unbonded Vethara).
// Filament network wraps the hull protectively. Membrane fins extend
// to the sides — the symbiont shielding its precious cargo.

function vetharaTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — wide, swollen capsule (cargo of stasis tanks)
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.bezierCurveTo(0.38, 0.18, 0.26, 0.30, 0.24, 0.46);
  ctx.bezierCurveTo(0.22, 0.60, 0.26, 0.72, 0.34, 0.80);
  ctx.bezierCurveTo(0.40, 0.85, 0.46, 0.87, 0.50, 0.87);
  ctx.bezierCurveTo(0.54, 0.87, 0.60, 0.85, 0.66, 0.80);
  ctx.bezierCurveTo(0.74, 0.72, 0.78, 0.60, 0.76, 0.46);
  ctx.bezierCurveTo(0.74, 0.30, 0.62, 0.18, 0.50, 0.14);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Interior stasis glow — the unbonded filaments within
  const stasisGlow = ctx.createRadialGradient(0.50, 0.50, 0, 0.50, 0.50, 0.20);
  stasisGlow.addColorStop(0,   withAlpha(accent, 0.25));
  stasisGlow.addColorStop(0.6, withAlpha(accent, 0.10));
  stasisGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.50, 0.20, 0, Math.PI * 2);
  ctx.fillStyle = stasisGlow;
  ctx.fill();

  // Filament spiral — dense wrapping, 12 beads protecting the cargo
  vetharaFilamentSpiral(ctx, 0.50, 0.22, 0.78, 0.22, 12, accent);

  // Protective membrane fins — the symbiont shielding its cargo
  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.beginPath();
  ctx.moveTo(0.24, 0.42);
  ctx.bezierCurveTo(0.16, 0.38, 0.12, 0.46, 0.14, 0.56);
  ctx.bezierCurveTo(0.16, 0.64, 0.22, 0.62, 0.24, 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.beginPath();
  ctx.moveTo(0.76, 0.42);
  ctx.bezierCurveTo(0.84, 0.38, 0.88, 0.46, 0.86, 0.56);
  ctx.bezierCurveTo(0.84, 0.64, 0.78, 0.62, 0.76, 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Two forward tendrils — shorter, this is not a warship
  vetharaTendril(ctx, 0.44, 0.20, 0.42, 0.14, 0.41, 0.10, 0.42, 0.06, accent, 0.005);
  vetharaTendril(ctx, 0.56, 0.20, 0.58, 0.14, 0.59, 0.10, 0.58, 0.06, accent, 0.005);

  // Twin metabolic engines
  vetharaEngineGlow(ctx, 0.42, 0.85, 0.030);
  vetharaEngineGlow(ctx, 0.58, 0.85, 0.030);
}


// ── CRUISER — The bonding deepens, membrane taking over ──────────────────
// Larger hull with full organ pods, membrane web stretched across
// the dorsal surface, and a dense filament network. The host hull
// is still visible but the symbiont is clearly dominant.

function vetharaCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — elongated ovoid, wider than destroyer
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.40, 0.10, 0.30, 0.22, 0.26, 0.38);
  ctx.bezierCurveTo(0.24, 0.52, 0.26, 0.66, 0.32, 0.76);
  ctx.bezierCurveTo(0.38, 0.84, 0.44, 0.88, 0.50, 0.90);
  ctx.bezierCurveTo(0.56, 0.88, 0.62, 0.84, 0.68, 0.76);
  ctx.bezierCurveTo(0.74, 0.66, 0.76, 0.52, 0.74, 0.38);
  ctx.bezierCurveTo(0.70, 0.22, 0.60, 0.10, 0.50, 0.06);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Membrane web — translucent overlay across the dorsal surface
  ctx.fillStyle = withAlpha(accent, 0.08);
  ctx.beginPath();
  ctx.moveTo(0.38, 0.22);
  ctx.bezierCurveTo(0.30, 0.30, 0.28, 0.50, 0.32, 0.66);
  ctx.bezierCurveTo(0.38, 0.74, 0.50, 0.78, 0.62, 0.74);  // Corrected: removed trailing space
  ctx.bezierCurveTo(0.68, 0.66, 0.72, 0.50, 0.70, 0.30);
  ctx.bezierCurveTo(0.66, 0.22, 0.58, 0.18, 0.50, 0.16);
  ctx.bezierCurveTo(0.42, 0.18, 0.38, 0.22, 0.38, 0.22);
  ctx.closePath();
  ctx.fill();

  // Filament ridges across the membrane
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0.38, 0.26); ctx.bezierCurveTo(0.42, 0.50, 0.40, 0.65, 0.38, 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.16); ctx.bezierCurveTo(0.50, 0.40, 0.50, 0.60, 0.50, 0.78);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.62, 0.26); ctx.bezierCurveTo(0.58, 0.50, 0.60, 0.65, 0.62, 0.72);
  ctx.stroke();

  // Dense filament spiral — 14 beads
  vetharaFilamentSpiral(ctx, 0.50, 0.14, 0.82, 0.20, 14, accent);

  // Four tendril arms at the bow — the symbiont reaches aggressively
  vetharaTendril(ctx, 0.40, 0.16, 0.36, 0.08, 0.34, 0.04, 0.32, 0.01, accent, 0.006);
  vetharaTendril(ctx, 0.47, 0.10, 0.46, 0.06, 0.45, 0.03, 0.44, 0.00, accent, 0.005);
  vetharaTendril(ctx, 0.53, 0.10, 0.54, 0.06, 0.55, 0.03, 0.56, 0.00, accent, 0.005);
  vetharaTendril(ctx, 0.60, 0.16, 0.64, 0.08, 0.66, 0.04, 0.68, 0.01, accent, 0.006);

  // Full organ pods on flanks — bio-acid launchers
  vetharaOrganPod(ctx, 0.22, 0.42, 0.040, 0.028, accent);
  vetharaOrganPod(ctx, 0.78, 0.42, 0.040, 0.028, accent);
  vetharaOrganPod(ctx, 0.24, 0.58, 0.035, 0.022, accent);
  vetharaOrganPod(ctx, 0.76, 0.58, 0.035, 0.022, accent);

  // Connecting tendrils from organs to hull
  vetharaTendril(ctx, 0.28, 0.38, 0.24, 0.40, 0.22, 0.42, 0.22, 0.42, accent, 0.004);
  vetharaTendril(ctx, 0.72, 0.38, 0.76, 0.40, 0.78, 0.42, 0.78, 0.42, accent, 0.004);

  // Twin metabolic engines
  vetharaEngineGlow(ctx, 0.42, 0.88, 0.035);
  vetharaEngineGlow(ctx, 0.58, 0.88, 0.035);
}


// ── CARRIER — Jellyfish-dome mother, dangling launch filaments ───────────
// Broad dome shape (the symbiont has restructured the host into a
// living hangar). Filaments hang below as launch rails for fighters.
// The dome is covered in a dense filament web.

function vetharaCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — broad dome, flattened (restructured into hangar)
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.32, 0.10, 0.16, 0.22, 0.14, 0.36);
  ctx.bezierCurveTo(0.14, 0.46, 0.22, 0.54, 0.36, 0.58);
  ctx.bezierCurveTo(0.42, 0.60, 0.50, 0.61, 0.50, 0.61);
  ctx.bezierCurveTo(0.50, 0.61, 0.58, 0.60, 0.64, 0.58);
  ctx.bezierCurveTo(0.78, 0.54, 0.86, 0.46, 0.86, 0.36);
  ctx.bezierCurveTo(0.84, 0.22, 0.68, 0.10, 0.50, 0.10);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Dome membrane overlay — the symbiont's web across the top
  ctx.fillStyle = withAlpha(accent, 0.07);
  ctx.beginPath();
  ctx.ellipse(0.50, 0.34, 0.30, 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Web ridges across dome
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  for (let i = 0; i < 5; i++) {
    const x = 0.26 + i * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, 0.18 + Math.abs(i - 2) * 0.04);
    ctx.bezierCurveTo(x, 0.30, x, 0.42, x, 0.54 - Math.abs(i - 2) * 0.03);
    ctx.stroke();
  }

  // Filament spiral around dome perimeter
  vetharaFilamentSpiral(ctx, 0.50, 0.14, 0.56, 0.28, 16, accent);

  // Launch filaments dangling below — fighter rails
  const launchX = [0.26, 0.36, 0.44, 0.56, 0.64, 0.74];
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.006;
  for (const lx of launchX) {
    ctx.beginPath();
    ctx.moveTo(lx, 0.58);
    ctx.bezierCurveTo(lx - 0.01, 0.68, lx + 0.01, 0.78, lx - 0.02, 0.90);
    ctx.stroke();
    // Stasis node at the tip of each filament
    vetharaFilamentBead(ctx, lx - 0.02, 0.90, 0.010, accent);
  }

  // Organ pods flanking the dome — point defence
  vetharaOrganPod(ctx, 0.14, 0.40, 0.032, 0.024, accent);
  vetharaOrganPod(ctx, 0.86, 0.40, 0.032, 0.024, accent);

  // Central neural mass — the carrier's coordination organ
  const neuralGlow = ctx.createRadialGradient(0.50, 0.32, 0, 0.50, 0.32, 0.06);
  neuralGlow.addColorStop(0,   withAlpha(accent, 0.5));
  neuralGlow.addColorStop(0.5, withAlpha(accent, 0.2));
  neuralGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.32, 0.06, 0, Math.PI * 2);
  ctx.fillStyle = neuralGlow;
  ctx.fill();

  // Engines — at the dome edges
  vetharaEngineGlow(ctx, 0.32, 0.56, 0.028);
  vetharaEngineGlow(ctx, 0.68, 0.56, 0.028);
}


// ── BATTLESHIP — Fully colonised leviathan ───────────────────────────────
// Massive hull completely overtaken by the symbiont. Tendril crown at
// the bow, dense organ clusters on all flanks, neural nexus dome on
// the dorsal surface, and trailing reproductive filaments at the stern.
// The host hull is barely visible beneath the organic overgrowth.

function vetharaBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — massive ovoid, almost entirely obscured
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.36, 0.08, 0.20, 0.20, 0.16, 0.38);
  ctx.bezierCurveTo(0.14, 0.52, 0.18, 0.68, 0.26, 0.78);
  ctx.bezierCurveTo(0.34, 0.86, 0.42, 0.90, 0.50, 0.92);
  ctx.bezierCurveTo(0.58, 0.90, 0.66, 0.86, 0.74, 0.78);
  ctx.bezierCurveTo(0.82, 0.68, 0.86, 0.52, 0.84, 0.38);
  ctx.bezierCurveTo(0.80, 0.20, 0.64, 0.08, 0.50, 0.06);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Full membrane overlay — the entire hull is webbed
  ctx.fillStyle = withAlpha(accent, 0.06);
  ctx.beginPath();
  ctx.ellipse(0.50, 0.48, 0.30, 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dense filament ridges — 7 lines across the hull
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.004;
  for (let i = 0; i < 7; i++) {
    const x = 0.24 + i * 0.08;
    const topY = 0.14 + Math.abs(i - 3) * 0.06;
    const botY = 0.84 - Math.abs(i - 3) * 0.04;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.bezierCurveTo(x - 0.01, topY + (botY - topY) * 0.4,
                       x + 0.01, topY + (botY - topY) * 0.7,
                       x, botY);
    ctx.stroke();
  }

  // Dense filament spiral — 20 beads, the hull is crawling
  vetharaFilamentSpiral(ctx, 0.50, 0.12, 0.86, 0.28, 20, accent);

  // TENDRIL CROWN — ring of tendrils at the bow
  const crownAngles = [-0.28, -0.16, -0.06, 0.06, 0.16, 0.28];
  for (const dx of crownAngles) {
    const startX = 0.50 + dx;
    const tipX = 0.50 + dx * 1.6;
    vetharaTendril(ctx,
      startX, 0.12,
      startX - dx * 0.2, 0.06,
      tipX - dx * 0.1, 0.03,
      tipX, 0.00,
      accent, 0.006);
    vetharaFilamentBead(ctx, tipX, 0.00, 0.008, accent);
  }

  // NEURAL NEXUS DOME — central command organ
  const nexusGlow = ctx.createRadialGradient(0.50, 0.36, 0, 0.50, 0.36, 0.08);
  nexusGlow.addColorStop(0,   withAlpha(accent, 0.6));
  nexusGlow.addColorStop(0.4, withAlpha(accent, 0.3));
  nexusGlow.addColorStop(1,   withAlpha(accent, 0.05));
  ctx.beginPath();
  ctx.ellipse(0.50, 0.36, 0.08, 0.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = nexusGlow;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Nexus connectors radiating outward
  const nexusLines: [number, number][] = [[0.36, 0.30], [0.64, 0.30], [0.34, 0.44], [0.66, 0.44]];
  for (const [nx, ny] of nexusLines) {
    ctx.strokeStyle = withAlpha(accent, 0.25);
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    ctx.moveTo(0.50, 0.36);
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }

  // ORGAN CLUSTERS — six weapon pods across both flanks
  const organs: [number, number, number, number][] = [
    [0.16, 0.36, 0.038, 0.026],
    [0.84, 0.36, 0.038, 0.026],
    [0.14, 0.52, 0.035, 0.024],
    [0.86, 0.52, 0.035, 0.024],
    [0.20, 0.68, 0.032, 0.022],
    [0.80, 0.68, 0.032, 0.022],
  ];
  for (const [ox, oy, orx, ory] of organs) {
    vetharaOrganPod(ctx, ox, oy, orx, ory, accent);
  }

  // Organ connection tendrils
  vetharaTendril(ctx, 0.22, 0.34, 0.18, 0.34, 0.16, 0.35, 0.16, 0.36, accent, 0.004);
  vetharaTendril(ctx, 0.78, 0.34, 0.82, 0.34, 0.84, 0.35, 0.84, 0.36, accent, 0.004);

  // TRAILING REPRODUCTIVE FILAMENTS at the stern
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.005;
  const trailX = [0.36, 0.43, 0.50, 0.57, 0.64];
  for (const tx of trailX) {
    ctx.beginPath();
    ctx.moveTo(tx, 0.88);
    ctx.bezierCurveTo(tx - 0.01, 0.92, tx + 0.01, 0.95, tx - 0.02, 0.99);
    ctx.stroke();
    vetharaFilamentBead(ctx, tx - 0.02, 0.99, 0.006, accent);
  }

  // Triple metabolic engines — the heartbeat of a leviathan
  vetharaEngineGlow(ctx, 0.38, 0.90, 0.036);
  vetharaEngineGlow(ctx, 0.50, 0.92, 0.030);
  vetharaEngineGlow(ctx, 0.62, 0.90, 0.036);
}


// ── COLONISER — The seed pod, carrying the future ────────────────────────
// Tear-shaped hull bulging with stasis cargo. The most important ship
// in the Vethara fleet — every one carries unbonded filaments searching
// for new hosts. Root-like filaments trail behind, and a protective
// membrane cocoon envelops the interior. The exterior crawls with
// the densest filament network of any non-capital ship.

function vetharaColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — teardrop seed pod, wider at the belly
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.40, 0.12, 0.30, 0.24, 0.26, 0.40);
  ctx.bezierCurveTo(0.24, 0.54, 0.26, 0.66, 0.32, 0.74);
  ctx.bezierCurveTo(0.38, 0.80, 0.44, 0.83, 0.50, 0.84);
  ctx.bezierCurveTo(0.56, 0.83, 0.62, 0.80, 0.68, 0.74);
  ctx.bezierCurveTo(0.74, 0.66, 0.76, 0.54, 0.74, 0.40);
  ctx.bezierCurveTo(0.70, 0.24, 0.60, 0.12, 0.50, 0.08);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Interior stasis glow — bright, this ship is FULL of unbonded Vethara
  const stasisGlow = ctx.createRadialGradient(0.50, 0.46, 0, 0.50, 0.46, 0.22);
  stasisGlow.addColorStop(0,   withAlpha(accent, 0.35));
  stasisGlow.addColorStop(0.4, withAlpha(accent, 0.15));
  stasisGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.46, 0.22, 0, Math.PI * 2);
  ctx.fillStyle = stasisGlow;
  ctx.fill();

  // Protective membrane cocoon — double layer
  ctx.fillStyle = withAlpha(accent, 0.06);
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.20, 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(accent, 0.15);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.16, 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Dense filament spiral — 16 beads, protective wrapping
  vetharaFilamentSpiral(ctx, 0.50, 0.16, 0.78, 0.20, 16, accent);

  // Protective tendrils at the bow — fewer than warships, but present
  vetharaTendril(ctx, 0.44, 0.16, 0.42, 0.10, 0.41, 0.06, 0.40, 0.02, accent, 0.005);
  vetharaTendril(ctx, 0.50, 0.12, 0.50, 0.07, 0.50, 0.04, 0.50, 0.01, accent, 0.005);
  vetharaTendril(ctx, 0.56, 0.16, 0.58, 0.10, 0.59, 0.06, 0.60, 0.02, accent, 0.005);

  // ROOT-LIKE trailing filaments — this ship is planting the future
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.38, 0.78);
  ctx.bezierCurveTo(0.34, 0.84, 0.30, 0.90, 0.26, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.46, 0.82);
  ctx.bezierCurveTo(0.44, 0.88, 0.42, 0.94, 0.40, 0.99);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.84);
  ctx.bezierCurveTo(0.50, 0.90, 0.50, 0.95, 0.50, 0.99);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.54, 0.82);
  ctx.bezierCurveTo(0.56, 0.88, 0.58, 0.94, 0.60, 0.99);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.62, 0.78);
  ctx.bezierCurveTo(0.66, 0.84, 0.70, 0.90, 0.74, 0.98);
  ctx.stroke();

  // Stasis node beads along the roots
  vetharaFilamentBead(ctx, 0.26, 0.98, 0.008, accent);
  vetharaFilamentBead(ctx, 0.40, 0.99, 0.007, accent);
  vetharaFilamentBead(ctx, 0.50, 0.99, 0.007, accent);
  vetharaFilamentBead(ctx, 0.60, 0.99, 0.007, accent);
  vetharaFilamentBead(ctx, 0.74, 0.98, 0.008, accent);

  // Flanking organ pods — smaller, defensive
  vetharaOrganPod(ctx, 0.22, 0.44, 0.030, 0.020, accent);
  vetharaOrganPod(ctx, 0.78, 0.44, 0.030, 0.020, accent);

  // Single large metabolic engine — efficient, not fast
  vetharaEngineGlow(ctx, 0.50, 0.83, 0.038);
}


// ════════════════════════════════════════════════════════════════════════════
//  EXPORTS (for integration reference)
// ════════════════════════════════════════════════════════════════════════════
//
// To integrate into the main codebase:
//
// 1. ShipModels3D.ts — Replace the existing buildVethara function
//    (lines 1149-1231) with the buildVethara function above.
//
// 2. ShipModels3D.ts — Replace the vethara entry in SPECIES_MATERIALS
//    (lines 1478-1486) with:
//      vethara: {
//        color: 0xbbaa99,
//        emissive: 0xcc2222,
//        emissiveIntensity: 0.3,
//        metalness: 0.2,
//        roughness: 0.6,
//      },
//
// 3. ShipDesignFamilies.ts — Add 'symbiotic' to the DesignFamily type:
//      export type DesignFamily = 'organic' | 'angular' | 'crystalline' | 'mechanical' | 'symbiotic' | 'practical';
//
// 4. ShipDesignFamilies.ts — Change vethara mapping:
//      vethara: 'symbiotic',
//
// 5. ShipDesignFamilies.ts — Add to FAMILY_DRAW_FNS:
//      symbiotic: {
//        scout:      vetharaScout,
//        destroyer:  vetharaDestroyer,
//        transport:  vetharaTransport,
//        cruiser:    vetharaCruiser,
//        carrier:    vetharaCarrier,
//        battleship: vetharaBattleship,
//        coloniser:  vetharaColoniser,
//      },

// ===========================================================================
//  PYRENTH
// ===========================================================================

//  SECTION 4: 2D WIREFRAMES — PYRENTH VOLCANIC DESIGN FAMILY
// ═══════════════════════════════════════════════════════════════════════════════
//
//  All functions operate in normalised 1x1 space, nose-UP.
//  Fore y ~ 0.06-0.10, engines y ~ 0.80-0.90.
//  accent = hex colour string for species tint.
//
//  Visual identity: obsidian-black faceted hulls with magma-vein accent
//  lines, caldera glow spots, and volcanic orange engine exhaust.
//  Every silhouette is irregular and geological — no smooth curves.

// ── Colour helpers (local) ───────────────────────────────────────────────────


// ── Pyrenth shared draw helpers ──────────────────────────────────────────────

/** Obsidian hull fill — near-black gradient with warm volcanic undertone. */
function pyrenthFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.08, 0.7, 0.92);
  grad.addColorStop(0,   '#2a2018');  // dark volcanic brown-black
  grad.addColorStop(0.35, '#1a1410');  // deep obsidian
  grad.addColorStop(0.7, '#120e0a');  // near-black basalt
  grad.addColorStop(1,   '#1e1610');  // slightly warmer aft
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Magma engine glow — volcanic orange core fading to deep red bloom. */
function magmaEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom — deep red haze
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(255,120,30,0.65)');
  bloom.addColorStop(0.4, 'rgba(200,60,10,0.3)');
  bloom.addColorStop(1,   'rgba(120,20,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-hot
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,240,200,1)');
  core.addColorStop(0.3, 'rgba(255,160,50,0.9)');
  core.addColorStop(0.7, 'rgba(220,80,10,0.6)');
  core.addColorStop(1,   'rgba(160,30,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Caldera glow — a volcanic crater viewport, brighter and more irregular
 *  than a standard viewport slit. Radial gradient with hexagonal hint. */
function calderaGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0,   'rgba(255,220,160,0.95)');
  glow.addColorStop(0.3, 'rgba(255,130,40,0.7)');
  glow.addColorStop(0.7, 'rgba(180,50,10,0.3)');
  glow.addColorStop(1,   'rgba(100,20,0,0)');
  // Draw as a rough hexagonal shape rather than a circle
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = glow;
  ctx.fill();
}

/** Magma vein line — a glowing accent line suggesting lava channels. */
function magmaVein(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  accent: string,
  width = 0.005,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Hotter core line
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = width * 2.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Fracture line — dark structural crack in the hull surface. */
function fractureLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}


// ── SCOUT — Obsidian Shard ──────────────────────────────────────────────────
// A thrown volcanic glass spearhead. Narrow, angular, sharp — the smallest
// and fastest Pyrenth hull. A single faceted shard with a magma vein running
// its length and a caldera sensor at the nose.

function pyrenthScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — irregular pentagonal shard
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // sharp prow
  ctx.lineTo(0.42, 0.22);   // left shoulder — asymmetric
  ctx.lineTo(0.38, 0.48);   // left waist
  ctx.lineTo(0.40, 0.72);   // left hip
  ctx.lineTo(0.44, 0.82);   // left engine
  ctx.lineTo(0.56, 0.82);   // right engine
  ctx.lineTo(0.60, 0.72);   // right hip
  ctx.lineTo(0.62, 0.48);   // right waist
  ctx.lineTo(0.58, 0.22);   // right shoulder
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Central magma vein — bow to stern
  magmaVein(ctx, 0.50, 0.14, 0.50, 0.78, accent, 0.004);

  // Fracture lines — geological strata
  fractureLine(ctx, 0.42, 0.36, 0.58, 0.34);
  fractureLine(ctx, 0.40, 0.58, 0.60, 0.56);

  // Caldera sensor — nose
  calderaGlow(ctx, 0.50, 0.16, 0.025);

  // Engine
  magmaEngineGlow(ctx, 0.50, 0.80, 0.028);
}


// ── DESTROYER — Basalt Fang ─────────────────────────────────────────────────
// A heavy wedge with overlapping tectonic plates and flanking magma vents.
// The hammerhead prow is split into two basalt prongs — like a serpent's
// fangs carved from volcanic glass. Twin engine columns at the stern.

function pyrenthDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad angular wedge with split prow
  ctx.beginPath();
  ctx.moveTo(0.44, 0.07);   // left fang tip
  ctx.lineTo(0.40, 0.16);   // left fang base
  ctx.lineTo(0.34, 0.20);   // left prow shoulder
  ctx.lineTo(0.28, 0.30);   // left armour plate edge
  ctx.lineTo(0.30, 0.70);   // left hull
  ctx.lineTo(0.36, 0.84);   // left engine mount
  ctx.lineTo(0.64, 0.84);   // right engine mount
  ctx.lineTo(0.70, 0.70);   // right hull
  ctx.lineTo(0.72, 0.30);   // right armour plate edge
  ctx.lineTo(0.66, 0.20);   // right prow shoulder
  ctx.lineTo(0.60, 0.16);   // right fang base
  ctx.lineTo(0.56, 0.07);   // right fang tip
  ctx.lineTo(0.50, 0.12);   // prow notch (between fangs)
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Tectonic plate lines
  fractureLine(ctx, 0.30, 0.36, 0.70, 0.34);
  fractureLine(ctx, 0.30, 0.52, 0.70, 0.50);
  fractureLine(ctx, 0.32, 0.68, 0.68, 0.66);

  // Magma veins — twin spines
  magmaVein(ctx, 0.44, 0.14, 0.42, 0.76, accent, 0.004);
  magmaVein(ctx, 0.56, 0.14, 0.58, 0.76, accent, 0.004);

  // Cross veins at plate boundaries
  magmaVein(ctx, 0.38, 0.35, 0.62, 0.35, accent, 0.003);
  magmaVein(ctx, 0.36, 0.51, 0.64, 0.51, accent, 0.003);

  // Magma vent bulges — flanking pentagonal shapes
  ctx.beginPath();
  ctx.moveTo(0.28, 0.38); ctx.lineTo(0.22, 0.42);
  ctx.lineTo(0.22, 0.50); ctx.lineTo(0.28, 0.54);
  ctx.lineTo(0.30, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.15);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.72, 0.38); ctx.lineTo(0.78, 0.42);
  ctx.lineTo(0.78, 0.50); ctx.lineTo(0.72, 0.54);
  ctx.lineTo(0.70, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.15);
  ctx.fill();

  // Caldera sensor
  calderaGlow(ctx, 0.50, 0.12, 0.022);

  // Twin engines
  magmaEngineGlow(ctx, 0.42, 0.82, 0.030);
  magmaEngineGlow(ctx, 0.58, 0.82, 0.030);
}


// ── TRANSPORT — Tectonic Barge ──────────────────────────────────────────────
// A wide, squat vessel like a slab of continental crust set adrift. Heavy
// armour plating in horizontal strata. The broadest Pyrenth hull — built
// to carry geological cargo (mineral specimens, terraforming materials)
// through the void. Twin engines flanking a broad stern.

function pyrenthTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad rectangular slab with angled prow
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);   // prow point
  ctx.lineTo(0.34, 0.18);   // left prow shoulder
  ctx.lineTo(0.24, 0.28);   // left upper hull
  ctx.lineTo(0.22, 0.72);   // left lower hull
  ctx.lineTo(0.28, 0.84);   // left engine flange
  ctx.lineTo(0.72, 0.84);   // right engine flange
  ctx.lineTo(0.78, 0.72);   // right lower hull
  ctx.lineTo(0.76, 0.28);   // right upper hull
  ctx.lineTo(0.66, 0.18);   // right prow shoulder
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Horizontal strata lines — geological layering
  fractureLine(ctx, 0.24, 0.32, 0.76, 0.32);
  fractureLine(ctx, 0.22, 0.44, 0.78, 0.44);
  fractureLine(ctx, 0.22, 0.56, 0.78, 0.56);
  fractureLine(ctx, 0.22, 0.68, 0.78, 0.68);

  // Central magma vein — spine
  magmaVein(ctx, 0.50, 0.16, 0.50, 0.80, accent, 0.005);

  // Cargo bay indicators — darker rectangular insets
  ctx.fillStyle = 'rgba(5,3,2,0.5)';
  ctx.fillRect(0.30, 0.34, 0.16, 0.08);
  ctx.fillRect(0.54, 0.34, 0.16, 0.08);
  ctx.fillRect(0.30, 0.46, 0.16, 0.08);
  ctx.fillRect(0.54, 0.46, 0.16, 0.08);
  ctx.fillRect(0.30, 0.58, 0.16, 0.08);
  ctx.fillRect(0.54, 0.58, 0.16, 0.08);

  // Caldera sensor
  calderaGlow(ctx, 0.50, 0.15, 0.024);

  // Twin engines
  magmaEngineGlow(ctx, 0.38, 0.82, 0.030);
  magmaEngineGlow(ctx, 0.62, 0.82, 0.030);
}


// ── CRUISER — Volcanic Monolith ─────────────────────────────────────────────
// The iconic Pyrenth warship — a massive faceted monolith that looks like
// a volcanic mountain set flying. Diamond-shaped profile with prominent
// dorsal spine, tectonic armour plates, and weapon spires erupting from
// the hull surface like crystal formations in basalt.

function pyrenthCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — elongated diamond with asymmetric facets
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // sharp prow
  ctx.lineTo(0.36, 0.18);   // left prow facet
  ctx.lineTo(0.24, 0.38);   // left upper broadening
  ctx.lineTo(0.22, 0.56);   // left maximum beam
  ctx.lineTo(0.26, 0.72);   // left narrowing
  ctx.lineTo(0.36, 0.84);   // left engine flange
  ctx.lineTo(0.50, 0.88);   // stern point
  ctx.lineTo(0.64, 0.84);   // right engine flange
  ctx.lineTo(0.74, 0.72);   // right narrowing
  ctx.lineTo(0.78, 0.56);   // right maximum beam
  ctx.lineTo(0.76, 0.38);   // right upper broadening
  ctx.lineTo(0.64, 0.18);   // right prow facet
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Tectonic plate fractures
  fractureLine(ctx, 0.32, 0.28, 0.68, 0.26);
  fractureLine(ctx, 0.24, 0.46, 0.76, 0.44);
  fractureLine(ctx, 0.24, 0.62, 0.76, 0.60);
  fractureLine(ctx, 0.30, 0.76, 0.70, 0.74);

  // Dorsal magma spine — triple vein
  magmaVein(ctx, 0.50, 0.10, 0.50, 0.84, accent, 0.005);
  magmaVein(ctx, 0.46, 0.22, 0.44, 0.78, accent, 0.003);
  magmaVein(ctx, 0.54, 0.22, 0.56, 0.78, accent, 0.003);

  // Weapon spire positions — accent triangles
  const spires: [number, number][] = [
    [0.30, 0.34], [0.70, 0.32],
    [0.26, 0.54], [0.74, 0.52],
  ];
  for (const [sx, sy] of spires) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - 0.04);
    ctx.lineTo(sx - 0.025, sy + 0.025);
    ctx.lineTo(sx + 0.025, sy + 0.025);
    ctx.closePath();
    ctx.fillStyle = withAlpha(accent, 0.35);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Caldera sensor — larger for cruiser class
  calderaGlow(ctx, 0.50, 0.14, 0.030);

  // Twin engines
  magmaEngineGlow(ctx, 0.42, 0.86, 0.032);
  magmaEngineGlow(ctx, 0.58, 0.86, 0.032);
}


// ── CARRIER — Caldera Platform ──────────────────────────────────────────────
// A broad, flat volcanic platform — like the summit of a shield volcano
// sliced off and hollowed out. The flight deck is a series of hexagonal
// launch calderas from which fighters erupt like volcanic ejecta. The
// widest Pyrenth hull, low-profile, with distributed engine clusters.

function pyrenthCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad hexagonal platform
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // prow
  ctx.lineTo(0.30, 0.16);   // left prow shoulder
  ctx.lineTo(0.16, 0.32);   // left forward flank
  ctx.lineTo(0.14, 0.58);   // left midship
  ctx.lineTo(0.18, 0.76);   // left aft flank
  ctx.lineTo(0.32, 0.88);   // left engine mount
  ctx.lineTo(0.68, 0.88);   // right engine mount
  ctx.lineTo(0.82, 0.76);   // right aft flank
  ctx.lineTo(0.86, 0.58);   // right midship
  ctx.lineTo(0.84, 0.32);   // right forward flank
  ctx.lineTo(0.70, 0.16);   // right prow shoulder
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Launch calderas — hexagonal bays (dark insets with magma rim glow)
  const bays: [number, number][] = [
    [0.32, 0.36], [0.68, 0.36],
    [0.32, 0.54], [0.68, 0.54],
    [0.32, 0.70], [0.68, 0.70],
  ];
  for (const [bx, by] of bays) {
    // Dark bay interior
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = bx + 0.055 * Math.cos(a);
      const py = by + 0.045 * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,4,2,0.7)';
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.35);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Central spine vein
  magmaVein(ctx, 0.50, 0.12, 0.50, 0.84, accent, 0.005);

  // Cross-vein at midship
  magmaVein(ctx, 0.20, 0.52, 0.80, 0.52, accent, 0.003);

  // Tectonic fractures
  fractureLine(ctx, 0.22, 0.30, 0.78, 0.28);
  fractureLine(ctx, 0.18, 0.64, 0.82, 0.62);

  // Caldera command — centre-forward
  calderaGlow(ctx, 0.50, 0.14, 0.028);

  // Triple engine cluster
  magmaEngineGlow(ctx, 0.38, 0.86, 0.030);
  magmaEngineGlow(ctx, 0.50, 0.88, 0.026);
  magmaEngineGlow(ctx, 0.62, 0.86, 0.030);
}


// ── BATTLESHIP — Tectonic Fortress ──────────────────────────────────────────
// The ultimate Pyrenth war machine — an entire geological formation set
// loose in space. Massive layered armour plates, a prominent dorsal magma
// ridge, weapon spires erupting from every surface, and a full cluster of
// basalt column engines at the stern. This ship looks like a volcanic island
// that decided to go to war. The silhouette should be unmistakable: heavy,
// angular, bristling with crystalline growths, and glowing with inner heat.

function pyrenthBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — massive faceted fortress
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);   // prow apex
  ctx.lineTo(0.34, 0.12);   // left prow facet
  ctx.lineTo(0.20, 0.28);   // left forward armour
  ctx.lineTo(0.14, 0.48);   // left broadest point
  ctx.lineTo(0.16, 0.68);   // left narrowing
  ctx.lineTo(0.24, 0.80);   // left aft armour
  ctx.lineTo(0.36, 0.90);   // left engine block
  ctx.lineTo(0.64, 0.90);   // right engine block
  ctx.lineTo(0.76, 0.80);   // right aft armour
  ctx.lineTo(0.84, 0.68);   // right narrowing
  ctx.lineTo(0.86, 0.48);   // right broadest point
  ctx.lineTo(0.80, 0.28);   // right forward armour
  ctx.lineTo(0.66, 0.12);   // right prow facet
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Heavy tectonic plate fractures
  fractureLine(ctx, 0.26, 0.24, 0.74, 0.22);
  fractureLine(ctx, 0.18, 0.38, 0.82, 0.36);
  fractureLine(ctx, 0.16, 0.54, 0.84, 0.52);
  fractureLine(ctx, 0.18, 0.68, 0.82, 0.66);
  fractureLine(ctx, 0.26, 0.80, 0.74, 0.78);

  // Dorsal magma ridge — triple spine with cross connections
  magmaVein(ctx, 0.50, 0.08, 0.50, 0.86, accent, 0.006);
  magmaVein(ctx, 0.44, 0.18, 0.40, 0.82, accent, 0.004);
  magmaVein(ctx, 0.56, 0.18, 0.60, 0.82, accent, 0.004);
  // Cross veins at plate boundaries
  magmaVein(ctx, 0.30, 0.37, 0.70, 0.37, accent, 0.003);
  magmaVein(ctx, 0.24, 0.53, 0.76, 0.53, accent, 0.003);
  magmaVein(ctx, 0.28, 0.67, 0.72, 0.67, accent, 0.003);

  // Weapon spires — triangular eruptions from hull surface
  const spires: [number, number][] = [
    [0.28, 0.30], [0.72, 0.28],
    [0.18, 0.48], [0.82, 0.46],
    [0.20, 0.64], [0.80, 0.62],
    [0.30, 0.76], [0.70, 0.74],
  ];
  for (const [sx, sy] of spires) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - 0.035);
    ctx.lineTo(sx - 0.022, sy + 0.02);
    ctx.lineTo(sx + 0.022, sy + 0.02);
    ctx.closePath();
    ctx.fillStyle = withAlpha(accent, 0.35);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.55);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Caldera command dome — prominent, forward
  calderaGlow(ctx, 0.50, 0.12, 0.035);
  // Secondary caldera — aft command
  calderaGlow(ctx, 0.50, 0.74, 0.022);

  // Triple engine cluster
  magmaEngineGlow(ctx, 0.40, 0.88, 0.034);
  magmaEngineGlow(ctx, 0.50, 0.90, 0.030);
  magmaEngineGlow(ctx, 0.60, 0.88, 0.034);
}


// ── COLONISER — World Forge Ark ─────────────────────────────────────────────
// The sacred vessel of the Pyrenth — a mobile fragment of Pyrenthos itself,
// carrying geological samples, mineral seedstock, and the knowledge to
// terraform a new world into the Perfect Forge. Shaped like an elongated
// geode: a rough exterior shell concealing a precious interior. Wider than
// a cruiser but more elongated, with habitat strata visible as glowing
// horizontal bands (the colonists within, suspended in their mineral
// hibernation matrices).

function pyrenthColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — elongated geode shape with faceted exterior
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // prow
  ctx.lineTo(0.36, 0.14);   // left prow facet
  ctx.lineTo(0.26, 0.26);   // left upper hull
  ctx.lineTo(0.22, 0.44);   // left widening
  ctx.lineTo(0.20, 0.58);   // left maximum beam
  ctx.lineTo(0.22, 0.70);   // left narrowing
  ctx.lineTo(0.28, 0.80);   // left aft hull
  ctx.lineTo(0.38, 0.88);   // left engine
  ctx.lineTo(0.62, 0.88);   // right engine
  ctx.lineTo(0.72, 0.80);   // right aft hull
  ctx.lineTo(0.78, 0.70);   // right narrowing
  ctx.lineTo(0.80, 0.58);   // right maximum beam
  ctx.lineTo(0.78, 0.44);   // right widening
  ctx.lineTo(0.74, 0.26);   // right upper hull
  ctx.lineTo(0.64, 0.14);   // right prow facet
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Geological strata fractures
  fractureLine(ctx, 0.30, 0.24, 0.70, 0.22);
  fractureLine(ctx, 0.24, 0.38, 0.76, 0.36);
  fractureLine(ctx, 0.22, 0.52, 0.78, 0.50);
  fractureLine(ctx, 0.22, 0.64, 0.78, 0.62);
  fractureLine(ctx, 0.28, 0.76, 0.72, 0.74);

  // Habitat strata — glowing bands between fracture lines
  // (colonists in mineral hibernation matrices)
  const strataY = [0.30, 0.44, 0.58];
  for (const sy of strataY) {
    ctx.beginPath();
    ctx.rect(0.30, sy, 0.40, 0.025);
    const sg = ctx.createLinearGradient(0.30, sy, 0.70, sy);
    sg.addColorStop(0,   withAlpha(accent, 0.2));
    sg.addColorStop(0.5, withAlpha(accent, 0.45));
    sg.addColorStop(1,   withAlpha(accent, 0.2));
    ctx.fillStyle = sg;
    ctx.fill();
  }

  // Central magma spine
  magmaVein(ctx, 0.50, 0.12, 0.50, 0.84, accent, 0.005);

  // Flanking veins
  magmaVein(ctx, 0.46, 0.20, 0.42, 0.80, accent, 0.003);
  magmaVein(ctx, 0.54, 0.20, 0.58, 0.80, accent, 0.003);

  // Caldera sensor — bow
  calderaGlow(ctx, 0.50, 0.13, 0.028);

  // Twin engines
  magmaEngineGlow(ctx, 0.44, 0.86, 0.030);
  magmaEngineGlow(ctx, 0.56, 0.86, 0.030);
}


// ── Species draw function lookup ────────────────────────────────────────────

type HullDrawMap = Record<string, FamilyDrawFn>;

const SPECIES_DRAW_FNS: Record<string, HullDrawMap> = {
  teranos: {
    scout: teranosScout, destroyer: teranosDestroyer, transport: teranosTransport,
    cruiser: teranosCruiser, carrier: teranosCarrier, battleship: teranosBattleship,
    coloniser: teranosColoniser,
  },
  khazari: {
    scout: khazariScout, destroyer: khazariDestroyer, transport: khazariTransport,
    cruiser: khazariCruiser, carrier: khazariCarrier, battleship: khazariBattleship,
    coloniser: khazariColoniser,
  },
  vaelori: {
    scout: vaeloriScout, destroyer: vaeloriDestroyer, transport: vaeloriTransport,
    cruiser: vaeloriCruiser, carrier: vaeloriCarrier, battleship: vaeloriBattleship,
    coloniser: vaeloriColoniser,
  },
  sylvani: {
    scout: sylvaniScout, destroyer: sylvaniDestroyer, transport: sylvaniTransport,
    cruiser: sylvaniCruiser, carrier: sylvaniCarrier, battleship: sylvaniBattleship,
    coloniser: sylvaniColoniser,
  },
  nexari: {
    scout: nexariScout, destroyer: nexariDestroyer, transport: nexariTransport,
    cruiser: nexariCruiser, carrier: nexariCarrier, battleship: nexariBattleship,
    coloniser: nexariColoniser,
  },
  drakmari: {
    scout: drakmariScout, destroyer: drakmariDestroyer, transport: drakmariTransport,
    cruiser: drakmariCruiser, carrier: drakmariCarrier, battleship: drakmariBattleship,
    coloniser: drakmariColoniser,
  },
  ashkari: {
    scout: ashkariScout, destroyer: ashkariDestroyer, transport: ashkariTransport,
    cruiser: ashkariCruiser, carrier: ashkariCarrier, battleship: ashkariBattleship,
    coloniser: ashkariColoniser,
  },
  luminari: {
    scout: luminariScout, destroyer: luminariDestroyer, transport: luminariTransport,
    cruiser: luminariCruiser, carrier: luminariCarrier, battleship: luminariBattleship,
    coloniser: luminariColoniser,
  },
  zorvathi: {
    scout: zorvathiScout, destroyer: zorvathiDestroyer, transport: zorvathiTransport,
    cruiser: zorvathiCruiser, carrier: zorvathiCarrier, battleship: zorvathiBattleship,
    coloniser: zorvathiColoniser,
  },
  orivani: {
    scout: orivaniScout, destroyer: orivaniDestroyer, transport: orivaniTransport,
    cruiser: orivaniCruiser, carrier: orivaniCarrier, battleship: orivaniBattleship,
    coloniser: orivaniColoniser,
  },
  kaelenth: {
    scout: kaelenthScout, destroyer: kaelenthDestroyer, transport: kaelenthTransport,
    cruiser: kaelenthCruiser, carrier: kaelenthCarrier, battleship: kaelenthBattleship,
    coloniser: kaelenthColoniser,
  },
  thyriaq: {
    scout: thyriaqScout, destroyer: thyriaqDestroyer, transport: thyriaqTransport,
    cruiser: thyriaqCruiser, carrier: thyriaqCarrier, battleship: thyriaqBattleship,
    coloniser: thyriaqColoniser,
  },
  aethyn: {
    scout: aethynScout, destroyer: aethynDestroyer, transport: aethynTransport,
    cruiser: aethynCruiser, carrier: aethynCarrier, battleship: aethynBattleship,
    coloniser: aethynColoniser,
  },
  vethara: {
    scout: vetharaScout, destroyer: vetharaDestroyer, transport: vetharaTransport,
    cruiser: vetharaCruiser, carrier: vetharaCarrier, battleship: vetharaBattleship,
    coloniser: vetharaColoniser,
  },
  pyrenth: {
    scout: pyrenthScout, destroyer: pyrenthDestroyer, transport: pyrenthTransport,
    cruiser: pyrenthCruiser, carrier: pyrenthCarrier, battleship: pyrenthBattleship,
    coloniser: pyrenthColoniser,
  },
};

/**
 * Look up a species-specific or family-level draw function for a hull class.
 * Returns null if no override (falls through to default ShipGraphics renderer).
 */
export function getFamilyDrawFn(
  hullClass: string,
  family: DesignFamily,
  speciesId?: string,
): FamilyDrawFn | null {
  // Prefer per-species if available
  if (speciesId && SPECIES_DRAW_FNS[speciesId]) {
    return SPECIES_DRAW_FNS[speciesId][hullClass] ?? null;
  }
  return null;
}
