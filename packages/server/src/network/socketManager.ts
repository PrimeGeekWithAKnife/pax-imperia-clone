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
} from './types.js';
import { GameSessionManager } from '../game/GameSessionManager.js';

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

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
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
  // Event handlers
  // ---------------------------------------------------------------------------

  private onGameJoin(
    socket: AppSocket,
    payload: { sessionId: string; playerName: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ): void {
    const { sessionId, playerName } = payload;

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
