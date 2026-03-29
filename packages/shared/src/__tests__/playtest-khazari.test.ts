/**
 * Playtest: Khazari — heavy construction/combat species.
 *
 * Tests a full game simulation with the Khazari as the primary player
 * species against AI opponents.  Validates resource accumulation,
 * population growth, and overall game stability over 1500 ticks.
 */

import { describe, it, expect } from 'vitest';
import {
  processGameTick,
  initializeTickState,
  type GameTickState,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig, type PlayerSetup } from '../engine/game-init.js';
import type { Technology } from '../types/technology.js';
import type { Planet } from '../types/galaxy.js';
import techTree from '../../data/tech/universal-tree.json';
import { PREBUILT_SPECIES_BY_ID } from '../../data/species/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const allTechs = (techTree as { technologies: Technology[] }).technologies;

function getColonisedPlanets(state: GameTickState): Planet[] {
  return state.gameState.galaxy.systems
    .flatMap(s => s.planets)
    .filter(p => p.ownerId !== null && p.currentPopulation > 0);
}

function runTicks(
  state: GameTickState,
  ticks: number,
): { state: GameTickState; allEvents: import('../types/events.js').GameEvent[] } {
  let s = state;
  const allEvents: import('../types/events.js').GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = processGameTick(s, allTechs);
    s = result.newState;
    allEvents.push(...result.events);
    if (s.gameState.status !== 'playing') break;
  }
  return { state: s, allEvents };
}

function setupKhazariGame(seed = 100): GameTickState {
  const khazari = PREBUILT_SPECIES_BY_ID['khazari']!;
  const teranos = PREBUILT_SPECIES_BY_ID['teranos']!;
  const sylvani = PREBUILT_SPECIES_BY_ID['sylvani']!;

  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'medium', shape: 'elliptical', playerCount: 3 },
    players: [
      { species: khazari, empireName: 'Khazari Dominion', color: '#FF4444', isAI: true, aiPersonality: 'aggressive' },
      { species: teranos, empireName: 'Teranos Federation', color: '#4488FF', isAI: true, aiPersonality: 'economic' },
      { species: sylvani, empireName: 'Sylvani Concord', color: '#44FF88', isAI: true, aiPersonality: 'researcher' },
    ],
  };
  return initializeTickState(initializeGame(config));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Playtest: Khazari (construction/combat focus)', () => {
  it('runs 1500 ticks without crashing or producing NaN values', () => {
    const initial = setupKhazariGame();
    const { state: final } = runTicks(initial, 1500);

    // No NaN in resources
    for (const [empireId, res] of final.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} resource "${field}" = ${value} is not finite`,
        ).toBe(true);
      }
    }

    // Tick counter advanced
    expect(final.gameState.currentTick).toBeGreaterThanOrEqual(500);
  });

  it('Khazari accumulate positive resources over 1500 ticks', () => {
    const initial = setupKhazariGame();
    const { state: final } = runTicks(initial, 1500);

    const khazariEmpire = final.gameState.empires.find(e => e.name === 'Khazari Dominion')!;
    const resources = final.empireResourcesMap.get(khazariEmpire.id)!;

    // Credits should be positive (economy is functioning)
    expect(resources.credits).toBeGreaterThan(0);

    console.log('[Khazari Playtest] Final resources:', {
      credits: resources.credits,
      minerals: resources.minerals,
      energy: resources.energy,
      researchPoints: resources.researchPoints,
    });
  });

  it('population grows across the galaxy', () => {
    const initial = setupKhazariGame();
    const startPop = getColonisedPlanets(initial).reduce((sum, p) => sum + p.currentPopulation, 0);

    const { state: final } = runTicks(initial, 1500);
    const endPop = getColonisedPlanets(final).reduce((sum, p) => sum + p.currentPopulation, 0);

    expect(endPop).toBeGreaterThan(startPop);
    console.log(`[Khazari Playtest] Population: ${startPop} → ${endPop}`);
  });

  it('logs empire summary at end of simulation', () => {
    const initial = setupKhazariGame();
    const { state: final } = runTicks(initial, 1500);

    for (const empire of final.gameState.empires) {
      const res = final.empireResourcesMap.get(empire.id)!;
      const planets = getColonisedPlanets(final).filter(p => p.ownerId === empire.id);
      const ships = final.gameState.ships.filter(s => {
        const fleet = final.gameState.fleets.find(f => f.id === s.fleetId);
        return fleet?.empireId === empire.id;
      });

      console.log(`[Khazari Playtest] ${empire.name}:`, {
        credits: res.credits,
        minerals: res.minerals,
        techs: empire.technologies.length,
        age: empire.currentAge,
        planets: planets.length,
        ships: ships.length,
        tick: final.gameState.currentTick,
      });
    }
  });
});
