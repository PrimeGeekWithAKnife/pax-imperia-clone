import { withAlpha } from '../shipWireframeHelpers';

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

export function kaelenthScout(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function kaelenthDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function kaelenthTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function kaelenthCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function kaelenthCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function kaelenthBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function kaelenthColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
