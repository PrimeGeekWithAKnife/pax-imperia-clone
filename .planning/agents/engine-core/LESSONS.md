# Engine Core — Lessons Learnt

## CRITICAL: Worktree vs Main Repo Dev Server

**The Vite dev server runs from `/home/api/pax-imperia-clone/` (main repo), NOT from any worktree.** Changes made in a worktree are invisible to the player until merged into main and the dev server is restarted.

### Deployment checklist:
1. Push worktree branch: `git push origin <branch>`
2. In main repo: `git merge origin/<branch> --no-edit`
3. Resolve any conflicts (prefer worktree version with `git checkout --theirs`)
4. Kill old Vite: find PID via `ps aux | grep vite`, then `kill <PID>`
5. Restart: `cd /home/api/pax-imperia-clone && npm run dev &`

### Common symptoms of this mistake:
- "I hard refreshed but still see old data" — worktree not merged
- "Only 8 species showing" — new species JSON exists in worktree but not in main
- Any feature that tests pass for but isn't visible in the browser

## Event Listener Lifecycle in Phaser

- `game.events` is GLOBAL across all scenes
- Listeners registered with `.on()` persist after scene shutdown
- EVERY `game.events.on()` MUST have a matching `.off()` in SHUTDOWN
- Use named class properties (not anonymous lambdas) so `.off()` can remove them
- Calling `.off('event')` without callback reference removes ALL listeners including React hooks

## Engine Destruction on New Game

- `destroyGameEngine()` must be called before creating a new game
- Otherwise `getGameEngine()` returns stale state
- Both "New Game" and "Exit to Menu" paths must destroy the engine
- React state must be fully reset in `handleStartGame` and `handleExitToMainMenu`

## Auto-Save and Stale Data

- Old auto-saves in localStorage persist across code changes
- Starting conditions changes (e.g., probe instead of fleet) won't be visible if player loads an old save
- The Resume button loads auto-saves — players may see old game state after code changes
