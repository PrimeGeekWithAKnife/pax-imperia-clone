/**
 * GameSessionManager – creates and manages game sessions (lobbies/rooms).
 *
 * A GameSession progresses through three lifecycle states:
 *   waiting  → playing → finished
 *
 * The manager is the single source of truth for active sessions on the server.
 */

import { randomUUID } from 'crypto';

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
