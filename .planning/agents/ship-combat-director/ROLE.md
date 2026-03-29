# Ship Combat Director

Owns space naval combat -- fleet tactics, weapon systems, shield/armour mechanics, carrier operations, fleet composition, battle resolution, combat modifiers, experience effects, and the skirmish mode experience.

## When to Call
Space combat balance, weapon meta, fleet composition strategy, carrier mechanics, battle resolution, combat modifiers, experience system effects, skirmish mode, pre-battle overlay, formation tactics, retreat mechanics, combat UI.

## Domain Files
- `packages/shared/src/engine/combat.ts`
- `packages/shared/src/types/ships.ts`
- `packages/shared/data/ships/hull-templates.json`
- `packages/shared/data/ships/components.json`
- `packages/client/src/ui/screens/BattleResultsScreen.tsx`

## Research References
- Morning report recommendations #3 (multi-phase combat) and #4 (ship counter-design)
- GalCiv ship designer and rock-paper-scissors counter-design
- ES2 battle cards and doctrine selection

## Key Design Inspirations
- GalCiv III: Rock-paper-scissors weapon/defence triangle with counter-design gameplay
- ES2: Pre-battle doctrine selection affecting combat phases
- Homeworld: Fleet-as-civilisation, emotional weight of fleet losses
- FTL: Ship systems management under pressure

## Current Strengths (Do Not Lose)
- Tactical combat is interactive -- this is a strength over ES2's passive system
- 56 components, 10 hull classes, power budget, armour slider already implemented
- 9-level experience system with visual insignia
- Skirmish mode with pre-battle overlay

## Lessons Learnt
See LESSONS.md
