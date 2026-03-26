# Orbital & Underground Building Slots Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Orbital Platform grants extra orbital building slots (3 + 1/level). New Underground Complex building grants extra underground slots (same formula). Buildings in orbital slots cost 2x with 3x maintenance. Underground slots cost 3x with normal maintenance. Both slot types are visually distinct in the building grid.

**Architecture:** Add a `slotZone` field to `Building` ('surface' | 'orbital' | 'underground'). Extend `getBuildingSlots` to compute per-zone totals based on existing buildings. `canBuildOnPlanet` gains a `targetZone` parameter. The `BuildingSlotGrid` renders three sections with visual framing. Cost/maintenance multipliers are applied at build time and in the economy engine.

**Tech Stack:** TypeScript (shared engine + Vitest tests), React (client UI), CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/shared/src/types/galaxy.ts` | Add `slotZone` to Building interface |
| Modify | `packages/shared/src/engine/colony.ts` | Extend `getBuildingSlots`, `canBuildOnPlanet`, `addBuildingToQueue` with zone awareness |
| Modify | `packages/shared/src/constants/buildings.ts` | Add `underground_complex` building definition |
| Modify | `packages/shared/data/tech/universal-tree.json` | Add "Planet Core Engineering" tech |
| Create | `packages/shared/src/__tests__/building-slots.test.ts` | Tests for zone-aware slot calculations |
| Modify | `packages/client/src/ui/components/BuildingSlotGrid.tsx` | Render surface/orbital/underground sections with visual framing |
| Modify | `packages/client/src/ui/screens/PlanetManagementScreen.tsx` | Pass zone info, handle zone selection for building |
| Modify | `packages/client/src/ui/styles.css` | Orbital/underground slot styling |
| Modify | `packages/shared/src/engine/economy.ts` | Apply cost/maintenance multipliers for orbital/underground buildings |
| Modify | `packages/client/src/engine/GameEngine.ts` | Pass zone when building |

---

### Task 1: Add `slotZone` to Building type and extend slot calculation

**Files:**
- Modify: `packages/shared/src/types/galaxy.ts`
- Modify: `packages/shared/src/engine/colony.ts`
- Create: `packages/shared/src/__tests__/building-slots.test.ts`

- [ ] **Step 1: Add slotZone to Building interface**

In `packages/shared/src/types/galaxy.ts`, add to the `Building` interface:

```typescript
export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  condition?: number;
  /** Where this building is located: surface (default), orbital, or underground. */
  slotZone?: 'surface' | 'orbital' | 'underground';
}
```

- [ ] **Step 2: Write failing tests for zone-aware slot calculation**

Create `packages/shared/src/__tests__/building-slots.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Planet, Building } from '../types/galaxy.js';
import { getBuildingSlots } from '../engine/colony.js';

function makePlanet(overrides: Partial<Planet> = {}): Planet {
  return {
    id: 'p1', name: 'Test', orbitalIndex: 2, type: 'terran',
    atmosphere: 'oxygen_nitrogen', gravity: 1.0, temperature: 290,
    naturalResources: 50, maxPopulation: 500000, currentPopulation: 100000,
    buildings: [], productionQueue: [], ownerId: 'e1',
    ...overrides,
  };
}

function makeBuilding(type: string, level = 1, zone?: string): Building {
  return { id: `b-${type}-${level}`, type: type as any, level, slotZone: zone as any };
}

describe('getBuildingSlots — zone-aware', () => {
  it('returns base surface slots for a planet with no special buildings', () => {
    const planet = makePlanet();
    const slots = getBuildingSlots(planet);
    expect(slots.surface.total).toBe(20); // terran
    expect(slots.orbital.total).toBe(0);
    expect(slots.underground.total).toBe(0);
  });

  it('orbital_platform grants 3 + 1 per level orbital slots', () => {
    const planet = makePlanet({
      buildings: [makeBuilding('orbital_platform', 2)],
    });
    const slots = getBuildingSlots(planet);
    expect(slots.orbital.total).toBe(4); // 3 + 1*2... wait, 3 base + 1 per level = 3 + 2 = 5
    // Actually: 3 + 1 * level = 3 + 2 = 5
    expect(slots.orbital.total).toBe(5);
  });

  it('underground_complex grants 3 + 1 per level underground slots', () => {
    const planet = makePlanet({
      buildings: [makeBuilding('underground_complex', 3)],
    });
    const slots = getBuildingSlots(planet);
    expect(slots.underground.total).toBe(6); // 3 + 3
  });

  it('counts used slots per zone', () => {
    const planet = makePlanet({
      buildings: [
        makeBuilding('orbital_platform', 1),
        makeBuilding('factory', 1, 'surface'),
        makeBuilding('research_lab', 1, 'orbital'),
        makeBuilding('mining_facility', 1, 'underground'),
      ],
    });
    const slots = getBuildingSlots(planet);
    // orbital_platform itself is surface (it occupies a surface slot)
    expect(slots.surface.used).toBe(2); // orbital_platform + factory
    expect(slots.orbital.used).toBe(1); // research_lab
    expect(slots.underground.used).toBe(1); // mining_facility
  });
});
```

- [ ] **Step 3: Implement zone-aware `getBuildingSlots`**

Replace the existing `getBuildingSlots` in `colony.ts`:

```typescript
export interface SlotInfo {
  used: number;
  total: number;
}

export interface ZonedSlots {
  surface: SlotInfo;
  orbital: SlotInfo;
  underground: SlotInfo;
}

/** Base orbital slots granted by an orbital_platform: 3 + 1 per level. */
const ORBITAL_BASE_SLOTS = 3;
/** Base underground slots granted by an underground_complex: 3 + 1 per level. */
const UNDERGROUND_BASE_SLOTS = 3;

export function getBuildingSlots(planet: Planet): ZonedSlots {
  const surfaceTotal = PLANET_BUILDING_SLOTS[planet.type];

  // Orbital slots from orbital_platform buildings
  let orbitalTotal = 0;
  for (const b of planet.buildings) {
    if (b.type === 'orbital_platform') {
      orbitalTotal += ORBITAL_BASE_SLOTS + b.level;
    }
  }

  // Underground slots from underground_complex buildings
  let undergroundTotal = 0;
  for (const b of planet.buildings) {
    if (b.type === 'underground_complex') {
      undergroundTotal += UNDERGROUND_BASE_SLOTS + b.level;
    }
  }

  // Count used slots per zone
  let surfaceUsed = 0;
  let orbitalUsed = 0;
  let undergroundUsed = 0;
  for (const b of planet.buildings) {
    const zone = b.slotZone ?? 'surface';
    if (zone === 'orbital') orbitalUsed++;
    else if (zone === 'underground') undergroundUsed++;
    else surfaceUsed++;
  }

  return {
    surface: { used: surfaceUsed, total: surfaceTotal },
    orbital: { used: orbitalUsed, total: orbitalTotal },
    underground: { used: undergroundUsed, total: undergroundTotal },
  };
}
```

NOTE: This changes the return type from `{ used: number; total: number }` to `ZonedSlots`. All callers of `getBuildingSlots` need updating. Search for all usages and update them to use `slots.surface` where they previously used `slots` directly. Key callers:
- `canBuildOnPlanet` in colony.ts
- `PlanetManagementScreen.tsx` (inline slot calculation)
- `ai.ts` (building priority evaluation)

For backward compatibility during this task, also add a convenience getter:

```typescript
/** Total used and total slots across all zones (backward-compatible). */
export function getTotalSlots(planet: Planet): { used: number; total: number } {
  const z = getBuildingSlots(planet);
  return {
    used: z.surface.used + z.orbital.used + z.underground.used,
    total: z.surface.total + z.orbital.total + z.underground.total,
  };
}
```

- [ ] **Step 4: Update `canBuildOnPlanet` for zone awareness**

Add an optional `targetZone` parameter to `canBuildOnPlanet`. Default to `'surface'`. Check the appropriate zone's slot availability:

```typescript
export function canBuildOnPlanet(
  planet: Planet,
  buildingType: BuildingType,
  species?: Species,
  empireTechs?: string[],
  targetZone: 'surface' | 'orbital' | 'underground' = 'surface',
): { allowed: boolean; reason?: string } {
  // ... existing gas giant check ...

  // Slot check — zone-aware
  const slots = getBuildingSlots(planet);
  const zoneSlots = slots[targetZone];
  if (zoneSlots.used >= zoneSlots.total) {
    return {
      allowed: false,
      reason: targetZone === 'surface'
        ? `No surface slots available (${zoneSlots.used}/${zoneSlots.total})`
        : `No ${targetZone} slots available (${zoneSlots.used}/${zoneSlots.total}). Build ${targetZone === 'orbital' ? 'an Orbital Platform' : 'an Underground Complex'} first.`,
    };
  }

  // ... rest of existing checks ...
}
```

- [ ] **Step 5: Update `addBuildingToQueue` to include zone**

When a building completes in `processConstructionQueue`, set `slotZone` on the new building. This requires passing the zone through the `ProductionItem`. Add an optional `targetZone` to `ProductionItem`:

In `galaxy.ts`, add to `ProductionItem`:
```typescript
  /** The zone this building will be placed in when complete. */
  targetZone?: 'surface' | 'orbital' | 'underground';
```

In `addBuildingToQueue`, accept and pass through the zone:

```typescript
export function addBuildingToQueue(
  planet: Planet,
  buildingType: BuildingType,
  species?: Species,
  empireTechs?: string[],
  targetZone: 'surface' | 'orbital' | 'underground' = 'surface',
): Planet {
  const check = canBuildOnPlanet(planet, buildingType, species, empireTechs, targetZone);
  // ...
  return {
    ...planet,
    productionQueue: [
      ...planet.productionQueue,
      { type: 'building', templateId: buildingType, turnsRemaining, targetZone },
    ],
  };
}
```

In `processConstructionQueue`, when creating the new building:

```typescript
const newBuilding: Building = {
  id: generateId(),
  type: item.templateId as BuildingType,
  level: 1,
  slotZone: item.targetZone ?? 'surface',
};
```

- [ ] **Step 6: Run tests, fix callers, commit**

Run: `npx vitest run packages/shared/src/__tests__/building-slots.test.ts`
Then: `npx tsc --noEmit -p packages/shared/tsconfig.json` — fix any type errors from changed return types.
Then: `npx vitest run packages/shared/` — all tests pass.

```bash
git commit -m "feat: zone-aware building slots — orbital and underground slot types"
```

---

### Task 2: Add Underground Complex building and Planet Core Engineering tech

**Files:**
- Modify: `packages/shared/src/constants/buildings.ts`
- Modify: `packages/shared/src/types/galaxy.ts` (add to BuildingType union)
- Modify: `packages/shared/data/tech/universal-tree.json`

- [ ] **Step 1: Add `underground_complex` to BuildingType**

In `galaxy.ts`, add `'underground_complex'` to the `BuildingType` union.

- [ ] **Step 2: Add building definition**

In `buildings.ts`, add:

```typescript
underground_complex: {
  name: 'Underground Complex',
  baseCost: { credits: 250, minerals: 150 },
  baseProduction: {},
  buildTime: 300,
  maintenanceCost: { credits: 3 },
  energyConsumption: 4,
  wasteOutput: 0.5,
  happinessImpact: 0,
  maxLevel: 3,
  description: 'A vast excavation into the planet\'s crust, reinforced with composite bulkheads and pressurised against the surrounding rock. Provides underground building slots where structures cost triple to construct but are shielded from orbital bombardment. When the surface is full, the only way to grow is down.',
  requiredTech: 'planet_core_engineering',
},
```

- [ ] **Step 3: Add Planet Core Engineering tech**

In `universal-tree.json`, add a new nano_atomic age tech with no prerequisites that would gate age advancement. Place it in the construction category:

```json
{
  "id": "planet_core_engineering",
  "name": "Planet Core Engineering",
  "description": "Advanced geological survey techniques and tunnelling technology that allow construction deep beneath a planet's surface. The resulting underground complexes are expensive to build but immune to orbital bombardment and provide valuable expansion space on small worlds.",
  "category": "construction",
  "age": "nano_atomic",
  "cost": 2000,
  "prerequisites": ["nanotechnology_basics"],
  "effects": [
    {
      "type": "enable_ability",
      "ability": "build_underground_complex"
    }
  ],
  "icon": "tech_planet_core_engineering"
}
```

- [ ] **Step 4: Add abbreviation for BuildingSlotGrid**

In `BuildingSlotGrid.tsx`, add `underground_complex: 'UC'` to the `BUILDING_ABBREV` record.

- [ ] **Step 5: Run tests and commit**

```bash
git commit -m "feat: add Underground Complex building and Planet Core Engineering tech"
```

---

### Task 3: Cost/maintenance multipliers for orbital and underground buildings

**Files:**
- Modify: `packages/shared/src/engine/economy.ts`
- Modify: `packages/client/src/engine/GameEngine.ts`
- Modify: `packages/shared/src/engine/game-loop.ts`

- [ ] **Step 1: Define zone cost multipliers**

In `colony.ts` or a new constants section:

```typescript
export const ZONE_COST_MULTIPLIER: Record<string, number> = {
  surface: 1,
  orbital: 2,
  underground: 3,
};

export const ZONE_MAINTENANCE_MULTIPLIER: Record<string, number> = {
  surface: 1,
  orbital: 3,
  underground: 1,
};
```

- [ ] **Step 2: Apply cost multiplier at build time**

In `GameEngine.buildOnPlanet`, when deducting costs, multiply by the zone multiplier. The `targetZone` needs to be passed through from the UI.

In `game-loop.ts` `ConstructBuilding` handler, apply the same multiplier.

- [ ] **Step 3: Apply maintenance multiplier in economy**

In `economy.ts` `calculatePlanetProduction` or the upkeep calculation, multiply maintenance costs by the building's zone multiplier.

- [ ] **Step 4: Test and commit**

```bash
git commit -m "feat: orbital buildings cost 2x/3x maint, underground cost 3x/1x maint"
```

---

### Task 4: Update BuildingSlotGrid to show three zones

**Files:**
- Modify: `packages/client/src/ui/components/BuildingSlotGrid.tsx`
- Modify: `packages/client/src/ui/screens/PlanetManagementScreen.tsx`
- Modify: `packages/client/src/ui/styles.css`

- [ ] **Step 1: Update BuildingSlotGrid props**

```typescript
interface BuildingSlotGridProps {
  surfaceSlots: SlotInfo;
  orbitalSlots: SlotInfo;
  undergroundSlots: SlotInfo;
  buildings: Building[];
  onEmptySlotClick: (slotIndex: number, zone: 'surface' | 'orbital' | 'underground') => void;
  onBuildingClick: (building: Building, slotIndex: number) => void;
  onDemolish?: (building: Building) => void;
}
```

- [ ] **Step 2: Render three sections**

Render surface slots first, then orbital (if any) with a label and distinct border, then underground (if any) with a label and distinct border:

```tsx
{/* Surface slots */}
<div className="bsg-section">
  <div className="bsg" style={...}>
    {surfaceBuildings map + empty slots}
  </div>
</div>

{/* Orbital slots (if orbital platform exists) */}
{orbitalSlots.total > 0 && (
  <div className="bsg-section bsg-section--orbital">
    <div className="bsg-section__label">ORBITAL ({orbitalSlots.used}/{orbitalSlots.total})</div>
    <div className="bsg" style={...}>
      {orbitalBuildings map + empty slots}
    </div>
  </div>
)}

{/* Underground slots (if underground complex exists) */}
{undergroundSlots.total > 0 && (
  <div className="bsg-section bsg-section--underground">
    <div className="bsg-section__label">UNDERGROUND ({undergroundSlots.used}/{undergroundSlots.total})</div>
    <div className="bsg" style={...}>
      {undergroundBuildings map + empty slots}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add CSS for zone sections**

```css
.bsg-section--orbital {
  border: 1px solid rgba(100, 200, 255, 0.3);
  border-radius: 4px;
  padding: 4px;
  margin-top: 8px;
  background: rgba(100, 200, 255, 0.03);
}

.bsg-section--underground {
  border: 1px solid rgba(200, 150, 80, 0.3);
  border-radius: 4px;
  padding: 4px;
  margin-top: 8px;
  background: rgba(200, 150, 80, 0.03);
}

.bsg-section__label {
  font-family: monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6688aa;
  margin-bottom: 4px;
  padding-left: 4px;
}
```

- [ ] **Step 4: Update PlanetManagementScreen to pass zone info**

Replace the inline slot calculation with `getBuildingSlots(planet)` and pass the zoned slots to BuildingSlotGrid. When the player clicks an empty orbital/underground slot, open the building picker with the zone context so the built building gets the correct `slotZone`.

- [ ] **Step 5: Test and commit**

```bash
git commit -m "feat: building grid shows orbital and underground sections with distinct styling"
```

---

### Task 5: Final integration check

- [ ] **Step 1: Run full test suite**
- [ ] **Step 2: Run typecheck**
- [ ] **Step 3: Run build**
- [ ] **Step 4: Deploy to DEV**
- [ ] **Step 5: Merge to main**
