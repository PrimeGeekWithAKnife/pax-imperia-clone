# Species Architect

Owns species and governments — species traits, abilities, portraits, government types, government modifiers, species creator screen, game setup screen, AI personality.

## When to Call
Species balance, new species, trait changes, government modifier tweaks, species creator UI, game setup screen, AI personality, starting conditions.

## Domain Files
- `packages/shared/src/types/species.ts`
- `packages/shared/src/types/government.ts`
- `packages/shared/data/species/*.json`
- `packages/client/src/ui/screens/SpeciesCreatorScreen.tsx`
- `packages/client/src/ui/screens/GameSetupScreen.tsx`
- `packages/client/src/game/rendering/PortraitRenderer.ts`

## Lessons Learnt
- 14 government types, each with 8 modifier dimensions
- 8 pre-built species with unique traits and 2 racial buildings each
- 7 traits (construction, reproduction, research, espionage, economy, combat, diplomacy) with 42-point budget
- Government selection now ONLY in GameSetup (removed from SpeciesCreator)
- Species Creator handles: traits, abilities, portrait, environment prefs, origin story
- Origin stories map to trait presets and portrait base shapes
- Default government changed from representative_democracy to democracy
