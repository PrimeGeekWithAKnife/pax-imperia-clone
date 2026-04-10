/**
 * Central game loop — ties all engine modules together into a single tick.
 *
 * processGameTick is the master entry point.  Call it once per game tick to
 * advance the entire simulation.  All functions here are pure / side-effect-free;
 * callers must persist the returned state.
 *
 * Processing order per tick:
 *  0.   Player Actions       (colonise/start migration, build, speed change)
 *  1.   Fleet Movement
 *  1c.  Orbital Debris       (decay, ship/building damage, Kessler cascade)
 *  2.   Combat Resolution    (destroyed ships create debris)
 *  3.   Population Growth    (applies happiness growth bonus/revolt loss)
 *  3a.  Healthcare           (disease, pandemics, medical infrastructure)
 *  3b.  Migration Processing (wave departures, arrivals, colony establishment)
 *  3c.  Happiness Processing (unrest/revolt effects, production multipliers)
 *  3d.  Politics             (factions, elections, policy drift)
 *  3e.  Corruption           (wealth, employment, crime — after happiness)
 *  3f.  Governor Ageing      (age all governors; emit GovernorDied)
 *  4.   Resource Production  (energy deficit penalties applied here)
 *  4b.  Food Consumption     (organics deducted; starvation population loss)
 *  5.   Construction Queues
 *  5b.  Terraforming         (atmosphere, temperature, biosphere, planet conversion)
 *  6.   Ship Production
 *  7.   Research Progress
 *  8.   Diplomacy Tick       (attitude decay, treaty expiry, status recalc)
 *  8a.  Grievances           (inter-empire grievance decay and expiry)
 *  8a+. Diplomat Characters  (experience, loyalty drift, skill progression)
 *  8b.  Espionage            (spy infiltration, mission rolls, counter-intel)
 *  8b+. Galactic Organisations (council membership, resolutions, formation)
 *  8b++.Galactic Bank        (loan interest accrual, default checks)
 *  8c.  Minor Species        (integration, uplift, revolt, natural advancement)
 *  8d.  Anomaly Investigations (progress active excavation sites)
 *  8e.  Narrative Chains     (trigger and progress multi-step stories)
 *  8h.  Vassalage Tribute    (collect tribute from vassals, transfer to overlords)
 *  9.   AI Decisions
 *  9b.  Waste Processing     (accumulation, reduction, overflow penalties)
 *  9d.  Marketplace          (commodity prices, trade orders, sanctions)
 *  9c.  Building Condition   (maintenance-based decay, functionality checks)
 *  10.  Victory Check        (conquest / economic / technological / diplomatic)
 *  11.  Advance Tick
 */

import type { GameState } from '../types/game-state.js';
import type { StarSystem, Planet, BuildingType, OrbitalDebris } from '../types/galaxy.js';
import type { Fleet, Ship, ShipDesign, ShipComponent, HullClass } from '../types/ships.js';
import { getEffectiveHullPoints } from '../types/ships.js';
import { TRANSPORT_CAPACITY } from './ground-combat.js';
import type { EmpireResources } from '../types/resources.js';
import type { Governor } from '../types/governor.js';
import type { EmpireLeader } from '../types/leaders.js';
import { generateStartingLeaders, processLeadersTick, tickLeaderExperience, generateLeader } from './leaders.js';
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
  EspionageResultEvent,
} from '../types/events.js';
import { GAME_SPEEDS, TECH_AGES } from '../constants/game.js';
import { SHIP_COMPONENTS, HULL_TEMPLATE_BY_CLASS } from '../../data/ships/index.js';
import { getDiplomaticVoice } from '../../data/species/index.js';
import { generateDefaultDesigns, getAvailableComponents } from './ship-design.js';
import {
  BASE_CONSTRUCTION_RATE,
  FACTORY_CONSTRUCTION_OUTPUT,
  BUILDING_LEVEL_MULTIPLIER,
} from '../constants/resources.js';
import {
  calculateEmpireProduction,
  calculateUpkeep,
  calculateNavalCapacity,
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
  inferBuildingZone,
  ZONE_COST_MULTIPLIER,
  canColoniseWithShip,
  coloniseWithShip,
  getFoundingBuildings,
  getFoundingPopulation,
  canUpgradeBuilding,
  addUpgradeToQueue,
  getUpgradeCost,
  getEffectiveMaxPopulation,
  TRANSIT_DURATION,
  type MigrationOrder,
} from './colony.js';
import {
  processResearchTick,
  applyTechEffects,
  startResearch,
  type ResearchState,
} from './research.js';
import {
  processFleetMovement,
  processShipProduction,
  issueMovementOrder,
  startShipProduction,
  determineTravelMode,
  getSpeciesBeamResistance,
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
  tickGovernorExperience,
  governorAutoBuildDecision,
} from './governors.js';
import {
  calculateEnergyProduction,
  calculateEnergyDemand,
  calculateEnergyBalance,
  calculateStorageCapacity,
  getBuildingEfficiency,
} from './energy-flow.js';
import type { PlanetEnergyState, PlanetWasteState } from '../types/waste.js';
import {
  calculateWasteCapacity,
  calculateWasteProduction,
  calculateWasteReduction,
  tickWaste,
} from './waste.js';
import {
  tickBuildingCondition,
  isBuildingFunctional,
} from './building-condition.js';
import { BUILDING_DEFINITIONS, type BuildingDefinition } from '../constants/buildings.js';
import {
  evaluateEmpireState,
  generateAIDecisions,
  selectTopDecisions,
  type AIDecision,
  type WarTerritoryTracker,
} from './ai.js';
import {
  initialiseEspionage,
  recalculateCounterIntel,
  processEspionageTick,
  recruitSpy,
  assignMission,
  addAgentToState,
  SPY_RECRUIT_COST,
  type EspionageState,
  type EspionageEvent,
  type SpyMission,
} from './espionage.js';
import {
  processCorruptionTick,
  processWealthDistribution,
  processEmployment,
  processCrime,
  checkEconomicCrisis,
  getCorruptionPenalty,
  type EmpireCorruptionState,
  type CorruptionEvent,
} from './corruption.js';
import {
  progressExcavation,
  type AnomalyEvent as AnomalyEngineEvent,
  type ExcavationSite,
} from './anomaly.js';
import {
  processMinorSpeciesTick,
  type MinorSpeciesEvent,
} from './minor-species.js';
import {
  processMarketTick,
  type MarketState,
  type MarketEmpireView,
  type MarketTradeRouteView,
  type MarketEvent,
} from './marketplace.js';
import {
  processDiplomacyTick,
  proposeTreaty,
  breakTreaty,
  declareWar,
  makePeace,
  evaluateTreatyProposal,
  getRelation,
  initializeDiplomacy,
  makeFirstContact,
  modifyAttitude,
  isEmpireEliminated,
  type DiplomacyState,
} from './diplomacy.js';
import { createNotification } from './notifications.js';
import { processGalacticEvents, type GalacticEvent } from './galactic-events.js';
import {
  createEmpireWarState,
  tickWarState,
  recordBattle,
  recordCasualties,
  checkWarWearinessEvents,
  shouldForceAIPeace,
  AI_FORCED_PEACE_CHANCE,
  getWarUpkeepMultiplier,
  type EmpireWarState,
  type WarWearinessEvent,
} from './war-response.js';
import {
  processPoliticalTick,
  processElection,
  initialisePoliticalState,
  type EmpirePoliticalState,
  type RNG,
} from './politics.js';
import {
  processHealthcareTick,
  checkPandemicTrigger,
  generateDisease,
  inferBiology,
  type Disease,
  type HealthcarePolicy,
} from './healthcare.js';
import {
  processGrievanceTick,
} from './grievance.js';
import {
  processDiplomatTick,
} from './diplomat.js';
import {
  processOrganisationTick,
  canFormOrganisation,
} from './galactic-council.js';
import {
  processLoanTick,
} from './galactic-bank.js';
import type {
  Grievance,
  Diplomat,
  GalacticOrganisationState,
  GalacticBank,
  Demand,
  DemandState,
} from '../types/diplomacy.js';
import { initDemandState, createDemand, acceptDemand, rejectDemand, processDemandsTick, evaluateDemandAI, DEMAND_DEADLINE_TICKS } from './demands.js';
import type { TreatyType } from '../types/species.js';
import {
  getAvailableChains,
  startChain,
  type NarrativeChainProgress,
} from './narrative.js';
import type { NarrativeChain } from '../types/narrative.js';
import { ELECTION_INTERVAL } from '../constants/time.js';
import type { EmpirePsychologicalState } from '../types/psychology.js';
import { initPsychologicalState, processPsychologyTick } from './psychology/tick.js';
import type { EmpireStateSnapshot } from './psychology/maslow.js';
import { evaluateTreatyWithPsychology } from './psychology/ai-integration.js';
import { createRelationship } from './psychology/relationship.js';
import { AFFINITY_MATRIX } from '../../data/species/personality/index.js';
import { lookupBaseAffinity } from './psychology/compatibility.js';
import { SPECIES_DEFAULT_PROFILES } from './ai/personality.js';
import type { DemandThreat } from '../types/diplomacy.js';
import { mapTreatyToRelationshipEvent, recordDiplomaticEvent, syncPsychologyToDiplomacy } from './diplomacy-bridge.js';
import type { ReputationState } from '../types/reputation.js';
import { initReputationState, processReputationTick, recordReputationEvent, REPUTATION_EVENT_VALUES, getReputationModifier } from './reputation.js';
import type { CouncilStateV2, SanctionPenalties } from '../types/council-v2.js';
import type { EmbargoState } from '../types/diplomacy.js';
import { initEmbargoState, declareEmbargo, liftEmbargo, isEmbargoed } from './embargo.js';
import { findVassalRelationships, calculateTribute, applyTribute, isVassalActionRestricted, getOverlord, getVassals, isVassal, VASSAL_TRIBUTE_RATE } from './vassalage.js';

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
   * Per-planet waste state.  Key = planetId.
   * Created/updated each tick for every owned planet.
   */
  wasteMap: Map<string, PlanetWasteState>;
  /**
   * Per-planet energy state.  Key = planetId.
   * Created/updated each tick for every owned planet.
   */
  energyStateMap: Map<string, PlanetEnergyState>;
  /**
   * Per-planet list of building IDs powered off by player choice.
   * Key = planetId.  An empty array (or missing entry) means all buildings
   * are powered on.
   */
  disabledBuildingsMap: Map<string, string[]>;
  /**
   * All active governors across all empires.
   * Each governor is assigned to one planet (governor.planetId).
   * At most one governor should exist per planet at any time.
   */
  governors: Governor[];
  /**
   * Empire-wide leaders (Head of Research, Spy Master, Admiral, General).
   * One of each role per empire, generated at game start, replaced on death.
   */
  leaders: EmpireLeader[];
  /**
   * Espionage state — spy agents, counter-intel levels for all empires.
   * Processed once per tick by stepEspionage.
   */
  espionageState: EspionageState;
  /**
   * Cumulative log of espionage events (intel results, captures, etc.).
   * Most recent events are appended at the end.
   */
  espionageEventLog: EspionageEvent[];
  /**
   * Per-empire war territory tracking for stalemate detection.
   * Key = empireId. Updated each tick during AI decisions.
   */
  warTerritoryTrackers: Map<string, WarTerritoryTracker>;
  /** Inter-empire diplomatic relations (legacy attitude/trust model). */
  diplomacyState?: DiplomacyState;
  /** Per-empire psychological state (5-dimensional relationship model). */
  psychStateMap?: Map<string, EmpirePsychologicalState>;
  /** Galaxy-wide reputation tracking per empire. */
  reputationState?: ReputationState;
  /** Active diplomatic demands between empires. */
  demandState?: DemandState;
  /** Active bilateral embargoes between empires. */
  embargoState?: EmbargoState;
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
// Demand asset transfer helper
// ---------------------------------------------------------------------------

function transferDemandedAsset(state: GameTickState, demand: Demand): GameTickState {
  if (demand.demandType === 'resources' && demand.resourceType && demand.amount) {
    // Transfer resources from target to proposer
    const targetRes = state.empireResourcesMap.get(demand.targetId);
    const proposerRes = state.empireResourcesMap.get(demand.proposerId);
    if (targetRes && proposerRes) {
      const key = demand.resourceType as keyof typeof targetRes;
      if (typeof targetRes[key] === 'number' && typeof proposerRes[key] === 'number') {
        const transfer = Math.min(demand.amount, targetRes[key] as number);
        const newMap = new Map(state.empireResourcesMap);
        newMap.set(demand.targetId, { ...targetRes, [key]: (targetRes[key] as number) - transfer });
        newMap.set(demand.proposerId, { ...proposerRes, [key]: (proposerRes[key] as number) + transfer });
        state = { ...state, empireResourcesMap: newMap };
      }
    }
  }
  // System and technology transfers are more complex — stub for now
  // TODO: Implement system cession and tech sharing
  return state;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- notifications is a dynamic property
  const rejectionNotifications: ReturnType<typeof createNotification>[] = [];

  /** Push an action_rejected notification for the given empire. */
  function rejectAction(empId: string, reason: string): void {
    rejectionNotifications.push(
      createNotification(
        'action_rejected',
        'Action rejected',
        reason,
        tick,
        undefined,
        { empireId: empId },
      ),
    );
  }

  for (const playerAction of state.pendingActions) {
    const { empireId, action } = playerAction;

    try {
      // ── ColonisePlanet / ColonizePlanet ────────────────────────────────────
      if (action.type === 'ColonisePlanet' || action.type === 'ColonizePlanet') {
        // Both spellings are supported; extract fields depending on variant.
        const systemId = action.type === 'ColonisePlanet' ? action.systemId : null;
        const planetId = action.planetId;

        if (!systemId) {
          // ColonizePlanet (US spelling) — fleet-based inter-system colonisation.
          const fleetId = (action as { fleetId: string }).fleetId;
          const fleet = state.gameState.fleets.find(f => f.id === fleetId);
          if (!fleet) {
            console.warn(`[game-loop] ColonizePlanet references unknown fleet "${fleetId}" — skipping`);
            continue;
          }
          const fleetSystem = systems.find(s => s.id === fleet.position.systemId);
          if (!fleetSystem) {
            console.warn(`[game-loop] ColonizePlanet fleet system not found — skipping`);
            continue;
          }
          const empire = empires.find(e => e.id === empireId);
          if (!empire) continue;

          // Find a coloniser ship in the fleet
          const designsMap = state.shipDesigns ?? new Map<string, ShipDesign>();
          const fleetShips = state.gameState.ships.filter(s => fleet.ships.includes(s.id));
          const coloniserShip = fleetShips.find(s => {
            const design = designsMap.get(s.designId);
            return design && (design as unknown as { hull: string }).hull.startsWith('coloniser');
          });
          if (!coloniserShip) {
            console.warn(`[game-loop] ColonizePlanet fleet has no coloniser ship — skipping`);
            rejectAction(empireId, 'Fleet has no coloniser ship.');
            continue;
          }

          const systemFleets = state.gameState.fleets.filter(f => f.position.systemId === fleetSystem.id);
          const check = canColoniseWithShip(coloniserShip, fleet, fleetSystem, planetId, empire.species, systemFleets);
          if (!check.allowed) {
            console.warn(`[game-loop] ColonizePlanet rejected: ${check.reason}`);
            rejectAction(empireId, `Colonisation rejected: ${check.reason}`);
            continue;
          }

          // Guard against race condition: reject if an active migration already
          // targets this planet (e.g. another empire's ColonisePlanet was
          // processed earlier in the same tick, or a migration from a prior tick
          // is still in progress).
          const activeMigrationToTarget = state.migrationOrders.find(
            o => o.targetPlanetId === planetId && o.status === 'migrating',
          );
          if (activeMigrationToTarget) {
            console.warn(`[game-loop] ColonizePlanet rejected: active migration already targets planet "${planetId}"`);
            rejectAction(empireId, 'Another migration is already targeting this planet.');
            continue;
          }

          // Pass the empire's researched techs for tech-based founding packages
          const empireResearchState = state.researchStates.get(empireId);
          const currentAge = empireResearchState?.currentAge ?? 'nano_atomic';
          const empireObj = state.gameState.empires.find(e => e.id === empireId);
          const researchedTechs = empireObj?.technologies ?? [];
          const result = coloniseWithShip(fleetSystem, planetId, empireId, fleet, coloniserShip.id, currentAge, researchedTechs);
          systems = systems.map(s => s.id === fleetSystem.id ? result.system : s);

          // Update the fleet (ship consumed)
          state = {
            ...state,
            gameState: {
              ...state.gameState,
              fleets: state.gameState.fleets.map(f => f.id === fleetId ? result.fleet : f),
              ships: state.gameState.ships.filter(s => s.id !== coloniserShip.id),
              galaxy: { ...state.gameState.galaxy, systems },
            },
          };
          systems = state.gameState.galaxy.systems;

          // Emit colony established event
          const targetPlanet = result.system.planets.find(p => p.id === planetId);
          const establishedEvent: ColonyEstablishedEvent = {
            type: 'ColonyEstablished',
            empireId,
            systemId: fleetSystem.id,
            planetId,
            planetName: targetPlanet?.name ?? planetId,
            tick,
          };
          events.push(establishedEvent);

          // Auto-assign governor
          const newGovernor = generateGovernor(empireId, planetId);
          state = { ...state, governors: [...state.governors, newGovernor] };
          events.push({
            type: 'GovernorAppointed',
            empireId,
            planetId,
            governorName: newGovernor.name,
            tick,
          } as GovernorAppointedEvent);

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
          rejectAction(empireId, 'No owned planet in this system to colonise from.');
          continue;
        }

        // Look up minerals from the resource map.
        const empMinerals = state.empireResourcesMap.get(empireId)?.minerals ?? 0;

        // Check for foreign fleets blocking colonisation via patrol/aggressive stance
        const blockingMigFleet = state.gameState.fleets.find(f =>
          f.empireId !== empireId &&
          f.position.systemId === systemId &&
          f.ships.length > 0 &&
          (f.stance === 'patrol' || f.stance === 'aggressive')
        );
        if (blockingMigFleet) {
          rejectAction(empireId, 'Foreign military forces on patrol are blocking colonisation in this system.');
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
          empMinerals,
        );

        if (!check.allowed) {
          console.warn(`[game-loop] ColonisePlanet rejected for empire "${empireId}": ${check.reason}`);
          rejectAction(empireId, `Colonisation rejected: ${check.reason}`);
          continue;
        }

        // Deduct the colonisation credit + mineral costs upfront from both empire and resource map.
        const updatedEmpire = { ...empire, credits: empire.credits - check.cost };
        empires = empires.map(e => (e.id === empireId ? updatedEmpire : e));
        // Also deduct from the persistent resource map
        const resMap = state.empireResourcesMap;
        const empRes = resMap.get(empireId);
        if (empRes) {
          const newMap = new Map(resMap);
          newMap.set(empireId, {
            ...empRes,
            credits: empRes.credits - check.cost,
            minerals: empRes.minerals - check.mineralCost,
          });
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
        const targetZone = action.targetZone ?? inferBuildingZone(buildingType);

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
          rejectAction(empireId, 'You do not own this planet.');
          continue;
        }

        // Retrieve researched tech IDs so building tech gates are enforced.
        const empireResearchState = state.researchStates.get(empireId);
        const empireTechs = empireResearchState?.completedTechs ?? [];

        // Look up the building empire's species for racial building restrictions
        const buildingEmpireForSpecies = empires.find(e => e.id === empireId);
        const buildCheck = canBuildOnPlanet(planet, buildingType as BuildingType, buildingEmpireForSpecies?.species, empireTechs, targetZone);
        if (!buildCheck.allowed) {
          console.warn(`[game-loop] ConstructBuilding rejected for planet "${planetId}": ${buildCheck.reason}`);
          rejectAction(empireId, `Construction rejected: ${buildCheck.reason}`);
          continue;
        }

        // Check affordability and deduct building cost (zone multiplier + government buildingCost modifier)
        const buildDef = BUILDING_DEFINITIONS[buildingType as BuildingType];
        if (buildDef) {
          const zoneMultiplier = ZONE_COST_MULTIPLIER[targetZone] ?? 1;
          const buildingEmpire = empires.find(e => e.id === empireId);
          const govBuildingCostMult = buildingEmpire
            ? (GOVERNMENTS[buildingEmpire.government]?.modifiers.buildingCost ?? 1.0)
            : 1.0;
          const costMultiplier = zoneMultiplier * govBuildingCostMult;
          const res = getEmpireResources(state, empireId);

          // Verify the empire can afford the building before deducting
          let canAfford = true;
          for (const [key, amount] of Object.entries(buildDef.baseCost)) {
            const cost = (amount ?? 0) * costMultiplier;
            if (cost > 0 && (res[key as keyof EmpireResources] ?? 0) < cost) {
              canAfford = false;
              break;
            }
          }
          if (!canAfford) {
            console.warn(`[game-loop] ConstructBuilding rejected — empire "${empireId}" cannot afford "${buildingType}"`);
            rejectAction(empireId, `Cannot afford to build ${buildingType}.`);
            continue;
          }

          for (const [key, amount] of Object.entries(buildDef.baseCost)) {
            if (amount && amount > 0) {
              res[key as keyof EmpireResources] -= amount * costMultiplier;
            }
          }
          state = applyResources(state, empireId, res);
          // Re-fetch systems after resource update (applyResources may update empires)
          systems = state.gameState.galaxy.systems;
        }

        const updatedPlanet = addBuildingToQueue(planet, buildingType as BuildingType, undefined, empireTechs, targetZone);
        systems = replacePlanet(systems, updatedPlanet);

      // ── UpgradeBuilding ───────────────────────────────────────────────────
      } else if (action.type === 'UpgradeBuilding') {
        const { systemId, planetId, buildingId } = action;

        const systemData = systems.find(s => s.id === systemId);
        if (!systemData) {
          console.warn(`[game-loop] UpgradeBuilding references unknown system "${systemId}" — skipping`);
          continue;
        }

        const planet = systemData.planets.find(p => p.id === planetId);
        if (!planet) {
          console.warn(`[game-loop] UpgradeBuilding references unknown planet "${planetId}" — skipping`);
          continue;
        }

        if (planet.ownerId !== empireId) {
          console.warn(`[game-loop] UpgradeBuilding rejected — empire "${empireId}" does not own planet "${planetId}"`);
          rejectAction(empireId, 'You do not own this planet.');
          continue;
        }

        const empire = state.gameState.empires.find(e => e.id === empireId);
        const currentAge = empire?.currentAge ?? 'nano_atomic';

        const upgradeCheck = canUpgradeBuilding(planet, buildingId, currentAge);
        if (!upgradeCheck.allowed) {
          console.warn(`[game-loop] UpgradeBuilding rejected for building "${buildingId}": ${upgradeCheck.reason}`);
          rejectAction(empireId, `Upgrade rejected: ${upgradeCheck.reason}`);
          continue;
        }

        const building = planet.buildings.find(b => b.id === buildingId)!;
        const upgradeCost = getUpgradeCost(building.type, building.level);

        // Check affordability first (all resources must be available)
        const res = getEmpireResources(state, empireId);
        let canAfford = true;
        for (const [key, amount] of Object.entries(upgradeCost)) {
          if (amount && amount > 0) {
            if ((res[key as keyof EmpireResources] ?? 0) < amount) {
              console.warn(`[game-loop] UpgradeBuilding rejected — cannot afford ${key}: need ${amount}, have ${res[key as keyof EmpireResources]}`);
              rejectAction(empireId, `Cannot afford upgrade: need ${amount} ${key}.`);
              canAfford = false;
              break;
            }
          }
        }
        if (!canAfford) continue;

        // Deduct costs
        for (const [key, amount] of Object.entries(upgradeCost)) {
          if (amount && amount > 0) {
            res[key as keyof EmpireResources] -= amount;
          }
        }
        state = applyResources(state, empireId, res);
        systems = state.gameState.galaxy.systems;

        // Queue the upgrade
        const updatedSystem = systems.find(s => s.id === systemId)!;
        const updatedPlanet2 = updatedSystem.planets.find(p => p.id === planetId)!;
        const planetWithUpgrade = addUpgradeToQueue(updatedPlanet2, buildingId, currentAge);
        systems = replacePlanet(systems, planetWithUpgrade);

      // ── SetGameSpeed ─────────────────────────────────────────────────────
      } else if (action.type === 'SetGameSpeed') {
        gameSpeed = action.speed;

      // ── ProposeDemand ──────────────────────────────────────────────────
      } else if (action.type === 'propose_demand') {
        const { empireId: demandEmpireId, targetEmpireId, demandType, threat, resourceType, amount, systemId: demandSystemId, techId } = action;
        if (!state.demandState) continue;

        const demandTick = state.gameState.currentTick;
        const demandId = `demand_${demandEmpireId}_${targetEmpireId}_${demandTick}`;
        const demandEmpire = state.gameState.empires.find(e => e.id === demandEmpireId);
        const demandEmpereName = demandEmpire?.name ?? demandEmpireId;

        const demand: Demand = {
          id: demandId, proposerId: demandEmpireId, targetId: targetEmpireId,
          createdTick: demandTick, deadline: demandTick + DEMAND_DEADLINE_TICKS,
          status: 'pending', demandType, threat,
          resourceType, amount, systemId: demandSystemId, techId,
          description: `${demandEmpereName} demands ${demandType}`,
        };

        state = { ...state, demandState: createDemand(state.demandState, demand) };

        // Psychology: threat event for the target
        if (state.psychStateMap) {
          recordDiplomaticEvent(state.psychStateMap, demandEmpireId, targetEmpireId, 'threat', demandTick);
        }

        const targetEmpire = state.gameState.empires.find(e => e.id === targetEmpireId);
        if (targetEmpire?.isAI) {
          // AI evaluates immediately using psychology
          const psychMap = state.psychStateMap;
          const targetPsych = psychMap?.get(targetEmpireId);
          const rel = targetPsych?.relationships[demandEmpireId];

          let accepted = false;
          if (rel) {
            const result = evaluateDemandAI(demand, rel.fear, rel.warmth, rel.trust, rel.respect);
            accepted = result.accept;
          }

          if (accepted) {
            const { state: updatedDemands } = acceptDemand(state.demandState!, demandId);
            state = { ...state, demandState: updatedDemands };
            // Transfer the demanded asset
            state = transferDemandedAsset(state, demand);
          } else {
            // AI rejects — create grievance
            const { state: updatedDemands } = rejectDemand(state.demandState!, demandId);
            state = { ...state, demandState: updatedDemands };
            // Grievance for the demander
            if (state.psychStateMap) {
              recordDiplomaticEvent(state.psychStateMap, targetEmpireId, demandEmpireId, 'request_denied', demandTick);
            }
          }
        } else {
          // Human player target — create notification with species voice
          const targetEmpireName = targetEmpire?.name ?? targetEmpireId;
          const demandVoice = getDiplomaticVoice(
            demandEmpire?.species?.id ?? '', 'demand',
            { name: demandEmpereName, target: targetEmpireName },
          );
          rejectionNotifications.push(
            createNotification(
              'diplomatic_demand',
              demandVoice.title,
              demandVoice.body,
              tick,
              [
                { id: `accept_demand_${demandId}`, label: 'Comply', description: 'Accept the demand' },
                { id: `reject_demand_${demandId}`, label: 'Refuse', description: 'Reject the demand' },
              ],
            ),
          );
        }

      // ── AcceptDemand ───────────────────────────────────────────────────
      } else if (action.type === 'accept_demand') {
        const { demandId } = action;
        if (!state.demandState) continue;
        const { state: updatedDemands, demand } = acceptDemand(state.demandState, demandId);
        if (!demand) continue;
        state = { ...state, demandState: updatedDemands };
        state = transferDemandedAsset(state, demand);
        // Psychology: dependency increase
        if (state.psychStateMap) {
          recordDiplomaticEvent(state.psychStateMap, demand.targetId, demand.proposerId, 'gift_received', state.gameState.currentTick);
        }

      // ── RejectDemand ───────────────────────────────────────────────────
      } else if (action.type === 'reject_demand') {
        const { demandId } = action;
        if (!state.demandState) continue;
        const { state: updatedDemands, demand } = rejectDemand(state.demandState, demandId);
        if (!demand) continue;
        state = { ...state, demandState: updatedDemands };
        // Psychology: request_denied
        if (state.psychStateMap) {
          recordDiplomaticEvent(state.psychStateMap, demand.targetId, demand.proposerId, 'request_denied', state.gameState.currentTick);
        }
        // Attitude penalty
        if (state.diplomacyState) {
          state = { ...state, diplomacyState: modifyAttitude(state.diplomacyState, demand.proposerId, demand.targetId, -10, 'demand_rejected', state.gameState.currentTick) };
        }

      // ── DeclareEmbargo ──────────────────────────────────────────────────
      } else if (action.type === 'declare_embargo') {
        const { targetEmpireId, reason } = action;
        if (state.embargoState) {
          state = { ...state, embargoState: declareEmbargo(state.embargoState, empireId, targetEmpireId, tick, reason ?? 'Diplomatic embargo') };

          // Cancel trade routes between the two empires.
          // BasicTradeRoute lacks a partnerEmpireId so resolve via destination
          // system ownership.
          state = {
            ...state,
            tradeRoutes: state.tradeRoutes.filter(route => {
              const destSystem = systems.find(sys => sys.id === route.destinationSystemId);
              if (!destSystem) return true;
              const destOwner = destSystem.planets.find(p => p.ownerId && p.ownerId !== route.empireId)?.ownerId;
              if (!destOwner) return true;
              // Remove routes in both directions between the two empires
              return !(
                (route.empireId === empireId && destOwner === targetEmpireId) ||
                (route.empireId === targetEmpireId && destOwner === empireId)
              );
            }),
          };

          // Psychology: insult event
          if (state.psychStateMap) {
            recordDiplomaticEvent(state.psychStateMap, empireId, targetEmpireId, 'insult', tick);
          }
          // Attitude penalty
          if (state.diplomacyState) {
            state = { ...state, diplomacyState: modifyAttitude(state.diplomacyState, empireId, targetEmpireId, -10, 'embargo_declared', tick) };
          }
          // Reputation hit for initiator
          if (state.reputationState) {
            state = { ...state, reputationState: recordReputationEvent(state.reputationState, {
              tick, empireId, type: 'treaty_broken', value: -3, description: 'Declared trade embargo',
            })};
          }
        }

      // ── LiftEmbargo ───────────────────────────────────────────────────
      } else if (action.type === 'lift_embargo') {
        const { targetEmpireId } = action;
        if (state.embargoState) {
          state = { ...state, embargoState: liftEmbargo(state.embargoState, empireId, targetEmpireId) };
          // Small attitude boost
          if (state.diplomacyState) {
            state = { ...state, diplomacyState: modifyAttitude(state.diplomacyState, empireId, targetEmpireId, 5, 'embargo_lifted', tick) };
          }
        }

      } else {
        // Action type recognised but not handled yet — log and continue.
        console.warn(`[game-loop] Unhandled action type "${(action as GameAction).type}" — skipping`);
      }
    } catch (err) {
      // Defensive: an invalid action must not crash the game loop.
      console.error(`[game-loop] Error processing action "${(action as GameAction).type}" for empire "${empireId}":`, err);
    }
  }

  // Merge rejection notifications into existing notifications
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- notifications is a dynamic property
  const existingNotifications = [...((state as any).notifications ?? [])] as ReturnType<typeof createNotification>[];
  const mergedNotifications = [...existingNotifications, ...rejectionNotifications];

  return {
    ...state,
    pendingActions: [],
    notifications: mergedNotifications,
    gameState: {
      ...state.gameState,
      speed: gameSpeed,
      empires,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  } as GameTickState;
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
  let empires = [...state.gameState.empires];
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

      // Add the arrived system AND its 1-hop wormhole neighbours to the
      // empire's known systems (fog of war reveal). This matches the game-init
      // pattern where home system + neighbours are revealed at start.
      const empireForDiscovery = empires.find(e => e.id === fleet.empireId);
      if (empireForDiscovery) {
        const arrivedSystem = state.gameState.galaxy.systems.find(s => s.id === arrivedSystemId);
        const neighbourIds = arrivedSystem?.wormholes ?? [];
        const systemsToReveal = [arrivedSystemId, ...neighbourIds];
        const newlyRevealed = systemsToReveal.filter(
          sId => !empireForDiscovery.knownSystems.includes(sId),
        );
        if (newlyRevealed.length > 0) {
          empires = empires.map(e =>
            e.id === fleet.empireId
              ? { ...e, knownSystems: [...e.knownSystems, ...newlyRevealed] }
              : e,
          );
        }
      }

      // First contact: establish diplomatic relations with empires present in this system
      const arrivedSystem = state.gameState.galaxy.systems.find(s => s.id === arrivedSystemId);
      if (arrivedSystem) {
        const foreignEmpireIds = new Set<string>();
        // Check planet owners
        for (const p of arrivedSystem.planets) {
          if (p.ownerId && p.ownerId !== fleet.empireId) foreignEmpireIds.add(p.ownerId);
        }
        // Check fleet owners
        for (const f of fleets) {
          if (f.position.systemId === arrivedSystemId && f.empireId !== fleet.empireId) {
            foreignEmpireIds.add(f.empireId);
          }
        }
        // Establish first contact for any new encounters
        let dipState: DiplomacyState | undefined = state.diplomacyState;
        if (dipState) {
          for (const foreignId of foreignEmpireIds) {
            const rel = getRelation(dipState, fleet.empireId, foreignId);
            // First contact: either no relation exists yet (null) or relation
            // exists but firstContact hasn't been recorded (-1).
            if (!rel || rel.firstContact === -1) {
              dipState = makeFirstContact(dipState, fleet.empireId, foreignId, tick);
              (state as { diplomacyState: DiplomacyState }).diplomacyState = dipState;

              // Emit first contact events for both sides
              events.push({
                type: 'FirstContact',
                tick,
                empireId: fleet.empireId,
                foreignEmpireId: foreignId,
                systemId: arrivedSystemId,
              });
              events.push({
                type: 'FirstContact',
                tick,
                empireId: foreignId,
                foreignEmpireId: fleet.empireId,
                systemId: arrivedSystemId,
              });

              // Create psychology relationships for both empires
              const psychMap = state.psychStateMap;
              const ourPsych = psychMap?.get(fleet.empireId);
              const theirPsych = psychMap?.get(foreignId);
              if (ourPsych && theirPsych) {
                if (!ourPsych.relationships[foreignId]) {
                  ourPsych.relationships[foreignId] = createRelationship(
                    foreignId, ourPsych.personality, theirPsych.personality, AFFINITY_MATRIX, tick,
                  );
                }
                if (!theirPsych.relationships[fleet.empireId]) {
                  theirPsych.relationships[fleet.empireId] = createRelationship(
                    fleet.empireId, theirPsych.personality, ourPsych.personality, AFFINITY_MATRIX, tick,
                  );
                }
              }

              // Apply reputation-based first contact attitude bonus
              if (state.reputationState) {
                const discoveredRep = state.reputationState.scores[foreignId] ?? 0;
                const ourRep = state.reputationState.scores[fleet.empireId] ?? 0;

                // Each empire's first impression is coloured by the other's galactic reputation
                const foreignRepBonus = getReputationModifier(discoveredRep).firstContactBonus;
                const ourRepBonus = getReputationModifier(ourRep).firstContactBonus;

                if (foreignRepBonus !== 0) {
                  // We've heard of them — adjust our attitude
                  dipState = modifyAttitude(
                    dipState, fleet.empireId, foreignId, foreignRepBonus, 'reputation_first_contact', tick
                  );
                  (state as { diplomacyState: DiplomacyState }).diplomacyState = dipState;
                }
                if (ourRepBonus !== 0) {
                  // They've heard of us — adjust their attitude
                  dipState = modifyAttitude(
                    dipState, foreignId, fleet.empireId, ourRepBonus, 'reputation_first_contact', tick
                  );
                  (state as { diplomacyState: DiplomacyState }).diplomacyState = dipState;
                }
              }
            }
          }
        }
      }

      // Border violation: non-allied fleet arriving in a system owned by another empire.
      // Only fires if NOT at war (war has its own consequences) and NOT allied.
      // Only fires on arrival (just entered this system), not every tick.
      const borderDipState = state.diplomacyState;
      const borderPsychMap = state.psychStateMap;
      if (borderDipState && borderPsychMap) {
        const systemOwnerIds = new Set<string>();
        for (const p of arrivedSystem?.planets ?? []) {
          if (p.ownerId && p.ownerId !== fleet.empireId) systemOwnerIds.add(p.ownerId);
        }
        for (const ownerId of systemOwnerIds) {
          const dipRel = getRelation(borderDipState, fleet.empireId, ownerId);
          if (!dipRel) continue;
          // Skip if at war or allied — war has combat, allies have permission
          if (dipRel.status === 'at_war' || dipRel.status === 'allied') continue;
          recordDiplomaticEvent(borderPsychMap, ownerId, fleet.empireId, 'border_violation', tick);
          if (state.reputationState) {
            state = { ...state, reputationState: recordReputationEvent(state.reputationState, {
              tick, empireId: fleet.empireId, type: 'treaty_broken', value: -2,
              description: 'Fleet entered foreign territory without permission',
            })};
          }
        }
      }

      // Check if there are enemy fleets in the arrived system
      const empireId = fleet.empireId;
      const combatDiplomacyState: DiplomacyState | undefined = state.diplomacyState;
      const enemyFleetsInSystem = fleets.filter(
        f =>
          f.id !== fleet.id &&
          f.position.systemId === arrivedSystemId &&
          f.empireId !== empireId,
      );

      for (const enemyFleet of enemyFleetsInSystem) {
        // Only trigger combat if the two empires are at war
        if (combatDiplomacyState) {
          const rel = getRelation(combatDiplomacyState, empireId, enemyFleet.empireId);
          if (!rel || rel.status !== 'at_war') continue;
        }

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
    } else if (result.arrivedAtSystem !== null) {
      // Movement order completed — check if fleet has queued waypoints
      const arrivedFleet = fleets.find(f => f.id === order.fleetId);
      if (arrivedFleet && arrivedFleet.waypoints.length > 0) {
        const arrivedId = result.arrivedAtSystem;

        // Remove the arrived system from the waypoint queue
        const idx = arrivedFleet.waypoints.indexOf(arrivedId);
        const remainingWaypoints = idx !== -1
          ? [...arrivedFleet.waypoints.slice(0, idx), ...arrivedFleet.waypoints.slice(idx + 1)]
          : [...arrivedFleet.waypoints];

        const galaxy = state.gameState.galaxy;
        const empireTechs = empires.find(e => e.id === arrivedFleet.empireId)?.technologies ?? [];

        if (remainingWaypoints.length > 0) {
          // More waypoints to visit — issue movement to the next one
          const nextDest = remainingWaypoints[0]!;
          const nextOrder = issueMovementOrder(arrivedFleet, galaxy, nextDest, undefined, empireTechs);
          if (nextOrder) {
            remainingOrders.push(nextOrder);
          }
          fleets = fleets.map(f =>
            f.id === arrivedFleet.id ? { ...f, waypoints: remainingWaypoints } : f,
          );
        } else if (arrivedFleet.patrolling && arrivedFleet.patrolRoute && arrivedFleet.patrolRoute.length > 0) {
          // Patrol mode: all waypoints consumed — restart the full patrol route
          const fullRoute = [...arrivedFleet.patrolRoute];
          // Find the first waypoint that isn't the current position
          const nextIdx = fullRoute.findIndex(w => w !== arrivedId);
          if (nextIdx !== -1) {
            const nextOrder = issueMovementOrder(arrivedFleet, galaxy, fullRoute[nextIdx]!, undefined, empireTechs);
            if (nextOrder) {
              remainingOrders.push(nextOrder);
            }
          }
          fleets = fleets.map(f =>
            f.id === arrivedFleet.id ? { ...f, waypoints: fullRoute } : f,
          );
        } else {
          // All waypoints consumed, not patrolling — clear waypoints
          fleets = fleets.map(f =>
            f.id === arrivedFleet.id ? { ...f, waypoints: [] } : f,
          );
        }
      }

      // Auto-colonisation: AI fleets with coloniser ships that arrive at
      // systems with uncolonised habitable planets automatically colonise
      const arrivedFleetForColonise = fleets.find(f => f.id === order.fleetId);
      if (arrivedFleetForColonise) {
        const arrEmpire = empires.find(e => e.id === arrivedFleetForColonise.empireId);
        if (arrEmpire?.isAI) {
          const designsMap = state.shipDesigns ?? new Map<string, ShipDesign>();
          const coloniserShip = arrivedFleetForColonise.ships
            .map(sid => ships.find(s => s.id === sid))
            .find(s => {
              if (!s) return false;
              const d = designsMap.get(s.designId);
              return d?.hull.startsWith('coloniser');
            });
          if (coloniserShip) {
            const arrSystem = state.gameState.galaxy.systems.find(
              s => s.id === arrivedFleetForColonise.position.systemId,
            );
            const habitablePlanet = arrSystem?.planets.find(
              p => !p.ownerId && calculateHabitability(p, arrEmpire!.species).score >= 40,
            );
            // Check if foreign fleets on patrol/aggressive stance block colonisation
            const blockingFleet = arrSystem ? fleets.find(f =>
              f.empireId !== arrivedFleetForColonise.empireId &&
              f.position.systemId === arrSystem.id &&
              f.ships.length > 0 &&
              (f.stance === 'patrol' || f.stance === 'aggressive')
            ) : undefined;

            if (habitablePlanet && arrSystem && !blockingFleet) {
              // Colonise: use tech-based founding package
              const aiResearchedTechs = arrEmpire!.technologies ?? [];
              const foundingBuildingTypes = getFoundingBuildings(aiResearchedTechs);
              const foundingPop = getFoundingPopulation(aiResearchedTechs);
              const foundingBuildings = foundingBuildingTypes.map(type => ({
                id: generateId(), type: type as any, level: 1, condition: 100,
              }));
              const updatedPlanet = {
                ...habitablePlanet,
                ownerId: arrivedFleetForColonise.empireId,
                currentPopulation: foundingPop,
                buildings: foundingBuildings,
                productionQueue: [],
              };
              const updatedSystems = state.gameState.galaxy.systems.map(s =>
                s.id === arrSystem.id
                  ? { ...s, ownerId: s.ownerId ?? arrivedFleetForColonise.empireId, planets: s.planets.map(p => p.id === habitablePlanet.id ? updatedPlanet : p) }
                  : s,
              );
              state = {
                ...state,
                gameState: { ...state.gameState, galaxy: { ...state.gameState.galaxy, systems: updatedSystems } },
              };
              // Remove coloniser ship
              ships = ships.filter(s => s.id !== coloniserShip!.id);
              fleets = fleets.map(f =>
                f.id === arrivedFleetForColonise.id
                  ? { ...f, ships: f.ships.filter(sid => sid !== coloniserShip!.id) }
                  : f,
              );
            }
          }
        }
      }
    }
  }

  return {
    ...state,
    movementOrders: remainingOrders,
    pendingCombats: newPendingCombats,
    gameState: {
      ...state.gameState,
      empires,
      fleets,
      ships,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 1b: Ship Repair — ships at friendly systems with spaceports heal
// ---------------------------------------------------------------------------

/** Repair rate per tick: 2% hull, 3% system damage healed per spaceport level. */
const REPAIR_HULL_RATE = 0.02;
const REPAIR_SYSTEM_RATE = 0.03;

function stepShipRepair(state: GameTickState): GameTickState {
  const systems = state.gameState.galaxy.systems;
  let ships = state.gameState.ships;
  let anyChanged = false;

  // Build a map of systemId -> spaceport level for systems with friendly colonies
  const spaceportBySystem = new Map<string, { level: number; ownerId: string }>();
  for (const system of systems) {
    for (const planet of system.planets) {
      if (!planet.ownerId) continue;
      const spaceport = planet.buildings.find(b => b.type === 'spaceport');
      if (spaceport) {
        const existing = spaceportBySystem.get(system.id);
        if (!existing || spaceport.level > existing.level) {
          spaceportBySystem.set(system.id, { level: spaceport.level, ownerId: planet.ownerId });
        }
      }
    }
  }

  if (spaceportBySystem.size === 0) return state;

  // For each fleet, check if it's stationary at a friendly system with a spaceport
  for (const fleet of state.gameState.fleets) {
    // Skip fleets that are actively moving
    if (fleet.destination) continue;

    const port = spaceportBySystem.get(fleet.position.systemId);
    if (!port || port.ownerId !== fleet.empireId) continue;

    const repairMultiplier = port.level;

    for (const shipId of fleet.ships) {
      const ship = ships.find(s => s.id === shipId);
      if (!ship) continue;

      const needsHullRepair = ship.hullPoints < ship.maxHullPoints;
      const needsSystemRepair = ship.systemDamage.engines > 0 ||
        ship.systemDamage.weapons > 0 || ship.systemDamage.shields > 0 ||
        ship.systemDamage.sensors > 0 || ship.systemDamage.warpDrive > 0;

      if (!needsHullRepair && !needsSystemRepair) continue;

      // Repair hull
      const newHull = Math.min(
        ship.maxHullPoints,
        ship.hullPoints + ship.maxHullPoints * REPAIR_HULL_RATE * repairMultiplier,
      );

      // Repair systems
      const repairSystem = (dmg: number) => Math.max(0, dmg - REPAIR_SYSTEM_RATE * repairMultiplier);
      const newSystemDamage: typeof ship.systemDamage = {
        engines: repairSystem(ship.systemDamage.engines),
        weapons: repairSystem(ship.systemDamage.weapons),
        shields: repairSystem(ship.systemDamage.shields),
        sensors: repairSystem(ship.systemDamage.sensors),
        warpDrive: repairSystem(ship.systemDamage.warpDrive),
      };

      if (!anyChanged) {
        ships = [...ships];
        anyChanged = true;
      }
      ships = ships.map(s => s.id === shipId ? {
        ...s,
        hullPoints: newHull,
        systemDamage: newSystemDamage,
      } : s);
    }
  }

  if (!anyChanged) return state;

  return {
    ...state,
    gameState: {
      ...state.gameState,
      ships,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 1b+: Supply Consumption — manned ships in deep space consume supplies
// ---------------------------------------------------------------------------

/**
 * Process supply consumption for all ships each tick.
 *
 * Ships at friendly systems (any planet owned by the fleet's empire) have
 * their supplies and magazine fully replenished. Ships in deep space
 * (no friendly planet in system) consume 1 supply per tick if manned.
 */
function stepSupplyConsumption(state: GameTickState): GameTickState {
  const systems = state.gameState.galaxy.systems;
  let ships = state.gameState.ships;
  let anyChanged = false;

  // Build a map of systemId -> set of empire IDs that own planets there
  const systemOwners = new Map<string, Set<string>>();
  for (const system of systems) {
    for (const planet of system.planets) {
      if (!planet.ownerId) continue;
      let owners = systemOwners.get(system.id);
      if (!owners) {
        owners = new Set();
        systemOwners.set(system.id, owners);
      }
      owners.add(planet.ownerId);
    }
  }

  // Pre-build fleet empire lookup
  const fleetEmpireMap = new Map<string, string>();
  for (const fleet of state.gameState.fleets) {
    fleetEmpireMap.set(fleet.id, fleet.empireId);
  }

  // Look up designs for manned check
  const designMap = state.shipDesigns ?? new Map();

  for (const ship of ships) {
    if (!ship.fleetId) continue;

    const empireId = fleetEmpireMap.get(ship.fleetId);
    if (!empireId) continue;

    // Check if ship design is manned
    const design = designMap.get(ship.designId);
    const hull = design ? HULL_TEMPLATE_BY_CLASS[design.hull] : undefined;
    const isManned = hull ? hull.manned !== false : true;

    if (!isManned) continue;

    // Determine if the ship's system is friendly
    const systemId = ship.position.systemId;
    const owners = systemOwners.get(systemId);
    const isFriendly = owners != null && owners.has(empireId);

    const maxSupplies = ship.maxSupplies ?? hull?.baseSupplyCapacity ?? 15;

    if (isFriendly) {
      // Resupply: reset supplies and magazine
      if (ship.suppliesRemaining !== maxSupplies || (ship.magazineLevel ?? 1.0) < 1.0) {
        if (!anyChanged) { ships = [...ships]; anyChanged = true; }
        ships = ships.map(s => s.id === ship.id ? {
          ...s,
          suppliesRemaining: maxSupplies,
          maxSupplies: maxSupplies,
          magazineLevel: 1.0,
        } : s);
      }
    } else {
      // Deep space: consume 1 supply
      const current = ship.suppliesRemaining ?? maxSupplies;
      const next = current - 1;
      if (!anyChanged) { ships = [...ships]; anyChanged = true; }
      ships = ships.map(s => s.id === ship.id ? {
        ...s,
        suppliesRemaining: next,
        maxSupplies: maxSupplies,
      } : s);
    }
  }

  if (!anyChanged) return state;

  return {
    ...state,
    gameState: {
      ...state.gameState,
      ships,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 1c: Orbital Debris Processing
// ---------------------------------------------------------------------------

/** Hull class debris contribution — larger ships create more debris when destroyed. */
const HULL_CLASS_DEBRIS_SIZE: Record<string, number> = {
  science_probe: 0, spy_probe: 0, drone: 0,
  fighter: 0, bomber: 0, patrol: 1, yacht: 1,
  corvette: 2,
  cargo: 2, transport: 2,
  frigate: 3, destroyer: 3,
  large_transport: 4, large_cargo: 4,
  light_cruiser: 5, heavy_cruiser: 6,
  large_supplier: 4, carrier: 6,
  light_battleship: 7, battleship: 8,
  heavy_battleship: 12, super_carrier: 10,
  battle_station: 10, small_space_station: 8,
  space_station: 14, large_space_station: 20, planet_killer: 25,
  coloniser_gen1: 3, coloniser_gen2: 4, coloniser_gen3: 5,
  coloniser_gen4: 6, coloniser_gen5: 8,
};

/** Natural debris decay rate per tick (0.5%). */
const DEBRIS_DECAY_RATE = 0.005;

/** Enhanced decay rate when a cleanup facility is present (2%). */
const DEBRIS_CLEANUP_DECAY_RATE = 0.02;

/** Minimum density before debris is removed entirely. */
const DEBRIS_CLEANUP_THRESHOLD = 1;

/** Density above which ships take debris damage. */
const DEBRIS_DAMAGE_THRESHOLD = 10;

/** Damage multiplier: damagePerTick = density * this * ship.maxHullPoints */
const DEBRIS_DAMAGE_FACTOR = 0.002;

/** Density above which orbital buildings take condition damage. */
const DEBRIS_BUILDING_DAMAGE_THRESHOLD = 50;

/** Condition damage rate for orbital buildings per tick (fraction). */
const DEBRIS_BUILDING_DAMAGE_RATE = 0.005;

/** Density above which trade routes through the system are disrupted. */
const DEBRIS_TRADE_DISRUPTION_THRESHOLD = 80;

/** Density above which Kessler cascade can occur. */
const DEBRIS_CASCADE_THRESHOLD = 75;

/** Chance per tick of a cascade event at critical density (2%). */
const DEBRIS_CASCADE_CHANCE = 0.02;

/** Density added by a cascade event. */
const DEBRIS_CASCADE_AMOUNT = 10;

/** Maximum debris density. */
const DEBRIS_MAX_DENSITY = 100;

/** Density threshold for debris warning notification. */
const DEBRIS_WARNING_THRESHOLD = 30;

function stepOrbitalDebris(state: GameTickState): GameTickState {
  const tick = state.gameState.currentTick;
  let systems = state.gameState.galaxy.systems;
  let ships = state.gameState.ships;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- notifications is a dynamic property on GameTickState
  let notifications = [...((state as any).notifications ?? [])] as ReturnType<typeof createNotification>[];
  let anySystemChanged = false;
  let anyShipChanged = false;

  // Track which systems have already had notifications emitted this tick
  // to avoid duplicates when density crosses multiple thresholds.
  const notifiedSystems = new Set<string>();

  for (let sysIdx = 0; sysIdx < systems.length; sysIdx++) {
    const system = systems[sysIdx];
    if (!system.debris || system.debris.density <= 0) continue;

    let debris = { ...system.debris, sources: [...system.debris.sources] };

    // ── Decay ──────────────────────────────────────────────────────────────
    // Check if any planet in the system has an orbital_platform (debris cleanup)
    const hasCleanupFacility = system.planets.some(p =>
      p.ownerId !== null && p.buildings.some(b => b.type === 'orbital_platform'),
    );
    const decayRate = hasCleanupFacility ? DEBRIS_CLEANUP_DECAY_RATE : DEBRIS_DECAY_RATE;
    debris.density -= debris.density * decayRate;

    // ── Cascade check ──────────────────────────────────────────────────────
    if (debris.density > DEBRIS_CASCADE_THRESHOLD) {
      // Deterministic-ish RNG from tick + system index
      const cascadeRoll = ((tick * 31 + sysIdx * 17) % 1000) / 1000;
      if (cascadeRoll < DEBRIS_CASCADE_CHANCE) {
        const cascadeAmount = Math.min(DEBRIS_CASCADE_AMOUNT, DEBRIS_MAX_DENSITY - debris.density);
        debris.density += cascadeAmount;
        debris.lastEventTick = tick;
        debris.sources.push({ type: 'breakup', tick, amount: cascadeAmount });

        notifications.push(
          createNotification(
            'debris_cascade',
            `Kessler cascade in ${system.name}`,
            `A Kessler cascade has occurred in ${system.name} — debris is expanding uncontrollably.`,
            tick,
            undefined,
            { systemId: system.id },
          ),
        );
        notifiedSystems.add(system.id);
      }
    }

    // ── Clean up negligible debris ─────────────────────────────────────────
    if (debris.density < DEBRIS_CLEANUP_THRESHOLD) {
      // Remove debris entirely
      if (!anySystemChanged) {
        systems = [...systems];
        anySystemChanged = true;
      }
      systems[sysIdx] = { ...system, debris: undefined };
      continue;
    }

    // Cap at maximum
    debris.density = Math.min(debris.density, DEBRIS_MAX_DENSITY);

    // ── Ship damage ────────────────────────────────────────────────────────
    if (debris.density > DEBRIS_DAMAGE_THRESHOLD) {
      for (const fleet of state.gameState.fleets) {
        if (fleet.position.systemId !== system.id) continue;

        for (const shipId of fleet.ships) {
          const shipIdx = ships.findIndex(s => s.id === shipId);
          if (shipIdx === -1) continue;
          const ship = ships[shipIdx];

          const damage = debris.density * DEBRIS_DAMAGE_FACTOR * ship.maxHullPoints;
          const newHull = Math.max(0, ship.hullPoints - damage);

          if (newHull !== ship.hullPoints) {
            if (!anyShipChanged) {
              ships = [...ships];
              anyShipChanged = true;
            }
            ships[shipIdx] = { ...ship, hullPoints: newHull };
          }
        }
      }
    }

    // ── Orbital building condition damage ──────────────────────────────────
    if (debris.density > DEBRIS_BUILDING_DAMAGE_THRESHOLD) {
      let planetsChanged = false;
      let updatedPlanets = system.planets;

      for (let pIdx = 0; pIdx < updatedPlanets.length; pIdx++) {
        const planet = updatedPlanets[pIdx];
        if (planet.ownerId === null) continue;

        let buildingsChanged = false;
        let updatedBuildings = planet.buildings;

        for (let bIdx = 0; bIdx < updatedBuildings.length; bIdx++) {
          const building = updatedBuildings[bIdx];
          if (building.slotZone !== 'orbital') continue;

          const currentCondition = building.condition ?? 100;
          const newCondition = Math.max(0, currentCondition - DEBRIS_BUILDING_DAMAGE_RATE * 100);

          if (newCondition !== currentCondition) {
            if (!buildingsChanged) {
              updatedBuildings = [...updatedBuildings];
              buildingsChanged = true;
            }
            updatedBuildings[bIdx] = { ...building, condition: newCondition };
          }
        }

        if (buildingsChanged) {
          if (!planetsChanged) {
            updatedPlanets = [...updatedPlanets];
            planetsChanged = true;
          }
          updatedPlanets[pIdx] = { ...planet, buildings: updatedBuildings };
        }
      }

      if (planetsChanged) {
        if (!anySystemChanged) {
          systems = [...systems];
          anySystemChanged = true;
        }
        systems[sysIdx] = { ...system, planets: updatedPlanets, debris };
        continue; // Already updated this system entry
      }
    }

    // ── Notifications ──────────────────────────────────────────────────────
    if (!notifiedSystems.has(system.id)) {
      if (debris.density > DEBRIS_CASCADE_THRESHOLD) {
        notifications.push(
          createNotification(
            'debris_critical',
            `Critical debris density in ${system.name}`,
            `Critical debris density in ${system.name} — Kessler cascade imminent.`,
            tick,
            undefined,
            { systemId: system.id },
          ),
        );
        notifiedSystems.add(system.id);
      } else if (debris.density > DEBRIS_WARNING_THRESHOLD) {
        // Emit every 50 ticks to avoid notification spam
        if (tick % 50 === 0) {
          notifications.push(
            createNotification(
              'debris_warning',
              `Debris warning in ${system.name}`,
              `Debris warning in ${system.name} — orbital hazard increasing.`,
              tick,
              undefined,
              { systemId: system.id },
            ),
          );
        }
      }
    }

    // Update system with new debris state
    if (!anySystemChanged) {
      systems = [...systems];
      anySystemChanged = true;
    }
    systems[sysIdx] = { ...system, debris };
  }

  // ── Trade route disruption ─────────────────────────────────────────────
  // Filter out trade routes that pass through systems with density > 80
  let tradeRoutes = state.tradeRoutes;
  const disruptedSystemIds = new Set<string>();
  for (const system of systems) {
    if (system.debris && system.debris.density > DEBRIS_TRADE_DISRUPTION_THRESHOLD) {
      disruptedSystemIds.add(system.id);
    }
  }
  if (disruptedSystemIds.size > 0) {
    const filteredRoutes = tradeRoutes.filter(route =>
      !disruptedSystemIds.has(route.originSystemId) &&
      !disruptedSystemIds.has(route.destinationSystemId),
    );
    if (filteredRoutes.length !== tradeRoutes.length) {
      tradeRoutes = filteredRoutes;
    }
  }

  if (!anySystemChanged && !anyShipChanged && tradeRoutes === state.tradeRoutes) return state;

  return {
    ...state,
    notifications,
    tradeRoutes,
    gameState: {
      ...state.gameState,
      galaxy: anySystemChanged
        ? { ...state.gameState.galaxy, systems }
        : state.gameState.galaxy,
      ships: anyShipChanged ? ships : state.gameState.ships,
    },
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 2: Combat Resolution
// ---------------------------------------------------------------------------

function stepCombatResolution(
  state: GameTickState,
  events: GameEvent[],
  playerEmpireId?: string,
): GameTickState {
  if (state.pendingCombats.length === 0) return state;

  const tick = state.gameState.currentTick;
  let ships = [...state.gameState.ships];
  let fleets = [...state.gameState.fleets];
  let combatSystems = [...state.gameState.galaxy.systems];
  const designs = state.shipDesigns ?? new Map<string, ShipDesign>();
  const components = state.shipComponents ?? [];
  const deferredCombats: typeof state.pendingCombats = [];
  const capturedPlanets: {
    planetName: string;
    systemId: string;
    winnerEmpireId: string;
    outcome: 'civilian_surrender' | 'clean_capture' | 'pyrrhic_victory' | 'invasion_repelled' | 'orbital_superiority';
  }[] = [];

  for (const combat of state.pendingCombats) {
    const attackerFleet = fleets.find(f => f.id === combat.attackerFleetId);
    const defenderFleet = fleets.find(f => f.id === combat.defenderFleetId);

    if (!attackerFleet || !defenderFleet) {
      console.warn(
        `[game-loop] Combat references missing fleet(s) in system "${combat.systemId}" — skipping`,
      );
      continue;
    }

    // Defer player combats to the tactical scene
    if (playerEmpireId && (attackerFleet.empireId === playerEmpireId || defenderFleet.empireId === playerEmpireId)) {
      deferredCombats.push(combat);
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

    // Compute combat multipliers from species combat trait (1-10, normalised to 0.7-1.3)
    // and government combatBonus (e.g. 1.0, 1.5, 0.85)
    const attackerEmpire = state.gameState.empires.find(e => e.id === attackerFleet.empireId);
    const defenderEmpire = state.gameState.empires.find(e => e.id === defenderFleet.empireId);
    const traitToMult = (trait: number) => 0.7 + (trait / 10) * 0.6; // trait 1 = 0.76, trait 5 = 1.0, trait 10 = 1.3
    const attackerGov = attackerEmpire ? GOVERNMENTS[attackerEmpire.government] : undefined;
    const defenderGov = defenderEmpire ? GOVERNMENTS[defenderEmpire.government] : undefined;
    const attackerMult = traitToMult(attackerEmpire?.species.traits.combat ?? 5) * (attackerGov?.modifiers.combatBonus ?? 1.0);
    const defenderMult = traitToMult(defenderEmpire?.species.traits.combat ?? 5) * (defenderGov?.modifiers.combatBonus ?? 1.0);

    // Apply species ability combat modifiers:
    // energy_form: 20% beam resistance (reduces incoming damage by 0.8x, applied as defence bonus)
    const attackerBeamRes = attackerEmpire ? getSpeciesBeamResistance(attackerEmpire.species) : 1.0;
    const defenderBeamRes = defenderEmpire ? getSpeciesBeamResistance(defenderEmpire.species) : 1.0;
    // Beam resistance effectively reduces the opponent's damage output
    const finalAttackerMult = attackerMult * defenderBeamRes; // defender's resistance reduces attacker effectiveness
    const finalDefenderMult = defenderMult * attackerBeamRes; // attacker's resistance reduces defender effectiveness

    const outcome = autoResolveCombat(setup, components, finalAttackerMult, finalDefenderMult);

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

    // ── Create orbital debris from destroyed ships ─────────────────────────
    if (destroyedIds.size > 0) {
      let debrisAmount = 0;
      for (const destroyedId of destroyedIds) {
        const destroyedShip = [...attackerShips, ...defenderShips].find(s => s.id === destroyedId);
        if (!destroyedShip) continue;
        const design = designs.get(destroyedShip.designId);
        const hullClass = design?.hull ?? 'patrol';
        debrisAmount += (HULL_CLASS_DEBRIS_SIZE[hullClass] ?? 1) * 2;
      }

      if (debrisAmount > 0) {
        const sys = combatSystems.find(s => s.id === combat.systemId);
        if (sys) {
          const existingDebris = sys.debris;
          const newDensity = Math.min(
            DEBRIS_MAX_DENSITY,
            (existingDebris?.density ?? 0) + debrisAmount,
          );
          const newDebris: OrbitalDebris = {
            density: newDensity,
            lastEventTick: tick,
            sources: [
              ...(existingDebris?.sources ?? []),
              { type: 'combat', tick, amount: debrisAmount },
            ],
          };
          combatSystems = combatSystems.map(s =>
            s.id === combat.systemId ? { ...s, debris: newDebris } : s,
          );
        }
      }
    }

    // ── Ground combat / planet capture ──────────────────────────────────────
    // After winning the space battle, determine the fate of each enemy planet
    // based on military buildings and available transport capacity.
    const loserEmpireId = winnerEmpireId === attackerFleet.empireId
      ? defenderFleet.empireId
      : attackerFleet.empireId;
    const loserHasFleets = fleets.some(
      f => f.empireId === loserEmpireId &&
           f.position.systemId === combat.systemId &&
           f.ships.length > 0,
    );
    if (!loserHasFleets) {
      const sys = combatSystems.find(s => s.id === combat.systemId);
      if (sys) {
        // Calculate attacker transport capacity from surviving winner ships
        const winnerFleet = winnerEmpireId === attackerFleet.empireId
          ? attackerFleet : defenderFleet;
        const winnerShipIds = fleets.find(f => f.id === winnerFleet.id)?.ships ?? [];
        const winnerShips = ships.filter(s => winnerShipIds.includes(s.id));
        let attackerTransportStrength = 0;
        for (const s of winnerShips) {
          const design = designs.get(s.designId);
          const hullClass: HullClass = design?.hull ?? 'patrol';
          attackerTransportStrength += TRANSPORT_CAPACITY[hullClass] ?? 0;
        }

        let systemOwnerChanged = false;
        const updatedPlanets = sys.planets.map(p => {
          if (p.ownerId !== loserEmpireId) return p;

          // Ground invasion — population always provides base resistance.
          // Even without military buildings, billions of people don't just
          // surrender to a handful of ships.
          const defenseGridLevel = p.buildings
            .filter(b => b.type === 'defense_grid')
            .reduce((sum, b) => sum + b.level, 0);
          const militaryAcademyLevel = p.buildings
            .filter(b => b.type === 'military_academy')
            .reduce((sum, b) => sum + b.level, 0);

          // Base resistance: 1 per 10M population + military buildings
          const populationResistance = Math.ceil(p.currentPopulation / 10_000_000);
          const militaryDefence = (50 * defenseGridLevel) + (30 * militaryAcademyLevel);
          const defenderStrength = populationResistance + militaryDefence;

          if (attackerTransportStrength <= 0) {
            // Orbital superiority — no ground troops to land
            capturedPlanets.push({
              planetName: p.name,
              systemId: combat.systemId,
              winnerEmpireId,
              outcome: 'orbital_superiority',
            });
            systemOwnerChanged = true;
            return p;
          } else if (attackerTransportStrength > defenderStrength * 1.5) {
            // Clean capture — overwhelming force
            capturedPlanets.push({
              planetName: p.name,
              systemId: combat.systemId,
              winnerEmpireId,
              outcome: 'clean_capture',
            });
            systemOwnerChanged = true;
            return {
              ...p,
              ownerId: winnerEmpireId,
              currentPopulation: Math.floor(p.currentPopulation * 0.75),
              productionQueue: [],
            };
          } else if (attackerTransportStrength > defenderStrength) {
            // Pyrrhic victory — costly ground war
            capturedPlanets.push({
              planetName: p.name,
              systemId: combat.systemId,
              winnerEmpireId,
              outcome: 'pyrrhic_victory',
            });
            systemOwnerChanged = true;
            return {
              ...p,
              ownerId: winnerEmpireId,
              currentPopulation: Math.floor(p.currentPopulation * 0.25),
              productionQueue: [],
            };
          } else {
            // Invasion repelled — defender holds
            capturedPlanets.push({
              planetName: p.name,
              systemId: combat.systemId,
              winnerEmpireId,
              outcome: 'invasion_repelled',
            });
            return p;
          }
        });

        // Update system: if any planet changed hands or orbital superiority,
        // set system.ownerId to winner
        const updatedSys = systemOwnerChanged
          ? { ...sys, ownerId: winnerEmpireId, planets: updatedPlanets }
          : { ...sys, planets: updatedPlanets };
        combatSystems = combatSystems.map(s => s.id === sys.id ? updatedSys : s);
      }
    }
  }

  // Remove empty fleets
  fleets = fleets.filter(f => f.ships.length > 0);

  // Emit notifications for planet capture outcomes
  let notifications = [...(((state as unknown as Record<string, unknown>).notifications ?? []) as ReturnType<typeof createNotification>[])];

  for (const capture of capturedPlanets) {
    switch (capture.outcome) {
      case 'civilian_surrender':
        notifications.push(
          createNotification(
            'planet_captured',
            `${capture.planetName} surrendered!`,
            `The civilian population of ${capture.planetName} has surrendered without resistance.`,
            tick,
            undefined,
            { systemId: capture.systemId },
          ),
        );
        break;
      case 'clean_capture':
        notifications.push(
          createNotification(
            'planet_captured',
            `${capture.planetName} captured!`,
            `Your ground forces overwhelmed the defenders of ${capture.planetName} in a decisive assault.`,
            tick,
            undefined,
            { systemId: capture.systemId },
          ),
        );
        break;
      case 'pyrrhic_victory':
        notifications.push(
          createNotification(
            'planet_captured',
            `${capture.planetName} captured (heavy losses)`,
            `${capture.planetName} has fallen after brutal ground combat. The population suffered catastrophic losses.`,
            tick,
            undefined,
            { systemId: capture.systemId },
          ),
        );
        break;
      case 'invasion_repelled':
        notifications.push(
          createNotification(
            'invasion_repelled',
            `Invasion of ${capture.planetName} repelled!`,
            `The ground defences of ${capture.planetName} held firm — your invasion force was driven back.`,
            tick,
            undefined,
            { systemId: capture.systemId },
          ),
        );
        break;
      case 'orbital_superiority':
        notifications.push(
          createNotification(
            'orbital_superiority',
            `Orbital superiority over ${capture.planetName}`,
            `You control the skies above ${capture.planetName} but lack transports to invade the fortified surface.`,
            tick,
            undefined,
            { systemId: capture.systemId },
          ),
        );
        break;
    }
  }

  return {
    ...state,
    pendingCombats: deferredCombats,
    notifications,
    gameState: {
      ...state.gameState,
      fleets,
      ships,
      galaxy: { ...state.gameState.galaxy, systems: combatSystems },
    },
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 2b: Unopposed Occupation
// ---------------------------------------------------------------------------
// When a fleet is in a system with enemy planets but NO enemy fleet, the
// planets are captured without a space battle.  This handles the common case
// of an invading fleet arriving after the defender's fleet has been destroyed
// elsewhere, or colonised systems that were never defended.
//
// Uses the same capture logic as post-combat (civilian surrender vs ground
// invasion) but without requiring a CombatPending trigger.

function stepUnopposedOccupation(state: GameTickState, events: GameEvent[]): GameTickState {
  const tick = state.gameState.currentTick;
  let systems = state.gameState.galaxy.systems;
  const fleets = state.gameState.fleets;
  const ships = state.gameState.ships ?? [];
  // shipDesigns is already a Map<string, ShipDesign> on the state
  const designs = ((state as any).shipDesigns ?? new Map()) as Map<string, { id: string; hull: HullClass }>;
  let notifications = [...(((state as unknown as Record<string, unknown>).notifications ?? []) as ReturnType<typeof createNotification>[])];

  // Check diplomacy state — only capture planets of empires we're at war with
  const dipState: DiplomacyState | undefined = state.diplomacyState;

  for (const system of systems) {
    // Find all empires that have fleets in this system
    const fleetsInSystem = fleets.filter(f =>
      f.position.systemId === system.id && f.ships.length > 0
    );
    if (fleetsInSystem.length === 0) continue;

    // Find planets owned by someone other than the fleet owners
    const fleetEmpireIds = new Set(fleetsInSystem.map(f => f.empireId));

    for (const fleetEmpireId of fleetEmpireIds) {
      const enemyPlanets = system.planets.filter(p =>
        p.ownerId !== null &&
        p.ownerId !== fleetEmpireId &&
        p.currentPopulation > 0
      );
      if (enemyPlanets.length === 0) continue;

      // Check that no enemy fleet is present (otherwise combat handles it)
      for (const enemyPlanet of enemyPlanets) {
        const enemyEmpireId = enemyPlanet.ownerId!;
        const enemyFleetsPresent = fleetsInSystem.some(f =>
          f.empireId === enemyEmpireId && f.ships.length > 0
        );
        if (enemyFleetsPresent) continue;

        // Must be at war to capture (or the planet must be unclaimed)
        if (dipState) {
          const rel = getRelation(dipState, fleetEmpireId, enemyEmpireId);
          if (rel && rel.status !== 'at_war') continue;
          if (!rel) continue; // no relation = no authority to capture
        }

        // Calculate transport strength of our fleets in this system
        const ourFleets = fleetsInSystem.filter(f => f.empireId === fleetEmpireId);
        let transportStrength = 0;
        for (const fleet of ourFleets) {
          const fleetShips = ships.filter(s => fleet.ships.includes(s.id));
          for (const s of fleetShips) {
            const design = designs.get(s.designId);
            const hullClass: HullClass = design?.hull ?? 'patrol';
            transportStrength += TRANSPORT_CAPACITY[hullClass] ?? 0;
          }
        }

        // Apply capture logic — population always provides base resistance.
        // A planet of billions cannot be captured in a single tick by a
        // small fleet.  Defence buildings multiply the resistance further.
        const defenseGridLevel = enemyPlanet.buildings
          .filter(b => b.type === 'defense_grid')
          .reduce((sum, b) => sum + b.level, 0);
        const militaryAcademyLevel = enemyPlanet.buildings
          .filter(b => b.type === 'military_academy')
          .reduce((sum, b) => sum + b.level, 0);

        // Base resistance from population: 1 per 10M people (same scale as food).
        // Even civilians resist occupation — guerrillas, infrastructure sabotage,
        // non-cooperation.  Military buildings add professional defence on top.
        const populationResistance = Math.ceil(enemyPlanet.currentPopulation / 10_000_000);
        const militaryDefence = (50 * defenseGridLevel) + (30 * militaryAcademyLevel);
        const defenderStrength = populationResistance + militaryDefence;

        let updatedPlanet = enemyPlanet;
        let captured = false;

        if (transportStrength <= 0) {
          // Orbital superiority only — can't land troops, just blockade
          continue;
        } else if (transportStrength > defenderStrength * 1.5) {
          // Overwhelming force — clean capture
          updatedPlanet = {
            ...enemyPlanet,
            ownerId: fleetEmpireId,
            currentPopulation: Math.floor(enemyPlanet.currentPopulation * 0.75),
            productionQueue: [],
          };
          captured = true;
          notifications.push(createNotification(
            'planet_captured', `${enemyPlanet.name} captured!`,
            `Your ground forces overwhelmed the defenders of ${enemyPlanet.name}.`,
            tick, undefined, { systemId: system.id },
          ));
        } else if (transportStrength > defenderStrength) {
          // Pyrrhic victory — costly ground war
          updatedPlanet = {
            ...enemyPlanet,
            ownerId: fleetEmpireId,
            currentPopulation: Math.floor(enemyPlanet.currentPopulation * 0.25),
            productionQueue: [],
          };
          captured = true;
          notifications.push(createNotification(
            'planet_captured', `${enemyPlanet.name} captured (heavy losses)`,
            `${enemyPlanet.name} has fallen after brutal ground combat.`,
            tick, undefined, { systemId: system.id },
          ));
        }
        // else: invasion repelled — fleet doesn't have enough troops

        if (captured) {
          systems = systems.map(s =>
            s.id === system.id
              ? { ...s, ownerId: fleetEmpireId, planets: s.planets.map(p => p.id === enemyPlanet.id ? updatedPlanet : p) }
              : s
          );
        }
      }
    }
  }

  return {
    ...state,
    notifications,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  } as GameTickState;
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
      // Food availability gates population growth — see calculatePopulationGrowth
      // for the graduated scale (abundant → adequate → scarce → depleted).
      const empireRes = getEmpireResources(state, empire.id);
      const empireStarving = empireRes.organics <= 0;
      let growth = calculatePopulationGrowth(planet, empire.species, habitability.score, empireStarving, empireRes.organics);

      if (growth <= 0) continue;

      // Apply happiness growth bonus: high-happiness planets grow faster.
      const empireResources = getEmpireResources(state, empire.id);
      const isAtWar = empireIsAtWar(empire);
      const warStateMap = ((state as unknown as Record<string, unknown>).warStateMap ?? new Map()) as Map<string, EmpireWarState>;
      const warState = warStateMap.get(empire.id);
      const happiness = calculatePlanetHappiness(planet, empireResources, isAtWar, empire.species, warState, empire.government, state.gameState.currentTick);

      if (happiness.growthModifier !== 0) {
        growth = Math.floor(growth * (1 + happiness.growthModifier));
        if (growth <= 0) growth = 1;
      }

      // Apply government population growth multiplier.
      // Guarantee at least 1 growth per tick so low-reproduction species can still expand.
      const govGrowthMult = GOVERNMENTS[empire.government]?.modifiers.populationGrowth ?? 1.0;
      if (govGrowthMult !== 1.0) {
        growth = Math.floor(growth * govGrowthMult);
      }
      if (growth <= 0 && planet.currentPopulation < getEffectiveMaxPopulation(planet)) {
        growth = 1;
      }

      const effectiveMax = getEffectiveMaxPopulation(planet);
      const newPop = Math.min(planet.currentPopulation + growth, effectiveMax);
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

    // Emit wave events based on what happened this tick.
    if (waveEvents.length > 0) {
      const sourceBefore = system.planets.find(p => p.id === order.sourcePlanetId);
      const sourceAfter = updatedSystem.planets.find(p => p.id === order.sourcePlanetId);
      const targetBefore = system.planets.find(p => p.id === order.targetPlanetId);
      const targetAfter = updatedSystem.planets.find(p => p.id === order.targetPlanetId);

      const departed = (sourceBefore && sourceAfter)
        ? sourceBefore.currentPopulation - sourceAfter.currentPopulation : 0;
      const arrived = (targetBefore && targetAfter)
        ? targetAfter.currentPopulation - targetBefore.currentPopulation : 0;
      // Transit losses are the difference between departed and what entered transit
      const inTransitThisTick = (updatedOrder.transitWaves ?? [])
        .filter(w => w.ticksRemaining === TRANSIT_DURATION).reduce((s, w) => s + w.population, 0);
      const lost = departed > 0 ? departed - inTransitThisTick : 0;

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
// ---------------------------------------------------------------------------
// Step 3c-pre: War State Processing
// ---------------------------------------------------------------------------

function stepWarState(state: GameTickState): GameTickState {
  const warStateMap = ((state as unknown as Record<string, unknown>).warStateMap ?? new Map()) as Map<string, EmpireWarState>;
  const updatedMap = new Map(warStateMap);
  let notifications = [...(((state as unknown as Record<string, unknown>).notifications ?? []) as ReturnType<typeof createNotification>[])];
  let systems = state.gameState.galaxy.systems;

  // Track active weariness effects (strike/protest happiness penalties)
  let wearinessEffects = ((state as unknown as Record<string, unknown>).wearinessEffects ?? []) as WearinessEffect[];
  // Decay expired effects
  wearinessEffects = wearinessEffects.filter(e => state.gameState.currentTick < e.expiryTick);

  for (const empire of state.gameState.empires) {
    const isAtWar = empire.diplomacy.some(r => r.status === 'at_war');
    let ws = updatedMap.get(empire.id) ?? createEmpireWarState();
    ws = tickWarState(ws, isAtWar, empire.species, state.gameState.currentTick);
    updatedMap.set(empire.id, ws);

    // Only generate unrest events when at war
    if (!isAtWar) continue;

    // Gather empire's planet and fleet IDs for event targeting
    const planetIds: string[] = [];
    for (const system of state.gameState.galaxy.systems) {
      for (const planet of system.planets) {
        if (planet.ownerId === empire.id) planetIds.push(planet.id);
      }
    }
    const fleetIds = state.gameState.fleets
      .filter(f => f.empireId === empire.id)
      .map(f => f.id);

    const events = checkWarWearinessEvents(
      ws, empire.id, state.gameState.currentTick, planetIds, fleetIds,
    );

    for (const evt of events) {
      // AI empires: apply effects silently (no notifications)
      // Player empires: create notifications and apply effects
      if (!empire.isAI) {
        switch (evt.type) {
          case 'desertion':
            notifications.push(createNotification(
              'war_desertion',
              'Crews deserting',
              evt.description,
              state.gameState.currentTick,
              undefined,
              { empireId: empire.id },
            ));
            break;

          case 'production_strike':
            notifications.push(createNotification(
              'war_strike',
              'Production strike',
              evt.description,
              state.gameState.currentTick,
              undefined,
              { empireId: empire.id, planetId: evt.targetId ?? '' },
            ));
            break;

          case 'mass_protest':
            notifications.push(createNotification(
              'war_mass_protest',
              'Mass anti-war protests',
              evt.description,
              state.gameState.currentTick,
              undefined,
              { empireId: empire.id },
            ));
            break;

          case 'mutiny':
            notifications.push(createNotification(
              'war_mutiny',
              'Fleet mutiny!',
              evt.description,
              state.gameState.currentTick,
              undefined,
              { empireId: empire.id, fleetId: evt.targetId ?? '' },
            ));
            break;
        }
      }

      // Apply mechanical effects for all empires (AI and player alike)
      switch (evt.type) {
        case 'desertion': {
          // Remove random small ships from empire fleets
          const shipsToRemove = evt.shipsLost ?? 1;
          let removed = 0;
          const allShips = [...state.gameState.ships];
          const empireShipIds = new Set<string>();
          for (const fleet of state.gameState.fleets) {
            if (fleet.empireId === empire.id) {
              for (const sid of fleet.ships) empireShipIds.add(sid);
            }
          }
          // Sort by hull points ascending (remove smallest ships first)
          const candidateShips = allShips
            .filter(s => empireShipIds.has(s.id))
            .sort((a, b) => a.hullPoints - b.hullPoints);
          const removedShipIds = new Set<string>();
          for (const ship of candidateShips) {
            if (removed >= shipsToRemove) break;
            removedShipIds.add(ship.id);
            removed++;
          }
          if (removedShipIds.size > 0) {
            const newShips = state.gameState.ships.filter(s => !removedShipIds.has(s.id));
            const newFleets = state.gameState.fleets.map(f => {
              if (f.empireId !== empire.id) return f;
              const filteredShips = f.ships.filter(sid => !removedShipIds.has(sid));
              return { ...f, ships: filteredShips };
            }).filter(f => f.ships.length > 0);
            state = {
              ...state,
              gameState: {
                ...state.gameState,
                ships: newShips,
                fleets: newFleets,
              },
            };
          }
          break;
        }

        case 'production_strike': {
          // Track a temporary happiness penalty on the target planet
          if (evt.targetId && evt.duration && evt.happinessPenalty) {
            wearinessEffects.push({
              type: 'strike',
              empireId: empire.id,
              planetId: evt.targetId,
              happinessPenalty: evt.happinessPenalty,
              expiryTick: state.gameState.currentTick + evt.duration,
            });
          }
          break;
        }

        case 'mass_protest': {
          // Track a temporary happiness penalty on ALL empire planets
          if (evt.duration && evt.happinessPenalty) {
            for (const pid of planetIds) {
              wearinessEffects.push({
                type: 'protest',
                empireId: empire.id,
                planetId: pid,
                happinessPenalty: evt.happinessPenalty,
                expiryTick: state.gameState.currentTick + evt.duration,
              });
            }
          }
          break;
        }

        case 'mutiny': {
          // Track a mutiny flag on the target fleet
          if (evt.targetId && evt.duration) {
            wearinessEffects.push({
              type: 'mutiny',
              empireId: empire.id,
              fleetId: evt.targetId,
              happinessPenalty: 0,
              expiryTick: state.gameState.currentTick + evt.duration,
            });
          }
          break;
        }
      }
    }
  }

  return {
    ...state,
    warStateMap: updatedMap,
    notifications,
    wearinessEffects,
  } as GameTickState;
}

/**
 * A temporary effect from war weariness unrest.
 * Stored on GameTickState and pruned each tick.
 */
interface WearinessEffect {
  type: 'strike' | 'protest' | 'mutiny';
  empireId: string;
  /** Affected planet (for strikes and protests). */
  planetId?: string;
  /** Affected fleet (for mutinies). */
  fleetId?: string;
  /** Happiness penalty to apply (0 for mutinies). */
  happinessPenalty: number;
  /** Tick at which this effect expires. */
  expiryTick: number;
}

function stepHappiness(state: GameTickState): GameTickState {
  let systems = state.gameState.galaxy.systems;

  for (const system of state.gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === null || planet.currentPopulation <= 0) continue;

      const empire = state.gameState.empires.find(e => e.id === planet.ownerId);
      if (!empire) continue;

      const empireResources = getEmpireResources(state, empire.id);
      const isAtWar = empireIsAtWar(empire);
      const wsMap = ((state as unknown as Record<string, unknown>).warStateMap ?? new Map()) as Map<string, EmpireWarState>;
      const happinessBase = calculatePlanetHappiness(planet, empireResources, isAtWar, empire.species, wsMap.get(empire.id), empire.government, state.gameState.currentTick);

      // Apply government flat happiness modifier.
      const govHappiness = GOVERNMENTS[empire.government]?.modifiers.happiness ?? 0;

      // Apply war weariness unrest penalties (strikes and protests)
      const wEffects = ((state as unknown as Record<string, unknown>).wearinessEffects ?? []) as WearinessEffect[];
      let wearinessPenalty = 0;
      for (const eff of wEffects) {
        if ((eff.type === 'strike' || eff.type === 'protest') && eff.planetId === planet.id) {
          wearinessPenalty += eff.happinessPenalty;
        }
      }

      const adjustedScore = Math.min(100, Math.max(0, happinessBase.score + govHappiness + wearinessPenalty));
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
  // Tick governor experience before ageing
  const experiencedGovernors = state.governors.map(g => tickGovernorExperience(g));
  const { updated, died } = processGovernorsTick(experiencedGovernors);

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

/**
 * Age all empire-wide leaders by one tick.
 * Dead leaders are auto-replaced with a new random leader for that role.
 */
function stepLeaders(
  state: GameTickState,
  events: GameEvent[],
): GameTickState {
  if (state.leaders.length === 0) return state;

  const experiencedLeaders = state.leaders.map(l => tickLeaderExperience(l));
  const { updated, died } = processLeadersTick(experiencedLeaders);

  // Auto-replace dead leaders with a fresh appointment
  const replacements: EmpireLeader[] = [];
  for (const leader of died) {
    const replacement = generateLeader(leader.empireId, leader.role);
    replacements.push(replacement);
    events.push({
      type: 'Notification',
      empireId: leader.empireId,
      message: `${leader.name}, your ${leader.role.replace(/_/g, ' ')}, has died. ${replacement.name} has been appointed as replacement.`,
      category: 'government',
      tick: state.gameState.currentTick,
    } as unknown as GameEvent);
  }

  return { ...state, leaders: [...updated, ...replacements] };
}

// ---------------------------------------------------------------------------
// Council Sanctions — trade income penalty helper
// ---------------------------------------------------------------------------

/**
 * Merge all active council sanctions targeting an empire into a single set of
 * penalties.  If multiple sanctions overlap, the most punitive value for each
 * penalty field wins (max confiscation, max taxation, any route-loss flag).
 *
 * Returns null if the empire has no active sanctions.
 */
function getActiveSanctionPenalties(
  state: GameTickState,
  empireId: string,
): SanctionPenalties | null {
  // CouncilStateV2 is stored as a dynamic property (not yet a formal field).
  const councilV2 = (state as unknown as Record<string, unknown>).councilV2State as
    | CouncilStateV2
    | undefined;
  if (!councilV2 || !councilV2.activeSanctions || councilV2.activeSanctions.length === 0) {
    return null;
  }

  const sanctions = councilV2.activeSanctions.filter(s => s.targetEmpireId === empireId);
  if (sanctions.length === 0) return null;

  // Merge: most punitive value per field across all active sanctions.
  const merged: SanctionPenalties = {
    reputationPenalty: 0,
    tradeRevenueConfiscation: 0,
    intelligenceCutoff: false,
    creditPenalty: 0,
    loseVotingRights: false,
    loseTradeRoutes: false,
    additionalTaxation: 0,
    benefitsSuspended: false,
    expelled: false,
    shunDuration: 0,
  };

  for (const s of sanctions) {
    const p = s.penalties;
    merged.reputationPenalty = Math.min(merged.reputationPenalty, p.reputationPenalty);
    merged.tradeRevenueConfiscation = Math.max(merged.tradeRevenueConfiscation, p.tradeRevenueConfiscation);
    merged.intelligenceCutoff = merged.intelligenceCutoff || p.intelligenceCutoff;
    merged.creditPenalty = Math.max(merged.creditPenalty, p.creditPenalty);
    merged.loseVotingRights = merged.loseVotingRights || p.loseVotingRights;
    merged.loseTradeRoutes = merged.loseTradeRoutes || p.loseTradeRoutes;
    merged.additionalTaxation = Math.max(merged.additionalTaxation, p.additionalTaxation);
    merged.benefitsSuspended = merged.benefitsSuspended || p.benefitsSuspended;
    merged.expelled = merged.expelled || p.expelled;
    merged.shunDuration = Math.max(merged.shunDuration, p.shunDuration);
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Step 4: Resource Production
// ---------------------------------------------------------------------------

function stepResourceProduction(state: GameTickState): GameTickState {
  // Enforce embargoes on trade routes — embargoed routes produce zero income.
  // BasicTradeRoute has no status field, so we filter them out before income
  // calculation.  The route data itself is preserved; only income is blocked.
  let activeTradeRoutes = state.tradeRoutes;
  if (state.embargoState && state.embargoState.embargoes.length > 0) {
    activeTradeRoutes = state.tradeRoutes.filter(route => {
      const destSystem = state.gameState.galaxy.systems.find(s => s.id === route.destinationSystemId);
      if (!destSystem) return true;
      const destOwner = destSystem.planets.find(p => p.ownerId && p.ownerId !== route.empireId)?.ownerId;
      if (!destOwner) return true;
      return !isEmbargoed(state.embargoState!, route.empireId, destOwner);
    });
  }

  // Process trade routes once per tick to get per-empire income totals.
  const { income: tradeIncome } = processTradeRoutes(
    activeTradeRoutes,
    state.gameState.galaxy,
  );

  let energyStateMap = new Map(state.energyStateMap);

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
      const wsMap3 = ((state as unknown as Record<string, unknown>).warStateMap ?? new Map()) as Map<string, EmpireWarState>;
      const happiness = calculatePlanetHappiness(planet, currentResources, isAtWar, empire.species, wsMap3.get(empire.id), empire.government, state.gameState.currentTick);
      const adjustedScore = Math.min(100, Math.max(0, happiness.score + govHappiness));
      const unrestThreshold = 30;
      const adjustedMult = adjustedScore < unrestThreshold ? 0.5 : 1.0;
      if (adjustedMult !== 1.0) {
        happinessMultipliers.set(planet.id, adjustedMult);
      }
    }

    // ── Energy flow: calculate per-planet energy balance ──────────────────
    // This must happen BEFORE resource aggregation so that the empire's
    // stored energy is correctly set and energy-deficit penalties are based
    // on the flow model rather than the old stockpile model.
    let empireTotalStoredEnergy = 0;
    let empireEnergyRatio = 1.0;
    let totalEnergyProduction = 0;
    let totalEnergyDemand = 0;
    {
      let totalStoredEnergy = 0;
      let totalStorageCapacity = 0;

      for (const planet of ownedPlanets) {
        const disabledIds = state.disabledBuildingsMap.get(planet.id) ?? [];

        const production = calculateEnergyProduction(planet.buildings);
        const demand = calculateEnergyDemand(planet.buildings, disabledIds);
        const storedBefore = state.energyStateMap.get(planet.id)?.storedEnergy ?? 0;
        const storageCapacity = calculateStorageCapacity(planet.buildings);

        const energyState = calculateEnergyBalance(
          production,
          demand,
          storedBefore,
          storageCapacity,
          disabledIds,
        );

        energyStateMap.set(planet.id, energyState);

        totalEnergyProduction += production;
        totalEnergyDemand += demand;
        totalStoredEnergy += energyState.storedEnergy;
        totalStorageCapacity += storageCapacity;
      }

      empireTotalStoredEnergy = totalStoredEnergy;

      // Empire-wide energy ratio for deficit penalties
      empireEnergyRatio = totalEnergyDemand > 0
        ? Math.min(totalEnergyProduction / totalEnergyDemand, 10)
        : (totalEnergyProduction > 0 ? 10 : 1.0);
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
      // Energy is handled separately via the flow model — do NOT accumulate
      // the old economy.ts production value.
      production.minerals       += boostedProduction.minerals;
      production.rareElements   += boostedProduction.rareElements;
      production.organics       += boostedProduction.organics;
      production.exoticMaterials += boostedProduction.exoticMaterials;
      production.faith          += boostedProduction.faith;
      production.researchPoints += boostedProduction.researchPoints;
    }

    // Add trade route income to this empire's credit production.
    let tradeCredits = tradeIncome.get(empire.id) ?? 0;

    // ── Council sanctions: reduce or eliminate trade income ─────────────
    // Sanctions are imposed via the CouncilStateV2 bill system.  If the
    // empire is under active sanctions, apply confiscation, additional
    // taxation, or full trade route loss before credits are accumulated.
    const sanctionPenalties = getActiveSanctionPenalties(state, empire.id);
    if (sanctionPenalties) {
      if (sanctionPenalties.loseTradeRoutes) {
        // Total trade route loss — zero trade income.
        tradeCredits = 0;
      } else {
        if (sanctionPenalties.tradeRevenueConfiscation > 0) {
          tradeCredits *= (1 - sanctionPenalties.tradeRevenueConfiscation / 100);
        }
        if (sanctionPenalties.additionalTaxation > 0) {
          tradeCredits *= (1 - sanctionPenalties.additionalTaxation / 100);
        }
        tradeCredits = Math.round(tradeCredits);
      }
    }

    production.credits += tradeCredits;

    // ── Corruption penalty: reduce credit income ────────────────────────
    // The corruption step (3e) runs before production (step 4), so
    // corruptionStates is already up-to-date for this tick.
    const corruptionStates = (state as unknown as Record<string, unknown>).corruptionStates as
      | Map<string, EmpireCorruptionState>
      | undefined;
    const empireCorruption = corruptionStates?.get(empire.id);
    if (empireCorruption) {
      const penalty = getCorruptionPenalty(empireCorruption.averageCorruption);
      production.credits = Math.round(production.credits * penalty);
    }

    const shipCount = countEmpireShipsViaFleets(
      state.gameState.ships,
      state.gameState.fleets,
      empire.id,
    );
    const buildingCount = countBuildings(ownedPlanets);
    // War weariness increases fleet maintenance costs.
    const wsMapUpkeep = ((state as unknown as Record<string, unknown>).warStateMap ?? new Map()) as Map<string, EmpireWarState>;
    const empireWarWeariness = wsMapUpkeep.get(empire.id)?.warWeariness ?? 0;
    const wearinessUpkeepMult = getWarUpkeepMultiplier(empireWarWeariness);
    const upkeep = calculateUpkeep(empire, shipCount, buildingCount, ownedPlanets, wearinessUpkeepMult);

    let newResources = applyResourceTick(currentResources, production, upkeep);

    // ── Energy flow override ─────────────────────────────────────────────
    // Energy display = current surplus (production - demand) + stored battery.
    // This gives the player a meaningful readout of their energy situation.
    const energySurplus = Math.max(0, totalEnergyProduction - totalEnergyDemand);
    newResources = {
      ...newResources,
      energy: energySurplus + empireTotalStoredEnergy,
    };

    // Apply energy deficit research penalty: halve accumulated research points.
    // Construction and ship production penalties are handled in their own steps.
    // Use the flow-based energy ratio rather than the old stockpile check.
    const isEnergyDeficit = empireEnergyRatio < 1.0;
    if (isEnergyDeficit) {
      const researchMultiplier = empireEnergyRatio < 0.3 ? 0.25 : 0.5;
      newResources = {
        ...newResources,
        researchPoints: Math.floor(newResources.researchPoints * researchMultiplier),
      };
    }

    // Update both the resource map and empire credits/researchPoints
    state = applyResources(state, empire.id, newResources);

    // ── Economic notifications (BUG 2) ──────────────────────────────────
    const tick = state.gameState.currentTick;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- notifications is a dynamic property
    let notifications = [...((state as any).notifications ?? [])] as ReturnType<typeof createNotification>[];

    // Low credits warning — emit once every 50 ticks to avoid spam
    if (newResources.credits <= 0 && tick % 50 === 0) {
      notifications.push(
        createNotification(
          'low_credits',
          'Treasury depleted',
          `The ${empire.name} treasury is empty. Ship maintenance and building upkeep cannot be paid.`,
          tick,
          undefined,
          { empireId: empire.id },
        ),
      );
    }

    // Maintenance warning — upkeep exceeds income
    const netCredits = production.credits + upkeep.credits;
    if (netCredits < 0 && tick % 50 === 0) {
      notifications.push(
        createNotification(
          'maintenance_warning',
          'Upkeep exceeds income',
          `The ${empire.name} is spending more on maintenance than it earns. Reduce fleet size or build more trade infrastructure.`,
          tick,
          undefined,
          { empireId: empire.id },
        ),
      );
    }

    // Over naval capacity warning
    const navalCap = calculateNavalCapacity(ownedPlanets);
    if (shipCount > navalCap && tick % 50 === 0) {
      notifications.push(
        createNotification(
          'over_naval_capacity',
          'Fleet exceeds naval capacity',
          `The ${empire.name} has ${shipCount} ships but only ${navalCap} naval capacity. Upkeep costs are multiplied.`,
          tick,
          undefined,
          { empireId: empire.id },
        ),
      );
    }

    // ── Ship attrition at bankruptcy (BUG 4) ────────────────────────────
    if (newResources.credits <= 0 && netCredits < 0) {
      let ships = state.gameState.ships;
      let shipsChanged = false;
      const fleets = state.gameState.fleets.filter(f => f.empireId === empire.id);
      for (const fleet of fleets) {
        for (const shipId of fleet.ships) {
          // 5% chance per ship per tick of taking attrition damage
          if (Math.random() < 0.05) {
            const shipIdx = ships.findIndex(s => s.id === shipId);
            if (shipIdx === -1) continue;
            const ship = ships[shipIdx]!;
            if (ship.hullPoints <= 0) continue;
            const attritionDamage = Math.max(1, Math.floor(ship.maxHullPoints * 0.1));
            const newHull = Math.max(0, ship.hullPoints - attritionDamage);
            if (!shipsChanged) {
              ships = [...ships];
              shipsChanged = true;
            }
            ships[shipIdx] = { ...ship, hullPoints: newHull };

            if (newHull <= 0) {
              notifications.push(
                createNotification(
                  'ship_attrition',
                  `${ship.name} lost`,
                  `${ship.name} has been lost due to lack of maintenance. Crew desertion and system failures have rendered it inoperable.`,
                  tick,
                  undefined,
                  { empireId: empire.id },
                ),
              );
            }
          }
        }
      }

      if (shipsChanged) {
        // Remove destroyed ships from fleets and ship list
        const destroyedIds = new Set(ships.filter(s => s.hullPoints <= 0).map(s => s.id));
        const updatedFleets = state.gameState.fleets.map(f => {
          if (f.empireId !== empire.id) return f;
          const remaining = f.ships.filter(id => !destroyedIds.has(id));
          return remaining.length !== f.ships.length ? { ...f, ships: remaining } : f;
        }).filter(f => f.ships.length > 0);

        state = {
          ...state,
          gameState: {
            ...state.gameState,
            ships: ships.filter(s => s.hullPoints > 0),
            fleets: updatedFleets,
          },
        };
      }
    }

    state = { ...state, notifications } as GameTickState;
  }

  return { ...state, energyStateMap };
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
      empire.species.traits.reproduction,
      empire.species,
    );

    state = applyResources(state, empire.id, updatedResources);

    if (isStarving && ownedPlanets.length > 0) {
      // Graduated population loss based on shortage severity:
      //   severe (15-40%):   0.1% per tick — slow decline, time to fix
      //   critical (40-99%): 0.5% per tick — urgent crisis
      //   famine (100%):     2.0% per tick — catastrophic
      const { shortageLevel } = applyFoodConsumption(
        currentResources, totalPopulation,
        empire.species.traits.reproduction, empire.species,
      );
      const lossRate = shortageLevel === 'famine' ? 0.02
        : shortageLevel === 'critical' ? 0.005
        : 0.001; // severe

      for (const planet of ownedPlanets) {
        if (planet.currentPopulation <= 0) continue;
        const loss = Math.max(1, Math.floor(planet.currentPopulation * lossRate));
        const newPop = Math.max(0, planet.currentPopulation - loss);

        if (newPop <= 0 && planet.currentPopulation < 1000) {
          // Tiny colony wiped out — release ownership so planet can be recolonised.
          // Only abandon when the pre-starvation population was already critically low;
          // large colonies that temporarily starve should not instantly disappear.
          const abandonedPlanet = {
            ...planet,
            currentPopulation: 0,
            ownerId: null,
            buildings: [],
            productionQueue: [],
          };
          systems = replacePlanet(systems, abandonedPlanet);

          // Emit colony_starving notification to alert the player
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- notifications is a dynamic property
          const starvNotifications = [...((state as any).notifications ?? [])] as ReturnType<typeof createNotification>[];
          starvNotifications.push(
            createNotification(
              'colony_starving',
              'Colony lost to starvation',
              `The colony on ${planet.name} has perished from starvation. The planet is now unowned.`,
              state.gameState.currentTick,
              undefined,
              { planetId: planet.id, empireId: empire.id },
            ),
          );
          state = { ...state, notifications: starvNotifications } as typeof state;
        } else {
          const updatedPlanet = { ...planet, currentPopulation: newPop };
          systems = replacePlanet(systems, updatedPlanet);
        }
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

      // Construction points per tick = base + sum(factory outputs), scaled by government.
      // Each factory generates FACTORY_CONSTRUCTION_OUTPUT per tick at level 1,
      // scaled by BUILDING_LEVEL_MULTIPLIER per level and species construction trait.
      const empire = state.gameState.empires.find(e => e.id === planet.ownerId);
      const govConstructionMult = empire
        ? (GOVERNMENTS[empire.government]?.modifiers.constructionSpeed ?? 1.0)
        : 1.0;
      const speciesConstructionFactor = empire ? (empire.species.traits.construction / 5) : 1.0;

      let factoryOutput = 0;
      for (const building of planet.buildings) {
        if (building.type === 'factory') {
          factoryOutput += FACTORY_CONSTRUCTION_OUTPUT
            * Math.pow(BUILDING_LEVEL_MULTIPLIER, building.level - 1)
            * speciesConstructionFactor;
        }
      }
      // Energy deficit halves construction speed
      const empireResources = empire ? state.empireResourcesMap.get(empire.id) : undefined;
      const energyMult = empireResources ? getEnergyStatus(empireResources).constructionMultiplier : 1.0;
      const constructionRate = (BASE_CONSTRUCTION_RATE + factoryOutput) * govConstructionMult * energyMult;
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
// Step 5a: Governor Auto-Build
// ---------------------------------------------------------------------------

/**
 * For planets with a governor whose autoManage flag is true and an empty
 * production queue, ask the governor to decide what to build next.
 */
function stepGovernorAutoBuild(state: GameTickState): GameTickState {
  let systems = state.gameState.galaxy.systems;

  for (const system of state.gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === null) continue;
      if (planet.productionQueue.length > 0) continue; // Already building something

      // Find the governor for this planet
      const governor = state.governors.find(g => g.planetId === planet.id && g.autoManage);
      if (!governor) continue;

      const empire = state.gameState.empires.find(e => e.id === planet.ownerId);
      if (!empire) continue;

      const resources = getEmpireResources(state, empire.id);
      const decision = governorAutoBuildDecision(
        planet,
        governor,
        empire.technologies,
        resources.credits,
        resources.minerals,
      );

      if (decision && decision.action === 'build') {
        const zone = inferBuildingZone(decision.type);
        const updatedPlanet = addBuildingToQueue(planet, decision.type, empire.species, empire.technologies, zone);
        if (updatedPlanet !== planet) {
          systems = replacePlanet(systems, updatedPlanet);
        }
      } else if (decision && decision.action === 'upgrade') {
        const building = planet.buildings.find(b => b.id === decision.buildingId);
        if (building && canUpgradeBuilding(planet, building.id, empire.currentAge).allowed) {
          const updatedPlanet = addUpgradeToQueue(planet, building.id, empire.currentAge);
          if (updatedPlanet !== planet) {
            systems = replacePlanet(systems, updatedPlanet);
          }
        }
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

      // Resolve the owning species so terraforming targets their ideal planet.
      const ownerEmpire = state.gameState.empires.find(e => e.id === planet.ownerId);
      const ownerSpecies = ownerEmpire?.species;

      const result = processTerraformingTick(
        planet,
        hasTerraformingStation,
        stationLevel,
        existingProgress,
        ownerSpecies,
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
  let systems = state.gameState.galaxy.systems;

  for (const order of state.productionOrders) {
    // Energy deficit penalty: skip every other tick (50 % speed) when
    // the planet's energy demand exceeds production.
    const planetEnergy = state.energyStateMap.get(order.planetId);
    if (planetEnergy && planetEnergy.ratio < 1.0 && state.gameState.currentTick % 2 === 0) {
      remainingOrders.push(order);
      continue;
    }

    // Apply species construction trait to ship production speed
    let constructionSpeedMultiplier = 1.0;
    for (const system of systems) {
      const planet = system.planets.find(p => p.id === order.planetId);
      if (planet?.ownerId) {
        const empire = state.gameState.empires.find(e => e.id === planet.ownerId);
        if (empire) {
          constructionSpeedMultiplier = (empire.species.traits.construction ?? 5) / 5;
        }
        break;
      }
    }
    // Advance production by species-modified amount (floored to at least 1)
    const ticksToAdvance = Math.max(1, Math.round(constructionSpeedMultiplier));
    const advancedOrder = { ...order, ticksRemaining: order.ticksRemaining - ticksToAdvance };
    const result = advancedOrder.ticksRemaining <= 0
      ? { order: null as ShipProductionOrder | null, completed: true }
      : { order: advancedOrder, completed: false };

    if (result.completed) {
      // Find the planet to determine its system and owning empire
      let planetOwnerId: string | null = null;
      let systemId: string | null = null;

      for (const system of systems) {
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

      // Remove the matching ship entry from the planet's production queue
      systems = systems.map(s => {
        if (s.id !== systemId) return s;
        return {
          ...s,
          planets: s.planets.map(p => {
            if (p.id !== order.planetId) return p;
            const idx = p.productionQueue.findIndex(
              q => q.type === 'ship' && q.templateId === order.designId,
            );
            if (idx < 0) return p;
            return {
              ...p,
              productionQueue: p.productionQueue.filter((_, i) => i !== idx),
            };
          }),
        };
      });

      // Create a new ship at the construction planet's system
      const newShipId = generateId();
      const design = state.shipDesigns?.get(order.designId);
      const hullTemplate = design ? HULL_TEMPLATE_BY_CLASS[design.hull] : undefined;
      const baseHp = hullTemplate?.baseHullPoints ?? 60;
      const hp = getEffectiveHullPoints(baseHp, design?.armourPlating ?? 0);
      const newShip: Ship = {
        id: newShipId,
        designId: order.designId,
        name: design?.name ?? 'Newly Built Ship',
        hullPoints: hp,
        maxHullPoints: hp,
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
          orbitTarget: 'star',
        };
        fleets = [...fleets, newFleet];
        ships = [...ships, { ...newShip, fleetId: newFleetId }];
      }
    } else if (result.order !== null) {
      remainingOrders.push(result.order);

      // Sync the planet queue entry's turnsRemaining to match the production order
      const updatedOrder = result.order;
      systems = systems.map(s => ({
        ...s,
        planets: s.planets.map(p => {
          if (p.id !== updatedOrder.planetId) return p;
          const idx = p.productionQueue.findIndex(
            q => q.type === 'ship' && q.templateId === updatedOrder.designId,
          );
          if (idx < 0) return p;
          const queueItem = p.productionQueue[idx]!;
          if (queueItem.turnsRemaining === updatedOrder.ticksRemaining) return p;
          return {
            ...p,
            productionQueue: p.productionQueue.map((q, i) =>
              i === idx ? { ...q, turnsRemaining: updatedOrder.ticksRemaining } : q,
            ),
          };
        }),
      }));
    }
  }

  return {
    ...state,
    productionOrders: remainingOrders,
    gameState: {
      ...state.gameState,
      fleets,
      ships,
      galaxy: { ...state.gameState.galaxy, systems },
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
  const updatedShipDesigns = new Map(state.shipDesigns ?? new Map<string, ShipDesign>());
  let empires = state.gameState.empires;

  for (const empire of state.gameState.empires) {
    const rawResearchState = newResearchStates.get(empire.id);
    if (!rawResearchState) continue;

    // Sync research state age with empire age to prevent regression.
    // Empire.currentAge is authoritative — researchState.currentAge can lag
    // if a previous save/load cycle or code path advanced one but not the other.
    const empireAgeIdx = TECH_AGES.findIndex(a => a.name === empire.currentAge);
    const researchAgeIdx = TECH_AGES.findIndex(a => a.name === rawResearchState.currentAge);
    const researchState: ResearchState = empireAgeIdx > researchAgeIdx
      ? { ...rawResearchState, currentAge: empire.currentAge }
      : rawResearchState;
    if (empireAgeIdx > researchAgeIdx) {
      newResearchStates.set(empire.id, researchState);
    }

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

      // Regenerate default designs whenever new tech is completed.
      // This ensures ships built after researching plasma cannons actually
      // USE plasma cannons, not the starter lasers from game start.
      // Previously this only ran on age transitions, meaning tech advantages
      // from research never translated into better ships.
      const availableComponents = getAvailableComponents(
        SHIP_COMPONENTS,
        updatedEmpire.technologies,
      );
      // Delete existing default designs for this empire so they get rebuilt
      // with the latest components. Custom player designs are preserved.
      for (const [designId, design] of updatedShipDesigns) {
        if (design.empireId === updatedEmpire.id && designId.startsWith('default-')) {
          updatedShipDesigns.delete(designId);
        }
      }
      const newDefaults = generateDefaultDesigns(
        updatedEmpire.currentAge,
        updatedEmpire.id,
        updatedShipDesigns,
        availableComponents,
      );
      for (const d of newDefaults) {
        updatedShipDesigns.set(d.id, d);
      }
    }
  }

  return {
    ...state,
    researchStates: newResearchStates,
    gameState: { ...state.gameState, empires },
    shipDesigns: updatedShipDesigns,
  };
}

// ---------------------------------------------------------------------------
// Step 8: Diplomacy Tick (stub)
// ---------------------------------------------------------------------------

function stepDiplomacyTick(state: GameTickState): GameTickState {
  // Guard: skip if the state has no diplomacy state structure yet (old saves)
  const diplomacyState = state.diplomacyState;
  if (!diplomacyState) return state;

  const tick = state.gameState.currentTick;
  const updatedDiplomacy = processDiplomacyTick(diplomacyState, tick);

  // Sync diplomacyState back to empire.diplomacy so AI and victory checks see it
  const syncedEmpires = state.gameState.empires.map(empire => {
    const empireRelations: Array<{
      empireId: string;
      status: string;
      attitude: number;
      trust: number;
      treaties: Array<{ id: string; type: string; startTick: number; duration: number }>;
      tradeRoutes: number;
      firstContact: number;
    }> = [];

    for (const otherEmpire of state.gameState.empires) {
      if (otherEmpire.id === empire.id) continue;
      const rel = getRelation(updatedDiplomacy, empire.id, otherEmpire.id);
      if (!rel) continue;
      empireRelations.push({
        empireId: otherEmpire.id,
        status: rel.status,
        attitude: rel.attitude,
        trust: rel.trust,
        treaties: rel.treaties.map(t => ({
          id: t.id,
          type: t.type,
          startTick: t.startTick,
          duration: t.duration,
        })),
        tradeRoutes: rel.tradeRoutes,
        firstContact: rel.firstContact,
      });
    }

    return { ...empire, diplomacy: empireRelations };
  });

  return {
    ...state,
    diplomacyState: updatedDiplomacy,
    gameState: {
      ...state.gameState,
      // Cast needed: syncedEmpires diplomacy array omits communicationLevel
      empires: syncedEmpires as unknown as typeof state.gameState.empires,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 8b: Espionage Tick
// ---------------------------------------------------------------------------

/**
 * Advance all spy agents by one tick: recalculate counter-intel from buildings,
 * then process infiltration, detection rolls and mission outcomes.
 *
 * Espionage events (intel, tech theft, sabotage, capture) are appended to the
 * espionageEventLog and also pushed into the main GameEvent stream as
 * 'EspionageResult' events so the UI can display notifications.
 *
 * Stolen technologies are applied directly to the owning empire's tech list.
 * Capture events apply a diplomatic attitude penalty via the diplomacy array.
 */
function stepEspionage(state: GameTickState, events: GameEvent[]): GameTickState {
  let espState = state.espionageState;
  let systems = state.gameState.galaxy.systems;

  // 1. Recalculate passive counter-intel from communications_hub buildings
  for (const empire of state.gameState.empires) {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    espState = recalculateCounterIntel(espState, empire.id, ownedPlanets);
  }

  // 2. Process one espionage tick (infiltration, detection, mission rolls)
  const { state: nextEspState, events: espEvents } = processEspionageTick(
    espState,
    state.gameState.empires,
  );

  // 3. Apply side-effects from espionage events
  let empires = state.gameState.empires;
  let empireResourcesMap = state.empireResourcesMap;

  for (const evt of espEvents) {
    if (evt.type === 'steal_tech' && evt.stolenTechId) {
      // Add the stolen tech to the spy-owner's empire
      const agent = nextEspState.agents.find(a => a.id === evt.agentId);
      if (agent) {
        empires = empires.map(e => {
          if (e.id !== agent.empireId) return e;
          if (e.technologies.includes(evt.stolenTechId!)) return e;
          return { ...e, technologies: [...e.technologies, evt.stolenTechId!] };
        });
      }
    }

    if (evt.type === 'capture') {
      // Record espionage detection in the psychology relationship system
      if (state.psychStateMap) {
        recordDiplomaticEvent(state.psychStateMap, evt.empireId, evt.targetEmpireId, 'espionage_detected', state.gameState.currentTick);

        // Repeat espionage escalation: 3+ detections triggers additional 'threat' event
        const targetPsych = state.psychStateMap.get(evt.targetEmpireId);
        const espRel = targetPsych?.relationships[evt.empireId];
        if (espRel) {
          const priorDetections = espRel.incidents.filter(i => i.type === 'espionage_detected').length;
          if (priorDetections >= 3) {
            // Pattern of espionage is an existential concern — fire a threat event
            recordDiplomaticEvent(state.psychStateMap, evt.targetEmpireId, evt.empireId, 'threat', state.gameState.currentTick);
            // Bigger reputation hit for persistent espionage
            if (state.reputationState) {
              state = { ...state, reputationState: recordReputationEvent(state.reputationState, {
                tick: state.gameState.currentTick, empireId: evt.empireId, type: 'espionage_exposed', value: -10,
                description: 'Persistent pattern of espionage detected',
              })};
            }
          }
        }
      }

      // Record espionage exposure in the reputation system
      if (state.reputationState) {
        state = { ...state, reputationState: recordReputationEvent(state.reputationState, {
          tick: state.gameState.currentTick, empireId: evt.empireId, type: 'espionage_exposed', value: REPUTATION_EVENT_VALUES.espionage_exposed,
          description: 'Espionage operation exposed',
        })};
      }

      // Apply diplomatic attitude penalty:
      // The target empire (who caught the spy) dislikes the spy's owner.
      empires = empires.map(e => {
        if (e.id !== evt.targetEmpireId) return e;
        const existing = e.diplomacy.find(d => d.empireId === evt.empireId);
        if (existing) {
          return {
            ...e,
            diplomacy: e.diplomacy.map(d =>
              d.empireId === evt.empireId
                ? { ...d, attitude: d.attitude + evt.attitudePenalty }
                : d,
            ),
          };
        }
        // No existing diplomacy entry — create one with the penalty
        return {
          ...e,
          diplomacy: [...e.diplomacy, {
            empireId: evt.empireId,
            status: 'neutral' as const,
            attitude: evt.attitudePenalty,
            treaties: [],
            tradeRoutes: 0,
            communicationLevel: 'none' as const,
          }],
        };
      });
    }

    // Sabotage: destroy a random building on a target empire's planet
    if (evt.type === 'sabotage') {
      const targetEmpire = empires.find(e => e.id === evt.targetEmpireId);
      if (targetEmpire) {
        // Find a random planet with buildings owned by the target
        const targetPlanets: { systemIdx: number; planetIdx: number }[] = [];
        for (let si = 0; si < systems.length; si++) {
          for (let pi = 0; pi < systems[si].planets.length; pi++) {
            const p = systems[si].planets[pi];
            if (p.ownerId === evt.targetEmpireId && p.buildings.length > 0) {
              targetPlanets.push({ systemIdx: si, planetIdx: pi });
            }
          }
        }
        if (targetPlanets.length > 0) {
          const pick = targetPlanets[Math.floor(Math.random() * targetPlanets.length)];
          const planet = systems[pick.systemIdx].planets[pick.planetIdx];
          const buildingIdx = Math.floor(Math.random() * planet.buildings.length);
          const destroyedBuilding = planet.buildings[buildingIdx];
          const updatedBuildings = planet.buildings.filter((_, i) => i !== buildingIdx);
          const updatedPlanet = { ...planet, buildings: updatedBuildings };
          systems = systems.map((sys, si) =>
            si === pick.systemIdx
              ? { ...sys, planets: sys.planets.map((p, pi) => pi === pick.planetIdx ? updatedPlanet : p) }
              : sys,
          );
          console.log(`[Espionage] Sabotage destroyed ${destroyedBuilding.type} on ${planet.name}`);
        }
      }
    }

    // Push a typed game event so the UI event log can pick it up
    const espEvent: EspionageResultEvent = {
      type: 'EspionageResult',
      espionageEvent: evt,
      tick: state.gameState.currentTick,
    };
    events.push(espEvent);
  }

  // 4. Append espionage events to the cumulative log (newest last)
  const newLog = [...state.espionageEventLog, ...espEvents];

  return {
    ...state,
    espionageState: nextEspState,
    espionageEventLog: newLog,
    empireResourcesMap,
    gameState: {
      ...state.gameState,
      empires,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Step 8f: Psychology Tick
// ---------------------------------------------------------------------------

/**
 * Update each empire's psychological state: Maslow needs, stress level, mood,
 * and effective personality traits. Runs after all state-changing steps so that
 * the snapshot is fully current, and before AI decisions so they can use it.
 */
function stepPsychology(state: GameTickState): GameTickState {
  const psychMap = state.psychStateMap;

  if (!psychMap || psychMap.size === 0) return state;

  const updatedMap = new Map(psychMap);
  const diplomacyState = state.diplomacyState;

  for (const empire of state.gameState.empires) {
    const psychState = updatedMap.get(empire.id);
    if (!psychState) continue;

    // Build empire state snapshot from current game state
    const snapshot = buildEmpireStateSnapshot(state, empire);

    // Process one psychology tick
    const updated = processPsychologyTick(psychState, snapshot);
    updatedMap.set(empire.id, updated);
  }

  return { ...state, psychStateMap: updatedMap };
}

/**
 * Extract an EmpireStateSnapshot from the current game tick state for a given empire.
 */
function buildEmpireStateSnapshot(
  state: GameTickState,
  empire: import('../types/species.js').Empire,
): EmpireStateSnapshot {
  const resources = state.empireResourcesMap.get(empire.id);

  // Count colonised planets and total population
  let colonisedPlanets = 0;
  let totalPopulation = 0;
  let firstOwnedSystemId: string | undefined;
  for (const system of state.gameState.galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === empire.id) {
        colonisedPlanets++;
        totalPopulation += planet.currentPopulation ?? 0;
        if (!firstOwnedSystemId) firstOwnedSystemId = system.id;
      }
    }
  }

  // Military power: sum fleet ship counts
  let militaryPower = 0;
  for (const fleet of state.gameState.fleets) {
    if (fleet.empireId === empire.id) {
      militaryPower += fleet.ships.length * 10;
    }
  }

  // Strongest rival
  let strongestRivalPower = 0;
  for (const other of state.gameState.empires) {
    if (other.id === empire.id) continue;
    let power = 0;
    for (const fleet of state.gameState.fleets) {
      if (fleet.empireId === other.id) {
        power += fleet.ships.length * 10;
      }
    }
    if (power > strongestRivalPower) strongestRivalPower = power;
  }

  // Count wars, treaties, allies from diplomacy relations
  let activeWars = 0;
  let activeTreaties = 0;
  let allies = 0;
  let tradeRoutesCount = 0;
  for (const rel of empire.diplomacy ?? []) {
    if (rel.status === 'at_war') activeWars++;
    if (rel.status === 'allied') allies++;
    if (rel.treaties) activeTreaties += rel.treaties.length;
  }
  for (const tr of state.tradeRoutes) {
    if (tr.empireId === empire.id) tradeRoutesCount++;
  }

  // Homeworld threat: enemy fleet in first owned system (approximation)
  let homeworldThreatened = false;
  if (firstOwnedSystemId) {
    homeworldThreatened = state.gameState.fleets.some(
      f => f.empireId !== empire.id && f.position.systemId === firstOwnedSystemId
        && empire.diplomacy?.some(r =>
          r.empireId === f.empireId && r.status === 'at_war',
        ),
    );
  }

  // Food balance: rough estimate from organics change
  const foodBalance = resources ? (resources.organics > 100 ? 10 : -5) : 0;

  // Victory progress: rough estimate from tech ratio
  const techsResearched = empire.technologies?.length ?? 0;
  const totalTechs = state.allTechCount || 100;
  const victoryProgress = Math.min(100, Math.round(
    (colonisedPlanets / Math.max(1, state.gameState.empires.length * 3)) * 30 +
    (techsResearched / totalTechs) * 30 +
    (allies > 0 ? 20 : 0) +
    (militaryPower > strongestRivalPower ? 20 : 0),
  ));

  return {
    currentTick: state.gameState.currentTick,
    organics: resources?.organics ?? 0,
    foodBalance,
    energy: resources?.energy ?? 0,
    minerals: resources?.minerals ?? 0,
    credits: resources?.credits ?? 0,
    colonisedPlanets,
    totalPopulation,
    militaryPower,
    strongestRivalPower,
    activeWars,
    homeworldThreatened,
    activeTreaties,
    allies,
    tradeRoutes: tradeRoutesCount,
    totalEmpires: state.gameState.empires.length,
    techsResearched,
    totalTechs,
    victoryProgress,
  };
}

// ---------------------------------------------------------------------------
// Step 9: AI Decisions
// ---------------------------------------------------------------------------

/**
 * Maximum number of AI decisions to execute per empire per tick.
 * Keeps per-tick processing bounded and prevents the AI from executing
 * an overwhelming burst of actions in a single frame.
 * 8 allows: research + 2 fleet moves + 2 ship builds + building + colonise + diplomacy
 */
const AI_DECISIONS_PER_TICK = 8;

function stepAIDecisions(
  state: GameTickState,
  allTechs: import('../types/technology.js').Technology[] = [],
): GameTickState {
  for (const empire of state.gameState.empires) {
    if (!empire.isAI) continue;

    // Skip eliminated empires (no planets, no ships) — they cannot take actions
    if (isEmpireEliminated(empire, state.gameState.galaxy, state.gameState.fleets)) continue;

    const personality = empire.aiPersonality ?? 'defensive';

    // 1. Evaluate the strategic situation (with stalemate detection)
    const trackers = state.warTerritoryTrackers ?? new Map<string, WarTerritoryTracker>();
    if (!trackers.has(empire.id)) {
      const ownedCount = state.gameState.galaxy.systems
        .flatMap(s => s.planets).filter(p => p.ownerId === empire.id).length;
      trackers.set(empire.id, {
        lastPlanetCount: ownedCount,
        lastChangeTick: state.gameState.currentTick,
        opponentPlanets: new Map(),
        opponentLastChange: new Map(),
      });
    }
    const evaluation = evaluateEmpireState(
      empire,
      state.gameState.galaxy,
      state.gameState.fleets,
      state.gameState.ships,
      state.gameState.currentTick,
      trackers.get(empire.id),
    );
    state = { ...state, warTerritoryTrackers: trackers };

    // 1b. War weariness forced peace — desperate empires capitulate
    // If severely outgunned (military <30% of enemy) and weariness >70,
    // propose vassalage instead of simple peace (surrender terms).
    const warStateMapForAI = ((state as unknown as Record<string, unknown>).warStateMap ?? new Map()) as Map<string, EmpireWarState>;
    const empireWarState = warStateMapForAI.get(empire.id);
    if (empireWarState && shouldForceAIPeace(empireWarState)) {
      // For each empire we're at war with, 20% chance per tick to propose peace
      for (const rel of empire.diplomacy) {
        if (rel.status !== 'at_war') continue;
        if (Math.random() < AI_FORCED_PEACE_CHANCE) {
          // Compare military power to decide between peace and vassalage surrender
          let ourMilitaryPower = 0;
          let enemyMilitaryPower = 0;
          for (const fleet of state.gameState.fleets) {
            if (fleet.empireId === empire.id) ourMilitaryPower += fleet.ships.length * 10;
            if (fleet.empireId === rel.empireId) enemyMilitaryPower += fleet.ships.length * 10;
          }

          const severelyOutgunned = enemyMilitaryPower > 0
            && ourMilitaryPower / enemyMilitaryPower < 0.3;
          const highWeariness = empireWarState.warWeariness > 70;

          if (severelyOutgunned && highWeariness) {
            // Propose vassalage — surrender as a vassal to the enemy.
            // The proposer sets isOverlord=0 on their side (they become the vassal);
            // the enemy gets isOverlord=1 (they become the overlord).
            const vassalageSurrender: AIDecision = {
              type: 'diplomacy',
              priority: 100,
              params: {
                targetEmpireId: rel.empireId,
                action: 'propose_treaty',
                treatyType: 'vassalism',
                confidence: 1.0,
              },
              reasoning: `Military at ${Math.round(ourMilitaryPower)}/${Math.round(enemyMilitaryPower)} (${Math.round((ourMilitaryPower / Math.max(1, enemyMilitaryPower)) * 100)}%) and weariness at ${Math.round(empireWarState.warWeariness)}% — offering surrender as vassal.`,
            };
            state = executeAIDecision(state, empire.id, vassalageSurrender, allTechs);
          } else {
            // Standard peace-seeking — not outgunned enough to surrender
            const forcedPeaceDecision: AIDecision = {
              type: 'diplomacy',
              priority: 100, // Maximum priority — desperation overrides everything
              params: {
                targetEmpireId: rel.empireId,
                action: 'seek_peace',
                treatyType: 'peace',
                confidence: 1.0,
              },
              reasoning: `War weariness at ${Math.round(empireWarState.warWeariness)}% — empire is desperate for peace.`,
            };
            state = executeAIDecision(state, empire.id, forcedPeaceDecision, allTechs);
          }
        }
      }
    }

    // 2. Generate and rank all possible decisions
    // Attach shipDesigns to gameState so AI can check existing ship types
    const gameStateForAI = Object.assign({}, state.gameState, {
      shipDesigns: state.shipDesigns,
    });
    const allDecisions = generateAIDecisions(
      empire,
      gameStateForAI,
      personality,
      evaluation,
      allTechs,
    );

    // 3. Filter out unimplemented decision types that would waste slots, then pick top N
    const executableDecisions = allDecisions.filter(d =>
      ['build', 'research', 'build_ship', 'move_fleet', 'recruit_spy', 'assign_spy', 'colonize', 'diplomacy', 'war'].includes(d.type)
    );

    // Guarantee at least 1 research, 1 move_fleet, and 1 build_ship decision per tick
    // to prevent starvation from in-system colonize decisions consuming all slots
    const guaranteedTypes = new Set<string>();
    const guaranteed: AIDecision[] = [];
    const researchDecision = executableDecisions.find(d => d.type === 'research');
    if (researchDecision) { guaranteed.push(researchDecision); guaranteedTypes.add('research'); }
    const moveDecision = executableDecisions.find(d => d.type === 'move_fleet');
    if (moveDecision) { guaranteed.push(moveDecision); guaranteedTypes.add('move_fleet'); }
    const buildShipDecision = executableDecisions.find(d => d.type === 'build_ship');
    if (buildShipDecision) { guaranteed.push(buildShipDecision); guaranteedTypes.add('build_ship'); }
    const remaining = executableDecisions.filter(d => !guaranteedTypes.has(d.type) || d !== guaranteed.find(g => g.type === d.type));
    const remainingSlots = Math.max(0, AI_DECISIONS_PER_TICK - guaranteed.length);
    const topOther = selectTopDecisions(remaining, remainingSlots);
    const topDecisions = [...guaranteed, ...topOther];

    // 4. Execute each decision
    for (const decision of topDecisions) {
      state = executeAIDecision(state, empire.id, decision, allTechs);
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// AI demand generation — AI empires consider making demands from weaker neighbours
// ---------------------------------------------------------------------------

/** How often (in ticks) the AI considers making demands. */
const AI_DEMAND_CONSIDERATION_INTERVAL = 20;

/**
 * AI empires evaluate whether to demand resources from weaker neighbours.
 * Criteria: significant military advantage, not allies/friends, high fear + low
 * warmth in psychology, and personality traits (high ambition, low empathy).
 * Only resource (credit) demands for v1.
 */
function stepAIDemands(state: GameTickState): GameTickState {
  const tick = state.gameState.currentTick;
  if (tick % AI_DEMAND_CONSIDERATION_INTERVAL !== 0) return state;
  if (!state.demandState) return state;

  let s = state;

  for (const empire of s.gameState.empires) {
    if (!empire.isAI) continue;
    if (isEmpireEliminated(empire, s.gameState.galaxy, s.gameState.fleets)) continue;

    // Get personality profile for demand propensity check
    const profile = SPECIES_DEFAULT_PROFILES[empire.species.id];
    if (!profile) continue;

    // High ambition + low empathy = more likely to demand
    // Threshold: ambition >= 6 AND empathy <= 5 (skip peaceful/empathetic empires)
    const demandPropensity = profile.ambition - profile.empathy;
    if (demandPropensity < 1) continue;

    // Calculate our military power
    let ourMilitary = 0;
    for (const fleet of s.gameState.fleets) {
      if (fleet.empireId === empire.id) {
        ourMilitary += fleet.ships.length * 10;
      }
    }
    if (ourMilitary === 0) continue; // No military = no demands

    // Consider each known empire as a potential demand target
    const opponentIds = new Set<string>();
    for (const rel of empire.diplomacy) {
      if (rel.empireId !== empire.id) opponentIds.add(rel.empireId);
    }
    for (const system of s.gameState.galaxy.systems) {
      if (system.ownerId && system.ownerId !== empire.id) {
        opponentIds.add(system.ownerId);
      }
    }

    for (const targetId of opponentIds) {
      // Skip allies and friends (diplomacy status)
      const relation = empire.diplomacy.find(d => d.empireId === targetId);
      if (relation?.status === 'allied' || relation?.status === 'friendly') continue;

      // Skip if already have a pending demand to this target
      if (s.demandState!.demands.some(d =>
        d.proposerId === empire.id && d.targetId === targetId && d.status === 'pending'
      )) continue;

      // Psychology check: only demand when we have high fear + low warmth with target
      if (s.psychStateMap) {
        const ourPsych = s.psychStateMap.get(empire.id);
        if (ourPsych) {
          const rel = ourPsych.relationships[targetId];
          // If warmth is positive or trust is high, skip — we like them
          if (rel && (rel.warmth > 20 || rel.trust > 60)) continue;
        }
      }

      // Check military advantage over target
      let targetMilitary = 0;
      for (const fleet of s.gameState.fleets) {
        if (fleet.empireId === targetId) {
          targetMilitary += fleet.ships.length * 10;
        }
      }

      // Need at least 1.5x military advantage to consider a demand
      const militaryRatio = targetMilitary > 0 ? ourMilitary / targetMilitary : 10;
      if (militaryRatio < 1.5) continue;

      // Determine threat level based on power gap
      let threat: DemandThreat;
      if (militaryRatio >= 3.0) {
        threat = 'war';
      } else if (militaryRatio >= 2.0) {
        threat = 'sanctions';
      } else {
        threat = 'reputation';
      }

      // Demand amount proportional to power gap (100–500 credits)
      const demandAmount = Math.min(500, Math.round(100 * militaryRatio));

      // Random chance gate: demandPropensity (1–9) maps to ~10–90% chance
      // Use a deterministic pseudo-random based on tick + empire id hash
      const hash = (empire.id.length * 31 + targetId.length * 17 + tick) % 100;
      const chance = demandPropensity * 10;
      if (hash >= chance) continue;

      // Create the demand via the same mechanism as player propose_demand
      const demandId = `demand_${empire.id}_${targetId}_${tick}`;
      const demandEmpireName = empire.name ?? empire.id;

      const demand: Demand = {
        id: demandId,
        proposerId: empire.id,
        targetId,
        createdTick: tick,
        deadline: tick + DEMAND_DEADLINE_TICKS,
        status: 'pending',
        demandType: 'resources',
        threat,
        resourceType: 'credits',
        amount: demandAmount,
        description: `${demandEmpireName} demands ${demandAmount} credits`,
      };

      s = { ...s, demandState: createDemand(s.demandState!, demand) };

      // Psychology: threat event for the target
      if (s.psychStateMap) {
        recordDiplomaticEvent(s.psychStateMap, empire.id, targetId, 'threat', tick);
      }

      // If target is AI, evaluate immediately
      const targetEmpire = s.gameState.empires.find(e => e.id === targetId);
      if (targetEmpire?.isAI) {
        const targetPsych = s.psychStateMap?.get(targetId);
        const targetRel = targetPsych?.relationships[empire.id];

        let accepted = false;
        if (targetRel) {
          const result = evaluateDemandAI(demand, targetRel.fear, targetRel.warmth, targetRel.trust, targetRel.respect);
          accepted = result.accept;
        }

        if (accepted) {
          const { state: updatedDemands } = acceptDemand(s.demandState!, demandId);
          s = { ...s, demandState: updatedDemands };
          s = transferDemandedAsset(s, demand);
        } else {
          const { state: updatedDemands } = rejectDemand(s.demandState!, demandId);
          s = { ...s, demandState: updatedDemands };
          if (s.psychStateMap) {
            recordDiplomaticEvent(s.psychStateMap, targetId, empire.id, 'request_denied', tick);
          }
        }
      }

      // Only one demand per empire per consideration cycle
      break;
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// AI vassalage demands — AI empires demand subjugation from much weaker neighbours
// ---------------------------------------------------------------------------

/** How often (in ticks) the AI considers demanding vassalage. */
const AI_VASSALAGE_DEMAND_INTERVAL = 50;

/** Species that will NEVER accept vassalage — honour/faith forbids it. */
const SPECIES_REFUSE_VASSALAGE = new Set(['khazari', 'orivani']);

/**
 * AI empires with high ambition consider demanding vassalage from much weaker
 * neighbours that are not already vassals. This runs less frequently than
 * resource demands (every 50 ticks) and requires a 3:1 military advantage.
 */
function stepAIVassalageDemands(
  state: GameTickState,
  allTechs: import('../types/technology.js').Technology[] = [],
): GameTickState {
  const tick = state.gameState.currentTick;
  if (tick % AI_VASSALAGE_DEMAND_INTERVAL !== 0) return state;
  if (!state.diplomacyState) return state;

  let s = state;
  const vassalRels = findVassalRelationships(s.diplomacyState!);

  for (const empire of s.gameState.empires) {
    if (!empire.isAI) continue;
    if (isEmpireEliminated(empire, s.gameState.galaxy, s.gameState.fleets)) continue;

    const profile = SPECIES_DEFAULT_PROFILES[empire.species.id];
    if (!profile) continue;

    // Only ambitious empires demand vassalage (ambition > 7)
    if (profile.ambition <= 7) continue;

    // Calculate our military power
    let ourMilitary = 0;
    for (const fleet of s.gameState.fleets) {
      if (fleet.empireId === empire.id) ourMilitary += fleet.ships.length * 10;
    }
    if (ourMilitary === 0) continue;

    // Consider each known empire as a potential subjugation target
    const opponentIds = new Set<string>();
    for (const rel of empire.diplomacy) {
      if (rel.empireId !== empire.id) opponentIds.add(rel.empireId);
    }
    for (const system of s.gameState.galaxy.systems) {
      if (system.ownerId && system.ownerId !== empire.id) {
        opponentIds.add(system.ownerId);
      }
    }

    for (const targetId of opponentIds) {
      // Skip if target is already a vassal (of anyone)
      if (isVassal(targetId, vassalRels)) continue;

      // Skip if WE are a vassal — vassals don't demand vassals
      if (isVassal(empire.id, vassalRels)) continue;

      // Skip allies and friends
      const relation = empire.diplomacy.find(d => d.empireId === targetId);
      if (relation?.status === 'allied' || relation?.status === 'friendly') continue;

      // Skip if at war — wartime vassalage is handled by the surrender path
      if (relation?.status === 'at_war') continue;

      // Skip if we already have a vassalism treaty with this target
      const dipRel = getRelation(s.diplomacyState!, empire.id, targetId);
      if (dipRel?.treaties.some(t => t.type === 'vassalism')) continue;

      // Skip if warmth is positive — we like them
      if (s.psychStateMap) {
        const ourPsych = s.psychStateMap.get(empire.id);
        if (ourPsych) {
          const rel = ourPsych.relationships[targetId];
          if (rel && rel.warmth > 20) continue;
        }
      }

      // Check military advantage: need >3x to demand vassalage
      let targetMilitary = 0;
      for (const fleet of s.gameState.fleets) {
        if (fleet.empireId === targetId) targetMilitary += fleet.ships.length * 10;
      }
      const militaryRatio = targetMilitary > 0 ? ourMilitary / targetMilitary : 10;
      if (militaryRatio < 3.0) continue;

      // Random chance gate: ambition-scaled probability (ambition 8-10 = 20-40%)
      const hash = (empire.id.length * 37 + targetId.length * 13 + tick) % 100;
      const chance = (profile.ambition - 5) * 10; // 8→30, 9→40, 10→50
      if (hash >= chance) continue;

      // Propose vassalage via the diplomacy decision executor
      const vassalageDemand: AIDecision = {
        type: 'diplomacy',
        priority: 90,
        params: {
          targetEmpireId: targetId,
          action: 'propose_treaty',
          treatyType: 'vassalism',
          confidence: 0.8,
        },
        reasoning: `Military advantage ${Math.round(militaryRatio)}:1 over ${targetId} — demanding vassalage.`,
      };
      s = executeAIDecision(s, empire.id, vassalageDemand, allTechs);

      // Only one vassalage demand per empire per cycle
      break;
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// AI vassal rebellion — vassals whose military grows strong enough may rebel
// ---------------------------------------------------------------------------

/** How often (in ticks) vassals evaluate rebellion. */
const AI_REBELLION_CHECK_INTERVAL = 30;

/**
 * Each tick (at interval), AI vassals check whether their military power has
 * grown to >=80% of the overlord's. If so, personality-driven probability
 * determines whether they break the vassalism treaty and declare war.
 */
function stepAIVassalRebellion(
  state: GameTickState,
  allTechs: import('../types/technology.js').Technology[] = [],
): GameTickState {
  const tick = state.gameState.currentTick;
  if (tick % AI_REBELLION_CHECK_INTERVAL !== 0) return state;
  if (!state.diplomacyState) return state;

  let s = state;
  const vassalRels = findVassalRelationships(s.diplomacyState!);

  for (const rel of vassalRels) {
    const vassalEmpire = s.gameState.empires.find(e => e.id === rel.vassalId);
    if (!vassalEmpire?.isAI) continue;
    if (isEmpireEliminated(vassalEmpire, s.gameState.galaxy, s.gameState.fleets)) continue;

    const profile = SPECIES_DEFAULT_PROFILES[vassalEmpire.species.id];
    if (!profile) continue;

    // Calculate military powers
    let vassalMilitary = 0;
    let overlordMilitary = 0;
    for (const fleet of s.gameState.fleets) {
      if (fleet.empireId === rel.vassalId) vassalMilitary += fleet.ships.length * 10;
      if (fleet.empireId === rel.overlordId) overlordMilitary += fleet.ships.length * 10;
    }

    // Need >=80% of overlord's military to consider rebellion
    const powerRatio = overlordMilitary > 0 ? vassalMilitary / overlordMilitary : 2.0;
    if (powerRatio < 0.8) continue;

    // Personality-driven rebellion probability:
    // Ambitious + brave = more likely to rebel; patient + loyal = less likely
    const rebellionScore = (profile.ambition * 0.35 + profile.bravery * 0.3)
      - (profile.loyalty * 0.2 + profile.patience * 0.15);
    // Map to 0-100 chance: score range roughly -3 to +7 → map to 5-70%
    const rebellionChance = Math.max(5, Math.min(70, Math.round((rebellionScore + 3) * 7)));

    const hash = (rel.vassalId.length * 41 + rel.overlordId.length * 19 + tick) % 100;
    if (hash >= rebellionChance) continue;

    // REBELLION: break the vassalism treaty, then declare war
    const dipRel = getRelation(s.diplomacyState!, rel.vassalId, rel.overlordId);
    if (!dipRel) continue;

    const vassalismTreaty = dipRel.treaties.find(t => t.type === 'vassalism');
    if (!vassalismTreaty) continue;

    // Break the vassalism treaty
    let updatedDiplomacy = breakTreaty(
      s.diplomacyState!, rel.vassalId, rel.overlordId, vassalismTreaty.id, tick,
    );

    // Declare war on the overlord
    updatedDiplomacy = declareWar(updatedDiplomacy, rel.vassalId, rel.overlordId, tick);
    s = { ...s, diplomacyState: updatedDiplomacy };

    // Psychology events: treaty broken + war declared
    if (s.psychStateMap) {
      recordDiplomaticEvent(s.psychStateMap, rel.vassalId, rel.overlordId, 'treaty_broken', tick);
      recordDiplomaticEvent(s.psychStateMap, rel.overlordId, rel.vassalId, 'treaty_broken', tick);
      recordDiplomaticEvent(s.psychStateMap, rel.vassalId, rel.overlordId, 'war_declared', tick);
      recordDiplomaticEvent(s.psychStateMap, rel.overlordId, rel.vassalId, 'war_declared_on_us', tick);
    }

    // Reputation: rebellion is viewed differently by different empires.
    // Treaty-breaking penalty for the rebel, but lighter than normal since
    // it's rebellion against subjugation.
    if (s.reputationState) {
      let repState = recordReputationEvent(s.reputationState, {
        tick,
        empireId: rel.vassalId,
        type: 'treaty_broken',
        value: Math.round(REPUTATION_EVENT_VALUES.treaty_broken * 0.5), // Half penalty — rebellion against tyranny
        description: 'Vassal rebellion — broke vassalage treaty',
      });
      repState = recordReputationEvent(repState, {
        tick,
        empireId: rel.vassalId,
        type: 'unjust_war',
        value: Math.round(REPUTATION_EVENT_VALUES.unjust_war * 0.3), // Light penalty — war of liberation
        description: 'Declared war of independence against overlord',
      });
      s = { ...s, reputationState: repState };
    }

    // Notify player if the overlord is the player
    const overlordEmpire = s.gameState.empires.find(e => e.id === rel.overlordId);
    if (overlordEmpire && !overlordEmpire.isAI) {
      const vassalName = vassalEmpire.name ?? rel.vassalId;
      const overlordName = overlordEmpire.name ?? rel.overlordId;
      const rebellionVoice = getDiplomaticVoice(
        vassalEmpire.species?.id ?? '', 'war_declaration',
        { name: vassalName, target: overlordName },
      );
      const notification = createNotification(
        'under_attack',
        rebellionVoice.title,
        rebellionVoice.body,
        tick,
        undefined,
        { empireId: rel.vassalId },
      );
      const existingNotifs = ((s as unknown as Record<string, unknown>).notifications ?? []) as ReturnType<typeof createNotification>[];
      s = { ...s, notifications: [...existingNotifs, notification] } as typeof s;
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// AI decision executor — converts an AIDecision into state mutations
// ---------------------------------------------------------------------------

function executeAIDecision(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
  allTechs: import('../types/technology.js').Technology[],
): GameTickState {
  switch (decision.type) {
    case 'build':
      return executeAIBuild(state, empireId, decision);

    case 'research':
      return executeAIResearch(state, empireId, decision, allTechs);

    case 'build_ship':
      return executeAIBuildShip(state, empireId, decision);

    case 'move_fleet':
      return executeAIMoveFleet(state, empireId, decision);

    case 'recruit_spy':
      return executeAIRecruitSpy(state, empireId, decision);

    case 'assign_spy':
      return executeAIAssignSpy(state, empireId, decision);

    case 'colonize':
      return executeAIColonize(state, empireId, decision);

    case 'diplomacy':
      return executeAIDiplomacy(state, empireId, decision);

    case 'war':
      return executeAIWar(state, empireId, decision);

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Colonize: AI colonises an unowned planet in a system it has presence in
// ---------------------------------------------------------------------------

function executeAIColonize(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { planetId, systemId } = decision.params as { planetId: string; systemId: string };
  if (!planetId || !systemId) return state;

  const system = state.gameState.galaxy.systems.find(s => s.id === systemId);
  if (!system) return state;

  const planet = system.planets.find(p => p.id === planetId);
  if (!planet || planet.ownerId) return state; // Already owned

  // Check the empire has presence in this system (owns another planet or has a fleet)
  const hasPresence = system.planets.some(p => p.ownerId === empireId) ||
    state.gameState.fleets.some(f => f.empireId === empireId && f.position.systemId === systemId);
  if (!hasPresence) return state;

  // Check the empire has a source planet with enough population to transfer
  const sourcePlanet = state.gameState.galaxy.systems
    .flatMap(s => s.planets)
    .filter(p => p.ownerId === empireId && p.currentPopulation >= 2000)
    .sort((a, b) => b.currentPopulation - a.currentPopulation)[0];
  if (!sourcePlanet) return state;

  const empire = state.gameState.empires.find(e => e.id === empireId);
  if (!empire) return state;

  // Use startMigration to set up colonisation
  const migrationOrder = startMigration(system, sourcePlanet.id, planetId, empireId, empire.species);
  return { ...state, migrationOrders: [...state.migrationOrders, migrationOrder] };
}

// ---------------------------------------------------------------------------
// Diplomacy: AI proposes a treaty to another empire
// ---------------------------------------------------------------------------

function executeAIDiplomacy(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { targetEmpireId, action, treatyType } = decision.params as {
    targetEmpireId: string;
    action: string;
    treatyType: string;
  };
  if (!targetEmpireId || !treatyType) return state;

  const diplomacyState = state.diplomacyState;
  if (!diplomacyState) return state;

  const tick = state.gameState.currentTick;

  if (action === 'propose_treaty') {
    // Check if the target would accept (based on attitude/trust)
    const relation = getRelation(diplomacyState, empireId, targetEmpireId);
    if (!relation) return state;

    // Don't propose treaties to empires we're at war with
    // Exception: vassalism is a war-ending surrender term
    if (relation.status === 'at_war' && treatyType !== 'vassalism') return state;

    // Don't duplicate existing treaties
    const hasTreatyType = relation.treaties.some(t => t.type === treatyType);
    if (hasTreatyType) return state;

    // Vassalism surrender: special handling — make peace first, then create
    // the asymmetric treaty (proposer becomes vassal, target becomes overlord).
    if (treatyType === 'vassalism' && relation.status === 'at_war') {
      const targetEmpire = state.gameState.empires.find(e => e.id === targetEmpireId);
      if (!targetEmpire) return state;

      // Winning empires always accept a surrender — auto-accept for AI targets
      if (targetEmpire.isAI) {
        // End the war first
        let updatedDiplomacy = makePeace(diplomacyState, empireId, targetEmpireId, tick);

        // Create the vassalism treaty with symmetric terms initially
        updatedDiplomacy = proposeTreaty(updatedDiplomacy, {
          fromEmpireId: empireId,
          toEmpireId: targetEmpireId,
          treatyType: 'vassalism' as TreatyType,
        }, tick);

        // Patch treaty terms: overlord side gets isOverlord=1, vassal side gets isOverlord=0.
        // The target is the overlord (they won), the proposer is the vassal (they surrendered).
        const overlordRels = updatedDiplomacy.relations.get(targetEmpireId);
        const vassalRels = updatedDiplomacy.relations.get(empireId);
        if (overlordRels && vassalRels) {
          const overlordRel = overlordRels.get(empireId);
          const vassalRel = vassalRels.get(targetEmpireId);
          if (overlordRel) {
            const overlordTreaty = overlordRel.treaties.find(t => t.type === 'vassalism');
            if (overlordTreaty) overlordTreaty.terms = { ...overlordTreaty.terms, isOverlord: 1 };
          }
          if (vassalRel) {
            const vassalTreaty = vassalRel.treaties.find(t => t.type === 'vassalism');
            if (vassalTreaty) vassalTreaty.terms = { ...vassalTreaty.terms, isOverlord: 0 };
          }
        }

        // Psychology: relief + subjugation
        if (state.psychStateMap) {
          recordDiplomaticEvent(state.psychStateMap, empireId, targetEmpireId, 'peace_made', tick);
          recordDiplomaticEvent(state.psychStateMap, targetEmpireId, empireId, 'peace_made', tick);
        }

        // Reputation: surrender is neutral (neither honoured nor dishonoured)
        if (state.reputationState) {
          let repState = recordReputationEvent(state.reputationState, {
            tick, empireId, type: 'peace_brokered', value: REPUTATION_EVENT_VALUES.peace_brokered,
            description: 'Surrendered as vassal',
          });
          repState = recordReputationEvent(repState, {
            tick, empireId: targetEmpireId, type: 'peace_brokered', value: REPUTATION_EVENT_VALUES.peace_brokered,
            description: 'Accepted vassal surrender',
          });
          state = { ...state, reputationState: repState };
        }

        return { ...state, diplomacyState: updatedDiplomacy };
      }

      // AI-to-player: offer vassalage surrender via notification with species voice
      const empireObj = state.gameState.empires.find(e => e.id === empireId);
      const empireName = empireObj?.name ?? empireId;
      const targetObj = state.gameState.empires.find(e => e.id === targetEmpireId);
      const targetName = targetObj?.name ?? targetEmpireId;
      const vassalVoice = getDiplomaticVoice(
        empireObj?.species?.id ?? '', 'vassalage_offer',
        { name: empireName, target: targetName },
      );
      const notification = createNotification(
        'diplomatic_proposal',
        vassalVoice.title,
        vassalVoice.body,
        tick,
        [
          { id: `accept_vassalism_${empireId}`, label: 'Accept Surrender', description: 'End the war — they become your vassal and pay tribute' },
          { id: `reject_vassalism_${empireId}`, label: 'Refuse', description: 'Continue the war — demand total annihilation' },
        ],
        { empireId, treatyType: 'vassalism' },
      );
      const existingNotifs = ((state as unknown as Record<string, unknown>).notifications ?? []) as ReturnType<typeof createNotification>[];
      return {
        ...state,
        notifications: [...existingNotifs, notification],
      } as typeof state;
    }

    // AI-to-AI: auto-accept if attitude > threshold
    const targetEmpire = state.gameState.empires.find(e => e.id === targetEmpireId);
    if (!targetEmpire) return state;

    if (targetEmpire.isAI) {
      // Try psychology-driven evaluation first, fall back to legacy
      const psychMap = state.psychStateMap;
      const targetPsych = psychMap?.get(targetEmpireId);

      let accepted = false;
      if (targetPsych && targetPsych.relationships[empireId]) {
        // Psychology-driven probabilistic evaluation
        const proposerRep = state.reputationState?.scores[empireId] ?? 0;
        const targetSpeciesId = targetEmpire.species?.id;
        const result = evaluateTreatyWithPsychology(targetPsych, empireId, treatyType, undefined, proposerRep, targetSpeciesId);
        accepted = result.accept;
      } else {
        // Legacy threshold-gated evaluation
        const proposerEmpire = state.gameState.empires.find(e => e.id === empireId);
        if (!proposerEmpire) return state;
        const relation = getRelation(diplomacyState, empireId, targetEmpireId);
        if (!relation) return state;
        const proposal = {
          fromEmpireId: empireId,
          toEmpireId: targetEmpireId,
          treatyType: treatyType as TreatyType,
        };
        const proposerRepLegacy = state.reputationState?.scores[empireId] ?? 0;
        const evalResult = evaluateTreatyProposal(
          proposerEmpire,
          targetEmpire,
          relation,
          proposal,
          proposerRepLegacy,
        );
        accepted = evalResult.accept;
      }
      if (!accepted) return state;

      // Accept: sign the treaty
      let updatedDiplomacy = proposeTreaty(diplomacyState, {
        fromEmpireId: empireId,
        toEmpireId: targetEmpireId,
        treatyType: treatyType as TreatyType,
      }, tick);

      // Peacetime vassalism: proposer is the overlord (they demanded subjugation),
      // target is the vassal (they submitted). Patch the asymmetric terms.
      if (treatyType === 'vassalism') {
        const overlordRels = updatedDiplomacy.relations.get(empireId);
        const vassalRels = updatedDiplomacy.relations.get(targetEmpireId);
        if (overlordRels && vassalRels) {
          const overlordRel = overlordRels.get(targetEmpireId);
          const vassalRel = vassalRels.get(empireId);
          if (overlordRel) {
            const t = overlordRel.treaties.find(t => t.type === 'vassalism');
            if (t) t.terms = { ...t.terms, isOverlord: 1 };
          }
          if (vassalRel) {
            const t = vassalRel.treaties.find(t => t.type === 'vassalism');
            if (t) t.terms = { ...t.terms, isOverlord: 0 };
          }
        }
      }

      // Fire psychology relationship events for both sides of the treaty
      const relEventType = mapTreatyToRelationshipEvent(treatyType);
      if (relEventType && state.psychStateMap) {
        recordDiplomaticEvent(state.psychStateMap, empireId, targetEmpireId, relEventType, tick);
        recordDiplomaticEvent(state.psychStateMap, targetEmpireId, empireId, relEventType, tick);
      }

      // Record treaty signing in the reputation system
      if (state.reputationState) {
        let repState = recordReputationEvent(state.reputationState, {
          tick, empireId, type: 'treaty_honoured', value: REPUTATION_EVENT_VALUES.treaty_honoured,
          description: `Signed ${treatyType} treaty`,
        });
        repState = recordReputationEvent(repState, {
          tick, empireId: targetEmpireId, type: 'treaty_honoured', value: REPUTATION_EVENT_VALUES.treaty_honoured,
          description: `Signed ${treatyType} treaty`,
        });
        state = { ...state, reputationState: repState };
      }

      return {
        ...state,
        diplomacyState: updatedDiplomacy,
      };
    }

    // AI-to-player: create a notification for the player to accept/reject
    const empireObj = state.gameState.empires.find(e => e.id === empireId);
    const empireName = empireObj?.name ?? empireId;
    const targetObj = state.gameState.empires.find(e => e.id === targetEmpireId);
    const targetName = targetObj?.name ?? targetEmpireId;

    // Vassalism demands get a distinct, more threatening notification
    const isVassalageDemand = treatyType === 'vassalism';
    const voiceSituation = isVassalageDemand ? 'vassalage_demand' as const : 'treaty_proposal' as const;
    const voice = getDiplomaticVoice(
      empireObj?.species?.id ?? '', voiceSituation,
      { name: empireName, target: targetName, treaty_type: treatyType.replace('_', ' ') },
    );
    const acceptLabel = isVassalageDemand ? 'Submit' : 'Accept';
    const acceptDesc = isVassalageDemand
      ? 'Become their vassal — pay tribute and serve'
      : `Sign the ${treatyType.replace('_', ' ')} treaty`;

    const notification = createNotification(
      'diplomatic_proposal',
      voice.title,
      voice.body,
      tick,
      [
        { id: `accept_${treatyType}_${empireId}`, label: acceptLabel, description: acceptDesc },
        { id: `reject_${treatyType}_${empireId}`, label: 'Decline', description: 'Refuse the proposal' },
      ],
      { systemId: '', empireId, treatyType },
    );

    const existingNotifs = ((state as unknown as Record<string, unknown>).notifications ?? []) as ReturnType<typeof createNotification>[];
    return {
      ...state,
      notifications: [...existingNotifs, notification],
    } as typeof state;
  }

  // Peace-seeking: AI makes peace when losing a war
  if (action === 'seek_peace') {
    const relation = getRelation(diplomacyState, empireId, targetEmpireId);
    if (!relation || relation.status !== 'at_war') return state;

    const targetEmpire = state.gameState.empires.find(e => e.id === targetEmpireId);
    if (!targetEmpire) return state;

    // AI-to-AI: auto-accept peace if the winner is also tired (attack ratio > 2 means dominant)
    if (targetEmpire.isAI) {
      // Winner accepts peace unless they're overwhelmingly dominant
      const updatedDiplomacy = makePeace(diplomacyState, empireId, targetEmpireId, tick);

      // Record psychology events for both sides — relief + lingering mistrust
      if (state.psychStateMap) {
        recordDiplomaticEvent(state.psychStateMap, empireId, targetEmpireId, 'peace_made', tick);
        recordDiplomaticEvent(state.psychStateMap, targetEmpireId, empireId, 'peace_made', tick);
      }

      // Record peace in the reputation system
      if (state.reputationState) {
        let repState = recordReputationEvent(state.reputationState, {
          tick, empireId, type: 'peace_brokered', value: REPUTATION_EVENT_VALUES.peace_brokered,
          description: 'Made peace',
        });
        repState = recordReputationEvent(repState, {
          tick, empireId: targetEmpireId, type: 'peace_brokered', value: REPUTATION_EVENT_VALUES.peace_brokered,
          description: 'Made peace',
        });
        state = { ...state, reputationState: repState };
      }

      return { ...state, diplomacyState: updatedDiplomacy };
    }

    // AI-to-player: offer peace via notification with species voice
    const empireObj = state.gameState.empires.find(e => e.id === empireId);
    const empireName = empireObj?.name ?? empireId;
    const targetObj = state.gameState.empires.find(e => e.id === targetEmpireId);
    const targetName = targetObj?.name ?? targetEmpireId;
    const peaceVoice = getDiplomaticVoice(
      empireObj?.species?.id ?? '', 'peace_offer',
      { name: empireName, target: targetName },
    );
    const notification = createNotification(
      'diplomatic_proposal',
      peaceVoice.title,
      peaceVoice.body,
      tick,
      [
        { id: `accept_peace_${empireId}`, label: 'Accept Peace', description: 'End the war and return to neutral relations' },
        { id: `reject_peace_${empireId}`, label: 'Refuse', description: 'Continue the war' },
      ],
      { empireId },
    );
    let notifications = [...((state as unknown as Record<string, unknown>).notifications as any[] ?? [])];
    notifications.push(notification);
    return { ...state, notifications } as GameTickState;
  }

  return state;
}

// ---------------------------------------------------------------------------
// War: AI declares war on another empire
// ---------------------------------------------------------------------------

function executeAIWar(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { targetEmpireId } = decision.params as { targetEmpireId: string };
  if (!targetEmpireId) return state;

  const diplomacyState = state.diplomacyState;
  if (!diplomacyState) return state;

  // Vassal action restriction: vassals cannot declare war on their overlord
  // or on the overlord's other vassals (allied network).
  const vassalRels = findVassalRelationships(diplomacyState);
  const overlord = getOverlord(empireId, vassalRels);
  if (overlord) {
    const overlordAllies = getVassals(overlord, vassalRels);
    if (isVassalActionRestricted('declare_war', empireId, targetEmpireId, overlord, overlordAllies)) {
      // Blocked — vassal cannot declare war on overlord or overlord's allies
      return state;
    }
  }

  const tick = state.gameState.currentTick;

  // Check we're not already at war
  const relation = getRelation(diplomacyState, empireId, targetEmpireId);
  if (!relation || relation.status === 'at_war') return state;

  // Execute the war declaration
  const updatedDiplomacy = declareWar(diplomacyState, empireId, targetEmpireId, tick);

  // Record asymmetric psychology events — aggressor vs target experience war differently
  if (state.psychStateMap) {
    recordDiplomaticEvent(state.psychStateMap, empireId, targetEmpireId, 'war_declared', tick);
    recordDiplomaticEvent(state.psychStateMap, targetEmpireId, empireId, 'war_declared_on_us', tick);
  }

  // Record war declaration in the reputation system (default to unjust war — no casus belli check yet)
  if (state.reputationState) {
    state = { ...state, reputationState: recordReputationEvent(state.reputationState, {
      tick, empireId, type: 'unjust_war', value: REPUTATION_EVENT_VALUES.unjust_war,
      description: 'Declared war',
    })};
  }

  // Notify the target empire (if it's the player) with species voice
  const targetEmpire = state.gameState.empires.find(e => e.id === targetEmpireId);
  const empireObj = state.gameState.empires.find(e => e.id === empireId);
  const empireName = empireObj?.name ?? empireId;
  const targetName = targetEmpire?.name ?? targetEmpireId;

  let notifications = ((state as unknown as Record<string, unknown>).notifications ?? []) as ReturnType<typeof createNotification>[];
  if (targetEmpire && !targetEmpire.isAI) {
    const warVoice = getDiplomaticVoice(
      empireObj?.species?.id ?? '', 'war_declaration',
      { name: empireName, target: targetName },
    );
    const notification = createNotification(
      'under_attack',
      warVoice.title,
      warVoice.body,
      tick,
      undefined,
      { empireId },
    );
    notifications = [...notifications, notification];
  }

  return {
    ...state,
    diplomacyState: updatedDiplomacy,
    notifications,
  } as GameTickState; // notifications is not yet on GameTickState
}

// ---------------------------------------------------------------------------
// Build: construct a building on an AI-owned planet
// ---------------------------------------------------------------------------

function executeAIBuild(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { planetId, buildingType, buildingId } = decision.params as {
    planetId: string;
    buildingType: string;
    buildingId?: string;
  };

  // If buildingId is present, this is an upgrade — route to the upgrade path
  if (buildingId) {
    return executeAIUpgrade(state, empireId, planetId, buildingId);
  }

  // Find the planet and its parent system
  let systems = state.gameState.galaxy.systems;
  let targetPlanet: Planet | undefined;
  for (const system of systems) {
    const p = system.planets.find(pl => pl.id === planetId);
    if (p) { targetPlanet = p; break; }
  }
  if (!targetPlanet) return state;

  // Ownership check — the AI must own this planet
  if (targetPlanet.ownerId !== empireId) return state;

  // Validate the build is allowed (pass species for racial building restrictions)
  const aiEmpire = state.gameState.empires.find(e => e.id === empireId);
  const empireResearchState = state.researchStates.get(empireId);
  const empireTechs = empireResearchState?.completedTechs ?? [];
  const buildCheck = canBuildOnPlanet(targetPlanet, buildingType as BuildingType, aiEmpire?.species, empireTechs);
  if (!buildCheck.allowed) return state;

  // Check affordability
  const buildDef = BUILDING_DEFINITIONS[buildingType as BuildingType];
  if (!buildDef) return state;
  const res = getEmpireResources(state, empireId);
  for (const [key, amount] of Object.entries(buildDef.baseCost)) {
    if (amount && amount > 0) {
      if ((res[key as keyof EmpireResources] ?? 0) < amount) return state;
    }
  }

  // Deduct costs
  for (const [key, amount] of Object.entries(buildDef.baseCost)) {
    if (amount && amount > 0) {
      res[key as keyof EmpireResources] -= amount;
    }
  }
  state = applyResources(state, empireId, res);
  systems = state.gameState.galaxy.systems;

  // Re-fetch the planet after resource update
  for (const system of systems) {
    const p = system.planets.find(pl => pl.id === planetId);
    if (p) { targetPlanet = p; break; }
  }
  if (!targetPlanet) return state;

  // Queue the building
  const updatedPlanet = addBuildingToQueue(targetPlanet, buildingType as BuildingType, undefined, empireTechs);
  systems = replacePlanet(systems, updatedPlanet);

  return {
    ...state,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Upgrade: upgrade an existing building on an AI-owned planet
// ---------------------------------------------------------------------------

function executeAIUpgrade(
  state: GameTickState,
  empireId: string,
  planetId: string,
  buildingId: string,
): GameTickState {
  // Find the planet
  let systems = state.gameState.galaxy.systems;
  let targetPlanet: Planet | undefined;
  for (const system of systems) {
    const p = system.planets.find(pl => pl.id === planetId);
    if (p) { targetPlanet = p; break; }
  }
  if (!targetPlanet) return state;

  // Ownership check
  if (targetPlanet.ownerId !== empireId) return state;

  // Determine current age for the empire
  const empire = state.gameState.empires.find(e => e.id === empireId);
  const currentAge = empire?.currentAge ?? 'nano_atomic';

  // Validate the upgrade is allowed
  const upgradeCheck = canUpgradeBuilding(targetPlanet, buildingId, currentAge);
  if (!upgradeCheck.allowed) return state;

  const building = targetPlanet.buildings.find(b => b.id === buildingId);
  if (!building) return state;

  const upgradeCost = getUpgradeCost(building.type, building.level);

  // Check affordability
  const res = getEmpireResources(state, empireId);
  for (const [key, amount] of Object.entries(upgradeCost)) {
    if (amount && amount > 0) {
      if ((res[key as keyof EmpireResources] ?? 0) < amount) return state;
    }
  }

  // Deduct costs
  for (const [key, amount] of Object.entries(upgradeCost)) {
    if (amount && amount > 0) {
      res[key as keyof EmpireResources] -= amount;
    }
  }
  state = applyResources(state, empireId, res);
  systems = state.gameState.galaxy.systems;

  // Re-fetch the planet after resource update
  for (const system of systems) {
    const p = system.planets.find(pl => pl.id === planetId);
    if (p) { targetPlanet = p; break; }
  }
  if (!targetPlanet) return state;

  // Queue the upgrade
  const planetWithUpgrade = addUpgradeToQueue(targetPlanet, buildingId, currentAge);
  systems = replacePlanet(systems, planetWithUpgrade);

  return {
    ...state,
    gameState: {
      ...state.gameState,
      galaxy: { ...state.gameState.galaxy, systems },
    },
  };
}

// ---------------------------------------------------------------------------
// Research: start researching a technology for the AI empire
// ---------------------------------------------------------------------------

function executeAIResearch(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
  allTechs: import('../types/technology.js').Technology[],
): GameTickState {
  const { techId } = decision.params as { techId: string };
  const researchState = state.researchStates.get(empireId);
  if (!researchState) return state;

  // Skip if already completed or actively researching
  if (researchState.completedTechs.includes(techId)) return state;
  if (researchState.activeResearch.some(a => a.techId === techId)) return state;

  // Count the empire's research labs (1 active project per lab)
  const empire = state.gameState.empires.find(e => e.id === empireId);
  if (!empire) return state;
  const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empireId);
  const labCount = ownedPlanets.reduce(
    (sum, p) => sum + p.buildings.filter(b => b.type === 'research_lab').length,
    0,
  );

  // If all slots are full, skip
  if (labCount > 0 && researchState.activeResearch.length >= labCount) return state;

  try {
    const updatedResearchState = startResearch(
      researchState,
      techId,
      allTechs,
      100, // allocation — auto-redistributed by startResearch
      empire.species.id,
      labCount,
    );

    const newResearchStates = new Map(state.researchStates);
    newResearchStates.set(empireId, updatedResearchState);

    return { ...state, researchStates: newResearchStates };
  } catch {
    // startResearch throws on invalid states — just skip
    return state;
  }
}

// ---------------------------------------------------------------------------
// Build Ship: queue ship production on a planet with a shipyard
// ---------------------------------------------------------------------------

function executeAIBuildShip(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { planetId, hullClass: requestedHull } = decision.params as {
    planetId: string;
    hullClass?: string;
  };

  // Verify the planet exists and has a shipyard owned by this empire
  let systems = state.gameState.galaxy.systems;
  let targetPlanet: Planet | undefined;
  let parentSystemId: string | undefined;
  for (const system of systems) {
    const p = system.planets.find(pl => pl.id === planetId);
    if (p) { targetPlanet = p; parentSystemId = system.id; break; }
  }
  if (!targetPlanet || !parentSystemId) return state;
  if (targetPlanet.ownerId !== empireId) return state;

  const hasShipyard = targetPlanet.buildings.some(b => b.type === 'shipyard');
  if (!hasShipyard) return state;

  // Don't queue more ships if there are already 2+ orders for this planet
  // Exception: coloniser/scout builds can use a 3rd slot to prevent warships from starving expansion
  const pendingForPlanet = state.productionOrders.filter(o => o.planetId === planetId).length;
  const maxQueue = (requestedHull?.startsWith('coloniser') || requestedHull === 'patrol' || requestedHull === 'science_probe') ? 3 : 2;
  if (pendingForPlanet >= maxQueue) return state;

  // Find an available design for this empire
  const empire = state.gameState.empires.find(e => e.id === empireId);
  if (!empire) return state;
  const designsMap = state.shipDesigns ?? new Map<string, ShipDesign>();
  const empireDesigns = Array.from(designsMap.values()).filter(d => d.empireId === empireId);

  // Pick a design matching the requested hull class, or fall back to combat ships
  let chosenDesign: ShipDesign | undefined;
  if (requestedHull) {
    chosenDesign = empireDesigns.find(d => d.hull === requestedHull);
    // If no design exists for the requested hull, auto-generate one
    if (!chosenDesign) {
      const startingComponents = (state.shipComponents ?? []).filter(
        (c: { requiredTech: string | null }) => c.requiredTech === null,
      );
      const newDesigns = generateDefaultDesigns(
        empire.currentAge, empireId, designsMap, startingComponents,
      );
      chosenDesign = newDesigns.find(d => d.hull === requestedHull);
      if (chosenDesign) {
        const updatedDesigns = new Map(designsMap);
        for (const d of newDesigns) updatedDesigns.set(d.id, d);
        state = { ...state, shipDesigns: updatedDesigns };
      }
    }
  }
  if (!chosenDesign) {
    chosenDesign = empireDesigns.find(d => d.hull === 'destroyer')
      ?? empireDesigns.find(d => d.hull === 'light_cruiser')
      ?? empireDesigns.find(d => d.hull === 'patrol')
      ?? empireDesigns[0];
  }
  if (!chosenDesign) return state;

  // Check if we can afford a ship
  const shipCost = chosenDesign.totalCost > 0 ? chosenDesign.totalCost : 50;
  const res = getEmpireResources(state, empireId);
  if (res.credits < shipCost) return state;

  // Deduct cost
  res.credits -= shipCost;
  state = applyResources(state, empireId, res);

  // Queue the production order (build time scales with cost, minimum 3 ticks)
  // Uses same formula as player path (baseCost / 100) to keep AI & player parity
  const buildTime = Math.max(3, Math.round(shipCost / 100));
  const order = startShipProduction(chosenDesign.id, planetId, buildTime);

  return {
    ...state,
    productionOrders: [...state.productionOrders, order],
  };
}

// ---------------------------------------------------------------------------
// Move Fleet: issue a movement order for an AI fleet
// ---------------------------------------------------------------------------

function executeAIMoveFleet(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { fleetId, destinationSystemId } = decision.params as {
    fleetId: string;
    destinationSystemId: string;
  };

  const fleet = state.gameState.fleets.find(f => f.id === fleetId && f.empireId === empireId);
  if (!fleet) return state;

  // Don't issue a new order if this fleet already has one
  if (state.movementOrders.some(o => o.fleetId === fleetId)) return state;

  const empire = state.gameState.empires.find(e => e.id === empireId);
  const order = issueMovementOrder(
    fleet,
    state.gameState.galaxy,
    destinationSystemId,
    undefined,
    empire?.technologies,
  );
  if (!order) return state;

  return {
    ...state,
    movementOrders: [...state.movementOrders, order],
  };
}

// ---------------------------------------------------------------------------
// Recruit Spy: AI recruits a new spy agent and assigns it to a rival
// ---------------------------------------------------------------------------

function executeAIRecruitSpy(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { targetEmpireId, mission } = decision.params as {
    targetEmpireId: string;
    mission: SpyMission;
  };

  const empire = state.gameState.empires.find(e => e.id === empireId);
  if (!empire) return state;

  // Check the AI can afford a spy
  const res = getEmpireResources(state, empireId);
  if (res.credits < SPY_RECRUIT_COST) return state;

  // Limit AI to 3 active agents to prevent spam
  const existingAgents = state.espionageState.agents.filter(
    a => a.empireId === empireId && (a.status === 'infiltrating' || a.status === 'active'),
  );
  if (existingAgents.length >= 3) return state;

  // Deduct cost
  res.credits -= SPY_RECRUIT_COST;
  let s = applyResources(state, empireId, res);

  // Create and assign the agent
  let agent = recruitSpy(empireId, empire.species);
  if (targetEmpireId) {
    agent = assignMission(agent, targetEmpireId, mission);
  }

  return {
    ...s,
    espionageState: addAgentToState(s.espionageState, agent),
  };
}

// ---------------------------------------------------------------------------
// Assign Spy: reassign idle AI agents to a target
// ---------------------------------------------------------------------------

function executeAIAssignSpy(
  state: GameTickState,
  empireId: string,
  decision: AIDecision,
): GameTickState {
  const { targetEmpireId, mission } = decision.params as {
    targetEmpireId: string;
    mission: SpyMission;
  };
  if (!targetEmpireId) return state;

  // Find idle agents (infiltrating/active agents with no target)
  const idleAgent = state.espionageState.agents.find(
    a => a.empireId === empireId
      && (a.status === 'infiltrating' || a.status === 'active')
      && !a.targetEmpireId,
  );
  if (!idleAgent) return state;

  const updated = assignMission(idleAgent, targetEmpireId, mission);
  return {
    ...state,
    espionageState: {
      ...state.espionageState,
      agents: state.espionageState.agents.map(a => a.id === idleAgent.id ? updated : a),
      counterIntelLevel: new Map(state.espionageState.counterIntelLevel),
    },
  };
}

// ---------------------------------------------------------------------------
// Step 9b: Waste Processing
// ---------------------------------------------------------------------------

/**
 * For each owned planet, calculate waste production, reduction, and overflow.
 * Updates `wasteMap` in the tick state with each planet's current waste state.
 */
function stepWaste(state: GameTickState): GameTickState {
  const wasteMap = new Map(state.wasteMap);

  for (const empire of state.gameState.empires) {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);

    for (const planet of ownedPlanets) {
      const previousWasteState = wasteMap.get(planet.id);
      const currentWaste = previousWasteState?.currentWaste ?? 0;
      const wasteCapacity = calculateWasteCapacity(planet.type);

      const grossWaste = calculateWasteProduction(
        planet.buildings,
        planet.currentPopulation,
      );
      const reduction = calculateWasteReduction(planet.buildings, grossWaste);

      const wasteState = tickWaste(
        currentWaste,
        wasteCapacity,
        grossWaste,
        reduction,
      );

      wasteMap.set(planet.id, wasteState);
    }
  }

  return { ...state, wasteMap };
}

// ---------------------------------------------------------------------------
// Step 9c: Building Condition
// ---------------------------------------------------------------------------

/**
 * For each owned planet, for each building, tick condition.
 * If an empire can afford maintenance the building holds; otherwise it decays.
 * Updates the buildings array on each planet (immutably) and writes condition
 * values back into the galaxy state.
 */
// ---------------------------------------------------------------------------
// Step 9e: Galactic Events (solar storms, asteroid showers, etc.)
// ---------------------------------------------------------------------------

function stepGalacticEvents(state: GameTickState, events: GameEvent[]): GameTickState {
  const tick = state.gameState.currentTick;
  const activeEvents = ((state as unknown as Record<string, unknown>).galacticEvents ?? []) as GalacticEvent[];
  const systemIds = state.gameState.galaxy.systems.map(s => s.id);

  const result = processGalacticEvents(activeEvents, tick, systemIds.length, systemIds);

  if (result.newEvent) {
    const evt = result.newEvent;
    const notifications = [...((state as unknown as Record<string, unknown>).notifications as any[] ?? [])];
    notifications.push(
      createNotification(
        'galactic_event',
        evt.name,
        evt.description,
        tick,
      ),
    );
    return {
      ...state,
      galacticEvents: result.activeEvents,
      notifications,
    } as GameTickState;
  }

  return {
    ...state,
    galacticEvents: result.activeEvents,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 9c: Building Condition
// ---------------------------------------------------------------------------

function stepBuildingCondition(state: GameTickState): GameTickState {
  let systems = state.gameState.galaxy.systems;

  for (const empire of state.gameState.empires) {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    const resources = getEmpireResources(state, empire.id);

    // Determine whether the empire can pay maintenance at all.
    // Maintenance is already deducted in the upkeep step.  Here we check
    // whether the empire has positive credits — if they are at zero, the
    // upkeep was not fully covered, so maintenance is unpaid for ALL
    // buildings this tick.  This is a simplified model; a more granular
    // per-building deduction could follow later.
    const canPayMaintenance = resources.credits > 0;

    for (const planet of ownedPlanets) {
      let buildingsChanged = false;
      const updatedBuildings = planet.buildings.map(building => {
        const def = BUILDING_DEFINITIONS[building.type as BuildingType] as BuildingDefinition | undefined;
        const newCondition = tickBuildingCondition(building, canPayMaintenance, def);
        const currentCondition = building.condition ?? 100;

        if (Math.abs(newCondition - currentCondition) > 0.0001) {
          buildingsChanged = true;
          return { ...building, condition: newCondition };
        }
        return building;
      });

      if (buildingsChanged) {
        const updatedPlanet = { ...planet, buildings: updatedBuildings };
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

  // Extract council leader for dominance victory check
  const orgState = (state as unknown as Record<string, unknown>).organisationState as
    | { organisations: Array<{ memberEmpires: string[]; votingPower: Record<string, number> }> }
    | undefined;
  // Find the largest organisation's leader (if senate state exists on psychStateMap)
  let councilLeaderId: string | null = null;
  if (orgState && orgState.organisations.length > 0) {
    // Use the first (largest) organisation as the "Galactic Council"
    const mainOrg = orgState.organisations.reduce((a, b) =>
      a.memberEmpires.length >= b.memberEmpires.length ? a : b,
    );
    // Check psychStateMap for senate leadership
    const psychMap = state.psychStateMap;
    // The senate state isn't directly on the org — check if any empire is marked as leader
    // For now, use the empire with the highest voting power in the largest org as a proxy
    let highestPower = 0;
    for (const [empireId, power] of Object.entries(mainOrg.votingPower)) {
      if (power > highestPower) {
        highestPower = power;
        councilLeaderId = empireId;
      }
    }
  }

  const result = checkVictoryConditions(
    state.gameState,
    state.empireResourcesMap,
    state.economicLeadTicks,
    state.allTechCount,
    councilLeaderId,
  );

  if (result) {
    return { over: true, winnerId: result.winner, reason: result.condition };
  }

  return { over: false };
}

// ---------------------------------------------------------------------------
// Step 3e: Corruption, Wealth, Employment, Crime
// ---------------------------------------------------------------------------

/**
 * Process one tick of corruption, wealth distribution, employment, and crime
 * for every empire.
 *
 * This step is safe with older saves: if the state does not yet contain
 * corruptionStates or if planets lack demographics data, it no-ops gracefully.
 *
 * Side-effect: produces CorruptionEvent entries which are currently logged
 * internally (the corruption event type is not part of GameEvent yet, so
 * they are not pushed to the main events array).
 */
function stepCorruption(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no corruption data structures yet (old saves)
  const corruptionStates = (state as unknown as Record<string, unknown>).corruptionStates as
    | Map<string, EmpireCorruptionState>
    | undefined;
  if (!corruptionStates) return state;

  const updatedCorruptionStates = new Map(corruptionStates);
  const tick = state.gameState.currentTick;

  for (const empire of state.gameState.empires) {
    const empireCorruption = updatedCorruptionStates.get(empire.id) ?? {
      planets: {},
      governors: {},
      averageCorruption: 0,
    };

    // Build planet data for corruption engine — requires demographics
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    // If no planets have demographics, skip corruption for this empire
    const planetsWithDemographics: Record<
      string,
      {
        buildings: import('../types/galaxy.js').Building[];
        demographics: import('../types/demographics.js').PlanetDemographics;
        governmentType: import('../types/government.js').GovernmentType;
        distanceFromCapital: number;
      }
    > = {};

    let hasDemographics = false;
    for (const planet of ownedPlanets) {
      const demographics = (planet as unknown as Record<string, unknown>).demographics as
        | import('../types/demographics.js').PlanetDemographics
        | undefined;
      if (!demographics) continue;
      hasDemographics = true;
      planetsWithDemographics[planet.id] = {
        buildings: planet.buildings,
        demographics,
        governmentType: empire.government,
        distanceFromCapital: 0, // TODO: calculate once system graph distances are available
      };
    }

    if (!hasDemographics) continue;

    // Build governors lookup keyed by planet ID
    const governorsMap: Record<string, Governor> = {};
    for (const gov of state.governors) {
      if (gov.planetId && planetsWithDemographics[gov.planetId]) {
        governorsMap[gov.planetId] = gov;
      }
    }

    const result = processCorruptionTick(
      empireCorruption,
      planetsWithDemographics,
      governorsMap,
      tick,
      Math.random,
    );

    updatedCorruptionStates.set(empire.id, result.corruption);
    // Corruption events are engine-internal for now; they will be surfaced
    // as GameEvent variants once the notification system is extended.
  }

  return {
    ...state,
    corruptionStates: updatedCorruptionStates,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 8c: Minor Species
// ---------------------------------------------------------------------------

/**
 * Process one tick of minor species interactions for all known species.
 *
 * Safe no-op if the state does not contain a minorSpecies array (old saves).
 */
function stepMinorSpecies(state: GameTickState, _events: GameEvent[]): GameTickState {
  const minorSpeciesList = (state as unknown as Record<string, unknown>).minorSpecies as
    | import('../types/minor-species.js').MinorSpecies[]
    | undefined;
  if (!minorSpeciesList || minorSpeciesList.length === 0) return state;

  const tick = state.gameState.currentTick;
  const updatedSpecies: import('../types/minor-species.js').MinorSpecies[] = [];

  for (const species of minorSpeciesList) {
    // Determine which empire (if any) currently owns the planet this species resides on
    let ownerEmpireId: string | null = null;
    for (const system of state.gameState.galaxy.systems) {
      for (const planet of system.planets) {
        if (planet.id === species.planetId) {
          ownerEmpireId = planet.ownerId;
        }
      }
    }

    const result = processMinorSpeciesTick(species, ownerEmpireId, tick, Math.random);
    updatedSpecies.push(result.species);
    // Minor species events are engine-internal for now.
  }

  return {
    ...state,
    minorSpecies: updatedSpecies,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 8d: Anomaly Investigations
// ---------------------------------------------------------------------------

/**
 * Progress all active excavation sites by one tick.
 *
 * Safe no-op if the state does not contain an excavationSites array (old saves).
 */
function stepAnomalies(state: GameTickState, _events: GameEvent[]): GameTickState {
  const excavationSites = (state as unknown as Record<string, unknown>).excavationSites as
    | ExcavationSite[]
    | undefined;
  if (!excavationSites || excavationSites.length === 0) return state;

  const updatedSites: ExcavationSite[] = [];

  for (const site of excavationSites) {
    const result = progressExcavation(site, Math.random);
    updatedSites.push(result.site);
    // Anomaly events are engine-internal for now.
  }

  return {
    ...state,
    excavationSites: updatedSites,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 9d: Marketplace
// ---------------------------------------------------------------------------

/**
 * Process one tick of the commodity marketplace (local + galactic).
 *
 * Safe no-op if the state does not contain a marketState (old saves).
 */
function stepMarketplace(state: GameTickState, _events: GameEvent[]): GameTickState {
  const marketState = (state as unknown as Record<string, unknown>).marketState as
    | MarketState
    | undefined;
  if (!marketState) return state;

  const tick = state.gameState.currentTick;

  // Build empire views for the marketplace engine
  const empireViews: MarketEmpireView[] = state.gameState.empires.map(empire => {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    const resources = getEmpireResources(state, empire.id);

    let tradeHubCount = 0;
    let factoryCount = 0;
    let miningFacilityCount = 0;
    let researchLabCount = 0;
    let shipyardCount = 0;
    let totalPopulation = 0;

    for (const planet of ownedPlanets) {
      totalPopulation += planet.currentPopulation;
      for (const building of planet.buildings) {
        switch (building.type) {
          case 'trade_hub':       tradeHubCount++;       break;
          case 'factory':         factoryCount++;        break;
          case 'mining_facility': miningFacilityCount++; break;
          case 'research_lab':    researchLabCount++;    break;
          case 'shipyard':        shipyardCount++;       break;
        }
      }
    }

    return {
      id: empire.id,
      credits: resources.credits,
      totalPopulation,
      tradeHubCount,
      factoryCount,
      miningFacilityCount,
      researchLabCount,
      shipyardCount,
      isBlockaded: false, // TODO: derive from fleet blockade state once available
    };
  });

  // Build trade route views from existing trade routes.
  // BasicTradeRoute uses origin/destination system IDs rather than a partner
  // empire ID, so we resolve the partner by looking up system ownership.
  const tradeRouteViews: MarketTradeRouteView[] = state.tradeRoutes.map(route => {
    // Find the empire that owns the destination system (approximation)
    let partnerEmpireId = route.empireId;
    for (const system of state.gameState.galaxy.systems) {
      if (system.id === route.destinationSystemId) {
        for (const planet of system.planets) {
          if (planet.ownerId && planet.ownerId !== route.empireId) {
            partnerEmpireId = planet.ownerId;
            break;
          }
        }
        break;
      }
    }
    return {
      empireId: route.empireId,
      partnerEmpireId,
      status: 'active' as const, // TODO: derive disrupted/blockaded status once available
    };
  });

  const result = processMarketTick(
    marketState,
    empireViews,
    tradeRouteViews,
    tick,
    Math.random,
  );

  return {
    ...state,
    marketState: result.state,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 3a: Healthcare Processing
// ---------------------------------------------------------------------------

/**
 * Process one tick of healthcare for every empire's planets.
 *
 * Safe no-op if the state does not contain a diseaseStates field (old saves).
 * Checks pandemic triggers, generates new diseases, and spreads active
 * diseases along trade routes.
 */
function stepHealthcare(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no disease data structures yet (old saves)
  const diseaseStates = (state as unknown as Record<string, unknown>).diseaseStates as
    | Map<string, Disease[]>
    | undefined;
  if (!diseaseStates) return state;

  const tick = state.gameState.currentTick;
  const updatedDiseases = new Map(diseaseStates);

  for (const empire of state.gameState.empires) {
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);

    for (const planet of ownedPlanets) {
      const demographics = (planet as unknown as Record<string, unknown>).demographics as
        | import('../types/demographics.js').PlanetDemographics
        | undefined;
      if (!demographics) continue;

      // Retrieve healthcare policy (default to 'semi_subsidised' for old saves)
      const healthcarePolicy = ((empire as unknown as Record<string, unknown>).healthcarePolicy as
        | HealthcarePolicy
        | undefined) ?? 'semi_subsidised';

      // Process healthcare tick for this planet
      processHealthcareTick(
        planet,
        demographics,
        planet.buildings,
        healthcarePolicy,
        tick,
        Math.random,
      );

      // Check pandemic trigger
      if (checkPandemicTrigger(planet, demographics, Math.random)) {
        const speciesId = (planet as unknown as Record<string, unknown>).speciesId as string | undefined;
        if (speciesId) {
          const abilities = ((empire as unknown as Record<string, unknown>).specialAbilities as
            | import('../types/species.js').SpecialAbility[]
            | undefined) ?? [];
          const biology = inferBiology(abilities);
          const severity = Math.max(1, Math.min(10, Math.floor(Math.random() * 6) + 3));
          const newDisease = generateDisease(speciesId, biology, severity, Math.random, 'natural', planet.id, tick);
          const planetDiseases = updatedDiseases.get(planet.id) ?? [];
          planetDiseases.push(newDisease);
          updatedDiseases.set(planet.id, planetDiseases);
        }
      }
    }
  }

  // Spread active diseases along trade routes
  // (simplified: iterate all diseases and attempt spread)
  // Healthcare events are engine-internal for now.

  return {
    ...state,
    diseaseStates: updatedDiseases,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 3c+: Politics Processing
// ---------------------------------------------------------------------------

/**
 * Process one tick of political factions for every empire.
 *
 * Safe no-op if the state does not contain politicalStates (old saves).
 * Initialises political state for empires that lack one.
 * Runs elections for democratic government types every ELECTION_INTERVAL ticks.
 */
function stepPolitics(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no political data structures yet (old saves)
  const politicalStates = (state as unknown as Record<string, unknown>).politicalStates as
    | Map<string, EmpirePoliticalState>
    | undefined;
  if (!politicalStates) return state;

  const tick = state.gameState.currentTick;
  const updatedPoliticalStates = new Map(politicalStates);

  for (const empire of state.gameState.empires) {
    // Initialise political state if missing for this empire
    let empirePolState = updatedPoliticalStates.get(empire.id);
    if (!empirePolState) {
      const speciesId = (empire as unknown as Record<string, unknown>).speciesId as string | undefined;
      empirePolState = initialisePoliticalState(
        empire.id,
        speciesId ?? 'generic',
        empire.government,
        tick,
      );
    }

    // Aggregate demographics across the empire's planets
    const ownedPlanets = getEmpirePlanets(state.gameState.galaxy, empire.id);
    let hasDemographics = false;
    let aggregatedDemographics: import('../types/demographics.js').PlanetDemographics | undefined;

    for (const planet of ownedPlanets) {
      const demographics = (planet as unknown as Record<string, unknown>).demographics as
        | import('../types/demographics.js').PlanetDemographics
        | undefined;
      if (!demographics) continue;
      hasDemographics = true;
      // Use first planet with demographics as a representative (simplification)
      if (!aggregatedDemographics) {
        aggregatedDemographics = demographics;
      }
    }

    if (hasDemographics && aggregatedDemographics) {
      const result = processPoliticalTick(
        empirePolState,
        aggregatedDemographics,
        empire.government,
        tick,
        Math.random as RNG,
      );
      empirePolState = result.state;
      // Political events are engine-internal for now.

      // Elections for democratic government types every ELECTION_INTERVAL ticks
      if (tick > 0 && tick % ELECTION_INTERVAL === 0) {
        const electoralGovernments = new Set(['democracy', 'republic', 'federation', 'equality']);
        if (electoralGovernments.has(empire.government)) {
          const electionResult = processElection(empirePolState, aggregatedDemographics, Math.random as RNG);
          empirePolState = electionResult.state;
          // Election events are engine-internal for now.
        }
      }
    }

    updatedPoliticalStates.set(empire.id, empirePolState);
  }

  return {
    ...state,
    politicalStates: updatedPoliticalStates,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 8+: Grievance Processing
// ---------------------------------------------------------------------------

/**
 * Process one tick of inter-empire grievance decay.
 *
 * Safe no-op if the state does not contain a grievances array (old saves).
 * Decays all grievances and removes expired ones.
 */
function stepGrievances(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no grievance data yet (old saves)
  const grievances = (state as unknown as Record<string, unknown>).grievances as
    | Grievance[]
    | undefined;
  if (!grievances) return state;

  const tick = state.gameState.currentTick;
  const result = processGrievanceTick(grievances, tick);

  return {
    ...state,
    grievances: result.grievances,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 8+: Diplomat Character Processing
// ---------------------------------------------------------------------------

/**
 * Process one tick of diplomat character progression.
 *
 * Safe no-op if the state does not contain a diplomats array (old saves).
 * Advances experience, adjusts loyalty, and collects events.
 */
function stepDiplomatCharacters(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no diplomat data yet (old saves)
  const diplomats = (state as unknown as Record<string, unknown>).diplomats as
    | Diplomat[]
    | undefined;
  if (!diplomats) return state;

  const tick = state.gameState.currentTick;
  const updatedDiplomats: Diplomat[] = [];

  for (const diplomat of diplomats) {
    const result = processDiplomatTick(diplomat, tick, Math.random);
    updatedDiplomats.push(result.diplomat);
    // Diplomat events are engine-internal for now.
  }

  return {
    ...state,
    diplomats: updatedDiplomats,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 8b+: Galactic Organisations Processing
// ---------------------------------------------------------------------------

/**
 * Process one tick of galactic organisations (council/federation mechanics).
 *
 * Safe no-op if the state does not contain organisationState (old saves).
 * Processes membership changes, resolution votes, and checks if new
 * organisations can form between empires with mutual contact.
 */
function stepGalacticOrganisations(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no organisation data yet (old saves)
  const organisationState = (state as unknown as Record<string, unknown>).organisationState as
    | GalacticOrganisationState
    | undefined;
  if (!organisationState) return state;

  const diplomacyState = state.diplomacyState;
  if (!diplomacyState) return state;

  const tick = state.gameState.currentTick;
  const empires = state.gameState.empires;

  // Process existing organisations
  const result = processOrganisationTick(organisationState, empires, diplomacyState, tick);
  let updatedOrgState = result.state;

  // Check if new organisations can form (pairs of unaffiliated empires with mutual contact)
  for (let i = 0; i < empires.length; i++) {
    for (let j = i + 1; j < empires.length; j++) {
      if (canFormOrganisation(empires[i].id, empires[j].id, diplomacyState, updatedOrgState)) {
        // Formation is possible — for now, log opportunity but do not auto-form.
        // AI empires may choose to form organisations via their decision step.
      }
    }
  }

  // Organisation events are engine-internal for now.

  return {
    ...state,
    organisationState: updatedOrgState,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 8b++: Galactic Bank Processing
// ---------------------------------------------------------------------------

/**
 * Process one tick of the galactic bank (loan interest accrual, defaults).
 *
 * Safe no-op if the state does not contain bankState (old saves).
 */
function stepGalacticBank(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no bank data yet (old saves)
  const bankState = (state as unknown as Record<string, unknown>).bankState as
    | GalacticBank
    | undefined;
  if (!bankState) return state;

  const tick = state.gameState.currentTick;
  const result = processLoanTick(bankState, tick);

  // Bank events are engine-internal for now.

  return {
    ...state,
    bankState: result.bank,
  } as GameTickState;
}

// ---------------------------------------------------------------------------
// Step 8d+: Narrative Chain Processing
// ---------------------------------------------------------------------------

/**
 * Process one tick of narrative event chains.
 *
 * Safe no-op if the state does not contain narrativeProgress (old saves).
 * Checks for completed excavation stages and starts newly available chains.
 */
function stepNarrativeChains(state: GameTickState, _events: GameEvent[]): GameTickState {
  // Guard: skip if the state has no narrative data yet (old saves)
  const narrativeProgress = (state as unknown as Record<string, unknown>).narrativeProgress as
    | NarrativeChainProgress[]
    | undefined;
  if (!narrativeProgress) return state;

  const allChains = (state as unknown as Record<string, unknown>).narrativeChains as
    | NarrativeChain[]
    | undefined;
  if (!allChains || allChains.length === 0) return state;

  const tick = state.gameState.currentTick;
  const updatedProgress = [...narrativeProgress];

  // For each empire, check if new narrative chains should trigger
  for (const empire of state.gameState.empires) {
    // Gather empire's discovered anomaly types from excavation sites
    const excavationSites = (state as unknown as Record<string, unknown>).excavationSites as
      | ExcavationSite[]
      | undefined;

    const discoveredTypes: import('../types/anomaly.js').AnomalyType[] = [];
    let totalDiscovered = 0;
    if (excavationSites) {
      for (const site of excavationSites) {
        if (site.discoveredByEmpireId === empire.id &&
            site.currentStage === 'complete') {
          if (site.type && !discoveredTypes.includes(site.type)) {
            discoveredTypes.push(site.type);
          }
          totalDiscovered++;
        }
      }
    }

    // Get IDs of chains already active or completed for this empire
    const activeOrCompletedIds = updatedProgress
      .filter(p => p.empireId === empire.id)
      .map(p => p.chainId);

    // Check for newly available chains
    const available = getAvailableChains(
      allChains,
      discoveredTypes,
      activeOrCompletedIds,
      (empire as unknown as Record<string, unknown>).speciesId as string ?? '',
      empire.technologies,
      totalDiscovered,
    );

    // Start any newly available chains
    for (const chain of available) {
      const progress = startChain(chain, empire.id, tick);
      updatedProgress.push(progress);
    }
  }

  return {
    ...state,
    narrativeProgress: updatedProgress,
  } as GameTickState;
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
  playerEmpireId?: string,
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

  // 1b. Ship Repair (ships at friendly systems with spaceports heal)
  s = stepShipRepair(s);

  // 1b+. Supply Consumption (manned ships in deep space use supplies; friendly systems resupply)
  s = stepSupplyConsumption(s);

  // 1c. Orbital Debris Processing (decay, damage, cascade)
  s = stepOrbitalDebris(s);

  // 2. Combat Resolution (may create new debris from destroyed ships)
  s = stepCombatResolution(s, events, playerEmpireId);

  // 2b. Unopposed occupation — fleets in enemy systems with no enemy fleet
  s = stepUnopposedOccupation(s, events);

  // 3. Population Growth
  s = stepPopulationGrowth(s);

  // 3a. Healthcare Processing (disease, pandemics, medical infrastructure)
  s = stepHealthcare(s, events);

  // 3b. Migration Processing (after population growth so wave logistics are current)
  s = stepMigrations(s, events);

  // 3c-pre. War State Processing (advance weariness before happiness uses it)
  s = stepWarState(s);

  // 3c. Happiness Processing (revolt population loss; production multipliers collected next step)
  s = stepHappiness(s);

  // 3d. Politics Processing (factions, elections, policy drift)
  s = stepPolitics(s, events);

  // 3e. Corruption, Wealth, Employment, Crime (after happiness so unrest data is current)
  s = stepCorruption(s, events);

  // 3f. Governor ageing (age all governors; emit GovernorDied for those that expire)
  s = stepGovernors(s, events);

  // 3g. Empire leader ageing (Head of Research, Spy Master, Admiral, General)
  s = stepLeaders(s, events);

  // 4. Resource Production (applies happiness production multipliers, governor modifiers, and energy deficit penalties)
  s = stepResourceProduction(s);

  // 4b. Food Consumption (deduct organics; apply starvation loss if starving)
  s = stepFoodConsumption(s);

  // 5. Construction Queues
  s = stepConstructionQueues(s);

  // 5a. Governor Auto-Build (queue next build for planets with autoManage governors)
  s = stepGovernorAutoBuild(s);

  // 5b. Terraforming (after construction so newly built stations take effect next tick)
  s = stepTerraforming(s, events);

  // 6. Ship Production
  s = stepShipProduction(s);

  // 7. Research Progress
  s = stepResearch(s, allTechs, events);

  // 8. Diplomacy Tick (attitude decay, treaty expiry, status recalc)
  s = stepDiplomacyTick(s);

  // 8a. Grievance Processing (decay inter-empire grievances, remove expired)
  s = stepGrievances(s, events);

  // 8a+++. Demand expiration
  if (s.demandState) {
    const { state: updatedDemands, expired } = processDemandsTick(s.demandState, s.gameState.currentTick);
    s = { ...s, demandState: updatedDemands };
    // Expired demands = ignored, creates grievance for the demander
    for (const demand of expired) {
      if (s.diplomacyState) {
        s = { ...s, diplomacyState: modifyAttitude(s.diplomacyState, demand.proposerId, demand.targetId, -5, 'demand_ignored', s.gameState.currentTick) };
      }
      // Psychology: ignored_request event
      if (s.psychStateMap) {
        recordDiplomaticEvent(s.psychStateMap, demand.targetId, demand.proposerId, 'ignored_request', s.gameState.currentTick);
      }
      // Reputation: minor hit for ignoring (but not as bad as explicit rejection)
      if (s.reputationState) {
        s = { ...s, reputationState: recordReputationEvent(s.reputationState, {
          tick: s.gameState.currentTick, empireId: demand.targetId, type: 'treaty_broken',
          value: -3, description: 'Ignored diplomatic demand',
        })};
      }
    }
  }

  // 8a+. Diplomat Characters (experience, loyalty drift, skill progression)
  s = stepDiplomatCharacters(s, events);

  // 8b. Espionage Tick (spy infiltration, mission rolls, counter-intel)
  s = stepEspionage(s, events);

  // 8b+. Galactic Organisations (council membership, resolution votes, formation)
  s = stepGalacticOrganisations(s, events);

  // 8b++. Galactic Bank (loan interest accrual, default checks)
  s = stepGalacticBank(s, events);

  // 8c. Minor Species (integration, uplift, revolt, natural advancement)
  s = stepMinorSpecies(s, events);

  // 8d. Anomaly Investigations (progress active excavation sites)
  s = stepAnomalies(s, events);

  // 8e. Narrative Chains (trigger and progress multi-step exploration stories)
  s = stepNarrativeChains(s, events);

  // 8f. Psychology Tick (Maslow needs → stress → mood → effective traits)
  s = stepPsychology(s);

  // 8f+. Sync psychology sentiments back to legacy diplomacy attitudes
  if (s.diplomacyState && s.psychStateMap) {
    s = {
      ...s,
      diplomacyState: syncPsychologyToDiplomacy(s.psychStateMap, s.diplomacyState, s.gameState.currentTick),
    };
  }

  // 8g. Reputation decay (drift scores toward neutral)
  if (s.reputationState) {
    s = { ...s, reputationState: processReputationTick(s.reputationState, s.gameState.currentTick) };
  }

  // 8g+. Cultural friction — incompatible species sharing systems generate tension.
  // Runs every 10 ticks with a 20% chance per pair to avoid constant friction.
  const culturalTick = s.gameState.currentTick;
  if (culturalTick % 10 === 0 && s.psychStateMap && s.diplomacyState) {
    const culturalPsych = s.psychStateMap;
    const culturalDip = s.diplomacyState;
    const empiresArr = s.gameState.empires;
    const culturalSystems = s.gameState.galaxy.systems;
    // For each system with planets owned by multiple empires, check species affinity
    for (const sys of culturalSystems) {
      const presentEmpireIds = new Set<string>();
      for (const p of sys.planets) {
        if (p.ownerId) presentEmpireIds.add(p.ownerId);
      }
      if (presentEmpireIds.size < 2) continue;
      // Check each unique pair
      const ids = Array.from(presentEmpireIds);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const eA = empiresArr.find(e => e.id === ids[i]);
          const eB = empiresArr.find(e => e.id === ids[j]);
          if (!eA || !eB) continue;
          const dipRel = getRelation(culturalDip, eA.id, eB.id);
          // Skip pairs at war or with no diplomatic contact
          if (!dipRel || dipRel.status === 'at_war') continue;
          const affinity = lookupBaseAffinity(AFFINITY_MATRIX, eA.species.id, eB.species.id);
          if (affinity >= -10) continue; // Only strongly incompatible species
          // 20% chance per check to fire
          if (Math.random() > 0.2) continue;
          // Fire 'insult' (cultural misunderstanding) for both sides
          recordDiplomaticEvent(culturalPsych, eA.id, eB.id, 'insult', culturalTick);
          recordDiplomaticEvent(culturalPsych, eB.id, eA.id, 'insult', culturalTick);
        }
      }
    }
  }

  // 8h. Vassalage tribute collection
  if (s.diplomacyState) {
    const vassalRels = findVassalRelationships(s.diplomacyState);
    for (const { overlordId, vassalId } of vassalRels) {
      const vassalRes = s.empireResourcesMap.get(vassalId);
      const overlordRes = s.empireResourcesMap.get(overlordId);
      if (vassalRes && overlordRes) {
        // Use 1% of stockpile as income proxy for v1 (per-tick income is not
        // stored separately — it's computed inside stepResourceProduction).
        const estimatedIncome = vassalRes.credits * 0.01;
        const tribute = calculateTribute(estimatedIncome, VASSAL_TRIBUTE_RATE);
        if (tribute > 0) {
          const { vassal, overlord } = applyTribute(vassalRes, overlordRes, tribute);
          const updatedMap = new Map(s.empireResourcesMap);
          updatedMap.set(vassalId, vassal);
          updatedMap.set(overlordId, overlord);
          s = { ...s, empireResourcesMap: updatedMap };
        }
      }
    }
  }

  // 9. AI Decisions
  s = stepAIDecisions(s, allTechs);

  // 9a. AI Demand Generation (AI considers demanding from weaker neighbours)
  s = stepAIDemands(s);

  // 9a+. AI Vassalage Demands (ambitious empires demand subjugation from the weak)
  s = stepAIVassalageDemands(s, allTechs);

  // 9a++. AI Vassal Rebellion (vassals grown strong enough may rebel)
  s = stepAIVassalRebellion(s, allTechs);

  // 9b. Waste Processing (accumulate waste, apply reduction, flag overflow)
  s = stepWaste(s);

  // 9d. Marketplace (local + galactic commodity price discovery, trade orders)
  s = stepMarketplace(s, events);

  // 9c. Building Condition (decay unpaid buildings, update condition values)
  s = stepBuildingCondition(s);

  // 9e. Galactic Events (solar storms, asteroid showers, etc.)
  s = stepGalacticEvents(s, events);

  // 10. Victory Check — update economic lead counters then evaluate all conditions
  s = {
    ...s,
    economicLeadTicks: updateEconomicLeadTicks(
      s.gameState.empires,
      s.empireResourcesMap,
      s.economicLeadTicks,
      s.gameState.currentTick,
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

  // Clean up empty fleets (ships may have been consumed by colonisation, transfers, etc.)
  const nonEmptyFleets = s.gameState.fleets.filter(f => f.ships.length > 0);
  if (nonEmptyFleets.length !== s.gameState.fleets.length) {
    s = {
      ...s,
      gameState: { ...s.gameState, fleets: nonEmptyFleets },
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
export function initializeTickState(gameState: GameState, allTechCount?: number): GameTickState {
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
  // Home worlds start at natural food capacity (fertility% of maxPop), so
  // production ≈ consumption at game start.  A small buffer is provided for
  // comfort while the player explores the food system.
  const empireResourcesMap = new Map<string, EmpireResources>();
  for (const empire of gameState.empires) {
    const startingPop = gameState.galaxy.systems
      .flatMap(s => s.planets)
      .filter(p => p.ownerId === empire.id)
      .reduce((sum, p) => sum + p.currentPopulation, 0);
    // Provide ~100 ticks of consumption buffer.  With the new 1-food-per-10M
    // scale, absolute numbers are much smaller.
    const tickConsumption = Math.max(1, Math.ceil(startingPop / 10_000_000));
    const startingOrganics = Math.max(50, tickConsumption * 100);
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

  // Generate empire-wide leaders (Head of Research, Spy Master, Admiral, General)
  const startingLeaders: EmpireLeader[] = [];
  for (const empire of gameState.empires) {
    startingLeaders.push(...generateStartingLeaders(empire.id));
  }

  // Generate default ship designs for starting age hulls
  const shipDesigns = new Map<string, ShipDesign>();
  for (const empire of gameState.empires) {
    const startingComponents = SHIP_COMPONENTS.filter(c => c.requiredTech === null);
    const defaults = generateDefaultDesigns(
      empire.currentAge,
      empire.id,
      shipDesigns,
      startingComponents,
    );
    for (const d of defaults) {
      shipDesigns.set(d.id, d);
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
    allTechCount: allTechCount ?? 0,
    terraformingProgressMap: new Map<string, TerraformingProgress>(),
    wasteMap: new Map<string, PlanetWasteState>(),
    energyStateMap: new Map<string, PlanetEnergyState>(),
    disabledBuildingsMap: new Map<string, string[]>(),
    governors: startingGovernors,
    leaders: startingLeaders,
    shipDesigns,
    shipComponents: [...SHIP_COMPONENTS],
    espionageState: initialiseEspionage(gameState.empires.map(e => e.id)),
    espionageEventLog: [],
    diplomacyState: initializeDiplomacy(gameState.empires.map(e => e.id)),
    warStateMap: new Map(gameState.empires.map(e => [e.id, createEmpireWarState()])),
    psychStateMap: new Map(gameState.empires.map(e => [
      e.id,
      e.psychology ? initPsychologicalState(e.psychology) : undefined,
    ]).filter((entry): entry is [string, EmpirePsychologicalState] => entry[1] !== undefined)),
    warTerritoryTrackers: new Map(),
    reputationState: initReputationState(gameState.empires.map(e => e.id)),
    demandState: initDemandState(),
    embargoState: initEmbargoState(),
  } as GameTickState;
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
