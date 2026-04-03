/**
 * Save / load serialisation for GameTickState.
 *
 * GameTickState uses several ES6 Maps which cannot be serialised to JSON
 * directly.  These helpers convert Maps to arrays of [key, value] tuples for
 * storage and restore them on load.
 *
 * Version history:
 *  0.1.0 — initial format
 *  0.2.0 — warStateMap, espionage
 *  0.3.0 — diplomacyState, 15 dynamic state fields (BUG 7 + BUG 8),
 *           fleet-order-reset notifications on load (BUG 9)
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
import type { EmpireLeader } from '../types/leaders.js';
import type { PlanetWasteState, PlanetEnergyState } from '../types/waste.js';
import type { SpyAgent, EspionageEvent } from './espionage.js';
import { initialiseEspionage } from './espionage.js';
import { createEmpireWarState, type EmpireWarState } from './war-response.js';
import {
  initializeDiplomacy,
  type DiplomacyState,
  type DiplomaticRelationFull,
} from './diplomacy.js';
import type { EmpireCorruptionState } from './corruption.js';
import type { MinorSpecies } from '../types/minor-species.js';
import type { ExcavationSite } from './anomaly.js';
import type { MarketState } from './marketplace.js';
import type { Disease } from './healthcare.js';
import type { EmpirePoliticalState } from './politics.js';
import type { Grievance, Diplomat, GalacticOrganisationState, GalacticBank } from '../types/diplomacy.js';
import type { GalacticEvent } from './galactic-events.js';
import type { GameNotification } from '../types/notification.js';
import { createNotification } from './notifications.js';
import type { NarrativeChainProgress } from './narrative.js';
import type { NarrativeChain } from '../types/narrative.js';
import { HULL_TEMPLATE_BY_CLASS } from '../../data/ships/index.js';

export const SAVE_FORMAT_VERSION = '0.3.0';

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
  leaders: EmpireLeader[];
  wasteMap: Array<[string, PlanetWasteState]>;
  energyStateMap: Array<[string, PlanetEnergyState]>;
  disabledBuildingsMap: Array<[string, string[]]>;
  espionageAgents: SpyAgent[];
  espionageCounterIntel: Array<[string, number]>;
  espionageEventLog: EspionageEvent[];
  warStateMap?: Array<[string, EmpireWarState]>;

  // --- Fields added in v0.3.0 (BUG 7 + BUG 8) ---
  diplomacyRelations?: Array<[string, Array<[string, DiplomaticRelationFull]>]>;
  corruptionStates?: Array<[string, EmpireCorruptionState]>;
  minorSpecies?: MinorSpecies[];
  excavationSites?: ExcavationSite[];
  marketState?: SerializedMarketState;
  diseaseStates?: Array<[string, Disease[]]>;
  politicalStates?: Array<[string, EmpirePoliticalState]>;
  grievances?: Grievance[];
  diplomats?: Diplomat[];
  organisationState?: GalacticOrganisationState;
  galacticEvents?: GalacticEvent[];
  notifications?: GameNotification[];
  bankState?: GalacticBank;
  narrativeProgress?: NarrativeChainProgress[];
  narrativeChains?: NarrativeChain[];
}

interface SerializedMarketState {
  localMarkets: Array<[string, SerializedLocalMarket]>;
  galacticMarket: {
    open: boolean;
    memberEmpires: string[];
    listings: unknown[];
    reserveCurrencyRate: Record<string, number>;
    lastUpdatedTick: number;
  };
}

interface SerializedLocalMarket {
  empireId: string;
  listings: unknown[];
  lastUpdatedTick: number;
  blockedCommodities: string[];
  sanctionedBy: string[];
}

export interface SaveGame {
  version: string;
  timestamp: number;
  playerName: string;
  speciesId: string;
  empireName: string;
  tickState: SerializedTickState;
}

// ---------------------------------------------------------------------------
// Serialise
// ---------------------------------------------------------------------------

export function serializeTickState(state: GameTickState): SerializedTickState {
  const dyn = state as unknown as Record<string, unknown>;

  const result: SerializedTickState = {
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
    leaders: state.leaders ?? [],
    wasteMap: Array.from(state.wasteMap.entries()),
    energyStateMap: Array.from(state.energyStateMap.entries()),
    disabledBuildingsMap: Array.from(state.disabledBuildingsMap.entries()),
    espionageAgents: state.espionageState.agents,
    espionageCounterIntel: Array.from(state.espionageState.counterIntelLevel.entries()),
    espionageEventLog: state.espionageEventLog,
    warStateMap: Array.from((dyn.warStateMap as Map<string, EmpireWarState> ?? new Map()).entries()),
  };

  // BUG 7: diplomacyState (nested Map)
  const diplomacyState = dyn.diplomacyState as DiplomacyState | undefined;
  if (diplomacyState) {
    result.diplomacyRelations = Array.from(diplomacyState.relations.entries()).map(
      ([empireId, innerMap]) => [empireId, Array.from(innerMap.entries())] as [string, Array<[string, DiplomaticRelationFull]>],
    );
  }

  // BUG 8: remaining dynamic fields
  const corruptionStates = dyn.corruptionStates as Map<string, EmpireCorruptionState> | undefined;
  if (corruptionStates) result.corruptionStates = Array.from(corruptionStates.entries());
  if (dyn.minorSpecies) result.minorSpecies = dyn.minorSpecies as MinorSpecies[];
  if (dyn.excavationSites) result.excavationSites = dyn.excavationSites as ExcavationSite[];
  const mkt = dyn.marketState as MarketState | undefined;
  if (mkt) result.marketState = _serializeMarketState(mkt);
  const dis = dyn.diseaseStates as Map<string, Disease[]> | undefined;
  if (dis) result.diseaseStates = Array.from(dis.entries());
  const pol = dyn.politicalStates as Map<string, EmpirePoliticalState> | undefined;
  if (pol) result.politicalStates = Array.from(pol.entries());
  if (dyn.grievances) result.grievances = dyn.grievances as Grievance[];
  if (dyn.diplomats) result.diplomats = dyn.diplomats as Diplomat[];
  if (dyn.organisationState) result.organisationState = dyn.organisationState as GalacticOrganisationState;
  if (dyn.galacticEvents) result.galacticEvents = dyn.galacticEvents as GalacticEvent[];
  if (dyn.notifications) result.notifications = dyn.notifications as GameNotification[];
  if (dyn.bankState) result.bankState = dyn.bankState as GalacticBank;
  if (dyn.narrativeProgress) result.narrativeProgress = dyn.narrativeProgress as NarrativeChainProgress[];
  if (dyn.narrativeChains) result.narrativeChains = dyn.narrativeChains as NarrativeChain[];

  return result;
}

// ---------------------------------------------------------------------------
// Deserialise
// ---------------------------------------------------------------------------

export function deserializeTickState(data: SerializedTickState): GameTickState {
  const migratedDesigns: Array<[string, ShipDesign]> = (data.shipDesigns ?? []).map(
    ([id, design]) => {
      const migrated: ShipDesign = {
        ...design,
        armourPlating: design.armourPlating ?? 0,
        // Backward compat: ensure coreSystemOverrides exists
        coreSystemOverrides: design.coreSystemOverrides ?? [],
      };
      return [id, migrated] as [string, ShipDesign];
    },
  );

  const empireIds = (data.gameState.empires ?? []).map(e => e.id);

  // BUG 9: generate notifications for fleets whose orders will be lost
  const loadNotifications: GameNotification[] = [];
  const tick = data.gameState.currentTick ?? 0;
  if (data.movementOrders && data.movementOrders.length > 0) {
    for (const order of data.movementOrders) {
      const currentSystemId = order.currentSegment > 0 && order.currentSegment < order.path.length
        ? order.path[order.currentSegment - 1]
        : order.path[0];
      const systemName = _findSystemName(data.gameState, currentSystemId ?? '');
      const fleetName = _findFleetName(data.gameState, order.fleetId);
      loadNotifications.push(
        createNotification(
          'fleet_arrived',
          'Fleet orders reset',
          `${fleetName} has arrived at ${systemName} \u2014 orders were reset after loading.`,
          tick, undefined,
          { fleetId: order.fleetId, systemId: currentSystemId ?? '' },
        ),
      );
    }
  }

  const base: GameTickState = {
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
    shipDesigns: new Map(migratedDesigns),
    shipComponents: data.shipComponents,
    governors: data.governors ?? [],
    leaders: data.leaders ?? [],
    wasteMap: new Map(data.wasteMap ?? []),
    energyStateMap: new Map(data.energyStateMap ?? []),
    disabledBuildingsMap: new Map(data.disabledBuildingsMap ?? []),
    espionageState: {
      agents: data.espionageAgents ?? [],
      counterIntelLevel: new Map(data.espionageCounterIntel ?? []),
    },
    espionageEventLog: data.espionageEventLog ?? [],
    warTerritoryTrackers: new Map(),
  };

  // Backward compat: patch ships missing supply/magazine/crew fields
  const designLookup = new Map(migratedDesigns);
  if (base.gameState.ships) {
    base.gameState.ships = base.gameState.ships.map(ship => {
      const design = designLookup.get(ship.designId);
      const hull = design ? HULL_TEMPLATE_BY_CLASS[design.hull] : undefined;
      const baseSupply = hull?.baseSupplyCapacity ?? 15;
      const baseCrew = hull?.baseCrew ?? 0;

      return {
        ...ship,
        suppliesRemaining: ship.suppliesRemaining ?? baseSupply,
        maxSupplies: ship.maxSupplies ?? baseSupply,
        magazineLevel: ship.magazineLevel ?? 1.0,
        crewCount: ship.crewCount ?? baseCrew,
      };
    });
  }

  // Attach dynamic fields via mutable record cast
  const ext = base as unknown as Record<string, unknown>;

  ext.warStateMap = data.warStateMap
    ? new Map(data.warStateMap)
    : new Map(empireIds.map(id => [id, createEmpireWarState()]));

  // BUG 7: restore diplomacyState
  if (data.diplomacyRelations) {
    const outerMap = new Map<string, Map<string, DiplomaticRelationFull>>();
    for (const [empireId, innerEntries] of data.diplomacyRelations) {
      outerMap.set(empireId, new Map(innerEntries));
    }
    ext.diplomacyState = { relations: outerMap } as DiplomacyState;
  } else {
    ext.diplomacyState = initializeDiplomacy(empireIds);
  }

  // BUG 8: restore remaining dynamic fields (all backward-compatible)
  if (data.corruptionStates) ext.corruptionStates = new Map(data.corruptionStates);
  if (data.minorSpecies) ext.minorSpecies = data.minorSpecies;
  if (data.excavationSites) ext.excavationSites = data.excavationSites;
  if (data.marketState) ext.marketState = _deserializeMarketState(data.marketState);
  if (data.diseaseStates) ext.diseaseStates = new Map(data.diseaseStates);
  if (data.politicalStates) ext.politicalStates = new Map(data.politicalStates);
  if (data.grievances) ext.grievances = data.grievances;
  if (data.diplomats) ext.diplomats = data.diplomats;
  if (data.organisationState) ext.organisationState = data.organisationState;
  if (data.galacticEvents) ext.galacticEvents = data.galacticEvents;
  if (data.bankState) ext.bankState = data.bankState;
  if (data.narrativeProgress) ext.narrativeProgress = data.narrativeProgress;
  if (data.narrativeChains) ext.narrativeChains = data.narrativeChains;

  // BUG 9: merge saved + load-generated notifications
  const existingNotifications = (data.notifications as GameNotification[] | undefined) ?? [];
  ext.notifications = [...existingNotifications, ...loadNotifications];

  return base;
}

// ---------------------------------------------------------------------------
// High-level helpers
// ---------------------------------------------------------------------------

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

export function validateSaveGame(data: SaveGame): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.version || typeof data.version !== 'string') errors.push('Missing or invalid version');
  if (!data.tickState) { errors.push('Missing tickState'); return { valid: false, errors }; }
  const ts = data.tickState;
  if (!ts.gameState) { errors.push('Missing gameState'); return { valid: false, errors }; }
  if (!ts.gameState.empires || ts.gameState.empires.length === 0) errors.push('No empires in save data');
  if (!ts.gameState.galaxy?.systems || ts.gameState.galaxy.systems.length === 0) errors.push('No star systems in save data');
  if (typeof ts.gameState.currentTick !== 'number' || ts.gameState.currentTick < 0) errors.push('Invalid tick counter');
  for (const empire of (ts.gameState.empires ?? [])) {
    if (typeof empire.credits !== 'number') errors.push(`Empire ${empire.name}: invalid credits (${empire.credits})`);
  }
  for (const system of (ts.gameState.galaxy?.systems ?? [])) {
    for (const planet of system.planets) {
      if (planet.currentPopulation < 0) errors.push(`Planet ${planet.name}: negative population (${planet.currentPopulation})`);
      if (planet.maxPopulation < 0) errors.push(`Planet ${planet.name}: negative maxPopulation`);
    }
  }
  for (const ship of (ts.gameState.ships ?? [])) {
    if (ship.hullPoints < 0) errors.push(`Ship ${ship.name}: negative hull points (${ship.hullPoints})`);
    if (ship.maxHullPoints <= 0) errors.push(`Ship ${ship.name}: invalid maxHullPoints (${ship.maxHullPoints})`);
  }
  return { valid: errors.length === 0, errors };
}

export function loadSaveGame(data: SaveGame): GameTickState {
  _assertVersionCompatible(data.version);
  const validation = validateSaveGame(data);
  if (!validation.valid) {
    console.warn('[SaveManager] Save data validation warnings:', validation.errors);
  }
  return deserializeTickState(data.tickState);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _assertVersionCompatible(version: string): void {
  const [saveMajor] = version.split('.');
  const [currentMajor] = SAVE_FORMAT_VERSION.split('.');
  if (saveMajor !== currentMajor) {
    throw new Error(`Save format version "${version}" is incompatible with current version "${SAVE_FORMAT_VERSION}".`);
  }
}

function _serializeMarketState(market: MarketState): SerializedMarketState {
  const localMarkets: Array<[string, SerializedLocalMarket]> = Array.from(
    market.localMarkets.entries(),
  ).map(([id, local]) => [id, {
    empireId: local.empireId,
    listings: local.listings as unknown[],
    lastUpdatedTick: local.lastUpdatedTick,
    blockedCommodities: Array.from(local.blockedCommodities),
    sanctionedBy: local.sanctionedBy,
  }]);
  return {
    localMarkets,
    galacticMarket: {
      open: market.galacticMarket.open,
      memberEmpires: market.galacticMarket.memberEmpires,
      listings: market.galacticMarket.listings as unknown[],
      reserveCurrencyRate: market.galacticMarket.reserveCurrencyRate,
      lastUpdatedTick: market.galacticMarket.lastUpdatedTick,
    },
  };
}

function _deserializeMarketState(data: SerializedMarketState): MarketState {
  const localMarkets = new Map<string, { empireId: string; listings: unknown[]; lastUpdatedTick: number; blockedCommodities: Set<string>; sanctionedBy: string[] }>();
  for (const [id, s] of data.localMarkets) {
    localMarkets.set(id, {
      empireId: s.empireId, listings: s.listings, lastUpdatedTick: s.lastUpdatedTick,
      blockedCommodities: new Set(s.blockedCommodities), sanctionedBy: s.sanctionedBy,
    });
  }
  return {
    localMarkets,
    galacticMarket: {
      open: data.galacticMarket.open,
      memberEmpires: data.galacticMarket.memberEmpires,
      listings: data.galacticMarket.listings,
      reserveCurrencyRate: data.galacticMarket.reserveCurrencyRate,
      lastUpdatedTick: data.galacticMarket.lastUpdatedTick,
    },
  } as MarketState;
}

function _findSystemName(gameState: GameState, systemId: string): string {
  const system = gameState.galaxy?.systems?.find(s => s.id === systemId);
  return system?.name ?? systemId ?? 'unknown system';
}

function _findFleetName(gameState: GameState, fleetId: string): string {
  const fleet = gameState.fleets?.find(f => f.id === fleetId);
  return fleet?.name ?? `Fleet ${fleetId}`;
}
