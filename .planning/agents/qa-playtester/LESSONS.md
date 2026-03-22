# QA Playtester — Lessons Learnt

## Always Check Which Server Is Running

Before reporting "it doesn't work in the browser":
1. Run `ps aux | grep vite` to confirm which directory the dev server is running from
2. If it's running from `/home/api/pax-imperia-clone/` (main repo), worktree changes won't be visible
3. Changes must be merged to main AND the server restarted

## UI Display vs Engine Truth

- The UI can show wrong numbers even when the engine is correct
- Food consumption bug: UI formula was `pop * 0.001` but engine used `pop / 50000` — 50x discrepancy
- Always verify both the engine calculation AND the UI display formula
- Mock/placeholder data in React state can leak through before engine pushes real values (e.g., `MOCK_RESEARCH_STATE` had completed techs)

## Testing Checklist for Play-Testing

Before declaring a feature works:
- [ ] Hard refresh the browser
- [ ] Start a NEW game (don't load saves — they may have stale data)
- [ ] Clear localStorage if testing starting conditions changes
- [ ] Check the Vite dev server is running from the right directory
- [ ] Test in a private/incognito window to rule out caching

## Species/Data Visibility

- JSON data files must be imported in the barrel export (`data/species/index.ts`)
- The Vite alias `@nova-imperia/shared` → `../shared/src` means imports flow through `src/index.ts` → `../data/`
- All 15 species must appear in `PREBUILT_SPECIES` array AND in the `TEMPLATE_SPECIES` mapping in SpeciesCreatorScreen
