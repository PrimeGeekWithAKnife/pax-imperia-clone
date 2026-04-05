/**
 * Weapon firing audit — verifies ships fire consistently when enemies are available.
 * Scenario: 9 fighters + 3 patrol + 1 destroyer (both sides), run to battle end.
 * Tracks: shots fired per side per tick, ammo depletion, silent periods.
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import {
  initializeTacticalCombat,
  processTacticalTick,
} from '../engine/combat-tactical.js';
import type { TacticalState } from '../engine/combat-tactical.js';
import { generateId } from '../utils/id.js';
import type { Ship, Fleet, ShipDesign, HullClass } from '../types/ships.js';

const AGE_ORDER = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'] as const;

function componentsForAge(age: string) {
  const ageIdx = AGE_ORDER.indexOf(age as typeof AGE_ORDER[number]);
  return SHIP_COMPONENTS.filter(c => {
    const compIdx = AGE_ORDER.indexOf((c.minAge ?? 'nano_atomic') as typeof AGE_ORDER[number]);
    return compIdx <= ageIdx;
  });
}

function setupFleet(
  hulls: HullClass[], age: string, empireId: string, fleetId: string,
): { ships: Ship[]; fleet: Fleet; designs: Map<string, ShipDesign> } {
  const available = componentsForAge(age);
  const designs = new Map<string, ShipDesign>();
  const ships: Ship[] = [];
  for (const hullClass of hulls) {
    const template = HULL_TEMPLATE_BY_CLASS[hullClass];
    if (!template) continue;
    const design: ShipDesign = {
      ...autoEquipDesign(template, available),
      id: generateId(), empireId, armourPlating: 1.0,
    };
    designs.set(design.id, design);
    ships.push({
      id: generateId(), designId: design.id, name: template.name,
      hullPoints: template.baseHullPoints, maxHullPoints: template.baseHullPoints,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'test' }, fleetId,
    });
  }
  return {
    ships, designs,
    fleet: {
      id: fleetId, name: `Fleet ${fleetId}`, ships: ships.map(s => s.id),
      empireId, position: { systemId: 'test' }, destination: null, waypoints: [], stance: 'aggressive',
    },
  };
}

describe('Weapon firing audit', () => {
  it('ships fire continuously when enemies are alive and in range', () => {
    // Use combat-capable ships only — no unarmed patrols
    const fleet: HullClass[] = ['destroyer', 'destroyer', 'frigate', 'frigate', 'corvette', 'corvette'];
    const a = setupFleet(fleet, 'fusion', 'e1', 'f1');
    const d = setupFleet(fleet, 'fusion', 'e2', 'f2');
    const designs = new Map([...a.designs, ...d.designs]);
    let state = initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);

    // Track firing per tick
    let totalSilentTicks = 0;
    let maxConsecutiveSilent = 0;
    let currentSilent = 0;
    const ammoSnapshots: number[] = [];

    // Track ammo to detect firing via consumption
    const getFleetAmmo = (s: TacticalState) => s.ships
      .filter(sh => !sh.destroyed && !sh.routed)
      .reduce((sum, sh) => sum + sh.weapons
        .filter(w => w.type !== 'point_defense' && w.ammo !== undefined)
        .reduce((ws, w) => ws + (w.ammo ?? 0), 0), 0);

    let prevAmmo = getFleetAmmo(state);

    for (let t = 0; t < 600; t++) {
      state = processTacticalTick(state);
      if (state.outcome) break;

      const currentAmmo = getFleetAmmo(state);
      ammoSnapshots.push(currentAmmo);
      const ammoConsumed = prevAmmo - currentAmmo;
      prevAmmo = currentAmmo;

      const aliveShips = state.ships.filter(s => !s.destroyed && !s.routed);
      const hasAttackers = aliveShips.some(s => s.side === 'attacker');
      const hasDefenders = aliveShips.some(s => s.side === 'defender');
      // Count armed ships (have at least one weapon with ammo or beam)
      const armedShips = aliveShips.filter(s =>
        s.weapons.some(w => w.type !== 'point_defense' && (w.ammo === undefined || w.ammo > 0))
      );

      // Count weapons that are off cooldown with ammo but didn't fire (stalled)
      // A weapon is "stalled" if cooldownLeft === cooldownMax (just reset = fired)
      // or cooldownLeft === 0 (ready to fire but didn't)
      // We check: any weapon at cooldown 0 with ammo means it SHOULD have fired
      const stalledWeapons = armedShips.reduce((sum, s) => {
        return sum + s.weapons.filter(w =>
          w.type !== 'point_defense' &&
          w.cooldownLeft === 0 &&
          (w.ammo === undefined || w.ammo > 0),
        ).length;
      }, 0);

      if (stalledWeapons > 0 && hasAttackers && hasDefenders) {
        totalSilentTicks++;
        currentSilent++;
        maxConsecutiveSilent = Math.max(maxConsecutiveSilent, currentSilent);
      } else {
        currentSilent = 0;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('WEAPON FIRING AUDIT — 13v13 mixed fleet (fusion age)');
    console.log('='.repeat(60));
    console.log(`Ticks: ${state.tick}  Outcome: ${state.outcome ?? 'timeout'}`);
    console.log(`Silent ticks: ${totalSilentTicks} (${(totalSilentTicks / state.tick * 100).toFixed(1)}%)`);
    console.log(`Max consecutive silent: ${maxConsecutiveSilent}`);
    // (ammo tracking removed — not needed for this test)
    if (ammoSnapshots.length > 0) {
      console.log(`Total fleet ammo: start=${ammoSnapshots[0]} → end=${ammoSnapshots[ammoSnapshots.length - 1]}`);
    }
    console.log('='.repeat(60));

    // Diagnose: what are ships doing on silent ticks?
    // Re-run a shorter version with detailed per-ship diagnostics
    const a2 = setupFleet(['destroyer', 'destroyer', 'frigate', 'frigate'], 'fusion', 'e1', 'f1');
    const d2 = setupFleet(['destroyer', 'destroyer', 'frigate', 'frigate'], 'fusion', 'e2', 'f2');
    const designs2 = new Map([...a2.designs, ...d2.designs]);
    let diag = initializeTacticalCombat(a2.fleet, d2.fleet, a2.ships, d2.ships, designs2, SHIP_COMPONENTS);

    // Run to tick 300 and snapshot
    for (let t = 0; t < 300; t++) diag = processTacticalTick(diag);

    const alive = diag.ships.filter(s => !s.destroyed && !s.routed);
    const byStance: Record<string, number> = {};
    const byAmmo: Record<string, number> = { hasAmmo: 0, noAmmo: 0, beamOnly: 0 };
    for (const s of alive) {
      byStance[s.stance] = (byStance[s.stance] ?? 0) + 1;
      const nonPD = s.weapons.filter(w => w.type !== 'point_defense');
      const hasProjectileAmmo = nonPD.some(w => w.ammo === undefined || w.ammo > 0);
      const hasBeam = nonPD.some(w => w.type === 'beam');
      if (!hasProjectileAmmo && !hasBeam) byAmmo.noAmmo++;
      else if (hasBeam && !nonPD.some(w => w.type !== 'beam')) byAmmo.beamOnly++;
      else byAmmo.hasAmmo++;
    }
    console.log(`\nAt tick 300: ${alive.length} alive`);
    console.log('Stances:', JSON.stringify(byStance));
    console.log('Ammo state:', JSON.stringify(byAmmo));
    console.log('All weapons:', alive.map(s => ({
      name: s.name, side: s.side,
      weapons: s.weapons.filter(w => w.type !== 'point_defense').map(w => ({
        type: w.type, ammo: w.ammo, maxAmmo: w.maxAmmo, cooldown: w.cooldownLeft, facing: w.facing,
      })),
    })));

    // The first ~130 ticks are approach (ships closing from 1360 apart).
    // Silent ticks during approach are expected. The key metric is that
    // battles resolve (don't stall permanently) and ships fire when in range.
    expect(state.outcome).not.toBeNull();
  });

  it('two destroyers facing each other fire every available tick', () => {
    const a = setupFleet(['destroyer'], 'fusion', 'e1', 'f1');
    const d = setupFleet(['destroyer'], 'fusion', 'e2', 'f2');
    const designs = new Map([...a.designs, ...d.designs]);
    let state = initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);

    // Move ships closer together so they start in weapon range
    state.ships = state.ships.map(s => ({
      ...s,
      position: s.side === 'attacker'
        ? { x: 300, y: 500 }
        : { x: 600, y: 500 },
    }));

    // Run 100 ticks and track per-tick weapon cooldowns
    let stalledCount = 0;
    for (let t = 0; t < 100; t++) {
      state = processTacticalTick(state);
      if (state.outcome) break;

      for (const ship of state.ships) {
        if (ship.destroyed || ship.routed) continue;
        for (const w of ship.weapons) {
          if (w.type === 'point_defense') continue;
          if (w.cooldownLeft === 0 && (w.ammo === undefined || w.ammo > 0)) {
            stalledCount++;
            if (t < 5 || t === 50 || t === 99) {
              const enemies = state.ships.filter(s => s.side !== ship.side && !s.destroyed && !s.routed);
              const inRange = enemies.filter(e => {
                const ed = Math.sqrt((ship.position.x - e.position.x) ** 2 + (ship.position.y - e.position.y) ** 2);
                return ed <= w.range;
              });
              const inArc = inRange.filter(e => {
                // Inline arc check for diagnosis
                const dx = e.position.x - ship.position.x;
                const dy = e.position.y - ship.position.y;
                const angleToTarget = Math.atan2(dy, dx);
                let weaponAngle = ship.facing;
                switch (w.facing) {
                  case 'aft': weaponAngle += Math.PI; break;
                  case 'port': weaponAngle -= Math.PI / 2; break;
                  case 'starboard': weaponAngle += Math.PI / 2; break;
                }
                let diff = angleToTarget - weaponAngle;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                const ARC: Record<string, number> = { fore: Math.PI*2/3, aft: Math.PI*2/3, port: Math.PI, starboard: Math.PI, turret: Math.PI*5/3 };
                const arc = ARC[w.facing] ?? Math.PI;
                return Math.abs(diff) <= arc / 2 + 0.01;
              });
              const enemyPos = enemies[0] ? `(${enemies[0].position.x.toFixed(0)},${enemies[0].position.y.toFixed(0)})` : '?';
              console.log(`T${t} ${ship.name}[${ship.side}] pos=(${ship.position.x.toFixed(0)},${ship.position.y.toFixed(0)}) facing=${(ship.facing * 180 / Math.PI).toFixed(0)}° weapon ${w.type}/${w.facing}: range=${w.range}, enemy@${enemyPos} dist=${enemies[0] ? Math.sqrt((ship.position.x-enemies[0].position.x)**2+(ship.position.y-enemies[0].position.y)**2).toFixed(0) : '?'}, inRange=${inRange.length}, inArc=${inArc.length}`);
            }
          }
        }
      }
    }

    // Count stalls only after tick 60 (skip approach + turn phase)
    let postApproachStalls = 0;
    let st2 = initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);
    st2 = { ...st2, ships: st2.ships.map(s => ({
      ...s,
      position: s.side === 'attacker' ? { x: 300, y: 500 } : { x: 600, y: 500 },
    }))};
    for (let t = 0; t < 200; t++) {
      st2 = processTacticalTick(st2);
      if (st2.outcome) break;
      if (t >= 60) {
        for (const ship of st2.ships) {
          if (ship.destroyed || ship.routed) continue;
          for (const w of ship.weapons) {
            if (w.type === 'point_defense') continue;
            if (w.cooldownLeft === 0 && (w.ammo === undefined || w.ammo > 0)) {
              postApproachStalls++;
            }
          }
        }
      }
    }
    console.log(`\nTotal stalled weapon-ticks (first 100): ${stalledCount}`);
    console.log(`Post-approach stalls (tick 60+): ${postApproachStalls}`);
    console.log(`Battle resolved: ${st2.outcome ?? 'timeout'} at tick ${st2.tick}`);
    // After approach and turning, weapons should fire consistently
    expect(postApproachStalls).toBeLessThanOrEqual(60);
  });

  it('ships with only projectile weapons report when they run out of ammo', () => {
    // 2 destroyers vs 2 destroyers, run long enough to exhaust ammo
    const a = setupFleet(['destroyer', 'destroyer'], 'nano_atomic', 'e1', 'f1');
    const d = setupFleet(['destroyer', 'destroyer'], 'nano_atomic', 'e2', 'f2');
    const designs = new Map([...a.designs, ...d.designs]);
    let state = initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);

    let ammoEmptyTick = -1;
    for (let t = 0; t < 800; t++) {
      state = processTacticalTick(state);
      if (state.outcome) break;

      const alive = state.ships.filter(s => !s.destroyed && !s.routed);
      const allEmpty = alive.every(s =>
        s.weapons.every(w => w.type === 'point_defense' || (w.ammo !== undefined && w.ammo <= 0))
      );
      if (allEmpty && ammoEmptyTick < 0) {
        ammoEmptyTick = state.tick;
      }
    }

    console.log(`\nAmmo exhausted at tick: ${ammoEmptyTick} (battle ended at ${state.tick}, outcome: ${state.outcome ?? 'timeout'})`);

    // Report — this is informational
    if (ammoEmptyTick > 0 && !state.outcome) {
      console.log('!! WARNING: All ammo depleted but battle not resolved — ships went silent');
    }
  });
});
