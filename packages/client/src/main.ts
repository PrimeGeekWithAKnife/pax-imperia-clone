/**
 * Ex Nihilo - Game Client Entry Point
 */

import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { mountUI } from './ui/index';

// Create the Phaser game instance
const config = createGameConfig();
const game = new Phaser.Game(config);

// Mount the React UI overlay on top of the Phaser canvas
mountUI();

// Expose game instance for React ↔ Phaser event bridging.
// This must always be set (not just in DEV) because useGameEvent hooks
// and manual event emitters in React rely on window.__EX_NIHILO_GAME__ to
// communicate with Phaser scenes.
(window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ = game;
