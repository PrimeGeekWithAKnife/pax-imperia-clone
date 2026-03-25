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
   * If `compress` is true, strips regenerable data (anomalies, minorSpecies)
   * from the galaxy before serialising to reduce save size.
   *
   * On QuotaExceededError, deletes the oldest auto-save and retries once.
   * Manual saves are never blocked by auto-save data.
   */
  save(name: string, tickState: GameTickState, compress = false): void {
    const stateToSave = compress ? this._compressTickState(tickState) : tickState;
    const saveGame = createSaveGame(stateToSave, name);
    const json = JSON.stringify(saveGame);
    const key = SAVE_KEY_PREFIX + name;

    this._ensureStorageSpace(json.length);
    this._safeSetItem(key, json, name);
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
      // Auto-saves always use compression to minimise quota usage.
      this.save(slotName, tickState, true);
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
        this._safeSetItem(SAVE_KEY_PREFIX + nextName, raw, nextName);
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

  // ── Storage quota management ──────────────────────────────────────────────

  /**
   * Proactively free localStorage space before writing.
   *
   * Estimates whether `estimatedSize` bytes will fit. If not, deletes the
   * oldest auto-saves one at a time until there is likely enough room (or no
   * auto-saves remain). This ensures manual saves are never blocked by
   * auto-save data.
   */
  private _ensureStorageSpace(estimatedSize: number): void {
    // localStorage typically allows ~5MB. Estimate current usage.
    let totalUsed = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) totalUsed += key.length + value.length;
      }
    }

    // Assume 5MB limit (characters, roughly 2 bytes each, but localStorage
    // uses UTF-16 so each char is ~2 bytes — the 5MB limit is in characters).
    const limit = 5 * 1024 * 1024;
    const available = limit - totalUsed;

    if (available >= estimatedSize) return;

    // Delete auto-saves from oldest to newest until space is freed.
    for (let i = MAX_AUTO_SAVES; i >= 1; i--) {
      const slotName = `${AUTO_SAVE_PREFIX}${i}__`;
      const key = SAVE_KEY_PREFIX + slotName;
      const existing = localStorage.getItem(key);
      if (existing) {
        console.warn(`[SaveManager] Deleting auto-save "${slotName}" to free storage space`);
        this.deleteSave(slotName);
        totalUsed -= (key.length + existing.length);
        if (limit - totalUsed >= estimatedSize) return;
      }
    }

    // Also try the legacy auto-save slot name
    const legacyKey = SAVE_KEY_PREFIX + '__autosave__';
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue) {
      console.warn('[SaveManager] Deleting legacy auto-save to free storage space');
      this.deleteSave('__autosave__');
    }
  }

  /**
   * Wrapper around `localStorage.setItem` that catches QuotaExceededError,
   * deletes the oldest auto-save, and retries once.
   */
  private _safeSetItem(key: string, value: string, saveName: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      if (this._isQuotaExceeded(err)) {
        console.warn(`[SaveManager] QuotaExceededError writing "${saveName}" — freeing auto-save space and retrying`);
        this._deleteOldestAutoSave();
        try {
          localStorage.setItem(key, value);
        } catch (retryErr) {
          console.error(`[SaveManager] Failed to write "${saveName}" even after freeing space:`, retryErr);
          throw retryErr;
        }
      } else {
        throw err;
      }
    }
  }

  /** Delete the single oldest auto-save to reclaim space. */
  private _deleteOldestAutoSave(): void {
    for (let i = MAX_AUTO_SAVES; i >= 1; i--) {
      const slotName = `${AUTO_SAVE_PREFIX}${i}__`;
      const key = SAVE_KEY_PREFIX + slotName;
      if (localStorage.getItem(key) !== null) {
        console.warn(`[SaveManager] Evicting auto-save "${slotName}" to reclaim quota`);
        this.deleteSave(slotName);
        return;
      }
    }
    // Try legacy slot
    if (localStorage.getItem(SAVE_KEY_PREFIX + '__autosave__') !== null) {
      this.deleteSave('__autosave__');
    }
  }

  /** Check if an error is a QuotaExceededError. */
  private _isQuotaExceeded(err: unknown): boolean {
    if (err instanceof DOMException) {
      // Most browsers use code 22 or name 'QuotaExceededError'.
      return err.code === 22 || err.name === 'QuotaExceededError';
    }
    return false;
  }

  // ── Save compression ──────────────────────────────────────────────────────

  /**
   * Strip regenerable data from the tick state to reduce save size.
   *
   * The galaxy's `anomalies` and `minorSpecies` arrays can be regenerated
   * from the galaxy seed, so they are replaced with empty arrays.
   */
  private _compressTickState(tickState: GameTickState): GameTickState {
    return {
      ...tickState,
      gameState: {
        ...tickState.gameState,
        galaxy: {
          ...tickState.gameState.galaxy,
          anomalies: [],
          minorSpecies: [],
        },
      },
    };
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
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    } catch (err) {
      if (this._isQuotaExceeded(err)) {
        this._deleteOldestAutoSave();
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));
      } else {
        throw err;
      }
    }
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
