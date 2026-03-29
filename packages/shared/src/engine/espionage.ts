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
import type { ConfidenceLevel, GrievanceSeverity } from '../types/diplomacy.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SpyMission =
  | 'gather_intel'
  | 'steal_tech'
  | 'sabotage'
  | 'counter_intel'
  | 'fabricate_grievance'
  | 'reveal_private_stance'
  | 'sabotage_negotiations'
  | 'plant_evidence'
  | 'recruit_asset'
  | 'false_flag';

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

// ---------------------------------------------------------------------------
// New mission result types — special operations
// ---------------------------------------------------------------------------

export interface FabricateGrievanceResult {
  type: 'fabricate_grievance';
  agentId: string;
  /** Empire that ordered the fabrication. */
  empireId: string;
  /** Empire that will appear as the perpetrator (framed third party). */
  framedEmpireId: string;
  /** Empire that will receive the fabricated grievance as victim. */
  victimEmpireId: string;
  /** Severity of the fabricated grievance. */
  severity: GrievanceSeverity;
  /** Descriptive pretext for the fabricated incident. */
  description: string;
  /** Strength of the planted evidence (0–100). Higher skill → more convincing. */
  evidenceStrength: number;
}

export interface RevealPrivateStanceResult {
  type: 'reveal_private_stance';
  agentId: string;
  targetEmpireId: string;
  /** The assessed private diplomatic position (-100 to +100). */
  assessedPosition: number;
  /** Confidence in the assessment — higher spy skill yields better confidence. */
  confidence: ConfidenceLevel;
}

export interface SabotageNegotiationsResult {
  type: 'sabotage_negotiations';
  agentId: string;
  targetEmpireId: string;
  /** ID of the treaty that was disrupted, or null if no active negotiations found. */
  affectedTreatyId: string | null;
  /** Descriptive summary of the disruption. */
  description: string;
}

export interface PlantEvidenceResult {
  type: 'plant_evidence';
  agentId: string;
  /** Empire that ordered the operation. */
  empireId: string;
  /** Empire where the evidence is planted (the "victim" who discovers it). */
  targetEmpireId: string;
  /** Third-party empire being framed for the transgression. */
  framedEmpireId: string;
  /** Description of the fabricated transgression. */
  description: string;
  /** Strength of the planted evidence (0–100). */
  evidenceStrength: number;
}

/**
 * Role of the recruited character. Matches the types of characters
 * that exist in the game (governors, diplomats, military leaders).
 */
export type RecruitableRole = 'governor' | 'diplomat' | 'admiral' | 'general';

export interface RecruitAssetResult {
  type: 'recruit_asset';
  agentId: string;
  /** Empire that ran the recruitment operation. */
  empireId: string;
  targetEmpireId: string;
  /** Whether the recruitment attempt succeeded. */
  success: boolean;
  /** ID of the recruited character, or null if the attempt failed. */
  recruitedCharacterId: string | null;
  /** Name of the recruited character, or null if the attempt failed. */
  recruitedCharacterName: string | null;
  /** Role of the recruited character. */
  recruitedCharacterRole: RecruitableRole | null;
  /** The vulnerability exploited (ideology, coercion, vice, disillusionment). */
  vulnerability: string | null;
}

export type FalseFlagOperationType = 'raid' | 'sabotage' | 'assassination' | 'provocation';

export interface FalseFlagResult {
  type: 'false_flag';
  agentId: string;
  /** Empire that ordered the false flag operation. */
  empireId: string;
  /** Empire where the operation took place. */
  targetEmpireId: string;
  /** Empire that will be blamed for the operation. */
  framedEmpireId: string;
  /** The type of operation carried out under false colours. */
  operationType: FalseFlagOperationType;
  /** Descriptive summary of the operation. */
  description: string;
  /** Strength of the false attribution (0–100). */
  evidenceStrength: number;
}

export type EspionageEvent =
  | GatherIntelResult
  | StealTechResult
  | SabotageResult
  | CounterIntelResult
  | CaptureEvent
  | FabricateGrievanceResult
  | RevealPrivateStanceResult
  | SabotageNegotiationsResult
  | PlantEvidenceResult
  | RecruitAssetResult
  | FalseFlagResult;

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

// ── New mission base chances ──────────────────────────────────────────────────

/** Base probability per tick that fabricate_grievance succeeds (0–1). */
export const FABRICATE_GRIEVANCE_BASE_CHANCE = 0.25;

/** Base probability per tick that reveal_private_stance yields useful intel (0–1). */
export const REVEAL_PRIVATE_STANCE_BASE_CHANCE = 0.35;

/** Base probability per tick that sabotage_negotiations disrupts a treaty (0–1). */
export const SABOTAGE_NEGOTIATIONS_BASE_CHANCE = 0.20;

/** Base probability per tick that plant_evidence succeeds (0–1). */
export const PLANT_EVIDENCE_BASE_CHANCE = 0.20;

/** Base probability per tick that recruit_asset succeeds — heavily modified by target loyalty (0–1). */
export const RECRUIT_ASSET_BASE_CHANCE = 0.15;

/**
 * Base probability per tick that false_flag succeeds (0–1).
 * Intentionally lower than other missions — false flags carry higher detection risk.
 */
export const FALSE_FLAG_BASE_CHANCE = 0.15;

/**
 * Detection risk multiplier for false_flag operations.
 * Applied on top of the normal detection risk to reflect the inherently
 * riskier nature of operating under another empire's colours.
 */
export const FALSE_FLAG_DETECTION_MULTIPLIER = 1.5;

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
    // False flag operations carry elevated detection risk
    const baseRisk = detectionRisk(targetCounterIntel, agent.skill);
    const risk = agent.mission === 'false_flag'
      ? Math.min(baseRisk * FALSE_FLAG_DETECTION_MULTIPLIER, 1)
      : baseRisk;
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

      // ── Special operations ─────────────────────────────────────────────────

      case 'fabricate_grievance': {
        const counterIntelFactor = targetCounterIntel / 100;
        const adjustedChance = FABRICATE_GRIEVANCE_BASE_CHANCE * (1 - counterIntelFactor * 0.5);
        if (rng() < adjustedChance) {
          events.push(
            resolveFabricateGrievance(agent, targetEmpire ?? null, empires, rng),
          );
        }
        break;
      }

      case 'reveal_private_stance': {
        const counterIntelFactor = targetCounterIntel / 100;
        const adjustedChance = REVEAL_PRIVATE_STANCE_BASE_CHANCE * (1 - counterIntelFactor * 0.4);
        if (rng() < adjustedChance) {
          events.push(resolveRevealPrivateStance(agent, rng));
        }
        break;
      }

      case 'sabotage_negotiations': {
        const counterIntelFactor = targetCounterIntel / 100;
        const adjustedChance = SABOTAGE_NEGOTIATIONS_BASE_CHANCE * (1 - counterIntelFactor * 0.5);
        if (rng() < adjustedChance) {
          events.push(resolveSabotageNegotiations(agent, targetEmpire ?? null));
        }
        break;
      }

      case 'plant_evidence': {
        const counterIntelFactor = targetCounterIntel / 100;
        const adjustedChance = PLANT_EVIDENCE_BASE_CHANCE * (1 - counterIntelFactor * 0.5);
        if (rng() < adjustedChance) {
          events.push(resolvePlantEvidence(agent, targetEmpire ?? null, empires, rng));
        }
        break;
      }

      case 'recruit_asset': {
        const counterIntelFactor = targetCounterIntel / 100;
        const adjustedChance = RECRUIT_ASSET_BASE_CHANCE * (1 - counterIntelFactor * 0.4);
        if (rng() < adjustedChance) {
          events.push(resolveRecruitAsset(agent, rng));
        }
        break;
      }

      case 'false_flag': {
        const counterIntelFactor = targetCounterIntel / 100;
        const adjustedChance = FALSE_FLAG_BASE_CHANCE * (1 - counterIntelFactor * 0.6);
        if (rng() < adjustedChance) {
          events.push(resolveFalseFlag(agent, targetEmpire ?? null, empires, rng));
        }
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
// Special operation resolution helpers
// ---------------------------------------------------------------------------

/** Pick a random third-party empire (not the agent's owner or the target). */
function pickThirdPartyEmpire(
  agent: SpyAgent,
  empires: Empire[],
  rng: () => number,
): Empire | null {
  const candidates = empires.filter(
    (e) => e.id !== agent.empireId && e.id !== agent.targetEmpireId,
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

/**
 * Derive evidence strength from spy skill (1–10).
 * Skill 1 → ~30, skill 10 → ~90, with some randomisation.
 */
function deriveEvidenceStrength(skill: number, rng: () => number): number {
  const base = 20 + skill * 7;
  const jitter = Math.floor(rng() * 11) - 5; // -5 to +5
  return clamp(base + jitter, 10, 100);
}

/** Pretexts used when fabricating grievances. */
const FABRICATED_PRETEXTS: string[] = [
  'Intercepted communications revealing hostile military manoeuvres near the border.',
  'Evidence of covert economic sanctions targeting civilian trade routes.',
  'Reports of diplomatic envoys being detained and interrogated.',
  'Sensor logs showing unauthorised reconnaissance of sovereign territory.',
  'Financial records exposing illegal arms sales to separatist factions.',
];

/**
 * Resolve a fabricate_grievance mission.
 *
 * Creates a fake grievance against a third-party empire, making the target
 * empire believe the third party has wronged them. This provides a
 * manufactured casus belli or shifts alliances.
 */
function resolveFabricateGrievance(
  agent: SpyAgent,
  targetEmpire: Empire | null,
  empires: Empire[],
  rng: () => number,
): FabricateGrievanceResult {
  const thirdParty = pickThirdPartyEmpire(agent, empires, rng);

  if (!targetEmpire || !thirdParty) {
    return {
      type: 'fabricate_grievance',
      agentId: agent.id,
      empireId: agent.empireId,
      framedEmpireId: '',
      victimEmpireId: agent.targetEmpireId,
      severity: 'slight',
      description: 'Operation failed — insufficient third parties to frame.',
      evidenceStrength: 0,
    };
  }

  // Higher skill → more severe fabrication the target will believe
  const severityRoll = rng();
  const skillFactor = agent.skill / 10; // 0.1–1.0
  let severity: GrievanceSeverity;
  if (severityRoll < 0.1 * skillFactor) {
    severity = 'major';
  } else if (severityRoll < 0.4 * skillFactor) {
    severity = 'offence';
  } else {
    severity = 'slight';
  }

  const pretext = FABRICATED_PRETEXTS[Math.floor(rng() * FABRICATED_PRETEXTS.length)]
    ?? FABRICATED_PRETEXTS[0]!;

  return {
    type: 'fabricate_grievance',
    agentId: agent.id,
    empireId: agent.empireId,
    framedEmpireId: thirdParty.id,
    victimEmpireId: targetEmpire.id,
    severity,
    description: pretext,
    evidenceStrength: deriveEvidenceStrength(agent.skill, rng),
  };
}

/**
 * Map a spy skill to a confidence level for diplomatic intelligence.
 * Skill 1–2: very_low, 3–4: low, 5–6: medium, 7–8: high, 9–10: very_high.
 */
function skillToConfidence(skill: number): ConfidenceLevel {
  if (skill >= 9) return 'very_high';
  if (skill >= 7) return 'high';
  if (skill >= 5) return 'medium';
  if (skill >= 3) return 'low';
  return 'very_low';
}

/**
 * Resolve a reveal_private_stance mission.
 *
 * Reveals the target empire's true private diplomatic position towards
 * the agent's owner. Confidence depends on the spy's skill level.
 */
function resolveRevealPrivateStance(
  agent: SpyAgent,
  rng: () => number,
): RevealPrivateStanceResult {
  const confidence = skillToConfidence(agent.skill);

  // Generate a simulated assessed position. The actual game loop caller
  // should replace this with real stance data if available. Here we provide
  // a range that the caller can cross-reference.
  // Noise inversely proportional to skill: skill 10 → ±5, skill 1 → ±50
  const noise = Math.floor((11 - agent.skill) * 5 * (rng() * 2 - 1));
  const assessedPosition = clamp(noise, -100, 100);

  return {
    type: 'reveal_private_stance',
    agentId: agent.id,
    targetEmpireId: agent.targetEmpireId,
    assessedPosition,
    confidence,
  };
}

/**
 * Resolve a sabotage_negotiations mission.
 *
 * Disrupts an ongoing treaty negotiation that the target empire is part of.
 * The caller should look up active treaties/proposals involving the target
 * and apply the disruption to the returned treaty ID.
 */
function resolveSabotageNegotiations(
  agent: SpyAgent,
  targetEmpire: Empire | null,
): SabotageNegotiationsResult {
  if (!targetEmpire) {
    return {
      type: 'sabotage_negotiations',
      agentId: agent.id,
      targetEmpireId: agent.targetEmpireId,
      affectedTreatyId: null,
      description: 'No valid target found.',
    };
  }

  // We emit the event with a null treatyId — the game loop caller has
  // access to the full treaty state and should select the active negotiation
  // to disrupt, then populate affectedTreatyId accordingly.
  return {
    type: 'sabotage_negotiations',
    agentId: agent.id,
    targetEmpireId: targetEmpire.id,
    affectedTreatyId: null,
    description: `Negotiations involving ${targetEmpire.name} have been disrupted through disinformation and forged communications.`,
  };
}

/**
 * Resolve a plant_evidence mission.
 *
 * Plants fabricated evidence within the target empire that frames a
 * third-party empire for a transgression. More sophisticated than
 * fabricate_grievance — targets existing diplomatic sensitivities.
 */
function resolvePlantEvidence(
  agent: SpyAgent,
  targetEmpire: Empire | null,
  empires: Empire[],
  rng: () => number,
): PlantEvidenceResult {
  const thirdParty = pickThirdPartyEmpire(agent, empires, rng);

  if (!targetEmpire || !thirdParty) {
    return {
      type: 'plant_evidence',
      agentId: agent.id,
      empireId: agent.empireId,
      targetEmpireId: agent.targetEmpireId,
      framedEmpireId: '',
      description: 'Operation failed — insufficient third parties to frame.',
      evidenceStrength: 0,
    };
  }

  const transgressions = [
    `Fabricated sensor logs showing ${thirdParty.name} warships in ${targetEmpire.name} sovereign space.`,
    `Forged diplomatic cables revealing ${thirdParty.name} plotting economic sanctions against ${targetEmpire.name}.`,
    `Planted financial records linking ${thirdParty.name} to insurgent groups within ${targetEmpire.name} territory.`,
    `Manufactured intelligence dossier alleging ${thirdParty.name} espionage operations against ${targetEmpire.name}.`,
  ];

  const description = transgressions[Math.floor(rng() * transgressions.length)]
    ?? transgressions[0]!;

  return {
    type: 'plant_evidence',
    agentId: agent.id,
    empireId: agent.empireId,
    targetEmpireId: targetEmpire.id,
    framedEmpireId: thirdParty.id,
    description,
    evidenceStrength: deriveEvidenceStrength(agent.skill, rng),
  };
}

/**
 * Vulnerabilities that can be exploited to turn an enemy character.
 * Each agent recruitment attempt picks one at random.
 */
const RECRUITMENT_VULNERABILITIES = [
  'ideology',
  'coercion',
  'vice',
  'disillusionment',
] as const;

/**
 * Resolve a recruit_asset mission.
 *
 * Attempts to recruit an enemy character (governor, diplomat, admiral, etc.)
 * as a double agent. Success depends on both the spy's skill and the
 * target character's loyalty — low-loyalty characters are easier to turn.
 *
 * The actual character selection is deferred to the caller who has access
 * to character rosters. This function generates the recruitment result
 * with a placeholder character; the game loop should map it to a real
 * character and apply the compromised status.
 */
function resolveRecruitAsset(
  agent: SpyAgent,
  rng: () => number,
): RecruitAssetResult {
  // Simulate a target character's loyalty (0–100).
  // In practice the game loop should pass real character data.
  // Lower loyalty → easier recruitment.
  const targetLoyalty = Math.floor(rng() * 100);
  const roles: RecruitableRole[] = ['governor', 'diplomat', 'admiral', 'general'];
  const role = roles[Math.floor(rng() * roles.length)] ?? 'governor';

  // Success formula: skill provides a base, loyalty resists.
  // Effective chance = (skill / 10) * (1 - loyalty / 150)
  // loyalty 0 → full skill factor; loyalty 100 → skill * 0.33
  const skillFactor = agent.skill / 10;
  const loyaltyResistance = 1 - targetLoyalty / 150;
  const recruitChance = skillFactor * Math.max(loyaltyResistance, 0.05);
  const success = rng() < recruitChance;

  const vulnerability = RECRUITMENT_VULNERABILITIES[
    Math.floor(rng() * RECRUITMENT_VULNERABILITIES.length)
  ] ?? 'ideology';

  if (!success) {
    return {
      type: 'recruit_asset',
      agentId: agent.id,
      empireId: agent.empireId,
      targetEmpireId: agent.targetEmpireId,
      success: false,
      recruitedCharacterId: null,
      recruitedCharacterName: null,
      recruitedCharacterRole: null,
      vulnerability: null,
    };
  }

  return {
    type: 'recruit_asset',
    agentId: agent.id,
    empireId: agent.empireId,
    targetEmpireId: agent.targetEmpireId,
    success: true,
    // Placeholder ID — caller maps to real character
    recruitedCharacterId: generateId(),
    recruitedCharacterName: `Recruited ${role}`,
    recruitedCharacterRole: role,
    vulnerability,
  };
}

/** Types of false flag operations that can be carried out. */
const FALSE_FLAG_OPERATIONS: FalseFlagOperationType[] = [
  'raid',
  'sabotage',
  'assassination',
  'provocation',
];

/**
 * Resolve a false_flag mission.
 *
 * Executes an operation in the target empire that is disguised to look
 * like the work of a third-party empire. If successful, the target
 * attributes the operation to the framed party.
 *
 * False flag operations carry elevated detection risk (applied in the
 * detection roll phase via FALSE_FLAG_DETECTION_MULTIPLIER).
 */
function resolveFalseFlag(
  agent: SpyAgent,
  targetEmpire: Empire | null,
  empires: Empire[],
  rng: () => number,
): FalseFlagResult {
  const thirdParty = pickThirdPartyEmpire(agent, empires, rng);

  if (!targetEmpire || !thirdParty) {
    return {
      type: 'false_flag',
      agentId: agent.id,
      empireId: agent.empireId,
      targetEmpireId: agent.targetEmpireId,
      framedEmpireId: '',
      operationType: 'provocation',
      description: 'Operation failed — insufficient third parties to implicate.',
      evidenceStrength: 0,
    };
  }

  const operationType = FALSE_FLAG_OPERATIONS[Math.floor(rng() * FALSE_FLAG_OPERATIONS.length)]
    ?? 'provocation';

  const descriptions: Record<FalseFlagOperationType, string> = {
    raid: `A raiding party struck ${targetEmpire.name} supply lines bearing ${thirdParty.name} insignia and transponder codes.`,
    sabotage: `Critical infrastructure in ${targetEmpire.name} territory was sabotaged using ${thirdParty.name} military-grade equipment.`,
    assassination: `A high-ranking ${targetEmpire.name} official was assassinated by operatives carrying ${thirdParty.name} credentials.`,
    provocation: `A border incident was staged to make it appear that ${thirdParty.name} violated ${targetEmpire.name} sovereign space.`,
  };

  return {
    type: 'false_flag',
    agentId: agent.id,
    empireId: agent.empireId,
    targetEmpireId: targetEmpire.id,
    framedEmpireId: thirdParty.id,
    operationType,
    description: descriptions[operationType],
    evidenceStrength: deriveEvidenceStrength(agent.skill, rng),
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Human-readable label for a SpyMission. */
export function getSpyMissionLabel(mission: SpyMission): string {
  switch (mission) {
    case 'gather_intel':          return 'Gather Intelligence';
    case 'steal_tech':            return 'Steal Technology';
    case 'sabotage':              return 'Sabotage';
    case 'counter_intel':         return 'Counter-Intelligence';
    case 'fabricate_grievance':   return 'Fabricate Grievance';
    case 'reveal_private_stance': return 'Reveal Private Stance';
    case 'sabotage_negotiations': return 'Sabotage Negotiations';
    case 'plant_evidence':        return 'Plant Evidence';
    case 'recruit_asset':         return 'Recruit Asset';
    case 'false_flag':            return 'False Flag Operation';
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
