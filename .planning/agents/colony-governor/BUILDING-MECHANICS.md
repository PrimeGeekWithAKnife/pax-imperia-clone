# Building Mechanics — Director's Notes

## Time Scale

**1 tick = 1 day.** All durations calibrated to this:
- Power plant lifespan: ~30 years = ~10,950 ticks
- Building construction: measured in days
- Research: measured in days
- Population growth: daily increments
- Waste accumulation: daily

## Core Building Properties

Every building has ALL of these:

| Property | Description |
|---|---|
| **Build time** | Days to construct |
| **Build cost** | Credits, minerals, rare elements, etc. |
| **Maintenance cost** | Daily cost in credits (and possibly other resources) |
| **Energy consumption** | Daily energy draw — ALL buildings consume energy |
| **Production output** | What the building produces per tick |
| **Waste output** | How much waste the building generates per tick |
| **Happiness impact** | Positive (entertainment) or negative (factory, mine) |
| **Condition** | 0-100%. Decays when maintenance unpaid. Non-functional at 70%. Unrepairable below 30% (must demolish+rebuild) |

## Waste System

### Planetary Waste
- Waste is a **planetary stat** — total from all buildings + population
- **Waste Dump** building stores X waste before overflow
- **Waste-to-space ratio**: planet size vs waste production determines sustainability
- When waste overflows:
  - Population gets angry (happiness penalty, escalating)
  - Health effects accumulate (mortality increase)
  - Protests may damage buildings or halt production
  - Pop-up events alert the player
- Waste can be **exported** — costly in credits + energy, requires research + "Planetary Waste Ejector" (orbital building)

### Waste by Building Level
- **Higher levels = cleaner**: L1 factory produces most waste, L5 produces least
- Higher levels also: more productive, less energy, lower maintenance, nicer on environment, may add happiness or research

### Waste by Source
- **Mining** produces the MOST waste
- **Factories** produce moderate waste
- **Population centres** produce small waste
- **Power plants** produce some waste (fuel byproducts)
- Most other buildings produce minimal waste

### Species-Specific Waste
- Some species are "dirty" — produce more waste, less susceptible to its effects
- Conquering a dirty species' planet = toxic waste dump requiring massive cleanup + terraforming
- Clean/biological species (Sylvani) might produce compostable waste

### Waste Buildings
- **Waste Dump** — stores waste, delays overflow. Cheap but finite.
- **Recycling Plant** — actively reduces waste per tick. Existing building, role expanded.
- **Atmosphere Cleanser** — reduces atmospheric pollution, improves habitability
- **Orbital Waste Ejector** — exports waste to space (requires research). Expensive but eliminates waste.

## Energy System

### Every Building Consumes Energy
No exceptions. Power plants produce it, everything else consumes it.

### Power Grid View
- Planet has a dedicated "Power Grid" UI showing:
  - Total energy production available
  - Each building's energy state (on/off toggle)
  - Player clicks to enable/disable power to specific buildings
- Buildings below **30% power** cannot produce anything
- **Energy does NOT naturally accumulate** — unused energy is wasted
  - Unless the species has a natural energy storage ability
  - Or the player researches **energy retention technology**
  - Advanced energy storage devices (batteries, capacitors) as buildable infrastructure

### Power Plant Lifecycle
- L1 power plants run on fission (common minerals), lifespan ~30 years (10,950 ticks)
- L2 fusion (rare elements), longer lifespan
- L3+ antimatter (exotic materials), longest lifespan
- **Fuel availability rule**: A race cannot develop tech that runs on resources they can't obtain. Tech tree gating must match resource accessibility.
- At end of lifespan: pop-up with choices:
  1. **Recommission now** — costs credits, brief downtime
  2. **Reduced capacity** — extends life by ~10 years (once only), output drops
  3. **Risk it** — keep running at full, chance of failure/shutdown each tick

### Recommission
- Automatic if player has funds
- If insufficient funds → manual trigger required
- Pop-up warns of decreased efficiency and instability

## Building Condition & Decay

### Condition Scale (0-100%)
- **100%**: Perfect condition
- **70-99%**: Functional but degrading. Output may decrease slightly.
- **70%**: **Non-functional threshold** — building stops producing
- **30-69%**: Non-functional, repairable. Costs credits + time to restore.
- **Below 30%**: **Unrepairable** — must be demolished and rebuilt. Demolition costs time.

### Decay Rate
- Decay is **slow** — buildings are durable. A shipyard without maintenance doesn't crumble overnight.
- Decay rate depends on building type:
  - Heavy industry (factory, shipyard): slower decay (built tough)
  - Delicate systems (research lab, medical): faster decay (sensitive equipment)
  - Food production (hydroponics): fastest decay (biological systems)
- Logic: "How long would a real building of this type last without maintenance?"

### Repair
- Costs credits + time
- Speed depends on construction trait + available workers
- Buildings above 30% can be repaired in-place
- Buildings below 30% must be cleared (demolition time) then rebuilt (full build time)
- Repair is also relevant for **ground combat damage** — same condition system applies

## Building Level Progression

### Level Benefits (stacking compound)
- L1: Base stats
- L2: +20% output (on base)
- L3: +25% on new total
- L4: +30% on new total
- L5: +35% on new total

### Level Also Improves
- **Waste reduction** per level (cleaner operations)
- **Energy efficiency** per level (less draw)
- **Happiness impact** per level (nicer facilities)
- **Maintenance reduction** per level (more reliable)
- These curves are **species-specific**: a Khazari factory L3 might be more productive but dirtier than a Sylvani factory L3

### Population Centre Specifics
- Increases **max population capacity** by a race-specific amount (e.g., Teranos +1500K per centre, Zorvathi +800K)
- Level modifier applies to the capacity bonus
- Also provides small organics output and growth rate bonus

### Medical Bay Specifics
- Reduces mortality rate
- Boosts population growth
- Provides plague resistance (relevant for espionage-engineered plagues)
- Helps troops on the planet recover from injuries
- **Makes medical facilities strategic targets** for sabotage prior to invasion

## Notification System

### Pop-Up Events (Auto-Pause)
Critical events pause the game and show a modal:
- "Your [system/fleet] is under attack!"
- "Power Plant on [planet] nearing end of fuel cycle" (with recommission choices)
- "Waste overflow on [planet] — population is protesting"
- "No active research — click Research to select a project"
- "Building [X] on [planet] has become non-functional due to neglect"
- "Colony on [planet] is starving"

### "Do Not Alert Me Again" Checkbox
- Each event type can be individually silenced
- Silenced events still appear in the event log
- Experienced players can dismiss repeated alerts
- Critical military events (under attack) should NOT be silenceable

## New Buildings Needed

| Building | Purpose | Tech Required |
|---|---|---|
| **Waste Dump** | Stores waste, delays overflow | None (basic) |
| **Atmosphere Cleanser** | Reduces atmospheric pollution | Environmental tech |
| **Orbital Waste Ejector** | Exports waste to space | Advanced waste tech |
| **Energy Storage** | Stores unused energy for later | Energy retention tech |
| **Barracks** | Houses troops (future sprint) | None |
| **Water Treatment** | Health + waste reduction | Basic biology |

## Open Questions Resolved
- ~~What does a tick represent?~~ → 1 day
- ~~How fast does decay tick?~~ → Slow, building-type dependent
- ~~Power priority UI?~~ → Power Grid view with on/off toggles per building
- ~~Building level curve?~~ → Compound stacking, species-specific modifiers
- ~~Troops?~~ → Separate sprint, but medical bay already supports healing them
- ~~Notifications?~~ → Auto-pause pop-ups with "do not alert again" per event type

## Still Open
- Exact waste output numbers per building type and level
- Exact energy consumption numbers per building type
- Species-specific level curves (which species gets bonuses where)
- How many ticks between decay points when maintenance is unpaid
- Energy storage capacity per storage building level
- Waste dump capacity per level
- Ground combat mechanics (separate sprint)
