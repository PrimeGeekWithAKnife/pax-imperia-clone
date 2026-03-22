/**
 * Socket.io event type definitions for Ex Nihilo.
 * Provides typed interfaces for all client↔server communication.
 */

/** Payload sent when a player joins or leaves a game room */
export interface PlayerEventPayload {
  playerId: string;
  sessionId: string;
  playerName?: string;
}

/** Payload for game actions initiated by a client */
export interface GameActionPayload {
  sessionId: string;
  actionType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

/** Snapshot of a game state broadcast to all players in a room */
export interface GameStatePayload {
  sessionId: string;
  turn: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any>;
}

/** Error payload emitted back to the originating client */
export interface ErrorPayload {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Lobby types
// ---------------------------------------------------------------------------

export type GalaxySize = 'small' | 'medium' | 'large' | 'huge';
export type GalaxyShape = 'spiral' | 'elliptical' | 'irregular' | 'ring';

/** Galaxy configuration chosen in the lobby. */
export interface LobbyGalaxyConfig {
  size: GalaxySize;
  shape: GalaxyShape;
  seed: string;
}

/** Configuration used when creating a new lobby. */
export interface LobbyConfig {
  gameName: string;
  maxPlayers: number;
  password?: string;
  galaxyConfig: LobbyGalaxyConfig;
}

/** Per-player state visible to all lobby members. */
export interface LobbyPlayer {
  playerId: string;
  playerName: string;
  isReady: boolean;
  isHost: boolean;
  speciesId: string | null;
}

/** Summary of a lobby session returned by 'lobby:list'. */
export interface LobbySummary {
  sessionId: string;
  gameName: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  galaxySize: GalaxySize;
  hasPassword: boolean;
}

/** Full lobby state broadcast to all members. */
export interface LobbyState {
  sessionId: string;
  gameName: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  galaxyConfig: LobbyGalaxyConfig;
  hasPassword: boolean;
}

/** Chat message payload. */
export interface LobbyChatMessage {
  sessionId: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Socket.io typed interfaces
// ---------------------------------------------------------------------------

/**
 * Events that a **client** can emit and the **server** listens for.
 */
export interface ClientToServerEvents {
  /** Request to join a game session room */
  'game:join': (payload: { sessionId: string; playerName: string }, callback: (ack: { success: boolean; error?: string }) => void) => void;

  /** Request to leave the current game session room */
  'game:leave': (payload: { sessionId: string }, callback: (ack: { success: boolean }) => void) => void;

  /** Submit a game action (move, build, attack, etc.) */
  'game:action': (payload: GameActionPayload, callback: (ack: { success: boolean; error?: string }) => void) => void;

  // ── Lobby events ──────────────────────────────────────────────────────────

  /** Create a new lobby and become its host. */
  'lobby:create': (
    payload: { playerName: string; config: LobbyConfig },
    callback: (ack: { success: boolean; sessionId?: string; error?: string }) => void,
  ) => void;

  /** Join an existing lobby by session ID. */
  'lobby:join': (
    payload: { sessionId: string; playerName: string; password?: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;

  /** Toggle ready status for the current player. */
  'lobby:ready': (
    payload: { sessionId: string; ready: boolean },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;

  /** Host requests to start the game (all players must be ready). */
  'lobby:start': (
    payload: { sessionId: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;

  /** Send a chat message to the lobby. */
  'lobby:chat': (
    payload: { sessionId: string; message: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;

  /** Request a list of open lobbies. */
  'lobby:list': (
    callback: (ack: { success: boolean; lobbies: LobbySummary[]; error?: string }) => void,
  ) => void;

  /** Select a species in the lobby. */
  'lobby:species': (
    payload: { sessionId: string; speciesId: string },
    callback: (ack: { success: boolean; error?: string }) => void,
  ) => void;
}

/**
 * Events that the **server** emits and a **client** listens for.
 */
export interface ServerToClientEvents {
  /** Broadcast when a new player has joined a session */
  'player:joined': (payload: PlayerEventPayload) => void;

  /** Broadcast when a player has left a session */
  'player:left': (payload: PlayerEventPayload) => void;

  /** Full game-state snapshot pushed to all players in a room */
  'game:state': (payload: GameStatePayload) => void;

  /** Server-side error notification */
  'server:error': (payload: ErrorPayload) => void;

  // ── Lobby events ──────────────────────────────────────────────────────────

  /** Full lobby state update, broadcast when any lobby member changes. */
  'lobby:state': (payload: LobbyState) => void;

  /** Chat message broadcast to all lobby members. */
  'lobby:message': (payload: LobbyChatMessage) => void;

  /** Server tells all players to start the game. */
  'lobby:game_started': (payload: { sessionId: string; galaxyConfig: LobbyGalaxyConfig }) => void;
}

/**
 * Events used for communication between Socket.io **server instances**
 * (e.g. via an adapter for horizontal scaling).  Currently empty.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {
  // Reserved for future clustering support.
}

/**
 * Persistent data stored on the socket object itself.
 */
export interface SocketData {
  /** Unique player identifier, set after a successful 'game:join' */
  playerId: string;
  /** Display name chosen by the player */
  playerName: string;
  /** The session room this socket is currently participating in */
  currentSessionId: string | null;
}
