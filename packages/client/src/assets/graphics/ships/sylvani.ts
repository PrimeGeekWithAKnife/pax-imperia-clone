import { withAlpha } from '../shipWireframeHelpers';

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

export function sylvaniScout(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function sylvaniDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function sylvaniTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function sylvaniCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function sylvaniCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function sylvaniBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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

export function sylvaniColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
