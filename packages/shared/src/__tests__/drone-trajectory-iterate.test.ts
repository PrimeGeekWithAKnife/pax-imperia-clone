/**
 * 100-iteration drone trajectory audit.
 *
 * Scenario: 9 drones vs 1 light cruiser (nano_fusion age).
 * Measures per-battle: survival rate, approach casualties, orbit quality,
 * through-target events, clumping, and oscillation detection.
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, HULL_TEMPLATES, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import {
  initializeTacticalCombat,
  processTacticalTick,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '../engine/combat-tactical.js';
import type { TacticalState, TacticalShip } from '../engine/combat-tactical.js';
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

interface IterationResult {
  outcome: string | null;
  ticks: number;
  dronesAliveAtEnd: number;
  dronesSurvivingApproach: number;  // alive at tick 30
  throughTarget: number;
  clumpTicks: number;               // tick-observations where 2+ drones <15 apart
  oscillations: number;             // direction reversals > 4 in 10 ticks
  maxMissilesInFlight: number;
  missilesExpired: number;          // missiles that ran out of fuel
  dronesFled: number;
  dronesRouted: number;
  crashed: boolean;
}

function runIteration(): IterationResult {
  const a = setupFleet(
    ['drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone'],
    'nano_fusion', 'e1', 'f1',
  );
  const d = setupFleet(['light_cruiser'], 'nano_fusion', 'e2', 'f2');
  const designs = new Map([...a.designs, ...d.designs]);
  let state = initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);

  const result: IterationResult = {
    outcome: null, ticks: 0, dronesAliveAtEnd: 0, dronesSurvivingApproach: 0,
    throughTarget: 0, clumpTicks: 0, oscillations: 0,
    maxMissilesInFlight: 0, missilesExpired: 0, dronesFled: 0, dronesRouted: 0, crashed: false,
  };

  // Track velocity direction history for oscillation detection
  const velHistory: Record<string, number[]> = {};
  let prevMissileCount = 0;

  try {
    for (let t = 0; t < 600; t++) {
      state = processTacticalTick(state);
      result.ticks = state.tick;

      const missileCount = (state.missiles ?? []).length;
      result.maxMissilesInFlight = Math.max(result.maxMissilesInFlight, missileCount);
      // Detect expired missiles (count decreased without hit events)
      if (missileCount < prevMissileCount) {
        // Some missiles disappeared — could be hits or fuel expiry
        // We count the difference as a rough proxy
      }
      prevMissileCount = missileCount;

      const drones = state.ships.filter(s => s.side === 'attacker' && !s.destroyed);
      const cruiser = state.ships.find(s => s.side === 'defender' && !s.destroyed);

      if (state.tick === 30) {
        result.dronesSurvivingApproach = drones.length;
      }

      // Check fled/routed drones
      for (const drone of drones) {
        if (drone.routed) result.dronesRouted++;
        if (drone.stance === 'flee' || drone.order.type === 'flee') result.dronesFled++;
      }

      // Through-target
      if (cruiser) {
        for (const drone of drones.filter(d => !d.routed)) {
          if (dist(drone.position, cruiser.position) < 10) {
            result.throughTarget++;
          }
        }
      }

      // Clumping
      for (let i = 0; i < drones.length; i++) {
        for (let j = i + 1; j < drones.length; j++) {
          if (dist(drones[i]!.position, drones[j]!.position) < 15) {
            result.clumpTicks++;
          }
        }
      }

      // Oscillation detection — track velocity angle, flag rapid reversals
      for (const drone of drones) {
        const vAngle = Math.atan2(drone.velocity?.y ?? 0, drone.velocity?.x ?? 0);
        if (!velHistory[drone.id]) velHistory[drone.id] = [];
        velHistory[drone.id]!.push(vAngle);
        const hist = velHistory[drone.id]!;
        if (hist.length > 10) {
          hist.shift();
          // Count direction reversals (>90° change between consecutive ticks)
          let reversals = 0;
          for (let k = 1; k < hist.length; k++) {
            const diff = Math.abs(hist[k]! - hist[k - 1]!);
            const normDiff = diff > Math.PI ? 2 * Math.PI - diff : diff;
            if (normDiff > Math.PI / 2) reversals++;
          }
          if (reversals >= 4) result.oscillations++;
        }
      }

      if (state.outcome) {
        result.outcome = state.outcome;
        break;
      }
    }

    result.dronesAliveAtEnd = state.ships.filter(
      s => s.side === 'attacker' && !s.destroyed && !s.routed,
    ).length;

  } catch (err) {
    result.crashed = true;
  }

  return result;
}

describe('Drone trajectory iteration — 9 drones vs light cruiser x100', () => {
  it('runs 100 iterations and reports aggregate stats', () => {
    const results: IterationResult[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(runIteration());
    }

    const wins = results.filter(r => r.outcome === 'attacker_wins').length;
    const losses = results.filter(r => r.outcome === 'defender_wins').length;
    const timeouts = results.filter(r => r.outcome === null).length;
    const crashes = results.filter(r => r.crashed).length;
    const avgTicks = results.reduce((s, r) => s + r.ticks, 0) / results.length;
    const avgSurvApproach = results.reduce((s, r) => s + r.dronesSurvivingApproach, 0) / results.length;
    const avgAliveEnd = results.reduce((s, r) => s + r.dronesAliveAtEnd, 0) / results.length;
    const totalThrough = results.reduce((s, r) => s + r.throughTarget, 0);
    const totalClumps = results.reduce((s, r) => s + r.clumpTicks, 0);
    const totalOscillations = results.reduce((s, r) => s + r.oscillations, 0);
    const totalFled = results.reduce((s, r) => s + r.dronesFled, 0);
    const totalRouted = results.reduce((s, r) => s + r.dronesRouted, 0);
    const maxMissiles = Math.max(...results.map(r => r.maxMissilesInFlight));

    console.log(`\n${'='.repeat(60)}`);
    console.log('9 DRONES vs LIGHT CRUISER — 100 iterations');
    console.log('='.repeat(60));
    console.log(`Outcomes:     ${wins} drone wins, ${losses} cruiser wins, ${timeouts} timeouts, ${crashes} crashes`);
    console.log(`Avg ticks:    ${avgTicks.toFixed(0)}`);
    console.log(`Approach:     ${avgSurvApproach.toFixed(1)}/9 survive to tick 30`);
    console.log(`End:          ${avgAliveEnd.toFixed(1)}/9 alive at battle end`);
    console.log(`Through-tgt:  ${totalThrough} total (${(totalThrough / 100).toFixed(1)}/battle)`);
    console.log(`Clumping:     ${totalClumps} total (${(totalClumps / 100).toFixed(0)}/battle)`);
    console.log(`Oscillations: ${totalOscillations} total (${(totalOscillations / 100).toFixed(0)}/battle)`);
    console.log(`Fled/Routed:  ${totalFled} fled, ${totalRouted} routed`);
    console.log(`Max missiles: ${maxMissiles} in flight at once`);
    console.log('='.repeat(60));

    // Hard assertions
    expect(crashes).toBe(0);
    expect(totalFled).toBe(0);
    expect(totalRouted).toBe(0);
  });
});
