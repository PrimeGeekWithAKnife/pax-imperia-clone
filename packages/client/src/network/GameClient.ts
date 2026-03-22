/**
 * GameClient – Socket.io client wrapper for Ex Nihilo.
 *
 * Provides a typed, promise-based API for all server interactions so that
 * UI components never deal with raw socket events directly.
 */

import { io, type Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Shared type re-declarations (mirrors server/src/network/types.ts)
// We redeclare them here so the client bundle does not depend on the server
// package.  Keep these in sync with the server types.
// ---------------------------------------------------------------------------

export type GalaxySize = 'small' | 'medium' | 'large' | 'huge';
export type GalaxyShape = 'spiral' | 'elliptical' | 'irregular' | 'ring';

export interface LobbyGalaxyConfig {
  size: GalaxySize;
  shape: GalaxyShape;
  seed: string;
}

export interface LobbyConfig {
  gameName: string;
  maxPlayers: number;
  password?: string;
  galaxyConfig: LobbyGalaxyConfig;
}

export interface LobbyPlayer {
  playerId: string;
  playerName: string;
  isReady: boolean;
  isHost: boolean;
  speciesId: string | null;
}

export interface LobbySummary {
  sessionId: string;
  gameName: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  galaxySize: GalaxySize;
  hasPassword: boolean;
}

export interface LobbyState {
  sessionId: string;
  gameName: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  galaxyConfig: LobbyGalaxyConfig;
  hasPassword: boolean;
}

export interface LobbyChatMessage {
  sessionId: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface GameAction {
  sessionId: string;
  actionType: string;
  data: Record<string, unknown>;
}

export interface GameState {
  sessionId: string;
  turn: number;
  state: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Socket event map types (kept minimal — only what the client uses)
// ---------------------------------------------------------------------------

interface ServerToClientEvents {
  'player:joined': (payload: { playerId: string; sessionId: string; playerName?: string }) => void;
  'player:left': (payload: { playerId: string; sessionId: string; playerName?: string }) => void;
  'game:state': (payload: GameState) => void;
  'server:error': (payload: { code: string; message: string }) => void;
  'lobby:state': (payload: LobbyState) => void;
  'lobby:message': (payload: LobbyChatMessage) => void;
  'lobby:game_started': (payload: { sessionId: string; galaxyConfig: LobbyGalaxyConfig }) => void;
}

interface ClientToServerEvents {
  'game:join': (
    payload: { sessionId: string; playerName: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
  'game:leave': (
    payload: { sessionId: string },
    callback: (ack: { success: boolean }) => void,
  ) => void;
  'game:action': (
    payload: GameAction,
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
  'lobby:create': (
    payload: { playerName: string; config: LobbyConfig },
    callback: (ack: { success: boolean; sessionId?: string; error?: string }) => void,
  ) => void;
  'lobby:join': (
    payload: { sessionId: string; playerName: string; password?: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
  'lobby:ready': (
    payload: { sessionId: string; ready: boolean },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
  'lobby:start': (
    payload: { sessionId: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
  'lobby:chat': (
    payload: { sessionId: string; message: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
  'lobby:list': (
    callback: (ack: { success: boolean; lobbies: LobbySummary[]; error?: string }) => void,
  ) => void;
  'lobby:species': (
    payload: { sessionId: string; speciesId: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
}

// ---------------------------------------------------------------------------
// GameClient
// ---------------------------------------------------------------------------

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class GameClient {
  private socket: AppSocket | null = null;
  private _currentSessionId: string | null = null;

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Connect to the game server.  Resolves when the socket is confirmed
   * connected; rejects on timeout or error.
   */
  connect(serverUrl: string = 'http://localhost:3000'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const socket: AppSocket = io(serverUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
        timeout: 10_000,
      });

      socket.on('connect', () => {
        console.log('[GameClient] Connected – id:', socket.id);
        this.socket = socket;
        resolve();
      });

      socket.on('connect_error', (err) => {
        console.error('[GameClient] Connection error:', err.message);
        reject(new Error(`Failed to connect to server: ${err.message}`));
      });

      socket.on('server:error', (payload) => {
        console.error('[GameClient] Server error:', payload);
      });
    });
  }

  /** Disconnect from the server and clean up all listeners. */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._currentSessionId = null;
    }
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get currentSessionId(): string | null {
    return this._currentSessionId;
  }

  // ---------------------------------------------------------------------------
  // Lobby actions
  // ---------------------------------------------------------------------------

  /** Create a new lobby.  Returns the session ID assigned by the server. */
  async createGame(playerName: string, config: LobbyConfig): Promise<string> {
    const socket = this.requireSocket();

    return new Promise((resolve, reject) => {
      socket.emit('lobby:create', { playerName, config }, (ack) => {
        if (ack.success && ack.sessionId) {
          this._currentSessionId = ack.sessionId;
          resolve(ack.sessionId);
        } else {
          reject(new Error(ack.error ?? 'Failed to create game.'));
        }
      });
    });
  }

  /** Join an existing lobby. */
  async joinGame(playerName: string, sessionId: string, password?: string): Promise<void> {
    const socket = this.requireSocket();

    return new Promise((resolve, reject) => {
      socket.emit('lobby:join', { sessionId, playerName, password }, (ack) => {
        if (ack.success) {
          this._currentSessionId = sessionId;
          resolve();
        } else {
          reject(new Error(ack.error ?? 'Failed to join game.'));
        }
      });
    });
  }

  /** Toggle ready status. */
  async setReady(ready: boolean): Promise<void> {
    const socket = this.requireSocket();
    const sessionId = this.requireSessionId();

    return new Promise((resolve, reject) => {
      socket.emit('lobby:ready', { sessionId, ready }, (ack) => {
        if (ack.success) resolve();
        else reject(new Error(ack.error ?? 'Failed to set ready status.'));
      });
    });
  }

  /** (Host only) Start the game once all players are ready. */
  async startGame(): Promise<void> {
    const socket = this.requireSocket();
    const sessionId = this.requireSessionId();

    return new Promise((resolve, reject) => {
      socket.emit('lobby:start', { sessionId }, (ack) => {
        if (ack.success) resolve();
        else reject(new Error(ack.error ?? 'Failed to start game.'));
      });
    });
  }

  /** Send a chat message to the current lobby. */
  async sendChat(message: string): Promise<void> {
    const socket = this.requireSocket();
    const sessionId = this.requireSessionId();

    return new Promise((resolve, reject) => {
      socket.emit('lobby:chat', { sessionId, message }, (ack) => {
        if (ack.success) resolve();
        else reject(new Error(ack.error ?? 'Failed to send message.'));
      });
    });
  }

  /** Fetch the list of open lobbies. */
  async listGames(): Promise<LobbySummary[]> {
    const socket = this.requireSocket();

    return new Promise((resolve, reject) => {
      socket.emit('lobby:list', (ack) => {
        if (ack.success) resolve(ack.lobbies);
        else reject(new Error(ack.error ?? 'Failed to list games.'));
      });
    });
  }

  /** Choose a species in the lobby. */
  async selectSpecies(speciesId: string): Promise<void> {
    const socket = this.requireSocket();
    const sessionId = this.requireSessionId();

    return new Promise((resolve, reject) => {
      socket.emit('lobby:species', { sessionId, speciesId }, (ack) => {
        if (ack.success) resolve();
        else reject(new Error(ack.error ?? 'Failed to select species.'));
      });
    });
  }

  // ---------------------------------------------------------------------------
  // In-game actions
  // ---------------------------------------------------------------------------

  /** Submit a game action to the server. */
  sendAction(action: GameAction): void {
    const socket = this.requireSocket();

    socket.emit('game:action', action, (ack) => {
      if (!ack.success) {
        console.warn('[GameClient] game:action rejected:', ack.error);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Event subscriptions
  // ---------------------------------------------------------------------------

  /** Subscribe to full lobby state updates. */
  onLobbyState(callback: (state: LobbyState) => void): () => void {
    const socket = this.requireSocket();
    socket.on('lobby:state', callback);
    return () => socket.off('lobby:state', callback);
  }

  /** Subscribe to lobby chat messages. */
  onLobbyMessage(callback: (msg: LobbyChatMessage) => void): () => void {
    const socket = this.requireSocket();
    socket.on('lobby:message', callback);
    return () => socket.off('lobby:message', callback);
  }

  /** Subscribe to the game-started event. */
  onGameStarted(callback: (payload: { sessionId: string; galaxyConfig: LobbyGalaxyConfig }) => void): () => void {
    const socket = this.requireSocket();
    socket.on('lobby:game_started', callback);
    return () => socket.off('lobby:game_started', callback);
  }

  /** Subscribe to incoming game state snapshots. */
  onGameState(callback: (state: GameState) => void): () => void {
    const socket = this.requireSocket();
    socket.on('game:state', callback);
    return () => socket.off('game:state', callback);
  }

  /** Subscribe to player-joined notifications. */
  onPlayerJoined(callback: (payload: { playerId: string; sessionId: string; playerName?: string }) => void): () => void {
    const socket = this.requireSocket();
    socket.on('player:joined', callback);
    return () => socket.off('player:joined', callback);
  }

  /** Subscribe to player-left notifications. */
  onPlayerLeft(callback: (payload: { playerId: string; sessionId: string; playerName?: string }) => void): () => void {
    const socket = this.requireSocket();
    socket.on('player:left', callback);
    return () => socket.off('player:left', callback);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private requireSocket(): AppSocket {
    if (!this.socket?.connected) {
      throw new Error('[GameClient] Not connected to server. Call connect() first.');
    }
    return this.socket;
  }

  private requireSessionId(): string {
    if (!this._currentSessionId) {
      throw new Error('[GameClient] Not in a session. Call createGame() or joinGame() first.');
    }
    return this._currentSessionId;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

let _instance: GameClient | null = null;

/** Return the shared GameClient singleton, creating it on first call. */
export function getGameClient(): GameClient {
  if (!_instance) {
    _instance = new GameClient();
  }
  return _instance;
}
