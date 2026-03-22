/**
 * GameSessionManager – creates and manages game sessions (lobbies/rooms).
 *
 * A GameSession progresses through three lifecycle states:
 *   waiting  → playing → finished
 *
 * The manager is the single source of truth for active sessions on the server.
 */

import { randomUUID } from 'crypto';
import type { LobbyConfig, LobbyGalaxyConfig, LobbyPlayer, LobbyState, LobbySummary } from '../network/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionStatus = 'waiting' | 'playing' | 'finished';

export interface PlayerInfo {
  playerId: string;
  playerName: string;
  /** Socket ID so the session can target individual connections if needed */
  socketId: string;
  joinedAt: Date;
}

export interface GameSessionOptions {
  /** Maximum number of players allowed in the session (default: 6) */
  maxPlayers?: number;
  /** Minimum players required to start (default: 2) */
  minPlayers?: number;
}

// ---------------------------------------------------------------------------
// GameSession
// ---------------------------------------------------------------------------

export class GameSession {
  readonly id: string;
  readonly createdAt: Date;

  private _status: SessionStatus = 'waiting';
  private _players: Map<string, PlayerInfo> = new Map();
  private _startedAt: Date | null = null;
  private _finishedAt: Date | null = null;

  // ── Lobby-specific state ──────────────────────────────────────────────────

  /** The socket ID of the player who created the session. */
  hostSocketId: string = '';

  /** Display name of the game, shown in the lobby list. */
  gameName: string = 'Unnamed Game';

  /** Optional password hash (plain-text for now, good enough for dev). */
  password: string | null = null;

  /** Galaxy configuration chosen by the host. */
  galaxyConfig: LobbyGalaxyConfig = { size: 'medium', shape: 'spiral', seed: '' };

  /** Ready flags per player ID. */
  private _readyFlags: Map<string, boolean> = new Map();

  /** Selected species per player ID. */
  private _speciesChoices: Map<string, string | null> = new Map();

  readonly maxPlayers: number;
  readonly minPlayers: number;

  constructor(id: string, options: GameSessionOptions = {}) {
    this.id = id;
    this.createdAt = new Date();
    this.maxPlayers = options.maxPlayers ?? 6;
    this.minPlayers = options.minPlayers ?? 2;
  }

  // -- Getters ---------------------------------------------------------------

  get status(): SessionStatus {
    return this._status;
  }

  get players(): readonly PlayerInfo[] {
    return Array.from(this._players.values());
  }

  get playerCount(): number {
    return this._players.size;
  }

  get isFull(): boolean {
    return this._players.size >= this.maxPlayers;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get finishedAt(): Date | null {
    return this._finishedAt;
  }

  /** True when all players are marked ready and there are enough to start. */
  get allReady(): boolean {
    if (this._players.size < this.minPlayers) return false;
    for (const player of this._players.values()) {
      if (!this._readyFlags.get(player.playerId)) return false;
    }
    return true;
  }

  // -- Mutators --------------------------------------------------------------

  /**
   * Add a player to the session.  Returns false if the session is full or not
   * in 'waiting' state, or if the player is already in the session.
   */
  addPlayer(info: PlayerInfo): boolean {
    if (this._status !== 'waiting') return false;
    if (this.isFull) return false;
    if (this._players.has(info.playerId)) return false;

    this._players.set(info.playerId, info);
    this._readyFlags.set(info.playerId, false);
    this._speciesChoices.set(info.playerId, null);
    return true;
  }

  /**
   * Remove a player from the session.
   * Returns the removed PlayerInfo, or null if the player was not found.
   */
  removePlayer(playerId: string): PlayerInfo | null {
    const player = this._players.get(playerId);
    if (!player) return null;

    this._players.delete(playerId);
    this._readyFlags.delete(playerId);
    this._speciesChoices.delete(playerId);

    // If the host left, transfer host to the next player in the map.
    if (player.socketId === this.hostSocketId) {
      const next = this._players.values().next().value as PlayerInfo | undefined;
      this.hostSocketId = next?.socketId ?? '';
    }

    // Finish a session that has been left with no players while playing.
    if (this._status === 'playing' && this._players.size === 0) {
      this._status = 'finished';
      this._finishedAt = new Date();
    }

    return player;
  }

  hasPlayer(playerId: string): boolean {
    return this._players.has(playerId);
  }

  getPlayer(playerId: string): PlayerInfo | undefined {
    return this._players.get(playerId);
  }

  /** Set the ready flag for a player.  Returns false if the player is not in this session. */
  setReady(playerId: string, ready: boolean): boolean {
    if (!this._players.has(playerId)) return false;
    this._readyFlags.set(playerId, ready);
    return true;
  }

  /** Set the species choice for a player.  Returns false if the player is not in this session. */
  setSpecies(playerId: string, speciesId: string | null): boolean {
    if (!this._players.has(playerId)) return false;
    this._speciesChoices.set(playerId, speciesId);
    return true;
  }

  isReady(playerId: string): boolean {
    return this._readyFlags.get(playerId) ?? false;
  }

  /** Transition the session from 'waiting' to 'playing'. */
  start(): boolean {
    if (this._status !== 'waiting') return false;
    if (this._players.size < this.minPlayers) return false;

    this._status = 'playing';
    this._startedAt = new Date();
    return true;
  }

  /** Transition the session to 'finished'. */
  finish(): boolean {
    if (this._status === 'finished') return false;

    this._status = 'finished';
    this._finishedAt = new Date();
    return true;
  }

  /** Serialisable summary used for API responses and logging. */
  toSummary() {
    return {
      id: this.id,
      status: this._status,
      playerCount: this._players.size,
      maxPlayers: this.maxPlayers,
      minPlayers: this.minPlayers,
      gameName: this.gameName,
      createdAt: this.createdAt,
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
      players: this.players.map(({ playerId, playerName, joinedAt }) => ({
        playerId,
        playerName,
        joinedAt,
      })),
    };
  }

  /** Full lobby state broadcast to all members. */
  toLobbyState(): LobbyState {
    const players: LobbyPlayer[] = Array.from(this._players.values()).map((p) => ({
      playerId: p.playerId,
      playerName: p.playerName,
      isReady: this._readyFlags.get(p.playerId) ?? false,
      isHost: p.socketId === this.hostSocketId,
      speciesId: this._speciesChoices.get(p.playerId) ?? null,
    }));

    return {
      sessionId: this.id,
      gameName: this.gameName,
      players,
      maxPlayers: this.maxPlayers,
      galaxyConfig: this.galaxyConfig,
      hasPassword: this.password !== null,
    };
  }

  /** Summary for the lobby browser list. */
  toLobbySummary(): LobbySummary {
    const hostPlayer = Array.from(this._players.values()).find(
      (p) => p.socketId === this.hostSocketId,
    );

    return {
      sessionId: this.id,
      gameName: this.gameName,
      hostName: hostPlayer?.playerName ?? 'Unknown',
      playerCount: this._players.size,
      maxPlayers: this.maxPlayers,
      galaxySize: this.galaxyConfig.size,
      hasPassword: this.password !== null,
    };
  }
}

// ---------------------------------------------------------------------------
// GameSessionManager
// ---------------------------------------------------------------------------

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();

  // -- CRUD ------------------------------------------------------------------

  /**
   * Create a new game session and return it.
   */
  createSession(options: GameSessionOptions = {}): GameSession {
    const id = randomUUID();
    const session = new GameSession(id, options);
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Create a session from a LobbyConfig, wiring up game name, password, and
   * galaxy settings in a single call.
   */
  createLobbySession(config: LobbyConfig): GameSession {
    const session = this.createSession({ maxPlayers: config.maxPlayers });
    session.gameName = config.gameName;
    session.password = config.password ?? null;
    session.galaxyConfig = config.galaxyConfig;
    return session;
  }

  /**
   * Retrieve a session by ID.  Returns undefined if not found.
   */
  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Destroy a session permanently.  All players must have been removed by the
   * caller before calling this (or the caller accepts the data loss).
   */
  destroySession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Return summaries of all currently tracked sessions.
   * Optionally filter by status.
   */
  listSessions(statusFilter?: SessionStatus) {
    const all = Array.from(this.sessions.values());
    const filtered = statusFilter
      ? all.filter((s) => s.status === statusFilter)
      : all;
    return filtered.map((s) => s.toSummary());
  }

  /**
   * Return lobby summaries for all open (waiting) sessions.
   */
  listOpenLobbies(): LobbySummary[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.status === 'waiting')
      .map((s) => s.toLobbySummary());
  }

  // -- Player lifecycle ------------------------------------------------------

  /**
   * Add a player to an existing session.
   *
   * Returns an object describing the outcome.  The caller should use the
   * `success` flag to decide whether to admit the socket into the room.
   */
  joinSession(
    sessionId: string,
    playerInfo: Omit<PlayerInfo, 'joinedAt'>,
  ): { success: boolean; session?: GameSession; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: `Session '${sessionId}' not found.` };
    }

    if (session.status !== 'waiting') {
      return { success: false, error: `Session '${sessionId}' is not accepting new players (status: ${session.status}).` };
    }

    if (session.isFull) {
      return { success: false, error: `Session '${sessionId}' is full (${session.maxPlayers}/${session.maxPlayers}).` };
    }

    const added = session.addPlayer({ ...playerInfo, joinedAt: new Date() });
    if (!added) {
      return { success: false, error: `Player '${playerInfo.playerId}' is already in session '${sessionId}'.` };
    }

    return { success: true, session };
  }

  /**
   * Remove a player from a session.
   *
   * Automatically destroys the session when it transitions to 'finished' and
   * no players remain.
   */
  leaveSession(
    sessionId: string,
    playerId: string,
  ): { success: boolean; session?: GameSession; player?: PlayerInfo; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: `Session '${sessionId}' not found.` };
    }

    const player = session.removePlayer(playerId);
    if (!player) {
      return { success: false, error: `Player '${playerId}' is not in session '${sessionId}'.` };
    }

    // Prune finished sessions with no remaining players.
    if (session.status === 'finished' && session.playerCount === 0) {
      this.sessions.delete(sessionId);
    }

    // Also clean up empty waiting sessions.
    if (session.status === 'waiting' && session.playerCount === 0) {
      this.sessions.delete(sessionId);
    }

    return { success: true, session, player };
  }

  // -- Utility ---------------------------------------------------------------

  get activeSessionCount(): number {
    return this.sessions.size;
  }

  get connectedPlayerCount(): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      total += session.playerCount;
    }
    return total;
  }
}
