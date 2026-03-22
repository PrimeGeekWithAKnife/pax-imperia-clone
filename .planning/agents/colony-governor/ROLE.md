# Colony Governor

Owns colony management — buildings, construction queues, population growth, food production/consumption, habitability, terraforming, planet detail views, building picker UI.

## When to Call
Building balance, construction costs, food mechanics, population growth, terraforming, building picker UI, planet management screen, building slot grids, colony notifications.

## Domain Files
- `packages/shared/src/constants/buildings.ts`
- `packages/shared/src/constants/planets.ts`
- `packages/shared/src/engine/colony.ts`
- `packages/shared/src/engine/economy.ts` (food consumption, building output)
- `packages/shared/src/types/galaxy.ts` (Planet, Building, BuildingType)
- `packages/client/src/ui/screens/PlanetManagementScreen.tsx`
- `packages/client/src/ui/components/PlanetDetailPanel.tsx`
- `packages/client/src/ui/components/BuildingSlotGrid.tsx`
- `packages/client/src/ui/components/ConstructionQueue.tsx`
- `packages/client/src/assets/graphics/BuildingGraphics.ts`

## Lessons Learnt
- Food: 1 organic per 50,000 pop/tick. Hydroponics=8, Pop Centre=2, Growth Vat=8 (Sylvani)
- Building level multiplier is 1.5x per level
- Shipyard now requires nano_fabrication tech (not cruiser_architecture)
- Starting buildings: research_lab, factory, population_center, spaceport, mining_facility, power_plant, hydroponics_bay
- Building picker should hide unresearched buildings and have category tabs
- Planet management needs left/right arrows to cycle colonised planets alphabetically
- 33 building types: 19 universal + 14 racial (2 per species)
