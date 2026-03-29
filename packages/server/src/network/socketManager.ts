/**
 * SocketManager – wraps the Socket.io Server instance and wires up all
 * real-time event handlers for Ex Nihilo.
 *
 * Responsibilities:
 *  - Log connections and disconnections
 *  - Delegate room management to GameSessionManager
 *  - Emit typed server→client events
 *  - Track the total number of connected sockets
 */

import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  LobbyConfig,
} from './types.js';
import { GameSessionManager } from '../game/GameSessionManager.js';
import type { GameSession } from '../game/GameSessionManager.js';
import {
  sanitisePlayerName,
  sanitiseGameName,
  sanitiseChatMessage,
  sanitisePassword,
  sanitiseSeed,
} from './sanitise.js';

// Convenience type alias for a fully-typed socket on this server.
type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export class SocketManager {
  private io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;

  private sessionManager: GameSessionManager;

  constructor(httpServer: HttpServer, sessionManager: GameSessionManager) {
    this.sessionManager = sessionManager;

    // Allow CORS origins from the EX_NIHILO_CORS_ORIGIN environment variable
    // (comma-separated list). Falls back to same-origin only in production and
    // permissive localhost patterns in development.
    const corsOrigin = process.env.EX_NIHILO_CORS_ORIGIN
      ? process.env.EX_NIHILO_CORS_ORIGIN.split(',').map(o => o.trim())
      : process.env.NODE_ENV === 'production'
        ? false // same-origin only in production
        : [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
      },
      // Separate Socket.io path from normal HTTP traffic.
      path: '/socket.io',
    });

    this.registerGlobalMiddleware();
    this.io.on('connection', (socket) => this.onConnection(socket));
  }

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------

  /**
   * Assign default SocketData values before the connection event fires so
   * handlers can always read from socket.data safely.
   */
  private registerGlobalMiddleware(): void {
    this.io.use((socket, next) => {
      socket.data.playerId = socket.id; // Default to socket ID until player sets a name.
      socket.data.playerName = `Player-${socket.id.slice(0, 6)}`;
      socket.data.currentSessionId = null;
      next();
    });
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  private onConnection(socket: AppSocket): void {
    console.log(
      `[Socket] Client connected – id=${socket.id}  total=${this.connectedCount}`,
    );

    socket.on('game:join', (payload, callback) =>
      this.onGameJoin(socket, payload, callback),
    );

    socket.on('game:leave', (payload, callback) =>
      this.onGameLeave(socket, payload, callback),
    );

    socket.on('game:action', (payload, callback) =>
      this.onGameAction(socket, payload, callback),
    );

    // ── Lobby events ──────────────────────────────────────────────────────────

    socket.on('lobby:create', (payload, callback) =>
      this.onLobbyCreate(socket, payload, callback),
    );

    socket.on('lobby:join', (payload, callback) =>
      this.onLobbyJoin(socket, payload, callback),
    );

    socket.on('lobby:ready', (payload, callback) =>
      this.onLobbyReady(socket, payload, callback),
    );

    socket.on('lobby:start', (payload, callback) =>
      this.onLobbyStart(socket, payload, callback),
    );

    socket.on('lobby:chat', (payload, callback) =>
      this.onLobbyChat(socket, payload, callback),
    );

    socket.on('lobby:list', (callback) =>
      this.onLobbyList(callback),
    );

    socket.on('lobby:species', (payload, callback) =>
      this.onLobbySpecies(socket, payload, callback),
    );

    socket.on('disconnect', (reason) => this.onDisconnect(socket, reason));
  }

  private onDisconnect(socket: AppSocket, reason: string): void {
    console.log(
      `[Socket] Client disconnected – id=${socket.id}  reason=${reason}  total=${this.connectedCount}`,
    );

    // Automatically remove the player from their session on disconnect.
    const sessionId = socket.data.currentSessionId;
    if (sessionId) {
      this.removePlayerFromSession(socket, sessionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Game event handlers (legacy)
  // ---------------------------------------------------------------------------

  private onGameJoin(
    socket: AppSocket,
    payload: { sessionId: string; playerName: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId } = payload;
    const playerName = sanitisePlayerName(payload.playerName) ?? `Player-${socket.id.slice(0, 6)}`;

    // Prevent a socket from joining a second session without leaving the first.
    if (socket.data.currentSessionId && socket.data.currentSessionId !== sessionId) {
      callback({
        success: false,
        error: `You are already in session '${socket.data.currentSessionId}'. Leave it first.`,
      });
      return;
    }

    const result = this.sessionManager.joinSession(sessionId, {
      playerId: socket.id,
      playerName,
      socketId: socket.id,
    });

    if (!result.success || !result.session) {
      console.warn(`[Socket] game:join failed – id=${socket.id}  reason=${result.error}`);
      callback({ success: false, error: result.error });
      return;
    }

    // Persist player identity on the socket.
    socket.data.playerName = playerName;
    socket.data.currentSessionId = sessionId;

    // Admit the socket into the Socket.io room (named after the session).
    void socket.join(sessionId);

    console.log(
      `[Socket] Player joined session – player=${socket.id}  session=${sessionId}  players=${result.session.playerCount}`,
    );

    // Notify everyone else in the room.
    socket.to(sessionId).emit('player:joined', {
      playerId: socket.id,
      sessionId,
      playerName,
    });

    callback({ success: true });
  }

  private onGameLeave(
    socket: AppSocket,
    payload: { sessionId: string },
    callback: (ack: { success: boolean }) => void,
  ): void {
    const { sessionId } = payload;

    this.removePlayerFromSession(socket, sessionId);
    callback({ success: true });
  }

  private onGameAction(
    socket: AppSocket,
    payload: { sessionId: string; actionType: string; data: Record<string, unknown> },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId, actionType } = payload;

    const session = this.sessionManager.getSession(sessionId);

    if (!session) {
      callback({ success: false, error: `Session '${sessionId}' not found.` });
      return;
    }

    if (!session.hasPlayer(socket.id)) {
      callback({ success: false, error: 'You are not a member of this session.' });
      return;
    }

    if (session.status !== 'playing') {
      callback({ success: false, error: `Session is not in playing state (current: ${session.status}).` });
      return;
    }

    console.log(
      `[Socket] game:action – player=${socket.id}  session=${sessionId}  action=${actionType}`,
    );

    // TODO: Delegate to the game engine for validation and state mutation.
    // For now we acknowledge the action and broadcast the current state.
    callback({ success: true });

    // Broadcast updated state to all players in the room.
    this.io.to(sessionId).emit('game:state', {
      sessionId,
      turn: 0, // placeholder until game engine is wired up
      state: {},
    });
  }

  // ---------------------------------------------------------------------------
  // Lobby event handlers
  // ---------------------------------------------------------------------------

  private onLobbyCreate(
    socket: AppSocket,
    payload: { playerName: string; config: LobbyConfig },
    callback: (ack: { success: boolean; sessionId?: string; error?: string }) => void,
  ): void {
    const { config } = payload;

    // ── Input sanitisation ─────────────────────────────────────────────────
    const playerName = sanitisePlayerName(payload.playerName);
    if (!playerName) {
      callback({ success: false, error: 'Player name is required (max 40 characters).' });
      return;
    }

    const gameName = sanitiseGameName(config.gameName);
    if (!gameName) {
      callback({ success: false, error: 'Game name is required (max 60 characters).' });
      return;
    }
    config.gameName = gameName;
    config.password = sanitisePassword(config.password);
    if (config.galaxyConfig) {
      config.galaxyConfig.seed = sanitiseSeed(config.galaxyConfig.seed);
    }
    // Validate maxPlayers — clamp to safe range [2, 8]
    if (typeof config.maxPlayers !== 'number' || !Number.isFinite(config.maxPlayers)) {
      config.maxPlayers = 4;
    }
    config.maxPlayers = Math.max(2, Math.min(8, Math.round(config.maxPlayers)));
    // ────────────────────────────────────────────────────────────────────────

    if (socket.data.currentSessionId) {
      callback({ success: false, error: 'You are already in a session. Leave it first.' });
      return;
    }

    const session = this.sessionManager.createLobbySession(config);
    session.hostSocketId = socket.id;

    const added = session.addPlayer({
      playerId: socket.id,
      playerName,
      socketId: socket.id,
      joinedAt: new Date(),
    });

    if (!added) {
      this.sessionManager.destroySession(session.id);
      callback({ success: false, error: 'Failed to add host to session.' });
      return;
    }

    socket.data.playerName = playerName;
    socket.data.currentSessionId = session.id;
    void socket.join(session.id);

    console.log(
      `[Socket] Lobby created – host=${socket.id}  session=${session.id}  name="${config.gameName}"`,
    );

    callback({ success: true, sessionId: session.id });

    // Broadcast initial state (just the host for now).
    this.broadcastLobbyState(session);
  }

  private onLobbyJoin(
    socket: AppSocket,
    payload: { sessionId: string; playerName: string; password?: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId } = payload;

    // ── Input sanitisation ─────────────────────────────────────────────────
    const playerName = sanitisePlayerName(payload.playerName);
    if (!playerName) {
      callback({ success: false, error: 'Player name is required (max 40 characters).' });
      return;
    }
    const password = sanitisePassword(payload.password);
    // ────────────────────────────────────────────────────────────────────────

    if (socket.data.currentSessionId) {
      callback({ success: false, error: 'You are already in a session. Leave it first.' });
      return;
    }

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      callback({ success: false, error: `Session '${sessionId}' not found.` });
      return;
    }

    // Password check.
    if (session.password !== null && session.password !== (password ?? '')) {
      callback({ success: false, error: 'Incorrect password.' });
      return;
    }

    const result = this.sessionManager.joinSession(sessionId, {
      playerId: socket.id,
      playerName,
      socketId: socket.id,
    });

    if (!result.success) {
      callback({ success: false, error: result.error });
      return;
    }

    socket.data.playerName = playerName;
    socket.data.currentSessionId = sessionId;
    void socket.join(sessionId);

    console.log(
      `[Socket] Player joined lobby – player=${socket.id}  session=${sessionId}`,
    );

    callback({ success: true });

    this.broadcastLobbyState(session);
  }

  private onLobbyReady(
    socket: AppSocket,
    payload: { sessionId: string; ready: boolean },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId, ready } = payload;
    const session = this.getSessionForSocket(socket, sessionId);
    if (!session) {
      callback({ success: false, error: 'Session not found or you are not in it.' });
      return;
    }

    const updated = session.setReady(socket.id, ready);
    if (!updated) {
      callback({ success: false, error: 'Player not found in session.' });
      return;
    }

    console.log(
      `[Socket] lobby:ready – player=${socket.id}  session=${sessionId}  ready=${ready}`,
    );

    callback({ success: true });
    this.broadcastLobbyState(session);
  }

  private onLobbyStart(
    socket: AppSocket,
    payload: { sessionId: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId } = payload;
    const session = this.getSessionForSocket(socket, sessionId);
    if (!session) {
      callback({ success: false, error: 'Session not found or you are not in it.' });
      return;
    }

    if (session.hostSocketId !== socket.id) {
      callback({ success: false, error: 'Only the host can start the game.' });
      return;
    }

    if (!session.allReady) {
      callback({ success: false, error: 'Not all players are ready.' });
      return;
    }

    const started = session.start();
    if (!started) {
      callback({ success: false, error: 'Could not start the session.' });
      return;
    }

    console.log(
      `[Socket] lobby:start – host=${socket.id}  session=${sessionId}  players=${session.playerCount}`,
    );

    callback({ success: true });

    // Notify all players that the game is starting.
    this.io.to(sessionId).emit('lobby:game_started', {
      sessionId,
      galaxyConfig: session.galaxyConfig,
    });
  }

  private onLobbyChat(
    socket: AppSocket,
    payload: { sessionId: string; message: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId } = payload;
    const session = this.getSessionForSocket(socket, sessionId);
    if (!session) {
      callback({ success: false, error: 'Session not found or you are not in it.' });
      return;
    }

    const trimmed = sanitiseChatMessage(payload.message);
    if (!trimmed) {
      callback({ success: false, error: 'Message cannot be empty.' });
      return;
    }

    callback({ success: true });

    // Broadcast to everyone in the room (including sender).
    this.io.to(sessionId).emit('lobby:message', {
      sessionId,
      playerId: socket.id,
      playerName: socket.data.playerName,
      message: trimmed,
      timestamp: Date.now(),
    });
  }

  private onLobbyList(
    callback: (ack: { success: boolean; lobbies: ReturnType<GameSession['toLobbySummary']>[]; error?: string }) => void,
  ): void {
    const lobbies = this.sessionManager.listOpenLobbies();
    callback({ success: true, lobbies });
  }

  private onLobbySpecies(
    socket: AppSocket,
    payload: { sessionId: string; speciesId: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId, speciesId } = payload;
    const session = this.getSessionForSocket(socket, sessionId);
    if (!session) {
      callback({ success: false, error: 'Session not found or you are not in it.' });
      return;
    }

    session.setSpecies(socket.id, speciesId);
    callback({ success: true });
    this.broadcastLobbyState(session);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private removePlayerFromSession(socket: AppSocket, sessionId: string): void {
    const result = this.sessionManager.leaveSession(sessionId, socket.id);

    if (!result.success) {
      console.warn(
        `[Socket] leaveSession failed – player=${socket.id}  session=${sessionId}  reason=${result.error}`,
      );
      return;
    }

    void socket.leave(sessionId);
    socket.data.currentSessionId = null;

    console.log(
      `[Socket] Player left session – player=${socket.id}  session=${sessionId}`,
    );

    // Notify remaining players.
    socket.to(sessionId).emit('player:left', {
      playerId: socket.id,
      sessionId,
      playerName: socket.data.playerName,
    });

    // If the session still exists and is in waiting state, broadcast updated lobby state.
    const session = this.sessionManager.getSession(sessionId);
    if (session && session.status === 'waiting') {
      this.broadcastLobbyState(session);
    }
  }

  /** Return the session if it exists AND the socket is a member, otherwise null. */
  private getSessionForSocket(socket: AppSocket, sessionId: string): GameSession | null {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return null;
    if (!session.hasPlayer(socket.id)) return null;
    return session;
  }

  /** Broadcast the full lobby state to all players in a session. */
  private broadcastLobbyState(session: GameSession): void {
    this.io.to(session.id).emit('lobby:state', session.toLobbyState());
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Number of sockets currently connected to this server. */
  get connectedCount(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Gracefully close the Socket.io server (waits for existing connections
   * to close before resolving).
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.io.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
