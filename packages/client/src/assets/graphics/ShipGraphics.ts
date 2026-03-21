/**
 * ShipGraphics.ts
 *
 * Canvas 2D renderer for top-down ship hull silhouettes.
 * Produces PNG data URLs suitable for <img> src or CSS background-image.
 *
 * Design language: clean sci-fi line art with filled bodies, inspired by
 * Homeworld and FTL — all ships are oriented nose-up (fore = top of canvas).
 *
 * Each hull class has a visually distinct silhouette so ships remain
 * recognisable even at thumbnail sizes (16 px).
 */

import type { HullClass } from '@nova-imperia/shared';

// ── Render cache ───────────────────────────────────────────────────────────────

/**
 * Simple Map-based render cache.
 * Key format: `{hullClass}:{size}:{colour}:{full|thumb}`.
 */
const renderCache = new Map<string, string>();

function cacheKey(
  hullClass: HullClass,
  size: number,
  colour: string,
  thumbnail: boolean,
): string {
  return `${hullClass}:${size}:${colour}:${thumbnail ? 'thumb' : 'full'}`;
}

// ── Colour utilities ───────────────────────────────────────────────────────────

/** Parse a 3- or 6-digit hex colour string into [r, g, b] in the range 0-255. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(expanded, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

/**
 * Lighten (positive) or darken (negative) a hex colour.
 * `amount` is in the range -1 to +1.
 */
function shiftColour(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r + amount * 255)},${clamp(g + amount * 255)},${clamp(b + amount * 255)})`;
}

/** Return an `rgba(…)` string from a hex colour and an alpha value 0-1. */
function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Canvas factory ─────────────────────────────────────────────────────────────

/**
 * Create an offscreen canvas.
 * Works in real browsers and in jsdom test environments (which return a null
 * context — callers guard against this).
 */
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return el;
  }
  // Minimal stub for non-browser environments.
  return {
    width: w,
    height: h,
    getContext: () => null,
    toDataURL: () => '',
  } as unknown as HTMLCanvasElement;
}

// ── Common drawing helpers ─────────────────────────────────────────────────────

/**
 * Apply a top-left lit / bottom-right shadowed gradient fill over the
 * current path.  Call after beginPath / path commands but before stroke.
 */
function applyLighting(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  baseColour: string,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, shiftColour(baseColour, 0.22));    // highlight
  grad.addColorStop(0.5, baseColour);
  grad.addColorStop(1, shiftColour(baseColour, -0.22));   // shadow
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Draw a radial engine glow centred at (cx, cy) with radius r.
 * Colour fades from bright cyan-white at the core to transparent.
 */
function drawEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(160,245,255,0.95)');
  grad.addColorStop(0.4, 'rgba(60,180,255,0.70)');
  grad.addColorStop(1, 'rgba(20,80,200,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Draw a thin engraved panel line (dark semi-transparent polyline).
 * Coordinates are in the caller's transformed (normalised 0-1) space.
 */
function panelLine(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  alpha = 0.35,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1]);
  }
  ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

/**
 * Draw a specular highlight line (bright semi-transparent polyline)
 * along the lit edge of a shape.
 */
function specularLine(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  alpha = 0.45,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1]);
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/**
 * Draw a small glowing cockpit/bridge window dot at the fore of the ship.
 * Uses a radial gradient to simulate a lit porthole.
 */
function drawCockpit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const grad = ctx.createRadialGradient(
    cx - r * 0.2, cy - r * 0.2, 0,
    cx, cy, r,
  );
  grad.addColorStop(0, 'rgba(210,245,255,0.95)');
  grad.addColorStop(0.5, 'rgba(100,190,255,0.75)');
  grad.addColorStop(1, 'rgba(30,80,160,0.30)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Draw a circular turret hardpoint with a protruding barrel facing fore.
 * The barrel points toward y=0 (fore of the ship).
 */
function drawTurret(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  baseColour: string,
): void {
  // Turret base disc
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = shiftColour(baseColour, -0.15);
  ctx.fill();
  ctx.strokeStyle = shiftColour(baseColour, 0.10);
  ctx.lineWidth = 0.005;
  ctx.stroke();

  // Barrel — thin line pointing fore (upward in canvas space)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.3);
  ctx.lineTo(cx, cy - r * 1.9);
  ctx.strokeStyle = shiftColour(baseColour, -0.20);
  ctx.lineWidth = r * 0.55;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();
}

// ── Per-hull draw functions ────────────────────────────────────────────────────
//
// All draw functions work in a normalised coordinate space: the canvas is
// treated as a 1×1 unit square.  The caller applies ctx.scale(drawSize,
// drawSize) before invoking these functions, so all coordinates here are
// fractions of the canvas side.
//
// Orientation: nose = top (y ≈ 0.05), engines = bottom (y ≈ 0.75-0.82).

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  colour: string,
  detailed: boolean,
) => void;

// ── Scout ──────────────────────────────────────────────────────────────────────

/**
 * Scout: sleek triangular dart, narrow span, single engine.
 * The most minimal silhouette — instantly recognisable by its sharp nose.
 */
function drawScout(
  ctx: CanvasRenderingContext2D,
  colour: string,
  detailed: boolean,
): void {
  // Main hull — elongated kite / dart shape
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);   // nose tip
  ctx.lineTo(0.68, 0.60);   // starboard aft flare
  ctx.lineTo(0.60, 0.70);   // starboard engine root
  ctx.lineTo(0.50, 0.67);   // centreline aft notch
  ctx.lineTo(0.40, 0.70);   // port engine root
  ctx.lineTo(0.32, 0.60);   // port aft flare
  ctx.closePath();
  applyLighting(ctx, 0.32, 0.04, 0.36, 0.66, colour);

  // Hull outline
  ctx.strokeStyle = shiftColour(colour, 0.15);
  ctx.lineWidth = 0.018;
  ctx.stroke();

  if (detailed) {
    // Spine crease
    panelLine(ctx, [[0.50, 0.10], [0.50, 0.64]]);
    // Wing root crease
    panelLine(ctx, [[0.40, 0.52], [0.60, 0.52]]);
    // Specular highlight along the port leading edge
    specularLine(ctx, [[0.50, 0.05], [0.34, 0.56]]);
  }

  // Cockpit — small porthole near nose
  drawCockpit(ctx, 0.50, 0.17, 0.042);

  // Single central engine glow
  drawEngineGlow(ctx, 0.50, 0.70, 0.052);
}

// ── Destroyer ─────────────────────────────────────────────────────────────────

/**
 * Destroyer: aggressive wedge hull with two swept wing pods each housing
 * an engine.  A fore weapon strake protrudes from the nose.
 */
function drawDestroyer(
  ctx: CanvasRenderingContext2D,
  colour: string,
  detailed: boolean,
): void {
  // Central spine hull
  ctx.beginPath();
  ctx.moveTo(0.50, 0.05);   // nose
  ctx.lineTo(0.60, 0.22);
  ctx.lineTo(0.64, 0.52);
  ctx.lineTo(0.55, 0.72);
  ctx.lineTo(0.45, 0.72);
  ctx.lineTo(0.36, 0.52);
  ctx.lineTo(0.40, 0.22);
  ctx.closePath();
  applyLighting(ctx, 0.36, 0.05, 0.28, 0.67, colour);
  ctx.strokeStyle = shiftColour(colour, 0.15);
  ctx.lineWidth = 0.019;
  ctx.stroke();

  // Port swept wing pod
  ctx.beginPath();
  ctx.moveTo(0.40, 0.35);
  ctx.lineTo(0.18, 0.50);
  ctx.lineTo(0.22, 0.66);
  ctx.lineTo(0.43, 0.60);
  ctx.closePath();
  ctx.fillStyle = shiftColour(colour, -0.07);
  ctx.fill();
  ctx.strokeStyle = shiftColour(colour, 0.10);
  ctx.lineWidth = 0.015;
  ctx.stroke();

  // Starboard swept wing pod
  ctx.beginPath();
  ctx.moveTo(0.60, 0.35);
  ctx.lineTo(0.82, 0.50);
  ctx.lineTo(0.78, 0.66);
  ctx.lineTo(0.57, 0.60);
  ctx.closePath();
  ctx.fillStyle = shiftColour(colour, -0.07);
  ctx.fill();
  ctx.strokeStyle = shiftColour(colour, 0.10);
  ctx.lineWidth = 0.015;
  ctx.stroke();

  if (detailed) {
    // Fore weapon strake protruding from nose
    ctx.beginPath();
    ctx.moveTo(0.47, 0.06);
    ctx.lineTo(0.46, 0.01);
    ctx.lineTo(0.54, 0.01);
    ctx.lineTo(0.53, 0.06);
    ctx.fillStyle = shiftColour(colour, -0.12);
    ctx.fill();

    // Spine panel line
    panelLine(ctx, [[0.50, 0.12], [0.50, 0.68]]);
    // Shoulder crease
    panelLine(ctx, [[0.40, 0.34], [0.60, 0.34]]);
    // Specular highlight
    specularLine(ctx, [[0.50, 0.06], [0.40, 0.38]]);
  }

  // Cockpit
  drawCockpit(ctx, 0.50, 0.14, 0.045);

  // Pod engine glows
  drawEngineGlow(ctx, 0.22, 0.64, 0.048);
  drawEngineGlow(ctx, 0.78, 0.64, 0.048);
  // Central engine
  drawEngineGlow(ctx, 0.50, 0.72, 0.040);
}

// ── Transport ─────────────────────────────────────────────────────────────────

/**
 * Transport: wide, squat cargo hauler.  Rectangular cargo bay dominates
 * the silhouette.  Small pointed cockpit at the fore.  Rounded corners
 * signal a civilian, non-threatening vessel.
 */
function drawTransport(
  ctx: CanvasRenderingContext2D,
  colour: string,
  detailed: boolean,
): void {
  // Cargo bay — rounded rectangle
  const bx = 0.17;
  const by = 0.29;
  const bw = 0.66;
  const bh = 0.43;
  const br = 0.055;

  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  applyLighting(ctx, bx, by, bw, bh, colour);
  ctx.strokeStyle = shiftColour(colour, 0.15);
  ctx.lineWidth = 0.017;
  ctx.stroke();

  // Cockpit / fore section
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.lineTo(0.63, 0.31);
  ctx.lineTo(0.37, 0.31);
  ctx.closePath();
  ctx.fillStyle = shiftColour(colour, 0.08);
  ctx.fill();
  ctx.strokeStyle = shiftColour(colour, 0.18);
  ctx.lineWidth = 0.015;
  ctx.stroke();

  if (detailed) {
    // Cargo bay horizontal dividers
    panelLine(ctx, [[0.18, 0.43], [0.82, 0.43]]);
    panelLine(ctx, [[0.18, 0.56], [0.82, 0.56]]);
    // Vertical bay struts
    panelLine(ctx, [[0.37, 0.30], [0.37, 0.72]]);
    panelLine(ctx, [[0.63, 0.30], [0.63, 0.72]]);
    // Specular highlight along cargo bay top edge
    specularLine(ctx, [[0.20, 0.30], [0.80, 0.30]]);
  }

  // Cockpit window
  drawCockpit(ctx, 0.50, 0.15, 0.048);

  // Thruster array — three glows across the aft face
  drawEngineGlow(ctx, 0.35, 0.73, 0.044);
  drawEngineGlow(ctx, 0.50, 0.73, 0.044);
  drawEngineGlow(ctx, 0.65, 0.73, 0.044);
}

// ── Cruiser ───────────────────────────────────────────────────────────────────

/**
 * Cruiser: medium warship with a wider beam than the destroyer.
 * A mid-hull bulge suggests a reactor housing.  Two turret hardpoints
 * are visible amidships in full-detail mode.
 */
function drawCruiser(
  ctx: CanvasRenderingContext2D,
  colour: string,
  detailed: boolean,
): void {
  // Main hull
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);
  ctx.lineTo(0.63, 0.17);
  ctx.lineTo(0.72, 0.40);   // widest point
  ctx.lineTo(0.68, 0.62);
  ctx.lineTo(0.57, 0.74);
  ctx.lineTo(0.43, 0.74);
  ctx.lineTo(0.32, 0.62);
  ctx.lineTo(0.28, 0.40);   // widest point port
  ctx.lineTo(0.37, 0.17);
  ctx.closePath();
  applyLighting(ctx, 0.28, 0.04, 0.44, 0.70, colour);

  ctx.strokeStyle = shiftColour(colour, 0.18);
  ctx.lineWidth = 0.021;
  ctx.stroke();

  if (detailed) {
    // Spine
    panelLine(ctx, [[0.50, 0.10], [0.50, 0.70]]);
    // Beam crease at widest point
    panelLine(ctx, [[0.30, 0.40], [0.70, 0.40]]);
    // Fore section shoulder
    panelLine(ctx, [[0.38, 0.24], [0.62, 0.24]]);
    // Specular highlight
    specularLine(ctx, [[0.50, 0.05], [0.37, 0.34]]);

    // Turret hardpoints — port and starboard amidships
    drawTurret(ctx, 0.35, 0.44, 0.036, colour);
    drawTurret(ctx, 0.65, 0.44, 0.036, colour);
  }

  // Cockpit
  drawCockpit(ctx, 0.50, 0.12, 0.050);

  // Three-engine array
  drawEngineGlow(ctx, 0.40, 0.75, 0.046);
  drawEngineGlow(ctx, 0.50, 0.76, 0.040);
  drawEngineGlow(ctx, 0.60, 0.75, 0.046);
}

// ── Carrier ───────────────────────────────────────────────────────────────────

/**
 * Carrier: large, flat-topped flight deck hull.  Beam greatly exceeds
 * fore-aft length.  Hangar bay openings are cut into port and starboard
 * flanks.  A command island sits on the fore centreline.
 */
function drawCarrier(
  ctx: CanvasRenderingContext2D,
  colour: string,
  detailed: boolean,
): void {
  // Flight deck — wide slab
  ctx.beginPath();
  ctx.moveTo(0.50, 0.07);   // fore centreline
  ctx.lineTo(0.76, 0.14);   // fore starboard
  ctx.lineTo(0.90, 0.32);
  ctx.lineTo(0.88, 0.62);
  ctx.lineTo(0.72, 0.76);   // aft starboard
  ctx.lineTo(0.28, 0.76);   // aft port
  ctx.lineTo(0.12, 0.62);
  ctx.lineTo(0.10, 0.32);
  ctx.lineTo(0.24, 0.14);   // fore port
  ctx.closePath();
  applyLighting(ctx, 0.10, 0.07, 0.80, 0.69, colour);

  ctx.strokeStyle = shiftColour(colour, 0.20);
  ctx.lineWidth = 0.020;
  ctx.stroke();

  // Command island — raised superstructure fore-centre
  ctx.beginPath();
  ctx.rect(0.44, 0.11, 0.12, 0.20);
  ctx.fillStyle = shiftColour(colour, 0.10);
  ctx.fill();
  ctx.strokeStyle = shiftColour(colour, 0.22);
  ctx.lineWidth = 0.012;
  ctx.stroke();

  if (detailed) {
    // Landing strip centreline (faint)
    panelLine(ctx, [[0.50, 0.13], [0.50, 0.72]], 0.20);
    // Deck cross-frame
    panelLine(ctx, [[0.14, 0.42], [0.86, 0.42]]);

    // Port hangar bay opening
    ctx.beginPath();
    ctx.rect(0.11, 0.46, 0.055, 0.10);
    ctx.fillStyle = withAlpha('#000810', 0.88);
    ctx.fill();
    ctx.strokeStyle = shiftColour(colour, -0.10);
    ctx.lineWidth = 0.009;
    ctx.stroke();

    // Starboard hangar bay opening
    ctx.beginPath();
    ctx.rect(0.835, 0.46, 0.055, 0.10);
    ctx.fillStyle = withAlpha('#000810', 0.88);
    ctx.fill();
    ctx.strokeStyle = shiftColour(colour, -0.10);
    ctx.lineWidth = 0.009;
    ctx.stroke();

    // Specular highlight across fore edge
    specularLine(ctx, [[0.24, 0.14], [0.76, 0.14]]);
  }

  // Command island cockpit window
  drawCockpit(ctx, 0.50, 0.15, 0.038);

  // Four-engine array spread across the aft
  drawEngineGlow(ctx, 0.32, 0.77, 0.044);
  drawEngineGlow(ctx, 0.43, 0.78, 0.044);
  drawEngineGlow(ctx, 0.57, 0.78, 0.044);
  drawEngineGlow(ctx, 0.68, 0.77, 0.044);
}

// ── Battleship ────────────────────────────────────────────────────────────────

/**
 * Battleship: the heaviest, most armoured hull class.  Thick angular
 * silhouette with broad flanks.  Four turret hardpoints visible in
 * detailed mode.  Five-engine bank at the aft.  Most intricate silhouette.
 */
function drawBattleship(
  ctx: CanvasRenderingContext2D,
  colour: string,
  detailed: boolean,
): void {
  // Core hull — broad and armoured
  ctx.beginPath();
  ctx.moveTo(0.50, 0.03);   // nose
  ctx.lineTo(0.61, 0.11);
  ctx.lineTo(0.74, 0.17);   // fore flare starboard
  ctx.lineTo(0.80, 0.32);
  ctx.lineTo(0.80, 0.56);   // max beam
  ctx.lineTo(0.74, 0.70);
  ctx.lineTo(0.60, 0.78);
  ctx.lineTo(0.40, 0.78);
  ctx.lineTo(0.26, 0.70);
  ctx.lineTo(0.20, 0.56);
  ctx.lineTo(0.20, 0.32);
  ctx.lineTo(0.26, 0.17);   // fore flare port
  ctx.lineTo(0.39, 0.11);
  ctx.closePath();
  applyLighting(ctx, 0.20, 0.03, 0.60, 0.75, colour);

  ctx.strokeStyle = shiftColour(colour, 0.20);
  ctx.lineWidth = 0.024;
  ctx.stroke();

  if (detailed) {
    // Spine
    panelLine(ctx, [[0.50, 0.08], [0.50, 0.74]]);
    // Cross-frames
    panelLine(ctx, [[0.22, 0.32], [0.78, 0.32]]);
    panelLine(ctx, [[0.22, 0.56], [0.78, 0.56]]);
    // Diagonal armour creases
    panelLine(ctx, [[0.39, 0.13], [0.30, 0.38]]);
    panelLine(ctx, [[0.61, 0.13], [0.70, 0.38]]);
    // Specular highlights along both leading edges
    specularLine(ctx, [[0.50, 0.04], [0.74, 0.17]]);
    specularLine(ctx, [[0.50, 0.04], [0.26, 0.17]]);

    // Four turret hardpoints — fore and mid
    drawTurret(ctx, 0.34, 0.23, 0.040, colour);
    drawTurret(ctx, 0.66, 0.23, 0.040, colour);
    drawTurret(ctx, 0.30, 0.56, 0.040, colour);
    drawTurret(ctx, 0.70, 0.56, 0.040, colour);
  }

  // Command bridge window
  drawCockpit(ctx, 0.50, 0.10, 0.052);

  // Five-engine bank
  drawEngineGlow(ctx, 0.30, 0.79, 0.046);
  drawEngineGlow(ctx, 0.40, 0.81, 0.050);
  drawEngineGlow(ctx, 0.50, 0.82, 0.054);
  drawEngineGlow(ctx, 0.60, 0.81, 0.050);
  drawEngineGlow(ctx, 0.70, 0.79, 0.046);
}

// ── Dispatch table ─────────────────────────────────────────────────────────────

const HULL_DRAW_FNS: Record<HullClass, DrawFn> = {
  scout:      drawScout,
  destroyer:  drawDestroyer,
  transport:  drawTransport,
  cruiser:    drawCruiser,
  carrier:    drawCarrier,
  battleship: drawBattleship,
};

// ── Core render function ───────────────────────────────────────────────────────

/**
 * Render a ship silhouette to an offscreen canvas and return it as a data URL.
 *
 * All draw functions work in a normalised 1×1 unit square.  A small margin
 * is applied so hull outlines never clip the canvas edge.
 */
function renderToDataUrl(
  hullClass: HullClass,
  size: number,
  colour: string,
  thumbnail: boolean,
): string {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, size, size);

  // Reserve a margin so stroke outlines do not clip the canvas edge
  const margin = thumbnail ? size * 0.04 : size * 0.06;
  const drawSize = size - margin * 2;

  ctx.save();
  ctx.translate(margin, margin);
  ctx.scale(drawSize, drawSize);

  HULL_DRAW_FNS[hullClass](ctx, colour, !thumbnail);

  ctx.restore();

  return canvas.toDataURL('image/png');
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Default player colour — muted blue-grey reminiscent of naval vessels. */
const DEFAULT_COLOUR = '#88bbdd';

/**
 * Render a full-detail top-down ship silhouette icon.
 *
 * The image is drawn at `size × size` pixels and returned as a PNG data URL
 * suitable for use as an `<img>` `src` or CSS `background-image`.
 * Results are cached by hull class, size, and colour so repeated calls
 * at the same arguments are essentially free.
 *
 * @param hullClass  Hull class identifier (scout | destroyer | transport | cruiser | carrier | battleship).
 * @param size       Width / height of the output image in pixels.  32–128 px is the recommended range.
 * @param colour     Optional hex colour for the hull body.  Defaults to `'#88bbdd'`.
 * @returns          PNG data URL string, or an empty string if canvas is unavailable.
 */
export function renderShipIcon(
  hullClass: HullClass,
  size: number,
  colour: string = DEFAULT_COLOUR,
): string {
  const key = cacheKey(hullClass, size, colour, false);
  const cached = renderCache.get(key);
  if (cached !== undefined) return cached;

  const result = renderToDataUrl(hullClass, size, colour, false);
  renderCache.set(key, result);
  return result;
}

/**
 * Render a simplified ship thumbnail suitable for dense fleet lists.
 *
 * Omits panel lines, turrets, and other fine detail that is illegible at
 * small sizes.  Always uses the default player colour.  Recommended range
 * is 16–32 px.
 *
 * @param hullClass  Hull class identifier.
 * @param size       Width / height in pixels.
 * @returns          PNG data URL string, or an empty string if canvas is unavailable.
 */
export function renderShipThumbnail(
  hullClass: HullClass,
  size: number,
): string {
  const key = cacheKey(hullClass, size, DEFAULT_COLOUR, true);
  const cached = renderCache.get(key);
  if (cached !== undefined) return cached;

  const result = renderToDataUrl(hullClass, size, DEFAULT_COLOUR, true);
  renderCache.set(key, result);
  return result;
}

/**
 * Clear the in-memory render cache.
 *
 * Call this when the player changes faction colour at runtime so that
 * subsequent calls to `renderShipIcon` regenerate icons in the new colour
 * rather than returning stale cached images.
 */
export function clearShipIconCache(): void {
  renderCache.clear();
}
