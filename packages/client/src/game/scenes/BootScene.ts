import Phaser from 'phaser';
import { initAudioEngine } from '../../audio';

const TIPS = [
  'Build Power Plants early to avoid energy deficits.',
  'Colonising a planet takes several turns — plan ahead.',
  'Each race has unique buildings that only they can construct.',
  'Trade routes between systems with spaceports generate income.',
  'Research military tech before expanding near hostile empires.',
  'Terraforming can convert barren worlds into paradise.',
  'Keep your population happy — unhappy colonists revolt.',
];

/**
 * BootScene is the first scene loaded. It displays a branded loading screen
 * with a progress bar and a random gameplay tip, then transitions to
 * MainMenuScene once initialisation is complete.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Future: load any minimal assets needed for the loading screen itself
  }

  create(): void {
    const { width, height } = this.scale;

    // Initialise the audio engine singleton so all subsequent scenes can use it.
    // The AudioContext starts suspended; it will be resumed on the first user
    // interaction (handled in MainMenuScene).
    initAudioEngine();

    // ── Background ─────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x05050f, 1);
    bg.fillRect(0, 0, width, height);

    // Subtle star scatter
    const starGfx = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const a = Phaser.Math.FloatBetween(0.15, 0.7);
      const s = Phaser.Math.FloatBetween(0.4, 1.2);
      const v = Math.floor(a * 255);
      starGfx.fillStyle((v << 16) | (v << 8) | v, 1);
      starGfx.fillCircle(x, y, s);
    }

    // ── Game title ──────────────────────────────────────────────────────────
    this.add
      .text(width / 2, height * 0.32, 'EX NIHILO', {
        fontFamily: 'serif',
        fontSize: '56px',
        color: '#d4af6a',
        stroke: '#000000',
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 0, color: '#d4af6a', blur: 18, fill: true },
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(width / 2, height * 0.42, '4X SPACE STRATEGY', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#6688aa',
        letterSpacing: 5,
      })
      .setOrigin(0.5, 0.5);

    // ── Progress bar ────────────────────────────────────────────────────────
    const barWidth = Math.min(440, width * 0.55);
    const barHeight = 6;
    const barX = width / 2 - barWidth / 2;
    const barY = height * 0.56;

    // Track background
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a1a2e, 1);
    barBg.fillRect(barX, barY, barWidth, barHeight);
    barBg.lineStyle(1, 0x00d4ff, 0.22);
    barBg.strokeRect(barX, barY, barWidth, barHeight);

    // Fill bar
    const barFill = this.add.graphics();

    // Percentage text
    const pctText = this.add
      .text(width / 2, barY + barHeight + 12, '0%', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#6688aa',
      })
      .setOrigin(0.5, 0);

    // ── Tip text ─────────────────────────────────────────────────────────────
    const tipIndex = Phaser.Math.Between(0, TIPS.length - 1);
    const tipText = TIPS[tipIndex] ?? TIPS[0]!;

    this.add
      .text(width / 2, height * 0.68, 'TIP', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#00d4ff',
        letterSpacing: 5,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0.7);

    this.add
      .text(width / 2, height * 0.73, tipText, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8899aa',
        wordWrap: { width: barWidth + 40, useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 0);

    // ── Simulated loading progress (1500 ms) ───────────────────────────────
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;

    let step = 0;

    const tick = this.time.addEvent({
      delay: stepDuration,
      repeat: steps - 1,
      callback: () => {
        step++;
        const progress = step / steps;
        const fillWidth = barWidth * progress;
        const pct = Math.round(progress * 100);

        barFill.clear();
        // Gradient-ish: lighter at the leading edge
        barFill.fillStyle(0x00d4ff, 0.75);
        barFill.fillRect(barX, barY, fillWidth, barHeight);
        barFill.fillStyle(0xffffff, 0.35);
        barFill.fillRect(barX + fillWidth - 3, barY, 3, barHeight);

        pctText.setText(`${pct}%`);

        if (step >= steps) {
          tick.remove();
          this.time.delayedCall(120, () => {
            this.scene.start('MainMenuScene');
          });
        }
      },
    });
  }
}
