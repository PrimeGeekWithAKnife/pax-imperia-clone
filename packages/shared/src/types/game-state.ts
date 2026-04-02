/** Game state and lobby types */

import type { Galaxy } from './galaxy.js';
import type { Empire } from './species.js';
import type { Fleet, Ship } from './ships.js';
import type { GameSpeedName, GalaxySize } from '../constants/game.js';

export type GameStatus = 'lobby' | 'playing' | 'paused' | 'finished';

export interface GameState {
  id: string;
  galaxy: Galaxy;
  empires: Empire[];
  fleets: Fleet[];
  ships: Ship[];
  currentTick: number;
  speed: GameSpeedName;
  status: GameStatus;
  /** Which victory conditions are active for this game.  When empty or absent, all are enabled. */
  victoryCriteria?: VictoryCriteria[];
}

/** Settings provided when creating a new game */
export interface GameConfig {
  galaxySize: GalaxySize;
  maxPlayers: number;
  /** Seed for deterministic galaxy generation; omit for random */
  seed?: number;
  allowAI: boolean;
  victoryCriteria: VictoryCriteria[];
}

export type VictoryCriteria =
  | 'conquest'      // Control 75% of colonisable planets + eliminate 75% of rivals
  | 'dominance'     // Lead the Galactic Council + own 50% of habitable planets
  | 'economic'      // Reach credit threshold first
  | 'research'      // Research all techs first
  | 'diplomatic'    // Form alliances with a majority of empires
  | 'score';        // Highest combined score when tick limit reached

export interface PlayerSlot {
  slotIndex: number;
  playerId: string | null;
  isAI: boolean;
  isReady: boolean;
  empireId: string | null;
}
