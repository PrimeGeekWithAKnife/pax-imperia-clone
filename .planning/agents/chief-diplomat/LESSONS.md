# Chief Diplomat -- Lessons Learnt

## Current State
- Diplomacy engine implements dual-score model: attitude (-100 to +100) and trust (0 to 100)
- Per-tick processing handles attitude drift, treaty expiration, AI personality-driven evaluation
- Treaty types exist in the type system
- Diplomatic incidents are logged
- Espionage engine handles spy recruitment, infiltration, mission resolution
- UX audit found: diplomacy actions have NO ENGINE BACKING -- declaring war, proposing treaties, making peace are all UI stubs
- Missing: casus belli, galactic opinion, diplomatic channels, diplomat characters, federation voting, trade embargoes, refugee crises, crisis diplomacy

## Critical Gap
- The diplomacy UI exists but the engine doesn't back it -- this is the biggest disconnect in the game

## Director Decisions (29 March 2026)
- Dual-channel diplomacy: public stance + private position with confidence levels (Very High → Very Low)
- Player sets own public/private positions -- caught lying destroys trust permanently
- Diplomatic tells: military buildup, spy activity, economic prep contradict stated positions
- Grievance decay is tiered: minor slights fade, medium offences slow, existential betrayals NEVER
- Casus belli required but relative -- context and government type determine flexibility
- Grievances tradeable: empires pool grievances for coalition wars
- All character types (diplomats, soldiers, spies, admirals, generals, governors) trainable through special buildings
- Diplomats have personal agendas that can conflict with player goals -- alignment matters
- Diplomatic meetings produce narrative summary reports based on diplomat skill
- Galactic Council voting weighted by: reputation, belief, economy, military, intentions, class
- Advisory AND binding resolutions; council matures over time
- Empires can leave council AND form rival blocs -- competing institutions with own currencies/markets
- Treaties fully customisable: any combination of obligations, conditions, timelines, triggers
- Treaty violations judged by spirit not letter; context matters; pattern brands you untrustworthy
- Secret treaties fully supported -- discoverable only through espionage
- Espionage operations phased with modular deniability -- compartmentalised agents
- False flag operations core capability -- fabricate pretexts, frame third parties
- Any character recruitable through vulnerability: ideology, coercion, vice, disillusionment
- Triple agents possible -- layers of deception, never fully certain of loyalty
