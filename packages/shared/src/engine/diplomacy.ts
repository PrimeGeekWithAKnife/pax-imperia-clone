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

import type { Empire, DiplomaticStatus, TreatyType, AIPersonality, CommunicationLevel } from '../types/species.js';
import type { Galaxy } from '../types/galaxy.js';
import type { Fleet } from '../types/ships.js';
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
  /** Level of communication established with this empire. */
  communicationLevel: CommunicationLevel;
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

/** Per-tick attitude bonus for each active treaty of a given type. */
const TREATY_PER_TICK_ATTITUDE: Partial<Record<TreatyType, number>> = {
  trade: 0.3,
  non_aggression: 0.1,
  alliance: 0.5,
  research_sharing: 0.2,
  mutual_defence: 0.3,
  mutual_defense: 0.3,
  trade_agreement: 0.3,
  military_alliance: 0.5,
};

/** Per-tick trust bonus for each active treaty (all types). */
const TREATY_PER_TICK_TRUST = 0.1;

/**
 * Extra per-tick attitude bonus when an alliance treaty is active.
 * At attitude +60 (alliance threshold), decay = 1.2/tick. Full treaty stack
 * (non_aggression 0.1 + trade 0.3 + alliance 0.5 + this 0.3 = 1.2) matches
 * the decay rate, stabilising alliances once formed.
 */
const ALLIANCE_MAINTENANCE_BONUS = 0.3;

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
    communicationLevel: 'none',
    incidentLog: [],
  };
}

/**
 * Deep-copy a DiplomaticRelationFull so mutations don't escape.
 */
function copyRelation(rel: DiplomaticRelationFull): DiplomaticRelationFull {
  return {
    ...rel,
    communicationLevel: rel.communicationLevel ?? 'none',
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
// Communication level hierarchy
// ---------------------------------------------------------------------------

const COMM_LEVEL_ORDER: CommunicationLevel[] = ['none', 'basic', 'trade', 'scientific'];

function commLevelIndex(level: CommunicationLevel): number {
  return COMM_LEVEL_ORDER.indexOf(level);
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
  // Must have made first contact — cannot declare war on unknown empires.
  const existing = getRelation(state, aggressorId, targetId);
  if (!existing || existing.firstContact === -1) {
    return state;
  }

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
// Communication level upgrades
// ---------------------------------------------------------------------------

/**
 * Advance the communication level between two empires by one step.
 *
 * Progression: none → basic → trade → scientific.
 * If already at 'scientific', the state is returned unchanged.
 * Both sides of the relationship are upgraded symmetrically.
 */
export function upgradeCommLevel(
  state: DiplomacyState,
  empireA: string,
  empireB: string,
): DiplomacyState {
  const relAB = getRelation(state, empireA, empireB);
  if (!relAB) return state;

  const currentIndex = commLevelIndex(relAB.communicationLevel ?? 'none');
  if (currentIndex >= COMM_LEVEL_ORDER.length - 1) return state; // already at max

  const next = copyState(state);
  const newLevel = COMM_LEVEL_ORDER[currentIndex + 1];

  const relA = getMutableRelation(next, empireA, empireB);
  const relB = getMutableRelation(next, empireB, empireA);
  relA.communicationLevel = newLevel;
  relB.communicationLevel = newLevel;

  return next;
}

// ---------------------------------------------------------------------------
// Empire elimination
// ---------------------------------------------------------------------------

/**
 * Check whether an empire has been eliminated from the game.
 *
 * An empire is eliminated when it owns zero planets AND controls zero fleets
 * (i.e. has no remaining ships). Both conditions must be true.
 */
export function isEmpireEliminated(
  empire: Empire,
  galaxy: Galaxy,
  fleets: Fleet[],
): boolean {
  const ownsPlanet = galaxy.systems.some((system) =>
    system.planets.some((planet) => planet.ownerId === empire.id),
  );
  if (ownsPlanet) return false;

  const hasFleet = fleets.some(
    (fleet) => fleet.empireId === empire.id && fleet.ships.length > 0,
  );
  return !hasFleet;
}

/**
 * Filter out eliminated empires, returning only those still active in the game.
 *
 * An empire is active if it owns at least one planet OR has at least one ship
 * (via fleets).
 */
export function getActiveEmpires(
  empires: Empire[],
  galaxy: Galaxy,
  fleets: Fleet[],
): Empire[] {
  return empires.filter((empire) => !isEmpireEliminated(empire, galaxy, fleets));
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
    return { accept: false, reason: 'Your envoys are turned away at the border. There can be no negotiations while our forces clash in the void. Seek peace first.' };
  }

  // Must have made first contact.
  if (relation.firstContact === -1) {
    return { accept: false, reason: 'We have had no contact with this civilisation. Our diplomats cannot reach an empire we have not yet encountered.' };
  }

  // Avoid duplicate treaties of the same type.
  const alreadyHas = relation.treaties.some((t) => t.type === proposal.treatyType);
  if (alreadyHas) {
    return { accept: false, reason: `We already have a ${proposal.treatyType.replace(/_/g, ' ')} agreement in place. There is no need for a duplicate arrangement.` };
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
    const gap = effectiveThreshold - relation.attitude;
    const treatyLabel = proposal.treatyType.replace(/_/g, ' ');
    // Near miss — warm but cautious
    if (gap < 15) {
      const nearMissResponses: Record<AIPersonality, string> = {
        diplomatic: `We appreciate your initiative regarding a ${treatyLabel}. Our people are warming to yours, but we feel it is prudent to continue building trust before formalising such an arrangement.`,
        aggressive: `Your proposal for a ${treatyLabel} is... premature. Prove your strength and commitment first, then we shall reconsider.`,
        defensive: `We are grateful for the offer of a ${treatyLabel}, and we see the wisdom in it. However, our council advises patience — let us continue our positive exchanges a while longer.`,
        expansionist: `A ${treatyLabel}? Interesting. We are not opposed, but we need to see that your interests align more closely with ours before committing.`,
        researcher: `We find the prospect of a ${treatyLabel} intellectually stimulating. However, our analysis suggests the relationship requires further maturation. We encourage continued cooperation.`,
        economic: `We see the commercial merit in a ${treatyLabel}. But our risk assessment suggests we should deepen our trade relations first. Keep the credits flowing, and we shall revisit this soon.`,
      };
      return { accept: false, reason: nearMissResponses[personality] ?? nearMissResponses.diplomatic };
    }
    // Far from threshold — polite but firm
    const farResponses: Record<AIPersonality, string> = {
      diplomatic: `We must respectfully decline your proposal for a ${treatyLabel} at this time. Our peoples have not yet developed the mutual understanding such an agreement requires.`,
      aggressive: `We have no interest in a ${treatyLabel} with you. Actions speak louder than words — demonstrate your worth.`,
      defensive: `A ${treatyLabel} requires a foundation of trust we have not yet established. We suggest beginning with more modest overtures.`,
      expansionist: `We do not see sufficient strategic alignment for a ${treatyLabel} at present. Perhaps in time, as our spheres of influence find common ground.`,
      researcher: `Our analysis indicates the conditions for a ${treatyLabel} are not yet met. We suggest continued scientific and cultural exchange as a precursor.`,
      economic: `The risk-reward calculus for a ${treatyLabel} does not favour us at this juncture. Perhaps increased trade would help change this assessment.`,
    };
    return { accept: false, reason: farResponses[personality] ?? farResponses.diplomatic };
  }

  // Additional check: alliance requires high trust
  if (proposal.treatyType === 'alliance' && relation.trust < 50) {
    const allianceResponses: Record<AIPersonality, string> = {
      diplomatic: 'An alliance is a profound commitment. While our relations are positive, we feel we must know each other better before entrusting our defence to one another.',
      aggressive: 'An alliance means trusting you with our survival. That trust has not been earned yet.',
      defensive: 'We value the sentiment behind your alliance proposal. However, true alliances are forged through shared adversity and time — we are not there yet.',
      expansionist: 'An alliance is tempting, but we must be certain our territorial ambitions are compatible before making such a binding commitment.',
      researcher: 'Alliance requires deep mutual trust. Our diplomatic data suggests we should continue building confidence through research sharing and trade first.',
      economic: 'An alliance carries significant obligations. We would prefer to strengthen our economic ties further before considering such a close partnership.',
    };
    return { accept: false, reason: allianceResponses[personality] ?? allianceResponses.diplomatic };
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
      reason: 'We accept your proposal — but our military commitment comes at a price. We expect compensation for the protection we extend to your borders.',
      counterTerms,
    };
  }

  // Acceptance — personality-flavoured
  const treatyLabel = proposal.treatyType.replace(/_/g, ' ');
  const acceptResponses: Record<AIPersonality, string> = {
    diplomatic: `We are pleased to accept your ${treatyLabel} proposal. May this agreement mark the beginning of a lasting partnership between our peoples.`,
    aggressive: `Your ${treatyLabel} proposal serves our mutual interests. We accept — do not give us cause to regret this decision.`,
    defensive: `We gratefully accept the ${treatyLabel}. Together, we shall be stronger against the uncertainties of the galaxy.`,
    expansionist: `A ${treatyLabel} aligns well with our vision for the sector. We accept with enthusiasm.`,
    researcher: `Excellent — a ${treatyLabel} opens new avenues for collaboration. We accept and look forward to the exchange of knowledge.`,
    economic: `This ${treatyLabel} should prove profitable for us both. We are pleased to accept.`,
  };
  return { accept: true, reason: acceptResponses[personality] ?? acceptResponses.diplomatic };
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
 *  1. Skip eliminated empires (if galaxy/fleets context provided).
 *  2. Attitude drifts toward 0 (at a fraction of its current value).
 *  3. Timed treaties that have expired are removed.
 *  4. Communication levels upgrade automatically based on active treaties.
 *  5. Status is recalculated from attitude (preserving 'at_war').
 *
 * @param state - Current diplomacy state
 * @param tick - Current game tick
 * @param empires - All empires (optional; needed for elimination checks)
 * @param galaxy - Galaxy state (optional; needed for elimination checks)
 * @param fleets - All fleets (optional; needed for elimination checks)
 */
export function processDiplomacyTick(
  state: DiplomacyState,
  tick: number,
  empires?: Empire[],
  galaxy?: Galaxy,
  fleets?: Fleet[],
): DiplomacyState {
  const next = copyState(state);

  // Build a set of eliminated empire IDs for fast lookup
  const eliminatedIds = new Set<string>();
  if (empires && galaxy && fleets) {
    for (const empire of empires) {
      if (isEmpireEliminated(empire, galaxy, fleets)) {
        eliminatedIds.add(empire.id);
      }
    }
  }

  for (const [empireId, targets] of next.relations) {
    // Skip processing for eliminated empires
    if (eliminatedIds.has(empireId)) continue;

    for (const rel of targets.values()) {
      // Skip relations with eliminated empires
      if (eliminatedIds.has(rel.targetEmpireId)) continue;

      // --- Per-tick treaty bonuses (counteracts decay) ---
      let hasAlliance = false;
      let hasTradeTreaty = false;
      let hasResearchSharing = false;
      for (const treaty of rel.treaties) {
        const attitudeGain = TREATY_PER_TICK_ATTITUDE[treaty.type] ?? 0;
        if (attitudeGain > 0) {
          rel.attitude = clampAttitude(rel.attitude + attitudeGain);
        }
        rel.trust = clampTrust(rel.trust + TREATY_PER_TICK_TRUST);
        if (treaty.type === 'alliance' || treaty.type === 'military_alliance') {
          hasAlliance = true;
        }
        if (treaty.type === 'trade' || treaty.type === 'trade_agreement') {
          hasTradeTreaty = true;
        }
        if (treaty.type === 'research_sharing') {
          hasResearchSharing = true;
        }
      }

      // --- Alliance maintenance bonus (stabilises alliances once formed) ---
      if (hasAlliance) {
        rel.attitude = clampAttitude(rel.attitude + ALLIANCE_MAINTENANCE_BONUS);
      }

      // --- Auto-upgrade communication level based on treaties ---
      const currentLevel = rel.communicationLevel ?? 'none';
      const currentIdx = commLevelIndex(currentLevel);
      if (hasResearchSharing && currentIdx < commLevelIndex('scientific')) {
        // Research sharing → scientific (skip intermediate levels)
        rel.communicationLevel = 'scientific';
        // Also upgrade the reverse relation
        const reverseRel = getMutableRelation(next, rel.targetEmpireId, empireId);
        reverseRel.communicationLevel = 'scientific';
      } else if (hasTradeTreaty && currentIdx < commLevelIndex('trade')) {
        // Trade treaty → at least trade level
        rel.communicationLevel = 'trade';
        const reverseRel = getMutableRelation(next, rel.targetEmpireId, empireId);
        reverseRel.communicationLevel = 'trade';
      }

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
