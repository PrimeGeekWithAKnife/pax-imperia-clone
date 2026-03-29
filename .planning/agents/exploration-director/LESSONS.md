# Exploration Director -- Lessons Learnt

## Current State
- Galaxy generation creates star systems with wormhole connections
- Multiple planet types (terran, ocean, desert, ice, volcanic, gas_giant, barren, toxic)
- Varied atmospheres
- Anomaly types exist (anomaly.ts)
- Basic fog of war (systems have a discovered map per empire)
- First contact events implemented (first-contact.ts)
- Minor species exist (minor-species.ts)
- Missing: planet stat uncertainty, multiple scanner types, dedicated science ships, xeno-archaeology, excavation sites, narrative event chains, dangerous encounters, space phenomena

## Key Design Principle
- Stellaris anomaly outcomes are fixed (no RNG on results) but more valuable anomalies take longer -- genuine trade-off between exploring quickly and investigating thoroughly
- "50 excellent anomaly chains are worth more than 500 generic ones" -- quality over quantity
- Exploration should have technology gates to keep it relevant throughout the game

## Director Decisions (29 March 2026)
- Two-tier observation: long-range (rough info) vs active scanning (exact specifics, ruins, resources)
- Some knowledge requires physical presence: archaeology, experiments, expeditions
- Misinformation possible: natural phenomena AND deliberate spoofing by enemies
- Science modules go on any ship; dedicated science vessels trade weapons for scanner slots
- Knowledge is competitive: first-scanner gets exclusive intelligence, can deny rivals
- Science ships also serve as support: fleet repair, medical, humanitarian, refugee operations
- Archaeology is planetary building + expedition ships -- both approaches valid
- Precursors were vast 100+ world empire, close to solving Devourers before being wiped out
- Breadcrumbs through ruins: accounts, recordings, evidence of greater threat
- Dangerous discoveries are player-choice risk-reward, not forced punishment
- Phenomena are exploitable (nebula cover, black hole energy, pulsar weapons research)
- Galaxy is dynamic: stars nova, nebulae shift, orbits change habitability
- Handful of unique landmark systems (precursor homeworld, impossible wormhole, signal star, etc.)
- Event chains branch by species -- same discovery, different story
- Varied subplot lengths (2-3 step quick finds through 8-10+ step campaign subplots)
- Some chains competitive between empires -- races to claim the prize
