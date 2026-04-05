import { withAlpha } from '../shipWireframeHelpers';

function orivaniEngineGlow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  // Outer bloom — warm gold haze
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  bloom.addColorStop(0,   'rgba(255,200,100,0.55)');
  bloom.addColorStop(0.4, 'rgba(255,170,50,0.3)');
  bloom.addColorStop(1,   'rgba(200,120,20,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-hot liturgical fire
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,245,220,1)');
  core.addColorStop(0.35, 'rgba(255,190,80,0.9)');
  core.addColorStop(1,   'rgba(220,140,40,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Ivory-gold hull fill with accent trim — theocratic temple stone. */
function orivaniFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.1, 0.7, 0.9);
  grad.addColorStop(0,   '#e8dcc8');   // warm ivory highlight
  grad.addColorStop(0.3, '#d4c4a8');   // temple stone midtone
  grad.addColorStop(0.7, '#bfad8e');   // aged sanctified stone
  grad.addColorStop(1,   '#a89470');   // shadowed base
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.008;
  ctx.stroke();
}

/** Stained-glass viewport — warm golden light strip. */
function orivaniViewport(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0,   'rgba(255,210,120,0.75)');
  g.addColorStop(0.5, 'rgba(255,180,60,0.9)');
  g.addColorStop(1,   'rgba(220,150,40,0.7)');
  ctx.fillStyle = g;
  ctx.fill();
}

/** Dorsal spire accent — small upward-pointing triangle on the hull. */
function orivaniSpire(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number,
  halfW: number, tipH: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, baseY - tipH);
  ctx.lineTo(cx - halfW, baseY);
  ctx.lineTo(cx + halfW, baseY);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.45);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.65);
  ctx.lineWidth = 0.004;
  ctx.stroke();
}

/** Buttress arc — curved line from hull edge outward. */
function orivaniButtress(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  cpx: number, cpy: number,
  x2: number, y2: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

// ── The seven wireframe functions ────────────────────────────────────────

/**
 * SCOUT — "Pilgrim Lance"
 * Narrow blade with a single dorsal spire. The smallest expression of
 * faith: a single devotee racing ahead to scan for signs of the Coming.
 * Silhouette: narrow vertical dart with pointed nose, one spire accent.
 */
export function orivaniScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — narrow devotional blade, pointed nose
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // pointed bow tip — the lance
  ctx.lineTo(0.43, 0.22);   // shoulder taper
  ctx.lineTo(0.40, 0.48);   // narrowing mid
  ctx.lineTo(0.38, 0.72);   // wider aft
  ctx.lineTo(0.42, 0.82);   // engine housing
  ctx.lineTo(0.58, 0.82);
  ctx.lineTo(0.62, 0.72);
  ctx.lineTo(0.60, 0.48);
  ctx.lineTo(0.57, 0.22);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Dorsal spire — the prayer tower
  orivaniSpire(ctx, 0.50, 0.30, 0.025, 0.12, accent);

  // Nave accent stripe — central devotional marking
  ctx.beginPath();
  ctx.moveTo(0.47, 0.28); ctx.lineTo(0.47, 0.70);
  ctx.lineTo(0.53, 0.70); ctx.lineTo(0.53, 0.28);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.18);
  ctx.fill();

  // Stained-glass viewport
  orivaniViewport(ctx, 0.45, 0.14, 0.10, 0.02);

  // Sanctified engine
  orivaniEngineGlow(ctx, 0.50, 0.80, 0.028);
}

/**
 * DESTROYER — "Crusader's Hammer"
 * Wider hammerhead prow (the transept) with twin fore towers visible
 * as raised bumps. First ship where the cruciform shape is legible.
 * Silhouette: cross-shaped top, narrow stern with twin engines.
 */
export function orivaniDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — cruciform nave with transept wings
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // pointed prow
  ctx.lineTo(0.38, 0.16);   // shoulder
  ctx.lineTo(0.24, 0.20);   // transept wing left
  ctx.lineTo(0.22, 0.28);   // transept base left
  ctx.lineTo(0.36, 0.30);   // rejoin nave
  ctx.lineTo(0.34, 0.70);   // long nave
  ctx.lineTo(0.38, 0.84);   // engine housing
  ctx.lineTo(0.62, 0.84);
  ctx.lineTo(0.66, 0.70);
  ctx.lineTo(0.64, 0.30);
  ctx.lineTo(0.78, 0.28);
  ctx.lineTo(0.76, 0.20);
  ctx.lineTo(0.62, 0.16);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Fore tower accents (paired spires flanking the prow)
  orivaniSpire(ctx, 0.32, 0.22, 0.020, 0.08, accent);
  orivaniSpire(ctx, 0.68, 0.22, 0.020, 0.08, accent);

  // Central spire
  orivaniSpire(ctx, 0.50, 0.36, 0.022, 0.10, accent);

  // Nave panels — devotional markings
  ctx.beginPath();
  ctx.moveTo(0.41, 0.32); ctx.lineTo(0.41, 0.68);
  ctx.lineTo(0.49, 0.68); ctx.lineTo(0.49, 0.32);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.16);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.51, 0.32); ctx.lineTo(0.51, 0.68);
  ctx.lineTo(0.59, 0.68); ctx.lineTo(0.59, 0.32);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.16);
  ctx.fill();

  // Viewport
  orivaniViewport(ctx, 0.43, 0.10, 0.14, 0.02);

  // Twin sanctified engines
  orivaniEngineGlow(ctx, 0.44, 0.82, 0.026);
  orivaniEngineGlow(ctx, 0.56, 0.82, 0.026);
}

/**
 * TRANSPORT — "Covenant Ark"
 * Wide-bodied nave with heavy buttressed flanks. Cargo bay hatches
 * visible as horizontal lines. Gothic arch cockpit. Carries the
 * resources of the faithful to where they are needed most.
 * Silhouette: broad rounded rectangle with Gothic pointed top.
 */
export function orivaniTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — wide ark with Gothic pointed bow
  ctx.beginPath();
  ctx.moveTo(0.50, 0.08);   // Gothic arch peak
  ctx.lineTo(0.38, 0.15);   // arch shoulder left
  ctx.lineTo(0.28, 0.24);   // buttressed flank
  ctx.lineTo(0.24, 0.40);   // wide mid
  ctx.lineTo(0.24, 0.74);   // cargo hold
  ctx.lineTo(0.30, 0.84);   // engine taper
  ctx.lineTo(0.70, 0.84);
  ctx.lineTo(0.76, 0.74);
  ctx.lineTo(0.76, 0.40);
  ctx.lineTo(0.72, 0.24);
  ctx.lineTo(0.62, 0.15);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Cargo bay hatches — horizontal blessing-lines
  ctx.strokeStyle = 'rgba(80,60,30,0.3)';
  ctx.lineWidth = 0.005;
  for (let y = 0.34; y <= 0.72; y += 0.095) {
    ctx.beginPath();
    ctx.moveTo(0.27, y); ctx.lineTo(0.73, y);
    ctx.stroke();
  }

  // Buttress accents on flanks
  orivaniButtress(ctx, 0.28, 0.36, 0.20, 0.42, 0.28, 0.48, accent);
  orivaniButtress(ctx, 0.72, 0.36, 0.80, 0.42, 0.72, 0.48, accent);

  // Central spire
  orivaniSpire(ctx, 0.50, 0.26, 0.024, 0.10, accent);

  // Viewport
  orivaniViewport(ctx, 0.40, 0.12, 0.20, 0.02);

  // Twin engines
  orivaniEngineGlow(ctx, 0.40, 0.82, 0.028);
  orivaniEngineGlow(ctx, 0.60, 0.82, 0.028);
}

/**
 * CRUISER — "Temple Militant"
 * Full cruciform profile with flying buttress arcs visible. The first
 * ship class that truly reads as a "cathedral in space" from above.
 * Dorsal weapon turret platforms sit atop the buttress joints.
 * Silhouette: diamond hull with visible arch details and multiple spires.
 */
export function orivaniCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — diamond nave with pronounced transept
  ctx.beginPath();
  ctx.moveTo(0.50, 0.05);   // sharp prow
  ctx.lineTo(0.36, 0.16);   // shoulder
  ctx.lineTo(0.24, 0.32);   // transept emergence
  ctx.lineTo(0.20, 0.48);   // widest — cathedral breadth
  ctx.lineTo(0.22, 0.68);   // aft taper
  ctx.lineTo(0.30, 0.80);   // engine housing
  ctx.lineTo(0.50, 0.88);   // stern point
  ctx.lineTo(0.70, 0.80);
  ctx.lineTo(0.78, 0.68);
  ctx.lineTo(0.80, 0.48);
  ctx.lineTo(0.76, 0.32);
  ctx.lineTo(0.64, 0.16);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Flying buttress arcs — THE signature visual element
  orivaniButtress(ctx, 0.36, 0.30, 0.18, 0.36, 0.24, 0.42, accent);
  orivaniButtress(ctx, 0.64, 0.30, 0.82, 0.36, 0.76, 0.42, accent);
  orivaniButtress(ctx, 0.34, 0.52, 0.16, 0.58, 0.24, 0.64, accent);
  orivaniButtress(ctx, 0.66, 0.52, 0.84, 0.58, 0.76, 0.64, accent);

  // Plate segment lines
  ctx.strokeStyle = 'rgba(80,60,30,0.25)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.28, 0.35); ctx.lineTo(0.72, 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.52); ctx.lineTo(0.76, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.28, 0.68); ctx.lineTo(0.72, 0.68); ctx.stroke();

  // Weapon turret platforms on buttress joints
  ctx.fillStyle = withAlpha(accent, 0.28);
  ctx.fillRect(0.24, 0.38, 0.06, 0.06);
  ctx.fillRect(0.70, 0.38, 0.06, 0.06);

  // Triple spires — central tall, flanking shorter
  orivaniSpire(ctx, 0.50, 0.28, 0.026, 0.14, accent);
  orivaniSpire(ctx, 0.38, 0.34, 0.018, 0.08, accent);
  orivaniSpire(ctx, 0.62, 0.34, 0.018, 0.08, accent);

  // Rose window at bow
  ctx.beginPath();
  ctx.arc(0.50, 0.14, 0.035, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.50, 0.14, 0.018, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,200,80,0.5)';
  ctx.fill();

  // Viewport
  orivaniViewport(ctx, 0.42, 0.09, 0.16, 0.02);

  // Twin engines
  orivaniEngineGlow(ctx, 0.40, 0.86, 0.030);
  orivaniEngineGlow(ctx, 0.60, 0.86, 0.030);
}

/**
 * CARRIER — "Reliquary Bastion"
 * Massive flat-decked cathedral with launch bays arrayed like chapel
 * niches along the flanks. Central command spire rises high. Launch bays
 * are dark recesses flanking a central nave corridor lit with gold.
 * Silhouette: broad rectangle with Gothic top, bay recesses, tall spire.
 */
export function orivaniCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — broad basilica
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // Gothic arch peak
  ctx.lineTo(0.32, 0.14);   // arch shoulder
  ctx.lineTo(0.18, 0.26);   // wide flank
  ctx.lineTo(0.14, 0.48);   // broadest
  ctx.lineTo(0.16, 0.72);   // aft
  ctx.lineTo(0.24, 0.84);   // engine housing
  ctx.lineTo(0.76, 0.84);
  ctx.lineTo(0.84, 0.72);
  ctx.lineTo(0.86, 0.48);
  ctx.lineTo(0.82, 0.26);
  ctx.lineTo(0.68, 0.14);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Launch bays — dark chapel niches along the flanks
  ctx.fillStyle = 'rgba(15,10,5,0.55)';
  ctx.fillRect(0.20, 0.34, 0.14, 0.055);
  ctx.fillRect(0.66, 0.34, 0.14, 0.055);
  ctx.fillRect(0.20, 0.46, 0.14, 0.055);
  ctx.fillRect(0.66, 0.46, 0.14, 0.055);
  ctx.fillRect(0.20, 0.58, 0.14, 0.055);
  ctx.fillRect(0.66, 0.58, 0.14, 0.055);

  // Central nave corridor — lit with devotional gold
  ctx.beginPath();
  ctx.moveTo(0.45, 0.20); ctx.lineTo(0.45, 0.78);
  ctx.lineTo(0.55, 0.78); ctx.lineTo(0.55, 0.20);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.16);
  ctx.fill();

  // Flying buttress arcs connecting flanks to nave
  orivaniButtress(ctx, 0.38, 0.36, 0.24, 0.40, 0.20, 0.44, accent);
  orivaniButtress(ctx, 0.62, 0.36, 0.76, 0.40, 0.80, 0.44, accent);
  orivaniButtress(ctx, 0.38, 0.56, 0.24, 0.60, 0.20, 0.64, accent);
  orivaniButtress(ctx, 0.62, 0.56, 0.76, 0.60, 0.80, 0.64, accent);

  // Command spire — tall central tower
  orivaniSpire(ctx, 0.50, 0.24, 0.030, 0.16, accent);

  // Flanking pinnacles
  orivaniSpire(ctx, 0.30, 0.30, 0.016, 0.06, accent);
  orivaniSpire(ctx, 0.70, 0.30, 0.016, 0.06, accent);

  // Viewport
  orivaniViewport(ctx, 0.40, 0.10, 0.20, 0.02);

  // Triple sanctified engines
  orivaniEngineGlow(ctx, 0.34, 0.82, 0.028);
  orivaniEngineGlow(ctx, 0.50, 0.84, 0.024);
  orivaniEngineGlow(ctx, 0.66, 0.82, 0.028);
}

/**
 * BATTLESHIP — "Grand Cathedral"
 * The full expression of Orivani faith in warship form. Massive layered
 * hull with multiple buttress tiers, bell tower silhouettes, six weapon
 * turret platforms, and a forest of spires. When this arrives in battle,
 * every species knows who sent it.
 * Silhouette: enormous diamond with layered plates, arches, and spires.
 */
export function orivaniBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — grand cathedral fortress
  ctx.beginPath();
  ctx.moveTo(0.50, 0.03);   // sharp sacred prow
  ctx.lineTo(0.34, 0.12);   // arch shoulder
  ctx.lineTo(0.20, 0.26);   // transept breadth
  ctx.lineTo(0.14, 0.46);   // widest — full cathedral span
  ctx.lineTo(0.16, 0.66);   // aft narrowing
  ctx.lineTo(0.24, 0.80);   // engine housing
  ctx.lineTo(0.36, 0.90);   // stern
  ctx.lineTo(0.64, 0.90);
  ctx.lineTo(0.76, 0.80);
  ctx.lineTo(0.84, 0.66);
  ctx.lineTo(0.86, 0.46);
  ctx.lineTo(0.80, 0.26);
  ctx.lineTo(0.66, 0.12);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Layered plate lines — cathedral stonework courses
  ctx.strokeStyle = 'rgba(80,60,30,0.25)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.26, 0.24); ctx.lineTo(0.74, 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.20, 0.38); ctx.lineTo(0.80, 0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.18, 0.52); ctx.lineTo(0.82, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.20, 0.66); ctx.lineTo(0.80, 0.66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.78); ctx.lineTo(0.74, 0.78); ctx.stroke();

  // Flying buttress arcs — two tiers
  orivaniButtress(ctx, 0.38, 0.28, 0.18, 0.34, 0.20, 0.40, accent);
  orivaniButtress(ctx, 0.62, 0.28, 0.82, 0.34, 0.80, 0.40, accent);
  orivaniButtress(ctx, 0.36, 0.50, 0.14, 0.56, 0.18, 0.62, accent);
  orivaniButtress(ctx, 0.64, 0.50, 0.86, 0.56, 0.82, 0.62, accent);

  // Weapon turret platforms — six positions, integrated into architecture
  const turrets: [number, number][] = [
    [0.26, 0.30], [0.74, 0.30],  // forward turrets
    [0.18, 0.48], [0.82, 0.48],  // midship turrets
    [0.24, 0.64], [0.76, 0.64],  // aft turrets
  ];
  for (const [tx, ty] of turrets) {
    ctx.beginPath();
    ctx.rect(tx - 0.03, ty - 0.03, 0.06, 0.06);
    ctx.fillStyle = withAlpha(accent, 0.28);
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.5);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Forest of spires — central grand spire + flanking minor spires
  orivaniSpire(ctx, 0.50, 0.22, 0.032, 0.18, accent);
  orivaniSpire(ctx, 0.40, 0.28, 0.020, 0.10, accent);
  orivaniSpire(ctx, 0.60, 0.28, 0.020, 0.10, accent);
  // Bell tower spires at stern
  orivaniSpire(ctx, 0.34, 0.74, 0.018, 0.08, accent);
  orivaniSpire(ctx, 0.66, 0.74, 0.018, 0.08, accent);

  // Rose window at bow — larger than cruiser
  ctx.beginPath();
  ctx.arc(0.50, 0.11, 0.042, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.006;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.50, 0.11, 0.022, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,200,80,0.55)';
  ctx.fill();

  // Grand viewport
  orivaniViewport(ctx, 0.38, 0.07, 0.24, 0.02);

  // Triple sanctified engines
  orivaniEngineGlow(ctx, 0.36, 0.88, 0.032);
  orivaniEngineGlow(ctx, 0.50, 0.90, 0.028);
  orivaniEngineGlow(ctx, 0.64, 0.88, 0.032);
}

/**
 * COLONISER — "Ark of the Covenant"
 * Sacred vessel bearing the faithful to new worlds. Heavy protective hull
 * with habitat window strips glowing with the warmth of settlements within.
 * Multiple buttress arcs and a prominent command spire. The most precious
 * ship in the fleet — to lose a coloniser is to betray the Coming.
 * Silhouette: rounded Gothic arch hull with window strips, buttresses, spires.
 */
export function orivaniColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Main hull — protective ark, Gothic arch shape
  ctx.beginPath();
  ctx.moveTo(0.50, 0.06);   // Gothic arch peak
  ctx.lineTo(0.36, 0.14);   // arch shoulder
  ctx.lineTo(0.26, 0.26);   // protective flank
  ctx.lineTo(0.22, 0.46);   // widest — sanctuary breadth
  ctx.lineTo(0.24, 0.66);   // aft taper
  ctx.lineTo(0.30, 0.78);   // engine housing
  ctx.lineTo(0.40, 0.88);   // stern
  ctx.lineTo(0.60, 0.88);
  ctx.lineTo(0.70, 0.78);
  ctx.lineTo(0.76, 0.66);
  ctx.lineTo(0.78, 0.46);
  ctx.lineTo(0.74, 0.26);
  ctx.lineTo(0.64, 0.14);
  ctx.closePath();
  orivaniFill(ctx, accent);

  // Armour shell plating — protective courses
  ctx.strokeStyle = 'rgba(80,60,30,0.22)';
  ctx.lineWidth = 0.004;
  ctx.beginPath(); ctx.moveTo(0.30, 0.24); ctx.lineTo(0.70, 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.38); ctx.lineTo(0.74, 0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.24, 0.52); ctx.lineTo(0.76, 0.52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.26, 0.66); ctx.lineTo(0.74, 0.66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.30, 0.78); ctx.lineTo(0.70, 0.78); ctx.stroke();

  // Habitat window strips — warm light of the faithful within
  orivaniViewport(ctx, 0.32, 0.30, 0.36, 0.018);
  orivaniViewport(ctx, 0.30, 0.44, 0.40, 0.018);
  orivaniViewport(ctx, 0.32, 0.58, 0.36, 0.018);

  // Flying buttress arcs — protecting the sacred cargo
  orivaniButtress(ctx, 0.36, 0.30, 0.20, 0.36, 0.26, 0.42, accent);
  orivaniButtress(ctx, 0.64, 0.30, 0.80, 0.36, 0.74, 0.42, accent);
  orivaniButtress(ctx, 0.34, 0.54, 0.18, 0.60, 0.26, 0.66, accent);
  orivaniButtress(ctx, 0.66, 0.54, 0.82, 0.60, 0.74, 0.66, accent);

  // Command spire — the shepherd's tower
  orivaniSpire(ctx, 0.50, 0.22, 0.028, 0.14, accent);
  // Flanking devotional spires
  orivaniSpire(ctx, 0.38, 0.28, 0.016, 0.07, accent);
  orivaniSpire(ctx, 0.62, 0.28, 0.016, 0.07, accent);

  // Top viewport
  orivaniViewport(ctx, 0.40, 0.10, 0.20, 0.02);

  // Twin sanctified engines
  orivaniEngineGlow(ctx, 0.44, 0.86, 0.030);
  orivaniEngineGlow(ctx, 0.56, 0.86, 0.030);
}
