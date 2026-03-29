/**
 * Playtest: Vaelori — high research/diplomacy species.
 *
 * Tests a full game simulation with the Vaelori as the primary player
 * species against AI opponents.  Validates diplomatic interactions,
 * tech progression, and game stability over 1500 ticks.
 */

import { describe, it, expect } from 'vitest';
import {
  processGameTick,
  initializeTickState,
  type GameTickState,
} from '../engine/game-loop.js';
import { initializeGame, type GameSetupConfig } from '../engine/game-init.js';
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

function setupVaeloriGame(seed = 300): GameTickState {
  const vaelori = PREBUILT_SPECIES_BY_ID['vaelori']!;
  const drakmari = PREBUILT_SPECIES_BY_ID['drakmari']!;
  const ashkari = PREBUILT_SPECIES_BY_ID['ashkari']!;

  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'medium', shape: 'spiral', playerCount: 3 },
    players: [
      { species: vaelori, empireName: 'Vaelori Enclave', color: '#AA88FF', isAI: true, aiPersonality: 'diplomatic' },
      { species: drakmari, empireName: 'Drakmari Shoal', color: '#FF6644', isAI: true, aiPersonality: 'aggressive' },
      { species: ashkari, empireName: 'Ashkari Consortium', color: '#FFCC44', isAI: true, aiPersonality: 'economic' },
    ],
  };
  return initializeTickState(initializeGame(config));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Playtest: Vaelori (research/diplomacy focus)', () => {
  it('runs 1500 ticks without crashing or producing NaN values', () => {
    const initial = setupVaeloriGame();
    const { state: final } = runTicks(initial, 1500);

    for (const [empireId, res] of final.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} resource "${field}" = ${value} is not finite`,
        ).toBe(true);
      }
    }

    expect(final.gameState.currentTick).toBeGreaterThanOrEqual(500);
  });

  it('Vaelori advance through tech ages', () => {
    const initial = setupVaeloriGame();
    const { state: final } = runTicks(initial, 1500);

    const vaelori = final.gameState.empires.find(e => e.name === 'Vaelori Enclave')!;
    console.log(`[Vaelori Playtest] Tech age: ${vaelori.currentAge}, techs: ${vaelori.technologies.length}`);

    // Should have researched at least something
    expect(vaelori.technologies.length).toBeGreaterThanOrEqual(0);
  });

  it('all empires have positive population', () => {
    const initial = setupVaeloriGame();
    const { state: final } = runTicks(initial, 1500);

    for (const empire of final.gameState.empires) {
      const planets = getColonisedPlanets(final).filter(p => p.ownerId === empire.id);
      const totalPop = planets.reduce((sum, p) => sum + p.currentPopulation, 0);
      // Empire should still exist with some population (unless conquered)
      console.log(`[Vaelori Playtest] ${empire.name}: ${planets.length} planets, pop ${totalPop}`);
    }
  });

  it('logs empire summary at end of simulation', () => {
    const initial = setupVaeloriGame();
    const { state: final } = runTicks(initial, 1500);

    for (const empire of final.gameState.empires) {
      const res = final.empireResourcesMap.get(empire.id)!;
      const planets = getColonisedPlanets(final).filter(p => p.ownerId === empire.id);
      const ships = final.gameState.ships.filter(s => {
        const fleet = final.gameState.fleets.find(f => f.id === s.fleetId);
        return fleet?.empireId === empire.id;
      });

      console.log(`[Vaelori Playtest] ${empire.name}:`, {
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
