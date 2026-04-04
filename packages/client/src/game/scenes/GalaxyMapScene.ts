import Phaser from 'phaser';
import { initializeGame, PREBUILT_SPECIES, UNIVERSAL_TECHNOLOGIES } from '@nova-imperia/shared';
import type { Galaxy, SpiralGalaxyMetadata, StarSystem, StarType, Species, GalaxyShape, AIPersonality, HullClass } from '@nova-imperia/shared';
import { sampleSpiralArm } from '@nova-imperia/shared';
import { createGameEngine, getGameEngine, destroyGameEngine, initializeTickState } from '../../engine/GameEngine';
import type { GameSpeedName } from '@nova-imperia/shared';
import { getAudioEngine, MusicGenerator, AmbientSounds, SfxGenerator } from '../../audio';
import type { MusicTrack } from '../../audio';
import { renderShipThumbnail } from '../../assets/graphics';

/** Galaxy size key → shared GALAXY_SIZES key */
const GALAXY_SIZE_MAP: Record<string, 'tiny' | 'small' | 'medium' | 'large' | 'huge'> = {
  tiny: 'tiny', small: 'small', medium: 'medium', large: 'large', huge: 'huge',
};

const AI_COLORS = ['#ff6d00', '#e91e63', '#9c27b0', '#4caf50', '#ffc107', '#00bcd4', '#795548'];
const AI_PERSONALITIES: AIPersonality[] = ['aggressive', 'defensive', 'economic', 'diplomatic', 'expansionist', 'researcher'];

// ── Constants ──────────────────────────────────────────────────────────────────

const BG_COLOR = 0x02020a;
// ── Lane / connection line styles ──────────────────────────────────────────
/** Normal space lane: faint white dashes (always visible for known systems) */
const LANE_COLOR            = 0xffffff;
const LANE_ALPHA            = 0.15;
const LANE_DASH_LEN         = 4;
const LANE_GAP_LEN          = 8;
const LANE_WIDTH            = 1;
/** Wormhole connection: blue pulsing, thicker (with wormhole tech) */
const WORM_COLOR            = 0x4488ff;
const WORM_ALPHA_MIN        = 0.4;
const WORM_ALPHA_MAX        = 0.6;
const WORM_WIDTH            = 2;
/** Wormhole connection without tech: very faint blue dashes */
const WORM_NO_TECH_COLOR    = 0x4488ff;
const WORM_NO_TECH_ALPHA    = 0.08;
/** Advanced / artificial wormhole: gold solid line */
const ADV_WORM_COLOR        = 0xffcc44;
const ADV_WORM_ALPHA        = 0.5;
const ADV_WORM_WIDTH        = 2;
// ── Drip particle constants ────────────────────────────────────────────────
/** Maximum drip particles across all active movement orders. */
const MAX_DRIP_PARTICLES    = 20;
/** Number of drip dots per fleet movement. */
const DRIP_COUNT_PER_FLEET  = 5;
/** Time in ms for one full pass along the lane (direction cue). */
const DRIP_PATH_DURATION_MS = 3000;
// ── Waypoint route line styles ────────────────────────────────────────────
/** Normal waypoint route: cyan dashed line */
const WAYPOINT_COLOR         = 0x00d4ff;
const WAYPOINT_ALPHA         = 0.35;
const WAYPOINT_WIDTH         = 1.5;
const WAYPOINT_DASH_LEN      = 6;
const WAYPOINT_GAP_LEN       = 8;
/** Patrol route: green-cyan dashed line */
const PATROL_COLOR           = 0x22d46e;
const PATROL_ALPHA           = 0.40;

const SELECTION_RING_COLOR = 0xffffff;
const SELECTION_RING_ALPHA = 0.9;
const FOG_COLOR = 0x334455;
const TOOLTIP_BG_COLOR = 0x111824;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.0;
const ZOOM_FACTOR = 0.1;
const ZOOM_LERP = 0.12;

/**
 * Hull class priority for selecting a representative fleet icon — higher
 * index = larger / more imposing ship, used as the fleet badge thumbnail.
 */
const HULL_CLASS_RANK: Partial<Record<HullClass, number>> = {
  science_probe: 0, spy_probe: 0, drone: 0,
  fighter: 1, bomber: 1, patrol: 1, yacht: 1,
  corvette: 2,
  cargo: 2, transport: 3,
  coloniser_gen1: 3, coloniser_gen2: 3, coloniser_gen3: 3, coloniser_gen4: 3, coloniser_gen5: 3,
  frigate: 4, destroyer: 5,
  large_transport: 4, large_cargo: 4,
  light_cruiser: 6, heavy_cruiser: 7,
  large_supplier: 5, carrier: 8,
  light_battleship: 9, battleship: 10,
  heavy_battleship: 11, super_carrier: 12,
  battle_station: 13, small_space_station: 12,
  space_station: 14, large_space_station: 15, planet_killer: 16,
};

// Parallax factors per layer (fraction of camera movement applied)
const PARALLAX_FACTOR_L0 = 0.05;  // deep background — slowest
const PARALLAX_FACTOR_L1 = 0.15;  // mid-distance stars
const PARALLAX_FACTOR_L2 = 0.25;  // nebula wisps

// ── Star visual properties ─────────────────────────────────────────────────────

interface StarVisuals {
  color: number;
  radius: number;
  glowColor: number;
  glowRadius: number;
  /** Whether to draw diffraction spikes (bright/hot stars) */
  hasDiffractionSpikes: boolean;
  /** Corona halo color (same as glow but at very low alpha) */
  coronaColor: number;
}

const STAR_VISUALS: Record<StarType, StarVisuals> = {
  blue_giant:  { color: 0xddeeff, radius: 4,  glowColor: 0x4499ff, glowRadius: 20, hasDiffractionSpikes: true,  coronaColor: 0x2266cc },
  white:       { color: 0xf8f8ff, radius: 3,  glowColor: 0xaabbff, glowRadius: 14, hasDiffractionSpikes: true,  coronaColor: 0x8899cc },
  yellow:      { color: 0xffeeaa, radius: 3,  glowColor: 0xffcc44, glowRadius: 13, hasDiffractionSpikes: false, coronaColor: 0xcc9900 },
  orange:      { color: 0xffbb77, radius: 3,  glowColor: 0xff6600, glowRadius: 12, hasDiffractionSpikes: false, coronaColor: 0xcc4400 },
  red_dwarf:   { color: 0xff7755, radius: 2,  glowColor: 0xcc2200, glowRadius: 8,  hasDiffractionSpikes: false, coronaColor: 0x880000 },
  red_giant:   { color: 0xff6644, radius: 5,  glowColor: 0xcc1100, glowRadius: 18, hasDiffractionSpikes: false, coronaColor: 0x880000 },
  neutron:     { color: 0xcceeff, radius: 2,  glowColor: 0x88ccff, glowRadius: 8,  hasDiffractionSpikes: true,  coronaColor: 0x4499cc },
  binary:      { color: 0xffe8cc, radius: 3,  glowColor: 0xffaa44, glowRadius: 15, hasDiffractionSpikes: false, coronaColor: 0xcc7700 },
};

// ── Internal types ─────────────────────────────────────────────────────────────

interface ParallaxStar {
  obj: Phaser.GameObjects.Arc;
  baseX: number;
  baseY: number;
  layer: 0 | 1;
  /** Optional tween for twinkle (layer-1 stars only) */
  twinkleTween?: Phaser.Tweens.Tween;
}

interface NebulaWisp {
  gfx: Phaser.GameObjects.Graphics;
  baseX: number;
  baseY: number;
  layer: 0 | 2;
}

interface WormholeParticle {
  /** t in [0, 1] along the line from sysA → sysB */
  t: number;
  speed: number;
  sysA: StarSystem;
  sysB: StarSystem;
  obj: Phaser.GameObjects.Arc;
}

/**
 * A single "drip" particle that flows from origin to destination along an
 * active fleet movement path to show direction of travel.
 */
interface DripParticle {
  /** t in [0, 1]: 0 = origin, 1 = destination (wraps back to 0 on each pass) */
  t: number;
  /** Speed in t-units per ms (1 / DRIP_PATH_DURATION_MS) */
  speed: number;
  /** World-space origin (fleet departure system) */
  fromX: number;
  fromY: number;
  /** World-space destination (fleet target system) */
  toX: number;
  toY: number;
  /** Main dot graphic */
  obj: Phaser.GameObjects.Arc;
  /** Trailing dot graphic drawn at lower alpha */
  trail: Phaser.GameObjects.Arc;
  /** Which fleet movement order this belongs to */
  fleetId: string;
}

// ── GalaxyMapScene ─────────────────────────────────────────────────────────────

export class GalaxyMapScene extends Phaser.Scene {
  private galaxy!: Galaxy;
  private knownSystemIds: Set<string> = new Set();

  // Layers — ordered back-to-front
  /** Layer 0: deep background (slowest parallax) */
  private bgLayer!: Phaser.GameObjects.Container;
  /** Layer 1: mid-distance stars (medium parallax) */
  private midStarLayer!: Phaser.GameObjects.Container;
  /** Layer 2: nebula wisps (faster parallax) */
  private wispLayer!: Phaser.GameObjects.Container;
  /** Layer 3: galaxy world (1:1 camera movement) */
  private worldContainer!: Phaser.GameObjects.Container;
  /** UI elements fixed to screen */
  private uiLayer!: Phaser.GameObjects.Container;

  // World sub-layers
  private armNebulaLayer!: Phaser.GameObjects.Graphics;
  private cosmicFeaturesLayer!: Phaser.GameObjects.Graphics;
  private cometLayer!: Phaser.GameObjects.Graphics;
  private blackHoleLayer!: Phaser.GameObjects.Container;

  // Animated comets
  private comets: Array<{
    x: number; y: number; vx: number; vy: number;
    length: number; alpha: number; color: number;
  }> = [];
  private wormholeLayer!: Phaser.GameObjects.Graphics;
  private dustLayer!: Phaser.GameObjects.Graphics;
  private starLayer!: Phaser.GameObjects.Container;

  // Camera / pan state
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private cameraOffset = { x: 0, y: 0 };
  private targetZoom = 1.0;
  private currentZoom = 1.0;

  // Selection
  private selectedSystemId: string | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private pingGraphics!: Phaser.GameObjects.Graphics;

  // Tooltip
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;

  // Pulse animation tweens
  private pulseTweens: Map<string, Phaser.Tweens.Tween> = new Map();

  // Star hit areas (invisible circles for click detection)
  private starHitAreas: Map<string, Phaser.GameObjects.Arc> = new Map();

  // Last pointer-down time for double-click detection
  private lastPointerDownTime = 0;
  private lastPointerDownSystemId: string | null = null;

  // Home system of the player empire
  private homeSystemId: string | null = null;
  private homeRing!: Phaser.GameObjects.Graphics;

  // Parallax collections
  private parallaxStars: ParallaxStar[] = [];
  private nebulaWisps: NebulaWisp[] = [];

  // Wormhole drifting particles
  private wormholeParticles: WormholeParticle[] = [];

  // Drip particles for fleet movement direction cues
  private dripParticles: DripParticle[] = [];

  /**
   * When non-null, the player has activated "Move To" mode for this fleet.
   * The next system click will emit a `fleet:destination_selected` event
   * instead of the normal `system:selected` event.
   */
  private moveModeFleetId: string | null = null;

  /** Graphics overlay for drawing fleet waypoint route lines. */
  private waypointLayer!: Phaser.GameObjects.Graphics;

  /**
   * Phase accumulator (radians) used to oscillate wormhole line alpha.
   * Advanced at ~0.8 rad/s so a full pulse takes about 7–8 seconds.
   */
  private _wormholePhase = 0;

  // ── Audio ─────────────────────────────────────────────────────────────────
  private music: MusicGenerator | null = null;
  private ambient: AmbientSounds | null = null;
  private sfx: SfxGenerator | null = null;

  constructor() {
    super({ key: 'GalaxyMapScene' });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  create(data?: { knownSystemIds?: string[]; setupData?: { species: Species; config: { galaxySize: string; galaxyShape: string; aiOpponents: number; seed: string; aiDifficulty: string; victoryConditions?: string[] } } }): void {
    // Reset state from any previous run
    this.parallaxStars = [];
    this.nebulaWisps = [];
    this.comets = [];
    this.wormholeParticles = [];
    this.dripParticles = [];
    this.starHitAreas.clear();
    this.pulseTweens.clear();
    this.fleetBadges.clear();
    this.transitDots.clear();
    this.selectedSystemId = null;
    this.homeSystemId = null;
    this.moveModeFleetId = null;
    this.lastPointerDownTime = 0;
    this.lastPointerDownSystemId = null;
    this.currentZoom = MAX_ZOOM;
    this.targetZoom = MAX_ZOOM;
    this.isDragging = false;

    // ── Initialise or reuse game state ────────────────────────────────────────
    // If setupData is provided, we are starting a NEW game — destroy any
    // existing engine first so stale state doesn't leak through.
    const existingEngine = getGameEngine();
    if (data?.setupData && existingEngine) {
      destroyGameEngine();
    }

    const engineAfterCleanup = data?.setupData ? undefined : getGameEngine();
    if (engineAfterCleanup) {
      // Returning from SystemViewScene — reuse existing game state
      console.log('[GalaxyMapScene] Reusing existing engine at tick', engineAfterCleanup.getState().gameState.currentTick);
      this.galaxy = engineAfterCleanup.getState().gameState.galaxy;
      const playerEmpire = engineAfterCleanup.getState().gameState.empires.find(e => !e.isAI);
      if (playerEmpire) {
        this.homeSystemId = playerEmpire.homeSystemId
          ?? this.galaxy.systems.find(s => s.ownerId === playerEmpire.id)?.id
          ?? null;
        this.knownSystemIds = new Set(playerEmpire.knownSystems);
      } else {
        for (const sys of this.galaxy.systems) this.knownSystemIds.add(sys.id);
      }
    } else {
      // ── Build game from setup data or defaults ─────────────────────────────
      console.error('[GalaxyMapScene] ENGINE NOT FOUND — creating new game!', {
        hasSetupData: !!data?.setupData,
        engineOnWindow: !!(window as unknown as Record<string, unknown>).__GAME_ENGINE__,
        dataKeys: data ? Object.keys(data) : 'no data',
      });
      const setup = data?.setupData;
      const playerSpecies: Species = setup?.species ?? {
        id: 'human', name: 'Human', description: 'Adaptable and resourceful.', portrait: 'human',
        traits: { construction: 5, reproduction: 5, research: 6, espionage: 5, economy: 6, combat: 5, diplomacy: 7 },
        environmentPreference: { idealTemperature: 293, temperatureTolerance: 50, idealGravity: 1.0, gravityTolerance: 0.4, preferredAtmospheres: ['oxygen_nitrogen'] },
        specialAbilities: [], isPrebuilt: true,
      };

      const galaxySize = GALAXY_SIZE_MAP[setup?.config?.galaxySize ?? 'medium'] ?? 'medium';
      const galaxyShape = (setup?.config?.galaxyShape ?? 'spiral') as GalaxyShape;
      const aiCount = setup?.config?.aiOpponents ?? 1;
      const seed = parseInt(setup?.config?.seed ?? '42', 10) || 42;

      // Build AI player list from pre-built species (pick randomly, avoid player's species)
      const availableAI = PREBUILT_SPECIES.filter(s => s.id !== playerSpecies.id);
      // Fisher-Yates shuffle so AI opponents vary between games
      for (let i = availableAI.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableAI[i], availableAI[j]] = [availableAI[j]!, availableAI[i]!];
      }
      const aiPlayers = [];
      for (let i = 0; i < aiCount && i < availableAI.length; i++) {
        aiPlayers.push({
          species: availableAI[i]!,
          empireName: `${availableAI[i]!.name} Empire`,
          color: AI_COLORS[i % AI_COLORS.length]!,
          isAI: true as const,
          aiPersonality: AI_PERSONALITIES[i % AI_PERSONALITIES.length]!,
        });
      }

      let gameState;
      try {
        gameState = initializeGame({
          galaxyConfig: { seed, size: galaxySize, shape: galaxyShape, playerCount: 1 + aiCount },
          players: [
            {
              species: playerSpecies,
              empireName: `${playerSpecies.name} Dominion`,
              color: '#00d4ff',
              isAI: false,
            },
            ...aiPlayers,
          ],
          victoryCriteria: setup?.config?.victoryConditions,
        });
      } catch (err) {
        console.error('[GalaxyMapScene] Game init failed:', err);
        // Show error to user and return to main menu
        this.game.events.emit('ui:game_init_error', {
          message: err instanceof Error ? err.message : 'Failed to generate galaxy. Try a larger galaxy or different species.',
        });
        this.scene.start('MainMenuScene');
        return;
      }

      this.galaxy = gameState.galaxy;
      const playerEmpire = gameState.empires.find(e => !e.isAI);
      if (playerEmpire) {
        this.homeSystemId = playerEmpire.homeSystemId
          ?? gameState.galaxy.systems.find(s => s.ownerId === playerEmpire.id)?.id
          ?? null;
        this.knownSystemIds = new Set(playerEmpire.knownSystems);
      } else {
        for (const sys of this.galaxy.systems) this.knownSystemIds.add(sys.id);
      }

      const tickState = initializeTickState(gameState, UNIVERSAL_TECHNOLOGIES.length);
      const engine = createGameEngine(this.game, tickState);
      // Start paused on the very first turn so the player can orient themselves
      if (gameState.currentTick === 0) {
        engine.setSpeed('paused');
      }
      engine.start();
    }

    if (data?.knownSystemIds) {
      this.knownSystemIds = new Set(data.knownSystemIds);
    }

    // ── Build scene ────────────────────────────────────────────────────────────

    // Deep black background
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, BG_COLOR).setOrigin(0, 0);

    // Parallax containers (screen-space)
    this.bgLayer = this.add.container(0, 0);
    this.midStarLayer = this.add.container(0, 0);
    this.wispLayer = this.add.container(0, 0);

    // World container (world-space: panned + zoomed)
    this.worldContainer = this.add.container(0, 0);
    this.armNebulaLayer = this.add.graphics();
    this.cosmicFeaturesLayer = this.add.graphics();
    this.cometLayer = this.add.graphics();
    this.blackHoleLayer = this.add.container(0, 0);
    this.dustLayer = this.add.graphics();
    this.wormholeLayer = this.add.graphics();
    this.starLayer = this.add.container(0, 0);
    this.waypointLayer = this.add.graphics();
    this.worldContainer.add([this.armNebulaLayer, this.cosmicFeaturesLayer, this.cometLayer, this.blackHoleLayer, this.dustLayer, this.wormholeLayer, this.starLayer, this.waypointLayer]);

    // UI (screen-space, on top of everything)
    this.uiLayer = this.add.container(0, 0);

    // Build content — order matters for layering
    this.createDeepBackground();   // Layer 0: dim distant stars + deep nebulae
    this.createMidStars();         // Layer 1: mid-distance stars with twinkle
    this.createNebulaWisps();      // Layer 2: nebula cloud wisps (reduced for spiral)
    this.createArmNebulae();       // World-space: spiral arm nebula dust
    this.createCosmicFeatures();   // World-space: gas clouds, asteroid fields, comets
    this.createGalacticCentre();   // World-space: black hole + accretion disk
    this.createSpaceDust();        // World-space: fine dust near star systems + arms
    this.bakeStaticLayers();       // Bake heavy Graphics into single textures
    this.drawWormholes(null);      // World-space: connection lines
    this.createStars();            // World-space: actual star systems
    this.createSelectionRing();
    this.createHomeRing();
    this.createTooltip();
    this.createBackButton();
    this.createZoomButtons();
    this.createPingGraphics();

    // Center and auto-select home
    this.centerOnHomeSystem();
    if (this.homeSystemId) {
      this.selectSystem(this.homeSystemId);
    }

    this.game.events.emit('engine:galaxy_updated', this.galaxy);
    this.setupInput();
    this.setupEngineEvents();

    // Render fleet indicators for ships already in existence
    this._renderFleetBadges();
    this._drawWaypointRoutes();

    // Pick up pending move mode from system view transition ("Relocate Fleet")
    const pendingMoveMode = (window as unknown as Record<string, unknown>).__EX_NIHILO_PENDING_MOVE_MODE__ as string | undefined;
    if (pendingMoveMode) {
      this.moveModeFleetId = pendingMoveMode;
      delete (window as unknown as Record<string, unknown>).__EX_NIHILO_PENDING_MOVE_MODE__;
      // Emit so the React FleetPanel knows move mode is active
      this.game.events.emit('fleet:move_mode', { fleetId: pendingMoveMode, active: true });
    }

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

      this.music.crossfadeTo('galaxy');
      this.ambient.startGalaxyAmbient();
    }

    // Clean up ALL listeners when the scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('ui:speed_change', this._handleSpeedChange);
      this.game.events.off('minimap:navigate', this.handleMinimapNavigate);
      this.game.events.off('music:set_track', this._handleMusicTrack);
      this.game.events.off('engine:tick', this._handleEngineTick);
      this.game.events.off('engine:fleet_moved', this._handleFleetMoved);
      this.game.events.off('engine:combat_resolved', this._handleCombatResolved);
      this.game.events.off('engine:fleet_order_issued', this._handleFleetOrderIssuedSfx);
      this.game.events.off('engine:tech_researched', this._handleTechResearchedSfx);
      this.game.events.off('engine:ship_produced', this._handleShipProducedSfx);
      this.game.events.off('fleet:move_mode', this._handleFleetMoveMode);
      this.game.events.off('fleet:move_mode_clear', this._handleFleetMoveModeClear);
      this.game.events.off('ui:exit_to_menu', this._handleExitToMenu);
      this.game.events.off('combat:start_tactical', this._handleStartTactical);
      // Destroy fleet badges
      for (const [, container] of this.fleetBadges) {
        container.destroy();
      }
      this.fleetBadges.clear();
      // Destroy transit dots
      for (const [, entry] of this.transitDots) {
        entry.gfx.destroy();
      }
      this.transitDots.clear();
      // Destroy drip particles
      for (const p of this.dripParticles) {
        p.obj.destroy();
        p.trail.destroy();
      }
      this.dripParticles = [];
    });
  }

  update(time: number, delta: number): void {
    this.updateZoomLerp();
    this.updateParallax();
    this.updateWormholeParticles(delta);
    this.updateTransitDots(time, delta);
    this.updateAccretionDisk(delta);
    this.updateComets(delta);
    this.emitViewport();
  }

  // ── Galaxy layout ─────────────────────────────────────────────────────────────

  private centerGalaxy(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.cameraOffset.x = cx - (this.galaxy.width / 2) * this.currentZoom;
    this.cameraOffset.y = cy - (this.galaxy.height / 2) * this.currentZoom;
    this.applyWorldTransform();
  }

  private applyWorldTransform(): void {
    this.worldContainer.setPosition(this.cameraOffset.x, this.cameraOffset.y);
    this.worldContainer.setScale(this.currentZoom);

    // Counter-scale fleet badges so they stay the same screen size regardless of zoom
    const inverseZoom = 1 / this.currentZoom;
    for (const [, badge] of this.fleetBadges) {
      badge.setScale(inverseZoom);
    }

    // Scale hit areas inversely with zoom so they stay constant screen-pixel size
    for (const [sysId, hitArea] of this.starHitAreas) {
      const sys = this.galaxy.systems.find(s => s.id === sysId);
      const baseRadius = sys ? Math.max(STAR_VISUALS[sys.starType].radius * 2, 12) : 12;
      hitArea.setRadius(baseRadius * inverseZoom);
    }
  }

  private centerOnHomeSystem(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    if (this.homeSystemId) {
      const homeSys = this.galaxy.systems.find(s => s.id === this.homeSystemId);
      if (homeSys) {
        console.log('[GalaxyMapScene] Centering on home system', homeSys.name, 'at', homeSys.position);
        this.cameraOffset.x = cx - homeSys.position.x * this.currentZoom;
        this.cameraOffset.y = cy - homeSys.position.y * this.currentZoom;
        this.applyWorldTransform();
        return;
      }
      console.warn('[GalaxyMapScene] homeSystemId set but system not found in galaxy:', this.homeSystemId);
    } else {
      console.warn('[GalaxyMapScene] homeSystemId is null — falling back to galaxy centre');
    }

    this.centerGalaxy();
  }

  private emitViewport(): void {
    if (!this.game) return;
    const w = this.scale.width / this.currentZoom;
    const h = this.scale.height / this.currentZoom;
    const x = -this.cameraOffset.x / this.currentZoom;
    const y = -this.cameraOffset.y / this.currentZoom;
    this.game.events.emit('engine:viewport_changed', { x, y, width: w, height: h });
  }

  private handleMinimapNavigate = (data: unknown): void => {
    const { normX, normY } = data as { normX: number; normY: number };
    const worldX = normX * this.galaxy.width;
    const worldY = normY * this.galaxy.height;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.cameraOffset.x = cx - worldX * this.currentZoom;
    this.cameraOffset.y = cy - worldY * this.currentZoom;
    this.applyWorldTransform();
  };

  // ── Named event handlers (stored so they can be removed on SHUTDOWN) ─────

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

  private _handleTechResearchedSfx = (): void => {
    this.sfx?.playResearchComplete();
  };

  private _handleShipProducedSfx = (): void => {
    this.sfx?.playShipLaunch();
  };

  private _handleFleetOrderIssuedSfx = (): void => {
    this.sfx?.playFleetMove();
  };

  private _handleFleetMoveMode = (data: unknown): void => {
    const { fleetId, active } = data as { fleetId: string; active: boolean };
    this.moveModeFleetId = active ? fleetId : null;
  };

  private _handleFleetMoveModeClear = (): void => {
    this.moveModeFleetId = null;
  };

  private _handleExitToMenu = (): void => {
    destroyGameEngine();
    this.ambient?.stopAll();
    this.scene.start('MainMenuScene');
  };

  private setupEngineEvents(): void {
    this.game.events.on('ui:speed_change', this._handleSpeedChange);
    this.game.events.on('minimap:navigate', this.handleMinimapNavigate);

    // Music track change — player selects a new mood from the Settings panel
    this.game.events.on('music:set_track', this._handleMusicTrack);

    // Refresh fleet badges each engine tick so newly produced ships appear on the map
    this.game.events.on('engine:tick', this._handleEngineTick);

    // Play arrival flash when a fleet reaches its destination (or any intermediate hop)
    this.game.events.on('engine:fleet_moved', this._handleFleetMoved);

    // "Go to Fleet" button in Fleet Management screen centres the galaxy map
    this.game.events.on('galaxy:navigate_to_system', this._handleNavigateToSystem);

    // Play battle flash + "Battle!" label when two opposing fleets meet
    this.game.events.on('engine:combat_resolved', this._handleCombatResolved);

    // Game event SFX
    this.game.events.on('engine:tech_researched', this._handleTechResearchedSfx);
    this.game.events.on('engine:ship_produced', this._handleShipProducedSfx);
    // Play fleet move SFX when a movement order is issued
    this.game.events.on('engine:fleet_order_issued', this._handleFleetOrderIssuedSfx);

    // Fleet move mode — React tells us a fleet is ready for destination picking
    this.game.events.on('fleet:move_mode', this._handleFleetMoveMode);

    // React confirms/cancels relocation — clear move mode
    this.game.events.on('fleet:move_mode_clear', this._handleFleetMoveModeClear);

    // Exit to main menu: stop the engine, destroy the game state, restart MainMenuScene
    this.game.events.on('ui:exit_to_menu', this._handleExitToMenu);

    // Tactical combat — transition to CombatScene when the player clicks Engage
    this.game.events.on('combat:start_tactical', this._handleStartTactical);
  }

  private galaxyToScreen(gx: number, gy: number): { x: number; y: number } {
    return {
      x: gx * this.currentZoom + this.cameraOffset.x,
      y: gy * this.currentZoom + this.cameraOffset.y,
    };
  }

  // ── Layer 0: Deep background ──────────────────────────────────────────────────

  private createDeepBackground(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Sparse dim distant stars — kept minimal so they don't compete with game systems
    const starCount = Phaser.Math.Between(100, 180);
    for (let i = 0; i < starCount; i++) {
      const bx = Math.random() * W;
      const by = Math.random() * H;
      const alpha = Phaser.Math.FloatBetween(0.04, 0.15);
      const brightness = Math.round(Phaser.Math.FloatBetween(140, 220));
      // Slight color variation — mostly white with occasional blue/warm tint
      const tint = Math.random();
      let color: number;
      if (tint < 0.15) {
        color = (brightness << 16) | (brightness << 8) | Math.min(255, brightness + 35); // blue-ish
      } else if (tint < 0.25) {
        color = Math.min(255, brightness + 20) << 16 | brightness << 8 | (brightness - 20); // warm
      } else {
        color = (brightness << 16) | (brightness << 8) | brightness; // white
      }
      const star = this.add.circle(bx, by, 0.6, color, alpha);
      this.bgLayer.add(star);
      this.parallaxStars.push({ obj: star, baseX: bx, baseY: by, layer: 0 });
    }

    // 3-5 very faint colored deep nebula patches
    const nebulaColors = [0x1a0030, 0x000830, 0x200010, 0x001520, 0x100020];
    const nebulaCount = Phaser.Math.Between(3, 5);
    for (let i = 0; i < nebulaCount; i++) {
      const gfx = this.add.graphics();
      const bx = Math.random() * W;
      const by = Math.random() * H;
      const color = nebulaColors[i % nebulaColors.length];
      const w = Phaser.Math.Between(200, 500);
      const h = Phaser.Math.Between(150, 350);
      const angle = Math.random() * Math.PI;

      // Draw as stacked ellipses with very low alpha
      for (let layer = 0; layer < 4; layer++) {
        const layerAlpha = Phaser.Math.FloatBetween(0.02, 0.07);
        const scaleW = 1 - layer * 0.15;
        const scaleH = 1 - layer * 0.1;
        gfx.fillStyle(color, layerAlpha);
        gfx.save();
        gfx.translateCanvas(bx, by);
        gfx.rotateCanvas(angle);
        gfx.fillEllipse(0, 0, w * scaleW, h * scaleH);
        gfx.restore();
      }

      this.bgLayer.add(gfx);
      this.nebulaWisps.push({ gfx, baseX: bx, baseY: by, layer: 0 });
    }

    // Subtle radial vignette — darker edges draw the eye to the galaxy centre
    const vignette = this.add.graphics();
    const edgeAlpha = 0.25;
    // Draw concentric rectangles with increasing alpha
    for (let ring = 0; ring < 8; ring++) {
      const t = ring / 8;
      const inset = W * 0.4 * (1 - t);
      const a = edgeAlpha * t * t; // quadratic falloff
      vignette.fillStyle(0x000000, a);
      // Fill the border ring between this rect and the next
      vignette.fillRect(0, 0, W, inset);                    // top
      vignette.fillRect(0, H - inset, W, inset);            // bottom
      vignette.fillRect(0, inset, inset, H - 2 * inset);    // left
      vignette.fillRect(W - inset, inset, inset, H - 2 * inset); // right
    }
    this.bgLayer.add(vignette);
  }

  // ── Layer 1: Mid-distance stars ───────────────────────────────────────────────

  private createMidStars(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Fewer mid-distance stars — these are decorative, not game systems
    const starCount = Phaser.Math.Between(40, 70);
    for (let i = 0; i < starCount; i++) {
      const bx = Math.random() * W;
      const by = Math.random() * H;

      // Dimmer so they don't compete with actual star systems
      const isBright = Math.random() < 0.08;
      const radius = isBright ? Phaser.Math.FloatBetween(0.8, 1.2) : Phaser.Math.FloatBetween(0.3, 0.7);
      const alpha = isBright
        ? Phaser.Math.FloatBetween(0.35, 0.55)
        : Phaser.Math.FloatBetween(0.10, 0.30);

      // Bright ones get warm/cool tints
      let color: number;
      if (isBright) {
        const warmCool = Math.random();
        if (warmCool < 0.4) {
          color = 0xaaccff; // cool blue-white
        } else if (warmCool < 0.7) {
          color = 0xfff0cc; // warm yellow-white
        } else {
          color = 0xffffff; // pure white
        }
      } else {
        const v = Math.round(Phaser.Math.FloatBetween(160, 240));
        color = (v << 16) | (v << 8) | v;
      }

      const star = this.add.circle(bx, by, radius, color, alpha);
      this.midStarLayer.add(star);

      const pStar: ParallaxStar = { obj: star, baseX: bx, baseY: by, layer: 1 };

      // Twinkle: roughly 1 in 4 mid-distance stars twinkles
      if (Math.random() < 0.25) {
        const tween = this.tweens.add({
          targets: star,
          alpha: { from: alpha * 0.4, to: alpha },
          duration: Phaser.Math.Between(1200, 3500),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Math.random() * 2000,
        });
        pStar.twinkleTween = tween;
      }

      this.parallaxStars.push(pStar);
    }
  }

  // ── Layer 2: Nebula wisps ─────────────────────────────────────────────────────

  private createNebulaWisps(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Nebula cloud colors — blues, purples, teals
    const wispColors = [
      0x0a1a3a, // deep blue
      0x10083a, // deep purple
      0x001a28, // deep teal
      0x0a0a2a, // indigo
      0x180820, // plum
      0x002020, // dark teal
      0x060a30, // navy
      0x1a0a20, // dark violet
    ];

    // Fewer screen-space wisps for spiral galaxies (arm nebulae handle the structure)
    const isSpiral = this.galaxy.shapeMetadata?.shape === 'spiral';
    const wispCount = isSpiral ? Phaser.Math.Between(3, 5) : Phaser.Math.Between(5, 8);
    for (let i = 0; i < wispCount; i++) {
      const gfx = this.add.graphics();

      // Bias toward screen center — wisps should feel like they surround the galaxy
      const bx = W * 0.1 + Math.random() * W * 0.8;
      const by = H * 0.1 + Math.random() * H * 0.8;

      const color = wispColors[Math.floor(Math.random() * wispColors.length)];
      const angle = Math.random() * Math.PI * 2;

      // Each wisp is built from 5-9 overlapping ellipses at very low alpha
      const ellipseCount = Phaser.Math.Between(5, 9);
      for (let e = 0; e < ellipseCount; e++) {
        const ew = Phaser.Math.Between(120, 350);
        const eh = Phaser.Math.Between(60, 200);
        const offsetX = Phaser.Math.FloatBetween(-80, 80);
        const offsetY = Phaser.Math.FloatBetween(-50, 50);
        const ellipseAlpha = Phaser.Math.FloatBetween(0.02, 0.055);

        gfx.fillStyle(color, ellipseAlpha);
        gfx.save();
        gfx.translateCanvas(bx + offsetX, by + offsetY);
        gfx.rotateCanvas(angle + e * 0.3);
        gfx.fillEllipse(0, 0, ew, eh);
        gfx.restore();
      }

      this.wispLayer.add(gfx);
      this.nebulaWisps.push({ gfx, baseX: bx, baseY: by, layer: 2 });
    }
  }

  // ── Space dust (world-space) ──────────────────────────────────────────────────

  // ── Cosmic features: gas clouds, asteroid fields, comets ─────────────────

  private createCosmicFeatures(): void {
    this.cosmicFeaturesLayer.clear();
    const W = this.galaxy.width;
    const H = this.galaxy.height;

    // ── Gas clouds — large translucent blobs scattered across the galaxy ───
    const gasCloudColours = [0x1a2840, 0x301828, 0x182030, 0x281820, 0x102030, 0x201018];
    const gasCloudCount = Phaser.Math.Between(8, 14);
    for (let i = 0; i < gasCloudCount; i++) {
      const cx = Phaser.Math.FloatBetween(W * 0.05, W * 0.95);
      const cy = Phaser.Math.FloatBetween(H * 0.05, H * 0.95);
      const colour = gasCloudColours[Math.floor(Math.random() * gasCloudColours.length)]!;
      const angle = Math.random() * Math.PI * 2;
      const ellipseCount = Phaser.Math.Between(4, 7);

      for (let e = 0; e < ellipseCount; e++) {
        const ew = Phaser.Math.Between(60, 180);
        const eh = Phaser.Math.Between(30, 100);
        const ox = Phaser.Math.FloatBetween(-50, 50);
        const oy = Phaser.Math.FloatBetween(-30, 30);
        const alpha = Phaser.Math.FloatBetween(0.02, 0.06);

        this.cosmicFeaturesLayer.fillStyle(colour, alpha);
        this.cosmicFeaturesLayer.save();
        this.cosmicFeaturesLayer.translateCanvas(cx + ox, cy + oy);
        this.cosmicFeaturesLayer.rotateCanvas(angle + e * 0.3);
        this.cosmicFeaturesLayer.fillEllipse(0, 0, ew, eh);
        this.cosmicFeaturesLayer.restore();
      }
    }

    // ── Asteroid fields — clusters of tiny dots ─────────────────────────────
    const asteroidFieldCount = Phaser.Math.Between(5, 10);
    for (let i = 0; i < asteroidFieldCount; i++) {
      const cx = Phaser.Math.FloatBetween(W * 0.05, W * 0.95);
      const cy = Phaser.Math.FloatBetween(H * 0.05, H * 0.95);
      const spread = Phaser.Math.Between(20, 50);
      const rockCount = Phaser.Math.Between(15, 35);

      for (let r = 0; r < rockCount; r++) {
        const dist = Math.pow(Math.random(), 0.5) * spread;
        const ang = Math.random() * Math.PI * 2;
        const px = cx + Math.cos(ang) * dist;
        const py = cy + Math.sin(ang) * dist;
        const radius = Phaser.Math.FloatBetween(0.3, 1.5);
        // Rocky brownish-grey colours
        const grey = Phaser.Math.Between(60, 120);
        const colour = (grey + 20) << 16 | (grey + 10) << 8 | grey;
        const alpha = Phaser.Math.FloatBetween(0.15, 0.35);

        this.cosmicFeaturesLayer.fillStyle(colour, alpha);
        this.cosmicFeaturesLayer.fillCircle(px, py, radius);
      }
    }

    // ── Comets — animated streaks that drift across the galaxy ───────────────
    this.comets = [];
    const cometCount = Phaser.Math.Between(3, 6);
    for (let i = 0; i < cometCount; i++) {
      const speed = Phaser.Math.FloatBetween(0.005, 0.02);
      const angle = Math.random() * Math.PI * 2;
      this.comets.push({
        x: Phaser.Math.FloatBetween(W * 0.1, W * 0.9),
        y: Phaser.Math.FloatBetween(H * 0.1, H * 0.9),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: Phaser.Math.Between(15, 40),
        alpha: Phaser.Math.FloatBetween(0.15, 0.35),
        color: Math.random() < 0.5 ? 0xaaddff : 0xffeebb,
      });
    }

    // ── Faint distant galaxy silhouettes ─────────────────────────────────────
    const distantGalaxyCount = Phaser.Math.Between(2, 4);
    for (let i = 0; i < distantGalaxyCount; i++) {
      const cx = Phaser.Math.FloatBetween(W * 0.05, W * 0.95);
      const cy = Phaser.Math.FloatBetween(H * 0.05, H * 0.95);
      const size = Phaser.Math.Between(15, 35);
      const angle = Math.random() * Math.PI;
      const colour = Math.random() < 0.5 ? 0x1a1530 : 0x181a28;

      // Tiny elongated ellipse with faint glow
      for (let layer = 0; layer < 3; layer++) {
        const scale = 1 - layer * 0.2;
        const a = 0.03 + layer * 0.01;
        this.cosmicFeaturesLayer.fillStyle(colour, a);
        this.cosmicFeaturesLayer.save();
        this.cosmicFeaturesLayer.translateCanvas(cx, cy);
        this.cosmicFeaturesLayer.rotateCanvas(angle);
        this.cosmicFeaturesLayer.fillEllipse(0, 0, size * 2.5 * scale, size * scale);
        this.cosmicFeaturesLayer.restore();
      }
      // Bright core dot
      this.cosmicFeaturesLayer.fillStyle(0xccccdd, 0.08);
      this.cosmicFeaturesLayer.fillCircle(cx, cy, 1.5);
    }
  }

  private updateComets(delta: number): void {
    if (this.comets.length === 0) return;
    const W = this.galaxy.width;
    const H = this.galaxy.height;

    this.cometLayer.clear();

    for (const comet of this.comets) {
      comet.x += comet.vx * delta;
      comet.y += comet.vy * delta;

      // Wrap around galaxy bounds
      if (comet.x < -50) comet.x = W + 50;
      if (comet.x > W + 50) comet.x = -50;
      if (comet.y < -50) comet.y = H + 50;
      if (comet.y > H + 50) comet.y = -50;

      // Draw comet head
      this.cometLayer.fillStyle(0xffffff, comet.alpha);
      this.cometLayer.fillCircle(comet.x, comet.y, 1.2);

      // Draw tail — fading line trailing behind the direction of travel
      const speed = Math.sqrt(comet.vx * comet.vx + comet.vy * comet.vy);
      if (speed > 0) {
        const tailDx = -comet.vx / speed;
        const tailDy = -comet.vy / speed;
        const segments = 5;
        for (let s = 1; s <= segments; s++) {
          const t = s / segments;
          const tx = comet.x + tailDx * comet.length * t;
          const ty = comet.y + tailDy * comet.length * t;
          const tailAlpha = comet.alpha * (1 - t) * 0.6;
          const tailRadius = 1.0 * (1 - t * 0.5);
          this.cometLayer.fillStyle(comet.color, tailAlpha);
          this.cometLayer.fillCircle(tx, ty, tailRadius);
        }
      }
    }
  }

  private createSpaceDust(): void {
    this.dustLayer.clear();

    // Scatter fine particles densely near star systems, fading with distance
    for (const sys of this.galaxy.systems) {
      if (!this.knownSystemIds.has(sys.id)) continue;

      const dustCount = Phaser.Math.Between(18, 35);
      for (let i = 0; i < dustCount; i++) {
        // Random polar coords: closer particles are more likely
        const dist = Math.pow(Math.random(), 0.6) * 55;
        const ang = Math.random() * Math.PI * 2;
        const px = sys.position.x + Math.cos(ang) * dist;
        const py = sys.position.y + Math.sin(ang) * dist;

        // Alpha falls off with distance
        const alpha = (1 - dist / 55) * Phaser.Math.FloatBetween(0.04, 0.12);
        const radius = Phaser.Math.FloatBetween(0.3, 0.9);

        this.dustLayer.fillStyle(0x223355, alpha);
        this.dustLayer.fillCircle(px, py, radius);
      }
    }

    // ── Arm-following dust (visible regardless of fog-of-war) ────────────────
    const meta = this.galaxy.shapeMetadata;
    if (meta?.shape === 'spiral') {
      const maxR = Math.min(this.galaxy.width, this.galaxy.height) / 2 * 0.92;
      const dustColours = [0x332211, 0x221133, 0x1a1a2e, 0x2a1a0a];

      for (let arm = 0; arm < meta.armCount; arm++) {
        const pts = sampleSpiralArm(
          meta.armAngles[arm]!, meta.spiralA, meta.spiralTightness,
          meta.centreX, meta.centreY, maxR, 16,
        );
        for (const pt of pts) {
          const spread = 25 + pt.t * 20;
          const count = 15 + Math.floor(pt.t * 15);
          for (let i = 0; i < count; i++) {
            const r = Math.pow(Math.random(), 0.5) * spread;
            const a = Math.random() * Math.PI * 2;
            const px = pt.x + Math.cos(a) * r;
            const py = pt.y + Math.sin(a) * r;
            const alpha = (1 - r / spread) * Phaser.Math.FloatBetween(0.02, 0.06);
            const col = dustColours[Math.floor(Math.random() * dustColours.length)]!;
            this.dustLayer.fillStyle(col, alpha);
            this.dustLayer.fillCircle(px, py, Phaser.Math.FloatBetween(0.4, 1.2));
          }
        }
      }
    }
  }

  // ── Arm-following nebulae (world-space) ──────────────────────────────────────

  private createArmNebulae(): void {
    this.armNebulaLayer.clear();
    const meta = this.galaxy.shapeMetadata;
    if (meta?.shape !== 'spiral') return;

    const maxR = Math.min(this.galaxy.width, this.galaxy.height) / 2 * 0.92;

    // Alternate cool and warm nebula tints per arm
    const coolPalette = [0x0a1a3a, 0x10083a, 0x060a30, 0x0a0a2a];
    const warmPalette = [0x200010, 0x1a0a20, 0x180820, 0x2a1005];

    for (let arm = 0; arm < meta.armCount; arm++) {
      const palette = arm % 2 === 0 ? coolPalette : warmPalette;
      const pts = sampleSpiralArm(
        meta.armAngles[arm]!, meta.spiralA, meta.spiralTightness,
        meta.centreX, meta.centreY, maxR, 10,
      );

      for (const pt of pts) {
        const color = palette[Math.floor(Math.random() * palette.length)]!;
        // Size increases with distance from centre (outer arms are fuzzier)
        const baseSize = 40 + pt.t * 80;
        const ellipseCount = Phaser.Math.Between(3, 5);

        for (let e = 0; e < ellipseCount; e++) {
          const ew = baseSize * Phaser.Math.FloatBetween(0.6, 1.4);
          const eh = baseSize * Phaser.Math.FloatBetween(0.3, 0.7);
          const offsetX = Phaser.Math.FloatBetween(-baseSize * 0.3, baseSize * 0.3);
          const offsetY = Phaser.Math.FloatBetween(-baseSize * 0.2, baseSize * 0.2);
          const ellipseAlpha = Phaser.Math.FloatBetween(0.015, 0.045);

          this.armNebulaLayer.fillStyle(color, ellipseAlpha);
          this.armNebulaLayer.save();
          this.armNebulaLayer.translateCanvas(pt.x + offsetX, pt.y + offsetY);
          // Rotate to roughly follow arm tangent
          this.armNebulaLayer.rotateCanvas(pt.angle + e * 0.25);
          this.armNebulaLayer.fillEllipse(0, 0, ew, eh);
          this.armNebulaLayer.restore();
        }
      }
    }

    // Central galactic bulge glow
    const bulgeR = meta.bulgeRadiusFraction * maxR;
    const bulgeColours = [0x1a1020, 0x0a0a1a, 0x100818];
    for (let i = 0; i < 5; i++) {
      const r = bulgeR * (1 - i * 0.15);
      const col = bulgeColours[i % bulgeColours.length]!;
      this.armNebulaLayer.fillStyle(col, 0.03 + i * 0.008);
      this.armNebulaLayer.fillCircle(meta.centreX, meta.centreY, r);
    }
  }

  // ── Galactic centre: black hole + accretion disk ────────────────────────────

  private createGalacticCentre(): void {
    // Clear previous children
    this.blackHoleLayer.removeAll(true);

    const meta = this.galaxy.shapeMetadata;
    if (meta?.shape !== 'spiral') return;

    // Position the container at the galaxy centre so rotation spins in place
    this.blackHoleLayer.setPosition(meta.centreX, meta.centreY);

    // All children drawn at local origin (0,0) relative to container

    // ── Accretion disk outer glow (diffuse warm halo) ───────────────────────
    const outerGlow = this.add.graphics();
    const glowRadii = [80, 60, 45, 35];
    const glowAlphas = [0.015, 0.025, 0.035, 0.045];
    const glowColours = [0xff8800, 0xffaa33, 0xffd080, 0xffeedd];
    for (let i = 0; i < glowRadii.length; i++) {
      outerGlow.fillStyle(glowColours[i]!, glowAlphas[i]!);
      outerGlow.fillCircle(0, 0, glowRadii[i]!);
    }
    this.blackHoleLayer.add(outerGlow);

    // ── Accretion disk ring (bright stroked circle) ─────────────────────────
    const diskRing = this.add.graphics();
    diskRing.lineStyle(4, 0xfff8e0, 0.35);
    diskRing.strokeCircle(0, 0, 22);
    diskRing.lineStyle(2, 0xffddaa, 0.25);
    diskRing.strokeCircle(0, 0, 18);
    this.blackHoleLayer.add(diskRing);

    // Pulse the disk ring
    this.tweens.add({
      targets: diskRing,
      alpha: { from: 0.7, to: 1.0 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Event horizon glow ring (thin, intense) ─────────────────────────────
    const horizonRing = this.add.graphics();
    horizonRing.lineStyle(2, 0xeeeeff, 0.5);
    horizonRing.strokeCircle(0, 0, 12);
    horizonRing.lineStyle(1, 0xffffff, 0.3);
    horizonRing.strokeCircle(0, 0, 13);
    this.blackHoleLayer.add(horizonRing);

    // ── Pitch-black centre (event horizon) ──────────────────────────────────
    const blackHole = this.add.circle(0, 0, 10, 0x000000, 1.0);
    this.blackHoleLayer.add(blackHole);
  }

  // ── Accretion disk animation ────────────────────────────────────────────────

  private updateAccretionDisk(_delta: number): void {
    // No-op if not spiral or no children
    if (this.blackHoleLayer.length === 0) return;

    // Slow rotation of the entire black hole layer
    const rotSpeed = 0.0003; // rad/s — very subtle
    this.blackHoleLayer.rotation += rotSpeed * _delta;
  }

  // ── Bake static layers into RenderTextures for GPU efficiency ────────────────

  /**
   * After all static Graphics are drawn (arm nebulae, cosmic features, dust),
   * bake each into a RenderTexture so they become single-quad draws instead
   * of thousands of individual fill calls per frame.
   */
  private bakeStaticLayers(): void {
    const W = this.galaxy.width;
    const H = this.galaxy.height;

    // Bake each heavy Graphics into a RenderTexture, then replace it in worldContainer
    const layersToBake = [
      { gfx: this.armNebulaLayer, name: 'armNebula' },
      { gfx: this.cosmicFeaturesLayer, name: 'cosmicFeatures' },
      { gfx: this.dustLayer, name: 'dust' },
    ];

    for (const { gfx, name } of layersToBake) {
      const rtKey = `baked_${name}`;
      // Remove old texture if it exists (e.g. scene restart)
      if (this.textures.exists(rtKey)) {
        this.textures.remove(rtKey);
      }

      const rt = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0);
      rt.draw(gfx, 0, 0);

      // Replace the Graphics with its baked image in the worldContainer
      const idx = this.worldContainer.getIndex(gfx);
      gfx.destroy();
      if (idx >= 0) {
        this.worldContainer.addAt(rt, idx);
      } else {
        this.worldContainer.add(rt);
      }
    }

    // Update references (the Graphics objects are now destroyed)
    // Use dummy Graphics so any residual calls don't crash
    this.armNebulaLayer = this.add.graphics();
    this.cosmicFeaturesLayer = this.add.graphics();
    this.dustLayer = this.add.graphics();
  }

  // ── Parallax update ───────────────────────────────────────────────────────────

  private _prevParallaxCamX = NaN;
  private _prevParallaxCamY = NaN;
  private _prevParallaxZoom = NaN;

  private updateParallax(): void {
    // Skip if camera hasn't moved
    if (this.cameraOffset.x === this._prevParallaxCamX &&
        this.cameraOffset.y === this._prevParallaxCamY &&
        this.currentZoom === this._prevParallaxZoom) return;
    this._prevParallaxCamX = this.cameraOffset.x;
    this._prevParallaxCamY = this.cameraOffset.y;
    this._prevParallaxZoom = this.currentZoom;

    const W = this.scale.width;
    const H = this.scale.height;

    const refX = this.scale.width / 2 - (this.galaxy.width / 2) * this.currentZoom;
    const refY = this.scale.height / 2 - (this.galaxy.height / 2) * this.currentZoom;

    const camDeltaX = this.cameraOffset.x - refX;
    const camDeltaY = this.cameraOffset.y - refY;

    // Apply per-layer shift and wrap around screen edges
    for (const s of this.parallaxStars) {
      const factor = s.layer === 0 ? PARALLAX_FACTOR_L0 : PARALLAX_FACTOR_L1;
      const shiftX = camDeltaX * factor;
      const shiftY = camDeltaY * factor;
      s.obj.setPosition(
        ((s.baseX + shiftX) % W + W) % W,
        ((s.baseY + shiftY) % H + H) % H,
      );
    }

    // Nebula wisps — no wrapping, just shift (they're large enough that
    // they'll drift off-screen slowly and that's fine visually)
    for (const n of this.nebulaWisps) {
      const factor = n.layer === 0 ? PARALLAX_FACTOR_L0 : PARALLAX_FACTOR_L2;
      const shiftX = camDeltaX * factor;
      const shiftY = camDeltaY * factor;
      n.gfx.setPosition(shiftX, shiftY);
    }
  }

  // ── Wormhole drawing ──────────────────────────────────────────────────────────

  /**
   * Check whether the player empire has researched wormhole stabilisation.
   * Used to control wormhole line visibility.
   */
  private _playerHasWormholeTech(): boolean {
    const engine = getGameEngine();
    if (!engine) return false;
    const state = engine.getState().gameState;
    const playerEmpire = state.empires.find(e => !e.isAI);
    if (!playerEmpire) return false;
    return playerEmpire.technologies.includes('wormhole_stabilisation');
  }

  private drawWormholes(highlightSystemId: string | null): void {
    this.wormholeLayer.clear();

    // Clear existing wormhole particles
    for (const p of this.wormholeParticles) {
      p.obj.destroy();
    }
    this.wormholeParticles = [];

    const hasWormholeTech = this._playerHasWormholeTech();

    const systemMap = new Map<string, StarSystem>(
      this.galaxy.systems.map(s => [s.id, s]),
    );

    const drawn = new Set<string>();

    for (const sys of this.galaxy.systems) {
      if (!this.knownSystemIds.has(sys.id)) continue;

      for (const targetId of sys.wormholes) {
        const edgeKey = [sys.id, targetId].sort().join('|');
        if (drawn.has(edgeKey)) continue;
        drawn.add(edgeKey);

        const target = systemMap.get(targetId);
        if (!target || !this.knownSystemIds.has(targetId)) continue;

        const isHighlighted =
          highlightSystemId === sys.id || highlightSystemId === targetId;

        // Always draw the faint normal-space lane beneath any wormhole styling
        this._drawNormalLane(sys, target);

        // Draw the wormhole-tech overlay on top
        this._drawWormholeLine(sys, target, isHighlighted, hasWormholeTech);

        // Only spawn drifting particles if the player has wormhole tech
        if (hasWormholeTech) {
          this.spawnWormholeParticles(sys, target, isHighlighted);
        }
      }
    }
  }

  /**
   * Draw a faint white dashed "normal space lane" between two known systems.
   * These are always visible once both endpoints are discovered and represent
   * the basic FTL routes, independent of wormhole tech.
   */
  /** Compute inset start/end points so lines don't overlap star glows. */
  private _insetLine(sysA: StarSystem, sysB: StarSystem): { ax: number; ay: number; bx: number; by: number; dx: number; dy: number; len: number } | null {
    const oax = sysA.position.x;
    const oay = sysA.position.y;
    const obx = sysB.position.x;
    const oby = sysB.position.y;
    const dx = obx - oax;
    const dy = oby - oay;
    const fullLen = Math.sqrt(dx * dx + dy * dy);
    if (fullLen < 1) return null;

    const insetA = STAR_VISUALS[sysA.starType].glowRadius + 4;
    const insetB = STAR_VISUALS[sysB.starType].glowRadius + 4;
    if (insetA + insetB >= fullLen) return null; // stars too close, skip line

    const nx = dx / fullLen;
    const ny = dy / fullLen;
    return {
      ax: oax + nx * insetA,
      ay: oay + ny * insetA,
      bx: obx - nx * insetB,
      by: oby - ny * insetB,
      dx, dy,
      len: fullLen - insetA - insetB,
    };
  }

  private _drawNormalLane(sysA: StarSystem, sysB: StarSystem): void {
    const line = this._insetLine(sysA, sysB);
    if (!line) return;
    const { ax, ay, dx, dy, len } = line;
    const fullLen = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / fullLen;
    const ny = dy / fullLen;

    const lineWidth = 0.5; // fixed world-space width — no per-frame zoom adjustment
    let d = 0;
    while (d < len) {
      const dashEnd = Math.min(d + LANE_DASH_LEN, len);

      this.wormholeLayer.lineStyle(lineWidth, LANE_COLOR, LANE_ALPHA);
      this.wormholeLayer.beginPath();
      this.wormholeLayer.moveTo(ax + nx * d, ay + ny * d);
      this.wormholeLayer.lineTo(ax + nx * dashEnd, ay + ny * dashEnd);
      this.wormholeLayer.strokePath();

      d += LANE_DASH_LEN + LANE_GAP_LEN;
    }
  }

  /**
   * Draw the wormhole-tech overlay line on top of the normal-space lane.
   *
   * With wormhole tech: a solid blue line whose alpha oscillates between
   * WORM_ALPHA_MIN and WORM_ALPHA_MAX using elapsed scene time (stored in
   * `this._wormholePhase`), giving a pulsing glow effect.  A subtly wider
   * semi-transparent version is drawn first to simulate a soft glow.
   *
   * Without tech: a very faint blue dashed line hinting that a wormhole
   * connection exists but cannot yet be traversed.
   *
   * Advanced/artificial wormhole connections (future feature, connectionType
   * === 'advanced') would use a gold solid line.
   */
  private _drawWormholeLine(
    sysA: StarSystem,
    sysB: StarSystem,
    highlighted: boolean,
    hasWormholeTech: boolean,
  ): void {
    const line = this._insetLine(sysA, sysB);
    if (!line) return;
    const { ax, ay, bx, by, len } = line;
    const fullLen = Math.sqrt(line.dx * line.dx + line.dy * line.dy);
    const nx = line.dx / fullLen;
    const ny = line.dy / fullLen;

    if (!hasWormholeTech) {
      // Very faint blue dashes — wormhole is known but not traversable yet
      const lineWidth = 0.4;
      let d = 0;
      while (d < len) {
        const dashEnd = Math.min(d + 3, len);
        this.wormholeLayer.lineStyle(lineWidth, WORM_NO_TECH_COLOR, WORM_NO_TECH_ALPHA);
        this.wormholeLayer.beginPath();
        this.wormholeLayer.moveTo(ax + nx * d, ay + ny * d);
        this.wormholeLayer.lineTo(ax + nx * dashEnd, ay + ny * dashEnd);
        this.wormholeLayer.strokePath();
        d += 13;
      }
      return;
    }

    // Pulsing blue wormhole line
    const pulseAlpha = WORM_ALPHA_MIN +
      (WORM_ALPHA_MAX - WORM_ALPHA_MIN) *
      (0.5 + 0.5 * Math.sin(this._wormholePhase));
    const highlightBoost = highlighted ? 0.15 : 0;
    const alpha = Math.min(1, pulseAlpha + highlightBoost);

    const coreWidth  = 0.8;
    const glowWidth  = 2.0;

    // Glow layer
    this.wormholeLayer.lineStyle(glowWidth, WORM_COLOR, alpha * 0.35);
    this.wormholeLayer.beginPath();
    this.wormholeLayer.moveTo(ax, ay);
    this.wormholeLayer.lineTo(bx, by);
    this.wormholeLayer.strokePath();

    // Core line
    this.wormholeLayer.lineStyle(coreWidth, WORM_COLOR, alpha);
    this.wormholeLayer.beginPath();
    this.wormholeLayer.moveTo(ax, ay);
    this.wormholeLayer.lineTo(bx, by);
    this.wormholeLayer.strokePath();
  }

  /**
   * Draw an advanced/artificial wormhole connection in yellow-gold.
   * This is provided for future use when player-created wormholes are added.
   */
  private _drawAdvancedWormholeLine(sysA: StarSystem, sysB: StarSystem): void {
    const line = this._insetLine(sysA, sysB);
    if (!line) return;
    const { ax, ay, bx, by } = line;

    const coreWidth = 0.8;
    const glowWidth = 2.0;

    const shimmerAlpha = ADV_WORM_ALPHA +
      0.1 * Math.sin(this._wormholePhase + Math.PI / 3);

    this.wormholeLayer.lineStyle(glowWidth, ADV_WORM_COLOR, shimmerAlpha * 0.35);
    this.wormholeLayer.beginPath();
    this.wormholeLayer.moveTo(ax, ay);
    this.wormholeLayer.lineTo(bx, by);
    this.wormholeLayer.strokePath();

    this.wormholeLayer.lineStyle(coreWidth, ADV_WORM_COLOR, shimmerAlpha);
    this.wormholeLayer.beginPath();
    this.wormholeLayer.moveTo(ax, ay);
    this.wormholeLayer.lineTo(bx, by);
    this.wormholeLayer.strokePath();
  }

  /** Spawn 2-3 tiny particles drifting along a wormhole connection. */
  private spawnWormholeParticles(sysA: StarSystem, sysB: StarSystem, highlighted: boolean): void {
    const count = highlighted ? 3 : 2;
    for (let i = 0; i < count; i++) {
      // Distribute initial positions so they're not all bunched at start
      const t0 = i / count;
      const speed = Phaser.Math.FloatBetween(0.00008, 0.00015); // t-units per ms

      // Compute world position from t
      const px = sysA.position.x + t0 * (sysB.position.x - sysA.position.x);
      const py = sysA.position.y + t0 * (sysB.position.y - sysA.position.y);

      const alpha = highlighted ? 0.55 : 0.3;
      const dot = this.add.circle(px, py, 1.2, highlighted ? 0x88ccff : 0x445566, alpha);
      this.starLayer.add(dot);

      this.wormholeParticles.push({ t: t0, speed, sysA, sysB, obj: dot });
    }
  }

  // ── Wormhole particle update ──────────────────────────────────────────────────

  private updateWormholeParticles(delta: number): void {
    // Advance pulse phase (~0.8 rad/s → ~7.9 s full cycle)
    this._wormholePhase += 0.0008 * delta;

    // Animate wormhole layer alpha for pulse effect (no full redraw)
    if (this._playerHasWormholeTech()) {
      const pulseAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this._wormholePhase));
      this.wormholeLayer.setAlpha(pulseAlpha);
    }

    for (const p of this.wormholeParticles) {
      p.t += p.speed * delta;
      if (p.t > 1) p.t -= 1;

      const px = p.sysA.position.x + p.t * (p.sysB.position.x - p.sysA.position.x);
      const py = p.sysA.position.y + p.t * (p.sysB.position.y - p.sysA.position.y);
      p.obj.setPosition(px, py);
    }
  }

  // ── Star creation ─────────────────────────────────────────────────────────────

  private createStars(): void {
    for (const sys of this.galaxy.systems) {
      this.createStarObject(sys);
    }
  }

  private createStarObject(sys: StarSystem): void {
    const visuals = STAR_VISUALS[sys.starType];
    const known = this.knownSystemIds.has(sys.id);
    const { x, y } = sys.position;

    if (known) {
      // ── Layer 1: Wide corona (outermost, very low alpha) ─────────────────────
      const corona = this.add.circle(x, y, visuals.glowRadius * 1.6, visuals.coronaColor, 0.07);
      this.starLayer.add(corona);

      // ── Layer 2: Glow (mid halo, pulsing) ────────────────────────────────────
      const glow = this.add.circle(x, y, visuals.glowRadius, visuals.glowColor, 0.16);
      this.starLayer.add(glow);
      const glowTween = this.tweens.add({
        targets: glow,
        alpha: { from: 0.08, to: 0.28 },
        scale: { from: 0.88, to: 1.12 },
        duration: 2000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1500,
      });
      this.pulseTweens.set(sys.id + '_glow', glowTween);

      // ── Layer 3: Inner glow (tighter, brighter) ───────────────────────────────
      const innerGlow = this.add.circle(x, y, visuals.glowRadius * 0.45, visuals.glowColor, 0.35);
      this.starLayer.add(innerGlow);

      // ── Layer 4: Diffraction spikes (bright/hot stars only) ───────────────────
      if (visuals.hasDiffractionSpikes) {
        this.drawDiffractionSpikes(x, y, visuals.radius, visuals.glowColor);
      }

      // ── Layer 5: Star core (bright near-white center) ─────────────────────────
      const core = this.add.circle(x, y, visuals.radius, visuals.color, 1.0);
      this.starLayer.add(core);

      // Very subtle core pulse (±5% alpha, different phase from glow)
      const coreTween = this.tweens.add({
        targets: core,
        alpha: { from: 0.88, to: 1.0 },
        duration: 1800 + Math.random() * 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1000,
      });
      this.pulseTweens.set(sys.id + '_core', coreTween);

    } else {
      // Fog of war: dim, colorless
      const fogGlow = this.add.circle(x, y, 6, FOG_COLOR, 0.06);
      this.starLayer.add(fogGlow);
      const fogCore = this.add.circle(x, y, 3, FOG_COLOR, 0.28);
      this.starLayer.add(fogCore);
    }

    // ── Hit area (always present, invisible) ─────────────────────────────────
    // Hit area scales inversely with zoom so it stays ~12-14 screen pixels
    const hitRadius = Math.max(visuals.radius * 2, 12) / this.currentZoom;
    const hitArea = this.add.circle(x, y, hitRadius, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.starLayer.add(hitArea);
    this.starHitAreas.set(sys.id, hitArea);

    hitArea.on('pointerover', () => {
      if (!this.isDragging) this.showTooltip(sys);
    });
    hitArea.on('pointerout', () => {
      this.hideTooltip();
    });
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const now = this.time.now;
      const isDoubleClick =
        now - this.lastPointerDownTime < 350 &&
        this.lastPointerDownSystemId === sys.id;

      this.lastPointerDownTime = now;
      this.lastPointerDownSystemId = sys.id;

      if (isDoubleClick && this.knownSystemIds.has(sys.id)) {
        this.transitionToSystemView(sys);
        return;
      }
      if (pointer.leftButtonDown()) {
        this.selectSystem(sys.id, pointer.event.shiftKey);
      }
    });
  }

  /**
   * Draw 4 subtle diffraction spikes radiating from a bright star's position.
   * Spikes are very thin, very transparent lines.
   */
  private drawDiffractionSpikes(x: number, y: number, starRadius: number, color: number): void {
    const spikeGfx = this.add.graphics();
    const spikeLen = starRadius * 5;
    const angles = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];

    for (const angle of angles) {
      // Draw spike in both directions from center
      for (const dir of [1, -1]) {
        // Fade spike from center outward using 3 segments
        for (let seg = 0; seg < 3; seg++) {
          const t0 = seg / 3;
          const t1 = (seg + 1) / 3;
          const segAlpha = 0.25 * (1 - t0); // fades outward
          spikeGfx.lineStyle(0.7, color, segAlpha);
          spikeGfx.beginPath();
          spikeGfx.moveTo(x + Math.cos(angle) * spikeLen * dir * t0, y + Math.sin(angle) * spikeLen * dir * t0);
          spikeGfx.lineTo(x + Math.cos(angle) * spikeLen * dir * t1, y + Math.sin(angle) * spikeLen * dir * t1);
          spikeGfx.strokePath();
        }
      }
    }

    this.starLayer.add(spikeGfx);
  }

  // ── Ownership rings (empire-coloured) ───────────────────────────────────────

  private createHomeRing(): void {
    this.homeRing = this.add.graphics();
    this.starLayer.add(this.homeRing);
    this.drawHomeRing();
  }

  private drawHomeRing(): void {
    this.homeRing.clear();

    // Build empire colour lookup from live engine state
    const empireColors = new Map<string, number>();
    const engine = getGameEngine();
    if (engine) {
      for (const emp of engine.getState().gameState.empires) {
        empireColors.set(emp.id, parseInt(emp.color.replace('#', ''), 16));
      }
    }

    for (const sys of this.galaxy.systems) {
      if (!sys.ownerId) continue;
      const color = empireColors.get(sys.ownerId) ?? 0x00d4ff;
      const visuals = STAR_VISUALS[sys.starType];
      const ringRadius = visuals.glowRadius + 6;
      const isHome = sys.id === this.homeSystemId;

      // Inner ring — brighter for home system
      this.homeRing.lineStyle((isHome ? 2 : 1.2) / this.currentZoom, color, isHome ? 0.65 : 0.45);
      this.homeRing.strokeCircle(sys.position.x, sys.position.y, ringRadius);

      // Outer glow ring
      if (isHome) {
        this.homeRing.lineStyle(1 / this.currentZoom, color, 0.3);
        this.homeRing.strokeCircle(sys.position.x, sys.position.y, ringRadius + 6);
      }
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  private createSelectionRing(): void {
    this.selectionRing = this.add.graphics();
    this.starLayer.add(this.selectionRing);
  }

  private createPingGraphics(): void {
    this.pingGraphics = this.add.graphics();
    this.starLayer.add(this.pingGraphics);
  }

  private selectSystem(id: string, shiftKey = false): void {
    this.selectedSystemId = id;
    this.drawSelectionRing(id);
    this.drawWormholes(id);
    this.playPingEffect(id);

    // Highlight neighbors
    this.highlightConnectedSystems(id);

    const sys = this.galaxy.systems.find(s => s.id === id);

    // If move mode is active, emit a destination-selected event instead
    if (this.moveModeFleetId && sys) {
      // Shift-click in move mode => add as waypoint directly
      if (shiftKey) {
        const engine = getGameEngine();
        if (engine) {
          engine.addWaypoint(this.moveModeFleetId, id);
        }
        // Stay in move mode so the player can keep adding waypoints
        this.sfx?.playSelectSystem();
        return;
      }

      this.game.events.emit('fleet:destination_selected', {
        fleetId: this.moveModeFleetId,
        systemId: id,
        systemName: sys.name,
      });
      // Do NOT clear moveModeFleetId here — the React layer will clear it
      // after the player confirms or cancels the relocation dialog.
      this.sfx?.playSelectSystem();
      return;
    }

    if (sys) {
      this.game.events.emit('system:selected', sys);
    }

    // Audio: system selection chime
    this.sfx?.playSelectSystem();
  }

  private drawSelectionRing(id: string): void {
    this.selectionRing.clear();
    const sys = this.galaxy.systems.find(s => s.id === id);
    if (!sys) return;

    const visuals = STAR_VISUALS[sys.starType];
    const ringRadius = visuals.glowRadius + 2;

    // Inner solid ring
    this.selectionRing.lineStyle(1.8 / this.currentZoom, SELECTION_RING_COLOR, SELECTION_RING_ALPHA);
    this.selectionRing.strokeCircle(sys.position.x, sys.position.y, ringRadius);

    // Outer faint ring (slightly larger gap)
    this.selectionRing.lineStyle(0.8 / this.currentZoom, SELECTION_RING_COLOR, 0.3);
    this.selectionRing.strokeCircle(sys.position.x, sys.position.y, ringRadius + 6);

    // Small tick marks at cardinal points (N, E, S, W) for a sci-fi targeting feel
    const tickLen = 4 / this.currentZoom;
    const tickRadius = ringRadius + 3;
    const tickAlpha = 0.6;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const ix = sys.position.x + Math.cos(angle) * tickRadius;
      const iy = sys.position.y + Math.sin(angle) * tickRadius;
      const ox = sys.position.x + Math.cos(angle) * (tickRadius + tickLen);
      const oy = sys.position.y + Math.sin(angle) * (tickRadius + tickLen);
      this.selectionRing.lineStyle(1.2 / this.currentZoom, SELECTION_RING_COLOR, tickAlpha);
      this.selectionRing.beginPath();
      this.selectionRing.moveTo(ix, iy);
      this.selectionRing.lineTo(ox, oy);
      this.selectionRing.strokePath();
    }
  }

  /** Brief expanding ring "ping" effect when a system is selected. */
  private playPingEffect(id: string): void {
    const sys = this.galaxy.systems.find(s => s.id === id);
    if (!sys) return;

    const visuals = STAR_VISUALS[sys.starType];
    const startRadius = visuals.glowRadius + 2;

    // We animate via a tween on a plain object and redraw each frame
    const state = { radius: startRadius, alpha: 0.7 };
    this.tweens.add({
      targets: state,
      radius: startRadius + 30,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.pingGraphics.clear();
        this.pingGraphics.lineStyle(1.5 / this.currentZoom, 0xaaddff, state.alpha);
        this.pingGraphics.strokeCircle(sys.position.x, sys.position.y, state.radius);
      },
      onComplete: () => {
        this.pingGraphics.clear();
      },
    });
  }

  /** Subtly brighten wormhole-connected neighbors of the selected system. */
  private highlightConnectedSystems(id: string): void {
    const sys = this.galaxy.systems.find(s => s.id === id);
    if (!sys) return;
    // The wormhole redraw via drawWormholes already handles highlighted lines;
    // the particle color update happens implicitly in spawnWormholeParticles.
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────────

  private createTooltip(): void {
    this.tooltipBg = this.add.rectangle(0, 0, 120, 28, TOOLTIP_BG_COLOR, 0.88)
      .setOrigin(0, 1)
      .setVisible(false)
      .setDepth(100);

    this.tooltipText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#aaccee',
    })
      .setOrigin(0, 1)
      .setVisible(false)
      .setDepth(101);

    this.uiLayer.add([this.tooltipBg, this.tooltipText]);
  }

  private showTooltip(sys: StarSystem): void {
    const screen = this.galaxyToScreen(sys.position.x, sys.position.y);
    const padding = 8;
    const known = this.knownSystemIds.has(sys.id);

    let fullText: string;
    if (!known) {
      fullText = 'Unknown system';
    } else {
      const label = sys.name;
      const typeLabel = sys.starType.replace('_', ' ');
      fullText = `${label}\n${typeLabel}`;

      // If the system has wormholes, show wormhole tech status
      if (sys.wormholes.length > 0 && !this._playerHasWormholeTech()) {
        fullText += '\nWormhole \u2014 Requires wormhole\nstabilisation technology';
      }
    }

    this.tooltipText.setText(fullText);
    const tw = this.tooltipText.width + padding * 2;
    const th = this.tooltipText.height + padding * 2;

    const tx = screen.x - tw / 2 + padding;
    const ty = screen.y - (STAR_VISUALS[sys.starType].glowRadius * this.currentZoom) - 10;

    this.tooltipBg.setSize(tw, th);
    this.tooltipBg.setPosition(tx, ty);
    this.tooltipText.setPosition(tx + padding, ty);
    this.tooltipBg.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipBg.setVisible(false);
    this.tooltipText.setVisible(false);
  }

  // ── Back button ───────────────────────────────────────────────────────────────

  private createBackButton(): void {
    const backButton = this.add
      .text(20, 20, '← Main Menu', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#7799bb',
      })
      .setInteractive({ useHandCursor: true })
      .setDepth(200);

    backButton.on('pointerover', () => backButton.setColor('#ffffff'));
    backButton.on('pointerout', () => backButton.setColor('#7799bb'));
    backButton.on('pointerdown', () => {
      this.sfx?.playClick();
      destroyGameEngine();
      this.ambient?.stopAll();
      this.music?.crossfadeTo('menu');
      this.scene.start('MainMenuScene');
    });

    this.uiLayer.add(backButton);
  }

  private createZoomButtons(): void {
    const W = this.scale.width;
    const btnStyle = {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#7799bb',
      backgroundColor: '#0a0a18',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    };

    const zoomIn = this.add
      .text(W - 60, 80, '+', btnStyle)
      .setInteractive({ useHandCursor: true })
      .setDepth(200);
    zoomIn.on('pointerover', () => zoomIn.setColor('#ffffff'));
    zoomIn.on('pointerout', () => zoomIn.setColor('#7799bb'));
    zoomIn.on('pointerdown', () => {
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom + ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM);
    });

    const zoomOut = this.add
      .text(W - 60, 116, '−', btnStyle) // use minus sign (−) not hyphen
      .setInteractive({ useHandCursor: true })
      .setDepth(200);
    zoomOut.on('pointerover', () => zoomOut.setColor('#ffffff'));
    zoomOut.on('pointerout', () => zoomOut.setColor('#7799bb'));
    zoomOut.on('pointerdown', () => {
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom - ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM);
    });

    this.uiLayer.add(zoomIn);
    this.uiLayer.add(zoomOut);
  }

  // ── Scene transition ──────────────────────────────────────────────────────────

  private transitionToSystemView(sys: StarSystem): void {
    this.ambient?.stopAll();
    // Music crossfade is handled by SystemViewScene on its create()
    this.scene.start('SystemViewScene', { system: sys });
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.isDragging = true;
        this.dragStart.x = pointer.x - this.cameraOffset.x;
        this.dragStart.y = pointer.y - this.cameraOffset.y;
        this.hideTooltip();
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && pointer.isDown) {
        this.cameraOffset.x = pointer.x - this.dragStart.x;
        this.cameraOffset.y = pointer.y - this.dragStart.y;
        this.applyWorldTransform();
        this.updateSelectionRingScale();
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const zoomDelta = deltaY > 0 ? -ZOOM_FACTOR : ZOOM_FACTOR;
      this.targetZoom = Phaser.Math.Clamp(
        this.targetZoom + zoomDelta,
        MIN_ZOOM,
        MAX_ZOOM,
      );
    });

    // Prevent browser zoom (Ctrl+scroll) from firing alongside game zoom
    this.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
    }, { passive: false });
  }

  // ── Zoom lerp ─────────────────────────────────────────────────────────────────

  private updateZoomLerp(): void {
    if (Math.abs(this.currentZoom - this.targetZoom) < 0.001) return;

    const prevZoom = this.currentZoom;
    this.currentZoom = Phaser.Math.Linear(this.currentZoom, this.targetZoom, ZOOM_LERP);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const zoomRatio = this.currentZoom / prevZoom;
    this.cameraOffset.x = cx + (this.cameraOffset.x - cx) * zoomRatio;
    this.cameraOffset.y = cy + (this.cameraOffset.y - cy) * zoomRatio;

    this.applyWorldTransform();
    this.updateSelectionRingScale();
  }

  private updateSelectionRingScale(): void {
    if (this.selectedSystemId) {
      this.drawSelectionRing(this.selectedSystemId);
    }
    this.drawHomeRing();
  }

  // ── Fleet indicators on galaxy map ──────────────────────────────────────────

  /** Container for fleet badge graphics, keyed by fleetId. */
  private fleetBadges: Map<string, Phaser.GameObjects.Container> = new Map();

  /**
   * Animated transit dots — one per active movement order.
   * Each entry carries: the graphics object, the current t value (0–1) along
   * the current hop segment, and the two endpoint systems for interpolation.
   * The `speed` field is fractional t-units per ms, derived from ticksPerHop.
   */
  private transitDots: Map<string, {
    gfx: Phaser.GameObjects.Arc;
    t: number;
    speed: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }> = new Map();

  /**
   * Render one icon per fleet at each star system, showing the fleet name
   * and a thumbnail of the largest hull class in the fleet.
   *
   * Called on create and on each engine tick.
   *
   * Fog of war rules:
   * - Only show badges in systems the player has discovered (knownSystemIds).
   * - Only show the player's own fleets, plus enemy fleets in systems the
   *   player can currently observe (i.e. has a fleet or colony there).
   *
   * When multiple fleets share the same system, they are offset vertically
   * so they don't overlap.
   */
  private _renderFleetBadges(): void {
    const engine = getGameEngine();
    if (!engine) return;

    const tickState = engine.getState();
    const state = tickState.gameState;
    const ships = state.ships;
    const fleets = state.fleets;
    const designsMap = tickState.shipDesigns ?? new Map();
    const playerEmpire = state.empires.find(e => !e.isAI);
    const playerEmpireId = playerEmpire?.id ?? null;
    // Species lookup for race-specific ship thumbnails
    const empireSpeciesMap = new Map<string, string>();
    for (const emp of state.empires) {
      if (emp.species?.id) empireSpeciesMap.set(emp.id, emp.species.id);
    }

    // Determine which systems the player can currently observe (has fleet or colony)
    const observedSystemIds = new Set<string>();
    if (playerEmpireId) {
      for (const fleet of fleets) {
        if (fleet.empireId === playerEmpireId) {
          observedSystemIds.add(fleet.position.systemId);
        }
      }
      for (const sys of this.galaxy.systems) {
        if (sys.ownerId === playerEmpireId) {
          observedSystemIds.add(sys.id);
        }
      }
    }

    // Collect visible fleets, respecting fog of war
    const visibleFleetIds = new Set<string>();
    // Also group fleet IDs by system for offset calculation
    const fleetsBySystem = new Map<string, string[]>();

    for (const fleet of fleets) {
      if (fleet.ships.length === 0) continue;
      const sysId = fleet.position.systemId;
      if (!this.knownSystemIds.has(sysId)) continue;

      const isPlayer = fleet.empireId === playerEmpireId;
      if (!isPlayer && !observedSystemIds.has(sysId)) continue;

      visibleFleetIds.add(fleet.id);
      const existing = fleetsBySystem.get(sysId) ?? [];
      existing.push(fleet.id);
      fleetsBySystem.set(sysId, existing);
    }

    // Remove badges for fleets that are no longer visible
    for (const [fleetId, container] of this.fleetBadges) {
      if (!visibleFleetIds.has(fleetId)) {
        container.destroy();
        this.fleetBadges.delete(fleetId);
      }
    }

    // Add or update badges per fleet
    for (const fleet of fleets) {
      if (!visibleFleetIds.has(fleet.id)) continue;

      const sysId = fleet.position.systemId;
      const sys = this.galaxy.systems.find(s => s.id === sysId);
      if (!sys) continue;

      // Determine the largest hull class in this fleet for the representative icon
      const fleetShips = ships.filter(s => fleet.ships.includes(s.id));
      let bestHullClass: HullClass = 'patrol';
      let bestRank = -1;
      for (const ship of fleetShips) {
        const design = designsMap.get(ship.designId);
        const hull: HullClass = (design?.hull as HullClass | undefined) ?? 'patrol';
        const rank = HULL_CLASS_RANK[hull] ?? 0;
        if (rank > bestRank) {
          bestRank = rank;
          bestHullClass = hull;
        }
      }

      // Offset for multiple fleets in the same system
      const fleetsInSystem = fleetsBySystem.get(sysId) ?? [];
      const fleetIndex = fleetsInSystem.indexOf(fleet.id);
      const verticalOffset = fleetIndex * 22;

      const visuals = STAR_VISUALS[sys.starType];
      const baseOffsetX = visuals.glowRadius + 10;
      const baseOffsetY = -(visuals.glowRadius + 4) + verticalOffset;

      const badgeX = sys.position.x + baseOffsetX;
      const badgeY = sys.position.y + baseOffsetY;

      const isPlayerFleet = fleet.empireId === playerEmpireId;
      const accentColor = isPlayerFleet ? '#00d4ff' : '#ff6644';
      const accentHex = isPlayerFleet ? 0x00d4ff : 0xff6644;

      let badge = this.fleetBadges.get(fleet.id);
      if (badge) {
        // Update position (fleet may have just arrived at a new system)
        badge.setPosition(badgeX, badgeY);

        // Update the ship count text (child index 2)
        const countText = badge.getAt(2) as Phaser.GameObjects.Text;
        countText.setText(`${fleetShips.length}`);
        continue;
      }

      // Create a new badge container
      badge = this.add.container(badgeX, badgeY);

      // Ship thumbnail image (rendered from ShipGraphics)
      const thumbSize = 20;
      const thumbSrc = renderShipThumbnail(bestHullClass, thumbSize, empireSpeciesMap.get(fleet.empireId));
      if (thumbSrc) {
        // Use a Phaser texture created from the data URL
        const texKey = `fleet_thumb_${fleet.id}_${bestHullClass}`;
        if (!this.textures.exists(texKey)) {
          const img = new Image();
          img.src = thumbSrc;
          img.onload = () => {
            if (!this.textures.exists(texKey)) {
              this.textures.addImage(texKey, img);
            }
            // Add the sprite once the texture is loaded
            const sprite = this.add.image(0, 0, texKey)
              .setDisplaySize(thumbSize, thumbSize)
              .setOrigin(0.5, 0.5);
            badge!.addAt(sprite, 0);
          };
        } else {
          const sprite = this.add.image(0, 0, texKey)
            .setDisplaySize(thumbSize, thumbSize)
            .setOrigin(0.5, 0.5);
          badge.addAt(sprite, 0);
        }
      } else {
        // Fallback: small triangle indicator
        const fallbackIcon = this.add.graphics();
        fallbackIcon.fillStyle(accentHex, 0.8);
        fallbackIcon.fillTriangle(-6, -5, -6, 5, 4, 0);
        badge.addAt(fallbackIcon, 0);
      }

      // Fleet name label (below the icon)
      const nameLabel = this.add.text(0, thumbSize / 2 + 3, fleet.name, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: accentColor,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 0);
      badge.add(nameLabel);

      // Ship count label (below the name)
      const countLabel = this.add.text(0, thumbSize / 2 + 14, `${fleetShips.length}`, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#aaccee',
        stroke: '#000000',
        strokeThickness: 1,
      }).setOrigin(0.5, 0);
      badge.add(countLabel);

      // Counter-scale so badge stays constant screen size regardless of zoom
      badge.setScale(1 / this.currentZoom);
      this.starLayer.add(badge);
      this.fleetBadges.set(fleet.id, badge);
    }
  }

  /**
   * Draw dashed lines from each player fleet's current position through its
   * waypoint queue.  Patrol routes use a distinct colour.  Only drawn for
   * the local player's fleets.
   */
  private _drawWaypointRoutes(): void {
    this.waypointLayer.clear();

    const engine = getGameEngine();
    if (!engine) return;

    const state = engine.getState();
    const fleets = state.gameState.fleets;
    const playerEmpire = state.gameState.empires.find(e => !e.isAI);
    const playerEmpireId = playerEmpire?.id ?? null;

    for (const fleet of fleets) {
      if (fleet.empireId !== playerEmpireId) continue;
      if (fleet.waypoints.length === 0) continue;

      const isPatrol = fleet.patrolling === true;
      const color = isPatrol ? PATROL_COLOR : WAYPOINT_COLOR;
      const alpha = isPatrol ? PATROL_ALPHA : WAYPOINT_ALPHA;
      const lineWidth = WAYPOINT_WIDTH / this.currentZoom;

      // Build the chain of system positions: fleet position -> each waypoint
      const chainIds = [fleet.position.systemId, ...fleet.waypoints];
      // If the fleet has a destination that's not in waypoints, prepend it
      // after current position (the fleet is currently heading there)
      if (fleet.destination && !fleet.waypoints.includes(fleet.destination)) {
        chainIds.splice(1, 0, fleet.destination);
      }

      for (let i = 0; i < chainIds.length - 1; i++) {
        const fromSys = this.galaxy.systems.find(s => s.id === chainIds[i]);
        const toSys = this.galaxy.systems.find(s => s.id === chainIds[i + 1]);
        if (!fromSys || !toSys) continue;

        const ax = fromSys.position.x;
        const ay = fromSys.position.y;
        const bx = toSys.position.x;
        const by = toSys.position.y;

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;

        const nx = dx / len;
        const ny = dy / len;

        // Draw dashed line
        let d = 0;
        while (d < len) {
          const dashEnd = Math.min(d + WAYPOINT_DASH_LEN, len);
          this.waypointLayer.lineStyle(lineWidth, color, alpha);
          this.waypointLayer.beginPath();
          this.waypointLayer.moveTo(ax + nx * d, ay + ny * d);
          this.waypointLayer.lineTo(ax + nx * dashEnd, ay + ny * dashEnd);
          this.waypointLayer.strokePath();
          d += WAYPOINT_DASH_LEN + WAYPOINT_GAP_LEN;
        }

        // Draw a small diamond at each waypoint (not the starting position)
        if (i > 0 || fleet.destination) {
          const wpX = toSys.position.x;
          const wpY = toSys.position.y;
          const sz = 3 / this.currentZoom;
          this.waypointLayer.fillStyle(color, alpha + 0.2);
          this.waypointLayer.fillTriangle(
            wpX, wpY - sz,
            wpX + sz, wpY,
            wpX, wpY + sz,
          );
          this.waypointLayer.fillTriangle(
            wpX, wpY - sz,
            wpX - sz, wpY,
            wpX, wpY + sz,
          );
        }
      }

      // If patrolling, draw a return line from last waypoint back to first
      if (isPatrol && fleet.waypoints.length > 1) {
        const lastId = fleet.waypoints[fleet.waypoints.length - 1]!;
        const firstId = fleet.waypoints[0]!;
        const lastSys = this.galaxy.systems.find(s => s.id === lastId);
        const firstSys = this.galaxy.systems.find(s => s.id === firstId);
        if (lastSys && firstSys) {
          const ax = lastSys.position.x;
          const ay = lastSys.position.y;
          const bx = firstSys.position.x;
          const by = firstSys.position.y;
          const dx = bx - ax;
          const dy = by - ay;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 1) {
            const nx = dx / len;
            const ny = dy / len;
            let d2 = 0;
            while (d2 < len) {
              const dashEnd = Math.min(d2 + WAYPOINT_DASH_LEN, len);
              this.waypointLayer.lineStyle(lineWidth, PATROL_COLOR, PATROL_ALPHA * 0.6);
              this.waypointLayer.beginPath();
              this.waypointLayer.moveTo(ax + nx * d2, ay + ny * d2);
              this.waypointLayer.lineTo(ax + nx * dashEnd, ay + ny * dashEnd);
              this.waypointLayer.strokePath();
              d2 += WAYPOINT_DASH_LEN + WAYPOINT_GAP_LEN;
            }
          }
        }
      }
    }
  }

  /**
   * Rebuild the set of animated drip particles to match the current set of
   * active movement orders.  Called on each engine tick so the drips stay in
   * sync when orders are added or cleared.
   *
   * Fog of war: only show drip particles for the player's own fleets, or
   * enemy fleets travelling through observed systems.
   *
   * Visual style varies by travel mode:
   * - slow_ftl:          white/dim dots — slow FTL lane
   * - wormhole:          cyan dots
   * - advanced_wormhole: bright blue dots
   *
   * Each movement order spawns DRIP_COUNT_PER_FLEET evenly-staggered dots
   * flowing continuously from origin to destination, capped by
   * MAX_DRIP_PARTICLES across all orders.
   */
  private _syncTransitDots(): void {
    const engine = getGameEngine();
    if (!engine) return;

    const state = engine.getState();
    const orders = state.movementOrders;
    const fleets = state.gameState.fleets;
    const playerEmpire = state.gameState.empires.find(e => !e.isAI);
    const playerEmpireId = playerEmpire?.id ?? null;

    // Systems the player can observe (has fleet or colony)
    const observedSystemIds = new Set<string>();
    if (playerEmpireId) {
      for (const fleet of fleets) {
        if (fleet.empireId === playerEmpireId) {
          observedSystemIds.add(fleet.position.systemId);
        }
      }
      for (const sys of this.galaxy.systems) {
        if (sys.ownerId === playerEmpireId) {
          observedSystemIds.add(sys.id);
        }
      }
    }

    const activeFleetIds = new Set(orders.map(o => o.fleetId));

    // Remove drip particles for orders that are no longer active
    this.dripParticles = this.dripParticles.filter(p => {
      if (!activeFleetIds.has(p.fleetId)) {
        p.obj.destroy();
        p.trail.destroy();
        return false;
      }
      return true;
    });

    // Also remove stale entries from the legacy transitDots map
    for (const [fleetId, entry] of this.transitDots) {
      if (!activeFleetIds.has(fleetId)) {
        entry.gfx.destroy();
        this.transitDots.delete(fleetId);
      }
    }

    // Determine how many new drip sets we can still add (global cap)
    const existingFleetIds = new Set(this.dripParticles.map(p => p.fleetId));

    for (const order of orders) {
      const fromId = order.path[order.currentSegment - 1];
      const toId   = order.path[order.currentSegment];
      if (!fromId || !toId) continue;

      // Fog of war: check visibility
      const fleet = fleets.find(f => f.id === order.fleetId);
      const isPlayerFleet = fleet?.empireId === playerEmpireId;
      if (!isPlayerFleet) {
        const fromObserved = observedSystemIds.has(fromId);
        const toObserved   = observedSystemIds.has(toId);
        if (!fromObserved && !toObserved) {
          // Not visible — remove existing drips for this fleet
          this.dripParticles = this.dripParticles.filter(p => {
            if (p.fleetId === order.fleetId) {
              p.obj.destroy();
              p.trail.destroy();
              return false;
            }
            return true;
          });
          continue;
        }
      }

      const fromSys = this.galaxy.systems.find(s => s.id === fromId);
      const toSys   = this.galaxy.systems.find(s => s.id === toId);
      if (!fromSys || !toSys) continue;

      // Determine drip colour and size by travel mode
      const travelMode = order.travelMode ?? 'wormhole';
      let dotColor: number;
      let dotRadius: number;
      switch (travelMode) {
        case 'slow_ftl':
          dotColor  = 0xcccccc; // white/dim
          dotRadius = 2;
          break;
        case 'advanced_wormhole':
          dotColor  = 0x4488ff; // bright blue
          dotRadius = 3;
          break;
        case 'wormhole':
        default:
          dotColor  = 0x00d4ff; // cyan
          dotRadius = 2.5;
          break;
      }

      if (existingFleetIds.has(order.fleetId)) {
        // Update existing drips' endpoints in case the hop segment changed
        for (const p of this.dripParticles) {
          if (p.fleetId !== order.fleetId) continue;
          p.fromX = fromSys.position.x;
          p.fromY = fromSys.position.y;
          p.toX   = toSys.position.x;
          p.toY   = toSys.position.y;
          p.obj.setFillStyle(dotColor, 0.85);
          p.obj.setRadius(dotRadius);
          p.trail.setFillStyle(dotColor, 0.3);
          p.trail.setRadius(dotRadius * 0.75);
        }
      } else {
        // Check global cap
        if (this.dripParticles.length >= MAX_DRIP_PARTICLES) continue;
        const slots = Math.min(
          DRIP_COUNT_PER_FLEET,
          MAX_DRIP_PARTICLES - this.dripParticles.length,
        );
        if (slots <= 0) continue;

        const speed = 1 / DRIP_PATH_DURATION_MS; // t-units per ms

        for (let i = 0; i < slots; i++) {
          // Stagger initial positions evenly along the path
          const t0 = i / DRIP_COUNT_PER_FLEET;
          const px = fromSys.position.x + t0 * (toSys.position.x - fromSys.position.x);
          const py = fromSys.position.y + t0 * (toSys.position.y - fromSys.position.y);

          // Trail dot drawn slightly behind the main dot
          const trail = this.add.circle(px, py, dotRadius * 0.75, dotColor, 0.3);
          this.starLayer.add(trail);

          // Main dot
          const dot = this.add.circle(px, py, dotRadius, dotColor, 0.85);
          this.starLayer.add(dot);

          this.dripParticles.push({
            t: t0,
            speed,
            fromX: fromSys.position.x,
            fromY: fromSys.position.y,
            toX: toSys.position.x,
            toY: toSys.position.y,
            obj: dot,
            trail,
            fleetId: order.fleetId,
          });
        }

        existingFleetIds.add(order.fleetId);
      }
    }
  }

  /**
   * Advance and reposition drip particles along their movement paths each
   * frame.  The `t` value loops from 0 to 1 continuously so the dots always
   * flow in the direction of travel.  The trailing dot is rendered a fixed
   * fraction behind the main dot for a short "comet tail" feel.
   */
  private updateTransitDots(time: number, delta: number): void {
    // Suppress unused-variable warning for `time`; reserved for future use
    void time;

    for (const p of this.dripParticles) {
      p.t += p.speed * delta;
      if (p.t >= 1) p.t -= 1; // loop back to origin

      const x = p.fromX + p.t * (p.toX - p.fromX);
      const y = p.fromY + p.t * (p.toY - p.fromY);
      p.obj.setPosition(x, y);

      // Trail positioned slightly behind (lower t)
      const tTrail = p.t - 0.04;
      const trailWrapped = tTrail < 0 ? tTrail + 1 : tTrail;
      const tx = p.fromX + trailWrapped * (p.toX - p.fromX);
      const ty = p.fromY + trailWrapped * (p.toY - p.fromY);
      p.trail.setPosition(tx, ty);
    }
  }

  /**
   * Play a brief arrival flash at a system when a fleet completes a hop or
   * arrives at its final destination.
   */
  private _playArrivalFlash(systemId: string): void {
    const sys = this.galaxy.systems.find(s => s.id === systemId);
    if (!sys) return;

    const flash = this.add.circle(sys.position.x, sys.position.y, 10, 0x00d4ff, 0.7);
    this.starLayer.add(flash);

    this.tweens.add({
      targets: flash,
      scaleX: 3.5,
      scaleY: 3.5,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private _handleEngineTick = (): void => {
    // Refresh known systems from the engine (fog of war reveal on fleet arrival)
    const engine = getGameEngine();
    let newSystemsDiscovered = false;
    if (engine) {
      const playerEmpire = engine.getState().gameState.empires.find(e => !e.isAI);
      if (playerEmpire) {
        const prevSize = this.knownSystemIds.size;
        for (const sysId of playerEmpire.knownSystems) {
          this.knownSystemIds.add(sysId);
        }
        newSystemsDiscovered = this.knownSystemIds.size > prevSize;
      }
    }

    // When new systems are discovered, refresh their visuals
    if (newSystemsDiscovered) {
      // Redraw wormhole connections (includes newly connected systems)
      this.drawWormholes(this.selectedSystemId);
      // Recreate all stars so newly discovered systems upgrade from dim dots to full visuals
      this.starLayer.removeAll(true);
      this.starHitAreas.clear();
      this.pulseTweens.clear();
      this.createStars();
    }

    this._renderFleetBadges();
    this._drawWaypointRoutes();
    this._syncTransitDots();
  };

  private _handleNavigateToSystem = (data: unknown): void => {
    const { systemId } = data as { systemId: string };
    const sys = this.galaxy.systems.find(s => s.id === systemId);
    if (!sys) return;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.cameraOffset.x = cx - sys.position.x * this.currentZoom;
    this.cameraOffset.y = cy - sys.position.y * this.currentZoom;
    this.applyWorldTransform();
    this.selectSystem(systemId);
  };

  private _handleFleetMoved = (event: unknown): void => {
    // FleetMovedEvent has { fleetId, fromSystemId, toSystemId, tick }
    const evt = event as { toSystemId?: string };
    if (evt?.toSystemId) {
      this._playArrivalFlash(evt.toSystemId);
    }
  };

  /**
   * Handler for 'engine:combat_resolved'.
   *
   * Plays a red multi-ring flash at the battle location and briefly shows a
   * "Battle!" text label.  The engine has already paused itself so the React
   * layer can display the BattleResultsScreen overlay.
   */
  private _handleCombatResolved = (event: unknown): void => {
    const evt = event as { systemId?: string };
    if (evt?.systemId) {
      this._playCombatFlash(evt.systemId);
    }
  };

  /** Transition to the CombatScene for tactical combat. */
  private _handleStartTactical = (data: unknown): void => {
    this.scene.start('CombatScene', data as object);
  };

  /**
   * Red expanding ring + "Battle!" text at the given system.
   * Distinct from the blue arrival flash so it's immediately recognisable.
   */
  private _playCombatFlash(systemId: string): void {
    const sys = this.galaxy.systems.find(s => s.id === systemId);
    if (!sys) return;

    const { x, y } = sys.position;

    // ── Expanding red rings ────────────────────────────────────────────────────
    const ringColors = [0xff4422, 0xff8800, 0xff4422];
    for (let i = 0; i < ringColors.length; i++) {
      const ring = this.add.circle(x, y, 8, ringColors[i]!, 0.65);
      this.starLayer.add(ring);
      this.tweens.add({
        targets: ring,
        scaleX: 5 + i * 2,
        scaleY: 5 + i * 2,
        alpha: 0,
        duration: 600 + i * 120,
        delay: i * 80,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }

    // ── "Battle!" text label ───────────────────────────────────────────────────
    const screenPos = this.galaxyToScreen(x, y);
    const battleLabel = this.add.text(
      screenPos.x,
      screenPos.y - 28,
      'Battle!',
      {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ff6622',
        stroke: '#000000',
        strokeThickness: 3,
      },
    )
      .setOrigin(0.5, 1)
      .setDepth(200);
    this.uiLayer.add(battleLabel);

    this.tweens.add({
      targets: battleLabel,
      y: screenPos.y - 52,
      alpha: 0,
      duration: 1400,
      ease: 'Quad.easeOut',
      onComplete: () => battleLabel.destroy(),
    });
  }
}
