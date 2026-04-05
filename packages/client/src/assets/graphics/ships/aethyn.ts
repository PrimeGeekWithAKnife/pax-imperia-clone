import { withAlpha } from '../shipWireframeHelpers';

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
export function aethynScout(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function aethynDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function aethynTransport(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function aethynCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function aethynCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function aethynBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
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
export function aethynColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
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
