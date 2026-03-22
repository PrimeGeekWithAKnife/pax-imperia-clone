import Phaser from 'phaser';
import type { StarType } from '@nova-imperia/shared';

// ── Star configuration ────────────────────────────────────────────────────────

interface StarConfig {
  coreColor: number;
  coronaColor: number;
  outerGlowColor: number;
  radius: number;
  coronaScale: number; // corona radius = radius * coronaScale
  brightness: number;  // 0–1, affects glow alpha ceiling
  granulation: boolean;
  isBinary: boolean;
  isNeutron: boolean;
}

const STAR_CONFIGS: Record<StarType, StarConfig> = {
  yellow: {
    coreColor:      0xfffde0,
    coronaColor:    0xffcc44,
    outerGlowColor: 0xff9900,
    radius: 45,
    coronaScale: 2.0,
    brightness: 0.85,
    granulation: false,
    isBinary: false,
    isNeutron: false,
  },
  orange: {
    coreColor:      0xffd090,
    coronaColor:    0xff6600,
    outerGlowColor: 0xcc3300,
    radius: 42,
    coronaScale: 1.9,
    brightness: 0.75,
    granulation: false,
    isBinary: false,
    isNeutron: false,
  },
  red_dwarf: {
    coreColor:      0xff7755,
    coronaColor:    0xcc2200,
    outerGlowColor: 0x880000,
    radius: 30,
    coronaScale: 1.6,
    brightness: 0.55,
    granulation: false,
    isBinary: false,
    isNeutron: false,
  },
  red_giant: {
    coreColor:      0xff5533,
    coronaColor:    0xcc1100,
    outerGlowColor: 0x770000,
    radius: 65,
    coronaScale: 2.4,
    brightness: 0.80,
    granulation: true,
    isBinary: false,
    isNeutron: false,
  },
  blue_giant: {
    coreColor:      0xeef8ff,
    coronaColor:    0x5599ff,
    outerGlowColor: 0x2255cc,
    radius: 58,
    coronaScale: 2.6,
    brightness: 1.0,
    granulation: true,
    isBinary: false,
    isNeutron: false,
  },
  white: {
    coreColor:      0xffffff,
    coronaColor:    0xccddff,
    outerGlowColor: 0x8899cc,
    radius: 44,
    coronaScale: 1.7,
    brightness: 0.90,
    granulation: false,
    isBinary: false,
    isNeutron: false,
  },
  neutron: {
    coreColor:      0xeef8ff,
    coronaColor:    0x88ccff,
    outerGlowColor: 0x224488,
    radius: 18,
    coronaScale: 3.0,
    brightness: 1.0,
    granulation: false,
    isBinary: false,
    isNeutron: true,
  },
  binary: {
    coreColor:      0xffeecc,
    coronaColor:    0xffaa44,
    outerGlowColor: 0xcc6600,
    radius: 50, // nominal — two smaller stars rendered
    coronaScale: 2.2,
    brightness: 0.90,
    granulation: false,
    isBinary: true,
    isNeutron: false,
  },
};

// ── Result type ───────────────────────────────────────────────────────────────

export interface StarRenderResult {
  /** All Phaser objects that make up the star. Pass to scene for cleanup/depth. */
  objects: Phaser.GameObjects.GameObject[];
  /** The main pulsing body objects for the flicker tween. */
  bodyObjects: Phaser.GameObjects.GameObject[];
  /** Bounding radius used to keep planets clear. */
  outerRadius: number;
  /** Cleanup helper — destroys all game objects. */
  destroy(): void;
}

// ── StarRenderer ──────────────────────────────────────────────────────────────

export class StarRenderer {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  render(starType: StarType, cx: number, cy: number): StarRenderResult {
    const cfg = STAR_CONFIGS[starType];
    const objects: Phaser.GameObjects.GameObject[] = [];
    const bodyObjects: Phaser.GameObjects.GameObject[] = [];

    if (cfg.isBinary) {
      return this.renderBinary(cx, cy, cfg);
    }

    if (cfg.isNeutron) {
      return this.renderNeutron(cx, cy, cfg);
    }

    // ── Outer diffuse halo ──────────────────────────────────────────────────
    const outerRadius = cfg.radius * cfg.coronaScale;
    for (let layer = 4; layer >= 1; layer--) {
      const r = outerRadius * (1 + (layer - 1) * 0.35);
      const alpha = (cfg.brightness * 0.05) / layer;
      const halo = this.scene.add.circle(cx, cy, r, cfg.outerGlowColor, alpha);
      halo.setDepth(10);
      objects.push(halo);
    }

    // ── Main corona ─────────────────────────────────────────────────────────
    const corona = this.scene.add.circle(cx, cy, outerRadius, cfg.coronaColor, cfg.brightness * 0.22);
    corona.setDepth(11);
    objects.push(corona);

    this.scene.tweens.add({
      targets: corona,
      alpha: { from: cfg.brightness * 0.14, to: cfg.brightness * 0.30 },
      scale: { from: 0.92, to: 1.08 },
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Inner corona ────────────────────────────────────────────────────────
    const innerCorona = this.scene.add.circle(cx, cy, cfg.radius * 1.35, cfg.coronaColor, cfg.brightness * 0.38);
    innerCorona.setDepth(12);
    objects.push(innerCorona);

    // ── Surface granulation (red/blue giants) ───────────────────────────────
    if (cfg.granulation) {
      const gran = this.renderGranulation(cfg, cx, cy);
      objects.push(...gran);
    }

    // ── Star body ───────────────────────────────────────────────────────────
    const body = this.scene.add.circle(cx, cy, cfg.radius, cfg.coreColor, 1);
    body.setDepth(14);
    objects.push(body);
    bodyObjects.push(body);

    // ── Radial brightness gradient overlay ──────────────────────────────────
    // Simulate limb darkening with a small dark overlay at edges
    const limbDarken = this.scene.add.graphics();
    limbDarken.setDepth(15);
    // Limb darkening is simulated via the bright inner highlight below
    // Bright core hot spot
    const hotspot = this.scene.add.circle(
      cx - cfg.radius * 0.18,
      cy - cfg.radius * 0.18,
      cfg.radius * 0.35,
      0xffffff,
      cfg.brightness * 0.28,
    );
    hotspot.setDepth(16);
    objects.push(hotspot);

    // Secondary subtle bright core
    const coreGlow = this.scene.add.circle(cx, cy, cfg.radius * 0.55, 0xffffff, cfg.brightness * 0.12);
    coreGlow.setDepth(16);
    objects.push(coreGlow);
    limbDarken.destroy(); // we ended up not drawing anything on it

    // ── Flicker tween on body ────────────────────────────────────────────────
    this.scene.tweens.add({
      targets: body,
      scale: { from: 0.97, to: 1.03 },
      duration: 3200 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Flicker hot spot alpha
    this.scene.tweens.add({
      targets: hotspot,
      alpha: { from: cfg.brightness * 0.18, to: cfg.brightness * 0.38 },
      duration: 1800 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const allObjects = objects;
    return {
      objects: allObjects,
      bodyObjects,
      outerRadius,
      destroy() {
        allObjects.forEach(o => o.destroy());
      },
    };
  }

  // ── Granulation ────────────────────────────────────────────────────────────

  private renderGranulation(
    cfg: StarConfig,
    cx: number,
    cy: number,
  ): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.scene.add.graphics();
    g.setDepth(13);

    const count = cfg.granulation ? 14 : 0;
    for (let i = 0; i < count; i++) {
      // Random position within star disk
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * cfg.radius * 0.85;
      const gx = cx + Math.cos(angle) * dist;
      const gy = cy + Math.sin(angle) * dist;
      const patchRadius = cfg.radius * Phaser.Math.FloatBetween(0.06, 0.14);

      // Lighter or darker patch
      const lighter = Math.random() > 0.5;
      if (lighter) {
        g.fillStyle(0xffffff, 0.08);
      } else {
        g.fillStyle(0x000000, 0.06);
      }
      g.fillCircle(gx, gy, patchRadius);
    }

    objects.push(g);
    return objects;
  }

  // ── Binary star ────────────────────────────────────────────────────────────

  private renderBinary(cx: number, cy: number, cfg: StarConfig): StarRenderResult {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const bodyObjects: Phaser.GameObjects.GameObject[] = [];

    const smallRadius = cfg.radius * 0.55;
    const separation = cfg.radius * 0.85;

    // Two stars, slightly different
    const configs = [
      { color: 0xffeecc, corona: 0xffaa44, dx: -separation, dy: -separation * 0.3 },
      { color: 0xffd4aa, corona: 0xff8822, dx:  separation, dy:  separation * 0.3 },
    ];

    for (const sc of configs) {
      const sx = cx + sc.dx;
      const sy = cy + sc.dy;

      // Corona
      const corona = this.scene.add.circle(sx, sy, smallRadius * 1.9, sc.corona, 0.20);
      corona.setDepth(11);
      objects.push(corona);

      this.scene.tweens.add({
        targets: corona,
        alpha: { from: 0.12, to: 0.28 },
        scale: { from: 0.92, to: 1.10 },
        duration: 2600 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Body
      const body = this.scene.add.circle(sx, sy, smallRadius, sc.color, 1);
      body.setDepth(14);
      objects.push(body);
      bodyObjects.push(body);

      // Hotspot
      const hs = this.scene.add.circle(
        sx - smallRadius * 0.2,
        sy - smallRadius * 0.2,
        smallRadius * 0.35,
        0xffffff,
        0.25,
      );
      hs.setDepth(15);
      objects.push(hs);

      this.scene.tweens.add({
        targets: body,
        scale: { from: 0.97, to: 1.03 },
        duration: 3000 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Shared glow
    const glow = this.scene.add.circle(cx, cy, cfg.radius * 2.2, cfg.outerGlowColor, 0.07);
    glow.setDepth(10);
    objects.unshift(glow);

    const allObjects = objects;
    return {
      objects: allObjects,
      bodyObjects,
      outerRadius: cfg.radius * 1.3,
      destroy() {
        allObjects.forEach(o => o.destroy());
      },
    };
  }

  // ── Neutron star ───────────────────────────────────────────────────────────

  private renderNeutron(cx: number, cy: number, cfg: StarConfig): StarRenderResult {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const bodyObjects: Phaser.GameObjects.GameObject[] = [];

    // Wide diffuse halo
    for (let i = 3; i >= 1; i--) {
      const r = cfg.radius * 3.5 * (1 + (i - 1) * 0.5);
      const h = this.scene.add.circle(cx, cy, r, cfg.outerGlowColor, 0.04 / i);
      h.setDepth(10);
      objects.push(h);
    }

    // Intense tight corona
    const corona = this.scene.add.circle(cx, cy, cfg.radius * 2.8, cfg.coronaColor, 0.30);
    corona.setDepth(11);
    objects.push(corona);

    this.scene.tweens.add({
      targets: corona,
      alpha: { from: 0.18, to: 0.42 },
      scale: { from: 0.90, to: 1.12 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tiny intensely bright body
    const body = this.scene.add.circle(cx, cy, cfg.radius, cfg.coreColor, 1);
    body.setDepth(14);
    objects.push(body);
    bodyObjects.push(body);

    // ── Rotating beam (pulsar jet) ──────────────────────────────────────────
    const beamGraphics = this.scene.add.graphics();
    beamGraphics.setDepth(12);
    objects.push(beamGraphics);

    let beamAngle = 0;
    const beamLength = cfg.radius * 5;
    // We drive the beam via the scene's update; use a timer event instead
    this.scene.time.addEvent({
      delay: 33, // ~30fps
      loop: true,
      callback: () => {
        beamAngle += 0.06; // radians per tick → ~1.8 rad/s
        beamGraphics.clear();

        // Two opposing beams
        for (let side = 0; side < 2; side++) {
          const a = beamAngle + side * Math.PI;
          const bx = cx + Math.cos(a) * beamLength;
          const by = cy + Math.sin(a) * beamLength;

          beamGraphics.lineStyle(2, cfg.coronaColor, 0.35);
          beamGraphics.beginPath();
          beamGraphics.moveTo(cx, cy);
          beamGraphics.lineTo(bx, by);
          beamGraphics.strokePath();

          // Beam core brighter
          beamGraphics.lineStyle(1, 0xffffff, 0.50);
          beamGraphics.beginPath();
          beamGraphics.moveTo(cx, cy);
          beamGraphics.lineTo(
            cx + Math.cos(a) * beamLength * 0.5,
            cy + Math.sin(a) * beamLength * 0.5,
          );
          beamGraphics.strokePath();
        }
      },
    });

    const allObjects = objects;
    return {
      objects: allObjects,
      bodyObjects,
      outerRadius: cfg.radius * 2.8,
      destroy() {
        allObjects.forEach(o => o.destroy());
      },
    };
  }
}
