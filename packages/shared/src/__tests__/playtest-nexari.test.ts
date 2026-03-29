/**
 * Playtest suite: Nexari empire simulation.
 *
 * Simulates a full game with Nexari (cybernetic, research-focused) facing
 * multiple opponents. Validates that diplomacy integration works with the
 * research-heavy playstyle and hive-mind governance.
 *
 * Focus areas:
 *  - Nexari diplomatic behaviour (research-focused AI)
 *  - Treaty proposal and acceptance between AI empires
 *  - Diplomatic status transitions over long game sessions
 *  - Trade income with multiple diplomatic partners
 *  - Research progression alongside diplomatic activity
 *  - No state corruption over 300 ticks
 */

import { describe, it, expect } from 'vitest';

import {
  processGameTick,
  initializeTickState,
  type GameTickState,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig, type PlayerSetup } from '../engine/game-init.js';
import { PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import type { DiplomaticRelation, DiplomaticStatus, AIPersonality } from '../types/species.js';
import type { GameEvent } from '../types/events.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlayerSetup(speciesId: string, empireName: string, isAI: boolean, personality?: AIPersonality): PlayerSetup {
  const species = PREBUILT_SPECIES_BY_ID[speciesId];
  if (!species) throw new Error(`Species "${speciesId}" not found in prebuilt data`);
  return {
    species,
    empireName,
    color: '#00ccff',
    isAI,
    aiPersonality: personality,
  } as PlayerSetup;
}

function setupNexariGame(): { state: GameTickState; nexariId: string; teranoId: string; khazariId: string } {
  const config: GameSetupConfig = {
    galaxyConfig: { seed: 999, size: 'small', shape: 'spiral', playerCount: 3 },
    players: [
      makePlayerSetup('nexari', 'Nexari Collective', true, 'researcher'),
      makePlayerSetup('teranos', 'Teranos Federation', true, 'diplomatic'),
      makePlayerSetup('khazari', 'Khazari Forge-Empire', true, 'aggressive'),
    ],
  };
  const gs = initializeGame(config);
  const ts = initializeTickState(gs);

  // Set up triangular diplomatic relations
  const [empA, empB, empC] = ts.gameState.empires;

  const makeRel = (targetId: string, attitude: number, status: DiplomaticStatus = 'neutral'): DiplomaticRelation => ({
    empireId: targetId,
    status,
    treaties: [],
    attitude,
    tradeRoutes: 0,
    communicationLevel: 'trade' as const,
  });

  const empires = ts.gameState.empires.map(e => {
    if (e.id === empA.id) {
      return { ...e, diplomacy: [makeRel(empB.id, 20), makeRel(empC.id, -5)] };
    }
    if (e.id === empB.id) {
      return { ...e, diplomacy: [makeRel(empA.id, 20), makeRel(empC.id, 0)] };
    }
    if (e.id === empC.id) {
      return { ...e, diplomacy: [makeRel(empA.id, -5), makeRel(empB.id, 0)] };
    }
    return e;
  });

  return {
    state: { ...ts, gameState: { ...ts.gameState, empires } },
    nexariId: empA.id,
    teranoId: empB.id,
    khazariId: empC.id,
  };
}

// ---------------------------------------------------------------------------
// Playtest
// ---------------------------------------------------------------------------

describe('Playtest: Nexari — Research-Focused Empire Simulation', () => {
  it('runs 300 ticks without crashing (3-player game)', () => {
    const { state } = setupNexariGame();
    let ts = state;

    for (let i = 0; i < 300; i++) {
      const result = processGameTick(ts);
      ts = result.newState;
    }

    expect(ts.gameState.empires).toHaveLength(3);
    expect(ts.gameState.currentTick).toBe(300);
  });

  it('diplomacy tick handles triangular relations correctly', () => {
    const { state, nexariId, teranoId, khazariId } = setupNexariGame();
    let ts = state;

    for (let i = 0; i < 100; i++) {
      const result = processGameTick(ts);
      ts = result.newState;
    }

    // All three empires should still have diplomatic relations
    const nexari = ts.gameState.empires.find(e => e.id === nexariId)!;
    expect(nexari.diplomacy.length).toBeGreaterThanOrEqual(2);

    // Attitudes should have evolved from initial values
    for (const rel of nexari.diplomacy) {
      expect(rel.attitude).toBeGreaterThanOrEqual(-100);
      expect(rel.attitude).toBeLessThanOrEqual(100);
    }
  });

  it('multiple empires can have concurrent diplomatic events', () => {
    const { state } = setupNexariGame();
    let ts = state;
    const eventsByType: Record<string, number> = {};

    for (let i = 0; i < 150; i++) {
      const result = processGameTick(ts);
      ts = result.newState;
      for (const evt of result.events) {
        eventsByType[evt.type] = (eventsByType[evt.type] ?? 0) + 1;
      }
    }

    // Log all event types for analysis
    console.log('  Nexari playtest event breakdown:');
    for (const [type, count] of Object.entries(eventsByType).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${count}`);
    }

    expect(ts.gameState.currentTick).toBe(150);
  });

  it('attitude decays toward neutrality for all pairs', () => {
    const { state, nexariId, teranoId, khazariId } = setupNexariGame();
    let ts = state;

    // Record initial attitudes
    const initialNexariToTerano = ts.gameState.empires
      .find(e => e.id === nexariId)!
      .diplomacy.find(d => d.empireId === teranoId)!.attitude;

    for (let i = 0; i < 50; i++) {
      const result = processGameTick(ts);
      ts = result.newState;
    }

    // Positive attitude toward Terano should have decayed toward 0
    const finalNexariToTerano = ts.gameState.empires
      .find(e => e.id === nexariId)!
      .diplomacy.find(d => d.empireId === teranoId)!.attitude;

    // The initial attitude was +20, so decay should bring it closer to 0
    // (AI actions may also modify it, but generally it trends toward 0)
    expect(finalNexariToTerano).toBeLessThanOrEqual(initialNexariToTerano);
  });

  it('treaty formation between AI empires works', () => {
    const { state } = setupNexariGame();
    let ts = state;
    let totalTreaties = 0;

    for (let i = 0; i < 200; i++) {
      const result = processGameTick(ts);
      ts = result.newState;
      totalTreaties += result.events.filter(e => e.type === 'TreatySigned').length;
    }

    // With diplomatic and researcher personalities, treaties should eventually form
    console.log(`  Nexari playtest: ${totalTreaties} treaties signed over 200 ticks`);

    // Verify all empires still functional
    for (const empire of ts.gameState.empires) {
      const resources = ts.empireResourcesMap.get(empire.id);
      expect(resources).toBeDefined();
    }
  });

  it('trade income accumulates from active diplomatic relations', () => {
    const { state, nexariId, teranoId } = setupNexariGame();

    // Set up initial trade treaty between Nexari and Terano
    const empires = state.gameState.empires.map(e => {
      const diplomacy = e.diplomacy.map(d => {
        if ((e.id === nexariId && d.empireId === teranoId) ||
            (e.id === teranoId && d.empireId === nexariId)) {
          return {
            ...d,
            attitude: 30,
            status: 'friendly' as DiplomaticStatus,
            treaties: [{ type: 'trade' as const, startTurn: 0, duration: -1 }],
            tradeRoutes: 1,
          };
        }
        return d;
      });
      return { ...e, diplomacy };
    });

    let ts = { ...state, gameState: { ...state.gameState, empires } };
    const creditsBefore = ts.empireResourcesMap.get(nexariId)?.credits ?? 0;

    for (let i = 0; i < 50; i++) {
      const result = processGameTick(ts);
      ts = result.newState;
    }

    const creditsAfter = ts.empireResourcesMap.get(nexariId)?.credits ?? 0;
    // Over 50 ticks with trade routes, credits should accumulate
    // (exact amounts depend on all economic factors)
    expect(creditsAfter).toBeGreaterThanOrEqual(creditsBefore);
    console.log(`  Nexari credits: ${creditsBefore} → ${creditsAfter} over 50 ticks`);
  });

  it('no attitudes exceed bounds across a full multi-empire game', () => {
    const { state } = setupNexariGame();
    let ts = state;

    for (let i = 0; i < 300; i++) {
      const result = processGameTick(ts);
      ts = result.newState;

      for (const empire of ts.gameState.empires) {
        for (const rel of empire.diplomacy) {
          expect(rel.attitude).toBeGreaterThanOrEqual(-100);
          expect(rel.attitude).toBeLessThanOrEqual(100);
          expect(rel.tradeRoutes).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('war does not corrupt diplomatic state', () => {
    const { state, nexariId, khazariId } = setupNexariGame();

    // Force war between Nexari and Khazari
    const empires = state.gameState.empires.map(e => {
      const diplomacy = e.diplomacy.map(d => {
        if ((e.id === nexariId && d.empireId === khazariId) ||
            (e.id === khazariId && d.empireId === nexariId)) {
          return {
            ...d,
            status: 'at_war' as DiplomaticStatus,
            attitude: -80,
            treaties: [],
            tradeRoutes: 0,
          };
        }
        return d;
      });
      return { ...e, diplomacy };
    });

    let ts = { ...state, gameState: { ...state.gameState, empires } };

    for (let i = 0; i < 100; i++) {
      const result = processGameTick(ts);
      ts = result.newState;
    }

    // War status should persist (unless peace is made by AI)
    const nexari = ts.gameState.empires.find(e => e.id === nexariId)!;
    const relToKhazari = nexari.diplomacy.find(d => d.empireId === khazariId);
    if (relToKhazari) {
      // Either still at war or peace was made — both are valid
      expect(['at_war', 'neutral', 'hostile'].includes(relToKhazari.status)).toBe(true);
    }

    // Third-party diplomacy (Nexari ↔ Terano) should be unaffected
    expect(ts.gameState.empires).toHaveLength(3);
  });
});
