# Building Stats Popover + Planet Tabs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the upgrade-only building popover with a full stats panel showing level-scaled output, and add a tab system to PlanetManagementScreen with Build Queue, Population, Economy, and Orbitals tabs.

**Architecture:** The existing upgrade popover is extended to show actual building stats (production, energy, waste, maintenance) scaled by `BUILDING_LEVEL_MULTIPLIER^(level-1)`. The right column of PlanetManagementScreen is replaced with a tab strip + tab content area. The Orbitals tab shows orbital buildings (shipyard, spaceport, orbital_platform, orbital_waste_ejector, defense_grid) and ships in the system.

**Tech Stack:** TypeScript, React, CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/client/src/ui/screens/PlanetManagementScreen.tsx` | Extend building popover with stats; add tab system replacing right column |
| Modify | `packages/client/src/ui/styles.css` | Tab strip + tab content styles; building stats styles |
| Modify | `packages/client/src/ui/App.tsx` | Pass fleet/ship data to PlanetManagementScreen for Orbitals tab |

---

### Task 1: Extend building popover with full stats

**Files:**
- Modify: `packages/client/src/ui/screens/PlanetManagementScreen.tsx`
- Modify: `packages/client/src/ui/styles.css`

Currently clicking a building shows only upgrade info (cost, build time, button). Add a stats section showing the building's actual output at its current level.

- [ ] **Step 1: Add stats section to the upgrade popover**

In `PlanetManagementScreen.tsx`, find the upgrade popover JSX (the `{upgradeTarget && (() => { ... })()}` block after `<BuildingSlotGrid />`). After the `<p className="upgrade-popover__desc">` description paragraph, add a stats section:

```tsx
              {/* Current building stats at this level */}
              <div className="upgrade-popover__stats">
                <span className="upgrade-popover__stats-label">Output at Lv.{upgradeTarget.level}:</span>
                {(() => {
                  const lvlMult = Math.pow(BUILDING_LEVEL_MULTIPLIER, upgradeTarget.level - 1);
                  const entries: Array<{ label: string; value: string; positive: boolean }> = [];

                  // Production
                  for (const [key, base] of Object.entries(def.baseProduction)) {
                    if (base && base > 0) {
                      const scaled = Math.round(base * lvlMult * 10) / 10;
                      entries.push({ label: RESOURCE_LABELS[key] ?? key, value: `+${scaled}`, positive: true });
                    }
                  }

                  // Energy production (special case — power plants etc.)
                  if (def.baseProduction.energy && def.baseProduction.energy > 0) {
                    // Already included above
                  }

                  // Energy consumption
                  if (def.energyConsumption > 0) {
                    const scaled = Math.round(def.energyConsumption * lvlMult * 10) / 10;
                    entries.push({ label: 'Energy', value: `-${scaled}`, positive: false });
                  }

                  // Waste output
                  if (def.wasteOutput > 0) {
                    const scaled = Math.round(def.wasteOutput * lvlMult * 10) / 10;
                    entries.push({ label: 'Waste', value: `+${scaled}`, positive: false });
                  }

                  // Maintenance
                  for (const [key, base] of Object.entries(def.maintenanceCost)) {
                    if (base && base > 0) {
                      entries.push({ label: `${RESOURCE_LABELS[key] ?? key} maint.`, value: `-${base}`, positive: false });
                    }
                  }

                  // Happiness
                  if (def.happinessImpact !== 0) {
                    entries.push({
                      label: 'Happiness',
                      value: `${def.happinessImpact > 0 ? '+' : ''}${def.happinessImpact}`,
                      positive: def.happinessImpact > 0,
                    });
                  }

                  return entries.map((e, i) => (
                    <span key={i} className={`upgrade-popover__stat ${e.positive ? '' : 'upgrade-popover__stat--negative'}`}>
                      {e.label}: {e.value}
                    </span>
                  ));
                })()}
              </div>
```

Note: `RESOURCE_LABELS` is already defined at the top of the file (around line 72).

- [ ] **Step 2: Add CSS for the stats section**

Add to `packages/client/src/ui/styles.css`:

```css
.upgrade-popover__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

.upgrade-popover__stats-label {
  width: 100%;
  font-size: 10px;
  color: #8899aa;
  margin-bottom: 2px;
}

.upgrade-popover__stat {
  font-size: 11px;
  color: #88cc88;
  padding: 1px 5px;
  background: rgba(100, 200, 100, 0.08);
  border-radius: 2px;
}

.upgrade-popover__stat--negative {
  color: #cc8866;
  background: rgba(200, 130, 100, 0.08);
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run build -w packages/shared && npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | grep -v TS6305`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/ui/screens/PlanetManagementScreen.tsx packages/client/src/ui/styles.css
git commit -m "feat: building popover shows full stats with level-scaled output"
```

---

### Task 2: Add tab strip to the right column

**Files:**
- Modify: `packages/client/src/ui/screens/PlanetManagementScreen.tsx`
- Modify: `packages/client/src/ui/styles.css`

Replace the static Production/Maintenance/Net Output right column with a tab system: Build Queue | Population | Economy | Orbitals.

- [ ] **Step 1: Add tab state**

In the `PlanetManagementScreen` function body (near the other `useState` calls), add:

```typescript
type PlanetTab = 'build-queue' | 'population' | 'economy' | 'orbitals';
const [activeTab, setActiveTab] = useState<PlanetTab>('economy');
```

- [ ] **Step 2: Replace right column content with tab strip + panels**

Find the right column `<div className="pm-col pm-col--production">`. Replace its contents with a tab strip and conditional panel rendering:

```tsx
<div className="pm-col pm-col--production">
  {/* Tab strip */}
  <div className="pm-tabs" role="tablist">
    {([
      ['build-queue', 'Build Queue'],
      ['population', 'Population'],
      ['economy', 'Economy'],
      ['orbitals', 'Orbitals'],
    ] as Array<[PlanetTab, string]>).map(([key, label]) => (
      <button
        key={key}
        role="tab"
        aria-selected={activeTab === key}
        className={`pm-tab ${activeTab === key ? 'pm-tab--active' : ''}`}
        onClick={() => setActiveTab(key)}
      >
        {label}
      </button>
    ))}
  </div>

  <div className="pm-tab-content">
    {activeTab === 'economy' && (
      <EconomyTabContent
        production={production}
        maintenance={maintenance}
        RESOURCE_KEYS={RESOURCE_KEYS}
      />
    )}
    {activeTab === 'build-queue' && (
      <BuildQueueTabContent
        planet={planet}
        onCancelQueue={onCancelQueue}
      />
    )}
    {activeTab === 'population' && (
      <PopulationTabContent planet={planet} />
    )}
    {activeTab === 'orbitals' && (
      <OrbitalsTabContent planet={planet} />
    )}
  </div>
</div>
```

- [ ] **Step 3: Extract EconomyTabContent**

Move the existing production/maintenance/net output JSX into a local component:

```tsx
function EconomyTabContent({ production, maintenance, RESOURCE_KEYS }: {
  production: Record<string, number>;
  maintenance: Record<string, number>;
  RESOURCE_KEYS: readonly string[];
}): React.ReactElement {
  return (
    <>
      {/* Existing PRODUCTION / TURN section */}
      <div className="pm-section-label">PRODUCTION / TURN</div>
      <div className="pm-prod-group">
        {RESOURCE_KEYS.filter(k => (production[k] ?? 0) > 0).map(key => (
          <div key={key} className="pm-stat-row">
            <span className="pm-stat-label">{RESOURCE_LABELS[key] ?? key}</span>
            <span className="pm-stat-value pm-stat-value--positive">
              +{Math.round((production[key] ?? 0) * 10) / 10}
            </span>
          </div>
        ))}
        {RESOURCE_KEYS.every(k => (production[k] ?? 0) === 0) && (
          <div className="pm-prod-empty">No production</div>
        )}
      </div>

      <div className="pm-divider" />

      {/* Existing MAINTENANCE section */}
      <div className="pm-section-label">MAINTENANCE</div>
      <div className="pm-prod-group">
        {RESOURCE_KEYS.filter(k => (maintenance[k] ?? 0) > 0).map(key => (
          <div key={key} className="pm-stat-row">
            <span className="pm-stat-label">{RESOURCE_LABELS[key] ?? key}</span>
            <span className="pm-stat-value" style={{ color: '#ff8844' }}>
              -{Math.round((maintenance[key] ?? 0) * 10) / 10}
            </span>
          </div>
        ))}
        {RESOURCE_KEYS.every(k => (maintenance[k] ?? 0) === 0) && (
          <div className="pm-prod-empty">No maintenance costs</div>
        )}
      </div>

      <div className="pm-divider" />

      {/* Existing NET OUTPUT section */}
      <div className="pm-section-label">NET OUTPUT</div>
      <div className="pm-prod-group">
        {RESOURCE_KEYS.map(key => {
          const net = (production[key] ?? 0) - (maintenance[key] ?? 0);
          if (Math.abs(net) < 0.05) return null;
          return (
            <div key={key} className="pm-stat-row">
              <span className="pm-stat-label">{RESOURCE_LABELS[key] ?? key}</span>
              <span className="pm-stat-value" style={{ color: net >= 0 ? '#44cc88' : '#ff4444' }}>
                {net >= 0 ? '+' : ''}{Math.round(net * 10) / 10}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

NOTE: Read the actual existing JSX first and match it exactly — the code above is a template. The existing right column code should be moved wholesale into this component.

- [ ] **Step 4: Add BuildQueueTabContent**

This moves the construction queue from the centre column into the Build Queue tab. It shows both building and ship production queues:

```tsx
function BuildQueueTabContent({ planet, onCancelQueue }: {
  planet: Planet;
  onCancelQueue: (planetId: string, queueIndex: number) => void;
}): React.ReactElement {
  const buildingQueue = planet.productionQueue.filter(q => q.type === 'building' || q.type === 'building_upgrade');
  const shipQueue = planet.productionQueue.filter(q => q.type === 'ship');

  if (planet.productionQueue.length === 0) {
    return <div className="pm-prod-empty">No items in production</div>;
  }

  return (
    <>
      {buildingQueue.length > 0 && (
        <>
          <div className="pm-section-label">BUILDINGS</div>
          <ConstructionQueue
            queue={buildingQueue}
            onCancel={(idx) => {
              // Map back to the original queue index
              const origIdx = planet.productionQueue.indexOf(buildingQueue[idx]!);
              if (origIdx >= 0) onCancelQueue(planet.id, origIdx);
            }}
            buildings={planet.buildings}
          />
        </>
      )}
      {shipQueue.length > 0 && (
        <>
          <div className="pm-section-label">SHIPS</div>
          <ConstructionQueue
            queue={shipQueue}
            onCancel={(idx) => {
              const origIdx = planet.productionQueue.indexOf(shipQueue[idx]!);
              if (origIdx >= 0) onCancelQueue(planet.id, origIdx);
            }}
          />
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5: Add PopulationTabContent**

Basic population stats — species, happiness estimate, growth rate. Demographics (age breakdown, illness etc.) can be expanded later when the data model supports it:

```tsx
function PopulationTabContent({ planet }: { planet: Planet }): React.ReactElement {
  const maxPop = planet.maxPopulation;
  const curPop = planet.currentPopulation;
  const growthPct = maxPop > 0 ? Math.round((curPop / maxPop) * 100) : 0;

  return (
    <>
      <div className="pm-section-label">POPULATION</div>
      <div className="pm-prod-group">
        <div className="pm-stat-row">
          <span className="pm-stat-label">Current</span>
          <span className="pm-stat-value">{curPop.toLocaleString()}</span>
        </div>
        <div className="pm-stat-row">
          <span className="pm-stat-label">Capacity</span>
          <span className="pm-stat-value">{maxPop.toLocaleString()}</span>
        </div>
        <div className="pm-stat-row">
          <span className="pm-stat-label">Utilisation</span>
          <span className="pm-stat-value">{growthPct}%</span>
        </div>
      </div>

      <div className="pm-divider" />

      <div className="pm-section-label">DEMOGRAPHICS</div>
      <div className="pm-prod-empty" style={{ fontStyle: 'italic' }}>
        Detailed demographics coming soon — species breakdown, age groups, happiness distribution.
      </div>
    </>
  );
}
```

- [ ] **Step 6: Add OrbitalsTabContent**

Shows orbital buildings and ships in the system. Orbital building types: `shipyard`, `spaceport`, `orbital_platform`, `orbital_waste_ejector`, `defense_grid`.

```tsx
const ORBITAL_BUILDING_TYPES: Set<string> = new Set([
  'shipyard', 'spaceport', 'orbital_platform', 'orbital_waste_ejector', 'defense_grid',
]);

function OrbitalsTabContent({ planet }: { planet: Planet }): React.ReactElement {
  const orbitalBuildings = planet.buildings.filter(b => ORBITAL_BUILDING_TYPES.has(b.type));

  return (
    <>
      <div className="pm-section-label">ORBITAL STRUCTURES</div>
      {orbitalBuildings.length === 0 ? (
        <div className="pm-prod-empty">No orbital structures</div>
      ) : (
        <div className="pm-prod-group">
          {orbitalBuildings.map(b => {
            const def = BUILDING_DEFINITIONS[b.type];
            return (
              <div key={b.id} className="pm-stat-row">
                <span className="pm-stat-label">{def?.name ?? b.type}</span>
                <span className="pm-stat-value">Lv.{b.level}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="pm-divider" />

      <div className="pm-section-label">SHIPS IN ORBIT</div>
      <div className="pm-prod-empty" style={{ fontStyle: 'italic' }}>
        Ship listing requires fleet data — will be wired in a future update.
      </div>

      <div className="pm-divider" />

      <div className="pm-section-label">DEFENCES</div>
      <div className="pm-prod-empty" style={{ fontStyle: 'italic' }}>
        Minefields, weapon platforms, and satellite networks coming soon.
      </div>
    </>
  );
}
```

- [ ] **Step 7: Add CSS for tab strip**

Add to `packages/client/src/ui/styles.css`:

```css
/* ── Planet management tabs ─────────────────────────────────────────────── */

.pm-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(100, 160, 255, 0.15);
  padding: 0 4px;
  flex-shrink: 0;
}

.pm-tab {
  flex: 1;
  padding: 6px 4px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #6688aa;
  font-family: monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.pm-tab:hover {
  color: #aaccee;
}

.pm-tab--active {
  color: #00d4ff;
  border-bottom-color: #00d4ff;
}

.pm-tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}
```

- [ ] **Step 8: Run typecheck and build**

Run: `npm run build -w packages/shared && npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | grep -v TS6305`
Expected: Clean.

- [ ] **Step 9: Commit**

```bash
git add packages/client/src/ui/screens/PlanetManagementScreen.tsx packages/client/src/ui/styles.css
git commit -m "feat: planet management tabs — Build Queue, Population, Economy, Orbitals

Replaces the static right column with a tabbed interface. Economy tab
preserves the existing production/maintenance/net display. Build Queue
shows buildings and ships in production. Population shows basic stats
with placeholder for demographics. Orbitals lists orbital structures."
```

---

### Task 3: Remove duplicate construction queue from centre column

**Files:**
- Modify: `packages/client/src/ui/screens/PlanetManagementScreen.tsx`

Now that the Build Queue tab exists, remove the construction queue from the centre column to avoid duplication. Keep the building slot grid and upgrade popover in the centre.

- [ ] **Step 1: Remove the construction queue section from the centre column**

Find the "CONSTRUCTION QUEUE" label and `<ConstructionQueue>` component in the centre column (`pm-col--buildings`). Remove them (they now live in the Build Queue tab).

Keep the shipyard section in the centre column for now (or move it to the Orbitals tab if it fits naturally).

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | grep -v TS6305`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/screens/PlanetManagementScreen.tsx
git commit -m "refactor: move construction queue from centre column to Build Queue tab"
```

---

### Task 4: Final integration check

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Succeeds.

- [ ] **Step 2: Run tests**

Run: `npx vitest run packages/shared/`
Expected: All tests pass.

- [ ] **Step 3: Deploy and verify**

Deploy to DEV and verify:
- Clicking a building shows stats (production, energy, waste, maintenance) scaled by level
- Four tabs visible in the right column
- Economy tab shows same content as before
- Build Queue tab shows queued buildings/ships
- Population tab shows current/capacity/utilisation
- Orbitals tab lists orbital structures
