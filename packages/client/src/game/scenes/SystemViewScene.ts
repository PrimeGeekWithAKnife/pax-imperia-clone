import Phaser from 'phaser';
import type { StarSystem, Planet, PlanetType } from '@nova-imperia/shared';
import { StarRenderer } from '../rendering/StarRenderer';
import { PlanetRenderer, renderAsteroidBelt } from '../rendering/PlanetRenderer';
import { getAudioEngine, MusicGenerator, AmbientSounds, SfxGenerator } from '../../audio';
import type { MusicTrack } from '../../audio';
import { getGameEngine } from '../../engine/GameEngine';
import type { MigrationOrder } from '../../engine/migration';

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

// ── Colony ship animation ─────────────────────────────────────────────────────

/**
 * A single animated colony ship travelling from source to target planet.
 * Ships travel along a quadratic bezier arc.
 */
interface ColonyShip {
  /** Graphics object representing the tiny triangular ship + glow trail. */
  gfx: Phaser.GameObjects.Graphics;
  /** Progress along the path, 0 (source) → 1 (target). */
  t: number;
  /** Speed of travel per ms (fraction of path per ms). */
  speed: number;
  /** Control point for the bezier arc. */
  cx: number;
  cy: number;
  /** Source world position. */
  sx: number;
  sy: number;
  /** Target world position. */
  tx: number;
  ty: number;
  /** Alpha of this ship (fades in/out at ends of journey). */
  alpha: number;
}

/** One active wave animation — may contain 2–3 ships. */
interface MigrationAnimation {
  migrationId: string;
  sourcePlanetId: string;
  targetPlanetId: string;
  ships: ColonyShip[];
}

export class SystemViewScene extends Phaser.Scene {
  private system!: StarSystem;
  private orbitEntries: OrbitEntry[] = [];

  // UI
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;

  // Colony ship animations
  private migrationAnimations: MigrationAnimation[] = [];

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

      // Apply the player's chosen track before starting
      const sessionTrack = (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ as MusicTrack | undefined;
      if (sessionTrack) this.music.setTrack(sessionTrack);

      this.music.crossfadeTo('system');
      this.ambient.startSystemAmbient(this.system.starType);
    }

    // ── Colonise action listener ───────────────────────────────────────────────
    // React emits 'colony:colonise' on the Phaser game events when the player
    // clicks the Colonise button in PlanetDetailPanel.
    this.game.events.on('colony:colonise', this.handleColoniseAction, this);

    // ── Migration action listeners ─────────────────────────────────────────────
    // React emits 'colony:start_migration' when the player clicks Colonise on an
    // unowned planet (now the migration-first flow).
    this.game.events.on('colony:start_migration', this.handleStartMigrationAction, this);

    // Engine emits 'engine:migration_wave' each time a wave departs.
    this.game.events.on('engine:migration_wave', this.handleMigrationWave, this);

    // Check existing migrations when entering the scene (e.g. loading a save)
    this._syncMigrationAnimations();

    // Render ships already present in this system
    this._renderShipIndicators();

    // Refresh ship indicators on each engine tick so newly built ships appear
    this.game.events.on('engine:tick', this._handleEngineTick, this);

    // Music track change — player selects a new mood from the Settings panel
    this.game.events.on('music:set_track', (track: unknown) => {
      this.music?.setTrack(track as MusicTrack);
    });

    // Notify React which system is currently being viewed so PlanetDetailPanel
    // receives a valid systemId even when the galaxy-map selectedSystem is null.
    this.game.events.emit('system:entered', { systemId: this.system.id });

    // Clean up listeners and notify React when the scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('colony:colonise', this.handleColoniseAction, this);
      this.game.events.off('colony:start_migration', this.handleStartMigrationAction, this);
      this.game.events.off('engine:migration_wave', this.handleMigrationWave, this);
      this.game.events.off('engine:tick', this._handleEngineTick, this);
      this._clearMigrationAnimations();
      // Destroy ship indicators
      for (const [, container] of this.shipIndicators) {
        container.destroy();
      }
      this.shipIndicators.clear();
      this.game.events.emit('system:exited');
    });
  }

  update(_time: number, delta: number): void {
    for (const entry of this.orbitEntries) {
      entry.angle += entry.speed * delta;
      const cx = this.scale.width / 2 + Math.cos(entry.angle) * entry.orbitRadius;
      const cy = this.scale.height / 2 + Math.sin(entry.angle) * entry.orbitRadius;
      entry.container.setPosition(cx, cy);
    }

    // Update colony ship animations
    this._updateMigrationAnimations(delta);
  }

  // ── Colonise action ───────────────────────────────────────────────────────────

  private handleColoniseAction = (payload: unknown): void => {
    const { systemId, planetId, empireId } = payload as {
      systemId: string;
      planetId: string;
      empireId: string;
    };

    // Only handle events for this scene's system
    if (systemId !== this.system?.id) return;

    const engine = getGameEngine();
    if (!engine) {
      console.warn('[SystemViewScene] Colonise action received but GameEngine is not available');
      return;
    }

    engine.executeAction({ type: 'ColonisePlanet', empireId, systemId, planetId });
  };

  // ── Migration actions ─────────────────────────────────────────────────────────

  private handleStartMigrationAction = (payload: unknown): void => {
    const { systemId, targetPlanetId } = payload as {
      systemId: string;
      targetPlanetId: string;
      empireId: string;
    };

    if (systemId !== this.system?.id) return;

    const engine = getGameEngine();
    if (!engine) {
      console.warn('[SystemViewScene] start_migration received but GameEngine is not available');
      return;
    }

    // Find a suitable source planet (first owned planet in this system)
    const ownedPlanet = this.system.planets.find(p => p.ownerId !== null);
    if (!ownedPlanet) {
      console.warn('[SystemViewScene] No owned planet in system to source migrants from');
      return;
    }

    engine.startMigration(systemId, ownedPlanet.id, targetPlanetId);
  };

  private handleMigrationWave = (payload: unknown): void => {
    const { migration } = payload as { migration: MigrationOrder };
    if (migration.systemId !== this.system?.id) return;
    this._spawnWaveAnimation(migration);
  };

  // ── Colony ship animations ────────────────────────────────────────────────────

  /**
   * Get the current world position of a planet by its ID.
   * Returns null if the planet's orbit entry is not found.
   */
  private _getPlanetWorldPos(planetId: string): { x: number; y: number } | null {
    const entry = this.orbitEntries.find(e => e.planet.id === planetId);
    if (!entry) return null;
    return { x: entry.container.x, y: entry.container.y };
  }

  /**
   * Spawn 2–3 staggered colony ships along the arc from source to target.
   */
  private _spawnWaveAnimation(migration: MigrationOrder): void {
    const sourcePos = this._getPlanetWorldPos(migration.sourcePlanetId);
    const targetPos = this._getPlanetWorldPos(migration.targetPlanetId);
    if (!sourcePos || !targetPos) return;

    // Perpendicular offset for the bezier control point — creates a gentle arc
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const perpX = -dy * 0.3;
    const perpY = dx * 0.3;

    const ships: ColonyShip[] = [];
    const SHIP_COUNT = 3;
    for (let i = 0; i < SHIP_COUNT; i++) {
      const gfx = this.add.graphics();
      gfx.setDepth(150);
      ships.push({
        gfx,
        t: -(i * 0.25),        // stagger: ships depart at t = 0, -0.25, -0.5
        speed: 0.00025,         // path fraction per ms (~4 s full transit at 60 fps)
        cx: midX + perpX,
        cy: midY + perpY,
        sx: sourcePos.x,
        sy: sourcePos.y,
        tx: targetPos.x,
        ty: targetPos.y,
        alpha: 0,
      });
    }

    // Find existing animation for this migration or create one
    let anim = this.migrationAnimations.find(a => a.migrationId === migration.id);
    if (!anim) {
      anim = {
        migrationId: migration.id,
        sourcePlanetId: migration.sourcePlanetId,
        targetPlanetId: migration.targetPlanetId,
        ships: [],
      };
      this.migrationAnimations.push(anim);
    }
    anim.ships.push(...ships);
  }

  /**
   * Update all colony ship positions, redraw them, and remove ships that have arrived.
   */
  private _updateMigrationAnimations(delta: number): void {
    for (const anim of this.migrationAnimations) {
      const toRemove: ColonyShip[] = [];

      // Update source/target positions live (planets are orbiting)
      const sourcePos = this._getPlanetWorldPos(anim.sourcePlanetId);
      const targetPos = this._getPlanetWorldPos(anim.targetPlanetId);

      for (const ship of anim.ships) {
        ship.t += ship.speed * delta;

        // Update bezier control point if planets moved
        if (sourcePos && targetPos) {
          ship.sx = sourcePos.x;
          ship.sy = sourcePos.y;
          ship.tx = targetPos.x;
          ship.ty = targetPos.y;
          const midX = (sourcePos.x + targetPos.x) / 2;
          const midY = (sourcePos.y + targetPos.y) / 2;
          const dx = targetPos.x - sourcePos.x;
          const dy = targetPos.y - sourcePos.y;
          ship.cx = midX - dy * 0.3;
          ship.cy = midY + dx * 0.3;
        }

        const tc = Math.max(0, Math.min(1, ship.t));

        // Alpha: fade in over first 10%, fade out over last 10%
        if (ship.t < 0) {
          ship.alpha = 0;
        } else if (tc < 0.1) {
          ship.alpha = tc / 0.1;
        } else if (tc > 0.9) {
          ship.alpha = (1 - tc) / 0.1;
        } else {
          ship.alpha = 1;
        }

        if (ship.t >= 1) {
          ship.gfx.destroy();
          toRemove.push(ship);
          continue;
        }

        if (ship.t < 0) {
          ship.gfx.clear();
          continue;
        }

        // Quadratic bezier position
        const t = tc;
        const invT = 1 - t;
        const px = invT * invT * ship.sx + 2 * invT * t * ship.cx + t * t * ship.tx;
        const py = invT * invT * ship.sy + 2 * invT * t * ship.cy + t * t * ship.ty;

        // Direction tangent for ship rotation
        const dtx = 2 * invT * (ship.cx - ship.sx) + 2 * t * (ship.tx - ship.cx);
        const dty = 2 * invT * (ship.cy - ship.sy) + 2 * t * (ship.ty - ship.cy);
        const angle = Math.atan2(dty, dtx);

        this._drawColonyShip(ship.gfx, px, py, angle, ship.alpha);
      }

      for (const dead of toRemove) {
        anim.ships.splice(anim.ships.indexOf(dead), 1);
      }
    }

    // Remove animations with no living ships
    this.migrationAnimations = this.migrationAnimations.filter(a => a.ships.length > 0);
  }

  /**
   * Draw a tiny triangular colony ship with an engine glow trail.
   *
   * @param gfx   Graphics object to draw into (cleared before each draw)
   * @param x     World X of the ship nose
   * @param y     World Y of the ship nose
   * @param angle Heading in radians
   * @param alpha Overall opacity 0–1
   */
  private _drawColonyShip(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    angle: number,
    alpha: number,
  ): void {
    gfx.clear();
    if (alpha <= 0) return;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Helper: rotate a local offset (lx, ly) around the ship's heading
    const rot = (lx: number, ly: number): [number, number] => [
      x + cos * lx - sin * ly,
      y + sin * lx + cos * ly,
    ];

    // ── Engine glow trail (behind the ship) ───────────────────────────────
    const trailLen = 8;
    gfx.fillStyle(0x00aaff, 0.35 * alpha);
    gfx.fillCircle(...rot(-trailLen * 0.5, 0), 2);
    gfx.fillStyle(0x0066cc, 0.18 * alpha);
    gfx.fillCircle(...rot(-trailLen, 0), 1.5);
    gfx.fillStyle(0x003399, 0.10 * alpha);
    gfx.fillCircle(...rot(-trailLen * 1.5, 0), 1);

    // ── Triangular hull ───────────────────────────────────────────────────
    //  Nose at (4, 0), wings at (-3, ±3)
    const [nx, ny] = rot(4, 0);
    const [lx, ly] = rot(-3, 3);
    const [rx, ry] = rot(-3, -3);

    gfx.fillStyle(0xaaddff, 0.92 * alpha);
    gfx.fillTriangle(nx, ny, lx, ly, rx, ry);

    // ── Bright engine core dot ────────────────────────────────────────────
    gfx.fillStyle(0xffffff, 0.85 * alpha);
    gfx.fillCircle(...rot(-2, 0), 1);
  }

  /**
   * Spawn animations for any migrations already active in this system when the
   * scene first loads (handles the case where the player navigates away and back).
   */
  private _syncMigrationAnimations(): void {
    const engine = getGameEngine();
    if (!engine) return;
    const activeMigrations = engine.getActiveMigrations(this.system.id);
    for (const migration of activeMigrations) {
      this._spawnWaveAnimation(migration);
    }
  }

  /** Destroy all colony ship graphics objects. */
  private _clearMigrationAnimations(): void {
    for (const anim of this.migrationAnimations) {
      for (const ship of anim.ships) {
        ship.gfx.destroy();
      }
    }
    this.migrationAnimations = [];
  }

  /** Called on each engine tick — refresh ship indicators and ownership visuals. */
  private _handleEngineTick = (): void => {
    this._renderShipIndicators();
  };

  // ── Ship rendering ───────────────────────────────────────────────────────────

  /** Ship indicator graphics objects, keyed by ship.id */
  private shipIndicators: Map<string, Phaser.GameObjects.Container> = new Map();

  /**
   * Render ship indicators for all ships currently positioned in this system.
   * Called on create and refreshed each tick.
   */
  private _renderShipIndicators(): void {
    const engine = getGameEngine();
    if (!engine) return;

    const state = engine.getState();
    const shipsInSystem = state.gameState.ships.filter(
      s => s.position.systemId === this.system.id,
    );

    // Track which ship IDs are still present
    const currentIds = new Set(shipsInSystem.map(s => s.id));

    // Remove indicators for ships that are gone
    for (const [id, container] of this.shipIndicators) {
      if (!currentIds.has(id)) {
        container.destroy();
        this.shipIndicators.delete(id);
      }
    }

    // Add/update indicators for ships in this system
    for (const ship of shipsInSystem) {
      if (this.shipIndicators.has(ship.id)) continue; // already shown

      // Position the ship near its planet orbit, or in the center if no orbit
      let sx = this.scale.width / 2 + 40;
      let sy = this.scale.height / 2 - 40;

      if (ship.position.orbitIndex !== undefined) {
        const entry = this.orbitEntries[ship.position.orbitIndex];
        if (entry) {
          sx = entry.container.x + 18;
          sy = entry.container.y - 18;
        }
      }

      const container = this.add.container(sx, sy);
      container.setDepth(160);

      // Ship triangle icon
      const gfx = this.add.graphics();
      gfx.fillStyle(0x00d4ff, 0.9);
      gfx.fillTriangle(0, -6, -5, 5, 5, 5);
      gfx.lineStyle(1, 0x00d4ff, 0.5);
      gfx.strokeCircle(0, 0, 10);
      container.add(gfx);

      // Ship name label
      const label = this.add.text(12, -6, ship.name, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#88ddff',
      });
      container.add(label);

      // Make clickable
      const hitArea = this.add.circle(0, 0, 12, 0xffffff, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        this.sfx?.playClick();
        // Emit fleet:selected so the fleet panel opens
        const fleet = state.gameState.fleets.find(f => f.id === ship.fleetId);
        if (fleet) {
          const fleetShips = state.gameState.ships.filter(s => s.fleetId === fleet.id);
          this.game.events.emit('fleet:selected', { fleet, ships: fleetShips });
        }
      });
      container.add(hitArea);

      this.shipIndicators.set(ship.id, container);
    }
  }

  // ── Latest planet helper ─────────────────────────────────────────────────────

  /**
   * Fetch the current planet state from the engine so the UI never shows stale data.
   */
  private _getLatestPlanet(planetId: string, engine?: ReturnType<typeof getGameEngine>): Planet | null {
    const eng = engine ?? getGameEngine();
    if (!eng) return null;
    const system = eng.getState().gameState.galaxy.systems.find(
      s => s.id === this.system.id,
    );
    return system?.planets.find(p => p.id === planetId) ?? null;
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

    // ── Ownership / colonisation visual indicators ──────────────────────────
    // Colonised (has population) but not owned: slightly dimmed opacity
    if (planet.currentPopulation === 0 && planet.maxPopulation === 0) {
      // Uninhabitable — render at reduced opacity
      container.setAlpha(0.55);
    }

    if (planet.ownerId !== null) {
      // Owned planet: draw a coloured ownership ring around it
      const ownerRing = this.add.graphics();
      // Player-owned planets glow cyan; AI-owned planets would differ in a full game
      ownerRing.lineStyle(2, 0x00d4ff, 0.75);
      ownerRing.strokeCircle(0, 0, radius + 4);
      container.add(ownerRing);

      // Small flag marker above the planet
      const flag = this.add.graphics();
      flag.fillStyle(0x00d4ff, 0.9);
      flag.fillRect(-4, -(radius + 14), 8, 6);
      flag.lineStyle(1, 0x00d4ff, 1);
      flag.lineBetween(0, -(radius + 14), 0, -(radius + 4));
      container.add(flag);
    } else if (planet.currentPopulation > 0) {
      // Colonised but not owned by player — neutral marker
      const colonyRing = this.add.graphics();
      colonyRing.lineStyle(1.5, 0x888888, 0.55);
      colonyRing.strokeCircle(0, 0, radius + 4);
      container.add(colonyRing);
    }

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
      // Always fetch the latest planet data from the engine so the UI never
      // shows stale ownership / migration state (fixes Bug 1 & 6).
      const engine = getGameEngine();
      const latestPlanet = this._getLatestPlanet(planet.id, engine) ?? planet;
      this.game.events.emit('planet:selected', latestPlanet);
      // If the player owns this planet, also open the management screen
      if (latestPlanet.ownerId !== null) {
        this.game.events.emit('planet:manage', { planet: latestPlanet, systemId: this.system.id });
      }
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
