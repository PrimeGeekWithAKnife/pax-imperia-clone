# Population & Demographics UI Research — 4X Space Strategy Games

**Date:** 30 March 2026
**Purpose:** Inform Ex Nihilo's demographics dashboard and population management UI design

---

## Key Takeaways for Ex Nihilo

### The 5 Golden Rules (from 8 games analysed)

1. **Alpha Centauri's traffic lights** — Green/amber/red colour dots communicate population health at maximum speed. Use this everywhere: outliner, planet cards, system view.

2. **MOO2's N-2 depth** — Any information should be at most 2 clicks from the main view. One screen for colony management, no sub-tabs if possible.

3. **Victoria 3's interest group aggregation** — Don't show individual pop opinions. Aggregate into 3-5 political factions with visible clout bars. Players manage factions, not individuals.

4. **GalCiv IV's two-tier system** — Core worlds get full management, frontier colonies get simplified view. Directly solves the 20-planet problem.

5. **Notification-driven, not polling-driven** — Push alerts ("New Damascus unemployment rising") instead of requiring players to check 50 planets manually.

### What Players Hate Most

1. Clicking through 50 planets to find the one with a problem
2. Broken automation that wastes resources
3. Information hidden behind mouseover-only tooltips
4. Pie charts for more than 3 categories
5. No batch operations across multiple planets
6. Abstract numbers without context (always show capacity, trend, comparison)

### Recommended Information Architecture

**Galaxy Map:** Tiny colour dot per system (green/amber/red overall health)

**Outliner (always visible):** Per planet: name, population + trend arrow, health dot, housing bar, employment bar, alert badges. SORTABLE by any column.

**Planet View (one click):** Colony image + building grid left, demographics summary right. Population sparkline, species stacked bar, workforce rows with +/- controls, happiness score, housing/amenities bars. ALL ON ONE SCREEN.

**Demographics Deep Dive (optional second click):** Full-screen: historical graphs, species detail cards, migration flows, political faction bars, needs breakdown, empire-average comparison.

**Empire Demographics (empire-level):** Planet comparison table (sortable, filterable). Total population by species over time. Political faction overview. Standard of living distribution.

### Visual Representation Hierarchy

1. Colour-coded status dots (Alpha Centauri) — at-a-glance health
2. Small stacked bar charts — species/workforce composition (avoid pie charts)
3. Numbers with trend arrows — state + direction
4. Sparkline mini-graphs — historical trends inline
5. Detailed bar charts — drill-down panel only
6. Numerical tables — deepest drill-down only

---

## Per-Game Analysis

### Stellaris
- Pop strata: rulers/specialists/workers. Grouped job lists on planet tab.
- Outliner shows: pop count, housing, free jobs, stability.
- Biggest complaint: late-game "micro-hell" with 50+ planets. Bad tools, not too much micro.
- 4.0 innovation: workforce abstraction (pops generate workforce points, not 1:1 job filling).

### Victoria 3
- Pops not individually rendered. Aggregated into interest groups with clout bars.
- Standard of Living as key metric. Wealth tracked per pop.
- Map mode lenses colour states by demographics. Living Map shows wealth through building models.
- Praise: emergent political revolutions from wealth inequality. Criticism: too abstract, players feel like spectators.
- Innovation: interest groups as population aggregation. Needs-based consumption chains.

### Endless Space 2
- Species icon pips around planets. Each pop = one pip with species portrait.
- Approval bar 0-100% per system. FIDSI numbers with clear icons.
- Senate composition visualised as colour-coded seats.
- Drag-and-drop species management. Luxury demands per species.
- Innovation: population as political agents (each pop influences senate). Species diversity = strategic choice.

### Galactic Civilizations IV
- Portrait icons (48px) per citizen. Five stat bars. Ideology badges.
- Core World citizens (detailed) vs Colony population (abstract).
- Citizen transfer between core worlds. Role specialisation.
- Innovation: two-tier Core/Colony system limits management units.

### Distant Worlds 2
- Population numbers per colony. Species breakdown with policy icons.
- Private vs public economy. Suitability ratings per species.
- Complaint: "demographic policy is terrible." Can't see own empire's full breakdown.
- Innovation: private economy as autonomous population simulation.

### Shadow Empire
- Zone-based display. Worker salary, employment policy, happiness.
- Public vs private workforce split. Administrative strain percentage.
- Praise: unmatched economic depth. Criticism: opaque UI, mouseover-heavy.
- Innovation: public/private economy divide with labour market.

### Alpha Centauri
- Citizen icons in a row: yellow=worker, green=talent, red=drone.
- Psych tab shows conversion chain. Specialist cycling via click.
- Universally praised as best population UI ever. Instant readability.
- Innovation: traffic-light citizens — 3 colours, zero learning curve.

### Master of Orion 2
- Three worker rows: farmers, workers, scientists as figure icons.
- Drag-and-drop allocation. Protesters shown as distinct icons.
- Single-screen philosophy. Colony list with outputs at a glance.
- Universally praised: "all there is fits in one screen."
- Innovation: N-2 menu depth (never more than 2 clicks from any info).
