# Species Architect

Owns species and governments — species traits, abilities, portraits, government types, government modifiers, species creator screen, game setup screen, AI personality.

## When to Call
Species balance, new species, trait changes, government modifier tweaks, species creator UI, game setup screen, AI personality, starting conditions.

## Domain Files
- `packages/shared/src/types/species.ts`
- `packages/shared/src/types/government.ts`
- `packages/shared/data/species/*.json`
- `packages/client/src/ui/screens/SpeciesCreatorScreen.tsx`
- `packages/client/src/ui/screens/GameSetupScreen.tsx`
- `packages/client/src/game/rendering/PortraitRenderer.ts`

## Lessons Learnt
- 14 government types, each with 8 modifier dimensions
- 15 pre-built species with unique traits and 2 racial buildings each
- 7 traits (construction, reproduction, research, espionage, economy, combat, diplomacy) — trait budgets range 36-41 across species (not a strict 42-point budget; species with fewer special abilities tend to have higher trait totals as compensation)
- Government selection now ONLY in GameSetup (removed from SpeciesCreator)
- Species Creator handles: traits, abilities, portrait, environment prefs, origin story
- Origin stories map to trait presets and portrait base shapes
- Default government changed from representative_democracy to democracy
- Species descriptions rewritten (March 2026) to 3-4 paragraph codex format covering origin/evolution, reason for space, temperament/values, and internal conflict
- Each species has a UNIQUE motivation for expansion: Vaelori (dread/psychic warning), Khazari (destiny/forge-culture), Sylvani (ecological concern/the Withering), Nexari (offering the Gift/evangelism), Drakmari (survival/dying ocean), Teranos (every reason simultaneously), Zorvathi (instinct/biological imperative), Ashkari (diaspora/survival after stellar catastrophe), Luminari (curiosity about physical universe), Vethara (need for hosts/survival), Kaelenth (searching for creators/existential purpose), Thyriaq (expansion is reproduction/filling empty space), Aethyn (dimensional exploration/new frontier), Orivani (proving worthiness for the Coming), Pyrenth (search for the Perfect Forge)
- Internal conflicts make species feel alive: Vaelori (Resonants vs Attenuants), Khazari (Forge-Lords vs War-Speakers), Sylvani (Old Growth vs New Growth), Nexari (the Silence/Rememberers), Drakmari (Traditionalists vs Current-Riders vs Depth-Callers), Teranos (all factions simultaneously), Zorvathi (chemical unease from Outer Workers), Ashkari (Wanderers vs Settlers), Luminari (Observers vs Interventionists), Vethara (Covenant vs Unbound), Kaelenth (Seekers vs Foundry Orthodoxy), Thyriaq (absorption vs boundaries/thickness), Aethyn (Pioneers vs Conservators), Orivani (true faith vs heretical resistance), Pyrenth (Deep Masons vs Surface Shapers)
- Story Bible foreshadowing woven into species lore: Vaelori sense the Devourer through the Lattice Harmonic, Sylvani detect the Withering (possibly Devourer-related ecological decay)
- Trait distributions should reflect lore: generalist species (Teranos) get middling-to-good across the board; specialist species get extreme highs and lows
- Special abilities: psychic, aquatic, silicon_based, hive_mind, cybernetic, nomadic, subterranean, photosynthetic, energy_form, symbiotic, synthetic, nanomorphic, dimensional, devout
- Species with two special abilities (Nexari, Zorvathi, Pyrenth) tend to have slightly lower trait budgets as a balancing mechanism
- Orivani lore directly foreshadows the Devourer — their Prophecy of the Coming describes the Devourer's arrival, creating the game's most dramatic narrative irony
- Good species writing follows the "seen from outside" perspective — describe the species as a xenobiologist would, not as a marketing blurb
