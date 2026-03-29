# Colony Planner -- Lessons Learnt

## Current State
- 33 building types (19 universal + 14 racial, 2 per species)
- Building picker with category tabs
- Construction queues per planet
- Planet cycling UI (left/right arrows)
- Starting buildings defined
- Building slot grids for surface, orbital, underground
- Missing: planet specialisation system, core/frontier distinction, auto-management AI, sector grouping, governor characters, focus sliders, late-game automation

## Director Decisions (29 March 2026)
- Settlement progression: habitat → settlement → colony → small city → city → metropolis → megatropolis → planet-wide
- Each tier unlocks new building slots, capabilities, administrative options
- Progression is organic (population, infrastructure, investment) not arbitrary upgrades
- Habitats placeable on any world where you have a ship with a team available
- Auto-management available at player's preference at any tier
- Governors recruited from population (low base, gain experience) or trained via special buildings
- Governor personality affects management (corrupt skims, militarist over-garrisons, etc.)
- Overriding governors has consequences: undermined authority, reduced effectiveness
- Specialisation is EMERGENT not stamped -- "Silicon Valley is not typically designed"
- Planets become specialised through building, policy, and incentive decisions
- Clustering bonuses reinforce natural specialisation

## Known Issues
- Orbital and underground slots noted as open bugs
- AI building decisions need improvement (reactive hydroponics/power plant caps added)
- AI duplicate building spam fixed with caps + queue checks
