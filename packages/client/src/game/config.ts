import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GalaxyMapScene } from './scenes/GalaxyMapScene';
import { SystemViewScene } from './scenes/SystemViewScene';
import { CombatScene } from './scenes/CombatScene';
import { GroundCombatScene } from './scenes/GroundCombatScene';

/**
 * Creates and returns the Phaser game configuration.
 */
export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#05050f',
    parent: 'game-container',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MainMenuScene, GalaxyMapScene, SystemViewScene, CombatScene, GroundCombatScene],
  };
}
