/**
 * Strategic AI decision engine — pure functions for computer-player decision-making.
 *
 * Design principle: No cheating. The AI plays by the same rules as humans.
 * Higher difficulty should be achieved by better decision quality, not resource
 * bonuses. All functions are side-effect-free.
 */

import type { Empire, Species, AIPersonality, DiplomaticStatus } from '../types/species.js';
import type { Galaxy, Planet, BuildingType } from '../types/galaxy.js';
import type { GameState } from '../types/game-state.js';
import type { Fleet, Ship } from '../types/ships.js';
import type { Technology } from '../types/technology.js';
import { calculateHabitability, canColonize, getUpgradeCost, getMaxLevelForAge } from './colony.js';
import { getFleetStrength } from './fleet.js';
import { getAvailableTechs, type ResearchState } from './research.js';
import { BUILDING_DEFINITIONS } from '../constants/buildings.js';

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

/** Apply personality weight to a base priority score. */
function applyWeight(basePriority: number, type: AIDecision['type'], personality: AIPersonality): number {
  const weight = PERSONALITY_WEIGHTS[personality][type] ?? 1.0;
  return clamp100(basePriority * weight);
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
// Public: evaluateEmpireState
// ---------------------------------------------------------------------------

/**
 * Evaluate the current state of an empire and return a snapshot of key metrics
 * and threat assessments that feed into decision generation.
 */
export function evaluateEmpireState(
  empire: Empire,
  galaxy: Galaxy,
  fleets: Fleet[],
  ships: Ship[],
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

  return {
    empireId: empire.id,
    militaryPower,
    economicPower,
    techLevel,
    expansionPotential,
    threatAssessment,
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
    const basePriority = isPreferred ? 60 + costFactor * 15 : 30 + costFactor * 10;

    decisions.push({
      type: 'research',
      priority: applyWeight(basePriority, 'research', personality),
      params: { techId: tech.id, category: tech.category, cost: tech.cost },
      reasoning: `Research ${tech.name} (${tech.category}${isPreferred ? ', preferred' : ''})`,
    });
  }

  return decisions;
}

/**
 * Evaluate military actions: scouting, fleet movements, and attack decisions.
 *
 * - Aggressive personality: attack the weakest neighbour when own military is
 *   at least 1.5x theirs.
 * - All personalities: move fleets toward threatened borders.
 * - Scout unexplored connected systems when no immediate threats exist.
 */
export function evaluateMilitaryActions(
  empire: Empire,
  galaxy: Galaxy,
  fleets: Fleet[],
  ships: Ship[],
  evaluation: AIEvaluation,
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

  // Scout unexplored systems — always valuable, especially for expansionist
  if (unexplored.length > 0) {
    const scoutTarget = unexplored[0]!;
    const personality = empire.aiPersonality ?? 'defensive';
    const basePriority = personality === 'expansionist' ? 55 : 35;
    decisions.push({
      type: 'move_fleet',
      priority: applyWeight(basePriority, 'move_fleet', personality),
      params: {
        fleetId: empireFleets[0]!.id,
        destinationSystemId: scoutTarget,
        purpose: 'scout',
      },
      reasoning: `Scout unexplored system ${scoutTarget}`,
    });
  }

  // Evaluate offensive opportunities (aggressive personality)
  const personality = empire.aiPersonality ?? 'defensive';
  const highestThreat = Array.from(evaluation.threatAssessment.entries()).sort(
    ([, a], [, b]) => b - a,
  );

  if (highestThreat.length > 0) {
    for (const [opponentId, threatLevel] of highestThreat) {
      const opponentFleets = fleets.filter(f => f.empireId === opponentId);
      const opponentMilitary = computeMilitaryPower(opponentFleets, ships);
      const attackRatio = opponentMilitary > 0
        ? evaluation.militaryPower / opponentMilitary
        : evaluation.militaryPower > 0 ? 3 : 0;

      // At war: always reinforce / move to attack
      const relation = empire.diplomacy.find(d => d.empireId === opponentId);
      if (relation?.status === 'at_war' && empireFleets.length > 0) {
        // Find opponent-owned systems to target
        const targetSystem = galaxy.systems.find(s => s.ownerId === opponentId);
        if (targetSystem) {
          decisions.push({
            type: 'move_fleet',
            priority: applyWeight(70, 'move_fleet', personality),
            params: {
              fleetId: empireFleets[0]!.id,
              destinationSystemId: targetSystem.id,
              purpose: 'attack',
              targetEmpireId: opponentId,
            },
            reasoning: `Attack ${opponentId} in system ${targetSystem.id} (at war)`,
          });
        }
      }

      // Declare war: aggressive personalities attack weaker neighbours
      if (
        personality === 'aggressive' &&
        attackRatio >= 1.5 &&
        threatLevel > 20 &&
        relation?.status !== 'at_war' &&
        relation?.status !== 'allied'
      ) {
        decisions.push({
          type: 'war',
          priority: applyWeight(50 + Math.min(attackRatio * 10, 30), 'war', personality),
          params: { targetEmpireId: opponentId, attackRatio },
          reasoning: `Declare war on ${opponentId} (attack ratio ${attackRatio.toFixed(1)}x)`,
        });
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
          decisions.push({
            type: 'move_fleet',
            priority: applyWeight(45, 'move_fleet', personality),
            params: {
              fleetId: empireFleets[0]!.id,
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

    if (personality === 'diplomatic') {
      // Diplomatic: propose trade and alliances broadly
      if (!alreadyHasTrade) {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(65, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'trade' },
          reasoning: `Propose trade treaty with ${opponentId} (diplomatic strategy)`,
        });
      }
      if (threatLevel < 40 && status !== 'hostile') {
        decisions.push({
          type: 'diplomacy',
          priority: applyWeight(55, 'diplomacy', personality),
          params: { targetEmpireId: opponentId, action: 'propose_treaty', treatyType: 'alliance' },
          reasoning: `Propose alliance with ${opponentId} (low threat, diplomatic strategy)`,
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
): AIDecision[] {
  const decisions: AIDecision[] = [];
  const preferred = PERSONALITY_PREFERRED_BUILDINGS[personality];

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
  const researchState: ResearchState = {
    completedTechs: empire.technologies,
    activeResearch: [],
    currentAge: empire.currentAge,
    totalResearchGenerated: empire.researchPoints,
  };

  const ownedPlanets = getEmpirePlanets(empire, gameState.galaxy);

  const colonization = evaluateColonizationTargets(empire, gameState.galaxy, empire.species).map(
    d => ({ ...d, priority: applyWeight(d.priority, 'colonize', personality) }),
  );

  const research = evaluateResearchPriority(empire, researchState, personality, allTechs);

  const military = evaluateMilitaryActions(
    empire,
    gameState.galaxy,
    gameState.fleets,
    gameState.ships,
    evaluation,
  );

  const economic = evaluateEconomicActions(empire, gameState.galaxy).map(d => ({
    ...d,
    priority: applyWeight(d.priority, 'build', personality),
  }));

  const diplomatic = evaluateDiplomaticActions(empire, evaluation, personality);

  const building = evaluateBuildingPriority(empire, ownedPlanets, personality);

  // Ship building: ensure the empire has at least a small standing fleet
  const shipDecisions: AIDecision[] = [];
  const empireFleets = getEmpireFleets(empire, gameState.fleets);
  const totalShips = empireFleets.reduce((sum, f) => sum + f.ships.length, 0);
  const shipTarget = personality === 'aggressive' ? 8 : personality === 'defensive' ? 6 : 3;

  if (totalShips < shipTarget) {
    const shipyard = ownedPlanets.find(p => p.buildings.some(b => b.type === 'shipyard'));
    if (shipyard) {
      shipDecisions.push({
        type: 'build_ship',
        priority: applyWeight(55, 'build_ship', personality),
        params: { planetId: shipyard.id, hullClass: 'destroyer' },
        reasoning: `Build ships: have ${totalShips}/${shipTarget} target ships`,
      });
    }
  }

  // Espionage: recruit spies and assign missions against rival empires
  const espionageDecisions = evaluateEspionageActions(empire, gameState, personality, evaluation);

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
    const targetKey =
      (decision.params['planetId'] as string | undefined) ??
      (decision.params['techId'] as string | undefined) ??
      (decision.params['targetEmpireId'] as string | undefined) ??
      (decision.params['destinationSystemId'] as string | undefined) ??
      '';
    const key = `${decision.type}:${targetKey}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(decision);

    if (result.length >= maxDecisions) break;
  }

  return result;
}
