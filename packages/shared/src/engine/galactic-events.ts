/**
 * Galactic Events — random galaxy-wide events that create strategic disruption.
 *
 * Events fire based on probability rolls each tick and affect all empires.
 * Inspired by real-world space phenomena: solar storms, asteroid impacts,
 * gamma ray bursts, and interstellar anomalies.
 */

import type { GameTickState } from '../types/game-state.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GalacticEvent {
  id: string;
  type: GalacticEventType;
  name: string;
  description: string;
  /** Tick the event started. */
  startTick: number;
  /** How many ticks the event lasts. */
  duration: number;
  /** Affected system IDs (empty = galaxy-wide). */
  affectedSystems: string[];
  /** Severity 1-5 (1 = minor, 5 = catastrophic). */
  severity: number;
}

export type GalacticEventType =
  | 'solar_storm'        // Disables shields, damages sensors, debris damage spikes
  | 'asteroid_shower'    // Random system gets debris + mineral bonus
  | 'subspace_disruption' // Warp travel slowed across the galaxy
  | 'radiation_burst'    // Population growth halved in affected systems
  | 'precursor_signal';  // Research bonus for empires that investigate

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Chance per tick of a galactic event firing (0.001 = 0.1% per tick). */
const EVENT_CHANCE_PER_TICK = 0.002;

/** Minimum ticks between events to prevent spam. */
const MIN_TICKS_BETWEEN_EVENTS = 100;

// ---------------------------------------------------------------------------
// Event Templates
// ---------------------------------------------------------------------------

const EVENT_TEMPLATES: Array<{
  type: GalacticEventType;
  name: string;
  description: string;
  duration: number;
  severity: number;
  weight: number; // Relative probability
}> = [
  {
    type: 'solar_storm',
    name: 'Solar Storm',
    description: 'A massive coronal mass ejection sweeps across the sector. Shield systems are disrupted and sensor arrays are degraded. Ships in debris fields are at increased risk.',
    duration: 15,
    severity: 3,
    weight: 3,
  },
  {
    type: 'asteroid_shower',
    name: 'Asteroid Shower',
    description: 'A rogue asteroid cluster passes through a star system, depositing mineral-rich fragments but increasing orbital debris.',
    duration: 10,
    severity: 2,
    weight: 4,
  },
  {
    type: 'subspace_disruption',
    name: 'Subspace Disruption',
    description: 'Unusual gravitational waves distort wormhole pathways across the galaxy. All interstellar travel takes longer until the disruption subsides.',
    duration: 20,
    severity: 2,
    weight: 2,
  },
  {
    type: 'radiation_burst',
    name: 'Gamma Ray Burst',
    description: 'A distant magnetar emits a powerful gamma ray burst that bathes several systems in harmful radiation. Population growth is suppressed in affected systems.',
    duration: 25,
    severity: 4,
    weight: 1,
  },
  {
    type: 'precursor_signal',
    name: 'Precursor Signal Detected',
    description: 'Deep-space listening stations detect a repeating signal of unknown origin. Empires that investigate may unlock ancient knowledge.',
    duration: 30,
    severity: 1,
    weight: 2,
  },
];

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

/**
 * Roll for a new galactic event and process active events.
 *
 * Returns the updated active events list and any new event that fired.
 */
export function processGalacticEvents(
  activeEvents: GalacticEvent[],
  tick: number,
  systemCount: number,
  systemIds: string[],
): { activeEvents: GalacticEvent[]; newEvent: GalacticEvent | null } {
  // Remove expired events
  const stillActive = activeEvents.filter(e => tick < e.startTick + e.duration);

  // Check cooldown
  const lastEventTick = activeEvents.length > 0
    ? Math.max(...activeEvents.map(e => e.startTick))
    : -MIN_TICKS_BETWEEN_EVENTS;

  if (tick - lastEventTick < MIN_TICKS_BETWEEN_EVENTS) {
    return { activeEvents: stillActive, newEvent: null };
  }

  // Roll for new event
  if (Math.random() > EVENT_CHANCE_PER_TICK) {
    return { activeEvents: stillActive, newEvent: null };
  }

  // Weighted random selection
  const totalWeight = EVENT_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = EVENT_TEMPLATES[0]!;
  for (const template of EVENT_TEMPLATES) {
    roll -= template.weight;
    if (roll <= 0) { selected = template; break; }
  }

  // Determine affected systems
  let affected: string[] = [];
  if (selected.type === 'asteroid_shower' || selected.type === 'radiation_burst') {
    // Affect 1-3 random systems
    const count = Math.min(systemIds.length, 1 + Math.floor(Math.random() * 3));
    const shuffled = [...systemIds].sort(() => Math.random() - 0.5);
    affected = shuffled.slice(0, count);
  }
  // solar_storm, subspace_disruption, precursor_signal are galaxy-wide (empty array)

  const newEvent: GalacticEvent = {
    id: `galactic-event-${tick}`,
    type: selected.type,
    name: selected.name,
    description: selected.description,
    startTick: tick,
    duration: selected.duration,
    affectedSystems: affected,
    severity: selected.severity,
  };

  return {
    activeEvents: [...stillActive, newEvent],
    newEvent,
  };
}

/**
 * Check if a galactic event of the given type is currently active.
 */
export function isEventActive(
  activeEvents: GalacticEvent[],
  type: GalacticEventType,
  tick: number,
  systemId?: string,
): boolean {
  return activeEvents.some(e =>
    e.type === type &&
    tick >= e.startTick &&
    tick < e.startTick + e.duration &&
    (e.affectedSystems.length === 0 || (systemId ? e.affectedSystems.includes(systemId) : true)),
  );
}
