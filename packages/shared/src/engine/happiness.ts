/**
 * Happiness engine — pure functions for per-planet happiness scoring and
 * the game-loop effects that flow from it.
 *
 * Happiness is a composite score (0–100) that reflects the wellbeing of a
 * planet's population. It is recalculated each tick from first principles;
 * there is no persistent happiness state to manage.
 *
 * Effects by threshold:
 *   > 70  — bonus growth (+20 % population growth multiplier)
 *   30–70 — neutral (no modifier)
 *   < 30  — unrest (production penalty: ×0.5 on all non-credit output)
 *   < 10  — revolt (population loss each tick)
 */

import type { Planet } from '../types/galaxy.js';
import type { EmpireResources } from '../types/resources.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Happiness threshold above which a bonus growth modifier applies. */
export const HAPPINESS_BONUS_THRESHOLD = 70;

/** Happiness threshold below which unrest applies (production ×0.5). */
export const HAPPINESS_UNREST_THRESHOLD = 30;

/** Happiness threshold below which revolt causes population loss. */
export const HAPPINESS_REVOLT_THRESHOLD = 10;

/** Production multiplier applied when a planet is in unrest. */
export const UNREST_PRODUCTION_MULTIPLIER = 0.5;

/** Growth multiplier bonus applied when happiness exceeds the bonus threshold. */
export const HAPPINESS_GROWTH_BONUS = 0.2;

/** Fraction of current population lost per tick during revolt. */
export const REVOLT_POPULATION_LOSS_FRACTION = 0.01;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HappinessReport {
  /** Composite happiness score (0–100, integer). */
  score: number;
  /** Whether the planet is in unrest (score < HAPPINESS_UNREST_THRESHOLD). */
  isUnrest: boolean;
  /** Whether the planet is in revolt (score < HAPPINESS_REVOLT_THRESHOLD). */
  isRevolt: boolean;
  /** Whether the bonus growth threshold is met (score > HAPPINESS_BONUS_THRESHOLD). */
  hasBonusGrowth: boolean;
  /** Production multiplier to apply to non-credit output (0.5 when in unrest, 1.0 otherwise). */
  productionMultiplier: number;
  /** Population growth multiplier modifier (additive on top of 1.0 base). */
  growthModifier: number;
  /** Population units lost this tick due to revolt (0 when not in revolt). */
  revoltPopulationLoss: number;
  /** Breakdown of each factor's contribution (positive or negative). */
  factors: HappinessFactor[];
}

export interface HappinessFactor {
  /** Human-readable label for display in the UI. */
  label: string;
  /** Happiness points contributed by this factor (may be negative). */
  points: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a value to the inclusive range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the happiness report for a single planet.
 *
 * Factors (all contribute to the 0–100 composite score):
 *
 * **Positive:**
 *   - Entertainment buildings: each `entertainment_complex` adds +10 pts per level.
 *   - Low overcrowding (population below 50 % of maximum) adds up to +10 pts.
 *
 * **Negative:**
 *   - Overcrowding: population > 80 % of max → −10 pts; > 95 % → −20 pts.
 *   - Energy deficit (empire energy stockpile = 0) → −15 pts.
 *   - No organics in empire stockpile → −20 pts (starvation).
 *   - At war → −10 pts.
 *   - High taxes (implicit in population × tax rate, here represented as a
 *     linear penalty based on population density as a proxy): −5 pts flat.
 *
 * The base score before modifiers is 60 (neutral/stable colony).
 *
 * @param planet           The planet to evaluate.
 * @param empireResources  The owning empire's current resource stockpiles.
 * @param isAtWar          True when the empire is actively at war with any other empire.
 */
export function calculatePlanetHappiness(
  planet: Planet,
  empireResources: EmpireResources,
  isAtWar: boolean,
): HappinessReport {
  const factors: HappinessFactor[] = [];
  let score = 60; // Baseline for a stable colony

  // ── Entertainment buildings ──────────────────────────────────────────────
  for (const building of planet.buildings) {
    if (building.type === 'entertainment_complex') {
      const pts = 10 * building.level;
      score += pts;
      factors.push({ label: 'Entertainment Complex', points: pts });
    }
  }

  // ── Overcrowding ─────────────────────────────────────────────────────────
  if (planet.maxPopulation > 0) {
    const density = planet.currentPopulation / planet.maxPopulation;

    if (density > 0.95) {
      const pts = -20;
      score += pts;
      factors.push({ label: 'Severe overcrowding', points: pts });
    } else if (density > 0.80) {
      const pts = -10;
      score += pts;
      factors.push({ label: 'Overcrowding', points: pts });
    } else if (density < 0.50 && planet.currentPopulation > 0) {
      // Plenty of room — colonists feel spacious
      const pts = 10;
      score += pts;
      factors.push({ label: 'Ample living space', points: pts });
    }
  }

  // ── Energy deficit ────────────────────────────────────────────────────────
  if (empireResources.energy <= 0) {
    const pts = -15;
    score += pts;
    factors.push({ label: 'Energy deficit', points: pts });
  }

  // ── Food / organics shortage ──────────────────────────────────────────────
  if (empireResources.organics <= 0) {
    const pts = -20;
    score += pts;
    factors.push({ label: 'Food shortage', points: pts });
  }

  // ── War ───────────────────────────────────────────────────────────────────
  if (isAtWar) {
    const pts = -10;
    score += pts;
    factors.push({ label: 'At war', points: pts });
  }

  // ── Tax burden ────────────────────────────────────────────────────────────
  // Flat penalty representing general taxation discontent.
  {
    const pts = -5;
    score += pts;
    factors.push({ label: 'Taxation', points: pts });
  }

  // ── Clamp and compute derived values ─────────────────────────────────────
  score = clamp(Math.round(score), 0, 100);

  const isRevolt = score < HAPPINESS_REVOLT_THRESHOLD;
  const isUnrest = score < HAPPINESS_UNREST_THRESHOLD;
  const hasBonusGrowth = score > HAPPINESS_BONUS_THRESHOLD;

  const productionMultiplier = isUnrest ? UNREST_PRODUCTION_MULTIPLIER : 1.0;
  const growthModifier = hasBonusGrowth ? HAPPINESS_GROWTH_BONUS : 0;

  // Revolt: lose 1 % of population per tick (minimum 1 person).
  const revoltPopulationLoss =
    isRevolt && planet.currentPopulation > 0
      ? Math.max(1, Math.floor(planet.currentPopulation * REVOLT_POPULATION_LOSS_FRACTION))
      : 0;

  return {
    score,
    isUnrest,
    isRevolt,
    hasBonusGrowth,
    productionMultiplier,
    growthModifier,
    revoltPopulationLoss,
    factors,
  };
}

/**
 * Determine whether an empire is currently at war with any other empire.
 *
 * Convenience helper used by the game loop before calling
 * `calculatePlanetHappiness`.
 */
export function empireIsAtWar(
  empire: { diplomacy: Array<{ status: string }> },
): boolean {
  return empire.diplomacy.some(rel => rel.status === 'at_war');
}
