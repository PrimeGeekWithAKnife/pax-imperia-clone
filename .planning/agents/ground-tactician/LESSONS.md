# Ground Tactician -- Lessons Learnt

## Current State
- Ground combat engine models 19 distinct unit types
- Terrain bonuses by planet type (terran: +20%, ice: +40%, volcanic: +40%)
- Morale collapse at threshold 10
- War crimes tracking for WMD usage
- Fortification bonuses from military buildings
- Planetary assault stages defined (bombardment, blockade, ground invasion, control)
- Post-conquest occupation options (peaceful through genocide)
- Detailed unrest mechanics
- Missing: tactical terrain within a planet, supply line mechanics, weather effects, unit experience progression, special operations, detailed WMD consequences, siege mechanics

## Director Decisions (29 March 2026)
- Ground combat is a MAJOR PILLAR equal to space combat -- not secondary
- XCOM-style grid with platoons (not individuals), terrain, cover, weather
- Auto-resolve only after 10 similar battles fought manually -- earned, not given
- Unit designer for ground forces: chassis + weapon + armour + specials (like ship designer)
- Orbital superiority is advantage, not deterministic result -- cut-off forces can fight on and win
- Defenders have supply advantage; captured alien supplies may be incompatible with attacker equipment
- Civilian infrastructure is tactical: farms feed, factories produce munitions, power plants keep shields up
- Destroying infrastructure = damaging what you're conquering (trade-off)
- Tactical map generated from actual planet buildings, terrain, gravity
- Weather depends on planet development: atmospheric processors tame it, raw worlds are chaotic
- Species-specific terrain advantages (Drakmari on ocean worlds, Khazari on volcanic, etc.)
- No objective moral judgement on WMDs -- context determines galaxy's reaction
- Attitude decay is NOT flat: some betrayals are permanent, species temperament varies
- War crimes require evidence and witnesses -- "fact-finding committees" can be sabotaged
- Galactic tribunal has limited power (UN model) -- enforcement is messy and political
- Most people don't fight to the death (robots and bio-weapons do) -- morale drives surrender
- POWs: release, labour, imprison for exchange, recruit turncoats -- all valid options
- Defeated forces can become insurgents/guerrillas -- winning ≠ controlling
- Commanders, stimulants, health, allies all affect morale directly
