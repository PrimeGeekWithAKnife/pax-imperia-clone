/**
 * Galactic Organisation engine — pure functions for managing competing
 * inter-empire governing bodies.
 *
 * Unlike the original single-council model, empires may now found and
 * join multiple independent organisations (akin to NATO vs the Warsaw
 * Pact). Each organisation has its own membership, voting power,
 * resolutions, and optional reserve currency / market.
 *
 * Key rules:
 *  - Formation requires exactly 2 empires with mutual diplomatic contact
 *  - An empire may belong to at most ONE organisation at a time
 *  - Members may leave and join a different organisation
 *  - Two organisations may merge if ALL members of both agree
 *  - Default membership benefits: non-aggression pact + basic trade partnerships
 *  - Binding resolutions unlock once the organisation matures (100 ticks)
 *
 * All functions are side-effect free and return new state objects.
 */

import type { Empire } from '../types/species.js';
import type {
  GalacticOrganisation,
  GalacticOrganisationState,
  CouncilResolution,
  ResolutionType,
  VoteChoice,
} from '../types/diplomacy.js';
import type { DiplomacyState } from './diplomacy.js';
import { getRelation } from './diplomacy.js';
import { generateId } from '../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of empires required to found an organisation. */
const FORMATION_MEMBER_COUNT = 2;

/** Number of ticks after formation before binding resolutions are permitted. */
const BINDING_MATURITY_TICKS = 100;

/** Number of ticks a resolution remains open for voting before auto-resolution. */
const VOTING_WINDOW_TICKS = 10;

/** Maximum number of active (unresolved) resolutions per organisation. */
const MAX_ACTIVE_RESOLUTIONS = 5;

// Voting power weights (must sum to 1.0)
const WEIGHT_ECONOMY = 0.30;
const WEIGHT_MILITARY = 0.20;
const WEIGHT_REPUTATION = 0.25;
const WEIGHT_POPULATION = 0.15;
const WEIGHT_INTENTIONS = 0.10;

// ---------------------------------------------------------------------------
// Organisation name templates
// ---------------------------------------------------------------------------

/**
 * Procedural name templates for galactic organisations.
 * {@link generateOrganisationName} picks from these, avoiding duplicates.
 */
const ORGANISATION_NAME_TEMPLATES: readonly string[] = [
  'Galactic Council',
  'United Worlds Federation',
  'Stellar Alliance',
  'Interstellar Compact',
  'Galactic Federation',
  'United Worlds League',
  'Stellar Concordat',
  'Interstellar Assembly',
  'Galactic Entente',
  'Cosmic Accord',
  'Astral Covenant',
  'Galactic Pact',
  'Stellar Union',
  'Interstellar Congress',
  'United Systems Coalition',
  'Galactic Directorate',
  'Stellar Forum',
  'Interstellar Treaty Organisation',
  'Cosmic Collective',
  'Astral Confederation',
] as const;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * An organisation-related event that the game loop can convert into
 * notifications or feed into the main GameEvent stream.
 */
export interface OrganisationEvent {
  type:
    | 'organisation_formed'
    | 'member_joined'
    | 'member_left'
    | 'resolution_proposed'
    | 'resolution_passed'
    | 'resolution_failed'
    | 'organisations_merged'
    | 'member_transferred'
    | 'binding_unlocked';
  tick: number;
  description: string;
  /** Empire IDs that should be notified about this event. */
  involvedEmpires: string[];
  /** Organisation ID this event relates to (if applicable). */
  organisationId?: string;
}

/**
 * @deprecated Use {@link OrganisationEvent} instead. Retained for backwards compatibility.
 */
export type CouncilEvent = OrganisationEvent;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deep-copy a GalacticOrganisation so mutations do not escape.
 */
function copyOrganisation(org: GalacticOrganisation): GalacticOrganisation {
  return {
    id: org.id,
    name: org.name,
    formedTick: org.formedTick,
    founderEmpires: [...org.founderEmpires] as [string, string],
    memberEmpires: [...org.memberEmpires],
    votingPower: { ...org.votingPower },
    resolutions: org.resolutions.map((r) => ({
      ...r,
      votes: { ...r.votes },
    })),
    reserveCurrency: org.reserveCurrency,
    hasOwnMarket: org.hasOwnMarket,
    maturityTick: org.maturityTick,
  };
}

/**
 * Deep-copy the entire organisation state.
 */
function copyState(state: GalacticOrganisationState): GalacticOrganisationState {
  return {
    organisations: state.organisations.map(copyOrganisation),
  };
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
 * Empires that are friendly to more organisation members score higher.
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

/**
 * Check whether two empires have established mutual diplomatic contact.
 */
function haveMutualContact(
  empireIdA: string,
  empireIdB: string,
  diplomacyState: DiplomacyState,
): boolean {
  const relA = getRelation(diplomacyState, empireIdA, empireIdB);
  const relB = getRelation(diplomacyState, empireIdB, empireIdA);
  return !!(relA && relA.firstContact >= 0 && relB && relB.firstContact >= 0);
}

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique name for a new galactic organisation.
 *
 * Picks from the pool of 20 templates, avoiding names already in use.
 * If all templates are exhausted, appends a numeric suffix to a random
 * template (e.g. "Stellar Alliance II").
 *
 * @param existingNames - Names already in use by current organisations.
 * @param rng - Optional random number generator (0-1). Defaults to Math.random.
 * @returns A unique organisation name.
 */
export function generateOrganisationName(
  existingNames: string[],
  rng: () => number = Math.random,
): string {
  const available = ORGANISATION_NAME_TEMPLATES.filter(
    (name) => !existingNames.includes(name),
  );

  if (available.length > 0) {
    const index = Math.floor(rng() * available.length);
    return available[index];
  }

  // All base templates exhausted — generate a suffixed variant.
  const baseIndex = Math.floor(rng() * ORGANISATION_NAME_TEMPLATES.length);
  const baseName = ORGANISATION_NAME_TEMPLATES[baseIndex];
  let suffix = 2;
  while (existingNames.includes(`${baseName} ${toRomanNumeral(suffix)}`)) {
    suffix++;
  }
  return `${baseName} ${toRomanNumeral(suffix)}`;
}

/**
 * Convert a small integer to a Roman numeral (covers 2-20 for our purposes).
 */
function toRomanNumeral(n: number): string {
  const numerals: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  let remaining = n;
  for (const [value, symbol] of numerals) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------------

/**
 * Check whether two empires can found a new galactic organisation.
 *
 * Requirements:
 *  - Both empires must have mutual diplomatic contact
 *  - Neither empire may already be a member of an existing organisation
 *
 * @param empire1Id - First empire ID.
 * @param empire2Id - Second empire ID.
 * @param diplomacyState - Current diplomacy state.
 * @param state - Current organisation state (to check existing memberships).
 * @returns `true` if the two empires may form an organisation.
 */
export function canFormOrganisation(
  empire1Id: string,
  empire2Id: string,
  diplomacyState: DiplomacyState,
  state: GalacticOrganisationState,
): boolean {
  if (empire1Id === empire2Id) return false;
  if (!haveMutualContact(empire1Id, empire2Id, diplomacyState)) return false;

  // Neither empire may already belong to an organisation.
  const empire1Org = getEmpireOrganisation(state, empire1Id);
  const empire2Org = getEmpireOrganisation(state, empire2Id);
  if (empire1Org || empire2Org) return false;

  return true;
}

/**
 * Form a new galactic organisation with two founding empires.
 *
 * @param name - Human-readable name for the organisation.
 * @param founderEmpires - Tuple of the two founding empire IDs.
 * @param tick - Game tick at which the organisation is being formed.
 * @param empires - All empires in the game (for initial voting power calculation).
 * @param diplomacyState - Current diplomacy state.
 * @returns The newly formed organisation.
 */
export function formOrganisation(
  name: string,
  founderEmpires: [string, string],
  tick: number,
  empires: Empire[],
  diplomacyState: DiplomacyState,
): GalacticOrganisation {
  const memberEmpires = [...founderEmpires];

  // Calculate initial voting power for both founders.
  const votingPower: Record<string, number> = {};
  for (const memberId of memberEmpires) {
    const empire = empires.find((e) => e.id === memberId);
    if (empire) {
      votingPower[memberId] = calculateVotingPower(
        empire,
        empires,
        diplomacyState,
        memberEmpires,
      );
    }
  }

  return {
    id: generateId(),
    name,
    formedTick: tick,
    founderEmpires: [...founderEmpires] as [string, string],
    memberEmpires,
    votingPower,
    resolutions: [],
    reserveCurrency: false,
    hasOwnMarket: false,
    maturityTick: tick + BINDING_MATURITY_TICKS,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Find which organisation an empire currently belongs to, if any.
 *
 * @param state - Current organisation state.
 * @param empireId - The empire to look up.
 * @returns The organisation the empire belongs to, or `undefined` if none.
 */
export function getEmpireOrganisation(
  state: GalacticOrganisationState,
  empireId: string,
): GalacticOrganisation | undefined {
  return state.organisations.find((org) =>
    org.memberEmpires.includes(empireId),
  );
}

// ---------------------------------------------------------------------------
// Voting power
// ---------------------------------------------------------------------------

/**
 * Calculate an empire's voting power within an organisation.
 *
 * Weights:
 *  - Economic strength:      30% (credits * economy trait)
 *  - Military power:         20% (combat trait as proxy)
 *  - Diplomatic reputation:  25% (average attitude from others)
 *  - Population proxy:       15% (known systems as proxy)
 *  - Declared intentions:    10% (alignment with organisation members)
 *
 * Returns a value between 1 and 100.
 *
 * @param empire - The empire whose voting power is being calculated.
 * @param allEmpires - All empires in the game (for normalisation).
 * @param diplomacyState - Current diplomacy state.
 * @param memberEmpires - Optional list of organisation member IDs (defaults to allEmpires).
 * @returns Normalised voting power (1-100).
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
  const economicValues = allEmpires.map(
    (e) => e.credits * (e.species.traits.economy / 5),
  );
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
  const intentionsScore = intentionsAlignmentScore(
    empire.id,
    members,
    diplomacyState,
  );

  const raw =
    economicScore * WEIGHT_ECONOMY +
    militaryScore * WEIGHT_MILITARY +
    repScore * WEIGHT_REPUTATION +
    populationScore * WEIGHT_POPULATION +
    intentionsScore * WEIGHT_INTENTIONS;

  return clamp(Math.round(raw * 100), 1, 100);
}

// ---------------------------------------------------------------------------
// Resolutions & voting
// ---------------------------------------------------------------------------

/**
 * Propose a new resolution to a galactic organisation.
 *
 * Only organisation members may propose resolutions. Binding resolutions
 * are only permitted once the organisation has matured (100+ ticks since
 * formation).
 *
 * @param org - Current organisation state.
 * @param proposer - Empire ID of the proposer.
 * @param title - Short title for the resolution.
 * @param description - Full description of the resolution.
 * @param type - Whether the resolution is advisory or binding.
 * @param tick - Current game tick.
 * @returns Updated organisation with the new resolution added, or unchanged if invalid.
 */
export function proposeResolution(
  org: GalacticOrganisation,
  proposer: string,
  title: string,
  description: string,
  type: ResolutionType,
  tick: number,
): GalacticOrganisation {
  if (!org.memberEmpires.includes(proposer)) return org;

  // Enforce maturity requirement for binding resolutions.
  if (type === 'binding' && tick < org.maturityTick) {
    return org;
  }

  // Enforce maximum active resolutions.
  const activeCount = org.resolutions.filter(
    (r) =>
      Object.keys(r.votes).length < org.memberEmpires.length && !r.passed,
  ).length;
  if (activeCount >= MAX_ACTIVE_RESOLUTIONS) return org;

  const next = copyOrganisation(org);

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
 * Cast a vote on an open organisation resolution.
 *
 * Only organisation members may vote. Each member may vote once per resolution.
 *
 * @param org - Current organisation state.
 * @param resolutionId - ID of the resolution to vote on.
 * @param empireId - Empire casting the vote.
 * @param vote - The vote choice.
 * @returns Updated organisation state.
 */
export function voteOnResolution(
  org: GalacticOrganisation,
  resolutionId: string,
  empireId: string,
  vote: VoteChoice,
): GalacticOrganisation {
  if (!org.memberEmpires.includes(empireId)) return org;

  const next = copyOrganisation(org);
  const resolution = next.resolutions.find((r) => r.id === resolutionId);
  if (!resolution) return org;

  // Already voted.
  if (resolution.votes[empireId] !== undefined) return org;

  resolution.votes[empireId] = vote;
  return next;
}

/**
 * Resolve the outcome of an organisation vote.
 *
 * A resolution passes if the weighted "for" votes exceed the weighted
 * "against" votes. Abstentions contribute no weight. The resolution's
 * `passed` field is updated accordingly.
 *
 * @param org - Current organisation state.
 * @param resolutionId - ID of the resolution to resolve.
 * @returns Updated organisation, whether the resolution passed, and events.
 */
export function resolveVote(
  org: GalacticOrganisation,
  resolutionId: string,
): {
  organisation: GalacticOrganisation;
  passed: boolean;
  events: OrganisationEvent[];
} {
  const events: OrganisationEvent[] = [];

  const next = copyOrganisation(org);
  const resolution = next.resolutions.find((r) => r.id === resolutionId);
  if (!resolution) return { organisation: org, passed: false, events };

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
      ? `${next.name} resolution "${resolution.title}" has passed (${weightFor} for / ${weightAgainst} against).`
      : `${next.name} resolution "${resolution.title}" has failed (${weightFor} for / ${weightAgainst} against).`,
    involvedEmpires: [...next.memberEmpires],
    organisationId: next.id,
  });

  return { organisation: next, passed, events };
}

// ---------------------------------------------------------------------------
// Membership management
// ---------------------------------------------------------------------------

/**
 * Remove an empire from a galactic organisation.
 *
 * Leaving the organisation forfeits voting power and removes the empire
 * from all ongoing votes.
 *
 * @param state - Current organisation state (all organisations).
 * @param empireId - Empire leaving the organisation.
 * @param tick - Current game tick.
 * @returns Updated organisation state and events.
 */
export function leaveOrganisation(
  state: GalacticOrganisationState,
  empireId: string,
  tick: number,
): { state: GalacticOrganisationState; events: OrganisationEvent[] } {
  const events: OrganisationEvent[] = [];
  const next = copyState(state);

  const orgIndex = next.organisations.findIndex((org) =>
    org.memberEmpires.includes(empireId),
  );
  if (orgIndex === -1) return { state, events };

  const org = next.organisations[orgIndex];

  org.memberEmpires = org.memberEmpires.filter((id) => id !== empireId);
  delete org.votingPower[empireId];

  // Remove this empire's votes from all unresolved resolutions.
  for (const resolution of org.resolutions) {
    delete resolution.votes[empireId];
  }

  events.push({
    type: 'member_left',
    tick,
    description: `Empire ${empireId} has left ${org.name}.`,
    involvedEmpires: [empireId, ...org.memberEmpires],
    organisationId: org.id,
  });

  // If the organisation has fewer than 2 members, dissolve it.
  if (org.memberEmpires.length < FORMATION_MEMBER_COUNT) {
    next.organisations.splice(orgIndex, 1);
  }

  return { state: next, events };
}

/**
 * Transfer an empire's membership from one organisation to another.
 *
 * The empire leaves the source organisation and joins the target organisation
 * in a single atomic operation.
 *
 * @param state - Current organisation state (all organisations).
 * @param empireId - Empire transferring membership.
 * @param fromOrgId - Organisation ID the empire is leaving.
 * @param toOrgId - Organisation ID the empire is joining.
 * @param tick - Current game tick.
 * @returns Updated organisation state and events.
 */
export function transferMembership(
  state: GalacticOrganisationState,
  empireId: string,
  fromOrgId: string,
  toOrgId: string,
  tick: number,
): { state: GalacticOrganisationState; events: OrganisationEvent[] } {
  const events: OrganisationEvent[] = [];

  if (fromOrgId === toOrgId) return { state, events };

  const fromOrg = state.organisations.find((o) => o.id === fromOrgId);
  const toOrg = state.organisations.find((o) => o.id === toOrgId);

  if (!fromOrg || !toOrg) return { state, events };
  if (!fromOrg.memberEmpires.includes(empireId)) return { state, events };
  if (toOrg.memberEmpires.includes(empireId)) return { state, events };

  // First, leave the current organisation.
  const leaveResult = leaveOrganisation(state, empireId, tick);
  const next = copyState(leaveResult.state);
  events.push(...leaveResult.events);

  // Then join the target organisation.
  const targetOrg = next.organisations.find((o) => o.id === toOrgId);
  if (!targetOrg) return { state: next, events };

  targetOrg.memberEmpires.push(empireId);

  events.push({
    type: 'member_transferred',
    tick,
    description: `Empire ${empireId} has transferred from ${fromOrg.name} to ${toOrg.name}.`,
    involvedEmpires: [empireId, ...targetOrg.memberEmpires],
    organisationId: toOrgId,
  });

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

/**
 * Merge two galactic organisations into a single new organisation.
 *
 * All members of both organisations become members of the merged entity.
 * Active resolutions from both organisations are carried over. The merged
 * organisation's maturity tick is set to the earlier of the two source
 * organisations' maturity ticks (preserving the most mature timeline).
 *
 * @param state - Current organisation state (all organisations).
 * @param org1Id - First organisation to merge.
 * @param org2Id - Second organisation to merge.
 * @param newName - Name for the merged organisation.
 * @param tick - Current game tick.
 * @param empires - All empires in the game (for voting power recalculation).
 * @param diplomacyState - Current diplomacy state.
 * @returns Updated organisation state and events.
 */
export function mergeOrganisations(
  state: GalacticOrganisationState,
  org1Id: string,
  org2Id: string,
  newName: string,
  tick: number,
  empires: Empire[],
  diplomacyState: DiplomacyState,
): { state: GalacticOrganisationState; events: OrganisationEvent[] } {
  const events: OrganisationEvent[] = [];

  if (org1Id === org2Id) return { state, events };

  const org1 = state.organisations.find((o) => o.id === org1Id);
  const org2 = state.organisations.find((o) => o.id === org2Id);

  if (!org1 || !org2) return { state, events };

  // Combine member lists (no duplicates expected due to one-org-per-empire rule).
  const allMembers = [
    ...new Set([...org1.memberEmpires, ...org2.memberEmpires]),
  ];

  // Use the earlier maturity tick (more mature organisation wins).
  const maturityTick = Math.min(org1.maturityTick, org2.maturityTick);

  // Preserve founders from the older organisation.
  const olderOrg =
    org1.formedTick <= org2.formedTick ? org1 : org2;

  // Carry over resolutions from both organisations.
  const combinedResolutions = [
    ...org1.resolutions.map((r) => ({ ...r, votes: { ...r.votes } })),
    ...org2.resolutions.map((r) => ({ ...r, votes: { ...r.votes } })),
  ];

  // Create the merged organisation.
  const merged: GalacticOrganisation = {
    id: generateId(),
    name: newName,
    formedTick: Math.min(org1.formedTick, org2.formedTick),
    founderEmpires: [...olderOrg.founderEmpires] as [string, string],
    memberEmpires: allMembers,
    votingPower: {},
    resolutions: combinedResolutions,
    reserveCurrency: org1.reserveCurrency || org2.reserveCurrency,
    hasOwnMarket: org1.hasOwnMarket || org2.hasOwnMarket,
    maturityTick,
  };

  // Recalculate voting power for all members.
  for (const memberId of allMembers) {
    const empire = empires.find((e) => e.id === memberId);
    if (empire) {
      merged.votingPower[memberId] = calculateVotingPower(
        empire,
        empires,
        diplomacyState,
        allMembers,
      );
    }
  }

  // Build new state: remove the two source orgs, add the merged one.
  const next = copyState(state);
  next.organisations = next.organisations.filter(
    (o) => o.id !== org1Id && o.id !== org2Id,
  );
  next.organisations.push(merged);

  events.push({
    type: 'organisations_merged',
    tick,
    description: `${org1.name} and ${org2.name} have merged to form ${newName}.`,
    involvedEmpires: allMembers,
    organisationId: merged.id,
  });

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// Per-tick processing
// ---------------------------------------------------------------------------

/**
 * Process one game tick for ALL galactic organisations.
 *
 * Per organisation per tick:
 *  1. Check for new empires eligible to join (have mutual contact with a
 *     member AND are not in any other organisation).
 *  2. Auto-resolve votes whose voting window has expired.
 *  3. Recalculate voting power for all members.
 *  4. Check for maturity milestones (binding resolutions unlock).
 *
 * @param state - Current organisation state (all organisations).
 * @param empires - All empires in the game.
 * @param diplomacyState - Current diplomacy state.
 * @param tick - Current game tick.
 * @returns Updated state and any events generated.
 */
export function processOrganisationTick(
  state: GalacticOrganisationState,
  empires: Empire[],
  diplomacyState: DiplomacyState,
  tick: number,
): { state: GalacticOrganisationState; events: OrganisationEvent[] } {
  if (state.organisations.length === 0) return { state, events: [] };

  let next = copyState(state);
  const events: OrganisationEvent[] = [];

  const allEmpireIds = empires.map((e) => e.id);

  for (let orgIdx = 0; orgIdx < next.organisations.length; orgIdx++) {
    let org = next.organisations[orgIdx];

    // 1. Check for new member eligibility.
    for (const empireId of allEmpireIds) {
      if (org.memberEmpires.includes(empireId)) continue;

      // An empire is eligible if:
      //  (a) it has mutual contact with any current member, AND
      //  (b) it does not already belong to another organisation.
      const alreadyInOrg = next.organisations.some(
        (o) => o.memberEmpires.includes(empireId),
      );
      if (alreadyInOrg) continue;

      let eligible = false;
      for (const memberId of org.memberEmpires) {
        if (haveMutualContact(empireId, memberId, diplomacyState)) {
          eligible = true;
          break;
        }
      }

      if (eligible) {
        org.memberEmpires.push(empireId);
        const empire = empires.find((e) => e.id === empireId);
        events.push({
          type: 'member_joined',
          tick,
          description: `${empire?.name ?? empireId} has joined ${org.name}.`,
          involvedEmpires: [...org.memberEmpires],
          organisationId: org.id,
        });
      }
    }

    // 2. Auto-resolve votes that have exceeded their voting window.
    for (const resolution of org.resolutions) {
      const age = tick - resolution.tick;
      const allVoted = org.memberEmpires.every(
        (id) => resolution.votes[id] !== undefined,
      );

      if (allVoted || age >= VOTING_WINDOW_TICKS) {
        const totalVotes = Object.keys(resolution.votes).length;
        if (totalVotes === 0 && age < VOTING_WINDOW_TICKS) continue;

        if (allVoted || age === VOTING_WINDOW_TICKS) {
          const result = resolveVote(org, resolution.id);
          org = result.organisation;
          next.organisations[orgIdx] = org;
          events.push(...result.events);
        }
      }
    }

    // 3. Recalculate voting power for all members.
    for (const memberId of org.memberEmpires) {
      const empire = empires.find((e) => e.id === memberId);
      if (empire) {
        org.votingPower[memberId] = calculateVotingPower(
          empire,
          empires,
          diplomacyState,
          org.memberEmpires,
        );
      }
    }

    // 4. Check maturity milestone: binding resolutions become available.
    if (tick === org.maturityTick) {
      events.push({
        type: 'binding_unlocked',
        tick,
        description: `${org.name} has matured — binding resolutions are now permitted.`,
        involvedEmpires: [...org.memberEmpires],
        organisationId: org.id,
      });
    }

    next.organisations[orgIdx] = org;
  }

  return { state: next, events };
}

// ---------------------------------------------------------------------------
// State constructors
// ---------------------------------------------------------------------------

/**
 * Create a default (empty) organisation state with no organisations.
 *
 * @returns An empty GalacticOrganisationState.
 */
export function createEmptyOrganisationState(): GalacticOrganisationState {
  return {
    organisations: [],
  };
}

// ---------------------------------------------------------------------------
// Backwards-compatible aliases (deprecated)
// ---------------------------------------------------------------------------

// Re-export the old GalacticCouncil type for consumers that still import it.
export type { GalacticCouncil, GalacticBloc } from '../types/diplomacy.js';

/**
 * Create a default (unformed) council state.
 *
 * @deprecated Use {@link createEmptyOrganisationState} instead.
 * @returns An empty GalacticCouncil.
 */
export function createEmptyCouncil(): import('../types/diplomacy.js').GalacticCouncil {
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
