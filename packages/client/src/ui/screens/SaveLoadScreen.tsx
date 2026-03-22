/**
 * SaveLoadScreen — tabbed modal for saving and loading the game.
 *
 * Rendered as a full-screen overlay from PauseMenu.  Receives its initial
 * tab via the `initialTab` prop so the PauseMenu's "Save Game" and
 * "Load Game" buttons can open the correct tab directly.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { getSaveManager } from '../../engine/SaveManager.js';
import type { SaveSlotInfo } from '../../engine/SaveManager.js';
import { getGameEngine } from '../../engine/GameEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaveLoadTab = 'save' | 'load';

export interface SaveLoadScreenProps {
  initialTab: SaveLoadTab;
  onClose: () => void;
  /** Called after a save has been successfully loaded so the caller can apply it. */
  onLoaded: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTO_SAVE_NAME = '__autosave__';

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatSaveName(name: string): string {
  return name === AUTO_SAVE_NAME ? 'Auto-save' : name;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SaveTabProps {
  onSaved: (name: string) => void;
}

function SaveTab({ onSaved }: SaveTabProps): React.ReactElement {
  const [saveName, setSaveName] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = useCallback(() => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setStatus('error');
      setErrorMsg('Please enter a save name.');
      return;
    }
    if (trimmed === AUTO_SAVE_NAME) {
      setStatus('error');
      setErrorMsg('"__autosave__" is reserved for auto-saves.');
      return;
    }

    const engine = getGameEngine();
    if (!engine) {
      setStatus('error');
      setErrorMsg('No active game to save.');
      return;
    }

    try {
      getSaveManager().save(trimmed, engine.getState());
      setStatus('success');
      setErrorMsg('');
      onSaved(trimmed);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Save failed.');
    }
  }, [saveName, onSaved]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSave();
    },
    [handleSave],
  );

  return (
    <div className="sl-tab-content">
      <div className="sl-save-form">
        <label className="sl-label" htmlFor="sl-save-name">
          Save Name
        </label>
        <input
          id="sl-save-name"
          type="text"
          className="sc-input sl-name-input"
          value={saveName}
          onChange={(e) => {
            setSaveName(e.target.value);
            setStatus('idle');
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter save name…"
          maxLength={64}
          autoFocus
        />

        <button
          type="button"
          className="sc-btn sc-btn--primary sl-save-btn"
          onClick={handleSave}
          disabled={!saveName.trim()}
        >
          Save Game
        </button>
      </div>

      {status === 'success' && (
        <div className="sl-status sl-status--ok">
          Game saved as &ldquo;{saveName.trim()}&rdquo;.
        </div>
      )}
      {status === 'error' && (
        <div className="sl-status sl-status--err">{errorMsg}</div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

interface LoadTabProps {
  onLoaded: () => void;
}

function LoadTab({ onLoaded }: LoadTabProps): React.ReactElement {
  const [saves, setSaves] = useState<SaveSlotInfo[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const refresh = useCallback(() => {
    setSaves(getSaveManager().listSaves());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLoad = useCallback(
    (name: string) => {
      const engine = getGameEngine();
      if (!engine) {
        setErrorMsg('No active game engine — cannot load.');
        return;
      }
      const tickState = getSaveManager().load(name);
      if (!tickState) {
        setErrorMsg(`Failed to load "${formatSaveName(name)}".`);
        return;
      }
      engine.loadState(tickState);
      setErrorMsg('');
      onLoaded();
    },
    [onLoaded],
  );

  const handleDeleteConfirmed = useCallback(
    (name: string) => {
      getSaveManager().deleteSave(name);
      setConfirmDelete(null);
      refresh();
    },
    [refresh],
  );

  const autoSave = getSaveManager().getAutoSaveInfo();

  if (saves.length === 0) {
    return (
      <div className="sl-tab-content sl-empty">
        <span className="sl-empty-text">No saved games found.</span>
      </div>
    );
  }

  return (
    <div className="sl-tab-content">
      {errorMsg && <div className="sl-status sl-status--err">{errorMsg}</div>}

      {autoSave && (
        <div className="sl-autosave-info">
          Last auto-save: {formatTimestamp(autoSave.timestamp)}
          &ensp;(tick&nbsp;{autoSave.currentTick})
        </div>
      )}

      <ul className="sl-save-list" role="list">
        {saves.map((slot) => (
          <li key={slot.name} className="sl-save-item">
            <button
              type="button"
              className="sl-save-item__main"
              onClick={() => handleLoad(slot.name)}
              title={`Load "${formatSaveName(slot.name)}"`}
            >
              <span className="sl-save-item__name">{formatSaveName(slot.name)}</span>
              <span className="sl-save-item__meta">
                {slot.empireName} &middot; Tick&nbsp;{slot.currentTick}
              </span>
              <span className="sl-save-item__date">{formatTimestamp(slot.timestamp)}</span>
            </button>

            {slot.name !== AUTO_SAVE_NAME && (
              confirmDelete === slot.name ? (
                <div className="sl-delete-confirm">
                  <span className="sl-delete-confirm__msg">Delete this save?</span>
                  <button
                    type="button"
                    className="sc-btn sc-btn--secondary sl-confirm-btn"
                    onClick={() => setConfirmDelete(null)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="sc-btn sc-btn--danger sl-confirm-btn"
                    onClick={() => handleDeleteConfirmed(slot.name)}
                  >
                    Yes
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="sl-delete-btn"
                  onClick={() => setConfirmDelete(slot.name)}
                  title="Delete this save"
                  aria-label={`Delete save "${slot.name}"`}
                >
                  ✕
                </button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SaveLoadScreen({
  initialTab,
  onClose,
  onLoaded,
}: SaveLoadScreenProps): React.ReactElement {
  const [tab, setTab] = useState<SaveLoadTab>(initialTab);
  const [savedConfirm, setSavedConfirm] = useState<string | null>(null);

  const handleSaved = useCallback((name: string) => {
    setSavedConfirm(name);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return (
    <div className="sl-overlay" role="dialog" aria-modal="true" aria-label="Save / Load Game">
      {/* Backdrop */}
      <div className="sl-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="sl-modal">
        {/* Header */}
        <div className="sl-header">
          <span className="sl-title">
            {tab === 'save' ? 'Save Game' : 'Load Game'}
          </span>
          <button type="button" className="sl-close-btn panel-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="sl-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'save'}
            className={`sl-tab ${tab === 'save' ? 'sl-tab--active' : ''}`}
            onClick={() => setTab('save')}
          >
            Save Game
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'load'}
            className={`sl-tab ${tab === 'load' ? 'sl-tab--active' : ''}`}
            onClick={() => setTab('load')}
          >
            Load Game
          </button>
        </div>

        {/* Tab content */}
        <div className="sl-body">
          {tab === 'save' ? (
            <SaveTab onSaved={handleSaved} />
          ) : (
            <LoadTab onLoaded={onLoaded} />
          )}
        </div>

        {savedConfirm && (
          <div className="sl-toast">
            Saved: &ldquo;{savedConfirm}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
