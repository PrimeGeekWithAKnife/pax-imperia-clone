/** Network event and game action types */

import type { FleetStance } from './ships.js';
import type { TreatyType } from './species.js';
import type { DemandType, DemandThreat } from './diplomacy.js';
import type { GameSpeedName } from '../constants/game.js';
import type { EspionageEvent } from '../engine/espionage.js';

// ---------------------------------------------------------------------------
// Game Actions (client -> server)
// ---------------------------------------------------------------------------

export interface MoveFleetAction {
  type: 'MoveFleet';
  fleetId: string;
  /** Ordered list of star-system IDs forming the route */
  waypoints: string[];
}

export interface BuildShipAction {
  type: 'BuildShip';
  systemId: string;
  designId: string;
}

export interface ResearchAction {
  type: 'Research';
  techId: string;
}

export interface SetFleetStanceAction {
  type: 'SetFleetStance';
  fleetId: string;
  stance: FleetStance;
}

export interface ConstructBuildingAction {
  type: 'ConstructBuilding';
  systemId: string;
  planetId: string;
  buildingType: string;
  targetZone?: 'surface' | 'orbital' | 'underground';
}

export interface UpgradeBuildingAction {
  type: 'UpgradeBuilding';
  systemId: string;
  planetId: string;
  buildingId: string;
}

export interface ColonizePlanetAction {
  type: 'ColonizePlanet';
  fleetId: string;
  planetId: string;
}

/** UK-spelling variant: colonise a planet within a system the empire already controls. */
export interface ColonisePlanetAction {
  type: 'ColonisePlanet';
  empireId: string;
  systemId: string;
  planetId: string;
}

export interface ProposeTreatyAction {
  type: 'ProposeTreaty';
  targetEmpireId: string;
  treatyType: TreatyType;
}

export interface AcceptTreatyAction {
  type: 'AcceptTreaty';
  treatyProposalId: string;
}

export interface RejectTreatyAction {
  type: 'RejectTreaty';
  treatyProposalId: string;
}

export interface SetGameSpeedAction {
  type: 'SetGameSpeed';
  speed: GameSpeedName;
}

export interface DesignShipAction {
  type: 'DesignShip';
  name: string;
  hull: string;
  components: { slotId: string; componentId: string }[];
}

export interface ProposeDemandAction {
  type: 'propose_demand';
  empireId: string;
  targetEmpireId: string;
  demandType: DemandType;
  threat: DemandThreat;
  resourceType?: string;
  amount?: number;
  systemId?: string;
  techId?: string;
}

export interface AcceptDemandAction {
  type: 'accept_demand';
  empireId: string;
  demandId: string;
}

export interface RejectDemandAction {
  type: 'reject_demand';
  empireId: string;
  demandId: string;
}

export type GameAction =
  | MoveFleetAction
  | BuildShipAction
  | ResearchAction
  | SetFleetStanceAction
  | ConstructBuildingAction
  | UpgradeBuildingAction
  | ColonizePlanetAction
  | ColonisePlanetAction
  | ProposeTreatyAction
  | AcceptTreatyAction
  | RejectTreatyAction
  | SetGameSpeedAction
  | DesignShipAction
  | ProposeDemandAction
  | AcceptDemandAction
  | RejectDemandAction;

// ---------------------------------------------------------------------------
// Game Events (server -> client)
// ---------------------------------------------------------------------------

export interface FleetMovedEvent {
  type: 'FleetMoved';
  fleetId: string;
  fromSystemId: string;
  toSystemId: string;
  tick: number;
}

export interface CombatStartedEvent {
  type: 'CombatStarted';
  systemId: string;
  attackerFleetId: string;
  defenderFleetId: string;
  tick: number;
}

export interface CombatResolvedEvent {
  type: 'CombatResolved';
  systemId: string;
  winnerEmpireId: string;
  casualties: { fleetId: string; shipsLost: number }[];
  tick: number;
}

export interface TechResearchedEvent {
  type: 'TechResearched';
  empireId: string;
  techId: string;
  tick: number;
}

export interface PlanetColonizedEvent {
  type: 'PlanetColonized';
  empireId: string;
  systemId: string;
  planetId: string;
  tick: number;
}

/** UK-spelling variant emitted when in-system colonisation completes. */
export interface PlanetColonisedEvent {
  type: 'PlanetColonised';
  empireId: string;
  systemId: string;
  planetId: string;
  planetName: string;
  tick: number;
}

/** Emitted when a migration order is created (player clicks "Colonise"). */
export interface MigrationStartedEvent {
  type: 'MigrationStarted';
  empireId: string;
  systemId: string;
  sourcePlanetId: string;
  targetPlanetId: string;
  tick: number;
}

/** Emitted each tick a wave departs and arrives during migration. */
export interface MigrationWaveEvent {
  type: 'MigrationWave';
  empireId: string;
  systemId: string;
  departed: number;
  arrived: number;
  lost: number;
  tick: number;
}

/** Emitted when cumulative arrivals reach the threshold and the colony is founded. */
export interface ColonyEstablishedEvent {
  type: 'ColonyEstablished';
  empireId: string;
  systemId: string;
  planetId: string;
  planetName: string;
  tick: number;
}

export interface TreatyProposedEvent {
  type: 'TreatyProposed';
  proposalId: string;
  fromEmpireId: string;
  toEmpireId: string;
  treatyType: TreatyType;
  tick: number;
}

export interface TreatyAcceptedEvent {
  type: 'TreatyAccepted';
  proposalId: string;
  tick: number;
}

export interface TreatyRejectedEvent {
  type: 'TreatyRejected';
  proposalId: string;
  tick: number;
}

export interface GameSpeedChangedEvent {
  type: 'GameSpeedChanged';
  speed: GameSpeedName;
  tick: number;
}

export interface PlayerConnectedEvent {
  type: 'PlayerConnected';
  playerId: string;
  empireId: string;
}

export interface PlayerDisconnectedEvent {
  type: 'PlayerDisconnected';
  playerId: string;
  empireId: string;
}

export interface GameOverEvent {
  type: 'GameOver';
  winnerEmpireId: string;
  victoryCriteria: string;
  tick: number;
}

/** Emitted each tick when a planet's terraforming advances to a new stage. */
export interface TerraformingProgressEvent {
  type: 'TerraformingProgress';
  empireId: string;
  systemId: string;
  planetId: string;
  planetName: string;
  stage: 'atmosphere' | 'temperature' | 'biosphere' | 'complete';
  progressPercent: number;
  tick: number;
}

/** Emitted when a planet's terraforming project finishes entirely. */
export interface TerraformingCompleteEvent {
  type: 'TerraformingComplete';
  empireId: string;
  systemId: string;
  planetId: string;
  planetName: string;
  newPlanetType: string;
  tick: number;
}

/** Emitted when a planet's governor dies of old age. */
export interface GovernorDiedEvent {
  type: 'GovernorDied';
  empireId: string;
  planetId: string;
  governorName: string;
  tick: number;
}

/** Emitted when a new governor is appointed to a planet. */
export interface GovernorAppointedEvent {
  type: 'GovernorAppointed';
  empireId: string;
  planetId: string;
  governorName: string;
  tick: number;
}

/** Emitted when an espionage mission produces a result. */
export interface EspionageResultEvent {
  type: 'EspionageResult';
  espionageEvent: EspionageEvent;
  tick: number;
}

export interface FirstContactGameEvent {
  type: 'FirstContact';
  tick: number;
  /** The empire making contact (fleet owner). */
  empireId: string;
  /** The empire discovered. */
  foreignEmpireId: string;
  /** System where contact occurred. */
  systemId: string;
}

export type GameEvent =
  | FleetMovedEvent
  | CombatStartedEvent
  | CombatResolvedEvent
  | TechResearchedEvent
  | PlanetColonizedEvent
  | PlanetColonisedEvent
  | MigrationStartedEvent
  | MigrationWaveEvent
  | ColonyEstablishedEvent
  | TreatyProposedEvent
  | TreatyAcceptedEvent
  | TreatyRejectedEvent
  | GameSpeedChangedEvent
  | PlayerConnectedEvent
  | PlayerDisconnectedEvent
  | GameOverEvent
  | TerraformingProgressEvent
  | TerraformingCompleteEvent
  | GovernorDiedEvent
  | GovernorAppointedEvent
  | EspionageResultEvent
  | FirstContactGameEvent;
