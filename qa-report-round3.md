# QA Report — Adversarial Playtest Round 3

**Date:** 2026-03-31
**Tester:** Automated QA (Claude)
**Test file:** `packages/shared/src/__tests__/adversarial-playtest-r3.test.ts`
**Result:** 41/41 tests PASS (no crashes in any scenario)

---

## Executive Summary

Round 3 tested save/load integrity, AI diplomacy edge cases, late-game stress (2000 ticks), research edge cases, and fleet movement corner cases. **No hard crashes were found** -- the engine is remarkably robust. However, the playtest uncovered **3 bugs**, **3 design concerns**, and **2 behavioural observations** that would affect player experience.

---

## BUGS FOUND

### BUG 7 (CRITICAL): DiplomacyState not serialised in save/load

**Severity:** Critical
**File:** `packages/shared/src/engine/save-load.ts`
**Evidence:** The `diplomacyState` field (which tracks the full dual-score attitude/trust model, active treaties, and diplomatic incidents) is stored on `GameTickState` via a dynamic `as unknown as Record<string, unknown>` cast in `game-loop.ts` (lines 972, 979, 987, 1955, 2794, 3147, 3272+). However, `SerializedTickState` has no `diplomacyState` field, and neither `serializeTickState()` nor `deserializeTickState()` handle it.

**Impact:** When a player saves and loads, ALL diplomatic relations tracked by the diplomacy engine are lost. Attitude scores, trust levels, active treaties, trade routes, and diplomatic incident logs vanish. The game continues running because `game-loop.ts` uses fallback logic (`?? undefined` or null checks), but the player's carefully built diplomatic relationships are gone.

**Reproduction:** Save a game after 200+ ticks. Load it. Check diplomacy panel -- all relations reset to blank.

### BUG 8 (MAJOR): Multiple dynamic state fields not serialised in save/load

**Severity:** Major
**File:** `packages/shared/src/engine/save-load.ts`
**Evidence:** The same `as unknown as Record<string, unknown>` pattern is used for many other state fields that are also NOT serialised:

| Field | Purpose | Lost on save/load? |
|---|---|---|
| `diplomacyState` | Full attitude/trust diplomacy engine | YES |
| `corruptionStates` | Per-empire corruption tracking | YES |
| `minorSpecies` | Minor species integration/uplift state | YES |
| `excavationSites` | Active anomaly excavations | YES |
| `marketState` | Commodity marketplace state | YES |
| `diseaseStates` | Active disease/pandemic tracking | YES |
| `politicalStates` | Faction/election/policy state | YES |
| `grievances` | Inter-empire grievance tracking | YES |
| `diplomats` | Diplomat character progression | YES |
| `organisationState` | Galactic council/organisation state | YES |
| `galacticEvents` | Active galactic event chains | YES |
| `notifications` | Notification queue | YES |

**Impact:** Save/load effectively resets numerous subsystems to their initial state while preserving core game data (empires, resources, research, ships). This creates a jarring disconnect for players -- their pandemic is suddenly cured, their excavation progress lost, their marketplace orders cancelled.

**Root cause:** These fields were added to `GameTickState` after the save/load system was written, using type assertion casts instead of adding them to the `GameTickState` interface and `SerializedTickState`.

### BUG 9 (MODERATE): Stale movement orders after save/load

**Severity:** Moderate
**File:** `packages/shared/src/engine/game-loop.ts`, line 918
**Evidence:** After save/load at tick 200, the game log shows 7 warnings:
```
[game-loop] Movement order references unknown fleet "cd80d19d" -- discarding
[game-loop] Movement order references unknown fleet "46a182d9" -- discarding
...
```

The movement orders reference fleet IDs that no longer exist after deserialisation. The game handles this gracefully (discarding stale orders), but fleets in transit at save time lose their orders silently. Players would notice their fleets stopping mid-journey after loading a save.

**Impact:** Fleets in transit at save time stop moving after load. The player receives no notification about this.

---

## DESIGN CONCERNS

### CONCERN 1: Espionage sabotage is excessively destructive in late game

**Severity:** Medium
**Evidence:** Test output shows dozens of consecutive sabotage events destroying buildings on the same planet:
```
[Espionage] Sabotage destroyed factory on Mirax I
[Espionage] Sabotage destroyed factory on Mirax I
[Espionage] Sabotage destroyed factory on Mirax I
... (51 consecutive sabotage events on the same planet)
```

A single AI spy mission can strip an entire planet of all buildings. There appears to be no cooldown between sabotage attempts, no diminishing returns, and no cap on damage per tick. In the 1000-tick test, one planet (Mirax I) was reduced to zero buildings by repeated sabotage.

**Player impact:** An AI spy can completely destroy a player's most developed planet with no counterplay if counter-intelligence is not high enough. This feels unfair and unstrategic.

**Recommendation:** Add a cooldown between sabotage events on the same planet (e.g. 10 ticks), cap damage per tick, or require multiple spies for repeated sabotage.

### CONCERN 2: No natural victory in 2000 ticks

**Severity:** Low
**Evidence:** After 2000 ticks with 4 AI empires, the game status is still `'playing'`. No victory condition triggered naturally. The test artificially assigned 80% of planets to trigger conquest victory, confirming the mechanic works, but the AI never achieves it organically.

This suggests the game pace may be too slow for victory conditions to trigger in a reasonable play session. The Ascension Project costs 25,000 research points with 5 prerequisites -- it may be unreachable in normal gameplay without dramatically accelerating research.

**Recommendation:** Review victory condition thresholds and tech costs for pacing. Consider adding a "score victory" at a configurable tick limit as a fallback.

### CONCERN 3: War-then-instant-peace exploit

**Severity:** Low
**Evidence:** Test confirms an empire can declare war and immediately propose peace on the same tick. The result: trust drops from 20 to 0, attitude drops to -50, but no actual combat occurs. A player could use this to grief AI empires by triggering war penalties (treaty-breaking, attitude/trust destruction) without any military risk.

**Recommendation:** Add a minimum war duration (e.g. 10 ticks) before peace negotiations are allowed.

---

## BEHAVIOURAL OBSERVATIONS

### OBS 1: AI war strategy is thoughtful and conservative

The war strategy evaluation system works well. With zero fleets, the AI correctly evaluates:
```
MAINTAIN PEACE -- warScore: -27, peaceScore: 63, threshold: 15/60, confidence: 0.79
Military disadvantage (0.0x) -- caution advised
```

The multi-factor decision engine (military calculus, victory alignment, species nature, domestic opinion, geographic vulnerability) produces rational behaviour. All tested personalities made sensible war/peace decisions.

### OBS 2: Research independence is solid

Two empires researching the same technology have completely independent state. No shared-state corruption was observed. The research system correctly handles: zero allocation, queue promotion, prerequisite enforcement, species-specific filtering, and the "all techs completed" scenario.

---

## TEST COVERAGE SUMMARY

| Scenario | Tests | Pass | Fail | Notes |
|---|---|---|---|---|
| 6: Save/Load integrity | 9 | 9 | 0 | Found BUG 7, 8, 9 via code inspection |
| 7: AI diplomacy edge cases | 9 | 9 | 0 | All edge cases handled correctly |
| 8: Late-game stress | 7 | 7 | 0 | No NaN/Infinity/overflow in 2000 ticks |
| 9: Research & tech tree | 7 | 7 | 0 | Solid prerequisite enforcement |
| 10: Fleet & wormhole edges | 9 | 9 | 0 | Graceful degradation on all edge cases |
| **TOTAL** | **41** | **41** | **0** | |

---

## RECOMMENDED PRIORITY ORDER FOR FIXES

1. **BUG 7+8** (Critical): Add all dynamic state fields to `SerializedTickState` and the serialize/deserialize functions. This is the most impactful issue -- save/load is fundamentally broken for half the game's subsystems.
2. **BUG 9** (Moderate): Notify the player when movement orders are discarded after load, or better yet, preserve fleet-to-movement-order associations through serialisation.
3. **CONCERN 1** (Medium): Add sabotage cooldown/cap to prevent espionage from being game-breakingly destructive.
4. **CONCERN 3** (Low): Add minimum war duration before peace is allowed.
5. **CONCERN 2** (Low): Review victory condition pacing for natural AI progression.
