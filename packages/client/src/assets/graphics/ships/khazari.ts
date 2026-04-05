import { withAlpha } from '../shipWireframeHelpers';

function khazariEngineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  // Outer bloom — wide, smoky orange
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  bloom.addColorStop(0,   'rgba(255,160,50,0.65)');
  bloom.addColorStop(0.3, 'rgba(255,120,20,0.4)');
  bloom.addColorStop(0.6, 'rgba(200,60,10,0.15)');
  bloom.addColorStop(1,   'rgba(120,20,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = bloom;
  ctx.fill();
  // Inner core — white-hot centre
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0,   'rgba(255,245,210,1)');
  core.addColorStop(0.3, 'rgba(255,180,60,0.9)');
  core.addColorStop(0.7, 'rgba(255,100,20,0.5)');
  core.addColorStop(1,   'rgba(180,40,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Dark iron hull fill with forge-brown gradient — distinctly different from generic angular. */
function khazariFill(ctx: CanvasRenderingContext2D, accent: string): void {
  const grad = ctx.createLinearGradient(0.3, 0.05, 0.7, 0.95);
  grad.addColorStop(0,   '#5a4a38');  // lighter iron-brown at fore
  grad.addColorStop(0.3, '#443828');  // mid-tone forged iron
  grad.addColorStop(0.7, '#352a1e');  // darker towards engines
  grad.addColorStop(1,   '#2a2018');  // near-black at stern
  ctx.fillStyle = grad;
  ctx.fill();
  // Accent edge line — amber forge glow at hull boundaries
  ctx.strokeStyle = withAlpha(accent, 0.35);
  ctx.lineWidth = 0.007;
  ctx.stroke();
}

/** Forge-seam panel line — horizontal heat channel across the hull. */
function forgeSeam(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, accent: string): void {
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.strokeStyle = withAlpha(accent, 0.18);
  ctx.lineWidth = 0.004;
  ctx.stroke();
  // Subtle amber glow along seam
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.strokeStyle = 'rgba(255,140,40,0.08)';
  ctx.lineWidth = 0.012;
  ctx.stroke();
}

/** Dorsal crest line — the signature Khazari spine ridge. */
function dorsalCrest(ctx: CanvasRenderingContext2D, yStart: number, yEnd: number, accent: string): void {
  ctx.beginPath();
  ctx.moveTo(0.50, yStart);
  ctx.lineTo(0.50, yEnd);
  ctx.strokeStyle = withAlpha(accent, 0.5);
  ctx.lineWidth = 0.012;
  ctx.stroke();
  // Fainter glow alongside
  ctx.beginPath();
  ctx.moveTo(0.50, yStart);
  ctx.lineTo(0.50, yEnd);
  ctx.strokeStyle = 'rgba(255,140,40,0.12)';
  ctx.lineWidth = 0.025;
  ctx.stroke();
}

/** Weapon turret — octagonal platform with stubby barrel. */
function turretMount(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  size: number, barrelLen: number, accent: string,
): void {
  // Octagonal base
  ctx.beginPath();
  const sides = 8;
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fillStyle = withAlpha(accent, 0.3);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.55);
  ctx.lineWidth = 0.003;
  ctx.stroke();
  // Barrel — stubby line pointing fore (upward)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - barrelLen);
  ctx.strokeStyle = withAlpha(accent, 0.6);
  ctx.lineWidth = 0.006;
  ctx.stroke();
}

/** Ram prow tip — the pointed diamond at the nose of every Khazari ship. */
function ramProw(
  ctx: CanvasRenderingContext2D,
  tipX: number, tipY: number,
  leftX: number, rightX: number, baseY: number,
  accent: string,
): void {
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(rightX, baseY);
  ctx.lineTo(leftX, baseY);
  ctx.closePath();
  // Darker iron for the ram
  const ramGrad = ctx.createLinearGradient(tipX, tipY, tipX, baseY);
  ramGrad.addColorStop(0, '#6a5840');
  ramGrad.addColorStop(1, '#443828');
  ctx.fillStyle = ramGrad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.005;
  ctx.stroke();
  // Heat channels on the ram
  ctx.beginPath();
  ctx.moveTo(tipX, tipY + 0.01);
  ctx.lineTo(tipX, baseY - 0.01);
  ctx.strokeStyle = 'rgba(255,120,30,0.15)';
  ctx.lineWidth = 0.003;
  ctx.stroke();
}


// ── Ship wireframe functions ─────────────────────────────────────────────────

/**
 * SCOUT — "Forge Dart"
 * The smallest Khazari hull: a single forged blade with ram prow.
 * Narrow, fast, aggressive. A thrown dagger from the forge.
 */
export function khazariScout(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ram prow — sharp diamond point
  ramProw(ctx, 0.50, 0.06, 0.44, 0.56, 0.18, accent);

  // Main hull — narrow trapezoid (wider at stern)
  ctx.beginPath();
  ctx.moveTo(0.44, 0.18);    // fore-left (narrower)
  ctx.lineTo(0.40, 0.38);    // mid-left widens
  ctx.lineTo(0.38, 0.72);    // aft section
  ctx.lineTo(0.42, 0.82);    // engine housing left
  ctx.lineTo(0.58, 0.82);    // engine housing right
  ctx.lineTo(0.62, 0.72);    // aft section
  ctx.lineTo(0.60, 0.38);    // mid-right
  ctx.lineTo(0.56, 0.18);    // fore-right (narrower)
  ctx.closePath();
  khazariFill(ctx, accent);

  // Dorsal crest
  dorsalCrest(ctx, 0.20, 0.70, accent);

  // Forge seams
  forgeSeam(ctx, 0.40, 0.40, 0.60, accent);
  forgeSeam(ctx, 0.39, 0.58, 0.61, accent);

  // Viewport slit — amber glow
  ctx.beginPath();
  ctx.rect(0.46, 0.20, 0.08, 0.015);
  const vpGrad = ctx.createLinearGradient(0.46, 0.20, 0.54, 0.20);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Twin engines
  khazariEngineGlow(ctx, 0.46, 0.81, 0.025);
  khazariEngineGlow(ctx, 0.54, 0.81, 0.025);
}


/**
 * DESTROYER — "Forge Hammer"
 * The workhorse warship. Heavier than the scout with visible side armour
 * plates, a pronounced dorsal crest, and a forward turret. The hammerhead
 * cross-strakes give it a broader, more threatening profile.
 */
export function khazariDestroyer(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ram prow
  ramProw(ctx, 0.50, 0.06, 0.42, 0.58, 0.16, accent);

  // Main hull — wider trapezoid
  ctx.beginPath();
  ctx.moveTo(0.42, 0.16);
  ctx.lineTo(0.36, 0.24);
  ctx.lineTo(0.32, 0.50);
  ctx.lineTo(0.34, 0.72);
  ctx.lineTo(0.38, 0.82);
  ctx.lineTo(0.62, 0.82);
  ctx.lineTo(0.66, 0.72);
  ctx.lineTo(0.68, 0.50);
  ctx.lineTo(0.64, 0.24);
  ctx.lineTo(0.58, 0.16);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Side armour plates — overlapping strakes
  ctx.beginPath();
  ctx.moveTo(0.32, 0.28);
  ctx.lineTo(0.24, 0.30);
  ctx.lineTo(0.22, 0.44);
  ctx.lineTo(0.30, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.68, 0.28);
  ctx.lineTo(0.76, 0.30);
  ctx.lineTo(0.78, 0.44);
  ctx.lineTo(0.70, 0.46);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest
  dorsalCrest(ctx, 0.18, 0.72, accent);

  // Forge seams
  forgeSeam(ctx, 0.34, 0.35, 0.66, accent);
  forgeSeam(ctx, 0.33, 0.52, 0.67, accent);
  forgeSeam(ctx, 0.35, 0.68, 0.65, accent);

  // Forward turret
  turretMount(ctx, 0.50, 0.28, 0.025, 0.06, accent);

  // Viewport slit
  ctx.beginPath();
  ctx.rect(0.44, 0.12, 0.12, 0.018);
  const vpGrad = ctx.createLinearGradient(0.44, 0.12, 0.56, 0.12);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Quad engines
  khazariEngineGlow(ctx, 0.42, 0.81, 0.024);
  khazariEngineGlow(ctx, 0.50, 0.82, 0.020);
  khazariEngineGlow(ctx, 0.58, 0.81, 0.024);
}


/**
 * TRANSPORT — "Forge Barge"
 * Heavy cargo hauler. Wide, squat, and armoured like a mobile vault.
 * The trapezoidal cross-section is most pronounced here — a flying
 * strongbox with visible cargo bay seams and reinforced hull plates.
 */
export function khazariTransport(ctx: CanvasRenderingContext2D, accent: string): void {
  // Blunt prow — transports have a shorter, stubbier ram
  ramProw(ctx, 0.50, 0.10, 0.40, 0.60, 0.18, accent);

  // Main hull — wide, blocky trapezoid
  ctx.beginPath();
  ctx.moveTo(0.40, 0.18);
  ctx.lineTo(0.28, 0.24);
  ctx.lineTo(0.24, 0.44);
  ctx.lineTo(0.24, 0.72);
  ctx.lineTo(0.30, 0.84);
  ctx.lineTo(0.70, 0.84);
  ctx.lineTo(0.76, 0.72);
  ctx.lineTo(0.76, 0.44);
  ctx.lineTo(0.72, 0.24);
  ctx.lineTo(0.60, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Cargo bay dividers — heavy horizontal seams
  for (let y = 0.32; y <= 0.68; y += 0.09) {
    forgeSeam(ctx, 0.26, y, 0.74, accent);
  }

  // Side armour strakes
  ctx.beginPath();
  ctx.moveTo(0.24, 0.30);
  ctx.lineTo(0.18, 0.34);
  ctx.lineTo(0.18, 0.68);
  ctx.lineTo(0.24, 0.70);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.1);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.76, 0.30);
  ctx.lineTo(0.82, 0.34);
  ctx.lineTo(0.82, 0.68);
  ctx.lineTo(0.76, 0.70);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.1);
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest (shorter on transports — less aggressive)
  dorsalCrest(ctx, 0.22, 0.55, accent);

  // Viewport slit
  ctx.beginPath();
  ctx.rect(0.42, 0.14, 0.16, 0.018);
  const vpGrad = ctx.createLinearGradient(0.42, 0.14, 0.58, 0.14);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Twin wide engines
  khazariEngineGlow(ctx, 0.40, 0.83, 0.030);
  khazariEngineGlow(ctx, 0.60, 0.83, 0.030);
}


/**
 * CRUISER — "Forge Anvil"
 * The backbone of the Khazari fleet. Heavily armed with multiple turrets,
 * pronounced dorsal crest, reinforced keel, and visible sponson bulges.
 * The silhouette is a broad, angular diamond tapering to the ram prow.
 */
export function khazariCruiser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Heavy ram prow
  ramProw(ctx, 0.50, 0.06, 0.38, 0.62, 0.18, accent);

  // Main hull — broad angular diamond
  ctx.beginPath();
  ctx.moveTo(0.38, 0.18);
  ctx.lineTo(0.28, 0.28);
  ctx.lineTo(0.22, 0.46);
  ctx.lineTo(0.24, 0.66);
  ctx.lineTo(0.32, 0.80);
  ctx.lineTo(0.50, 0.88);
  ctx.lineTo(0.68, 0.80);
  ctx.lineTo(0.76, 0.66);
  ctx.lineTo(0.78, 0.46);
  ctx.lineTo(0.72, 0.28);
  ctx.lineTo(0.62, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Sponson bulges — armoured weapon platforms on flanks
  ctx.beginPath();
  ctx.moveTo(0.22, 0.38);
  ctx.lineTo(0.14, 0.42);
  ctx.lineTo(0.14, 0.56);
  ctx.lineTo(0.22, 0.58);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.78, 0.38);
  ctx.lineTo(0.86, 0.42);
  ctx.lineTo(0.86, 0.56);
  ctx.lineTo(0.78, 0.58);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest — prominent
  dorsalCrest(ctx, 0.20, 0.76, accent);

  // Forge seams
  forgeSeam(ctx, 0.26, 0.34, 0.74, accent);
  forgeSeam(ctx, 0.24, 0.50, 0.76, accent);
  forgeSeam(ctx, 0.26, 0.66, 0.74, accent);

  // Keel plate indicator — darker band at bottom
  ctx.beginPath();
  ctx.moveTo(0.30, 0.78);
  ctx.lineTo(0.70, 0.78);
  ctx.strokeStyle = withAlpha(accent, 0.25);
  ctx.lineWidth = 0.015;
  ctx.stroke();

  // Turrets — dorsal main battery and broadside mounts
  turretMount(ctx, 0.50, 0.30, 0.028, 0.065, accent);
  turretMount(ctx, 0.50, 0.55, 0.025, 0.055, accent);
  turretMount(ctx, 0.16, 0.48, 0.020, 0.045, accent);
  turretMount(ctx, 0.84, 0.48, 0.020, 0.045, accent);

  // Viewport
  ctx.beginPath();
  ctx.rect(0.42, 0.12, 0.16, 0.02);
  const vpGrad = ctx.createLinearGradient(0.42, 0.12, 0.58, 0.12);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Quad engines
  khazariEngineGlow(ctx, 0.38, 0.86, 0.028);
  khazariEngineGlow(ctx, 0.46, 0.87, 0.024);
  khazariEngineGlow(ctx, 0.54, 0.87, 0.024);
  khazariEngineGlow(ctx, 0.62, 0.86, 0.028);
}


/**
 * CARRIER — "Forge Citadel"
 * A massive flat-decked vessel with recessed launch bays on each flank.
 * Unlike generic angular carriers with side-by-side rectangles, the Khazari
 * carrier has its bays recessed into armoured sponson structures. The launch
 * openings glow amber from internal forge-light. The dorsal crest runs the
 * full length, making it look like a fortified ridge.
 */
export function khazariCarrier(ctx: CanvasRenderingContext2D, accent: string): void {
  // Ram prow — even carriers are armed
  ramProw(ctx, 0.50, 0.08, 0.36, 0.64, 0.18, accent);

  // Main hull — broad, flat deck
  ctx.beginPath();
  ctx.moveTo(0.36, 0.18);
  ctx.lineTo(0.22, 0.24);
  ctx.lineTo(0.16, 0.36);
  ctx.lineTo(0.14, 0.58);
  ctx.lineTo(0.16, 0.74);
  ctx.lineTo(0.24, 0.84);
  ctx.lineTo(0.76, 0.84);
  ctx.lineTo(0.84, 0.74);
  ctx.lineTo(0.86, 0.58);
  ctx.lineTo(0.84, 0.36);
  ctx.lineTo(0.78, 0.24);
  ctx.lineTo(0.64, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Launch bay recesses — dark amber-lit openings in sponson armour
  const bayPositions = [0.34, 0.48, 0.62];
  for (const by of bayPositions) {
    // Left bay
    ctx.beginPath();
    ctx.rect(0.17, by, 0.10, 0.05);
    const leftGlow = ctx.createLinearGradient(0.17, by, 0.27, by);
    leftGlow.addColorStop(0, 'rgba(255,120,30,0.15)');
    leftGlow.addColorStop(0.5, 'rgba(10,8,6,0.7)');
    leftGlow.addColorStop(1, 'rgba(255,120,30,0.15)');
    ctx.fillStyle = leftGlow;
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.2);
    ctx.lineWidth = 0.003;
    ctx.stroke();

    // Right bay
    ctx.beginPath();
    ctx.rect(0.73, by, 0.10, 0.05);
    const rightGlow = ctx.createLinearGradient(0.73, by, 0.83, by);
    rightGlow.addColorStop(0, 'rgba(255,120,30,0.15)');
    rightGlow.addColorStop(0.5, 'rgba(10,8,6,0.7)');
    rightGlow.addColorStop(1, 'rgba(255,120,30,0.15)');
    ctx.fillStyle = rightGlow;
    ctx.fill();
    ctx.strokeStyle = withAlpha(accent, 0.2);
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }

  // Dorsal crest — full length
  dorsalCrest(ctx, 0.20, 0.80, accent);

  // Forge seams
  forgeSeam(ctx, 0.18, 0.30, 0.82, accent);
  forgeSeam(ctx, 0.16, 0.46, 0.84, accent);
  forgeSeam(ctx, 0.16, 0.60, 0.84, accent);
  forgeSeam(ctx, 0.18, 0.74, 0.82, accent);

  // Centre command section — accent stripe
  ctx.beginPath();
  ctx.moveTo(0.46, 0.22);
  ctx.lineTo(0.46, 0.78);
  ctx.lineTo(0.54, 0.78);
  ctx.lineTo(0.54, 0.22);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, 0.12);
  ctx.fill();

  // Viewport
  ctx.beginPath();
  ctx.rect(0.40, 0.13, 0.20, 0.02);
  const vpGrad = ctx.createLinearGradient(0.40, 0.13, 0.60, 0.13);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Triple engines
  khazariEngineGlow(ctx, 0.36, 0.83, 0.032);
  khazariEngineGlow(ctx, 0.50, 0.84, 0.028);
  khazariEngineGlow(ctx, 0.64, 0.83, 0.032);
}


/**
 * BATTLESHIP — "Forge Leviathan"
 * The pride of the Khazari fleet. A massive, layered fortress bristling
 * with turrets on every surface. The dorsal crest towers above the hull.
 * Heavy broadside sponsons project from each flank. Multiple forge-seam
 * layers give the hull a laminated, damascus-steel appearance. The ram
 * prow is flanked by auxiliary rams. This ship is a declaration of war.
 */
export function khazariBattleship(ctx: CanvasRenderingContext2D, accent: string): void {
  // Auxiliary rams — flanking the main prow
  ctx.beginPath();
  ctx.moveTo(0.32, 0.18);
  ctx.lineTo(0.28, 0.12);
  ctx.lineTo(0.24, 0.18);
  ctx.closePath();
  ctx.fillStyle = '#5a4a38';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.68, 0.18);
  ctx.lineTo(0.72, 0.12);
  ctx.lineTo(0.76, 0.18);
  ctx.closePath();
  ctx.fillStyle = '#5a4a38';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Main ram prow — massive
  ramProw(ctx, 0.50, 0.04, 0.36, 0.64, 0.18, accent);

  // Main hull — massive layered fortress
  ctx.beginPath();
  ctx.moveTo(0.36, 0.18);
  ctx.lineTo(0.24, 0.26);
  ctx.lineTo(0.16, 0.40);
  ctx.lineTo(0.14, 0.56);
  ctx.lineTo(0.16, 0.72);
  ctx.lineTo(0.24, 0.82);
  ctx.lineTo(0.36, 0.90);
  ctx.lineTo(0.64, 0.90);
  ctx.lineTo(0.76, 0.82);
  ctx.lineTo(0.84, 0.72);
  ctx.lineTo(0.86, 0.56);
  ctx.lineTo(0.84, 0.40);
  ctx.lineTo(0.76, 0.26);
  ctx.lineTo(0.64, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Heavy broadside sponsons
  ctx.beginPath();
  ctx.moveTo(0.14, 0.34);
  ctx.lineTo(0.08, 0.38);
  ctx.lineTo(0.06, 0.50);
  ctx.lineTo(0.08, 0.62);
  ctx.lineTo(0.14, 0.66);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0.86, 0.34);
  ctx.lineTo(0.92, 0.38);
  ctx.lineTo(0.94, 0.50);
  ctx.lineTo(0.92, 0.62);
  ctx.lineTo(0.86, 0.66);
  ctx.closePath();
  ctx.fillStyle = '#3a2e22';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.004;
  ctx.stroke();

  // Dorsal crest — towering
  dorsalCrest(ctx, 0.20, 0.82, accent);

  // Forge seams — multiple layers (damascus effect)
  forgeSeam(ctx, 0.22, 0.28, 0.78, accent);
  forgeSeam(ctx, 0.18, 0.38, 0.82, accent);
  forgeSeam(ctx, 0.16, 0.48, 0.84, accent);
  forgeSeam(ctx, 0.16, 0.58, 0.84, accent);
  forgeSeam(ctx, 0.18, 0.68, 0.82, accent);
  forgeSeam(ctx, 0.22, 0.78, 0.78, accent);

  // Keel plate
  ctx.beginPath();
  ctx.moveTo(0.30, 0.84);
  ctx.lineTo(0.70, 0.84);
  ctx.strokeStyle = withAlpha(accent, 0.3);
  ctx.lineWidth = 0.018;
  ctx.stroke();

  // Turrets — full arsenal
  // Dorsal main batteries
  turretMount(ctx, 0.50, 0.30, 0.032, 0.075, accent);
  turretMount(ctx, 0.50, 0.50, 0.030, 0.065, accent);
  turretMount(ctx, 0.50, 0.68, 0.028, 0.060, accent);
  // Broadside sponson turrets
  turretMount(ctx, 0.09, 0.48, 0.022, 0.050, accent);
  turretMount(ctx, 0.91, 0.48, 0.022, 0.050, accent);
  turretMount(ctx, 0.09, 0.56, 0.022, 0.050, accent);
  turretMount(ctx, 0.91, 0.56, 0.022, 0.050, accent);
  // Flanking turrets on hull
  turretMount(ctx, 0.22, 0.36, 0.020, 0.045, accent);
  turretMount(ctx, 0.78, 0.36, 0.020, 0.045, accent);

  // Viewport
  ctx.beginPath();
  ctx.rect(0.38, 0.10, 0.24, 0.022);
  const vpGrad = ctx.createLinearGradient(0.38, 0.10, 0.62, 0.10);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Eight engines in wide array
  khazariEngineGlow(ctx, 0.32, 0.89, 0.026);
  khazariEngineGlow(ctx, 0.40, 0.90, 0.030);
  khazariEngineGlow(ctx, 0.48, 0.91, 0.026);
  khazariEngineGlow(ctx, 0.52, 0.91, 0.026);
  khazariEngineGlow(ctx, 0.60, 0.90, 0.030);
  khazariEngineGlow(ctx, 0.68, 0.89, 0.026);
}


/**
 * COLONISER — "Forge Ark"
 * A protected vessel carrying the sacred forge-equipment to claim a new
 * world. Heavily armoured but not heavily armed — the Khazari protect
 * their colonisers with escorts, not with the coloniser's own guns.
 * The silhouette is rounded and enclosed compared to warships, with a
 * visible habitat section (the "crucible") amidships. The dorsal crest
 * is broader, almost a fin — acting as a thermal radiator for the
 * population within.
 */
export function khazariColoniser(ctx: CanvasRenderingContext2D, accent: string): void {
  // Blunt prow — protective, not aggressive
  ramProw(ctx, 0.50, 0.08, 0.38, 0.62, 0.18, accent);

  // Main hull — rounded trapezoid ark shape
  ctx.beginPath();
  ctx.moveTo(0.38, 0.18);
  ctx.lineTo(0.28, 0.26);
  ctx.lineTo(0.22, 0.40);
  ctx.lineTo(0.20, 0.56);
  ctx.lineTo(0.22, 0.70);
  ctx.lineTo(0.30, 0.80);
  ctx.lineTo(0.40, 0.88);
  ctx.lineTo(0.60, 0.88);
  ctx.lineTo(0.70, 0.80);
  ctx.lineTo(0.78, 0.70);
  ctx.lineTo(0.80, 0.56);
  ctx.lineTo(0.78, 0.40);
  ctx.lineTo(0.72, 0.26);
  ctx.lineTo(0.62, 0.18);
  ctx.closePath();
  khazariFill(ctx, accent);

  // Habitat "crucible" section — glowing amber band amidships
  ctx.beginPath();
  ctx.moveTo(0.24, 0.42);
  ctx.lineTo(0.76, 0.42);
  ctx.lineTo(0.78, 0.54);
  ctx.lineTo(0.76, 0.66);
  ctx.lineTo(0.24, 0.66);
  ctx.lineTo(0.22, 0.54);
  ctx.closePath();
  const habitatGrad = ctx.createLinearGradient(0.24, 0.42, 0.76, 0.66);
  habitatGrad.addColorStop(0,   'rgba(255,140,40,0.08)');
  habitatGrad.addColorStop(0.5, 'rgba(255,120,30,0.15)');
  habitatGrad.addColorStop(1,   'rgba(255,140,40,0.08)');
  ctx.fillStyle = habitatGrad;
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.2);
  ctx.lineWidth = 0.003;
  ctx.stroke();

  // Habitat viewport strips — amber glow windows
  ctx.beginPath();
  ctx.rect(0.30, 0.46, 0.40, 0.015);
  ctx.fillStyle = 'rgba(255,160,60,0.4)';
  ctx.fill();
  ctx.beginPath();
  ctx.rect(0.30, 0.58, 0.40, 0.015);
  ctx.fillStyle = 'rgba(255,160,60,0.4)';
  ctx.fill();

  // Dorsal crest — broad radiator fin
  ctx.beginPath();
  ctx.moveTo(0.50, 0.22);
  ctx.lineTo(0.50, 0.76);
  ctx.strokeStyle = withAlpha(accent, 0.4);
  ctx.lineWidth = 0.020;  // wider than warship crests
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.50, 0.22);
  ctx.lineTo(0.50, 0.76);
  ctx.strokeStyle = 'rgba(255,140,40,0.10)';
  ctx.lineWidth = 0.035;
  ctx.stroke();

  // Armour shell plate seams
  forgeSeam(ctx, 0.26, 0.30, 0.74, accent);
  forgeSeam(ctx, 0.24, 0.42, 0.76, accent);
  forgeSeam(ctx, 0.24, 0.66, 0.76, accent);
  forgeSeam(ctx, 0.26, 0.76, 0.74, accent);

  // Top viewport
  ctx.beginPath();
  ctx.rect(0.42, 0.14, 0.16, 0.02);
  const vpGrad = ctx.createLinearGradient(0.42, 0.14, 0.58, 0.14);
  vpGrad.addColorStop(0,   'rgba(255,180,80,0.7)');
  vpGrad.addColorStop(0.5, 'rgba(255,140,40,0.9)');
  vpGrad.addColorStop(1,   'rgba(200,90,20,0.6)');
  ctx.fillStyle = vpGrad;
  ctx.fill();

  // Twin heavy engines
  khazariEngineGlow(ctx, 0.42, 0.87, 0.032);
  khazariEngineGlow(ctx, 0.58, 0.87, 0.032);
}
