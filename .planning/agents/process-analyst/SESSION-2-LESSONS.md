# Session 2 — Lessons Learnt (23 March 2026)

## For ALL Agents

### Deployment Pipeline
- **1 tick = 1 day.** ALL timings (build times, decay, research, fuel) must be calibrated to this.
- Dev server is CT 108 (192.168.1.172). Auto-deploy after every commit via rsync.
- UAT (192.168.1.12) is for kids playtesting — do NOT deploy unstable work there.
- AIOrca (192.168.1.26) is NOT a game server.
- After rsync, Vite HMR picks up changes — no restart needed for client code.

### Common Pitfalls Found This Session
1. **New engine systems must be WIRED INTO the game loop** — building pure functions is not enough. Energy flow, waste, condition engines sat unused until explicitly called in `processGameTick`.
2. **GameEngine.tick() needs try/catch** — a single throw in processGameTick silently freezes the entire game. All state updates stop but the UI stays responsive, making the bug look like "nothing works."
3. **localStorage quota** — saves are ~200-500KB each. 5 auto-saves + manual saves can exceed the 5MB limit. Always handle QuotaExceededError gracefully.
4. **Old saves break with schema changes** — new required fields on BuildingDefinition caused old saves to throw in the tick loop. Save format needs backwards compatibility.
5. **UI formulas must match engine formulas** — food consumption UI was 50x wrong. Always derive UI display values from the same constants the engine uses.
6. **Mock/placeholder data leaks** — MOCK_RESEARCH_STATE had completed techs, causing unresearched buildings to appear available.

## For Colony Governor

### Building Mechanics (confirmed design)
- Energy is FLOW, not stockpile. Surplus wasted unless stored.
- Waste is planetary, accumulates, has surface-area-based capacity.
- Building condition decays slowly without maintenance (10-30 days per 1% loss).
- Buildings non-functional at 70% condition, unrepairable below 30%.
- Population centres add 1.5M capacity per level (compound stacking).
- Research labs limit simultaneous projects (1 lab = 1 active project).
- Colonisation costs 10K credits + 3K minerals, transfers 100K colonists with 1-10% mortality.
- Buildings need demolish functionality (X icon + confirmation).
- Building picker: main tabs show buildable only, "Blueprints" tab shows future buildings with tech requirements.
- Planet view needs energy/waste/morale indicators.

### Population
- Home planet population MUST decrease when colonising (100K transferred out).
- Population growth should only occur when there's food surplus.
- Multiple species on one planet = combined stats but potential unrest.

## For Fleet Admiral
- Fleet rendering: 1 icon per fleet in BOTH galaxy map AND system view.
- Fleet relocation: confirmation dialog with travel time estimate.
- Ships start as 1 deep space probe, not 4 warships.

## For Research Director
- Research lab has NO tech requirement (was incorrectly requiring subspace_scanning).
- Research output 50 points/tick per lab (was 5 — too slow).
- 1 lab = 1 active research project. Multiple labs = parallel projects.
- Tech detail panel should show "Allows: {building/ship/tech}" section.

## For Trade Minister
- Energy doesn't accumulate. empire.energy = stored energy only.
- Power plant output: L1 = 20, Fusion = 35.
- Power plant lifecycle: L1 lasts 5 years (1,825 ticks), recommission choices at end of life.
- Energy storage: exponential (50/150/500/1500/5000 by level).

## For Balance Designer
- Economic victory was triggering at 50 ticks — raised to 500. Still may need further tuning.
- Build times now in days (30-365). Early game is deliberately slow — player uses max speed.
- Colonisation cost raised from 200 to 10K credits + 3K minerals.
- Factory build time ~90 days. Advanced buildings 180-365 days.

## For Engine Core
- tick() MUST have try/catch. NEVER let a throw silently kill the game loop.
- Save/load must handle backwards compatibility (new fields default to empty/zero).
- "Resume" on main menu should open load screen, not silently load auto-save.
- Auto-save must handle localStorage quota gracefully (delete oldest before saving new).
- Victory screen had ZERO CSS — always check new screens have styling.

## For UI/UX Designer
- Race picker is the FIRST screen (not species creator).
- Race detail: scroll to top when switching species.
- Research screen: categories as columns, ages as rows.
- TopBar numbers: compact format (1K, 1M, 1B).
- Colonisation dots: very small (0.6px) and slow — "trickle of sand" feel.
- Government type: dropdown select, not card grid.
- All pop-ups/modals auto-pause the game.

## For Species Architect
- 15 species now exist. All need to be visible in race picker.
- Species descriptions truncated to 200 chars in picker cards, full codex in detail view.
- ORIGIN_MAP must have entries for ALL species.
- New species require updates in 6+ files (JSON, barrel export, types, buildings, client components).

## For Lore Keeper
- Loading tips working well. "Trickle of sand" colonisation animation approved.
- Government descriptions fixed (--color-text-secondary was undefined).
- Building descriptions need both flavour AND mechanical info.

## For QA
- Always start a NEW game when testing (old saves contaminated with stale schema).
- Clear localStorage to rule out save data issues.
- Check browser console for errors — a silent throw in tick() looks like "everything is broken."
- Verify the dev server (Vite) is running from the right directory.
- Test on the correct IP (CT 108 = dev, NOT AIOrca).
