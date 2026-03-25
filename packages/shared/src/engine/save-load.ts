/**
 * Save / load serialisation for GameTickState.
 *
 * GameTickState uses several ES6 Maps which cannot be serialised to JSON
 * directly.  These helpers convert Maps to arrays of [key, value] tuples for
 * storage and restore them on load.
 *
 * Version history:
 *  0.1.0 — initial format
 */

import type { GameTickState } from './game-loop.js';
import type { ResearchState } from './research.js';
import type { FleetMovementOrder, ShipProductionOrder } from './fleet.js';
import type { MigrationOrder } from './colony.js';
import type { TerraformingProgress } from './terraforming.js';
import type { BasicTradeRoute } from './trade.js';
import type { EmpireResources } from '../types/resources.js';
import type { ShipDesign, ShipComponent } from '../types/ships.js';
import type { GameState } from '../types/game-state.js';
import type { Governor } from '../types/governor.js';
import type { PlanetWasteState, PlanetEnergyState } from '../types/waste.js';

export const SAVE_FORMAT_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Serialised representations
// ---------------------------------------------------------------------------

/**
 * A wire-safe snapshot of GameTickState.
 * Maps are stored as arrays of [key, value] pairs.
 */
export interface SerializedTickState {
  gameState: GameState;
  researchStates: Array<[string, ResearchState]>;
  movementOrders: FleetMovementOrder[];
  productionOrders: ShipProductionOrder[];
  pendingCombats: GameTickState['pendingCombats'];
  migrationOrders: MigrationOrder[];
  pendingActions: GameTickState['pendingActions'];
  empireResourcesMap: Array<[string, EmpireResources]>;
  tradeRoutes: BasicTradeRoute[];
  economicLeadTicks: Array<[string, number]>;
  allTechCount: number;
  terraformingProgressMap: Array<[string, TerraformingProgress]>;
  shipDesigns: Array<[string, ShipDesign]>;
  shipComponents: ShipComponent[];
  governors: Governor[];
  wasteMap: Array<[string, PlanetWasteState]>;
  energyStateMap: Array<[string, PlanetEnergyState]>;
  disabledBuildingsMap: Array<[string, string[]]>;
}

export interface SaveGame {
  /** Serialisation format version, e.g. '0.1.0'. */
  version: string;
  /** Unix timestamp (ms) when the save was created. */
  timestamp: number;
  /** Display name of the human player. */
  playerName: string;
  /** ID of the player's species. */
  speciesId: string;
  /** Name of the player's empire. */
  empireName: string;
  /** Full tick-state snapshot. */
  tickState: SerializedTickState;
}

// ---------------------------------------------------------------------------
// Serialise
// ---------------------------------------------------------------------------

export function serializeTickState(state: GameTickState): SerializedTickState {
  return {
    gameState: state.gameState,
    researchStates: Array.from(state.researchStates.entries()),
    movementOrders: state.movementOrders,
    productionOrders: state.productionOrders,
    pendingCombats: state.pendingCombats,
    migrationOrders: state.migrationOrders,
    pendingActions: state.pendingActions,
    empireResourcesMap: Array.from(state.empireResourcesMap.entries()),
    tradeRoutes: state.tradeRoutes,
    economicLeadTicks: Array.from(state.economicLeadTicks.entries()),
    allTechCount: state.allTechCount,
    terraformingProgressMap: Array.from(state.terraformingProgressMap.entries()),
    shipDesigns: Array.from((state.shipDesigns ?? new Map()).entries()),
    shipComponents: state.shipComponents ?? [],
    governors: state.governors ?? [],
    wasteMap: Array.from(state.wasteMap.entries()),
    energyStateMap: Array.from(state.energyStateMap.entries()),
    disabledBuildingsMap: Array.from(state.disabledBuildingsMap.entries()),
  };
}

// ---------------------------------------------------------------------------
// Deserialise
// ---------------------------------------------------------------------------

export function deserializeTickState(data: SerializedTickState): GameTickState {
  return {
    gameState: data.gameState,
    researchStates: new Map(data.researchStates),
    movementOrders: data.movementOrders,
    productionOrders: data.productionOrders,
    pendingCombats: data.pendingCombats,
    migrationOrders: data.migrationOrders,
    pendingActions: data.pendingActions,
    empireResourcesMap: new Map(data.empireResourcesMap),
    tradeRoutes: data.tradeRoutes,
    economicLeadTicks: new Map(data.economicLeadTicks),
    allTechCount: data.allTechCount,
    terraformingProgressMap: new Map(data.terraformingProgressMap),
    shipDesigns: new Map(data.shipDesigns),
    shipComponents: data.shipComponents,
    governors: data.governors ?? [],
    wasteMap: new Map(data.wasteMap ?? []),
    energyStateMap: new Map(data.energyStateMap ?? []),
    disabledBuildingsMap: new Map(data.disabledBuildingsMap ?? []),
  };
}

// ---------------------------------------------------------------------------
// High-level helpers
// ---------------------------------------------------------------------------

/**
 * Build a SaveGame envelope around the current tick state.
 *
 * The player empire is detected as the first non-AI empire.  If no human
 * empire is found (edge-case: observer/replay mode) the first empire is used.
 */
export function createSaveGame(tickState: GameTickState, playerName: string): SaveGame {
  const empires = tickState.gameState.empires;
  const playerEmpire = empires.find(e => !e.isAI) ?? empires[0];

  return {
    version: SAVE_FORMAT_VERSION,
    timestamp: Date.now(),
    playerName,
    speciesId: playerEmpire?.species.id ?? '',
    empireName: playerEmpire?.name ?? '',
    tickState: serializeTickState(tickState),
  };
}

/**
 * Restore a GameTickState from a SaveGame envelope.
 *
 * Throws if the save format version is incompatible (major version mismatch).
 */
export function loadSaveGame(data: SaveGame): GameTickState {
  _assertVersionCompatible(data.version);
  return deserializeTickState(data.tickState);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _assertVersionCompatible(version: string): void {
  const [saveMajor] = version.split('.');
  const [currentMajor] = SAVE_FORMAT_VERSION.split('.');
  if (saveMajor !== currentMajor) {
    throw new Error(
      `Save format version "${version}" is incompatible with current version "${SAVE_FORMAT_VERSION}".`,
    );
  }
}
