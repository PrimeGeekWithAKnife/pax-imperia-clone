/**
 * Notification types and interfaces for the auto-pause notification system.
 *
 * Critical game events pause the simulation and display a modal overlay so the
 * player can react.  Each notification type carries metadata about its priority,
 * whether it triggers an auto-pause, and whether the player can silence it.
 */

export type NotificationPriority = 'critical' | 'warning' | 'info';

export type NotificationType =
  | 'under_attack'            // System or fleet under attack — NOT silenceable
  | 'no_active_research'      // No research projects running
  | 'colony_starving'         // Colony has no food
  | 'building_non_functional' // Building decayed to non-functional
  | 'power_plant_end_of_life' // Power plant needs recommission
  | 'waste_overflow'          // Waste exceeded planetary capacity
  | 'energy_crisis'           // Energy production < 30% of demand
  | 'population_revolt'       // Population happiness critically low
  | 'construction_complete'   // Building finished
  | 'research_complete'       // Technology researched
  | 'first_contact'           // Encountered a new species
  | 'fleet_arrived'           // Fleet reached destination
  | 'diplomatic_proposal'     // AI offers treaty/demands
  | 'minor_species_found'     // Discovered pre-spaceflight civilisation
  | 'anomaly_discovered'      // Found space anomaly
  | 'planet_captured'         // Enemy planet captured after winning space combat
  | 'debris_warning'          // Orbital debris density > 30
  | 'debris_critical'         // Orbital debris density > 75 — Kessler cascade imminent
  | 'debris_cascade';         // Kessler cascade event occurred

export interface GameNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  tick: number;
  /** If true, the game should auto-pause when this notification fires. */
  autoPause: boolean;
  /** If true, this notification type can be silenced by the player. */
  canSilence: boolean;
  /** Optional choices the player can make in response. */
  choices?: NotificationChoice[];
  /** Context data (system ID, planet ID, fleet ID, etc.). */
  context?: Record<string, string>;
}

export interface NotificationChoice {
  id: string;
  label: string;
  description?: string;
}

export interface NotificationPreferences {
  /** Notification types the player has chosen to silence. */
  silencedTypes: Set<NotificationType>;
}
