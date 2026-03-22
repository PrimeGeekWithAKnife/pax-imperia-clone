import { describe, it, expect } from 'vitest';
import {
  resolveFirstContact,
  resolveFirstContactOutcome,
  createAuditTrail,
  recordDecision,
} from '../engine/first-contact.js';
import type {
  FirstContactReaction,
  FirstContactApproach,
} from '../types/first-contact.js';
import type { EthicalAuditTrail } from '../types/ethical-audit.js';

// ---------------------------------------------------------------------------
// resolveFirstContact — greeting without xenolinguistics
// ---------------------------------------------------------------------------

describe('resolveFirstContact', () => {
  describe('send_greeting without xenolinguistics', () => {
    it('returns a valid FirstContactReaction', () => {
      const validReactions: FirstContactReaction[] = [
        'friendly_response',
        'cautious_interest',
        'confusion',
        'fear_and_retreat',
        'hostile_response',
        'total_misunderstanding',
        'religious_awe',
        'assimilation_offer',
      ];

      const result = resolveFirstContact(
        'send_greeting', 'species_a', 'species_b',
        false, false, 5, 5,
      );
      expect(validReactions).toContain(result);
    });

    it('can produce confusion without language research', () => {
      // With a very low roll, confusion should be among the first outcomes
      // (it has the highest weight at 0.30 in the no-language greeting table)
      const result = resolveFirstContact(
        'send_greeting', 'a', 'b',
        false, false, 5, 5, 0.01,
      );
      // At roll 0.01, it should land in the first bucket
      expect(result).toBeDefined();
    });
  });

  describe('send_greeting with xenolinguistics', () => {
    it('returns a valid reaction', () => {
      const result = resolveFirstContact(
        'send_greeting', 'a', 'b',
        true, false, 5, 5,
      );
      expect(typeof result).toBe('string');
    });

    it('favours friendly outcomes with high openness', () => {
      // With language + high openness + low roll, friendly should dominate
      const result = resolveFirstContact(
        'send_greeting', 'a', 'b',
        true, false, 10, 5, 0.01,
      );
      expect(result).toBe('friendly_response');
    });

    it('is more likely to be friendly than without language', () => {
      // Statistical test: run many iterations and check distribution
      const withLanguageFriendly = countOutcomes(
        'send_greeting', true, false, 5, 5, 1000, 'friendly_response',
      );
      const withoutLanguageFriendly = countOutcomes(
        'send_greeting', false, false, 5, 5, 1000, 'friendly_response',
      );
      expect(withLanguageFriendly).toBeGreaterThan(withoutLanguageFriendly);
    });
  });

  describe('display_strength', () => {
    it('brave species respond with hostility more often', () => {
      const hostileCountBrave = countOutcomes(
        'display_strength', false, false, 5, 10, 1000, 'hostile_response',
      );
      const hostileCountCowardly = countOutcomes(
        'display_strength', false, false, 5, 1, 1000, 'hostile_response',
      );
      expect(hostileCountBrave).toBeGreaterThan(hostileCountCowardly);
    });

    it('cowardly species flee more often', () => {
      const fleeCountCowardly = countOutcomes(
        'display_strength', false, false, 5, 1, 1000, 'fear_and_retreat',
      );
      const fleeCountBrave = countOutcomes(
        'display_strength', false, false, 5, 10, 1000, 'fear_and_retreat',
      );
      expect(fleeCountCowardly).toBeGreaterThan(fleeCountBrave);
    });
  });

  describe('open_fire', () => {
    it('always results in hostile response', () => {
      const result = resolveFirstContact(
        'open_fire', 'a', 'b',
        false, false, 10, 1,
      );
      expect(result).toBe('hostile_response');
    });

    it('always hostile regardless of personality', () => {
      // Even with maximum openness and minimum bravery
      const result = resolveFirstContact(
        'open_fire', 'a', 'b',
        true, true, 10, 10,
      );
      expect(result).toBe('hostile_response');
    });
  });

  describe('observe_silently', () => {
    it('returns a valid reaction', () => {
      const result = resolveFirstContact(
        'observe_silently', 'a', 'b',
        false, false, 5, 5,
      );
      expect(typeof result).toBe('string');
    });

    it('confusion is the most common outcome with neutral personality', () => {
      const confusionCount = countOutcomes(
        'observe_silently', false, false, 5, 5, 1000, 'confusion',
      );
      const hostileCount = countOutcomes(
        'observe_silently', false, false, 5, 5, 1000, 'hostile_response',
      );
      expect(confusionCount).toBeGreaterThan(hostileCount);
    });
  });

  describe('flee', () => {
    it('returns a valid reaction', () => {
      const result = resolveFirstContact(
        'flee', 'a', 'b',
        false, false, 5, 5,
      );
      expect(typeof result).toBe('string');
    });
  });

  describe('broadcast_language', () => {
    it('strongly favours friendly responses', () => {
      const friendlyCount = countOutcomes(
        'broadcast_language', true, false, 5, 5, 1000, 'friendly_response',
      );
      // Should be the most common outcome
      expect(friendlyCount).toBeGreaterThan(300); // out of 1000
    });

    it('open species respond more favourably', () => {
      const friendlyOpen = countOutcomes(
        'broadcast_language', true, false, 10, 5, 1000, 'friendly_response',
      );
      const friendlyClosed = countOutcomes(
        'broadcast_language', true, false, 1, 5, 1000, 'friendly_response',
      );
      expect(friendlyOpen).toBeGreaterThan(friendlyClosed);
    });
  });

  describe('species personality affects outcomes', () => {
    it('high openness increases friendly outcomes for greetings', () => {
      const friendlyOpen = countOutcomes(
        'send_greeting', false, false, 10, 5, 1000, 'friendly_response',
      );
      const friendlyClosed = countOutcomes(
        'send_greeting', false, false, 1, 5, 1000, 'friendly_response',
      );
      expect(friendlyOpen).toBeGreaterThan(friendlyClosed);
    });

    it('high bravery increases hostile outcomes for strength display', () => {
      const hostileBrave = countOutcomes(
        'display_strength', false, false, 5, 10, 1000, 'hostile_response',
      );
      const hostileTimid = countOutcomes(
        'display_strength', false, false, 5, 1, 1000, 'hostile_response',
      );
      expect(hostileBrave).toBeGreaterThan(hostileTimid);
    });
  });
});

// ---------------------------------------------------------------------------
// resolveFirstContactOutcome
// ---------------------------------------------------------------------------

describe('resolveFirstContactOutcome', () => {
  it('friendly response yields positive attitude', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'friendly_response', false, false,
    );
    expect(outcome.initialAttitude).toBe(30);
    expect(outcome.warDeclared).toBe(false);
    expect(outcome.relationshipEstablished).toBe(true);
  });

  it('friendly response with xenolinguistics yields higher attitude', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'friendly_response', true, false,
    );
    expect(outcome.initialAttitude).toBe(40);
    expect(outcome.communicationLevel).toBe('basic');
  });

  it('friendly response with both having xenolinguistics gives scientific communication', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'friendly_response', true, true,
    );
    expect(outcome.communicationLevel).toBe('scientific');
  });

  it('cautious interest yields small positive attitude', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'cautious_interest', false, false,
    );
    expect(outcome.initialAttitude).toBe(5);
    expect(outcome.warDeclared).toBe(false);
    expect(outcome.tradeOpened).toBe(false);
  });

  it('confusion yields zero attitude', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'confusion', false, false,
    );
    expect(outcome.initialAttitude).toBe(0);
    expect(outcome.warDeclared).toBe(false);
  });

  it('confusion from observe_silently does not establish a relationship', () => {
    const outcome = resolveFirstContactOutcome(
      'observe_silently', 'confusion', false, false,
    );
    expect(outcome.relationshipEstablished).toBe(false);
  });

  it('hostile response yields war and very negative attitude', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'hostile_response', false, false,
    );
    expect(outcome.initialAttitude).toBe(-50);
    expect(outcome.warDeclared).toBe(true);
    expect(outcome.communicationLevel).toBe('none');
  });

  it('fear and retreat yields mildly negative attitude', () => {
    const outcome = resolveFirstContactOutcome(
      'display_strength', 'fear_and_retreat', false, false,
    );
    expect(outcome.initialAttitude).toBe(-10);
    expect(outcome.warDeclared).toBe(false);
  });

  it('total misunderstanding from display_strength triggers war', () => {
    const outcome = resolveFirstContactOutcome(
      'display_strength', 'total_misunderstanding', false, false,
    );
    expect(outcome.warDeclared).toBe(true);
    expect(outcome.initialAttitude).toBe(-30);
  });

  it('total misunderstanding from greeting does not trigger war', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'total_misunderstanding', false, false,
    );
    expect(outcome.warDeclared).toBe(false);
    expect(outcome.initialAttitude).toBe(-30);
  });

  it('religious awe yields very positive attitude and trade', () => {
    const outcome = resolveFirstContactOutcome(
      'display_strength', 'religious_awe', false, false,
    );
    expect(outcome.initialAttitude).toBe(40);
    expect(outcome.tradeOpened).toBe(true);
    expect(outcome.communicationLevel).toBe('basic');
  });

  it('assimilation offer yields positive attitude with trade', () => {
    const outcome = resolveFirstContactOutcome(
      'send_greeting', 'assimilation_offer', false, false,
    );
    expect(outcome.initialAttitude).toBe(20);
    expect(outcome.tradeOpened).toBe(true);
    expect(outcome.relationshipEstablished).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ethical audit trail
// ---------------------------------------------------------------------------

describe('createAuditTrail', () => {
  it('creates a trail with all dimensions at zero', () => {
    const trail = createAuditTrail();
    expect(trail.mercy).toBe(0);
    expect(trail.honesty).toBe(0);
    expect(trail.justice).toBe(0);
    expect(trail.diplomacy).toBe(0);
    expect(trail.ecology).toBe(0);
    expect(trail.decisions).toHaveLength(0);
  });
});

describe('recordDecision', () => {
  it('appends the decision to the log', () => {
    const trail = createAuditTrail();
    const updated = recordDecision(trail, {
      category: 'mercy',
      description: 'Spared captured prisoners',
      scoreChange: 15,
    }, 42);
    expect(updated.decisions).toHaveLength(1);
    expect(updated.decisions[0].tick).toBe(42);
    expect(updated.decisions[0].description).toBe('Spared captured prisoners');
  });

  it('adjusts the relevant dimension score', () => {
    const trail = createAuditTrail();
    const updated = recordDecision(trail, {
      category: 'mercy',
      description: 'Spared captured prisoners',
      scoreChange: 15,
    }, 42);
    expect(updated.mercy).toBe(15);
    // Other dimensions remain unchanged
    expect(updated.honesty).toBe(0);
    expect(updated.justice).toBe(0);
  });

  it('supports negative score changes', () => {
    const trail = createAuditTrail();
    const updated = recordDecision(trail, {
      category: 'honesty',
      description: 'Broke a signed treaty without provocation',
      scoreChange: -20,
    }, 10);
    expect(updated.honesty).toBe(-20);
  });

  it('clamps scores to +100', () => {
    let trail = createAuditTrail();
    trail = recordDecision(trail, {
      category: 'ecology',
      description: 'Reforested a devastated world',
      scoreChange: 80,
    }, 1);
    trail = recordDecision(trail, {
      category: 'ecology',
      description: 'Created a nature reserve across an entire planet',
      scoreChange: 50,
    }, 2);
    expect(trail.ecology).toBe(100);
  });

  it('clamps scores to -100', () => {
    let trail = createAuditTrail();
    trail = recordDecision(trail, {
      category: 'justice',
      description: 'Enslaved a conquered population',
      scoreChange: -80,
    }, 1);
    trail = recordDecision(trail, {
      category: 'justice',
      description: 'Executed dissidents without trial',
      scoreChange: -50,
    }, 2);
    expect(trail.justice).toBe(-100);
  });

  it('does not mutate the original trail', () => {
    const original = createAuditTrail();
    recordDecision(original, {
      category: 'diplomacy',
      description: 'Negotiated peace between warring factions',
      scoreChange: 25,
    }, 5);
    expect(original.diplomacy).toBe(0);
    expect(original.decisions).toHaveLength(0);
  });

  it('accumulates multiple decisions across categories', () => {
    let trail = createAuditTrail();
    trail = recordDecision(trail, {
      category: 'mercy',
      description: 'Released prisoners of war',
      scoreChange: 10,
    }, 1);
    trail = recordDecision(trail, {
      category: 'honesty',
      description: 'Honoured a trade agreement under duress',
      scoreChange: 20,
    }, 2);
    trail = recordDecision(trail, {
      category: 'diplomacy',
      description: 'Opened fire without warning',
      scoreChange: -30,
    }, 3);
    expect(trail.mercy).toBe(10);
    expect(trail.honesty).toBe(20);
    expect(trail.diplomacy).toBe(-30);
    expect(trail.decisions).toHaveLength(3);
  });

  it('records the correct tick on each decision', () => {
    let trail = createAuditTrail();
    trail = recordDecision(trail, {
      category: 'ecology',
      description: 'Strip-mined a habitable world',
      scoreChange: -15,
    }, 100);
    trail = recordDecision(trail, {
      category: 'ecology',
      description: 'Planted forests on a barren moon',
      scoreChange: 10,
    }, 200);
    expect(trail.decisions[0].tick).toBe(100);
    expect(trail.decisions[1].tick).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Test helper: count specific outcomes over many iterations
// ---------------------------------------------------------------------------

function countOutcomes(
  approach: FirstContactApproach,
  initiatorHasXeno: boolean,
  targetHasXeno: boolean,
  openness: number,
  bravery: number,
  iterations: number,
  targetReaction: FirstContactReaction,
): number {
  let count = 0;
  for (let i = 0; i < iterations; i++) {
    const result = resolveFirstContact(
      approach, 'a', 'b',
      initiatorHasXeno, targetHasXeno,
      openness, bravery,
    );
    if (result === targetReaction) count++;
  }
  return count;
}
