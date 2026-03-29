# Endless Space 2 -- Gameplay Mechanics Research

**Game:** Endless Space 2 (2017) by Amplitude Studios
**Genre:** 4X Turn-Based Space Strategy
**Purpose:** Reference for Ex Nihilo game design inspiration

---

## 1. Political System

### How It Works in ES2

ES2 features a Senate-based political system with **6 political parties**, **5 government types**, and a **law** mechanic that provides empire-wide bonuses.

#### The Six Political Parties

| Party | Focus | Allies | Enemies |
|---|---|---|---|
| **Industrialists** | Production, colonial expansion, strategic resources, ship health | Militarists, Scientists | Ecologists |
| **Scientists** | Research speed, bypassing era limits, reduced improvement costs, ship movement | Industrialists, Pacifists | Religious |
| **Pacifists** | Diplomacy cost reduction, trade revenue, luxury bonuses, force-peace | Scientists, Ecologists | Militarists |
| **Ecologists** | Environmental sustainability, lower-impact policies, population management | Pacifists, Religious | Industrialists |
| **Religious** | Faith-driven bonuses, cultural influence, approval | Ecologists, Militarists | Scientists |
| **Militarists** | Warfare bonuses, manpower, fleet power, conquest rewards | Industrialists, Religious | Pacifists |

Each population unit has a political leaning. The composition of your empire's population directly determines the makeup of your Senate. Actions you take (building military ships, researching techs, signing treaties) also shift political alignment.

#### Government Types

| Government | Parties in Power | Law Slots | Senate Representation | Special |
|---|---|---|---|---|
| **Democracy** | 3 | 3-6 | 1 senator per population per system | Most laws, least control over elections |
| **Republic** | 2 | 2-4 | 1 senator per population per system | Enhanced law effects |
| **Federation** | 2 | 2-4 | 1 + (3 x System Level) per system | More control over results |
| **Dictatorship** | 1 | 2 (1 forced) | 1 + (3 x System Level) per system | Absolute control; enhanced forced law |
| **Autocracy** | 1 | 2 (1 forced) | 1 + (3 x System Level) per system | Similar to Dictatorship |

Government types are unlocked by researching technologies in the Empire Development tree. The starting government is faction-dependent.

#### Elections and Laws

- **Elections occur every 20 turns.** The party composition is recalculated based on population and actions taken.
- **Political experience:** Parties earn XP while in power and level up after winning elections. Higher levels unlock higher-tier laws.
- **Laws cost Influence per turn** to maintain (except Independent Party laws, which are always free).
- **Power Level Laws** are automatically enabled when their associated party is in power.

#### Government Change

Researching "Xeno Anthropology" (ring 3 of Empire Development) allows mid-game government changes. Changing government triggers an immediate election.

### What Makes It Compelling

- **Emergent political tension:** Your population's political makeup can shift against your preferred playstyle. A warmongering empire may see Militarists rise, which is useful but may squeeze out Scientists you need for research.
- **Meaningful trade-offs:** More democratic governments give more law slots but less control. Dictatorships give precise control but fewer options.
- **Laws create build diversity:** Different parties enable different empire-wide bonuses, encouraging you to shape your population to match your strategy.
- **Population is political:** Every pop unit votes. Colonising a system with a different species changes your Senate composition.

### Criticisms

- **Political volatility:** Players complained that elections could dramatically shift party composition, invalidating active laws and disrupting strategies.
- **Lack of transparency:** It is often unclear why political shifts happen, making the system feel random rather than strategic.
- **Shallow party differentiation:** Despite 6 parties, the bonuses feel like percentage tweaks rather than fundamentally different governance styles.
- **Laws are passive:** You enact them and forget -- no ongoing decisions, crises, or policy dilemmas.

### Application to Ex Nihilo

- **Adopt the population-as-voters concept** but make it more transparent. Show exactly why political sentiment is shifting.
- **Consider a simpler 3-4 party system** to avoid dilution (e.g., Expansionist / Isolationist / Militarist / Scientific).
- **Add active political events:** Rather than just passive laws, have political crises, referendums, and policy choices that create meaningful dilemmas.
- **Government types should have gameplay-altering consequences**, not just stat tweaks. A Democracy might have slow but stable decisions; a Dictatorship might be fast but generate unrest.

---

## 2. Population System

### How It Works in ES2

Population is the core economic engine. Each population unit (pop) occupies a slot on a planet and contributes to FIDSI output.

#### Growth Mechanics

- Systems use **Food** to grow new population (except Riftborn, who build pops with Industry).
- Growth threshold: a new pop is born when the food stock hits **+300**; starvation occurs at **-300**.
- The type of new pop is semi-random:
  - Each pop type has a **+50 base chance** of being selected as the next growth.
  - Fulfilling a pop's demanded **luxury resource doubles** the chance to **+100**.
  - The ratio of existing pop types in the system also influences selection.

#### Species Diversity

- Every faction has a unique primary population type with distinct FIDSI bonuses and penalties.
- Multiple species can coexist in a system, each contributing different bonuses.
- Each pop type demands a specific **luxury resource**. Satisfying it **doubles their bonuses**.

#### Approval (Happiness)

Approval ranges from 0-100% with five status levels:

| Status | Approval Range | Effect |
|---|---|---|
| **Ecstatic** | 85-100% | +30% Dust, +30% Science across empire |
| **Happy** | 65-84% | +15% Dust, +15% Science |
| **Content** | 35-64% | No bonus or penalty |
| **Unhappy** | 11-34% | FIDSI penalties |
| **Mutinous** | 0-10% | System rebels, massive FIDSI loss |

**Major approval penalties:**
- **Overcolonisation:** -10 happiness to every system per system over your colonisation limit
- **Overpopulation:** Penalty when a system exceeds its planet capacity
- **Ownership change:** Massive penalty when conquering or trading for a system

#### Population Movement

After building a System Development Project, a **Spaceport** becomes available. Pops can be moved to the Spaceport and shipped to another colonised system, allowing manual population redistribution.

### What Makes It Compelling

- **Species diversity creates texture:** Different pops on the same planet create different output profiles, making colonisation choices meaningful.
- **Luxury resource demand creates economic pressure:** You need specific luxuries to maximise specific pop types, driving trade and expansion.
- **Approval acts as a natural expansion limiter:** You cannot expand infinitely without investing in happiness infrastructure.
- **Population migration adds a logistics layer** without being overwhelming.

### Criticisms

- **Growth feels samey mid-to-late game:** Once you have food infrastructure, growth becomes autopilot.
- **Species management is micro-heavy:** In large empires with 12+ species, tracking which luxuries each needs becomes tedious.
- **Overpopulation/overcolonisation penalties feel punitive rather than strategic.** They are flat penalties rather than interesting problems to solve.
- **Pop selection randomness is frustrating.** You cannot directly choose which species grows next (only influence probabilities).

### Application to Ex Nihilo

- **Keep multi-species population** but simplify luxury demand. Perhaps species have broad preferences (e.g., "organic luxuries" vs "synthetic luxuries") rather than specific ones.
- **Make growth feel different per planet type.** Fertile worlds should boom; harsh worlds should trickle. This creates natural specialisation.
- **Replace flat overcolonisation penalties** with scaling governance costs (more systems = more bureaucracy = more Influence/Dust needed).
- **Allow direct pop assignment/migration** rather than random growth selection. Player agency over population composition is more fun than probability management.
- **Tie approval to specific events and decisions**, not just abstract numbers. "Your colonists on Kepler-7 are unhappy because you raised taxes" is more engaging than "-10 from overcolonisation."

---

## 3. Combat System

### How It Works in ES2

Combat is split into **space battles** (fleet vs fleet) and **ground battles** (invasion of systems).

#### Space Combat

**Fleet Organisation:**
- Fleets are limited by **Command Points** (CP). Each ship role costs CP:
  - Attacker/Protector: 1 CP each
  - Hunter/Coordinator: 3 CP each
  - Carrier: 6 CP
- At combat start, ships are arranged into **flotillas** across **three lanes** (Top, Centre, Bottom):
  - Centre lane: always open
  - Top lane: requires 5+ ships in fleet (minimum 2 in lane)
  - Bottom lane: requires 10+ ships in fleet (minimum 3 in lane)

**Three Battle Phases:**
Each phase lasts 40 seconds. Flotillas advance through range tiers:
1. Phase 1: Long range
2. Phase 2: Medium range
3. Phase 3: Short range (melee)

The actual starting and ending ranges depend on the **battle tactics cards** chosen by each player. Two opposing flotillas start at the furthest range between their two cards and move closer by one range per phase.

**Weapon Types (7 total):**

| Weapon | Type | Best Range | Short/Med/Long Accuracy | Penetration (Hull/Shield) | Special |
|---|---|---|---|---|---|
| **Kinetics** | Projectile | Short | 85/50/10% | 20/50% | Adds Flak (anti-missile) |
| **Slugs** | Projectile | Short | Similar to kinetics | Similar | Kills up to 3 crew per hit |
| **Missiles** | Projectile | Long | 25/50/100% | 10/60% | Can be shot down by Flak |
| **Swarm Missiles** | Projectile | Long | Same as missiles | Same | Fires 10 per shot, overwhelms Flak |
| **Lasers** | Energy | Medium | 50/100/50% | 80/10% | Higher critical chance |
| **Beams** | Energy | All | 100/100/100% | High hull pen | Consistent but lower damage |
| **Railguns** | Energy | Long | Near-perfect at Long, poor otherwise | Full pen (ignores both) | More effective vs large ships |

**Defence Types:**
- **Shields:** Block projectile weapons (kinetics, missiles)
- **Hull Plating (Armour):** Blocks energy weapons (lasers, beams)

This creates a **rock-paper-scissors** dynamic: missiles beat shields-only builds, kinetics provide flak against missiles, lasers bypass shields but are stopped by armour, etc.

**Battle Tactics Cards:**
- Each fleet picks a tactic card before battle begins.
- Default cards: Turtle, Power to Shields, Take Trophies, Gravity Distortion, Plasma Distortion.
- Unlockable cards from Military tech tree add options like Full Reserves (multiple engagements per turn), critical damage bonuses, repair protocols.
- Cards determine: (a) range each flotilla targets, (b) offensive/defensive/post-battle bonuses, (c) squadron split (attack-focused = 70/30 offence/defence; defence-focused = 30/70).

**Squadron Mechanics:**
Fighter squadrons can be launched from Carriers. Their offence/defence split is determined by the tactic card played.

#### Ground Combat

**Manpower System:**
- A percentage of Food output converts to **Manpower** each turn.
- Manpower fills system garrisons and ship reserves.
- Ships carry manpower for invasions.

**Siege:**
- A fleet orbiting an enemy system with no opposing fleets automatically **lays siege**, draining defensive manpower each turn without collateral damage.

**Ground Battles:**
- Attacker deploys manpower (default Deployment Limit: 500 per turn).
- Manpower converts to troops:
  - **Infantry:** 5 manpower per unit -- standard
  - **Armour:** 15 manpower per unit -- counters infantry, weak to aircraft
  - **Aircraft:** Most expensive -- counters armour, best endgame unit
- Attacker and defender choose **tactics** each turn (Blitz, Guerrilla, etc.).
- Battles can last multiple turns until one side's manpower is depleted.

**Invasion Outcomes:**
- **Occupy:** Take control of the system (default)
- **Pillage:** Destroy improvements, steal resources
- **Purge:** Destroy all colonies (Umbral Choir special)

### What Makes It Compelling

- **Ship design matters enormously.** The weapon/defence rock-paper-scissors means you must scout enemy fleets and counter-build.
- **Tactics cards add pre-battle decision-making** without requiring real-time micro.
- **Range mechanics create strategic depth.** A missile fleet wants to stay at long range; a kinetics fleet wants to close. The tactic cards determine who gets their preferred range.
- **"Nosebreaker" strategy:** Concentrating 24 of 25 CP into one lane vs an opponent's three-lane spread creates a 24 vs 8 matchup, rewarding fleet composition knowledge.
- **Ground combat is simple but present.** It is not the focus but adds a meaningful siege/invasion layer.

### Criticisms

- **Combat feels hands-off.** Once you choose your tactic card, you watch. No mid-battle decisions.
- **Late game becomes "whoever has more ships wins."** Fleet composition matters less when one side has overwhelming numbers.
- **Battle tactics cards are poorly balanced.** Many cards are clearly inferior, reducing meaningful choice to 2-3 viable options.
- **Ground combat is an afterthought.** The troop type triangle (infantry/armour/aircraft) is too simple.
- **Combat animations are beautiful but repetitive** and slow down gameplay in the late game.

### Application to Ex Nihilo

- **Keep the three-phase range system** (long/medium/short). It creates natural weapon specialisation niches.
- **Make battle tactics more impactful and numerous.** Consider 8-12 tactics with clear trade-offs rather than 5 defaults with unlockable upgrades.
- **Add mid-battle decisions.** Perhaps allow one tactical adjustment per phase (e.g., "concentrate fire", "evasive manoeuvres", "launch boarding pods").
- **Expand ground combat** into a more meaningful subsystem. Pax Imperia had planetary bombardment and ground invasion as distinct phases.
- **Consider a "fleet doctrine" system** where standing orders (aggressive, defensive, balanced) affect how AI-controlled fleets behave when the player is not watching.
- **Avoid making combat purely automated.** The biggest criticism of ES2 combat is passivity. Even modest player agency during battles improves engagement.

---

## 4. Economy (FIDSI System)

### How It Works in ES2

The economy runs on five resources, collectively called **FIDSI**:

| Resource | Full Name | Produced By | Used For |
|---|---|---|---|
| **F** | Food | Fertile planets, improvements | Population growth |
| **I** | Industry | Industrial planets, improvements | Building ships, improvements, wonders |
| **D** | Dust | Trade, improvements, marketplace | Currency: upkeep, buying, diplomacy |
| **S** | Science | Research improvements, pops | Empire-wide tech research |
| **I** | Influence | Cultural improvements, pops | Borders, diplomacy, laws, political actions |

#### Production Model

- Each **planet** in a system has base FIDSI values determined by its type (e.g., Jungle planets produce high Food, Lava planets produce high Industry).
- Each **population unit** on a planet adds FIDSI based on the pop's species bonuses.
- **System improvements** (buildings) add flat or percentage FIDSI bonuses.
- **Approval acts as a multiplier:** High approval boosts all FIDSI; low approval tanks it.

#### System Development

Systems can be upgraded through a multi-stage development process:
1. Research the prerequisite tech in Economy and Trade.
2. Choose **luxury resources** to invest (1 for Level 2, 2 for Level 3, 3 for Level 4).
3. Build the Modernisation improvement (always takes exactly 1 turn, cannot be rush-bought).

Each luxury resource chosen provides a specific system-wide bonus (e.g., +50 Food, +20% Industry per pop).

#### Trade System

- Requires researching **Commercial Frameworks** (ring 3 of Economy and Trade).
- Build a **Trading Company HQ** in a system, then **Subsidiaries** in other systems.
- Maximum **4 Trade Companies** per empire.
- Trade route income is based on:
  - Distance between HQ and Subsidiary (longer = more profitable)
  - Luxury and strategic resources at each end
  - Number of systems the route passes through
  - Structures that modify trade income
- **Trade Agreements** with other empires allow cross-border subsidiary placement.
- **Freighter types:** Dust Freighters (increase Dust/Science income), Luxury Freighters (increase Luxury/Science income).

#### Marketplace

- Global marketplace for buying/selling **strategic resources**, **luxury resources**, **heroes**, and **ships**.
- Prices fluctuate based on supply and demand.
- The Lumeris faction can manipulate marketplace prices.

#### Dust (Currency)

- Used for: ship upkeep, building upkeep, rush-buying construction, hiring heroes, diplomatic actions, marketplace purchases.
- **Rush-buying:** Any construction can be completed instantly by paying Dust (except System Development Modernisation, which always takes 1 turn).

### What Makes It Compelling

- **Five distinct resources create meaningful specialisation.** Systems naturally lean towards certain outputs based on their planets, encouraging you to think about what each system contributes.
- **Approval as a multiplier is elegant.** It makes happiness management feel directly connected to economic output rather than an abstract penalty.
- **Trade Companies are semi-automatic.** You set up HQs and subsidiaries, then let them generate income -- minimal micro for significant rewards.
- **System Development progression gates** create interesting mid-game decisions about which luxuries to invest where.

### Criticisms

- **FIDSI imbalance:** Science and Dust snowball exponentially. Trade networks can generate "nearly twice the amount of Science as all of your colonies put together," making Economic victory trivially easy.
- **Improvements are forgettable.** Building them gives percentage bonuses with no visual or narrative feedback: "the only tangible evidence of their existence being that you're now producing 10% more Science."
- **Industry feels like a waiting game.** Early-game construction queues are slow; late-game everything builds in 1-2 turns. There is no interesting middle ground.
- **Influence is undercooked.** It expands borders and funds diplomacy but rarely creates interesting decisions beyond "build more Influence buildings."

### Application to Ex Nihilo

- **Keep a multi-resource economy** but consider 4 resources rather than 5 to reduce complexity. Pax Imperia had Credits, Research, Production, Food -- this core works well.
- **Make improvements visible and narratively meaningful.** When you build a Shipyard, it should appear on the planet. When you build a Research Lab, it should have a flavour description.
- **Balance the snowball problem.** Consider diminishing returns on FIDSI bonuses, or scaling costs that increase with empire size.
- **Make trade routes vulnerable.** ES2 trade is passive and safe. Consider piracy, trade route raiding, and escort missions as gameplay.
- **Give Influence more depth.** Use it for espionage, propaganda, cultural conversion, and diplomatic manoeuvring -- not just border expansion.

---

## 5. Tech Tree Structure

### How It Works in ES2

The technology tree is organised as a **circular wheel** divided into **four quadrants**, with **five concentric rings (eras)** from the centre outward.

#### Four Quadrants

| Quadrant | Focus Areas |
|---|---|
| **Military** | Ship hulls, weapon modules, defence modules, fleet upgrades |
| **Economy and Trade** | Strategic resource exploitation, System Development upgrades, Trade Companies, Marketplace, some colonisation techs |
| **Science and Exploration** | Curiosity exploration, ship movement speed, probes, luxury resources, planet colonisation, starlane-free travel |
| **Empire Development** | Growth, diplomacy, minor faction interactions, government types, faction alliances, overcolonisation penalties, Wonder Victory construction |

#### Progression Rules

- **Ring 1-5 progression:** Higher rings require researching a certain number of techs from the previous ring in the same quadrant.
- You do **not** need to research every tech in a ring to progress -- just enough to unlock the next one.
- **Cross-quadrant dependencies** are minimal. You can deep-dive one quadrant or spread broadly.

#### Faction-Unique Technologies

- Each faction has **unique technologies** scattered across the tree -- either entirely new techs or modified versions of standard ones.
- Example: Sophons get enhanced research speed techs; Cravers get depletion-related techs.

#### Victory via Tech

Researching all four **Endless Technologies** (one at the outermost ring of each quadrant) triggers the **Science Victory**.

### What Makes It Compelling

- **The circular layout is visually intuitive.** You can see at a glance how deep you are in each area and what is available next.
- **Flexible progression:** You are not forced down a linear path. You can rush one quadrant or diversify.
- **Faction-unique techs add replayability.** Each faction's tree feels slightly different.
- **System Development gating via the Economy quadrant** creates a natural mid-game power spike that rewards economic investment.

### Criticisms

- **Economy and Trade quadrant is overpowered.** The bonuses from trade and system development are so strong that most optimal strategies involve heavy investment there regardless of faction.
- **Military quadrant is underwhelming until late game.** Early military techs provide incremental weapon/defence upgrades that feel less impactful than economic bonuses.
- **The circular layout can be confusing for new players.** Several playthroughs needed to understand the ring/quadrant system.
- **Science victory is too easy** for factions with research bonuses (Sophons especially). Reaching the outer ring of all four quadrants is achievable before other victory conditions.
- **Many techs feel like filler.** "+10% to X" is not exciting to research.

### Application to Ex Nihilo

- **Adopt the quadrant structure** but consider a more traditional tree layout (top-to-bottom or left-to-right) for clarity. The circular layout is aesthetically interesting but harder to parse.
- **Make each tech feel meaningful.** Avoid "+5% Industry" techs. Instead, techs should unlock new capabilities: new ship modules, new building types, new diplomatic options, new planet types to colonise.
- **Balance quadrant value.** Ensure Military and Exploration techs are as desirable as Economy techs. Perhaps military techs unlock fleet doctrines or special combat abilities, not just stat boosts.
- **Faction-unique tech branches** are excellent for replayability and should be included.
- **Consider era-gating** with narrative flavour: "You've entered the Stellar Era! New horizons await..." rather than just ring numbers.

---

## 6. Diplomacy

### How It Works in ES2

#### Diplomatic States

All empires start in **Cold War** -- a liminal state that is simultaneously peace and war. The relationship ladder:

1. **War** -- Active conflict, can attack freely
2. **Cold War** (default) -- Can attack but with diplomatic consequences
3. **Peace** -- Cannot attack, enables trade and cooperation
4. **Alliance** -- Shared victory possible, full cooperation

**Truce** is available only during War (temporary ceasefire). **Close Borders** allows empires at Peace to deny passage without returning to Cold War.

#### Diplomatic Pressure

- **Pressure** measures relative power between empires (military + economic).
- **Pressure Trend** ranges from **-10 to +10** per turn.
- You can spend **Influence** to generate pressure against another empire.
- Diplomatic status and treaties act as **pressure multipliers**.
- When influence sphere borders meet, the faction with greater Influence generates **border friction**, creating automatic diplomatic pressure.

#### Demands and Tribute

When an empire has accumulated sufficient pressure against another, it can make **Demands**:
- **Dust** (lump sum)
- **Resources** (strategic or luxury)
- **Technology**
- **Economic Tribute** (Dust/Science donation over a set number of turns)

Complying with demands improves relations; refusing worsens them.

#### Diplomatic Actions

- **Bureaucratic Imbroglio:** Spend Influence to generate sustained pressure over several turns.
- **Praise/Denounce:** Modify relations with minor factions or other empires.
- **Trade Agreements:** Allow cross-border trade company subsidiaries.
- **Alliance:** Full cooperation, shared vision, joint victory possible.

#### Influence Conversion (System Takeover)

Researching "Supra-Light Content Systems" (Stage 4 of Empire Development) allows **peaceful system absorption**. When your influence sphere completely envelops an enemy system, a countdown timer begins. When it completes, the system becomes yours without firing a shot.

### What Makes It Compelling

- **Influence-as-soft-power is brilliant.** Your cultural output literally pushes borders and can absorb enemy systems. This makes Influence feel like a weapon.
- **Diplomatic pressure creates escalation dynamics.** You can feel tension building before wars break out.
- **Demands create interesting asymmetric interactions.** A powerful empire can bully weaker ones for tribute without war.

### Criticisms

- **Diplomacy is opaque.** Players cannot easily determine why the AI is hostile or what would improve relations.
- **AI diplomacy is passive.** The AI rarely initiates meaningful diplomatic actions, making the system feel one-sided.
- **Influence conversion is too powerful.** Late-game, high-Influence factions can absorb systems faster than enemies can defend them, with no military counter except war.
- **Agreements have Influence upkeep** that can be crippling early on, making diplomacy feel expensive.
- **Cold War as a default state is confusing.** Players often do not realise they can be attacked during Cold War.

### Application to Ex Nihilo

- **Keep the pressure/influence system** but make it more transparent. Show a "diplomatic dashboard" with clear reasons for AI attitudes.
- **Add more diplomatic options:** Non-aggression pacts, research agreements, defensive pacts, vassal relationships, federations.
- **Make AI diplomacy proactive.** AI should initiate deals, propose alliances, and backstab when advantageous.
- **Cultural conversion should be slow and resistible.** Allow defending empires to build "cultural defence" improvements or spend resources to resist absorption.
- **Consider a "Diplomatic Capital" resource** -- separate from Influence -- to prevent the cultural/diplomatic overlap from making one resource too important.
- **Espionage as diplomacy:** Pax Imperia had spying. Add spy networks, sabotage, and intelligence gathering as diplomatic tools.

---

## 7. Ship Design

### How It Works in ES2

#### Hull Types (Ship Roles)

| Role | CP Cost | Unlock | Focus | Notes |
|---|---|---|---|---|
| **Explorer** | 1 | Start | Probes, exploration | Only ship that can equip Probes |
| **Coloniser** | 1 | Start | Colony modules | Only ship that can equip colonisation modules |
| **Attacker** | 1 | Start | Balanced offence | Basic combat ship |
| **Protector** | 1 | Empire Dev Stage 2 | Defence/support | Slots skew towards defence and support modules |
| **Hunter** | 3 | Empire Dev Stage 3 | Weapon-heavy | Slots skew towards weapon modules |
| **Coordinator** | 3 | Empire Dev Stage 3 | Balanced advanced | Middle ground between roles |
| **Carrier** | 6 | Empire Dev Stage 4+ | Heavy weapons, squadrons | x4 module slots, heavy (x8) weapon slot, can mount Core Crackers |

Each faction has **unique hull visuals and slightly different module distributions** for the same role, plus unique hull names.

#### Module Categories

- **Weapon Modules:** Kinetics, Slugs, Missiles, Swarm Missiles, Lasers, Beams, Railguns (see Combat section for stats)
- **Defence Modules:** Shields (anti-projectile), Hull Plating/Armour (anti-energy)
- **Support Modules:** Engines (speed), Repair modules, Siege equipment (OpEx Gear), Probe launchers, Colonisation modules, Essence Extraction (Vodyani-only), Manpower modules
- **Heavy Weapon Slot:** Doubled stats, can mount exotic weapons (Blast Effect Batteries, Core Crackers on Carriers)

#### Fleet Composition

- Each fleet has a **Command Point limit** (typically 25 base, can be increased with tech/heroes).
- Mix of small cheap ships (1 CP) and large expensive ships (3-6 CP) creates a numbers-vs-power trade-off.
- **Support ships** (Protectors with support modules) can provide fleet-wide buffs: speed, shields, science bonuses.

#### Retrofitting

- Existing ships can be **retrofitted** to new designs for a Dust cost.
- This allows mid-war adaptation without scrapping entire fleets.

### What Makes It Compelling

- **Meaningful design trade-offs.** Module slot limitations force real choices between offence, defence, and support.
- **Role specialisation creates fleet ecology.** You want a mix of Attackers for damage, Protectors for tanking, and perhaps a Carrier for heavy firepower.
- **Counter-building is satisfying.** Scouting enemy fleets, seeing they are missile-heavy, and designing kinetic-flak ships to counter them is deeply strategic.
- **Faction hull differences add flavour** without breaking balance -- same roles, slightly different distributions.

### Criticisms

- **Ship design is incrementally improved from ES1** rather than meaningfully expanded.
- **Late-game, large ships dominate.** Carriers and Hunters render early-game Attackers obsolete, reducing fleet diversity.
- **Module variety is limited.** Once you find an optimal loadout, there is little reason to experiment.
- **No logistics or supply lines.** Ships operate indefinitely without fuel or supply concerns.
- **Support ships became less useful post-patch.** Balance changes reduced their fleet-wide buff effectiveness.

### Application to Ex Nihilo

- **Adopt the role-based hull system** with faction-unique visuals and slight stat variations.
- **Add more module variety** and make modules feel distinct. ES2 modules are mostly stat sticks -- consider modules that change ship behaviour (e.g., a "Stealth Module" that makes the ship harder to target, a "Point Defence Array" that actively shoots down incoming missiles).
- **Consider logistics/supply.** Ships operating far from supply lines could suffer combat penalties or require supply ships, adding a strategic layer.
- **Make early-game ships remain relevant** through upgrade paths or role evolution, not obsolescence.
- **Add a "fleet doctrine" system** that provides passive bonuses to fleets based on their composition (e.g., "Screening Fleet" doctrine for fleets with 80%+ small ships).

---

## 8. Minor Factions

### How It Works in ES2

There are **24 minor factions** in the game (21 base, 3 from DLC). Each occupies one or more star systems and can be interacted with through diplomacy, conquest, or questing.

#### Interaction Methods

| Method | How | Result |
|---|---|---|
| **Praise (Influence)** | Spend Influence to improve relations | Gradual relationship building |
| **Curiosity Discovery** | Explore curiosities in their systems | Relationship boost |
| **Influence Sphere** | Expand your borders to encompass them | Gradual conversion |
| **Military Conquest** | Invade their system | Immediate control, no assimilation bonus |
| **Quest Completion** | At 50 relationship, a quest unlocks | Assimilation + system + trait bonus |
| **Direct Assimilation** | At 100 relationship, pay Influence | Assimilation + system + trait bonus |

#### Relationship Levels

- **Wary** (0-24): Basic contact
- **Cordial** (25-49): Become Suzerain (best relations among all empires) for special bonuses
- **Friendly** (50-99): Quest becomes available
- **Assimilated** (100+): Can pay Influence for direct assimilation

#### Assimilation Bonuses

Each minor faction provides a **unique empire-wide trait** when assimilated. Examples:

| Minor Faction | Political Leaning | Assimilation Bonus |
|---|---|---|
| **Amblyr** | Pacifist | +40 Dust per Strategic Resource; or 10% ship buyout reduction |
| **Yuusho** | Militarist | +20% damage on weapon modules |
| **Z'Vali** | Scientist | +5 Approval per stage unlocked in Science & Exploration |

**Trait stacking:** If multiple instances of a minor faction exist on the map, assimilating all of them stacks the bonus.

#### Faction-Specific Interactions

- **Cravers** cannot use standard diplomacy with minors; they must conquer militarily or shift politics towards Pacifism.
- **Vodyani** use "Brainwash" instead of assimilation, gaining Essence tributes without system ownership.
- **Horatio** can **splice** minor faction pops for gene bonuses rather than assimilating them.

### What Makes It Compelling

- **Multiple interaction paths** make minor factions feel like diplomatic puzzles, not just conquest targets.
- **Assimilation bonuses create meaningful strategic decisions.** Prioritising which minor factions to assimilate shapes your empire's strengths.
- **Suzerain mechanic adds competition.** Multiple empires vie for the best relationship with valuable minor factions.
- **Minor faction populations integrate into your empire**, adding political diversity and economic output.

### Criticisms

- **Minor factions are passive.** They sit in their systems waiting to be interacted with. They do not expand, trade, or create events on their own.
- **Assimilation is usually the "correct" choice.** There is rarely a reason to leave a minor faction independent.
- **Trait stacking is unbalanced.** Some minor faction bonuses are dramatically better than others, creating "must-get" factions.
- **Military conquest gives no assimilation bonus**, making it strictly inferior to diplomatic assimilation unless you urgently need the system.

### Application to Ex Nihilo

- **Make minor factions active agents.** They should expand, trade with each other, form coalitions, and occasionally be hostile. They should feel like small civilisations, not resource nodes.
- **Add a reason to leave some independent.** Perhaps independent minor factions provide trade bonuses, act as buffer states, or offer unique services (mercenaries, black market, intelligence).
- **Balance assimilation bonuses carefully.** No single minor faction trait should be a must-have.
- **Consider a "protectorate" status** between independence and assimilation -- you guarantee their safety in exchange for bonuses, without absorbing them.
- **Minor faction quests should scale** with game progress and provide proportionate rewards.

---

## 9. Exploration

### How It Works in ES2

#### Curiosities

Planets contain **curiosities** -- explorable mini-events at four levels of difficulty/reward:

| Level | Discovery Method | Typical Rewards |
|---|---|---|
| **Level 1** | Visible from start | Common resources, small Dust/Science |
| **Level 2** | Revealed by Science & Exploration ring 1 tech | Uncommon resources, ship modules |
| **Level 3** | Revealed by Science & Exploration ring 2 tech | Rare resources, unique improvements |
| **Level 4** | Revealed by Science & Exploration ring 3 tech | Legendary resources, quest triggers, unique battle tactics |

**Exploration methods:**
- **Probes** on Explorer ships: Can be launched into unexplored systems, bypassing normal movement. Each probe explores one curiosity.
- **"Study Curiosity" improvement:** Built in owned systems to explore curiosities without a fleet present.

**Curiosity Rewards:**
- **Anomaly rewards:** Add positive, negative, or mixed anomalies to planets (e.g., +30% Industry, -15% Food).
- **Resource deposits:** Reveal luxury or strategic resource deposits (higher-level curiosities reveal rarer resources).
- **Loot:** Fixed FIDSI amounts, random ships, unique ship modules, unique system improvements, unique battle tactics.
- **Traps:** Small chance of spawning a pirate fleet that attacks the system.
- **Quest triggers:** Some curiosities begin multi-step quest chains.

#### Anomalies

Randomly placed on planets, anomalies provide permanent bonuses or penalties to FIDSI. They can be positive ("Rich Soil": +20% Food), negative ("Toxic Atmosphere": -10% Approval), or mixed.

#### Probes

- Only Explorer and Hero ships can equip Probe modules.
- Probes travel independently across the galaxy map, exploring systems and revealing the fog of war.
- Probe capacity increases with tech upgrades.

#### Quest System

**Types of quests:**
- **Faction Quests:** Unique multi-chapter storylines for each faction (4 chapters with branching choices). Completing these shapes your faction's identity and provides powerful rewards. Example: United Empire's quest lets you choose Militarist/Industrialist/Scientist paths, transforming your faction into the Sheredyn, staying United Empire, or becoming the Mezari.
- **Minor Faction Quests:** Triggered at 50 relationship; completion leads to assimilation.
- **Exploration Quests:** Triggered by discovering certain curiosities; often send you to explore specific other curiosities across the galaxy.
- **Academy Quests:** Related to the Academy (neutral faction that trains heroes); affect the galaxy-wide narrative.

### What Makes It Compelling

- **Exploration has tangible rewards at every stage.** You are constantly finding useful things (resources, modules, quest triggers).
- **Probes create a mini-game** of efficient exploration routing -- where do you send your limited probes for maximum coverage?
- **Curiosity levels create a sense of progression.** As you research deeper science, you unlock access to richer discoveries.
- **Faction quests provide strong narrative drive** in an otherwise systems-heavy genre. The branching choices and faction transformation are especially memorable.
- **Anomalies make every planet unique.** Two "Terran" planets can feel very different because of their anomaly profiles.

### Criticisms

- **Quest rewards do not scale.** Receiving 1,000 Dust when generating 50,000 per turn is meaningless.
- **Too many quests at once.** Tracking faction quests, minor faction quests, and exploration quests simultaneously is confusing.
- **Some quests demand exploring specific curiosity types** that may not exist in your territory, requiring you to expand or explore far afield at inopportune times.
- **Exploration becomes less relevant mid-to-late game** once the galaxy is mostly revealed.

### Application to Ex Nihilo

- **Keep the curiosity/anomaly system** but ensure rewards scale with game progression. A mid-game discovery should provide mid-game-appropriate rewards.
- **Limit active quests** to 3-5 at a time and make them feel urgent/important rather than overwhelming.
- **Add "deep space exploration"** -- special expeditions into uncharted regions (black holes, nebulae, anomalous sectors) that provide high-risk/high-reward discovery opportunities.
- **Make exploration relevant throughout the game.** Consider procedurally revealing new areas, roaming space entities, or time-locked anomalies that appear in the mid/late game.
- **Faction quests with branching choices that transform gameplay** are one of ES2's best features. Absolutely include this in Ex Nihilo.

---

## 10. Unique Faction Mechanics

### How It Works in ES2

ES2 has **12 major factions**, each with at least one core mechanic that fundamentally changes how they play. This is arguably the game's strongest design feature.

#### Faction Breakdown

| Faction | Core Unique Mechanic | Playstyle |
|---|---|---|
| **United Empire** | **Influence Buy-out:** Can rush-buy anything with Influence; reduced overcolonisation penalty | Industrial war machine |
| **Sophons** | **Research Bonus for Pioneering:** Get bonus Science for researching techs nobody else has | Tech rush, early science lead |
| **Lumeris** | **Buy Colonies with Dust:** No colony ships; instantly purchase outposts with Dust (cost = 200 x Dust inflation) | Economic manipulation |
| **Horatio** | **Gene Splicing:** Can consume non-Horatio pops to permanently add their bonuses to all Horatio pops | Late-game scaling, genetic perfectionist |
| **Cravers** | **Depletion:** Craver pops generate massive bonus resources but permanently deplete the planet over time, forcing constant expansion | Aggressive locust swarm |
| **Vodyani** | **Ark Ships + Essence:** Population lives on Arks; Essence (drained from other systems via Leecher ships) replaces Food for growth; Arks can dock at systems (virtual pop on every planet) or move as fleets | Nomadic vampire |
| **Riftborn** | **Industry-Built Pops + Time Singularities:** Build pops with Industry instead of Food; create time bubbles that accelerate/decelerate production; prefer sterile planets (+4 pop slots to sterile, -1 to fertile) | Optimisation, min-maxing |
| **Unfallen** | **Celestial Vines:** Cannot use colony ships; must extend organic vines from their homeworld system-by-system to colonise; vine-connected systems gain movement speed bonuses; capital Citadel provides massive defence | Defensive network builder |
| **Vaulters** | **Teleportation Network:** Build teleporters connecting all colonies (cheap, available early); fleets can teleport between any connected system | Rapid response defence |
| **Umbral Choir** | **Hacking + Invisibility:** Must hack systems to colonise; all fleets/systems have built-in cloaking; home system is 5 artificial "Crescent" ring-worlds; can embed Sleepers in enemy systems; Abduct action converts enemy pops to double-output Umbral Shadows | Covert espionage |
| **Hissho** | **Honour System:** Happiness replaced with Honour (Keii); must perform virtuous deeds (win battles, complete quests) and avoid dishonourable ones (retreat, make peace); colonies converted from outposts by spending Keii | Honour-bound warrior |
| **Nakalim** | **Ancient Temples + Temporary Fleets:** Access to temporarily summon outrageously powerful ancient fleets; tied to temple control | Aggressive early expansion |

#### Deeper Mechanic Details

**Vodyani Arks:**
- Arks function as both colony and fleet.
- When **anchored** at a system, the Ark's population is **applied to every planet simultaneously** (3 pops on an Ark in a 2-planet system = 6 effective pops).
- Arks can be **unanchored** and moved as fleet ships. They have massive module slots.
- New Arks cost **Essence** and build instantly (no Industry needed).
- **Leecher ships** extract Essence from inhabited systems (-5 Food from target, +13 Essence). This cripples the target system.

**Riftborn Singularities:**
- 5 types of time bubbles, unlocked progressively.
- Cost 1 turn of construction + strategic resources + Dust.
- Effects: accelerate production, decelerate enemy production, special effects.
- Riftborn pops are built with Industry; cost increases with total Riftborn pop count but always takes at least 1 full turn.

**Umbral Choir Hacking:**
- Hacking operations travel along hyperlanes from your origin system to the target.
- **Hacking outcomes** include:
  - Create Backdoor (enables further hacking from this node)
  - Embed Sleeper (converts a pop to a spy, granting vision and economic bonuses)
  - Jam Commands (forces bad ground battle tactics for 5 turns)
  - Influence Politics (forces system political party change)
- Hacking can be **detected and countered** by the target empire through anti-hacking programs.

**Horatio Gene Splicing:**
- Consume any non-Horatio pop to add its species bonuses to ALL Horatio pops empire-wide.
- Creates a permanent, stacking genetic advantage.
- Must choose carefully which species to splice -- different species add different bonuses.

### What Makes It Compelling

- **True asymmetry.** Factions do not just have different stats; they have fundamentally different game loops. Playing Vodyani (vampiric nomads) feels nothing like playing Unfallen (defensive vine-builders) or Lumeris (economic buyers).
- **Mechanical identity reinforces narrative identity.** The Cravers' depletion mechanic makes you FEEL like a locust swarm. The Hissho's honour system makes you FEEL like a warrior culture.
- **Replayability is enormous.** Each faction genuinely feels like a different game.
- **Strategic diversity is forced.** You cannot play Vodyani with a passive turtle strategy or Cravers with a diplomatic approach (at least not easily).

### Criticisms

- **Despite unique mechanics, mid-to-late game convergence occurs.** All factions eventually do the same thing: build improvements, research techs, expand. The unique mechanics become less dominant as the game progresses.
- **Balance is uneven.** Some factions (Riftborn, Sophons) are considered significantly stronger than others (Unfallen, Hissho in multiplayer).
- **Complexity barrier.** New players can be overwhelmed by faction-unique mechanics on top of base game systems.
- **Some mechanics feel like gimmicks** rather than deep systems (e.g., Nakalim's temporary fleet summoning).
- **Custom faction creation** allows picking and mixing faction traits, which can dilute the uniqueness of designed factions.

### Application to Ex Nihilo

- **Asymmetric faction design is non-negotiable for a modern 4X.** ES2 proves this is the single most impactful design feature for replayability.
- **Start with 4-6 deeply differentiated factions** rather than 12 with varying depth. Quality over quantity.
- **Ensure unique mechanics stay relevant throughout the entire game**, not just the early game. Cravers' depletion becomes less interesting once you have the whole galaxy.
- **Consider faction mechanics that affect diplomacy** (e.g., a faction that cannot declare war but can subvert, or a faction that gains power from allies).
- **Avoid "gimmick" factions.** Each unique mechanic should create a full alternative game loop, not just a single trick.
- **Test balance rigorously.** ES2's faction balance was a persistent issue. Ensure no faction has a clearly dominant strategy.
- Potential Ex Nihilo factions inspired by ES2:
  - **Builder faction** (like Unfallen): Spreads infrastructure networks, strong defence, slow expansion
  - **Nomadic faction** (like Vodyani): Mobile capital, drains resources from others
  - **Science faction** (like Sophons): Research bonuses for pioneering new techs
  - **Economic faction** (like Lumeris): Buys influence rather than conquering
  - **Aggressive faction** (like Cravers): Consumes systems, must keep expanding

---

## Summary: Key Design Takeaways for Ex Nihilo

### What ES2 Does Best (Steal These)

1. **Asymmetric factions** with mechanically distinct game loops
2. **Faction quest lines** with branching narrative choices that transform gameplay
3. **Multi-resource economy** (FIDSI) creating natural system specialisation
4. **Range-based combat** (long/medium/short) with weapon specialisation
5. **Minor factions as diplomatic puzzles** with multiple interaction paths
6. **Influence-as-soft-power** for border expansion and cultural conversion
7. **Curiosity exploration** with tiered rewards and anomaly discovery
8. **Population-as-political-actors** connecting demographics to governance
9. **Ship design with role-based hulls** and counter-building strategy
10. **System Development progression** gated by luxury resource investment

### What ES2 Gets Wrong (Avoid These)

1. **Passive combat** -- players watch rather than participate after choosing a tactic card
2. **Economic snowballing** -- trade and science spiral out of control
3. **Opaque diplomacy** -- unclear why AI behaves as it does
4. **Passive AI** -- AI empires and minor factions do not feel alive
5. **Quest reward scaling** -- rewards become meaningless mid-to-late game
6. **Improvement invisibility** -- buildings are just stat bonuses with no visual/narrative feedback
7. **Political volatility** -- elections feel random rather than strategic
8. **Late-game convergence** -- unique faction mechanics become less relevant over time
9. **Ground combat as afterthought** -- token system with minimal depth
10. **Filler techs** -- "+5% to X" is not interesting to research

### Priority Features for Ex Nihilo Adaptation

| Priority | Feature | ES2 Inspiration | Ex Nihilo Enhancement |
|---|---|---|---|
| **Critical** | Asymmetric factions | 12 factions with unique mechanics | 4-6 deeply designed factions |
| **Critical** | Multi-resource economy | FIDSI system | 4 core resources with meaningful choices |
| **High** | Ship design + combat | Role hulls, range phases, weapon RPS | Add mid-battle decisions, fleet doctrines |
| **High** | Exploration system | Curiosities, anomalies, probes | Scaling rewards, persistent late-game content |
| **High** | Faction quest lines | 4-chapter branching narratives | Include, ensure rewards scale |
| **Medium** | Political system | Senate, parties, laws, elections | Simpler (3-4 parties), more transparent |
| **Medium** | Minor factions | 24 assimilable factions | Fewer but active/dynamic minor factions |
| **Medium** | Diplomacy | Pressure, influence, conversion | More options, proactive AI, espionage |
| **Medium** | Tech tree | 4 quadrants, 5 rings | Maintain structure, ensure all techs feel meaningful |
| **Lower** | Trade system | Trading Companies, routes | Make routes vulnerable, add piracy |
| **Lower** | Hacking/espionage | Penumbra DLC | Build into base game as espionage system |
