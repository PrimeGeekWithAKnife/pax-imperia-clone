/**
 * Victory conditions and score tracking.
 *
 * All functions are pure / side-effect-free.  The game loop calls
 * checkVictoryConditions once per tick; calculateVictoryProgress is
 * intended for UI display.
 *
 * Victory conditions (enabled via GameConfig.victoryCriteria):
 *  - conquest    : Control 75 % of all colonised planets.
 *  - economic    : Hold 10× more credits than any rival for 50 consecutive ticks.
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
  type: 'conquest' | 'economic' | 'technological' | 'diplomatic';
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

/** Fraction of colonised planets an empire must control for a conquest victory. */
const CONQUEST_THRESHOLD = 0.75;

/** Credit multiplier over the nearest rival required for an economic victory. */
const ECONOMIC_CREDIT_MULTIPLIER = 10;

/** Number of consecutive ticks the empire must maintain the credit lead. */
const ECONOMIC_DURATION_TICKS = 50;

/** Ordered list of tech ages for scoring purposes (index = relative advancement). */
const AGE_ORDER = [
  'diamond_age',
  'spatial_dark_age',
  'neo_renaissance',
  'fusion_age',
  'age_of_star_empires',
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
  const victoryConditions = buildVictoryConditionStatuses(
    empire,
    gameState,
    allEmpires,
    resourcesMap,
  );

  return { empireId: empire.id, scores, totalScore, victoryConditions };
}

// ---------------------------------------------------------------------------
// Individual condition helpers
// ---------------------------------------------------------------------------

function buildConquestStatus(empire: Empire, gameState: GameState): VictoryConditionStatus {
  const colonised = getColonisedPlanets(gameState.galaxy);
  const owned = getPlanetsOwnedBy(gameState.galaxy, empire.id).length;
  const fraction = colonised.length > 0 ? owned / colonised.length : 0;
  const progress = Math.min(100, Math.round((fraction / CONQUEST_THRESHOLD) * 100));

  // Conquest is only meaningful with at least 2 empires; a single-empire game
  // cannot "conquer" anyone.
  const hasRivals = gameState.empires.length >= 2;

  return {
    type: 'conquest',
    name: 'Galactic Conquest',
    description: `Control ${Math.round(CONQUEST_THRESHOLD * 100)}% of all colonised planets (${owned} / ${Math.ceil(colonised.length * CONQUEST_THRESHOLD)} needed).`,
    progress,
    isAchieved: hasRivals && fraction >= CONQUEST_THRESHOLD,
  };
}

function buildEconomicStatus(
  empire: Empire,
  allEmpires: Empire[],
  resourcesMap?: Map<string, EmpireResources>,
  economicLeadTicks?: Map<string, number>,
): VictoryConditionStatus {
  const myCredits = getCredits(empire, resourcesMap);
  const rivals = allEmpires.filter(e => e.id !== empire.id);
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

function buildDiplomaticStatus(empire: Empire, allEmpires: Empire[]): VictoryConditionStatus {
  const rivals = allEmpires.filter(e => e.id !== empire.id);
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

function buildVictoryConditionStatuses(
  empire: Empire,
  gameState: GameState,
  allEmpires: Empire[],
  resourcesMap?: Map<string, EmpireResources>,
  economicLeadTicks?: Map<string, number>,
  allTechCount?: number,
): VictoryConditionStatus[] {
  const techTotal = allTechCount ?? 0;
  return [
    buildConquestStatus(empire, gameState),
    buildEconomicStatus(empire, allEmpires, resourcesMap, economicLeadTicks),
    buildTechStatus(empire, techTotal),
    buildDiplomaticStatus(empire, allEmpires),
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
): VictoryCheckResult | null {
  const { empires, victoryCriteria } = gameState as GameState & {
    victoryCriteria?: string[];
  };

  // Determine which criteria are active.  If none are configured, enable all.
  const enabledCriteria = (victoryCriteria && victoryCriteria.length > 0)
    ? victoryCriteria
    : ['conquest', 'economic', 'technological', 'diplomatic'];

  for (const empire of empires) {
    // ── Conquest ────────────────────────────────────────────────────────────
    if (enabledCriteria.includes('conquest')) {
      const status = buildConquestStatus(empire, gameState);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'conquest' };
      }
    }

    // ── Economic ────────────────────────────────────────────────────────────
    if (enabledCriteria.includes('economic')) {
      const status = buildEconomicStatus(empire, empires, resourcesMap, economicLeadTicks);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'economic' };
      }
    }

    // ── Technological ───────────────────────────────────────────────────────
    if (enabledCriteria.includes('technological') || enabledCriteria.includes('research')) {
      const status = buildTechStatus(empire, allTechCount ?? 0);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'technological' };
      }
    }

    // ── Diplomatic ──────────────────────────────────────────────────────────
    if (enabledCriteria.includes('diplomatic')) {
      const status = buildDiplomaticStatus(empire, empires);
      if (status.isAchieved) {
        return { winner: empire.id, condition: 'diplomatic' };
      }
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
 */
export function updateEconomicLeadTicks(
  empires: Empire[],
  resourcesMap: Map<string, EmpireResources> | undefined,
  previous: Map<string, number>,
): Map<string, number> {
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
