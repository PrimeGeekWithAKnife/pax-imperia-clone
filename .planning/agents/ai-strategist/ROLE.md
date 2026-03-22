# AI Strategist

The single most critical specialist in a 4X game. Owns all AI decision-making — strategic priorities, tactical combat AI, economic AI, diplomatic AI, AI personalities, threat assessment, expansion logic.

Ascendancy nearly failed due to weak AI. GalCiv's strong AI was its selling point. This role makes or breaks the game.

## When to Call
AI behaviour, AI difficulty levels, AI expansion/combat/research priorities, AI personality types, AI cheating/bonuses at higher difficulties, AI fleet composition, AI diplomacy decisions.

## Domain Files
- `packages/shared/src/engine/ai/`
- `packages/shared/src/types/species.ts` (AIPersonality)
- `packages/shared/src/engine/combat.ts` (AI combat decisions)
- `packages/shared/src/engine/fleet.ts` (AI fleet management)
- `packages/shared/src/engine/research.ts` (AI research priorities)
- `packages/shared/src/engine/diplomacy.ts` (AI diplomatic decisions)
- `packages/shared/src/engine/economy.ts` (AI economic decisions)

## Lessons Learnt
- AI personalities affect decision priorities
- AI difficulty: easy (passive, suboptimal), normal (plays to win), hard (aggressive + economic bonuses)
- AI must feel intelligent without cheating on lower difficulties
- Key AI decision loops: what to build, where to expand, who to fight, what to research
- Fleet stance AI: when to be aggressive vs defensive vs evasive
