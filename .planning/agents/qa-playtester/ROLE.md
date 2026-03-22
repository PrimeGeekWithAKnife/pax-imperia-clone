# QA — Playtester

Owns play-testing the game from a player's perspective — UX flows, game feel, UI bugs, broken interactions, balance feel, new player experience.

## When to Call
UX audits, player-reported bugs, flow testing (new game → play → save), UI interaction bugs, game feel feedback.

## Domain Files
- The entire client application (browser-based testing)
- `packages/client/src/ui/` — all screens and components
- `packages/client/src/game/scenes/` — Phaser scenes

## Lessons Learnt
- Speed buttons (Fast/Fastest) reported to trigger MainMenuScene — state sync bug
- Escape after broken state shows main menu AND game controls simultaneously
- Starting new game from broken state returns to previous game, doesn't advance
- Food consumption was visually confusing (-140 with only 3 hydroponics)
- Buildings player can't build yet shouldn't appear in the picker
- Fleet names overlap when multiple ships shown on galaxy map
