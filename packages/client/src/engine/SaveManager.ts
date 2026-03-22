/**
 * SaveManager — persists game state to browser localStorage.
 *
 * Each save slot is stored under the key:
 *   nova-imperia:save:<name>
 *
 * An index of available saves is maintained at:
 *   nova-imperia:save-index
 *
 * This is intentionally simple so it can be swapped for Tauri filesystem
 * APIs in a desktop build without changing the public interface.
 */

import {
  createSaveGame,
  loadSaveGame,
} from '@nova-imperia/shared';
import type { SaveGame } from '@nova-imperia/shared';
import type { GameTickState } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAVE_KEY_PREFIX = 'nova-imperia:save:';
const INDEX_KEY = 'nova-imperia:save-index';
const AUTO_SAVE_NAME = '__autosave__';
/** Trigger an auto-save every this many ticks. */
const AUTO_SAVE_INTERVAL = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveSlotInfo {
  /** The user-visible name of the save slot. */
  name: string;
  /** Unix timestamp (ms) from the SaveGame envelope. */
  timestamp: number;
  /** Name of the player's empire at the time of saving. */
  empireName: string;
  /** Tick counter at the time of saving. */
  currentTick: number;
}

// ---------------------------------------------------------------------------
// SaveManager
// ---------------------------------------------------------------------------

export class SaveManager {
  // ── Save ───────────────────────────────────────────────────────────────────

  /**
   * Serialise `tickState` and write it to localStorage under `name`.
   *
   * Throws if localStorage is unavailable or full.
   */
  save(name: string, tickState: GameTickState): void {
    const saveGame = createSaveGame(tickState, name);
    const key = SAVE_KEY_PREFIX + name;
    localStorage.setItem(key, JSON.stringify(saveGame));
    this._addToIndex(name, saveGame);
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  /**
   * Deserialise the save stored under `name` and return a GameTickState.
   *
   * Returns `null` if no save with that name exists or the data is corrupted.
   */
  load(name: string): GameTickState | null {
    const key = SAVE_KEY_PREFIX + name;
    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    let parsed: SaveGame;
    try {
      parsed = JSON.parse(raw) as SaveGame;
    } catch {
      console.error(`[SaveManager.load] Corrupt save data for "${name}"`);
      return null;
    }

    try {
      return loadSaveGame(parsed);
    } catch (err) {
      console.error(`[SaveManager.load] Failed to load save "${name}":`, err);
      return null;
    }
  }

  // ── List ───────────────────────────────────────────────────────────────────

  /**
   * Return metadata for all save slots, sorted newest-first.
   *
   * Auto-saves are included with name `__autosave__`.
   */
  listSaves(): SaveSlotInfo[] {
    const index = this._readIndex();
    return index.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  /** Remove the save with the given name from localStorage and the index. */
  deleteSave(name: string): void {
    const key = SAVE_KEY_PREFIX + name;
    localStorage.removeItem(key);
    this._removeFromIndex(name);
  }

  // ── Auto-save ──────────────────────────────────────────────────────────────

  /**
   * Overwrite the auto-save slot if the current tick is a multiple of
   * AUTO_SAVE_INTERVAL (100).
   *
   * Call this inside the GameEngine tick loop; it is a no-op for most ticks.
   */
  autoSave(tickState: GameTickState): void {
    const tick = tickState.gameState.currentTick;
    if (tick > 0 && tick % AUTO_SAVE_INTERVAL === 0) {
      try {
        this.save(AUTO_SAVE_NAME, tickState);
      } catch (err) {
        console.warn('[SaveManager.autoSave] Auto-save failed:', err);
      }
    }
  }

  /** Return the SaveSlotInfo for the auto-save, or null if none exists. */
  getAutoSaveInfo(): SaveSlotInfo | null {
    return this._readIndex().find(s => s.name === AUTO_SAVE_NAME) ?? null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _readIndex(): SaveSlotInfo[] {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SaveSlotInfo[];
    } catch {
      return [];
    }
  }

  private _writeIndex(index: SaveSlotInfo[]): void {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  private _addToIndex(name: string, saveGame: SaveGame): void {
    const index = this._readIndex().filter(s => s.name !== name);
    index.push({
      name,
      timestamp: saveGame.timestamp,
      empireName: saveGame.empireName,
      currentTick: saveGame.tickState.gameState.currentTick,
    });
    this._writeIndex(index);
  }

  private _removeFromIndex(name: string): void {
    const index = this._readIndex().filter(s => s.name !== name);
    this._writeIndex(index);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: SaveManager | null = null;

/** Return (or lazily create) the shared SaveManager instance. */
export function getSaveManager(): SaveManager {
  if (!_instance) _instance = new SaveManager();
  return _instance;
}
