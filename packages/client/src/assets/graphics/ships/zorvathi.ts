import { withAlpha } from '../shipWireframeHelpers';

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

export function zorvathiScout(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function zorvathiDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function zorvathiTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function zorvathiCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function zorvathiCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function zorvathiBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function zorvathiColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
