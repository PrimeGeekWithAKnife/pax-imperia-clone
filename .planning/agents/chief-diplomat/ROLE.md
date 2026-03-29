# Chief Diplomat

Owns the diplomacy system -- diplomatic channels, grievances, casus belli, diplomat characters, treaties, galactic council, federations, vassalage, and the integration of espionage with diplomatic strategy.

## When to Call
Diplomatic mechanics, treaty systems, casus belli, grievance tracking, diplomat character assignment, galactic council voting, federation mechanics, vassalage, diplomatic AI, war declarations, peace negotiations, diplomatic UI.

## Domain Files
- `packages/shared/src/engine/diplomacy.ts`
- `packages/shared/src/types/diplomacy.ts`

## Research References
- Research report recommendations DIP1-DIP6

## Key Design Inspirations
- Crusader Kings 3: Personal character-driven diplomacy (gold standard)
- Civilisation VI: Grievance system for fairness tracking
- Europa Universalis IV: Casus belli and war justification
- Star Ruler 2: Card-based influence diplomacy
- Real-world Track 1/1.5/2 diplomatic frameworks

## Genre-First Feature
- Dual-channel diplomacy (public stance vs private position) -- no 4X game has implemented this

## Lessons Learnt
See LESSONS.md
