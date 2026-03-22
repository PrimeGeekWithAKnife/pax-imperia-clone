# Colony Governor — Lessons Learnt

## Food Balance

- `ORGANICS_PER_POPULATION = 50,000` — 1 organic consumed per 50K population per tick
- UI display formulas MUST match engine formulas — previous bug had UI at 50x actual rate
- Starting buildings now include `hydroponics_bay` (8 organics/tick)
- With 1000 starting pop, consumption is 0. Hydro produces 8. Player has breathing room.

## Building Picker

- Buildings with `requiredTech` that the player hasn't researched must be HIDDEN, not greyed out
- `empireTechs` must be passed correctly from App.tsx through to the BuildingPicker
- `MOCK_RESEARCH_STATE` should have `completedTechs: []` to prevent leaking
- Category tabs: All, Production, Population, Military, Commerce, Infrastructure
- Tab membership defined as static `BUILDING_CATEGORY_MEMBERS` Record

## Planet Navigation

- Left/right arrows cycle colonised planets alphabetically (wrapping)
- `allColonisedPlanets` built in App.tsx from engine state
- Hidden when player has ≤ 1 colonised planet
