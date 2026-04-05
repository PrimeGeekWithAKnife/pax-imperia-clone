import { withAlpha } from '../shipWireframeHelpers';

function luminariNode(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, accent: string,
): void {
  // Outer bloom
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  bloom.addColorStop(0,   withAlpha(accent, 0.5));
  bloom.addColorStop(0.4, withAlpha(accent, 0.2));
  bloom.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Bright core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,248,230,1)');
  core.addColorStop(0.5, withAlpha(accent, 0.85));
  core.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Draw a containment ring — an arc or full ellipse with glowing stroke. */
function luminariRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number, accent: string,
  startAngle = 0, endAngle = Math.PI * 2,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle);
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Inner glow line
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, startAngle, endAngle);
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.012;
  ctx.stroke();
}

/** Draw a lattice rod — a thin stroked line with faint glow. */
function luminariRod(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number, accent: string,
  alpha = 0.45,
): void {
  // Glow pass (wider, lower alpha)
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = withAlpha(accent, alpha * 0.4);
  ctx.lineWidth = 0.008;
  ctx.stroke();
  // Core pass (thin, brighter)
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = withAlpha(accent, alpha);
  ctx.lineWidth = 0.003;
  ctx.stroke();
}

/** Draw an antenna spar — a thinner rod with a tiny node at the tip. */
function luminariAntenna(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number, accent: string,
): void {
  luminariRod(ctx, x1, y1, x2, y2, accent, 0.3);
  luminariNode(ctx, x2, y2, 0.012, accent);
}

// ── Hull class wireframes ───────────────────────────────────────────────────

export function luminariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Minimal containment lattice: four rods converging to bow node, core sphere.
  // The smallest possible cage — barely enough to hold a Luminari in vacuum.

  // Longitudinal rods (two pairs, converging at bow)
  luminariRod(ctx, 0.38, 0.80, 0.50, 0.14, accent);
  luminariRod(ctx, 0.62, 0.80, 0.50, 0.14, accent);
  luminariRod(ctx, 0.42, 0.78, 0.50, 0.14, accent, 0.25);
  luminariRod(ctx, 0.58, 0.78, 0.50, 0.14, accent, 0.25);

  // Single transverse brace
  luminariRod(ctx, 0.38, 0.55, 0.62, 0.55, accent, 0.35);

  // Aft crossbar
  luminariRod(ctx, 0.38, 0.78, 0.62, 0.78, accent, 0.3);

  // Core energy node (the Luminari)
  luminariNode(ctx, 0.50, 0.48, 0.032, accent);

  // Bow focus node
  luminariNode(ctx, 0.50, 0.14, 0.018, accent);

  // Aft resonance glow (engine equivalent)
  luminariNode(ctx, 0.50, 0.82, 0.022, accent);
}

export function luminariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Elongated cage with single containment ring. More rods than the scout,
  // giving a denser lattice feel. Antenna spars begin to appear.

  // Primary longitudinal rods
  luminariRod(ctx, 0.36, 0.84, 0.42, 0.12, accent);
  luminariRod(ctx, 0.64, 0.84, 0.58, 0.12, accent);
  // Inner longitudinal pair
  luminariRod(ctx, 0.44, 0.82, 0.48, 0.14, accent, 0.3);
  luminariRod(ctx, 0.56, 0.82, 0.52, 0.14, accent, 0.3);

  // Transverse braces
  luminariRod(ctx, 0.36, 0.36, 0.64, 0.36, accent, 0.35);
  luminariRod(ctx, 0.35, 0.60, 0.65, 0.60, accent, 0.35);
  luminariRod(ctx, 0.37, 0.80, 0.63, 0.80, accent, 0.3);

  // Containment ring
  luminariRing(ctx, 0.50, 0.42, 0.17, 0.06, accent);

  // Antenna spars — short whiskers
  luminariAntenna(ctx, 0.36, 0.40, 0.22, 0.30, accent);
  luminariAntenna(ctx, 0.64, 0.40, 0.78, 0.30, accent);

  // Core node
  luminariNode(ctx, 0.50, 0.46, 0.030, accent);

  // Bow node
  luminariNode(ctx, 0.50, 0.12, 0.016, accent);

  // Side junction nodes
  luminariNode(ctx, 0.36, 0.60, 0.012, accent);
  luminariNode(ctx, 0.64, 0.60, 0.012, accent);

  // Aft glow
  luminariNode(ctx, 0.44, 0.84, 0.018, accent);
  luminariNode(ctx, 0.56, 0.84, 0.018, accent);
}

export function luminariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wider lattice with a large central containment ring — the ring is the
  // "cargo hold", a magnetic bottle that can carry other energy patterns
  // or field-suspended material. Broader and rounder than combat vessels.

  // Wide outer cage rods
  luminariRod(ctx, 0.28, 0.78, 0.40, 0.16, accent);
  luminariRod(ctx, 0.72, 0.78, 0.60, 0.16, accent);
  // Inner structural rods
  luminariRod(ctx, 0.40, 0.80, 0.46, 0.18, accent, 0.3);
  luminariRod(ctx, 0.60, 0.80, 0.54, 0.18, accent, 0.3);

  // Transverse braces
  luminariRod(ctx, 0.28, 0.35, 0.72, 0.35, accent, 0.3);
  luminariRod(ctx, 0.26, 0.55, 0.74, 0.55, accent, 0.3);
  luminariRod(ctx, 0.30, 0.75, 0.70, 0.75, accent, 0.3);

  // Large containment ring — the cargo bottle
  luminariRing(ctx, 0.50, 0.48, 0.24, 0.10, accent);
  // Inner ring glow
  luminariRing(ctx, 0.50, 0.48, 0.14, 0.06, accent);

  // Core node (larger — more energy to hold the cargo field)
  luminariNode(ctx, 0.50, 0.48, 0.035, accent);

  // Junction nodes at brace intersections
  luminariNode(ctx, 0.28, 0.55, 0.010, accent);
  luminariNode(ctx, 0.72, 0.55, 0.010, accent);
  luminariNode(ctx, 0.34, 0.35, 0.010, accent);
  luminariNode(ctx, 0.66, 0.35, 0.010, accent);

  // Bow node
  luminariNode(ctx, 0.50, 0.16, 0.015, accent);

  // Aft glow (wider spread — twin engines)
  luminariNode(ctx, 0.40, 0.82, 0.020, accent);
  luminariNode(ctx, 0.60, 0.82, 0.020, accent);
}

export function luminariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Two containment rings — the iconic magnetic bottle silhouette.
  // Longer and more angular than the transport. Multiple antenna spars
  // give it an aggressive sensor profile despite the Luminari's peaceful
  // nature — they observe, they listen, they intercept.

  // Primary lattice rods — six for density
  luminariRod(ctx, 0.34, 0.86, 0.44, 0.10, accent);
  luminariRod(ctx, 0.66, 0.86, 0.56, 0.10, accent);
  luminariRod(ctx, 0.38, 0.84, 0.47, 0.12, accent, 0.3);
  luminariRod(ctx, 0.62, 0.84, 0.53, 0.12, accent, 0.3);
  // Central spine
  luminariRod(ctx, 0.50, 0.10, 0.50, 0.86, accent, 0.2);

  // Transverse braces
  luminariRod(ctx, 0.32, 0.30, 0.68, 0.30, accent, 0.3);
  luminariRod(ctx, 0.30, 0.50, 0.70, 0.50, accent, 0.35);
  luminariRod(ctx, 0.32, 0.68, 0.68, 0.68, accent, 0.3);
  luminariRod(ctx, 0.36, 0.82, 0.64, 0.82, accent, 0.25);

  // Forward containment ring
  luminariRing(ctx, 0.50, 0.34, 0.20, 0.07, accent);
  // Aft containment ring (slightly larger)
  luminariRing(ctx, 0.50, 0.62, 0.22, 0.08, accent);

  // Antenna spars — four whiskers, longer than destroyer
  luminariAntenna(ctx, 0.34, 0.34, 0.16, 0.20, accent);
  luminariAntenna(ctx, 0.66, 0.34, 0.84, 0.20, accent);
  luminariAntenna(ctx, 0.32, 0.62, 0.14, 0.56, accent);
  luminariAntenna(ctx, 0.68, 0.62, 0.86, 0.56, accent);

  // Core node
  luminariNode(ctx, 0.50, 0.46, 0.034, accent);

  // Bow focus node
  luminariNode(ctx, 0.50, 0.10, 0.018, accent);

  // Ring junction nodes
  luminariNode(ctx, 0.34, 0.34, 0.010, accent);
  luminariNode(ctx, 0.66, 0.34, 0.010, accent);
  luminariNode(ctx, 0.32, 0.62, 0.010, accent);
  luminariNode(ctx, 0.68, 0.62, 0.010, accent);

  // Aft triple glow
  luminariNode(ctx, 0.42, 0.86, 0.020, accent);
  luminariNode(ctx, 0.50, 0.88, 0.016, accent);
  luminariNode(ctx, 0.58, 0.86, 0.020, accent);
}

export function luminariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Wide lattice platform with three containment rings — one central and
  // two flanking. The flanking rings are "launch bays" where smaller
  // Luminari field-forms (fighters) are held before deployment. The widest
  // silhouette of any Luminari hull.

  // Outer cage — broad trapezoid
  luminariRod(ctx, 0.20, 0.76, 0.38, 0.12, accent);
  luminariRod(ctx, 0.80, 0.76, 0.62, 0.12, accent);
  // Inner cage rods
  luminariRod(ctx, 0.36, 0.80, 0.44, 0.14, accent, 0.25);
  luminariRod(ctx, 0.64, 0.80, 0.56, 0.14, accent, 0.25);

  // Transverse braces — broad
  luminariRod(ctx, 0.18, 0.30, 0.82, 0.30, accent, 0.3);
  luminariRod(ctx, 0.16, 0.50, 0.84, 0.50, accent, 0.35);
  luminariRod(ctx, 0.18, 0.68, 0.82, 0.68, accent, 0.3);
  luminariRod(ctx, 0.24, 0.78, 0.76, 0.78, accent, 0.25);

  // Cross-braces (diagonal lattice)
  luminariRod(ctx, 0.30, 0.30, 0.20, 0.50, accent, 0.2);
  luminariRod(ctx, 0.70, 0.30, 0.80, 0.50, accent, 0.2);

  // Central containment ring
  luminariRing(ctx, 0.50, 0.44, 0.16, 0.07, accent);

  // Flanking launch bay rings
  luminariRing(ctx, 0.28, 0.50, 0.10, 0.06, accent);
  luminariRing(ctx, 0.72, 0.50, 0.10, 0.06, accent);

  // Antenna spars — wide sweep
  luminariAntenna(ctx, 0.18, 0.30, 0.06, 0.18, accent);
  luminariAntenna(ctx, 0.82, 0.30, 0.94, 0.18, accent);
  // Dorsal spar
  luminariAntenna(ctx, 0.50, 0.30, 0.50, 0.06, accent);

  // Core node
  luminariNode(ctx, 0.50, 0.44, 0.032, accent);

  // Launch bay nodes
  luminariNode(ctx, 0.28, 0.50, 0.020, accent);
  luminariNode(ctx, 0.72, 0.50, 0.020, accent);

  // Junction nodes along braces
  luminariNode(ctx, 0.18, 0.50, 0.008, accent);
  luminariNode(ctx, 0.82, 0.50, 0.008, accent);
  luminariNode(ctx, 0.38, 0.30, 0.008, accent);
  luminariNode(ctx, 0.62, 0.30, 0.008, accent);

  // Bow node
  luminariNode(ctx, 0.50, 0.12, 0.016, accent);

  // Aft glow — spread wide
  luminariNode(ctx, 0.34, 0.82, 0.018, accent);
  luminariNode(ctx, 0.50, 0.84, 0.014, accent);
  luminariNode(ctx, 0.66, 0.82, 0.018, accent);
}

export function luminariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // The largest combat lattice — three stacked containment rings, a dense
  // web of rods and braces, a corona of energy nodes around the core, and
  // the signature tilted ring (the asymmetric flourish). This ship looks
  // like a captured piece of the Cygnus Radiant held in a cage of light.

  // Dense longitudinal lattice — eight rods
  luminariRod(ctx, 0.30, 0.90, 0.42, 0.06, accent);
  luminariRod(ctx, 0.70, 0.90, 0.58, 0.06, accent);
  luminariRod(ctx, 0.34, 0.88, 0.44, 0.08, accent, 0.3);
  luminariRod(ctx, 0.66, 0.88, 0.56, 0.08, accent, 0.3);
  luminariRod(ctx, 0.38, 0.88, 0.46, 0.10, accent, 0.2);
  luminariRod(ctx, 0.62, 0.88, 0.54, 0.10, accent, 0.2);
  // Central spine and dorsal line
  luminariRod(ctx, 0.50, 0.06, 0.50, 0.90, accent, 0.18);
  luminariRod(ctx, 0.48, 0.08, 0.48, 0.88, accent, 0.12);

  // Transverse braces — five layers
  luminariRod(ctx, 0.26, 0.22, 0.74, 0.22, accent, 0.3);
  luminariRod(ctx, 0.24, 0.38, 0.76, 0.38, accent, 0.35);
  luminariRod(ctx, 0.24, 0.54, 0.76, 0.54, accent, 0.35);
  luminariRod(ctx, 0.26, 0.70, 0.74, 0.70, accent, 0.3);
  luminariRod(ctx, 0.30, 0.86, 0.70, 0.86, accent, 0.25);

  // Diagonal cross-braces (the lattice thickens)
  luminariRod(ctx, 0.32, 0.22, 0.24, 0.38, accent, 0.18);
  luminariRod(ctx, 0.68, 0.22, 0.76, 0.38, accent, 0.18);
  luminariRod(ctx, 0.24, 0.54, 0.30, 0.70, accent, 0.18);
  luminariRod(ctx, 0.76, 0.54, 0.70, 0.70, accent, 0.18);

  // Forward containment ring
  luminariRing(ctx, 0.50, 0.26, 0.22, 0.07, accent);
  // Mid containment ring (largest)
  luminariRing(ctx, 0.50, 0.48, 0.26, 0.09, accent);
  // Aft containment ring
  luminariRing(ctx, 0.50, 0.72, 0.24, 0.08, accent);

  // Tilted asymmetric ring — the scatterbrained genius flourish
  ctx.save();
  ctx.translate(0.50, 0.36);
  ctx.rotate(0.35);  // ~20 degrees — jaunty, not sloppy
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.15, 0.05, 0, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  ctx.restore();

  // Antenna spars — full array, six whiskers
  luminariAntenna(ctx, 0.28, 0.26, 0.10, 0.14, accent);
  luminariAntenna(ctx, 0.72, 0.26, 0.90, 0.14, accent);
  luminariAntenna(ctx, 0.24, 0.48, 0.06, 0.42, accent);
  luminariAntenna(ctx, 0.76, 0.48, 0.94, 0.42, accent);
  luminariAntenna(ctx, 0.26, 0.70, 0.12, 0.68, accent);
  luminariAntenna(ctx, 0.74, 0.70, 0.88, 0.68, accent);

  // Core node — large, brilliant
  luminariNode(ctx, 0.50, 0.46, 0.040, accent);

  // Corona nodes around the core
  const coronaNodes: [number, number][] = [
    [0.40, 0.40], [0.60, 0.40], [0.38, 0.52], [0.62, 0.52],
    [0.44, 0.36], [0.56, 0.36],
  ];
  for (const [nx, ny] of coronaNodes) {
    luminariNode(ctx, nx, ny, 0.010, accent);
  }

  // Ring junction nodes
  luminariNode(ctx, 0.28, 0.26, 0.010, accent);
  luminariNode(ctx, 0.72, 0.26, 0.010, accent);
  luminariNode(ctx, 0.24, 0.48, 0.010, accent);
  luminariNode(ctx, 0.76, 0.48, 0.010, accent);

  // Bow focus node
  luminariNode(ctx, 0.50, 0.06, 0.020, accent);

  // Aft glow — four exhaust nodes
  luminariNode(ctx, 0.38, 0.90, 0.022, accent);
  luminariNode(ctx, 0.50, 0.92, 0.018, accent);
  luminariNode(ctx, 0.62, 0.90, 0.022, accent);
  luminariNode(ctx, 0.44, 0.88, 0.014, accent);
}

export function luminariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // A spherical containment lattice — fundamentally different silhouette from
  // all other Luminari hulls. The coloniser must carry the field-pattern of
  // a Luminari across interstellar distances, maintaining it for years. The
  // design is a geodesic cage: six great-circle arcs forming a sphere, with
  // a brilliant core and habitat ring. It looks like a Dyson cage in miniature.

  // Geodesic cage arcs — three great circles at different orientations
  // Equatorial ring
  luminariRing(ctx, 0.50, 0.48, 0.30, 0.30, accent);
  // Meridian ring (vertical)
  luminariRing(ctx, 0.50, 0.48, 0.08, 0.30, accent);
  // Tilted meridian
  luminariRing(ctx, 0.50, 0.48, 0.22, 0.28, accent);

  // Lattice rods connecting ring intersections
  luminariRod(ctx, 0.50, 0.18, 0.50, 0.78, accent, 0.25);
  luminariRod(ctx, 0.20, 0.48, 0.80, 0.48, accent, 0.25);
  // Diagonal rods
  luminariRod(ctx, 0.28, 0.24, 0.72, 0.72, accent, 0.18);
  luminariRod(ctx, 0.72, 0.24, 0.28, 0.72, accent, 0.18);

  // Habitat containment ring — smaller, centred, glowing more intensely
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.15, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.008;
  ctx.stroke();
  // Inner glow of habitat ring
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.13, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.015;
  ctx.stroke();

  // Core node — the brightest, carrying the colonist field-pattern
  luminariNode(ctx, 0.50, 0.48, 0.042, accent);

  // Cage intersection nodes (where great circles cross)
  const intersections: [number, number][] = [
    [0.50, 0.18], [0.50, 0.78],  // poles
    [0.20, 0.48], [0.80, 0.48],  // equatorial extremes
    [0.30, 0.28], [0.70, 0.28],  // upper hemisphere
    [0.30, 0.68], [0.70, 0.68],  // lower hemisphere
  ];
  for (const [nx, ny] of intersections) {
    luminariNode(ctx, nx, ny, 0.012, accent);
  }

  // Aft propulsion glow — broader, gentle
  luminariNode(ctx, 0.50, 0.82, 0.025, accent);
  luminariNode(ctx, 0.40, 0.78, 0.014, accent);
  luminariNode(ctx, 0.60, 0.78, 0.014, accent);
}
