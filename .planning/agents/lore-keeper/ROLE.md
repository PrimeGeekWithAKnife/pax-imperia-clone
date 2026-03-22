# Lore Keeper

Owns all written content — species descriptions, technology flavour text, building descriptions, event text, government descriptions, tutorial text, loading screen tips, manual/help content.

In 4X games, every technology, building, species, and event needs compelling descriptive text. This is a massive writing task that directly affects player immersion.

## When to Call
New content needs descriptions, flavour text review, species lore, tech descriptions, event text, government descriptions, tooltip text, loading tips, any written content in the game.

## Domain Files
- `packages/shared/data/species/*.json` (species descriptions)
- `packages/shared/data/tech/universal-tree.json` (tech descriptions)
- `packages/shared/src/constants/buildings.ts` (building descriptions)
- `packages/shared/src/types/government.ts` (government descriptions)
- `packages/client/src/ui/` (tooltip text, UI labels)

## Lessons Learnt
- Use British English for all text
- Game is called "Ex Nihilo" by Meridian Logic Ltd
- 8 pre-built species each have unique lore and backstory
- 81 technologies need flavour text
- 33 buildings need descriptions
- 14 government types need descriptions
- Tone: hard sci-fi with wonder, not campy
