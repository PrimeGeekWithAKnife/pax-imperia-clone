import { withAlpha } from '../shipWireframeHelpers';

function vetharaHostFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.1, 0.7, 0.9);
  grad.addColorStop(0,   '#b0a494');  // Warm bone-white
  grad.addColorStop(0.4, '#9a8e80');  // Mid grey-brown
  grad.addColorStop(1,   '#7a7068');  // Darker cartilage shadow
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.006;
  ctx.stroke();
}

/** Filament bead — small red-glowing dot */
function vetharaFilamentBead(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  accent: string,
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0,   withAlpha(accent, 0.9));
  grad.addColorStop(0.6, withAlpha(accent, 0.5));
  grad.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/** Organ pod — a larger glowing bulge */
function vetharaOrganPod(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  accent: string,
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0,   withAlpha(accent, 0.6));
  grad.addColorStop(0.5, withAlpha(accent, 0.3));
  grad.addColorStop(1,   withAlpha(accent, 0.05));
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/** Metabolic engine glow — red-orange biological pulse */
function vetharaEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom — deep red
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  bloom.addColorStop(0,   'rgba(220,60,40,0.6)');
  bloom.addColorStop(0.5, 'rgba(160,30,20,0.25)');
  bloom.addColorStop(1,   'rgba(100,15,10,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — bright orange-white
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,200,170,1)');
  core.addColorStop(0.4, 'rgba(230,80,50,0.85)');
  core.addColorStop(1,   'rgba(160,30,15,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Draw a spiral of filament beads around a hull path */
function vetharaFilamentSpiral(
  ctx: CanvasRenderingContext2D,
  centreX: number,
  topY: number, bottomY: number,
  hullHalfWidth: number,
  beadCount: number,
  accent: string,
): void {
  for (let i = 0; i < beadCount; i++) {
    const t = i / beadCount;
    const angle = t * Math.PI * 3;  // 1.5 full wraps
    const y = topY + t * (bottomY - topY);
    // Oscillate left-right to create spiral illusion in 2D
    const xOff = Math.sin(angle) * hullHalfWidth * 0.95;
    vetharaFilamentBead(ctx, centreX + xOff, y, 0.012, accent);
  }
}

/** Tendril line — a curved filament arm */
function vetharaTendril(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  cpx1: number, cpy1: number,
  cpx2: number, cpy2: number,
  x1: number, y1: number,
  accent: string,
  width = 0.006,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x1, y1);
  ctx.stroke();
}


// ── SCOUT — Fresh bonding, minimal filaments ─────────────────────────────
// Small capsule with a sparse filament spiral. The symbiont has just
// taken hold — the ship still looks almost normal.

export function vetharaScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — small rounded capsule
  ctx.beginPath();
  ctx.moveTo(0.50, 0.12);
  ctx.bezierCurveTo(0.42, 0.16, 0.38, 0.28, 0.37, 0.42);
  ctx.bezierCurveTo(0.36, 0.56, 0.38, 0.68, 0.42, 0.76);
  ctx.bezierCurveTo(0.45, 0.80, 0.48, 0.82, 0.50, 0.83);
  ctx.bezierCurveTo(0.52, 0.82, 0.55, 0.80, 0.58, 0.76);
  ctx.bezierCurveTo(0.62, 0.68, 0.64, 0.56, 0.63, 0.42);
  ctx.bezierCurveTo(0.62, 0.28, 0.58, 0.16, 0.50, 0.12);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Sparse filament spiral — only 6 beads, tentative bonding
  vetharaFilamentSpiral(ctx, 0.50, 0.20, 0.74, 0.12, 6, accent);

  // Two thin tendril tips reaching past the bow
  vetharaTendril(ctx, 0.46, 0.18, 0.44, 0.12, 0.43, 0.08, 0.44, 0.04, accent, 0.004);
  vetharaTendril(ctx, 0.54, 0.18, 0.56, 0.12, 0.57, 0.08, 0.56, 0.04, accent, 0.004);

  // Single metabolic engine
  vetharaEngineGlow(ctx, 0.50, 0.81, 0.028);
}


// ── DESTROYER — Tendrils establishing control ────────────────────────────
// Elongated capsule with prominent tendril arms reaching forward from
// the bow and visible organ buds starting to form on the flanks.

export function vetharaDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — elongated capsule, slightly wider
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.42, 0.12, 0.35, 0.24, 0.33, 0.40);
  ctx.bezierCurveTo(0.32, 0.55, 0.34, 0.68, 0.38, 0.78);
  ctx.bezierCurveTo(0.42, 0.84, 0.46, 0.87, 0.50, 0.88);
  ctx.bezierCurveTo(0.54, 0.87, 0.58, 0.84, 0.62, 0.78);
  ctx.bezierCurveTo(0.66, 0.68, 0.68, 0.55, 0.67, 0.40);
  ctx.bezierCurveTo(0.65, 0.24, 0.58, 0.12, 0.50, 0.08);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Filament spiral — denser, 10 beads
  vetharaFilamentSpiral(ctx, 0.50, 0.16, 0.80, 0.15, 10, accent);

  // Three tendril arms reaching forward — the symbiont grasps
  vetharaTendril(ctx, 0.44, 0.18, 0.40, 0.10, 0.38, 0.05, 0.36, 0.02, accent, 0.006);
  vetharaTendril(ctx, 0.50, 0.14, 0.50, 0.08, 0.50, 0.04, 0.50, 0.01, accent, 0.005);
  vetharaTendril(ctx, 0.56, 0.18, 0.60, 0.10, 0.62, 0.05, 0.64, 0.02, accent, 0.006);

  // Tendril tip beads — sensory nodes
  vetharaFilamentBead(ctx, 0.36, 0.02, 0.010, accent);
  vetharaFilamentBead(ctx, 0.50, 0.01, 0.008, accent);
  vetharaFilamentBead(ctx, 0.64, 0.02, 0.010, accent);

  // Small organ buds on flanks — weapons growing
  vetharaOrganPod(ctx, 0.30, 0.44, 0.030, 0.020, accent);
  vetharaOrganPod(ctx, 0.70, 0.44, 0.030, 0.020, accent);

  // Side tendrils connecting organ buds to hull
  vetharaTendril(ctx, 0.34, 0.38, 0.30, 0.40, 0.28, 0.44, 0.30, 0.44, accent, 0.004);
  vetharaTendril(ctx, 0.66, 0.38, 0.70, 0.40, 0.72, 0.44, 0.70, 0.44, accent, 0.004);

  // Twin metabolic engines
  vetharaEngineGlow(ctx, 0.45, 0.86, 0.032);
  vetharaEngineGlow(ctx, 0.55, 0.86, 0.032);
}


// ── TRANSPORT — Swollen pod, the carrier of unbonded filaments ───────────
// Wide ovoid hull (it carries stasis tanks full of unbonded Vethara).
// Filament network wraps the hull protectively. Membrane fins extend
// to the sides — the symbiont shielding its precious cargo.

export function vetharaTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — wide, swollen capsule (cargo of stasis tanks)
  ctx.beginPath();
  ctx.moveTo(0.50, 0.14);
  ctx.bezierCurveTo(0.38, 0.18, 0.26, 0.30, 0.24, 0.46);
  ctx.bezierCurveTo(0.22, 0.60, 0.26, 0.72, 0.34, 0.80);
  ctx.bezierCurveTo(0.40, 0.85, 0.46, 0.87, 0.50, 0.87);
  ctx.bezierCurveTo(0.54, 0.87, 0.60, 0.85, 0.66, 0.80);
  ctx.bezierCurveTo(0.74, 0.72, 0.78, 0.60, 0.76, 0.46);
  ctx.bezierCurveTo(0.74, 0.30, 0.62, 0.18, 0.50, 0.14);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Interior stasis glow — the unbonded filaments within
  const stasisGlow = ctx.createRadialGradient(0.50, 0.50, 0, 0.50, 0.50, 0.20);
  stasisGlow.addColorStop(0,   withAlpha(accent, 0.25));
  stasisGlow.addColorStop(0.6, withAlpha(accent, 0.10));
  stasisGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.50, 0.20, 0, Math.PI * 2);
  ctx.fillStyle = stasisGlow;
  ctx.fill();

  // Filament spiral — dense wrapping, 12 beads protecting the cargo
  vetharaFilamentSpiral(ctx, 0.50, 0.22, 0.78, 0.22, 12, accent);

  // Protective membrane fins — the symbiont shielding its cargo
  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.beginPath();
  ctx.moveTo(0.24, 0.42);
  ctx.bezierCurveTo(0.16, 0.38, 0.12, 0.46, 0.14, 0.56);
  ctx.bezierCurveTo(0.16, 0.64, 0.22, 0.62, 0.24, 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.fillStyle = withAlpha(accent, 0.10);
  ctx.beginPath();
  ctx.moveTo(0.76, 0.42);
  ctx.bezierCurveTo(0.84, 0.38, 0.88, 0.46, 0.86, 0.56);
  ctx.bezierCurveTo(0.84, 0.64, 0.78, 0.62, 0.76, 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Two forward tendrils — shorter, this is not a warship
  vetharaTendril(ctx, 0.44, 0.20, 0.42, 0.14, 0.41, 0.10, 0.42, 0.06, accent, 0.005);
  vetharaTendril(ctx, 0.56, 0.20, 0.58, 0.14, 0.59, 0.10, 0.58, 0.06, accent, 0.005);

  // Twin metabolic engines
  vetharaEngineGlow(ctx, 0.42, 0.85, 0.030);
  vetharaEngineGlow(ctx, 0.58, 0.85, 0.030);
}


// ── CRUISER — The bonding deepens, membrane taking over ──────────────────
// Larger hull with full organ pods, membrane web stretched across
// the dorsal surface, and a dense filament network. The host hull
// is still visible but the symbiont is clearly dominant.

export function vetharaCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — elongated ovoid, wider than destroyer
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.40, 0.10, 0.30, 0.22, 0.26, 0.38);
  ctx.bezierCurveTo(0.24, 0.52, 0.26, 0.66, 0.32, 0.76);
  ctx.bezierCurveTo(0.38, 0.84, 0.44, 0.88, 0.50, 0.90);
  ctx.bezierCurveTo(0.56, 0.88, 0.62, 0.84, 0.68, 0.76);
  ctx.bezierCurveTo(0.74, 0.66, 0.76, 0.52, 0.74, 0.38);
  ctx.bezierCurveTo(0.70, 0.22, 0.60, 0.10, 0.50, 0.06);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Membrane web — translucent overlay across the dorsal surface
  ctx.fillStyle = withAlpha(accent, 0.08);
  ctx.beginPath();
  ctx.moveTo(0.38, 0.22);
  ctx.bezierCurveTo(0.30, 0.30, 0.28, 0.50, 0.32, 0.66);
  ctx.bezierCurveTo(0.38, 0.74, 0.50, 0.78, 0.62, 0.74);  // Corrected: removed trailing space
  ctx.bezierCurveTo(0.68, 0.66, 0.72, 0.50, 0.70, 0.30);
  ctx.bezierCurveTo(0.66, 0.22, 0.58, 0.18, 0.50, 0.16);
  ctx.bezierCurveTo(0.42, 0.18, 0.38, 0.22, 0.38, 0.22);
  ctx.closePath();
  ctx.fill();

  // Filament ridges across the membrane
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.005;
  ctx.beginPath();
  ctx.moveTo(0.38, 0.26); ctx.bezierCurveTo(0.42, 0.50, 0.40, 0.65, 0.38, 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.16); ctx.bezierCurveTo(0.50, 0.40, 0.50, 0.60, 0.50, 0.78);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.62, 0.26); ctx.bezierCurveTo(0.58, 0.50, 0.60, 0.65, 0.62, 0.72);
  ctx.stroke();

  // Dense filament spiral — 14 beads
  vetharaFilamentSpiral(ctx, 0.50, 0.14, 0.82, 0.20, 14, accent);

  // Four tendril arms at the bow — the symbiont reaches aggressively
  vetharaTendril(ctx, 0.40, 0.16, 0.36, 0.08, 0.34, 0.04, 0.32, 0.01, accent, 0.006);
  vetharaTendril(ctx, 0.47, 0.10, 0.46, 0.06, 0.45, 0.03, 0.44, 0.00, accent, 0.005);
  vetharaTendril(ctx, 0.53, 0.10, 0.54, 0.06, 0.55, 0.03, 0.56, 0.00, accent, 0.005);
  vetharaTendril(ctx, 0.60, 0.16, 0.64, 0.08, 0.66, 0.04, 0.68, 0.01, accent, 0.006);

  // Full organ pods on flanks — bio-acid launchers
  vetharaOrganPod(ctx, 0.22, 0.42, 0.040, 0.028, accent);
  vetharaOrganPod(ctx, 0.78, 0.42, 0.040, 0.028, accent);
  vetharaOrganPod(ctx, 0.24, 0.58, 0.035, 0.022, accent);
  vetharaOrganPod(ctx, 0.76, 0.58, 0.035, 0.022, accent);

  // Connecting tendrils from organs to hull
  vetharaTendril(ctx, 0.28, 0.38, 0.24, 0.40, 0.22, 0.42, 0.22, 0.42, accent, 0.004);
  vetharaTendril(ctx, 0.72, 0.38, 0.76, 0.40, 0.78, 0.42, 0.78, 0.42, accent, 0.004);

  // Twin metabolic engines
  vetharaEngineGlow(ctx, 0.42, 0.88, 0.035);
  vetharaEngineGlow(ctx, 0.58, 0.88, 0.035);
}


// ── CARRIER — Jellyfish-dome mother, dangling launch filaments ───────────
// Broad dome shape (the symbiont has restructured the host into a
// living hangar). Filaments hang below as launch rails for fighters.
// The dome is covered in a dense filament web.

export function vetharaCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — broad dome, flattened (restructured into hangar)
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.32, 0.10, 0.16, 0.22, 0.14, 0.36);
  ctx.bezierCurveTo(0.14, 0.46, 0.22, 0.54, 0.36, 0.58);
  ctx.bezierCurveTo(0.42, 0.60, 0.50, 0.61, 0.50, 0.61);
  ctx.bezierCurveTo(0.50, 0.61, 0.58, 0.60, 0.64, 0.58);
  ctx.bezierCurveTo(0.78, 0.54, 0.86, 0.46, 0.86, 0.36);
  ctx.bezierCurveTo(0.84, 0.22, 0.68, 0.10, 0.50, 0.10);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Dome membrane overlay — the symbiont's web across the top
  ctx.fillStyle = withAlpha(accent, 0.07);
  ctx.beginPath();
  ctx.ellipse(0.50, 0.34, 0.30, 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Web ridges across dome
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  for (let i = 0; i < 5; i++) {
    const x = 0.26 + i * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, 0.18 + Math.abs(i - 2) * 0.04);
    ctx.bezierCurveTo(x, 0.30, x, 0.42, x, 0.54 - Math.abs(i - 2) * 0.03);
    ctx.stroke();
  }

  // Filament spiral around dome perimeter
  vetharaFilamentSpiral(ctx, 0.50, 0.14, 0.56, 0.28, 16, accent);

  // Launch filaments dangling below — fighter rails
  const launchX = [0.26, 0.36, 0.44, 0.56, 0.64, 0.74];
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.006;
  for (const lx of launchX) {
    ctx.beginPath();
    ctx.moveTo(lx, 0.58);
    ctx.bezierCurveTo(lx - 0.01, 0.68, lx + 0.01, 0.78, lx - 0.02, 0.90);
    ctx.stroke();
    // Stasis node at the tip of each filament
    vetharaFilamentBead(ctx, lx - 0.02, 0.90, 0.010, accent);
  }

  // Organ pods flanking the dome — point defence
  vetharaOrganPod(ctx, 0.14, 0.40, 0.032, 0.024, accent);
  vetharaOrganPod(ctx, 0.86, 0.40, 0.032, 0.024, accent);

  // Central neural mass — the carrier's coordination organ
  const neuralGlow = ctx.createRadialGradient(0.50, 0.32, 0, 0.50, 0.32, 0.06);
  neuralGlow.addColorStop(0,   withAlpha(accent, 0.5));
  neuralGlow.addColorStop(0.5, withAlpha(accent, 0.2));
  neuralGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.32, 0.06, 0, Math.PI * 2);
  ctx.fillStyle = neuralGlow;
  ctx.fill();

  // Engines — at the dome edges
  vetharaEngineGlow(ctx, 0.32, 0.56, 0.028);
  vetharaEngineGlow(ctx, 0.68, 0.56, 0.028);
}


// ── BATTLESHIP — Fully colonised leviathan ───────────────────────────────
// Massive hull completely overtaken by the symbiont. Tendril crown at
// the bow, dense organ clusters on all flanks, neural nexus dome on
// the dorsal surface, and trailing reproductive filaments at the stern.
// The host hull is barely visible beneath the organic overgrowth.

export function vetharaBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — massive ovoid, almost entirely obscured
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);
  ctx.bezierCurveTo(0.36, 0.08, 0.20, 0.20, 0.16, 0.38);
  ctx.bezierCurveTo(0.14, 0.52, 0.18, 0.68, 0.26, 0.78);
  ctx.bezierCurveTo(0.34, 0.86, 0.42, 0.90, 0.50, 0.92);
  ctx.bezierCurveTo(0.58, 0.90, 0.66, 0.86, 0.74, 0.78);
  ctx.bezierCurveTo(0.82, 0.68, 0.86, 0.52, 0.84, 0.38);
  ctx.bezierCurveTo(0.80, 0.20, 0.64, 0.08, 0.50, 0.06);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Full membrane overlay — the entire hull is webbed
  ctx.fillStyle = withAlpha(accent, 0.06);
  ctx.beginPath();
  ctx.ellipse(0.50, 0.48, 0.30, 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dense filament ridges — 7 lines across the hull
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.004;
  for (let i = 0; i < 7; i++) {
    const x = 0.24 + i * 0.08;
    const topY = 0.14 + Math.abs(i - 3) * 0.06;
    const botY = 0.84 - Math.abs(i - 3) * 0.04;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.bezierCurveTo(x - 0.01, topY + (botY - topY) * 0.4,
                       x + 0.01, topY + (botY - topY) * 0.7,
                       x, botY);
    ctx.stroke();
  }

  // Dense filament spiral — 20 beads, the hull is crawling
  vetharaFilamentSpiral(ctx, 0.50, 0.12, 0.86, 0.28, 20, accent);

  // TENDRIL CROWN — ring of tendrils at the bow
  const crownAngles = [-0.28, -0.16, -0.06, 0.06, 0.16, 0.28];
  for (const dx of crownAngles) {
    const startX = 0.50 + dx;
    const tipX = 0.50 + dx * 1.6;
    vetharaTendril(ctx,
      startX, 0.12,
      startX - dx * 0.2, 0.06,
      tipX - dx * 0.1, 0.03,
      tipX, 0.00,
      accent, 0.006);
    vetharaFilamentBead(ctx, tipX, 0.00, 0.008, accent);
  }

  // NEURAL NEXUS DOME — central command organ
  const nexusGlow = ctx.createRadialGradient(0.50, 0.36, 0, 0.50, 0.36, 0.08);
  nexusGlow.addColorStop(0,   withAlpha(accent, 0.6));
  nexusGlow.addColorStop(0.4, withAlpha(accent, 0.3));
  nexusGlow.addColorStop(1,   withAlpha(accent, 0.05));
  ctx.beginPath();
  ctx.ellipse(0.50, 0.36, 0.08, 0.06, 0, 0, Math.PI * 2);
  ctx.fillStyle = nexusGlow;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Nexus connectors radiating outward
  const nexusLines: [number, number][] = [[0.36, 0.30], [0.64, 0.30], [0.34, 0.44], [0.66, 0.44]];
  for (const [nx, ny] of nexusLines) {
    ctx.strokeStyle = withAlpha(accent, 0.25);
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    ctx.moveTo(0.50, 0.36);
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }

  // ORGAN CLUSTERS — six weapon pods across both flanks
  const organs: [number, number, number, number][] = [
    [0.16, 0.36, 0.038, 0.026],
    [0.84, 0.36, 0.038, 0.026],
    [0.14, 0.52, 0.035, 0.024],
    [0.86, 0.52, 0.035, 0.024],
    [0.20, 0.68, 0.032, 0.022],
    [0.80, 0.68, 0.032, 0.022],
  ];
  for (const [ox, oy, orx, ory] of organs) {
    vetharaOrganPod(ctx, ox, oy, orx, ory, accent);
  }

  // Organ connection tendrils
  vetharaTendril(ctx, 0.22, 0.34, 0.18, 0.34, 0.16, 0.35, 0.16, 0.36, accent, 0.004);
  vetharaTendril(ctx, 0.78, 0.34, 0.82, 0.34, 0.84, 0.35, 0.84, 0.36, accent, 0.004);

  // TRAILING REPRODUCTIVE FILAMENTS at the stern
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.005;
  const trailX = [0.36, 0.43, 0.50, 0.57, 0.64];
  for (const tx of trailX) {
    ctx.beginPath();
    ctx.moveTo(tx, 0.88);
    ctx.bezierCurveTo(tx - 0.01, 0.92, tx + 0.01, 0.95, tx - 0.02, 0.99);
    ctx.stroke();
    vetharaFilamentBead(ctx, tx - 0.02, 0.99, 0.006, accent);
  }

  // Triple metabolic engines — the heartbeat of a leviathan
  vetharaEngineGlow(ctx, 0.38, 0.90, 0.036);
  vetharaEngineGlow(ctx, 0.50, 0.92, 0.030);
  vetharaEngineGlow(ctx, 0.62, 0.90, 0.036);
}


// ── COLONISER — The seed pod, carrying the future ────────────────────────
// Tear-shaped hull bulging with stasis cargo. The most important ship
// in the Vethara fleet — every one carries unbonded filaments searching
// for new hosts. Root-like filaments trail behind, and a protective
// membrane cocoon envelops the interior. The exterior crawls with
// the densest filament network of any non-capital ship.

export function vetharaColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Host hull — teardrop seed pod, wider at the belly
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.40, 0.12, 0.30, 0.24, 0.26, 0.40);
  ctx.bezierCurveTo(0.24, 0.54, 0.26, 0.66, 0.32, 0.74);
  ctx.bezierCurveTo(0.38, 0.80, 0.44, 0.83, 0.50, 0.84);
  ctx.bezierCurveTo(0.56, 0.83, 0.62, 0.80, 0.68, 0.74);
  ctx.bezierCurveTo(0.74, 0.66, 0.76, 0.54, 0.74, 0.40);
  ctx.bezierCurveTo(0.70, 0.24, 0.60, 0.12, 0.50, 0.08);
  ctx.closePath();
  vetharaHostFill(ctx, accent);

  // Interior stasis glow — bright, this ship is FULL of unbonded Vethara
  const stasisGlow = ctx.createRadialGradient(0.50, 0.46, 0, 0.50, 0.46, 0.22);
  stasisGlow.addColorStop(0,   withAlpha(accent, 0.35));
  stasisGlow.addColorStop(0.4, withAlpha(accent, 0.15));
  stasisGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.46, 0.22, 0, Math.PI * 2);
  ctx.fillStyle = stasisGlow;
  ctx.fill();

  // Protective membrane cocoon — double layer
  ctx.fillStyle = withAlpha(accent, 0.06);
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.20, 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(accent, 0.15);
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.ellipse(0.50, 0.46, 0.16, 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Dense filament spiral — 16 beads, protective wrapping
  vetharaFilamentSpiral(ctx, 0.50, 0.16, 0.78, 0.20, 16, accent);

  // Protective tendrils at the bow — fewer than warships, but present
  vetharaTendril(ctx, 0.44, 0.16, 0.42, 0.10, 0.41, 0.06, 0.40, 0.02, accent, 0.005);
  vetharaTendril(ctx, 0.50, 0.12, 0.50, 0.07, 0.50, 0.04, 0.50, 0.01, accent, 0.005);
  vetharaTendril(ctx, 0.56, 0.16, 0.58, 0.10, 0.59, 0.06, 0.60, 0.02, accent, 0.005);

  // ROOT-LIKE trailing filaments — this ship is planting the future
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.38, 0.78);
  ctx.bezierCurveTo(0.34, 0.84, 0.30, 0.90, 0.26, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.46, 0.82);
  ctx.bezierCurveTo(0.44, 0.88, 0.42, 0.94, 0.40, 0.99);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.84);
  ctx.bezierCurveTo(0.50, 0.90, 0.50, 0.95, 0.50, 0.99);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.54, 0.82);
  ctx.bezierCurveTo(0.56, 0.88, 0.58, 0.94, 0.60, 0.99);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.62, 0.78);
  ctx.bezierCurveTo(0.66, 0.84, 0.70, 0.90, 0.74, 0.98);
  ctx.stroke();

  // Stasis node beads along the roots
  vetharaFilamentBead(ctx, 0.26, 0.98, 0.008, accent);
  vetharaFilamentBead(ctx, 0.40, 0.99, 0.007, accent);
  vetharaFilamentBead(ctx, 0.50, 0.99, 0.007, accent);
  vetharaFilamentBead(ctx, 0.60, 0.99, 0.007, accent);
  vetharaFilamentBead(ctx, 0.74, 0.98, 0.008, accent);

  // Flanking organ pods — smaller, defensive
  vetharaOrganPod(ctx, 0.22, 0.44, 0.030, 0.020, accent);
  vetharaOrganPod(ctx, 0.78, 0.44, 0.030, 0.020, accent);

  // Single large metabolic engine — efficient, not fast
  vetharaEngineGlow(ctx, 0.50, 0.83, 0.038);
}
