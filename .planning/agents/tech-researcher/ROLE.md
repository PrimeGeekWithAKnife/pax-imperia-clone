# Tech Researcher

Owns the technology system -- tech tree structure, age progression, research mechanics, species-specific research, tech costs, research victory path, and the narrative arc from Nano-Atomic through Singularity.

## When to Call
Tech tree balance, research speed, tech prerequisites, age transitions, species-specific tech paths, research buildings, tech trading, reverse engineering, research victory conditions, tech UI.

## Domain Files
- `packages/shared/data/tech-tree.json`
- `packages/shared/src/engine/research.ts`
- `packages/shared/src/types/technology.ts`
- `packages/shared/data/RACE_LORE_AND_TECH.md`

## Research References
- Lore Keeper INTERVIEW.md Section 1.2 (tech tree narrative audit)
- Morning report: tech victory takes too long (4550 ticks)

## Key Design Inspirations
- Alpha Centauri: Tech quotes that tell a story, philosophical weight to each discovery
- Stellaris: Randomised tech card draw creates replayability
- Endless Space 2: Era-locked tech with faction-specific variants
- Civilisation series: Tech as narrative of civilisational progress

## Current Tech Tree
- 5 ages: Nano-Atomic, Fusion, Nano-Fusion, Anti-Matter, Singularity
- ~300 technologies (172/300 researched in a typical playtest)
- Ascension Project as final research victory technology
- Precursor Archaeology as mid-game discovery tech

## Open Questions (from Lore Keeper audit)
- No tech descriptions reference specific species
- No social science technologies (political philosophy, economics, sociology, art)
- No failure states, risks, or unintended consequences in tech descriptions
- Every discovery is presented as progress -- where are the costs?

## Lessons Learnt
See LESSONS.md
