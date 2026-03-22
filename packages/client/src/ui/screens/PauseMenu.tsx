import React, { useState, useCallback, useEffect } from 'react';
import { getAudioEngine } from '../../audio';
import type { MusicTrack } from '../../audio';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PauseMenuProps {
  onResume: () => void;
  onExitToMainMenu: () => void;
  /** Open the save/load screen in save mode. */
  onSaveGame?: () => void;
  /** Open the save/load screen in load mode. */
  onLoadGame?: () => void;
}

type ToastMessage = { id: number; text: string };

// ── Helpers ────────────────────────────────────────────────────────────────────

function emitToPhaser(eventName: string, data?: unknown): void {
  const game = (window as unknown as Record<string, unknown>).__EX_NIHILO_GAME__ as
    | { events: { emit: (e: string, d: unknown) => void } }
    | undefined;
  game?.events.emit(eventName, data ?? null);
}

function setSessionTrack(track: MusicTrack): void {
  (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ = track;
}

let toastCounter = 0;

// ── Settings persistence ────────────────────────────────────────────────────

const SETTINGS_STORAGE_KEY = 'ex_nihilo_settings';

interface PersistedSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  musicTrack: MusicTrack;
  defaultGameSpeed: string;
  showTooltips: boolean;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  masterVolume: 30,
  musicVolume: 40,
  sfxVolume: 50,
  ambientVolume: 30,
  musicTrack: 'deep_space',
  defaultGameSpeed: 'normal',
  showTooltips: true,
};

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Corrupted data — fall back to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/** Exported so other components can read the persisted settings. */
export function getPersistedSettings(): PersistedSettings {
  return loadSettings();
}

// ── Music track metadata ───────────────────────────────────────────────────────

interface TrackOption {
  id: MusicTrack;
  label: string;
  description: string;
}

const TRACK_OPTIONS: TrackOption[] = [
  {
    id: 'deep_space',
    label: 'Deep Space',
    description: 'Eerie ambient drones and slow modulation. Atmospheric and unsettling.',
  },
  {
    id: 'exploration',
    label: 'Exploration',
    description: 'Warm pentatonic arpeggio with gentle pad chords. Hopeful and melodic.',
  },
  {
    id: 'tension',
    label: 'Tension',
    description: 'Low drones, dissonant intervals and percussive stabs. Urgent and dark.',
  },
  {
    id: 'serenity',
    label: 'Serenity',
    description: 'Minimal sustained pad with very slow filter sweeps. Calm and meditative.',
  },
];

// ── Sub-panels ─────────────────────────────────────────────────────────────────

interface SettingsPanelProps {
  onClose: () => void;
}

function SettingsPanel({ onClose }: SettingsPanelProps): React.ReactElement {
  // Load persisted settings (or defaults) on mount
  const [settings, setSettings] = useState<PersistedSettings>(loadSettings);

  // Derive individual values from the settings object
  const { masterVolume, musicVolume, sfxVolume, ambientVolume, musicTrack, defaultGameSpeed, showTooltips } = settings;

  // Helper to update a single setting, persist, and apply side-effects
  const updateSetting = useCallback(<K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleMasterVolume = useCallback((v: number) => {
    updateSetting('masterVolume', v);
    getAudioEngine()?.setMasterVolume(v / 100);
  }, [updateSetting]);

  const handleMusicVolume = useCallback((v: number) => {
    updateSetting('musicVolume', v);
    getAudioEngine()?.setMusicVolume(v / 100);
  }, [updateSetting]);

  const handleSfxVolume = useCallback((v: number) => {
    updateSetting('sfxVolume', v);
    getAudioEngine()?.setSfxVolume(v / 100);
  }, [updateSetting]);

  const handleAmbientVolume = useCallback((v: number) => {
    updateSetting('ambientVolume', v);
    // Ambient audio shares the SFX bus for now
    getAudioEngine()?.setSfxVolume(v / 100);
  }, [updateSetting]);

  const handleTrackChange = useCallback((track: MusicTrack) => {
    updateSetting('musicTrack', track);
    setSessionTrack(track);
    emitToPhaser('music:set_track', track);
  }, [updateSetting]);

  const handleDefaultSpeedChange = useCallback((speed: string) => {
    updateSetting('defaultGameSpeed', speed);
  }, [updateSetting]);

  const handleTooltipsToggle = useCallback(() => {
    updateSetting('showTooltips', !showTooltips);
    // Broadcast so the Tooltip component can react
    emitToPhaser('settings:tooltips_changed', !showTooltips);
  }, [showTooltips, updateSetting]);

  // Apply persisted audio levels on mount
  useEffect(() => {
    const audio = getAudioEngine();
    if (audio) {
      audio.setMasterVolume(masterVolume / 100);
      audio.setMusicVolume(musicVolume / 100);
      audio.setSfxVolume(sfxVolume / 100);
    }
  }, []);

  const selectedTrackOption = TRACK_OPTIONS.find((t) => t.id === musicTrack) ?? TRACK_OPTIONS[0]!;

  const SPEED_OPTIONS = [
    { value: 'slow', label: 'Slow' },
    { value: 'normal', label: 'Normal' },
    { value: 'fast', label: 'Fast' },
    { value: 'fastest', label: 'Fastest' },
  ];

  return (
    <div className="pm-settings-panel">
      <div className="pm-settings-panel__header">
        <span className="pm-settings-panel__title">SETTINGS</span>
        <button type="button" className="pm-settings-panel__close panel-close-btn" onClick={onClose}>&#10005;</button>
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
              onChange={(e) => handleMasterVolume(Number(e.target.value))}
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
              onChange={(e) => handleMusicVolume(Number(e.target.value))}
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
              onChange={(e) => handleSfxVolume(Number(e.target.value))}
              className="sc-range pm-range"
            />
            <span className="pm-settings-val">{sfxVolume}%</span>
          </div>
        </div>

        <div className="pm-settings-row">
          <span className="pm-settings-label">Ambient</span>
          <div className="pm-settings-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              value={ambientVolume}
              onChange={(e) => handleAmbientVolume(Number(e.target.value))}
              className="sc-range pm-range"
            />
            <span className="pm-settings-val">{ambientVolume}%</span>
          </div>
        </div>

        <div className="pm-settings-row">
          <span className="pm-settings-label">Music Track</span>
          <div className="pm-track-selector">
            {TRACK_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`pm-track-btn ${musicTrack === opt.id ? 'pm-track-btn--active' : ''}`}
                onClick={() => handleTrackChange(opt.id)}
                title={opt.description}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="pm-track-desc">{selectedTrackOption.description}</p>
        </div>
      </div>

      <div className="pm-settings-section">
        <div className="pm-settings-section__label">GAME</div>

        <div className="pm-settings-row">
          <span className="pm-settings-label">Default Game Speed</span>
          <div className="pm-track-selector">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`pm-track-btn ${defaultGameSpeed === opt.value ? 'pm-track-btn--active' : ''}`}
                onClick={() => handleDefaultSpeedChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pm-settings-row">
          <span className="pm-settings-label">Show Tooltips</span>
          <label className="pm-toggle">
            <input
              type="checkbox"
              checked={showTooltips}
              onChange={handleTooltipsToggle}
              className="pm-toggle__input"
            />
            <span className="pm-toggle__slider" />
            <span className="pm-toggle__label">{showTooltips ? 'On' : 'Off'}</span>
          </label>
        </div>
      </div>

      <div className="pm-settings-section">
        <div className="pm-settings-section__label">KEYBOARD SHORTCUTS</div>
        <div className="pm-controls-grid">
          {[
            { key: 'Escape',       action: 'Pause / Resume'      },
            { key: 'Space',        action: 'Toggle pause'         },
            { key: '1',            action: 'Speed: Pause'         },
            { key: '2',            action: 'Speed: Slow'          },
            { key: '3',            action: 'Speed: Normal'        },
            { key: '4',            action: 'Speed: Fast'          },
            { key: '5',            action: 'Speed: Fastest'       },
            { key: 'R',            action: 'Open Research'        },
            { key: 'S',            action: 'Open Ship Designer'   },
            { key: 'D',            action: 'Open Diplomacy'       },
            { key: 'F',            action: 'Open Fleet Overview'  },
            { key: 'E',            action: 'Open Economy'         },
            { key: 'Scroll',       action: 'Zoom map'             },
            { key: 'Click + Drag', action: 'Pan map'              },
            { key: 'Click system', action: 'Select system'        },
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

export function PauseMenu({ onResume, onExitToMainMenu, onSaveGame, onLoadGame }: PauseMenuProps): React.ReactElement {
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
    if (onSaveGame) {
      onSaveGame();
    } else {
      addToast('Save Game — Coming Soon');
    }
  }, [onSaveGame, addToast]);

  const handleLoadGame = useCallback(() => {
    if (onLoadGame) {
      onLoadGame();
    } else {
      addToast('Load Game — Coming Soon');
    }
  }, [onLoadGame, addToast]);

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
