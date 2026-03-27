/**
 * Client-side stub for the MigrationOrder type and helpers.
 *
 * The other agent is building the canonical `MigrationOrder` interface in
 * packages/shared.  Until those land, this file provides the types the client
 * UI and animation layer need so that TypeScript compilation succeeds today.
 *
 * Once the shared package exports MigrationOrder and the related functions,
 * replace this file with imports from '@nova-imperia/shared'.
 */

// ── MigrationOrder (stub) ─────────────────────────────────────────────────────

/**
 * Represents an active multi-turn migration from one planet to another within
 * the same star system.
 *
 * Mirrors the shape the engine agent is implementing in shared/engine/colony.ts.
 */
export interface MigrationOrder {
  /** Unique identifier for this migration. */
  id: string;
  /** The star system the migration is taking place in. */
  systemId: string;
  /** The planet that is providing the migrants. */
  sourcePlanetId: string;
  /** The planet being colonised. */
  targetPlanetId: string;
  /** Empire that initiated the migration. */
  empireId: string;
  /** Number of colonists that have arrived at the target so far. */
  arrivedPopulation: number;
  /** Total colonists needed before the colony is established. */
  threshold: number;
  /** Colonists lost in transit so far. */
  colonistsLost: number;
  /** Current wave number (1-indexed). */
  currentWave: number;
  /** Number of game ticks until the next wave departs. */
  ticksToNextWave: number;
  /** Human-readable status string. */
  status: 'in_progress' | 'completed' | 'cancelled';
}

// ── Client-side migration registry ───────────────────────────────────────────

/**
 * In-memory store for active migrations on the client.
 *
 * In the full implementation this data lives in GameTickState.migrationOrders
 * on the server and is synced to the client via engine events.  Until then,
 * the client manages it locally here.
 */
const _activeMigrations: MigrationOrder[] = [];

let _nextMigrationIndex = 0;

function generateMigrationId(): string {
  _nextMigrationIndex += 1;
  return `mig_${Date.now()}_${_nextMigrationIndex}`;
}

// Ticks (days) between each wave departure.
const WAVE_INTERVAL_TICKS = 3;
// Colonists dispatched per wave (source loses this, target gains survivors).
const COLONISTS_PER_WAVE = 2_500;
// Random mortality per wave: 1-5% of wave dies in transit.
const TRANSIT_LOSS_RATE_MIN = 0.01;
const TRANSIT_LOSS_RATE_MAX = 0.05;
// Kept for backwards compat — average loss rate for estimates.
const TRANSIT_LOSS_RATE = 0.03;
// Total colonists to transfer (migration completes when this many have departed).
const MIGRATION_THRESHOLD = 25_000;

/**
 * Start a new migration order.
 *
 * Returns the created MigrationOrder, or null if one is already active for
 * this target planet.
 */
export function createMigrationOrder(
  systemId: string,
  sourcePlanetId: string,
  targetPlanetId: string,
  empireId: string,
): MigrationOrder | null {
  // Only one active migration per target planet at a time.
  const existing = _activeMigrations.find(
    m => m.targetPlanetId === targetPlanetId && m.status === 'in_progress',
  );
  if (existing) return null;

  const order: MigrationOrder = {
    id: generateMigrationId(),
    systemId,
    sourcePlanetId,
    targetPlanetId,
    empireId,
    arrivedPopulation: 0,
    threshold: MIGRATION_THRESHOLD,
    colonistsLost: 0,
    currentWave: 0,
    ticksToNextWave: WAVE_INTERVAL_TICKS,
    status: 'in_progress',
  };

  _activeMigrations.push(order);
  return order;
}

/**
 * Advance all in-progress migrations by one game tick.
 *
 * Returns an array of wave-departure events for this tick (one entry per
 * migration that dispatched a wave).  These are used to spawn ship animations.
 */
export function tickMigrations(): Array<{
  migration: MigrationOrder;
  waveNumber: number;
  colonistsDispatched: number;
}> {
  const waveEvents: Array<{
    migration: MigrationOrder;
    waveNumber: number;
    colonistsDispatched: number;
  }> = [];

  for (let i = 0; i < _activeMigrations.length; i++) {
    const m = _activeMigrations[i]!;
    if (m.status !== 'in_progress') continue;

    m.ticksToNextWave -= 1;

    if (m.ticksToNextWave <= 0) {
      // Dispatch a wave — random 1-10% mortality per wave
      m.currentWave += 1;
      const remaining = m.threshold - m.arrivedPopulation - m.colonistsLost;
      const dispatched = Math.min(COLONISTS_PER_WAVE, Math.max(0, remaining));
      const mortalityRate = TRANSIT_LOSS_RATE_MIN + Math.random() * (TRANSIT_LOSS_RATE_MAX - TRANSIT_LOSS_RATE_MIN);
      const lost = Math.round(dispatched * mortalityRate);
      const arrived = dispatched - lost;
      m.colonistsLost += lost;
      m.arrivedPopulation += arrived;
      m.ticksToNextWave = WAVE_INTERVAL_TICKS;

      waveEvents.push({
        migration: m,
        waveNumber: m.currentWave,
        colonistsDispatched: dispatched,
      });

      // Complete when all colonists have been dispatched
      if (m.arrivedPopulation + m.colonistsLost >= m.threshold) {
        m.status = 'completed';
      }
    }
  }

  return waveEvents;
}

/**
 * Cancel an active migration by target planet ID.
 *
 * Returns true if a migration was found and cancelled.
 */
export function cancelMigration(targetPlanetId: string): boolean {
  const m = _activeMigrations.find(
    o => o.targetPlanetId === targetPlanetId && o.status === 'in_progress',
  );
  if (!m) return false;
  m.status = 'cancelled';
  return true;
}

/**
 * Get all active (in_progress) migrations, optionally filtered by systemId.
 */
export function getActiveMigrations(systemId?: string): MigrationOrder[] {
  return _activeMigrations.filter(
    m => m.status === 'in_progress' && (systemId === undefined || m.systemId === systemId),
  );
}

/**
 * Estimate how many total waves are needed given the current threshold and
 * per-wave delivery rate.
 */
export function estimateTotalWaves(): number {
  const effectivePerWave = COLONISTS_PER_WAVE * (1 - TRANSIT_LOSS_RATE);
  return Math.ceil(MIGRATION_THRESHOLD / effectivePerWave);
}

export { MIGRATION_THRESHOLD, WAVE_INTERVAL_TICKS, COLONISTS_PER_WAVE };
