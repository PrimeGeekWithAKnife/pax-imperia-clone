# Combat Realism Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add physical realism and tactical depth to the tactical combat engine across ship movement, weapon fire, and collision systems — 10 improvements grouped into 6 phases.

**Architecture:** All changes target the shared tactical engine (`packages/shared/src/engine/combat-tactical.ts`) with supporting visual updates in the 3D combat renderer (`packages/client/src/ui/screens/combat3d/`). The engine is pure-functional (returns new state per tick), so changes are additive to the existing interface with new fields on `TacticalShip`.

**Phase dependencies:** Phases 1, 2, 4, 6 are fully independent. **Phase 5 (capacitor) must be implemented after Phase 3 (sustained beams)** because sustained beam ticks bypass the cooldown entry point — the capacitor drain must be placed to cover both normal fire and sustained burst continuation. If Phase 5 is implemented without Phase 3, it works correctly for pulse weapons; Phase 3 then adds the sustained path which must include the capacitor drain. Phases 2 and 6 both modify `moveToward` — implement sequentially or expect mechanical merge conflicts.

**Tech Stack:** TypeScript (strict), Vitest, React Three Fiber (visual layer)

---

## Phase 1: Per-Weapon Projectile Speeds

**Why:** All projectiles fly at `PROJECTILE_SPEED = 16` regardless of weapon type. A scatter cannon and a gauss cannon have identical muzzle velocity. This collapses the tactical distinction between weapon types. This is the highest-impact, lowest-risk change.

### Task 1.1: Add projectile speed table and plumb through firing

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:27` (PROJECTILE_SPEED constant)
- Modify: `packages/shared/src/engine/combat-tactical.ts:71-78` (PROJECTILE_BURST_COUNT table area)
- Modify: `packages/shared/src/engine/combat-tactical.ts:4848-4872` (projectile creation in processTacticalTick)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing tests for per-weapon projectile speeds**

Add a new `describe` block after the existing `weapon firing -- projectiles` block (~line 509 in test file):

```typescript
describe('per-weapon projectile speed', () => {
  it('gauss cannon projectiles are faster than kinetic cannon projectiles', () => {
    // Set up a state with two ships, one with gauss, one with kinetic
    // Fire both, check proj.speed differs
    const state = initializeTacticalCombat(setup, components);
    // ... (minimal setup with two weapon types)
    const gauss = state.projectiles.find(p => p.componentId === 'gauss_cannon');
    const kinetic = state.projectiles.find(p => p.componentId === 'kinetic_cannon');
    expect(gauss!.speed).toBeGreaterThan(kinetic!.speed);
  });

  it('siege cannon projectiles are slower than default', () => {
    // Verify siege_cannon speed < 16 (old default)
  });

  it('projectile dx/dy are computed from the per-weapon speed', () => {
    // Verify that dx^2 + dy^2 + dz^2 ≈ speed^2
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/api/exnihilo/pax-imperia-clone/.claude/worktrees/floating-cooking-elephant && npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — new tests reference behaviour that doesn't exist yet.

- [ ] **Step 3: Add the PROJECTILE_SPEED_BY_TYPE table**

In `combat-tactical.ts`, after the `PROJECTILE_BURST_COUNT` table (line 78), add:

```typescript
/** Per-weapon muzzle velocity (battlefield units/tick).
 *  Faster rounds are harder to dodge but spread less visually.
 *  Slower rounds give targets more reaction time. */
const PROJECTILE_SPEED_BY_TYPE: Record<string, number> = {
  kinetic_cannon: 12, scatter_cannon: 10, coilgun_array: 14,
  mass_driver: 18,    gauss_cannon: 24,   siege_cannon: 8,
  battering_ram: 6,   fusion_autocannon: 14,
  antimatter_accelerator: 28, singularity_driver: 30,
  plasma_slugthrower: 16, hypermass_projector: 22,
  khazari_forge_breaker: 10,
};
/** Fallback speed for weapon types not in PROJECTILE_SPEED_BY_TYPE. */
const DEFAULT_PROJECTILE_SPEED = 16;
```

Keep `PROJECTILE_SPEED` constant as-is (exported, may be referenced elsewhere) but stop using it in projectile creation.

- [ ] **Step 4: Update projectile creation to use per-weapon speed**

In `processTacticalTick`, the projectile creation section (~line 4848-4872), replace the line that sets `speed: PROJECTILE_SPEED` with:

```typescript
const projSpeed = PROJECTILE_SPEED_BY_TYPE[weapon.componentId] ?? DEFAULT_PROJECTILE_SPEED;
```

Then use `projSpeed` in the `dx`/`dy`/`dz` calculations:

```typescript
dx: Math.cos(spreadAngle) * Math.cos(spreadPitch) * projSpeed,
dy: Math.sin(spreadAngle) * Math.cos(spreadPitch) * projSpeed,
dz: Math.sin(spreadPitch) * projSpeed,
```

And set `speed: projSpeed` on the Projectile object.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/api/exnihilo/pax-imperia-clone/.claude/worktrees/floating-cooking-elephant && npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts --reporter=verbose 2>&1 | tail -30`
Expected: All new tests PASS. All existing tests PASS (no regression).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: per-weapon projectile speeds — gauss streaks, siege lumbers"
```

### Task 1.2: Update 3D projectile visuals to reflect speed differences

**Files:**
- Modify: `packages/client/src/ui/screens/combat3d/CombatWeapons.tsx:430-587` (ProjectileEffects)

- [ ] **Step 1: Update ProjectileEffects to scale trail length by projectile speed**

In `ProjectileEffects`, where the trail geometry is computed, scale the trail length by `proj.speed / 16` (normalised to old default). Faster projectiles get longer trails; slower ones get stubbier trails. Find the trail length calculation and multiply by this factor.

- [ ] **Step 2: Visually verify in browser**

Run: `cd /home/api/exnihilo/pax-imperia-clone/.claude/worktrees/floating-cooking-elephant && npm run dev`
Load a skirmish with mixed projectile weapons. Verify gauss rounds streak fast with long trails; siege shells crawl with short trails.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/screens/combat3d/CombatWeapons.tsx
git commit -m "feat: projectile trail length scales with muzzle velocity"
```

---

## Phase 2: Pitch Rate-Limiting and Rotational Inertia

**Why:** Yaw is rate-limited but pitch changes instantly. Ships have zero angular momentum — they stop rotating instantly when the desired heading is reached. These two physics inconsistencies undermine the Newtonian feel. Implementing them together (they both modify the same `moveToward` function and the `TacticalShip` interface) avoids double-touching.

### Task 2.1: Add pitch and angularVelocity fields to TacticalShip

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:346-410` (TacticalShip interface)
- Modify: `packages/shared/src/engine/combat-tactical.ts:2310-2370` (ship initialisation in initializeTacticalCombat)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('pitch rate-limiting', () => {
  it('ship pitch changes are limited by pitchRate per tick', () => {
    // A capital ship (low pitchRate) ordered to move to a target far above
    // should not reach full pitch in one tick
    const ship = makeShip({ maxHull: 500, pitchRate: 0.04 });
    // Target is directly above at z=500
    const moved = moveToward(ship, { x: ship.position.x, y: ship.position.y, z: 500 }, 5, [], []);
    expect(Math.abs(moved.currentPitch)).toBeLessThanOrEqual(0.04 + 0.001);
  });
});

describe('rotational inertia', () => {
  it('ship overshoots desired facing when turning hard', () => {
    // Ship facing 0, target at PI. After one tick, angularVelocity is non-zero.
    // After reaching desired facing, ship overshoots slightly before RCS kills angular velocity.
    const ship = makeShip({ facing: 0, angularVelocity: 0 });
    const target = { x: ship.position.x - 100, y: ship.position.y }; // behind
    const moved1 = moveToward(ship, target, 5, [], []);
    expect(moved1.angularVelocity).not.toBe(0);
  });

  it('RCS turn bonus increases angular deceleration rate', () => {
    const slowRCS = makeShip({ rcsThrust: 0.5, angularVelocity: 0.1 });
    const fastRCS = makeShip({ rcsThrust: 3.0, angularVelocity: 0.1 });
    // Both told to stop turning (desiredAngle === facing)
    // fastRCS should kill angular velocity quicker
    const s1 = applyAngularBraking(slowRCS);
    const s2 = applyAngularBraking(fastRCS);
    expect(Math.abs(s2.angularVelocity)).toBeLessThan(Math.abs(s1.angularVelocity));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts --reporter=verbose 2>&1 | tail -20`

- [ ] **Step 3: Add new fields to TacticalShip interface**

In `combat-tactical.ts`, inside the `TacticalShip` interface (line ~346), add:

```typescript
  /** Current pitch angle in radians (positive = nose-up). Rate-limited per tick. */
  currentPitch: number;
  /** Maximum pitch change per tick (radians). Derived from turnRate * 0.6. */
  pitchRate: number;
  /** Angular velocity around the yaw axis (radians/tick). Persists between ticks. */
  angularVelocity: number;
```

- [ ] **Step 4: Initialise new fields in initializeTacticalCombat**

In the ship object construction (~line 2313-2370), add:

```typescript
currentPitch: 0,
pitchRate: ((hullTemplate?.manned === false ? 0.20 : 0.10)
  / Math.max(1, Math.sqrt((ship.maxHullPoints + extracted.armour) / 100))
  * (1.0 + (extracted.rcsTurnBonus ?? 0) * 0.4)) * 0.6,
angularVelocity: 0,
```

The `pitchRate` is `turnRate * 0.6` — pitch gimbals are stiffer than yaw thrusters.

- [ ] **Step 5: Commit interface changes**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: add currentPitch, pitchRate, angularVelocity to TacticalShip"
```

### Task 2.2: Implement pitch rate-limiting in moveToward

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:3349-3523` (moveToward function)

- [ ] **Step 1: Replace instant pitch with rate-limited pitch**

In `moveToward()`, find the pitch calculation (~line 3403-3427). Currently:

```typescript
const desiredPitch = horizDist > 1 ? Math.atan2(dz, horizDist) : 0;
```

Replace the thrust decomposition to use `currentPitch` instead of `desiredPitch`:

```typescript
const desiredPitch = horizDist > 1 ? Math.atan2(dz, horizDist) : 0;
const pitchDiff = desiredPitch - ship.currentPitch;
const newPitch = ship.currentPitch + clamp(pitchDiff, -ship.pitchRate, ship.pitchRate);

// Thrust now uses newPitch instead of desiredPitch:
const cosPitch = Math.cos(newPitch);
newVx += Math.cos(thrustAngle) * cosPitch * accel * 0.3;
newVy += Math.sin(thrustAngle) * cosPitch * accel * 0.3;
newVz += Math.sin(newPitch) * accel * 0.3;
```

**Critical:** The `moveToward` return statement (~line 3517) currently returns `{ ...ship, facing: newFacing, velocity: { ... }, position: { ... } }`. You must add `currentPitch: newPitch` to this return object explicitly — the `...ship` spread carries the OLD pitch value, so the new one must override it.

- [ ] **Step 2: Run tests**

Run: `npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts --reporter=verbose 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts
git commit -m "feat: pitch rate-limiting — capital ships can't instantly redirect vertically"
```

### Task 2.3: Implement rotational inertia for yaw

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:3349-3523` (moveToward function, yaw section)

- [ ] **Step 1: Replace instant yaw with angular-velocity-based yaw**

In `moveToward()`, find the yaw section (~line 3390-3392). Currently:

```typescript
const angleDiff = normaliseAngle(desiredAngle - ship.facing);
const turnAmount = clamp(angleDiff, -ship.turnRate, ship.turnRate) * crewJitterMul;
const newFacing = normaliseAngle(ship.facing + turnAmount);
```

Replace with angular-velocity-based rotation:

```typescript
const angleDiff = normaliseAngle(desiredAngle - ship.facing);

// Compute desired angular acceleration (limited by turnRate as max angular accel)
const desiredAngAccel = clamp(angleDiff, -ship.turnRate, ship.turnRate) * crewJitterMul;

// Anticipatory braking: if angular velocity would overshoot, start braking
const angVel = ship.angularVelocity;
const stoppingAngle = (angVel * angVel) / (2 * ship.turnRate); // v^2/(2a)
const shouldBrake = Math.abs(angleDiff) < stoppingAngle * 1.2
                    && Math.sign(angVel) === Math.sign(angleDiff);

let newAngVel: number;
if (shouldBrake) {
  // Apply counter-thrust proportional to RCS quality
  const brakingAccel = ship.turnRate * (0.5 + (ship.rcsThrust / 5) * 0.5);
  newAngVel = angVel - Math.sign(angVel) * Math.min(brakingAccel, Math.abs(angVel));
} else {
  newAngVel = angVel + desiredAngAccel;
  // Cap angular velocity at turnRate * 2 to prevent runaway spin
  newAngVel = clamp(newAngVel, -ship.turnRate * 2, ship.turnRate * 2);
}

const newFacing = normaliseAngle(ship.facing + newAngVel);
```

**Critical:** Add `angularVelocity: newAngVel` to the `moveToward` return object (~line 3517), alongside the `currentPitch` added in Task 2.2. Both must explicitly override the `...ship` spread.

- [ ] **Step 2: Run tests**

Run: `npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts --reporter=verbose 2>&1 | tail -20`

- [ ] **Step 3: Run collision audit to check for regressions**

Run: `npx vitest run packages/shared/src/__tests__/collision-audit.test.ts --reporter=verbose 2>&1 | tail -40`

Verify: no increase in collision damage or ships destroyed by collision. Rotational inertia should not cause more collisions — the forward collision prediction and anti-bunching still apply.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: rotational inertia — ships overshoot turns, RCS kills angular momentum"
```

### Task 2.4: Update 3D visual layer for pitch from engine state

**Files:**
- Modify: `packages/client/src/ui/screens/combat3d/CombatShips.tsx:136-164`

- [ ] **Step 1: Use engine-authoritative pitch instead of deriving from velocity**

In `CombatShips.tsx`, the pitch is currently derived from velocity (~line 143):

```typescript
const rawPitch = horizSpeed > 0.1 ? Math.atan2(vz, horizSpeed) : 0;
```

Replace with the engine's authoritative pitch (which is now rate-limited):

```typescript
const rawPitch = ship.currentPitch ?? (horizSpeed > 0.1 ? Math.atan2(vz, horizSpeed) : 0);
```

The `TacticalShip` type (imported from `combat-tactical.ts`) now includes `currentPitch`, so no cast is needed. The fallback preserves backward compatibility if `currentPitch` is undefined (e.g. during save-load of older states).

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/ui/screens/combat3d/CombatShips.tsx
git commit -m "feat: 3D ships use engine-authoritative pitch instead of velocity-derived"
```

---

## Phase 3: Beam Weapon Improvements

**Why:** Three beam changes that share the same code path: sustained beam mode, beam collateral wiring, and inverse-square falloff. Batched into one phase because they all modify the beam firing section (~lines 4715-4785).

### Task 3.1: Wire in beam collateral damage

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:4715-4785` (beam firing section)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('beam collateral damage', () => {
  it('a missed beam can hit a bystander ship along its path', () => {
    // Place attacker, target, and a bystander in a line
    // Force the beam to miss (high evasion)
    // With seeded RNG, verify bystander takes collateral damage
    // at BEAM_COLLATERAL_CHANCE probability
  });

  it('beam collateral uses FRIENDLY_FIRE_BEAM_RADIUS for proximity', () => {
    // Bystander more than FRIENDLY_FIRE_BEAM_RADIUS away should not be hit
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Add collateral check after beam miss**

In the beam firing section (~line 4772), after the `if (shotHits)` block, add:

```typescript
if (!shotHits) {
  // Beam missed — check for collateral along the beam path
  if (Math.random() < BEAM_COLLATERAL_CHANCE) {
    const excludeIds = new Set([ship.id, weaponTarget.id]);
    const collateralShip = checkCollateralDamage(
      ship.position.x, ship.position.y,
      weaponTarget.position.x, weaponTarget.position.y,
      ships, excludeIds, FRIENDLY_FIRE_BEAM_RADIUS,
      ship.position.z, weaponTarget.position.z,
    );
    if (collateralShip) {
      const cidx = ships.indexOf(collateralShip);
      if (cidx >= 0) {
        pendingBeamDamage.push({ targetIdx: cidx, damage: beamDamage * 0.5, damageType: 'beam' });
      }
    }
  }
}
```

Collateral damage is half the original beam damage.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: wire in beam collateral damage — missed beams can clip bystanders"
```

### Task 3.2: Replace linear beam falloff with inverse-square

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:4756-4759`
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('beam inverse-square falloff', () => {
  it('beam at 75% range deals less than 50% damage', () => {
    // With inverse-square: (0.5/0.75)^2 = 0.44, so ~44% at 75% range
    // Old linear: 1.0 - (0.75 - 0.6) / 0.4 * 0.7 = 0.74 (74%)
    // Test that the new value is below 50%
  });

  it('beam at max range deals ~25% damage', () => {
    // (0.5/1.0)^2 = 0.25
  });

  it('beam within 50% range deals full damage', () => {
    // optimalRange = 0.5 * maxRange, so anything closer = 100%
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Replace falloff formula**

Replace lines 4756-4759:

```typescript
// OLD:
// if (rangeFraction > 0.6) {
//   const falloff = 1.0 - (rangeFraction - 0.6) / 0.4 * 0.7;
//   beamDamage *= Math.max(0.3, falloff);
// }

// NEW: Inverse-square falloff past optimal range (50% of max)
const optimalFraction = 0.5;
if (rangeFraction > optimalFraction) {
  const falloff = (optimalFraction / rangeFraction) ** 2;
  beamDamage *= Math.max(0.15, falloff); // floor at 15% (not zero)
}
```

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: beam inverse-square falloff — rewards closing to beam range"
```

### Task 3.3: Sustained beam mode for particle/plasma weapons

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:346-410` (TacticalWeapon interface area)
- Modify: `packages/shared/src/engine/combat-tactical.ts:2681-2692` (computeCooldown)
- Modify: `packages/shared/src/engine/combat-tactical.ts:4715-4785` (beam firing section)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('sustained beam mode', () => {
  it('particle beam fires for 4 ticks dealing 25% damage each tick', () => {
    // particle_beam_cannon should be sustained with 4 ticks
    // Total damage over 4 ticks = same as single-hit damage
  });

  it('sustained beam re-checks evasion each tick', () => {
    // A fast target should be able to break sustained beam mid-burst
    // Run 4 ticks, verify not all 4 deal damage when target is fast
  });

  it('pulse_laser fires as single-hit (not sustained)', () => {
    // Verify pulse weapons still work as before
  });

  it('sustained beam cooldown starts after burst completes', () => {
    // 4-tick burst + 10-tick cooldown = 14 ticks between first shot of each burst
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Add sustained beam constants and TacticalWeapon field**

After `BEAM_EFFECT_DURATION` (line 41), add:

```typescript
/** Sustained beam weapons fire for this many ticks per burst.
 *  Damage is divided equally across ticks. Each tick re-checks evasion. */
const SUSTAINED_BEAM_TICKS: Record<string, number> = {
  particle_beam_cannon: 4,
  plasma_lance: 5,
  radiation_ray: 3,
  disruptor_beam: 3,
};
```

Add to `TacticalWeapon` interface:

```typescript
/** Ticks remaining in a sustained beam burst (undefined = pulse weapon). */
sustainedTicksLeft?: number;
/** Ship ID being targeted by the sustained beam (locked for burst duration). */
sustainedTargetId?: string;
```

- [ ] **Step 4: Implement sustained beam logic in the firing section**

**Important:** The weapon loop at line 4588 uses `for (const weapon of ship.weapons)`. Since `const` cannot be reassigned, sustained beam state must be tracked via the `updatedWeapons` array that already collects modified weapon objects at the end of each iteration. Build a `weaponUpdate` partial object and merge it into the weapon when pushing to `updatedWeapons`.

In the beam branch (~line 4715), before the existing beam logic:

```typescript
// Check if this weapon is mid-burst (sustained beam)
if (weapon.sustainedTicksLeft != null && weapon.sustainedTicksLeft > 0) {
  // Continue sustained burst — find locked target, re-check evasion
  const lockedTarget = ships.find(s => s.id === weapon.sustainedTargetId && !s.destroyed && !s.routed);
  if (!lockedTarget) {
    // Target lost — end burst early, start cooldown
    updatedWeapons.push({ ...weapon, sustainedTicksLeft: undefined, sustainedTargetId: undefined, cooldownLeft: weapon.cooldownMax });
    continue;
  }
  // Re-check evasion (same logic as single-hit, applied to lockedTarget)
  // ... (extract the evasion check into a helper or inline it)
  // Damage = total damage / burst ticks
  const burstTicks = SUSTAINED_BEAM_TICKS[weapon.componentId] ?? 1;
  const tickDamage = weapon.damage / burstTicks;
  // Apply tickDamage if evasion check passes
  const newTicksLeft = weapon.sustainedTicksLeft - 1;
  updatedWeapons.push({
    ...weapon,
    sustainedTicksLeft: newTicksLeft > 0 ? newTicksLeft : undefined,
    sustainedTargetId: newTicksLeft > 0 ? weapon.sustainedTargetId : undefined,
    cooldownLeft: newTicksLeft > 0 ? 0 : weapon.cooldownMax, // cooldown starts after burst ends
  });
  // NOTE for Phase 5 integration: if capacitor system is active, sustained
  // continuation ticks do NOT drain additional capacitor — energy is committed
  // at burst start only. The capacitor check must be placed BEFORE this block.
  continue; // skip normal firing logic
}

// New burst start: check if this is a sustained weapon
const sustainTicks = SUSTAINED_BEAM_TICKS[weapon.componentId];
if (sustainTicks) {
  // Start sustained burst — first tick processes via normal beam logic below
  // but with per-tick damage. Remaining ticks handled by the block above.
  // The weapon update with sustainedTicksLeft is pushed at the end of this iteration.
}
// When pushing to updatedWeapons at end of iteration, include:
// sustainedTicksLeft: sustainTicks ? sustainTicks - 1 : undefined,
// sustainedTargetId: sustainTicks ? weaponTarget.id : undefined,
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts --reporter=verbose 2>&1 | tail -30`

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: sustained beam mode — particle/plasma beams fire multi-tick bursts"
```

---

## Phase 4: Collision System Improvements

**Why:** Three collision improvements that share the collision resolution code path: route collision damage through `applyDamage` (shields matter), spawn wreckage obstacles, and stance-aware spacing.

### Task 4.1: Route collision damage through applyDamage

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:4180-4191` (collision damage application)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('collision damage goes through shields', () => {
  it('shields absorb portion of collision damage as kinetic type', () => {
    // Two ships with shields collide at high speed
    // Verify shield HP decreases and hull damage is reduced
    const a = makeShip({ shields: 100, maxShields: 100, shieldAge: 'nano_atomic' });
    const b = makeShip({ shields: 100, maxShields: 100, shieldAge: 'nano_atomic' });
    // Collide them — verify shields took some damage
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Replace direct hull damage with applyDamage call**

In the collision damage application section (~line 4180), replace:

```typescript
// OLD:
const newHull = Math.max(0, s.hull - cd.damage);
ships[cd.shipIdx] = {
  ...s, hull: newHull, destroyed: newHull <= 0, damageTakenThisTick: s.damageTakenThisTick + cd.damage,
};

// NEW:
ships[cd.shipIdx] = applyDamage(s, cd.damage, 'kinetic');
```

This routes collision damage through the full shield/armour/hull pipeline with `'kinetic'` damage type. Shield effectiveness against kinetic varies by tech age (already defined in `SHIELD_EFFECTIVENESS`).

- [ ] **Step 4: Run tests**

Run both the collision tests and the collision audit:
```bash
npx vitest run packages/shared/src/__tests__/combat-tactical.test.ts --reporter=verbose 2>&1 | tail -20
npx vitest run packages/shared/src/__tests__/collision-audit.test.ts --reporter=verbose 2>&1 | tail -40
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: collision damage routes through shields/armour as kinetic damage"
```

### Task 4.2: Add time-based wreckage dissipation to existing debris system

**Context:** Ship destruction already spawns debris at lines 4890-4948 of `combat-tactical.ts`. The existing system creates hull-class-scaled debris pieces with velocity inheritance and scatter patterns. However, debris currently only disappears by drifting off the battlefield edge. This task adds time-based expiry so wreckage dissipates naturally, creating evolving battlefield terrain.

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:474-483` (EnvironmentFeature interface)
- Modify: `packages/shared/src/engine/combat-tactical.ts:4890-4948` (existing debris spawn)
- Modify: `packages/shared/src/engine/combat-tactical.ts` (environment update step in processTacticalTick)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('wreckage dissipation', () => {
  it('debris from destroyed ships has a ticksRemaining field', () => {
    // Destroy a ship, check that newly spawned debris features have ticksRemaining
    const debrisBefore = state.environment.filter(e => e.type === 'debris').length;
    // ... kill a ship ...
    const newDebris = newState.environment.filter(e => e.type === 'debris').slice(debrisBefore);
    expect(newDebris.every(d => d.ticksRemaining != null)).toBe(true);
  });

  it('debris ticksRemaining decrements each tick', () => {
    // Advance one tick, check ticksRemaining decreased by 1
  });

  it('debris is removed when ticksRemaining reaches 0', () => {
    // Advance WRECKAGE_LIFETIME ticks, check debris is gone
  });

  it('pre-placed asteroid/nebula features do not dissipate', () => {
    // Asteroids and nebulae have no ticksRemaining, should persist forever
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Add ticksRemaining to EnvironmentFeature interface**

At `combat-tactical.ts:474` (the `EnvironmentFeature` interface), add:

```typescript
/** Remaining ticks before this feature dissipates (undefined = permanent). */
ticksRemaining?: number;
```

Note: `EnvironmentFeature` uses flat `x`, `y` fields (not `position: { x, y }`). All debris creation must use `x:` and `y:` directly.

- [ ] **Step 4: Add wreckage lifetime constant and set ticksRemaining on debris spawn**

After the environment hazard constants (~line 192):

```typescript
/** Ticks before combat wreckage dissipates. Larger debris lingers longer. */
const WRECKAGE_BASE_LIFETIME = 40;
```

In the existing debris spawn loop (~line 4930-4945), add `ticksRemaining` to each debris piece. Scale lifetime by hull class — capital ship wreckage persists longer:

```typescript
// Inside the debris piece creation, add to the object literal:
ticksRemaining: WRECKAGE_BASE_LIFETIME + Math.floor(r * 2), // larger pieces linger longer
```

- [ ] **Step 5: Add dissipation tick-down in the environment update step**

In `processTacticalTick`, in the environment processing section (where `newEnvironment` is updated each tick), add before the existing drift/boundary logic:

```typescript
// Tick down debris lifetime and remove expired wreckage
newEnvironment = newEnvironment
  .map(f => f.ticksRemaining != null ? { ...f, ticksRemaining: f.ticksRemaining - 1 } : f)
  .filter(f => f.ticksRemaining == null || f.ticksRemaining > 0);
```

This preserves asteroids and nebulae (no `ticksRemaining`) while removing expired debris.

- [ ] **Step 6: Run tests**

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: wreckage debris dissipates over time — evolving battlefield terrain"
```

### Task 4.3: Stance-aware formation spacing

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:3059-3088` (anti-bunching in moveShip)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('stance-aware spacing', () => {
  it('defensive stance ships cluster tighter than aggressive', () => {
    const defShip = makeShip({ stance: 'defensive', maxHull: 150 });
    const aggShip = makeShip({ stance: 'aggressive', maxHull: 150 });
    const defSpacing = getEffectiveSpacing(defShip);
    const aggSpacing = getEffectiveSpacing(aggShip);
    expect(defSpacing).toBeLessThan(aggSpacing);
  });

  it('evasive stance ships spread widest', () => {
    const evShip = makeShip({ stance: 'evasive', maxHull: 150 });
    const aggShip = makeShip({ stance: 'aggressive', maxHull: 150 });
    expect(getEffectiveSpacing(evShip)).toBeGreaterThan(getEffectiveSpacing(aggShip));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add stance multipliers to anti-bunching**

In `moveShip`, replace the `MINIMUM_ALLY_SPACING` section (~line 3059):

```typescript
// Stance-aware spacing: defensive clusters for mutual PD coverage,
// aggressive spreads for independent action, evasive needs room to manoeuvre.
// 'flee' uses 1.0 — fleeing ships don't care about spacing (they're leaving).
const STANCE_SPACING_MULT: Record<CombatStance, number> = {
  aggressive: 1.3,
  defensive: 0.7,
  at_ease: 1.0,
  evasive: 1.5,
  flee: 1.0,
};
const baseSpacing = ship.maxHull < 80 ? 40
  : ship.maxHull < 200 ? 70
  : ship.maxHull < 400 ? 120
  : 180;
let effectiveSpacing = baseSpacing * (STANCE_SPACING_MULT[ship.stance] ?? 1.0);

// Ships with a defend order cluster tighter around their charge
if (ship.order.type === 'defend') {
  effectiveSpacing *= 0.6;
}
```

Then use `effectiveSpacing` instead of `MINIMUM_ALLY_SPACING` in the anti-bunching distance check below. Rename all references in the loop body.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Run collision audit to verify no regression**

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: stance-aware formation spacing — defensive clusters, evasive spreads"
```

---

## Phase 5: Power Capacitor System

**Why:** Weapons currently have no energy cost — fire everything every cooldown cycle forever. Adding a capacitor system gives the `power_reactor` component (which exists but has no tactical combat effect) a real purpose and creates fire-management decisions.

### Task 5.1: Add capacitor fields and initialisation

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:346-410` (TacticalShip interface)
- Modify: `packages/shared/src/engine/combat-tactical.ts:2310-2370` (ship init)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('power capacitor', () => {
  it('ship starts with full capacitor', () => {
    const state = initializeTacticalCombat(setup, components);
    const ship = state.ships[0];
    expect(ship.capacitor).toBe(ship.maxCapacitor);
    expect(ship.maxCapacitor).toBeGreaterThan(0);
  });

  it('capacitor recharges by rechargeRate per tick', () => {
    const ship = makeShip({ capacitor: 50, maxCapacitor: 100, capacitorRecharge: 5 });
    // After one tick with no firing, capacitor should be 55
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add capacitor fields to TacticalShip**

```typescript
  /** Current power capacitor charge. Weapons drain this; reactors recharge it. */
  capacitor: number;
  /** Maximum capacitor capacity — determined by power_reactor components. */
  maxCapacitor: number;
  /** Capacitor recharge rate per tick — determined by power_reactor output. */
  capacitorRecharge: number;
```

- [ ] **Step 4: Extend ExtractedStats and extractShipStats for power_reactor**

In `combat-tactical.ts`, the `ExtractedStats` interface (~line 2471 area — find it by searching for `interface ExtractedStats` or the return type of `extractShipStats`) needs two new fields:

```typescript
maxCapacitor: number;
capacitorRecharge: number;
```

Initialise both to 0 at the top of `extractShipStats`. Add the new `case` in the `switch (comp.type)` block (~line 2600):

```typescript
case 'power_reactor':
  maxCapacitor += comp.stats['capacity'] ?? 50;
  capacitorRecharge += comp.stats['rechargeRate'] ?? 3;
  break;
```

Add them to the return object of `extractShipStats`.

In `initializeTacticalCombat` ship construction (~line 2314), default for ships with no reactor:

```typescript
capacitor: extracted.maxCapacitor || 80,
maxCapacitor: extracted.maxCapacitor || 80,
capacitorRecharge: extracted.capacitorRecharge || 4,
```

- [ ] **Step 5: Add capacitor recharge in processTacticalTick**

In the per-tick ship update (before weapon firing), add:

```typescript
// Recharge capacitor
if (ship.capacitor < ship.maxCapacitor) {
  ship = { ...ship, capacitor: Math.min(ship.maxCapacitor, ship.capacitor + ship.capacitorRecharge) };
}
```

- [ ] **Step 6: Run tests**

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: power capacitor — ships have energy reserves that recharge per tick"
```

### Task 5.2: Weapons drain capacitor on fire

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts` (weapon firing in processTacticalTick)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe('weapon energy cost', () => {
  it('beam weapons drain more capacitor than projectile weapons', () => {
    // Fire a beam, check capacitor decreased by beam cost
    // Fire a projectile, check capacitor decreased by projectile cost (less)
  });

  it('weapon cannot fire when capacitor is below cost', () => {
    const ship = makeShip({ capacitor: 1, maxCapacitor: 100 });
    // Weapon with cost 10 should not fire
    // Cooldown should not reset (weapon waits for energy)
  });

  it('alpha-striking all weapons drains capacitor rapidly', () => {
    // Ship with 4 beam weapons, fire all simultaneously
    // Capacitor should drop by 4x beam cost
    // Next tick may not have enough to fire again
  });
});
```

- [ ] **Step 2: Run test to verify they fail**

- [ ] **Step 3: Add energy cost constants**

After the cooldown constants:

```typescript
/** Energy cost per weapon fire, by weapon type. */
const WEAPON_ENERGY_COST: Record<WeaponType, number> = {
  beam: 12,           // high — energy weapons
  projectile: 4,      // low — mostly kinetic, just loader/targeting
  missile: 8,         // moderate — launch systems and targeting
  point_defense: 3,   // low — rapid fire, small draw
  fighter_bay: 6,     // moderate — catapult/tractor
};
```

- [ ] **Step 4: Add capacitor check and drain to weapon firing**

In the weapon firing loop, **after** the cooldown check but **before** the sustained beam continuation block (if Phase 3 is implemented). The placement matters:

```typescript
// After cooldown check (line ~4598) and before weapon type branching:
const energyCost = WEAPON_ENERGY_COST[weapon.type as WeaponType] ?? 5;

// Sustained beam continuation ticks do NOT drain capacitor — energy was
// committed at burst start. Only check capacitor for new fires.
const isSustainedContinuation = weapon.sustainedTicksLeft != null && weapon.sustainedTicksLeft > 0;
if (!isSustainedContinuation && currentShip.capacitor < energyCost) {
  // Not enough energy — skip firing, don't reset cooldown
  continue;
}
if (!isSustainedContinuation) {
  // Drain capacitor for new fires only
  currentShip = { ...currentShip, capacitor: currentShip.capacitor - energyCost };
}
```

If Phase 3 (sustained beams) has not been implemented, simplify by removing the `isSustainedContinuation` checks — `sustainedTicksLeft` will always be undefined.

- [ ] **Step 5: Run tests**

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: weapons drain power capacitor — alpha strikes have energy cost"
```

---

## Phase 6: Graduated Lead Prediction and Dynamic Mass

**Why:** Two smaller changes that improve realism. Recruit lead prediction currently means "aim at current position" (zero lead), making recruits useless at range. Mass doesn't change with damage, ignoring the physics of losing armour plates.

### Task 6.1: Graduated lead prediction with Gaussian error

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:916-953` (computeLeadAngle)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('graduated lead prediction', () => {
  it('recruit crews lead shots but with significant error', () => {
    // Previously: recruit leadQuality=0.0 meant aim at current position (no lead)
    // Now: always compute perfect lead, add Gaussian error scaled by (1-quality)
    // A recruit aiming at a moving target should lead, but inaccurately
    // Test: lead angle is non-zero for recruit against a moving target
  });

  it('legendary crews have near-zero lead error', () => {
    // Lead angle should be very close to perfect intercept
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Replace linear interpolation with always-lead + error**

In `computeLeadAngle()` (~line 916), replace:

```typescript
// OLD: interpolate between no-lead and perfect-lead
// const blended = currentAngle + (interceptAngle - currentAngle) * leadQuality;

// NEW: always aim at intercept, add Gaussian error scaled by inexperience
const leadError = (1.0 - leadQuality) * 0.15; // max error ~0.15 radians at quality 0
// Box-Muller transform for Gaussian noise
const u1 = Math.random();
const u2 = Math.random();
const gaussian = Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2);
const errorAngle = gaussian * leadError;
const blended = interceptAngle + errorAngle;
```

This means recruits always aim ahead of the target but over/undershoot semi-randomly. The 0.15-radian max error at quality 0 is roughly 8.6 degrees — enough to frequently miss at long range but occasionally land hits.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: graduated lead prediction — recruits bracket, veterans aim precisely"
```

### Task 6.2: Dynamic mass — damaged ships become lighter

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:3349-3523` (moveToward, where accel is used)
- Test: `packages/shared/src/__tests__/combat-tactical.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe('dynamic mass from hull damage', () => {
  it('a heavily damaged ship accelerates faster than a fresh one', () => {
    const fresh = makeShip({ hull: 500, maxHull: 500, armour: 100 });
    const damaged = makeShip({ hull: 50, maxHull: 500, armour: 10 });
    // Same engine, less mass — damaged ship should have higher effective acceleration
    const freshAccel = getEffectiveAcceleration(fresh);
    const damagedAccel = getEffectiveAcceleration(damaged);
    expect(damagedAccel).toBeGreaterThan(freshAccel);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Compute effective acceleration from current hull**

In `moveToward()`, at the point where `ship.acceleration` is used for thrust (~line 3420), compute a dynamic acceleration:

```typescript
// Dynamic mass: damaged ships lose structure (lighter = faster accel, but fragile).
// The original acceleration was computed as: speed / sqrt((maxHull + armour_init) / 50)
// Re-derive using current hull + current armour as effective mass.
const currentMass = Math.max(1, ship.hull + ship.armour);
const originalMass = Math.max(1, ship.maxHull + ship.armour); // armour on TacticalShip is current, not max
// Since accel ∝ 1/sqrt(mass), ratio = sqrt(originalMass / currentMass)
const massRatio = Math.sqrt(originalMass / currentMass);
const effectiveAccel = ship.acceleration * Math.min(1.8, massRatio); // cap at 1.8x to prevent extremes
```

Note: `ship.armour` on `TacticalShip` is the current (degraded) armour value, not the initial value. The `originalMass` here uses the current armour as a conservative baseline. This means the acceleration boost from armour loss is slightly underestimated, which is fine — it prevents extreme values.

Then use `effectiveAccel` instead of `ship.acceleration` for thrust.

- [ ] **Step 4: Run tests and collision audit**

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts packages/shared/src/__tests__/combat-tactical.test.ts
git commit -m "feat: dynamic mass — damaged ships shed armour, accelerate faster"
```

---

## Phase Summary

| Phase | Tasks | Estimated Complexity | Dependencies |
|---|---|---|---|
| 1: Projectile Speeds | 1.1, 1.2 | Low | None |
| 2: Pitch/Rotation | 2.1, 2.2, 2.3, 2.4 | Medium | None |
| 3: Beam Improvements | 3.1, 3.2, 3.3 | Medium | None |
| 4: Collision Improvements | 4.1, 4.2, 4.3 | Medium | None |
| 5: Power Capacitor | 5.1, 5.2 | Medium | Phase 3 (sustained beam capacitor interaction) |
| 6: Lead/Mass | 6.1, 6.2 | Low | None (mild merge conflict with Phase 2 in moveToward) |

**Parallelisation guide:**
- Phases 1, 3, 4 are fully independent — safe to run in parallel.
- Phase 5 must follow Phase 3 (capacitor must account for sustained beam continuation ticks).
- Phases 2 and 6 both modify `moveToward` — run sequentially or expect mechanical merge conflicts.
- Within each phase, tasks are sequential.

**Not included in this plan** (deferred to a future plan as they require more design work):
- Oriented bounding boxes (OBB) for collision — needs profiling to validate performance
- Ram prow component — needs new component type in `components.json` and species balance pass
- Fleet transit interpolation on galaxy map — touches a different subsystem entirely (`fleet.ts` + `GalaxyMap3D.tsx`)
