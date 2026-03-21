import Phaser from 'phaser';
import type { StarSystem, StarType, Planet, PlanetType } from '@nova-imperia/shared';

// ── Star visuals ───────────────────────────────────────────────────────────────

interface StarVisual {
  color: number;
  glowColor: number;
  radius: number;
  glowRadius: number;
}

const STAR_VISUALS: Record<StarType, StarVisual> = {
  blue_giant:  { color: 0x99ccff, glowColor: 0x4499ff, radius: 55, glowRadius: 110 },
  white:       { color: 0xeeeeff, glowColor: 0xaabbff, radius: 45, glowRadius: 90  },
  yellow:      { color: 0xffee88, glowColor: 0xffcc44, radius: 45, glowRadius: 90  },
  orange:      { color: 0xff9944, glowColor: 0xff6600, radius: 42, glowRadius: 84  },
  red_dwarf:   { color: 0xff5533, glowColor: 0xcc2200, radius: 32, glowRadius: 64  },
  red_giant:   { color: 0xff3322, glowColor: 0xcc1100, radius: 62, glowRadius: 124 },
  neutron:     { color: 0xaaddff, glowColor: 0x88ccff, radius: 22, glowRadius: 55  },
  binary:      { color: 0xffddaa, glowColor: 0xffaa44, radius: 50, glowRadius: 100 },
};

// ── Planet visuals ─────────────────────────────────────────────────────────────

interface PlanetVisual {
  color: number;
  radius: number;
  label: string;
}

const PLANET_VISUALS: Record<PlanetType, PlanetVisual> = {
  terran:    { color: 0x44aa66, radius: 14, label: 'Terran'    },
  ocean:     { color: 0x2266cc, radius: 13, label: 'Ocean'     },
  desert:    { color: 0xcc9944, radius: 12, label: 'Desert'    },
  ice:       { color: 0xaaddff, radius: 11, label: 'Ice'       },
  volcanic:  { color: 0xcc3311, radius: 12, label: 'Volcanic'  },
  gas_giant: { color: 0xcc7722, radius: 20, label: 'Gas Giant' },
  barren:    { color: 0x776655, radius: 10, label: 'Barren'    },
  toxic:     { color: 0x44cc44, radius: 11, label: 'Toxic'     },
};

// ── Orbit layout ──────────────────────────────────────────────────────────────

const ORBIT_BASE_RADIUS = 110;  // px from star center to innermost orbit
const ORBIT_STEP = 55;          // px between successive orbits

// ── SystemViewScene ────────────────────────────────────────────────────────────

interface OrbitEntry {
  planet: Planet;
  orbitRadius: number;
  angle: number;        // current angle in radians
  speed: number;        // radians per ms
  container: Phaser.GameObjects.Container;
  orbitRing: Phaser.GameObjects.Arc;
}

export class SystemViewScene extends Phaser.Scene {
  private system!: StarSystem;
  private orbitEntries: OrbitEntry[] = [];

  // UI
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'SystemViewScene' });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  create(data: { system: StarSystem }): void {
    this.system = data.system;
    this.orbitEntries = [];

    const { width, height } = this.scale;

    // Background
    this.add.rectangle(0, 0, width, height, 0x05050f).setOrigin(0, 0);

    // Starfield backdrop
    this.createStarfield(width, height);

    // System title
    this.add.text(width / 2, 28, this.system.name, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#d4af6a',
    }).setOrigin(0.5, 0.5);

    this.add.text(width / 2, 56, this.system.starType.replace('_', ' ').toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#7799bb',
      letterSpacing: 3,
    }).setOrigin(0.5, 0.5);

    // Star at center
    this.createStar(width / 2, height / 2);

    // Orbits + planets
    this.createOrbits(width / 2, height / 2);

    // Tooltip
    this.createTooltip();

    // Back button
    this.createBackButton();
  }

  update(_time: number, delta: number): void {
    for (const entry of this.orbitEntries) {
      entry.angle += entry.speed * delta;
      const cx = this.scale.width / 2 + Math.cos(entry.angle) * entry.orbitRadius;
      const cy = this.scale.height / 2 + Math.sin(entry.angle) * entry.orbitRadius;
      entry.container.setPosition(cx, cy);
    }
  }

  // ── Starfield backdrop ────────────────────────────────────────────────────────

  private createStarfield(width: number, height: number): void {
    const g = this.add.graphics();
    for (let i = 0; i < 180; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const r = Phaser.Math.FloatBetween(0.3, 1.2);
      const brightness = Phaser.Math.FloatBetween(0.1, 0.4);
      const v = Math.round(brightness * 255);
      const color = (v << 16) | (v << 8) | v;
      g.fillStyle(color, 1);
      g.fillCircle(x, y, r);
    }
  }

  // ── Star ──────────────────────────────────────────────────────────────────────

  private createStar(cx: number, cy: number): void {
    const visuals = STAR_VISUALS[this.system.starType];

    // Outer glow layers
    for (let i = 3; i >= 1; i--) {
      const glowR = visuals.glowRadius * (1 + (i - 1) * 0.4);
      const alpha = 0.06 / i;
      this.add.circle(cx, cy, glowR, visuals.glowColor, alpha);
    }

    // Main glow
    const glow = this.add.circle(cx, cy, visuals.glowRadius, visuals.glowColor, 0.20);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.12, to: 0.28 },
      scale: { from: 0.90, to: 1.10 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Star body
    const body = this.add.circle(cx, cy, visuals.radius, visuals.color, 1);

    // Inner bright spot
    this.add.circle(
      cx - visuals.radius * 0.25,
      cy - visuals.radius * 0.25,
      visuals.radius * 0.3,
      0xffffff,
      0.25,
    );

    // Star pulse tween
    this.tweens.add({
      targets: body,
      scale: { from: 0.97, to: 1.03 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ── Orbits + planets ──────────────────────────────────────────────────────────

  private createOrbits(cx: number, cy: number): void {
    const planets = [...this.system.planets].sort((a, b) => a.orbitalIndex - b.orbitalIndex);

    for (let i = 0; i < planets.length; i++) {
      const planet = planets[i]!;
      const orbitRadius = ORBIT_BASE_RADIUS + i * ORBIT_STEP;

      // Orbit ring (faint circle)
      const orbitRing = this.add.circle(cx, cy, orbitRadius);
      orbitRing.setStrokeStyle(1, 0x334466, 0.3);

      // Initial angle spread evenly
      const startAngle = (i / planets.length) * Math.PI * 2;

      // Angular speed: faster for inner orbits (Kepler-ish: ω ∝ 1/r^1.5)
      const baseSpeed = 0.00004;
      const speed = baseSpeed / Math.pow(orbitRadius / ORBIT_BASE_RADIUS, 1.2);

      // Planet position
      const px = cx + Math.cos(startAngle) * orbitRadius;
      const py = cy + Math.sin(startAngle) * orbitRadius;

      const container = this.createPlanetObject(planet, px, py);

      this.orbitEntries.push({
        planet,
        orbitRadius,
        angle: startAngle,
        speed,
        container,
        orbitRing,
      });
    }
  }

  private createPlanetObject(planet: Planet, x: number, y: number): Phaser.GameObjects.Container {
    const visuals = PLANET_VISUALS[planet.type];
    const container = this.add.container(x, y);

    // Planet circle
    const circle = this.add.circle(0, 0, visuals.radius, visuals.color, 1);

    // Subtle shine highlight
    this.add.circle(
      -visuals.radius * 0.28,
      -visuals.radius * 0.28,
      visuals.radius * 0.35,
      0xffffff,
      0.15,
    );

    // Hit area
    const hitArea = this.add.circle(0, 0, visuals.radius + 6, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      circle.setStrokeStyle(1.5, 0xffffff, 0.9);
      this.showTooltip(planet, x, y);
    });
    hitArea.on('pointerout', () => {
      circle.setStrokeStyle(0, 0, 0);
      this.hideTooltip();
    });
    hitArea.on('pointerdown', () => {
      this.events.emit('planet:selected', planet);
    });

    container.add([circle, hitArea]);
    return container;
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────────

  private createTooltip(): void {
    this.tooltipBg = this.add
      .rectangle(0, 0, 160, 60, 0x111824, 0.88)
      .setOrigin(0, 1)
      .setVisible(false)
      .setDepth(200);

    this.tooltipText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#aaccee',
      })
      .setOrigin(0, 1)
      .setVisible(false)
      .setDepth(201);
  }

  private showTooltip(planet: Planet, _wx: number, _wy: number): void {
    // Position near mouse pointer
    const pointer = this.input.activePointer;
    const px = pointer.x + 14;
    const py = pointer.y - 8;

    const typeLabel = PLANET_VISUALS[planet.type].label;
    const pop = planet.maxPopulation > 0
      ? `Pop cap: ${(planet.maxPopulation / 1e9).toFixed(1)}B`
      : 'Uninhabitable';
    const text = `${planet.name}\n${typeLabel}  |  ${pop}\nResources: ${planet.naturalResources}`;

    this.tooltipText.setText(text);
    const padding = 8;
    const tw = this.tooltipText.width + padding * 2;
    const th = this.tooltipText.height + padding * 2;

    this.tooltipBg.setSize(tw, th);
    this.tooltipBg.setPosition(px, py);
    this.tooltipText.setPosition(px + padding, py);
    this.tooltipBg.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipBg.setVisible(false);
    this.tooltipText.setVisible(false);
  }

  // ── Back button ───────────────────────────────────────────────────────────────

  private createBackButton(): void {
    const btn = this.add
      .text(20, 20, '← Galaxy Map', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#7799bb',
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(200);

    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor('#7799bb'));
    btn.on('pointerdown', () => {
      this.scene.start('GalaxyMapScene');
    });
  }
}
