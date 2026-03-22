# Planet Technology Research & Design Document
## Ex Nihilo — Advanced Planetary Systems

*Research document for Phase 6 / late-game implementation. Written March 2026.*

---

## Research Basis

This document draws on three primary reference games, each representing a different design philosophy:

**Alpha Centauri (Firaxis, 1999):** Per-tile terrain improvement by worker units. Ecological damage accumulates from heavy development and triggers native lifeform attacks. Secret Projects act as one-per-faction wonders. The critical lesson: industrial growth creates meaningful ecological cost; boreholes and condensers produce spectacular yields but degrade planet health.

**Stellaris (Paradox, 2016–present):** Civilisation-scale terraforming — entire planet class conversions costing 2,000–12,500 energy and 5–25 in-game years. Robot pops as workers; planet automation via AI governors; megastructures (Dyson Sphere: 6 stages, 55,000 alloys, up to 4,000 energy/tick; Ring World: 4 segments each equivalent to a size-10 planet). The lesson: megastructures need to be once-per-empire or once-per-system to retain strategic weight.

**Master of Orion 2 (Microprose, 1996):** Incremental biome upgrade (barren → desert → arid → swamp/tundra → terran) requiring repeated researcher investment. Pollution degrades biomes: reaching 100% pollution drops a planet one biome class. Biospheres add +2 population capacity. Toxic planets cannot be terraformed at all without a Radiation Shield prerequisite. The lesson: multi-step terraforming with degradation risk creates genuine long-arc strategy.

---

## Design Principles (Ex Nihilo Context)

Before detailing each system, the following principles apply across all planet technologies:

1. **Real-time with pause.** All timers below are in game-hours at 1x speed. 1 game-day = 1 real-second at 1x speed, so "300 game-days" ≈ 5 real-minutes at 1x speed before speed modifiers.
2. **Resource pool is empire-wide.** Costs below are drawn from the empire's pooled resources (credits, minerals, energy, etc.) not per-planet stockpiles.
3. **Building slots are sacred.** Most of these systems were designed explicitly to respect the per-planet building slot cap. Orbital structures do not consume surface slots.
4. **Species origin matters.** Bioengineering-origin species should get significant terraforming cost/speed advantages. Industrial-origin species should get mining advantages. Cybernetic-origin species benefit most from computing tech.
5. **No free late-game scaling.** Every system here has a meaningful cost, risk, or trade-off that keeps it from trivialising mid-game strategy.

---

## 1. Terraforming

### Design Intent

Terraforming is a multi-decade (in-game) project that transforms a planet's fundamental character. It is not a quick fix — it is an empire-level investment in a specific world's long-term value. It should be available mid-game but only pay off late-game, rewarding players who plan ahead.

Inspired primarily by Master of Orion 2's incremental biome chain, with Stellaris's resource cost model and Alpha Centauri's ecological risk layer.

---

### Stage System Overview

Terraforming proceeds through four sequential stages. Each stage is a separate project that must complete before the next can start. Stages cannot be skipped. Intermediate states are persistent — if you abandon terraforming mid-process, the planet stays in its intermediate state permanently unless you resume.

| Stage | Name | What it changes | Unlock tech | Time (game-days @ 1x) |
|-------|------|-----------------|-------------|----------------------|
| 1 | Atmospheric Processing | Atmosphere type | Atmospheric Engineering (Age 3) | 180–360 |
| 2 | Thermal Regulation | Temperature (Kelvin band) | Stellar Climate Control (Age 3) | 240–480 |
| 3 | Biosphere Engineering | Add/remove native life, organics yield | Xenobiology (Age 4) | 360–720 |
| 4 | Full Terraforming | Planet type conversion | Advanced Terraforming (Age 4) | 600–1200 |

Time ranges reflect planet size (tiny at minimum, massive at maximum).

---

### Stage 1: Atmospheric Processing

**What it does:** Converts one atmosphere type to another, one step at a time along the conversion graph. Cannot skip intermediate atmosphere types.

**Conversion graph:**
```
vacuum ──► none ──► carbon_dioxide ──► nitrogen ──► oxygen_nitrogen
                                  └──► methane ──► ammonia
toxic ──► sulfur_dioxide ──► carbon_dioxide
hydrogen_helium ──► hydrogen ──► none
```

Each arrow is one stage-1 project. Converting `vacuum` to `oxygen_nitrogen` requires four consecutive stage-1 projects.

**Cost per project:**
- 600–2,400 energy (scales with how many steps from current state)
- 200–800 minerals (building the processing infrastructure)
- Maintenance: 4 energy/day during the project

**Prerequisites:**
- Atmospheric Engineering technology (Age 3, Biology/Adaptation tree)
- Terraforming Station building on the planet (Medium+ size required)
- Planet is colonised

**Risks:**
- 3% chance per project of an Atmospheric Accident event (reduces planet population by 5–15%, triggers 30-day "processing malfunction" pause). Bioengineering species: 1%. Industrial species: 5%.
- If the planet has the Toxic Atmosphere condition, stage 1 must complete first before that condition can be removed (it is not removed automatically).

**Species advantage — Bioengineering origin:** Stage 1 costs 40% less energy and completes 25% faster.

---

### Stage 2: Thermal Regulation

**What it does:** Moves the planet's temperature band toward a target range by deploying orbital solar reflectors (cooling) or greenhouse injectors (warming). Temperature changes by one band per project.

**Temperature bands (Kelvin ranges):**
| Band | Range | Typical planet |
|------|-------|---------------|
| Frozen | < 150K | Ice, outer barren |
| Cold | 150–250K | Ice, tundra |
| Cool | 250–290K | Temperate, partial ice |
| Temperate | 290–330K | Terran, ocean |
| Warm | 330–380K | Desert, arid |
| Hot | 380–500K | Desert, inner volcanic |
| Scorching | > 500K | Volcanic, inner barren |

Each project moves one band. Moving from Frozen to Temperate requires four stage-2 projects in sequence.

**Cost per project:**
- 800–3,200 energy (scales with target distance from habitable range)
- 400–1,600 rare elements (orbital regulator components)
- Maintenance: 6 energy/day during the project

**Prerequisites:**
- Stellar Climate Control technology (Age 3, Biology/Adaptation tree)
- Stage 1 complete (atmosphere must be stable before thermal work begins)

**Risks:**
- Extreme heating projects on Volcanic planets: 5% chance of triggering a Seismic Event, destroying one random building and adding the Seismic Instability condition for 120 days.
- Extreme cooling projects on planets with large oceans: 5% chance of Glaciation Event, halving organics output for 90 days.

**Side effect — star type interaction:** Planets orbiting red dwarfs start with a temperature penalty. Stellar Climate Control is more expensive for these worlds (+30% energy cost). Blue giant planets start scorching and require more cooling steps.

---

### Stage 3: Biosphere Engineering

**What it does:** Introduces, modifies, or removes a native biosphere. Adds or removes the `Fertile Biosphere` condition. Grants or strips organic resource yields. Prerequisite for converting Barren or Ice planets to Terran — you cannot have a living Terran world with no biosphere.

**Sub-projects within Stage 3:**

| Sub-project | Effect | Cost |
|-------------|--------|------|
| Seed Microbial Life | Adds basic organics +5/day; marks planet as "proto-biosphere" | 1,000 organics, 180 days |
| Introduce Complex Flora | Adds +15 organics/day; begins oxygen generation bonus | 600 organics, 240 days |
| Introduce Fauna | Adds Fertile Biosphere condition; +25% pop growth | 800 organics, 300 days |
| Sterilise Biosphere | Removes all native life; removes Fertile Biosphere; resets to stage 2 state | 1,200 energy, 120 days |
| Adapt Native Life | Modifies existing biosphere to be compatible with your species' biology; +15% habitability | 1,200 organics, 360 days |

**Prerequisites:**
- Xenobiology technology (Age 4, Biology/Adaptation tree)
- Stage 2 complete (temperature must be in acceptable range for life)
- Atmospheric Processing must have reached oxygen_nitrogen, nitrogen, or methane (life-compatible atmospheres)

**Risks:**
- 4% chance per sub-project of an Evolutionary Contamination event: a competing micro-organism colonises the planet, reducing habitability by 10 and adding the Hostile Fauna condition until a Military Academy is built.
- Removing life (Sterilise) from a planet with existing `Fertile Biosphere` permanently lowers the planet's max `naturalResources` ceiling by 10.

**Ecological cost:** Each Stage 3 sub-project adds +10 to an internal "Ecological Pressure" score on the planet. At Ecological Pressure ≥ 50, a random stage-1 atmospheric incident becomes possible each 30-day cycle. This represents fragile new biospheres being destabilised by continued industrial activity — pollution (see Section 4) compounds this.

---

### Stage 4: Full Terraforming (Planet Type Conversion)

**What it does:** Converts the planet type itself, changing its category in `PlanetType`. This changes which buildings can be built, adjusts the max population ceiling, and modifies base resource outputs.

**Allowed conversions:**

| From | To | Prerequisite stages | Time | Cost |
|------|----|--------------------|------|------|
| Barren | Desert | 1, 2 | 600d | 6,000 energy, 2,000 minerals |
| Barren | Ice | 1, 2 | 600d | 6,000 energy, 2,000 minerals |
| Desert | Terran | 1, 2, 3 | 900d | 10,000 energy, 4,000 minerals, 2,000 organics |
| Ice | Terran | 1, 2, 3 | 900d | 10,000 energy, 4,000 minerals, 2,000 organics |
| Desert | Ocean | 1, 2, 3 | 1,000d | 12,000 energy, 3,000 minerals, 3,000 organics |
| Toxic | Barren | 1 | 480d | 8,000 energy, 1,000 rare elements |
| Volcanic | Desert | 1, 2 | 720d | 9,000 energy, 3,000 minerals |
| Terran | Ocean | 3 only | 400d | 5,000 energy, 1,000 organics |
| Any | Toxic | — | Not allowed. Cannot weaponise a colony. | — |
| Gas Giant | Any | — | Not allowed. Gas giants are not terraformable. | — |

**Prerequisites:**
- Advanced Terraforming technology (Age 4)
- All preceding stages must be complete
- Planet must be colonised (can't terraform uninhabited worlds)
- Planet size must be Small or larger

**Population impact:** During Stage 4, population growth is paused. Current population may not exceed 75% of pre-terraform max population cap. If population exceeds this, the project cannot start — a clear strategic signal to start terraforming early.

**Completion effect:** Planet type is updated in the data model. New max population caps, building type eligibilities, and resource output modifiers apply immediately. The Terraforming Station building converts to a permanent Ecological Monitoring Centre (no slot cost change — it occupies the same slot but changes function to provide +10% organics and early warning of ecological risks).

---

### Terraforming: Implementation Notes

The `Planet` interface needs additions:

```typescript
interface Planet {
  // existing fields...
  terraformingStage: TerraformingStage | null;
  terraformingProgress: number;          // 0.0 to 1.0
  ecologicalPressure: number;            // 0–100
  targetAtmosphere: AtmosphereType | null;
  targetTemperatureband: TemperatureBand | null;
  targetPlanetType: PlanetType | null;
}

type TerraformingStage = 'atmospheric' | 'thermal' | 'biosphere' | 'conversion';
type TemperatureBand = 'frozen' | 'cold' | 'cool' | 'temperate' | 'warm' | 'hot' | 'scorching';
```

A `BuildingType` of `'terraforming_station'` already exists in the design doc. It should be added to the `BuildingType` union in `galaxy.ts` and defined in `buildings.ts`.

---

## 2. Space Stations (Orbital Structures)

### Design Intent

Space stations are orbital structures that do not consume planet building slots. They are the primary mechanism for developing Gas Giants, extending capabilities to hostile worlds, and layering additional military/economic output onto valuable planets without sacrificing surface development slots.

Inspired by Stellaris's orbital habitats and MoO2's Orion-type orbital stations.

---

### Core Mechanic

Space stations are built using a special Orbital Construction Yard (a prerequisite building, Medium+ surface slot) and require the Orbital Engineering technology (Age 3). Once the yard exists, orbital structures are queued separately from the planet's surface build queue — effectively a second, parallel build queue.

**Maximum orbital structures per planet:** 1 per planet by default. Advanced Orbital Engineering (Age 4) raises this to 2. Megastructure tech (Age 5) allows 3.

Gas Giants skip the Orbital Construction Yard requirement and instead use an Orbital Platform (already in the design doc) as their surface-equivalent anchor.

---

### Station Types

#### Research Station
**Function:** Generates bonus research points. Does not require population to staff — automated.
**Output:** +8 research points/day at level 1; scales to +20 at level 3.
**Cost:** 500 credits, 300 rare elements | Build time: 12 game-days
**Maintenance:** 3 energy/day
**Notes:** Stacks additively with Research Labs below. Strong choice for already-developed research worlds. Best synergy: Technocracy government, research-origin species.

#### Defence Platform
**Function:** Provides orbital weapons and point-defence batteries that fire during space combat at the planet. Equivalent to a Defence Grid but does not use a surface slot.
**Output:** Equivalent firepower to one destroyer at level 1; escalates to cruiser-equivalent at level 3.
**Cost:** 800 credits, 400 minerals | Build time: 16 game-days
**Maintenance:** 4 energy/day, 2 credits/day
**Notes:** Destroyed in combat and must be rebuilt. Cannot be captured — it self-destructs when the owning empire loses the system.

#### Trade Station
**Function:** A permanent orbital trading post that generates bonus credits independent of trade route connections.
**Output:** +12 credits/day at level 1; scales to +30 at level 3.
**Cost:** 600 credits, 200 minerals | Build time: 10 game-days
**Maintenance:** 2 energy/day
**Notes:** If the planet also has a Trade Hub and Spaceport, a 15% synergy bonus applies to the Trade Station's output. Best for commerce-specialised worlds.

#### Shipyard Platform
**Function:** Provides limited ship construction capability without a surface Shipyard. Can only build ships up to Destroyer class by default. Advanced tier allows Cruiser.
**Output:** Equivalent to a level-1 Shipyard but uses the orbital queue rather than the surface build queue.
**Cost:** 1,200 credits, 600 minerals | Build time: 20 game-days
**Maintenance:** 5 energy/day, 3 credits/day
**Prerequisites:** Surface Shipyard must exist on at least one planet in the system to unlock the design (blueprints are transmitted orbitally).
**Notes:** Allows contested or newly colonised worlds to produce military ships before surface development is complete. Does not allow ship upgrades — ships built here must travel to a surface Shipyard for component changes.

#### Mining Platform
**Function:** The only way to extract resources from Gas Giants and asteroid belts (Tiny planets with barren type). Mines Energy and Exotic Materials.
**Output (Gas Giant):** +6 energy/day, +2 exotic materials/day at level 1; scales to +15 energy, +5 exotic at level 3.
**Output (Asteroid/Tiny barren):** +8 minerals/day, +3 rare elements/day at level 1; scales to +20 minerals, +8 rare at level 3.
**Cost:** 400 credits, 300 minerals | Build time: 8 game-days
**Maintenance:** 3 energy/day
**Notes:** Essential for players who want Exotic Materials without colonising Volcanic or Toxic worlds. Multiple Mining Platforms can be built in the same system by building them over different Gas Giant moons or asteroid groupings — up to 3 per system.

#### Habitat Ring (Advanced)
**Unlock:** Age 4 (Dominion Age), Advanced Orbital Engineering tech
**Function:** A large-scale orbital habitat that functions as a small colony independent of the planet below. Has 8 building slots of its own, supports up to 20,000 population, and uses the `oxygen_nitrogen` atmosphere regardless of the planet below.
**Cost:** 3,000 credits, 1,500 minerals, 800 rare elements | Build time: 40 game-days
**Maintenance:** 10 energy/day, 5 credits/day
**Notes:** The Habitat Ring counts as a separate colony for population growth purposes. Can be built over Gas Giants, Barren worlds, or hostile planets — allowing effective colonisation of systems that would otherwise be unusable. 100% habitability for all species (closed-environment life support).

---

### Implementation Notes

A new `OrbitalStructure` interface is needed:

```typescript
interface OrbitalStructure {
  id: string;
  type: OrbitalStructureType;
  level: number;
  planetId: string;
  buildProgress: number;   // 0.0 to 1.0
}

type OrbitalStructureType =
  | 'research_station'
  | 'defence_platform'
  | 'trade_station'
  | 'shipyard_platform'
  | 'mining_platform'
  | 'habitat_ring';
```

The `Planet` interface in `galaxy.ts` should add:

```typescript
orbitalStructures: OrbitalStructure[];
orbitalBuildQueue: OrbitalBuildItem[];
```

---

## 3. Core Mining

### Design Intent

Core mining is a technology progression that gives poor planets a second chance. A Barren world with zero natural resources (naturalResources = 5 on a 0–100 scale) can, through sustained deep mining investment, become a significant minerals and rare elements producer. The trade-off is geological risk — mining too deep destabilises the planet.

Inspired by Alpha Centauri's Borehole mechanics (spectacular output, significant eco-damage) and MoO2's mining colony strategy.

---

### Progression Chain

Core mining is a four-tier research and building chain. Each tier unlocks the next.

| Tier | Building | Unlock tech | Build time | Cost | Output | Risk |
|------|----------|-------------|------------|------|--------|------|
| 1 | Surface Extractor | Basic Mining (Age 2) | 4d | 80cr, 40 min | +4 minerals/day | None |
| 2 | Deep Bore Array | Deep Drilling (Age 3) | 8d | 200cr, 100 min | +10 minerals/day, +3 rare/day | Low |
| 3 | Core Tap | Core Mining (Age 4) | 16d | 500cr, 250 min, 100 rare | +20 minerals/day, +8 rare/day, +2 exotic/day | Medium |
| 4 | Mantle Extraction Engine | Mantle Tapping (Age 5) | 30d | 1,200cr, 600 min, 400 rare, 100 exotic | +40 minerals/day, +20 rare/day, +8 exotic/day | High |

Each tier replaces (upgrades) the previous building — does not consume additional slots.

**Base output scaling:** All output values above are base rates. They multiply with the planet's `naturalResources` rating:
- naturalResources 0–20: 0.5× multiplier
- naturalResources 21–50: 1.0× multiplier
- naturalResources 51–80: 1.5× multiplier
- naturalResources 81–100: 2.0× multiplier

A Barren world with naturalResources = 5 and a Mantle Extraction Engine produces: 40 × 0.5 = 20 minerals/day — less than a rich world, but still valuable compared to having nothing.

---

### Geological Risk System

Deep Bore (Tier 2) and above introduce **Geological Instability**, a per-planet risk score.

- Each active deep mining tier adds a base instability increment per day.
- Instability builds up over time; it is reduced by the Seismic Dampeners upgrade (see below).
- At instability thresholds, random events fire:

| Instability level | Threshold | Event probability | Event type |
|-------------------|-----------|-------------------|------------|
| Stable | 0–25 | None | — |
| Stressed | 26–50 | 1% per 30 days | Minor tremors: 1 random building takes 50% damage |
| Unstable | 51–75 | 3% per 30 days | Seismic event: 1–2 buildings destroyed, output reduced 20% for 60d |
| Critical | 76–99 | 8% per 30 days | Major quake: 3+ buildings destroyed, population loss 5–15% |
| Rupture | 100 | Certain | Catastrophic rupture: planet gains Seismic Instability condition permanently; Core Tap/Mantle Engine auto-destroyed |

**Instability per day by tier:**
- Deep Bore: +0.05/day
- Core Tap: +0.15/day
- Mantle Extraction Engine: +0.40/day

**Seismic Dampeners upgrade** (researchable under Core Mining tech, Age 4): reduces instability accumulation rate by 60%. Mandatory for responsible Mantle Extraction.

**Stabilisation building:** Geological Survey Office (costs 300 credits, 100 minerals, 6-day build) provides +1 visibility into instability score (displayed as precise number rather than band) and reduces instability accumulation by 25%.

**Instability decay:** Instability naturally decays at 0.02/day when no Core Tap or Mantle Engine is active.

---

### Special Interaction: Volcanic Planets

Volcanic planets start with the Seismic Instability condition already applied. Core mining on Volcanic worlds:
- Deep Bore tier and above add 50% more instability per day.
- However, Volcanic worlds have a `naturalResources` bonus: treat as +20 to naturalResources for mining output calculations only.
- Volcanic worlds are the highest-risk, highest-reward mining targets in the game.

---

### Implementation Notes

Add `geologicalInstability: number` (0–100) to the `Planet` interface. The mining tier is tracked via the existing `Building` level system (e.g., `mining_facility` at levels 1–4 maps to Surface Extractor through Mantle Extraction Engine). Add geological instability tick logic to the game server's per-day update loop.

---

## 4. Environmental Technology

### Design Intent

Industrial growth has a cost. Alpha Centauri's ecological damage mechanic is the strongest precedent: if you mine, farm, and build aggressively, the planet pushes back. MoO2's pollution-degrades-biome system provides the consequence structure. Ex Nihilo combines both: pollution reduces habitability, degrades organics output, and interacts with the terraforming ecological pressure system from Section 1.

---

### Pollution Mechanics

**Pollution sources:** Industrial buildings generate pollution each game-day. Pollution is tracked as a per-planet score (0–200 scale). Above 100, consequences begin.

| Building | Pollution generated per day |
|----------|-----------------------------|
| Factory (each level) | +2 |
| Mining Facility (each level) | +1.5 |
| Core Tap / Mantle Engine | +5 |
| Power Plant (fossil-fuel era) | +3 |
| Shipyard | +2 |

**Pollution consequences:**

| Pollution level | Effect |
|----------------|--------|
| 0–25 | No effect |
| 26–50 | Habitability −5; organics output −5% |
| 51–75 | Habitability −15; organics output −15%; population growth −10% |
| 76–100 | Habitability −30; organics output −25%; population growth −25%; +5 ecological pressure per 30 days |
| 101–150 | Habitability −50; organics output −40%; population growth −40%; random building damage events (2% per 30 days) |
| 151–200 | Approaching biome degradation: planet type may downgrade one step (Terran → Desert, Desert → Barren) if pollution stays above 150 for 180+ consecutive days |

**Biome degradation** is the MoO2-inspired endgame of neglected pollution. It is permanent unless the planet is re-terraformed.

---

### Pollution Cleanup Buildings

| Building | Function | Cost | Build Time | Maintenance |
|----------|----------|------|------------|-------------|
| Atmospheric Scrubber | Reduces pollution −20/day | 200cr, 80 min | 4d | 3 energy/day |
| Recycling Complex | Reduces pollution −15/day; +2 minerals/day (recycled materials) | 180cr, 60 min | 4d | 2 energy/day |
| Bioremediation Centre | Reduces pollution −25/day; also reduces ecological pressure by 2/day | 400cr, 120 min, 60 organics | 8d | 3 energy/day |
| Orbital Waste Processor | Launches waste into stellar orbit; reduces pollution −40/day | 800cr, 300 min, 100 rare | 15d | 6 energy/day |

Cleanup buildings stack. A heavily industrialised world needs 2–3 cleanup structures to neutralise pollution from a full factory + mining complement.

---

### Green Technology Buildings

These buildings replace or supplement fossil-fuel power generation with zero-pollution energy sources.

| Building | Replaces | Output | Cost | Notes |
|----------|---------|--------|------|-------|
| Solar Farm | Power Plant (partial) | +6 energy/day, 0 pollution | 100cr, 50 min | Requires no maintenance. Output halved for ice/barren worlds (low stellar flux). |
| Wind Array | Power Plant (partial) | +5 energy/day, 0 pollution | 80cr, 40 min | Requires atmosphere (not valid on Barren/vacuum worlds). |
| Tidal Generator | Power Plant (partial) | +7 energy/day, 0 pollution | 120cr, 60 min | Ocean worlds only. Strongest early renewable. |
| Fusion Reactor | Power Plant (full replacement) | +18 energy/day, +1 pollution | 600cr, 200 min, 50 rare | Age 3 tech. Near-zero pollution. Replaces Power Plant slot. |
| Antimatter Plant | Fusion Reactor (full replacement) | +40 energy/day, 0 pollution | 2,000cr, 600 min, 200 rare, 50 exotic | Age 5 tech. The definitive energy building. |

**Pollution policy edict:** Government edict "Industrial Regulations" (costs 20 credits/day empire-wide) reduces all factory and mining pollution generation by 30% across all planets. Trade-off: production output −10%.

---

### Bio-Dome

**Function:** Allows a small, viable colony on an otherwise inhabitable world by creating a sealed pressurised habitat for the population. Does not change the planet's atmosphere or type. Think of it as a surface Habitat Ring.

**Stats:**
- Supports up to 5,000 population in hermetically sealed habitat
- +50% habitability for all species within (the Bio-Dome environment; does not affect the planet's raw habitability number)
- Allows building construction on Barren, Toxic, and vacuum worlds up to a cap of 8 total surface buildings (regardless of planet size)
- Pop growth in Bio-Dome is 50% slower than an open colony

**Cost:** 600 credits, 200 minerals, 80 rare elements | Build time: 12 game-days
**Maintenance:** 5 energy/day
**Prerequisites:** Bio-Dome Habitation technology (Age 3); planet must not already have oxygen_nitrogen atmosphere (pointless on breathable worlds)
**Size restriction:** Any size planet, but Massive planets do not benefit (they have enough slot space and should be properly colonised)

**Design note:** Bio-Domes are intentionally limited in pop cap and building slots to prevent trivialising hostile-world colonisation. A Bio-Dome on a Toxic world rich in Exotic Materials is a small, expensive forward base, not a full colony. Proper colonisation still requires terraforming.

---

## 5. Computing and AI Technology

### Design Intent

Computing tech follows the cybernetic/industrial species design space but is available to all species at higher cost through crossover research. It creates late-game efficiency compounding: a well-networked empire with AI governors and robot workers can manage more planets with less micromanagement, reflecting the real strategic challenge of large empire administration.

---

### Planetary Network

**Tech:** Planetary Network (Age 3, Computing branch)
**Building:** Network Node (any size; 1 slot)

**How it works:** When a planet has at least 3 Network Nodes, a Planetary Network activates. Connected buildings receive an efficiency bonus: +10% output for all buildings on the planet. This bonus stacks for each additional Node up to a maximum of +25% at 5+ Nodes.

| Nodes | Bonus |
|-------|-------|
| 1–2 | No network bonus (threshold not met) |
| 3 | +10% all building output |
| 4 | +18% all building output |
| 5+ | +25% all building output (cap) |

**Cost per Node:** 150 credits, 50 rare elements | Build time: 3 game-days | Maintenance: 2 energy/day

**Design note:** Network Nodes compete with productive buildings for slots, creating a genuine trade-off. On a Medium planet (14–20 slots), using 5 slots for Nodes costs real productive capacity. On a Massive planet, the trade-off is far more favourable. This naturally scales the system to large, developed worlds.

---

### AI Governor

**Tech:** Autonomous Management Systems (Age 4, Computing branch)
**Function:** Assigns an AI Governor to a planet, which automates build queue decisions, population job assignments, and pollution management. Reduces the micromanagement burden on large empires.

**Mechanics:**
- AI Governor selects buildings based on the planet's designated specialisation (research world, forge world, etc.)
- Governor never demolishes existing buildings
- Governor respects player-locked build queue items (player can pin specific items to override AI)
- Governor efficiency improves with Planetary Network coverage: 0 nodes = 70% optimal decisions; 5 nodes = 95% optimal decisions
- **Risk:** AI Governor will always choose safety and stability; it will never take the aggressive mining, high-pollution path without explicit player override. This is intentional — AI governors won't generate max income for you.

**Cost:** 1 time research unlock. Once researched, assigning a Governor costs 200 credits. Removing a Governor and returning to manual control is free.
**Maintenance:** 2 energy/day per governed planet.

---

### Robot Workers

**Tech:** Robotic Labour (Age 3, Computing branch)
**Building:** Automated Labour Facility (any size; 1 slot)

**Function:** Generates robot worker "population units" that boost production without consuming food/organics or counting against habitability limits.

**Mechanics:**
- Each Automated Labour Facility produces 1 robot worker unit every 30 days
- Maximum robot workers = 25% of current biological population (they are support units, not replacements)
- Each robot worker adds +3 minerals/day and +2 energy/day to the planet's output
- Robots do not count toward population growth calculations
- Robots are destroyed (not captured) if the planet is invaded
- Robot production can be paused but workers remain on the planet until the Facility is demolished

**Unlock prerequisite:** Robotic Labour tech (Age 3). Full Synthetic Workforce tech (Age 5) removes the 25% population cap and allows up to 200% robot-to-population ratio.

**Species interaction:**
- Cybernetic-origin species: Automated Labour Facility costs 30% less and produces workers 50% faster
- Hive Mind species: Cannot use Robot Workers (incompatible with hive coordination protocols — flavour reason: the hive mind cannot interface with non-biological workers)

**Cost per Facility:** 250 credits, 100 minerals, 50 rare elements | Build time: 6 game-days | Maintenance: 3 energy/day

---

### Quantum Computing

**Tech:** Quantum Processing (Age 4, Computing branch)
**Building:** Quantum Core (Medium+ planet; 1 slot)

**Function:** Dramatically boosts research output on a single planet. Only one Quantum Core can be active per planet.

**Output:** +30% to all research produced on this planet (multiplicative with Research Lab levels and species research trait).
**Secondary effect:** +15% to all Computing-branch research speeds empire-wide (the Quantum Core acts as a testbed for advanced research).

**Cost:** 800 credits, 300 rare elements, 150 exotic materials | Build time: 18 game-days | Maintenance: 8 energy/day

**Design note:** The Quantum Core is slot-intensive and maintenance-heavy. It is optimal only on a planet already maximised for research output (multiple Research Labs, Research Station in orbit, Planetary Network active). A dedicated research world with a Quantum Core is an endgame accelerator.

---

### Surveillance Grid

**Tech:** Planetary Surveillance Systems (Age 3, Computing branch)
**Building:** Surveillance Grid (any size; 1 slot)

**Function:** Defends against enemy espionage operations on the planet and provides a small counter-intelligence bonus empire-wide.

**Mechanics:**
- Each Surveillance Grid on a planet adds +15 to that planet's Infiltration Resistance score
- Reduces the chance of a successful enemy spy operation on this planet by (15 × grid_count)%, capped at 75%
- One Surveillance Grid in the empire provides +3 to empire-wide Counter-intelligence rating
- Multiple grids stack for planet protection but only the first provides the empire-wide bonus

**Cost:** 200 credits, 80 minerals, 40 rare elements | Build time: 5 game-days | Maintenance: 2 energy/day

**Interaction with computing tech:** If the planet has a Planetary Network active (3+ nodes), the Surveillance Grid's planet protection increases by 50% (the network integration makes surveillance far more effective).

---

## 6. Wonders (Megastructures)

### Design Intent

Wonders are civilisation-defining projects. They are built once per empire (with one exception), require multiple construction stages, and take significant in-game time. They should feel like the culmination of a tech/resource strategy rather than a purchase. Inspired by Alpha Centauri's Secret Projects and Stellaris's Megastructures, but designed to fit Ex Nihilo's real-time-with-pause flow.

**Core rules:**
1. Each Wonder can be built at most once per empire.
2. Wonders require a dedicated orbital construction site at a specific star system — they cannot be relocated.
3. Only one Wonder can be under construction at a time empire-wide.
4. Wonders have multiple construction stages (each a separate project); the project can be paused between stages.
5. Wonders are not buildings and do not consume planet building slots.
6. Wonders can be attacked and destroyed by enemies in combat. A destroyed Wonder must be rebuilt from scratch. (Stellaris handles this similarly with repair costs.)

**General prerequisite for all Wonders:** Megastructure Engineering technology (Age 5, Construction branch).

---

### Wonder 1: Dyson Sphere

**Description:** A shell of solar collectors entirely enclosing a star, capturing its total energy output. The greatest energy project conceivable.

**Location:** Built at a star system. The star's planets continue to function while construction is underway, but no new colonies can be founded in that system during construction (the orbital scaffolding blocks colonisation).

**Construction stages:**

| Stage | Name | Duration | Cost |
|-------|------|----------|------|
| 1 | Orbital Frame | 120d | 5,000 credits, 10,000 minerals |
| 2 | Inner Shell Grid | 180d | 8,000 credits, 15,000 minerals, 3,000 rare elements |
| 3 | Collector Array | 240d | 10,000 credits, 12,000 minerals, 5,000 rare elements, 2,000 exotic materials |
| 4 | Power Transmission Network | 180d | 8,000 credits, 8,000 minerals, 3,000 exotic materials |
| 5 | Final Enclosure | 300d | 15,000 credits, 20,000 minerals, 5,000 exotic materials |

**Total:** 1,020 game-days (≈ 2.8 game-years at 1x), 46,000 credits, 65,000 minerals, 11,000 rare elements, 10,000 exotic materials.

**Output (scales with stage completion):**
- Stage 1 complete: +50 energy/day
- Stage 2: +150 energy/day total
- Stage 3: +350 energy/day total
- Stage 4: +600 energy/day total
- Stage 5 (complete): +1,200 energy/day total

A complete Dyson Sphere effectively eliminates energy as a constraint on late-game play.

**Star type modifiers:**
- Yellow/white star: ×1.0 (baseline)
- Blue giant: ×2.5 output but +50% construction cost (extreme environment)
- Red dwarf: ×0.4 output (dim star)
- Red giant: ×1.8 output
- Neutron star: Not allowed (construction impossible)

**Vulnerability:** The Dyson Sphere is a fixed, enormous target. Destroying Stage 5 requires a massive fleet engagement. A successful attack on the Power Transmission stage reduces output by 50% until repaired (repair cost: 5,000 minerals, 1,500 exotic materials, 30-day project).

---

### Wonder 2: Ring World

**Description:** An artificial ring of continental land orbiting a star, providing immense habitable surface area.

**Location:** Replaces the planetary bodies in a star system. The system's existing planets and their populations must be evacuated (or they die) when Ring World construction begins. This is a **major strategic and ethical decision point** — you are permanently converting an existing system.

**Construction stages:**

| Stage | Name | Duration | Cost |
|-------|------|----------|------|
| 1 | Structural Frame | 150d | 6,000 credits, 12,000 minerals, 2,000 rare elements |
| 2 | Segment 1 (habitable) | 120d | 4,000 credits, 8,000 minerals, 1,500 rare elements, 500 exotic |
| 3 | Segment 2 (habitable) | 120d | 4,000 credits, 8,000 minerals, 1,500 rare elements, 500 exotic |
| 4 | Segment 3 (habitable) | 120d | 4,000 credits, 8,000 minerals, 1,500 rare elements, 500 exotic |
| 5 | Segment 4 (habitable) | 120d | 4,000 credits, 8,000 minerals, 1,500 rare elements, 500 exotic |
| 6 | Life Support and Biosphere | 200d | 8,000 credits, 5,000 organics, 2,000 exotic |

**Output (each Segment is a functional colony):**
- Each Ring World segment = 1 Massive-class planet equivalent (30 building slots, 2,000,000 max population cap)
- 100% habitability for all species (closed life-support environment)
- No natural resources by default (must be mined from asteroid belts in other systems and shipped in)
- 4 segments total = effectively 4 Massive planets in one system

**Pre-requisite:** Dyson Sphere must be complete (the Ring World requires the Dyson Sphere's energy output to power life support). Exception: species with a Bioengineering origin can use organic self-sustaining biospheres instead, removing the Dyson Sphere prerequisite.

**Warning mechanics:** When a player begins Ring World Stage 1, all other empires receive a galaxy-wide diplomatic notification: "The [Empire Name] has begun construction of a Ring World in the [System Name] system." This is an intentional tension builder.

---

### Wonder 3: Galactic Library

**Description:** The most comprehensive repository of knowledge ever assembled. Every civilisation contributes (willingly or not) to its vast archives.

**Location:** Built at a specific planet (Large or Massive required). Occupies 0 building slots (it is built alongside existing infrastructure, not replacing it).

**Construction stages:**

| Stage | Name | Duration | Cost |
|-------|------|----------|------|
| 1 | Archive Foundation | 90d | 3,000 credits, 5,000 minerals |
| 2 | Stellar Data Network | 120d | 4,000 credits, 3,000 rare elements |
| 3 | Xenological Collection | 150d | 5,000 credits, 2,000 rare elements, 1,000 exotic |
| 4 | Omniscient Index | 180d | 8,000 credits, 3,000 exotic materials |

**Output:**
- +20% research speed empire-wide (applies to all research projects simultaneously)
- +15% to crossover research (researching outside your species' origin tech tree)
- +10% chance per project of a "breakthrough discovery" event (minor tech boost or ancient tech recovery)
- Unlocks a unique diplomacy option: "Share the Library" — grants another empire +5% research for 1 game-year; earns +10 trust/attitude in return.

**Prerequisite:** Must have researched at least 50 distinct technologies (breadth requirement, not age gate). Rewards generalist research strategies.

**One per galaxy, not per empire:** The Galactic Library is unique in being the only Wonder restricted to one per galaxy total. The first empire to complete Stage 4 wins it. All other empires receive a notification, and enemy empires gain +5% research speed (they are now "catching up" to the Library's published discoveries) — a partial compensation for not having it.

---

### Wonder 4: Portal Network

**Description:** A network of paired teleportation portals that allow instantaneous fleet and population transit between your worlds.

**Location:** Portal hubs are built at individual planets (any size). The Portal Network Wonder is the central controller.

**Construction stages (Central Controller):**

| Stage | Name | Duration | Cost |
|-------|------|----------|------|
| 1 | Quantum Substrate | 100d | 4,000 credits, 6,000 rare elements |
| 2 | Spatial Fold Engine | 160d | 6,000 credits, 4,000 rare elements, 2,000 exotic |
| 3 | Network Synchronisation | 200d | 8,000 credits, 5,000 exotic materials |

**Portal Hub (per planet):** 600 credits, 300 rare elements, 100 exotic materials; 20-day build; 1 surface building slot.

**How it works:**
- Fleets located at a Portal Hub planet can teleport instantly to any other Portal Hub planet in your empire
- Population and colony ships can transit through Portal Hubs (eliminates travel time for internal empire movements)
- Portal transit is limited to your empire's fleets only; enemy fleets cannot use captured portals (they shut down automatically under hostile occupation)
- Maximum fleet size that can transit per jump: scales with stage (Stage 1: destroyer-class only; Stage 2: up to cruiser; Stage 3: full fleet including dreadnoughts)

**Strategic implications:**
- Eliminates the interior lines problem for large empires: your capital system is 0 transit-time from every Portal Hub world
- Does not replace FTL for reaching new systems — portals only connect established colonies
- A well-placed Portal Hub network makes defending a wide empire feasible in the late game
- Portal Hubs on frontier worlds are high-value targets; destroying all Portal Hubs in a system disconnects that system from the network

**Prerequisite:** Singularity Drive technology must be in the research queue (Age 5). Requires the Artificial Wormhole technology to already be complete. The Portal Network is the engineering successor to artificial wormholes.

---

## 7. Tech Tree Integration

### Research Placement Summary

All systems above map to the five Technology Ages and specific research branches:

| Age | New Techs |
|-----|-----------|
| 2 (Expansion) | Basic Mining (Tier 1 core mining), Robotic Labour (prerequisite) |
| 3 (Ascendancy) | Atmospheric Engineering, Stellar Climate Control, Orbital Engineering, Deep Drilling, Bio-Dome Habitation, Planetary Network, Planetary Surveillance Systems |
| 4 (Dominion) | Xenobiology, Advanced Terraforming, Core Mining, Autonomous Management Systems, Quantum Processing, Advanced Orbital Engineering |
| 5 (Transcendence) | Mantle Tapping, Full Synthetic Workforce, Megastructure Engineering (unlocks all Wonders) |

### Species Origin Modifiers Summary

| System | Bioengineering | Industrial | Cybernetic | Psionic | Nomadic |
|--------|---------------|------------|------------|---------|---------|
| Terraforming | −40% cost, −25% time | +20% cost | No change | −10% time | −10% cost |
| Core Mining | +10% output | −20% cost, +30% output | −15% cost | No change | +20% output (salvage intuition) |
| Robot Workers | Cannot use | +20% output | −30% cost, −50% time, cap removed | Cannot use | +10% output |
| Planetary Network | +5% bonus ceiling | No change | +5% bonus ceiling, −30% node cost | +5% bonus, psionic resonance bonus | No change |
| Pollution | −20% generation | +30% generation, +cleanup bonus from recycling | −25% generation (efficient systems) | −10% generation | −15% generation |
| Wonders | Dyson Sphere −20% cost | Dyson Sphere −15% time | Portal Network −20% cost | Galactic Library −30% build time | Galactic Library −20% cost |

---

## 8. Balance Notes and Risks

### Terraforming
- **Risk of triviality:** If terraforming is too cheap or fast, there is no reason not to convert all planets immediately. The multi-stage costs and time spans (hundreds of game-days per stage) are designed to ensure terraforming is a major strategic commitment, not a routine action. Playtesting should verify that a full Barren → Terran conversion takes at least 2–4 real-minutes at 1x speed.
- **Risk of irrelevance:** If terraforming is too slow or expensive, players will never bother. The intermediate state bonuses (a Desert world is already better than Barren even before full conversion) are designed to make partial progress feel rewarding.

### Core Mining
- **Geological Instability** must be tuned carefully. The risk of losing buildings should be real but not so frequent it makes deep mining feel punishing. Suggested: during alpha, set all risk percentages at 50% of the values listed here, then tune upward based on player feedback.

### Pollution
- **Pollution must have visible feedback.** Players need to see their habitability score dropping in real time. The UI should display pollution level prominently on the planet management panel with clear colour coding (green → yellow → orange → red → critical).
- **Biome degradation** should be extremely rare — a consequence of sustained neglect, not a routine occurrence. The 180-consecutive-day threshold at above-150 pollution is intentionally harsh to trigger.

### Wonders
- **Dyson Sphere energy dominance:** At +1,200 energy/day, the Dyson Sphere provides roughly 10x the output of a fully-developed energy planet. This is intentional — it should be game-changing. Its costs (65,000+ minerals) are enormous enough that it will typically not be fully complete before the late endgame.
- **Ring World as a target:** The galaxy-wide notification creates a diplomatic crisis situation: every other empire knows you are 2+ years from having 4 Massive planets in one system. This is a risk-vs-reward design — the Ring World should provoke coalition attacks.
- **Galactic Library uniqueness:** The one-per-galaxy restriction creates a race dynamic. Consider whether this is too frustrating if the AI builds it first; the +5% research consolation for non-owners was designed to mitigate this.
- **Portal Network deployment:** The requirement to build Portal Hubs on every world you want connected means even completing the Wonder leaves substantial follow-up work. This prevents instant strategic omnipresence.

---

## 9. Data Model Changes Required

The following additions/changes are needed in the shared package to support these systems:

### `/packages/shared/src/types/galaxy.ts`

```typescript
// Add to Planet interface:
terraformingStage: TerraformingStage | null;
terraformingProgress: number;
ecologicalPressure: number;
geologicalInstability: number;
pollutionLevel: number;
orbitalStructures: OrbitalStructure[];
orbitalBuildQueue: OrbitalBuildItem[];

// New types:
type TerraformingStage = 'atmospheric' | 'thermal' | 'biosphere' | 'conversion';
type TemperatureBand = 'frozen' | 'cold' | 'cool' | 'temperate' | 'warm' | 'hot' | 'scorching';

interface OrbitalStructure {
  id: string;
  type: OrbitalStructureType;
  level: number;
  planetId: string;
  buildProgress: number;
}

type OrbitalStructureType =
  | 'research_station'
  | 'defence_platform'
  | 'trade_station'
  | 'shipyard_platform'
  | 'mining_platform'
  | 'habitat_ring';

interface OrbitalBuildItem {
  type: OrbitalStructureType;
  templateId: string;
  progress: number;
}
```

### `/packages/shared/src/types/galaxy.ts` — `BuildingType` additions

```typescript
// Add to BuildingType union:
| 'terraforming_station'
| 'orbital_construction_yard'
| 'network_node'
| 'automated_labour_facility'
| 'quantum_core'
| 'surveillance_grid'
| 'geological_survey_office'
| 'atmospheric_scrubber'
| 'recycling_complex'
| 'bioremediation_centre'
| 'fusion_reactor'
| 'antimatter_plant'
| 'solar_farm'
| 'wind_array'
| 'tidal_generator'
| 'bio_dome'
| 'portal_hub'
| 'ecological_monitoring_centre'
```

### `/packages/shared/src/constants/buildings.ts`

Add `BuildingDefinition` entries for each new building type above, following the existing pattern.

### `/packages/shared/src/types/wonders.ts` (new file)

```typescript
export interface Wonder {
  id: string;
  type: WonderType;
  systemId: string;
  planetId: string | null;
  currentStage: number;
  stageProgress: number;
  ownerId: string;
  isDestroyed: boolean;
}

export type WonderType =
  | 'dyson_sphere'
  | 'ring_world'
  | 'galactic_library'
  | 'portal_network';
```

---

## 10. Implementation Priority

Ordered by gameplay impact vs. implementation complexity:

1. **Pollution system** — High impact, moderate complexity. Adds meaningful consequence to industrial growth. Implement in Phase 6 alongside terraforming.
2. **Terraforming Stages 1 & 2** — High impact, moderate complexity. Players can start using partial terraforming without biosphere/conversion complexity. Phase 6.
3. **Space Stations** — High impact, moderate complexity. Unlocks Gas Giant development and adds late-game flexibility. Phase 6.
4. **Core Mining (Tiers 1–2)** — Moderate impact, low complexity. Deep Bore replaces basic mining; geological instability is a new tick system. Phase 6.
5. **Bio-Dome** — Moderate impact, low complexity. Simple building with capped population. Phase 6.
6. **Robot Workers & Planetary Network** — Moderate impact, moderate complexity. Phase 7 (Polish).
7. **AI Governor** — High impact, high complexity (requires reasonable planet AI). Phase 7.
8. **Terraforming Stages 3 & 4** — High impact, high complexity (biosphere seeding, planet type conversion). Phase 7.
9. **Quantum Computing & Surveillance Grid** — Low-moderate impact, low complexity. Phase 7.
10. **Wonders** — Transformative impact, very high complexity (multi-stage construction, galaxy-wide notifications, unique win-condition interactions). Phase 8 or dedicated Wonder milestone.

---

*Sources consulted:*
- [Terraforming — StrategyWiki (Alpha Centauri)](https://strategywiki.org/wiki/Sid_Meier's_Alpha_Centauri/Terraforming)
- [Terraforming: Options, options, options — Alpha Centauri Wiki](https://alphacentauri.miraheze.org/wiki/Terraforming:_Options,_options,_options)
- [Ecology (Basic) — Alpha Centauri Wiki](https://alphacentauri.miraheze.org/wiki/Ecology_(Basic))
- [Sid Meier's Alpha Centauri/Secret Projects — StrategyWiki](https://strategywiki.org/wiki/Sid_Meier's_Alpha_Centauri/Secret_Projects)
- [Terraforming — Stellaris Wiki](https://stellaris.paradoxwikis.com/Terraforming)
- [Megastructures — Stellaris Wiki](https://stellaris.paradoxwikis.com/Megastructures)
- [Stellaris Terraforming Guide — The Gamer](https://www.thegamer.com/stellaris-terraforming-guide-how-unlock-worlds-planets/)
- [Stellaris: How to Build Megastructures — Game Rant](https://gamerant.com/stellaris-how-to-build-megastructures/)
- [Terraforming — Official Master of Orion Wiki](https://masteroforion.fandom.com/wiki/Terraforming)
- [Master of Orion II: Growing your population — StrategyWiki](https://strategywiki.org/wiki/Master_of_Orion_II:_Battle_at_Antares/Growing_your_population)
- [Pollution explanation — Master of Orion Steam Discussions](https://steamcommunity.com/app/298050/discussions/0/312265782622250856/)
- [Megastructures — Stellaris Wiki (Fandom)](https://stellaris.fandom.com/wiki/Megastructures)
- [Intelligence — Stellaris Wiki](https://stellaris.paradoxwikis.com/Intelligence)
- [Atrocities (SMAC) — Civilization Wiki](https://civilization.fandom.com/wiki/Atrocities_(SMAC))
