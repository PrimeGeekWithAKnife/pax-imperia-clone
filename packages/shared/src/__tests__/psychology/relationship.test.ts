import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRelationship,
  applyRelationshipEvent,
  tickRelationship,
  computeOverallSentiment,
  isRelationshipHostile,
  isRelationshipAllianceReady,
  RELATIONSHIP_EVENTS,
} from '../../engine/psychology/relationship.js';
import { rollPersonality } from '../../engine/psychology/personality.js';
import { SPECIES_PERSONALITIES_BY_ID, AFFINITY_MATRIX } from '../../../data/species/personality/index.js';
import type { PsychRelationship } from '../../types/diplomacy-v2.js';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Roll some test personalities
const teranos = rollPersonality(SPECIES_PERSONALITIES_BY_ID['teranos'], 'normal', seededRng(42));
const sylvani = rollPersonality(SPECIES_PERSONALITIES_BY_ID['sylvani'], 'normal', seededRng(43));
const drakmari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['drakmari'], 'normal', seededRng(44));
const khazari = rollPersonality(SPECIES_PERSONALITIES_BY_ID['khazari'], 'normal', seededRng(45));
const vethara = rollPersonality(SPECIES_PERSONALITIES_BY_ID['vethara'], 'normal', seededRng(46));

describe('createRelationship', () => {
  it('should create a relationship with seeded dimensions', () => {
    const rel = createRelationship('empire-2', teranos, sylvani, AFFINITY_MATRIX, 0);
    expect(rel.targetEmpireId).toBe('empire-2');
    expect(rel.warmth).toBeGreaterThanOrEqual(-100);
    expect(rel.warmth).toBeLessThanOrEqual(100);
    expect(rel.trust).toBeGreaterThanOrEqual(0);
    expect(rel.trust).toBeLessThanOrEqual(100);
    expect(rel.fear).toBe(0);
    expect(rel.dependency).toBe(0);
    expect(rel.incidents).toHaveLength(0);
    expect(rel.establishedTick).toBe(0);
  });

  it('should have higher initial warmth for allied species', () => {
    const friendly = createRelationship('e1', sylvani, teranos, AFFINITY_MATRIX, 0);
    const hostile = createRelationship('e2', drakmari, sylvani, AFFINITY_MATRIX, 0);
    // Sylvani→Teranos has +10 affinity, Drakmari→Sylvani has -20
    expect(friendly.warmth).toBeGreaterThan(hostile.warmth);
  });

  it('should seed trust from base affinity', () => {
    const kindred = createRelationship('e1', khazari, rollPersonality(SPECIES_PERSONALITIES_BY_ID['pyrenth'], 'normal', seededRng(47)), AFFINITY_MATRIX, 0);
    // Khazari-Pyrenth have +30 affinity → trust should be higher than default
    expect(kindred.trust).toBeGreaterThan(20);
  });

  it('should set compatibility from trait similarity', () => {
    const rel = createRelationship('e1', teranos, sylvani, AFFINITY_MATRIX, 0);
    expect(typeof rel.compatibility).toBe('number');
    expect(rel.compatibility).toBeGreaterThanOrEqual(-100);
    expect(rel.compatibility).toBeLessThanOrEqual(100);
  });
});

describe('applyRelationshipEvent', () => {
  let baseRel: PsychRelationship;

  beforeEach(() => {
    baseRel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
  });

  it('should increase warmth and trust for trade treaty', () => {
    const updated = applyRelationshipEvent(baseRel, 'trade_treaty', 'secure', 10);
    expect(updated.warmth).toBeGreaterThan(baseRel.warmth);
    expect(updated.trust).toBeGreaterThan(baseRel.trust);
  });

  it('should record incident', () => {
    const updated = applyRelationshipEvent(baseRel, 'gift_received', 'secure', 10);
    expect(updated.incidents).toHaveLength(1);
    expect(updated.incidents[0].type).toBe('gift_received');
    expect(updated.incidents[0].tick).toBe(10);
  });

  it('should amplify warmth impact for anxious attachment', () => {
    const secure = applyRelationshipEvent(baseRel, 'gift_received', 'secure', 10);
    const anxious = applyRelationshipEvent(baseRel, 'gift_received', 'anxious', 10);
    // Anxious has 2x warmth multiplier
    expect(anxious.warmth - baseRel.warmth).toBeGreaterThan(secure.warmth - baseRel.warmth);
  });

  it('should dampen warmth impact for avoidant attachment', () => {
    const secure = applyRelationshipEvent(baseRel, 'gift_received', 'secure', 10);
    const avoidant = applyRelationshipEvent(baseRel, 'gift_received', 'avoidant', 10);
    // Avoidant has 0.5x warmth multiplier
    expect(avoidant.warmth - baseRel.warmth).toBeLessThan(secure.warmth - baseRel.warmth);
  });

  it('should heavily penalise treaty breaking', () => {
    const updated = applyRelationshipEvent(baseRel, 'treaty_broken', 'secure', 10);
    expect(updated.warmth).toBeLessThan(baseRel.warmth);
    expect(updated.trust).toBeLessThan(baseRel.trust);
    expect(updated.fear).toBeGreaterThan(baseRel.fear);
  });

  it('should increase abandonment anxiety when ignored (anxious)', () => {
    const updated = applyRelationshipEvent(baseRel, 'ignored_request', 'anxious', 10);
    expect(updated.abandonmentAnxiety).toBeGreaterThan(baseRel.abandonmentAnxiety);
    // And much more than secure
    const secureUpdated = applyRelationshipEvent(baseRel, 'ignored_request', 'secure', 10);
    expect(updated.abandonmentAnxiety).toBeGreaterThan(secureUpdated.abandonmentAnxiety);
  });

  it('should accumulate grievances for avoidant even with dampened warmth', () => {
    // Avoidant has 0.5x warmth multiplier BUT 2x grievance multiplier
    // So their immediate reaction is smaller but their memory is longer
    const avoidant = applyRelationshipEvent(baseRel, 'treaty_broken', 'avoidant', 10);
    expect(avoidant.negativeHistory).toBeGreaterThan(0);
    // The grievance multiplier adds extra negative history beyond base
    expect(avoidant.incidents[0].warmthImpact).toBe(-10); // 0.5x of -20
  });

  it('should apply extra penalty for enslaved_species with high agreeableness', () => {
    const highA = applyRelationshipEvent(baseRel, 'enslaved_species', 'secure', 10, 80);
    const lowA = applyRelationshipEvent(baseRel, 'enslaved_species', 'secure', 10, 30);
    expect(highA.warmth).toBeLessThan(lowA.warmth);
  });

  it('should update last contact tick', () => {
    const updated = applyRelationshipEvent(baseRel, 'diplomatic_contact', 'secure', 42);
    expect(updated.lastContactTick).toBe(42);
  });

  it('should cap incidents at 50', () => {
    let rel = baseRel;
    for (let i = 0; i < 60; i++) {
      rel = applyRelationshipEvent(rel, 'diplomatic_contact', 'secure', i);
    }
    expect(rel.incidents.length).toBeLessThanOrEqual(50);
  });
});

describe('tickRelationship', () => {
  it('should decay fear over time', () => {
    let rel = createRelationship('e2', teranos, drakmari, AFFINITY_MATRIX, 0);
    rel = { ...rel, fear: 80 };
    // After many ticks, fear should decrease noticeably
    let current = rel;
    for (let i = 0; i < 10; i++) {
      current = tickRelationship(current, 'secure', i + 1);
    }
    expect(current.fear).toBeLessThan(80);
  });

  it('should increase abandonment anxiety when contact lapses (anxious)', () => {
    let rel = createRelationship('e2', vethara, teranos, AFFINITY_MATRIX, 0);
    rel = { ...rel, lastContactTick: 0 };
    // Tick at tick 200 — way past threshold of 50
    const ticked = tickRelationship(rel, 'anxious', 200);
    expect(ticked.abandonmentAnxiety).toBeGreaterThan(rel.abandonmentAnxiety);
  });

  it('should barely increase anxiety for avoidant on contact lapse', () => {
    let rel = createRelationship('e2', khazari, teranos, AFFINITY_MATRIX, 0);
    rel = { ...rel, lastContactTick: 0 };
    const ticked = tickRelationship(rel, 'avoidant', 200);
    // Avoidant has 0.2x abandonment multiplier — should be minimal
    expect(ticked.abandonmentAnxiety).toBeLessThan(5);
  });

  it('should decay abandonment anxiety when in contact', () => {
    let rel = createRelationship('e2', vethara, teranos, AFFINITY_MATRIX, 0);
    rel = { ...rel, abandonmentAnxiety: 50, lastContactTick: 95 };
    const ticked = tickRelationship(rel, 'anxious', 100);
    expect(ticked.abandonmentAnxiety).toBeLessThan(50);
  });

  it('should decay contact frequency', () => {
    let rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    rel = { ...rel, contactFrequency: 10 };
    const ticked = tickRelationship(rel, 'secure', 1);
    expect(ticked.contactFrequency).toBeLessThan(10);
  });
});

describe('computeOverallSentiment', () => {
  it('should return positive for warm, trusting relationships', () => {
    const rel = createRelationship('e2', sylvani, teranos, AFFINITY_MATRIX, 0);
    const warm = { ...rel, warmth: 60, respect: 40, trust: 70, fear: 0 };
    expect(computeOverallSentiment(warm)).toBeGreaterThan(0);
  });

  it('should return negative for hostile relationships', () => {
    const rel = createRelationship('e2', drakmari, sylvani, AFFINITY_MATRIX, 0);
    const hostile = { ...rel, warmth: -60, respect: -30, trust: 10, fear: 50 };
    expect(computeOverallSentiment(hostile)).toBeLessThan(0);
  });
});

describe('isRelationshipHostile', () => {
  it('should return true for hostile dimensions', () => {
    const rel = createRelationship('e2', drakmari, sylvani, AFFINITY_MATRIX, 0);
    const hostile = { ...rel, warmth: -50, trust: 10, fear: 40 };
    expect(isRelationshipHostile(hostile)).toBe(true);
  });

  it('should return false for neutral relationships', () => {
    const rel = createRelationship('e2', teranos, sylvani, AFFINITY_MATRIX, 0);
    expect(isRelationshipHostile(rel)).toBe(false);
  });
});

describe('isRelationshipAllianceReady', () => {
  it('should return true when warm, trusted, and respected', () => {
    const rel = createRelationship('e2', sylvani, teranos, AFFINITY_MATRIX, 0);
    const ready = { ...rel, warmth: 60, trust: 70, respect: 40 };
    expect(isRelationshipAllianceReady(ready)).toBe(true);
  });

  it('should return false when trust is too low', () => {
    const rel = createRelationship('e2', sylvani, teranos, AFFINITY_MATRIX, 0);
    const notReady = { ...rel, warmth: 60, trust: 30, respect: 40 };
    expect(isRelationshipAllianceReady(notReady)).toBe(false);
  });
});

describe('RELATIONSHIP_EVENTS catalogue', () => {
  it('should have all defined event types', () => {
    const expectedTypes = [
      'trade_treaty', 'non_aggression_treaty', 'research_treaty',
      'mutual_defence_treaty', 'alliance_treaty', 'gift_received',
      'praise_given', 'recognition_given', 'grand_gesture',
      'treaty_broken', 'war_declared', 'war_declared_on_us',
      'defended_in_war', 'conquered_friend', 'enslaved_species',
      'ignored_request', 'insult', 'threat', 'peace_made',
    ];
    for (const type of expectedTypes) {
      expect(RELATIONSHIP_EVENTS[type as keyof typeof RELATIONSHIP_EVENTS]).toBeDefined();
    }
  });

  it('should have reasonable impact values', () => {
    for (const [, impact] of Object.entries(RELATIONSHIP_EVENTS)) {
      expect(Math.abs(impact.warmth)).toBeLessThanOrEqual(50);
      expect(Math.abs(impact.respect)).toBeLessThanOrEqual(50);
      expect(Math.abs(impact.trust)).toBeLessThanOrEqual(50);
      expect(Math.abs(impact.fear)).toBeLessThanOrEqual(50);
    }
  });
});
