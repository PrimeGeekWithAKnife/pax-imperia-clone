# Combat Scene Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the tactical combat Phaser scene with ship rendering, movement, basic weapon firing (beams + projectiles), combat trigger dialogue, and the scene transition from the game loop.

**Architecture:** A new `CombatScene` Phaser scene renders ships as sprites with facing. The game loop pauses when combat is triggered and transitions to the combat scene instead of auto-resolving. Ships move based on engine speed, fire weapons at targets within range with travel time (projectiles) or instant hit (beams). The existing `CombatShip` type from `combat.ts` is reused. A combat trigger dialogue appears first to let the player choose engagement or retreat.

**Tech Stack:** TypeScript, Phaser 3 (scene, tweens, graphics), React (combat trigger dialogue overlay)

**Scope:** This plan covers the visual foundation only. Damage application (shields, armour, hull) is in a follow-up plan. Ships fire and hit but no damage is applied yet — that's wired in Plan B.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/client/src/game/scenes/CombatScene.ts` | Phaser scene — renders battle map, ships, weapons fire |
| Create | `packages/shared/src/engine/combat-tactical.ts` | Pure functions for tactical combat state — tick processing, movement, targeting |
| Create | `packages/shared/src/__tests__/combat-tactical.test.ts` | Tests for tactical combat logic |
| Create | `packages/client/src/ui/screens/CombatTriggerDialog.tsx` | React dialogue — engage, flee, or hail before combat starts |
| Modify | `packages/client/src/engine/GameEngine.ts` | Intercept combat — transition to scene instead of auto-resolve |
| Modify | `packages/shared/src/engine/game-loop.ts` | Add flag to defer combat to client scene |
| Modify | `packages/client/src/ui/App.tsx` | Wire combat trigger dialogue and combat scene transitions |
| Modify | `packages/client/src/ui/styles.css` | Combat trigger dialogue styles |

---

### Task 1: Create tactical combat state engine

**Files:**
- Create: `packages/shared/src/engine/combat-tactical.ts`
- Create: `packages/shared/src/__tests__/combat-tactical.test.ts`

The tactical engine manages per-tick state for the combat scene. Ships have position, facing, velocity, and can fire weapons. This task creates the pure data/logic layer with no rendering.

- [ ] **Step 1: Create the tactical combat types and initialisation**

Create `packages/shared/src/engine/combat-tactical.ts`:

```typescript
/**
 * Tactical combat engine — pure functions for the interactive combat scene.
 *
 * Operates on a 2D battlefield coordinate system (0,0 at centre).
 * Attacker ships start at top-left, defenders at bottom-right.
 */

import type { Ship, Fleet, ShipDesign, ShipComponent } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TacticalShip {
  id: string;
  shipId: string;           // reference to the canonical Ship
  designId: string;
  side: 'attacker' | 'defender';
  name: string;
  hullClass: string;

  // Position & movement
  x: number;
  y: number;
  facing: number;           // radians (0 = right, PI/2 = down)
  speed: number;            // units per tick (from main engine)
  turnRate: number;         // radians per tick (from manoeuvring thruster)
  targetX: number | null;
  targetY: number | null;

  // Stats (computed from design + components at init)
  maxHull: number;
  currentHull: number;
  maxShields: number;
  currentShields: number;
  armour: number;           // total armour rating
  weapons: TacticalWeapon[];
  sensorRange: number;

  // State
  isDestroyed: boolean;
  isRouted: boolean;
  order: ShipOrder;
}

export interface TacticalWeapon {
  componentId: string;
  name: string;
  type: 'beam' | 'projectile' | 'missile' | 'point_defense' | 'fighter_bay';
  damage: number;
  range: number;
  accuracy: number;
  cooldown: number;         // ticks between shots
  ticksSinceLastFire: number;
  facing: 'fore' | 'aft' | 'port' | 'starboard' | 'turret';
}

export type ShipOrder =
  | { type: 'idle' }
  | { type: 'attack'; targetId: string }
  | { type: 'defend'; targetId: string }
  | { type: 'move'; x: number; y: number }
  | { type: 'flee' };

export interface Projectile {
  id: string;
  sourceShipId: string;
  targetShipId: string;
  x: number;
  y: number;
  speed: number;
  damage: number;
  damageType: string;
}

export interface BeamEffect {
  sourceShipId: string;
  targetShipId: string;
  damage: number;
  ticksRemaining: number;  // visual duration
}

export interface TacticalState {
  tick: number;
  ships: TacticalShip[];
  projectiles: Projectile[];
  beamEffects: BeamEffect[];
  battlefieldWidth: number;
  battlefieldHeight: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BATTLEFIELD_WIDTH = 1600;
export const BATTLEFIELD_HEIGHT = 1000;
const DEFAULT_SPEED = 2;
const DEFAULT_TURN_RATE = 0.05;
const DEFAULT_SENSOR_RANGE = 300;
const PROJECTILE_SPEED = 8;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Create the initial tactical state from fleet and ship data.
 * Attackers are placed at top-left, defenders at bottom-right.
 */
export function initializeTacticalCombat(
  attackerFleet: Fleet,
  defenderFleet: Fleet,
  attackerShips: Ship[],
  defenderShips: Ship[],
  designs: Map<string, ShipDesign>,
  components: ShipComponent[],
): TacticalState {
  const componentMap = new Map(components.map(c => [c.id, c]));

  const ships: TacticalShip[] = [];

  // Place attackers at top-left quadrant
  for (let i = 0; i < attackerShips.length; i++) {
    const ship = attackerShips[i]!;
    const design = designs.get(ship.designId);
    ships.push(buildTacticalShip(
      ship, design, componentMap, 'attacker',
      100 + (i % 3) * 60,
      100 + Math.floor(i / 3) * 60,
      0, // facing right
    ));
  }

  // Place defenders at bottom-right quadrant
  for (let i = 0; i < defenderShips.length; i++) {
    const ship = defenderShips[i]!;
    const design = designs.get(ship.designId);
    ships.push(buildTacticalShip(
      ship, design, componentMap, 'defender',
      BATTLEFIELD_WIDTH - 100 - (i % 3) * 60,
      BATTLEFIELD_HEIGHT - 100 - Math.floor(i / 3) * 60,
      Math.PI, // facing left
    ));
  }

  return {
    tick: 0,
    ships,
    projectiles: [],
    beamEffects: [],
    battlefieldWidth: BATTLEFIELD_WIDTH,
    battlefieldHeight: BATTLEFIELD_HEIGHT,
  };
}

function buildTacticalShip(
  ship: Ship,
  design: ShipDesign | undefined,
  componentMap: Map<string, ShipComponent>,
  side: 'attacker' | 'defender',
  x: number, y: number, facing: number,
): TacticalShip {
  let speed = DEFAULT_SPEED;
  let turnRate = DEFAULT_TURN_RATE;
  let maxShields = 0;
  let armour = 0;
  let sensorRange = DEFAULT_SENSOR_RANGE;
  const weapons: TacticalWeapon[] = [];

  if (design) {
    for (const slot of design.components) {
      const comp = componentMap.get(slot.componentId);
      if (!comp) continue;

      if (comp.type === 'engine') {
        speed = Math.max(speed, comp.stats.speed ?? DEFAULT_SPEED);
      }
      if (comp.type === 'shield') {
        maxShields += comp.stats.shieldStrength ?? 0;
      }
      if (comp.type === 'armor') {
        armour += comp.stats.armorRating ?? 0;
      }
      if (comp.type === 'sensor') {
        sensorRange = Math.max(sensorRange, (comp.stats.sensorRange ?? 3) * 50);
      }
      if (comp.type.startsWith('weapon_') || comp.type === 'fighter_bay') {
        const weaponType = comp.type === 'weapon_beam' ? 'beam'
          : comp.type === 'weapon_projectile' ? 'projectile'
          : comp.type === 'weapon_missile' ? 'missile'
          : comp.type === 'weapon_point_defense' ? 'point_defense'
          : 'fighter_bay';

        weapons.push({
          componentId: comp.id,
          name: comp.name,
          type: weaponType,
          damage: comp.stats.damage ?? 10,
          range: (comp.stats.range ?? 5) * 50,  // convert to battlefield units
          accuracy: comp.stats.accuracy ?? 80,
          cooldown: 10,  // ticks between shots
          ticksSinceLastFire: 0,
          facing: 'turret',  // default; could read from hull slot facing
        });
      }
    }
  }

  return {
    id: `tactical-${ship.id}`,
    shipId: ship.id,
    designId: ship.designId,
    side,
    name: ship.name,
    hullClass: design?.hull ?? 'scout',
    x, y, facing,
    speed,
    turnRate,
    targetX: null,
    targetY: null,
    maxHull: ship.maxHullPoints,
    currentHull: ship.hullPoints,
    maxShields,
    currentShields: maxShields,
    armour,
    weapons,
    sensorRange,
    isDestroyed: false,
    isRouted: false,
    order: { type: 'idle' },
  };
}

// ---------------------------------------------------------------------------
// Per-tick processing
// ---------------------------------------------------------------------------

/**
 * Advance the tactical combat state by one tick.
 * Processes: movement → weapon cooldowns → targeting → firing → projectile movement.
 */
export function processTacticalTick(state: TacticalState): TacticalState {
  let ships = state.ships.map(s => ({ ...s }));
  let projectiles = [...state.projectiles];
  let beamEffects = state.beamEffects
    .map(b => ({ ...b, ticksRemaining: b.ticksRemaining - 1 }))
    .filter(b => b.ticksRemaining > 0);

  // 1. Move ships toward their targets
  ships = ships.map(ship => {
    if (ship.isDestroyed || ship.isRouted) return ship;
    return moveShip(ship, state);
  });

  // 2. Move projectiles
  const newProjectiles: Projectile[] = [];
  for (const proj of projectiles) {
    const target = ships.find(s => s.id === proj.targetShipId);
    if (!target || target.isDestroyed) continue;

    const dx = target.x - proj.x;
    const dy = target.y - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < proj.speed) {
      // Hit! (damage applied in Plan B)
      continue; // projectile consumed
    }

    // Move toward target
    newProjectiles.push({
      ...proj,
      x: proj.x + (dx / dist) * proj.speed,
      y: proj.y + (dy / dist) * proj.speed,
    });
  }

  // 3. Fire weapons
  const newBeams: BeamEffect[] = [];
  ships = ships.map(ship => {
    if (ship.isDestroyed || ship.isRouted) return ship;

    const target = findTarget(ship, ships);
    if (!target) return ship;

    const updatedWeapons = ship.weapons.map(w => {
      const updated = { ...w, ticksSinceLastFire: w.ticksSinceLastFire + 1 };
      if (updated.ticksSinceLastFire < updated.cooldown) return updated;

      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > updated.range) return updated;

      // Fire!
      updated.ticksSinceLastFire = 0;

      if (updated.type === 'beam') {
        newBeams.push({
          sourceShipId: ship.id,
          targetShipId: target.id,
          damage: updated.damage,
          ticksRemaining: 3,
        });
      } else if (updated.type === 'projectile') {
        newProjectiles.push({
          id: `proj-${state.tick}-${ship.id}-${updated.componentId}`,
          sourceShipId: ship.id,
          targetShipId: target.id,
          x: ship.x,
          y: ship.y,
          speed: PROJECTILE_SPEED,
          damage: updated.damage,
          damageType: 'kinetic',
        });
      }

      return updated;
    });

    return { ...ship, weapons: updatedWeapons };
  });

  return {
    tick: state.tick + 1,
    ships,
    projectiles: newProjectiles,
    beamEffects: [...beamEffects, ...newBeams],
    battlefieldWidth: state.battlefieldWidth,
    battlefieldHeight: state.battlefieldHeight,
  };
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function moveShip(ship: TacticalShip, state: TacticalState): TacticalShip {
  let tx: number | null = ship.targetX;
  let ty: number | null = ship.targetY;

  // Determine movement target based on order
  if (ship.order.type === 'attack') {
    const target = state.ships.find(s => s.id === ship.order.targetId && !s.isDestroyed);
    if (target) {
      // Move toward attack target but stop at weapon range
      const maxRange = Math.max(...ship.weapons.map(w => w.range), 100);
      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxRange * 0.8) {
        tx = target.x;
        ty = target.y;
      } else {
        tx = null;
        ty = null;
      }
    }
  } else if (ship.order.type === 'move') {
    tx = ship.order.x;
    ty = ship.order.y;
  } else if (ship.order.type === 'flee') {
    // Attackers flee to top-left, defenders to bottom-right
    if (ship.side === 'attacker') {
      tx = -50;
      ty = -50;
    } else {
      tx = state.battlefieldWidth + 50;
      ty = state.battlefieldHeight + 50;
    }
  }

  if (tx === null || ty === null) return ship;

  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ship.speed) {
    // Arrived
    if (ship.order.type === 'flee' && (ship.x < 0 || ship.x > state.battlefieldWidth || ship.y < 0 || ship.y > state.battlefieldHeight)) {
      return { ...ship, isRouted: true };
    }
    return { ...ship, x: tx, y: ty, targetX: null, targetY: null };
  }

  // Turn toward target
  const desiredFacing = Math.atan2(dy, dx);
  let facingDiff = desiredFacing - ship.facing;
  // Normalise to [-PI, PI]
  while (facingDiff > Math.PI) facingDiff -= 2 * Math.PI;
  while (facingDiff < -Math.PI) facingDiff += 2 * Math.PI;

  let newFacing = ship.facing;
  if (Math.abs(facingDiff) > ship.turnRate) {
    newFacing += Math.sign(facingDiff) * ship.turnRate;
  } else {
    newFacing = desiredFacing;
  }

  // Move forward in facing direction
  const moveX = Math.cos(newFacing) * ship.speed;
  const moveY = Math.sin(newFacing) * ship.speed;

  return {
    ...ship,
    x: ship.x + moveX,
    y: ship.y + moveY,
    facing: newFacing,
    targetX: tx,
    targetY: ty,
  };
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

function findTarget(ship: TacticalShip, allShips: TacticalShip[]): TacticalShip | null {
  // If ship has an attack order, prefer that target
  if (ship.order.type === 'attack') {
    const ordered = allShips.find(s => s.id === ship.order.targetId && !s.isDestroyed && !s.isRouted);
    if (ordered) return ordered;
  }

  // Otherwise find closest enemy
  const enemies = allShips.filter(s => s.side !== ship.side && !s.isDestroyed && !s.isRouted);
  if (enemies.length === 0) return null;

  let closest: TacticalShip | null = null;
  let closestDist = Infinity;
  for (const enemy of enemies) {
    const dx = enemy.x - ship.x;
    const dy = enemy.y - ship.y;
    const dist = dx * dx + dy * dy;
    if (dist < closestDist) {
      closestDist = dist;
      closest = enemy;
    }
  }
  return closest;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export function setShipOrder(state: TacticalState, shipId: string, order: ShipOrder): TacticalState {
  return {
    ...state,
    ships: state.ships.map(s => s.id === shipId ? { ...s, order } : s),
  };
}
```

- [ ] **Step 2: Write basic tests**

Create `packages/shared/src/__tests__/combat-tactical.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipOrder,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '../engine/combat-tactical.js';
import type { Ship, Fleet, ShipDesign, ShipComponent } from '../types/ships.js';

const mockFleet = (id: string, empireId: string, shipIds: string[]): Fleet => ({
  id, name: 'Test Fleet', ships: shipIds, empireId,
  position: { systemId: 'sys1' }, destination: null, waypoints: [], stance: 'aggressive',
});

const mockShip = (id: string, designId: string): Ship => ({
  id, designId, name: `Ship ${id}`, hullPoints: 100, maxHullPoints: 100,
  systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
  position: { systemId: 'sys1' }, fleetId: null,
});

const mockDesign = (id: string): ShipDesign => ({
  id, name: 'Test Design', hull: 'destroyer', components: [
    { slotId: 'weapon1', componentId: 'pulse_laser' },
    { slotId: 'engine1', componentId: 'ion_engine' },
  ], totalCost: 200, empireId: 'e1',
});

const mockComponents: ShipComponent[] = [
  { id: 'pulse_laser', name: 'Pulse Laser', type: 'weapon_beam', stats: { damage: 10, range: 5, accuracy: 85 }, cost: 50, requiredTech: null },
  { id: 'ion_engine', name: 'Ion Engine', type: 'engine', stats: { speed: 3 }, cost: 65, requiredTech: null },
];

describe('initializeTacticalCombat', () => {
  it('places attackers at top-left and defenders at bottom-right', () => {
    const designs = new Map([['d1', mockDesign('d1')]]);
    const state = initializeTacticalCombat(
      mockFleet('f1', 'e1', ['s1']),
      mockFleet('f2', 'e2', ['s2']),
      [mockShip('s1', 'd1')],
      [mockShip('s2', 'd1')],
      designs,
      mockComponents,
    );
    expect(state.ships).toHaveLength(2);
    const attacker = state.ships.find(s => s.side === 'attacker')!;
    const defender = state.ships.find(s => s.side === 'defender')!;
    expect(attacker.x).toBeLessThan(BATTLEFIELD_WIDTH / 2);
    expect(defender.x).toBeGreaterThan(BATTLEFIELD_WIDTH / 2);
  });

  it('extracts weapon stats from components', () => {
    const designs = new Map([['d1', mockDesign('d1')]]);
    const state = initializeTacticalCombat(
      mockFleet('f1', 'e1', ['s1']),
      mockFleet('f2', 'e2', ['s2']),
      [mockShip('s1', 'd1')],
      [mockShip('s2', 'd1')],
      designs,
      mockComponents,
    );
    const attacker = state.ships.find(s => s.side === 'attacker')!;
    expect(attacker.weapons.length).toBeGreaterThan(0);
    expect(attacker.weapons[0]!.type).toBe('beam');
    expect(attacker.speed).toBe(3);
  });
});

describe('processTacticalTick', () => {
  it('advances the tick counter', () => {
    const designs = new Map([['d1', mockDesign('d1')]]);
    const state = initializeTacticalCombat(
      mockFleet('f1', 'e1', ['s1']),
      mockFleet('f2', 'e2', ['s2']),
      [mockShip('s1', 'd1')],
      [mockShip('s2', 'd1')],
      designs,
      mockComponents,
    );
    const next = processTacticalTick(state);
    expect(next.tick).toBe(1);
  });

  it('moves ships toward their attack target', () => {
    const designs = new Map([['d1', mockDesign('d1')]]);
    let state = initializeTacticalCombat(
      mockFleet('f1', 'e1', ['s1']),
      mockFleet('f2', 'e2', ['s2']),
      [mockShip('s1', 'd1')],
      [mockShip('s2', 'd1')],
      designs,
      mockComponents,
    );
    const attacker = state.ships.find(s => s.side === 'attacker')!;
    const defender = state.ships.find(s => s.side === 'defender')!;
    state = setShipOrder(state, attacker.id, { type: 'attack', targetId: defender.id });
    const next = processTacticalTick(state);
    const movedAttacker = next.ships.find(s => s.id === attacker.id)!;
    // Should have moved closer to defender
    const oldDist = Math.sqrt((defender.x - attacker.x) ** 2 + (defender.y - attacker.y) ** 2);
    const newDist = Math.sqrt((defender.x - movedAttacker.x) ** 2 + (defender.y - movedAttacker.y) ** 2);
    expect(newDist).toBeLessThan(oldDist);
  });
});

describe('setShipOrder', () => {
  it('updates a ship order', () => {
    const designs = new Map([['d1', mockDesign('d1')]]);
    const state = initializeTacticalCombat(
      mockFleet('f1', 'e1', ['s1']),
      mockFleet('f2', 'e2', ['s2']),
      [mockShip('s1', 'd1')],
      [mockShip('s2', 'd1')],
      designs,
      mockComponents,
    );
    const shipId = state.ships[0]!.id;
    const updated = setShipOrder(state, shipId, { type: 'flee' });
    expect(updated.ships.find(s => s.id === shipId)!.order.type).toBe('flee');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts`
Expected: All pass.

- [ ] **Step 4: Export from shared package**

Add `export * from './combat-tactical.js';` to `packages/shared/src/engine/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts packages/shared/src/engine/index.ts
git commit -m "feat: tactical combat engine — ship movement, targeting, weapon firing"
```

---

### Task 2: Create the CombatScene Phaser scene

**Files:**
- Create: `packages/client/src/game/scenes/CombatScene.ts`

This is the visual layer — renders the battlefield, ships, weapon effects. Uses the tactical engine from Task 1 for state.

- [ ] **Step 1: Create the scene skeleton**

Create `packages/client/src/game/scenes/CombatScene.ts` with:
- Background (dark space with faint stars)
- Ship sprites rendered at their tactical positions (simple coloured triangles for now — attacker colour vs defender colour)
- Beam effects as lines between ships
- Projectiles as small dots moving
- Ship selection (click a friendly ship to select it)
- Right-click to issue move order to selected ship
- Click enemy ship to issue attack order
- Tick loop that calls `processTacticalTick` and updates visuals
- Speed controls (1x, 2x, 4x)
- Pause button (uses limited pauses)
- "Retreat" button to order all ships to flee
- HUD overlay showing selected ship stats

The scene receives combat setup data (attacker/defender fleets, ships, designs, components) when started.

The full implementation should be ~400-600 lines. Key methods:
- `create(data)` — initialise tactical state, render battlefield, place ships
- `update(time, delta)` — advance tactical ticks at the configured speed, update visual positions
- Ship rendering: triangle shapes coloured by empire, rotated by facing
- Beam rendering: bright lines between source and target for 3 ticks
- Projectile rendering: small bright dots moving each frame
- Selection: click friendly ship → highlight, right-click → move order, click enemy → attack order
- UI: speed buttons, pause, retreat, selected ship info

- [ ] **Step 2: Register the scene**

In the Phaser game config (find where scenes are registered — likely in `packages/client/src/game/PhaserGame.ts` or similar), add `CombatScene` to the scene list.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | grep -v TS6305`

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/game/scenes/CombatScene.ts
git commit -m "feat: CombatScene Phaser scene — ships, movement, weapons fire visuals"
```

---

### Task 3: Combat trigger dialogue

**Files:**
- Create: `packages/client/src/ui/screens/CombatTriggerDialog.tsx`
- Modify: `packages/client/src/ui/styles.css`
- Modify: `packages/client/src/ui/App.tsx`

When combat is about to start, show a dialogue letting the player choose: Engage, Flee, or Hail.

- [ ] **Step 1: Create the dialogue component**

```tsx
interface CombatTriggerDialogProps {
  attackerName: string;
  defenderName: string;
  attackerShipCount: number;
  defenderShipCount: number;
  isPlayerAttacker: boolean;
  /** True if the enemy initiated (aggressive stance) */
  enemyInitiated: boolean;
  onEngage: () => void;
  onFlee: () => void;
  onHail: () => void;
}
```

Show:
- "HOSTILE FLEET DETECTED" header
- Enemy fleet info (name, ship count, estimated power)
- Three buttons: "Engage" (primary), "Flee" (secondary), "Hail" (secondary)
- If enemy initiated: "Enemy fleet is powering weapons!" warning text

- [ ] **Step 2: Add styles**

Dark modal overlay matching the game's aesthetic.

- [ ] **Step 3: Wire in App.tsx**

Add state for pending combat trigger. When the game engine signals a combat about to start (instead of auto-resolving), show the dialogue. On "Engage", transition to CombatScene. On "Flee", order the fleet to retreat. On "Hail", attempt diplomacy (future — for now just dismiss).

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/ui/screens/CombatTriggerDialog.tsx packages/client/src/ui/styles.css packages/client/src/ui/App.tsx
git commit -m "feat: combat trigger dialogue — engage, flee, or hail before battle"
```

---

### Task 4: Intercept combat in the game loop

**Files:**
- Modify: `packages/shared/src/engine/game-loop.ts`
- Modify: `packages/client/src/engine/GameEngine.ts`

Instead of auto-resolving combat, emit an event that pauses the game and lets the client handle it.

- [ ] **Step 1: Add combat interception in GameEngine**

In `GameEngine.tick()`, after `processGameTick` returns, check if there are pending combats. If the player is involved in any, pause the engine and emit `engine:combat_pending` with the combat setup data instead of letting auto-resolve run.

Modify `stepCombatResolution` in game-loop.ts to accept a flag `deferPlayerCombat: boolean`. When true, skip combats involving the player empire and leave them in `pendingCombats`. Auto-resolve AI-vs-AI combats normally.

- [ ] **Step 2: Emit combat pending event**

In GameEngine, after detecting deferred combat:

```typescript
this.game.events.emit('engine:combat_pending', {
  systemId: combat.systemId,
  attackerFleet,
  defenderFleet,
  attackerShips,
  defenderShips,
});
```

Pause the engine. The React layer picks this up and shows the combat trigger dialogue.

- [ ] **Step 3: Handle combat result return**

After the CombatScene completes (player wins, loses, or retreats), emit `engine:combat_resolved_tactical` with the final tactical state. GameEngine applies the results to the canonical ship/fleet data and resumes ticking.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/engine/game-loop.ts packages/client/src/engine/GameEngine.ts
git commit -m "feat: defer player combat to tactical scene instead of auto-resolve"
```

---

### Task 5: Scene transitions and integration

**Files:**
- Modify: `packages/client/src/ui/App.tsx`
- Modify: `packages/client/src/game/scenes/CombatScene.ts`

Wire the full flow: game loop detects combat → dialogue shown → player chooses engage → CombatScene starts → battle plays out → results returned → game resumes.

- [ ] **Step 1: Wire the full transition chain**

In App.tsx:
- Listen for `engine:combat_pending`
- Show CombatTriggerDialog
- On "Engage": emit `combat:start_tactical` with setup data
- CombatScene listens for this and starts

In CombatScene:
- When battle ends (all enemies destroyed, all friendlies fled, or victory condition met)
- Emit `combat:tactical_complete` with results
- Transition back to GalaxyMapScene (with `{}` data to avoid the stale data bug)

In App.tsx / GameEngine:
- Listen for `combat:tactical_complete`
- Apply results to game state (update ships, fleets, remove destroyed)
- Resume game tick loop

- [ ] **Step 2: Test full flow manually**

Deploy to DEV and test:
1. Start game, build some ships
2. Move fleet to system with enemy fleet
3. Combat trigger dialogue appears
4. Click "Engage"
5. CombatScene loads with ships
6. Ships move and fire
7. Battle resolves
8. Return to galaxy map with updated fleet state

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: full combat scene integration — trigger → battle → results → resume"
```

---

### Task 6: Final integration check

- [ ] **Step 1: Run full test suite**
- [ ] **Step 2: Typecheck**
- [ ] **Step 3: Build**
- [ ] **Step 4: Deploy to DEV**
- [ ] **Step 5: Merge to main**
