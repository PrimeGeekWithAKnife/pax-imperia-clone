import Phaser from 'phaser';
import type { StarSystem, Planet, PlanetType } from '@nova-imperia/shared';
import { StarRenderer } from '../rendering/StarRenderer';
import { PlanetRenderer, renderAsteroidBelt } from '../rendering/PlanetRenderer';
import { getAudioEngine, MusicGenerator, AmbientSounds, SfxGenerator } from '../../audio';
import type { MusicTrack } from '../../audio';
import { getGameEngine } from '../../engine/GameEngine';
import type { MigrationOrder } from '../../engine/migration';
import type { GameTickState } from '@nova-imperia/shared';
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

/** Below this zoom level individual ship sprites are replaced by a fleet badge. */
const FLEET_BADGE_ZOOM_THRESHOLD = 0.8;

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
      this.scene.start('GalaxyMapScene');
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

    // ── Colonise action listener ───────────────────────────────────────────
    this.game.events.on('colony:colonise', this.handleColoniseAction, this);

    // ── Migration action listeners ─────────────────────────────────────────
    this.game.events.on('colony:start_migration', this.handleStartMigrationAction, this);
    this.game.events.on('engine:migration_wave', this.handleMigrationWave, this);

    // ── Game event SFX listeners ───────────────────────────────────────────
    this.game.events.on('engine:migration_started', this._handleMigrationStartedSfx, this);
    this.game.events.on('engine:migration_completed', this._handleMigrationCompletedSfx, this);
    this.game.events.on('engine:ship_produced', this._handleShipProducedSfx, this);
    this.game.events.on('engine:planet_updated', this._handlePlanetUpdatedSfx, this);
    this.game.events.on('engine:tech_researched', this._handleTechResearchedSfx, this);

    // Check existing migrations when entering the scene (e.g. loading a save)
    this._syncMigrationAnimations();

    // Render ships already present in this system
    this._renderShipIndicators();

    // Refresh ship indicators on each engine tick so newly built ships appear
    this.game.events.on('engine:tick', this._handleEngineTick, this);

    // Music track change
    this.game.events.on('music:set_track', (track: unknown) => {
      this.music?.setTrack(track as MusicTrack);
    });

    // Notify React which system is currently being viewed
    this.game.events.emit('system:entered', { systemId: this.system.id });

    // Clean up listeners and notify React when the scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('colony:colonise', this.handleColoniseAction, this);
      this.game.events.off('colony:start_migration', this.handleStartMigrationAction, this);
      this.game.events.off('engine:migration_wave', this.handleMigrationWave, this);
      this.game.events.off('engine:migration_started', this._handleMigrationStartedSfx, this);
      this.game.events.off('engine:migration_completed', this._handleMigrationCompletedSfx, this);
      this.game.events.off('engine:ship_produced', this._handleShipProducedSfx, this);
      this.game.events.off('engine:planet_updated', this._handlePlanetUpdatedSfx, this);
      this.game.events.off('engine:tech_researched', this._handleTechResearchedSfx, this);
      this.game.events.off('engine:tick', this._handleEngineTick, this);
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

    // Switch between individual sprites and fleet badges based on zoom level
    this._updateFleetBadgeVisibility();
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

    const ships: ColonyShip[] = [];
    const SHIP_COUNT = Phaser.Math.Between(8, 12);
    for (let i = 0; i < SHIP_COUNT; i++) {
      const gfx = this.add.graphics();
      gfx.setDepth(150);
      // Add to worldContainer so they scale with the world
      this.worldContainer.add(gfx);

      ships.push({
        gfx,
        t: -(i * 0.12),           // stagger: ships depart at different times
        speed: 0.00020 + Math.random() * 0.00010,  // slight speed variation
        cx: 0,
        cy: 0,
        sx: sourcePos.x,
        sy: sourcePos.y,
        tx: targetPos.x,
        ty: targetPos.y,
        alpha: 0,
        swarmOffset: (Math.random() - 0.5) * 18,  // perpendicular wobble
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

    // Warm amber trail dots behind
    gfx.fillStyle(0xcc6600, 0.25 * alpha);
    gfx.fillCircle(x - 5, y, 1.5);
    gfx.fillStyle(0xff9900, 0.15 * alpha);
    gfx.fillCircle(x - 9, y, 1);

    // Main dot — amber/gold
    gfx.fillStyle(0xffcc44, 0.95 * alpha);
    gfx.fillCircle(x, y, 2);

    // Bright core
    gfx.fillStyle(0xfff0aa, 0.90 * alpha);
    gfx.fillCircle(x, y, 1);
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

  // ── Ship rendering ───────────────────────────────────────────────────────────

  /**
   * Ship sprite objects keyed by ship.id.
   * Each entry is a list: [sprite, label] or just [sprite] depending on how it
   * was created.  We keep a flat array so we can destroy all of them together.
   */
  private shipSprites: Map<string, Phaser.GameObjects.GameObject[]> = new Map();

  /**
   * Fleet badge containers keyed by `fleetId`.
   * Shown when zoomed out below FLEET_BADGE_ZOOM_THRESHOLD.
   */
  private fleetBadges: Map<string, Phaser.GameObjects.Container> = new Map();

  /**
   * Render ship indicators for all ships currently positioned in this system.
   * Uses proper ship silhouette icons from renderShipIcon.
   * Called on create and refreshed each tick.
   */
  private _renderShipIndicators(): void {
    const engine = getGameEngine();
    if (!engine) return;

    const state = engine.getState();
    const shipsInSystem = state.gameState.ships.filter(
      s => s.position.systemId === this.system.id,
    );

    const currentIds = new Set(shipsInSystem.map(s => s.id));

    // Remove indicators for ships that are gone
    for (const [id, objects] of this.shipSprites) {
      if (!currentIds.has(id)) {
        for (const o of objects) o.destroy();
        this.shipSprites.delete(id);
      }
    }

    // Build a map of empireId → empire.color for quick lookup
    const empireColours = new Map<string, string>();
    for (const empire of state.gameState.empires) {
      empireColours.set(empire.id, empire.color);
    }

    // Build a map of fleetId → empireId
    const fleetEmpire = new Map<string, string>();
    for (const fleet of state.gameState.fleets) {
      fleetEmpire.set(fleet.id, fleet.empireId);
    }

    // Spread multiple ships so they don't overlap — group by orbit slot
    const shipsByOrbit = new Map<number, number>();

    for (const ship of shipsInSystem) {
      if (this.shipSprites.has(ship.id)) continue;

      // Determine orbit-slot position
      const orbitIdx = ship.position.orbitIndex ?? -1;
      const offsetIndex = shipsByOrbit.get(orbitIdx) ?? 0;
      shipsByOrbit.set(orbitIdx, offsetIndex + 1);

      // World-space position (relative to worldContainer origin)
      let wx = 50;
      let wy = -50;

      if (orbitIdx >= 0) {
        const entry = this.orbitEntries[orbitIdx];
        if (entry) {
          wx = entry.container.x + 22 + offsetIndex * 28;
          wy = entry.container.y - 22;
        }
      } else {
        wx += offsetIndex * 28;
      }

      // Look up the ship's hull class from the empire ship designs (if available)
      const shipDesign = (state.gameState as unknown as { shipDesigns?: { id: string; hull: HullClass; empireId: string }[] })
        .shipDesigns?.find((d) => d.id === ship.designId);

      const hullClass: HullClass = shipDesign?.hull ?? 'scout';

      // Determine empire colour from fleet membership
      const empireId = ship.fleetId ? (fleetEmpire.get(ship.fleetId) ?? null) : null;
      const empireColor = empireId ? (empireColours.get(empireId) ?? '#4488cc') : '#4488cc';

      // Render ship icon at 28px (displayed at ~24–28px at 1x zoom due to world scale)
      const iconSize = 28;
      const dataUrl = renderShipIcon(hullClass, iconSize, empireColor);

      const objects: Phaser.GameObjects.GameObject[] = [];

      if (dataUrl) {
        // Convert data URL to Phaser texture if not already registered
        const textureKey = `ship_icon_${hullClass}_${empireColor.replace('#', '')}`;
        if (!this.textures.exists(textureKey)) {
          this.textures.addBase64(textureKey, dataUrl);
        }

        // We schedule the actual sprite creation after the texture is loaded,
        // but addBase64 is synchronous for already-loaded data in most Phaser builds.
        // Guard with a callback to be safe.
        if (this.textures.exists(textureKey)) {
          this._createShipSprite(ship, wx, wy, textureKey, hullClass, empireColor, iconSize, state, objects);
        } else {
          this.textures.once(`addtexture-${textureKey}`, () => {
            this._createShipSprite(ship, wx, wy, textureKey, hullClass, empireColor, iconSize, state, objects);
          });
        }
      } else {
        // Fallback: simple triangle if canvas not available
        this._createFallbackShipIndicator(ship, wx, wy, empireColor, state, objects);
      }

      this.shipSprites.set(ship.id, objects);
    }

    // Refresh fleet badges
    this._renderFleetBadges(shipsInSystem, fleetEmpire, empireColours);
    this._updateFleetBadgeVisibility();
  }

  private _createShipSprite(
    ship: { id: string; name: string; fleetId: string | null },
    wx: number,
    wy: number,
    textureKey: string,
    _hullClass: HullClass,
    _empireColor: string,
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

    // Ship name label
    const label = this.add.text(wx + iconSize * 0.6, wy - iconSize * 0.3, ship.name, {
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
      const fleet = state.gameState.fleets.find(f => f.id === ship.fleetId);
      if (fleet) {
        const fleetShips = state.gameState.ships.filter(s => s.fleetId === fleet.id);
        this.game.events.emit('fleet:selected', { fleet, ships: fleetShips });
      }
    });

    sprite.setAlpha(0.92);
  }

  private _createFallbackShipIndicator(
    ship: { id: string; name: string; fleetId: string | null },
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

    const label = this.add.text(18, -8, ship.name, {
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
      const fleet = state.gameState.fleets.find(f => f.id === ship.fleetId);
      if (fleet) {
        const fleetShips = state.gameState.ships.filter(s => s.fleetId === fleet.id);
        this.game.events.emit('fleet:selected', { fleet, ships: fleetShips });
      }
    });
    container.add(hitArea);
  }

  // ── Fleet badges (shown when zoomed out) ─────────────────────────────────────

  /**
   * Render small fleet count badges grouped by fleet.
   * Each badge shows the ship count, the empire colour, and is clickable.
   */
  private _renderFleetBadges(
    shipsInSystem: { id: string; fleetId: string | null; position: { systemId: string; orbitIndex?: number } }[],
    fleetEmpire: Map<string, string>,
    empireColours: Map<string, string>,
  ): void {
    const engine = getGameEngine();
    if (!engine) return;
    const state = engine.getState();

    // Group ships by fleet (or by "no fleet" → own entry per ship)
    const fleetCounts = new Map<string, { count: number; empireId: string; wx: number; wy: number }>();

    const shipsByOrbit = new Map<number, number>();
    for (const ship of shipsInSystem) {
      const orbitIdx = ship.position.orbitIndex ?? -1;
      const offsetIndex = shipsByOrbit.get(orbitIdx) ?? 0;
      shipsByOrbit.set(orbitIdx, offsetIndex + 1);

      let wx = 50;
      let wy = -50;
      if (orbitIdx >= 0) {
        const entry = this.orbitEntries[orbitIdx];
        if (entry) {
          wx = entry.container.x + 22 + offsetIndex * 28;
          wy = entry.container.y - 22;
        }
      } else {
        wx += offsetIndex * 28;
      }

      const groupKey = ship.fleetId ?? `solo_${ship.id}`;
      const empireId = ship.fleetId ? (fleetEmpire.get(ship.fleetId) ?? '') : '';
      const existing = fleetCounts.get(groupKey);
      if (existing) {
        existing.count++;
      } else {
        fleetCounts.set(groupKey, { count: 1, empireId, wx, wy });
      }
    }

    // Remove stale badges
    for (const [key, badge] of this.fleetBadges) {
      if (!fleetCounts.has(key)) {
        badge.destroy();
        this.fleetBadges.delete(key);
      }
    }

    // Add or update badges
    for (const [fleetKey, info] of fleetCounts) {
      const empireColor = empireColours.get(info.empireId) ?? '#00d4ff';
      const colorNum = parseInt(empireColor.replace('#', ''), 16);

      let badge = this.fleetBadges.get(fleetKey);
      if (badge) {
        // Update count
        const countText = badge.getAt(1) as Phaser.GameObjects.Text;
        countText?.setText(String(info.count));
        badge.setPosition(info.wx, info.wy);
        continue;
      }

      // Create badge
      badge = this.add.container(info.wx, info.wy).setDepth(165);
      this.worldContainer.add(badge);

      // Empire-coloured border circle
      const border = this.add.graphics();
      border.lineStyle(2, colorNum, 0.9);
      border.strokeCircle(0, 0, 12);
      border.fillStyle(0x000820, 0.85);
      border.fillCircle(0, 0, 11);
      badge.add(border);

      // Ship count text
      const countLabel = this.add.text(0, 0, String(info.count), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: empireColor,
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      badge.add(countLabel);

      // Click handler
      const hitArea = this.add.circle(0, 0, 13, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => {
        border.clear();
        border.lineStyle(2.5, colorNum, 1.0);
        border.strokeCircle(0, 0, 12);
        border.fillStyle(0x001030, 0.9);
        border.fillCircle(0, 0, 11);
        this.sfx?.playHover();
      });
      hitArea.on('pointerout', () => {
        border.clear();
        border.lineStyle(2, colorNum, 0.9);
        border.strokeCircle(0, 0, 12);
        border.fillStyle(0x000820, 0.85);
        border.fillCircle(0, 0, 11);
      });
      hitArea.on('pointerdown', () => {
        this.sfx?.playClick();
        const fleet = state.gameState.fleets.find(f => f.id === fleetKey);
        if (fleet) {
          const fleetShips = state.gameState.ships.filter(s => s.fleetId === fleet.id);
          this.game.events.emit('fleet:selected', { fleet, ships: fleetShips });
        }
      });
      badge.add(hitArea);

      this.fleetBadges.set(fleetKey, badge);
    }
  }

  /**
   * Show fleet badges when zoomed out below threshold, hide individual sprites.
   * Show individual sprites when zoomed in above threshold.
   */
  private _updateFleetBadgeVisibility(): void {
    const showBadges = this.currentZoom < FLEET_BADGE_ZOOM_THRESHOLD;

    for (const [, objects] of this.shipSprites) {
      for (const obj of objects) {
        (obj as Phaser.GameObjects.Image).setVisible(!showBadges);
      }
    }

    for (const [, badge] of this.fleetBadges) {
      badge.setVisible(showBadges);
    }
  }

  // ── Game event SFX handlers ───────────────────────────────────────────────────

  private _handleMigrationStartedSfx = (): void => {
    this.sfx?.playColoniseStart();
  };

  private _handleMigrationCompletedSfx = (): void => {
    this.sfx?.playColoniseComplete();
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
      this.scene.start('GalaxyMapScene');
    });
  }
}
