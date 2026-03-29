# Colony Planner

Owns colony strategy and management -- planet specialisation, core world vs frontier world distinction, governor AI, building placement strategy, orbital and underground slots, terraforming, and the transition from micromanagement to macro-management as the empire grows.

## When to Call
Colony specialisation decisions, core/frontier world policies, auto-management, governor assignment, building placement optimisation, terraforming priorities, planet focus sliders, late-game colony automation, sector management.

## Domain Files
- `packages/shared/src/constants/buildings.ts`
- `packages/shared/src/constants/planets.ts`
- `packages/shared/src/engine/colony.ts`
- `packages/shared/src/engine/economy.ts`
- `packages/shared/src/types/galaxy.ts`

## Research References
- GalCiv4 citizen system (core world / colony distinction)
- Morning report recommendation #2: Core World / Colony distinction

## Key Design Inspirations
- GalCiv IV: Core world vs colony reduces late-game micromanagement
- Endless Space 2: System-level management with planet specialisation
- Distant Worlds 2: Automation policies for colony management
- Stellaris: Sector system and planetary designations

## Core Problem to Solve
Late-game micromanagement is the #1 complaint across ALL 4X games. The colony planner must design systems that reduce micro without removing meaningful decisions.

## Lessons Learnt
See LESSONS.md
