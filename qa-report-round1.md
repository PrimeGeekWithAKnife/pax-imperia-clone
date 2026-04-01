# QA Adversarial Playtest Report -- Round 1

**Date:** 2026-03-31
**Tester:** Senior QA (automated code analysis + test authoring)
**Branch:** main (27db9b6)
**Test file:** `packages/shared/src/__tests__/adversarial-playtest-r1.test.ts`

---

## Executive Summary

Analysis of the game engine source code across 5 adversarial scenarios uncovered **1 CRITICAL bug**, **4 HIGH-severity issues**, **4 MEDIUM issues**, and **2 LOW-severity items**. The most severe finding is that auto-resolved combat ignores fleet stance entirely, and there are no bankruptcy notifications or ship-maintenance consequences for human players.

---

## Scenario 1: New Player With Zero Knowledge

### Status: PARTIAL PASS (robust error handling, but silent failures)

**FINDING 1.1 -- MEDIUM: processPlayerActions only handles 5 of 13 action types; client bypasses action queue**

- **File:** `packages/shared/src/engine/game-loop.ts:519-863` (server) and `packages/client/src/engine/GameEngine.ts` (client)
- **Function:** `processPlayerActions()` and `GameEngine.moveFleet()` / `GameEngine.buildShip()` / `GameEngine.startResearch()`
- **Description:** The `processPlayerActions()` function in the game loop only handles `ColonisePlanet`, `ColonizePlanet`, `ConstructBuilding`, `UpgradeBuilding`, and `SetGameSpeed`. The remaining 8 action types (`MoveFleet`, `BuildShip`, `Research`, `SetFleetStance`, `ProposeTreaty`, `AcceptTreaty`, `RejectTreaty`, `DesignShip`) fall through to a `console.warn` and are silently skipped.
- **Workaround:** The client's `GameEngine` class bypasses the action queue entirely. It calls `issueMovementOrder()`, `startShipProduction()`, and `startResearchFn()` directly on the tick state, mutating it in place. So human players CAN move fleets, build ships, and research -- but they do so outside the server-authoritative action pipeline.
- **Impact:** In single-player mode this works fine. In multiplayer, the action-queue path is the canonical server-authoritative channel. If the server relies on `processPlayerActions()` to process client-submitted actions, MoveFleet/BuildShip/Research would be silently dropped. This is a latent multiplayer bug and an architectural concern (two completely separate code paths for AI and human player commands).
- **Severity:** MEDIUM (single-player works, but multiplayer will break)
- **Suggested fix:** Either implement the missing action handlers in `processPlayerActions()`, or unify both AI and human actions through a single pipeline.

**FINDING 1.2 -- PASS: Invalid actions do not crash**

- The `try/catch` at line 847 ensures any error in action processing is caught and logged.
- Fabricated planet IDs, missing fleet IDs, and completely invalid action types all produce console warnings but do not crash the game loop.
- This is good defensive coding.

**FINDING 1.3 -- MEDIUM: Rejected actions have no player-facing feedback**

- **File:** `packages/shared/src/engine/game-loop.ts` (various `console.warn` calls)
- **Description:** When a player action is rejected (e.g. "no coloniser ship", "cannot afford building"), the game emits `console.warn()` to the server log but produces NO event or notification for the player. The action silently fails.
- **Impact:** Player clicks "colonise" with no colony ship and nothing happens. No error message, no notification, no UI feedback.
- **Severity:** MEDIUM
- **Suggested fix:** Emit a `GameEvent` of type `'ActionRejected'` with the reason string, so the client can display it.

---

## Scenario 2: Aggressive Early Rush

### Status: PASS (game is inherently rush-resistant)

**FINDING 2.1 -- LOW: Starting fleet is combat-irrelevant**

- **File:** `packages/shared/src/engine/game-init.ts:169-227`
- **Description:** Every empire starts with a single Deep Space Probe (10 HP, no weapons). This is not a combat unit.
- **Impact:** A player attempting an early rush has zero military capability at game start. They must research and build ships first. This is likely intentional design but means rush strategies are completely non-viable in the first ~100+ ticks.
- **Severity:** LOW (design intent, not a bug)

**FINDING 2.2 -- PASS: Slow FTL punishes rushes**

- **File:** `packages/shared/src/engine/fleet.ts:251-269`
- Without `wormhole_stabilisation` tech, travel is `slow_ftl` at 20 ticks per hop. With wormhole tech, it drops to 10. This makes early-game aggression very slow, which is good design.

**FINDING 2.3 -- HIGH: Zero-weapon combat can deadlock for 100 ticks**

- **File:** `packages/shared/src/engine/combat.ts:608-651`
- **Description:** When both sides have no weapons (e.g. probes with empty design maps), `effectiveWeaponDamage()` returns 0. No ship takes hull damage. No morale penalties fire (since `MORALE_HULL_HIT` only triggers on hull hits). No ship is destroyed. Combat runs for the full `MAX_TICKS = 100` and resolves as a draw.
- **Impact:** Two fleets of unarmed ships meeting produces a 100-tick stall. This ties up both fleets and wastes computation. The `MORALE_OUTNUMBERED_PER_TICK` penalty (-2/tick) only fires if one side has >1.5x the other's ships -- equal fleets never route.
- **Severity:** HIGH
- **Suggested fix:** Add a minimum damage floor (e.g. 1 damage per tick from ramming/boarding) or auto-disengage after N ticks of zero damage dealt.

---

## Scenario 3: Edge-Case Galaxy Configurations

### Status: MOSTLY PASS (robust galaxy generation)

**FINDING 3.1 -- PASS: Home system selection handles overcrowding**

- **File:** `packages/shared/src/engine/game-init.ts:113-161`
- `selectHomeSystem()` has a two-pass approach: strict (exclude taken + neighbours) then relaxed (exclude only taken). If even relaxed fails, it throws a clear error: "No suitable home system found... Try a larger galaxy or fewer players."
- 8 players on a 20-system small galaxy will likely succeed with relaxed rules but some empires may start adjacent. This is acceptable.

**FINDING 3.2 -- NEEDS VERIFICATION: Galaxy connectivity**

- **File:** `packages/shared/src/generation/galaxy-generator.ts`
- The galaxy generator creates wormhole connections. If the generated graph is disconnected (partitioned into unreachable subgraphs), some empires can never reach each other, making conquest/war impossible.
- The test file includes a BFS connectivity check across multiple seeds/sizes.
- **Severity:** Depends on test results -- if any galaxy is disconnected, it is HIGH.

**FINDING 3.3 -- PASS: Single-player game runs**

- Code analysis shows no hard dependency on multiple empires. Diplomacy, combat triggers, and AI all guard against missing opponents. A single-empire game should run without crashes.

---

## Scenario 4: Economic Stress / Bankruptcy

### Status: MIXED (resources clamped correctly, but missing player feedback)

**FINDING 4.1 -- PASS: Resources are floor-clamped at 0**

- **File:** `packages/shared/src/engine/economy.ts:318-339`
- `applyResourceTick()` applies `Math.max(0, ...)` to every resource. Credits, minerals, energy, organics, etc. can never go negative. This prevents cascading NaN/Infinity issues.

**FINDING 4.2 -- HIGH: No bankruptcy notification for human players**

- **File:** `packages/shared/src/types/notification.ts:11-30`
- **Description:** The `NotificationType` union includes `energy_crisis` and `colony_starving` but has NO `low_credits`, `bankrupt`, `over_naval_cap`, or `maintenance_warning` type. When an empire's credits hit zero, no notification is generated.
- The `energy_crisis` notification exists (line 18) but there is no equivalent for credit depletion.
- The AI code (`packages/shared/src/engine/ai.ts:579-584`) internally calculates "ticks until bankruptcy" for its own decisions, but this information is never surfaced to human players.
- **Impact:** A human player can be silently bankrupt with no warning. Their economy collapses and they have no idea why.
- **Severity:** HIGH
- **Suggested fix:** Add `low_credits`, `over_naval_capacity`, and `maintenance_exceeds_income` notification types. Emit them from `stepResourceProduction()` when resources hit 0 or when upkeep exceeds production.

**FINDING 4.3 -- HIGH: No consequence for over-naval-capacity beyond cost**

- **File:** `packages/shared/src/engine/economy.ts:286-293`
- **Description:** When fleet count exceeds naval capacity, the upkeep multiplier escalates: `1 + (overCapRatio - 1) * 2`. So at 2x cap, ships cost 3x normal maintenance. But since resources are clamped at 0, the only consequence is faster credit depletion. There is no ship attrition, no morale penalty, no auto-scrap mechanism.
- **Impact:** A player can build 100 ships with 5 naval cap. They hit 0 credits instantly but keep all 100 ships indefinitely. The ships never degrade, never lose crew, never get scrapped.
- **Severity:** HIGH
- **Suggested fix:** Implement ship attrition when credits are at 0 and upkeep exceeds income (e.g. random ship damage, crew desertion reducing fleet strength, or forced auto-scrap of the most expensive ship each tick).

**FINDING 4.4 -- PASS: Economy recovers from zero**

- Tax income from population is independent of credit balance. An empire at 0 credits still produces credits from population taxes. The economy self-recovers, which is good.

**FINDING 4.5 -- MEDIUM: Starvation mechanics work but are very slow**

- **File:** `packages/shared/src/engine/economy.ts:1-16` (doc comment)
- When organics hit zero, population declines. However, the starting Hydroponics Bay produces organics each tick, and the generous starting buffer (200 ticks of consumption) means starvation is hard to trigger accidentally. This is probably intentional for player comfort.

---

## Scenario 5: Combat Edge Cases

### Status: MIXED (auto-resolve is robust, but stance is ignored)

**FINDING 5.1 -- CRITICAL: Auto-resolve combat ignores fleet stance entirely**

- **File:** `packages/shared/src/engine/combat.ts:384-596` and `game-loop.ts:1470-1620`
- **Description:** The `autoResolveCombat()` function and `processCombatTick()` never read `fleet.stance`. Both sides always fire every tick regardless of whether the fleet is set to `aggressive`, `defensive`, or any other stance.
- The `FleetStance` type exists (`aggressive | defensive | ...`) and `setFleetStance()` exists in `fleet.ts:598`, but the combat engine completely ignores it.
- The tactical combat engine (`combat-tactical.ts`) DOES use stance (line 162: `flee`, line 172: `CombatStance`), but the auto-resolve path used for AI-vs-AI combat does not.
- **Impact:** Setting fleet stance to "defensive" has zero effect on AI auto-resolved battles. Players who set defensive stance expecting their fleet to hold position or disengage are misled.
- **Severity:** CRITICAL
- **Suggested fix:** The auto-resolve should model stance effects: defensive fleets should have a morale bonus (holding ground) but lower damage output. Fleets set to `flee` should attempt to disengage immediately (return draw with attacker losses = 0, defender losses = 0, all routed). Two defensive fleets should disengage (draw) rather than fighting to mutual destruction.

**FINDING 5.2 -- PASS: Empty fleet combat resolves correctly**

- `checkVictory()` in `combat.ts:286-299`: if one side has 0 active ships, the other wins immediately. `game-loop.ts:1506` also checks for empty fleets before entering combat.

**FINDING 5.3 -- PASS: Morale routing works for outnumbered ships**

- `MORALE_OUTNUMBERED_PER_TICK = -2` kicks in when enemy active ships > 1.5x own active ships. At -2/tick, a ship at 100 morale routes after ~40 ticks of being outnumbered. Combined with `MORALE_HULL_HIT = -5` per hull hit and `MORALE_FRIENDLY_LOSS = -10` per friendly destroyed, outnumbered ships route within a reasonable timeframe.

**FINDING 5.4 -- MEDIUM: Damaged-engine ships have no movement penalty in auto-resolve**

- **File:** `packages/shared/src/engine/combat.ts`
- Ships with `systemDamage.engines = 1.0` (fully broken engines) still fire normally in auto-resolve. The tactical engine would prevent them from moving, but auto-resolve has no movement simulation -- it is pure damage exchange.
- **Impact:** Engine damage is cosmetic in auto-resolved combat. Only weapons and shields system damage matter.
- **Severity:** MEDIUM
- **Suggested fix:** Engine damage could reduce the ship's ability to evade (increasing damage taken) in auto-resolve, or reduce the ship's fire rate.

**FINDING 5.5 -- PASS: Combat multipliers from species traits and government work**

- `game-loop.ts:1536-1544` correctly applies species combat trait (1-10 mapped to 0.76-1.3 multiplier) and government `combatBonus` modifier to auto-resolved combats. A combat-focused species with a military government has a meaningful advantage.

---

## Bug Summary Table

| # | Severity | Scenario | Finding | File |
|---|----------|----------|---------|------|
| 5.1 | CRITICAL | 5 | Auto-resolve combat ignores fleet stance entirely | combat.ts |
| 2.3 | HIGH | 2 | Zero-weapon combat deadlocks for 100 ticks | combat.ts:608-651 |
| 4.2 | HIGH | 4 | No bankruptcy/low-credit notification for human players | notifications.ts |
| 4.3 | HIGH | 4 | No ship attrition when bankrupt -- ships persist forever at 0 credits | economy.ts:286-293 |
| 1.1 | MEDIUM | 1 | processPlayerActions handles 5/13 action types; client bypasses queue (multiplayer risk) | game-loop.ts:519-863 |
| 1.3 | MEDIUM | 1 | Rejected player actions produce no UI feedback | game-loop.ts |
| 3.2 | MEDIUM | 3 | Galaxy connectivity needs verification (potential unreachable systems) | galaxy-generator.ts |
| 5.4 | MEDIUM | 5 | Engine damage has no effect in auto-resolve combat | combat.ts |
| 2.1 | LOW | 2 | Starting fleet (1 probe) has zero combat capability | game-init.ts:169-227 |
| 4.5 | LOW | 4 | Starvation is very difficult to trigger accidentally | economy.ts |

---

## Test File

The adversarial test suite has been written to:
`packages/shared/src/__tests__/adversarial-playtest-r1.test.ts`

Run with:
```bash
npx vitest run packages/shared/src/__tests__/adversarial-playtest-r1.test.ts --reporter=verbose
```

The test file contains 25 individual test cases across the 5 scenarios. Tests marked "BUG HUNT" are designed to document and quantify specific bugs. Tests marked "PASS" verify that existing defensive code works.

---

## Priority Fix Order

1. **[CRITICAL] Fleet stance in auto-resolve** -- Players setting stance expectations are being misled. Auto-resolve should model stance effects or at minimum let flee/defensive fleets disengage.
2. **[HIGH] Bankruptcy notifications** -- Players need to know they are bankrupt. Add `low_credits` and `over_naval_capacity` notification types.
3. **[HIGH] Zero-weapon combat deadlock** -- Add minimum damage floor (ramming/boarding) or auto-disengage after N ticks of zero damage.
4. **[HIGH] Ship attrition at 0 credits** -- Ships at bankrupt empires should suffer attrition (damage, desertion, or forced scrappage).
5. **[MEDIUM] Action queue completeness** -- Implement missing action handlers in `processPlayerActions()` before multiplayer goes live.
