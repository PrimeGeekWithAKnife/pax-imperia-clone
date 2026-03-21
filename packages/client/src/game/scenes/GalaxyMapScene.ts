import Phaser from 'phaser';

/**
 * GalaxyMapScene is a placeholder for the interactive galaxy map.
 * Full implementation is planned for Milestone 1.
 */
export class GalaxyMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GalaxyMapScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x03030c).setOrigin(0, 0);

    this.add
      .text(width / 2, height / 2, 'Galaxy Map\nComing Soon', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#6688aa',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    // Back to main menu
    const backButton = this.add
      .text(40, 40, '← Main Menu', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#8899aa',
      })
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setColor('#ffffff'));
    backButton.on('pointerout', () => backButton.setColor('#8899aa'));
    backButton.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
  }
}
