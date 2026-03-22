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
const WORMHOLE_COLOR = 0x223344;
const WORMHOLE_ALPHA = 0.45;
const WORMHOLE_HIGHLIGHT_COLOR = 0x3377bb;
const WORMHOLE_HIGHLIGHT_ALPHA = 0.85;
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
    this.starHitAreas.clear();
    this.pulseTweens.clear();
    this.fleetBadges.clear();
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
      // Destroy fleet badges
      for (const [, container] of this.fleetBadges) {
        container.destroy();
      }
      this.fleetBadges.clear();
    });
  }

  update(_time: number, delta: number): void {
    this.updateZoomLerp();
    this.updateParallax();
    this.updateWormholeParticles(delta);
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

  private drawWormholes(highlightSystemId: string | null): void {
    this.wormholeLayer.clear();

    // Clear existing wormhole particles
    for (const p of this.wormholeParticles) {
      p.obj.destroy();
    }
    this.wormholeParticles = [];

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

        this.drawWormholeLine(sys, target, isHighlighted);
        this.spawnWormholeParticles(sys, target, isHighlighted);
      }
    }
  }

  /**
   * Draw a wormhole line as a dashed path — dim in the middle, slightly
   * brighter near endpoints to give a gradient feel.
   */
  private drawWormholeLine(sysA: StarSystem, sysB: StarSystem, highlighted: boolean): void {
    const ax = sysA.position.x;
    const ay = sysA.position.y;
    const bx = sysB.position.x;
    const by = sysB.position.y;

    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const dashLen = 6;
    const gapLen = 5;
    const totalUnit = dashLen + gapLen;

    const color = highlighted ? WORMHOLE_HIGHLIGHT_COLOR : WORMHOLE_COLOR;
    const baseAlpha = highlighted ? WORMHOLE_HIGHLIGHT_ALPHA : WORMHOLE_ALPHA;
    const lineWidth = highlighted ? 1.8 / this.currentZoom : 1.2 / this.currentZoom;

    // Draw dashes along the line
    let d = 0;
    while (d < len) {
      const dashEnd = Math.min(d + dashLen, len);

      // t in [0,1] at the midpoint of this dash — used for alpha gradient
      const tMid = (d + (dashEnd - d) * 0.5) / len;
      // Peak alpha at endpoints (t=0 or t=1), lower in middle
      const distFromCenter = Math.abs(tMid - 0.5) * 2; // 0 at center, 1 at endpoints
      const dashAlpha = baseAlpha * (0.45 + 0.55 * distFromCenter);

      this.wormholeLayer.lineStyle(lineWidth, color, dashAlpha);
      this.wormholeLayer.beginPath();
      this.wormholeLayer.moveTo(
        ax + (d / len) * dx,
        ay + (d / len) * dy,
      );
      this.wormholeLayer.lineTo(
        ax + (dashEnd / len) * dx,
        ay + (dashEnd / len) * dy,
      );
      this.wormholeLayer.strokePath();

      d += totalUnit;
    }
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
    const label = sys.name;
    const typeLabel = sys.starType.replace('_', ' ');
    const fullText = `${label}\n${typeLabel}`;

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
   * Render small fleet count badges at star systems that have ships.
   * Called on create and on each engine tick.
   */
  private _renderFleetBadges(): void {
    const engine = getGameEngine();
    if (!engine) return;

    const ships = engine.getState().gameState.ships;

    // Group ship count by systemId
    const shipsBySystem = new Map<string, number>();
    for (const ship of ships) {
      const count = shipsBySystem.get(ship.position.systemId) ?? 0;
      shipsBySystem.set(ship.position.systemId, count + 1);
    }

    // Remove badges for systems that no longer have ships
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

  private _handleEngineTick = (): void => {
    this._renderFleetBadges();
  };
}
