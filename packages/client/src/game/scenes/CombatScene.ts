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

const BG_COLOR = 0x050510;
const STAR_COUNT = 100;

/** Triangle dimensions (pixels) */
const SHIP_BASE = 12;
const SHIP_HEIGHT = 18;
const SELECTION_RING_RADIUS = 14;
const SELECTION_RING_COLOR = 0xffffff;
const SELECTION_RING_ALPHA = 0.85;

/** Projectile dot radius */
const PROJECTILE_RADIUS = 3;
const PROJECTILE_COLOR = 0xffaa22;

/** Missile visual constants */
const MISSILE_SIZE = 5;
const MISSILE_COLOR = 0xff6633;
const MISSILE_TRAIL_COLOR = 0xff4400;
const MISSILE_TRAIL_ALPHA = 0.3;
const MISSILE_TRAIL_LENGTH = 12;

/** Fighter visual constants */
const FIGHTER_RADIUS = 2;
const FIGHTER_JITTER = 3; // random visual offset for swarming effect

/** Point defence visual constants */
const PD_COLOR = 0xffffff;
const PD_ALPHA = 0.7;

/** Beam colours */
const BEAM_COLOR_FRIENDLY = 0x44ff88;
const BEAM_COLOR_ENEMY = 0xff4444;

/** Damage flash colour (red) overlaid briefly when a ship takes damage. */
const DAMAGE_FLASH_COLOR = 0xff2222;
const DAMAGE_FLASH_DURATION = 120; // ms

/** Explosion circle expand + fade duration. */
const EXPLOSION_DURATION = 400; // ms
const EXPLOSION_RADIUS = 24;
const EXPLOSION_COLOR = 0xff8800;

/** Environment visual constants */
const ASTEROID_COLOR = 0x888888;
const ASTEROID_ALPHA = 0.6;
const NEBULA_COLOR = 0x6644aa;
const NEBULA_ALPHA = 0.15;
const DEBRIS_COLOR = 0xcc6622;
const DEBRIS_DOT_RADIUS = 2;
const DEBRIS_DOT_COUNT = 8;
const DEBRIS_DOT_ALPHA = 0.5;

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

    // ── Tick loop ──────────────────────────────────────────────────────────
    this.tickTimer = this.time.addEvent({
      delay: SPEED_PRESETS[0]!.msPerTick,
      loop: true,
      callback: () => this._onTick(),
    });

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
    if (this.tickTimer) this.tickTimer.remove();
  }

  // =========================================================================
  // Background
  // =========================================================================

  private _drawStarfield(): void {
    const gfx = this.add.graphics();
    gfx.setDepth(0);
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = Phaser.Math.FloatBetween(0, BATTLEFIELD_WIDTH);
      const y = Phaser.Math.FloatBetween(0, BATTLEFIELD_HEIGHT);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4);
      const radius = Phaser.Math.FloatBetween(0.3, 1.0);
      gfx.fillStyle(0xffffff, alpha);
      gfx.fillCircle(x, y, radius);
    }
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

    // Zoom with scroll wheel
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

  private _createShipContainers(): void {
    for (const ship of this.tacticalState.ships) {
      const container = this.add.container(ship.position.x, ship.position.y);
      container.setDepth(8);
      container.setRotation(ship.facing);

      // Triangle graphic
      const color = this._shipColor(ship);
      const gfx = this.add.graphics();
      gfx.fillStyle(color, 1);
      gfx.beginPath();
      // Triangle pointing right (+x) so rotation 0 = facing right
      gfx.moveTo(SHIP_HEIGHT / 2, 0);           // nose
      gfx.lineTo(-SHIP_HEIGHT / 2, -SHIP_BASE / 2); // bottom-left
      gfx.lineTo(-SHIP_HEIGHT / 2, SHIP_BASE / 2);  // top-left
      gfx.closePath();
      gfx.fillPath();
      // Outline
      gfx.lineStyle(1, 0xffffff, 0.3);
      gfx.beginPath();
      gfx.moveTo(SHIP_HEIGHT / 2, 0);
      gfx.lineTo(-SHIP_HEIGHT / 2, -SHIP_BASE / 2);
      gfx.lineTo(-SHIP_HEIGHT / 2, SHIP_BASE / 2);
      gfx.closePath();
      gfx.strokePath();

      container.add(gfx);

      // Name label below the triangle
      const label = this.add.text(0, SHIP_BASE / 2 + 4, ship.name, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#aabbcc',
        align: 'center',
      });
      label.setOrigin(0.5, 0);
      container.add(label);

      // Make the container interactive for click targeting
      container.setSize(SHIP_HEIGHT + 4, SHIP_BASE + 8);
      container.setInteractive();

      // Store data on the container for click handlers
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

      // Fade alpha based on hull percentage (1.0 at full, 0.35 at near-zero)
      const hullFraction = ship.maxHull > 0 ? ship.hull / ship.maxHull : 1;
      const alpha = 0.35 + hullFraction * 0.65;
      container.setAlpha(alpha);

      // Damage flash — if hull dropped since last check
      const prev = this.prevHull.get(ship.id) ?? ship.hull;
      if (ship.hull < prev) {
        this._flashDamage(container);
      }
      this.prevHull.set(ship.id, ship.hull);
    }
  }

  /** Brief red tint flash on a ship container when it takes damage. */
  private _flashDamage(container: Phaser.GameObjects.Container): void {
    // Create a small circle overlay for the flash
    const flash = this.add.graphics();
    flash.fillStyle(DAMAGE_FLASH_COLOR, 0.6);
    flash.fillCircle(0, 0, SHIP_BASE);
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
      const alpha = beam.ticksRemaining / 3;
      const color = this._isPlayerSide(source) ? BEAM_COLOR_FRIENDLY : BEAM_COLOR_ENEMY;
      this.beamGraphics.lineStyle(2, color, alpha);
      this.beamGraphics.lineBetween(
        source.position.x, source.position.y,
        target.position.x, target.position.y,
      );
    }
  }

  private _drawProjectiles(): void {
    this.projectileGraphics.clear();
    for (const proj of this.tacticalState.projectiles) {
      this.projectileGraphics.fillStyle(PROJECTILE_COLOR, 0.9);
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
      this.pdGraphics.lineStyle(1, PD_COLOR, alpha);
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
    this.selectionRing.lineStyle(2, SELECTION_RING_COLOR, SELECTION_RING_ALPHA);
    this.selectionRing.strokeCircle(ship.position.x, ship.position.y, SELECTION_RING_RADIUS);
  }

  // =========================================================================
  // HUD
  // =========================================================================

  private _createHUD(): void {
    const { width, height } = this.scale;

    // ── Top-left: title + tick counter ─────────────────────────────────────
    const titleLabel = this.add.text(12, 10, 'TACTICAL COMBAT', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ff8844',
      stroke: '#000000',
      strokeThickness: 2,
    });
    titleLabel.setScrollFactor(0).setDepth(100);

    this.tickLabel = this.add.text(12, 30, 'Tick: 0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#88aacc',
    });
    this.tickLabel.setScrollFactor(0).setDepth(100);

    // Empire names
    const attackerLabel = this.add.text(12, 48, this.sceneData.attackerName, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: this.sceneData.attackerColor,
    });
    attackerLabel.setScrollFactor(0).setDepth(100);

    const defenderLabel = this.add.text(12, 62, `vs ${this.sceneData.defenderName}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: this.sceneData.defenderColor,
    });
    defenderLabel.setScrollFactor(0).setDepth(100);

    // ── Bottom bar: selected ship info ─────────────────────────────────────
    this.selectedInfoLabel = this.add.text(12, height - 40, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ccddee',
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
    const retreatBtn = this.add.text(width - 16, height - 36, 'RETREAT ALL', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ff5555',
      backgroundColor: '#1a1a2e',
      padding: { x: 8, y: 6 },
      stroke: '#ff5555',
      strokeThickness: 1,
    });
    retreatBtn.setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    retreatBtn.setInteractive({ useHandCursor: true });
    retreatBtn.on('pointerdown', () => this._retreatAll());

    // ── Bottom-left: formation buttons ──────────────────────────────────
    const formationLabel = this.add.text(12, height - 70, 'FORMATION:', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#88aacc',
    });
    formationLabel.setScrollFactor(0).setDepth(100);

    let fmtBtnX = 12;
    this.formationButtons = [];
    for (const fm of FORMATION_TYPES) {
      const isActive = fm.type === 'line'; // default formation
      const btn = this.add.text(fmtBtnX, height - 56, fm.label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: isActive ? '#44ffaa' : '#6688aa',
        backgroundColor: '#1a1a2e',
        padding: { x: 6, y: 4 },
      });
      btn.setScrollFactor(0).setDepth(100);
      btn.setInteractive({ useHandCursor: true });
      btn.setData('formationType', fm.type);
      btn.on('pointerdown', () => this._setPlayerFormation(fm.type));
      this.formationButtons.push(btn);
      fmtBtnX += btn.width + 6;
    }

    // ── Admiral commands (right side, above retreat) ─────────────────────
    const admiralY = height - 90;
    const admiralX = width - 16;

    this.repairButton = this.add.text(admiralX, admiralY + 24, 'REPAIR', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6688aa',
      backgroundColor: '#1a1a2e',
      padding: { x: 6, y: 4 },
    });
    this.repairButton.setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.repairButton.setInteractive({ useHandCursor: true });
    this.repairButton.on('pointerdown', () => this._admiralRepair());

    this.rallyButton = this.add.text(admiralX, admiralY, 'RALLY', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6688aa',
      backgroundColor: '#1a1a2e',
      padding: { x: 6, y: 4 },
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

  // =========================================================================
  // Input
  // =========================================================================

  private _setupInput(): void {
    // ESC to deselect
    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedShipId = null;
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
