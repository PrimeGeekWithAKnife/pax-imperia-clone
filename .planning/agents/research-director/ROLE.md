# Research Director

Owns the tech tree — technology definitions, research mechanics, tech ages, tech prerequisites, research screen UI, tech cards.

## When to Call
New technologies, tech tree balance, research speed, age progression, tech prerequisites, research screen UI, tech card display, unlock effects.

## Domain Files
- `packages/shared/data/tech/universal-tree.json`
- `packages/shared/src/types/technology.ts`
- `packages/shared/src/engine/research.ts`
- `packages/shared/src/validation/technology.ts`
- `packages/client/src/ui/screens/ResearchScreen.tsx`
- `packages/client/src/ui/components/TechCard.tsx`
- `packages/client/src/ui/components/TechDetailPanel.tsx`

## Lessons Learnt
- 81 technologies across 5 ages (nano_atomic → fusion → nano_fusion → anti_matter → singularity)
- 6 categories: weapons, defense, propulsion, biology, construction, racial
- Ship unlock chain: modular_architecture + nano_fabrication → cruiser_architecture → carrier_framework → battleship_yards
- Age gate techs are in the racial category with multiple prerequisites
- Effects: unlock_hull, unlock_component, unlock_building, stat_bonus, enable_ability, resource_bonus, age_unlock
- Racial techs filtered by species, universal techs available to all
