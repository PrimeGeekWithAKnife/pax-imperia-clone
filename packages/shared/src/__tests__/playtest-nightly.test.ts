/**
 * Nightly Playtest: Drakmari military/domination focus.
 *
 * This playtest exercises the game engine over 2500 ticks with the
 * Drakmari (combat trait 9) as the dominant aggressor, testing:
 *  - Military/conquest victory conditions
 *  - Aggressive AI rogue player behaviour
 *  - Resource rates, fleet sizes, and tech progress under combat pressure
 *  - Multiple play styles: aggressive expansion, turtling, diplomatic
 *
 * Species: Drakmari (aggressive), Luminari (diplomatic turtler),
 *          Pyrenth (economic expansionist), Thyriaq (rogue aggressor)
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

function getEmpiresShips(state: GameTickState, empireId: string): number {
  const fleetIds = new Set(
    state.gameState.fleets.filter(f => f.empireId === empireId).map(f => f.id),
  );
  return state.gameState.ships.filter(s => s.fleetId !== null && fleetIds.has(s.fleetId)).length;
}

interface TickSnapshot {
  tick: number;
  empires: {
    name: string;
    credits: number;
    minerals: number;
    energy: number;
    researchPoints: number;
    techs: number;
    age: string;
    planets: number;
    ships: number;
    population: number;
  }[];
}

function takeSnapshot(state: GameTickState): TickSnapshot {
  return {
    tick: state.gameState.currentTick,
    empires: state.gameState.empires.map(empire => {
      const res = state.empireResourcesMap.get(empire.id)!;
      const planets = getColonisedPlanets(state).filter(p => p.ownerId === empire.id);
      const pop = planets.reduce((sum, p) => sum + p.currentPopulation, 0);
      return {
        name: empire.name,
        credits: res.credits,
        minerals: res.minerals,
        energy: res.energy,
        researchPoints: res.researchPoints,
        techs: empire.technologies.length,
        age: empire.currentAge,
        planets: planets.length,
        ships: getEmpiresShips(state, empire.id),
        population: pop,
      };
    }),
  };
}

function runTicksWithSnapshots(
  state: GameTickState,
  ticks: number,
  snapshotInterval: number,
): {
  state: GameTickState;
  snapshots: TickSnapshot[];
  allEvents: import('../types/events.js').GameEvent[];
  combatEvents: import('../types/events.js').GameEvent[];
} {
  let s = state;
  const snapshots: TickSnapshot[] = [];
  const allEvents: import('../types/events.js').GameEvent[] = [];
  const combatEvents: import('../types/events.js').GameEvent[] = [];

  for (let i = 0; i < ticks; i++) {
    const result = processGameTick(s, allTechs);
    s = result.newState;
    allEvents.push(...result.events);

    for (const evt of result.events) {
      if (evt.type === 'combat_resolved' || evt.type === 'combat_started') {
        combatEvents.push(evt);
      }
    }

    if (s.gameState.currentTick % snapshotInterval === 0) {
      snapshots.push(takeSnapshot(s));
    }

    if (s.gameState.status !== 'playing') break;
  }

  // Final snapshot
  snapshots.push(takeSnapshot(s));

  return { state: s, snapshots, allEvents, combatEvents };
}

function setupNightlyGame(seed = 777): GameTickState {
  const drakmari = PREBUILT_SPECIES_BY_ID['drakmari']!;
  const luminari = PREBUILT_SPECIES_BY_ID['luminari']!;
  const pyrenth = PREBUILT_SPECIES_BY_ID['pyrenth']!;
  const thyriaq = PREBUILT_SPECIES_BY_ID['thyriaq']!;

  const config: GameSetupConfig = {
    galaxyConfig: { seed, size: 'medium', shape: 'spiral', playerCount: 4 },
    players: [
      // Main test subject: Drakmari aggressor
      {
        species: drakmari,
        empireName: 'Drakmari Shoal',
        color: '#FF2222',
        isAI: true,
        aiPersonality: 'aggressive',
        government: 'military_junta',
      },
      // Rogue aggressor: Thyriaq (espionage-focused, but playing aggressively)
      {
        species: thyriaq,
        empireName: 'Thyriaq Rogue Fleet',
        color: '#AA00FF',
        isAI: true,
        aiPersonality: 'aggressive',
      },
      // Turtle/diplomat: Luminari (high diplomacy)
      {
        species: luminari,
        empireName: 'Luminari Concord',
        color: '#FFDD44',
        isAI: true,
        aiPersonality: 'defensive',
      },
      // Economic expansionist: Pyrenth
      {
        species: pyrenth,
        empireName: 'Pyrenth Commerce Guild',
        color: '#44DDFF',
        isAI: true,
        aiPersonality: 'expansionist',
      },
    ],
    victoryCriteria: ['conquest'],
  };
  return initializeTickState(initializeGame(config));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Nightly Playtest: Drakmari military/domination', () => {
  it('runs 2500 ticks without crashing or producing NaN/Infinity values', () => {
    const initial = setupNightlyGame();
    const { state: final } = runTicksWithSnapshots(initial, 2500, 500);

    // Validate no NaN/Infinity in any resource
    for (const [empireId, res] of final.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} resource "${field}" = ${value} is not finite`,
        ).toBe(true);
      }
    }

    expect(final.gameState.currentTick).toBeGreaterThanOrEqual(1000);
  }, 30_000);

  it('no negative population on any planet', () => {
    const initial = setupNightlyGame();
    const { state: final } = runTicksWithSnapshots(initial, 2500, 500);

    const allPlanets = final.gameState.galaxy.systems.flatMap(s => s.planets);
    for (const planet of allPlanets) {
      expect(
        planet.currentPopulation >= 0,
        `Planet ${planet.id} has negative population: ${planet.currentPopulation}`,
      ).toBe(true);
    }
  }, 30_000);

  it('resource rates remain finite throughout the simulation', () => {
    const initial = setupNightlyGame();
    const { snapshots } = runTicksWithSnapshots(initial, 2500, 250);

    for (const snapshot of snapshots) {
      for (const empire of snapshot.empires) {
        expect(Number.isFinite(empire.credits), `${empire.name} credits NaN at tick ${snapshot.tick}`).toBe(true);
        expect(Number.isFinite(empire.minerals), `${empire.name} minerals NaN at tick ${snapshot.tick}`).toBe(true);
        expect(Number.isFinite(empire.energy), `${empire.name} energy NaN at tick ${snapshot.tick}`).toBe(true);
        expect(Number.isFinite(empire.researchPoints), `${empire.name} RP NaN at tick ${snapshot.tick}`).toBe(true);
      }
    }
  }, 30_000);

  it('logs resource rates and fleet sizes over time', () => {
    const initial = setupNightlyGame();
    const { snapshots, combatEvents, state: final } = runTicksWithSnapshots(initial, 2500, 500);

    console.log('\n=== NIGHTLY PLAYTEST: DRAKMARI MILITARY/DOMINATION ===\n');

    for (const snapshot of snapshots) {
      console.log(`--- Tick ${snapshot.tick} ---`);
      for (const empire of snapshot.empires) {
        console.log(`  ${empire.name}: credits=${empire.credits.toFixed(0)}, minerals=${empire.minerals.toFixed(0)}, ` +
          `techs=${empire.techs} (${empire.age}), planets=${empire.planets}, ships=${empire.ships}, pop=${empire.population}`);
      }
    }

    console.log(`\nCombat events: ${combatEvents.length}`);
    console.log(`Game ended: ${final.gameState.status} at tick ${final.gameState.currentTick}`);

    // Check if conquest victory was achieved
    if (final.gameState.status === 'finished') {
      console.log('Victory achieved during simulation!');
    }
  }, 30_000);

  it('tech progression is consistent — no empire loses researched techs', () => {
    const initial = setupNightlyGame();

    let prevTechCounts = new Map<string, number>();
    let s = initial;

    for (let i = 0; i < 2500; i++) {
      const result = processGameTick(s, allTechs);
      s = result.newState;

      if (s.gameState.currentTick % 100 === 0) {
        for (const empire of s.gameState.empires) {
          const prevCount = prevTechCounts.get(empire.id) ?? 0;
          expect(
            empire.technologies.length >= prevCount,
            `${empire.name} lost techs at tick ${s.gameState.currentTick}: ${prevCount} → ${empire.technologies.length}`,
          ).toBe(true);
          prevTechCounts.set(empire.id, empire.technologies.length);
        }
      }

      if (s.gameState.status !== 'playing') break;
    }
  }, 30_000);

  it('aggressive AI produces ships over time', () => {
    const initial = setupNightlyGame();
    const { state: final } = runTicksWithSnapshots(initial, 2500, 500);

    const totalShips = final.gameState.ships.length;
    console.log(`[Nightly] Total ships in galaxy: ${totalShips}`);

    for (const empire of final.gameState.empires) {
      const shipCount = getEmpiresShips(final, empire.id);
      console.log(`[Nightly] ${empire.name}: ${shipCount} ships`);
    }

    // At least some ships should exist after 2500 ticks
    expect(totalShips).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('logs balance analysis summary', () => {
    const initial = setupNightlyGame();
    const { snapshots, state: final, combatEvents } = runTicksWithSnapshots(initial, 2500, 500);

    console.log('\n=== BALANCE ANALYSIS ===\n');

    // Resource accumulation rates
    const firstSnap = snapshots[0]!;
    const lastSnap = snapshots[snapshots.length - 1]!;
    const tickDelta = lastSnap.tick - firstSnap.tick;

    if (tickDelta > 0) {
      console.log('Resource accumulation rates (per tick):');
      for (let i = 0; i < lastSnap.empires.length; i++) {
        const first = firstSnap.empires[i]!;
        const last = lastSnap.empires[i]!;
        const creditRate = (last.credits - first.credits) / tickDelta;
        const mineralRate = (last.minerals - first.minerals) / tickDelta;
        console.log(`  ${last.name}: credits=${creditRate.toFixed(1)}/tick, minerals=${mineralRate.toFixed(1)}/tick`);
      }
    }

    // Fleet size comparison
    console.log('\nFleet sizes at end:');
    for (const empire of final.gameState.empires) {
      console.log(`  ${empire.name}: ${getEmpiresShips(final, empire.id)} ships`);
    }

    // Tech completion rates
    console.log(`\nTech completion (of ${allTechs.length} total):`);
    for (const empire of final.gameState.empires) {
      const pct = ((empire.technologies.length / allTechs.length) * 100).toFixed(1);
      console.log(`  ${empire.name}: ${empire.technologies.length} techs (${pct}%), age: ${empire.currentAge}`);
    }

    // Population growth
    console.log('\nPopulation growth:');
    for (const emp of lastSnap.empires) {
      const firstEmp = firstSnap.empires.find(e => e.name === emp.name)!;
      const growth = tickDelta > 0 ? ((emp.population - firstEmp.population) / tickDelta).toFixed(1) : 'N/A';
      console.log(`  ${emp.name}: ${emp.population} (rate: ${growth}/tick)`);
    }

    // Combat summary
    console.log(`\nCombat encounters: ${combatEvents.length}`);
  }, 30_000);
});
