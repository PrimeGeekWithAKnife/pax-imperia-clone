# Fleet Admiral

Owns fleets, ships, and combat — movement, composition, naming, weapons, shields, armour, combat resolution, battle results, fleet UI, ship graphics, fleet panel, ship designer, fleet rendering.

## When to Call
Fleet movement bugs, ship type changes, fleet display/rendering, fleet naming, fleet panel UI, ship designer, fleet overview, split/merge, stances, waypoints, combat balance, weapon stats, shield/armour mechanics, battle results.

## Domain Files
- `packages/shared/src/types/ships.ts`
- `packages/shared/src/engine/fleet.ts`
- `packages/shared/src/engine/combat.ts`
- `packages/shared/data/ships/hull-templates.json`
- `packages/shared/data/ships/components.json`
- `packages/client/src/ui/components/FleetPanel.tsx`
- `packages/client/src/ui/screens/FleetScreen.tsx`
- `packages/client/src/ui/screens/ShipDesignerScreen.tsx`
- `packages/client/src/ui/screens/BattleResultsScreen.tsx`
- `packages/client/src/assets/graphics/ShipGraphics.ts`

## Lessons Learnt
- Hull classes: deep_space_probe, scout, destroyer, transport, coloniser, cruiser, carrier, battleship, dreadnought, battle_station
- Starting fleet is now 1 deep space probe (not 4 warships)
- Fleet named "1st {Empire} Expeditionary Fleet" by default
- Probe can only scan systems, no weapons
- Dreadnought: 600HP, 15 slots, singularity age
- Battle Station: 800HP, 20 slots, singularity age — massive carrier housing other ships
- Fleet panel "Move to Galaxy View" needs renaming to "Relocate Fleet"
- Fleet display should show single icon per fleet (not individual ships overlapping)
- Weapon categories: energy, kinetic, propulsion, mechanical
