import React, { useState, useCallback, useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PauseMenuProps {
  onResume: () => void;
  onExitToMainMenu: () => void;
}

type ToastMessage = { id: number; text: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

function emitToPhaser(eventName: string, data?: unknown): void {
  const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
    | { events: { emit: (e: string, d: unknown) => void } }
    | undefined;
  game?.events.emit(eventName, data ?? null);
}

let toastCounter = 0;

// ── Sub-panels ─────────────────────────────────────────────────────────────────

interface SettingsPanelProps {
  onClose: () => void;
}

function SettingsPanel({ onClose }: SettingsPanelProps): React.ReactElement {
  const [masterVolume, setMasterVolume] = useState(80);
  const [musicVolume, setMusicVolume] = useState(60);
  const [sfxVolume, setSfxVolume] = useState(80);

  return (
    <div className="pm-settings-panel">
      <div className="pm-settings-panel__header">
        <span className="pm-settings-panel__title">SETTINGS</span>
        <button type="button" className="pm-settings-panel__close panel-close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="pm-settings-section">
        <div className="pm-settings-section__label">AUDIO</div>

        <div className="pm-settings-row">
          <span className="pm-settings-label">Master Volume</span>
          <div className="pm-settings-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="sc-range pm-range"
            />
            <span className="pm-settings-val">{masterVolume}%</span>
          </div>
        </div>

        <div className="pm-settings-row">
          <span className="pm-settings-label">Music</span>
          <div className="pm-settings-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="sc-range pm-range"
            />
            <span className="pm-settings-val">{musicVolume}%</span>
          </div>
        </div>

        <div className="pm-settings-row">
          <span className="pm-settings-label">Sound Effects</span>
          <div className="pm-settings-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              value={sfxVolume}
              onChange={(e) => setSfxVolume(Number(e.target.value))}
              className="sc-range pm-range"
            />
            <span className="pm-settings-val">{sfxVolume}%</span>
          </div>
        </div>
      </div>

      <div className="pm-settings-section">
        <div className="pm-settings-section__label">CONTROLS</div>
        <div className="pm-controls-grid">
          {[
            { key: 'Escape',        action: 'Pause / Resume' },
            { key: 'Scroll',        action: 'Zoom map'       },
            { key: 'Click + Drag',  action: 'Pan map'        },
            { key: 'Click system',  action: 'Select system'  },
            { key: 'R',             action: 'Open Research'  },
            { key: 'D',             action: 'Diplomacy'      },
            { key: 'S',             action: 'Ship Designer'  },
          ].map(({ key, action }) => (
            <React.Fragment key={key}>
              <span className="pm-controls-key">{key}</span>
              <span className="pm-controls-action">{action}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps): React.ReactElement {
  return (
    <div className="pm-confirm-overlay">
      <div className="pm-confirm">
        <div className="pm-confirm__message">{message}</div>
        <div className="pm-confirm__actions">
          <button type="button" className="sc-btn sc-btn--secondary pm-confirm-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="sc-btn sc-btn--primary pm-confirm-btn" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PauseMenu({ onResume, onExitToMainMenu }: PauseMenuProps): React.ReactElement {
  const [showSettings, setShowSettings] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const handleResume = useCallback(() => {
    emitToPhaser('game:resume');
    onResume();
  }, [onResume]);

  const handleSaveGame = useCallback(() => {
    addToast('Save Game — Coming Soon');
  }, [addToast]);

  const handleLoadGame = useCallback(() => {
    addToast('Load Game — Coming Soon');
  }, [addToast]);

  const handleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const handleExitToMenu = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  const handleConfirmExit = useCallback(() => {
    emitToPhaser('game:exit_to_menu');
    setShowExitConfirm(false);
    onExitToMainMenu();
  }, [onExitToMainMenu]);

  const handleQuit = useCallback(() => {
    // Try Tauri API first (desktop build), fall back to main menu
    const tauriWindow = (window as unknown as Record<string, unknown>).__TAURI__ as
      | { window?: { getCurrent?: () => { close?: () => void } } }
      | undefined;
    const close = tauriWindow?.window?.getCurrent?.()?.close;
    if (typeof close === 'function') {
      close();
    } else {
      emitToPhaser('game:exit_to_menu');
      onExitToMainMenu();
    }
  }, [onExitToMainMenu]);

  // Escape key closes settings panel first, then resumes game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showExitConfirm) {
          setShowExitConfirm(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else {
          handleResume();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showSettings, showExitConfirm, handleResume]);

  return (
    <div className="pause-menu-overlay">
      {/* Backdrop */}
      <div className="pause-menu-backdrop" onClick={handleResume} />

      {/* Modal */}
      <div className="pause-menu">
        <div className="pause-menu__game-title">EX NIHILO</div>
        <div className="pause-menu__paused">PAUSED</div>

        <nav className="pause-menu__buttons">
          <button type="button" className="pm-btn pm-btn--primary" onClick={handleResume}>
            Resume
          </button>
          <button type="button" className="pm-btn" onClick={handleSaveGame}>
            Save Game
          </button>
          <button type="button" className="pm-btn" onClick={handleLoadGame}>
            Load Game
          </button>
          <button
            type="button"
            className={`pm-btn ${showSettings ? 'pm-btn--active' : ''}`}
            onClick={handleSettings}
          >
            Settings
          </button>
          <button type="button" className="pm-btn pm-btn--danger" onClick={handleExitToMenu}>
            Exit to Main Menu
          </button>
          <button type="button" className="pm-btn pm-btn--danger" onClick={handleQuit}>
            Quit Game
          </button>
        </nav>
      </div>

      {/* Settings side-panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* Confirm exit dialog */}
      {showExitConfirm && (
        <ConfirmDialog
          message="Return to the main menu? Unsaved progress will be lost."
          onConfirm={handleConfirmExit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}

      {/* Toast messages */}
      <div className="pm-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="pm-toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
