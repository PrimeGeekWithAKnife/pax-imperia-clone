import { withAlpha } from '../shipWireframeHelpers';

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

export function thyriaqScout(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function thyriaqDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function thyriaqTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function thyriaqCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function thyriaqCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function thyriaqBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function thyriaqColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
