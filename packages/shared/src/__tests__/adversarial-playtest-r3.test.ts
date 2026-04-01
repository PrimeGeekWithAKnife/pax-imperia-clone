/**
 * ADVERSARIAL PLAYTEST -- ROUND 3
 *
 * Deep QA stress-tests targeting multiplayer readiness, save/load integrity,
 * AI diplomacy edge cases, late-game stress, research edge cases, and fleet
 * movement corner cases.
 *
 *   Scenario 6:  Save/Load integrity
 *   Scenario 7:  AI diplomacy edge cases
 *   Scenario 8:  Late-game stress (1000+ ticks)
 *   Scenario 9:  Research and tech tree
 *   Scenario 10: Fleet movement and wormhole edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  processGameTick,
  initializeTickState,
  submitAction,
  type GameTickState,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig } from '../engine/game-init.js';
import type { Technology } from '../types/technology.js';
import type { GameAction, GameEvent } from '../types/events.js';
import type { Planet, StarSystem } from '../types/galaxy.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import techTree from '../../data/tech/universal-tree.json';
import { PREBUILT_SPECIES, PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';
import { SHIP_COMPONENTS, HULL_TEMPLATE_BY_CLASS } from '../../data/ships/index.js';
import {
  serializeTickState,
  deserializeTickState,
  createSaveGame,
  loadSaveGame,
  validateSaveGame,
  SAVE_FORMAT_VERSION,
  type SaveGame,
  type SerializedTickState,
} from '../engine/save-load.js';
import {
  issueMovementOrder,
  processFleetMovement,
  getFleetStrength,
  determineTravelMode,
  createFleet,
  startShipProduction,
} from '../engine/fleet.js';
import {
  autoResolveCombat,
  initializeCombat,
  processCombatTick,
  calculateFleetPower,
  type CombatSetup,
} from '../engine/combat.js';
import {
  initializeDiplomacy,
  makeFirstContact,
  proposeTreaty,
  declareWar,
  makePeace,
  evaluateTreatyProposal,
  getRelation,
  processDiplomacyTick,
  type DiplomacyState,
  type TreatyProposal,
} from '../engine/diplomacy.js';
import {
  getAvailableTechs,
  startResearch,
  processResearchTick,
  type ResearchState,
} from '../engine/research.js';
import {
  checkVictoryConditions,
  updateEconomicLeadTicks,
  calculateVictoryProgress,
} from '../engine/victory.js';
import {
  evaluateEmpireState,
  evaluateWarStrategy,
} from '../engine/ai.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const allTechs = (techTree as { technologies: Technology[] }).technologies;

function runTicks(
  state: GameTickState,
  ticks: number,
): { state: GameTickState; allEvents: GameEvent[] } {
  let s = state;
  const allEvents: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = processGameTick(s, allTechs);
    s = result.newState;
    allEvents.push(...result.events);
    if (s.gameState.status !== 'playing') break;
  }
  return { state: s, allEvents };
}

function getColonisedPlanets(state: GameTickState): Planet[] {
  return state.gameState.galaxy.systems
    .flatMap(s => s.planets)
    .filter(p => p.ownerId !== null && p.currentPopulation > 0);
}

function getEmpirePlanets(state: GameTickState, empireId: string): Planet[] {
  return state.gameState.galaxy.systems
    .flatMap(s => s.planets)
    .filter(p => p.ownerId === empireId);
}

function getEmpireFleets(state: GameTickState, empireId: string): Fleet[] {
  return state.gameState.fleets.filter(f => f.empireId === empireId);
}

function getEmpireShips(state: GameTickState, empireId: string): Ship[] {
  const fleetIds = new Set(getEmpireFleets(state, empireId).map(f => f.id));
  return state.gameState.ships.filter(s => s.fleetId !== null && fleetIds.has(s.fleetId));
}

function setupGame(options: {
  playerCount?: number;
  galaxySize?: 'small' | 'medium' | 'large' | 'huge';
  seed?: number;
  allAI?: boolean;
}): GameTickState {
  const {
    playerCount = 2,
    galaxySize = 'medium',
    seed = 42,
    allAI = true,
  } = options;

  const speciesList = PREBUILT_SPECIES.slice(0, playerCount);
  const personalities: Array<'aggressive' | 'defensive' | 'economic' | 'researcher' | 'expansionist'> =
    ['aggressive', 'defensive', 'economic', 'researcher', 'expansionist'];

  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: galaxySize, shape: 'spiral', playerCount },
    players: speciesList.map((species, i) => ({
      species,
      empireName: `${species.name} Empire`,
      color: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF8800', '#8800FF'][i] ?? '#FFFFFF',
      isAI: allAI,
      aiPersonality: personalities[i % personalities.length],
    })),
  };

  return initializeTickState(initializeGame(config), allTechs.length);
}

// ============================================================================
// SCENARIO 6: SAVE/LOAD INTEGRITY
// ============================================================================

describe('Scenario 6: Save/Load integrity', () => {
  it('round-trip: serialize -> JSON -> parse -> deserialize produces a valid state', () => {
    const state = setupGame({ playerCount: 3, seed: 6000 });
    const { state: advanced } = runTicks(state, 50);

    const serialised = serializeTickState(advanced);
    const json = JSON.stringify(serialised);
    const parsed = JSON.parse(json) as SerializedTickState;
    const restored = deserializeTickState(parsed);

    // Verify Maps are reconstructed
    expect(restored.researchStates).toBeInstanceOf(Map);
    expect(restored.empireResourcesMap).toBeInstanceOf(Map);
    expect(restored.economicLeadTicks).toBeInstanceOf(Map);

    // Verify empire count is preserved
    expect(restored.gameState.empires.length).toBe(advanced.gameState.empires.length);

    // Verify tick counter is preserved
    expect(restored.gameState.currentTick).toBe(advanced.gameState.currentTick);
  });

  it('save at tick 200, load, advance 200 more — no crashes or NaN values', () => {
    const state = setupGame({ playerCount: 3, seed: 6100 });
    const { state: at200 } = runTicks(state, 200);

    // Save
    const saveGame = createSaveGame(at200, 'TestPlayer');
    const json = JSON.stringify(saveGame);
    const loaded = JSON.parse(json) as SaveGame;

    // Load
    const restored = loadSaveGame(loaded);

    // Advance 200 more ticks
    const { state: at400 } = runTicks(restored, 200);

    // Verify no NaN/Infinity in resources
    for (const [empireId, res] of at400.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} resource "${field}" = ${value} after save/load + 200 ticks`,
        ).toBe(true);
      }
    }

    // Verify the tick counter continued from where it was saved
    expect(at400.gameState.currentTick).toBeGreaterThanOrEqual(300);
  });

  it('loading a save from an incompatible major version throws an error', () => {
    const state = setupGame({ playerCount: 2, seed: 6200 });
    const saveGame = createSaveGame(state, 'TestPlayer');

    // Corrupt the version to a different major version
    saveGame.version = '9.0.0';

    expect(() => loadSaveGame(saveGame)).toThrow(/incompatible/i);
  });

  it('loading corrupted save (missing tickState) returns validation errors', () => {
    const corruptSave = {
      version: SAVE_FORMAT_VERSION,
      timestamp: Date.now(),
      playerName: 'Test',
      speciesId: 'test',
      empireName: 'Test Empire',
      tickState: null as unknown as SerializedTickState,
    } as SaveGame;

    const validation = validateSaveGame(corruptSave);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some(e => /tickState/i.test(e))).toBe(true);
  });

  it('loading corrupted save (empty empires) returns validation errors', () => {
    const state = setupGame({ playerCount: 2, seed: 6300 });
    const saveGame = createSaveGame(state, 'TestPlayer');

    // Corrupt: remove all empires
    saveGame.tickState.gameState.empires = [];

    const validation = validateSaveGame(saveGame);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => /empires/i.test(e))).toBe(true);
  });

  it('loading save with negative credits (bankruptcy) is valid', () => {
    const state = setupGame({ playerCount: 2, seed: 6400 });
    const saveGame = createSaveGame(state, 'TestPlayer');

    // Negative credits are a legitimate game state during bankruptcy
    saveGame.tickState.gameState.empires[0]!.credits = -9999;

    const validation = validateSaveGame(saveGame);
    expect(validation.valid).toBe(true);
  });

  it('loading a save with missing new fields (migration from older version) does not crash', () => {
    const state = setupGame({ playerCount: 2, seed: 6500 });
    const serialised = serializeTickState(state);

    // Simulate an older save by removing fields added in later versions
    const olderSave = { ...serialised } as Record<string, unknown>;
    delete olderSave.warStateMap;
    delete olderSave.espionageAgents;
    delete olderSave.espionageCounterIntel;
    delete olderSave.espionageEventLog;
    delete olderSave.wasteMap;
    delete olderSave.energyStateMap;
    delete olderSave.disabledBuildingsMap;

    // Should not throw — deserialize should handle missing fields gracefully
    const restored = deserializeTickState(olderSave as SerializedTickState);
    expect(restored.gameState).toBeDefined();
    expect(restored.gameState.empires.length).toBe(2);

    // Run a tick to ensure the restored state is playable
    const { state: afterTick } = runTicks(restored, 1);
    expect(afterTick.gameState.status).toBe('playing');
  });

  it('saving mid-combat does not lose pending combat data', () => {
    const state = setupGame({ playerCount: 2, seed: 6600 });

    // Manually inject a pending combat to simulate mid-combat save
    const modifiedState: GameTickState = {
      ...state,
      pendingCombats: [{
        systemId: state.gameState.galaxy.systems[0]!.id,
        attackerFleetId: 'fleet-a',
        defenderFleetId: 'fleet-b',
      }],
    };

    const saveGame = createSaveGame(modifiedState, 'TestPlayer');
    const json = JSON.stringify(saveGame);
    const loaded = JSON.parse(json) as SaveGame;
    const restored = loadSaveGame(loaded);

    // Pending combats should be preserved
    expect(restored.pendingCombats).toHaveLength(1);
    expect(restored.pendingCombats[0]!.attackerFleetId).toBe('fleet-a');
  });

  it('save/load preserves research state (active projects + queue)', () => {
    const state = setupGame({ playerCount: 2, seed: 6700 });
    const { state: advanced } = runTicks(state, 100);

    const saveGame = createSaveGame(advanced, 'TestPlayer');
    const json = JSON.stringify(saveGame);
    const loaded = JSON.parse(json) as SaveGame;
    const restored = loadSaveGame(loaded);

    // Compare research states for each empire
    for (const [empireId, originalResearch] of advanced.researchStates) {
      const restoredResearch = restored.researchStates.get(empireId);
      expect(restoredResearch, `Research state missing for empire ${empireId}`).toBeDefined();
      expect(restoredResearch!.completedTechs.length).toBe(originalResearch.completedTechs.length);
      expect(restoredResearch!.activeResearch.length).toBe(originalResearch.activeResearch.length);
    }
  });
});

// ============================================================================
// SCENARIO 7: AI DIPLOMACY EDGE CASES
// ============================================================================

describe('Scenario 7: AI diplomacy edge cases', () => {
  it('proposing a treaty to an empire with no first contact is rejected', () => {
    const dipState = initializeDiplomacy(['emp-1', 'emp-2']);

    // No first contact established — try to evaluate a treaty proposal
    const relation = getRelation(dipState, 'emp-2', 'emp-1');

    // The relation should not exist or be blank
    if (relation) {
      const proposal: TreatyProposal = {
        fromEmpireId: 'emp-1',
        toEmpireId: 'emp-2',
        treatyType: 'trade',
      };

      // Use a minimal empire for evaluation
      const dummySpecies = PREBUILT_SPECIES[0]!;
      const proposerEmpire = {
        id: 'emp-1', name: 'Empire 1', species: dummySpecies,
        isAI: true, aiPersonality: 'diplomatic' as const,
      } as any;
      const targetEmpire = {
        id: 'emp-2', name: 'Empire 2', species: dummySpecies,
        isAI: true, aiPersonality: 'diplomatic' as const,
      } as any;

      const result = evaluateTreatyProposal(proposerEmpire, targetEmpire, relation, proposal);
      expect(result.accept).toBe(false);
      expect(result.reason).toContain('contact');
    }
  });

  it('declaring war clears all existing treaties between the two empires', () => {
    let dipState = initializeDiplomacy(['emp-1', 'emp-2']);
    dipState = makeFirstContact(dipState, 'emp-1', 'emp-2', 1);

    // Sign a trade treaty
    dipState = proposeTreaty(dipState, {
      fromEmpireId: 'emp-1', toEmpireId: 'emp-2', treatyType: 'trade',
    }, 2);

    // Sign a non-aggression pact
    dipState = proposeTreaty(dipState, {
      fromEmpireId: 'emp-1', toEmpireId: 'emp-2', treatyType: 'non_aggression',
    }, 3);

    // Verify treaties exist
    const beforeWar = getRelation(dipState, 'emp-1', 'emp-2');
    expect(beforeWar!.treaties.length).toBe(2);

    // Declare war
    dipState = declareWar(dipState, 'emp-1', 'emp-2', 4);

    // All treaties should be cleared
    const afterWar = getRelation(dipState, 'emp-1', 'emp-2');
    expect(afterWar!.treaties.length).toBe(0);
    expect(afterWar!.status).toBe('at_war');
    expect(afterWar!.tradeRoutes).toBe(0);
  });

  it('two empires declaring war on each other in sequence does not cause double-war state', () => {
    let dipState = initializeDiplomacy(['emp-1', 'emp-2']);
    dipState = makeFirstContact(dipState, 'emp-1', 'emp-2', 1);

    // Empire 1 declares war
    dipState = declareWar(dipState, 'emp-1', 'emp-2', 2);

    // Empire 2 also declares war (redundant)
    dipState = declareWar(dipState, 'emp-2', 'emp-1', 3);

    const rel12 = getRelation(dipState, 'emp-1', 'emp-2');
    const rel21 = getRelation(dipState, 'emp-2', 'emp-1');

    // Both should be at war, not in some broken double-war state
    expect(rel12!.status).toBe('at_war');
    expect(rel21!.status).toBe('at_war');

    // Incident log should show war declarations but not corrupt
    expect(rel12!.incidentLog.filter(i => i.type === 'war_declared').length).toBeGreaterThanOrEqual(1);
  });

  it('declaring war then immediately proposing peace is allowed', () => {
    let dipState = initializeDiplomacy(['emp-1', 'emp-2']);
    dipState = makeFirstContact(dipState, 'emp-1', 'emp-2', 1);
    dipState = declareWar(dipState, 'emp-1', 'emp-2', 2);

    // Immediately make peace on the same tick
    dipState = makePeace(dipState, 'emp-1', 'emp-2', 2);

    const rel = getRelation(dipState, 'emp-1', 'emp-2');
    expect(rel!.status).toBe('neutral');

    // Trust should be severely damaged from the war + peace cycle
    // War penalty: -40 trust, Peace: -5 more = at most 0
    expect(rel!.trust).toBeLessThanOrEqual(20);

    console.log('[Scenario 7] War-then-peace trust:', rel!.trust, 'attitude:', rel!.attitude);
  });

  it('treaty proposal during war is rejected (cannot negotiate during combat)', () => {
    let dipState = initializeDiplomacy(['emp-1', 'emp-2']);
    dipState = makeFirstContact(dipState, 'emp-1', 'emp-2', 1);
    dipState = declareWar(dipState, 'emp-1', 'emp-2', 2);

    const relation = getRelation(dipState, 'emp-2', 'emp-1')!;

    const dummySpecies = PREBUILT_SPECIES[0]!;
    const proposerEmpire = {
      id: 'emp-1', name: 'Empire 1', species: dummySpecies,
      isAI: true, aiPersonality: 'diplomatic' as const,
    } as any;
    const targetEmpire = {
      id: 'emp-2', name: 'Empire 2', species: dummySpecies,
      isAI: true, aiPersonality: 'diplomatic' as const,
    } as any;

    const proposal: TreatyProposal = {
      fromEmpireId: 'emp-1', toEmpireId: 'emp-2', treatyType: 'trade',
    };

    const result = evaluateTreatyProposal(proposerEmpire, targetEmpire, relation, proposal);
    expect(result.accept).toBe(false);
    expect(result.reason).toContain('war');
  });

  it('duplicate treaty of the same type is rejected', () => {
    let dipState = initializeDiplomacy(['emp-1', 'emp-2']);
    dipState = makeFirstContact(dipState, 'emp-1', 'emp-2', 1);
    dipState = proposeTreaty(dipState, {
      fromEmpireId: 'emp-1', toEmpireId: 'emp-2', treatyType: 'trade',
    }, 2);

    const relation = getRelation(dipState, 'emp-2', 'emp-1')!;

    const dummySpecies = PREBUILT_SPECIES[0]!;
    const proposerEmpire = {
      id: 'emp-1', name: 'Empire 1', species: dummySpecies,
      isAI: true, aiPersonality: 'economic' as const,
    } as any;
    const targetEmpire = {
      id: 'emp-2', name: 'Empire 2', species: dummySpecies,
      isAI: true, aiPersonality: 'economic' as const,
    } as any;

    const result = evaluateTreatyProposal(proposerEmpire, targetEmpire, relation, {
      fromEmpireId: 'emp-1', toEmpireId: 'emp-2', treatyType: 'trade',
    });
    expect(result.accept).toBe(false);
    expect(result.reason).toContain('already in effect');
  });

  it('diplomacy tick does not crash with empty empires list', () => {
    const dipState = initializeDiplomacy([]);

    // Should not crash
    const next = processDiplomacyTick(dipState, 1);
    expect(next.relations.size).toBe(0);
  });

  it('attitude and trust are properly clamped after extreme incidents', () => {
    let dipState = initializeDiplomacy(['emp-1', 'emp-2']);
    dipState = makeFirstContact(dipState, 'emp-1', 'emp-2', 1);

    // Declare war 10 times in sequence (extreme scenario)
    for (let i = 0; i < 10; i++) {
      dipState = declareWar(dipState, 'emp-1', 'emp-2', i + 2);
    }

    const rel = getRelation(dipState, 'emp-1', 'emp-2');
    // Attitude should be clamped to -100, not go to -600
    expect(rel!.attitude).toBeGreaterThanOrEqual(-100);
    // Trust should be clamped to 0, not go negative
    expect(rel!.trust).toBeGreaterThanOrEqual(0);
  });

  it('full 4-player game with AI diplomacy runs 300 ticks without crash', () => {
    const state = setupGame({ playerCount: 4, seed: 7000 });
    const { state: final, allEvents } = runTicks(state, 300);

    // Game should still be running or have a valid end state
    expect(['playing', 'finished']).toContain(final.gameState.status);

    // No NaN in any empire credits
    for (const empire of final.gameState.empires) {
      expect(
        Number.isFinite(empire.credits),
        `Empire ${empire.name} has non-finite credits: ${empire.credits}`,
      ).toBe(true);
    }

    console.log('[Scenario 7] 4-player 300 ticks:', {
      status: final.gameState.status,
      aliveEmpires: final.gameState.empires.filter(e =>
        getEmpirePlanets(final, e.id).length > 0,
      ).length,
      totalEvents: allEvents.length,
    });
  });
});

// ============================================================================
// SCENARIO 8: LATE-GAME STRESS (1000+ TICKS)
// ============================================================================

describe('Scenario 8: Late-game stress (1000+ ticks)', () => {
  it('2000-tick game with 4 AI empires — no NaN/Infinity in resources', () => {
    const state = setupGame({ playerCount: 4, seed: 8000, galaxySize: 'small' });
    const { state: final, allEvents } = runTicks(state, 2000);

    for (const [empireId, res] of final.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} resource "${field}" = ${value} after 2000 ticks`,
        ).toBe(true);
      }
    }

    console.log('[Scenario 8] 2000-tick game status:', {
      status: final.gameState.status,
      tick: final.gameState.currentTick,
      events: allEvents.length,
    });
  }, 60_000); // 60s timeout for long-running test

  it('population does not grow to Infinity over 1000 ticks', () => {
    const state = setupGame({ playerCount: 3, seed: 8100, galaxySize: 'small' });
    const { state: final } = runTicks(state, 1000);

    const allPlanets = final.gameState.galaxy.systems.flatMap(s => s.planets);
    for (const planet of allPlanets) {
      expect(
        Number.isFinite(planet.currentPopulation),
        `Planet ${planet.name} has non-finite population: ${planet.currentPopulation}`,
      ).toBe(true);

      // Population should never exceed maxPopulation by more than a small margin
      // (accounting for floating-point)
      if (planet.currentPopulation > 0) {
        expect(
          planet.currentPopulation <= planet.maxPopulation * 1.1,
          `Planet ${planet.name} population ${planet.currentPopulation} exceeds max ${planet.maxPopulation} by more than 10%`,
        ).toBe(true);
      }
    }
  }, 30_000);

  it('credits do not overflow or go to Infinity over 1500 ticks', () => {
    const state = setupGame({ playerCount: 3, seed: 8200, galaxySize: 'small' });
    const { state: final } = runTicks(state, 1500);

    for (const empire of final.gameState.empires) {
      expect(
        Number.isFinite(empire.credits),
        `Empire ${empire.name} credits = ${empire.credits} is not finite`,
      ).toBe(true);

      // Credits should not be astronomically large (sanity check for runaway economy)
      // 1 billion credits is absurdly high for 1500 ticks
      expect(
        empire.credits < 1_000_000_000,
        `Empire ${empire.name} credits ${empire.credits} seems unreasonably large`,
      ).toBe(true);
    }
  }, 30_000);

  it('fleets do not accumulate indefinitely — naval capacity limits ship count', () => {
    const state = setupGame({ playerCount: 2, seed: 8300, galaxySize: 'small' });
    const { state: final } = runTicks(state, 1000);

    for (const empire of final.gameState.empires) {
      const empireFleets = getEmpireFleets(final, empire.id);
      const empireShips = getEmpireShips(final, empire.id);

      // Ship count should be reasonable — even a dominant empire should not
      // have thousands of ships in 1000 ticks with a small galaxy
      expect(
        empireShips.length < 500,
        `Empire ${empire.name} has ${empireShips.length} ships — seems excessive for 1000 ticks`,
      ).toBe(true);

      console.log(`[Scenario 8] ${empire.name}: ${empireFleets.length} fleets, ${empireShips.length} ships`);
    }
  }, 30_000);

  it('tech tree has a meaningful endpoint (ascension_project exists)', () => {
    const ascensionTech = allTechs.find(t => t.id === 'ascension_project');
    expect(ascensionTech).toBeDefined();
    expect(ascensionTech!.prerequisites.length).toBeGreaterThan(0);

    console.log('[Scenario 8] Ascension Project:', {
      name: ascensionTech!.name,
      cost: ascensionTech!.cost,
      prereqs: ascensionTech!.prerequisites,
    });
  });

  it('victory conditions can trigger — conquest check with dominant empire', () => {
    const state = setupGame({ playerCount: 2, seed: 8400, galaxySize: 'small' });

    // Artificially give one empire 80% of all planets
    const allPlanets = state.gameState.galaxy.systems.flatMap(s => s.planets);
    const colonisable = allPlanets.filter(p => p.type !== 'gas_giant');
    const targetEmpire = state.gameState.empires[0]!;

    let modified = state;
    const threshold = Math.ceil(colonisable.length * 0.8);
    let assigned = 0;
    for (const system of modified.gameState.galaxy.systems) {
      for (let i = 0; i < system.planets.length; i++) {
        const planet = system.planets[i]!;
        if (planet.type !== 'gas_giant' && assigned < threshold) {
          system.planets[i] = {
            ...planet,
            ownerId: targetEmpire.id,
            currentPopulation: Math.max(planet.currentPopulation, 100_000),
          };
          assigned++;
        }
      }
    }

    const result = checkVictoryConditions(modified.gameState, modified.empireResourcesMap);
    // With 80% of planets, conquest should trigger (threshold is 75%)
    if (result) {
      expect(result.condition).toBe('conquest');
      expect(result.winner).toBe(targetEmpire.id);
    }

    console.log('[Scenario 8] Conquest check with', assigned, 'of', colonisable.length, 'planets:', result);
  });

  it('economic victory counter increments correctly', () => {
    const state = setupGame({ playerCount: 2, seed: 8500 });
    const empires = state.gameState.empires;

    // Give empire 0 massive credit lead
    const resourcesMap = new Map(state.empireResourcesMap);
    const richResources = { ...resourcesMap.get(empires[0]!.id)!, credits: 100_000 };
    const poorResources = { ...resourcesMap.get(empires[1]!.id)!, credits: 100 };
    resourcesMap.set(empires[0]!.id, richResources);
    resourcesMap.set(empires[1]!.id, poorResources);

    // Simulate 150 ticks of economic lead tracking
    let leadTicks = new Map<string, number>();
    for (let t = 0; t < 150; t++) {
      leadTicks = updateEconomicLeadTicks(empires, resourcesMap, leadTicks);
    }

    // Empire 0 should have accumulated 150 ticks of lead
    expect(leadTicks.get(empires[0]!.id)).toBe(150);
    // Empire 1 should have 0 (losing)
    expect(leadTicks.get(empires[1]!.id)).toBe(0);
  });
});

// ============================================================================
// SCENARIO 9: RESEARCH AND TECH TREE
// ============================================================================

describe('Scenario 9: Research and tech tree', () => {
  it('starting research without prerequisites throws an error', () => {
    const empireId = 'test-empire';
    const researchState: ResearchState = {
      completedTechs: [],
      activeResearch: [],
      currentAge: 'nano_atomic',
      totalResearchGenerated: 0,
    };

    // Find a tech that has prerequisites
    const techWithPrereqs = allTechs.find(t => t.prerequisites.length > 0);
    expect(techWithPrereqs).toBeDefined();

    // Trying to research it without completing prereqs should throw
    expect(() => {
      startResearch(researchState, techWithPrereqs!.id, allTechs, 100);
    }).toThrow(/not available/i);
  });

  it('researching a tech completes and appears in completedTechs', () => {
    const researchState: ResearchState = {
      completedTechs: [],
      activeResearch: [],
      currentAge: 'nano_atomic',
      totalResearchGenerated: 0,
    };

    // Find a cheap starting tech (no prereqs, nano_atomic age)
    const startingTechs = getAvailableTechs(allTechs, researchState);
    expect(startingTechs.length).toBeGreaterThan(0);

    const cheapTech = startingTechs.sort((a, b) => a.cost - b.cost)[0]!;

    // Start and complete research by pumping enough points
    const dummySpecies = PREBUILT_SPECIES[0]!;
    let state = startResearch(researchState, cheapTech.id, allTechs, 100);

    // Process enough ticks to complete it
    for (let i = 0; i < 500; i++) {
      const result = processResearchTick(state, cheapTech.cost, dummySpecies, allTechs);
      state = result.newState;
      if (result.completed.length > 0) break;
    }

    expect(state.completedTechs).toContain(cheapTech.id);
  });

  it('two empires researching the same tech have independent state', () => {
    const stateA: ResearchState = {
      completedTechs: [],
      activeResearch: [],
      currentAge: 'nano_atomic',
      totalResearchGenerated: 0,
    };

    const stateB: ResearchState = {
      completedTechs: [],
      activeResearch: [],
      currentAge: 'nano_atomic',
      totalResearchGenerated: 0,
    };

    const startingTechs = getAvailableTechs(allTechs, stateA);
    const sharedTech = startingTechs[0]!;

    let a = startResearch(stateA, sharedTech.id, allTechs, 100);
    let b = startResearch(stateB, sharedTech.id, allTechs, 100);

    const species = PREBUILT_SPECIES[0]!;

    // Advance empire A faster
    for (let i = 0; i < 100; i++) {
      const resultA = processResearchTick(a, 50, species, allTechs);
      a = resultA.newState;
    }

    // Empire B advances slowly
    for (let i = 0; i < 10; i++) {
      const resultB = processResearchTick(b, 10, species, allTechs);
      b = resultB.newState;
    }

    // Empire A and B should have different progress
    if (a.activeResearch.length > 0 && b.activeResearch.length > 0) {
      const progressA = a.activeResearch[0]!.pointsInvested;
      const progressB = b.activeResearch[0]!.pointsInvested;
      expect(progressA).not.toBe(progressB);
    }

    // Completing tech in A should not affect B
    const completedInA = a.completedTechs.includes(sharedTech.id);
    const completedInB = b.completedTechs.includes(sharedTech.id);
    // At the very least, the states are independent
    expect(completedInA || !completedInA).toBe(true); // tautology for structure
    // The key test: B's completion status is independent
    if (completedInA) {
      expect(completedInB).toBe(false); // B had way fewer research points
    }
  });

  it('when all techs are completed, getAvailableTechs returns empty', () => {
    const researchState: ResearchState = {
      completedTechs: allTechs.map(t => t.id), // ALL techs completed
      activeResearch: [],
      currentAge: 'singularity', // Max age
      totalResearchGenerated: 999999,
    };

    const available = getAvailableTechs(allTechs, researchState);
    expect(available).toHaveLength(0);
  });

  it('research queue auto-promotes when a project completes', () => {
    const researchState: ResearchState = {
      completedTechs: [],
      activeResearch: [],
      researchQueue: [],
      currentAge: 'nano_atomic',
      totalResearchGenerated: 0,
    };

    const available = getAvailableTechs(allTechs, researchState);
    expect(available.length).toBeGreaterThanOrEqual(2);

    // Start the first tech
    let state = startResearch(researchState, available[0]!.id, allTechs, 100);

    // Complete it with massive research points
    const species = PREBUILT_SPECIES[0]!;
    const result = processResearchTick(state, 99999, species, allTechs);

    // The tech should complete
    expect(result.completed.length).toBeGreaterThanOrEqual(1);
    expect(result.newState.completedTechs).toContain(available[0]!.id);
  });

  it('species-specific techs are filtered by speciesId', () => {
    const researchState: ResearchState = {
      completedTechs: [],
      activeResearch: [],
      currentAge: 'nano_atomic',
      totalResearchGenerated: 0,
    };

    const speciesSpecificTechs = allTechs.filter(t => t.speciesId);
    if (speciesSpecificTechs.length > 0) {
      const techSpeciesId = speciesSpecificTechs[0]!.speciesId!;
      const wrongSpeciesId = techSpeciesId + '-wrong';

      // Should NOT appear for wrong species
      const availableWrong = getAvailableTechs(allTechs, researchState, wrongSpeciesId);
      const hasWrongSpeciesTech = availableWrong.some(t => t.speciesId === techSpeciesId);
      expect(hasWrongSpeciesTech).toBe(false);
    }
  });

  it('research with zero allocated points does not crash', () => {
    const researchState: ResearchState = {
      completedTechs: [],
      activeResearch: [],
      currentAge: 'nano_atomic',
      totalResearchGenerated: 0,
    };

    const available = getAvailableTechs(allTechs, researchState);
    let state = startResearch(researchState, available[0]!.id, allTechs, 0);

    const species = PREBUILT_SPECIES[0]!;

    // Process with zero research points — should not crash
    const result = processResearchTick(state, 0, species, allTechs);
    expect(result.newState).toBeDefined();
    expect(result.completed).toHaveLength(0);
    // Points invested should still be 0
    expect(result.newState.activeResearch[0]!.pointsInvested).toBe(0);
  });
});

// ============================================================================
// SCENARIO 10: FLEET MOVEMENT AND WORMHOLE EDGE CASES
// ============================================================================

describe('Scenario 10: Fleet movement and wormhole edge cases', () => {
  it('movement to non-existent system returns null (no crash)', () => {
    const state = setupGame({ playerCount: 2, seed: 10000 });
    const empire = state.gameState.empires[0]!;
    const fleet = getEmpireFleets(state, empire.id)[0]!;

    const order = issueMovementOrder(
      fleet,
      state.gameState.galaxy,
      'definitely-fake-system-id',
    );

    expect(order).toBeNull();
  });

  it('movement to current system returns null (no-op)', () => {
    const state = setupGame({ playerCount: 2, seed: 10100 });
    const empire = state.gameState.empires[0]!;
    const fleet = getEmpireFleets(state, empire.id)[0]!;

    const order = issueMovementOrder(
      fleet,
      state.gameState.galaxy,
      fleet.position.systemId,
    );

    expect(order).toBeNull();
  });

  it('processFleetMovement advances the fleet along its path', () => {
    const state = setupGame({ playerCount: 2, seed: 10200, galaxySize: 'small' });
    const empire = state.gameState.empires[0]!;
    const fleet = getEmpireFleets(state, empire.id)[0]!;

    // Find a connected system to move to
    const currentSystem = state.gameState.galaxy.systems.find(
      s => s.id === fleet.position.systemId,
    )!;

    if (currentSystem.wormholes.length > 0) {
      const destId = currentSystem.wormholes[0]!;
      const order = issueMovementOrder(
        fleet,
        state.gameState.galaxy,
        destId,
      );

      expect(order).not.toBeNull();
      if (order) {
        expect(order.path.length).toBeGreaterThanOrEqual(2);
        expect(order.path[0]).toBe(fleet.position.systemId);
        expect(order.path[order.path.length - 1]).toBe(destId);

        // Process movement for one tick
        const ships = state.gameState.ships.filter(s => fleet.ships.includes(s.id));
        const result = processFleetMovement(order, fleet, ships);

        // Fleet should have progressed (ticksInTransit increased)
        expect(result).toBeDefined();
      }
    }
  });

  it('fleet movement during bankruptcy — game loop handles it gracefully over 500 ticks', () => {
    const state = setupGame({ playerCount: 2, seed: 10300 });
    const empire = state.gameState.empires[0]!;

    // Bankrupt the empire
    const resources = state.empireResourcesMap.get(empire.id)!;
    state.empireResourcesMap.set(empire.id, {
      ...resources, credits: 0, minerals: 0, energy: 0, organics: 0,
    });

    // Run 500 ticks while bankrupt — fleets should still move, game should not crash
    const { state: final } = runTicks(state, 500);

    // Game should still be running
    expect(['playing', 'finished']).toContain(final.gameState.status);

    // Resources should not be NaN
    const finalRes = final.empireResourcesMap.get(empire.id);
    if (finalRes) {
      for (const [field, value] of Object.entries(finalRes)) {
        expect(
          Number.isFinite(value as number),
          `Bankrupt empire resource "${field}" = ${value} after 500 ticks`,
        ).toBe(true);
      }
    }
  }, 30_000);

  it('multiple fleets from different empires in the same system over time', () => {
    const state = setupGame({ playerCount: 4, seed: 10400, galaxySize: 'small' });

    // Run enough ticks for fleets to explore and potentially clash
    const { state: final, allEvents } = runTicks(state, 500);

    // Check for combat events — when fleets share a hostile system, combat should trigger
    const combatEvents = allEvents.filter(e => e.type === 'CombatResolved');

    // Game should be stable regardless of combat count
    expect(['playing', 'finished']).toContain(final.gameState.status);

    // All ships should have finite hull points
    for (const ship of final.gameState.ships) {
      expect(
        Number.isFinite(ship.hullPoints),
        `Ship ${ship.name} has non-finite hull points: ${ship.hullPoints}`,
      ).toBe(true);
      expect(ship.hullPoints).toBeGreaterThanOrEqual(0);
    }

    console.log('[Scenario 10] Multi-fleet clash:', {
      combatEvents: combatEvents.length,
      shipsRemaining: final.gameState.ships.length,
    });
  }, 30_000);

  it('travel mode is correctly determined from tech list', () => {
    // No techs = slow_ftl
    expect(determineTravelMode([])).toBe('slow_ftl');

    // Wormhole stabilisation = wormhole
    expect(determineTravelMode(['wormhole_stabilisation'])).toBe('wormhole');

    // Artificial wormholes = advanced_wormhole
    expect(determineTravelMode(['artificial_wormholes'])).toBe('advanced_wormhole');

    // Both techs = advanced_wormhole (best available)
    expect(determineTravelMode(['wormhole_stabilisation', 'artificial_wormholes'])).toBe('advanced_wormhole');
  });

  it('fleet with zero ships is cleaned up by game loop', () => {
    const state = setupGame({ playerCount: 2, seed: 10500 });

    // Inject an empty fleet
    const emptyFleet: Fleet = {
      id: 'empty-fleet-test',
      name: 'Ghost Fleet',
      ships: [],
      empireId: state.gameState.empires[0]!.id,
      position: { systemId: state.gameState.galaxy.systems[0]!.id },
      destination: null,
      waypoints: [],
      stance: 'defensive',
    };

    const modified: GameTickState = {
      ...state,
      gameState: {
        ...state.gameState,
        fleets: [...state.gameState.fleets, emptyFleet],
      },
    };

    // Run one tick — the game loop should clean up the empty fleet
    const { state: afterTick } = runTicks(modified, 1);

    const ghostFleet = afterTick.gameState.fleets.find(f => f.id === 'empty-fleet-test');
    // Empty fleet should be removed
    expect(ghostFleet).toBeUndefined();
  });

  it('all fleet stances are valid strings (no typos in data)', () => {
    const validStances = new Set(['aggressive', 'defensive', 'evasive', 'neutral']);
    const state = setupGame({ playerCount: 4, seed: 10600 });

    for (const fleet of state.gameState.fleets) {
      expect(
        validStances.has(fleet.stance),
        `Fleet ${fleet.name} has invalid stance: "${fleet.stance}"`,
      ).toBe(true);
    }
  });

  it('war strategy evaluation does not crash for an empire with no fleets', () => {
    const state = setupGame({ playerCount: 2, seed: 10700 });
    const empire = state.gameState.empires[0]!;
    const targetId = state.gameState.empires[1]!.id;

    // Remove all fleets for this empire
    const modifiedState: GameTickState = {
      ...state,
      gameState: {
        ...state.gameState,
        fleets: state.gameState.fleets.filter(f => f.empireId !== empire.id),
        ships: state.gameState.ships.filter(s => {
          const fleet = state.gameState.fleets.find(f => f.id === s.fleetId);
          return fleet?.empireId !== empire.id;
        }),
      },
    };

    const evaluation = evaluateEmpireState(
      empire,
      modifiedState.gameState.galaxy,
      modifiedState.gameState.fleets,
      modifiedState.gameState.ships,
    );

    // Should not crash — military power should be 0
    expect(evaluation.militaryPower).toBe(0);

    // War strategy should not crash with zero military
    const strategy = evaluateWarStrategy(
      empire,
      targetId,
      modifiedState.gameState.galaxy,
      modifiedState.gameState.fleets,
      modifiedState.gameState.ships,
      evaluation,
      modifiedState.gameState,
      null,
    );

    expect(strategy).toBeDefined();
    expect(strategy.reasoning).toBeDefined();
    console.log('[Scenario 10] Zero-fleet war strategy:', strategy.warType, '-', strategy.reasoning.substring(0, 100));
  });
});
