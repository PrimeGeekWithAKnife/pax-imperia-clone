/**
 * Socket.io event type definitions for Nova Imperia.
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
