import Phaser from 'phaser';
import { getAudioEngine, MusicGenerator, SfxGenerator } from '../../audio';

const STAR_COUNT = 200;

/**
 * MainMenuScene renders the game title, a starfield background, and
 * interactive text buttons for the player's first actions.
 */
export class MainMenuScene extends Phaser.Scene {
  private music: MusicGenerator | null = null;
  private sfx: SfxGenerator | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  private onGameStartWithConfig = (data: { species: unknown; config: unknown }): void => {
    console.log('[MainMenuScene] game:start_with_config received – launching galaxy map', data);
    this.scene.start('GalaxyMapScene', { setupData: data });
  };

  create(): void {
    const { width, height } = this.scale;

    this.createStarfield(width, height);
    this.createTitle(width, height);
    this.createMenuButtons(width, height);

    // Remove any stale listener from a previous create() before re-registering.
    this.game.events.off('game:start_with_config', this.onGameStartWithConfig);

    // React emits 'game:start_with_config' with species + galaxy config when
    // the player confirms in the game setup screen.
    this.game.events.on('game:start_with_config', this.onGameStartWithConfig);

    // ── Audio ─────────────────────────────────────────────────────────────────
    // Initialise audio generators (AudioEngine singleton already exists from
    // BootScene).  Music actually starts on the first user interaction so we
    // satisfy the browser autoplay policy.
    const engine = getAudioEngine();
    if (engine) {
      this.music = new MusicGenerator(engine);
      this.sfx = new SfxGenerator(engine);

      // Listen for the first pointer-down on the canvas to resume the
      // AudioContext and start the menu music.
      this.input.once('pointerdown', () => {
        engine.resume();
        this.music?.startMusic('menu');
      });
    }
  }

  private createStarfield(width: number, height: number): void {
    const graphics = this.add.graphics();

    for (let i = 0; i < STAR_COUNT; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      // Vary star brightness and size for depth effect
      const brightness = Phaser.Math.FloatBetween(0.3, 1.0);
      const size = Phaser.Math.FloatBetween(0.5, 1.5);
      const alpha = Math.floor(brightness * 255);
      const color = (alpha << 16) | (alpha << 8) | alpha;

      graphics.fillStyle(color, 1);
      graphics.fillCircle(x, y, size);
    }
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
    const buttonStyle = {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#aabbcc',
    };

    const hoverStyle = {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
    };

    const newGameButton = this.add
      .text(width / 2, height * 0.58, 'New Game', buttonStyle)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    const settingsButton = this.add
      .text(width / 2, height * 0.68, 'Settings', buttonStyle)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.applyButtonHover(newGameButton, buttonStyle, hoverStyle);
    this.applyButtonHover(settingsButton, buttonStyle, hoverStyle);

    newGameButton.on('pointerdown', () => {
      console.log('[MainMenuScene] New Game clicked – opening species creator');
      this.sfx?.playClick();
      // Emit to React UI so the species creator screen is shown.
      // React will emit 'game:start' back with the created species when ready.
      this.game.events.emit('ui:new_game');
    });

    settingsButton.on('pointerdown', () => {
      console.log('[MainMenuScene] Settings clicked – not yet implemented');
      this.sfx?.playClick();
    });
  }

  private applyButtonHover(
    button: Phaser.GameObjects.Text,
    normal: Phaser.Types.GameObjects.Text.TextStyle,
    hover: Phaser.Types.GameObjects.Text.TextStyle,
  ): void {
    button.on('pointerover', () => {
      button.setStyle(hover);
      this.sfx?.playHover();
    });
    button.on('pointerout', () => button.setStyle(normal));
  }
}
