/**
 * Weapon-debug diagnostic: 5 battleships vs 5 battleships at singularity age.
 *
 * Runs 200 ticks and logs per-tick weapon firing statistics for each ship:
 * - total weapons, weapons that fired, capacitor level
 * - position relative to nearest enemy
 * - reasons weapons didn't fire: cooldown, out of range, out of arc, low capacitor, no target
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import {
  initializeTacticalCombat,
  processTacticalTick,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '../engine/combat-tactical.js';
import type { TacticalState, TacticalShip, TacticalWeapon } from '../engine/combat-tactical.js';
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

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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
      id: generateId(),
      empireId,
      armourPlating: 1.0,
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

describe('Weapon debug: 5 BB vs 5 BB singularity', () => {
  it('should diagnose weapon firing bottlenecks over 200 ticks', () => {
    const a = setupFleet(
      ['battleship', 'battleship', 'battleship', 'battleship', 'battleship'],
      'singularity', 'e1', 'f1',
    );
    const d = setupFleet(
      ['battleship', 'battleship', 'battleship', 'battleship', 'battleship'],
      'singularity', 'e2', 'f2',
    );
    const designs = new Map([...a.designs, ...d.designs]);
    let state = initializeTacticalCombat(
      a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS,
    );

    // Print initial setup
    console.log('\n=== INITIAL SETUP ===');
    for (const ship of state.ships) {
      const weaponTypes = ship.weapons
        .filter(w => w.type !== 'point_defense')
        .map(w => `${w.componentId}(dmg=${w.damage},rng=${w.range},cd=${w.cooldownMax},arc=${w.facing},cost=${w.type === 'beam' ? 12 : w.type === 'projectile' ? 4 : w.type === 'missile' ? 8 : 5})`);
      console.log(`  ${ship.name} [${ship.side}] id=${ship.id.slice(0, 8)}`);
      console.log(`    pos=(${ship.position.x.toFixed(0)},${ship.position.y.toFixed(0)})`);
      console.log(`    hull=${ship.hull}/${ship.maxHull} shields=${ship.shields}/${ship.maxShields}`);
      console.log(`    capacitor=${ship.capacitor}/${ship.maxCapacitor} recharge=${ship.capacitorRecharge}/tick`);
      console.log(`    weapons (${ship.weapons.length} total, ${ship.weapons.filter(w => w.type !== 'point_defense').length} offensive):`);
      for (const wt of weaponTypes) {
        console.log(`      ${wt}`);
      }
    }

    // Track cumulative stats
    interface ShipStats {
      totalWeaponFireOpportunities: number;
      weaponsFired: number;
      skippedCooldown: number;
      skippedRange: number;
      skippedArc: number;
      skippedCapacitor: number;
      skippedNoTarget: number;
      skippedPD: number;
      minCapacitor: number;
      maxCapacitor: number;
      capacitorSum: number;
      ticks: number;
    }
    const stats = new Map<string, ShipStats>();
    for (const ship of state.ships) {
      stats.set(ship.id, {
        totalWeaponFireOpportunities: 0,
        weaponsFired: 0,
        skippedCooldown: 0,
        skippedRange: 0,
        skippedArc: 0,
        skippedCapacitor: 0,
        skippedNoTarget: 0,
        skippedPD: 0,
        minCapacitor: ship.capacitor,
        maxCapacitor: ship.capacitor,
        capacitorSum: 0,
        ticks: 0,
      });
    }

    const TICKS = 200;
    for (let tick = 0; tick < TICKS; tick++) {
      // Snapshot weapons BEFORE tick processing to compare
      const prevWeapons = new Map<string, TacticalWeapon[]>();
      for (const ship of state.ships) {
        if (ship.destroyed || ship.routed) continue;
        prevWeapons.set(ship.id, ship.weapons.map(w => ({ ...w })));
      }
      const prevCapacitors = new Map<string, number>();
      for (const ship of state.ships) {
        if (ship.destroyed || ship.routed) continue;
        prevCapacitors.set(ship.id, ship.capacitor);
      }

      state = processTacticalTick(state);

      // Compare after tick
      for (const ship of state.ships) {
        if (ship.destroyed || ship.routed) continue;
        const s = stats.get(ship.id);
        if (!s) continue;
        s.ticks++;
        s.capacitorSum += ship.capacitor;
        if (ship.capacitor < s.minCapacitor) s.minCapacitor = ship.capacitor;
        if (ship.capacitor > s.maxCapacitor) s.maxCapacitor = ship.capacitor;

        const prev = prevWeapons.get(ship.id);
        if (!prev) continue;

        // Find nearest enemy
        const enemies = state.ships.filter(e => e.side !== ship.side && !e.destroyed && !e.routed);
        const nearestEnemy = enemies.length > 0
          ? enemies.reduce((best, e) => {
              const d1 = dist(ship.position, e.position);
              const d2 = dist(ship.position, best.position);
              return d1 < d2 ? e : best;
            })
          : null;
        const nearestDist = nearestEnemy ? dist(ship.position, nearestEnemy.position) : Infinity;

        for (let wi = 0; wi < ship.weapons.length; wi++) {
          const curr = ship.weapons[wi]!;
          const old = prev[wi];
          if (!old) continue;
          if (curr.type === 'point_defense') {
            s.skippedPD++;
            continue;
          }

          s.totalWeaponFireOpportunities++;

          // Determine if the weapon fired: cooldown was reset from 0 to cooldownMax
          const wasCooledDown = old.cooldownLeft <= 0;
          const justFired = wasCooledDown && curr.cooldownLeft > 0;

          if (justFired) {
            s.weaponsFired++;
          } else if (!wasCooledDown) {
            s.skippedCooldown++;
          } else {
            // Was off cooldown but didn't fire -- why?
            if (nearestEnemy === null) {
              s.skippedNoTarget++;
            } else if (nearestDist > curr.range * 1.2) {
              // Generous range check (hull-adjusted range in engine is tighter)
              s.skippedRange++;
            } else {
              // Could be arc, capacitor, or other
              const prevCap = prevCapacitors.get(ship.id) ?? 0;
              const ENERGY_COSTS: Record<string, number> = {
                beam: 12, projectile: 4, missile: 8, fighter_bay: 6,
              };
              const cost = ENERGY_COSTS[curr.type] ?? 5;
              if (prevCap < cost) {
                s.skippedCapacitor++;
              } else {
                s.skippedArc++;
              }
            }
          }
        }
      }
    }

    // Print summary
    console.log('\n=== 200-TICK WEAPON FIRING SUMMARY ===');
    let totalOpportunities = 0;
    let totalFired = 0;
    let totalSkippedCooldown = 0;
    let totalSkippedCapacitor = 0;
    let totalSkippedRange = 0;
    let totalSkippedArc = 0;
    let totalSkippedNoTarget = 0;

    for (const ship of state.ships) {
      const s = stats.get(ship.id);
      if (!s || s.ticks === 0) continue;
      const avgCap = s.capacitorSum / s.ticks;
      const fireRate = s.totalWeaponFireOpportunities > 0
        ? ((s.weaponsFired / s.totalWeaponFireOpportunities) * 100).toFixed(1)
        : '0.0';
      console.log(`\n  ${ship.name} [${ship.side}] (${ship.destroyed ? 'DESTROYED' : 'alive'}, survived ${s.ticks} ticks)`);
      console.log(`    Hull: ${ship.hull.toFixed(0)}/${ship.maxHull}`);
      console.log(`    Capacitor: avg=${avgCap.toFixed(1)} min=${s.minCapacitor.toFixed(1)} max=${s.maxCapacitor.toFixed(1)}`);
      console.log(`    Weapon opportunities: ${s.totalWeaponFireOpportunities}`);
      console.log(`    Fired: ${s.weaponsFired} (${fireRate}%)`);
      console.log(`    Skipped - cooldown: ${s.skippedCooldown}`);
      console.log(`    Skipped - out of range: ${s.skippedRange}`);
      console.log(`    Skipped - out of arc/other: ${s.skippedArc}`);
      console.log(`    Skipped - low capacitor: ${s.skippedCapacitor}`);
      console.log(`    Skipped - no target: ${s.skippedNoTarget}`);
      console.log(`    Skipped - point defence (ignored): ${s.skippedPD}`);

      totalOpportunities += s.totalWeaponFireOpportunities;
      totalFired += s.weaponsFired;
      totalSkippedCooldown += s.skippedCooldown;
      totalSkippedCapacitor += s.skippedCapacitor;
      totalSkippedRange += s.skippedRange;
      totalSkippedArc += s.skippedArc;
      totalSkippedNoTarget += s.skippedNoTarget;
    }

    console.log('\n=== AGGREGATE ===');
    console.log(`  Total weapon-tick opportunities: ${totalOpportunities}`);
    console.log(`  Total fired: ${totalFired} (${totalOpportunities > 0 ? ((totalFired / totalOpportunities) * 100).toFixed(1) : 0}%)`);
    console.log(`  Skipped - cooldown: ${totalSkippedCooldown} (${totalOpportunities > 0 ? ((totalSkippedCooldown / totalOpportunities) * 100).toFixed(1) : 0}%)`);
    console.log(`  Skipped - out of range: ${totalSkippedRange} (${totalOpportunities > 0 ? ((totalSkippedRange / totalOpportunities) * 100).toFixed(1) : 0}%)`);
    console.log(`  Skipped - arc/other: ${totalSkippedArc} (${totalOpportunities > 0 ? ((totalSkippedArc / totalOpportunities) * 100).toFixed(1) : 0}%)`);
    console.log(`  Skipped - low capacitor: ${totalSkippedCapacitor} (${totalOpportunities > 0 ? ((totalSkippedCapacitor / totalOpportunities) * 100).toFixed(1) : 0}%)`);
    console.log(`  Skipped - no target: ${totalSkippedNoTarget} (${totalOpportunities > 0 ? ((totalSkippedNoTarget / totalOpportunities) * 100).toFixed(1) : 0}%)`);

    // Final state
    console.log('\n=== FINAL STATE ===');
    for (const ship of state.ships) {
      const alive = !ship.destroyed && !ship.routed;
      console.log(`  ${ship.name} [${ship.side}]: ${alive ? 'ALIVE' : 'DEAD/ROUTED'} hull=${ship.hull.toFixed(0)}/${ship.maxHull}`);
    }

    // The test always passes — it's diagnostic
    expect(true).toBe(true);
  });
});
