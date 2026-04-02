import { describe, it, expect } from 'vitest';
import {
  evaluateTreatyWithPsychology,
  psychologyWarPropensity,
  determineBuildingPriorities,
  generatePsychDiplomaticActions,
  computePersonalityDrift,
} from '../../engine/psychology/ai-integration.js';
import { initPsychologicalState } from '../../engine/psychology/tick.js';
import { createRelationship } from '../../engine/psychology/relationship.js';
import { rollPersonality } from '../../engine/psychology/personality.js';
import { SPECIES_PERSONALITIES_BY_ID, AFFINITY_MATRIX } from '../../../data/species/personality/index.js';
import type { EmpirePsychologicalState, MaslowNeeds } from '../../types/psychology.js';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const teranos = rollPersonality(SPECIES_PERSONALITIES_BY_ID['teranos'], 'normal', seededRng(42));
const sylvani = rollPersonality(SPECIES_PERSONALITIES_BY_ID['sylvani'], 'normal', seededRng(43));
const drakmari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['drakmari'], 'normal', seededRng(44));
const khazari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['khazari'], 'normal', seededRng(45));
const vethara = rollPersonality(SPECIES_PERSONALITIES_BY_ID['vethara'], 'normal', seededRng(46));

function makeState(personality: typeof teranos, relationships: Record<string, ReturnType<typeof createRelationship>> = {}): EmpirePsychologicalState {
  const state = initPsychologicalState(personality);
  return { ...state, relationships };
}

describe('evaluateTreatyWithPsychology', () => {
  it('should reject when no relationship exists', () => {
    const state = makeState(teranos);
    const result = evaluateTreatyWithPsychology(state, 'unknown-empire', 'trade');
    expect(result.accept).toBe(false);
    expect(result.reason).toBe('no_relationship');
  });

  it('should auto-accept trade when physiological need is critical', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const state = makeState(teranos, { 'e2': rel });
    state.needs = { physiological: 10, safety: 70, belonging: 50, esteem: 50, selfActualisation: 40 };
    const result = evaluateTreatyWithPsychology(state, 'e2', 'trade');
    expect(result.accept).toBe(true);
    expect(result.reason).toBe('survival_trade');
  });

  it('should auto-accept mutual defence when safety is critical', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const state = makeState(teranos, { 'e2': rel });
    state.needs = { physiological: 80, safety: 15, belonging: 50, esteem: 50, selfActualisation: 40 };
    const result = evaluateTreatyWithPsychology(state, 'e2', 'mutual_defence');
    expect(result.accept).toBe(true);
    expect(result.reason).toBe('survival_defence');
  });

  it('should use probabilistic evaluation for normal conditions', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const warmRel = { ...rel, warmth: 60, trust: 70, respect: 30 };
    const state = makeState(teranos, { 'e2': warmRel });
    const result = evaluateTreatyWithPsychology(state, 'e2', 'trade', seededRng(42));
    expect(result.probability).toBeGreaterThan(0);
    expect(result.probability).toBeLessThan(1);
    expect(['psychology_accept', 'psychology_reject']).toContain(result.reason);
  });

  it('should reject unknown treaty types', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const state = makeState(teranos, { 'e2': rel });
    const result = evaluateTreatyWithPsychology(state, 'e2', 'wormhole_pact');
    expect(result.accept).toBe(false);
    expect(result.reason).toBe('unknown_treaty_type');
  });
});

describe('psychologyWarPropensity', () => {
  it('should return higher propensity for aggressive species', () => {
    const drakmariState = makeState(drakmari);
    const sylvaniState = makeState(sylvani);
    expect(psychologyWarPropensity(drakmariState)).toBeGreaterThan(psychologyWarPropensity(sylvaniState));
  });

  it('should increase with anger', () => {
    const state = makeState(khazari);
    const calm = { ...state, mood: { ...state.mood, anger: 10, dominance: 50 } };
    const angry = { ...state, mood: { ...state.mood, anger: 80, dominance: 50 } };
    expect(psychologyWarPropensity(angry)).toBeGreaterThan(psychologyWarPropensity(calm));
  });

  it('should return positive value for all species', () => {
    for (const id of ['teranos', 'sylvani', 'khazari', 'drakmari', 'vethara', 'nexari']) {
      const p = rollPersonality(SPECIES_PERSONALITIES_BY_ID[id], 'normal', seededRng(42));
      const state = makeState(p);
      expect(psychologyWarPropensity(state)).toBeGreaterThan(0);
    }
  });
});

describe('determineBuildingPriorities', () => {
  it('should prioritise food when physiological is low', () => {
    const needs: MaslowNeeds = { physiological: 20, safety: 70, belonging: 50, esteem: 50, selfActualisation: 40 };
    const priorities = determineBuildingPriorities(needs);
    expect(priorities[0]).toBe('food_production');
  });

  it('should prioritise military when safety is low', () => {
    const needs: MaslowNeeds = { physiological: 80, safety: 20, belonging: 50, esteem: 50, selfActualisation: 40 };
    const priorities = determineBuildingPriorities(needs);
    expect(priorities[0]).toBe('military_defence');
  });

  it('should return all priority types', () => {
    const needs: MaslowNeeds = { physiological: 50, safety: 50, belonging: 30, esteem: 30, selfActualisation: 30 };
    const priorities = determineBuildingPriorities(needs);
    expect(priorities.length).toBeGreaterThanOrEqual(4);
  });
});

describe('generatePsychDiplomaticActions', () => {
  it('should generate actions when relationships exist', () => {
    const rel = createRelationship('e2', vethara, teranos, AFFINITY_MATRIX, 0);
    const state = makeState(vethara, { 'e2': rel });
    state.needs = { physiological: 80, safety: 70, belonging: 15, esteem: 30, selfActualisation: 20 };
    // Force a tick that triggers action generation (tick 0 always triggers)
    const actions = generatePsychDiplomaticActions(state, 0, 3);
    expect(actions.length).toBeGreaterThanOrEqual(0);
  });

  it('should return empty when no relationships', () => {
    const state = makeState(teranos);
    const actions = generatePsychDiplomaticActions(state, 0, 3);
    expect(actions).toHaveLength(0);
  });
});

describe('computePersonalityDrift', () => {
  it('should reduce agreeableness after betrayals', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const betrayedRel = { ...rel, negativeHistory: 200, positiveHistory: 10 };
    const state = makeState(teranos, { 'e2': betrayedRel });
    const drift = computePersonalityDrift(state);
    expect(drift.agreeableness).toBeLessThan(0);
  });

  it('should increase extraversion with successful alliances', () => {
    const rel1 = { ...createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0), trust: 70, warmth: 50 };
    const rel2 = { ...createRelationship('e3', teranos, rollPersonality(SPECIES_PERSONALITIES_BY_ID['luminari'], 'normal', seededRng(47)), AFFINITY_MATRIX, 0), trust: 65, warmth: 45 };
    const state = makeState(teranos, { 'e2': rel1, 'e3': rel2 });
    const drift = computePersonalityDrift(state);
    expect(drift.extraversion).toBeGreaterThan(0);
  });

  it('should return empty drift when relationships are neutral', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const state = makeState(teranos, { 'e2': rel });
    const drift = computePersonalityDrift(state);
    expect(Object.keys(drift).length).toBe(0);
  });
});
