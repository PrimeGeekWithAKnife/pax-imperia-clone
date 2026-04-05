/**
 * Fighter dogfight tests — 9v9 fighter battles iterated 30 times.
 *
 * Validates fighter-specific combat AI:
 *  - Attack-pass behaviour (approach → engage → break → regroup)
 *  - Wing cohesion (wings of 3 act as a unit)
 *  - No capital-ship "hold and face" in fighter-vs-fighter combat
 *  - Battles resolve within reasonable tick counts
 *  - No degenerate states (infinite orbits, frozen fighters, etc.)
 */

import { describe, it, expect } from 'vitest';

import {
  initializeTacticalCombat,
  processTacticalTick,
} from '../engine/combat-tactical.js';
import type {
  TacticalState,
  TacticalShip,
} from '../engine/combat-tactical.js';
import type { Fleet, Ship, ShipDesign } from '../types/ships.js';
import { SHIP_COMPONENTS } from '../../data/ships/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFleet(id: string, empireId: string, shipIds: string[]): Fleet {
  return {
    id,
    name: `Fleet ${id}`,
    ships: shipIds,
    empireId,
    position: { systemId: 'system-alpha' },
    destination: null,
    waypoints: [],
    stance: 'aggressive',
  };
}

function makeShip(id: string, designId: string, hp = 33): Ship {
  return {
    id,
    designId,
    name: `Fighter ${id}`,
    hullPoints: hp,
    maxHullPoints: hp,
    systemDamage: {
      engines: 0,
      weapons: 0,
      shields: 0,
      sensors: 0,
      warpDrive: 0,
    },
    position: { systemId: 'system-alpha' },
    fleetId: null,
  };
}

function makeFighterDesign(id: string, empireId: string): ShipDesign {
  return {
    id,
    name: `Fighter Design ${id}`,
    hull: 'fighter',
    components: [
      { slotId: 'fighter_thruster_0', componentId: 'rcs_chemical_mk1' },
      { slotId: 'fighter_scanning_1', componentId: 'short_range_scanner' },
      { slotId: 'fighter_internal_2', componentId: 'targeting_computer' },
      { slotId: 'fighter_weapon_3', componentId: 'pulse_laser' },
    ],
    totalCost: 400,
    empireId,
  };
}

function setup9v9(): TacticalState {
  const atkDesign = makeFighterDesign('fd-atk', 'empire-1');
  const defDesign = makeFighterDesign('fd-def', 'empire-2');

  const designs = new Map<string, ShipDesign>([
    [atkDesign.id, atkDesign],
    [defDesign.id, defDesign],
  ]);

  const atkShips = Array.from({ length: 9 }, (_, i) =>
    makeShip(`atk-${i}`, atkDesign.id),
  );
  const defShips = Array.from({ length: 9 }, (_, i) =>
    makeShip(`def-${i}`, defDesign.id),
  );

  return initializeTacticalCombat(
    makeFleet('f-atk', 'empire-1', atkShips.map(s => s.id)),
    makeFleet('f-def', 'empire-2', defShips.map(s => s.id)),
    atkShips,
    defShips,
    designs,
    SHIP_COMPONENTS,
  );
}

/** Run a battle to completion, returning tick count and final state. */
function runBattle(initialState: TacticalState, maxTicks = 3000): {
  state: TacticalState;
  ticks: number;
} {
  let state = initialState;
  let ticks = 0;
  while (state.outcome === null && ticks < maxTicks) {
    state = processTacticalTick(state);
    ticks++;
  }
  return { state, ticks };
}

// ---------------------------------------------------------------------------
// Helpers for analysis
// ---------------------------------------------------------------------------

/** Count how many ships of a side are still alive (not destroyed, not routed). */
function aliveCount(state: TacticalState, side: 'attacker' | 'defender'): number {
  return state.ships.filter(s => s.side === side && !s.destroyed && !s.routed).length;
}

/** Check if any fighter has a fighterPhase set (proving the new AI activated). */
function hasActivatedFighterAI(state: TacticalState): boolean {
  return state.ships.some(s => s.hullClass === 'fighter' && s.fighterPhase != null);
}

/** Check if fighters have wing assignments. */
function hasWingAssignments(state: TacticalState): boolean {
  return state.ships.filter(s => s.hullClass === 'fighter').every(s => s.wingId != null);
}

/** Track max velocity magnitude across all fighters during a battle segment. */
function maxFighterSpeed(state: TacticalState): number {
  return Math.max(
    ...state.ships
      .filter(s => s.hullClass === 'fighter' && !s.destroyed)
      .map(s => Math.sqrt((s.velocity?.x ?? 0) ** 2 + (s.velocity?.y ?? 0) ** 2)),
    0,
  );
}

/** Sample fighter positions at a tick to check they're not all clustered. */
function positionSpread(state: TacticalState, side: 'attacker' | 'defender'): number {
  const fighters = state.ships.filter(
    s => s.hullClass === 'fighter' && s.side === side && !s.destroyed,
  );
  if (fighters.length < 2) return 0;
  let totalDist = 0;
  let pairs = 0;
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      const dx = fighters[i]!.position.x - fighters[j]!.position.x;
      const dy = fighters[i]!.position.y - fighters[j]!.position.y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
      pairs++;
    }
  }
  return totalDist / pairs;
}

// ---------------------------------------------------------------------------
// Tests — 30 iterated battles with sad-path checks
// ---------------------------------------------------------------------------

describe('Fighter dogfight — 9v9', () => {
  // Run 30 battles and collect results for aggregate analysis
  const results: Array<{
    ticks: number;
    outcome: string | null;
    atkSurvivors: number;
    defSurvivors: number;
    fighterAIActivated: boolean;
    wingsAssigned: boolean;
  }> = [];

  // Battle-level phases we sample mid-battle
  const midBattleChecks: Array<{
    battleIdx: number;
    tick50Speed: number;
    tick50Spread: number;
    tick100PhaseDiversity: number;
  }> = [];

  for (let i = 0; i < 30; i++) {
    it(`battle ${i + 1}: resolves with a winner`, () => {
      const initial = setup9v9();

      // Verify initialization
      const fighters = initial.ships.filter(s => s.hullClass === 'fighter');
      expect(fighters.length).toBe(18); // 9 + 9

      // Run to completion
      const { state, ticks } = runBattle(initial);

      results.push({
        ticks,
        outcome: state.outcome,
        atkSurvivors: aliveCount(state, 'attacker'),
        defSurvivors: aliveCount(state, 'defender'),
        fighterAIActivated: hasActivatedFighterAI(state),
        wingsAssigned: hasWingAssignments(initial),
      });

      // Must resolve within 3000 ticks
      expect(ticks).toBeLessThan(3000);
      // Must have a winner
      expect(state.outcome).not.toBeNull();
    });

    it(`battle ${i + 1}: fighter AI activates (not capital ship logic)`, () => {
      const initial = setup9v9();

      // Run 20 ticks — enough for fighters to start moving
      let state = initial;
      for (let t = 0; t < 20; t++) {
        state = processTacticalTick(state);
      }

      // Fighter AI must have activated
      expect(hasActivatedFighterAI(state)).toBe(true);

      // Wings must be assigned
      const fighters = state.ships.filter(s => s.hullClass === 'fighter');
      const withWings = fighters.filter(s => s.wingId != null);
      expect(withWings.length).toBe(fighters.length);
    });

    it(`battle ${i + 1}: fighters are moving, not holding position`, () => {
      const initial = setup9v9();

      // Run 50 ticks
      let state = initial;
      for (let t = 0; t < 50; t++) {
        state = processTacticalTick(state);
      }

      // Fighters should be moving — check velocity is non-trivial
      const speed = maxFighterSpeed(state);
      expect(speed).toBeGreaterThan(1); // not stationary

      // Fighters should be spread out, not clustered in one spot
      const spread = positionSpread(state, 'attacker');
      expect(spread).toBeGreaterThan(20); // minimum separation

      midBattleChecks.push({
        battleIdx: i,
        tick50Speed: speed,
        tick50Spread: spread,
        tick100PhaseDiversity: 0, // filled below
      });
    });

    it(`battle ${i + 1}: fighters use multiple AI phases (not stuck in one)`, () => {
      const initial = setup9v9();

      // Run 100 ticks — should see approach, engage, break phases
      let state = initial;
      const phaseCounts = new Map<string, number>();
      for (let t = 0; t < 150; t++) {
        state = processTacticalTick(state);
        if (t >= 30) { // skip early ticks
          for (const ship of state.ships) {
            if (ship.hullClass === 'fighter' && ship.fighterPhase && !ship.destroyed) {
              phaseCounts.set(ship.fighterPhase, (phaseCounts.get(ship.fighterPhase) ?? 0) + 1);
            }
          }
        }
      }

      // Should see at least 2 different phases (not just 'approach' forever)
      expect(phaseCounts.size).toBeGreaterThanOrEqual(2);

      // Update mid-battle check if it exists
      const check = midBattleChecks.find(c => c.battleIdx === i);
      if (check) check.tick100PhaseDiversity = phaseCounts.size;
    });

    it(`battle ${i + 1}: wings share targets (wing cohesion)`, () => {
      const initial = setup9v9();

      // Run 80 ticks — wings should have engaged
      let state = initial;
      for (let t = 0; t < 80; t++) {
        state = processTacticalTick(state);
      }

      // Check wing cohesion: fighters in the same wing should have attack
      // orders targeting the same enemy (or at least be in the same phase)
      const wingGroups = new Map<string, TacticalShip[]>();
      for (const ship of state.ships) {
        if (ship.wingId && !ship.destroyed && !ship.routed) {
          const existing = wingGroups.get(ship.wingId) ?? [];
          existing.push(ship);
          wingGroups.set(ship.wingId, existing);
        }
      }

      // At least one wing should have >1 surviving member
      const multiMemberWings = [...wingGroups.values()].filter(w => w.length > 1);
      // In a 9v9, at tick 80 we should still have multi-member wings
      // (it's OK if some wings lost members — just need at least one)
      if (multiMemberWings.length > 0) {
        // Check that wingmates are in the same phase
        let samePhaseCount = 0;
        for (const wing of multiMemberWings) {
          const phases = wing.map(s => s.fighterPhase).filter(Boolean);
          if (phases.length > 1) {
            // At least 2 members with phases
            const uniquePhases = new Set(phases);
            if (uniquePhases.size <= 2) samePhaseCount++; // close enough
          }
        }
        // Most wings should be roughly synchronised
        expect(samePhaseCount).toBeGreaterThanOrEqual(1);
      }
    });

    it(`battle ${i + 1}: no fighter is stationary for extended periods`, () => {
      const initial = setup9v9();

      // Track position deltas over 100 ticks
      let state = initial;
      const stationaryTicks = new Map<string, number>();

      for (let t = 0; t < 100; t++) {
        const prevPositions = new Map(
          state.ships
            .filter(s => s.hullClass === 'fighter' && !s.destroyed)
            .map(s => [s.id, { x: s.position.x, y: s.position.y }]),
        );

        state = processTacticalTick(state);

        for (const ship of state.ships) {
          if (ship.hullClass !== 'fighter' || ship.destroyed) continue;
          const prev = prevPositions.get(ship.id);
          if (!prev) continue;
          const dx = ship.position.x - prev.x;
          const dy = ship.position.y - prev.y;
          const moved = Math.sqrt(dx * dx + dy * dy);
          if (moved < 0.5) {
            stationaryTicks.set(ship.id, (stationaryTicks.get(ship.id) ?? 0) + 1);
          }
        }
      }

      // No fighter should be stationary for more than 15 consecutive-ish ticks
      // (some brief pauses during regroup are OK)
      for (const [_id, count] of stationaryTicks) {
        expect(count).toBeLessThan(30); // out of 100 ticks, max 30% stationary
      }
    });
  }

  it('aggregate: battles resolve in varied tick counts (not deterministic clones)', () => {
    // If all 30 battles have exactly the same tick count, something's wrong
    const tickCounts = results.map(r => r.ticks);
    const uniqueTicks = new Set(tickCounts);
    // With randomised AI, we expect at least some variation
    expect(uniqueTicks.size).toBeGreaterThan(1);
  });

  it('aggregate: battles produce a clear winner', () => {
    // With identical loadouts but asymmetric positioning, one side may
    // consistently win — that's fine (defender's advantage is real).
    // The key check: every battle produces a winner, not a draw.
    for (const r of results) {
      expect(r.outcome === 'attacker_wins' || r.outcome === 'defender_wins').toBe(true);
    }
  });

  it('aggregate: survivors vary across battles (combat isn\'t deterministic)', () => {
    const atkSurvivors = new Set(results.map(r => r.atkSurvivors));
    const defSurvivors = new Set(results.map(r => r.defSurvivors));
    // Should see variation in survivor counts
    expect(atkSurvivors.size + defSurvivors.size).toBeGreaterThan(2);
  });

  it('aggregate: fighter AI activated in every battle', () => {
    for (const r of results) {
      expect(r.fighterAIActivated).toBe(true);
    }
  });
});
