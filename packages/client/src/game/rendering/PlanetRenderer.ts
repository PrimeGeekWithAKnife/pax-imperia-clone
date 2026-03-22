import Phaser from 'phaser';
import type { Planet, PlanetType, AtmosphereType } from '@nova-imperia/shared';

// ── Deterministic random from planet ID ──────────────────────────────────────

/**
 * Returns a deterministic pseudo-random number in [0, 1) for a given seed
 * string and index. Two calls with the same (seed, index) always return the
 * same value, but different indices produce uncorrelated results.
 */
function seededRandom(seed: string, index: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  h = (h * 127 + index * 997) | 0;
  return ((h & 0x7fffffff) % 1000) / 1000;
}

// ── Planet size config ────────────────────────────────────────────────────────

const PLANET_RADIUS: Record<PlanetType, number> = {
  terran:    14,
  ocean:     13,
  desert:    12,
  ice:       11,
  volcanic:  12,
  gas_giant: 26,
  barren:    10,
  toxic:     11,
};

// ── Atmosphere haze colors ────────────────────────────────────────────────────

interface AtmosphereStyle {
  color: number;
  alpha: number;
  thickness: number; // fraction of planet radius
}

const ATMOSPHERE_STYLES: Partial<Record<AtmosphereType, AtmosphereStyle>> = {
  oxygen_nitrogen: { color: 0x5599ff, alpha: 0.28, thickness: 0.22 },
  nitrogen:        { color: 0x4488cc, alpha: 0.18, thickness: 0.15 },
  carbon_dioxide:  { color: 0xff7722, alpha: 0.30, thickness: 0.20 },
  methane:         { color: 0x995533, alpha: 0.25, thickness: 0.18 },
  ammonia:         { color: 0xcccc22, alpha: 0.28, thickness: 0.20 },
  sulfur_dioxide:  { color: 0xaaaa00, alpha: 0.30, thickness: 0.22 },
  hydrogen:        { color: 0xaaddff, alpha: 0.20, thickness: 0.18 },
  hydrogen_helium: { color: 0x99ccff, alpha: 0.35, thickness: 0.28 },
  toxic:           { color: 0x33aa33, alpha: 0.50, thickness: 0.32 },
};

// ── Result type ───────────────────────────────────────────────────────────────

export interface PlanetRenderResult {
  /** The main container holding all planet visual objects. */
  container: Phaser.GameObjects.Container;
  /** Radius (px) of the planet body. */
  radius: number;
  /** Cleanup callback — also destroys tweens/timer events. */
  destroy(): void;
}

// ── Moon data ─────────────────────────────────────────────────────────────────

interface MoonEntry {
  sprite: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Graphics;
  moonRadius: number;
  orbitRadius: number;
  angle: number;
  speed: number; // rad per ms
}

interface OrbitalEntry {
  gfx: Phaser.GameObjects.Graphics;
  orbitRadius: number;
  angle: number;
  speed: number; // rad per ms
}

// ── PlanetRenderer ────────────────────────────────────────────────────────────

export class PlanetRenderer {
  private scene: Phaser.Scene;
  /** Timer events created during render — stored for cleanup. */
  private timerEvents: Phaser.Time.TimerEvent[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  render(planet: Planet, x: number, y: number): PlanetRenderResult {
    const radius = PLANET_RADIUS[planet.type];
    const container = this.scene.add.container(x, y);

    // Render in layer order (back to front)
    this.addRings(container, planet, radius);
    this.addPlanetBody(container, planet, radius);
    this.addAtmosphere(container, planet, radius);
    const moonEntries = this.addMoons(container, planet, radius);
    const orbitalEntries = this.addOrbitalStructures(container, planet, radius);

    // Moon + orbital structure orbit update (driven by a repeating timer)
    const hasOrbiting = moonEntries.length > 0 || orbitalEntries.length > 0;
    if (hasOrbiting) {
      const timer = this.scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          for (const m of moonEntries) {
            m.angle += m.speed * 16;
            const mx = Math.cos(m.angle) * m.orbitRadius;
            const my = Math.sin(m.angle) * m.orbitRadius;
            m.sprite.setPosition(mx, my);
            // Redraw shadow at new moon position
            m.shadow.clear();
            m.shadow.fillStyle(0x000000, 0.45);
            m.shadow.fillCircle(
              mx + m.moonRadius * 0.3,
              my,
              m.moonRadius * 0.85,
            );
          }
          for (const o of orbitalEntries) {
            o.angle += o.speed * 16;
            o.gfx.setPosition(
              Math.cos(o.angle) * o.orbitRadius,
              Math.sin(o.angle) * o.orbitRadius,
            );
          }
        },
      });
      this.timerEvents.push(timer);
    }

    const timerEvents = this.timerEvents.slice();
    const result: PlanetRenderResult = {
      container,
      radius,
      destroy: () => {
        timerEvents.forEach(t => t.remove());
        container.destroy(true);
      },
    };

    return result;
  }

  // ── Planet body ─────────────────────────────────────────────────────────────

  private addPlanetBody(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    radius: number,
  ): void {
    switch (planet.type) {
      case 'terran':    this.drawTerran(container, planet, radius);    break;
      case 'ocean':     this.drawOcean(container, planet, radius);     break;
      case 'desert':    this.drawDesert(container, planet, radius);    break;
      case 'ice':       this.drawIce(container, planet, radius);       break;
      case 'volcanic':  this.drawVolcanic(container, planet, radius);  break;
      case 'gas_giant': this.drawGasGiant(container, planet, radius);  break;
      case 'barren':    this.drawBarren(container, planet, radius);    break;
      case 'toxic':     this.drawToxic(container, planet, radius);     break;
    }

    // Shadow half-sphere (right side, star is to the left)
    const shadow = this.scene.add.graphics();
    // Draw a dark semi-transparent crescent on the right side
    shadow.fillStyle(0x000000, 0.52);
    shadow.fillCircle(radius * 0.38, 0, radius * 0.95);
    container.add(shadow);

    // Specular highlight — small bright arc top-left
    const shine = this.scene.add.graphics();
    shine.fillStyle(0xffffff, 0.18);
    shine.fillEllipse(-radius * 0.28, -radius * 0.28, radius * 0.55, radius * 0.40);
    container.add(shine);

    // Colony lights — tiny bright dots on the dark (right) side of populated planets
    if (planet.currentPopulation > 0) {
      const lightsGfx = this.scene.add.graphics();
      const lightCount = Math.min(8, Math.max(1, Math.floor(planet.currentPopulation / 5000)));
      for (let i = 0; i < lightCount; i++) {
        // Place lights in the shadowed right hemisphere
        const angle = seededRandom(planet.id, i) * Math.PI - Math.PI / 2;
        const dist = seededRandom(planet.id, i + 100) * radius * 0.8;
        const lx = Math.cos(angle) * dist + radius * 0.2;
        const ly = Math.sin(angle) * dist;
        const alpha = 0.5 + seededRandom(planet.id, i + 200) * 0.4;
        lightsGfx.fillStyle(0xfff8c8, alpha);
        lightsGfx.fillCircle(lx, ly, 1);
      }
      container.add(lightsGfx);
    }
  }

  // ── Surface types ───────────────────────────────────────────────────────────

  private drawTerran(container: Phaser.GameObjects.Container, planet: Planet, r: number): void {
    const g = this.scene.add.graphics();
    const id = planet.id;

    // Ocean base
    g.fillStyle(0x1a5fa8, 1);
    g.fillCircle(0, 0, r);

    // Landmasses — positions and sizes seeded per planet
    const continentCount = 2 + Math.floor(seededRandom(id, 0) * 3); // 2-4
    for (let i = 0; i < continentCount; i++) {
      const angle = seededRandom(id, i * 4 + 1) * Math.PI * 2;
      const dist = seededRandom(id, i * 4 + 2) * r * 0.5;
      const lx = Math.cos(angle) * dist;
      const ly = Math.sin(angle) * dist;
      const rx = r * (0.18 + seededRandom(id, i * 4 + 3) * 0.25);
      const ry = r * (0.15 + seededRandom(id, i * 4 + 4) * 0.20);
      g.fillStyle(0x3a7a3a, 1);
      g.fillEllipse(lx, ly, rx * 2, ry * 2);
      // Brown highlands
      g.fillStyle(0x7a5533, 0.6);
      g.fillEllipse(lx + r * 0.05, ly - r * 0.04, rx * 0.8, ry * 0.6);
    }

    // Cloud wisps — seeded positions
    g.lineStyle(1, 0xffffff, 0.30);
    const cloudCount = 4 + Math.floor(seededRandom(id, 50) * 4); // 4-7
    for (let i = 0; i < cloudCount; i++) {
      const angle = seededRandom(id, 60 + i) * Math.PI * 2;
      const dist  = r * (0.05 + seededRandom(id, 70 + i) * 0.60);
      const wx    = Math.cos(angle) * dist;
      const wy    = Math.sin(angle) * dist;
      const len   = r * (0.15 + seededRandom(id, 80 + i) * 0.30);
      const a2    = angle + (seededRandom(id, 90 + i) - 0.5);
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx + Math.cos(a2) * len, wy + Math.sin(a2) * len * 0.4);
      g.strokePath();
    }

    container.add(g);
  }

  private drawOcean(container: Phaser.GameObjects.Container, planet: Planet, r: number): void {
    const g = this.scene.add.graphics();
    const id = planet.id;

    // Deep blue base
    g.fillStyle(0x0d3f7a, 1);
    g.fillCircle(0, 0, r);

    // Lighter shallow ocean patches — seeded position and size
    const patchCount = 1 + Math.floor(seededRandom(id, 0) * 2); // 1-2
    for (let i = 0; i < patchCount; i++) {
      const px = (seededRandom(id, i * 3 + 1) - 0.5) * r * 0.8;
      const py = (seededRandom(id, i * 3 + 2) - 0.5) * r * 0.6;
      g.fillStyle(0x1a6bb5, 0.6);
      g.fillEllipse(px, py, r * (0.7 + seededRandom(id, i * 3 + 3) * 0.5), r * 0.6);
    }

    // Cloud spirals — seeded positions
    g.lineStyle(1, 0xddeeff, 0.28);
    const cloudCount = 5 + Math.floor(seededRandom(id, 20) * 5); // 5-9
    for (let i = 0; i < cloudCount; i++) {
      const a = seededRandom(id, 30 + i) * Math.PI * 2;
      const d = r * (0.15 + seededRandom(id, 40 + i) * 0.35);
      const ex = Math.cos(a) * d;
      const ey = Math.sin(a) * d;
      const bend = 0.4 + seededRandom(id, 50 + i) * 0.8;
      g.beginPath();
      g.moveTo(ex, ey);
      g.lineTo(ex + Math.cos(a + bend) * r * 0.3, ey + Math.sin(a + bend) * r * 0.15);
      g.strokePath();
    }

    // Ice caps (poles) — seeded size variation
    const capTop = 0.65 + seededRandom(id, 60) * 0.30;
    const capBot = 0.55 + seededRandom(id, 61) * 0.30;
    g.fillStyle(0xeef6ff, 0.70);
    g.fillEllipse(0, -r * 0.82, r * capTop, r * 0.30);
    g.fillEllipse(0,  r * 0.82, r * capBot, r * 0.26);

    container.add(g);
  }

  private drawDesert(container: Phaser.GameObjects.Container, planet: Planet, r: number): void {
    const g = this.scene.add.graphics();
    const id = planet.id;

    // Sandy base
    g.fillStyle(0xc89a50, 1);
    g.fillCircle(0, 0, r);

    // Darker ridge bands — seeded position and count
    const bandCount = 3 + Math.floor(seededRandom(id, 0) * 3); // 3-5
    g.fillStyle(0x9a6830, 0.45);
    for (let i = 0; i < bandCount; i++) {
      const fy = -r * 0.7 + seededRandom(id, i + 1) * r * 1.4;
      const bw = r * (1.0 + seededRandom(id, i + 10) * 0.6);
      g.fillEllipse((seededRandom(id, i + 20) - 0.5) * r * 0.3, fy, bw, r * 0.18);
    }

    // Subtle dust wisps — seeded
    g.lineStyle(1, 0xddaa66, 0.22);
    const dustCount = 3 + Math.floor(seededRandom(id, 30) * 3); // 3-5
    for (let i = 0; i < dustCount; i++) {
      const a  = seededRandom(id, 40 + i) * Math.PI * 2;
      const dx = Math.cos(a) * r * (0.2 + seededRandom(id, 50 + i) * 0.3);
      const dy = Math.sin(a) * r * (0.2 + seededRandom(id, 60 + i) * 0.3);
      const bend = 0.3 + seededRandom(id, 70 + i) * 0.6;
      g.beginPath();
      g.moveTo(dx, dy);
      g.lineTo(dx + r * 0.3 * Math.cos(a + bend), dy + r * 0.15 * Math.sin(a + bend));
      g.strokePath();
    }

    container.add(g);
  }

  private drawIce(container: Phaser.GameObjects.Container, planet: Planet, r: number): void {
    const g = this.scene.add.graphics();
    const id = planet.id;

    // White-blue base
    g.fillStyle(0xc8e8f8, 1);
    g.fillCircle(0, 0, r);

    // Cracking patterns — seeded positions and angles
    g.lineStyle(0.8, 0x6699cc, 0.55);
    const crackCount = 3 + Math.floor(seededRandom(id, 0) * 3); // 3-5
    for (let i = 0; i < crackCount; i++) {
      const cx = (seededRandom(id, i * 4 + 1) - 0.5) * r * 0.7;
      const cy = (seededRandom(id, i * 4 + 2) - 0.5) * r * 0.7;
      const angle = seededRandom(id, i * 4 + 3) * Math.PI * 2;
      const len = r * (0.30 + seededRandom(id, i * 4 + 4) * 0.30);
      g.beginPath();
      g.moveTo(cx, cy);
      // Jagged: two segments
      const mx = cx + Math.cos(angle) * len * 0.5;
      const my = cy + Math.sin(angle) * len * 0.5;
      const ex = cx + Math.cos(angle + 0.4) * len;
      const ey = cy + Math.sin(angle + 0.4) * len;
      g.lineTo(mx, my);
      g.lineTo(ex, ey);
      g.strokePath();
    }

    // Polar aurora (faint green arc at top) — seeded width
    const auroraWidth = 0.25 + seededRandom(id, 30) * 0.20;
    g.lineStyle(2, 0x44ff88, 0.22);
    g.beginPath();
    g.arc(0, -r * 0.85, r * auroraWidth, 0.3, Math.PI - 0.3);
    g.strokePath();

    container.add(g);
  }

  private drawVolcanic(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    r: number,
  ): void {
    const g = this.scene.add.graphics();

    // Dark base
    g.fillStyle(0x1a1208, 1);
    g.fillCircle(0, 0, r);

    // Lava fissures — seeded positions
    const fissureCount = 4 + Math.floor(seededRandom(planet.id, 0) * 3); // 4-6
    const fissures: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < fissureCount; i++) {
      const a = seededRandom(planet.id, i * 3 + 1) * Math.PI * 2;
      const d = r * (0.1 + seededRandom(planet.id, i * 3 + 2) * 0.60);
      const x1 = Math.cos(a) * d * 0.4;
      const y1 = Math.sin(a) * d * 0.4;
      const spread = 0.2 + seededRandom(planet.id, i * 3 + 3) * 0.3;
      const x2 = Math.cos(a + spread) * d;
      const y2 = Math.sin(a + spread) * d;
      fissures.push({ x1, y1, x2, y2 });

      g.lineStyle(1.5, 0xff4400, 0.85);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
    }

    // Glow spots — seeded positions
    const glowCount = 3 + Math.floor(seededRandom(planet.id, 30) * 3); // 3-5
    for (let i = 0; i < glowCount; i++) {
      const a = seededRandom(planet.id, 40 + i) * Math.PI * 2;
      const d = r * (0.25 + seededRandom(planet.id, 50 + i) * 0.35);
      g.fillStyle(0xff7700, 0.40);
      g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, r * 0.08);
    }

    container.add(g);

    // Pulsing lava overlay (animated)
    const pulseGfx = this.scene.add.graphics();
    container.add(pulseGfx);

    const timer = this.scene.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        pulseGfx.clear();
        const t = this.scene.time.now / 1000;
        for (let i = 0; i < fissures.length; i++) {
          const f = fissures[i]!;
          const pulse = 0.40 + 0.35 * Math.sin(t * 2.0 + i * 1.3);
          pulseGfx.lineStyle(2, 0xff6600, pulse);
          pulseGfx.beginPath();
          pulseGfx.moveTo(f.x1, f.y1);
          pulseGfx.lineTo(f.x2, f.y2);
          pulseGfx.strokePath();
        }

        // Planet name unused but planet kept for potential future use
        void planet;
      },
    });
    this.timerEvents.push(timer);
  }

  private drawGasGiant(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    r: number,
  ): void {
    const g = this.scene.add.graphics();

    // Determine palette by planet name hash (deterministic variety)
    const hash = planet.id.charCodeAt(0) + planet.id.charCodeAt(1);
    const isBlue = hash % 3 === 0;

    const baseColor  = isBlue ? 0x2244aa : 0x9c5a1e;
    const band1Color = isBlue ? 0x335599 : 0xc87030;
    const band2Color = isBlue ? 0x4466bb : 0xa84020;
    const band3Color = isBlue ? 0x5577cc : 0xe0a050;

    // Base
    g.fillStyle(baseColor, 1);
    g.fillCircle(0, 0, r);

    // Horizontal bands — clipped via ellipses
    const bands = [
      { y: -r * 0.55, h: r * 0.20, color: band1Color, alpha: 0.80 },
      { y: -r * 0.30, h: r * 0.16, color: band2Color, alpha: 0.70 },
      { y: -r * 0.05, h: r * 0.22, color: band3Color, alpha: 0.85 },
      { y:  r * 0.22, h: r * 0.16, color: band2Color, alpha: 0.70 },
      { y:  r * 0.48, h: r * 0.18, color: band1Color, alpha: 0.75 },
    ];
    for (const b of bands) {
      g.fillStyle(b.color, b.alpha);
      g.fillEllipse(0, b.y, r * 1.8, b.h);
    }

    // Storm eye
    g.fillStyle(0xddaa66, 0.55);
    g.fillEllipse(r * 0.2, -r * 0.15, r * 0.32, r * 0.20);
    g.fillStyle(0xeeddbb, 0.30);
    g.fillEllipse(r * 0.2, -r * 0.15, r * 0.18, r * 0.12);

    container.add(g);

    // Slow band drift (animated overlay)
    const driftGfx = this.scene.add.graphics();
    container.add(driftGfx);

    const timer = this.scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        driftGfx.clear();
        const t = this.scene.time.now / 8000; // very slow
        for (let i = 0; i < bands.length; i++) {
          const b = bands[i]!;
          const offset = Math.sin(t * Math.PI * 2 + i * 0.8) * r * 0.04;
          driftGfx.fillStyle(b.color, b.alpha * 0.25);
          driftGfx.fillEllipse(offset, b.y, r * 1.8, b.h);
        }
      },
    });
    this.timerEvents.push(timer);
  }

  private drawBarren(container: Phaser.GameObjects.Container, planet: Planet, r: number): void {
    const g = this.scene.add.graphics();
    const id = planet.id;

    // Gray base
    g.fillStyle(0x5a5a5a, 1);
    g.fillCircle(0, 0, r);

    // Craters — seeded positions and sizes
    const craterCount = 4 + Math.floor(seededRandom(id, 0) * 4); // 4-7
    for (let i = 0; i < craterCount; i++) {
      const angle = seededRandom(id, i * 3 + 1) * Math.PI * 2;
      const dist = seededRandom(id, i * 3 + 2) * r * 0.55;
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;
      const cr = r * (0.06 + seededRandom(id, i * 3 + 3) * 0.10);
      g.fillStyle(0x3e3e3e, 0.70);
      g.fillCircle(cx, cy, cr);
      g.lineStyle(0.5, 0x888888, 0.40);
      g.strokeCircle(cx, cy, cr);
    }

    container.add(g);
  }

  private drawToxic(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    r: number,
  ): void {
    const g = this.scene.add.graphics();

    // Murky base
    g.fillStyle(0x2a3a1a, 1);
    g.fillCircle(0, 0, r);

    // Swirling gas blobs — seeded positions
    const blobCount = 4 + Math.floor(seededRandom(planet.id, 0) * 3); // 4-6
    for (let i = 0; i < blobCount; i++) {
      const a = seededRandom(planet.id, i * 2 + 1) * Math.PI * 2;
      const d = r * (0.20 + seededRandom(planet.id, i * 2 + 2) * 0.30);
      g.fillStyle(0x448833, 0.35);
      g.fillEllipse(
        Math.cos(a) * d,
        Math.sin(a) * d,
        r * (0.35 + seededRandom(planet.id, i + 20) * 0.20),
        r * (0.20 + seededRandom(planet.id, i + 30) * 0.15),
      );
    }

    container.add(g);

    // Animated swirl
    const swirlGfx = this.scene.add.graphics();
    container.add(swirlGfx);

    const timer = this.scene.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        swirlGfx.clear();
        const t = this.scene.time.now / 4000;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + t;
          const d = r * 0.30;
          swirlGfx.fillStyle(0x55aa33, 0.18);
          swirlGfx.fillEllipse(
            Math.cos(a) * d,
            Math.sin(a) * d,
            r * 0.45,
            r * 0.22,
          );
        }
        void planet; // suppress unused warning
      },
    });
    this.timerEvents.push(timer);
  }

  // ── Atmosphere haze ─────────────────────────────────────────────────────────

  private addAtmosphere(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    r: number,
  ): void {
    const style = ATMOSPHERE_STYLES[planet.atmosphere];
    if (!style) return;

    const atmoR = r * (1 + style.thickness);

    // Multiple rings for soft gradient
    for (let i = 3; i >= 1; i--) {
      const ringR = r + (atmoR - r) * (i / 3);
      const alpha = style.alpha * (i / 3) * 0.5;
      const ring = this.scene.add.graphics();
      ring.lineStyle(2, style.color, alpha);
      ring.strokeCircle(0, 0, ringR);
      container.add(ring);
    }

    // Solid haze outer
    const haze = this.scene.add.graphics();
    haze.lineStyle(3, style.color, style.alpha * 0.35);
    haze.strokeCircle(0, 0, atmoR);
    container.add(haze);
  }

  // ── Moons ───────────────────────────────────────────────────────────────────

  private addMoons(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    r: number,
  ): MoonEntry[] {
    const moonEntries: MoonEntry[] = [];

    let moonCount = 0;
    if (planet.type === 'gas_giant') {
      moonCount = 2 + (planet.orbitalIndex % 3); // 2–4
    } else if (planet.orbitalIndex >= 2 && planet.orbitalIndex <= 5) {
      moonCount = planet.orbitalIndex % 3; // 0–2
    }

    for (let i = 0; i < moonCount; i++) {
      const moonRadius = r * 0.18 + i * r * 0.04;
      const orbitR = r * (1.7 + i * 0.55);
      const startAngle = (i / moonCount) * Math.PI * 2;
      const speed = 0.0004 / (1 + i * 0.4); // outer moons slower

      const mx = Math.cos(startAngle) * orbitR;
      const my = Math.sin(startAngle) * orbitR;

      const moonSprite = this.scene.add.arc(mx, my, moonRadius, 0, 360, false, 0x888888, 1);

      // Moon shading
      const moonShade = this.scene.add.graphics();
      moonShade.fillStyle(0x000000, 0.45);
      moonShade.fillCircle(mx + moonRadius * 0.3, my, moonRadius * 0.85);
      container.add(moonShade);

      // Keep shade in sync — we'll update both together via the timer
      moonEntries.push({
        sprite: moonSprite,
        shadow: moonShade,
        moonRadius,
        orbitRadius: orbitR,
        angle: startAngle,
        speed,
      });

      container.add(moonSprite);
    }

    return moonEntries;
  }

  // ── Orbital structures ─────────────────────────────────────────────────────

  /**
   * Draw tiny orbital structures around colonised planets based on their
   * buildings. Each relevant building type spawns a small 2-4 px icon that
   * orbits the planet slowly.
   */
  private addOrbitalStructures(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    r: number,
  ): OrbitalEntry[] {
    const entries: OrbitalEntry[] = [];
    if (planet.buildings.length === 0) return entries;

    const buildingTypes = planet.buildings.map(b => b.type);
    const structures: Array<{ type: string; draw: (g: Phaser.GameObjects.Graphics) => void }> = [];

    // Shipyard -> L-shaped dock
    if (buildingTypes.includes('shipyard')) {
      structures.push({
        type: 'shipyard',
        draw: (g) => {
          g.lineStyle(1, 0x99aacc, 0.9);
          g.beginPath();
          g.moveTo(-2, -2);
          g.lineTo(-2, 2);
          g.lineTo(2, 2);
          g.strokePath();
          g.fillStyle(0xaabbdd, 0.7);
          g.fillRect(-2.5, 1, 5, 1.5);
        },
      });
    }

    // Spaceport -> satellite dot with antenna
    if (buildingTypes.includes('spaceport')) {
      structures.push({
        type: 'spaceport',
        draw: (g) => {
          g.fillStyle(0xccccdd, 0.9);
          g.fillCircle(0, 0, 1.5);
          g.lineStyle(0.5, 0xaaaacc, 0.7);
          g.beginPath();
          g.moveTo(0, -1.5);
          g.lineTo(0, -3.5);
          g.strokePath();
          g.beginPath();
          g.moveTo(-1.5, -3.5);
          g.lineTo(1.5, -3.5);
          g.strokePath();
        },
      });
    }

    // Orbital platform -> ring segment
    if (buildingTypes.includes('orbital_platform')) {
      structures.push({
        type: 'orbital_platform',
        draw: (g) => {
          g.lineStyle(1.2, 0xbbaa88, 0.8);
          g.beginPath();
          g.arc(0, 0, 3, 0, Math.PI * 0.8);
          g.strokePath();
          g.fillStyle(0xccbb99, 0.6);
          g.fillCircle(3, 0, 1);
        },
      });
    }

    // Defence grid -> 2-3 tiny triangular satellites
    if (buildingTypes.includes('defense_grid')) {
      for (let i = 0; i < 3; i++) {
        structures.push({
          type: 'defense_' + i,
          draw: (g) => {
            g.fillStyle(0xcc4444, 0.8);
            g.fillTriangle(-1.5, 1, 1.5, 1, 0, -2);
          },
        });
      }
    }

    // Place each structure at a unique orbit slot
    for (let i = 0; i < structures.length; i++) {
      const orbitR = r * (1.35 + i * 0.18);
      const startAngle = seededRandom(planet.id, 500 + i) * Math.PI * 2;
      const speed = 0.0003 / (1 + i * 0.3); // varied speeds

      const gfx = this.scene.add.graphics();
      structures[i]!.draw(gfx);

      const sx = Math.cos(startAngle) * orbitR;
      const sy = Math.sin(startAngle) * orbitR;
      gfx.setPosition(sx, sy);
      container.add(gfx);

      entries.push({
        gfx,
        orbitRadius: orbitR,
        angle: startAngle,
        speed,
      });
    }

    return entries;
  }

  // ── Rings ───────────────────────────────────────────────────────────────────

  private addRings(
    container: Phaser.GameObjects.Container,
    planet: Planet,
    r: number,
  ): void {
    const hasRings = planet.type === 'gas_giant' || planet.type === 'ice';
    if (!hasRings) return;

    // 50% chance — use orbitalIndex as cheap deterministic seed
    if (planet.orbitalIndex % 2 !== 0) return;

    // Draw a tilted ellipse ring behind the planet
    const ringG = this.scene.add.graphics();

    const ringWidth  = r * 2.4;
    const ringHeight = r * 0.55; // flat ellipse gives tilt illusion

    // Outer ring
    ringG.lineStyle(3, 0xbbaa88, 0.28);
    ringG.strokeEllipse(0, 0, ringWidth * 1.15, ringHeight * 1.15);

    // Inner ring
    ringG.lineStyle(2, 0xccbb99, 0.20);
    ringG.strokeEllipse(0, 0, ringWidth * 0.92, ringHeight * 0.92);

    // Subtle shimmer via alpha tween
    this.scene.tweens.add({
      targets: ringG,
      alpha: { from: 0.7, to: 1.0 },
      duration: 2200 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    container.add(ringG);
  }
}

// ── Asteroid belt helper ──────────────────────────────────────────────────────

/**
 * Draws a sparse asteroid belt ring centered on (cx, cy).
 * Call once from SystemViewScene after building orbits.
 */
export function renderAsteroidBelt(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const count = 80;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = innerRadius + Math.random() * (outerRadius - innerRadius);
    const ax    = cx + Math.cos(angle) * dist;
    const ay    = cy + Math.sin(angle) * dist;
    const ar    = Phaser.Math.FloatBetween(0.5, 1.4);
    const brightness = Phaser.Math.FloatBetween(0.25, 0.55);
    const v = Math.round(brightness * 255);
    const color = (v << 16) | (v << 8) | v;

    g.fillStyle(color, Phaser.Math.FloatBetween(0.4, 0.85));
    g.fillCircle(ax, ay, ar);
  }

  return g;
}
