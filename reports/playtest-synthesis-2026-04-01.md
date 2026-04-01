# Ex Nihilo — Playtest Synthesis Report

**Date:** 2026-04-01
**Build:** `c89b13f` (main)
**Rounds:** 10 parallel agent playtests covering all galaxy sizes, player counts, play styles, and edge cases

---

## Critical Bugs (P0 — Game-Breaking)

### 1. AI Ship Build Time 6-7x Slower Than Player
- **Files:** `GameEngine.ts:734` vs `game-loop.ts:3586`
- **Issue:** Player uses `Math.round(hull.baseCost / 100)`, AI uses `Math.ceil(shipCost / 15)`. For a destroyer (1,000cr): player = 10 ticks, AI = 67 ticks. The AI can never build ships fast enough to defend itself.
- **Impact:** AI is trivially defeated by any rush strategy.
- **Found in:** R3, R8

### 2. 10 of 14 Special Abilities Have Zero Gameplay Effect
- **Files:** Engine-wide (no implementation found for psychic, aquatic, silicon_based, cybernetic, nomadic, subterranean, photosynthetic, symbiotic, nanomorphic, devout)
- **Issue:** `AbilityPicker.tsx` describes rich bonuses ("Aquatic: Colonise ocean worlds without penalty", "Psychic: Enhanced espionage/diplomacy/research") that do not exist in the engine. Only hive_mind has partial effects.
- **Impact:** Players choose abilities expecting mechanics that are lies. Species with 2 abilities (Nexari, Zorvathi, Pyrenth) are strictly weaker since their lower trait totals aren't compensated.
- **Found in:** R10

### 3. Racial Building Restrictions Not Enforced
- **Files:** `game-loop.ts:756` and `game-loop.ts:3346` — species passed as `undefined` to `canBuildOnPlanet()`
- **Issue:** Any empire can build any species' unique buildings (Khazari War Forges, Vaelori Crystal Resonance Chambers, etc.). The `racialSpeciesId` check in `colony.ts:1253` is bypassed because species is always undefined.
- **Impact:** Species uniqueness is completely undermined.
- **Found in:** R10

### 4. Galaxy Size Mismatch — UI Says 120, Engine Creates 1000
- **Files:** `GameSetupScreen.tsx:34` (local constant: 120) vs `constants/game.ts:10` (shared constant: 1000)
- **Issue:** "Huge" galaxy tells the player 120 systems but generates 1000. The setup screen uses its own local constant instead of importing from shared.
- **Impact:** Game will freeze/crash on Huge maps due to O(n^3) wormhole algorithm (see #5).
- **Found in:** R7

### 5. O(n^3) Wormhole Generation Algorithm
- **File:** `galaxy-generator.ts:836-871`
- **Issue:** Relative Neighbourhood Graph uses triple-nested loop. At n=1000: 500 million iterations. Will freeze browser for tens of seconds or crash the tab.
- **Impact:** Huge galaxies are unplayable.
- **Found in:** R5, R7

### 6. Auto-Resolve Combat Ignores Most Weapon Stats
- **File:** `combat.ts:149-192`
- **Issue:** `deriveDesignStats` only reads damage, shieldStrength, armorRating, repairRate, fighterCount. Ignores accuracy, range, armourPenetration, shieldPenetration, piercingBonus, systemDamageBonus, crewDamage. A 65% accuracy missile = 92% accuracy radiation ray in auto-resolve.
- **Impact:** Auto-resolve produces fundamentally different outcomes from tactical combat. All weapon specialisation stats are wasted.
- **Found in:** R6

### 7. Home System Selection Can Crash With Many Players
- **File:** `game-init.ts:261-264`
- **Issue:** With 8 players in 20 systems, `selectHomeSystem()` may fail to find habitable planets (score >= 60) for all empires. Throws an unrecoverable `Error` that crashes game creation.
- **Impact:** Player sees a stack trace instead of a graceful error.
- **Found in:** R2

---

## High Severity Bugs (P1)

### 8. No Empire Elimination Mechanic
- **Impact:** Empires that lose all colonies remain in the empires array forever. AI decisions continue running for dead empires. Diplomatic victory requires alliances with dead empires (impossible). Victory scoring is distorted.
- **Found in:** R2, R4

### 9. Conquest Victory by Colonisation Ratio Exploit
- **File:** `victory.ts:210-226`
- **Issue:** Conquest counts colonised planet ratio, not military dominance. In a 2-player game, colonising 2 planets while the AI has 1 = 75% = instant "conquest" victory without combat.
- **Found in:** R8

### 10. Ground Combat Engine Entirely Bypassed
- **File:** `game-loop.ts:1697-1721`
- **Issue:** Winning a space battle auto-transfers all enemy planets (50% population loss, queue cleared). The ground combat engine (500+ lines, 19 unit types) is dead code for the most common capture path. Planetary defence buildings are meaningless.
- **Found in:** R8

### 11. Minimap Ignores Fog of War
- **File:** `Minimap.tsx:75-93`
- **Issue:** Renders ALL systems regardless of `knownSystems`. A player with 5 known systems sees all 80 on the minimap including star types and wormhole connections.
- **Found in:** R5

### 12. Diplomatic Systems Have No Player UI
- **Issue:** Three fully implemented engine systems are completely invisible to the player:
  - **Diplomat characters** (diplomat.ts) — named diplomats with skills, experience, meeting summaries, compromised status. Zero UI.
  - **Galactic Council/Organisations** (galactic-council.ts) — founding, resolutions, voting, auto-joining. Zero UI.
  - **Grievance system** (grievance.ts) — tiered decay, casus belli thresholds, government modifiers. Zero UI.
- **Found in:** R4

### 13. Settings Button Dead on Main Menu
- **File:** `MainMenuScene.ts:311-316`
- **Issue:** "Settings" emits `ui:settings` but no settings screen exists outside the PauseMenu. Clicking does nothing.
- **Found in:** R1

### 14. AI Species Selection Is Deterministic
- **File:** `GalaxyMapScene.ts:326-337`
- **Issue:** AI species are taken from `PREBUILT_SPECIES` in array order after filtering out the player's choice. Never shuffled. Every game with the same player species has the same AI opponents.
- **Found in:** R10

### 15. Communication Level Never Upgrades After First Contact
- **Issue:** Types define 4 levels (none, basic, trade, scientific). First contact can set initial level, but no upgrade function exists anywhere. A bad first contact permanently locks you at low communication.
- **Found in:** R4

---

## Medium Severity Issues (P2)

### 16. Corruption System Is Entirely Decorative
- **File:** `corruption.ts`
- **Issue:** Tracks corruption level and emits events (scandals, governor skimming) but never reduces credits or production. An oligarchy at 55% corruption suffers zero economic penalty.
- **Found in:** R9

### 17. Zombie Colonies (Population 0, Still Owned)
- **File:** `game-loop.ts:2345-2349`
- **Issue:** Starvation can reduce population to 0 without clearing `ownerId`. Planet becomes inert but still "owned", blocking recolonisation and distorting victory scores.
- **Found in:** R10

### 18. Save Validator Rejects Negative Credits
- **File:** `save-load.ts:318`
- **Issue:** Validator flags `credits < 0` as error, but the engine legitimately allows bankruptcy. Could prevent saving during financial crisis.
- **Found in:** R10

### 19. Patrol Stance Identical to Aggressive in Combat
- **File:** `combat.ts:427-430`
- **Issue:** `getStanceModifiers` returns identical values for both stances. Patrol should have distinct behaviour.
- **Found in:** R6

### 20. Experience Cap at Elite — Ace/Legendary Unreachable
- **File:** `combat-tactical.ts:2362-2363`
- **Issue:** `calculateExperienceGain` caps at `ELITE_IDX` (level 7/9). The 9-level experience system with insignia for ace and legendary exists but is unreachable through gameplay.
- **Found in:** R6

### 21. War Declaration Without First Contact
- **File:** `diplomacy.ts:416-451`
- **Issue:** `declareWar()` has no check for `firstContact === -1`. Players can declare war on empires they haven't discovered.
- **Found in:** R8

### 22. Auto-Equip Never Considers Armour Plating
- **File:** `ship-design.ts:437`
- **Issue:** `autoEquipDesign` always sets `armourPlating: 0`. All auto-designed ships are glass cannons.
- **Found in:** R6

### 23. Attitude Decay Outpaces Treaty Bonuses
- **File:** `diplomacy.ts:79-83`
- **Issue:** At attitude +60 (alliance threshold), decay = 1.2/tick. Max treaty bonus = 0.9/tick. Net -0.3/tick. Maintaining alliances requires constant gifts. Diplomatic victory with 5+ empires is near-impossible.
- **Found in:** R4

### 24. Species Balance: Ashkari (41pts) vs Most Species (36pts)
- **Issue:** 14% more trait points. Custom species at 42-point budget are always superior to all prebuilt species.
- **Found in:** R10

### 25. Fleet Arrival Reveals Only One System (Inconsistent)
- **File:** `game-loop.ts:949-954` vs `game-init.ts:305`
- **Issue:** Game-init reveals home + 1-hop neighbours, but fleet movement only reveals the arrived system. Exploration is painfully incremental.
- **Found in:** R5

---

## Missing Features (Ranked by Impact)

### Tier 1 — Severely Impacts Playability

1. **No tutorial or onboarding system** — Zero tutorial infrastructure. No advisor, no objectives, no guided first turn. First-time players are completely lost. (R1)
2. **No colony automation** — No auto-build, governor AI, or queue management. With 20+ colonies, late game is pure tedium. (R3, R7, R9)
3. **No colony list view** — Must click each system, then each planet individually. No empire-wide overview. (R7)
4. **No auto-explore** — No explore stance, no "next unexplored system" button. Player must manually click 80+ destinations. (R5)
5. **No system search/filter on galaxy map** — Cannot find systems by name, type, or status. (R5)

### Tier 2 — Meaningfully Degrades Experience

6. **No fleet indicators on 3D galaxy map** — Cannot see where fleets are. (R5)
7. **No EstablishTradeRoute player action** — Trade routes not exposed in the action system. (R3)
8. **No occupation dialog UI** — Occupation policies exist in engine but have no UI. (R6)
9. **No AI-to-AI relationship visibility** — Relations graph only shows player edges. Critical for diplomatic strategy. (R4)
10. **No treaty acceptance/rejection feedback** — AI's reason for accepting/rejecting never shown to player. (R4)
11. **No player count/galaxy size validation** — 8 players in 20 systems can crash the game. (R2)
12. **Game starts unpaused** — Ticks advance while new player is still learning the UI. (R1)

### Tier 3 — Quality of Life

13. **No recommended beginner species** — 15 species with no guidance. (R1)
14. **No rally points for new ships** (R7)
15. **No "select all idle fleets" command** (R7)
16. **No save compression** — Huge galaxy saves could be 5-15 MB, exceeding localStorage limits. (R7)
17. **No coalition AI behaviour** — Weak AIs don't band together against a snowballing leader. (R2)
18. **No ship salvage/repair after combat** (R6)
19. **No orbital bombardment before ground invasion** (R6)
20. **No lore codex** — Precursor lore fragments discoverable but no place to review them. (R5)

---

## Terminology and UI Issues

1. **"Ticks" vs "Turns"** — Code uses "tick", TopBar shows "Turn", victory conditions say "ticks". Should all say "turns". (R1, R3)
2. **Inconsistent currency abbreviations** — "CR", "C", and currency symbol used interchangeably. (R1)
3. **"Defence" vs "Defense"** — British English in labels, American in code keys. (R1)
4. **Duplicate treaty types** — Both `trade`/`trade_agreement` and `mutual_defense`/`mutual_defence` exist. (R1)
5. **Cryptic trait abbreviations** — "CON/REP/RES/ESP/ECO/COM/DIP" on species cards with no explanation. (R1)
6. **Keyboard shortcuts undocumented** — Extensive shortcuts (R, S, D, F, E, Ctrl+S, Ctrl+L) but no in-game reference. (R1)
7. **Fleet stance labels cryptic** — "AGR/DEF/EVA/PAT" not explained. (R1)
8. **Victory condition says "10x"** — Header comment in victory.ts says "10x" but constant is 3x. (R9)
9. **Tooltip system underused** — Custom `Tooltip.tsx` exists but almost nothing uses `data-tooltip`. (R1)

---

## Balance Concerns

1. **AI is trivially weak** — 6-7x slower ship production, no multi-fleet coordination, only sends 1 fleet to attack even in total war. (R2, R8)
2. **Coloniser cost prohibitive** — 20,000 credits vs 1,000 starting. 200-tick build time. Ratio of 20:1 vs combat ships. (R3, R8)
3. **Slow FTL is punishing** — 20 ticks/hop pre-wormhole tech. Early exploration is glacial. (R3)
4. **Energy knife-edge at start** — Starting surplus is only ~2 energy/tick. Any new building causes deficit. (R3)
5. **Aggressive AI snowballs** — War threshold of 15 + border exposure easily exceeded in crowded galaxies. (R2)
6. **Diplomatic victory near-impossible** — Attitude decay, aggressive AI thresholds, eliminated empires blocking, no mediation. (R2, R4)
7. **Research victory extremely long** — 56-tech chain, 466,500 RP. Achievable but grindy. (R9)
8. **Economic victory potentially too easy** — 3x credits for 100 ticks with trade hub spam. (R3, R9)
9. **Species with abilities are strictly weaker** — Abilities don't work but trait points are reduced. (R10)
10. **Peaceful players are sitting ducks** — AI sees zero military and gets +25 war score. No hire-mercenary alternative. (R9)

---

## What Works Well

1. **Tactical combat engine** — Genuinely deep with weapon arcs, projectile physics, missile tracking, fighters, point defence, formations, admiral abilities, crew experience. (R6)
2. **Narrative chains** — Beautifully written multi-step stories with species-specific branches and competitive racing. (R5)
3. **Anomaly system** — 10 types, multi-stage excavation, danger mechanics, precursor lore. (R5)
4. **Minor species** — 7 biology types, interaction choices, integration/uplift/exploit with revolt risk. (R5)
5. **War response psychology** — 15 species-specific profiles, war weariness, peace weariness, government interaction. (R6)
6. **AI war strategy** — Sophisticated multi-factor scoring (military, economic, strategic, psychological, political). (R6)
7. **Marketplace** — 35 commodities, supply/demand pricing, sanctions, market manipulation. (R9)
8. **Ground combat** — 19 unit types, terrain bonuses, war crimes tracking (though bypassed by auto-capture). (R6)
9. **Galaxy generation** — 4 shapes (spiral/elliptical/ring/irregular), Poisson-disk sampling, guaranteed connectivity. (R5)
10. **3D rendering** — Procedural planet shaders, instanced star meshes, volumetric glow, bloom post-processing. (R5)
