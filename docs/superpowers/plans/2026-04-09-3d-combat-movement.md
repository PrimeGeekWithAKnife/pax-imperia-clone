# 3D Combat Movement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Z-axis (height/altitude) to tactical combat so ships move in full 3D space, collisions deal mass-based damage, and movement AI uses vertical displacement to avoid bunching.

**Architecture:** All position/velocity types gain an optional `z` field defaulting to 0. The core `dist()` function becomes 3D-aware. Movement steering uses Z as an escape vector when ships are too close. Collisions deal damage proportional to closing speed and mass ratio. The renderer maps tactical Z to Three.js Y (the vertical axis).

**Tech Stack:** TypeScript (shared engine + React Three Fiber client)

---

## File Map

| File | Role | Changes |
|------|------|---------|
| `packages/shared/src/engine/combat-tactical.ts` | Tactical combat engine (~4100 lines) | Core types, dist(), movement, collision, hit detection, spawning, boundaries |
| `packages/client/src/ui/screens/combat3d/constants.ts` | 3D coordinate mapping | `tacticalTo3D()` gains Z parameter, `shipYOffset()` replaced |
| `packages/client/src/ui/screens/combat3d/CombatShips.tsx` | Ship rendering | Use Z for Y position instead of `shipYOffset` |
| `packages/client/src/ui/screens/combat3d/CombatWeapons.tsx` | Weapon effects | Pass Z to beam/projectile/missile positions |
| `packages/client/src/ui/screens/combat3d/CombatEffects.tsx` | VFX (thrust, explosions, fighters) | Pass Z to all effect positions |
| `packages/client/src/ui/screens/combat3d/CombatInput.tsx` | Click-to-tactical mapping | Move orders default to Z=0 (ground plane) |

---

### Task 1: Add Z to Core Types and dist()

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:230-276` (TacticalShip)
- Modify: `packages/shared/src/engine/combat-tactical.ts:278-306` (Projectile, Missile)
- Modify: `packages/shared/src/engine/combat-tactical.ts:315-327` (Fighter)
- Modify: `packages/shared/src/engine/combat-tactical.ts:391-399` (EscapePod)
- Modify: `packages/shared/src/engine/combat-tactical.ts:494` (dist function)

The strategy is to make `z` **optional and defaulting to 0** on all position types. This means every existing callsite continues to work — z is simply absent (treated as 0) until we add it.

- [ ] **Step 1: Add z to TacticalShip position and velocity**

On the `TacticalShip` interface (~line 235-236), change:
```typescript
position: { x: number; y: number };
velocity: { x: number; y: number };
```
to:
```typescript
position: { x: number; y: number; z: number };
velocity: { x: number; y: number; z: number };
```

- [ ] **Step 2: Add z to Projectile position**

On the `Projectile` interface (~line 279), change:
```typescript
position: { x: number; y: number };
```
to:
```typescript
position: { x: number; y: number; z: number };
```
Also add `pitch: number;` field (angle above/below horizontal, 0 = level) alongside the existing `angle` field.

- [ ] **Step 3: Add z to Missile**

On the `Missile` interface (~line 288), add after `y`:
```typescript
z: number;
pitch: number;  // vertical angle, 0 = level, positive = climbing
```

- [ ] **Step 4: Add z to Fighter**

On the `Fighter` interface (~line 315), add after `y`:
```typescript
z: number;
```

- [ ] **Step 5: Add z to EscapePod**

On the `EscapePod` interface (~line 391), add after `vy`:
```typescript
z: number;
vz: number;
```

- [ ] **Step 6: Update dist() to 3D**

The `dist()` function (~line 494) currently computes:
```typescript
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

Change to handle optional z:
```typescript
function dist(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.z ?? 0) - (a.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
```

This is the single highest-leverage change — ~80 callsites instantly become 3D-aware when positions have z values.

- [ ] **Step 7: Add z to ShipOrder move target**

On the `ShipOrder` type (~line 209), change:
```typescript
| { type: 'move'; x: number; y: number }
```
to:
```typescript
| { type: 'move'; x: number; y: number; z?: number }
```

- [ ] **Step 8: Add z to FormationPosition**

On `FormationPosition` (~line 374), add:
```typescript
offsetZ: number;  // height offset from formation centre
```

- [ ] **Step 9: Fix all type errors from adding z**

Search for every place that constructs `position: { x: ..., y: ... }` or `velocity: { x: ..., y: ... }` and add `z: 0`. Key locations:
- `initializeTacticalCombat()` ship spawn (~line 1915): add `z: 0` to position and velocity
- Orbital defence spawn (~line 1978): add `z: 0`
- Projectile creation (~line 3724): add `z: 0` to position, `pitch: 0`
- Missile creation (~line 3702): add `z: 0, pitch: 0`
- Fighter creation: add `z: 0`
- EscapePod creation: add `z: 0, vz: 0`
- All `{ ...ship.position }` spreads: these will automatically include z if present
- Collision resolution position copies (~line 3174): add `z` field

Run `npm run build` and fix every remaining type error until clean.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts
git commit -m "feat: add z-axis to all tactical combat position/velocity types"
```

---

### Task 2: 3D Movement — moveToward() and Steering

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:2795-2903` (moveToward)
- Modify: `packages/shared/src/engine/combat-tactical.ts:2535-2575` (anti-bunching)
- Modify: `packages/shared/src/engine/combat-tactical.ts:2746` (holdAndFace)

- [ ] **Step 1: Update moveToward() thrust and velocity to 3D**

The function computes thrust as `cos(angle)*accel, sin(angle)*accel` (lines 2860-2861). This is a 2D unit direction. Change to a 3D direction vector.

After computing the desired 2D angle to the target, add a desired Z component based on the target's z:
```typescript
// Desired direction as 3D unit vector
const desiredDx = Math.cos(finalAngle);
const desiredDy = Math.sin(finalAngle);
const targetDz = ((target as any).z ?? 0) - (ship.position.z ?? 0);
const horizDist = Math.sqrt(
  (target.x - ship.position.x) ** 2 + (target.y - ship.position.y) ** 2,
);
const desiredDz = horizDist > 1 ? targetDz / Math.sqrt(horizDist * horizDist + targetDz * targetDz) : 0;
// Normalise the 3D direction
const dirLen = Math.sqrt(desiredDx * desiredDx + desiredDy * desiredDy + desiredDz * desiredDz);
const ndx = desiredDx / dirLen;
const ndy = desiredDy / dirLen;
const ndz = desiredDz / dirLen;

// Apply thrust in 3D
let nvx = ship.velocity.x + ndx * effectiveAccel;
let nvy = ship.velocity.y + ndy * effectiveAccel;
let nvz = (ship.velocity.z ?? 0) + ndz * effectiveAccel;
```

Update the velocity clamping to include z:
```typescript
const newSpeedSq = nvx * nvx + nvy * nvy + nvz * nvz;
if (newSpeedSq > ship.speed * ship.speed) {
  const s = ship.speed / Math.sqrt(newSpeedSq);
  nvx *= s; nvy *= s; nvz *= s;
}
```

Update the position return:
```typescript
position: { x: ship.position.x + nvx, y: ship.position.y + nvy, z: ship.position.z + nvz },
velocity: { x: nvx, y: nvy, z: nvz },
```

- [ ] **Step 2: Update holdAndFace() for 3D velocity**

The `holdAndFace()` function (~line 2746) brakes using 2D velocity. Add z braking:
```typescript
let nvz = ship.velocity.z ?? 0;
// Brake Z velocity with RCS
if (Math.abs(nvz) > 0.01) {
  const zBrake = Math.min(Math.abs(nvz), rcsThrust);
  nvz -= Math.sign(nvz) * zBrake;
}
```
Return updated velocity with z, position with z.

- [ ] **Step 3: Update anti-bunching to use Z as escape vector**

The ally spacing code (~line 2535) computes a 2D repulsion vector. Add Z-axis avoidance — when ships are too close, steer vertically apart:

```typescript
let spreadX = 0;
let spreadY = 0;
let spreadZ = 0;  // NEW: vertical escape

for (const ally of allies) {
  const allyDist = dist(ship.position, ally.position);
  if (allyDist < MINIMUM_ALLY_SPACING && allyDist > 1) {
    const t = (MINIMUM_ALLY_SPACING - allyDist) / MINIMUM_ALLY_SPACING;
    const pushStrength = t * t * 8;
    spreadX += (ship.position.x - ally.position.x) / allyDist * pushStrength;
    spreadY += (ship.position.y - ally.position.y) / allyDist * pushStrength;
    // Vertical escape: push up if ally is below, down if above
    // If at same Z, alternate based on ship ID hash for determinism
    const dz = (ship.position.z ?? 0) - (ally.position.z ?? 0);
    if (Math.abs(dz) < 5) {
      // Same altitude — escape vertically based on relative position
      const zDir = ship.id > ally.id ? 1 : -1;
      spreadZ += zDir * pushStrength * 1.5;  // prefer vertical escape
    } else {
      spreadZ += (dz / Math.abs(dz)) * pushStrength;
    }
  }
}
```

Pass `z` when calling moveToward:
```typescript
return moveToward(updated, {
  x: target.position.x + spreadX,
  y: target.position.y + spreadY,
  z: (target.position.z ?? 0) + spreadZ,
}, engageDistance(ship), state.environment, state.ships);
```

- [ ] **Step 4: Add altitude damping toward Z=0**

Ships should gently return toward the combat plane (z=0) when not actively avoiding collisions. In `moveToward()`, after computing thrust, add a gentle z-return force:
```typescript
// Gently return toward z=0 when not actively evading
const currentZ = ship.position.z ?? 0;
if (Math.abs(currentZ) > 5) {
  const zReturn = -Math.sign(currentZ) * ship.acceleration * 0.15;
  nvz += zReturn;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts
git commit -m "feat: 3D movement — moveToward, holdAndFace, anti-bunching use Z axis"
```

---

### Task 3: Collision Damage and Avoidance

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:3169-3215` (collision resolution)
- Modify: `packages/shared/src/engine/combat-tactical.ts:2795-2903` (moveToward obstacle avoidance)

- [ ] **Step 1: Add collision damage to the collision resolution pass**

Currently collisions only push ships apart. Add damage based on closing speed and mass ratio. In the collision loop (~line 3188), after detecting overlap:

```typescript
if (distSq < minDist * minDist && distSq > 0.01) {
  const d = Math.sqrt(distSq);
  const overlap = minDist - d;
  const nx = dx / d;
  const ny = dy / d;
  const nz = dz / d;

  // --- Collision damage (NEW) ---
  // Closing speed: relative velocity projected onto collision normal
  const relVx = (b.velocity?.x ?? 0) - (a.velocity?.x ?? 0);
  const relVy = (b.velocity?.y ?? 0) - (a.velocity?.y ?? 0);
  const relVz = (b.velocity?.z ?? 0) - (a.velocity?.z ?? 0);
  const closingSpeed = Math.abs(relVx * nx + relVy * ny + relVz * nz);

  if (closingSpeed > 0.5 && iter === 0) {  // only apply damage on first iteration
    // Damage scales with closing speed and mass ratio
    // Lighter ship takes proportionally more damage
    const totalMass = a.maxHull + b.maxHull;
    const impactEnergy = closingSpeed * closingSpeed * 0.8;
    // Ship A damage: proportional to B's mass fraction * impact energy
    const aDmg = Math.floor(impactEnergy * (b.maxHull / totalMass));
    const bDmg = Math.floor(impactEnergy * (a.maxHull / totalMass));
    if (aDmg > 0) collisionDamage.push({ shipIdx: i, damage: aDmg });
    if (bDmg > 0) collisionDamage.push({ shipIdx: j, damage: bDmg });
  }

  // --- Push apart (existing, now with Z) ---
  const totalMass = a.maxHull + b.maxHull;
  const aFrac = b.maxHull / totalMass;
  const bFrac = a.maxHull / totalMass;
  const pushEach = overlap * 0.5;

  positions[i].x -= nx * pushEach * aFrac;
  positions[i].y -= ny * pushEach * aFrac;
  positions[i].z -= nz * pushEach * aFrac;
  positions[j].x += nx * pushEach * bFrac;
  positions[j].y += ny * pushEach * bFrac;
  positions[j].z += nz * pushEach * bFrac;
}
```

Declare `const collisionDamage: { shipIdx: number; damage: number }[] = [];` before the loop. After the loop, apply damage:
```typescript
for (const cd of collisionDamage) {
  const s = ships[cd.shipIdx];
  const newHull = Math.max(0, s.hull - cd.damage);
  ships[cd.shipIdx] = {
    ...s,
    hull: newHull,
    destroyed: newHull <= 0 ? true : s.destroyed,
    damageTakenThisTick: s.damageTakenThisTick + cd.damage,
  };
}
```

- [ ] **Step 2: Add forward collision avoidance to moveToward()**

In `moveToward()`, after computing the desired direction but before applying thrust, scan for ships ahead and steer vertically to avoid:

```typescript
// Forward collision scan — steer vertically to avoid head-on collisions
if (allShips) {
  const lookAhead = ship.speed * 8;  // scan 8 ticks ahead
  for (const other of allShips) {
    if (other.id === ship.id || other.destroyed || other.routed) continue;
    const otherDist = dist(ship.position, other.position);
    if (otherDist > lookAhead || otherDist < 1) continue;

    // Check if we're heading toward this ship
    const toOtherX = other.position.x - ship.position.x;
    const toOtherY = other.position.y - ship.position.y;
    const toOtherZ = (other.position.z ?? 0) - (ship.position.z ?? 0);
    const toOtherLen = otherDist;
    const dotVel = (ship.velocity.x * toOtherX + ship.velocity.y * toOtherY +
                    (ship.velocity.z ?? 0) * toOtherZ) / toOtherLen;

    if (dotVel > 0) {  // approaching
      const minSep = (ship.collisionRadius + (other.collisionRadius ?? 10)) * 1.5;
      // Perpendicular distance to collision course
      const perpDist = Math.sqrt(Math.max(0, otherDist * otherDist - dotVel * dotVel));
      if (perpDist < minSep) {
        // Steer vertically away — urgency increases with proximity
        const urgency = 1 - (otherDist / lookAhead);
        const escapeZ = toOtherZ >= 0 ? -1 : 1;  // go opposite direction
        ndz += escapeZ * urgency * 2.0;
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts
git commit -m "feat: collision damage based on mass/speed + forward collision avoidance steering"
```

---

### Task 4: Update Hit Detection for 3D

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:3217-3438` (projectiles and missiles)
- Modify: `packages/shared/src/engine/combat-tactical.ts:517-537` (pointToSegmentDistance)
- Modify: `packages/shared/src/engine/combat-tactical.ts:3440-3568` (PD and fighters)

- [ ] **Step 1: Update projectile movement to 3D**

Projectile position update (~line 3238):
```typescript
const newX = proj.position.x + Math.cos(proj.angle) * Math.cos(proj.pitch ?? 0) * proj.speed;
const newY = proj.position.y + Math.sin(proj.angle) * Math.cos(proj.pitch ?? 0) * proj.speed;
const newZ = (proj.position.z ?? 0) + Math.sin(proj.pitch ?? 0) * proj.speed;
```

Projectile hit detection already uses `dist()` which is now 3D — just ensure the position objects passed include z.

- [ ] **Step 2: Update missile movement and tracking to 3D**

Missile position update (~line 3418):
```typescript
const newX = m.x + Math.cos(m.heading) * Math.cos(m.pitch ?? 0) * m.speed;
const newY = m.y + Math.sin(m.heading) * Math.cos(m.pitch ?? 0) * m.speed;
const newZ = (m.z ?? 0) + Math.sin(m.pitch ?? 0) * m.speed;
```

Missile tracking (heading adjustment toward target, ~line 3361): also adjust pitch toward target:
```typescript
const targetZ = target.position.z ?? 0;
const missileZ = m.z ?? 0;
const horizDist = Math.sqrt((target.position.x - m.x) ** 2 + (target.position.y - m.y) ** 2);
const desiredPitch = Math.atan2(targetZ - missileZ, horizDist);
const maxPitchTurn = 0.1;  // radians per tick
const pitchDiff = desiredPitch - (m.pitch ?? 0);
const newPitch = (m.pitch ?? 0) + clamp(pitchDiff, -maxPitchTurn, maxPitchTurn);
```

- [ ] **Step 3: Update pointToSegmentDistance to 3D**

The beam collateral function (~line 517) uses 2D segment math. Add z:
```typescript
function pointToSegmentDistance(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 0.001) return Math.sqrt(apx * apx + apy * apy + apz * apz);
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq));
  const cx = ax + t * abx - px;
  const cy = ay + t * aby - py;
  const cz = az + t * abz - pz;
  return Math.sqrt(cx * cx + cy * cy + cz * cz);
}
```

Update all callsites of `pointToSegmentDistance` to pass z coordinates (from `position.z ?? 0`).

- [ ] **Step 4: Update fighter and escape pod movement**

Fighter movement (~line 3552): add z to position update.
Escape pod movement (~line 4040): add z and vz.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts
git commit -m "feat: 3D hit detection — projectiles, missiles, beams, PD use Z axis"
```

---

### Task 5: Spawning, Boundaries, and Battlefield

**Files:**
- Modify: `packages/shared/src/engine/combat-tactical.ts:1797-1946` (initializeTacticalCombat)
- Modify: `packages/shared/src/engine/combat-tactical.ts:3063-4073` (processTacticalTick boundary checks)

- [ ] **Step 1: Set battlefield Z bounds**

Near the battlefield size constants (~line 354), add a Z dimension:
```typescript
small:  { width: 1600, height: 1000, depth: 400 },
medium: { width: 2800, height: 1750, depth: 600 },
large:  { width: 4800, height: 3000, depth: 800 },
```

Add `battlefieldDepth: number` to `TacticalState` interface.

- [ ] **Step 2: Spawn ships at z=0**

In `initializeTacticalCombat()`, all ships spawn at z=0 with vz=0 (already done in Task 1 step 9). Verify all spawn paths include z.

- [ ] **Step 3: Add Z boundary checks**

Every boundary check that tests x/y limits also needs to test z. The Z boundary should be symmetric: `-depth/2` to `+depth/2` (centred on the combat plane).

Flee/routed check (~line 2430): add z bounds test.
Projectile bounds (~line 3248): add z bounds test.
Missile bounds (~line 3333): add z bounds test.
Escape pod bounds (~line 4046): add z bounds test.
Fighter clamps: add z clamping.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/engine/combat-tactical.ts
git commit -m "feat: battlefield Z dimension — depth bounds, spawn at z=0, boundary enforcement"
```

---

### Task 6: Renderer — Map Tactical Z to 3D Y

**Files:**
- Modify: `packages/client/src/ui/screens/combat3d/constants.ts:25-52`
- Modify: `packages/client/src/ui/screens/combat3d/CombatShips.tsx:131-132`
- Modify: `packages/client/src/ui/screens/combat3d/CombatWeapons.tsx` (beam/projectile/missile positions)
- Modify: `packages/client/src/ui/screens/combat3d/CombatEffects.tsx` (thrust, fighters, explosions, pods)
- Modify: `packages/client/src/ui/screens/combat3d/CombatInput.tsx:57-72`

- [ ] **Step 1: Update tacticalTo3D to accept Z**

```typescript
export function tacticalTo3D(
  engineX: number,
  engineY: number,
  bfWidth: number = BATTLEFIELD_WIDTH,
  bfHeight: number = BATTLEFIELD_HEIGHT,
  out?: THREE.Vector3,
  engineZ: number = 0,
): THREE.Vector3 {
  const v = out ?? new THREE.Vector3();
  v.x = (engineX - bfWidth / 2) * BF_SCALE;
  v.y = engineZ * BF_SCALE;  // tactical Z -> Three.js Y (up)
  v.z = (engineY - bfHeight / 2) * BF_SCALE;
  return v;
}
```

- [ ] **Step 2: Remove shipYOffset() — replaced by actual Z**

Delete the `shipYOffset()` function entirely. In `CombatShips.tsx`, replace:
```typescript
tacticalTo3D(ship.position.x, ship.position.y, bfWidth, bfHeight, _tmpShipPos);
groupRef.current.position.set(_tmpShipPos.x, yOff, _tmpShipPos.z);
```
with:
```typescript
tacticalTo3D(ship.position.x, ship.position.y, bfWidth, bfHeight, _tmpShipPos, ship.position.z ?? 0);
groupRef.current.position.set(_tmpShipPos.x, _tmpShipPos.y, _tmpShipPos.z);
```

Remove the `yOff` variable and `shipYOffset` import.

- [ ] **Step 3: Update CombatWeapons.tsx shipPos3D helper**

The `shipPos3D()` function (~line 38) currently uses `shipYOffset`:
```typescript
_shipPosOut.y = shipYOffset(ship.maxHull);
```
Change to:
```typescript
tacticalTo3D(ship.position.x, ship.position.y, bfW, bfH, _shipPosOut, ship.position.z ?? 0);
```

Do the same for all `tacticalTo3D` calls in CombatWeapons — add the z parameter from the entity's z field.

- [ ] **Step 4: Update CombatEffects.tsx positions**

Every `tacticalTo3D()` call in CombatEffects needs the Z parameter. For entities with flat `x, y, z` fields (fighters, missiles, escape pods), pass the z field directly. For ships, pass `ship.position.z ?? 0`.

- [ ] **Step 5: Update CombatInput click mapping**

The reverse mapping (3D click -> tactical coords, ~line 57-72 of CombatInput.tsx) currently returns `{ x, y }`. Add `z: 0` — click orders always target the ground plane:
```typescript
return {
  x: intersection.x / BF_SCALE + api.state.battlefieldWidth / 2,
  y: intersection.z / BF_SCALE + api.state.battlefieldHeight / 2,
  z: 0,
};
```

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

Fix any remaining type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/ui/screens/combat3d/ packages/shared/src/engine/combat-tactical.ts
git commit -m "feat: renderer maps tactical Z to 3D vertical axis — true 3D ship positions"
```

---

## Verification

1. `npm run build` — clean build, no type errors
2. Deploy to dev, start a skirmish combat
3. **Visual check:** Ships should spread vertically when bunching occurs — visible as ships at different heights
4. **Collision damage:** Ships that ram into each other should take hull damage (check health bars)
5. **Anti-bunching:** Formations should be looser — ships use altitude to maintain spacing instead of only horizontal spreading
6. **Weapons:** Beams, projectiles, and missiles should track correctly to targets at different altitudes
7. **Performance:** 30+ ships per side should maintain 30+ FPS (the Z-axis additions are O(1) per entity per tick)
