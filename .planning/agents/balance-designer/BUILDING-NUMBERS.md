# Building Numbers — For Balance Designer Review

## Fundamental Constants

- **1 tick = 1 day**
- **1 year = 365 ticks**
- **Planet surface area** determines building slot count AND waste capacity
- **Energy is a flow**, not a stockpile — produced and consumed each tick, surplus wasted unless stored

## Research Model

- 1 Research Lab = 1 active research project at a time
- Multiple labs on same planet = can advance multiple projects OR stack on one
- Research points pooled empire-wide, distributed to active projects
- Player can cancel and switch research at any time (points invested in cancelled project are lost)

## Power Plant Lifecycle

| Level | Fuel Type | Lifespan | Energy Output | Notes |
|---|---|---|---|---|
| L1 | Fission (minerals) | 5 years (1,825 days) | Base | Common fuel |
| L2 | Fission (minerals) | 7 years | +20% | More efficient |
| L3 | Fusion (rare elements) | 10 years | +25% on L2 | Rarer fuel |
| L4 | Fusion (rare elements) | 15 years | +30% on L3 | |
| L5 | Antimatter (exotic materials) | 20 years | +35% on L4 | Must be obtainable |

End-of-life choices:
1. Recommission (credits + brief downtime)
2. Reduced capacity (+10 years extension, once only)
3. Risk it (chance of shutdown each tick)

## Energy Storage

| Level | Capacity |
|---|---|
| L1 | 50 |
| L2 | 150 |
| L3 | 500 |
| L4 | 1,500 |
| L5 | 5,000 |

## Energy as Happiness Factor

- **Abundant energy** (production > 150% demand): happiness bonus, lower costs
- **Balanced** (100-150%): neutral
- **Tight** (70-100%): happiness penalty, costs rise
- **Shortage** (< 70%): significant unhappiness, buildings brownout
- **Critical** (< 30%): buildings non-functional, population panic

## Build Times (Base — reduced by construction output + species trait)

| Building | Base Build Time | Category |
|---|---|---|
| Population Centre | 60 days | Basic |
| Hydroponics Bay | 45 days | Basic |
| Power Plant | 60 days | Basic |
| Factory | 90 days | Basic |
| Mining Facility | 75 days | Basic |
| Medical Bay | 60 days | Basic |
| Waste Dump | 30 days | Basic |
| Recycling Plant | 90 days | Intermediate |
| Trade Hub | 120 days | Intermediate |
| Spaceport | 150 days | Intermediate |
| Research Lab | 90 days | Intermediate |
| Entertainment Complex | 90 days | Intermediate |
| Communications Hub | 120 days | Intermediate |
| Defense Grid | 180 days | Advanced |
| Shipyard | 270 days | Advanced |
| Military Academy | 180 days | Advanced |
| Orbital Platform | 365 days | Advanced |
| Fusion Reactor | 240 days | Advanced |
| Terraforming Station | 365 days | Advanced |
| Atmosphere Cleanser | 180 days | Advanced |
| Energy Storage | 120 days | Intermediate |
| Waste Ejector (Orbital) | 365 days | Advanced |

## Waste Output (per tick, L1)

| Source | Waste/tick | Notes |
|---|---|---|
| Mining Facility | 3.0 | Highest — mining is dirty |
| Factory | 2.0 | Industrial waste |
| Power Plant (Fission) | 1.5 | Nuclear waste |
| Population Centre | 0.5 | Domestic waste |
| Shipyard | 1.0 | Industrial |
| Spaceport | 0.5 | Logistics waste |
| All other buildings | 0.2 | Minimal |
| Per 10,000 population | 0.1 | Scales with pop |

### Waste Capacity

`Planet waste capacity = planet surface area factor × 100`

Surface area factor by planet type:
- Gas Giant: 0 (can't build)
- Barren: 30 (small, limited)
- Ice: 40
- Desert: 60
- Toxic: 50 (already polluted — higher tolerance?)
- Volcanic: 35
- Ocean: 70 (CAN absorb more but dumping damages ecology — habitability drops over time, aquatic species furious, population happiness tanks)
- Terran: 100 (largest, most absorbent)

So a terran world can hold 10,000 waste before overflow. A barren world only 3,000.

### Waste Management

Recycling does NOT eliminate waste — it reduces a PERCENTAGE. Full elimination requires dedicated disposal infrastructure.

| Building | Effect | Notes |
|---|---|---|
| Recycling Plant | Reduces waste by 25% of total produced/tick | Helps but doesn't solve |
| Waste Dump | Stores 2,000 waste capacity | Buys time, doesn't reduce |
| Waste Incinerator | Eliminates 3.0 waste/tick | Produces pollution (happiness penalty) |
| Atmosphere Cleanser | Eliminates 2.0 waste/tick + removes pollution | Clean solution |
| Orbital Waste Ejector | Eliminates 5.0 waste/tick | Best solution, most expensive, requires research |

Progression: Recycling (slow %) → Waste Dump (storage) → Incinerator (dirty elimination) → Cleanser (clean elimination) → Ejector (best)

## Energy Consumption (per tick, L1)

| Building | Energy/tick | Notes |
|---|---|---|
| Research Lab | 3 | Sensitive equipment |
| Factory | 2 | Industrial |
| Mining Facility | 2 | Heavy machinery |
| Shipyard | 5 | Massive energy draw |
| Trade Hub | 1 | Light |
| Defense Grid | 4 | Shield generators |
| Population Centre | 1 | Lighting, heating |
| Spaceport | 3 | Launch systems |
| Hydroponics Bay | 2 | Growth lights, climate |
| Entertainment Complex | 2 | Lighting, systems |
| Communications Hub | 2 | Signal processing |
| Orbital Platform | 3 | Station keeping |
| Recycling Plant | 2 | Processing |
| Terraforming Station | 6 | Planetary engineering |
| Military Academy | 2 | Training systems |
| Medical Bay | 2 | Life support, equipment |
| Advanced Medical | 3 | Advanced equipment |
| Fusion Reactor | 0 | Produces energy |
| Power Plant | 0 | Produces energy |
| Energy Storage | 1 | Monitoring systems |
| Waste Dump | 0.5 | Minimal |
| Atmosphere Cleanser | 3 | Air processing |
| Orbital Waste Ejector | 4 | Launch energy |

## Energy Production

| Building | Energy/tick (L1) |
|---|---|
| Power Plant | 20 |
| Fusion Reactor | 35 |
| Orbital Platform | 5 |
| Recycling Plant | 1 |

## Level Progression (Compound Stacking)

| Level | Modifier | Cumulative (on base 100) |
|---|---|---|
| L1 | Base | 100 |
| L2 | +20% | 120 |
| L3 | +25% on 120 | 150 |
| L4 | +30% on 150 | 195 |
| L5 | +35% on 195 | 263 |

Applied to: output, waste reduction per level, energy efficiency per level, happiness improvement per level, maintenance reduction per level.

**Species-specific curves**: Races good at X get better progression for X buildings. E.g., Khazari factories might be L2 +25%, L3 +30% instead of +20%, +25%.

## Condition & Decay

| Condition | Status |
|---|---|
| 100-71% | Functional, output scales with condition |
| 70% | Non-functional threshold — stops producing |
| 31-69% | Non-functional, repairable |
| 30% | Unrepairable threshold — must demolish + rebuild |
| 0% | Rubble |

### Decay Rates (ticks per 1% condition loss when unpaid)

| Building Type | Ticks per 1% loss | Rationale |
|---|---|---|
| Heavy industry (factory, shipyard, mine) | 30 days | Built tough |
| Infrastructure (spaceport, trade hub, comms) | 20 days | Moderate |
| Sensitive (research lab, medical, comms hub) | 15 days | Delicate equipment |
| Biological (hydroponics, population centre) | 10 days | Living systems degrade fast |
| Military (defense grid, academy) | 25 days | Military grade |
| Power (power plant, fusion reactor) | 20 days | Engineered but complex |

So a factory losing maintenance takes 30 × 30 = 900 days (~2.5 years) to reach 70% and stop working. A hydroponics bay takes 10 × 30 = 300 days (~10 months).

## Still Needs Director Input

- Exact species-specific modifiers for level curves
- Species-specific waste characteristics (which species are "dirty"?)
- Troop mechanics (separate sprint — confirmed)
- Ground combat building damage rules
- Exact costs for recommission per power plant level
- What happens to waste on conquered planets of dirty species?
