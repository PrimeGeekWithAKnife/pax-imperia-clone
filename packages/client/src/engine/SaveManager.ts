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
/** Prefix for rolling auto-save slots. */
const AUTO_SAVE_PREFIX = '__autosave_';
/** Maximum number of rolling auto-save slots to keep. */
const MAX_AUTO_SAVES = 5;
/** Auto-save interval in milliseconds of real (wall-clock) time. */
const AUTO_SAVE_INTERVAL_MS = 60_000;

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
   * Auto-saves are included with names `__autosave_1__` through `__autosave_5__`.
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

  /** Timestamp of the last auto-save (wall-clock ms). */
  private lastAutoSaveTime = 0;

  /**
   * Create a rolling auto-save if enough real time has elapsed since the
   * last one. Keeps at most MAX_AUTO_SAVES slots (`__autosave_1__` through
   * `__autosave_5__`), rotating the oldest out each time.
   *
   * Call this inside the GameEngine tick loop; it is a cheap no-op for
   * most ticks since it compares wall-clock timestamps.
   */
  autoSave(tickState: GameTickState): void {
    const now = Date.now();
    if (this.lastAutoSaveTime > 0 && now - this.lastAutoSaveTime < AUTO_SAVE_INTERVAL_MS) {
      return;
    }

    try {
      this._rotateAutoSaves();
      const slotName = `${AUTO_SAVE_PREFIX}1__`;
      this.save(slotName, tickState);
      this.lastAutoSaveTime = now;
    } catch (err) {
      console.warn('[SaveManager.autoSave] Auto-save failed:', err);
    }
  }

  /**
   * Shift auto-save slots down (5 deleted, 4 to 5, ..., 1 to 2) to make
   * room for a new save at slot 1.
   */
  private _rotateAutoSaves(): void {
    const oldestName = `${AUTO_SAVE_PREFIX}${MAX_AUTO_SAVES}__`;
    this.deleteSave(oldestName);

    for (let i = MAX_AUTO_SAVES - 1; i >= 1; i--) {
      const currentName = `${AUTO_SAVE_PREFIX}${i}__`;
      const nextName = `${AUTO_SAVE_PREFIX}${i + 1}__`;
      const key = SAVE_KEY_PREFIX + currentName;
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        localStorage.setItem(SAVE_KEY_PREFIX + nextName, raw);
        localStorage.removeItem(key);
        const index = this._readIndex();
        const entry = index.find(s => s.name === currentName);
        if (entry) {
          entry.name = nextName;
          this._writeIndex(index);
        }
      }
    }
  }

  /** Return the SaveSlotInfo for the most recent auto-save (slot 1), or null if none exists. */
  getAutoSaveInfo(): SaveSlotInfo | null {
    const index = this._readIndex();
    for (let i = 1; i <= MAX_AUTO_SAVES; i++) {
      const slotName = `${AUTO_SAVE_PREFIX}${i}__`;
      const entry = index.find(s => s.name === slotName);
      if (entry) return entry;
    }
    return index.find(s => s.name === '__autosave__') ?? null;
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
