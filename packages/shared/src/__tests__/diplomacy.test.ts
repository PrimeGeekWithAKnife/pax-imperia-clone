import { describe, it, expect } from 'vitest';
import {
  initializeDiplomacy,
  getRelation,
  makeFirstContact,
  proposeTreaty,
  breakTreaty,
  declareWar,
  makePeace,
  modifyAttitude,
  calculateTradeIncome,
  evaluateTreatyProposal,
  processDiplomacyTick,
  getDiplomaticStatusLabel,
} from '../engine/diplomacy.js';
import type {
  DiplomacyState,
  DiplomaticRelationFull,
  TreatyProposal,
} from '../engine/diplomacy.js';
import type { Empire, Species } from '../types/species.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSpecies(overrides: Partial<Species['traits']> = {}): Species {
  return {
    id: 'human',
    name: 'Humans',
    description: 'Test species',
    portrait: 'human',
    isPrebuilt: true,
    specialAbilities: [],
    environmentPreference: {
      idealTemperature: 295,
      temperatureTolerance: 50,
      idealGravity: 1.0,
      gravityTolerance: 0.5,
      preferredAtmospheres: ['oxygen_nitrogen'],
    },
    traits: {
      construction: 5,
      reproduction: 5,
      research: 5,
      espionage: 5,
      economy: 5,
      combat: 5,
      diplomacy: 5,
      ...overrides,
    },
  };
}

function makeEmpire(id: string, overrides: Partial<Empire> = {}): Empire {
  return {
    id,
    name: `Empire ${id}`,
    species: makeSpecies(),
    color: '#ff0000',
    credits: 1000,
    researchPoints: 0,
    knownSystems: [],
    diplomacy: [],
    technologies: [],
    currentAge: 'nano_atomic',
    isAI: true,
    aiPersonality: 'diplomatic',
    government: 'democracy',
    ...overrides,
  };
}

function threeEmpireState(): DiplomacyState {
  return initializeDiplomacy(['alpha', 'beta', 'gamma']);
}

// ---------------------------------------------------------------------------
// initializeDiplomacy
// ---------------------------------------------------------------------------

describe('initializeDiplomacy', () => {
  it('creates a relation map for every supplied empire ID', () => {
    const state = initializeDiplomacy(['alpha', 'beta', 'gamma']);
    expect(state.relations.has('alpha')).toBe(true);
    expect(state.relations.has('beta')).toBe(true);
    expect(state.relations.has('gamma')).toBe(true);
  });

  it('starts with no cross-empire relation entries (unknown until contact)', () => {
    const state = initializeDiplomacy(['alpha', 'beta']);
    // Inner maps should be empty; getRelation returns null
    expect(getRelation(state, 'alpha', 'beta')).toBeNull();
    expect(getRelation(state, 'beta', 'alpha')).toBeNull();
  });

  it('returns empty state for a single empire', () => {
    const state = initializeDiplomacy(['solo']);
    expect(state.relations.has('solo')).toBe(true);
    expect(state.relations.get('solo')!.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// makeFirstContact
// ---------------------------------------------------------------------------

describe('makeFirstContact', () => {
  it('establishes neutral relation on both sides', () => {
    const state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 10);
    const ab = getRelation(state, 'alpha', 'beta')!;
    const ba = getRelation(state, 'beta', 'alpha')!;
    expect(ab).not.toBeNull();
    expect(ba).not.toBeNull();
    expect(ab.status).toBe('neutral');
    expect(ba.status).toBe('neutral');
  });

  it('sets firstContact tick on both sides', () => {
    const state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 42);
    expect(getRelation(state, 'alpha', 'beta')!.firstContact).toBe(42);
    expect(getRelation(state, 'beta', 'alpha')!.firstContact).toBe(42);
  });

  it('initialises trust above zero', () => {
    const state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    expect(getRelation(state, 'alpha', 'beta')!.trust).toBeGreaterThan(0);
    expect(getRelation(state, 'beta', 'alpha')!.trust).toBeGreaterThan(0);
  });

  it('does not mutate the original state', () => {
    const original = threeEmpireState();
    makeFirstContact(original, 'alpha', 'beta', 1);
    expect(getRelation(original, 'alpha', 'beta')).toBeNull();
  });

  it('logs a first_contact incident', () => {
    const state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 5);
    const log = getRelation(state, 'alpha', 'beta')!.incidentLog;
    expect(log.some((e) => e.type === 'first_contact')).toBe(true);
  });

  it('is idempotent: calling twice does not reset firstContact tick', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 10);
    state = makeFirstContact(state, 'alpha', 'beta', 99);
    expect(getRelation(state, 'alpha', 'beta')!.firstContact).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// proposeTreaty
// ---------------------------------------------------------------------------

describe('proposeTreaty', () => {
  function contactedState(): DiplomacyState {
    return makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
  }

  it('adds the treaty to both sides', () => {
    const proposal: TreatyProposal = {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'non_aggression',
    };
    const state = proposeTreaty(contactedState(), proposal, 5);
    const ab = getRelation(state, 'alpha', 'beta')!;
    const ba = getRelation(state, 'beta', 'alpha')!;
    expect(ab.treaties).toHaveLength(1);
    expect(ab.treaties[0].type).toBe('non_aggression');
    expect(ba.treaties).toHaveLength(1);
    expect(ba.treaties[0].type).toBe('non_aggression');
  });

  it('both sides share the same treaty ID', () => {
    const proposal: TreatyProposal = {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'trade',
    };
    const state = proposeTreaty(contactedState(), proposal, 5);
    const abId = getRelation(state, 'alpha', 'beta')!.treaties[0].id;
    const baId = getRelation(state, 'beta', 'alpha')!.treaties[0].id;
    expect(abId).toBe(baId);
  });

  it('trade treaty increments trade routes on both sides', () => {
    const proposal: TreatyProposal = {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'trade',
    };
    const state = proposeTreaty(contactedState(), proposal, 5);
    expect(getRelation(state, 'alpha', 'beta')!.tradeRoutes).toBe(1);
    expect(getRelation(state, 'beta', 'alpha')!.tradeRoutes).toBe(1);
  });

  it('applying a treaty raises attitude on both sides', () => {
    const proposal: TreatyProposal = {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'alliance',
    };
    const before = getRelation(contactedState(), 'alpha', 'beta')?.attitude ?? 0;
    const state = proposeTreaty(contactedState(), proposal, 5);
    expect(getRelation(state, 'alpha', 'beta')!.attitude).toBeGreaterThan(before);
  });

  it('logs a treaty_signed incident', () => {
    const proposal: TreatyProposal = {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'research_sharing',
    };
    const state = proposeTreaty(contactedState(), proposal, 5);
    const log = getRelation(state, 'alpha', 'beta')!.incidentLog;
    expect(log.some((e) => e.type === 'treaty_signed')).toBe(true);
  });

  it('multiple different treaties between same empires are all tracked', () => {
    let state = contactedState();
    const types: TreatyProposal['treatyType'][] = ['non_aggression', 'trade', 'research_sharing'];
    for (const t of types) {
      state = proposeTreaty(state, { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: t }, 5);
    }
    expect(getRelation(state, 'alpha', 'beta')!.treaties).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// breakTreaty
// ---------------------------------------------------------------------------

describe('breakTreaty', () => {
  function stateWithNonAggression(): { state: DiplomacyState; treatyId: string } {
    const base = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    const withTreaty = proposeTreaty(
      base,
      { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: 'non_aggression' },
      2,
    );
    const treatyId = getRelation(withTreaty, 'alpha', 'beta')!.treaties[0].id;
    return { state: withTreaty, treatyId };
  }

  it('removes the treaty from both sides', () => {
    const { state, treatyId } = stateWithNonAggression();
    const next = breakTreaty(state, 'alpha', 'beta', treatyId, 10);
    expect(getRelation(next, 'alpha', 'beta')!.treaties).toHaveLength(0);
    expect(getRelation(next, 'beta', 'alpha')!.treaties).toHaveLength(0);
  });

  it('applies trust penalty on both sides', () => {
    const { state, treatyId } = stateWithNonAggression();
    const trustBefore = getRelation(state, 'alpha', 'beta')!.trust;
    const next = breakTreaty(state, 'alpha', 'beta', treatyId, 10);
    expect(getRelation(next, 'alpha', 'beta')!.trust).toBeLessThan(trustBefore);
    expect(getRelation(next, 'beta', 'alpha')!.trust).toBeLessThan(trustBefore);
  });

  it('applies attitude penalty on both sides', () => {
    const { state, treatyId } = stateWithNonAggression();
    const attBefore = getRelation(state, 'alpha', 'beta')!.attitude;
    const next = breakTreaty(state, 'alpha', 'beta', treatyId, 10);
    expect(getRelation(next, 'alpha', 'beta')!.attitude).toBeLessThan(attBefore);
  });

  it('logs a treaty_broken incident', () => {
    const { state, treatyId } = stateWithNonAggression();
    const next = breakTreaty(state, 'alpha', 'beta', treatyId, 10);
    const log = getRelation(next, 'alpha', 'beta')!.incidentLog;
    expect(log.some((e) => e.type === 'treaty_broken')).toBe(true);
  });

  it('trade treaty removal decrements trade routes', () => {
    const base = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    const withTrade = proposeTreaty(
      base,
      { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: 'trade' },
      2,
    );
    const treatyId = getRelation(withTrade, 'alpha', 'beta')!.treaties[0].id;
    const next = breakTreaty(withTrade, 'alpha', 'beta', treatyId, 10);
    expect(getRelation(next, 'alpha', 'beta')!.tradeRoutes).toBe(0);
    expect(getRelation(next, 'beta', 'alpha')!.tradeRoutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// declareWar
// ---------------------------------------------------------------------------

describe('declareWar', () => {
  it('sets status to at_war on both sides', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = declareWar(state, 'alpha', 'beta', 5);
    expect(getRelation(state, 'alpha', 'beta')!.status).toBe('at_war');
    expect(getRelation(state, 'beta', 'alpha')!.status).toBe('at_war');
  });

  it('breaks all existing treaties', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = proposeTreaty(
      state,
      { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: 'non_aggression' },
      2,
    );
    state = proposeTreaty(
      state,
      { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: 'trade' },
      3,
    );
    state = declareWar(state, 'alpha', 'beta', 10);
    expect(getRelation(state, 'alpha', 'beta')!.treaties).toHaveLength(0);
    expect(getRelation(state, 'beta', 'alpha')!.treaties).toHaveLength(0);
  });

  it('applies massive attitude and trust penalties', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    const attBefore = getRelation(state, 'alpha', 'beta')!.attitude;
    const trustBefore = getRelation(state, 'alpha', 'beta')!.trust;
    state = declareWar(state, 'alpha', 'beta', 5);
    const rel = getRelation(state, 'alpha', 'beta')!;
    expect(rel.attitude).toBeLessThan(attBefore);
    expect(rel.trust).toBeLessThan(trustBefore);
  });

  it('logs a war_declared incident', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = declareWar(state, 'alpha', 'beta', 5);
    const log = getRelation(state, 'alpha', 'beta')!.incidentLog;
    expect(log.some((e) => e.type === 'war_declared')).toBe(true);
  });

  it('clears trade routes', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = proposeTreaty(
      state,
      { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: 'trade' },
      2,
    );
    state = declareWar(state, 'alpha', 'beta', 10);
    expect(getRelation(state, 'alpha', 'beta')!.tradeRoutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// makePeace
// ---------------------------------------------------------------------------

describe('makePeace', () => {
  function warState(): DiplomacyState {
    const state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    return declareWar(state, 'alpha', 'beta', 5);
  }

  it('sets status to neutral on both sides', () => {
    const state = makePeace(warState(), 'alpha', 'beta', 20);
    expect(getRelation(state, 'alpha', 'beta')!.status).toBe('neutral');
    expect(getRelation(state, 'beta', 'alpha')!.status).toBe('neutral');
  });

  it('logs a peace_made incident', () => {
    const state = makePeace(warState(), 'alpha', 'beta', 20);
    const log = getRelation(state, 'alpha', 'beta')!.incidentLog;
    expect(log.some((e) => e.type === 'peace_made')).toBe(true);
  });

  it('does not mutate original state', () => {
    const original = warState();
    makePeace(original, 'alpha', 'beta', 20);
    expect(getRelation(original, 'alpha', 'beta')!.status).toBe('at_war');
  });
});

// ---------------------------------------------------------------------------
// modifyAttitude
// ---------------------------------------------------------------------------

describe('modifyAttitude', () => {
  it('increases attitude by the given amount', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    const before = getRelation(state, 'alpha', 'beta')!.attitude;
    state = modifyAttitude(state, 'alpha', 'beta', 15, 'trade_gift', 5);
    expect(getRelation(state, 'alpha', 'beta')!.attitude).toBe(before + 15);
  });

  it('decreases attitude with a negative change', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = modifyAttitude(state, 'alpha', 'beta', -20, 'border_incident', 5);
    expect(getRelation(state, 'alpha', 'beta')!.attitude).toBeLessThan(0);
  });

  it('clamps attitude to +100', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = modifyAttitude(state, 'alpha', 'beta', 200, 'cheat', 1);
    expect(getRelation(state, 'alpha', 'beta')!.attitude).toBe(100);
  });

  it('clamps attitude to -100', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = modifyAttitude(state, 'alpha', 'beta', -200, 'grudge', 1);
    expect(getRelation(state, 'alpha', 'beta')!.attitude).toBe(-100);
  });

  it('does not affect the reverse relation', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    const betaToAlphaBefore = getRelation(state, 'beta', 'alpha')!.attitude;
    state = modifyAttitude(state, 'alpha', 'beta', 30, 'gift', 1);
    expect(getRelation(state, 'beta', 'alpha')!.attitude).toBe(betaToAlphaBefore);
  });

  it('logs an attitude_modified incident', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = modifyAttitude(state, 'alpha', 'beta', 10, 'friendly_gesture', 3);
    const log = getRelation(state, 'alpha', 'beta')!.incidentLog;
    expect(log.some((e) => e.type === 'attitude_modified')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Trust clamping
// ---------------------------------------------------------------------------

describe('trust clamping', () => {
  it('trust never exceeds 100', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    // Sign many treaties to stack trust bonuses
    for (let i = 0; i < 20; i++) {
      state = proposeTreaty(
        state,
        { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: 'research_sharing' },
        i + 2,
      );
    }
    expect(getRelation(state, 'alpha', 'beta')!.trust).toBeLessThanOrEqual(100);
  });

  it('trust never drops below 0', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    // Break war over and over to hammer trust
    for (let i = 0; i < 10; i++) {
      state = declareWar(state, 'alpha', 'beta', i + 2);
      state = makePeace(state, 'alpha', 'beta', i + 3);
    }
    expect(getRelation(state, 'alpha', 'beta')!.trust).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTradeIncome
// ---------------------------------------------------------------------------

describe('calculateTradeIncome', () => {
  function makeRelation(overrides: Partial<DiplomaticRelationFull> = {}): DiplomaticRelationFull {
    return {
      empireId: 'alpha',
      targetEmpireId: 'beta',
      attitude: 0,
      trust: 50,
      status: 'neutral',
      treaties: [],
      tradeRoutes: 0,
      firstContact: 1,
      lastInteraction: 1,
      communicationLevel: 'none',
      incidentLog: [],
      ...overrides,
    };
  }

  it('returns 0 with no trade routes and no trade treaty', () => {
    const rel = makeRelation({ tradeRoutes: 0 });
    expect(calculateTradeIncome(rel)).toBe(0);
  });

  it('scales linearly with trade routes', () => {
    const one = calculateTradeIncome(makeRelation({ tradeRoutes: 1 }));
    const two = calculateTradeIncome(makeRelation({ tradeRoutes: 2 }));
    expect(two).toBe(one * 2);
  });

  it('adds a bonus when a trade treaty is active', () => {
    const withoutTreaty = calculateTradeIncome(makeRelation({ tradeRoutes: 2 }));
    const withTreaty = calculateTradeIncome(
      makeRelation({
        tradeRoutes: 2,
        treaties: [{ id: 't1', type: 'trade', startTick: 1, duration: -1 }],
      }),
    );
    expect(withTreaty).toBeGreaterThan(withoutTreaty);
  });

  it('non-trade treaties do not add a bonus', () => {
    const base = calculateTradeIncome(makeRelation({ tradeRoutes: 1 }));
    const withNap = calculateTradeIncome(
      makeRelation({
        tradeRoutes: 1,
        treaties: [{ id: 't1', type: 'non_aggression', startTick: 1, duration: -1 }],
      }),
    );
    expect(withNap).toBe(base);
  });
});

// ---------------------------------------------------------------------------
// evaluateTreatyProposal
// ---------------------------------------------------------------------------

describe('evaluateTreatyProposal', () => {
  function makeRelationFull(
    overrides: Partial<DiplomaticRelationFull> = {},
  ): DiplomaticRelationFull {
    return {
      empireId: 'alpha',
      targetEmpireId: 'beta',
      attitude: 30,
      trust: 50,
      status: 'neutral',
      treaties: [],
      tradeRoutes: 0,
      firstContact: 1,
      lastInteraction: 1,
      communicationLevel: 'none',
      incidentLog: [],
      ...overrides,
    };
  }

  it('rejects when at war', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'diplomatic' });
    const rel = makeRelationFull({ status: 'at_war' });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'non_aggression',
    });
    expect(result.accept).toBe(false);
  });

  it('rejects when no first contact', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'diplomatic' });
    const rel = makeRelationFull({ firstContact: -1 });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'trade',
    });
    expect(result.accept).toBe(false);
  });

  it('rejects duplicate treaty of same type', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'diplomatic' });
    const rel = makeRelationFull({
      treaties: [{ id: 't1', type: 'trade', startTick: 1, duration: -1 }],
    });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'trade',
    });
    expect(result.accept).toBe(false);
  });

  it('diplomatic personality accepts with lower threshold', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'diplomatic' });
    // attitude of -10 would fail for aggressive but not diplomatic
    const rel = makeRelationFull({ attitude: -10 });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'non_aggression',
    });
    expect(result.accept).toBe(true);
  });

  it('aggressive personality has higher threshold for alliances', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'aggressive' });
    // Low attitude should fail
    const rel = makeRelationFull({ attitude: 5, trust: 30 });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'alliance',
    });
    expect(result.accept).toBe(false);
  });

  it('accepts trade with economic personality and good attitude', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'economic' });
    const rel = makeRelationFull({ attitude: 20, trust: 60 });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'trade',
    });
    expect(result.accept).toBe(true);
  });

  it('researcher personality favours research_sharing', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'researcher' });
    // Low attitude, but researcher gets big bonus on research_sharing
    const rel = makeRelationFull({ attitude: -15, trust: 40 });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'research_sharing',
    });
    expect(result.accept).toBe(true);
  });

  it('alliance requires minimum trust of 50', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'diplomatic' });
    const rel = makeRelationFull({ attitude: 80, trust: 30 }); // high attitude, low trust
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'alliance',
    });
    expect(result.accept).toBe(false);
  });

  it('returns a reason string in all outcomes', () => {
    const proposer = makeEmpire('alpha');
    const target = makeEmpire('beta', { aiPersonality: 'diplomatic' });
    const rel = makeRelationFull({ attitude: 50, trust: 60 });
    const result = evaluateTreatyProposal(proposer, target, rel, {
      fromEmpireId: 'alpha',
      toEmpireId: 'beta',
      treatyType: 'trade',
    });
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// processDiplomacyTick
// ---------------------------------------------------------------------------

describe('processDiplomacyTick', () => {
  it('decays positive attitude toward 0 over time', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = modifyAttitude(state, 'alpha', 'beta', 60, 'set_high', 1);
    const before = getRelation(state, 'alpha', 'beta')!.attitude;
    state = processDiplomacyTick(state, 2);
    const after = getRelation(state, 'alpha', 'beta')!.attitude;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it('decays negative attitude toward 0 over time', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = modifyAttitude(state, 'alpha', 'beta', -60, 'set_low', 1);
    state = processDiplomacyTick(state, 2);
    const after = getRelation(state, 'alpha', 'beta')!.attitude;
    expect(after).toBeGreaterThan(-60);
    expect(after).toBeLessThan(0);
  });

  it('attitude of 0 stays at 0', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    // First contact sets attitude to 0 by default
    const before = getRelation(state, 'alpha', 'beta')!.attitude;
    state = processDiplomacyTick(state, 2);
    expect(getRelation(state, 'alpha', 'beta')!.attitude).toBe(0);
    expect(before).toBe(0);
  });

  it('expires timed treaties past their duration', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    // Manually inject a timed treaty that has already expired
    const inner = state.relations.get('alpha')!;
    const rel = inner.get('beta')!;
    const relCopy = { ...rel, treaties: [...rel.treaties, { id: 'expiring', type: 'non_aggression' as const, startTick: 1, duration: 5 }] };
    inner.set('beta', relCopy);
    // Tick 7 > startTick(1) + duration(5)
    state = processDiplomacyTick(state, 7);
    const treaties = getRelation(state, 'alpha', 'beta')!.treaties;
    expect(treaties.find((t) => t.id === 'expiring')).toBeUndefined();
  });

  it('permanent treaties (duration -1) are not expired', () => {
    let state = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    state = proposeTreaty(
      state,
      { fromEmpireId: 'alpha', toEmpireId: 'beta', treatyType: 'non_aggression' },
      1,
    );
    // Run 100 ticks
    for (let t = 2; t < 102; t++) {
      state = processDiplomacyTick(state, t);
    }
    expect(getRelation(state, 'alpha', 'beta')!.treaties).toHaveLength(1);
  });

  it('does not mutate the original state', () => {
    const original = makeFirstContact(threeEmpireState(), 'alpha', 'beta', 1);
    processDiplomacyTick(original, 2);
    // Original attitude should be unchanged
    expect(getRelation(original, 'alpha', 'beta')!.attitude).toBe(
      getRelation(original, 'alpha', 'beta')!.attitude,
    );
  });
});

// ---------------------------------------------------------------------------
// getDiplomaticStatusLabel
// ---------------------------------------------------------------------------

describe('getDiplomaticStatusLabel', () => {
  it('returns a non-empty string for every status', () => {
    const statuses: Parameters<typeof getDiplomaticStatusLabel>[0][] = [
      'unknown',
      'neutral',
      'friendly',
      'allied',
      'hostile',
      'at_war',
    ];
    for (const s of statuses) {
      expect(getDiplomaticStatusLabel(s).length).toBeGreaterThan(0);
    }
  });

  it('returns "At War" for at_war status', () => {
    expect(getDiplomaticStatusLabel('at_war')).toBe('At War');
  });

  it('returns "Allied" for allied status', () => {
    expect(getDiplomaticStatusLabel('allied')).toBe('Allied');
  });
});
