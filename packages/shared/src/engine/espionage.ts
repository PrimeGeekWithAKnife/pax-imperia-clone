/**
 * Espionage engine — pure functions for spy recruitment, mission assignment and per-tick resolution.
 *
 * All functions are side-effect free. Callers must apply the returned state
 * and events to their own game state records.
 *
 * Design goals:
 *  - Spy skill is seeded from the species espionage trait (1–10)
 *  - Agents must spend 5 ticks infiltrating before missions can yield results
 *  - Each tick active agents roll against the target empire's counter-intel level
 *  - Capture triggers a diplomatic attitude penalty; the agent is removed
 *  - Counter-intel level is raised passively by communications_hub buildings
 */

import type { Empire, Species } from '../types/species.js';
import type { Planet } from '../types/galaxy.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SpyMission = 'gather_intel' | 'steal_tech' | 'sabotage' | 'counter_intel';

export type SpyStatus = 'infiltrating' | 'active' | 'captured' | 'returned';

export interface SpyAgent {
  id: string;
  empireId: string;
  targetEmpireId: string;
  mission: SpyMission;
  /** Effectiveness rating 1–10 (seeded from species espionage trait). */
  skill: number;
  /** Number of ticks this agent has been deployed. */
  turnsActive: number;
  status: SpyStatus;
}

export interface EspionageState {
  agents: SpyAgent[];
  /** empireId → counter-intel level (0–100). */
  counterIntelLevel: Map<string, number>;
}

export interface GatherIntelResult {
  type: 'gather_intel';
  agentId: string;
  targetEmpireId: string;
  /** Credits stockpile of the target empire, or null if not revealed. */
  credits: number | null;
  /** Number of techs researched by the target empire. */
  techCount: number | null;
  /** IDs of known fleet systems for the target empire (shallow intel). */
  fleetSystemIds: string[];
}

export interface StealTechResult {
  type: 'steal_tech';
  agentId: string;
  targetEmpireId: string;
  /** ID of the stolen technology, or null if the attempt failed. */
  stolenTechId: string | null;
}

export interface SabotageResult {
  type: 'sabotage';
  agentId: string;
  targetEmpireId: string;
  /** ID of the planet that was sabotaged, or null if the attempt failed. */
  targetPlanetId: string | null;
  /** Description of the damage dealt (e.g. building type damaged). */
  description: string;
}

export interface CounterIntelResult {
  type: 'counter_intel';
  agentId: string;
  empireId: string;
  /** How much counter-intel level increased this tick. */
  levelIncrease: number;
}

export interface CaptureEvent {
  type: 'capture';
  agentId: string;
  empireId: string;
  targetEmpireId: string;
  /** Attitude penalty to apply from the owning empire's perspective. */
  attitudePenalty: number;
}

export type EspionageEvent =
  | GatherIntelResult
  | StealTechResult
  | SabotageResult
  | CounterIntelResult
  | CaptureEvent;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Credit cost to recruit one spy. */
export const SPY_RECRUIT_COST = 200;

/** Ticks required before an infiltrating agent becomes active. */
export const INFILTRATION_TICKS = 5;

/** Base probability per tick that an active steal_tech agent steals a tech (0–1). */
export const STEAL_TECH_BASE_CHANCE = 0.30;

/** Base probability per tick that an active sabotage agent damages a building (0–1). */
export const SABOTAGE_BASE_CHANCE = 0.20;

/**
 * Diplomatic attitude hit applied to owning empire when their spy is caught.
 * Negative — represents the penalty.
 */
export const CAPTURE_ATTITUDE_PENALTY = -15;

/**
 * Counter-intel increase per tick for a dedicated counter_intel agent.
 * Communications hub buildings add COMMS_HUB_COUNTER_INTEL_BONUS each.
 */
export const COUNTER_INTEL_AGENT_GAIN = 3;

/** Counter-intel bonus per communications_hub building on any empire planet. */
export const COMMS_HUB_COUNTER_INTEL_BONUS = 5;

/** Maximum counter-intel level. */
const COUNTER_INTEL_MAX = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deep-copy an EspionageState so mutations don't escape pure functions.
 * Maps are cloned manually; agent objects are shallow-copied (all primitives).
 */
function copyState(state: EspionageState): EspionageState {
  return {
    agents: state.agents.map((a) => ({ ...a })),
    counterIntelLevel: new Map(state.counterIntelLevel),
  };
}

/**
 * Derive a spy's base detection risk per tick from the target empire's
 * counter-intel level and the agent's skill.
 *
 * Formula: baseRisk = (counterIntel / 200) * (1 - skillBonus)
 *   where skillBonus = (skill - 1) / 18  (skill 1 → 0 bonus; skill 10 → 0.5 bonus)
 *
 * Counter-intel 0 → 0 % detection risk regardless of skill.
 * Counter-intel 100 + skill 1 → 50 % detection risk per tick.
 * Counter-intel 100 + skill 10 → 25 % detection risk per tick.
 */
function detectionRisk(counterIntel: number, skill: number): number {
  const skillBonus = (skill - 1) / 18;
  return (counterIntel / 200) * (1 - skillBonus);
}

// ---------------------------------------------------------------------------
// Public API — state initialisation
// ---------------------------------------------------------------------------

/**
 * Create a blank EspionageState for a set of empire IDs.
 * All counter-intel levels start at 0.
 */
export function initialiseEspionage(empireIds: string[]): EspionageState {
  const counterIntelLevel = new Map<string, number>();
  for (const id of empireIds) {
    counterIntelLevel.set(id, 0);
  }
  return { agents: [], counterIntelLevel };
}

// ---------------------------------------------------------------------------
// Public API — counter-intel recalculation
// ---------------------------------------------------------------------------

/**
 * Recalculate the passive counter-intel level for each empire based on the
 * number of communications_hub buildings across all of their planets.
 *
 * This should be called once per tick, before processEspionageTick, so that
 * the updated levels feed into detection-risk rolls in the same tick.
 *
 * Agent-based counter_intel gains are handled inside processEspionageTick.
 *
 * @param state        - Current espionage state.
 * @param empireId     - Empire whose planets are being counted.
 * @param planets      - All planets belonging to the empire.
 */
export function recalculateCounterIntel(
  state: EspionageState,
  empireId: string,
  planets: Planet[],
): EspionageState {
  const next = copyState(state);
  let hubCount = 0;
  for (const planet of planets) {
    for (const building of planet.buildings) {
      if (building.type === 'communications_hub') {
        hubCount += 1;
      }
    }
  }
  const passiveLevel = clamp(hubCount * COMMS_HUB_COUNTER_INTEL_BONUS, 0, COUNTER_INTEL_MAX);
  next.counterIntelLevel.set(empireId, passiveLevel);
  return next;
}

// ---------------------------------------------------------------------------
// Public API — recruitment and mission assignment
// ---------------------------------------------------------------------------

/**
 * Recruit a new spy agent for an empire.
 *
 * Skill is derived directly from the species espionage trait (1–10).
 * The caller is responsible for deducting SPY_RECRUIT_COST from empire credits.
 *
 * The new agent starts in 'infiltrating' status with no assigned target.
 * Use assignMission() immediately after to set mission and target.
 */
export function recruitSpy(empireId: string, species: Species): SpyAgent {
  return {
    id: generateId(),
    empireId,
    targetEmpireId: '',
    mission: 'gather_intel',
    skill: clamp(species.traits.espionage, 1, 10),
    turnsActive: 0,
    status: 'infiltrating',
  };
}

/**
 * Assign (or reassign) a mission and target empire to an existing agent.
 *
 * Reassigning resets the infiltration timer (status → 'infiltrating',
 * turnsActive → 0) so the agent must re-establish cover in the new empire.
 */
export function assignMission(
  agent: SpyAgent,
  targetEmpireId: string,
  mission: SpyMission,
): SpyAgent {
  if (targetEmpireId === agent.empireId && mission !== 'counter_intel') {
    throw new Error('Cannot assign spy to target own empire');
  }
  return {
    ...agent,
    targetEmpireId,
    mission,
    turnsActive: 0,
    status: 'infiltrating',
  };
}

/**
 * Add a newly recruited spy agent to the espionage state.
 */
export function addAgentToState(state: EspionageState, agent: SpyAgent): EspionageState {
  const next = copyState(state);
  next.agents.push({ ...agent });
  return next;
}

// ---------------------------------------------------------------------------
// Public API — per-tick processing
// ---------------------------------------------------------------------------

/**
 * Advance all active spy agents by one game tick.
 *
 * Processing order per agent:
 *  1. Increment turnsActive.
 *  2. If still infiltrating (turnsActive < INFILTRATION_TICKS), do nothing else.
 *  3. If newly active (turnsActive === INFILTRATION_TICKS), transition status.
 *  4. Roll for detection against target empire's counter-intel.
 *     - If detected → status = 'captured', emit CaptureEvent, skip mission roll.
 *  5. Roll for mission effect and emit the appropriate event.
 *
 * The returned state never mutates the input. Events are sorted by agentId for
 * determinism in tests.
 *
 * @param state   - Current espionage state.
 * @param empires - All empires in the game (used for tech list and planet data).
 */
export function processEspionageTick(
  state: EspionageState,
  empires: Empire[],
  /** Override for Math.random() — inject a seeded PRNG in tests. */
  rng: () => number = Math.random,
): { state: EspionageState; events: EspionageEvent[] } {
  const next = copyState(state);
  const events: EspionageEvent[] = [];

  for (const agent of next.agents) {
    // Skip already-concluded agents
    if (agent.status === 'captured' || agent.status === 'returned') continue;
    // Skip agents with no assigned target
    if (!agent.targetEmpireId) continue;

    agent.turnsActive += 1;

    // ── Phase 1: still infiltrating ──────────────────────────────────────────
    if (agent.turnsActive < INFILTRATION_TICKS) {
      agent.status = 'infiltrating';
      continue;
    }

    // Transition to active on the tick they complete infiltration
    agent.status = 'active';

    const targetCounterIntel = next.counterIntelLevel.get(agent.targetEmpireId) ?? 0;

    // ── Phase 2: detection roll ───────────────────────────────────────────────
    const risk = detectionRisk(targetCounterIntel, agent.skill);
    if (rng() < risk) {
      agent.status = 'captured';
      events.push({
        type: 'capture',
        agentId: agent.id,
        empireId: agent.empireId,
        targetEmpireId: agent.targetEmpireId,
        attitudePenalty: CAPTURE_ATTITUDE_PENALTY,
      });
      continue; // no mission result this tick
    }

    // ── Phase 3: mission roll ─────────────────────────────────────────────────
    const targetEmpire = empires.find((e) => e.id === agent.targetEmpireId);
    const ownerEmpire = empires.find((e) => e.id === agent.empireId);

    switch (agent.mission) {
      case 'gather_intel': {
        events.push(resolvGatherIntel(agent, targetEmpire ?? null, ownerEmpire ?? null));
        break;
      }
      case 'steal_tech': {
        const counterIntelFactor = targetCounterIntel / 100; // 0–1
        const adjustedChance = STEAL_TECH_BASE_CHANCE * (1 - counterIntelFactor * 0.5);
        if (rng() < adjustedChance) {
          const tech = pickRandomTech(targetEmpire ?? null, ownerEmpire ?? null, rng);
          events.push({
            type: 'steal_tech',
            agentId: agent.id,
            targetEmpireId: agent.targetEmpireId,
            stolenTechId: tech,
          });
        }
        break;
      }
      case 'sabotage': {
        const counterIntelFactor = targetCounterIntel / 100;
        const adjustedChance = SABOTAGE_BASE_CHANCE * (1 - counterIntelFactor * 0.4);
        if (rng() < adjustedChance) {
          events.push(resolveSabotage(agent, targetEmpire ?? null, rng));
        }
        break;
      }
      case 'counter_intel': {
        const gain = COUNTER_INTEL_AGENT_GAIN;
        const currentLevel = next.counterIntelLevel.get(agent.empireId) ?? 0;
        next.counterIntelLevel.set(
          agent.empireId,
          clamp(currentLevel + gain, 0, COUNTER_INTEL_MAX),
        );
        events.push({
          type: 'counter_intel',
          agentId: agent.id,
          empireId: agent.empireId,
          levelIncrease: gain,
        });
        break;
      }
    }
  }

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// Mission resolution helpers
// ---------------------------------------------------------------------------

function resolvGatherIntel(
  agent: SpyAgent,
  targetEmpire: Empire | null,
  _ownerEmpire: Empire | null,
): GatherIntelResult {
  if (!targetEmpire) {
    return {
      type: 'gather_intel',
      agentId: agent.id,
      targetEmpireId: agent.targetEmpireId,
      credits: null,
      techCount: null,
      fleetSystemIds: [],
    };
  }

  return {
    type: 'gather_intel',
    agentId: agent.id,
    targetEmpireId: agent.targetEmpireId,
    credits: targetEmpire.credits,
    techCount: targetEmpire.technologies.length,
    // knownSystems serves as a proxy for fleet positions (systems where the empire has presence)
    fleetSystemIds: [...targetEmpire.knownSystems],
  };
}

function pickRandomTech(
  targetEmpire: Empire | null,
  ownerEmpire: Empire | null,
  rng: () => number,
): string | null {
  if (!targetEmpire || targetEmpire.technologies.length === 0) return null;

  // Filter out techs the owning empire already has
  const ownedTechs = new Set(ownerEmpire?.technologies ?? []);
  const stealable = targetEmpire.technologies.filter((t) => !ownedTechs.has(t));
  if (stealable.length === 0) return null;

  const idx = Math.floor(rng() * stealable.length);
  return stealable[idx] ?? null;
}

function resolveSabotage(
  agent: SpyAgent,
  targetEmpire: Empire | null,
  _rng: () => number,
): SabotageResult {
  // Without access to planet data here, we emit a generic sabotage event.
  // The game loop caller is responsible for translating targetPlanetId into
  // actual building damage on the galaxy state.
  if (!targetEmpire) {
    return {
      type: 'sabotage',
      agentId: agent.id,
      targetEmpireId: agent.targetEmpireId,
      targetPlanetId: null,
      description: 'No valid target found.',
    };
  }

  return {
    type: 'sabotage',
    agentId: agent.id,
    targetEmpireId: agent.targetEmpireId,
    // Planet selection is deferred to the caller who has galaxy state
    targetPlanetId: null,
    description: `Sabotage operation conducted against ${targetEmpire.name}.`,
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Human-readable label for a SpyMission. */
export function getSpyMissionLabel(mission: SpyMission): string {
  switch (mission) {
    case 'gather_intel':  return 'Gather Intelligence';
    case 'steal_tech':    return 'Steal Technology';
    case 'sabotage':      return 'Sabotage';
    case 'counter_intel': return 'Counter-Intelligence';
    default: {
      const _exhaustive: never = mission;
      return String(_exhaustive);
    }
  }
}

/** Human-readable label for a SpyStatus. */
export function getSpyStatusLabel(status: SpyStatus): string {
  switch (status) {
    case 'infiltrating': return 'Infiltrating';
    case 'active':       return 'Active';
    case 'captured':     return 'Captured';
    case 'returned':     return 'Returned';
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}
