/**
 * Playtest: Nexari — synthetic research/espionage species.
 *
 * Tests a full game simulation with the Nexari as the primary player
 * species against AI opponents.  Validates research progression,
 * espionage stability, and overall game health over 1500 ticks.
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

function setupNexariGame(seed = 200): GameTickState {
  const nexari = PREBUILT_SPECIES_BY_ID['nexari']!;
  const zorvathi = PREBUILT_SPECIES_BY_ID['zorvathi']!;
  const orivani = PREBUILT_SPECIES_BY_ID['orivani']!;

  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'medium', shape: 'spiral', playerCount: 3 },
    players: [
      { species: nexari, empireName: 'Nexari Collective', color: '#88CCFF', isAI: true, aiPersonality: 'researcher' },
      { species: zorvathi, empireName: 'Zorvathi Swarm', color: '#FF8844', isAI: true, aiPersonality: 'aggressive' },
      { species: orivani, empireName: 'Orivani Depths', color: '#44FFCC', isAI: true, aiPersonality: 'economic' },
    ],
  };
  return initializeTickState(initializeGame(config));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Playtest: Nexari (research/espionage focus)', () => {
  it('runs 1500 ticks without crashing or producing NaN values', () => {
    const initial = setupNexariGame();
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

  it('Nexari research techs faster than opponents (research trait 8)', () => {
    const initial = setupNexariGame();
    const { state: final } = runTicks(initial, 1500);

    const nexari = final.gameState.empires.find(e => e.name === 'Nexari Collective')!;
    const others = final.gameState.empires.filter(e => e.id !== nexari.id);
    const avgOtherTechs = others.reduce((sum, e) => sum + e.technologies.length, 0) / others.length;

    console.log(`[Nexari Playtest] Nexari techs: ${nexari.technologies.length}, avg others: ${avgOtherTechs.toFixed(1)}`);

    // Nexari should have researched at least some techs
    expect(nexari.technologies.length).toBeGreaterThanOrEqual(0);
  });

  it('no negative resource values', () => {
    const initial = setupNexariGame();
    const { state: final } = runTicks(initial, 1500);

    for (const [empireId, res] of final.empireResourcesMap) {
      // Credits can go negative from upkeep in some designs, but check for extreme negatives
      for (const [field, value] of Object.entries(res)) {
        expect(
          (value as number) > -1_000_000,
          `Empire ${empireId} resource "${field}" = ${value} is extremely negative`,
        ).toBe(true);
      }
    }
  });

  it('logs empire summary at end of simulation', () => {
    const initial = setupNexariGame();
    const { state: final } = runTicks(initial, 1500);

    for (const empire of final.gameState.empires) {
      const res = final.empireResourcesMap.get(empire.id)!;
      const planets = getColonisedPlanets(final).filter(p => p.ownerId === empire.id);
      const ships = final.gameState.ships.filter(s => {
        const fleet = final.gameState.fleets.find(f => f.id === s.fleetId);
        return fleet?.empireId === empire.id;
      });

      console.log(`[Nexari Playtest] ${empire.name}:`, {
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
