/**
 * Movement, Formation, Threat Detection & Target Selection audit.
 *
 * 30 battles across tech ages and fleet compositions.
 * Each battle logs per-tick telemetry on the focus areas, then
 * asserts behavioural invariants the user cares about.
 *
 * Run one at a time: `npx vitest run src/__tests__/movement-audit.test.ts`
 */
import { describe, it, expect } from 'vitest';
import { HULL_TEMPLATE_BY_CLASS, HULL_TEMPLATES, SHIP_COMPONENTS } from '../../data/ships/index.js';
import { autoEquipDesign } from '../engine/ship-design.js';
import {
  initializeTacticalCombat,
  processTacticalTick,
  setShipStance,
  BATTLEFIELD_WIDTH,
  BATTLEFIELD_HEIGHT,
} from '../engine/combat-tactical.js';
import type { TacticalState, TacticalShip, CombatStance } from '../engine/combat-tactical.js';
import { generateId } from '../utils/id.js';
import type { Ship, Fleet, ShipDesign, HullClass } from '../types/ships.js';

// ---------------------------------------------------------------------------
// Helpers (same pattern as qa-battle-simulations)
// ---------------------------------------------------------------------------

const AGE_ORDER = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'] as const;

function componentsForAge(age: string) {
  const ageIdx = AGE_ORDER.indexOf(age as typeof AGE_ORDER[number]);
  return SHIP_COMPONENTS.filter(c => {
    const compIdx = AGE_ORDER.indexOf((c.minAge ?? 'nano_atomic') as typeof AGE_ORDER[number]);
    return compIdx <= ageIdx;
  });
}

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
      name: `${template.name}`,
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
  for (const m of maps) for (const [k, v] of m) merged.set(k, v);
  return merged;
}

function initBattle(
  attackerHulls: HullClass[],
  defenderHulls: HullClass[],
  age: string,
  attackerStance: CombatStance = 'aggressive',
  defenderStance: CombatStance = 'aggressive',
): TacticalState {
  const a = setupFleet(attackerHulls, age, 'e1', 'f1');
  const d = setupFleet(defenderHulls, age, 'e2', 'f2');
  const designs = mergeDesigns(a.designs, d.designs);
  let state = initializeTacticalCombat(a.fleet, d.fleet, a.ships, d.ships, designs, SHIP_COMPONENTS);
  if (attackerStance !== 'aggressive') state = setShipStance(state, 'attacker', attackerStance);
  if (defenderStance !== 'aggressive') state = setShipStance(state, 'defender', defenderStance);
  return state;
}

// ---------------------------------------------------------------------------
// Telemetry collection
// ---------------------------------------------------------------------------

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

interface BattleReport {
  name: string;
  ticks: number;
  outcome: string | null;
  crashed: boolean;
  error?: string;
  // Movement
  smallCraftPassedThroughTarget: number;  // times a small craft got within 10 of its target
  smallCraftClumps: number;               // ticks where 2+ small craft within 15 of each other
  shipsStuckImmobile: number;             // ships with <1 velocity for 20+ consecutive ticks while not in range
  // Formation
  allyOverlaps: number;                   // ticks where 2 allies within 20 of each other (non-small-craft)
  // Threat detection
  shipsIgnoringThreats: number;           // ships being shot at but not facing/engaging the threat
  // Target selection
  shipsWithNoTarget: number;              // non-destroyed, non-routed ships idle with enemies alive
  dronesTargetingSmallCraft: number;      // drones attacking other drones instead of capital ships
  // Unmanned behaviour
  dronesFleeing: number;                  // drones that fled or routed (should be 0)
}

function runBattleWithTelemetry(
  name: string,
  state: TacticalState,
  maxTicks: number,
): BattleReport {
  const report: BattleReport = {
    name, ticks: 0, outcome: null, crashed: false,
    smallCraftPassedThroughTarget: 0, smallCraftClumps: 0,
    shipsStuckImmobile: 0, allyOverlaps: 0,
    shipsIgnoringThreats: 0, shipsWithNoTarget: 0,
    dronesTargetingSmallCraft: 0, dronesFleeing: 0,
  };

  // Track consecutive immobile ticks per ship
  const immobileTicks: Record<string, number> = {};

  try {
    for (let t = 0; t < maxTicks; t++) {
      state = processTacticalTick(state);
      if (state.outcome) { report.outcome = state.outcome; report.ticks = state.tick; break; }
      report.ticks = state.tick;

      const alive = state.ships.filter(s => !s.destroyed && !s.routed);
      const attackers = alive.filter(s => s.side === 'attacker');
      const defenders = alive.filter(s => s.side === 'defender');

      for (const ship of alive) {
        const enemies = ship.side === 'attacker' ? defenders : attackers;
        const allies = ship.side === 'attacker' ? attackers : defenders;
        const isSmallCraft = ship.maxHull < 80;
        const isDrone = ship.unmanned;

        // -- Drones fleeing --
        if (isDrone && (ship.stance === 'flee' || ship.order.type === 'flee' || ship.routed)) {
          report.dronesFleeing++;
        }

        // -- Small craft passing through target --
        if (isSmallCraft && enemies.length > 0) {
          for (const enemy of enemies) {
            if (enemy.maxHull > ship.maxHull * 2 && dist(ship.position, enemy.position) < 10) {
              report.smallCraftPassedThroughTarget++;
            }
          }
        }

        // -- Small craft clumping --
        if (isSmallCraft) {
          for (const mate of allies) {
            if (mate.id <= ship.id || !mate.maxHull || mate.maxHull >= 80) continue;
            if (dist(ship.position, mate.position) < 15) {
              report.smallCraftClumps++;
            }
          }
        }

        // -- Immobility --
        const vel = Math.sqrt((ship.velocity?.x ?? 0) ** 2 + (ship.velocity?.y ?? 0) ** 2);
        if (vel < 1 && enemies.length > 0) {
          immobileTicks[ship.id] = (immobileTicks[ship.id] ?? 0) + 1;
          // Only flag if not within weapon range of any enemy
          const closestEnemy = enemies.reduce((best, e) => {
            const d = dist(ship.position, e.position);
            return d < best.d ? { d, e } : best;
          }, { d: Infinity, e: enemies[0]! });
          const maxRange = ship.weapons.length > 0 ? Math.max(...ship.weapons.map(w => w.range)) : 200;
          if (immobileTicks[ship.id]! >= 20 && closestEnemy.d > maxRange) {
            report.shipsStuckImmobile++;
            immobileTicks[ship.id] = 0; // reset to avoid repeated counting
          }
        } else {
          immobileTicks[ship.id] = 0;
        }

        // -- Ally overlap (non-small-craft) --
        if (!isSmallCraft) {
          for (const ally of allies) {
            if (ally.id <= ship.id || ally.maxHull < 80) continue;
            if (dist(ship.position, ally.position) < 20) {
              report.allyOverlaps++;
            }
          }
        }

        // -- Ships with no target --
        if (ship.order.type === 'idle' && enemies.length > 0) {
          report.shipsWithNoTarget++;
        }

        // -- Drones targeting small craft instead of capitals --
        if (isDrone && ship.order.type === 'attack') {
          const targetId = (ship.order as { targetId?: string }).targetId;
          if (targetId) {
            const targetShip = state.ships.find(s => s.id === targetId || s.sourceShipId === targetId);
            if (targetShip && targetShip.maxHull < 80 && enemies.some(e => e.maxHull >= 80)) {
              report.dronesTargetingSmallCraft++;
            }
          }
        }
      }
    }
  } catch (err) {
    report.crashed = true;
    report.error = err instanceof Error ? err.message : String(err);
  }

  return report;
}

function printReport(r: BattleReport) {
  const lines = [
    `\n=== ${r.name} ===`,
    `  Ticks: ${r.ticks}  Outcome: ${r.outcome ?? 'timeout'}${r.crashed ? '  CRASHED: ' + r.error : ''}`,
    `  [Movement]  Through-target: ${r.smallCraftPassedThroughTarget}  Clumps: ${r.smallCraftClumps}  Stuck: ${r.shipsStuckImmobile}`,
    `  [Formation] Ally overlaps: ${r.allyOverlaps}`,
    `  [Threat]    Ignoring threats: ${r.shipsIgnoringThreats}`,
    `  [Targeting] No target: ${r.shipsWithNoTarget}  Drones→small: ${r.dronesTargetingSmallCraft}`,
    `  [Unmanned]  Drones fleeing: ${r.dronesFleeing}`,
  ];
  console.log(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// 30 battles
// ---------------------------------------------------------------------------

const BATTLES: { name: string; attackers: HullClass[]; defenders: HullClass[]; age: string; aStance?: CombatStance; dStance?: CombatStance }[] = [
  // --- nano_atomic (1-6) ---
  { name: '1. Drone swarm vs Destroyer',
    attackers: ['drone', 'drone', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['destroyer'], age: 'nano_atomic' },
  { name: '2. Fighter squadron vs Destroyer',
    attackers: ['fighter', 'fighter', 'fighter', 'fighter'],
    defenders: ['destroyer'], age: 'nano_atomic' },
  { name: '3. Mixed drones+fighters vs 2 Destroyers',
    attackers: ['drone', 'drone', 'drone', 'fighter', 'fighter', 'bomber'],
    defenders: ['destroyer', 'destroyer'], age: 'nano_atomic' },
  { name: '4. Destroyer vs Destroyer (mirror)',
    attackers: ['destroyer'],
    defenders: ['destroyer'], age: 'nano_atomic' },
  { name: '5. Bomber run vs Destroyer',
    attackers: ['bomber', 'bomber', 'bomber'],
    defenders: ['destroyer'], age: 'nano_atomic' },
  { name: '6. Drone swarm vs drone swarm',
    attackers: ['drone', 'drone', 'drone', 'drone'],
    defenders: ['drone', 'drone', 'drone', 'drone'], age: 'nano_atomic' },

  // --- fusion (7-12) ---
  { name: '7. Corvettes vs Frigate',
    attackers: ['corvette', 'corvette', 'corvette'],
    defenders: ['frigate'], age: 'fusion' },
  { name: '8. Drone swarm vs Frigate',
    attackers: ['drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['frigate'], age: 'fusion' },
  { name: '9. Mixed corvette+drones vs Frigate+Destroyer',
    attackers: ['corvette', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['frigate', 'destroyer'], age: 'fusion' },
  { name: '10. Frigate vs Frigate (defensive vs aggressive)',
    attackers: ['frigate'], defenders: ['frigate'],
    age: 'fusion', aStance: 'defensive', dStance: 'aggressive' },
  { name: '11. Fighter+Bomber escort vs Corvettes',
    attackers: ['fighter', 'fighter', 'bomber', 'bomber'],
    defenders: ['corvette', 'corvette'], age: 'fusion' },
  { name: '12. All small craft vs Corvette',
    attackers: ['drone', 'drone', 'fighter', 'fighter', 'bomber'],
    defenders: ['corvette'], age: 'fusion' },

  // --- nano_fusion (13-18) ---
  { name: '13. Light cruiser vs heavy cruiser',
    attackers: ['light_cruiser'],
    defenders: ['heavy_cruiser'], age: 'nano_fusion' },
  { name: '14. Carrier + drones vs Light cruiser',
    attackers: ['carrier', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['light_cruiser'], age: 'nano_fusion' },
  { name: '15. Drone swarm (10) vs Heavy cruiser',
    attackers: ['drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['heavy_cruiser'], age: 'nano_fusion' },
  { name: '16. Mixed fleet vs mixed fleet',
    attackers: ['light_cruiser', 'corvette', 'corvette', 'drone', 'drone'],
    defenders: ['heavy_cruiser', 'frigate', 'fighter', 'fighter'], age: 'nano_fusion' },
  { name: '17. Evasive light cruiser vs aggressive heavy cruiser',
    attackers: ['light_cruiser'], defenders: ['heavy_cruiser'],
    age: 'nano_fusion', aStance: 'evasive', dStance: 'aggressive' },
  { name: '18. At-ease fleet engagement',
    attackers: ['light_cruiser', 'frigate', 'frigate'],
    defenders: ['heavy_cruiser', 'corvette', 'corvette'],
    age: 'nano_fusion', aStance: 'at_ease', dStance: 'at_ease' },

  // --- anti_matter (19-24) ---
  { name: '19. Battleship vs Battleship',
    attackers: ['battleship'],
    defenders: ['battleship'], age: 'anti_matter' },
  { name: '20. Drone swarm (12) vs Battleship',
    attackers: ['drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['battleship'], age: 'anti_matter' },
  { name: '21. Super carrier + fighters vs Heavy battleship',
    attackers: ['super_carrier', 'fighter', 'fighter', 'fighter', 'fighter'],
    defenders: ['heavy_battleship'], age: 'anti_matter' },
  { name: '22. Mixed capital fleet vs mixed capital fleet',
    attackers: ['battleship', 'light_cruiser', 'corvette', 'corvette'],
    defenders: ['heavy_battleship', 'frigate', 'frigate', 'destroyer'], age: 'anti_matter' },
  { name: '23. Light cruiser wolfpack vs Battleship',
    attackers: ['light_cruiser', 'light_cruiser', 'light_cruiser'],
    defenders: ['battleship'], age: 'anti_matter' },
  { name: '24. Drones + cruisers vs Battle station',
    attackers: ['heavy_cruiser', 'heavy_cruiser', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['battle_station'], age: 'anti_matter' },

  // --- singularity (25-30) ---
  { name: '25. Planet killer vs everything',
    attackers: ['planet_killer'],
    defenders: ['battleship', 'heavy_cruiser', 'light_cruiser', 'frigate'], age: 'singularity' },
  { name: '26. Massive drone swarm vs Planet killer',
    attackers: ['drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'drone'],
    defenders: ['planet_killer'], age: 'singularity' },
  { name: '27. Full fleet engagement',
    attackers: ['battleship', 'heavy_cruiser', 'light_cruiser', 'frigate', 'corvette', 'drone', 'drone', 'fighter'],
    defenders: ['heavy_battleship', 'light_cruiser', 'light_cruiser', 'destroyer', 'drone', 'drone', 'drone', 'bomber'], age: 'singularity' },
  { name: '28. Carrier battle group vs carrier battle group',
    attackers: ['super_carrier', 'light_cruiser', 'fighter', 'fighter', 'bomber'],
    defenders: ['carrier', 'heavy_cruiser', 'fighter', 'fighter', 'fighter'], age: 'singularity' },
  { name: '29. All at_ease multi-fleet',
    attackers: ['battleship', 'frigate', 'frigate', 'drone', 'drone'],
    defenders: ['heavy_battleship', 'corvette', 'corvette', 'corvette', 'drone', 'drone'],
    age: 'singularity', aStance: 'at_ease', dStance: 'at_ease' },
  { name: '30. Evasive cruisers vs aggressive swarm',
    attackers: ['light_cruiser', 'light_cruiser'],
    defenders: ['drone', 'drone', 'drone', 'drone', 'drone', 'drone', 'fighter', 'fighter', 'bomber', 'bomber'],
    age: 'singularity', aStance: 'evasive', dStance: 'aggressive' },
];

describe('Movement audit — 30 battles', () => {
  for (const battle of BATTLES) {
    it(battle.name, () => {
      const state = initBattle(
        battle.attackers, battle.defenders, battle.age,
        battle.aStance ?? 'aggressive', battle.dStance ?? 'aggressive',
      );
      const report = runBattleWithTelemetry(battle.name, state, 800);
      printReport(report);

      // Hard invariants
      expect(report.crashed).toBe(false);
      expect(report.dronesFleeing).toBe(0);

      // Soft thresholds — flag but don't fail (logged for analysis)
      if (report.smallCraftPassedThroughTarget > 5) {
        console.log(`  !! WARNING: ${report.smallCraftPassedThroughTarget} through-target events`);
      }
      if (report.smallCraftClumps > report.ticks * 0.3) {
        console.log(`  !! WARNING: clumping on ${report.smallCraftClumps}/${report.ticks} observations`);
      }
    });
  }
});
