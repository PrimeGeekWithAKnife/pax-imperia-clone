import Phaser from 'phaser';
import { initializeGame, PREBUILT_SPECIES } from '@nova-imperia/shared';
import type { Galaxy, StarSystem, StarType, Species, GalaxyShape, AIPersonality } from '@nova-imperia/shared';
import { createGameEngine, getGameEngine, initializeTickState } from '../../engine/GameEngine';
import type { GameSpeedName } from '@nova-imperia/shared';
import { getAudioEngine, MusicGenerator, AmbientSounds, SfxGenerator } from '../../audio';
import type { MusicTrack } from '../../audio';

/** Galaxy size key → system count */
const GALAXY_SIZE_MAP: Record<string, 'small' | 'medium' | 'large' | 'huge'> = {
  small: 'small', medium: 'medium', large: 'large', huge: 'huge',
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
const SELECTION_RING_COLOR = 0xffffff;
const SELECTION_RING_ALPHA = 0.9;
const FOG_COLOR = 0x334455;
const TOOLTIP_BG_COLOR = 0x111824;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.0;
const ZOOM_FACTOR = 0.1;
const ZOOM_LERP = 0.12;

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

  create(data?: { knownSystemIds?: string[]; setupData?: { species: Species; config: { galaxySize: string; galaxyShape: string; aiOpponents: number; seed: string; aiDifficulty: string } } }): void {
    // Reset state from any previous run
    this.parallaxStars = [];
    this.nebulaWisps = [];
    this.wormholeParticles = [];
    this.dripParticles = [];
    this.starHitAreas.clear();
    this.pulseTweens.clear();
    this.fleetBadges.clear();
    this.transitDots.clear();
    this.selectedSystemId = null;
    this.homeSystemId = null;
    this.lastPointerDownTime = 0;
    this.lastPointerDownSystemId = null;
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;
    this.isDragging = false;

    // ── Initialise or reuse game state ────────────────────────────────────────
    const existingEngine = getGameEngine();
    if (existingEngine) {
      // Returning from SystemViewScene — reuse existing game state
      this.galaxy = existingEngine.getState().gameState.galaxy;
      const playerEmpire = existingEngine.getState().gameState.empires.find(e => !e.isAI);
      if (playerEmpire) {
        const homeSystem = this.galaxy.systems.find(s => s.ownerId === playerEmpire.id);
        this.homeSystemId = homeSystem?.id ?? null;
        this.knownSystemIds = new Set(playerEmpire.knownSystems);
      } else {
        for (const sys of this.galaxy.systems) this.knownSystemIds.add(sys.id);
      }
    } else {
      // ── Build game from setup data or defaults ─────────────────────────────
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

      const gameState = initializeGame({
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
      });

      this.galaxy = gameState.galaxy;
      const playerEmpire = gameState.empires.find(e => !e.isAI);
      if (playerEmpire) {
        const homeSystem = gameState.galaxy.systems.find(s => s.ownerId === playerEmpire.id);
        this.homeSystemId = homeSystem?.id ?? null;
        this.knownSystemIds = new Set(playerEmpire.knownSystems);
      } else {
        for (const sys of this.galaxy.systems) this.knownSystemIds.add(sys.id);
      }

      const tickState = initializeTickState(gameState);
      const engine = createGameEngine(this.game, tickState);
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
    this.dustLayer = this.add.graphics();
    this.wormholeLayer = this.add.graphics();
    this.starLayer = this.add.container(0, 0);
    this.worldContainer.add([this.dustLayer, this.wormholeLayer, this.starLayer]);

    // UI (screen-space, on top of everything)
    this.uiLayer = this.add.container(0, 0);

    // Build content — order matters for layering
    this.createDeepBackground();   // Layer 0: dim distant stars + deep nebulae
    this.createMidStars();         // Layer 1: mid-distance stars with twinkle
    this.createNebulaWisps();      // Layer 2: nebula cloud wisps
    this.createSpaceDust();        // World-space: fine dust near star systems
    this.drawWormholes(null);      // World-space: connection lines
    this.createStars();            // World-space: actual star systems
    this.createSelectionRing();
    this.createHomeRing();
    this.createTooltip();
    this.createBackButton();
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

    // Clean up listeners when the scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('engine:tick', this._handleEngineTick);
      this.game.events.off('engine:fleet_moved', this._handleFleetMoved);
      this.game.events.off('engine:combat_resolved', this._handleCombatResolved);
      this.game.events.off('engine:fleet_order_issued');
      this.game.events.off('engine:tech_researched');
      this.game.events.off('engine:ship_produced');
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
  }

  private centerOnHomeSystem(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    if (this.homeSystemId) {
      const homeSys = this.galaxy.systems.find(s => s.id === this.homeSystemId);
      if (homeSys) {
        this.cameraOffset.x = cx - homeSys.position.x * this.currentZoom;
        this.cameraOffset.y = cy - homeSys.position.y * this.currentZoom;
        this.applyWorldTransform();
        return;
      }
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

  private setupEngineEvents(): void {
    this.game.events.on('ui:speed_change', (speed: unknown) => {
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
    });
    this.game.events.on('minimap:navigate', this.handleMinimapNavigate);

    // Music track change — player selects a new mood from the Settings panel
    this.game.events.on('music:set_track', (track: unknown) => {
      this.music?.setTrack(track as MusicTrack);
    });

    // Refresh fleet badges each engine tick so newly produced ships appear on the map
    this.game.events.on('engine:tick', this._handleEngineTick);

    // Play arrival flash when a fleet reaches its destination (or any intermediate hop)
    this.game.events.on('engine:fleet_moved', this._handleFleetMoved);

    // Play battle flash + "Battle!" label when two opposing fleets meet
    this.game.events.on('engine:combat_resolved', this._handleCombatResolved);

    // Game event SFX
    this.game.events.on('engine:tech_researched', () => {
      this.sfx?.playResearchComplete();
    });
    this.game.events.on('engine:ship_produced', () => {
      this.sfx?.playShipLaunch();
    });
    // Play fleet move SFX when a movement order is issued
    this.game.events.on('engine:fleet_order_issued', () => {
      this.sfx?.playFleetMove();
    });

    // Exit to main menu: stop the engine, destroy the game state, restart MainMenuScene
    this.game.events.on('ui:exit_to_menu', () => {
      const engine = getGameEngine();
      if (engine) engine.pause();
      // Clear the engine reference so a new game can be started
      (window as unknown as Record<string, unknown>).__GAME_ENGINE__ = undefined;
      this.ambient?.stopAll();
      this.scene.start('MainMenuScene');
    });
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

    // 400-600 tiny dim distant stars (1px, very low alpha)
    const starCount = Phaser.Math.Between(400, 600);
    for (let i = 0; i < starCount; i++) {
      const bx = Math.random() * W;
      const by = Math.random() * H;
      const alpha = Phaser.Math.FloatBetween(0.08, 0.28);
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
  }

  // ── Layer 1: Mid-distance stars ───────────────────────────────────────────────

  private createMidStars(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const starCount = Phaser.Math.Between(150, 200);
    for (let i = 0; i < starCount; i++) {
      const bx = Math.random() * W;
      const by = Math.random() * H;

      // Most are small (1-2px), a few are brighter (2-3px)
      const isBright = Math.random() < 0.12;
      const radius = isBright ? Phaser.Math.FloatBetween(1.2, 1.8) : Phaser.Math.FloatBetween(0.5, 1.1);
      const alpha = isBright
        ? Phaser.Math.FloatBetween(0.65, 0.9)
        : Phaser.Math.FloatBetween(0.25, 0.55);

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

    const wispCount = Phaser.Math.Between(5, 8);
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
  }

  // ── Parallax update ───────────────────────────────────────────────────────────

  private updateParallax(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Reference offset: what offset would be at the galaxy's "neutral" center
    const refX = this.scale.width / 2 - (this.galaxy.width / 2) * this.currentZoom;
    const refY = this.scale.height / 2 - (this.galaxy.height / 2) * this.currentZoom;

    // How far the camera has moved from neutral
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
  private _drawNormalLane(sysA: StarSystem, sysB: StarSystem): void {
    const ax = sysA.position.x;
    const ay = sysA.position.y;
    const bx = sysB.position.x;
    const by = sysB.position.y;

    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const lineWidth = LANE_WIDTH / this.currentZoom;
    let d = 0;
    while (d < len) {
      const dashEnd = Math.min(d + LANE_DASH_LEN, len);

      this.wormholeLayer.lineStyle(lineWidth, LANE_COLOR, LANE_ALPHA);
      this.wormholeLayer.beginPath();
      this.wormholeLayer.moveTo(ax + (d / len) * dx, ay + (d / len) * dy);
      this.wormholeLayer.lineTo(ax + (dashEnd / len) * dx, ay + (dashEnd / len) * dy);
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
    const ax = sysA.position.x;
    const ay = sysA.position.y;
    const bx = sysB.position.x;
    const by = sysB.position.y;

    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    if (!hasWormholeTech) {
      // Very faint blue dashes — wormhole is known but not traversable yet
      const lineWidth = 0.8 / this.currentZoom;
      let d = 0;
      while (d < len) {
        const dashEnd = Math.min(d + 3, len);
        this.wormholeLayer.lineStyle(lineWidth, WORM_NO_TECH_COLOR, WORM_NO_TECH_ALPHA);
        this.wormholeLayer.beginPath();
        this.wormholeLayer.moveTo(ax + (d / len) * dx, ay + (d / len) * dy);
        this.wormholeLayer.lineTo(ax + (dashEnd / len) * dx, ay + (dashEnd / len) * dy);
        this.wormholeLayer.strokePath();
        d += 13; // long gap — barely visible
      }
      return;
    }

    // Pulsing blue wormhole line
    const pulseAlpha = WORM_ALPHA_MIN +
      (WORM_ALPHA_MAX - WORM_ALPHA_MIN) *
      (0.5 + 0.5 * Math.sin(this._wormholePhase));
    const highlightBoost = highlighted ? 0.15 : 0;
    const alpha = Math.min(1, pulseAlpha + highlightBoost);

    const coreWidth  = WORM_WIDTH / this.currentZoom;
    const glowWidth  = (WORM_WIDTH + 3) / this.currentZoom;

    // Glow layer — wider stroke at low alpha
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
    const ax = sysA.position.x;
    const ay = sysA.position.y;
    const bx = sysB.position.x;
    const by = sysB.position.y;

    const coreWidth = ADV_WORM_WIDTH / this.currentZoom;
    const glowWidth = (ADV_WORM_WIDTH + 3) / this.currentZoom;

    // Shimmer: slight alpha variation driven by wormhole phase offset by pi/3
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

    // Redraw wormhole lines each frame so the pulse animation is live.
    // Only redraw when wormhole tech is active (otherwise lines are static).
    if (this._playerHasWormholeTech()) {
      this.drawWormholes(this.selectedSystemId);
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
    const hitRadius = Math.max(visuals.radius * 2.5, 14);
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
        this.selectSystem(sys.id);
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

  // ── Home ring ──────────────────────────────────────────────────────────────

  private createHomeRing(): void {
    this.homeRing = this.add.graphics();
    this.starLayer.add(this.homeRing);
    this.drawHomeRing();
  }

  private drawHomeRing(): void {
    this.homeRing.clear();
    if (!this.homeSystemId) return;

    const sys = this.galaxy.systems.find(s => s.id === this.homeSystemId);
    if (!sys) return;

    const visuals = STAR_VISUALS[sys.starType];
    const ringRadius = visuals.glowRadius + 6;

    this.homeRing.lineStyle(2 / this.currentZoom, 0x00d4ff, 0.65);
    this.homeRing.strokeCircle(sys.position.x, sys.position.y, ringRadius);

    this.homeRing.lineStyle(1 / this.currentZoom, 0x00d4ff, 0.3);
    this.homeRing.strokeCircle(sys.position.x, sys.position.y, ringRadius + 6);
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

  private selectSystem(id: string): void {
    this.selectedSystemId = id;
    this.drawSelectionRing(id);
    this.drawWormholes(id);
    this.playPingEffect(id);

    // Highlight neighbors
    this.highlightConnectedSystems(id);

    const sys = this.galaxy.systems.find(s => s.id === id);
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
      this.ambient?.stopAll();
      this.music?.crossfadeTo('menu');
      this.scene.start('MainMenuScene');
    });

    this.uiLayer.add(backButton);
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
    this.drawWormholes(this.selectedSystemId);
    if (this.selectedSystemId) {
      this.drawSelectionRing(this.selectedSystemId);
    }
  }

  private updateSelectionRingScale(): void {
    if (this.selectedSystemId) {
      this.drawSelectionRing(this.selectedSystemId);
    }
    this.drawHomeRing();
  }

  // ── Fleet indicators on galaxy map ──────────────────────────────────────────

  /** Container for fleet badge graphics, keyed by systemId. */
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
   * Render small fleet count badges at star systems that have ships.
   * Called on create and on each engine tick.
   *
   * Fog of war rules:
   * - Only show badges in systems the player has discovered (knownSystemIds).
   * - Only show the player's own ships, plus enemy ships in systems the player
   *   can currently observe (i.e. has a fleet or colony there).
   */
  private _renderFleetBadges(): void {
    const engine = getGameEngine();
    if (!engine) return;

    const state = engine.getState().gameState;
    const ships = state.ships;
    const fleets = state.fleets;
    const playerEmpire = state.empires.find(e => !e.isAI);
    const playerEmpireId = playerEmpire?.id ?? null;

    // Determine which systems the player can currently observe (has fleet or colony)
    const observedSystemIds = new Set<string>();
    if (playerEmpireId) {
      // Systems with player fleets
      for (const fleet of fleets) {
        if (fleet.empireId === playerEmpireId) {
          observedSystemIds.add(fleet.position.systemId);
        }
      }
      // Systems with player colonies (owned systems)
      for (const sys of this.galaxy.systems) {
        if (sys.ownerId === playerEmpireId) {
          observedSystemIds.add(sys.id);
        }
      }
    }

    // Group visible ship counts by systemId, respecting fog of war
    const shipsBySystem = new Map<string, number>();
    for (const ship of ships) {
      const sysId = ship.position.systemId;

      // Skip undiscovered systems entirely
      if (!this.knownSystemIds.has(sysId)) continue;

      // Find which empire owns this ship
      const fleet = fleets.find(f => f.ships.includes(ship.id));
      const shipEmpireId = fleet?.empireId ?? null;

      if (shipEmpireId === playerEmpireId) {
        // Always show player's own ships
        const count = shipsBySystem.get(sysId) ?? 0;
        shipsBySystem.set(sysId, count + 1);
      } else if (observedSystemIds.has(sysId)) {
        // Show enemy ships only in systems the player can observe
        const count = shipsBySystem.get(sysId) ?? 0;
        shipsBySystem.set(sysId, count + 1);
      }
      // Otherwise: enemy ship in a system the player cannot observe — hidden
    }

    // Remove badges for systems that no longer have visible ships
    for (const [sysId, container] of this.fleetBadges) {
      if (!shipsBySystem.has(sysId)) {
        container.destroy();
        this.fleetBadges.delete(sysId);
      }
    }

    // Add or update badges
    for (const [sysId, count] of shipsBySystem) {
      const sys = this.galaxy.systems.find(s => s.id === sysId);
      if (!sys) continue;

      let badge = this.fleetBadges.get(sysId);
      if (badge) {
        // Update count text
        const textObj = badge.getAt(1) as Phaser.GameObjects.Text;
        textObj.setText(String(count));
        continue;
      }

      // Create badge
      const visuals = STAR_VISUALS[sys.starType];
      const offsetX = visuals.glowRadius + 8;
      const offsetY = -(visuals.glowRadius + 4);

      badge = this.add.container(sys.position.x + offsetX, sys.position.y + offsetY);

      // Background circle
      const bg = this.add.circle(0, 0, 8, 0x003366, 0.85);
      badge.add(bg);

      // Ship count text
      const label = this.add.text(0, 0, String(count), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#00d4ff',
      }).setOrigin(0.5, 0.5);
      badge.add(label);

      // Small ship triangle indicator
      const shipIcon = this.add.graphics();
      shipIcon.fillStyle(0x00d4ff, 0.8);
      shipIcon.fillTriangle(-12, -3, -12, 3, -7, 0);
      badge.add(shipIcon);

      this.starLayer.add(badge);
      this.fleetBadges.set(sysId, badge);
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
    this._renderFleetBadges();
    this._syncTransitDots();
  };

  private _handleFleetMoved = (event: unknown): void => {
    const evt = event as { fleet?: { position?: { systemId?: string } } };
    const systemId = evt?.fleet?.position?.systemId;
    if (systemId) {
      this._playArrivalFlash(systemId);
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
