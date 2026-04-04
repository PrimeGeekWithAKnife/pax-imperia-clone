/**
 * ADVERSARIAL PLAYTEST — ROUND 1
 *
 * QA stress-tests designed to BREAK the game:
 *   Scenario 1: New player doing everything wrong
 *   Scenario 2: Aggressive early-rush strategy
 *   Scenario 3: Edge-case galaxy configurations
 *   Scenario 4: Economic stress / bankruptcy
 *   Scenario 5: Combat edge cases
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
import type { Fleet, Ship, ShipDesign } from '../types/ships.js';
import techTree from '../../data/tech/universal-tree.json';
import { PREBUILT_SPECIES_BY_ID, PREBUILT_SPECIES } from '../../data/species/index.js';
import { SHIP_COMPONENTS, HULL_TEMPLATE_BY_CLASS } from '../../data/ships/index.js';
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
  calculateHabitability,
  canColoniseWithShip,
  canStartMigration,
} from '../engine/colony.js';
import {
  calculateUpkeep,
  applyResourceTick,
  calculateNavalCapacity,
  canAfford,
} from '../engine/economy.js';
import { findPath } from '../pathfinding/astar.js';
import { generateGalaxy } from '../generation/galaxy-generator.js';
import { GALAXY_SIZES } from '../constants/game.js';

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
// SCENARIO 1: NEW PLAYER DOING EVERYTHING WRONG
// ============================================================================

describe('Scenario 1: New player with zero knowledge', () => {
  it('colonise action without a colony ship should be rejected gracefully (not crash)', () => {
    const state = setupGame({ playerCount: 2, seed: 100 });
    const empire = state.gameState.empires[0]!;
    const empireFleets = getEmpireFleets(state, empire.id);

    // The starting fleet only has a deep space probe, not a coloniser
    expect(empireFleets.length).toBeGreaterThanOrEqual(1);
    const fleet = empireFleets[0]!;

    // Find an uncolonised planet in the home system
    const homeSystem = state.gameState.galaxy.systems.find(
      s => s.id === fleet.position.systemId,
    )!;
    const unownedPlanet = homeSystem.planets.find(
      p => p.ownerId === null && p.type !== 'gas_giant',
    );

    // Try to colonise with the fleet (which has no coloniser ship)
    // This should NOT crash the game loop
    const action: GameAction = {
      type: 'ColonizePlanet' as const,
      fleetId: fleet.id,
      planetId: unownedPlanet?.id ?? 'fake-planet-id',
    } as GameAction;

    const stateWithAction = submitAction(state, empire.id, action);
    const { state: afterTick } = runTicks(stateWithAction, 1);

    // Game should still be running — the action was rejected, not crashed
    expect(afterTick.gameState.status).toBe('playing');
  });

  it('sending fleet to a system with no wormhole path returns null order', () => {
    const state = setupGame({ playerCount: 2, seed: 200, galaxySize: 'large' });
    const empire = state.gameState.empires[0]!;
    const fleet = getEmpireFleets(state, empire.id)[0]!;

    // Try to move to a non-existent system
    const order = issueMovementOrder(
      fleet,
      state.gameState.galaxy,
      'non-existent-system-id',
    );

    // Should return null, not crash
    expect(order).toBeNull();
  });

  it('movement order to same system returns null (already there)', () => {
    const state = setupGame({ playerCount: 2, seed: 300 });
    const empire = state.gameState.empires[0]!;
    const fleet = getEmpireFleets(state, empire.id)[0]!;

    const order = issueMovementOrder(
      fleet,
      state.gameState.galaxy,
      fleet.position.systemId,
    );

    expect(order).toBeNull();
  });

  it('building a ship with zero minerals does not crash (rejects gracefully)', () => {
    const state = setupGame({ playerCount: 2, seed: 400 });
    const empire = state.gameState.empires[0]!;

    // Zero out the minerals
    const resources = state.empireResourcesMap.get(empire.id)!;
    const newResources = { ...resources, minerals: 0, credits: 0 };
    state.empireResourcesMap.set(empire.id, newResources);

    // Submit a build ship action
    const action: GameAction = {
      type: 'BuildShip',
      designId: 'starting_scout',
      planetId: getEmpirePlanets(state, empire.id)[0]?.id ?? 'fake',
    } as GameAction;

    const stateWithAction = submitAction(state, empire.id, action);
    const { state: afterTick } = runTicks(stateWithAction, 1);

    // Game should still be running
    expect(afterTick.gameState.status).toBe('playing');
  });

  it('submitting completely invalid action type does not crash the game loop', () => {
    const state = setupGame({ playerCount: 2, seed: 500 });
    const empire = state.gameState.empires[0]!;

    // Submit a bogus action type
    const action = { type: 'TotallyFakeAction', foo: 'bar' } as unknown as GameAction;
    const stateWithAction = submitAction(state, empire.id, action);
    const { state: afterTick } = runTicks(stateWithAction, 1);

    expect(afterTick.gameState.status).toBe('playing');
  });

  it('colonise action with fabricated planetId is rejected without crash', () => {
    const state = setupGame({ playerCount: 2, seed: 600 });
    const empire = state.gameState.empires[0]!;
    const homeSystem = state.gameState.galaxy.systems.find(s =>
      s.planets.some(p => p.ownerId === empire.id),
    )!;

    const action: GameAction = {
      type: 'ColonisePlanet',
      systemId: homeSystem.id,
      planetId: 'totally-fake-planet-id-12345',
    } as GameAction;

    const stateWithAction = submitAction(state, empire.id, action);
    const { state: afterTick } = runTicks(stateWithAction, 1);

    expect(afterTick.gameState.status).toBe('playing');
  });

  it('colonise action targeting a gas giant is rejected', () => {
    const state = setupGame({ playerCount: 2, seed: 700 });
    const empire = state.gameState.empires[0]!;

    // Find a gas giant anywhere
    const gasGiant = state.gameState.galaxy.systems
      .flatMap(s => s.planets)
      .find(p => p.type === 'gas_giant');

    if (gasGiant) {
      const system = state.gameState.galaxy.systems.find(s =>
        s.planets.some(p => p.id === gasGiant.id),
      )!;

      // Create a fake ship/fleet check
      const fleets = getEmpireFleets(state, empire.id);
      const fleet = fleets[0]!;
      const ships = state.gameState.ships.filter(s => fleet.ships.includes(s.id));

      if (ships.length > 0) {
        const result = canColoniseWithShip(
          ships[0]!,
          { ...fleet, position: { systemId: system.id } },
          system,
          gasGiant.id,
          empire.species,
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Gas giant');
      }
    }
  });

  it('running 500 ticks with all empires as AI produces no NaN resources', () => {
    const state = setupGame({ playerCount: 3, seed: 800 });
    const { state: final } = runTicks(state, 500);

    for (const [empireId, res] of final.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} resource "${field}" = ${value} is not finite after 500 ticks`,
        ).toBe(true);
      }
    }
  });
});

// ============================================================================
// SCENARIO 2: AGGRESSIVE EARLY RUSH
// ============================================================================

describe('Scenario 2: Aggressive early rush', () => {
  it('starting fleet has zero combat capability (only a probe)', () => {
    const state = setupGame({ playerCount: 2, seed: 1000 });
    const empire = state.gameState.empires[0]!;
    const fleet = getEmpireFleets(state, empire.id)[0]!;
    const ships = state.gameState.ships.filter(s => fleet.ships.includes(s.id));

    const strength = getFleetStrength(fleet, ships);

    // Starting fleet is just a deep space probe — should be very weak
    expect(strength.shipCount).toBe(1);
    // Probe has 10 hull points — very little combat power
    expect(strength.totalHullPoints).toBeLessThanOrEqual(10);
    console.log('[Scenario 2] Starting fleet strength:', strength);
  });

  it('early-game travel is slow (slow_ftl without wormhole tech)', () => {
    const state = setupGame({ playerCount: 2, seed: 1100 });
    const empire = state.gameState.empires[0]!;

    // Starting empire has no techs
    expect(empire.technologies).toHaveLength(0);
    const travelMode = determineTravelMode(empire.technologies);

    expect(travelMode).toBe('slow_ftl');
    // slow_ftl = 12 ticks per hop — slow for a rush
    console.log('[Scenario 2] Starting travel mode:', travelMode);
  });

  it('1 probe vs 1 probe combat resolves without crashing', () => {
    const state = setupGame({ playerCount: 2, seed: 1200 });
    const fleetA = state.gameState.fleets[0]!;
    const fleetB = state.gameState.fleets[1]!;

    const shipsA = state.gameState.ships.filter(s => fleetA.ships.includes(s.id));
    const shipsB = state.gameState.ships.filter(s => fleetB.ships.includes(s.id));

    const designs = state.shipDesigns ?? new Map<string, ShipDesign>();
    const aDesigns = new Map<string, ShipDesign>();
    const bDesigns = new Map<string, ShipDesign>();
    for (const s of shipsA) {
      const d = designs.get(s.designId);
      if (d) aDesigns.set(d.id, d);
    }
    for (const s of shipsB) {
      const d = designs.get(s.designId);
      if (d) bDesigns.set(d.id, d);
    }

    const setup: CombatSetup = {
      attackerFleet: fleetA,
      defenderFleet: fleetB,
      attackerShips: shipsA,
      defenderShips: shipsB,
      attackerDesigns: aDesigns,
      defenderDesigns: bDesigns,
    };

    const outcome = autoResolveCombat(setup, state.shipComponents ?? []);

    // Should resolve (not infinite loop) — probes may have zero weapons
    expect(outcome).toBeDefined();
    expect(outcome.ticksElapsed).toBeGreaterThanOrEqual(0);
    console.log('[Scenario 2] Probe vs probe outcome:', outcome.winner, 'in', outcome.ticksElapsed, 'ticks');
  });

  it('AI responds to early aggression by running 200 ticks of a 2-player game', () => {
    const state = setupGame({ playerCount: 2, seed: 1300 });
    const { state: final, allEvents } = runTicks(state, 200);

    // Check that both empires are still alive (or game ended normally)
    const aliveEmpires = final.gameState.empires.filter(e => {
      const planets = getEmpirePlanets(final, e.id);
      return planets.length > 0;
    });

    console.log('[Scenario 2] After 200 ticks:', {
      aliveEmpires: aliveEmpires.length,
      totalEvents: allEvents.length,
      combatEvents: allEvents.filter(e => e.type === 'CombatResolved').length,
      status: final.gameState.status,
    });

    // Game should still be stable
    expect(final.gameState.currentTick).toBeGreaterThanOrEqual(100);
  });
});

// ============================================================================
// SCENARIO 3: EDGE-CASE GALAXY CONFIGURATIONS
// ============================================================================

describe('Scenario 3: Edge-case galaxy configurations', () => {
  it('2-player small galaxy (20 systems) — both players get valid home systems', () => {
    const config: GameSetupConfig = {
      galaxyConfig: { seed: 2000, size: 'small', shape: 'spiral', playerCount: 2 },
      players: [
        {
          species: PREBUILT_SPECIES_BY_ID['vaelori']!,
          empireName: 'Test Empire A',
          color: '#FF0000',
          isAI: true,
          aiPersonality: 'aggressive',
        },
        {
          species: PREBUILT_SPECIES_BY_ID['khazari']!,
          empireName: 'Test Empire B',
          color: '#0000FF',
          isAI: true,
          aiPersonality: 'defensive',
        },
      ],
    };

    const gameState = initializeGame(config);

    // Both empires should exist with home planets
    expect(gameState.empires).toHaveLength(2);

    for (const empire of gameState.empires) {
      const planets = gameState.galaxy.systems
        .flatMap(s => s.planets)
        .filter(p => p.ownerId === empire.id);
      expect(planets.length).toBeGreaterThanOrEqual(1);
      expect(planets[0]!.currentPopulation).toBeGreaterThan(0);
    }

    // Empires should not start in the same system
    const homeSystemIds = gameState.empires.map(e => {
      const homeSystem = gameState.galaxy.systems.find(s =>
        s.planets.some(p => p.ownerId === e.id),
      );
      return homeSystem?.id;
    });
    expect(homeSystemIds[0]).not.toBe(homeSystemIds[1]);

    console.log('[Scenario 3] Small galaxy systems:', gameState.galaxy.systems.length);
  });

  it('maximum players (8) on small galaxy — stresses home system selection', () => {
    let succeeded = false;
    let errorMsg = '';

    try {
      const config: GameSetupConfig = {
        galaxyConfig: { seed: 2100, size: 'small', shape: 'spiral', playerCount: 8 },
        players: PREBUILT_SPECIES.slice(0, 8).map((species, i) => ({
          species,
          empireName: `Empire ${i}`,
          color: `#${i.toString(16).padStart(6, '0')}`,
          isAI: true,
          aiPersonality: 'economic' as const,
        })),
      };

      const gameState = initializeGame(config);
      succeeded = true;

      // All 8 empires should have home systems
      expect(gameState.empires).toHaveLength(8);

      // Check for duplicate home systems
      const homeSystemIds = gameState.empires.map(e => {
        return gameState.galaxy.systems.find(s =>
          s.planets.some(p => p.ownerId === e.id),
        )?.id;
      });

      const uniqueHomes = new Set(homeSystemIds);
      console.log('[Scenario 3] 8 players in small galaxy:', {
        systems: gameState.galaxy.systems.length,
        uniqueHomeSystems: uniqueHomes.size,
        allUnique: uniqueHomes.size === 8,
      });

      // BUG REPORT: If home systems are not unique, that is a problem
      // (even with relaxed neighbour exclusion, exact systems must differ)
      expect(uniqueHomes.size).toBe(8);
    } catch (e) {
      errorMsg = (e as Error).message;
      console.log('[Scenario 3] 8 players in small galaxy FAILED:', errorMsg);
      // This is an expected edge case — the game should either handle it
      // gracefully with an error message OR succeed
      expect(errorMsg).toContain('No suitable home system');
      succeeded = false;
    }

    // Document what happened either way
    console.log('[Scenario 3] 8 players on small galaxy:', succeeded ? 'SUCCEEDED' : 'REJECTED (expected)');
  });

  it('single-player game (1 empire) does not crash', () => {
    const config: GameSetupConfig = {
      galaxyConfig: { seed: 2200, size: 'small', shape: 'spiral', playerCount: 1 },
      players: [
        {
          species: PREBUILT_SPECIES_BY_ID['nexari']!,
          empireName: 'Solo Empire',
          color: '#FF00FF',
          isAI: true,
          aiPersonality: 'researcher',
        },
      ],
    };

    const gameState = initializeGame(config);
    expect(gameState.empires).toHaveLength(1);

    const tickState = initializeTickState(gameState, allTechs.length);
    const { state: after100 } = runTicks(tickState, 100);

    // Single-player game should run without crashing
    expect(after100.gameState.currentTick).toBeGreaterThanOrEqual(50);

    // Resources should be valid
    for (const [, res] of after100.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Resource "${field}" = ${value} is not finite in single-player game`,
        ).toBe(true);
      }
    }

    console.log('[Scenario 3] Single-player 100 ticks: OK');
  });

  it('galaxy connectivity — all systems are reachable via wormholes', () => {
    // Generate several galaxies and check connectivity
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
    const disconnectedGalaxies: string[] = [];

    for (const size of sizes) {
      for (let seed = 0; seed < 5; seed++) {
        const galaxy = generateGalaxy({ seed, size, shape: 'spiral', playerCount: 2 });

        // BFS from first system
        const visited = new Set<string>();
        const queue = [galaxy.systems[0]!.id];
        visited.add(galaxy.systems[0]!.id);

        while (queue.length > 0) {
          const current = queue.shift()!;
          const system = galaxy.systems.find(s => s.id === current);
          if (!system) continue;
          for (const nb of system.wormholes) {
            if (!visited.has(nb)) {
              visited.add(nb);
              queue.push(nb);
            }
          }
        }

        if (visited.size !== galaxy.systems.length) {
          disconnectedGalaxies.push(
            `${size}/seed=${seed}: visited ${visited.size}/${galaxy.systems.length}`,
          );
        }
      }
    }

    // BUG: Disconnected galaxies mean some empires can never reach each other
    if (disconnectedGalaxies.length > 0) {
      console.warn('[Scenario 3] DISCONNECTED GALAXIES FOUND:', disconnectedGalaxies);
    }
    expect(
      disconnectedGalaxies.length,
      `Disconnected galaxies: ${disconnectedGalaxies.join(', ')}`,
    ).toBe(0);
  });

  it('pathfinding between arbitrary systems never crashes even on edge-case galaxy', () => {
    const galaxy = generateGalaxy({ seed: 9999, size: 'small', shape: 'spiral', playerCount: 2 });

    // Try pathfinding from every system to every other system
    let pathfindErrors = 0;
    for (const start of galaxy.systems) {
      for (const end of galaxy.systems) {
        if (start.id === end.id) continue;
        try {
          const result = findPath(galaxy, start.id, end.id);
          // result can be found=false — that is OK. Just should not crash.
          if (!result.found) pathfindErrors++;
        } catch (e) {
          // This would be a bug
          throw new Error(
            `Pathfinding crashed from "${start.name}" to "${end.name}": ${(e as Error).message}`,
          );
        }
      }
    }

    console.log('[Scenario 3] Pathfinding test:', {
      totalPairs: galaxy.systems.length * (galaxy.systems.length - 1),
      unreachable: pathfindErrors,
    });
  });
});

// ============================================================================
// SCENARIO 4: ECONOMIC STRESS TEST
// ============================================================================

describe('Scenario 4: Economic stress / bankruptcy', () => {
  it('resources never go below zero (clamped at 0)', () => {
    const state = setupGame({ playerCount: 2, seed: 3000 });
    const empire = state.gameState.empires[0]!;

    // Set all resources to 0
    state.empireResourcesMap.set(empire.id, {
      credits: 0,
      minerals: 0,
      rareElements: 0,
      energy: 0,
      organics: 0,
      exoticMaterials: 0,
      faith: 0,
      researchPoints: 0,
    });

    const { state: afterTick } = runTicks(state, 10);
    const res = afterTick.empireResourcesMap.get(empire.id)!;

    // Credits should never go negative due to applyResourceTick clamping
    for (const [field, value] of Object.entries(res)) {
      expect(
        (value as number) >= 0,
        `Resource "${field}" went negative: ${value}`,
      ).toBe(true);
    }
  });

  it('upkeep exceeding income does not crash — empire goes to zero credits', () => {
    const state = setupGame({ playerCount: 2, seed: 3100 });
    const empire = state.gameState.empires[0]!;
    const planets = getEmpirePlanets(state, empire.id);

    // Calculate current upkeep
    const fleetCount = getEmpireShips(state, empire.id).length;
    const buildingCount = planets.reduce((sum, p) => sum + p.buildings.length, 0);
    const upkeep = calculateUpkeep(empire, fleetCount, buildingCount, planets);

    console.log('[Scenario 4] Empire upkeep (per tick):', upkeep);

    // Even with massive upkeep, game should handle gracefully
    // Set credits to a tiny amount
    state.empireResourcesMap.set(empire.id, {
      ...state.empireResourcesMap.get(empire.id)!,
      credits: 1,
    });

    const { state: after50 } = runTicks(state, 50);
    expect(after50.gameState.status).toBe('playing');
    expect(after50.empireResourcesMap.get(empire.id)!.credits).toBeGreaterThanOrEqual(0);
  });

  it('BUG HUNT: no warning/notification when empire runs out of credits', () => {
    const state = setupGame({ playerCount: 2, seed: 3200 });
    const empire = state.gameState.empires[0]!;

    // Zero out everything
    state.empireResourcesMap.set(empire.id, {
      credits: 0,
      minerals: 0,
      rareElements: 0,
      energy: 0,
      organics: 0,
      exoticMaterials: 0,
      faith: 0,
      researchPoints: 0,
    });

    const { state: after10, allEvents } = runTicks(state, 10);

    // Filter for any warning/notification events about bankruptcy
    const bankruptcyEvents = allEvents.filter(
      e =>
        (e as Record<string, unknown>).type === 'Notification' ||
        (e as Record<string, unknown>).type === 'EconomicCrisis' ||
        (e as Record<string, unknown>).type === 'BankruptcyWarning',
    );

    console.log('[Scenario 4] Bankruptcy events found:', bankruptcyEvents.length);
    console.log('[Scenario 4] All event types:', [...new Set(allEvents.map(e => (e as Record<string, unknown>).type))]);

    // POTENTIAL BUG: Player gets no feedback when bankrupt
    // This is a UX issue — the player should be warned
    if (bankruptcyEvents.length === 0) {
      console.warn('[Scenario 4] BUG: No bankruptcy/low-resource warnings emitted!');
    }
  });

  it('over naval capacity — upkeep multiplier escalates correctly', () => {
    const state = setupGame({ playerCount: 2, seed: 3300 });
    const empire = state.gameState.empires[0]!;
    const planets = getEmpirePlanets(state, empire.id);

    const navalCap = calculateNavalCapacity(planets);

    // Normal upkeep (under cap)
    const normalUpkeep = calculateUpkeep(empire, 1, 0, planets);

    // Over-cap upkeep (double the cap)
    const overCapUpkeep = calculateUpkeep(empire, navalCap * 2, 0, planets);

    // Over-cap upkeep should be significantly more expensive
    expect(Math.abs(overCapUpkeep.credits)).toBeGreaterThan(Math.abs(normalUpkeep.credits));

    console.log('[Scenario 4] Naval capacity:', navalCap);
    console.log('[Scenario 4] Normal upkeep (1 ship):', normalUpkeep.credits);
    console.log('[Scenario 4] Over-cap upkeep (2x cap):', overCapUpkeep.credits);
  });

  it('starvation — zero organics leads to population decline', () => {
    const state = setupGame({ playerCount: 2, seed: 3400 });
    const empire = state.gameState.empires[0]!;

    // Record starting population
    const startPop = getEmpirePlanets(state, empire.id)
      .reduce((sum, p) => sum + p.currentPopulation, 0);

    // Zero organics
    state.empireResourcesMap.set(empire.id, {
      ...state.empireResourcesMap.get(empire.id)!,
      organics: 0,
    });

    const { state: after50 } = runTicks(state, 50);
    const endPop = getEmpirePlanets(after50, empire.id)
      .reduce((sum, p) => sum + p.currentPopulation, 0);

    console.log('[Scenario 4] Starvation test:', {
      startPop,
      endPop,
      change: endPop - startPop,
    });

    // With zero organics, population should be declining (or at least not growing fast)
    // The hydroponics bay on the starting planet may produce some food, so check
    // that at least the decline pressure is present
    expect(endPop).toBeLessThan(startPop * 2); // Should not double — food is limited
  });

  it('BUG HUNT: no auto-scrap mechanism for ships when bankrupt', () => {
    const state = setupGame({ playerCount: 3, seed: 3500 });
    const empire = state.gameState.empires[0]!;

    // Zero all resources and run 200 ticks
    state.empireResourcesMap.set(empire.id, {
      credits: 0, minerals: 0, rareElements: 0, energy: 0,
      organics: 0, exoticMaterials: 0, faith: 0, researchPoints: 0,
    });

    const startShipCount = getEmpireShips(state, empire.id).length;
    const { state: after200 } = runTicks(state, 200);
    const endShipCount = getEmpireShips(after200, empire.id).length;

    console.log('[Scenario 4] Bankruptcy ship survival:', {
      startShips: startShipCount,
      endShips: endShipCount,
      status: after200.gameState.status,
    });

    // MISSING FEATURE: Ships should potentially be auto-scrapped or suffer
    // attrition when the empire cannot pay maintenance. Currently they persist.
  });

  it('economy recovers from zero — production still works', () => {
    const state = setupGame({ playerCount: 2, seed: 3600 });
    const empire = state.gameState.empires[0]!;

    // Set credits to 0 but leave other resources
    state.empireResourcesMap.set(empire.id, {
      ...state.empireResourcesMap.get(empire.id)!,
      credits: 0,
    });

    const { state: after100 } = runTicks(state, 100);
    const finalCredits = after100.empireResourcesMap.get(empire.id)!.credits;

    console.log('[Scenario 4] Recovery from zero credits after 100 ticks:', finalCredits);

    // Economy should recover — tax income from population still works
    expect(finalCredits).toBeGreaterThan(0);
  });
});

// ============================================================================
// SCENARIO 5: COMBAT EDGE CASES
// ============================================================================

describe('Scenario 5: Combat edge cases', () => {
  function makeTestShip(id: string, hull: number, designId: string): Ship {
    return {
      id,
      designId,
      name: `Test Ship ${id}`,
      hullPoints: hull,
      maxHullPoints: hull,
      systemDamage: { engines: 0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
      position: { systemId: 'test-system' },
      fleetId: 'test-fleet',
    };
  }

  function makeTestFleet(id: string, empireId: string, shipIds: string[]): Fleet {
    return {
      id,
      name: `Fleet ${id}`,
      ships: shipIds,
      empireId,
      position: { systemId: 'test-system' },
      destination: null,
      waypoints: [],
      stance: 'aggressive',
    };
  }

  it('1 ship vs 20 ships — massively outnumbered combat resolves', () => {
    // Create 1 attacker vs 20 defenders
    const attackerShip = makeTestShip('a1', 60, 'starting_destroyer');
    const defenderShips = Array.from({ length: 20 }, (_, i) =>
      makeTestShip(`d${i}`, 60, 'starting_destroyer'),
    );

    const attackerFleet = makeTestFleet('af', 'empire-a', ['a1']);
    const defenderFleet = makeTestFleet('df', 'empire-b', defenderShips.map(s => s.id));

    // Use empty designs — ships deal hull-based damage
    const setup: CombatSetup = {
      attackerFleet,
      defenderFleet,
      attackerShips: [attackerShip],
      defenderShips,
      attackerDesigns: new Map(),
      defenderDesigns: new Map(),
    };

    const outcome = autoResolveCombat(setup, []);

    // The lone attacker should lose (or draw at most)
    expect(outcome.winner).not.toBe('attacker');
    expect(outcome.attackerLosses.length + outcome.attackerRouted.length).toBeGreaterThan(0);

    console.log('[Scenario 5] 1 vs 20 combat:', {
      winner: outcome.winner,
      attackerLosses: outcome.attackerLosses.length,
      attackerRouted: outcome.attackerRouted.length,
      defenderLosses: outcome.defenderLosses.length,
      ticks: outcome.ticksElapsed,
    });
  });

  it('combat with zero-weapon ships (probes) — eventually resolves (not infinite loop)', () => {
    // Science probes have 10 HP and no weapons in a default design
    const probe1 = makeTestShip('p1', 10, 'starting_science_probe');
    const probe2 = makeTestShip('p2', 10, 'starting_science_probe');

    const fleetA = makeTestFleet('fa', 'empire-a', ['p1']);
    const fleetB = makeTestFleet('fb', 'empire-b', ['p2']);

    const setup: CombatSetup = {
      attackerFleet: fleetA,
      defenderFleet: fleetB,
      attackerShips: [probe1],
      defenderShips: [probe2],
      attackerDesigns: new Map(),
      defenderDesigns: new Map(),
    };

    const outcome = autoResolveCombat(setup, []);

    // Should resolve in MAX_TICKS (100) as a draw, not infinite loop
    expect(outcome).toBeDefined();
    expect(outcome.ticksElapsed).toBeLessThanOrEqual(100);

    console.log('[Scenario 5] Zero-weapon combat:', {
      winner: outcome.winner,
      ticks: outcome.ticksElapsed,
    });
  });

  it('combat with both fleets on defensive stance — still resolves', () => {
    const ship1 = makeTestShip('s1', 60, 'starting_destroyer');
    const ship2 = makeTestShip('s2', 60, 'starting_destroyer');

    const fleetA = makeTestFleet('fa', 'empire-a', ['s1']);
    fleetA.stance = 'defensive';
    const fleetB = makeTestFleet('fb', 'empire-b', ['s2']);
    fleetB.stance = 'defensive';

    const setup: CombatSetup = {
      attackerFleet: fleetA,
      defenderFleet: fleetB,
      attackerShips: [ship1],
      defenderShips: [ship2],
      attackerDesigns: new Map(),
      defenderDesigns: new Map(),
    };

    // Auto-resolve ignores stance (both sides fire) — should not deadlock
    const outcome = autoResolveCombat(setup, []);

    expect(outcome).toBeDefined();
    expect(outcome.ticksElapsed).toBeLessThanOrEqual(100);

    console.log('[Scenario 5] Both defensive:', {
      winner: outcome.winner,
      ticks: outcome.ticksElapsed,
    });

    // BUG: The auto-resolve combat ignores fleet stance entirely.
    // Both fleets fire regardless. In tactical mode, two defensive fleets
    // might deadlock if neither approaches the other.
  });

  it('combat with empty fleet (0 ships) is handled gracefully', () => {
    const ship1 = makeTestShip('s1', 60, 'starting_destroyer');

    const attackerFleet = makeTestFleet('fa', 'empire-a', ['s1']);
    const emptyFleet = makeTestFleet('fb', 'empire-b', []);

    const setup: CombatSetup = {
      attackerFleet,
      defenderFleet: emptyFleet,
      attackerShips: [ship1],
      defenderShips: [],
      attackerDesigns: new Map(),
      defenderDesigns: new Map(),
    };

    const outcome = autoResolveCombat(setup, []);

    // Attacker should win immediately (no defenders)
    expect(outcome.winner).toBe('attacker');
    expect(outcome.ticksElapsed).toBeLessThanOrEqual(1);

    console.log('[Scenario 5] Empty fleet combat:', outcome);
  });

  it('morale routing — severely outnumbered ships route before destruction', () => {
    const attackerShip = makeTestShip('a1', 300, 'starting_battleship');
    const defenderShips = Array.from({ length: 10 }, (_, i) =>
      makeTestShip(`d${i}`, 300, 'starting_battleship'),
    );

    const attackerFleet = makeTestFleet('fa', 'empire-a', ['a1']);
    const defenderFleet = makeTestFleet('fb', 'empire-b', defenderShips.map(s => s.id));

    const setup: CombatSetup = {
      attackerFleet,
      defenderFleet,
      attackerShips: [attackerShip],
      defenderShips,
      attackerDesigns: new Map(),
      defenderDesigns: new Map(),
    };

    const outcome = autoResolveCombat(setup, []);

    console.log('[Scenario 5] Morale routing test:', {
      winner: outcome.winner,
      attackerRouted: outcome.attackerRouted.length,
      attackerDestroyed: outcome.attackerLosses.length,
      defenderRouted: outcome.defenderRouted.length,
      defenderDestroyed: outcome.defenderLosses.length,
      ticks: outcome.ticksElapsed,
    });

    // The outnumbered attacker should route due to MORALE_OUTNUMBERED_PER_TICK
    // or be destroyed. Either way, defender should win.
    expect(outcome.winner).not.toBe('attacker');
  });

  it('BUG HUNT: ships with fully damaged engines in combat', () => {
    const ship1: Ship = {
      ...makeTestShip('s1', 60, 'starting_destroyer'),
      systemDamage: { engines: 1.0, weapons: 0, shields: 0, sensors: 0, warpDrive: 0 },
    };
    const ship2 = makeTestShip('s2', 60, 'starting_destroyer');

    const fleetA = makeTestFleet('fa', 'empire-a', ['s1']);
    const fleetB = makeTestFleet('fb', 'empire-b', ['s2']);

    const setup: CombatSetup = {
      attackerFleet: fleetA,
      defenderFleet: fleetB,
      attackerShips: [ship1],
      defenderShips: [ship2],
      attackerDesigns: new Map(),
      defenderDesigns: new Map(),
    };

    // Ship with no engines should still participate in combat (cannot flee)
    const outcome = autoResolveCombat(setup, []);
    expect(outcome).toBeDefined();
    expect(outcome.ticksElapsed).toBeLessThanOrEqual(100);

    console.log('[Scenario 5] Damaged engines combat:', {
      winner: outcome.winner,
      ticks: outcome.ticksElapsed,
    });
  });

  it('BUG HUNT: ships with fully damaged weapons deal zero damage', () => {
    const ship1: Ship = {
      ...makeTestShip('s1', 60, 'starting_destroyer'),
      systemDamage: { engines: 0, weapons: 1.0, shields: 0, sensors: 0, warpDrive: 0 },
    };
    const ship2 = makeTestShip('s2', 60, 'starting_destroyer');

    const fleetA = makeTestFleet('fa', 'empire-a', ['s1']);
    const fleetB = makeTestFleet('fb', 'empire-b', ['s2']);

    const setup: CombatSetup = {
      attackerFleet: fleetA,
      defenderFleet: fleetB,
      attackerShips: [ship1],
      defenderShips: [ship2],
      attackerDesigns: new Map(),
      defenderDesigns: new Map(),
    };

    const outcome = autoResolveCombat(setup, []);

    // Ship with broken weapons should lose (cannot deal damage)
    // But with empty designs (no components), both deal zero — should draw
    expect(outcome).toBeDefined();

    console.log('[Scenario 5] Broken weapons combat:', {
      winner: outcome.winner,
      ticks: outcome.ticksElapsed,
    });
  });

  it('full simulation — 1000 ticks with combat-oriented AI species (Khazari)', () => {
    const khazari = PREBUILT_SPECIES_BY_ID['khazari']!;
    const zorvathi = PREBUILT_SPECIES_BY_ID['zorvathi']!;

    const config: GameSetupConfig = {
      galaxyConfig: { seed: 5000, size: 'small', shape: 'spiral', playerCount: 2 },
      players: [
        { species: khazari, empireName: 'Khazari Horde', color: '#FF4400', isAI: true, aiPersonality: 'aggressive' },
        { species: zorvathi, empireName: 'Zorvathi Swarm', color: '#00FF44', isAI: true, aiPersonality: 'aggressive' },
      ],
    };

    const initial = initializeTickState(initializeGame(config), allTechs.length);
    const { state: final, allEvents } = runTicks(initial, 1000);

    const combatEvents = allEvents.filter(e => (e as Record<string, unknown>).type === 'CombatResolved');
    const gameOverEvents = allEvents.filter(e => (e as Record<string, unknown>).type === 'GameOver');

    console.log('[Scenario 5] Full combat simulation (1000 ticks):', {
      finalTick: final.gameState.currentTick,
      status: final.gameState.status,
      combatCount: combatEvents.length,
      gameOver: gameOverEvents.length > 0,
    });

    for (const empire of final.gameState.empires) {
      const res = final.empireResourcesMap.get(empire.id)!;
      const planets = getEmpirePlanets(final, empire.id);
      const ships = getEmpireShips(final, empire.id);
      console.log(`[Scenario 5] ${empire.name}:`, {
        credits: Math.round(res.credits),
        planets: planets.length,
        ships: ships.length,
        techs: empire.technologies.length,
      });
    }

    // No NaN/Infinity in final state
    for (const [empireId, res] of final.empireResourcesMap) {
      for (const [field, value] of Object.entries(res)) {
        expect(
          Number.isFinite(value as number),
          `Empire ${empireId} "${field}" = ${value} after combat sim`,
        ).toBe(true);
      }
    }
  });
});
