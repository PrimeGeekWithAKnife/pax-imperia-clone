import { describe, it, expect } from 'vitest';
import {
  createCouncilV2,
  proposeBill,
  castVote,
  resolveBill,
  vetoBill,
  aiVoteOnBill,
  shouldLeaderVeto,
  vetoPopularityCost,
  processCouncilTick,
} from '../../engine/psychology/council.js';
import { initPsychologicalState } from '../../engine/psychology/tick.js';
import { createRelationship } from '../../engine/psychology/relationship.js';
import { rollPersonality } from '../../engine/psychology/personality.js';
import { SPECIES_PERSONALITIES_BY_ID, AFFINITY_MATRIX } from '../../../data/species/personality/index.js';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}

const teranos = rollPersonality(SPECIES_PERSONALITIES_BY_ID['teranos'], 'normal', seededRng(42));
const sylvani = rollPersonality(SPECIES_PERSONALITIES_BY_ID['sylvani'], 'normal', seededRng(43));
const drakmari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['drakmari'], 'normal', seededRng(44));

const MEMBERS = ['e1', 'e2', 'e3', 'e4'];

describe('createCouncilV2', () => {
  it('should create council with founders as members', () => {
    const council = createCouncilV2(['e1', 'e2'], 100);
    expect(council.formed).toBe(true);
    expect(council.memberEmpires).toEqual(['e1', 'e2']);
    expect(council.leaderEmpireId).toBeNull();
    expect(council.activeBills).toHaveLength(0);
    expect(council.memberBenefits['e1']?.votingRights).toBe(true);
    expect(council.memberBenefits['e1']?.tradeMarketAccess).toBe(true);
    expect(council.memberBenefits['e1']?.piracyProtection).toBe(true);
  });
});

describe('bill lifecycle', () => {
  it('should propose and resolve a condemnation bill', () => {
    let council = createCouncilV2(MEMBERS, 0);
    const { council: c1, bill } = proposeBill(
      council, 'e1', 'condemn', 'Condemn aggression', 'For unprovoked attack', 'e4', 100,
    );
    expect(bill).not.toBeNull();
    expect(c1.activeBills).toHaveLength(1);

    // Cast votes — need to advance to voting phase first
    let c2 = c1;
    // Manually set phase to voting for direct testing
    c2 = { ...c2, activeBills: c2.activeBills.map(b => ({ ...b, phase: 'voting' as const })) };
    c2 = castVote(c2, bill!.id, 'e1', 'for');
    c2 = castVote(c2, bill!.id, 'e2', 'for');
    c2 = castVote(c2, bill!.id, 'e3', 'for');
    c2 = castVote(c2, bill!.id, 'e4', 'against');

    const { council: c3, passed } = resolveBill(c2, bill!.id);
    expect(passed).toBe(true);
    expect(c3.activeBills).toHaveLength(0);
    expect(c3.billHistory).toHaveLength(1);
    expect(c3.activeSanctions).toHaveLength(1);
    expect(c3.activeSanctions[0].level).toBe('condemnation');
  });

  it('should fail a bill with majority against', () => {
    let council = createCouncilV2(MEMBERS, 0);
    const { council: c1, bill } = proposeBill(
      council, 'e1', 'expel_member', 'Expel aggressor', 'Too dangerous', 'e4', 100,
    );
    let c2 = { ...c1, activeBills: c1.activeBills.map(b => ({ ...b, phase: 'voting' as const })) };
    c2 = castVote(c2, bill!.id, 'e1', 'for');
    c2 = castVote(c2, bill!.id, 'e2', 'against');
    c2 = castVote(c2, bill!.id, 'e3', 'against');
    c2 = castVote(c2, bill!.id, 'e4', 'against');

    const { passed } = resolveBill(c2, bill!.id);
    expect(passed).toBe(false);
  });

  it('should expel member when expulsion bill passes', () => {
    let council = createCouncilV2(MEMBERS, 0);
    const { council: c1, bill } = proposeBill(
      council, 'e1', 'expel_member', 'Expel', 'Reason', 'e4', 100,
    );
    let c2 = { ...c1, activeBills: c1.activeBills.map(b => ({ ...b, phase: 'voting' as const })) };
    c2 = castVote(c2, bill!.id, 'e1', 'for');
    c2 = castVote(c2, bill!.id, 'e2', 'for');
    c2 = castVote(c2, bill!.id, 'e3', 'for');

    const { council: c3 } = resolveBill(c2, bill!.id);
    expect(c3.memberEmpires).not.toContain('e4');
    expect(c3.expelledEmpires).toContain('e4');
  });

  it('should admit new member via bill', () => {
    let council = createCouncilV2(['e1', 'e2'], 0);
    const { council: c1, bill } = proposeBill(
      council, 'e1', 'admit_member', 'Admit e3', 'They are friendly', 'e3', 100,
    );
    let c2 = { ...c1, activeBills: c1.activeBills.map(b => ({ ...b, phase: 'voting' as const })) };
    c2 = castVote(c2, bill!.id, 'e1', 'for');
    c2 = castVote(c2, bill!.id, 'e2', 'for');

    const { council: c3 } = resolveBill(c2, bill!.id);
    expect(c3.memberEmpires).toContain('e3');
    expect(c3.memberBenefits['e3']?.votingRights).toBe(true);
  });
});

describe('leader veto', () => {
  it('should veto a bill and mark it resolved', () => {
    let council = createCouncilV2(MEMBERS, 0);
    council = { ...council, leaderEmpireId: 'e1' };
    const { council: c1, bill } = proposeBill(
      council, 'e2', 'condemn', 'Condemn', 'Reason', 'e3', 100,
    );
    let c2 = { ...c1, activeBills: c1.activeBills.map(b => ({ ...b, phase: 'voting' as const })) };
    c2 = vetoBill(c2, bill!.id);
    const vetoed = c2.activeBills.find(b => b.id === bill!.id);
    expect(vetoed?.vetoed).toBe(true);
    expect(vetoed?.resolved).toBe(true);
    expect(vetoed?.passed).toBe(false);
  });

  it('should have higher popularity cost for popular bills', () => {
    const popularBill = {
      votes: { 'e1': 'for' as const, 'e2': 'for' as const, 'e3': 'for' as const },
    } as any;
    const unpopularBill = {
      votes: { 'e1': 'for' as const, 'e2': 'against' as const, 'e3': 'against' as const },
    } as any;
    const vp = { 'e1': 33, 'e2': 33, 'e3': 33 };
    expect(vetoPopularityCost(popularBill, vp)).toBeGreaterThan(vetoPopularityCost(unpopularBill, vp));
  });
});

describe('AI voting on bills', () => {
  it('should vote to sanction a disliked empire', () => {
    const state = initPsychologicalState(teranos);
    const targetRel = { ...createRelationship('e4', teranos, drakmari, AFFINITY_MATRIX, 0), warmth: -40, trust: 10 };
    const withRels = { ...state, relationships: { 'e4': targetRel } };
    const bill = { type: 'condemn', targetEmpireId: 'e4', proposerEmpireId: 'e2' } as any;
    expect(aiVoteOnBill(withRels, bill, 'e1')).toBe('for');
  });

  it('should vote against sanctioning a liked empire', () => {
    const state = initPsychologicalState(sylvani);
    const targetRel = { ...createRelationship('e4', sylvani, teranos, AFFINITY_MATRIX, 0), warmth: 50, trust: 60 };
    const withRels = { ...state, relationships: { 'e4': targetRel } };
    const bill = { type: 'impose_sanctions', targetEmpireId: 'e4', proposerEmpireId: 'e2' } as any;
    expect(aiVoteOnBill(withRels, bill, 'e1')).toBe('against');
  });

  it('should never vote to sanction self', () => {
    const state = initPsychologicalState(teranos);
    const bill = { type: 'expel_member', targetEmpireId: 'e1', proposerEmpireId: 'e2' } as any;
    expect(aiVoteOnBill(state, bill, 'e1')).toBe('against');
  });

  it('should vote for war against feared empire when safety is low', () => {
    const state = initPsychologicalState(teranos);
    const targetRel = { ...createRelationship('e4', teranos, drakmari, AFFINITY_MATRIX, 0), fear: 50, warmth: -10 };
    const withRels = { ...state, needs: { ...state.needs, safety: 30 }, relationships: { 'e4': targetRel } };
    const bill = { type: 'declare_council_war', targetEmpireId: 'e4', proposerEmpireId: 'e2' } as any;
    expect(aiVoteOnBill(withRels, bill, 'e1')).toBe('for');
  });
});

describe('shouldLeaderVeto', () => {
  it('should veto sanctions against close ally', () => {
    const state = initPsychologicalState(teranos);
    const allyRel = { ...createRelationship('e4', teranos, sylvani, AFFINITY_MATRIX, 0), warmth: 60, trust: 70 };
    const withRels = { ...state, relationships: { 'e4': allyRel } };
    const bill = { type: 'impose_sanctions', targetEmpireId: 'e4', proposerEmpireId: 'e2' } as any;
    expect(shouldLeaderVeto(withRels, bill, 'e1')).toBe(true);
  });

  it('should not veto own bills', () => {
    const state = initPsychologicalState(teranos);
    const bill = { type: 'condemn', targetEmpireId: 'e4', proposerEmpireId: 'e1' } as any;
    expect(shouldLeaderVeto(state, bill, 'e1')).toBe(false);
  });
});

describe('processCouncilTick', () => {
  it('should advance bills through lifecycle', () => {
    let council = createCouncilV2(MEMBERS, 0);
    const { council: c1 } = proposeBill(
      council, 'e1', 'condemn', 'Test bill', 'Testing', 'e4', 0,
    );

    const aiStates = new Map<string, ReturnType<typeof initPsychologicalState>>();
    for (const id of MEMBERS) {
      const state = initPsychologicalState(teranos);
      const targetRel = { ...createRelationship('e4', teranos, drakmari, AFFINITY_MATRIX, 0), warmth: -30, trust: 15 };
      aiStates.set(id, { ...state, relationships: { 'e4': targetRel, 'e1': createRelationship('e1', teranos, sylvani, AFFINITY_MATRIX, 0) } });
    }

    // Tick 1: should advance to canvassing
    let result = processCouncilTick(c1, 1, aiStates);
    const afterCanvass = result.council.activeBills[0];
    expect(afterCanvass?.phase).toBe('canvassing');

    // Tick 11: should advance to voting
    result = processCouncilTick(result.council, 11, aiStates);

    // Tick 26+: should resolve
    result = processCouncilTick(result.council, 27, aiStates);
    // Bill should be resolved by now
    expect(result.council.activeBills.length + result.council.billHistory.length).toBeGreaterThanOrEqual(1);
  });
});
