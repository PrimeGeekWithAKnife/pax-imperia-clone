# Nova Imperia - Game Design Specification

## 1. Core Identity

**Nova Imperia** is a modern, web-based real-time-with-pause 4X space strategy game. A reimagining of Pax Imperia: Eminent Domain (1997) that preserves its best qualities while fixing its documented flaws and adding significant new systems.

**Core philosophy:** Species origin stories determine unique branching tech trees. This is not cosmetic -- a race that reached space through bioengineering plays fundamentally differently from one that industrialized through metallurgy.

**Platform:** Web browser (TypeScript + Phaser 3 + React client, Node.js + Fastify + Socket.io server, PostgreSQL database)

**MVP Strategy:** Core loop first (galaxy, one species, colonization, basic research, space combat), then layer complexity incrementally.

---

## 2. Game Flow

- **Real-time with pause.** The galaxy runs continuously but the player can pause at any time to issue orders, review information, and plan strategy.
- **Speed controls:** 1x, 2x, 3x, 5x, and Pause.
- **No turns.** All actions execute in continuous real-time. Research completes, ships move, populations grow, battles rage -- all simultaneously.
- **Multiplayer:** Pause is available in single-player only. Multiplayer uses speed voting or host-controlled speed. Maximum 16 players (human + AI).

---

## 3. Galaxy & Star Systems

### Galaxy Generation
- Procedurally generated galaxies with configurable size: Small (~30 systems), Medium (~60), Large (~100), Epic (~200).
- Seed-based generation for reproducible maps and shareable game setups.
- Galaxy shapes: spiral, elliptical, cluster, irregular (configurable).
- Systems distributed with natural clustering to create dense cores and sparse frontier regions.

### Star Systems
- Each system has 1 star (type: blue giant, white, yellow, orange, red dwarf, red giant, neutron, binary) and 1-12 planets.
- Star type affects habitable zone, planet types, and resource distribution.
- Systems are the fundamental strategic unit -- you control, contest, or scout systems.

### Planets
- **Attributes:** type, atmosphere, gravity (0.1-3.0g), temperature (K), natural resources (0-100), max population, current population.
- **Planet types:** Terran, Ocean, Desert, Ice, Volcanic, Gas Giant, Barren, Toxic.
- **Atmosphere types:** Oxygen-Nitrogen, Carbon Dioxide, Methane, Ammonia, None, Toxic, Hydrogen-Helium.
- **Habitability:** Computed per-species based on environmental preferences. Displayed as a detailed data panel showing atmosphere compatibility, gravity tolerance, temperature range, and a numerical habitability score (0-100). No smiley faces.
- **Resource types:** Minerals, Rare Elements, Energy, Organics, Exotic Materials (5 types).
- **Infrastructure:** Research Labs, Factories, Shipyards, Trade Hubs, Defense Grids, Population Centers, Mining Facilities, Spaceports, Temples (religion), Government Buildings.
- **Specialization:** Planets can be specialized (research world, forge world, trade hub, military base, religious center) for efficiency bonuses.
- **One build queue per planet.** Construction subsidies can accelerate building with credits.

---

## 4. Tiered FTL System

Travel is the strategic skeleton of the game. Five tiers of FTL create an evolving strategic landscape:

| Tier | Type | Requirements | Speed | Strategic Role |
|------|------|-------------|-------|----------------|
| 1 | **Slow FTL Drives** | Starting tech | Very slow, improves with research | Baseline travel. Early game = limited range. Late game approaches wormhole speed. |
| 2 | **Stable Natural Wormholes** | None (free to use) | Fast, fixed | Early-game highways. Create natural chokepoints and frontiers. Always present on map. |
| 3 | **Unstable Natural Wormholes** | Mid-tier tech to stabilize/traverse | Fast but unreliable | High-reward shortcuts. Appear/disappear periodically. Stabilization tech makes them permanent. |
| 4 | **Artificial Wormholes** | Advanced tech + massive resources | Fast, permanent | Player-created strategic highways. Reshape the galaxy's topology. Expensive to build, can be destroyed. |
| 5 | **Singularity Drives** | Endgame tech | Instant within set radius | Game-changing. Fleets can jump anywhere within range without wormholes. Transforms warfare. |

**Design intent:** Early game, you're constrained by geography and natural wormholes. Mid game, you stabilize unstable wormholes and improve your drives. Late game, you're building your own wormhole network and eventually transcending wormholes entirely with singularity drives.

---

## 5. Species System

### Design Principle
All species are **entirely original** -- no plagiarism of the original Pax Imperia races. They can be vaguely inspired by similar archetypes (insectoid, cybernetic, etc.) but must have unique names, lore, and backstories. Critically, **how each species became spacefaring determines their technology tree**.

### Species Attributes
- **Physical:** Lifespan, reproduction rate, physical resilience, sensory capabilities.
- **Environmental Preference:** Ideal atmosphere, gravity range, temperature range. Determines which planets are naturally habitable.
- **Origin Story:** The narrative of how this species achieved spaceflight. This is the key gameplay differentiator -- it determines starting tech, unique tech branches, and playstyle.
- **Trait Points:** Distributed across: Construction, Reproduction, Research, Espionage, Economy, Combat, Diplomacy, Faith (new). Point-buy system with trade-offs.
- **Special Abilities:** 0-2 unique abilities tied to origin (e.g., psychic communication, hive coordination, bioengineered adaptation, cybernetic integration).
- **Government Type:** Starting government (see Section 8).
- **Religion:** Starting belief system or none (see Section 9).

### Species Origin Examples (Illustrative, Not Final)
- **Bioengineering origin:** Living ships, organic technology, strong biology/adaptation tech, weak in traditional weapons/armor.
- **Industrial/metallurgical origin:** Heavy metal ships, strong weapons/shields/construction, weak in biology/adaptation.
- **Psionic/spiritual origin:** Psychic abilities, unique psionic tech branch, strong espionage/diplomacy, moderate military.
- **Cybernetic origin:** Integration of biological and mechanical, strong in computation/automation, unique cybernetic upgrades.
- **Nomadic/scavenger origin:** Adaptive, strong reverse-engineering, can salvage and use other species' tech, weaker in original research.
- **Aquatic origin:** Unique ocean-world bonuses, bioengineered ships, strong in terraforming and adaptation.

### Custom Species Creator
- Players can create fully custom species by selecting: appearance, origin story template, trait point allocation, environmental preferences, government type, religion, and special abilities.
- Pre-built species serve as templates and examples.
- Point-buy system ensures balance (more powerful traits cost more points).

---

## 6. Technology System

### Design Principle
**Species-unique branching tech trees rooted in origin story.** A bioengineering race and an industrial race research fundamentally different technologies. High-tier convergence ensures no species is permanently locked out of critical capabilities, but the *path* to get there is different.

### Structure
- Each species origin defines a **unique tech tree** with:
  - **Core branches:** 3-4 primary research paths unique to that origin.
  - **Universal branches:** Shared tech available to all species (basic colonization, basic FTL, basic diplomacy tools).
  - **Convergence tier:** At high tech levels, all species can reach equivalent capabilities through different means (e.g., bioengineered armor vs. neutronium plate vs. psychic shielding -- different names, similar function).
  - **Crossover research:** Mid-to-late game, species can research outside their origin tree at significantly higher cost, or acquire foreign tech through trade, espionage, or conquest.

### Tech Categories (Universal)
- **Weapons:** Species-flavored but covering beam, projectile, missile, fighter, and exotic damage types.
- **Defense:** Shields, armor, point defense, countermeasures -- each species' version is thematically different.
- **Propulsion:** FTL drives (tiers 1-5), tactical drives, sublight engines.
- **Biology/Adaptation:** Population growth, habitability expansion, terraforming, genetic modification.
- **Construction:** Building speed, ship size limits, orbital structures, megastructures.
- **Special:** Species-unique branches (psionic, cybernetic, bioengineering, etc.).

### Simultaneous Research
Preserved from the original. Players can research multiple technologies at once, allocating research points across active projects. More allocation = faster completion.

### Technology Ages
Five ages of progression, each unlocking new capabilities:
1. **Dawn Age** -- Starting tech, basic colonization, slow FTL, scouts/destroyers.
2. **Expansion Age** -- Improved drives, stable wormhole traversal, cruisers, basic diplomacy tools.
3. **Ascendancy Age** -- Unstable wormhole stabilization, carriers, advanced weapons, ground combat tech.
4. **Dominion Age** -- Artificial wormhole construction, battleships, megastructures, advanced espionage.
5. **Transcendence Age** -- Singularity drives, superweapons, ascension technologies, endgame victory techs.

---

## 7. Diplomacy System

### Design Principle
**Full personality-driven diplomacy.** The original's biggest weakness becomes a major feature. Alien leaders are characters with portraits, unique personalities, relationship memory, and face-to-face negotiations.

### Alien Leaders
- Each empire has a leader with a **portrait** and **personality type** (aggressive, cautious, honorable, deceptive, fanatical, mercantile, scholarly, expansionist).
- Leaders **remember** past interactions: broken treaties, acts of war, gifts, trade history, insults, and aid.
- Personality affects: what deals they'll accept, how they react to threats, whether they honor agreements, and how they perceive your government/religion.
- **Face-to-face negotiation screen:** Dialogue-based interaction when initiating diplomacy. Leader's mood and expressions reflect the relationship state.

### Diplomatic Actions
- **Treaties:** Non-aggression pact, trade agreement, research sharing, mutual defense, full alliance, vassalage.
- **Trade:** Trade routes between empires generating income for both. Luxury resource trading. Technology trading/selling.
- **Demands:** Tribute demands, territorial claims, ultimatums.
- **Espionage:** Spy placement, intelligence gathering, sabotage, assassination, technology theft, counter-intelligence.
- **Religion:** Missionary sending, religious conversion pressure, holy war declarations (see Section 9).
- **Government interaction:** Government types affect diplomatic compatibility (democracies trust each other more, theocracies ally with shared religions, etc.).

### Relationship System
- **Attitude score:** -100 (hatred) to +100 (devotion). Affected by actions, treaties, proximity, government compatibility, religious alignment, trade, and species traits.
- **Trust score:** Separate from attitude. Built through honored agreements, broken by betrayals. High trust = access to better treaty types.
- **Threat assessment:** AI evaluates player's military, economic, and territorial power relative to their own. Affects diplomatic willingness.

---

## 8. Government Types

Each empire has a government type that affects internal policies, military capacity, research speed, economic output, population happiness, and diplomatic relationships.

### Government Types (Preliminary)
| Government | Strengths | Weaknesses | Diplomatic Notes |
|-----------|-----------|------------|-----------------|
| **Democracy** | Research bonus, high happiness, trade bonuses | Slower military mobilization, war weariness | Trusted by other democracies; distrusted by authoritarian regimes |
| **Autocracy** | Fast military decisions, strong espionage | Lower happiness, revolution risk | Pragmatic relations; other autocrats respect strength |
| **Theocracy** | Faith bonuses, unity, loyal population | Research penalties, intolerant of other religions | Strong bonds with shared-religion empires; hostile to heretics |
| **Oligarchy** | Economic bonuses, trade efficiency | Wealth inequality, corruption risk | Deals well with mercantile empires |
| **Hive Mind** | Perfect coordination, no happiness issues, production bonus | No diplomacy with individualist species, no espionage | Alien and incomprehensible to others; limited diplomatic options |
| **Military Junta** | Combat bonuses, ship production, fast mobilization | Low happiness, high unrest, poor diplomacy | Feared; aggressive posture by default |
| **Technocracy** | Research bonuses, efficient automation | Low faith, population feels alienated | Respected by researchers; dismissed by spiritual empires |
| **Federation** | Diplomatic bonuses, multi-species integration, trade | Slow decisions, internal politics | Natural alliance-builders; penalty to authoritarian actions |

### Government Mechanics
- Government type is chosen at species creation.
- Government can **change** through revolution, reform, or conquest.
- Government affects: tax efficiency, research speed, military upkeep, happiness baseline, diplomatic modifiers, faith generation, and espionage capability.
- Some victory conditions are easier/harder depending on government type.

---

## 9. Religion System

### Design Principle
Religion is a new game system not present in the original. It provides a unique victory path ("One True God"), affects diplomacy, population happiness, and inter-species relations.

### Mechanics
- **Faith resource:** Generated by temples, religious leaders, and certain species traits. Spent on missionaries, holy buildings, religious edicts.
- **Religions:** Each species can have a starting religion or be secular. Religions have tenets that provide gameplay bonuses (e.g., "Warrior Faith" = combat morale bonus, "Path of Knowledge" = research bonus, "Prosperity Gospel" = trade bonus).
- **Spreading religion:** Missionaries can be sent to other empires' planets. Religion spreads through trade routes, cultural proximity, and diplomatic influence.
- **Religious compatibility:** Shared religion improves diplomatic relations. Conflicting religions create tension. Theocracies are especially affected.
- **Holy wars:** Can be declared against empires of opposing religions. Provides morale bonuses to the aggressor's military.
- **Religious buildings:** Temples and cathedrals on planets generate faith and happiness. Higher-tier religious buildings unlock powerful faith abilities.
- **Secular empires:** Can ignore religion entirely but miss out on faith bonuses and the religious victory path.

---

## 10. Ship Design & Fleet Management

### Hull Classes
Unlocked through tech age progression:

| Class | Role | Unlock Age | Relative Power |
|-------|------|-----------|----------------|
| **Scout** | Reconnaissance, exploration | Dawn | Very light |
| **Destroyer** | Early combat, escort duty | Dawn | Light |
| **Transport** | Colony ships, troop transports (ground invasion) | Dawn | Non-combat |
| **Cruiser** | Mid-game workhorse | Expansion | Medium |
| **Carrier** | Fighter deployment, fleet support | Ascendancy | Medium-Heavy |
| **Battleship** | Heavy combat, planetary bombardment | Dominion | Heavy |
| **Dreadnought** | Endgame capital ship | Transcendence | Massive |

### Ship Design System
- **Slot-based component placement.** Each hull has slots with positions (fore, aft, port, starboard, turret) and sizes (small, medium, large).
- **Directional weapons:** Preserved from original. Where you mount weapons matters -- forward-facing weapons fire in attack runs, broadside weapons for flanking, turrets for all-around defense.
- **Component categories:** Weapons (beam, projectile, missile, point defense, fighters), Shields, Armor, Engines (tactical + warp), Sensors, Repair Systems, Special (species-specific modules).
- **Species-flavored components:** A bioengineering race's "shield" might be a regenerative membrane. An industrial race's is a neutronium plate. Same mechanical role, different names/visuals/minor stat variations.
- **Auto-equip available** for convenience, but manual design recommended for optimization.

### Fleet Management
- Fleets are groups of ships under a single command.
- **Fleet stances:** Aggressive, Defensive, Evasive, Patrol.
- **Waypoints and patrol routes.**
- **Fleet composition matters:** Mixed fleets (carriers + battleships + escorts) are stronger than monofleets.

---

## 11. Combat System

### Two-Layer Warfare
The original had no ground combat -- once orbital defenses fell, you instantly captured the planet. Nova Imperia adds a ground invasion phase.

### Space Combat
- **Real-time with pause** (single-player) or real-time (multiplayer) on a 2D tactical battle screen.
- **Formations:** Line, wedge, encirclement, screen. Formation choice affects effectiveness.
- **Directional weapons:** Ships orient to bring weapons to bear. Flanking matters.
- **System damage:** Ships suffer targeted damage to: engines (reduces speed), weapons (reduces firepower), shields (reduces defense), sensors (reduces accuracy), warp drive (prevents retreat). Not a single health bar.
- **Morale/routing:** Ships and fleets can break and retreat when taking heavy losses. Species traits and government type affect morale.
- **Orbital defenses:** Minefields, defense platforms, battle stations, planetary shields. Must be defeated before ground invasion.
- **Planetary bombardment:** Battleships and dreadnoughts can bombard from orbit, but this damages infrastructure and kills population. Effective but costly.
- **Auto-resolve option:** For minor engagements, players can auto-resolve based on fleet composition.

### Ground Combat
- **Triggered after orbital defenses are cleared.**
- **Troop transports** must deliver ground forces to the planet surface.
- **Ground units:** Infantry, armor, artillery, special forces (species-specific). Built at military planets.
- **Planetary terrain affects combat:** Desert, jungle, urban, ocean (for aquatic species) -- each terrain type favors different unit types.
- **Fortifications:** Defenders can build planetary defense structures (bunkers, shield generators, anti-air).
- **Resolution:** Simulated in real-time but at a higher abstraction level than space combat. Player sets strategy (aggressive assault, siege, targeted strike) rather than micromanaging individual units.
- **Occupation:** After ground victory, the planet is captured but population may resist. Occupation stability depends on species compatibility, government type, and religious alignment.

---

## 12. Victory Conditions

Seven distinct paths to galactic supremacy:

| Victory | Name | Condition |
|---------|------|-----------|
| **Generalist** | Dominant Race | Maintain a significant lead in a combined score across technology, economy, diplomacy, and military for a sustained period. |
| **Territorial** | Masters of All | Control >75% of known space. All remaining independent empires must be vassals. |
| **Assimilation** | One of Us | All other species are either subjugated (conquered) or culturally assimilated (adopted your customs/government). |
| **Religious** | One True God | Your religion is the dominant or sole religion across all inhabited planets in the galaxy. |
| **Economic** | Riches Beyond Measure | Economic output and accumulated wealth so far exceed all other empires combined that military/tech development cannot close the gap. Measured by sustained income dominance. |
| **Military** | Might Over All | Military power (fleet strength + ground forces + defensive installations) exceeds all other empires combined. Sustained dominance triggers victory. |
| **Technological** | 10th Dimension | Research a final transcendence technology that requires mastery of all tech branches. Represents ascending beyond conventional galactic competition. |

### Victory Mechanics
- Victory conditions are tracked in real-time with progress indicators visible to the player.
- Other empires receive warnings when a player approaches a victory condition, allowing for counter-play (coalitions against a dominant player).
- Some victories are instantaneous (10th Dimension completes the transcendence tech) while others require sustained dominance over a set number of game-years.
- Government type and species traits affect which victory paths are natural fits.

---

## 13. Planet Management

### Buildings
| Building | Function | Special |
|----------|----------|---------|
| Research Lab | Generates research points | Higher tiers unlock species-specific research |
| Factory | Produces construction capacity | Required for ship building and infrastructure |
| Shipyard | Builds and repairs ships | Larger yards build larger ships |
| Trade Hub | Generates credits from trade | Bonus when connected to trade routes |
| Defense Grid | Orbital defense platforms | Minefields, gun emplacements, shields |
| Population Center | Increases max population | Required for growth |
| Mining Facility | Extracts planet resources | Output depends on resource richness |
| Spaceport | Enables colonization and transport | Required for troop deployment |
| Temple | Generates faith | Required for religious victory path |
| Government Center | Administrative functions | One per planet; government bonuses |
| Military Academy | Produces ground troops | Required for ground invasion capability |
| Terraforming Station | Modifies planet environment | Slowly changes atmosphere/temperature toward species preference |

### Resource System
- **Credits:** Universal currency. Generated by taxation, trade, and mining. Spent on construction, subsidies, espionage, diplomacy.
- **Minerals:** Raw materials for building. Extracted from planets.
- **Rare Elements:** Required for advanced tech and ships. Found on specific planet types.
- **Energy:** Powers advanced buildings and military. Generated by specific infrastructure.
- **Organics:** Food and biological materials. Required for population growth. Especially important for bio-origin species.
- **Exotic Materials:** Endgame resources for megastructures and transcendence tech. Very rare.
- **Faith:** Generated by temples and religious actions. Spent on missionaries, holy buildings, religious edicts.
- **Research Points:** Generated by labs and allocated across active research projects.

---

## 14. AI System

### Design Principle
**No cheating.** AI opponents play by the same rules as human players. Higher difficulty = better decision-making, not resource bonuses.

### AI Personalities
Each AI empire has a personality that drives strategic decisions:
- **Aggressive:** Prioritizes military, attacks early and often.
- **Defensive:** Turtles, builds fortifications, retaliates but rarely initiates.
- **Economic:** Focuses on trade and wealth, uses money to buy allies.
- **Diplomatic:** Alliance-builder, avoids war, wins through soft power.
- **Expansionist:** Colonizes aggressively, large empire, spread thin.
- **Researcher:** Tech-focused, small but advanced empire.
- **Fanatical:** Religion-driven, crusades, missionary spam.
- **Balanced:** Adapts strategy to situation.

### AI Capabilities
- **Strategic:** Expansion planning, research priority, fleet composition, alliance selection.
- **Tactical:** Combat positioning, target selection, retreat logic, formation choice.
- **Diplomatic:** Personality-based negotiation, grudge memory, alliance evaluation, threat assessment.
- **Economic:** Planet specialization, resource balancing, trade route optimization.

---

## 15. Multiplayer

- **Lobby system** with configurable game settings (galaxy size, speed, victory conditions, species restrictions).
- **WebSocket-based** real-time synchronization via Socket.io.
- **Server-authoritative** game state (prevents cheating).
- **Speed:** Host-controlled or vote-based speed changes. No pause in multiplayer.
- **Reconnection handling** for dropped connections.
- **Chat:** In-game text chat (all, team, private).
- **Player accounts:** Authentication, saved statistics, leaderboards.
- **Max 16 players** (human + AI combined).

---

## 16. UI/UX Design Principles

Preserving the original's greatest strength (streamlined interface) with modern improvements:

- **Hotkey-driven:** Every major screen accessible via a single key. Power users should rarely touch the mouse for navigation.
- **Nested zoom:** Galaxy > System > Planet > Surface. Seamless zoom transitions (not separate windows like the original).
- **Information density:** Panels show detailed data, not simplified icons. Habitability as numbers, not smiley faces.
- **Slide-out panels** instead of overlapping windows. Clean, non-cluttered.
- **Dark space aesthetic** with modern visual fidelity: subtle nebula backgrounds, particle effects, dynamic lighting on ships and planets. Avoid the "dull and lifeless" criticism of the original.
- **Face-to-face diplomacy screen** with alien leader portraits and expressions.
- **React UI overlays** for management screens (research tree, ship designer, diplomacy, planet management) rendered on top of the Phaser game canvas.

---

## 17. Revised Milestone Roadmap

### Phase 1: Foundation (MVP Core Loop)
- Monorepo scaffolding, Phaser 3 + React + Vite client, Fastify + Socket.io server
- Galaxy generation (stars, planets, stable natural wormholes)
- Galaxy map scene with pan/zoom
- System view with planet details
- One prototype species with basic tech tree
- Basic colonization mechanics
- Resource system (credits, minerals, research points)
- Basic space combat (no formations/morale yet)
- Basic AI opponent (simple expansion + combat)
- Save/load game state

### Phase 2: Species & Tech Trees
- Species data model with origin-determines-tech architecture
- 3-4 contrasting species with unique tech trees
- Custom species creator UI
- Full 5-age tech tree with branching paths
- Simultaneous research system
- Technology effects (unlock ships, improve stats, enable abilities)

### Phase 3: Combat Depth
- Enhanced space combat (formations, morale, system damage, routing)
- Ground combat system (troops, terrain, fortifications)
- Orbital defenses and planetary bombardment
- Ship designer UI with directional weapon placement
- All hull classes (Scout through Dreadnought)
- Auto-resolve option

### Phase 4: Diplomacy & Personality
- Alien leader portraits and personality system
- Face-to-face negotiation screen
- Full treaty system (non-aggression through alliance/vassalage)
- Trade routes and resource trading
- Espionage system
- Relationship memory and trust mechanics
- AI diplomatic behavior

### Phase 5: Government, Religion & Victory
- Government types with gameplay effects
- Government change mechanics (revolution, reform)
- Religion system (faith, missionaries, tenets, holy wars)
- All 7 victory conditions implemented
- Victory progress tracking and warnings
- End-game screen with statistics

### Phase 6: Advanced FTL & Galaxy Evolution
- Unstable wormhole mechanics (appearance/disappearance, stabilization)
- Artificial wormhole construction
- Singularity drives
- FTL drive research progression
- Terraforming

### Phase 7: Multiplayer & Polish
- Online multiplayer with lobbies and matchmaking
- Server-authoritative game state
- Chat system
- Sound effects and ambient audio
- Music system
- Visual polish (particle effects, transitions, animations)
- Performance optimization
- Modding documentation

### Phase 8: Launch
- Full settings UI
- Accessibility features
- Cross-browser testing
- Load testing
- Landing page
- Open beta
