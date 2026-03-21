/**
 * Client-side game engine.
 *
 * Bridges the shared game-loop (processGameTick / getTickRate) to the browser.
 * The engine owns the GameTickState, advances it on a setInterval, and emits
 * events on the Phaser game instance so both Phaser scenes and React hooks can
 * react to simulation updates.
 *
 * Lifecycle
 * ---------
 *  1. Construct with a Phaser.Game reference and an initial GameTickState.
 *  2. Call start() to begin ticking at the current speed.
 *  3. Call pause() / setSpeed() at any time.
 *  4. The engine is accessible globally via window.__GAME_ENGINE__.
 *
 * Events emitted on game.events
 * -----------------------------
 *  'engine:tick'              { tick: number }
 *  'engine:resources_updated' { empireId: string; credits: number; researchPoints: number }[]
 *  'engine:fleet_moved'       FleetMovedEvent
 *  'engine:combat_resolved'   CombatResolvedEvent
 *  'engine:tech_researched'   TechResearchedEvent
 *  'engine:game_over'         { winnerId?: string; reason?: string }
 *  'engine:galaxy_updated'    Galaxy   (emitted every tick so minimap can refresh)
 */

import type Phaser from 'phaser';
import {
  processGameTick,
  initializeTickState,
  getTickRate,
} from '@nova-imperia/shared';
import type { GameTickState } from '@nova-imperia/shared';
import type { GameSpeedName } from '@nova-imperia/shared';
import type {
  FleetMovedEvent,
  CombatResolvedEvent,
  TechResearchedEvent,
} from '@nova-imperia/shared';

// ── Type helpers ─────────────────────────────────────────────────────────────

/** Minimal slice of Phaser.Game we actually use so we can avoid a hard Phaser import. */
interface PhaserGameBridge {
  events: {
    emit: (event: string, data?: unknown) => void;
  };
}

// ── GameEngine ────────────────────────────────────────────────────────────────

export class GameEngine {
  private tickState: GameTickState;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /**
   * @param game      The Phaser game instance (used for event emission).
   * @param tickState The initial GameTickState produced by initializeTickState().
   */
  constructor(
    private readonly game: PhaserGameBridge,
    tickState: GameTickState,
  ) {
    this.tickState = tickState;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Start the tick loop using the current game speed. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this._scheduleInterval();
  }

  /** Pause the tick loop.  State is preserved; call start() to resume. */
  pause(): void {
    this.running = false;
    this._clearInterval();
    // Keep the game-state status in sync
    this.tickState = {
      ...this.tickState,
      gameState: { ...this.tickState.gameState, status: 'paused', speed: 'paused' },
    };
  }

  /**
   * Change game speed.
   * If the engine is running, the interval is rescheduled immediately.
   * Pausing via setSpeed('paused') is equivalent to calling pause().
   */
  setSpeed(speed: GameSpeedName): void {
    // Update the canonical speed stored in the tick state
    this.tickState = {
      ...this.tickState,
      gameState: {
        ...this.tickState.gameState,
        speed,
        status: speed === 'paused' ? 'paused' : 'playing',
      },
    };

    if (speed === 'paused') {
      this.pause();
      return;
    }

    // If the engine was paused by a previous setSpeed('paused') call, resume it
    if (!this.running) {
      this.running = true;
    }

    // Reschedule at the new rate
    this._clearInterval();
    this._scheduleInterval();
  }

  /** Process exactly one tick and emit events.  Called by the interval. */
  tick(): void {
    const { newState, events } = processGameTick(this.tickState);
    this.tickState = newState;

    // ── Emit per-event notifications ────────────────────────────────────────
    for (const event of events) {
      switch (event.type) {
        case 'FleetMoved':
          this.game.events.emit('engine:fleet_moved', event as FleetMovedEvent);
          break;
        case 'CombatResolved':
          this.game.events.emit('engine:combat_resolved', event as CombatResolvedEvent);
          break;
        case 'TechResearched':
          this.game.events.emit('engine:tech_researched', event as TechResearchedEvent);
          break;
        default:
          break;
      }
    }

    // ── Emit aggregate tick notification ────────────────────────────────────
    this.game.events.emit('engine:tick', { tick: this.tickState.gameState.currentTick });

    // ── Emit per-empire resource updates ────────────────────────────────────
    const resourceUpdates = this.tickState.gameState.empires.map(e => ({
      empireId: e.id,
      credits: e.credits,
      researchPoints: e.researchPoints,
    }));
    this.game.events.emit('engine:resources_updated', resourceUpdates);

    // ── Emit galaxy snapshot so the minimap can refresh ─────────────────────
    this.game.events.emit('engine:galaxy_updated', this.tickState.gameState.galaxy);

    // ── Game-over check ──────────────────────────────────────────────────────
    if (this.tickState.gameState.status === 'finished') {
      this._clearInterval();
      this.running = false;
      this.game.events.emit('engine:game_over', { reason: 'finished' });
    }
  }

  /** Return the current tick state snapshot. */
  getState(): GameTickState {
    return this.tickState;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _scheduleInterval(): void {
    const speed = this.tickState.gameState.speed;
    const ms = getTickRate(speed);
    if (ms <= 0) return; // paused — nothing to schedule
    this.intervalId = setInterval(() => this.tick(), ms);
  }

  private _clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// ── Module-level factory and global accessor ──────────────────────────────────

/**
 * Create a GameEngine from a GameState, store it on window.__GAME_ENGINE__,
 * and return it.
 *
 * Convenience wrapper used from GalaxyMapScene after initializeGame().
 */
export function createGameEngine(
  game: Phaser.Game,
  tickState: GameTickState,
): GameEngine {
  const engine = new GameEngine(game as unknown as PhaserGameBridge, tickState);
  (window as unknown as Record<string, unknown>).__GAME_ENGINE__ = engine;
  return engine;
}

/** Retrieve the running GameEngine from the window global, if present. */
export function getGameEngine(): GameEngine | undefined {
  return (window as unknown as Record<string, unknown>).__GAME_ENGINE__ as GameEngine | undefined;
}

// Re-export initializeTickState so callers can import from one place
export { initializeTickState };
