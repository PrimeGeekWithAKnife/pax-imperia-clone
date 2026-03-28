import Phaser from 'phaser';
import { getAudioEngine, MusicGenerator, SfxGenerator } from '../../audio';
import type { MusicTrack } from '../../audio';
import { getSaveManager } from '../../engine/SaveManager';

const STAR_COUNT = 200;
const GALAXY_ARMS = 3;
const GALAXY_STAR_COUNT = 320;
const DUST_MOTE_COUNT = 45;
const VERSION = 'v0.1.0 Alpha';

/**
 * MainMenuScene renders the game title, a procedural galaxy background,
 * atmospheric particle effects, and interactive buttons.
 */
export class MainMenuScene extends Phaser.Scene {
  private music: MusicGenerator | null = null;
  private sfx: SfxGenerator | null = null;
  private galaxyContainer: Phaser.GameObjects.Container | null = null;
  private dustMotes: Array<{ x: number; y: number; vx: number; vy: number; alpha: number; radius: number }> = [];
  private dustGraphics: Phaser.GameObjects.Graphics | null = null;
  private creditsOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  private onGameStartWithConfig = (data: { species: unknown; config: unknown }): void => {
    console.log('[MainMenuScene] game:start_with_config received – launching galaxy map', data);
    // Remove listener immediately to prevent stale re-fires during gameplay
    this.game.events.off('game:start_with_config', this.onGameStartWithConfig);
    this.game.events.off('game:load_save', this.onLoadSave);
    this.scene.start('GalaxyMapScene', { setupData: data });
  };

  /** React emits this after creating a GameEngine from a loaded save. */
  private onLoadSave = (): void => {
    console.log('[MainMenuScene] game:load_save received – launching galaxy map from save');
    // Remove listener immediately to prevent stale re-fires during gameplay
    this.game.events.off('game:start_with_config', this.onGameStartWithConfig);
    this.game.events.off('game:load_save', this.onLoadSave);
    this.scene.start('GalaxyMapScene', {});
  };

  private onMusicTrack = (track: unknown): void => {
    this.music?.setTrack(track as MusicTrack);
  };

  create(): void {
    const { width, height } = this.scale;

    this.createStarfield(width, height);
    this.createGalaxyBackground(width, height);
    this.createDustMotes(width, height);
    this.createTitle(width, height);
    this.createMenuButtons(width, height);
    this.createVersionLabel(width, height);

    // Remove any stale listener from a previous create() before re-registering.
    this.game.events.off('game:start_with_config', this.onGameStartWithConfig);
    this.game.events.off('game:load_save', this.onLoadSave);
    this.game.events.off('music:set_track', this.onMusicTrack);

    // React emits 'game:start_with_config' with species + galaxy config when
    // the player confirms in the game setup screen.
    this.game.events.on('game:start_with_config', this.onGameStartWithConfig);
    this.game.events.on('game:load_save', this.onLoadSave);

    // ── Audio ─────────────────────────────────────────────────────────────────
    const engine = getAudioEngine();
    if (engine) {
      this.music = new MusicGenerator(engine);
      this.sfx = new SfxGenerator(engine);

      this.input.once('pointerdown', () => {
        engine.resume();
        const sessionTrack = (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ as MusicTrack | undefined;
        if (sessionTrack) this.music?.setTrack(sessionTrack);
        this.music?.startMusic('menu');
      });

      this.game.events.on('music:set_track', this.onMusicTrack);
    }

    // Clean up listeners when the scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('game:start_with_config', this.onGameStartWithConfig);
      this.game.events.off('game:load_save', this.onLoadSave);
      this.game.events.off('music:set_track', this.onMusicTrack);
    });
  }

  update(_time: number, _delta: number): void {
    // Slowly rotate the galaxy container
    if (this.galaxyContainer) {
      this.galaxyContainer.rotation += 0.00008;
    }

    // Animate dust motes
    if (this.dustGraphics) {
      this.dustGraphics.clear();
      const { width, height } = this.scale;
      for (const mote of this.dustMotes) {
        mote.x += mote.vx;
        mote.y += mote.vy;

        // Wrap around screen edges
        if (mote.x < -5) mote.x = width + 5;
        if (mote.x > width + 5) mote.x = -5;
        if (mote.y < -5) mote.y = height + 5;
        if (mote.y > height + 5) mote.y = -5;

        this.dustGraphics.fillStyle(0x8899cc, mote.alpha);
        this.dustGraphics.fillCircle(mote.x, mote.y, mote.radius);
      }
    }
  }

  private createStarfield(width: number, height: number): void {
    const graphics = this.add.graphics();

    for (let i = 0; i < STAR_COUNT; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const brightness = Phaser.Math.FloatBetween(0.3, 1.0);
      const size = Phaser.Math.FloatBetween(0.5, 1.5);
      const alpha = Math.floor(brightness * 255);
      const color = (alpha << 16) | (alpha << 8) | alpha;

      graphics.fillStyle(color, 1);
      graphics.fillCircle(x, y, size);
    }
  }

  private createGalaxyBackground(width: number, height: number): void {
    const cx = width / 2;
    const cy = height * 0.5;

    const galaxyGraphics = this.add.graphics();
    this.galaxyContainer = this.add.container(cx, cy, [galaxyGraphics]);

    // Draw a soft glowing core
    for (let r = 40; r >= 2; r -= 4) {
      const alpha = (40 - r) / 40 * 0.06;
      galaxyGraphics.fillStyle(0xaaddff, alpha);
      galaxyGraphics.fillCircle(0, 0, r);
    }

    // Draw spiral arms
    for (let arm = 0; arm < GALAXY_ARMS; arm++) {
      const armOffset = (arm / GALAXY_ARMS) * Math.PI * 2;

      for (let i = 0; i < GALAXY_STAR_COUNT / GALAXY_ARMS; i++) {
        const t = i / (GALAXY_STAR_COUNT / GALAXY_ARMS);
        const angle = armOffset + t * Math.PI * 3.5;
        const radius = t * 160 + Phaser.Math.FloatBetween(-8, 8);
        const spread = t * 18;

        const sx = Math.cos(angle) * radius + Phaser.Math.FloatBetween(-spread, spread);
        const sy = Math.sin(angle) * radius * 0.42 + Phaser.Math.FloatBetween(-spread * 0.42, spread * 0.42);

        const brightness = Phaser.Math.FloatBetween(0.15, 0.55);
        const size = Phaser.Math.FloatBetween(0.4, 1.2);

        // Tint arms with subtle blue-white to warm-gold gradient
        const warmth = Math.random();
        let color: number;
        if (warmth > 0.7) {
          color = 0xffd080; // warm gold
        } else if (warmth > 0.4) {
          color = 0xaaccff; // cool blue
        } else {
          color = 0xffffff; // white
        }

        galaxyGraphics.fillStyle(color, brightness);
        galaxyGraphics.fillCircle(sx, sy, size);
      }
    }

    // Depth: fade the galaxy slightly so the menu text reads well
    galaxyGraphics.fillStyle(0x05050f, 0.35);
    galaxyGraphics.fillRect(-width, -height, width * 2, height * 2);
  }

  private createDustMotes(width: number, height: number): void {
    this.dustMotes = [];
    for (let i = 0; i < DUST_MOTE_COUNT; i++) {
      this.dustMotes.push({
        x: Phaser.Math.FloatBetween(0, width),
        y: Phaser.Math.FloatBetween(0, height),
        vx: Phaser.Math.FloatBetween(-0.08, 0.08),
        vy: Phaser.Math.FloatBetween(-0.04, 0.04),
        alpha: Phaser.Math.FloatBetween(0.04, 0.18),
        radius: Phaser.Math.FloatBetween(0.8, 2.2),
      });
    }

    this.dustGraphics = this.add.graphics();
  }

  private createTitle(width: number, height: number): void {
    // Subtitle
    this.add
      .text(width / 2, height * 0.28, '4X SPACE STRATEGY', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#6688aa',
        letterSpacing: 6,
      })
      .setOrigin(0.5, 0.5);

    // Main title
    this.add
      .text(width / 2, height * 0.38, 'EX NIHILO', {
        fontFamily: 'serif',
        fontSize: '72px',
        color: '#d4af6a',
        stroke: '#000000',
        strokeThickness: 4,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#d4af6a',
          blur: 20,
          fill: true,
        },
      })
      .setOrigin(0.5, 0.5);
  }

  private createMenuButtons(width: number, height: number): void {
    const buttonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#aabbcc',
    };

    const hoverStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#00d4ff',
        blur: 14,
        fill: true,
      },
    };

    const buttons: Array<{ label: string; yFrac: number; action: () => void }> = [];

    // Check whether a game is already in progress (active engine) or there is
    // an auto-save available. If so, offer a Resume button first.
    const hasActiveEngine = !!(window as unknown as Record<string, unknown>).__GAME_ENGINE__;
    const hasAutoSave = getSaveManager().getAutoSaveInfo() !== null;

    if (hasActiveEngine || hasAutoSave) {
      buttons.push({
        label: 'Resume',
        yFrac: 0.51,
        action: () => {
          this.sfx?.playClick();
          // Direct callback to React — bypasses Phaser event bridge for reliability
          const openLoad = (window as unknown as Record<string, () => void>).__EX_NIHILO_OPEN_LOAD__;
          if (openLoad) {
            openLoad();
          } else {
            this.game.events.emit('ui:load_game');
          }
        },
      });
    }

    const resumeOffset = (hasActiveEngine || hasAutoSave) ? 0.08 : 0;

    buttons.push(
      {
        label: 'New Game',
        yFrac: 0.51 + resumeOffset,
        action: () => {
          this.sfx?.playClick();
          // Direct callback to React — bypasses Phaser event bridge for reliability
          const openNewGame = (window as unknown as Record<string, () => void>).__EX_NIHILO_OPEN_NEW_GAME__;
          if (openNewGame) {
            openNewGame();
          } else {
            this.game.events.emit('ui:new_game');
          }
        },
      },
      {
        label: 'Space Battle',
        yFrac: 0.59 + resumeOffset,
        action: () => {
          this.sfx?.playClick();
          this.game.events.emit('ui:skirmish');
        },
      },
      {
        label: 'Multiplayer',
        yFrac: 0.67 + resumeOffset,
        action: () => {
          this.sfx?.playClick();
          this.game.events.emit('ui:multiplayer');
        },
      },
      {
        label: 'Settings',
        yFrac: 0.75 + resumeOffset,
        action: () => {
          this.sfx?.playClick();
          this.game.events.emit('ui:settings');
        },
      },
      {
        label: 'Credits',
        yFrac: 0.83 + resumeOffset,
        action: () => {
          this.sfx?.playClick();
          this.showCreditsOverlay(width, height);
        },
      },
    );

    for (const btn of buttons) {
      const text = this.add
        .text(width / 2, height * btn.yFrac, btn.label, buttonStyle)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      this.applyButtonHover(text, buttonStyle, hoverStyle);
      text.on('pointerdown', btn.action);
    }
  }

  private showCreditsOverlay(width: number, height: number): void {
    if (this.creditsOverlay) {
      this.creditsOverlay.destroy();
      this.creditsOverlay = null;
      return;
    }

    const bg = this.add.graphics();
    bg.fillStyle(0x030308, 0.88);
    bg.fillRoundedRect(-280, -200, 560, 400, 8);
    bg.lineStyle(1, 0x00d4ff, 0.3);
    bg.strokeRoundedRect(-280, -200, 560, 400, 8);

    const title = this.add
      .text(0, -165, 'CREDITS', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#00d4ff',
        letterSpacing: 6,
      })
      .setOrigin(0.5, 0.5);

    const lines = [
      'EX NIHILO',
      'A 4X Space Strategy Game',
      '',
      'Developed by',
      'Meridian Logic Ltd',
      '',
      'Built with Phaser 3, React, TypeScript',
      '',
      'All rights reserved',
    ];

    const creditTexts: Phaser.GameObjects.Text[] = lines.map((line, i) => {
      const isHeading = i === 0 || line === 'Developed by' || line === 'Built with Phaser 3, React, TypeScript' || line === 'All rights reserved';
      return this.add
        .text(0, -120 + i * 26, line, {
          fontFamily: 'monospace',
          fontSize: isHeading ? '13px' : '11px',
          color: isHeading ? '#d0e8ff' : '#6688aa',
        })
        .setOrigin(0.5, 0.5);
    });

    const closeBtn = this.add
      .text(0, 170, '[ Close ]', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#6688aa',
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#6688aa'));
    closeBtn.on('pointerdown', () => {
      this.sfx?.playClick();
      if (this.creditsOverlay) {
        this.creditsOverlay.destroy();
        this.creditsOverlay = null;
      }
    });

    this.creditsOverlay = this.add.container(width / 2, height / 2, [
      bg,
      title,
      ...creditTexts,
      closeBtn,
    ]);

    // Bring credits overlay to top
    this.creditsOverlay.setDepth(100);
  }

  private createVersionLabel(width: number, height: number): void {
    this.add
      .text(width - 12, height - 10, VERSION, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#445566',
      })
      .setOrigin(1, 1);
  }

  private applyButtonHover(
    button: Phaser.GameObjects.Text,
    normal: Phaser.Types.GameObjects.Text.TextStyle,
    hover: Phaser.Types.GameObjects.Text.TextStyle,
  ): void {
    button.on('pointerover', () => {
      button.setStyle(hover);
      this.tweens.add({
        targets: button,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 120,
        ease: 'Sine.easeOut',
      });
      this.sfx?.playHover();
    });
    button.on('pointerout', () => {
      button.setStyle(normal);
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Sine.easeIn',
      });
    });
  }
}
