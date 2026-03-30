# Director Decisions — Research Report Review

**Date:** 29 March 2026
**Source:** 4X Space Strategy Genre Deep Analysis report
**Format:** Domain-by-domain interview with the Director, capturing design decisions for Ex Nihilo

---

## Interview Progress

| # | Domain | Agent | Status |
|---|--------|-------|--------|
| 1 | Political System | Political Scientist | COMPLETE |
| 2 | Financial System | Economist | COMPLETE |
| 3 | Ground Combat | Ground Tactician | COMPLETE |
| 4 | Exploration | Exploration Director | COMPLETE |
| 5 | Population | Population Analyst | COMPLETE |
| 6 | Diplomacy | Chief Diplomat | COMPLETE |
| 7 | Espionage | Spymaster | COMPLETE |
| 8 | Colony Management | Colony Planner | COMPLETE |
| 9 | Ship Combat | Ship Combat Director | COMPLETE |
| 10 | Technology | Tech Researcher | COMPLETE |

---

## Domain 1: Political System

### P1. Emergent Political Factions from Demographics

**Decision:** APPROVED with modifications.

- **Faction origin:** Hybrid model. Each species starts with 2-3 pre-defined, lore-flavoured factions that feel natural for that race (e.g. Khazari Forge-Masters). After game start, faction landscape becomes demographics-driven and race-specific -- new factions can emerge and old ones can fade based on population shifts.
- **Faction count:** Dynamic, targeting 2-5 active factions per empire at any given time. Mirrors real-world political landscapes. Factions should be able to form and dissolve organically -- some are permanent fixtures, others are transient movements that rise and fall.
- **Faction agency:** Factions are ACTIVE agents, not passive modifiers. Escalation ladder:
  1. Lobbying and political influence (baseline)
  2. Funding and economic pressure
  3. Strikes and protests (when demands unmet)
  4. Coups and armed revolt (when desperate)
  - Factions pursue their objectives through their own actions if they cannot achieve them through legitimate political channels.

### P2. Elections and Government Legitimacy

**Decision:** APPROVED with deep election manipulation mechanic.

- **Election influence escalation ladder** (player tools, each step riskier):
  1. **Legitimate:** Campaign with your governor, call in favours, interpret rules strictly in your favour
  2. **Grey area:** Mild bias in vote counting, pressure groups to back you or stand down, steer financial penalties toward opponents
  3. **Clandestine:** Disappear opposition leaders, plant compromising fake evidence, sabotage campaigns, make parties illegal, invent criminal charges, ban parties, use spies to infiltrate factions and steer their decisions, assassination
  - Each tier carries increasing risk of discovery with escalating consequences (domestic unrest, diplomatic reputation, faction backlash)

- **Election results have real mechanical bite:**
  - Factions in power push policy aligned with their vision of what benefits the race -- not mindless obstruction
  - Examples: pacifists may force cessation of a war or defund unconventional weapons research; militarists may demand war declared on a rival; xenophobes may push for alien ejection, stricter controls, or even genocide
  - There is a genuine cost to losing an election -- the winning faction's agenda constrains the player's options
  - Faction demands must be internally logical and aligned with that faction's worldview

- **Hive Mind is NOT Uni-Mind:**
  - Key distinction: a hive mind composed of individuals who combine can still have preferences, tendencies, and internal disagreements -- they are not a single monolithic consciousness
  - Hive mind species should have a different flavour of internal politics -- perhaps competing neural priorities, regional cluster preferences, or subnetwork specialisations -- rather than skipping the system entirely
  - Only a true "Uni-Mind" (single entity) would have no internal politics; this should be rare or unique to one species at most

### P3. Revolution and Government Transition Mechanics

**Decision:** APPROVED -- revolutions are preventable, player-instigable, and context-sensitive.

- **Revolutions are preventable by addressing root causes:**
  - Key revolution drivers: inequality, population unrest, proportion of able-bodied aggressive elements, opposing ideological views, and foreign interference (influence operations or actively planned insurrections)
  - Grounded in Maslow's Hierarchy of Needs -- the demographic model tracks what matters: age distribution, vocations, wealth, happiness, protection, security, food abundance, financial security
  - If the player improves conditions across these dimensions, revolution pressure dissipates
  - Military suppression alone delays but does not solve -- the pressure cooker model applies if root causes are ignored

- **Player-instigated revolutions are allowed:**
  - A player stuck under a government that blocks their strategy (e.g. democracy refusing to declare war) can covertly fund and instigate a coup
  - HIGH RISK: if the player's chosen faction loses the revolution, that is a game-changing (potentially game-ending) consequence
  - This creates a genuinely tense strategic gamble -- subvert your own government with real stakes

- **Conquered planet revolution probability is context-dependent, NOT automatic:**
  - Factors that reduce rebellion: conqueror is a nicer species, treats population better than previous rulers, has aligned religion or similar beliefs, was careful to minimise civilian harm during the conflict, commits to rebuilding, rules justly, grants freedom and autonomy
  - Factors that increase rebellion: brutal conquest, cultural incompatibility, religious conflict, oppressive occupation policy, exploitation, foreign species imposing alien values
  - No blanket "conquered = rebellious" -- the system must evaluate the full context of how the population is being treated post-conquest

### P4. Propaganda and Censorship Buildings

**Decision:** APPROVED with clandestine building mechanic and nuanced propaganda consequences.

- **White-labelling and clandestine buildings:**
  - Some buildings can be disguised -- an intelligence HQ presents as a sardine canning factory, a spy training facility as part of a larger complex. "Shadow buildings" concept.
  - Not all covert buildings are suspicious -- some are simply embedded within legitimate structures (not all FBI offices are just for filing reports)
  - Espionage is required to discover clandestine buildings -- both your own counter-intelligence discovering foreign operations in your territory, and enemy spies uncovering your hidden facilities
  - Some buildings are openly known but distasteful (propaganda bureau); others must be hidden (black sites, censorship apparatus)

- **Propaganda has emergent, non-linear consequences -- no forced moral judgement:**
  - There is NO moral or objective truth in the game. Everything is relative.
  - The true cost of propaganda is not a simple "happiness penalty" -- it is the erosion of a population's relationship with reality
  - A population conditioned to disbelieve facts may develop strange belief systems that clash with future messaging the player needs them to accept
  - Populism relies on emotionality, not facts -- once a population is swayed by emotion, factual arguments become ineffective. This is the real long-term danger.
  - Heavy propaganda does not "backfire" by default -- but it reshapes the population in ways that may become uncontrollable
  - Education level matters: an educated population is harder to propagandise but also harder to manipulate through populism

- **Species-specific propaganda resistance:**
  - Psionic species (e.g. Vaelori) can perceive manipulation for what it is -- extremely difficult to influence or lie to
  - However, species that are resistant to propaganda may themselves be far better at wielding it against others
  - High-education species are naturally more resistant
  - Each species should have a propaganda susceptibility profile tied to their traits and cognitive abilities

### P5. Policy Sliders Within Government Type

**Decision:** APPROVED with 7 policy domains and a judicial/legislative pipeline.

- **Seven policy domains:**
  1. **Foreign** -- diplomatic posture, border policy, immigration, alliance strategy
  2. **Domestic** -- civil liberties, species rights, cultural policy, integration
  3. **Economic** -- tax rates, trade policy, subsidies, nationalisation vs privatisation
  4. **Political** -- voting rights, government transparency, censorship, party regulation
  5. **Education** -- research freedom (open vs directed), curriculum control, propaganda in schools
  6. **Health** -- healthcare access, population control, genetic policy, pandemic response
  7. **Security** -- military spending, policing level, surveillance, emergency powers

- **Policy changes follow a legislative pipeline, not instant switches:**
  1. **Declaration** -- policy is announced
  2. **Come into effect** -- institutional changes begin, bureaucracy adjusts
  3. **Enforcement** -- actual implementation with compliance mechanisms
  4. **Population adoption/challenge** -- citizens accept, adapt, resist, or revolt based on demographics and Maslow factors
  - This implies a judicial system is needed -- courts, legal frameworks, enforcement mechanisms
  - Radical policy shifts face longer pipelines and more resistance than incremental changes

- **Government type constrains available policy positions:**
  - Some policy extremes are locked out by government type -- a Democracy cannot enact slavery without first transitioning to a more authoritarian government
  - Government transition is itself a process: debate, acceptance, institutional change, enforcement
  - Any government CAN attempt to move toward extreme policies, but it requires transitioning government type first, which has its own costs and risks
  - This prevents "democracy with death camps" without removing player agency -- you can get there, but you must walk the path and face the consequences

---

## Domain 2: Financial System

### F1. Commodity Marketplace with Physical Logistics

**Decision:** APPROVED with two-tier market evolution and 35 commodities.

- **Two-tier market system that evolves with the Galactic Council:**
  - **Local markets (early game):** Each empire has its own local market -- narrow and shallow supply, primarily between government and private entities within the empire. Can also trade bilaterally with empires you have trade agreements with, limited to what each side actually produces.
  - **Galactic market (mid-late game):** As the Galactic Council forms and races join, a reserve currency emerges. Council members gain access to the galactic market. Over time, local currencies devalue as the council gains members -- non-member economies become increasingly marginalised.
  - True supply/demand dynamics drive both tiers. The galactic market is not a magic shop -- it reflects what member empires actually produce and consume.

- **All empires participate in the same market when eligible:**
  - AI empires trade on the same markets as the player -- no separate economies
  - Market manipulation is explicitly intended gameplay: buy up all supplies of a precious resource used in enemy weapons, flood the market with a commodity that is a rival's primary export to crash their economy
  - Access to the galactic market requires council membership -- a powerful incentive to join

- **35 commodities with tiered rarity:**
  - **20 common commodities** -- baseline economic materials, widely available
  - **10 rare commodities** -- scarce, geographically concentrated, strategically valuable
  - **5 ultra-rare commodities** -- critical for age-specific weapons, armour, shields, and key technological developments
  - Commodities must be tied to specific tech age requirements (e.g. anti-matter age weapons require ultra-rare X)
  - Price volatility driven by realistic supply/demand simulation: piracy, trade blockades, sabotage, sanctions, tariffs, scarcity, sudden wartime demand spikes crippling civilian supply

### F2. Corruption Scaling with Empire Size

**Decision:** APPROVED with multi-level corruption and root-cause modelling.

- **Corruption is driven by root causes, not arbitrary scaling:**
  - Primary drivers: inequality, poor enforcement and laws, political obfuscation, bureaucratic inefficiency
  - Some upside exists -- a pragmatic grey-leaning approach from the "good side" can balance well (greasing wheels, informal networks that bypass broken bureaucracy)
  - Corruption is primarily negative but not cartoonishly evil -- it is a systemic response to structural problems

- **Government and race-specific corruption profiles:**
  - Each government type has a baseline corruption susceptibility: hive mind near-zero, oligarchy high, democracy moderate, etc.
  - Each species has inherent cultural traits that affect corruption (some species may culturally normalise gift-giving, others may have near-zero tolerance)
  - The combination of government + species + conditions determines actual corruption levels

- **Corruption tracked at EVERY level, not just empire-wide:**
  - Individual planets have their own corruption levels (frontier colony with no oversight vs heavily policed capital)
  - Individual governors can be corrupt -- skimming funds, favouring cronies, embezzling
  - Individual admirals can be corrupt -- selling military supplies, taking bribes to look the other way
  - Empire-wide corruption is the aggregate, but the interesting gameplay is in the granular detail
  - This creates meaningful choices: do you investigate a corrupt but effective governor, or leave them in place?

### F3. Inflation and Currency Stability

**Decision:** APPROVED with full monetary policy toolkit and reserve currency transition.

- **Per-empire inflation driven by realistic economic factors:**
  - Inflation, government debt, taxation, interest rates, tariffs all factor into currency stability
  - Poorer economies suffer as the dominant galactic reserve currency takes hold -- their local purchasing power erodes
  - Empires with poor fiscal discipline see real consequences: galactic market imports become more expensive, trade partners demand premiums

- **Central bank policy tools available to the player:**
  - Central bank equivalent with interest rate adjustments
  - Austerity measures (spending cuts -- reduces services, may cause unrest)
  - Yield curve control (managing long-term borrowing costs)
  - Taxation levers (raise revenue but affect population happiness and economic activity)
  - Price controls available but cause shortages if overused
  - No single magic fix -- each tool has trade-offs rooted in real economics

- **Galactic Council reserve currency transition (Euro model):**
  - On joining, the council issues an equivalent currency allowance -- a conversion of local currency to reserve currency at a negotiated rate
  - The Galactic Council can issue loans to member empires, with interest rates based on reputation and reliability
  - Favoured members get good rates; notoriously unreliable empires may be refused credit entirely
  - Painful transition period as local prices adjust to the new currency -- some sectors benefit, others suffer
  - Creates a genuine strategic question: join the council for market access but surrender monetary sovereignty, or stay independent with a weaker but fully controlled currency

### F4. Loans, Debt, and Bankruptcy

**Decision:** APPROVED with debt-trap diplomacy, catastrophic bankruptcy, and war debt mechanics.

- **Inter-empire lending and asymmetric trade deals:**
  - Empires can lend to each other directly, creating debt-trap diplomacy -- a wealthy empire offers generous loans then uses debt as leverage ("vote with us or we call in your loans")
  - Asymmetric trade is fully supported: money for ships, military action in exchange for technology, territory for debt forgiveness -- everything can be up for negotiation
  - Loans require something logical as guarantee -- no unsecured lending into the void. No empire will sell all their food and starve themselves; there must be rational self-interest on both sides
  - Debt becomes a diplomatic weapon and a soft-power tool

- **True bankruptcy is catastrophic and potentially game-ending:**
  - Defaults, riots, civil war, government collapse
  - If the player's government collapses and the new government does not favour their rule -- game over
  - Desperate measures available before collapse: negotiate for aid, trade ships or even a planet for help, call on allies
  - Allies are tested in your time of need -- will they provide forces/resources to stabilise your government and rule, or abandon you? This reveals who your true allies are
  - Bankruptcy is not a soft reset -- it is a death spiral that must be actively escaped

- **War debt and the Galactic Bank (separate from Galactic Council):**
  - Galactic Bank and Galactic Council are SEPARATE institutions with potentially conflicting agendas
  - The bank will lend to BOTH aggressor and defender in a war -- it profits from conflict, provided the victor covers the loser's debts
  - The council wants peace regardless -- creating institutional tension between bank and council
  - Prolonged wars drain treasuries, forcing empires to take loans or sue for peace
  - Without a true war economy being established, war funding from reserves is short-term only
  - If both sides go bankrupt, they may collapse to a resource barter system -- unable to pay for even basic operations
  - Rich resource reserves can sustain a war effort but only temporarily without economic mobilisation

### F5. Corporate Entities and Private Interests

**Decision:** APPROVED with fully autonomous corporations that can become power players.

- **Corporations are autonomous entities, not player-controlled buildings:**
  - Autonomy level depends on government type -- free governments welcome free trade, tax it, and grow wealthy from it; authoritarian governments may nationalise or restrict
  - Corporations pursue their own profit motives independently
  - Monopolies and megacorporations can emerge naturally -- some may grow large enough to populate entire planets or moons and become vassal factions in their own right
  - Industrial espionage between corporations is fully active
  - The player regulates, taxes, and manages corporations -- not directs them

- **Cross-border corporate operations:**
  - Corporations can operate across empire borders based on policy and trade agreements
  - Tourism is an ideal cross-border corporate activity
  - Foreign corporations can be penalised, regulated, or covertly used for espionage
  - Nationalising a foreign corporation's assets in wartime is a valid (and provocative) move
  - Cross-border corporations create economic interdependence -- a double-edged sword

- **Corporations as political actors:**
  - Corporate interests influence government through lobbying and demanding policy changes
  - Corporations can fund specific political factions to push favourable policy
  - Megacorps that grow too powerful become a political problem -- regulatory capture, threatening capital flight if regulated
  - Creates a genuine governance tension: the wealth corporations generate vs the political power they accumulate

### F6. Economic Warfare

**Decision:** APPROVED -- primarily covert, cannot deliver a killing blow alone, piracy as multi-layered mechanic.

- **Economic warfare is predominantly clandestine, not declared:**
  - No formal "economic war" declaration -- cold war tactics add depth
  - Covert actions that would be unsavoury for public opinion or allied disposition are sometimes necessary
  - Tools: stealth purchases through shell companies, white-label merchants, shadow fleets, shrewd trading on the open market
  - It's all about what can be determined and proven -- if no one can prove it, it doesn't trigger diplomatic consequences
  - Overt sanctions and embargoes exist through the Galactic Council but these are public, political actions with visible consequences
  - The distinction between "shrewd trading" and "economic aggression" is deliberately blurred -- plausible deniability is the game

- **Economic warfare weakens but cannot alone defeat an empire (Cuba model):**
  - Decades of sanctions can leave an empire extremely poor and weak but not defeated
  - Economic strangulation degrades military capability, population happiness, infrastructure -- making the target vulnerable to other threats
  - But a determined population with resources can endure indefinitely, just miserably
  - Economics is a force multiplier and a weakening tool, not a victory condition by itself

- **Piracy as a three-tier mechanic:**
  1. **Criminal enterprise** -- independent pirates emerge naturally on poorly patrolled trade routes; a law enforcement problem
  2. **Clandestine operations** -- state-sponsored piracy with plausible deniability; fund pirates, minor races, or other empires to blockade trade, tax ships, harass merchants
  3. **Act of desperation** -- bankrupt or besieged empires turn to piracy as survival
  - Severe piracy has real consequences: trade routes rerouted around dangerous space or halted entirely
  - Letters of marque as a formal-ish mechanism for state-sponsored privateering
  - Getting caught sponsoring pirates creates major diplomatic fallout

---

## Domain 3: Ground Combat

### G1. Expanded Unit Types with Tech Prerequisites

**Decision:** APPROVED -- ground combat is a major pillar, equal to space combat. XCOM-style tactical system.

- **Tactical ground combat, not auto-resolve by default:**
  - XCOM-like grid system representing platoons (not individual soldiers), with terrain, cover, and weather
  - Auto-resolve only unlocks after the player has fought 10 similar battles (similar forces and numbers) -- earned through experience, not given freely
  - This ensures the player engages with the tactical system before being allowed to skip it
  - Ground combat is equally important to space combat -- it must be rich and tactical, not an afterthought

- **Unit designer for ground forces (ship designer equivalent):**
  - Design soldiers, mechs, robots, war machines using a component-based system analogous to the ship designer
  - Chassis (infantry frame, mech chassis, drone platform, heavy walker) + weapon loadout + armour + special equipment
  - Tech prerequisites gate advanced components -- same principle as ship components
  - Species-specific chassis and equipment options for flavour

- **Ground combat is a MAJOR PILLAR, not secondary:**
  - Equal investment in depth and complexity as space combat
  - Planetary conquest should feel as significant and tactical as a major fleet engagement
  - This is a key differentiator from competitors -- Stellaris, ES2, and most space 4X games treat ground combat as an afterthought and are criticised for it

### G2. Supply Lines and Attrition

**Decision:** APPROVED -- orbital superiority is an advantage not a verdict, defender supply advantage, civilian infrastructure matters.

- **Ground and space combat are coupled but not deterministic:**
  - Losing orbital superiority is a significant disadvantage but NOT an automatic loss for ground forces
  - Abandoned ground forces can fight on until reinforcements arrive or they actually take control and win
  - Air/orbital supremacy provides bombardment support, resupply, and reinforcement capability -- losing it removes these advantages but does not instantly doom the ground force
  - Creates tense scenarios: a ground army cut off from space, racing to secure victory before supplies run out

- **Defenders have inherent supply advantage:**
  - Especially true if they are prepared and this is not a surprise attack
  - Defenders benefit from existing infrastructure: stockpiles, logistics networks, local knowledge
  - Attackers can capture supply caches but they might not be compatible with their equipment -- alien munitions don't fit your weapons, alien food may be inedible for your species
  - Establishing attacker supply requires capturing key infrastructure (spaceports, warehouses) and adapting it -- time-consuming and vulnerable to counter-attack

- **Civilian infrastructure as tactical battlefield feature:**
  - Farms feed defenders. Factories produce munitions. Power plants keep shields and defences active.
  - Destroying infrastructure weakens the defence but damages the planet you're trying to conquer -- a meaningful trade-off
  - Blowing up power plants is rarely desirable unless you want to leave little worth conquering
  - This ties directly into war crimes mechanics -- deliberately targeting civilian infrastructure has consequences
  - The conqueror inherits whatever they leave standing

### G3. Terrain and Weather Effects

**Decision:** APPROVED -- real planet structures on tactical map, planet-dependent weather, species terrain advantages.

- **Tactical map generated from actual planet state:**
  - Buildings the player has constructed, terrain, weather, gravity -- all represented on the tactical battle grid
  - As close to real structures as possible -- this also improves the visuals for city building and planet detail views
  - The colony you build IS the battlefield you defend -- your building placement decisions have tactical consequences
  - Planet size and gravity affect movement speed, jump distance, weapon trajectories

- **Weather depends on planet conditions, not pure RNG:**
  - Atmospheric processors can moderate conditions -- making a planet like an air-conditioned environment with predictable, mild weather
  - Less hospitable planets without infrastructure have wretched, violent, and unpredictable weather
  - Ice planets: blizzards, whiteout conditions, hypothermia attrition
  - Volcanic planets: hot vents, seismic events, toxic gas eruptions
  - Storm worlds: lightning strikes can affect combat directly -- disabling electronics, hitting exposed units
  - The more developed and terraformed a planet, the more controlled the weather; raw frontier worlds are chaotic

- **Species-specific terrain and combat advantages:**
  - Drakmari (aquatic) fight better on ocean worlds; Khazari (volcanic) excel on volcanic worlds
  - Terrain, race, equipment, and war machines all factor into combat effectiveness
  - Species homeworld type gives a significant familiarity bonus on matching terrain
  - This makes species choice matter in ground combat doctrine, not just colonisation preference
  - Creates strategic depth: invading a Khazari volcanic colony is inherently harder than catching them on a terran world

### G4. War Crimes with Cascading Diplomatic Consequences

**Decision:** APPROVED -- no objective morality, evidence-based discovery, tribunal with limited enforcement power.

- **No objective moral judgement on WMDs -- everything is relative:**
  - There is no hardcoded "WMDs = bad" penalty. Context determines reaction.
  - Deploying WMDs against a hugely unpopular faction of slavers might pass with fanfare from the galaxy
  - Your own people may implore you to use WMDs in desperate circumstances
  - The galaxy's reaction depends on: who used them, against whom, what that faction's reputation is, who witnessed it, and the political climate
  - Fixed attitude penalties (e.g. "-40 for nukes") are WRONG for this game -- reactions must be contextual

- **Attitude system must NOT use flat time-decay for everything:**
  - Some wounds never heal. You will always remember the person who killed your dog for fun -- you will not be neutral 10 years later.
  - Betraying an ally who loses a world because you refused to support them: they will never forget
  - Different transgressions have different decay profiles: minor slights fade; existential betrayals are permanent
  - Species temperament matters: some species forgive more easily than others

- **War crimes require evidence, witnesses, and investigation:**
  - If there are no witnesses and no evidence, the crime may go undiscovered
  - "Fact-finding committees" take time, can be sabotaged, may be ineffective, or may lack proof
  - Espionage can uncover hidden war crimes -- or plant false evidence of crimes that never happened
  - Creates a "if a tree falls in the forest" dynamic -- what you can get away with depends on who is watching

- **Galactic tribunal exists but has LIMITED enforcement power (UN model):**
  - The Galactic Council is largely ineffectual, like the real UN -- it needs power to enforce, and power comes from member states
  - If you have an armada, how will they get you? They need your own people to turn you in -- but what if your people support you?
  - Available enforcement tools: taxation, trade route blockades, tariffs, sabotage, denied access to information, galactic bank asset freezes/confiscation
  - A powerful enough empire can simply refuse to comply -- but at the cost of isolation and economic pressure
  - Enforcement is messy, political, and inconsistent -- just like real international justice

### G5. Morale-Driven Outcomes, Not HP Bars

**Decision:** APPROVED -- morale-primary combat with POWs, insurgency, and commander influence.

- **Most combatants do not fight to the death:**
  - Morale collapse leads to surrender, not annihilation -- this is the primary battle resolution
  - Exceptions: robots fight to destruction, genetically enhanced biological killing machines fight to the death -- but regular people do not
  - POWs are a real game element with multiple options:
    - Release them (diplomatic goodwill, reputation)
    - Force into labour (production benefit, moral cost)
    - Imprison for later exchange in negotiations
    - Recruit turncoats (risky -- loyalty uncertain)
    - All prudent options should be available, named and with clear consequences

- **Defeated forces can transition to insurgency:**
  - Not all troops are captured -- some go into hiding
  - Remnants can become insurgents, guerrilla fighters, or future spies
  - Some may dissolve and lose the will to fight -- defeat breaks people differently
  - "Winning" a ground battle is NOT the same as "controlling" the planet
  - Ultimately the population must support your rule or they themselves become "the resistance"
  - Insurgency is a long-tail problem: the ground battle may last ticks, the occupation lasts indefinitely

- **Commanders and other factors directly affect morale:**
  - Commanders: a legendary general on the line keeps troops fighting past breaking point; losing your commander can trigger rout
  - Stimulants: chemical/pharmaceutical morale boosters (short-term benefit, potential long-term cost)
  - Health: wounded, sick, or starving troops break faster
  - Allies: fighting alongside allies boosts morale; being abandoned by allies devastating
  - Killing the enemy commander is a valid tactical objective -- special operations can target leadership

---

## Domain 4: Exploration

### E1. Planet Stat Uncertainty (Fog of Science)

**Decision:** APPROVED with tiered knowledge and misinformation.

- **Two-tier observation model:**
  - **Long-range observation (no scanning):** Only reveals what telescopes/sensors can detect at distance -- planet type, star class, rough size. No detail, no numbers.
  - **Active scanning:** Reveals specifics -- exact numbers, ruins, researchable phenomena, resource types and quantities, atmospheric composition, anomalies
  - The gap between "what we can see from afar" and "what we know after scanning" should be significant and rewarding

- **Some knowledge requires physical presence, not just scanning:**
  - Orbital scanning reveals surface and near-surface information
  - Archaeology, scientific experiments, and expeditions are required for deeper knowledge -- underground ruins, subsurface resources, biological specimens, alien artefact analysis
  - Creates a reason to invest in science ships AND ground expedition teams
  - Multi-stage knowledge gathering: observe → scan → land → excavate → experiment

- **Misinformation is a feature:**
  - Natural phenomena can produce false readings -- atmospheric interference, magnetic anomalies, subterranean shielding
  - Deliberate misinformation by design -- enemy empires could potentially spoof scanner results or mask planetary installations
  - A planet that scans as "barren" might hide life underground; a "resource-rich" reading could be a sensor ghost
  - Creates genuine value in better scanner technology and repeat surveys -- not just one scan and done
  - Trust in your intelligence is never absolute

### E2. Science Ship Modules and Scanner Equipment

**Decision:** APPROVED -- science modules on any ship, specialised vessels for advanced tasks, knowledge is competitive.

- **Science ships are ships equipped with scientific modules, not a separate hull class:**
  - Any ship with scanners can pick up basic readings
  - Specialised science vessels sacrifice weapons/defence slots for advanced scanner modules -- few weapons, light defences
  - Dedicated modules needed for specifics: population scans, minor race discovery, technological research through observation
  - Hull choice determines the trade-off: a scout with a scanner is lightly armed but fast; a dedicated research vessel is nearly unarmed but carries the full suite

- **Knowledge is competitive -- first-scanner advantage:**
  - Scanning a system first gives you exclusive access to that intelligence
  - You can exploit discoveries (excavation sites, resources, anomalies) before rivals even know they exist
  - Denying others what there is to excavate or learn is a valid strategy
  - Creates exploration races -- sending science ships to uncharted systems becomes a strategic priority, not just flavour
  - Espionage can steal scan data from rivals who got there first

- **Science ships have utility beyond scanning:**
  - Support the fleet: field repairs, damage assessment, electronic warfare
  - Tend to the wounded: medical ships reducing casualties after battle
  - Help free civilians: humanitarian missions during and after conflict
  - Deal with refugees: refugee transport and resettlement operations
  - Deploy research stations, monitoring probes, first contact protocols
  - Science ships as multi-role support vessels, not just "scan and move on"

### E3. Xeno-Archaeology and Excavation Sites

**Decision:** APPROVED -- archaeology as planetary activity + expedition, precursor breadcrumbs for Devourer, risky discoveries with player choice.

- **Archaeology is both a planetary activity and an expedition capability:**
  - Colonies can build archaeology buildings staffed by available scientists to excavate ruins on their own world
  - Off-world expeditions require a ship carrying an expedition team -- you need the ship first, then the team
  - Both approaches valid: local digs for colonised worlds, expedition ships for unclaimed or hostile territory
  - Multi-stage process: surface survey → initial dig → deep excavation → artefact recovery

- **Precursor ruins as Devourer breadcrumb trail:**
  - The precursor race was a vast galactic empire with 100+ worlds -- a civilisation far beyond any current species
  - They were close to finding a solution to the Devourers before being wiped out
  - Breadcrumbs come in varied forms: accounts, recordings, reports, physical evidence suggesting an even greater threat destroyed them despite their power
  - Clues reveal precursor capabilities -- spurring new research directions the player might not otherwise discover
  - The observant player who invests in archaeology gets early warning and potential technological head start
  - The unobservant player faces the Devourer reveal completely unprepared

- **Dangerous discoveries are player-choice, not forced punishment:**
  - Discoveries do NOT default to catastrophe -- the player gets a choice
  - Examples of risk-reward choices:
    - Research an extremely volatile power source: could be tamed for a breakthrough, or cause explosive damage
    - Study an engineered virus: learn from it for biological advances, but risk activation and loss of control
    - Activate a precursor device: gain alien technology, but it might attract attention or have unknown side effects
  - The player decides whether to pursue the risky path -- informed risk, not random punishment
  - Some of the most powerful technologies should only be accessible through dangerous discoveries

### E4. Space Phenomena with Unique Properties

**Decision:** APPROVED -- exploitable phenomena, dynamic galaxy, unique landmark systems.

- **Phenomena are exploitable, not just environmental flavour:**
  - Nebulae: sensor cover for ambush fleets, rare gas harvesting
  - Black holes: exotic material extraction with late-game tech, potentially power megastructures
  - Pulsars: radiation harnessed for weapons research or energy generation
  - Neutron stars: extreme magnetic fields for shield research or exotic manufacturing
  - Each phenomenon should have both a hazard aspect and an exploitation opportunity -- risk and reward

- **Some phenomena change over time -- the galaxy is not static:**
  - Stars can go nova (destroying or transforming systems)
  - Nebulae expand or dissipate, altering strategic cover
  - Black holes may consume nearby celestial bodies over long timescales
  - Binary systems with unstable orbits: planet temperatures shift over time, affecting habitability
  - Changes can be for better or worse -- a stable system might become dangerous; a hostile region might clear

- **A handful of truly unique landmark systems:**
  - One-off systems with occurrences that exist nowhere else in the galaxy
  - The Precursor Homeworld: their capital, the seat of a 100+ world empire, now ruins -- the richest archaeology site in the galaxy, potentially holding the key to surviving the Devourer
  - Other unique landmark ideas to develop:
    - A wormhole that leads somewhere that should not exist
    - A star that broadcasts an artificial signal on a frequency no current species can decode
    - A spatial anomaly where physics behaves differently -- time dilation, reversed entropy, matter behaving as energy
    - A living celestial body -- a moon or planet with detectable biological processes at planetary scale
    - A system perfectly preserved in stasis -- a snapshot of the moment the precursors fell
  - These landmarks become strategic objectives, narrative focal points, and sources of wonder

### E5. Narrative Exploration Event Chains

**Decision:** APPROVED -- species-specific branching, varied lengths, some competitive.

- **Event chains branch based on discovering species:**
  - Species-specific reactions and possibilities -- a Vaelori encountering a psionic anomaly has fundamentally different options from a Khazari finding the same thing
  - Different species unlock different branches, outcomes, and rewards from the same discovery
  - This massively increases replayability -- the same galaxy tells different stories depending on who explores it

- **Varied subplot lengths, not one standard format:**
  - Some chains are short encounters (2-3 steps) -- quick discoveries with immediate payoff
  - Some are mid-length investigations (4-6 steps) -- unfolding mysteries across multiple systems
  - Marquee chains are lengthy subplots (8-10+ steps) weaving through the campaign over hundreds of ticks
  - The variety of lengths keeps exploration feeling fresh -- not every discovery is the same commitment
  - Quality over quantity: 50 excellent hand-crafted chains across all lengths beat 500 generic ones

- **Some event chains are competitive between empires:**
  - Certain discoveries are detectable by any race with the right technology
  - Multiple empires can race to complete the same chain -- first to follow all clues claims the prize
  - Creates diplomatic tension: negotiate to share findings, sabotage a rival's expedition, or race them outright
  - Not ALL chains are competitive -- some are private discoveries unique to whoever finds them
  - Competitive chains should involve the most valuable prizes, incentivising investment in exploration

---

## Domain 5: Population

### D1. Wealth Distribution Model

**Decision:** APPROVED -- population group wealth, probabilistic instability, wealthy as political force.

- **Wealth tracked per population group, not individuals:**
  - Population groups have wealth levels that shift based on policy, economic conditions, and government type
  - Government type sets baseline distribution; policy, events, and economic performance shift it dynamically
  - Fits the Maslow framework: wealth determines which hierarchy levels a population group can satisfy

- **Extreme inequality creates increasing probability of crisis, not a hard threshold:**
  - No fixed "inequality = X triggers revolution" -- instead an escalating probability curve
  - As population unhappiness rises: 1% chance, then 2%, then 3%, and so on
  - This means bad conditions make crises increasingly likely but never guaranteed on a specific tick
  - Creates genuine tension: the player knows things are deteriorating but cannot predict exactly when it will break
  - Feeds directly into the political faction and revolution systems from Domain 1

- **Wealthy elites wield disproportionate political influence:**
  - Rich citizens fund political factions, lobby for lower taxes, buy favourable policy
  - Inequality begets more inequality -- wealth concentrates without active intervention
  - The wealthy are a political force, not just a demographic statistic
  - Creates a feedback loop the player must actively manage or accept the consequences of

### D2. Employment System

**Decision:** APPROVED -- vocation-specific jobs, multi-factor migration, automation as late-game transformation.

- **Jobs are vocation-specific, creating skills gaps:**
  - Buildings require specific vocations: factories need engineers, labs need scientists, hospitals need doctors, garrisons need soldiers, markets need traders, mines need labourers
  - A planet can have 50% unemployment while desperately needing scientists -- skills mismatch is a real problem
  - Training and education buildings convert general labourers into specialists over time
  - Creates meaningful workforce planning: what vocations does your empire need, and are you producing them?

- **Migration driven by multiple factors, not just employment:**
  - Employment availability is a primary pull factor
  - Wealth and standard of living attract migrants to prosperous worlds
  - Ease of access: well-connected trade route planets attract more migration than isolated frontier worlds
  - Attitude towards foreigners: xenophobic policy discourages immigration; open policy attracts it
  - Player policy can actively encourage immigration OR export professionals (brain drain / brain gain)
  - Creates natural population flows across the empire -- overcrowded jobless worlds bleed people to opportunity planets

- **Automation as a late-game transformative force:**
  - Robots, AI, engineered super-intelligences progressively automate vocations
  - Automation increases capabilities across the board: productivity, inequality reduction, lifespan, happiness, combat effectiveness
  - This is NOT presented as a purely negative "mass unemployment" dilemma -- automation can genuinely improve civilisation
  - The challenge is managing the transition: which vocations are automated first, how displaced workers are retrained or supported
  - A fully automated late-game civilisation looks fundamentally different from an early-game labour-dependent one

### D3. Healthcare and Disease

**Decision:** APPROVED -- species-specific disease, healthcare as loyalty lever, biological warfare as distinct WMD category.

- **Diseases are species-specific:**
  - A plague deadly to Teranos might be completely harmless to Khazari
  - Rare cross-species jumps possible for biologically similar species
  - Nanite and engineered diseases can potentially affect everything -- no biological immunity to nanotechnology
  - Multi-species planets are epidemiological complexity -- a disease harmless to the majority species could devastate the minority
  - Weaponisation potential: engineer a disease that only targets your enemy's biology

- **Healthcare is a major loyalty and Maslow lever:**
  - Healthcare policy exists on a spectrum: free and subsidised → semi-subsidised → expensive → non-existent
  - Good healthcare = grateful, loyal, productive population (physiological and security needs met)
  - Neglected healthcare = resentment, reduced productivity, vulnerability to pandemics
  - Ties directly into Maslow framework: healthcare addresses fundamental needs
  - Healthcare spending is a real budget item with real trade-offs against military, research, etc.

- **Biological warfare is a distinct WMD category alongside chemical and others:**
  - Biological: engineered plagues -- potentially more devastating than nuclear weapons, slower acting, harder to attribute
  - Chemical: area denial, incapacitation, contamination -- faster acting, more localised
  - Nuclear/conventional WMDs: immediate destruction, radiation aftermath
  - Each category has different deployment methods, timescales, consequences, and detectability
  - Biological warfare ties into espionage (covert deployment, attribution difficulty) and war crimes (if discovered)
  - The harder a weapon is to attribute, the more tempting it becomes -- and the more devastating the consequences if caught

### D4. Crime and Law Enforcement

**Decision:** APPROVED -- organised crime as active power player, state-criminal cooperation via intelligence, corruptible law enforcement.

- **Organised crime as a genuine power player:**
  - Cartels, syndicates, mafias that control territory, run smuggling operations, corrupt officials
  - Crime thrives in grey areas and lack of enforcement -- regimes that do not tackle it properly and consistently see it grow
  - Organised crime can become a political faction demanding legalisation or favourable policy
  - Not just a stat penalty -- active entities with territory, income, personnel, and agendas
  - Neglected long enough, organised crime becomes entrenched and extremely difficult to root out

- **State cooperation with organised crime through intelligence networks:**
  - The player can work with organised crime covertly via intelligence agencies (CIA armed Al-Qaeda model)
  - Use criminal networks as tools: smuggling embargoed goods, assassination networks, funding insurgencies in rival empires, running covert supply lines
  - Plausible deniability -- the state's hands stay clean while criminal proxies do the dirty work
  - Risk: criminal organisations used as tools may grow powerful enough to become uncontrollable
  - Creates morally complex gameplay: effective but dangerous alliances of convenience

- **Law enforcement itself is corruptible:**
  - Police and security forces are more resistant to corruption than other institutions but not immune
  - Bribed law enforcement creates a false sense of security -- crime statistics look good while actual crime flourishes
  - Anti-corruption and internal affairs institutions are necessary but unpopular (nobody likes being investigated)
  - Corruption within law enforcement is harder to detect and more damaging than civilian corruption
  - Creates a trust problem: how much can the player rely on their own security apparatus?

### D5. Age Pyramid Visualisation

**Decision:** APPROVED -- full demographic dashboard with working population simulation, policy goals, and trend projection.

- **Full demographic dashboard, not just an age pyramid:**
  - Age pyramid, employment breakdown by vocation, wealth distribution, faith distribution, loyalty heat map, crime rate, healthcare quality -- the complete picture
  - But not just numbers and charts -- a WORKING population simulation that makes sense:
    - Old people lean on healthcare and they die
    - Young people grow into working adults
    - Tight labour markets drive unemployment down; loose markets create joblessness
    - Inflation can push rich people into the middle class; economic booms can elevate workers
    - Every demographic shift has cause and effect -- the simulation must feel alive and logical
  - Rich detail that rewards the player who pays attention to their population

- **Demographic goal-setting through policy:**
  - The player can encourage specific vocational sectors through: policy direction, pay incentives, tax breaks, educational focus
  - "I want this planet to become a science hub" is achieved through education investment and research tax breaks, not a slider
  - Immigration policy can attract specific vocations from elsewhere in the empire
  - Goals are achieved indirectly through smart policy, not by directly assigning population

- **Trend projection as a player tool:**
  - "At current growth/aging rates, this planet will face a workforce crisis in 200 ticks"
  - "Healthcare spending insufficient for projected elderly population in 100 ticks"
  - "Education pipeline will produce enough scientists to staff planned research labs by tick X"
  - Give the player help to see where things are leading at the current pace
  - Projections are estimates, not guarantees -- events and policy changes alter trajectories

### D6. Multi-Species Integration Mechanics

**Decision:** APPROVED -- integration spectrum with formal processes, hybrid cultures, per-planet species rights.

- **Integration is a spectrum with formal milestones, not binary:**
  - Gradual process: initial distrust → cultural exchange → mixed communities → official recognition → protected minority status → naturalisation as a formal process → full cultural blending
  - Takes hundreds of ticks for deep integration -- not something that happens overnight
  - Some species pairs may never fully integrate due to biological incompatibility or fundamental value clashes
  - Formal recognition, protected minority status, and naturalisation as distinct policy milestones the player enacts
  - Each step on the spectrum has mechanical effects on loyalty, productivity, cultural output, and political dynamics

- **Hybrid cultures emerge from long-term integration:**
  - When species cohabit for long enough, new cultural forms emerge: hybrid art, blended philosophy, mixed-species institutions
  - This is how new cultures and peoples come to be -- a natural, historical process
  - Some species are highly resistant to cultural blending: hive mind slavers are unlikely to become Buddhists
  - Species cultural rigidity should be a trait -- some are naturally more adaptable, others fiercely insular
  - Hybrid cultures could eventually produce unique bonuses, buildings, or even new political factions

- **Per-planet species rights creating internal contradictions:**
  - Full citizenship on the cosmopolitan capital, restricted rights on a military border world, slavery on a mining colony -- all in the same empire
  - Unusual but historically human: different laws in different territories
  - Internal contradictions are exploitable: political factions, rival empires, and the oppressed populations themselves can point to the hypocrisy
  - Creates genuine policy tension: uniform rights are ideologically consistent but may not suit every world's circumstances
  - Espionage can reveal your differential treatment to the galaxy -- diplomatic consequences if your "enlightened capital" coexists with "slave mining colonies"

---

## Domain 6: Diplomacy

### DIP1. Dual-Channel Diplomacy (Genre First)

**Decision:** APPROVED -- confidence-level UI, player sets own public/private positions, diplomatic tells.

- **UI communicates the gap through confidence levels:**
  - Public stance is always visible and clearly displayed
  - Private position assessment shown with confidence rating: Very High, High, Medium, Low, Very Low
  - Confidence determined by diplomat skill, intelligence gathered, and observation duration
  - "They SAY peace but we THINK they're lying" conveyed through: stated position + assessed position + confidence level
  - Low-confidence assessments might be wrong -- the player must decide how much to trust their own intelligence

- **Player sets their own public and private positions:**
  - The player can declare something publicly while pursuing a different agenda privately
  - Public stance visible to all empires; private position known only to the player
  - Enemy diplomats and intelligence agents may detect inconsistencies based on their skill
  - If caught lying: trust is destroyed, potentially permanently -- the "betrayal never forgotten" principle from Domain 3
  - Maintaining a convincing false public stance requires effort: suppressing contradictory evidence, controlling information leaks

- **Diplomatic tells that skilled agents can read:**
  - Military buildup near borders contradicts peace declarations
  - Spy activity detected contradicts friendship claims
  - Economic sanctions preparation contradicts trade partnership rhetoric
  - Fleet movements, arms purchases, alliance negotiations -- all observable indicators
  - Skilled diplomats and intelligence agents read between the lines and reach conclusions based on gathered evidence
  - AI empires exhibit these tells naturally from their behaviour -- the intelligence system must flag them to the player

### DIP2. Grievance-Based Casus Belli System

**Decision:** APPROVED -- tiered grievance decay, justification required but relative, grievances tradeable.

- **Grievance decay is tiered by severity, not universal:**
  - Minor slights (border incursion, diplomatic snub): decay quickly
  - Medium offences (broken trade agreement, espionage caught): decay slowly
  - Major transgressions (genocide, existential betrayal): NEVER decay
  - Positive minor acts also hold temporary sway and decay -- a gift or favour fades from memory
  - This creates a realistic diplomatic memory: small things are forgotten, defining moments are permanent
  - Species temperament affects decay rates -- some species forgive more readily than others

- **Justification for war is required but relative, not rigid:**
  - A completely peaceful empire with no involvement in conflict and no threat is unlikely to go to war on a whim -- unless it is a complete dictatorship
  - The player needs to be close to a reason or drive to take action
  - Justification is contextual: what the galaxy considers "sufficient" depends on who you are, who the target is, and the political climate
  - Reasons can be fabricated through espionage -- but it's a slippery slope; if the fabrication is exposed, the consequences are severe
  - Government type affects flexibility: democracies need stronger public justification; dictatorships can act with less but face internal consequences

- **Grievances are tradeable and poolable:**
  - "The Khazari wronged us both -- let's combine our grievances and jointly declare war"
  - Allied empires can pool grievances for coalition wars against shared offenders
  - Creates diplomatic pre-war manoeuvring: building a coalition by finding common grievances
  - A skilled diplomat can assemble a galaxy-wide coalition against a universally disliked empire
  - Grievance trading can also be used cynically: "Support our war and we'll support yours"

### DIP3. Diplomat Characters

**Decision:** APPROVED -- trained through buildings, personal agendas, visible meeting summaries.

- **All character types recruitable from population AND trainable through special buildings:**
  - Soldiers, spies, diplomats, admirals, generals, governors -- all follow the same pattern
  - Special training buildings (Diplomatic Academy, Military Academy, Intelligence Academy, etc.) produce characters with varying quality
  - Species with natural aptitude produce better specialists more often (Teranos/Ashkari for diplomats, Khazari for military, Vaelori for research)
  - Character quality depends on: species aptitude, training building level, education level of the planet, and some randomness
  - Creates a reason to invest in training infrastructure -- the quality of your people depends on it

- **Diplomats have personal agendas that can conflict with the player's:**
  - A diplomat assigned to negotiate with the Sylvani might genuinely admire their culture and push for peace even when the player wants confrontation
  - A corrupt diplomat might be bribed by the other side -- feeding false intelligence back
  - Personal agendas can make or break negotiations: a well-aligned diplomat excels; a conflicted one may subtly sabotage
  - Loyalty and ideological alignment matter when assigning diplomats to relationships
  - The player must choose: the most skilled diplomat who disagrees with you, or a less skilled one who shares your goals?

- **Diplomatic interactions produce visible meeting summaries:**
  - When diplomats meet, a high-level summary event is generated based on the actions and choices made
  - "Our ambassador reports the Khazari delegation was tense and evasive" vs "The Sylvani ambassador seemed warm and receptive"
  - Summaries communicate the dual-channel system narratively -- the player reads between the lines
  - Summary quality and accuracy depend on diplomat perception skill -- a low-skill diplomat may misread the room
  - Creates a narrative layer over the mechanical diplomacy system

### DIP4. Galactic Community and Voting

**Decision:** APPROVED -- multi-factor voting power, advisory + binding resolutions, exit and rival blocs.

- **Voting power weighted by multiple factors, not just military/economy:**
  - Diplomatic reputation and class (education, capability in addressing differing opinions)
  - Belief system alignment with the resolution being voted on
  - Economic strength
  - Military strength
  - Declared future intentions
  - Reputation is paramount -- a small empire universally trusted and respected can wield more soft power than a large aggressive empire everyone fears
  - This rewards diplomatic investment, not just expansion

- **Both advisory and binding resolutions:**
  - Advisory resolutions carry moral weight and diplomatic consequences for ignoring them, but no direct enforcement
  - Binding resolutions require compliance -- non-compliance triggers sanctions, trade restrictions, or other enforcement mechanisms
  - Progression from advisory to binding as the council matures and gains legitimacy is natural
  - Binding resolutions are harder to pass (higher vote threshold) but carry real teeth

- **Empires can leave the council -- and form rival blocs:**
  - Withdrawal is always an option if an empire feels wronged, their vote doesn't matter, or the council acts against their interests
  - Leaving costs market access, diplomatic standing, and reserve currency benefits
  - RIVAL BLOCS: empires that leave can form an opposing council -- a competing power structure
  - Multiple competing blocs in a large galaxy with many races creates cold-war-style geopolitics
  - The galaxy may split into two or more rival institutions, each with their own market, currency, and rules
  - "Galactic NATO vs Galactic Warsaw Pact" -- or more complex multi-polar arrangements

### DIP5. Treaty Depth and Complexity

**Decision:** APPROVED -- fully customisable treaties, spirit-based judgement, secret treaties.

- **Treaties are fully customisable, not just predefined templates:**
  - Trade deals: ships for money, exchange of ideas, technology for resources
  - Mutual agreements: "mutual trade route protection", shared intelligence
  - Pacts: non-aggression, mutual defence
  - Alliances: information sharing, technology sharing, joint military operations
  - Bespoke treaties: "We'll give you 500 credits per tick and shipyard technology access if you declare war on the Nexari within 50 ticks"
  - Any combination of obligations, conditions, timelines, and triggers the player can construct
  - Template treaties available for convenience but full customisation always accessible

- **Treaty violations judged by spirit, not just letter:**
  - Minor infractions worsen relations, may lead to reciprocation, and have social consequences -- other races take heed
  - "If you punch my mate in the face I might just help him hit you back" -- third parties react to how you treat others
  - Context matters: a weak empire backing out of a major war it would perish in may be forgivable
  - Breaking a non-aggression pact in self-defence is different from breaking it for surprise invasion -- the galaxy judges intent
  - Reputation accumulates: a pattern of violations brands you as untrustworthy regardless of individual excuses

- **Secret treaties are fully supported:**
  - Two empires can sign secret agreements no one else knows about
  - Secret mutual defence: one is attacked, the other "surprisingly" joins -- revealed only in the act
  - Public treaties and private treaties can contradict: publicly condemn piracy while privately asking a trusted ally to raid a rival's shipping lanes
  - Secret treaties only discoverable through espionage
  - If exposed, the revelation itself becomes a diplomatic event -- trust shattered with those who were deceived

### DIP6. Espionage as Diplomatic Tool

**Decision:** APPROVED -- phased operations with modular deniability, false flag operations, deep human intelligence recruitment.

- **Espionage operations have preparation phases and modular deniability:**
  - Not instant: placing a spy takes time → building infiltration takes longer → executing a mission takes longer still
  - At each stage, counter-intelligence has a chance to detect and disrupt -- cat-and-mouse game
  - Modular operations using multiple agents create plausible deniability -- each agent only knows their piece
  - "Just a person delivering a vehicle. No idea there was top secret intel planted in it" -- compartmentalised operations where individual agents are genuinely ignorant of the larger mission
  - The more complex the operation, the more agents involved, the higher the risk of detection at any stage

- **False flag operations are a core capability:**
  - Create reasons that don't exist to suit your political agenda
  - Frame another race for your own actions -- destroy a third-party relationship while staying clean
  - Use against internal political enemies: fabricate evidence to discredit opposition factions
  - Use as pretext: manufacture an "attack" to justify military action against rioters, rivals, or undesirables
  - The Nexari discover a spy ring -- evidence points to the Khazari, not you. Nexari-Khazari relations destroyed.
  - High-risk, high-reward: exposure of a false flag operation is catastrophically damaging to reputation

- **Deep human intelligence through character recruitment:**
  - Any character can potentially be recruited as an asset: governors, generals, admirals, heads of research, spymasters
  - Recruitment vectors based on character vulnerabilities:
    - Ideological: the player takes actions that significantly disagree with their beliefs -- they become sympathetic to the other side
    - Coercion: families threatened, blackmail material
    - Vice: gambling problems, deviant behaviour, financial desperation
    - Disillusionment: passed over for promotion, personally wronged by their own government
  - Recruited assets can be double agents -- but also TRIPLE agents: a spy you think you've turned who is actually feeding you false intelligence
  - Layers of deception: the player can never be fully certain whose loyalty is genuine
  - Counter-intelligence must actively monitor your own people, not just enemy spies

---

## Domain 7: Espionage

### Espionage System Design

**Decision:** APPROVED -- secret budget, espionage menu with intelligence log, passive + active counter-intelligence.

- **Secret "Special Operations" budget:**
  - Espionage has its own budget line called "Special Operations"
  - Hidden from public accounts -- does not appear in standard economic reporting
  - Spy operations cost money that doesn't show in normal budgets
  - Creates a financial trail that counter-intelligence (yours or the enemy's) can follow if they look hard enough
  - Overspending on special operations may create discrepancies detectable by auditors or enemy agents

- **Espionage menu with intelligence log:**
  - Not a separate "war room" screen -- integrated into the espionage menu
  - A log of "the latest": faction situation reports (who is at war, who colonised a planet, fleet movements, diplomatic shifts)
  - Intelligence quality depends on infiltration level and agent skill
  - Information about various factions presented as known vs assessed vs unknown
  - A practical working tool, not an overwhelming data dump

- **Counter-intelligence is both passive and active:**
  - **Passive:** Buildings and infrastructure that increase baseline detection chance (security checkpoints, surveillance networks, encryption systems)
  - **Active:** Assigning counter-intelligence agents to investigate suspected leaks, sweep for surveillance devices, vet new officials, monitor communications
  - Both layers working together create a robust defence -- passive catches the careless; active catches the skilled
  - Active counter-intelligence requires dedicated personnel, creating a resource trade-off

---

## Domain 8: Colony Management

### Colony Planner: Core vs Frontier Worlds

**Decision:** APPROVED -- settlement progression tiers, auto-management option, emergent specialisation.

- **Settlement progression mechanic from foothold to planet-wide civilisation:**
  - **Habitat** -- tiny footprint, placeable on any world where you have a ship with an available team
  - **Settlement** -- habitat grows, other travellers and traders set up shop
  - **Colony** -- established via colonisation or coloniser ship, formal claim
  - **Small City** -- colony equivalent, first significant infrastructure
  - **City** -- a million strong, full infrastructure
  - **Metropolis** -- tens of millions, major economic/cultural centre
  - **Megatropolis** -- several connected metropolis cities, planet becoming densely developed
  - **Planet-wide population** -- the entire planet is urbanised/developed
  - Each tier unlocks new building slots, capabilities, and administrative options
  - Progression is organic based on population growth, infrastructure, and investment -- not arbitrary upgrade buttons
  - Auto-management available at player's preference -- set a planet to automatic at any tier

- **Governors are recruited or trained, gain with experience:**
  - Same pattern as admirals, generals, spymasters, heads of research
  - Recruitable from population with relatively low base skill that grows with experience
  - Trainable through special buildings (Administrative Academy) for higher starting skill
  - Governor personality affects management style: corrupt ones skim, militarists over-garrison, economists maximise output
  - Player can override governors but this should have consequences (undermining authority, reduced effectiveness, morale hit)

- **Specialisation is EMERGENT, not stamped:**
  - "Silicon Valley is not typically designed" -- organic specialisation through investment, not top-down designation
  - A planet becomes a research hub because the player built labs, attracted scientists, invested in education -- not because they clicked "Research World"
  - Forced specific heavy investment in planned specialisation can lead to massive failures from errors in planning and judgement
  - The system should recognise and reinforce emergent specialisation: a planet that has become research-heavy naturally gets efficiency bonuses from clustering
  - Players shape specialisation through policy, buildings, and incentives -- the planet's identity emerges from those decisions

---

## Domain 9: Ship Combat

### Ship Combat: Tactical Depth

**Decision:** APPROVED -- fleet strategies not battle cards, asymmetric weapon/defence triangle, combined arms fleet composition.

- **Fleet strategies and stances, NOT battle cards:**
  - No pre-battle card selection -- instead, assignable fleet strategies that govern tactical behaviour:
    - **Circular rotation** -- ships cycle in and out of range, fire and withdraw in sequence
    - **Close proximity** -- maximum damage engagement, enables boarding actions
    - **Skirmish** -- hit and run, maintain distance, harass
    - **Maximum range / kiting** -- stay at maximum weapon range, retreat when enemy closes
    - **Riker Manoeuvre** -- named tactical manoeuvres inspired by sci-fi (more to be developed)
  - Stances layer on top: aggressive, defensive, flanking, escort, etc.
  - Strategies are fleet-level standing orders that the player sets; tactical execution plays out based on those orders
  - The right strategy against the wrong enemy composition is devastating -- strategic choice matters

- **Asymmetric weapon/defence triangle (rock-paper-scissors-lizard-Spock):**
  - No perfect answers -- every weapon and defence has trade-offs:
    - Beam weapons: least effective against shields
    - Kinetics: least effective against armour
    - Missiles: least effective against speed, point defence, and ECMs
  - Player rewards themselves through clever tactics, not just correct loadout:
    - Use cover (nebulae, asteroids) against missile-heavy enemies
    - Surprise attack with cloaking technology
    - Exploit range mismatches, flank fixed-position defences
  - Scouting enemy fleet composition informs ship design -- but counter-design is not an instant win, just an advantage
  - The triangle creates tendencies and advantages, not hard counters

- **Combined arms fleet composition is essential:**
  - Carriers launching fighters; fighters protect carriers and support vessels
  - Electronic warfare ships disrupting enemy targeting
  - Repair/support ships keeping the fleet fighting longer
  - Scouts providing shared targeting information to the fleet
  - Shield-sharing technology: wounded vessels benefit from allied ships extending their shields
  - Fighters return to hangars for emergency repairs and ammunition reloads
  - Stacking battleships should be viable but brittle -- a diverse fleet adapts, a mono-fleet doesn't
  - Each ship role creates a reason to invest in variety rather than just maximum firepower

---

## Domain 10: Technology

### Tech System: Structure and Research Mechanics

**Decision:** APPROVED -- deliberate path with flavoured outcomes, species-unique tech + xenoresearch, risky discoveries with player choice.

- **Deliberate research path with randomised flavour:**
  - The player chooses direction and effort -- deliberate path-setting still works
  - But outcomes have variety: sometimes theoretical research yields little new data, sometimes it needs a proof-of-concept which may fail
  - Occasionally research leads to additional discoveries, temporary benefits, or unexpected breakthroughs
  - "Once in a blue moon something not so expected happens" -- surprise keeps research feeling alive
  - NOT Stellaris-style random card draw -- the player retains agency over direction
  - Flavour and surprise within a deliberate framework, not randomness replacing choice

- **Species-unique tech branches + xenoresearch as its own field:**
  - Each species has unique technologies that make sense combined with their traits (Vaelori psionic tech, Khazari volcanic forging, Nexari cybernetic integration)
  - Technology you can never develop yourself becomes a valuable trade commodity -- or a closely guarded secret
  - A specialisation no other race has creates asymmetric value: your unique tech is your bargaining chip
  - **Xenoresearch** as a dedicated field: studying technology from other races, potentially combining alien tech for unique hybrid benefits
  - Xenoresearch creates its own reward for conquering others (captured tech) or sharing technology (diplomatic exchange)
  - Reverse-engineering captured ships or artefacts feeds the xenoresearch pipeline
  - This makes every species encounter scientifically valuable, not just militarily or diplomatically

- **Technology carries risks with player choice:**
  - Players should have choices when risky discoveries emerge -- not forced into consequences
  - Examples:
    - Discover alien volatile power source: needs a POC that could explode, work, or both
    - Biological enhancement: unforeseen mutations, potentially beneficial OR harmful
    - AI research: risk of rogue AI that turns on its creators
    - Bioweapon development: crazed bioweapons that may be uncontrollable
    - Psionic amplification: may attract unwanted attention from entities better left undisturbed
  - The player decides whether to pursue the risky path -- informed gamble, not random punishment
  - The most powerful technologies should often carry the highest risks -- power has a price

---

## Cross-Domain Synergies

### Synergy 1: Demographics Drive Everything

**Decision:** APPROVED -- demographics as single simulation core, advisor-mediated visibility.

- **Demographics is THE single simulation core:**
  - Every tick, demographics update first -- all other systems derive their state from demographic data
  - Politics reads faction support from vocations, faith, loyalty distributions
  - Economy reads workforce availability from age and vocation distributions
  - Military reads recruitment pool from population and military vocation numbers
  - Social stability reads from happiness, loyalty, wealth, health
  - One source of truth rather than parallel simulations -- simpler to implement, more coherent in behaviour
  - Every system change traces back to a demographic cause

- **Causal chain visibility mediated through the domestic advisor character:**
  - A capable domestic advisor provides detailed explanations: "Militarist faction gained 12% because 3,000 workers retrained as soldiers due to your conscription policy"
  - An incompetent advisor gives vague or incorrect explanations -- the player sees effects but misunderstands causes
  - A double agent advisor may deliberately mislead: attributing unrest to the wrong faction, hiding the true cause of economic decline
  - The quality of your understanding of your own empire depends on the quality of the people you trust with that analysis
  - Creates a reason to invest in good advisors and protect them from enemy recruitment

- **Cascade visibility depends on advisor quality:**
  - A plague killing 30% of working-age population cascades across economy, politics, military, stability simultaneously
  - Sometimes you know exactly what the effects are (good advisor); sometimes you do not (poor advisor)
  - The player who invests in competent, loyal advisory staff has better situational awareness
  - An empire with compromised advisors may be flying blind during a crisis -- a devastating vulnerability

### Synergy 2: Trade Routes as Strategic Arteries

**Decision:** APPROVED -- trade routes as primary physical infrastructure, fortifiable chokepoints, constructable wormholes.

- **Trade routes are the primary physical infrastructure of the galaxy:**
  - Not just economic -- military supply, diplomatic couriers, migration, intelligence networks, disease transmission all travel the same wormhole routes
  - Control the routes, control everything -- this is one of the primary objectives in war
  - Blockading a chokepoint simultaneously cripples economy, cuts military supply, halts migration, disrupts intelligence, and creates a diplomatic crisis
  - A single infrastructure network carrying all traffic creates natural strategic interdependence

- **Chokepoint systems are identifiable and fortifiable:**
  - As later tech is discovered, the entire galaxy becomes observable -- chokepoint identification is a matter of time
  - Players can see "this system connects 3 major trade routes" and invest accordingly
  - Fortification options: starbases, fleet deployment, minefields, sensor arrays, customs checkpoints
  - Chokepoints become the most strategically valuable real estate in the galaxy
  - Wars may be fought specifically to control a single chokepoint system
  - Economic value (tariffs, customs) + military value (defence) + intelligence value (monitoring all traffic)

- **Wormhole routes are both discoverable and constructable:**
  - Exploration can discover natural wormhole routes that bypass enemy chokepoints -- a major strategic find
  - **Artificial wormhole construction** available in the Singularity age -- late-game tech that reshapes the strategic map
  - Building a new route bypasses established chokepoints, creates new trade opportunities, and fundamentally alters the balance of power
  - Wormhole construction should be expensive, slow, and visible -- enemies will know you're building one and may try to stop you

### Synergy 3: War Crimes Cascade

**Decision:** APPROVED -- contextual cascades, perpetrator population effects, permanent but healable galactic scars.

- **Cascades are contextual, matching the "no objective truth" principle:**
  - The same action in different contexts creates different cascades
  - Nuking a genocidal invader on your homeworld: galaxy sympathises (no diplomatic penalty), your people support it (minimal political backlash), survivors still traumatised (population trauma real), reputation enhanced ("did what was necessary")
  - Nuking a defenceless colony for resources: universal condemnation, internal political crisis, permanent reputation stain
  - Every cascade evaluates: who did it, to whom, why, who was watching, and what the political climate is

- **Perpetrator's own population is affected:**
  - Soldiers who deployed WMDs may suffer PTSD-equivalent effects -- reduced effectiveness, morale damage
  - Scientists who built the weapons may defect, protest, or refuse further work
  - The perpetrator's population may become hardened (normalised to atrocity, future use easier but society coarsened) OR traumatised (demanding peace, anti-war faction surges)
  - Species temperament determines which way it goes -- some species are culturally inured to violence, others are deeply affected
  - Repeated use has cumulative effects on the perpetrator's own civilisation

- **Permanent galactic scars that can eventually be healed:**
  - A nuked planet remains irradiated for centuries. A bioweapon outbreak zone is quarantined. These scars are visible on the map.
  - Scars affect colonisation viability, trade route desirability, and narrative -- a monument to what was done
  - BUT late-game technology can undo the damage: decontamination, terraforming, ecological restoration
  - A "lost world" can one day be rebuilt and colonised -- redemption is possible but expensive and slow
  - The effort to heal a scar may itself become a narrative moment: "We restored what was destroyed"

### Synergy 4: Exploration Fuels Everything

**Decision:** APPROVED -- rare galaxy-wide discovery events, belief-challenging finds, exploration eras.

- **Major discoveries can become galaxy-wide events, but rarely:**
  - Not every find makes galactic news -- most discoveries are private intelligence
  - But truly significant finds ripple outward: a defence-boosting element, a resource with multiple applications, precursor galactic origins
  - Information leaks through trade route gossip, rival spies, and merchants -- keeping a major find secret is hard
  - Galaxy-wide discovery events become sources of conflict: everyone wants the system, creating diplomatic crises and potential wars
  - Rarity is key -- if every discovery is galactic news, none of them feel special

- **Some discoveries challenge established beliefs:**
  - A Theocracy discovers precursor ruins contradicting their creation myth
  - A hive mind encounters evidence that individual consciousness may be superior
  - In some cases, the player faces a choice: acknowledge scientific truth (destabilising faith and politics) or suppress the discovery (maintaining social stability but losing knowledge)
  - Not every discovery is belief-challenging -- but when it happens, it should be a defining moment
  - How a civilisation responds to uncomfortable truths says everything about what they are

- **Exploration has distinct eras that feel different:**
  - **Early game:** nearby systems, basic scanning, first contact, claiming territory
  - **Mid-game:** deep space expeditions, anomaly investigation, precursor archaeology, xeno-research
  - **Late-game:** extragalactic signals, dimensional phenomena, the unknown beyond the map edge, Devourer foreshadowing
  - Each era introduces new exploration mechanics and content -- the activity evolves, never becomes stale

### Synergy 5: Corruption as Universal Entropy

**Decision:** APPROVED -- corruption driven by conditions not inevitable, hidden dimension via advisor reliability, tolerable corruption band.

- **Corruption is driven by conditions, not pure entropy:**
  - Root causes: poor enforcement, inequality, lack of transparency, foreign interference
  - A disciplined population with good institutions is NOT naturally prone to corruption -- it is not inevitable
  - But over time, without maintenance, corruption rates increase and become entrenched
  - Long-established corruption is extremely hard to remove -- it embeds itself in institutions, culture, and expectations
  - The model is not "always growing" but "grows when conditions allow, entrenches if neglected"
  - Species discipline and cultural traits affect baseline susceptibility

- **Corruption has a visible vs hidden dimension:**
  - The player might think corruption is low because reports say so -- but corrupt officials write flattering reports
  - Only independent audits, whistleblowers, or enemy intelligence revealing your own corruption gives the true picture
  - Ties directly into the advisor reliability system from Synergy 1: compromised advisors hide corruption
  - A player who never invests in internal oversight may be governing a deeply corrupt empire without realising it
  - The most dangerous corruption is the kind you don't know about

- **Some corruption is tolerable and even strategically useful:**
  - Zero corruption means a rigid, heavily surveilled police state -- not necessarily desirable
  - A small amount of corruption provides flexibility: workarounds, informal networks, goods that sanctions deny
  - Sometimes the player may deliberately encourage black market activity because it helps the spy network or increases plausible deniability
  - An "optimal corruption" band exists where the system is flexible without being dysfunctional
  - The player's choice: how much disorder they tolerate in exchange for the benefits it provides

### Synergy 6: The Three-Source Information Model (Director Addition)

**Decision:** NEW -- the player governs through three information channels, each independently fallible.

- **Three sources of truth, each potentially unreliable:**
  1. **Systems** -- automated reports, dashboards, economic readouts, sensor data. Objective in principle but can be manipulated (hacked, fed false data, poorly calibrated, sabotaged by enemy agents)
  2. **Advisors** -- domestic advisor, military advisor, intelligence chief, economic advisor. Subjective interpretation of data. Can be incompetent, corrupt, compromised, or brilliant
  3. **Reality** -- what is actually happening on the ground. The player may never see this directly except through the other two channels -- unless they investigate personally (send a trusted agent, visit a planet, conduct an independent audit)

- **Triangulation is how you govern well:**
  - When all three agree: high confidence the information is accurate
  - When systems and advisor disagree: something is odd -- either the systems are manipulated or the advisor is lying
  - When systems show one thing but reality (discovered through investigation) shows another: someone is feeding false data into the systems
  - The player who cross-references and questions discrepancies governs well; the player who trusts blindly is vulnerable

- **Trust, discipline, structure, and reliability are governance fundamentals:**
  - How you treat those closest to you determines their loyalty and honesty
  - A ruler who punishes bad news gets advisors who only deliver good news -- until reality crashes through
  - A ruler who rewards honesty and protects whistleblowers gets accurate information
  - Loyalty is earned, not assumed -- and it can be lost through neglect, cruelty, or indifference
  - The entire information model reinforces the game's core philosophy: there is no objective truth handed to the player; truth must be actively pursued and earned

---

## Follow-Up Decisions (30 March 2026)

### Tick-to-Time Mapping

**Decision:** 1 tick = 1 day. Ground combat ticks = 1/100th of a day.

- Each game tick represents one day
- Ground combat operates at 100x resolution: each ground combat tick = ~14.4 minutes
- Time advances during ground combat -- the galaxy does not pause while a battle plays out
- This means: elections happen over ~365 ticks (1 year), demographics age over ~25,000 ticks (70 years), treaties last meaningful durations

### UI Priority

**Decision:** Build all UI screens, in this order:
1. Economy/Market screen (commodity marketplace, trade routes, inflation)
2. Political factions panel (faction support, demands, elections, policies)
3. Espionage expanded missions (6 new mission types, diplomatic intelligence)
4. Planet demographics dashboard (age pyramid, wealth, employment, crime, healthcare)
5. Then all remaining systems

### Settlement Tier Visuals

**Decision:** Visual differentiation by density, lights, and label.
- Building density increases with tier (sparse habitat → sprawling megatropolis)
- City lights visible from space view at city tier and above
- Settlement tier label displayed in planet info (e.g. "Metropolis" or "Colony")
- Each tier should feel visually distinct when viewing the planet

### Auto-Resolve Battle Criteria

**Decision:** Similar = composition + size + terrain. Historical average as outcome predictor.
- "Similar" means: similar unit composition, similar unit size, on similar terrain
- Auto-resolve outcome based on historical average of the last 10 matching battles in that game session
- This makes auto-resolve a learned shortcut, not a generic formula
- Later enhancement: full AI battle simulation option (AI plays both sides tactically)

### Galactic Organisations (replaces "Galactic Council" single-body model)

**Decision:** Multiple competing galactic organisations, not one monolithic council.

- **Formation requires only 2 members** — any two empires with complex diplomatic communication technology can propose forming a galactic organisation
- **Default benefits of membership:** non-aggression pact and basic trade partnerships between all members
- **Multiple organisations can coexist and compete:**
  - "Galactic Council", "Galactic Federation", "United Worlds League", etc. — each with a distinct name for differentiation
  - Organisations are like real-world power blocs: USA forming NATO vs USSR forming the Warsaw Pact
  - Members can leave one organisation and join another
  - Organisations can merge into a single body if all members agree
  - Competing organisations may have different rules, currencies, and markets
- **Naming:** Each organisation gets a unique procedural or player-chosen name to distinguish it
- **Historical parallel:** Like states forming the United States vs Russia/Ukraine/Belarus forming the USSR — voluntary coalitions with distinct character and rules
- **One empire can only be a member of one organisation at a time** (must leave before joining another)
