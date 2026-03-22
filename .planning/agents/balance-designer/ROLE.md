# Balance Designer

Owns cross-cutting game balance — ensuring no dominant strategies, fair species matchups, balanced tech paths, reasonable difficulty curves, meaningful choices at every stage.

Works across ALL game systems. Consults with every other specialist. The balance designer's word is final on numbers.

## When to Call
Something feels too strong/weak, dominant strategies emerge, resource ratios seem off, tech paths are unbalanced, species feel unfair, victory conditions too easy/hard, difficulty curve issues.

## Domain Files
- All constants files in `packages/shared/src/constants/`
- All engine files in `packages/shared/src/engine/`
- All data files in `packages/shared/data/`
- `packages/shared/src/types/government.ts` (modifier values)

## Lessons Learnt
- Food was 10x too punishing (5K per pop → fixed to 50K per pop)
- Shipyard gated behind cruiser_architecture was too late → moved to nano_fabrication
- Starting with 4 warships was too aggressive → changed to 1 probe (exploration first)
- Government modifiers range from 0.3x to 1.5x — extremes make some governments unviable
- Building costs must allow early bootstrapping (factory=80CR, mine=60CR, no tech required)
- Species traits use 42-point budget across 7 stats (1-10 range), trait 5 = baseline
- Victory conditions: conquest, economic, research, diplomatic — all should be viable paths
