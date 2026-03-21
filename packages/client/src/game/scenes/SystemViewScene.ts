import Phaser from 'phaser';
import type { StarSystem, Planet, PlanetType } from '@nova-imperia/shared';
import { StarRenderer } from '../rendering/StarRenderer';
import { PlanetRenderer, renderAsteroidBelt } from '../rendering/PlanetRenderer';
import { getAudioEngine, MusicGenerator, AmbientSounds, SfxGenerator } from '../../audio';

// ── Planet label data (kept local — not part of shared types) ─────────────────

const PLANET_LABELS: Record<PlanetType, string> = {
  terran:    'Terran',
  ocean:     'Ocean',
  desert:    'Desert',
  ice:       'Ice',
  volcanic:  'Volcanic',
  gas_giant: 'Gas Giant',
  barren:    'Barren',
  toxic:     'Toxic',
};

// ── Orbit layout ──────────────────────────────────────────────────────────────

const ORBIT_BASE_RADIUS = 110;  // px from star center to innermost orbit
const ORBIT_STEP = 55;          // px between successive orbits

// Asteroid belt lives between orbits 3 and 4 (indices 2 and 3)
const ASTEROID_BELT_INNER_INDEX = 2;
const ASTEROID_BELT_OUTER_INDEX = 3;

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

  // ── Audio ─────────────────────────────────────────────────────────────────
  private music: MusicGenerator | null = null;
  private ambient: AmbientSounds | null = null;
  private sfx: SfxGenerator | null = null;

  constructor() {
    super({ key: 'SystemViewScene' });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  create(data: { system: StarSystem }): void {
    if (!data?.system) {
      console.error('[SystemViewScene] No system data provided — returning to galaxy map');
      this.scene.start('GalaxyMapScene');
      return;
    }
    this.system = data.system;
    this.orbitEntries = [];

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Background
    this.add.rectangle(0, 0, width, height, 0x05050f).setOrigin(0, 0);

    // Starfield backdrop
    this.createStarfield(width, height);

    // System title
    this.add.text(cx, 28, this.system.name, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#d4af6a',
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, 56, this.system.starType.replace('_', ' ').toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#7799bb',
      letterSpacing: 3,
    }).setOrigin(0.5, 0.5);

    // Star at center (procedural)
    const starRenderer = new StarRenderer(this);
    starRenderer.render(this.system.starType, cx, cy);

    // Orbits + planets + asteroid belt
    this.createOrbits(cx, cy);

    // Tooltip
    this.createTooltip();

    // Back button
    this.createBackButton();

    // ── Audio ──────────────────────────────────────────────────────────────────
    const audioEngine = getAudioEngine();
    if (audioEngine) {
      audioEngine.resume();

      if (!this.music) {
        this.music = new MusicGenerator(audioEngine);
      }
      if (!this.ambient) {
        this.ambient = new AmbientSounds(audioEngine);
      }
      if (!this.sfx) {
        this.sfx = new SfxGenerator(audioEngine);
      }

      this.music.crossfadeTo('system');
      this.ambient.startSystemAmbient(this.system.starType);
    }
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
    for (let i = 0; i < 220; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const r = Phaser.Math.FloatBetween(0.3, 1.4);
      const brightness = Phaser.Math.FloatBetween(0.08, 0.45);
      const v = Math.round(brightness * 255);
      const color = (v << 16) | (v << 8) | v;
      g.fillStyle(color, 1);
      g.fillCircle(x, y, r);
    }
  }

  // ── Orbits + planets ──────────────────────────────────────────────────────────

  private createOrbits(cx: number, cy: number): void {
    const planets = [...this.system.planets].sort((a, b) => a.orbitalIndex - b.orbitalIndex);
    const planetRenderer = new PlanetRenderer(this);

    // Determine asteroid belt orbit radii if we have enough planets
    const beltInnerR = ORBIT_BASE_RADIUS + ASTEROID_BELT_INNER_INDEX * ORBIT_STEP;
    const beltOuterR = ORBIT_BASE_RADIUS + ASTEROID_BELT_OUTER_INDEX * ORBIT_STEP;
    let asteroidBeltDrawn = false;

    for (let i = 0; i < planets.length; i++) {
      const planet = planets[i]!;
      const orbitRadius = ORBIT_BASE_RADIUS + i * ORBIT_STEP;

      // Draw asteroid belt between orbits 3 and 4 (once)
      if (!asteroidBeltDrawn && i === ASTEROID_BELT_OUTER_INDEX && planets.length > ASTEROID_BELT_OUTER_INDEX) {
        renderAsteroidBelt(this, cx, cy, beltInnerR + 8, beltOuterR - 8);
        asteroidBeltDrawn = true;
      }

      // Orbit ring (faint dashed-ish circle)
      const orbitRing = this.add.circle(cx, cy, orbitRadius);
      orbitRing.setStrokeStyle(1, 0x334466, 0.25);

      // Initial angle spread evenly
      const startAngle = (i / planets.length) * Math.PI * 2;

      // Angular speed: faster for inner orbits (Kepler-ish: ω ∝ 1/r^1.5)
      const baseSpeed = 0.00004;
      const speed = baseSpeed / Math.pow(orbitRadius / ORBIT_BASE_RADIUS, 1.2);

      // Planet position
      const px = cx + Math.cos(startAngle) * orbitRadius;
      const py = cy + Math.sin(startAngle) * orbitRadius;

      const container = this.createPlanetObject(planetRenderer, planet, px, py);

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

  private createPlanetObject(
    planetRenderer: PlanetRenderer,
    planet: Planet,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const result = planetRenderer.render(planet, x, y);
    const container = result.container;
    const radius = result.radius;

    // Interactive hit area (invisible circle slightly larger than planet)
    const hitArea = this.add.circle(0, 0, radius + 7, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });

    // Highlight ring (shown on hover)
    const highlight = this.add.graphics();
    highlight.setVisible(false);

    hitArea.on('pointerover', () => {
      highlight.clear();
      highlight.lineStyle(1.5, 0xffffff, 0.85);
      highlight.strokeCircle(0, 0, radius + 2);
      highlight.setVisible(true);
      this.showTooltip(planet, x, y);
      // Play planet proximity ambient
      this.ambient?.playPlanetAmbient(planet.type);
      this.sfx?.playHover();
    });

    hitArea.on('pointerout', () => {
      highlight.setVisible(false);
      this.hideTooltip();
      // Stop planet ambient when no longer hovering
      this.ambient?.stopPlanetAmbient();
    });

    hitArea.on('pointerdown', () => {
      this.sfx?.playClick();
      this.game.events.emit('planet:selected', planet);
    });

    container.add([highlight, hitArea]);
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
    const pointer = this.input.activePointer;
    const px = pointer.x + 14;
    const py = pointer.y - 8;

    const typeLabel = PLANET_LABELS[planet.type];
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

    btn.on('pointerover', () => {
      btn.setColor('#ffffff');
      this.sfx?.playHover();
    });
    btn.on('pointerout', () => btn.setColor('#7799bb'));
    btn.on('pointerdown', () => {
      this.sfx?.playClick();
      this.ambient?.stopAll();
      this.music?.crossfadeTo('galaxy');
      this.scene.start('GalaxyMapScene');
    });
  }
}
