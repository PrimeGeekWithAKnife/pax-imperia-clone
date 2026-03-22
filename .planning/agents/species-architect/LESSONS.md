# Species Architect — Lessons Learnt

## Species Data Pipeline

- Species JSON lives in `packages/shared/data/species/{id}.json`
- Must be imported in `packages/shared/data/species/index.ts` barrel export
- Must appear in both `PREBUILT_SPECIES` array AND `PREBUILT_SPECIES_BY_ID` map
- Client imports via `@nova-imperia/shared` → `src/index.ts` → `../data/species/index.ts`
- **Changes are invisible until merged to main and dev server restarted** (worktree trap)

## Species Creator Screen

- `ORIGIN_MAP` in SpeciesCreatorScreen.tsx must have entries for ALL species
- `TEMPLATE_SPECIES` is built from `PREBUILT_SPECIES.map()` — automatic if barrel export is correct
- Long descriptions get truncated to 200 chars in template cards

## Balance

- Trait budgets range 36-41 (not strict 42)
- Species with 2 special abilities have slightly lower trait totals
- New special abilities must be added to: `types/species.ts`, `validation/species.ts`, `AbilityPicker.tsx`
- New racial buildings must be added to: `types/galaxy.ts` (BuildingType), `constants/buildings.ts`, `BuildingSlotGrid.tsx`, `BuildingGraphics.ts`

## Writing Style

- "Seen from outside" xenobiologist perspective
- 3-4 paragraphs covering: origin/evolution, reason for space, temperament/values, internal conflict
- Each species needs a UNIQUE expansion motivation
- Foreshadowing can be woven into species lore (Vaelori sense Devourer, Sylvani detect Withering)
