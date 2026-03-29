# Galactic Civilizations -- Gameplay Research for Ex Nihilo

Research into the Galactic Civilizations series (primarily GalCiv III with Crusade/Retribution expansions and GalCiv IV: Supernova) by Stardock Entertainment. These notes focus on concrete mechanics, what works, what doesn't, and how each system could inform Ex Nihilo's design.

---

## 1. Ship Design System

### How it works in GalCiv

**GalCiv III:**
- Players access the Ship Designer via a shipyard. They pick a hull template (or start blank), then switch between **Design Mode** (cosmetic parts) and **Equip Mode** (functional parts).
- Hulls come in six size tiers: Tiny (2 logistics), Small (3), Medium (5), Cargo (5), Large (7), Huge (10). Larger hulls have more hardpoints (attachment slots) but cost more logistics, which limits fleet composition.
- Each part has red cone "hardpoints" -- 3D attachment points where components snap on. Parts can be rescaled, angled, and offset for visual customisation.
- **Equipment categories:**
  - **Engines** -- Interstellar drives (Hyper Drive at 1 move up to Stellar Folding at 6 moves) and Sublight drives (Thrusters at +10% combat speed up to Gravity Manipulation at +50%).
  - **Weapons** -- Beam, Kinetic, Missile (three distinct types forming the combat triangle).
  - **Defences** -- Shields (vs beam), Armour (vs kinetic), Point Defence (vs missile).
  - **Modules** -- Life Support (extends range, 6-21 tiles), Sensors (2-6 range), Carrier modules (deploy fighters: Assault, Drone, Guardian, Escort variants), Survey modules, and Utility modules (colonisation, construction, cargo, invasion).
  - **Support** -- Special-purpose modules requiring rare resources (Elerium, Antimatter, Durantium, Thulium) for hull reinforcement, targeting systems, weapon augmentation, and speed modifications.
- **Steam Workshop integration** for sharing hull templates and designs.

**GalCiv IV: Supernova:**
- Ship classes are now explicit: Fighter, Frigate, Cruiser, Dreadnought, etc. Each class has its own slot count and base hit points.
  - Tiny Hull: 1 slot, 10 HP
  - Small Hull: 2 slots, 20 HP
  - Medium Hull: 6 slots, 40 HP
  - Cargo Hull: 5 slots, 20 HP
  - Huge Hull: 16 slots, 160 HP, 24 logistics points
- Design involves selecting a ship type, pressing "Start New Design", then filling module slots from a left-hand panel.
- Megastructures and Warlords expansions added many additional components.

### What makes it compelling

- **Visual creativity** -- the cosmetic layer lets players build ships that look genuinely unique. Community ship sharing extends replayability.
- **Strategic depth** -- choosing between more small ships vs fewer large ships is a real trade-off because of the logistics system. A fleet of 5 Tiny ships (10 logistics) might beat one Huge ship (10 logistics) because excess damage to small ships is wasted.
- **Rock-paper-scissors counter-design** -- you can spy on an enemy fleet's composition and then design ships specifically to counter their defences. This creates a meta-game of espionage and adaptation.
- **Emergent fleet doctrines** -- the ship role system (see Combat below) means how you equip a ship determines its battlefield behaviour, not just its stats.

### Problems and criticisms

- **Late-game fleet management** is "practically useless" -- the ship listing lacks filters or sorting, which becomes painful with 200+ ships.
- **Large/Huge hulls become irrelevant** in some metas because swarms of small ships exploit the wasted-damage mechanic.
- **Visual designer is cosmetic-only** -- part placement has no tactical or functional effect. Some players find this disappointing; the visual layer and functional layer are entirely separate.
- **Overwhelming for new players** -- the number of components and the lack of clear guidance on what makes a good design can paralyse newcomers.

### Application to Ex Nihilo

- **Adopt the hull-size/logistics trade-off** -- this is one of GalCiv's best mechanics. Different hull sizes with different logistics costs creates genuine fleet composition decisions.
- **Simplify the visual layer** -- rather than a full 3D builder, consider a 2D silhouette system with swappable weapon hardpoints that are both visual and functional (unlike GalCiv's separation).
- **Module slots per hull class** -- GalCiv IV's approach of fixed slot counts per class is cleaner than GalCiv III's hardpoint system. Ex Nihilo could use named slots (Weapon, Defence, Utility, Engine) that constrain what goes where.
- **Counter-design intel** -- allow players to scan enemy fleets and then redesign ships mid-game. This creates a compelling espionage-to-engineering pipeline.
- **Auto-design for accessibility** -- GalCiv's AI designs ships automatically for AI factions. Ex Nihilo should offer "suggested designs" or "auto-fill" to prevent new-player paralysis.

---

## 2. Ideology / Alignment System

### How it works in GalCiv

**GalCiv III:**
- Three ideological paths: **Benevolent**, **Pragmatic**, **Malevolent**.
- Each path has 20 abilities organised into 4 themed tiers (5 per tier).
- Ideology points are earned through:
  - Event choices (colonisation events, anomaly encounters, story events)
  - Colony improvements that generate ideology points passively (1 point every 5-10 turns)
- **Escalating costs:** First trait in a branch costs 10 points. Each subsequent trait in the same branch costs +10 more (10, 20, 30...). Traits in other branches add +5 per trait already unlocked elsewhere.
- **Path bonuses:**
  - Benevolent: Research, Morale, Influence, Colonisation (+600 Research per turn at high tiers)
  - Pragmatic: Defence, Starbases, Trade, Diplomacy
  - Malevolent: Offence, Social Construction, Ship Construction, Power Projection
- **Diplomatic consequences:** AI factions form cold-war blocs along ideological lines. Same-ideology factions are more friendly; opposing ideologies create tension. By turn 200, the same-ideology bonus is roughly 3x its initial value.

**GalCiv IV: Supernova:**
- Replaced the trinity with **seven opposing ideology pairs:**
  - Tradition vs Innovation
  - Compassion vs Pragmatism
  - Equality vs Opportunity
  - Secrecy vs Transparency
  - Harmony vs Individualism
  - Cooperation vs Creativity
  - Authority vs Liberty
- Five perk tiers requiring escalating point thresholds (1, 3, 5, 7, 9 points).
- Culture Points (rare resource from leaders, events, or after turn 60) unlock purchased abilities.
- The ideology with the highest total determines your civilisation's governing ideology, affecting citizen approval and foreign relations.

### What makes it compelling

- **Meaningful event choices** -- colonising a new world presents a genuine dilemma: exploit it (Malevolent, +production), negotiate (Pragmatic, +trade), or preserve it (Benevolent, +morale). These choices accumulate into a civilisational identity.
- **Strategic specialisation vs diversification** -- the escalating cost mechanic creates a real choice: go deep in one path for powerful late-game abilities, or spread points for versatility at lower cost but weaker individual perks.
- **Emergent diplomacy** -- the cold-war blocs create natural alliances and rivalries without scripted narratives.

### Problems and criticisms

- **GalCiv III's ideology felt "loose and intangible"** -- effects didn't strongly embody your civilisation's playstyle. Being Benevolent didn't feel dramatically different from being Malevolent in terms of moment-to-moment gameplay.
- **GalCiv IV's seven-axis system is overcomplicated** -- too many dimensions dilute the identity. Players reported feeling like their choices didn't have clear consequences.
- **Min-maxing the system** -- experienced players discovered that gaming the ideology system (collecting points from buildings rather than making genuine choices) was optimal, undermining the narrative intent.
- **The "Enticing" ability** (one-time conversion of enemy colonies) was considered overpowered for Benevolent players, creating a balance issue.

### Application to Ex Nihilo

- **Use a three-axis system** (like GalCiv III's trinity) rather than seven axes. Three is memorable and creates clear faction identities. Consider: Militant / Diplomatic / Scientific or Expansionist / Isolationist / Subversive.
- **Make ideology visible** -- let the player see the ideology of other factions (colour-coded borders, fleet aesthetics) so the cold-war dynamic is immediately legible.
- **Tie ideology to exclusive buildings and units** -- go further than GalCiv by making ideology unlock unique ship designs, planet improvements, and victory conditions, not just stat bonuses.
- **Prevent min-maxing** -- gate ideology points primarily through narrative events and decisions, not passive buildings. This keeps the system feeling like genuine roleplay rather than an optimisation puzzle.

---

## 3. Economy

### How it works in GalCiv

**GalCiv III:**
- **Population is the foundation** -- each unit of population produces one raw production point per turn.
- **The Economy Wheel** divides raw production into three outputs:
  - **Manufacturing** -- builds ships and social improvements
  - **Research** -- advances technologies
  - **Wealth** -- generates income (credits)
- **No penalty for balanced allocation.** Coercion penalty kicks in at ~46-47% allocation to any single output, reaching a maximum 50% approval penalty at 100% focus. This penalty can be negated by having morale 50%+ above population.
- **Military Slider** -- within Manufacturing, a second slider divides output between social construction (buildings) and shipyard production. Planets not sponsoring a shipyard automatically put all manufacturing into social spending.
- **Planetary Focus** -- each planet can be assigned a focus granting +25% to one output at the expense of others.
- **Bureau of Labour** -- building this improvement allows individual planets to override the empire-wide economy wheel settings.
- **Production formula:** `(Population x AllocationPercentage) x (1 + ImprovementMod + PlanetMod + StarbaseMod + RacialMod) = Output`

**Additional income sources:**
- **Trade routes** -- Freighters equipped with trade modules establish routes between your planets and other civilisations' planets. Value is proportional to route distance and population of both endpoints. Longer routes = more credits. Both civilisations benefit equally. Trade also improves diplomatic relations. Trade licences are limited and must be researched.
- **Tourism** -- generated by cultural accomplishments, providing passive wealth.
- **Maintenance costs** -- each improvement and ship has ongoing upkeep reducing net income.

**GalCiv IV: Supernova:**
- **Policies replace sliders** -- selectable policies (e.g. Coerced Research, Mandatory Conscription) replace confusing percentage sliders. Each has clear trade-offs.
- **Core Worlds vs Colonies** -- only Core Worlds (governed planets of Class 10+) need micromanagement. Colonies automatically contribute raw resources to their sponsoring Core World, reducing late-game tedium.
- **Resource Decay** -- colonies further from their sponsoring Core World contribute less, creating a geographic incentive to manage supply lines.

### What makes it compelling

- **Planet specialisation** -- players naturally develop manufacturing worlds, research worlds, and wealth worlds. This creates a spatial economy where geography matters.
- **Trade route gameplay** -- the distance-based valuation encourages diplomatic relations with distant civilisations, creating interesting geopolitical dynamics.
- **The economic wheel is intuitive** -- a simple visual metaphor that immediately communicates how resources flow.

### Problems and criticisms

- **Economy is hard to learn** -- multiple players reported going broke even on easy difficulty. The interaction between the economy wheel, military slider, maintenance, and planet focus is opaque to new players.
- **Coercion mechanic is poorly explained** -- the penalty for over-specialisation is invisible until it causes problems.
- **Trade income cap** -- when treasury exceeds 10,000 credits, trade revenue halves. This feels arbitrary and punishes successful economic play.
- **Late-game economic dominance** -- economic victory paths feel passive compared to military conquest.

### Application to Ex Nihilo

- **Adopt the Core World / Colony distinction** from GalCiv IV -- this is the single best quality-of-life improvement in the series. Only 5-10 important worlds need active management; the rest auto-contribute. This solves the late-game micromanagement problem.
- **Simplify to two or three resource types** -- Production (ships/buildings), Research (tech), Credits (maintenance/diplomacy). Avoid GalCiv's confusion of "manufacturing" vs "wealth" vs "production" which use overlapping terminology.
- **Make trade routes visual and interactive** -- GalCiv's trade routes are largely invisible. Ex Nihilo could show freight convoys moving along wormhole connections, making them targets for piracy and creating escort gameplay.
- **Replace sliders with policies** (GalCiv IV approach) -- discrete policy choices are more legible than continuous sliders.
- **No arbitrary income caps** -- reward successful economic play rather than punishing it.

---

## 4. Tech Tree

### How it works in GalCiv

**Structure:**
- Four main research categories:
  1. **Engineering** -- Exploration, Starbases, Resource Production, Logistics, Propulsion
  2. **Colonisation** -- Colonisation, Agriculture, Medicine, Technology Development, Precursor Archaeology, Manufacturing
  3. **Warfare** -- Military Ships, Weaponry, Defence Systems, Invasions
  4. **Governance** -- Communications, Government Infrastructure, Culture, Diplomacy, Trade

- Technologies form **branching paths** -- researching one tech may open multiple follow-up techs, creating a tree that widens as you progress.
- Each tech has a Research Point cost. Monthly research points accumulate until the cost is met, triggering a breakthrough.
- **Breakthrough techs** in GalCiv IV come with a 50% cost reduction, making them tempting diversions.
- **Technology Ages** -- staggered eras help streamline the progression, preventing players from jumping too far ahead in one branch.

**Unique Civilisation Techs:**
- Each major race has special techs unique to their tech tree that cannot be researched by other civilisations but *can be traded* to them.
- In GalCiv IV, ability-gated tech branches replaced race-specific trees:
  - **Wealthy** ability gates economic techs
  - **Synthetic** gates techs like Digital Exchange
  - **Bureaucrats** unlocks policy research
  - **Traders** provides exclusive commerce options
  - **Ancient** and **Devout** unlock theological technologies

**Tech Trading:**
- Technologies can be exchanged in diplomatic trade. This creates a market where unique racial techs become trade commodities, incentivising diplomacy even between rivals.

### What makes it compelling

- **Four-branch structure is clean** -- players can quickly assess whether they're ahead or behind in any given domain.
- **Tech trading creates diplomacy** -- the ability to trade techs (especially unique ones) gives peaceful players something valuable to offer military empires, and vice versa.
- **Ability-gated branches** (GalCiv IV) make civilisation design meaningful -- your faction's traits determine which parts of the tree you can access, creating genuine asymmetry.

### Problems and criticisms

- **Lack of interconnectivity** -- the branches are too independent. You can have advanced starships but can't build basic ground units because you never researched the Warfare branch. This creates absurd situations.
- **Tech tree is too large and unfocused** -- new players don't know what to research first because everything seems important but the payoffs are unclear.
- **No meaningful "eureka" moments** -- unlike Civilization VI's boost system, there's no connection between what you're doing in-game and what you're researching.
- **Tech trading makes unique techs less unique** -- the AI trades freely among itself, diffusing unique technologies rapidly.

### Application to Ex Nihilo

- **Use a web/graph rather than a strict tree** -- allow technologies to have prerequisites from multiple branches, creating meaningful interconnections (e.g. advanced shields require both Engineering and Governance research).
- **Fewer, more impactful techs** -- rather than 200+ incremental techs, aim for 60-80 technologies where each unlock is visibly meaningful (new ship class, new building, new ability).
- **Eureka/boost system** -- reward players for in-game actions with tech discounts (e.g. winning a battle grants +50% progress on a weapons tech you're currently researching).
- **Racial techs should be truly exclusive** -- don't allow trading of unique techs. Instead, let players reverse-engineer captured enemy ships to gain partial access to alien technology.
- **Visual tech tree** -- display it as a constellation map connecting star-like tech nodes, fitting the space theme.

---

## 5. Combat

### How it works in GalCiv

**GalCiv III (Rock-Paper-Scissors Model):**
- Three weapon types: **Beam**, **Kinetic**, **Missile**
- Three defence types: **Shields** (vs beam), **Armour** (vs kinetic), **Point Defence** (vs missile)
- In combat, weapons fire when ready. Same-type weapons combine into a single attack roll per phase.
- Defence absorbs damage from its matching weapon type. Remaining damage applies to hull HP. Ships at 0 HP are destroyed.
- **No retreat** -- combat continues until one side is completely destroyed.

**GalCiv IV (Layered Defence Model):**
- Same three weapon types, but the defence system was overhauled:
  1. **Evasion** (first layer) -- chance to dodge entirely. Fighters/bombers get +50% bonus. If successful, no damage occurs.
  2. **Shields** (second layer) -- temporary HP that recharge between battles. Reduce by sqrt(Damage + 1), making them efficient against high-damage hits.
  3. **Armour** (third layer) -- damage reduction roll (50-100% of incoming damage mitigated). Degrades by 3-5% of original value per hit, reaching zero after 20-33 hits regardless of damage amount.
  4. **Hull HP** (final layer) -- core health. Ships regain some HP at turn end.
- **Damage formula:** Each attack rolls a random number between 1 and weapon damage. Defence rolls similarly. Minimum 1 damage always applies -- no attack is fully blocked.
- **Cross-defence synergy:** Non-primary defences contribute their square root to the main defence value. E.g. 10 shields + 9 armour + 9 point defence = max 16 beam defence (10 + 3 + 3).
- **Missiles have a pre-combat volley** at up to 3 hexes range before battle begins.
- Weapon characteristics: Kinetic = highest damage, fast cooldown, short range; Beam = cheapest, high accuracy, medium range; Missile = longest range, lowest accuracy, medium cost.

**Ship Roles (both versions):**
- Role is auto-assigned based on equipment ratios: THREAT (weapons), FORTITUDE (defences), VALUE (other modules).
- Six roles with distinct targeting priorities and spawn positions:
  - **Capital Ships** (position 1400) -- fleet centrepieces, advance aggressively.
  - **Assault Ships** (position 1700) -- penetrate enemy formations, eliminate high-threat targets.
  - **Interceptors** (position 1800, most forward) -- hunt Guardians and Support ships.
  - **Escorts** (position 1600) -- defend Capital and Support ships. Target: Assault first.
  - **Guardians** (position 1200, far back) -- protect Support ships. Target: Interceptors first.
  - **Support Ships** (position 1000, furthest back) -- remain stationary until all combat ships destroyed.
- **Recommended fleet doctrine:** Defenders + Attackers. Load defences onto Escorts, load weapons onto Capitals. Enemies waste firepower on heavily-armoured Escorts while undefended Capitals deal maximum damage.

**Ground Invasions:**
- Transport ships carry soldiers (population modified by soldiering bonuses -- e.g. 4 pop with 50% bonus = 6 soldiers).
- Three invasion tactics: Conventional (free), Biological Warfare (500 credits, -50% resistance), Core Detonation (1000 credits, -95% resistance).
- Generals contribute 5 legions from a global pool without permanent assignment.

### What makes it compelling

- **Fleet composition matters** -- the role system means you need mixed fleets with complementary ships, not just the biggest ships you can build.
- **Counter-design meta** -- espionage reveals enemy loadouts, allowing you to redesign ships to exploit their weaknesses. This creates an arms race.
- **Layered defence (GalCiv IV)** is strategically rich -- evasion-heavy fighters play differently from armour-heavy dreadnoughts.
- **Pre-combat missile volleys** create a meaningful first-strike advantage for missile-heavy fleets.

### Problems and criticisms

- **Combat is non-interactive** -- once fleets engage, the player has no input. It's entirely resolved by ship stats.
- **No retreat option** -- losing a fleet in a battle you can see you're losing is frustrating.
- **Rock-paper-scissors (GalCiv III) was too simplistic** -- scouting an enemy and then building the perfect counter makes most battles foregone conclusions.
- **Ground invasion is the series' weakest system** -- described by reviewers as "the second most dull planetary invasion system" in the genre. Minimal player agency.
- **Late-game battles become one-sided** -- tech advantages compound so severely that mid-game fleets are instantly destroyed by late-game ships.

### Application to Ex Nihilo

- **Allow tactical input during combat** -- even a simple "focus fire / spread damage / withdraw" order set would dramatically improve player agency over GalCiv's fully-automated approach.
- **Allow retreat** -- ships that disengage should suffer a penalty (damaged engines, morale loss) but not guaranteed destruction.
- **Adopt GalCiv IV's layered defence model** rather than pure rock-paper-scissors. The evasion/shields/armour stack is more interesting and allows more ship archetypes.
- **Ship roles should be player-assigned** rather than auto-determined by equipment ratios. Let the player explicitly designate a ship design as "Escort" or "Capital" for clearer fleet management.
- **Improve ground combat** -- since Pax Imperia had ground combat, Ex Nihilo should make it a mini-game or at least a series of meaningful tactical choices, not a dice roll.
- **Fleet logistics limit** -- adopt the logistics system where fleet size is capped by a logistics rating, forcing diverse compositions.

---

## 6. Diplomacy

### How it works in GalCiv

**Diplomatic States:**
- **Neutral** -- initial contact, no relationship
- **Trading** -- active commerce (yellow indicator)
- **Allied** -- mutual defensive commitment (green indicator)
- **At War** -- active conflict (red indicator)

**Available Treaties (11 types):**
- Conflict: Declare War, Peace, Alliance, Declare War on Third Party
- Trade/Movement: Open Borders, Free Trade, Embargo, Strategic Resource Sharing
- Information: Exploration (fog-of-war sharing)
- Cultural/Economic: Cultural Treaty (+10% influence bonus), Non-Aggression Pact
- Controversial: Slave Treaties (+5% manufacturing/wealth bonus)

**Trade Screen:**
- A balance bar shows how the other leader perceives proposed exchanges.
- Tradeable items: Credits, Diplomatic Capital, Treaties, Strategic Resources, Technologies, Ships, Planets, Starbases.

**Diplomatic Factors:**
- Innate civilisation characteristics and ideology alignment
- Military rating (calculated from total ship attack power)
- Territory size, economic power, and technological advancement
- Historical actions (broken treaties, declared wars, etc.)

**The United Planets:**
- A galactic council where civilisations vote on resolutions.
- Voting power is proportional to a civilisation's Influence.
- A **Chair** is elected every few meetings; the Chair chooses which resolutions are voted on.
- Resolutions can be permanent or temporary (with expiry dates).
- Possible resolutions include: technology transfers, trade regulations, sanctions.
- **Defying the UP** is possible but costs -10% Gross Income and potentially your council seat.
- Some resolutions are "extremely destabilising" (e.g. forced tech transfers).

**Diplomatic Capital (GalCiv IV):**
- A new resource spent to perform diplomatic actions, preventing spam diplomacy.

### What makes it compelling

- **Tech trading creates interdependence** -- even rivals have reason to trade if they have complementary unique techs.
- **The United Planets adds galactic politics** -- voting blocs, strategic chair elections, and the ability to defy resolutions create a layer of soft power gameplay.
- **Ideology-driven alliances** feel organic rather than scripted.
- **The balance bar** makes trade proposals transparent -- you can see exactly how much more you need to offer.

### Problems and criticisms

- **No diplomatic victory condition** in GalCiv III -- Pragmatic ideology (the diplomatic path) lacked a clear win condition.
- **AI diplomacy is predictable** -- the AI follows simple rules about ideology alignment and military power, making it easy to manipulate.
- **The United Planets is underdeveloped** -- compared to Stellaris's Galactic Community, GalCiv's council has fewer resolution types and less impact on gameplay.
- **AI factions trade tech freely among themselves**, diffusing unique technologies and reducing asymmetry.

### Application to Ex Nihilo

- **Include a diplomatic victory** -- e.g. becoming permanent Chair of a galactic council, or establishing treaties with all major factions.
- **Make the galactic council impactful** -- resolutions should meaningfully alter game rules (ban certain weapons, establish trade zones, impose sanctions). Look at Stellaris's Galactic Community as a benchmark.
- **Diplomatic Capital as a resource** -- adopt GalCiv IV's approach. Make diplomatic actions cost a resource so players must choose what to spend political capital on.
- **Espionage integration** -- combine diplomacy with espionage (plant evidence to frame another faction, steal diplomatic secrets to leverage in negotiations).
- **Trade agreements along wormhole routes** -- tie trade to Ex Nihilo's spatial graph. Trade routes use wormhole connections, making control of chokepoints strategically valuable.

---

## 7. Culture / Influence

### How it works in GalCiv

**Influence Generation:**
- Influence is a planetary output generated by a world's culture.
- Modified by: citizens, districts, improvements, starbase modules, policies, ideological traits.
- Each hex on the galaxy map has a percentage value for each civilisation's influence.
- **Winner-take-all:** the civilisation with the highest influence percentage controls that hex's borders.
- Borders shift turn-by-turn as influence projections change.

**Influence Sources:**
- **Colonies and Core Worlds** -- primary sources; influence radiates outward with exponential decay.
- **Cultural Starbases** -- space-based influence projectors that extend borders without colonisation.
- **Policies and Ideology** -- various bonuses amplify influence output.

**Cultural Flipping:**
- When enemy influence exceeds yours on a hex containing your planet, a **rebellion** begins.
- Persistent influence disparity eventually **flips** the planet to enemy control.
- **Resistance** -- a planet stat that slows the flipping process. Higher resistance = longer to flip.
- Stationing fleets at a threatened world increases the time before flipping.
- Attempting to culture-flip enemy worlds risks diplomatic consequences and military retaliation.
- Core Worlds are much harder to flip than Colonies.

**Influence Victory:**
- Control a sufficient percentage of the galaxy's total influence to win.

### What makes it compelling

- **Soft power as a weapon** -- you can conquer worlds without firing a shot. This creates a completely different playstyle for culture-focused civilisations.
- **Dynamic borders** -- borders that shift organically based on influence create a living, breathing galaxy that feels more realistic than static territorial claims.
- **Starbase projection** -- placing cultural starbases at strategic points to extend influence is a form of "border warfare" that doesn't trigger actual war.
- **Counter-play exists** -- resistance, fleet stationing, and counter-culture buildings provide defensive options against cultural aggression.

### Problems and criticisms

- **Culture was "way too easy to generate"** in early GalCiv IV -- cultural flipping became the dominant strategy regardless of intended playstyle, overshadowing military and diplomatic paths.
- **Balance changes were heavy-handed** -- Workers no longer contributing to culture, Entertainers reduced to 1/5 output, Celebrities halved. These nerfs suggest the system was fundamentally tuned too generously.
- **Influence victory feels passive** -- you build culture buildings and wait. There's less moment-to-moment engagement than military conquest.
- **Cultural starbases are spammable** -- players could carpet the galaxy with influence starbases, creating frustrating "influence walls".

### Application to Ex Nihilo

- **Adopt dynamic borders with influence decay** -- this is one of GalCiv's best innovations. The exponential decay from source creates natural spheres of influence.
- **Make cultural flipping slower and more interactive** -- require sustained cultural superiority over many turns, and give the defender active countermeasures (propaganda campaigns, cultural festivals, etc.).
- **Limit cultural starbases** -- cap the number or make them very expensive to prevent spam.
- **Cultural victory should require active play** -- rather than passive generation, require cultural "achievements" (first contact events, artistic wonders, hosting galactic festivals) that the player must actively pursue.
- **Tie culture to morale** -- a strong culture should make your own citizens happier (lower rebellion risk) as well as subverting enemy citizens. This creates both offensive and defensive value.

---

## 8. Citizens System (GalCiv IV)

### How it works in GalCiv

**GalCiv III (Crusade expansion):**
- A new citizen is generated every 10 turns.
- Citizens can be trained into specialist roles:
  - **Leaders** -- +6% to any civilisation ability, assignable to Govern screen.
  - **Generals** -- 5 legions, +3% planetary resistance empire-wide or +30% on assigned colony.
  - **Administrators** -- 5 administration points (consumed by Survey Ships, Colonies, Starbases).
  - **Workers** -- +3% social construction empire-wide or +30% on assigned colony.
  - **Commanders** -- assign to ships for +50% HP, +100% movement, +25% logistics.
  - **Spies** -- espionage operations (sabotage, tech theft) against foreign civilisations.
- **Promotions** -- citizens can be promoted to specialised roles (Admiral, Exterminator, Invader, Navigator, Privateer, Infiltrator, Mobster), each requiring specific resources.

**GalCiv IV: Supernova:**
- Citizens represent actual population units, each with individual stats:
  - **Intelligence** -- research output
  - **Social Skills** -- wealth generation
  - **Diligence** -- manufacturing and farming
  - **Resolve** -- planetary defence
  - **Expectations** -- modifies approval ratings
- **Biology types** affect growth and capabilities:
  - Carbon Based -- require food for growth, vulnerable to famine
  - Silicon Based -- no food needed, slow growth unless Promethion available
  - Aquatic -- +1 to four resource types, unlock aquatic improvements
  - Ammonia Based -- accelerate growth in polluted environments
  - Synthetic -- no food, fabricate population, can colonise extreme worlds
- **Multi-species planets** -- different species coexist on the same world, each contributing their biological bonuses.
- **30+ species** each with distinct stat modifiers (e.g. Drengin: +3 Resolve; Zombies: +2 Growth, -2 Intelligence).
- Citizens contribute their stats as modifiers to Core World planetary output.
- Growth rates vary dramatically by species -- Synthetic citizens expand fastest, organic species face food constraints.

### What makes it compelling

- **Individual citizens matter** -- each citizen has stats that affect their planet's output, creating a sense that population isn't just a number but a collection of individuals.
- **Multi-species empires** -- conquering or integrating alien species gives you access to their biological advantages. A human empire with Drengin soldiers and Altarian researchers is mechanically different from a pure human empire.
- **Biology creates asymmetry** -- Synthetic civilisations play fundamentally differently from Carbon-based ones because they don't need food. This is a more interesting form of faction differentiation than stat bonuses.
- **Commander assignment to ships** is a great RPG-lite mechanic -- named characters with stats leading your fleets creates narrative moments.

### Problems and criticisms

- **Micromanagement at scale** -- managing individual citizen assignments across 20+ planets becomes tedious.
- **Citizen generation rate (every 10 turns in GalCiv III)** is too slow to feel impactful early game.
- **Species balance issues** -- Synthetic civilisations are dramatically stronger than organic ones because they bypass the food system entirely.
- **Stat system is opaque** -- how Intelligence translates to actual research output is not clearly communicated.

### Application to Ex Nihilo

- **Adopt named leaders/commanders** with individual stats and traits. These can lead fleets, govern planets, and conduct espionage. This adds RPG flavour to the strategy layer.
- **Population as a resource, not micromanaged individuals** -- rather than GalCiv IV's per-citizen stats, use population as a number with species-level modifiers. This gets the multi-species benefit without the micromanagement cost.
- **Species biology should matter** -- different species requiring different environments and resources (as in GalCiv IV) creates meaningful colonisation decisions. An ammonia-breathing species can colonise worlds you can't, making alien allies valuable.
- **Leader assignment to fleets** -- adopt the Commander system. Named officers with stats (+combat, +speed, +morale) who gain experience and can die in battle creates narrative attachment.
- **Avoid the "Synthetic supremacy" problem** -- if including artificial species, ensure they have meaningful disadvantages (e.g. vulnerability to EMP weapons, inability to use biological tech) to balance their food advantage.

---

## 9. Planet Management

### How it works in GalCiv

**GalCiv III:**
- Planets are classified from **Class 0** (uninhabitable) to **Class 26** (paradise). Class determines available tiles (roughly 3-12 tiles depending on quality).
- Each planet has a hex grid for placing improvements. Higher-class planets have more tiles.
- **Tile Bonuses** -- special tiles with coloured icons grant bonuses to specific improvement types:
  - Purple = Tourism, Red = Military, Orange = Manufacturing, Green = Population, Blue = Research, Light Blue = Influence, Aqua = Approval, Yellow = Wealth
  - Each bonus has a direct effect (e.g. Cataract: +3 Manufacturing) and an adjacency effect (e.g. +1 Research).
  - 16 distinct tile bonus types (Ancient Ruins, Caverns, Flood Plains, Geothermal Springs, etc.).
- **Adjacency Bonuses:**
  - Similar improvements placed next to each other gain stacking bonuses.
  - Single factory: +25% manufacturing. Two adjacent factories: +5% each (10% total gain). Three in a triangle: +10% each (30% total gain). Three in a line: only the middle one reaches level 2 (+20% total).
  - **Triangular placement > linear placement** for adjacency optimisation.
  - Colony Capital provides adjacency bonuses to all improvement types.
- **Improvement types:** Economic (factories), Morale (meditation centres), Military (resistance buildings), Special (require galactic resources for higher payoffs), Wondrous (one-per-empire unique buildings like Hyperion Shipyard).
- **Terraforming** increases planet class, unlocking additional tiles. Three terraforming techs each add tiles (+3 per tech for Class 4 and below; +1 per tech for Class 5+).
- **Population** expands through city improvements. Carbon-based need food; Silicon-based need Promethion; Synthetics need neither. Food is a global resource pooled across all planets.

**GalCiv IV: Supernova:**
- **Core Worlds vs Colonies:**
  - Core Worlds: Class 10+ with an assigned Governor. Full hex grid management.
  - Colonies: auto-contribute raw resources to nearest Core World. No building placement needed.
  - This means a 50-world empire might have only 9 Core Worlds to actively manage.
- **Resource Decay** -- colonies further from their Core World contribute less.
- **Planet types** determine resource biases:
  - Mountainous: wealth and manufacturing, little food
  - Volcanic: rich manufacturing, some research, little food
  - Terran: balanced
  - Arboreal: lots of food
  - Paradise: strong across all outputs plus Influence
- **Governors** -- leader characters assigned to Core Worlds, boosting output and enabling manual control.
- **Executive Orders** -- instant empire-wide actions costing Control resource (1 per turn from capital, more from advanced structures). Examples: Draft Colonists (spawn colony ship, 12-month cooldown, -2% approval), Print Money, Emergency Speed, Telescope Takeover.

### What makes it compelling

- **Adjacency puzzles** -- optimising tile placement on each planet is a satisfying spatial puzzle. The triangular-vs-linear difference rewards thoughtful planning.
- **Planet types create identity** -- a volcanic world naturally becomes a manufacturing hub, while an arboreal world becomes a food producer. Geography drives strategy.
- **Core World / Colony split** is the best quality-of-life feature -- it solves the classic 4X "50 planets to manage" problem while keeping the strategic depth for key worlds.
- **Terraforming gives planets growth arcs** -- a small world that you terraform over time becomes increasingly valuable, creating long-term investment.
- **Tile bonuses create interesting land grabs** -- a planet with a Rare Earth tile (+2 Research, +1 Manufacturing adjacency) is more valuable than its class alone suggests, creating competition for specific worlds.

### Problems and criticisms

- **Adjacency system is tedious at scale** -- optimising placement across 10+ Core Worlds becomes a chore rather than a puzzle.
- **Terraforming progression is slow and unexciting** -- three techs that add a few tiles each is mechanically correct but narratively flat.
- **Colony auto-management is too opaque** -- players can't easily see what a colony is contributing or why its output is low.
- **Building variety is insufficient** -- many improvements feel interchangeable (Factory I, Factory II, Factory III), lacking the distinctive character of improvements in games like Civilization.

### Application to Ex Nihilo

- **Adopt Core World / Colony distinction** -- this is essential for playability. Limit active management to 5-10 key worlds maximum.
- **Use a simpler adjacency system** -- rather than per-tile bonuses, consider district-based zones (industrial district, research district, cultural district) where placing buildings of the same type in the same district grants bonuses. Less spatial puzzle, more strategic zoning.
- **Planet types should drive specialisation** -- carry over the idea that planet geography naturally suggests a role (mining world, farm world, fortress world).
- **Terraforming as a major project** -- rather than three incremental techs, make terraforming a single massive investment that dramatically transforms a planet. More satisfying, less tedious.
- **Unique planetary features** -- go beyond GalCiv's tile bonuses. Include Ancient Ruins (provide one-time tech bonuses), Hostile Fauna (require clearance before building), Rare Minerals (boost specific ship components), and other features that make each planet memorable.
- **Executive Orders are excellent** -- adopt this system. Instant, powerful actions with cooldowns and costs create "crisis management" moments without adding micromanagement.

---

## 10. AI Quality

### How it works in GalCiv

**Design Philosophy (Brad Wardell):**
- GalCiv was the first commercial game to be multithreaded, specifically to give the AI more processing power without making players wait.
- Core principle: **the AI should play by the same rules as the human.** At lower difficulties, it doesn't cheat; it simply plays less optimally.
- Wardell describes this as "instanced adaptive AI" -- the AI learns and responds to different player strategies.
- The AI engine is "pretty much unrivaled in terms of the power it can bring to bear" according to Stardock.

**Difficulty Scaling (GalCiv III):**
- **Beginner:** AI production at 25%, fleet power at 75%
- **Easy:** AI production at 75%, fleet power at 90%
- **Normal:** Human gets +6% credits per turn; AI plays at 100% economy
- **Suicidal:** AI gets 40% chance of free war tech, 40% chance of 20 free ideology points, 300% research, 400% production, 400% credits/turn, +3 population cap, 230% growth, 200% fleet power
- At sub-Normal intelligence, AI economy runs at 50%. At Bright and above, 100%. Higher levels enable advanced algorithms that counter known human tactics.

**GalCiv IV:**
- AI quality improved so significantly that the default difficulty was reduced from Normal to Easy.
- **Godlike difficulty** gives approximately 4x speed, 4x hull, 4x economy.
- AI is particularly noted for strong colonisation and resource seizure in the early game.
- **AlienGPT** -- uses generative AI (LLMs) to create unique civilisation descriptions, backstories, and dialogue for custom factions.

### What makes it notable

- **Fair play philosophy** -- at Normal and below, the AI doesn't receive bonuses. It wins (or loses) based on the quality of its decision-making. This is rare in 4X games.
- **Strong early-game play** -- the AI is notably good at land grabs, expansion timing, and resource denial. Many players are caught off guard by AI rush strategies.
- **The AI designs its own ships** -- it analyses enemy fleet compositions and builds counter-designs, engaging with the ship design system the same way a human would.
- **Diplomatic intelligence** -- the AI forms coherent alliances based on ideology, responds to threats proportionally, and doesn't declare suicidal wars (at higher difficulties).
- **Background computation** -- multithreaded AI calculates in the background during the human turn, meaning AI turns resolve nearly instantly.

### Problems and criticisms

- **Difficulty bonuses are front-loaded** -- "AI difficulty bonuses heavily favour the early game and taper off towards mid and late game," which is the opposite of what players want (challenge should increase over time).
- **High-difficulty AI cheats significantly** -- despite the "fair play" philosophy, Suicidal difficulty gives 400% production and 300% research, which is massive cheating.
- **AI is predictable in the late game** -- games often devolve into "player vs one remaining AI empire" as the AI fails to form effective coalitions against a leading player.
- **AI tech trading among itself** -- AI factions trade technologies freely, which diffuses unique techs and makes all AI empires converge towards similar tech levels.
- **Campaign AI was weak** -- the scripted campaign scenarios were "easily beaten on high difficulty."

### Application to Ex Nihilo

- **Adopt the "fair play" philosophy** at lower difficulties -- the AI should not receive production bonuses below Normal difficulty. Instead, lower difficulties should make the AI play more conservatively and make suboptimal decisions.
- **Scale difficulty through AI behaviour, not bonuses** -- at higher levels, the AI should form coalitions against the leading player, perform more complex ship counter-design, and execute multi-front strategies. Reserve numerical bonuses for the highest 1-2 difficulty levels only.
- **Invest in strong early-game AI** -- the opening land grab is where most 4X games are won or lost. Ensure the AI expands efficiently and contests key systems.
- **Background AI computation** -- if Ex Nihilo uses turn-based resolution, compute AI turns in the background during the human turn.
- **AI ship counter-design** -- this is a unique GalCiv strength. The AI should analyse the player's fleet composition and design ships with matching defences, creating a genuine arms race.
- **Anti-snowball coalitions** -- the AI should recognise when one player (human or AI) is running away with the game and form alliances to contain them. GalCiv's AI fails at this late-game; Ex Nihilo should prioritise it.
- **Don't use LLMs for core AI** -- GalCiv IV's AlienGPT is for flavour text, not decision-making. Keep the strategic AI deterministic and testable.

---

## Summary: Key Lessons for Ex Nihilo

### Must-Adopt Mechanics
1. **Core World / Colony distinction** -- solves late-game micromanagement without sacrificing depth
2. **Hull size / logistics fleet composition** -- creates meaningful fleet-building decisions
3. **Dynamic influence borders** with exponential decay -- makes the galaxy feel alive
4. **Ship counter-design gameplay** -- espionage reveals enemy loadouts, you redesign ships to exploit weaknesses
5. **Executive Orders** -- instant powerful actions with cooldowns for crisis management
6. **Named leaders/commanders** assigned to fleets and planets for RPG flavour

### Should-Adopt with Modifications
7. **Ideology system** -- use three axes (not seven), tie to exclusive content rather than just stat bonuses
8. **Tech trading** -- allow it, but make unique racial techs non-tradeable (reverse-engineer instead)
9. **United Planets / galactic council** -- adopt but make it more impactful than GalCiv's underdeveloped version
10. **Adjacency bonuses** -- simplify into district-based zoning rather than per-tile optimisation

### Must-Avoid Pitfalls
11. **Non-interactive combat** -- always give the player some input during battles
12. **No retreat mechanic** -- always allow disengagement with a penalty
13. **Boring ground invasions** -- invest in making planetary assault meaningful
14. **Late-game tedium** -- ensure influence victory, diplomatic victory, and economic victory all require active play
15. **AI difficulty through pure stat bonuses** -- scale through behaviour first, bonuses second
16. **Arbitrary economic caps** -- don't punish successful economic play
17. **Overwhelming ship designer** -- provide auto-design and suggested loadouts for accessibility

### Unique Opportunities for Ex Nihilo
- **Wormhole-based trade routes** visible as freight convoys, creating piracy and escort gameplay
- **Reverse-engineering captured ships** instead of tech trading for alien technology
- **Terraforming as a dramatic single project** rather than incremental upgrades
- **Cultural "achievements"** requiring active play for influence victory
- **Constellation-themed tech web** matching the space setting
- **Species biology** driving colonisation strategy (different species for different worlds)
