import { withAlpha } from '../shipWireframeHelpers';

const HALF_PI = Math.PI / 2;

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
export function vaeloriScout(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function vaeloriDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function vaeloriTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function vaeloriCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function vaeloriCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function vaeloriBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function vaeloriColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
