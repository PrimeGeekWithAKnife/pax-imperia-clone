/**
 * Diplomacy-Psychology Bridge — Tests
 *
 * Verifies the translation layer between the legacy diplomacy system
 * (DiplomacyState with attitude/trust) and the psychology system
 * (PsychRelationship with warmth/respect/trust/fear/dependency).
 */

import { describe, it, expect } from 'vitest';
import type { PsychRelationship } from '../types/diplomacy-v2.js';
import type { EmpirePsychologicalState } from '../types/psychology.js';
import {
  mapTreatyToRelationshipEvent,
  syncSentimentToAttitude,
  recordDiplomaticEvent,
  syncPsychologyToDiplomacy,
} from '../engine/diplomacy-bridge.js';
import { computeOverallSentiment } from '../engine/psychology/relationship.js';
import { initializeDiplomacy, makeFirstContact, getRelation } from '../engine/diplomacy.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a minimal PsychRelationship with overrides. */
function makeRelationship(
  targetEmpireId: string,
  overrides: Partial<PsychRelationship> = {},
): PsychRelationship {
  return {
    targetEmpireId,
    warmth: 0,
    respect: 0,
    trust: 20,
    fear: 0,
    dependency: 0,
    compatibility: 0,
    dynamicAffinity: 0,
    incidents: [],
    positiveHistory: 0,
    negativeHistory: 0,
    lastContactTick: 0,
    contactFrequency: 0,
    abandonmentAnxiety: 0,
    establishedTick: 0,
    ...overrides,
  };
}

/** Create a minimal EmpirePsychologicalState for testing. */
function makePsychState(
  empireId: string,
  relationships: Record<string, PsychRelationship> = {},
): EmpirePsychologicalState {
  return {
    personality: {
      speciesId: 'test_species',
      traits: {
        neuroticism: 50,
        extraversion: 50,
        openness: 50,
        agreeableness: 50,
        conscientiousness: 50,
        honestyHumility: 50,
      },
      subfacets: {},
      attachmentStyle: 'secure',
      enneagram: { type: 5, wing: 6, stressDirection: 7, growthDirection: 8 },
      darkTriad: { narcissism: 10, machiavellianism: 10, psychopathy: 10, sadism: 5 },
      moralFoundations: {
        careHarm: 50,
        fairnessCheating: 50,
        loyaltyBetrayal: 50,
        authoritySubversion: 50,
        sanctityDegradation: 50,
        libertyOppression: 50,
      },
      firstContactAttitude: 0,
      difficulty: 'normal',
    },
    effectiveTraits: {
      neuroticism: 50,
      extraversion: 50,
      openness: 50,
      agreeableness: 50,
      conscientiousness: 50,
      honestyHumility: 50,
    },
    mood: { valence: 0, arousal: 30, dominance: 50, anxiety: 20, anger: 0 },
    needs: {
      physiological: 80,
      safety: 70,
      belonging: 50,
      esteem: 40,
      selfActualisation: 30,
    },
    stressLevel: 'baseline',
    ticksSinceCrisis: 100,
    relationships,
  };
}

// ---------------------------------------------------------------------------
// mapTreatyToRelationshipEvent
// ---------------------------------------------------------------------------

describe('mapTreatyToRelationshipEvent', () => {
  it('maps "trade" to "trade_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('trade')).toBe('trade_treaty');
  });

  it('maps "trade_agreement" to "trade_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('trade_agreement')).toBe('trade_treaty');
  });

  it('maps "non_aggression" to "non_aggression_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('non_aggression')).toBe('non_aggression_treaty');
  });

  it('maps "research_sharing" to "research_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('research_sharing')).toBe('research_treaty');
  });

  it('maps "mutual_defense" to "mutual_defence_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('mutual_defense')).toBe('mutual_defence_treaty');
  });

  it('maps "mutual_defence" to "mutual_defence_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('mutual_defence')).toBe('mutual_defence_treaty');
  });

  it('maps "military_alliance" to "alliance_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('military_alliance')).toBe('alliance_treaty');
  });

  it('maps "alliance" to "alliance_treaty"', () => {
    expect(mapTreatyToRelationshipEvent('alliance')).toBe('alliance_treaty');
  });

  it('returns undefined for unmapped types like "vassalism"', () => {
    expect(mapTreatyToRelationshipEvent('vassalism')).toBeUndefined();
  });

  it('returns undefined for unknown strings', () => {
    expect(mapTreatyToRelationshipEvent('wormhole_pact')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// syncSentimentToAttitude
// ---------------------------------------------------------------------------

describe('syncSentimentToAttitude', () => {
  it('returns Math.round of computeOverallSentiment', () => {
    const rel = makeRelationship('empire_b', {
      warmth: 50,
      respect: 30,
      trust: 60,
      fear: 10,
      compatibility: 10,
      dynamicAffinity: 5,
    });

    const expected = computeOverallSentiment(rel);
    const result = syncSentimentToAttitude(rel);

    expect(result).toBe(expected);
    expect(typeof result).toBe('number');
    // Verify it's an integer
    expect(result).toBe(Math.round(result));
  });

  it('returns a negative value for hostile relationships', () => {
    const rel = makeRelationship('empire_b', {
      warmth: -80,
      respect: -40,
      trust: 5,
      fear: 60,
      compatibility: -20,
      dynamicAffinity: -10,
    });

    const result = syncSentimentToAttitude(rel);
    expect(result).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// recordDiplomaticEvent
// ---------------------------------------------------------------------------

describe('recordDiplomaticEvent', () => {
  it('fires a trade_treaty event and increases warmth', () => {
    const empireA = 'empire_a';
    const empireB = 'empire_b';

    const relAB = makeRelationship(empireB, { warmth: 10, trust: 30 });
    const stateA = makePsychState(empireA, { [empireB]: relAB });

    const psychStateMap = new Map<string, EmpirePsychologicalState>();
    psychStateMap.set(empireA, stateA);
    psychStateMap.set(empireB, makePsychState(empireB));

    const beforeWarmth = relAB.warmth;
    const result = recordDiplomaticEvent(psychStateMap, empireA, empireB, 'trade_treaty', 100);

    // Warmth should have increased (trade_treaty has positive warmth impact)
    const updatedRel = result.psychStateMap.get(empireA)!.relationships[empireB];
    expect(updatedRel.warmth).toBeGreaterThan(beforeWarmth);

    // Attitude delta should be positive
    expect(result.attitudeDelta).toBeGreaterThan(0);
  });

  it('fires a war_declared_on_us event and decreases warmth', () => {
    const empireA = 'empire_a';
    const empireB = 'empire_b';

    const relAB = makeRelationship(empireB, { warmth: 20, trust: 40 });
    const stateA = makePsychState(empireA, { [empireB]: relAB });

    const psychStateMap = new Map<string, EmpirePsychologicalState>();
    psychStateMap.set(empireA, stateA);
    psychStateMap.set(empireB, makePsychState(empireB));

    const result = recordDiplomaticEvent(psychStateMap, empireA, empireB, 'war_declared_on_us', 100);

    const updatedRel = result.psychStateMap.get(empireA)!.relationships[empireB];
    expect(updatedRel.warmth).toBeLessThan(20);
    expect(result.attitudeDelta).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// syncPsychologyToDiplomacy
// ---------------------------------------------------------------------------

describe('syncPsychologyToDiplomacy', () => {
  it('syncs high-warmth/trust psychology to positive legacy attitude', () => {
    const empireA = 'empire_a';
    const empireB = 'empire_b';

    // Set up psychology with high warmth and trust
    const relAB = makeRelationship(empireB, {
      warmth: 60,
      respect: 40,
      trust: 70,
      fear: 0,
      compatibility: 20,
      dynamicAffinity: 10,
    });
    const stateA = makePsychState(empireA, { [empireB]: relAB });

    const psychStateMap = new Map<string, EmpirePsychologicalState>();
    psychStateMap.set(empireA, stateA);
    psychStateMap.set(empireB, makePsychState(empireB));

    // Set up legacy diplomacy with neutral attitude
    let diplomacyState = initializeDiplomacy([empireA, empireB]);
    diplomacyState = makeFirstContact(diplomacyState, empireA, empireB, 0);

    const attitudeBefore = getRelation(diplomacyState, empireA, empireB)!.attitude;

    const result = syncPsychologyToDiplomacy(psychStateMap, diplomacyState, 100);

    const attitudeAfter = getRelation(result, empireA, empireB)!.attitude;

    // Psychology sentiment is positive, so attitude should have increased
    expect(attitudeAfter).toBeGreaterThan(attitudeBefore);
  });

  it('syncs hostile psychology to negative legacy attitude shift', () => {
    const empireA = 'empire_a';
    const empireB = 'empire_b';

    const relAB = makeRelationship(empireB, {
      warmth: -70,
      respect: -30,
      trust: 5,
      fear: 50,
      compatibility: -10,
      dynamicAffinity: -10,
    });
    const stateA = makePsychState(empireA, { [empireB]: relAB });

    const psychStateMap = new Map<string, EmpirePsychologicalState>();
    psychStateMap.set(empireA, stateA);
    psychStateMap.set(empireB, makePsychState(empireB));

    let diplomacyState = initializeDiplomacy([empireA, empireB]);
    diplomacyState = makeFirstContact(diplomacyState, empireA, empireB, 0);

    const attitudeBefore = getRelation(diplomacyState, empireA, empireB)!.attitude;

    const result = syncPsychologyToDiplomacy(psychStateMap, diplomacyState, 100);

    const attitudeAfter = getRelation(result, empireA, empireB)!.attitude;

    // Psychology sentiment is negative, so attitude should have decreased
    expect(attitudeAfter).toBeLessThan(attitudeBefore);
  });
});
