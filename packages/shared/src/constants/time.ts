/**
 * Time constants for Ex Nihilo.
 *
 * 1 game tick = 1 day.
 * Ground combat ticks run at 100x resolution (1 ground tick = ~14.4 minutes).
 */

/** Number of game ticks per in-game day. */
export const TICKS_PER_DAY = 1;

/** Number of game ticks per in-game year (365 days). */
export const TICKS_PER_YEAR = 365;

/** Number of game ticks per in-game month (~30 days). */
export const TICKS_PER_MONTH = 30;

/** Number of ground combat ticks per game tick. */
export const GROUND_COMBAT_TICKS_PER_DAY = 100;

/** Election interval in ticks (every 4 years). */
export const ELECTION_INTERVAL = TICKS_PER_YEAR * 4;

/** Default non-aggression pact duration (5 years). */
export const DEFAULT_NAP_DURATION = TICKS_PER_YEAR * 5;

/** Trade route establishment period (30 days). */
export const TRADE_ROUTE_ESTABLISHMENT = TICKS_PER_MONTH;

/** Grievance slight decay — fully decayed in ~50 days. */
export const GRIEVANCE_SLIGHT_DECAY = 2.0;

/** Grievance offence decay — fully decayed in ~200 days. */
export const GRIEVANCE_OFFENCE_DECAY = 0.5;

/** Grievance major decay — fully decayed in ~1000 days (~3 years). */
export const GRIEVANCE_MAJOR_DECAY = 0.1;

/** Grievance existential — never decays. */
export const GRIEVANCE_EXISTENTIAL_DECAY = 0.0;

/**
 * Convert a tick number to a human-readable date string.
 * Year 1, Day 1 starts at tick 0.
 */
export function tickToDate(tick: number): string {
  const year = Math.floor(tick / TICKS_PER_YEAR) + 1;
  const day = (tick % TICKS_PER_YEAR) + 1;
  return `Year ${year}, Day ${day}`;
}

/**
 * Convert a tick number to just the year.
 */
export function tickToYear(tick: number): number {
  return Math.floor(tick / TICKS_PER_YEAR) + 1;
}

/**
 * Convert a duration in ticks to a human-readable string.
 */
export function tickDurationToString(ticks: number): string {
  if (ticks >= TICKS_PER_YEAR) {
    const years = Math.floor(ticks / TICKS_PER_YEAR);
    const remainingDays = ticks % TICKS_PER_YEAR;
    if (remainingDays === 0) return `${years} year${years !== 1 ? 's' : ''}`;
    return `${years} year${years !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  }
  if (ticks >= TICKS_PER_MONTH) {
    const months = Math.floor(ticks / TICKS_PER_MONTH);
    const remainingDays = ticks % TICKS_PER_MONTH;
    if (remainingDays === 0) return `${months} month${months !== 1 ? 's' : ''}`;
    return `${months} month${months !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  }
  return `${ticks} day${ticks !== 1 ? 's' : ''}`;
}
