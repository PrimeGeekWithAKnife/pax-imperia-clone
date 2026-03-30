import Phaser from 'phaser';
import type { Fleet, Ship, ShipDesign, ShipComponent, HullClass } from '@nova-imperia/shared';
import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  setFormation,
  admiralRally,
  admiralEmergencyRepair,
  admiralPause,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '@nova-imperia/shared';
import { renderShipIcon } from '../../assets/graphics/ShipGraphics';
import type { TacticalState, TacticalShip, ShipOrder, TacticalOutcome, FormationType, Admiral, CombatLayout, PlanetData } from '@nova-imperia/shared';
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

/** Projectile dot radius */
const PROJECTILE_RADIUS = 5;
const PROJECTILE_COLOR = 0xffaa22;

/** Missile visual constants */
const MISSILE_SIZE = 8;
const MISSILE_COLOR = 0xff6633;
const MISSILE_TRAIL_COLOR = 0xff4400;
const MISSILE_TRAIL_ALPHA = 0.45;
const MISSILE_TRAIL_LENGTH = 16;

/** Fighter visual constants */
const FIGHTER_RADIUS = 4;
const FIGHTER_JITTER = 4; // random visual offset for swarming effect

/** Point defence visual constants */
const PD_COLOR = 0xffffff;
const PD_ALPHA = 0.85;

/** Beam colours */
const BEAM_COLOR_FRIENDLY = 0x44ff88;
const BEAM_COLOR_ENEMY = 0xff4444;

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
  { label: 'AGGRESSIVE', type: 'aggressive', description: 'Maximum damage, close range' },
  { label: 'DEFENSIVE', type: 'defensive', description: 'Hold position, prioritise survival' },
  { label: 'FLANKING', type: 'flanking', description: 'Outmanoeuvre, target weak sides' },
  { label: 'EVASIVE', type: 'evasive', description: 'Minimise losses, maintain distance' },
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
  private battleEnded = false;
  private paused = false;

  /** Currently selected friendly TacticalShip id (or null) */
  private selectedShipId: string | null = null;

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
  private beamGraphics!: Phaser.GameObjects.Graphics;
  private projectileGraphics!: Phaser.GameObjects.Graphics;
  private missileGraphics!: Phaser.GameObjects.Graphics;
  private pdGraphics!: Phaser.GameObjects.Graphics;
  private environmentGraphics!: Phaser.GameObjects.Graphics;
  /** Track which debris IDs we have already drawn (static once spawned). */
  private drawnDebrisIds = new Set<string>();
  private fighterGraphics!: Phaser.GameObjects.Graphics;
  private healthBarGraphics!: Phaser.GameObjects.Graphics;
  /** Cached ship size per ship id (computed once at creation). */
  private shipSizes = new Map<string, { base: number; height: number }>();

  // ── HUD elements ───────────────────────────────────────────────────────────
  private tickLabel!: Phaser.GameObjects.Text;
  private selectedInfoLabel!: Phaser.GameObjects.Text;
  private speedButtons: Phaser.GameObjects.Text[] = [];
  private pauseButton!: Phaser.GameObjects.Text;
  private formationButtons: Phaser.GameObjects.Text[] = [];
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
    );

    // Track initial hull values for damage detection
    for (const ship of this.tacticalState.ships) {
      this.prevHull.set(ship.id, ship.hull);
    }

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

    // ── Environment graphics (asteroids, nebulae, debris) ──────────────────
    this.environmentGraphics = this.add.graphics();
    this.environmentGraphics.setDepth(1); // just above starfield
    this.drawnDebrisIds.clear();
    this._drawEnvironment();

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

    // Subtle grid lines for spatial reference
    gfx.lineStyle(1, 0x1a1a3a, 0.25);
    for (let x = 0; x <= BATTLEFIELD_WIDTH; x += 200) {
      gfx.lineBetween(x, 0, x, BATTLEFIELD_HEIGHT);
    }
    for (let y = 0; y <= BATTLEFIELD_HEIGHT; y += 200) {
      gfx.lineBetween(0, y, BATTLEFIELD_WIDTH, y);
    }

    // Stars — brighter and larger than before
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = Phaser.Math.FloatBetween(0, BATTLEFIELD_WIDTH);
      const y = Phaser.Math.FloatBetween(0, BATTLEFIELD_HEIGHT);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.6);
      const radius = Phaser.Math.FloatBetween(0.5, 1.5);
      gfx.fillStyle(0xffffff, alpha);
      gfx.fillCircle(x, y, radius);
    }

    // ── Double boundary (Total War style) ──────────────────────────────────
    // Outer amber warning zone: "you're approaching the edge"
    const wm = BOUNDARY_WARNING_MARGIN;
    gfx.lineStyle(2, 0xf59e0b, 0.35);
    gfx.strokeRect(wm, wm, BATTLEFIELD_WIDTH - wm * 2, BATTLEFIELD_HEIGHT - wm * 2);
    // Dashed amber fill on the warning strip
    gfx.fillStyle(0xf59e0b, 0.04);
    gfx.fillRect(0, 0, BATTLEFIELD_WIDTH, wm); // top
    gfx.fillRect(0, BATTLEFIELD_HEIGHT - wm, BATTLEFIELD_WIDTH, wm); // bottom
    gfx.fillRect(0, wm, wm, BATTLEFIELD_HEIGHT - wm * 2); // left
    gfx.fillRect(BATTLEFIELD_WIDTH - wm, wm, wm, BATTLEFIELD_HEIGHT - wm * 2); // right

    // Inner red flee zone: "past here you are fleeing the battle"
    const fm = BOUNDARY_FLEE_MARGIN;
    gfx.lineStyle(2, 0xef4444, 0.5);
    gfx.strokeRect(fm, fm, BATTLEFIELD_WIDTH - fm * 2, BATTLEFIELD_HEIGHT - fm * 2);
    gfx.fillStyle(0xef4444, 0.06);
    gfx.fillRect(0, 0, BATTLEFIELD_WIDTH, fm);
    gfx.fillRect(0, BATTLEFIELD_HEIGHT - fm, BATTLEFIELD_WIDTH, fm);
    gfx.fillRect(0, fm, fm, BATTLEFIELD_HEIGHT - fm * 2);
    gfx.fillRect(BATTLEFIELD_WIDTH - fm, fm, fm, BATTLEFIELD_HEIGHT - fm * 2);

    // Labels on the boundary zones
    const warningLabel = this.add.text(BATTLEFIELD_WIDTH / 2, wm / 2, 'WARNING ZONE — Turn back or your fleet will flee', {
      fontFamily: 'monospace', fontSize: '10px', color: '#f59e0b', alpha: 0.5,
    });
    warningLabel.setOrigin(0.5, 0.5).setDepth(1);

    const fleeLabel = this.add.text(BATTLEFIELD_WIDTH / 2, fm / 2, 'FLEE ZONE', {
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

  private _setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(
      -MARGIN,
      -MARGIN,
      BATTLEFIELD_WIDTH + MARGIN * 2,
      BATTLEFIELD_HEIGHT + MARGIN * 2,
    );

    // Fit battlefield into view
    const { width, height } = this.scale;
    const scaleX = width / (BATTLEFIELD_WIDTH + MARGIN * 2);
    const scaleY = height / (BATTLEFIELD_HEIGHT + MARGIN * 2);
    const fitZoom = Math.min(scaleX, scaleY);
    cam.setZoom(fitZoom);
    cam.centerOn(BATTLEFIELD_WIDTH / 2, BATTLEFIELD_HEIGHT / 2);

    // Zoom with scroll wheel — prevent browser zoom
    this.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
    }, { passive: false });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom + (dy > 0 ? -0.05 : 0.05), 0.3, 2.0);
      cam.setZoom(newZoom);
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

    this.input.on('pointerup', () => {
      dragging = false;
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
    if (ship.maxHull < 30) return 'deep_space_probe';
    if (ship.maxHull < 60) return 'scout';
    if (ship.maxHull < 120) return 'destroyer';
    if (ship.maxHull < 250) return 'cruiser';
    if (ship.maxHull < 450) return 'battleship';
    return 'dreadnought';
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
      const texKey = `ship_${hullClass}_${ship.side}_${iconPx}`;

      if (!this.textures.exists(texKey)) {
        const dataUrl = renderShipIcon(hullClass, iconPx, colorHex);
        if (dataUrl && dataUrl.startsWith('data:')) {
          // Load as texture from data URL
          const img = new Image();
          img.src = dataUrl;
          img.onload = () => {
            if (!this.textures.exists(texKey)) {
              this.textures.addImage(texKey, img);
            }
            // Update the sprite once loaded
            const existing = container.getByName('shipSprite') as Phaser.GameObjects.Sprite | null;
            if (existing) {
              existing.setTexture(texKey);
              existing.setVisible(true);
            }
          };
        }
      }

      // Create sprite (may show immediately if texture cached, or after load)
      if (this.textures.exists(texKey)) {
        const sprite = this.add.sprite(0, 0, texKey);
        sprite.setName('shipSprite');
        // ShipGraphics renders nose-up; combat scene faces right (+x)
        // Rotate the sprite -90deg so nose points in the +x direction
        sprite.setAngle(-90);
        sprite.setDisplaySize(iconPx, iconPx);
        container.add(sprite);
      } else {
        // Placeholder triangle until icon loads
        const gfx = this.add.graphics();
        const color = this._shipColor(ship);
        gfx.fillStyle(color, 1);
        gfx.beginPath();
        gfx.moveTo(height / 2, 0);
        gfx.lineTo(-height / 2, -base / 2);
        gfx.lineTo(-height / 2, base / 2);
        gfx.closePath();
        gfx.fillPath();
        gfx.lineStyle(1.5, 0xffffff, 0.5);
        gfx.beginPath();
        gfx.moveTo(height / 2, 0);
        gfx.lineTo(-height / 2, -base / 2);
        gfx.lineTo(-height / 2, base / 2);
        gfx.closePath();
        gfx.strokePath();
        container.add(gfx);

        // Create a hidden sprite that will show when texture loads
        const placeholder = this.add.sprite(0, 0, '__DEFAULT');
        placeholder.setName('shipSprite');
        placeholder.setAngle(-90);
        placeholder.setDisplaySize(iconPx, iconPx);
        placeholder.setVisible(false);
        container.add(placeholder);
      }

      // Hull class label above the ship
      const classLabel = this.add.text(0, -iconPx / 2 - 6, hullClass.replace(/_/g, ' ').toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#88aaccaa',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 1,
      });
      classLabel.setOrigin(0.5, 1).setAngle(-Phaser.Math.RadToDeg(ship.facing));
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
      label.setOrigin(0.5, 0);
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
    for (const beam of this.tacticalState.beamEffects) {
      const source = this.tacticalState.ships.find(s => s.id === beam.sourceShipId);
      const target = this.tacticalState.ships.find(s => s.id === beam.targetShipId);
      if (!source || !target) continue;
      const alpha = Math.max(0.3, beam.ticksRemaining / 3);
      const color = this._isPlayerSide(source) ? BEAM_COLOR_FRIENDLY : BEAM_COLOR_ENEMY;
      this.beamGraphics.lineStyle(3, color, alpha);
      this.beamGraphics.lineBetween(
        source.position.x, source.position.y,
        target.position.x, target.position.y,
      );
    }
  }

  private _drawProjectiles(): void {
    this.projectileGraphics.clear();
    for (const proj of this.tacticalState.projectiles) {
      // Colour projectiles by faction so players can tell who fired what
      const source = this.tacticalState.ships.find(s => s.id === proj.sourceShipId);
      const color = source && this._isPlayerSide(source) ? 0x44ddff : PROJECTILE_COLOR;
      this.projectileGraphics.fillStyle(color, 0.9);
      this.projectileGraphics.fillCircle(proj.position.x, proj.position.y, PROJECTILE_RADIUS);
    }
  }

  /** Draw missiles as small red/orange triangles with a faint trail. */
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

      // Faint trail behind the missile
      const trailX = missile.x - Math.cos(heading) * MISSILE_TRAIL_LENGTH;
      const trailY = missile.y - Math.sin(heading) * MISSILE_TRAIL_LENGTH;
      this.missileGraphics.lineStyle(1.5, MISSILE_TRAIL_COLOR, MISSILE_TRAIL_ALPHA);
      this.missileGraphics.lineBetween(trailX, trailY, missile.x, missile.y);

      // Triangle pointing in heading direction
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      const noseX = missile.x + cos * MISSILE_SIZE;
      const noseY = missile.y + sin * MISSILE_SIZE;
      const leftX = missile.x + (-cos * MISSILE_SIZE * 0.5 - sin * MISSILE_SIZE * 0.4);
      const leftY = missile.y + (-sin * MISSILE_SIZE * 0.5 + cos * MISSILE_SIZE * 0.4);
      const rightX = missile.x + (-cos * MISSILE_SIZE * 0.5 + sin * MISSILE_SIZE * 0.4);
      const rightY = missile.y + (-sin * MISSILE_SIZE * 0.5 - cos * MISSILE_SIZE * 0.4);

      this.missileGraphics.fillStyle(MISSILE_COLOR, 0.95);
      this.missileGraphics.beginPath();
      this.missileGraphics.moveTo(noseX, noseY);
      this.missileGraphics.lineTo(leftX, leftY);
      this.missileGraphics.lineTo(rightX, rightY);
      this.missileGraphics.closePath();
      this.missileGraphics.fillPath();
    }
  }

  /** Draw point defence intercept lines as brief thin white lines. */
  private _drawPointDefence(): void {
    this.pdGraphics.clear();
    for (const pd of (this.tacticalState.pointDefenceEffects ?? [])) {
      const ship = this.tacticalState.ships.find(s => s.id === pd.shipId);
      if (!ship) continue;
      const alpha = (pd.ticksRemaining / 2) * PD_ALPHA;
      this.pdGraphics.lineStyle(2, PD_COLOR, alpha);
      this.pdGraphics.lineBetween(
        ship.position.x, ship.position.y,
        pd.missileX, pd.missileY,
      );
    }
  }

  /** Draw fighters as tiny coloured dots swarming around their targets. */
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
      this.fighterGraphics.fillStyle(color, 0.9);
      this.fighterGraphics.fillCircle(
        fighter.x + jitterX,
        fighter.y + jitterY,
        FIGHTER_RADIUS,
      );
    }
  }

  /**
   * Draw environment features: asteroids (grey jagged circles), nebulae
   * (large semi-transparent coloured circles), and debris (small dark orange
   * scattered dots that appear when ships explode).
   */
  private _drawEnvironment(): void {
    this.environmentGraphics.clear();
    const features = this.tacticalState.environment ?? [];

    for (const f of features) {
      switch (f.type) {
        case 'asteroid': {
          // Grey irregular circle — draw a jagged polygon
          this.environmentGraphics.fillStyle(ASTEROID_COLOR, ASTEROID_ALPHA);
          this.environmentGraphics.beginPath();
          const segments = 10;
          for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Vary radius by +/-30% for a jagged look (deterministic from position)
            const variation = 0.7 + 0.6 * ((Math.sin(f.x * 7 + i * 13) + 1) / 2);
            const r = f.radius * variation;
            const px = f.x + Math.cos(angle) * r;
            const py = f.y + Math.sin(angle) * r;
            if (i === 0) {
              this.environmentGraphics.moveTo(px, py);
            } else {
              this.environmentGraphics.lineTo(px, py);
            }
          }
          this.environmentGraphics.closePath();
          this.environmentGraphics.fillPath();
          break;
        }

        case 'nebula': {
          // Large semi-transparent coloured circle
          this.environmentGraphics.fillStyle(NEBULA_COLOR, NEBULA_ALPHA);
          this.environmentGraphics.fillCircle(f.x, f.y, f.radius);
          break;
        }

        case 'debris': {
          // Small dark orange scattered dots
          for (let i = 0; i < DEBRIS_DOT_COUNT; i++) {
            // Deterministic scatter from the debris id hash
            const angle = (i / DEBRIS_DOT_COUNT) * Math.PI * 2 + f.x * 0.01;
            const r = f.radius * (0.3 + 0.7 * ((Math.sin(f.y * 3 + i * 7) + 1) / 2));
            const dx = f.x + Math.cos(angle) * r;
            const dy = f.y + Math.sin(angle) * r;
            this.environmentGraphics.fillStyle(DEBRIS_COLOR, DEBRIS_DOT_ALPHA);
            this.environmentGraphics.fillCircle(dx, dy, DEBRIS_DOT_RADIUS);
          }
          break;
        }
      }
    }
  }

  private _drawSelectionRing(): void {
    this.selectionRing.clear();
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
    const { width, height } = this.scale;

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
    const barY = height - 52;
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
      btn.on('pointerdown', () => {
        (this as unknown as Record<string, unknown>).currentStance = st.type;
        // If FLEE stance selected, issue flee orders to all friendly ships
        if (st.type === 'flee') {
          for (const ship of this.tacticalState.ships) {
            if (!ship.destroyed && !ship.routed && this._isPlayerSide(ship)) {
              this.tacticalState = setShipOrder(this.tacticalState, ship.id, { type: 'flee' });
            }
          }
        }
      });
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
   * Show a semi-transparent instructions panel at the start of combat.
   * Pauses the battle until the player clicks "Begin Battle".
   */
  private _showInstructions(): void {
    this.paused = true;
    const { width, height } = this.scale;
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
      'Left-click enemy       Attack',
      'Right-click space      Move',
      'Right-click enemy      Attack',
      'Ctrl+A                 Select all',
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

    // ESC to deselect
    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedShipId = null;
      (this as unknown as Record<string, unknown>).selectedShipIds = null;
    });

    // Ctrl+A to select all friendly ships — use canvas-level native listener
    // because Phaser keyboard events don't reliably pass modifier keys
    const ctrlAHandler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        event.stopPropagation();
        const friendlyIds = this.tacticalState?.ships
          ?.filter(s => !s.destroyed && !s.routed && this._isPlayerSide(s))
          .map(s => s.id) ?? [];
        if (friendlyIds.length > 0) {
          this.selectedShipId = friendlyIds[0] ?? null;
          (this as unknown as Record<string, unknown>).selectedShipIds = friendlyIds;
        }
      }
    };
    document.addEventListener('keydown', ctrlAHandler);
    // Ensure canvas has focus so keyboard events work
    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    // Clean up on scene shutdown
    this.events.once('shutdown', () => {
      document.removeEventListener('keydown', ctrlAHandler);
    });

    // Right-click anywhere in the scene for move/attack orders
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this._handleRightClick(pointer);
      }
    });

    // Left-click on ship containers
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
    const side = container.getData('side') as 'attacker' | 'defender';
    const ship = this.tacticalState.ships.find(s => s.id === shipId);
    if (!ship) return;

    if (this._isPlayerSide(ship)) {
      // Clicking a friendly ship — select it
      this.selectedShipId = shipId;
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

    // Otherwise — move order
    this._issueOrder({ type: 'move', x: worldPoint.x, y: worldPoint.y });
  }

  private _issueOrder(order: ShipOrder): void {
    // If multiple ships selected (Ctrl+A), issue order to all
    const multiIds = (this as unknown as Record<string, unknown>).selectedShipIds as string[] | null;
    if (multiIds && multiIds.length > 1) {
      for (const id of multiIds) {
        this.tacticalState = setShipOrder(this.tacticalState, id, order);
      }
      return;
    }
    if (!this.selectedShipId) return;
    this.tacticalState = setShipOrder(this.tacticalState, this.selectedShipId, order);
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
    this.tacticalState = setFormation(this.tacticalState, side, formation);

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

    // Check for battle end
    this._checkBattleEnd();
  }

  private _checkBattleEnd(): void {
    if (this.tacticalState.outcome === null) return;

    // Battle is over
    this.battleEnded = true;
    this.tickTimer.paused = true;

    const playerIsAttacker =
      this.sceneData.attackerFleet.empireId === this.sceneData.playerEmpireId;
    const playerWon = playerIsAttacker
      ? this.tacticalState.outcome === 'attacker_wins'
      : this.tacticalState.outcome === 'defender_wins';

    const resultText = playerWon ? 'VICTORY' : 'DEFEAT';
    const resultColor = playerWon ? '#44ff88' : '#ff4444';

    const { width, height } = this.scale;

    const label = this.add.text(width / 2, height / 2, resultText, {
      fontFamily: 'serif',
      fontSize: '64px',
      color: resultColor,
      stroke: '#000000',
      strokeThickness: 4,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: resultColor,
        blur: 24,
        fill: true,
      },
    });
    label.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(200);

    // After 2 seconds, check whether to transition to ground combat or end
    this.time.delayedCall(2000, () => {
      // If attacker won a planetary assault, transition to ground combat
      if (
        this.tacticalState.outcome === 'attacker_wins' &&
        this.tacticalState.layout === 'planetary_assault' &&
        this.tacticalState.planetData
      ) {
        // First emit tactical complete so the engine can apply ship losses
        this.game.events.emit('combat:tactical_complete', this.tacticalState);

        // Gather hull classes from surviving attacker ships to determine transport capacity
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
    });
  }
}
