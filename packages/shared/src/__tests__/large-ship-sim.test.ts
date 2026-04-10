/**
 * Large ship battle simulation harness.
 *
 * Runs 20 battles with capital/super-capital ships and reports metrics
 * on 5 known issues:
 *   1. Weapon mounting — do weapons fire when enemy is inside ship geometry?
 *   2. Collision overlap — do giant ships overlap despite collision resolution?
 *   3. RCS nimbleness — are large ships turning too fast relative to their mass?
 *   4. Capital speed — how many ticks to cross the battlefield?
 *   5. Fleet cohesion — do fast ships charge ahead of slow ones?
 */
import { describe, it, expect } from 'vitest';
import {
  initializeTacticalCombat,
  processTacticalTick,
  type TacticalState,
  type TacticalShip,
} from '../engine/combat-tactical.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import { HULL_TEMPLATE_BY_CLASS } from '../../data/ships/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFleet(id: string): Fleet {
  return { id, name: `Fleet ${id}`, shipIds: [], position: 'sys-1', stance: 'aggressive' as any };
}

let _idCounter = 0;
function makeShip(hullClass: string, side: 'attacker' | 'defender'): Ship {
  const ht = Object.values(HULL_TEMPLATE_BY_CLASS).find(h => (h as any).class === hullClass) as any;
  if (!ht) throw new Error(`Unknown hull class: ${hullClass}`);
  const id = `ship-${side}-${hullClass}-${_idCounter++}`;
  return {
    id,
    name: `${hullClass} ${_idCounter}`,
    empireId: side === 'attacker' ? 'emp-a' : 'emp-d',
    designId: `design-${hullClass}`,
    hullPoints: ht.baseHullPoints,
    maxHullPoints: ht.baseHullPoints,
    crewExperience: 'veteran',
    systemId: 'sys-1',
  } as Ship;
}

function makeDesign(hullClass: string): ShipDesign {
  const ht = Object.values(HULL_TEMPLATE_BY_CLASS).find(h => (h as any).class === hullClass) as any;
  // Find the engine and weapon slot IDs from the hull template's slotLayout
  const slots: Array<{ id: string; facing: string; allowedTypes: string[]; size?: string; category?: string }> = ht?.slotLayout ?? [];
  const engineSlot = slots.find(s => s.allowedTypes.includes('engine'));
  const weaponSlot = slots.find(s => s.allowedTypes.some((t: string) => t.startsWith('weapon')));
  const components = [
    { slotId: engineSlot?.id ?? `${hullClass}_engine_0`, componentId: `engine-${hullClass}` },
    { slotId: weaponSlot?.id ?? `${hullClass}_weapon_0`, componentId: `weapon-beam-${hullClass}` },
  ];

  // Planet killers get a spinal annihilator in their colossal weapon slot + power reactor
  if (hullClass === 'planet_killer') {
    const colossalWeaponSlot = slots.find(s => s.size === 'colossal' && s.category === 'weapon');
    const internalSlot = slots.find(s => s.allowedTypes.includes('power_reactor'));
    if (colossalWeaponSlot) {
      components.push({ slotId: colossalWeaponSlot.id, componentId: 'spinal-annihilator-pk' });
    }
    if (internalSlot) {
      components.push({ slotId: internalSlot.id, componentId: 'power-reactor-pk' });
    }
  }

  return {
    id: `design-${hullClass}`,
    name: hullClass,
    empireId: 'emp-a',
    hull: ht?.class ?? hullClass,
    components,
    totalCost: 0,
  } as ShipDesign;
}

function makeComponents(hullClass: string): ShipComponent[] {
  const ht = Object.values(HULL_TEMPLATE_BY_CLASS).find(h => (h as any).class === hullClass) as any;
  const speed = ht?.baseSpeed ?? 3;
  const components: ShipComponent[] = [
    {
      id: `engine-${hullClass}`,
      name: `${hullClass} Engine`,
      type: 'engine' as any,
      techAge: 'fusion',
      size: 'large' as any,
      stats: { speed },
      description: '',
    },
    {
      id: `weapon-beam-${hullClass}`,
      name: `${hullClass} Beam`,
      type: 'weapon_beam' as any,
      techAge: 'fusion',
      size: 'large' as any,
      stats: { damage: 15, range: 25, accuracy: 75, powerDraw: 5 },
      description: '',
    },
  ];

  // Planet killers get a spinal annihilator (colossal beam) and high-capacity power reactor
  if (hullClass === 'planet_killer') {
    components.push({
      id: 'spinal-annihilator-pk',
      name: 'Spinal Annihilator',
      type: 'weapon_beam' as any,
      techAge: 'singularity',
      size: 'colossal' as any,
      stats: { damage: 200, range: 96, accuracy: 95, powerDraw: 50, beamWidth: 80, piercingBonus: 30, shieldPenetration: 40 },
      description: 'Full-length spinal mount beam weapon',
    });
    components.push({
      id: 'power-reactor-pk',
      name: 'PK Power Reactor',
      type: 'power_reactor' as any,
      techAge: 'singularity',
      size: 'colossal' as any,
      stats: { capacity: 500, rechargeRate: 15 },
      description: 'High-capacity reactor for spinal weapons',
    });
  }

  return components;
}

interface BattleSetup {
  label: string;
  attackerHulls: string[];
  defenderHulls: string[];
  battlefieldSize: 'small' | 'medium' | 'large';
}

interface BattleMetrics {
  label: string;
  ticksRun: number;
  ticksWithEnemyInsideGeometry: number;
  ticksWhereInsideEnemyDidntFire: number;
  weaponsFiredTotal: number;
  maxOverlapUnits: number;
  overlapFrames: number;
  largeShipMaxTurnPerTick: number;
  smallShipMaxTurnPerTick: number;
  turnRatio: number;
  slowestShipSpeed: number;
  ticksToHalfBattlefield: number;
  realSecondsAtNormalSpeed: number;
  maxFleetSpread: number;
  ticksBeforeFastestEngages: number;
  ticksBeforeSlowestEngages: number;
  spreadWhenFastestEngages: number;
}

function runBattle(setup: BattleSetup, maxTicks: number = 300): BattleMetrics {
  _idCounter = 0;

  const allHulls = [...new Set([...setup.attackerHulls, ...setup.defenderHulls])];
  const designs = new Map<string, ShipDesign>();
  const allComponents: ShipComponent[] = [];
  for (const hc of allHulls) {
    designs.set(`design-${hc}`, makeDesign(hc));
    allComponents.push(...makeComponents(hc));
  }

  const attackerShips = setup.attackerHulls.map(h => makeShip(h, 'attacker'));
  const defenderShips = setup.defenderHulls.map(h => makeShip(h, 'defender'));

  const atkFleet = makeFleet('fleet-a');
  atkFleet.shipIds = attackerShips.map(s => s.id);
  const defFleet = makeFleet('fleet-d');
  defFleet.shipIds = defenderShips.map(s => s.id);

  let state: TacticalState;
  try {
    state = initializeTacticalCombat(
      atkFleet, defFleet, attackerShips, defenderShips,
      designs, allComponents, 'open_space', undefined, setup.battlefieldSize,
    );
  } catch (e) {
    return {
      label: setup.label + ' (INIT FAILED: ' + (e as Error).message + ')',
      ticksRun: 0, ticksWithEnemyInsideGeometry: 0, ticksWhereInsideEnemyDidntFire: 0,
      weaponsFiredTotal: 0, maxOverlapUnits: 0, overlapFrames: 0,
      largeShipMaxTurnPerTick: 0, smallShipMaxTurnPerTick: 0, turnRatio: 0,
      slowestShipSpeed: 0, ticksToHalfBattlefield: 0, realSecondsAtNormalSpeed: 0,
      maxFleetSpread: 0, ticksBeforeFastestEngages: 0, ticksBeforeSlowestEngages: 0,
      spreadWhenFastestEngages: 0,
    };
  }

  const bfW = state.battlefieldWidth;
  let ticksWithInsideGeom = 0;
  let ticksInsideNoFire = 0;
  let totalWeaponsFired = 0;
  let maxOverlap = 0;
  let overlapFrames = 0;
  let largeMaxTurn = 0;
  let smallMaxTurn = 0;
  let maxSpread = 0;
  let fastestEngageTick = -1;
  let slowestEngageTick = -1;
  let spreadAtFastestEngage = 0;
  let ticksToHalf = -1;

  const prevFacing = new Map<string, number>();
  for (const s of state.ships) prevFacing.set(s.id, s.facing);

  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.outcome) break;

    const prevState = state;
    state = processTacticalTick(state);

    const alive = state.ships.filter(s => !s.destroyed && !s.routed);
    const attackers = alive.filter(s => s.side === 'attacker');
    const defenders = alive.filter(s => s.side === 'defender');

    // Issue 1: enemies inside ship geometry but weapons silent
    for (const ship of alive) {
      const ext = (ship as any).collisionExtents ?? { halfWidth: 20, halfHeight: 10, halfLength: 30 };
      const maxExtent = Math.max(ext.halfWidth, ext.halfLength);
      const enemies = alive.filter(e => e.side !== ship.side);
      for (const enemy of enemies) {
        const dx = Math.abs(ship.position.x - enemy.position.x);
        const dy = Math.abs(ship.position.y - enemy.position.y);
        const horizDist = Math.sqrt(dx * dx + dy * dy);
        if (horizDist < maxExtent) {
          ticksWithInsideGeom++;
          const firedThisTick = state.beamEffects.some(b => b.sourceShipId === ship.id && b.ticksRemaining === 3) ||
            state.projectiles.some(p => p.sourceShipId === ship.id);
          if (!firedThisTick) ticksInsideNoFire++;
        }
      }
    }

    totalWeaponsFired += state.beamEffects.filter(b => b.ticksRemaining === 3).length;
    const newProj = state.projectiles.length - prevState.projectiles.length;
    if (newProj > 0) totalWeaponsFired += newProj;

    // Issue 2: collision overlap between opposing sides
    for (const a of attackers) {
      for (const d of defenders) {
        const ae = (a as any).collisionExtents ?? { halfWidth: 20, halfLength: 30 };
        const de = (d as any).collisionExtents ?? { halfWidth: 20, halfLength: 30 };
        const horizA = Math.max(ae.halfWidth, ae.halfLength);
        const horizD = Math.max(de.halfWidth, de.halfLength);
        const minDist = horizA + horizD;
        const ddx = a.position.x - d.position.x;
        const ddy = a.position.y - d.position.y;
        const actualDist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (actualDist < minDist) {
          const overlap = minDist - actualDist;
          if (overlap > maxOverlap) maxOverlap = overlap;
          overlapFrames++;
        }
      }
    }

    // Issue 3: turn rates
    for (const ship of alive) {
      const prev = prevFacing.get(ship.id);
      if (prev !== undefined) {
        let delta = Math.abs(ship.facing - prev);
        if (delta > Math.PI) delta = 2 * Math.PI - delta;
        if (ship.maxHull > 500) {
          if (delta > largeMaxTurn) largeMaxTurn = delta;
        } else if (ship.maxHull < 100) {
          if (delta > smallMaxTurn) smallMaxTurn = delta;
        }
      }
      prevFacing.set(ship.id, ship.facing);
    }

    // Issue 4: slowest ship progress
    const slowest = alive.reduce((s, c) => c.speed < s.speed ? c : s, alive[0]);
    if (slowest && ticksToHalf < 0) {
      const centre = bfW / 2;
      if (Math.abs(slowest.position.x - centre) < 200) ticksToHalf = tick;
    }

    // Issue 5: fleet cohesion
    for (const side of ['attacker', 'defender'] as const) {
      const sideShips = alive.filter(s => s.side === side);
      if (sideShips.length < 2) continue;
      const xs = sideShips.map(s => s.position.x);
      const spread = Math.max(...xs) - Math.min(...xs);
      if (spread > maxSpread) maxSpread = spread;

      const anyFired = state.beamEffects.some(b => {
        const src = sideShips.find(s => s.id === b.sourceShipId);
        return src && b.ticksRemaining === 3;
      });

      if (anyFired && side === 'attacker') {
        if (fastestEngageTick < 0) {
          fastestEngageTick = tick;
          spreadAtFastestEngage = spread;
        }
        const slowestAttacker = sideShips.reduce((s, c) => c.speed < s.speed ? c : s, sideShips[0]);
        const slowestFired = state.beamEffects.some(b => b.sourceShipId === slowestAttacker.id && b.ticksRemaining === 3);
        if (slowestFired && slowestEngageTick < 0) slowestEngageTick = tick;
      }
    }
  }

  const slowestShip = state.ships.filter(s => !s.destroyed).reduce(
    (s, c) => c.speed < s.speed ? c : s, state.ships[0],
  );

  return {
    label: setup.label,
    ticksRun: state.tick,
    ticksWithEnemyInsideGeometry: ticksWithInsideGeom,
    ticksWhereInsideEnemyDidntFire: ticksInsideNoFire,
    weaponsFiredTotal: totalWeaponsFired,
    maxOverlapUnits: Math.round(maxOverlap),
    overlapFrames,
    largeShipMaxTurnPerTick: Math.round(largeMaxTurn * 1000) / 1000,
    smallShipMaxTurnPerTick: Math.round(smallMaxTurn * 1000) / 1000,
    turnRatio: smallMaxTurn > 0 ? Math.round((largeMaxTurn / smallMaxTurn) * 100) / 100 : 0,
    slowestShipSpeed: slowestShip?.speed ?? 0,
    ticksToHalfBattlefield: ticksToHalf,
    realSecondsAtNormalSpeed: ticksToHalf > 0 ? ticksToHalf * 0.1 : -1,
    maxFleetSpread: maxSpread,
    ticksBeforeFastestEngages: fastestEngageTick,
    ticksBeforeSlowestEngages: slowestEngageTick,
    spreadWhenFastestEngages: Math.round(spreadAtFastestEngage),
  };
}

// ---------------------------------------------------------------------------
// 20 battle configurations
// ---------------------------------------------------------------------------

const BATTLES: BattleSetup[] = [
  { label: '5 battleships vs 5 battleships', attackerHulls: Array(5).fill('battleship'), defenderHulls: Array(5).fill('battleship'), battlefieldSize: 'large' },
  { label: '3 heavy_bb vs 3 heavy_bb', attackerHulls: Array(3).fill('heavy_battleship'), defenderHulls: Array(3).fill('heavy_battleship'), battlefieldSize: 'large' },
  { label: '2 planet_killers vs 5 battleships', attackerHulls: ['planet_killer', 'planet_killer'], defenderHulls: Array(5).fill('battleship'), battlefieldSize: 'large' },
  { label: '1 PK + 4 heavy_bb vs same', attackerHulls: ['planet_killer', ...Array(4).fill('heavy_battleship')], defenderHulls: ['planet_killer', ...Array(4).fill('heavy_battleship')], battlefieldSize: 'large' },
  { label: '1 battle_station + 5 cruisers vs same', attackerHulls: ['battle_station', ...Array(5).fill('heavy_cruiser')], defenderHulls: ['battle_station', ...Array(5).fill('heavy_cruiser')], battlefieldSize: 'large' },
  { label: 'mixed: PK+BB+DD+FF+fighter', attackerHulls: ['planet_killer', 'battleship', 'destroyer', 'frigate', 'fighter'], defenderHulls: ['planet_killer', 'battleship', 'destroyer', 'frigate', 'fighter'], battlefieldSize: 'large' },
  { label: 'mixed: 2 heavy_bb + 3 DD + 2 fighter', attackerHulls: ['heavy_battleship', 'heavy_battleship', 'destroyer', 'destroyer', 'destroyer', 'fighter', 'fighter'], defenderHulls: ['heavy_battleship', 'heavy_battleship', 'destroyer', 'destroyer', 'destroyer', 'fighter', 'fighter'], battlefieldSize: 'large' },
  { label: 'carrier + 4 DD vs same', attackerHulls: ['carrier', ...Array(4).fill('destroyer')], defenderHulls: ['carrier', ...Array(4).fill('destroyer')], battlefieldSize: 'medium' },
  { label: '5 light_cruiser vs 5 light_cruiser', attackerHulls: Array(5).fill('light_cruiser'), defenderHulls: Array(5).fill('light_cruiser'), battlefieldSize: 'medium' },
  { label: '3 carrier + 2 BB vs same', attackerHulls: ['carrier', 'carrier', 'carrier', 'battleship', 'battleship'], defenderHulls: ['carrier', 'carrier', 'carrier', 'battleship', 'battleship'], battlefieldSize: 'large' },
  { label: '1 PK vs 10 corvettes', attackerHulls: ['planet_killer'], defenderHulls: Array(10).fill('corvette'), battlefieldSize: 'large' },
  { label: '1 battle_station vs 8 DD', attackerHulls: ['battle_station'], defenderHulls: Array(8).fill('destroyer'), battlefieldSize: 'large' },
  { label: '2 heavy_bb vs 10 fighters', attackerHulls: ['heavy_battleship', 'heavy_battleship'], defenderHulls: Array(10).fill('fighter'), battlefieldSize: 'medium' },
  { label: '5 DD vs 5 DD (medium)', attackerHulls: Array(5).fill('destroyer'), defenderHulls: Array(5).fill('destroyer'), battlefieldSize: 'medium' },
  { label: '3 super_carrier vs 3 super_carrier', attackerHulls: Array(3).fill('super_carrier'), defenderHulls: Array(3).fill('super_carrier'), battlefieldSize: 'large' },
  { label: 'BB+HC+LC+DD+corvette vs same', attackerHulls: ['battleship', 'heavy_cruiser', 'light_cruiser', 'destroyer', 'corvette'], defenderHulls: ['battleship', 'heavy_cruiser', 'light_cruiser', 'destroyer', 'corvette'], battlefieldSize: 'large' },
  { label: 'PK + 3 fighters + 2 bombers vs same', attackerHulls: ['planet_killer', 'fighter', 'fighter', 'fighter', 'bomber', 'bomber'], defenderHulls: ['planet_killer', 'fighter', 'fighter', 'fighter', 'bomber', 'bomber'], battlefieldSize: 'large' },
  { label: '8 BB vs 8 BB', attackerHulls: Array(8).fill('battleship'), defenderHulls: Array(8).fill('battleship'), battlefieldSize: 'large' },
  { label: '6 HC + 2 carrier vs same', attackerHulls: [...Array(6).fill('heavy_cruiser'), 'carrier', 'carrier'], defenderHulls: [...Array(6).fill('heavy_cruiser'), 'carrier', 'carrier'], battlefieldSize: 'large' },
  { label: '2 PK + 2 BS + 2 BB', attackerHulls: ['planet_killer', 'planet_killer', 'battle_station', 'battle_station', 'battleship', 'battleship'], defenderHulls: ['planet_killer', 'planet_killer', 'battle_station', 'battle_station', 'battleship', 'battleship'], battlefieldSize: 'large' },
];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Large ship battle simulation (20 battles)', () => {
  const results: BattleMetrics[] = [];

  for (const battle of BATTLES) {
    it(`simulates: ${battle.label}`, () => {
      const metrics = runBattle(battle, 800);
      results.push(metrics);
      expect(metrics.ticksRun).toBeGreaterThan(0);
    });
  }

  it('prints simulation report', () => {
    console.log('\n' + '='.repeat(120));
    console.log('LARGE SHIP BATTLE SIMULATION REPORT');
    console.log('='.repeat(120));

    console.log('\n--- ISSUE 1: WEAPON MOUNTING (enemies inside geometry but weapons silent) ---');
    console.log(String('Battle').padEnd(50), 'InsideGeom', 'NoFire', 'TotalFired');
    for (const r of results) {
      console.log(r.label.padEnd(50),
        String(r.ticksWithEnemyInsideGeometry).padStart(10),
        String(r.ticksWhereInsideEnemyDidntFire).padStart(8),
        String(r.weaponsFiredTotal).padStart(10));
    }

    console.log('\n--- ISSUE 2: COLLISION OVERLAP (opposing ships overlapping) ---');
    console.log(String('Battle').padEnd(50), 'MaxOverlap', 'Frames');
    for (const r of results) {
      console.log(r.label.padEnd(50),
        String(r.maxOverlapUnits).padStart(10),
        String(r.overlapFrames).padStart(8));
    }

    console.log('\n--- ISSUE 3: RCS NIMBLENESS (large vs small turn rates) ---');
    console.log(String('Battle').padEnd(50), 'LargeTurn', 'SmallTurn', 'Ratio');
    for (const r of results) {
      if (r.largeShipMaxTurnPerTick > 0) {
        console.log(r.label.padEnd(50),
          String(r.largeShipMaxTurnPerTick).padStart(9),
          String(r.smallShipMaxTurnPerTick).padStart(9),
          String(r.turnRatio).padStart(8));
      }
    }

    console.log('\n--- ISSUE 4: CAPITAL SPEED (ticks to reach battlefield centre) ---');
    console.log(String('Battle').padEnd(50), 'Speed', 'TicksHalf', 'RealSecs');
    for (const r of results) {
      console.log(r.label.padEnd(50),
        String(r.slowestShipSpeed).padStart(5),
        String(r.ticksToHalfBattlefield).padStart(9),
        String(r.realSecondsAtNormalSpeed > 0 ? r.realSecondsAtNormalSpeed.toFixed(1) + 's' : 'never').padStart(8));
    }

    console.log('\n--- ISSUE 5: FLEET COHESION (spread when fastest engages) ---');
    console.log(String('Battle').padEnd(50), 'MaxSpread', 'FastEng', 'SlowEng', 'SpreadAtEng');
    for (const r of results) {
      console.log(r.label.padEnd(50),
        String(Math.round(r.maxFleetSpread)).padStart(9),
        String(r.ticksBeforeFastestEngages).padStart(7),
        String(r.ticksBeforeSlowestEngages).padStart(7),
        String(r.spreadWhenFastestEngages).padStart(11));
    }

    console.log('\n' + '='.repeat(120));
    const totalInsideNoFire = results.reduce((s, r) => s + r.ticksWhereInsideEnemyDidntFire, 0);
    const totalOverlapFrames = results.reduce((s, r) => s + r.overlapFrames, 0);
    const worstOverlap = Math.max(...results.map(r => r.maxOverlapUnits));
    const avgTurnRatio = results.filter(r => r.turnRatio > 0).reduce((s, r) => s + r.turnRatio, 0) /
      Math.max(1, results.filter(r => r.turnRatio > 0).length);
    const worstSpreadAtEngage = Math.max(...results.map(r => r.spreadWhenFastestEngages));

    console.log('\nSUMMARY:');
    console.log(`  Weapon silent while enemy inside geometry: ${totalInsideNoFire} tick-events`);
    console.log(`  Total collision overlap frames: ${totalOverlapFrames}`);
    console.log(`  Worst overlap: ${worstOverlap} units`);
    console.log(`  Avg large/small turn ratio: ${avgTurnRatio.toFixed(2)} (target: < 0.3)`);
    console.log(`  Worst fleet spread at first engagement: ${worstSpreadAtEngage} units`);

    expect(true).toBe(true);
  });
});
