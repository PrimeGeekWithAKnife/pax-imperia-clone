# Ex Nihilo — Combat System Design Document

## 1. Combat Trigger Rules

- Fleets must be in the **same system** for combat potential
- Fleets orbiting a planet only engage if the enemy specifically moves to that planet
- **Both aggressive stance** → automatic combat start
- **One aggressive** → warning dialogue: "Enemy fleet powering weapons" — option to stay or flee
- **Neither aggressive** → player must manually initiate attack
- **Patrolling fleets** (star orbit) may arrive late to a planetary assault — speed-dependent race between patrol fleet and attackers
- **Defensive stance** fleets auto-respond to allied/own planet attacks
- **Hailing:** Before initiating attack, player can hail the enemy — demand withdrawal, negotiate, or threaten. Diplomatic races get bonuses.
- **Reinforcements:** Defensive fleets in adjacent wormhole-connected systems can auto-jump in after a delay based on travel time.

## 2. Battle Map Layouts

### Open Space (System Patrol Combat)
- Relatively blank arena with environmental dressing
- Asteroids (provide cover, collision hazard)
- Nebulae (reduce scanner range, energy weapon effectiveness reduced)
- Civilian trader traffic (can be caught in crossfire — diplomatic consequences)
- Debris from destroyed ships becomes progressive hazards

### Planetary Assault (Wedge Layout)
- Attackers: top-left corner
- Planet: bottom-right with atmospheric edge visible
- Orbital defences, orbital ships, shipyard, planetary shield visible
- Minefields (if any)
- Planetary guns (if any)
- Evacuating civilian craft (if surprise attack)

## 3. Ship Movement & Formations

### Engine Components
- **Main Engine:** determines base speed
- **Manoeuvring Thruster:** determines turn rate and dodge ability. Ships without them are sluggish.
- **Wormhole/Jump Drive:** for inter-system travel (not used in tactical combat)

### Formations
- **Line:** ships in a single row
- **Spearhead:** 1 lead, 2 behind, 3 behind, then singles trailing
- **Diamond:** 1, 2, 3, 2, 1
- **Wings:** repeating groups of 1 lead + 2 flanking on either side

### Individual Ship Orders
- **Attack (target):** engage a specific ship or structure
- **Defend (target):** physically shield another ship/structure, lend shields
- **Move (point):** move to coordinates, may fire en route
- **Flee:** move as fast as possible to the map edge and leave combat
- **Emergency Repair (admiral command):** ship circles away from combat, slowly repairs a damaged system
- **Rally (admiral command):** admiral broadcasts to boost fleet morale

### Ship Orientation
- Fixed-point weapons fire in a 90° forward arc
- Turreted weapons have 270° coverage
- Point defence is 360° (omnidirectional)
- Ship facing is tactically critical — flanking exposes weak arcs

### Ramming
- Desperate tactic: damaged/weaponless ship rams an enemy
- Damage based on mass and speed
- Likely destroys both ships

### Scale
- Initial: up to 9 ships per side
- Target: up to 27 ships per player, 3 players simultaneously (81 total)
- Battle scene must be zoomable to accommodate

## 4. Weapons & Damage

### Damage Types
Energy, temperature, explosive, piercing, bludgeoning, slashing, kinetic, radiation, acid, psionic, dimensional, splash (AoE radius), singularity.

### Hit Modifiers
- Stationary vs moving target
- Target size (smaller = harder to hit)
- Visibility (nebula, cloaking)
- Cover (asteroids, other ships)
- Scanning quality (better scanners reveal more — health, projectiles, invisible beams, component status)
- **Friendly fire is possible**

### Weapon Behaviours
| Type | Behaviour |
|------|-----------|
| **Beams** | Straight line, very accurate. Instant hit OR sustained (lasers need time to cut). Damage drops with range (~30% at max range). |
| **Projectiles** | Travel time, burst or single shot. Dodgeable at range. Potentially unlimited range — stray projectiles can hit random things. |
| **Missiles** | Tracking (course correct), slow start but rapid acceleration. Interceptable by point defence. Limited ammo. |
| **Fighters** | Launched from carriers. Swarm targets, interfere with scanners, act as spinning shield (Ender's Game style), crash into targets. Limited complement. |
| **Point Defence** | Auto-targets missiles, fighters, and very close ships. 360° coverage. |

### Ammunition
- Missiles and projectiles have limited ammo
- Beams draw from ship power (energy systems)
- Carriers have limited fighter complement — lost fighters only replaced at shipyard
- Running out forces reliance on remaining weapons or retreat

### Electronic Warfare
- **ECM:** reduces enemy targeting accuracy
- **ECCM:** counters enemy ECM
- **Decoys:** draw missile tracking away from real targets
- All are ship designer components

### Weapon Arcs
- Fixed: 90° forward arc
- Turreted: 270°
- Point Defence: 360°

## 5. Shields, Armour & Hull

### Shields
- Have health, regeneration rate, and damage absorption percentage
- **Low tech:** partial absorption only. Directional — covers one quarter (front, rear, port, starboard). Predetermined direction.
- **High tech:** complete bubble. Multiple shields can stack.
- Damage beyond shield absorption passes through to armour
- **Shield overload:** absorbing more than capacity in one tick causes collapse — shield reboots over several ticks with no protection

### Armour
- Has health per location: front, rear, port, starboard (assignable in ship designer)
- Does not eliminate damage — reduces it (~60% reduction at base, improves with tech)
- Does not regenerate at low tech. Limited regeneration at higher tech ages.
- Once armour at a location is depleted, hull takes direct damage there

### Hull
- Component damage based on positioning in the ship layout (2D representing 3D — some components may overlap)
- At 50%+ hull damage: increasing chance of catastrophic failure (break apart, explosion, total system loss)
- At 0% hull: one of these events definitely occurs

### Critical Hits
- Low probability hits that partially bypass armour — fuel lines, ammo stores, reactor
- Chance increases as hull integrity degrades
- Makes even weak weapons occasionally dangerous

### System Targeting
- With better scanning/targeting tech: surgical targeting of specific systems (engines, weapons, shields, life support, sensors)
- Cost: reduced firing rate (higher precision required)
- Accuracy: may hit adjacent systems instead of intended target (positional geometry)

## 6. Crews & Admirals

### Crew System
- Each ship has crew with: morale (0-100), health (0-100), experience (green/regular/veteran/elite)
- **Morale drops from:** taking damage, allies destroyed, prolonged combat, low supplies
- **Morale thresholds:** below 30 = reduced performance; below 15 = may surrender, flee, or abandon ship (captain personality dependent)
- **Health affected by:** hull breaches, life support damage, radiation weapons, boarding actions
- **Experience improves:** accuracy, repair speed, damage control, morale resilience

### Admiral System
- Recruited and assigned to fleets (like governors to planets)
- **Traits:** aggressive, cautious, tactical, inspiring — affects combat bonuses
- **Experience level determines:** number of pauses available, formation effectiveness, fleet coordination bonus
- **Admirals can die** if flagship is destroyed
- Famous admirals boost empire-wide morale; losing one hurts morale

### Admiral Commands
- **Emergency Repair:** ship circles away from combat, slowly repairs a damaged system before re-engaging
- **Rally:** admiral broadcasts on comms to boost fleet morale when low

## 7. Combat Timing

- **Real-time** with speed controls (slowest = normal speed, no slow-motion exploit)
- **Limited pauses** — number determined by admiral experience level
- **Simultaneous orders** — both sides issue orders
- **Tick-based:** 1 combat tick = 1/300 of a game tick (~10 minutes real time per game tick at normal speed)
- **Duration:** small battles = few minutes, massive battles = up to ~1 hour

## 8. Retreat & Surrender

- **Flee to map edge:** top-left for attackers, bottom-right sides for defenders
- **Engine damage** reduces escape speed — pursuing fleet may catch retreating ships
- **Partial retreat:** individual ships can flee while others fight; fleet splits dynamically
- **Pursuit:** can follow a retreating fleet into the next system
- **Reinforce Defences:** desperate option to land a ship on the planet, contributing ship parts, weapons, and crew to ground forces
- **Surrender:** crew morale below threshold may trigger surrender (no escape available) or abandon ship
- **Boarding:** disabled ships (engines destroyed, shields down) can be boarded and captured. Requires transport/marine components. Captured ships yield tech bonuses or can be repaired and used.

## 9. Planetary Assault

### Stages
1. **Bombardment:** destroy orbital defences, damage ground structures. Requires bombardment-capable weapons. Missiles/projectiles damage civilian structures more than military. Planetary shields (building) prevent bombardment until generator is destroyed.
2. **Blockade:** prevent all incoming/outgoing traffic from the planet.
3. **Ground Invasion:** separate combat screen. Transport ships carry troops. Orbital drop pods (tech) bypass some ground defences with descent losses.
4. **Control:** install governor, manage occupation.

### Planetary Actions (Post-Conquest)
- **Peaceful Occupation:** minimal unrest, slow integration, requires policing
- **Forced Labour:** population works under duress, higher productivity but very unhappy
- **Re-education:** systematically convert population to your culture, slow process
- **Decapitate Leadership:** kill enemy leadership, leave population — moderate unrest
- **Raze and Loot:** destroy all buildings, take valuables, kill some population but leave most alive on a broken planet
- **Mass Genocide:** kills population over time. Requires repeated confirmation. Race-specific availability — peaceful races cannot choose this.
- **Enslavement:** full enslavement of the population

### Unrest Factors
- Animosity between species
- Brutal tactics used during conquest
- Opposite government types
- Destruction of infrastructure
- Food and power shortages
- Illness and deaths
- Policing/law enforcement required — can lead to clashes

### Tech Discovery
- Conquering a planet with research facilities may yield enemy technologies the conqueror doesn't have
- Chances are low — secrets are protected — but the possibility exists

## 10. Combat Consequences

### Salvage
- Winner can salvage wreckage from destroyed ships
- First come first served — both sides can attempt
- Pirates and opportunists will target salvage sites
- Can recover resources, technology fragments, crew survivors

### Experience
- All surviving crews gain experience, win or lose
- Difficult engagements reward more experience
- One-sided beatdowns provide minimal experience

### Repair
- Crew handles field repairs based on experience (keeps ship limping)
- When systems reach 0% health, only a shipyard at an allied/owned planet can repair
- Nano-repair tech (if researched) assists crew repair speed

### War Weariness
- Prolonged wars affect trade, empire morale, population sentiment
- Free populations more susceptible to emotional reactions
- Enslaved populations have no morale to lose but no power to resist either
- Attrition and significant losses compound weariness

### Battle Reports
- Post-combat summary: kills, damage dealt/taken, ships lost/captured, resources spent, experience gained, salvage recovered
- Replayable combat log

### War Crimes & Reputation
- Bombing civilians, genocide, using extreme weapons affect diplomatic standing with ALL empires
- Peaceful races refuse to trade with war criminals
- Reputation persists and is difficult to recover

---

## Implementation Layers

### Layer 1: Core Tactical Combat
- Tactical combat Phaser scene (open space layout)
- Ship movement with main engine speed
- Basic weapons: beams + projectiles
- Shields (bubble, single direction at low tech)
- Armour (directional)
- Hull damage + component damage
- Retreat to map edge
- Basic formations (Line)
- Combat trigger dialogue
- Battle results screen

### Layer 2: Advanced Weapons & Tactics
- Missiles + point defence
- Fighters + carriers
- Manoeuvring thrusters
- All 4 formations
- System targeting (surgical)
- Weapon arcs (fixed/turreted/omni)
- Electronic warfare (ECM/ECCM/decoys)
- Ammunition system
- Friendly fire
- Environmental hazards (asteroids, nebulae, debris)

### Layer 3: Crews & Admirals
- Crew morale, health, experience
- Admiral recruitment, traits, abilities
- Admiral commands (Emergency Repair, Rally)
- Limited pauses (admiral-dependent)
- Surrender/abandon ship mechanics
- Boarding and ship capture
- Experience gain system

### Layer 4: Planetary Assault
- Planetary assault wedge layout
- Orbital defences (guns, minefields, planetary shield)
- Bombardment mechanics
- Blockade mechanics
- Ground combat screen
- Orbital drop pods
- Reinforce Defences (land ship)
- Civilian evacuation visuals

### Layer 5: Occupation & Consequences
- Post-conquest occupation options (peaceful through genocide)
- Population unrest simulation
- Policing/law enforcement
- Raze and Loot
- Tech discovery from research facilities
- Salvage system
- War weariness
- War crimes reputation
- Battle reports with replay
