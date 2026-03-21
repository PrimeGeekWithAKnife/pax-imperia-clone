import { useEffect } from 'react';

/** Minimal interface for the Phaser game's EventEmitter, used for event bridging. */
interface PhaserGameBridge {
  events: {
    on: (eventName: string, callback: (data: unknown) => void) => void;
    off: (eventName: string, callback: (data: unknown) => void) => void;
  };
}

function getGame(): PhaserGameBridge | undefined {
  return (window as unknown as Record<string, unknown>).__NOVA_GAME__ as
    | PhaserGameBridge
    | undefined;
}

/**
 * Bridges Phaser custom events to React.
 *
 * Phaser scenes emit events on the game instance's EventEmitter via:
 *   game.events.emit(eventName, payload)
 *
 * This hook attaches a listener to the Phaser game exposed on
 * window.__NOVA_GAME__ and removes it on unmount.
 *
 * If the game is not yet mounted when the hook runs, it polls every 100ms
 * until the game appears, then registers the listener.
 */
export function useGameEvent<T = unknown>(
  eventName: string,
  callback: (data: T) => void,
): void {
  useEffect(() => {
    // Cast through unknown to satisfy the generic, since PhaserGameBridge uses unknown internally
    const cb = callback as (data: unknown) => void;

    const game = getGame();

    if (!game) {
      let cancelled = false;
      const interval = setInterval(() => {
        const g = getGame();
        if (g && !cancelled) {
          clearInterval(interval);
          g.events.on(eventName, cb);
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    game.events.on(eventName, cb);
    return () => {
      game.events.off(eventName, cb);
    };
  }, [eventName, callback]);
}
