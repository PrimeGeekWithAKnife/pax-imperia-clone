/**
 * Maslow Need Hierarchy Tracker
 *
 * Computes five need levels from empire state each tick.
 * The lowest unmet need dominates behaviour and can override personality.
 *
 * Hierarchy (lowest overrides all above):
 *  1. Physiological — food, energy, basic resources
 *  2. Safety — military security, territorial integrity
 *  3. Belonging — alliances, trade partners, treaties
 *  4. Esteem — galactic recognition, tech prestige, reputation
 *  5. Self-actualisation — victory progress, expansion, research milestones
 *
 * Design: pure functions. Empire state is passed in as a snapshot struct
 * so this module has no dependency on the game loop internals.
 */

import type { MaslowNeeds, AttachmentStyle } from '../../types/psychology.js';

// ---------------------------------------------------------------------------
// Empire state snapshot (input to Maslow computation)
// ---------------------------------------------------------------------------

/**
 * Minimal empire state needed to compute Maslow needs.
 * Extracted from the game tick state each tick by the integration layer.
 */
export interface EmpireStateSnapshot {
  /** Current game tick number. */
  currentTick: number;
  /** Total food stockpile in organics. */
  organics: number;
  /** Per-tick food production (can be negative if consuming more than producing). */
  foodBalance: number;
  /** Total energy stockpile. */
  energy: number;
  /** Total minerals stockpile. */
  minerals: number;
  /** Total credits. */
  credits: number;
  /** Number of colonised planets. */
  colonisedPlanets: number;
  /** Total population across all planets. */
  totalPopulation: number;
  /** Total military power (fleet strength). */
  militaryPower: number;
  /** Strongest rival's military power. */
  strongestRivalPower: number;
  /** Number of active wars. */
  activeWars: number;
  /** Whether homeworld is threatened (enemy fleet in system). */
  homeworldThreatened: boolean;
  /** Number of active treaties (any type). */
  activeTreaties: number;
  /** Number of allied empires. */
  allies: number;
  /** Number of trade routes. */
  tradeRoutes: number;
  /** Total empires in the game (for belonging/esteem context). */
  totalEmpires: number;
  /** Number of technologies researched. */
  techsResearched: number;
  /** Total technologies available. */
  totalTechs: number;
  /** Victory progress (0-100, highest across all active victory conditions). */
  victoryProgress: number;
}

// ---------------------------------------------------------------------------
// Need computation
// ---------------------------------------------------------------------------

/**
 * Compute Maslow needs from current empire state.
 * Each need is 0-100 where 0 = critically unmet, 100 = fully satisfied.
 */
export function computeMaslowNeeds(state: EmpireStateSnapshot): MaslowNeeds {
  return {
    physiological: computePhysiological(state),
    safety: computeSafety(state),
    belonging: computeBelonging(state),
    esteem: computeEsteem(state),
    selfActualisation: computeSelfActualisation(state),
  };
}

/**
 * Identify the lowest unmet need level. Returns the need key whose
 * value is the lowest. This is the need that should drive behaviour.
 */
export function lowestUnmetNeed(needs: MaslowNeeds): keyof MaslowNeeds {
  const entries: [keyof MaslowNeeds, number][] = [
    ['physiological', needs.physiological],
    ['safety', needs.safety],
    ['belonging', needs.belonging],
    ['esteem', needs.esteem],
    ['selfActualisation', needs.selfActualisation],
  ];

  // Return the lowest value; ties broken by hierarchy order (physiological wins)
  let lowest = entries[0];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i][1] < lowest[1]) {
      lowest = entries[i];
    }
  }
  return lowest[0];
}

/**
 * Check if a critical override is active (a need so low it overrides personality).
 * Returns the override level name, or null if no override is active.
 */
export function criticalNeedOverride(needs: MaslowNeeds): keyof MaslowNeeds | null {
  if (needs.physiological < 30) return 'physiological';
  if (needs.safety < 30) return 'safety';
  if (needs.belonging < 30) return 'belonging';
  return null;
}

/**
 * How belonging need deprivation affects mood by attachment style.
 * Returns a mood penalty multiplier (0 = no penalty, up to 3x for anxious).
 */
export function belongingDeprivationImpact(
  belongingNeed: number,
  attachmentStyle: AttachmentStyle,
): number {
  if (belongingNeed >= 50) return 0;

  const deficit = (50 - belongingNeed) / 50; // 0 to 1

  switch (attachmentStyle) {
    case 'anxious':          return deficit * 3.0;  // Panic — "they don't love me anymore"
    case 'fearful_avoidant': return deficit * 2.0;  // Distress but confused about it
    case 'secure':           return deficit * 1.0;  // Proportionate concern
    case 'avoidant':         return deficit * 0.3;  // "I don't need anyone" (but quietly suffers)
  }
}

// ---------------------------------------------------------------------------
// Individual need computations
// ---------------------------------------------------------------------------

/**
 * Physiological: food, energy, basic resources.
 * Critically low when starving or resource-depleted.
 */
function computePhysiological(state: EmpireStateSnapshot): number {
  let score = 100;

  // Food: most critical physiological need
  if (state.foodBalance < 0) {
    // Negative food balance — starving
    const ticksUntilEmpty = state.organics > 0
      ? state.organics / Math.abs(state.foodBalance)
      : 0;
    if (ticksUntilEmpty < 10) score -= 60;
    else if (ticksUntilEmpty < 50) score -= 30;
    else score -= 10;
  }

  if (state.organics < 100) score -= 20;

  // Energy
  if (state.energy < 50) score -= 15;

  // Minerals
  if (state.minerals < 50) score -= 10;

  // Credits
  if (state.credits < 100) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Safety: military security, territorial integrity.
 * Low when outgunned, at war, or homeworld threatened.
 */
function computeSafety(state: EmpireStateSnapshot): number {
  let score = 100;

  // Military power ratio vs strongest rival
  if (state.strongestRivalPower > 0) {
    const ratio = state.militaryPower / state.strongestRivalPower;
    if (ratio < 0.3) score -= 40;       // Severely outgunned
    else if (ratio < 0.6) score -= 25;  // Outmatched
    else if (ratio < 0.8) score -= 10;  // Slightly weaker
  }

  // Active wars
  if (state.activeWars > 0) {
    score -= 15 * Math.min(state.activeWars, 3);
  }

  // Homeworld threat
  if (state.homeworldThreatened) score -= 30;

  // Small territory is vulnerable
  if (state.colonisedPlanets <= 1) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Belonging: alliances, trade partners, cultural exchange.
 * Low when isolated, no treaties, few friends.
 */
function computeBelonging(state: EmpireStateSnapshot): number {
  let score = 30; // Start at 30 — you have to earn belonging

  // Treaties provide connection
  score += Math.min(state.activeTreaties * 8, 30);

  // Allies are the strongest belonging signal
  score += Math.min(state.allies * 15, 30);

  // Trade routes represent ongoing cooperation
  score += Math.min(state.tradeRoutes * 5, 15);

  // Being completely isolated is devastating
  if (state.activeTreaties === 0 && state.allies === 0 && state.tradeRoutes === 0) {
    score = Math.min(score, 15);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Esteem: galactic recognition, technological prestige, reputation.
 * Grows with tech advancement, territory, and diplomatic standing.
 */
function computeEsteem(state: EmpireStateSnapshot): number {
  let score = 30;

  // Technology prestige
  const techRatio = state.totalTechs > 0
    ? state.techsResearched / state.totalTechs
    : 0;
  score += Math.round(techRatio * 30);

  // Territory prestige (having many planets)
  score += Math.min(state.colonisedPlanets * 3, 20);

  // Military reputation (being strong)
  if (state.strongestRivalPower > 0) {
    const ratio = state.militaryPower / state.strongestRivalPower;
    if (ratio > 1.5) score += 15;
    else if (ratio > 1.0) score += 8;
  }

  // Diplomatic standing (having allies respects you)
  score += Math.min(state.allies * 5, 10);

  return Math.max(0, Math.min(100, score));
}

/**
 * Self-actualisation: victory progress, expansion, research milestones.
 * The highest-level need — only matters when lower needs are met.
 */
function computeSelfActualisation(state: EmpireStateSnapshot): number {
  let score = 20;

  // Victory progress is the ultimate self-actualisation measure
  score += Math.round(state.victoryProgress * 0.5);

  // Technological achievement
  const techRatio = state.totalTechs > 0
    ? state.techsResearched / state.totalTechs
    : 0;
  score += Math.round(techRatio * 20);

  // Expansion (having many planets = manifest destiny)
  score += Math.min(state.colonisedPlanets * 2, 15);

  return Math.max(0, Math.min(100, score));
}
