# Building Upgrades Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players (and AI) to upgrade existing buildings from level 1 up to their defined `maxLevel`, with upgrade levels gated by the empire's current technology age, scaling output/energy/waste/maintenance per level.

**Architecture:** Upgrades reuse the existing production queue by adding a `'building_upgrade'` value to `ProductionItem.type` with a `targetBuildingId` field. When the queue item completes, the building's `level` is incremented instead of creating a new building. The cost formula is `baseCost * currentLevel * 1.5` and build time scales similarly. Each building's maximum achievable level is capped by tech age (1–2 levels unlocked per age). Clicking an occupied building slot opens an upgrade popover showing cost, time, current cap, and an "Upgrade" button.

**Tech Stack:** TypeScript (shared engine + Vitest tests), React (client UI), Phaser event bus (client ↔ engine)

**Tech-age level cap design:**
- 5 ages: `nano_atomic` (index 0) → `fusion` (1) → `nano_fusion` (2) → `anti_matter` (3) → `singularity` (4)
- Each age unlocks 1 additional level: `maxLevelForAge = min(ageIndex + 1, building.maxLevel)`
- So: nano_atomic = Lv.1 only, fusion = up to Lv.2, nano_fusion = up to Lv.3, anti_matter = up to Lv.4, singularity = up to Lv.5
- This means all buildings start at Lv.1 and can't be upgraded until the empire reaches the Fusion age

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/shared/src/types/galaxy.ts` | Extend `ProductionItem` to support `'building_upgrade'` type + `targetBuildingId` |
| Modify | `packages/shared/src/types/events.ts` | Add `UpgradeBuildingAction` to `GameAction` union |
| Modify | `packages/shared/src/engine/colony.ts` | Add `getMaxLevelForAge()`, `getUpgradeCost()`, `getUpgradeBuildTime()`, `canUpgradeBuilding()`, `addUpgradeToQueue()`, upgrade completion in `processConstructionQueue()` |
| Modify | `packages/shared/src/engine/game-loop.ts` | Handle `UpgradeBuilding` action in `processPlayerActions()` |
| Modify | `packages/shared/src/__tests__/game-loop-actions.test.ts` | Tests for the `UpgradeBuilding` action |
| Create | `packages/shared/src/__tests__/building-upgrade.test.ts` | Unit tests for age cap, upgrade cost, validation, queue processing |
| Modify | `packages/client/src/engine/GameEngine.ts` | Add `upgradeBuildingOnPlanet()` method |
| Modify | `packages/client/src/ui/App.tsx` | Wire `handleUpgrade` callback, pass to `PlanetManagementScreen` |
| Modify | `packages/client/src/ui/screens/PlanetManagementScreen.tsx` | Building click opens upgrade popover |
| Modify | `packages/client/src/ui/components/ConstructionQueue.tsx` | Show "Upgrading X → Lv.Y" label + correct progress bar |
| Modify | `packages/client/src/ui/styles.css` | Styles for upgrade popover |
| Modify | `packages/shared/src/engine/ai.ts` | AI evaluates upgrading existing buildings |

---

### Task 1: Extend `ProductionItem` type to support upgrades

**Files:**
- Modify: `packages/shared/src/types/galaxy.ts:150-154`

- [ ] **Step 1: Update `ProductionItem` interface**

The current `ProductionItem` has `type: 'ship' | 'building' | 'defense'`. Add `'building_upgrade'` to the union, add an optional `targetBuildingId` field for upgrades, and add an optional `totalTurns` field so the construction queue UI can display correct progress for upgrades.

```typescript
export interface ProductionItem {
  type: 'ship' | 'building' | 'defense' | 'building_upgrade';
  templateId: string;
  turnsRemaining: number;
  /** For building_upgrade items: the ID of the building being upgraded. */
  targetBuildingId?: string;
  /** Total construction points when queued — used by the UI for progress display. */
  totalTurns?: number;
}
```

- [ ] **Step 2: Run typecheck to confirm no breakages**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: Clean (no errors). Existing code that checks `item.type === 'building'` will naturally exclude the new value.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/galaxy.ts
git commit -m "feat: extend ProductionItem type to support building upgrades"
```

---

### Task 2: Add `UpgradeBuildingAction` to the action system

**Files:**
- Modify: `packages/shared/src/types/events.ts`

- [ ] **Step 1: Add the `UpgradeBuildingAction` interface**

Add this after the `ConstructBuildingAction` interface (around line 40):

```typescript
export interface UpgradeBuildingAction {
  type: 'UpgradeBuilding';
  systemId: string;
  planetId: string;
  buildingId: string;
}
```

- [ ] **Step 2: Add to the `GameAction` union**

Add `| UpgradeBuildingAction` to the `GameAction` type union (around line 96).

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/events.ts
git commit -m "feat: add UpgradeBuildingAction to game action types"
```

---

### Task 3: Add upgrade cost, validation, and queue functions in `colony.ts`

**Files:**
- Modify: `packages/shared/src/engine/colony.ts` (after the existing `addBuildingToQueue` function, around line 1236)
- Create: `packages/shared/src/__tests__/building-upgrade.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/shared/src/__tests__/building-upgrade.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Planet, Building, BuildingType } from '../types/galaxy.js';
import type { TechAge } from '../types/species.js';
import {
  getMaxLevelForAge,
  getUpgradeCost,
  getUpgradeBuildTime,
  canUpgradeBuilding,
  addUpgradeToQueue,
  processConstructionQueue,
} from '../engine/colony.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'planet-1',
    name: 'Test Planet',
    orbitalIndex: 2,
    type: 'terran',
    atmosphere: 'oxygen_nitrogen',
    gravity: 1.0,
    temperature: 290,
    naturalResources: 50,
    maxPopulation: 500_000,
    currentPopulation: 100_000,
    buildings: [],
    productionQueue: [],
    ownerId: 'empire-1',
    ...overrides,
  };
}

function makeBuilding(type: BuildingType, level = 1, id?: string): Building {
  return { id: id ?? `bldg-${type}-${level}`, type, level };
}

// ---------------------------------------------------------------------------
// getMaxLevelForAge
// ---------------------------------------------------------------------------

describe('getMaxLevelForAge', () => {
  it('returns 1 for nano_atomic age (starting age — no upgrades)', () => {
    expect(getMaxLevelForAge('research_lab', 'nano_atomic')).toBe(1);
  });

  it('returns 2 for fusion age', () => {
    expect(getMaxLevelForAge('research_lab', 'fusion')).toBe(2);
  });

  it('returns 3 for nano_fusion age', () => {
    expect(getMaxLevelForAge('research_lab', 'nano_fusion')).toBe(3);
  });

  it('never exceeds the building maxLevel', () => {
    // shipyard has maxLevel 3 — even at singularity (index 4 → cap 5) it stays at 3
    expect(getMaxLevelForAge('shipyard', 'singularity')).toBe(3);
  });

  it('returns correct cap for anti_matter and singularity', () => {
    expect(getMaxLevelForAge('factory', 'anti_matter')).toBe(4);
    expect(getMaxLevelForAge('factory', 'singularity')).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getUpgradeCost
// ---------------------------------------------------------------------------

describe('getUpgradeCost', () => {
  it('returns baseCost * level * 1.5 for each resource', () => {
    const cost = getUpgradeCost('research_lab', 1);
    const baseCost = BUILDING_DEFINITIONS.research_lab.baseCost;
    // Upgrading from level 1 → 2: baseCost * 1 * 1.5
    for (const [key, base] of Object.entries(baseCost)) {
      expect(cost[key as keyof typeof cost]).toBe(Math.ceil((base ?? 0) * 1 * 1.5));
    }
  });

  it('scales with current level', () => {
    const cost2 = getUpgradeCost('factory', 2);
    const baseCost = BUILDING_DEFINITIONS.factory.baseCost;
    // Upgrading from level 2 → 3: baseCost * 2 * 1.5
    for (const [key, base] of Object.entries(baseCost)) {
      expect(cost2[key as keyof typeof cost2]).toBe(Math.ceil((base ?? 0) * 2 * 1.5));
    }
  });
});

// ---------------------------------------------------------------------------
// getUpgradeBuildTime
// ---------------------------------------------------------------------------

describe('getUpgradeBuildTime', () => {
  it('returns buildTime * level * 1.5', () => {
    const time = getUpgradeBuildTime('research_lab', 1);
    const base = BUILDING_DEFINITIONS.research_lab.buildTime;
    expect(time).toBe(Math.ceil(base * 1 * 1.5));
  });
});

// ---------------------------------------------------------------------------
// canUpgradeBuilding
// ---------------------------------------------------------------------------

describe('canUpgradeBuilding', () => {
  it('allows upgrade when below age-capped level', () => {
    const building = makeBuilding('research_lab', 1);
    const planet = makePlanet({ buildings: [building] });
    const result = canUpgradeBuilding(planet, building.id, 'fusion');
    expect(result.allowed).toBe(true);
  });

  it('rejects upgrade when at age-capped level even if below maxLevel', () => {
    const building = makeBuilding('research_lab', 1); // maxLevel=5 but nano_atomic caps at 1
    const planet = makePlanet({ buildings: [building] });
    const result = canUpgradeBuilding(planet, building.id, 'nano_atomic');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/age|technology/i);
  });

  it('rejects upgrade when already at maxLevel', () => {
    const maxLevel = BUILDING_DEFINITIONS.research_lab.maxLevel;
    const building = makeBuilding('research_lab', maxLevel);
    const planet = makePlanet({ buildings: [building] });
    const result = canUpgradeBuilding(planet, building.id, 'singularity');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/max/i);
  });

  it('rejects upgrade when building not found', () => {
    const planet = makePlanet({ buildings: [] });
    const result = canUpgradeBuilding(planet, 'nonexistent', 'fusion');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it('rejects upgrade when an upgrade for the same building is already queued', () => {
    const building = makeBuilding('research_lab', 1);
    const planet = makePlanet({
      buildings: [building],
      productionQueue: [{
        type: 'building_upgrade',
        templateId: 'research_lab',
        turnsRemaining: 50,
        targetBuildingId: building.id,
      }],
    });
    const result = canUpgradeBuilding(planet, building.id, 'fusion');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already.*queue/i);
  });
});

// ---------------------------------------------------------------------------
// addUpgradeToQueue
// ---------------------------------------------------------------------------

describe('addUpgradeToQueue', () => {
  it('adds a building_upgrade item to the production queue', () => {
    const building = makeBuilding('factory', 1);
    const planet = makePlanet({ buildings: [building] });
    const updated = addUpgradeToQueue(planet, building.id, 'fusion');
    const item = updated.productionQueue.find(
      q => q.type === 'building_upgrade' && q.targetBuildingId === building.id,
    );
    expect(item).toBeDefined();
    expect(item!.templateId).toBe('factory');
    expect(item!.turnsRemaining).toBe(getUpgradeBuildTime('factory', 1));
    expect(item!.totalTurns).toBe(getUpgradeBuildTime('factory', 1));
  });

  it('throws when the building cannot be upgraded', () => {
    const maxLevel = BUILDING_DEFINITIONS.factory.maxLevel;
    const building = makeBuilding('factory', maxLevel);
    const planet = makePlanet({ buildings: [building] });
    expect(() => addUpgradeToQueue(planet, building.id, 'singularity')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// processConstructionQueue — upgrade completion
// ---------------------------------------------------------------------------

describe('processConstructionQueue — building_upgrade', () => {
  it('increments building level when upgrade completes', () => {
    const building = makeBuilding('research_lab', 2);
    const planet = makePlanet({
      buildings: [building],
      productionQueue: [{
        type: 'building_upgrade',
        templateId: 'research_lab',
        turnsRemaining: 1,
        targetBuildingId: building.id,
      }],
    });
    const updated = processConstructionQueue(planet, 10);
    const upgraded = updated.buildings.find(b => b.id === building.id);
    expect(upgraded).toBeDefined();
    expect(upgraded!.level).toBe(3);
    expect(updated.productionQueue.length).toBe(0);
  });

  it('resets condition to 100 on upgrade completion', () => {
    const building: Building = { id: 'b1', type: 'factory', level: 1, condition: 50 };
    const planet = makePlanet({
      buildings: [building],
      productionQueue: [{
        type: 'building_upgrade',
        templateId: 'factory',
        turnsRemaining: 1,
        targetBuildingId: building.id,
      }],
    });
    const updated = processConstructionQueue(planet, 10);
    const upgraded = updated.buildings.find(b => b.id === building.id);
    expect(upgraded!.condition).toBe(100);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run packages/shared/src/__tests__/building-upgrade.test.ts`
Expected: FAIL — `getMaxLevelForAge`, `getUpgradeCost`, `canUpgradeBuilding`, etc. are not exported from `colony.ts` yet.

- [ ] **Step 3: Implement the upgrade functions in `colony.ts`**

First, add these imports at the top of `colony.ts` if not already present:

```typescript
import type { EmpireResources } from '../types/resources.js';
import type { TechAge } from '../types/species.js';
import { TECH_AGES } from '../constants/game.js';
```

Then add the following after the `addBuildingToQueue` function (around line 1236):

```typescript
// ── Building upgrades ─────────────────────────────────────────────────────

/** Cost multiplier per level for building upgrades. */
const UPGRADE_COST_MULTIPLIER = 1.5;

/**
 * Returns the technology age index (0-based) for the given age.
 * nano_atomic=0, fusion=1, nano_fusion=2, anti_matter=3, singularity=4.
 */
function techAgeIndex(age: TechAge | string): number {
  return TECH_AGES.findIndex(a => a.name === age);
}

/**
 * Returns the maximum building level achievable in the given tech age.
 * Each age unlocks one additional level: nano_atomic=1, fusion=2, ..., singularity=5.
 * Never exceeds the building's defined maxLevel.
 */
export function getMaxLevelForAge(
  buildingType: BuildingType,
  currentAge: TechAge,
): number {
  const def = BUILDING_DEFINITIONS[buildingType];
  const ageIdx = techAgeIndex(currentAge);
  const ageCap = ageIdx < 0 ? 1 : ageIdx + 1;
  return Math.min(ageCap, def.maxLevel);
}

/**
 * Calculate the resource cost to upgrade a building from `currentLevel` to
 * `currentLevel + 1`.
 *
 * Formula: `ceil(baseCost * currentLevel * UPGRADE_COST_MULTIPLIER)` per resource.
 */
export function getUpgradeCost(
  buildingType: BuildingType,
  currentLevel: number,
): Partial<EmpireResources> {
  const def = BUILDING_DEFINITIONS[buildingType];
  const result: Partial<EmpireResources> = {};
  for (const [key, base] of Object.entries(def.baseCost)) {
    if (base && base > 0) {
      result[key as keyof EmpireResources] = Math.ceil(base * currentLevel * UPGRADE_COST_MULTIPLIER);
    }
  }
  return result;
}

/**
 * Calculate the construction-point cost to upgrade a building from
 * `currentLevel` to `currentLevel + 1`.
 *
 * Formula: `ceil(baseBuildTime * currentLevel * UPGRADE_COST_MULTIPLIER)`.
 */
export function getUpgradeBuildTime(
  buildingType: BuildingType,
  currentLevel: number,
): number {
  const def = BUILDING_DEFINITIONS[buildingType];
  return Math.ceil(def.buildTime * currentLevel * UPGRADE_COST_MULTIPLIER);
}

/**
 * Check whether a building on a planet can be upgraded.
 *
 * @param currentAge — the empire's current technology age, used to cap the
 *   maximum achievable level. Each age unlocks one additional level.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, reason: string }`.
 */
export function canUpgradeBuilding(
  planet: Planet,
  buildingId: string,
  currentAge: TechAge,
): { allowed: boolean; reason?: string } {
  const building = planet.buildings.find(b => b.id === buildingId);
  if (!building) {
    return { allowed: false, reason: 'Building not found on this planet.' };
  }

  const def = BUILDING_DEFINITIONS[building.type];
  if (building.level >= def.maxLevel) {
    return { allowed: false, reason: `Already at maximum level (${def.maxLevel}).` };
  }

  const ageCap = getMaxLevelForAge(building.type, currentAge);
  if (building.level >= ageCap) {
    return {
      allowed: false,
      reason: `Current technology age limits this building to level ${ageCap}. Advance to the next age to unlock further upgrades.`,
    };
  }

  // Check if there is already an upgrade queued for this building
  const alreadyQueued = planet.productionQueue.some(
    item => item.type === 'building_upgrade' && item.targetBuildingId === buildingId,
  );
  if (alreadyQueued) {
    return { allowed: false, reason: 'An upgrade for this building is already in the queue.' };
  }

  return { allowed: true };
}

/**
 * Add a building upgrade to the planet's production queue.
 * Returns a new Planet — does not mutate the original.
 *
 * Throws if the building cannot be upgraded (use `canUpgradeBuilding` first).
 */
export function addUpgradeToQueue(planet: Planet, buildingId: string, currentAge: TechAge): Planet {
  const check = canUpgradeBuilding(planet, buildingId, currentAge);
  if (!check.allowed) {
    throw new Error(`Cannot queue upgrade: ${check.reason}`);
  }

  const building = planet.buildings.find(b => b.id === buildingId)!;
  const turnsRemaining = getUpgradeBuildTime(building.type, building.level);

  return {
    ...planet,
    productionQueue: [
      ...planet.productionQueue,
      {
        type: 'building_upgrade' as const,
        templateId: building.type,
        turnsRemaining,
        totalTurns: turnsRemaining,
        targetBuildingId: building.id,
      },
    ],
  };
}
```

- [ ] **Step 4: Update `processConstructionQueue` to handle upgrade completion**

Replace the `processConstructionQueue` function body (around line 1247) with:

```typescript
export function processConstructionQueue(planet: Planet, constructionRate: number): Planet {
  if (planet.productionQueue.length === 0) return planet;

  const [first, ...rest] = planet.productionQueue;
  const item = first!;

  // Non-building/non-upgrade items (ships, defenses)
  if (item.type !== 'building' && item.type !== 'building_upgrade') {
    const newTurns = Math.max(0, item.turnsRemaining - constructionRate);
    if (newTurns === 0) {
      return { ...planet, productionQueue: rest };
    }
    return { ...planet, productionQueue: [{ ...item, turnsRemaining: newTurns }, ...rest] };
  }

  const newTurns = item.turnsRemaining - constructionRate;

  if (newTurns <= 0) {
    if (item.type === 'building_upgrade' && item.targetBuildingId) {
      // Upgrade complete — increment the existing building's level and reset condition
      const upgradedBuildings = planet.buildings.map(b => {
        if (b.id === item.targetBuildingId) {
          return { ...b, level: b.level + 1, condition: 100 };
        }
        return b;
      });
      return { ...planet, buildings: upgradedBuildings, productionQueue: rest };
    }
    // New building construction complete
    const newBuilding: Building = {
      id: generateId(),
      type: item.templateId as BuildingType,
      level: 1,
    };
    return {
      ...planet,
      buildings: [...planet.buildings, newBuilding],
      productionQueue: rest,
    };
  }

  return { ...planet, productionQueue: [{ ...item, turnsRemaining: newTurns }, ...rest] };
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npx vitest run packages/shared/src/__tests__/building-upgrade.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Run the full shared test suite to check for regressions**

Run: `npx vitest run packages/shared/`
Expected: All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/engine/colony.ts packages/shared/src/__tests__/building-upgrade.test.ts
git commit -m "feat: add building upgrade cost, age-gated validation, and queue processing"
```

---

### Task 4: Handle `UpgradeBuilding` action in the game loop

**Files:**
- Modify: `packages/shared/src/engine/game-loop.ts` (in the `processPlayerActions` area, around line 555)
- Modify: `packages/shared/src/__tests__/game-loop-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the end of `packages/shared/src/__tests__/game-loop-actions.test.ts`. First add the imports at the top with the other imports:

```typescript
import type { UpgradeBuildingAction } from '../types/events.js';
import { getUpgradeCost } from '../engine/colony.js';
```

Then add the test block at the end:

```typescript
// ---------------------------------------------------------------------------
// UpgradeBuilding action
// ---------------------------------------------------------------------------

describe('processGameTick — UpgradeBuilding action', () => {
  it('adds an upgrade to the planet production queue', () => {
    const gs = makeGameState();
    const empire = gs.empires[0]!;
    const homeSystem = gs.galaxy.systems.find(s => s.ownerId === empire.id)!;
    const homePlanet = homeSystem.planets.find(p => p.ownerId === empire.id)!;

    // Ensure there is at least one building to upgrade
    const building = homePlanet.buildings[0];
    expect(building).toBeDefined();

    // Advance empire to fusion age so upgrades are allowed
    empire.currentAge = 'fusion';

    const ts = initializeTickState(gs);

    // Ensure empire has enough resources for the upgrade
    const upgradeCost = getUpgradeCost(building!.type, building!.level);
    const existingRes = ts.empireResourcesMap.get(empire.id)!;
    const boostedRes = { ...existingRes };
    for (const [key, amount] of Object.entries(upgradeCost)) {
      (boostedRes as Record<string, number>)[key] = ((boostedRes as Record<string, number>)[key] ?? 0) + (amount ?? 0) + 1000;
    }
    const boostedMap = new Map(ts.empireResourcesMap);
    boostedMap.set(empire.id, boostedRes);
    const tsWithResources = { ...ts, empireResourcesMap: boostedMap };

    const action: UpgradeBuildingAction = {
      type: 'UpgradeBuilding',
      systemId: homeSystem.id,
      planetId: homePlanet.id,
      buildingId: building!.id,
    };

    const tsWithAction = submitAction(tsWithResources, empire.id, action);
    const { newState } = processGameTick(tsWithAction);

    const updatedPlanet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === homePlanet.id)!;

    // Either the upgrade is in the queue or it already completed (short build time)
    const hasUpgradeInQueue = updatedPlanet.productionQueue.some(
      item => item.type === 'building_upgrade' && item.targetBuildingId === building!.id,
    );
    const buildingNow = updatedPlanet.buildings.find(b => b.id === building!.id);
    const levelIncreased = buildingNow && buildingNow.level > building!.level;

    expect(hasUpgradeInQueue || levelIncreased).toBe(true);
  });

  it('rejects upgrade when the empire does not own the planet', () => {
    const gs = makeGameState();
    const empireA = gs.empires[0]!;
    const empireB = gs.empires[1]!;

    empireA.currentAge = 'fusion';

    const systemB = gs.galaxy.systems.find(s => s.ownerId === empireB.id)!;
    const planetB = systemB.planets.find(p => p.ownerId === empireB.id)!;
    const building = planetB.buildings[0];
    expect(building).toBeDefined();

    const ts = initializeTickState(gs);
    const action: UpgradeBuildingAction = {
      type: 'UpgradeBuilding',
      systemId: systemB.id,
      planetId: planetB.id,
      buildingId: building!.id,
    };

    const tsWithAction = submitAction(ts, empireA.id, action);
    const { newState } = processGameTick(tsWithAction);

    const updatedPlanet = newState.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.id === planetB.id)!;

    const hasUpgradeInQueue = updatedPlanet.productionQueue.some(
      item => item.type === 'building_upgrade' && item.targetBuildingId === building!.id,
    );
    const buildingNow = updatedPlanet.buildings.find(b => b.id === building!.id);
    const levelIncreased = buildingNow && buildingNow.level > building!.level;

    expect(hasUpgradeInQueue || levelIncreased).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run packages/shared/src/__tests__/game-loop-actions.test.ts`
Expected: The new tests FAIL because `UpgradeBuilding` is not handled in the game loop.

- [ ] **Step 3: Add `UpgradeBuilding` handler in game-loop.ts**

In `packages/shared/src/engine/game-loop.ts`, add these imports alongside the existing colony.js imports:

```typescript
import { canUpgradeBuilding, addUpgradeToQueue, getUpgradeCost } from './colony.js';
```

Then find the `ConstructBuilding` handler block (around line 555-598). Add a new `else if` branch immediately after it:

```typescript
      // ── UpgradeBuilding ──────────────────────────────────────────────────
      } else if (action.type === 'UpgradeBuilding') {
        const { systemId, planetId, buildingId } = action;

        const systemData = systems.find(s => s.id === systemId);
        if (!systemData) {
          console.warn(`[game-loop] UpgradeBuilding references unknown system "${systemId}" — skipping`);
          continue;
        }

        const planet = systemData.planets.find(p => p.id === planetId);
        if (!planet) {
          console.warn(`[game-loop] UpgradeBuilding references unknown planet "${planetId}" — skipping`);
          continue;
        }

        if (planet.ownerId !== empireId) {
          console.warn(`[game-loop] UpgradeBuilding rejected — empire "${empireId}" does not own planet "${planetId}"`);
          continue;
        }

        // Look up the empire's current tech age for the upgrade level cap
        const empire = state.gameState.empires.find(e => e.id === empireId);
        const currentAge = empire?.currentAge ?? 'nano_atomic';

        const upgradeCheck = canUpgradeBuilding(planet, buildingId, currentAge);
        if (!upgradeCheck.allowed) {
          console.warn(`[game-loop] UpgradeBuilding rejected for building "${buildingId}": ${upgradeCheck.reason}`);
          continue;
        }

        const building = planet.buildings.find(b => b.id === buildingId)!;
        const upgradeCost = getUpgradeCost(building.type, building.level);

        // Check affordability first (all resources must be available)
        const res = getEmpireResources(state, empireId);
        let canAfford = true;
        for (const [key, amount] of Object.entries(upgradeCost)) {
          if (amount && amount > 0) {
            if ((res[key as keyof EmpireResources] ?? 0) < amount) {
              console.warn(`[game-loop] UpgradeBuilding rejected — cannot afford ${key}: need ${amount}, have ${res[key as keyof EmpireResources]}`);
              canAfford = false;
              break;
            }
          }
        }
        if (!canAfford) continue;

        // Deduct costs
        for (const [key, amount] of Object.entries(upgradeCost)) {
          if (amount && amount > 0) {
            res[key as keyof EmpireResources] -= amount;
          }
        }
        state = applyResources(state, empireId, res);
        systems = state.gameState.galaxy.systems;

        // Queue the upgrade
        const updatedSystem = systems.find(s => s.id === systemId)!;
        const updatedPlanet = updatedSystem.planets.find(p => p.id === planetId)!;
        const planetWithUpgrade = addUpgradeToQueue(updatedPlanet, buildingId, currentAge);

        systems = systems.map(s => {
          if (s.id !== systemId) return s;
          return { ...s, planets: s.planets.map(p => (p.id === planetId ? planetWithUpgrade : p)) };
        });

        state = {
          ...state,
          gameState: { ...state.gameState, galaxy: { ...state.gameState.galaxy, systems } },
        };
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run packages/shared/src/__tests__/game-loop-actions.test.ts`
Expected: All tests PASS including the two new ones.

- [ ] **Step 5: Run the full shared test suite**

Run: `npx vitest run packages/shared/`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine/game-loop.ts packages/shared/src/__tests__/game-loop-actions.test.ts
git commit -m "feat: handle UpgradeBuilding action in game loop with age-gated validation"
```

---

### Task 5: Add `upgradeBuildingOnPlanet` to the client `GameEngine`

**Files:**
- Modify: `packages/client/src/engine/GameEngine.ts` (after `buildOnPlanet`, around line 450)

- [ ] **Step 1: Add imports**

Add `canUpgradeBuilding`, `addUpgradeToQueue`, and `getUpgradeCost` to the existing `@nova-imperia/shared` import in `GameEngine.ts`.

- [ ] **Step 2: Add the `upgradeBuildingOnPlanet` method**

Add this method to the `GameEngine` class after `buildOnPlanet`:

```typescript
  /**
   * Queue an upgrade for an existing building on a planet.
   * Validates ownership, upgrade eligibility (including tech-age cap),
   * and affordability, then deducts resources and adds the upgrade to
   * the planet's production queue.
   *
   * Emits `engine:planet_updated` with the updated Planet on success.
   *
   * @returns true if the upgrade was queued, false otherwise.
   */
  upgradeBuildingOnPlanet(systemId: string, planetId: string, buildingId: string): boolean {
    const galaxy = this.tickState.gameState.galaxy;

    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] System "${systemId}" not found`);
      return false;
    }

    const planet = system.planets.find(p => p.id === planetId);
    if (!planet) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] Planet "${planetId}" not found`);
      return false;
    }

    const empire = this.tickState.gameState.empires.find(e => e.id === planet.ownerId);
    if (!empire) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] Planet "${planetId}" has no owning empire`);
      return false;
    }

    const currentAge = empire.currentAge ?? 'nano_atomic';
    const upgradeCheck = canUpgradeBuilding(planet, buildingId, currentAge);
    if (!upgradeCheck.allowed) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] Upgrade not allowed: ${upgradeCheck.reason}`);
      return false;
    }

    const building = planet.buildings.find(b => b.id === buildingId)!;
    const upgradeCost = getUpgradeCost(building.type, building.level);

    // Check affordability
    const currentResources = this.tickState.empireResourcesMap.get(empire.id);
    if (!currentResources) {
      console.warn(`[GameEngine.upgradeBuildingOnPlanet] No resource stockpile for empire "${empire.id}"`);
      return false;
    }
    for (const [resource, required] of Object.entries(upgradeCost)) {
      const available = currentResources[resource as keyof typeof currentResources] ?? 0;
      if (available < (required ?? 0)) {
        console.warn(`[GameEngine.upgradeBuildingOnPlanet] Cannot afford upgrade: need ${required} ${resource}, have ${available}`);
        return false;
      }
    }

    // Deduct costs
    const updatedResources = { ...currentResources };
    for (const [resource, required] of Object.entries(upgradeCost)) {
      const key = resource as keyof typeof updatedResources;
      updatedResources[key] = (updatedResources[key] ?? 0) - (required ?? 0);
    }
    const updatedResourcesMap = new Map(this.tickState.empireResourcesMap);
    updatedResourcesMap.set(empire.id, updatedResources);

    const updatedEmpire = {
      ...empire,
      credits: updatedResources.credits,
      researchPoints: updatedResources.researchPoints,
    };

    // Queue upgrade
    const updatedPlanet = addUpgradeToQueue(planet, buildingId, currentAge);

    // Splice back into galaxy
    const updatedSystems = galaxy.systems.map(s => {
      if (s.id !== systemId) return s;
      return { ...s, planets: s.planets.map(p => (p.id === planetId ? updatedPlanet : p)) };
    });

    this.tickState = {
      ...this.tickState,
      empireResourcesMap: updatedResourcesMap,
      gameState: {
        ...this.tickState.gameState,
        empires: this.tickState.gameState.empires.map(e => (e.id === empire.id ? updatedEmpire : e)),
        galaxy: { ...galaxy, systems: updatedSystems },
      },
    };

    this.events.emit('engine:planet_updated', updatedPlanet);
    return true;
  }
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | grep -v TS6305`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/engine/GameEngine.ts
git commit -m "feat: add upgradeBuildingOnPlanet to GameEngine"
```

---

### Task 6: Wire up the upgrade callback in `App.tsx`

**Files:**
- Modify: `packages/client/src/ui/App.tsx`

- [ ] **Step 1: Add `handleUpgrade` callback**

Add after `handleDemolish` (around line 1122):

```typescript
  const handleUpgrade = useCallback(
    (planetId: string, buildingId: string) => {
      if (!managedSystemId) {
        console.warn('[App.handleUpgrade] No system ID for managed planet');
        return;
      }
      const engine: GameEngine | undefined = getGameEngine();
      if (!engine) {
        console.warn('[App.handleUpgrade] GameEngine not available');
        return;
      }
      const success = engine.upgradeBuildingOnPlanet(managedSystemId, planetId, buildingId);
      if (!success) {
        console.warn(`[App.handleUpgrade] upgradeBuildingOnPlanet returned false for ${buildingId}`);
      }
    },
    [managedSystemId],
  );
```

- [ ] **Step 2: Pass `onUpgrade` and `currentAge` to `PlanetManagementScreen`**

Find the `<PlanetManagementScreen` JSX (around line 1654) and add the props:

```tsx
          onUpgrade={handleUpgrade}
          currentAge={playerEmpire.currentAge}
```

- [ ] **Step 3: Commit (will typecheck after Task 7)**

```bash
git add packages/client/src/ui/App.tsx
git commit -m "feat: wire handleUpgrade callback in App.tsx"
```

---

### Task 7: Add upgrade popover UI in `PlanetManagementScreen`

**Files:**
- Modify: `packages/client/src/ui/screens/PlanetManagementScreen.tsx`
- Modify: `packages/client/src/ui/styles.css`

- [ ] **Step 1: Add `onUpgrade` and `currentAge` props to `PlanetManagementScreenProps`**

In `packages/client/src/ui/screens/PlanetManagementScreen.tsx`, find the interface (around line 571) and add:

```typescript
  /** Called when the player upgrades a building. */
  onUpgrade?: (planetId: string, buildingId: string) => void;
  /** The player empire's current technology age — gates upgrade levels. */
  currentAge?: TechAge;
```

Add to the destructured props in the function signature as well (default `currentAge = 'nano_atomic'`).

- [ ] **Step 2: Add imports**

Add `canUpgradeBuilding`, `getUpgradeCost`, `getUpgradeBuildTime`, `getMaxLevelForAge` to the existing `@nova-imperia/shared` import (the non-type one on line 3). Also add `TechAge` to the type import on line 2.

- [ ] **Step 3: Add upgrade popover state and handlers**

Replace the existing `handleBuildingClick` no-op with:

```typescript
  const [upgradeTarget, setUpgradeTarget] = useState<Building | null>(null);

  const handleBuildingClick = useCallback((building: Building, _index: number) => {
    setUpgradeTarget(prev => (prev?.id === building.id ? null : building));
  }, []);

  const handleConfirmUpgrade = useCallback(() => {
    if (!upgradeTarget || !onUpgrade) return;
    onUpgrade(planet.id, upgradeTarget.id);
    setUpgradeTarget(null);
  }, [upgradeTarget, onUpgrade, planet.id]);
```

- [ ] **Step 4: Add the upgrade popover JSX**

Find the `<BuildingSlotGrid` component JSX. After its closing `/>`, add:

```tsx
        {upgradeTarget && (() => {
          const def = BUILDING_DEFINITIONS[upgradeTarget.type];
          const check = canUpgradeBuilding(planet, upgradeTarget.id, currentAge);
          const cost = getUpgradeCost(upgradeTarget.type, upgradeTarget.level);
          const buildTime = getUpgradeBuildTime(upgradeTarget.type, upgradeTarget.level);
          const isMaxLevel = upgradeTarget.level >= def.maxLevel;
          const ageCap = getMaxLevelForAge(upgradeTarget.type, currentAge);
          const isAgeCapped = upgradeTarget.level >= ageCap && !isMaxLevel;
          const canAfford = Object.entries(cost).every(([key, amount]) =>
            (empireResources[key as keyof EmpireResources] ?? 0) >= (amount ?? 0),
          );

          return (
            <div className="upgrade-popover">
              <div className="upgrade-popover__header">
                <span className="upgrade-popover__name">{def.name}</span>
                <span className="upgrade-popover__level">
                  Lv.{upgradeTarget.level}
                  {isMaxLevel ? ' (MAX)' : isAgeCapped ? ` / ${ageCap} (age limit)` : ` → ${upgradeTarget.level + 1}`}
                </span>
                <button
                  type="button"
                  className="upgrade-popover__close panel-close-btn"
                  onClick={() => setUpgradeTarget(null)}
                >
                  ✕
                </button>
              </div>

              <p className="upgrade-popover__desc">{def.description}</p>

              {!isMaxLevel && !isAgeCapped && (
                <>
                  <div className="upgrade-popover__costs">
                    <span className="upgrade-popover__label">Upgrade cost:</span>
                    {Object.entries(cost).map(([key, amount]) => (
                      <span
                        key={key}
                        className={`upgrade-popover__cost ${
                          (empireResources[key as keyof EmpireResources] ?? 0) < (amount ?? 0)
                            ? 'upgrade-popover__cost--unaffordable'
                            : ''
                        }`}
                      >
                        {RESOURCE_ICONS[key] ?? key}: {amount}
                      </span>
                    ))}
                  </div>
                  <div className="upgrade-popover__time">
                    Build time: {buildTime} construction points
                  </div>
                </>
              )}

              {isAgeCapped && (
                <div className="upgrade-popover__reason">
                  Advance to the next technology age to unlock further upgrades.
                </div>
              )}

              {!isMaxLevel && !isAgeCapped && (
                <button
                  type="button"
                  className="sc-btn sc-btn--primary upgrade-popover__btn"
                  disabled={!check.allowed || !canAfford}
                  onClick={handleConfirmUpgrade}
                  title={!check.allowed ? check.reason : !canAfford ? 'Insufficient resources' : `Upgrade to Lv.${upgradeTarget.level + 1}`}
                >
                  Upgrade to Lv.{upgradeTarget.level + 1}
                </button>
              )}
            </div>
          );
        })()}
```

- [ ] **Step 5: Add CSS for the upgrade popover**

Add to `packages/client/src/ui/styles.css`:

```css
/* ── Building upgrade popover ───────────────────────────────────────────── */

.upgrade-popover {
  background: rgba(15, 20, 30, 0.95);
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
}

.upgrade-popover__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.upgrade-popover__name {
  font-weight: 600;
  font-size: 13px;
  color: #e0e8f0;
  flex: 1;
}

.upgrade-popover__level {
  font-size: 11px;
  color: #88aacc;
}

.upgrade-popover__close {
  margin-left: auto;
}

.upgrade-popover__desc {
  font-size: 11px;
  color: #8899aa;
  margin: 0 0 8px;
  line-height: 1.4;
}

.upgrade-popover__costs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  margin-bottom: 4px;
}

.upgrade-popover__label {
  color: #8899aa;
}

.upgrade-popover__cost {
  color: #c0d0e0;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.upgrade-popover__cost--unaffordable {
  color: #ff6666;
}

.upgrade-popover__time {
  font-size: 11px;
  color: #8899aa;
  margin-bottom: 8px;
}

.upgrade-popover__btn {
  width: 100%;
  margin-top: 4px;
}

.upgrade-popover__reason {
  font-size: 10px;
  color: #cc8844;
  margin-top: 4px;
}
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | grep -v TS6305`
Expected: Clean — the `onUpgrade` and `currentAge` props are now accepted.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/ui/screens/PlanetManagementScreen.tsx packages/client/src/ui/styles.css
git commit -m "feat: add building upgrade popover UI with age-cap display"
```

---

### Task 8: Show upgrade progress in the construction queue

**Files:**
- Modify: `packages/client/src/ui/components/ConstructionQueue.tsx`

- [ ] **Step 1: Read the current `ConstructionQueue` component**

Read the file to understand how it renders queue items and calculates progress.

- [ ] **Step 2: Update the queue item label for upgrades**

For `building_upgrade` items, display "Upgrading {name} → Lv.X" instead of the building name. To determine the target level, look up the building by `targetBuildingId` in the planet's buildings array.

If the component doesn't already receive `buildings`, add an optional `buildings` prop:

```typescript
/** Planet's current buildings — used to resolve upgrade target levels. */
buildings?: Building[];
```

Then in the label rendering:

```typescript
let itemLabel: string;
if (item.type === 'building_upgrade' && item.targetBuildingId && buildings) {
  const targetBuilding = buildings.find(b => b.id === item.targetBuildingId);
  const targetLevel = (targetBuilding?.level ?? 0) + 1;
  itemLabel = `Upgrading ${def?.name ?? item.templateId} → Lv.${targetLevel}`;
} else {
  itemLabel = def?.name ?? item.templateId;
}
```

- [ ] **Step 3: Fix progress bar calculation for upgrades**

Use `item.totalTurns` (from `ProductionItem`) when available, falling back to the existing `getMaxTurns` lookup:

```typescript
const maxTurns = item.totalTurns ?? getMaxTurns(item.templateId);
```

This ensures upgrade items (which have `totalTurns` set) display the correct progress percentage.

- [ ] **Step 4: Pass `buildings` prop from PlanetManagementScreen**

In `PlanetManagementScreen.tsx`, find where `<ConstructionQueue` is rendered and add:

```tsx
buildings={planet.buildings}
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | grep -v TS6305`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/ui/components/ConstructionQueue.tsx packages/client/src/ui/screens/PlanetManagementScreen.tsx
git commit -m "feat: show upgrade progress label and correct progress bar in construction queue"
```

---

### Task 9: Add AI building upgrade evaluation

**Files:**
- Modify: `packages/shared/src/engine/ai.ts`

- [ ] **Step 1: Add the `getUpgradeCost` import**

Add to the existing imports from `./colony.js`:

```typescript
import { calculateHabitability, canColonize, getUpgradeCost, getMaxLevelForAge } from './colony.js';
```

Also add `TechAge` to the species type import:

```typescript
import type { Empire, Species, AIPersonality, DiplomaticStatus, TechAge } from '../types/species.js';
```

- [ ] **Step 2: Add upgrade evaluation in `evaluateBuildingPriority`**

The function signature needs the empire's `currentAge`. Update it:

```typescript
export function evaluateBuildingPriority(
  empire: Empire,
  planets: Planet[],
  personality: AIPersonality,
): AIDecision[] {
```

The empire's `currentAge` is already available via `empire.currentAge`.

After the existing loop that evaluates building new buildings (around line 681, after the research_lab suggestion), add:

```typescript
    // Evaluate upgrading existing buildings
    for (const building of planet.buildings) {
      const bDef = BUILDING_DEFINITIONS[building.type];
      if (!bDef) continue;

      const ageCap = getMaxLevelForAge(building.type, empire.currentAge);
      if (building.level >= ageCap) continue;
      if (building.level >= bDef.maxLevel) continue;

      // Don't queue if already upgrading this building
      const alreadyUpgrading = planet.productionQueue.some(
        q => q.type === 'building_upgrade' && q.targetBuildingId === building.id,
      );
      if (alreadyUpgrading) continue;

      // Check affordability (credits only — a rough gate)
      const upgradeCost = getUpgradeCost(building.type, building.level);
      const creditCost = upgradeCost.credits ?? 0;
      if (empire.credits < creditCost) continue;

      // Priority: preferred types get a bonus, higher levels get lower priority
      const isPreferred = preferred.includes(building.type);
      const levelPenalty = building.level * 5;
      const basePriority = 30 + (isPreferred ? 15 : 0) - levelPenalty;

      if (basePriority > 0) {
        decisions.push({
          type: 'build',
          priority: applyWeight(basePriority, 'build', personality),
          params: { planetId: planet.id, buildingId: building.id, buildingType: building.type },
          reasoning: `Upgrade ${building.type} on ${planet.name} from Lv.${building.level} to Lv.${building.level + 1}`,
        });
      }
    }
```

Note: We use `type: 'build'` (not a new `'upgrade'` type) to reuse the existing `PERSONALITY_WEIGHTS` entries. This avoids needing to add a new type to the `AIDecision` union and weight tables.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/engine/ai.ts
git commit -m "feat: AI evaluates building upgrade opportunities with age-cap awareness"
```

---

### Task 10: Final integration check

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 2: Run full typecheck**

Run: `npm run typecheck`
Expected: Clean (only pre-existing TS6305 stale dist warnings).

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit any fixes**

If any adjustments were needed, commit them.
