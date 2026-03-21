import Phaser from 'phaser';
import { initAudioEngine } from '../../audio';

/**
 * BootScene is the first scene loaded. It displays a loading indicator
 * and transitions to the MainMenuScene once initialization is complete.
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

    const loadingText = this.add.text(width / 2, height / 2, 'Loading...', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#8888aa',
    });
    loadingText.setOrigin(0.5, 0.5);

    // Brief delay before transitioning to let the engine fully initialize
    this.time.delayedCall(500, () => {
      this.scene.start('MainMenuScene');
    });
  }
}
