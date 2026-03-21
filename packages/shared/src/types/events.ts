/** Network event and game action types */

import type { FleetStance } from './ships.js';
import type { TreatyType } from './species.js';
import type { GameSpeedName } from '../constants/game.js';

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
}

export interface ColonizePlanetAction {
  type: 'ColonizePlanet';
  fleetId: string;
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

export type GameAction =
  | MoveFleetAction
  | BuildShipAction
  | ResearchAction
  | SetFleetStanceAction
  | ConstructBuildingAction
  | ColonizePlanetAction
  | ProposeTreatyAction
  | AcceptTreatyAction
  | RejectTreatyAction
  | SetGameSpeedAction
  | DesignShipAction;

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

export type GameEvent =
  | FleetMovedEvent
  | CombatStartedEvent
  | CombatResolvedEvent
  | TechResearchedEvent
  | PlanetColonizedEvent
  | TreatyProposedEvent
  | TreatyAcceptedEvent
  | TreatyRejectedEvent
  | GameSpeedChangedEvent
  | PlayerConnectedEvent
  | PlayerDisconnectedEvent
  | GameOverEvent;
