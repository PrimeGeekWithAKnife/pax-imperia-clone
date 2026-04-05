import Phaser from 'phaser';
import type { Fleet, Ship, ShipDesign, ShipComponent, HullClass } from '@nova-imperia/shared';
import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  setShipStance,
  setFormation,
  getFormationPositions,
  admiralRally,
  admiralEmergencyRepair,
  admiralPause,
  calculateExperienceGain,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '@nova-imperia/shared';
import { renderShipIcon } from '../../assets/graphics/ShipGraphics';
import { getAudioEngine, MusicGenerator, SfxGenerator } from '../../audio';
import type { MusicTrack } from '../../audio';
import type { TacticalState, TacticalShip, ShipOrder, TacticalOutcome, FormationType, Admiral, CombatLayout, PlanetData, CombatStance, CrewExperience, BattlefieldSize } from '@nova-imperia/shared';
import type { GroundCombatSceneData } from './GroundCombatScene';

// ---------------------------------------------------------------------------
// Scene data passed via scene.start('CombatScene', data)
// ---------------------------------------------------------------------------

export interface CombatSceneData {
  attackerFleet: Fleet;
  defenderFleet: Fleet;
  attackerShips: Ship[];
  defenderShips: Ship[];
  designs: Map<string, ShipDesign>;
  components: ShipComponent[];
  playerEmpireId: string;
  attackerColor: string;
  defenderColor: string;
  attackerName: string;
  defenderName: string;
  layout?: CombatLayout;
  planetData?: PlanetData;
  attackerSpeciesId?: string;
  defenderSpeciesId?: string;
  battlefieldSize?: BattlefieldSize;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BG_COLOR = 0x06081a;
const STAR_COUNT = 250;

/** Ship size scaling — derived from maxHull at creation time */
const SHIP_SIZE_TINY  = { base: 14, height: 20 };  // probes, scouts
const SHIP_SIZE_SMALL = { base: 18, height: 28 };  // frigates, destroyers
const SHIP_SIZE_MED   = { base: 24, height: 36 };  // cruisers
const SHIP_SIZE_LARGE = { base: 32, height: 48 };  // battleships, dreadnoughts

function shipSizeFromHull(maxHull: number): { base: number; height: number } {
  if (maxHull < 60)  return SHIP_SIZE_TINY;
  if (maxHull < 200) return SHIP_SIZE_SMALL;
  if (maxHull < 400) return SHIP_SIZE_MED;
  return SHIP_SIZE_LARGE;
}

/** Icon render size per hull category (pixels). */
function iconSizeFromHull(maxHull: number): number {
  if (maxHull < 60) return 28;
  if (maxHull < 200) return 40;
  if (maxHull < 400) return 56;
  return 72;
}

const SELECTION_RING_RADIUS = 24;
const SELECTION_RING_COLOR = 0xffffff;
const SELECTION_RING_ALPHA = 0.9;

/** Projectile visual constants */
const PROJECTILE_MIN_RADIUS = 2;
const PROJECTILE_MAX_RADIUS = 6;
const PROJECTILE_TRAIL_LENGTH = 3; // number of trail segments for high-damage projectiles

/** Missile visual constants */
const MISSILE_SIZE = 6;
const MISSILE_TRAIL_LENGTH = 12;
const MISSILE_EXHAUST_SEGMENTS = 3; // fading trail dots behind the missile

/** Fighter visual constants */
const FIGHTER_SIZE = 5;
const FIGHTER_JITTER = 4; // random visual offset for swarming effect

/** Point defence visual constants */
const PD_COLOR = 0xffffff;
const PD_ALPHA = 0.85;
const PD_STARBURST_RADIUS = 6;
const PD_TRACER_COUNT = 3; // tracer dots along the intercept line
const PD_TRACER_COLOR = 0xffdd44;

/** Escape pod visual constants */
const POD_SIZE = 2;
const POD_COLOR = 0xffffcc;
const POD_TRAIL_COLOR = 0xffaa44;
const POD_BLINK_RATE = 8; // blink every N frames

/** Beam style lookup by componentId */
type BeamStyle = 'pulse' | 'particle' | 'disruptor' | 'plasma' | 'radiation';
const BEAM_STYLE_MAP: Record<string, BeamStyle> = {
  pulse_laser: 'pulse',
  phased_array: 'pulse',
  particle_beam_cannon: 'particle',
  radiation_ray: 'radiation',
  disruptor_beam: 'disruptor',
  plasma_lance: 'plasma',
};
/** Beam base tint by side (friendly / enemy). */
const BEAM_TINT_FRIENDLY = { r: 0x44, g: 0xff, b: 0x88 };
const BEAM_TINT_ENEMY    = { r: 0xff, g: 0x44, b: 0x44 };

/** Projectile style lookup by componentId */
type ProjectileStyle = 'kinetic' | 'mass_driver' | 'gauss' | 'battering_ram' | 'antimatter' | 'singularity' | 'fusion';
const PROJECTILE_STYLE_MAP: Record<string, ProjectileStyle> = {
  kinetic_cannon: 'kinetic',
  mass_driver: 'mass_driver',
  gauss_cannon: 'gauss',
  battering_ram: 'battering_ram',
  antimatter_accelerator: 'antimatter',
  singularity_driver: 'singularity',
  fusion_autocannon: 'fusion',
};

/** Missile style lookup by componentId */
type MissileStyle = 'basic' | 'torpedo' | 'guided' | 'fusion' | 'antimatter' | 'singularity';
const MISSILE_STYLE_MAP: Record<string, MissileStyle> = {
  basic_missile: 'basic',
  basic_torpedo: 'torpedo',
  guided_torpedo: 'guided',
  fusion_torpedo: 'fusion',
  antimatter_torpedo: 'antimatter',
  singularity_torpedo: 'singularity',
  hv_missile: 'basic',
  torpedo_rack: 'torpedo',
  cluster_missile: 'guided',
  emp_torpedo: 'guided',
  swarm_missiles: 'basic',
  bunker_buster: 'fusion',
  void_seeker: 'antimatter',
  phase_torpedo: 'singularity',
  icbm_torpedo: 'fusion',
};

/** Per-missile-type visual properties */
const MISSILE_VISUALS: Record<MissileStyle, {
  size: number;
  trailLen: number;
  bodyColor: number;
  exhaustColor: number;
  glowColor: number;
  glowAlpha: number;
  exhaustSegments: number;
}> = {
  basic:       { size: 4, trailLen: 8,  bodyColor: 0xcccccc, exhaustColor: 0x999999, glowColor: 0xdddddd, glowAlpha: 0,    exhaustSegments: 2 },
  torpedo:     { size: 6, trailLen: 12, bodyColor: 0xcc5533, exhaustColor: 0x993322, glowColor: 0xdd6644, glowAlpha: 0,    exhaustSegments: 3 },
  guided:      { size: 6, trailLen: 14, bodyColor: 0xffcc33, exhaustColor: 0xddaa11, glowColor: 0xffee66, glowAlpha: 0.12, exhaustSegments: 4 },
  fusion:      { size: 8, trailLen: 18, bodyColor: 0xffaa33, exhaustColor: 0xff7711, glowColor: 0xffcc44, glowAlpha: 0.18, exhaustSegments: 4 },
  antimatter:  { size: 8, trailLen: 16, bodyColor: 0xffccee, exhaustColor: 0xff66aa, glowColor: 0xff88cc, glowAlpha: 0.22, exhaustSegments: 4 },
  singularity: { size: 10, trailLen: 22, bodyColor: 0xbb88ff, exhaustColor: 0x8844cc, glowColor: 0x9955ff, glowAlpha: 0.28, exhaustSegments: 5 },
};

/** Health bar dimensions (drawn above each ship) */
const HEALTH_BAR_WIDTH = 28;
const HEALTH_BAR_HEIGHT = 3;
const HEALTH_BAR_OFFSET_Y = -6; // above the ship triangle

/** Damage flash colour (red) overlaid briefly when a ship takes damage. */
const DAMAGE_FLASH_COLOR = 0xff2222;
const DAMAGE_FLASH_DURATION = 120; // ms

/** Explosion circle expand + fade duration. */
const EXPLOSION_DURATION = 500; // ms
const EXPLOSION_RADIUS = 36;
const EXPLOSION_COLOR = 0xff8800;

/** Environment visual constants */
const ASTEROID_COLOR = 0x888888;
const ASTEROID_ALPHA = 0.6;
const NEBULA_COLOR = 0x6644aa;
const NEBULA_ALPHA = 0.25;
const DEBRIS_COLOR = 0xcc6622;
const DEBRIS_DOT_RADIUS = 3;
const DEBRIS_DOT_COUNT = 10;
const DEBRIS_DOT_ALPHA = 0.65;

/** Speed multiplier presets (ms per tick) */
const SPEED_PRESETS: { label: string; msPerTick: number }[] = [
  { label: '1x', msPerTick: 100 },
  { label: '2x', msPerTick: 50 },
  { label: '4x', msPerTick: 25 },
];

const MARGIN = 80;

/** Planetary assault visual constants */
const PLANET_RADIUS = 400;
const PLANET_ATMOSPHERE_GLOW_LAYERS = 8;
const PLANET_ATMOSPHERE_GLOW_WIDTH = 40;

/** Planet surface colour by type (fallback to grey). */
const PLANET_SURFACE_COLOURS: Record<string, number> = {
  terran: 0x1a3a2a,
  ocean: 0x0a2a4a,
  desert: 0x4a3a1a,
  volcanic: 0x3a1a0a,
  arctic: 0x2a3a4a,
  barren: 0x2a2a2a,
  gas_giant: 0x2a2a3a,
  toxic: 0x2a3a1a,
};

/** Atmospheric glow colour by planet type. */
const PLANET_ATMOSPHERE_COLOURS: Record<string, number> = {
  terran: 0x4488cc,
  ocean: 0x3388ee,
  desert: 0xcc8844,
  volcanic: 0xcc4422,
  arctic: 0x88ccee,
  barren: 0x666666,
  gas_giant: 0xaa88cc,
  toxic: 0x88cc44,
};

/** Available formation types for the HUD buttons. */
const FORMATION_TYPES: { label: string; type: FormationType }[] = [
  { label: 'LINE', type: 'line' },
  { label: 'SPEAR', type: 'spearhead' },
  { label: 'DIAMOND', type: 'diamond' },
  { label: 'WINGS', type: 'wings' },
];

/** Available combat stances. */
const STANCE_TYPES: { label: string; type: string; description: string }[] = [
  { label: 'AGGRESSIVE', type: 'aggressive', description: 'Fire at will, hold position unless commanded' },
  { label: 'AT EASE', type: 'at_ease', description: 'Ship captains act independently' },
  { label: 'DEFENSIVE', type: 'defensive', description: 'Fire only when fired upon' },
  { label: 'EVASIVE', type: 'evasive', description: 'Maintain distance, fire if opportunity' },
  { label: 'FLEE', type: 'flee', description: 'Withdraw from battle immediately' },
];

/** Boundary zones for Total War-style double boundary. */
const BOUNDARY_WARNING_MARGIN = 120; // amber zone — ships get a warning
const BOUNDARY_FLEE_MARGIN = 40;     // red zone — ships past here are fleeing

// ---------------------------------------------------------------------------
// CombatScene
// ---------------------------------------------------------------------------

export class CombatScene extends Phaser.Scene {
  // ── State ──────────────────────────────────────────────────────────────────
  private tacticalState!: TacticalState;
  private sceneData!: CombatSceneData;
  private _bfWidth = this._bfWidth;
  private _bfHeight = this._bfHeight;
  private battleEnded = false;
  private paused = false;

  /** Currently selected friendly TacticalShip id (or null) */
  private selectedShipId: string | null = null;

  /** Attack-move mode: next click issues move + sets stance to at_ease */
  private attackMoveMode = false;
  private attackMoveLabel: Phaser.GameObjects.Text | null = null;

  // ── Speed control ──────────────────────────────────────────────────────────
  private speedIndex = 0;
  private tickTimer!: Phaser.Time.TimerEvent;

  // ── Visual containers ──────────────────────────────────────────────────────
  private shipContainers = new Map<string, Phaser.GameObjects.Container>();
  /** Previous hull values per ship id — used to detect damage for flash effects. */
  private prevHull = new Map<string, number>();
  /** Ships that were destroyed since last visual update (for explosion effects). */
  private prevDestroyed = new Set<string>();
  private selectionRing!: Phaser.GameObjects.Graphics;
  private selectionBoxGfx!: Phaser.GameObjects.Graphics;
  private dragSelecting = false;
  private dragStartWorld: { x: number; y: number } | null = null;
  private beamGraphics!: Phaser.GameObjects.Graphics;
  private projectileGraphics!: Phaser.GameObjects.Graphics;
  private missileGraphics!: Phaser.GameObjects.Graphics;
  private pdGraphics!: Phaser.GameObjects.Graphics;
  private environmentGraphics!: Phaser.GameObjects.Graphics;
  private debrisGraphics!: Phaser.GameObjects.Graphics;
  /** Track which debris IDs we have already drawn (static once spawned). */
  private drawnDebrisIds = new Set<string>();
  private fighterGraphics!: Phaser.GameObjects.Graphics;
  private escapePodGraphics!: Phaser.GameObjects.Graphics;
  private healthBarGraphics!: Phaser.GameObjects.Graphics;
  /** Cached ship size per ship id (computed once at creation). */
  private shipSizes = new Map<string, { base: number; height: number }>();

  // ── Audio ─────────────────────────────────────────────────────────────────
  private sfx: SfxGenerator | null = null;
  private music: MusicGenerator | null = null;
  /** Track that was active before combat — restored on shutdown. */
  private preCombatTrack: MusicTrack | null = null;
  /** Number of beam effects last tick — used to detect new beams for sound. */
  private prevBeamCount = 0;
  /** Set of beam source+target keys last tick — detect genuinely new beams. */
  private prevBeamKeys = new Set<string>();
  /** Number of projectiles last tick. */
  private prevProjectileCount = 0;
  /** Number of missiles last tick. */
  private prevMissileCount = 0;
  /** Set of missile IDs last tick — detect impacts (disappeared missiles). */
  private prevMissileIds = new Set<string>();
  /** Previous shield values per ship id — detect shield hits. */
  private prevShields = new Map<string, number>();

  // ── HUD elements ───────────────────────────────────────────────────────────
  private tickLabel!: Phaser.GameObjects.Text;
  private selectedInfoLabel!: Phaser.GameObjects.Text;
  private speedButtons: Phaser.GameObjects.Text[] = [];
  private pauseButton!: Phaser.GameObjects.Text;
  private formationButtons: Phaser.GameObjects.Text[] = [];
  private stanceButtons: Phaser.GameObjects.Text[] = [];
  private rallyButton!: Phaser.GameObjects.Text;
  private repairButton!: Phaser.GameObjects.Text;
  private pauseCountLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CombatScene' });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  create(data: CombatSceneData): void {
    this.sceneData = data;
    this.battleEnded = false;
    this.paused = false;
    this.selectedShipId = null;
    this.attackMoveMode = false;
    this.attackMoveLabel = null;
    this.speedIndex = 0;
    this.shipContainers.clear();
    this.prevHull.clear();
    this.prevDestroyed.clear();

    // ── Initialise tactical state ──────────────────────────────────────────
    this.tacticalState = initializeTacticalCombat(
      data.attackerFleet,
      data.defenderFleet,
      data.attackerShips,
      data.defenderShips,
      data.designs,
      data.components,
      data.layout ?? 'open_space',
      data.planetData,
      data.battlefieldSize ?? 'small',
    );

    // Store battlefield dimensions for rendering (may differ from default constants)
    this._bfWidth = this.tacticalState.battlefieldWidth;
    this._bfHeight = this.tacticalState.battlefieldHeight;

    // Track initial hull and shield values for damage/hit detection
    for (const ship of this.tacticalState.ships) {
      this.prevHull.set(ship.id, ship.hull);
      this.prevShields.set(ship.id, ship.shields);
    }

    // ── Audio ──────────────────────────────────────────────────────────────
    const audioEngine = getAudioEngine();
    if (audioEngine) {
      this.sfx = new SfxGenerator(audioEngine);

      // Start battle music — save the previous track so we can restore it
      if (!this.music) {
        this.music = new MusicGenerator(audioEngine);
      }
      const sessionTrack = (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ as MusicTrack | undefined;
      this.preCombatTrack = sessionTrack ?? 'deep_space';

      // Randomly pick between the two battle tracks
      const battleTrack: MusicTrack = Math.random() < 0.5 ? 'battle_intense' : 'battle_epic';
      this.music.setTrack(battleTrack);
      this.music.startMusic('system'); // scene mode is secondary — track drives the layers
    }
    this.prevBeamCount = 0;
    this.prevBeamKeys.clear();
    this.prevProjectileCount = 0;
    this.prevMissileCount = 0;
    this.prevMissileIds.clear();

    // Restore previous music track on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.music) {
        this.music.stopMusic();
        // Restore the pre-combat track for the next scene to pick up
        if (this.preCombatTrack) {
          (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ = this.preCombatTrack;
        }
        this.music = null;
      }
    });

    // ── Background ─────────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this._drawStarfield();
    this._drawPlanetEdge();

    // ── Camera ─────────────────────────────────────────────────────────────
    this._setupCamera();

    // ── Ship visuals ───────────────────────────────────────────────────────
    this._createShipContainers();

    // ── Health bars (drawn above ships each frame) ─────────────────────────
    this.healthBarGraphics = this.add.graphics();
    this.healthBarGraphics.setDepth(9);

    // ── Selection ring (drawn above ships) ─────────────────────────────────
    this.selectionRing = this.add.graphics();
    this.selectionRing.setDepth(10);
    this.selectionBoxGfx = this.add.graphics();
    this.selectionBoxGfx.setDepth(11);

    // ── Beam / projectile graphics layers ──────────────────────────────────
    this.beamGraphics = this.add.graphics();
    this.beamGraphics.setDepth(5);
    this.projectileGraphics = this.add.graphics();
    this.projectileGraphics.setDepth(6);
    this.missileGraphics = this.add.graphics();
    this.missileGraphics.setDepth(7);
    this.pdGraphics = this.add.graphics();
    this.pdGraphics.setDepth(7);
    this.fighterGraphics = this.add.graphics();
    this.fighterGraphics.setDepth(7);
    this.escapePodGraphics = this.add.graphics();
    this.escapePodGraphics.setDepth(6);

    // ── Environment graphics ──────────────────────────────────────────────
    // Static layer (asteroids, nebulae) — drawn once, never cleared.
    this.environmentGraphics = this.add.graphics();
    this.environmentGraphics.setDepth(1);
    // Dynamic layer (debris) — cleared and redrawn each frame.
    this.debrisGraphics = this.add.graphics();
    this.debrisGraphics.setDepth(1);
    this.drawnDebrisIds.clear();
    this._drawStaticEnvironment();

    // ── HUD (fixed to camera) ──────────────────────────────────────────────
    this._createHUD();

    // ── Input ──────────────────────────────────────────────────────────────
    this._setupInput();

    // ── Instructions overlay (starts paused) ────────────────────────────
    this._showInstructions();

    // ── Tick loop ──────────────────────────────────────────────────────────
    this.tickTimer = this.time.addEvent({
      delay: SPEED_PRESETS[0]!.msPerTick,
      loop: true,
      callback: () => this._onTick(),
    });
    // Start paused — the instructions overlay is showing; the timer resumes
    // when the player clicks BEGIN BATTLE.
    this.tickTimer.paused = true;

    // Emit scene change for React overlay awareness
    this.game.events.emit('scene:change', 'CombatScene');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_time: number, _delta: number): void {
    this._updateShipVisuals();
    this._drawBeams();
    this._drawProjectiles();
    this._drawMissiles();
    this._drawPointDefence();
    this._drawFighters();
    this._drawEscapePods();
    this._drawEnvironment();
    this._drawSelectionRing();
    this._updateSelectedInfo();
  }

  shutdown(): void {
    this.shipContainers.clear();
    this.shipSizes.clear();
    if (this.tickTimer) this.tickTimer.remove();
  }

  // =========================================================================
  // Background
  // =========================================================================

  private _drawStarfield(): void {
    const gfx = this.add.graphics();
    gfx.setDepth(0);

    // Fill a VERY large area with background so there's no black even when
    // the browser window is much larger than the battlefield
    const pad = 2000;
    gfx.fillStyle(0x06081a, 1);
    gfx.fillRect(-pad, -pad, this._bfWidth + pad * 2, this._bfHeight + pad * 2);

    // Subtle grid lines within the battlefield only
    gfx.lineStyle(1, 0x1a1a3a, 0.25);
    for (let x = 0; x <= this._bfWidth; x += 200) {
      gfx.lineBetween(x, 0, x, this._bfHeight);
    }
    for (let y = 0; y <= this._bfHeight; y += 200) {
      gfx.lineBetween(0, y, this._bfWidth, y);
    }

    // Stars spread across the full extended area
    for (let i = 0; i < STAR_COUNT * 3; i++) {
      const x = Phaser.Math.FloatBetween(-pad, this._bfWidth + pad);
      const y = Phaser.Math.FloatBetween(-pad, this._bfHeight + pad);
      const alpha = Phaser.Math.FloatBetween(0.15, 0.5);
      const radius = Phaser.Math.FloatBetween(0.4, 1.2);
      gfx.fillStyle(0xffffff, alpha);
      gfx.fillCircle(x, y, radius);
    }

    // ── Double boundary (Total War style) ──────────────────────────────────
    // Outer amber warning zone: "you're approaching the edge"
    const wm = BOUNDARY_WARNING_MARGIN;
    gfx.lineStyle(2, 0xf59e0b, 0.35);
    gfx.strokeRect(wm, wm, this._bfWidth - wm * 2, this._bfHeight - wm * 2);
    // Dashed amber fill on the warning strip
    gfx.fillStyle(0xf59e0b, 0.04);
    gfx.fillRect(0, 0, this._bfWidth, wm); // top
    gfx.fillRect(0, this._bfHeight - wm, this._bfWidth, wm); // bottom
    gfx.fillRect(0, wm, wm, this._bfHeight - wm * 2); // left
    gfx.fillRect(this._bfWidth - wm, wm, wm, this._bfHeight - wm * 2); // right

    // Inner red flee zone: "past here you are fleeing the battle"
    const fm = BOUNDARY_FLEE_MARGIN;
    gfx.lineStyle(2, 0xef4444, 0.5);
    gfx.strokeRect(fm, fm, this._bfWidth - fm * 2, this._bfHeight - fm * 2);
    gfx.fillStyle(0xef4444, 0.06);
    gfx.fillRect(0, 0, this._bfWidth, fm);
    gfx.fillRect(0, this._bfHeight - fm, this._bfWidth, fm);
    gfx.fillRect(0, fm, fm, this._bfHeight - fm * 2);
    gfx.fillRect(this._bfWidth - fm, fm, fm, this._bfHeight - fm * 2);

    // Labels on the boundary zones
    const warningLabel = this.add.text(this._bfWidth / 2, wm / 2, 'WARNING ZONE — Turn back or your fleet will flee', {
      fontFamily: 'monospace', fontSize: '10px', color: '#f59e0b', alpha: 0.5,
    });
    warningLabel.setOrigin(0.5, 0.5).setDepth(1);

    const fleeLabel = this.add.text(this._bfWidth / 2, fm / 2, 'FLEE ZONE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ef4444', alpha: 0.6,
    });
    fleeLabel.setOrigin(0.5, 0.5).setDepth(1);
  }

  /**
   * Draw a large curved planet edge in the bottom-right corner for
   * planetary assault layout. The planet centre is positioned so only
   * the curved edge is visible, with atmospheric glow layers.
   */
  private _drawPlanetEdge(): void {
    if (this.tacticalState.layout !== 'planetary_assault') return;

    const g = this.add.graphics();
    const planetCX = this.tacticalState.battlefieldWidth - 200;
    const planetCY = this.tacticalState.battlefieldHeight - 150;
    const planetType = this.tacticalState.planetData?.type ?? 'terran';

    const surfaceColour = PLANET_SURFACE_COLOURS[planetType] ?? 0x2a2a2a;
    const atmosphereColour = PLANET_ATMOSPHERE_COLOURS[planetType] ?? 0x4488cc;

    // Atmospheric glow — concentric arcs getting progressively fainter
    for (let i = 0; i < PLANET_ATMOSPHERE_GLOW_LAYERS; i++) {
      const r = PLANET_RADIUS + PLANET_ATMOSPHERE_GLOW_WIDTH - i * (PLANET_ATMOSPHERE_GLOW_WIDTH / PLANET_ATMOSPHERE_GLOW_LAYERS);
      const alpha = ((PLANET_ATMOSPHERE_GLOW_LAYERS - i) / PLANET_ATMOSPHERE_GLOW_LAYERS) * 0.15;
      g.lineStyle(3, atmosphereColour, alpha);
      g.beginPath();
      g.arc(planetCX, planetCY, r, Math.PI * 0.8, Math.PI * 1.8);
      g.strokePath();
    }

    // Planet surface — solid filled circle
    g.fillStyle(surfaceColour, 0.8);
    g.beginPath();
    g.arc(planetCX, planetCY, PLANET_RADIUS, 0, Math.PI * 2);
    g.fillPath();

    // Faint surface detail lines (continental/structural lines)
    g.lineStyle(1, 0xffffff, 0.04);
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI * 0.9 + i * 0.15;
      const innerR = PLANET_RADIUS * 0.6;
      const outerR = PLANET_RADIUS * 0.95;
      g.beginPath();
      g.arc(planetCX, planetCY, innerR + (outerR - innerR) * (i / 5), angle - 0.2, angle + 0.2);
      g.strokePath();
    }

    // Planet name label
    if (this.tacticalState.planetData?.name) {
      const labelX = planetCX - PLANET_RADIUS * 0.3;
      const labelY = planetCY - PLANET_RADIUS * 0.3;
      const label = this.add.text(labelX, labelY, this.tacticalState.planetData.name, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
      });
      label.setAlpha(0.25);
      label.setDepth(1);
    }

    g.setDepth(0);
  }

  // =========================================================================
  // Camera
  // =========================================================================

  /** UI objects that need zoom compensation — tracked so we can rescale on zoom change. */
  private _uiObjects: Phaser.GameObjects.Components.Transform[] = [];

  /** Register a UI object so it stays screen-sized regardless of camera zoom. */
  private _trackUI<T extends Phaser.GameObjects.Components.Transform>(obj: T): T {
    this._uiObjects.push(obj);
    const s = 1 / this.cameras.main.zoom;
    obj.setScale(s);
    return obj;
  }

  /** Rescale all tracked UI objects to counteract the current camera zoom. */
  private _rescaleUI(): void {
    const s = 1 / this.cameras.main.zoom;
    for (const obj of this._uiObjects) obj.setScale(s);
  }

  private _setupCamera(): void {
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    const camPad = 1000;
    cam.setBounds(
      -camPad,
      -camPad,
      this._bfWidth + camPad * 2,
      this._bfHeight + camPad * 2,
    );

    // Scale battlefield to FILL the screen
    const { width, height } = this.scale;
    const scaleX = width / this._bfWidth;
    const scaleY = height / this._bfHeight;
    const fitZoom = Math.max(scaleX, scaleY);
    cam.setZoom(fitZoom);
    cam.centerOn(this._bfWidth / 2, this._bfHeight / 2);

    // Min zoom scales with map size so ships stay visible
    const minZoom = Math.max(0.3, fitZoom * 0.5);

    this.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
    }, { passive: false });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom + (dy > 0 ? -0.05 : 0.05), minZoom, 2.0);
      cam.setZoom(newZoom);
      this._rescaleUI();
    });

    // Pan by dragging middle mouse or when holding shift
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let camStartX = 0;
    let camStartY = 0;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() || (pointer.leftButtonDown() && pointer.event.shiftKey)) {
        dragging = true;
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        camStartX = cam.scrollX;
        camStartY = cam.scrollY;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = (pointer.x - dragStartX) / cam.zoom;
      const dy = (pointer.y - dragStartY) / cam.zoom;
      cam.scrollX = camStartX - dx;
      cam.scrollY = camStartY - dy;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      dragging = false;

      // Complete drag selection or issue move
      if (this.dragSelecting && this.dragStartWorld) {
        const worldEnd = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const dx = Math.abs(worldEnd.x - this.dragStartWorld.x);
        const dy = Math.abs(worldEnd.y - this.dragStartWorld.y);

        if (dx > 15 || dy > 15) {
          // Dragged a box — select all friendly ships inside it
          const minX = Math.min(this.dragStartWorld.x, worldEnd.x);
          const maxX = Math.max(this.dragStartWorld.x, worldEnd.x);
          const minY = Math.min(this.dragStartWorld.y, worldEnd.y);
          const maxY = Math.max(this.dragStartWorld.y, worldEnd.y);

          const selected = this.tacticalState.ships.filter(s =>
            !s.destroyed && !s.routed && this._isPlayerSide(s) &&
            s.position.x >= minX && s.position.x <= maxX &&
            s.position.y >= minY && s.position.y <= maxY
          );

          if (selected.length > 0) {
            this.selectedShipId = selected[0]!.id;
            (this as unknown as Record<string, unknown>).selectedShipIds = selected.map(s => s.id);
          }
        } else if (this.selectedShipId) {
          // Small click (no drag) on empty space
          if (this.attackMoveMode) {
            this._applyAttackMove(worldEnd.x, worldEnd.y);
          } else {
            this._issueOrder({ type: 'move', x: worldEnd.x, y: worldEnd.y });
          }
        }

        this.dragSelecting = false;
        this.dragStartWorld = null;
        this.selectionBoxGfx.clear();
      }
    });

    // Draw selection box while dragging
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) {
        // existing camera pan handled above
      }
      if (this.dragSelecting && this.dragStartWorld && pointer.leftButtonDown()) {
        const worldEnd = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.selectionBoxGfx.clear();
        const x = Math.min(this.dragStartWorld.x, worldEnd.x);
        const y = Math.min(this.dragStartWorld.y, worldEnd.y);
        const w = Math.abs(worldEnd.x - this.dragStartWorld.x);
        const h = Math.abs(worldEnd.y - this.dragStartWorld.y);
        if (w > 5 || h > 5) {
          this.selectionBoxGfx.lineStyle(1, 0x44ffaa, 0.7);
          this.selectionBoxGfx.strokeRect(x, y, w, h);
          this.selectionBoxGfx.fillStyle(0x44ffaa, 0.1);
          this.selectionBoxGfx.fillRect(x, y, w, h);
        }
      }
    });
  }

  // =========================================================================
  // Ship containers
  // =========================================================================

  /**
   * Look up the hull class for a tactical ship by tracing back through
   * the source ship's design. Falls back to a size-based guess.
   */
  private _getHullClass(ship: TacticalShip): HullClass {
    // Find the canonical ship in the scene data
    const allShips = [...this.sceneData.attackerShips, ...this.sceneData.defenderShips];
    const sourceShip = allShips.find(s => s.id === ship.sourceShipId);
    if (sourceShip) {
      const design = this.sceneData.designs.get(sourceShip.designId);
      if (design) return design.hull;
    }
    // Fallback: guess from hull points
    if (ship.maxHull < 30) return 'science_probe';
    if (ship.maxHull < 60) return 'patrol';
    if (ship.maxHull < 120) return 'destroyer';
    if (ship.maxHull < 250) return 'light_cruiser';
    if (ship.maxHull < 450) return 'battleship';
    return 'heavy_battleship';
  }

  private _createShipContainers(): void {
    for (const ship of this.tacticalState.ships) {
      const size = shipSizeFromHull(ship.maxHull);
      this.shipSizes.set(ship.id, size);
      const { base, height } = size;
      const iconPx = iconSizeFromHull(ship.maxHull);

      const container = this.add.container(ship.position.x, ship.position.y);
      container.setDepth(8);
      container.setRotation(ship.facing);

      // Engine glow behind the ship
      const glow = this.add.graphics();
      const glowColor = this._shipColor(ship);
      glow.fillStyle(glowColor, 0.2);
      glow.fillCircle(-height / 2, 0, base * 0.6);
      container.add(glow);

      // ── Ship icon from ShipGraphics (hull-class silhouette) ──────────
      const hullClass = this._getHullClass(ship);
      const colorHex = ship.side === 'attacker'
        ? this.sceneData.attackerColor
        : this.sceneData.defenderColor;
      const speciesId = ship.side === 'attacker'
        ? this.sceneData.attackerSpeciesId
        : this.sceneData.defenderSpeciesId;
      const texKey = `ship_${hullClass}_${ship.side}_${iconPx}_${speciesId ?? 'default'}`;

      // Render ship silhouette directly as a Phaser Graphics object
      // (avoids async texture loading issues with addBase64/Image)
      const shipGfx = this.add.graphics();
      const dataUrl = renderShipIcon(hullClass, iconPx, colorHex, speciesId);
      if (dataUrl && dataUrl.startsWith('data:')) {
        // Use a canvas texture created from the data URL
        const canvasKey = `canvas_${texKey}`;
        if (!this.textures.exists(canvasKey)) {
          const canvasTex = this.textures.createCanvas(canvasKey, iconPx, iconPx);
          if (canvasTex) {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
              const ctx = canvasTex.getContext();
              ctx.drawImage(img, 0, 0, iconPx, iconPx);
              canvasTex.refresh();
            };
          }
        }
        const sprite = this.add.sprite(0, 0, `canvas_${texKey}`);
        sprite.setName('shipSprite');
        // ShipGraphics renders nose-up; combat scene faces right (+x)
        sprite.setAngle(-90);
        sprite.setDisplaySize(iconPx, iconPx);
        container.add(sprite);
      } else {
        // Fallback: draw a simple coloured shape
        const color = this._shipColor(ship);
        shipGfx.fillStyle(color, 0.8);
        shipGfx.fillRoundedRect(-iconPx / 2, -iconPx / 2, iconPx, iconPx, 4);
        shipGfx.lineStyle(1, 0xffffff, 0.4);
        shipGfx.strokeRoundedRect(-iconPx / 2, -iconPx / 2, iconPx, iconPx, 4);
        container.add(shipGfx);
      }

      // Counter-rotate text labels so they stay upright regardless of ship facing
      const textAngle = -Phaser.Math.RadToDeg(ship.facing);

      // Hull class label above the ship
      const classLabel = this.add.text(0, -iconPx / 2 - 6, hullClass.replace(/_/g, ' ').toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#88aaccaa',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 1,
      });
      classLabel.setOrigin(0.5, 1).setAngle(textAngle);
      container.add(classLabel);

      // Name label below the ship
      const label = this.add.text(0, iconPx / 2 + 4, ship.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ccddeeff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      });
      label.setOrigin(0.5, 0).setAngle(textAngle);
      container.add(label);

      // Make the container interactive for click targeting
      container.setSize(iconPx + 8, iconPx + 12);
      container.setInteractive();

      container.setData('shipId', ship.id);
      container.setData('side', ship.side);

      this.shipContainers.set(ship.id, container);
    }
  }

  private _shipColor(ship: TacticalShip): number {
    const hex = ship.side === 'attacker'
      ? this.sceneData.attackerColor
      : this.sceneData.defenderColor;
    return Phaser.Display.Color.HexStringToColor(hex).color;
  }

  private _isPlayerSide(ship: TacticalShip): boolean {
    const playerIsAttacker = this.sceneData.attackerFleet.empireId === this.sceneData.playerEmpireId;
    return (playerIsAttacker && ship.side === 'attacker') ||
           (!playerIsAttacker && ship.side === 'defender');
  }

  // =========================================================================
  // Per-frame visual updates
  // =========================================================================

  private _updateShipVisuals(): void {
    this.healthBarGraphics.clear();

    for (const ship of this.tacticalState.ships) {
      const container = this.shipContainers.get(ship.id);
      if (!container) continue;

      container.setPosition(ship.position.x, ship.position.y);
      container.setRotation(ship.facing);

      // Destroyed ships: play explosion then hide
      if (ship.destroyed && !this.prevDestroyed.has(ship.id)) {
        this.prevDestroyed.add(ship.id);
        container.setVisible(false);
        this._playExplosion(ship.position.x, ship.position.y);
        continue;
      }

      container.setVisible(!ship.destroyed && !ship.routed);

      if (ship.destroyed || ship.routed) continue;

      // Higher minimum alpha so damaged ships remain visible
      const hullFraction = ship.maxHull > 0 ? ship.hull / ship.maxHull : 1;
      const alpha = 0.6 + hullFraction * 0.4;
      container.setAlpha(alpha);

      // Damage flash — if hull dropped since last check
      const prev = this.prevHull.get(ship.id) ?? ship.hull;
      if (ship.hull < prev) {
        this._flashDamage(container);
      }
      this.prevHull.set(ship.id, ship.hull);

      // ── Health bar above the ship ──────────────────────────────────────
      const size = this.shipSizes.get(ship.id) ?? SHIP_SIZE_SMALL;
      const barW = Math.max(HEALTH_BAR_WIDTH, size.base * 1.2);
      const barX = ship.position.x - barW / 2;
      const barY = ship.position.y + HEALTH_BAR_OFFSET_Y - size.base / 2;

      // Background (dark)
      this.healthBarGraphics.fillStyle(0x111122, 0.8);
      this.healthBarGraphics.fillRect(barX, barY, barW, HEALTH_BAR_HEIGHT);

      // Shield bar (blue) if shields exist
      if (ship.maxShields > 0) {
        const shieldFrac = ship.shields / ship.maxShields;
        this.healthBarGraphics.fillStyle(0x4488ff, 0.9);
        this.healthBarGraphics.fillRect(barX, barY, barW * shieldFrac, HEALTH_BAR_HEIGHT);
      }

      // Hull bar (green->yellow->red based on fraction)
      const hullBarY = barY + HEALTH_BAR_HEIGHT + 1;
      this.healthBarGraphics.fillStyle(0x111122, 0.8);
      this.healthBarGraphics.fillRect(barX, hullBarY, barW, HEALTH_BAR_HEIGHT);
      const hullColor = hullFraction > 0.6 ? 0x44cc44 : hullFraction > 0.3 ? 0xcccc44 : 0xcc4444;
      this.healthBarGraphics.fillStyle(hullColor, 0.9);
      this.healthBarGraphics.fillRect(barX, hullBarY, barW * hullFraction, HEALTH_BAR_HEIGHT);
    }
  }

  /** Brief red tint flash on a ship container when it takes damage. */
  private _flashDamage(container: Phaser.GameObjects.Container): void {
    const shipId = container.getData('shipId') as string;
    const size = this.shipSizes.get(shipId) ?? SHIP_SIZE_SMALL;
    // Create a small circle overlay for the flash
    const flash = this.add.graphics();
    flash.fillStyle(DAMAGE_FLASH_COLOR, 0.6);
    flash.fillCircle(0, 0, size.base);
    container.add(flash);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: DAMAGE_FLASH_DURATION,
      onComplete: () => {
        flash.destroy();
      },
    });
  }

  /** Expanding + fading circle explosion effect at a world position. */
  private _playExplosion(x: number, y: number): void {
    const gfx = this.add.graphics();
    gfx.setDepth(9);
    gfx.fillStyle(EXPLOSION_COLOR, 0.9);
    gfx.fillCircle(x, y, 2);

    // Use a proxy object for the tween since Graphics doesn't have scaleX/Y in the same way
    const proxy = { radius: 2, alpha: 0.9 };
    this.tweens.add({
      targets: proxy,
      radius: EXPLOSION_RADIUS,
      alpha: 0,
      duration: EXPLOSION_DURATION,
      onUpdate: () => {
        gfx.clear();
        gfx.fillStyle(EXPLOSION_COLOR, proxy.alpha);
        gfx.fillCircle(x, y, proxy.radius);
      },
      onComplete: () => {
        gfx.destroy();
      },
    });
  }

  private _drawBeams(): void {
    this.beamGraphics.clear();
    const tick = this.tacticalState.tick;
    for (const beam of this.tacticalState.beamEffects) {
      const source = this.tacticalState.ships.find(s => s.id === beam.sourceShipId);
      const target = this.tacticalState.ships.find(s => s.id === beam.targetShipId);
      if (!source || !target) continue;

      const sx = source.position.x;
      const sy = source.position.y;
      const tx = target.position.x;
      const ty = target.position.y;
      const fadeAlpha = Math.max(0.3, beam.ticksRemaining / 3);
      const friendly = this._isPlayerSide(source);
      const tint = friendly ? BEAM_TINT_FRIENDLY : BEAM_TINT_ENEMY;
      const style: BeamStyle = BEAM_STYLE_MAP[beam.componentId ?? ''] ?? 'pulse';

      // Damage-based intensity scaling: low (10) to high (55+)
      const intensity = Math.min(1, beam.damage / 55);

      switch (style) {
        // ── Pulse laser / Phased array: thin pulsing line ──────────────────
        case 'pulse': {
          // Pulse effect: rapid on/off flicker
          const pulseOn = (tick % 3) < 2;
          if (!pulseOn) break;
          const width = 1.5 + intensity * 1.5; // 1.5 - 3
          const color = Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);
          this.beamGraphics.lineStyle(width, color, fadeAlpha * 0.9);
          this.beamGraphics.lineBetween(sx, sy, tx, ty);
          break;
        }

        // ── Particle beam / Radiation ray: thick glow + thin bright core ───
        case 'particle':
        case 'radiation': {
          const isRad = style === 'radiation';
          const outerTint = isRad
            ? { r: 0x88, g: 0xff, b: 0x44 } // sickly green for radiation
            : tint;
          const outerColor = Phaser.Display.Color.GetColor(outerTint.r, outerTint.g, outerTint.b);
          const innerColor = isRad ? 0xccffaa : 0xffffff;
          // Fat translucent outer glow
          const outerWidth = 6 + intensity * 4; // 6 - 10
          this.beamGraphics.lineStyle(outerWidth, outerColor, fadeAlpha * 0.25);
          this.beamGraphics.lineBetween(sx, sy, tx, ty);
          // Thin bright inner core
          const innerWidth = 1.5 + intensity * 1;
          this.beamGraphics.lineStyle(innerWidth, innerColor, fadeAlpha * 0.9);
          this.beamGraphics.lineBetween(sx, sy, tx, ty);
          break;
        }

        // ── Disruptor beam: jagged lightning bolt, purple tint ──────────────
        case 'disruptor': {
          const purpleOuter = 0x9944ff;
          const purpleInner = 0xddaaff;
          // Generate zigzag segments between source and target
          const dx = tx - sx;
          const dy = ty - sy;
          const length = Math.sqrt(dx * dx + dy * dy);
          const segments = Math.max(4, Math.floor(length / 20));
          const perpX = -dy / length;
          const perpY = dx / length;
          // Outer glow path
          this.beamGraphics.lineStyle(4 + intensity * 3, purpleOuter, fadeAlpha * 0.3);
          this.beamGraphics.beginPath();
          this.beamGraphics.moveTo(sx, sy);
          for (let i = 1; i < segments; i++) {
            const t = i / segments;
            // Deterministic-ish jitter based on tick+segment for animation
            const jitter = ((Math.sin(tick * 7 + i * 13) + Math.sin(tick * 11 + i * 7)) * 0.5) * (8 + intensity * 8);
            const px = sx + dx * t + perpX * jitter;
            const py = sy + dy * t + perpY * jitter;
            this.beamGraphics.lineTo(px, py);
          }
          this.beamGraphics.lineTo(tx, ty);
          this.beamGraphics.strokePath();
          // Inner bright path (same zigzag)
          this.beamGraphics.lineStyle(1.5, purpleInner, fadeAlpha * 0.85);
          this.beamGraphics.beginPath();
          this.beamGraphics.moveTo(sx, sy);
          for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const jitter = ((Math.sin(tick * 7 + i * 13) + Math.sin(tick * 11 + i * 7)) * 0.5) * (8 + intensity * 8);
            const px = sx + dx * t + perpX * jitter;
            const py = sy + dy * t + perpY * jitter;
            this.beamGraphics.lineTo(px, py);
          }
          this.beamGraphics.lineTo(tx, ty);
          this.beamGraphics.strokePath();
          break;
        }

        // ── Plasma lance: very thick beam with orange-white fade gradient ───
        case 'plasma': {
          // Outermost orange glow
          this.beamGraphics.lineStyle(12 + intensity * 6, 0xff6600, fadeAlpha * 0.15);
          this.beamGraphics.lineBetween(sx, sy, tx, ty);
          // Middle orange-yellow
          this.beamGraphics.lineStyle(6 + intensity * 3, 0xff9933, fadeAlpha * 0.35);
          this.beamGraphics.lineBetween(sx, sy, tx, ty);
          // Inner white-hot core
          this.beamGraphics.lineStyle(2 + intensity * 1.5, 0xffffdd, fadeAlpha * 0.9);
          this.beamGraphics.lineBetween(sx, sy, tx, ty);
          break;
        }
      }
    }
  }

  private _drawProjectiles(): void {
    this.projectileGraphics.clear();
    for (const proj of this.tacticalState.projectiles) {
      const px = proj.position.x;
      const py = proj.position.y;
      const style: ProjectileStyle = PROJECTILE_STYLE_MAP[proj.componentId ?? ''] ?? 'kinetic';
      // Damage-based size: range ~2-6 radius
      const dmgFrac = Math.min(1, proj.damage / 65);
      const radius = PROJECTILE_MIN_RADIUS + dmgFrac * (PROJECTILE_MAX_RADIUS - PROJECTILE_MIN_RADIUS);

      // Compute heading from source to target for trail direction
      const target = this.tacticalState.ships.find(s => s.id === proj.targetShipId);
      let hdg = 0;
      if (target) {
        hdg = Math.atan2(target.position.y - py, target.position.x - px);
      }

      switch (style) {
        // ── Kinetic cannon: small white/grey fast dot, no trail ─────────────
        case 'kinetic': {
          this.projectileGraphics.fillStyle(0xcccccc, 0.95);
          this.projectileGraphics.fillCircle(px, py, Math.max(2, radius * 0.7));
          break;
        }

        // ── Fusion autocannon: rapid orange-white rounds ────────────────────
        case 'fusion': {
          this.projectileGraphics.fillStyle(0xffaa44, 0.9);
          this.projectileGraphics.fillCircle(px, py, Math.max(2, radius * 0.6));
          // Tiny bright core
          this.projectileGraphics.fillStyle(0xffeedd, 0.7);
          this.projectileGraphics.fillCircle(px, py, 1);
          break;
        }

        // ── Mass driver: blue-white dot with short trail ────────────────────
        case 'mass_driver': {
          // Short trail behind
          const trailLen = 10;
          const tailX = px - Math.cos(hdg) * trailLen;
          const tailY = py - Math.sin(hdg) * trailLen;
          this.projectileGraphics.lineStyle(2, 0x88bbff, 0.3);
          this.projectileGraphics.lineBetween(tailX, tailY, px, py);
          // Bright dot
          this.projectileGraphics.fillStyle(0xaaccff, 0.95);
          this.projectileGraphics.fillCircle(px, py, radius);
          // White core
          this.projectileGraphics.fillStyle(0xffffff, 0.6);
          this.projectileGraphics.fillCircle(px, py, radius * 0.4);
          break;
        }

        // ── Gauss cannon: bright blue elongated streak ──────────────────────
        case 'gauss': {
          const streakLen = 14;
          const tailX = px - Math.cos(hdg) * streakLen;
          const tailY = py - Math.sin(hdg) * streakLen;
          // Outer glow streak
          this.projectileGraphics.lineStyle(4, 0x4488ff, 0.3);
          this.projectileGraphics.lineBetween(tailX, tailY, px, py);
          // Inner bright streak
          this.projectileGraphics.lineStyle(2, 0x88ccff, 0.9);
          this.projectileGraphics.lineBetween(tailX, tailY, px, py);
          // Bright tip
          this.projectileGraphics.fillStyle(0xccddff, 0.95);
          this.projectileGraphics.fillCircle(px, py, 2.5);
          break;
        }

        // ── Battering ram: big solid grey chunk ─────────────────────────────
        case 'battering_ram': {
          this.projectileGraphics.fillStyle(0x999999, 0.95);
          this.projectileGraphics.fillCircle(px, py, radius * 1.3);
          this.projectileGraphics.fillStyle(0xbbbbbb, 0.5);
          this.projectileGraphics.fillCircle(px, py, radius * 0.6);
          break;
        }

        // ── Antimatter accelerator: glowing purple-white with particle trail
        case 'antimatter': {
          // Trailing glow particles
          for (let i = 1; i <= PROJECTILE_TRAIL_LENGTH; i++) {
            const tFrac = i / (PROJECTILE_TRAIL_LENGTH + 1);
            const trailX = px - Math.cos(hdg) * (i * 6);
            const trailY = py - Math.sin(hdg) * (i * 6);
            this.projectileGraphics.fillStyle(0xaa66ff, 0.4 * (1 - tFrac));
            this.projectileGraphics.fillCircle(trailX, trailY, radius * (1 - tFrac * 0.5));
          }
          // Outer glow
          this.projectileGraphics.fillStyle(0x8844cc, 0.3);
          this.projectileGraphics.fillCircle(px, py, radius * 1.8);
          // Bright core
          this.projectileGraphics.fillStyle(0xddaaff, 0.95);
          this.projectileGraphics.fillCircle(px, py, radius);
          // White-hot centre
          this.projectileGraphics.fillStyle(0xffffff, 0.7);
          this.projectileGraphics.fillCircle(px, py, radius * 0.4);
          break;
        }

        // ── Singularity driver: distortion ring + dark core ─────────────────
        case 'singularity': {
          // Trailing distortion particles
          for (let i = 1; i <= PROJECTILE_TRAIL_LENGTH; i++) {
            const tFrac = i / (PROJECTILE_TRAIL_LENGTH + 1);
            const trailX = px - Math.cos(hdg) * (i * 7);
            const trailY = py - Math.sin(hdg) * (i * 7);
            this.projectileGraphics.fillStyle(0x6622aa, 0.3 * (1 - tFrac));
            this.projectileGraphics.fillCircle(trailX, trailY, radius * 0.8 * (1 - tFrac * 0.4));
          }
          // Outer gravitational distortion ring
          this.projectileGraphics.lineStyle(2, 0x9955ff, 0.4);
          this.projectileGraphics.strokeCircle(px, py, radius * 2.2);
          // Inner ring
          this.projectileGraphics.lineStyle(1.5, 0xbb88ff, 0.5);
          this.projectileGraphics.strokeCircle(px, py, radius * 1.4);
          // Dark core (the singularity itself)
          this.projectileGraphics.fillStyle(0x110022, 0.95);
          this.projectileGraphics.fillCircle(px, py, radius * 0.8);
          // Bright accretion ring highlight
          this.projectileGraphics.fillStyle(0xddaaff, 0.6);
          this.projectileGraphics.fillCircle(px, py, radius * 0.3);
          break;
        }
      }
    }
  }

  /**
   * Draw missiles as coloured triangles with visible exhaust trail.
   * Higher-tier missiles glow brighter and are larger.
   */
  private _drawMissiles(): void {
    this.missileGraphics.clear();
    for (const missile of (this.tacticalState.missiles ?? [])) {
      // Find the target to compute heading
      const target = this.tacticalState.ships.find(s => s.id === missile.targetShipId);
      let heading = 0;
      if (target) {
        heading = Math.atan2(
          target.position.y - missile.y,
          target.position.x - missile.x,
        );
      }

      // Look up per-type visual style via componentId
      const mStyle: MissileStyle = MISSILE_STYLE_MAP[missile.componentId ?? ''] ?? 'torpedo';
      const vis = MISSILE_VISUALS[mStyle];
      const { size, trailLen, bodyColor, exhaustColor, glowColor, glowAlpha, exhaustSegments } = vis;

      const cos = Math.cos(heading);
      const sin = Math.sin(heading);

      // ── Exhaust trail: fading dots behind the missile ────────────────────
      for (let i = 1; i <= exhaustSegments; i++) {
        const t = i / (exhaustSegments + 1);
        const ex = missile.x - cos * (trailLen * t);
        const ey = missile.y - sin * (trailLen * t);
        const dotR = size * 0.25 * (1 - t * 0.6);
        this.missileGraphics.fillStyle(exhaustColor, 0.5 * (1 - t));
        this.missileGraphics.fillCircle(ex, ey, dotR);
      }

      // ── Exhaust trail line ───────────────────────────────────────────────
      const tailX = missile.x - cos * trailLen;
      const tailY = missile.y - sin * trailLen;
      this.missileGraphics.lineStyle(1.5, exhaustColor, 0.35);
      this.missileGraphics.lineBetween(tailX, tailY, missile.x, missile.y);

      // ── Outer glow (only for styles that warrant it) ─────────────────────
      if (glowAlpha > 0) {
        this.missileGraphics.fillStyle(glowColor, glowAlpha);
        this.missileGraphics.fillCircle(missile.x, missile.y, size * 1.2);
      }

      // ── Singularity warp ring ────────────────────────────────────────────
      if (mStyle === 'singularity') {
        const warpPhase = (Date.now() % 400) / 400;
        const warpR = size * (1.0 + warpPhase * 0.8);
        this.missileGraphics.lineStyle(1, 0xaa66ff, 0.3 * (1 - warpPhase));
        this.missileGraphics.strokeCircle(missile.x, missile.y, warpR);
      }

      // ── Missile body triangle ────────────────────────────────────────────
      const noseX = missile.x + cos * size;
      const noseY = missile.y + sin * size;
      const leftX = missile.x + (-cos * size * 0.5 - sin * size * 0.4);
      const leftY = missile.y + (-sin * size * 0.5 + cos * size * 0.4);
      const rightX = missile.x + (-cos * size * 0.5 + sin * size * 0.4);
      const rightY = missile.y + (-sin * size * 0.5 - cos * size * 0.4);

      this.missileGraphics.fillStyle(bodyColor, 0.95);
      this.missileGraphics.beginPath();
      this.missileGraphics.moveTo(noseX, noseY);
      this.missileGraphics.lineTo(leftX, leftY);
      this.missileGraphics.lineTo(rightX, rightY);
      this.missileGraphics.closePath();
      this.missileGraphics.fillPath();

      // ── Bright nose tip (brighter for heavier ordnance) ──────────────────
      const noseBrightness = mStyle === 'basic' ? 0.5 : mStyle === 'singularity' ? 0.9 : 0.7;
      this.missileGraphics.fillStyle(0xffffff, noseBrightness);
      this.missileGraphics.fillCircle(noseX, noseY, mStyle === 'basic' ? 1 : 1.5);
    }
  }

  /**
   * Draw point defence: tracer rounds streaming from ship to intercept point,
   * with a starburst flash at the intercept.
   */
  private _drawPointDefence(): void {
    this.pdGraphics.clear();
    for (const pd of (this.tacticalState.pointDefenceEffects ?? [])) {
      const ship = this.tacticalState.ships.find(s => s.id === pd.shipId);
      if (!ship) continue;
      const alpha = (pd.ticksRemaining / 2) * PD_ALPHA;
      const dx = pd.missileX - ship.position.x;
      const dy = pd.missileY - ship.position.y;
      const lineLen = Math.sqrt(dx * dx + dy * dy);
      if (lineLen < 1) continue;
      const nx = dx / lineLen;
      const ny = dy / lineLen;

      // ── Tracer rounds along the line ─────────────────────────────────────
      // Animated dots that stream from ship to intercept point
      const tick = this.tacticalState.tick;
      for (let i = 0; i < PD_TRACER_COUNT; i++) {
        const t = ((i / PD_TRACER_COUNT) + (tick * 0.15)) % 1.0;
        const tx = ship.position.x + dx * t;
        const ty = ship.position.y + dy * t;
        const tracerAlpha = alpha * (0.5 + t * 0.5); // brighter near target
        this.pdGraphics.fillStyle(PD_TRACER_COLOR, tracerAlpha);
        this.pdGraphics.fillCircle(tx, ty, 1.5);
      }

      // ── Thin intercept line (faint) ──────────────────────────────────────
      this.pdGraphics.lineStyle(0.8, PD_COLOR, alpha * 0.3);
      this.pdGraphics.lineBetween(
        ship.position.x, ship.position.y,
        pd.missileX, pd.missileY,
      );

      // ── Starburst flash at intercept point ───────────────────────────────
      const burstAlpha = alpha * 0.9;
      const r = PD_STARBURST_RADIUS * (1 + (1 - pd.ticksRemaining / 2) * 0.5);
      // Centre bright dot
      this.pdGraphics.fillStyle(0xffff88, burstAlpha);
      this.pdGraphics.fillCircle(pd.missileX, pd.missileY, r * 0.5);
      // 6 spokes radiating from the intercept point
      const spokes = 6;
      for (let i = 0; i < spokes; i++) {
        const angle = (i / spokes) * Math.PI * 2 + tick * 0.3;
        const tipX = pd.missileX + Math.cos(angle) * r;
        const tipY = pd.missileY + Math.sin(angle) * r;
        this.pdGraphics.lineStyle(1, PD_TRACER_COLOR, burstAlpha * 0.8);
        this.pdGraphics.lineBetween(pd.missileX, pd.missileY, tipX, tipY);
      }
      // Outer ring flash
      this.pdGraphics.lineStyle(1, 0xffee66, burstAlpha * 0.5);
      this.pdGraphics.strokeCircle(pd.missileX, pd.missileY, r * 1.2);
      // Debris scatter dots
      for (let i = 0; i < 4; i++) {
        const debrisAngle = Math.random() * Math.PI * 2;
        const debrisDist = r * (0.5 + Math.random());
        this.pdGraphics.fillStyle(0xff8844, burstAlpha * 0.6);
        this.pdGraphics.fillCircle(
          pd.missileX + Math.cos(debrisAngle) * debrisDist,
          pd.missileY + Math.sin(debrisAngle) * debrisDist,
          1,
        );
      }
    }
  }

  /**
   * Draw escape pods — tiny blinking pods scattering from destroyed ships.
   */
  private _drawEscapePods(): void {
    this.escapePodGraphics.clear();
    const tick = this.tacticalState.tick;
    for (const pod of (this.tacticalState.escapePods ?? [])) {
      // Blinking distress signal
      const blinkOn = Math.floor(tick / POD_BLINK_RATE) % 2 === 0;
      const podAlpha = Math.min(1, pod.ttl / 20); // fade out as TTL drops

      // ── Tiny engine trail ──────────────────────────────────────────────
      const trailX = pod.x - pod.vx * 2;
      const trailY = pod.y - pod.vy * 2;
      this.escapePodGraphics.lineStyle(0.8, POD_TRAIL_COLOR, podAlpha * 0.4);
      this.escapePodGraphics.lineBetween(trailX, trailY, pod.x, pod.y);

      // ── Pod body (tiny diamond shape) ──────────────────────────────────
      this.escapePodGraphics.fillStyle(POD_COLOR, podAlpha * 0.8);
      this.escapePodGraphics.beginPath();
      this.escapePodGraphics.moveTo(pod.x, pod.y - POD_SIZE);
      this.escapePodGraphics.lineTo(pod.x + POD_SIZE * 0.6, pod.y);
      this.escapePodGraphics.lineTo(pod.x, pod.y + POD_SIZE);
      this.escapePodGraphics.lineTo(pod.x - POD_SIZE * 0.6, pod.y);
      this.escapePodGraphics.closePath();
      this.escapePodGraphics.fillPath();

      // ── Blinking distress beacon ───────────────────────────────────────
      if (blinkOn) {
        this.escapePodGraphics.fillStyle(0xff4444, podAlpha * 0.9);
        this.escapePodGraphics.fillCircle(pod.x, pod.y - POD_SIZE - 1, 1);
      }
    }
  }

  /**
   * Draw fighters as small diamond/chevron shapes in empire colours.
   * Jitter creates a swarming effect; heading points toward target.
   */
  private _drawFighters(): void {
    this.fighterGraphics.clear();
    for (const fighter of (this.tacticalState.fighters ?? [])) {
      if (fighter.health <= 0) continue;
      const color = fighter.side === 'attacker'
        ? Phaser.Display.Color.HexStringToColor(this.sceneData.attackerColor).color
        : Phaser.Display.Color.HexStringToColor(this.sceneData.defenderColor).color;
      // Add slight random jitter for visual swarming effect
      const jitterX = (Math.random() - 0.5) * FIGHTER_JITTER;
      const jitterY = (Math.random() - 0.5) * FIGHTER_JITTER;
      const fx = fighter.x + jitterX;
      const fy = fighter.y + jitterY;

      // Compute heading toward target (or carrier if returning)
      let heading = 0;
      if (fighter.targetId) {
        const tgt = this.tacticalState.ships.find(s => s.id === fighter.targetId);
        if (tgt) heading = Math.atan2(tgt.position.y - fy, tgt.position.x - fx);
      } else if (fighter.carrierId) {
        const carrier = this.tacticalState.ships.find(s => s.id === fighter.carrierId);
        if (carrier) heading = Math.atan2(carrier.position.y - fy, carrier.position.x - fx);
      }

      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      const s = FIGHTER_SIZE;

      // Draw a small chevron/arrow shape
      const noseX = fx + cos * s;
      const noseY = fy + sin * s;
      const leftX = fx + (-cos * s * 0.5 - sin * s * 0.6);
      const leftY = fy + (-sin * s * 0.5 + cos * s * 0.6);
      const rearX = fx - cos * s * 0.3;
      const rearY = fy - sin * s * 0.3;
      const rightX = fx + (-cos * s * 0.5 + sin * s * 0.6);
      const rightY = fy + (-sin * s * 0.5 - cos * s * 0.6);

      this.fighterGraphics.fillStyle(color, 0.9);
      this.fighterGraphics.beginPath();
      this.fighterGraphics.moveTo(noseX, noseY);
      this.fighterGraphics.lineTo(leftX, leftY);
      this.fighterGraphics.lineTo(rearX, rearY);
      this.fighterGraphics.lineTo(rightX, rightY);
      this.fighterGraphics.closePath();
      this.fighterGraphics.fillPath();

      // Tiny engine glow at the rear
      this.fighterGraphics.fillStyle(0xffaa44, 0.5);
      this.fighterGraphics.fillCircle(rearX, rearY, 1.5);
    }
  }

  /**
   * Draw environment features: asteroids (grey jagged circles), nebulae
   * (large semi-transparent coloured circles), and debris (small dark orange
   * scattered dots that appear when ships explode).
   */
  /** Draw static environment features (asteroids, nebulae) once on init. */
  private _drawStaticEnvironment(): void {
    const features = this.tacticalState.environment ?? [];
    for (const f of features) {
      if (f.type === 'asteroid') {
        this.environmentGraphics.fillStyle(ASTEROID_COLOR, ASTEROID_ALPHA);
        this.environmentGraphics.beginPath();
        const segments = 10;
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const variation = 0.7 + 0.6 * ((Math.sin(f.x * 7 + i * 13) + 1) / 2);
          const r = f.radius * variation;
          const px = f.x + Math.cos(angle) * r;
          const py = f.y + Math.sin(angle) * r;
          if (i === 0) this.environmentGraphics.moveTo(px, py);
          else this.environmentGraphics.lineTo(px, py);
        }
        this.environmentGraphics.closePath();
        this.environmentGraphics.fillPath();
      } else if (f.type === 'nebula') {
        this.environmentGraphics.fillStyle(NEBULA_COLOR, NEBULA_ALPHA);
        this.environmentGraphics.fillCircle(f.x, f.y, f.radius);
      }
    }
  }

  /** Draw only dynamic debris — called per frame. Static features drawn once. */
  private _drawEnvironment(): void {
    this.debrisGraphics.clear();
    const features = this.tacticalState.environment ?? [];
    for (const f of features) {
      if (f.type !== 'debris') continue;
      for (let i = 0; i < DEBRIS_DOT_COUNT; i++) {
        const angle = (i / DEBRIS_DOT_COUNT) * Math.PI * 2 + f.x * 0.01;
        const r = f.radius * (0.3 + 0.7 * ((Math.sin(f.y * 3 + i * 7) + 1) / 2));
        const dx = f.x + Math.cos(angle) * r;
        const dy = f.y + Math.sin(angle) * r;
        this.debrisGraphics.fillStyle(DEBRIS_COLOR, DEBRIS_DOT_ALPHA);
        this.debrisGraphics.fillCircle(dx, dy, DEBRIS_DOT_RADIUS);
      }
    }
  }

  private _drawSelectionRing(): void {
    this.selectionRing.clear();

    // Multi-selection: draw rings on ALL selected ships
    const multiIds = (this as unknown as Record<string, unknown>).selectedShipIds as string[] | null;
    if (multiIds && multiIds.length > 0) {
      // Remove destroyed/routed ships from selection
      const alive = multiIds.filter(id => {
        const s = this.tacticalState.ships.find(sh => sh.id === id);
        return s && !s.destroyed && !s.routed;
      });
      (this as unknown as Record<string, unknown>).selectedShipIds = alive.length > 0 ? alive : null;
      if (alive.length > 0) this.selectedShipId = alive[0] ?? null;

      for (const id of alive) {
        const ship = this.tacticalState.ships.find(s => s.id === id);
        if (!ship) continue;
        const selSize = this.shipSizes.get(ship.id) ?? SHIP_SIZE_SMALL;
        const ringRadius = Math.max(SELECTION_RING_RADIUS, selSize.height * 0.6);
        this.selectionRing.lineStyle(2, SELECTION_RING_COLOR, SELECTION_RING_ALPHA);
        this.selectionRing.strokeCircle(ship.position.x, ship.position.y, ringRadius);
      }
      return;
    }

    // Single selection
    if (!this.selectedShipId) return;
    const ship = this.tacticalState.ships.find(s => s.id === this.selectedShipId);
    if (!ship || ship.destroyed || ship.routed) {
      this.selectedShipId = null;
      return;
    }
    const selSize = this.shipSizes.get(ship.id) ?? SHIP_SIZE_SMALL;
    const ringRadius = Math.max(SELECTION_RING_RADIUS, selSize.height * 0.6);
    this.selectionRing.lineStyle(2, SELECTION_RING_COLOR, SELECTION_RING_ALPHA);
    this.selectionRing.strokeCircle(ship.position.x, ship.position.y, ringRadius);
  }

  // =========================================================================
  // HUD
  // =========================================================================

  private _createHUD(): void {
    const z = this.cameras.main.zoom;
    const width = this.scale.width / z;
    const height = this.scale.height / z;

    // ── Top-left: title + tick counter ─────────────────────────────────────
    const titleLabel = this.add.text(12, 10, 'TACTICAL COMBAT', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff8844',
      stroke: '#000000',
      strokeThickness: 3,
    });
    titleLabel.setScrollFactor(0).setDepth(100);

    this.tickLabel = this.add.text(12, 32, 'Tick: 0', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#88aacc',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.tickLabel.setScrollFactor(0).setDepth(100);

    // Empire names
    const attackerLabel = this.add.text(12, 52, this.sceneData.attackerName, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: this.sceneData.attackerColor,
      stroke: '#000000',
      strokeThickness: 2,
    });
    attackerLabel.setScrollFactor(0).setDepth(100);

    const defenderLabel = this.add.text(12, 70, `vs ${this.sceneData.defenderName}`, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: this.sceneData.defenderColor,
      stroke: '#000000',
      strokeThickness: 2,
    });
    defenderLabel.setScrollFactor(0).setDepth(100);

    // ── Selected ship info (above the bottom bar) ──────────────────────────
    this.selectedInfoLabel = this.add.text(12, height - 74, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ccddee',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: width - 200 },
    });
    this.selectedInfoLabel.setScrollFactor(0).setDepth(100);

    // ── Top-right: speed controls ──────────────────────────────────────────
    let btnX = width - 16;

    // Pause button
    this.pauseButton = this.add.text(btnX, 10, '| |', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffcc44',
      backgroundColor: '#1a1a2e',
      padding: { x: 6, y: 4 },
    });
    this.pauseButton.setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.pauseButton.setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerdown', () => this._togglePause());
    btnX -= this.pauseButton.width + 8;

    // Speed buttons (right to left so 4x is rightmost)
    for (let i = SPEED_PRESETS.length - 1; i >= 0; i--) {
      const preset = SPEED_PRESETS[i]!;
      const btn = this.add.text(btnX, 10, preset.label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: i === this.speedIndex ? '#44ffaa' : '#6688aa',
        backgroundColor: '#1a1a2e',
        padding: { x: 6, y: 4 },
      });
      btn.setOrigin(1, 0).setScrollFactor(0).setDepth(100);
      btn.setInteractive({ useHandCursor: true });
      const idx = i;
      btn.on('pointerdown', () => this._setSpeed(idx));
      this.speedButtons[i] = btn;
      btnX -= btn.width + 6;
    }

    // ── Bottom-right: retreat button ───────────────────────────────────────
    const retreatBtn = this.add.text(width - 16, height - 38, 'RETREAT ALL', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ff5555',
      backgroundColor: '#1a1a2e',
      padding: { x: 12, y: 8 },
      stroke: '#ff5555',
      strokeThickness: 1,
    });
    retreatBtn.setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    retreatBtn.setInteractive({ useHandCursor: true });
    retreatBtn.on('pointerdown', () => this._retreatAll());

    // ── Bottom-centre: formation + stance bar (fixed size, zoom-independent) ──
    const barY = height - 46;
    const barBg = this.add.graphics();
    barBg.setScrollFactor(0).setDepth(99);
    barBg.fillStyle(0x0a1628, 0.85);
    barBg.fillRoundedRect(8, barY - 8, width - 16, 52, 6);
    barBg.lineStyle(1, 0x2a4a6a, 0.5);
    barBg.strokeRoundedRect(8, barY - 8, width - 16, 52, 6);

    const formationLabel = this.add.text(16, barY, 'FORMATION:', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#88aacc',
      stroke: '#000000',
      strokeThickness: 2,
    });
    formationLabel.setScrollFactor(0).setDepth(100);

    let fmtBtnX = 130;
    this.formationButtons = [];
    for (const fm of FORMATION_TYPES) {
      const isActive = fm.type === 'line'; // default formation
      const btn = this.add.text(fmtBtnX, barY - 2, fm.label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: isActive ? '#44ffaa' : '#6688aa',
        backgroundColor: isActive ? '#1a3a2e' : '#1a1a2e',
        padding: { x: 14, y: 8 },
        stroke: '#000000',
        strokeThickness: 1,
      });
      btn.setScrollFactor(0).setDepth(100);
      btn.setInteractive({ useHandCursor: true });
      btn.setData('formationType', fm.type);
      btn.on('pointerdown', () => this._setPlayerFormation(fm.type));
      this.formationButtons.push(btn);
      fmtBtnX += btn.width + 8;
    }

    // Stance buttons (right side of the bar)
    const stanceLabel = this.add.text(fmtBtnX + 20, barY, 'STANCE:', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#88aacc',
      stroke: '#000000',
      strokeThickness: 2,
    });
    stanceLabel.setScrollFactor(0).setDepth(100);

    this.stanceButtons = [];
    let stBtnX = fmtBtnX + 100;
    for (const st of STANCE_TYPES) {
      const isActive = st.type === 'aggressive';
      const btn = this.add.text(stBtnX, barY - 2, st.label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: isActive ? '#ffcc44' : '#6688aa',
        backgroundColor: isActive ? '#2a2a1e' : '#1a1a2e',
        padding: { x: 14, y: 8 },
        stroke: '#000000',
        strokeThickness: 1,
      });
      btn.setScrollFactor(0).setDepth(100);
      btn.setInteractive({ useHandCursor: true });
      btn.setData('stanceType', st.type);
      btn.on('pointerdown', () => {
        (this as unknown as Record<string, unknown>).currentStance = st.type;
        const stance = st.type as CombatStance;
        // Apply stance to selected ships only, or all player ships if none selected
        const multiIds = (this as unknown as Record<string, unknown>).selectedShipIds as string[] | null;
        if (multiIds && multiIds.length > 0) {
          for (const id of multiIds) {
            this.tacticalState = setShipStance(this.tacticalState, id, stance);
          }
        } else if (this.selectedShipId) {
          this.tacticalState = setShipStance(this.tacticalState, this.selectedShipId, stance);
        } else {
          const side = this._getPlayerSide();
          this.tacticalState = setShipStance(this.tacticalState, side, stance);
        }
        // Flee stance issues flee orders; all other stances reset orders to idle
        // so the new stance's idle behaviour takes over immediately
        if (st.type === 'flee') {
          if (multiIds && multiIds.length > 0) {
            for (const id of multiIds) {
              const ship = this.tacticalState.ships.find(s => s.id === id);
              if (ship && !ship.destroyed && !ship.routed) {
                this.tacticalState = setShipOrder(this.tacticalState, id, { type: 'flee' });
              }
            }
          } else if (this.selectedShipId) {
            this.tacticalState = setShipOrder(this.tacticalState, this.selectedShipId, { type: 'flee' });
          } else {
            for (const ship of this.tacticalState.ships) {
              if (!ship.destroyed && !ship.routed && this._isPlayerSide(ship)) {
                this.tacticalState = setShipOrder(this.tacticalState, ship.id, { type: 'flee' });
              }
            }
          }
        } else {
          // Reset orders to idle so new stance behaviour takes over
          if (multiIds && multiIds.length > 0) {
            for (const id of multiIds) {
              this.tacticalState = setShipOrder(this.tacticalState, id, { type: 'idle' });
            }
          } else if (this.selectedShipId) {
            this.tacticalState = setShipOrder(this.tacticalState, this.selectedShipId, { type: 'idle' });
          } else {
            for (const ship of this.tacticalState.ships) {
              if (!ship.destroyed && !ship.routed && this._isPlayerSide(ship)) {
                this.tacticalState = setShipOrder(this.tacticalState, ship.id, { type: 'idle' });
              }
            }
          }
        }
        // Update stance button highlighting
        for (const b of this.stanceButtons) {
          const btnType = b.getData('stanceType') as string;
          const active = btnType === st.type;
          b.setColor(active ? '#ffcc44' : '#6688aa');
          b.setBackgroundColor(active ? '#2a2a1e' : '#1a1a2e');
        }
      });
      this.stanceButtons.push(btn);
      stBtnX += btn.width + 8;
    }

    // ── Admiral commands (right side, above retreat) ─────────────────────
    const admiralY = height - 100;
    const admiralX = width - 16;

    this.repairButton = this.add.text(admiralX, admiralY + 28, 'REPAIR', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#6688aa',
      backgroundColor: '#1a1a2e',
      padding: { x: 10, y: 6 },
      stroke: '#000000',
      strokeThickness: 1,
    });
    this.repairButton.setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.repairButton.setInteractive({ useHandCursor: true });
    this.repairButton.on('pointerdown', () => this._admiralRepair());

    this.rallyButton = this.add.text(admiralX, admiralY, 'RALLY', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#6688aa',
      backgroundColor: '#1a1a2e',
      padding: { x: 10, y: 6 },
      stroke: '#000000',
      strokeThickness: 1,
    });
    this.rallyButton.setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.rallyButton.setInteractive({ useHandCursor: true });
    this.rallyButton.on('pointerdown', () => this._admiralRally());

    // Pause count display (next to pause button)
    this.pauseCountLabel = this.add.text(12, 80, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#88aacc',
    });
    this.pauseCountLabel.setScrollFactor(0).setDepth(100);
    this._updateAdmiralHUD();
  }

  private _updateSelectedInfo(): void {
    if (!this.selectedShipId) {
      this.selectedInfoLabel.setText('');
      return;
    }
    // Check for multi-selection (Ctrl+A)
    const multiIds = (this as unknown as Record<string, unknown>).selectedShipIds as string[] | null;
    if (multiIds && multiIds.length > 1) {
      const selected = this.tacticalState.ships.filter(s => multiIds.includes(s.id) && !s.destroyed && !s.routed);
      const avgHull = selected.length > 0 ? Math.round(selected.reduce((sum, s) => sum + (s.hull / s.maxHull) * 100, 0) / selected.length) : 0;
      const avgShields = selected.length > 0 ? Math.round(selected.reduce((sum, s) => sum + (s.maxShields > 0 ? (s.shields / s.maxShields) * 100 : 100), 0) / selected.length) : 0;
      this.selectedInfoLabel.setText(
        `ALL SHIPS SELECTED (${selected.length})  |  Avg Hull: ${avgHull}%  |  Avg Shields: ${avgShields}%  |  Right-click to issue orders`,
      );
      return;
    }

    const ship = this.tacticalState.ships.find(s => s.id === this.selectedShipId);
    if (!ship) {
      this.selectedInfoLabel.setText('');
      return;
    }
    const hpPct = ship.maxHull > 0 ? Math.round((ship.hull / ship.maxHull) * 100) : 0;
    const shPct = ship.maxShields > 0 ? Math.round((ship.shields / ship.maxShields) * 100) : 0;
    const orderStr = ship.order.type === 'attack' ? 'ATTACK'
      : ship.order.type === 'move' ? 'MOVE'
      : ship.order.type === 'flee' ? 'FLEE'
      : ship.order.type === 'defend' ? 'DEFEND'
      : 'IDLE';
    const morale = Math.round(ship.crew.morale);
    const expLabel = ship.crew.experience.toUpperCase();
    this.selectedInfoLabel.setText(
      `${ship.name}  |  Hull: ${hpPct}%  |  Shields: ${shPct}%  |  Morale: ${morale}  [${expLabel}]  |  Order: ${orderStr}`,
    );
  }

  /**
   * Show pre-battle instructions as a React HTML overlay (crisp, zoom-independent).
   * Emits an event for App.tsx to render; listens for the begin signal.
   */
  private _showInstructions(): void {
    this.paused = true;

    // Emit data for the React overlay
    this.game.events.emit('combat:show_instructions', {
      attackerName: this.sceneData.attackerName,
      defenderName: this.sceneData.defenderName,
      attackerColor: this.sceneData.attackerColor,
      defenderColor: this.sceneData.defenderColor,
      attackerShipCount: this.tacticalState.ships.filter(s => s.side === 'attacker').length,
      defenderShipCount: this.tacticalState.ships.filter(s => s.side === 'defender').length,
      battlefieldSize: (this.sceneData as Record<string, unknown>).battlefieldSize ?? 'small',
    });

    // Listen for React to signal "begin battle"
    const beginHandler = () => {
      this.game.events.off('combat:begin_battle', beginHandler);
      this.paused = false;
      if (this.tickTimer) this.tickTimer.paused = false;
    };
    this.game.events.on('combat:begin_battle', beginHandler);
    return;

    // ── Legacy Phaser overlay below (kept for reference, not executed) ──
    const z = this.cameras.main.zoom;
    const width = this.scale.width / z;
    const height = this.scale.height / z;
    const panelW = Math.min(1020, width - 40);
    const panelH = Math.min(740, height - 40);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const allElements: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.graphics();
    overlay.setScrollFactor(0).setDepth(200);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, width, height);
    allElements.push(overlay);

    const panel = this.add.graphics();
    panel.setScrollFactor(0).setDepth(201);
    panel.fillStyle(0x0a1628, 0.97);
    panel.fillRoundedRect(px, py, panelW, panelH, 10);
    panel.lineStyle(2, 0x3388cc, 0.7);
    panel.strokeRoundedRect(px, py, panelW, panelH, 10);
    allElements.push(panel);

    const title = this.add.text(width / 2, py + 22, 'TACTICAL COMBAT', {
      fontFamily: 'monospace', fontSize: '32px', color: '#ff8844',
      stroke: '#000000', strokeThickness: 3,
    });
    title.setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
    allElements.push(title);

    // ── Left column: Controls ──
    const colLeftX = px + 24;
    const colRightX = px + panelW / 2 + 12;
    let curY = py + 58;

    const controlsHead = this.add.text(colLeftX, curY, 'CONTROLS', {
      fontFamily: 'monospace', fontSize: '18px', color: '#44ccff',
      stroke: '#000000', strokeThickness: 2,
    });
    controlsHead.setScrollFactor(0).setDepth(202);
    allElements.push(controlsHead);
    curY += 26;

    const controlLines = [
      'Left-click ship        Select',
      'Left-click space       Move fleet',
      'Right-click enemy      Attack',
      'Right-click space      Move fleet',
      'Ctrl+A                 Select all',
      'H                      Halt fleet',
      'Scroll wheel           Zoom',
      'Shift + drag           Pan',
      'ESC                    Deselect',
    ];
    const controlsText = this.add.text(colLeftX, curY, controlLines.join('\n'), {
      fontFamily: 'monospace', fontSize: '15px', color: '#bbccdd',
      lineSpacing: 7,
    });
    controlsText.setScrollFactor(0).setDepth(202);
    allElements.push(controlsText);

    // ── Right column: Formation & Stance selection ──
    let rightY = py + 58;

    const fmtHead = this.add.text(colRightX, rightY, 'FORMATION', {
      fontFamily: 'monospace', fontSize: '18px', color: '#44ccff',
      stroke: '#000000', strokeThickness: 2,
    });
    fmtHead.setScrollFactor(0).setDepth(202);
    allElements.push(fmtHead);
    rightY += 28;

    let selectedFormation: FormationType = 'line';
    const fmtButtons: Phaser.GameObjects.Text[] = [];
    let fmtBtnX = colRightX;
    for (const fm of FORMATION_TYPES) {
      const isActive = fm.type === selectedFormation;
      const btn = this.add.text(fmtBtnX, rightY, fm.label, {
        fontFamily: 'monospace', fontSize: '14px',
        color: isActive ? '#44ffaa' : '#6688aa',
        backgroundColor: isActive ? '#1a3a2e' : '#1a1a2e',
        padding: { x: 10, y: 6 },
        stroke: '#000000', strokeThickness: 1,
      });
      btn.setScrollFactor(0).setDepth(203);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        selectedFormation = fm.type;
        fmtButtons.forEach((b, i) => {
          const active = FORMATION_TYPES[i]!.type === selectedFormation;
          b.setColor(active ? '#44ffaa' : '#6688aa');
          b.setBackgroundColor(active ? '#1a3a2e' : '#1a1a2e');
        });
      });
      fmtButtons.push(btn);
      allElements.push(btn);
      fmtBtnX += btn.width + 8;
    }
    rightY += 40;

    const stanceHead = this.add.text(colRightX, rightY, 'STANCE', {
      fontFamily: 'monospace', fontSize: '18px', color: '#44ccff',
      stroke: '#000000', strokeThickness: 2,
    });
    stanceHead.setScrollFactor(0).setDepth(202);
    allElements.push(stanceHead);
    rightY += 28;

    let selectedStance = 'aggressive';
    const stanceButtons: Phaser.GameObjects.Text[] = [];
    for (const st of STANCE_TYPES) {
      const isActive = st.type === selectedStance;
      const btn = this.add.text(colRightX, rightY, `${st.label}  ${st.description}`, {
        fontFamily: 'monospace', fontSize: '12px',
        color: isActive ? '#44ffaa' : '#6688aa',
        backgroundColor: isActive ? '#1a3a2e' : '#1a1a2e',
        padding: { x: 10, y: 5 },
        stroke: '#000000', strokeThickness: 1,
      });
      btn.setScrollFactor(0).setDepth(203);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        selectedStance = st.type;
        stanceButtons.forEach((b, i) => {
          const active = STANCE_TYPES[i]!.type === selectedStance;
          b.setColor(active ? '#44ffaa' : '#6688aa');
          b.setBackgroundColor(active ? '#1a3a2e' : '#1a1a2e');
        });
      });
      stanceButtons.push(btn);
      allElements.push(btn);
      rightY += btn.height + 4;
    }

    // ── Bottom: fleet summary + Begin button ──
    const summaryY = py + panelH - 120;
    const fleetInfo = this.add.text(width / 2, summaryY, [
      `${this.sceneData.attackerName}  vs  ${this.sceneData.defenderName}`,
      `Your fleet: ${this.sceneData.attackerShips.length} ships    Enemy: ${this.sceneData.defenderShips.length} ships`,
    ].join('\n'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#88aacc',
      stroke: '#000000', strokeThickness: 2, align: 'center',
    });
    fleetInfo.setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
    allElements.push(fleetInfo);

    const btnW = 300;
    const btnH = 54;
    const btnX = (width - btnW) / 2;
    const btnY = py + panelH - 72;

    const btnBg = this.add.graphics();
    btnBg.setScrollFactor(0).setDepth(202);
    btnBg.fillStyle(0x00aa66, 0.9);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    btnBg.lineStyle(1, 0x44ffaa, 0.5);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    allElements.push(btnBg);

    const btnText = this.add.text(width / 2, btnY + btnH / 2, 'BEGIN BATTLE', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    });
    btnText.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(203);
    allElements.push(btnText);

    const hitZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH);
    hitZone.setScrollFactor(0).setDepth(204);
    hitZone.setInteractive({ useHandCursor: true });
    allElements.push(hitZone);
    hitZone.on('pointerdown', () => {
      // Apply selected formation and stance before battle
      this._setPlayerFormation(selectedFormation);
      // Store stance for future use
      (this as unknown as Record<string, unknown>).currentStance = selectedStance;
      for (const el of allElements) el.destroy();
      this.paused = false;
      this.tickTimer.paused = false;
    });
  }

  // =========================================================================
  // Input
  // =========================================================================

  private _setupInput(): void {
    // Prevent browser context menu on right-click within the game canvas
    this.game.canvas.addEventListener('contextmenu', (e: Event) => {
      e.preventDefault();
    });

    // ESC to deselect and cancel attack-move
    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedShipId = null;
      (this as unknown as Record<string, unknown>).selectedShipIds = null;
      this._cancelAttackMove();
    });

    // H to halt — selected ships stop dead and hold position
    this.input.keyboard?.on('keydown-H', () => {
      this._issueOrder({ type: 'idle' });
    });

    // A to toggle attack-move mode (advance to position whilst engaging enemies)
    this.input.keyboard?.on('keydown-A', (event: KeyboardEvent) => {
      // Ignore if Ctrl/Meta is held (that's select-all)
      if (event.ctrlKey || event.metaKey) return;
      if (!this.selectedShipId) return;
      if (this.attackMoveMode) {
        this._cancelAttackMove();
      } else {
        this.attackMoveMode = true;
        // Show visual feedback label
        const { width } = this.cameras.main;
        this.attackMoveLabel = this.add.text(width / 2, 50, 'ATTACK-MOVE — click to set destination (ESC to cancel)', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ff8844',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
        });
        this.attackMoveLabel.setOrigin(0.5, 0).setScrollFactor(0).setDepth(110);
      }
    });

    // Ctrl+A to select all friendly ships
    // Use CAPTURE phase on window to intercept before browser "select all"
    const ctrlAHandler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const friendlyIds = this.tacticalState?.ships
          ?.filter(s => !s.destroyed && !s.routed && this._isPlayerSide(s))
          .map(s => s.id) ?? [];
        if (friendlyIds.length > 0) {
          this.selectedShipId = friendlyIds[0] ?? null;
          (this as unknown as Record<string, unknown>).selectedShipIds = friendlyIds;
          this._updateSelectedInfo();
        }
      }
    };
    // Capture phase fires before bubbling — intercepts Ctrl+A before the browser
    window.addEventListener('keydown', ctrlAHandler, true);
    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', ctrlAHandler, true);
    });

    // Right-click anywhere in the scene for move/attack orders
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this._handleRightClick(pointer);
        return;
      }

      // Left-click / drag: select, attack, move, or box-select
      if (pointer.leftButtonDown() && !pointer.event.shiftKey) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // Check if clicked on a friendly ship — select it
        for (const ship of this.tacticalState.ships) {
          if (ship.destroyed || ship.routed) continue;
          if (!this._isPlayerSide(ship)) continue;
          const dx = worldPoint.x - ship.position.x;
          const dy = worldPoint.y - ship.position.y;
          if (Math.sqrt(dx * dx + dy * dy) < 30) {
            this.selectedShipId = ship.id;
            (this as unknown as Record<string, unknown>).selectedShipIds = null;
            return;
          }
        }

        // Check if clicked on an enemy ship — attack it
        if (this.selectedShipId) {
          for (const ship of this.tacticalState.ships) {
            if (ship.destroyed || ship.routed) continue;
            if (this._isPlayerSide(ship)) continue;
            const dx = worldPoint.x - ship.position.x;
            const dy = worldPoint.y - ship.position.y;
            if (Math.sqrt(dx * dx + dy * dy) < 30) {
              this._issueOrder({ type: 'attack', targetId: ship.id });
              return;
            }
          }
        }

        // Attack-move: left-click on empty space applies attack-move immediately
        if (this.attackMoveMode && this.selectedShipId) {
          this._applyAttackMove(worldPoint.x, worldPoint.y);
          return;
        }

        // Start drag selection box — will complete on pointerup
        this.dragSelecting = true;
        this.dragStartWorld = { x: worldPoint.x, y: worldPoint.y };
      }
    });

    // Left-click on ship containers for selection
    for (const [, container] of this.shipContainers) {
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) {
          this._handleShipLeftClick(container);
        }
      });
    }
  }

  private _handleShipLeftClick(container: Phaser.GameObjects.Container): void {
    const shipId = container.getData('shipId') as string;
    const ship = this.tacticalState.ships.find(s => s.id === shipId);
    if (!ship) return;

    if (this._isPlayerSide(ship)) {
      // Clicking a friendly ship — select ONLY this ship, clear multi-selection
      this.selectedShipId = shipId;
      (this as unknown as Record<string, unknown>).selectedShipIds = null;
    } else if (this.selectedShipId) {
      // Clicking an enemy ship while we have a selection — attack order
      this._issueOrder({ type: 'attack', targetId: shipId });
    }
  }

  private _handleRightClick(pointer: Phaser.Input.Pointer): void {
    if (!this.selectedShipId) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Check if right-clicked on an enemy ship
    for (const ship of this.tacticalState.ships) {
      if (ship.destroyed || ship.routed) continue;
      if (this._isPlayerSide(ship)) continue;
      const dx = worldPoint.x - ship.position.x;
      const dy = worldPoint.y - ship.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        this._issueOrder({ type: 'attack', targetId: ship.id });
        return;
      }
    }

    // Attack-move: set stance to at_ease then issue move
    if (this.attackMoveMode) {
      this._applyAttackMove(worldPoint.x, worldPoint.y);
      return;
    }

    // Otherwise — move order
    this._issueOrder({ type: 'move', x: worldPoint.x, y: worldPoint.y });
  }

  private _issueOrder(order: ShipOrder): void {
    // If multiple ships selected, issue order to all
    const multiIds = (this as unknown as Record<string, unknown>).selectedShipIds as string[] | null;
    if (multiIds && multiIds.length > 1) {
      // For move orders, use formation offsets so ships advance in formation shape
      if (order.type === 'move') {
        const selectedShips = multiIds
          .map(id => this.tacticalState.ships.find(s => s.id === id))
          .filter((s): s is TacticalShip => !!s && !s.destroyed && !s.routed);
        if (selectedShips.length > 0) {
          // Get the current formation type for the player's side
          const side = this._getPlayerSide();
          const formation = side === 'attacker'
            ? this.tacticalState.attackerFormation
            : this.tacticalState.defenderFormation;

          // Get formation offsets for this many ships
          const positions = getFormationPositions(formation, selectedShips.length);

          for (let i = 0; i < selectedShips.length; i++) {
            const pos = positions[i] ?? { offsetX: 0, offsetY: 0 };
            this.tacticalState = setShipOrder(this.tacticalState, selectedShips[i].id, {
              type: 'move',
              x: order.x! + pos.offsetX,
              y: order.y! + pos.offsetY,
            });
          }
        }
      } else {
        // Attack / flee / idle — same order for all
        for (const id of multiIds) {
          this.tacticalState = setShipOrder(this.tacticalState, id, order);
        }
      }
      return;
    }
    if (!this.selectedShipId) return;
    this.tacticalState = setShipOrder(this.tacticalState, this.selectedShipId, order);
  }

  /** Attack-move: set selected ships to at_ease stance then issue move order. */
  private _applyAttackMove(targetX: number, targetY: number): void {
    // Set at_ease stance on selected ships
    const multiIds = (this as unknown as Record<string, unknown>).selectedShipIds as string[] | null;
    if (multiIds && multiIds.length > 0) {
      for (const id of multiIds) {
        this.tacticalState = setShipStance(this.tacticalState, id, 'at_ease');
      }
    } else if (this.selectedShipId) {
      this.tacticalState = setShipStance(this.tacticalState, this.selectedShipId, 'at_ease');
    }
    // Issue move order (uses offset-preserving logic for multi-ship)
    this._issueOrder({ type: 'move', x: targetX, y: targetY });
    this._cancelAttackMove();
  }

  /** Cancel attack-move mode and remove the HUD label. */
  private _cancelAttackMove(): void {
    this.attackMoveMode = false;
    if (this.attackMoveLabel) {
      this.attackMoveLabel.destroy();
      this.attackMoveLabel = null;
    }
  }

  // =========================================================================
  // Speed / Pause
  // =========================================================================

  private _setSpeed(index: number): void {
    this.speedIndex = index;
    const preset = SPEED_PRESETS[index];
    if (!preset) return;

    // Update tick timer delay
    this.tickTimer.reset({
      delay: preset.msPerTick,
      loop: true,
      callback: () => this._onTick(),
      callbackScope: this,
    });

    if (this.paused) {
      this.tickTimer.paused = true;
    }

    // Update button colours
    for (let i = 0; i < SPEED_PRESETS.length; i++) {
      const btn = this.speedButtons[i];
      if (btn) {
        btn.setColor(i === index ? '#44ffaa' : '#6688aa');
      }
    }
  }

  private _togglePause(): void {
    if (!this.paused) {
      // Pausing — check if admiral has pauses remaining
      const side = this._getPlayerSide();
      const admiral = this.tacticalState.admirals.find((a) => a.side === side);
      if (admiral) {
        const result = admiralPause(this.tacticalState, side);
        if (!result) return; // no pauses remaining — cannot pause
        this.tacticalState = result;
        this._updateAdmiralHUD();
      }
    }
    this.paused = !this.paused;
    this.tickTimer.paused = this.paused;
    this.pauseButton.setColor(this.paused ? '#ff5555' : '#ffcc44');
    this.pauseButton.setText(this.paused ? '>' : '| |');
  }

  // =========================================================================
  // Retreat
  // =========================================================================

  private _retreatAll(): void {
    for (const ship of this.tacticalState.ships) {
      if (this._isPlayerSide(ship) && !ship.destroyed && !ship.routed) {
        this.tacticalState = setShipStance(this.tacticalState, ship.id, 'flee');
        this.tacticalState = setShipOrder(this.tacticalState, ship.id, { type: 'flee' });
      }
    }
  }

  // =========================================================================
  // Formations
  // =========================================================================

  private _getPlayerSide(): 'attacker' | 'defender' {
    return this.sceneData.attackerFleet.empireId === this.sceneData.playerEmpireId
      ? 'attacker'
      : 'defender';
  }

  private _setPlayerFormation(formation: FormationType): void {
    const side = this._getPlayerSide();
    // If ships are selected, apply formation only to those ships
    const multiIds = (this as unknown as Record<string, unknown>).selectedShipIds as string[] | null;
    if (multiIds && multiIds.length > 0) {
      this.tacticalState = setFormation(this.tacticalState, side, formation, multiIds);
    } else {
      this.tacticalState = setFormation(this.tacticalState, side, formation);
    }

    // Update button highlight colours
    for (const btn of this.formationButtons) {
      const btnType = btn.getData('formationType') as FormationType;
      btn.setColor(btnType === formation ? '#44ffaa' : '#6688aa');
    }
  }

  // =========================================================================
  // Admiral commands
  // =========================================================================

  private _admiralRally(): void {
    const side = this._getPlayerSide();
    const admiral = this.tacticalState.admirals.find((a) => a.side === side);
    if (!admiral || admiral.rallyUsed) return;
    this.tacticalState = admiralRally(this.tacticalState, side);
    this.rallyButton.setColor('#333344');
    this._updateAdmiralHUD();
  }

  private _admiralRepair(): void {
    if (!this.selectedShipId) return;
    const side = this._getPlayerSide();
    const admiral = this.tacticalState.admirals.find((a) => a.side === side);
    if (!admiral || admiral.emergencyRepairUsed) return;
    this.tacticalState = admiralEmergencyRepair(this.tacticalState, side, this.selectedShipId);
    this.repairButton.setColor('#333344');
    this._updateAdmiralHUD();
  }

  private _updateAdmiralHUD(): void {
    const side = this._getPlayerSide();
    const admiral = this.tacticalState.admirals.find((a) => a.side === side);
    if (!admiral) {
      this.rallyButton.setVisible(false);
      this.repairButton.setVisible(false);
      this.pauseCountLabel.setText('');
      return;
    }

    this.rallyButton.setVisible(true);
    this.repairButton.setVisible(true);
    this.rallyButton.setColor(admiral.rallyUsed ? '#333344' : '#44ccff');
    this.repairButton.setColor(admiral.emergencyRepairUsed ? '#333344' : '#44ccff');
    this.pauseCountLabel.setText(
      `Admiral: ${admiral.name}  |  Pauses: ${admiral.pausesRemaining}  |  Trait: ${admiral.trait.toUpperCase()}`,
    );
  }

  // =========================================================================
  // Tick loop
  // =========================================================================

  private _onTick(): void {
    if (this.battleEnded) return;

    this.tacticalState = processTacticalTick(this.tacticalState);
    this.tickLabel.setText(`Tick: ${this.tacticalState.tick}`);

    // Trigger weapon sounds for this tick
    this._playCombatSounds();

    // Check for battle end
    this._checkBattleEnd();
  }

  // =========================================================================
  // Combat audio — triggered each tick after tactical processing
  // =========================================================================

  private _playCombatSounds(): void {
    if (!this.sfx) return;

    const state = this.tacticalState;

    // ── New beam effects → beam sounds (max 3 per tick) ───────────────────
    const currentBeamKeys = new Set<string>();
    for (const beam of state.beamEffects) {
      currentBeamKeys.add(`${beam.sourceShipId}→${beam.targetShipId}`);
    }
    let beamSoundsPlayed = 0;
    for (const beam of state.beamEffects) {
      if (beamSoundsPlayed >= 3) break;
      const key = `${beam.sourceShipId}→${beam.targetShipId}`;
      if (this.prevBeamKeys.has(key)) continue; // not a new beam

      const style: BeamStyle = BEAM_STYLE_MAP[beam.componentId ?? ''] ?? 'pulse';
      switch (style) {
        case 'pulse':      this.sfx.playBeamPulse(); break;
        case 'particle':
        case 'radiation':  this.sfx.playBeamParticle(); break;
        case 'disruptor':  this.sfx.playBeamDisruptor(); break;
        case 'plasma':     this.sfx.playBeamPlasma(); break;
      }
      beamSoundsPlayed++;
    }
    this.prevBeamKeys = currentBeamKeys;

    // ── New projectiles → projectile sounds (max 2 per tick) ──────────────
    const newProjectiles = state.projectiles.length - this.prevProjectileCount;
    if (newProjectiles > 0) {
      const projsToPlay = Math.min(newProjectiles, 2);
      // Use the most recently added projectiles for style selection
      const recent = state.projectiles.slice(-newProjectiles);
      for (let i = 0; i < projsToPlay && i < recent.length; i++) {
        const proj = recent[i]!;
        const pStyle = PROJECTILE_STYLE_MAP[proj.componentId ?? ''] ?? 'kinetic';
        switch (pStyle) {
          case 'kinetic':
          case 'fusion':
          case 'battering_ram':  this.sfx.playProjectileKinetic(); break;
          case 'gauss':
          case 'antimatter':
          case 'singularity':    this.sfx.playProjectileGauss(); break;
          case 'mass_driver':    this.sfx.playProjectileMassDriver(); break;
        }
      }
    }
    this.prevProjectileCount = state.projectiles.length;

    // ── New missiles → per-type missile launch sounds (max 2 per tick) ────
    const currentMissileIds = new Set<string>();
    for (const m of (state.missiles ?? [])) {
      currentMissileIds.add(m.id);
    }

    const newMissileCount = state.missiles.length - this.prevMissileCount;
    if (newMissileCount > 0) {
      const recentMissiles = state.missiles.slice(-newMissileCount);
      const launchCount = Math.min(newMissileCount, 2);
      for (let i = 0; i < launchCount && i < recentMissiles.length; i++) {
        const m = recentMissiles[i]!;
        const mStyle: MissileStyle = MISSILE_STYLE_MAP[m.componentId ?? ''] ?? 'torpedo';
        switch (mStyle) {
          case 'basic':       this.sfx.playMissileLaunchRapid(); break;
          case 'torpedo':
          case 'guided':      this.sfx.playMissileLaunch(); break;
          case 'fusion':      this.sfx.playMissileLaunchHeavy(); break;
          case 'antimatter':  this.sfx.playMissileLaunchHeavy(); break;
          case 'singularity': this.sfx.playMissileLaunchSingularity(); break;
        }
      }
    }

    // ── Missile impacts — missiles that vanished since last tick ──────────
    // Point defence interceptions are handled separately, so any missile
    // that disappeared without a PD effect is an impact.
    let impactCount = 0;
    for (const prevId of this.prevMissileIds) {
      if (impactCount >= 2) break;
      if (!currentMissileIds.has(prevId)) {
        impactCount++;
      }
    }
    if (impactCount > 0) {
      this.sfx.playMissileImpact();
    }

    this.prevMissileCount = state.missiles.length;
    this.prevMissileIds = currentMissileIds;

    // ── Point defence effects → PD burst (max 2 per tick) ─────────────────
    const pdEffects = state.pointDefenceEffects ?? [];
    const newPd = pdEffects.filter(pd => pd.ticksRemaining === 2); // freshly created
    if (newPd.length > 0) {
      const pdCount = Math.min(newPd.length, 2);
      for (let i = 0; i < pdCount; i++) {
        this.sfx.playPointDefence();
      }
    }

    // ── Fighters → occasional buzz (max 1 per tick, every 10th tick) ──────
    const fighters = state.fighters ?? [];
    if (fighters.length > 0 && state.tick % 10 === 0) {
      this.sfx.playFighterBuzz();
    }

    // ── Shield hits → shield sound (max 2 per tick) ───────────────────────
    let shieldHits = 0;
    for (const ship of state.ships) {
      if (shieldHits >= 2) break;
      if (ship.maxShields <= 0) continue;
      const prev = this.prevShields.get(ship.id) ?? ship.shields;
      if (ship.shields < prev) {
        this.sfx.playShieldHit();
        shieldHits++;
      }
    }

    // ── Destroyed ships → explosion ───────────────────────────────────────
    for (const ship of state.ships) {
      if (ship.destroyed && !this.prevDestroyed.has(ship.id)) {
        this.sfx.playCombatExplosion();
        // Note: prevDestroyed is updated in _updateShipVisuals, no need to add here
        break; // only one explosion sound per tick to avoid cacophony
      }
    }

    // Update shield tracking for next tick
    for (const ship of state.ships) {
      this.prevShields.set(ship.id, ship.shields);
    }
  }

  private _checkBattleEnd(): void {
    if (this.tacticalState.outcome === null) return;

    // Battle is over
    this.battleEnded = true;
    this.tickTimer.paused = true;

    // Show the full battle summary overlay instead of a simple label
    this._showBattleSummary();
  }

  // =========================================================================
  // Post-battle summary overlay
  // =========================================================================

  private _showBattleSummary(): void {
    // Divide screen coords by zoom so overlay renders at screen-pixel size
    const z = this.cameras.main.zoom;
    const width = this.scale.width / z;
    const height = this.scale.height / z;
    const allElements: Phaser.GameObjects.GameObject[] = [];

    const playerIsAttacker =
      this.sceneData.attackerFleet.empireId === this.sceneData.playerEmpireId;
    const playerWon = playerIsAttacker
      ? this.tacticalState.outcome === 'attacker_wins'
      : this.tacticalState.outcome === 'defender_wins';

    // --- Classify ships by side ---
    const playerShips = this.tacticalState.ships.filter(s => this._isPlayerSide(s));
    const enemyShips = this.tacticalState.ships.filter(s => !this._isPlayerSide(s));
    const playerSurvived = playerShips.filter(s => !s.destroyed && !s.routed);
    const playerDestroyed = playerShips.filter(s => s.destroyed);
    const enemySurvived = enemyShips.filter(s => !s.destroyed && !s.routed);
    const enemyDestroyed = enemyShips.filter(s => s.destroyed);

    // --- Determine battle result label ---
    let resultText: string;
    let resultColor: string;
    if (playerDestroyed.length === playerShips.length && enemyDestroyed.length === enemyShips.length) {
      resultText = 'MUTUAL DESTRUCTION';
      resultColor = '#ff8844';
    } else if (playerWon && playerDestroyed.length > playerShips.length * 0.6) {
      resultText = 'PYRRHIC VICTORY';
      resultColor = '#ddaa44';
    } else if (playerWon) {
      resultText = 'VICTORY';
      resultColor = '#44ff88';
    } else {
      resultText = 'DEFEAT';
      resultColor = '#ff4444';
    }

    // --- Experience calculations for surviving player ships ---
    const xpGains = new Map<string, { from: CrewExperience; to: CrewExperience }>();
    for (const ship of playerSurvived) {
      const newXp = calculateExperienceGain(
        ship,
        playerWon,
        enemyShips.length,
        playerShips.length,
      );
      if (newXp !== ship.crew.experience) {
        xpGains.set(ship.id, { from: ship.crew.experience, to: newXp });
      }
    }

    // --- Panel sizing ---
    const panelW = Math.min(820, width - 40);
    const panelH = Math.min(640, height - 40);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    // --- Dark overlay ---
    const overlay = this.add.graphics();
    overlay.setScrollFactor(0).setDepth(200);
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, width, height);
    allElements.push(overlay);

    // --- Panel background ---
    const panel = this.add.graphics();
    panel.setScrollFactor(0).setDepth(201);
    panel.fillStyle(0x0a1628, 0.97);
    panel.fillRoundedRect(px, py, panelW, panelH, 10);
    panel.lineStyle(2, 0x3388cc, 0.7);
    panel.strokeRoundedRect(px, py, panelW, panelH, 10);
    allElements.push(panel);

    // --- Title ---
    const title = this.add.text(width / 2, py + 20, 'BATTLE SUMMARY', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ff8844',
      stroke: '#000000', strokeThickness: 3,
    });
    title.setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
    allElements.push(title);

    // --- Result label ---
    const resultLabel = this.add.text(width / 2, py + 56, resultText, {
      fontFamily: 'monospace', fontSize: '22px', color: resultColor,
      stroke: '#000000', strokeThickness: 2,
    });
    resultLabel.setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
    allElements.push(resultLabel);

    // --- Two-column layout ---
    const colLeftX = px + 20;
    const colRightX = px + panelW / 2 + 10;
    const colW = panelW / 2 - 30;
    let leftY = py + 94;
    let rightY = py + 94;

    // ── YOUR FLEET column ─────────────────────────────────────────────────
    const yourHead = this.add.text(colLeftX, leftY, 'YOUR FLEET', {
      fontFamily: 'monospace', fontSize: '16px', color: '#44ccff',
      stroke: '#000000', strokeThickness: 2,
    });
    yourHead.setScrollFactor(0).setDepth(202);
    allElements.push(yourHead);
    leftY += 24;

    // Surviving player ships with hull bars, shields, morale, XP
    for (const ship of playerSurvived) {
      const hullPct = Math.round((ship.hull / ship.maxHull) * 100);
      const shieldPct = ship.maxShields > 0
        ? Math.round((ship.shields / ship.maxShields) * 100)
        : -1;

      // Ship name
      const hullColor = hullPct >= 80 ? '#44ff88' : hullPct >= 30 ? '#ffcc44' : '#ff4444';
      const nameLabel = this.add.text(colLeftX + 4, leftY, ship.name, {
        fontFamily: 'monospace', fontSize: '12px', color: '#ccddee',
      });
      nameLabel.setScrollFactor(0).setDepth(202);
      allElements.push(nameLabel);
      leftY += 16;

      // Hull bar
      const barWidth = Math.min(colW - 8, 180);
      const barGfx = this.add.graphics();
      barGfx.setScrollFactor(0).setDepth(202);
      barGfx.fillStyle(0x1a1a2e, 1);
      barGfx.fillRect(colLeftX + 4, leftY, barWidth, 8);
      const hullFillColor = hullPct >= 80 ? 0x44ff88 : hullPct >= 30 ? 0xffcc44 : 0xff4444;
      barGfx.fillStyle(hullFillColor, 1);
      barGfx.fillRect(colLeftX + 4, leftY, barWidth * (hullPct / 100), 8);
      allElements.push(barGfx);

      const hullLabel = this.add.text(colLeftX + barWidth + 10, leftY - 2, `Hull ${hullPct}%`, {
        fontFamily: 'monospace', fontSize: '10px', color: hullColor,
      });
      hullLabel.setScrollFactor(0).setDepth(202);
      allElements.push(hullLabel);
      leftY += 12;

      // Status line: shields + morale
      const parts: string[] = [];
      if (shieldPct >= 0) parts.push(`Shields ${shieldPct}%`);
      parts.push(`Morale ${Math.round(ship.crew.morale)}%`);
      const statusLabel = this.add.text(colLeftX + 4, leftY, parts.join('  |  '), {
        fontFamily: 'monospace', fontSize: '10px', color: '#88aacc',
      });
      statusLabel.setScrollFactor(0).setDepth(202);
      allElements.push(statusLabel);
      leftY += 14;

      // XP gain line
      const xp = xpGains.get(ship.id);
      if (xp) {
        const xpLabel = this.add.text(
          colLeftX + 4, leftY,
          `Crew: ${_capitalise(xp.from)} \u2192 ${_capitalise(xp.to)}`,
          { fontFamily: 'monospace', fontSize: '10px', color: '#ffdd66' },
        );
        xpLabel.setScrollFactor(0).setDepth(202);
        allElements.push(xpLabel);
        leftY += 14;
      }

      leftY += 4; // gap between ships
    }

    // Destroyed player ships
    if (playerDestroyed.length > 0) {
      leftY += 4;
      const lossHead = this.add.text(colLeftX, leftY, 'LOSSES', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ff6666',
        stroke: '#000000', strokeThickness: 1,
      });
      lossHead.setScrollFactor(0).setDepth(202);
      allElements.push(lossHead);
      leftY += 18;

      for (const ship of playerDestroyed) {
        const lossLabel = this.add.text(colLeftX + 4, leftY, `\u2620 ${ship.name}`, {
          fontFamily: 'monospace', fontSize: '11px', color: '#cc4444',
        });
        lossLabel.setScrollFactor(0).setDepth(202);
        allElements.push(lossLabel);
        leftY += 16;
      }
    }

    // ── ENEMY FLEET column ────────────────────────────────────────────────
    const enemyHead = this.add.text(colRightX, rightY, 'ENEMY FLEET', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ff6666',
      stroke: '#000000', strokeThickness: 2,
    });
    enemyHead.setScrollFactor(0).setDepth(202);
    allElements.push(enemyHead);
    rightY += 24;

    // Enemy summary counts
    const enemySummary = this.add.text(colRightX + 4, rightY,
      `Ships engaged: ${enemyShips.length}\n` +
      `Destroyed:     ${enemyDestroyed.length}\n` +
      `Survived:      ${enemySurvived.length}`,
      { fontFamily: 'monospace', fontSize: '12px', color: '#ccbbaa', lineSpacing: 4 },
    );
    enemySummary.setScrollFactor(0).setDepth(202);
    allElements.push(enemySummary);
    rightY += 56;

    // Surviving enemy ships
    if (enemySurvived.length > 0) {
      const eHead = this.add.text(colRightX, rightY, 'SURVIVING', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ff9966',
        stroke: '#000000', strokeThickness: 1,
      });
      eHead.setScrollFactor(0).setDepth(202);
      allElements.push(eHead);
      rightY += 18;

      for (const ship of enemySurvived) {
        const hullPct = Math.round((ship.hull / ship.maxHull) * 100);
        const hullColor = hullPct >= 80 ? '#44ff88' : hullPct >= 30 ? '#ffcc44' : '#ff4444';
        const eLine = this.add.text(colRightX + 4, rightY,
          `${ship.name}  Hull ${hullPct}%`,
          { fontFamily: 'monospace', fontSize: '11px', color: hullColor },
        );
        eLine.setScrollFactor(0).setDepth(202);
        allElements.push(eLine);
        rightY += 16;
      }
    }

    // Destroyed enemy ships
    if (enemyDestroyed.length > 0) {
      rightY += 4;
      const eLossHead = this.add.text(colRightX, rightY, 'DESTROYED', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ff6666',
        stroke: '#000000', strokeThickness: 1,
      });
      eLossHead.setScrollFactor(0).setDepth(202);
      allElements.push(eLossHead);
      rightY += 18;

      for (const ship of enemyDestroyed) {
        const eLoss = this.add.text(colRightX + 4, rightY, `\u2620 ${ship.name}`, {
          fontFamily: 'monospace', fontSize: '11px', color: '#cc4444',
        });
        eLoss.setScrollFactor(0).setDepth(202);
        allElements.push(eLoss);
        rightY += 16;
      }
    }

    // ── Damage assessment ─────────────────────────────────────────────────
    const damagedShips = playerSurvived.filter(s => (s.hull / s.maxHull) < 0.8);
    const criticalShips = playerSurvived.filter(s => (s.hull / s.maxHull) < 0.3);

    if (damagedShips.length > 0) {
      const assessY = Math.max(leftY, rightY) + 8;
      const divider = this.add.graphics();
      divider.setScrollFactor(0).setDepth(202);
      divider.lineStyle(1, 0x3388cc, 0.4);
      divider.lineBetween(px + 20, assessY, px + panelW - 20, assessY);
      allElements.push(divider);

      const assessHead = this.add.text(px + 20, assessY + 6, 'DAMAGE ASSESSMENT', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffaa44',
        stroke: '#000000', strokeThickness: 1,
      });
      assessHead.setScrollFactor(0).setDepth(202);
      allElements.push(assessHead);

      const repairLines = damagedShips.map(s => {
        const pct = Math.round((s.hull / s.maxHull) * 100);
        const tag = (s.hull / s.maxHull) < 0.3 ? ' [CRITICAL]' : '';
        return `  ${s.name}: ${pct}% hull${tag}`;
      });
      const assessText = this.add.text(px + 20, assessY + 24,
        `${damagedShips.length} ship${damagedShips.length > 1 ? 's' : ''} requiring repairs` +
        (criticalShips.length > 0 ? ` (${criticalShips.length} critical)` : '') +
        '\n' + repairLines.join('\n'),
        { fontFamily: 'monospace', fontSize: '11px', color: '#ccbbaa', lineSpacing: 3 },
      );
      assessText.setScrollFactor(0).setDepth(202);
      allElements.push(assessText);
    }

    // ── Continue button ───────────────────────────────────────────────────
    const btnW = 260;
    const btnH = 48;
    const btnX = (width - btnW) / 2;
    const btnY = py + panelH - 64;

    const btnBg = this.add.graphics();
    btnBg.setScrollFactor(0).setDepth(202);
    btnBg.fillStyle(0x00aa66, 0.9);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    btnBg.lineStyle(1, 0x44ffaa, 0.5);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    allElements.push(btnBg);

    const btnText = this.add.text(width / 2, btnY + btnH / 2, 'CONTINUE', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    });
    btnText.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(203);
    allElements.push(btnText);

    const hitZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH);
    hitZone.setScrollFactor(0).setDepth(204);
    hitZone.setInteractive({ useHandCursor: true });
    allElements.push(hitZone);
    hitZone.on('pointerdown', () => {
      for (const el of allElements) el.destroy();
      this._transitionAfterBattle();
    });
  }

  /**
   * Handle scene transition after the player dismisses the battle summary.
   * Delegates to ground combat if applicable, otherwise returns to the galaxy map.
   */
  private _transitionAfterBattle(): void {
    // If attacker won a planetary assault, transition to ground combat
    if (
      this.tacticalState.outcome === 'attacker_wins' &&
      this.tacticalState.layout === 'planetary_assault' &&
      this.tacticalState.planetData
    ) {
      this.game.events.emit('combat:tactical_complete', this.tacticalState);

      const survivingAttackers = this.tacticalState.ships.filter(
        s => s.side === 'attacker' && !s.destroyed,
      );
      const attackerHullClasses: HullClass[] = [];
      for (const ts of survivingAttackers) {
        const sourceShip = this.sceneData.attackerShips.find(s => s.id === ts.sourceShipId);
        if (sourceShip) {
          const design = this.sceneData.designs.get(sourceShip.designId);
          if (design) {
            attackerHullClasses.push(design.hull);
          }
        }
      }

      const groundData: GroundCombatSceneData = {
        planetName: this.tacticalState.planetData.name,
        planetType: this.tacticalState.planetData.type,
        attackerHullClasses,
        defenderPopulation: 10000, // Default — will be populated from planet data in future
        defenderBuildings: [],
        attackerExperience: 'regular',
        defenderExperience: 'green',
        attackerEmpireId: this.sceneData.attackerFleet.empireId,
        defenderEmpireId: this.sceneData.defenderFleet.empireId,
        playerEmpireId: this.sceneData.playerEmpireId,
        attackerColor: this.sceneData.attackerColor,
        defenderColor: this.sceneData.defenderColor,
        attackerName: this.sceneData.attackerName,
        defenderName: this.sceneData.defenderName,
      };

      this.scene.start('GroundCombatScene', groundData);
      return;
    }

    this.game.events.emit('combat:tactical_complete', this.tacticalState);
    this.scene.start('GalaxyMapScene', {});
  }
}

// ---------------------------------------------------------------------------
// Utility — capitalise first letter of a crew experience level
// ---------------------------------------------------------------------------
function _capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
