import { describe, it, expect } from 'vitest';
import {
  createSenateState,
  submitMembershipApplication,
  voteOnApplication,
  resolveApplication,
  startElection,
  voteInElection,
  resolveElection,
  aiVoteOnMembership,
  aiVoteInElection,
  senateRelationshipEvents,
  processSenateTick,
} from '../../engine/psychology/senate.js';
import { initPsychologicalState } from '../../engine/psychology/tick.js';
import { createRelationship } from '../../engine/psychology/relationship.js';
import { rollPersonality } from '../../engine/psychology/personality.js';
import { SPECIES_PERSONALITIES_BY_ID, AFFINITY_MATRIX } from '../../../data/species/personality/index.js';
import type { SenateState } from '../../types/diplomacy.js';
import type { EmpirePsychologicalState } from '../../types/psychology.js';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const teranos = rollPersonality(SPECIES_PERSONALITIES_BY_ID['teranos'], 'normal', seededRng(42));
const sylvani = rollPersonality(SPECIES_PERSONALITIES_BY_ID['sylvani'], 'normal', seededRng(43));
const khazari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['khazari'], 'normal', seededRng(45));

const MEMBERS = ['empire-1', 'empire-2', 'empire-3'];
const VOTING_POWER: Record<string, number> = { 'empire-1': 40, 'empire-2': 35, 'empire-3': 25 };

describe('createSenateState', () => {
  it('should create empty senate state', () => {
    const state = createSenateState();
    expect(state.leadership.leaderEmpireId).toBeNull();
    expect(state.pendingApplications).toHaveLength(0);
    expect(state.currentElection).toBeNull();
    expect(state.leaderHistory).toHaveLength(0);
  });
});

describe('membership applications', () => {
  it('should submit application with sponsor auto-vote', () => {
    const senate = createSenateState();
    const { senate: updated, application } = submitMembershipApplication(
      senate, 'empire-4', 'empire-1', MEMBERS, 100,
    );
    expect(application).not.toBeNull();
    expect(updated.pendingApplications).toHaveLength(1);
    expect(updated.pendingApplications[0].votes['empire-1']).toBe('for');
  });

  it('should reject application from non-member sponsor', () => {
    const senate = createSenateState();
    const { application } = submitMembershipApplication(
      senate, 'empire-4', 'empire-5', MEMBERS, 100,
    );
    expect(application).toBeNull();
  });

  it('should reject duplicate applications', () => {
    const senate = createSenateState();
    const { senate: s1 } = submitMembershipApplication(senate, 'empire-4', 'empire-1', MEMBERS, 100);
    const { application } = submitMembershipApplication(s1, 'empire-4', 'empire-2', MEMBERS, 101);
    expect(application).toBeNull();
  });

  it('should allow voting on application', () => {
    const senate = createSenateState();
    const { senate: s1, application } = submitMembershipApplication(senate, 'empire-4', 'empire-1', MEMBERS, 100);
    const s2 = voteOnApplication(s1, application!.id, 'empire-2', 'for', MEMBERS);
    expect(s2.pendingApplications[0].votes['empire-2']).toBe('for');
  });

  it('should resolve application with majority', () => {
    const senate = createSenateState();
    const { senate: s1, application } = submitMembershipApplication(senate, 'empire-4', 'empire-1', MEMBERS, 100);
    const s2 = voteOnApplication(s1, application!.id, 'empire-2', 'for', MEMBERS);
    const { senate: s3, approved } = resolveApplication(s2, application!.id, MEMBERS, VOTING_POWER);
    // empire-1 (40) + empire-2 (35) = 75 for > 0 against
    expect(approved).toBe(true);
  });

  it('should reject application with majority against', () => {
    const senate = createSenateState();
    const { senate: s1, application } = submitMembershipApplication(senate, 'empire-4', 'empire-1', MEMBERS, 100);
    const s2 = voteOnApplication(s1, application!.id, 'empire-2', 'against', MEMBERS);
    const s3 = voteOnApplication(s2, application!.id, 'empire-3', 'against', MEMBERS);
    const { approved } = resolveApplication(s3, application!.id, MEMBERS, VOTING_POWER);
    // empire-1 (40) for vs empire-2 (35) + empire-3 (25) = 60 against
    expect(approved).toBe(false);
  });
});

describe('leadership elections', () => {
  it('should not start election with fewer than 3 members', () => {
    const senate = createSenateState();
    const result = startElection(senate, ['e1', 'e2'], ['e1', 'e2'], 100);
    expect(result.currentElection).toBeNull();
  });

  it('should start election with valid candidates', () => {
    const senate = createSenateState();
    const result = startElection(senate, MEMBERS, MEMBERS, 100);
    expect(result.currentElection).not.toBeNull();
    expect(result.currentElection!.candidates).toHaveLength(3);
    expect(result.currentElection!.resolved).toBe(false);
  });

  it('should allow voting', () => {
    let senate = createSenateState();
    senate = startElection(senate, MEMBERS, MEMBERS, 100);
    senate = voteInElection(senate, 'empire-1', 'empire-2', MEMBERS);
    expect(senate.currentElection!.votes['empire-1']).toBe('empire-2');
  });

  it('should resolve election with highest weighted votes', () => {
    let senate = createSenateState();
    senate = startElection(senate, MEMBERS, MEMBERS, 100);
    senate = voteInElection(senate, 'empire-1', 'empire-2', MEMBERS); // 40 → e2
    senate = voteInElection(senate, 'empire-2', 'empire-2', MEMBERS); // 35 → e2
    senate = voteInElection(senate, 'empire-3', 'empire-1', MEMBERS); // 25 → e1
    const { senate: resolved, winnerId } = resolveElection(senate, VOTING_POWER);
    expect(winnerId).toBe('empire-2'); // 75 > 25
    expect(resolved.leadership.leaderEmpireId).toBe('empire-2');
  });

  it('should record leader history on new election', () => {
    let senate = createSenateState();
    // Set up an existing leader
    senate = {
      ...senate,
      leadership: {
        leaderEmpireId: 'empire-1',
        electedTick: 0,
        termLength: 200,
        termExpiresTick: 200,
      },
    };
    senate = startElection(senate, MEMBERS, MEMBERS, 200);
    senate = voteInElection(senate, 'empire-1', 'empire-2', MEMBERS);
    senate = voteInElection(senate, 'empire-2', 'empire-2', MEMBERS);
    senate = voteInElection(senate, 'empire-3', 'empire-2', MEMBERS);
    const { senate: resolved } = resolveElection(senate, VOTING_POWER);
    expect(resolved.leaderHistory).toHaveLength(1);
    expect(resolved.leaderHistory[0].empireId).toBe('empire-1');
  });
});

describe('AI voting', () => {
  it('should vote for membership of empire with good relationship', () => {
    const state = initPsychologicalState(teranos);
    const rel = createRelationship('e-applicant', teranos, sylvani, AFFINITY_MATRIX, 0);
    const withRel: EmpirePsychologicalState = {
      ...state,
      relationships: { 'e-applicant': { ...rel, warmth: 40, trust: 50 } },
    };
    expect(aiVoteOnMembership(withRel, 'e-applicant')).toBe('for');
  });

  it('should vote against membership of hostile empire', () => {
    const state = initPsychologicalState(khazari);
    const rel = createRelationship('e-applicant', khazari, sylvani, AFFINITY_MATRIX, 0);
    const withRel: EmpirePsychologicalState = {
      ...state,
      relationships: { 'e-applicant': { ...rel, warmth: -40, trust: 15 } },
    };
    expect(aiVoteOnMembership(withRel, 'e-applicant')).toBe('against');
  });

  it('should abstain on membership of unknown empire', () => {
    const state = initPsychologicalState(teranos);
    expect(aiVoteOnMembership(state, 'unknown-empire')).toBe('abstain');
  });

  it('should vote for best relationship candidate in election', () => {
    const state = initPsychologicalState(teranos);
    const rel1 = { ...createRelationship('c1', teranos, sylvani, AFFINITY_MATRIX, 0), warmth: 60, respect: 50, trust: 70 };
    const rel2 = { ...createRelationship('c2', teranos, khazari, AFFINITY_MATRIX, 0), warmth: -10, respect: 20, trust: 30 };
    const withRels: EmpirePsychologicalState = {
      ...state,
      relationships: { 'c1': rel1, 'c2': rel2 },
    };
    expect(aiVoteInElection(withRels, ['c1', 'c2'])).toBe('c1');
  });
});

describe('senateRelationshipEvents', () => {
  it('should generate praise for membership approval vote', () => {
    const events = senateRelationshipEvents({
      type: 'voted_for_membership',
      actorEmpireId: 'e1',
      targetEmpireId: 'e2',
    });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('praise_given');
  });

  it('should generate insult for membership rejection vote', () => {
    const events = senateRelationshipEvents({
      type: 'voted_against_membership',
      actorEmpireId: 'e1',
      targetEmpireId: 'e2',
    });
    expect(events[0].eventType).toBe('insult');
  });

  it('should generate grand gesture for sponsorship', () => {
    const events = senateRelationshipEvents({
      type: 'sponsored_membership',
      actorEmpireId: 'e1',
      targetEmpireId: 'e2',
    });
    expect(events[0].eventType).toBe('grand_gesture');
  });
});

describe('processSenateTick', () => {
  it('should trigger election when enough members and no leader', () => {
    const senate = createSenateState();
    const aiStates = new Map<string, EmpirePsychologicalState>();
    for (const id of MEMBERS) {
      const p = rollPersonality(SPECIES_PERSONALITIES_BY_ID['teranos'], 'normal', seededRng(42));
      const state = initPsychologicalState(p);
      // Add relationships between all members
      const rels: Record<string, any> = {};
      for (const otherId of MEMBERS) {
        if (otherId === id) continue;
        rels[otherId] = createRelationship(otherId, p, teranos, AFFINITY_MATRIX, 0);
      }
      aiStates.set(id, { ...state, relationships: rels });
    }

    const { senate: updated, events } = processSenateTick(
      senate, MEMBERS, VOTING_POWER, 100, aiStates,
    );
    expect(events.some(e => e.type === 'election_started')).toBe(true);
  });

  it('should process membership application through to resolution', () => {
    let senate = createSenateState();
    const { senate: withApp } = submitMembershipApplication(
      senate, 'empire-4', 'empire-1', MEMBERS, 0,
    );

    const aiStates = new Map<string, EmpirePsychologicalState>();
    for (const id of MEMBERS) {
      const p = rollPersonality(SPECIES_PERSONALITIES_BY_ID['sylvani'], 'normal', seededRng(42));
      const state = initPsychologicalState(p);
      // Give good relationship with applicant so AI votes 'for'
      const rel = createRelationship('empire-4', p, teranos, AFFINITY_MATRIX, 0);
      aiStates.set(id, { ...state, relationships: { 'empire-4': { ...rel, warmth: 40, trust: 50 } } });
    }

    const { newMembers, events } = processSenateTick(
      withApp, MEMBERS, VOTING_POWER, 25, aiStates,
    );

    // Application should be resolved (voting window is 20 ticks, submitted at 0, now at 25)
    const approvedEvent = events.find(e => e.type === 'membership_approved');
    expect(approvedEvent).toBeDefined();
    expect(newMembers).toContain('empire-4');
  });
});
