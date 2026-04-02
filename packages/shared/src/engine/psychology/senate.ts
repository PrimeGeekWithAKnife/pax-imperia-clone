/**
 * Galactic Senate Engine
 *
 * Extends the galactic organisation system with:
 *  - Leadership elections (nominations, voting, term limits)
 *  - Membership approval (sponsor + vote, not auto-join)
 *  - Psychology-driven AI voting decisions
 *  - Senate actions generating relationship events
 *  - Sanctions as diplomatic tools
 *
 * All functions are pure and return new state objects.
 */

import type {
  GalacticOrganisation,
  SenateState,
  OrganisationLeadership,
  MembershipApplication,
  LeadershipElection,
  VoteChoice,
} from '../../types/diplomacy.js';
import type {
  EmpirePsychologicalState,
  RolledPersonality,
  MaslowNeeds,
} from '../../types/psychology.js';
import type { PsychRelationship, RelationshipEventType } from '../../types/diplomacy-v2.js';
import { generateId } from '../../utils/id.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default leadership term length in ticks. */
const DEFAULT_TERM_LENGTH = 200;

/** Ticks an application remains open for voting. */
const APPLICATION_VOTING_WINDOW = 20;

/** Ticks an election remains open for voting. */
const ELECTION_VOTING_WINDOW = 15;

/** Minimum members needed to hold a leadership election. */
const MIN_ELECTION_MEMBERS = 3;

// ---------------------------------------------------------------------------
// Senate state creation
// ---------------------------------------------------------------------------

/** Create initial senate state for a newly formed organisation. */
export function createSenateState(): SenateState {
  return {
    leadership: {
      leaderEmpireId: null,
      electedTick: 0,
      termLength: DEFAULT_TERM_LENGTH,
      termExpiresTick: 0,
    },
    pendingApplications: [],
    currentElection: null,
    leaderHistory: [],
  };
}

// ---------------------------------------------------------------------------
// Membership applications
// ---------------------------------------------------------------------------

/**
 * Submit a membership application to an organisation.
 * Requires a sponsor who is already a member.
 */
export function submitMembershipApplication(
  senate: SenateState,
  applicantEmpireId: string,
  sponsorEmpireId: string,
  memberEmpires: string[],
  currentTick: number,
): { senate: SenateState; application: MembershipApplication | null } {
  // Sponsor must be a member
  if (!memberEmpires.includes(sponsorEmpireId)) {
    return { senate, application: null };
  }

  // Applicant must not already be a member
  if (memberEmpires.includes(applicantEmpireId)) {
    return { senate, application: null };
  }

  // No duplicate pending applications
  if (senate.pendingApplications.some(a => a.applicantEmpireId === applicantEmpireId && !a.resolved)) {
    return { senate, application: null };
  }

  const application: MembershipApplication = {
    id: generateId(),
    applicantEmpireId,
    sponsorEmpireId,
    votes: { [sponsorEmpireId]: 'for' }, // Sponsor auto-votes for
    submittedTick: currentTick,
    resolved: false,
    approved: false,
  };

  return {
    senate: {
      ...senate,
      pendingApplications: [...senate.pendingApplications, application],
    },
    application,
  };
}

/**
 * Cast a vote on a membership application.
 */
export function voteOnApplication(
  senate: SenateState,
  applicationId: string,
  voterId: string,
  vote: VoteChoice,
  memberEmpires: string[],
): SenateState {
  if (!memberEmpires.includes(voterId)) return senate;

  const appIndex = senate.pendingApplications.findIndex(a => a.id === applicationId);
  if (appIndex === -1) return senate;

  const app = senate.pendingApplications[appIndex];
  if (app.resolved) return senate;
  if (app.votes[voterId] !== undefined) return senate;

  const updatedApp = { ...app, votes: { ...app.votes, [voterId]: vote } };
  const updatedApps = [...senate.pendingApplications];
  updatedApps[appIndex] = updatedApp;

  return { ...senate, pendingApplications: updatedApps };
}

/**
 * Resolve a membership application.
 * Requires majority 'for' votes from existing members.
 */
export function resolveApplication(
  senate: SenateState,
  applicationId: string,
  memberEmpires: string[],
  votingPower: Record<string, number>,
): { senate: SenateState; approved: boolean } {
  const appIndex = senate.pendingApplications.findIndex(a => a.id === applicationId);
  if (appIndex === -1) return { senate, approved: false };

  const app = senate.pendingApplications[appIndex];
  if (app.resolved) return { senate, approved: app.approved };

  // Weighted vote tally
  let weightFor = 0;
  let weightAgainst = 0;
  for (const [empireId, vote] of Object.entries(app.votes)) {
    const power = votingPower[empireId] ?? 1;
    if (vote === 'for') weightFor += power;
    if (vote === 'against') weightAgainst += power;
  }

  const approved = weightFor > weightAgainst;

  const updatedApp = { ...app, resolved: true, approved };
  const updatedApps = [...senate.pendingApplications];
  updatedApps[appIndex] = updatedApp;

  return {
    senate: { ...senate, pendingApplications: updatedApps },
    approved,
  };
}

// ---------------------------------------------------------------------------
// Leadership elections
// ---------------------------------------------------------------------------

/**
 * Start a leadership election. Any member may nominate themselves.
 */
export function startElection(
  senate: SenateState,
  candidates: string[],
  memberEmpires: string[],
  currentTick: number,
): SenateState {
  if (memberEmpires.length < MIN_ELECTION_MEMBERS) return senate;
  if (senate.currentElection && !senate.currentElection.resolved) return senate;

  // All candidates must be members
  const validCandidates = candidates.filter(c => memberEmpires.includes(c));
  if (validCandidates.length < 2) return senate;

  const election: LeadershipElection = {
    id: generateId(),
    candidates: validCandidates,
    votes: {},
    startedTick: currentTick,
    resolved: false,
    winnerId: null,
  };

  return { ...senate, currentElection: election };
}

/**
 * Cast a vote in a leadership election.
 * Each member votes for exactly one candidate.
 */
export function voteInElection(
  senate: SenateState,
  voterId: string,
  candidateId: string,
  memberEmpires: string[],
): SenateState {
  if (!senate.currentElection || senate.currentElection.resolved) return senate;
  if (!memberEmpires.includes(voterId)) return senate;
  if (!senate.currentElection.candidates.includes(candidateId)) return senate;
  if (senate.currentElection.votes[voterId] !== undefined) return senate;

  const election = {
    ...senate.currentElection,
    votes: { ...senate.currentElection.votes, [voterId]: candidateId },
  };

  return { ...senate, currentElection: election };
}

/**
 * Resolve a leadership election. Winner is the candidate with most weighted votes.
 */
export function resolveElection(
  senate: SenateState,
  votingPower: Record<string, number>,
): { senate: SenateState; winnerId: string | null } {
  if (!senate.currentElection || senate.currentElection.resolved) {
    return { senate, winnerId: null };
  }

  const election = senate.currentElection;

  // Tally weighted votes per candidate
  const tally: Record<string, number> = {};
  for (const candidateId of election.candidates) {
    tally[candidateId] = 0;
  }
  for (const [voterId, candidateId] of Object.entries(election.votes)) {
    tally[candidateId] = (tally[candidateId] ?? 0) + (votingPower[voterId] ?? 1);
  }

  // Find winner (highest tally)
  let winnerId: string | null = null;
  let maxVotes = 0;
  for (const [candidateId, votes] of Object.entries(tally)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      winnerId = candidateId;
    }
  }

  const resolvedElection = { ...election, resolved: true, winnerId };
  const currentTick = election.startedTick + ELECTION_VOTING_WINDOW;

  // Update leadership
  const oldLeader = senate.leadership.leaderEmpireId;
  const leaderHistory = oldLeader
    ? [...senate.leaderHistory, { empireId: oldLeader, fromTick: senate.leadership.electedTick, toTick: currentTick }]
    : senate.leaderHistory;

  const leadership: OrganisationLeadership = {
    leaderEmpireId: winnerId,
    electedTick: currentTick,
    termLength: DEFAULT_TERM_LENGTH,
    termExpiresTick: currentTick + DEFAULT_TERM_LENGTH,
  };

  return {
    senate: { ...senate, currentElection: resolvedElection, leadership, leaderHistory },
    winnerId,
  };
}

// ---------------------------------------------------------------------------
// Psychology-driven AI voting
// ---------------------------------------------------------------------------

/**
 * Determine how an AI empire would vote on a membership application.
 * Uses relationship with the applicant and personality.
 */
export function aiVoteOnMembership(
  voterState: EmpirePsychologicalState,
  applicantEmpireId: string,
): VoteChoice {
  const relationship = voterState.relationships[applicantEmpireId];
  const personality = voterState.personality;

  // No relationship → abstain (don't know them)
  if (!relationship) return 'abstain';

  // Hostile relationship → vote against
  if (relationship.warmth < -20 && relationship.trust < 30) return 'against';

  // Good relationship → vote for
  if (relationship.warmth > 20 && relationship.trust > 30) return 'for';

  // Personality-driven tiebreaker
  // High agreeableness → more likely to say yes
  if (personality.traits.agreeableness > 55) return 'for';
  // High openness → willing to give them a chance
  if (personality.traits.openness > 60) return 'for';
  // Low agreeableness → default to against
  if (personality.traits.agreeableness < 40) return 'against';

  return 'abstain';
}

/**
 * Determine how an AI empire would vote in a leadership election.
 * Votes for the candidate they have the best relationship with.
 */
export function aiVoteInElection(
  voterState: EmpirePsychologicalState,
  candidates: string[],
): string | null {
  if (candidates.length === 0) return null;

  // If voter is a candidate, vote for themselves (narcissism check)
  const selfId = voterState.personality.speciesId; // Approximate — empire ID would be better
  // In practice, we pass the empire ID from the caller

  let bestCandidate = candidates[0];
  let bestScore = -Infinity;

  for (const candidateId of candidates) {
    const rel = voterState.relationships[candidateId];
    if (!rel) continue;

    // Score: warmth * 0.3 + respect * 0.4 + trust * 0.3
    const score = rel.warmth * 0.3 + rel.respect * 0.4 + rel.trust * 0.3;

    // Personality modifier: narcissistic types favour candidates who respect them
    if (voterState.personality.darkTriad.narcissism > 30) {
      // Candidate who gives us more respect gets a boost
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidateId;
    }
  }

  return bestCandidate;
}

/**
 * Generate relationship events from senate actions.
 * Returns event types to apply to the actor-target relationship.
 */
export function senateRelationshipEvents(
  action: SenateAction,
): { targetEmpireId: string; eventType: RelationshipEventType }[] {
  const events: { targetEmpireId: string; eventType: RelationshipEventType }[] = [];

  switch (action.type) {
    case 'voted_for_membership':
      events.push({ targetEmpireId: action.targetEmpireId, eventType: 'praise_given' });
      break;
    case 'voted_against_membership':
      events.push({ targetEmpireId: action.targetEmpireId, eventType: 'insult' });
      break;
    case 'supported_for_leadership':
      events.push({ targetEmpireId: action.targetEmpireId, eventType: 'recognition_given' });
      break;
    case 'proposed_sanctions':
      events.push({ targetEmpireId: action.targetEmpireId, eventType: 'threat' });
      break;
    case 'sponsored_membership':
      events.push({ targetEmpireId: action.targetEmpireId, eventType: 'grand_gesture' });
      break;
  }

  return events;
}

/** Senate action types that affect relationships. */
export interface SenateAction {
  type:
    | 'voted_for_membership'
    | 'voted_against_membership'
    | 'supported_for_leadership'
    | 'proposed_sanctions'
    | 'sponsored_membership';
  actorEmpireId: string;
  targetEmpireId: string;
}

// ---------------------------------------------------------------------------
// Per-tick senate processing
// ---------------------------------------------------------------------------

/**
 * Process one senate tick for an organisation.
 *
 * 1. Auto-resolve expired membership applications
 * 2. Check for term expiry → trigger election
 * 3. Auto-resolve expired elections
 * 4. AI members cast pending votes
 */
export function processSenateTick(
  senate: SenateState,
  memberEmpires: string[],
  votingPower: Record<string, number>,
  currentTick: number,
  aiStates: Map<string, EmpirePsychologicalState>,
): {
  senate: SenateState;
  newMembers: string[];
  events: SenateTickEvent[];
} {
  let current = senate;
  const newMembers: string[] = [];
  const events: SenateTickEvent[] = [];

  // 1. AI members vote on pending applications
  for (const app of current.pendingApplications) {
    if (app.resolved) continue;
    for (const memberId of memberEmpires) {
      if (app.votes[memberId] !== undefined) continue;
      const aiState = aiStates.get(memberId);
      if (!aiState) continue;
      const vote = aiVoteOnMembership(aiState, app.applicantEmpireId);
      current = voteOnApplication(current, app.id, memberId, vote, memberEmpires);
    }
  }

  // 2. Resolve applications past voting window or fully voted
  for (const app of current.pendingApplications) {
    if (app.resolved) continue;
    const age = currentTick - app.submittedTick;
    const allVoted = memberEmpires.every(id => app.votes[id] !== undefined);

    if (allVoted || age >= APPLICATION_VOTING_WINDOW) {
      const result = resolveApplication(current, app.id, memberEmpires, votingPower);
      current = result.senate;
      if (result.approved) {
        newMembers.push(app.applicantEmpireId);
        events.push({
          type: 'membership_approved',
          empireId: app.applicantEmpireId,
          tick: currentTick,
        });
      } else {
        events.push({
          type: 'membership_rejected',
          empireId: app.applicantEmpireId,
          tick: currentTick,
        });
      }
    }
  }

  // 3. Check term expiry → start election
  if (current.leadership.leaderEmpireId !== null
    && currentTick >= current.leadership.termExpiresTick
    && (!current.currentElection || current.currentElection.resolved)
    && memberEmpires.length >= MIN_ELECTION_MEMBERS) {
    // All members are candidates by default
    current = startElection(current, memberEmpires, memberEmpires, currentTick);
    events.push({ type: 'election_started', empireId: '', tick: currentTick });
  }

  // 4. AI members vote in active election
  const activeElection = current.currentElection;
  if (activeElection && !activeElection.resolved) {
    for (const memberId of memberEmpires) {
      if (activeElection.votes[memberId] !== undefined) continue;
      const aiState = aiStates.get(memberId);
      if (!aiState) continue;

      // Self-vote
      if (activeElection.candidates.includes(memberId)) {
        current = voteInElection(current, memberId, memberId, memberEmpires);
      } else {
        const choice = aiVoteInElection(aiState, activeElection.candidates);
        if (choice) {
          current = voteInElection(current, memberId, choice, memberEmpires);
        }
      }
    }

    // Resolve election if voting window expired or all voted
    const electionAge = currentTick - activeElection.startedTick;
    const allElectionVoted = memberEmpires.every(id => activeElection.votes[id] !== undefined);
    if (allElectionVoted || electionAge >= ELECTION_VOTING_WINDOW) {
      const result = resolveElection(current, votingPower);
      current = result.senate;
      if (result.winnerId) {
        events.push({
          type: 'leader_elected',
          empireId: result.winnerId,
          tick: currentTick,
        });
      }
    }
  }

  // 5. If no leader and enough members, start first election
  if (current.leadership.leaderEmpireId === null
    && memberEmpires.length >= MIN_ELECTION_MEMBERS
    && (!current.currentElection || current.currentElection.resolved)) {
    current = startElection(current, memberEmpires, memberEmpires, currentTick);
    events.push({ type: 'election_started', empireId: '', tick: currentTick });
  }

  // Clean up resolved applications older than 100 ticks
  current = {
    ...current,
    pendingApplications: current.pendingApplications.filter(
      a => !a.resolved || (currentTick - a.submittedTick) < 100,
    ),
  };

  return { senate: current, newMembers, events };
}

/** Event types from senate processing. */
export interface SenateTickEvent {
  type: 'membership_approved' | 'membership_rejected' | 'election_started' | 'leader_elected';
  empireId: string;
  tick: number;
}
