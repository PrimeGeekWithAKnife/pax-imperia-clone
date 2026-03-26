import Phaser from 'phaser';
import {
  initializeGroundCombat,
  processGroundTick,
  totalStrength,
  averageMorale,
  calculateTransportCapacity,
  GROUND_UNIT_DEFINITIONS,
} from '@nova-imperia/shared';
import type { GroundCombatState, GroundForce } from '@nova-imperia/shared';
import type { HullClass } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Scene data passed via scene.start('GroundCombatScene', data)
// ---------------------------------------------------------------------------

export interface GroundCombatSceneData {
  planetName: string;
  planetType: string;
  attackerHullClasses: HullClass[];
  defenderPopulation: number;
  defenderBuildings: { id: string; type: string; level: number }[];
  attackerExperience: string;
  defenderExperience: string;
  attackerEmpireId: string;
  defenderEmpireId: string;
  playerEmpireId: string;
  attackerColor: string;
  defenderColor: string;
  attackerName: string;
  defenderName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BG_COLOUR = 0x0a0a12;

/** Planet surface colour by type. */
const SURFACE_COLOURS: Record<string, number> = {
  terran: 0x1a3a2a,
  ocean: 0x0a2a4a,
  desert: 0x4a3a1a,
  volcanic: 0x3a1a0a,
  ice: 0x2a3a4a,
  arctic: 0x2a3a4a,
  barren: 0x2a2a2a,
  gas_giant: 0x2a2a3a,
  toxic: 0x2a3a1a,
};

/** Sky/atmosphere colour by planet type. */
const SKY_COLOURS: Record<string, number> = {
  terran: 0x1a2a4a,
  ocean: 0x0a1a3a,
  desert: 0x3a2a1a,
  volcanic: 0x2a0a0a,
  ice: 0x1a2a3a,
  arctic: 0x1a2a3a,
  barren: 0x1a1a1a,
  gas_giant: 0x1a1a2a,
  toxic: 0x1a2a0a,
};

const ATTACKER_BAR_COLOUR = 0x4488ff;
const DEFENDER_BAR_COLOUR = 0xff4444;

/** Speed multiplier presets (ms per tick). */
const SPEED_PRESETS: { label: string; msPerTick: number }[] = [
  { label: '1x', msPerTick: 150 },
  { label: '2x', msPerTick: 75 },
  { label: '4x', msPerTick: 38 },
  { label: '8x', msPerTick: 19 },
];

const BAR_HEIGHT = 28;
const BAR_Y = 90;
const BAR_MAX_WIDTH_FRACTION = 0.38; // each side uses at most 38% of the screen

const LOG_MAX_LINES = 8;

// ---------------------------------------------------------------------------
// GroundCombatScene
// ---------------------------------------------------------------------------

export class GroundCombatScene extends Phaser.Scene {
  private gcState!: GroundCombatState;
  private sceneData!: GroundCombatSceneData;
  private battleEnded = false;
  private paused = false;

  // Speed control
  private speedIndex = 0;
  private tickTimer!: Phaser.Time.TimerEvent;

  // Graphics
  private barGraphics!: Phaser.GameObjects.Graphics;
  private clashEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  // HUD text
  private titleLabel!: Phaser.GameObjects.Text;
  private tickLabel!: Phaser.GameObjects.Text;
  private atkStrLabel!: Phaser.GameObjects.Text;
  private defStrLabel!: Phaser.GameObjects.Text;
  private atkMoraleLabel!: Phaser.GameObjects.Text;
  private defMoraleLabel!: Phaser.GameObjects.Text;
  private atkBreakdownLabel!: Phaser.GameObjects.Text;
  private defBreakdownLabel!: Phaser.GameObjects.Text;
  private logLabel!: Phaser.GameObjects.Text;
  private speedButtons: Phaser.GameObjects.Text[] = [];
  private retreatButton!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GroundCombatScene' });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  create(data: GroundCombatSceneData): void {
    this.sceneData = data;
    this.battleEnded = false;
    this.paused = false;
    this.speedIndex = 0;
    this.speedButtons = [];

    // Calculate attacker troops from hull classes
    const attackerTroops = calculateTransportCapacity(data.attackerHullClasses);

    // Initialise ground combat state
    this.gcState = initializeGroundCombat(
      data.planetName,
      data.planetType,
      attackerTroops,
      data.defenderPopulation,
      data.defenderBuildings as { id: string; type: any; level: number }[],
      data.attackerExperience,
      data.defenderExperience,
      data.attackerEmpireId,
      data.defenderEmpireId,
    );

    const { width, height } = this.scale;

    // --- Background ---
    this._drawBackground(width, height);

    // --- Title ---
    this.titleLabel = this.add.text(width / 2, 20, `GROUND INVASION: ${data.planetName.toUpperCase()}`, {
      fontFamily: 'serif',
      fontSize: '28px',
      color: '#ccddff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(10);

    // --- Attacker / Defender labels ---
    this.add.text(20, 55, data.attackerName, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#4488ff',
    }).setDepth(10);

    this.add.text(width - 20, 55, data.defenderName, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ff4444',
    }).setOrigin(1, 0).setDepth(10);

    // --- Force bars ---
    this.barGraphics = this.add.graphics().setDepth(10);

    // --- Strength labels ---
    this.atkStrLabel = this.add.text(20, BAR_Y + BAR_HEIGHT + 4, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#88aaff',
    }).setDepth(10);

    this.defStrLabel = this.add.text(width - 20, BAR_Y + BAR_HEIGHT + 4, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ff8888',
    }).setOrigin(1, 0).setDepth(10);

    // --- Morale labels ---
    this.atkMoraleLabel = this.add.text(20, BAR_Y + BAR_HEIGHT + 20, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6688aa',
    }).setDepth(10);

    this.defMoraleLabel = this.add.text(width - 20, BAR_Y + BAR_HEIGHT + 20, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aa6666',
    }).setOrigin(1, 0).setDepth(10);

    // --- Force breakdown ---
    this.atkBreakdownLabel = this.add.text(20, BAR_Y + BAR_HEIGHT + 40, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#8899aa',
      lineSpacing: 2,
    }).setDepth(10);

    this.defBreakdownLabel = this.add.text(width - 20, BAR_Y + BAR_HEIGHT + 40, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aa8888',
      lineSpacing: 2,
    }).setOrigin(1, 0).setDepth(10);

    // --- Tick counter ---
    this.tickLabel = this.add.text(width / 2, 55, 'Tick: 0', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#667788',
    }).setOrigin(0.5, 0).setDepth(10);

    // --- Battle log ---
    this.logLabel = this.add.text(20, height - 140, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#99aabb',
      lineSpacing: 2,
      wordWrap: { width: width - 40 },
    }).setDepth(10);

    // --- Speed controls ---
    this._createSpeedControls(width, height);

    // --- Retreat button ---
    this.retreatButton = this.add.text(width - 120, height - 30, '[ RETREAT ]', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffaa44',
    }).setDepth(10).setInteractive({ useHandCursor: true });
    this.retreatButton.on('pointerdown', () => this._handleRetreat());

    // --- Pause button ---
    this.pauseButton = this.add.text(width / 2, height - 30, '[ PAUSE ]', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#88ccff',
    }).setOrigin(0.5, 0).setDepth(10).setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerdown', () => this._togglePause());

    // --- Clash particles ---
    this._createClashEffect(width, height);

    // --- Start tick timer ---
    this.tickTimer = this.time.addEvent({
      delay: SPEED_PRESETS[0]!.msPerTick,
      callback: this._onTick,
      callbackScope: this,
      loop: true,
    });

    // Initial render
    this._updateVisuals();

    // Emit scene change for React overlay awareness
    this.game.events.emit('scene:change', 'GroundCombatScene');
  }

  // =========================================================================
  // Background
  // =========================================================================

  private _drawBackground(width: number, height: number): void {
    const surfaceColour = SURFACE_COLOURS[this.sceneData.planetType] ?? 0x2a2a2a;
    const skyColour = SKY_COLOURS[this.sceneData.planetType] ?? 0x1a1a1a;

    // Sky gradient (top half)
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(BG_COLOUR, 1);
    g.fillRect(0, 0, width, height);

    // Horizon glow
    const horizonY = height * 0.55;
    for (let i = 0; i < 40; i++) {
      const alpha = 0.03 * (1 - i / 40);
      g.fillStyle(skyColour, alpha);
      g.fillRect(0, horizonY - i * 4, width, 4);
    }

    // Planet surface (lower portion)
    g.fillStyle(surfaceColour, 0.8);
    g.fillRect(0, horizonY, width, height - horizonY);

    // Terrain features (simple decorative lines)
    g.lineStyle(1, surfaceColour, 0.3);
    for (let i = 0; i < 12; i++) {
      const y = horizonY + 20 + Math.random() * (height - horizonY - 60);
      const x1 = Math.random() * width * 0.3;
      const x2 = x1 + Math.random() * width * 0.5;
      g.lineBetween(x1, y, x2, y + (Math.random() - 0.5) * 10);
    }

    // Stars in the sky
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * horizonY * 0.8;
      const brightness = 0.3 + Math.random() * 0.7;
      g.fillStyle(0xffffff, brightness * 0.4);
      g.fillCircle(sx, sy, 0.5 + Math.random() * 1);
    }
  }

  // =========================================================================
  // Clash particles
  // =========================================================================

  private _createClashEffect(width: number, height: number): void {
    // Create a small particle texture
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture('ground_clash_particle', 8, 8);
    gfx.destroy();

    const clashX = width / 2;
    const clashY = height * 0.50;

    this.clashEmitter = this.add.particles(clashX, clashY, 'ground_clash_particle', {
      speed: { min: 20, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 600,
      frequency: 120,
      tint: [0xff6644, 0xffaa22, 0xffffff, 0xff4422],
      alpha: { start: 0.7, end: 0 },
      blendMode: 'ADD',
    });
    this.clashEmitter.setDepth(5);
  }

  // =========================================================================
  // Speed controls
  // =========================================================================

  private _createSpeedControls(width: number, height: number): void {
    const baseX = 20;
    const y = height - 30;

    for (let i = 0; i < SPEED_PRESETS.length; i++) {
      const preset = SPEED_PRESETS[i]!;
      const btn = this.add.text(baseX + i * 50, y, `[${preset.label}]`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: i === 0 ? '#ffffff' : '#667788',
      }).setDepth(10).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.speedIndex = i;
        // Recreate the timer with the new delay
        this.tickTimer.remove();
        this.tickTimer = this.time.addEvent({
          delay: SPEED_PRESETS[i]!.msPerTick,
          callback: this._onTick,
          callbackScope: this,
          loop: true,
        });
        for (let j = 0; j < this.speedButtons.length; j++) {
          this.speedButtons[j]!.setColor(j === i ? '#ffffff' : '#667788');
        }
      });

      this.speedButtons.push(btn);
    }
  }

  // =========================================================================
  // Tick loop
  // =========================================================================

  private _onTick(): void {
    if (this.battleEnded || this.paused) return;

    this.gcState = processGroundTick(this.gcState);
    this._updateVisuals();
    this._checkBattleEnd();
  }

  // =========================================================================
  // Visual updates
  // =========================================================================

  private _updateVisuals(): void {
    const { width } = this.scale;

    this.tickLabel.setText(`Tick: ${this.gcState.tick}`);

    // --- Force bars ---
    const atkStr = totalStrength(this.gcState.attackerForces);
    const defStr = totalStrength(this.gcState.defenderForces);

    // Initial strengths for normalisation
    const atkMaxStr = this.gcState.attackerForces.reduce((s: number, f: GroundForce) => s + f.maxStrength, 0);
    const defMaxStr = this.gcState.defenderForces.reduce((s: number, f: GroundForce) => s + f.maxStrength, 0);
    const maxStr = Math.max(atkMaxStr, defMaxStr, 1);

    const barMaxWidth = width * BAR_MAX_WIDTH_FRACTION;
    const atkBarWidth = (atkStr / maxStr) * barMaxWidth;
    const defBarWidth = (defStr / maxStr) * barMaxWidth;

    const g = this.barGraphics;
    g.clear();

    // Attacker bar (left-aligned)
    g.fillStyle(0x222233, 0.6);
    g.fillRect(10, BAR_Y, barMaxWidth, BAR_HEIGHT);
    g.fillStyle(ATTACKER_BAR_COLOUR, 0.8);
    g.fillRect(10, BAR_Y, atkBarWidth, BAR_HEIGHT);

    // Defender bar (right-aligned)
    const defBarX = width - 10 - barMaxWidth;
    g.fillStyle(0x332222, 0.6);
    g.fillRect(defBarX, BAR_Y, barMaxWidth, BAR_HEIGHT);
    g.fillStyle(DEFENDER_BAR_COLOUR, 0.8);
    g.fillRect(width - 10 - defBarWidth, BAR_Y, defBarWidth, BAR_HEIGHT);

    // Centre divider
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(width / 2 - 1, BAR_Y - 4, 2, BAR_HEIGHT + 8);

    // --- Strength numbers ---
    this.atkStrLabel.setText(`Strength: ${Math.round(atkStr)}`);
    this.defStrLabel.setText(`Strength: ${Math.round(defStr)}`);

    // --- Morale ---
    const atkMorale = averageMorale(this.gcState.attackerForces);
    const defMorale = averageMorale(this.gcState.defenderForces);
    this.atkMoraleLabel.setText(`Morale: ${Math.round(atkMorale)}%`);
    this.defMoraleLabel.setText(`Morale: ${Math.round(defMorale)}%`);

    // --- Force breakdown ---
    this.atkBreakdownLabel.setText(this._formatBreakdown(this.gcState.attackerForces));
    this.defBreakdownLabel.setText(this._formatBreakdown(this.gcState.defenderForces));

    // --- Battle log (last N entries) ---
    const visibleLog = this.gcState.log.slice(-LOG_MAX_LINES);
    this.logLabel.setText(visibleLog.join('\n'));

    // --- Adjust clash particle intensity ---
    if (this.clashEmitter) {
      const combatIntensity = Math.min(atkStr, defStr) / Math.max(maxStr, 1);
      this.clashEmitter.frequency = this.battleEnded ? -1 : Math.max(30, 200 - combatIntensity * 180);
    }
  }

  private _formatBreakdown(forces: GroundForce[]): string {
    const lines: string[] = [];
    for (const f of forces) {
      if (f.strength <= 0) continue;
      const def = GROUND_UNIT_DEFINITIONS[f.type];
      const warCrimeTag = def?.warCrime ? ' [!WMD]' : '';
      const displayName = def?.name ?? (f.type.charAt(0).toUpperCase() + f.type.slice(1));
      lines.push(`${displayName}: ${Math.round(f.strength)} (${f.experience})${warCrimeTag}`);
    }
    return lines.join('\n');
  }

  // =========================================================================
  // Battle end
  // =========================================================================

  private _checkBattleEnd(): void {
    if (this.gcState.outcome === null) return;

    this.battleEnded = true;
    this.tickTimer.paused = true;

    // Stop clash particles
    if (this.clashEmitter) {
      this.clashEmitter.stop();
    }

    // Hide retreat button
    this.retreatButton.setVisible(false);

    const playerIsAttacker = this.sceneData.attackerEmpireId === this.sceneData.playerEmpireId;
    const playerWon = playerIsAttacker
      ? this.gcState.outcome === 'attacker_wins'
      : this.gcState.outcome === 'defender_wins';

    const resultText = this.gcState.outcome === 'attacker_wins'
      ? 'PLANET CAPTURED'
      : 'INVASION REPELLED';
    const resultColour = playerWon ? '#44ff88' : '#ff4444';

    const { width, height } = this.scale;

    const label = this.add.text(width / 2, height * 0.4, resultText, {
      fontFamily: 'serif',
      fontSize: '56px',
      color: resultColour,
      stroke: '#000000',
      strokeThickness: 4,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: resultColour,
        blur: 24,
        fill: true,
      },
    });
    label.setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(200);

    // After 2.5 seconds, emit completion and return to galaxy map
    this.time.delayedCall(2500, () => {
      this.game.events.emit('ground_combat:complete', {
        outcome: this.gcState.outcome,
        planetName: this.gcState.planetName,
        planetType: this.gcState.planetType,
        attackerEmpireId: this.gcState.attackerEmpireId,
        defenderEmpireId: this.gcState.defenderEmpireId,
        attackerStrengthRemaining: totalStrength(this.gcState.attackerForces),
        defenderStrengthRemaining: totalStrength(this.gcState.defenderForces),
        ticks: this.gcState.tick,
        warCrimesCommitted: this.gcState.warCrimesCommitted,
      });
      this.scene.start('GalaxyMapScene', {});
    });
  }

  // =========================================================================
  // Player actions
  // =========================================================================

  private _handleRetreat(): void {
    if (this.battleEnded) return;

    // Force attacker loss via retreat
    this.battleEnded = true;
    this.tickTimer.paused = true;

    if (this.clashEmitter) this.clashEmitter.stop();
    this.retreatButton.setVisible(false);

    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.4, 'RETREAT ORDERED', {
      fontFamily: 'serif',
      fontSize: '48px',
      color: '#ffaa44',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(200);

    this.gcState = {
      ...this.gcState,
      outcome: 'defender_wins',
      log: [...this.gcState.log, `Tick ${this.gcState.tick}: Attacker orders retreat — INVASION CANCELLED`],
    };
    this._updateVisuals();

    this.time.delayedCall(2000, () => {
      this.game.events.emit('ground_combat:complete', {
        outcome: 'defender_wins',
        planetName: this.gcState.planetName,
        planetType: this.gcState.planetType,
        attackerEmpireId: this.gcState.attackerEmpireId,
        defenderEmpireId: this.gcState.defenderEmpireId,
        attackerStrengthRemaining: totalStrength(this.gcState.attackerForces),
        defenderStrengthRemaining: totalStrength(this.gcState.defenderForces),
        ticks: this.gcState.tick,
        retreated: true,
        warCrimesCommitted: this.gcState.warCrimesCommitted,
      });
      this.scene.start('GalaxyMapScene', {});
    });
  }

  private _togglePause(): void {
    this.paused = !this.paused;
    this.pauseButton.setText(this.paused ? '[ RESUME ]' : '[ PAUSE ]');
    this.pauseButton.setColor(this.paused ? '#ffaa44' : '#88ccff');
  }
}
