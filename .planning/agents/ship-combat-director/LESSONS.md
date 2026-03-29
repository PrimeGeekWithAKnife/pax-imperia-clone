# Ship Combat Director -- Lessons Learnt

## Current State
- 56 ship components across 10 hull classes
- Power budget system
- Armour slider mechanic
- Weapon categories: energy, kinetic, propulsion, mechanical
- Species trait combat modifiers
- Government bonus combat modifiers
- Beam falloff at range (30% at max range)
- 9-level experience system (recruit through legendary)
- Skirmish mode with pre-battle overlay and component age gating
- Carrier mechanics implemented
- Warp gating mechanic

## Recent Fixes
- Beam max range falloff corrected to 30%
- AI retargets dead enemies properly
- combatBonus access path fixed
- 'green' renamed to 'recruit' in experience system

## Key Principle
- Keep combat interactive and tactical -- this differentiates Ex Nihilo from ES2's passive "watch it play out" combat

## Director Decisions (29 March 2026)
- Fleet strategies NOT battle cards: circular rotation, close proximity/boarding, skirmish, max range/kiting, named manoeuvres (Riker etc.)
- Stances layer on top of strategies: aggressive, defensive, flanking, escort
- Asymmetric weapon/defence triangle (no perfect answers):
  - Beams least effective vs shields
  - Kinetics least effective vs armour
  - Missiles least effective vs speed/PD/ECM
- Player rewarded for clever tactics: use cover, cloaking surprise, range exploitation
- Scouting informs counter-design but is an advantage not an instant win
- Combined arms essential: carriers + fighters + EW ships + repair ships + scouts
- Shield-sharing technology between allied ships
- Fighters return to hangars for repairs and ammo reloads
- Targeting information shared across fleet
- Mono-fleets viable but brittle; diverse fleets adapt
