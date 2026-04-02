import { describe, it, expect } from 'vitest';
import {
  sigmoid,
  computeAcceptanceProbability,
  probabilisticDecision,
  evaluateProposal,
  computeNeedAlignment,
  generateDiplomaticActions,
  proposalFrequency,
} from '../../engine/psychology/evaluation.js';
import type { ProposalContext } from '../../engine/psychology/evaluation.js';
import { createRelationship } from '../../engine/psychology/relationship.js';
import { rollPersonality } from '../../engine/psychology/personality.js';
import { NEUTRAL_MOOD } from '../../engine/psychology/mood.js';
import { SPECIES_PERSONALITIES_BY_ID, AFFINITY_MATRIX } from '../../../data/species/personality/index.js';
import type { MaslowNeeds, MoodState } from '../../types/psychology.js';

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
const vethara = rollPersonality(SPECIES_PERSONALITIES_BY_ID['vethara'], 'normal', seededRng(46));

const goodNeeds: MaslowNeeds = { physiological: 80, safety: 70, belonging: 50, esteem: 50, selfActualisation: 40 };
const desperateNeeds: MaslowNeeds = { physiological: 80, safety: 30, belonging: 15, esteem: 30, selfActualisation: 20 };

describe('sigmoid', () => {
  it('should return 0.5 at x=0', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 5);
  });

  it('should approach 1 for large positive x', () => {
    expect(sigmoid(100)).toBeGreaterThan(0.99);
  });

  it('should approach 0 for large negative x', () => {
    expect(sigmoid(-100)).toBeLessThan(0.01);
  });

  it('should be monotonically increasing', () => {
    expect(sigmoid(10)).toBeGreaterThan(sigmoid(5));
    expect(sigmoid(5)).toBeGreaterThan(sigmoid(0));
    expect(sigmoid(0)).toBeGreaterThan(sigmoid(-5));
  });
});

describe('computeAcceptanceProbability', () => {
  it('should return high probability for warm, trusting relationships', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const warmRel = { ...rel, warmth: 70, trust: 80, respect: 40 };
    const ctx: ProposalContext = {
      relationship: warmRel,
      personality: teranos,
      mood: { ...NEUTRAL_MOOD },
      needs: goodNeeds,
      treatyType: 'trade',
      needAlignment: 50,
    };
    const prob = computeAcceptanceProbability(ctx);
    expect(prob).toBeGreaterThan(0.7);
  });

  it('should return low probability for cold, distrusting relationships', () => {
    const rel = createRelationship('e2', khazari, sylvani, AFFINITY_MATRIX, 0);
    const coldRel = { ...rel, warmth: -40, trust: 10, respect: -20 };
    const ctx: ProposalContext = {
      relationship: coldRel,
      personality: khazari,
      mood: { ...NEUTRAL_MOOD },
      needs: goodNeeds,
      treatyType: 'alliance',
      needAlignment: -20,
    };
    const prob = computeAcceptanceProbability(ctx);
    expect(prob).toBeLessThan(0.3);
  });

  it('should return higher probability with positive mood', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const neutralMood: MoodState = { ...NEUTRAL_MOOD };
    const goodMood: MoodState = { ...NEUTRAL_MOOD, valence: 50 };

    const ctxNeutral: ProposalContext = {
      relationship: rel,
      personality: teranos,
      mood: neutralMood,
      needs: goodNeeds,
      treatyType: 'trade',
      needAlignment: 30,
    };
    const ctxGood: ProposalContext = { ...ctxNeutral, mood: goodMood };

    expect(computeAcceptanceProbability(ctxGood))
      .toBeGreaterThan(computeAcceptanceProbability(ctxNeutral));
  });

  it('should penalise deeper treaties more', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const warmRel = { ...rel, warmth: 40, trust: 50, respect: 20 };
    const base: ProposalContext = {
      relationship: warmRel,
      personality: teranos,
      mood: { ...NEUTRAL_MOOD },
      needs: goodNeeds,
      treatyType: 'trade',
      needAlignment: 30,
    };

    const tradePr = computeAcceptanceProbability({ ...base, treatyType: 'trade' });
    const alliancePr = computeAcceptanceProbability({ ...base, treatyType: 'alliance' });
    expect(tradePr).toBeGreaterThan(alliancePr);
  });
});

describe('probabilisticDecision', () => {
  it('should always return true for probability 1', () => {
    for (let i = 0; i < 10; i++) {
      expect(probabilisticDecision(1)).toBe(true);
    }
  });

  it('should always return false for probability 0', () => {
    for (let i = 0; i < 10; i++) {
      expect(probabilisticDecision(0)).toBe(false);
    }
  });

  it('should return approximately correct ratio for 0.5', () => {
    const rng = seededRng(42);
    let trues = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (probabilisticDecision(0.5, rng)) trues++;
    }
    expect(trues / N).toBeGreaterThan(0.35);
    expect(trues / N).toBeLessThan(0.65);
  });
});

describe('evaluateProposal', () => {
  it('should return both decision and probability', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const ctx: ProposalContext = {
      relationship: { ...rel, warmth: 50, trust: 60, respect: 30 },
      personality: teranos,
      mood: { ...NEUTRAL_MOOD },
      needs: goodNeeds,
      treatyType: 'trade',
      needAlignment: 30,
    };
    const result = evaluateProposal(ctx, seededRng(42));
    expect(typeof result.accepted).toBe('boolean');
    expect(result.probability).toBeGreaterThan(0);
    expect(result.probability).toBeLessThan(1);
  });
});

describe('computeNeedAlignment', () => {
  it('should return high alignment for trade when physiological is low', () => {
    const lowFood: MaslowNeeds = { ...goodNeeds, physiological: 20 };
    const alignment = computeNeedAlignment('trade', lowFood, teranos);
    expect(alignment).toBeGreaterThan(0);
  });

  it('should return high alignment for mutual_defence when safety is low', () => {
    const unsafe: MaslowNeeds = { ...goodNeeds, safety: 20 };
    const alignment = computeNeedAlignment('mutual_defence', unsafe, teranos);
    expect(alignment).toBeGreaterThan(20);
  });

  it('should return high alignment for alliance when belonging is low', () => {
    const isolated: MaslowNeeds = { ...goodNeeds, belonging: 10 };
    const alignment = computeNeedAlignment('alliance', isolated, teranos);
    expect(alignment).toBeGreaterThan(20);
  });

  it('should penalise alliance for avoidant types', () => {
    const isolated: MaslowNeeds = { ...goodNeeds, belonging: 30 };
    const avoidantAlignment = computeNeedAlignment('alliance', isolated, khazari);
    const secureAlignment = computeNeedAlignment('alliance', isolated, teranos);
    expect(avoidantAlignment).toBeLessThan(secureAlignment);
  });

  it('should boost alliance for anxious types', () => {
    const isolated: MaslowNeeds = { ...goodNeeds, belonging: 30 };
    const anxiousAlignment = computeNeedAlignment('alliance', isolated, vethara);
    const secureAlignment = computeNeedAlignment('alliance', isolated, teranos);
    expect(anxiousAlignment).toBeGreaterThan(secureAlignment);
  });
});

describe('generateDiplomaticActions', () => {
  it('should generate actions based on personality and relationships', () => {
    const rel = createRelationship('e2', vethara, teranos, AFFINITY_MATRIX, 0);
    const rels = { 'e2': rel };
    const actions = generateDiplomaticActions(vethara, { ...NEUTRAL_MOOD }, desperateNeeds, rels);
    expect(actions.length).toBeGreaterThan(0);
    // Vethara is anxious with low belonging — should suggest gifts/grand gestures
    expect(actions.some(a => a.type === 'grand_gesture' || a.type === 'gift_received')).toBe(true);
  });

  it('should sort by priority descending', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    const rels = { 'e2': rel };
    const actions = generateDiplomaticActions(teranos, { ...NEUTRAL_MOOD }, goodNeeds, rels);
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i].priority).toBeLessThanOrEqual(actions[i - 1].priority);
    }
  });

  it('should generate threats for aggressive low-A personalities with high dominance', () => {
    const rel = createRelationship('e2', khazari, sylvani, AFFINITY_MATRIX, 0);
    const rels = { 'e2': rel };
    const aggressiveMood: MoodState = { ...NEUTRAL_MOOD, dominance: 80, anger: 30 };
    const actions = generateDiplomaticActions(khazari, aggressiveMood, goodNeeds, rels);
    // Khazari has low agreeableness — should consider threats
    const hasThreats = actions.some(a => a.type === 'threat');
    expect(hasThreats).toBe(true);
  });
});

describe('proposalFrequency', () => {
  it('should return higher frequency for anxious types', () => {
    const anxious = proposalFrequency('anxious', 60);
    const avoidant = proposalFrequency('avoidant', 60);
    expect(anxious).toBeGreaterThan(avoidant);
  });

  it('should scale with extraversion', () => {
    const lowE = proposalFrequency('secure', 20);
    const highE = proposalFrequency('secure', 80);
    expect(highE).toBeGreaterThan(lowE);
  });

  it('should return at least 1 for avoidant', () => {
    expect(proposalFrequency('avoidant', 10)).toBeGreaterThanOrEqual(1);
  });
});
