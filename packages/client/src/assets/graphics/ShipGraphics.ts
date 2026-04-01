/**
 * ShipGraphics.ts
 *
 * Canvas 2D renderer for top-down ship hull silhouettes.
 * Produces PNG data URLs suitable for <img> src or CSS background-image.
 *
 * Design language: industrial sci-fi line art inspired by The Expanse and
 * Homeworld.  Ships face nose-up (fore = top of canvas).  All hulls are
 * rendered in a grey base colour with faction-coloured accent panels, panel
 * seam lines, greeble details, running lights, engine bloom, and weapon
 * hardpoints.
 *
 * All draw functions operate in a normalised 1×1 coordinate space; the caller
 * applies ctx.scale(drawSize, drawSize) before invoking them.  Coordinates
 * are therefore plain fractions of the canvas side.
 *
 * Orientation convention: nose ≈ y 0.04–0.08, engines ≈ y 0.72–0.88.
 */

import type { HullClass } from '@nova-imperia/shared';
import { getDesignFamily, getFamilyDrawFn } from './ShipDesignFamilies';

// ── Render cache ───────────────────────────────────────────────────────────────

/**
 * Simple Map-based render cache.
 * Key format: `{hullClass}:{size}:{accentColour}:{full|thumb}`.
 */
const renderCache = new Map<string, string>();

function cacheKey(
  hullClass: HullClass,
  size: number,
  colour: string,
  thumbnail: boolean,
  speciesId?: string,
): string {
  return `${hullClass}:${size}:${colour}:${thumbnail ? 'thumb' : 'full'}:${speciesId ?? ''}`;
}

// ── Colour utilities ───────────────────────────────────────────────────────────

/** Parse a 3- or 6-digit hex colour string into [r, g, b] (0–255). */
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
 * Lighten (positive amount) or darken (negative amount) a hex colour.
 * `amount` is in the range −1 to +1.
 */
function shiftColour(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r + amount * 255)},${clamp(g + amount * 255)},${clamp(b + amount * 255)})`;
}

/** Return an `rgba(…)` string from a hex colour and alpha 0–1. */
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
 * Hull base colour — dark metallic grey that reads well against space backgrounds.
 * Accent panels and highlights are drawn on top using the caller-supplied colour.
 */
const _HULL_GREY   = '#3a3d42';
const HULL_DARK   = '#252729';
const HULL_MID    = '#4a4e55';
const HULL_LIGHT  = '#6a7078';

/**
 * Apply a left-lit / right-shadowed linear gradient fill over the
 * current path.  Call after `beginPath` / path commands, before `stroke`.
 * Light comes from the top-left, shadow falls to the bottom-right.
 */
function _applyLighting(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  baseColour: string,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0,   shiftColour(baseColour, 0.25));   // highlight
  grad.addColorStop(0.5, baseColour);
  grad.addColorStop(1,   shiftColour(baseColour, -0.25));  // shadow
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Fill the current path with a solid left-lit gradient using the standard
 * hull-grey palette.  `litLeft` controls whether the lit side is on the
 * left (true, default) or right.
 */
function hullFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  litLeft = true,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  if (litLeft) {
    grad.addColorStop(0,   HULL_LIGHT);
    grad.addColorStop(0.45, HULL_MID);
    grad.addColorStop(1,   HULL_DARK);
  } else {
    grad.addColorStop(0,   HULL_DARK);
    grad.addColorStop(0.55, HULL_MID);
    grad.addColorStop(1,   HULL_LIGHT);
  }
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Draw a radial engine glow centred at (cx, cy) with inner radius `r`.
 * An outer bloom ring (2× radius, lower opacity) simulates light scatter.
 * Colour is a hot cyan-blue gradient typical of ion/plasma thrusters.
 */
function drawEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  // Outer bloom
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(100,210,255,0.55)');
  bloom.addColorStop(0.5, 'rgba(40,120,220,0.25)');
  bloom.addColorStop(1,   'rgba(10,40,160,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();

  // Engine nozzle dark ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,22,26,0.85)';
  ctx.fill();

  // Core glow
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(220,250,255,1.0)');
  core.addColorStop(0.35, 'rgba(80,200,255,0.90)');
  core.addColorStop(0.75, 'rgba(30,100,240,0.65)');
  core.addColorStop(1,   'rgba(10,40,180,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/**
 * Draw a thin engraved panel seam line (dark polyline).
 * Coordinates are in the normalised 0–1 space.
 */
function panelLine(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  alpha = 0.50,
  width = 0.007,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1]);
  }
  ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * Draw a specular highlight line (bright polyline) along the lit edge of a shape.
 */
function specularLine(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  alpha = 0.55,
  width = 0.006,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1]);
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * Draw a small glowing cockpit / bridge window.
 * A radial gradient gives a lit-porthole appearance.
 */
function drawCockpit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const grad = ctx.createRadialGradient(
    cx - r * 0.25, cy - r * 0.25, 0,
    cx, cy, r,
  );
  grad.addColorStop(0,   'rgba(230,250,255,1.0)');
  grad.addColorStop(0.45, 'rgba(120,210,255,0.85)');
  grad.addColorStop(1,   'rgba(30,80,170,0.25)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,230,255,0.60)';
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/**
 * Draw a horizontal strip of cockpit windows (a bridge viewport bar).
 * `count` evenly-spaced circular windows are drawn in a row.
 */
function drawWindowStrip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  totalWidth: number,
  count: number,
  r: number,
): void {
  const step = count > 1 ? totalWidth / (count - 1) : 0;
  const startX = cx - totalWidth / 2;
  for (let i = 0; i < count; i++) {
    const wx = startX + i * step;
    drawCockpit(ctx, wx, cy, r);
  }
}

/**
 * Draw a circular turret hardpoint with a protruding gun barrel.
 * The barrel points fore (upward in canvas space, toward y = 0).
 */
function drawTurret(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  accentColour: string,
): void {
  // Turret base ring (dark grey)
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = HULL_DARK;
  ctx.fill();
  ctx.strokeStyle = shiftColour(accentColour, 0.05);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Inner rotor disc
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = HULL_MID;
  ctx.fill();

  // Gun barrel — twin lines pointing fore
  const barrelW = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx - barrelW, cy - r * 0.45);
  ctx.lineTo(cx - barrelW, cy - r * 1.80);
  ctx.lineTo(cx + barrelW, cy - r * 1.80);
  ctx.lineTo(cx + barrelW, cy - r * 0.45);
  ctx.fillStyle = HULL_DARK;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

/**
 * Draw a small rectangular greeble (surface detail box) with a subtle sheen.
 * Used to break up large flat hull surfaces.
 */
function drawGreeble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lightTop = true,
): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = lightTop ? HULL_DARK : HULL_MID;
  ctx.fill();
  ctx.strokeStyle = lightTop
    ? 'rgba(255,255,255,0.18)'
    : 'rgba(0,0,0,0.40)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

/**
 * Draw a circular sensor / antenna dish.
 * `facingUp` determines whether the dish arc opens upward (true) or downward.
 */
function drawSensorDish(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  facingUp = true,
): void {
  const startAngle = facingUp ? Math.PI : 0;
  const endAngle   = facingUp ? Math.PI * 2 : Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = HULL_MID;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Dish centre reflector dot
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(180,220,255,0.80)';
  ctx.fill();
}

/**
 * Draw a green (starboard) or red (port) running light.
 * Follows naval conventions: starboard = right = green, port = left = red.
 */
function runningLight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  colour: 'green' | 'red',
): void {
  const inner = colour === 'green'
    ? 'rgba(80,255,120,1.0)'
    : 'rgba(255,70,70,1.0)';
  const outer = colour === 'green'
    ? 'rgba(40,200,80,0)'
    : 'rgba(200,30,30,0)';
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  grad.addColorStop(0,   inner);
  grad.addColorStop(0.4, colour === 'green' ? 'rgba(60,220,100,0.55)' : 'rgba(220,50,50,0.55)');
  grad.addColorStop(1,   outer);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = inner;
  ctx.fill();
}

/**
 * Draw an accent panel — a filled shape using the faction colour.
 * Points array defines the polygon in normalised space.
 */
function accentPanel(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  accentColour: string,
  alpha = 0.85,
): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1]);
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha(accentColour, alpha);
  ctx.fill();
}

/**
 * Draw a hull outline stroke using the standard dark outline colour.
 */
function hullOutline(ctx: CanvasRenderingContext2D, width = 0.020): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.70)';
  ctx.lineWidth = width;
  ctx.stroke();
}

// ── Per-hull draw functions ────────────────────────────────────────────────────

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
) => void;

// ── Scout ──────────────────────────────────────────────────────────────────────

/**
 * Scout: sleek needle / dart silhouette.  Single central engine.  Small sensor
 * dish at the nose.  Minimal armour panels — every gramme saved for speed.
 * The narrow chord and sharp nose make it instantly distinguishable at tiny sizes.
 */
function drawScout(
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
): void {
  // ── Main hull — bezier-curved kite shape ──
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);                               // nose tip
  ctx.bezierCurveTo(0.58, 0.20, 0.68, 0.38, 0.66, 0.55); // starboard leading edge
  ctx.lineTo(0.62, 0.64);
  ctx.lineTo(0.54, 0.68);                               // starboard engine fairing
  ctx.lineTo(0.50, 0.66);                               // centreline aft notch
  ctx.lineTo(0.46, 0.68);                               // port engine fairing
  ctx.lineTo(0.38, 0.64);
  ctx.bezierCurveTo(0.32, 0.38, 0.42, 0.20, 0.50, 0.04); // port leading edge
  ctx.closePath();
  hullFill(ctx, 0.32, 0.04, 0.36, 0.64);
  hullOutline(ctx, 0.018);

  if (detailed) {
    // Accent stripe down the port leading edge
    accentPanel(ctx, [
      [0.50, 0.06], [0.44, 0.30], [0.41, 0.30], [0.50, 0.06],
    ], accentColour, 0.70);

    // Spine panel line
    panelLine(ctx, [[0.50, 0.10], [0.50, 0.64]]);
    // Wing root crease
    panelLine(ctx, [[0.38, 0.50], [0.62, 0.50]]);
    // Fore brace lines
    panelLine(ctx, [[0.50, 0.22], [0.44, 0.44]]);
    panelLine(ctx, [[0.50, 0.22], [0.56, 0.44]]);

    // Specular highlight along port leading edge
    specularLine(ctx, [[0.50, 0.05], [0.38, 0.48]]);

    // Greeble details on aft section
    drawGreeble(ctx, 0.43, 0.54, 0.04, 0.022);
    drawGreeble(ctx, 0.53, 0.54, 0.04, 0.022);

    // Sensor dish at nose
    drawSensorDish(ctx, 0.50, 0.09, 0.030, true);
  }

  // Cockpit — compact porthole
  drawCockpit(ctx, 0.50, 0.17, 0.036);

  // Running lights: starboard = green (right), port = red (left)
  runningLight(ctx, 0.64, 0.40, 0.010, 'green');
  runningLight(ctx, 0.36, 0.40, 0.010, 'red');

  // Single central engine glow
  drawEngineGlow(ctx, 0.50, 0.69, 0.048);
}

// ── Destroyer ─────────────────────────────────────────────────────────────────

/**
 * Destroyer: aggressive forward-swept wedge with two engine nacelles on short
 * swept-back pylons.  Forward weapon strake at the nose.  Angular armour plates
 * with a bold red accent stripe along the centreline.
 */
function drawDestroyer(
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
): void {
  // ── Port engine nacelle ──
  ctx.beginPath();
  ctx.moveTo(0.36, 0.32);
  ctx.lineTo(0.16, 0.46);
  ctx.bezierCurveTo(0.12, 0.54, 0.14, 0.64, 0.18, 0.68);
  ctx.lineTo(0.28, 0.65);
  ctx.lineTo(0.40, 0.58);
  ctx.closePath();
  hullFill(ctx, 0.12, 0.32, 0.28, 0.36, false);
  hullOutline(ctx, 0.013);

  // ── Starboard engine nacelle ──
  ctx.beginPath();
  ctx.moveTo(0.64, 0.32);
  ctx.lineTo(0.84, 0.46);
  ctx.bezierCurveTo(0.88, 0.54, 0.86, 0.64, 0.82, 0.68);
  ctx.lineTo(0.72, 0.65);
  ctx.lineTo(0.60, 0.58);
  ctx.closePath();
  hullFill(ctx, 0.60, 0.32, 0.28, 0.36);
  hullOutline(ctx, 0.013);

  // ── Central spine hull — forward-swept wedge ──
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);                                  // nose
  ctx.bezierCurveTo(0.57, 0.14, 0.64, 0.24, 0.64, 0.36);  // starboard fore
  ctx.lineTo(0.62, 0.62);
  ctx.lineTo(0.55, 0.70);
  ctx.lineTo(0.45, 0.70);
  ctx.lineTo(0.38, 0.62);
  ctx.bezierCurveTo(0.36, 0.24, 0.43, 0.14, 0.50, 0.04);  // port fore
  ctx.closePath();
  hullFill(ctx, 0.36, 0.04, 0.28, 0.66);
  hullOutline(ctx, 0.020);

  if (detailed) {
    // Red accent stripe down the centreline
    accentPanel(ctx, [
      [0.485, 0.06], [0.515, 0.06],
      [0.540, 0.40], [0.460, 0.40],
    ], accentColour, 0.80);

    // Nose weapon strake
    ctx.beginPath();
    ctx.moveTo(0.455, 0.07);
    ctx.lineTo(0.445, 0.02);
    ctx.lineTo(0.555, 0.02);
    ctx.lineTo(0.545, 0.07);
    ctx.closePath();
    ctx.fillStyle = HULL_DARK;
    ctx.fill();
    hullOutline(ctx, 0.010);

    // Spine seam
    panelLine(ctx, [[0.50, 0.11], [0.50, 0.66]]);
    // Shoulder crease
    panelLine(ctx, [[0.39, 0.34], [0.61, 0.34]]);
    // Armour plate boundaries
    panelLine(ctx, [[0.44, 0.14], [0.38, 0.48]]);
    panelLine(ctx, [[0.56, 0.14], [0.62, 0.48]]);
    // Aft cross-brace
    panelLine(ctx, [[0.40, 0.56], [0.60, 0.56]]);

    // Specular highlights along fore edges
    specularLine(ctx, [[0.50, 0.05], [0.40, 0.34]]);

    // Fore turret hardpoint
    drawTurret(ctx, 0.50, 0.22, 0.032, accentColour);

    // Greebles on nacelles
    drawGreeble(ctx, 0.165, 0.52, 0.050, 0.018);
    drawGreeble(ctx, 0.785, 0.52, 0.050, 0.018);

    // Pylon join accent
    accentPanel(ctx, [
      [0.36, 0.32], [0.40, 0.38], [0.38, 0.60], [0.34, 0.58],
    ], accentColour, 0.50);
    accentPanel(ctx, [
      [0.64, 0.32], [0.60, 0.38], [0.62, 0.60], [0.66, 0.58],
    ], accentColour, 0.50);
  }

  // Cockpit
  drawCockpit(ctx, 0.50, 0.14, 0.040);

  // Running lights
  runningLight(ctx, 0.82, 0.50, 0.011, 'green');
  runningLight(ctx, 0.18, 0.50, 0.011, 'red');

  // Nacelle engine glows
  drawEngineGlow(ctx, 0.20, 0.66, 0.044);
  drawEngineGlow(ctx, 0.80, 0.66, 0.044);
  // Central aft engine
  drawEngineGlow(ctx, 0.50, 0.71, 0.038);
}

// ── Transport ─────────────────────────────────────────────────────────────────

/**
 * Transport: wide-bodied civilian cargo hauler.  The large rectangular cargo bay
 * dominates the silhouette.  A small pointed cockpit module sits at the fore.
 * Four engine pods are arranged in a row across the aft face.  Extensive hull
 * plating and greebles give an industrial, utilitarian feel.
 */
function drawTransport(
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
): void {
  const bx = 0.13;
  const by = 0.28;
  const bw = 0.74;
  const bh = 0.44;
  const br = 0.040;  // corner radius

  // ── Cargo bay — large rounded rectangle ──
  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by,       bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh,  bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx,      by + bh,  bx,      by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx,      by,       bx + br, by);
  ctx.closePath();
  hullFill(ctx, bx, by, bw, bh);
  hullOutline(ctx, 0.018);

  // ── Cockpit module — small wedge at fore centre ──
  ctx.beginPath();
  ctx.moveTo(0.50, 0.05);
  ctx.lineTo(0.64, 0.30);
  ctx.lineTo(0.36, 0.30);
  ctx.closePath();
  ctx.fillStyle = HULL_MID;
  ctx.fill();
  hullOutline(ctx, 0.016);

  if (detailed) {
    // Accent stripe — two horizontal bands on the cargo bay
    accentPanel(ctx, [
      [bx + 0.01, by + 0.06], [bx + bw - 0.01, by + 0.06],
      [bx + bw - 0.01, by + 0.10], [bx + 0.01, by + 0.10],
    ], accentColour, 0.75);
    accentPanel(ctx, [
      [bx + 0.01, by + bh - 0.10], [bx + bw - 0.01, by + bh - 0.10],
      [bx + bw - 0.01, by + bh - 0.06], [bx + 0.01, by + bh - 0.06],
    ], accentColour, 0.75);

    // Cargo bay panel grid
    panelLine(ctx, [[bx + 0.01, by + 0.16], [bx + bw - 0.01, by + 0.16]]);
    panelLine(ctx, [[bx + 0.01, by + 0.28], [bx + bw - 0.01, by + 0.28]]);
    panelLine(ctx, [[bx + 0.245, by + 0.01], [bx + 0.245, by + bh - 0.01]]);
    panelLine(ctx, [[bx + 0.49,  by + 0.01], [bx + 0.49,  by + bh - 0.01]]);
    panelLine(ctx, [[bx + 0.735, by + 0.01], [bx + 0.735, by + bh - 0.01]]);

    // Cargo bay specular highlight across the top edge
    specularLine(ctx, [[bx + 0.02, by + 0.01], [bx + bw - 0.02, by + 0.01]]);

    // Cockpit spine line
    panelLine(ctx, [[0.50, 0.10], [0.50, 0.28]]);

    // Greeble blocks on cargo bay sides
    drawGreeble(ctx, bx + 0.02, by + 0.18, 0.055, 0.040);
    drawGreeble(ctx, bx + bw - 0.075, by + 0.18, 0.055, 0.040);
    drawGreeble(ctx, bx + 0.02, by + 0.30, 0.040, 0.030);
    drawGreeble(ctx, bx + bw - 0.060, by + 0.30, 0.040, 0.030);

    // Sensor array on cockpit nose
    drawSensorDish(ctx, 0.50, 0.09, 0.028, true);

    // Window strip on cockpit
    drawWindowStrip(ctx, 0.50, 0.20, 0.09, 3, 0.014);
  }

  // Cockpit window
  drawCockpit(ctx, 0.50, 0.14, 0.042);

  // Running lights — wide-beam ship has extended beam lights
  runningLight(ctx, bx + bw - 0.02, by + bh * 0.35, 0.012, 'green');
  runningLight(ctx, bx + 0.02,      by + bh * 0.35, 0.012, 'red');

  // Four engine pods across the aft face
  drawEngineGlow(ctx, 0.25, 0.73, 0.042);
  drawEngineGlow(ctx, 0.38, 0.74, 0.042);
  drawEngineGlow(ctx, 0.62, 0.74, 0.042);
  drawEngineGlow(ctx, 0.75, 0.73, 0.042);
}

// ── Cruiser ───────────────────────────────────────────────────────────────────

/**
 * Cruiser: balanced capital ship with a wide beam and layered armour.  A raised
 * bridge section sits fore-centre.  Side-mounted sensor arrays.  Four visible
 * turret positions provide 360° coverage.  Three-engine aft drive.
 */
function drawCruiser(
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
): void {
  // ── Port sensor arm ──
  ctx.beginPath();
  ctx.moveTo(0.35, 0.38);
  ctx.lineTo(0.12, 0.42);
  ctx.lineTo(0.10, 0.50);
  ctx.lineTo(0.14, 0.56);
  ctx.lineTo(0.36, 0.52);
  ctx.closePath();
  hullFill(ctx, 0.10, 0.38, 0.26, 0.18, false);
  hullOutline(ctx, 0.013);

  // ── Starboard sensor arm ──
  ctx.beginPath();
  ctx.moveTo(0.65, 0.38);
  ctx.lineTo(0.88, 0.42);
  ctx.lineTo(0.90, 0.50);
  ctx.lineTo(0.86, 0.56);
  ctx.lineTo(0.64, 0.52);
  ctx.closePath();
  hullFill(ctx, 0.64, 0.38, 0.26, 0.18);
  hullOutline(ctx, 0.013);

  // ── Main hull — wide-beam diamond profile ──
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);                                   // nose
  ctx.bezierCurveTo(0.60, 0.15, 0.72, 0.28, 0.74, 0.42);   // starboard fore
  ctx.lineTo(0.70, 0.62);
  ctx.lineTo(0.58, 0.74);
  ctx.lineTo(0.42, 0.74);
  ctx.lineTo(0.30, 0.62);
  ctx.bezierCurveTo(0.26, 0.42, 0.28, 0.28, 0.50, 0.04);   // port fore via wide belly
  // Correct the port bezier by re-doing as two segments
  ctx.closePath();
  // Redraw with correct path
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);
  ctx.bezierCurveTo(0.60, 0.14, 0.72, 0.28, 0.74, 0.42);
  ctx.lineTo(0.70, 0.62);
  ctx.lineTo(0.58, 0.74);
  ctx.lineTo(0.42, 0.74);
  ctx.lineTo(0.30, 0.62);
  ctx.bezierCurveTo(0.26, 0.28, 0.38, 0.14, 0.50, 0.04);
  ctx.closePath();
  hullFill(ctx, 0.26, 0.04, 0.48, 0.70);
  hullOutline(ctx, 0.021);

  // ── Raised bridge section — superstructure box ──
  ctx.beginPath();
  ctx.rect(0.42, 0.10, 0.16, 0.18);
  ctx.fillStyle = HULL_MID;
  ctx.fill();
  hullOutline(ctx, 0.013);

  if (detailed) {
    // Accent panels — fore shoulder strakes
    accentPanel(ctx, [
      [0.50, 0.06], [0.62, 0.22], [0.56, 0.24], [0.50, 0.08],
    ], accentColour, 0.70);
    accentPanel(ctx, [
      [0.50, 0.06], [0.38, 0.22], [0.44, 0.24], [0.50, 0.08],
    ], accentColour, 0.70);

    // Hull seam lines
    panelLine(ctx, [[0.50, 0.12], [0.50, 0.70]]);                // spine
    panelLine(ctx, [[0.30, 0.42], [0.70, 0.42]]);                // max-beam crease
    panelLine(ctx, [[0.36, 0.24], [0.64, 0.24]]);                // fore shoulder
    panelLine(ctx, [[0.34, 0.56], [0.66, 0.56]]);                // aft shoulder
    panelLine(ctx, [[0.38, 0.26], [0.30, 0.60]]);                // port armour edge
    panelLine(ctx, [[0.62, 0.26], [0.70, 0.60]]);                // starboard armour edge

    // Sensor arm detail lines
    panelLine(ctx, [[0.12, 0.46], [0.36, 0.44]]);
    panelLine(ctx, [[0.88, 0.46], [0.64, 0.44]]);

    // Specular highlight
    specularLine(ctx, [[0.50, 0.05], [0.36, 0.38]]);

    // Bridge windows
    drawWindowStrip(ctx, 0.50, 0.16, 0.10, 4, 0.012);

    // Turret hardpoints — port and starboard fore/aft
    drawTurret(ctx, 0.36, 0.32, 0.034, accentColour);
    drawTurret(ctx, 0.64, 0.32, 0.034, accentColour);
    drawTurret(ctx, 0.34, 0.56, 0.034, accentColour);
    drawTurret(ctx, 0.66, 0.56, 0.034, accentColour);

    // Greebles on sensor arms
    drawGreeble(ctx, 0.115, 0.44, 0.042, 0.016);
    drawGreeble(ctx, 0.843, 0.44, 0.042, 0.016);
    // Sensor dishes on arm tips
    drawSensorDish(ctx, 0.11, 0.50, 0.026, false);
    drawSensorDish(ctx, 0.89, 0.50, 0.026, false);

    // Midships greebles
    drawGreeble(ctx, 0.44, 0.46, 0.050, 0.020);
    drawGreeble(ctx, 0.51, 0.46, 0.050, 0.020);
  }

  // Bridge cockpit windows
  drawCockpit(ctx, 0.50, 0.12, 0.044);

  // Running lights
  runningLight(ctx, 0.72, 0.44, 0.012, 'green');
  runningLight(ctx, 0.28, 0.44, 0.012, 'red');

  // Three-engine array
  drawEngineGlow(ctx, 0.39, 0.75, 0.044);
  drawEngineGlow(ctx, 0.50, 0.76, 0.048);
  drawEngineGlow(ctx, 0.61, 0.75, 0.044);
}

// ── Carrier ───────────────────────────────────────────────────────────────────

/**
 * Carrier: broad flat flight deck.  Beam greatly exceeds fore-aft depth.  Port
 * and starboard hangar bay openings cut into the flanks.  The command tower is
 * offset slightly to starboard.  Fighter launch rails run fore-aft.  Four-engine
 * aft bank.  Largest footprint of all hull classes.
 */
function drawCarrier(
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
): void {
  // ── Flight deck — large blunt-nosed hexagonal slab ──
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);    // fore centreline
  ctx.lineTo(0.74, 0.10);    // fore starboard
  ctx.bezierCurveTo(0.90, 0.16, 0.93, 0.28, 0.91, 0.44);
  ctx.lineTo(0.88, 0.64);
  ctx.lineTo(0.72, 0.78);    // aft starboard
  ctx.lineTo(0.28, 0.78);    // aft port
  ctx.lineTo(0.12, 0.64);
  ctx.bezierCurveTo(0.07, 0.28, 0.10, 0.16, 0.26, 0.10);  // fore port
  ctx.closePath();
  hullFill(ctx, 0.07, 0.06, 0.86, 0.72);
  hullOutline(ctx, 0.021);

  // ── Command tower — offset to starboard ──
  ctx.beginPath();
  ctx.rect(0.54, 0.12, 0.14, 0.22);
  ctx.fillStyle = HULL_MID;
  ctx.fill();
  hullOutline(ctx, 0.013);

  // Tower top step
  ctx.beginPath();
  ctx.rect(0.57, 0.10, 0.08, 0.06);
  ctx.fillStyle = HULL_LIGHT;
  ctx.fill();
  hullOutline(ctx, 0.009);

  if (detailed) {
    // Accent bands along the fore deck edge
    accentPanel(ctx, [
      [0.26, 0.10], [0.74, 0.10],
      [0.74, 0.14], [0.26, 0.14],
    ], accentColour, 0.72);

    // Landing strip centreline (dashed appearance via segments)
    panelLine(ctx, [[0.50, 0.16], [0.50, 0.74]], 0.18, 0.006);

    // Deck cross-frames
    panelLine(ctx, [[0.11, 0.36], [0.89, 0.36]]);
    panelLine(ctx, [[0.11, 0.56], [0.89, 0.56]]);

    // Fighter launch rails — two parallel fore-aft lines
    panelLine(ctx, [[0.36, 0.12], [0.36, 0.72]], 0.22, 0.005);
    panelLine(ctx, [[0.46, 0.12], [0.46, 0.72]], 0.22, 0.005);

    // Port hangar bay opening
    ctx.beginPath();
    ctx.rect(0.08, 0.44, 0.060, 0.14);
    ctx.fillStyle = withAlpha('#000810', 0.90);
    ctx.fill();
    ctx.strokeStyle = shiftColour(accentColour, -0.15);
    ctx.lineWidth = 0.007;
    ctx.stroke();

    // Starboard hangar bay opening
    ctx.beginPath();
    ctx.rect(0.860, 0.44, 0.060, 0.14);
    ctx.fillStyle = withAlpha('#000810', 0.90);
    ctx.fill();
    ctx.strokeStyle = shiftColour(accentColour, -0.15);
    ctx.lineWidth = 0.007;
    ctx.stroke();

    // Hangar bay glow hints (dim amber — interior lighting)
    const portHangar = ctx.createRadialGradient(0.11, 0.51, 0, 0.11, 0.51, 0.04);
    portHangar.addColorStop(0,   'rgba(255,160,40,0.35)');
    portHangar.addColorStop(1,   'rgba(255,100,0,0)');
    ctx.beginPath();
    ctx.arc(0.11, 0.51, 0.04, 0, Math.PI * 2);
    ctx.fillStyle = portHangar;
    ctx.fill();

    const sbHangar = ctx.createRadialGradient(0.89, 0.51, 0, 0.89, 0.51, 0.04);
    sbHangar.addColorStop(0,   'rgba(255,160,40,0.35)');
    sbHangar.addColorStop(1,   'rgba(255,100,0,0)');
    ctx.beginPath();
    ctx.arc(0.89, 0.51, 0.04, 0, Math.PI * 2);
    ctx.fillStyle = sbHangar;
    ctx.fill();

    // Specular highlight across the fore edge
    specularLine(ctx, [[0.27, 0.11], [0.73, 0.11]]);

    // Tower windows
    drawWindowStrip(ctx, 0.61, 0.18, 0.07, 3, 0.012);

    // Greebles on flight deck
    drawGreeble(ctx, 0.20, 0.30, 0.06, 0.022);
    drawGreeble(ctx, 0.20, 0.58, 0.06, 0.022);
    drawGreeble(ctx, 0.74, 0.30, 0.06, 0.022);
    drawGreeble(ctx, 0.74, 0.58, 0.06, 0.022);

    // Sensor array atop tower
    drawSensorDish(ctx, 0.61, 0.10, 0.028, true);
  }

  // Command tower cockpit
  drawCockpit(ctx, 0.61, 0.14, 0.036);

  // Running lights — wide-beam placement
  runningLight(ctx, 0.90, 0.42, 0.013, 'green');
  runningLight(ctx, 0.10, 0.42, 0.013, 'red');

  // Four-engine bank spread across the aft
  drawEngineGlow(ctx, 0.30, 0.79, 0.044);
  drawEngineGlow(ctx, 0.42, 0.80, 0.046);
  drawEngineGlow(ctx, 0.58, 0.80, 0.046);
  drawEngineGlow(ctx, 0.70, 0.79, 0.044);
}

// ── Battleship ────────────────────────────────────────────────────────────────

/**
 * Battleship: the heaviest, most imposing hull class.  A thick armoured wedge
 * with layered hull plates, six turret positions, a massive five-engine aft
 * drive, and extensive greeble surface detail.  The silhouette is wider and
 * more angular than any other class, instantly projecting overwhelming firepower.
 */
function drawBattleship(
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
): void {
  // ── Outer armour belt — broadest layer ──
  ctx.beginPath();
  ctx.moveTo(0.50, 0.03);
  ctx.lineTo(0.62, 0.09);
  ctx.lineTo(0.78, 0.16);   // fore flare starboard
  ctx.bezierCurveTo(0.86, 0.24, 0.88, 0.34, 0.86, 0.44);
  ctx.lineTo(0.86, 0.58);
  ctx.lineTo(0.78, 0.72);
  ctx.lineTo(0.62, 0.80);
  ctx.lineTo(0.38, 0.80);
  ctx.lineTo(0.22, 0.72);
  ctx.lineTo(0.14, 0.58);
  ctx.lineTo(0.14, 0.44);
  ctx.bezierCurveTo(0.12, 0.34, 0.14, 0.24, 0.22, 0.16);  // fore flare port
  ctx.lineTo(0.38, 0.09);
  ctx.closePath();
  hullFill(ctx, 0.12, 0.03, 0.76, 0.77);
  hullOutline(ctx, 0.024);

  // ── Inner armour citadel — raised central box ──
  ctx.beginPath();
  ctx.moveTo(0.50, 0.09);
  ctx.lineTo(0.60, 0.14);
  ctx.lineTo(0.66, 0.30);
  ctx.lineTo(0.66, 0.62);
  ctx.lineTo(0.58, 0.72);
  ctx.lineTo(0.42, 0.72);
  ctx.lineTo(0.34, 0.62);
  ctx.lineTo(0.34, 0.30);
  ctx.lineTo(0.40, 0.14);
  ctx.closePath();
  ctx.fillStyle = HULL_MID;
  ctx.fill();
  hullOutline(ctx, 0.016);

  // ── Bridge section — raised superstructure ──
  ctx.beginPath();
  ctx.rect(0.42, 0.09, 0.16, 0.16);
  ctx.fillStyle = HULL_LIGHT;
  ctx.fill();
  hullOutline(ctx, 0.012);

  if (detailed) {
    // Accent panels — armoured cheek plates fore
    accentPanel(ctx, [
      [0.50, 0.04], [0.62, 0.10], [0.60, 0.17], [0.50, 0.11],
    ], accentColour, 0.75);
    accentPanel(ctx, [
      [0.50, 0.04], [0.38, 0.10], [0.40, 0.17], [0.50, 0.11],
    ], accentColour, 0.75);

    // Accent stripe — mid-beam belt
    accentPanel(ctx, [
      [0.14, 0.48], [0.86, 0.48],
      [0.86, 0.52], [0.14, 0.52],
    ], accentColour, 0.55);

    // Outer hull seams
    panelLine(ctx, [[0.50, 0.10], [0.50, 0.76]]);             // main spine
    panelLine(ctx, [[0.16, 0.32], [0.84, 0.32]]);             // fore cross-frame
    panelLine(ctx, [[0.16, 0.58], [0.84, 0.58]]);             // aft cross-frame
    panelLine(ctx, [[0.38, 0.10], [0.26, 0.38]]);             // fore port armour crease
    panelLine(ctx, [[0.62, 0.10], [0.74, 0.38]]);             // fore starboard armour crease
    panelLine(ctx, [[0.24, 0.38], [0.20, 0.64]]);             // mid port armour crease
    panelLine(ctx, [[0.76, 0.38], [0.80, 0.64]]);             // mid starboard armour crease

    // Specular highlights along both fore leading edges
    specularLine(ctx, [[0.50, 0.04], [0.78, 0.17]]);
    specularLine(ctx, [[0.50, 0.04], [0.22, 0.17]]);

    // Bridge windows
    drawWindowStrip(ctx, 0.50, 0.14, 0.11, 5, 0.011);

    // Six turret hardpoints — fore pair, mid pair, aft pair
    drawTurret(ctx, 0.34, 0.22, 0.038, accentColour);
    drawTurret(ctx, 0.66, 0.22, 0.038, accentColour);
    drawTurret(ctx, 0.22, 0.46, 0.038, accentColour);
    drawTurret(ctx, 0.78, 0.46, 0.038, accentColour);
    drawTurret(ctx, 0.30, 0.64, 0.038, accentColour);
    drawTurret(ctx, 0.70, 0.64, 0.038, accentColour);

    // Greebles — scattered across the broad hull
    drawGreeble(ctx, 0.16, 0.34, 0.060, 0.022);
    drawGreeble(ctx, 0.78, 0.34, 0.060, 0.022);
    drawGreeble(ctx, 0.16, 0.60, 0.060, 0.022);
    drawGreeble(ctx, 0.78, 0.60, 0.060, 0.022);
    drawGreeble(ctx, 0.43, 0.38, 0.055, 0.018);
    drawGreeble(ctx, 0.51, 0.38, 0.055, 0.018);
    drawGreeble(ctx, 0.43, 0.54, 0.055, 0.018);
    drawGreeble(ctx, 0.51, 0.54, 0.055, 0.018);

    // Sensor dish atop bridge
    drawSensorDish(ctx, 0.50, 0.09, 0.030, true);
  }

  // Bridge cockpit / command windows
  drawCockpit(ctx, 0.50, 0.11, 0.048);

  // Running lights
  runningLight(ctx, 0.84, 0.44, 0.013, 'green');
  runningLight(ctx, 0.16, 0.44, 0.013, 'red');

  // Five-engine bank — graduated sizes, brightest at centre
  drawEngineGlow(ctx, 0.28, 0.81, 0.042);
  drawEngineGlow(ctx, 0.38, 0.83, 0.048);
  drawEngineGlow(ctx, 0.50, 0.85, 0.054);
  drawEngineGlow(ctx, 0.62, 0.83, 0.048);
  drawEngineGlow(ctx, 0.72, 0.81, 0.042);
}

// ── Coloniser ─────────────────────────────────────────────────────────────────

/**
 * Coloniser (Colony Ship): a large oval/egg-shaped civilian vessel built to
 * transport an entire founding population to a new world.  The silhouette is
 * intentionally soft and rounded — the antithesis of angular warship design.
 *
 * - Large bulbous habitat/cargo section dominates the mid-section.
 * - Dome-like forward observation/bridge section at the fore.
 * - Compact engine bell at the aft.
 * - Colour: warm amber/gold accent panels rather than military blue, signalling
 *   its non-combat purpose at a glance.
 */
function drawColoniser(
  ctx: CanvasRenderingContext2D,
  accentColour: string,
  detailed: boolean,
): void {
  // Use a warm amber gold as the accent override for colony ships so they
  // stand out from warships regardless of empire colour.
  const colonyAccent = '#d4a030';

  // ── Main habitat hull — tall oval egg shape ──
  ctx.beginPath();
  ctx.ellipse(0.50, 0.48, 0.28, 0.38, 0, 0, Math.PI * 2);
  // Gradient fill: warm amber tint on the hull base
  const grad = ctx.createLinearGradient(0.22, 0.10, 0.78, 0.86);
  grad.addColorStop(0,   '#5a5040');
  grad.addColorStop(0.4, '#4a4438');
  grad.addColorStop(1,   '#2e2a22');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.70)';
  ctx.lineWidth = 0.020;
  ctx.stroke();

  // ── Dome observation section — forward hemisphere ──
  ctx.beginPath();
  ctx.ellipse(0.50, 0.15, 0.18, 0.14, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  const domeGrad = ctx.createRadialGradient(0.44, 0.10, 0.02, 0.50, 0.15, 0.18);
  domeGrad.addColorStop(0,   'rgba(255,240,180,0.85)');
  domeGrad.addColorStop(0.5, 'rgba(200,160,60,0.65)');
  domeGrad.addColorStop(1,   'rgba(100,80,20,0.25)');
  ctx.fillStyle = domeGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.60)';
  ctx.lineWidth = 0.015;
  ctx.stroke();

  // ── Aft engine section — small flared nozzle housing ──
  ctx.beginPath();
  ctx.moveTo(0.38, 0.78);
  ctx.lineTo(0.34, 0.84);
  ctx.bezierCurveTo(0.36, 0.90, 0.64, 0.90, 0.66, 0.84);
  ctx.lineTo(0.62, 0.78);
  ctx.closePath();
  ctx.fillStyle = '#302c26';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 0.014;
  ctx.stroke();

  if (detailed) {
    // Horizontal banding stripes — warm gold accent belts
    accentPanel(ctx, [
      [0.23, 0.38], [0.77, 0.38],
      [0.77, 0.43], [0.23, 0.43],
    ], colonyAccent, 0.70);

    accentPanel(ctx, [
      [0.24, 0.56], [0.76, 0.56],
      [0.76, 0.60], [0.24, 0.60],
    ], colonyAccent, 0.60);

    // Dome rim accent ring
    accentPanel(ctx, [
      [0.33, 0.14], [0.67, 0.14],
      [0.68, 0.17], [0.32, 0.17],
    ], colonyAccent, 0.80);

    // Hull seam lines — horizontal bands across the oval
    panelLine(ctx, [[0.24, 0.28], [0.76, 0.28]]);
    panelLine(ctx, [[0.22, 0.48], [0.78, 0.48]]);
    panelLine(ctx, [[0.23, 0.68], [0.77, 0.68]]);

    // Vertical spine
    panelLine(ctx, [[0.50, 0.18], [0.50, 0.76]]);

    // Port/starboard panel divisions
    panelLine(ctx, [[0.36, 0.20], [0.30, 0.62]]);
    panelLine(ctx, [[0.64, 0.20], [0.70, 0.62]]);

    // Specular highlight along the dome top
    specularLine(ctx, [[0.36, 0.08], [0.64, 0.08]]);
    // Specular across the widest section
    specularLine(ctx, [[0.22, 0.44], [0.78, 0.44]], 0.28);

    // Porthole windows — two rows of three
    drawWindowStrip(ctx, 0.50, 0.32, 0.22, 3, 0.016);
    drawWindowStrip(ctx, 0.50, 0.52, 0.22, 3, 0.016);

    // Sensor dish on dome crown
    drawSensorDish(ctx, 0.50, 0.07, 0.030, true);

    // Greeble details — docking clamps and utility modules
    drawGreeble(ctx, 0.23, 0.43, 0.040, 0.016);
    drawGreeble(ctx, 0.73, 0.43, 0.040, 0.016);
    drawGreeble(ctx, 0.23, 0.61, 0.036, 0.014);
    drawGreeble(ctx, 0.73, 0.61, 0.036, 0.014);
  }

  // Dome cockpit — warm glowing interior light
  const cockpitGrad = ctx.createRadialGradient(0.46, 0.11, 0, 0.50, 0.15, 0.072);
  cockpitGrad.addColorStop(0,   'rgba(255,240,160,1.0)');
  cockpitGrad.addColorStop(0.4, 'rgba(220,180,60,0.80)');
  cockpitGrad.addColorStop(1,   'rgba(120,80,10,0.10)');
  ctx.beginPath();
  ctx.arc(0.50, 0.15, 0.072, 0, Math.PI * 2);
  ctx.fillStyle = cockpitGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,100,0.55)';
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Running lights — amber/gold instead of the standard red/green
  runningLight(ctx, 0.77, 0.46, 0.011, 'green');
  runningLight(ctx, 0.23, 0.46, 0.011, 'red');

  // Single wide engine glow — colony ships have a single efficient drive
  drawEngineGlow(ctx, 0.50, 0.87, 0.052);
}

// ── Dispatch table ─────────────────────────────────────────────────────────────

const HULL_DRAW_FNS: Record<HullClass, DrawFn> = {
  scout:            drawScout,
  destroyer:        drawDestroyer,
  transport:        drawTransport,
  cruiser:          drawCruiser,
  carrier:          drawCarrier,
  battleship:       drawBattleship,
  coloniser:        drawColoniser,
  dreadnought:      drawBattleship,    // reuse battleship silhouette for now
  battle_station:   drawCarrier,       // reuse carrier silhouette for now
  deep_space_probe: drawScout,         // reuse scout silhouette for now
};

// ── Core render function ───────────────────────────────────────────────────────

/**
 * Render a ship silhouette to an offscreen canvas and return it as a PNG data URL.
 *
 * All draw functions operate in a normalised 1×1 unit square.  A small margin
 * is reserved so stroke outlines and engine blooms never clip the canvas edge.
 */
function renderToDataUrl(
  hullClass: HullClass,
  size: number,
  accentColour: string,
  thumbnail: boolean,
  speciesId?: string,
): string {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, size, size);

  // Reserve a margin so outlines and bloom effects do not clip the canvas edge
  const margin = thumbnail ? size * 0.04 : size * 0.07;
  const drawSize = size - margin * 2;

  ctx.save();
  ctx.translate(margin, margin);
  ctx.scale(drawSize, drawSize);

  // Check for a race-specific design family override
  const family = getDesignFamily(speciesId);
  const familyDraw = getFamilyDrawFn(hullClass, family);
  if (familyDraw) {
    familyDraw(ctx, accentColour);
  } else {
    HULL_DRAW_FNS[hullClass](ctx, accentColour, !thumbnail);
  }

  ctx.restore();

  return canvas.toDataURL('image/png');
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Default player accent colour — muted naval blue.
 * Base hull is always rendered in the standard grey palette; only accent panels
 * and certain highlights are tinted by this colour.
 */
const DEFAULT_COLOUR = '#4488cc';

/**
 * Render a full-detail top-down ship icon.
 *
 * The image is drawn at `size × size` pixels and returned as a PNG data URL
 * suitable for use as an `<img>` `src` or CSS `background-image`.
 * Results are cached by hull class, size, and accent colour so repeated calls
 * at the same arguments are essentially free.
 *
 * @param hullClass    Hull class identifier (scout | destroyer | transport | cruiser | carrier | battleship).
 * @param size         Width / height of the output image in pixels.  64–128 px is the recommended range.
 * @param color        Optional hex accent colour for panel highlights.  Defaults to `'#4488cc'`.
 * @param speciesId    Optional species identifier for race-specific ship graphics.
 * @returns            PNG data URL string, or an empty string if canvas is unavailable.
 */
export function renderShipIcon(
  hullClass: HullClass,
  size: number,
  color: string = DEFAULT_COLOUR,
  speciesId?: string,
): string {
  const key = cacheKey(hullClass, size, color, false, speciesId);
  const cached = renderCache.get(key);
  if (cached !== undefined) return cached;

  const result = renderToDataUrl(hullClass, size, color, false, speciesId);
  renderCache.set(key, result);
  return result;
}

/**
 * Render a simplified ship thumbnail suitable for dense fleet lists.
 *
 * Omits panel seam lines, turrets, greebles, and other fine detail that
 * becomes illegible at small sizes.  Always uses the default accent colour.
 * Recommended output size is 24–32 px; the silhouette remains recognisable
 * down to approximately 16 px.
 *
 * @param hullClass  Hull class identifier.
 * @param size       Width / height in pixels.
 * @param speciesId  Optional species identifier for race-specific ship graphics.
 * @returns          PNG data URL string, or an empty string if canvas is unavailable.
 */
export function renderShipThumbnail(
  hullClass: HullClass,
  size: number,
  speciesId?: string,
): string {
  const key = cacheKey(hullClass, size, DEFAULT_COLOUR, true, speciesId);
  const cached = renderCache.get(key);
  if (cached !== undefined) return cached;

  const result = renderToDataUrl(hullClass, size, DEFAULT_COLOUR, true, speciesId);
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
