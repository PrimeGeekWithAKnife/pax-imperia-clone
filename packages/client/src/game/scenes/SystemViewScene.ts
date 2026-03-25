import Phaser from 'phaser';
import type { StarSystem, Planet, PlanetType } from '@nova-imperia/shared';
import { StarRenderer } from '../rendering/StarRenderer';
import { PlanetRenderer, renderAsteroidBelt } from '../rendering/PlanetRenderer';
import { getAudioEngine, MusicGenerator, AmbientSounds, SfxGenerator } from '../../audio';
import type { MusicTrack } from '../../audio';
import { getGameEngine, destroyGameEngine } from '../../engine/GameEngine';
import type { MigrationOrder } from '../../engine/migration';
import type { GameTickState, GameSpeedName } from '@nova-imperia/shared';
import { getTickRate } from '@nova-imperia/shared';
import { renderShipIcon } from '../../assets/graphics/ShipGraphics';
import type { HullClass } from '@nova-imperia/shared';

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

// ── Zoom / pan constants ──────────────────────────────────────────────────────

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_DEFAULT = 1.0;
const ZOOM_FACTOR = 0.1;   // zoom step per wheel tick
const ZOOM_LERP = 0.12;    // fraction lerped per frame

/**
 * Hull class priority for selecting a representative fleet icon — higher
 * index = larger / more imposing ship, used as the fleet badge thumbnail.
 */
const HULL_CLASS_RANK: Record<HullClass, number> = {
  deep_space_probe: 0,
  scout: 1,
  transport: 2,
  coloniser: 3,
  destroyer: 4,
  cruiser: 5,
  carrier: 6,
  battleship: 7,
  dreadnought: 8,
  battle_station: 9,
};

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
 * Micro-sized amber/gold dot with a tiny trail, part of a loose swarm.
 */
interface ColonyShip {
  /** Graphics object representing the tiny dot + glow trail. */
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
  /** Perpendicular swarm wobble offset (constant per ship). */
  swarmOffset: number;
}

/** One active wave animation — may contain 8–12 ships. */
interface MigrationAnimation {
  migrationId: string;
  sourcePlanetId: string;
  targetPlanetId: string;
  ships: ColonyShip[];
}

export class SystemViewScene extends Phaser.Scene {
  private system!: StarSystem;
  private orbitEntries: OrbitEntry[] = [];

  // ── World container (zoomed + panned) ─────────────────────────────────────
  private worldContainer!: Phaser.GameObjects.Container;

  // ── Zoom / pan state ──────────────────────────────────────────────────────
  private currentZoom = ZOOM_DEFAULT;
  private targetZoom = ZOOM_DEFAULT;
  private cameraOffset = { x: 0, y: 0 };
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  /** Last pointer position used to compute zoom-toward-cursor. */
  private lastPointerPos = { x: 0, y: 0 };

  // UI (screen-space — not inside worldContainer)
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
      this.scene.start('GalaxyMapScene', {});
      return;
    }
    this.system = data.system;
    this.orbitEntries = [];
    this.currentZoom = ZOOM_DEFAULT;
    this.targetZoom = ZOOM_DEFAULT;
    this.isDragging = false;

    const { width, height } = this.scale;

    // ── Fixed background (screen-space) ───────────────────────────────────
    this.add.rectangle(0, 0, width, height, 0x05050f).setOrigin(0, 0);
    this.createStarfield(width, height);

    // ── HUD labels (screen-space) ─────────────────────────────────────────
    const cx = width / 2;
    this.add.text(cx, 28, this.system.name, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#d4af6a',
    }).setOrigin(0.5, 0.5).setDepth(300);

    this.add.text(cx, 56, this.system.starType.replace('_', ' ').toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#7799bb',
      letterSpacing: 3,
    }).setOrigin(0.5, 0.5).setDepth(300);

    // ── World container — everything in here is zoomed + panned ──────────
    this.worldContainer = this.add.container(0, 0);
    this.cameraOffset = { x: width / 2, y: height / 2 };
    this._applyWorldTransform();

    // Star at center (procedural) — world-space origin (0, 0 in worldContainer)
    const starRenderer = new StarRenderer(this);
    const starResult = starRenderer.render(this.system.starType, 0, 0);
    this.worldContainer.add(starResult.objects);

    // Orbits + planets + asteroid belt
    this.createOrbits();

    // Tooltip (screen-space)
    this.createTooltip();

    // Back button (screen-space)
    this.createBackButton();

    // ── Input ─────────────────────────────────────────────────────────────
    this._setupInput();

    // ── Audio ──────────────────────────────────────────────────────────────
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

    // ── Speed change listener ─────────────────────────────────────────────
    this.game.events.on('ui:speed_change', this._handleSpeedChange, this);

    // ── Music track change ─────────────────────────────────────────────────
    this.game.events.on('music:set_track', this._handleMusicTrack, this);

    // ── Exit to main menu ─────────────────────────────────────────────────
    this.game.events.on('ui:exit_to_menu', this._handleExitToMenu, this);

    // ── Colonise action listeners ──────────────────────────────────────────
    this.game.events.on('colony:colonise', this.handleColoniseAction, this);
    this.game.events.on('colony:colonise_with_ship', this._handleColoniseWithShip, this);

    // ── Migration action listeners ─────────────────────────────────────────
    this.game.events.on('colony:start_migration', this.handleStartMigrationAction, this);
    this.game.events.on('engine:migration_wave', this.handleMigrationWave, this);

    // ── Game event SFX listeners ───────────────────────────────────────────
    this.game.events.on('engine:migration_started', this._handleMigrationStartedSfx, this);
    this.game.events.on('engine:migration_completed', this._handleMigrationCompletedSfx, this);
    this.game.events.on('engine:ship_produced', this._handleShipProducedSfx, this);
    this.game.events.on('engine:planet_updated', this._handlePlanetUpdatedSfx, this);
    this.game.events.on('engine:tech_researched', this._handleTechResearchedSfx, this);

    // ── Colonisation landing animation listeners ──────────────────────────
    this.game.events.on('engine:planet_colonised', this._handlePlanetColonised, this);
    this.game.events.on('engine:migration_completed', this._handleMigrationCompletedLanding, this);

    // Check existing migrations when entering the scene (e.g. loading a save)
    this._syncMigrationAnimations();

    // Render ships already present in this system
    this._renderShipIndicators();

    // Refresh ship indicators on each engine tick so newly built ships appear
    this.game.events.on('engine:tick', this._handleEngineTick, this);

    // Relocate Fleet — switch to galaxy map with move mode activated
    this.game.events.on('scene:request_galaxy_view', this._handleRequestGalaxyView, this);

    // Minimap click — return to galaxy map view
    this.game.events.on('minimap:navigate', this._handleMinimapNavigate, this);

    // Notify React which system is currently being viewed
    this.game.events.emit('system:entered', { systemId: this.system.id });

    // Clean up ALL listeners and notify React when the scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('ui:speed_change', this._handleSpeedChange, this);
      this.game.events.off('music:set_track', this._handleMusicTrack, this);
      this.game.events.off('ui:exit_to_menu', this._handleExitToMenu, this);
      this.game.events.off('colony:colonise', this.handleColoniseAction, this);
      this.game.events.off('colony:colonise_with_ship', this._handleColoniseWithShip, this);
      this.game.events.off('colony:start_migration', this.handleStartMigrationAction, this);
      this.game.events.off('engine:migration_wave', this.handleMigrationWave, this);
      this.game.events.off('engine:migration_started', this._handleMigrationStartedSfx, this);
      this.game.events.off('engine:migration_completed', this._handleMigrationCompletedSfx, this);
      this.game.events.off('engine:ship_produced', this._handleShipProducedSfx, this);
      this.game.events.off('engine:planet_updated', this._handlePlanetUpdatedSfx, this);
      this.game.events.off('engine:tech_researched', this._handleTechResearchedSfx, this);
      this.game.events.off('engine:planet_colonised', this._handlePlanetColonised, this);
      this.game.events.off('engine:migration_completed', this._handleMigrationCompletedLanding, this);
      this.game.events.off('engine:tick', this._handleEngineTick, this);
      this.game.events.off('scene:request_galaxy_view', this._handleRequestGalaxyView, this);
      this.game.events.off('minimap:navigate', this._handleMinimapNavigate, this);
      this._clearMigrationAnimations();
      // Destroy ship indicators
      for (const [, sprites] of this.shipSprites) {
        for (const s of sprites) s.destroy();
      }
      this.shipSprites.clear();
      for (const [, badge] of this.fleetBadges) {
        badge.destroy();
      }
      this.fleetBadges.clear();
      this.game.events.emit('system:exited');
    });
  }

  update(_time: number, delta: number): void {
    // Advance planet orbits — positions are in world-space (worldContainer)
    for (const entry of this.orbitEntries) {
      entry.angle += entry.speed * delta;
      const px = Math.cos(entry.angle) * entry.orbitRadius;
      const py = Math.sin(entry.angle) * entry.orbitRadius;
      entry.container.setPosition(px, py);
    }

    // Update colony ship animations
    this._updateMigrationAnimations(delta);

    // Smooth zoom lerp
    this._updateZoomLerp();
  }

  // ── Zoom / pan ────────────────────────────────────────────────────────────────

  private _setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.isDragging = true;
        this.dragStart.x = pointer.x - this.cameraOffset.x;
        this.dragStart.y = pointer.y - this.cameraOffset.y;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.lastPointerPos.x = pointer.x;
      this.lastPointerPos.y = pointer.y;
      if (this.isDragging && pointer.isDown) {
        this.cameraOffset.x = pointer.x - this.dragStart.x;
        this.cameraOffset.y = pointer.y - this.dragStart.y;
        this._applyWorldTransform();
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (
      pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const prevTarget = this.targetZoom;
      const zoomDelta = deltaY > 0 ? -ZOOM_FACTOR : ZOOM_FACTOR;
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom + zoomDelta, MIN_ZOOM, MAX_ZOOM);

      // Zoom toward/away from the pointer position
      // We want pointer world-pos to stay fixed as zoom changes.
      // new_offset = pointer - (pointer - old_offset) * (newZoom / oldZoom)
      const ratio = this.targetZoom / prevTarget;
      this.cameraOffset.x = pointer.x + (this.cameraOffset.x - pointer.x) * ratio;
      this.cameraOffset.y = pointer.y + (this.cameraOffset.y - pointer.y) * ratio;
    });

    // Prevent browser zoom (Ctrl+scroll) from firing alongside game zoom
    this.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
    }, { passive: false });
  }

  private _applyWorldTransform(): void {
    this.worldContainer.setPosition(this.cameraOffset.x, this.cameraOffset.y);
    this.worldContainer.setScale(this.currentZoom);
  }

  private _updateZoomLerp(): void {
    if (Math.abs(this.currentZoom - this.targetZoom) < 0.001) return;

    const prevZoom = this.currentZoom;
    this.currentZoom = Phaser.Math.Linear(this.currentZoom, this.targetZoom, ZOOM_LERP);

    // Keep the world position anchored to the last pointer position during lerp
    const ratio = this.currentZoom / prevZoom;
    const px = this.lastPointerPos.x;
    const py = this.lastPointerPos.y;
    this.cameraOffset.x = px + (this.cameraOffset.x - px) * ratio;
    this.cameraOffset.y = py + (this.cameraOffset.y - py) * ratio;

    this._applyWorldTransform();
  }

  // ── Colonise action ───────────────────────────────────────────────────────────

  private handleColoniseAction = (payload: unknown): void => {
    const { systemId, planetId, empireId } = payload as {
      systemId: string;
      planetId: string;
      empireId: string;
    };

    if (systemId !== this.system?.id) return;

    const engine = getGameEngine();
    if (!engine) {
      console.warn('[SystemViewScene] Colonise action received but GameEngine is not available');
      return;
    }

    engine.executeAction({ type: 'ColonisePlanet', empireId, systemId, planetId });
  };

  private _handleColoniseWithShip = (payload: unknown): void => {
    const { fleetId, planetId, empireId } = payload as {
      fleetId: string;
      planetId: string;
      empireId: string;
    };

    const engine = getGameEngine();
    if (!engine) return;

    engine.executeAction({ type: 'ColonizePlanet', fleetId, planetId });
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
    this.sfx?.playMigrationWave();
  };

  // ── Colony ship animations ────────────────────────────────────────────────────

  /**
   * Get the current world position of a planet by its ID (relative to worldContainer origin).
   */
  private _getPlanetWorldPos(planetId: string): { x: number; y: number } | null {
    const entry = this.orbitEntries.find(e => e.planet.id === planetId);
    if (!entry) return null;
    return { x: entry.container.x, y: entry.container.y };
  }

  /**
   * Spawn 8–12 staggered micro colony ships along the arc from source to target.
   * Ships are amber/gold coloured micro-dots that travel in a loose swarm.
   */
  private _spawnWaveAnimation(migration: MigrationOrder): void {
    const sourcePos = this._getPlanetWorldPos(migration.sourcePlanetId);
    const targetPos = this._getPlanetWorldPos(migration.targetPlanetId);
    if (!sourcePos || !targetPos) return;

    // Sync animation travel time to game logic transit duration (TRANSIT_DURATION ticks).
    // At normal speed: 5 ticks × 2000ms = 10,000ms for the journey.
    const engine = getGameEngine();
    const tickMs = engine ? getTickRate(engine.getState().gameState.speed as GameSpeedName) : 2000;
    const transitMs = 5 * Math.max(tickMs, 500); // TRANSIT_DURATION = 5 ticks

    const ships: ColonyShip[] = [];
    const SHIP_COUNT = Phaser.Math.Between(8, 12);
    const stagger = 0.08; // stagger between ships as fraction of total journey
    const totalStagger = stagger * (SHIP_COUNT - 1);
    // Last ship must arrive at t=1 exactly when transitMs elapses
    // Speed = (1 + totalStagger) / transitMs — ensures last ship arrives on time
    const baseSpeed = (1 + totalStagger) / transitMs;

    for (let i = 0; i < SHIP_COUNT; i++) {
      const gfx = this.add.graphics();
      gfx.setDepth(150);
      this.worldContainer.add(gfx);

      ships.push({
        gfx,
        t: -(i * stagger),
        speed: baseSpeed * (0.95 + Math.random() * 0.10), // slight variance
        cx: 0,
        cy: 0,
        sx: sourcePos.x,
        sy: sourcePos.y,
        tx: targetPos.x,
        ty: targetPos.y,
        alpha: 0,
        swarmOffset: (Math.random() - 0.5) * 8,
      });
    }

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
   * Update all colony ship positions and redraw them.
   */
  private _updateMigrationAnimations(delta: number): void {
    for (const anim of this.migrationAnimations) {
      const toRemove: ColonyShip[] = [];

      const sourcePos = this._getPlanetWorldPos(anim.sourcePlanetId);
      const targetPos = this._getPlanetWorldPos(anim.targetPlanetId);

      for (const ship of anim.ships) {
        ship.t += ship.speed * delta;

        if (sourcePos && targetPos) {
          ship.sx = sourcePos.x;
          ship.sy = sourcePos.y;
          ship.tx = targetPos.x;
          ship.ty = targetPos.y;

          // Compute bezier control point: perpendicular to path with swarm offset
          const midX = (sourcePos.x + targetPos.x) / 2;
          const midY = (sourcePos.y + targetPos.y) / 2;
          const dx = targetPos.x - sourcePos.x;
          const dy = targetPos.y - sourcePos.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = (-dy / len) * (20 + ship.swarmOffset);
          const perpY = (dx / len) * (20 + ship.swarmOffset);
          ship.cx = midX + perpX;
          ship.cy = midY + perpY;
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

        this._drawColonyShip(ship.gfx, px, py, ship.alpha);
      }

      for (const dead of toRemove) {
        anim.ships.splice(anim.ships.indexOf(dead), 1);
      }
    }

    this.migrationAnimations = this.migrationAnimations.filter(a => a.ships.length > 0);
  }

  /**
   * Draw a micro amber/gold colony ship dot with a tiny warm trail.
   * Much smaller than military ships — 3–4 px dots.
   *
   * @param gfx   Graphics object to draw into (cleared before each draw)
   * @param x     World X position
   * @param y     World Y position
   * @param alpha Overall opacity 0–1
   */
  private _drawColonyShip(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    alpha: number,
  ): void {
    gfx.clear();
    if (alpha <= 0) return;

    // Warm amber trail dots behind — 50% smaller for graceful, subtle effect
    gfx.fillStyle(0xcc6600, 0.25 * alpha);
    gfx.fillCircle(x - 1.5, y, 0.4);
    gfx.fillStyle(0xff9900, 0.15 * alpha);
    gfx.fillCircle(x - 3, y, 0.25);

    // Main dot — amber/gold, halved to micro-dot
    gfx.fillStyle(0xffcc44, 0.95 * alpha);
    gfx.fillCircle(x, y, 0.6);

    // Bright core
    gfx.fillStyle(0xfff0aa, 0.90 * alpha);
    gfx.fillCircle(x, y, 0.25);
  }

  /**
   * Spawn animations for any migrations already active in this system when the
   * scene first loads.
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

  // ── Fleet rendering ──────────────────────────────────────────────────────────

  /**
   * Fleet icon objects keyed by fleet.id.
   * Each entry is a list of game objects (sprite, label, hit area) that
   * together represent one fleet icon in the system view.
   * We always show ONE icon per fleet (using the largest hull class as
   * the representative ship), matching the galaxy map behaviour.
   */
  private shipSprites: Map<string, Phaser.GameObjects.GameObject[]> = new Map();

  /**
   * Fleet badge containers keyed by `fleetId`.
   * Kept for compatibility with shutdown cleanup, but no longer used
   * as a separate zoom-dependent layer — we always show fleet icons.
   */
  private fleetBadges: Map<string, Phaser.GameObjects.Container> = new Map();

  /**
   * Render ONE fleet icon per fleet currently positioned in this system.
   * Uses the largest hull class in the fleet as the representative icon,
   * shows the fleet name (not individual ship names), and offsets
   * multiple fleets so they don't overlap.
   *
   * Called on create and refreshed each tick.
   */
  private _renderShipIndicators(): void {
    const engine = getGameEngine();
    if (!engine) return;

    const state = engine.getState();
    const designsMap = state.shipDesigns ?? new Map();

    // Find all fleets in this system
    const fleetsInSystem = state.gameState.fleets.filter(
      f => f.position.systemId === this.system.id && f.ships.length > 0,
    );

    const currentFleetIds = new Set(fleetsInSystem.map(f => f.id));

    // Remove indicators for fleets that are gone
    for (const [id, objects] of this.shipSprites) {
      if (!currentFleetIds.has(id)) {
        for (const o of objects) o.destroy();
        this.shipSprites.delete(id);
      }
    }

    // Build a map of empireId → empire.color for quick lookup
    const empireColours = new Map<string, string>();
    for (const empire of state.gameState.empires) {
      empireColours.set(empire.id, empire.color);
    }

    // Render one icon per fleet, offset vertically for multiple fleets
    for (let fleetIdx = 0; fleetIdx < fleetsInSystem.length; fleetIdx++) {
      const fleet = fleetsInSystem[fleetIdx]!;

      // Skip if already rendered (and still present)
      if (this.shipSprites.has(fleet.id)) continue;

      // Determine the largest hull class in this fleet for the representative icon
      const fleetShips = state.gameState.ships.filter(s => fleet.ships.includes(s.id));
      let bestHullClass: HullClass = 'deep_space_probe';
      let bestRank = -1;
      for (const ship of fleetShips) {
        const design = designsMap.get(ship.designId);
        const hull: HullClass = (design?.hull as HullClass | undefined) ?? 'scout';
        const rank = HULL_CLASS_RANK[hull];
        if (rank > bestRank) {
          bestRank = rank;
          bestHullClass = hull;
        }
      }

      // World-space position: offset each fleet vertically so they don't overlap
      const wx = 50 + fleetIdx * 40;
      const wy = -60 - fleetIdx * 30;

      const empireColor = empireColours.get(fleet.empireId) ?? '#4488cc';

      // Render ship icon at 32px
      const iconSize = 32;
      const dataUrl = renderShipIcon(bestHullClass, iconSize, empireColor);

      const objects: Phaser.GameObjects.GameObject[] = [];

      if (dataUrl) {
        const textureKey = `fleet_icon_${bestHullClass}_${empireColor.replace('#', '')}`;
        if (!this.textures.exists(textureKey)) {
          this.textures.addBase64(textureKey, dataUrl);
        }

        if (this.textures.exists(textureKey)) {
          this._createFleetIcon(fleet, fleetShips.length, wx, wy, textureKey, empireColor, iconSize, state, objects);
        } else {
          this.textures.once(`addtexture-${textureKey}`, () => {
            this._createFleetIcon(fleet, fleetShips.length, wx, wy, textureKey, empireColor, iconSize, state, objects);
          });
        }
      } else {
        // Fallback: simple triangle if canvas not available
        this._createFallbackFleetIndicator(fleet, fleetShips.length, wx, wy, empireColor, state, objects);
      }

      this.shipSprites.set(fleet.id, objects);
    }
  }

  private _createFleetIcon(
    fleet: { id: string; name: string },
    shipCount: number,
    wx: number,
    wy: number,
    textureKey: string,
    empireColor: string,
    iconSize: number,
    state: GameTickState,
    objects: Phaser.GameObjects.GameObject[],
  ): void {
    const sprite = this.add.image(wx, wy, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(iconSize, iconSize)
      .setDepth(160);
    this.worldContainer.add(sprite);
    objects.push(sprite);

    // Fleet name label (with ship count)
    const labelText = `${fleet.name} (${shipCount})`;
    const label = this.add.text(wx + iconSize * 0.6, wy - iconSize * 0.3, labelText, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#aaeeff',
      fontStyle: 'bold',
    }).setDepth(161);
    this.worldContainer.add(label);
    objects.push(label);

    // Interactive hit area
    const hitArea = this.add.circle(wx, wy, iconSize * 0.7, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(162);
    this.worldContainer.add(hitArea);
    objects.push(hitArea);

    hitArea.on('pointerover', () => {
      sprite.setTint(0xffffff);
      sprite.setAlpha(1.0);
      this.sfx?.playHover();
    });
    hitArea.on('pointerout', () => {
      sprite.clearTint();
      sprite.setAlpha(0.92);
    });
    hitArea.on('pointerdown', () => {
      this.sfx?.playClick();
      const fullFleet = state.gameState.fleets.find(f => f.id === fleet.id);
      if (fullFleet) {
        const fleetShips = state.gameState.ships.filter(s => s.fleetId === fullFleet.id);
        this.game.events.emit('fleet:selected', { fleet: fullFleet, ships: fleetShips });
      }
    });

    sprite.setAlpha(0.92);
  }

  private _createFallbackFleetIndicator(
    fleet: { id: string; name: string },
    shipCount: number,
    wx: number,
    wy: number,
    empireColor: string,
    state: GameTickState,
    objects: Phaser.GameObjects.GameObject[],
  ): void {
    const colorNum = parseInt(empireColor.replace('#', ''), 16);

    const container = this.add.container(wx, wy).setDepth(160);
    this.worldContainer.add(container);
    objects.push(container);

    const glow = this.add.graphics();
    glow.fillStyle(colorNum, 0.12);
    glow.fillCircle(0, 0, 16);
    container.add(glow);

    const gfx = this.add.graphics();
    gfx.fillStyle(colorNum, 0.95);
    gfx.fillTriangle(0, -10, -8, 8, 8, 8);
    gfx.lineStyle(1.5, colorNum, 0.6);
    gfx.strokeCircle(0, 0, 14);
    container.add(gfx);

    const label = this.add.text(18, -8, `${fleet.name} (${shipCount})`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aaeeff',
      fontStyle: 'bold',
    });
    container.add(label);

    const hitArea = this.add.circle(0, 0, 18, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => { this.sfx?.playHover(); });
    hitArea.on('pointerdown', () => {
      this.sfx?.playClick();
      const fullFleet = state.gameState.fleets.find(f => f.id === fleet.id);
      if (fullFleet) {
        const fleetShips = state.gameState.ships.filter(s => s.fleetId === fullFleet.id);
        this.game.events.emit('fleet:selected', { fleet: fullFleet, ships: fleetShips });
      }
    });
    container.add(hitArea);
  }

  // ── Game event SFX handlers ───────────────────────────────────────────────────

  private _handleSpeedChange = (speed: unknown): void => {
    const engine = getGameEngine();
    if (engine) {
      const prevSpeed = engine.getState().gameState.speed;
      engine.setSpeed(speed as GameSpeedName);
      // Audio feedback for speed change
      const speedOrder: GameSpeedName[] = ['paused', 'slow', 'normal', 'fast', 'fastest'];
      const prevIdx = speedOrder.indexOf(prevSpeed as GameSpeedName);
      const newIdx = speedOrder.indexOf(speed as GameSpeedName);
      if (newIdx > prevIdx) {
        this.sfx?.playSpeedUp();
      } else if (newIdx < prevIdx) {
        this.sfx?.playSpeedDown();
      }
    }
  };

  private _handleMusicTrack = (track: unknown): void => {
    this.music?.setTrack(track as MusicTrack);
  };

  private _handleExitToMenu = (): void => {
    destroyGameEngine();
    this.ambient?.stopAll();
    this.scene.start('MainMenuScene');
  };

  private _handleMigrationStartedSfx = (): void => {
    this.sfx?.playColoniseStart();
  };

  private _handleMigrationCompletedSfx = (): void => {
    this.sfx?.playColoniseComplete();
    // Don't clear animations — let the last dots arrive naturally (synced with transit delay)
  };

  private _handleShipProducedSfx = (payload: unknown): void => {
    const { systemId } = payload as { systemId: string };
    if (systemId === this.system?.id) {
      this.sfx?.playShipLaunch();
    }
  };

  private _prevPlanetQueueLengths: Map<string, number> = new Map();

  private _handlePlanetUpdatedSfx = (payload: unknown): void => {
    const { systemId, planet } = payload as { systemId: string; planet: Planet };
    if (systemId !== this.system?.id) return;

    const prevLen = this._prevPlanetQueueLengths.get(planet.id) ?? planet.productionQueue.length;
    const currLen = planet.productionQueue.length;

    if (currLen < prevLen) {
      this.sfx?.playBuildComplete();
    }
    this._prevPlanetQueueLengths.set(planet.id, currLen);
  };

  private _handleTechResearchedSfx = (): void => {
    this.sfx?.playResearchComplete();
  };

  // ── Colonisation landing animation ─────────────────────────────────────────

  /**
   * Play a colony ship landing animation when a planet is colonised via the
   * in-system "Colonise" button or a colony ship action.
   *
   * A bright dot descends toward the planet from above and triggers a pulse
   * on landing.
   */
  private _handlePlanetColonised = (data: unknown): void => {
    const { planetId, systemId } = data as { planetId?: string; systemId?: string };
    if (!planetId) return;

    // Only animate if this colonisation happened in the system we are viewing
    if (systemId && systemId !== this.system?.id) return;

    this._playLandingAnimation(planetId);
  };

  /**
   * Play the same landing animation when an in-system migration completes,
   * establishing a new colony on the target planet.
   */
  private _handleMigrationCompletedLanding = (data: unknown): void => {
    const mig = data as MigrationOrder | undefined;
    if (!mig) return;

    // Only animate if this migration is in the system we are viewing
    if (mig.systemId !== this.system?.id) return;

    this._playLandingAnimation(mig.targetPlanetId);
  };

  /**
   * Animate a colony ship dot descending toward a planet and triggering a
   * pulse/glow on landing.  All graphics are added to `worldContainer` so
   * they respect the current zoom and pan.
   */
  private _playLandingAnimation(planetId: string): void {
    const pos = this._getPlanetWorldPos(planetId);
    if (!pos) return;

    const { x, y } = pos;

    // Colony ship dot — starts 80px above the planet
    const ship = this.add.circle(x, y - 80, 4, 0x00ffaa, 1);
    ship.setDepth(200);
    this.worldContainer.add(ship);

    // Trailing glow that follows the ship
    const trail = this.add.circle(x, y - 80, 3, 0x00ffaa, 0.5);
    trail.setDepth(199);
    this.worldContainer.add(trail);

    // Animate ship descending toward the planet centre
    this.tweens.add({
      targets: ship,
      x,
      y,
      scaleX: 0.2,
      scaleY: 0.2,
      alpha: 0.8,
      duration: 1200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        ship.destroy();
        trail.destroy();

        // Pulse / glow on landing
        const pulse = this.add.circle(x, y, 12, 0x00ffaa, 0.6);
        pulse.setDepth(200);
        this.worldContainer.add(pulse);
        this.tweens.add({
          targets: pulse,
          scaleX: 3,
          scaleY: 3,
          alpha: 0,
          duration: 800,
          ease: 'Quad.easeOut',
          onComplete: () => pulse.destroy(),
        });
      },
    });

    // Trail follows with a slight delay
    this.tweens.add({
      targets: trail,
      x,
      y,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      duration: 1200,
      delay: 100,
      ease: 'Quad.easeIn',
      onComplete: () => trail.destroy(),
    });
  }

  // ── Latest planet helper ─────────────────────────────────────────────────────

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

  private createOrbits(): void {
    const planets = [...this.system.planets].sort((a, b) => a.orbitalIndex - b.orbitalIndex);
    const planetRenderer = new PlanetRenderer(this);

    const beltInnerR = ORBIT_BASE_RADIUS + ASTEROID_BELT_INNER_INDEX * ORBIT_STEP;
    const beltOuterR = ORBIT_BASE_RADIUS + ASTEROID_BELT_OUTER_INDEX * ORBIT_STEP;
    let asteroidBeltDrawn = false;

    for (let i = 0; i < planets.length; i++) {
      const planet = planets[i]!;
      const orbitRadius = ORBIT_BASE_RADIUS + i * ORBIT_STEP;

      if (!asteroidBeltDrawn && i === ASTEROID_BELT_OUTER_INDEX && planets.length > ASTEROID_BELT_OUTER_INDEX) {
        const belt = renderAsteroidBelt(this, 0, 0, beltInnerR + 8, beltOuterR - 8);
        if (belt) this.worldContainer.add(belt as Phaser.GameObjects.GameObject);
        asteroidBeltDrawn = true;
      }

      // Orbit ring — world-space
      const orbitRing = this.add.arc(0, 0, orbitRadius, 0, 360, false);
      orbitRing.setStrokeStyle(1, 0x334466, 0.25);
      orbitRing.setFillStyle(0, 0);
      this.worldContainer.add(orbitRing);

      const startAngle = (i / planets.length) * Math.PI * 2;
      const baseSpeed = 0.00004;
      const speed = baseSpeed / Math.pow(orbitRadius / ORBIT_BASE_RADIUS, 1.2);

      const px = Math.cos(startAngle) * orbitRadius;
      const py = Math.sin(startAngle) * orbitRadius;

      const container = this.createPlanetObject(planetRenderer, planet, px, py);
      this.worldContainer.add(container);

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

    if (planet.currentPopulation === 0 && planet.maxPopulation === 0) {
      container.setAlpha(0.55);
    }

    if (planet.ownerId !== null) {
      const ownerRing = this.add.graphics();
      ownerRing.lineStyle(2, 0x00d4ff, 0.75);
      ownerRing.strokeCircle(0, 0, radius + 4);
      container.add(ownerRing);

      const flag = this.add.graphics();
      flag.fillStyle(0x00d4ff, 0.9);
      flag.fillRect(-4, -(radius + 14), 8, 6);
      flag.lineStyle(1, 0x00d4ff, 1);
      flag.lineBetween(0, -(radius + 14), 0, -(radius + 4));
      container.add(flag);
    } else if (planet.currentPopulation > 0) {
      const colonyRing = this.add.graphics();
      colonyRing.lineStyle(1.5, 0x888888, 0.55);
      colonyRing.strokeCircle(0, 0, radius + 4);
      container.add(colonyRing);
    }

    const hitArea = this.add.circle(0, 0, radius + 7, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });

    const highlight = this.add.graphics();
    highlight.setVisible(false);

    hitArea.on('pointerover', () => {
      highlight.clear();
      highlight.lineStyle(1.5, 0xffffff, 0.85);
      highlight.strokeCircle(0, 0, radius + 2);
      highlight.setVisible(true);
      this.showTooltip(planet, x, y);
      this.ambient?.playPlanetAmbient(planet.type);
      this.sfx?.playHover();
    });

    hitArea.on('pointerout', () => {
      highlight.setVisible(false);
      this.hideTooltip();
      this.ambient?.stopPlanetAmbient();
    });

    hitArea.on('pointerdown', () => {
      this.sfx?.playClick();
      const engine = getGameEngine();
      const latestPlanet = this._getLatestPlanet(planet.id, engine) ?? planet;
      this.game.events.emit('planet:selected', latestPlanet);
      if (latestPlanet.ownerId !== null) {
        this.game.events.emit('planet:manage', { planet: latestPlanet, systemId: this.system.id });
        this.ambient?.startSurfaceAmbient(latestPlanet.type, latestPlanet.buildings.length);
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
    const bg = this.add
      .rectangle(16, 16, 200, 40, 0x0a1628, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x335577, 0.6)
      .setDepth(199);

    const btn = this.add
      .text(26, 24, '\u2190  Back to Galaxy', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#88bbdd',
        fontStyle: 'bold',
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(200);

    btn.on('pointerover', () => {
      btn.setColor('#ffffff');
      bg.setFillStyle(0x152a44, 0.95);
      this.sfx?.playHover();
    });
    btn.on('pointerout', () => {
      btn.setColor('#88bbdd');
      bg.setFillStyle(0x0a1628, 0.85);
    });
    btn.on('pointerdown', () => {
      this.sfx?.playClick();
      this.ambient?.stopAll();
      this.music?.crossfadeTo('galaxy');
      this.scene.start('GalaxyMapScene', {});
    });
  }

  /**
   * Handle 'scene:request_galaxy_view' — switch to the galaxy map and
   * activate fleet move mode so the player can pick a relocation target.
   *
   * We stash the fleet ID on the window so GalaxyMapScene can pick it up
   * after initialisation (the SystemViewScene is destroyed during transition
   * so we cannot use delayed calls).
   */
  private _handleRequestGalaxyView = (data: unknown): void => {
    const { fleetId } = data as { fleetId: string };
    // Stash on window for the galaxy scene to pick up in create()
    (window as unknown as Record<string, unknown>).__EX_NIHILO_PENDING_MOVE_MODE__ = fleetId;
    this.ambient?.stopAll();
    this.music?.crossfadeTo('galaxy');
    this.scene.start('GalaxyMapScene', {});
  };

  /** Minimap click while in system view — return to galaxy map. */
  private _handleMinimapNavigate = (_data: unknown): void => {
    this.ambient?.stopAll();
    this.music?.crossfadeTo('galaxy');
    this.scene.start('GalaxyMapScene', {});
  };
}
