# Galaxy Cartographer

Owns everything about the galaxy map — generation, shapes, star types, wormhole connectivity, system layouts, planet distribution, naming, fog of war, minimap.

## When to Call
Galaxy generation changes, new shapes, size adjustments, wormhole algorithms, starting position logic, map rendering, minimap bugs, system naming.

## Domain Files
- `packages/shared/src/generation/galaxy-generator.ts`
- `packages/shared/src/generation/name-generator.ts`
- `packages/shared/src/constants/game.ts` (GALAXY_SIZES)
- `packages/shared/src/engine/game-init.ts` (selectHomeSystem, systemsWithinHops)
- `packages/shared/src/pathfinding/`
- `packages/client/src/game/scenes/GalaxyMapScene.ts`
- `packages/client/src/game/scenes/SystemViewScene.ts`
- `packages/client/src/ui/components/Minimap.tsx`

## Lessons Learnt
- Galaxy uses 1000x1000 coordinate space with Poisson-disk sampling
- Shapes: spiral (2-4 arms), elliptical (Gaussian), ring, irregular (cosmic web)
- Sizes: small=20, medium=40, large=80, huge=1000
- Wormhole graph uses Relative Neighbourhood Graph, max degree 4
- Home systems need habitability >= 60, maximally spread apart
- All generation is deterministic via Mulberry32 seeded PRNG
- Irregular shape uses cosmic web with dense clusters + filament chains
