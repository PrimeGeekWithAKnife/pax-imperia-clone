/**
 * Strategic AI decision engine — pure functions for computer-player decision-making.
 *
 * Design principle: No cheating. The AI plays by the same rules as humans.
 * Higher difficulty should be achieved by better decision quality, not resource
 * bonuses. All functions are side-effect-free.
 */

import type { Empire, Species, AIPersonality, DiplomaticStatus, GovernmentType } from '../types/species.js';
import type { Galaxy, Planet, BuildingType } from '../types/galaxy.js';
import type { GameState, VictoryCriteria } from '../types/game-state.js';
import type { Fleet, Ship, HullClass } from '../types/ships.js';
import type { Technology } from '../types/technology.js';
import { calculateHabitability, canColonize, getUpgradeCost, getMaxLevelForAge } from './colony.js';
import { getFleetStrength } from './fleet.js';
import { getAvailableTechs, type ResearchState } from './research.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';
import { GOVERNMENTS } from '../types/government.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface AIDecision {
  type:
    | 'colonize'
    | 'build'
    | 'research'
    | 'move_fleet'
    | 'build_ship'
    | 'diplomacy'
    | 'war'
    | 'recruit_spy'
    | 'assign_spy';
  /** Relative urgency 0–100. Higher = execute sooner. */
  priority: number;
  params: Record<string, unknown>;
  /** Human-readable explanation, useful for debug logging. */
  reasoning: string;
}

export interface AIEvaluation {
  empireId: string;
  militaryPower: number;
  economicPower: number;
  techLevel: number;
  expansionPotential: number;
  /** Threat level per opponent empire, 0–100. */
  threatAssessment: Map<string, number>;
  /** Wars flagged as stalemates (opponent empireId → ticks stalled). */
  stalemateWars: Map<string, number>;
}

/**
 * Per-empire war territory tracking. Stored on GameTickState.
 * Records planet counts at intervals to detect stalemates.
 */
export interface WarTerritoryTracker {
  /** Planet count last recorded. */
  lastPlanetCount: number;
  /** Tick when territory last changed. */
  lastChangeTick: number;
  /** Per-war-opponent: their planet count at last check. */
  opponentPlanets: Map<string, number>;
  /** Per-war-opponent: tick when their territory last changed. */
  opponentLastChange: Map<string, number>;
}

// ---------------------------------------------------------------------------
// War strategy types
// ---------------------------------------------------------------------------

/**
 * Classification of war intensity — from cold posturing through to
 * existential conflict. The AI escalates or de-escalates dynamically.
 */
export type WarType =
  | 'total_war'        // Existential — fight to the death (homeworld threatened, conquered planets)
  | 'limited_war'      // Specific objective (take one system, punish an aggression)
  | 'cold_war'         // Hostile stance, occasional skirmishes, no major offensives
  | 'border_skirmish'  // Low-intensity, testing defences
  | 'none';            // No war warranted

/**
 * The result of the multi-factor war decision analysis.
 *
 * Returned by `evaluateWarStrategy()` — a pure function that weighs
 * military calculus, victory alignment, species nature, domestic opinion
 * and geographic factors to produce a nuanced war/peace recommendation.
 */
export interface WarStrategy {
  /** Whether the AI should declare war this tick. */
  shouldDeclareWar: boolean;
  /** Whether the AI should actively seek peace (when already at war). */
  shouldSeekPeace: boolean;
  /** The appropriate intensity level for the conflict. */
  warType: WarType;
  /** Confidence in the decision, 0–1. Low confidence → cautious behaviour. */
  confidence: number;
  /** Human-readable explanation of the decision factors. */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Personality weight tables
// ---------------------------------------------------------------------------

/**
 * Decision-type multipliers per personality (applied to base priority).
 * Values > 1 boost that decision category; < 1 dampens it.
 */
const PERSONALITY_WEIGHTS: Record<
  AIPersonality,
  Partial<Record<AIDecision['type'], number>>
> = {
  aggressive:   { build_ship: 1.6, war: 1.5, move_fleet: 1.3, build: 0.8, research: 0.9, colonize: 1.0, diplomacy: 0.5, recruit_spy: 1.2, assign_spy: 1.3 },
  defensive:    { build_ship: 1.2, war: 0.4, move_fleet: 0.8, build: 1.3, research: 1.0, colonize: 0.9, diplomacy: 1.0, recruit_spy: 0.8, assign_spy: 0.8 },
  economic:     { build_ship: 0.8, war: 0.5, move_fleet: 0.7, build: 1.5, research: 1.1, colonize: 1.1, diplomacy: 1.2, recruit_spy: 1.0, assign_spy: 1.0 },
  diplomatic:   { build_ship: 0.6, war: 0.3, move_fleet: 0.6, build: 1.0, research: 1.0, colonize: 1.0, diplomacy: 1.8, recruit_spy: 0.6, assign_spy: 0.5 },
  expansionist: { build_ship: 1.0, war: 0.9, move_fleet: 1.4, build: 0.9, research: 0.9, colonize: 1.8, diplomacy: 0.8, recruit_spy: 1.0, assign_spy: 1.1 },
  researcher:   { build_ship: 0.7, war: 0.5, move_fleet: 0.6, build: 1.2, research: 1.8, colonize: 0.8, diplomacy: 1.0, recruit_spy: 1.1, assign_spy: 1.2 },
};

/** Tech categories favoured by each personality when choosing research. */
const PERSONALITY_TECH_PREFERENCE: Record<AIPersonality, string[]> = {
  aggressive:   ['weapons', 'propulsion'],
  defensive:    ['defense', 'construction'],
  economic:     ['construction', 'biology'],
  diplomatic:   ['racial', 'biology'],
  expansionist: ['propulsion', 'construction'],
  researcher:   ['racial', 'weapons', 'defense', 'biology', 'construction', 'propulsion'],
};

/** Building types most valued by each personality. */
const PERSONALITY_PREFERRED_BUILDINGS: Record<AIPersonality, BuildingType[]> = {
  aggressive:   ['shipyard', 'factory', 'spaceport'],
  defensive:    ['defense_grid', 'factory', 'spaceport'],
  economic:     ['trade_hub', 'spaceport', 'factory'],
  diplomatic:   ['trade_hub', 'spaceport', 'population_center'],
  expansionist: ['spaceport', 'population_center', 'factory'],
  researcher:   ['research_lab', 'factory', 'population_center'],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a number to [0, 100]. */
function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Module-scoped situational context, set by generateAIDecisions before
 * calling sub-evaluators. This avoids threading the context through 35+
 * applyWeight call sites across all evaluation functions.
 *
 * Reset to null after generateAIDecisions returns.
 */
let _activeSituationalContext: SituationalContext | null = null;

/**
 * Apply personality weight to a base priority score, adapted by situation.
 *
 * Personality weights are the STARTING POSITION — a species' natural
 * peacetime preferences. Situational adaptation multiplies these based
 * on Maslow needs: low safety drives military weight up, low physiological
 * drives economy up. The adaptation is continuous, not threshold-gated.
 *
 * Formula: effective_weight = personality_weight × situational_multiplier
 *
 * A researcher with build_ship=0.7 facing safety=20 gets:
 *   0.7 × (1 + (100-20)/100) = 0.7 × 1.8 = 1.26 — now actively building ships
 *
 * A researcher at safety=80 gets:
 *   0.7 × (1 + (100-80)/100) = 0.7 × 1.2 = 0.84 — still slightly deprioritised
 *
 * No hard-coded overrides. The need drives the behaviour naturally.
 */
function applyWeight(
  basePriority: number,
  type: AIDecision['type'],
  personality: AIPersonality,
  explicitContext?: SituationalContext,
): number {
  const personalityWeight = PERSONALITY_WEIGHTS[personality][type] ?? 1.0;
  const ctx = explicitContext ?? _activeSituationalContext;
  const situationalMultiplier = ctx
    ? computeSituationalMultiplier(type, ctx)
    : 1.0;
  return clamp100(basePriority * personalityWeight * situationalMultiplier);
}

/**
 * Context drawn from the empire's current situation.
 * Populated from Maslow needs (if psychology active) or approximated
 * from raw empire state.
 */
interface SituationalContext {
  /** Safety need: 0 = existential crisis, 100 = perfectly safe. */
  safety: number;
  /** Physiological need: 0 = starving, 100 = abundant. */
  physiological: number;
  /** Belonging need: 0 = isolated, 100 = well-connected. */
  belonging: number;
  /** Self-actualisation need: 0 = stagnant, 100 = thriving. */
  selfActualisation: number;
  /** Number of ships the empire currently has. */
  shipCount: number;
  /** Number of active wars. */
  activeWars: number;
}

/**
 * Compute a situational multiplier for a decision type.
 *
 * The multiplier is derived from unmet needs:
 *   unmet_need = (100 - need_level) / 100    →   0 (need met) to 1 (critical)
 *
 * Each decision type is boosted by the needs it addresses:
 *   build_ship  → boosted by unmet safety
 *   move_fleet  → boosted by unmet safety
 *   build       → boosted by unmet physiological
 *   colonize    → boosted by unmet physiological + self-actualisation
 *   research    → boosted by unmet self-actualisation
 *   diplomacy   → boosted by unmet belonging + unmet safety (seek allies)
 *   war         → dampened by unmet safety (don't start wars when weak)
 */
function computeSituationalMultiplier(
  type: AIDecision['type'],
  ctx: SituationalContext,
): number {
  const safetyDeficit = (100 - ctx.safety) / 100;       // 0..1
  const physioDeficit = (100 - ctx.physiological) / 100;
  const belongDeficit = (100 - ctx.belonging) / 100;
  const selfActDeficit = (100 - ctx.selfActualisation) / 100;

  // No ships at all = extreme emergency multiplier for ship building
  const shipEmergency = ctx.shipCount === 0 ? 1.5 : 0;

  switch (type) {
    case 'build_ship':
      // Driven by safety need + emergency if no ships at all
      return 1.0 + safetyDeficit * 1.2 + shipEmergency;

    case 'move_fleet':
      // Driven by safety (deploy existing forces) + active wars
      return 1.0 + safetyDeficit * 0.8 + Math.min(ctx.activeWars * 0.2, 0.6);

    case 'build':
      // Driven by physiological need (food, resources, infrastructure)
      return 1.0 + physioDeficit * 0.8;

    case 'colonize':
      // Driven by physiological (more planets = more food) + expansion drive
      return 1.0 + physioDeficit * 0.5 + selfActDeficit * 0.3;

    case 'research':
      // Driven by self-actualisation, but dampened when safety is critical
      // (you can't research if you're dead, but you also can't win without it)
      return 1.0 + selfActDeficit * 0.5 - safetyDeficit * 0.3;

    case 'diplomacy':
      // Driven by belonging need + safety (allies help survive)
      return 1.0 + belongDeficit * 0.6 + safetyDeficit * 0.5;

    case 'war':
      // Dampened when safety is low (don't start wars you can't win)
      // Boosted slightly when safety is high (from a position of strength)
      return 1.0 + (ctx.safety / 100) * 0.3 - safetyDeficit * 0.5;

    case 'recruit_spy':
    case 'assign_spy':
      return 1.0 + safetyDeficit * 0.3;

    default:
      return 1.0;
  }
}

/**
 * Build situational context from an empire's state.
 * Uses psychology Maslow needs if available, otherwise approximates.
 */
function buildSituationalContext(
  empire: Empire,
  galaxy: Galaxy,
  fleets: Fleet[],
): SituationalContext {
  const diplo = empire.diplomacy ?? [];
  const activeWars = diplo.filter(r => r.status === 'at_war').length;
  const shipCount = fleets
    .filter(f => f.empireId === empire.id)
    .reduce((sum, f) => sum + f.ships.length, 0);

  // Try to use psychology Maslow needs if available
  const psych = empire.psychology;
  if (psych) {
    // We don't have direct access to the psychStateMap from here,
    // so approximate from what we can observe
  }

  // Approximate Maslow from observable state
  const ownedPlanets = galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === empire.id);

  // Safety: based on military strength vs threats
  let safety = 70;
  if (activeWars > 0) safety -= 20 * Math.min(activeWars, 3);
  if (shipCount === 0) safety -= 30;
  if (ownedPlanets.length <= 1) safety -= 15;
  safety = Math.max(0, Math.min(100, safety));

  // Physiological: based on resources and territory
  let physiological = 80;
  if (empire.credits < 100) physiological -= 20;
  if (empire.credits < 50) physiological -= 20;
  if (ownedPlanets.length === 0) physiological = 0;
  physiological = Math.max(0, Math.min(100, physiological));

  // Belonging: based on alliances and treaties
  const allies = diplo.filter(r => r.status === 'allied').length;
  const treaties = diplo.reduce((sum, r) => sum + (r.treaties?.length ?? 0), 0);
  let belonging = 30 + allies * 15 + Math.min(treaties * 5, 20);
  belonging = Math.max(0, Math.min(100, belonging));

  // Self-actualisation: based on tech progress and territory
  const techCount = empire.technologies?.length ?? 0;
  let selfActualisation = 20 + Math.min(techCount * 2, 40) + Math.min(ownedPlanets.length * 3, 20);
  selfActualisation = Math.max(0, Math.min(100, selfActualisation));

  return { safety, physiological, belonging, selfActualisation, shipCount, activeWars };
}

/**
 * Get all planets owned by an empire across the galaxy.
 */
function getEmpirePlanets(empire: Empire, galaxy: Galaxy): Planet[] {
  const planets: Planet[] = [];
  for (const system of galaxy.systems) {
    for (const planet of system.planets) {
      if (planet.ownerId === empire.id) {
        planets.push(planet);
      }
    }
  }
  return planets;
}

/**
 * Get all fleets belonging to an empire.
 */
function getEmpireFleets(empire: Empire, fleets: Fleet[]): Fleet[] {
  return fleets.filter(f => f.empireId === empire.id);
}

/**
 * Compute the aggregate military power of an empire's fleets.
 * Returns a dimensionless score based on total hull points and combat readiness.
 */
function computeMilitaryPower(empireFleets: Fleet[], ships: Ship[]): number {
  if (empireFleets.length === 0) return 0;
  let total = 0;
  for (const fleet of empireFleets) {
    const strength = getFleetStrength(fleet, ships);
    // Weight damage capability equally with defensive hull
    total += strength.totalHullPoints + strength.totalDamage;
  }
  return total;
}

/**
 * Compute a simple economic power score from credit income and colonized planets.
 */
function computeEconomicPower(empire: Empire, ownedPlanets: Planet[]): number {
  const creditBase = Math.min(empire.credits / 10, 50); // cap at 50 from credits
  const planetBase = ownedPlanets.length * 5;
  const buildingBase = ownedPlanets.reduce((sum, p) => sum + p.buildings.length * 2, 0);
  return clamp100(creditBase + planetBase + buildingBase);
}

/**
 * Compute a tech level score from the number of researched technologies.
 */
function computeTechLevel(empire: Empire): number {
  const techCount = empire.technologies.length;
  return clamp100(techCount * 4);
}

/**
 * Count uncolonized, reachable planets the empire could settle.
 */
function computeExpansionPotential(empire: Empire, galaxy: Galaxy, species: Species): number {
  let available = 0;
  for (const system of galaxy.systems) {
    if (!empire.knownSystems.includes(system.id)) continue;
    for (const planet of system.planets) {
      if (planet.ownerId !== null) continue;
      const check = canColonize(planet, species);
      if (check.allowed) available++;
    }
  }
  return clamp100(available * 8);
}


// ---------------------------------------------------------------------------
// War strategy: multi-factor decision engine
// ---------------------------------------------------------------------------

/**
 * Government types considered "democratic" for war-weariness calculations.
 * These governments face stronger domestic pressure from unhappy populations.
 */
const DEMOCRATIC_GOVERNMENTS: ReadonlySet<GovernmentType> = new Set([
  'democracy', 'republic', 'federation', 'equality',
]);

/**
 * Government types that suppress domestic opinion — war-weariness has
 * negligible political impact under authoritarian rule.
 */
const AUTHORITARIAN_GOVERNMENTS: ReadonlySet<GovernmentType> = new Set([
  'autocracy', 'empire', 'military_junta', 'dictatorship', 'forced_labour', 'hive_mind',
]);

/**
 * Species-specific war behaviour overrides keyed by species ID.
 *
 * These capture lore-driven personality quirks that override or modify
 * the generic trait-based calculations:
 *
 * - Khazari: honour culture with a grudge-ledger. NEVER surrender willingly.
 * - Vaelori: reluctant warriors, seek peace at the earliest opportunity.
 * - Drakmari: pragmatic hunters — fight when advantageous, retreat when not.
 * - Nexari: cold calculators, no emotional attachment to war or peace.
 * - Zorvathi: hive-mind, war is merely efficient resource acquisition.
 */
interface SpeciesWarModifiers {
  /** Multiplier on the peace-seeking score. 0 = never seek peace, 2 = very eager. */
  peaceSeeking: number;
  /** Multiplier on the war-declaration score. 2 = very hawkish, 0.5 = dovish. */
  warHawkishness: number;
  /** Minimum military ratio before this species will consider surrender. */
  minimumSurrenderRatio: number;
  /** Flavour tag for reasoning strings. */
  loreNote: string;
}

const SPECIES_WAR_MODIFIERS: Record<string, SpeciesWarModifiers> = {
  khazari: {
    peaceSeeking: 0.1,        // Almost never seek peace — honour demands perseverance
    warHawkishness: 1.6,
    minimumSurrenderRatio: 0, // Will fight to the last ship
    loreNote: 'Khazari honour forbids surrender — the grudge-ledger demands satisfaction',
  },
  vaelori: {
    peaceSeeking: 2.0,        // Reluctant warriors, seek peace swiftly
    warHawkishness: 0.4,
    minimumSurrenderRatio: 0.9,
    loreNote: 'The Vaelori seek harmony — war is dissonance in the Lattice',
  },
  drakmari: {
    peaceSeeking: 1.0,        // Pragmatic — will disengage when outmatched
    warHawkishness: 1.2,
    minimumSurrenderRatio: 0.6,
    loreNote: 'The Deep Law: strike precisely, retreat when the hunt turns',
  },
  nexari: {
    peaceSeeking: 1.0,        // Calculated — no emotional bias either way
    warHawkishness: 1.0,
    minimumSurrenderRatio: 0.5,
    loreNote: 'The collective calculates without sentiment',
  },
  zorvathi: {
    peaceSeeking: 0.6,        // Hive sees war as resource acquisition — slow to stop
    warHawkishness: 1.3,
    minimumSurrenderRatio: 0.4,
    loreNote: 'The hive expands; stasis is decay',
  },
  sylvani: {
    peaceSeeking: 1.8,        // Deeply peaceful, will endure much before fighting
    warHawkishness: 0.3,
    minimumSurrenderRatio: 0.8,
    loreNote: 'The Sylvani grow — they do not destroy',
  },
  teranos: {
    peaceSeeking: 1.0,        // Adaptable — no fixed bias
    warHawkishness: 1.0,
    minimumSurrenderRatio: 0.5,
    loreNote: 'Humanity adapts; the question is which version is deciding',
  },
};

/**
 * Get species-specific war modifiers, falling back to neutral defaults
 * for species without explicit lore overrides.
 */
function getSpeciesWarModifiers(speciesId: string): SpeciesWarModifiers {
  return SPECIES_WAR_MODIFIERS[speciesId] ?? {
    peaceSeeking: 1.0,
    warHawkishness: 1.0,
    minimumSurrenderRatio: 0.5,
    loreNote: '',
  };
}

/**
 * Determine the best victory strategy for an AI given its personality and
 * the active victory criteria. Returns the criterion the AI should pursue.
 *
 * This drives war/peace calculus: a conquest-focused AI is far more
 * willing to fight than one pursuing a diplomatic or research victory.
 */
function inferVictoryGoal(
  personality: AIPersonality,
  activeCriteria: VictoryCriteria[] | undefined,
): VictoryCriteria {
  // Default: all criteria enabled
  const criteria = activeCriteria && activeCriteria.length > 0
    ? activeCriteria
    : ['conquest', 'dominance', 'economic', 'research', 'diplomatic', 'score'] as VictoryCriteria[];

  // Personality → preferred victory path (includes dominance and score)
  const preferenceOrder: Record<AIPersonality, VictoryCriteria[]> = {
    aggressive:   ['conquest', 'dominance', 'economic', 'score', 'research', 'diplomatic'],
    defensive:    ['diplomatic', 'dominance', 'economic', 'score', 'research', 'conquest'],
    economic:     ['economic', 'diplomatic', 'dominance', 'score', 'research', 'conquest'],
    diplomatic:   ['diplomatic', 'dominance', 'economic', 'score', 'research', 'conquest'],
    expansionist: ['conquest', 'dominance', 'economic', 'score', 'diplomatic', 'research'],
    researcher:   ['research', 'economic', 'dominance', 'score', 'diplomatic', 'conquest'],
  };

  const preferred = preferenceOrder[personality];
  for (const goal of preferred) {
    if (criteria.includes(goal)) return goal;
  }
  // Fallback: first available
  return criteria[0]!;
}

/**
 * Count how many systems the target empire owns that are adjacent to
 * systems owned by the evaluating empire. Higher values mean more
 * geographic exposure and vulnerability.
 */
function countBorderSystems(
  empireId: string,
  targetId: string,
  galaxy: Galaxy,
): number {
  let borderCount = 0;
  const empireSystemIds = new Set(
    galaxy.systems.filter(s => s.ownerId === empireId).map(s => s.id),
  );

  for (const system of galaxy.systems) {
    if (system.ownerId !== targetId) continue;
    // Check if any wormhole connects to an empire-owned system
    const touchesEmpire = system.wormholes.some(w => empireSystemIds.has(w));
    if (touchesEmpire) borderCount++;
  }
  return borderCount;
}

/**
 * Count how many "buffer" systems (unowned or owned by third parties)
 * separate two empires. More buffers = less geographic pressure.
 */
function countBufferSystems(
  empireId: string,
  targetId: string,
  galaxy: Galaxy,
): number {
  const empireSystemIds = new Set(
    galaxy.systems.filter(s => s.ownerId === empireId).map(s => s.id),
  );
  const targetSystemIds = new Set(
    galaxy.systems.filter(s => s.ownerId === targetId).map(s => s.id),
  );

  let buffers = 0;
  for (const system of galaxy.systems) {
    if (system.ownerId === empireId || system.ownerId === targetId) continue;
    // A buffer system is one connected to both empires' territory
    const touchesEmpire = system.wormholes.some(w => empireSystemIds.has(w));
    const touchesTarget = system.wormholes.some(w => targetSystemIds.has(w));
    if (touchesEmpire && touchesTarget) buffers++;
  }
  return buffers;
}

/**
 * Determine whether the empire's homeworld (first owned planet) is
 * under direct threat — i.e. an enemy system is adjacent to the
 * homeworld's system.
 */
function isHomeworldThreatened(
  empire: Empire,
  targetId: string,
  galaxy: Galaxy,
): boolean {
  // Find the empire's home system (first owned system as heuristic)
  const homeSystem = galaxy.systems.find(s => s.ownerId === empire.id);
  if (!homeSystem) return false;

  return homeSystem.wormholes.some(w => {
    const neighbour = galaxy.systems.find(s => s.id === w);
    return neighbour?.ownerId === targetId;
  });
}

/**
 * Classify the appropriate war intensity based on the situation.
 *
 * Escalation path: none → border_skirmish → cold_war → limited_war → total_war
 *
 * Factors:
 * - Homeworld threatened → total_war
 * - Lost planets to this enemy → limited_war (punitive)
 * - Large border exposure → cold_war
 * - Minor friction → border_skirmish
 */
function classifyWarType(
  empire: Empire,
  targetId: string,
  galaxy: Galaxy,
  warScore: number,
): WarType {
  // Existential: homeworld under direct threat
  if (isHomeworldThreatened(empire, targetId, galaxy)) return 'total_war';

  // Check if the target owns systems that border many of our systems
  const borderExposure = countBorderSystems(empire.id, targetId, galaxy);
  const buffers = countBufferSystems(empire.id, targetId, galaxy);

  // Heavy border contact with no buffer → elevated intensity
  if (borderExposure >= 3 && buffers === 0) return 'total_war';
  if (borderExposure >= 2 && warScore > 60) return 'limited_war';
  if (borderExposure >= 1 && warScore > 40) return 'cold_war';
  if (warScore > 30) return 'border_skirmish';

  return 'none';
}

/**
 * Evaluate whether an empire should declare war on, continue fighting, or
 * seek peace with a specific opponent.
 *
 * This is a multi-factor decision that considers:
 *  1. **Military calculus** — power ratio, projected trend, economic sustainability
 *  2. **Victory goal alignment** — does war serve our strategic objective?
 *  3. **Species nature** — lore-driven personality (Khazari honour, Vaelori reluctance, etc.)
 *  4. **Domestic opinion** — happiness, war-weariness, government type
 *  5. **Geographic vulnerability** — border exposure, buffer systems, homeworld safety
 *
 * Pure function — no side effects. All inputs are read-only.
 *
 * @param empire        The AI empire making the decision.
 * @param targetId      The opponent empire being evaluated.
 * @param galaxy        Current galaxy state (for geographic analysis).
 * @param fleets        All fleets in the game.
 * @param ships         All ships in the game.
 * @param evaluation    Pre-computed AIEvaluation for this empire.
 * @param gameState     Full game state (for victory criteria, empire lookup).
 * @param avgHappiness  Average happiness across empire's planets (0–100), or null if unknown.
 */
export function evaluateWarStrategy(
  empire: Empire,
  targetId: string,
  galaxy: Galaxy,
  fleets: Fleet[],
  ships: Ship[],
  evaluation: AIEvaluation,
  gameState: GameState,
  avgHappiness: number | null,
): WarStrategy {
  const personality: AIPersonality = empire.aiPersonality ?? 'defensive';
  const species = empire.species;
  const speciesMod = getSpeciesWarModifiers(species.id);
  const relation = empire.diplomacy.find(d => d.empireId === targetId);
  const currentlyAtWar = relation?.status === 'at_war';
  const isAllied = relation?.status === 'allied';

  // Short-circuit: never attack allies
  if (isAllied && !currentlyAtWar) {
    return {
      shouldDeclareWar: false,
      shouldSeekPeace: false,
      warType: 'none',
      confidence: 0.95,
      reasoning: 'Allied — war not considered.',
    };
  }

  const reasons: string[] = [];
  let warScore = 0;     // Positive = pro-war, negative = pro-peace
  let peaceScore = 0;   // Separate track for peace-seeking (when already at war)

  // =========================================================================
  // 1. MILITARY CALCULUS
  // =========================================================================

  // --- Current power ratio ---
  const empireFleets = getEmpireFleets(empire, fleets);
  const opponentFleets = fleets.filter(f => f.empireId === targetId);
  const ourMilitary = computeMilitaryPower(empireFleets, ships);
  const theirMilitary = computeMilitaryPower(opponentFleets, ships);
  const attackRatio = theirMilitary > 0
    ? ourMilitary / theirMilitary
    : (ourMilitary > 0 ? 3.0 : 0);

  // Strong military advantage → pro-war; disadvantage → pro-peace
  if (attackRatio >= 2.0) {
    warScore += 25;
    reasons.push(`Overwhelming military advantage (${attackRatio.toFixed(1)}x)`);
  } else if (attackRatio >= 1.5) {
    warScore += 15;
    reasons.push(`Significant military advantage (${attackRatio.toFixed(1)}x)`);
  } else if (attackRatio >= 1.0) {
    warScore += 5;
    reasons.push(`Slight military advantage (${attackRatio.toFixed(1)}x)`);
  } else if (attackRatio >= 0.7) {
    warScore -= 10;
    peaceScore += 10;
    reasons.push(`Military parity or slight disadvantage (${attackRatio.toFixed(1)}x)`);
  } else {
    warScore -= 25;
    peaceScore += 25;
    reasons.push(`Military disadvantage (${attackRatio.toFixed(1)}x) — caution advised`);
  }

  // --- Projected trend: construction trait comparison ---
  // A species that builds faster will close or widen the gap over time.
  const targetEmpire = gameState.empires.find(e => e.id === targetId);
  if (targetEmpire) {
    const ourConstruction = species.traits.construction;
    const theirConstruction = targetEmpire.species.traits.construction;
    const constructionDelta = ourConstruction - theirConstruction;

    if (constructionDelta >= 3) {
      warScore += 10;
      reasons.push(`Construction advantage (+${constructionDelta}) — we outproduce them`);
    } else if (constructionDelta <= -3) {
      warScore -= 10;
      peaceScore += 5;
      reasons.push(`Construction disadvantage (${constructionDelta}) — they outproduce us`);
    }
  }

  // --- Economic sustainability: can we afford a war? ---
  // Rough heuristic: credits represent war chest, planets represent income
  const ownedPlanets = getEmpirePlanets(empire, galaxy);
  const creditReserves = empire.credits;
  const planetCount = ownedPlanets.length;

  // Estimated income: ~50 credits/tick per planet (rough approximation)
  const estimatedIncome = planetCount * 50;
  // Estimated fleet upkeep: ~20 credits/tick per fleet
  const estimatedUpkeep = empireFleets.length * 20;
  const netIncome = estimatedIncome - estimatedUpkeep;

  if (creditReserves > 2000 && netIncome > 0) {
    warScore += 8;
    reasons.push(`Strong war chest (${creditReserves} credits, +${netIncome}/tick)`);
  } else if (creditReserves < 500 || netIncome < 0) {
    warScore -= 15;
    peaceScore += 10;
    reasons.push(`Economic strain (${creditReserves} credits, ${netIncome}/tick) — war unsustainable`);
  }

  // --- Reserves: how many ticks can we sustain before bankruptcy? ---
  const ticksUntilBankrupt = netIncome >= 0 ? Infinity : Math.abs(creditReserves / netIncome);
  if (ticksUntilBankrupt < 50) {
    warScore -= 10;
    peaceScore += 8;
    reasons.push(`Near bankruptcy (~${Math.round(ticksUntilBankrupt)} ticks of reserves)`);
  }

  // =========================================================================
  // 2. VICTORY GOAL ALIGNMENT
  // =========================================================================

  const victoryGoal = inferVictoryGoal(personality, gameState.victoryCriteria);

  switch (victoryGoal) {
    case 'conquest':
      warScore += 20;
      reasons.push('Pursuing conquest victory — war serves our objective');
      break;
    case 'dominance':
      // Dominance needs both political influence and territorial control
      warScore += 10;
      reasons.push('Pursuing dominance victory — territorial expansion serves our objective');
      break;
    case 'economic':
      // War drains resources; only fight if economically necessary
      warScore -= 10;
      peaceScore += 10;
      reasons.push('Pursuing economic victory — war drains resources');
      break;
    case 'research':
      // Research is slowed by combat; avoid war
      warScore -= 15;
      peaceScore += 12;
      reasons.push('Pursuing research victory — war disrupts progress');
      break;
    case 'diplomatic':
      // Diplomats avoid war unless attacked
      warScore -= 20;
      peaceScore += 15;
      reasons.push('Pursuing diplomatic victory — war damages standing');
      break;
    case 'score':
      // Score victory benefits from balanced play
      reasons.push('Pursuing score victory — balanced approach');
      break;
  }

  // =========================================================================
  // 3. SPECIES NATURE (traits + lore)
  // =========================================================================

  // --- Combat trait: warlike species fight on principle ---
  if (species.traits.combat > 7) {
    warScore += 12;
    reasons.push(`Warlike nature (combat trait ${species.traits.combat})`);
  } else if (species.traits.combat <= 3) {
    warScore -= 8;
    reasons.push(`Peaceful nature (combat trait ${species.traits.combat})`);
  }

  // --- Diplomacy trait: diplomatic species prefer negotiation ---
  if (species.traits.diplomacy > 7) {
    warScore -= 12;
    peaceScore += 10;
    reasons.push(`Diplomatic nature (diplomacy trait ${species.traits.diplomacy})`);
  } else if (species.traits.diplomacy <= 2) {
    warScore += 5;
    reasons.push(`Low diplomatic inclination (diplomacy trait ${species.traits.diplomacy})`);
  }

  // --- Espionage trait: prefer shadow wars over direct conflict ---
  if (species.traits.espionage > 7) {
    warScore -= 8;
    reasons.push(`Espionage-oriented (trait ${species.traits.espionage}) — prefers covert action`);
  }

  // --- Species-specific lore modifiers ---
  warScore *= speciesMod.warHawkishness;
  peaceScore *= speciesMod.peaceSeeking;

  if (speciesMod.loreNote) {
    reasons.push(speciesMod.loreNote);
  }

  // =========================================================================
  // 4. DOMESTIC OPINION
  // =========================================================================

  const happiness = avgHappiness ?? 60; // Default to neutral if unknown
  const govModifiers = GOVERNMENTS[empire.government]?.modifiers;
  const isDemocratic = DEMOCRATIC_GOVERNMENTS.has(empire.government);
  const isAuthoritarian = AUTHORITARIAN_GOVERNMENTS.has(empire.government);

  // War-weariness: low happiness makes war politically costly
  if (happiness < 40) {
    // Population is war-weary
    const wearinessPenalty = isDemocratic ? 20 : isAuthoritarian ? 5 : 12;
    warScore -= wearinessPenalty;
    peaceScore += wearinessPenalty;
    reasons.push(
      `War-weary population (happiness ${Math.round(happiness)})` +
      (isDemocratic ? ' — democratic pressure amplified' : ''),
    );
  } else if (happiness > 70) {
    // Happy population can tolerate conflict
    warScore += 5;
    reasons.push(`Content population (happiness ${Math.round(happiness)}) — can absorb conflict`);
  }

  // --- High reproduction absorbs casualties better ---
  if (species.traits.reproduction >= 7) {
    warScore += 5;
    reasons.push(`High reproduction (trait ${species.traits.reproduction}) — casualty-tolerant`);
  } else if (species.traits.reproduction <= 3) {
    warScore -= 5;
    peaceScore += 3;
    reasons.push(`Low reproduction (trait ${species.traits.reproduction}) — casualties hurt more`);
  }

  // --- Government happiness modifier: very unhappy governments break faster ---
  if (govModifiers && govModifiers.happiness < -15) {
    peaceScore += 5;
    reasons.push('Government structure creates baseline unhappiness');
  }

  // =========================================================================
  // 5. GEOGRAPHIC VULNERABILITY
  // =========================================================================

  const borderExposure = countBorderSystems(empire.id, targetId, galaxy);
  const bufferSystems = countBufferSystems(empire.id, targetId, galaxy);
  const homeworldThreatened = isHomeworldThreatened(empire, targetId, galaxy);

  if (homeworldThreatened) {
    // Existential threat — if already at war, fight harder; if not, think twice
    if (currentlyAtWar) {
      warScore += 30;
      peaceScore -= 20; // Fight for survival
      reasons.push('CRITICAL: Homeworld under direct threat — existential defence');
    } else {
      // Pre-emptive strike consideration
      warScore += 10;
      reasons.push('Homeworld exposed to potential strike — elevated concern');
    }
  }

  if (borderExposure >= 3) {
    warScore += 8;
    reasons.push(`High border exposure (${borderExposure} shared borders) — conflict likely`);
  } else if (borderExposure === 0) {
    warScore -= 10;
    reasons.push('No shared borders — limited strategic interest');
  }

  if (bufferSystems >= 2) {
    warScore -= 8;
    reasons.push(`Buffer systems (${bufferSystems}) provide geographic safety`);
  }

  // =========================================================================
  // 6. COALITION AI — HEGEMON THREAT
  // =========================================================================
  // Count colonised planets per empire. If any empire controls >50% of all
  // colonised planets, non-hegemonic AIs rally against the hegemon and avoid
  // fighting fellow underdogs.

  const planetsByEmpire = new Map<string, number>();
  let totalColonised = 0;
  for (const sys of galaxy.systems) {
    for (const p of sys.planets) {
      if (p.ownerId) {
        planetsByEmpire.set(p.ownerId, (planetsByEmpire.get(p.ownerId) ?? 0) + 1);
        totalColonised++;
      }
    }
  }

  if (totalColonised > 0) {
    const targetPlanets = planetsByEmpire.get(targetId) ?? 0;
    const ourPlanets = planetsByEmpire.get(empire.id) ?? 0;
    const targetShare = targetPlanets / totalColonised;
    const ourShare = ourPlanets / totalColonised;

    if (targetShare > 0.5 && ourShare <= 0.5) {
      // Target is the hegemon — rally against them
      warScore += 20;
      reasons.push(`Hegemon threat: ${targetId} controls ${Math.round(targetShare * 100)}% of planets — coalition pressure`);
    } else if (ourShare <= 0.5 && targetShare <= 0.5) {
      // Both are underdogs — avoid fighting each other
      // Find if there IS a hegemon elsewhere
      let hegemonExists = false;
      for (const [, count] of planetsByEmpire) {
        if (count / totalColonised > 0.5) {
          hegemonExists = true;
          break;
        }
      }
      if (hegemonExists) {
        warScore -= 30;
        peaceScore += 15;
        reasons.push(`Coalition solidarity: both underdogs while hegemon exists — avoid infighting`);
      }
    }
  }

  // =========================================================================
  // SYNTHESIS: combine all factors into a final decision
  // =========================================================================

  // --- Personality base thresholds ---
  // These represent how much "push" each personality needs before declaring war.
  const warThresholds: Record<AIPersonality, number> = {
    aggressive:   15,  // Low bar — needs only modest justification
    defensive:    40,  // Fights only when clearly threatened
    economic:     45,  // Very reluctant — war is wasteful
    diplomatic:   50,  // Strongest reluctance
    expansionist: 25,  // Medium — war is a tool for territory
    researcher:   45,  // Dislikes war, prefers labs to battlefields
  };

  // --- Peace thresholds (when already at war) ---
  const peaceThresholds: Record<AIPersonality, number> = {
    aggressive:   60,  // Very reluctant to sue for peace
    defensive:    25,  // Quick to accept a reasonable peace
    economic:     20,  // Peace is profit
    diplomatic:   15,  // Always looking for peace
    expansionist: 35,  // Will stop if the cost exceeds the gain
    researcher:   20,  // War distracts from research
  };

  const warThreshold = warThresholds[personality];
  const peaceThreshold = peaceThresholds[personality];

  // Khazari override: enforce minimum surrender ratio (honour culture)
  if (currentlyAtWar && attackRatio >= speciesMod.minimumSurrenderRatio) {
    // Species is not desperate enough to surrender
    peaceScore = Math.min(peaceScore, peaceThreshold - 1);
  }

  const shouldDeclareWar = !currentlyAtWar && warScore >= warThreshold;
  const shouldSeekPeace = currentlyAtWar && peaceScore >= peaceThreshold;

  // Classify war type based on intensity
  const warType = (shouldDeclareWar || currentlyAtWar)
    ? classifyWarType(empire, targetId, galaxy, warScore)
    : 'none' as WarType;

  // Confidence: how certain are we? High |warScore| or |peaceScore| = high confidence.
  const maxScore = Math.max(Math.abs(warScore), Math.abs(peaceScore));
  const confidence = Math.min(1.0, maxScore / 80);

  // Build reasoning summary
  const action = shouldDeclareWar
    ? `DECLARE WAR (${warType})`
    : shouldSeekPeace
      ? 'SEEK PEACE'
      : currentlyAtWar
        ? `CONTINUE WAR (${warType})`
        : 'MAINTAIN PEACE';

  const reasoning = [
    `${action} — warScore: ${Math.round(warScore)}, peaceScore: ${Math.round(peaceScore)}, ` +
    `threshold: ${warThreshold}/${peaceThreshold}, confidence: ${confidence.toFixed(2)}`,
    ...reasons,
  ].join('. ');

  return {
    shouldDeclareWar,
    shouldSeekPeace,
    warType,
    confidence,
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Public: evaluateEmpireState
// ---------------------------------------------------------------------------

/**
 * Evaluate the current state of an empire and return a snapshot of key metrics
 * and threat assessments that feed into decision generation.
 */
/** Stalemate threshold: if neither side's territory changes for this many ticks, flag it. */
const STALEMATE_TICKS = 500;

export function evaluateEmpireState(
  empire: Empire,
  galaxy: Galaxy,
  fleets: Fleet[],
  ships: Ship[],
  currentTick = 0,
  territoryTracker?: WarTerritoryTracker,
): AIEvaluation {
  const ownedPlanets = getEmpirePlanets(empire, galaxy);
  const empireFleets = getEmpireFleets(empire, fleets);
  const militaryPower = computeMilitaryPower(empireFleets, ships);
  const economicPower = computeEconomicPower(empire, ownedPlanets);
  const techLevel = computeTechLevel(empire);
  const expansionPotential = computeExpansionPotential(empire, galaxy, empire.species);

  // Build threat map for all other known empires
  const threatAssessment = new Map<string, number>();
  // Collect opponent empire IDs from diplomacy + galaxy system owners
  const opponentIds = new Set<string>();
  for (const rel of empire.diplomacy) {
    if (rel.empireId !== empire.id) opponentIds.add(rel.empireId);
  }
  for (const system of galaxy.systems) {
    if (system.ownerId && system.ownerId !== empire.id) {
      opponentIds.add(system.ownerId);
    }
  }

  for (const opponentId of opponentIds) {
    // We don't have direct access to opponent Empire objects here — construct
    // a minimal assessment from available fleet data
    const opponentFleets = fleets.filter(f => f.empireId === opponentId);
    const opponentMilitary = computeMilitaryPower(opponentFleets, ships);
    const militaryRatio = militaryPower > 0 ? opponentMilitary / militaryPower : (opponentMilitary > 0 ? 2 : 0);
    const militaryThreat = clamp100(militaryRatio * 40);

    const relation = empire.diplomacy.find(d => d.empireId === opponentId);
    let diplomaticThreat = 0;
    if (relation) {
      if (relation.status === 'at_war') diplomaticThreat = 40;
      else if (relation.status === 'hostile') diplomaticThreat = 20;
      else if (relation.status === 'neutral') diplomaticThreat = 5;
      else if (relation.status === 'friendly' || relation.status === 'allied') diplomaticThreat = -10;
    }

    let rawThreat = clamp100(militaryThreat + diplomaticThreat);

    // Allies and friendly empires are capped at a low threat ceiling — their
    // military strength represents protective value, not an offensive threat.
    if (relation?.status === 'allied' || relation?.status === 'friendly') {
      rawThreat = Math.min(rawThreat, 15);
    }

    threatAssessment.set(opponentId, rawThreat);
  }

  // Detect stalemate wars: territory hasn't changed for either side in N ticks
  const stalemateWars = new Map<string, number>();
  if (territoryTracker && currentTick > STALEMATE_TICKS) {
    // Update tracker with current state
    const myPlanets = ownedPlanets.length;
    if (myPlanets !== territoryTracker.lastPlanetCount) {
      territoryTracker.lastPlanetCount = myPlanets;
      territoryTracker.lastChangeTick = currentTick;
    }

    // Check each active war
    for (const rel of empire.diplomacy) {
      if (rel.status !== 'at_war') continue;
      const oppId = rel.empireId;
      const oppPlanets = galaxy.systems.flatMap(s => s.planets).filter(p => p.ownerId === oppId).length;

      const prevOppPlanets = territoryTracker.opponentPlanets.get(oppId) ?? oppPlanets;
      const prevOppChange = territoryTracker.opponentLastChange.get(oppId) ?? currentTick;

      if (oppPlanets !== prevOppPlanets) {
        territoryTracker.opponentPlanets.set(oppId, oppPlanets);
        territoryTracker.opponentLastChange.set(oppId, currentTick);
      }

      // Stalemate if NEITHER side's territory changed for STALEMATE_TICKS
      const myStaleTicks = currentTick - territoryTracker.lastChangeTick;
      const oppStaleTicks = currentTick - (territoryTracker.opponentLastChange.get(oppId) ?? currentTick);
      const staleTicks = Math.min(myStaleTicks, oppStaleTicks);

      if (staleTicks >= STALEMATE_TICKS) {
        stalemateWars.set(oppId, staleTicks);
      }
    }
  }

  return {
    empireId: empire.id,
    militaryPower,
    economicPower,
    techLevel,
    expansionPotential,
    threatAssessment,
    stalemateWars,
  };
}

// ---------------------------------------------------------------------------
// Decision generators
// ---------------------------------------------------------------------------

/**
 * Evaluate colonization opportunities in known, reachable systems.
 *
 * Planets are scored by:
 * - Habitability (0-100)
 * - Natural resources value
 * - Max population capacity
 *
 * Returns one AIDecision per viable colonization target (up to a cap).
 */
export function evaluateColonizationTargets(
  empire: Empire,
  galaxy: Galaxy,
  species: Species,
): AIDecision[] {
  const decisions: AIDecision[] = [];

  for (const system of galaxy.systems) {
    if (!empire.knownSystems.includes(system.id)) continue;

    for (const planet of system.planets) {
      if (planet.ownerId !== null) continue;
      const check = canColonize(planet, species);
      if (!check.allowed) continue;

      const hab = calculateHabitability(planet, species);

      // Score: habitability (0-100), resources (0-100), population potential
      const resourceScore = planet.naturalResources;
      const popScore = Math.min(planet.maxPopulation / 10, 20); // cap at 20 pts
      const baseScore = hab.score * 0.5 + resourceScore * 0.3 + popScore * 0.2;

      decisions.push({
        type: 'colonize',
        priority: clamp100(baseScore),
        params: {
          planetId: planet.id,
          systemId: system.id,
          habitability: hab.score,
          naturalResources: planet.naturalResources,
        },
        reasoning: `Colonize ${planet.name} (hab ${hab.score}, resources ${planet.naturalResources})`,
      });
    }
  }

  return decisions;
}

/**
 * Select research priorities based on personality.
 *
 * Preferred tech categories per personality get a priority boost; others are
 * still considered but weighted lower so the AI does not ignore them entirely.
 */
export function evaluateResearchPriority(
  empire: Empire,
  researchState: ResearchState,
  personality: AIPersonality,
  allTechs: Technology[],
): AIDecision[] {
  const available = getAvailableTechs(allTechs, researchState, empire.species.id);
  if (available.length === 0) return [];

  const preferred = PERSONALITY_TECH_PREFERENCE[personality];
  const decisions: AIDecision[] = [];

  for (const tech of available) {
    const isPreferred = preferred.includes(tech.category);
    // Base priority: preferred category gets 70, others get 35
    // Cheaper techs get a slight nudge so the AI doesn't always chase the
    // most expensive options.
    const costFactor = Math.max(0, 1 - tech.cost / 500); // 0-1, cheaper → higher
    let basePriority = isPreferred ? 60 + costFactor * 15 : 30 + costFactor * 10;

    // Age-unlock techs are CRITICAL — they gate access to everything better.
    // Without advancing ages, a research-9 species builds age-1 ships forever
    // while combat-focused species with the same age produce identical ships.
    // Every personality should prioritise these.
    const isAgeUnlock = tech.effects?.some(
      (e: Record<string, unknown>) => e.type === 'age_unlock',
    );
    if (isAgeUnlock) basePriority = Math.max(basePriority, 85);

    // Weapon/shield/hull unlock techs get a boost when under threat —
    // a species at war should research military tech regardless of personality
    const isMilitaryTech = tech.category === 'weapons' || tech.category === 'defense';
    const isHullUnlock = tech.effects?.some(
      (e: Record<string, unknown>) => e.type === 'unlock_hull' || e.type === 'unlock_component',
    );
    if ((isMilitaryTech || isHullUnlock) && _activeSituationalContext && _activeSituationalContext.safety < 50) {
      basePriority = Math.max(basePriority, 55 + (50 - _activeSituationalContext.safety) * 0.5);
    }

    decisions.push({
      type: 'research',
      priority: applyWeight(basePriority, 'research', personality),
      params: { techId: tech.id, category: tech.category, cost: tech.cost },
      reasoning: `Research ${tech.name} (${tech.category}${isPreferred ? ', preferred' : ''}${isAgeUnlock ? ', AGE GATE' : ''})`,
    });
  }

  return decisions;
}

/**
 * Evaluate military actions: scouting, fleet movements, war declarations, and
 * peace-seeking.
 *
 * War and peace decisions are delegated to `evaluateWarStrategy()`, which
 * performs a multi-factor analysis considering military calculus, victory
 * alignment, species nature, domestic opinion and geographic vulnerability.
 *
 * All personalities can now declare war or seek peace — the strategy engine
 * weighs each factor and produces a nuanced recommendation rather than
 * relying on hardcoded personality checks.
 *
 * @param empire      The AI empire making decisions.
 * @param galaxy      Current galaxy state.
 * @param fleets      All fleets in the game.
 * @param ships       All ships in the game.
 * @param evaluation  Pre-computed AIEvaluation for this empire.
 * @param gameState   Full game state (needed for war strategy analysis).
 * @param avgHappiness Average happiness across the empire's planets (0–100), or null.
 */
export function evaluateMilitaryActions(
  empire: Empire,
  galaxy: Galaxy,
  fleets: Fleet[],
  ships: Ship[],
  evaluation: AIEvaluation,
  gameState?: GameState,
  avgHappiness?: number | null,
): AIDecision[] {
  const decisions: AIDecision[] = [];
  const empireFleets = getEmpireFleets(empire, fleets);
  if (empireFleets.length === 0) return decisions;

  // Find unexplored systems adjacent to known systems
  const knownSet = new Set(empire.knownSystems);
  const unexplored: string[] = [];
  for (const systemId of empire.knownSystems) {
    const system = galaxy.systems.find(s => s.id === systemId);
    if (!system) continue;
    for (const neighbourId of system.wormholes) {
      if (!knownSet.has(neighbourId)) {
        unexplored.push(neighbourId);
      }
    }
  }

  // Scout unexplored systems — send idle fleets to explore the frontier
  // For conquest/dominance, exploration is critical to find colonisation targets
  if (unexplored.length > 0) {
    const personality = empire.aiPersonality ?? 'defensive';
    const milVictoryGoal = inferVictoryGoal(personality, gameState?.victoryCriteria);
    const isExpGoal = milVictoryGoal === 'conquest' || milVictoryGoal === 'dominance';
    const scoutBasePriority = isExpGoal ? 75 : personality === 'expansionist' ? 65 : 40;
    // Send multiple scouts to different unexplored systems
    const idleFleets = empireFleets.filter(f => !f.destination);
    const maxScouts = isExpGoal ? 3 : personality === 'expansionist' ? 2 : 1;
    const assignedScoutTargets = new Set<string>();

    // Sort idle fleets smallest-first (prefer probes/scouts for scouting)
    const sortedIdle = [...idleFleets].sort((a, b) => a.ships.length - b.ships.length);

    for (let si = 0; si < Math.min(maxScouts, sortedIdle.length, unexplored.length); si++) {
      const target = unexplored.find(s => !assignedScoutTargets.has(s));
      if (!target) break;
      assignedScoutTargets.add(target);
      decisions.push({
        type: 'move_fleet',
        priority: applyWeight(scoutBasePriority, 'move_fleet', personality),
        params: {
          fleetId: sortedIdle[si]!.id,
          destinationSystemId: target,
          purpose: 'scout',
        },
        reasoning: `Scout unexplored system ${target} (${unexplored.length} frontier systems)`,
      });
    }
  }

  // Evaluate war/peace strategy per opponent using the multi-factor engine
  const personality = empire.aiPersonality ?? 'defensive';
  const highestThreat = Array.from(evaluation.threatAssessment.entries()).sort(
    ([, a], [, b]) => b - a,
  );

  if (highestThreat.length > 0) {
    for (const [opponentId] of highestThreat) {
      const relation = empire.diplomacy.find(d => d.empireId === opponentId);

      // --- War strategy: use the sophisticated multi-factor engine ---
      if (gameState) {
        const strategy = evaluateWarStrategy(
          empire,
          opponentId,
          galaxy,
          fleets,
          ships,
          evaluation,
          gameState,
          avgHappiness ?? null,
        );

        // War declaration
        if (strategy.shouldDeclareWar && relation?.status !== 'at_war') {
          // Scale priority by confidence: high-confidence decisions execute sooner
          const basePriority = 40 + strategy.confidence * 40;
          decisions.push({
            type: 'war',
            priority: applyWeight(basePriority, 'war', personality),
            params: {
              targetEmpireId: opponentId,
              warType: strategy.warType,
              confidence: strategy.confidence,
            },
            reasoning: strategy.reasoning,
          });
        }

        // Peace-seeking
        if (strategy.shouldSeekPeace && relation?.status === 'at_war') {
          const basePriority = 30 + strategy.confidence * 40;
          decisions.push({
            type: 'diplomacy',
            priority: applyWeight(basePriority, 'diplomacy', personality),
            params: {
              targetEmpireId: opponentId,
              action: 'seek_peace',
              warType: strategy.warType,
              confidence: strategy.confidence,
            },
            reasoning: strategy.reasoning,
          });
        }
      }

      // At war: coordinate multiple fleets for attack based on war intensity
      if (relation?.status === 'at_war' && empireFleets.length > 0) {
        const targetSystem = galaxy.systems.find(s => s.ownerId === opponentId);
        if (targetSystem) {
          // Sort all idle fleets by strength (ship count) descending
          const idleAttackFleets = empireFleets
            .filter(f => !f.destination)
            .sort((a, b) => b.ships.length - a.ships.length);

          // Determine how many fleets to commit based on war type
          // Re-evaluate strategy here since the previous `strategy` is block-scoped
          const currentWarType: WarType = gameState
            ? evaluateWarStrategy(empire, opponentId, galaxy, fleets, ships, evaluation, gameState, avgHappiness ?? null).warType
            : 'limited_war';
          const warType = currentWarType;
          const maxFleets = warType === 'total_war' ? 3
            : warType === 'limited_war' ? 2
            : 1; // border_skirmish, cold_war, none

          const fleetsToSend = idleAttackFleets.length > 0
            ? idleAttackFleets.slice(0, maxFleets)
            : [empireFleets[0]!];

          const basePriorities = [70, 65, 60];
          for (let fi = 0; fi < fleetsToSend.length; fi++) {
            const attackFleet = fleetsToSend[fi]!;
            decisions.push({
              type: 'move_fleet',
              priority: applyWeight(basePriorities[fi] ?? 55, 'move_fleet', personality),
              params: {
                fleetId: attackFleet.id,
                destinationSystemId: targetSystem.id,
                purpose: 'attack',
                targetEmpireId: opponentId,
              },
              reasoning: `Attack ${opponentId} in system ${targetSystem.id} (at war, fleet ${fi + 1}/${fleetsToSend.length})`,
            });
          }
        }
      }
    }
  }

  // Defensive reinforcement: move fleets toward highest-threat border
  if (highestThreat.length > 0 && empireFleets.length > 0) {
    const [topThreatId, topThreatLevel] = highestThreat[0]!;
    if (topThreatLevel > 30) {
      // Find a friendly owned system closest to the threat
      const threatSystems = galaxy.systems.filter(s => s.ownerId === topThreatId);
      if (threatSystems.length > 0) {
        const borderSystem = galaxy.systems.find(
          s => s.ownerId === empire.id &&
            s.wormholes.some(w => threatSystems.some(ts => ts.id === w)),
        );
        if (borderSystem) {
          // Pick a different fleet than the one scouting/attacking (second-largest idle, or first)
          const idleDefFleets = empireFleets.filter(f => !f.destination);
          const defFleet = idleDefFleets.length > 1
            ? idleDefFleets.sort((a, b) => b.ships.length - a.ships.length)[1]!
            : empireFleets[0]!;
          decisions.push({
            type: 'move_fleet',
            priority: applyWeight(45, 'move_fleet', personality),
            params: {
              fleetId: defFleet.id,
              destinationSystemId: borderSystem.id,
              purpose: 'reinforce',
              threatEmpireId: topThreatId,
            },
            reasoning: `Reinforce border system ${borderSystem.id} against threat from ${topThreatId}`,
          });
        }
      }
    }
  }

  return decisions;
}

/**
 * Evaluate economic building actions for owned planets.
 *
 * Looks for planets that are lacking key economic buildings and suggests
 * constructing them. Avoids suggesting buildings already in the production
 * queue or already built.
 */
export function evaluateEconomicActions(empire: Empire, galaxy: Galaxy): AIDecision[] {
  const decisions: AIDecision[] = [];
  const ownedPlanets = getEmpirePlanets(empire, galaxy);

  for (const planet of ownedPlanets) {
    if (planet.type === 'gas_giant') continue;

    const builtTypes = new Set(planet.buildings.map(b => b.type));
    const queuedTypes = new Set(planet.productionQueue.map(q => q.templateId));
    const usedSlots = planet.buildings.length + planet.productionQueue.length;
    const totalSlots = planet.maxPopulation > 0 ? 20 : 10; // rough slot availability heuristic

    if (usedSlots >= totalSlots) continue;

    // Suggest factories on resource-rich worlds
    if (!builtTypes.has('factory') && !queuedTypes.has('factory') && planet.naturalResources >= 40) {
      const cost = BUILDING_DEFINITIONS.factory.baseCost;
      if (empire.credits >= (cost.credits ?? 0)) {
        decisions.push({
          type: 'build',
          priority: 55,
          params: { planetId: planet.id, buildingType: 'factory' },
          reasoning: `Build factory on ${planet.name} (resources: ${planet.naturalResources})`,
        });
      }
    }

    // Suggest trade hubs on populous worlds
    if (!builtTypes.has('trade_hub') && !queuedTypes.has('trade_hub') && planet.currentPopulation >= 10) {
      const cost = BUILDING_DEFINITIONS.trade_hub.baseCost;
      if (empire.credits >= (cost.credits ?? 0)) {
        decisions.push({
          type: 'build',
          priority: 50,
          params: { planetId: planet.id, buildingType: 'trade_hub' },
          reasoning: `Build trade hub on ${planet.name} (pop: ${planet.currentPopulation})`,
        });
      }
    }

    // Suggest mining on mineral-rich worlds
    if (!builtTypes.has('mining_facility') && !queuedTypes.has('mining_facility') && planet.naturalResources >= 60) {
      const cost = BUILDING_DEFINITIONS.mining_facility.baseCost;
      if (empire.credits >= (cost.credits ?? 0)) {
        decisions.push({
          type: 'build',
          priority: 45,
          params: { planetId: planet.id, buildingType: 'mining_facility' },
          reasoning: `Build mining facility on ${planet.name} (resources: ${planet.naturalResources})`,
        });
      }
    }
  }

  return decisions;
}

/**
 * Evaluate diplomatic actions based on the empire's threat assessment and
 * personality.
 *
 * - Diplomatic personality: propose non-aggression or trade treaties.
 * - Defensive personality: seek non-aggression treaties with strong neighbours.
 * - Aggressive personality: only diplomacy when threatened by multiple enemies.
 */
export function evaluateDiplomaticActions(
  empire: Empire,
  evaluation: AIEvaluation,
  personality: AIPersonality,
): AIDecision[] {
  const decisions: AIDecision[] = [];

  const sortedThreats = Array.from(evaluation.threatAssessment.entries()).sort(
    ([, a], [, b]) => b - a,
  );

  for (const [opponentId, threatLevel] of sortedThreats) {
    const relation = empire.diplomacy.find(d => d.empireId === opponentId);
    const status: DiplomaticStatus = relation?.status ?? 'unknown';

    // Skip empires we're already at war with or allied with
    if (status === 'at_war' || status === 'allied') continue;

    const alreadyHasNonAggression = relation?.treaties.some(t => t.type === 'non_aggression') ?? false;
    const alreadyHasTrade = relation?.treaties.some(t => t.type === 'trade') ?? false;

    const alreadyHasResearch = relation?.treaties.some(t => t.type === 'research_sharing') ?? false;
    const alreadyHasDefence = relation?.treaties.some(t => t.type === 'mutual_defence') ?? false;
    const alreadyHasAlliance = relation?.treaties.some(t => t.type === 'alliance') ?? false;

    // Threat-reactive diplomacy: when a high-threat aggressor exists, ALL
    // non-aggressive species seek safety in numbers.  Even researchers and
    // economists will form alliances when survival is at stake.
    const maxThreatValue = Math.max(0, ...Array.from(evaluation.threatAssessment.values()));
    const someoneIsAggressive = maxThreatValue > 50;
    const weAreNotAggressive = personality !== 'aggressive';
    const thisOneIsNotTheAggressor = threatLevel < 40;
    if (someoneIsAggressive && weAreNotAggressive && thisOneIsNotTheAggressor && status !== 'hostile') {
      // Seek alliance with non-threatening empires against the aggressor
      if (!alreadyHasTrade) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(75, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'trade' },
          reasoning: `Seek trade with ${opponentId} — safety in numbers against aggressor (maxThreat: ${maxThreatValue})`,
        });
      }
      if (!alreadyHasNonAggression) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(70, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'non_aggression' },
          reasoning: `Seek non-aggression with ${opponentId} — mutual protection (maxThreat: ${maxThreatValue})`,
        });
      }
      if (alreadyHasNonAggression && !alreadyHasDefence) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(72, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'mutual_defence' },
          reasoning: `Seek mutual defence with ${opponentId} against common threat (maxThreat: ${maxThreatValue})`,
        });
      }
      if (alreadyHasDefence && !alreadyHasAlliance) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(74, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'alliance' },
          reasoning: `Form alliance with ${opponentId} — unite against aggressor (maxThreat: ${maxThreatValue})`,
        });
      }
    }

    if (personality === 'diplomatic') {
      // Diplomatic: propose the full treaty ladder based on current relationship
      if (!alreadyHasTrade) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(65, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'trade' },
          reasoning: `Propose trade treaty with ${opponentId} (diplomatic strategy)`,
        });
      }
      if (!alreadyHasNonAggression && status !== 'hostile') {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(60, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'non_aggression' },
          reasoning: `Propose non-aggression with ${opponentId} (diplomatic strategy)`,
        });
      }
      if (alreadyHasTrade && !alreadyHasResearch) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(50, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'research_sharing' },
          reasoning: `Propose research sharing with ${opponentId} (existing trade)`,
        });
      }
      if (alreadyHasNonAggression && !alreadyHasDefence && threatLevel < 50) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(45, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'mutual_defence' },
          reasoning: `Propose mutual defence with ${opponentId} (existing non-aggression)`,
        });
      }
      if (alreadyHasDefence && !alreadyHasAlliance && threatLevel < 40 && status !== 'hostile') {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(40, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'alliance' },
          reasoning: `Propose alliance with ${opponentId} (established relationship)`,
        });
      }
    }

    if (personality === 'defensive' || personality === 'economic') {
      // Defensive/economic: non-aggression with powerful neighbours
      if (threatLevel > 40 && !alreadyHasNonAggression && status !== 'hostile') {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(50 + threatLevel * 0.2, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'non_aggression' },
          reasoning: `Propose non-aggression with ${opponentId} (threat: ${threatLevel})`,
        });
      }
      // Economic: also propose trade
      if (personality === 'economic' && !alreadyHasTrade && status !== 'hostile') {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(55, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'trade' },
          reasoning: `Propose trade with ${opponentId} (economic strategy)`,
        });
      }
    }

    if (personality === 'researcher') {
      // Researcher: propose research sharing with anyone not hostile
      if (!alreadyHasResearch && status !== 'hostile') {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(60, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'research_sharing' },
          reasoning: `Propose research sharing with ${opponentId} (researcher strategy)`,
        });
      }
      if (!alreadyHasTrade && status !== 'hostile') {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(45, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'trade' },
          reasoning: `Propose trade with ${opponentId} (funding research)`,
        });
      }
    }

    if (personality === 'aggressive') {
      // Aggressive: only seek peace when overwhelmed by multiple strong threats
      const warCount = Array.from(evaluation.threatAssessment.values()).filter(t => t > 60).length;
      if (warCount > 1 && threatLevel > 70 && !alreadyHasNonAggression) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(30, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'non_aggression' },
          reasoning: `Seek non-aggression with ${opponentId} — too many fronts (threat: ${threatLevel})`,
        });
      }
    }
  }

  return decisions;
}

/**
 * Evaluate building construction priorities across all owned planets.
 *
 * Uses personality-preferred building lists to rank construction decisions.
 * Avoids suggesting buildings that are already built or queued, or where
 * the empire cannot afford the base cost.
 */
export function evaluateBuildingPriority(
  empire: Empire,
  planets: Planet[],
  personality: AIPersonality,
  evaluation?: AIEvaluation,
): AIDecision[] {
  const decisions: AIDecision[] = [];
  const preferred = PERSONALITY_PREFERRED_BUILDINGS[personality];

  // Threat-reactive building: when we know of aggressive opponents, ALL
  // personalities should build defences.  A researcher who ignores a
  // warlord on their border won't survive to finish their research.
  const maxThreat = evaluation
    ? Math.max(0, ...Array.from(evaluation.threatAssessment.values()))
    : 0;
  const isAtWar = empire.diplomacy.some(r => r.status === 'at_war');
  const underThreat = maxThreat > 30 || isAtWar;

  for (const planet of planets) {
    if (planet.ownerId !== empire.id) continue;
    if (planet.type === 'gas_giant') continue;

    const builtTypes = new Set(planet.buildings.map(b => b.type));
    const queuedTypes = new Set(planet.productionQueue.map(q => q.templateId as BuildingType));
    const usedSlots = planet.buildings.length + planet.productionQueue.length;

    // Rough slot limit (use building slot constants would be ideal, but we
    // have access to planet type via imports if needed; keep it simple here)
    if (usedSlots >= 15) continue;

    preferred.forEach((buildingType, rankIndex) => {
      if (builtTypes.has(buildingType)) return;
      if (queuedTypes.has(buildingType)) return;

      // Check prerequisites: shipyard and defense_grid need spaceport
      if (buildingType === 'shipyard' || buildingType === 'defense_grid') {
        if (!builtTypes.has('spaceport')) return;
      }

      const def = BUILDING_DEFINITIONS[buildingType];
      if (!def) return;

      // Check affordability (credits only — a rough gate)
      const creditCost = def.baseCost.credits ?? 0;
      if (empire.credits < creditCost) return;

      // Higher ranked preferences (lower rankIndex) get higher priority
      const rankBonus = Math.max(0, (preferred.length - rankIndex) * 8);
      const basePriority = 40 + rankBonus;

      decisions.push({
        type: 'build',
        priority: applyWeight(basePriority, 'build', personality),
        params: { planetId: planet.id, buildingType },
        reasoning: `Build ${buildingType} on ${planet.name} (personality: ${personality}, rank ${rankIndex + 1})`,
      });
    });

    // Universal: suggest research labs for any empire that doesn't have one yet
    if (
      !builtTypes.has('research_lab') &&
      !queuedTypes.has('research_lab') &&
      empire.credits >= (BUILDING_DEFINITIONS.research_lab.baseCost.credits ?? 0)
    ) {
      decisions.push({
        type: 'build',
        priority: applyWeight(35, 'build', personality),
        params: { planetId: planet.id, buildingType: 'research_lab' },
        reasoning: `Build research lab on ${planet.name} (no research lab yet)`,
      });
    }

    // Universal: ensure shipyard exists for ship production
    if (
      !builtTypes.has('shipyard') &&
      !queuedTypes.has('shipyard') &&
      builtTypes.has('spaceport')
    ) {
      decisions.push({
        type: 'build',
        priority: applyWeight(60, 'build', personality),
        params: { planetId: planet.id, buildingType: 'shipyard' as BuildingType },
        reasoning: `Build shipyard on ${planet.name} (needed for ship production)`,
      });
    }

    // Threat-reactive: build planetary defences when under threat.
    // Even peaceful species will fortify when they know aggressors exist.
    if (underThreat && builtTypes.has('spaceport')) {
      // Defense grid — first line of planetary defence
      if (!builtTypes.has('defense_grid') && !queuedTypes.has('defense_grid')) {
        const priority = isAtWar ? 90 : 70;
        decisions.push({
          type: 'build',
          priority: applyWeight(priority, 'build', personality),
          params: { planetId: planet.id, buildingType: 'defense_grid' as BuildingType },
          reasoning: `Build defence grid on ${planet.name} (threat: ${maxThreat}, at war: ${isAtWar})`,
        });
      }
      // Military academy — trains ground troops for defence
      if (!builtTypes.has('military_academy') && !queuedTypes.has('military_academy')) {
        const priority = isAtWar ? 85 : 60;
        decisions.push({
          type: 'build',
          priority: applyWeight(priority, 'build', personality),
          params: { planetId: planet.id, buildingType: 'military_academy' as BuildingType },
          reasoning: `Build military academy on ${planet.name} (threat: ${maxThreat}, at war: ${isAtWar})`,
        });
      }
    }

    // Proactive: build food buildings when population approaches 80% of the
    // natural food capacity, or urgently when the empire is already food-negative.
    // Prefer the best available building for this planet's fertility level:
    //   fertility >= 60 → concentrated_farming (100 food)
    //   fertility >= 20 → greenhouse_farming (50 food)
    //   any             → hydroponics_bay (8 food)
    const naturalCap = Math.floor(((planet.fertility ?? 0) / 100) * planet.maxPopulation);
    const foodBuildThreshold = Math.floor(naturalCap * 0.8);
    const isFoodType = (t: string) =>
      t === 'concentrated_farming' || t === 'greenhouse_farming' || t === 'hydroponics_bay';
    const foodCount = planet.buildings.filter(b => isFoodType(b.type)).length;
    const foodQueued = planet.productionQueue.filter(q => isFoodType(q.templateId)).length;
    // Empire-wide food production check: sum food buildings across all planets
    const empirePlanets = planets.filter(p => p.ownerId === empire.id);
    const empireTotalFoodBldgs = empirePlanets.reduce((sum, p) =>
      sum + p.buildings.filter(b => isFoodType(b.type)).length, 0);
    const empireTotalFoodQueued = empirePlanets.reduce((sum, p) =>
      sum + p.productionQueue.filter(q => isFoodType(q.templateId)).length, 0);

    if (planet.currentPopulation > foodBuildThreshold) {
      const fertility = planet.fertility ?? 0;
      const foodBuildingType: BuildingType =
        fertility >= 60 ? 'concentrated_farming' :
        fertility >= 20 ? 'greenhouse_farming' :
        'hydroponics_bay';

      // Allow more food buildings when the empire is under food pressure.
      // Normal cap: 4 per planet. Under pressure: no cap (fill available slots).
      const maxFoodBldgs = planet.currentPopulation > naturalCap ? 8 : 4;
      if (foodCount < maxFoodBldgs && foodQueued === 0) {
        // Escalating priority: approaching cap → past cap → critical
        let priority = 65;
        if (planet.currentPopulation > naturalCap) priority = 85;
        if (planet.currentPopulation > naturalCap * 1.2) priority = 95;
        decisions.push({
          type: 'build',
          priority: applyWeight(priority, 'build', personality),
          params: { planetId: planet.id, buildingType: foodBuildingType },
          reasoning: `Build ${foodBuildingType} on ${planet.name} (pop ${planet.currentPopulation} at ${Math.round(planet.currentPopulation / Math.max(1, naturalCap) * 100)}% of food capacity)`,
        });
      }
    }

    // Reactive: build power plant when energy is low (critical infrastructure)
    const powerPlants = planet.buildings.filter(b => b.type === 'power_plant').length;
    const powerQueued = planet.productionQueue.filter(q => q.templateId === 'power_plant').length;
    if (
      powerPlants < 3 &&
      powerQueued === 0 &&
      planet.buildings.length > 3 * (powerPlants + 1)
    ) {
      // High priority — energy deficit halves all production
      decisions.push({
        type: 'build',
        priority: applyWeight(70, 'build', personality),
        params: { planetId: planet.id, buildingType: 'power_plant' as BuildingType },
        reasoning: `Build power plant on ${planet.name} (${planet.buildings.length} buildings need power)`,
      });
    }

    // Evaluate upgrading existing buildings
    for (const building of planet.buildings) {
      const bDef = BUILDING_DEFINITIONS[building.type];
      if (!bDef) continue;

      const ageCap = getMaxLevelForAge(building.type, empire.currentAge);
      if (building.level >= ageCap) continue;
      if (building.level >= bDef.maxLevel) continue;

      // Don't queue if already upgrading this building
      const alreadyUpgrading = planet.productionQueue.some(
        q => q.type === 'building_upgrade' && q.targetBuildingId === building.id,
      );
      if (alreadyUpgrading) continue;

      // Check affordability (credits only — a rough gate)
      const upgradeCost = getUpgradeCost(building.type, building.level);
      const creditCost = upgradeCost.credits ?? 0;
      if (empire.credits < creditCost) continue;

      // Priority: preferred types get a bonus, higher levels get lower priority
      const isPreferred = preferred.includes(building.type);
      const levelPenalty = building.level * 5;
      const basePriority = 30 + (isPreferred ? 15 : 0) - levelPenalty;

      if (basePriority > 0) {
        decisions.push({
          type: 'build',
          priority: applyWeight(basePriority, 'build', personality),
          params: { planetId: planet.id, buildingId: building.id, buildingType: building.type },
          reasoning: `Upgrade ${building.type} on ${planet.name} from Lv.${building.level} to Lv.${building.level + 1}`,
        });
      }
    }
  }

  return decisions;
}

// ---------------------------------------------------------------------------
// Espionage evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the AI should recruit spies or reassign idle agents.
 *
 * Heuristics:
 *  - Recruit a spy if we have fewer than 2 agents and can afford it.
 *  - Assign idle (no-target) agents to the empire we perceive as the biggest threat.
 *  - Aggressive / researcher personalities favour steal_tech;
 *    aggressive also favours sabotage; others default to gather_intel.
 */
function evaluateEspionageActions(
  empire: Empire,
  gameState: GameState,
  personality: AIPersonality,
  evaluation: AIEvaluation,
): AIDecision[] {
  const decisions: AIDecision[] = [];

  // Don't consider espionage if there are no other empires
  const rivals = gameState.empires.filter(e => e.id !== empire.id);
  if (rivals.length === 0) return decisions;

  // Target: empire with the highest threat level
  let topThreatId = rivals[0]!.id;
  let topThreat = 0;
  for (const rival of rivals) {
    const threat = evaluation.threatAssessment.get(rival.id) ?? 0;
    if (threat > topThreat) {
      topThreat = threat;
      topThreatId = rival.id;
    }
  }

  // Choose preferred mission based on personality
  let preferredMission: 'gather_intel' | 'steal_tech' | 'sabotage' | 'counter_intel' = 'gather_intel';
  if (personality === 'aggressive') preferredMission = 'sabotage';
  else if (personality === 'researcher') preferredMission = 'steal_tech';
  else if (personality === 'defensive') preferredMission = 'counter_intel';

  // Recruit a spy if we have fewer than 2 and can afford it
  // (The actual credit check is done at execution time in the game loop.)
  const agentCount = gameState.empires.length; // placeholder — real count checked at execution
  if (empire.credits >= 200 && agentCount < 3) {
    decisions.push({
      type: 'recruit_spy',
      priority: applyWeight(35, 'recruit_spy', personality),
      params: { targetEmpireId: topThreatId, mission: preferredMission },
      reasoning: `Recruit spy: target ${topThreatId} (threat ${topThreat.toFixed(0)})`,
    });
  }

  // Assign idle agents — this is handled at the game-loop level since
  // it needs access to espionageState. We emit a decision that the
  // executor will interpret.
  decisions.push({
    type: 'assign_spy',
    priority: applyWeight(25, 'assign_spy', personality),
    params: { targetEmpireId: topThreatId, mission: preferredMission },
    reasoning: `Assign idle spies to ${topThreatId} (${preferredMission})`,
  });

  return decisions;
}

// ---------------------------------------------------------------------------
// Top-level: generateAIDecisions
// ---------------------------------------------------------------------------

/**
 * Generate a prioritized list of AI decisions for one empire in one game tick.
 *
 * Each decision category is evaluated independently; personality multipliers
 * are applied to the base priorities so that each AI archetype has a clearly
 * distinct playstyle. The returned list is sorted highest-priority first.
 *
 * Note: Decisions are generated but not executed here. The game loop is
 * responsible for executing or scheduling them.
 */
export function generateAIDecisions(
  empire: Empire,
  gameState: GameState,
  personality: AIPersonality,
  evaluation: AIEvaluation,
  allTechs: Technology[] = [],
): AIDecision[] {
  // Compute situational context — drives adaptive weight multipliers.
  // Set on module scope so all applyWeight calls in sub-evaluators use it.
  const sitCtx = buildSituationalContext(empire, gameState.galaxy, gameState.fleets);
  _activeSituationalContext = sitCtx;

  const researchState: ResearchState = {
    completedTechs: empire.technologies,
    activeResearch: [],
    currentAge: empire.currentAge,
    totalResearchGenerated: empire.researchPoints,
  };

  const ownedPlanets = getEmpirePlanets(empire, gameState.galaxy);

  // Victory goal boosts colonisation priority for territorial victories
  const decisionVictoryGoal = inferVictoryGoal(personality, gameState.victoryCriteria);
  const isInStalemate = evaluation.stalemateWars.size > 0;
  // Stalemate: boost expansion even higher — outgrow the rival while maintaining the front
  const expansionBoost = isInStalemate ? 2.0
    : (decisionVictoryGoal === 'conquest' || decisionVictoryGoal === 'dominance') ? 1.5
    : 1.0;

  const colonization = evaluateColonizationTargets(empire, gameState.galaxy, empire.species).map(
    d => ({ ...d, priority: Math.min(100, applyWeight(d.priority, 'colonize', personality, sitCtx) * expansionBoost) }),
  );

  let research = evaluateResearchPriority(empire, researchState, personality, allTechs);
  // During stalemate, boost weapon/defence research to break the deadlock
  if (isInStalemate) {
    research = research.map(d => {
      const techId = d.params['techId'] as string | undefined;
      const tech = techId ? allTechs.find(t => t.id === techId) : undefined;
      const isCombatTech = tech && (tech.category === 'weapons' || tech.category === 'defense');
      const isAgeTech = tech?.effects?.some((e: any) => e.type === 'age_unlock');
      const boost = isAgeTech ? 2.0 : isCombatTech ? 1.8 : 1.0;
      return { ...d, priority: Math.min(100, d.priority * boost) };
    });
  }

  // Compute average empire happiness for war strategy analysis
  const empireHappinessScores = ownedPlanets
    .filter(p => p.currentPopulation > 0)
    .map(p => {
      // Rough happiness estimate: base 60, penalise overcrowding and war
      const density = p.maxPopulation > 0 ? p.currentPopulation / p.maxPopulation : 0;
      let score = 60;
      if (density > 0.8) score -= 10;
      if (density > 0.95) score -= 10;
      if (empire.diplomacy.some(d => d.status === 'at_war')) score -= 10;
      return Math.max(0, Math.min(100, score));
    });
  const avgHappiness = empireHappinessScores.length > 0
    ? empireHappinessScores.reduce((a, b) => a + b, 0) / empireHappinessScores.length
    : null;

  const military = evaluateMilitaryActions(
    empire,
    gameState.galaxy,
    gameState.fleets,
    gameState.ships,
    evaluation,
    gameState,
    avgHappiness,
  );

  const economic = evaluateEconomicActions(empire, gameState.galaxy).map(d => ({
    ...d,
    priority: applyWeight(d.priority, 'build', personality),
  }));

  // Stalemate boosts diplomacy (seek allies), espionage (destabilise rival),
  // and weapon/defence research (break the deadlock with better tech)
  const stalemateMultiplier = isInStalemate ? 1.8 : 1.0;

  const diplomatic = evaluateDiplomaticActions(empire, evaluation, personality).map(d => ({
    ...d,
    priority: Math.min(100, d.priority * stalemateMultiplier),
  }));

  const building = evaluateBuildingPriority(empire, ownedPlanets, personality, evaluation);

  // Ship building: ensure the empire has a standing fleet and colony ships for expansion
  const shipDecisions: AIDecision[] = [];
  const empireFleets = getEmpireFleets(empire, gameState.fleets);
  const totalShips = empireFleets.reduce((sum, f) => sum + f.ships.length, 0);
  // Ship target adapts to situation: personality sets the peacetime baseline,
  // but war and low safety drive it up. Any species under threat builds more ships.
  const baseShipTarget = personality === 'aggressive' ? 10 : personality === 'defensive' ? 6 : 4;
  const warBonus = sitCtx.activeWars * 3;
  const safetyBonus = sitCtx.safety < 50 ? Math.round((50 - sitCtx.safety) / 10) : 0;
  const shipTarget = baseShipTarget + warBonus + safetyBonus;

  const shipyard = ownedPlanets.find(p => p.buildings.some(b => b.type === 'shipyard'));
  if (shipyard) {
    // Build warships when below target — escalate hull class as fleet grows
    // AND tech age. Early game: destroyers. Mid-game: cruisers. Late-game:
    // battleships. Anti-matter age: heavy battleships. Singularity: planet killers.
    if (totalShips < shipTarget) {
      const AGE_ORDER = ['nano_atomic', 'fusion', 'nano_fusion', 'anti_matter', 'singularity'];
      const empireAgeIdx = AGE_ORDER.indexOf(empire.currentAge ?? 'nano_atomic');
      const isAntiMatter = empireAgeIdx >= 3;
      const isSingularity = empireAgeIdx >= 4;
      const hullClass: HullClass =
        isSingularity && totalShips >= 18 ? 'planet_killer' :
        isAntiMatter && totalShips >= 15 ? 'battle_station' :
        isAntiMatter && totalShips >= 12 ? 'heavy_battleship' :
        totalShips >= 10 ? 'battleship' :
        totalShips >= 5  ? 'light_cruiser' :
        'destroyer';
      shipDecisions.push({
        type: 'build_ship',
        priority: applyWeight(55, 'build_ship', personality),
        params: { planetId: shipyard.id, hullClass },
        reasoning: `Build ${hullClass}: have ${totalShips}/${shipTarget} target ships`,
      });
    }

    // Build colony ships for expansion — scaled by victory goal and available targets
    const stateDesigns = (gameState as unknown as Record<string, unknown>).shipDesigns as
      | Map<string, { hull: string }> | undefined;
    const empireShipIds = new Set(empireFleets.flatMap(f => f.ships));
    const empireShips = gameState.ships.filter(s => empireShipIds.has(s.id));
    const coloniserCount = empireShips.filter(s => {
      const design = stateDesigns?.get(s.designId);
      return design?.hull.startsWith('coloniser');
    }).length;

    // Check expansion opportunities: known unclaimed planets OR unexplored systems
    const knownUnclaimedHabitable = gameState.galaxy.systems
      .filter(s => empire.knownSystems.includes(s.id))
      .flatMap(s => s.planets)
      .filter(p => p.maxPopulation > 0 && !p.ownerId).length;
    const hasUnexploredSystems = gameState.galaxy.systems.length > empire.knownSystems.length;
    const hasExpansionTargets = knownUnclaimedHabitable > 0 || hasUnexploredSystems;

    // Victory goal drives expansion aggressiveness
    const victoryGoal = inferVictoryGoal(personality, gameState.victoryCriteria);
    const isExpansionGoal = victoryGoal === 'conquest' || victoryGoal === 'dominance';
    // Conquest/dominance: up to 3 colonisers at once; expansionist personality: 2; others: 1
    const maxColonisers = isExpansionGoal ? 3 : personality === 'expansionist' ? 2 : 1;

    if (coloniserCount < maxColonisers && hasExpansionTargets) {
      const basePriority = isExpansionGoal ? 85 : personality === 'expansionist' ? 75 : 50;
      shipDecisions.push({
        type: 'build_ship',
        priority: applyWeight(basePriority, 'build_ship', personality),
        params: { planetId: shipyard.id, hullClass: 'coloniser_gen1' },
        reasoning: `Build colony ship for expansion (${ownedPlanets.length} planets, ${knownUnclaimedHabitable} unclaimed targets, goal=${victoryGoal})`,
      });
    }

    // Build scouts for exploration — more for expansion-focused empires
    const scoutCount = empireShips.filter(s => {
      const design = stateDesigns?.get(s.designId);
      return design?.hull === 'patrol' || design?.hull === 'science_probe';
    }).length;
    const maxScouts = isExpansionGoal ? 3 : personality === 'expansionist' ? 2 : 1;
    if (scoutCount < maxScouts && hasUnexploredSystems) {
      const scoutPriority = isExpansionGoal ? 70 : 45;
      shipDecisions.push({
        type: 'build_ship',
        priority: applyWeight(scoutPriority, 'build_ship', personality),
        params: { planetId: shipyard.id, hullClass: 'patrol' },
        reasoning: `Build scout for exploration (${scoutCount}/${maxScouts} scouts, ${isExpansionGoal ? 'expansion goal' : 'general'})`,
      });
    }
  }

  // Cross-system colonisation: send ALL idle colony ship fleets to uncolonised systems
  const stateDesignsOuter = (gameState as unknown as Record<string, unknown>).shipDesigns as
    | Map<string, { hull: string }> | undefined;
  const empireShipIdsOuter = new Set(empireFleets.flatMap(f => f.ships));
  {
    // Find all idle fleets containing a coloniser ship
    const coloniserFleets = empireFleets.filter(f => {
      if (f.destination) return false; // Already moving
      return f.ships.some(shipId => {
        const ship = gameState.ships.find(s => s.id === shipId);
        if (!ship) return false;
        const design = stateDesignsOuter?.get(ship.designId);
        return design?.hull.startsWith('coloniser');
      });
    });

    // Find all known systems with uncolonised habitable planets
    const targetSystems = gameState.galaxy.systems.filter(s =>
      empire.knownSystems.includes(s.id) &&
      !s.planets.some(p => p.ownerId === empire.id) &&
      s.planets.some(p => !p.ownerId && calculateHabitability(p, empire.species).score >= 40),
    );

    // Also find unexplored systems as fallback targets for coloniser-led exploration
    const knownSystemSet = new Set(empire.knownSystems);
    const unexploredSystems = gameState.galaxy.systems.filter(s => !knownSystemSet.has(s.id));

    // Dispatch each idle coloniser to a unique target system
    const assignedTargets = new Set<string>();
    const colVictoryGoal = inferVictoryGoal(personality, gameState.victoryCriteria);
    const isColExpansionGoal = colVictoryGoal === 'conquest' || colVictoryGoal === 'dominance';
    const baseMoveP = isColExpansionGoal ? 85 : personality === 'expansionist' ? 80 : 60;

    for (const fleet of coloniserFleets) {
      // Prefer known habitable targets; fall back to unexplored systems
      const knownTarget = targetSystems.find(s => !assignedTargets.has(s.id));
      const target = knownTarget ?? unexploredSystems.find(s => !assignedTargets.has(s.id));
      if (!target) break;
      assignedTargets.add(target.id);
      shipDecisions.push({
        type: 'move_fleet',
        priority: applyWeight(baseMoveP, 'move_fleet', personality),
        params: {
          fleetId: fleet.id,
          destinationSystemId: target.id,
          purpose: 'colonise',
        },
        reasoning: `Send colony ship to ${target.name ?? target.id} for ${knownTarget ? 'colonisation' : 'exploration + colonisation'}`,
      });
    }
  }

  // Espionage: recruit spies and assign missions against rival empires
  const espionageDecisions = evaluateEspionageActions(empire, gameState, personality, evaluation).map(d => ({
    ...d,
    priority: Math.min(100, d.priority * stalemateMultiplier),
  }));

  const allDecisions = [
    ...colonization,
    ...research,
    ...military,
    ...economic,
    ...diplomatic,
    ...building,
    ...shipDecisions,
    ...espionageDecisions,
  ];

  // Clear module-scoped context
  _activeSituationalContext = null;

  return allDecisions.sort((a, b) => b.priority - a.priority);
}

// ---------------------------------------------------------------------------
// Public: selectTopDecisions
// ---------------------------------------------------------------------------

/**
 * Select the top N decisions from a prioritized list.
 *
 * Decisions are assumed to be pre-sorted by priority (highest first).
 * This function deduplicates: at most one decision per (type, primary target)
 * pair is kept, so the AI doesn't issue ten simultaneous colonize orders for
 * the same planet.
 */
export function selectTopDecisions(decisions: AIDecision[], maxDecisions: number): AIDecision[] {
  const seen = new Set<string>();
  const result: AIDecision[] = [];

  for (const decision of decisions) {
    // Build a deduplication key from type + primary target param
    // For build_ship, include hullClass so warship and coloniser builds don't collide
    const targetKey =
      (decision.params['planetId'] as string | undefined) ??
      (decision.params['techId'] as string | undefined) ??
      (decision.params['targetEmpireId'] as string | undefined) ??
      (decision.params['destinationSystemId'] as string | undefined) ??
      '';
    const hullSuffix = decision.type === 'build_ship' && decision.params['hullClass']
      ? `:${decision.params['hullClass']}` : '';
    const key = `${decision.type}:${targetKey}${hullSuffix}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(decision);

    if (result.length >= maxDecisions) break;
  }

  return result;
}
