/**
 * Nova Imperia - Game Client Entry Point
 * A modern clone of Pax Imperia: Eminent Domain
 */

import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { mountUI } from './ui/index';

// Create the Phaser game instance
const config = createGameConfig();
const game = new Phaser.Game(config);

// Mount the React UI overlay on top of the Phaser canvas
mountUI();

// Expose game instance for debugging in development
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__NOVA_GAME__ = game;
}
