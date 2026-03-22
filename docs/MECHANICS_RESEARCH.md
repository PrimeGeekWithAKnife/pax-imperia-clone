# Ex Nihilo — Mechanics Research & Design Document

**Status:** Design Reference
**Date:** 2026-03-22
**Scope:** Comparative research across five 4X space strategy titles, with design recommendations for Nova Imperia / Ex Nihilo.

---

## Design Philosophy Reminders

Before each section, the relevant design constraints are:

- **Accessible complexity** — mechanics should be visible, predictable, and learnable. No hidden formulas.
- **No cheating AI** — the AI must operate within the same rules as the human player. Difficulty comes from better strategic decisions, not numerical cheats.
- **Meaningful choices** — every building, law, and fleet decision must have a real tradeoff. No "strictly dominant" option that renders all others obsolete.

---

## 1. Building Types

### Comparative Research

**Master of Orion 2 (1996)** is the reference standard. Its 62-building colony structure catalogue divides into clear functional tiers:

_Food:_
- Hydroponic Farm (+2 food, replaces 2 colonist-farmers)
- Soil Enrichment (+1 food/farmer)
- Biospheres (+2 max population)
- Recyclotron (converts industrial waste to 2 food)

_Industry:_
- Automated Factory (+5 to +20 production, scales with mineral richness)
- Robotic Factory (+5 to +20 production, upgrades Automated Factory)
- Deep Core Mine (+3 production/miner, +15 flat)
- Improved Robotic Controls (further production multipliers)

_Research:_
- Research Lab (+5 RP, +1 RP/researcher)
- Supercomputer (+10 RP, +2 RP/researcher, upgrades Research Lab)
- Autolab (+30 RP flat, stacks with other research buildings)
- Alien Artifacts (+5 RP)

_Population / Happiness:_
- Recreation Commons (+happiness)
- Holobroadcasting (+more happiness)
- Pleasure Dome (maximum happiness, replaces lower tiers)
- Cloning Center (+1 population/turn above base growth)
- Alien Management Center (removes 20% morale penalty from multi-species colonies; halves unrest in assimilated populations)

_Military:_
- Marine Barracks (trains marines for boarding; adds 5 defence value)
- Barracks upgrades to Fighter Garrison, then Ground Batteries
- Star Base (orbital defence platform; upgrades to Battlestation and Star Fortress)
- Missile Base (ground-launched missiles into orbit)
- Planetary Shield Generator (force field over planet)

_Planetary Infrastructure:_
- Spaceport (trade route hub, +trade income and ship construction options)
- Colony Base (foundation; removed when population exceeds threshold)
- Gravity Generator (reduces heavy-gravity penalty for non-adapted species)
- Terraforming (one-shot project, not a building; upgrades biome tier)
- Atmospheric Renewer (reduces pollution accumulation by 5 units/turn)
- Pollution Processor (reduces by 10 units/turn; replaces Atmosphere Renewer — does not stack with it, but does stack with Toxic Processor)
- Toxic Processor (converts Toxic biome to Barren, enabling further terraforming; provides 5 pollution reduction)

_Unique Structures (each buildable once per game):_
- Orion's Star system Wonder
- Oracle Interface (requires Psionic research)

Advanced Colony Ships, once researched, auto-include Automated Factory, Colony Base, Hydroponic Farm, and Research Lab on arrival.

**Ascendancy (1995)** uses a tile-based surface system. Planets have coloured squares — white (general), green (prosperity bonus), red (industry bonus), blue (research bonus), and black (initially unusable, unlockable via tech). Ten orbital squares host shipyards and orbital defences. Buildings must match the tile type for full efficiency, creating placement strategy even before construction choices.

**Galactic Civilizations 3 (2015)** categories its improvements under: Approval, Influence, Manufacturing, Military, Population, Research, Special, Terraforming, Tourism, and Wealth. Notable additions include:
- "Galactic Achievements" — wonders buildable once per entire galaxy, conferring massive bonuses plus prestige
- Trade Goods improvements — commodities that only one civilization can produce per galaxy, forcing trade or conflict
- Power Plants (including Antimatter Powerplants) that increase raw production capacity of all adjacent tiles
- Space Elevator and Star Port as foundational economic infrastructure

**Stellaris** operates differently: buildings go into district slots on planets. Orbital megastructures include Habitats (colonizable space stations above planets/stars), Orbital Rings (bonus districts + starbase functionality for an existing planet), Ring Worlds (massive late-game living space), and Dyson Spheres (eliminate energy production concerns). Multi-stage megastructures start as construction sites with no benefit and unlock bonuses incrementally.

### Ex Nihilo Recommendations

Implement a three-tier building system:

**Tier 1 — Colony Essentials** (available from founding):
- Colony Hub (free; provides basic housing, administration, and tax collection)
- Hydroponics Bay (food; planet-surface version — supports 2 population without farmer assignment)
- Prospecting Station (extracts base mineral wealth)
- Communications Array (enables colony-to-homeworld trade income)
- Medical Centre (reduces population attrition; increases growth rate)

**Tier 2 — Development** (requires 3–8 population and mid-game tech):
- Industrial Complex (production multiplier; generates 1 pollution token/turn)
- Research Institute (RP generation; requires Research Lab prerequisite)
- Environmental Processor (pollution removal; upgrades to Advanced Atmospheric Scrubber)
- Recreation Dome (happiness; stacks with Tier 1 Social Centre)
- Civic Administration (increases colony governor efficiency; reduces unrest)
- Spaceport Expansion (enables larger ship classes; increases trade route value)
- Orbital Tether (allows orbital ring structures; prerequisite tech required)

**Tier 3 — Specialisation** (late-game; high pop requirement):
- Cloning Vats (accelerated population growth; slight happiness penalty from "factory" connotation)
- Deep Core Extractor (triples mineral yield; creates geological instability risk)
- AI Research Nexus (massive RP boost; requires Computing tech chain)
- Pleasure Quarter (maximum happiness; costly maintenance; cannot coexist with labour camps)
- Planetary Defence Grid (automated orbital cannons; supplements garrison)
- Bio-Dome Preservation (increases biome quality cap by one tier; slow effect)

**Wonders** (one per galaxy):
- Grand Observatory (empire-wide research bonus)
- Galactic Exchange (empire-wide trade bonus; draws all race trade interest)
- Memorial of the Founders (permanent happiness bonus empire-wide)
- Orbital Shipyard Prime (builds ships 50% faster; attracts rival espionage)

Building maintenance must always be visible on the build screen. Show the break-even population required for each building so the player never builds at a loss by accident.

---

## 2. Population Mechanics

### Comparative Research

**Master of Orion 2** is the most detailed of the reference games.

_Growth:_ Base growth rate depends on current population relative to planet capacity. Growth is fastest at roughly half capacity, then slows as it approaches the cap. Biospheres and Cloning Centers modify the cap and growth rate respectively.

_Food:_ Each colonist consumes 1 food unit per turn. A shortage causes a growth slowdown; a severe shortage causes population decline. Hydroponic Farm offsets the need for farmer workers.

_Morale:_ Acts as a flat production multiplier on all workers. If morale is 80%, every worker functions at 80% output, rounding down — small morale losses cascade into production losses. Triggers for morale loss include: high taxes, alien populations (–20% per foreign species present without Alien Management Center), recently conquered status (yellow population icons indicating unhappiness), and lack of housing.

_Species Mixing:_ Multi-species colonies are common after conquest. Each alien species present on a colony applies a morale penalty until the Alien Management Center is researched. Assimilation takes time; the Alien Management Center halves assimilation time as well.

_Strikes:_ If morale percentage falls below a threshold, the corresponding fraction of workers go on strike, producing nothing. A 60% morale colony means only 60% of workers are productive. This is visible — striking workers display different icons.

**Galactic Civilizations 3** uses an Approval (happiness) system with direct economic consequences: approval affects tax rate efficiency. Low approval causes unrest events; very low approval triggers independence referendums. Each government type sets a "colony limit" — colonies beyond the soft cap apply approval penalties empire-wide, not just locally.

**Stellaris** models population as individual "Pops," each belonging to a species and a stratum (ruler, specialist, worker, slave). Each pop has jobs it can fill; if jobs are unavailable, pops become unemployed and generate amenity and unity penalties. Species traits modify which jobs a pop excels at. Pops resist living under governments with ethics contrary to their species' preferences, generating unrest events. Migration treaties allow pops to move between empires, spreading your species or inviting alien colonists.

**Sword of the Stars** simplifies this: each race has a colonization preference biome and a growth rate. No per-unit morale system.

### Ex Nihilo Recommendations

Implement a transparent morale model with visible components:

**Morale Sources (each displayed separately in colony UI):**
- Base happiness (government type baseline)
- Food security (food surplus bonus; starvation penalty)
- Housing quality (overcrowding penalty when pop > capacity)
- Entertainment level (buildings; events)
- Tax rate (graduated penalty: 0–15% no penalty; 16–30% –5%; 31–45% –15%; 46%+ –30%)
- Species mixing (–10% per alien species present without Alien Integration Centre)
- Recent conquest (–25%, decays over 20 turns)
- Recent battle damage (–10%, decays over 10 turns)
- Pollution level (–5% at medium; –20% at critical)

**Morale Effect:**
- Above 80%: +5% production bonus ("motivated workforce")
- 50–80%: neutral
- 30–50%: –15% production penalty; rare unrest events
- Below 30%: –30% production; regular unrest events; risk of revolt if colony is alien-majority

**Population Growth:**
- Food surplus: +growth rate modifier
- Medical Centre built: +growth rate
- Pleasure Quarter built: small +growth rate
- Growth capped by housing capacity; Biosphere tech raises cap
- Cloning Vats ignore cap (can grow beyond normal maximum, but consume production instead of food for synthetic individuals)

**Species Mechanics:**
- Each species has: homeworld biome preference, atmospheric tolerance, gravity tolerance, cultural traits (one primary, one secondary)
- Colonists of a non-preferred biome type suffer a happiness penalty and reduced productivity unless habitability buildings are present
- Multi-species colonies gain a "cultural diversity" bonus to research (+5%) as a counterweight to the morale penalty, making the choice genuinely dual-sided

---

## 3. Energy / Power Mechanics

### Comparative Research

**Master of Orion 2** treats Power as a research field (not a planet resource). The Power research tree unlocks ship engine improvements, bomb types, and special systems. Colonies do not have an energy grid; production buildings simply operate. There are no brownouts.

**Stellaris** uses Energy Credits as a currency-like resource. Every building and ship has upkeep measured in energy credits per month. If your empire-wide energy balance goes negative, buildings and ships operate at reduced effectiveness. Energy is produced by Generator Districts (planet surface) and solar panels on starbases. Running an energy deficit is a common early-game problem that forces real prioritisation decisions. There is no "brownout priority" system — all buildings are equally penalised proportionally, which is sometimes frustrating.

**Galactic Civilizations 3** uses a Power resource produced by Power Plants and Antimatter Plants on planets. Power is required to run certain improvements (the game shows a red icon when you lack power for a building). The solution is always to build more power plants. Power Plants also act as adjacency bonuses for production tiles. There is no brownout — buildings simply don't function without power.

**Ascendancy** ties ship weapon power directly to onboard reactors. Installing weapons that exceed the ship's power output means weapons don't all fire. This forces meaningful ship design tradeoffs between weapons, shields, engines, and reactors.

### Ex Nihilo Recommendations

Implement a **colony-level power grid** (not empire-wide), keeping scope manageable and choices visible.

Each colony has a **Power Budget**:
- Base power generated by: Power Core (free, built-in to Colony Hub)
- Additional power from: Fusion Reactor (+6 power), Antimatter Plant (+15 power, requires late tech)
- Power consumed by: Industrial Complex (–3), AI Research Nexus (–5), Planetary Defence Grid (–4), Orbital Tether (–2), Cloning Vats (–3)
- Basic buildings (Hydroponics, Recreation Dome, etc.) consume no power — they are self-contained

**Brownout Behaviour:**
- At 0 to –5 power deficit: low-priority buildings (Entertainment, Recreation) operate at 50%
- At –6 to –10 deficit: production buildings run at 75%
- Beyond –10: critical deficit; random building shutdown each turn until resolved

**Priority System:** Players set a priority order for buildings (drag-and-drop list). In a brownout, buildings lower on the list shut down first. This replaces the MOO2-style "everything degrades equally" approach with an explicit meaningful choice.

Power should be displayed prominently in the colony panel as a coloured bar (green = surplus, yellow = tight, red = deficit) with a tooltip showing which buildings are contributing and consuming.

---

## 4. Economy Depth

### Comparative Research

**Master of Orion 2** economy:
- Tax rate set globally (0–50%); income = (population × production × tax rate)
- Trade Treaties with other empires: negotiated via diplomacy; last 20 turns; generate flat credits per turn; renewable
- Trade Goods project: allocates 50% of a colony's production to generate credits instead of building ships/structures — high opportunity cost but pure income
- Maintenance costs: most buildings have a small per-turn BC cost; ships have upkeep; players frequently go bankrupt mid-game if they overexpand fleets
- No luxury goods system per se, though some racial traits modify income generation

**Galactic Civilizations 3** economy:
- Wealth improvements (Stock Exchanges, Galactic Bazaars) multiply planetary income
- Trade Routes via Freighter ships: value increases with distance and route age; can be destroyed by war
- Luxury trade goods (Ultra Spice, Techapod Hive, etc.) are unique per galaxy — one civilization produces them, others must trade or conquer for access; these apply empire-wide bonuses
- Maintenance is significant: large ships cost 30 BC/turn; industrial structures also cost maintenance; going negative sends a cascading penalty through approval
- Colony limit enforcement via approval penalties (see Population section)

**Galactic Civilizations 2** adds:
- Tourism improvements generating cultural income
- The longer a trade route exists, the more valuable it becomes (relationship-building mechanic)

**Stellaris** economy:
- Multiple resource types: Energy Credits, Minerals, Alloys, Consumer Goods, Food, Rare Resources (8+ types)
- Consumer Goods are a "tax on prosperity" — higher-stratum pops require Consumer Goods upkeep or they become unhappy and less productive
- Trade Value: generated by certain buildings and pops; flows along trade routes to a designated collecting starbase; subject to piracy interdiction if the route passes through unsecured systems
- Branch Offices (Megacorp DLC): corporations establish branches on other empires' planets, generating income for the corporation while providing a smaller bonus to the host
- No black market in vanilla; exists as a rare event outcome

**Sword of the Stars 2** automates trade logistics — freighters exist but are handled by the AI governor. Players focus on which colony specialises in what, not routing individual ships.

### Ex Nihilo Recommendations

**Income Sources:**
1. **Colony Tax** — base income from population and production, modified by government type. Always visible as a per-colony figure.
2. **Trade Routes** — automatically established when two spaceports exist within range, or manually via Freighter ship. Value = (Pop A × Pop B) / (distance modifier). Value grows 2% per turn a route is active, up to a 50% bonus. War destroys routes. Players must choose between long high-value routes (vulnerable) or shorter safer ones.
3. **Trade Goods** — a colony with a Luxury Resource deposit can build a Trade Goods Processing Plant, converting 30% of mineral production into credits and generating a unique trade good. Each trade good can be sold to any empire for a recurring credit-per-turn treaty, or withheld to harm rivals.
4. **Taxation vs. Growth:** Tax rate above 30% applies a morale penalty (see Population section). Players who rush income growth sacrifice long-term population development — a real tradeoff.

**Maintenance:**
- Every building has a listed maintenance cost in the build screen
- Ships have per-turn fuel and supply costs
- If empire-wide treasury drops below zero, buildings are mothballed automatically (shut down but not destroyed) in reverse construction order — most recently built first
- Mothballed buildings are reactivated automatically when treasury recovers
- This is transparent and player-controllable via the treasury warning system

**Black Market (late-game):**
- When an empire has the Smugglers Guild civic or researches Black Market tech, they gain access to one-off purchases of resources at 3× market rate, bypassing trade embargo effects
- Rival empires can detect black market activity via espionage, providing a casus belli or diplomatic penalty

**No maintenance-hiding:** The UI must always show "Current surplus/deficit" at the empire level and a breakdown by colony. Hidden economics is the enemy of meaningful choices.

---

## 5. Planet-Specific Tech

### Comparative Research

**Master of Orion 2 terraforming stages:**

Each planet has a biome type on a spectrum from "most hostile" to "most habitable":
Toxic → Radiated → Barren → Desert / Tundra → Arid / Swamp → Ocean → Terran → Gaia

Terraforming upgrades biome by one tier:
- Barren → Desert (inner orbit) or Tundra (outer orbit)
- Desert → Arid; Tundra → Swamp
- Arid, Swamp, Ocean → Terran
- Terran → Gaia (requires Gaia Transformation tech; rare and very expensive)

Atmospheric Renewer: reduces pollution by 5/turn; early tech
Pollution Processor: reduces by 10/turn; replaces Renewer (doesn't stack with Renewer, does stack with Toxic Processor)
Toxic Processor: instant conversion of Toxic planet to Barren, then regular terraforming applies; 5 pollution reduction also

Pollution accumulates from factory output. Radiated, Toxic, and Volcanic planets are immune to pollution accumulation (their environment is already so hostile it doesn't matter). High-production colonies must manage pollution or lose biome quality.

Gravity Generator: reduces the productivity penalty suffered by non-adapted species on heavy-gravity planets. Without it, heavy-gravity world colonists produce less regardless of assignment.

Core Waste Dump: provides 100 pollution reduction (essentially eliminates pollution concerns), but requires specific late-game tech.

**Stellaris** has a Terraforming mechanic (requires specific DLC/tech): planets can be converted between types over hundreds of in-game years, costing significant resources and Energy Credits. The process is irreversible once started. Terraform too many worlds and you can deplete rare terraforming gases.

**Ascendancy** uses a research-gated system: black (uninhabitable) squares on planet surfaces can be converted to usable tiles once specific environmental research is complete, effectively increasing planet capacity over time without explicit terraforming. Some alien special abilities can instantly convert a planet to an Eden world.

**Galactic Civilizations 3** has discrete Terraforming improvements buildable on planet tiles: each raises the planet quality rating, unlocking additional building slots.

### Ex Nihilo Recommendations

**Biome Ladder** (7 tiers):
1. Dead (no colonization possible without specific tech)
2. Barren (max population 2; no food; –50% happiness for non-adapted)
3. Harsh (max pop 5; –30% happiness for non-adapted)
4. Marginal (max pop 8; –15% happiness for non-adapted)
5. Standard (max pop 12; no penalty)
6. Verdant (max pop 16; +5% growth bonus)
7. Paradise (max pop 20; +10% happiness; +5% research inspiration bonus)

**Terraforming:**
- Atmospheric Processor: one-time project (consumes production over N turns); upgrades biome by one tier; generates 3 pollution tokens during construction
- Each biome upgrade requires the previous tier as prerequisite
- Dead → Barren requires Atmospheric Processor I tech (available mid-game)
- Barren → Harsh requires Atmospheric Processor II
- Verdant → Paradise requires Planetary Biosphere Seeding (very late game; one-time project; massive cost; only once per game per empire)

**Pollution System:**
- Pollution tokens generated by: Industrial Complexes (+1/turn), Deep Core Extractor (+2/turn), certain ship construction (–1 token if Recycling Centre built)
- Pollution tokens removed by: Environmental Processor (–1/turn), Advanced Atmospheric Scrubber (–3/turn, replaces previous), Coral Gardens event improvement (–1/turn, rare)
- At 10 tokens: biome degrades one tier (visual indicator shows red pollution cloud on planet icon)
- At 20 tokens: further degradation; colonist happiness –20%
- Pollution tokens are visible as a counter in the colony panel at all times

**Gravity Generators:**
- Heavy-gravity planets apply –25% productivity to non-adapted species
- Standard Gravity Generator (mid-game tech): –15% (partial mitigation)
- Advanced Gravity Compensators (late-game): full mitigation; enables paradise-tier heavy-gravity worlds

**Core Mining:**
- Available only on Mineral Rich or Ultraminerals class planets
- Deep Core Extractor triples mineral yield
- Each active extractor generates a 5% chance per 20 turns of a "seismic event" (–production for 3 turns)
- Core Stabiliser tech reduces seismic risk to 1%

---

## 6. Space Stations

### Comparative Research

**Master of Orion 2:** Star Base is a colony building (an orbital structure). It upgrades to Battle Station, then Star Fortress. Each tier adds combat strength and maintenance. Star Bases also add defensive value multiplied by the planet's garrison units.

**Sword of the Stars 2** has the most developed station progression:

_Naval Stations (5 upgrade tiers):_
- Outpost: minimal dock, crew module, supply warehouse
- Forward Base: sensor/repair base; limited fleet support; double sensor range of Outpost
- Naval Base: full military facility; moderate fleet support; extended sensor range
- Star Base: large fleet operations hub; major system defence
- (Tier 5 not named in sources)

Science Stations provide R&D bonuses and early event warning even at the smallest size. Defence Platforms are separate structures: torpedo platforms, missile platforms, battlerider platforms, each requiring their own tech unlock. Defence capacity of a system is limited by the station tier — without a Naval Base or higher, you can only deploy 3 Combat Power worth of defences (1 drone satellite, 2 minefields, etc.).

**Stellaris** uses Starbases as the backbone of empire control: a system without a Starbase is not claimed. Starbases upgrade through tiers (Outpost → Starport → Starhold → Star Fortress → Citadel), each unlocking more module and building slots. Modules include: Shipyards (build ships), Anchorages (increase fleet command limit), Hangar Bays (fighter wings), Gunnery Stations (weapons). Buildings include: Listening Post (sensor range), Crew Quarters (reduce attrition), Titan Yards (unlock titan-class ships). Starbases do not have a separate "science station" type — research outposts are a specific starbase building.

Orbital Rings are a half-megastructure: built above a colonized planet, they function as an attached starbase and provide district bonuses for the planet below. They cost no construction site but require a construction ship pass.

**Ascendancy:** Orbital squares on planets (10 per planet) can hold shipyards, planetary defences, and orbital structures. These are built from the planet management screen and integrate directly with the planet's production.

**Galactic Civilizations 3:** Space elevators, Star Ports, and Deep Space Citadels serve as orbital infrastructure. Citadels are purely defensive, hosting starbase modules and defence platforms independently of planets.

### Ex Nihilo Recommendations

Implement two distinct station categories with separate mechanics:

**Orbital Stations (built above specific planets):**
- Orbital Platform (Tier 1): basic shipyard, allows Destroyer and Transport class; +1 trade route slot
- Battle Orbital (Tier 2): requires Orbital Platform; adds weapon mounts; defence equivalent to ground Star Base; +Cruiser class unlock
- Orbital Shipyard (Tier 3): requires Battle Orbital + Industrial Complex on surface; full warship construction; –15% construction time for ships built here
- Research Outpost (alternative Tier 2): adds +10 RP to colony; +sensor range; cannot be built on same planet as Battle Orbital (mutually exclusive specialisation)
- Orbital Ring (late-game): requires Orbital Tether on surface + advanced tech; adds one extra building slot to the planet below; +100% fire rate against attackers; can serve as a starbase for trade route purposes

**Deep Space Stations (built in empty star systems, not above planets):**
- Listening Post: claims the system; +sensor range; no combat capacity; cheap and quick to build
- Waystation: adds supply cache (fleets in system recover supplies faster); +1 fleet command capacity bonus for fleets operating within 2 jumps
- Deep Space Citadel: full combat platform; requires specific defensive tech; does not build ships but can be equipped with weapons, shields, and fighter bays; upgrades through 3 tiers

**Key Design Decisions:**
- Stations must be explicitly vulnerable — they can be attacked and destroyed without capturing the planet below
- Station construction uses the same shipyard queue as ships (opportunity cost)
- Abandoned stations (empire collapses, colony lost) persist as derelict structures that can be repaired and reactivated by anyone who enters the system — rewarding exploration

---

## 7. Government Evolution

### Comparative Research

**Galactic Civilizations 3 (Intrigue expansion)** has the most explicit government evolution system. Governments are formed every 26 in-game turns. 20 government styles exist across tiers:

- Tier 1 (available at start): Chieftain Clans, Theocracy, Military Junta, Autocracy
- Tier 2 (requires specific research or ideology): Interstellar Republic, Constitutional Monarchy, Star Democracy (20% economy bonus), Feudalism, Corporate State
- Tier 3: Star Federation (30% economy bonus), Technocracy, Hive Mind

Some governments hold elections; losing an election results in a Coalition Government with reduced bonuses. Government type sets the colony limit (the soft cap beyond which approval penalties accrue). Some governments prevent declaring war (pacifist constitutions), while others give military production bonuses.

**Stellaris** does not have linear government evolution. Instead, the government is defined by Ethics + Authority + Civics, and these change slowly over time as the empire's population shifts ethics. A Materialist empire that conquers many Spiritualist pops may see its ethics drift toward Fanatic Materialist + moderate Spiritualist, enabling or requiring a civic change. The three Ascension Paths (Biological Mastery, Synthetic Evolution, Psionic Transcendence) represent the ultimate government/species transformation — not just a tech unlock but a total civilizational shift that changes what buildings, laws, and strategies are available.

Machine Intelligence and Hive Mind are locked government types with unique mechanics: no individual pop happiness; different production models; different diplomatic options.

**Master of Orion 2** has government types selected at species creation (Democracy, Dictatorship, Feudalism, Unification, Confederation, etc.), each with flat bonuses. Government does not evolve during the game — it is a race trait.

**Sword of the Stars** similarly treats government as a fixed racial trait.

### Ex Nihilo Recommendations

Implement a **technology-gated government progression** where governments evolve through three eras, with a meaningful fourth-era "transcendence" option:

**Era 1 — Preindustrial Foundations (start of game):**
- Tribal Council: +10% population growth; –10% research; can only sustain 5 colonies before approval penalty
- Autocracy: neutral bonuses; flexible policies; no election disruption risk
- Theocracy: +15% happiness; –15% production; diplomatic penalty with secular races

**Era 2 — Industrial Age (requires Government Theory tech, ~mid-game):**
- Democracy: +20% research; –10% military production; elections every 30 turns (player always wins — but opposition parties can table policies the player must respond to)
- Oligarchy: +15% economy; small corruption maintenance drain; no elections
- Meritocracy: +10% research, +10% production; requires AI Advisory Bureau building to maintain
- Stratocracy: +20% military production; –10% happiness; aggressive diplomatic reputation
- Corporate State: +25% trade income; –15% colony limit before penalty; trade route requirement to sustain government bonuses

**Era 3 — Information Age (requires Computing IV tech):**
- Liberal Federation: +25% research, +15% happiness, +10% economy; high autonomy — some colony management is automated under local governor rules
- Technocracy: +30% research; –5% happiness; best science output in game
- Surveillance State: +20% espionage effectiveness; –10% happiness (visible morale penalty from surveillance); counter-espionage fully automated
- Megacorporation: +35% trade; colonies managed as "assets"; happiness replaced by "productivity rating"; unique corporate building set unlocked

**Era 4 — Transcendence (late-game; one path per run):**
- Synthetic Convergence: majority of population converted to androids; happiness replaced by "operational efficiency"; immune to population-based unrest; +20% production; unique buildings
- Psionic Council: requires Psionic research branch; leaders have random psionic abilities; diplomacy gains "mental influence" option; unique spy actions
- Ecological Harmony: planet capacity doubled; pollution immunity; –30% military production; victory by reaching Paradise biome on all colonies above threshold
- AI Governance: requires Computing V + Social Networks V; AI governors run all colonies optimally but player loses direct control of tax/policy sliders; gain +50% empire-wide efficiency but accept the constraints

**Government Change Mechanic:**
- Changing government costs 50 turns of reduced production (transition period)
- Certain techs unlock new tiers; you cannot skip tiers (Synthetic Convergence requires era 3 government as prerequisite)
- Civic policies (individual laws within a government) are adjustable without changing government type — these are the fine-grained controls

---

## 8. AI / Robot / Computing Tech

### Comparative Research

**Master of Orion 2 — Computers tech field:**
The Computers field is a pure research enhancer. Computers techs provide bonuses to hit chance in combat (battle computers), colony management efficiency, and espionage effectiveness. The highest computer technologies unlock:
- Battle Computers III (fire control improving hit chance)
- Rangemaster Unit (accuracy at long range)
- ECM Jammer (counter to enemy battle computers)
- Hacking (spy mission type, enabled by Computers research)

Android Workers are a Biology-field technology (not Computers): self-sustaining colonists that consume production instead of food, provide higher per-worker production, are unaffected by gravity and pollution, and can populate Toxic planets. Strategy using androids: convert a planet to android-only workforce to triple production on high-resource worlds.

**Stellaris** has a full AI and Synthetic tech tree:
- Droids: fully autonomous robot workers; require assembly plants to produce; each pop produced at a production cost
- Synthetic Workers (requires Synthetics tech): upgraded droids; can fill specialist-tier jobs
- Positronic AI: enables full robotic empire policies; triggers Synthetic Ascension path option
- AI Policy: sets how much freedom AIs have; Full Military use allows synthetic admirals; outlawed AIs cause unrest in machine-tolerant pops
- Distributed Computation (building): +research per world
- Neural Interface (late game): integrates biological and synthetic neural networks; massive research boost

Megacorps introduce the Franchise Management Complex and other corporate administration buildings powered by computational networks.

**Galactic Civilizations 2/3 computing buildings:**
- Neural Interface Stacks, Think Tanks, Super Computers as tiered research buildings
- Surveillance Networks (Intrigue expansion): builds a counter-espionage infrastructure passively; costs maintenance

**Ascendancy:** All technology is in a single interconnected web; computing improvements enhance ship sensors, reduce research time, and improve colony management automation. No separate "android" system.

### Ex Nihilo Recommendations

**Computing Tech Chain** (8 levels, unlocks buildings and mechanics):

- Computing I: Colony Management Software (building) — reduces governor bureaucracy overhead; +5% production on automated assignments
- Computing II: Data Networks — enables empire-wide instant communication; unlocks Trade Route Optimisation (passive bonus to all trade routes)
- Computing III: Automated Assembly Lines (building) — robotic workforce module on Industrial Complexes; reduces manpower requirement by 20%
- Computing IV: Neural Computation Cluster (building) — +15 RP, +1 RP/researcher; enables AI Advisory System (replaces manual resource sliders with AI suggestions that player can accept/override)
- Computing V: Android Population (building) — Assembly Plant produces Android Workers at 30-production-per-android cost; androids consume 0 food, generate 0 happiness, provide +3 net production each, immune to pollution and gravity penalties
- Computing VI: Synthetic Intelligence Core (building) — colony can be placed in full AI management (optional); AI governor selects optimal building queue and population assignments; player sets only the colony's strategic role (Industry/Research/Military/Mixed)
- Computing VII: Distributed Consciousness Network — connects all AI-managed colonies into a shared decision fabric; unlocks Synthetic Convergence government path; +10% empire-wide production
- Computing VIII: Transcendent Logic Lattice — precondition for Era 4 AI Governance government; enables the "Machine Advisor" UI overlay replacing all advisor screens with a single predictive dashboard

**AI Advisors (UI system, not a building):**
From Computing IV onwards, an AI Advisor panel becomes available. It provides:
- "Recommended next build" for each colony (player can override)
- "Fleet composition warning" when attack power vs. nearest rival drops below a threshold
- "Trade efficiency report" showing which routes are underperforming
- The advisor never controls anything without explicit player delegation — it only informs

**Surveillance Mechanics:**
- Surveillance Station (mid-game building): provides +1 counter-espionage die per colony; –5% colony happiness; player must explicitly build this — it is not automatic
- Citizens' Registry (late-game Surveillance State government perk): +2 counter-espionage empire-wide; –10% happiness empire-wide; triggers periodic "civil liberties" events where the player chooses whether to expand or restrict surveillance further

---

## 9. Espionage Mechanics

### Comparative Research

**Master of Orion 2** — most detailed espionage system of the reference games:

_Spy Creation:_ Players spend production to train spies (one at a time); each spy mission type has a different base risk multiplier:
- Infiltrate Empire: 0.2 risk (reconnaissance only)
- Infiltrate Colony: 0.75
- Steal Charts: 0.3
- Hacking: 0.75
- Steal Tech: 0.5
- Destabilise Colony: 0.75
- Assassination: 1.0 (maximum risk)
- Sabotage: 1.0
- Contaminate Food: 0.75
- Incite Revolt: 1.0

_Outcome rolls:_ Each spy makes an "offence roll" against the target's "defence roll" (determined by how many counter-intelligence agents the target maintains). Success triggers a second roll for the specific outcome. Caught spies are executed or can be traded back diplomatically.

_Counter-intelligence:_ Keeping newly trained spies on counter-intelligence duty until enough are trained for an offensive mission is optimal strategy. Certain leaders have "Assassin" ability, killing one enemy spy per turn automatically.

_Critics noted:_ The Pax Imperia espionage system was called "a game of chance rather than skill" — the randomness overwhelmed strategy. MOO2's system is more nuanced but still heavily luck-dependent.

**Galactic Civilizations 3 (Crusade expansion):**

Two-tier system:
1. Assign spy to a civilization (not a planet): generates espionage points toward intelligence level with that civ; at maximum level, enables tech theft
2. Assign spy to a specific planet: immediately knocks that planet's raw production –20% (stacking — two spies means –40%); other sabotage operations available

Mission types: steal tech, circulate rumours (civil unrest), sabotage production, assassinate citizens

Counter-intelligence: unassigned spies handle it passively; counter-espionage buildings prevent spy implantation; assigned counter-agents can "nullify" (expose and remove) enemy spies

**Stellaris** has a simplified espionage system (Nemesis DLC): operations are selected from a list, each requiring accumulated "Infiltration Level" with the target empire. Operations include: Smear Campaign, Arm Privateers, Extract Assets, Sabotage Starbase, Siphon Funds, Steal Blueprints. Each operation has a success chance, a critical success bonus, and a critical failure that reveals your involvement.

### Ex Nihilo Recommendations

Implement a **three-phase espionage system** that minimises luck dominance:

**Phase 1 — Infiltration (prerequisite for all other operations):**
- Each empire has an Infiltration Rating with every other empire (0–100)
- Infiltration grows by: placing agents (active spies) in their territory, trade route presence, diplomatic contact time
- Counter-intelligence (passive or active) reduces their infiltration of you
- Infiltration is never instant — minimum 10 turns to reach basic operational level
- Infiltration level determines which operations are available (threshold-gated, not dice-gated)

**Phase 2 — Operations (threshold-gated access, but success still probabilistic):**

| Operation | Infiltration Required | Description |
|---|---|---|
| Surveillance | 10 | Reveals colony production and population |
| Technology Intelligence | 20 | Reveals their research queue and tech level |
| Economic Disruption | 30 | Reduces target colony income –15% for 5 turns |
| Sabotage Production | 40 | Destroys one building (random unless Critical) |
| Tech Theft | 50 | 40% chance to copy one researched tech |
| Incite Unrest | 60 | +20 unrest on target colony for 10 turns |
| Political Assassination | 80 | Removes an enemy leader/admiral; high detection risk |
| Coup Attempt | 90 | If successful, target colony defects to your empire; 70% failure rate even at 90 infiltration |

**Success Probability** is modified by:
- Your spy network quality (number of agents, agent tech level)
- Their counter-intelligence strength (agents + buildings)
- Infiltration level (higher infiltration = better baseline)
- Luck (±15% die roll) — luck is a modifier, not the primary determinant

**Detection and Consequences:**
- Failed operations do not always reveal the agent — there is a separate "blown" roll
- Blown agents can be extracted (costs money), executed (you lose the agent), or left in prison (they can be traded back diplomatically)
- Proven espionage acts give the victim a Casus Belli (justification for war without diplomatic penalty) and a standing diplomatic penalty

**Counter-Intelligence:**
- Each empire has a Counter-Intelligence rating
- Raised by: Surveillance Station building, Intelligence Agency civic, assigning agents to defensive duty
- Defensive agents reduce opponent infiltration growth rate; active hunters can expose and remove individual enemy agents

**Design note:** Operations should be displayed with their current success probability (a visible percentage). Players deserve to see the odds. Hidden probability = the "game of chance" criticism from Pax Imperia reviews. Visible probability = informed risk-taking.

---

## 10. Fleet Mechanics

### Comparative Research

**Master of Orion 2:**
- Ships take targeted system damage (engines, weapons, warp drives) — not just HP depletion
- Damaged ships must return to a construction facility for repair; there is no field repair without Repair Drones installed
- Repair Drones as a ship component: two units on one ship accelerate recovery
- Admirals are Leaders (hired via a leader pool): each has skill levels in different areas (navigator, tactician, engineer); higher-level admirals provide combat bonuses for their fleet
- No fleet experience system — individual ship quality (design + weapons tier) matters more than accumulated experience
- Fleet composition bonuses are informal: the game rewards combining missile ships with point-defense ships, carriers with fighters, and bombardment ships at range

**Sword of the Stars:**
- Admirals are required to form fleets — without an admiral, no new fleet can be created regardless of ship availability
- Admirals gain experience through combat and patrols (though patrol XP is minimal compared to combat)
- Auxiliary Fleet ships are mobile repair stations — can repair other ships in enemy territory
- Fleets tied to bases for supply; fleets return to base when supplies run low
- Each race has asymmetric movement mechanics: Humans use fixed node lines (wormholes), Hivers use teleporter gates, Tarka use conventional engines, Liir use silent running FTL — this creates radically different fleet logistics for each race

**Stellaris:**
- Admirals are Leaders assigned to a fleet; they accumulate experience through combat, patrols (0.05 XP/day), and battles (5 XP + 0.5 XP/destroyed ship)
- Commander traits unlock at level-up: both positive (Fire Rate, Damage bonuses, Evasion bonuses for specific ship types) and negative (may appear after a defeat; disappear after a victory)
- Fleet Command Limit: each fleet has a hard command cap (measured in fleet power); exceeding it reduces combat effectiveness; can be raised by traditions, technologies, and the Distinguished Admiralty civic
- Fleets require no supply lines in vanilla Stellaris — they can sit anywhere indefinitely without attrition
- Ship experience: individual ships gain experience through combat, providing small bonuses; veteran ships are worth preserving

**Galactic Civilizations 3:**
- Ship experience (Veteran levels): ships that survive battles gain experience; veteran ships have improved combat bonuses
- Admirals and Invasion Generals are leaders who must be assigned to fleets/ground forces; they have level-up skill trees
- No fleet supply line mechanic

### Ex Nihilo Recommendations

**Fleet Composition Bonuses:**

Rather than requiring fleet balance, implement explicit Fleet Doctrine slots. Each fleet has one active Doctrine (selected from techs researched):

- Strike Doctrine: +15% damage when all ships in fleet are the same class; –15% defence
- Combined Arms Doctrine: bonus when fleet contains at least one carrier, one cruiser, and one destroyer; +10% to all stats
- Screening Doctrine: fleet has dedicated escort ships (fighters/destroyers); +25% point-defence effectiveness; –15% attack power
- Blitzkrieg Doctrine: +20% warp speed; +10% first-strike damage; –25% sustained DPS
- Siege Doctrine: +50% bombardment effectiveness; –30% combat speed

Doctrines require commitment and are visible to the player at fleet creation. They make fleet composition a front-loaded strategic choice rather than an emergent emergent result.

**Admirals:**

- Each fleet requires an Admiral (hired from a pool, similar to MOO2)
- Admirals have three attributes: Tactics (combat bonus), Navigation (speed/supply range), Logistics (supply efficiency)
- Admirals level up through combat only — not patrols
- Level-up traits are drawn from a visible list of 5 options; player picks one (no hidden randomness)
- Admiral death in battle is permanent; their fleet suffers a –20% morale penalty for 5 turns
- Famous admirals (5+ battles won) generate small empire-wide morale/reputation bonuses

**Experience:**

- Individual ships accumulate experience through combat
- Three tiers: Green, Seasoned, Veteran
- Veteran ships have +10% accuracy and +10% evasion
- Veteran ships are visually distinct (nameplate indicator)
- When a veteran ship is destroyed in battle, the player receives a notification (raising the emotional stakes of combat)

**Repair and Supply Lines:**

- Ships have a Fuel reserve (displayed as a percentage)
- Fuel depletes during FTL travel and extended patrol; replenished at any starport or waystation
- Ships below 30% fuel suffer –20% combat effectiveness
- Field Repair: ships can repair hull damage by stopping in a friendly system for 5 turns; structural repairs (replacing destroyed subsystems) require a shipyard
- Repair Tender (ship class): can repair other ships in any system, including enemy territory; fragile but strategically vital for long campaigns
- Supply lines: if a fleet operates more than 5 jumps from its nearest resupply point, it accrues Attrition at 2% health/turn. This can be addressed by building Waystations along the route or bringing a Repair Tender.

**Fleet Command Limit:**
- Each admiral has a Command Rating (starting 5, rising to 20 at maximum level)
- Command Rating = maximum number of capital ships in the fleet (fighters/escorts are not limited)
- Exceeding Command Rating reduces admiral bonuses but does not prevent the fleet from operating

---

## Cross-Cutting Design Notes

### On "No Cheating AI"

The research across all five games shows a common failure mode: AI empires that receive hidden production multipliers or pre-built structures the player cannot access. This is universally criticised when players discover it.

For Ex Nihilo, the AI must operate within the same engine. Difficulty settings should modify:
- AI decision-making speed (how many turns ahead it plans)
- AI starting position quality (better starting planets in Galaxy Generation)
- AI diplomacy aggressiveness
- AI research path efficiency (fewer "wasted" techs)

Never: AI production multipliers, hidden income bonuses, or free buildings.

### On Visible Systems

Every number in the game should be accessible within two clicks of where it matters. If a building costs 3 maintenance, the player should be able to see:
1. The cost on the colony panel
2. The aggregate maintenance on the empire finance panel
3. The projected "break-even" time on the build screen before confirming construction

### On Meaningful Tradeoffs

Each major system should have at least one **genuine dilemma** — cases where the optimal choice depends on your situation, not just your resource level:
- Pollution from industry vs. clean growth (faster economy vs. long-term habitability)
- High taxes vs. slower growth (more income now vs. more taxpayers later)
- Androids vs. organic population (productivity vs. happiness; androids don't vote and don't rebel, but they also don't innovate)
- Surveillance vs. civil liberties (espionage defence vs. morale)
- Specialise a planet vs. keep it balanced (peak output vs. resilience to attack)

---

## Sources

- [Colony structures — Official Master of Orion Wiki](https://masteroforion.fandom.com/wiki/Colony_structures)
- [Category: Master of Orion colony structures](https://masteroforion.fandom.com/wiki/Category:Master_of_Orion_colony_structures)
- [MOO2 Engineering — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Engineering)
- [MOO2 Growing your population — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Growing_your_population)
- [MOO2 Feeding your people — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Feeding_your_people)
- [MOO2 Strength through Joy — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Strength_through_Joy)
- [MOO2 Sociology — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Sociology)
- [MOO2 Power — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Power)
- [MOO2 Computers — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Computers)
- [MOO2 Espionage wars — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Espionage_wars)
- [MOO2 Technology tree — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Technology_tree)
- [MOO2 Summary of techs by level — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Summary_of_techs_by_level)
- [Terraforming — Official Master of Orion Wiki](https://masteroforion.fandom.com/wiki/Terraforming)
- [Megastructures — Stellaris Wiki](https://stellaris.paradoxwikis.com/Megastructures)
- [Ascension perks — Stellaris Wiki](https://stellaris.paradoxwikis.com/Ascension_perks)
- [Government — Stellaris Wiki](https://stellaris.paradoxwikis.com/Government)
- [Civics — Stellaris Wiki](https://stellaris.paradoxwikis.com/Civics)
- [Commander traits — Stellaris Wiki](https://stellaris.paradoxwikis.com/Commander_traits)
- [Planetary improvements — Galactic Civilizations Wiki](https://galciv.fandom.com/wiki/Planetary_improvements)
- [Espionage — Galactic Civilizations Wiki](https://galciv.fandom.com/wiki/Espionage)
- [Espionage — Galactic Civilizations III Wiki](https://galciv3.fandom.com/wiki/Espionage)
- [Crusade Diary 5: Spies and Saboteurs — Stardock](https://www.stardock.com/games/article/482106/crusade-diary-5-spies-saboteurs)
- [Government — Galactic Civilizations III Wiki](https://galciv3.fandom.com/wiki/Government)
- [Governments and Commonwealths — Galactic Civilizations Official Wiki](https://wiki.galciv.com/index.php/Governments_and_Commonwealths)
- [Trade (game feature) — Galactic Civilizations Wiki](https://galciv.fandom.com/wiki/Trade_(game_feature))
- [Economic strategies — Galactic Civilizations Wiki](https://galciv.fandom.com/wiki/Economic_strategies)
- [Stations — Sword of the Stars II Wiki](https://sotsii.fandom.com/wiki/Stations)
- [Sword of the Stars Complete Collection Review — Space Sector](https://www.spacesector.com/blog/2011/05/sword-of-the-stars-complete-collection-review/)
- [Ascendancy — Wikipedia](https://en.wikipedia.org/wiki/Ascendancy_(video_game))
- [Ascendancy Planet Building FAQ — GameFAQs](https://gamefaqs.gamespot.com/pc/575213-ascendancy/faqs/35419)
- [Master of Orion II — Wikipedia](https://en.wikipedia.org/wiki/Master_of_Orion_II:_Battle_at_Antares)
