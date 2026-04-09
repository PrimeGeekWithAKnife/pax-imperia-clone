/**
 * Vassalage engine tests — tribute, restrictions, relationship queries.
 *
 * TDD: these tests are written before the implementation.
 */

import { describe, it, expect } from 'vitest';
import type { EmpireResources } from '../types/resources.js';
import type { DiplomacyState, DiplomaticRelationFull, ActiveTreaty } from '../engine/diplomacy.js';
import {
  VASSAL_TRIBUTE_RATE,
  VASSAL_RESEARCH_BONUS,
  OVERLORD_COMBAT_BONUS,
  calculateTribute,
  applyTribute,
  findVassalRelationships,
  isVassal,
  isOverlord,
  getOverlord,
  getVassals,
  isVassalActionRestricted,
} from '../engine/vassalage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResources(overrides: Partial<EmpireResources> = {}): EmpireResources {
  return {
    credits: 1000,
    minerals: 500,
    rareElements: 100,
    energy: 200,
    organics: 150,
    exoticMaterials: 50,
    faith: 0,
    researchPoints: 300,
    ...overrides,
  };
}

function makeVassalTreaty(overlordId: string): ActiveTreaty {
  return {
    id: 'treaty-vassal-1',
    type: 'vassalism',
    startTick: 10,
    duration: -1,
    terms: { isOverlord: 0, vassalTributeRate: VASSAL_TRIBUTE_RATE },
  };
}

/**
 * Build a minimal DiplomacyState containing the given vassalism relationships.
 * Each entry in `pairs` is [overlordId, vassalId].
 */
function makeDiplomacyState(
  pairs: Array<[string, string]>,
): DiplomacyState {
  const relations = new Map<string, Map<string, DiplomaticRelationFull>>();

  function ensureRelation(from: string, to: string): DiplomaticRelationFull {
    if (!relations.has(from)) relations.set(from, new Map());
    const inner = relations.get(from)!;
    if (!inner.has(to)) {
      inner.set(to, {
        empireId: from,
        targetEmpireId: to,
        attitude: 0,
        trust: 0,
        status: 'neutral',
        treaties: [],
        tradeRoutes: 0,
        firstContact: 1,
        lastInteraction: 1,
        communicationLevel: 'basic',
        incidentLog: [],
      });
    }
    return inner.get(to)!;
  }

  for (const [overlordId, vassalId] of pairs) {
    const treatyId = `treaty-vassal-${vassalId}-${overlordId}`;

    // On the vassal's relation toward the overlord, isOverlord = 0 (I am the vassal).
    const vassalRel = ensureRelation(vassalId, overlordId);
    vassalRel.treaties.push({
      id: treatyId,
      type: 'vassalism',
      startTick: 10,
      duration: -1,
      terms: { isOverlord: 0 },
    });

    // On the overlord's relation toward the vassal, isOverlord = 1 (I am the overlord).
    const overlordRel = ensureRelation(overlordId, vassalId);
    overlordRel.treaties.push({
      id: treatyId,
      type: 'vassalism',
      startTick: 10,
      duration: -1,
      terms: { isOverlord: 1 },
    });
  }

  return { relations };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('vassalage constants', () => {
  it('VASSAL_TRIBUTE_RATE is 15%', () => {
    expect(VASSAL_TRIBUTE_RATE).toBe(0.15);
  });

  it('VASSAL_RESEARCH_BONUS is 10%', () => {
    expect(VASSAL_RESEARCH_BONUS).toBe(0.10);
  });

  it('OVERLORD_COMBAT_BONUS is 5%', () => {
    expect(OVERLORD_COMBAT_BONUS).toBe(0.05);
  });
});

// ---------------------------------------------------------------------------
// calculateTribute
// ---------------------------------------------------------------------------

describe('calculateTribute', () => {
  it('calculates 15% of 1000 = 150', () => {
    expect(calculateTribute(1000)).toBe(150);
  });

  it('returns 0 for zero income', () => {
    expect(calculateTribute(0)).toBe(0);
  });

  it('returns 0 for negative income', () => {
    expect(calculateTribute(-500)).toBe(0);
  });

  it('accepts a custom tribute rate', () => {
    expect(calculateTribute(1000, 0.25)).toBe(250);
  });

  it('rounds to the nearest integer', () => {
    // 15% of 333 = 49.95 → rounds to 50
    expect(calculateTribute(333)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// applyTribute
// ---------------------------------------------------------------------------

describe('applyTribute', () => {
  it('deducts tribute from vassal and adds to overlord', () => {
    const vassal = makeResources({ credits: 1000 });
    const overlord = makeResources({ credits: 2000 });

    const result = applyTribute(vassal, overlord, 150);

    expect(result.vassal.credits).toBe(850);
    expect(result.overlord.credits).toBe(2150);
  });

  it('does not deduct more credits than the vassal has', () => {
    const vassal = makeResources({ credits: 50 });
    const overlord = makeResources({ credits: 2000 });

    const result = applyTribute(vassal, overlord, 150);

    expect(result.vassal.credits).toBe(0);
    expect(result.overlord.credits).toBe(2050);
  });

  it('handles zero tribute gracefully', () => {
    const vassal = makeResources({ credits: 1000 });
    const overlord = makeResources({ credits: 2000 });

    const result = applyTribute(vassal, overlord, 0);

    expect(result.vassal.credits).toBe(1000);
    expect(result.overlord.credits).toBe(2000);
  });

  it('does not mutate the original resource objects', () => {
    const vassal = makeResources({ credits: 1000 });
    const overlord = makeResources({ credits: 2000 });

    applyTribute(vassal, overlord, 150);

    expect(vassal.credits).toBe(1000);
    expect(overlord.credits).toBe(2000);
  });

  it('preserves non-credit resources unchanged', () => {
    const vassal = makeResources({ credits: 1000, minerals: 500 });
    const overlord = makeResources({ credits: 2000, minerals: 800 });

    const result = applyTribute(vassal, overlord, 150);

    expect(result.vassal.minerals).toBe(500);
    expect(result.overlord.minerals).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// findVassalRelationships
// ---------------------------------------------------------------------------

describe('findVassalRelationships', () => {
  it('finds a single overlord-vassal pair', () => {
    const state = makeDiplomacyState([['empire-a', 'empire-b']]);
    const relationships = findVassalRelationships(state);

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toEqual({ overlordId: 'empire-a', vassalId: 'empire-b' });
  });

  it('finds multiple vassalage relationships', () => {
    const state = makeDiplomacyState([
      ['empire-a', 'empire-b'],
      ['empire-a', 'empire-c'],
    ]);
    const relationships = findVassalRelationships(state);

    expect(relationships).toHaveLength(2);
    const overlords = relationships.map(r => r.overlordId);
    const vassals = relationships.map(r => r.vassalId);
    expect(overlords).toEqual(['empire-a', 'empire-a']);
    expect(vassals).toContain('empire-b');
    expect(vassals).toContain('empire-c');
  });

  it('returns an empty array when no vassalism treaties exist', () => {
    const state: DiplomacyState = { relations: new Map() };
    const relationships = findVassalRelationships(state);
    expect(relationships).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isVassal / isOverlord
// ---------------------------------------------------------------------------

describe('isVassal', () => {
  const relationships = [
    { overlordId: 'empire-a', vassalId: 'empire-b' },
    { overlordId: 'empire-a', vassalId: 'empire-c' },
  ];

  it('returns true for a vassal empire', () => {
    expect(isVassal('empire-b', relationships)).toBe(true);
  });

  it('returns false for an overlord empire', () => {
    expect(isVassal('empire-a', relationships)).toBe(false);
  });

  it('returns false for an unrelated empire', () => {
    expect(isVassal('empire-d', relationships)).toBe(false);
  });
});

describe('isOverlord', () => {
  const relationships = [
    { overlordId: 'empire-a', vassalId: 'empire-b' },
  ];

  it('returns true for an overlord empire', () => {
    expect(isOverlord('empire-a', relationships)).toBe(true);
  });

  it('returns false for a vassal empire', () => {
    expect(isOverlord('empire-b', relationships)).toBe(false);
  });

  it('returns false for an unrelated empire', () => {
    expect(isOverlord('empire-d', relationships)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getOverlord / getVassals
// ---------------------------------------------------------------------------

describe('getOverlord', () => {
  const relationships = [
    { overlordId: 'empire-a', vassalId: 'empire-b' },
    { overlordId: 'empire-c', vassalId: 'empire-d' },
  ];

  it('returns the overlord ID for a vassal', () => {
    expect(getOverlord('empire-b', relationships)).toBe('empire-a');
  });

  it('returns null for an empire that is not a vassal', () => {
    expect(getOverlord('empire-a', relationships)).toBeNull();
  });

  it('returns null for an unknown empire', () => {
    expect(getOverlord('empire-x', relationships)).toBeNull();
  });
});

describe('getVassals', () => {
  const relationships = [
    { overlordId: 'empire-a', vassalId: 'empire-b' },
    { overlordId: 'empire-a', vassalId: 'empire-c' },
    { overlordId: 'empire-d', vassalId: 'empire-e' },
  ];

  it('returns all vassals of an overlord', () => {
    const vassals = getVassals('empire-a', relationships);
    expect(vassals).toHaveLength(2);
    expect(vassals).toContain('empire-b');
    expect(vassals).toContain('empire-c');
  });

  it('returns an empty array for an empire with no vassals', () => {
    expect(getVassals('empire-b', relationships)).toEqual([]);
  });

  it('returns an empty array for an unknown empire', () => {
    expect(getVassals('empire-x', relationships)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isVassalActionRestricted
// ---------------------------------------------------------------------------

describe('isVassalActionRestricted', () => {
  const overlordId = 'empire-a';
  const vassalId = 'empire-b';
  const overlordAllies = ['empire-c', 'empire-d'];

  it('vassal cannot declare war on overlord', () => {
    expect(
      isVassalActionRestricted('declare_war', vassalId, overlordId, overlordId, overlordAllies),
    ).toBe(true);
  });

  it('vassal cannot declare war on overlord allies', () => {
    expect(
      isVassalActionRestricted('declare_war', vassalId, 'empire-c', overlordId, overlordAllies),
    ).toBe(true);
    expect(
      isVassalActionRestricted('declare_war', vassalId, 'empire-d', overlordId, overlordAllies),
    ).toBe(true);
  });

  it('vassal CAN declare war on non-allies', () => {
    expect(
      isVassalActionRestricted('declare_war', vassalId, 'empire-e', overlordId, overlordAllies),
    ).toBe(false);
  });

  it('propose_treaty is not restricted by default', () => {
    expect(
      isVassalActionRestricted('propose_treaty', vassalId, 'empire-e', overlordId, overlordAllies),
    ).toBe(false);
  });

  it('break_treaty is not restricted by default', () => {
    expect(
      isVassalActionRestricted('break_treaty', vassalId, 'empire-e', overlordId, overlordAllies),
    ).toBe(false);
  });

  it('unknown actions are not restricted', () => {
    expect(
      isVassalActionRestricted('build_station', vassalId, 'empire-e', overlordId, overlordAllies),
    ).toBe(false);
  });
});
