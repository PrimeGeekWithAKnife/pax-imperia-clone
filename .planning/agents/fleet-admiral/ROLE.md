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
- Fleet badges on galaxy map are keyed by fleetId (not systemId) — one icon per fleet, offset vertically when multiple fleets share a system
- ShipDesigns live on GameTickState.shipDesigns (Map<string, ShipDesign>), not on GameState directly
- Fleet move mode uses event chain: FleetPanel emits `fleet:move_mode` → GalaxyMapScene stores moveModeFleetId → on system click emits `fleet:destination_selected` → FleetPanel shows confirmation dialog → on confirm calls engine.moveFleet() then emits `fleet:move_mode_clear`
- "Relocate Fleet" from system view stashes fleet ID on window.__EX_NIHILO_PENDING_MOVE_MODE__ before scene transition, then GalaxyMapScene picks it up in create()
- Travel time estimation: hops from findPath * ticksPerHop from determineTravelMode (slow_ftl=20, wormhole=10, advanced_wormhole=5)
- renderShipThumbnail() returns a PNG data URL; for Phaser usage, load via Image() then addImage() to texture manager
- Event cleanup in Phaser scenes: use named arrow-function class properties (not anonymous lambdas) so .off() can remove them
