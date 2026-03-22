/**
 * Diplomacy engine — pure functions for managing relationships between empires.
 *
 * All functions are side-effect free. Each call returns a new DiplomacyState
 * rather than mutating the existing one.
 *
 * Design goals:
 *  - Dual-score model: attitude (-100 to +100) and trust (0 to 100)
 *  - Attitude reflects current feelings; trust is built through honored agreements
 *  - Personality-driven AI evaluation of treaty proposals
 *  - Per-tick: attitude drifts toward neutral, timed treaties expire
 *  - All relations are symmetric: A→B and B→A are both tracked separately
 */

import type { Empire, DiplomaticStatus, TreatyType, AIPersonality } from '../types/species.js';
import { ATTITUDE_MIN, ATTITUDE_MAX } from '../constants/game.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DiplomacyState {
  /** empireId → empireId → relation */
  relations: Map<string, Map<string, DiplomaticRelationFull>>;
}

export interface DiplomaticRelationFull {
  empireId: string;
  targetEmpireId: string;
  /** Current feelings toward the target empire. Clamped to [-100, +100]. */
  attitude: number;
  /** Accumulated trust through honored agreements. Clamped to [0, 100]. */
  trust: number;
  status: DiplomaticStatus;
  treaties: ActiveTreaty[];
  tradeRoutes: number;
  /** Game tick of first contact. -1 = no contact yet. */
  firstContact: number;
  /** Game tick of the most recent diplomatic interaction. */
  lastInteraction: number;
  incidentLog: DiplomaticIncident[];
}

export interface ActiveTreaty {
  id: string;
  type: TreatyType;
  startTick: number;
  /** Number of ticks this treaty lasts. -1 = permanent until broken. */
  duration: number;
  /** Treaty-specific negotiated terms (e.g. creditTransfer: 50). */
  terms?: Record<string, number>;
}

export interface DiplomaticIncident {
  tick: number;
  type: string;
  attitudeChange: number;
  trustChange: number;
  description: string;
}

export interface TreatyProposal {
  fromEmpireId: string;
  toEmpireId: string;
  treatyType: TreatyType;
  terms?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Attitude gain per trade route per tick. */
const TRADE_INCOME_PER_ROUTE = 5;
/** Attitude gain per trade treaty active. */
const TRADE_TREATY_INCOME_BONUS = 10;

/** Per-tick attitude drift fraction toward zero. */
const ATTITUDE_DECAY_FRACTION = 0.02;
/** Minimum absolute attitude shift per tick (so attitude always moves). */
const ATTITUDE_DECAY_MIN = 0.5;

const FIRST_CONTACT_ATTITUDE = 0;
const FIRST_CONTACT_TRUST = 20;

// Treaty attitude/trust effects on proposal acceptance
const TREATY_ATTITUDE_BONUS: Record<TreatyType, number> = {
  non_aggression: 5,
  trade: 8,
  trade_agreement: 8,
  research_sharing: 6,
  mutual_defense: 12,
  mutual_defence: 12,
  military_alliance: 18,
  alliance: 20,
  vassalism: -10,
  federation_membership: 25,
  subjugation: -40,
  unification: 15,
  assimilation: -20,
};
const TREATY_TRUST_BONUS: Record<TreatyType, number> = {
  non_aggression: 3,
  trade: 5,
  trade_agreement: 5,
  research_sharing: 6,
  mutual_defense: 8,
  mutual_defence: 8,
  military_alliance: 12,
  alliance: 15,
  vassalism: -5,
  federation_membership: 20,
  subjugation: -30,
  unification: 10,
  assimilation: -15,
};

// War declaration attitude/trust impacts
const WAR_ATTITUDE_PENALTY = -60;
const WAR_TRUST_PENALTY = -40;

// Treaty breaking attitude/trust impacts
const BREAK_TREATY_ATTITUDE_PENALTY = -20;
const BREAK_TREATY_TRUST_PENALTY = -30;

// Peace attitude/trust
const PEACE_ATTITUDE_BONUS = 10;
const PEACE_TRUST_PENALTY = -5; // war leaves scars

// AI personality thresholds for proposal acceptance
const PERSONALITY_ATTITUDE_THRESHOLDS: Record<AIPersonality, number> = {
  aggressive: 30,
  defensive: 10,
  economic: 0,
  diplomatic: -20,
  expansionist: 20,
  researcher: 5,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampAttitude(v: number): number {
  return clamp(v, ATTITUDE_MIN, ATTITUDE_MAX);
}

function clampTrust(v: number): number {
  return clamp(v, 0, 100);
}

/**
 * Create a blank relation between two empires (status = unknown, no contact).
 */
function makeBlankRelation(empireId: string, targetEmpireId: string): DiplomaticRelationFull {
  return {
    empireId,
    targetEmpireId,
    attitude: 0,
    trust: 0,
    status: 'unknown',
    treaties: [],
    tradeRoutes: 0,
    firstContact: -1,
    lastInteraction: -1,
    incidentLog: [],
  };
}

/**
 * Deep-copy a DiplomaticRelationFull so mutations don't escape.
 */
function copyRelation(rel: DiplomaticRelationFull): DiplomaticRelationFull {
  return {
    ...rel,
    treaties: rel.treaties.map((t) => ({ ...t, terms: t.terms ? { ...t.terms } : undefined })),
    incidentLog: rel.incidentLog.map((i) => ({ ...i })),
  };
}

/**
 * Deep-copy the full DiplomacyState.
 */
function copyState(state: DiplomacyState): DiplomacyState {
  const relations = new Map<string, Map<string, DiplomaticRelationFull>>();
  for (const [empireId, targets] of state.relations) {
    const inner = new Map<string, DiplomaticRelationFull>();
    for (const [targetId, rel] of targets) {
      inner.set(targetId, copyRelation(rel));
    }
    relations.set(empireId, inner);
  }
  return { relations };
}

/**
 * Get a mutable reference to a relation within a (already-copied) state.
 * Creates the map slot if it does not exist.
 */
function getMutableRelation(
  state: DiplomacyState,
  empireId: string,
  targetId: string,
): DiplomaticRelationFull {
  if (!state.relations.has(empireId)) {
    state.relations.set(empireId, new Map());
  }
  const inner = state.relations.get(empireId)!;
  if (!inner.has(targetId)) {
    inner.set(targetId, makeBlankRelation(empireId, targetId));
  }
  return inner.get(targetId)!;
}

/**
 * Log a diplomatic incident on a relation, applying attitude and trust changes.
 */
function applyIncident(
  rel: DiplomaticRelationFull,
  tick: number,
  type: string,
  attitudeChange: number,
  trustChange: number,
  description: string,
): void {
  rel.attitude = clampAttitude(rel.attitude + attitudeChange);
  rel.trust = clampTrust(rel.trust + trustChange);
  rel.lastInteraction = tick;
  rel.incidentLog.push({ tick, type, attitudeChange, trustChange, description });
}

/**
 * Derive a DiplomaticStatus from the current attitude score.
 * Existing 'at_war' status is never changed by this helper alone.
 */
function attitudeToStatus(attitude: number, current: DiplomaticStatus): DiplomaticStatus {
  if (current === 'at_war') return 'at_war';
  if (attitude >= 60) return 'allied';
  if (attitude >= 25) return 'friendly';
  if (attitude >= -25) return 'neutral';
  return 'hostile';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an initial DiplomacyState for a set of empire IDs.
 *
 * All pairs start with unknown / blank relations. Actual contact is
 * established later via makeFirstContact().
 */
export function initializeDiplomacy(empireIds: string[]): DiplomacyState {
  const relations = new Map<string, Map<string, DiplomaticRelationFull>>();
  for (const id of empireIds) {
    relations.set(id, new Map());
  }
  return { relations };
}

/**
 * Get the relation from empireA's perspective toward empireB.
 * Returns null if empireA has no relation map at all.
 */
export function getRelation(
  state: DiplomacyState,
  empireA: string,
  empireB: string,
): DiplomaticRelationFull | null {
  return state.relations.get(empireA)?.get(empireB) ?? null;
}

/**
 * Record first contact between two empires.
 *
 * Both directions are initialised with neutral attitude, starter trust, and
 * status = 'neutral'. A contact incident is logged on both sides.
 * Does nothing if contact already exists.
 */
export function makeFirstContact(
  state: DiplomacyState,
  empireA: string,
  empireB: string,
  tick: number,
): DiplomacyState {
  const next = copyState(state);

  function initSide(from: string, to: string): void {
    const rel = getMutableRelation(next, from, to);
    if (rel.firstContact !== -1) return; // already contacted
    rel.firstContact = tick;
    rel.attitude = FIRST_CONTACT_ATTITUDE;
    rel.trust = FIRST_CONTACT_TRUST;
    rel.status = 'neutral';
    applyIncident(rel, tick, 'first_contact', 0, 0, `First contact established with ${to}`);
  }

  initSide(empireA, empireB);
  initSide(empireB, empireA);

  return next;
}

/**
 * Add a treaty to both sides' relation records and apply attitude/trust bonuses.
 *
 * The proposal is accepted unconditionally by this function; use
 * evaluateTreatyProposal() first to determine if the AI agrees.
 */
export function proposeTreaty(
  state: DiplomacyState,
  proposal: TreatyProposal,
  tick: number,
): DiplomacyState {
  const next = copyState(state);
  const { fromEmpireId, toEmpireId, treatyType, terms } = proposal;

  const treatyId = generateId();
  const treaty: ActiveTreaty = {
    id: treatyId,
    type: treatyType,
    startTick: tick,
    duration: -1, // permanent until broken by default
    terms: terms ? { ...terms } : undefined,
  };

  const attBonus = TREATY_ATTITUDE_BONUS[treatyType];
  const trustBonus = TREATY_TRUST_BONUS[treatyType];
  const description = `${treatyType} treaty signed`;

  function addTreaty(from: string, to: string): void {
    const rel = getMutableRelation(next, from, to);
    rel.treaties.push({ ...treaty, terms: treaty.terms ? { ...treaty.terms } : undefined });
    // Trade treaties also add a trade route
    if (treatyType === 'trade') {
      rel.tradeRoutes += 1;
    }
    applyIncident(rel, tick, 'treaty_signed', attBonus, trustBonus, description);
    rel.status = attitudeToStatus(rel.attitude, rel.status);
  }

  addTreaty(fromEmpireId, toEmpireId);
  addTreaty(toEmpireId, fromEmpireId);

  return next;
}

/**
 * Break an existing treaty by ID.
 *
 * Applies a severe trust penalty and moderate attitude drop on both sides.
 * A trade treaty being broken removes one trade route.
 */
export function breakTreaty(
  state: DiplomacyState,
  empireId: string,
  targetId: string,
  treatyId: string,
  tick: number,
): DiplomacyState {
  const next = copyState(state);

  function removeTreaty(from: string, to: string): void {
    const rel = getMutableRelation(next, from, to);
    const idx = rel.treaties.findIndex((t) => t.id === treatyId);
    if (idx === -1) return;
    const [removed] = rel.treaties.splice(idx, 1);
    if (removed.type === 'trade' && rel.tradeRoutes > 0) {
      rel.tradeRoutes -= 1;
    }
    applyIncident(
      rel,
      tick,
      'treaty_broken',
      BREAK_TREATY_ATTITUDE_PENALTY,
      BREAK_TREATY_TRUST_PENALTY,
      `${removed.type} treaty broken by ${from}`,
    );
    rel.status = attitudeToStatus(rel.attitude, rel.status);
  }

  removeTreaty(empireId, targetId);
  removeTreaty(targetId, empireId);

  return next;
}

/**
 * Declare war between two empires.
 *
 * - Sets status to 'at_war' on both sides.
 * - Breaks all existing treaties.
 * - Applies massive attitude and trust penalty.
 */
export function declareWar(
  state: DiplomacyState,
  aggressorId: string,
  targetId: string,
  tick: number,
): DiplomacyState {
  const next = copyState(state);

  // Break every treaty between them first (don't use breakTreaty to avoid
  // double-penalties; we apply one big war penalty instead).
  const relA = getMutableRelation(next, aggressorId, targetId);
  const relB = getMutableRelation(next, targetId, aggressorId);

  // Remove all treaties silently before adding war incident.
  relA.treaties = [];
  relA.tradeRoutes = 0;
  relB.treaties = [];
  relB.tradeRoutes = 0;

  function setWar(rel: DiplomaticRelationFull, breaker: string): void {
    rel.status = 'at_war';
    applyIncident(
      rel,
      tick,
      'war_declared',
      WAR_ATTITUDE_PENALTY,
      WAR_TRUST_PENALTY,
      `War declared by ${breaker}`,
    );
  }

  setWar(relA, aggressorId);
  setWar(relB, aggressorId);

  return next;
}

/**
 * Negotiate peace between two empires at war.
 *
 * Sets status to 'neutral' and applies a small attitude bonus (trust remains
 * scarred from the war).
 */
export function makePeace(
  state: DiplomacyState,
  empireA: string,
  empireB: string,
  tick: number,
): DiplomacyState {
  const next = copyState(state);

  function setPeace(from: string, to: string): void {
    const rel = getMutableRelation(next, from, to);
    rel.status = 'neutral';
    applyIncident(
      rel,
      tick,
      'peace_made',
      PEACE_ATTITUDE_BONUS,
      PEACE_TRUST_PENALTY,
      `Peace treaty signed with ${to}`,
    );
  }

  setPeace(empireA, empireB);
  setPeace(empireB, empireA);

  return next;
}

/**
 * Adjust the attitude of empireA toward empireB by change, logging an incident.
 *
 * Does NOT automatically update empireB's attitude toward empireA — the caller
 * should call this twice if the change is reciprocal.
 */
export function modifyAttitude(
  state: DiplomacyState,
  empireA: string,
  empireB: string,
  change: number,
  reason: string,
  tick: number,
): DiplomacyState {
  const next = copyState(state);
  const rel = getMutableRelation(next, empireA, empireB);
  applyIncident(rel, tick, 'attitude_modified', change, 0, reason);
  rel.status = attitudeToStatus(rel.attitude, rel.status);
  return next;
}

/**
 * Calculate the per-tick trade income from a relation.
 *
 * Base formula:
 *   tradeRoutes × TRADE_INCOME_PER_ROUTE
 *   + TRADE_TREATY_INCOME_BONUS if a trade treaty is active
 */
export function calculateTradeIncome(relation: DiplomaticRelationFull): number {
  const routeIncome = relation.tradeRoutes * TRADE_INCOME_PER_ROUTE;
  const hasTradeTreaty = relation.treaties.some((t) => t.type === 'trade');
  const treatyBonus = hasTradeTreaty ? TRADE_TREATY_INCOME_BONUS : 0;
  return routeIncome + treatyBonus;
}

// ---------------------------------------------------------------------------
// AI treaty evaluation
// ---------------------------------------------------------------------------

/**
 * Personality-driven AI evaluation of a treaty proposal.
 *
 * Decision factors:
 *  1. Current attitude (must clear a personality-specific threshold).
 *  2. Current trust level.
 *  3. Species diplomacy trait of the target empire.
 *  4. Treaty type desirability modifiers per personality.
 *
 * Returns accept/reject with a human-readable reason and optional counter-terms.
 */
export function evaluateTreatyProposal(
  proposer: Empire,
  target: Empire,
  relation: DiplomaticRelationFull,
  proposal: TreatyProposal,
): { accept: boolean; reason: string; counterTerms?: Record<string, number> } {
  // Cannot negotiate while at war.
  if (relation.status === 'at_war') {
    return { accept: false, reason: 'We are at war — no treaties possible.' };
  }

  // Must have made first contact.
  if (relation.firstContact === -1) {
    return { accept: false, reason: 'No diplomatic contact has been established.' };
  }

  // Avoid duplicate treaties of the same type.
  const alreadyHas = relation.treaties.some((t) => t.type === proposal.treatyType);
  if (alreadyHas) {
    return { accept: false, reason: `A ${proposal.treatyType} treaty is already in effect.` };
  }

  const personality: AIPersonality = target.aiPersonality ?? 'diplomatic';
  const baseThreshold = PERSONALITY_ATTITUDE_THRESHOLDS[personality];

  // Species diplomacy trait (1-10, trait 5 = 0 bonus, 10 = +25 attitude bonus in evaluator)
  const diplomacyBonus = (target.species.traits.diplomacy - 5) * 5;

  // Trust modifier: high trust lowers the required attitude threshold
  const trustModifier = (relation.trust - 50) * 0.4; // ±20 at extremes

  // Treaty-type specific adjustments per personality
  const typeModifier = getTreatyTypeModifier(proposal.treatyType, personality);

  const effectiveThreshold = baseThreshold - diplomacyBonus - trustModifier - typeModifier;

  if (relation.attitude < effectiveThreshold) {
    return {
      accept: false,
      reason: `Insufficient goodwill — attitude ${relation.attitude} below required ${Math.round(effectiveThreshold)}.`,
    };
  }

  // Additional check: alliance requires high trust
  if (proposal.treatyType === 'alliance' && relation.trust < 50) {
    return {
      accept: false,
      reason: `Trust too low for an alliance (${relation.trust}/100 — need at least 50).`,
    };
  }

  // Aggressive personalities may counter-propose weaker terms for military treaties
  let counterTerms: Record<string, number> | undefined;
  if (
    personality === 'aggressive' &&
    (proposal.treatyType === 'mutual_defense' || proposal.treatyType === 'alliance')
  ) {
    counterTerms = { creditTransfer: 100 };
    return {
      accept: true,
      reason: 'Accepted with additional compensation terms.',
      counterTerms,
    };
  }

  return {
    accept: true,
    reason: `${proposal.treatyType} treaty accepted.`,
  };
}

/**
 * Return a per-personality bonus applied when evaluating a given treaty type.
 * Positive = more willing; negative = less willing.
 */
function getTreatyTypeModifier(treatyType: TreatyType, personality: AIPersonality): number {
  const matrix: Record<AIPersonality, Partial<Record<TreatyType, number>>> = {
    aggressive: {
      non_aggression: -10,
      trade: 0,
      trade_agreement: 0,
      research_sharing: -5,
      mutual_defense: -15,
      mutual_defence: -15,
      military_alliance: -10,
      alliance: -20,
      vassalism: 15,
      federation_membership: -25,
      subjugation: 30,
      unification: -15,
      assimilation: -10,
    },
    defensive: {
      non_aggression: 15,
      trade: 5,
      trade_agreement: 5,
      research_sharing: 0,
      mutual_defense: 20,
      mutual_defence: 20,
      military_alliance: 15,
      alliance: 10,
      vassalism: -10,
      federation_membership: 10,
      subjugation: -30,
      unification: 5,
      assimilation: -20,
    },
    economic: {
      non_aggression: 10,
      trade: 25,
      trade_agreement: 25,
      research_sharing: 5,
      mutual_defense: 5,
      mutual_defence: 5,
      military_alliance: 5,
      alliance: 5,
      vassalism: -5,
      federation_membership: 15,
      subjugation: -20,
      unification: 10,
      assimilation: -15,
    },
    diplomatic: {
      non_aggression: 20,
      trade: 15,
      trade_agreement: 15,
      research_sharing: 15,
      mutual_defense: 20,
      mutual_defence: 20,
      military_alliance: 20,
      alliance: 25,
      vassalism: -15,
      federation_membership: 25,
      subjugation: -35,
      unification: 20,
      assimilation: -25,
    },
    expansionist: {
      non_aggression: -5,
      trade: 10,
      trade_agreement: 10,
      research_sharing: -5,
      mutual_defense: -10,
      mutual_defence: -10,
      military_alliance: -5,
      alliance: -10,
      vassalism: 20,
      federation_membership: -15,
      subjugation: 25,
      unification: 10,
      assimilation: 5,
    },
    researcher: {
      non_aggression: 10,
      trade: 5,
      trade_agreement: 5,
      research_sharing: 30,
      mutual_defense: 5,
      mutual_defence: 5,
      military_alliance: 5,
      alliance: 10,
      vassalism: -10,
      federation_membership: 15,
      subjugation: -25,
      unification: 5,
      assimilation: -15,
    },
  };
  return matrix[personality][treatyType] ?? 0;
}

// ---------------------------------------------------------------------------
// Per-tick processing
// ---------------------------------------------------------------------------

/**
 * Advance all diplomatic relations by one game tick.
 *
 * Per tick:
 *  1. Attitude drifts toward 0 (at a fraction of its current value).
 *  2. Timed treaties that have expired are removed.
 *  3. Status is recalculated from attitude (preserving 'at_war').
 */
export function processDiplomacyTick(state: DiplomacyState, tick: number): DiplomacyState {
  const next = copyState(state);

  for (const targets of next.relations.values()) {
    for (const rel of targets.values()) {
      // --- Attitude decay toward 0 ---
      if (rel.attitude !== 0) {
        const decay =
          Math.sign(rel.attitude) *
          Math.max(ATTITUDE_DECAY_MIN, Math.abs(rel.attitude) * ATTITUDE_DECAY_FRACTION);
        rel.attitude = clampAttitude(rel.attitude - decay);
        // Snap to 0 when very close to avoid floating-point drift
        if (Math.abs(rel.attitude) < ATTITUDE_DECAY_MIN) {
          rel.attitude = 0;
        }
      }

      // --- Expire timed treaties ---
      const before = rel.treaties.length;
      rel.treaties = rel.treaties.filter((t) => {
        if (t.duration === -1) return true; // permanent
        return tick - t.startTick < t.duration;
      });
      if (rel.treaties.length < before) {
        rel.lastInteraction = tick;
      }

      // --- Recalculate status ---
      rel.status = attitudeToStatus(rel.attitude, rel.status);
    }
  }

  return next;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Human-readable label for a DiplomaticStatus value. */
export function getDiplomaticStatusLabel(status: DiplomaticStatus): string {
  switch (status) {
    case 'unknown':
      return 'Unknown';
    case 'neutral':
      return 'Neutral';
    case 'friendly':
      return 'Friendly';
    case 'allied':
      return 'Allied';
    case 'hostile':
      return 'Hostile';
    case 'at_war':
      return 'At War';
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}
