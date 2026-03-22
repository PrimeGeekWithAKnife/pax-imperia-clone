/**
 * Central game loop — ties all engine modules together into a single tick.
 *
 * processGameTick is the master entry point.  Call it once per game tick to
 * advance the entire simulation.  All functions here are pure / side-effect-free;
 * callers must persist the returned state.
 *
 * Processing order per tick:
 *  0.  Player Actions       (colonise/start migration, build, speed change)
 *  1.  Fleet Movement
 *  2.  Combat Resolution
 *  3.  Population Growth    (applies happiness growth bonus/revolt loss)
 *  3b. Migration Processing (wave departures, arrivals, colony establishment)
 *  3c. Happiness Processing (unrest/revolt effects, production multipliers)
 *  4.  Resource Production  (energy deficit penalties applied here)
 *  4b. Food Consumption     (organics deducted; starvation population loss)
 *  5.  Construction Queues
 *  5b. Terraforming        (atmosphere, temperature, biosphere, planet conversion)
 *  6.  Ship Production
 *  7.  Research Progress
 *  8.  Diplomacy Tick       (stub)
 *  9.  AI Decisions         (stub)
 *  10. Victory Check        (conquest / economic / technological / diplomatic)
 *  11. Advance Tick
 */

import type { GameState } from '../types/game-state.js';
import type { StarSystem, Planet, BuildingType } from '../types/galaxy.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import type { EmpireResources } from '../types/resources.js';
import type { Governor } from '../types/governor.js';
import { GOVERNMENTS } from '../types/government.js';
import type {
  GameAction,
  GameEvent,
  FleetMovedEvent,
  CombatStartedEvent,
  CombatResolvedEvent,
  TechResearchedEvent,
  MigrationStartedEvent,
  MigrationWaveEvent,
  ColonyEstablishedEvent,
  TerraformingProgressEvent,
  TerraformingCompleteEvent,
  GovernorDiedEvent,
  GovernorAppointedEvent,
} from '../types/events.js';
import { GAME_SPEEDS } from '../constants/game.js';
import {
  calculateEmpireProduction,
  calculateUpkeep,
  applyResourceTick,
  getEnergyStatus,
  applyFoodConsumption,
} from './economy.js';
import {
  calculatePlanetHappiness,
  empireIsAtWar,
} from './happiness.js';
import {
  calculateHabitability,
  calculatePopulationGrowth,
  processConstructionQueue,
  canStartMigration,
  startMigration,
  processMigrationTick,
  canBuildOnPlanet,
  addBuildingToQueue,
  type MigrationOrder,
} from './colony.js';
import {
  processResearchTick,
  applyTechEffects,
  type ResearchState,
} from './research.js';
import {
  processFleetMovement,
  processShipProduction,
  type FleetMovementOrder,
  type ShipProductionOrder,
} from './fleet.js';
import {
  autoResolveCombat,
  applyCombatResults,
  type CombatSetup,
} from './combat.js';
import { generateId } from '../utils/id.js';
import { processTradeRoutes, type BasicTradeRoute } from './trade.js';
import {
  checkVictoryConditions,
  updateEconomicLeadTicks,
} from './victory.js';
import {
  processTerraformingTick,
  type TerraformingProgress,
} from './terraforming.js';
import {
  generateGovernor,
  processGovernorsTick,
  applyGovernorModifiers,
} from './governors.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A combat waiting to be resolved this tick. */
export interface CombatPending {
  systemId: string;
  attackerFleetId: string;
  defenderFleetId: string;
}

/**
 * A player action submitted for processing on the next game tick.
 *
 * Wrapping GameAction with the submitting empire's identity and the tick number
 * means the game loop always has full context when validating actions, even for
 * action types that do not carry an empireId themselves.
 */
export interface PlayerAction {
  /** The empire that submitted this action. */
  empireId: string;
  /** The action payload. */
  action: GameAction;
  /** The tick counter at which this action was submitted. */
  tick: number;
}

/**
 * Complete snapshot of mutable game-loop state.
 * GameState carries the canonical galaxy/empires/fleets/ships.
 * The remaining fields are auxiliary structures managed by the game loop.
 */
export interface GameTickState {
  gameState: GameState;
  /** Per-empire research progress. Key = empireId. */
  researchStates: Map<string, ResearchState>;
  /** Active fleet movement orders. */
  movementOrders: FleetMovementOrder[];
  /** Active ship production orders. */
  productionOrders: ShipProductionOrder[];
  /** Combats pending resolution this tick (populated during fleet movement). */
  pendingCombats: CombatPending[];
  /**
   * Ship designs available for combat resolution.
   * The game loop passes these through; the server populates them from the design
   * registry.  May be empty — combat will then produce zero-damage results.
   */
  shipDesigns?: Map<string, ShipDesign>;
  /**
   * Ship components available for combat resolution.
   * Same provenance as shipDesigns.
   */
  shipComponents?: ShipComponent[];
  /**
   * Active migration orders (multi-turn colonisation process).
   * Created when a ColonisePlanet action is processed; removed once the
   * migration status becomes 'established' or 'cancelled'.
   */
  migrationOrders: MigrationOrder[];
  /**
   * Player actions queued for processing on the next tick.
   * Use submitAction to add actions; the game loop drains this list each tick.
   */
  pendingActions: PlayerAction[];
  /**
   * Full resource stockpile per empire (credits, minerals, energy, etc.).
   * Persisted between ticks. Key = empireId.
   */
  empireResourcesMap: Map<string, EmpireResources>;
  /**
   * Active trade routes between star systems.
   * Each route generates credits per tick for the owning empire provided both
   * endpoint systems still have spaceports.  Routes are added via player actions
   * and persist until explicitly cancelled.
   */
  tradeRoutes: BasicTradeRoute[];
  /**
   * Consecutive-tick counters used for the economic victory condition.
   * Key = empireId; value = number of ticks the empire has maintained the
   * required credit lead over all rivals.  Reset to 0 whenever the lead is lost.
   */
  economicLeadTicks: Map<string, number>;
  /**
   * Total number of technologies in the tech tree.  Passed to victory checking
   * so it can evaluate technological completion without importing the full tree.
   */
  allTechCount: number;
  /**
   * Terraforming progress records, keyed by planetId.
   * A record is created when a planet with a Terraforming Station is first
   * processed and persists until the stage reaches 'complete'.
   */
  terraformingProgressMap: Map<string, TerraformingProgress>;
  /**
   * All active governors across all empires.
   * Each governor is assigned to one planet (governor.planetId).
   * At most one governor should exist per planet at any time.
   */
  governors: Governor[];
}

/** The result returned by processGameTick. */
export interface TickResult {
  newState: GameTickState;
  events: GameEvent[];
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Get an empire's full resource stockpile from the tick state.
 * Falls back to extracting credits/researchPoints from the Empire object
 * if the resource map hasn't been populated yet.
 */
function getEmpireResources(state: GameTickState, empireId: string): EmpireResources {
  const stored = state.empireResourcesMap.get(empireId);
  if (stored) return { ...stored };
  // Fallback for older save data
  const empire = state.gameState.empires.find(e => e.id === empireId);
  return {
    credits: empire?.credits ?? 0,
    minerals: 0,
    rareElements: 0,
    energy: 0,
    organics: 0,
    exoticMaterials: 0,
    faith: 0,
    researchPoints: empire?.researchPoints ?? 0,
  };
}

/** Write an EmpireResources snapshot back to both the map and the Empire object. */
function applyResources(state: GameTickState, empireId: string, resources: EmpireResources): GameTickState {
  const newMap = new Map(state.empireResourcesMap);
  newMap.set(empireId, resources);
  return {
    ...state,
    empireResourcesMap: newMap,
    gameState: {
      ...state.gameState,
      empires: state.gameState.empires.map(e =>
        e.id === empireId
          ? { ...e, credits: resources.credits, researchPoints: resources.researchPoints }
          : e,
      ),
    },
  };
}

/** Collect all planets owned by an empire across the galaxy. */
function getEmpirePlanets(galaxy: { systems: StarSystem[] }, empireId: string): Planet[] {
  const planets: Planet[] = [];
  for (const system of galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === empireId) {
        planets.push(planet);
      }
    }
  }
  return planets;
}

/** Count total ships belonging to an empire. */
function countEmpireShips(ships: Ship[], empireId: string): number {
  const fleetSet = new Set<string>();
  // We need to know which fleet IDs belong to the empire — ship.fleetId points
  // to a fleet, but we need empireId.  We count via the ship's fleet lookup.
  // Since we don't have fleet data here, count directly from ships array using
  // fleet ownership derived from the passed-in fleets.
  return ships.filter(s => {
    // Approximate: a ship belongs to an empire if its fleetId is present in the
    // fleets belonging to that empire.  We cannot do that lookup without the
    // fleet array here, so the caller uses countEmpireShipsViaFleets instead.
    void s; void empireId;
    return false;
  }).length + fleetSet.size; // always 0 — placeholder replaced below
}

// Suppress the unused warning for the stub above; actual implementation below.
void countEmpireShips;

function countEmpireShipsViaFleets(
  ships: Ship[],
  fleets: Fleet[],
  empireId: string,
): number {
  const empireFleetIds = new Set(
    fleets.filter(f => f.empireId === empireId).map(f => f.id),
  );
  return ships.filter(s => s.fleetId !== null && empireFleetIds.has(s.fleetId)).length;
}

/** Count total buildings across a list of planets. */
function countBuildings(planets: Planet[]): number {
  return planets.reduce((sum, p) => sum + p.buildings.length, 0);
}

/**
 * Replace a planet in-place within a systems array (by value — returns new array).
 */
function replacePlanet(
  systems: StarSystem[],
  updatedPlanet: Planet,
): StarSystem[] {
  return systems.map(system => {
    const idx = system.planets.findIndex(p => p.id === updatedPlanet.id);
    if (idx === -1) return system;
    const updatedPlanets = [...system.planets];
    updatedPlanets[idx] = updatedPlanet;
    return { ...system, planets: updatedPlanets };
  });
}


// ---------------------------------------------------------------------------
// Step 0: Process Pending Actions
// ---------------------------------------------------------------------------

/**
 * Drain the pendingActions queue and apply each action to the game state.
 *
 * Handles:
 *  - ColonisePlanet / ColonizePlanet: in-system colonisation without a transport.
 *  - ConstructBuilding: add a building to a planet's production queue.
 *  - SetGameSpeed: update the game speed.
 *
 * Unknown or unhandled action types are logged and skipped gracefully so that
 * new action types can be introduced without crashing the game loop.
 */
function processPlayerActions(
  state: GameTickState,
  events: GameEvent[],
): GameTickState {
  if (state.pendingActions.length === 0) return state;

  const tick = state.gameState.currentTick;
  let systems = state.gameState.galaxy.systems;
  let empires = state.gameState.empires;
  let gameSpeed = state.gameState.speed;

  for (const playerAction of state.pendingActions) {
    const { empireId, action } = playerAction;

    try {
      // ── ColonisePlanet / ColonizePlanet ────────────────────────────────────
      if (action.type === 'ColonisePlanet' || action.type === 'ColonizePlanet') {
        // Both spellings are supported; extract fields depending on variant.
        const systemId = action.type === 'ColonisePlanet' ? action.systemId : null;
        const planetId = action.planetId;

        if (!systemId) {
          // ColonizePlanet (US spelling) uses a fleetId rather than a systemId —
          // the fleet-based path is not yet implemented.
          console.warn(`[game-loop] ColonizePlanet (fleet-based) is not yet implemented — skipping`);
          continue;
        }

        // Look up empire.
        const empire = empires.find(e => e.id === empireId);
        if (!empire) {
          console.warn(`[game-loop] ColonisePlanet action references unknown empire "${empireId}" — skipping`);
          continue;
        }

        const systemIndex = systems.findIndex(s => s.id === systemId);
        if (systemIndex === -1) {
          console.warn(`[game-loop] ColonisePlanet action references unknown system "${systemId}" — skipping`);
          continue;
        }

        const system = systems[systemIndex]!;

        // Find the source planet — the empire's most populous planet in the system.
        const sourcePlanet = system.planets
          .filter(p => p.ownerId === empireId)
          .sort((a, b) => b.currentPopulation - a.currentPopulation)[0];

        if (!sourcePlanet) {
          console.warn(`[game-loop] ColonisePlanet rejected for empire "${empireId}": no owned planet in system`);
          continue;
        }

        // Validate using canStartMigration.
        const check = canStartMigration(
          system,
          sourcePlanet.id,
          planetId,
          empireId,
          empire.species,
          empire.credits,
          state.migrationOrders,
        );

        if (!check.allowed) {
          console.warn(`[game-loop] ColonisePlanet rejected for empire "${empireId}": ${check.reason}`);
          continue;
        }

        // Deduct the colonisation cost upfront from both empire and resource map.
        const updatedEmpire = { ...empire, credits: empire.credits - check.cost };
        empires = empires.map(e => (e.id === empireId ? updatedEmpire : e));
        // Also deduct from the persistent resource map
        const resMap = state.empireResourcesMap;
        const empRes = resMap.get(empireId);
        if (empRes) {
          const newMap = new Map(resMap);
          newMap.set(empireId, { ...empRes, credits: empRes.credits - check.cost });
          state = { ...state, empireResourcesMap: newMap };
        }

        // Create the migration order — planet ownership is deferred until the
        // first wave arrives (handled in stepMigrations).
        const migrationOrder = startMigration(system, sourcePlanet.id, planetId, empireId, empire.species);
        state = { ...state, migrationOrders: [...state.migrationOrders, migrationOrder] };

        // Emit MigrationStarted event.
        const migrationStartedEvent: MigrationStartedEvent = {
          type: 'MigrationStarted',
          empireId,
          systemId,
          sourcePlanetId: sourcePlanet.id,
          targetPlanetId: planetId,
          tick,
        };
        events.push(migrationStartedEvent);

      // ── ConstructBuilding ────────────────────────────────────────────────
      } else if (action.type === 'ConstructBuilding') {
        const { systemId, planetId, buildingType } = action;

        const systemData = systems.find(s => s.id === systemId);
        if (!systemData) {
          console.warn(`[game-loop] ConstructBuilding references unknown system "${systemId}" — skipping`);
          continue;
        }

        const planet = systemData.planets.find(p => p.id === planetId);
        if (!planet) {
          console.warn(`[game-loop] ConstructBuilding references unknown planet "${planetId}" — skipping`);
          continue;
        }

        if (planet.ownerId !== empireId) {
          console.warn(`[game-loop] ConstructBuilding rejected — empire "${empireId}" does not own planet "${planetId}"`);
          continue;
        }

        // Retrieve researched tech IDs so building tech gates are enforced.
        const empireResearchState = state.researchStates.get(empireId);
        const empireTechs = empireResearchState?.completedTechs ?? [];

        const buildCheck = canBuildOnPlanet(planet, buildingType as BuildingType, undefined, empireTechs);
        if (!buildCheck.allowed) {
          console.warn(`[game-loop] ConstructBuilding rejected for planet "${planetId}": ${buildCheck.reason}`);
          continue;
        }

        const updatedPlanet = addBuildingToQueue(planet, buildingType as BuildingType, undefined, empireTechs);
        systems = replacePlanet(systems, updatedPlanet);

      // ── SetGameSpeed ─────────────────────────────────────────────────────
      } else if (action.type === 'SetGameSpeed') {
        gameSpeed = action.speed;

      } else {
        // Action type recognised but not handled yet — log and continue.
        console.warn(`[game-loop] Unhandled action type "${(action as GameAction).type}" — skipping`);
      }
    } catch (err) {
      // Defensive: an invalid action must not crash the game loop.
      console.error(`[game-loop] Error processing action "${(action as GameAction).type}" for empire "${empireId}":`, err);
    }
  }

  return {
    ...state,
    pendingActions: [],
    gameState: {
      ...state.gameState,
      speed: gameSpeed,
      empires,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Step 1: Fleet Movement
// ---------------------------------------------------------------------------

function stepFleetMovement(
  state: GameTickState,
  events: GameEvent[],
): GameTickState {
  const tick = state.gameState.currentTick;
  let ships = [...state.gameState.ships];
  let fleets = [...state.gameState.fleets];
  const remainingOrders: FleetMovementOrder[] = [];
  const newPendingCombats: CombatPending[] = [...state.pendingCombats];

  for (const order of state.movementOrders) {
    const fleetIndex = fleets.findIndex(f => f.id === order.fleetId);
    if (fleetIndex === -1) {
      // Fleet no longer exists — discard order
      console.warn(`[game-loop] Movement order references unknown fleet "${order.fleetId}" — discarding`);
      continue;
    }

    const fleet = fleets[fleetIndex]!;
    const fleetShips = ships.filter(s => fleet.ships.includes(s.id));

    const result = processFleetMovement(order, fleet, fleetShips);

    // Update the ships array with any position changes
    const updatedShipIds = new Set(result.ships.map(s => s.id));
    ships = ships.map(s => (updatedShipIds.has(s.id) ? result.ships.find(rs => rs.id === s.id)! : s));

    // Update fleet in the array
    fleets = fleets.map(f => (f.id === result.fleet.id ? result.fleet : f));

    if (result.arrivedAtSystem !== null) {
      const arrivedSystemId = result.arrivedAtSystem;
      const prevSystemId = fleet.position.systemId;

      const movedEvent: FleetMovedEvent = {
        type: 'FleetMoved',
        fleetId: fleet.id,
        fromSystemId: prevSystemId,
        toSystemId: arrivedSystemId,
        tick,
      };
      events.push(movedEvent);

      // Check if there are enemy fleets in the arrived system
      const empireId = fleet.empireId;
      const enemyFleetsInSystem = fleets.filter(
        f =>
          f.id !== fleet.id &&
          f.position.systemId === arrivedSystemId &&
          f.empireId !== empireId,
      );

      for (const enemyFleet of enemyFleetsInSystem) {
        // Only queue combat once per pair per tick
        const alreadyQueued = newPendingCombats.some(
          c =>
            (c.attackerFleetId === fleet.id && c.defenderFleetId === enemyFleet.id) ||
            (c.attackerFleetId === enemyFleet.id && c.defenderFleetId === fleet.id),
        );
        if (!alreadyQueued) {
          newPendingCombats.push({
            systemId: arrivedSystemId,
            attackerFleetId: fleet.id,
            defenderFleetId: enemyFleet.id,
          });
          const combatStartedEvent: CombatStartedEvent = {
            type: 'CombatStarted',
            systemId: arrivedSystemId,
            attackerFleetId: fleet.id,
            defenderFleetId: enemyFleet.id,
            tick,
          };
          events.push(combatStartedEvent);
        }
      }
    }

    if (result.order !== null) {
      remainingOrders.push(result.order);
    }
  }

  return {
    ...state,
    movementOrders: remainingOrders,
    pendingCombats: newPendingCombats,
    gameState: {
      ...state.gameState,
      fleets,
      ships,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 2: Combat Resolution
// ---------------------------------------------------------------------------

function stepCombatResolution(
  state: GameTickState,
  events: GameEvent[],
): GameTickState {
  if (state.pendingCombats.length === 0) return state;

  const tick = state.gameState.currentTick;
  let ships = [...state.gameState.ships];
  let fleets = [...state.gameState.fleets];
  const designs = state.shipDesigns ?? new Map<string, ShipDesign>();
  const components = state.shipComponents ?? [];

  for (const combat of state.pendingCombats) {
    const attackerFleet = fleets.find(f => f.id === combat.attackerFleetId);
    const defenderFleet = fleets.find(f => f.id === combat.defenderFleetId);

    if (!attackerFleet || !defenderFleet) {
      console.warn(
        `[game-loop] Combat references missing fleet(s) in system "${combat.systemId}" — skipping`,
      );
      continue;
    }

    const attackerShips = ships.filter(s => attackerFleet.ships.includes(s.id));
    const defenderShips = ships.filter(s => defenderFleet.ships.includes(s.id));

    if (attackerShips.length === 0 || defenderShips.length === 0) {
      console.warn(
        `[game-loop] Combat in system "${combat.systemId}" has empty fleet(s) — skipping`,
      );
      continue;
    }

    // Build design maps for each side
    const attackerDesigns = new Map<string, ShipDesign>(
      attackerShips
        .map(s => designs.get(s.designId))
        .filter((d): d is ShipDesign => d !== undefined)
        .map(d => [d.id, d]),
    );
    const defenderDesigns = new Map<string, ShipDesign>(
      defenderShips
        .map(s => designs.get(s.designId))
        .filter((d): d is ShipDesign => d !== undefined)
        .map(d => [d.id, d]),
    );

    const setup: CombatSetup = {
      attackerFleet,
      defenderFleet,
      attackerShips,
      defenderShips,
      attackerDesigns,
      defenderDesigns,
    };

    const outcome = autoResolveCombat(setup, components);

    // Build a minimal CombatState to use applyCombatResults
    // We only need the ship lists; applyCombatResults handles the rest.
    const allCombatShips = [
      ...attackerShips.map(s => ({
        ship: s,
        designId: s.designId,
        side: 'attacker' as const,
        morale: 100,
        isRouted: outcome.attackerRouted.includes(s.id),
        isDestroyed: outcome.attackerLosses.includes(s.id),
        currentShields: 0,
        maxShields: 0,
        position: { x: 0, y: 0 },
        facing: 0,
      })),
      ...defenderShips.map(s => ({
        ship: s,
        designId: s.designId,
        side: 'defender' as const,
        morale: 100,
        isRouted: outcome.defenderRouted.includes(s.id),
        isDestroyed: outcome.defenderLosses.includes(s.id),
        currentShields: 0,
        maxShields: 0,
        position: { x: 40, y: 0 },
        facing: Math.PI,
      })),
    ];

    const pseudoCombatState = {
      tick: outcome.ticksElapsed,
      attackerShips: allCombatShips.filter(cs => cs.side === 'attacker'),
      defenderShips: allCombatShips.filter(cs => cs.side === 'defender'),
      events: [],
      outcome,
    };

    ships = applyCombatResults(ships, pseudoCombatState);

    // Remove destroyed ships from their fleets
    const destroyedIds = new Set([...outcome.attackerLosses, ...outcome.defenderLosses]);

    fleets = fleets.map(fleet => {
      if (
        fleet.id !== attackerFleet.id &&
        fleet.id !== defenderFleet.id
      ) {
        return fleet;
      }
      const remainingShipIds = fleet.ships.filter(id => !destroyedIds.has(id));
      return { ...fleet, ships: remainingShipIds };
    });

    // Determine winner empire for the event
    let winnerEmpireId: string;
    if (outcome.winner === 'attacker') {
      winnerEmpireId = attackerFleet.empireId;
    } else if (outcome.winner === 'defender') {
      winnerEmpireId = defenderFleet.empireId;
    } else {
      winnerEmpireId = attackerFleet.empireId; // draw — attribute to attacker
    }

    const combatResolvedEvent: CombatResolvedEvent = {
      type: 'CombatResolved',
      systemId: combat.systemId,
      winnerEmpireId,
      casualties: [
        {
          fleetId: attackerFleet.id,
          shipsLost: outcome.attackerLosses.length,
        },
        {
          fleetId: defenderFleet.id,
          shipsLost: outcome.defenderLosses.length,
        },
      ],
      tick,
    };
    events.push(combatResolvedEvent);
  }

  // Remove empty fleets
  fleets = fleets.filter(f => f.ships.length > 0);

  return {
    ...state,
    pendingCombats: [],
    gameState: {
      ...state.gameState,
      fleets,
      ships,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 3: Population Growth
// ---------------------------------------------------------------------------

function stepPopulationGrowth(state: GameTickState): GameTickState {
  let systems = state.gameState.galaxy.systems;

  for (const system of state.gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === null || planet.currentPopulation <= 0) continue;

      const empire = state.gameState.empires.find(e => e.id === planet.ownerId);
      if (!empire) {
        console.warn(`[game-loop] Planet "${planet.id}" owned by unknown empire "${planet.ownerId}" — skipping population growth`);
        continue;
      }

      const habitability = calculateHabitability(planet, empire.species);
      // If the empire has no organics, the population is starving and cannot grow.
      const empireRes = getEmpireResources(state, empire.id);
      const empireStarving = empireRes.organics <= 0;
      let growth = calculatePopulationGrowth(planet, empire.species, habitability.score, empireStarving);

      if (growth <= 0) continue;

      // Apply happiness growth bonus: high-happiness planets grow faster.
      const empireResources = getEmpireResources(state, empire.id);
      const isAtWar = empireIsAtWar(empire);
      const happiness = calculatePlanetHappiness(planet, empireResources, isAtWar);

      if (happiness.growthModifier !== 0) {
        growth = Math.floor(growth * (1 + happiness.growthModifier));
        if (growth <= 0) growth = 1;
      }

      // Apply government population growth multiplier.
      const govGrowthMult = GOVERNMENTS[empire.government]?.modifiers.populationGrowth ?? 1.0;
      if (govGrowthMult !== 1.0) {
        growth = Math.floor(growth * govGrowthMult);
        if (growth < 0) growth = 0;
      }

      const newPop = Math.min(planet.currentPopulation + growth, planet.maxPopulation);
      const updatedPlanet: Planet = { ...planet, currentPopulation: newPop };
      systems = replacePlanet(systems, updatedPlanet);
    }
  }

  return {
    ...state,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Step 3b: Migration Processing
// ---------------------------------------------------------------------------

/**
 * Process all active migration orders for this tick.
 *
 * For each migrating order:
 * - Advances the wave countdown.
 * - When a wave is sent, updates source/target planet populations.
 * - Emits MigrationWave events per wave.
 * - Emits ColonyEstablished when cumulative arrivals reach the threshold.
 * - Removes completed (established / cancelled) orders from the list.
 */
function stepMigrations(
  state: GameTickState,
  events: GameEvent[],
): GameTickState {
  if (state.migrationOrders.length === 0) return state;

  const tick = state.gameState.currentTick;
  let systems = state.gameState.galaxy.systems;
  const remainingOrders: MigrationOrder[] = [];

  for (const order of state.migrationOrders) {
    if (order.status !== 'migrating') {
      // Already completed or cancelled — drop from list.
      continue;
    }

    // Find the system for this order.
    const systemIndex = systems.findIndex(s => s.id === order.systemId);
    if (systemIndex === -1) {
      console.warn(`[game-loop] Migration order references unknown system "${order.systemId}" — cancelling`);
      remainingOrders.push({ ...order, status: 'cancelled' });
      continue;
    }

    const system = systems[systemIndex]!;
    const { order: updatedOrder, system: updatedSystem, events: waveEvents } =
      processMigrationTick(order, system);

    // Update the systems list if anything changed.
    if (updatedSystem !== system) {
      systems = systems.map((s, i) => (i === systemIndex ? updatedSystem : s));
    }

    // Emit wave events if a wave was sent this tick.
    if (waveEvents.length > 0) {
      // Calculate actual numbers from population change.
      const targetBefore = system.planets.find(p => p.id === order.targetPlanetId);
      const targetAfter = updatedSystem.planets.find(p => p.id === order.targetPlanetId);
      const sourceBefore = system.planets.find(p => p.id === order.sourcePlanetId);
      const sourceAfter = updatedSystem.planets.find(p => p.id === order.sourcePlanetId);

      if (targetBefore && targetAfter && sourceBefore && sourceAfter) {
        const departed = sourceBefore.currentPopulation - sourceAfter.currentPopulation;
        const arrived = targetAfter.currentPopulation - targetBefore.currentPopulation;
        const lost = departed - arrived;

        const waveEvent: MigrationWaveEvent = {
          type: 'MigrationWave',
          empireId: order.empireId,
          systemId: order.systemId,
          departed,
          arrived,
          lost,
          tick,
        };
        events.push(waveEvent);
      }
    }

    // Emit ColonyEstablished when the migration completes.
    if (updatedOrder.status === 'established') {
      const planet = updatedSystem.planets.find(p => p.id === order.targetPlanetId);
      const planetName = planet?.name ?? order.targetPlanetId;

      const establishedEvent: ColonyEstablishedEvent = {
        type: 'ColonyEstablished',
        empireId: order.empireId,
        systemId: order.systemId,
        planetId: order.targetPlanetId,
        planetName,
        tick,
      };
      events.push(establishedEvent);

      // Auto-assign a random governor to the newly established colony.
      const newGovernor = generateGovernor(order.empireId, order.targetPlanetId);
      state = { ...state, governors: [...state.governors, newGovernor] };

      const appointedEvent: GovernorAppointedEvent = {
        type: 'GovernorAppointed',
        empireId: order.empireId,
        planetId: order.targetPlanetId,
        governorName: newGovernor.name,
        tick,
      };
      events.push(appointedEvent);
      // Established orders are not retained.
    } else if (updatedOrder.status === 'migrating') {
      remainingOrders.push(updatedOrder);
    }
    // Cancelled orders are also dropped.
  }

  const result = {
    ...state,
    migrationOrders: remainingOrders,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
  return result;
}

// ---------------------------------------------------------------------------
// Step 3c: Happiness Processing
// ---------------------------------------------------------------------------

/**
 * Apply happiness-driven population effects:
 *   - Revolt (happiness < 10): lose a fraction of population each tick.
 *
 * The production penalty (happiness < 30 → ×0.5 output) is applied inside
 * `stepResourceProduction` where per-planet production is calculated.
 */
function stepHappiness(state: GameTickState): GameTickState {
  let systems = state.gameState.galaxy.systems;

  for (const system of state.gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === null || planet.currentPopulation <= 0) continue;

      const empire = state.gameState.empires.find(e => e.id === planet.ownerId);
      if (!empire) continue;

      const empireResources = getEmpireResources(state, empire.id);
      const isAtWar = empireIsAtWar(empire);
      const happinessBase = calculatePlanetHappiness(planet, empireResources, isAtWar);

      // Apply government flat happiness modifier.
      const govHappiness = GOVERNMENTS[empire.government]?.modifiers.happiness ?? 0;
      const adjustedScore = Math.min(100, Math.max(0, happinessBase.score + govHappiness));
      const revoltThreshold = 10;
      const isRevolt = adjustedScore < revoltThreshold;
      const revoltPopulationLoss = isRevolt && planet.currentPopulation > 0
        ? Math.max(1, Math.floor(planet.currentPopulation * 0.01))
        : 0;

      if (revoltPopulationLoss > 0) {
        const newPop = Math.max(0, planet.currentPopulation - revoltPopulationLoss);
        const updatedPlanet: Planet = { ...planet, currentPopulation: newPop };
        systems = replacePlanet(systems, updatedPlanet);
      }
    }
  }

  return {
    ...state,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Step 3d: Governors
// ---------------------------------------------------------------------------

/**
 * Age all active governors by one tick.
 *
 * Governors whose turnsServed reaches their lifespan die this tick.
 * A GovernorDied event is emitted for each death, leaving the planet without
 * a governor (the player must appoint a replacement via the UI).
 */
function stepGovernors(
  state: GameTickState,
  events: GameEvent[],
): GameTickState {
  if (state.governors.length === 0) return state;

  const tick = state.gameState.currentTick;
  const { updated, died } = processGovernorsTick(state.governors);

  for (const gov of died) {
    const diedEvent: GovernorDiedEvent = {
      type: 'GovernorDied',
      empireId: gov.empireId,
      planetId: gov.planetId,
      governorName: gov.name,
      tick,
    };
    events.push(diedEvent);
  }

  return { ...state, governors: updated };
}

// ---------------------------------------------------------------------------
// Step 4: Resource Production
// ---------------------------------------------------------------------------

function stepResourceProduction(state: GameTickState): GameTickState {
  // Process trade routes once per tick to get per-empire income totals.
  const { income: tradeIncome } = processTradeRoutes(
    state.tradeRoutes,
    state.gameState.galaxy,
  );

  for (const empire of state.gameState.empires) {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    const isAtWar = empireIsAtWar(empire);
    const currentResources = getEmpireResources(state, empire.id);

    // Determine per-planet happiness production multipliers before aggregating.
    // Credits and energy are not penalised (credits fund recovery; energy is
    // needed to escape any deficit).
    // Government flat happiness modifier shifts the score before threshold checks.
    const govHappiness = GOVERNMENTS[empire.government]?.modifiers.happiness ?? 0;
    const happinessMultipliers = new Map<string, number>();
    for (const planet of ownedPlanets) {
      const happiness = calculatePlanetHappiness(planet, currentResources, isAtWar);
      const adjustedScore = Math.min(100, Math.max(0, happiness.score + govHappiness));
      const unrestThreshold = 30;
      const adjustedMult = adjustedScore < unrestThreshold ? 0.5 : 1.0;
      if (adjustedMult !== 1.0) {
        happinessMultipliers.set(planet.id, adjustedMult);
      }
    }

    // Compute per-planet production and re-aggregate with happiness multipliers.
    const { perPlanet } = calculateEmpireProduction(
      ownedPlanets,
      empire.species,
      empire,
    );

    const production = {
      credits: 0,
      minerals: 0,
      rareElements: 0,
      energy: 0,
      organics: 0,
      exoticMaterials: 0,
      faith: 0,
      researchPoints: 0,
    };
    for (const pp of perPlanet) {
      const mult = happinessMultipliers.get(pp.planetId) ?? 1.0;

      // Apply governor modifiers to this planet's production before accumulating.
      const governor = state.governors.find(g => g.planetId === pp.planetId);
      const rawPlanetProduction = {
        credits:          pp.production.credits,
        minerals:         pp.production.minerals * mult,
        rareElements:     pp.production.rareElements * mult,
        energy:           pp.production.energy,
        organics:         pp.production.organics * mult,
        exoticMaterials:  pp.production.exoticMaterials * mult,
        faith:            pp.production.faith * mult,
        researchPoints:   pp.production.researchPoints * mult,
      };
      const boostedProduction = applyGovernorModifiers(rawPlanetProduction, governor);

      production.credits        += boostedProduction.credits;
      production.energy         += boostedProduction.energy;
      production.minerals       += boostedProduction.minerals;
      production.rareElements   += boostedProduction.rareElements;
      production.organics       += boostedProduction.organics;
      production.exoticMaterials += boostedProduction.exoticMaterials;
      production.faith          += boostedProduction.faith;
      production.researchPoints += boostedProduction.researchPoints;
    }

    // Add trade route income to this empire's credit production.
    const tradeCredits = tradeIncome.get(empire.id) ?? 0;
    production.credits += tradeCredits;

    const shipCount = countEmpireShipsViaFleets(
      state.gameState.ships,
      state.gameState.fleets,
      empire.id,
    );
    const buildingCount = countBuildings(ownedPlanets);
    const upkeep = calculateUpkeep(empire, shipCount, buildingCount);

    let newResources = applyResourceTick(currentResources, production, upkeep);

    // Apply energy deficit research penalty: halve accumulated research points.
    // Construction and ship production penalties are handled in their own steps.
    const energyStatus = getEnergyStatus(newResources);
    if (energyStatus.isDeficit) {
      newResources = {
        ...newResources,
        researchPoints: Math.floor(newResources.researchPoints * energyStatus.researchMultiplier),
      };
    }

    // Update both the resource map and empire credits/researchPoints
    state = applyResources(state, empire.id, newResources);
  }

  return state;
}

// ---------------------------------------------------------------------------
// Step 4b: Food Consumption
// ---------------------------------------------------------------------------

/**
 * Deduct organics consumed by the empire's total population this tick.
 * If the empire has insufficient organics, apply starvation population loss
 * proportionally across all owned planets.
 */
function stepFoodConsumption(state: GameTickState): GameTickState {
  let systems = state.gameState.galaxy.systems;

  for (const empire of state.gameState.empires) {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    const totalPopulation = ownedPlanets.reduce((sum, p) => sum + p.currentPopulation, 0);

    const currentResources = getEmpireResources(state, empire.id);
    const { resources: updatedResources, isStarving } = applyFoodConsumption(
      currentResources,
      totalPopulation,
    );

    state = applyResources(state, empire.id, updatedResources);

    if (isStarving && ownedPlanets.length > 0) {
      // Each planet loses 0.5 % of its population (minimum 1) when starving.
      for (const planet of ownedPlanets) {
        if (planet.currentPopulation <= 0) continue;
        const loss = Math.max(1, Math.floor(planet.currentPopulation * 0.005));
        const newPop = Math.max(0, planet.currentPopulation - loss);
        const updatedPlanet = { ...planet, currentPopulation: newPop };
        systems = replacePlanet(systems, updatedPlanet);
      }
    }
  }

  return {
    ...state,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Step 5: Construction Queues
// ---------------------------------------------------------------------------

function stepConstructionQueues(state: GameTickState): GameTickState {
  let systems = state.gameState.galaxy.systems;

  for (const system of state.gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.productionQueue.length === 0) continue;
      if (planet.ownerId === null) continue;

      // Construction rate: base 1 turn per tick, modified by government constructionSpeed.
      const empire = state.gameState.empires.find(e => e.id === planet.ownerId);
      const govConstructionMult = empire
        ? (GOVERNMENTS[empire.government]?.modifiers.constructionSpeed ?? 1.0)
        : 1.0;
      const constructionRate = govConstructionMult;
      const updatedPlanet = processConstructionQueue(planet, constructionRate);

      if (updatedPlanet !== planet) {
        systems = replacePlanet(systems, updatedPlanet);
      }
    }
  }

  return {
    ...state,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Step 5b: Terraforming
// ---------------------------------------------------------------------------

/**
 * Process one tick of terraforming for every colonised planet that has a
 * Terraforming Station building.
 *
 * Emits:
 * - TerraformingProgress when a stage is actively advancing.
 * - TerraformingComplete when all stages finish and the planet type changes.
 */
function stepTerraforming(
  state: GameTickState,
  events: GameEvent[],
): GameTickState {
  const tick = state.gameState.currentTick;
  let systems = state.gameState.galaxy.systems;
  const newProgressMap = new Map(state.terraformingProgressMap);

  for (const system of state.gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === null) continue;

      // Find a terraforming station (any level).
      const station = planet.buildings.find(b => b.type === 'terraforming_station');
      const hasTerraformingStation = station !== undefined;
      const stationLevel = station?.level ?? 1;

      // Only process if there's a station or existing progress to resume.
      const existingProgress = newProgressMap.get(planet.id) ?? null;
      if (!hasTerraformingStation && existingProgress === null) continue;

      const result = processTerraformingTick(
        planet,
        hasTerraformingStation,
        stationLevel,
        existingProgress,
      );

      if (result.progress === null) {
        // Planet is not terraformable — remove any stale record.
        newProgressMap.delete(planet.id);
        continue;
      }

      const progress = result.progress;

      // Supply systemId if the record was freshly created.
      const storedProgress: TerraformingProgress = progress.systemId
        ? progress
        : { ...progress, systemId: system.id };
      newProgressMap.set(planet.id, storedProgress);

      // Update the planet in the systems array if it changed.
      if (result.planet !== planet) {
        const updatedPlanets = system.planets.map(p =>
          p.id === planet.id ? result.planet : p,
        );
        systems = systems.map(s =>
          s.id === system.id ? { ...s, planets: updatedPlanets } : s,
        );
      }

      const empireId = planet.ownerId ?? '';

      // Emit TerraformingComplete when fully done.
      if (storedProgress.stage === 'complete') {
        const completeEvent: TerraformingCompleteEvent = {
          type: 'TerraformingComplete',
          empireId,
          systemId: system.id,
          planetId: planet.id,
          planetName: planet.name,
          newPlanetType: result.planet.type,
          tick,
        };
        events.push(completeEvent);
      } else if (hasTerraformingStation) {
        // Emit progress every tick while station is active.
        const progressEvent: TerraformingProgressEvent = {
          type: 'TerraformingProgress',
          empireId,
          systemId: system.id,
          planetId: planet.id,
          planetName: planet.name,
          stage: storedProgress.stage,
          progressPercent: Math.floor(storedProgress.progress),
          tick,
        };
        events.push(progressEvent);
      }
    }
  }

  return {
    ...state,
    terraformingProgressMap: newProgressMap,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Step 6: Ship Production
// ---------------------------------------------------------------------------

function stepShipProduction(state: GameTickState): GameTickState {
  const remainingOrders: ShipProductionOrder[] = [];
  let ships = [...state.gameState.ships];
  let fleets = [...state.gameState.fleets];

  for (const order of state.productionOrders) {
    const result = processShipProduction(order);

    if (result.completed) {
      // Find the planet to determine its system and owning empire
      let planetOwnerId: string | null = null;
      let systemId: string | null = null;

      for (const system of state.gameState.galaxy.systems) {
        const planet = system.planets.find(p => p.id === order.planetId);
        if (planet) {
          planetOwnerId = planet.ownerId;
          systemId = system.id;
          break;
        }
      }

      if (!planetOwnerId || !systemId) {
        console.warn(
          `[game-loop] Ship production order references unknown planet "${order.planetId}" — discarding`,
        );
        continue;
      }

      // Create a new ship at the construction planet's system
      const newShipId = generateId();
      const newShip: Ship = {
        id: newShipId,
        designId: order.designId,
        name: `Newly Built Ship`,
        hullPoints: 60, // default destroyer hull points; real value comes from design
        maxHullPoints: 60,
        systemDamage: {
          engines: 0,
          weapons: 0,
          shields: 0,
          sensors: 0,
          warpDrive: 0,
        },
        position: { systemId },
        fleetId: null,
      };

      // Look up hull points from design if available
      const design = state.shipDesigns?.get(order.designId);
      if (design) {
        // Design.totalCost is cost, not hull points — hull points come from
        // the HullTemplate which we don't have here.  Leave as 60 and note
        // this should be wired up once the design registry is available.
      }

      // Find an existing friendly fleet in the system to assign the ship to,
      // or create a new singleton fleet.
      const friendlyFleet = fleets.find(
        f => f.empireId === planetOwnerId && f.position.systemId === systemId,
      );

      if (friendlyFleet) {
        fleets = fleets.map(f =>
          f.id === friendlyFleet.id
            ? { ...f, ships: [...f.ships, newShipId] }
            : f,
        );
        ships = [...ships, { ...newShip, fleetId: friendlyFleet.id }];
      } else {
        const empire = state.gameState.empires.find(e => e.id === planetOwnerId);
        const empireName = empire?.name ?? 'Unknown';
        const newFleetId = generateId();
        const newFleet: Fleet = {
          id: newFleetId,
          name: `${empireName} Production Fleet`,
          ships: [newShipId],
          empireId: planetOwnerId,
          position: { systemId },
          destination: null,
          waypoints: [],
          stance: 'defensive',
        };
        fleets = [...fleets, newFleet];
        ships = [...ships, { ...newShip, fleetId: newFleetId }];
      }
    } else if (result.order !== null) {
      remainingOrders.push(result.order);
    }
  }

  return {
    ...state,
    productionOrders: remainingOrders,
    gameState: {
      ...state.gameState,
      fleets,
      ships,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 7: Research Progress
// ---------------------------------------------------------------------------

function stepResearch(
  state: GameTickState,
  allTechs: import('../types/technology.js').Technology[],
  events: GameEvent[],
): GameTickState {
  const tick = state.gameState.currentTick;
  const newResearchStates = new Map(state.researchStates);
  let empires = state.gameState.empires;

  for (const empire of state.gameState.empires) {
    const researchState = newResearchStates.get(empire.id);
    if (!researchState) continue;

    if (researchState.activeResearch.length === 0) continue;

    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    const { total: production } = calculateEmpireProduction(
      ownedPlanets,
      empire.species,
      empire,
    );
    const researchPointsGenerated = production.researchPoints;

    const { newState, completed } = processResearchTick(
      researchState,
      researchPointsGenerated,
      empire.species,
      allTechs,
      empire,
    );

    newResearchStates.set(empire.id, newState);

    // Apply tech effects and update the empire's technology list
    let updatedEmpire = empire;
    for (const tech of completed) {
      // Add tech to empire's technology list
      updatedEmpire = {
        ...updatedEmpire,
        technologies: [...updatedEmpire.technologies, tech.id],
      };
      // Apply any immediate effects (age advancement, stat bonuses)
      updatedEmpire = applyTechEffects(updatedEmpire, tech);

      const techEvent: TechResearchedEvent = {
        type: 'TechResearched',
        empireId: empire.id,
        techId: tech.id,
        tick,
      };
      events.push(techEvent);
    }

    if (completed.length > 0) {
      empires = empires.map(e => (e.id === empire.id ? updatedEmpire : e));
    }
  }

  return {
    ...state,
    researchStates: newResearchStates,
    gameState: { ...state.gameState, empires },
  };
}

// ---------------------------------------------------------------------------
// Step 8: Diplomacy Tick (stub)
// ---------------------------------------------------------------------------

function stepDiplomacyTick(state: GameTickState): GameTickState {
  // TODO: When the diplomacy engine module is implemented, call it here.
  // It should handle:
  //  - Attitude decay towards neutrality over time
  //  - Treaty expiry (treaties with finite duration)
  //  - Trade-route income generation
  //  - Diplomatic event generation (peace offers, war declarations)
  return state;
}

// ---------------------------------------------------------------------------
// Step 9: AI Decisions (stub)
// ---------------------------------------------------------------------------

function stepAIDecisions(state: GameTickState): GameTickState {
  // TODO: When the AI decision engine module is implemented, call it here.
  // For each empire where empire.isAI === true, generate and apply AI orders:
  //  - Economic: build priority buildings, queue ships
  //  - Military: move fleets towards targets, declare wars
  //  - Research: allocate research points
  //  - Diplomatic: propose treaties, respond to proposals
  // AI decisions run after all simulation steps so they can react to this
  // tick's changes before orders take effect next tick.
  return state;
}

// ---------------------------------------------------------------------------
// Step 10: Victory Check
// ---------------------------------------------------------------------------

/**
 * Check whether any victory condition has been met.
 *
 * Delegates to checkVictoryConditions from the victory engine.  The
 * economicLeadTicks counter stored in state is evaluated this tick; the game
 * loop updates it (via updateEconomicLeadTicks) before calling this function.
 */
export function isGameOver(
  state: GameTickState,
): { over: boolean; winnerId?: string; reason?: string } {
  if (state.gameState.status === 'finished') {
    // If status was set externally (e.g., by a direct command), respect it.
    return { over: true, reason: 'game_finished' };
  }

  const result = checkVictoryConditions(
    state.gameState,
    state.empireResourcesMap,
    state.economicLeadTicks,
    state.allTechCount,
  );

  if (result) {
    return { over: true, winnerId: result.winner, reason: result.condition };
  }

  return { over: false };
}

// ---------------------------------------------------------------------------
// Main tick processor
// ---------------------------------------------------------------------------

/**
 * Process one complete game tick.
 *
 * @param state     The current tick state snapshot.
 * @param allTechs  The full technology tree, used for research processing.
 *                  Pass an empty array to skip research advancement.
 * @returns         A new GameTickState with all changes applied, plus the
 *                  list of events generated this tick.
 */
export function processGameTick(
  state: GameTickState,
  allTechs: import('../types/technology.js').Technology[] = [],
): TickResult {
  const events: GameEvent[] = [];

  // Paused games do not advance
  if (state.gameState.status === 'paused') {
    return { newState: state, events };
  }
  if (state.gameState.status !== 'playing') {
    return { newState: state, events };
  }

  let s = state;

  // 0. Process Pending Actions (colonisation, building construction, speed changes)
  s = processPlayerActions(s, events);

  // 1. Fleet Movement
  s = stepFleetMovement(s, events);

  // 2. Combat Resolution
  s = stepCombatResolution(s, events);

  // 3. Population Growth
  s = stepPopulationGrowth(s);

  // 3b. Migration Processing (after population growth so wave logistics are current)
  s = stepMigrations(s, events);

  // 3c. Happiness Processing (revolt population loss; production multipliers collected next step)
  s = stepHappiness(s);

  // 3d. Governor ageing (age all governors; emit GovernorDied for those that expire)
  s = stepGovernors(s, events);

  // 4. Resource Production (applies happiness production multipliers, governor modifiers, and energy deficit penalties)
  s = stepResourceProduction(s);

  // 4b. Food Consumption (deduct organics; apply starvation loss if starving)
  s = stepFoodConsumption(s);

  // 5. Construction Queues
  s = stepConstructionQueues(s);

  // 5b. Terraforming (after construction so newly built stations take effect next tick)
  s = stepTerraforming(s, events);

  // 6. Ship Production
  s = stepShipProduction(s);

  // 7. Research Progress
  s = stepResearch(s, allTechs, events);

  // 8. Diplomacy Tick (stub)
  s = stepDiplomacyTick(s);

  // 9. AI Decisions (stub)
  s = stepAIDecisions(s);

  // 10. Victory Check — update economic lead counters then evaluate all conditions
  s = {
    ...s,
    economicLeadTicks: updateEconomicLeadTicks(
      s.gameState.empires,
      s.empireResourcesMap,
      s.economicLeadTicks,
    ),
  };

  const victoryCheck = isGameOver(s);
  if (victoryCheck.over) {
    const winnerId = victoryCheck.winnerId ?? '';
    if (winnerId) {
      const gameOverEvent = {
        type: 'GameOver' as const,
        winnerEmpireId: winnerId,
        victoryCriteria: victoryCheck.reason ?? 'unknown',
        tick: s.gameState.currentTick,
      };
      events.push(gameOverEvent);
    }
    s = {
      ...s,
      gameState: { ...s.gameState, status: 'finished' },
    };
  }

  // 11. Advance Tick
  s = {
    ...s,
    gameState: {
      ...s.gameState,
      currentTick: s.gameState.currentTick + 1,
    },
  };

  return { newState: s, events };
}

// ---------------------------------------------------------------------------
// initializeTickState
// ---------------------------------------------------------------------------

/**
 * Build an initial GameTickState from a freshly created (or loaded) GameState.
 * All supplementary fields (research states, orders, pending combats) start empty.
 *
 * Each empire receives an empty ResearchState in the 'nano_atomic' age.
 */
export function initializeTickState(gameState: GameState): GameTickState {
  const researchStates = new Map<string, ResearchState>();

  for (const empire of gameState.empires) {
    researchStates.set(empire.id, {
      completedTechs: [...empire.technologies],
      activeResearch: [],
      currentAge: empire.currentAge,
      totalResearchGenerated: 0,
    });
  }

  // Seed per-empire resource stockpiles from starting values.
  // Organics are seeded proportionally to starting population.  We provide a
  // generous buffer of 200 ticks of consumption so that the early game is not
  // dominated by food micromanagement before the player has had a chance to
  // build Hydroponics Bays.  Food pressure increases naturally as the stockpile
  // is consumed faster than planets produce.
  const empireResourcesMap = new Map<string, EmpireResources>();
  for (const empire of gameState.empires) {
    const startingPop = gameState.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.ownerId === empire.id)
      .reduce((sum, p) => sum + p.currentPopulation, 0);
    // 1 organic per 1 000 pop per tick; seed 200 ticks worth as a comfortable buffer.
    const startingOrganics = Math.max(100, Math.floor(startingPop / 1_000) * 200);
    empireResourcesMap.set(empire.id, {
      credits: empire.credits,
      minerals: 200,
      rareElements: 0,
      energy: 50,
      organics: startingOrganics,
      exoticMaterials: 0,
      faith: 0,
      researchPoints: empire.researchPoints,
    });
  }

  // Auto-assign a governor to every planet that is already colonised at game start.
  const startingGovernors: Governor[] = [];
  for (const system of gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId !== null && planet.currentPopulation > 0) {
        startingGovernors.push(generateGovernor(planet.ownerId, planet.id));
      }
    }
  }

  return {
    gameState,
    researchStates,
    movementOrders: [],
    productionOrders: [],
    pendingCombats: [],
    migrationOrders: [],
    pendingActions: [],
    empireResourcesMap,
    tradeRoutes: [],
    economicLeadTicks: new Map<string, number>(),
    allTechCount: 0,
    terraformingProgressMap: new Map<string, TerraformingProgress>(),
    governors: startingGovernors,
  };
}

// ---------------------------------------------------------------------------
// getTickRate
// ---------------------------------------------------------------------------

/**
 * Return the number of milliseconds between game ticks for the given speed.
 *
 * - paused   → 0   (game does not advance)
 * - slow     → 4000 ms  (deliberate, strategic pace)
 * - normal   → 2000 ms  (comfortable play speed)
 * - fast     → 1000 ms  (accelerated)
 * - fastest  → 500 ms   (skip-ahead speed)
 */
export function getTickRate(speed: keyof typeof GAME_SPEEDS): number {
  switch (speed) {
    case 'paused':  return 0;
    case 'slow':    return 4000;
    case 'normal':  return 2000;
    case 'fast':    return 1000;
    case 'fastest': return 500;
    default: {
      const _exhaustive: never = speed;
      console.warn(`[game-loop] Unknown game speed "${String(_exhaustive)}" — defaulting to normal`);
      return 1000;
    }
  }
}

// ---------------------------------------------------------------------------
// submitAction
// ---------------------------------------------------------------------------

/**
 * Pure helper that appends a player action to the pending queue.
 *
 * The GameEngine on the client (or server-side command handler) calls this
 * whenever a player submits an order.  The action is processed at the
 * beginning of the next call to processGameTick.
 *
 * @param state     Current tick state snapshot.
 * @param empireId  The empire submitting the action.
 * @param action    The action payload.
 * @returns         A new GameTickState with the action appended.
 */
export function submitAction(
  state: GameTickState,
  empireId: string,
  action: GameAction,
): GameTickState {
  const playerAction: PlayerAction = {
    empireId,
    action,
    tick: state.gameState.currentTick,
  };
  return {
    ...state,
    pendingActions: [...state.pendingActions, playerAction],
  };
}
