# Visual Polish, Tech Tree Restructure & Player Experience Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Ex Nihilo from a functional prototype into a visually polished, mechanically coherent game through three workstreams: richer planet visuals, restructured tech categories, and a comprehensive player experience audit with fixes.

**Architecture:** Three independent workstreams that can run in parallel. Stream A (planets) is purely client-side rendering. Stream B (tech categories) touches shared types + JSON data + client UI. Stream C (UX audit) is a cross-cutting review that produces a prioritised fix list then executes the top items.

**Tech Stack:** Phaser 3 Graphics API (Canvas 2D for procedural rendering), React (UI overlays), TypeScript strict mode, Vitest for tests.

---

## Stream A: Rich Planet Visuals (5 tasks)

### Task A1: Fix moon shadow orbit sync bug

**Files:**
- Modify: `packages/client/src/game/rendering/PlanetRenderer.ts:82-94` (orbit timer)
- Modify: `packages/client/src/game/rendering/PlanetRenderer.ts:522-566` (moon creation)

- [ ] **Step 1: Identify the bug** — Moon shadow graphics are created at initial position (line 549-552) but the orbit timer (lines 82-94) only repositions `m.sprite`, not the shadow. Read both sections to confirm.

- [ ] **Step 2: Extend MoonEntry interface** — Add `shadow: Phaser.GameObjects.Graphics` to the MoonEntry interface. In `addMoons()`, store the `moonShade` graphics object on the entry: `entry.shadow = moonShade`.

- [ ] **Step 3: Fix the orbit timer** — In the moon orbit timer callback, after setting `m.sprite` position, also reposition `m.shadow` to follow the moon:

```typescript
// In the orbit timer callback, after setting m.sprite position:
if (m.shadow) {
  m.shadow.setPosition(m.sprite.x + shadowOffsetX, m.sprite.y + shadowOffsetY);
}
```

- [ ] **Step 3: Verify visually** — Build client (`npm run build --workspace=packages/client`), check moon shadows track correctly.

- [ ] **Step 4: Commit** — `git commit -m "fix: moon shadows now track with orbital motion"`

---

### Task A2: Add colony lights on dark side of colonised planets

**Files:**
- Modify: `packages/client/src/game/rendering/PlanetRenderer.ts` (each planet type's draw function)

- [ ] **Step 1: Create colony lights in `addPlanetBody()`**

In PlanetRenderer.ts `addPlanetBody()` (which has the `planet` parameter), after the shadow hemisphere is drawn (~line 135), if `planet.currentPopulation > 0`, scatter 3-8 tiny bright dots using Phaser's `scene.add.arc()` on the shadowed (right) side. Number of lights scales with population (1 per 5000 pop, max 8). Use a seeded random from planet.id for consistency.

```typescript
// Using Phaser Graphics API (not Canvas 2D)
const lightsGfx = this.scene.add.graphics();
const count = Math.min(8, Math.max(0, Math.floor(planet.currentPopulation / 5000)));
for (let i = 0; i < count; i++) {
  const angle = seededRandom(planet.id, i) * Math.PI - Math.PI / 2;
  const dist = seededRandom(planet.id, i + 100) * radius * 0.8;
  const lx = cx + Math.cos(angle) * dist + radius * 0.2;
  const ly = cy + Math.sin(angle) * dist;
  lightsGfx.fillStyle(0xfff8c8, 0.5 + seededRandom(planet.id, i + 200) * 0.4);
  lightsGfx.fillCircle(lx, ly, 1);
}
container.add(lightsGfx);
```

- [ ] **Step 2: Verify lights appear on colonised planets, not on uninhabited ones.**

- [ ] **Step 3: Build and verify** — `npm run build --workspace=packages/client`

- [ ] **Step 4: Commit** — `git commit -m "feat: colony lights visible on dark side of populated planets"`

---

### Task A3: Add per-planet visual variation using planet ID as seed

**Files:**
- Modify: `packages/client/src/game/rendering/PlanetRenderer.ts` (all 8 draw functions)

- [ ] **Step 1: Create a seeded random helper** — Use `planet.id` hash to seed deterministic random for each planet, so each terran world looks different but consistent across renders.

```typescript
function seededRandom(seed: string, index: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  h = (h * 127 + index * 997) | 0;
  return ((h & 0x7fffffff) % 1000) / 1000;
}
```

- [ ] **Step 2: Update terran drawing** — Use seeded random for landmass positions, cloud positions, continent shapes. Each terran planet should look noticeably different.

- [ ] **Step 3: Update ocean, desert, ice, volcanic** — Same principle — vary crack patterns, dust storms, cloud formations per planet ID.

- [ ] **Step 4: Build and verify** — Different planets of the same type should look distinct.

- [ ] **Step 5: Commit** — `git commit -m "feat: per-planet visual variation seeded from planet ID"`

---

### Task A4: Add orbital structures for colonised planets

**Files:**
- Modify: `packages/client/src/game/rendering/PlanetRenderer.ts`
- Modify: `packages/client/src/game/scenes/SystemViewScene.ts` (planet creation)

- [ ] **Step 1: Create `drawOrbitalStructures` function** — For colonised planets with certain buildings, draw tiny orbital elements:
  - Shipyard → small L-shaped dock structure orbiting the planet
  - Spaceport → tiny satellite dot with antenna lines
  - Orbital Platform → small ring segment
  - Defence Grid → 2-3 tiny triangular defence satellites

Each is 2-4px, orbiting slowly around the planet.

- [ ] **Step 2: Wire into planet rendering** — Check the planet's buildings array and call `drawOrbitalStructures` with the appropriate building types.

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit** — `git commit -m "feat: orbital structures visible around colonised planets with shipyards/spaceports"`

---

### Task A5: Improve atmosphere rendering with gradient depth

**Files:**
- Modify: `packages/client/src/game/rendering/PlanetRenderer.ts:492-519` (atmosphere section)

- [ ] **Step 1: Improve atmosphere rendering with layered Phaser graphics** — The current approach uses concentric `strokeCircle` rings. Improve by using more rings with finer alpha gradation (6-8 rings instead of 2-3), creating a smoother gradient effect. Each ring should have decreasing alpha as it gets further from the planet surface. Use Phaser's `fillStyle(colour, alpha)` with `fillCircle()` on ring-shaped paths.

```typescript
// Using Phaser Graphics API — layered concentric fills with decreasing alpha
const atmosGfx = scene.add.graphics();
const steps = 8;
for (let i = steps; i >= 1; i--) {
  const t = i / steps;
  const ringRadius = radius + thickness * t;
  const alpha = 0.15 * (1 - t); // fades outward
  atmosGfx.fillStyle(atmosphereColourHex, alpha);
  atmosGfx.fillCircle(cx, cy, ringRadius);
}
container.add(atmosGfx);
```

- [ ] **Step 2: Add atmosphere scattering effect** — For oxygen-nitrogen atmospheres, add a subtle blue rim light arc on the lit (left) side of the planet using `strokeCircle` with a partial arc, mimicking atmospheric Rayleigh scattering.

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit** — `git commit -m "feat: gradient atmosphere hazes with scattering effect"`

---

## Stream B: Tech Category Restructure (3 tasks)

### Task B1: Move theoretical techs to their domain categories

**Files:**
- Modify: `packages/shared/data/tech/universal-tree.json`

- [ ] **Step 1: Audit all `racial` category techs** — List every tech with `"category": "racial"`. Identify which should move to a domain category:
  - "Quantum Theory" → `construction` (foundational physics)
  - "Quantum Computing" → `construction`
  - "Quantum Ciphers" → `defense`
  - "Artificial Intelligence" → `construction`
  - "Consciousness Studies" → `biology`
  - "Dark Matter Physics" → `propulsion`
  - "Singularity Mathematics" → `propulsion`
  - "Transcendence Theory" → `biology`
  - Age gate techs → keep as `racial` (they're universal milestones)
  - Genuinely species-specific techs → keep as `racial`

- [ ] **Step 2: Update categories in the JSON** — Move ~12-15 techs from `racial` to their appropriate domain categories.

- [ ] **Step 3: Run tests** — `npx vitest run packages/shared/src/__tests__/tech-tree.test.ts` — verify prerequisite chains still valid, each category has techs in each age.

- [ ] **Step 4: Commit** — `git commit -m "refactor: move theoretical techs to domain categories, racial = species-only"`

---

### Task B2: Add category descriptions to ResearchScreen

**Files:**
- Modify: `packages/client/src/ui/screens/ResearchScreen.tsx`

- [ ] **Step 1: Add category descriptions** — Each row header should show a tooltip with what the category covers:
  - Weapons: "Offensive systems — beams, projectiles, missiles, fighters"
  - Defence: "Protective systems — shields, armour, point defence, countermeasures"
  - Propulsion: "Movement — FTL drives, wormhole tech, tactical engines"
  - Biology: "Life sciences — medicine, terraforming, population, genetics"
  - Construction: "Engineering — buildings, shipyards, computing, materials"
  - Racial: "Species-unique technologies tied to your race's origin"

- [ ] **Step 2: Build and verify**

- [ ] **Step 3: Commit** — `git commit -m "feat: category descriptions in research screen tooltips"`

---

### Task B3: Ensure racial techs are species-filtered

**Files:**
- Modify: `packages/shared/src/engine/research.ts` (getAvailableTechs)
- Modify: `packages/shared/data/tech/universal-tree.json` (add speciesId field to racial techs)

- [ ] **Step 1: Add optional `speciesId` field to Technology interface** — In `packages/shared/src/types/technology.ts`, add `speciesId?: string` to the Technology interface.

- [ ] **Step 2: Tag racial techs in JSON** — Techs that are truly species-specific (like psionic abilities for Vaelori, bioengineering for Sylvani) should have a `speciesId` field. Universal theoretical techs and age gates should NOT have it.

- [ ] **Step 3: Filter in getAvailableTechs** — If a tech has `speciesId` and it doesn't match the empire's species, exclude it from available techs.

- [ ] **Step 4: Write test** — Verify species-filtered techs don't appear for wrong species.

- [ ] **Step 5: Run all tests** — `npx vitest run`

- [ ] **Step 6: Commit** — `git commit -m "feat: racial techs filtered by species, universal techs available to all"`

---

## Stream C: Player Experience Audit & Fixes (5 tasks)

### Task C1: Wire VictoryScreen (currently dead code)

**Files:**
- Modify: `packages/client/src/ui/App.tsx` (add render branch)
- Modify: `packages/client/src/engine/GameEngine.ts` (emit victory event)

- [ ] **Step 1: Add 'victory' to AppScreen type** — It is NOT currently in the union (verified). Add `| 'victory'` to the AppScreen type on line 48 of App.tsx.

- [ ] **Step 2: Add render branch** — When `currentScreen === 'victory'`, render `<VictoryScreen>`.

- [ ] **Step 3: Wire engine event** — When GameEngine detects game over, emit `engine:game_over` with winner info. App.tsx should listen and switch to victory screen.

- [ ] **Step 4: Build and verify**

- [ ] **Step 5: Commit** — `git commit -m "feat: wire VictoryScreen to game over condition"`

---

### Task C2: Replace mock diplomacy data with live engine state

**Files:**
- Modify: `packages/client/src/ui/App.tsx` (lines 84-154, mock data)
- Modify: `packages/client/src/engine/GameEngine.ts` (expose diplomacy state)

- [ ] **Step 1: Add getDiplomacyState method to GameEngine** — Return the current diplomatic relations for the player empire from the tick state.

- [ ] **Step 2: In App.tsx, replace MOCK_KNOWN_EMPIRES** — On each engine tick, build the known empires list from actual game state (AI empires the player has contacted).

- [ ] **Step 3: Pass live data to DiplomacyScreen**

- [ ] **Step 4: Build and verify** — Diplomacy screen should show actual AI empires from the game, not hardcoded mocks.

- [ ] **Step 5: Commit** — `git commit -m "feat: diplomacy screen uses live engine state instead of mock data"`

---

### Task C3: Add settings panel with audio/visual controls

**Files:**
- Modify: `packages/client/src/ui/screens/PauseMenu.tsx`

- [ ] **Step 1: Expand the Settings panel** — Currently has volume sliders and music track selector. Add:
  - Master volume, Music volume, SFX volume, Ambient volume (already exist? verify)
  - Game speed default selector
  - "Show tooltips" toggle
  - Keyboard shortcuts reference (already exists? verify)

- [ ] **Step 2: Persist settings to localStorage** — Save/restore on app load.

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit** — `git commit -m "feat: expanded settings panel with persistence"`

---

### Task C4: Comprehensive UX review agent (research only)

**Files:** None (research task — produces a report)

- [ ] **Step 1: Launch a dedicated Opus review agent** with this prompt:

"Play through Ex Nihilo from start to finish as a new player. Read every screen file, every component, trace the entire game flow. Document every UX issue you find: confusing labels, missing feedback, dead buttons, unclear flows, inconsistent styling, accessibility gaps. Write your findings to `docs/UX_AUDIT.md` with severity ratings (Critical/High/Medium/Low) and specific fix suggestions."

- [ ] **Step 2: Review the audit output** — Prioritise Critical and High items.

- [ ] **Step 3: Create follow-up tasks** from the audit findings.

---

### Task C5: Fix top 5 UX issues from audit

**Files:** Determined by Task C4 output.

- [ ] **Step 1: Read `docs/UX_AUDIT.md`**

- [ ] **Step 2: Fix Critical issues first** — These are things that prevent the player from progressing.

- [ ] **Step 3: Fix High issues** — These are things that confuse or frustrate the player.

- [ ] **Step 4: Run all checks** — `npx tsc --build --force && npx eslint packages/*/src && npx vitest run && npm run build --workspace=packages/client`

- [ ] **Step 5: Commit** — `git commit -m "fix: top UX issues from player experience audit"`

---

## Execution Order

Streams A, B, and C are independent and can run in parallel.

**Within each stream, tasks are sequential:**
- Stream A: A1 → A2 → A3 → A4 → A5
- Stream B: B1 → B2 → B3
- Stream C: C1 → C2 → C3 → C4 → C5

**Total: 13 tasks, estimated 3 parallel workstreams.**

**Parallelisation constraint:** Task C5 must NOT modify files touched by Streams A or B (`PlanetRenderer.ts`, `SystemViewScene.ts`, `universal-tree.json`, `ResearchScreen.tsx`). Any audit findings affecting those files should be deferred to a follow-up plan.

## Verification

After all streams complete:
1. `npx tsc --build --force` — zero errors
2. `npx eslint packages/*/src` — zero errors
3. `npx vitest run` — all tests pass
4. `npm run build --workspace=packages/client` — builds
5. Deploy to PVE2: `ssh root@192.168.1.6 "pct exec 108 -- bash -c 'cd /opt/nova-imperia && git checkout -- package-lock.json && git pull && npm run build --workspace=packages/client 2>&1 | tail -3 && systemctl restart nova-imperia-client'"`
6. Manual playtest of the full game flow
