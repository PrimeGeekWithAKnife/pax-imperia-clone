/**
 * Central game loop — ties all engine modules together into a single tick.
 *
 * processGameTick is the master entry point.  Call it once per game tick to
 * advance the entire simulation.  All functions here are pure / side-effect-free;
 * callers must persist the returned state.
 *
 * Processing order per tick:
 *  1.  Fleet Movement
 *  2.  Combat Resolution
 *  3.  Population Growth
 *  4.  Resource Production
 *  5.  Construction Queues
 *  6.  Ship Production
 *  7.  Research Progress
 *  8.  Diplomacy Tick       (stub)
 *  9.  AI Decisions         (stub)
 *  10. Victory Check        (stub)
 *  11. Advance Tick
 */

import type { GameState } from '../types/game-state.js';
import type { StarSystem, Planet } from '../types/galaxy.js';
import type { Empire } from '../types/species.js';
import type { Fleet, Ship, ShipDesign, ShipComponent } from '../types/ships.js';
import type { EmpireResources } from '../types/resources.js';
import type {
  GameEvent,
  FleetMovedEvent,
  CombatStartedEvent,
  CombatResolvedEvent,
  TechResearchedEvent,
} from '../types/events.js';
import { GAME_SPEEDS } from '../constants/game.js';
import {
  calculateEmpireProduction,
  calculateUpkeep,
  applyResourceTick,
} from './economy.js';
import {
  calculateHabitability,
  calculatePopulationGrowth,
  processConstructionQueue,
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
 * Build a Map from empire ID to EmpireResources, extracting credits and
 * researchPoints from the Empire object.  All other resources start at 0
 * (they accumulate via production ticks).
 *
 * In the current Empire type, only `credits` and `researchPoints` are stored;
 * the remaining EmpireResources fields represent per-tick stockpiles tracked
 * externally.  We seed them from whatever the game-loop state holds.
 */
function extractEmpireResources(empire: Empire): EmpireResources {
  return {
    credits: empire.credits,
    minerals: 0,
    rareElements: 0,
    energy: 0,
    organics: 0,
    exoticMaterials: 0,
    faith: 0,
    researchPoints: empire.researchPoints,
  };
}

/** Write an EmpireResources snapshot back onto a (mutable copy of) Empire. */
function applyResourcesToEmpire(empire: Empire, resources: EmpireResources): Empire {
  return {
    ...empire,
    credits: resources.credits,
    researchPoints: resources.researchPoints,
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
      const growth = calculatePopulationGrowth(planet, empire.species, habitability.score);

      if (growth <= 0) continue;

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
// Step 4: Resource Production
// ---------------------------------------------------------------------------

function stepResourceProduction(state: GameTickState): GameTickState {
  let empires = state.gameState.empires;

  for (const empire of state.gameState.empires) {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    const { total: production } = calculateEmpireProduction(
      ownedPlanets,
      empire.species,
      empire,
    );

    const shipCount = countEmpireShipsViaFleets(
      state.gameState.ships,
      state.gameState.fleets,
      empire.id,
    );
    const buildingCount = countBuildings(ownedPlanets);
    const upkeep = calculateUpkeep(empire, shipCount, buildingCount);

    const currentResources = extractEmpireResources(empire);
    const newResources = applyResourceTick(currentResources, production, upkeep);

    const updatedEmpire = applyResourcesToEmpire(empire, newResources);
    empires = empires.map(e => (e.id === empire.id ? updatedEmpire : e));
  }

  return {
    ...state,
    gameState: { ...state.gameState, empires },
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

      // Construction rate: 1 turn per tick (factories will eventually modify this)
      const constructionRate = 1;
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
// Step 10: Victory Check (stub)
// ---------------------------------------------------------------------------

/**
 * Check whether any victory condition has been met.
 * Returns over=false as a stub until victory logic is implemented.
 */
export function isGameOver(
  state: GameTickState,
): { over: boolean; winnerId?: string; reason?: string } {
  // TODO: implement victory condition checks:
  //  - 'conquest': one empire owns all colonised systems
  //  - 'economic': one empire's credits exceed a threshold
  //  - 'research': one empire has completed all technologies
  //  - 'diplomatic': one empire holds alliances with all other empires

  if (state.gameState.status === 'finished') {
    // If status was set externally (e.g., by a direct command), respect it.
    return { over: true, reason: 'game_finished' };
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

  // 1. Fleet Movement
  s = stepFleetMovement(s, events);

  // 2. Combat Resolution
  s = stepCombatResolution(s, events);

  // 3. Population Growth
  s = stepPopulationGrowth(s);

  // 4. Resource Production
  s = stepResourceProduction(s);

  // 5. Construction Queues
  s = stepConstructionQueues(s);

  // 6. Ship Production
  s = stepShipProduction(s);

  // 7. Research Progress
  s = stepResearch(s, allTechs, events);

  // 8. Diplomacy Tick (stub)
  s = stepDiplomacyTick(s);

  // 9. AI Decisions (stub)
  s = stepAIDecisions(s);

  // 10. Victory Check (stub — set status to finished if over)
  const victoryCheck = isGameOver(s);
  if (victoryCheck.over) {
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
 * Each empire receives an empty ResearchState in the 'diamond_age'.
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

  return {
    gameState,
    researchStates,
    movementOrders: [],
    productionOrders: [],
    pendingCombats: [],
  };
}

// ---------------------------------------------------------------------------
// getTickRate
// ---------------------------------------------------------------------------

/**
 * Return the number of milliseconds between game ticks for the given speed.
 *
 * - paused   → 0   (game does not advance)
 * - slow     → 2000 ms
 * - normal   → 1000 ms
 * - fast     → 500 ms
 * - fastest  → 250 ms
 */
export function getTickRate(speed: keyof typeof GAME_SPEEDS): number {
  switch (speed) {
    case 'paused':  return 0;
    case 'slow':    return 2000;
    case 'normal':  return 1000;
    case 'fast':    return 500;
    case 'fastest': return 250;
    default: {
      const _exhaustive: never = speed;
      console.warn(`[game-loop] Unknown game speed "${String(_exhaustive)}" — defaulting to normal`);
      return 1000;
    }
  }
}
