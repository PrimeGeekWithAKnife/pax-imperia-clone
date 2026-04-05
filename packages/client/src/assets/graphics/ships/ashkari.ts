import { withAlpha } from '../shipWireframeHelpers';

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

export function ashkariScout(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function ashkariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function ashkariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function ashkariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function ashkariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function ashkariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function ashkariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
