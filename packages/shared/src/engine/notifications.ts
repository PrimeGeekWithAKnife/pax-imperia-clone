/**
 * Notification engine — creates, classifies and filters game notifications.
 *
 * Each notification type has a fixed priority, auto-pause flag and silenceability.
 * The player can silence individual types (except `under_attack`); silenced
 * notifications are suppressed from the popup queue but still recorded in the
 * event log.
 */

import type {
  GameNotification,
  NotificationChoice,
  NotificationPriority,
  NotificationPreferences,
  NotificationType,
} from '../types/notification.js';

// ---------------------------------------------------------------------------
// Internal metadata table
// ---------------------------------------------------------------------------

interface NotificationMeta {
  priority: NotificationPriority;
  autoPause: boolean;
  canSilence: boolean;
}

const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  // Critical — auto-pause, under_attack is NOT silenceable
  under_attack:            { priority: 'critical', autoPause: true, canSilence: false },
  colony_starving:         { priority: 'critical', autoPause: true, canSilence: true },
  energy_crisis:           { priority: 'critical', autoPause: true, canSilence: true },
  population_revolt:       { priority: 'critical', autoPause: true, canSilence: true },

  // Warning — auto-pause, silenceable
  power_plant_end_of_life: { priority: 'warning', autoPause: true, canSilence: true },
  waste_overflow:          { priority: 'warning', autoPause: true, canSilence: true },
  building_non_functional: { priority: 'warning', autoPause: true, canSilence: true },
  diplomatic_proposal:     { priority: 'warning', autoPause: true, canSilence: true },

  // Info — auto-pause, silenceable
  no_active_research:      { priority: 'info', autoPause: true, canSilence: true },
  construction_complete:   { priority: 'info', autoPause: true, canSilence: true },
  research_complete:       { priority: 'info', autoPause: true, canSilence: true },
  fleet_arrived:           { priority: 'info', autoPause: true, canSilence: true },
  first_contact:           { priority: 'info', autoPause: true, canSilence: true },
  minor_species_found:     { priority: 'info', autoPause: true, canSilence: true },
  anomaly_discovered:      { priority: 'info', autoPause: true, canSilence: true },
  planet_captured:         { priority: 'info', autoPause: true, canSilence: true },
};

// ---------------------------------------------------------------------------
// Unique ID counter (simple incrementing integer — sufficient for a single
// session; persisted notifications should use a UUID instead).
// ---------------------------------------------------------------------------

let nextId = 1;

/** Reset the internal ID counter — useful in tests. */
export function _resetNotificationIdCounter(): void {
  nextId = 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new {@link GameNotification} with the correct priority, auto-pause
 * flag and silenceability derived from the notification type.
 */
export function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  tick: number,
  choices?: NotificationChoice[],
  context?: Record<string, string>,
): GameNotification {
  const meta = NOTIFICATION_META[type];
  return {
    id: `notif-${nextId++}`,
    type,
    priority: meta.priority,
    title,
    message,
    tick,
    autoPause: meta.autoPause,
    canSilence: meta.canSilence,
    choices,
    context,
  };
}

/**
 * Determine whether a notification should be displayed in the popup overlay.
 *
 * A notification is shown when:
 * 1. Its type has NOT been silenced by the player, OR
 * 2. Its type cannot be silenced (e.g. `under_attack`).
 */
export function shouldShowNotification(
  notification: GameNotification,
  preferences: NotificationPreferences,
): boolean {
  if (!notification.canSilence) return true;
  return !preferences.silencedTypes.has(notification.type);
}

/** Return the fixed priority for a notification type. */
export function getNotificationPriority(type: NotificationType): NotificationPriority {
  return NOTIFICATION_META[type].priority;
}

/** Return whether the given notification type can be silenced by the player. */
export function isNotificationSilenceable(type: NotificationType): boolean {
  return NOTIFICATION_META[type].canSilence;
}

/** Return whether the given notification type should trigger an auto-pause. */
export function shouldAutoPause(type: NotificationType): boolean {
  return NOTIFICATION_META[type].autoPause;
}

// ---------------------------------------------------------------------------
// Pre-built notification factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a "power plant end of life" notification with the three standard
 * recommission choices.
 */
export function createPowerPlantEndOfLifeNotification(
  tick: number,
  planetName: string,
  planetId: string,
  systemId: string,
): GameNotification {
  const choices: NotificationChoice[] = [
    {
      id: 'recommission',
      label: 'Recommission Now',
      description: 'Costs credits; brief downtime whilst the reactor is refuelled.',
    },
    {
      id: 'reduced_capacity',
      label: 'Reduced Capacity',
      description: 'Extends lifespan by ~10 years but output drops by 40%.',
    },
    {
      id: 'risk_it',
      label: 'Risk It',
      description: 'Keep running at full output — chance of failure each tick.',
    },
  ];

  return createNotification(
    'power_plant_end_of_life',
    'Power Plant Nearing End of Fuel Cycle',
    `The power plant on ${planetName} is approaching the end of its operational lifespan. Choose how to proceed.`,
    tick,
    choices,
    { planetId, systemId },
  );
}
