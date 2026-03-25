import { describe, it, expect, beforeEach } from 'vitest';

import {
  createNotification,
  shouldShowNotification,
  getNotificationPriority,
  isNotificationSilenceable,
  shouldAutoPause,
  createPowerPlantEndOfLifeNotification,
  _resetNotificationIdCounter,
} from '../engine/notifications.js';
import type {
  GameNotification,
  NotificationPreferences,
  NotificationType,
} from '../types/notification.js';

// ---------------------------------------------------------------------------
// Reset the internal ID counter before each test for deterministic IDs
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetNotificationIdCounter();
});

// ---------------------------------------------------------------------------
// Notification creation
// ---------------------------------------------------------------------------

describe('createNotification', () => {
  it('creates a notification with the correct fields', () => {
    const n = createNotification(
      'under_attack',
      'Under Attack!',
      'Your fleet is under attack.',
      100,
    );

    expect(n.id).toBe('notif-1');
    expect(n.type).toBe('under_attack');
    expect(n.priority).toBe('critical');
    expect(n.title).toBe('Under Attack!');
    expect(n.message).toBe('Your fleet is under attack.');
    expect(n.tick).toBe(100);
    expect(n.autoPause).toBe(true);
    expect(n.canSilence).toBe(false);
    expect(n.choices).toBeUndefined();
    expect(n.context).toBeUndefined();
  });

  it('assigns incrementing IDs', () => {
    const a = createNotification('fleet_arrived', 'Fleet', 'msg', 1);
    const b = createNotification('fleet_arrived', 'Fleet', 'msg', 2);

    expect(a.id).toBe('notif-1');
    expect(b.id).toBe('notif-2');
  });

  it('attaches optional choices and context', () => {
    const choices = [{ id: 'ok', label: 'OK' }];
    const context = { planetId: 'p1', systemId: 's1' };

    const n = createNotification(
      'construction_complete',
      'Built',
      'A factory has been constructed.',
      50,
      choices,
      context,
    );

    expect(n.choices).toEqual(choices);
    expect(n.context).toEqual(context);
  });
});

// ---------------------------------------------------------------------------
// Priority assignment
// ---------------------------------------------------------------------------

describe('getNotificationPriority', () => {
  const criticalTypes: NotificationType[] = [
    'under_attack',
    'colony_starving',
    'energy_crisis',
    'population_revolt',
  ];

  const warningTypes: NotificationType[] = [
    'power_plant_end_of_life',
    'waste_overflow',
    'building_non_functional',
    'diplomatic_proposal',
  ];

  const infoTypes: NotificationType[] = [
    'no_active_research',
    'construction_complete',
    'research_complete',
    'fleet_arrived',
    'first_contact',
    'minor_species_found',
    'anomaly_discovered',
  ];

  it.each(criticalTypes)('%s is critical', (type) => {
    expect(getNotificationPriority(type)).toBe('critical');
  });

  it.each(warningTypes)('%s is warning', (type) => {
    expect(getNotificationPriority(type)).toBe('warning');
  });

  it.each(infoTypes)('%s is info', (type) => {
    expect(getNotificationPriority(type)).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// Silencing logic
// ---------------------------------------------------------------------------

describe('isNotificationSilenceable', () => {
  it('under_attack is NOT silenceable', () => {
    expect(isNotificationSilenceable('under_attack')).toBe(false);
  });

  it('colony_starving IS silenceable', () => {
    expect(isNotificationSilenceable('colony_starving')).toBe(true);
  });

  it('construction_complete IS silenceable', () => {
    expect(isNotificationSilenceable('construction_complete')).toBe(true);
  });
});

describe('shouldShowNotification', () => {
  it('shows a non-silenced notification', () => {
    const prefs: NotificationPreferences = { silencedTypes: new Set() };
    const n = createNotification('fleet_arrived', 'Fleet', 'msg', 1);

    expect(shouldShowNotification(n, prefs)).toBe(true);
  });

  it('hides a silenced notification', () => {
    const prefs: NotificationPreferences = { silencedTypes: new Set(['fleet_arrived']) };
    const n = createNotification('fleet_arrived', 'Fleet', 'msg', 1);

    expect(shouldShowNotification(n, prefs)).toBe(false);
  });

  it('always shows under_attack even if silenced', () => {
    const prefs: NotificationPreferences = { silencedTypes: new Set(['under_attack']) };
    const n = createNotification('under_attack', 'Attack!', 'msg', 1);

    expect(shouldShowNotification(n, prefs)).toBe(true);
  });

  it('shows a notification whose type is not in the silenced set', () => {
    const prefs: NotificationPreferences = { silencedTypes: new Set(['colony_starving']) };
    const n = createNotification('research_complete', 'Done', 'msg', 1);

    expect(shouldShowNotification(n, prefs)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Auto-pause flags
// ---------------------------------------------------------------------------

describe('shouldAutoPause', () => {
  it('all notification types trigger auto-pause', () => {
    const allTypes: NotificationType[] = [
      'under_attack',
      'no_active_research',
      'colony_starving',
      'building_non_functional',
      'power_plant_end_of_life',
      'waste_overflow',
      'energy_crisis',
      'population_revolt',
      'construction_complete',
      'research_complete',
      'first_contact',
      'fleet_arrived',
      'diplomatic_proposal',
      'minor_species_found',
      'anomaly_discovered',
    ];

    for (const type of allTypes) {
      expect(shouldAutoPause(type)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Power plant choices
// ---------------------------------------------------------------------------

describe('createPowerPlantEndOfLifeNotification', () => {
  it('creates a warning notification with three choices', () => {
    const n = createPowerPlantEndOfLifeNotification(5000, 'Terra Prime', 'p1', 's1');

    expect(n.type).toBe('power_plant_end_of_life');
    expect(n.priority).toBe('warning');
    expect(n.autoPause).toBe(true);
    expect(n.canSilence).toBe(true);
    expect(n.context).toEqual({ planetId: 'p1', systemId: 's1' });
    expect(n.choices).toHaveLength(3);
  });

  it('has recommission, reduced capacity and risk-it choices', () => {
    const n = createPowerPlantEndOfLifeNotification(5000, 'Terra Prime', 'p1', 's1');
    const ids = n.choices!.map(c => c.id);

    expect(ids).toContain('recommission');
    expect(ids).toContain('reduced_capacity');
    expect(ids).toContain('risk_it');
  });

  it('includes planet name in the message', () => {
    const n = createPowerPlantEndOfLifeNotification(5000, 'New Eden', 'p1', 's1');

    expect(n.message).toContain('New Eden');
  });

  it('each choice has a description', () => {
    const n = createPowerPlantEndOfLifeNotification(5000, 'X', 'p1', 's1');

    for (const choice of n.choices!) {
      expect(choice.description).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('notification with empty preferences is shown', () => {
    const prefs: NotificationPreferences = { silencedTypes: new Set() };
    const n = createNotification('anomaly_discovered', 'Anomaly', 'msg', 1);

    expect(shouldShowNotification(n, prefs)).toBe(true);
  });

  it('created notification carries through choices correctly', () => {
    const choices = [
      { id: 'a', label: 'Option A', description: 'First option' },
      { id: 'b', label: 'Option B' },
    ];
    const n = createNotification('diplomatic_proposal', 'Treaty', 'msg', 10, choices);

    expect(n.choices).toHaveLength(2);
    expect(n.choices![0].description).toBe('First option');
    expect(n.choices![1].description).toBeUndefined();
  });
});
