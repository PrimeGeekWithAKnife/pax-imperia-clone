/**
 * Collision audit — 50 sequential battle simulations measuring collision damage
 * and Z-axis avoidance behaviour.
 *
 * Tracks:
 *   - Friendly (same-side) collision damage per simulation
 *   - Ships that used Z-axis avoidance (|z| > 5 at any point)
 *   - Ships destroyed by collision damage
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import {
  initializeTacticalCombat,
  processTacticalTick,
} from '../engine/combat-tactical.js';
import type { TacticalState, TacticalShip } from '../engine/combat-tactical.js';
import { generateId } from '../utils/id.js';
import type { Ship, Fleet, ShipDesign, HullClass } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGE_ORDER = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'] as const;

/** Filter components available at a given age. */
function componentsForAge(age: string) {
  const ageIdx = AGE_ORDER.indexOf(age as (typeof AGE_ORDER)[number]);
  return SHIP_COMPONENTS.filter(c => {
    const compIdx = AGE_ORDER.indexOf((c.minAge ?? 'nano_atomic') as (typeof AGE_ORDER)[number]);
    return compIdx <= ageIdx;
  });
}

// ---------------------------------------------------------------------------
// Fleet configs — 10 patterns x 5 repetitions = 50 simulations
// ---------------------------------------------------------------------------

interface FleetConfig {
  attacker: HullClass[];
  defender: HullClass[];
  label: string;
}

const BASE_CONFIGS: FleetConfig[] = [
  {
    attacker: ['fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'],
    defender: ['fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'],
    label: '6v6 fighters',
  },
  {
    attacker: ['drone', 'drone', 'drone', 'drone', 'drone'],
    defender: ['drone', 'drone', 'drone', 'drone', 'drone'],
    label: '5v5 drones',
  },
  {
    attacker: ['fighter', 'fighter', 'fighter', 'patrol', 'patrol'],
    defender: ['fighter', 'fighter', 'fighter', 'patrol', 'patrol'],
    label: '5v5 mixed small',
  },
  {
    attacker: ['destroyer', 'destroyer', 'frigate', 'frigate'],
    defender: ['destroyer', 'destroyer', 'frigate', 'frigate'],
    label: '4v4 DD+FF',
  },
  {
    attacker: ['battleship', 'heavy_cruiser', 'destroyer', 'destroyer'],
    defender: ['battleship', 'heavy_cruiser', 'destroyer', 'destroyer'],
    label: '4v4 capital mix',
  },
  {
    attacker: ['fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter', 'fighter'],
    defender: ['battleship', 'heavy_cruiser'],
    label: '8v2 swarm vs capital',
  },
  {
    attacker: ['battleship', 'heavy_cruiser', 'light_cruiser', 'destroyer', 'destroyer', 'frigate', 'frigate', 'corvette', 'corvette'],
    defender: ['battleship', 'heavy_cruiser', 'light_cruiser', 'destroyer', 'destroyer', 'frigate', 'frigate', 'corvette', 'corvette'],
    label: '9v9 full fleet',
  },
  {
    attacker: ['carrier', 'destroyer', 'destroyer', 'frigate', 'frigate'],
    defender: ['carrier', 'destroyer', 'destroyer', 'frigate', 'frigate'],
    label: '5v5 carrier+escorts',
  },
  {
    attacker: ['corvette', 'corvette', 'corvette', 'corvette', 'corvette', 'corvette'],
    defender: ['corvette', 'corvette', 'corvette', 'corvette', 'corvette', 'corvette'],
    label: '6v6 corvettes',
  },
  {
    attacker: ['heavy_battleship', 'battleship', 'battleship'],
    defender: ['heavy_battleship', 'battleship', 'battleship'],
    label: '3v3 heavies',
  },
];

// Repeat 5 times with varying tech ages
const FLEET_CONFIGS: (FleetConfig & { age: string; simIndex: number })[] = [];
for (let rep = 0; rep < 5; rep++) {
  const age = AGE_ORDER[rep % AGE_ORDER.length];
  for (let i = 0; i < BASE_CONFIGS.length; i++) {
    const cfg = BASE_CONFIGS[i]!;
    FLEET_CONFIGS.push({
      ...cfg,
      age,
      simIndex: rep * 10 + i + 1,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupFleet(
  hulls: HullClass[],
  age: string,
  empireId: string,
  fleetId: string,
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
      id: generateId(),
      designId: design.id,
      name: template.name,
      hullPoints: template.baseHullPoints,
      maxHullPoints: template.baseHullPoints,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'test' },
      fleetId,
    });
  }

  const fleet: Fleet = {
    id: fleetId,
    name: `Fleet ${fleetId}`,
    ships: ships.map(s => s.id),
    empireId,
    position: { systemId: 'test' },
    destination: null,
    waypoints: [],
    stance: 'aggressive',
  };

  return { ships, fleet, designs };
}

function mergeDesigns(...maps: Map<string, ShipDesign>[]): Map<string, ShipDesign> {
  const merged = new Map<string, ShipDesign>();
  for (const m of maps) {
    for (const [k, v] of m) merged.set(k, v);
  }
  return merged;
}

/** Distance between two ships in the XY plane. */
function horizDist(a: TacticalShip, b: TacticalShip): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Simulation result types
// ---------------------------------------------------------------------------

interface SimResult {
  simIndex: number;
  label: string;
  age: string;
  totalShips: number;
  friendlyCollisionDamage: number;
  shipsUsingZAvoidance: number;
  destroyedByCollision: number;
  crashed: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Run one simulation
// ---------------------------------------------------------------------------

function runSimulation(cfg: (typeof FLEET_CONFIGS)[number]): SimResult {
  const a = setupFleet(cfg.attacker, cfg.age, 'e1', 'f1');
  const d = setupFleet(cfg.defender, cfg.age, 'e2', 'f2');
  const designs = mergeDesigns(a.designs, d.designs);

  let state: TacticalState;
  try {
    state = initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);
  } catch (err) {
    return {
      simIndex: cfg.simIndex,
      label: cfg.label,
      age: cfg.age,
      totalShips: cfg.attacker.length + cfg.defender.length,
      friendlyCollisionDamage: 0,
      shipsUsingZAvoidance: 0,
      destroyedByCollision: 0,
      crashed: true,
      error: String(err),
    };
  }

  const totalShips = state.ships.length;

  // Tracking sets and accumulators
  const zAvoidanceShips = new Set<string>();  // ships that ever had |z| > 5
  let totalFriendlyCollisionDmg = 0;
  const destroyedByCollisionSet = new Set<string>();

  // Per-ship: previous hull, side, collision radius
  const prevHull = new Map<string, number>();
  const shipSide = new Map<string, 'attacker' | 'defender'>();
  const shipCollisionRadius = new Map<string, number>();
  const alreadyDestroyed = new Set<string>();

  for (const ship of state.ships) {
    prevHull.set(ship.id, ship.hull);
    shipSide.set(ship.id, ship.side);
    shipCollisionRadius.set(ship.id, ship.collisionRadius);
  }

  const TICKS = 200;

  try {
    for (let tick = 0; tick < TICKS; tick++) {
      // Snapshot hull values before tick
      for (const ship of state.ships) {
        if (!ship.destroyed) {
          prevHull.set(ship.id, ship.hull);
        }
      }

      state = processTacticalTick(state);

      // Check each ship for Z-axis avoidance and collision damage
      for (const ship of state.ships) {
        // Z-axis tracking
        if (Math.abs(ship.position.z) > 5) {
          zAvoidanceShips.add(ship.id);
        }

        // Detect hull damage this tick
        const prev = prevHull.get(ship.id) ?? ship.hull;
        const hullLoss = prev - ship.hull;

        if (hullLoss > 0) {
          // Check if this damage could be from friendly collision:
          // A ship overlapping with a same-side ship within collision distance
          const mySide = shipSide.get(ship.id);
          const myRadius = shipCollisionRadius.get(ship.id) ?? 20;

          // Find nearby same-side ships (potential collision partners)
          let hasFriendlyOverlap = false;
          for (const other of state.ships) {
            if (other.id === ship.id || other.destroyed) continue;
            if (shipSide.get(other.id) !== mySide) continue;

            const otherRadius = shipCollisionRadius.get(other.id) ?? 20;
            const dist = horizDist(ship, other);
            // Check if within combined collision radii * 1.5 (generous margin)
            if (dist < (myRadius + otherRadius) * 1.5) {
              hasFriendlyOverlap = true;
              break;
            }
          }

          // Also check: was any enemy in weapon range?
          // If no enemies within reasonable range AND a friendly was nearby,
          // this is likely collision damage.
          let enemyInRange = false;
          for (const other of state.ships) {
            if (other.destroyed) continue;
            if (shipSide.get(other.id) === mySide) continue;
            const dist = horizDist(ship, other);
            // Generous weapon range check — most weapons < 600 range
            if (dist < 600) {
              enemyInRange = true;
              break;
            }
          }

          // Heuristic: damage from collision if friendly overlap detected
          // and either no enemy in range OR we're in early ticks (before engagement)
          if (hasFriendlyOverlap && (!enemyInRange || tick < 30)) {
            totalFriendlyCollisionDmg += hullLoss;

            // Track destruction by collision
            if (ship.destroyed && !alreadyDestroyed.has(ship.id)) {
              destroyedByCollisionSet.add(ship.id);
            }
          }
        }

        if (ship.destroyed) {
          alreadyDestroyed.add(ship.id);
        }
      }
    }
  } catch (err) {
    return {
      simIndex: cfg.simIndex,
      label: cfg.label,
      age: cfg.age,
      totalShips,
      friendlyCollisionDamage: totalFriendlyCollisionDmg,
      shipsUsingZAvoidance: zAvoidanceShips.size,
      destroyedByCollision: destroyedByCollisionSet.size,
      crashed: true,
      error: String(err),
    };
  }

  return {
    simIndex: cfg.simIndex,
    label: cfg.label,
    age: cfg.age,
    totalShips,
    friendlyCollisionDamage: totalFriendlyCollisionDmg,
    shipsUsingZAvoidance: zAvoidanceShips.size,
    destroyedByCollision: destroyedByCollisionSet.size,
    crashed: false,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('collision audit — 50 simulations', () => {
  const results: SimResult[] = [];

  it('runs 50 sequential battle simulations', () => {
    for (const cfg of FLEET_CONFIGS) {
      results.push(runSimulation(cfg));
    }

    // Print summary table
    const header = [
      'Sim'.padStart(3),
      'Age'.padEnd(12),
      'Fleet Composition'.padEnd(26),
      'Friendly Col Dmg'.padStart(16),
      'Ships Z-Avoided'.padStart(16),
      'Destroyed by Col'.padStart(16),
      'Crashed'.padStart(8),
    ].join(' | ');

    console.log('\n=== COLLISION AUDIT: 50 Simulations ===');
    console.log(header);
    console.log('-'.repeat(header.length));

    for (const r of results) {
      const row = [
        String(r.simIndex).padStart(3),
        r.age.padEnd(12),
        r.label.padEnd(26),
        String(r.friendlyCollisionDamage).padStart(16),
        `${r.shipsUsingZAvoidance}/${r.totalShips}`.padStart(16),
        String(r.destroyedByCollision).padStart(16),
        (r.crashed ? 'YES' : 'no').padStart(8),
      ].join(' | ');
      console.log(row);
    }

    // Totals
    const simsWithDmg = results.filter(r => r.friendlyCollisionDamage > 0).length;
    const totalDmg = results.reduce((sum, r) => sum + r.friendlyCollisionDamage, 0);
    const totalZShips = results.reduce((sum, r) => sum + r.shipsUsingZAvoidance, 0);
    const totalShipsAll = results.reduce((sum, r) => sum + r.totalShips, 0);
    const totalDestroyedByCol = results.reduce((sum, r) => sum + r.destroyedByCollision, 0);
    const totalCrashed = results.filter(r => r.crashed).length;

    console.log('\n=== TOTALS ===');
    console.log(`Simulations with friendly collision damage: ${simsWithDmg}/50`);
    console.log(`Total friendly collision damage: ${totalDmg}`);
    console.log(`Total ships using Z-avoidance: ${totalZShips}/${totalShipsAll}`);
    console.log(`Total ships destroyed by friendly collision: ${totalDestroyedByCol}`);
    console.log(`Simulations that crashed: ${totalCrashed}/50`);

    // The test always passes — it's an audit, not a correctness assertion.
    // We just want the data.
    expect(results.length).toBe(50);
    expect(totalCrashed).toBe(0);  // simulations shouldn't crash
  });
});
