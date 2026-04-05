import { withAlpha } from '../shipWireframeHelpers';

function pyrenthFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.08, 0.7, 0.92);
  grad.addColorStop(0,   '#2a2018');  // dark volcanic brown-black
  grad.addColorStop(0.35, '#1a1410');  // deep obsidian
  grad.addColorStop(0.7, '#120e0a');  // near-black basalt
  grad.addColorStop(1,   '#1e1610');  // slightly warmer aft
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Magma engine glow — volcanic orange core fading to deep red bloom. */
function magmaEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom — deep red haze
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(255,120,30,0.65)');
  bloom.addColorStop(0.4, 'rgba(200,60,10,0.3)');
  bloom.addColorStop(1,   'rgba(120,20,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-hot
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,240,200,1)');
  core.addColorStop(0.3, 'rgba(255,160,50,0.9)');
  core.addColorStop(0.7, 'rgba(220,80,10,0.6)');
  core.addColorStop(1,   'rgba(160,30,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Caldera glow — a volcanic crater viewport, brighter and more irregular
 *  than a standard viewport slit. Radial gradient with hexagonal hint. */
function calderaGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0,   'rgba(255,220,160,0.95)');
  glow.addColorStop(0.3, 'rgba(255,130,40,0.7)');
  glow.addColorStop(0.7, 'rgba(180,50,10,0.3)');
  glow.addColorStop(1,   'rgba(100,20,0,0)');
  // Draw as a rough hexagonal shape rather than a circle
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = glow;
  ctx.fill();
}

/** Magma vein line — a glowing accent line suggesting lava channels. */
function magmaVein(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  accent: string,
  width = 0.005,
): void {
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Hotter core line
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = width * 2.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Fracture line — dark structural crack in the hull surface. */
function fractureLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}


// ── SCOUT — Obsidian Shard ──────────────────────────────────────────────────
// A thrown volcanic glass spearhead. Narrow, angular, sharp — the smallest
// and fastest Pyrenth hull. A single faceted shard with a magma vein running
// its length and a caldera sensor at the nose.

export function pyrenthScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — irregular pentagonal shard
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // sharp prow
  ctx.lineTo(0.42, 0.22);   // left shoulder — asymmetric
  ctx.lineTo(0.38, 0.48);   // left waist
  ctx.lineTo(0.40, 0.72);   // left hip
  ctx.lineTo(0.44, 0.82);   // left engine
  ctx.lineTo(0.56, 0.82);   // right engine
  ctx.lineTo(0.60, 0.72);   // right hip
  ctx.lineTo(0.62, 0.48);   // right waist
  ctx.lineTo(0.58, 0.22);   // right shoulder
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Central magma vein — bow to stern
  magmaVein(ctx, 0.50, 0.14, 0.50, 0.78, accent, 0.004);

  // Fracture lines — geological strata
  fractureLine(ctx, 0.42, 0.36, 0.58, 0.34);
  fractureLine(ctx, 0.40, 0.58, 0.60, 0.56);

  // Caldera sensor — nose
  calderaGlow(ctx, 0.50, 0.16, 0.025);

  // Engine
  magmaEngineGlow(ctx, 0.50, 0.80, 0.028);
}


// ── DESTROYER — Basalt Fang ─────────────────────────────────────────────────
// A heavy wedge with overlapping tectonic plates and flanking magma vents.
// The hammerhead prow is split into two basalt prongs — like a serpent's
// fangs carved from volcanic glass. Twin engine columns at the stern.

export function pyrenthDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad angular wedge with split prow
  ctx.beginPath();
  ctx.moveTo(0.44, 0.07);   // left fang tip
  ctx.lineTo(0.40, 0.16);   // left fang base
  ctx.lineTo(0.34, 0.20);   // left prow shoulder
  ctx.lineTo(0.28, 0.30);   // left armour plate edge
  ctx.lineTo(0.30, 0.70);   // left hull
  ctx.lineTo(0.36, 0.84);   // left engine mount
  ctx.lineTo(0.64, 0.84);   // right engine mount
  ctx.lineTo(0.70, 0.70);   // right hull
  ctx.lineTo(0.72, 0.30);   // right armour plate edge
  ctx.lineTo(0.66, 0.20);   // right prow shoulder
  ctx.lineTo(0.60, 0.16);   // right fang base
  ctx.lineTo(0.56, 0.07);   // right fang tip
  ctx.lineTo(0.50, 0.12);   // prow notch (between fangs)
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Tectonic plate lines
  fractureLine(ctx, 0.30, 0.36, 0.70, 0.34);
  fractureLine(ctx, 0.30, 0.52, 0.70, 0.50);
  fractureLine(ctx, 0.32, 0.68, 0.68, 0.66);

  // Magma veins — twin spines
  magmaVein(ctx, 0.44, 0.14, 0.42, 0.76, accent, 0.004);
  magmaVein(ctx, 0.56, 0.14, 0.58, 0.76, accent, 0.004);

  // Cross veins at plate boundaries
  magmaVein(ctx, 0.38, 0.35, 0.62, 0.35, accent, 0.003);
  magmaVein(ctx, 0.36, 0.51, 0.64, 0.51, accent, 0.003);

  // Magma vent bulges — flanking pentagonal shapes
  ctx.beginPath();
  ctx.moveTo(0.28, 0.38); ctx.lineTo(0.22, 0.42);
  ctx.lineTo(0.22, 0.50); ctx.lineTo(0.28, 0.54);
  ctx.lineTo(0.30, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.15);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.72, 0.38); ctx.lineTo(0.78, 0.42);
  ctx.lineTo(0.78, 0.50); ctx.lineTo(0.72, 0.54);
  ctx.lineTo(0.70, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.15);
  ctx.fill();

  // Caldera sensor
  calderaGlow(ctx, 0.50, 0.12, 0.022);

  // Twin engines
  magmaEngineGlow(ctx, 0.42, 0.82, 0.030);
  magmaEngineGlow(ctx, 0.58, 0.82, 0.030);
}


// ── TRANSPORT — Tectonic Barge ──────────────────────────────────────────────
// A wide, squat vessel like a slab of continental crust set adrift. Heavy
// armour plating in horizontal strata. The broadest Pyrenth hull — built
// to carry geological cargo (mineral specimens, terraforming materials)
// through the void. Twin engines flanking a broad stern.

export function pyrenthTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad rectangular slab with angled prow
  ctx.beginPath();
  ctx.moveTo(0.50, 0.10);   // prow point
  ctx.lineTo(0.34, 0.18);   // left prow shoulder
  ctx.lineTo(0.24, 0.28);   // left upper hull
  ctx.lineTo(0.22, 0.72);   // left lower hull
  ctx.lineTo(0.28, 0.84);   // left engine flange
  ctx.lineTo(0.72, 0.84);   // right engine flange
  ctx.lineTo(0.78, 0.72);   // right lower hull
  ctx.lineTo(0.76, 0.28);   // right upper hull
  ctx.lineTo(0.66, 0.18);   // right prow shoulder
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Horizontal strata lines — geological layering
  fractureLine(ctx, 0.24, 0.32, 0.76, 0.32);
  fractureLine(ctx, 0.22, 0.44, 0.78, 0.44);
  fractureLine(ctx, 0.22, 0.56, 0.78, 0.56);
  fractureLine(ctx, 0.22, 0.68, 0.78, 0.68);

  // Central magma vein — spine
  magmaVein(ctx, 0.50, 0.16, 0.50, 0.80, accent, 0.005);

  // Cargo bay indicators — darker rectangular insets
  ctx.fillStyle = 'rgba(5,3,2,0.5)';
  ctx.fillRect(0.30, 0.34, 0.16, 0.08);
  ctx.fillRect(0.54, 0.34, 0.16, 0.08);
  ctx.fillRect(0.30, 0.46, 0.16, 0.08);
  ctx.fillRect(0.54, 0.46, 0.16, 0.08);
  ctx.fillRect(0.30, 0.58, 0.16, 0.08);
  ctx.fillRect(0.54, 0.58, 0.16, 0.08);

  // Caldera sensor
  calderaGlow(ctx, 0.50, 0.15, 0.024);

  // Twin engines
  magmaEngineGlow(ctx, 0.38, 0.82, 0.030);
  magmaEngineGlow(ctx, 0.62, 0.82, 0.030);
}


// ── CRUISER — Volcanic Monolith ─────────────────────────────────────────────
// The iconic Pyrenth warship — a massive faceted monolith that looks like
// a volcanic mountain set flying. Diamond-shaped profile with prominent
// dorsal spine, tectonic armour plates, and weapon spires erupting from
// the hull surface like crystal formations in basalt.

export function pyrenthCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — elongated diamond with asymmetric facets
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // sharp prow
  ctx.lineTo(0.36, 0.18);   // left prow facet
  ctx.lineTo(0.24, 0.38);   // left upper broadening
  ctx.lineTo(0.22, 0.56);   // left maximum beam
  ctx.lineTo(0.26, 0.72);   // left narrowing
  ctx.lineTo(0.36, 0.84);   // left engine flange
  ctx.lineTo(0.50, 0.88);   // stern point
  ctx.lineTo(0.64, 0.84);   // right engine flange
  ctx.lineTo(0.74, 0.72);   // right narrowing
  ctx.lineTo(0.78, 0.56);   // right maximum beam
  ctx.lineTo(0.76, 0.38);   // right upper broadening
  ctx.lineTo(0.64, 0.18);   // right prow facet
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Tectonic plate fractures
  fractureLine(ctx, 0.32, 0.28, 0.68, 0.26);
  fractureLine(ctx, 0.24, 0.46, 0.76, 0.44);
  fractureLine(ctx, 0.24, 0.62, 0.76, 0.60);
  fractureLine(ctx, 0.30, 0.76, 0.70, 0.74);

  // Dorsal magma spine — triple vein
  magmaVein(ctx, 0.50, 0.10, 0.50, 0.84, accent, 0.005);
  magmaVein(ctx, 0.46, 0.22, 0.44, 0.78, accent, 0.003);
  magmaVein(ctx, 0.54, 0.22, 0.56, 0.78, accent, 0.003);

  // Weapon spire positions — accent triangles
  const spires: [number, number][] = [
    [0.30, 0.34], [0.70, 0.32],
    [0.26, 0.54], [0.74, 0.52],
  ];
  for (const [sx, sy] of spires) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - 0.04);
    ctx.lineTo(sx - 0.025, sy + 0.025);
    ctx.lineTo(sx + 0.025, sy + 0.025);
    ctx.closePath();
    ctx.fillStyle = withAlpha(accent, 0.35);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Caldera sensor — larger for cruiser class
  calderaGlow(ctx, 0.50, 0.14, 0.030);

  // Twin engines
  magmaEngineGlow(ctx, 0.42, 0.86, 0.032);
  magmaEngineGlow(ctx, 0.58, 0.86, 0.032);
}


// ── CARRIER — Caldera Platform ──────────────────────────────────────────────
// A broad, flat volcanic platform — like the summit of a shield volcano
// sliced off and hollowed out. The flight deck is a series of hexagonal
// launch calderas from which fighters erupt like volcanic ejecta. The
// widest Pyrenth hull, low-profile, with distributed engine clusters.

export function pyrenthCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad hexagonal platform
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // prow
  ctx.lineTo(0.30, 0.16);   // left prow shoulder
  ctx.lineTo(0.16, 0.32);   // left forward flank
  ctx.lineTo(0.14, 0.58);   // left midship
  ctx.lineTo(0.18, 0.76);   // left aft flank
  ctx.lineTo(0.32, 0.88);   // left engine mount
  ctx.lineTo(0.68, 0.88);   // right engine mount
  ctx.lineTo(0.82, 0.76);   // right aft flank
  ctx.lineTo(0.86, 0.58);   // right midship
  ctx.lineTo(0.84, 0.32);   // right forward flank
  ctx.lineTo(0.70, 0.16);   // right prow shoulder
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Launch calderas — hexagonal bays (dark insets with magma rim glow)
  const bays: [number, number][] = [
    [0.32, 0.36], [0.68, 0.36],
    [0.32, 0.54], [0.68, 0.54],
    [0.32, 0.70], [0.68, 0.70],
  ];
  for (const [bx, by] of bays) {
    // Dark bay interior
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = bx + 0.055 * Math.cos(a);
      const py = by + 0.045 * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,4,2,0.7)';
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.35);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Central spine vein
  magmaVein(ctx, 0.50, 0.12, 0.50, 0.84, accent, 0.005);

  // Cross-vein at midship
  magmaVein(ctx, 0.20, 0.52, 0.80, 0.52, accent, 0.003);

  // Tectonic fractures
  fractureLine(ctx, 0.22, 0.30, 0.78, 0.28);
  fractureLine(ctx, 0.18, 0.64, 0.82, 0.62);

  // Caldera command — centre-forward
  calderaGlow(ctx, 0.50, 0.14, 0.028);

  // Triple engine cluster
  magmaEngineGlow(ctx, 0.38, 0.86, 0.030);
  magmaEngineGlow(ctx, 0.50, 0.88, 0.026);
  magmaEngineGlow(ctx, 0.62, 0.86, 0.030);
}


// ── BATTLESHIP — Tectonic Fortress ──────────────────────────────────────────
// The ultimate Pyrenth war machine — an entire geological formation set
// loose in space. Massive layered armour plates, a prominent dorsal magma
// ridge, weapon spires erupting from every surface, and a full cluster of
// basalt column engines at the stern. This ship looks like a volcanic island
// that decided to go to war. The silhouette should be unmistakable: heavy,
// angular, bristling with crystalline growths, and glowing with inner heat.

export function pyrenthBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — massive faceted fortress
  ctx.beginPath();
  ctx.moveTo(0.50, 0.04);   // prow apex
  ctx.lineTo(0.34, 0.12);   // left prow facet
  ctx.lineTo(0.20, 0.28);   // left forward armour
  ctx.lineTo(0.14, 0.48);   // left broadest point
  ctx.lineTo(0.16, 0.68);   // left narrowing
  ctx.lineTo(0.24, 0.80);   // left aft armour
  ctx.lineTo(0.36, 0.90);   // left engine block
  ctx.lineTo(0.64, 0.90);   // right engine block
  ctx.lineTo(0.76, 0.80);   // right aft armour
  ctx.lineTo(0.84, 0.68);   // right narrowing
  ctx.lineTo(0.86, 0.48);   // right broadest point
  ctx.lineTo(0.80, 0.28);   // right forward armour
  ctx.lineTo(0.66, 0.12);   // right prow facet
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Heavy tectonic plate fractures
  fractureLine(ctx, 0.26, 0.24, 0.74, 0.22);
  fractureLine(ctx, 0.18, 0.38, 0.82, 0.36);
  fractureLine(ctx, 0.16, 0.54, 0.84, 0.52);
  fractureLine(ctx, 0.18, 0.68, 0.82, 0.66);
  fractureLine(ctx, 0.26, 0.80, 0.74, 0.78);

  // Dorsal magma ridge — triple spine with cross connections
  magmaVein(ctx, 0.50, 0.08, 0.50, 0.86, accent, 0.006);
  magmaVein(ctx, 0.44, 0.18, 0.40, 0.82, accent, 0.004);
  magmaVein(ctx, 0.56, 0.18, 0.60, 0.82, accent, 0.004);
  // Cross veins at plate boundaries
  magmaVein(ctx, 0.30, 0.37, 0.70, 0.37, accent, 0.003);
  magmaVein(ctx, 0.24, 0.53, 0.76, 0.53, accent, 0.003);
  magmaVein(ctx, 0.28, 0.67, 0.72, 0.67, accent, 0.003);

  // Weapon spires — triangular eruptions from hull surface
  const spires: [number, number][] = [
    [0.28, 0.30], [0.72, 0.28],
    [0.18, 0.48], [0.82, 0.46],
    [0.20, 0.64], [0.80, 0.62],
    [0.30, 0.76], [0.70, 0.74],
  ];
  for (const [sx, sy] of spires) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - 0.035);
    ctx.lineTo(sx - 0.022, sy + 0.02);
    ctx.lineTo(sx + 0.022, sy + 0.02);
    ctx.closePath();
    ctx.fillStyle = withAlpha(accent, 0.35);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.55);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Caldera command dome — prominent, forward
  calderaGlow(ctx, 0.50, 0.12, 0.035);
  // Secondary caldera — aft command
  calderaGlow(ctx, 0.50, 0.74, 0.022);

  // Triple engine cluster
  magmaEngineGlow(ctx, 0.40, 0.88, 0.034);
  magmaEngineGlow(ctx, 0.50, 0.90, 0.030);
  magmaEngineGlow(ctx, 0.60, 0.88, 0.034);
}


// ── COLONISER — World Forge Ark ─────────────────────────────────────────────
// The sacred vessel of the Pyrenth — a mobile fragment of Pyrenthos itself,
// carrying geological samples, mineral seedstock, and the knowledge to
// terraform a new world into the Perfect Forge. Shaped like an elongated
// geode: a rough exterior shell concealing a precious interior. Wider than
// a cruiser but more elongated, with habitat strata visible as glowing
// horizontal bands (the colonists within, suspended in their mineral
// hibernation matrices).

export function pyrenthColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — elongated geode shape with faceted exterior
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // prow
  ctx.lineTo(0.36, 0.14);   // left prow facet
  ctx.lineTo(0.26, 0.26);   // left upper hull
  ctx.lineTo(0.22, 0.44);   // left widening
  ctx.lineTo(0.20, 0.58);   // left maximum beam
  ctx.lineTo(0.22, 0.70);   // left narrowing
  ctx.lineTo(0.28, 0.80);   // left aft hull
  ctx.lineTo(0.38, 0.88);   // left engine
  ctx.lineTo(0.62, 0.88);   // right engine
  ctx.lineTo(0.72, 0.80);   // right aft hull
  ctx.lineTo(0.78, 0.70);   // right narrowing
  ctx.lineTo(0.80, 0.58);   // right maximum beam
  ctx.lineTo(0.78, 0.44);   // right widening
  ctx.lineTo(0.74, 0.26);   // right upper hull
  ctx.lineTo(0.64, 0.14);   // right prow facet
  ctx.closePath();
  pyrenthFill(ctx, accent);

  // Geological strata fractures
  fractureLine(ctx, 0.30, 0.24, 0.70, 0.22);
  fractureLine(ctx, 0.24, 0.38, 0.76, 0.36);
  fractureLine(ctx, 0.22, 0.52, 0.78, 0.50);
  fractureLine(ctx, 0.22, 0.64, 0.78, 0.62);
  fractureLine(ctx, 0.28, 0.76, 0.72, 0.74);

  // Habitat strata — glowing bands between fracture lines
  // (colonists in mineral hibernation matrices)
  const strataY = [0.30, 0.44, 0.58];
  for (const sy of strataY) {
    ctx.beginPath();
    ctx.rect(0.30, sy, 0.40, 0.025);
    const sg = ctx.createLinearGradient(0.30, sy, 0.70, sy);
    sg.addColorStop(0,   withAlpha(accent, 0.2));
    sg.addColorStop(0.5, withAlpha(accent, 0.45));
    sg.addColorStop(1,   withAlpha(accent, 0.2));
    ctx.fillStyle = sg;
    ctx.fill();
  }

  // Central magma spine
  magmaVein(ctx, 0.50, 0.12, 0.50, 0.84, accent, 0.005);

  // Flanking veins
  magmaVein(ctx, 0.46, 0.20, 0.42, 0.80, accent, 0.003);
  magmaVein(ctx, 0.54, 0.20, 0.58, 0.80, accent, 0.003);

  // Caldera sensor — bow
  calderaGlow(ctx, 0.50, 0.13, 0.028);

  // Twin engines
  magmaEngineGlow(ctx, 0.44, 0.86, 0.030);
  magmaEngineGlow(ctx, 0.56, 0.86, 0.030);
}
