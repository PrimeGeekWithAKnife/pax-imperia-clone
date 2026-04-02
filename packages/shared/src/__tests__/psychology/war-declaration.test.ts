import { describe, it, expect } from 'vitest';
import {
  determineWarDeclarationStyle,
  isUndeclaredWar,
  declarationReputationPenalty,
  wouldAbandonHonour,
  soundCoalitionSupport,
  assessCoalitionSupport,
} from '../../engine/psychology/war-declaration.js';
import { initPsychologicalState } from '../../engine/psychology/tick.js';
import { createRelationship } from '../../engine/psychology/relationship.js';
import { rollPersonality } from '../../engine/psychology/personality.js';
import { SPECIES_PERSONALITIES_BY_ID, AFFINITY_MATRIX } from '../../../data/species/personality/index.js';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}

const khazari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['khazari'], 'normal', seededRng(42));
const drakmari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['drakmari'], 'normal', seededRng(43));
const kaelenth = rollPersonality(SPECIES_PERSONALITIES_BY_ID['kaelenth'], 'normal', seededRng(44));
const sylvani = rollPersonality(SPECIES_PERSONALITIES_BY_ID['sylvani'], 'normal', seededRng(45));
const orivani = rollPersonality(SPECIES_PERSONALITIES_BY_ID['orivani'], 'normal', seededRng(46));
const teranos = rollPersonality(SPECIES_PERSONALITIES_BY_ID['teranos'], 'normal', seededRng(47));
const pyrenth = rollPersonality(SPECIES_PERSONALITIES_BY_ID['pyrenth'], 'normal', seededRng(48));
const thyriaq = rollPersonality(SPECIES_PERSONALITIES_BY_ID['thyriaq'], 'normal', seededRng(49));

describe('determineWarDeclarationStyle', () => {
  it('Khazari should use ritual challenge (honour-bound warriors)', () => {
    const style = determineWarDeclarationStyle(khazari);
    expect(['ritual_challenge', 'formal_declaration']).toContain(style);
    expect(isUndeclaredWar(style)).toBe(false);
  });

  it('Orivani should declare holy crusade (zealots)', () => {
    const style = determineWarDeclarationStyle(orivani);
    expect(style).toBe('holy_crusade');
  });

  it('Kaelenth should prefer surprise or calculated strike (Machiavellian)', () => {
    const style = determineWarDeclarationStyle(kaelenth);
    expect(['surprise_attack', 'calculated_strike', 'polite_ultimatum']).toContain(style);
  });

  it('Sylvani should use formal declaration (high honesty)', () => {
    const style = determineWarDeclarationStyle(sylvani);
    expect(isUndeclaredWar(style)).toBe(false);
  });

  it('Pyrenth should use glacial escalation (patient, introverted)', () => {
    const style = determineWarDeclarationStyle(pyrenth);
    expect(style).toBe('glacial_escalation');
  });

  it('Thyriaq should prefer surprise (low honesty, moderate psychopathy)', () => {
    const style = determineWarDeclarationStyle(thyriaq);
    expect(['surprise_attack', 'calculated_strike']).toContain(style);
  });
});

describe('isUndeclaredWar', () => {
  it('should flag surprise and calculated strike', () => {
    expect(isUndeclaredWar('surprise_attack')).toBe(true);
    expect(isUndeclaredWar('calculated_strike')).toBe(true);
  });

  it('should not flag formal styles', () => {
    expect(isUndeclaredWar('formal_declaration')).toBe(false);
    expect(isUndeclaredWar('ritual_challenge')).toBe(false);
    expect(isUndeclaredWar('holy_crusade')).toBe(false);
  });
});

describe('declarationReputationPenalty', () => {
  it('should be 0 for formal declaration', () => {
    expect(declarationReputationPenalty('formal_declaration')).toBe(0);
  });

  it('should be heavily negative for surprise attack', () => {
    expect(declarationReputationPenalty('surprise_attack')).toBeLessThan(-20);
  });

  it('should be moderately negative for calculated strike', () => {
    expect(declarationReputationPenalty('calculated_strike')).toBeLessThan(-10);
  });
});

describe('wouldAbandonHonour', () => {
  it('should return false at non-extreme stress', () => {
    expect(wouldAbandonHonour(khazari, 'high', 20)).toBe(false);
  });

  it('should return true for moderate honesty under existential threat', () => {
    expect(wouldAbandonHonour(teranos, 'extreme', 10)).toBe(true);
  });

  it('should return false for very high honesty even under extreme stress', () => {
    expect(wouldAbandonHonour(sylvani, 'extreme', 10)).toBe(false);
  });
});

describe('soundCoalitionSupport', () => {
  it('should support war against a disliked empire', () => {
    const state = initPsychologicalState(teranos);
    const askerRel = { ...createRelationship('asker', teranos, sylvani, AFFINITY_MATRIX, 0), warmth: 40, trust: 50 };
    const targetRel = { ...createRelationship('target', teranos, drakmari, AFFINITY_MATRIX, 0), warmth: -30, trust: 10 };
    const withRels = { ...state, relationships: { 'asker': askerRel, 'target': targetRel } };
    const response = soundCoalitionSupport(withRels, 'asker', 'target', seededRng(42));
    expect(response.statedSupport).toBe('support');
    expect(response.trueIntent).toBe('support');
  });

  it('should oppose war against a liked empire', () => {
    const state = initPsychologicalState(sylvani);
    const askerRel = { ...createRelationship('asker', sylvani, teranos, AFFINITY_MATRIX, 0), warmth: 10, trust: 30 };
    const targetRel = { ...createRelationship('target', sylvani, teranos, AFFINITY_MATRIX, 0), warmth: 50, trust: 60 };
    const withRels = { ...state, relationships: { 'asker': askerRel, 'target': targetRel } };
    const response = soundCoalitionSupport(withRels, 'asker', 'target', seededRng(42));
    expect(response.trueIntent).toBe('oppose');
  });

  it('Machiavellian species may plan betrayal', () => {
    const state = initPsychologicalState(kaelenth);
    const askerRel = { ...createRelationship('asker', kaelenth, teranos, AFFINITY_MATRIX, 0), warmth: 10, trust: 30 };
    const targetRel = { ...createRelationship('target', kaelenth, drakmari, AFFINITY_MATRIX, 0), warmth: -5, trust: 20 };
    const withRels = { ...state, needs: { ...state.needs, esteem: 30 }, relationships: { 'asker': askerRel, 'target': targetRel } };
    const response = soundCoalitionSupport(withRels, 'asker', 'target', seededRng(42));
    // Should either betray or be neutral — Kaelenth is Machiavellian
    expect(['support', 'neutral']).toContain(response.statedSupport);
    if (response.trueIntent === 'betray') {
      expect(response.statedSupport).toBe('support'); // Says support, plans betrayal
    }
  });

  it('should sometimes leak to the target', () => {
    // Run many samples with a Machiavellian species that likes the target
    let leakCount = 0;
    for (let i = 0; i < 50; i++) {
      const state = initPsychologicalState(kaelenth);
      const askerRel = { ...createRelationship('asker', kaelenth, teranos, AFFINITY_MATRIX, 0), warmth: -10, trust: 20 };
      const targetRel = { ...createRelationship('target', kaelenth, sylvani, AFFINITY_MATRIX, 0), warmth: 40, trust: 50 };
      const withRels = { ...state, relationships: { 'asker': askerRel, 'target': targetRel } };
      const response = soundCoalitionSupport(withRels, 'asker', 'target', seededRng(i));
      if (response.willLeak) leakCount++;
    }
    // Kaelenth (Mach 65, likes target) should leak sometimes
    expect(leakCount).toBeGreaterThan(0);
  });
});

describe('assessCoalitionSupport', () => {
  it('should aggregate responses and produce recommendation', () => {
    const askerState = initPsychologicalState(teranos);
    const allStates = new Map<string, ReturnType<typeof initPsychologicalState>>();

    // Create 3 allies who like the asker, dislike the target
    for (const id of ['ally1', 'ally2', 'ally3']) {
      const state = initPsychologicalState(sylvani);
      const askerRel = { ...createRelationship('asker-empire', sylvani, teranos, AFFINITY_MATRIX, 0), warmth: 40, trust: 50 };
      const targetRel = { ...createRelationship('target-empire', sylvani, drakmari, AFFINITY_MATRIX, 0), warmth: -30, trust: 10 };
      allStates.set(id, { ...state, relationships: { 'asker-empire': askerRel, 'target-empire': targetRel } });
    }

    // Asker knows all 3
    const askerWithRels = {
      ...askerState,
      relationships: {
        'ally1': createRelationship('ally1', teranos, sylvani, AFFINITY_MATRIX, 0),
        'ally2': createRelationship('ally2', teranos, sylvani, AFFINITY_MATRIX, 0),
        'ally3': createRelationship('ally3', teranos, sylvani, AFFINITY_MATRIX, 0),
      },
    };

    const assessment = assessCoalitionSupport(
      askerWithRels, 'asker-empire', 'target-empire', allStates, seededRng(42),
    );
    expect(assessment.responses.length).toBe(3);
    expect(assessment.statedSupportCount).toBeGreaterThanOrEqual(2);
    expect(assessment.recommendation).toBe('proceed');
  });
});
