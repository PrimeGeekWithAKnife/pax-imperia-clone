import { withAlpha } from '../shipWireframeHelpers';

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
export function nexariScout(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function nexariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function nexariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function nexariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function nexariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function nexariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function nexariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
