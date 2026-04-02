/**
 * Victory conditions and score tracking.
 *
 * All functions are pure / side-effect-free.  The game loop calls
 * checkVictoryConditions once per tick; calculateVictoryProgress is
 * intended for UI display.
 *
 * Victory conditions (enabled via GameConfig.victoryCriteria):
 *  - conquest    : Control 75 % of all colonisable planets AND eliminate 75 % of rival empires.
 *  - dominance   : Lead the Galactic Council AND own 50 % of habitable planets.
 *  - economic    : Hold 3× more credits than any rival for 100 consecutive ticks.
 *  - technological: Research the Ascension Project (final tech).
 *  - diplomatic  : Hold an alliance with every surviving empire.
 */

import type { GameState } from '../types/game-state.js';
import type { Empire } from '../types/species.js';
import type { EmpireResources } from '../types/resources.js';
import type { StarSystem } from '../types/galaxy.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VictoryScores {
  military: number;     // fleet power + controlled systems
  economic: number;     // total credits + trade income proxy
  technology: number;   // techs researched + current age index
  territorial: number;  // planets controlled / total planets (0–100)
  diplomatic: number;   // alliance count + treaty count
}

export interface VictoryProgress {
  empireId: string;
  scores: VictoryScores;
  totalScore: number;
  victoryConditions: VictoryConditionStatus[];
}

export interface VictoryConditionStatus {
  type: 'conquest' | 'dominance' | 'economic' | 'technological' | 'diplomatic' | 'score';
  name: string;
  description: string;
  /** 0–100 completion percentage. */
  progress: number;
  isAchieved: boolean;
}

export interface VictoryCheckResult {
  winner: string;
  condition: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tech ID of the final technology; reaching this triggers the Tech victory. */
const ASCENSION_PROJECT_ID = 'ascension_project';

/** Fraction of colonisable planets an empire must control for a conquest victory. */
const CONQUEST_THRESHOLD = 0.75;

/** Fraction of habitable planets an empire must control for a dominance victory. */
const DOMINANCE_PLANET_THRESHOLD = 0.50;

/** Credit multiplier over the nearest rival required for an economic victory. */
const ECONOMIC_CREDIT_MULTIPLIER = 3;

/** Number of consecutive ticks the empire must maintain the credit lead. */
const ECONOMIC_DURATION_TICKS = 100;

/**
 * Minimum game age before victory conditions other than score can trigger.
 * Prevents trivial early wins from starting-condition asymmetry (e.g. a
 * species with 7B starting pop will have vastly more credits than one with
 * 250M from tick 1, but that is not a meaningful "economic victory").
 */
const VICTORY_MIN_TICK = 500;

/** Default tick limit for score victory — game ends and highest score wins. */
export const SCORE_TICK_LIMIT = 5000;

/** Ordered list of tech ages for scoring purposes (index = relative advancement). */
const AGE_ORDER = [
  'nano_atomic',
  'fusion',
  'nano_fusion',
  'anti_matter',
  'singularity',
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getAllPlanets(galaxy: GameState['galaxy']): GameState['galaxy']['systems'][0]['planets'] {
  return galaxy.systems.flatMap(s => s.planets);
}

function getColonisedPlanets(galaxy: GameState['galaxy']): ReturnType<typeof getAllPlanets> {
  return getAllPlanets(galaxy).filter(p => p.ownerId !== null);
}

function getPlanetsOwnedBy(
  galaxy: GameState['galaxy'],
  empireId: string,
): ReturnType<typeof getAllPlanets> {
  return getAllPlanets(galaxy).filter(p => p.ownerId === empireId);
}

function getSystemsOwnedBy(galaxy: GameState['galaxy'], empireId: string): StarSystem[] {
  return galaxy.systems.filter(s => s.ownerId === empireId);
}

function ageIndex(age: string): number {
  const idx = (AGE_ORDER as readonly string[]).indexOf(age);
  return idx === -1 ? 0 : idx;
}

/** Return the empire's credits from the resource map if provided, falling back to Empire.credits. */
function getCredits(empire: Empire, resourcesMap?: Map<string, EmpireResources>): number {
  return resourcesMap?.get(empire.id)?.credits ?? empire.credits;
}

/** Count active alliances the empire holds. */
function countAlliances(empire: Empire): number {
  return empire.diplomacy.filter(
    rel => rel.status === 'allied' || rel.treaties.some(t => t.type === 'alliance'),
  ).length;
}

/** Count all treaties (any type) held by the empire. */
function countTreaties(empire: Empire): number {
  return empire.diplomacy.reduce((sum, rel) => sum + rel.treaties.length, 0);
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a VictoryProgress snapshot for a single empire.
 *
 * @param empire       The empire to score.
 * @param gameState    Full game state (for galaxy / fleet counts).
 * @param allEmpires   All empires (used for relative economic scoring).
 * @param resourcesMap Optional per-empire resource stockpile (for accurate credits).
 */
export function calculateVictoryProgress(
  empire: Empire,
  gameState: GameState,
  allEmpires: Empire[],
  resourcesMap?: Map<string, EmpireResources>,
): VictoryProgress {
  const { galaxy, fleets, ships } = gameState;

  // ── Military ─────────────────────────────────────────────────────────────
  const empireFleetIds = new Set(
    fleets.filter(f => f.empireId === empire.id).map(f => f.id),
  );
  const shipCount = ships.filter(
    s => s.fleetId !== null && empireFleetIds.has(s.fleetId),
  ).length;
  const controlledSystemCount = getSystemsOwnedBy(galaxy, empire.id).length;
  const militaryScore = shipCount * 2 + controlledSystemCount * 10;

  // ── Economic ─────────────────────────────────────────────────────────────
  const credits = getCredits(empire, resourcesMap);
  const tradeRoutes = empire.diplomacy.reduce((sum, rel) => sum + (rel.tradeRoutes ?? 0), 0);
  const economicScore = Math.round(credits / 100) + tradeRoutes * 5;

  // ── Technology ───────────────────────────────────────────────────────────
  const techCount = empire.technologies.length;
  const age = ageIndex(empire.currentAge);
  const technologyScore = techCount * 3 + age * 20;

  // ── Territorial ──────────────────────────────────────────────────────────
  const colonisedPlanets = getColonisedPlanets(galaxy);
  const ownedPlanets = getPlanetsOwnedBy(galaxy, empire.id).length;
  const territorialFraction =
    colonisedPlanets.length > 0 ? ownedPlanets / colonisedPlanets.length : 0;
  const territorialScore = Math.round(territorialFraction * 100);

  // ── Diplomatic ───────────────────────────────────────────────────────────
  const allianceCount = countAlliances(empire);
  const treatyCount = countTreaties(empire);
  const diplomaticScore = allianceCount * 15 + treatyCount * 5;

  const scores: VictoryScores = {
    military: militaryScore,
    economic: economicScore,
    technology: technologyScore,
    territorial: territorialScore,
    diplomatic: diplomaticScore,
  };

  const totalScore =
    scores.military +
    scores.economic +
    scores.technology +
    scores.territorial +
    scores.diplomatic;

  // ── Victory condition statuses ────────────────────────────────────────────
  // Estimate total tech count from all empires' max tech count (best available proxy)
  const maxTechCount = Math.max(1, ...allEmpires.map(e => e.technologies.length), 300);
  const victoryConditions = buildVictoryConditionStatuses(
    empire,
    gameState,
    allEmpires,
    resourcesMap,
    undefined, // economicLeadTicks
    maxTechCount,
  );

  return { empireId: empire.id, scores, totalScore, victoryConditions };
}

// ---------------------------------------------------------------------------
// Individual condition helpers
// ---------------------------------------------------------------------------

function buildConquestStatus(empire: Empire, gameState: GameState): VictoryConditionStatus {
  // Conquest requires:
  //  1. Control 75% of all COLONISABLE planets (maxPopulation > 0), not just colonised ones
  //  2. Eliminate 75% of rival empires
  //
  // This means you can't win by just grabbing empty planets — you must
  // actually conquer most of the galaxy AND destroy most of your rivals.
  const allPlanets = getAllPlanets(gameState.galaxy);
  const colonisable = allPlanets.filter(p => p.maxPopulation > 0);
  const owned = colonisable.filter(p => p.ownerId === empire.id).length;
  const planetFraction = colonisable.length > 0 ? owned / colonisable.length : 0;

  // Rival elimination: 75% of other empires must have 0 planets
  const rivals = gameState.empires.filter(e => e.id !== empire.id);
  const eliminatedRivals = rivals.filter(
    e => getPlanetsOwnedBy(gameState.galaxy, e.id).length === 0,
  ).length;
  const rivalFraction = rivals.length > 0 ? eliminatedRivals / rivals.length : 0;

  // Progress: average of planet control and rival elimination
  const planetProgress = Math.min(100, Math.round((planetFraction / CONQUEST_THRESHOLD) * 100));
  const rivalProgress = Math.min(100, Math.round((rivalFraction / CONQUEST_THRESHOLD) * 100));
  const progress = Math.round((planetProgress + rivalProgress) / 2);

  const hasRivals = rivals.length > 0;
  const planetsMet = planetFraction >= CONQUEST_THRESHOLD;
  const rivalsMet = rivalFraction >= CONQUEST_THRESHOLD;

  return {
    type: 'conquest',
    name: 'Galactic Conquest',
    description: `Control ${Math.round(CONQUEST_THRESHOLD * 100)}% of colonisable planets (${owned}/${Math.ceil(colonisable.length * CONQUEST_THRESHOLD)}) and eliminate ${Math.round(CONQUEST_THRESHOLD * 100)}% of rivals (${eliminatedRivals}/${Math.ceil(rivals.length * CONQUEST_THRESHOLD)}).`,
    progress,
    isAchieved: hasRivals && planetsMet && rivalsMet,
  };
}

/**
 * Dominance victory: lead the Galactic Council AND own 50% of habitable planets.
 *
 * This represents soft power — you don't need to eliminate rivals, but you
 * need both political supremacy (elected council leader) and territorial
 * superiority (half the galaxy under your control). A diplomatic conqueror.
 */
function buildDominanceStatus(
  empire: Empire,
  gameState: GameState,
  councilLeaderEmpireId: string | null,
): VictoryConditionStatus {
  // Planet check: 50% of all colonisable planets
  const allPlanets = getAllPlanets(gameState.galaxy);
  const colonisable = allPlanets.filter(p => p.maxPopulation > 0);
  const owned = colonisable.filter(p => p.ownerId === empire.id).length;
  const planetFraction = colonisable.length > 0 ? owned / colonisable.length : 0;
  const planetsMet = planetFraction >= DOMINANCE_PLANET_THRESHOLD;

  // Council leadership check
  const isCouncilLeader = councilLeaderEmpireId === empire.id;

  // Progress: weighted 50/50 between planets and leadership
  const planetProgress = Math.min(100, Math.round((planetFraction / DOMINANCE_PLANET_THRESHOLD) * 100));
  const leaderProgress = isCouncilLeader ? 100 : 0;
  const progress = Math.round((planetProgress + leaderProgress) / 2);

  const planetNeeded = Math.ceil(colonisable.length * DOMINANCE_PLANET_THRESHOLD);

  return {
    type: 'dominance',
    name: 'Galactic Dominance',
    description: `Lead the Galactic Council (${isCouncilLeader ? 'Yes' : 'No'}) and control ${Math.round(DOMINANCE_PLANET_THRESHOLD * 100)}% of habitable planets (${owned}/${planetNeeded}).`,
    progress,
    isAchieved: isCouncilLeader && planetsMet,
  };
}

function buildEconomicStatus(
  empire: Empire,
  allEmpires: Empire[],
  resourcesMap?: Map<string, EmpireResources>,
  economicLeadTicks?: Map<string, number>,
  galaxy?: GameState['galaxy'],
): VictoryConditionStatus {
  const myCredits = getCredits(empire, resourcesMap);
  // Exclude eliminated empires (those with 0 planets) from rival calculation.
  const rivals = allEmpires.filter(e =>
    e.id !== empire.id && (!galaxy || getPlanetsOwnedBy(galaxy, e.id).length > 0),
  );
  const maxRivalCredits = rivals.length > 0
    ? Math.max(...rivals.map(e => getCredits(e, resourcesMap)))
    : 0;

  // Economic dominance requires at least one rival to surpass.
  const hasRivals = rivals.length > 0;
  const hasLead = hasRivals && (maxRivalCredits === 0
    ? myCredits > 0
    : myCredits >= maxRivalCredits * ECONOMIC_CREDIT_MULTIPLIER);

  const ticksWithLead = economicLeadTicks?.get(empire.id) ?? 0;
  const progress = hasLead
    ? Math.min(100, Math.round((ticksWithLead / ECONOMIC_DURATION_TICKS) * 100))
    : 0;

  return {
    type: 'economic',
    name: 'Economic Dominance',
    description: `Maintain ${ECONOMIC_CREDIT_MULTIPLIER}× more credits than any rival for ${ECONOMIC_DURATION_TICKS} consecutive ticks (${ticksWithLead} / ${ECONOMIC_DURATION_TICKS} ticks held).`,
    progress,
    isAchieved: hasRivals && ticksWithLead >= ECONOMIC_DURATION_TICKS,
  };
}

function buildTechStatus(empire: Empire, allTechCount: number): VictoryConditionStatus {
  const hasAscension = empire.technologies.includes(ASCENSION_PROJECT_ID);
  const techCount = empire.technologies.length;
  const progress = hasAscension
    ? 100
    : allTechCount > 0
      ? Math.min(99, Math.round((techCount / allTechCount) * 100))
      : 0;

  return {
    type: 'technological',
    name: 'Technological Ascension',
    description: `Research the Ascension Project — the pinnacle of known science.`,
    progress,
    isAchieved: hasAscension,
  };
}

function buildDiplomaticStatus(
  empire: Empire,
  allEmpires: Empire[],
  galaxy?: GameState['galaxy'],
): VictoryConditionStatus {
  // Exclude eliminated empires (those with 0 planets) — you cannot ally with the dead.
  const rivals = allEmpires.filter(e =>
    e.id !== empire.id && (!galaxy || getPlanetsOwnedBy(galaxy, e.id).length > 0),
  );
  const alliedCount = rivals.filter(rival =>
    empire.diplomacy.some(
      rel =>
        rel.empireId === rival.id &&
        (rel.status === 'allied' || rel.treaties.some(t => t.type === 'alliance')),
    ),
  ).length;

  const progress =
    rivals.length > 0 ? Math.round((alliedCount / rivals.length) * 100) : 100;

  return {
    type: 'diplomatic',
    name: 'Galactic Federation',
    description: `Form alliances with all surviving empires (${alliedCount} / ${rivals.length} allied).`,
    progress,
    isAchieved: rivals.length > 0 && alliedCount >= rivals.length,
  };
}

/**
 * Lightweight score calculation that does NOT call calculateVictoryProgress
 * (which would create infinite recursion via buildVictoryConditionStatuses).
 * Mirrors the same scoring logic inline.
 */
function quickTotalScore(
  empire: Empire,
  gameState: GameState,
  resourcesMap?: Map<string, EmpireResources>,
): number {
  const { galaxy, fleets, ships } = gameState;
  const empireFleetIds = new Set(fleets.filter(f => f.empireId === empire.id).map(f => f.id));
  const shipCount = ships.filter(s => s.fleetId !== null && empireFleetIds.has(s.fleetId)).length;
  const controlledSystemCount = getSystemsOwnedBy(galaxy, empire.id).length;
  const militaryScore = shipCount * 2 + controlledSystemCount * 10;

  const credits = getCredits(empire, resourcesMap);
  const tradeRoutes = empire.diplomacy.reduce((sum, rel) => sum + (rel.tradeRoutes ?? 0), 0);
  const economicScore = Math.round(credits / 100) + tradeRoutes * 5;

  const techCount = empire.technologies.length;
  const age = ageIndex(empire.currentAge);
  const technologyScore = techCount * 3 + age * 20;

  const colonisedPlanets = getColonisedPlanets(galaxy);
  const ownedPlanets = getPlanetsOwnedBy(galaxy, empire.id).length;
  const territorialFraction = colonisedPlanets.length > 0 ? ownedPlanets / colonisedPlanets.length : 0;
  const territorialScore = Math.round(territorialFraction * 100);

  const allianceCount = countAlliances(empire);
  const treatyCount = countTreaties(empire);
  const diplomaticScore = allianceCount * 15 + treatyCount * 5;

  return militaryScore + economicScore + technologyScore + territorialScore + diplomaticScore;
}

function buildScoreStatus(
  empire: Empire,
  gameState: GameState,
  allEmpires: Empire[],
  resourcesMap?: Map<string, EmpireResources>,
  tickLimit: number = SCORE_TICK_LIMIT,
): VictoryConditionStatus {
  const progress = Math.min(100, Math.round((gameState.currentTick / tickLimit) * 100));

  const myScore = quickTotalScore(empire, gameState, resourcesMap);

  // Check if this empire has the highest score among all active empires
  const activeEmpires = allEmpires.filter(
    e => getPlanetsOwnedBy(gameState.galaxy, e.id).length > 0,
  );
  let isHighest = true;
  for (const rival of activeEmpires) {
    if (rival.id === empire.id) continue;
    const rivalScore = quickTotalScore(rival, gameState, resourcesMap);
    if (rivalScore >= myScore) {
      isHighest = false;
      break;
    }
  }

  return {
    type: 'score',
    name: 'Score Victory',
    description: `Achieve the highest combined score by turn ${tickLimit} (current: ${myScore}).`,
    progress,
    isAchieved: gameState.currentTick >= tickLimit && isHighest,
  };
}

function buildVictoryConditionStatuses(
  empire: Empire,
  gameState: GameState,
  allEmpires: Empire[],
  resourcesMap?: Map<string, EmpireResources>,
  economicLeadTicks?: Map<string, number>,
  allTechCount?: number,
  councilLeaderEmpireId?: string | null,
): VictoryConditionStatus[] {
  const techTotal = allTechCount ?? 0;
  return [
    buildConquestStatus(empire, gameState),
    buildDominanceStatus(empire, gameState, councilLeaderEmpireId ?? null),
    buildEconomicStatus(empire, allEmpires, resourcesMap, economicLeadTicks, gameState.galaxy),
    buildTechStatus(empire, techTotal),
    buildDiplomaticStatus(empire, allEmpires, gameState.galaxy),
    buildScoreStatus(empire, gameState, allEmpires, resourcesMap),
  ];
}

// ---------------------------------------------------------------------------
// Victory checking
// ---------------------------------------------------------------------------

/**
 * Check whether any victory condition has been met this tick.
 *
 * The function evaluates every enabled victory criterion against every empire
 * and returns the first winner found, or null if no winner yet.
 *
 * @param gameState         Current game state.
 * @param resourcesMap      Per-empire resource stockpiles (for economic credits).
 * @param economicLeadTicks Per-empire consecutive-tick counters for economic victory.
 *                          The caller is responsible for incrementing / resetting these
 *                          each tick before calling checkVictoryConditions.
 * @param allTechCount      Total number of technologies in the tech tree (for tech victory).
 */
export function checkVictoryConditions(
  gameState: GameState,
  resourcesMap?: Map<string, EmpireResources>,
  economicLeadTicks?: Map<string, number>,
  allTechCount?: number,
  /** Empire ID of the current Galactic Council leader (for dominance victory). */
  councilLeaderEmpireId?: string | null,
): VictoryCheckResult | null {
  const { empires, victoryCriteria } = gameState;

  // Determine which criteria are active.  If none are configured, enable all.
  const enabledCriteria = (victoryCriteria && victoryCriteria.length > 0)
    ? victoryCriteria
    : ['conquest', 'dominance', 'economic', 'technological', 'diplomatic', 'score'];

  // ALL victory conditions require a minimum game age to prevent trivial
  // early wins. Conquest at tick 45 with no player interaction is not a
  // meaningful military achievement — it's the AI steamrolling a corner
  // of the galaxy before anyone gets started.
  const gameOldEnough = gameState.currentTick >= VICTORY_MIN_TICK;

  for (const empire of empires) {
    // ── Conquest ────────────────────────────────────────────────────────────
    if (gameOldEnough && enabledCriteria.includes('conquest')) {
      const status = buildConquestStatus(empire, gameState);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'conquest' };
      }
    }

    // ── Dominance ───────────────────────────────────────────────────────────
    if (gameOldEnough && enabledCriteria.includes('dominance')) {
      const status = buildDominanceStatus(empire, gameState, councilLeaderEmpireId ?? null);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'dominance' };
      }
    }

    // ── Economic ────────────────────────────────────────────────────────────
    if (gameOldEnough && enabledCriteria.includes('economic')) {
      const status = buildEconomicStatus(empire, empires, resourcesMap, economicLeadTicks, gameState.galaxy);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'economic' };
      }
    }

    // ── Technological ───────────────────────────────────────────────────────
    if (gameOldEnough && (enabledCriteria.includes('technological') || enabledCriteria.includes('research'))) {
      const status = buildTechStatus(empire, allTechCount ?? 0);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'technological' };
      }
    }

    // ── Diplomatic ──────────────────────────────────────────────────────────
    if (gameOldEnough && enabledCriteria.includes('diplomatic')) {
      const status = buildDiplomaticStatus(empire, empires, gameState.galaxy);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'diplomatic' };
      }
    }
  }

  // ── Score (timed) ───────────────────────────────────────────────────────
  // Checked outside the empire loop: only one empire can win score victory.
  if (enabledCriteria.includes('score') && gameState.currentTick >= SCORE_TICK_LIMIT) {
    // Find the active empire with the highest total score.
    let bestEmpireId: string | null = null;
    let bestScore = -1;
    for (const empire of empires) {
      // Skip eliminated empires
      if (getPlanetsOwnedBy(gameState.galaxy, empire.id).length === 0) continue;
      const total = quickTotalScore(empire, gameState, resourcesMap);
      if (total > bestScore) {
        bestScore = total;
        bestEmpireId = empire.id;
      }
    }
    if (bestEmpireId !== null) {
      return { winner: bestEmpireId, condition: 'score' };
    }
  }

  return null;
}

/**
 * Update the per-empire economic lead tick counters.
 *
 * Call this once per tick, before checkVictoryConditions, and persist the
 * returned map.  The key is empireId; the value is the number of consecutive
 * ticks the empire has maintained the required credit lead.
 *
 * The counter only starts accumulating after VICTORY_MIN_TICK to prevent
 * trivial wins from starting-condition credit asymmetry.
 *
 * @param currentTick Current game tick — counters are frozen before VICTORY_MIN_TICK.
 */
export function updateEconomicLeadTicks(
  empires: Empire[],
  resourcesMap: Map<string, EmpireResources> | undefined,
  previous: Map<string, number>,
  currentTick = 0,
): Map<string, number> {
  // Don't accumulate lead ticks before the victory gate opens — prevents
  // the counter from being already full the instant the gate lifts.
  if (currentTick < VICTORY_MIN_TICK) return previous;

  const result = new Map<string, number>(previous);

  for (const empire of empires) {
    const myCredits = getCredits(empire, resourcesMap);
    const rivals = empires.filter(e => e.id !== empire.id);
    const maxRivalCredits = rivals.length > 0
      ? Math.max(...rivals.map(e => getCredits(e, resourcesMap)))
      : 0;

    const hasLead = maxRivalCredits === 0
      ? myCredits > 0
      : myCredits >= maxRivalCredits * ECONOMIC_CREDIT_MULTIPLIER;

    result.set(empire.id, hasLead ? (result.get(empire.id) ?? 0) + 1 : 0);
  }

  return result;
}
