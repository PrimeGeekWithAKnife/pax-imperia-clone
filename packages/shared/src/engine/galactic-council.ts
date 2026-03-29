/**
 * Galactic Council engine — pure functions for managing the inter-empire
 * governing body that forms once galactic diplomacy reaches critical mass.
 *
 * The council is an advisory-then-binding body that matures over time:
 *  - Forms when 50%+ empires have established mutual contact
 *  - Voting power weighted by economy, military, reputation, population, and intent
 *  - Early resolutions are advisory; binding resolutions unlock as the council matures
 *  - Empires may leave and form rival blocs with their own markets/currencies
 *
 * All functions are side-effect free and return new state objects.
 */

import type { Empire } from '../types/species.js';
import type {
  GalacticCouncil,
  CouncilResolution,
  GalacticBloc,
  ResolutionType,
  VoteChoice,
} from '../types/diplomacy.js';
import type { DiplomacyState } from './diplomacy.js';
import { getRelation } from './diplomacy.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fraction of empires that must have mutual contact for the council to form. */
const FORMATION_THRESHOLD = 0.5;

/** Number of ticks after formation before binding resolutions are permitted. */
const BINDING_MATURITY_TICKS = 100;

/** Number of ticks a resolution remains open for voting before auto-resolution. */
const VOTING_WINDOW_TICKS = 10;

/** Maximum number of active (unresolved) resolutions at any one time. */
const MAX_ACTIVE_RESOLUTIONS = 5;

// Voting power weights (must sum to 1.0)
const WEIGHT_ECONOMY = 0.30;
const WEIGHT_MILITARY = 0.20;
const WEIGHT_REPUTATION = 0.25;
const WEIGHT_POPULATION = 0.15;
const WEIGHT_INTENTIONS = 0.10;

// ---------------------------------------------------------------------------
// Internal event type (returned alongside state mutations)
// ---------------------------------------------------------------------------

/**
 * A council-related event that the game loop can convert into notifications
 * or feed into the main GameEvent stream.
 */
export interface CouncilEvent {
  type:
    | 'council_formed'
    | 'member_joined'
    | 'member_left'
    | 'resolution_proposed'
    | 'resolution_passed'
    | 'resolution_failed'
    | 'bloc_formed'
    | 'binding_unlocked';
  tick: number;
  description: string;
  /** Empire IDs that should be notified about this event. */
  involvedEmpires: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deep-copy a GalacticCouncil so mutations do not escape.
 */
function copyCouncil(council: GalacticCouncil): GalacticCouncil {
  return {
    formed: council.formed,
    formedTick: council.formedTick,
    memberEmpires: [...council.memberEmpires],
    reserveCurrency: council.reserveCurrency,
    votingPower: { ...council.votingPower },
    resolutions: council.resolutions.map((r) => ({
      ...r,
      votes: { ...r.votes },
    })),
    rivalBlocs: council.rivalBlocs.map((b) => ({
      ...b,
      members: [...b.members],
    })),
  };
}

/**
 * Count mutual-contact pairs among empires using the diplomacy state.
 * Two empires have mutual contact when both sides have firstContact >= 0.
 */
function countMutualContactPairs(
  empireIds: string[],
  diplomacyState: DiplomacyState,
): number {
  let pairs = 0;
  for (let i = 0; i < empireIds.length; i++) {
    for (let j = i + 1; j < empireIds.length; j++) {
      const relA = getRelation(diplomacyState, empireIds[i], empireIds[j]);
      const relB = getRelation(diplomacyState, empireIds[j], empireIds[i]);
      if (relA && relA.firstContact >= 0 && relB && relB.firstContact >= 0) {
        pairs++;
      }
    }
  }
  return pairs;
}

/**
 * Count the number of empires that have at least one mutual contact.
 */
function countEmpiresWithContact(
  empireIds: string[],
  diplomacyState: DiplomacyState,
): number {
  let count = 0;
  for (const empireId of empireIds) {
    let hasContact = false;
    for (const otherId of empireIds) {
      if (empireId === otherId) continue;
      const relA = getRelation(diplomacyState, empireId, otherId);
      const relB = getRelation(diplomacyState, otherId, empireId);
      if (relA && relA.firstContact >= 0 && relB && relB.firstContact >= 0) {
        hasContact = true;
        break;
      }
    }
    if (hasContact) count++;
  }
  return count;
}

/**
 * Compute a normalised score (0-1) for a value relative to all empires.
 * If all values are identical the result is 0.5 (average).
 */
function normalise(value: number, allValues: number[]): number {
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Derive a crude "diplomatic reputation" score for an empire from the
 * diplomacy state. Averages the attitude that all contacted empires hold
 * toward this empire, then maps to 0-1.
 */
function reputationScore(
  empireId: string,
  allEmpireIds: string[],
  diplomacyState: DiplomacyState,
): number {
  let total = 0;
  let count = 0;
  for (const otherId of allEmpireIds) {
    if (otherId === empireId) continue;
    const rel = getRelation(diplomacyState, otherId, empireId);
    if (rel && rel.firstContact >= 0) {
      total += rel.attitude; // -100..+100
      count++;
    }
  }
  if (count === 0) return 0.5;
  const average = total / count; // -100..+100
  return clamp((average + 100) / 200, 0, 1); // map to 0..1
}

/**
 * Derive a crude "declared intentions alignment" score.
 * Empires that are friendly to more council members score higher.
 * Maps average public attitude (from others toward them) to 0-1.
 */
function intentionsAlignmentScore(
  empireId: string,
  memberEmpires: string[],
  diplomacyState: DiplomacyState,
): number {
  let total = 0;
  let count = 0;
  for (const otherId of memberEmpires) {
    if (otherId === empireId) continue;
    const rel = getRelation(diplomacyState, empireId, otherId);
    if (rel && rel.firstContact >= 0) {
      total += rel.attitude;
      count++;
    }
  }
  if (count === 0) return 0.5;
  const average = total / count;
  return clamp((average + 100) / 200, 0, 1);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the conditions for forming a Galactic Council are met.
 *
 * The council forms when at least 50% of all empires have established
 * mutual diplomatic contact with at least one other empire.
 *
 * @param empires - All empires in the game.
 * @param diplomacyState - Current diplomacy state.
 * @returns `true` if the council should be formed.
 */
export function checkCouncilFormation(
  empires: Empire[],
  diplomacyState: DiplomacyState,
): boolean {
  if (empires.length < 2) return false;

  const empireIds = empires.map((e) => e.id);
  const withContact = countEmpiresWithContact(empireIds, diplomacyState);

  return withContact / empires.length >= FORMATION_THRESHOLD;
}

/**
 * Create a new Galactic Council with all empires that have established
 * mutual contact as founding members.
 *
 * @param empires - All empires in the game.
 * @param diplomacyState - Current diplomacy state.
 * @param tick - The game tick at which the council is being formed.
 * @returns The newly formed council.
 */
export function formCouncil(
  empires: Empire[],
  diplomacyState: DiplomacyState,
  tick: number,
): GalacticCouncil {
  const empireIds = empires.map((e) => e.id);

  // Founding members: every empire that has mutual contact with at least one other.
  const foundingMembers: string[] = [];
  for (const empireId of empireIds) {
    for (const otherId of empireIds) {
      if (empireId === otherId) continue;
      const relA = getRelation(diplomacyState, empireId, otherId);
      const relB = getRelation(diplomacyState, otherId, empireId);
      if (relA && relA.firstContact >= 0 && relB && relB.firstContact >= 0) {
        foundingMembers.push(empireId);
        break;
      }
    }
  }

  // Calculate initial voting power for all founding members.
  const votingPower: Record<string, number> = {};
  for (const memberId of foundingMembers) {
    const empire = empires.find((e) => e.id === memberId);
    if (empire) {
      votingPower[memberId] = calculateVotingPower(
        empire,
        empires,
        diplomacyState,
        foundingMembers,
      );
    }
  }

  return {
    formed: true,
    formedTick: tick,
    memberEmpires: foundingMembers,
    reserveCurrency: false,
    votingPower,
    resolutions: [],
    rivalBlocs: [],
  };
}

/**
 * Calculate an empire's voting power within the council.
 *
 * Weights:
 *  - Economic strength:      30% (credits + economy trait)
 *  - Military power:         20% (combat trait as proxy)
 *  - Diplomatic reputation:  25% (average attitude from others)
 *  - Population proxy:       15% (known systems as proxy)
 *  - Declared intentions:    10% (alignment with council members)
 *
 * Returns a value between 0 and 100.
 *
 * @param empire - The empire whose voting power is being calculated.
 * @param allEmpires - All empires in the game (for normalisation).
 * @param diplomacyState - Current diplomacy state.
 * @param memberEmpires - Optional list of council member IDs (defaults to allEmpires).
 * @returns Normalised voting power (0-100).
 */
export function calculateVotingPower(
  empire: Empire,
  allEmpires: Empire[],
  diplomacyState: DiplomacyState,
  memberEmpires?: string[],
): number {
  const allIds = allEmpires.map((e) => e.id);
  const members = memberEmpires ?? allIds;

  // Economic strength: credits * economy trait modifier
  const economicValues = allEmpires.map((e) => e.credits * (e.species.traits.economy / 5));
  const economicScore = normalise(
    empire.credits * (empire.species.traits.economy / 5),
    economicValues,
  );

  // Military power: combat trait as proxy
  const militaryValues = allEmpires.map((e) => e.species.traits.combat);
  const militaryScore = normalise(empire.species.traits.combat, militaryValues);

  // Diplomatic reputation: average attitude from others toward this empire
  const repScore = reputationScore(empire.id, allIds, diplomacyState);

  // Population proxy: number of known systems (reflects territorial reach)
  const popValues = allEmpires.map((e) => e.knownSystems.length);
  const populationScore = normalise(empire.knownSystems.length, popValues);

  // Declared intentions alignment
  const intentionsScore = intentionsAlignmentScore(empire.id, members, diplomacyState);

  const raw =
    economicScore * WEIGHT_ECONOMY +
    militaryScore * WEIGHT_MILITARY +
    repScore * WEIGHT_REPUTATION +
    populationScore * WEIGHT_POPULATION +
    intentionsScore * WEIGHT_INTENTIONS;

  return clamp(Math.round(raw * 100), 1, 100);
}

/**
 * Propose a new resolution to the Galactic Council.
 *
 * Only council members may propose resolutions. Binding resolutions are
 * only permitted once the council has matured (100+ ticks since formation).
 *
 * @param council - Current council state.
 * @param proposer - Empire ID of the proposer.
 * @param title - Short title for the resolution.
 * @param description - Full description of the resolution.
 * @param type - Whether the resolution is advisory or binding.
 * @param tick - Current game tick.
 * @returns Updated council with the new resolution added, or unchanged if invalid.
 */
export function proposeResolution(
  council: GalacticCouncil,
  proposer: string,
  title: string,
  description: string,
  type: ResolutionType,
  tick: number,
): GalacticCouncil {
  if (!council.formed) return council;
  if (!council.memberEmpires.includes(proposer)) return council;

  // Enforce maturity requirement for binding resolutions.
  if (
    type === 'binding' &&
    council.formedTick !== undefined &&
    tick - council.formedTick < BINDING_MATURITY_TICKS
  ) {
    return council;
  }

  // Enforce maximum active resolutions.
  const activeCount = council.resolutions.filter(
    (r) => Object.keys(r.votes).length < council.memberEmpires.length && !r.passed,
  ).length;
  if (activeCount >= MAX_ACTIVE_RESOLUTIONS) return council;

  const next = copyCouncil(council);

  const resolution: CouncilResolution = {
    id: generateId(),
    proposedBy: proposer,
    title,
    description,
    type,
    votes: {},
    passed: false,
    tick,
  };

  next.resolutions.push(resolution);
  return next;
}

/**
 * Cast a vote on an open council resolution.
 *
 * Only council members may vote. Each member may vote once per resolution.
 *
 * @param council - Current council state.
 * @param resolutionId - ID of the resolution to vote on.
 * @param empireId - Empire casting the vote.
 * @param vote - The vote choice.
 * @returns Updated council state.
 */
export function voteOnResolution(
  council: GalacticCouncil,
  resolutionId: string,
  empireId: string,
  vote: VoteChoice,
): GalacticCouncil {
  if (!council.formed) return council;
  if (!council.memberEmpires.includes(empireId)) return council;

  const next = copyCouncil(council);
  const resolution = next.resolutions.find((r) => r.id === resolutionId);
  if (!resolution) return council;

  // Already voted.
  if (resolution.votes[empireId] !== undefined) return council;

  resolution.votes[empireId] = vote;
  return next;
}

/**
 * Resolve the outcome of a council vote.
 *
 * A resolution passes if the weighted "for" votes exceed the weighted
 * "against" votes. Abstentions contribute no weight. The resolution's
 * `passed` field is updated accordingly.
 *
 * @param council - Current council state.
 * @param resolutionId - ID of the resolution to resolve.
 * @returns Updated council and whether the resolution passed, plus events.
 */
export function resolveVote(
  council: GalacticCouncil,
  resolutionId: string,
): { council: GalacticCouncil; passed: boolean; events: CouncilEvent[] } {
  const events: CouncilEvent[] = [];

  if (!council.formed) return { council, passed: false, events };

  const next = copyCouncil(council);
  const resolution = next.resolutions.find((r) => r.id === resolutionId);
  if (!resolution) return { council, passed: false, events };

  let weightFor = 0;
  let weightAgainst = 0;

  for (const [empireId, vote] of Object.entries(resolution.votes)) {
    const power = next.votingPower[empireId] ?? 0;
    if (vote === 'for') weightFor += power;
    if (vote === 'against') weightAgainst += power;
    // Abstentions carry no weight.
  }

  const passed = weightFor > weightAgainst;
  resolution.passed = passed;

  events.push({
    type: passed ? 'resolution_passed' : 'resolution_failed',
    tick: resolution.tick,
    description: passed
      ? `Council resolution "${resolution.title}" has passed (${weightFor} for / ${weightAgainst} against).`
      : `Council resolution "${resolution.title}" has failed (${weightFor} for / ${weightAgainst} against).`,
    involvedEmpires: [...next.memberEmpires],
  });

  return { council: next, passed, events };
}

/**
 * Remove an empire from the Galactic Council.
 *
 * Leaving the council forfeits voting power and removes the empire from
 * all ongoing votes. Bloc membership is NOT automatically revoked — an
 * empire may leave the council but remain in a rival bloc.
 *
 * @param council - Current council state.
 * @param empireId - Empire leaving the council.
 * @param tick - Current game tick.
 * @returns Updated council state.
 */
export function leaveCouncil(
  council: GalacticCouncil,
  empireId: string,
  tick: number,
): GalacticCouncil {
  if (!council.formed) return council;
  if (!council.memberEmpires.includes(empireId)) return council;

  const next = copyCouncil(council);

  next.memberEmpires = next.memberEmpires.filter((id) => id !== empireId);
  delete next.votingPower[empireId];

  // Remove this empire's votes from all unresolved resolutions.
  for (const resolution of next.resolutions) {
    delete resolution.votes[empireId];
  }

  return next;
}

/**
 * Form a rival bloc of empires — potentially within or outside the council.
 *
 * A bloc coordinates voting, may establish its own internal market, and
 * can issue its own currency as an alternative to the galactic reserve.
 *
 * @param empireIds - Empire IDs forming the bloc (must include the leader).
 * @param leaderEmpireId - The empire that leads the bloc.
 * @param name - Human-readable name for the bloc.
 * @param tick - Current game tick.
 * @returns The newly formed bloc.
 */
export function formRivalBloc(
  empireIds: string[],
  leaderEmpireId: string,
  name: string,
  tick: number,
): GalacticBloc {
  return {
    id: generateId(),
    name,
    leaderEmpire: leaderEmpireId,
    members: [...empireIds],
    formedTick: tick,
    hasOwnMarket: false,
    hasOwnCurrency: false,
  };
}

/**
 * Add a rival bloc to the council's records.
 *
 * @param council - Current council state.
 * @param bloc - The bloc to register.
 * @returns Updated council state with the bloc added.
 */
export function registerBloc(
  council: GalacticCouncil,
  bloc: GalacticBloc,
): GalacticCouncil {
  const next = copyCouncil(council);
  next.rivalBlocs.push({
    ...bloc,
    members: [...bloc.members],
  });
  return next;
}

/**
 * Process one game tick for the Galactic Council.
 *
 * Per tick:
 *  1. Check for new empires eligible to join (have mutual contact with a member).
 *  2. Auto-resolve votes whose voting window has expired.
 *  3. Recalculate voting power for all members.
 *  4. Check for maturity milestones (binding resolutions unlock).
 *
 * @param council - Current council state.
 * @param empires - All empires in the game.
 * @param diplomacyState - Current diplomacy state.
 * @param tick - Current game tick.
 * @returns Updated council and any events generated.
 */
export function processCouncilTick(
  council: GalacticCouncil,
  empires: Empire[],
  diplomacyState: DiplomacyState,
  tick: number,
): { council: GalacticCouncil; events: CouncilEvent[] } {
  if (!council.formed) return { council, events: [] };

  let next = copyCouncil(council);
  const events: CouncilEvent[] = [];

  // 1. Check for new member eligibility.
  const empireIds = empires.map((e) => e.id);
  for (const empireId of empireIds) {
    if (next.memberEmpires.includes(empireId)) continue;

    // An empire is eligible if it has mutual contact with any current member.
    let eligible = false;
    for (const memberId of next.memberEmpires) {
      const relA = getRelation(diplomacyState, empireId, memberId);
      const relB = getRelation(diplomacyState, memberId, empireId);
      if (relA && relA.firstContact >= 0 && relB && relB.firstContact >= 0) {
        eligible = true;
        break;
      }
    }

    if (eligible) {
      next.memberEmpires.push(empireId);
      const empire = empires.find((e) => e.id === empireId);
      events.push({
        type: 'member_joined',
        tick,
        description: `${empire?.name ?? empireId} has joined the Galactic Council.`,
        involvedEmpires: [...next.memberEmpires],
      });
    }
  }

  // 2. Auto-resolve votes that have exceeded their voting window.
  for (const resolution of next.resolutions) {
    // Skip already-resolved resolutions (those where passed has been determined).
    // A resolution is "active" if not all members have voted and it's still
    // within the voting window OR just expired.
    const age = tick - resolution.tick;
    const allVoted = next.memberEmpires.every(
      (id) => resolution.votes[id] !== undefined,
    );

    if (allVoted || age >= VOTING_WINDOW_TICKS) {
      // Only resolve if not already resolved (check: if passed is still false
      // and no one has voted for/against, it hasn't been resolved yet).
      // Use a heuristic: if the resolution has zero votes it was just proposed.
      const totalVotes = Object.keys(resolution.votes).length;
      if (totalVotes === 0 && age < VOTING_WINDOW_TICKS) continue;

      // Check if this resolution was already resolved in a previous tick.
      // We mark resolved resolutions by setting a vote count equal to members
      // at the time — but since we can't add a field, we check via a simple
      // heuristic: if passed is true, it was already resolved positively;
      // if all members voted and passed is false, it already failed.
      // To avoid re-resolving, only resolve if the tick matches the expiry.
      if (allVoted || age === VOTING_WINDOW_TICKS) {
        const result = resolveVote(next, resolution.id);
        next = result.council;
        events.push(...result.events);
      }
    }
  }

  // 3. Recalculate voting power for all members.
  for (const memberId of next.memberEmpires) {
    const empire = empires.find((e) => e.id === memberId);
    if (empire) {
      next.votingPower[memberId] = calculateVotingPower(
        empire,
        empires,
        diplomacyState,
        next.memberEmpires,
      );
    }
  }

  // 4. Check maturity milestone: binding resolutions become available.
  if (
    next.formedTick !== undefined &&
    tick - next.formedTick === BINDING_MATURITY_TICKS
  ) {
    events.push({
      type: 'binding_unlocked',
      tick,
      description:
        'The Galactic Council has matured — binding resolutions are now permitted.',
      involvedEmpires: [...next.memberEmpires],
    });
  }

  return { council: next, events };
}

/**
 * Create a default (unformed) council state.
 *
 * @returns An empty GalacticCouncil.
 */
export function createEmptyCouncil(): GalacticCouncil {
  return {
    formed: false,
    formedTick: undefined,
    memberEmpires: [],
    reserveCurrency: false,
    votingPower: {},
    resolutions: [],
    rivalBlocs: [],
  };
}
