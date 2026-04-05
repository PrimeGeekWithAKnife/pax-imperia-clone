import { withAlpha } from '../shipWireframeHelpers';

function drakmariFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.2, 0.1, 0.8, 0.9);
  grad.addColorStop(0,   '#1a2d3d');  // cold near-black
  grad.addColorStop(0.4, '#0f1e2a');  // deep abyss
  grad.addColorStop(1,   '#080e14');  // void
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.45);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

/** Drakmari engine glow: teal bioluminescent, colder than organic green. */
function drakmariEngineGlow(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
): void {
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(0,220,200,0.65)');
  bloom.addColorStop(0.5, 'rgba(0,160,150,0.25)');
  bloom.addColorStop(1,   'rgba(0,80,70,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(200,255,250,1)');
  core.addColorStop(0.4, 'rgba(0,220,200,0.85)');
  core.addColorStop(1,   'rgba(0,100,90,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Bioluminescent photophore node — small teal glow spot. */
function photophore(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  accent: string,
): void {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0,   withAlpha(accent, 0.7));
  glow.addColorStop(0.5, withAlpha(accent, 0.3));
  glow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
}

/** Lateral sensor barbel — thin line projecting outward from hull. */
function barbel(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  accent: string,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Tiny photophore at tip
  photophore(ctx, x2, y2, 0.008, accent);
}

// ── 1. Scout ────────────────────────────────────────────────────────────────

export function drakmariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Barracuda-form: narrow, fast, no jaw split. Pure speed predator.
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);                                       // nose tip
  ctx.bezierCurveTo(0.44, 0.14, 0.40, 0.24, 0.39, 0.38);       // port curve
  ctx.bezierCurveTo(0.38, 0.52, 0.40, 0.64, 0.43, 0.74);
  ctx.bezierCurveTo(0.44, 0.78, 0.46, 0.82, 0.48, 0.84);
  ctx.lineTo(0.50, 0.88);                                       // tail point
  ctx.lineTo(0.52, 0.84);
  ctx.bezierCurveTo(0.54, 0.82, 0.56, 0.78, 0.57, 0.74);       // starboard
  ctx.bezierCurveTo(0.60, 0.64, 0.62, 0.52, 0.61, 0.38);
  ctx.bezierCurveTo(0.60, 0.24, 0.56, 0.14, 0.50, 0.08);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Single pair of sensor barbels
  barbel(ctx, 0.39, 0.40, 0.28, 0.36, accent);
  barbel(ctx, 0.61, 0.40, 0.72, 0.36, accent);

  // Centreline photophores
  photophore(ctx, 0.50, 0.18, 0.015, accent);
  photophore(ctx, 0.50, 0.50, 0.012, accent);

  // Tail engine
  drakmariEngineGlow(ctx, 0.50, 0.86, 0.030);
}

// ── 2. Destroyer ────────────────────────────────────────────────────────────

export function drakmariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // First ship with the split jaw-prow. Hunting wolf of the fleet.
  // Port jaw
  ctx.beginPath();
  ctx.moveTo(0.44, 0.06);
  ctx.bezierCurveTo(0.40, 0.10, 0.36, 0.18, 0.34, 0.28);
  ctx.bezierCurveTo(0.33, 0.36, 0.34, 0.42, 0.38, 0.44);
  ctx.lineTo(0.46, 0.44);
  ctx.lineTo(0.46, 0.28);
  ctx.bezierCurveTo(0.46, 0.18, 0.45, 0.12, 0.44, 0.06);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Starboard jaw
  ctx.beginPath();
  ctx.moveTo(0.56, 0.06);
  ctx.bezierCurveTo(0.60, 0.10, 0.64, 0.18, 0.66, 0.28);
  ctx.bezierCurveTo(0.67, 0.36, 0.66, 0.42, 0.62, 0.44);
  ctx.lineTo(0.54, 0.44);
  ctx.lineTo(0.54, 0.28);
  ctx.bezierCurveTo(0.54, 0.18, 0.55, 0.12, 0.56, 0.06);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Main body behind the jaw
  ctx.beginPath();
  ctx.moveTo(0.38, 0.44);
  ctx.bezierCurveTo(0.34, 0.48, 0.32, 0.56, 0.33, 0.64);
  ctx.bezierCurveTo(0.34, 0.72, 0.38, 0.80, 0.44, 0.84);
  ctx.lineTo(0.50, 0.90);
  ctx.lineTo(0.56, 0.84);
  ctx.bezierCurveTo(0.62, 0.80, 0.66, 0.72, 0.67, 0.64);
  ctx.bezierCurveTo(0.68, 0.56, 0.66, 0.48, 0.62, 0.44);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Sensor barbels
  barbel(ctx, 0.33, 0.50, 0.20, 0.46, accent);
  barbel(ctx, 0.67, 0.50, 0.80, 0.46, accent);
  barbel(ctx, 0.34, 0.64, 0.22, 0.66, accent);
  barbel(ctx, 0.66, 0.64, 0.78, 0.66, accent);

  // Jaw-gap lure
  photophore(ctx, 0.50, 0.20, 0.018, accent);

  // Centreline photophores
  photophore(ctx, 0.50, 0.56, 0.012, accent);
  photophore(ctx, 0.50, 0.70, 0.012, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.46, 0.88, 0.028);
  drakmariEngineGlow(ctx, 0.54, 0.88, 0.028);
}

// ── 3. Transport ────────────────────────────────────────────────────────────

export function drakmariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Gulper-form: wide mid-body for cargo, narrow fore and aft.
  // No jaw split — transports are not hunters. Smooth whale-shark profile.
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);                                      // nose
  ctx.bezierCurveTo(0.42, 0.14, 0.30, 0.26, 0.24, 0.42);      // port bulge
  ctx.bezierCurveTo(0.22, 0.54, 0.24, 0.66, 0.30, 0.74);
  ctx.bezierCurveTo(0.36, 0.80, 0.42, 0.84, 0.48, 0.86);
  ctx.lineTo(0.50, 0.88);
  ctx.lineTo(0.52, 0.86);
  ctx.bezierCurveTo(0.58, 0.84, 0.64, 0.80, 0.70, 0.74);      // starboard
  ctx.bezierCurveTo(0.76, 0.66, 0.78, 0.54, 0.76, 0.42);
  ctx.bezierCurveTo(0.70, 0.26, 0.58, 0.14, 0.50, 0.10);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Cargo hold segments — internal lines suggesting compartments
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.005;
  for (const y of [0.38, 0.50, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(0.30, y);
    ctx.lineTo(0.70, y);
    ctx.stroke();
  }

  // Stubby sensor barbels (shorter than combat ships)
  barbel(ctx, 0.24, 0.44, 0.16, 0.40, accent);
  barbel(ctx, 0.76, 0.44, 0.84, 0.40, accent);

  // Forward photophore
  photophore(ctx, 0.50, 0.18, 0.016, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.44, 0.86, 0.032);
  drakmariEngineGlow(ctx, 0.56, 0.86, 0.032);
}

// ── 4. Cruiser ──────────────────────────────────────────────────────────────

export function drakmariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Full predator form: prominent jaw, dorsal hump, bristling barbels.
  // The workhorse of the Drakmari fleet — an apex hunter.

  // Port jaw prong
  ctx.beginPath();
  ctx.moveTo(0.42, 0.04);
  ctx.bezierCurveTo(0.38, 0.08, 0.34, 0.16, 0.32, 0.24);
  ctx.bezierCurveTo(0.31, 0.30, 0.32, 0.34, 0.36, 0.36);
  ctx.lineTo(0.46, 0.36);
  ctx.lineTo(0.46, 0.20);
  ctx.bezierCurveTo(0.46, 0.12, 0.44, 0.08, 0.42, 0.04);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Starboard jaw prong
  ctx.beginPath();
  ctx.moveTo(0.58, 0.04);
  ctx.bezierCurveTo(0.62, 0.08, 0.66, 0.16, 0.68, 0.24);
  ctx.bezierCurveTo(0.69, 0.30, 0.68, 0.34, 0.64, 0.36);
  ctx.lineTo(0.54, 0.36);
  ctx.lineTo(0.54, 0.20);
  ctx.bezierCurveTo(0.54, 0.12, 0.56, 0.08, 0.58, 0.04);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Main hull — dorsal hump silhouette
  ctx.beginPath();
  ctx.moveTo(0.36, 0.36);
  ctx.bezierCurveTo(0.28, 0.40, 0.24, 0.50, 0.24, 0.58);
  ctx.bezierCurveTo(0.24, 0.68, 0.30, 0.76, 0.38, 0.82);
  ctx.bezierCurveTo(0.42, 0.86, 0.46, 0.88, 0.50, 0.90);
  ctx.bezierCurveTo(0.54, 0.88, 0.58, 0.86, 0.62, 0.82);
  ctx.bezierCurveTo(0.70, 0.76, 0.76, 0.68, 0.76, 0.58);
  ctx.bezierCurveTo(0.76, 0.50, 0.72, 0.40, 0.64, 0.36);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Armour segment lines on hull
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.30, 0.52); ctx.lineTo(0.70, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.32, 0.64); ctx.lineTo(0.68, 0.64); ctx.stroke();

  // Sensor barbels — three pairs
  barbel(ctx, 0.24, 0.48, 0.12, 0.42, accent);
  barbel(ctx, 0.76, 0.48, 0.88, 0.42, accent);
  barbel(ctx, 0.25, 0.60, 0.14, 0.58, accent);
  barbel(ctx, 0.75, 0.60, 0.86, 0.58, accent);
  barbel(ctx, 0.28, 0.72, 0.18, 0.74, accent);
  barbel(ctx, 0.72, 0.72, 0.82, 0.74, accent);

  // Jaw-gap lure
  photophore(ctx, 0.50, 0.16, 0.020, accent);

  // Lateral photophore arrays
  photophore(ctx, 0.32, 0.54, 0.010, accent);
  photophore(ctx, 0.68, 0.54, 0.010, accent);
  photophore(ctx, 0.50, 0.72, 0.012, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.44, 0.88, 0.032);
  drakmariEngineGlow(ctx, 0.56, 0.88, 0.032);
}

// ── 5. Carrier ──────────────────────────────────────────────────────────────

export function drakmariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Gulper eel form: massive gaping front section with ventral launch bays.
  // The "mouth" is the flight deck — fighters launch from the throat.

  // Broad forward hull — the gaping maw
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);
  ctx.bezierCurveTo(0.36, 0.10, 0.18, 0.18, 0.14, 0.32);
  ctx.bezierCurveTo(0.12, 0.42, 0.16, 0.50, 0.24, 0.54);
  ctx.lineTo(0.76, 0.54);
  ctx.bezierCurveTo(0.84, 0.50, 0.88, 0.42, 0.86, 0.32);
  ctx.bezierCurveTo(0.82, 0.18, 0.64, 0.10, 0.50, 0.08);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Ventral launch bay — darker inner "throat"
  ctx.beginPath();
  ctx.moveTo(0.30, 0.34);
  ctx.bezierCurveTo(0.34, 0.28, 0.42, 0.24, 0.50, 0.24);
  ctx.bezierCurveTo(0.58, 0.24, 0.66, 0.28, 0.70, 0.34);
  ctx.bezierCurveTo(0.68, 0.42, 0.60, 0.48, 0.50, 0.48);
  ctx.bezierCurveTo(0.40, 0.48, 0.32, 0.42, 0.30, 0.34);
  ctx.closePath();
  ctx.fillStyle = withAlpha('#050a0e', 0.8);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Aft body — tapers to tail
  ctx.beginPath();
  ctx.moveTo(0.24, 0.54);
  ctx.bezierCurveTo(0.28, 0.60, 0.34, 0.68, 0.40, 0.76);
  ctx.bezierCurveTo(0.44, 0.82, 0.48, 0.86, 0.50, 0.90);
  ctx.bezierCurveTo(0.52, 0.86, 0.56, 0.82, 0.60, 0.76);
  ctx.bezierCurveTo(0.66, 0.68, 0.72, 0.60, 0.76, 0.54);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Launch bay guide lines (fighter slots)
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.003;
  for (const x of [0.38, 0.44, 0.50, 0.56, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(x, 0.28);
    ctx.lineTo(x, 0.46);
    ctx.stroke();
  }

  // Sensor barbels
  barbel(ctx, 0.14, 0.34, 0.06, 0.28, accent);
  barbel(ctx, 0.86, 0.34, 0.94, 0.28, accent);
  barbel(ctx, 0.22, 0.52, 0.12, 0.56, accent);
  barbel(ctx, 0.78, 0.52, 0.88, 0.56, accent);

  // Forward lure
  photophore(ctx, 0.50, 0.12, 0.020, accent);

  // Throat glow — deep within the bay
  photophore(ctx, 0.50, 0.38, 0.025, accent);

  // Triple engines
  drakmariEngineGlow(ctx, 0.42, 0.88, 0.028);
  drakmariEngineGlow(ctx, 0.50, 0.90, 0.024);
  drakmariEngineGlow(ctx, 0.58, 0.88, 0.028);
}

// ── 6. Battleship ───────────────────────────────────────────────────────────

export function drakmariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Full anglerfish nightmare. Massive split jaw, bristling spines,
  // bioluminescent nodes everywhere, dorsal hump, heavy ventral keel.
  // The apex predator of the deep, rendered as a warship.

  // Port jaw — heavy, armoured
  ctx.beginPath();
  ctx.moveTo(0.40, 0.02);
  ctx.bezierCurveTo(0.34, 0.06, 0.28, 0.14, 0.24, 0.24);
  ctx.bezierCurveTo(0.22, 0.30, 0.22, 0.34, 0.26, 0.36);
  ctx.lineTo(0.46, 0.36);
  ctx.lineTo(0.46, 0.16);
  ctx.bezierCurveTo(0.46, 0.10, 0.44, 0.06, 0.40, 0.02);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Starboard jaw
  ctx.beginPath();
  ctx.moveTo(0.60, 0.02);
  ctx.bezierCurveTo(0.66, 0.06, 0.72, 0.14, 0.76, 0.24);
  ctx.bezierCurveTo(0.78, 0.30, 0.78, 0.34, 0.74, 0.36);
  ctx.lineTo(0.54, 0.36);
  ctx.lineTo(0.54, 0.16);
  ctx.bezierCurveTo(0.54, 0.10, 0.56, 0.06, 0.60, 0.02);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Main hull — massive dorsal hump
  ctx.beginPath();
  ctx.moveTo(0.26, 0.36);
  ctx.bezierCurveTo(0.18, 0.42, 0.14, 0.52, 0.14, 0.60);
  ctx.bezierCurveTo(0.14, 0.70, 0.20, 0.78, 0.30, 0.84);
  ctx.bezierCurveTo(0.36, 0.88, 0.42, 0.90, 0.50, 0.92);
  ctx.bezierCurveTo(0.58, 0.90, 0.64, 0.88, 0.70, 0.84);
  ctx.bezierCurveTo(0.80, 0.78, 0.86, 0.70, 0.86, 0.60);
  ctx.bezierCurveTo(0.86, 0.52, 0.82, 0.42, 0.74, 0.36);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Armour segment lines
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.20, 0.48); ctx.lineTo(0.80, 0.48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.60); ctx.lineTo(0.82, 0.60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.72); ctx.lineTo(0.76, 0.72); ctx.stroke();

  // Ventral keel ridge
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.50, 0.36);
  ctx.lineTo(0.50, 0.90);
  ctx.stroke();

  // Sensor barbels — four pairs, bristling
  barbel(ctx, 0.14, 0.50, 0.04, 0.44, accent);
  barbel(ctx, 0.86, 0.50, 0.96, 0.44, accent);
  barbel(ctx, 0.16, 0.60, 0.06, 0.56, accent);
  barbel(ctx, 0.84, 0.60, 0.94, 0.56, accent);
  barbel(ctx, 0.18, 0.70, 0.08, 0.68, accent);
  barbel(ctx, 0.82, 0.70, 0.92, 0.68, accent);
  barbel(ctx, 0.24, 0.78, 0.14, 0.80, accent);
  barbel(ctx, 0.76, 0.78, 0.86, 0.80, accent);

  // Weapon hardpoint glows on barbel roots
  photophore(ctx, 0.16, 0.50, 0.012, accent);
  photophore(ctx, 0.84, 0.50, 0.012, accent);
  photophore(ctx, 0.18, 0.60, 0.012, accent);
  photophore(ctx, 0.82, 0.60, 0.012, accent);

  // Jaw-gap lure — large, commanding
  photophore(ctx, 0.50, 0.14, 0.024, accent);

  // Lateral photophore arrays
  photophore(ctx, 0.24, 0.54, 0.010, accent);
  photophore(ctx, 0.76, 0.54, 0.010, accent);
  photophore(ctx, 0.22, 0.66, 0.010, accent);
  photophore(ctx, 0.78, 0.66, 0.010, accent);
  photophore(ctx, 0.50, 0.78, 0.014, accent);

  // Triple engine cluster
  drakmariEngineGlow(ctx, 0.40, 0.90, 0.034);
  drakmariEngineGlow(ctx, 0.50, 0.92, 0.030);
  drakmariEngineGlow(ctx, 0.60, 0.90, 0.034);
}

// ── 7. Coloniser ────────────────────────────────────────────────────────────

export function drakmariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ark-form: swollen egg-sac silhouette. This is the desperate hope of a
  // dying ocean. A pregnant deep-sea fish carrying the future of the species.
  // No jaw (colonisers are not hunters). Broad, round, protective.

  // Main hull — swollen ovoid
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);
  ctx.bezierCurveTo(0.38, 0.14, 0.26, 0.28, 0.22, 0.44);
  ctx.bezierCurveTo(0.20, 0.56, 0.22, 0.68, 0.28, 0.76);
  ctx.bezierCurveTo(0.34, 0.82, 0.40, 0.86, 0.50, 0.88);
  ctx.bezierCurveTo(0.60, 0.86, 0.66, 0.82, 0.72, 0.76);
  ctx.bezierCurveTo(0.78, 0.68, 0.80, 0.56, 0.78, 0.44);
  ctx.bezierCurveTo(0.74, 0.28, 0.62, 0.14, 0.50, 0.10);
  ctx.closePath();
  drakmariFill(ctx, accent);

  // Internal egg-chamber glow — the precious cargo
  const eggGlow = ctx.createRadialGradient(0.50, 0.48, 0, 0.50, 0.48, 0.20);
  eggGlow.addColorStop(0,   withAlpha(accent, 0.25));
  eggGlow.addColorStop(0.6, withAlpha(accent, 0.10));
  eggGlow.addColorStop(1,   withAlpha(accent, 0));
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.20, 0, Math.PI * 2);
  ctx.fillStyle = eggGlow;
  ctx.fill();

  // Protective membrane arcs around the egg chamber
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.14, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.50, 0.48, 0.14, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  // Stubby protective barbels
  barbel(ctx, 0.24, 0.44, 0.16, 0.38, accent);
  barbel(ctx, 0.76, 0.44, 0.84, 0.38, accent);
  barbel(ctx, 0.24, 0.60, 0.16, 0.62, accent);
  barbel(ctx, 0.76, 0.60, 0.84, 0.62, accent);

  // Tail tendrils — trailing behind the ark
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0.42, 0.84); ctx.bezierCurveTo(0.38, 0.90, 0.34, 0.95, 0.30, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.58, 0.84); ctx.bezierCurveTo(0.62, 0.90, 0.66, 0.95, 0.70, 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.88); ctx.bezierCurveTo(0.50, 0.93, 0.49, 0.96, 0.48, 0.99);
  ctx.stroke();

  // Forward photophore
  photophore(ctx, 0.50, 0.18, 0.018, accent);

  // Twin engines
  drakmariEngineGlow(ctx, 0.44, 0.86, 0.030);
  drakmariEngineGlow(ctx, 0.56, 0.86, 0.030);
}
