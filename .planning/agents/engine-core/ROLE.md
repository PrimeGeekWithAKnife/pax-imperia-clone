# Engine Core

Owns the game engine, save/load, tick loop, state management, Phaser scene lifecycle, event system, main menu, pause menu, networking.

## When to Call
Engine bugs (speed buttons, scene transitions), save/load issues, auto-save, tick loop, state sync between React and Phaser, main menu, pause menu, networking, multiplayer.

## Domain Files
- `packages/client/src/engine/GameEngine.ts`
- `packages/client/src/engine/SaveManager.ts`
- `packages/client/src/engine/migration.ts`
- `packages/shared/src/engine/game-loop.ts`
- `packages/shared/src/engine/save-load.ts`
- `packages/client/src/ui/App.tsx`
- `packages/client/src/ui/hooks/useGameState.ts`
- `packages/client/src/game/scenes/MainMenuScene.ts`
- `packages/client/src/game/scenes/BootScene.ts`
- `packages/client/src/ui/screens/PauseMenu.tsx`
- `packages/client/src/ui/screens/SaveLoadScreen.tsx`
- `packages/server/`

## Lessons Learnt
- GameEngine owns GameTickState, advances on setInterval
- Speed changes MUST only reschedule the interval — never trigger scene transitions
- Speed button bug: Fast/Fastest was reportedly showing MainMenuScene (state sync issue)
- Phaser↔React bridge: window.__EX_NIHILO_GAME__ and window.__GAME_ENGINE__
- Auto-save changing to real-time (60s) with 5-slot rotation (__autosave_1__ to __autosave_5__)
- SaveManager uses localStorage with 'nova-imperia:save:' prefix
- Main menu needs Resume button when game is in progress
- processGameTick returns { newState, events }
- Escape key handling must respect current screen state
- **CRITICAL**: `this.game.events` is GLOBAL across all Phaser scenes. Listeners registered with `.on()` persist even after the registering scene shuts down. EVERY `game.events.on()` MUST have a matching `game.events.off()` in the SHUTDOWN handler, using a named/stored callback reference (not an anonymous arrow function).
- **CRITICAL**: Anonymous arrow functions passed to `game.events.on()` cannot be removed with `.off()` — always use named methods or stored arrow properties (e.g. `private _handleFoo = (): void => { ... };`).
- Calling `game.events.off('event_name')` without a callback reference removes ALL listeners for that event, including those from React hooks via `useGameEvent()`. Always pass the specific callback.
- When starting a new game, the old engine MUST be destroyed via `destroyGameEngine()` before creating a new one. Otherwise `getGameEngine()` returns the stale engine and GalaxyMapScene reuses old game state.
- `handleExitToMainMenu` in App.tsx must reset ALL React game-session state (selections, galaxy, resources, research, empires, fleets, etc.) — not just `gameStarted` and `isPaused`.
- Both GalaxyMapScene AND SystemViewScene must handle `ui:speed_change`, `music:set_track`, and `ui:exit_to_menu` events, since only one scene is active at a time.
- The "← Main Menu" back button in GalaxyMapScene must destroy the engine (via `destroyGameEngine()`) to prevent stale state when starting a new game.
