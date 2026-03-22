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
