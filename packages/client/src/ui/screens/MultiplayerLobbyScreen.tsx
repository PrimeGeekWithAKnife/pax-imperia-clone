/**
 * MultiplayerLobbyScreen
 *
 * Three logical views in one component, driven by `lobbyPhase`:
 *  'browse'  – tabbed "Create Game" / "Join Game" panel
 *  'lobby'   – waiting room after creating or joining a session
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GalaxyShape } from '@nova-imperia/shared';
import { getGameClient } from '../../network/GameClient';
import type {
  LobbyState,
  LobbyPlayer,
  LobbySummary,
  LobbyChatMessage,
  LobbyGalaxyConfig,
  GalaxySize,
} from '../../network/GameClient';
import { PREBUILT_SPECIES } from '@nova-imperia/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LobbyPhase = 'browse' | 'lobby';
type BrowseTab = 'create' | 'join';

export interface MultiplayerLobbyScreenProps {
  /** Player's chosen display name (may come from a previous session). */
  playerName: string;
  /** Called when the player wants to return to the main menu. */
  onBack: () => void;
  /**
   * Called when the host starts the game.  Receives the galaxy config so
   * App.tsx can hand it straight to the Phaser scene.
   */
  onGameStart: (galaxyConfig: LobbyGalaxyConfig) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVER_URL = 'http://localhost:3000';

const GALAXY_SIZES: Array<{ key: GalaxySize; label: string; systems: number }> = [
  { key: 'small',  label: 'Small',  systems: 20  },
  { key: 'medium', label: 'Medium', systems: 40  },
  { key: 'large',  label: 'Large',  systems: 80  },
  { key: 'huge',   label: 'Huge',   systems: 120 },
];

const GALAXY_SHAPES: Array<{ key: GalaxyShape; label: string }> = [
  { key: 'spiral',      label: 'Spiral'      },
  { key: 'elliptical',  label: 'Elliptical'  },
  { key: 'irregular',   label: 'Irregular'   },
  { key: 'ring',        label: 'Ring'        },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlayerRow({ player }: { player: LobbyPlayer }): React.ReactElement {
  return (
    <div className={`lobby-player-row${player.isHost ? ' lobby-player-row--host' : ''}`}>
      <span className="lobby-player-row__name">
        {player.isHost && <span className="lobby-player-row__crown" title="Host">★ </span>}
        {player.playerName}
      </span>
      <span className="lobby-player-row__species">
        {player.speciesId
          ? (PREBUILT_SPECIES.find((s) => s.id === player.speciesId)?.name ?? player.speciesId)
          : '—'}
      </span>
      <span className={`lobby-player-row__ready ${player.isReady ? 'lobby-player-row__ready--yes' : ''}`}>
        {player.isReady ? 'Ready' : 'Not ready'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MultiplayerLobbyScreen({
  playerName: initialPlayerName,
  onBack,
  onGameStart,
}: MultiplayerLobbyScreenProps): React.ReactElement {
  // ── Connection state ──────────────────────────────────────────────────────
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // ── Browse state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<LobbyPhase>('browse');
  const [browseTab, setBrowseTab] = useState<BrowseTab>('create');

  // Player name (editable before joining)
  const [playerName, setPlayerName] = useState(initialPlayerName);

  // Create-game form
  const [gameName, setGameName] = useState(`${initialPlayerName}'s Game`);
  const [galaxySize, setGalaxySize] = useState<GalaxySize>('medium');
  const [galaxyShape, setGalaxyShape] = useState<GalaxyShape>('spiral');
  const [galaxySeed, setGalaxySeed] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [gamePassword, setGamePassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join-game list
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [loadingLobbies, setLoadingLobbies] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ sessionId: string; value: string } | null>(null);

  // ── Lobby state ───────────────────────────────────────────────────────────
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [chatMessages, setChatMessages] = useState<LobbyChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [togglingReady, setTogglingReady] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>(
    PREBUILT_SPECIES[0]?.id ?? '',
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const client = getGameClient();

  // ── Connect on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function connect(): Promise<void> {
      setConnecting(true);
      setConnectError(null);
      try {
        await client.connect(SERVER_URL);
        if (cancelled) return;
        setConnecting(false);
      } catch (err) {
        if (cancelled) return;
        setConnectError((err as Error).message);
        setConnecting(false);
      }
    }

    void connect();
    return () => { cancelled = true; };
  }, [client]);

  // ── Subscribe to lobby events ─────────────────────────────────────────────
  useEffect(() => {
    if (!client.isConnected) return;

    const unsubState = client.onLobbyState((state) => {
      setLobbyState(state);
    });

    const unsubMsg = client.onLobbyMessage((msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    const unsubStart = client.onGameStarted(({ galaxyConfig }) => {
      onGameStart(galaxyConfig);
    });

    return () => {
      unsubState();
      unsubMsg();
      unsubStart();
    };
  }, [client, client.isConnected, onGameStart]);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behaviour: 'smooth' } as ScrollIntoViewOptions);
  }, [chatMessages]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fetchLobbies = useCallback(async () => {
    if (!client.isConnected) return;
    setLoadingLobbies(true);
    try {
      const result = await client.listGames();
      setLobbies(result);
    } catch {
      // silently ignore
    } finally {
      setLoadingLobbies(false);
    }
  }, [client]);

  // Fetch on switching to join tab
  useEffect(() => {
    if (browseTab === 'join') {
      void fetchLobbies();
    }
  }, [browseTab, fetchLobbies]);

  // ── Create game ───────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    const seed = galaxySeed.trim() || String(Math.floor(Math.random() * 0xffffff));
    try {
      await client.createGame(playerName, {
        gameName: gameName.trim() || `${playerName}'s Game`,
        maxPlayers,
        password: gamePassword.trim() || undefined,
        galaxyConfig: { size: galaxySize, shape: galaxyShape, seed },
      });
      setPhase('lobby');
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [client, playerName, gameName, maxPlayers, gamePassword, galaxySize, galaxyShape, galaxySeed]);

  // ── Join game ─────────────────────────────────────────────────────────────

  const handleJoinAttempt = useCallback((summary: LobbySummary) => {
    if (summary.hasPassword) {
      setPasswordPrompt({ sessionId: summary.sessionId, value: '' });
    } else {
      void doJoin(summary.sessionId);
    }
  }, []);

  const doJoin = useCallback(async (sessionId: string, password?: string) => {
    setJoiningId(sessionId);
    setJoinError(null);
    try {
      await client.joinGame(playerName, sessionId, password);
      setPasswordPrompt(null);
      setPhase('lobby');
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setJoiningId(null);
    }
  }, [client, playerName]);

  // ── Ready toggle ──────────────────────────────────────────────────────────

  const handleToggleReady = useCallback(async () => {
    setTogglingReady(true);
    const next = !isReady;
    try {
      await client.setReady(next);
      setIsReady(next);
    } catch {
      // ignore
    } finally {
      setTogglingReady(false);
    }
  }, [client, isReady]);

  // ── Start game (host only) ────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    setStartError(null);
    try {
      await client.startGame();
    } catch (err) {
      setStartError((err as Error).message);
    }
  }, [client]);

  // ── Chat ──────────────────────────────────────────────────────────────────

  const handleSendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg) return;
    setSendingChat(true);
    try {
      await client.sendChat(msg);
      setChatInput('');
    } catch {
      // ignore
    } finally {
      setSendingChat(false);
    }
  }, [client, chatInput]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendChat();
    }
  }, [handleSendChat]);

  // ── Species selection ─────────────────────────────────────────────────────

  const handleSelectSpecies = useCallback(async (speciesId: string) => {
    setSelectedSpeciesId(speciesId);
    try {
      await client.selectSpecies(speciesId);
    } catch {
      // ignore
    }
  }, [client]);

  // ── Derive helper values ──────────────────────────────────────────────────

  const myPlayer: LobbyPlayer | undefined = lobbyState?.players.find(
    (p) => p.playerId === client.currentSessionId || p.playerName === playerName,
  );
  const amHost = myPlayer?.isHost ?? false;
  const allReady = (lobbyState?.players.length ?? 0) >= 2
    && lobbyState?.players.every((p) => p.isReady) === true;

  // =========================================================================
  // Render
  // =========================================================================

  if (connecting) {
    return (
      <div className="lobby-screen">
        <div className="lobby-connecting">
          <div className="lobby-connecting__spinner" />
          <span>Connecting to server…</span>
        </div>
      </div>
    );
  }

  if (connectError) {
    return (
      <div className="lobby-screen">
        <div className="lobby-error-panel">
          <div className="lobby-error-panel__title">Could not connect to server</div>
          <div className="lobby-error-panel__msg">{connectError}</div>
          <div className="lobby-error-panel__actions">
            <button type="button" className="sc-btn sc-btn--secondary" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Lobby waiting room ────────────────────────────────────────────────────

  if (phase === 'lobby') {
    return (
      <div className="lobby-screen">
        <div className="lobby-room">

          {/* Header */}
          <div className="lobby-room__header">
            <div className="lobby-room__title">{lobbyState?.gameName ?? 'Lobby'}</div>
            <button type="button" className="sc-btn sc-btn--ghost lobby-room__leave" onClick={onBack}>
              Leave
            </button>
          </div>

          <div className="lobby-room__body">

            {/* Left: player list + species selector */}
            <div className="lobby-room__left">
              <section className="lobby-section">
                <div className="lobby-section__label">
                  PLAYERS ({lobbyState?.players.length ?? 0} / {lobbyState?.maxPlayers ?? '?'})
                </div>
                <div className="lobby-player-list">
                  {(lobbyState?.players ?? []).map((p) => (
                    <PlayerRow key={p.playerId} player={p} />
                  ))}
                </div>
              </section>

              <section className="lobby-section">
                <div className="lobby-section__label">CHOOSE SPECIES</div>
                <div className="lobby-species-grid">
                  {PREBUILT_SPECIES.map((species) => (
                    <button
                      key={species.id}
                      type="button"
                      className={`lobby-species-btn${selectedSpeciesId === species.id ? ' lobby-species-btn--active' : ''}`}
                      onClick={() => handleSelectSpecies(species.id)}
                    >
                      {species.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="lobby-section">
                <div className="lobby-section__label">GALAXY</div>
                <div className="lobby-galaxy-info">
                  <span>{lobbyState?.galaxyConfig.size}</span>
                  <span>{lobbyState?.galaxyConfig.shape}</span>
                  <span className="lobby-galaxy-info__seed">
                    seed: {lobbyState?.galaxyConfig.seed || '(random)'}
                  </span>
                </div>
              </section>
            </div>

            {/* Right: chat */}
            <div className="lobby-room__right">
              <div className="lobby-section__label">CHAT</div>
              <div className="lobby-chat">
                <div className="lobby-chat__messages">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="lobby-chat__msg">
                      <span className="lobby-chat__msg-name">{msg.playerName}</span>
                      <span className="lobby-chat__msg-text">{msg.message}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="lobby-chat__input-row">
                  <input
                    type="text"
                    className="sc-input lobby-chat__input"
                    placeholder="Type a message…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    maxLength={500}
                  />
                  <button
                    type="button"
                    className="sc-btn sc-btn--ghost"
                    onClick={() => void handleSendChat()}
                    disabled={sendingChat || !chatInput.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="lobby-room__footer">
            {startError && <span className="lobby-error">{startError}</span>}

            <button
              type="button"
              className={`sc-btn ${isReady ? 'sc-btn--secondary' : 'sc-btn--primary'}`}
              onClick={() => void handleToggleReady()}
              disabled={togglingReady}
            >
              {isReady ? 'Not Ready' : 'Ready'}
            </button>

            {amHost && (
              <button
                type="button"
                className="sc-btn sc-btn--primary"
                onClick={() => void handleStart()}
                disabled={!allReady}
                title={!allReady ? 'All players must be ready' : undefined}
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Browse: Create / Join tabs ────────────────────────────────────────────

  return (
    <div className="lobby-screen">
      <div className="lobby-browse">

        {/* Header */}
        <div className="lobby-browse__header">
          <div className="lobby-browse__title">MULTIPLAYER</div>
          <button type="button" className="sc-btn sc-btn--ghost" onClick={onBack}>
            Back
          </button>
        </div>

        {/* Player name */}
        <div className="lobby-browse__name-row">
          <label className="lobby-browse__name-label" htmlFor="lobby-player-name">Your name</label>
          <input
            id="lobby-player-name"
            type="text"
            className="sc-input lobby-browse__name-input"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={32}
          />
        </div>

        {/* Tabs */}
        <div className="lobby-browse__tabs">
          <button
            type="button"
            className={`lobby-tab-btn${browseTab === 'create' ? ' lobby-tab-btn--active' : ''}`}
            onClick={() => setBrowseTab('create')}
          >
            Create Game
          </button>
          <button
            type="button"
            className={`lobby-tab-btn${browseTab === 'join' ? ' lobby-tab-btn--active' : ''}`}
            onClick={() => setBrowseTab('join')}
          >
            Join Game
          </button>
        </div>

        {/* ── Create tab ── */}
        {browseTab === 'create' && (
          <div className="lobby-create">

            <div className="lobby-create__field">
              <label className="sc-section__label" htmlFor="lobby-game-name">GAME NAME</label>
              <input
                id="lobby-game-name"
                type="text"
                className="sc-input"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                maxLength={64}
              />
            </div>

            <div className="lobby-create__field">
              <div className="sc-section__label">GALAXY SIZE</div>
              <div className="gs-size-grid">
                {GALAXY_SIZES.map(({ key, label, systems }) => (
                  <button
                    key={key}
                    type="button"
                    className={`gs-size-card ${galaxySize === key ? 'gs-size-card--active' : ''}`}
                    onClick={() => setGalaxySize(key)}
                  >
                    <span className="gs-size-card__label">{label}</span>
                    <span className="gs-size-card__systems">{systems}</span>
                    <span className="gs-size-card__unit">systems</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lobby-create__field">
              <div className="sc-section__label">GALAXY SHAPE</div>
              <div className="lobby-create__shape-row">
                {GALAXY_SHAPES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`gs-diff-btn ${galaxyShape === key ? 'gs-diff-btn--active' : ''}`}
                    onClick={() => setGalaxyShape(key as GalaxyShape)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lobby-create__field">
              <label className="sc-section__label" htmlFor="lobby-seed">
                SEED <span className="sc-section__hint">(optional)</span>
              </label>
              <input
                id="lobby-seed"
                type="text"
                className="sc-input"
                placeholder="Leave empty to randomise…"
                value={galaxySeed}
                onChange={(e) => setGalaxySeed(e.target.value)}
                maxLength={32}
              />
            </div>

            <div className="lobby-create__field">
              <div className="sc-section__label-row">
                <span className="sc-section__label">MAX PLAYERS</span>
                <span className="gs-slider-value">{maxPlayers}</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="sc-range gs-range"
              />
              <div className="sc-range-labels">
                {[2,3,4,5,6,7,8].map((n) => <span key={n}>{n}</span>)}
              </div>
            </div>

            <div className="lobby-create__field">
              <label className="sc-section__label" htmlFor="lobby-password">
                PASSWORD <span className="sc-section__hint">(optional)</span>
              </label>
              <input
                id="lobby-password"
                type="password"
                className="sc-input"
                placeholder="Leave empty for open lobby"
                value={gamePassword}
                onChange={(e) => setGamePassword(e.target.value)}
                maxLength={64}
              />
            </div>

            {createError && <div className="lobby-error">{createError}</div>}

            <button
              type="button"
              className="sc-btn sc-btn--primary lobby-create__submit"
              onClick={() => void handleCreate()}
              disabled={creating || !playerName.trim()}
            >
              {creating ? 'Creating…' : 'Create Game'}
            </button>
          </div>
        )}

        {/* ── Join tab ── */}
        {browseTab === 'join' && (
          <div className="lobby-join">
            <div className="lobby-join__toolbar">
              <button
                type="button"
                className="sc-btn sc-btn--ghost"
                onClick={() => void fetchLobbies()}
                disabled={loadingLobbies}
              >
                {loadingLobbies ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {joinError && <div className="lobby-error">{joinError}</div>}

            {lobbies.length === 0 && !loadingLobbies && (
              <div className="lobby-join__empty">No open games found. Try creating one!</div>
            )}

            <div className="lobby-join__list">
              {lobbies.map((summary) => (
                <div key={summary.sessionId} className="lobby-join__row">
                  <div className="lobby-join__row-info">
                    <span className="lobby-join__row-name">
                      {summary.hasPassword && <span title="Password protected">🔒 </span>}
                      {summary.gameName}
                    </span>
                    <span className="lobby-join__row-host">Host: {summary.hostName}</span>
                    <span className="lobby-join__row-players">
                      {summary.playerCount} / {summary.maxPlayers}
                    </span>
                    <span className="lobby-join__row-size">{summary.galaxySize}</span>
                  </div>
                  <button
                    type="button"
                    className="sc-btn sc-btn--primary"
                    onClick={() => handleJoinAttempt(summary)}
                    disabled={joiningId === summary.sessionId || !playerName.trim()}
                  >
                    {joiningId === summary.sessionId ? 'Joining…' : 'Join'}
                  </button>
                </div>
              ))}
            </div>

            {/* Password prompt modal */}
            {passwordPrompt && (
              <div className="lobby-password-modal">
                <div className="lobby-password-modal__box">
                  <div className="lobby-password-modal__title">Password required</div>
                  <input
                    type="password"
                    className="sc-input"
                    placeholder="Enter password…"
                    value={passwordPrompt.value}
                    onChange={(e) =>
                      setPasswordPrompt((prev) => prev ? { ...prev, value: e.target.value } : null)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void doJoin(passwordPrompt.sessionId, passwordPrompt.value);
                      }
                    }}
                    autoFocus
                  />
                  <div className="lobby-password-modal__actions">
                    <button
                      type="button"
                      className="sc-btn sc-btn--secondary"
                      onClick={() => setPasswordPrompt(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="sc-btn sc-btn--primary"
                      onClick={() => void doJoin(passwordPrompt.sessionId, passwordPrompt.value)}
                    >
                      Join
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
