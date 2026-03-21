import Phaser from 'phaser';
import { generateGalaxy } from '@nova-imperia/shared';
import type { Galaxy, StarSystem, StarType } from '@nova-imperia/shared';

// ── Constants ──────────────────────────────────────────────────────────────────

const BG_COLOR = 0x05050f;
const WORMHOLE_COLOR = 0x334455;
const WORMHOLE_ALPHA = 0.5;
const WORMHOLE_HIGHLIGHT_COLOR = 0x4488cc;
const WORMHOLE_HIGHLIGHT_ALPHA = 0.9;
const SELECTION_RING_COLOR = 0xffffff;
const SELECTION_RING_ALPHA = 0.9;
const FOG_COLOR = 0x334455;
const TOOLTIP_BG_COLOR = 0x111824;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.0;
const ZOOM_FACTOR = 0.1;
const ZOOM_LERP = 0.12;

const PARALLAX_STAR_COUNT = 250;
const PARALLAX_FACTOR = 0.15; // bg stars move at 15% of camera speed

// ── Star visual properties ─────────────────────────────────────────────────────

interface StarVisuals {
  color: number;
  radius: number;
  glowColor: number;
  glowRadius: number;
}

const STAR_VISUALS: Record<StarType, StarVisuals> = {
  blue_giant:  { color: 0x99ccff, radius: 9,  glowColor: 0x4499ff, glowRadius: 18 },
  white:       { color: 0xeeeeff, radius: 7,  glowColor: 0xaabbff, glowRadius: 14 },
  yellow:      { color: 0xffee88, radius: 7,  glowColor: 0xffcc44, glowRadius: 14 },
  orange:      { color: 0xff9944, radius: 7,  glowColor: 0xff6600, glowRadius: 13 },
  red_dwarf:   { color: 0xff5533, radius: 5,  glowColor: 0xcc2200, glowRadius: 10 },
  red_giant:   { color: 0xff3322, radius: 10, glowColor: 0xcc1100, glowRadius: 20 },
  neutron:     { color: 0xaaddff, radius: 4,  glowColor: 0x88ccff, glowRadius: 9  },
  binary:      { color: 0xffddaa, radius: 8,  glowColor: 0xffaa44, glowRadius: 16 },
};

// ── GalaxyMapScene ─────────────────────────────────────────────────────────────

export class GalaxyMapScene extends Phaser.Scene {
  private galaxy!: Galaxy;
  private knownSystemIds: Set<string> = new Set();

  // Layers
  private parallaxLayer!: Phaser.GameObjects.Container;
  private wormholeLayer!: Phaser.GameObjects.Graphics;
  private starLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;

  // Galaxy world container (panned/zoomed)
  private worldContainer!: Phaser.GameObjects.Container;

  // Camera / pan state
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private cameraOffset = { x: 0, y: 0 };
  private targetZoom = 1.0;
  private currentZoom = 1.0;

  // Selection
  private selectedSystemId: string | null = null;
  private selectionRing!: Phaser.GameObjects.Graphics;

  // Tooltip
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;

  // Pulse animation tween
  private pulseTweens: Map<string, Phaser.Tweens.Tween> = new Map();

  // Star hit areas (invisible circles for click detection)
  private starHitAreas: Map<string, Phaser.GameObjects.Arc> = new Map();

  // Last pointer-down time for double-click detection
  private lastPointerDownTime = 0;
  private lastPointerDownSystemId: string | null = null;

  constructor() {
    super({ key: 'GalaxyMapScene' });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  create(data?: { knownSystemIds?: string[] }): void {
    // Reset state from any previous run of this scene
    this.parallaxStars = [];
    this.starHitAreas.clear();
    this.pulseTweens.clear();
    this.selectedSystemId = null;
    this.lastPointerDownTime = 0;
    this.lastPointerDownSystemId = null;
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;
    this.isDragging = false;

    // Generate galaxy
    this.galaxy = generateGalaxy({
      seed: 42,
      size: 'medium',
      shape: 'spiral',
      playerCount: 2,
    });

    // Set up fog of war — default: reveal all
    const revealAll = !data?.knownSystemIds;
    if (revealAll) {
      for (const sys of this.galaxy.systems) {
        this.knownSystemIds.add(sys.id);
      }
    } else {
      this.knownSystemIds = new Set(data!.knownSystemIds!);
    }

    // Background
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, BG_COLOR).setOrigin(0, 0);

    // Build scene layers
    this.parallaxLayer = this.add.container(0, 0);
    this.worldContainer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);

    this.wormholeLayer = this.add.graphics();
    this.starLayer = this.add.container(0, 0);
    this.worldContainer.add([this.wormholeLayer, this.starLayer]);

    // Build content
    this.createParallaxBackground();
    this.centerGalaxy();
    this.drawWormholes(null);
    this.createStars();
    this.createSelectionRing();
    this.createTooltip();
    this.createBackButton();

    // Input
    this.setupInput();
  }

  update(): void {
    this.updateZoomLerp();
    this.updateParallax();
  }

  // ── Galaxy layout ─────────────────────────────────────────────────────────────

  /**
   * Translate galaxy coordinate space so the galaxy center sits at the
   * center of the screen.
   */
  private centerGalaxy(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    // Galaxy coords are [0..1000] — center at (500, 500)
    this.cameraOffset.x = cx - (this.galaxy.width / 2) * this.currentZoom;
    this.cameraOffset.y = cy - (this.galaxy.height / 2) * this.currentZoom;
    this.applyWorldTransform();
  }

  private applyWorldTransform(): void {
    this.worldContainer.setPosition(this.cameraOffset.x, this.cameraOffset.y);
    this.worldContainer.setScale(this.currentZoom);
  }

  /** Convert galaxy-space coords to screen coords (accounting for pan+zoom). */
  private galaxyToScreen(gx: number, gy: number): { x: number; y: number } {
    return {
      x: gx * this.currentZoom + this.cameraOffset.x,
      y: gy * this.currentZoom + this.cameraOffset.y,
    };
  }

  // ── Parallax starfield ───────────────────────────────────────────────────────

  private parallaxStars: Array<{ obj: Phaser.GameObjects.Arc; baseX: number; baseY: number }> = [];

  private createParallaxBackground(): void {
    for (let i = 0; i < PARALLAX_STAR_COUNT; i++) {
      const x = Phaser.Math.Between(0, this.scale.width);
      const y = Phaser.Math.Between(0, this.scale.height);
      const r = Phaser.Math.FloatBetween(0.4, 1.5);
      const brightness = Phaser.Math.FloatBetween(0.15, 0.55);
      const v = Math.round(brightness * 255);
      const color = (v << 16) | (v << 8) | v;
      const star = this.add.circle(x, y, r, color, 1);
      this.parallaxLayer.add(star);
      this.parallaxStars.push({ obj: star, baseX: x, baseY: y });
    }
  }

  private updateParallax(): void {
    // Shift parallax stars proportionally to camera offset (inverted, slower)
    const shiftX = -(this.cameraOffset.x - (this.scale.width / 2 - this.galaxy.width / 2)) * PARALLAX_FACTOR;
    const shiftY = -(this.cameraOffset.y - (this.scale.height / 2 - this.galaxy.height / 2)) * PARALLAX_FACTOR;
    for (const s of this.parallaxStars) {
      s.obj.setPosition(
        ((s.baseX + shiftX) % this.scale.width + this.scale.width) % this.scale.width,
        ((s.baseY + shiftY) % this.scale.height + this.scale.height) % this.scale.height,
      );
    }
  }

  // ── Wormhole drawing ──────────────────────────────────────────────────────────

  private drawWormholes(highlightSystemId: string | null): void {
    this.wormholeLayer.clear();

    const systemMap = new Map<string, StarSystem>(
      this.galaxy.systems.map(s => [s.id, s]),
    );

    const drawn = new Set<string>();

    for (const sys of this.galaxy.systems) {
      const isKnown = this.knownSystemIds.has(sys.id);
      if (!isKnown) continue;

      for (const targetId of sys.wormholes) {
        const edgeKey = [sys.id, targetId].sort().join('|');
        if (drawn.has(edgeKey)) continue;
        drawn.add(edgeKey);

        const target = systemMap.get(targetId);
        if (!target || !this.knownSystemIds.has(targetId)) continue;

        const isHighlighted =
          highlightSystemId === sys.id || highlightSystemId === targetId;

        if (isHighlighted) {
          this.wormholeLayer.lineStyle(1.5 / this.currentZoom, WORMHOLE_HIGHLIGHT_COLOR, WORMHOLE_HIGHLIGHT_ALPHA);
        } else {
          this.wormholeLayer.lineStyle(1 / this.currentZoom, WORMHOLE_COLOR, WORMHOLE_ALPHA);
        }

        this.wormholeLayer.beginPath();
        this.wormholeLayer.moveTo(sys.position.x, sys.position.y);
        this.wormholeLayer.lineTo(target.position.x, target.position.y);
        this.wormholeLayer.strokePath();
      }
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

    // Glow (behind star, larger circle, low alpha)
    if (known) {
      const glowContainer = this.add.container(x, y);
      const glow = this.add.circle(0, 0, visuals.glowRadius, visuals.glowColor, 0.18);
      glowContainer.add(glow);
      this.starLayer.add(glowContainer);

      // Pulse tween on glow
      const tween = this.tweens.add({
        targets: glow,
        alpha: { from: 0.10, to: 0.30 },
        scale: { from: 0.85, to: 1.15 },
        duration: 2000 + Math.random() * 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.pulseTweens.set(sys.id + '_glow', tween);
    }

    // Star circle
    const color = known ? visuals.color : FOG_COLOR;
    const alpha = known ? 1 : 0.35;
    const radius = known ? visuals.radius : 4;
    const star = this.add.circle(x, y, radius, color, alpha);
    this.starLayer.add(star);

    // Invisible hit area (larger than visual for easy clicking)
    const hitRadius = Math.max(visuals.radius * 2, 14);
    const hitArea = this.add.circle(x, y, hitRadius, 0xffffff, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.starLayer.add(hitArea);
    this.starHitAreas.set(sys.id, hitArea);

    // Hover tooltip
    hitArea.on('pointerover', () => {
      if (!this.isDragging) {
        this.showTooltip(sys);
      }
    });
    hitArea.on('pointerout', () => {
      this.hideTooltip();
    });

    // Click → select
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

  // ── Selection ─────────────────────────────────────────────────────────────────

  private createSelectionRing(): void {
    this.selectionRing = this.add.graphics();
    this.starLayer.add(this.selectionRing);
  }

  private selectSystem(id: string): void {
    this.selectedSystemId = id;
    this.drawSelectionRing(id);
    this.drawWormholes(id);

    const sys = this.galaxy.systems.find(s => s.id === id);
    if (sys) {
      // Emit on game-level emitter so React's useGameEvent hook receives it
      this.game.events.emit('system:selected', sys);
    }
  }

  private drawSelectionRing(id: string): void {
    this.selectionRing.clear();
    const sys = this.galaxy.systems.find(s => s.id === id);
    if (!sys) return;

    const visuals = STAR_VISUALS[sys.starType];
    const ringRadius = visuals.radius + 5;

    this.selectionRing.lineStyle(1.5 / this.currentZoom, SELECTION_RING_COLOR, SELECTION_RING_ALPHA);
    this.selectionRing.strokeCircle(sys.position.x, sys.position.y, ringRadius);

    // Outer faint ring
    this.selectionRing.lineStyle(0.8 / this.currentZoom, SELECTION_RING_COLOR, 0.35);
    this.selectionRing.strokeCircle(sys.position.x, sys.position.y, ringRadius + 4);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────────

  private createTooltip(): void {
    this.tooltipBg = this.add.rectangle(0, 0, 120, 28, TOOLTIP_BG_COLOR, 0.85)
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

    // Position above star
    const tx = screen.x - tw / 2 + padding;
    const ty = screen.y - (STAR_VISUALS[sys.starType].radius * this.currentZoom) - 8;

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
      this.scene.start('MainMenuScene');
    });

    this.uiLayer.add(backButton);
  }

  // ── Scene transition ──────────────────────────────────────────────────────────

  private transitionToSystemView(sys: StarSystem): void {
    this.scene.start('SystemViewScene', { system: sys });
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  private setupInput(): void {
    // Pan: drag on canvas (not on a star)
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

    // Zoom: mouse wheel
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

    // Zoom toward screen center
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const zoomRatio = this.currentZoom / prevZoom;
    this.cameraOffset.x = cx + (this.cameraOffset.x - cx) * zoomRatio;
    this.cameraOffset.y = cy + (this.cameraOffset.y - cy) * zoomRatio;

    this.applyWorldTransform();
    this.updateSelectionRingScale();

    // Redraw wormholes at new scale (line width is inverse-scaled)
    this.drawWormholes(this.selectedSystemId);
    if (this.selectedSystemId) {
      this.drawSelectionRing(this.selectedSystemId);
    }
  }

  private updateSelectionRingScale(): void {
    // The ring line width is set inverse to zoom so it stays 1-1.5px visually
    if (this.selectedSystemId) {
      this.drawSelectionRing(this.selectedSystemId);
    }
  }
}
