# Ex Nihilo — Comprehensive UX Audit

**Date:** 2026-03-22
**Scope:** Full game flow from main menu through gameplay to victory/defeat.
**Method:** Systematic review of every screen file, component, and App.tsx wiring.

---

## Game Flow Overview

1. **Main Menu** (Phaser `MainMenuScene`) — New Game / Multiplayer / Settings / Credits
2. **Species Creator** (`SpeciesCreatorScreen`) — Design or pick a species
3. **Game Setup** (`GameSetupScreen`) — Galaxy config, empire name, government
4. **Galaxy Map** (Phaser `GalaxyMapScene` + React overlay with TopBar, SystemInfoPanel, Minimap, EventLog)
5. **System View** (Phaser `SystemViewScene` + PlanetDetailPanel, FleetPanel)
6. **Full-screen overlays:** Research, Ship Designer, Diplomacy, Fleet, Economy, Espionage, Pause Menu, Save/Load, Battle Results, Victory

---

## Issues Found

### Critical Severity (blocks progression or causes data loss)

#### C-1: VictoryTracker component exists but is never rendered
**File:** `packages/client/src/ui/components/VictoryTracker.tsx`
**Description:** The `VictoryTracker` component is fully implemented (score breakdown, victory condition progress bars, rival warnings) but is never rendered anywhere in `App.tsx`. Players have no way to see their progress towards victory during gameplay — this is a core gameplay feature gap.
**Fix:** Wire VictoryTracker into the main game HUD in App.tsx, positioned near the minimap. Requires computing VictoryProgress each tick from engine state.

#### C-2: Espionage event log is never populated
**File:** `packages/client/src/ui/App.tsx` (line ~233)
**Description:** `espionageEventLog` is initialised as an empty array and the setter `_setEspionageEventLog` has an underscore prefix indicating it's intentionally unused. The comment says "will be wired to engine events once the game loop is integrated" — but this means the Espionage Screen's event log section is always empty, making players unable to see results of their spy missions.
**Fix:** Wire `engine:espionage_event` (or similar) to populate the espionage event log from the game loop.

#### C-3: Diplomacy actions have no engine backing
**File:** `packages/client/src/ui/App.tsx` (lines ~538-553)
**Description:** The `handleDeclareWar` and `handleProposeTreaty` callbacks only play sound effects — they do not actually modify the game state. Declaring war, proposing treaties, sending gifts, establishing trade routes, and making peace all fire handler functions that are either stubs or audio-only. The diplomacy screen gives the visual impression of a working system but no actions have real consequences.
**Fix:** Add `GameEngine` methods for diplomatic actions (declarWar, proposeTreaty, sendGift, makePeace, establishTradeRoute) and wire them to the handlers.

---

### High Severity (confusing or frustrating to the player)

#### H-1: FleetPanel shows raw system ID instead of system name
**File:** `packages/client/src/ui/components/FleetPanel.tsx` (line 195)
**Description:** The fleet subtitle reads `{ships.length} ships — {fleet.position.systemId}` displaying a raw UUID instead of a human-readable system name. This makes it very difficult for the player to know where their fleet is located.
**Fix:** Accept a `systemName` prop or resolve the system name from a prop/context.

#### H-2: FleetPanel disband warning shows raw system ID
**File:** `packages/client/src/ui/components/FleetPanel.tsx` (line 395)
**Description:** The disband warning says "All ships will be left at {fleet.position.systemId}" — again a raw UUID.
**Fix:** Same resolution as H-1 — resolve system name.

#### H-3: TechDetailPanel displays "Defense" (US English) instead of "Defence" (UK English)
**File:** `packages/client/src/ui/components/TechDetailPanel.tsx` (line 58)
**Description:** The category label map uses `'Defense'` while the project convention specifies UK English. The ResearchScreen itself correctly uses "Defence" in `CATEGORY_DISPLAY_NAMES` but TechDetailPanel has its own inconsistent copy.
**Fix:** Change to `'Defence'` in TechDetailPanel's CATEGORY_LABELS.

#### H-4: No feedback when game speed is changed via keyboard
**File:** `packages/client/src/ui/App.tsx` (lines 379-393)
**Description:** Pressing keys 1-5 changes game speed via `setGameSpeed()`, but the engine's speed is only visually reflected in the TopBar speed buttons. There is no audio feedback or notification that speed changed. Combined with the fact that keys 1-5 are not obviously speed controls, new players may accidentally change speed without realising it.
**Fix:** Play a subtle click SFX on speed change. Optionally show a brief toast.

#### H-5: Economy screen has no back/close keyboard shortcut documented
**File:** `packages/client/src/ui/screens/PauseMenu.tsx` (keyboard shortcuts section)
**Description:** The shortcuts reference lists "E" to open Economy but does not mention that Escape closes it. This is consistent across all overlays — Escape closes them — but it's not documented.
**Fix:** Add a general note "Escape closes any open overlay" to the shortcuts panel.

#### H-6: Multiplayer server URL is hardcoded to localhost
**File:** `packages/client/src/ui/screens/MultiplayerLobbyScreen.tsx` (line 45)
**Description:** `const SERVER_URL = 'http://localhost:3000'` is hardcoded. Any deployment to a real server would break multiplayer.
**Fix:** Use an environment variable or configuration constant.

#### H-7: No loading state or error boundary for game screens
**File:** `packages/client/src/ui/App.tsx`
**Description:** When switching between screens (e.g., opening Research or Diplomacy), there is no loading indicator. If the engine is slow to respond or data is not yet available, the player sees either nothing or potentially stale data.
**Fix:** Add a brief loading spinner or at minimum ensure all screens handle the "no data" state gracefully.

---

### Medium Severity (suboptimal but workable)

#### M-1: TopBar action buttons use inline style for gap/pointer-events
**File:** `packages/client/src/ui/components/TopBar.tsx` (line 93)
**Description:** `style={{ display: 'flex', gap: '4px', pointerEvents: 'auto' }}` is inline CSS that should be in the stylesheet for consistency. All other components use CSS classes.
**Fix:** Move to a CSS class.

#### M-2: Emoji icons in TopBar may not render consistently across platforms
**File:** `packages/client/src/ui/components/TopBar.tsx` (lines 95-105)
**Description:** TopBar uses emoji characters for button labels (e.g., `⚗`, `⚙`, `⚓`, `₵`, `🕵`, `☮`). These render differently across operating systems and may be missing or replaced with boxes on some systems.
**Fix:** Consider using consistent text-based icons (like the `[WPN]` style used in TechCard) or SVG icons.

#### M-3: Species Creator trait total validation allows negative points remaining
**File:** `packages/client/src/ui/screens/SpeciesCreatorScreen.tsx` (lines 254-255)
**Description:** The `overBudget` flag prevents submission, but there is no clamping on individual slider values. A player could set all traits to 10 (total 70 vs budget 42), see a negative remainder, and be confused about why Continue is disabled.
**Fix:** Add a visual warning explaining the budget system or clamp total in real time.

#### M-4: Save name "__autosave__" rejection message is technical
**File:** `packages/client/src/ui/screens/SaveLoadScreen.tsx` (lines 61-62)
**Description:** The error message `'"__autosave__" is reserved for auto-saves.'` exposes an internal implementation detail. Players would never type this naturally, but the message is still user-unfriendly.
**Fix:** Change to something like `'This name is reserved. Please choose a different name.'`

#### M-5: PlanetDetailPanel atmosphere labels are incomplete
**File:** `packages/client/src/ui/components/PlanetDetailPanel.tsx` (lines 10-18)
**Description:** The `ATMOSPHERE_LABELS` map is missing some atmosphere types that exist in the Species Creator (e.g., `nitrogen`, `hydrogen`, `sulfur_dioxide`). If a planet has one of these atmospheres, the raw key is displayed instead of a human-readable label.
**Fix:** Add the missing atmosphere type labels.

#### M-6: EventLog uses Unicode symbols that may render inconsistently
**File:** `packages/client/src/ui/components/EventLog.tsx` (lines 23-31)
**Description:** Category icons use Unicode characters like `⚗`, `⚒`, `⛵`, `⚑`, `⇄`, `⚔`, `•`. Some of these may not render in all fonts/browsers.
**Fix:** Use consistent ASCII-based icons or ensure a web font covers these codepoints.

#### M-7: No visual indication that the minimap is clickable
**File:** `packages/client/src/ui/components/Minimap.tsx`
**Description:** The minimap canvas has `onClick` wired to navigate, and a `title="Click to navigate"` attribute, but there is no cursor change or visual affordance suggesting it's interactive.
**Fix:** Add `cursor: pointer` CSS to the minimap canvas.

#### M-8: PauseMenu "Settings" button has an inconsistent close glyph
**File:** `packages/client/src/ui/screens/PauseMenu.tsx`
**Description:** The close button uses `✕` (multiplication sign U+2715) in the original code. After the C3 changes it was normalised to `&#10005;` (same character). However, other close buttons in the app (DiplomacyScreen, BattleResultsScreen) use `×` (multiplication sign U+00D7) or `&#10005;`. These should be consistent.
**Fix:** Standardise all close buttons to use the same glyph.

#### M-9: FleetScreen pulls data directly from engine global
**File:** `packages/client/src/ui/screens/FleetScreen.tsx`
**Description:** FleetScreen calls `getGameEngine()` directly to read state, bypassing the props-based data flow used by all other screens. This means it cannot be tested with mock data and is tightly coupled to the global engine singleton.
**Fix:** Pass fleet/ship data via props from App.tsx, consistent with other screens.

#### M-10: Research allocation UI does not show total allocation across all active projects
**File:** `packages/client/src/ui/components/TechDetailPanel.tsx`
**Description:** When starting a new research project, the player sets an allocation slider but cannot see how much allocation is already committed to other projects without counting mentally. This makes it easy to accidentally over-allocate and get an error.
**Fix:** Show "X% allocated / Y% remaining" in the TechDetailPanel.

---

### Low Severity (minor polish)

#### L-1: ColoniseNotification auto-dismiss timer is not cancellable
**File:** `packages/client/src/ui/components/ColoniseNotification.tsx`
**Description:** The notification auto-dismisses after 3 seconds but there is no way to dismiss it early by clicking.
**Fix:** Add an onClick handler to dismiss immediately.

#### L-2: VictoryScreen "empireColours" prop name uses UK spelling (correct per convention) but internal labels use US spelling of "color"
**File:** `packages/client/src/ui/screens/VictoryScreen.tsx` (line 44 uses `empireColours`, line 119 uses `color` for `backgroundColor`)
**Description:** Minor inconsistency — the prop uses UK `empireColours` but CSS/React uses US `color` (as required by React/CSS). This is acceptable but worth noting.
**Fix:** None needed — React requires US spelling for style properties.

#### L-3: ShipDesignerScreen imports directly from shared-data subpath
**File:** `packages/client/src/ui/screens/ShipDesignerScreen.tsx` (line 11)
**Description:** `import { HULL_TEMPLATES, SHIP_COMPONENTS } from '@nova-imperia/shared-data/ships/index.js'` bypasses the main shared package barrel export, creating a fragile import path.
**Fix:** Import from `@nova-imperia/shared` if these are re-exported from the barrel.

#### L-4: GameSetupScreen seed input has no maximum length
**File:** `packages/client/src/ui/screens/GameSetupScreen.tsx`
**Description:** The seed text input has no `maxLength` attribute. A player could paste an extremely long string.
**Fix:** Add `maxLength={20}` or similar.

#### L-5: BattleResultsScreen does not show which side the player was on
**File:** `packages/client/src/ui/screens/BattleResultsScreen.tsx`
**Description:** The screen shows "Attacker" vs "Defender" with empire names but does not explicitly highlight which side is the player's empire (unlike VictoryScreen which has a "You" badge).
**Fix:** Add a "You" indicator to the player's side.

#### L-6: PauseMenu "Quit Game" does nothing in browser
**File:** `packages/client/src/ui/screens/PauseMenu.tsx` (lines 286-298)
**Description:** The "Quit Game" button tries to use the Tauri API to close the window. In a browser context, it falls through to `onExitToMainMenu()` which is identical to "Exit to Main Menu". Having two buttons that do the same thing is confusing.
**Fix:** Hide the "Quit Game" button when not running in a Tauri desktop context.

#### L-7: TopBar does not display the current game tick/turn
**File:** `packages/client/src/ui/components/TopBar.tsx`
**Description:** The player has no way to see what tick/turn it is during gameplay (except by opening the Diplomacy screen which shows "Turn X"). This is basic information that should be visible at all times.
**Fix:** Add a tick/turn counter to the TopBar.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 7     |
| Medium   | 10    |
| Low      | 7     |
| **Total**| **27**|

## Recommended Priority for Fixes

1. **C-1** (VictoryTracker not rendered) — core gameplay visibility
2. **C-3** (Diplomacy actions are stubs) — deceptive UI
3. **C-2** (Espionage event log empty) — feature gap
4. **H-1 + H-2** (Fleet panel shows UUIDs) — quick fix, high impact
5. **H-3** (UK English consistency) — quick fix
6. **H-7** (No loading/error state) — structural improvement
7. **L-7** (No turn counter in TopBar) — quick, high visibility
8. **M-5** (Missing atmosphere labels) — data completeness
9. **M-7** (Minimap cursor) — quick CSS fix

**Note:** Issues affecting files owned by Streams A or B (`PlanetRenderer.ts`, `SystemViewScene.ts`, `universal-tree.json`, `ResearchScreen.tsx`) have been excluded from fixes. Any findings in those files are deferred to a follow-up plan.
